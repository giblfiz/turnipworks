#!/usr/bin/env python3
"""Far buildings sleep (big maps, 2026-10-06; engine/client/world.js SLEEP; experiments/2026-10-06-megamap/FIXES.md).

  local:  TW_GPU=1 python3 engine/test/browser_sleep.py --local

A row of small buildings 150 ft apart, far wider than the opening view. One GM tab.
  ASLEEP   rooms far outside the view are out of the scene graph (floors, walls, things), nothing is unloaded, pawns
           and loose things stay, the fire lights stay (same light count asleep or awake), their flames do not
  WAKE     in EVERY frame of a pan, a turn, a zoom out, a jump across the map, a tilt to the horizon and a cut to
           another level, each room whose box touches the camera's view is in the scene BEFORE that frame is drawn
           (checked in the page after each frame, against the camera that drew it); the picture-in-picture's camera
           counts; an area picture wakes what it frames; switched off, everything is awake
  STATE    while a room sleeps: a thing moved, a thing deleted, a thing placed, a lamp put out, the cut changed,
           walls switched off. Nothing is lost: on waking, each is exactly where the state has it
  NEAR     selection keeps a far room awake and its sign is drawn; a click picks a thing in a room that has just
           woken; a ping lands in a sleeping room; the fog's walls and floors are the same asleep or awake
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []; tmp = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18141, 18771
def start_local():
    import shutil
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-sleep-'); site = tempfile.mkdtemp(prefix='tw-site-'); tmp.extend([data, site])
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=70, pitch=58, yaw=0, ms=250):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist, {dist}); g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")
    await pg.wait_for_timeout(ms)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
W = "tw.worldOf(tw.area())"
# THE RULE, checked in the page after every frame against the camera that drew it: a room whose box (the game's own
# box, no margin) touches the view volume of any camera on the area is in the scene, with all of its pieces.
WATCH = """(() => { const T = tw.THREE, fr = new T.Frustum(), m = new T.Matrix4(), box = new T.Box3(); window.__sw = { frames: 0, bad: [], maxAsleep: 0, minAsleep: 1e9, woke: 0 };
  window.__swOff = tw.on((what) => { if (what !== 'frame') return; const w = tw.worldOf(tw.area()), S = window.__sw; S.frames++;
    let z = 0; for (const u of w.units.values()) if (u.asleep) z++; S.maxAsleep = Math.max(S.maxAsleep, z); S.minAsleep = Math.min(S.minAsleep, z);
    for (const v of tw.views) { if (v.area !== tw.area()) continue; const c = v.camera; fr.setFromProjectionMatrix(m.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse));
      for (const u of w.units.values()) { box.min.set(u.x0, u.y0, u.z0); box.max.set(u.x1, u.y1, u.z1); if (!fr.intersectsBox(box)) continue;
        if (u.asleep) { S.bad.push([S.frames, u.id, 'unit asleep in view']); continue; }
        for (const s of w.shell.values()) if (s.unit === u.id && (s.asleep || !s.group.parent)) { S.bad.push([S.frames, s.key, 'shell piece out of the scene']); break; }
        for (const r of w.recs.values()) if (r.unit === u.id && r.entity.kind === 'object' && (r.asleep || !r.group.parent) && !w.anims.has(r.group)) { S.bad.push([S.frames, r.entity.id, 'thing out of the scene']); break; } } } }); })()"""
STOP = "(() => { window.__swOff?.(); const S = window.__sw; return { frames: S.frames, bad: S.bad.slice(0, 5), nbad: S.bad.length, maxAsleep: S.maxAsleep, minAsleep: S.minAsleep }; })()"
STATS = f"(() => {{ const w = {W}, s = w.sleepStats(); let nodes = 0, lights = 0; w.scene.traverse(o => {{ nodes++; if (o.isLight && o.visible) lights++; }}); return {{ ...s, nodes, lights, flames: w.fx.fire.flames().filter(f => f.world).length }}; }})()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900})
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); gm.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' and '404' not in m.text and 'Failed to load resource' not in m.text else None)
        await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST sleep {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        # six buildings in a row along x, 150 ft apart (cells of 5 ft: 30 apart); the third has an upper room, the last a cellar
        R = {}; plan = [('a', 'common', 0, 0, 6, 4, 0), ('b', 'kitchen', 30, 0, 4, 4, 0), ('c', 'common', 60, 0, 5, 4, 0), ('cup', 'guest', 60, 0, 4, 4, 10), ('d', 'guest', 90, 0, 4, 4, 0), ('e', 'kitchen', 120, 0, 4, 4, 0), ('f', 'common', 150, 0, 5, 4, 0), ('fdown', 'cellar', 150, 0, 4, 4, -10)]
        for i, (name, typ, x, z, w, d, y) in enumerate(plan):
            rid = f"room_slp{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, 'type': typ, 'x': x, 'z': z, 'w': w, 'd': d, 'seed': 6100 + i, **({'y': y} if y else {})})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 40000, name), f'{name} built')
        await settle(gm); cx = lambda name: next((x + w / 2) * 5 for (n, t, x, z, w, d, y) in plan if n == name)
        await view(gm, cx('a'), 10, 70); await gm.wait_for_timeout(2600)
        await wait(gm, f"[...{W}.recs.values()].every(r => !r.visual?.userData?.placeholder || !r.entity.url)", 60000, 'meshes in')

        # ================= ASLEEP =================
        print('ASLEEP: far rooms are out of the scene')
        s = await gm.evaluate(STATS); asleep = set(s['asleep'])
        check(s['on'] and s['units'] == len(plan), 'the unit is the room; the switch is on by default', f"{s['units']} units")
        check(R['a'] not in asleep and {R['d'], R['e'], R['f'], R['fdown']} <= asleep, 'the room in view is awake; the rooms 450 to 750 ft away are asleep', f"{len(asleep)} of {s['units']} asleep")
        parts = await gm.evaluate(f"(() => {{ const w = {W}, far = new Set({json.dumps([R['e'], R['f']])}); const sh = [...w.shell.values()].filter(x => far.has(x.roomId)), th = [...w.recs.values()].filter(r => far.has(r.entity.room) && r.entity.kind === 'object'); return {{ shell: sh.length, shellOut: sh.filter(x => !x.group.parent && x.asleep).length, things: th.length, thingsOut: th.filter(r => !r.group.parent && r.asleep).length, meshes: th.filter(r => {{ let n = 0; r.group.traverse(o => {{ if (o.isMesh) n++; }}); return n > 0; }}).length, geo: th.every(r => {{ let ok = true; r.group.traverse(o => {{ if (o.isMesh && !o.geometry.attributes.position) ok = false; }}); return ok; }}) }}; }})()")
        check(parts['shell'] > 20 and parts['shellOut'] == parts['shell'] and parts['things'] > 5 and parts['thingsOut'] == parts['things'], 'every floor, wall and thing of a sleeping room is out of the scene graph', str(parts))
        check(parts['meshes'] == parts['things'] and parts['geo'], 'and nothing of it is unloaded: its meshes and geometry are still there')
        await gm.evaluate("tw.perf.set({ sleep: false })"); await gm.wait_for_timeout(700); off = await gm.evaluate(STATS)
        check(not off['asleep'] and off['nodes'] > s['nodes'] * 1.3, 'switched off (tw.perf.set): everything is awake, and the scene is that much bigger', f"{s['nodes']} nodes asleep, {off['nodes']} awake")
        check(off['lights'] == s['lights'] and s['lights'] >= 3, 'the fire LIGHTS never sleep: the same lights are on asleep and awake (no shader is compiled again for a waking)', f"{s['lights']} / {off['lights']}")
        check(off['flames'] > s['flames'], 'a sleeping fire has no flame to draw', f"{s['flames']} flames with the far rooms asleep, {off['flames']} with all awake")
        fogA = await gm.evaluate(f"{W}.fogStructure().length")
        await gm.evaluate("tw.perf.set({ sleep: true })"); await gm.wait_for_timeout(2600); on = await gm.evaluate(STATS)
        check(len(on['asleep']) >= 4 and on['nodes'] < off['nodes'], 'switched on again: the far rooms go back to sleep after the dwell', f"{len(on['asleep'])} asleep")
        check(await gm.evaluate(f"{W}.fogStructure().length") == fogA, 'the fog is given the same floors and walls asleep or awake', fogA)
        # a pawn and a loose thing in a sleeping room stay in the scene
        fx_ = cx('f')
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_sleeper01', name: 'Far', x: {fx_}, z: 12 }})"); await wait(gm, "tw.entities()['tok_sleeper01']", 8000)
        await gm.wait_for_timeout(500)
        check(await gm.evaluate(f"!!{W}.recs.get('tok_sleeper01').group.parent && !{W}.recs.get('tok_sleeper01').asleep"), 'a pawn standing in a sleeping room is still in the scene (pawns never sleep)')

        # ================= STATE: changes while asleep =================
        print('STATE: what arrives for a sleeping room is not lost')
        far = await gm.evaluate(f"(() => {{ const es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{R['f']}' && !e.parent && e.place !== 'wall' && e.place !== 'ceiling' && !e.fromEdge); const lamp = Object.values(tw.entities()).find(e => e.kind === 'object' && e.room === '{R['f']}' && /fire|hearth|candle|lantern|lamp|chandelier|torch|brazier|sconce/.test(e.cat || '')); return {{ move: es[0], del: es[1], lamp: lamp || null, sample: es[2] }}; }})()")
        mv, dl = far['move'], far['del']
        await gm.evaluate(f"tw.dispatch('object.move', {{ id: '{mv['id']}', x: {mv['x'] + 3}, z: {mv['z'] + 2}, rot: 1.25 }})")
        await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{dl['id']}' }})")
        await gm.evaluate(f"tw.dispatch('object.place', {{ id: 'obj_sleepnew01', cat: '{far['sample']['cat']}', sku: '{far['sample'].get('sku', '')}', url: {json.dumps(far['sample'].get('url'))}, dims: {json.dumps(far['sample'].get('dims'))}, s: {json.dumps(far['sample'].get('s'))}, x: {fx_ + 4}, z: 6, room: '{R['f']}', place: 'floor', name: 'Late arrival' }})")
        if far['lamp']: await gm.evaluate(f"tw.dispatch('object.light', {{ id: '{far['lamp']['id']}', lit: false }})")
        await wait(gm, "tw.sync.pendingCount() === 0 && tw.entities()['obj_sleepnew01']", 8000, 'the changes are in the state'); await gm.wait_for_timeout(400)
        st = await gm.evaluate(f"(() => {{ const w = {W}, r = w.recs.get('{mv['id']}'), n = w.recs.get('obj_sleepnew01'); return {{ moved: r && !r.group.parent && r.asleep, gone: !w.recs.has('{dl['id']}'), fresh: !!n && !n.group.parent && n.asleep, unit: w.unitAsleep('{R['f']}') }}; }})()")
        check(st['unit'] and st['moved'] and st['gone'] and st['fresh'], 'moved, deleted and placed while the room sleeps: it stays asleep, the new thing arrives asleep', str(st))
        await gm.evaluate(f"tw.setCut(8)"); await gm.wait_for_timeout(300); await gm.evaluate("tw.setCut(null)"); await gm.wait_for_timeout(300)
        await gm.evaluate(WATCH)
        await view(gm, fx_, 10, 70, ms=60)   # a jump of 750 ft in one frame
        j = await gm.evaluate(f"new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {{ const w = {W}; res({{ asleep: w.unitAsleep('{R['f']}'), bad: window.__sw.bad.length, frames: window.__sw.frames }}); }})))")
        check(not j['asleep'] and j['bad'] == 0, 'a jump across the whole map: the room is in the scene in the very frame that first shows it', str(j))
        await gm.wait_for_timeout(600)
        st = await gm.evaluate(f"(() => {{ const w = {W}, E = tw.entities(), r = w.recs.get('{mv['id']}'), n = w.recs.get('obj_sleepnew01'), p = r.group.position; return {{ at: [p.x, p.z, r.group.rotation.y], want: [E['{mv['id']}'].x, E['{mv['id']}'].z, E['{mv['id']}'].rot], inScene: !!r.group.parent && !!n.group.parent, newAt: [n.group.position.x, n.group.position.z], gone: !w.recs.has('{dl['id']}') && !w.layers.things.children.some(g => g.userData.entityId === '{dl['id']}') }}; }})()")
        check(st['inScene'] and all(abs(a - b) < 0.01 for a, b in zip(st['at'], st['want'])) and abs(st['at'][0] - (mv['x'] + 3)) < 0.01, 'woken: the moved thing is where it was moved to, turned as it was turned', str(st['at']))
        check(st['gone'] and abs(st['newAt'][0] - (fx_ + 4)) < 0.01, 'the deleted thing is gone and the placed one is there')
        if far['lamp']:
            lit = await gm.evaluate(f"{W}.fx.fire.flames().filter(f => f.item?.spec?.uid === '{far['lamp']['id']}' && f.world).length")
            check(lit == 0, 'the lamp put out while asleep is out on waking')
        vis = await gm.evaluate(f"(() => {{ const w = {W}; return [...w.shell.values()].filter(s => s.roomId === '{R['f']}').every(s => s.group.visible && s.group.parent); }})()")
        check(vis, 'a cut made and lifted while it slept left it whole')

        # ================= WAKE: before it can be seen, every frame =================
        print('WAKE: in every frame, what a camera can see is in the scene')
        async def sweep(js, frames, what, cond='true'):
            await gm.evaluate(WATCH)
            await gm.evaluate(f"new Promise(res => {{ let i = 0; const N = {frames}; const step = () => {{ const g = tw.main.grab, t = i / N; {js}; g.update(); if (++i <= N) requestAnimationFrame(step); else requestAnimationFrame(() => requestAnimationFrame(res)); }}; step(); }})")
            r = await gm.evaluate(STOP)
            check(r['nbad'] == 0 and r['frames'] >= frames, what, f"{r['frames']} frames, asleep between {r['minAsleep']} and {r['maxAsleep']}" + (f", first: {r['bad'][0]}" if r['nbad'] else ''))
            return r
        await view(gm, cx('a'), 10, 70); await gm.wait_for_timeout(2400)
        r = await sweep(f"g.focus.x = {cx('a')} + t * {cx('f') - cx('a')}", 90, 'a pan the length of the map (750 ft in 90 frames)')
        check(r['maxAsleep'] >= 3, 'with rooms asleep at both ends of it', r['maxAsleep'])
        await gm.wait_for_timeout(2400)
        await sweep(f"g.focus.x = {cx('f')} - t * {cx('f') - cx('a')}", 12, 'the same pan back at 60 ft a frame')
        await gm.wait_for_timeout(2400)
        await sweep("g.yaw = t * 360", 120, 'a full turn')
        await sweep("g.pitch = 58 - t * 52", 60, 'a tilt down to the horizon (the view reaches the far end of the map)')
        await view(gm, cx('a'), 10, 70); await gm.wait_for_timeout(2400)
        r = await sweep("g.maxDist = 3000; g.dist = 70 + t * 1500", 60, 'a zoom out to the whole map')
        check(r['minAsleep'] == 0, 'zoomed out to the whole map, nothing is asleep', r['minAsleep'])
        await view(gm, cx('c'), 10, 60); await gm.wait_for_timeout(2400)
        await gm.evaluate(WATCH); await gm.evaluate("tw.goLevel(10)"); await gm.wait_for_timeout(700); await gm.evaluate("tw.goLevel(-10)"); await gm.wait_for_timeout(700); await gm.evaluate("tw.cutOff()"); await gm.wait_for_timeout(500)
        r = await gm.evaluate(STOP); check(r['nbad'] == 0, 'another level (up a storey, down to the cellars, back to all levels)', f"{r['frames']} frames")
        # the picture-in-picture is a camera too
        await view(gm, cx('a'), 10, 60); await gm.wait_for_timeout(2400)
        before = await gm.evaluate(f"{W}.unitAsleep('{R['f']}')")
        await gm.evaluate(WATCH); await gm.evaluate("tw.openPip(tw.area(), ['tok_sleeper01'])"); await gm.wait_for_timeout(1500)
        r = await gm.evaluate(STOP); pip = await gm.evaluate(f"({{ asleep: {W}.unitAsleep('{R['f']}'), pip: !!tw.pip }})")
        check(before and pip['pip'] and not pip['asleep'] and r['nbad'] == 0, 'a picture-in-picture following a far pawn keeps what IT sees awake', str(pip))
        # a pawn travelling there (another seat moves it; this one follows it in the PiP)
        await gm.evaluate(WATCH)
        for k in range(1, 9): await gm.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_sleeper01', x: {cx('f')} - {k} * {(cx('f') - cx('d')) / 8}, z: 12 }})"); await gm.wait_for_timeout(260)
        await gm.wait_for_timeout(900); r = await gm.evaluate(STOP)
        check(r['nbad'] == 0 and not await gm.evaluate(f"{W}.unitAsleep('{R['d']}')"), 'a pawn walking from one far building to another: where it arrives is awake before the PiP shows it', f"{r['frames']} frames")
        await gm.evaluate("tw.closePip()"); await gm.wait_for_timeout(2600)
        check(await gm.evaluate(f"{W}.unitAsleep('{R['f']}')"), 'with the PiP closed the far rooms sleep again')
        # an area picture frames everything
        shot = await gm.evaluate(f"(async () => {{ const b = await tw.thumbs.render(tw.area()); return {{ bytes: b ? b.size : 0, blank: tw.thumbs.lastRender?.blank, shell: tw.thumbs.lastShot?.shellShown, all: {W}.shell.size, asleepAfter: {W}.sleepStats().asleep.length }}; }})()")
        check(shot['bytes'] > 2000 and not shot['blank'] and shot['asleepAfter'] == 0, 'an area picture wakes what it frames (the whole area) before it is taken', str(shot))
        await gm.wait_for_timeout(2600)

        # ================= NEAR: selection, picks, pings =================
        print('NEAR: selection, clicks and pings across the edge')
        await view(gm, cx('a'), 10, 60); await gm.wait_for_timeout(2400)
        thing = await gm.evaluate(f"Object.values(tw.entities()).find(e => e.kind === 'object' && e.room === '{R['e']}' && !e.parent && e.place === 'floor')?.id")
        z0 = await gm.evaluate(f"{W}.unitAsleep('{R['e']}')")
        await gm.evaluate(f"tw.select('{thing}')"); await gm.wait_for_timeout(500)
        sel = await gm.evaluate(f"({{ asleep: {W}.unitAsleep('{R['e']}'), inScene: !!{W}.recs.get('{thing}').group.parent, signs: tw.signals().filter(s => s.id === '{thing}').length }})")
        check(z0 and not sel['asleep'] and sel['inScene'] and sel['signs'] == 1, 'selecting a thing in a sleeping room wakes the room and draws its sign', str(sel))
        await gm.evaluate(f"tw.select('{R['f']}')"); await gm.wait_for_timeout(500)
        check(not await gm.evaluate(f"{W}.unitAsleep('{R['f']}')") and await gm.evaluate(f"tw.signals().some(s => s.id === '{R['f']}')"), 'and so does selecting a far room itself')
        await gm.evaluate("tw.select([])"); await gm.wait_for_timeout(2600)
        check(await gm.evaluate(f"{W}.unitAsleep('{R['e']}') && {W}.unitAsleep('{R['f']}')"), 'deselected, they go back to sleep')
        ping = await gm.evaluate(f"(() => {{ const w = {W}; w.ping({cx('e')}, 10, '#ff0000', 0); return w.pings.length; }})()"); await gm.wait_for_timeout(200)
        check(ping >= 1 and await gm.evaluate(f"{W}.layers.deco.children.some(o => o.geometry?.type === 'RingGeometry')"), 'a ping in a sleeping room is drawn all the same (pings never sleep)')
        # a click on a thing in a room that has just woken
        e = await gm.evaluate(f"tw.entities()['{thing}']")
        await view(gm, e['x'], e['z'], 40, 70, ms=400)
        pt = await gm.evaluate(f"tw.screenOf({e['x']}, {e['z']}, tw.main, {(e.get('y') or 0) + (e.get('dims') or [0, 2, 0])[1] * 0.5})")
        await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(150); await gm.mouse.click(pt['x'], pt['y']); await gm.wait_for_timeout(400)
        picked = await gm.evaluate("[...tw.sel]")
        check(len(picked) == 1 and await gm.evaluate(f"(() => {{ const e = tw.entities()['{picked[0] if picked else ''}']; return !!e && (e.room === '{R['e']}' || e.id === '{R['e']}'); }})()"), 'a click picks a thing in the room that has just woken', str(picked))
        await gm.evaluate("tw.select([])")

        # ================= light slots (switched off by default: not ready, see world.js PERF) =================
        print('SLOTS: (off by default) with light slots on, far fires go dark and the light count stays on its rung')
        CNT = f"(() => {{ const w = {W}; let n = 0, dark = 0; w.scene.traverse(o => {{ if (o.isPointLight && o.visible) {{ n++; if (o.userData.dummy) dark++; }} }}); const s = w.fx.stats(); return {{ n, dark, shining: s.lights_shining, slots: s.light_slots, asleep: w.sleepStats().asleep.length }}; }})()"
        check(await gm.evaluate("tw.perf.get().lightSlots === false"), 'off by default')
        await view(gm, cx('a'), 10, 60); await gm.wait_for_timeout(2600); l0 = await gm.evaluate(CNT)
        await gm.evaluate("tw.perf.set({ lightSlots: true })"); await gm.wait_for_timeout(600); l1 = await gm.evaluate(CNT)
        check(l1['asleep'] >= 4 and l1['shining'] < l0['n'] and l1['n'] == l1['slots'] and l1['slots'] in (4, 8, 16, 24, 32) and l1['dark'] == l1['n'] - l1['shining'], 'on: only the fires of waking rooms shine; dark stand-ins fill the count up to a rung of the ladder', f"{l0['n']} lights before; {l1['shining']} shining + {l1['dark']} dark = {l1['n']}")
        await view(gm, cx('e'), 10, 60); await gm.wait_for_timeout(700); l2 = await gm.evaluate(CNT)
        check(l2['n'] == l1['n'] and l2['shining'] >= 1, 'a jump to another building: other fires shine, the count has not moved (no shader is compiled again)', f"{l2['shining']} shining, {l2['n']} in all")
        await gm.evaluate("tw.perf.set({ lightSlots: false })"); await gm.wait_for_timeout(500); l3 = await gm.evaluate(CNT)
        check(l3['dark'] == 0 and l3['n'] == l0['n'], 'off again: every fire\'s light is on, as before', str(l3))

        check(not errors, 'no page errors', str(errors[:3]))
        await browser.close()

try: asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
    import shutil
    for d in tmp: shutil.rmtree(d, ignore_errors=True)
bad = [r for r in results if not r[0]]
print(f"\n{len(results) - len(bad)}/{len(results)} passed" + (f"; FAILED: {[b[1] for b in bad]}" if bad else ''))
sys.exit(1 if bad else 0)
