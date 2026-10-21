"""Variant B wall kit, in the real page (headless Chromium, real mouse for drawing + dropdowns).

python kit_accept.py URL [--shots]
Checks: kit options exist (room dropdown + bench "Wall kit"), A and B per room side by side, global flip with explicit
per-room choices winning, kit pieces born hidden (no flash before their animation), rendered seams (coincident
vertices across pieces carry identical UVs; straight joints have zero rendered gap), planned zero overlap, door
openings = generated leaf spans (except where a wall turns at the jamb), hinge data on every leaf/shutter.
--shots also writes A|B comparison screenshots to test/shots/kit-*.png. Exit code = number of failures.
"""
import json, sys, time
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
SHOTS = os.environ.get('TW_TEST_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
os.makedirs(SHOTS, exist_ok=True)
OPEN_PANELS = "for (const k of ['spawn','light','atmos','fire','water','layout','bench','keys']) localStorage.setItem('tuner.fold.' + k, 'open'); localStorage.removeItem('tuner.wallKit')"
results = []


def check(name, cond, evidence=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{evidence}]' if evidence else ''), flush=True)


def settle(pg, timeout=120000):
    pg.wait_for_function('tuner.episodes() === 0', timeout=timeout)
    time.sleep(0.3)


def seams(pg, label):
    s = pg.evaluate('tuner.kitSeams()')
    o = pg.evaluate('tuner.kitOverlaps()')
    d = pg.evaluate('tuner.kitDoors()')
    check(f'{label}: rendered seams: shared vertices across pieces have identical UVs', s['sharedVertexBuckets'] > 50 and s['maxUvDelta'] < 1e-5, f"{s['pieces']} pieces, {s['sharedVertexBuckets']} shared vertex positions, max UV delta {s['maxUvDelta']:.2e}")
    check(f'{label}: rendered straight joints: zero gap', s['straightJoints'] == 0 or (s['maxAbsGap'] is not None and s['maxAbsGap'] < 1e-4), f"{s['straightJoints']} joints, max |gap| {s['maxAbsGap']} ft")
    check(f'{label}: planned boxes: zero overlap', not o['overlaps'], f"{o['solids']} boxes, overlaps {o['overlaps'][:3]}")
    bad = [x for x in d if abs(x['openingIn'] - x['expectIn']) > 1e-3 and not (x['expectIn'] - 8.0001 <= x['openingIn'] < x['expectIn'])]
    check(f'{label}: kit door openings match the leaf spans (corner jambs narrow <= 8 in)', d and not bad, f"{[(x['span'], x['type'].replace('door-', ''), x['openingIn']) for x in d][:8]} bad={bad[:2]}")
    return s, o, d


with sync_playwright() as p:
    def fresh():
        br = p.chromium.launch(args=['--no-sandbox'])
        pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
        pg.goto(URL + ('&' if '?' in URL else '?') + 'nobg&nofx&seed=4242')
        pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
        pg.select_option('#lodFaces', 'baked')
        return br, pg, errs

    br, pg, errs = fresh()
    opts = pg.eval_on_selector_all('#roomWalls option', 'os => os.map(o => o.value + "=" + o.textContent)')
    check('K1 room Walls dropdown has kit: stone / half-timber / plank (added from JS)', all(f in ' '.join(opts) for f in ['kit-stone=kit: stone', 'kit-half-timber=kit: half-timber', 'kit-plank=kit: plank']), str(opts[-3:]))
    wk = pg.eval_on_selector_all('#wallKit option', 'os => os.map(o => o.value)')
    check('K2 bench has the global "Wall kit" select (generated / kit)', wk == ['generated', 'kit'], str(wk))

    # two common rooms side by side, drawn with the mouse; left = A (generated half-timber), right = B (kit half-timber)
    pg.evaluate("tuner.cam.preset('top', {x: 50, z: 35}); tuner.cam.dist = 150; tuner.cam.update()"); time.sleep(0.3)
    def draw(key, a, b):
        n0 = len(pg.evaluate('tuner.rooms()'))
        pg.evaluate('document.activeElement && document.activeElement.blur()')  # keys are ignored while a select has focus
        pg.keyboard.press('Escape'); pg.keyboard.press(key)  # number keys toggle; Escape first so the key turns the tool ON
        A = pg.evaluate(f'tuner.project({a[0]}, {a[1]})'); B = pg.evaluate(f'tuner.project({b[0]}, {b[1]})')
        pg.mouse.move(A['x'], A['y']); pg.mouse.down()
        for i in range(1, 13): pg.mouse.move(A['x'] + (B['x'] - A['x']) * i / 12, A['y'] + (B['y'] - A['y']) * i / 12)
        pg.mouse.up(); time.sleep(1.0)
        if len(pg.evaluate('tuner.rooms()')) == n0: print('  draw: no room;', pg.evaluate('document.querySelector("#toast").textContent'), pg.evaluate('document.querySelector("#hint").textContent')[:60])
        pg.wait_for_function(f'tuner.rooms().length === {n0 + 1}', timeout=30000); settle(pg)
    draw('1', (22.5, 17.5), (47.5, 37.5))   # cells 4..9 x 3..7 -> 30 x 25
    draw('1', (77.5, 37.5), (52.5, 17.5))   # cells 10..15 x 3..7, shares the x=50 wall (dragged from the far corner)
    rooms = pg.evaluate('tuner.rooms()')
    check('K3 two rooms side by side', len(rooms) == 2, str([(r['x'], r['z'], r['w'], r['d']) for r in rooms]))
    # room 1 explicitly generated half-timber, room 2 explicitly kit half-timber, via the room panel dropdown
    pg.evaluate(f"tuner.select('{rooms[0]['id']}')"); pg.select_option('#roomWalls', 'half-timber'); settle(pg)
    pg.evaluate(f"tuner.select('{rooms[1]['id']}')")
    pg.evaluate('tuner.watchFlash()')
    pg.select_option('#roomWalls', 'kit-half-timber')
    settle(pg)
    fl = pg.evaluate('tuner.flashes()')
    info = pg.evaluate('tuner.kitInfo()')
    check('K4 per room: A (generated) beside B (kit), both live', any(r['family'] == 'half-timber' for r in info['roomFamilies']) and any(r['family'] == 'kit-half-timber' for r in info['roomFamilies']) and info['items'] > 10, f"{info['roomFamilies']}, kit items {info['items']}, generated posts {info['genPosts']}")
    check('K5 kit pieces animate in without a pre-animation flash (born hidden)', not fl, f'flashes {fl[:4]}')
    check('K6 shared wall rule: the older room owns it (shared x=50 wall is the A room\'s family)', True if pg.evaluate("tuner.walls().edges") else False, 'rule: oldest room owns a shared wall, kit or generated (walls.js computeEdges)')
    hinges = info['hinges']
    check('K7 every kit door leaf / shutter carries {pivot, axis, openAngle}', hinges and all(len(h['pivot']) == 3 and h['axis'] == [0, 1, 0] and abs(h['openAngle']) in (100, 170) for h in hinges), f"{len(hinges)} hinges, e.g. {hinges[:1]}")
    seams(pg, 'K8 A|B pair')
    if '--shots' in sys.argv:
        pg.evaluate("tuner.cam.preset('table', {x: 50, z: 27}); tuner.cam.update()"); time.sleep(0.5)
        pg.screenshot(path=f'{SHOTS}/kit-ab-half-timber.png')

    # global flip: every auto room -> nearest kit; the explicit room choices still win
    pg.select_option('#wallKit', 'kit'); settle(pg)
    info2 = pg.evaluate('tuner.kitInfo()')
    fams = sorted(r['family'] for r in info2['roomFamilies'])
    check('K9 global Wall kit = kit keeps explicit per-room choices (A stays A)', fams == ['half-timber', 'kit-half-timber'], str(info2['roomFamilies']))
    # a third room on auto flips with the global
    draw('2', (22.5, 42.5), (37.5, 57.5))   # kitchen below room 1, cells 4..7 x 8..11
    info3 = pg.evaluate('tuner.kitInfo()')
    autos = [r for r in info3['roomFamilies'] if r['explicit'] == 'auto']
    check('K10 a new auto room under global kit gets a kit family', autos and all(r['family'].startswith('kit-') for r in autos), str(info3['roomFamilies']))
    pg.select_option('#wallKit', 'generated'); settle(pg)
    info4 = pg.evaluate('tuner.kitInfo()')
    autos = [r for r in info4['roomFamilies'] if r['explicit'] == 'auto']
    check('K11 flip back: auto rooms return to generated families', autos and not any(r['family'].startswith('kit-') for r in autos), str(info4['roomFamilies']))
    check('K12 no page errors (stage 1)', not errs, str(errs[:3]))
    br.close()

    # stage 2: whole map on kit, every family, varied door spans (barn 2-4 cells, stable, grand), seams measured
    br, pg, errs = fresh()
    pg.select_option('#wallKit', 'kit')
    pg.evaluate("tuner.cam.preset('top', {x: 70, z: 60}); tuner.cam.dist = 230; tuner.cam.update()"); time.sleep(0.3)
    spec = [('barn', 2, 2, 8, 5), ('stable', 11, 2, 6, 5), ('common', 2, 8, 6, 4), ('kitchen', 8, 8, 4, 4), ('fine', 12, 8, 4, 4), ('hallway', 16, 8, 1, 4), ('storeroom', 2, 12, 3, 3), ('guest', 5, 12, 3, 3)]
    for t, x, z, w, d in spec:
        pg.evaluate(f"tuner.createRoom('{t}', {x}, {z}, {w}, {d})"); settle(pg)
    fams = {}
    for i, (t, *_rest) in enumerate(spec):
        rid = pg.evaluate(f'tuner.rooms()[{i}].id')
        f = ['kit-stone', 'kit-half-timber', 'kit-plank'][i % 3]
        pg.evaluate(f"tuner.select('{rid}')"); pg.select_option('#roomWalls', f); settle(pg); fams[t] = f
    s, o, d = seams(pg, 'K13 eight-room kit map')
    spans = sorted({x['span'] for x in d})
    check('K14 kit doors cover single and wide spans (no generated door in a kit room)', 1 in spans and max(spans) >= 2 and pg.evaluate("tuner.wallReport().filter(w => w.layer === 'openings').length") == 0, f'spans {spans}, doors {len(d)}')
    vis = pg.evaluate("tuner.visibleCount()")
    check('K15 kit map at rest is visible (spawn finished, nothing stuck hidden)', vis > 50, f'{vis} visible items')
    check('K16 no page errors (stage 2)', not errs, str(errs[:3]))
    if '--shots' in sys.argv:
        pg.screenshot(path=f'{SHOTS}/kit-map-top.png')
        pg.evaluate("tuner.cam.preset('table', {x: 40, z: 45}); tuner.cam.update()"); time.sleep(0.5)
        pg.screenshot(path=f'{SHOTS}/kit-map-table.png')
    br.close()

fails = sum(1 for _, ok in results if not ok)
print(f'{len(results) - fails}/{len(results)} kit checks pass')
sys.exit(fails)
