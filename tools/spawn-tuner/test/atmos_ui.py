"""Atmosphere acceptance (2026-10-04; indoor / outdoor fog, room fog height and the sim window 2026-10-05).
W*: the outdoor wind is a force in the fluid, outdoors only: tracer released upwind of a solid wall never appears inside,
through a doorway it does; the flow stagnates at the wall and splits round the corners; nothing jitters there.
H*: fog height per room: the Room panel slider with its notch at 0, type defaults from data/fog_defaults.json, regions.
F*: the far field: no seam at the simulation window's rim (pixels sampled across it), masks persisting outside it.
The Atmosphere panel renders and its dials take effect; the fluid responds to
synthetic pointer motion (velocity + density readback change along the path, and the pixels there change); walls hold
the fog (the mask has the walls, and a dense blob shoved at a wall does not cross it); putting a fire out puffs; the
unbuilt world fogs and a room's footprint clears; fog of war hides a room and a reveal clears it; presets load / save /
send (kind "fx", data.fx = "atmos") and "Use in game" stores the house atmosphere (GET /tuner/house -> atmos); costs.
python atmos_ui.py BASE_URL OUTDIR [API_ORIGIN]   (API_ORIGIN e.g. http://127.0.0.1:8096 when BASE_URL is a local static server)
Exit code = number of failures. Screenshots go to OUTDIR (atmos-*.png)."""
import sys, time, json, io, os
import numpy as np
from PIL import Image
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base, outdir = sys.argv[1].rstrip('/'), sys.argv[2]
api_origin = sys.argv[3] if len(sys.argv) > 3 else None
fails = 0
def check(name, ok, ev=''):
    global fails
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{ev}]' if ev else '')); fails += 0 if ok else 1
def grab(pg, clip):
    return np.asarray(Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert('RGB')).astype(np.int16)
def diff(a, b):
    return float((np.abs(a - b).max(axis=2) > 18).mean())
def setp(pg, group, vals):
    pg.evaluate(f"(() => {{ const p = fx.params('atmos'); Object.assign(p.{group}, {json.dumps(vals)}); fx.setParams('atmos', p); }})()")

with sync_playwright() as p:
    # ATMOS_GPU=1: run on the box's GPU (ANGLE over Vulkan): the same checks, ~10x faster than SwiftShader
    ARGS = ['--no-sandbox'] + (['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if os.environ.get('ATMOS_GPU') else [])
    b = p.chromium.launch(args=ARGS)
    pg = b.new_page(viewport={'width': 1400, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if api_origin:
        tw_sandbox.proxy(pg, api_origin)
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.fx.atmos')) localStorage.removeItem(k); } catch (e) {}")
    pg.goto(base + '/index.html?nobg&seed=4242&atmos=crypt-fog')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000)
    pg.wait_for_function('!!window.fx && !!fx.atmos', timeout=60000)
    pg.evaluate("document.querySelector('details.major[data-key=\"atmos\"]').open = true")
    n = pg.locator('#fx-atmos-dials input, #fx-atmos-dials select').count()
    check('A1 panel: Atmosphere dials, presets, demos', n >= 35 and pg.locator('#fx-atmos-load option').count() >= 6 and pg.locator('#fx-atmos-hide').count() == 1, f'{n} dials')
    check('A1b ?atmos=crypt-fog starts on the built-in', pg.evaluate("fx.params('atmos').name") == 'crypt-fog')
    check('A1c the default Stir radius is 0.6 ft (Harry 2026-10-05)', pg.evaluate("fx.params('atmos').flow.radius") == 0.6)

    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")
    pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)")  # x 20..55, z 15..40 ft
    pg.wait_for_function('tuner.episodes() === 0', timeout=180000); time.sleep(3)
    pg.evaluate("(() => { tuner.cam.focus.set(37.5, 0, 27.5); tuner.cam.dist = 52; tuner.cam.pitch = 62; tuner.cam.update(); })()"); time.sleep(1.5)
    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()")
    pg.screenshot(path=f'{outdir}/atmos-crypt.png', clip=stage)

    # A2 a dial through the UI drives the params and the picture
    rc = pg.evaluate("tuner.project3(37.5, 0, 27.5)"); clip = {'x': rc['x'] - 160, 'y': rc['y'] - 120, 'width': 320, 'height': 240}
    a0 = grab(pg, clip)
    pg.locator('[data-path="atmos.indoor.height"]').evaluate("e => { e.value = '0'; e.dispatchEvent(new Event('input', { bubbles: true })); }"); time.sleep(1.5)
    a1 = grab(pg, clip)
    check('A2 indoor fog height dial drives the live params and the picture (0 = no fog)', pg.evaluate("fx.params('atmos').indoor.height") == 0 and diff(a0, a1) > 0.15, f'{diff(a0, a1):.3f} of the room changed')
    pg.locator('[data-path="atmos.indoor.height"]').evaluate("e => { e.value = '2.75'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    pg.locator('[data-path="atmos.indoor.color"]').evaluate("e => { e.value = '#ff2020'; e.dispatchEvent(new Event('input', { bubbles: true })); }"); time.sleep(1.5)
    a2 = grab(pg, clip)
    check('A2b colour dial (new colour dial type) tints the fog', pg.evaluate("fx.params('atmos').indoor.color") == '#ff2020' and float((a2[..., 0] - a2[..., 2]).mean()) > float((a0[..., 0] - a0[..., 2]).mean()) + 4)
    pg.select_option('#fx-atmos-load', 'builtin:crypt-fog'); setp(pg, 'flow', {'linger': 0.85, 'recover': 0.05}); time.sleep(2.5)

    # A3 the fluid follows synthetic pointer motion
    path = [(26 + i * 1.5, 27.5 + 2.5 * np.sin(i / 2.5)) for i in range(16)]
    pts = json.dumps([[x, z] for x, z in path])
    v0 = pg.evaluate(f"fx.atmos.probe('velocity', {pts})"); d0 = pg.evaluate(f"fx.atmos.probe('density', {pts})")
    c0 = grab(pg, clip)
    for x, z in path:
        s = pg.evaluate(f"tuner.project3({x}, 1, {z})"); pg.mouse.move(s['x'], s['y']); time.sleep(0.04)
    time.sleep(0.25)
    v1 = pg.evaluate(f"fx.atmos.probe('velocity', {pts})"); d1 = pg.evaluate(f"fx.atmos.probe('density', {pts})")
    c1 = grab(pg, clip); pg.screenshot(path=f'{outdir}/atmos-stirred.png', clip=stage)
    moved = sum(1 for a, b2 in zip(v0, v1) if b2 - a > 0.5)
    dchg = sum(1 for a, b2 in zip(d0, d1) if abs(b2 - a) > 0.02)
    check('A3 cursor stirs the velocity field along its path', moved >= len(path) // 2, f'{moved}/{len(path)} path points moving, max {max(v1):.2f} ft/s')
    check('A3b ... and moves / parts the fog density there', dchg >= len(path) // 3, f'{dchg}/{len(path)} changed')
    check('A3c ... visibly (pixels along the path change)', diff(c0, c1) > 0.03, f'{diff(c0, c1):.3f}')
    pg.mouse.move(5, 5)
    time.sleep(1.0); c2 = grab(pg, clip)
    check('A3d the swirl keeps moving after the cursor leaves (frames differ)', diff(c1, c2) > 0.01, f'{diff(c1, c2):.3f}')

    # A4 walls: the mask has them, and a shove at the north wall (z = 15) does not cross it
    m = pg.evaluate("""(() => { const d = fx.atmos.domain(), m = fx.atmos.mask(); const at = (x, z) => { const [i, j] = fx.atmos.cellOf(x, z); const o = (j * m.w + i) * 4; return [m.data[o], m.data[o + 1], m.data[o + 2]]; };
      return { wall: at(37.5, 15), inside: at(37.5, 27.5), outside: at(37.5, 9) }; })()""")
    check('A4 wall mask: wall at the room edge, indoors inside, neither outside', m['wall'][0] > 128 and m['wall'][2] > 128 and m['inside'][1] > 128 and m['inside'][0] < 64 and m['outside'][1] < 64, json.dumps(m))
    setp(pg, 'indoor', {'height': 2.8, 'density': 0.05, 'own': False}); setp(pg, 'outdoor', {'height': 0, 'drift': 0}); setp(pg, 'flow', {'recover': 0.02, 'linger': 0.9, 'breath': 0})
    pg.evaluate("fx.atmos.warm(60)"); time.sleep(0.5)
    beyond0 = pg.evaluate("fx.atmos.probe('density', [[35, 13], [37.5, 13], [40, 13]])")  # what the last preset left outside
    for k in range(25):
        pg.evaluate("for (let i = -3; i <= 3; i++) fx.atmos.splat(37.5 + i * 2, 19, 0, -14, 0.25, 2.2)"); time.sleep(0.05)
    time.sleep(1.5)
    near = pg.evaluate("fx.atmos.probe('density', [[35, 16.6], [37.5, 16.6], [40, 16.6]])"); beyond = pg.evaluate("fx.atmos.probe('density', [[35, 13], [37.5, 13], [40, 13]])")
    gain = max(b2 - a for a, b2 in zip(beyond0, beyond))
    check('A4b fog shoved at a wall piles up against it and does not cross', max(near) > 0.2 and gain < 0.02, f'inside {max(near):.2f}, beyond the wall {max(beyond0):.3f} -> {max(beyond):.3f}')
    pg.select_option('#fx-atmos-load', 'builtin:crypt-fog'); time.sleep(0.5)

    # A5 putting a fire out puffs (and the smoke batch stays soft); relight
    p0 = pg.evaluate("fx.stats().atmos_puffs")
    pg.click('#fx-atmos-snuff'); time.sleep(1.6)
    p1 = pg.evaluate("fx.stats().atmos_puffs"); fl = pg.evaluate("fx.fire.flames().filter(f => f.world).length")
    pg.screenshot(path=f'{outdir}/atmos-puff.png', clip=stage)
    check('A5 "Put fires out": flames go out and each puffs', fl == 0 and p1 - p0 >= 3, f'{p1 - p0} puffs, {fl} flames left')
    pg.click('#fx-atmos-light'); time.sleep(2.5)
    check('A5b relight brings the flames back', pg.evaluate("fx.fire.flames().filter(f => f.world).length") > 3)
    soft = pg.evaluate("fx.atmos.softBatch.batches.every(b => b.material?.defines && 'SOFT_PARTICLES' in b.material.defines)")
    check('A5c hearth smoke renders soft (depth-faded particles)', soft and pg.evaluate("fx.atmos.softBatch.batches.length") >= 1)

    # A6 the unbuilt world: fog outside, a footprint clears
    pg.check('#fx-atmos-unbuilt'); time.sleep(3)
    hv = pg.evaluate("fx.atmos.probe('heavy', [[37.5, 27.5], [37.5, 5], [70, 27.5]])")
    pg.screenshot(path=f'{outdir}/atmos-unbuilt.png', clip=stage)
    check('A6 "fog the unbuilt world": fog sea outside, none in the built room', hv[1] > 0.12 and hv[2] > 0.12 and hv[0] < 0.03, json.dumps([round(v, 3) for v in hv]))
    ar0 = pg.evaluate("fx.stats().atmos_arrivals")
    pg.evaluate("void tuner.createRoom('kitchen', 11, 3, 5, 5)")  # x 55..80, z 15..40
    pg.wait_for_function('tuner.episodes() === 0', timeout=180000); time.sleep(3)
    hk = pg.evaluate("fx.atmos.probe('heavy', [[67.5, 27.5], [62, 22], [73, 33]])")
    check('A6b a new room arrives: its fog is blown away', pg.evaluate("fx.stats().atmos_arrivals") > ar0 and max(hk) < 0.05, f'heavy in kitchen {[round(v, 3) for v in hk]}')
    pg.uncheck('#fx-atmos-unbuilt'); time.sleep(0.5)

    # A7 fog of war: hide the room under the view centre, then reveal
    pg.select_option('#fx-atmos-load', 'builtin:clear')  # baseline = the room's own detail, in clear air
    pg.evaluate("(() => { tuner.cam.focus.set(37.5, 0, 27.5); tuner.cam.update(); })()"); time.sleep(1.0)
    w0 = grab(pg, clip)
    pg.click('#fx-atmos-hide'); time.sleep(3.5)
    w1 = grab(pg, clip); pg.screenshot(path=f'{outdir}/atmos-war.png', clip=stage)
    hw = pg.evaluate("fx.atmos.probe('heavy', [[30, 22], [37.5, 27.5], [45, 33]])")
    sd0, sd1 = float(w0.std()), float(w1.std())
    check('A7 fog of war: the hidden room fills with heavy fog', min(hw) > 0.5, json.dumps([round(v, 2) for v in hw]))
    check('A7b ... that hides what is inside (detail in the room drops)', sd1 < 0.55 * sd0, f'pixel std {sd0:.1f} -> {sd1:.1f}')
    pg.click('#fx-atmos-reveal'); time.sleep(1.0)
    pg.screenshot(path=f'{outdir}/atmos-reveal.png', clip=stage)
    time.sleep(5)
    hr = pg.evaluate("fx.atmos.probe('heavy', [[30, 22], [37.5, 27.5], [45, 33]])")
    check('A7c reveal: the war fog swirls away', max(hr) < 0.08, json.dumps([round(v, 3) for v in hr]))


    # ---- W: the wind is real fluid motion, outdoors only (Harry 2026-10-05: drifting fog must not pass through rooms)
    def wind(deg, drift=3):
        pg.evaluate(f"""(() => {{ const p = fx.params('atmos'); Object.assign(p.outdoor, {{ height: 0, drift: {drift}, driftDir: {deg}, seep: 1 }}); Object.assign(p.indoor, {{ height: 0, own: false, drift: 0 }});
          Object.assign(p.flow, {{ recover: 0.02, breath: 0 }}); p.world.unbuilt = 0; p.quality.view = 'density'; fx.setParams('atmos', p); }})()""")
    INSIDE = "(() => { const a = fx.atmos, d = a.readField('density'); let s = 0, n = 0; for (let x = 22.5; x < 53; x += 1) for (let z = 17.5; z < 38; z += 1) { const [i, j] = a.cellOf(x, z); s += d.data[(j * d.w + i) * 4]; n++; } return s / n; })()"
    VEC = "(pts) => { const a = fx.atmos, v = a.readField('velocity'); return pts.map(([x, z]) => { const [i, j] = a.cellOf(x, z); const o = (j * v.w + i) * 4; return [v.data[o], v.data[o + 1]]; }); }"
    pg.select_option('#fx-atmos-load', 'builtin:clear'); pg.evaluate("fx.atmos.setRegions([])")
    pg.evaluate("(() => { tuner.cam.focus.set(48, 0, 30); tuner.cam.dist = 125; tuner.cam.pitch = 72; tuner.cam.update(); })()")  # the whole building and the open ground round it in the window
    wind(0); time.sleep(6)  # from the north, onto the building's north wall (z = 15, x 20..80: common room + kitchen)
    v = pg.evaluate(f"({VEC})([[37.5, -8], [37.5, 12.5], [17, 13], [83, 13], [37.5, 27.5], [30, 27.5], [45, 22]])")
    sp = lambda u: (u[0] ** 2 + u[1] ** 2) ** 0.5
    check('W1 wind blows outdoors and not indoors (the indoor / outdoor mask)', sp(v[0]) > 2.0 and max(sp(v[4]), sp(v[5]), sp(v[6])) < 0.5, f'far upwind {sp(v[0]):.2f} ft/s, indoors {max(sp(v[4]), sp(v[5]), sp(v[6])):.2f}')
    check('W2 the flow stagnates at the wall and splits round the corners', sp(v[1]) < 0.6 * sp(v[0]) and v[2][0] < -0.3 and v[3][0] > 0.3, f'upwind of the wall {sp(v[1]):.2f}; sideways at the corners {v[2][0]:.2f} / {v[3][0]:.2f}')
    i0 = pg.evaluate(INSIDE)
    for k in range(100): pg.evaluate("fx.atmos.splat(30, 9, 0, 0, 0.5, 2.0)"); time.sleep(0.04)
    time.sleep(2); i1 = pg.evaluate(INSIDE); pg.screenshot(path=f'{outdir}/atmos-tracer-wall.png', clip=stage)
    out1 = max(pg.evaluate("fx.atmos.probe('density', [[14, 20], [17, 12], [30, 11], [22, 12], [14, 30]])"))
    check('W3 tracer released upwind of a solid wall never appears inside (it goes round)', i1 - i0 < 0.002 and out1 > 0.05, f'inside {i0:.4f} -> {i1:.4f}; beside / before the building {out1:.2f}')
    # jitter: the velocity near the windward wall is steady from frame to frame
    samp = []
    for k in range(24): samp.append(pg.evaluate(f"({VEC})([[25, 12.5], [37.5, 12.5], [50, 12.5], [17, 13], [83, 13], [37.5, 13.6]])")); time.sleep(0.05)
    arr = np.array(samp); spread = float(arr.std(axis=0).max())
    face = arr[:, [0, 1, 2, 5]]; jit = float(np.abs(np.diff(face, axis=0)).mean(axis=0).max())  # along the wall's face, sample to sample (50 ms); the corners shed real eddies
    check('W4 no jitter where the wind meets the wall (under 5% of the wind speed from sample to sample)', jit < 0.15 and spread < 0.8, f'mean change between samples {jit:.3f} ft/s, spread over 1.2 s {spread:.3f} (wind 3 ft/s; eddies shed at the corners)')
    door = next((o for o in pg.evaluate("tuner.rooms()[0].openings") if o['kind'] == 'door' and not o.get('to')), None)
    if door:  # blow straight in through the doorway, the tracer just outside it
        side = door['side']; _, gx, gz = door['key'].split(':'); gx, gz = int(gx), int(gz); span = door.get('span') or 1
        deg, src = {'S': (180, [(gx + span / 2) * 5, gz * 5 + 6]), 'N': (0, [(gx + span / 2) * 5, gz * 5 - 6]), 'W': (270, [gx * 5 - 6, (gz + span / 2) * 5]), 'E': (90, [gx * 5 + 6, (gz + span / 2) * 5])}[side]
        pg.select_option('#fx-atmos-load', 'builtin:clear'); wind(deg); pg.evaluate("fx.atmos.warm(5)"); time.sleep(4)
        d0 = pg.evaluate(INSIDE)
        for k in range(100): pg.evaluate(f"fx.atmos.splat({src[0]}, {src[1]}, 0, 0, 0.5, 2.0)"); time.sleep(0.04)
        time.sleep(2); d1 = pg.evaluate(INSIDE); pg.screenshot(path=f'{outdir}/atmos-tracer-door.png', clip=stage)
        check('W5 ... but it does come in through an open doorway', d1 - d0 > 0.03, f'{side} door: inside {d0:.4f} -> {d1:.4f}')
    # outdoor fog drifting past a fog-free room: none inside (seep 0), and fog right up to the walls outside
    pg.select_option('#fx-atmos-load', 'builtin:morning-mist'); setp(pg, 'outdoor', {'drift': 2, 'seep': 0}); setp(pg, 'indoor', {'own': False}); time.sleep(8)
    ins = pg.evaluate(INSIDE); outs = pg.evaluate("fx.atmos.probe('density', [[37.5, 5], [10, 27], [90, 27], [37.5, 50]])")
    pg.screenshot(path=f'{outdir}/atmos-outdoor-drift.png', clip=stage)
    check('W6 drifting outdoor fog stays out of a fog-free room (and thins in the building\'s lee)', ins < 0.02 and max(outs) > 0.12 and sorted(outs)[1] > 0.05, f'inside {ins:.4f}; outside (N, W, E = lee, S) {[round(o, 2) for o in outs]}')

    # ---- H: fog height per room (THE control), a notch at 0, defaults by room type
    pg.select_option('#fx-atmos-load', 'builtin:morning-mist'); time.sleep(0.5)
    pg.evaluate("void tuner.createRoom('cellar', 12, 9, 4, 4)")  # x 60..80, z 45..65
    pg.wait_for_function('tuner.episodes() === 0', timeout=180000); time.sleep(3)
    rs = {r['type']: r['resolved'] for r in pg.evaluate("fx.atmos.rooms()")}
    check('H1 defaults by room type (data/fog_defaults.json): the cellar fogs, the common room does not', rs.get('cellar') == 2.5 and rs.get('common') == 0, json.dumps(rs))
    dc = pg.evaluate("fx.atmos.probe('density', [[70, 55], [37.5, 27.5]])")
    check('H1b ... in the simulated field too', dc[0] > 0.1 and dc[1] < 0.02, f'cellar {dc[0]:.2f}, common {dc[1]:.3f}')
    rid = pg.evaluate("tuner.rooms().find(r => r.type === 'common').id")
    pg.evaluate(f"tuner.select({json.dumps(rid)})"); time.sleep(0.3)
    slider = pg.locator('#roomFog')
    check('H2 Room panel: a Fog height slider showing the type default', slider.count() == 1 and 'type default' in pg.inner_text('#roomFogOut'), pg.inner_text('#roomFogOut'))
    slider.evaluate("e => { e.value = '3'; e.dispatchEvent(new Event('input', { bubbles: true })); }"); time.sleep(6)  # fog heals in over seconds: about 0.1 at 2.5 s, 0.2 at 5 s (measured 2026-10-05, the same at any stir radius)
    r3 = pg.evaluate("fx.atmos.rooms().find(r => r.type === 'common').resolved"); d3 = pg.evaluate("fx.atmos.probe('density', [[37.5, 27.5], [30, 22]])")
    check('H2b the slider sets this room\'s fog height (3 ft): fog stands in it', r3 == 3 and max(d3) > 0.1 and pg.inner_text('#roomFogOut').startswith('3 ft'), f'resolved {r3}, density {max(d3):.2f}')
    slider.evaluate("e => { e.value = '0.25'; e.dispatchEvent(new Event('input', { bubbles: true })); }"); time.sleep(3.5)
    r0 = pg.evaluate("fx.atmos.rooms().find(r => r.type === 'common').resolved"); d0 = pg.evaluate("fx.atmos.probe('density', [[37.5, 27.5], [30, 22]])")
    check('H3 the zero notch: a touch above 0 snaps to none, and the room clears', r0 == 0 and pg.inner_text('#roomFogOut').startswith('none') and max(d0) < 0.03, f'resolved {r0}, "{pg.inner_text("#roomFogOut")}", density {max(d0):.3f}')
    pg.click('#roomFogAuto'); time.sleep(0.6)
    check('H3b "type default" gives the room back to its type', pg.evaluate("tuner.rooms().find(r => r.type === 'common').fog") is None)
    pg.evaluate("fx.atmos.setRegions([{ id: 'menu-test', rect: [20, 15, 55, 40], height: 4 }])"); time.sleep(6)
    pv = pg.evaluate("(() => { const pl = fx.atmos.place(); const i = Math.floor((37.5 - pl.x0) / pl.cell), j = Math.floor((27.5 - pl.z0) / pl.cell); const o = (j * pl.w + i) * 4; return [pl.data[o], pl.data[o + 1], pl.data[o + 2]]; })()")
    check('H4 setRegions takes a per-region height (the game\'s room / building menus, Area settings)', abs(pv[0] - 64) <= 2 and pv[2] > 128 and pg.evaluate("fx.atmos.probe('density', [[37.5, 27.5]])")[0] > 0.1, f'place canvas at the room {pv} (R = height / 16 ft)')
    pg.evaluate("fx.atmos.setRegions([])")
    pg.select_option('#fx-atmos-load', 'builtin:clear'); time.sleep(0.6)
    check('H5 preset "clear": no room keeps fog', pg.evaluate("fx.stats().atmos_fog_max_ft") == 0)

    # ---- Z: the simulation window is fitted to the visible ground at a fixed cell count (Harry 2026-10-05)
    pg.select_option('#fx-atmos-load', 'builtin:morning-mist'); setp(pg, 'flow', {'breath': 0}); pg.check('#fx-atmos-unbuilt'); pg.mouse.move(5, 5)
    def view(dist, pitch, x=37.5, z=27.5, wait=2.2):
        pg.evaluate(f"(() => {{ tuner.cam.focus.set({x}, 0, {z}); tuner.cam.dist = {dist}; tuner.cam.pitch = {pitch}; tuner.cam.update(); }})()"); time.sleep(wait)
    # S: the Stir radius slider is honoured at every zoom (Harry 2026-10-05: "we seem to not be taking stir radius from the
    # slider anymore"; a 4.5-cell minimum had overridden it). In feet at play zoom, down to 0.5 ft; times the zoom scale
    # beyond; never floored above one cell. The same screen wiggle at each zoom and setting; cells stirred = cells moving
    # faster than 3 ft/s (times the zoom scale), over what was already moving. Run before the Z sweep, from close to far:
    # zooming in from far away leaves the resampled motion running for a long while, which would drown the small stirs
    cx, cy = stage['x'] + stage['width'] * 0.5, stage['y'] + stage['height'] * 0.6
    COUNT = "(() => { const v = fx.atmos.readField('velocity'), zs = Math.max(1, fx.stats().atmos_cell_ft / 0.5); let n = 0; for (let i = 0; i < v.data.length; i += 4) if (Math.hypot(v.data[i], v.data[i + 1]) > 3 * zs) n++; return n; })()"
    drift0 = pg.evaluate("fx.params('atmos').outdoor.drift"); rad0 = pg.evaluate("fx.params('atmos').flow.radius"); setp(pg, 'outdoor', {'drift': 0}); sr = []
    for dist, pitch in [(28, 55), (52, 62), (160, 45), (900, 30)]:
        view(dist, pitch, wait=3)
        for rad in [0.5, 1, 2.2, 6]:
            setp(pg, 'flow', {'radius': rad})
            for _ in range(80):  # let the last stir (and a zoom step's resampled motion) die away first
                time.sleep(0.5); n0 = pg.evaluate(COUNT)
                if n0 <= 3: break
            time.sleep(3); n0 = pg.evaluate(COUNT)
            for k in range(14): pg.mouse.move(cx + 40 * ((k % 2) * 2 - 1), cy + k * 3); time.sleep(0.03)
            time.sleep(0.1); n = pg.evaluate(COUNT) - n0; st = pg.evaluate("fx.stats()"); pg.mouse.move(5, 5)
            sr.append({'dist': dist, 'rad': rad, 'cell': st['atmos_cell_ft'], 'splat': st['atmos_splat_cells'], 'stirred': n, 'n0': n0})
    setp(pg, 'flow', {'radius': rad0}); setp(pg, 'outdoor', {'drift': drift0})
    by = {d: [r for r in sr if r['dist'] == d] for d in dict.fromkeys(r['dist'] for r in sr)}
    ev = '; '.join(f"{d} ft (cell {rs[0]['cell']}): " + ', '.join(f"{r['rad']} ft -> {r['splat']} cells, {r['stirred']} stirred" + (f" (over {r['n0']})" if r['n0'] > 3 else '') for r in rs) for d, rs in by.items())
    want = lambda r: r['rad'] * max(1, r['cell'] / 0.5) / r['cell']  # the rule, in cells
    check('S1 the Stir radius slider sets the cursor\'s footprint at every zoom: feet at play zoom, times the zoom scale beyond, no floor above one cell',
          all(abs(r['splat'] - want(r)) < 0.02 * want(r) + 0.011 for r in sr) and all(r['splat'] >= 0.99 for r in sr), ev)
    check('S2 ... and the fluid follows: at every zoom a bigger setting stirs more cells (0.5 < 1 < 2.2 < 6 ft, each step at least 1.3x)',
          all(rs[0]['stirred'] > 5 and all(b2['stirred'] > 1.3 * a['stirred'] for a, b2 in zip(rs, rs[1:])) for rs in by.values()), ev)
    lo = [r for r in sr if r['cell'] <= 0.5]
    check('S3 small radii are small at play zoom: 0.5 ft stirs under a tenth of what 2.2 ft does', all(r['stirred'] < 0.1 * next(q['stirred'] for q in lo if q['dist'] == r['dist'] and q['rad'] == 2.2) for r in lo if r['rad'] == 0.5) and len(lo) >= 8, ev)
    zr = []; setp(pg, 'flow', {'radius': 2.2})  # the zoom sweep's counts are for a 2.2 ft stir (the default is 0.6 since 2026-10-05)
    for dist, pitch in [(28, 55), (70, 55), (160, 45), (420, 35), (900, 30)]:
        view(dist, pitch)
        cx, cy = stage['x'] + stage['width'] * 0.5, stage['y'] + stage['height'] * 0.6
        for k in range(14): pg.mouse.move(cx + 40 * ((k % 2) * 2 - 1), cy + k * 3); time.sleep(0.03)  # the same wiggle on the SCREEN at every zoom
        time.sleep(0.1)
        n = pg.evaluate("(() => { const v = fx.atmos.readField('velocity'), zs = Math.max(1, fx.stats().atmos_cell_ft / 0.5); let n = 0; for (let i = 0; i < v.data.length; i += 4) if (Math.hypot(v.data[i], v.data[i + 1]) > 3 * zs) n++; return n; })()")
        pg.mouse.move(5, 5); time.sleep(0.8); st = pg.evaluate("fx.stats()")
        zr.append({'dist': dist, 'calls': st['atmos_sim_calls'], 'draws': st['atmos_draw_calls'], 'grid': st['atmos_grid'].split('@')[0], 'fx': st['atmos_fx_res'], 'cell': st['atmos_cell_ft'], 'window': st['atmos_window_ft'], 'splat': st['atmos_splat_cells'], 'stirred': n})
        pg.screenshot(path=f'{outdir}/atmos-zoom-{dist}.png', clip=stage)
    setp(pg, 'flow', {'radius': rad0})
    check('Z1 constant cost across zoom: the same grid, pass count and fog resolution', len({r['grid'] for r in zr}) == 1 and len({r['fx'] for r in zr}) == 1 and max(r['calls'] for r in zr) - min(r['calls'] for r in zr) <= 4 and len({r['draws'] for r in zr}) == 1,
          '; '.join(f"{r['dist']} ft: {r['calls']} sim + {r['draws']} draw, {r['grid']}, {r['fx']}" for r in zr))
    check('Z1b ... while the cell size follows the zoom (the window covers the view)', zr[0]['cell'] < 0.3 and zr[-1]['cell'] > 6 and all(a['cell'] < b2['cell'] for a, b2 in zip(zr, zr[1:])), '; '.join(f"{r['dist']} ft: cell {r['cell']} ft, window {r['window']} ft" for r in zr))
    far = zr[2:]
    check('Z2 the cursor stirs the same number of cells from medium zoom out (the Stir radius scales with the zoom)', len({r['splat'] for r in far}) == 1 and min(r['stirred'] for r in far) > 150 and max(r['stirred'] for r in far) < 2.5 * min(r['stirred'] for r in far),
          '; '.join(f"{r['dist']} ft: radius {r['splat']} cells, {r['stirred']} cells stirred" for r in zr))
    # a zoom step resamples the fog into the new scale (no reset) and eases in; a pan shifts it by whole cells
    view(70, 55, 70, 55); time.sleep(4)
    c0 = pg.evaluate("fx.atmos.probe('density', [[70, 55], [66, 51], [74, 59]])"); k0 = pg.evaluate("fx.stats().atmos_zoom_step")
    pg.evaluate("(() => { tuner.cam.dist = 130; tuner.cam.update(); })()"); time.sleep(0.12)
    xf = pg.evaluate("fx.stats().atmos_xfade"); c1 = pg.evaluate("fx.atmos.probe('density', [[70, 55], [66, 51], [74, 59]])"); time.sleep(1.0)
    st = pg.evaluate("fx.stats()")
    check('Z3 a zoom step resamples the fog into the new scale and cross-fades in (no pop, no reset)', st['atmos_zoom_step'] > k0 and xf < 1 and st['atmos_xfade'] == 1 and min(c1) > 0.5 * min(c0) and min(c0) > 0.05,
          f"cellar fog before {[round(v, 2) for v in c0]} -> just after {[round(v, 2) for v in c1]}; fade {xf} -> {st['atmos_xfade']}; zoom step {k0} -> {st['atmos_zoom_step']}")
    sh0 = st['atmos_shifts']; z0 = st['atmos_zooms']
    for k in range(6): pg.evaluate(f"(() => {{ tuner.cam.focus.set({70 + (k + 1) * 3}, 0, 55); tuner.cam.update(); }})()"); time.sleep(0.12)
    time.sleep(0.4); st = pg.evaluate("fx.stats()"); c2 = pg.evaluate("fx.atmos.probe('density', [[70, 55], [66, 51], [74, 59]])"); dm = pg.evaluate("fx.atmos.domain()")
    check('Z4 a pan shifts the fields with the view in whole cells (the fog stays put in the world)', st['atmos_shifts'] > sh0 and st['atmos_zooms'] == z0 and abs(dm['x0'] / dm['cell'] - round(dm['x0'] / dm['cell'])) < 1e-3 and all(abs(a - b2) < 0.12 for a, b2 in zip(c1, c2)),
          f"shifts {sh0} -> {st['atmos_shifts']}; cellar fog {[round(v, 2) for v in c2]}; window origin {dm['x0'] / dm['cell']:.3f} cells")

    # ---- F: past the window, the noise sea: no seam at the rim (pixels sampled across it) at two zooms; masks kept
    setp(pg, 'outdoor', {'drift': 0, 'patchy': 0}); setp(pg, 'haze', {'amount': 0, 'dust': 0}); pg.uncheck('#fx-atmos-unbuilt')
    pg.add_style_tag(content='#stage > *:not(canvas) { visibility: hidden !important; }')
    def rim_check(tag, dist, pitch, x=37.5, z=27.5):
        view(dist, pitch, x, z, wait=5); pg.mouse.move(5, 5)
        dm = pg.evaluate("fx.atmos.domain()"); sc = dm['cell'] * 4
        shot = np.asarray(Image.open(io.BytesIO(pg.screenshot())).convert('L')).astype(float); pg.screenshot(path=f'{outdir}/atmos-rim-{tag}.png', clip=stage)
        best = None
        for mx, mz, ox, oz in [(dm['x0'] + dm['W'] / 2, dm['z0'], 0, -1), (dm['x0'] + dm['W'] / 2, dm['z0'] + dm['D'], 0, 1), (dm['x0'], dm['z0'] + dm['D'] / 2, -1, 0), (dm['x0'] + dm['W'], dm['z0'] + dm['D'] / 2, 1, 0)]:
            rows = []
            for side in (-0.44, -0.36, -0.28, 0.28, 0.36, 0.44):  # parallel lines across this rim, out to the sides (the building stands before its middle)
                sq = [pg.evaluate(f"fx.atmos.screenOf({mx + ox * t * sc + abs(oz) * side * dm['W']}, 0, {mz + oz * t * sc + abs(ox) * side * dm['D']})") for t in range(-7, 8)]
                if any(q['behind'] or not (0.01 < q['u'] < 0.99 and 0.01 < q['v'] < 0.99) for q in sq): continue
                px = [{'x': stage['x'] + q['u'] * stage['width'], 'y': stage['y'] + q['v'] * stage['height']} for q in sq]
                rows.append([float(shot[int(q['y']) - 1:int(q['y']) + 2, int(q['x']) - 1:int(q['x']) + 2].mean()) for q in px])
            if len(rows) >= 2: best = [float(v) for v in np.median(np.array(rows), axis=0)]; break
        if not best: check(f'F1 {tag}: a rim of the window is on screen', False, json.dumps(dm)); return
        steps = [abs(a - b2) for a, b2 in zip(best, best[1:])]; rs = max(steps[6], steps[7]); inside_m, outside_m = float(np.median(best[:6])), float(np.median(best[9:]))
        check(f'F1 no seam at the simulation window\'s rim ({tag}: cell {dm["cell"]:.2f} ft)', rs < 10 and rs <= max(6, 2.5 * float(np.median(steps))) and abs(inside_m - outside_m) < 25 and min(best) > 25,
              f'luminance across the rim {[round(l) for l in best]}; step at the rim {rs:.1f} (median {float(np.median(steps)):.1f}); inside {inside_m:.0f} / outside {outside_m:.0f}')
    rim_check('low pitch, near, over open ground', 110, 13, 170, 170); rim_check('low pitch, far', 420, 16)
    pg.add_style_tag(content='#stage > *:not(canvas) { visibility: visible !important; }')
    # views with no post stack (the game's PiP; Lighting FX off): the noise sheets carry the fog
    view(140, 50); lo0 = pg.evaluate("fx.lighting.params.on")
    pg.evaluate("(() => { const p = fx.params('lighting'); p.on = false; fx.setParams('lighting', p); })()"); time.sleep(1.2)
    q = pg.evaluate("tuner.project3(37.5, 0, 75)"); pc = {'x': q['x'] - 20, 'y': q['y'] - 20, 'width': 40, 'height': 40}
    s1 = float(grab(pg, pc).mean()); vis = pg.evaluate("fx.stats().atmos_sheets")
    setp(pg, 'outdoor', {'height': 0}); time.sleep(1.0); s0 = float(grab(pg, pc).mean())
    check('F3 with no post stack (PiP, Lighting FX off) flat noise sheets carry the fog', vis >= 1 and s1 > s0 + 15, f'{vis} sheet(s); open ground luminance {s0:.0f} without fog -> {s1:.0f} with')
    pg.evaluate(f"(() => {{ const p = fx.params('lighting'); p.on = {json.dumps(lo0)}; fx.setParams('lighting', p); }})()")
    pg.select_option('#fx-atmos-load', 'builtin:morning-mist'); time.sleep(0.5)
    sh0 = pg.evaluate("fx.stats().atmos_shifts + fx.stats().atmos_zooms")
    pg.check('#fx-atmos-unbuilt'); pg.evaluate("(() => { tuner.cam.focus.set(400, 0, 27.5); tuner.cam.dist = 60; tuner.cam.update(); })()"); time.sleep(3)
    wp = pg.evaluate("""(() => { const pl = fx.atmos.place('world'); const at = (x, z) => { const i = Math.floor((x - pl.x0) / pl.cell), j = Math.floor((z - pl.z0) / pl.cell); const o = (j * pl.w + i) * 4; return [pl.data[o], pl.data[o + 1], pl.data[o + 2]]; };
      const d = fx.atmos.domain(); return { common: at(37.5, 27.5), cellar: at(70, 55), open: at(37.5, 80), windowHasRoom: d.x0 < 55 }; })()""")
    check('F2 the masks persist outside the window (the window has moved 360 ft away)', not wp['windowHasRoom'] and wp['common'][2] > 128 and wp['cellar'][2] > 128 and abs(wp['cellar'][0] - 40) <= 2 and wp['open'][2] < 64 and pg.evaluate("fx.stats().atmos_shifts + fx.stats().atmos_zooms") > sh0, json.dumps(wp))
    pg.evaluate("(() => { tuner.cam.focus.set(37.5, 0, 27.5); tuner.cam.dist = 52; tuner.cam.pitch = 62; tuner.cam.update(); })()"); time.sleep(2.5)
    hv = pg.evaluate("fx.atmos.probe('heavy', [[37.5, 27.5], [37.5, 5]])")
    check('F2b ... and back at the rooms, the built room is still clear of the fog sea', hv[0] < 0.03 and hv[1] > 0.12, json.dumps([round(v, 3) for v in hv]))
    pg.uncheck('#fx-atmos-unbuilt'); pg.select_option('#fx-atmos-load', 'builtin:crypt-fog'); time.sleep(1)

    # A8 presets: every built-in loads; save / load here; send; Use in game
    names = ['clear', 'morning-mist', 'crypt-fog', 'smoky-tavern', 'storm-haze']
    ok = True
    for nm in names:
        pg.select_option('#fx-atmos-load', 'builtin:' + nm); time.sleep(0.6)
        ok = ok and pg.evaluate("fx.params('atmos').name") == nm
        pg.screenshot(path=f'{outdir}/atmos-preset-{nm}.png', clip=stage)
    check('A8 the five built-ins load (clear, morning mist, crypt fog, smoky tavern, storm haze)', ok)
    pg.select_option('#fx-atmos-load', 'builtin:smoky-tavern'); time.sleep(0.5)
    pg.fill('#fx-atmos-name', 'atmos-acceptance-test'); pg.click('#fx-atmos-save')
    pg.select_option('#fx-atmos-load', 'builtin:clear')
    pg.select_option('#fx-atmos-load', 'local:atmos-acceptance-test')
    check('A8b save in this browser, load it back', pg.evaluate("fx.params('atmos').smoke.pool") == 0.6)
    if api_origin:
        pg.fill('#fx-atmos-note', 'acceptance test (Fauna)')
        pg.click('#fx-atmos-send'); time.sleep(1.5)
        recs = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/fx').then(r => r.text())"))
        rec = recs.get('atmos-acceptance-test')
        check('A8c Send: kind "fx", data.fx = "atmos", read back from the server', bool(rec) and rec['data'].get('fx') == 'atmos' and rec['data'].get('smoke', {}).get('pool') == 0.6, json.dumps(rec)[:120] if rec else 'missing')
        time.sleep(1.0); nopt = pg.locator('#fx-atmos-load option[value="remote:atmos-acceptance-test"]').count()
        check('A8d the sent preset appears in the Load list', nopt == 1, f'{nopt} options')
        pg.click('#fx-atmos-house'); time.sleep(1.5)
        house = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/house').then(r => r.text())"))
        ha = house.get('atmos') or {}
        check('A8e "Use in game" stores the house atmosphere (GET /tuner/house)', ha.get('fx') == 'atmos' and ha.get('name') == 'atmos-acceptance-test' and 'atmos' in house.get('at', {}), json.dumps(ha)[:100])

    # A9 costs (headless SwiftShader: count draw calls, not fps)
    pg.select_option('#fx-atmos-load', 'builtin:crypt-fog'); time.sleep(1.5)
    st = pg.evaluate("fx.stats()")
    check('A9 cost: fog = one volume pass + composite; sim <= 30 passes at medium', st['atmos_draw_calls'] <= 8 and st['atmos_sim_calls'] <= 30 and st['atmos_volume'], json.dumps({k: st[k] for k in st if k.startswith('atmos_')})[:300])
    pg.select_option('#fx-atmos-load', 'builtin:clear'); time.sleep(1.5)
    st = pg.evaluate("fx.stats()")
    check('A9b clear: no simulation, no volume', st['atmos_sim_calls'] == 0 and not st['atmos_volume'])
    check('A10 no page errors', not errs, '; '.join(errs[:3]))
    b.close()

    # A11 ?nofx: atmosphere clear (headless layout tests)
    b = p.chromium.launch(args=ARGS); pg = b.new_page()
    pg.goto(base + '/index.html?nobg&nofx'); pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx')
    check('A11 ?nofx keeps the air clear', pg.evaluate("fx.stats().atmos_fog_max_ft === 0 && fx.params('atmos').haze.amount === 0"))
    b.close()
print(f'{fails} failure(s)')
sys.exit(fails)
