"""WATER acceptance (2026-10-04): the Water panel and the shared water (js/fx/water.js) in the Spawn Tuner.
  W1  the panel builds (dials, tools, the five built-in presets)
  W2  dials drive the live params AND the shader's uniforms; W3 a dial change changes the picture
  W4  water sits exactly at the Alignment-Bench-defined level and footprint (measured independently of water.js:
      the record's fractions mapped through each vessel's own mesh root; a ray cast down hits the surface there)
  W5  the outline lies inside the vessel
  W6  a synthetic cursor drag disturbs the heightfield along its path (GPU readback) and not away from it
  W7  the ripples show behind the cursor across frames (pixel difference along the path)
  W8  a river advects: a ripple's centroid moves downstream (and a still pond's barely moves)
  W9  a wading pawn, W10 a dropped stone, W11 drawing a river with the tool
  W12 presets: built-in load, save in this browser, send (kind "fx", data.fx "water") read back
  W13 "Use in game" stores the house water (GET /tuner/house -> water)
  W14 Lighting FX off: the plain path draws the water; ?nofx turns it off
  W15 the quality dial; W16 no page errors
python water_ui.py BASE_URL OUTDIR [API_ORIGIN] [--gpu]
  (BASE_URL e.g. http://127.0.0.1:8791 a static server on tools/spawn-tuner; API_ORIGIN http://127.0.0.1:8096)
Writes go to the server's test sandbox (tests/tw_sandbox.py): the live house look and presets are never touched."""
import sys, time, json, math
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith('--')]
base, outdir = args[0].rstrip('/'), args[1]
api_origin = args[2] if len(args) > 2 else None
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
LAUNCH = GPU if '--gpu' in sys.argv else ['--no-sandbox']
ok = True
def check(name, cond, detail=''):
    global ok
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail else ''), flush=True); ok = ok and bool(cond)

def route(pg):
    if api_origin:
        tw_sandbox.proxy(pg, api_origin)

def open_tuner(b, qs='', w=1500, h=950):
    pg = b.new_page(viewport={'width': w, 'height': h})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errs.append(m.text[:300]))
    route(pg)
    pg.add_init_script("try { localStorage.clear(); } catch (e) {}")
    pg.goto(f'{base}/index.html?nobg&seed=4242{qs}')
    pg.wait_for_selector('body[data-ready="1"]', timeout=120000)
    pg.wait_for_function('!!window.fx && !!fx.water && !!fx.water.tools', timeout=60000)
    return pg, errs

def look(pg, x, z, dist, pitch=52):
    pg.evaluate(f"(() => {{ tuner.cam.focus.set({x}, 0, {z}); tuner.cam.dist = {dist}; tuner.cam.pitch = {pitch}; tuner.cam.update(); }})()")
    time.sleep(0.6)

def stage_px(pg, path):
    pg.locator('#stage').screenshot(path=path)
    from PIL import Image
    return Image.open(path).convert('RGB')

def region_diff(a, b, box):
    from PIL import ImageChops, ImageStat
    d = ImageChops.difference(a.crop(box), b.crop(box))
    return sum(ImageStat.Stat(d).mean) / 3

# independent geometry: the record (fractions of the GLB bbox) through the vessel's own mesh root, vs the water mesh
MEASURE = """async (sku) => {
  const THREE = await import('three');
  const it = fx.water.tools.demoItems().find(i => i.spec.sku === sku); if (!it) return { missing: true };
  let root = null; it.visual.traverse(o => { if (!root && o.userData.meshRoot) root = o; });
  const mesh = fx.water.scene.children.find(m => m.userData.water?.it === it); if (!mesh) return { nowater: true };
  const rec = mesh.userData.water.rec;
  // the GLB bbox in the root's own frame (no water.js code)
  const box = new THREE.Box3(), m = new THREE.Matrix4(), bb = new THREE.Box3();
  root.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); m.identity(); for (let p = o; p && p !== root; p = p.parent) { p.updateMatrix(); m.premultiply(p.matrix); } box.union(bb.copy(o.geometry.boundingBox).applyMatrix4(m)); });
  const sz = box.getSize(new THREE.Vector3()); root.updateWorldMatrix(true, false);
  const yG = box.min.y + rec.y * sz.y;
  const recW = rec.poly.map(([u, w]) => root.localToWorld(new THREE.Vector3(box.min.x + u * sz.x, yG, box.min.z + w * sz.z)));
  // the rendered outline: the water mesh's first ring
  mesh.updateMatrixWorld(); const pos = mesh.geometry.getAttribute('position'), edge = mesh.geometry.getAttribute('aEdge');
  const ring = []; for (let i = 0; i < pos.count && ring.length < recW.length + 64; i++) if (edge.getX(i) === 0) ring.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  const segD = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  const dist = recW.map(p => Math.min(...ring.map((a, i) => segD(p, a, ring[(i + 1) % ring.length]))));
  const ys = ring.map(p => p.y);
  // a ray straight down through the outline's centre hits the water at the level
  const c = recW.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / recW.length);
  const hit = new THREE.Raycaster(new THREE.Vector3(c.x, c.y + 20, c.z), new THREE.Vector3(0, -1, 0)).intersectObject(mesh, false)[0];
  // the vessel's world bbox (xz) contains the outline
  const vb = new THREE.Box3().setFromObject(it.group);
  const inside = ring.every(p => p.x >= vb.min.x - 0.01 && p.x <= vb.max.x + 0.01 && p.z >= vb.min.z - 0.01 && p.z <= vb.max.z + 0.01);
  return { yRec: yG === null ? null : root.localToWorld(new THREE.Vector3(0, yG, 0)).y, yMin: Math.min(...ys), yMax: Math.max(...ys), dMin: Math.min(...dist), dMax: Math.max(...dist),
    outset: (rec.inset_in ?? 0.6) / 12 * 1.0, hitY: hit ? hit.point.y : null, inside, src: rec.src, n: recW.length, vbox: [vb.min.y, vb.max.y], c: [c.x, c.y, c.z] };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(args=LAUNCH)
    pg, errs = open_tuner(b)
    pg.evaluate("document.querySelector('details.major[data-key=\"water\"]').open = true")
    # ---- W1 panel
    n_dials = pg.locator('#fx-water-dials input, #fx-water-dials select').count()
    check('W1a Water panel dials rendered', n_dials >= 20, f'{n_dials} controls')
    check('W1b tools present (demo, wade, drop, draw river/pond)', all(pg.locator(s).count() == 1 for s in ['#fx-water-demo', '#fx-water-wade', '#fx-water-drop', '#fx-water-river', '#fx-water-pond', '#fx-water-house', '#fx-water-send']))
    builtins = pg.evaluate("[...document.querySelectorAll('#fx-water-load option')].map(o => o.value).filter(v => v.startsWith('builtin:'))")
    check('W1c five presets: well water, clear stream, murky canal, millpond at night, rain barrel', all(f'builtin:{n}' in builtins for n in ['well-water', 'clear-stream', 'murky-canal', 'millpond-night', 'rain-barrel']), ','.join(builtins))

    # ---- the demo yard
    pg.click('#fx-water-demo')
    pg.wait_for_function('fx.water.tools.demoItems().length >= 11', timeout=90000); time.sleep(2.5)
    st = pg.evaluate('fx.water.stats()')
    check('W4a demo: vessels with water and two bodies', st['water_vessels'] >= 8 and st['water_bodies'] >= 2, json.dumps({k: st[k] for k in ('water_vessels', 'water_bodies', 'water_draw_calls')}))
    # ---- W4/W5 level + footprint, measured
    for sku in ['bucket--empty', 'washtub--empty', 'rain-barrel--open', 'horse-trough-stone--empty', 'water-trough--empty', 'well--open']:
        r = pg.evaluate(MEASURE, sku)
        if r.get('missing') or r.get('nowater'):
            check(f'W4 {sku}: has water', False, json.dumps(r)); continue
        lvl = abs(r['yMin'] - r['yRec']) < 0.005 and abs(r['yMax'] - r['yRec']) < 0.005 and r['hitY'] is not None and abs(r['hitY'] - r['yRec']) < 0.005
        fp = abs(r['dMin'] - r['outset']) < 0.03 and abs(r['dMax'] - r['outset']) < 0.03
        check(f'W4 {sku}: level = record ({r["yRec"]:.3f} ft; mesh {r["yMin"]:.3f}..{r["yMax"]:.3f}; ray {r["hitY"] if r["hitY"] is None else round(r["hitY"], 3)})', lvl, f'src {r["src"]}')
        check(f'W4 {sku}: footprint = record outline + {r["outset"]:.3f} ft edge reach ({r["n"]} pts; {r["dMin"]:.3f}..{r["dMax"]:.3f})', fp)
        check(f'W5 {sku}: outline inside the vessel, level within its height', r['inside'] and r['vbox'][0] < r['yRec'] < r['vbox'][1], json.dumps(r['vbox']))

    # ---- W2 dials -> params + uniforms; W3 the picture changes
    look(pg, 236.5, 213.5, 14, 55)
    u0 = pg.evaluate('fx.water.uniforms()')
    img0 = stage_px(pg, f'{outdir}/water-w3-before.png')
    for path, val in [('water.color.clarity', '0.1'), ('water.surface.gloss', '0.2')]:
        pg.locator(f'[data-path="{path}"]').evaluate(f"e => {{ e.value = '{val}'; e.dispatchEvent(new Event('input', {{ bubbles: true }})); }}")
    pg.locator('[data-path="water.color.deep"]').evaluate("e => { e.value = '#802010'; e.dispatchEvent(new Event('input', { bubbles: true })); }")
    time.sleep(0.6)
    P = pg.evaluate("fx.params('water')"); u1 = pg.evaluate('fx.water.uniforms()')
    check('W2a clarity dial -> params and absorption uniform', abs(P['color']['clarity'] - 0.1) < 1e-6 and u1['absorb'] > u0['absorb'] * 2, f"absorb {u0['absorb']:.2f} -> {u1['absorb']:.2f}")
    check('W2b gloss dial -> roughness uniform', abs(P['surface']['gloss'] - 0.2) < 1e-6 and u1['rough'] > u0['rough'] * 2, f"rough {u0['rough']:.3f} -> {u1['rough']:.3f}")
    check('W2c deep colour swatch -> uniform', P['color']['deep'] == '#802010' and u1['deep'][0] > u1['deep'][2], json.dumps(u1['deep']))
    img1 = stage_px(pg, f'{outdir}/water-w3-after.png')
    wash = pg.evaluate("(() => { const s = fx.water.surfaces().find(s => s.sku === 'washtub--empty'); const c = s.outline.reduce((a, p) => [a[0] + p[0] / s.outline.length, a[1] + p[1] / s.outline.length, a[2] + p[2] / s.outline.length], [0, 0, 0]); const q = tuner.project3(...c); const r = document.querySelector('#stage').getBoundingClientRect(); return [q.x - r.left, q.y - r.top]; })()")
    box = (int(wash[0]) - 40, int(wash[1]) - 25, int(wash[0]) + 40, int(wash[1]) + 25)
    d3 = region_diff(img0, img1, box)
    check('W3 the dials change the picture of the washtub water', d3 > 6, f'mean diff {d3:.1f} in {box}')
    pg.select_option('#fx-water-load', 'builtin:well-water'); time.sleep(0.5)

    # ---- W6/W7 cursor drag over the stone trough
    look(pg, 257, 212, 16, 55)
    tr = pg.evaluate("fx.water.surfaces().find(s => s.sku === 'horse-trough-stone--empty')")
    xs = [q[0] for q in tr['outline']]; zs = [q[2] for q in tr['outline']]; cx, cz = sum(xs) / len(xs), sum(zs) / len(zs)
    wlen = (max(xs) - min(xs)); dlen = (max(zs) - min(zs)); along_x = wlen >= dlen
    a3 = [cx - wlen * 0.33, tr['y'], cz] if along_x else [cx, tr['y'], cz - dlen * 0.33]
    b3 = [cx + wlen * 0.33, tr['y'], cz] if along_x else [cx, tr['y'], cz + dlen * 0.33]
    A = pg.evaluate(f"tuner.project3({a3[0]}, {a3[1]}, {a3[2]})"); B = pg.evaluate(f"tuner.project3({b3[0]}, {b3[1]}, {b3[2]})")
    before = stage_px(pg, f'{outdir}/water-w7-0.png')
    pg.mouse.move(A['x'], A['y'])
    for i in range(31):
        t = i / 30; pg.mouse.move(A['x'] + (B['x'] - A['x']) * t, A['y'] + (B['y'] - A['y']) * t); time.sleep(0.025)
    on_path = [[a3[0] + (b3[0] - a3[0]) * k / 8, a3[2] + (b3[2] - a3[2]) * k / 8] for k in range(9)]
    # read at once: the path vs points of the SAME trough across from it (near the far long wall), where the ripples
    # have not arrived yet; and a vessel nobody touched has no ripple block at all
    across_pts = [[p_[0], p_[1] + dlen * 0.4] if along_x else [p_[0] + wlen * 0.4, p_[1]] for p_ in on_path]
    both = pg.evaluate(f"fx.water.readHeights('horse-trough-stone--empty', {json.dumps(on_path + across_pts)})")
    h_on, h_far = both[:len(on_path)], both[len(on_path):]
    on_mag = sum(abs(v or 0) for v in h_on) / len(h_on); far_mag = sum(abs(v or 0) for v in h_far) / len(h_far)
    quiet = pg.evaluate("fx.water.readHeights('bucket--empty', [[0, 0]])")[0]
    check('W6a a cursor drag disturbs the heightfield along its path (readback), not across the trough from it', on_mag > 1e-4 and on_mag > 4 * far_mag and quiet is None,
          f'mean |h| on path {on_mag:.5f} vs across {far_mag:.5f}; untouched bucket: {quiet}; on path ' + ' '.join(f'{(v or 0):+.4f}' for v in h_on))
    frames = [stage_px(pg, f'{outdir}/water-w7-{k}.png') for k in (1, 2)]
    time.sleep(0.6); frames.append(stage_px(pg, f'{outdir}/water-w7-3.png'))
    xs2 = [A['x'], B['x']]; ys2 = [A['y'], B['y']]
    r = pg.evaluate("document.querySelector('#stage').getBoundingClientRect().toJSON()")
    pbox = (int(min(xs2) - r['x'] - 20), int(min(ys2) - r['y'] - 20), int(max(xs2) - r['x'] + 20), int(max(ys2) - r['y'] + 20))
    diffs = [region_diff(before, f, pbox) for f in frames] + [region_diff(frames[0], frames[2], pbox)]
    check('W7 ripples show behind the cursor across frames (and keep moving)', diffs[0] > 1.5 and diffs[3] > 0.8, ' '.join(f'{d:.2f}' for d in diffs))
    pg.mouse.move(5, 5)

    # ---- W8 flow advects (river) vs a still pond
    def drift(body_id, x, z, fdx, fdz):  # a ripple's energy centroid (2-D, |h|^2-weighted), projected on the flow direction
        pg.evaluate(f"fx.water.touch({x}, 0.08, {z}, 1.5, 0.5)")
        grid = [[x + (i - 20) * 0.25, z + (j - 20) * 0.25] for j in range(41) for i in range(41)]
        def cen():
            h = pg.evaluate(f"fx.water.readHeights({json.dumps(body_id)}, {json.dumps(grid)})")
            w = [abs(v or 0) ** 2 for v in h]; s = sum(w) or 1e-12
            cx = sum(g[0] * wk for g, wk in zip(grid, w)) / s - x; cz = sum(g[1] * wk for g, wk in zip(grid, w)) / s - z
            return cx * fdx + cz * fdz, s
        time.sleep(0.1); c0, s0 = cen(); time.sleep(0.9); c1, s1 = cen()
        return c0, c1, s0, s1
    mid = pg.evaluate("fx.water.bodies().find(b => b.id === 'demo-river').pts[2]")
    f = pg.evaluate(f"fx.water.flowAt('demo-river', {mid[0]}, {mid[1]})"); fl = math.hypot(*f) or 1
    c0, c1, s0, s1 = drift('demo-river', mid[0], mid[1], f[0] / fl, f[1] / fl)
    check('W8a the river carries a ripple downstream', c1 - c0 > 0.6, f'centroid {c0:+.2f} -> {c1:+.2f} ft along the flow in ~1 s ({fl:.2f} ft/s mid-stream)')
    pc = pg.evaluate("(() => { const d = fx.water.bodies().find(b => b.id === 'demo-pond'); const n = d.pts.length; return [d.pts.reduce((s, p) => s + p[0], 0) / n, d.pts.reduce((s, p) => s + p[1], 0) / n]; })()")
    fp = pg.evaluate(f"fx.water.flowAt('demo-pond', {pc[0]}, {pc[1]})"); fpl = math.hypot(*fp) or 1
    c0p, c1p, _, _ = drift('demo-pond', pc[0], pc[1], fp[0] / fpl, fp[1] / fpl)
    check('W8b the millpond barely drifts', abs(c1p - c0p) < max(0.3, (c1 - c0) * 0.4), f'pond centroid {c0p:+.2f} -> {c1p:+.2f} ft ({fpl:.2f} ft/s)')

    # ---- W9 wading pawn, W10 dropped stone
    pg.click('#fx-water-wade'); time.sleep(3.2)
    pw = pg.evaluate("(() => { const g = fx.water.tools.pawn().group.position; return [g.x, g.z]; })()")
    hp = pg.evaluate(f"fx.water.readHeights('demo-river', {json.dumps([[pw[0] + dx, pw[1] + dz] for dx in (-1, 0, 1) for dz in (-1, 0, 1)])})")
    check('W9 a pawn wading across the river leaves ripples', sum(abs(v or 0) for v in hp) > 2e-3, ' '.join(f'{(v or 0):+.4f}' for v in hp))
    look(pg, 236.5, 213.5, 14, 55)
    pg.click('#fx-water-drop')
    # wait for the stone to LAND (it falls frame by frame: slow on software GL), then read promptly
    pg.wait_for_function('(() => { const s = fx.water.tools.stones().slice(-1)[0]; return !!s && s.done; })()', timeout=30000); time.sleep(0.12)
    sk = pg.evaluate("(() => { const s = fx.water.tools.stones().slice(-1)[0]; return [s.group.position.x, s.group.position.z]; })()")
    tgt = pg.evaluate(f"(() => {{ const S = fx.water.surfaces().filter(s => s.visible); let best = null, bd = 1e9; for (const s of S) {{ const n = s.outline.length, c = s.outline.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[2] / n], [0, 0]); const d = Math.hypot(c[0] - {sk[0]}, c[1] - {sk[1]}); if (d < bd) {{ bd = d; best = s.sku; }} }} return best; }})()")
    hs = pg.evaluate(f"fx.water.readHeights({json.dumps(tgt)}, {json.dumps([[sk[0] + dx * 0.15, sk[1] + dz * 0.15] for dx in (-1, 0, 1) for dz in (-1, 0, 1)])})")
    check(f'W10 a stone dropped into the {tgt} splashes', sum(abs(v or 0) for v in hs) > 2e-3, ' '.join(f'{(v or 0):+.4f}' for v in hs))
    stage_px(pg, f'{outdir}/water-w10-splash.png')

    # ---- W11 draw a river with the tool (clicks on the canvas)
    look(pg, 200, 150, 60, 60)
    nb0 = pg.evaluate('fx.water.bodies().length')
    pg.click('#fx-water-river')
    for (x, z) in [(180, 140), (195, 150), (210, 145), (225, 158)]:
        q = pg.evaluate(f'tuner.project3({x}, 0, {z})'); pg.mouse.click(q['x'], q['y']); time.sleep(0.15)
    pg.keyboard.press('Enter'); time.sleep(0.8)
    nb1 = pg.evaluate('fx.water.bodies().length'); rooms = pg.evaluate('tuner.rooms().length')
    check('W11 drawing a river with the tool adds a body (and draws no room)', nb1 == nb0 + 1 and rooms == 0, f'{nb0} -> {nb1}, rooms {rooms}')
    stage_px(pg, f'{outdir}/water-w11-drawn.png')

    # ---- W12 presets
    pg.select_option('#fx-water-load', 'builtin:murky-canal'); time.sleep(0.3)
    check('W12a built-in preset loads (murky canal)', pg.evaluate("fx.params('water').name") == 'murky-canal' and pg.evaluate("fx.params('water').color.clarity") < 0.2)
    pg.fill('#fx-water-name', 'water-acceptance-test'); pg.click('#fx-water-save')
    check('W12b preset saved in this browser', pg.locator('#fx-water-load option[value="local:water-acceptance-test"]').count() == 1)
    if api_origin or True:
        pg.fill('#fx-water-note', 'acceptance test (Fauna)'); pg.click('#fx-water-send'); time.sleep(1.5)
        recs = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/fx').then(r => r.text())"))
        rec = recs.get('water-acceptance-test')
        check('W12c Send: kind "fx", data.fx = "water", read back from the server', bool(rec) and rec['data'].get('fx') == 'water' and rec['data'].get('name') == 'water-acceptance-test', json.dumps(rec)[:120] if rec else 'missing')
        # ---- W13 Use in game
        pg.click('#fx-water-house'); time.sleep(1.5)
        house = json.loads(pg.evaluate("fetch('/api/tw-ratings/tuner/house').then(r => r.text())"))
        hw = house.get('water') or {}
        check('W13 "Use in game" stores the house water (GET /tuner/house -> water)', hw.get('fx') == 'water' and hw.get('name') == 'water-acceptance-test' and 'water' in house.get('at', {}), json.dumps(hw)[:100])

    # ---- W15 quality dial
    res = {}
    for q in ['low', 'laptop', 'high']:
        pg.locator('[data-path="water.quality.level"]').evaluate(f"e => {{ e.value = '{q}'; e.dispatchEvent(new Event('input', {{ bubbles: true }})); }}")
        look(pg, 236.5, 213.5, 14, 55); time.sleep(0.4)
        res[q] = pg.evaluate('fx.water.stats()')['water_grab']
    check('W15 quality dial: low/laptop half-res refraction, high full-res', res['low'] == res['laptop'] and res['high'] != res['laptop'], json.dumps(res))

    # ---- W14 plain path (Lighting FX off)
    pg.select_option('#fx-water-load', 'builtin:well-water')
    pg.evaluate("(() => { const p = fx.params('lighting'); p.on = false; fx.setParams('lighting', p); })()"); time.sleep(0.8)
    sp = pg.evaluate('fx.water.stats()')
    check('W14a Lighting FX off: the plain path still draws the water', sp['water_grab'] == 'plain' and sp['water_draw_calls'] > 0, json.dumps({k: sp[k] for k in ('water_grab', 'water_draw_calls')}))
    stage_px(pg, f'{outdir}/water-w14-plain.png')
    check('W16 no page errors (tuner)', not errs, '; '.join(errs[:3]))
    pg.close()

    pg2, errs2 = open_tuner(b, '&nofx')
    s2 = pg2.evaluate('fx.water.stats()')
    check('W14b ?nofx: water off (layout tests untouched)', s2['water_on'] is False, json.dumps(s2)[:120])
    check('W16b no page errors (?nofx)', not errs2, '; '.join(errs2[:3]))
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
sys.exit(0 if ok else 1)
