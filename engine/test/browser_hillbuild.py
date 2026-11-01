#!/usr/bin/env python3
"""Building on and into hills (2026-10-24). Harry: "I just dropped in a hill, which rendered very nicely, but wouldn't let
me build on top of it!", then: "The hill slope should not push thru walls. Existing (and new) rooms should trump hill
slope, so that they can have a 'dug out' look." docs/VERTICAL.md "Hills" (Building on a hill, Rooms trump the bank).

What this drives, in a real browser, as the GM would:
  shrine     the room tool at the ground level, its drag started ON the hill's top: the room stands on the hill (floor
             10 ft, its walls up from there, lv 1 of its building, no slab showing, no stair offer, the hill's grass not
             drawn under it); the size label says "on the 10-ft hill"
  things     a barrel put down on the hilltop stands on it (the hill's); one put down in the shrine stands on its floor
  pawns      a pawn dragged into the shrine stands on its floor; sight: the shrine's walls are at the ground's level
  overhang   a room half off the hill's edge: the storeys' rule (posts and brackets under the part off the hill)
  dug in     a room first, then a hill over it: no earth inside, the hill's grass not drawn over it, a pawn inside
             stands on the room's floor; the reverse (a hill first, a room dragged in from the open ground): the same
  follows    moving the dug-in room moves the cut; undo puts the bank back exactly; delete makes it whole
  height     raising the hill carries the shrine up with it (one undo)
  the cut    at lv 1 the shrine on the hill still shows (it is its building's ground storey)
  sync       a player's tab works out the same ground, sample for sample
  errors     no page errors

  local:  python3 engine/test/browser_hillbuild.py --local [--shots DIR]
  live:   ... browser_hillbuild.py --page https://dev.turnipworks.net/
"""
import argparse, asyncio, json, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright
GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('TW_GPU') else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser(); ap.add_argument('--local', action='store_true'); ap.add_argument('--page'); ap.add_argument('--headed', action='store_true'); ap.add_argument('--shots')
A = ap.parse_args()
results = []
def check(ok, name, detail=''):
    results.append((bool(ok), name, detail)); print(f"  {'ok  ' if ok else 'FAIL'} {name}{' — ' + str(detail)[:400] if detail != '' else ''}", flush=True)

procs = []
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18527,18857').split(','))
POST = '' if A.shots else '&nopost'
def start_local():
    data = tempfile.mkdtemp(prefix='tw-hillbuild-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    import served; served.check(SP, ENGINE)  # (the page is this checkout's, not a stale server's: test/served.py)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + f'&api={POST}&faces=1500'

async def wait(pg, js, timeout=12000, what=''):
    try: await pg.wait_for_function(js, timeout=timeout, polling=80); return True
    except Exception: print(f'    (timed out: {what or js[:90]})'); return False
async def view(pg, x, z, dist=70, pitch=62, yaw=0, y=0):
    await pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({x}, {y}, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()")
    await pg.wait_for_timeout(300)
async def bar_text(pg, text):
    if await pg.evaluate("document.querySelector('#bar').classList.contains('open')"): await pg.keyboard.press('Escape')
    await pg.keyboard.press('/'); await pg.keyboard.type(text, delay=8); await pg.wait_for_timeout(450)
async def scr(pg, x, z, y=0): return await pg.evaluate(f"tw.screenOf({x}, {z}, tw.main, {y})")
async def mdrag(pg, a, b, steps=12, peek=None):
    await pg.mouse.move(a['x'], a['y']); await pg.wait_for_timeout(120); await pg.mouse.down()
    for i in range(1, steps + 1): await pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps); await pg.wait_for_timeout(25)
    out = await peek() if peek else None
    await pg.mouse.up(); await pg.wait_for_timeout(400); return out
async def settle(pg, ms=60000):
    await wait(pg, "tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading", ms, 'spawn animations over'); await pg.wait_for_timeout(250)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to a sandbox, never the live game
tw_sandbox.remove_campaigns()
W = "tw.worldOf(tw.area())"
HTJS = "await import(new URL('../core/height.js', document.baseURI).href)"
TREADY = f"(async () => {{ await {W}.terrain.ready; return {W}.terrain.info(); }})()"
C = lambda g: g * 5 + 2.5
PEEK = "(() => ({ plan: tw.mode?.plan && { kind: tw.mode.plan.kind, lit: tw.mode.plan.lit.length, ok: tw.mode.plan.ok }, level: tw.mode?.level, label: document.getElementById('modeLabel').textContent, marks: tw.worldOf(tw.area()).cellMarks.get('room-tool')?.info }))()"
# the highest ground the drawn field gives inside a box (feet)
def HIGH(x0, z0, x1, z1): return f"(async () => {{ await {W}.terrain.ready; const T = {W}.terrainField; let hi = -1e9; for (let z = {z0}; z <= {z1}; z += 0.25) for (let x = {x0}; x <= {x1}; x += 0.25) hi = Math.max(hi, T.heightAt(x, z)); return +hi.toFixed(3); }})()"
# the shell pieces drawn for a room: floor and wall heights, slab count
DRAWN = """(rid) => { const w = tw.worldOf(tw.area()), out = { floor: [], walls: [], slab: 0 };
  for (const s of w.shell.values()) { if (s.roomId !== rid) continue; const y = +s.group.position.y.toFixed(2);
    if (s.spec.slab) { out.slab++; continue; } if (s.spec.band || s.spec.support) continue; (s.spec.layer === 'floor' ? out.floor : out.walls).push(y); }
  const mm = (a) => a.length ? [Math.min(...a), Math.max(...a)] : null; return { floor: mm(out.floor), nFloor: out.floor.length, walls: mm(out.walls), nWalls: out.walls.length, slab: out.slab }; }"""
HILLTILES = "(hid) => { const w = tw.worldOf(tw.area()); w.cutSets(); return [...w.shell.values()].filter(s => s.roomId === hid && s.spec.layer === 'floor' && !w.takenShell(s)).map(s => [Math.floor(s.spec.x / 5), Math.floor(s.spec.z / 5)]); }" # (the hill's top tiles the view draws: under a room that takes the hill they exist, hidden while it shows, 2026-10-26)

async def main():
    page = start_local() if A.local else A.page + ('&' if '?' in A.page else '?') + f'faces=1500{POST}'
    if A.shots: os.makedirs(A.shots, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'])
        errors = []
        async def tab(url):
            ctx = await browser.new_context(viewport={'width': 1280, 'height': 820}); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' or 'terrain' in m.text else None) # (client/terrain.js reports its failures as warnings)
            await pg.goto(url); return pg
        async def shot(pg, name):
            if not A.shots: return
            await settle(pg); await pg.wait_for_timeout(2500); await pg.screenshot(path=os.path.join(A.shots, f'{name}.png'), timeout=180000); print(f'    shot {name}.png')
        gm = await tab(page + '&nointro')
        await gm.fill('#newCampaign input[name=gm]', 'Harry'); await gm.fill('#newCampaign input[name=name]', 'TEST hillbuild ' + time.strftime('%m-%d %H:%M:%S') + ' (throwaway)'); await gm.click('#newCampaign button')
        check(await wait(gm, 'window.tw && tw.ready && tw.ready()', 40000), 'GM tab live')
        await gm.evaluate("tw.dispatch('area.ground', { cat: 'floor-grass' })"); await gm.wait_for_timeout(600)
        HID = await gm.evaluate("tw.spawnRoom('hill', 0, 0, 8, 8, 11, undefined, 10)")
        await wait(gm, f"!!tw.entities()['{HID}']", 6000, 'the hill'); info = await gm.evaluate(TREADY)
        check(info['banks'] == 1 and info['triangles'] > 1000, 'the hill\'s bank is drawn (one mesh)', info)

        print('SHRINE: the room tool, its drag started on the hill top, at the ground level')
        await view(gm, 20, 20, 90, 70, 0, 10)
        await gm.evaluate("tw.modes.roomTool('common')"); await gm.wait_for_timeout(250)
        check(await gm.evaluate("tw.level") == 0, 'the level is the ground (nothing was changed)')
        a, b = await scr(gm, C(2), C(2), 10), await scr(gm, C(4), C(5), 10)
        mid = await mdrag(gm, a, b, peek=lambda: gm.evaluate(PEEK))
        check(mid['level'] == 10 and mid['plan']['ok'] and mid['plan']['lit'] == 12 and mid['marks'] and mid['marks']['y'] == 10, 'while dragging: 12 squares light up at 10 ft, on the hill top', mid)
        check('on the 10-ft hill' in mid['label'] and 'dug' not in mid['label'], 'the size label says it goes on the hill', mid['label'])
        ok = await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.type === 'common') && tw.sync.pendingCount() === 0", 15000, 'the shrine')
        S = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.type === 'common')")
        check(ok and S and S['recipe'].get('y') == 10 and [S['recipe'][k] for k in 'xzwd'] == [2, 2, 3, 4], 'the room is made ON the hill: floor at 10 ft, where it was dragged', S and S['recipe'])
        SID = S['id'] if S else ''
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape'); await settle(gm)
        st = await gm.evaluate(f"(async () => {{ const H = {HTJS}; const E = tw.entities(), r = E['{SID}']; return {{ base: H.hillUnder(E, r.recipe), ground: H.meetsGround(E, r), level: H.levelY(E, r), map: H.levelLabel(H.levelOf(E, r)), offer: tw.lastStairOffer, cmd: tw.registry.available?.().some(c => c.id === 'room.stair') }}; }})()")
        check(st['base'] == 10 and st['ground'] and st['level'] == 0, 'it meets the ground at the hill top: a ground storey (its door, no stair offer, sight at the outdoor surface)', st)
        check(st['map'] == 'lv 2', 'and on the map it is lv 2 (one numbering for the whole map, 2026-10-26)', st['map'])
        check(st['offer'] is None, 'no stair is offered down from it (it is a ground storey)', st['offer'])
        d = await gm.evaluate(f"({DRAWN})('{SID}')")
        check(d['floor'] and abs(d['floor'][0] - 10) < 0.05 and d['nWalls'] >= 10 and d['walls'][0] >= 9.99, 'its floor is drawn at 10 ft and its walls stand up from there (no gap, nothing buried)', d)
        tiles = await gm.evaluate(f"({HILLTILES})('{HID}')")
        under = [t for t in tiles if 2 <= t[0] <= 4 and 2 <= t[1] <= 5]
        cells = {tuple(t) for t in tiles}
        check(len(cells) == 64 - 12 and not under, "the hill's grass is not drawn under the room (no two floors fighting)", [len(cells), under[:3]])
        hi = await gm.evaluate(HIGH(10.5, 10.5, 24.5, 29.5))
        check(abs(hi - 10) < 1e-3, 'the ground under it is the hill top, unchanged', hi)
        await view(gm, 20, 20, 75, 48, -30, 8); await shot(gm, 'shrine-on-hill')

        print('THINGS: a barrel on the hilltop, one in the shrine')
        for (x, z, want, name) in [(32.5, 32.5, HID, 'the hilltop'), (17.5, 22.5, SID, 'the shrine')]:
            await view(gm, 22, 22, 70, 66, 0, 10)
            await bar_text(gm, 'barrel'); await gm.keyboard.press('Enter'); await gm.wait_for_timeout(500)
            sp = await scr(gm, x, z, 10); await gm.mouse.move(sp['x'], sp['y']); await gm.wait_for_timeout(250); await gm.mouse.click(sp['x'], sp['y']); await gm.wait_for_timeout(800)
            await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
            bar = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.kind === 'object' && /barrel/.test(e.cat) && Math.hypot(e.x - {x}, e.z - {z}) < 2.6).map(e => ({{ y: e.y, room: e.room }}))")
            check(len(bar) == 1 and abs((bar[0]['y'] or 0) - 10) < 0.05 and bar[0]['room'] == want, f'a barrel put down on {name} stands on it at 10 ft', bar)

        print('PAWNS: into the shrine; sight')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_hbpawn001', name: 'Bram', x: 52.5, z: 17.5, color: '#e8d46a' })"); await wait(gm, "!!tw.entities()['tok_hbpawn001']", 6000); await gm.wait_for_timeout(1200)
        await view(gm, 32, 20, 80, 66, 0, 5)
        await mdrag(gm, await scr(gm, 52.5, 17.5, 1.5), await scr(gm, 17.5, 12.5, 10), 14)
        await wait(gm, 'tw.sync.pendingCount() === 0', 5000); await gm.wait_for_timeout(500)
        e = await gm.evaluate("tw.entities()['tok_hbpawn001']")
        b = await gm.evaluate(f"{W}.pawnBaseInfo('tok_hbpawn001')")
        check(abs((e.get('y') or 0) - 10) < 0.01 and b and b['room'] == SID and abs(b['baseY'] - 10) < 0.05, 'a pawn dragged from the ground into the shrine stands on its floor', [{k: e.get(k) for k in ('x', 'y', 'z')}, b])
        sl = await gm.evaluate(f"(async () => {{ const H = {HTJS}; const V = await import(new URL('vision.js', document.baseURI).href); const E = tw.entities(), w = {W}; const segs = V.blockingSegments(w.edges, E, 0); return {{ inShrine: H.sightLevel(E, 17.5, 12.5, 10, (r) => w.isOpenRoom(r)), onHill: H.sightLevel(E, 32.5, 12.5, 10, (r) => w.isOpenRoom(r)), wallWest: [[0, 10], [0, 25], [1, 10], [1, 30]].filter(([ax, v]) => segs.some(s => ax === 0 ? s[0] === v && s[2] === v && Math.max(s[1], s[3]) > 10 && Math.min(s[1], s[3]) < 30 : s[1] === v && s[3] === v && Math.max(s[0], s[2]) > 10 && Math.min(s[0], s[2]) < 25)).length >= 3, near: segs.filter(s => Math.min(s[0], s[2]) <= 26 && Math.max(s[0], s[2]) >= 9 && Math.min(s[1], s[3]) <= 31 && Math.max(s[1], s[3]) >= 9), edges: [...w.edges.values()].filter(e => e.owner?.room === '{SID}').map(e => [e.key, e.kind, e.y]).slice(0, 30) }}; }})()")
        check(sl['inShrine'] == 0 and sl['onHill'] == 0 and sl['wallWest'], "sight: in the shrine and on the hilltop are one level (the ground's), and the shrine's walls block it", sl)

        print('OVERHANG: a room half off the hill\'s edge')
        OID = await gm.evaluate("tw.spawnRoom('storeroom', 6, 0, 4, 2, 7, undefined, 10)")
        ok = await wait(gm, f"!!tw.entities()['{OID}'] && tw.sync.pendingCount() === 0", 8000, 'overhang room')
        await settle(gm); await gm.wait_for_timeout(800)
        sup = await gm.evaluate(f"{W}.supports().filter(s => s.room === '{OID}')")
        check(ok and len(sup) >= 2 and any(s['kind'] == 'post' for s in sup), 'carried like a jetty: posts (and brackets) under the part off the hill', [ok, [(s['kind'], round(s['y'], 1)) for s in sup][:6]])
        far = await gm.evaluate("tw.spawnRoom('storeroom', 6, 3, 6, 2, 7, undefined, 10)"); await gm.wait_for_timeout(900)
        check(not await gm.evaluate(f"!!tw.entities()['{far}']"), 'more than 10 ft off the hill is refused (nothing floats)', await gm.evaluate("document.querySelector('#toast')?.textContent || ''"))
        await view(gm, 38, 8, 70, 40, 60, 6); await shot(gm, 'overhang')

        print('DUG IN: a room first, then a hill over its back (the room cut into the hillside)')
        DID = await gm.evaluate("tw.spawnRoom('storeroom', 18, 5, 3, 3, 5, undefined, 0)"); await wait(gm, f"!!tw.entities()['{DID}']", 6000)
        before = await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{DID}').length")
        H2 = await gm.evaluate("tw.spawnRoom('hill', 16, 0, 8, 7, 12, undefined, 10)")
        ok = await wait(gm, f"!!tw.entities()['{H2}'] && tw.sync.pendingCount() === 0", 8000, 'the hill over it')
        check(ok, 'a hill can be drawn over a ground room (rooms trump the hill)', await gm.evaluate("document.querySelector('#toast')?.textContent || ''"))
        hi = await gm.evaluate(HIGH(90, 25, 105, 40))
        check(hi <= 0.001, 'no earth inside the room (the ground there is its floor)', hi)
        out = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; const T = {W}.terrainField; return [T.heightAt(89.5, 27.5), T.heightAt(97.5, 24.5), T.heightAt(85, 30)].map(v => +v.toFixed(2)); }})()")
        check(all(abs(v - 10) < 0.01 for v in out[:2]), 'the hill comes right up to its walls\' outer face (the earth banked against them)', out)
        t2 = await gm.evaluate(f"({HILLTILES})('{H2}')")
        c2 = {tuple(t) for t in t2}
        check(len(c2) == 56 - 6 and not [t for t in c2 if 18 <= t[0] <= 20 and 5 <= t[1] <= 7], "the hill's grass is not drawn over the room", len(c2))
        d = await gm.evaluate(f"({DRAWN})('{DID}')")
        check(d['floor'] and abs(d['floor'][0]) < 0.05 and d['nWalls'] >= 8 and d['walls'][0] < 0.05, 'the room keeps its floor at the ground and its walls (below the hill top)', d)
        check(await gm.evaluate(f"Object.values(tw.entities()).filter(e => e.room === '{DID}').length") == before, 'nothing of the room was touched')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_hbpawn002', name: 'Pip', x: 97.5, z: 27.5, color: '#c58be0' })"); await wait(gm, "!!tw.entities()['tok_hbpawn002']", 6000); await gm.wait_for_timeout(600)
        b2 = await gm.evaluate(f"(async () => {{ const H = {HTJS}; const E = tw.entities(), w = {W}, t = E['tok_hbpawn002']; return {{ ...H.baseUnder(E, t.x, t.z, t.y || 0, (r) => w.isOpenRoom(r)), drawn: w.pawnBaseInfo('tok_hbpawn002').baseY }}; }})()")
        check(b2 and b2['room'] == DID and abs(b2['y']) < 0.05 and abs(b2['drawn']) < 0.05, 'a pawn inside stands on the room\'s floor, not on the hilltop above it', b2)
        sp = await scr(gm, 97.5, 27.5, 0)
        pt = await gm.evaluate(f"(() => {{ const r = tw.rayAt({sp['x']}, {sp['y']}); const p = {W}.floorPoint(r.ray, {{}}); return p && {{ y: p.y, room: p.room }}; }})()")
        check(pt and pt['room'] == DID and pt['y'] == 0, 'the pointer over it finds its floor, not the cut-away hill top', pt)
        await view(gm, 97, 28, 70, 50, 0, 4); await shot(gm, 'dug-in-room-first')

        print('DUG IN, the reverse: a hill first, a room dragged in from the open ground')
        await view(gm, 120, 18, 80, 72, 0, 3)
        await gm.evaluate("tw.modes.roomTool('storeroom')"); await gm.wait_for_timeout(250)
        a, b = await scr(gm, C(26), C(2), 0), await scr(gm, C(22), C(4), 0)
        mid = await mdrag(gm, a, b, peek=lambda: gm.evaluate(PEEK))
        check(mid['level'] == 0 and 'dug into the hill' in mid['label'], 'started on open ground: at the ground level, and the label says it digs into the hill', mid)
        ok = await wait(gm, "Object.values(tw.entities()).some(e => e.kind === 'room' && e.recipe.x === 22 && e.recipe.z === 2) && tw.sync.pendingCount() === 0", 12000, 'dug room')
        R2 = await gm.evaluate("Object.values(tw.entities()).find(e => e.kind === 'room' && e.recipe.x === 22 && e.recipe.z === 2)")
        check(ok and R2 and (R2['recipe'].get('y') or 0) == 0 and R2['recipe']['w'] == 5, 'the room is made at the ground, cutting into the hill\'s edge', R2 and R2['recipe'])
        R2ID = R2['id'] if R2 else ''
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Escape')
        hi = await gm.evaluate(HIGH(110, 10, 135, 25))
        check(hi <= 0.001, 'no earth inside it, where the hill and its bank were', hi)
        info = await gm.evaluate(TREADY)
        check(info['banks'] >= 1 and info['triangles'] > 30000 and info['dressing'] > 0, 'the banks are still drawn with the rooms cut into them (the two hills are one cluster: one mesh)', info)
        hi = await gm.evaluate(HIGH(90, 25, 105, 40)); c3 = {tuple(t) for t in await gm.evaluate(f"({HILLTILES})('{H2}')")}
        check(hi <= 0.001 and not [t for t in c3 if 18 <= t[0] <= 20 and 5 <= t[1] <= 7], 'and the first room is still clean (no earth, no hill grass over it) after the second', [hi, len(c3)])
        await view(gm, 118, 17, 75, 50, 35, 4); await shot(gm, 'dug-in-hill-first')
        await view(gm, 100, 22, 80, 50, 215, 4); await shot(gm, 'dug-in-both-from-north')
        await view(gm, 105, 20, 70, 86, 0, 2); await shot(gm, 'dug-in-both-top-down')

        print('FOLLOWS: move the room, undo, delete')
        b0 = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; return Array.from({W}.terrainField.fields.find(F => F.hills.some(h => h.id === '{H2}')).h); }})()")
        await gm.evaluate(f"tw.dispatch('room.move', {{ id: '{R2ID}', dx: 0, dz: 1 }})"); await wait(gm, f"tw.entities()['{R2ID}'].recipe.z === 3", 6000)
        moved = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; const T = {W}.terrainField; return [+T.heightAt(112.5, 12.5).toFixed(2), +T.heightAt(112.5, 27.5).toFixed(2)]; }})()")
        check(moved[0] > 0.5 and moved[1] < 0.001, 'moved a square south: the bank is back where it was, cut where it is', moved)
        await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{R2ID}'].recipe.z === 2", 6000)
        b1 = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; return Array.from({W}.terrainField.fields.find(F => F.hills.some(h => h.id === '{H2}')).h); }})()")
        check(b1 == b0, 'undo: the bank is exactly as it was, sample for sample', len(b0))
        await gm.evaluate(f"tw.dispatch('room.delete', {{ id: '{R2ID}' }})"); await wait(gm, f"!tw.entities()['{R2ID}']", 6000)
        hi = await gm.evaluate(HIGH(110, 15, 115, 20))
        check(hi > 0.5, 'deleted: the hill and its bank are whole there again', hi)
        await gm.keyboard.press('Control+z'); await wait(gm, f"!!tw.entities()['{R2ID}']", 6000)

        print('HEIGHT: raise the hill, the shrine rides along')
        r = await gm.evaluate(f"tw.setHillHeight(tw.entities()['{HID}'], 15)")
        ok = await wait(gm, f"tw.entities()['{HID}'].recipe.y === 15 && tw.entities()['{SID}'].recipe.y === 15 && tw.sync.pendingCount() === 0", 9000, 'raise')
        y = await gm.evaluate(f"[tw.entities()['{HID}'].recipe.y, tw.entities()['{SID}'].recipe.y, tw.entities()['tok_hbpawn001'].y, Object.values(tw.entities()).find(e => e.room === '{SID}' && /barrel/.test(e.cat || ''))?.y]")
        check(ok and y == [15, 15, 15, 15], 'Raise to 15 ft: the shrine, its barrel and the pawn in it rode up', y)
        await gm.keyboard.press('Escape'); await gm.keyboard.press('Control+z'); await wait(gm, f"tw.entities()['{HID}'].recipe.y === 10", 6000)
        y = await gm.evaluate(f"[tw.entities()['{HID}'].recipe.y, tw.entities()['{SID}'].recipe.y, tw.entities()['tok_hbpawn001'].y]")
        check(y == [10, 10, 10], 'one undo puts them all back', y)

        print('THE CUT (2026-10-26): one numbering for the map; the cut hides what covers the level you are on')
        UID = await gm.evaluate("tw.spawnRoom('guest', 2, 2, 3, 3, 31, undefined, 20)")
        ok = await wait(gm, f"!!tw.entities()['{UID}'] && tw.sync.pendingCount() === 0", 8000, "the shrine's upper storey")
        check(ok and await gm.evaluate(f"tw.entities()['{UID}'].building === tw.entities()['{SID}'].building"), 'a storey on the shrine (floor 20) joins its building', ok)
        TID = await gm.evaluate("tw.spawnRoom('storeroom', 18, 5, 3, 3, 32, undefined, 10)")
        ok = await wait(gm, f"!!tw.entities()['{TID}'] && tw.sync.pendingCount() === 0", 8000, 'a room on the hilltop over the dug-in room')
        await gm.evaluate("tw.dispatch('token.create', { id: 'tok_hbpawn003', name: 'Ada', x: 32.5, z: 32.5, y: 10, color: '#6ad4c8' })"); await wait(gm, "!!tw.entities()['tok_hbpawn003'] && tw.sync.pendingCount() === 0", 6000)
        await settle(gm)
        STATE = f"""(() => {{ const w = {W}, E = tw.entities(); w.cutPass?.(); const h = (id) => w.cutHides(E[id]), d = (id) => !!w.recs.get(id)?.group.visible;
          const tiles = [...w.shell.values()].filter(s => s.roomId === '{HID}' && s.spec.layer === 'floor' && !s.spec.takenBy), under = [...w.shell.values()].filter(s => s.roomId === '{HID}' && s.spec.layer === 'floor' && s.spec.takenBy); return {{ underDrawn: under.filter(s => s.group.visible).length, under: under.length, hill: h('{HID}'), shrine: h('{SID}'), upper: h('{UID}'), dug: h('{DID}'), over: h('{TID}'), pawnShrine: h('tok_hbpawn001'), pawnHill: h('tok_hbpawn003'), drawnHill: d('tok_hbpawn003'),
            barrel: Object.values(E).filter(e => e.room === '{HID}' && /barrel/.test(e.cat || '')).map(e => h(e.id)), tiles: tiles.filter(s => s.group.visible).length, tilesAll: tiles.length, text: tw.cutInfo().text, level: tw.level, cut: tw.cut.y }}; }})()"""
        await gm.evaluate("tw.select([]); tw.goLevel(0, 'test')"); await gm.wait_for_timeout(700)
        c1 = await gm.evaluate(STATE)
        check(c1['cut'] == 9 and c1['text'].startswith('lv 1'), 'lv 1 is cut at 9 ft', [c1['cut'], c1['text']])
        check(not c1['hill'] and c1['tiles'] == c1['tilesAll'] and not c1['pawnHill'] and c1['drawnHill'] and c1['barrel'] == [False], 'lv 1: the hill is not sliced; its top, the pawn and the barrel on it all show', c1)
        check(not c1['shrine'] and not c1['upper'] and not c1['pawnShrine'], "lv 1: the shrine on the hill shows WHOLE, its upper storey too (it covers only the hill's earth)", c1)
        check(not c1['dug'] and c1['over'], 'lv 1: the dug-in room shows, and the room on the hilltop over it is cut away (no lid over a room at your level)', c1)
        hi = await gm.evaluate(HIGH(91, 26, 104, 39))
        check(hi <= 0.001, 'lv 1: the earth over the dug-in room is open (no bank inside it)', hi)
        await view(gm, 30, 22, 110, 55, -25, 6); await shot(gm, 'cut-lv1-hill-shrine')
        await gm.evaluate(f"tw.select(['{SID}'])"); await gm.wait_for_timeout(300)
        m = await gm.evaluate("tw.meter().levels.filter(l => [20, 10, 0, -10].includes(l.y)).map(l => [l.y, l.label])")
        check(m == [[20, 'lv 3'], [10, 'lv 2'], [0, 'lv 1'], [-10, 'lv -1']], 'the meter, with the shrine in focus: the same labels as anywhere (10 ft is lv 2)', m)
        await gm.evaluate(f"tw.select([]); tw.cutToRoom(tw.entities()['{SID}'], 'test')"); await gm.wait_for_timeout(700)
        c2 = await gm.evaluate(STATE)
        check(c2['level'] == 10 and c2['cut'] == 19 and c2['text'].startswith('lv 2'), "going to the shrine's level (a double-click on it): lv 2, cut at 19 ft", [c2['level'], c2['cut'], c2['text']])
        check(not c2['shrine'] and c2['upper'] and not c2['pawnShrine'] and not c2['pawnHill'] and c2['tiles'] == c2['tilesAll'], "lv 2 (the hilltop's level): the shrine's upper storey hides over its ground storey; the hilltop and its pawn show", c2)
        check(not c2['over'] and not c2['dug'], 'lv 2: the room over the dug-in room shows (it is on this level)', c2)
        await view(gm, 30, 22, 110, 55, -25, 6); await shot(gm, 'cut-lv2-hilltop')
        await gm.evaluate("tw.goLevel(-10, 'test')"); await gm.wait_for_timeout(900)
        c3 = await gm.evaluate(STATE); hi3 = await gm.evaluate(HIGH(91, 26, 104, 39)); fm = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; return {W}.terrain.info(); }})()")
        check(c3['shrine'] and c3['upper'] and c3['under'] > 0 and c3['underDrawn'] == c3['under'] and c3['tiles'] == c3['tilesAll'], 'lv -1: the shrine is cut away and the hilltop is whole where it stood (its tiles drawn), not a hole', c3)
        check(c3['dug'] and abs(hi3 - 10) < 0.01, 'lv -1: the dug-in room is hidden and the hill is whole over it (the earth is the lid below the ground)', [c3['dug'], hi3])
        check(fm['fieldMs'] < 1000, 'the field was built again for that, once', fm)
        await gm.evaluate("tw.goLevel(0, 'test')"); await gm.wait_for_timeout(900)
        c4 = await gm.evaluate(STATE); hi4 = await gm.evaluate(HIGH(91, 26, 104, 39))
        check(c4['under'] > 0 and c4['underDrawn'] == 0 and hi4 <= 0.001, 'back on lv 1: the shrine and the dug-in room take the hill again (no tile under them, no earth in the dug-in room)', [c4['underDrawn'], c4['under'], hi4])
        await gm.evaluate(f"tw.batch([{{ type: 'room.delete', args: {{ id: '{TID}' }} }}, {{ type: 'token.delete', args: {{ id: 'tok_hbpawn003' }} }}])"); await wait(gm, "tw.sync.pendingCount() === 0", 6000)
        await gm.evaluate("tw.goLevel(0, 'test'); tw.cutOff('test')"); await gm.wait_for_timeout(300)

        print('SYNC: a player works out the same ground')
        link = await gm.evaluate("async () => tw.inviteLink(await tw.createSeat({ kind: 'human', role: 'player', name: 'Pat', color: '#67aadd' }))")
        if '#s=' in link:
            pl = await tab(link)
            await wait(pl, 'window.tw && tw.ready && tw.ready()', 90000, 'player ready')
            ok = await wait(pl, f"!!tw.entities()['{SID}'] && !!tw.entities()['{H2}']", 30000, 'player sees the rooms')
            SAMP = "[[17.5, 17.5], [97.5, 27.5], [89.5, 27.5], [97.5, 17.5], [115, 17.5], [42, 12], [60, 30]]"
            want = await gm.evaluate(f"(async () => {{ await {W}.terrain.ready; return {SAMP}.map(([x, z]) => +{W}.terrainField.heightAt(x, z).toFixed(3)); }})()")
            got = await pl.evaluate(f"(async () => {{ await {W}.terrain.ready; return {SAMP}.map(([x, z]) => +{W}.terrainField.heightAt(x, z).toFixed(3)); }})()") if ok else None
            check(ok and got == want, "a player's tab works out the same ground (the cuts included)", [got, want])
        else: check(False, 'an invite link for a player', 'no API found')

        print('ERRORS')
        bad = [x for x in errors if 'favicon' not in x and 'ERR_' not in x and '404' not in x]
        check(not bad, 'no page errors', bad[:5])
        await browser.close()
    for pr in procs: pr.terminate()
    n_ok = sum(1 for r in results if r[0]); print(f'\nbrowser_hillbuild: {n_ok}/{len(results)} passed')
    sys.exit(0 if n_ok == len(results) else 1)

asyncio.run(main())
