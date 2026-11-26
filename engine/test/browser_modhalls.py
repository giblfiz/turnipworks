#!/usr/bin/env python3
"""THE MODHALLS LANE in the real engine (2026-11-07; experiments/2026-11-07-modhalls/). A GM tab. Harry: "definitely
modern hallways as well".

  TW_PORTS=a,b python3 engine/test/browser_modhalls.py --local [--stills DIR]

  BUILD     an Apartment block (3 storeys), an Office tower (2) and a Bar & nightclub (1) made by the game's own
            makeBuilding (what the Build tray's drag calls): each one's corridors are its OWN corridor room (apartment
            hallway, office corridor, service corridor), never the hub's type; every corridor is furnished (no purpose
            fail) and lit; the apartment hallway's runner and sconces, the office corridor's ceiling panels, the service
            corridor's pipes; the mailboxes on the ground floor only
  LIFT      the Apartment block and the Office tower each get ONE lift: the car on the ground floor, a hole over it on each
            floor above, landing doors on every floor; Up a floor takes the car up, to the top storey and no further
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
ap.add_argument('--only', default='build,lift'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--probe', action='store_true')
A = ap.parse_args(); ONLY = set(A.only.split(','))
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19761,19762').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-mh-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
        if nm: await nm.fill(f"TEST modhalls {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        HALL = {'APT': 'mod-apartment-hallway', 'OFC': 'mod-office-corridor', 'BAR': 'mod-service-corridor'}
        WANT = {'APT': ['rug-runner', 'sconce-wall-modern'], 'OFC': ['light-fluorescent'], 'BAR': ['pipe-run-wall']}
        made = {}
        if 'build' in ONLY or 'lift' in ONLY:
            print('BUILD: three Modern buildings by makeBuilding')
            for i, (code, storeys) in enumerate((('APT', 3), ('OFC', 2), ('BAR', 1))):
                x0 = 4 + i * 20
                bid = await gm.evaluate(f"tw.makeBuilding({{ code: '{code}', x: {x0}, z: 4, w: 14, d: 11, seed: 5, storeys: {storeys}, front: 'S' }}, {{ name: '{code}' }})")
                await idle(gm); await settle(gm, 180000)
                info = await gm.evaluate(f"""(() => {{ const E = tw.entities(), rs = Object.values(E).filter(e => e.kind === 'room' && e.building === '{bid}'), plan = tw.lastPlan;
                  const halls = plan.rooms.filter(r => r.role === 'hall'), idOf = (pid) => rs.find(r => r.recipe.x === plan.rooms.find(q => q.id === pid).x && r.recipe.z === plan.rooms.find(q => q.id === pid).z && (r.recipe.y || 0) === plan.rooms.find(q => q.id === pid).y)?.id;
                  const hallRooms = rs.filter(r => r.recipe.type === '{HALL[code]}'), objs = (id) => Object.values(E).filter(o => o.kind === 'object' && o.room === id);
                  return {{ rooms: rs.length, halls: [...new Set(halls.map(h => h.type))], hallRooms: hallRooms.length, levels: [...new Set(hallRooms.map(r => r.recipe.y || 0))],
                    things: [...new Set(hallRooms.flatMap(r => objs(r.id).map(o => o.cat)))], mail: hallRooms.flatMap(r => objs(r.id).filter(o => o.cat === 'mailbox-bank').map(() => r.recipe.y || 0)),
                    fails: tw.lastBuildOut.fails, lifts: plan.lifts || [], cars: Object.values(E).filter(o => o.cat === 'elevator-car' && rs.some(r => r.id === o.room)).map(o => o.id),
                    holes: Object.values(E).filter(o => o.cat === 'hole' && rs.some(r => r.id === o.room)).length, doors: Object.values(E).filter(o => o.cat === 'elevator-doors' && rs.some(r => r.id === o.room)).length }}; }})()""")
                made[code] = {**info, 'bid': bid, 'x0': x0, 'storeys': storeys}
                check(info['hallRooms'] > 0 and info['halls'] == [HALL[code]], f"{code}: its corridors are {HALL[code]} rooms", {k: info[k] for k in ('hallRooms', 'halls', 'levels')})
                check(not [f for f in info['fails'] if 'hallway' in f['type'] or 'corridor' in f['type']], f'{code}: every corridor furnished (no purpose fail)', info['fails'])
                check(all(c in info['things'] for c in WANT[code]), f"{code}: its corridors carry {WANT[code]}", info['things'])
                if code == 'APT': check(all(y == 0 for y in info['mail']), 'APT: the mailboxes only on the ground floor', info['mail'])
                if A.stills:
                    for L in range(storeys):
                        await gm.evaluate(f"tw.setCut({L * 10 + 9}, {{ pinned: true, by: 'test' }})"); await view(gm, (x0 + 7) * 5, (4 + 5.5) * 5, 75, 62, 0.35); await settle(gm); await still(gm, f'{code.lower()}-floor{L}')
                    await gm.evaluate("tw.setCut(null, { by: 'test' })")
        if 'lift' in ONLY:
            print('LIFT: the Apartment block and the Office tower')
            for code in ('APT', 'OFC'):
                m = made.get(code)
                if not m: continue
                check(len(m['lifts']) == 1 and len(m['cars']) == 1 and m['holes'] == m['storeys'] - 1 and m['doors'] == m['storeys'], f"{code}: one lift: a car, {m['storeys'] - 1} holes, {m['storeys']} landing doors", {k: m[k] for k in ('lifts', 'cars', 'holes', 'doors')})
                if len(m['cars']) != 1: continue
                car = m['cars'][0]; ys = []
                for k in range(m['storeys']):
                    await gm.evaluate(f"tw.elevatorMove(tw.entities()['{car}'], 1)"); await idle(gm)
                    ys.append(await gm.evaluate(f"tw.entities()['{car}'].y || 0"))
                want = [10 * (k + 1) for k in range(m['storeys'] - 1)] + [10 * (m['storeys'] - 1)]
                check(ys == want, f'{code}: Up a floor rides the car up the shaft, and the top floor is the top', ys)
                if A.stills and code == 'APT':
                    await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); l = m['lifts'][0]; await view(gm, (l['cell'][0] + 0.5) * 5, (l['cell'][1] + 0.5) * 5, 35, 55, 0.5); await settle(gm); await still(gm, 'apt-lift-upstairs'); await gm.evaluate("tw.setCut(null, { by: 'test' })")

        if errors: print('page errors:', *errors[:8], sep='\n  ')
        check(not errors, 'no page errors', errors[:3])
        n = sum(1 for r in results if r[0])
        print(f'browser modhalls: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
