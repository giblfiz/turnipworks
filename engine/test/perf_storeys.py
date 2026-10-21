#!/usr/bin/env python3
"""Frame-time measurement for the "storeys" work (2026-10-05): one fixed scene, one JSON line of numbers.

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
ap.add_argument('--seconds', type=float, default=10.0)
ap.add_argument('--cut', help="set the cut before measuring: a ceiling height in feet (9 = the ground floor, 19 = lv 2), or 'off'")
ap.add_argument('--roofs', action='store_true', help='roofs on (storeys, Stage F) before measuring')
ap.add_argument('--no-lamp-rule', action='store_true', help='leave every lamp on whatever is visible (the cost before "lamps belong to their room")')
ap.add_argument('--max-load', type=float, default=8.0, help='wait (up to --load-wait s) while the 1-minute load average is above this')
ap.add_argument('--load-wait', type=float, default=300.0)
ap.add_argument('--api', default='http://127.0.0.1:8096', help='local runs: where the house look is read from')
ap.add_argument('--shot', help='save a screenshot of the measured view here')
ap.add_argument('--headed', action='store_true')
A = ap.parse_args()
def say(*a): print(*a, file=sys.stderr, flush=True)

# the chromium flags that make headless draw on the real GPU (copied from tools/spawn-tuner/test/atmos_game.py)
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
if A.uncapped: ARGS += ['--disable-frame-rate-limit', '--disable-gpu-vsync']

CAMPAIGN = 'TEST storeys perf (throwaway)'
VIEWPORT = {'width': 1920, 'height': 1080}
# the scene, in 5-ft cells: (type, x, z, w, d, seed). The inn is 50 x 45 ft; the yard lies along its east side.
INN = [('common', 4, 4, 6, 5, 7101), ('kitchen', 10, 4, 4, 5, 7102), ('guest', 4, 9, 5, 4, 7103), ('guest', 9, 9, 5, 4, 7104)]
YARD = ('yard', 14, 4, 6, 9, 7105)
UPPER = [('guest', 4, 4, 5, 4, 7201), ('guest', 9, 4, 5, 4, 7202)]  # --upper: on top of the common room and the kitchen
UPPER_Y = 10  # feet
CAMERA = {'x': 60, 'z': 42.5, 'dist': 110, 'pitch': 55, 'yaw': 0}  # table distance, on the building and its yard

procs = []
RP, SP = 18112, 18739
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

        # ---------- the cut (storeys, Stage C) and the lamp rule
        if A.no_lamp_rule: pg.evaluate(f"{W}.noLampRule = true")
        if A.cut is not None and pg.evaluate("typeof tw.setCut === 'function'"):
            pg.evaluate(f"tw.setCut({'null' if A.cut == 'off' else float(A.cut)}, {{ pinned: true, by: 'perf' }})")
        if A.roofs and pg.evaluate("typeof tw.setRoofs === 'function'"): pg.evaluate("tw.setRoofs(true, 'perf')")
        pg.wait_for_timeout(2500)
        out['roofs'] = pg.evaluate(f"{W}.roofReport ? {W}.roofReport().filter(r => r.shown).length : null")
        out['cut'] = pg.evaluate("tw.cut ? tw.cut.y : 'n/a'"); out['lamp_rule'] = not A.no_lamp_rule
        out['lit_items'] = pg.evaluate(f"{W}.litCount ? {W}.litCount() : null")

        # ---------- the look that is being measured
        look = pg.evaluate(f"""(() => {{ const w = {W}, fx = w.fx; if (!fx) return {{ fx: false }}; const s = fx.stats(), a = fx.params('atmos'), l = fx.params('lighting');
          return {{ fx: true, post: !!l?.on, atmos: a?.name || null, atmos_volume: !!s.atmos_volume, atmos_grid: s.atmos_grid ?? null, fog_rooms: fx.atmos.rooms?.().length ?? null, house: tw.houseInfo?.().from || null }}; }})()""")
        out['look'] = look
        out['fog_on'] = bool(look.get('fx') and look.get('atmos_volume'))
        if not out['fog_on']: say(f'NOTE: the house atmosphere (fog) is NOT running: {look}')

        # ---------- measure
        load, waited = wait_for_quiet()
        pg.bring_to_front()
        m = pg.evaluate(MEASURE_JS, A.seconds * 1000)
        load_after = load_now()
        dts = m['dts']
        out.update(frames=len(dts), seconds=round(m['wall'] / 1000, 2),
                   median_ms=round(statistics.median(dts), 2), p95_ms=round(pct(dts, 0.95), 2), p99_ms=round(pct(dts, 0.99), 2), max_ms=round(max(dts), 2),
                   mean_fps=round(len(dts) * 1000 / m['wall'], 1), game_frames=m['game_frames'])
        fxs = m['fxs'] or [[None, None]]
        if fxs[0][0] is not None:
            out.update(draw_calls=round(statistics.mean(f[0] for f in fxs)), triangles=round(statistics.mean(f[1] for f in fxs)), draw_calls_max=max(f[0] for f in fxs), triangles_max=max(f[1] for f in fxs))
        else: out.update(draw_calls=None, triangles=None)
        s2 = pg.evaluate(f"(() => {{ const s = {W}.fx?.stats?.() || {{}}; return {{ programs: s.programs ?? null, atmos_cpu_ms: s.atmos_cpu_ms ?? null }}; }})()")
        out.update(programs=s2['programs'], load=load, load_after=load_after, load_waited_s=waited)
        out['context_lost'] = bool((pg.evaluate(GPU_JS) or {}).get('lost'))
        out['page_errors'] = errors[:5]
        if A.shot: pg.screenshot(path=A.shot)
        browser.close()
    print(json.dumps(out), flush=True)
    return 2 if not out['gpu'] else 0

if __name__ == '__main__':
    code = 1
    try: code = main()
    finally:
        for pr in procs: pr.terminate()
    sys.exit(code)
