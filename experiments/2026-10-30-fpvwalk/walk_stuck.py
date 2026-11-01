#!/usr/bin/env python3
"""STUCK RATE in first person (2026-10-30; Harry: "FPV movement, which I notice I get stuck on stuff because I'm trapped on
the grid"). A local stack serving --repo's engine (this repo, or another checkout: origin/main for the "before"), a
generated inn (fixed seed, every door opened), and scripted walks through it the way a person walks: look at where you
are going and hold W. Each route is a few coarse aims (a room's middle, a doorway's middle, a stair's foot and top);
the driver turns the view toward the current aim every 30 ms (plus a little hand wobble, --wobble degrees) and holds W
(a real keydown on the window, the same input for both builds).

  TW_PORTS=a,b python3 experiments/2026-10-30-fpvwalk/walk_stuck.py [--repo DIR] [--seed 101] [--wobble 8] [--snap always|shift]

  reached      the aim is within REACH ft of the eyes
  stuck        the eyes got no nearer the aim (by 0.5 ft) for STUCK_S seconds: one stuck event (the driver keeps holding W)
  failed       the route was not finished in TIMEOUT_S, or was stuck for more than GIVEUP_S in all
Prints per route and one JSON line: routes, failed (the stuck rate), stuck events, median time.
"""
import argparse, json, os, random, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); ME = os.path.dirname(os.path.dirname(HERE))
ap = argparse.ArgumentParser(); ap.add_argument('--repo', default=ME); ap.add_argument('--seed', type=int, default=101); ap.add_argument('--wobble', type=float, default=8)
ap.add_argument('--snap', default='shift'); ap.add_argument('--offset', type=float, default=0); ap.add_argument('--kind', default='inn'); ap.add_argument('--only', type=int, default=0); ap.add_argument('--pick', default=''); ap.add_argument('--routes-in'); ap.add_argument('--routes-out'); ap.add_argument('--shots'); ap.add_argument('--keep', action='store_true')
A = ap.parse_args(); REPO = os.path.abspath(A.repo); ENGINE = os.path.join(REPO, 'engine')
sys.path.insert(0, os.path.join(ME, 'tests')); import tw_sandbox  # noqa: E402
tw_sandbox.pawn_snap(A.snap); tw_sandbox.remove_campaigns()
from playwright.sync_api import sync_playwright
RP, SP = (int(v) for v in os.environ.get('TW_PORTS', '18651,18652').split(','))
REACH, STUCK_S, GIVEUP_S, TIMEOUT_S = 3.0, 1.5, 4.0, 40.0
ARGS = ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding']
procs = []
def say(*a): print(*a, file=sys.stderr, flush=True)
def start():
    data = tempfile.mkdtemp(prefix='tw-walk-'); site = tempfile.mkdtemp(prefix='tw-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': ''}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&api=&nointro&faces=1500'

# THE ROUTES, from the inn itself: every door (room to room: middle, doorway, middle; a door to the outside: two squares out,
# doorway, middle), every stair (the foot's room middle, the foot, the top, a square on), and each room corner to corner
ROUTES = """(B) => { const E = tw.entities(), w = tw.worldOf(tw.area()), HT = tw.HT, out = [];
  const rooms = Object.values(E).filter(e => e.kind === 'room' && e.building === B && !HT.isTerrain?.(e.recipe));
  const cross = (a, b, [x0, z0, x1, z1]) => { const d = (b[0] - a[0]) * (z1 - z0) - (b[1] - a[1]) * (x1 - x0); if (Math.abs(d) < 1e-9) return false;
    const t = ((x0 - a[0]) * (z1 - z0) - (z0 - a[1]) * (x1 - x0)) / d, u = ((x0 - a[0]) * (b[1] - a[1]) - (z0 - a[1]) * (b[0] - a[0])) / d; return t > 1e-6 && t < 1 - 1e-6 && u >= -0.01 && u <= 1.01; };
  const inRoom = (r, x, z) => HT.floorUnder(E, x, z, (r.recipe.y || 0) + 0.5)?.room === r.id;
  const mid = (r) => { const rc = r.recipe, cx = (rc.x + rc.w / 2) * 5, cz = (rc.z + rc.d / 2) * 5; let best = null;
    for (let i = 0; i < rc.w; i++) for (let j = 0; j < rc.d; j++) { const x = (rc.x + i + 0.5) * 5, z = (rc.z + j + 0.5) * 5; if (!inRoom(r, x, z)) continue; const d = Math.hypot(x - cx, z - cz); if (!best || d < best.d) best = { x, z, d }; }
    return best && [best.x, best.z, rc.y || 0]; };
  const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
  for (const e of w.edges.values()) {
    if (e.kind !== 'door' || (e.y || 0) !== 0) continue;
    const sides = (e.sides || []).map(s => byId[s.room]).filter(Boolean); if (!sides.length) continue;
    const dm = e.dir === 'h' ? [e.gx * 5 + 2.5, e.gz * 5] : [e.gx * 5, e.gz * 5 + 2.5], nrm = e.dir === 'h' ? [0, 1] : [1, 0], along = [nrm[1], nrm[0]];
    if (sides.length === 2) { const a = mid(sides[0]), b = mid(sides[1]); if (a && b && !a[2] && !b[2]) { out.push({ name: `door ${e.key}: ${sides[0].recipe.type || sides[0].name} -> ${sides[1].recipe.type || sides[1].name}`, from: a, aims: [[...dm, 0], b], along }); out.push({ name: `door ${e.key}: back`, from: b, aims: [[...dm, 0], a], along }); } }
    else { const r = sides[0], a = mid(r); if (!a || a[2]) continue; const sgn = inRoom(r, dm[0] + nrm[0] * 2.5, dm[1] + nrm[1] * 2.5) ? -1 : 1, o = [dm[0] + sgn * nrm[0] * 12.5, dm[1] + sgn * nrm[1] * 12.5, 0];
      out.push({ name: `front door ${e.key}: in`, from: o, aims: [[...dm, 0], a], along }); out.push({ name: `front door ${e.key}: out`, from: a, aims: [[...dm, 0], o], along }); }
  }
  // a stair, up and down: from two squares off its foot (at the foot's level) up to a square past its top, and back
  // (an end's way on and off: the square beside it on its level that no wall cuts off, the way along the flight first; a stair
  // that ends against a wall is walked onto from the side)
  const wallsAt = (y, a, b) => (tw.fpv.walls((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 + 2, y) || []).some(sg => cross(a, b, sg));
  const floorAt = (x, z, y) => { const b = HT.baseUnder(E, x, z, y + 0.5, (r) => w.isOpenRoom(r)); return Math.abs(b.y - y) < 0.5 && b.on !== 'stair'; };
  const wayOff = (P, pref) => { for (const [dx, dz] of [pref, [pref[1], pref[0]], [-pref[1], -pref[0]]]) { const Q = [P.x + dx * 5, P.z + dz * 5]; if (floorAt(Q[0], Q[1], P.y) && !wallsAt(P.y, [P.x, P.z], Q)) { const R = [Q[0] + dx * 5, Q[1] + dz * 5]; const two = floorAt(R[0], R[1], P.y) && !wallsAt(P.y, Q, R); return { near: [...Q, P.y], far: two ? [...R, P.y] : [...Q, P.y] }; } } return null; };
  for (const s of tw.ST.stairsOf(E)) { const en = tw.ST.stairEnds(s, E), d = tw.ST.stairDir(s); if (!en?.foot || !en?.top) continue;
    const F = en.foot, T = en.top, fo = wayOff(F, [-d[0], -d[1]]), to = wayOff(T, [d[0], d[1]]); if (!fo || !to) continue;
    out.push({ name: `stair ${s.id}: up (${F.y} -> ${T.y})`, from: fo.far, aims: [fo.near, [F.x, F.z, F.y], [T.x, T.z, T.y], to.near], up: T.y, legs: [F.y, F.y, F.y, T.y] });
    out.push({ name: `stair ${s.id}: down (${T.y} -> ${F.y})`, from: to.far, aims: [to.near, [T.x, T.z, T.y], [F.x, F.z, F.y], fo.near], up: F.y, legs: [T.y, T.y, T.y, F.y] }); }
  for (const r of rooms) { if (r.recipe.y) continue; const rc = r.recipe; const cs = [[rc.x + 0.5, rc.z + 0.5], [rc.x + rc.w - 0.5, rc.z + rc.d - 0.5], [rc.x + rc.w - 0.5, rc.z + 0.5], [rc.x + 0.5, rc.z + rc.d - 0.5]].map(([i, j]) => [i * 5, j * 5, 0]).filter(p => inRoom(r, p[0], p[1]));
    if (cs.length >= 2 && Math.hypot(cs[0][0] - cs[1][0], cs[0][1] - cs[1][1]) > 9) out.push({ name: `across ${rc.type || r.name}`, from: cs[0], aims: [cs[1]] }); }
  // a route on the ground floor that would cross a stairwell or a hole is left out (both builds stop there, as they should:
  // the fall is offered; that is not the walking this measures). Sampled every foot, and a body's width either side
  const op = (r) => w.isOpenRoom(r), flat = (x, z) => { const b = HT.baseUnder(E, x, z, 0.5, op), st = HT.pawnStepTo(E, x, z, 0, op, b); return Math.abs(b.y) < 0.5 && b.on !== 'stair' && st.on !== 'stair' && !st.below && Math.abs(st.y) < 0.5; };
  const clear = (rt) => { let p = rt.from; for (const q of rt.aims) { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L), ux = (q[0] - p[0]) / (L || 1), uz = (q[1] - p[1]) / (L || 1);
    for (let i = 0; i <= n; i++) for (const o of [-1.3, 0, 1.3]) { const x = p[0] + ux * i - uz * o, z = p[1] + uz * i + ux * o; if (!flat(x, z)) return false; } p = q; } return true; };
  // and no leg through a wall (the walls a body meets at that leg's level: client/surfaces/fpv.js walls; the doorways are open)
  const lvl = (y) => HT.levelFloor ? HT.levelFloor(y) : y;
  const legsOk = (rt) => { let p = rt.from; for (let i = 0; i < rt.aims.length; i++) { const q = rt.aims[i], y = rt.legs ? rt.legs[i] : 0, segs = tw.fpv.walls((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, Math.hypot(q[0] - p[0], q[1] - p[1]) / 2 + 2, y) || [];
      if (segs.some(sg => cross(p, q, sg))) return false; p = q; } return true; };
  // LOOKING WHERE YOU GO: room middle to room middle straight through a doorway, when the line meets the door's line within
  // 1.5 ft of its opening (so it may clip a jamb: a body has to slide round it); and ALONG A WALL: from a corner of a room to
  // the far corner on the same wall, aiming a foot behind the wall (a body has to slide along it; reached within REACH + 1.5)
  for (const e of w.edges.values()) {
    if (e.kind !== 'door' || (e.y || 0) !== 0) continue;
    const sides = (e.sides || []).map(s => byId[s.room]).filter(Boolean); if (sides.length !== 2) continue;
    const a = mid(sides[0]), b = mid(sides[1]); if (!a || !b || a[2] || b[2]) continue;
    const [lo, hi] = e.dir === 'h' ? [e.gx * 5, e.gx * 5 + 5] : [e.gz * 5, e.gz * 5 + 5], line = e.dir === 'h' ? e.gz * 5 : e.gx * 5;
    const ai = e.dir === 'h' ? 1 : 0, t = (line - a[ai]) / ((b[ai] - a[ai]) || 1e-9); if (t <= 0 || t >= 1) continue;
    const at = a[1 - ai] + (b[1 - ai] - a[1 - ai]) * t; if (at < lo - 1.5 || at > hi + 1.5) continue;
    // (and nothing but this doorway's jambs in the way: the line clear of walls up to 2 ft each side of the door's line)
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = 2 / (L || 1), pa = [a[0] + (b[0] - a[0]) * (t - u), a[1] + (b[1] - a[1]) * (t - u)], pb = [a[0] + (b[0] - a[0]) * (t + u), a[1] + (b[1] - a[1]) * (t + u)];
    if (!legsOk({ from: a, aims: [pa] }) || !legsOk({ from: pb, aims: [b] })) continue;
    out.push({ name: `direct ${e.key}: ${sides[0].recipe.type} -> ${sides[1].recipe.type}`, from: a, aims: [b], direct: true }); out.push({ name: `direct ${e.key}: back`, from: b, aims: [a], direct: true });
  }
  for (const r of rooms) { if (r.recipe.y) continue; const rc = r.recipe; if (rc.w < 3) continue;
    for (const [j, side] of [[0, -1], [rc.d - 1, 1]]) { const z = (rc.z + j + 0.5) * 5, zw = side < 0 ? rc.z * 5 - 1 : (rc.z + rc.d) * 5 + 1, x0 = (rc.x + 0.5) * 5, x1 = (rc.x + rc.w - 0.5) * 5;
      if (![...Array(rc.w).keys()].every(i => inRoom(r, (rc.x + i + 0.5) * 5, z))) continue;
      out.push({ name: `along ${rc.type} ${side < 0 ? 'north' : 'south'} wall`, from: [x0, z, 0], aims: [[x1, zw, 0]], reach: 4.5, direct: true }); } }
  return out.filter(rt => (rt.up != null || clear(rt)) && (rt.direct || legsOk(rt))); }"""

# THE DRIVER, in the page: look toward the aim (with a wobble), W held down; returns what happened
DRIVE = """async ([route, P]) => { const key = (t) => dispatchEvent(new KeyboardEvent(t, { key: 'w', code: 'KeyW', bubbles: true }));
  const eye = () => { const i = tw.fpv.info(); return i && i.eye ? [i.eye[0], i.eye[2], i.eye[1]] : null; };
  const t0 = performance.now(); let k = 0, best = Infinity, bestAt = t0, stuckN = 0, stuckS = 0, inStuck = false, wob = 0, wobAt = 0, trace = [];
  const seed = P.seed; let rnd = seed; const rand = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  key('keydown'); let ok = false, why = '';
  try { while (true) {
    await new Promise(r => setTimeout(r, 30));
    const now = performance.now(), e = eye(); if (!e) { why = 'out of first person'; break; }
    const aim = route.aims[k], d = Math.hypot(aim[0] - e[0], aim[1] - e[1]);
    if (d < (route.reach || P.reach) && (aim[2] == null || Math.abs((e[2] - tw.fpv.info().eyeOff) - aim[2]) < 2.5 || k < route.aims.length - 1)) { k++; best = Infinity; bestAt = now; inStuck = false; if (k >= route.aims.length) { ok = true; break; } continue; }
    if (d < best - 0.5) { best = d; bestAt = now; inStuck = false; }
    else if (now - bestAt > P.stuck * 1000) { if (!inStuck) { stuckN++; inStuck = true; } stuckS += 0.03; }
    if (stuckS > P.giveup) { why = `stuck (aim ${k} of ${route.aims.length}, ${d.toFixed(1)} ft off)`; break; }
    if (now - t0 > P.timeout * 1000) { why = 'timeout'; break; }
    if (now - wobAt > 400) { wobAt = now; wob = (rand() * 2 - 1) * P.wobble; }
    tw.fpv.setLook(Math.atan2(aim[0] - e[0], aim[1] - e[1]) * 180 / Math.PI + wob, -4);
    if (trace.length < 400 && (trace.length === 0 || now - trace[trace.length - 1][0] > 200)) trace.push([Math.round(now - t0), +e[0].toFixed(1), +e[1].toFixed(1)]);
  } } finally { key('keyup'); }
  return { ok, why, secs: +((performance.now() - t0) / 1000).toFixed(2), stuckN, stuckS: +stuckS.toFixed(2), k, trace }; }"""

def main():
    url = start()
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=ARGS)
        pg = b.new_page(viewport={'width': 1400, 'height': 900}); pg.on('pageerror', lambda e: say('pageerror', e)); pg.goto(url, timeout=180000)
        pg.fill('#newCampaign input[name=gm]', 'Harry'); pg.fill('#newCampaign input[name=name]', f"TEST fpv walk {time.strftime('%H:%M:%S')} (throwaway)"); pg.click('#newCampaign button')
        pg.wait_for_function('window.tw && tw.ready && tw.ready() && tw.fpv', timeout=240000)
        pg.evaluate("(() => { const g = tw.main.grab; g.focus.set(40, 0, 40); g.dist = 120; g.update(); })()")
        B = pg.evaluate(f"tw.buildAt(tw.buildingNode('{A.kind}'), 12, 10, {{ seed: {A.seed} }})")
        pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=120000)
        pg.wait_for_function("tw.spawningNow().anims === 0 && !tw.spawningNow().last?.loading && tw.sync.pendingCount() === 0", timeout=600000)
        if not isinstance(B, str): B = pg.evaluate("Object.values(tw.entities()).find(e => e.kind === 'building')?.id")
        pg.evaluate("tw.condButtons?.hide?.('stair-offer')")
        # every ground-floor door open (both builds pass an open door; the question is the walking, not the doors)
        n = pg.evaluate("""(() => { let n = 0; for (const e of [...tw.worldOf(tw.area()).edges.values()]) if (e.kind === 'door' && !e.open) { const it = tw.wallItem?.('wall:' + e.key); if (it) { tw.toggleOpen(it); n++; } } return n; })()""")
        pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=60000); time.sleep(1.5)
        stats = pg.evaluate("(() => { const E = Object.values(tw.entities()); return { rooms: E.filter(e => e.kind === 'room').length, things: E.filter(e => e.kind === 'object').length, stairs: tw.ST.stairsOf(tw.entities()).length }; })()")
        pg.evaluate("tw.dispatch('token.create', { id: 'tok_walker001', name: 'Mira', x: 2.5, z: 2.5, rot: 0, fig: 'hero-fighter-elf-f' })"); pg.wait_for_function("tw.sync.pendingCount() === 0")
        if A.routes_in: routes = json.load(open(A.routes_in))
        else:
            pg.evaluate("tw.fpv.enter('tok_walker001')"); time.sleep(0.5)
            if not pg.evaluate("!!tw.fpv.walls"): sys.exit('this build has no tw.fpv.walls: make the routes with the new build (--routes-out) and give them here (--routes-in)')
            routes = pg.evaluate(ROUTES, B)
        if A.routes_out: json.dump(routes, open(A.routes_out, 'w'), indent=1)
        if A.only: routes = routes[:A.only]
        if A.pick: routes = [routes[int(i)] for i in A.pick.split(',')]
        say('repo', REPO, 'doors opened', n, stats, 'routes', len(routes))
        res = []
        for i, rt in enumerate(routes):
            pg.evaluate("tw.fpv.exit()")
            f = rt['from']
            pg.evaluate(f"tw.dispatch('token.move', {{ id: 'tok_walker001', x: {f[0]}, z: {f[1]}, y: {f[2]} }})"); pg.wait_for_function("tw.sync.pendingCount() === 0")
            pg.evaluate("tw.fpv.enter('tok_walker001')"); time.sleep(0.8)
            if A.offset and rt.get('along'):  # a person aims NEAR a doorway's middle, not at it: alternately either side of it
                o = A.offset * (1 if i % 2 == 0 else -1); a0 = rt['aims'][0]; rt = {**rt, 'aims': [[a0[0] + rt['along'][0] * o, a0[1] + rt['along'][1] * o, a0[2]], *rt['aims'][1:]]}
            r = pg.evaluate(DRIVE, [rt, {'reach': REACH, 'stuck': STUCK_S, 'giveup': GIVEUP_S, 'timeout': TIMEOUT_S, 'wobble': A.wobble, 'seed': 1000 + i}])
            time.sleep(0.6); pg.wait_for_function("tw.sync.pendingCount() === 0", timeout=30000)
            tok = pg.evaluate("(() => { const e = tw.entities().tok_walker001; return [e.x, e.z, e.y || 0]; })()")
            r.update(name=rt['name'], tok=tok); res.append(r)
            say(f"  {'ok  ' if r['ok'] else 'FAIL'} {rt['name']}: {r['secs']} s, stuck {r['stuckN']}x {r['stuckS']} s {r['why']} pawn {tok}")
            if not r['ok'] and A.shots: say('     route', json.dumps(rt), '\n     trace', json.dumps(r['trace'][-12:]), '\n     fall', pg.evaluate("JSON.stringify(tw.falls?.offered || null)"), '\n     info', pg.evaluate("JSON.stringify((({ halt, held, walking, contact, blocked }) => ({ halt, held, walking, contact, blocked }))(tw.fpv.info() || {}))"))
            if A.shots and not r['ok']: os.makedirs(A.shots, exist_ok=True); pg.screenshot(path=os.path.join(A.shots, f'stuck-{i:02d}.png'))
        pg.evaluate("tw.fpv.exit()")
        failed = [r for r in res if not r['ok']]
        out = {'script': 'walk_stuck', 'repo': REPO, 'head': subprocess.run(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip(), 'seed': A.seed, 'kind': A.kind, 'snap': A.snap, 'wobble': A.wobble, 'offset': A.offset, **stats,
               'routes': len(res), 'failed': len(failed), 'stuck_rate': round(len(failed) / max(1, len(res)), 3), 'stuck_events': sum(r['stuckN'] for r in res), 'routes_with_stuck': sum(1 for r in res if r['stuckN']),
               'median_s_ok': round(statistics.median([r['secs'] for r in res if r['ok']] or [0]), 2), 'failures': [(r['name'], r['why']) for r in failed]}
        print(json.dumps(out), flush=True)
        b.close()
try: main()
finally:
    for pr in procs: pr.terminate()
