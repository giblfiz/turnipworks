// DICE GEOMETRY (2026-10-19): the seven dice as real polyhedra, their conventional numbering, and their rotation
// groups. Pure (no three.js, no DOM): node tests, the physics (dicesim.js) and the look (dicelook.js) share it.
//
// BIT-EXACT ON EVERY BROWSER. Everything here that the physics reads is built from + - * / and Math.sqrt only (no sin,
// cos, atan2, pow): IEEE 754 makes those exact everywhere, so every seat's tumble is the same to the last bit. The
// 72-degree angles of the d10 and d12 come from sqrt(5) (cos 72 = (sqrt5 - 1) / 4 and so on).
//
//   DIE_TYPES                      'd4' 'd6' 'd8' 'd10' 'd12' 'd20'  (a d100 is two d10s: 'd10t' tens + 'd10')
//   dieGeo(type) -> { type, verts, faces: [{ v: [i…], n, h, c, up }], radius, inR, reads: 'face' | 'vertex',
//                     labels: [value per face (or per vertex for the d4)], group: [{ m: 3x3, perm }] }
//   topIndex(geo, q)               the face (or d4 vertex) pointing most up for body orientation q = [x, y, z, w]
//   labelOf(geo, i)                what is printed on face / vertex i ('0'…'20', '00'…'90')
//   remap(geo, q, value) -> { g: quat, perm }   the numbering turned by a SYMMETRY of the die so that the face that
//                                  ends on top reads `value`. The shape is unchanged (it is a symmetry), so the die is
//                                  never turned after the fact: only the numbers printed on it move.
export const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const S5 = Math.sqrt(5), PHI = (1 + S5) / 2, IPHI = PHI - 1;
const COS72 = (S5 - 1) / 4, SIN72 = Math.sqrt(10 + 2 * S5) / 4, COS36 = (1 + S5) / 4, SIN36 = Math.sqrt(10 - 2 * S5) / 4;
// the 5-fold angles: k*72 and 36 + k*72 degrees, as exact cos / sin pairs
const C5 = [1, COS72, -COS36, -COS36, COS72], S5A = [0, SIN72, SIN36, -SIN36, -SIN72];
const C5H = [COS36, -COS72, -1, -COS72, COS36], S5H = [SIN36, SIN72, 0, -SIN72, -SIN36];

// how big each die is against the size dial (circumradius in die units: a d6 of size 1 has edges of 1)
const CIRC = { d4: 0.98, d6: 0.866, d8: 0.82, d10: 0.8, d12: 0.84, d20: 0.84 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

function rawVerts(type) {
  switch (type) {
    case 'd4': return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
    case 'd6': { const v = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]); return v; }
    case 'd8': return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    case 'd12': {
      const v = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
      for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a * IPHI, b * PHI]); v.push([a * IPHI, b * PHI, 0]); v.push([a * PHI, 0, b * IPHI]); }
      return v;
    }
    case 'd20': {
      const v = []; for (const a of [-1, 1]) for (const b of [-1, 1]) { v.push([0, a, b * PHI]); v.push([a, b * PHI, 0]); v.push([a * PHI, 0, b]); }
      return v;
    }
    case 'd10': { // pentagonal trapezohedron: two apexes, an upper ring at k*72 and a lower ring at 36 + k*72 degrees.
      // Its kites are flat when the apex height is h = c (1 + cos36) / (1 - cos36) (the apex, the middle of an upper
      // chord and the lower vertex between are in one line in the kite's plane of symmetry).
      const c = 0.11, h = c * (1 + COS36) / (1 - COS36);
      const v = [[0, h, 0], [0, -h, 0]];
      for (let k = 0; k < 5; k++) v.push([C5[k], c, S5A[k]]);
      for (let k = 0; k < 5; k++) v.push([C5H[k], -c, S5H[k]]);
      return v;
    }
  }
  throw new Error(`no die ${type}`);
}

// the convex hull's faces from its vertices (all of them lie on the hull): every supporting plane through three of them
function hullFaces(V) {
  const faces = [], eps = 1e-9;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) for (let k = j + 1; k < V.length; k++) {
    let n = cross(sub(V[j], V[i]), sub(V[k], V[i])); const l = len(n); if (l < 1e-9) continue;
    n = scale(n, 1 / l); let h = dot(n, V[i]);
    let pos = 0, neg = 0; for (const p of V) { const s = dot(n, p) - h; if (s > eps) pos++; else if (s < -eps) neg++; }
    if (pos && neg) continue;
    if (pos) { n = scale(n, -1); h = -h; }
    if (faces.some(f => dot(f.n, n) > 1 - 1e-9)) continue;
    const on = []; for (let m = 0; m < V.length; m++) if (Math.abs(dot(n, V[m]) - h) < 1e-7) on.push(m);
    faces.push({ n, h, v: on });
  }
  // each face's vertices counter-clockwise seen from outside (an arithmetic comparator: no angles)
  for (const f of faces) {
    const c = scale(f.v.reduce((a, m) => [a[0] + V[m][0], a[1] + V[m][1], a[2] + V[m][2]], [0, 0, 0]), 1 / f.v.length);
    const a = norm(sub(V[f.v[0]], c)), b = cross(f.n, a);
    const xy = (m) => { const d = sub(V[m], c); return [dot(d, a), dot(d, b)]; };
    const half = ([x, y]) => (y > 1e-12 || (Math.abs(y) <= 1e-12 && x > 0)) ? 0 : 1;
    f.v.sort((p, q) => { const P = xy(p), Q = xy(q), hp = half(P), hq = half(Q); if (hp !== hq) return hp - hq; return -(P[0] * Q[1] - P[1] * Q[0]); });
    f.c = c;
  }
  return faces;
}

// 3x3 rotations as row-major arrays
const mulMV = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
function frame(a, b) { const x = norm(a), z = norm(cross(a, b)), y = cross(z, x); return [x, y, z]; }
function rotFromFrames(F, G) { // R = G * F^T: takes F's axes onto G's
  const m = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) m[r * 3 + c] += G[k][r] * F[k][c];
  return m;
}
function rotationGroup(V) {
  const a = V[0];
  let b = null, best = Infinity; // its nearest neighbour (never opposite it)
  for (const p of V) { const d = len(sub(p, a)); if (d > 1e-9 && d < best && Math.abs(dot(norm(p), norm(a))) < 0.999) { best = d; b = p; } }
  const F = frame(a, b), la = len(a), lb = len(b), ab = dot(a, b), out = [], seen = new Set();
  for (const a2 of V) {
    if (Math.abs(len(a2) - la) > 1e-9) continue;
    for (const b2 of V) {
      if (Math.abs(len(b2) - lb) > 1e-9 || Math.abs(dot(a2, b2) - ab) > 1e-9) continue;
      const m = rotFromFrames(F, frame(a2, b2)), perm = [];
      for (const p of V) { const q = mulMV(m, p), j = V.findIndex(r => len(sub(r, q)) < 1e-7); if (j < 0) break; perm.push(j); }
      if (perm.length !== V.length) continue;
      const key = perm.join(','); if (seen.has(key)) continue; seen.add(key);
      out.push({ m, vperm: perm });
    }
  }
  return out;
}

const QUAT = (m) => { // 3x3 rotation -> [x, y, z, w] (rendering only)
  const t = m[0] + m[4] + m[8];
  let x, y, z, w;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / s; x = s / 4; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = s / 4; z = (m[5] + m[7]) / s; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = s / 4; }
  return [x, y, z, w];
};
export const qRot = (q, v) => { // rotate v by unit quaternion q = [x, y, z, w]
  const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
export const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];

const cache = new Map();
export function dieGeo(type) {
  const key = type === 'd10t' ? 'd10' : type;
  if (cache.has(type)) return cache.get(type);
  let V = rawVerts(key);
  const r0 = Math.max(...V.map(len)); V = V.map(p => scale(p, CIRC[key] / r0));
  const faces = hullFaces(V);
  const group = rotationGroup(V);
  // each rotation's face permutation (face i goes where face perm[i] was)
  for (const g of group) g.perm = faces.map(f => { const n = mulMV(g.m, f.n); return faces.findIndex(o => dot(o.n, n) > 1 - 1e-7); });
  const reads = key === 'd4' ? 'vertex' : 'face';
  // a printed number's "up" on each face: toward the face's first vertex for a d10 kite's apex end, else an edge
  for (const f of faces) {
    if (key === 'd10') { const apex = f.v.find(i => i < 2); f.up = norm(sub(V[apex], f.c)); }
    else { const a = V[f.v[0]], b = V[f.v[1]]; const mid = scale([a[0] + b[0], a[1] + b[1], a[2] + b[2]], 0.5); f.up = norm(sub(f.c, mid)); }
  }
  const labels = numbering(key, V, faces);
  const geo = { type, key, verts: V, faces, group, reads, labels, radius: Math.max(...V.map(len)), inR: Math.min(...faces.map(f => f.h)), sides: key === 'd10' ? 10 : key === 'd4' ? 4 : faces.length };
  geo.group.forEach(g => { g.q = QUAT(g.m); });
  cache.set(type, geo);
  return geo;
}

// THE CONVENTIONAL NUMBERING. d6 d8 d12 d20: opposite faces add up to sides + 1. d10: 0…9, opposite faces add up to 9,
// odd numbers round one apex, even round the other. d4: the number at the top corner (each face carries three).
function numbering(key, V, faces) {
  if (key === 'd4') return [1, 2, 3, 4];
  if (key === 'd10') {
    const out = new Array(10).fill(null), top = faces.map((f, i) => [f, i]).filter(([f]) => f.v.includes(0));
    // round the top apex in the faces' own order (by ring vertex index): 1, 7, 3, 9, 5 (spread out, like a real d10)
    top.sort((a, b) => Math.min(...a[0].v.filter(i => i >= 2)) - Math.min(...b[0].v.filter(i => i >= 2)));
    const odd = [1, 7, 3, 9, 5];
    top.forEach(([f, i], k) => { out[i] = odd[k]; const j = faces.findIndex(o => dot(o.n, f.n) < -1 + 1e-7); out[j] = 9 - odd[k]; });
    return out;
  }
  const n = faces.length, out = new Array(n).fill(null); let k = 1;
  // walk the faces from the top down, so neighbours get spread-out numbers; each one's opposite gets n + 1 - it
  const order = faces.map((f, i) => i).sort((a, b) => (faces[b].n[1] - faces[a].n[1]) || (faces[b].n[0] - faces[a].n[0]) || (faces[b].n[2] - faces[a].n[2]));
  for (const i of order) { if (out[i] != null) continue; const j = faces.findIndex(o => dot(o.n, faces[i].n) < -1 + 1e-7); out[i] = k; out[j] = n + 1 - k; k++; }
  return out;
}

export function labelOf(geo, i, perm = null) {
  const v = geo.labels[perm ? perm[i] : i];
  if (geo.type === 'd10t') return v === 0 ? '00' : `${v}0`;
  return String(v);
}
// the value a label stands for in a roll of this die (d10: '0' is 10; tens: '00' is 0)
export const valueOfLabel = (geo, l) => geo.type === 'd10' ? (l === 0 ? 10 : l) : geo.type === 'd10t' ? l * 10 : l;
const labelForValue = (geo, value) => geo.type === 'd10' ? value % 10 : geo.type === 'd10t' ? Math.floor(value / 10) % 10 : value;

export function topIndex(geo, q) {
  let best = -1, by = -Infinity;
  const list = geo.reads === 'vertex' ? geo.verts : geo.faces.map(f => f.n);
  for (let i = 0; i < list.length; i++) { const y = qRot(q, list[i])[1]; if (y > by) { by = y; best = i; } }
  return best;
}
// how squarely the top face sits (1 = flat; a die leaning on a wall or another die is less)
export function flatness(geo, q) {
  if (geo.reads === 'vertex') { let lo = Infinity; for (const f of geo.faces) lo = Math.min(lo, qRot(q, f.n)[1]); return -lo; } // its down face
  let hi = -Infinity; for (const f of geo.faces) hi = Math.max(hi, qRot(q, f.n)[1]); return hi;
}

// THE REMAP. `perm[i]` = which standard face's number is printed on face i. A symmetry g that takes the face carrying
// `value` (in the standard numbering) onto the top face: print face i with the number of face g^-1(i). Among the g
// that do (a d6 has four), the one whose number reads upright for someone looking along the throw (-z is "up the page").
export function remap(geo, q, value) {
  const want = labelForValue(geo, value);
  const src = geo.labels.indexOf(want); if (src < 0) throw new Error(`${geo.type} has no ${value}`);
  const top = topIndex(geo, q);
  let best = null, bs = -Infinity;
  for (const g of geo.group) {
    const map = geo.reads === 'vertex' ? g.vperm : g.perm;
    if (map[src] !== top) continue;
    let s = 0;
    if (geo.reads === 'face') { const up = qRot(q, mulMV(g.m, geo.faces[src].up)); s = -up[2]; }
    if (s > bs + 1e-9) { bs = s; best = g; }
  }
  // perm: printed on element i = the standard label of the element g sends onto i
  const map = geo.reads === 'vertex' ? best.vperm : best.perm, perm = new Array(map.length);
  for (let i = 0; i < map.length; i++) perm[map[i]] = i;
  return { g: best.q, m: best.m, perm };
}
// what a viewer reads on the top of a die printed with `perm`, lying at orientation q
export function readTop(geo, q, perm) { return valueOfLabel(geo, geo.labels[perm[topIndex(geo, q)]]); }
