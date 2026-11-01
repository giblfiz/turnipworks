#!/usr/bin/env python3
"""Frame time in first person on a big map (2026-10-29). A local stack, a town of generated buildings (fixed seeds), the
full look (FX, the post stack, house fog), 1920x1080, uncapped (no vsync, no frame-rate limit), the box's GPU.

  python3 experiments/2026-10-29-fpv/perf_fpv.py [--buildings 9] [--rounds 3]

Cases, interleaved over rounds, each timed for --seconds after a settle:
  map        the map camera at table distance on the middle building
  map-far    the map camera taking in the whole town
  fpv-in     first person inside the middle building's ground floor
  fpv-out    first person outdoors, looking down the street across the town
  fpv-walk   first person outdoors, a step every 300 ms (the glide, the ceilings, the covered-room pass)
Prints one JSON line: per case the median of per-round median and p95 frame ms (rAF intervals), and draw calls.
"""
import argparse, json, os, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.remove_campaigns()
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument('--buildings', type=int, default=9); ap.add_argument('--rounds', type=int, default=3); ap.add_argument('--seconds', type=float, default=4)
ap.add_argument('--shots'); ap.add_argument('--cases', default='map,map-far,fpv-in,fpv-out,fpv-walk'); ap.add_argument('--probe', action='store_true'); ap.add_argument('--cpuprof', action='store_true'); A = ap.parse_args()
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18435,18436').split(','))
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-frame-rate-limit', '--disable-gpu-vsync']
procs = []
def say(*a): print(*a, file=sys.stderr, flush=True)
def start():
    data = tempfile.mkdtemp(prefix='tw-fpvperf-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    sys.path.insert(0, os.path.join(ENGINE, 'test')); import served; served.check(SP, ENGINE)
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&nointro'
MEASURE = """(ms) => new Promise(resolve => { const dts = []; let last = null, t0 = null; const f0 = tw.stats.frames; let dc = [];
  const tick = (now) => { if (last !== null) dts.push(now - last); else t0 = now; last = now;
    if (dts.length % 20 === 0) { const s = tw.worldOf(tw.area()).fx?.stats?.(); if (s) dc.push(s.frame_draw_calls); }
    if (now - t0 < ms) requestAnimationFrame(tick); else resolve({ dts, frames: tw.stats.frames - f0, wall: now - t0, dc }); };
  requestAnimationFrame(tick); })"""
PROBE = """(() => { const P = window.__prof = { t: {}, n: {}, reset() { this.t = {}; this.n = {}; this.t0 = performance.now(); }, top() { const w = (performance.now() - this.t0) / 1000; return Object.entries(this.t).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => [k, +(v / w).toFixed(1), this.n[k]]); } }; P.reset();
  const wrap = (o, name, label) => { const f = o[name]; if (typeof f !== 'function' || f.__w) return; const g = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { const d = performance.now() - t; P.t[label] = (P.t[label] || 0) + d; P.n[label] = (P.n[label] || 0) + 1; } }; g.__w = true; o[name] = g; };
  const w = tw.worldOf(tw.area()), W = Object.getPrototypeOf(w);
  for (const m of ['sync', 'cutPass', 'cutSets', 'shadowPass', 'frame', 'applySleep', 'wakeFor', 'napStep', 'roofTiers', 'syncTerrain', 'syncRoofs', 'buildShell', 'sleepStep', 'frameSignals', 'updateMatrices', 'stepAnims', 'shadowCasters', 'frameCursors', 'pickAll', 'floorStop']) wrap(W, m, 'w.' + m);
  if (w.fx) for (const m of ['render', 'frame']) wrap(w.fx, m, 'fx.' + m);
  { const f = W.cutSets; W.cutSets = function (...a) { if (!this.cutDirty && this.cutHidden) return f.apply(this, a); const t = performance.now(); try { return f.apply(this, a); } finally { P.t['cutSets(dirty)'] = (P.t['cutSets(dirty)'] || 0) + performance.now() - t; P.n['cutSets(dirty)'] = (P.n['cutSets(dirty)'] || 0) + 1; } }; }
  { const f = W.cutPass; W.cutPass = function (...a) { const go = !(this.cutGen === this.passGen && !this.anims.size && !this.passAnim); const t = performance.now(); try { return f.apply(this, a); } finally { if (go) { P.t['cutPass(ran)'] = (P.t['cutPass(ran)'] || 0) + performance.now() - t; P.n['cutPass(ran)'] = (P.n['cutPass(ran)'] || 0) + 1; } } }; }
  { const v = tw.main; const f0 = v.eyes; Object.defineProperty(v, 'eyes', { configurable: true, get() { return this.__eyes; }, set(fn) { this.__eyes = fn ? function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { P.t['fpv.frame'] = (P.t['fpv.frame'] || 0) + performance.now() - t; P.n['fpv.frame'] = (P.n['fpv.frame'] || 0) + 1; } } : fn; } }); v.eyes = f0; }
  wrap(tw.fog, 'update', 'fog.update'); wrap(tw, 'moveBy', 'app.moveBy'); wrap(tw, 'dispatch', 'app.dispatch'); wrap(tw, 'batch', 'app.batch');
  return true; })()"""
def pct(xs, q): xs = sorted(xs); return xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))]
KINDS = ['inn', 'mansion', 'castle', 'temple', 'crypt', 'tower', 'farm', 'market', 'smithy']
def main():
    url = start()
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1920, 'height': 1080}); pg.on('pageerror', lambda e: say('pageerror', e)); pg.goto(url, timeout=180000)
        pg.fill('#newCampaign input[name=gm]', 'Harry'); pg.fill('#newCampaign input[name=name]', f"TEST fpv perf {time.strftime('%H:%M:%S')} (throwaway)"); pg.click('#newCampaign button')
        try: pg.wait_for_function('window.tw && tw.ready && tw.ready() && tw.fpv', timeout=240000)
        except Exception:
            pg.screenshot(path='/tmp/scratch/perf-fail.png'); say('not ready', pg.evaluate("({ tw: !!window.tw, ready: window.tw?.ready?.(), fpv: !!window.tw?.fpv, loc: location.href })")); raise
        gpu = pg.evaluate("(() => { const gl = document.querySelector('#c').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; })()")
        say('gpu', gpu)
        n = 0; side = 3; centres = []
        for i in range(A.buildings):
            gx, gz = (i % side) * 100, (i // side) * 100
            pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({gx}, 0, {gz}); g.dist = 120; g.update(); }})()")
            word = KINDS[i % len(KINDS)]
            node = pg.evaluate(f"!!tw.buildingNode('{word}')")
            if not node: word = 'inn'
            pg.evaluate(f"tw.buildAt(tw.buildingNode('{word}'), 12, 10, {{ seed: {101 + i} }})")
            pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=120000); time.sleep(1.0)
            centres.append((gx, gz))
        pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", timeout=600000)
        rooms = pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'room').length"); objs = pg.evaluate("Object.values(tw.entities()).filter(e => e.kind === 'object').length")
        say('rooms', rooms, 'objects', objs)
        # the middle building's ground floor: a room at y 0 near the middle centre; a pawn in it
        mid = centres[len(centres) // 2]
        R = pg.evaluate(f"(() => {{ const rs = Object.values(tw.entities()).filter(e => e.kind === 'room' && (e.recipe.y || 0) === 0 && !tw.HT?.isTerrain?.(e.recipe)); rs.sort((a, b) => Math.hypot((a.recipe.x + a.recipe.w / 2) * 5 - {mid[0]}, (a.recipe.z + a.recipe.d / 2) * 5 - {mid[1]}) - Math.hypot((b.recipe.x + b.recipe.w / 2) * 5 - {mid[0]}, (b.recipe.z + b.recipe.d / 2) * 5 - {mid[1]})); const r = rs[0].recipe; return {{ id: rs[0].id, x: (Math.floor(r.x + r.w / 2) + 0.5) * 5, z: (Math.floor(r.z + r.d / 2) + 0.5) * 5, x0: r.x * 5, z0: r.z * 5 }}; }})()")
        pg.evaluate(f"tw.dispatch('token.create', {{ id: 'tok_perf00001', name: 'Mira', x: {R['x']}, z: {R['z']}, rot: 0, fig: 'hero-fighter-elf-f' }})"); pg.wait_for_function("tw.sync.pendingCount() === 0")
        ex = pg.evaluate("(() => { const xs = Object.values(tw.entities()).filter(e => e.kind === 'room').flatMap(e => [e.recipe.x * 5, (e.recipe.x + e.recipe.w) * 5]); const zs = Object.values(tw.entities()).filter(e => e.kind === 'room').flatMap(e => [e.recipe.z * 5, (e.recipe.z + e.recipe.d) * 5]); return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]; })()")
        out_spot = (round((ex[0] - 7.5) / 5) * 5 + 2.5, round(((ex[2] + ex[3]) / 2) / 5) * 5 + 2.5)
        def case(name):
            pg.evaluate("tw.fpv.exit()")
            if name == 'map': pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({mid[0]}, 0, {mid[1]}); g.yaw = -20; g.pitch = 52; g.dist = 95; g.update(); tw.main.rule = 'free'; }})()")
            if name == 'map-far': pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({(ex[0] + ex[1]) / 2}, 0, {(ex[2] + ex[3]) / 2}); g.yaw = -20; g.pitch = 55; g.dist = {max(ex[1] - ex[0], ex[3] - ex[2]) * 1.3}; g.update(); tw.main.rule = 'free'; }})()")
            if name == 'fpv-in':
                pg.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_perf00001', x: {R['x']}, z: {R['z']}, y: 0 }})"); pg.wait_for_function("tw.sync.pendingCount() === 0")
                pg.evaluate("tw.fpv.enter('tok_perf00001')"); pg.evaluate("tw.fpv.setLook(30, -4)")
            if name in ('fpv-out', 'fpv-walk'):
                pg.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_perf00001', x: {out_spot[0]}, z: {out_spot[1]}, y: 0 }})"); pg.wait_for_function("tw.sync.pendingCount() === 0")
                pg.evaluate("tw.fpv.enter('tok_perf00001')"); pg.evaluate("tw.fpv.setLook(90, -2)")
            time.sleep(2.5)
            if name == 'map-walk':
                pg.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_perf00001', x: {out_spot[0]}, z: {out_spot[1]}, y: 0 }})"); pg.wait_for_function("tw.sync.pendingCount() === 0")
                pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({out_spot[0]}, 0, {out_spot[1]}); g.yaw = -20; g.pitch = 52; g.dist = 95; g.update(); tw.main.rule = 'free'; }})()"); time.sleep(2)
                pg.evaluate("window.__n = 0; window.__walk = setInterval(() => { const e = tw.entities().tok_perf00001; tw.moveBy([e], 0, (window.__n++ % 16 < 8) ? 5 : -5); }, 300)")
            if name == 'fpv-walk': pg.evaluate("window.__walk = setInterval(() => { const i = tw.fpv.info(); tw.fpv.step(i && i.steps % 16 < 8 ? 'd' : 'a'); }, 300)")
            if A.probe: pg.evaluate("window.__prof.reset()")
            if A.cpuprof: cdp = pg.context.new_cdp_session(pg); cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 200}); cdp.send('Profiler.start')
            r = pg.evaluate(MEASURE, A.seconds * 1000)
            if A.cpuprof:
                prof = cdp.send('Profiler.stop')['profile']; nodes = {n['id']: n for n in prof['nodes']}; self_t = {}
                dt = prof['timeDeltas']; samples = prof['samples']
                for sid, d in zip(samples, dt):
                    n = nodes[sid]; cf = n['callFrame']; k = f"{cf['functionName'] or '(anon)'} {cf['url'].split('/')[-1].split('?')[0]}:{cf['lineNumber']}"; self_t[k] = self_t.get(k, 0) + d
                par = {}
                for n in prof['nodes']:
                    for c in n.get('children', []): par[c] = n['id']
                chains = {}
                lab = lambda n: f"{n['callFrame']['functionName'] or '(anon)'}:{n['callFrame']['url'].split('/')[-1].split('?')[0]}:{n['callFrame']['lineNumber']}"
                for sid, d in zip(samples, dt):
                    if nodes[sid]['callFrame']['functionName'] not in ('roomWithCell', 'holeCellsAt', 'stairsOf'): continue
                    ch, x = [], par.get(sid)
                    while x is not None and len(ch) < 9: ch.append(lab(nodes[x])); x = par.get(x)
                    k = ' < '.join(ch); chains[k] = chains.get(k, 0) + d
                for k, v in sorted(chains.items(), key=lambda kv: -kv[1])[:6]: say('     chain', round(v / 1000), k)
                tot = sum(self_t.values()) or 1
                say('   cpu', name, json.dumps([(k, round(v / 1000), f"{100 * v / tot:.1f}%") for k, v in sorted(self_t.items(), key=lambda kv: -kv[1])[:22]]))
            if A.probe: say('   probe', name, json.dumps(pg.evaluate("window.__prof.top()")))
            if name in ('fpv-walk', 'map-walk'): pg.evaluate("clearInterval(window.__walk)")
            if A.shots: os.makedirs(A.shots, exist_ok=True); pg.screenshot(path=os.path.join(A.shots, f'perf-{name}.png'))
            return {'med': statistics.median(r['dts']), 'p95': pct(r['dts'], 0.95), 'game_fps': r['frames'] / (r['wall'] / 1000), 'dc': statistics.median(r['dc']) if r['dc'] else None}
        cases = A.cases.split(','); res = {c: [] for c in cases}
        if A.probe: pg.evaluate(PROBE)
        for rd in range(A.rounds):
            for c in cases: res[c].append(case(c)); say(rd, c, res[c][-1])
        pg.evaluate("tw.fpv.exit()")
        out = {'script': 'perf_fpv', 'gpu': gpu, 'rooms': rooms, 'objects': objs, 'buildings': A.buildings, 'cases': {c: {'med_ms': round(statistics.median(x['med'] for x in v), 1), 'p95_ms': round(statistics.median(x['p95'] for x in v), 1), 'game_fps': round(statistics.median(x['game_fps'] for x in v), 1), 'draw_calls': statistics.median([x['dc'] for x in v if x['dc'] is not None] or [0])} for c, v in res.items()}}
        print(json.dumps(out), flush=True)
        b.close()
try: main()
finally:
    for pr in procs: pr.terminate()
