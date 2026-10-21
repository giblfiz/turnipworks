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
//   throwDice(R, { dice: ['d6', …], P, from: {x, y, z, r (the thrower's radius: dice start clear of it)}, to: {x, z}, world, visible(x, z) -> bool, seed }) -> {
//     rec,                      the recording to send (see encode below: ~30 Hz quantised keyframes)
//     tries, reasons: {why: n}, fallback: bool, settleAt (s)
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
function attempt(R, { dice, P, from, to, world, visible, rest = null, u, drop, power = 1 }) {
  const W = buildWorld(R, world, P), s = P.size, N = dice.length;
  if (P.height != null && from.floor != null) from = { ...from, y: from.floor + P.height }; // the dial: how high the hand lets go
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d, sx = -fz, sz = fx;
  const bodies = dice.map((type, i) => {
    // a handful, not a line: at most three across, the rest behind and above
    const cols = Math.min(N, 3), col = i % cols, row = Math.floor(i / cols), off = (col - (cols - 1) / 2) * 1.15 * s;
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
      const crowd = N > 3 ? Math.sqrt(3 / N) : 1; // a big handful is thrown more gently (they knock each other on)
      const sp = P.strength * s * power * crowd * Math.max(0.55, Math.min(1.4, d / 6)) * (0.8 + u() * 0.4), side = (u() - 0.5) * P.scatter;
      const a = P.angle * Math.PI / 180, h = Math.cos(a) * sp; // the speed is the full speed, along the throw angle
      v = { x: (fx + sx * side) * h, y: Math.sin(a) * sp, z: (fz + sz * side) * h };
      const ax = [u() * 2 - 1, u() * 2 - 1, u() * 2 - 1], l = Math.hypot(...ax) || 1, ws = P.spin * (0.7 + u() * 0.6);
      w = { x: ax[0] / l * ws, y: ax[1] / l * ws, z: ax[2] / l * ws };
    }
    const b = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(q).setLinvel(v.x, v.y, v.z).setAngvel(w)
      .setCcdEnabled(true).setLinearDamping(P.damping).setAngularDamping(P.angDamping).setCanSleep(false));
    const c = colliderPoints(type, P);
    W.createCollider(R.ColliderDesc.roundConvexHull(c.points, c.radius).setDensity(1).setFriction(P.friction).setRestitution(P.bounce).setActiveEvents(R.ActiveEvents.COLLISION_EVENTS), b);
    return b;
  });
  const every = 1, max = Math.ceil(P.settle / STEP) + 1, frames = []; // every physics step (240 Hz); encode() keeps only the keyframes playback needs
  const rec = () => { const f = new Float64Array(N * 7); bodies.forEach((b, i) => { const t = b.translation(), r = b.rotation(); f.set([t.x, t.y, t.z, r.x, r.y, r.z, r.w], i * 7); }); frames.push(f); };
  rec();
  let still = 0, step = 0, why = null, nudges = 0;
  const events = new R.EventQueue(true), touched = new Set(), landed = new Array(N).fill(null), dieOf = new Map();
  bodies.forEach((b, i) => dieOf.set(b.collider(0).handle, i));
  const vEps = 0.25 * s, wEps = 0.6, need = Math.round(0.12 / STEP);
  for (; step < max; step++) {
    W.step(events);
    events.drainCollisionEvents((h1, h2, started) => { if (!started) return; const id = W.propOf.get(h1) || W.propOf.get(h2); if (id) touched.add(id);
      for (const h of [h1, h2]) { const i = dieOf.get(h); if (i != null && landed[i] == null) landed[i] = step; } });
    // CALM DOWN AFTER LANDING (P.calm): from a die's first touch, its drag and rolling damping climb over a second, so the
    // first bounces stay lively and the handful still comes to rest within reach
    if (P.calm > 0 && step % 6 === 0) bodies.forEach((b, i) => { if (landed[i] == null) return; const k = Math.min(1, (step - landed[i]) * STEP); b.setLinearDamping(P.damping + P.calm * k); b.setAngularDamping(P.angDamping + P.calm * 2 * k); });
    if ((step + 1) % every === 0) rec();
    let moving = false;
    for (const b of bodies) { const v = b.linvel(), w = b.angvel(); if (Math.hypot(v.x, v.y, v.z) > vEps || Math.hypot(w.x, w.y, w.z) > wEps) { moving = true; break; } }
    still = moving ? 0 : still + 1;
    if (still >= need) {
      // come to rest cocked (leaning on a wall, a prop or another die)? a small nudge, as if the table were bumped,
      // and it settles again (at most five times); a flat die is never touched
      const cocked = drop ? [] : bodies.filter((b, i) => { const r = b.rotation(); return Math.acos(Math.min(1, flatness(dieGeo(dice[i]), [r.x, r.y, r.z, r.w]))) * 180 / Math.PI > P.cocked; });
      if (!cocked.length || nudges >= 5) break;
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
    if (step % 24 === 0) for (const b of bodies) { const t = b.translation(); if (t.y < from.y - 20 * s || Math.hypot(t.x - from.x, t.z - from.z) > P.reach * 2) { why = 'escaped'; break; } }
    if (why) break;
  }
  if (!why && step >= max) why = 'slow';
  const settleAt = (step + 1) * STEP;
  // how did they come to rest?
  const final = bodies.map((b, i) => { const t = b.translation(), r = b.rotation(); return { type: dice[i], p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] }; });
  if (!why) for (const f of final) {
    const g = dieGeo(f.type);
    if (Math.acos(Math.min(1, flatness(g, f.q))) * 180 / Math.PI > P.cocked) { why = 'cocked'; break; }
    if (Math.hypot(f.p[0] - from.x, f.p[2] - from.z) > P.reach) { why = 'reach'; break; }
    if (visible && !visible(f.p[0], f.p[2])) { why = 'unseen'; break; }
    if (rest && !rest(f.p[0], f.p[2])) { why = 'hidden-at-rest'; break; } // (rest: what matters only where a die comes to rest, e.g. the camera's line of sight)
  }
  const others = [...final, ...(world.dice || []).map(d => ({ type: d.type, p: d.p }))];
  if (!why) for (let i = 0; i < N && !why; i++) for (let j = 0; j < others.length; j++) { // stacked: one die on another (touching, clearly above it), its own or one already lying
    if (i === j) continue; const a = final[i], b = others[j];
    const ga = dieGeo(a.type), gb = dieGeo(b.type), h = Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]);
    if (a.p[1] - b.p[1] > 0.35 * s && h < (ga.radius + gb.radius) * s) { why = 'stacked'; break; }
  }
  // the path stays where the roller can see (sampled), so the dice never wander through the unknown
  if (!why && visible) for (let k = 0; k < frames.length && !why; k += 8) for (let i = 0; i < N; i++) { const F = frames[k]; if (!visible(F[i * 7], F[i * 7 + 2])) { why = 'unseen-path'; break; } }
  W.free();
  events.free();
  return { why, frames, final, settleAt, touched: [...touched] };
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
function* throwSteps(R, { dice, P: P0 = {}, from, to, world = {}, visible = null, rest = null, seed = 1, keepRaw = false }) {
  const P = { ...PHYS_DEFAULTS, ...P0 }, u = rng(seed), reasons = {};
  if (to.y == null) to = { ...to, y: from.floor ?? from.y }; // (to.y: the floor at the target; the drop lands there)
  to = landingZone(dice, P, from, to, world, rest ? (x, z) => (!visible || visible(x, z)) && rest(x, z) : visible); // toward OPEN floor the roller sees (and where a die resting would be in sight), not into a crate
  let got = null, tries = 0, power = 1;
  for (; tries < P.tries && !got; tries++) {
    const r = attempt(R, { dice, P, from, to, world, visible, rest, u, drop: false, power });
    if (r.why) { reasons[r.why] = (reasons[r.why] || 0) + 1; if (r.why === 'reach' || r.why === 'escaped' || r.why.startsWith('unseen') || r.why === 'hidden-at-rest') power *= 0.85; yield tries; } else got = r;
  }
  // GENTLER THROWS (Harry 2026-10-19: "always showing up without rolling, just placed on the ground"): a lively preset
  // (bounce 0.85 x table 1.05 off a 14-ft hand) sends one die of six past reach most of the time, and one die rejects
  // the handful. Before any flat drop: the same dice, spin and look, thrown lower, slower and less bouncy, step by
  // step, so they still visibly tumble.
  let gentled = null;
  if (!got) for (const [k, cap] of GENTLE.entries()) {
    const G = { ...P, bounce: Math.min(P.bounce, cap), tableBounce: 1, strength: P.strength * (0.8 - 0.15 * k), height: P.height != null ? Math.max(1.5, P.height * (0.55 - 0.15 * k)) : null, angle: Math.min(P.angle ?? 30, 35) };
    for (let j = 0; j < 2 && !got; j++, tries++) {
      const r = attempt(R, { dice, P: G, from, to, world, visible, rest, u, drop: false, power: 1 });
      if (r.why) { reasons['gentle-' + r.why] = (reasons['gentle-' + r.why] || 0) + 1; yield tries; } else { got = r; gentled = { step: k + 1, bounce: [P.bounce, G.bounce] }; }
    }
  }
  let fallback = false;
  if (!got) { // the last resort: a short flat drop onto the nearest open floor the roller sees; and if even that ends
    // badly, the dice are simply set down flat there (no physics at all)
    fallback = true; const spots = openSpots(dice, P, from, to, world, rest ? (x, z) => (!visible || visible(x, z)) && rest(x, z) : visible);
    const r = attempt(R, { dice, P, from, to, world, visible, u, drop: spots });
    if (r.why) { reasons['drop-' + r.why] = 1; got = placeFlat(dice, P, spots, u); } else got = r;
  }
  // the recording must fit the command (core/commands.js: 120 000 base64 characters): a very long tumble of many dice
  // keeps fewer keyframes (the tolerance doubles until it fits; a normal throw never gets near: 10 dice < 35 KB)
  let rec = null;
  for (let loose = 1; !rec || (rec.b.length > REC_BUDGET && loose <= 64); loose *= 2) { const kept = got.times ? { frames: got.frames, times: got.times, hz: got.hz } : keyframes(got.frames, dice, P, loose); rec = encode(kept.frames, dice, kept.hz, P.size, kept.times); if (got.times) break; }
  if (rec.b.length > REC_BUDGET) { // (still too long: an even stride through every step, last frame kept)
    const n = got.frames.length, stride = Math.ceil(n * rec.b.length / REC_BUDGET / Math.max(1, rec.f)), keep = [];
    for (let k = 0; k < n - 1; k += stride) keep.push(k); keep.push(n - 1);
    rec = encode(keep.map(k => got.frames[k]), dice, Math.round(1 / STEP), P.size, keep);
  }
  return { rec, tries, reasons, fallback, gentled, settleAt: got.settleAt, final: got.final, touched: got.touched || [], ...(keepRaw && { raw: got.frames }) };
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
export function openSpots(dice, P, from, to, world, visible) {
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
      c.y = y; return true;
    };
    const c = cands.find(ok) || { x: to.x, z: to.z, y: to.y };
    out.push({ x: c.x, z: c.z, y: c.y ?? to.y, rr });
  }
  return out;
}

// ---------------- the recording: adaptive keyframes, quantised ----------------
// v2 { v: 2, hz (the tick rate of t), t: base64 Uint16 tick of each keyframe, s (die size), d: ['d6', …], o: [x, y, z]
//      (origin, ft), f: frames, b: base64 of Int16 [frame][die][px py pz qx qy qz qw] }
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
export function encode(frames, dice, hz, size, times = null) {
  const N = dice.length, o = [frames[0][0], frames[0][1], frames[0][2]].map(v => Math.round(v * 100) / 100);
  const a = new Int16Array(frames.length * N * 7);
  frames.forEach((F, k) => { for (let i = 0; i < N; i++) { const j = (k * N + i) * 7, x = i * 7;
    for (let c = 0; c < 3; c++) a[j + c] = Math.max(-32767, Math.min(32767, Math.round((F[x + c] - o[c]) * PQ)));
    const sg = F[x + 6] < 0 ? -1 : 1; for (let c = 0; c < 4; c++) a[j + 3 + c] = Math.round(F[x + 3 + c] * sg * QQ); } });
  const out = { v: times ? 2 : 1, hz, s: size, d: [...dice], o, f: frames.length, b: b64(new Uint8Array(a.buffer)) };
  if (times) out.t = b64(new Uint8Array(new Uint16Array(times).buffer));
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
  return { hz: rec.hz, n: N, dice: rec.d, size: rec.s, frames: F, times: T, final, duration: T[F - 1],
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
// a roll's dice: the chat line's expression and numbers -> [{ type, value }] (a d100 is a tens d10 and a units d10;
// sides with no real die (d3, d7, d1000) get none: the chat line carries them)
export function diceOfRoll(terms, rolls) {
  const out = []; let k = 0;
  for (const t of terms) {
    if (t.flat != null) continue;
    for (let i = 0; i < t.n; i++) {
      const v = rolls[k++];
      if (t.sides === 100) { out.push({ type: 'd10t', value: v === 100 ? 0 : Math.floor(v / 10) * 10 }, { type: 'd10', value: v === 100 ? 10 : (v % 10 || 10) }); }
      else if ([4, 6, 8, 10, 12, 20].includes(t.sides)) out.push({ type: `d${t.sides}`, value: v });
    }
  }
  return out;
}
