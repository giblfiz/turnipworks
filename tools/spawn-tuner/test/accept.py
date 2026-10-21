"""Spawn Tuner acceptance tests: real mouse/keyboard input in headless Chromium.

python accept.py URL [--writeback]     (writeback POSTs a test preset + layout to the live API, then they are tagged)
Each check prints PASS/FAIL with the measured evidence. Exit code = number of failures.
"""
# panels start folded; the tests drive every control, so open them all
OPEN_PANELS = "for (const k of ['spawn','light','atmos','fire','water','layout','bench','keys']) localStorage.setItem('tuner.fold.' + k, 'open')"
import json
import math
import sys
import time

import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
WRITEBACK = '--writeback' in sys.argv
SHOTS = os.environ.get('TW_TEST_SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots'))
os.makedirs(SHOTS, exist_ok=True)
results = []


def check(name, cond, evidence=''):
    results.append((name, bool(cond)))
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{evidence}]' if evidence else ''), flush=True)


def settle(pg, timeout=90000):
    pg.wait_for_function('tuner.episodes() === 0', timeout=timeout)
    time.sleep(0.2)


def stable_stats(pg, timeout=90000):
    """Observe three freshly rendered bench samples, rather than a wall-clock sleep."""
    deadline = time.monotonic() + timeout / 1000
    last, stable = None, 0
    while time.monotonic() < deadline:
        pg.evaluate('window.__acceptPreviousStats = tuner.stats()')
        pg.wait_for_function('tuner.stats() !== window.__acceptPreviousStats', timeout=max(1, int((deadline - time.monotonic()) * 1000)))
        stats = pg.evaluate('tuner.stats()')
        state = tuple(stats.get(k) for k in ('triangles', 'draw_calls', 'lod', 'geo_mb', 'tex_mb_loaded_est', 'stress_copies'))
        stable = stable + 1 if state == last else 1
        if stable >= 3: return stats
        last = state
    raise AssertionError('bench measurements never stabilized after scene/ladder change')


def drag(pg, a, b, steps=12, button='left', modifiers=None):
    pg.mouse.move(a['x'], a['y'])
    if modifiers:
        for m in modifiers: pg.keyboard.down(m)
    pg.mouse.down(button=button)
    for i in range(1, steps + 1):
        pg.mouse.move(a['x'] + (b['x'] - a['x']) * i / steps, a['y'] + (b['y'] - a['y']) * i / steps)
    pg.mouse.up(button=button)
    if modifiers:
        for m in modifiers: pg.keyboard.up(m)


with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    pg.goto(URL)
    pg.wait_for_selector('body[data-ready="1"]', timeout=60000)

    # A1 load
    catalog_keys = pg.evaluate("fetch('data/rooms.json').then(r => r.json()).then(a => a.map(t => t.key))")
    palette_keys = pg.locator('#palette button[data-type]').evaluate_all('buttons => buttons.map(b => b.dataset.type)')
    check('A1 page loads with exactly the catalog room types in the palette, no errors', sorted(palette_keys) == sorted(catalog_keys) and not errors, f'{len(palette_keys)}/{len(catalog_keys)} types, errors={errors[:2]}')
    pn = pg.evaluate('tuner.preset().name'); psw = pg.evaluate('tuner.preset().in.choreo.sweep')
    check('A1b default preset is harry-v2 (built-ins harry-v1, fauna-default-v1 still loadable)', pn == 'harry-v2' and psw == 'N' and pg.locator('#loadPreset option[value="builtin:fauna-default-v1"]').count() == 1, f'{pn}, sweep {psw}')
    pg.select_option('#lodFaces', 'baked')  # headless memory: only the A19/A23 stage exercises the 10k default
    pg.evaluate("tuner.cam.preset('top', {x: 45, z: 35}); tuner.cam.dist = 120; tuner.cam.update()")
    time.sleep(0.3)

    # A2 draw a common room with the mouse: key 1, drag from cell (4,3) to (9,6) -> 30x20 ft
    pg.keyboard.press('1')
    a = pg.evaluate('tuner.project(4*5+2.5, 3*5+2.5)'); b = pg.evaluate('tuner.project(9*5+2.5, 6*5+2.5)')
    drag(pg, a, b)
    pg.wait_for_function('tuner.rooms().length === 1', timeout=90000); settle(pg)
    r = pg.evaluate('tuner.rooms()[0]')
    check('A2 drag draws a snapped 30x20 common room and fills it', (r['x'], r['z'], r['w'], r['d']) == (4, 3, 6, 4) and r['n'] > 20, f"rect {r['x']},{r['z']} {r['w']}x{r['d']}, {r['n']} objects")
    summary = pg.locator('#summary').inner_text()
    check('A2b readable layout summary shown', 'Common room 30×20 ft' in summary and 'Doors:' in summary, summary.splitlines()[0])
    pg.screenshot(path=f'{SHOTS}/accept-a2.png')

    # A3 adjacent kitchen east of it: key 2, drag (10,3)-(13,5) -> shares the E wall, gets a connecting door
    pg.keyboard.press('2')
    a = pg.evaluate('tuner.project(10*5+2.5, 3*5+2.5)'); b = pg.evaluate('tuner.project(13*5+2.5, 5*5+2.5)')
    drag(pg, a, b)
    pg.wait_for_function('tuner.rooms().length === 2', timeout=90000); settle(pg)
    rooms = pg.evaluate('tuner.rooms()')
    walls = pg.evaluate('tuner.walls()')
    # unique perimeter edges: 6x4 room = 20, 4x3 = 14, shared run = 3 -> 31
    k_ops = [o for o in rooms[1]['openings'] if o['kind'] == 'door' and o['to'] == rooms[0]['id']]
    check('A3 adjacent room shares its wall (no doubled segments)', walls['edges'] == 31, f"{walls['edges']} wall segments (expect 31)")
    check('A3b a connecting door sits on the shared wall', len(k_ops) == 1, json.dumps(k_ops))
    pg.screenshot(path=f'{SHOTS}/accept-a3.png')

    # A3c overlapping drag is refused with a message
    pg.keyboard.press('3')
    a = pg.evaluate('tuner.project(5*5+2.5, 4*5+2.5)'); b = pg.evaluate('tuner.project(7*5+2.5, 5*5+2.5)')
    drag(pg, a, b); time.sleep(0.5)
    toast = pg.locator('#toast').inner_text()
    check('A3c overlapping room refused with a reason', len(pg.evaluate('tuner.rooms()')) == 2 and 'overlap' in toast, toast)
    pg.keyboard.press('Escape')

    # A4 select by clicking (no tool), roll again changes the seed and the layout
    c = pg.evaluate('tuner.project(32, 26)')
    pg.mouse.click(c['x'], c['y']); time.sleep(0.3)
    sel_visible = pg.locator('#roomInfo').is_visible()
    seed0 = pg.evaluate('tuner.rooms()[0].seed'); sum0 = pg.locator('#summary').inner_text()
    check('A4 clicking a room selects it (inspector shows)', sel_visible and 'Common room' in sum0)
    pg.click('#roll'); settle(pg)
    seed1 = pg.evaluate('tuner.rooms()[0].seed'); sum1 = pg.locator('#summary').inner_text()
    check('A4b Roll again: new seed, new layout', seed1 != seed0 and sum1 != sum0, f'seed {seed0} -> {seed1}')

    # A4c lock: shift-click the fireplace (find it by projecting its placement), roll, it stays
    fp = pg.evaluate("(() => { const L = tuner.layoutOf(tuner.rooms()[0].id); const p = L.placements.find(p => p.id === 'fireplace-wall'); return p && {x: p.x, z: p.z, y: p.dims[1] / 2, uid: p.uid}; })()")
    if fp:
        pt = pg.evaluate(f"tuner.project3({fp['x']}, {fp['y']}, {fp['z']})")
        pg.keyboard.down('Shift'); pg.mouse.click(pt['x'], pt['y']); pg.keyboard.up('Shift'); time.sleep(0.3)
        locked = pg.evaluate("tuner.lockedOf(tuner.rooms()[0].id)")
        pg.click('#roll'); settle(pg)
        after = pg.evaluate("(() => { const L = tuner.layoutOf(tuner.rooms()[0].id); return L.placements.filter(p => p.id === 'fireplace-wall').map(p => [p.x, p.z, !!p.locked]); })()")
        check('A4c shift-click locks an object; it survives Roll again', fp['uid'] in locked and [fp['x'], fp['z'], True] in after, f'locked={locked} after={after}')
    else:
        check('A4c lock (no fireplace placed this seed)', False, 'no fireplace')

    # A5 delete the kitchen: room count drops, its objects go, the shared wall stays for the common room
    k = pg.evaluate('tuner.project(57, 22)')
    pg.mouse.click(k['x'], k['y']); time.sleep(0.3)
    items_before = pg.evaluate('tuner.items()')
    pg.click('#deleteRoom'); settle(pg); time.sleep(0.5)
    walls = pg.evaluate('tuner.walls()')
    check('A5 Delete room plays out and removes it; common room keeps a closed shell', len(pg.evaluate('tuner.rooms()')) == 1 and walls['edges'] == 20 and pg.evaluate('tuner.items()') < items_before,
          f"rooms={len(pg.evaluate('tuner.rooms()'))} edges={walls['edges']} items {items_before}->{pg.evaluate('tuner.items()')}")

    # A6 camera: grab-the-world. Left-drag with no tool keeps the grabbed ground point under the cursor.
    pg.keyboard.press('Escape')
    pg.evaluate("tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()"); time.sleep(0.2)
    s0, s1 = {'x': 700, 'y': 520}, {'x': 900, 'y': 430}
    g0 = pg.evaluate(f"tuner.cam.groundAt({s0['x']}, {s0['y']}).toArray()")
    yaw0, pit0 = pg.evaluate('tuner.cam.yaw'), pg.evaluate('tuner.cam.pitch')
    drag(pg, s0, s1, steps=20)
    g1 = pg.evaluate(f"tuner.cam.groundAt({s1['x']}, {s1['y']}).toArray()")
    err = ((g0[0] - g1[0]) ** 2 + (g0[2] - g1[2]) ** 2) ** 0.5
    check('A6 left-drag pans: the grabbed point stays under the cursor, view angle unchanged', err < 0.3 and abs(pg.evaluate('tuner.cam.yaw') - yaw0) < 0.01, f'pin error {err:.3f} ft')
    g0 = pg.evaluate("tuner.cam.groundAt(700, 500).toArray()")
    drag(pg, {'x': 700, 'y': 500}, {'x': 820, 'y': 440}, steps=20, button='middle')
    g1 = pg.evaluate("tuner.cam.groundAt(820, 440).toArray()")
    err = ((g0[0] - g1[0]) ** 2 + (g0[2] - g1[2]) ** 2) ** 0.5
    yaw1, pit1 = pg.evaluate('tuner.cam.yaw'), pg.evaluate('tuner.cam.pitch')
    check('A6e middle-drag orbits freely (yaw AND pitch) around the grabbed point', abs(yaw1 - yaw0) > 10 and abs(pit1 - pit0) > 5 and err < 0.3, f'yaw {yaw0:.0f}->{yaw1:.0f}, pitch {pit0:.0f}->{pit1:.0f}, pin error {err:.3f} ft')
    drag(pg, {'x': 700, 'y': 300}, {'x': 700, 'y': 900}, steps=20, button='middle')
    check('A6f orbit never goes under the floor', pg.evaluate('tuner.cam.pitch') >= 6 and pg.evaluate('tuner.cam.camera.position.y') > 0, f"pitch {pg.evaluate('tuner.cam.pitch'):.1f}")
    pg.evaluate("tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()"); yaw0 = pg.evaluate('tuner.cam.yaw')
    g0 = pg.evaluate("tuner.cam.groundAt(800, 400).toArray()")
    drag(pg, {'x': 800, 'y': 400}, {'x': 650, 'y': 500}, button='right')
    g1 = pg.evaluate("tuner.cam.groundAt(650, 500).toArray()")
    err = ((g0[0] - g1[0]) ** 2 + (g0[2] - g1[2]) ** 2) ** 0.5
    check('A6b right-drag pans with the point pinned', err < 0.3, f'pin error {err:.3f} ft')
    g0 = pg.evaluate("tuner.cam.groundAt(600, 600).toArray()"); d0 = pg.evaluate('tuner.cam.dist')
    pg.mouse.move(600, 600)
    for _ in range(3): pg.mouse.wheel(0, -100); time.sleep(0.05)
    g1 = pg.evaluate("tuner.cam.groundAt(600, 600).toArray()"); d1 = pg.evaluate('tuner.cam.dist')
    err = ((g0[0] - g1[0]) ** 2 + (g0[2] - g1[2]) ** 2) ** 0.5
    check('A6c wheel zooms x0.9/notch toward the cursor', abs(d1 / d0 - 0.729) < 0.01 and err < 0.3, f'dist ratio {d1 / d0:.3f}, pin error {err:.3f} ft')
    pg.keyboard.down('q'); time.sleep(0.4); pg.keyboard.up('q')
    yaw0 = yaw0
    check('A6d Q turns the view', abs(pg.evaluate('tuner.cam.yaw') - yaw0) > 5)

    # fresh browser for the dials/playback stage (headless software GL is fragile across long sessions)
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    pg.evaluate("tuner.select(tuner.rooms()[0].id); tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()"); time.sleep(0.3)

    # A7 a dial change updates the preset, persists, and replays
    pg.select_option('select[data-path="in.choreo.sweep"]', 'E')
    time.sleep(0.6)
    sweep = pg.evaluate('tuner.preset().in.choreo.sweep')
    stored = pg.evaluate("JSON.parse(localStorage.getItem('tuner.current.v2')).in.choreo.sweep")
    check('A7 dial change: preset updates, persists, replays', sweep == 'E' and stored == 'E' and pg.evaluate('tuner.episodes()') > 0, f'sweep={sweep} stored={stored}')
    settle(pg)
    # waves really sweep from the east: the first floor tile to land is on the east edge
    first = pg.evaluate("tuner.firstLanded('floor')")
    check('A7b sweep "E" lands east tiles first', first and first[0] >= 45, f'first floor tile at x={first and first[0]}')

    # A8 A/B
    spin0 = pg.evaluate('tuner.preset().in.objects.spin')
    pg.click('#storeA')
    pg.fill('input[data-path="in.objects.spin"]', '360') if False else pg.evaluate("(() => { const i = document.querySelector('input[data-path=\"in.objects.spin\"]'); i.value = 360; i.dispatchEvent(new Event('input')); })()")
    pg.click('#storeB')
    pg.keyboard.press('b'); time.sleep(0.2); s_a = pg.evaluate('tuner.preset().in.objects.spin')
    pg.keyboard.press('b'); time.sleep(0.2); s_b = pg.evaluate('tuner.preset().in.objects.spin')
    check('A8 A/B toggle swaps whole presets', {s_a, s_b} == {spin0, 360}, f'spin {s_a} / {s_b}')
    settle(pg)

    # A9 scrub
    pg.click('#replay'); time.sleep(0.1)
    vis = []
    for v in (0, 250, 500, 750, 1000):
        pg.evaluate(f"(() => {{ const s = document.querySelector('#scrub'); s.value = {v}; s.dispatchEvent(new Event('input')); }})()")
        time.sleep(0.05); vis.append(pg.evaluate('tuner.visibleCount()'))
    check('A9 scrub pauses and steps through the arrival', vis == sorted(vis) and vis[0] < vis[-1], f'visible {vis}')
    pg.click('#pause'); settle(pg)

    br.close(); br = p.chromium.launch(args=['--no-sandbox'])  # fresh stage for A16-A18
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    pg.evaluate("tuner.select(tuner.rooms()[0].id)")

    # A16 no flash: nothing shows before its own spawn animation (Harry: walls/floor flashed before warping in)
    pg.evaluate("tuner.watchFlash()")
    pg.evaluate("void tuner.createRoom('guest', 4, 8, 3, 3)"); settle(pg)
    pg.evaluate("void tuner.rollRoom()"); settle(pg)
    fl = pg.evaluate("tuner.flashes()")
    check('A16 no flash: nothing visible before its spawn animation (create + roll)', not fl, f'{len(fl)} flashed: {fl[:5]}')

    # A17 camera-side walls arrive last (and leave first on the way out)
    pg.evaluate("tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()")
    pg.evaluate("tuner.select(tuner.rooms()[0].id)"); pg.evaluate("void tuner.replay('in')"); time.sleep(0.2)
    ll = pg.evaluate("tuner.lastLanded()")
    others = max(v for k, v in ll.items() if k != 'walls-near')
    first_near = pg.evaluate("Math.min(...tuner.nearDelays())")
    check('A17 camera-side walls land after everything else', 'walls-near' in ll and first_near > others - 1, f"near walls start {first_near:.0f} ms, everything else done starting by {others:.0f} ms")
    settle(pg)
    lay = pg.evaluate("tuner.rooms().map(r => tuner.layoutOf(r.id).placements.filter(p => p.id === 'bench-long' && p.side).map(p => [p.side, p.dims[0], p.dims[2], Math.round(p.rot * 57.3)])).flat()")
    pg.evaluate("void tuner.createRoom('hallway', 4, 12, 6, 2)"); settle(pg)
    lay += pg.evaluate("tuner.layoutOf(tuner.rooms().at(-1).id).placements.filter(p => p.id === 'bench-long' && p.side).map(p => [p.side, p.dims[0], p.dims[2], Math.round(p.rot * 57.3)])")
    check('A18 benches against a wall: long side along the wall', all(w >= d for _, w, d, _ in lay), f'{len(lay)} wall benches (w,d): {[(round(w,1), round(d,1)) for _, w, d, _ in lay][:6]}')

    # fresh browser for the bench + GPU section (headless software GL runs out of GPU memory in one long session)
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')  # bench checks at the shipping tier (headless memory); A19/A23 test the dials
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    pg.evaluate("tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()"); time.sleep(0.3)

    # A10 bench toggles
    time.sleep(0.8); st0 = pg.evaluate('tuner.stats()')
    pg.check('#cubes'); time.sleep(1.0); st1 = pg.evaluate('tuner.stats()')
    check('A10 cube swap keeps every object, drops triangles', st1['objects'] == st0['objects'] and st1['triangles'] < st0['triangles'] / 5, f"tris {st0['triangles']} -> {st1['triangles']}")
    pg.screenshot(path=f'{SHOTS}/accept-cubes.png')
    pg.uncheck('#cubes'); time.sleep(1.0)
    v0 = pg.evaluate('tuner.visibleCount()'); pg.uncheck('#walls'); time.sleep(0.3); v1 = pg.evaluate('tuner.visibleCount()'); pg.check('#walls'); time.sleep(0.3); v2 = pg.evaluate('tuner.visibleCount()')
    check('A10b walls toggle (cut-away) hides and restores walls', v1 < v0 and v2 == v0, f'visible {v0} -> {v1} -> {v2}')
    pg.check('#sizeBoxes'); pg.check('#occupancy'); time.sleep(0.5)
    pg.screenshot(path=f'{SHOTS}/accept-bench.png')
    pg.uncheck('#sizeBoxes'); pg.uncheck('#occupancy')
    time.sleep(0.7)  # the old Fire lights checkbox is retired: the Fire FX attaches lights to fire sources by itself
    check('A10c fire lights attach to fire sources', pg.evaluate('tuner.stats()').get('lights', 0) > 0, f"{pg.evaluate('tuner.stats()').get('lights')} lights")

    # A11 measures geometry draw work, independently of the tuner's growing
    # post-processing stack (shadow passes update on different frames).
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    plain_url = URL + ('&' if '?' in URL else '?') + 'nofx'
    pg.goto(plain_url); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    pg.evaluate('tuner.select(tuner.rooms()[0].id)')
    camera0 = pg.evaluate('({focus:tuner.cam.focus.toArray(), yaw:tuner.cam.yaw, pitch:tuner.cam.pitch, dist:tuner.cam.dist})')
    dc0 = stable_stats(pg)['draw_calls']
    pg.click('#stress'); stressed = stable_stats(pg); dc1 = stressed['draw_calls']
    pg.click('#clearStress')
    pg.evaluate('(c) => {tuner.cam.focus.fromArray(c.focus); Object.assign(tuner.cam, {yaw:c.yaw,pitch:c.pitch,dist:c.dist}); tuner.cam.update();}', camera0)
    cleared = stable_stats(pg)
    check('A11 stress x4 multiplies draw calls; clear restores', dc1 > dc0 * 2.5 and stressed['stress_copies'] == 4 and cleared['stress_copies'] == 0 and cleared['draw_calls'] == dc0,
          f"plain draw calls {dc0} -> {dc1} -> {cleared['draw_calls']}; copies {stressed['stress_copies']} -> {cleared['stress_copies']}")

    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(plain_url); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    pg.evaluate("tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()")
    # A19 faces & skins dials: default is 10k (Harry 2026-10-01); real geometry/texture ladder; restores
    b10 = stable_stats(pg)
    pg.select_option('#lodFaces', 'baked'); pg.wait_for_function("document.querySelector('#loading').hidden", timeout=180000); time.sleep(1.0)
    b0 = stable_stats(pg)
    check('A23 faces default to 10k: triangles well above the shipping tier', pg.evaluate("document.querySelector('#lodFaces').options[document.querySelector('#lodFaces').selectedIndex].value") == 'baked' and b10['lod'].startswith('10000') and b10['triangles'] > 1.6 * b0['triangles'],
          f"default {b10['lod']} {b10['triangles']} tris vs shipping {b0['triangles']}")
    pg.select_option('#lodFaces', 'full'); pg.wait_for_function("document.querySelector('#loading').hidden", timeout=180000); time.sleep(1.0)
    b1 = stable_stats(pg)
    pg.select_option('#lodTex', '1024'); pg.wait_for_function("document.querySelector('#loading').hidden", timeout=180000); time.sleep(1.0)
    b2 = stable_stats(pg)
    pg.screenshot(path=f'{SHOTS}/accept-lod-full.png')
    pg.select_option('#lodFaces', '10000'); pg.select_option('#lodTex', 'baked'); pg.wait_for_function("document.querySelector('#loading').hidden", timeout=180000); time.sleep(1.0)
    b3 = stable_stats(pg)
    check('A19 faces & skins dials load the GPU and restore', b1['triangles'] > 4 * b0['triangles'] and b2['tex_mb_loaded_est'] > 8 * b1['tex_mb_loaded_est'] and abs(b3['triangles'] - b10['triangles']) < 0.02 * b10['triangles'],
          f"tris shipping {b0['triangles']} -> full {b1['triangles']} -> back to 10k {b3['triangles']} (was {b10['triangles']}); tex MB {b1['tex_mb_loaded_est']} -> {b2['tex_mb_loaded_est']}; geo MB {b0['geo_mb']} -> {b1['geo_mb']}")

    # A13 FPS readout
    st = pg.evaluate('tuner.stats()')
    check('A13 bench reports fps, draw calls, triangles, texture memory', st['fps'] > 0 and st['draw_calls'] > 0 and st['tex_mb_loaded_est'] > 0, json.dumps({k: st[k] for k in ('fps', 'draw_calls', 'triangles', 'tex_mb_loaded_est')}))

    # A12 write-back (live API only)
    if WRITEBACK:
        pg.fill('#presetName', 'acceptance-test')
        pg.click('#sendPreset'); time.sleep(1.5)
        t1 = pg.locator('#toast').inner_text()
        c = pg.evaluate('tuner.project(32, 26)'); pg.mouse.click(c['x'], c['y']); time.sleep(0.3)
        pg.fill('#layoutNote', 'acceptance test (Fauna) - ignore')
        pg.click('#sendLayout'); time.sleep(1.5)
        t2 = pg.locator('#toast').inner_text()
        check('A12 Send preset / Send room+note reach Fauna', ('sent preset' in t1 or 'to Fauna' in t1) and 'sent layout' in t2, f'{t1} | {t2}')

    # A20 ratings filter (Harry 2026-10-01): nothing on screen is masking-flagged or under 3 stars, walls included
    bad = pg.evaluate('tuner.filteredInScene()')
    check('A20 no masking-flagged or <3-star mesh rendered (default filter)', not bad, f'{bad}')

    # A24 click-select: 3-letter tags, unique, stable across a reload with the same ?seed, present in the layout JSON
    import re as _re
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    tags1 = {(t['uid'], t['id']): t['tag'] for t in pg.evaluate('tuner.tags()')}
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    tl = pg.evaluate('tuner.tags()')
    tags2 = {(t['uid'], t['id']): t['tag'] for t in tl}
    check('A24 every object has a unique 3-letter tag, stable across a reload (same seed)', tags1 == tags2 and len(tl) > 40 and len({t['tag'] for t in tl}) == len(tl) and all(_re.fullmatch('[A-Z]{3}', t['tag']) for t in tl),
          f"{len(tl)} tags, {len({t['tag'] for t in tl})} unique, same after reload: {tags1 == tags2}")
    pg.evaluate("tuner.cam.preset('home', {x: 35, z: 25}); tuner.cam.update()"); time.sleep(0.4)
    fp = [t for t in tl if t['id'] == 'fireplace-wall' or t['id'] == 'back-bar-shelves']
    hit = None
    for t in fp + [t for t in tl if t['layer'] == 'walls']:
        pt = pg.evaluate(f"tuner.project3({t['x']}, {t['y'] + t['h'] * 0.5}, {t['z']})")
        pg.mouse.click(pt['x'], pt['y']); time.sleep(0.3)
        if pg.evaluate('tuner.selectedTag()') == t['tag']: hit = t; break
    info = pg.locator('#objInfo').inner_text() if hit else ''
    check('A24b plain click selects the object: panel shows its tag and placement', hit and pg.locator('#objPanel').is_visible() and pg.locator('#objTag').inner_text() == hit['tag'] and hit['id'] in info,
          f"clicked {hit and hit['id']} -> {pg.evaluate('tuner.selectedTag()')}; {info.splitlines()[:2]}")
    js = json.loads(pg.locator('#json').inner_text())
    check('A24c tags are in the layout JSON', all(_re.fullmatch('[A-Z]{3}', q.get('tag') or '') for q in js['placements']), f"{sum(1 for q in js['placements'] if q.get('tag'))}/{len(js['placements'])} placements tagged")
    pg.keyboard.press('Escape'); time.sleep(0.2)
    check('A24d Esc clears the object selection', pg.evaluate('tuner.selectedTag()') is None and not pg.locator('#objPanel').is_visible())
    pg.evaluate("tuner.rooms().forEach(r => tuner.deleteRoom(r.id))"); settle(pg)

    # A14 every room type spawns without errors and reports itself
    br.close()  # fresh browser process: headless software GL's shared GPU process runs out of memory after a long session
    br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')  # room-type coverage at the shipping tier (headless memory)
    # Every catalog room gets its catalog footprint. Keep the original four
    # families together (the previous multi-room regression), then bounded
    # cohorts for later families so registry growth cannot exhaust a GL context.
    room_types = pg.evaluate("fetch('data/rooms.json').then(r => r.json())")
    legacy_groups = {None, 'Crypt', 'Castle', 'Mansion'}
    legacy = [t for t in room_types if t.get('group') in legacy_groups]
    groups = {}
    for t in room_types:
        if t.get('group') not in legacy_groups: groups.setdefault(t.get('group'), []).append(t)
    cohorts = [legacy, *groups.values()]
    made, filtered, tag_errors, count_errors, all_doors = [], [], [], [], []
    legacy_keys = {t['key'] for t in legacy}
    for cohort_index, cohort in enumerate(cohorts):
        if cohort_index:
            br.close(); br = p.chromium.launch(args=['--no-sandbox'])
            pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
            pg.select_option('#lodFaces', 'baked')
        # The catalog stage checks completed geometry; the earlier stages cover
        # shipping-speed animation ordering. Use the supported 2x speed here.
        pg.locator('#speed').focus(); pg.keyboard.press('End')
        columns = max(1, math.ceil(len(cohort) ** 0.5))
        step_x = max(t['cells'][0] for t in cohort) + 2
        step_z = max(t['cells'][1] for t in cohort) + 2
        for index, t in enumerate(cohort):
            x, z = 2 + index % columns * step_x, 2 + index // columns * step_z
            pg.evaluate('(a) => tuner.createRoom(...a)', [t['key'], x, z, *t['cells']]); settle(pg)
            r = pg.evaluate('tuner.rooms().at(-1)')
            # Room.n is solver placements; tags also include its walls/floor.
            placement_tags = pg.evaluate('(id) => {const tags = new Set(tuner.tags().map(t => t.tag)); return tuner.layoutOf(id).placements.every(p => p.tag && tags.has(p.tag));}', r['id'])
            if not placement_tags: count_errors.append(t['key'])
            made.append((t['key'], r['n'], r['unplaced']))
            print(f"  catalog room {len(made)}/{len(room_types)}: {t['key']} {r['n']} placements", flush=True)
        filtered.extend(pg.evaluate('tuner.filteredInScene()'))
        tags = pg.evaluate('tuner.tags()')
        if len({t['tag'] for t in tags}) != len(tags): tag_errors.append(cohort_index)
        all_doors.extend(pg.evaluate('tuner.doors()'))
        if cohort_index == 0:
            pg.evaluate("tuner.cam.preset('home', {x: 115, z: 110}); tuner.cam.dist = 210; tuner.cam.update()")
            pg.screenshot(path=f'{SHOTS}/accept-all-types.png')
    def minimum_fill(key):
        if key == 'privy': return 4
        if key in ('yard', 'castle-passage', 'mansion-corridor', 'crypt-passage'): return 3
        return 8 if key in legacy_keys else 1
    check('A14 every catalog room spawns at its declared footprint and every placement is rendered', len(made) == len(room_types) and {k for k, _, _ in made} == {t['key'] for t in room_types} and all(n >= minimum_fill(k) for k, n, _ in made) and not count_errors and not errors,
          f'{len(made)}/{len(room_types)} types; missing placement tags {count_errors}; ' + ' '.join(f'{k}:{n}' for k, n, _ in made))
    check('A20b ratings filter holds across every catalog room type', not filtered, str(filtered))
    check('A24e tags unique across every multi-room cohort', not tag_errors, f'{len(cohorts)} cohorts; duplicate cohorts {tag_errors}')
    # Background progress is eventual work, not an assertion that a loaded box
    # decodes another mesh within a fixed six-second observation window.
    pg.evaluate('window.__acceptBgStats = tuner.stats(); tuner.bgStart()')
    pg.wait_for_function("tuner.stats() !== window.__acceptBgStats && Number(tuner.stats().background_loaded.split('/')[1]) > 0", timeout=30000)
    bg0 = pg.evaluate('tuner.stats().background_loaded')
    pg.wait_for_function('''(before) => {const [done,total] = tuner.stats().background_loaded.split('/').map(Number);
        return total > 0 && (done > before || done === total); }''', arg=int(bg0.split('/')[0]), timeout=120000)
    bg1 = pg.evaluate('tuner.stats().background_loaded')
    check('A21 background preload keeps loading the whole library while idle', int(bg1.split('/')[0]) > int(bg0.split('/')[0]) or bg1.split('/')[0] == bg1.split('/')[1], f'{bg0} -> {bg1}')
    types_ = {d['type'] for d in all_doors}; barn = [d for d in all_doors if d['room'] == 'barn']
    check('A22 door variety: 3+ door types; barns get a 10-20 ft opening', len(types_) >= 3 and barn and barn[0]['span'] >= 2, f"types {sorted(types_)}; barn {barn}")

    # A25 bandwidth meter: session bytes rise when a new room type spawns; rate falls back toward 0 when idle (?nobg)
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('guest', 4, 3, 3, 3)"); settle(pg); time.sleep(1.5)
    n1 = pg.evaluate('tuner.net()')
    # Hold one real response until the UI acknowledges foreground loading. This
    # exercises the state even on a warm local origin without a timed delay.
    # Observe in-page frames so Python polling cannot miss it.
    delayed_assets, selecting_asset = [], [False]
    def delayed_asset(route):
        # Playwright may dispatch another route during page.evaluate/fetch.
        if delayed_assets or selecting_asset[0]:
            route.continue_(); return
        selecting_asset[0] = True
        try:
            if pg.evaluate('tuner.net().fgInflight > 0'):
                delayed_assets.append(route.request.url)
                response = route.fetch()
                try: pg.wait_for_function('window.__acceptLoadingWatch.seen', timeout=15000)
                finally: route.fulfill(response=response)
            else: route.continue_()
        finally: selecting_asset[0] = False
    pg.route('**/assets/**', delayed_asset)
    pg.evaluate("""() => {
        window.__acceptLoadingWatch = {active:true, seen:false};
        requestAnimationFrame(function sample() {
            const w = window.__acceptLoadingWatch;
            const el = document.querySelector('#loadBound');
            const visible = el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
            if (tuner.net().loadingBound && visible) w.seen = true;
            if (w.active) requestAnimationFrame(sample);
        });
    }""")
    pg.evaluate("void tuner.createRoom('barn', 10, 3, 6, 5)")
    settle(pg); time.sleep(0.5)
    seen_bound = pg.evaluate('window.__acceptLoadingWatch.active = false; window.__acceptLoadingWatch.seen')
    pg.unroute('**/assets/**', delayed_asset)
    n2 = pg.evaluate('tuner.net()')
    hud = pg.locator('#net').inner_text()
    check('A25 bandwidth meter: session bytes rise when a new room type spawns, HUD shows it', n2['session'] > n1['session'] + 200e3 and n2['files'] > n1['files'] and 'this session' in hud and n2['ceiling'] > 0,
          f"{n1['session'] / 1e6:.1f} -> {n2['session'] / 1e6:.1f} MB, peak {n2['ceiling'] / 1e6:.1f} MB/s; HUD '{hud.splitlines()[0]}'")
    check('A25b loading-bound flag shows while the spawn waits on downloads', seen_bound and len(delayed_assets) == 1, f'seen={seen_bound}; delayed asset={delayed_assets}')
    time.sleep(3.0); n3 = pg.evaluate('tuner.net()')
    check('A25c rate falls back toward 0 when idle (no background preload)', n3['rate'] < 50e3 and n3['fgInflight'] == 0 and n3['bgInflight'] == 0, f"idle rate {n3['rate'] / 1e3:.1f} kB/s")
    st = pg.evaluate('tuner.stats()')
    check('A25d bandwidth numbers ride along in the stats (and so in Send room + note)', 'net_session_mb' in st and 'net_util_pct' in st and 'loading_bound' in st, ', '.join(k for k in st if k.startswith('net_')))

    # A26 orientation correction: R twice turns every instance of the selected mesh 90 deg; write-back; survives reload
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])
    pg = br.new_page(viewport={'width': 1600, 'height': 950}); pg.add_init_script(OPEN_PANELS)
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
    pg.select_option('#lodFaces', 'baked')
    pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
    pg.evaluate("tuner.setTestNote('acceptance test (Fauna)')")
    from collections import Counter
    tl = pg.evaluate('tuner.tags()')
    props = [t for t in tl if t['kind'] == 'mesh' and t['layer'] not in ('walls', 'openings')]
    cnt = Counter(t['sku'] for t in props)
    target = None
    for t in props:
        if cnt[t['sku']] >= 2:
            y0 = pg.evaluate(f"tuner.skuYaws('{t['sku']}')")
            if None not in y0: target = (t['tag'], t['sku'], y0); break
    if target:
        tag, sku, y0 = target
        pg.evaluate(f"tuner.selectByTag('{tag}')")
        pg.keyboard.press('r'); time.sleep(0.6); pg.keyboard.press('r'); time.sleep(1.2)
        y1 = pg.evaluate(f"tuner.skuYaws('{sku}')")
        turned = all(((b - a) % 360) == 90 for a, b in zip(y0, y1))
        check('A26 R twice turns every instance of that mesh by 90 deg', turned and len(y1) == len(y0), f'{sku}: {y0} -> {y1}')
        if WRITEBACK:
            time.sleep(1.0); ls = pg.evaluate('tuner.lastOrientSend()')
            check('A26b the correction reached Fauna (write-back kind "orient")', ls and ls['ok'] and ls['sku'] == sku, f'{ls}')
        want = pg.evaluate(f"tuner.orientOf('{sku}')")
        pg.goto(URL); pg.wait_for_selector('body[data-ready="1"]', timeout=60000)
        pg.select_option('#lodFaces', 'baked')
        pg.evaluate("void tuner.createRoom('common', 4, 3, 6, 4)"); settle(pg)
        got = pg.evaluate(f"tuner.orientOf('{sku}')"); y2 = pg.evaluate(f"tuner.skuYaws('{sku}')")
        check('A26c the correction persists across a reload', got == want and (not y2 or all(v == y1[0] or ((v - y1[0]) % 360) == 0 for v in y2)), f'orient {want} -> {got}; yaws {y2}')
        # revert so the test leaves no correction behind (its records live in the test sandbox: tests/tw_sandbox.py)
        pg.evaluate("tuner.setTestNote('acceptance test (Fauna)')")
        again = [t for t in pg.evaluate('tuner.tags()') if t['sku'] == sku]
        pg.evaluate(f"tuner.selectByTag('{again[0]['tag']}')")
        pg.keyboard.press('Shift+R'); time.sleep(0.6); pg.keyboard.press('Shift+R'); time.sleep(1.5)
        pg.evaluate("localStorage.removeItem('tuner.orient.v2')")
    else:
        check('A26 orientation correction (no multi-instance mesh found)', False)

    # A15 phone width: page usable, no horizontal scroll
    br.close(); br = p.chromium.launch(args=['--no-sandbox'])  # fresh GPU process (headless software GL memory)
    m = br.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); m.add_init_script(OPEN_PANELS)
    m.goto(URL); m.wait_for_selector('body[data-ready="1"]', timeout=60000)
    sw = m.evaluate('document.documentElement.scrollWidth')
    m.evaluate("tuner.createRoom('guest', 4, 3, 3, 3)"); m.wait_for_function('tuner.episodes() === 0', timeout=90000)
    m.screenshot(path=f'{SHOTS}/accept-phone.png')
    check('A15 phone width: no horizontal scroll, room spawns', sw <= 390, f'scrollWidth {sw}')
    check('A0 no page errors during the whole run', not errors, '; '.join(errors[:3]))
    br.close()

fails = sum(1 for _, ok in results if not ok)
print(f'\n{len(results) - fails}/{len(results)} passed')
sys.exit(fails)
