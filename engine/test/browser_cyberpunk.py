#!/usr/bin/env python3
"""THE CYBERPUNK PACK in the real engine (2026-11-07, wave 2; experiments/2026-11-07-cyberpunk-rooms/). A GM tab.

  TW_PORTS=a,b python3 engine/test/browser_cyberpunk.py --local [--stills DIR] [--only ...]

  ROOFTOP  a Rooftop laid at 10 ft over an Office floor: the office gets no roof of its own (the rooftop covers it:
           world.js roofInputs), the rooftop's things stand at 10 ft, its parapet runs round its edge
  GLASS    a Corporate lobby's glass front (edge.panel wall-glass-curtain) in the game's own wall map: from a spot on the
           pavement outside, a spot inside is in sight (client/vision.js), but feet stop at the glass (the movement
           rings' walls); through a plain wall of the same lobby nothing is seen
  LOCKUP   a Gang hideout's chain-link lock-up: seen through, it stops feet
  CEILING  an Office floor's fluorescent fittings: from the table their meshes are not drawn, but they are lit
  BUILDINGS (2026-11-07, Harry: "types should be kinds of *building* not kinds of sub-genre"; "we basically don't need to
           distinguish between cyberpunk and modern now"): the Build tray's Modern genre, opened with the real keys, lists
           the buildings of engine/tools/modern_buildings.json and no City or Cyberpunk; a building lists its rooms (hub
           first); a dragged-out building (app.buildAt) is made of its own rooms; an old saved building's code (MOD) still
           re-rolls (as the map's `legacy` building); ?pack=cyberpunk/cyb-clinic still opens the clinic. Stills: --stills
"""
import argparse, asyncio, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')
tw_sandbox.remove_campaigns()
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--stills'); ap.add_argument('--headed', action='store_true')
ap.add_argument('--only', default='rooftop,glass,lockup,ceiling,buildings'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--probe', action='store_true')
A = ap.parse_args(); ONLY = set(A.only.split(','))
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19661,19662').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-cyb-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def idle(pg): await wait(pg, "tw.sync.pendingCount() === 0", 30000, 'commands settled'); await pg.wait_for_timeout(300)
async def settle(pg, ms=120000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over'); await pg.wait_for_timeout(400)
async def view(pg, x, z, dist=80, pitch=60, yaw=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"); await pg.wait_for_timeout(250)
async def still(pg, name):
    if not A.stills: return
    os.makedirs(A.stills, exist_ok=True); await pg.wait_for_timeout(900); await pg.screenshot(path=os.path.join(A.stills, f'{name}.png'))
TOK = "((id) => { const e = tw.entities()[id]; return e ? { x: e.x, y: e.y || 0, z: e.z, rot: e.rot || 0 } : null; })"
POSE = "(() => { const v = tw.main, c = v.camera; return { pose: v.pose(), rule: v.rule, fov: c.fov, near: c.near, far: c.far, pos: c.position.toArray(), cut: tw.cut?.y ?? null, roofs: !!tw.roofs, sel: [...tw.sel] }; })()"

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1400, 'height': 900}, device_scale_factor=1)
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page, timeout=180000, wait_until='domcontentloaded')
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST cyberpunk {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        V = "(await import('/engine/client/vision.js'))"
        objs = lambda rid: f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}')"

        if 'rooftop' in ONLY:
            print('ROOFTOP: a rooftop at 10 ft over an office floor')
            O = await gm.evaluate("tw.spawnRoom('mod-office', 0, 0, 6, 5, 4101)"); await idle(gm)
            R = await gm.evaluate("tw.spawnRoom('cyb-rooftop', 0, 0, 6, 5, 4102, undefined, 10)"); await idle(gm)
            await gm.evaluate("tw.registry.run('view.roofsOn')"); await gm.wait_for_timeout(1500); await view(gm, 15, 12, 70, 55); await settle(gm)
            plan = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), P = w.roofPlan; return P ? P.roofs.map(r => ({{ room: r.room?.id ?? r.room, props: (r.props || []).length }})) : null; }})()""")
            check(plan is not None and not [r for r in plan if r['room'] == O], 'the office under the rooftop has no roof of its own', plan)
            ys = await gm.evaluate(f"{objs(R)}.map(e => +(e.y || 0).toFixed(2))")
            check(ys and min(ys) >= 9.9, "the rooftop's things stand at 10 ft", sorted(set(ys))[:6])
            cats = await gm.evaluate(f"{objs(R)}.map(e => e.cat)")
            check('parapet-roof-low' in cats and ('roof-access-hut' in cats or 'water-tank-roof' in cats), 'its parapet, and the stair hut or the water tank', sorted(set(cats)))
            if A.stills: await still(gm, 'rooftop-over-office')
            for rid in (R, O): await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{rid}' }})"); await idle(gm)
            await gm.evaluate("tw.registry.run('view.roofsOff')"); await gm.wait_for_timeout(800) # (roofs back off: with them on a roofed room's inside is not drawn at all)

        if 'glass' in ONLY:
            print("GLASS: the corporate lobby's glass front: seen through, it stops feet")
            L = await gm.evaluate("tw.spawnRoom('cyb-lobby', 20, 0, 8, 6, 4201)"); await idle(gm); await settle(gm)
            res = await gm.evaluate(f"""(async () => {{ const M = {V}, w = tw.worldOf(tw.area()), E = tw.entities(), edges = [...w.edges.values()];
              const glass = edges.filter(e => e.kind === 'wall' && e.panel === 'wall-glass-curtain' && e.sides.some(s => s.room === '{L}'));
              const plain = edges.filter(e => e.kind === 'wall' && !e.panel && e.sides.length === 1 && e.sides[0].room === '{L}');
              if (!glass.length) return {{ glass: 0 }};
              const pts = (e) => {{ const x = e.gx * 5, z = e.gz * 5, sd = e.owner?.side || e.sides[0]?.side, out = sd === 'N' || sd === 'W' ? -1 : 1; return e.dir === 'h' ? [[x + 2.5, z + out * 3], [x + 2.5, z - out * 5]] : [[x + out * 3, z + 2.5], [x - out * 5, z + 2.5]]; }};
              const sight = M.blockingSegments(w.edges, E, 0), feet = M.blockingSegments(w.edges, E, 0, {{ walk: true }});
              const see = (e) => {{ const [o, i] = pts(e), P = M.visibilityPolygon(o, sight, {{ bounds: [-50, -50, 200, 200] }}); return M.pointInPolygon(i[0], i[1], P); }};
              const cross = (e) => {{ const [o, i] = pts(e); return feet.some(([x0, z0, x1, z1]) => {{ const d = (i[0] - o[0]) * (z1 - z0) - (i[1] - o[1]) * (x1 - x0); if (Math.abs(d) < 1e-9) return false; const t = ((x0 - o[0]) * (z1 - z0) - (z0 - o[1]) * (x1 - x0)) / d, u = ((x0 - o[0]) * (i[1] - o[1]) - (z0 - o[1]) * (i[0] - o[0])) / d; return t > 0 && t < 1 && u >= 0 && u <= 1; }}); }};
              return {{ glass: glass.length, seen: glass.map(see), stopped: glass.map(cross), plainSeen: plain.slice(0, 3).map(see), keys: glass.map(e => e.key) }}; }})()""")
            check(res['glass'] > 0, "the lobby has a glass front in the game's wall map", res)
            if res['glass']:
                check(all(res['seen']), 'from outside, inside is in sight through every glass panel', res)
                check(all(res['stopped']), 'and every glass panel stops feet', res)
                check(not any(res['plainSeen']), 'through a plain wall of the lobby, nothing is seen', res)
            if A.stills: await view(gm, 120, 18, 70, 55); await settle(gm); await still(gm, 'lobby-glass')
            await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{L}' }})"); await idle(gm)

        if 'lockup' in ONLY:
            print("LOCKUP: the gang hideout's chain-link lock-up: seen through, it stops feet")
            Hd = await gm.evaluate("tw.spawnRoom('cyb-hideout', 0, 12, 8, 6, 4301)"); await idle(gm); await settle(gm)
            res = await gm.evaluate(f"""(async () => {{ const M = {V}, E = tw.entities(), mine = Object.fromEntries(Object.entries(E).filter(([, e]) => e.kind === 'object' && e.room === '{Hd}' && /chain-link/.test(e.cat || '')));
              return {{ n: Object.keys(mine).length, gate: Object.values(mine).some(e => e.cat === 'gate-chain-link'), sight: M.blockingSegments([], mine, 0).length, feet: M.blockingSegments([], mine, 0, {{ walk: true }}).length }}; }})()""")
            check(res['n'] >= 2 and res['gate'], 'the hideout has a chain-link lock-up with a gate', res)
            check(res['sight'] == 0 and res['feet'] >= 1, 'the lock-up is seen through and stops feet', res)
            if A.stills: await view(gm, 20, 77, 70, 55); await settle(gm); await still(gm, 'hideout-lockup')
            await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{Hd}' }})"); await idle(gm)

        if 'ceiling' in ONLY:
            print("CEILING: an office's fluorescent fittings from the table: lit, not drawn")
            Of = await gm.evaluate("tw.spawnRoom('mod-office', 30, 20, 8, 6, 4401)"); await idle(gm)
            await view(gm, 170, 115, 70, 55); await settle(gm); await gm.wait_for_timeout(1500) # (the camera on it: a building far from every camera sleeps, out of the scene)
            res = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), lit = new Set(w.fxItems()); return {objs(Of)}.filter(e => e.cat === 'light-fluorescent').map(e => {{ const r = w.recs.get(e.id); return r && {{ mesh: !!r.visual?.visible, group: !!r.group.visible, lit: lit.has(r.it), placeholder: !!r.visual?.userData?.placeholder }}; }}); }})()""")
            check(res and all(r and not r['mesh'] and r['group'] and r['lit'] for r in res), f'{len(res or [])} fittings: not drawn from the table, shown and lit', res[:3] if res else res)
            if A.stills: await still(gm, 'office-no-capsules')

        if 'buildings' in ONLY:
            print('BUILDINGS: the Modern genre is buildings')
            MB = json.load(open(os.path.join(ENGINE, 'tools', 'modern_buildings.json')))
            want = [b['label'] for b in MB['buildings']]
            await gm.evaluate("tw.build.reset()")
            await gm.keyboard.press('b'); await gm.wait_for_timeout(400)
            st = await gm.evaluate('tw.build.state()')
            hot = next((x.split(':', 1)[0] for x in st['list'] if x.split(':', 1)[1] == 'Modern'), None)
            check(st['open'] and hot and hot != '·', 'B opens the Build tray at the genres, Modern has a letter', st['list'])
            if hot: await gm.keyboard.press(hot); await gm.wait_for_timeout(400)
            st = await gm.evaluate('tw.build.state()')
            labels = [x.split(':', 1)[1] for x in st['list']]
            check(st['path'][:1] == ['Modern'] and st['active'] == 'type' and labels == want, 'Modern ▸ the buildings, by the real keys', labels)
            check(not any(l in ('City', 'Cyberpunk') for l in labels) and len(set(x.split(':', 1)[0] for x in st['list'])) == len(labels), 'no City or Cyberpunk type; every building has its own letter', st['list'])
            clip = await gm.evaluate("(() => { const r = document.getElementById('buildMenu').getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: Math.min(innerWidth, r.width + 16), height: Math.min(innerHeight - Math.max(0, r.top - 8), r.height + 16) }; })()")
            if A.stills: os.makedirs(A.stills, exist_ok=True); await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(A.stills, 'build-tray-modern.png'), clip=clip)
            await gm.keyboard.press('Escape'); await gm.wait_for_timeout(300)
            for b in MB['buildings']:
                rooms = await gm.evaluate(f"tw.taxonomy.get('t:{b['code']}').children.map(id => tw.taxonomy.get(id)).map(n => [n.roomKey, n.label, n.hot, n.furniture.filter(f => !f.kit).length + n.objects.length])")
                mine = [k for k, bs in MB['rooms'].items() if b['code'] in bs]; mine = [b['hub']] + [k for k in mine if k != b['hub']]
                check([r[0] for r in rooms] == [k for k in mine if any(r[0] == k for r in rooms)] and len(rooms) >= 2 and all(r[2] and r[3] >= 3 for r in rooms), f"{b['label']} ▸ {', '.join(r[1] for r in rooms)}", rooms)
            for code in ('APT', 'SHP'):
                await gm.evaluate(f"tw.build.restore(tw.taxonomy.pathOf(tw.taxonomy.get('t:{code}').children[0])); tw.build.open()"); await gm.wait_for_timeout(500)
                st = await gm.evaluate('tw.build.state()')
                clip = await gm.evaluate("(() => { const r = document.getElementById('buildMenu').getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: Math.min(innerWidth, r.width + 16), height: Math.min(innerHeight - Math.max(0, r.top - 8), r.height + 16) }; })()")
                if A.stills: await gm.wait_for_timeout(900); await gm.screenshot(path=os.path.join(A.stills, f'build-tray-{code.lower()}-rooms.png'), clip=clip)
                check(st['active'] == 'room' and st['path'][:2] == ['Modern', next(b['label'] for b in MB['buildings'] if b['code'] == code)], f'the tray at {st["path"][:2]}: its rooms', st['list'])
                await gm.evaluate("tw.build.close()"); await gm.wait_for_timeout(200)
            for code in ('APT', 'OFC', 'HID'):
                res = await gm.evaluate(f"""(async () => {{ const node = tw.taxonomy.get('t:{code}'), id = tw.buildAt(node, 14, 11, {{ seed: 77 }}); for (let i = 0; i < 100 && !Object.values(tw.entities()).some(e => e.kind === 'room' && e.building === id); i++) await new Promise(r => setTimeout(r, 100));
                  const rs = Object.values(tw.entities()).filter(e => e.kind === 'room' && e.building === id).map(e => e.recipe.type), b = tw.entities()[id];
                  return {{ id, rooms: rs, mine: node.children.map(c => tw.taxonomy.get(c).roomKey), gen: b?.gen?.code, name: b?.name }}; }})()""")
                await idle(gm)
                check(len(res['rooms']) >= 2 and all(k in res['mine'] for k in res['rooms']) and res['gen'] == code, f"a dragged-out {res['name']}: {len(res['rooms'])} rooms, all its own", res)
            old = await gm.evaluate("""(async () => { const at = tw.freeGroundFor(12, 9), plan = tw.buildingPlan({ code: 'MOD', ...at, seed: 5, storeys: 1, front: 'S' }), id = tw.makeBuilding({ code: 'MOD', ...at, seed: 5, storeys: 1, front: 'S' }, { name: 'Old city block' }); for (let i = 0; i < 100 && !Object.values(tw.entities()).some(e => e.kind === 'room' && e.building === id); i++) await new Promise(r => setTimeout(r, 100));
              return { id, at, plan: plan && plan.code, gen: tw.entities()[id]?.gen?.code, rooms: Object.values(tw.entities()).filter(e => e.kind === 'room' && e.building === id).length, prog: !!tw.buildingProgramme('CYB') }; })()""")
            await idle(gm)
            check(old['id'] and old['rooms'] >= 2 and old['gen'] == MB['legacy']['MOD'] and old['prog'], f"an old saved building's code MOD still re-rolls (as {MB['legacy']['MOD']}); CYB still has a programme", old)
            dl = await gm.evaluate("(async () => { const D = await import('/engine/client/deeplink.js'), T = await (await fetch('/engine/client/data/types.json')).json(); const n = (v) => D.packNode(tw.taxonomy, T.types, v)?.id || null; return { clinic: n('cyberpunk/cyb-clinic'), city: n('modern-city'), apt: n('modern/mod-apartment'), mod: n('MOD/mod-bar') }; })()")
            check(dl['clinic'] == 'r:SHP:cyb-clinic' and dl['city'] == 'g:modern' and dl['apt'] == 'r:APT:mod-apartment' and dl['mod'] == 'r:BAR:mod-bar', 'old ?pack= links (cyberpunk, modern-city, MOD) land in the buildings', dl)

        if errors: print('page errors:', *errors[:8], sep='\n  ')
        check(not errors, 'no page errors', errors[:3])
        n = sum(1 for r in results if r[0])
        print(f'browser cyberpunk: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
