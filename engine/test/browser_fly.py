#!/usr/bin/env python3
"""Levels above the cut fly away (Harry 2026-10-06; docs/UI.md "Levels fly away", docs/VERTICAL.md). GM tab only.

  local:  TW_GPU=1 python3 engine/test/browser_fly.py --local
  perf:   ... browser_fly.py --local --perf     (1920x1080, full look, uncapped: frame time while levels leave and return)

A two-storey inn with a cellar (the cut suite's). The look under test is the tuner's runner (fx/cutfly.js) with the house
preset; the tests slow it down (a long preset) where they need to look at a flight in the middle.
  LEAVE     the cut drops: the upper storey's pieces are hidden AT ONCE (as before) and their carriers leave staggered,
            rising; all gone within the preset's total time
  RETURN    the cut rises: shown at once, the carriers come down from above and hand the pieces back at rest
  RETARGET  a second change mid-flight turns the pieces round where they are (no jump)
  HANDS OFF nothing in flight is pickable or selectable; the touchable audit holds mid-flight; lamps of a leaving
            level are out from the first frame
  ROOFS     roofs on / off use the same move
  INSTANT   reduced motion, Settings > Me > "Levels fly away" off, the preset off, an area picture: no flight at all
  IDLE      with nothing in flight the runner does not step
"""
import argparse, asyncio, json, os, random, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from audit import AUDIT  # noqa: E402
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--perf', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18133, 18763
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-fly-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if full else '&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=110, pitch=58, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")

SPAWN = """(a) => { const v = tw.sync.view(tw.area()); const b = tw.buildingFor(a.x, a.z, a.w, a.d, a.y || 0);
  const L = tw.roomgen.solve(v.entities, { ...a, building: b.building }, v.order + 1);
  tw.batch([{ type: 'room.spawn', args: { ...a, ...b, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]); return a.id; }"""
# the cut, who wrote it last, and what is drawn
STATE = "(() => ({ cut: tw.cut.y, pinned: tw.cut.pinned, writes: tw.cutLog.length, last: tw.cutLog.at(-1)?.by || null, level: tw.level }))()"
REPORT = "(() => { const w = tw.worldOf(tw.area()), r = w.cutReport(); const shown = (id) => !!r.rooms[id] && r.rooms[id].shown > 0 && r.rooms[id].hidden === 0, gone = (id) => !!r.rooms[id] && r.rooms[id].shown === 0; return { cut: r.cut, shown: Object.keys(r.rooms).filter(shown), gone: Object.keys(r.rooms).filter(gone), mixed: Object.keys(r.rooms).filter(id => !shown(id) && !gone(id)), thingsHidden: r.things.hidden, groundOpen: r.groundOpen, lit: r.lit, covered: r.covered }; })()"
# every grid point's pick: does anything a click would select, or the floor it would land on, sit on a level the cut hides?
PICKS = """(() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(), bad = []; let n = 0, hit = 0;
  for (let i = 0; i < 64; i++) for (let j = 0; j < 40; j++) { const x = c.left + (i + 0.5) * c.width / 64, y = c.top + (j + 0.5) * c.height / 40, ray = tw.rayAt(x, y); n++;
    for (const h of w.pickAll(ray)) { hit++; const e = h.wall ? tw.ent('wall:' + h.wall) : h.entity; if (e && tw.cutHides(e)) bad.push([Math.round(x), Math.round(y), e.id || h.wall]); }
    const g = tw.groundAt(x, y); if (g && g.room && g.y > (tw.cut.y ?? Infinity)) bad.push([Math.round(x), Math.round(y), 'floor@' + g.y]); } // (a room's floor above the cut; the open ground itself stays the ground)
  return { n, hit, nbad: bad.length, bad: bad.slice(0, 5) }; })()"""


FLY = "tw.worldOf(tw.area()).cutFly"
ST = "(() => { const w = tw.worldOf(tw.area()), s = w.cutFly.stats(); return { carriers: s.carriers, active: s.fly_active || 0, steps: s.fly_steps || 0, launched: s.fly_launched || 0, turned: s.fly_turned || 0, ended: s.fly_ended || 0, batches: s.fly_batches || 0, last: s.fly_last, total: s.fly_total_ms, back: s.fly_back_ms, enabled: s.enabled, ys: w.cutFly.layer.children.map(c => +c.position.y.toFixed(2)), kids: w.cutFly.layer.children.reduce((n, c) => n + c.children.length, 0) }; })()"
SLOW = "(() => { const fx = tw.worldOf(tw.area()).fx; fx.setParams('cutfly', { name: 'fly-test-slow', on: true, time: { dur: 1500, stagger: 1500, back: 1 }, order: { by: 'click', jitter: 0.25 }, move: { rise: 70, ease: 'inCubic', fade: false, fadeFrom: 0.55 } }); })()"
QUICK = "(() => { const fx = tw.worldOf(tw.area()).fx; fx.setParams('cutfly', { name: 'fly-quick' }); return fx.params('cutfly'); })()"
# where every piece of the upper rooms rests: empty groups while their children are being carried
UPPER = """((ids) => { const w = tw.worldOf(tw.area()); const gs = [...w.shell.values()].filter(s => ids.includes(s.roomId)).map(s => s.group).concat([...w.recs.values()].filter(r => r.entity.kind === 'object' && ids.includes(r.entity.room)).map(r => r.group));
  return { n: gs.length, visible: gs.filter(g => g.visible).length, withKids: gs.filter(g => g.children.length > 0).length, flagged: gs.filter(g => g.userData.cutHidden).length }; })"""

async def main():
    perf = A.perf
    page = start_local(perf) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', *(['--disable-gpu-vsync', '--disable-frame-rate-limit'] if perf else [])])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1920, 'height': 1080} if perf else {'width': 1400, 'height': 900})
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); await gm.goto(page)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST nits fly {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')
        R = {}
        for (name, a) in (('common', dict(type='common', x=0, z=0, w=6, d=4, seed=5101)), ('kitchen', dict(type='kitchen', x=6, z=0, w=4, d=4, seed=5102)),
                          ('up1', dict(type='guest', x=0, z=0, w=4, d=4, y=10, seed=5103)), ('up2', dict(type='guest', x=4, z=0, w=4, d=4, y=10, seed=5104)),
                          ('cellar', dict(type='cellar', x=0, z=0, w=4, d=4, y=-10, seed=5105))):
            rid = f"room_fly{name}{random.randrange(10**6):06d}"[:24]
            R[name] = await gm.evaluate(SPAWN, {'id': rid, **a})
            check(await wait(gm, f"tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", 30000, name), f'{name} built')
        await settle(gm); await view(gm, 25, 10, 95, 60); await gm.wait_for_timeout(2500 if perf else 1200)
        UP = json.dumps([R['up1'], R['up2']])
        await gm.evaluate("tw.thumbs && (tw.thumbs.debounce = 1e9)")  # no area picture in the middle of a test (a picture lands every flight at once: tested below)
        has = await gm.evaluate(f"!!{FLY} && !!tw.worldOf(tw.area()).fx?.cutfly")
        check(has, 'the game has the fly-away and the tuner\'s runner (world.fx.cutfly)')
        if not has: await browser.close(); return
        if perf: return await perf_run(gm, browser)
        P0 = await gm.evaluate("tw.worldOf(tw.area()).fx.params('cutfly')")
        check(P0['time']['dur'] + P0['time']['stagger'] <= 500 and P0['on'], 'the house / default look is very short: the last piece is gone within half a second', f"{P0['name']}: {P0['time']}")

        # ================= IDLE =================
        print('IDLE: nothing in flight, nothing done')
        s0 = await gm.evaluate(ST); await gm.wait_for_timeout(600); s1 = await gm.evaluate(ST)
        check(s0['carriers'] == 0 and s1['steps'] == s0['steps'] and s1['enabled'], 'with nothing in flight the runner does not step (600 ms of frames, the step count did not move)', f"{s0['steps']} -> {s1['steps']}")

        # ================= LEAVE =================
        print('LEAVE: the cut drops')
        up0 = await gm.evaluate(f"{UPPER}({UP})")
        lit0 = await gm.evaluate("tw.worldOf(tw.area()).litCount()")
        # the default look, timed: hidden at once, flown and gone within its total
        t = await gm.evaluate(f"""(async () => {{ const w = tw.worldOf(tw.area()), t0 = performance.now(); tw.goLevel(0, 'test'); w.cutPass();
          const at0 = {UPPER}({UP}), s0 = {ST}, lit = w.litCount(); let gone = null, maxY = 0, frames = 0, t1 = null, slow = 0, last = t0;
          while (performance.now() - t0 < 4000) {{ await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); if (t1 == null) t1 = n; else slow = Math.max(slow, n - last); last = n; frames++; const s = {ST}; maxY = Math.max(maxY, ...s.ys, 0); if (!s.carriers) {{ gone = n - t1; break; }} }}
          return {{ at0, s0, lit, gone, slow, maxY, frames, after: {UPPER}({UP}), s1: {ST} }}; }})()""")
        check(t['at0']['visible'] == 0 and t['at0']['flagged'] == up0['n'] and t['at0']['withKids'] == 0, 'in the very frame the cut drops every upper piece is hidden and flagged, as before: the real pieces are empty, their drawn parts are with the carriers', str(t['at0']))
        check(t['s0']['carriers'] >= up0['withKids'] * 0.9 and t['s0']['kids'] >= up0['withKids'] and t['s0']['last']['dir'] == 1, 'one carrier per piece that was being drawn', f"{t['s0']['carriers']} carriers for {up0['withKids']} drawn pieces")
        check(t['lit'] < lit0, 'the lamps of the leaving level are out from the first frame', f"{lit0} -> {t['lit']}")
        check(t['gone'] is not None and t['gone'] <= t['s0']['total'] + 2 * t['slow'] + 40 and t['frames'] > 3, 'every piece is gone within the look\'s total time', f"{t['gone'] and round(t['gone'])} ms of {round(t['s0']['total'])} ms (from the first frame drawn), {t['frames']} frames, slowest {round(t['slow'])} ms")
        check(t['maxY'] > 30, 'they rose (the highest carrier seen was well above the storey)', f"{t['maxY']:.0f} ft")
        check(t['after']['withKids'] == up0['withKids'] and t['after']['visible'] == 0 and t['s1']['carriers'] == 0 and t['s1']['kids'] == 0, 'when they are gone the drawn parts are back in their (hidden) pieces and no carrier is left', str(t['after']))
        s_a = await gm.evaluate(ST); await gm.wait_for_timeout(400); s_b = await gm.evaluate(ST)
        check(s_b['steps'] == s_a['steps'], 'and the runner is idle again')

        # staggered, seen slowly: pieces start at different times, outward from the click
        await gm.evaluate(SLOW); await gm.evaluate("tw.cutOff('test')"); await gm.wait_for_timeout(120); ok_ = await wait(gm, f"{FLY}.stats().carriers === 0", 6000, 'return'); await gm.wait_for_timeout(200)
        s = await scr(gm, 7.5, 12.5, 10); await gm.mouse.dblclick(s['x'], s['y']); await gm.wait_for_timeout(250)   # into an upper room: nothing to hide
        s = await scr(gm, 40, 10, 0.1); await gm.mouse.move(s['x'], s['y']); await gm.mouse.down(); await gm.mouse.up(); await gm.evaluate("tw.goLevel(0, 'dblclick')")
        await gm.wait_for_timeout(800); mid = await gm.evaluate("(() => { const s = " + ST + "; const fx = tw.worldOf(tw.area()).fx, p = fx.params('cutfly'); p.time.dur = 600000; fx.setParams('cutfly', p); return s; })()")  # read it, then all but freeze it to look at
        os.makedirs(SHOTS, exist_ok=True); await gm.screenshot(path=os.path.join(SHOTS, 'fly-mid.png'))  # (for a blind read)
        moving = [y for y in mid['ys'] if y > 10.6]; waiting = [y for y in mid['ys'] if y <= 10.6]
        check(len(moving) > 3 and len(waiting) > 3 and mid['carriers'] > 0, 'NOT all at once: part-way through, some pieces are on their way up and some have not left yet', f"{len(moving)} moving, {len(waiting)} waiting")
        far = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), o = [40, 10], cs = w.cutFly.layer.children.map(c => [Math.hypot(c.position.x - o[0], c.position.z - o[1]), c.position.y]); cs.sort((a, b) => a[0] - b[0]); const h = cs.length >> 1, avg = (a) => a.reduce((s, c) => s + c[1], 0) / a.length; return {{ near: avg(cs.slice(0, h)), far: avg(cs.slice(h)) }}; }})()""")
        check(far['near'] > far['far'] + 1, 'the pieces nearest the press are ahead of the far ones (order: outward from the click)', f"near half at {far['near']:.1f} ft, far half at {far['far']:.1f} ft")

        # ================= HANDS OFF (mid-flight) =================
        print('HANDS OFF: nothing in flight can be touched')
        picks = await gm.evaluate(PICKS); au = await gm.evaluate(AUDIT)
        check(picks['nbad'] == 0 and picks['hit'] > 100, 'mid-flight, a dense grid of picks reaches nothing on the leaving level', f"{picks['hit']} hits, {picks['nbad']} bad {picks['bad']}")
        check(au['tested'] > 100 and au['nbad'] == 0, 'mid-flight, everything that is drawn and pickable is still touchable (the audit)', f"{au['tested']} points, {au['nbad']} bad")
        ray = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(); let fly = 0, picked = 0;
          for (let i = 0; i < 48; i++) for (let j = 0; j < 30; j++) {{ const ray = tw.rayAt(c.left + (i + 0.5) * c.width / 48, c.top + (j + 0.5) * c.height / 30); const h = ray.intersectObject(w.cutFly.layer, true)[0]; if (!h) continue; fly++;
            if (w.pickAll(ray).some(x => {{ const e = x.wall ? tw.ent('wall:' + x.wall) : x.entity; return e && tw.cutHides(e); }})) picked++; }}
          return {{ fly, picked }}; }})()""")
        check(ray['fly'] > 5 and ray['picked'] == 0, 'rays that DO meet a flying piece pick nothing of it', str(ray))
        stair = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && ['{R['up1']}', '{R['up2']}'].includes(e.room)).map(e => e.id)")
        await gm.evaluate(f"tw.select({json.dumps(stair[:6])}); tw.select('{R['up1']}', 'add')")
        check(await gm.evaluate("tw.sel.size") == 0, 'and nothing of the leaving level can be selected by id either')

        # ================= RETARGET =================
        print('RETARGET: a second change mid-flight')
        before = await gm.evaluate(ST)
        if os.environ.get('FLY_DEBUG'): print('   dbg', {k: before[k] for k in ('carriers','active','turned','ended','launched','last')}, await gm.evaluate("JSON.stringify(tw.worldOf(tw.area()).fx.params('cutfly').time)"), await gm.evaluate(STATE))
        j = await gm.evaluate(f"""(async () => {{ const w = tw.worldOf(tw.area()), ys0 = new Map(w.cutFly.layer.children.map(c => [c.userData.key, c.position.y]));
          tw.cutOff('test'); w.cutPass(); const s1 = {ST}; let jump = 0; for (const c of w.cutFly.layer.children) if (ys0.has(c.userData.key)) jump = Math.max(jump, Math.abs(c.position.y - ys0.get(c.userData.key)));
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); await new Promise(r => setTimeout(r, 400));
          let down = 0, n = 0; for (const c of w.cutFly.layer.children) if (ys0.has(c.userData.key) && ys0.get(c.userData.key) > 11) {{ n++; if (c.position.y < ys0.get(c.userData.key)) down++; }}
          return {{ jump, down, n, s1, up: {UPPER}({UP}) }}; }})()""")
        if os.environ.get('FLY_DEBUG'): print('   dbg', {k: j['s1'][k] for k in ('carriers','active','turned','ended','launched','last')}, j['up'])
        check(j['jump'] < 0.01 and j['s1']['turned'] > before['turned'], 'the cut lifts off mid-flight: every piece in the air turns round WHERE IT IS (no jump)', f"largest jump {j['jump']:.3f} ft, {j['s1']['turned'] - before['turned']} turned")
        check(j['n'] > 0 and j['down'] == j['n'], 'and is on its way back down a moment later', f"{j['down']} of {j['n']}")
        check(j['up']['visible'] == up0['n'] and j['up']['flagged'] == 0, 'the level counts as shown again at once', str(j['up']))
        await gm.evaluate(SLOW)
        again = await gm.evaluate(f"""(async () => {{ const w = tw.worldOf(tw.area()); tw.goLevel(0, 'test'); w.cutPass(); const a = {ST}; tw.cutOff('test'); w.cutPass(); tw.goLevel(0, 'test'); w.cutPass(); tw.cutOff('test'); w.cutPass(); return {{ a, b: {ST} }}; }})()""")
        await gm.wait_for_timeout(120); ok = await wait(gm, f"{FLY}.stats().carriers === 0", 8000, 'landing')
        up = await gm.evaluate(f"{UPPER}({UP})")
        check(ok and up['visible'] == up0['n'] and up['withKids'] == up0['withKids'], 'four changes in one frame, then left alone: every piece lands, whole, at rest', str(up))
        rest = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()); return [...w.shell.values()].filter(s => {UP}.includes(s.roomId)).every(s => Math.abs(s.group.position.y - (s.spec.y || 0)) < 1e-6) && w.cutFly.layer.children.length === 0; }})()""")
        check(rest, 'no piece was moved: the real pieces never left their places, and the carrier layer is empty')

        # ================= RETURN =================
        print('RETURN: the cut rises')
        await gm.evaluate(QUICK)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(120); ok_ = await wait(gm, f"{FLY}.stats().carriers === 0", 4000); await gm.wait_for_timeout(150)
        t = await gm.evaluate(f"""(async () => {{ const w = tw.worldOf(tw.area()), t0 = performance.now(); tw.cutOff('test'); w.cutPass();
          const at0 = {UPPER}({UP}), s0 = {ST}; let done = null, lastMax = Infinity, falling = true, t1 = null, slow = 0, last = t0;
          while (performance.now() - t0 < 4000) {{ await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); if (t1 == null) t1 = n; else slow = Math.max(slow, n - last); last = n; const s = {ST}; if (!s.carriers) {{ done = n - t1; break; }} const m = Math.max(...s.ys); if (m > lastMax + 1e-6) falling = false; lastMax = m; }}
          return {{ at0, s0, done, slow, falling, after: {UPPER}({UP}) }}; }})()""")
        check(t['at0']['visible'] == up0['n'] and t['at0']['withKids'] == 0 and min(t['s0']['ys']) > 20 and t['s0']['last']['dir'] == -1, 'the cut rises: the level is shown at once, and its drawn parts start high above, coming down', f"lowest carrier {min(t['s0']['ys']):.0f} ft")
        check(t['done'] is not None and t['done'] <= t['s0']['back'] + 2 * t['slow'] + 40 and t['falling'] and t['after']['withKids'] == up0['withKids'], 'they come down (never up) and are home within the look\'s time', f"{t['done'] and round(t['done'])} ms of {round(t['s0']['back'])} ms")
        au = await gm.evaluate(AUDIT)
        check(au['tested'] > 100 and au['nbad'] == 0, 'landed: the touchable audit holds', f"{au['tested']} points, {au['nbad']} bad")

        # ================= ROOFS =================
        print('ROOFS: on and off use the same move')
        await gm.evaluate(SLOW)
        await gm.evaluate("tw.setRoofs(true, 'test')"); await gm.wait_for_timeout(200)
        r1 = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), s = {ST}; return {{ roofs: w.roofRecs.size, shown: [...w.roofRecs.values()].filter(r => r.group.visible).length, carriers: s.carriers, ys: s.ys, dir: s.last?.dir }}; }})()")
        check(r1['roofs'] > 0 and r1['shown'] == r1['roofs'] and r1['carriers'] >= r1['roofs'] and r1['dir'] == -1 and max(r1['ys']) > 30, 'roofs on: the roofs count as shown at once and come down from above', str({k: r1[k] for k in ('roofs', 'shown', 'carriers', 'dir')}))
        roofpick = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()), c = document.getElementById('c').getBoundingClientRect(); let n = 0; for (let i = 0; i < 30; i++) for (let j = 0; j < 20; j++) if (w.roofAt(tw.rayAt(c.left + (i + 0.5) * c.width / 30, c.top + (j + 0.5) * c.height / 20))) n++; return n; })()")
        check(roofpick == 0, 'a roof on its way down cannot be clicked', roofpick)
        await gm.wait_for_timeout(120); ok = await wait(gm, f"{FLY}.stats().carriers === 0", 8000, 'roofs landing'); await gm.wait_for_timeout(150)
        landed = await gm.evaluate("(() => { const w = tw.worldOf(tw.area()); return [...w.roofRecs.values()].every(r => r.group.visible && r.group.children.length > 0); })()")
        check(ok and landed, 'and land whole')
        await gm.evaluate("tw.setRoofs(false, 'test')"); await gm.wait_for_timeout(150)
        r2 = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()), s = {ST}; return {{ roofs: w.roofRecs.size, carriers: s.carriers, dir: s.last?.dir, picks: !!w.roofsOn }}; }})()")
        check(r2['roofs'] == 0 and r2['carriers'] > 0 and r2['dir'] == 1 and not r2['picks'], 'roofs off: the roofs are gone from the world at once, and their drawn parts fly off', str(r2))
        await gm.wait_for_timeout(120); ok = await wait(gm, f"{FLY}.stats().carriers === 0", 8000, 'roofs leaving')
        check(ok and await gm.evaluate(f"{FLY}.layer.children.length") == 0, 'and nothing is left behind')
        # the cut dropping under a roof that is showing: the roof goes with the level
        await gm.evaluate(QUICK); await gm.evaluate("tw.setRoofs(true, 'test')"); await gm.wait_for_timeout(120); ok_ = await wait(gm, f"{FLY}.stats().carriers === 0", 4000); await gm.wait_for_timeout(200)
        await gm.evaluate(SLOW); await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(120)
        r3 = await gm.evaluate(f"(() => {{ const w = tw.worldOf(tw.area()); return {{ shown: [...w.roofRecs.values()].filter(r => r.group.visible).length, carried: [...w.roofRecs.values()].filter(r => r.group.children.length === 0).length, carriers: {ST}.carriers }}; }})()")
        check(r3['shown'] == 0 and r3['carried'] > 0, 'cutting to lv 1 with roofs on: the roofs leave with the storey', str(r3))
        await gm.evaluate(QUICK); await gm.evaluate("tw.setRoofs(false, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(120); ok_ = await wait(gm, f"{FLY}.stats().carriers === 0", 6000); await gm.wait_for_timeout(300)

        # ================= INSTANT =================
        print('INSTANT: reduced motion, the Me switch, the preset off, an area picture')
        async def instant(name):
            r = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), b0 = {ST}.batches; tw.goLevel(0, 'test'); w.cutPass(); const a = {UPPER}({UP}), s = {ST}; tw.cutOff('test'); w.cutPass(); const b = {UPPER}({UP}), s2 = {ST};
              return {{ a, b, carriers: s.carriers + s2.carriers, batches: s2.batches - b0, enabled: s.enabled }}; }})()""")
            check(r['carriers'] == 0 and r['batches'] == 0 and r['a']['visible'] == 0 and r['a']['withKids'] == up0['withKids'] and r['b']['visible'] == up0['n'], f'{name}: the level vanishes and comes back at once, as before (no flight)', str({k: r[k] for k in ('carriers', 'batches', 'enabled')}))
        await gm.evaluate("tw.settings.setPref ? tw.settings.setPref('cutFly', false) : null")
        if not await gm.evaluate("document.documentElement.classList.contains('no-cutfly')"):  # through the window itself
            await gm.keyboard.press('s'); await gm.wait_for_timeout(400); await gm.keyboard.press('m'); await gm.wait_for_timeout(400)
            tog = await gm.query_selector('[data-pref="cutFly"]')
            check(tog is not None, 'Settings > Me has a "Levels fly away" switch')
            if tog: await tog.click(); await gm.wait_for_timeout(200)
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        check(await gm.evaluate("document.documentElement.classList.contains('no-cutfly') && tw.prefs.cutFly === false"), 'switching it off is remembered as a personal preference (tw.prefs.cutFly)')
        await instant('Settings > Me > Levels fly away off')
        await gm.keyboard.press('s'); await gm.wait_for_timeout(400); await gm.keyboard.press('m'); await gm.wait_for_timeout(400)
        tog = await gm.query_selector('[data-pref="cutFly"]'); await tog.click(); await gm.wait_for_timeout(200); await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
        check(await gm.evaluate(f"{FLY}.enabled() && tw.prefs.cutFly === true"), 'and on again')
        await gm.evaluate("document.documentElement.classList.add('reduce-motion')"); await instant('Reduce motion (Settings > Me)'); await gm.evaluate("document.documentElement.classList.remove('reduce-motion')")
        await gm.emulate_media(reduced_motion='reduce'); await gm.wait_for_timeout(100); await instant('the browser asks for reduced motion'); await gm.emulate_media(reduced_motion='no-preference'); await gm.wait_for_timeout(100)
        await gm.evaluate("(() => { const fx = tw.worldOf(tw.area()).fx, p = fx.params('cutfly'); p.on = false; fx.setParams('cutfly', p); })()"); await instant('the look switched off in the preset'); await gm.evaluate(QUICK)
        pic = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()); tw.goLevel(0, 'test'); w.cutFly.flush(); w.cutPass(); const b0 = {ST}.batches; w.liftCut(); const a = {UPPER}({UP}), s = {ST}; w.dropLift(); const b = {UPPER}({UP}), s2 = {ST}; tw.cutOff('test');
          return {{ a, b, carriers: s.carriers + s2.carriers, batches: s2.batches - b0 }}; }})()""")
        check(pic['carriers'] == 0 and pic['batches'] == 0 and pic['a']['visible'] == up0['n'] and pic['a']['withKids'] == up0['withKids'] and pic['b']['visible'] == 0, 'an area picture (the cut lifted for one frame and put back) shows every level whole, at rest, with no flight', str({k: pic[k] for k in ('carriers', 'batches')}))
        await gm.wait_for_timeout(120); ok_ = await wait(gm, f"{FLY}.stats().carriers === 0", 4000); await gm.wait_for_timeout(300)

        # ================= IDLE again, and the world unchanged =================
        s0 = await gm.evaluate(ST); await gm.wait_for_timeout(500); s1 = await gm.evaluate(ST); up = await gm.evaluate(f"{UPPER}({UP})")
        check(s1['steps'] == s0['steps'] and s1['carriers'] == 0 and up['visible'] == up0['n'] and up['withKids'] == up0['withKids'], 'after all of it: idle, every upper piece drawn and whole', f"{up} vs {up0}")
        real = [e for e in errors if 'WebSocket' not in e]
        check(not real, 'no page errors', '; '.join(real[:4]))
        await browser.close()

async def perf_run(gm, browser):
    """frame time while the upper storey leaves and returns, against the same frames with nothing moving (uncapped)"""
    MEASURE = """async (ms) => { const dts = []; let last = performance.now(); const t0 = last; while (performance.now() - t0 < ms) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); dts.push(n - last); last = n; } return dts; }"""
    def stat(d): d = sorted(d); return {'top3': [round(x, 1) for x in d[-3:]], 'n': len(d), 'median': round(statistics.median(d), 2), 'mean': round(statistics.mean(d), 2), 'p95': round(d[int(len(d) * 0.95) - 1], 2), 'worst': round(d[-1], 2)}
    import statistics
    out = {'load': os.getloadavg()[0]}
    for preset in ('off', 'quick', 'showy'):
        await gm.evaluate(f"document.documentElement.classList.toggle('no-cutfly', {json.dumps(preset == 'off')})")
        PRE = {'off': {'name': 'fly-quick'}, 'quick': {'name': 'fly-quick'}, 'showy': {'name': 'fly-showy', 'on': True, 'time': {'dur': 520, 'stagger': 900, 'back': 1.2}, 'order': {'by': 'room', 'jitter': 0.15}, 'move': {'rise': 90, 'ease': 'inOutCubic', 'fade': True, 'fadeFrom': 0.55}}}
        await gm.evaluate(f"tw.worldOf(tw.area()).fx.setParams('cutfly', {json.dumps(PRE[preset])})")
        P = await gm.evaluate("tw.worldOf(tw.area()).fx.params('cutfly')"); total = P['time']['dur'] + P['time']['stagger']
        await gm.evaluate("tw.cutOff('perf')"); await gm.wait_for_timeout(1500)
        idle_all = stat(await gm.evaluate(MEASURE, 3000))
        leave, back = [], []
        for _ in range(8):
            await gm.evaluate("tw.goLevel(0, 'perf')"); leave += await gm.evaluate(MEASURE, total + 60); await gm.wait_for_timeout(700)
            await gm.evaluate("tw.cutOff('perf')"); back += await gm.evaluate(MEASURE, total + 60); await gm.wait_for_timeout(700)
        await gm.evaluate("tw.goLevel(0, 'perf')"); await gm.wait_for_timeout(1500); idle_lv1 = stat(await gm.evaluate(MEASURE, 3000)); await gm.evaluate("tw.cutOff('perf')")
        out[preset] = {'name': P['name'], 'total_ms': total, 'idle_all_levels': idle_all, 'idle_lv1': idle_lv1, 'leaving': stat(leave), 'returning': stat(back)}
    out['load_after'] = os.getloadavg()[0]
    for k, v in out.items():
        if isinstance(v, dict): print(f"{k:6} total {v['total_ms']:5} ms | " + ' | '.join(f"{n} med {v[n]['median']:5} mean {v[n]['mean']:5} p95 {v[n]['p95']:5} worst3 {v[n]['top3']} (n {v[n]['n']})" for n in ('idle_all_levels', 'idle_lv1', 'leaving', 'returning')))
    print('load', out['load'], '->', out['load_after']); await browser.close()

if __name__ == '__main__':
    try: asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
    ok = sum(1 for r in results if r[0]); print(f"\nfly: {ok}/{len(results)} passed")
    sys.exit(0 if ok == len(results) else 1)
