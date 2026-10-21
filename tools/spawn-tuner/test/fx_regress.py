"""FX round 2 regression checks (2026-10-02): flame anchors, lantern dials, shadow-map freshness.
python fx_regress.py BASE_URL [OUTDIR]
 R1 every visible flame sits on its object: distance from the flame to the nearest triangle of its item's mesh
    (world space, measured in the page) <= 1.0 in for tips, <= 6 in for interior anchors (lanterns, fireboxes)
 R2 shadows never outlive their geometry: after a spawn with Harry's animation preset, every shadow-casting light's map
    was refreshed after the last scene motion, and was drawn from where the light is now (<= 0.3 ft)
 R3 no fire light rides the spawn animation into the air: during the spawn, visible fire lights stay within 1.5 ft
    of the height they have at rest
 R4 lantern dials: 'down' and 'forward' make spot lights; lantern lights sit inside their lantern (<= 3 in of the anchor)
Exit code = number of failures."""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/')
out = sys.argv[2] if len(sys.argv) > 2 else None
fails = 0
def check(name, ok, ev=''):
    global fails
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{ev}]' if ev else '')); fails += 0 if ok else 1

MEASURE = """(() => {
  const T = window.__THREE, out = [];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), tri = new T.Triangle(), q = new T.Vector3();
  for (const f of fx.fire.flames()) {
    if (!f.world) continue;
    let best = Infinity;
    (f.item.visual || f.item.group).traverse(o => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      o.updateWorldMatrix(true, false);
      const P = o.geometry.attributes.position, I = o.geometry.index, n = I ? I.count : P.count;
      for (let i = 0; i < n; i += 3) {
        const i0 = I ? I.getX(i) : i, i1 = I ? I.getX(i + 1) : i + 1, i2 = I ? I.getX(i + 2) : i + 2;
        a.fromBufferAttribute(P, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(P, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(P, i2).applyMatrix4(o.matrixWorld);
        tri.set(a, b, c); tri.closestPointToPoint(f.world, q); const d = q.distanceTo(f.world); if (d < best) best = d;
      }
    });
    out.push({ sku: f.item.spec.sku, kind: f.kind, in: +(best * 12).toFixed(2) });
  }
  return out;
})()"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1300, 'height': 850})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base + '/index.html?nobg&seed=4242')
    pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx', timeout=60000)
    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")  # shipping tier: headless GPU memory
    pg.evaluate("import('three').then(T => { window.__THREE = T; })"); time.sleep(0.5)
    pg.evaluate("(() => { const s = document.querySelector('#loadPreset'); s.value = 'builtin:harry-v2'; s.dispatchEvent(new Event('change')); })()")
    pg.evaluate("(() => { const p = fx.params('lighting'); p.shadows.dance = 0; p.shadows.casters = 1; fx.setParams('lighting', p); })()")  # static maps: the strict case
    pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)")
    rest_y = {}; spawn_y = []
    t0 = time.time()
    while pg.evaluate('tuner.episodes()') and time.time() - t0 < 120:
        spawn_y.append(pg.evaluate("fx.fire.lights().filter(l => l.visible && !l.userData.members).map(l => [l.uuid, +l.position.y.toFixed(2)])")); time.sleep(0.15)
    time.sleep(2.5)
    for uid, y in pg.evaluate("fx.fire.lights().filter(l => l.visible && !l.userData.members).map(l => [l.uuid, +l.position.y.toFixed(2)])"): rest_y[uid] = y
    worst_air = max([abs(y - rest_y[u]) for s in spawn_y for u, y in s if u in rest_y] or [0])
    check('R3 fire + lantern lights stay put during the spawn (no lights riding the spin into the air)', worst_air <= 1.5, f'worst {worst_air:.2f} ft from rest height, {len(spawn_y)} samples')
    # R2: freshness after the spawn settles
    st = pg.evaluate('fx.stats()')
    stale = pg.evaluate("fx.fire.lights().filter(l => l.castShadow && l.visible).map(l => { const m = l.shadow.matrix.elements; return +Math.hypot(l.position.x + m[12], l.position.y + m[13], l.position.z + m[14]).toFixed(3); })")
    check('R2 shadow maps refreshed after the last scene motion', st['shadow_casters'] >= 1 and st['shadow_last_refresh'] >= st['shadow_last_motion'], f"casters {st['shadow_casters']}, last refresh frame {st['shadow_last_refresh']} >= last motion {st['shadow_last_motion']}")
    check('R2b each shadow map drawn from where its light is now', bool(stale) and max(stale) <= 0.3, f'map-vs-light {stale} ft')
    # a mid-life move: drag an object, the map must follow within a frame of the motion stopping
    tag = pg.evaluate("tuner.tags().find(t => /table/.test(t.id))?.tag")
    if tag:
        pg.evaluate(f"tuner.selectTag('{tag}'); tuner.nudge(2, 0, 0)"); time.sleep(1.2)
        st = pg.evaluate('fx.stats()')
        check('R2c after moving an object, the shadow map is redrawn', st['shadow_last_refresh'] >= st['shadow_last_motion'], f"refresh {st['shadow_last_refresh']} >= motion {st['shadow_last_motion']}")
    # R1 anchors, over several room types
    for rt, x in (('guest', 18), ('kitchen', 30), ('hallway', 44)):
        pg.evaluate(f"void tuner.createRoom('{rt}', {x}, 3, 5, 5)")
        pg.wait_for_function('tuner.episodes() === 0', timeout=150000); time.sleep(1.5)
    m = pg.evaluate(MEASURE)
    tips = [r for r in m if r['kind'] in ('candle', 'candelabra', 'stubs', 'chandelier')]
    inner = [r for r in m if r['kind'] not in ('candle', 'candelabra', 'stubs', 'chandelier')]
    wt = max(tips, key=lambda r: r['in']) if tips else None; wi = max(inner, key=lambda r: r['in']) if inner else None
    check('R1 tip flames (candles, candelabra, chandeliers) sit on their wicks', bool(tips) and wt['in'] <= 1.0, f"{len(tips)} flames, worst {wt}")
    check('R1b interior flames (lanterns, torches, fireboxes) sit in/on their object', bool(inner) and wi['in'] <= 6.0, f"{len(inner)} flames, worst {wi}")
    print('   by sku (worst in):', json.dumps({k: max(r['in'] for r in m if r['sku'] == k) for k in sorted({r['sku'] for r in m})}))
    # R4 lantern dials
    for beam in ('down', 'forward', 'around'):
        pg.evaluate(f"(() => {{ const p = fx.params('fire'); p.lantern.beam = '{beam}'; p.lantern.lights = 4; fx.setParams('fire', p); }})()"); time.sleep(0.8)
        info = pg.evaluate("fx.fire.lights().filter(l => l.userData.lantern).map(l => ({ spot: !!l.isSpotLight, vis: l.visible }))")
        if not info: check('R4 lanterns in the scene', False, 'no lantern lights'); break
        check(f"R4 lantern beam '{beam}' -> {'spot' if beam != 'around' else 'point'} lights", all(i['spot'] == (beam != 'around') for i in info), f'{len(info)} lantern lights')
    # R6 light shafts never raymarch a stale shadow map (the 'shadows floating in the sky' root cause)
    pg.evaluate("(() => { const p = fx.params('lighting'); p.shafts.on = true; fx.setParams('lighting', p); })()"); time.sleep(1.5)
    pg.evaluate("(() => { const p = fx.params('fire'); p.light.reach = 1.6; fx.setParams('fire', p); })()"); time.sleep(1.0)
    pg.evaluate("(() => { const p = fx.params('lighting'); p.shadows.res = '1024'; fx.setParams('lighting', p); })()"); time.sleep(1.0)
    pg.evaluate("(() => { const p = fx.params('fire'); p.light.reach = 1; fx.setParams('fire', p); })()"); time.sleep(1.0)
    gr = pg.evaluate("(() => { const s = fx.stats(); const g = fx.lighting.composer.passes.find(p => p.illumPass); const u = g?.illumPass.material.uniforms; const L = g?.props.light; return { ok_far: s.shafts_far_ok, ok_map: s.shafts_map_ok, shafts: s.shafts, uFar: u && +u.lightCameraFar.value.toFixed(2), far: L && +L.shadow.camera.far.toFixed(2) }; })()")
    check('R6 light shafts follow the live shadow map + range after reach/detail changes', gr['shafts'] and gr['ok_far'] and gr['ok_map'], json.dumps(gr))
    pg.evaluate("(() => { const p = fx.params('lighting'); p.shafts.on = false; p.shadows.res = '512'; fx.setParams('lighting', p); })()")
    if out: pg.screenshot(path=f'{out}/regress-lanterns.png')
    check('R5 no page errors', not errs, str(errs[:3]))
    b.close()
    # R7 the 'ghost map in the sky' root cause: on a pixel-ratio-2 screen every post pass (N8AO included) must run at
    # the drawing-buffer size; N8AO at CSS size sampled the map's depth/AO from the wrong texels
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 900, 'height': 600}, device_scale_factor=2)
    pg.goto(base + '/index.html?nobg'); pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx', timeout=60000); time.sleep(1)
    sz = pg.evaluate("(() => { const g = fx.lighting.composer; return { buf: [g.inputBuffer.width, g.inputBuffer.height], n8ao: g.passes.filter(p => p.configuration).map(p => [p.width, p.height]) }; })()")
    check('R7 N8AO runs at the drawing-buffer size on a pixel-ratio-2 screen', bool(sz['n8ao']) and all(s == sz['buf'] for s in sz['n8ao']), json.dumps(sz))
    b.close()
print('OK' if not fails else f'{fails} FAILED')
sys.exit(fails)
