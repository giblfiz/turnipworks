#!/usr/bin/env python3
"""A stair that is furniture opens the floor above (2026-10-11; Harry: "The grand entrance double-stairs don't cut
through to the higher floor"). core/stairs.js STAIR_ROLES; docs/VERTICAL.md "Stairs that are furniture".

  local:  TW_GPU=1 python3 engine/test/browser_grandstair.py --local
  shots:  ... browser_grandstair.py --local --shots [--tag after]   (full look; engine/test/shots/grandstair-<tag>-*.png)
          TW_ROOT=/path/to/another/checkout ... --shots --tag before   serves that checkout's code (the "before" stills)

  HALL     the mansion's entrance hall with a storey over it: no second stair is added; the floor and slab above are
           cut on the grand stair's squares; a railing stands round the hole, open on both hands at the top
  POINTER  through the hole the pointer reaches the stair; beside the hole the floor stops it
  PAWNS    a pawn dragged onto the stair arrives upstairs beside its top; dragged onto the hole, at its foot
  KIT      EVERY stair piece of the library (each sku of each stair role), put down by hand under a floor: it lands on
           whole squares, the floor above opens on exactly those, it is railed, and its mesh climbs the way the game says
  HAND     the real tool: pick the grand stair in the library, click: the same; R turns it by quarter turns
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402,F401  test writes go to the server's sandbox
tw_sandbox.pawn_snap('always')  # this suite's pawn drags expect pawns that snap to the squares; said here, not left to the default (free, Shift snaps, since 2026-10-11)
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
ROOT = os.environ.get('TW_ROOT') or REPO  # the checkout whose code is served (the "before" stills use the old one)
SHOTS = os.path.join(HERE, 'shots')
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU', '1') != '0' else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--tag', default='after'); ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
results = []; procs = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail) if detail else ''}", flush=True)

RP, SP = 18177, 18807
def start_local(full=False):
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale test server?)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale test server?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-grandstair-'); site = tempfile.mkdtemp(prefix='tw-site-')
    eng = os.path.join(ROOT, 'engine')
    os.symlink(eng, os.path.join(site, 'engine')); os.symlink(os.path.join(ROOT, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(eng, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro' + ('' if full else '&faces=1500')

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout); return True
    except Exception: print(f'    (timed out: {what or js[:80]})'); return False
async def view(pg, x, z, dist=80, pitch=60, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(250)
async def settle(pg, ms=90000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", ms, 'spawn animations over')
    await pg.wait_for_timeout(300)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def drag(pg, a, b, steps=12):
    await pg.mouse.move(a['x'], a['y']); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    await pg.mouse.up(); await pg.wait_for_timeout(500)

W = "tw.worldOf(tw.area())"
# what is drawn of a room's floor: the floor tiles and the slab boxes standing on given squares
FLOOR_ON = """((rid, cells) => { const w = tw.worldOf(tw.area()); let tiles = 0, slab = 0; const inCell = (x, z) => cells.some(([gx, gz]) => x > gx * 5 && x < gx * 5 + 5 && z > gz * 5 && z < gz * 5 + 5);
  for (const s of w.shell.values()) { if (s.roomId !== rid || s.spec.layer !== 'floor') continue;
    if (s.spec.slab) { s.group.updateMatrixWorld(true); s.visual?.traverse?.(o => { if (o.isMesh) { const p = o.getWorldPosition(new (o.position.constructor)()); const sx = o.geometry.parameters?.width || 5, sz = o.geometry.parameters?.depth || 5; if (sx <= 5.01 && sz <= 5.01 ? inCell(p.x, p.z) : cells.some(([gx, gz]) => Math.abs(p.x - (gx * 5 + 2.5)) < sx / 2 && Math.abs(p.z - (gz * 5 + 2.5)) < sz / 2)) slab++; } }); }
    else if (inCell(s.spec.x, s.spec.z)) tiles++; }
  return { tiles, slab }; })"""
# a catalog stair as the game sees it
PIECE = "((id) => { const E = tw.entities(), s = E[id], S = tw.ST; if (!s) return null; const top = S.stairTop(s); return { id, cat: s.cat, sku: s.sku, place: s.place, layer: s.layer, x: s.x, y: s.y || 0, z: s.z, rot: s.rot || 0, dims: s.dims, room: s.room, top, cells: S.stairCells(s), dir: S.stairDir(s), ends: S.stairEnds(s, E), links: S.stairLinks(E, s), holes: [...S.holesAt(E, top)].map(k => k.split(':').map(Number)).filter(c => S.stairCells(s).some(x => x[0] === c[0] && x[1] === c[1]) || Object.values(E).some(r => r.kind === 'room' && (r.recipe.y || 0) === top && s.room && E[s.room] && Math.abs(c[0] - E[s.room].recipe.x) < 12 && c[0] >= E[s.room].recipe.x && c[1] >= E[s.room].recipe.z && c[1] < E[s.room].recipe.z + E[s.room].recipe.d)), rails: S.stairRails(E, s).map(r => r.key).sort() }; })"
# its drawn mesh, measured: is it loaded, where does it stand, and which way do its vertices get higher (world x and z)
MESH = """((id) => { const w = tw.worldOf(tw.area()), r = w.recs.get(id); if (!r?.visual || r.visual.userData?.placeholder) return null;
  r.group.updateMatrixWorld(true); const v = new (r.group.position.constructor)(); let n = 0, sx = 0, sy = 0, sz = 0, sxy = 0, szy = 0, sxx = 0, szz = 0, syy = 0, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  r.visual.traverse(o => { if (!o.isMesh || !o.geometry?.attributes?.position) return; const p = o.geometry.attributes.position, st = Math.max(1, Math.floor(p.count / 3000));
    for (let i = 0; i < p.count; i += st) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); n++; sx += v.x; sy += v.y; sz += v.z; sxy += v.x * v.y; szy += v.z * v.y; sxx += v.x * v.x; szz += v.z * v.z; syy += v.y * v.y; [v.x, v.y, v.z].forEach((c, k) => { min[k] = Math.min(min[k], c); max[k] = Math.max(max[k], c); }); } });
  if (!n) return null; const cov = (ab, a, b) => ab / n - (a / n) * (b / n), vy = Math.max(1e-9, cov(syy, sy, sy));
  return { n, min: min.map(c => +c.toFixed(2)), max: max.map(c => +c.toFixed(2)), cx: +(cov(sxy, sx, sy) / Math.sqrt(Math.max(1e-9, cov(sxx, sx, sx)) * vy)).toFixed(2), cz: +(cov(szy, sz, sy) / Math.sqrt(Math.max(1e-9, cov(szz, sz, sz)) * vy)).toFixed(2) }; })"""
# how far a pointer ray straight down from 30 ft gets before a drawn floor stops it (20 = the floor at 10 ft)
STOP = "((x, z) => { const R = new (tw.rayAt(0, 0).constructor)(), V = tw.main.camera.position.constructor; R.set(new V(x, 30, z), new V(0, -1, 0)); return +tw.worldOf(tw.area()).floorStop(R.ray).toFixed(2); })"
EMPTY = "((rid) => tw.batch(Object.values(tw.entities()).filter(o => o.kind === 'object' && o.room === rid).map(o => ({ type: 'object.delete', args: { id: o.id } }))))"

async def hall(gm, w=5, seed=1, up='mansion-bedroom'):
    H = await gm.evaluate(f"tw.spawnRoom('mansion-hall', 0, 0, {w}, 6, {seed})")
    await wait(gm, f"tw.entities()['{H}'] && tw.sync.pendingCount() === 0", 30000, 'hall')
    SID = await gm.evaluate(f"Object.values(tw.entities()).find(o => o.kind === 'object' && o.cat === 'stair-grand' && o.room === '{H}')?.id || null")
    U = await gm.evaluate(f"tw.spawnRoom('{up}', 0, 0, {w}, 6, {seed + 40}, undefined, 10)")
    await wait(gm, f"tw.entities()['{U}'] && tw.sync.pendingCount() === 0", 30000, 'the room above')
    return H, U, SID

async def main():
    full = A.shots
    page = start_local(full) if A.local else A.page + ('&' if '?' in A.page else '?') + 'nointro'
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        ctx = await browser.new_context(viewport={'width': 1920, 'height': 1080} if full else {'width': 1400, 'height': 900})
        gm = await ctx.new_page(); gm.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        await gm.goto(page)
        await gm.wait_for_selector('#newCampaign input[name=gm]', state='visible', timeout=180000)  # (the live page under a loaded box)
        await gm.fill('#newCampaign input[name=gm]', 'Harry')
        nm = await gm.query_selector('#newCampaign input[name=name]')
        if nm: await nm.fill(f"TEST grandstair {time.strftime('%m-%d %H:%M:%S')} (throwaway)")
        await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 45000), 'GM tab live')

        if A.shots:  # only what the old code has too: the "before" stills are made by this same path
            H, U, SID = await hall(gm, 6, 2)
            last = await gm.evaluate("tw.lastStair")
            if last: await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{last}' }})")  # (before the fix the room above got a flight of its own: one stair in the picture)
            await settle(gm, 120000); await gm.wait_for_timeout(5000)
            st = await gm.evaluate(f"tw.entities()['{SID}']")
            for (name, cut) in (('lv1', 9), ('lv2', 19)):
                await gm.evaluate(f"tw.select([]); tw.setCut({cut}, {{ pinned: true, by: 'test' }})"); await view(gm, 15, 15, 62, 52, 0.45); await gm.wait_for_timeout(3000)
                await gm.screenshot(path=os.path.join(SHOTS, f'grandstair-{A.tag}-{name}.png'))
                await view(gm, st['x'], st['z'], 36, 48, 0.8); await gm.wait_for_timeout(3000)
                await gm.screenshot(path=os.path.join(SHOTS, f'grandstair-{A.tag}-{name}-close.png'))
            await view(gm, st['x'], st['z'], 34, 78, 0.0); await gm.wait_for_timeout(3000)
            await gm.screenshot(path=os.path.join(SHOTS, f'grandstair-{A.tag}-lv2-above.png'))
            print('shots written:', SHOTS, A.tag, 'stair at', st['x'], st['z']); await browser.close(); return True

        # ================= HALL =================
        print('HALL: the mansion\'s entrance hall with a storey over it')
        H, U, SID = await hall(gm, 5, 1)
        check(SID and await gm.evaluate("tw.lastStair") is None, 'the room over the hall is given no second stair: the grand stair is its way up', str(await gm.evaluate("tw.stairWhy")))
        await settle(gm)
        st = await gm.evaluate(PIECE + f"('{SID}')")
        check(st and st['place'] == 'kit' and st['top'] == 10 and st['links'] == {'from': H, 'to': U}, 'the grand stair is the hall\'s furniture and joins the hall to the room above', json.dumps(st and {k: st[k] for k in ('place', 'top', 'links', 'x', 'z', 'dims')}))
        cells = st['cells']; hk = sorted(map(tuple, st['holes']))
        check(len(cells) == 9 and hk == sorted(map(tuple, cells)), 'the floor above is open on the squares the stair stands on (10 ft of stair centred in a 25-ft hall: three squares across, three along)', str(hk))
        fo = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(cells)})"); rest = await gm.evaluate(FLOOR_ON + f"('{U}', [[0, 4], [4, 5]])")
        check(fo == {'tiles': 0, 'slab': 0} and rest['tiles'] == 2 and rest['slab'] >= 1, 'no floor tile and no slab is drawn over the stair; the rest of the floor is there (measured)', f'{fo} / elsewhere {rest}')
        check(await wait(gm, f"{W}.rails().filter(r => r.stair === '{SID}').length > 0 && {W}.rails().every(r => r.loaded)", 30000, 'rails drawn'), 'a railing is drawn round the hole')
        rails = await gm.evaluate(f"{W}.rails().filter(r => r.stair === '{SID}')")
        check(sorted(r['key'] for r in rails) == st['rails'] and len(rails) >= 5 and all(r['y'] == 10 and r['room'] == U for r in rails), 'a section on every open side, on the upper floor, belonging to the room above', f"{len(rails)}: {st['rails']}")
        ex = st['ends']['exits']
        check(len(ex) == 2 and {tuple(c) for c in ex} == {(0, 0), (4, 0)} and not any(abs(r['x'] - 5) < 0.1 and abs(r['z'] - 2.5) < 0.1 or abs(r['x'] - 20) < 0.1 and abs(r['z'] - 2.5) < 0.1 for r in rails), 'the stair climbs to the far wall, so it leads out on both hands of its top row, and no railing stands across either', str(ex))
        m = await gm.evaluate(MESH + f"('{SID}')")
        if not m: await wait(gm, MESH + f"('{SID}') !== null", 30000, 'grand stair mesh'); m = await gm.evaluate(MESH + f"('{SID}')")
        check(m and m['cz'] < -0.3 and abs(m['cx']) < 0.2 and st['dir'] == [0, -1] and m['max'][1] > 12, 'its mesh climbs the way the game says (toward the far wall); the balustrade rises past the upper floor', json.dumps(m))
        up_objs = await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.kind === 'object' && o.room === '{U}' && !o.parent && o.place !== 'wall' && o.place !== 'ceiling' && !o.flat && {json.dumps(cells + ex)}.some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7)).map(o => o.cat)")
        check(not up_objs, 'the room above is furnished clear of the hole and the way out', str(up_objs))

        # ================= POINTER =================
        print('POINTER: a floor stops the pointer; a stair\'s hole does not')
        await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); await view(gm, st['x'], st['z'], 42, 72, 0.0); await gm.wait_for_timeout(800)
        thru = await gm.evaluate(STOP + f"({st['x']}, {st['z']})"); side = await gm.evaluate(STOP + f"({st['x'] - 6.5}, {st['z']})"); solid = await gm.evaluate(STOP + "(2.5, 22.5)")
        check(thru > 21 and side > 21 and abs(solid - 20) < 0.05, 'a ray straight down passes the upper floor over the stair and over the open strip beside it, and is stopped by the floor elsewhere', f'over the stair {thru}, beside it {side}, on the floor {solid}')
        PICK = "((cx, cy) => tw.worldOf(tw.area()).pickAll(tw.rayAt(cx, cy)).map(h => h.entity?.id || (h.wall ? 'wall:' + h.wall : null)))"
        pt = await scr(gm, st['x'], st['z'], 5.5); got = await gm.evaluate(PICK + f"({pt['x']}, {pt['y']})")
        check(got and got[0] == SID, 'from the floor above, the pointer goes down the hole and takes the stair first', str(got))
        under = await gm.evaluate(f"Object.values(tw.entities()).filter(o => o.kind === 'object' && o.room === '{H}' && !o.parent && !o.flat && o.place === 'floor' && o.cat !== 'stair-grand' && !{json.dumps(cells)}.some(([gx, gz]) => Math.floor(o.x / 5) === gx && Math.floor(o.z / 5) === gz)).map(o => ({{ id: o.id, cat: o.cat, x: o.x, z: o.z, h: o.dims[1] }}))")
        if under:
            o = under[0]; pt = await scr(gm, o['x'], o['z'], 10); got = await gm.evaluate(PICK + f"({pt['x']}, {pt['y']})")
            check(o['id'] not in got and U in got, 'beside the hole the floor is still a floor: the pointer over a thing in the hall takes the upper room, not the thing', f"{o['cat']} -> {got}")
            await gm.evaluate("tw.setCut(9, { pinned: true, by: 'test' })"); await gm.wait_for_timeout(500); pt = await scr(gm, o['x'], o['z'], o['h'] * 0.6); got = await gm.evaluate(PICK + f"({pt['x']}, {pt['y']})")
            check(o['id'] in got, '(with the cut down at the hall the same thing is reached)', str(got))
        else: check(False, 'a hall thing under the upper floor to point at (test scene)')

        # ================= PAWNS =================
        print('PAWNS: up the stair and down it')
        foot = st['ends']['foot']
        await gm.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_mira00001', name: 'Mira', x: {foot['x']}, z: {foot['z']}, owner: tw.me() }})")
        await wait(gm, "tw.entities()['tok_mira00001'] && tw.sync.pendingCount() === 0", 8000); await settle(gm, 60000)
        await gm.evaluate("tw.setCut(9, { pinned: true, by: 'test' })"); await view(gm, st['x'], st['z'] + 6, 48, 64, 0.0); await gm.wait_for_timeout(600)
        for (hand, dx, want) in (('left', -3, [2.5, 2.5]), ('right', 3, [22.5, 2.5])):
            a = await scr(gm, foot['x'], foot['z'], 1.2); b = await scr(gm, st['x'] + dx, st['z'] + 2, 0)
            await drag(gm, a, b); await wait(gm, "(tw.entities()['tok_mira00001'].y || 0) === 10 && tw.sync.pendingCount() === 0", 6000, 'pawn upstairs')
            t = await gm.evaluate("tw.entities()['tok_mira00001']")
            check(t.get('y') == 10 and [t['x'], t['z']] == want, f'a pawn dragged onto the {hand} of the stair arrives on the upper floor beside its top, on that hand', f"({t['x']}, {t['z']}, y {t.get('y')}) want {want}")
            await gm.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_mira00001', x: {foot['x']}, z: {foot['z']}, y: 0 }})"); await wait(gm, "(tw.entities()['tok_mira00001'].y || 0) === 0 && tw.sync.pendingCount() === 0", 6000); await gm.wait_for_timeout(300)
        # from above
        await gm.evaluate("tw.dispatch('token.move', { id: 'tok_mira00001', x: 2.5, z: 2.5, y: 10 })"); await wait(gm, "(tw.entities()['tok_mira00001'].y || 0) === 10 && tw.sync.pendingCount() === 0", 6000)
        await gm.evaluate("tw.setCut(19, { pinned: true, by: 'test' })"); await gm.wait_for_timeout(700)
        a = await scr(gm, 2.5, 2.5, 11.2); b = await scr(gm, st['x'], st['z'] + 2, 10)
        await drag(gm, a, b); await wait(gm, "(tw.entities()['tok_mira00001'].y || 0) === 0 && tw.sync.pendingCount() === 0", 6000, 'pawn downstairs')
        t = await gm.evaluate("tw.entities()['tok_mira00001']")
        check((t.get('y') or 0) == 0 and abs(t['x'] - foot['x']) < 0.01 and abs(t['z'] - foot['z']) < 0.01, 'dragged onto the hole from above, it goes down to the stair\'s foot', f"({t['x']}, {t['z']}, y {t.get('y')}) want ({foot['x']}, {foot['z']})")
        # delete the stair: the floor closes; undo: it opens again
        await gm.evaluate(f"tw.select(['{SID}']); tw.deleteSelection()"); await wait(gm, f"!tw.entities()['{SID}'] && tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(600)
        fo2 = await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(cells)})")
        check(fo2['tiles'] == 9 and fo2['slab'] >= 1 and await gm.evaluate(f"{W}.rails().length") == 0, 'delete the stair and the floor above closes; its railing goes', str(fo2))
        await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{SID}'] && tw.sync.pendingCount() === 0", 8000); await gm.wait_for_timeout(600)
        check(await gm.evaluate(FLOOR_ON + f"('{U}', {json.dumps(cells)})") == {'tiles': 0, 'slab': 0}, 'undo brings the stair and its hole back')

        # ================= KIT =================
        print('KIT: every stair piece of the library, put down by hand under a floor')
        L = await gm.evaluate("tw.spawnRoom('storeroom', 12, 0, 8, 8, 5)"); await wait(gm, f"tw.entities()['{L}'] && tw.sync.pendingCount() === 0", 30000)
        await gm.evaluate(EMPTY + f"('{L}')")
        tops = {}
        L5 = await gm.evaluate("tw.spawnRoom('storeroom', 12, 12, 8, 8, 7)"); await wait(gm, f"tw.entities()['{L5}'] && tw.sync.pendingCount() === 0", 30000); await gm.evaluate(EMPTY + f"('{L5}')")
        tops[10] = await gm.evaluate("tw.spawnRoom('storeroom', 12, 0, 8, 8, 6, undefined, 10)"); await wait(gm, f"tw.entities()['{tops[10]}'] && tw.sync.pendingCount() === 0", 30000)
        last = await gm.evaluate("tw.lastStair"); await gm.evaluate(EMPTY + f"('{tops[10]}')")
        if last and await gm.evaluate(f"!!tw.entities()['{last}']"): await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{last}' }})")
        tops[5] = None  # no floor 5 ft up can be built with the tools today: a half flight is tried with nothing over it
        await settle(gm); await gm.evaluate("tw.setCut(4, { pinned: true, by: 'test' })"); await view(gm, 80, 50, 150, 80, 0.0); await gm.wait_for_timeout(500)
        check(await gm.evaluate("tw.ST.holesAt(tw.entities(), 10).size") == 9 and await gm.evaluate("tw.ST.holesAt(tw.entities(), 5).size") == 0, '(the test floors start whole: only the hall\'s nine squares are open)')
        roles = await gm.evaluate("Object.keys(tw.ST.STAIR_ROLES).map(id => ({ id, rise: tw.ST.STAIR_ROLES[id].rise, turn: !!tw.ST.STAIR_ROLES[id].turn, place: tw.roomgen.lib.objects[id]?.place, skus: (tw.roomgen.lib.objects[id]?.skus || []).filter(k => k.bounds && k.url).map(k => k.sku) }))")
        check(len(roles) >= 7 and all(r['skus'] for r in roles), 'every stair role has pieces in the library', str([(r['id'], len(r['skus'])) for r in roles]))
        n = 0; bad = []
        # KNOWN, and older than this change: the inn's first timber flight has no turn in data/orient.json, so its mesh is
        # drawn with its run across its box (it climbs along its own x). It still opens the floor; it looks wrong.
        SIDEWAYS = set()  # (2026-10-12: the inn's timber flight has its turn in orient.json now)
        for r in roles:
            for sku in r['skus']:
                q = n % 4; n += 1; rise = r['rise']; zc = 22 if rise == 10 else 82; U2 = tops[rise]
                # where the pointer is: mid-room for a floor piece; by the north wall for a ladder (it goes against a wall)
                px, pz = (81.0, zc + 0.7) if r['place'] != 'wall' else (78.0, zc - 20.5)
                pid = f"obj_gkit{n:06d}"
                placed = await gm.evaluate(f"""(() => {{ const size = tw.roomgen.sizeOf('{r['id']}', '{sku}'), cat = {{ id: '{r['id']}', place: size.place, name: '{r['id']}' }}, s = tw.screenOf({px}, {pz}, tw.main, 0);
                  const p = tw.modes.placementAt(cat, size, tw.rayAt(s.x, s.y), tw.groundAt(s.x, s.y), {{ rot: {q} * Math.PI / 2 }}); if (!p) return null;
                  tw.dispatch('object.place', {{ id: '{pid}', name: cat.name, cat: cat.id, sku: size.sku, url: size.url, place: size.place, layer: 'furnish', x: p.x, y: p.y, z: p.z, rot: p.rot, yaw: size.yaw, s: size.s || undefined, dims: size.dims, room: p.room || undefined }}); return p; }})()""")
                if not placed: bad.append(f'{sku}: no placement'); continue
                await wait(gm, f"tw.entities()['{pid}'] && tw.sync.pendingCount() === 0", 8000); await wait(gm, MESH + f"('{pid}') !== null", 30000, f'{sku} mesh'); await gm.wait_for_timeout(250)
                e = await gm.evaluate(PIECE + f"('{pid}')"); m = await gm.evaluate(MESH + f"('{pid}')")
                why = []
                if not e or not m: bad.append(f'{sku}: not drawn'); continue
                cells = e['cells']; hk = sorted(map(tuple, e['holes'])); ck = sorted(map(tuple, cells))
                rot_q = round(e['rot'] / 1.5707963) % 4; wx, wz = (e['dims'][2], e['dims'][0]) if rot_q % 2 else (e['dims'][0], e['dims'][2])
                if rise == 5:  # a half flight under no floor: it would open one 5 ft up, it has no railing, and a pawn dropped on it stays put
                    hop = await gm.evaluate(f"tw.stairHop({e['x']}, {e['z']}, 0)")
                    if e['room'] != L5 or e['top'] != 5 or len(cells) != 1 or e['rails'] or hop or m['max'][1] < 3.7 or e['links']['to'] is not None: why.append(f"half flight: top {e['top']}, {len(cells)} squares, rails {e['rails']}, pawn {hop}, mesh top {m['max'][1]}")
                    along = m['cx'] * e['dir'][0] + m['cz'] * e['dir'][1]
                    if along < 0.2: why.append(f"mesh climbs x {m['cx']} z {m['cz']}, the game says {e['dir']}")
                    if why: bad.append(f"{sku} (turned {q * 90}): " + '; '.join(why))
                    print(f"    {'ok  ' if not why else 'BAD '} {sku:38s} turned {q * 90:3d}: a half flight, 5 ft: under no floor it cuts nothing and carries no pawn; mesh climbs x {m['cx']:+.2f} z {m['cz']:+.2f}", flush=True)
                    await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{pid}' }})"); await wait(gm, f"!tw.entities()['{pid}'] && tw.sync.pendingCount() === 0", 8000); continue
                if e['room'] != L or e['links']['to'] != U2: why.append(f"joins {e['links']} (room {e['room']})")
                if hk != ck: why.append(f'holes {hk} != its squares {ck}')
                # the drawn mesh stands inside the opened squares (to a foot: a leaning ladder's top, a newel cap)
                x0 = min(c[0] for c in cells) * 5; x1 = max(c[0] for c in cells) * 5 + 5; z0 = min(c[1] for c in cells) * 5; z1 = max(c[1] for c in cells) * 5 + 5
                if m['min'][0] < x0 - 1.01 or m['max'][0] > x1 + 1.01 or m['min'][2] < z0 - 1.01 or m['max'][2] > z1 + 1.01: why.append(f"mesh {m['min']}..{m['max']} outside its squares x {x0}..{x1} z {z0}..{z1}")
                if r['place'] == 'kit' and len(cells) != max(1, round(wx / 5)) * max(1, round(wz / 5)): why.append(f'{len(cells)} squares for a {wx:.1f} x {wz:.1f} ft piece')
                if m['max'][1] < rise - 1.7 and sku not in SIDEWAYS: why.append(f"mesh top {m['max'][1]} does not reach {rise} ft")
                fo = await gm.evaluate(FLOOR_ON + f"('{U2}', {json.dumps(cells)})")
                if fo != {'tiles': 0, 'slab': 0}: why.append(f'floor still drawn over it {fo}')
                if len(e['rails']) < 2: why.append(f"railing {e['rails']}")
                if not e['ends']['exits'] or any(tuple(c) in set(hk) for c in e['ends']['exits']): why.append(f"way out {e['ends']['exits']}")
                # which way it climbs, measured on the drawn mesh, against what the game says
                if not r['turn'] and sku not in SIDEWAYS:
                    along = m['cx'] * e['dir'][0] + m['cz'] * e['dir'][1]; other = m['cx'] * e['dir'][1] + m['cz'] * e['dir'][0]
                    if along < 0.2 or abs(other) > abs(along): why.append(f"mesh climbs x {m['cx']} z {m['cz']}, the game says {e['dir']}")
                hop = await gm.evaluate(f"tw.stairHop({e['x']}, {e['z']}, 0)")
                if not hop or hop['y'] != rise or [int(hop['x'] // 5), int(hop['z'] // 5)] in cells: why.append(f'pawn up: {hop}')
                if sku in SIDEWAYS and not (abs(m['cx'] * e['dir'][1] + m['cz'] * e['dir'][0]) > 0.2 > abs(m['cx'] * e['dir'][0] + m['cz'] * e['dir'][1])): why.append('it is no longer drawn sideways: take it out of SIDEWAYS')
                if why: bad.append(f"{sku} (turned {q * 90}): " + '; '.join(why))
                print(f"    {'ok  ' if not why else 'BAD '} {sku:38s} turned {q * 90:3d}: {len(cells)} squares open at {rise} ft, {len(e['rails'])} railing sections, mesh climbs x {m['cx']:+.2f} z {m['cz']:+.2f}", flush=True)
                await gm.evaluate(f"tw.dispatch('object.delete', {{ id: '{pid}' }})"); await wait(gm, f"!tw.entities()['{pid}'] && tw.sync.pendingCount() === 0", 8000)
                if await gm.evaluate(f"tw.ST.holesAt(tw.entities(), {rise}).size") != (9 if rise == 10 else 0): bad.append(f'{sku}: the floor did not close when it was deleted')
        check(n == sum(len(r['skus']) for r in roles) and n >= 15 and not bad, f'every stair piece of the library ({n}) opens the floor it reaches on its own squares, is railed, climbs the way the game says, and carries a pawn up', ' | '.join(bad))

        # ================= HAND =================
        print('HAND: the library tool')
        await view(gm, 80, 20, 60, 70, 0.0); await gm.wait_for_timeout(400)
        before = await gm.evaluate("Object.keys(tw.entities()).length")
        await gm.evaluate("tw.modes.place(tw.assets.catById.get('stair-grand'))"); await gm.wait_for_timeout(300)
        pt = await scr(gm, 81.3, 21.2, 0); await gm.mouse.move(pt['x'], pt['y']); await gm.wait_for_timeout(200); await gm.mouse.click(pt['x'], pt['y'])
        await wait(gm, f"Object.keys(tw.entities()).length > {before} && tw.sync.pendingCount() === 0", 8000, 'placed'); await gm.keyboard.press('Escape')
        GID = await gm.evaluate(f"Object.values(tw.entities()).find(o => o.kind === 'object' && o.cat === 'stair-grand' && o.room === '{L}')?.id || null")
        g = await gm.evaluate(PIECE + f"('{GID}')") if GID else None
        check(g and g['place'] == 'kit' and g['layer'] == 'furnish' and g['x'] % 5 == 0 and g['z'] % 5 == 2.5 and len(g['cells']) == 6 and sorted(map(tuple, g['holes'])) == sorted(map(tuple, g['cells'])), 'the grand stair picked in the library and clicked into a room lands on whole squares (2 x 3) and opens the floor above on them', json.dumps(g and {k: g[k] for k in ('x', 'z', 'rot', 'layer', 'cells')}))
        if g:
            await wait(gm, MESH + f"('{GID}') !== null", 30000); await gm.wait_for_timeout(400)
            check(await gm.evaluate(FLOOR_ON + f"('{tops[10]}', {json.dumps(g['cells'])})") == {'tiles': 0, 'slab': 0}, 'and no floor is drawn over it')
            await gm.evaluate(f"tw.select(['{GID}']); tw.rotateSelection(15)"); await wait(gm, f"Math.abs(tw.entities()['{GID}'].rot - {g['rot']} - Math.PI / 2) < 0.01 && tw.sync.pendingCount() === 0", 6000, 'turned'); await gm.wait_for_timeout(400)
            g2 = await gm.evaluate(PIECE + f"('{GID}')")
            check(abs(g2['rot'] - g['rot'] - 1.5707963) < 0.01 and sorted(map(tuple, g2['holes'])) == sorted(map(tuple, g2['cells'])) and g2['cells'] != g['cells'], 'R turns it a quarter turn, and the hole turns with it', json.dumps(g2['cells']))
            # a drag keeps it on whole squares
            await gm.evaluate("tw.select([])"); a = await scr(gm, g2['x'], g2['z'], 3); b = await scr(gm, g2['x'] + 6.3, g2['z'] + 4.1, 3)
            await drag(gm, a, b); await wait(gm, "tw.sync.pendingCount() === 0", 6000); g3 = await gm.evaluate(PIECE + f"('{GID}')")
            check((g3['x'], g3['z']) != (g2['x'], g2['z']) and len(g3['cells']) == 6 and abs(g3['rot'] - g2['rot']) < 0.01 and sorted(map(tuple, g3['holes'])) == sorted(map(tuple, g3['cells'])), 'dragged, it stays on whole squares and keeps its turn; the hole follows', json.dumps({k: g3[k] for k in ('x', 'z', 'rot', 'cells')}))

        await browser.close()
        if errors: check(False, 'no page errors', '; '.join(errors[:3]))
    bad = [r for r in results if not r[0]]
    print(f"\ngrandstair: {len(results) - len(bad)}/{len(results)} passed")
    return not bad

try: ok = asyncio.run(main())
finally:
    for pr in procs: pr.terminate()
sys.exit(0 if ok else 1)
