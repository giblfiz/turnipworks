// A THING'S ORIENTATION UNDER ITS TURN (Harry 2026-10-12: "I was hoping for roll to always be relative to the current
// view ... That way you can get the object into ANY orientation while just having rotation and roll").
// An object may carry `quat`: a unit quaternion [x, y, z, w], the rotation of the thing in its own turned frame. What
// is drawn is  R = Ry(rot) · Q(quat):  the Turn (`rot`, about the world's vertical) stays what it was and is applied on
// top. Absent = upright (every campaign from before loads unchanged). It replaces `tiltZ` (2026-10-11 to 10-12: one
// angle about the thing's own front-to-back axis), which is the special case quat = [0, 0, sin(t/2), cos(t/2)].
// A ROLL is a rotation by an angle about a WORLD axis n (the view's): R' = Rot(n, a) · R, so
//   quat' = Rot(Ry(-rot) · n, a) · quat        (rollQuat below)
// Plain arithmetic on arrays: the relay, the tests and the client share it, and none of it needs three.js.
const EPS = 1e-9;
export const Q_ID = [0, 0, 0, 1];
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qAxis = (n, a) => { const l = Math.hypot(n[0], n[1], n[2]) || 1, s = Math.sin(a / 2) / l; return [n[0] * s, n[1] * s, n[2] * s, Math.cos(a / 2)]; };
export const qRotate = (q, v) => { // q · v · q⁻¹
  const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};
export const qNorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]); return l < EPS ? [...Q_ID] : q.map(v => v / l); };
// the angle between two orientations, radians (0 = the same)
export const qAngle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
// WHAT IS STORED: a unit quaternion with w >= 0, rounded to 5 places (under 0.002° of error), or null for upright
// (anything within 0.02° of it). The one door every `quat` passes through, on every side.
export function quatOf(v) {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite)) return null;
  let q = qNorm(v); if (q[3] < 0) q = q.map(x => -x);
  q = q.map(x => { const r = Math.round(x * 1e5) / 1e5; return r === 0 ? 0 : r; });
  return q[3] >= 1 - 2e-8 || Math.hypot(q[0], q[1], q[2]) < 2e-4 ? null : q;
}
export const quatProblem = (v) => Array.isArray(v) && v.length === 4 && v.every(Number.isFinite) && Math.hypot(...v) > 0.5 && Math.hypot(...v) < 2 ? null : 'quat: a unit quaternion [x, y, z, w]';
// the old field: a tilt of t radians about the thing's own front-to-back axis
export const quatFromTiltZ = (t) => Number.isFinite(t) ? quatOf([0, 0, Math.sin(t / 2), Math.cos(t / 2)]) : null;
// an entity's orientation, whichever way it is written (an old client's entity may still say tiltZ)
export const quatOfEntity = (e) => (e?.quat && quatOf(e.quat)) || (e?.tiltZ ? quatFromTiltZ(e.tiltZ) : null);
// SQUARE UP: if one of the thing's own axes is within `tol` of the world's vertical, bring it exactly there (the
// smallest rotation that does): "exactly upright", "exactly on its side", "exactly upside down" are what people want,
// and a roll about an axis that is a hair off would otherwise leave 0.3° nobody can see or remove.
export function squareUp(q, tol = 1.2 * Math.PI / 180) {
  let best = null;
  for (const a of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const w = qRotate(q, a), c = Math.abs(w[1]); if (c < 1 - 1e-12 && Math.acos(Math.min(1, c)) <= tol && (!best || c > best.c)) best = { w, c }; }
  if (!best) return q;
  const w = best.w, up = [0, w[1] < 0 ? -1 : 1, 0], axis = [w[1] * up[2] - w[2] * up[1], w[2] * up[0] - w[0] * up[2], w[0] * up[1] - w[1] * up[0]]; // w × up
  const s = Math.hypot(...axis); if (s < EPS) return q;
  return qNorm(qMul(qAxis(axis, Math.asin(Math.min(1, s))), q));
}
// a roll of `angle` about the WORLD axis `n`, of a thing turned by `rot` whose orientation is `quat` (or null) -> the
// new stored quat (or null: upright)
export function rollQuat(quat, rot, n, angle) {
  const c = Math.cos(rot || 0), s = Math.sin(rot || 0), local = [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]; // Ry(-rot) · n
  return quatOf(squareUp(qMul(qAxis(local, angle), quat ? qNorm(quat) : Q_ID)));
}
// FOLD A PURE TURN BACK INTO THE TURN: an orientation that is only a rotation about the vertical is the Turn's business.
// -> { rot, quat } with quat null when that is all it was (so "upright" stays one thing in the data)
export function foldTurn(rot, quat) {
  if (!quat) return { rot: rot || 0, quat: null };
  if (Math.hypot(quat[0], quat[2]) > 2e-4) return { rot: rot || 0, quat };
  return { rot: (rot || 0) + 2 * Math.atan2(quat[1], quat[3]), quat: null };
}
// the 3 × 3 matrix of Ry(rot) · Q(quat), rows (tests: "assert the resulting matrix")
export function matrixOf(rot, quat) {
  const q = qMul(qAxis([0, 1, 0], rot || 0), quat ? qNorm(quat) : Q_ID), cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(v => qRotate(q, v));
  return [0, 1, 2].map(r => cols.map(c => c[r]));
}
// THE GESTURE'S SPECIAL STOPS: the angles of a roll about world axis `n` (from orientation rot + quat) at which
//   one of the thing's own axes stands exactly vertical  ('upright' for its own up, 'square' for another, 'upside down')
//   its own up axis lies exactly level                    ('on its side')
// -> [{ a: angle in (-π, π], label }]. Only axes square enough to the roll axis can reach vertical (within `perp`).
export function rollStops(quat, rot, n, perp = 1.2 * Math.PI / 180) {
  const q = qMul(qAxis([0, 1, 0], rot || 0), quat ? qNorm(quat) : Q_ID), l = Math.hypot(...n) || 1, k = n.map(v => v / l), out = [];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((ax, i) => {
    const w = qRotate(q, ax), kw = cross(k, w), d = dot(k, w);
    // after a roll by a:  y(a) = w.y cos a + (k × w).y sin a + k.y (k·w)(1 - cos a)
    const A = w[1] - k[1] * d, B = kw[1], C = k[1] * d, R = Math.hypot(A, B); if (R < 1e-9) return;
    const ph = Math.atan2(B, A);
    if (Math.abs(d) <= Math.sin(perp) && R + C > 1 - 1e-4) { out.push({ a: wrap(ph), label: i === 1 ? 'upright' : 'square' }); out.push({ a: wrap(ph + Math.PI), label: i === 1 ? 'upside down' : 'square' }); }
    if (i === 1 && Math.abs(C) <= R) { const t = Math.acos(Math.max(-1, Math.min(1, -C / R))); out.push({ a: wrap(ph + t), label: 'on its side' }); out.push({ a: wrap(ph - t), label: 'on its side' }); }
  });
  const rank = { upright: 0, 'upside down': 1, 'on its side': 2, square: 3 }; out.sort((p, q) => rank[p.label] - rank[q.label]); // (two stops at one angle: the plainer word)
  return out.filter((s, i) => out.findIndex(o => Math.abs(wrap(o.a - s.a)) < 1e-4) === i);
}
