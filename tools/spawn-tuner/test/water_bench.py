"""Water cost bench (2026-10-04): GPU milliseconds and draw calls per feature, on the box's real GPU (ANGLE over Vulkan;
SwiftShader / headless fps would be meaningless). Times the WHOLE frame on the GPU (timer query around fx.render) and
the water's own pass + ripple-sim timers, at 1920x1080 in the stage, for: water off; the demo yard's vessels; + a live
ripple sim; + the river and pond; 60 extra buckets (many small vessels); at each quality.
python water_bench.py BASE_URL [OUT_JSON]   (BASE_URL e.g. http://127.0.0.1:8791, a static server on tools/spawn-tuner)"""
import sys, time, json
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/'); out = sys.argv[2] if len(sys.argv) > 2 else None
GPU = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu']
# one wrapper, installed once: while window.__gpuWrap is true it times the WHOLE frame (and the water's own timers stand
# down: one TIME_ELAPSED query at a time); while false, the water's pass + sim timers run
WRAP = """(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return false; if (window.__wrapped) return true; window.__wrapped = true; window.__gpu = []; const pend = []; const orig = fx.render;
  fx.render = (dt) => {
    if (!window.__gpuWrap) return orig(dt);
    const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); orig(dt); gl.endQuery(ext.TIME_ELAPSED_EXT); pend.push(q);
    for (let i = pend.length - 1; i >= 0; i--) { if (gl.getQueryParameter(pend[i], gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) window.__gpu.push(gl.getQueryParameter(pend[i], gl.QUERY_RESULT) / 1e6); gl.deleteQuery(pend[i]); pend.splice(i, 1); } } };
  return true; })()"""

def frame_ms(pg, secs=3.0):  # whole-frame GPU time, median
    pg.evaluate("window.__gpu = []; window.__gpuWrap = true"); time.sleep(secs)
    g = sorted(pg.evaluate("window.__gpu")); s = pg.evaluate("fx.stats()")
    pg.evaluate("window.__gpuWrap = false")
    return (round(g[len(g) // 2], 3) if g else None), s

def own_ms(pg, secs=3.0):  # the water's own pass / sim timers (smoothed)
    time.sleep(secs)
    return pg.evaluate("fx.water.stats()")

with sync_playwright() as p:
    b = p.chromium.launch(args=GPU)
    pg = b.new_page(viewport={'width': 2240, 'height': 1180})
    pg.route('**/api/tw-ratings/**', lambda route: route.fulfill(response=route.fetch(url='http://127.0.0.1:8096' + route.request.url.split('/api/tw-ratings', 1)[1])) if route.request.method == 'GET' else route.abort())
    pg.add_init_script("try { localStorage.clear(); } catch (e) {}")
    pg.goto(base + '/index.html?nobg&seed=4242&atmos=clear'); pg.wait_for_selector('body[data-ready="1"]', timeout=90000); pg.wait_for_function('!!window.fx && !!fx.water && !!fx.water.tools')
    ren = pg.evaluate("(() => { const gl = document.querySelector('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })()")
    stage = pg.evaluate("(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })()")
    print('renderer:', ren, '| stage', stage)
    assert pg.evaluate(WRAP), 'no timer queries'
    pg.evaluate("fx.water.tools.buildDemo()"); pg.wait_for_function('fx.water.tools.demoItems().length >= 11', timeout=90000); time.sleep(3)
    pg.evaluate("(() => { tuner.cam.focus.set(236, 0, 226); tuner.cam.dist = 62; tuner.cam.pitch = 52; tuner.cam.update(); })()"); time.sleep(1)
    res = {'renderer': ren, 'stage': stage, 'rows': {}}
    def setw(patch):
        pg.evaluate(f"(() => {{ const p = fx.params('water'); const c = {json.dumps(patch)}; for (const [k, v] of Object.entries(c)) if (v && typeof v === 'object') Object.assign(p[k], v); else p[k] = v; fx.setParams('water', p); }})()"); time.sleep(0.8)
    bodies = pg.evaluate("fx.water.tools.defs()")
    def row(name, patch, ripples=False, nobodies=False):
        setw(patch)
        pg.evaluate(f"fx.water.setBodies({json.dumps([] if nobodies else bodies)})"); time.sleep(0.4)
        if ripples:  # keep a few blocks busy: a drop in each big vessel and the river every frame
            pg.evaluate("window.__rip = setInterval(() => { for (const s of fx.water.surfaces().filter(s => !s.small)) { const n = s.outline.length, c = s.outline.reduce((a, q) => [a[0] + q[0] / n, a[1] + q[2] / n], [0, 0]); fx.water.touch(c[0] + Math.random() - 0.5, s.y, c[1] + Math.random() - 0.5, 0.8); } for (const d of fx.water.bodies()) fx.water.touch(d.pts[1][0], 0.08, d.pts[1][1], 0.8); }, 50)")
        f, s = frame_ms(pg); o = own_ms(pg)
        if ripples: pg.evaluate("clearInterval(window.__rip)")
        r = {'gpu_frame_ms': f, 'water_gpu_pass_ms': o['water_gpu_draw_ms'], 'water_gpu_sim_ms': o['water_gpu_sim_ms'], 'water_draw_calls': s['water_draw_calls'], 'frame_draw_calls': s['frame_draw_calls'],
             'vessels': s['water_vessels'], 'small': s['water_vessels_small'], 'bodies': s['water_bodies'], 'sim': s['water_sim'], 'grab': s['water_grab'], 'cpu_ms': s['water_cpu_ms']}
        res['rows'][name] = r
        print(f"{name:42} frame {f} ms | water pass {r['water_gpu_pass_ms']} sim {r['water_gpu_sim_ms']} ms | calls water {r['water_draw_calls']} frame {r['frame_draw_calls']} | {r['vessels']} vessels ({r['small']} small) {r['bodies']} bodies | {r['sim']} | grab {r['grab']} | cpu {r['cpu_ms']} ms", flush=True)
    row('water off', {'on': False}, nobodies=True)
    for q in ['low', 'laptop', 'high']:
        row(f'{q} | vessels (11 in view)', {'on': True, 'quality': {'level': q}}, nobodies=True)
        row(f'{q} | vessels + live ripples', {'on': True, 'quality': {'level': q}}, ripples=True, nobodies=True)
        row(f'{q} | vessels + river + pond', {'on': True, 'quality': {'level': q}})
        row(f'{q} | everything + live ripples', {'on': True, 'quality': {'level': q}}, ripples=True)
    # many small vessels: 60 extra buckets in a grid next to the yard
    pg.evaluate("(async () => { for (let i = 0; i < 60; i++) await fx.water.tools.place('bucket', 'bucket--empty', 222 + (i % 10) * 1.6, 200 + Math.floor(i / 10) * 1.6); })()"); time.sleep(6)
    pg.evaluate("(() => { tuner.cam.focus.set(232, 0, 210); tuner.cam.dist = 40; tuner.cam.update(); })()"); time.sleep(1)
    row('water off (+60 buckets)', {'on': False}, nobodies=True)
    row('laptop | +60 buckets (71 vessels)', {'on': True, 'quality': {'level': 'laptop'}}, nobodies=True)
    b.close()
if out: json.dump(res, open(out, 'w'), indent=1)
