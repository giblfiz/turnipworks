#!/usr/bin/env python3
"""CAPTURE: a building's spawn-in, frame-exact, on a virtual clock (tools/promo, 2026-10-22).

  python3 tools/promo/capture.py --shot inn-fit [--measure | --probe]

A shot is a named entry in shots.json: what drops (a generated building, one room, or rooms stacked by hand), where,
the camera, the speed, a push-in. The script:
  1. starts a local relay and static server on its own ports (as the browser tests' --local start_local does), the
     house look read from the live ratings server through tests/tw_sandbox.py (reads only; any write is sandboxed);
  2. opens the game in headless Chromium at 1920x1080 (GPU: TW_GPU=1, Vulkan ANGLE, as the matrix runs it), every bit
     of DOM chrome hidden (only the 3D canvas #c is drawn);
  3. WARMS: drops the same thing (same seed, same pieces) far off, in the same page, looks at it until every mesh has
     loaded and every piece has rested and a few more frames have drawn (shaders compiled), then looks away;
  4. freezes the page's clock (vclock.js), drops the real one at the shot's footprint, holds the clock (steps of 0: no
     timer can fire, the 20 s give-up race in play() included) while it gets ready, checks it was ready at once (warm
     cache), then steps 1000/60 ms x speed per frame and screenshots each: frames/f_00000.png ... Frame 0 is the
     instant the first piece starts (nothing visible yet);
  5. writes capture.json: per frame the virtual ms since the start (at this speed and at 1x), pieces animating / in
     flight by tier (ground storey, upper storeys, cellar), stand-ins drawn; and the events: ground storey landed,
     upper storey starts, last piece above ground lands. Ends when everything above ground has rested (a cellar that
     plays after is ignored: it is under the ground).
  FAILS if any frame draws a grey stand-in, or the drop was not ready the moment it was made.
--measure: the same at 1x with no screenshots (fast), for the speed fits ({"fit": ...} in shots.json).
--probe: one still of the finished drop from the shot camera (probe.png + probe.json), for choosing camera and seed;
  with an orbit, the framing (screen box of the building and the mat at the orbit's start, middle and end, and whether it
  fits the square crop) is in probe.json and printed.
THE WELCOME MAT (M-series, 2026-10-22): a shot with "mat" gets a building-wide printed rug in front of its door side:
  its face is mat.html rendered to a texture (the card's set: mark, name, the four phrases), on a thin box just above
  the ground in the scene (a rig object; the game knows nothing of it), lit by the house lights, taking the building's
  contact shadow. "mat.spin": it spins in like a prop (the house's own floor motion, T.anim.pose) instead of lying there from
  frame 0. A shot with "orbit" moves the camera's yaw (and optionally pitch, dist) on the output clock from "from" to
  "to", easing in from a slow drift and out to a dead stop at "end" (s, or an event of a 1x measure, like a speed fit).
  The log carries, per frame, the mat's near edge angle on screen (mat_deg; 0 = square to the frame).
"""
import argparse, asyncio, base64, json, math, os, subprocess, sys, tempfile, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
# v4 (2026-10-23): TW_PROMO_GAME_REPO = a checkout whose engine and tuner the takes film (default: this one). The feed-shape
# takes film the engine the approved 16:9 takes were made from (bea26e7e) while the rig runs from the checkout it lives in
REPO = os.environ.get('TW_PROMO_GAME_REPO') or os.path.dirname(os.path.dirname(HERE)); ENGINE = os.path.join(REPO, 'engine')
MAIN_CHECKOUT = '<repo>'
sys.path.insert(0, os.path.join(REPO, 'tests')); import tw_sandbox  # noqa: E402  (every ratings write a browser of this script makes is sandboxed)
tw_sandbox.remove_campaigns()  # the capture's campaign is a throwaway on a local relay
from playwright.async_api import async_playwright  # noqa: E402
import cards  # noqa: E402  (the mat's face is staged and checked as the card's is)

RATINGS = os.environ.get('TW_PROMO_RATINGS', 'http://127.0.0.1:8096')  # the live ratings server: the house look, read only
RP, SP = int(os.environ.get('TW_PROMO_RELAY_PORT', 18431)), int(os.environ.get('TW_PROMO_SITE_PORT', 18432))
W, H = 1920, 1080
FPS = 60
# ignored, not in git: a worktree runs with the main checkout's copies linked in (docs/TEST_DEBT.md)
# (v3, 2026-10-22: the ring's painted pictures, ui-icons/charcoal and parchment, are ignored too; unlinked, every ring in a
# worktree take showed its buttons blank: Harry's "not getting our big beautiful charcoal icon sets")
IGNORED = ['tools/spawn-tuner/assets/' + d for d in ('d', 'delivery.json', 'emblems', 'figures', 'flat', 'lod', 'm', 'tex', 'wallkit')] + ['tools/spawn-tuner/assets/ui-icons/' + d for d in ('charcoal', 'parchment')] + ['engine/client/data/icons', 'engine/client/data/roof', 'engine/client/data/cursors', 'engine/node_modules']
HIDE_CSS = """#twl, #tw-dev, #app > :not(#c), #gfxNote { display: none !important; visibility: hidden !important; }
html, body { overflow: hidden !important; cursor: none !important; } #c { cursor: none !important; }"""

def link_assets():
    if os.path.realpath(REPO) == os.path.realpath(MAIN_CHECKOUT): return
    for rel in IGNORED:
        dst, src = os.path.join(REPO, rel), os.path.join(MAIN_CHECKOUT, rel)
        if not os.path.lexists(dst) and os.path.exists(src): os.symlink(src, dst); print(f'  linked {rel} from the main checkout')

procs = []
def start_local():
    for port in (RP, SP):
        try: urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=0.5); sys.exit(f'port {port} is busy (a stale capture? TW_PROMO_RELAY_PORT / TW_PROMO_SITE_PORT)')
        except urllib.error.HTTPError: sys.exit(f'port {port} is busy (a stale capture?)')
        except Exception: pass
    data = tempfile.mkdtemp(prefix='tw-promo-'); site = tempfile.mkdtemp(prefix='tw-promo-site-')
    os.symlink(ENGINE, os.path.join(site, 'engine')); os.symlink(os.path.join(REPO, 'tools', 'spawn-tuner'), os.path.join(site, 'tuner'))
    log = open(os.path.join(data, 'relay.log'), 'a')
    procs.append(subprocess.Popen(['node', os.path.join(ENGINE, 'relay/server.js')], env={**os.environ, 'PORT': str(RP), 'DATA_DIR': data, 'ORIENT_API': '', 'TUNER_DIR': os.path.join(REPO, 'tools', 'spawn-tuner', 'js'), 'TUNER_DATA': os.path.join(REPO, 'tools', 'spawn-tuner', 'data')}, stdout=log, stderr=subprocess.STDOUT))
    procs.append(subprocess.Popen([sys.executable, '-m', 'http.server', str(SP), '--bind', '127.0.0.1'], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for _ in range(100):
        time.sleep(0.1)
        try: urllib.request.urlopen(f'http://127.0.0.1:{RP}/health', timeout=1); urllib.request.urlopen(f'http://127.0.0.1:{SP}/engine/client/index.html', timeout=1); break
        except Exception: pass
    return f'http://127.0.0.1:{SP}/engine/client/index.html?relay=' + urllib.parse.quote(f'http://127.0.0.1:{RP}') + '&nointro'

# THE DROP. kind 'building': the whole-building generator (makeBuilding, as the Build tray does on the ground).
# kind 'room': one room (spawnRoom). kind 'stack': rooms of one new building at given heights in ONE batch (as a building
# arrives), so the storey-by-storey drop plays them: [{ room, y, inset, seed }] (inset: cells in from the footprint).
# dx shifts the footprint (the warm-up copy, far off).
DROP = """(s) => { const r = { ...s.rect, x: s.rect.x + (s.dx || 0) };
  if (s.kind === 'building') return tw.makeBuilding({ code: s.code, x: r.x, z: r.z, w: r.w, d: r.d, seed: s.seed, storeys: s.storeys, front: s.front || 'S', ...(s.outbuildings === false && { outbuildings: false }) }, { name: s.label });
  if (s.kind === 'room') return tw.spawnRoom(s.room, r.x, r.z, r.w, r.d, s.seed);
  const v = tw.sync.view(tw.area()), ents = { ...v.entities }, b = 'bld_' + Math.random().toString(36).slice(2, 12), ops = [];
  s.stack.forEach((q, i) => { const id = 'room_' + Math.random().toString(36).slice(2, 12), k = q.inset || 0, a = { id, building: b, type: q.room, x: r.x + k, z: r.z + k, w: r.w - 2 * k, d: r.d - 2 * k, seed: q.seed, ...(q.y && { y: q.y }) };
    const L = tw.roomgen.solve(ents, a, v.order + 1 + i);
    ops.push({ type: 'room.spawn', args: { ...a, ...(i === 0 && { buildingName: s.label }), engine: 'v2', engineVersion: tw.roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } });
    ents[id] = { id, kind: 'room', order: v.order + 1 + i, building: b, recipe: { type: q.room, x: a.x, z: a.z, w: a.w, d: a.d, ...(q.y && { y: q.y }), seed: q.seed } }; });
  tw.madeBuilding = { id: b, at: performance.now() }; // (as makeBuilding does: this seat made it, so it gets the storey tour)
  tw.batch(ops); return b; }"""
# one frame's numbers: pieces animating by tier (g ground storey, u upper storeys, c cellar; by the rest height of the
# piece), visible, in flight (moving now), waiting; and stand-ins drawn (a grey box where a mesh should be)
STATS = """() => { const w = tw.worldOf(tw.area()), now = performance.now(), T = { g: [0, 0, 0, 0], u: [0, 0, 0, 0], c: [0, 0, 0, 0] };
  for (const a of w.anims.values()) { const y = a.rest?.y || 0, k = y < -0.5 ? 'c' : y >= 8 ? 'u' : 'g', t = T[k]; t[0]++;
    if (!Number.isFinite(a.t0) || now < a.t0) { t[3]++; continue; } t[1]++; if (now < a.t0 + a.m.dur) t[2]++; }
  let stand = 0; const drawn = (g) => { for (let o = g; o; o = o.parent) { if (!o.visible) return false; if (o.isScene) return true; } return false; };
  for (const r of w.recs.values()) if (r.visual?.userData?.placeholder && !r.asleep && drawn(r.group)) stand++;
  for (const s of w.shell.values()) if (s.visual?.userData?.placeholder && !s.asleep && drawn(s.group)) stand++;
  const e = w.lastEpisode; return { t: now, anims: w.anims.size, T, stand, cut: tw.cut?.y ?? null, level: tw.level ?? 0, tour: tw.storeyTour ? { n: tw.storeyTour.log.length, end: tw.storeyTour.end, spin: tw.storeyTour.spin ?? null, fly: !!w.cutFly?.busy?.() } : null, stages: (w.stages || []).length, loading: !!e?.loading, pending: tw.sync.pendingCount() }; }"""
FIRST = """() => { const w = tw.worldOf(tw.area()); let t0 = Infinity;
  for (const a of w.anims.values()) if (Number.isFinite(a.t0)) t0 = Math.min(t0, a.t0);
  return { t0: Number.isFinite(t0) ? t0 : null, n: w.anims.size, now: performance.now(), loading: !!w.lastEpisode?.loading }; }"""
SETCAM = """(c) => { const g = tw.main.grab; g.focus.set(c.x, c.y || 0, c.z); g.pitch = c.pitch; g.yaw = c.yaw; g.dist = c.dist; g.update(); tw.main.rule = 'free';
  return c.frame && tw.__promoSolve ? tw.__promoSolve(c.frame) : null; }"""
# FRAMING BY FRACTION (camera.frame, 2026-10-22): the camera's dist and focus are solved, per frame, so the scene's
# extent on screen (the building rect up to wall height, plus the mat's corners) is frame.frac of the frame's width, its
# middle in the middle of the frame; then shifted (never zoomed) so the mat's type (mark, name, phrases) stays inside
# frame.margin of every edge, if it can; and never zoomed in so far that the type is wider than the frame less
# frame.textMargin a side (the zoom is capped instead: capped). frac 1 = edge to edge; above 1 the scene spills off both sides. Same meaning at
# any pitch, yaw or aspect. Returns what it chose.
FRAME_INSTALL = """(q) => { const V = tw.main.grab.focus.constructor, P = [];
  for (const [x, z] of q.rect) for (const y of [0, q.top]) P.push(new V(x, y, z));
  for (const [x, z] of q.mat) P.push(new V(x, 0.1, z));
  const box = (pts) => { const cam = tw.main.camera, W = innerWidth, H = innerHeight; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { const v = p.clone().project(cam), x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, x1, y0, y1 }; };
  const textPts = () => { const M = tw.__promoMat; if (!M || !q.text) return []; M.mesh.updateMatrixWorld(); return q.text.map(([x, z]) => M.mesh.localToWorld(new V(x, M.m.h / 2, z))); };
  tw.__promoBoxes = () => { const T = textPts(); return { scene: box(P), text: T.length ? box(T) : null }; };
  tw.__promoSolve = (f) => { const g = tw.main.grab, cam = tw.main.camera, W = innerWidth, H = innerHeight, m = (f.margin ?? 0.04) * Math.min(W, H);
    const fy = g.focus.y, ground = (px, py) => { const d = new V((px / W) * 2 - 1, 1 - (py / H) * 2, 0.5).unproject(cam).sub(cam.position); const t = (fy - cam.position.y) / d.y; return cam.position.clone().addScaledVector(d, t); };
    let clamped = false;
    for (let it = 0; it < 10; it++) {
      let lo = 2, hi = 3000; const T0 = textPts(), mt = (f.textMargin ?? 0.02) * Math.min(W, H); // the extent's width falls as the camera backs off: bisect dist (log scale);
      // never so close that the type is wider than the frame less textMargin a side (then the zoom is capped: capped true)
      for (let k = 0; k < 36; k++) { g.dist = Math.sqrt(lo * hi); g.update(); const b = box(P), t = T0.length && box(T0); if (b.x1 - b.x0 > f.frac * W || (t && t.x1 - t.x0 > W - 2 * mt)) lo = g.dist; else hi = g.dist; }
      g.dist = Math.sqrt(lo * hi); g.update();
      const b = box(P), T = textPts(); let cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; clamped = false;
      if (T.length) { const t = box(T); // the view moves by (cx - W/2, cy - H/2): keep the type inside the margins after it
        const fit = (lo0, hi0, c, half) => { let s = c - half; if (hi0 - lo0 > 2 * half - 2 * m) return (lo0 + hi0) / 2; if (lo0 - s < m) s = lo0 - m; if (hi0 - s > 2 * half - m) s = hi0 - 2 * half + m; return s + half; };
        const nx = fit(t.x0, t.x1, cx, W / 2), ny = fit(t.y0, t.y1, cy, H / 2); clamped = Math.abs(nx - cx) > 0.5 || Math.abs(ny - cy) > 0.5; cx = nx; cy = ny; }
      // (f.cx / f.cy: where on the frame the extent's middle goes, as fractions; default the middle. A shot with a tray
      // open down one side puts its subject's middle right of centre, so the tray covers none of it)
      const ox = ((f.cx ?? 0.5) - 0.5) * W, oy = ((f.cy ?? 0.5) - 0.5) * H;
      if (Math.abs(cx - ox - W / 2) < 0.3 && Math.abs(cy - oy - H / 2) < 0.3) break;
      const to = ground(cx - ox, cy - oy); g.focus.set(to.x, fy, to.z); g.update(); }
    const b = box(P), T = textPts(), t = T.length ? box(T) : null;
    return { dist: +g.dist.toFixed(3), focus: [+g.focus.x.toFixed(3), +g.focus.z.toFixed(3)], frac: +((b.x1 - b.x0) / W).toFixed(4), clamped, capped: (b.x1 - b.x0) / W < f.frac - 0.002,
      text: t && { x: [Math.round(t.x0), Math.round(t.x1)], y: [Math.round(t.y0), Math.round(t.y1)], inside: t.x0 >= 0 && t.x1 <= W && t.y0 >= 0 && t.y1 <= H } }; };
  return P.length; }"""
PROBE_INFO = """(() => { const E = tw.entities(), rs = Object.values(E).filter(e => e.kind === 'room'), w = tw.worldOf(tw.area()), pieces = [];
  for (const s of w.shell.values()) if (s.spec.x < 400) pieces.push(['shell', s.spec.layer, s.spec.sku || s.spec.key || null, +s.spec.x.toFixed(1), +(s.spec.y || 0).toFixed(1), +s.spec.z.toFixed(1)]);
  for (const r of w.recs.values()) if (r.entity.kind === 'object' && r.entity.x < 400) pieces.push(['thing', r.entity.cat, r.entity.sku || null, +r.entity.x.toFixed(1), +(r.entity.y || 0).toFixed(1), +r.entity.z.toFixed(1)]);
  return { rooms: rs.map(r => [r.recipe.type, r.recipe.x, r.recipe.z, r.recipe.w, r.recipe.d, r.recipe.y || 0]), cut: tw.cut?.y ?? null, roofs: !!tw.roofs, storeys: w.lastStoreys, pieces }; })()"""
# THE MAT: a thin box (3 in, a thick doormat, so its edge and the contact shadow show); its top is the printed face,
# the texture's top toward the building, the print a touch darker than the card (tint) so it sits in the scene's light
# as dyed cloth rather than glowing; the sides are the rug's dark binding (mat.html's outer band). Standard materials: the house lights fall on it as
# on the ground (outdoors there is no sun shadow in the house look; the contact shadow, N8AO, does draw)
MAT_ADD = """async (m) => { const THREE = await import('three'); const w = tw.worldOf(tw.area());
  const tex = await new THREE.TextureLoader().loadAsync(m.url); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  const face = new THREE.MeshStandardMaterial({ map: tex, color: m.tint || '#d0d0d0', roughness: 1, metalness: 0 }), edge = new THREE.MeshStandardMaterial({ color: '#3a3229', roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(m.w, m.h, m.d), [edge, edge, face, edge, edge, edge]);
  mesh.name = 'promo-welcome-mat'; mesh.userData.promo = true; mesh.receiveShadow = true; mesh.castShadow = false;
  const rest = { x: m.x, y: m.y + m.h / 2, z: m.z, rot: m.rot }; mesh.position.set(rest.x, rest.y, rest.z); mesh.rotation.y = rest.rot;
  w.scene.add(mesh); tw.__promoMat = { mesh, rest, m, hidden: !!m.spin };
  if (m.spin) { mesh.visible = false; tw.__promoMat.pose = (await import(new URL('../../tuner/js/anim.js', location.href).href)).pose; }
  return { tex: [tex.image.width, tex.image.height] }; }"""
# the house's motion for a floor piece of this drop (the mat spins in as the floor does)
MAT_MOTION = """() => { const w = tw.worldOf(tw.area()); for (const s of w.shell.values()) { const a = s.spec.layer === 'floor' && w.anims.get(s.group); if (a) return a.m; } for (const a of w.anims.values()) return a.m; return null; }"""
MAT_POSE = """(q) => { const M = tw.__promoMat; if (!M?.pose) return null; const g = M.mesh, r = M.rest;
  if (q.p <= 0) { g.visible = false; return 'hidden'; } g.visible = true;
  const ps = M.pose(q.m, Math.min(1, q.p)); g.position.set(r.x, r.y + ps.dy, r.z); g.rotation.set(0, r.rot + ps.ang, 0);
  g.scale.set(Math.max(1e-4, ps.sx), Math.max(1e-4, ps.sy), Math.max(1e-4, ps.sz)); return ps; }"""
# the mat's near edge (the one toward the camera at the orbit's end) on screen: its angle to the frame's horizontal
MAT_EDGE = """() => { const M = tw.__promoMat; if (!M) return null; const g = M.mesh; g.updateMatrixWorld(); const cam = tw.main.camera, m = M.m;
  const P = (x, z) => { const v = g.localToWorld(new g.position.constructor(x, m.h / 2, z)).project(cam); return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2]; };
  const a = P(-m.w / 2, m.d / 2), b = P(m.w / 2, m.d / 2), c = P(-m.w / 2, -m.d / 2), d = P(m.w / 2, -m.d / 2);
  const deg = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
  return { near: +deg(a, b).toFixed(3), far: +deg(c, d).toFixed(3), corners: [a, b, d, c].map(p => p.map(v => Math.round(v))) }; }"""
# where the building (its rect up to wall height) and the mat land on screen from the camera now
FRAMING = """(q) => { const cam = tw.main.camera, V = tw.main.grab.focus.constructor, pts = [];
  for (const [x, z] of q.rect) for (const y of [0, q.top]) pts.push(new V(x, y, z));
  for (const [x, z] of q.mat) pts.push(new V(x, 0.1, z));
  const s = pts.map(p => p.clone().project(cam)).map(v => [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2]);
  const xs = s.map(p => p[0]), ys = s.map(p => p[1]); return { x: [Math.min(...xs), Math.max(...xs)].map(Math.round), y: [Math.min(...ys), Math.max(...ys)].map(Math.round) }; }"""
QUIET = "(() => { const w = tw.worldOf(tw.area()); return w.anims.size === 0 && !(w.stages || []).length && !w.lastEpisode?.loading && tw.sync.pendingCount() === 0 && (!tw.storeyTour || !!tw.storeyTour.end); })()"

def camera_at(cam, u, t=None, orbit=None):
    """the camera at u (0..1 over the output clock): a push-in narrows dist from cam.dist to cam.dist * cam.push.
    With an orbit (resolved: end in output s), the yaw goes from..to over 0..end on the output clock t, eased (orbit_ease),
    and so do pitch ([a, b]) and the push, which then follows the orbit instead of the whole clock.
    With camera.frame (a fraction, or {frac, margin}) dist and focus are solved in the page (FRAME_INSTALL); a push then
    ramps the fraction instead, ending at frame.frac: frac x (push + (1 - push) x progress) (push 0.82: starts 18% wider)."""
    fr = cam.get('frame'); fr = fr if isinstance(fr, dict) or fr is None else {'frac': fr}
    if not orbit:
        push = cam.get('push', 1)
        return {**cam, 'dist': cam['dist'] * (1 + (push - 1) * u), **({'frame': {**fr, 'frac': fr['frac'] * (push + (1 - push) * u)}} if fr else {})}
    e = orbit_ease(min(1.0, max(0.0, t / orbit['end'])), orbit.get('s0', 0.5))
    p = orbit.get('pitch') or [cam['pitch'], cam['pitch']]; push = orbit.get('push', 1)
    return {**cam, 'yaw': orbit['from'] + (orbit['to'] - orbit['from']) * e, 'pitch': p[0] + (p[1] - p[0]) * e, 'dist': cam['dist'] * (1 + (push - 1) * e),
            **({'frame': {**fr, 'frac': fr['frac'] * (push + (1 - push) * e)}} if fr else {})}

def orbit_ease(u, s0):
    """0..1 -> 0..1: a cubic leaving 0 at s0 x the mean speed (moving from the first frame, then speeding up) and
    arriving at 1 with speed 0 (the settle): h(0)=0, h'(0)=s0, h(1)=1, h'(1)=0"""
    return s0 * (u ** 3 - 2 * u ** 2 + u) + 3 * u ** 2 - 2 * u ** 3

def resolve_orbit(S, shots, speed):
    """the orbit with its end in output seconds (an event of a 1x measure at this speed, plus "plus")"""
    o = S.get('orbit')
    if not o: return None
    end = o['end']
    if isinstance(end, dict):
        m = json.load(open(os.path.join(capture_dir(shots, end['from']), 'measure.json')))
        at = m['events'][end['event']]
        if at is None: sys.exit(f"{end['from']}: no {end['event']} event in its measure")
        end = at / speed / 1000 + end.get('plus', 0)
    return {**o, 'end': end}

def mat_spec(S):
    """the mat in feet: a box w x h x d centred at x, z, face turned (rot) to read from outside the door side"""
    m, r, C = S['mat'], S['rect'], 5
    x0, z0, w, d = r['x'] * C, r['z'] * C, r['w'] * C, r['d'] * C
    side, gap, depth = m.get('side', 'S'), m.get('gap', 2.5), m['depth']
    wide = m.get('width') or (w if side in 'NS' else d)
    pos = {'S': (x0 + w / 2, z0 + d + gap + depth / 2, 0), 'N': (x0 + w / 2, z0 - gap - depth / 2, math.pi),
           'E': (x0 + w + gap + depth / 2, z0 + d / 2, math.pi / 2), 'W': (x0 - gap - depth / 2, z0 + d / 2, -math.pi / 2)}[side]
    return {'x': pos[0], 'z': pos[1], 'rot': pos[2], 'w': wide, 'd': depth, 'h': m.get('thick', 0.25), 'y': m.get('y', -0.012), 'tint': m.get('tint')}

def root_dir(shots):
    r = shots['_root']
    try: os.makedirs(r, exist_ok=True); return r if os.access(r, os.W_OK) else None
    except OSError: return None

def events(log, speed):
    """the drop's moments, in ms of the 1x spawn-in from frame 0: the ground storey all landed, the first upper piece
    visible, the last piece above ground landed (log entries carry ms of the page's clock = 1x ms)"""
    up = lambda e: e['T']['g'][0] + e['T']['u'][0]
    ev = {}
    ev['ground_land'] = next((e['ms'] for e in log if e['T']['g'][0] == 0 and e['ms'] > 0), None)
    ev['upper_start'] = next((e['ms'] for e in log if e['T']['u'][1] > 0), None)
    ev['last_land'] = next((e['ms'] for e in log if up(e) == 0 and e['ms'] > 0), None)
    us = ev['upper_start']
    ev['upper_land'] = next((e['ms'] for e in log if us is not None and e['ms'] > us and e['T']['u'][0] == 0), None)  # the top floor's last piece rests
    ev['step_start'] = next((e['ms'] for e in log if e.get('tour') and e['tour']['n'] >= 2), None)  # the view starts down a storey (storey tour)
    ev['step_land'] = next((e['ms'] for e in log if e.get('tour') and e['tour']['end'] == 'ground'), None)  # ... and is on the ground storey
    ev['tour_end'] = next((e['tour']['end'] for e in reversed(log) if e.get('tour')), None)
    ev['upper_pieces'] = max((e['T']['u'][0] for e in log), default=0)
    return ev

def resolve_speed(S, shots, A):
    sp = S.get('speed', 1)
    if not isinstance(sp, dict): return float(sp), None
    m = json.load(open(os.path.join(capture_dir(shots, sp['from']), 'measure.json')))
    at = m['events'][sp['fit']]
    if at is None: sys.exit(f"{sp['from']}: no {sp['fit']} event in its measure (one storey?)")
    k = at / (sp['at'] * 1000)
    if 'round' in sp: k = round(k, sp['round'])
    return max(k, sp.get('min', 0)), {'fit': sp['fit'], 'event_ms_1x': at, 'lands_at_s': sp['at'], 'from': sp['from']}

def capture_dir(shots, name):
    r = root_dir(shots) or tempfile.gettempdir()
    return os.path.join(r, 'captures', name)

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--shot', required=True); ap.add_argument('--out')
    ap.add_argument('--measure', action='store_true'); ap.add_argument('--probe', action='store_true'); ap.add_argument('--headed', action='store_true')
    A = ap.parse_args()
    shots = json.load(open(os.path.join(HERE, 'shots.json'))); S = shots[A.shot]
    while 'like' in S: S = {**shots[S['like']], **{k: v for k, v in S.items() if k != 'like'}}  # (a like of a like)
    out = A.out or capture_dir(shots, A.shot)
    frames_dir = os.path.join(out, 'frames'); os.makedirs(frames_dir, exist_ok=True)
    speed, fit = (1.0, None) if (A.measure or A.probe) else resolve_speed(S, shots, A)
    save = not (A.measure or A.probe)
    orbit = None if A.measure else resolve_orbit(S, shots, speed)
    mat = mat_spec(S) if 'mat' in S else None
    if save:
        for f in os.listdir(frames_dir):
            if f.endswith('.png'): os.remove(os.path.join(frames_dir, f))
    n_frames = int(round(S.get('seconds', 6.0) * FPS)) + 1
    link_assets()
    page_url = start_local()
    print(f'capture {A.shot}{" (measure)" if A.measure else " (probe)" if A.probe else ""}: {S["label"]} x{speed:.4f}{f" (fit {fit})" if fit else ""}{f" orbit {orbit}" if orbit else ""} -> {out}', flush=True)
    gpu = os.environ.get('TW_GPU', '1') == '1'
    GL = ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] if gpu else ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    errors = []; fails = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not A.headed, args=['--no-sandbox', *GL, '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--hide-scrollbars'])
        if mat:  # the mat's face, rendered from HTML as the cards are (the texture: px wide, the mat's aspect)
            px = S['mat'].get('px', 4096); mh = round(px * mat['d'] / mat['w'])
            mctx = await browser.new_context(viewport={'width': px, 'height': mh}, device_scale_factor=1); mp = await mctx.new_page()
            await mp.goto(f"file://{cards.stage()}/mat.html?lines={S['mat'].get('lines', 2)}"); await mp.wait_for_load_state('load')
            if not await mp.evaluate(cards.FONT_OK): sys.exit('the mat did not get Inter')
            over = await mp.evaluate(cards.MAT_FITS)
            if over: sys.exit(f'the mat\'s type does not fit its border at {px}x{mh}: {over}')
            tb = await mp.evaluate("(() => { const r = [...document.querySelectorAll('.top, .phrases')].map(e => e.getBoundingClientRect()); return [Math.min(...r.map(b => b.left)) / innerWidth, Math.min(...r.map(b => b.top)) / innerHeight, Math.max(...r.map(b => b.right)) / innerWidth, Math.max(...r.map(b => b.bottom)) / innerHeight]; })()")
            png = await mp.screenshot(); open(os.path.join(out, 'mat.png'), 'wb').write(png); await mctx.close()
            mat['url'] = 'data:image/png;base64,' + base64.b64encode(png).decode(); mat['spin'] = bool(S['mat'].get('spin'))
            mat['text'] = [[(fx - 0.5) * mat['w'], (fz - 0.5) * mat['d']] for fx in (tb[0], tb[2]) for fz in (tb[1], tb[3])]  # the type's box, mat-local ft (texture top = -z)
            print(f"  mat {mat['w']:.1f} x {mat['d']:.1f} ft at ({mat['x']:.1f}, {mat['z']:.1f}), face {px}x{mh} px{' (spins in)' if mat['spin'] else ''}", flush=True)
        VW, VH = S.get('size', [W, H])  # (a square shot: [1080, 1080], framed for the square rather than cropped from 16:9)
        ctx = await browser.new_context(viewport={'width': VW, 'height': VH}, device_scale_factor=1)
        await ctx.add_init_script(f'globalThis.__PROMO_SEED = {int(S.get("clockSeed", 20261022))};')
        await ctx.add_init_script(path=os.path.join(HERE, 'vclock.js'))
        pg = await ctx.new_page()
        await tw_sandbox.aproxy(pg, RATINGS)
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('console', lambda m: errors.append(f'console: {m.text[:200]}') if m.type == 'error' and 'status of 404' not in m.text else None)
        inflight = set()
        pg.on('request', lambda r: inflight.add(r)); pg.on('requestfinished', lambda r: inflight.discard(r)); pg.on('requestfailed', lambda r: inflight.discard(r))
        await pg.goto(page_url)
        await pg.fill('#newCampaign input[name=name]', f'TEST promo {A.shot} {time.strftime("%m-%d %H:%M:%S")} (throwaway)'); await pg.fill('#newCampaign input[name=gm]', 'Fauna-promo'); await pg.click('#newCampaign button')
        await pg.wait_for_function('window.tw && tw.ready && tw.ready()', timeout=60000)
        await pg.add_style_tag(content=HIDE_CSS)
        house = await pg.evaluate("(() => { const w = tw.worldOf(tw.area()); return { speed: w.preset?.speed || 1, roomgen: tw.roomgen.version, cut: tw.cut?.y ?? null, roofs: !!tw.roofs }; })()")
        print('  game up:', house, flush=True)
        if mat: print('  mat in the scene:', await pg.evaluate(MAT_ADD, mat), flush=True)
        r, C = S['rect'], 5; rect = [[r['x'] * C, r['z'] * C], [(r['x'] + r['w']) * C, r['z'] * C], [(r['x'] + r['w']) * C, (r['z'] + r['d']) * C], [r['x'] * C, (r['z'] + r['d']) * C]]
        mq = [[mat['x'] + sx * (mat['w'] if mat['rot'] in (0, math.pi) else mat['d']) / 2, mat['z'] + sz * (mat['d'] if mat['rot'] in (0, math.pi) else mat['w']) / 2] for sx in (-1, 1) for sz in (-1, 1)] if mat else []
        await pg.evaluate(FRAME_INSTALL, {'rect': rect, 'top': S.get('wallTop', 11), 'mat': mq, 'text': mat and mat['text']})
        spec = {k: S[k] for k in ('kind', 'code', 'room', 'seed', 'storeys', 'front', 'label', 'outbuildings', 'stack', 'rect') if k in S}
        cam = S['camera']
        fr0 = cam.get('frame'); path = None
        if fr0 is not None and isinstance(fr0, dict) and fr0.get('hold') == 'end':
            # HOLD: frame the END of the move, then make the move with that focus and distance, as a camera on a fixed rig
            # would (a push ramps the distance into it). The type can be off the frame for much of the move (M4-z3: until 3.55 s)
            end_cam = camera_at(cam, 1.0, orbit['end'] if orbit else None, orbit)
            solved_end = await pg.evaluate(SETCAM, end_cam); push = (orbit or {}).get('push', cam.get('push', 1))
            cam = {**{k: v for k, v in cam.items() if k != 'frame'}, 'x': solved_end['focus'][0], 'z': solved_end['focus'][1], 'dist': solved_end['dist'] / push}
            print(f'  framed at the end of the move (hold): {solved_end}', flush=True)
        elif fr0 is not None and save:
            # ALONG THE MOVE (the default): solve every frame's pose first (the solve depends on the pose only, not on the
            # pieces), then smooth the path (Gaussian, sigma frame.smooth frames, default 12: where the type's clamp hands
            # over from one corner to another the raw path turns in a frame), and fly the smoothed path
            raw = [await pg.evaluate(SETCAM, camera_at(cam, k / max(1, n_frames - 1), k / FPS, orbit)) for k in range(n_frames)]
            sig = (fr0.get('smooth', 12) if isinstance(fr0, dict) else 12); R = int(3 * sig)
            ker = [math.exp(-0.5 * (d / sig) ** 2) for d in range(-R, R + 1)] if sig > 0 else [1.0]; R = len(ker) // 2
            sm = lambda seq: [sum(ker[d + R] * seq[min(n_frames - 1, max(0, k + d))] for d in range(-R, R + 1)) / sum(ker) for k in range(n_frames)]
            D, X, Z = sm([r['dist'] for r in raw]), sm([r['focus'][0] for r in raw]), sm([r['focus'][1] for r in raw])
            path = [{'dist': D[k], 'x': X[k], 'z': Z[k]} for k in range(n_frames)]
            print(f"  framed along the move: dist {raw[0]['dist']:.1f} -> {raw[-1]['dist']:.1f} ft, type clamped on {sum(r['clamped'] for r in raw)} / zoom capped on {sum(r['capped'] for r in raw)} of {n_frames} frames", flush=True)
        # 3. WARM-UP: the same drop 600 ft east, watched until it is all in, at rest, and drawn
        await pg.evaluate(SETCAM, {**{k: v for k, v in cam.items() if k != 'frame'}, 'x': cam['x'] + 600})
        await pg.evaluate(DROP, {**spec, 'dx': 120})
        await pg.wait_for_timeout(800)
        await pg.wait_for_function(QUIET, timeout=240000)
        t_idle = time.time()
        while time.time() - t_idle < 60 and inflight: await pg.wait_for_timeout(200)
        await pg.wait_for_timeout(1500)
        await pg.evaluate("tw.clearSelection?.()")
        await pg.evaluate(SETCAM, {**{k: v for k, v in camera_at(cam, 0, 0, orbit).items() if k != 'frame'}, **path[0]} if path else camera_at(cam, 0, 0, orbit))
        await pg.wait_for_timeout(300)
        warm_tour = await pg.evaluate("tw.storeyTour ? { end: tw.storeyTour.end, log: tw.storeyTour.log } : null")
        await pg.evaluate("tw.cutOff?.('api')")  # the warm-up's tour left the view cut at its ground storey: all levels again, as a new seat sees
        await pg.wait_for_timeout(2500)  # the warm copy leaves the scene (600 ft off: SLEEP_MARGIN); the ground is drawn
        # 4. the clock stops; the real drop; the clock is held (steps of 0) until its first piece has a start time
        await pg.evaluate("__promo.freeze()")
        for _ in range(3): await pg.evaluate(f"__promo.step({1000 / FPS})")
        await pg.evaluate("__promo.reseed()")  # the same random numbers from here in every take of this drop (measure and capture agree)
        bid = await pg.evaluate(DROP, spec)
        t_load = time.time(); start = None; holds = 0
        while time.time() - t_load < 120:
            await pg.evaluate("__promo.step(0)"); holds += 1
            st = await pg.evaluate(FIRST)
            if st['t0'] is not None: start = st; break
            await pg.wait_for_timeout(20)
        if not start: sys.exit('the spawn-in never started (2 minutes of real time with the clock held)')
        ready_s = round(time.time() - t_load, 2)
        if ready_s > 3: fails.append(f'the drop took {ready_s} s of real time to be ready: the warm-up did not cache everything')
        T = start['t0']; lead = T - start['now']; dt = 1000 / FPS * speed
        print(f'  ready after {ready_s} s real, {holds} held frames; {start["n"]} pieces; first piece {lead:.0f} ms after the drop', flush=True)
        if A.probe:
            await pg.evaluate("__promo.thaw()")
            await pg.wait_for_timeout(1000); await pg.wait_for_function(QUIET, timeout=240000); await pg.wait_for_timeout(1500)
            if mat and mat['spin']: await pg.evaluate("tw.__promoMat.mesh.visible = true")
            await pg.screenshot(path=os.path.join(out, 'probe.png'))
            info = await pg.evaluate(PROBE_INFO)
            if orbit:  # the framing along the orbit: building rect up to wall height, the mat's corners; the square crop is x 420..1500
                info['framing'] = {}
                for k, t in (('start', 0), ('mid', orbit['end'] / 2), ('end', orbit['end'])):
                    solved = await pg.evaluate(SETCAM, camera_at(cam, 0, t, orbit)); await pg.wait_for_timeout(400)
                    fr = await pg.evaluate(FRAMING, {'rect': rect, 'top': S.get('wallTop', 11), 'mat': mq}); fr['square_fits'] = fr['x'][0] >= 420 and fr['x'][1] <= 1500 and fr['y'][0] >= 0 and fr['y'][1] <= 1080
                    fr['frac'] = round((fr['x'][1] - fr['x'][0]) / VW, 3); fr['solved'] = solved
                    fr['mat_edge'] = await pg.evaluate(MAT_EDGE) if mat else None
                    info['framing'][k] = fr; print(f'  framing {k} (t {t:.2f} s): x {fr["x"]} y {fr["y"]} frac {fr["frac"]} square fits {fr["square_fits"]}; solved {solved}; mat edge {fr["mat_edge"] and (fr["mat_edge"]["near"], fr["mat_edge"]["far"])}', flush=True)
                    if k != 'start': await pg.screenshot(path=os.path.join(out, f'probe-{k}.png'))
            json.dump(info, open(os.path.join(out, 'probe.json'), 'w'), indent=1); print('  probe:', os.path.join(out, 'probe.png'), json.dumps(info)[:600]); return
        # 5. one step, one frame, one screenshot
        log = []; t_cap = time.time(); rest_at = None; i = 0
        tour_mine = await pg.evaluate("(b) => !!tw.storeyTour && tw.storeyTour.building === b", bid)
        mat_m = await pg.evaluate(MAT_MOTION) if mat and mat['spin'] else None
        if mat_m: mat_m = {**mat_m, 'spinAxis': 'y', 'dur': mat_m['dur'] * S['mat']['spin'].get('slow', 1)}; print(f'  the mat spins in with the floor\'s motion: {mat_m}', flush=True)
        print(f'  storey tour for this drop: {tour_mine}', flush=True)
        while True:
            pose = camera_at(cam, i / max(1, n_frames - 1), i / FPS, orbit) if save and i < n_frames else None
            if pose and path: pose = {**{k: v for k, v in pose.items() if k != 'frame'}, **path[i]}
            solved = await pg.evaluate(SETCAM, pose) if pose else None
            if path: solved = {'dist': round(path[i]['dist'], 3), 'focus': [round(path[i]['x'], 3), round(path[i]['z'], 3)]}
            if mat_m: await pg.evaluate(MAT_POSE, {'m': mat_m, 'p': (i * dt - S['mat']['spin']['at'] * 1000 * speed) / mat_m['dur']})  # (the mat's own spin-in, at "at" s of output)
            await pg.evaluate(f"__promo.step({max(0, lead) if i == 0 else dt})")
            st = await pg.evaluate(STATS); st['i'] = i; st['ms'] = round(st['t'] - T, 3)  # ms of the page's clock since the first piece started = ms of the 1x spawn-in
            if mat: me = await pg.evaluate(MAT_EDGE); st['mat_deg'] = me and me['near']
            if solved: st['cam'] = solved
            if mat and save and i < n_frames: tb = (await pg.evaluate("tw.__promoBoxes()"))['text']; st['text_in'] = tb['x0'] >= 0 and tb['x1'] <= VW and tb['y0'] >= 0 and tb['y1'] <= VH
            log.append(st)
            if st['stand']: fails.append(f'frame {i}: {st["stand"]} grey stand-in(s) drawn')
            if save and i < n_frames: await pg.screenshot(path=os.path.join(frames_dir, f'f_{i:05d}.png'), type='png')
            above = st['T']['g'][0] + st['T']['u'][0]
            moved = i > 0 and (st['cut'], st['level']) != (log[-2]['cut'], log[-2]['level'])  # the view's level changed (a building's storeys shown in turn)
            touring = bool(tour_mine and st['tour'] and not st['tour']['end'])  # the storey tour of this drop is still walking the view down
            if i > 0 and above == 0 and not moved and not touring and rest_at is None: rest_at = i
            if above or moved or touring: rest_at = None
            if rest_at is not None and i - rest_at >= 30 and (not save or i >= n_frames - 1): break
            if i > 60 * 120: fails.append('never came to rest in 120 s of clock'); break
            if i % 60 == 0: print(f'  frame {i}: {st["ms"]:.0f} ms, ground {st["T"]["g"]}, upper {st["T"]["u"]}, cellar {st["T"]["c"]} ({time.time() - t_cap:.0f} s)', flush=True)
            i += 1
        # the log's ms are of the virtual clock, which ran speed x as fast as 1x: ms at 1x = ms (the anims ran at the
        # page's own pace on that clock); output seconds = ms / speed / 1000
        for e in log: e['out_s'] = round(e['ms'] / speed / 1000, 5)
        ev = events(log, speed)
        lastStoreys = await pg.evaluate("tw.worldOf(tw.area()).lastStoreys")
        # FRAME PACING: every step advanced the page clock by exactly 1000/60 x speed, and the game's own schedule for the
        # last episode (lastEpisode: started at .at, plays .total ms) ends on the frame the log says the last piece rested
        steps = [round(b['t'] - a['t'], 6) for a, b in zip(log[1:], log[2:])]
        ep = await pg.evaluate("(() => { const e = tw.worldOf(tw.area()).lastEpisode; return e && { at: e.at, total: e.total, n: e.n, loadMs: e.loadMs ?? null }; })()")
        pacing = {'step_ms_expected': round(dt, 6), 'step_ms_min': min(steps) if steps else None, 'step_ms_max': max(steps) if steps else None,
                  'last_episode': ep, 'episode_end_ms': round(ep['at'] + ep['total'] - T, 3) if ep else None}
        if steps and (abs(min(steps) - dt) > 1e-3 or abs(max(steps) - dt) > 1e-3): fails.append(f'frame pacing: steps {min(steps)}..{max(steps)} ms, want {dt}')
        print(f"  pacing: steps {pacing['step_ms_min']}..{pacing['step_ms_max']} ms (want {dt:.4f}); last episode ends at {pacing['episode_end_ms']} ms of the 1x clock, log says last piece rested at {ev['last_land']}", flush=True)
        if mat:  # the mat squares up: the first frame from which its near edge stays within 0.5 deg of the frame's horizontal
            sq = None
            for e in log[:n_frames if save else len(log)]:
                if e.get('mat_deg') is not None and abs(e['mat_deg']) <= 0.5: sq = e['i'] if sq is None else sq
                else: sq = None
            ev['mat_square_out_s'] = None if sq is None else round(sq / FPS, 3)
            cut = [e['i'] for e in log if e.get('text_in') is False]  # frames where any of the mat's type is off the frame
            ev['text_cut_frames'] = len(cut); ev['text_in_from_out_s'] = round((max(cut) + 1) / FPS, 3) if cut else 0.0
        res = {'shot': A.shot, 'label': S['label'], 'spec': spec, 'camera': cam, 'orbit': orbit, 'mat': {k: v for k, v in (mat or {}).items() if k != 'url'} or None, 'speed': speed, 'fit': fit, 'fps': FPS, 'size': [VW, VH], 'frames': (n_frames if save else 0),
               'start_virtual_ms': T, 'ready_real_s': ready_s, 'events': ev, 'events_out_s': {k: (round(v / speed / 1000, 3) if isinstance(v, (int, float)) and k not in ('upper_pieces', 'mat_square_out_s', 'text_cut_frames', 'text_in_from_out_s') else v) for k, v in ev.items()},
               'pieces': start['n'], 'building': bid, 'house': house, 'storeys_log': lastStoreys, 'warm_tour': warm_tour, 'tour': await pg.evaluate("tw.storeyTour ? { building: tw.storeyTour.building, end: tw.storeyTour.end, spin: tw.storeyTour.spin ?? null, log: tw.storeyTour.log, levels: tw.storeyTour.levels } : null"), 'pacing': pacing, 'fails': fails[:50], 'n_fails': len(fails), 'errors': errors[:40], 'wall_s': round(time.time() - t_cap, 1), 'log': log}
        dst = os.path.join(out, 'measure.json' if A.measure else 'capture.json'); json.dump(res, open(dst + '.tmp', 'w')); os.replace(dst + '.tmp', dst)  # (atomic: another take may be reading it for its fit)
        print(f'  done: events (1x ms) {ev}; at x{speed:.3f} -> output s {res["events_out_s"]}; {len(fails)} fails; {len(errors)} console errors; {res["wall_s"]} s', flush=True)
        for f in fails[:5]: print('  FAIL', f)
        await browser.close()
        if fails: sys.exit(1)

if __name__ == '__main__':
    try: asyncio.run(main())
    finally:
        for pr in procs: pr.terminate()
