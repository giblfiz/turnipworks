#!/usr/bin/env python3
"""THE MODROOMS LANE in the real engine (2026-11-07; experiments/2026-11-07-modrooms/). A GM tab.

  TW_PORTS=a,b python3 engine/test/browser_modrooms.py --local [--stills DIR] [--only ...]

  ROOMS     each new room laid from the Build tray's types (spawnRoom): the penthouse and the exec penthouse (the sectional,
            glass walls but for the door's), the bathroom (tub or shower, toilet, basin), the restroom (cubicles), the
            restaurant kitchen (the range, steel prep tables with the library's own food on them, the hood not drawn from
            the table), all generated; their doors are clear
  FIRE      THE FIRE ESCAPE IS A STAIRWELL: an alley at the ground, a building of two flats at 10 and 20 ft, landings drawn
            at 10, 20 and 30 against it. The two lower flights work (no warning note), the top one waits silently for a
            landing above; a pawn dropped on the drop ladder in the alley comes out on the first landing; walked up the
            first flight it rises smoothly to the second landing, then up the next to the third
  ELEVATOR  a car put in the ground floor of a two-storey office; Build the shaft: a hole over the car upstairs and doors on
            both floors; a pawn on the car stands on its deck; Up a floor: the car is at 10 ft and the pawn upstairs stands on
            it (on: 'car'), a pawn beside the car stays put. RIDERS (a pawn and a crate on the car arrive upstairs with it,
            and come back down): the riders lane's rule (core/riders.js, app.liftTo's carry); a pawn that stepped off stays;
            one undo puts the car back
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
ap.add_argument('--only', default='rooms,fire,elevator'); ap.add_argument('--keep', action='store_true'); ap.add_argument('--probe', action='store_true')
A = ap.parse_args(); ONLY = set(A.only.split(','))
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '19743,19744').split(','))
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-mx-'); site = tempfile.mkdtemp(prefix='tw-site-')
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
        if nm: await nm.fill(f"TEST modrooms {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 90000), 'GM tab live')
        objs = lambda rid: f"Object.values(tw.entities()).filter(e => e.kind === 'object' && e.room === '{rid}')"
        STEP = "((x0, z0, y0, x1, z1, n = 40) => { const H = tw.HT, E = tw.entities(); let y = y0, fb = H.baseUnder(E, x0, z0, y0); const out = []; for (let i = 1; i <= n; i++) { const t = H.pawnStepTo(E, x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, y, null, fb); if (!t.below || t.walk) { y = t.y; fb = t; } out.push(+y.toFixed(2)); } return out; })"

        if 'rooms' in ONLY:
            print('ROOMS: the five City rooms and the exec penthouse, laid in the game')
            WANT = {'mod-penthouse': ['sofa-sectional'], 'mod-penthouse-exec': ['sofa-sectional'], 'mod-bathroom': ['toilet'], 'mod-restroom': ['toilet-stall'], 'mod-kitchen': ['range-commercial', 'table-prep-steel']}
            SIZE = {'mod-penthouse': (8, 6), 'mod-penthouse-exec': (8, 6), 'mod-bathroom': (3, 2), 'mod-restroom': (4, 3), 'mod-kitchen': (6, 4)}
            x = 0
            for k, cats in WANT.items():
                w, d = SIZE[k]; R = await gm.evaluate(f"tw.spawnRoom('{k}', {x}, 0, {w}, {d}, 5101 + {x})"); await idle(gm)
                got = await gm.evaluate(f"{objs(R)}.map(e => e.cat)")
                check(all(c in got for c in cats), f'{k}: generated with {cats}', sorted(set(got))[:24])
                if 'penthouse' in k:
                    g = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()), edges = [...w.edges.values()].filter(e => e.sides.some(s => s.room === '{R}')); return {{ glass: edges.filter(e => e.kind === 'wall' && e.panel === 'wall-glass-curtain').length, doorSides: [...new Set(edges.filter(e => /^door/.test(e.kind)).map(e => e.sides.find(s => s.room === '{R}')?.side))], glassSides: [...new Set(edges.filter(e => e.panel === 'wall-glass-curtain').map(e => e.sides.find(s => s.room === '{R}')?.side))] }}; }})()""")
                    check(g['glass'] >= 4 and not set(g['doorSides']) & set(g['glassSides']), f'{k}: glass walls, none on the door\'s wall', g)
                if k == 'mod-kitchen':
                    food = await gm.evaluate(f"{objs(R)}.filter(e => e.parent && tw.entities()[e.parent]?.cat === 'table-prep-steel').map(e => e.cat)")
                    check(len(food) >= 2, "the prep tables carry the library's own food and tools", food)
                    await view(gm, x * 5 + 15, 10, 60, 60); await settle(gm); await gm.wait_for_timeout(1200)
                    hood = await gm.evaluate(f"""(() => {{ const w = tw.worldOf(tw.area()); return {objs(R)}.filter(e => e.cat === 'range-hood').map(e => {{ const r = w.recs.get(e.id); return r && {{ mesh: !!r.visual?.visible, group: !!r.group.visible }}; }}); }})()""")
                    check(hood and all(h and not h['mesh'] for h in hood), 'the range hood is not drawn from the table (a ceiling fitting)', hood)
                if A.stills: await view(gm, x * 5 + w * 2.5, d * 2.5, 55, 60); await settle(gm); await still(gm, f'room-{k}')
                x += w + 4

        if 'fire' in ONLY:
            print('FIRE: landings at 10, 20, 30 ft against a building over an alley')
            AL = await gm.evaluate("tw.spawnRoom('mod-alley', 0, 30, 8, 3, 5201)"); await idle(gm)
            B1 = await gm.evaluate("tw.spawnRoom('mod-apartment', 0, 35, 6, 5, 5202)"); await idle(gm) # (the ground floor of the building, south of the alley)
            for y in (10, 20): await gm.evaluate(f"tw.spawnRoom('mod-apartment', 0, 35, 6, 5, {5203 + y}, undefined, {y})"); await idle(gm)
            L = []
            for y in (10, 20, 30): L.append(await gm.evaluate(f"tw.spawnRoom('mod-fire-escape', 1, 33, 4, 2, {5300 + y}, undefined, {y})")); await idle(gm)
            await settle(gm)
            fl = await gm.evaluate("tw.stairs().filter(s => s.piece === 'stair-fire-escape' || s.piece === 'ladder-fire-escape').map(s => ({ piece: s.piece, works: s.works, problem: s.problem || null, note: s.note || null, rise: s.rise, bottom: s.bottom, top: s.top, from: s.from, to: s.to }))")
            flights = sorted([s for s in fl if s['piece'] == 'stair-fire-escape'], key=lambda s: s['bottom'][2]); ladders = [s for s in fl if s['piece'] == 'ladder-fire-escape']
            check(len(flights) == 3 and len(ladders) == 1, 'three steel flights (one a landing) and one drop ladder', fl)
            if len(flights) == 3:
                check(flights[0]['works'] and flights[1]['works'], 'the two lower flights work (each comes up onto the landing above)', flights[:2])
                check(flights[2]['problem'] == 'open' and not flights[2]['note'], 'the top flight waits silently for a landing above (no warning note)', flights[2])
            if ladders:
                lad = ladders[0]; check(lad['works'] and lad['rise'] == 10 and lad['bottom'][2] == 0, 'the drop ladder joins the alley to the first landing', lad)
                hop = await gm.evaluate(f"(() => {{ const s = tw.stairs().find(s => s.piece === 'ladder-fire-escape'), c = s.cells[0]; return tw.stairHop(c[0] + 2.5, c[1] + 2.5, 0); }})()")
                check(hop and abs(hop['y'] - 10) < 0.1, 'a pawn dropped on the ladder in the alley comes out on the first landing', hop)
            for i in range(2 if len(flights) == 3 else 0):
                f = flights[i]; w = await gm.evaluate(f"{STEP}({f['bottom'][0]}, {f['bottom'][1]}, {f['bottom'][2]}, {f['top'][0]}, {f['top'][1]})")
                check(abs(w[-1] - f['top'][2]) < 0.6 and all(abs(w[k] - w[k - 1]) < 1.5 for k in range(1, len(w))), f'walked up flight {i + 1}: from {f["bottom"][2]} ft to the landing at {f["top"][2]} ft, smoothly', w[::5])
            if len(flights) == 3:
                tok = await gm.evaluate(f"(tw.dispatch('token.create', {{ id: 'tok_fire00001', name: 'Runner', x: {flights[1]['top'][0]}, z: {flights[1]['top'][1]}, y: {flights[1]['top'][2]} }}), true)"); await idle(gm)
                b = await gm.evaluate("(() => { const e = tw.entities()['tok_fire00001']; return tw.HT.baseUnder(tw.entities(), e.x, e.z, e.y || 0); })()")
                check(b and abs(b['y'] - 30) < 0.1 and b['room'] == L[2], 'a pawn at the top of the second flight stands on the third landing', b)
            if A.stills:
                await gm.evaluate("tw.registry.run('view.roofsOff')")
                for i, (yaw, pitch, dist) in enumerate(((0, 50, 90), (3.14, 50, 90), (1.2, 40, 80), (0, 75, 70))): await view(gm, 15, 162, dist, pitch, yaw); await settle(gm); await still(gm, f'fire-escape-{i}')

        if 'elevator' in ONLY:
            print('ELEVATOR: a car in a two-storey office, its shaft, up a floor and back with what stands on it')
            O0 = await gm.evaluate("tw.spawnRoom('mod-office', 80, 0, 6, 5, 5401)"); await idle(gm)
            O1 = await gm.evaluate("tw.spawnRoom('mod-office', 80, 0, 6, 5, 5402, undefined, 10)"); await idle(gm)
            # the car where the office's own things are not (its program's furniture may stand on the square): a fresh square by the wall
            for oid in await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && (e.room === '{O0}' || e.room === '{O1}') && Math.abs(e.x - 402.5) < 4 && Math.abs(e.z - 2.5) < 4 && !e.fromEdge && e.place !== 'kit').map(e => e.id)"):
                await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{oid}' }})")
            await idle(gm)
            car = await gm.evaluate(f"""(() => {{ const z = tw.roomgen.sizeOf('elevator-car', null); if (!z) return {{ err: 'no elevator-car in the library' }}; const id = 'obj_elevcar0001';
              const cid = tw.dispatch('object.place', {{ id, name: 'elevator car', cat: 'elevator-car', sku: z.sku, url: z.url, place: z.place || 'floor', layer: 'furnish', x: 402.5, y: 0, z: 2.5, rot: 0, yaw: z.yaw || 0, ...(z.s && {{ s: z.s }}), dims: z.dims, room: '{O0}' }}); return {{ id, cid: !!cid, dims: z.dims }}; }})()""")
            await idle(gm)
            have = await gm.evaluate(f"!!tw.entities()['{car.get('id')}']") if car.get('id') else False
            check(have, 'an elevator car is in the library and put down', car)
            if have:
                car = car['id']
                await gm.evaluate(f"tw.elevatorShaft(tw.entities()['{car}'])"); await idle(gm)
                sh = await gm.evaluate(f"""(() => {{ const E = tw.entities(), c = E['{car}']; return {{ stops: tw.EL.shaftStops(E, c), holes: Object.values(E).filter(e => e.cat === 'hole' && Math.round(e.y || 0) === 10).map(e => [e.x, e.z]), doors: Object.values(E).filter(e => e.cat === 'elevator-doors').map(e => Math.round(e.y || 0)).sort() }}; }})()""")
                check(sh['stops'] == [0, 10] and [402.5, 2.5] in sh['holes'] and sh['doors'] == [0, 10], 'the shaft: stops at 0 and 10 ft, the hole upstairs, doors on both floors', sh)
                deck = await gm.evaluate(f"tw.EL.carDeckY(tw.entities()['{car}'])")
                for tid, nmx, x, z, y in (('tok_ride00001', 'Rider', 402.5, 2.5, deck), ('tok_stay00001', 'Stayer', 408.5, 8.5, 0)):
                    await gm.evaluate(f"tw.dispatch('token.create', {{ id: '{tid}', name: '{nmx}', x: {x}, z: {z}, y: {y} }})")
                await gm.evaluate(f"tw.dispatch('object.place', {{ id: 'obj_crate00001', name: 'cardboard boxes', cat: 'cardboard-boxes', x: 403.4, y: {deck}, z: 3.0, rot: 0, dims: [1.6, 1.4, 1.3], room: '{O0}', parent: '{car}' }})"); await idle(gm)
                await view(gm, 402.5, 2.5, 40, 60); await settle(gm); await gm.wait_for_timeout(800)
                BASE = "((id) => { const e = tw.entities()[id]; const b = tw.HT.baseUnder(tw.entities(), e.x, e.z, e.y || 0); return { y: +(e.y || 0).toFixed(2), base: b.y, on: b.on }; })"
                r0 = await gm.evaluate(f"{BASE}('tok_ride00001')"); carrier = await gm.evaluate("(tw.pawnCarrier ? tw.pawnCarrier(tw.entities()['tok_ride00001']) : null)")
                check(r0['on'] == 'car' and abs(r0['base'] - deck) < 0.02, 'a pawn on the car stands on its floor (the data)', r0)
                check(carrier == car, 'and the downward look finds the car under it (what the riders ask)', carrier)
                await gm.evaluate(f"tw.elevatorMove(tw.entities()['{car}'], 1)"); await idle(gm)
                cy = await gm.evaluate(f"tw.entities()['{car}'].y || 0")
                check(cy == 10, 'Up a floor: the car is at 10 ft', cy)
                up = await gm.evaluate(f"(() => {{ const E = tw.entities(); return {{ deck: tw.HT.baseUnder(E, 401.5, 1.5, 11), next: tw.elevatorNext(E['{car}'], 1), stay: {BASE}('tok_stay00001') }}; }})()")
                check(up['deck']['on'] == 'car' and abs(up['deck']['y'] - deck - 10) < 0.02, 'upstairs the car is ground: a pawn over it stands on it, not over the shaft', up['deck'])
                check(up['next'] is None, 'the shaft goes no higher', up)
                check(up['stay']['y'] == 0, 'a pawn beside the car stays put on the ground floor', up['stay'])
                rr = await gm.evaluate(f"{BASE}('tok_ride00001')"); cr = await gm.evaluate("+(tw.entities()['obj_crate00001'].y || 0).toFixed(2)")
                check(abs(rr['y'] - deck - 10) < 0.02 and rr['on'] == 'car', 'RIDERS: the pawn on the car arrived upstairs with it, standing on its floor', rr)
                check(abs(cr - deck - 10) < 0.02, 'RIDERS: the crate on the car arrived upstairs with it', cr)
                if A.stills: await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); await view(gm, 402.5, 2.5, 30, 55, 0.5); await settle(gm); await still(gm, 'elevator-up'); await gm.evaluate("tw.setCut(null, { by: 'test' })")
                await gm.evaluate(f"tw.elevatorMove(tw.entities()['{car}'], -1)"); await idle(gm)
                cy = await gm.evaluate(f"tw.entities()['{car}'].y || 0"); check(cy == 0, 'Down a floor: the car is back at the ground floor', cy)
                rr = await gm.evaluate(f"{BASE}('tok_ride00001')"); cr = await gm.evaluate("+(tw.entities()['obj_crate00001'].y || 0).toFixed(2)")
                check(abs(rr['y'] - deck) < 0.02 and rr['on'] == 'car' and abs(cr - deck) < 0.02, 'RIDERS: the pawn and the crate came back down with the car', [rr, cr])
                hole = await gm.evaluate("(() => tw.HT.baseUnder(tw.entities(), 401.5, 1.5, 10.5))()")
                check(hole['y'] < 1, 'with the car down, upstairs the shaft is open: a pawn there is over the drop (its base is on the car below)', hole)
                await gm.evaluate("tw.dispatch('token.move', { id: 'tok_ride00001', x: 407.5, z: 2.5, y: 0 })"); await idle(gm)
                await gm.evaluate(f"tw.elevatorMove(tw.entities()['{car}'], 1)"); await idle(gm)
                rr = await gm.evaluate(f"{BASE}('tok_ride00001')"); check(rr['y'] == 0, 'a pawn that stepped off the car stays put when the car goes up', rr)
                undo = await gm.evaluate(f"(async () => {{ tw.undo && tw.undo(); await new Promise(r => setTimeout(r, 600)); return tw.entities()['{car}'].y || 0; }})()")
                check(undo == 0, 'one undo puts the car back down', undo)
                if A.stills: await gm.evaluate("tw.setCut(9, { pinned: true, by: 'test' })"); await view(gm, 402.5, 2.5, 30, 55, 0.5); await settle(gm); await still(gm, 'elevator-down'); await gm.evaluate("tw.setCut(null, { by: 'test' })")

        if errors: print('page errors:', *errors[:8], sep='\n  ')
        check(not errors, 'no page errors', errors[:3])
        n = sum(1 for r in results if r[0])
        print(f'browser modrooms: {n}/{len(results)} passed', flush=True)
        await browser.close()
    for pr in procs: pr.terminate()
    sys.exit(0 if all(r[0] for r in results) else 1)

try: asyncio.run(main())
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
