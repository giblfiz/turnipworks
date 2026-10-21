#!/usr/bin/env python3
"""Frame time BY CASE and BY SUSPECT for storeys (2026-10-06): one browser, one scene, cases interleaved over rounds.

  python3 engine/test/perf_cases.py --uncapped --rounds 5 [--breakdown] [--flat]

The scene is perf_storeys.py's inn and yard plus (unless --flat) two upper rooms with their stair and a cellar with its
stair. Cases: all levels; roofs on; cut to lv 1; cut to lv 2; cut to lv -1. --breakdown measures the
"all levels" and "lv 2" cases again with one suspect switched off at a time. Each number is the median over rounds of
the per-round median frame time; p95 is the median of the per-round p95s. Also per frame: JS time inside
requestAnimationFrame callbacks, and inside world.frame / fx.frame / fx.render.

(The rest of this header is perf_storeys.py's.)
Frame-time measurement for the "storeys" work (2026-10-05): one fixed scene, one JSON line of numbers.

  local:  python3 engine/test/perf_storeys.py
  after:  ... perf_storeys.py --upper       (also builds two rooms at y = 10 ft on top of the inn, if the engine takes y)
  live:   ... perf_storeys.py --live        (https://turnipworks.net/, campaign "TEST storeys perf (throwaway)")

The scene, built through the game's own commands (room.spawn via tw.spawnRoom, fixed seeds): an inn of four rooms
joined into one building (common room, kitchen, two guest rooms) with a yard beside it. The full look: no ?faces
override, FX and the post stack on, the house atmosphere (fog) on, 1920x1080, the camera at table distance on the
building. It waits for every mesh to load and the spawn animation to end, then times ~10 s of requestAnimationFrame.

Headless Chromium presents at 60 Hz, so a frame time of 16.7 ms means "at the cap": the headroom is then invisible.
--uncapped lifts the cap (no vsync, no frame-rate limit) so the number is the real cost of a frame; compare like with like.

Runs on the box's GPU (the flags of tools/spawn-tuner/test/atmos_game.py); the output says which renderer drew it.
Local runs read the house look (read-only, sandboxed) from the write-back server on 127.0.0.1:8096, as the live game does.
Exit code: 0 measured, 1 the scene could not be built, 2 software GL.
"""
import argparse, json, os, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
import os, sys; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests')); import tw_sandbox  # test writes go to the server's sandbox, never the live game
tw_sandbox.remove_campaigns()  # the campaigns this suite makes are throwaways: deleted from the relay when it exits
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
ap = argparse.ArgumentParser()
ap.add_argument('--live', action='store_true', help='measure the dev game (http://127.0.0.1:8180/, dev.turnipworks.net from the box) instead of a local stack')
ap.add_argument('--page', help='another deployed game (overrides --live\'s address)')
ap.add_argument('--upper', action='store_true', help='also build a second storey (two rooms at y = 10 ft), if the engine supports it')
ap.add_argument('--uncapped', action='store_true', help='no vsync and no frame-rate limit: the real cost of a frame, not the 60 Hz cap')
ap.add_argument('--seconds', type=float, default=4.0)
ap.add_argument('--cut', help="set the cut before measuring: a ceiling height in feet (9 = the ground floor, 19 = lv 2), or 'off'")
ap.add_argument('--roofs', action='store_true', help='roofs on (storeys, Stage F) before measuring')
ap.add_argument('--no-lamp-rule', action='store_true', help='leave every lamp on whatever is visible (the cost before "lamps belong to their room")')
ap.add_argument('--max-load', type=float, default=8.0, help='wait (up to --load-wait s) while the 1-minute load average is above this')
ap.add_argument('--load-wait', type=float, default=300.0)
ap.add_argument('--api', default='http://127.0.0.1:8096', help='local runs: where the house look is read from')
ap.add_argument('--shot', help='save a screenshot of the measured view here')
ap.add_argument('--headed', action='store_true')
ap.add_argument('--rounds', type=int, default=5)
ap.add_argument('--breakdown', action='store_true')
ap.add_argument('--ab', action='store_true', help='every case twice: as built, and with the 2026-10-06 frame-time rules switched off ("old")')
ap.add_argument('--flat', action='store_true', help='the single-storey inn and yard only (the baseline)')
ap.add_argument('--only', help='comma list of case names')
ap.add_argument('--shots', help='folder: a screenshot of every case (pixel comparisons)')
A = ap.parse_args()
def say(*a): print(*a, file=sys.stderr, flush=True)

# the chromium flags that make headless draw on the real GPU (copied from tools/spawn-tuner/test/atmos_game.py)
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
if A.uncapped: ARGS += ['--disable-frame-rate-limit', '--disable-gpu-vsync']

CAMPAIGN = 'TEST storeys perf cases (throwaway)'
VIEWPORT = {'width': 1920, 'height': 1080}
# the scene, in 5-ft cells: (type, x, z, w, d, seed). The inn is 50 x 45 ft; the yard lies along its east side.
INN = [('common', 4, 4, 6, 5, 7101), ('kitchen', 10, 4, 4, 5, 7102), ('guest', 4, 9, 5, 4, 7103), ('guest', 9, 9, 5, 4, 7104)]
YARD = ('yard', 14, 4, 6, 9, 7105)
UPPER = [('guest', 4, 4, 5, 4, 7201), ('guest', 9, 4, 5, 4, 7202)]  # --upper: on top of the common room and the kitchen
UPPER_Y = 10  # feet
CAMERA = {'x': 60, 'z': 42.5, 'dist': 110, 'pitch': 55, 'yaw': 0}  # table distance, on the building and its yard

procs = []
RP, SP = 18114, 18741
def port_free(port):
    import socket
    with socket.socket() as so:
        so.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try: so.bind(('127.0.0.1', port)); return True
        except OSError: return False

def start_local():
    for port in (RP, SP):
        if not port_free(port): sys.exit(f'port {port} is in use (a stale test server?): stop it first')
    data = tempfile.mkdtemp(prefix='tw-perf-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    # the full look: no faces=, no nopost, no nofx; the ratings API stays at its default path and is proxied (sandboxed) below
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&nointro'

def load_now(): return [float(x) for x in open('/proc/loadavg').read().split()[:3]]
def wait_for_quiet():
    t0 = time.time(); l = load_now()
    while l[0] > A.max_load and time.time() - t0 < A.load_wait:
        say(f'load {l[0]} > {A.max_load}: waiting'); time.sleep(15); l = load_now()
    return l, round(time.time() - t0)

W = 'tw.worldOf(tw.area())'
GPU_JS = """(() => { const gl = document.querySelector('#c').getContext('webgl2') || document.querySelector('#c').getContext('webgl'); if (!gl) return null;
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), lost: gl.isContextLost() }; })()"""
# every mesh in: nothing in the world is still a placeholder box, and no spawn episode is running or loading
LOADED_JS = f"""(() => {{ const w = {W}; let ph = 0, meshes = 0; w.scene.traverse(o => {{ if (o.userData?.placeholder && o.visible !== false) ph++; if (o.isMesh) meshes++; }});
  const s = tw.spawningNow(); return {{ placeholders: ph, meshes, anims: s.anims, loading: !!s.last?.loading, pending: tw.sync.pendingCount() }}; }})()"""
# an upper room: tw.spawnRoom's own steps, with y (feet) in the recipe and in room.spawn. -> {ok, id} | {ok: false, why}
UPPER_JS = """async ([type, x, z, w, d, seed, y]) => { const said = []; const toast0 = tw.toast; tw.toast = (t, bad) => { said.push(String(t)); return toast0(t, bad); };
  try { const area = tw.area(), v = tw.sync.view(area), id = 'room_up' + seed;
    const b = tw.buildingFor(x, z, w, d);
    const L = tw.roomgen.solve(v.entities, { id, type, x, z, w, d, y, seed }, v.order + 1);
    const cid = tw.batch([{ type: 'room.spawn', args: { id, ...b, type, x, z, w, d, y, seed, engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]);
    const ack = await tw.await(cid); await new Promise(r => setTimeout(r, 300));
    const e = tw.entities()[id];
    if (!e) return { ok: false, why: said.filter(s => /refus|unknown|overlap|bad|not/i.test(s)).join(' | ') || (ack ? 'acknowledged, but no room appeared' : 'no acknowledgement (refused)') };
    if ((e.recipe?.y ?? e.y ?? 0) !== y) return { ok: false, id, why: 'the room was built, but y was dropped: it stands on the ground (' + JSON.stringify(e.recipe) + ')' };
    return { ok: true, id };
  } catch (err) { return { ok: false, why: 'threw: ' + (err?.message || err) }; } finally { tw.toast = toast0; } }"""
MEASURE_JS = """(ms) => new Promise(resolve => { const dts = []; let last = null, t0 = null; const frames0 = tw.stats.frames; const fxs = [];
  const tick = (now) => { if (last !== null) dts.push(now - last); else t0 = now; last = now;
    if (dts.length % 30 === 0) { const s = tw.worldOf(tw.area()).fx?.stats?.(); if (s) fxs.push([s.frame_draw_calls, s.frame_triangles]); }
    if (now - t0 < ms) requestAnimationFrame(tick); else resolve({ dts, wall: now - t0, game_frames: tw.stats.frames - frames0, fxs }); };
  requestAnimationFrame(tick); })"""
def pct(xs, q): xs = sorted(xs); return xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))]

def main():
    out = {'script': 'perf_storeys', 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'target': None, 'upper_asked': A.upper, 'upper_built': False, 'uncapped': A.uncapped, 'viewport': [VIEWPORT['width'], VIEWPORT['height']]}
    try: out['commit'] = subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()
    except Exception: pass
    live = A.live or A.page
    page_url = (A.page or 'http://127.0.0.1:8180/') if live else start_local()
    if live: page_url += ('&' if '?' in page_url else '?') + 'nointro'
    out['target'] = 'live ' + page_url.split('?')[0] if live else 'local'
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not A.headed, args=ARGS)
        ctx = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
        pg = ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' else None)
        pg.on('response', lambda r: errors.append(f'{r.status} {r.url[:160]}') if r.status >= 400 else None)
        if not live: tw_sandbox.proxy(pg, A.api)  # the house look (atmosphere, selection ...) as the live game has it
        pg.add_init_script(INIT_JS)
        pg.goto(page_url)
        pg.fill('#newCampaign input[name=name]', CAMPAIGN); pg.fill('#newCampaign input[name=gm]', 'Fauna-perf'); pg.click('#newCampaign button')
        try: pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=90000)
        except Exception:
            say('the game never came up:', pg.evaluate("JSON.stringify({ tw: !!window.tw, status: window.tw?.sync?.status ?? null, main: !!window.tw?.main, text: document.body.innerText.slice(0, 200) })"), errors[:5]); raise
        pg.mouse.move(5, 5)  # the cursor stirs the fog: park it off the map
        out.update(engine=pg.evaluate('tw.roomgen.version'), transport=pg.evaluate('tw.transport()'), faces=pg.evaluate('String(tw.facesUsed)'), dpr=pg.evaluate('devicePixelRatio'))
        gpu = pg.evaluate(GPU_JS) or {}
        out['renderer'] = gpu.get('renderer'); out['vendor'] = gpu.get('vendor')
        out['gpu'] = bool(gpu.get('renderer')) and not any(s in gpu['renderer'].lower() for s in ('swiftshader', 'llvmpipe', 'softpipe', 'software'))
        say(f"renderer: {gpu.get('renderer')}  ->  {'GPU' if out['gpu'] else 'SOFTWARE GL (the numbers mean nothing)'}")
        cam = f"(() => {{ const g = tw.main.grab; g.focus.set({CAMERA['x']}, 0, {CAMERA['z']}); g.pitch = {CAMERA['pitch']}; g.yaw = {CAMERA['yaw']}; g.dist = {CAMERA['dist']}; g.update(); tw.main.rule = 'free'; }})()"
        pg.evaluate(cam)

        # ---------- the scene, through room.spawn
        ids = []
        for r in INN + [YARD]:
            ids.append(pg.evaluate(f"tw.spawnRoom('{r[0]}', {r[1]}, {r[2]}, {r[3]}, {r[4]}, {r[5]})"))
            pg.wait_for_function(f"!!tw.entities()['{ids[-1]}'] && tw.sync.pendingCount() === 0", timeout=30000)
        inn_b = pg.evaluate(f"JSON.stringify({json.dumps(ids[:4])}.map(id => tw.entities()[id].building))")
        one_building = len(set(json.loads(inn_b))) == 1 and json.loads(inn_b)[0] is not None
        if not one_building: say(f'NOTE: the four inn rooms are not one building: {inn_b}')
        out['scene'] = {'rooms': [r[0] for r in INN + [YARD]], 'inn_is_one_building': one_building}
        A.upper = not A.flat
        if A.upper:
            why = None
            for r in UPPER:
                res = pg.evaluate(UPPER_JS, [*r, UPPER_Y])
                if not res.get('ok'):
                    why = res.get('why') or 'refused'
                    if res.get('id'): pg.evaluate(f"tw.dispatch('room.delete', {{ id: '{res['id']}' }})"); pg.wait_for_timeout(500)
                    break
                ids.append(res['id'])
            if why:
                out['upper_refused'] = why
                say(f'UPPER STOREY NOT BUILT: the engine rejected room.spawn with y={UPPER_Y}: {why}\n  -> continuing with the FLAT scene; this is not an "after" number.')
                for rid in ids[5:]: pg.evaluate(f"tw.dispatch('room.delete', {{ id: '{rid}' }})")
                ids = ids[:5]; pg.wait_for_timeout(500)
            else:
                out['upper_built'] = True; out['scene']['rooms'] += [f'{r[0]}@y{UPPER_Y}' for r in UPPER]
        pg.evaluate(cam)

        # ---------- every mesh loaded, the spawn animation over, and it stays that way for 2 s
        t0 = time.time(); quiet = None; st = {}
        while time.time() - t0 < 240:
            st = pg.evaluate(LOADED_JS)
            if st['placeholders'] == 0 and st['anims'] == 0 and not st['loading'] and st['pending'] == 0:
                quiet = quiet or time.time()
                if time.time() - quiet >= 2: break
            else: quiet = None
            pg.wait_for_timeout(250)
        out['settled'] = bool(quiet and time.time() - quiet >= 2); out['settle_s'] = round(time.time() - t0, 1)
        if not out['settled']: say(f'NOTE: the scene never settled: {st}')
        n = pg.evaluate("(() => { const es = Object.values(tw.entities()); return { rooms: es.filter(e => e.kind === 'room').length, objects: es.filter(e => e.kind === 'object').length, buildings: es.filter(e => e.kind === 'building').length }; })()")
        out['scene'].update(n, meshes=st.get('meshes'))
        pg.evaluate(cam); pg.mouse.move(5, 5); pg.wait_for_timeout(3000)  # the fog and the lights settle on the finished rooms


        # ---------- the rest of the building: the upper rooms' stair, a cellar under the kitchen with its stair
        if not A.flat:
            pg.evaluate("(async () => { const up = Object.values(tw.entities()).find(e => e.kind === 'room' && (e.recipe.y || 0) === 10); const P = up && tw.planStair && tw.planStair(up); if (P) { await tw.await(tw.dispatch('object.place', P.args)); } })()")
            pg.evaluate("tw.spawnRoom('cellar', 10, 4, 4, 5, 7301, undefined, -10)"); pg.wait_for_timeout(2500)
            for _ in range(240):
                st = pg.evaluate(LOADED_JS)
                if st['placeholders'] == 0 and st['anims'] == 0 and not st['loading'] and st['pending'] == 0: break
                pg.wait_for_timeout(250)
            pg.wait_for_timeout(2500)
            out['scene']['stairs'] = pg.evaluate("Object.values(tw.entities()).filter(e => e.place === 'stair').length")
            out['scene']['levels'] = pg.evaluate("JSON.stringify([...new Set(Object.values(tw.entities()).filter(e => e.kind === 'room').map(e => e.recipe.y || 0))].sort((a, b) => a - b))")
        pg.evaluate(cam); pg.mouse.move(5, 5)
        pg.evaluate(PROBE_JS)
        say('scene', json.dumps(out['scene']))

        BASE = {'all': "tw.setRoofs(false, 'perf'); tw.setCut(null, { pinned: true, by: 'perf' })"}
        if not A.flat:
            BASE.update({'roofs': "tw.setCut(null, { pinned: true, by: 'perf' }); tw.setRoofs(true, 'perf')",
                         'lv1': "tw.setRoofs(false, 'perf'); tw.setCut(9, { pinned: true, by: 'perf' })",
                         'lv2': "tw.setRoofs(false, 'perf'); tw.setCut(19, { pinned: true, by: 'perf' })",
                         'lv-1': "tw.setRoofs(false, 'perf'); tw.setCut(-1, { pinned: true, by: 'perf' })"})
        cases = [(k, v, None) for k, v in BASE.items()]
        if A.breakdown:
            for base in (['all'] if A.flat else ['all', 'lv2']):
                for name, js in SUSPECTS.items():
                    if A.flat and name in ('slabs', 'upper', 'stairs', 'supports', 'cellar'): continue
                    cases.append((f'{base} - {name}', BASE[base], js))
        if A.ab: cases = [x for k, v, _ in list(cases) for x in ((k, v, None), (k + ' (old)', v, OLD_JS))]
        if A.only: cases = [c for c in cases if c[0] in A.only.split(',')]
        res = {c[0]: [] for c in cases}
        load, waited = wait_for_quiet()
        for rnd in range(A.rounds):
            for name, base, off in cases:
                pg.evaluate("window.__perfRestore && window.__perfRestore()")
                pg.evaluate(base); pg.wait_for_timeout(900)
                if off: pg.evaluate(off); pg.wait_for_timeout(500)
                pg.evaluate("window.__probe.reset()")
                m = pg.evaluate(MEASURE_JS, A.seconds * 1000)
                pr = pg.evaluate("window.__probe.read()")
                dts = m['dts']; fxs = m['fxs'] or [[None, None]]
                info = pg.evaluate(INFO_JS)
                res[name].append({'median': statistics.median(dts), 'p95': pct(dts, 0.95), 'p25': pct(dts, 0.25), 'p75': pct(dts, 0.75), 'mean': statistics.mean(dts), 'over20': 100 * sum(1 for d in dts if d > 20) / len(dts), 'calls': statistics.mean(f[0] for f in fxs) if fxs[0][0] is not None else None, 'tris': statistics.mean(f[1] for f in fxs) if fxs[0][0] is not None else None, **pr, **info, 'load': load_now()[0]})
                if A.shots and rnd == 0: os.makedirs(A.shots, exist_ok=True); pg.screenshot(path=os.path.join(A.shots, name.replace(' ', '_').replace('+', '') + '.png'))
            say(f'round {rnd + 1}/{A.rounds} done, load {load_now()[0]}')
        pg.evaluate("window.__perfRestore && window.__perfRestore()")
        if os.environ.get('PERF_EVAL'): pg.wait_for_timeout(1500); say('EVAL', json.dumps(pg.evaluate(os.environ['PERF_EVAL'])))
        med = lambda xs: round(statistics.median(xs), 2)
        table = {}
        for name, rs in res.items():
            keys = [k for k in rs[0] if isinstance(rs[0][k], (int, float)) and rs[0][k] is not None]
            table[name] = {k: med([r[k] for r in rs]) for k in keys}
        out['cases'] = table; out['rounds'] = A.rounds; out['load'] = load; out['load_after'] = load_now()
        out['context_lost'] = bool((pg.evaluate(GPU_JS) or {}).get('lost')); out['page_errors'] = errors[:5]
        browser.close()
    print(json.dumps(out), flush=True)
    say(f"\n{'case':34} {'median':>7} {'p95':>7} {'calls':>6} {'tris(M)':>8} {'js':>6} {'world':>6} {'fx.fr':>6} {'render':>6} {'lit':>4} {'shadow':>6} {'vis':>5} {'p25':>6} {'p75':>6} {'mean':>6} {'>20%':>5} {'castY':>6} {'reach':>5}")
    for name, t in table.items():
        say(f"{name:34} {t.get('median', 0):7.2f} {t.get('p95', 0):7.2f} {t.get('calls', 0):6.0f} {t.get('tris', 0) / 1e6:8.2f} {t.get('js', 0):6.2f} {t.get('world', 0):6.2f} {t.get('fxframe', 0):6.2f} {t.get('render', 0):6.2f} {t.get('lit', 0):4.0f} {t.get('shadow_lights', 0):6.0f} {t.get('visible_meshes', 0):5.0f} {t.get('p25', 0):6.2f} {t.get('p75', 0):6.2f} {t.get('mean', 0):6.2f} {t.get('over20', 0):5.1f} {t.get('caster_y', 0):6.1f} {t.get('caster_reach', 0):5.1f}")
    return 2 if not out['gpu'] else 0

# JS time spent inside requestAnimationFrame callbacks, per frame
INIT_JS = """(() => { const raf = window.requestAnimationFrame.bind(window); window.__raf = { ms: 0, n: 0 };
  window.requestAnimationFrame = (cb) => raf((t) => { const t0 = performance.now(); try { cb(t); } finally { window.__raf.ms += performance.now() - t0; window.__raf.n++; } }); })()"""
PROBE_JS = """(() => { const w = tw.worldOf(tw.area()), acc = { world: 0, fxframe: 0, render: 0, frames: 0 };
  const wrap = (o, k, key) => { const f = o[k].bind(o); o[k] = (...a) => { const t0 = performance.now(); try { return f(...a); } finally { acc[key] += performance.now() - t0; } }; };
  wrap(w, 'frame', 'world'); wrap(w.fx, 'frame', 'fxframe'); wrap(w.fx, 'render', 'render');
  const f0 = () => tw.stats.frames; let start = f0(), raf0 = { ...window.__raf };
  window.__probe = { reset() { acc.world = acc.fxframe = acc.render = 0; start = f0(); raf0 = { ...window.__raf }; },
    read() { const n = Math.max(1, f0() - start), rn = Math.max(1, window.__raf.n - raf0.n); return { world: (acc.world - acc.fxframe) / n, fxframe: acc.fxframe / n, render: acc.render / n, js: (window.__raf.ms - raf0.ms) / n }; } };
  const undo = []; window.__perfUndo = undo; window.__perfRestore = () => { while (undo.length) { try { undo.pop()(); } catch (e) {} } };
  // helpers for the suspects: hide a set of groups until restored (re-asserted every frame, since the cut pass may show them again)
  window.__hide = (pred) => { const gs = []; for (const s of w.shell.values()) if (pred({ shell: s })) gs.push(s.group); for (const r of w.recs.values()) if (pred({ rec: r })) gs.push(r.group);
    const was = gs.map(g => g.visible), id = setInterval(() => { for (const g of gs) g.visible = false; }, 0); const fr = w.cutPass.bind(w); w.cutPass = () => { fr(); for (const g of gs) g.visible = false; };
    undo.push(() => { clearInterval(id); w.cutPass = fr; gs.forEach((g, i) => { g.visible = was[i]; }); w.cutDirty = true; }); return gs.length; };
  window.__roomY = (id) => { const e = tw.entities()[id]; return e && e.recipe ? (e.recipe.y || 0) : null; };
})()"""
INFO_JS = """(() => { const w = tw.worldOf(tw.area()); let vis = 0, cast = 0, sl = 0, pl = 0, cy = -99, cd = 0;
  const seen = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  w.scene.traverse(o => { if (o.isMesh && seen(o)) { vis++; if (o.castShadow) cast++; } if (o.isLight && seen(o)) { if (o.isPointLight || o.isSpotLight) pl++; if (o.castShadow) { sl++; if (o.isPointLight) { const p = new o.position.constructor(); o.getWorldPosition(p); cy = p.y; cd = o.distance; } } } });
  const s = w.fx.stats(); return { caster_y: cy, caster_reach: cd, visible_meshes: vis, shadow_casters: cast, shadow_lights: sl, point_lights: pl, lit: w.litCount ? w.litCount() : 0, programs: s.programs ?? 0 }; })()"""
OLD_JS = "(() => { const w = tw.worldOf(tw.area()); w.noUnseenRule = w.noShadowRule = true; w.cutDirty = true; w.shadowKey = null; __perfUndo.push(() => { w.noUnseenRule = w.noShadowRule = false; w.cutDirty = true; w.shadowKey = null; }); })()"
# one suspect switched off at a time (each pushes its own undo)
SUSPECTS = {
  'slabs': "__hide(o => o.shell && o.shell.spec.slab)",
  'upper': "__hide(o => (o.shell && __roomY(o.shell.roomId) > 0) || (o.rec && o.rec.entity.kind === 'object' && __roomY(o.rec.entity.room) > 0))",
  'upper-things': "__hide(o => o.rec && o.rec.entity.kind === 'object' && __roomY(o.rec.entity.room) > 0)",
  'covered-things': "(() => { const w = tw.worldOf(tw.area()); w.cutSets(); const c = w.coveredRooms; return __hide(o => o.rec && o.rec.entity.kind === 'object' && c.has(o.rec.entity.room) && o.rec.entity.place !== 'stair' && !o.rec.entity.fromEdge); })()",
  'covered-floors': "(() => { const w = tw.worldOf(tw.area()); w.cutSets(); const c = w.coveredRooms; return __hide(o => o.shell && o.shell.spec.layer === 'floor' && !o.shell.spec.slab && c.has(o.shell.roomId)); })()",
  'cellar': "__hide(o => (o.shell && __roomY(o.shell.roomId) < 0) || (o.rec && o.rec.entity.kind === 'object' && __roomY(o.rec.entity.room) < 0))",
  'stairs': "__hide(o => o.rec && o.rec.entity.place === 'stair')",
  'supports': "__hide(o => o.shell && o.shell.spec.support)",
  'all-things': "__hide(o => o.rec && o.rec.entity.kind === 'object')",
  'fire-shadows': "(() => { const w = tw.worldOf(tw.area()), p = w.fx.params('lighting'), n = p.shadows.casters; w.fx.setParams('lighting', { ...p, shadows: { ...p.shadows, casters: 0 } }); __perfUndo.push(() => w.fx.setParams('lighting', { ...p, shadows: { ...p.shadows, casters: n } })); })()",
  'sun-shadow': "(() => { const w = tw.worldOf(tw.area()), was = w.sun.castShadow; w.sun.castShadow = false; __perfUndo.push(() => { w.sun.castShadow = was; }); return was; })()",
  'lamps': "(() => { const w = tw.worldOf(tw.area()), f = w.fxItems.bind(w); w.fxItems = () => []; __perfUndo.push(() => { w.fxItems = f; }); })()",
  'fog': "(() => { const w = tw.worldOf(tw.area()), p = w.fx.params('atmos'); w.fx.setParams('atmos', { ...p, on: false }); __perfUndo.push(() => w.fx.setParams('atmos', p)); return Object.keys(p).join(','); })()",
  'post-stack': "(() => { const w = tw.worldOf(tw.area()), L = w.fx.lighting; L.params.on = false; L.apply(); __perfUndo.push(() => { L.params.on = true; L.apply(); }); })()",
  'cut-fog-roof-passes': "(() => { const w = tw.worldOf(tw.area()), a = w.cutPass, b = w.roofPass, c = w.fogLevel, L = w.fogLevel(); w.cutPass = () => {}; w.roofPass = () => {}; w.fogLevel = () => L; __perfUndo.push(() => { w.cutPass = a; w.roofPass = b; w.fogLevel = c; }); })()",
  'labels-dom': "(() => { const els = [...document.querySelectorAll('#labels, .roomLabel, #levelMeter, #chips, .labels')], was = els.map(e => e.style.display); els.forEach(e => { e.style.display = 'none'; }); __perfUndo.push(() => els.forEach((e, i) => { e.style.display = was[i]; })); return els.length; })()",
  'signals-cursors': "(() => { const w = tw.worldOf(tw.area()), a = w.frameSignals, b = w.frameCursors; w.frameSignals = () => {}; w.frameCursors = () => {}; __perfUndo.push(() => { w.frameSignals = a; w.frameCursors = b; }); })()",
}

if __name__ == '__main__':
    code = 1
    try: code = main()
    finally:
        for pr in procs: pr.terminate()
    sys.exit(code)
