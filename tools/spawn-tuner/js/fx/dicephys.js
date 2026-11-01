// DICE PHYSICS (2026-10-19, Harry's review): the ROLLER'S client throws the dice ONCE in a real physics engine (Rapier,
// WASM, vendored in js/vendor and loaded on the first roll), records the tumble, and the recording goes out with the
// roll. Every other client only plays the recording back, so every seat sees the same throw whatever its camera, its
// browser or its own copy of the world. No three.js here: node runs the same code in the tests.
//
// THE NUMBER NEVER COMES FROM HERE. The committed roll line carries the result (the roller or the relay chose it, as
// before). At playback dicegeo.remap turns the die's NUMBERING by a symmetry of the die so that the face which landed
// on top reads that result: the collider never changes, the mesh is symmetric, nothing visibly jumps.
//
//   const R = await loadRapier(url)
//   throwDice(R, { dice: ['d6', …], P, from: {x, y, z, r (the thrower's radius: dice start clear of it)}, to: {x, z}, world, visible(x, z) -> bool, seed, until }) -> {
//     rec,                      the recording to send (see encode below: ~30 Hz quantised keyframes)
//     tries, reasons: {why: n}, fallback: bool, settleAt (s)
//     hands, setDown            (a big pool, BIG POOLS below: how many rounds kept dice; how many were set down flat)
//   }
//   world: { surfaces: [{ x0, z0, x1, z1, y }], boxes: [{ x, y, z, hx, hy, hz, yaw }], cylinders: [{ x, z, y0, y1, r }], dice: [{ type, p, q }] }
//       floors and level surfaces as slabs, wall segments and props as boxes, pawns as cylinders. Every one of them is
//       FIXED: dice never move a prop or a pawn. The caller leaves out anything hidden from players.
//   decode(rec) -> { hz, n, dice, frames, pose(t, i) -> { p, q }, final: [{ p, q }], duration }
//
// NEVER COCKED, NEVER UNNATURAL: a throw is simulated (milliseconds) and REJECTED, then thrown again a little
// differently (up to P.tries times), if any die ends cocked (top face more than P.cocked degrees from level), rests on
// another die, ends where the roller cannot see, goes further than P.reach feet, or takes longer than P.settle s to
// come to rest. Last resort: a short flat drop onto the target point.
//
// SCALE: a die P.size feet across must move like a real P.realMM-millimetre die on a tabletop. Gravity is scaled by
// the ratio (a 2-ft die standing for a 16-mm one: about 38 g), so every motion takes the time it takes a real die;
// speeds are in die lengths a second. P.timeScale then slows or quickens the playback.
import { dieGeo, flatness } from './dicegeo.js';

let rapierP = null;
export function loadRapier(url) {
  if (!rapierP) rapierP = import(url).then(async (m) => { const R = m.default || m; await R.init(); return R; });
  return rapierP;
}

export const PHYS_DEFAULTS = {
  size: 2, realMM: 16, timeScale: 1, strength: 9.5, angle: 19.3, scatter: 0.35, height: null, spin: 22, bounce: 0.3, tableBounce: 0.8, friction: 0.6, damping: 0.4, angDamping: 1.6,
  round: 0.16, tries: 20, cocked: 3, reach: 12, settle: 3, hz: 30, calm: 0,
};
const G_REAL = 9.81 / 0.3048; // ft/s^2
const STEP = 1 / 240;
const GENTLE = [0.6, 0.5, 0.45]; // the gentler throws' restitution caps, one step each (two tries a step)
// ADAPTIVE KEYFRAMES (2026-10-20; Harry: "the dice can sometimes clip thru the edges of walls"): 30 Hz frames cut the
// corner of every bounce (up to 1.4 ft off the true path at his preset). Every physics step is recorded, then only the
// keyframes playback needs are kept: between two kept frames, lerp / slerp stays within KEY_POS ft and KEY_ROT degrees
// of every step it skips (dense round impacts, sparse in flight and at rest).
export const KEY_POS = 0.015, KEY_ROT = 2, KEY_MAX = 120, REC_BUDGET = 100000;

export function rng(seed) { // small integer PRNG (mulberry32): the perturbations between tries
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const gravityOf = (P) => G_REAL * P.size / (P.realMM / 304.8);
// the die's collider: its polyhedron pulled in by the rounding radius, rounded back out (a Minkowski sum with a ball:
// flat faces, evenly rounded edges and corners). Every die here is face-transitive, so all faces are inR from the middle.
export function colliderPoints(type, P) {
  const g = dieGeo(type), s = P.size, r = P.round * g.inR, k = (g.inR - r) / g.inR, out = new Float32Array(g.verts.length * 3);
  g.verts.forEach((v, i) => { out[i * 3] = v[0] * k * s; out[i * 3 + 1] = v[1] * k * s; out[i * 3 + 2] = v[2] * k * s; });
  return { points: out, radius: r * s };
}

function buildWorld(R, world, P) {
  const W = new R.World({ x: 0, y: -gravityOf(P), z: 0 });
  W.integrationParameters.dt = STEP;
  W.integrationParameters.lengthUnit = P.size; // (its tolerances are in die lengths, not metres)
  // contacts are made 0.2 die lengths ahead (Rapier's default 0.02): a die landing from a 14-ft hand moves ~0.4 ft a
  // step and sank up to 0.35 ft into the floor before the contact caught it (measured 2026-10-20; 0.012 ft with this)
  W.integrationParameters.normalizedPredictionDistance = 0.2;
  W.propOf = new Map(); // collider handle -> the prop / pawn id it stands for (what the dice touched: r.touched)
  const fixed = (desc, x, y, z, yaw = 0, id = null) => {
    const b = W.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }));
    const c = W.createCollider(desc.setFriction(P.friction).setRestitution(Math.min(0.98, P.bounce * P.tableBounce)), b); // (Rapier averages the two)
    if (id) W.propOf.set(c.handle, id);
  };
  for (const s of world.surfaces || []) fixed(R.ColliderDesc.cuboid(Math.max(0.05, (s.x1 - s.x0) / 2), 0.5, Math.max(0.05, (s.z1 - s.z0) / 2)), (s.x0 + s.x1) / 2, s.y - 0.5, (s.z0 + s.z1) / 2);
  for (const b of world.boxes || []) fixed(R.ColliderDesc.cuboid(Math.max(0.02, b.hx), Math.max(0.02, b.hy), Math.max(0.02, b.hz)), b.x, b.y, b.z, b.yaw || 0, b.id || null);
  for (const c of world.cylinders || []) fixed(R.ColliderDesc.cylinder(Math.max(0.05, (c.y1 - c.y0) / 2), Math.max(0.05, c.r)), c.x, (c.y0 + c.y1) / 2, c.z, 0, c.id || null);
  for (const d of world.dice || []) { // dice already lying on the table: their own rounded shapes, fixed
    const c = colliderPoints(d.type, { ...P, size: d.size || P.size });
    const b = W.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(d.p[0], d.p[1], d.p[2]).setRotation({ x: d.q[0], y: d.q[1], z: d.q[2], w: d.q[3] }));
    W.createCollider(R.ColliderDesc.roundConvexHull(c.points, c.radius).setFriction(P.friction).setRestitution(P.bounce), b);
  }
  return W;
}
const qRotate = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w - iw * x - iy * z + iz * y, iy * w - iw * y - iz * x + ix * z, iz * w - iw * z - ix * y + iy * x]; };
const qFromAxisAngle = (ax, a) => { const s = Math.sin(a / 2); return { x: ax[0] * s, y: ax[1] * s, z: ax[2] * s, w: Math.cos(a / 2) }; };
function randQuat(u) { let q; do { q = [u() * 2 - 1, u() * 2 - 1, u() * 2 - 1, u() * 2 - 1]; } while (q.reduce((a, x) => a + x * x, 0) > 1 || q.reduce((a, x) => a + x * x, 0) < 0.05); const l = Math.hypot(...q); return { x: q[0] / l, y: q[1] / l, z: q[2] / l, w: q[3] / l }; }

// one throw; null = it came to rest badly (with why)
// (a big pool, thrown hand by hand: `slot` = { n: the whole pool, at: each die's place in it } lays the dice out as the
// whole pool's one handful; `movers` = the dice kept from the rounds before, following their recorded paths, kinematic;
// `release` = the physics step this round's dice leave the hand (they wait there, unseen, until then))
// (`keep`: a big pool's try, judged die by die: r.bad = each die that came to rest badly and why; an escaped die is
// taken out and the others go on)
let lastTry = 0; // (ms, the last try: whether the next one fits before `until`)
function attempt(R, o) { const t = performance.now(), r = attempt1(R, o); lastTry = performance.now() - t; return r; }
function attempt1(R, { dice, P, from, to, world, visible, rest = null, u, drop, power = 1, slot = null, movers = null, keep = false, release = 0 }) {
  const W = buildWorld(R, world, P), s = P.size, N = dice.length, LN = slot ? slot.n : N;
  if (P.height != null && from.floor != null) from = { ...from, y: from.floor + P.height }; // the dial: how high the hand lets go
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d, sx = -fz, sz = fx;
  const init = dice.map((type, i) => {
    // a handful, not a line: at most three across, the rest behind and above
    // (a big pool: a wider handful, up to six across, so it is not ten rows deep)
    const gi = slot ? slot.at[i] : i, cols = slot && LN > 9 ? Math.min(6, Math.ceil(Math.sqrt(LN))) : Math.min(LN, 3), col = gi % cols, row = Math.floor(gi / cols), off = (col - (cols - 1) / 2) * 1.15 * s;
    let p, q, v, w;
    if (drop) { // the last resort: flat, on the nearest open floor the roller can see, no spin
      const spot = drop[i];
      p = { x: spot.x, y: spot.y + dieGeo(type).inR * s + 0.04 * s, z: spot.z };
      q = flatDown(type, u() * Math.PI * 2); v = { x: 0, y: 0, z: 0 }; w = { x: 0, y: 0, z: 0 };
    } else {
      const out = (from.r || 0) + dieGeo(type).radius * s * 1.25; // out in front of the thrower, clear of it
      const back = -row * 1.15 * s, up = row * 0.35 * s; // (later rows ahead of the first: never behind, where the thrower stands)
      p = { x: from.x + fx * (out - back) + sx * off + (u() - 0.5) * 0.2 * s, y: from.y + up + (0.9 + u() * 0.5) * s, z: from.z + fz * (out - back) + sz * off + (u() - 0.5) * 0.2 * s };
      q = randQuat(u);
      // speed: the strength dial, scaled to how far the target is (6 ft = as set), and backed off after overshoots
      const crowd = LN > 3 ? Math.sqrt(3 / LN) : 1; // a big handful is thrown more gently (they knock each other on)
      const sp = P.strength * s * power * crowd * Math.max(0.55, Math.min(1.4, d / 6)) * (0.8 + u() * 0.4), side = (u() - 0.5) * P.scatter;
      const a = P.angle * Math.PI / 180, h = Math.cos(a) * sp; // the speed is the full speed, along the throw angle
      v = { x: (fx + sx * side) * h, y: Math.sin(a) * sp, z: (fz + sz * side) * h };
      const ax = [u() * 2 - 1, u() * 2 - 1, u() * 2 - 1], l = Math.hypot(...ax) || 1, ws = P.spin * (0.7 + u() * 0.6);
      w = { x: ax[0] / l * ws, y: ax[1] / l * ws, z: ax[2] / l * ws };
    }
    return { type, p, q, v, w };
  });
  const make = ({ type, p, q, v, w }) => {
    const b = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(q).setLinvel(v.x, v.y, v.z).setAngvel(w)
      .setCcdEnabled(true).setLinearDamping(P.damping).setAngularDamping(P.angDamping).setCanSleep(false));
    const c = colliderPoints(type, P);
    W.createCollider(R.ColliderDesc.roundConvexHull(c.points, c.radius).setDensity(1).setFriction(P.friction).setRestitution(P.bounce).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), b);
    return b;
  };
  let bodies = release > 0 ? [] : init.map(make);
  // the dice kept before: they move as recorded (they push this round's dice; this round never moves them). This round
  // leaves the hand later (`release`), when they are out of it: a kept die cannot give way, so a touch in the hand
  // would bat a new one off.
  const mvOf = new Map();
  const MV = movers ? movers.dice.map((type) => { const c = colliderPoints(type, P), b = W.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    mvOf.set(W.createCollider(R.ColliderDesc.roundConvexHull(c.points, c.radius).setFriction(P.friction).setRestitution(P.bounce), b).handle, true); return b; }) : [];
  const mvLen = movers ? movers.frames.length : 0;
  const moveTo = (k, next) => { const F = movers.frames[Math.min(k, mvLen - 1)]; MV.forEach((b, j) => { const o = j * 7, t = { x: F[o], y: F[o + 1], z: F[o + 2] }, r = { x: F[o + 3], y: F[o + 4], z: F[o + 5], w: F[o + 6] };
    if (next) { b.setNextKinematicTranslation(t); b.setNextKinematicRotation(r); } else { b.setTranslation(t, true); b.setRotation(r, true); } }); };
  if (MV.length) moveTo(0, false);
  const every = 1, max = release + Math.ceil(P.settle / STEP) + 1, frames = []; // every physics step (240 Hz); encode() keeps only the keyframes playback needs
  const rec = () => { const f = new Float64Array(N * 7);
    if (bodies.length) bodies.forEach((b, i) => { const t = b.translation(), r = b.rotation(); f.set([t.x, t.y, t.z, r.x, r.y, r.z, r.w], i * 7); });
    else init.forEach((d, i) => f.set([d.p.x, d.p.y, d.p.z, d.q.x, d.q.y, d.q.z, d.q.w], i * 7)); // (waiting in the hand)
    frames.push(f); };
  rec();
  let still = 0, step = 0, why = null, nudges = 0;
  const events = new R.EventQueue(true), touched = new Set(), landed = new Array(N).fill(null), dieOf = new Map(), bad = new Map();
  const enter = () => bodies.forEach((b, i) => dieOf.set(b.collider(0).handle, i)); enter();
  const vEps = 0.25 * s, wEps = 0.6, need = Math.round(0.12 / STEP);
  for (; step < max; step++) {
    if (MV.length) moveTo(step + 1, true);
    if (step < release) { W.step(events); events.drainCollisionEvents(() => {}); rec(); if (step + 1 === release) { bodies = init.map(make); enter(); } continue; }
    W.step(events);
    events.drainCollisionEvents((h1, h2, started) => { if (!started) return; const id = W.propOf.get(h1) || W.propOf.get(h2); if (id) touched.add(id);
      for (const h of [h1, h2]) { const i = dieOf.get(h); if (i != null && landed[i] == null) landed[i] = step; } });
    // CALM DOWN AFTER LANDING (P.calm): from a die's first touch, its drag and rolling damping climb over a second, so the
    // first bounces stay lively and the handful still comes to rest within reach
    if (P.calm > 0 && step % 6 === 0) bodies.forEach((b, i) => { if (landed[i] == null) return; const k = Math.min(1, (step - landed[i]) * STEP); b.setLinearDamping(P.damping + P.calm * k); b.setAngularDamping(P.angDamping + P.calm * 2 * k); });
    if ((step + 1) % every === 0) rec();
    let moving = false;
    for (const [i, b] of bodies.entries()) { if (keep && bad.has(i)) continue; const v = b.linvel(), w = b.angvel(); if (Math.hypot(v.x, v.y, v.z) > vEps || Math.hypot(w.x, w.y, w.z) > wEps) { moving = true; break; } }
    still = moving ? 0 : still + 1;
    if (still >= need) {
      // come to rest cocked (leaning on a wall, a prop or another die)? a small nudge, as if the table were bumped,
      // and it settles again (at most five times); a flat die is never touched
      const cocked = drop ? [] : bodies.filter((b, i) => { if (keep && bad.has(i)) return false; const r = b.rotation(); return Math.acos(Math.min(1, flatness(dieGeo(dice[i]), [r.x, r.y, r.z, r.w]))) * 180 / Math.PI > P.cocked; });
      if (!cocked.length || nudges >= 5) { if (step + 1 >= mvLen - 1) break; continue; } // (never before the dice kept before have come to rest: one could still knock these)
      nudges++; still = 0;
      // the nudge tips it toward its nearest flat face: a little hop, turning about the axis that brings that face up
      const hop = Math.sqrt(2 * gravityOf(P) * 0.12 * s);
      for (const b of cocked) {
        const i = bodies.indexOf(b), g = dieGeo(dice[i]), r = b.rotation(), q = [r.x, r.y, r.z, r.w];
        const list = g.reads === 'vertex' ? g.faces.map(f => f.n.map(x => -x)) : g.faces.map(f => f.n); // (a d4 rests on a face: its "up" is that face's opposite)
        let best = null, by = -2; for (const n of list) { const w = qRotate(q, n); if (w[1] > by) { by = w[1]; best = w; } }
        const ax = [best[2], 0, -best[0]], l = Math.hypot(ax[0], ax[2]) || 1, ang = Math.acos(Math.min(1, by)) / 0.09; // turn the face up in about 0.09 s
        b.setLinvel({ x: 0, y: hop, z: 0 }, true); b.setAngvel({ x: ax[0] / l * ang, y: 0, z: ax[2] / l * ang }, true);
      }
    }
    if (step % 24 === 0) for (const [i, b] of bodies.entries()) { if (keep && bad.has(i)) continue; const t = b.translation(); if (t.y < from.y - 20 * s || Math.hypot(t.x - from.x, t.z - from.z) > P.reach * 2) {
      if (keep) { bad.set(i, 'escaped'); b.setEnabled(false); if (bad.size === N) { why = 'escaped'; break; } continue; }
      why = 'escaped'; break; } }
    if (why) break;
  }
  if (!why && step >= max && !keep) why = 'slow';
  const settleAt = (step + 1) * STEP;
  if (keep) return judgeEach();
  // how did they come to rest?
  const final = bodies.map((b, i) => { const t = b.translation(), r = b.rotation(); return { type: dice[i], p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] }; });
  if (!why) for (const f of final) {
    const g = dieGeo(f.type);
    if (Math.acos(Math.min(1, flatness(g, f.q))) * 180 / Math.PI > P.cocked) { why = 'cocked'; break; }
    if (Math.hypot(f.p[0] - from.x, f.p[2] - from.z) > P.reach) { why = 'reach'; break; }
    if (visible && !visible(f.p[0], f.p[2])) { why = 'unseen'; break; }
    if (rest && !rest(f.p[0], f.p[2])) { why = 'hidden-at-rest'; break; } // (rest: what matters only where a die comes to rest, e.g. the camera's line of sight)
  }
  const mvFinal = movers ? movers.dice.map((type, j) => { const F = movers.frames[mvLen - 1], o = j * 7; return { type, p: [F[o], F[o + 1], F[o + 2]], mover: true }; }) : [];
  const others = [...final, ...(world.dice || []).map(d => ({ type: d.type, p: d.p })), ...mvFinal];
  if (!why) for (let i = 0; i < N && !why; i++) for (let j = 0; j < others.length; j++) { // stacked: one die on another (touching, clearly above it), its own or one already lying
    if (i === j) continue; const a = final[i], b = others[j];
    const ga = dieGeo(a.type), gb = dieGeo(b.type), h = Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]);
    if (Math.abs(a.p[1] - b.p[1]) > 0.35 * s && (a.p[1] > b.p[1] || b.mover) && h < (ga.radius + gb.radius) * s) { why = 'stacked'; break; } // (a hand before, lying on this one: as bad)
  }
  // the path stays where the roller can see (sampled), so the dice never wander through the unknown
  if (!why && visible) for (let k = 0; k < frames.length && !why; k += 8) for (let i = 0; i < N; i++) { const F = frames[k]; if (!visible(F[i * 7], F[i * 7 + 2])) { why = 'unseen-path'; break; } }
  W.free();
  events.free();
  return { why, frames, final, settleAt, touched: [...touched] };
  // (keep) every die judged on its own, by the same tests
  function judgeEach() {
    const slow = step >= max;
    const final = bodies.map((b, i) => { const t = b.translation(), r = b.rotation(); return { type: dice[i], p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] }; });
    const no = (i, why) => { if (!bad.has(i)) bad.set(i, why); };
    bodies.forEach((b, i) => {
      if (bad.has(i)) return; const f = final[i], g = dieGeo(f.type), v = b.linvel(), w = b.angvel();
      if (slow && (Math.hypot(v.x, v.y, v.z) > vEps || Math.hypot(w.x, w.y, w.z) > wEps)) no(i, 'slow');
      else if (Math.acos(Math.min(1, flatness(g, f.q))) * 180 / Math.PI > P.cocked) no(i, 'cocked');
      else if (Math.hypot(f.p[0] - from.x, f.p[2] - from.z) > P.reach) no(i, 'reach');
      else if (visible && !visible(f.p[0], f.p[2])) no(i, 'unseen');
      else if (rest && !rest(f.p[0], f.p[2])) no(i, 'hidden-at-rest');
    });
    const mvFinal = movers ? movers.dice.map((type, j) => { const F = movers.frames[mvLen - 1], o = j * 7; return { type, p: [F[o], F[o + 1], F[o + 2]], mover: true }; }) : [];
    const others = [...final, ...(world.dice || []).map(d => ({ type: d.type, p: d.p })), ...mvFinal];
    for (let i = 0; i < N; i++) for (let j = 0; j < others.length; j++) {
      if (i === j || bad.get(i) === 'escaped' || j < N && bad.get(j) === 'escaped') continue; const a = final[i], b = others[j];
      const ga = dieGeo(a.type), gb = dieGeo(b.type), h = Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]);
      if (Math.abs(a.p[1] - b.p[1]) > 0.35 * s && (a.p[1] > b.p[1] || b.mover) && h < (ga.radius + gb.radius) * s) no(i, 'stacked');
      else if (b.mover && Math.hypot(h, a.p[1] - b.p[1]) < (ga.inR + gb.inR) * s * 0.95) no(i, 'inside'); // (passed into a kept die and stopped there)
    }
    if (visible) for (let k = 0; k < frames.length; k += 8) for (let i = 0; i < N; i++) { if (bad.get(i) === 'escaped') continue; const F = frames[k]; if (!visible(F[i * 7], F[i * 7 + 2])) no(i, 'unseen-path'); }
    W.free(); events.free();
    return { why: bad.size ? bad.values().next().value : null, bad, frames, final, settleAt, touched: [...touched] };
  }
}
// an orientation with one face (a d4: one face) flat on the floor, turned by yaw
function flatDown(type, yaw) {
  const g = dieGeo(type), n = g.faces[0].n; // turn face 0's normal onto -y, then about y
  const t = [0, -1, 0], ax = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]], c = n[0] * t[0] + n[1] * t[1] + n[2] * t[2];
  const l = Math.hypot(...ax); const q1 = l < 1e-9 ? (c > 0 ? { x: 0, y: 0, z: 0, w: 1 } : { x: 1, y: 0, z: 0, w: 0 }) : qFromAxisAngle(ax.map(x => x / l), Math.acos(Math.max(-1, Math.min(1, c))));
  const q2 = qFromAxisAngle([0, 1, 0], yaw);
  return { x: q2.w * q1.x + q2.x * q1.w + q2.y * q1.z - q2.z * q1.y, y: q2.w * q1.y - q2.x * q1.z + q2.y * q1.w + q2.z * q1.x, z: q2.w * q1.z + q2.x * q1.y - q2.y * q1.x + q2.z * q1.w, w: q2.w * q1.w - q2.x * q1.x - q2.y * q1.y - q2.z * q1.z };
}

export function throwDice(R, opts) { const it = throwSteps(R, opts); let r; do { r = it.next(); } while (!r.done); return r.value; }
// the same, giving the page a frame between tries (a crowded throw can take several): the roller's view never stalls
export async function throwDiceAsync(R, opts) { const it = throwSteps(R, opts); let r; for (;;) { r = it.next(); if (r.done) return r.value; await new Promise(res => setTimeout(res, 0)); } }
// BIG POOLS (2026-10-29; an AI seat's "sr 12" took 21 tries and 2.4 s, over the 2.5 s the line waits, and showed no
// dice): one die cocked on a table edge rejects the whole handful, so the chance a handful of N lands clean falls as
// p^N (measured in a furnished common room at the house look: p about 0.8; twelve dice never landed, every try then
// the flat drop). A pool of more than BIG_POOL.over dice is thrown the same way (the same handful, the same dials), but
// judged DIE BY DIE: every die that came to rest well is KEPT, its path final; the rest are thrown again from their
// places in the same handful, meeting the kept dice as they really moved (kinematic, along their recorded paths: they
// push the new dice, the new dice never move them), up to P.tries rounds, then BIG_POOL.gentle gentler rounds,
// each round's dice leaving the hand BIG_POOL.stagger s after the round before (at most BIG_POOL.handfuls handfuls: a
// big pool is thrown as a few quick handfuls, and a kept die is out of the hand before the next one goes;
// the recording's `r` says when each die goes, and it is not drawn before),
// then the flat drop for what is left. The cost grows with N, not p^N (house look, furnished room, node: 12 dice in
// 0.2-0.8 s, all or all but one thrown; before, never). A kept die that had bumped one thrown again bumped it in a path
// no longer shown: in a tumbling pool of a dozen that is not seen (dropping every die a bad one touched kept nothing:
// on the floor a big pool is one cluster). Pools up to BIG_POOL.over: exactly as before.
export const BIG_POOL = { over: 8, gentle: 2, stagger: 0.25, handfuls: 4 };
// `until` (performance.now() ms, optional): no try is started that would end past it (judged by the last one's time):
// what is left is set down flat instead, so the throw comes back before the caller stops waiting for it and the line
// never shows without its dice
function* throwSteps(R, { dice, P: P0 = {}, from, to, world = {}, visible = null, rest = null, seed = 1, keepRaw = false, until = null }) {
  const P = { ...PHYS_DEFAULTS, ...P0 }, u = rng(seed), reasons = {}, N = dice.length;
  // (a big pool's recording takes a while to cut down to size: its search stops at 70% of the time left)
  const t0 = performance.now(), stop = until == null ? null : N > BIG_POOL.over ? t0 + (until - t0) * 0.7 : until;
  lastTry = 0; const late = () => stop != null && performance.now() + lastTry > stop;
  if (to.y == null) to = { ...to, y: from.floor ?? from.y }; // (to.y: the floor at the target; the drop lands there)
  to = landingZone(dice, P, from, to, world, rest ? (x, z) => (!visible || visible(x, z)) && rest(x, z) : visible); // toward OPEN floor the roller sees (and where a die resting would be in sight), not into a crate
  let got, tries = 0, fallback = false, gentled = null, hands = 1, setDown = 0, release = null;
  if (N <= BIG_POOL.over) { ({ got, tries, fallback, gentled } = yield* oneHand(R, { dice, P, from, to, world, visible, rest, u, reasons, late })); if (fallback) setDown = N; }
  else ({ got, tries, fallback, gentled, hands, setDown, release } = yield* bigPool(R, { dice, P, from, to, world, visible, rest, u, reasons, late }));
  // the recording must fit the command (core/commands.js: 120 000 base64 characters): a very long tumble of many dice
  // keeps fewer keyframes (the tolerance doubles until it fits; a normal throw never gets near: 10 dice < 35 KB)
  let rec = null;
  // (too long: the tolerance grows by about the square of how much too long, at least doubling: fewer passes)
  for (let loose = 1; !rec || (rec.b.length > REC_BUDGET && loose <= 64); loose *= Math.max(2, Math.min(8, Math.ceil((rec.b.length / REC_BUDGET) ** 2 * 1.2)))) { const kept = got.times ? { frames: got.frames, times: got.times, hz: got.hz } : keyframes(got.frames, dice, P, loose); rec = encode(kept.frames, dice, kept.hz, P.size, kept.times, release); if (got.times) break; }
  if (rec.b.length > REC_BUDGET) { // (still too long: an even stride through every step, last frame kept)
    const n = got.frames.length, stride = Math.ceil(n * rec.b.length / REC_BUDGET / Math.max(1, rec.f)), keep = [];
    for (let k = 0; k < n - 1; k += stride) keep.push(k); keep.push(n - 1);
    rec = encode(keep.map(k => got.frames[k]), dice, Math.round(1 / STEP), P.size, keep, release);
  }
  return { rec, tries, reasons, fallback, gentled, hands, setDown, settleAt: got.settleAt, final: got.final, touched: got.touched || [], ...(keepRaw && { raw: got.frames }) };
}
// A BIG POOL, die by die (above): rounds of the whole handful's remaining dice, the kept ones moving as recorded
function* bigPool(R, { dice, P, from, to, world, visible, rest, u, reasons, late }) {
  const N = dice.length, order = [], slow = (w) => w === 'reach' || w === 'escaped' || w.startsWith('unseen') || w === 'hidden-at-rest';
  let left = dice.map((_, i) => i), movers = null, tries = 0, hands = 0, gentled = null, power = 1, settleAt = 0;
  const touched = new Set(), out0 = new Array(N).fill(0); let k = 0, rel = 0; // (out0: when each die leaves the hand, s)
  const round = (Pr, pw) => {
    rel = Math.round(BIG_POOL.stagger * Math.min(k++, BIG_POOL.handfuls - 1) / STEP); // (round k: the k-th handful, a beat after the one before)
    // (a later handful aims at open floor among the dice kept so far)
    const aim = movers ? landingZone(left.map(i => dice[i]), P, from, to, { ...world, dice: [...(world.dice || []), ...lyingOf(movers)] }, rest ? (x, z) => (!visible || visible(x, z)) && rest(x, z) : visible) : to;
    const r = attempt(R, { dice: left.map(i => dice[i]), P: Pr, from, to: aim, world, visible, rest, u, drop: false, power: pw, slot: { n: N, at: left }, movers, keep: true, release: rel });
    const out = new Set(r.bad.keys()), kept = left.map((_, k) => k).filter(k => !out.has(k));
    for (const why of r.bad.values()) reasons[why] = (reasons[why] || 0) + 1;
    if (kept.length) {
      hands++; settleAt = Math.max(settleAt, r.settleAt); for (const id of r.touched) touched.add(id);
      movers = joinHands(movers, kept.map(k => dice[left[k]]), r.frames.map(F => { const f = new Float64Array(kept.length * 7); kept.forEach((k, n) => f.set(F.subarray(k * 7, k * 7 + 7), n * 7)); return f; }));
      for (const k of kept) out0[left[k]] = rel * STEP;
      order.push(...kept.map(k => left[k])); left = left.filter((_, k) => out.has(k));
    }
    return [...r.bad.values()];
  };
  for (let j = 0; left.length && j < P.tries && !late(); j++, tries++) { const bad = round(P, power); if (bad.some(slow)) power *= 0.85; yield tries; }
  if (left.length) for (const [g, cap] of GENTLE.slice(0, BIG_POOL.gentle).entries()) {
    const G = { ...P, bounce: Math.min(P.bounce, cap), tableBounce: 1, strength: P.strength * (0.8 - 0.15 * g), height: P.height != null ? Math.max(1.5, P.height * (0.55 - 0.15 * g)) : null, angle: Math.min(P.angle ?? 30, 35) };
    if (!left.length || late()) break;
    const n = left.length; round(G, 1); tries++; if (left.length < n) gentled = { step: g + 1, bounce: [P.bounce, G.bounce] }; yield tries;
  }
  let fallback = false, setDown = 0;
  if (left.length) { // the rest: the flat drop, then set down (as one hand, among the kept dice)
    const r = yield* oneHand(R, { dice: left.map(i => dice[i]), P: { ...P, tries: 0 }, from, to, world, visible, rest, u, reasons, late, slot: { n: N, at: left }, movers, perStep: true, noGentle: true });
    fallback = true; setDown = left.length; tries += r.tries + 1; hands++; settleAt = Math.max(settleAt, r.got.settleAt); for (const id of r.got.touched || []) touched.add(id);
    movers = joinHands(movers, left.map(i => dice[i]), r.got.frames); order.push(...left); left = [];
  }
  // back into the pool's order
  const at = new Map(order.map((i, n) => [i, n])), frames = movers.frames.map(F => { const f = new Float64Array(N * 7); for (let i = 0; i < N; i++) f.set(F.subarray(at.get(i) * 7, at.get(i) * 7 + 7), i * 7); return f; });
  const F = frames.at(-1);
  return { got: { frames, settleAt, touched: [...touched], final: dice.map((type, i) => ({ type, p: [F[i * 7], F[i * 7 + 1], F[i * 7 + 2]], q: [F[i * 7 + 3], F[i * 7 + 4], F[i * 7 + 5], F[i * 7 + 6]] })) }, tries, fallback, gentled, hands, setDown, release: out0 };
}
// ONE HAND: thrown until it lands clean (P.tries), then gentler, then the short flat drop, then simply set down flat
function* oneHand(R, { dice, P, from, to, world, visible, rest, u, reasons, late, slot = null, movers = null, perStep = false, noGentle = false }) {
  let got = null, tries = 0, power = 1;
  for (; tries < P.tries && !got && !late(); tries++) {
    const r = attempt(R, { dice, P, from, to, world, visible, rest, u, drop: false, power, slot, movers });
    if (r.why) { reasons[r.why] = (reasons[r.why] || 0) + 1; if (r.why === 'reach' || r.why === 'escaped' || r.why.startsWith('unseen') || r.why === 'hidden-at-rest') power *= 0.85; yield tries; } else got = r;
  }
  // GENTLER THROWS (Harry 2026-10-19: "always showing up without rolling, just placed on the ground"): a lively preset
  // (bounce 0.85 x table 1.05 off a 14-ft hand) sends one die of six past reach most of the time, and one die rejects
  // the handful. Before any flat drop: the same dice, spin and look, thrown lower, slower and less bouncy, step by
  // step, so they still visibly tumble.
  let gentled = null;
  if (!got && !noGentle) for (const [k, cap] of GENTLE.entries()) {
    const G = { ...P, bounce: Math.min(P.bounce, cap), tableBounce: 1, strength: P.strength * (0.8 - 0.15 * k), height: P.height != null ? Math.max(1.5, P.height * (0.55 - 0.15 * k)) : null, angle: Math.min(P.angle ?? 30, 35) };
    for (let j = 0; j < 2 && !got && !late(); j++, tries++) {
      const r = attempt(R, { dice, P: G, from, to, world, visible, rest, u, drop: false, power: 1, slot, movers });
      if (r.why) { reasons['gentle-' + r.why] = (reasons['gentle-' + r.why] || 0) + 1; yield tries; } else { got = r; gentled = { step: k + 1, bounce: [P.bounce, G.bounce] }; }
    }
  }
  let fallback = false;
  if (!got) { // the last resort: a short flat drop onto the nearest open floor the roller sees; and if even that ends
    // badly (or there is no time left), the dice are simply set down flat there (no physics at all)
    fallback = true; const taken = movers ? movers.dice.map((type, j) => { const F = movers.frames.at(-1); return { type, x: F[j * 7], z: F[j * 7 + 2] }; }) : [];
    const spots = openSpots(dice, P, from, to, world, rest ? (x, z) => (!visible || visible(x, z)) && rest(x, z) : visible, taken);
    const r = late() ? { why: 'late' } : attempt(R, { dice, P, from, to, world, visible, u, drop: spots, slot, movers });
    if (r.why) { reasons['drop-' + r.why] = 1; got = placeFlat(dice, P, spots, u); if (perStep) got = { ...got, frames: stepFrames(got) }; } else got = r;
  }
  return { got, tries, fallback, gentled };
}
// the kept dice where they end, as dice lying on the table
const lyingOf = (m) => { const F = m.frames.at(-1); return m.dice.map((type, j) => ({ type, p: [F[j * 7], F[j * 7 + 1], F[j * 7 + 2]], q: [F[j * 7 + 3], F[j * 7 + 4], F[j * 7 + 5], F[j * 7 + 6]] })); };
// a set-down (frames at P.hz ticks) as one frame per physics step, to join with thrown hands
function stepFrames(g) { const n = Math.round(g.times.at(-1) / g.hz / STEP) + 1, out = []; for (let k = 0; k < n; k++) out.push(g.frames[Math.min(g.frames.length - 1, Math.round(k * STEP * g.hz))]); return out; }
// the hands so far plus one more: step by step, each die where its own hand had it then (at rest after its hand ends)
function joinHands(prev, dice, frames) {
  if (!prev) return { dice: [...dice], frames };
  const a = prev.frames, A = prev.dice.length * 7, n = Math.max(a.length, frames.length), out = [];
  for (let k = 0; k < n; k++) { const f = new Float64Array(A + dice.length * 7); f.set(a[Math.min(k, a.length - 1)], 0); f.set(frames[Math.min(k, frames.length - 1)], A); out.push(f); }
  return { dice: [...prev.dice, ...dice], frames: out };
}

// the landing zone: the nearest patch to `to`, big enough for the handful, on a surface, clear of props, pawns and
// dice already lying there, seen by the roller, and in reach
export function landingZone(dice, P, from, to, world, visible) {
  const s = P.size, zr = s * (1.1 + 0.55 * Math.sqrt(dice.length)), step = 0.75 * s, lying = world.dice || [];
  const surf = (x, z) => { let y = null; for (const f of world.surfaces || []) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && (y == null || f.y > y)) y = f.y; return y; };
  const clear = (x, z, y, zr) => {
    if (Math.hypot(x - from.x, z - from.z) > Math.max(2 * s, P.reach - zr)) return false;
    for (const [ox, oz] of [[0, 0], [zr, 0], [-zr, 0], [0, zr], [0, -zr]]) { if (visible && !visible(x + ox, z + oz)) return false; if (surf(x + ox, z + oz) !== y) return false; }
    for (const b of world.boxes || []) { if (b.y + b.hy <= y + 0.05) continue; const cs = Math.cos(-(b.yaw || 0)), sn = Math.sin(-(b.yaw || 0)), dx = x - b.x, dz = z - b.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < zr) return false; }
    for (const c of world.cylinders || []) if (c.y1 > y + 0.05 && Math.hypot(x - c.x, z - c.z) < zr + c.r) return false;
    for (const d of lying) if (Math.hypot(x - d.p[0], z - d.p[2]) < zr + (d.size || s)) return false;
    return true;
  };
  for (let shrink = 1; shrink > 0.3; shrink *= 0.75) { // (crowded: a smaller patch before giving up)
    let best = null, bd = Infinity;
    for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) {
      const x = to.x + i * step, z = to.z + j * step, d = i * i + j * j; if (d >= bd) continue;
      const y = surf(x, z); if (y == null || Math.abs(y - (to.y ?? y)) > 2.5) continue;
      if (clear(x, z, y, zr * shrink)) { best = { x, z, y }; bd = d; }
    }
    if (best) return best;
  }
  return to;
}
// set down flat at the spots: a 0.15 s settle from just above (the guaranteed end; never cocked, never stacked)
function placeFlat(dice, P, spots, u) {
  const s = P.size, F = Math.max(2, Math.round(0.15 * P.hz) + 1), frames = [];
  const rest = dice.map((type, i) => { const q = flatDown(type, u() * Math.PI * 2); return { p: [spots[i].x, spots[i].y + dieGeo(type).inR * s, spots[i].z], q: [q.x, q.y, q.z, q.w] }; });
  for (let k = 0; k < F; k++) { const f = new Float64Array(dice.length * 7), h = (1 - k / (F - 1)) ** 2 * 0.3 * s; rest.forEach((r, i) => f.set([r.p[0], r.p[1] + h, r.p[2], ...r.q], i * 7)); frames.push(f); }
  return { why: null, frames, times: frames.map((_, k) => k), hz: P.hz, final: rest.map((r, i) => ({ type: dice[i], ...r })), settleAt: (F - 1) / P.hz };
}
// the nearest open floor to `to` for each die: on a surface, clear of every box and cylinder and of each other, seen
export function openSpots(dice, P, from, to, world, visible, taken = []) {
  const s = P.size, out = [], step = 0.5 * s;
  const surf = (x, z) => { let y = null; for (const f of world.surfaces || []) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && (y == null || f.y > y)) y = f.y; return y; };
  const cands = [];
  for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) cands.push({ x: to.x + i * step, z: to.z + j * step, d: i * i + j * j });
  cands.sort((a, b) => a.d - b.d);
  for (const type of dice) {
    const rr = dieGeo(type).radius * s * 1.1;
    const ok = (c) => {
      if (visible && !visible(c.x, c.z)) return false;
      if (Math.hypot(c.x - from.x, c.z - from.z) > P.reach) return false;
      const y = surf(c.x, c.z); if (y == null) return false;
      for (const b of world.boxes || []) { const cs = Math.cos(-(b.yaw || 0)), sn = Math.sin(-(b.yaw || 0)), dx = c.x - b.x, dz = c.z - b.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        if (b.y + b.hy > y + 0.05 && b.y - b.hy < y + 2 * rr && Math.hypot(Math.max(0, Math.abs(lx) - b.hx), Math.max(0, Math.abs(lz) - b.hz)) < rr) return false; }
      for (const k of world.cylinders || []) if (k.y1 > y + 0.05 && Math.hypot(c.x - k.x, c.z - k.z) < rr + k.r) return false;
      for (const o of out) if (Math.hypot(c.x - o.x, c.z - o.z) < rr + o.rr) return false;
      for (const o of taken) if (Math.hypot(c.x - o.x, c.z - o.z) < rr + dieGeo(o.type).radius * s * 1.1) return false; // (a big pool's hands before)
      c.y = y; return true;
    };
    const c = cands.find(ok) || { x: to.x, z: to.z, y: to.y };
    out.push({ x: c.x, z: c.z, y: c.y ?? to.y, rr });
  }
  return out;
}

// ---------------- the recording: adaptive keyframes, quantised ----------------
// v2 { v: 2, hz (the tick rate of t), t: base64 Uint16 tick of each keyframe, s (die size), d: ['d6', …], o: [x, y, z]
//      (origin, ft), f: frames, b: base64 of Int16 [frame][die][px py pz qx qy qz qw], r (optional, 2026-10-29: a big
//      pool thrown in handfuls: when each die leaves the hand, s; it waits there unseen until then) }
// v1 (before 2026-10-20) has no t: frame k is at k / hz. Positions relative to o at 1/256 ft (±128 ft), quaternions at
// 1/32767. Everyone decodes the same bytes: the last frame (the pose the result is read from) is the same on every seat.
const PQ = 256, QQ = 32767;
export function keyframes(frames, dice, P, loose = 1) {
  const N = dice.length, n = frames.length, keep = [0], rot = Math.cos(KEY_ROT * loose * Math.PI / 360), POS = KEY_POS * loose;
  const ok = (a, b) => { // does interpolating a..b reproduce every frame between, for every die?
    for (let k = a + 1; k < b; k++) { const f = (k - a) / (b - a), A = frames[a], B = frames[b], C = frames[k];
      for (let i = 0; i < N; i++) { const o = i * 7;
        const dx = A[o] + (B[o] - A[o]) * f - C[o], dy = A[o + 1] + (B[o + 1] - A[o + 1]) * f - C[o + 1], dz = A[o + 2] + (B[o + 2] - A[o + 2]) * f - C[o + 2];
        if (dx * dx + dy * dy + dz * dz > POS * POS) return false;
        const q = slerp([A[o + 3], A[o + 4], A[o + 5], A[o + 6]], [B[o + 3], B[o + 4], B[o + 5], B[o + 6]], f);
        if (Math.abs(q[0] * C[o + 3] + q[1] * C[o + 4] + q[2] * C[o + 5] + q[3] * C[o + 6]) < rot) return false; } }
    return true;
  };
  let a = 0;
  while (a < n - 1) { let b = a + 1; while (b + 1 < n && b + 1 - a <= KEY_MAX && ok(a, b + 1)) b++; keep.push(b); a = b; }
  return { frames: keep.map(k => frames[k]), times: keep, hz: Math.round(1 / STEP) };
}
export function encode(frames, dice, hz, size, times = null, release = null) {
  const N = dice.length, o = [frames[0][0], frames[0][1], frames[0][2]].map(v => Math.round(v * 100) / 100);
  const a = new Int16Array(frames.length * N * 7);
  frames.forEach((F, k) => { for (let i = 0; i < N; i++) { const j = (k * N + i) * 7, x = i * 7;
    for (let c = 0; c < 3; c++) a[j + c] = Math.max(-32767, Math.min(32767, Math.round((F[x + c] - o[c]) * PQ)));
    const sg = F[x + 6] < 0 ? -1 : 1; for (let c = 0; c < 4; c++) a[j + 3 + c] = Math.round(F[x + 3 + c] * sg * QQ); } });
  const out = { v: times ? 2 : 1, hz, s: size, d: [...dice], o, f: frames.length, b: b64(new Uint8Array(a.buffer)) };
  if (times) out.t = b64(new Uint8Array(new Uint16Array(times).buffer));
  if (release?.some(x => x > 0)) out.r = release.map(x => +x.toFixed(3)); // (a big pool: when each die leaves the hand, s)
  return out;
}
export function decode(rec) {
  const N = rec.d.length, bytes = unb64(rec.b), a = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2), F = rec.f;
  if (a.length !== F * N * 7) throw new Error('bad dice recording');
  let T; // each keyframe's time, s
  if (rec.t) { const tb = unb64(rec.t), t16 = new Uint16Array(tb.buffer, tb.byteOffset, tb.byteLength / 2); if (t16.length !== F) throw new Error('bad dice recording times'); T = Array.from(t16, x => x / rec.hz); }
  else T = Array.from({ length: F }, (_, k) => k / rec.hz);
  const at = (k, i) => { const j = (k * N + i) * 7; const q = [a[j + 3] / QQ, a[j + 4] / QQ, a[j + 5] / QQ, a[j + 6] / QQ], l = Math.hypot(...q); return { p: [rec.o[0] + a[j] / PQ, rec.o[1] + a[j + 1] / PQ, rec.o[2] + a[j + 2] / PQ], q: q.map(v => v / l) }; };
  const final = rec.d.map((_, i) => at(F - 1, i));
  let hint = 0;
  const release = Array.isArray(rec.r) && rec.r.length === N ? rec.r.map(x => +x || 0) : null;
  return { hz: rec.hz, n: N, dice: rec.d, size: rec.s, frames: F, times: T, final, duration: T[F - 1], release,
    waiting: (t, i) => !!release && t < release[i], // (not yet thrown: not drawn)
    pose(t, i) { // t in seconds of the throw; positions lerp, rotations slerp between keyframes
      if (t >= T[F - 1]) return final[i];
      if (t <= 0) return at(0, i);
      let k = hint < F - 1 && T[hint] <= t ? hint : 0; while (k + 1 < F - 1 && T[k + 1] <= t) k++; hint = k;
      const f = (t - T[k]) / (T[k + 1] - T[k]), A = at(k, i), B = at(k + 1, i);
      return { p: [A.p[0] + (B.p[0] - A.p[0]) * f, A.p[1] + (B.p[1] - A.p[1]) * f, A.p[2] + (B.p[2] - A.p[2]) * f], q: slerp(A.q, B.q, f) };
    } };
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; const s = d < 0 ? -1 : 1; d *= s;
  if (d > 0.9995) { const q = a.map((v, i) => v + (b[i] * s - v) * t), l = Math.hypot(...q); return q.map(v => v / l); }
  const th = Math.acos(d), sn = Math.sin(th), wa = Math.sin((1 - t) * th) / sn, wb = Math.sin(t * th) / sn * s;
  return a.map((v, i) => v * wa + b[i] * wb);
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 3) { const n = (u8[i] << 16) | ((u8[i + 1] || 0) << 8) | (u8[i + 2] || 0); s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < u8.length ? B64[n >> 6 & 63] : '=') + (i + 2 < u8.length ? B64[n & 63] : '='); } return s; }
function unb64(s) { const L = s.length / 4 * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0), out = new Uint8Array(L); let j = 0; for (let i = 0; i < s.length; i += 4) { const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63); out[j++] = n >> 16 & 255; if (j < L) out[j++] = n >> 8 & 255; if (j < L) out[j++] = n & 255; } return out; }
// a roll's dice: the chat line's expression and numbers -> [{ type, value, skin? }] (skin, 2026-10-29: the faces a game's
// die wears, engine/core/gamedice.js; the recording's `d` stays the shape, so old recordings and checks are unchanged) (a d100 is a tens d10 and a units d10;
// sides with no real die (d3, d7, d1000) get none: the chat line carries them)
export function diceOfRoll(terms, rolls) {
  const out = []; let k = 0;
  for (const t of terms) {
    if (t.flat != null) continue;
    for (let i = 0; i < t.n; i++) {
      const v = rolls[k++];
      if (t.sides === 100) { out.push({ type: 'd10t', value: v === 100 ? 0 : Math.floor(v / 10) * 10 }, { type: 'd10', value: v === 100 ? 10 : (v % 10 || 10) }); }
      else if (t.tens && t.sides === 10) out.push({ type: 'd10t', value: (v % 10) * 10 }); // a percentile tens die on its own (core/gamedice.js coc: 10 reads 00)
      else if ([4, 6, 8, 10, 12, 20].includes(t.sides)) out.push({ type: `d${t.sides}`, value: v, ...(t.skin && { skin: t.skin }) }); // skin: a game's face set (the shape is the die's)
    }
  }
  return out;
}
