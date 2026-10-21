"""Shared pieces of the megamap measurement (2026-10-06): a local relay + static client, a GPU browser, the builder.
Nothing here touches the live relay: the stack is local (ports 18212 / 18839), its data in a temp folder that stop() removes.
The house look (atmosphere atmos-harry-v2 ...) is READ from the write-back server on 127.0.0.1:8096 through tests/tw_sandbox.py.
"""
import json, os, shutil, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.environ.get('TW_MM_REPO') or os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')  # (TW_MM_REPO: serve the game from another checkout, e.g. the code as it was before the fixes)
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
RP, SP = (int(x) for x in os.environ.get('TW_MM_PORTS', '18212,18839').split(','))  # (a second stack beside a running measurement: TW_MM_PORTS=18214,18841)
API = 'http://127.0.0.1:8096'
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--enable-precise-memory-info', '--js-flags=--max-old-space-size=8192']
UNCAPPED = ['--disable-frame-rate-limit', '--disable-gpu-vsync']
VIEWPORT = {'width': 1920, 'height': 1080}
RELAY = f'http://127.0.0.1:{RP}'
procs = []; dirs = []
import signal; signal.signal(signal.SIGTERM, lambda *a: sys.exit(143))  # a kill still runs the callers' finally: stop()
def say(*a): print(*a, file=sys.stderr, flush=True)

def start_local(data=None):
    """data: an existing DATA_DIR to reuse (kept between scripts); None = a fresh temp folder"""
    import socket
    for port in (RP, SP):
        with socket.socket() as so:
            so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try: so.bind(('127.0.0.1', port))
            except OSError: sys.exit(f'port {port} is in use: stop it first')
    if data is None: data = tempfile.mkdtemp(prefix='tw-megamap-')
    os.makedirs(data, exist_ok=True)
    site = tempfile.mkdtemp(prefix='tw-megamap-site-'); dirs.append(site)
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'{RELAY}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return data
def page_url(extra=''): return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(RELAY) + '&nointro' + extra
def stop():
    for pr in procs: pr.terminate()
    for pr in procs:
        try: pr.wait(5)
        except Exception: pr.kill()
    for d in dirs: shutil.rmtree(d, ignore_errors=True)
def relay_pid(): return procs[0].pid if procs else None
def proc_stat(pid):
    """(cpu seconds, rss MB) of a process"""
    try:
        f = open(f'/proc/{pid}/stat').read().rsplit(')', 1)[1].split(); tck = os.sysconf('SC_CLK_TCK')
        rss = int(open(f'/proc/{pid}/statm').read().split()[1]) * os.sysconf('SC_PAGE_SIZE') / 1e6
        return (int(f[11]) + int(f[12])) / tck, round(rss, 1)
    except Exception: return None, None
def gpu_now():
    try:
        o = subprocess.run(['nvidia-smi', '--query-gpu=utilization.gpu,memory.used', '--format=csv,noheader,nounits'], capture_output=True, text=True).stdout.strip().split(',')
        return {'util': int(o[0]), 'mem_mb': int(o[1])}
    except Exception: return {}
def _mine():
    """pids below this python process (our browsers)"""
    kids = {}; me = os.getpid()
    for l in subprocess.run(['ps', '-eo', 'pid,ppid'], capture_output=True, text=True).stdout.split('\n')[1:]:
        a = l.split()
        if len(a) == 2: kids.setdefault(int(a[1]), []).append(int(a[0]))
    out = set(); st = [me]
    while st:
        p = st.pop(); out.add(p); st += kids.get(p, [])
    return out
def others_gpu():
    """GPU use (% of time, nvidia-smi pmon 'sm') by processes that are not ours: other agents' browser tests"""
    try:
        mine = _mine(); tot = 0
        for l in subprocess.run(['nvidia-smi', 'pmon', '-c', '1'], capture_output=True, text=True).stdout.split('\n'):
            a = l.split()
            if len(a) > 4 and a[1].isdigit() and int(a[1]) not in mine and a[3].isdigit(): tot += int(a[3])
        return tot
    except Exception: return None
def my_gpu_mem():
    """GPU memory (MiB) held by OUR browser's GPU process(es), from nvidia-smi's per-process list"""
    try:
        mine = _mine(); tot = 0
        for l in subprocess.run(['nvidia-smi', '--query-compute-apps=pid,used_memory', '--format=csv,noheader,nounits'], capture_output=True, text=True).stdout.split('\n'):
            a = l.split(',')
            if len(a) >= 2 and a[0].strip().isdigit() and int(a[0]) in mine: tot += int(a[-1].strip())
        return tot
    except Exception: return None
def wait_gpu_quiet(limit=4, need=3, timeout=600):
    """wait until nobody else has used the GPU for `need` samples in a row (about a second each). -> (quiet?, waited s)"""
    t0 = time.time(); ok = 0
    while time.time() - t0 < timeout:
        o = others_gpu()
        if o is None: return True, 0
        ok = ok + 1 if o <= limit else 0
        if ok >= need: return True, round(time.time() - t0)
        time.sleep(1 if o <= limit else 4)
    return False, round(time.time() - t0)
def load_now(): return [float(x) for x in open('/proc/loadavg').read().split()[:3]]
def pct(xs, q): xs = sorted(xs); return xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))]

W = 'tw.worldOf(tw.area())'
GPU_JS = """(() => { const gl = document.querySelector('#c').getContext('webgl2') || document.querySelector('#c').getContext('webgl'); if (!gl) return null;
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), lost: gl.isContextLost() }; })()"""
LOADED_JS = f"""(() => {{ const w = {W}; let ph = 0, meshes = 0; w.scene.traverse(o => {{ if (o.userData?.placeholder && o.visible !== false) ph++; if (o.isMesh) meshes++; }});
  const s = tw.spawningNow(); return {{ placeholders: ph, meshes, anims: s.anims, loading: !!s.last?.loading, pending: tw.sync.pendingCount() }}; }})()"""
COUNTS_JS = "(() => { const es = Object.values(tw.entities()); const c = {}; for (const e of es) c[e.kind] = (c[e.kind] || 0) + 1; c.all = es.length; return c; })()"
MEASURE_JS = """(ms) => new Promise(resolve => { const dts = [], cbs = []; let last = null, t0 = null; const fxs = [];
  // main-thread time per frame: every requestAnimationFrame callback the game registers is timed while we measure
  const raf = window.requestAnimationFrame; let cb = 0;
  window.requestAnimationFrame = (f) => raf((t) => { const a = performance.now(); f(t); cb += performance.now() - a; });
  const tick = (now) => { if (last !== null) { dts.push(now - last); cbs.push(cb); } else t0 = now; last = now; cb = 0;
    if (dts.length % 20 === 0) { const s = tw.worldOf(tw.area()).fx?.stats?.(); if (s) fxs.push([s.frame_draw_calls, s.frame_triangles]); }
    if (now - t0 < ms && dts.length < 4000) raf(tick); else { window.requestAnimationFrame = raf; resolve({ dts, cbs, wall: now - t0, fxs }); } };
  raf(tick); })"""
def cam_js(x, z, dist, pitch=55, yaw=0): return f"(() => {{ const g = tw.main.grab; g.focus.set({x}, 0, {z}); g.pitch = {pitch}; g.yaw = {yaw}; g.dist = {dist}; g.update(); tw.main.rule = 'free'; }})()"

def summarize(m):
    """mean_ms = wall time / frames (the headline: uncapped Chromium delivers frames in bursts, so the gaps between frames
    are multi-modal and their median jumps between modes); p95 and worst are of the gaps; js_ms = the median main-thread
    time spent inside the game's frame callbacks (JavaScript and the WebGL calls it makes)."""
    dts = m['dts']
    if len(dts) < 2: return {'frames': len(dts), 'mean_ms': round(m['wall'] / max(1, len(dts)), 1) if dts else None, 'median_ms': dts[0] if dts else None}
    o = {'frames': len(dts), 'mean_ms': round(m['wall'] / len(dts), 2), 'median_ms': round(statistics.median(dts), 2), 'p95_ms': round(pct(dts, 0.95), 2), 'max_ms': round(max(dts), 1), 'fps': round(len(dts) * 1000 / m['wall'], 1)}
    if m.get('cbs'): o['js_ms'] = round(statistics.median(m['cbs']), 2)
    fxs = [f for f in (m.get('fxs') or []) if f[0] is not None]
    if fxs: o.update(draw_calls=round(statistics.mean(f[0] for f in fxs)), triangles=round(statistics.mean(f[1] for f in fxs)))
    return o
def measure(pg, seconds=2.5, want=2, budget_s=90, runs=None):
    """Timed runs of requestAnimationFrame, kept only when the GPU was ours alone.
    Other agents run browser tests on this box's GPU most of the day. A run counts as QUIET when no other process showed
    GPU use (nvidia-smi pmon) in the three samples before it and in the sample right after it. We keep trying until
    `want` quiet runs are in hand or budget_s has passed. Reported: the quiet run with the lowest mean (quiet: true), or,
    when none was quiet, the lowest of the disturbed runs (quiet: false: read it as an upper bound)."""
    rs = []; t0 = time.time()
    while True:
        q, w = wait_gpu_quiet(timeout=max(5, min(40, budget_s - (time.time() - t0))))
        r = summarize(pg.evaluate(MEASURE_JS, seconds * 1000)); after = others_gpu() or 0
        r['quiet'] = bool(q and after <= 4); r['others_gpu'] = after; r['load'] = load_now()[0]; rs.append(r)
        if (r.get('mean_ms') or 0) > 120: seconds = min(10, max(seconds, 12 * r['mean_ms'] / 1000))  # slow frames: time at least a dozen
        if sum(1 for x in rs if x['quiet']) >= want or time.time() - t0 > budget_s: break
    ok = sorted([r for r in rs if r.get('mean_ms') is not None], key=lambda r: (not r['quiet'], r['mean_ms']))
    if not ok: return {'mean_ms': None}
    best = dict(ok[0]); best['runs'] = [[r.get('mean_ms'), r['quiet'], r['others_gpu']] for r in rs]
    return best

def open_game(p, uncapped=True, headed=False, campaign=None, token=None, extra=''):
    """a GPU browser on the local game: makes a campaign (campaign=name) or joins one (token). -> browser, ctx, page, errors"""
    browser = p.chromium.launch(headless=not headed, args=ARGS + (UNCAPPED if uncapped else []))
    ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errors.append(f'console: {m.text[:300]}') if m.type == 'error' else None)
    pg.on('crash', lambda *_: errors.append('TAB CRASHED'))
    tw_sandbox.proxy(pg, API)
    pg.set_default_timeout(120000)
    t0 = time.time()
    if token: pg.goto(page_url(extra) + '#s=' + token)
    else:
        pg.goto(page_url(extra))
        pg.fill('#newCampaign input[name=name]', campaign); pg.fill('#newCampaign input[name=gm]', 'Fauna-megamap'); pg.click('#newCampaign button')
    pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=600000)
    pg.mouse.move(5, 5)
    return browser, ctx, pg, errors, time.time() - t0

def wait_seated(pg, timeout=300):
    """wait until the queue that seats things on table tops has run out (engine/client/world.js settler). While it runs,
    every thing it seats used to redraw the fire's shadow: the 'slow state' of the first measurements. -> (ran out?, seconds)"""
    t0 = time.time()
    while time.time() - t0 < timeout:
        if pg.evaluate("tw.worldOf(tw.area()).settler.pending()") == 0: return True, round(time.time() - t0, 1)
        pg.wait_for_timeout(1000)
    return False, round(time.time() - t0, 1)
def wait_settled(pg, timeout=1800, quiet_s=2.0, poll=500):
    t0 = time.time(); quiet = None; st = {}
    while time.time() - t0 < timeout:
        st = pg.evaluate(LOADED_JS)
        if st['placeholders'] == 0 and st['anims'] == 0 and not st['loading'] and st['pending'] == 0:
            quiet = quiet or time.time()
            if time.time() - quiet >= quiet_s: return True, round(time.time() - t0 - quiet_s, 1), st
        else: quiet = None
        pg.wait_for_timeout(poll)
    return False, round(time.time() - t0, 1), st
