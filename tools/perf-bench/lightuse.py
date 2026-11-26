#!/usr/bin/env python3
"""THE LIGHT-USE BENCH (2026-11-06; docs/PERF.md). Harry: "We are bound by the weakest PC that the party has."
Idle already feels fine; what players feel is LIGHT USE: a player scrolling, orbiting, zooming, selecting, putting a few
things down, dragging a pawn. This drives exactly that with REAL input (mouse and key events through the browser, not
calls into the game) on three maps it builds itself (tools/perf-bench/maps.py: an inn with an upper storey, a town of
about 100 rooms, hill country with caves), and prints one compact table per map:

  phase    rest · pan (right-drag) · orbit (middle-drag) · zoom (wheel) · hover · select (clicks) · place (the bar:
           "barrel", three put down) · drag (a pawn) · ring (click a pawn, open its menu)
  frame    p50 / p95 / p99 of the time between drawn frames (what the eye sees; 16.7 = 60 a second), and long frames
           (over 50 ms) - the "crispness" numbers (wiki projects/3d-vtt/loading-and-feel: chokes, melting, crispness)
  work     p50 / p95 main-thread time inside a frame (gfx.begin to gfx.end)
  input    p50 / p95 from an input event to the end of the frame that shows it
  gpu      mean / p95 GPU time a frame (EXT_disjoint_timer_query_webgl2, where the browser has it)
  calls    draw calls a frame, fire-shadow redraws and underground redraws in the phase
It writes everything (every frame) to JSON.

  # on this box (the build box, RTX 3060: a desktop, NOT representative)
  python3 tools/perf-bench/lightuse.py
  # on the front web server (Intel HD 4600, close to a 2012 MacBook's HD 4000), the stack still here, tunnelled
  ... lightuse.py --machine the front web server --maps inn,town,cave --json experiments/2026-11-06-perf/results/x.json
  # A/B of the levers in ONE page (tw.levers; interleaved rounds, so load drift hits both)
  ... lightuse.py --machine the front web server --configs off,on --rounds 3
  # where the GPU time goes, pass by pass (profile mode: the frame cut into timer segments)
  ... lightuse.py --machine the front web server --profile
  # budget mode: exit 1 when a phase is over the thresholds (a manual gate, not part of the pass/fail matrix)
  ... lightuse.py --budget p95=34,p99=67,long=2,lat95=60

The game under the bench is as a player gets it: the idle rate, the 60 limit and the governor on (tw.gfxForce,
tw.interactForce: under a test driver they are otherwise off), the preset pinned (--preset; 'auto' lets Auto choose and
reports what it chose). The maps are built once (in a browser on THIS box) and kept in --data between runs; a run puts
everything it changed back (the props it placed, the pawn it dragged) with the game's own undo.
Exit: 0 measured (and within budget), 1 over budget, 2 software GL, 3 could not measure.
"""
import argparse, json, os, statistics, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(REPO, 'tests'))
import tw_sandbox  # noqa: E402  (reads of the house look go through the sandbox; this bench writes nothing there)
from stack import Stack  # noqa: E402
import maps as M  # noqa: E402
import cpuprof  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('--machine', default='local', help="local (this box's GPU) or the front web server")
ap.add_argument('--maps', default='inn,town,cave')
ap.add_argument('--phases', default='rest,pan,orbit,zoom,hover,select,place,drag,ring')
ap.add_argument('--preset', default='high', help='high | medium | low | auto (Auto chooses; reported) | asis')
ap.add_argument('--configs', default='', help='comma list of lever configurations to A/B in one page (see LEVERS); empty = the code as it is')
ap.add_argument('--rounds', type=int, default=1)
ap.add_argument('--profile', action='store_true', help='also cut the GPU frame into passes during a scripted orbit')
ap.add_argument('--idle-watch', type=float, default=0, help='after the phases, watch an idle page this many seconds for long tasks')
ap.add_argument('--budget', default='', help='p95=..,p99=..,long=..,lat95=.. (ms, ms, count, ms): exit 1 when any phase is over')
ap.add_argument('--cpuprofile', default='', help='comma list of phases to take a main-thread CPU profile of (V8 sampling, over CDP)')
ap.add_argument('--json', default='')
ap.add_argument('--shots', default='', help='a folder: a still of each map at rest (per config)')
ap.add_argument('--data', default=os.environ.get('TW_PERF_DATA', os.path.expanduser('~/.cache/tw-perf-bench')))
ap.add_argument('--rebuild', action='store_true')
ap.add_argument('--build-only', action='store_true')
ap.add_argument('--window', default='1440x900')
ap.add_argument('--api', default='http://127.0.0.1:8096', help='where the house look is read from (read-only, sandboxed)')
A = ap.parse_args()
WIN = tuple(int(x) for x in A.window.split('x'))
GPU_LOCAL = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
PROBE = open(os.path.join(HERE, 'probe.js')).read()
# LEVER CONFIGURATIONS (tw.levers; engine/client/levers.js says what each one is). 'off' = every lever off = the code as
# it was before them; 'on' = what ships.
LEVERS = {
    'asis': None,
    'off': {'dynres': False, 'shadowCache': False, 'underMove': False, 'early': False},
    'on': {},  # (the defaults)
    'dynres': {'dynres': True, 'shadowCache': False, 'underMove': False, 'early': False},
    'shadowCache': {'dynres': False, 'shadowCache': True, 'underMove': False, 'early': False},
    'underMove': {'dynres': False, 'shadowCache': False, 'underMove': True, 'early': False},
    'early': {'dynres': False, 'shadowCache': False, 'underMove': False, 'early': True},
    'dynearly': {'dynres': True, 'shadowCache': False, 'underMove': False, 'early': True},  # (dynres needs early: alone, the pixel stage is never reached inside a move)
    # (a config may also set this viewer's graphics switches: prefs, through tw.settings.setPref; the bench puts them back)
    'noshadow': {'prefs': {'shadowsFx': False}},
    'shadow': {'prefs': {'shadowsFx': True}},
}
def apply_config(pg, c):
    v = LEVERS.get(c)
    if v is None: return
    v = dict(v); prefs = v.pop('prefs', None)
    pg.evaluate("(() => { tw.interact?.reset?.(); if (tw.interact?.state) tw.interact.state.moves = 0; try { localStorage.removeItem('tw.governor'); } catch (e) {} })()")  # (every config starts the governor from nothing, as on a first visit: what one learned must not help the next)
    if v or c in ('off', 'on'): pg.evaluate(f"tw.levers = {json.dumps(v)}")
    for k, x in (prefs or {}).items(): pg.evaluate(f"tw.settings.setPref({json.dumps(k)}, {json.dumps(x)})")
    if prefs: pg.wait_for_timeout(800)
def say(*a): print(*a, file=sys.stderr, flush=True)
def pct(xs, q):
    xs = sorted(x for x in xs if x is not None)
    return None if not xs else xs[min(len(xs) - 1, int(round(q * (len(xs) - 1))))]


# ---------------------------------------------------------------- building the maps (once, on this box)
STATE = lambda: os.path.join(A.data, 'maps.json')
def load_state():
    try: return json.load(open(STATE()))
    except Exception: return {}
def wait(pg, js, ms=60000, what=''):
    try: pg.wait_for_function(js, timeout=ms, polling=100); return True
    except Exception: say(f'  (timed out: {what or js[:70]})'); return False
SETTLED = """(() => { const w = tw.worldOf(tw.area()); let ph = 0; w.scene.traverse(o => { if (o.userData?.placeholder && o.visible !== false) ph++; });
  const s = tw.spawningNow(); return ph === 0 && s.anims === 0 && !s.last?.loading && tw.sync.pendingCount() === 0 && w.settler.pending() === 0; })()"""
def settle(pg, ms=600000, quiet=1.5):
    t0 = time.time(); q = None
    while time.time() - t0 < ms / 1000:
        if pg.evaluate(SETTLED):
            q = q or time.time()
            if time.time() - q >= quiet: return True
        else: q = None
        pg.wait_for_timeout(400)
    return False

def build(p, name):
    plan = M.plan(name); say(f'building map {name}: {sum(1 for s in plan["steps"] if s[0] == "room")} rooms')
    b = p.chromium.launch(headless=True, args=GPU_LOCAL)
    try:
        ctx = b.new_context(viewport={'width': WIN[0], 'height': WIN[1]}); pg = ctx.new_page(); tw_sandbox.proxy(pg, A.api); pg.set_default_timeout(120000)
        pg.goto(Stack.page_url())
        pg.fill('#newCampaign input[name=name]', f'TEST perf-bench {name} (throwaway)'); pg.fill('#newCampaign input[name=gm]', 'Bench'); pg.click('#newCampaign button')
        wait(pg, 'window.tw && tw.ready && tw.ready()', 120000, 'GM tab')
        token = pg.evaluate("new URLSearchParams(location.hash.slice(1)).get('s')")
        c = plan['camera']; pg.evaluate(f"(() => {{ const g = tw.main.grab; g.focus.set({c['x']}, 0, {c['z']}); g.dist = 200; g.update(); tw.main.rule = 'free'; }})()")
        t0 = time.time(); fails = []
        for i, s in enumerate(plan['steps']):
            if s[0] == 'ground': pg.evaluate(f"tw.dispatch('area.ground', {{ cat: '{s[1]}' }})"); pg.wait_for_timeout(500); continue
            _, t, x, z, w, d, seed, y = s
            rid = pg.evaluate(f"(() => {{ try {{ return tw.spawnRoom({json.dumps(t)}, {x}, {z}, {w}, {d}, {seed}, undefined, {y}); }} catch (e) {{ return 'ERR ' + e.message; }} }})()")
            if not rid or str(rid).startswith('ERR') or not wait(pg, f"!!tw.entities()[{json.dumps(rid)}] && tw.sync.pendingCount() === 0", 120000, f'room {i}'): fails.append([i, t, rid])
            if i % 20 == 19: say(f'  {i + 1}/{len(plan["steps"])} ({time.time() - t0:.0f} s)')
        pawns = []
        for j, (x, z) in enumerate(plan['pawns']):
            pid = f'tok_bench{j:03d}x{name[:4]}'
            pg.evaluate(f"tw.dispatch('token.create', {{ id: '{pid}', name: 'Bench {j + 1}', x: {x}, z: {z} }})"); pawns.append(pid)
        wait(pg, f"{json.dumps(pawns)}.every(id => tw.entities()[id]) && tw.sync.pendingCount() === 0", 20000, 'pawns')
        settle(pg, 900000)
        counts = pg.evaluate("(() => { const c = {}; for (const e of Object.values(tw.entities())) c[e.kind] = (c[e.kind] || 0) + 1; return c; })()")
        say(f'  built {name} in {time.time() - t0:.0f} s: {counts}; failed steps {fails}')
        return {'token': token, 'pawns': pawns, 'camera': plan['camera'], 'counts': counts, 'failed': fails, 'built': time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    finally: b.close()


# ---------------------------------------------------------------- real input, paced like a hand (60 events a second)
class Hand:
    def __init__(self, pg): self.pg = pg; self.x, self.y = WIN[0] / 2, WIN[1] / 2
    def path(self, pts, ms, button=None):
        """move through pts over ms (a mouse reports about 60 times a second); a button held if given"""
        pg = self.pg; n = max(2, int(ms / 16.7)); t0 = time.perf_counter()
        segs = []
        for (ax, ay), (bx, by) in zip(pts, pts[1:]): segs.append((ax, ay, bx, by, ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5))
        L = sum(s[4] for s in segs) or 1
        pg.mouse.move(*pts[0]);
        if button: pg.mouse.down(button=button)
        for i in range(1, n + 1):
            d = L * i / n
            for ax, ay, bx, by, l in segs:
                if d <= l or (ax, ay, bx, by, l) == segs[-1]: k = min(1, d / l) if l else 1; x, y = ax + (bx - ax) * k, ay + (by - ay) * k; break
                d -= l
            due = t0 + i * ms / 1000 / n; w = due - time.perf_counter()
            if w > 0: time.sleep(w)
            pg.mouse.move(x, y)
        if button: pg.mouse.up(button=button)
        self.x, self.y = pts[-1]
    def click(self, x, y, approach=250):
        self.path([(self.x, self.y), (x, y)], approach); self.pg.mouse.down(); time.sleep(0.07); self.pg.mouse.up()
    def wheel(self, dy, n, gap=0.06):
        for _ in range(n): self.pg.mouse.wheel(0, dy); time.sleep(gap)
    def rest(self, s): self.pg.mouse.move(8, WIN[1] - 8); time.sleep(s); self.x, self.y = 8, WIN[1] - 8


def screen_things(pg, n=8):
    """things near the middle of the view, as screen points inside the safe middle of the window"""
    return pg.evaluate(f"""(() => {{ const W = innerWidth, H = innerHeight, out = [];
      for (const e of Object.values(tw.entities())) {{ if (e.kind !== 'object' || e.layer === 'walls' || e.layer === 'openings' || e.place === 'tile' || e.layer === 'floor') continue;
        const s = tw.screenOf(e.x, e.z, tw.main, (e.y || 0) + 1.5); if (s.x > W * 0.22 && s.x < W * 0.78 && s.y > H * 0.22 && s.y < H * 0.78) out.push([s.x, s.y, Math.hypot(s.x - W / 2, s.y - H / 2), e.id]); }}
      return out.sort((a, b) => a[2] - b[2]).slice(0, {n}); }})()""")


def camera(pg, c):
    pg.evaluate(f"(() => {{ const g = tw.main.grab; g.maxDist = Math.max(g.maxDist || 0, {c['dist']}); g.focus.set({c['x']}, 0, {c['z']}); g.pitch = {c['pitch']}; g.yaw = {c['yaw']}; g.dist = {c['dist']}; g.update(); tw.main.rule = 'free'; tw.main.glide = null; }})()")


SNAP = "(() => { const o = {}; for (const e of Object.values(tw.entities())) if (e.kind === 'object' || e.kind === 'token') o[e.id] = [e.kind, e.x, e.z, e.y || 0]; return o; })()"
def restore(pg, snap):
    """put the map back as it was before the phase: things it added deleted, pawns moved back (so every run measures
    the same map)"""
    pg.evaluate("""(snap) => { const ops = [];
      for (const e of Object.values(tw.entities())) { if (e.kind !== 'object' && e.kind !== 'token') continue; const s = snap[e.id];
        if (!s) ops.push({ type: e.kind === 'token' ? 'token.delete' : 'object.delete', args: { id: e.id } });
        else if (e.kind === 'token' && (Math.abs(e.x - s[1]) > 1e-3 || Math.abs(e.z - s[2]) > 1e-3)) ops.push({ type: 'token.move', args: { id: e.id, x: s[1], z: s[2], y: s[3] } }); }
      if (ops.length) tw.batch(ops); }""", snap)
    wait(pg, 'tw.sync.pendingCount() === 0', 10000, 'restore'); pg.wait_for_timeout(300)


def run_phase(pg, hand, name, st):
    W, H = WIN; cx, cy = W / 2, H / 2
    pg.evaluate(f"__perf.start({json.dumps(name)})")
    if name == 'rest': hand.rest(2.0)
    elif name == 'pan':
        for (a, b) in [((cx - 220, cy), (cx + 220, cy + 40)), ((cx + 200, cy + 60), (cx - 200, cy - 80)), ((cx, cy - 150), (cx + 30, cy + 150))]: hand.path([a, b], 900, 'right'); time.sleep(0.12)
    elif name == 'orbit':
        for (a, b) in [((cx - 200, cy), (cx + 220, cy - 20)), ((cx + 200, cy + 30), (cx - 200, cy - 30))]: hand.path([a, b], 1100, 'middle'); time.sleep(0.12)
    elif name == 'zoom':
        hand.path([(hand.x, hand.y), (cx + 40, cy + 20)], 200); hand.wheel(-100, 8); time.sleep(0.15); hand.wheel(100, 8)
    elif name == 'hover':
        pts = [(p[0], p[1]) for p in st['things'][:8]] or [(cx - 150, cy - 80), (cx + 150, cy + 80)]
        hand.path([(hand.x, hand.y)] + pts + [(cx, cy)], 2600)
    elif name == 'select':
        for p in st['things'][:5]: hand.click(p[0], p[1]); time.sleep(0.3)
        pg.keyboard.press('Escape'); time.sleep(0.2)
    elif name == 'place':
        for (dx, dy) in [(-90, 40), (0, 70), (90, 40)]:
            pg.keyboard.press('/'); time.sleep(0.12); pg.keyboard.type('barrel', delay=35); time.sleep(0.25); pg.keyboard.press('Enter'); time.sleep(0.2)
            hand.path([(hand.x, hand.y), (cx + dx, cy + dy)], 450); pg.mouse.down(); time.sleep(0.06); pg.mouse.up(); time.sleep(0.25)
            pg.keyboard.press('Escape'); time.sleep(0.1)
    elif name == 'drag':
        s = st['pawn']; hand.path([(hand.x, hand.y), (s['x'], s['y'])], 300); time.sleep(0.15)
        hand.path([(s['x'], s['y']), (s['x'] + 120, s['y'] + 30), (s['x'] + 60, s['y'] + 90), (s['x'] - 40, s['y'] + 40)], 1800, 'left'); time.sleep(0.2)
    elif name == 'ring':
        s = st['pawn2']; hand.click(s['x'], s['y']); time.sleep(0.6)
        b = pg.evaluate("(() => { const b = document.querySelector('#ring .rbtn[data-menu]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()")
        if b: hand.click(b['x'], b['y'], 300); time.sleep(0.8)
        pg.keyboard.press('Escape'); time.sleep(0.15); pg.keyboard.press('Escape'); time.sleep(0.3)
    time.sleep(0.1)
    return pg.evaluate('__perf.stop()')


def summarize(r):
    fr = r['frames']; iv = [f[3] for f in fr if f[3] is not None]; work = [f[1] for f in fr]; lat = [f[2] for f in fr if f[2] is not None]; gpu = [x for x in r['gpu'] if 0 < x < 2000]  # (a disjoint read the driver did not flag: nonsense values)
    js = {}
    for f in fr:
        for k, v in (f[4] or {}).items(): js.setdefault(k, []).append(v)
    js = {k: round(statistics.mean(v), 2) for k, v in js.items() if v}
    return {'js': js, 'listeners': r.get('listeners') or [],'phase': r['name'], 'frames': len(fr), 'fps': round(len(fr) * 1000 / r['wall'], 1) if r['wall'] else None,
            'p50': pct(iv, .5), 'p95': pct(iv, .95), 'p99': pct(iv, .99), 'max': max(iv) if iv else None, 'long': sum(1 for x in iv if x > 50),
            'work50': pct(work, .5), 'work95': pct(work, .95), 'lat50': pct(lat, .5), 'lat95': pct(lat, .95),
            'gpu': round(statistics.mean(gpu), 2) if gpu else None, 'gpu95': pct(gpu, .95),
            'calls': r['fx'].get('draw_calls'), 'shadow_draws': r['fx'].get('shadow_list_draws'), 'under': r['counters'].get('underDraws', 0), 'longtasks': len(r['long']), 'longtask_max': max((l[1] for l in r['long']), default=0),
            'shed': r['governor'].get('shed'), 'pr': r['pixelRatio'],
            'lowres': (lambda top: round(100 * sum(1 for f in fr if len(f) > 5 and f[5] < top - 1e-3) / max(1, len(fr))))(max([f[5] for f in fr if len(f) > 5] or [r['pixelRatio']])),  # (% of the phase's frames drawn at fewer pixels than its sharpest: dynres)
            'tried': [l[2] for l in r['governor'].get('log') or [] if len(l) > 2 and l[1] in ('shed', 'start lean')], 'nogain': [l[2] for l in r['governor'].get('log') or [] if len(l) > 2 and l[1] == 'no gain']}

def fmt(v, w=6, d=1):
    if v is None: return ' ' * (w - 1) + '-'
    return f'{v:{w}.{d}f}' if isinstance(v, float) else f'{v:>{w}}'
def table(rows, title):
    print(f'\n{title}')
    print(' phase   | frames  fps |  p50   p95   p99   max long | work50 work95 | lat50 lat95 |  gpu  gpu95 | calls shad under | governor')
    for s in rows:
        print(f" {s['phase']:<7} | {fmt(s['frames'], 5)} {fmt(s['fps'], 5)} |{fmt(s['p50'], 5)} {fmt(s['p95'], 5)} {fmt(s['p99'], 5)} {fmt(s['max'], 5, 0)} {fmt(s['long'], 4)} |"
              f" {fmt(s['work50'], 6)} {fmt(s['work95'], 6)} |{fmt(s['lat50'], 6)} {fmt(s['lat95'], 5)} |{fmt(s['gpu'], 5)} {fmt(s['gpu95'], 6)} |"
              f" {fmt(s['calls'], 5)} {fmt(s['shadow_draws'], 4)} {fmt(s['under'], 5)} | lowres {s['lowres']}% tried {','.join(str(x)[:6] for x in s['tried'])}{' NOGAIN ' + ','.join(x[:6] for x in s['nogain']) if s['nogain'] else ''}")
    print(' main-thread ms a frame (mean), by piece:')
    for s in rows:
        print(f"   {s['phase']:<7} " + '  '.join(f'{k} {v:.1f}' for k, v in sorted(s['js'].items(), key=lambda kv: -kv[1]) if v >= 0.3))
        if s['js'].get('emit', 0) > 5: print('            frame listeners: ' + ' | '.join(f'{v:.1f} ms {k[:50]}' for k, v in s['listeners'][:3]))


PROFILE_ORBIT = """(ms) => new Promise(res => { const g = tw.main.grab, y0 = g.yaw, t0 = performance.now(); const step = () => { const k = (performance.now() - t0) / ms; g.yaw = y0 + Math.sin(k * Math.PI * 2) * 0.6; g.update(); if (k < 1) requestAnimationFrame(step); else { g.yaw = y0; g.update(); res(true); } }; requestAnimationFrame(step); })"""
def profile(pg, secs=3.0):
    """where the GPU frame goes while the camera turns (a scripted orbit, the same every time), pass by pass"""
    if not pg.evaluate('__perf.profile(true)'): return None
    pg.evaluate(PROFILE_ORBIT, 600); pg.evaluate('__perf.profileRead()')
    pg.evaluate(PROFILE_ORBIT, secs * 1000); moving = pg.evaluate('__perf.profileRead()')
    pg.mouse.move(8, WIN[1] - 8); pg.wait_for_timeout(2500); pg.evaluate('__perf.profileRead()'); pg.wait_for_timeout(3000); still = pg.evaluate('__perf.profileRead()')  # (at the idle rate: fewer frames, the same cost each)
    pg.evaluate('__perf.profile(false)')
    return {'moving': moving, 'still': still}


def main():
    budget = dict((k, float(v)) for k, v in (x.split('=') for x in A.budget.split(',') if x)) if A.budget else {}
    names = [m for m in A.maps.split(',') if m]; phases = [x for x in A.phases.split(',') if x]
    configs = [c for c in A.configs.split(',') if c] or ['asis']
    out = {'machine': A.machine, 'when': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'window': WIN, 'preset': A.preset, 'configs': configs, 'rounds': A.rounds, 'maps': {}, 'commit': os.popen(f'git -C {REPO} rev-parse --short HEAD').read().strip()}
    over = []
    with Stack(A.data), sync_playwright() as p:
        st = load_state()
        for n in names:
            if A.rebuild or n not in st: st[n] = build(p, n); json.dump(st, open(STATE(), 'w'), indent=1)
        if A.build_only: return 0
        remote = None
        if A.machine == 'local': browser = p.chromium.launch(headless=True, args=GPU_LOCAL)
        else:
            from remote import Remote
            remote = Remote(A.machine, WIN).__enter__(); browser = p.chromium.connect_over_cdp(remote.endpoint())
        try:
            for n in names:
                ctx = browser.new_context(viewport={'width': WIN[0], 'height': WIN[1]}, device_scale_factor=1)
                pg = ctx.new_page(); tw_sandbox.proxy(pg, A.api); pg.set_default_timeout(180000)
                errors = []; pg.on('pageerror', lambda e: errors.append(str(e)[:200]))
                t0 = time.time(); pg.goto(Stack.page_url() + '#s=' + st[n]['token'])
                if not wait(pg, 'window.tw && tw.ready && tw.ready() && tw.loaded && tw.loaded()', 600000, 'game up'): return 3
                up_s = round(time.time() - t0, 1)
                gl = pg.evaluate("(() => { const gl = tw.gfx.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timer: tw.gfx.hasTimer, dpr: devicePixelRatio }; })()")
                say(f'{n}: {gl["renderer"]} (up in {up_s} s)')
                if any(s in gl['renderer'] for s in ('SwiftShader', 'llvmpipe', 'Software')): say('software GL: these would be false numbers'); return 2
                pg.evaluate("(() => { tw.gfxForce = true; tw.interactForce = true; })()")
                if A.preset == 'auto': pg.evaluate("tw.settings.setGfx('auto')"); tw_auto = None
                elif A.preset != 'asis': pg.evaluate(f"tw.settings.setGfx('{A.preset}')")
                camera(pg, st[n]['camera']); settle(pg, 900000); loaded_s = round(time.time() - t0, 1)
                print(pg.evaluate(PROBE), file=sys.stderr)
                auto = None
                if A.preset == 'auto':  # what Auto makes of this machine (its first measurement waits for a still moment)
                    wait(pg, 'tw.gfx.info().auto.done', 90000, 'Auto'); auto = pg.evaluate('tw.gfx.info()'); say(f"  Auto: {auto['autoPick']} ({auto['auto']})")
                rec = {'renderer': gl, 'up_s': up_s, 'loaded_s': loaded_s, 'counts': st[n]['counts'], 'auto': auto, 'runs': [], 'errors': errors}
                if A.profile:
                    for c in configs:
                        apply_config(pg, c)
                        camera(pg, st[n]['camera']); pg.wait_for_timeout(1500)
                        pr = rec.setdefault('profile', {})[c] = profile(pg)
                        for k in ('moving', 'still'):
                            seg = (pr or {}).get(k) or {}
                            print(f'  GPU by pass, {n} · {c} · {k}: total {sum(v["ms"] for v in seg.values()):.1f} ms = ' + ', '.join(f'{s} {v["ms"]:.1f}' for s, v in sorted(seg.items(), key=lambda kv: -kv[1]['ms']) if v['ms'] >= 0.1))
                for rd in range(A.rounds):
                    for c in (configs if rd % 2 == 0 else configs[::-1]):
                        apply_config(pg, c)
                        camera(pg, st[n]['camera']); hand = Hand(pg); hand.rest(1.5)
                        if A.shots and rd == 0: os.makedirs(A.shots, exist_ok=True); pg.wait_for_timeout(2500); pg.screenshot(path=os.path.join(A.shots, f'{A.machine}-{n}-{c}.png'))
                        snap = pg.evaluate(SNAP)
                        pw = st[n]['pawns']
                        state = {'things': screen_things(pg), 'pawn': pg.evaluate(f"(() => {{ const e = tw.entities()['{pw[0]}']; return tw.screenOf(e.x, e.z, tw.main, 2); }})()"),
                                 'pawn2': pg.evaluate(f"(() => {{ const e = tw.entities()['{pw[1]}']; return tw.screenOf(e.x, e.z, tw.main, 2); }})()")}
                        raw = []
                        for ph in phases:
                            if ph in ('orbit', 'zoom', 'hover', 'select', 'drag', 'ring', 'place'): camera(pg, st[n]['camera']); hand.rest(0.6)  # (each starts from the same view)
                            if ph in ('hover', 'select', 'drag', 'ring', 'place'):
                                state['things'] = screen_things(pg)
                                for k, i in (('pawn', 0), ('pawn2', 1)): state[k] = pg.evaluate(f"(() => {{ const e = tw.entities()['{pw[i]}']; return tw.screenOf(e.x, e.z, tw.main, 2); }})()")
                            prof = cpuprof.start(pg) if ph in A.cpuprofile.split(',') else None
                            raw.append(run_phase(pg, hand, ph, state))
                            if prof:
                                cp = cpuprof.stop(prof); raw[-1]['cpuprofile'] = cp
                                print(f'\n CPU profile of {ph} ({cp["wall_ms"]} ms), total time by function:'); [print(f'   {v:8.1f}  {k}') for k, v in cp['total'][:22]]
                                print(' self time:'); [print(f'   {v:8.1f}  {k}') for k, v in cp['self'][:12]]
                            if ph in ('place', 'drag', 'select', 'ring'): restore(pg, snap)
                        rows = [summarize(r) for r in raw]
                        table(rows, f'== {A.machine} · {n} · {c} · round {rd + 1} · preset {A.preset} · {gl["renderer"][:60]}')
                        rec['runs'].append({'config': c, 'round': rd, 'rows': rows, 'raw': raw})
                        for s in rows:
                            for k, lim in budget.items():
                                v = s.get(k)
                                if v is not None and v > lim: over.append(f'{n}/{c}/{s["phase"]}: {k} {v} > {lim}')
                if A.idle_watch:
                    camera(pg, st[n]['camera']); pg.mouse.move(8, WIN[1] - 8); t1 = pg.evaluate('performance.now()'); time.sleep(A.idle_watch)
                    rec['idle_long'] = pg.evaluate(f'__perf.longAll().filter(l => l[0] >= {t1})'); say(f'  idle {A.idle_watch:.0f} s: long tasks {rec["idle_long"][:10]}')
                rec['errors'] = errors[:20]
                out['maps'][n] = rec
                ctx.close()
        finally:
            try: browser.close()
            except Exception: pass
            if remote: remote.__exit__()
    if A.json:
        os.makedirs(os.path.dirname(os.path.abspath(A.json)), exist_ok=True); json.dump(out, open(A.json, 'w'))
        say(f'wrote {A.json}')
    if over: print('\nOVER BUDGET:\n  ' + '\n  '.join(over)); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
