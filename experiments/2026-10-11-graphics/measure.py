#!/usr/bin/env python3
"""(GPU time: the MEAN of the frames, the slowest 5% dropped: the fire's shadow is redrawn every second frame, so a median would miss it.)
What each Graphics preset and each switch costs, in GPU time a frame.  (2026-10-11)

  tw-slot python3 measure.py [--rooms 52] [--rounds 3] [--only room,big] [--dpr 1,2]

One local stack (relay + static client from THIS checkout), two throwaway campaigns: "room" (one common room, a pond
beside it so the water switch has something to do) and "big" (the megamap town plan, --rooms). Each is opened at device
pixel ratio 1 and 2 (1920 x 1080 CSS pixels: 2.1 and 8.3 megapixels) in a browser with no vsync and no frame-rate limit.
GPU time = EXT_disjoint_timer_query_webgl2 round the whole frame (the game's own tw.gfx timer: the median of 60+ frames),
frame = wall time / frames in the same window. Cases are interleaved over --rounds (A B C A B C): the box is shared.
Reported per case: the median over rounds, and the lowest (read the lowest as the cost, the median as the weather).
Every line carries the load average. Also: the hitch of flipping each switch (the longest frame gap in the second after
it, cold and warm), and the idle rate (frames drawn a second and GPU ms a second, vsync on, tw.gfxForce).
Appends JSON lines to results/measure.jsonl.
"""
import argparse, json, os, statistics, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
os.environ.setdefault('TW_MM_REPO', REPO); os.environ.setdefault('TW_MM_PORTS', '18266,18893')
sys.path.insert(0, os.path.join(REPO, 'experiments', '2026-10-06-megamap')); import mm, layout
mm.tw_sandbox.remove_campaigns()
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--rooms', type=int, default=50); ap.add_argument('--rounds', type=int, default=5); ap.add_argument('--only', default='room,big'); ap.add_argument('--dpr', default='1,2')
ap.add_argument('--out', default=os.path.join(HERE, 'results', 'measure.jsonl')); ap.add_argument('--skip', default='', help='comma list: presets,switches,hitch,idle'); ap.add_argument('--shots', default=os.path.join(HERE, 'shots'))
ap.add_argument('--cases-json', default='', help='(2026-10-12, the far-fire glow) a JSON list of [name, js] to measure in place of the three presets; RESET also switches the glow off')
A = ap.parse_args(); SKIP = set(A.skip.split(','))
def emit(o):
    o = {'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'load': mm.load_now()[0], **o}
    with open(A.out, 'a') as f: f.write(json.dumps(o) + '\n')
    mm.say(json.dumps(o)[:600])

# GPU ms a frame (median of n samples of the game's own timer) and wall ms a frame, measured over the same frames
GPU_JS = """(n) => new Promise(resolve => { tw.gfx.timing(true); tw.gfx.clearGpu(); const f0 = tw.stats.frames, t0 = performance.now();
  const tick = () => { const g = tw.gfx.gpuSamples(); const t = performance.now();
    if (g.length >= n || t - t0 > 20000) { const s = [...g].sort((a, b) => a - b); const k = s.slice(0, Math.max(1, Math.floor(s.length * 0.95))); resolve({ gpu: s.length ? k.reduce((a, b) => a + b, 0) / k.length : null, med: s.length ? s[s.length >> 1] : null, p90: s.length ? s[Math.floor(s.length * 0.9)] : null, n: s.length, frame: (t - t0) / Math.max(1, tw.stats.frames - f0), frames: tw.stats.frames - f0 }); }
    else setTimeout(tick, 50); }; tick(); })"""
# the longest gap between frames in the `ms` after running `js` (and the longest main-thread task)
HITCH_JS = """([js, ms]) => new Promise(resolve => { let last = performance.now(), worst = 0, n = 0; const t0 = last; const before = [];
  const warm = (now) => { before.push(now - last); last = now; if (before.length < 20) requestAnimationFrame(warm); else { (0, eval)(js); const tA = performance.now(); last = tA;
    const tick = (now2) => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; n++; if (t - tA < ms) requestAnimationFrame(tick); else { const s = [...before].sort((a, b) => a - b); resolve({ worst: +worst.toFixed(1), usual: +s[s.length >> 1].toFixed(1), frames: n, programs: tw.worldOf(tw.area()).fx.stats().programs }); } };
    requestAnimationFrame(tick); } };
  requestAnimationFrame(warm); })"""
HIGH = "tw.settings.setGfx('high')"
CASES = [('high', HIGH), ('medium', "tw.settings.setGfx('medium')"), ('low', "tw.settings.setGfx('low')")]
# from High, one switch at a time (the pixel density ones are separate: they are capped by the screen's own)
SWITCHES = [('real lights: none', "tw.settings.setPref('lights', 'none')"), ('real lights: nearest 4', "tw.settings.setPref('lights', '4')"), ('real lights: nearest 8', "tw.settings.setPref('lights', '8')"), ('real lights: nearest 16', "tw.settings.setPref('lights', '16')"), ('shadows off', "tw.settings.setPref('shadowsFx', false)"), ('contact shadows off', "tw.settings.setPref('contactFx', false)"), ('fog off', "tw.settings.setPref('fogFx', false)"),
            ('soft effects half-res', "tw.settings.setPref('softHalf', true)"), ('fire steady', "tw.settings.setPref('fireFx', false)"), ('water plain', "tw.settings.setPref('waterFx', false)"),
            ('bloom off', "tw.settings.setPref('bloomFx', false)"), ('edge smoothing off', "tw.settings.setPref('aaFx', false)"),
            ('nothing selected', "tw.select([])"), ('lighting effects off', "tw.settings.setPref('post', false)"),
            ('density 1.5', "tw.settings.setPref('density', '1.5')"), ('density 1', "tw.settings.setPref('density', '1')")]
RESET = "tw.settings.setPref('bloomFx', true); tw.settings.setPref('aaFx', true); tw.settings.setGfx('high'); tw.settings.setPref('post', true); if (window.__sel) tw.select(window.__sel)"
if A.cases_json: CASES = [tuple(c) for c in json.loads(A.cases_json)]; RESET = "tw.settings.setPref('farGlow', false); " + RESET
SETTLED = "(() => { const f = tw.worldOf(tw.area()).fx.fire; return f.cap === f.capWant; })()"
POND = "(([x, z]) => { const w = tw.worldOf(tw.area()); w.fx.water.setBodies([{ id: 'pond', kind: 'pond', pts: [[x, z], [x + 22, z], [x + 24, z + 9], [x + 20, z + 16], [x + 3, z + 15], [x - 2, z + 7]], depth: 2 }]); return w.fx.stats().water_bodies ?? w.fx.water.bodies().length; })"

def open_page(p, dpr, token=None, campaign=None, uncapped=True, extra=''):
    browser = p.chromium.launch(headless=True, args=mm.ARGS + (mm.UNCAPPED if uncapped else []))
    ctx = browser.new_context(viewport=mm.VIEWPORT, device_scale_factor=dpr); pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}')); pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' else None)
    mm.tw_sandbox.proxy(pg, mm.API); pg.set_default_timeout(180000)
    GW = next((f for f in (os.path.join(REPO, 'experiments', '2026-10-11-asset-cost', 'glwrap.js'), 'experiments/2026-10-11-asset-cost/glwrap.js') if os.path.exists(f)), None)
    if GW: pg.add_init_script(path=GW)  # (the asset-cost agent's texture ledger: render-target memory)
    if token: pg.goto(mm.page_url(extra) + '#s=' + token)
    else:
        pg.goto(mm.page_url(extra)); pg.fill('#newCampaign input[name=name]', campaign); pg.fill('#newCampaign input[name=gm]', 'Fauna-graphics'); pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=600000); pg.mouse.move(5, 5)
    return browser, pg, errors

def build(p, name, rs):
    b, pg, errors = open_page(p, 1, campaign=name)
    token = pg.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')"); t0 = time.time(); n = 0
    for r in rs:
        rid = pg.evaluate("([t,x,z,w,d,seed,y]) => { try { return tw.spawnRoom(t, x, z, w, d, seed, undefined, y); } catch (e) { return null; } }", list(r[:7]))
        if rid:
            try: pg.wait_for_function(f"!!tw.entities()['{rid}'] && tw.sync.pendingCount() === 0", timeout=60000); n += 1
            except Exception: pass
    ok, s, st = mm.wait_settled(pg, timeout=900); pg.wait_for_timeout(1500)
    mm.say(f'built {name}: {n}/{len(rs)} rooms in {time.time() - t0:.0f} s, settled {ok}'); b.close()
    return token, n

def view(pg, scene):
    if scene['name'] == 'room': pg.evaluate(mm.cam_js(scene['cx'], scene['cz'], 62)); pg.evaluate(POND, [scene['cx'] + 18, scene['cz'] - 8])
    else: pg.evaluate(mm.cam_js(scene['cx'], scene['cz'], 110))
    pg.mouse.move(5, 5)

def gpu(pg, n=120):
    try: pg.wait_for_function(SETTLED, timeout=30000)
    except Exception: mm.say('lights never settled')
    pg.wait_for_timeout(900); q, w = mm.wait_gpu_quiet(timeout=8); r = pg.evaluate(GPU_JS, n); r['load'] = mm.load_now()[0]; r['others'] = mm.others_gpu() or 0; r['quiet'] = bool(q and r['others'] <= 4); return r
def table(pg, cases, rounds, reset=RESET):
    got = {k: [] for k, _ in cases}
    for i in range(rounds):
        for k, js in cases:
            pg.evaluate(reset); pg.wait_for_function(SETTLED, timeout=30000); pg.evaluate(js); got[k].append(gpu(pg))
    out = {}
    for k, rs in got.items():
        g = [r['gpu'] for r in rs if r['gpu'] is not None]; f = [r['frame'] for r in rs]
        out[k] = {'gpu_ms': round(statistics.median(g), 2) if g else None, 'gpu_min': round(min(g), 2) if g else None, 'frame_ms': round(statistics.median(f), 2), 'frame_min': round(min(f), 2), 'loads': [r['load'] for r in rs], 'n': [r['n'] for r in rs], 'quiet': sum(1 for r in rs if r['quiet']), 'gpu_quiet_min': round(min([r['gpu'] for r in rs if r['quiet'] and r['gpu'] is not None], default=float('nan')), 2)}
    pg.evaluate(reset); return out

def run(p, scene, dpr):
    base = {'scene': scene['name'], 'rooms': scene['rooms'], 'dpr': dpr}
    b, pg, errors = open_page(p, dpr, token=scene['token'])
    try:
        view(pg, scene); ok, s, st = mm.wait_settled(pg, timeout=900); mm.wait_seated(pg, 120); view(pg, scene); pg.wait_for_timeout(3000)
        info = pg.evaluate("({ gfx: tw.gfx.info(), gpu: (() => { const gl = document.querySelector('#c').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; })(), fx: tw.worldOf(tw.area()).fx.stats() })")
        emit({**base, 'what': 'setup', 'settled': ok, 'renderer': info['gpu'], 'timer': info['gfx']['timer'], 'buffer': info['gfx']['buffer'], 'pixelRatio': info['gfx']['pixelRatio'], 'fire_lights': info['fx'].get('fire_lights'), 'shadow_casters': info['fx'].get('shadow_casters'), 'atmos_volume': info['fx'].get('atmos_volume'), 'triangles': info['fx'].get('frame_triangles'), 'draws': info['fx'].get('frame_draw_calls'), 'errors': errors[:4]})
        if not info['gfx']['timer']: mm.say('NO TIMER QUERY EXTENSION: GPU times will be null; frame times only')
        # something selected, so the selection switch has something to draw (the same thing in every case)
        sel = pg.evaluate("(() => { const m = tw.main.grab.focus, es = Object.values(tw.entities()).filter(e => e.kind === 'object' && e.layer === 'furnish' && !e.parent); es.sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z)); const ids = es.slice(0, 3).map(e => e.id); window.__sel = ids; tw.select(ids); return ids.length; })()")
        if 'presets' not in SKIP:
            emit({**base, 'what': 'presets', 'selected': sel, 'cases': table(pg, CASES, A.rounds)})
            mem = {}
            for k, js in CASES + [('high, contact shadows off', "tw.settings.setPref('contactFx', false)")]:
                pg.evaluate(RESET); pg.wait_for_function(SETTLED, timeout=30000); pg.evaluate(js); pg.wait_for_function(SETTLED, timeout=30000); pg.wait_for_timeout(1500)
                t = pg.evaluate("(() => { const s = __glw.texSummary(); let tg = 0, n = 0; for (const [k, v] of Object.entries(s.by)) if (!/Image|Bitmap|Canvas|Video/.test(k)) { tg += v.bytes; n += v.n; } return { all_mb: Math.round(s.total / 1e6), targets_mb: Math.round(tg / 1e6), targets: n }; })()")
                mem[k] = t
            pg.evaluate(RESET); emit({**base, 'what': 'memory', 'cases': mem})
        if 'switches' not in SKIP:
            sw = [s for s in SWITCHES if not (dpr == 1 and s[0].startswith('density'))]
            emit({**base, 'what': 'switches', 'cases': table(pg, [('high', HIGH)] + sw, A.rounds)})
        if 'hitch' not in SKIP:
            pg.evaluate(RESET); pg.wait_for_timeout(1500); H = {}
            for k, js in SWITCHES + [('preset medium', "tw.settings.setGfx('medium')"), ('preset low', "tw.settings.setGfx('low')")]:
                if dpr == 1 and k.startswith('density'): continue
                ms = 5000 if 'real lights' in k or 'preset' in k else 1000
                cold = pg.evaluate(HITCH_JS, [js, ms]); back = pg.evaluate(HITCH_JS, [RESET, ms]); warm = pg.evaluate(HITCH_JS, [js, ms]); pg.evaluate(RESET); pg.wait_for_function(SETTLED, timeout=30000); pg.wait_for_timeout(600)
                H[k] = {'cold_ms': cold['worst'], 'back_ms': back['worst'], 'warm_ms': warm['worst'], 'usual_ms': cold['usual'], 'programs': [cold['programs'], warm['programs']]}
            emit({**base, 'what': 'hitch', 'cases': H})
        if scene['name'] == 'room' and dpr == 1 and A.shots:
            os.makedirs(A.shots, exist_ok=True); pg.evaluate(RESET)
            for k, js in CASES + [('lights-none', "tw.settings.setPref('lights', 'none')"), ('lights-4', "tw.settings.setPref('lights', '4')"), ('contact-off', "tw.settings.setPref('contactFx', false)"), ('shadows-off', "tw.settings.setPref('shadowsFx', false)")]:
                pg.evaluate(RESET); pg.wait_for_function(SETTLED, timeout=30000); pg.evaluate(js); pg.wait_for_function(SETTLED, timeout=30000); pg.wait_for_timeout(1500); pg.screenshot(path=os.path.join(A.shots, f'{k}.png'))
            pg.evaluate(RESET)
    finally: b.close()

def idle(p, scene, dpr):
    """vsync on: frames drawn a second and GPU ms a second, awake and idle, for each idle setting"""
    b, pg, errors = open_page(p, dpr, token=scene['token'], uncapped=False)
    try:
        view(pg, scene); mm.wait_settled(pg, timeout=900); mm.wait_seated(pg, 120); view(pg, scene)
        pg.evaluate("tw.gfxForce = true; tw.settings.setGfx('high'); tw.gfx.timing(true)"); out = {}
        pid = None
        for label, js, wait in [('awake (idle rate off)', "tw.settings.setPref('idleFps', 0)", 1500), ('idle 30', "tw.settings.setPref('idleFps', 30)", 3500), ('idle 20', "tw.settings.setPref('idleFps', 20)", 3500), ('idle 10', "tw.settings.setPref('idleFps', 10)", 3500)]:
            pg.evaluate(js); pg.wait_for_timeout(wait)
            r = pg.evaluate("""() => new Promise(res => { tw.gfx.clearGpu(); const a = tw.gfx.info(), t0 = performance.now(); setTimeout(() => { const b = tw.gfx.info(), g = tw.gfx.gpuSamples().slice().sort((x, y) => x - y), dt = (performance.now() - t0) / 1000;
              res({ state: b.state, drawn_per_s: +((b.drawn - a.drawn) / dt).toFixed(1), woken_per_s: +((b.drawn - a.drawn + b.skipped - a.skipped) / dt).toFixed(1), gpu_ms: g.length ? +g[g.length >> 1].toFixed(2) : null }); }, 4000); })""")
            r['gpu_ms_per_s'] = round(r['drawn_per_s'] * r['gpu_ms'], 1) if r['gpu_ms'] is not None else None; r['load'] = mm.load_now()[0]
            try:
                pm = subprocess.run(['nvidia-smi', 'pmon', '-c', '3'], capture_output=True, text=True).stdout; mine = mm._mine() if hasattr(mm, '_mine') else set()
                sm = [int(l.split()[3]) for l in pm.splitlines() if not l.startswith('#') and len(l.split()) > 3 and l.split()[3].isdigit() and int(l.split()[1]) in mine]
                r['nvidia_sm_pct'] = round(statistics.mean(sm), 1) if sm else None
            except Exception: pass
            out[label] = r
        # the first frame after input: how long from a pointer move to the next drawn frame, while idle
        pg.evaluate("tw.settings.setPref('idleFps', 20)"); pg.wait_for_timeout(3500); lat = []
        for i in range(8):
            pg.wait_for_timeout(2600)
            lat.append(pg.evaluate("""() => new Promise(res => { const st = tw.gfx.info().state, f0 = tw.stats.frames, t0 = performance.now(); dispatchEvent(new PointerEvent('pointermove', { clientX: 400 + Math.random() * 9, clientY: 300 }));
              const tick = () => { if (tw.stats.frames > f0) res({ st, ms: +(performance.now() - t0).toFixed(1) }); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })"""))
        emit({'scene': scene['name'], 'rooms': scene['rooms'], 'dpr': dpr, 'what': 'idle', 'cases': out, 'first_frame_after_input': lat, 'errors': errors[:3]})
    finally: b.close()

def main():
    data = mm.start_local()
    import urllib.request
    for i in range(240):  # (a loaded box: the relay can take longer to come up than mm waits)
        try: urllib.request.urlopen(f'{mm.RELAY}/health', timeout=2); break
        except Exception: time.sleep(0.5)
    else: mm.say('relay never came up:', open(os.path.join(data, 'relay.log')).read()[-800:]); mm.stop(); sys.exit(1)
    try:
        with sync_playwright() as p:
            scenes = []
            if 'room' in A.only: tok, n = build(p, 'TEST graphics room (throwaway)', [('common', 200, 200, 6, 5, 7101, 0)]); scenes.append({'name': 'room', 'token': tok, 'rooms': n, 'cx': 1015, 'cz': 1012})
            if 'big' in A.only:
                rs, lots = layout.rooms(A.rooms); tok, n = build(p, f'TEST graphics big {len(rs)} (throwaway)', rs); scenes.append({'name': 'big', 'token': tok, 'rooms': n, 'cx': lots[0]['x'] + 40, 'cz': lots[0]['z'] + 22})
            for sc in scenes:
                for dpr in [float(x) for x in A.dpr.split(',')]:
                    try: run(p, sc, dpr)
                    except Exception as e: emit({'scene': sc['name'], 'dpr': dpr, 'what': 'FAILED', 'err': str(e)[:400]})
                if 'idle' not in SKIP:
                    try: idle(p, sc, 1)
                    except Exception as e: emit({'scene': sc['name'], 'what': 'idle FAILED', 'err': str(e)[:400]})
    finally: mm.stop()
main()
