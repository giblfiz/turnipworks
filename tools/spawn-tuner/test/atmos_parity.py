"""Atmosphere PARITY: is the fog the same in the Spawn Tuner and in the game?  (2026-10-05)
Harry: "is the fog really truly the same in game and tuner? because it sure feels different." It was the same CODE showing
different VALUES (the game's house atmosphere was not what he had tuned). This builds the same scene in both (a common
room at 4,3 7x5, the game's house atmosphere loaded into the tuner), puts both on the same camera and viewport, and fails
when anything the atmosphere module exposes, or anything measured from it, differs beyond a tolerance:
P1 the house atmosphere the game loaded is the one the server holds, and the tuner takes the same values
P2 params, lighting, sim window, fx resolution and every volume-shader uniform are equal
P3 probes: mist density, wind vector, how fast the fog pattern travels, fog in the room
P4 a scripted cursor stroke stirs the same footprint, as hard, and dies away as fast
P5 the fog sea (world.unbuilt): same density; its banks stay put and only a faint ripple travels, equally in both; with
   world.drift (off by default) the banks travel with the wind, equally in both
P6 flow.radiusPx (off by default): the cursor's footprint follows the screen, equally in both
P7 on screen: the ground shows through the fog equally; frame rate; no page errors
Known, deliberate differences are listed in KNOWN (camera defaults, far plane, the room's furniture) and printed.
python atmos_parity.py [TUNER_URL] [GAME_URL] [OUT_JSON]   (defaults: the live tuner and game). GPU flags as atmos_game.py.
Game changes here are local to the test's own tab and throwaway campaign; nothing is written to the house look."""
import sys, time, json, io, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
TUNER = (sys.argv[1] if len(sys.argv) > 1 else 'https://implausible.enterprises/projects/turnip-works/tuner/').rstrip('/') + '/'
GAME = (sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8180/').rstrip('/') + '/'
OUT = sys.argv[3] if len(sys.argv) > 3 else None
API = os.environ.get('TW_API')  # e.g. http://127.0.0.1:8096 when TUNER_URL is a local static server
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
# JS: one dump function, given accessors
DUMP = """async (S) => { const THREE = await import('three'); const fx = S.fx, a = fx.atmos, cam = S.grab.camera, cv = S.canvas;
  const ser = (v) => v == null ? v : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' ? (typeof v === 'number' ? +v.toFixed(5) : v) : v.isTexture ? 'tex:' + (v.image?.width ?? '?') + 'x' + (v.image?.height ?? '?') : v.isMatrix4 ? 'mat4' : v.toArray ? v.toArray().map(x => +x.toFixed(5)) : Array.isArray(v) ? 'array[' + v.length + ']' : typeof v;
  const d = a._debug(); const U = {}; for (const [k, u] of Object.entries(d.volMat.uniforms)) U[k] = ser(u.value);
  const CU = {}; for (const [k, u] of Object.entries(d.compMat.uniforms)) CU[k] = ser(u.value);
  const cp = cam.getWorldPosition(new THREE.Vector3()); const r = cv.getBoundingClientRect();
  return { params: fx.params('atmos'), lighting: fx.params('lighting'), fire: fx.params('fire'), stats: fx.stats(), domain: a.domain(), world: a.world(), uniforms: U, composite: CU,
    fxRT: [d.fxRT.width, d.fxRT.height], debug: { litSeen: d.litSeen, pendingPuffs: d.pendingPuffs, flames: d.flames }, rooms: a.rooms(), regions: a.regions(),
    canvas: { css: [Math.round(r.width), Math.round(r.height)], buffer: [cv.width, cv.height], dpr: devicePixelRatio, ratio: +(cv.width / r.width).toFixed(3) },
    camera: { fov: cam.fov, near: cam.near, far: cam.far, aspect: +cam.aspect.toFixed(4), pos: cp.toArray().map(x => +x.toFixed(3)) },
    grab: { focus: S.grab.focus.toArray().map(x => +x.toFixed(3)), yaw: S.grab.yaw, pitch: S.grab.pitch, dist: +S.grab.dist.toFixed(3) },
    passes: fx.lighting.passes ? fx.lighting.passes() : null,
  }; }"""
T_S = "({ fx: window.fx, grab: tuner.cam, canvas: document.querySelector('#stage canvas') || document.querySelector('canvas') })"
G_S = "(() => { const w = tw.worldOf(tw.area()); return { fx: w.fx, grab: tw.main.grab, canvas: document.querySelector('canvas') }; })()"
def dump(pg, S): return pg.evaluate(f"({DUMP})({S})")
def flat(o, pre=''):
    out = {}
    if isinstance(o, dict):
        for k, v in o.items(): out.update(flat(v, f'{pre}{k}.'))
    elif isinstance(o, list) and o and not all(isinstance(x, (int, float, str, bool, type(None))) for x in o):
        for i, v in enumerate(o): out.update(flat(v, f'{pre}{i}.'))
    else: out[pre[:-1]] = o
    return out
def diff(a, b, tol=1e-4):
    fa, fb = flat(a), flat(b); rows = []
    for k in sorted(set(fa) | set(fb)):
        x, y = fa.get(k, '<none>'), fb.get(k, '<none>')
        if x == y: continue
        if isinstance(x, (int, float)) and isinstance(y, (int, float)) and not isinstance(x, bool) and abs(x - y) <= tol * max(1, abs(x), abs(y)): continue
        if isinstance(x, list) and isinstance(y, list) and len(x) == len(y) and all(isinstance(p, (int, float)) and isinstance(q, (int, float)) and abs(p - q) <= tol * max(1, abs(p), abs(q)) for p, q in zip(x, y)): continue
        rows.append((k, x, y))
    return rows

CAM = dict(focus=(45, 35), yaw=-20, pitch=52, dist=110, fov=42)
def shot(pg, clip=None, path=None):
    b = pg.screenshot(clip=clip) if clip else pg.screenshot()
    if path: open(path, 'wb').write(b)
    return np.asarray(Image.open(io.BytesIO(b)).convert('RGB')).astype(np.float32)
def lum(a): return a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
def phase_shift(a, b):
    """shift (dx, dy) in px that maps patch a onto patch b, by phase correlation of high-passed luminance; and the peak's strength"""
    def prep(x):
        x = lum(x); x = x - x.mean(); w = np.outer(np.hanning(x.shape[0]), np.hanning(x.shape[1])); return x * w
    A, B = np.fft.fft2(prep(a)), np.fft.fft2(prep(b)); R = np.conj(A) * B; R /= np.abs(R) + 1e-6
    # keep low/mid frequencies (fog is soft): mask out the highest (dither, noise)
    fy = np.fft.fftfreq(R.shape[0])[:, None]; fx_ = np.fft.fftfreq(R.shape[1])[None, :]; R *= (np.hypot(fx_, fy) < 0.12)
    c = np.fft.ifft2(R).real; iy, ix = np.unravel_index(np.argmax(c), c.shape)
    dy = iy if iy < c.shape[0] // 2 else iy - c.shape[0]; dx = ix if ix < c.shape[1] // 2 else ix - c.shape[1]
    return dx, dy, float(c.max() / (c.std() + 1e-9))
class Surf:
    """one surface (tuner or game) with the same verbs"""
    def __init__(s, pg, kind): s.pg, s.kind = pg, kind; s.S = T_S if kind == 'tuner' else G_S; s.fx = 'fx' if kind == 'tuner' else 'tw.worldOf(tw.area()).fx'
    def ev(s, js): return s.pg.evaluate(js)
    def dump(s): return dump(s.pg, s.S)
    def cam(s, focus, yaw, pitch, dist, fov=None):
        g = 'tuner.cam' if s.kind == 'tuner' else 'tw.main.grab'
        s.ev(f"(() => {{ const g = {g}; g.focus.set({focus[0]}, 0, {focus[1]}); g.yaw = {yaw}; g.pitch = {pitch}; g.dist = {dist}; {'g.camera.fov = %s; g.camera.updateProjectionMatrix();' % fov if fov else ''} g.update(); }})()")
    def room(s, type_, x, z, w, d, seed=4242):
        if s.kind == 'tuner':
            s.ev(f"void tuner.createRoom('{type_}', {x}, {z}, {w}, {d})"); s.pg.wait_for_function('tuner.episodes() === 0', timeout=240000)
        else:
            s.ev(f"tw.spawnRoom('{type_}', {x}, {z}, {w}, {d}, {seed})"); time.sleep(1.5); s.pg.wait_for_function('tw.spawningNow().anims === 0', timeout=240000)
    def clip(s):
        sel = '#stage' if s.kind == 'tuner' else 'canvas'
        r = s.ev(f"(() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return {{ x: r.left, y: r.top, width: r.width, height: r.height }}; }})()"); return r
    def screen(s, x, z, y=0):
        if s.kind == 'tuner': return s.ev(f"tuner.project3({x}, {y}, {z})")
        return s.ev(f"tw.screenOf({x}, {z}, tw.main, {y})")
    def probe(s, name, pts): return s.ev(f"{s.fx}.atmos.probe('{name}', {json.dumps(pts)})")
    def setp(s, kind, patch):
        s.ev(f"(() => {{ const f = {s.fx}; const p = f.params('{kind}'); const c = {json.dumps(patch)}; for (const [k, v] of Object.entries(c)) {{ if (v && typeof v === 'object') Object.assign(p[k], v); else p[k] = v; }} f.setParams('{kind}', p); }})()")
    def hide_ui(s, on=True):
        if s.kind == 'tuner': s.ev(f"tuner.hideLabels({'true' if on else 'false'})"); s.ev("tuner.select && tuner.select(null)")
        else: s.ev("(() => { let st = document.getElementById('__hide'); if (!st) { st = document.createElement('style'); st.id = '__hide'; document.head.append(st); } st.textContent = %s; })()" % json.dumps("body *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }" if on else ""))
def open_tuner(b, vw=1700, vh=950, q='?nobg&seed=4242', sea=True):
    ct = b.new_context(viewport={'width': vw, 'height': vh}); pg = ct.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.add_init_script("try { for (const k of Object.keys(localStorage)) if (k.startsWith('tuner.fx')) localStorage.removeItem(k); } catch (e) {}")
    if API: tw_sandbox.proxy(pg, API)
    pg.goto(TUNER + 'index.html' + q); pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx && !!fx.atmos')
    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); if (s) { s.value = 'baked'; s.dispatchEvent(new Event('change')); } })()")
    if sea: pg.evaluate("document.querySelector('details.major[data-key=\"atmos\"]').open = true"); pg.check('#fx-atmos-unbuilt')
    return Surf(pg, 'tuner')
def open_game(b, vw, vh, q='?nointro', name='TEST fauna fog-parity (throwaway)'):
    cg = b.new_context(viewport={'width': vw, 'height': vh}); pg = cg.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.goto(GAME + q); pg.wait_for_selector('#newCampaign input[name=gm]', timeout=30000)
    pg.fill('#newCampaign input[name=name]', name); pg.fill('#newCampaign input[name=gm]', 'Fauna parity test'); pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
    return Surf(pg, 'game')

FIELD = """(a, wind) => { const f = a.readField('velocity'), d = a.domain(); if (!f) return null; const n = f.w * f.h; const vx = [], vz = [];
  for (let i = 0; i < n; i += 7) { vx.push(f.data[i * 4]); vz.push(f.data[i * 4 + 1]); } vx.sort((p, q) => p - q); vz.sort((p, q) => p - q);
  const mx = vx[vx.length >> 1], mz = vz[vz.length >> 1]; let cells = 0, peak = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) { const o = (j * f.w + i) * 4, r = Math.hypot(f.data[o] - mx, f.data[o + 1] - mz); if (r > peak) peak = r; if (r > 0.5) { cells++; x0 = Math.min(x0, i); x1 = Math.max(x1, i); z0 = Math.min(z0, j); z1 = Math.max(z1, j); } }
  return { median: [+mx.toFixed(3), +mz.toFixed(3)], cells, area_ft2: +(cells * d.cell * d.cell).toFixed(1), peak: +peak.toFixed(2), cell: d.cell, box_ft: cells ? [+((x1 - x0 + 1) * d.cell).toFixed(1), +((z1 - z0 + 1) * d.cell).toFixed(1)] : [0, 0] }; }"""
def field(s): return s.ev(f"({FIELD})({s.fx}.atmos)")
def px_per_ft(s, at=(45, 35)):
    a, b = s.screen(at[0] - 5, at[1]), s.screen(at[0] + 5, at[1]); return float(np.hypot(a['x'] - b['x'], a['y'] - b['y']) / 10)
def refit(s):
    """same camera -> same sim window: re-allocate the window (a quality flip forces a fresh fit, no hysteresis from the camera's history)"""
    q = s.ev(f"{s.fx}.params('atmos').quality.level"); other = 'medium' if q != 'medium' else 'low'
    s.setp('atmos', {'quality': {'level': other}}); time.sleep(0.6); s.setp('atmos', {'quality': {'level': q}}); time.sleep(0.6)
def wiggle(s, pts, reps=3, gap=0.03):
    for _ in range(reps):
        for x, z in pts + pts[::-1]:
            c = s.screen(x, z, 0.5); s.pg.mouse.move(c['x'], c['y']); time.sleep(gap)
def park(s): cl = s.clip(); s.pg.mouse.move(cl['x'] + 3, cl['y'] + 3)
def fps(s, secs=3.0):
    return s.ev("new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < %d) requestAnimationFrame(f); else r(+(n * 1000 / (performance.now() - t0)).toFixed(1)); }; requestAnimationFrame(f); })" % int(secs * 1000))

def grid(s, name='density', ch=0):
    r = s.ev(f"(() => {{ const a = {s.fx}.atmos, f = a.readField('{name}'), d = a.domain(); const out = new Array(f.w * f.h); for (let i = 0; i < out.length; i++) out[i] = +f.data[i * 4 + {ch}].toFixed(4); return {{ w: f.w, h: f.h, cell: d.cell, x0: d.x0, z0: d.z0, shaderTime: a._debug().volMat.uniforms.uTime.value, data: out }}; }})()")
    return np.array(r['data'], dtype=np.float32).reshape(r['h'], r['w']), r
def corr_shift(a, b, lp=0.25):
    def prep(x): x = x - x.mean(); return x * np.outer(np.hanning(x.shape[0]), np.hanning(x.shape[1]))
    A, B = np.fft.fft2(prep(a)), np.fft.fft2(prep(b)); Rr = np.conj(A) * B; Rr /= np.abs(Rr) + 1e-9
    fy = np.fft.fftfreq(Rr.shape[0])[:, None]; fx_ = np.fft.fftfreq(Rr.shape[1])[None, :]; Rr *= (np.hypot(fx_, fy) < lp)
    c = np.fft.ifft2(Rr).real; iy, ix = np.unravel_index(np.argmax(c), c.shape)
    dy = iy if iy < c.shape[0] // 2 else iy - c.shape[0]; dx = ix if ix < c.shape[1] // 2 else ix - c.shape[1]
    return int(dx), int(dy), float(c.max() / (c.std() + 1e-9))
def field_drifts(surfaces, name='density', ch=0, secs=4.0, crops=None):
    """Compare the same time window in both renderers, never sequential windows.

    A near-static procedural ripple is not a constant translation: observing the
    game five seconds later than the tuner gives a different FFT displacement.
    """
    initial = [(grid(s, name, ch), time.monotonic()) for s in surfaces]
    time.sleep(secs)
    final = [(grid(s, name, ch), time.monotonic()) for s in surfaces]
    results = []
    for index, (((a, ra), ta), ((b, rb), tb)) in enumerate(zip(initial, final)):
        dt = tb - ta
        if (ra['x0'], ra['z0'], ra['cell']) != (rb['x0'], rb['z0'], rb['cell']):
            results.append(None); continue
        crop = crops[index] if crops else None
        if crop: a, b = a[crop], b[crop]
        dx, dy, q = corr_shift(a, b)
        results.append(dict(shader_time=[round(ra['shaderTime'],3),round(rb['shaderTime'],3)], elapsed=round(dt,3), vx=round(dx * ra['cell'] / dt, 3), vz=round(dy * ra['cell'] / dt, 3), speed=round(float(np.hypot(dx, dy)) * ra['cell'] / dt, 3), q=round(q, 1), change=round(float(np.abs(a - b).mean()), 4), mean=round(float(a.mean()), 4)))
    return results
def align_flow_clocks(surfaces):
    """Align procedural phase using the public speed control, then restore it.

    Separate hosts can lose different simulation time during earlier GPU work.
    Equal wall-clock sampling windows therefore need not show equal noise phases.
    Advance each paused clock to the same future target; never select a phase
    based on a measurement's result.
    """
    speeds = [s.ev(f"{s.fx}.params('atmos').flow.speed") for s in surfaces]
    for s in surfaces: s.setp('atmos', {'flow': {'speed': 0}})
    clocks = [s.ev(f"{s.fx}.atmos._debug().volMat.uniforms.uTime.value") for s in surfaces]
    target = max(clocks) + 1
    aligned = []
    for s, speed in zip(surfaces, speeds):
        aligned.append(s.ev(f"""async () => {{
          const f = {s.fx}, p = f.params('atmos');
          p.flow.speed = {speed}; f.setParams('atmos', p);
          return await new Promise((resolve, reject) => {{
            const until = performance.now() + 30000;
            function sample() {{
              const t = f.atmos._debug().volMat.uniforms.uTime.value;
              if (t >= {target}) {{ p.flow.speed = 0; f.setParams('atmos', p); resolve(t); }}
              else if (performance.now() > until) reject(new Error('flow clock did not advance'));
              else requestAnimationFrame(sample);
            }}
            requestAnimationFrame(sample);
          }});
        }}"""))
    for s, speed in zip(surfaces, speeds): s.setp('atmos', {'flow': {'speed': speed}})
    print(f'  flow phase alignment: {clocks} -> {aligned}; restored speeds {speeds}', flush=True)
    return dict(before=clocks, aligned=aligned, restored_speeds=speeds)
def screen_drift(s, n=6, gap=0.5, box=None):
    """the same on screen: frames of a patch of open ground, the static picture (grid lines, ground) averaged out -> px/s"""
    cl = s.clip(); pc = box or {'x': cl['x'] + cl['width'] - 300, 'y': cl['y'] + cl['height'] - 300, 'width': 256, 'height': 256}; fr = []; t = []
    for i in range(n): fr.append(lum(shot(s.pg, pc))); t.append(time.time()); time.sleep(gap)
    m = np.mean(fr, axis=0); out = []
    for i in range(1, n):
        dx, dy, q = corr_shift(fr[i - 1] - m, fr[i] - m, lp=0.1); out.append((dx / (t[i] - t[i - 1]), dy / (t[i] - t[i - 1]), q))
    o = np.array(out); return dict(px_s=[round(float(np.median(o[:, 0])), 1), round(float(np.median(o[:, 1])), 1)], speed=round(float(np.hypot(np.median(o[:, 0]), np.median(o[:, 1]))), 1), q=round(float(o[:, 2].mean()), 1), change=round(float(np.mean([np.abs(fr[i] - fr[i - 1]).mean() for i in range(1, n)])), 2))
def stir_once(s, pts):
    park(s); time.sleep(2.5); v0, r = grid(s, 'velocity', 0); w0, _ = grid(s, 'velocity', 1)
    wiggle(s, pts); time.sleep(0.1); v1, r1 = grid(s, 'velocity', 0); w1, _ = grid(s, 'velocity', 1); t0 = time.time()
    d = np.hypot(v1 - v0, w1 - w0); cells = int((d > 0.5).sum()); ys, xs = np.where(d > 0.5)
    dec = []
    for t in (1, 2, 4):
        time.sleep(max(0, t0 + t - time.time())); a, _ = grid(s, 'velocity', 0); c, _ = grid(s, 'velocity', 1); dec.append(round(float(np.hypot(a - v0, c - w0).max()), 2))
    park(s)
    wid = (min(xs.max() - xs.min() + 1, ys.max() - ys.min() + 1) * r['cell']) if cells else 0
    return dict(peak=float(d.max()), cells=cells, area=cells * r['cell'] ** 2, width_ft=float(wid), decay=dec)
def stir_stats(s, pts, n=4):
    rs = [stir_once(s, pts) for _ in range(n)]; ppf = px_per_ft(s, pts[len(pts) // 2])
    return dict(peak=round(float(np.median([r['peak'] for r in rs])), 2), cells=int(np.median([r['cells'] for r in rs])), area_ft2=round(float(np.median([r['area'] for r in rs])), 1), width_ft=round(float(np.median([r['width_ft'] for r in rs])), 1), width_px=round(float(np.median([r['width_ft'] for r in rs])) * ppf), px_per_ft=round(ppf, 2),
                decay_1_2_4s=[round(float(np.median([r['decay'][i] for r in rs])), 2) for i in range(3)], spread=[round(r['peak'], 1) for r in rs], splat_cells=s.ev(f"{s.fx}.stats().atmos_splat_cells"), cell=s.ev(f"{s.fx}.stats().atmos_cell_ft"))

def to_lin(a): a = a / 255.0; return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def hp(x):
    from numpy.lib.stride_tricks import sliding_window_view
    k = 9; p = np.pad(x, k // 2, mode='edge'); m = sliding_window_view(p, (k, k)).mean(axis=(2, 3)); return x - m
def paired_avg_shots(a, b, n=8, gap=0.35):
    """Sample both procedural views over the same interval, reversing capture order."""
    sums = {a.kind: None, b.kind: None}
    for i in range(n):
        for s in ((a, b) if i % 2 == 0 else (b, a)):
            frame = to_lin(shot(s.pg, s.clip()))
            sums[s.kind] = frame if sums[s.kind] is None else sums[s.kind] + frame
        time.sleep(gap)
    return {kind: total / n for kind, total in sums.items()}
def transmittance(F, C, ys, xs):
    """how much of the ground's own detail (grid lines, boards) still shows through the fog: regression of the fogged picture's fine detail on the clear one's (1 = no fog, 0 = opaque)"""
    f, c = hp(lum(F[ys, xs])), hp(lum(C[ys, xs])); return float((f * c).sum() / ((c * c).sum() + 1e-12))

# ------------------------------------------------------------------ the checks
KNOWN = {  # differences that are deliberate (the world around the fog), with what they are
    'camera.far': 'far plane: tuner 2000 ft, game 3000 ft', 'composite.uNF': 'the same far plane, as the upsample sees it', 'camera.aspect': 'canvas a pixel or two apart',
    'canvas.css': 'canvas a pixel or two apart', 'canvas.buffer': 'canvas a pixel or two apart', 'rooms.0.id': 'room ids', 'domain.sig': 'room ids / furniture', 'params.name': 'preset name',
}
NOISE = ('stats.shadow', 'stats.frame_', 'stats.programs', 'stats.water', 'stats.atmos_cpu', 'stats.atmos_sim_cpu', 'stats.atmos_sim_calls', 'stats.atmos_draw_calls', 'stats.atmos_gpu', 'uniforms.uTime', 'stats.atmos_zooms', 'stats.atmos_shifts', 'stats.atmos_xfade', 'stats.atmos_movers', 'stats.atmos_cursor_stirs', 'stats.atmos_stir_ft', 'stats.post_', 'stats.depth', 'stats.sel')
FURNITURE = ('debug.', 'stats.anchored_flames', 'stats.atmos_lights', 'stats.atmos_wisps', 'stats.fire_', 'stats.lantern_', 'stats.small_flames', 'stats.volume_flames', 'stats.atmos_pool_sources', 'stats.flame', 'stats.fire', 'stats.ao_', 'stats.graph_gen', 'stats.lights_shining', 'stats.light_', 'stats.shadow_')  # (ao_, graph_gen, lights, shadow_: counters of the scene around the fog, added 2026-10-06 with the big-map work)
fails = 0; REPORT = {'checks': [], 'known': [], 'numbers': {}}
def check(n, ok, ev=''):
    global fails; print(('PASS ' if ok else 'FAIL ') + n + (f'  [{ev}]' if ev else ''), flush=True); fails += 0 if ok else 1; REPORT['checks'].append([n, bool(ok), ev])
def close(a, b, rel=0.0, ab=0.0): return abs(a - b) <= max(ab, rel * max(abs(a), abs(b)))
OPEN = [[95 + 6 * i, 50 + 6 * j] for i in range(4) for j in range(4)]; ROOM = [[27 + 5 * i, 20 + 5 * j] for i in range(5) for j in range(4)]
def tmean(s, name, pts, n=6, gap=1.0):
    out = []
    for _ in range(n): out.append(float(np.mean([v for v in s.probe(name, pts) if v is not None]))); time.sleep(gap)
    return float(np.mean(out))
def both(f, T, G): return f(T), f(G)
def open_crop(s, name='heavy', ch=1):
    """the part of the sim window over open ground east of the room (the room's own hole in the field never moves, and would pin a correlation)"""
    g, r = grid(s, name, ch); i0 = int((70 - r['x0']) / r['cell']); return (slice(8, r['h'] - 8), slice(max(8, i0), r['w'] - 8))

if __name__ == '__main__':
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        T = open_tuner(b, sea=False); st = T.clip(); G = open_game(b, int(st['width']), int(st['height']))
        # P1 the game's house atmosphere; the tuner takes the same values
        house = G.ev("fetch((new URLSearchParams(location.search).get('api') || '/api/tw-ratings') + '/tuner/house', { cache: 'no-store' }).then(r => r.json()).catch(() => null)")
        gp = G.ev(f"{G.fx}.params('atmos')"); T.ev(f"fx.setParams('atmos', {json.dumps(gp)})")
        hn = (house or {}).get('atmos', {}).get('name') if house else None
        check('P1 the game runs the house atmosphere the server holds; the tuner takes the same values', (hn is None or gp['name'] == hn) and not diff(T.ev("fx.params('atmos')"), gp), f"game: {gp['name']}; server: {hn}; outdoor {gp['outdoor']['height']} ft at density {gp['outdoor']['density']}, wind {gp['outdoor']['drift']} ft/s, sea {gp['world']['unbuilt']}, stir radius {gp['flow']['radius']} ft, quality {gp['quality']['level']}")
        for s in (T, G): s.room('common', 4, 3, 7, 5)
        time.sleep(12)
        for s in (T, G): park(s)
        d0 = {s.kind: s.dump() for s in (T, G)}
        REPORT['numbers']['default_camera'] = {s.kind: dict(grab=d0[s.kind]['grab'], fov=d0[s.kind]['camera']['fov'], px_per_ft=round(px_per_ft(s, tuple(d0[s.kind]['grab']['focus'][::2])), 2), window=d0[s.kind]['stats']['atmos_grid'], fx_res=d0[s.kind]['stats']['atmos_fx_res']) for s in (T, G)}
        print('default cameras (deliberately different):', json.dumps(REPORT['numbers']['default_camera']))
        for s in (T, G): s.cam(**CAM); s.hide_ui()
        T.ev("document.querySelectorAll('#stage > *:not(canvas)').forEach(e => e.style.visibility = 'hidden')")
        time.sleep(1)
        for s in (T, G): refit(s)
        time.sleep(10)
        # P2 everything the module exposes
        dT, dG = T.dump(), G.dump(); rows = diff(dT, dG); bad = []
        for k, x, y in rows:
            if k.startswith(NOISE): continue
            if k in KNOWN or k.startswith(FURNITURE): REPORT['known'].append([k, x, y, KNOWN.get(k, "the room's furniture and fires (the two room generators furnish differently)")]); continue
            bad.append((k, x, y))
        for k, x, y in bad: print(f'   DIFFERS {k:34} tuner {json.dumps(x)[:60]:62} game {json.dumps(y)[:60]}')
        for k, x, y, why in REPORT['known']: print(f'   known   {k:34} tuner {json.dumps(x)[:40]:42} game {json.dumps(y)[:40]:42} {why}')
        nU = len(dT['uniforms'])
        check('P2 params, lighting, sim window, fx resolution and every volume uniform are equal at the same camera', not bad, f"{len(flat(dT))} fields compared ({nU} uniforms); window {dT['stats']['atmos_grid']} / {dG['stats']['atmos_grid']}; fx {dT['fxRT']} / {dG['fxRT']}; {len(bad)} differ")
        # P3 probes
        mo = both(lambda s: tmean(s, 'density', OPEN), T, G); mr = both(lambda s: tmean(s, 'density', ROOM, n=3), T, G)
        w = both(lambda s: field(s)['median'], T, G); tr = field_drifts((T, G)); rm = both(lambda s: s.ev(f"{s.fx}.atmos.rooms().map(r => [r.type, r.outdoor, r.resolved])"), T, G)
        REPORT['numbers']['probes'] = dict(mist_open=mo, mist_room=mr, wind=w, travel=tr, rooms=rm)
        check('P3a mist density on open ground and in the room', close(mo[0], mo[1], rel=0.15, ab=0.03) and close(mr[0], mr[1], rel=0.25, ab=0.06) and rm[0] == rm[1], f'open {mo[0]:.3f} / {mo[1]:.3f}; in the room {mr[0]:.3f} / {mr[1]:.3f}; room fog {rm[0]} / {rm[1]}')
        check('P3b the wind is the same vector', close(w[0][0], w[1][0], ab=0.05) and close(w[0][1], w[1][1], ab=0.05), f'{w[0]} / {w[1]} ft/s')
        wind_on = gp['outdoor']['drift'] > 0.1 and gp['outdoor']['height'] > 0.03
        check('P3c the fog pattern travels at the same speed and heading', tr[0] and tr[1] and close(tr[0]['vx'], tr[1]['vx'], ab=0.2) and close(tr[0]['vz'], tr[1]['vz'], ab=0.2) and (not wind_on or min(tr[0]['speed'], tr[1]['speed']) > 0.5 * gp['outdoor']['drift']), f"tuner {tr[0]} / game {tr[1]}; preset wind {gp['outdoor']['drift']} ft/s")
        # P4 the same cursor stroke
        pts = [[80 + i * 1.25, 60] for i in range(13)]; sT, sG = stir_stats(T, pts), stir_stats(G, pts); REPORT['numbers']['stir'] = dict(tuner=sT, game=sG)
        check('P4 a cursor stroke stirs the same footprint, as hard, and it dies away as fast', close(sT['width_ft'], sG['width_ft'], rel=0.3, ab=2) and close(sT['peak'], sG['peak'], rel=0.3, ab=1) and close(sT['decay_1_2_4s'][1], sG['decay_1_2_4s'][1], ab=1.0) and sT['peak'] > 2,
              f"width {sT['width_ft']} / {sG['width_ft']} ft ({sT['width_px']} / {sG['width_px']} px); peak {sT['peak']} / {sG['peak']} ft/s; left after 1, 2, 4 s {sT['decay_1_2_4s']} / {sG['decay_1_2_4s']}")
        # P7 on screen (before the sea goes on)
        clear = {'outdoor': {'height': 0}, 'indoor': {'height': 0, 'own': False}, 'world': {'unbuilt': 0}, 'haze': {'amount': 0, 'dust': 0}, 'smoke': {'pool': 0}}
        F = paired_avg_shots(T, G, n=24, gap=0.5); fp = both(fps, T, G)  # same 12 s: several fog patches pass every pixel
        for s in (T, G): s.setp('atmos', clear)
        time.sleep(6); C = paired_avg_shots(T, G, n=3)
        for s in (T, G): s.ev(f"{s.fx}.setParams('atmos', {json.dumps(gp)})")
        Hh, W = F['tuner'].shape[:2]; reg = {'right': (slice(int(Hh * .55), Hh - 20), slice(int(W * .68), W - 20)), 'left': (slice(int(Hh * .6), Hh - 20), slice(20, int(W * .25))), 'foreground': (slice(int(Hh * .78), Hh - 20), slice(20, W - 20))}
        tx = {nm: [round(transmittance(F[k], C[k], ys, xs), 3) for k in ('tuner', 'game')] for nm, (ys, xs) in reg.items()} if F['tuner'].shape == F['game'].shape else None
        REPORT['numbers']['screen'] = dict(ground_shows_through=tx, fps=fp)
        check('P7a on screen the ground shows through the fog equally (open ground, three patches, 12 s average)', tx and all(close(a, c, ab=0.12) for a, c in tx.values()), f'share of the ground\'s detail still visible, tuner / game: {tx}')
        check('P7b frame rate', min(fp) > 30 and close(fp[0], fp[1], rel=0.25), f'{fp[0]} / {fp[1]} fps')
        time.sleep(6)
        # P5 the fog sea
        REPORT['numbers']['sea_clock_alignment'] = align_flow_clocks((T, G))
        for s in (T, G): s.setp('atmos', {'world': {'unbuilt': 0.75, 'drift': 0}})
        time.sleep(10)
        sd = both(lambda s: tmean(s, 'heavy', OPEN, n=3), T, G); sv = field_drifts((T, G), 'heavy', 1, secs=5, crops=[open_crop(T), open_crop(G)]); wsp = max(1.0, gp['outdoor']['drift'])
        check('P5a the fog sea: same density; its banks stay put, a faint ripple travels below wind speed, equally in both', close(sd[0], sd[1], rel=0.08) and sd[0] > 0.05 and sv[0] and sv[1] and close(sv[0]['vx'], sv[1]['vx'], ab=0.3) and close(sv[0]['vz'], sv[1]['vz'], ab=0.3) and sv[0]['change'] < 0.03 and sv[1]['change'] < 0.03,
              f"density {sd[0]:.3f} / {sd[1]:.3f}; ripple travel {sv[0]['speed']} / {sv[1]['speed']} ft/s (wind {gp['outdoor']['drift']}); field change in 5 s {sv[0]['change']} / {sv[1]['change']} (the mist alone: about 0.13)")
        for s in (T, G): s.setp('atmos', {'world': {'drift': 1}, 'outdoor': {'drift': wsp}})
        time.sleep(8)
        sv2 = field_drifts((T, G), 'heavy', 1, secs=5, crops=[open_crop(T), open_crop(G)]); REPORT['numbers']['sea'] = dict(density=sd, as_shipped=sv, with_drift=sv2)
        check('P5b with world.drift = 1 (off by default) the sea\'s banks travel with the wind, the same in both', sv2[0] and sv2[1] and sv2[0]['speed'] > 0.8 * wsp and close(sv2[0]['vx'], sv2[1]['vx'], ab=0.3) and close(sv2[0]['vz'], sv2[1]['vz'], ab=0.3), f'tuner {sv2[0]} / game {sv2[1]}; wind {wsp} ft/s')
        for s in (T, G): s.ev(f"{s.fx}.setParams('atmos', {json.dumps(gp)})")
        time.sleep(4)
        # P6 the stir radius as a size on screen
        def stir_ft(s):
            c = s.screen(86, 60, 0.5); s.pg.mouse.move(c['x'], c['y']); time.sleep(0.1); s.pg.mouse.move(c['x'] + 6, c['y']); time.sleep(0.2); return s.ev(f"{s.fx}.stats().atmos_stir_ft")
        r0 = both(stir_ft, T, G)
        ppf = both(lambda s: px_per_ft(s, (86, 60)), T, G)
        # The minimum physical footprint follows the simulation cell size. Pick
        # a screen radius twice that measured default, so the intended >1.5x
        # perturbation remains meaningful at this viewport and zoom.
        radius_px = __import__('math').ceil(2 * max(r * scale for r, scale in zip(r0, ppf)))
        for s in (T, G): s.setp('atmos', {'flow': {'radiusPx': radius_px}})
        time.sleep(0.5); r1 = both(stir_ft, T, G); REPORT['numbers']['radiusPx'] = dict(feet_default=r0, radius_px=radius_px, feet_at_test_px=r1, px_per_ft=ppf)
        check('P6 flow.radiusPx (off by default): the cursor footprint is a size on screen, the same in both', close(r0[0], r0[1], rel=0.02) and close(r1[0], r1[1], rel=0.05) and r1[0] > 1.5 * r0[0] and close(r1[0] * ppf[0], radius_px, rel=0.35), f'radius {r0[0]} / {r0[1]} ft by default; {r1[0]} / {r1[1]} ft at {radius_px} px (= {r1[0] * ppf[0]:.0f} / {r1[1] * ppf[1]:.0f} px on the ground)')
        errs = T.pg.errs + G.pg.errs
        check('P8 no page errors in either', not errs, '; '.join(errs[:3]))
        b.close()
    if OUT: json.dump(REPORT, open(OUT, 'w'), indent=1, default=str)
    print(fails, 'failure(s)'); sys.exit(fails)
