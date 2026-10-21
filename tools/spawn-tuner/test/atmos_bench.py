"""Atmosphere cost bench (2026-10-04): per-feature GPU milliseconds and draw calls on a real GPU.
Runs headless Chrome on the box's GPU (ANGLE over Vulkan; SwiftShader fps would be meaningless) with vsync and the
frame-rate cap off, and reports the uncapped frame time (median over ~2.5 s) plus the atmosphere's own GPU timers
(EXT_disjoint_timer_query_webgl2 around its sim and its draw pass), for each feature switched on alone and for the five
built-ins, at each quality. (A GPU timer around the whole frame counts idle bubbles while the CPU submits, so it
overstates; the uncapped frame time is the honest whole-frame number.)
python atmos_bench.py BASE_URL [OUT_JSON]   (BASE_URL e.g. http://127.0.0.1:8787, a static server on tools/spawn-tuner)"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/'); out = sys.argv[2] if len(sys.argv) > 2 else None
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit']
FEATURES = {  # each on its own, over a clear base
    'none (clear)': {},
    'indoor fog (+ fluid sim)': {'indoor': {'height': 2.8}},
    'outdoor fog (+ far field)': {'outdoor': {'height': 2.2}},
    'haze': {'haze': {'amount': 0.25}},
    'ceiling smoke pool': {'smoke': {'pool': 0.6}},
    'dust motes': {'haze': {'dust': 0.6}},
    'fog sea (undiscovered world)': {'world': {'unbuilt': 0.75}},
}
WRAP = """(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext || window.__gpuWrap) return !!ext; window.__gpuWrap = true; window.__gpu = []; const pend = []; const orig = fx.render;
  fx.render = (dt) => { const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig(dt); gl.endQuery(ext.TIME_ELAPSED_EXT); pend.push(q);
    for (let i = pend.length - 1; i >= 0; i--) { if (gl.getQueryParameter(pend[i], gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) window.__gpu.push(gl.getQueryParameter(pend[i], gl.QUERY_RESULT) / 1e6); gl.deleteQuery(pend[i]); pend.splice(i, 1); } } };
  return true; })()"""

def measure(pg, secs=2.5):
    pg.evaluate("window.__gpu = []; window.__t0 = performance.now(); window.__n0 = tuner.stats().fps"); time.sleep(secs)
    r = pg.evaluate("""(() => { const s = fx.stats(), t = tuner.stats(); return { frame_ms: t.frame_ms, fps: t.fps,
      atmos_gpu_sim_ms: s.atmos_gpu_sim_ms, atmos_gpu_draw_ms: s.atmos_gpu_draw_ms, atmos_draw_calls: s.atmos_draw_calls, atmos_sim_calls: s.atmos_sim_calls, atmos_cpu_ms: s.atmos_cpu_ms, atmos_sim_cpu_ms: s.atmos_sim_cpu_ms,
      frame_draw_calls: s.frame_draw_calls, grid: s.atmos_grid, fx_res: s.atmos_fx_res, renderer: null }; })()""")
    return r

with sync_playwright() as p:
    b = p.chromium.launch(args=GPU)
    pg = b.new_page(viewport={'width': 2240, 'height': 1180})  # the stage (3-D view) comes out ~1920 x 1080
    pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(response=route.fetch(url='http://127.0.0.1:8096' + route.request.url.split('/api/tw-ratings', 1)[1])) if route.request.method == 'GET' else route.abort())
    pg.add_init_script("try { localStorage.clear(); } catch (e) {}")
    pg.goto(base + '/index.html?nobg&seed=4242&atmos=clear'); pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx')
    ren = pg.evaluate("(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })()")
    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()")
    print('renderer:', ren, '| stage', stage)
    pg.evaluate("(() => { const s = document.querySelector('#lodFaces'); s.value = 'baked'; s.dispatchEvent(new Event('change')); })()")
    pg.evaluate("void tuner.createRoom('common', 4, 3, 7, 5)"); pg.evaluate("void tuner.createRoom('kitchen', 11, 3, 5, 5)")
    pg.wait_for_function('tuner.episodes() === 0', timeout=240000); time.sleep(2)
    pg.evaluate("(() => { tuner.cam.focus.set(46, 0, 27); tuner.cam.dist = 62; tuner.cam.pitch = 55; tuner.cam.update(); })()")
    results = {'renderer': ren, 'stage': stage, 'features': {}, 'presets': {}}
    for q in ['low', 'medium', 'high']:
        for name, over in FEATURES.items():
            pg.evaluate(f"""(() => {{ const p = JSON.parse(JSON.stringify(fx.atmos.params)); const c = {json.dumps(over)}; const base = {{ indoor: {{ height: 0, own: false }}, outdoor: {{ height: 0 }}, haze: {{ amount: 0, dust: 0 }}, smoke: {{ pool: 0, wisps: 0 }}, world: {{ unbuilt: 0 }}, quality: {{ level: '{q}', view: 'fog' }} }};
              for (const o of [base, c]) for (const [k, v] of Object.entries(o)) Object.assign(p[k], v); fx.setParams('atmos', p); }})()""")
            time.sleep(1.0)
            r = measure(pg); results['features'][f'{q} | {name}'] = r
            print(f'{q:6} {name:28} frame {r["frame_ms"]} ms | atmos sim {r["atmos_gpu_sim_ms"]} draw {r["atmos_gpu_draw_ms"]} ms | calls sim {r["atmos_sim_calls"]} draw {r["atmos_draw_calls"]} | cpu {r["atmos_cpu_ms"]}+{r["atmos_sim_cpu_ms"]} ms | {r["grid"]} {r["fx_res"]}')
    pg.evaluate("document.querySelector('details.major[data-key=\"atmos\"]').open = true")
    for nm in ['clear', 'morning-mist', 'crypt-fog', 'smoky-tavern', 'storm-haze']:
        pg.select_option('#fx-atmos-load', 'builtin:' + nm); time.sleep(1.2)
        r = measure(pg); results['presets'][nm] = r
        print(f'preset {nm:14} frame {r["frame_ms"]} ms | atmos sim {r["atmos_gpu_sim_ms"]} draw {r["atmos_gpu_draw_ms"]} ms | calls sim {r["atmos_sim_calls"]} draw {r["atmos_draw_calls"]} | frame calls {r["frame_draw_calls"]}')
    # does the cost follow the screen or the world? the fog sea + outdoor mist at three zooms, then with a second building 250 ft away
    pg.select_option('#fx-atmos-load', 'builtin:morning-mist'); pg.check('#fx-atmos-unbuilt'); time.sleep(1)
    results['zoom'] = {}
    def zooms(tag):
        for dist, pitch in [(30, 55), (62, 55), (150, 45), (400, 30)]:
            pg.evaluate(f"(() => {{ tuner.cam.focus.set(46, 0, 27); tuner.cam.dist = {dist}; tuner.cam.pitch = {pitch}; tuner.cam.update(); }})()"); time.sleep(1.5)
            r = measure(pg); results['zoom'][f'{tag} dist {dist}'] = r
            print(f'{tag:12} dist {dist:4} frame {r["frame_ms"]} ms | atmos sim {r["atmos_gpu_sim_ms"]} draw {r["atmos_gpu_draw_ms"]} ms | calls sim {r["atmos_sim_calls"]} draw {r["atmos_draw_calls"]} | {r["grid"]} {r["fx_res"]}')
    zooms('one building')
    pg.evaluate("void tuner.createRoom('barn', 50, 50, 8, 8)"); pg.wait_for_function('tuner.episodes() === 0', timeout=240000); time.sleep(2)
    zooms('+ far barn')
    b.close()
if out: json.dump(results, open(out, 'w'), indent=1)
