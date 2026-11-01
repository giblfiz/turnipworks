// TERRAIN: THE BANKS BETWEEN HILLS (2026-10-24; docs/VERTICAL.md "Terrain: computed banks", Harry 2026-10-05: "I like
// your banks demo, I'm sold. Particularly with high edge softness, steep angles, and earth on steep parts ... It looks
// tabletop not realistic, and that's perfect"). Pure data, no three.js: the browser draws what this works out, and the
// tests (test/terrain.test.mjs) check its numbers in node.
//
// THE DATA is only the hills: rooms of a terrain type (core/height.js isTerrain), each a flat terrace on the 5-ft grid
// whose floor y (a multiple of 5) is its top, and a `cliff` flag (its banks are rock faces). THE BANKS ARE NOT DATA.
// Wherever two heights meet (a hill and the ground, a hill and a lower hill), the bank is laid from the upper one down
// onto the lower one. The rule (the banks demo's, experiments/2026-10-05-banks/viewer/terrain.js, unchanged):
//
//     height(p) = the highest, over every terrace level v, of   v - tan(bank angle) * distance from p to that level
//
// "distance" is the true distance to the outline of everything at height v or above, so an outside corner comes out
// round with no extra work. The UPPER terrace keeps its whole footprint (a pawn on its edge square stands level); the
// bank lies on the lower ground. Corner rounding opens and closes the outline with a disc; edge softness blurs the
// field (the outline is pushed out by 1.2 x that first, so the rounding happens beyond the terrace's own edge);
// roughness lets the foot wander, varies the angle and puts small lumps on the bank (terraces stay flat).
// Hills far apart are worked out separately (clusters), each over its own small square of samples.
import { isTerrainRoom, roomY, terrainTakers } from './height.js';
import { cellsOf } from './footprint.js';

// Harry's house settings, from the demo's "Copy settings" (experiments/2026-10-05-banks/harry-settings.json). These are
// the defaults; never overwritten by code.
export const BANKS = Object.freeze({ angle: 45, soft: 1.2, round: 0.5, rough: 0.6, dress: 0.45, earth: 0.8, cliffAngle: 76 });
export const CELL = 5;

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(ix, iz, seed) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1274126177); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295 * 2 - 1; }
// smooth value noise in [-1, 1]
export function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z, wl, seed) => 0.6 * noise(x / wl, z / wl, seed) + 0.28 * noise(x / wl * 2.1 + 9, z / wl * 2.1 - 4, seed + 1) + 0.12 * noise(x / wl * 4.3 - 3, z / wl * 4.3 + 7, seed + 2);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// distance (in samples) from every sample to the nearest sample where mask is set (Felzenszwalb & Huttenlocher, exact)
function distTo(mask, W, H) {
  const INF = 1e20, n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(W * H), out = new Float32Array(W * H);
  let any = false; for (let i = 0; i < g.length; i++) { if (mask[i]) { g[i] = 0; any = true; } else g[i] = INF; }
  if (!any) return out.fill(1e6);
  const pass = (len) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
  };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; pass(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; pass(W); for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(d[x]); }
  return out;
}
const inv = (m) => { const o = new Uint8Array(m.length); for (let i = 0; i < m.length; i++) o[i] = m[i] ? 0 : 1; return o; };
const thresh = (d, test) => { const o = new Uint8Array(d.length); for (let i = 0; i < d.length; i++) o[i] = test(d[i]) ? 1 : 0; return o; };
// round the outline: open (square outside corners -> arcs), then close (inside corners -> arcs)
function roundMask(mask, W, H, rc) {
  if (rc < 0.6) return mask;
  const er = thresh(distTo(inv(mask), W, H), (d) => d > rc);
  if (!er.some(Boolean)) return mask; // narrower than the disc: leave it square rather than lose it
  const op = thresh(distTo(er, W, H), (d) => d <= rc);
  const di = thresh(distTo(op, W, H), (d) => d <= rc);
  return thresh(distTo(inv(di), W, H), (d) => d > rc);
}
function blur(h, W, H, sigma) { // gaussian, sigma in samples
  if (sigma < 0.3) return h;
  const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1); let s = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * h[y * W + Math.min(W - 1, Math.max(0, x + i))]; t[y * W + x] = a; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * t[Math.min(H - 1, Math.max(0, y + i)) * W + x]; o[y * W + x] = a; }
  return o;
}

// THE HILLS OF AN AREA, as the field wants them: { id, y, cells: [[gx, gz]...] (world squares), cliff, floor, box }
export function hillsOf(entities) {
  const out = [];
  for (const e of Object.values(entities || {})) {
    if (!isTerrainRoom(e)) continue;
    const rc = e.recipe, y = roomY(rc); if (!(y > 0)) continue;
    const cells = cellsOf(rc).map(([i, j]) => [rc.x + i, rc.z + j]);
    const xs = cells.map(c => c[0]), zs = cells.map(c => c[1]);
    out.push({ id: e.id, y, cells, cliff: !!e.cliff, floor: rc.floor || 'floor-grass', hidden: !!e.hidden, box: [Math.min(...xs) * CELL, Math.min(...zs) * CELL, (Math.max(...xs) + 1) * CELL, (Math.max(...zs) + 1) * CELL] });
  }
  return out.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
// THE ROOMS THAT CUT THE GROUND (2026-10-24; Harry: "The hill slope should not push thru walls. Existing (and new) rooms
// should trump hill slope, so that they can have a 'dug out' look"): every room (not a hill) that reaches above the
// ground, as { id, y, cells, box }: inside its outline the ground is cut down to its floor (never below the ground, 0), so
// a hill's top and its bank stop at the room's walls, whichever was drawn first (core/height.js terrainTakers).
// (2026-10-26) The crater over a room shown below the ground (`open`) is GONE (2026-10-27, Harry: "Rooms _under_ the
// ground level shouldn't change the shape of the hill"): a room below the ground never cuts a hill, at any view. Below
// the ground the hill is drawn whole and see-through instead (client/world.js hillSee).
// (2026-10-26) `hidden`: the ids of rooms the view's cut hides. A room the cut hides takes nothing from the hill: the hill
// is whole there (its top drawn, its bank uncut), so a shrine cut away from a hilltop leaves the hilltop, not a hole, and
// below the ground every hill is the whole earth over the level in view.
export function cuttersOf(entities, hidden = []) {
  const hid = new Set(hidden || []);
  return terrainTakers(entities).filter(t => !hid.has(t.id)).map(t => {
    const cells = cellsOf(t.rc).map(([i, j]) => [t.rc.x + i, t.rc.z + j]), xs = cells.map(c => c[0]), zs = cells.map(c => c[1]);
    return { id: t.id, y: Math.max(0, t.y), cells, box: [Math.min(...xs) * CELL, Math.min(...zs) * CELL, (Math.max(...xs) + 1) * CELL, (Math.max(...zs) + 1) * CELL] };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
const boxesMeet = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
// how far a hill's bank can reach past its edge (feet): the run at the shallowest angle roughness allows, the push and
// the softness, the foot's wander, and a little more
export const reachOf = (y, P = BANKS) => y / Math.tan(Math.max(8, P.angle * (1 - 0.42 * P.rough)) * Math.PI / 180) + 1.2 * P.soft + 3 * P.soft + 4.3 * P.rough + 3;

// hills whose reach overlaps are worked out together (a bank between them must see both); far-apart ones separately
export function clustersOf(hills, P = BANKS) {
  const grown = hills.map(h => { const m = reachOf(h.y, P); return [h.box[0] - m, h.box[1] - m, h.box[2] + m, h.box[3] + m]; });
  const parent = hills.map((_, i) => i), find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < hills.length; i++) for (let j = i + 1; j < hills.length; j++) {
    const a = grown[i], b = grown[j];
    if (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]) parent[find(i)] = find(j);
  }
  const groups = new Map();
  for (let i = 0; i < hills.length; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  return [...groups.values()].map(ix => {
    const hs = ix.map(i => hills[i]), b = ix.map(i => grown[i]);
    const x0 = Math.floor(Math.min(...b.map(r => r[0])) / CELL) * CELL, z0 = Math.floor(Math.min(...b.map(r => r[1])) / CELL) * CELL;
    const x1 = Math.ceil(Math.max(...b.map(r => r[2])) / CELL) * CELL, z1 = Math.ceil(Math.max(...b.map(r => r[3])) / CELL) * CELL;
    // 0.5 ft as in the demo; coarser for a very large group, so a whole hilly map still works out in about a second
    const area = (x1 - x0) * (z1 - z0), cs = area <= 160 * 160 ? 0.5 : area <= 320 * 320 ? 1 : 1.25;
    return { hills: hs, dom: { x0, z0, cs, nx: Math.round((x1 - x0) / cs) + 1, nz: Math.round((z1 - z0) / cs) + 1 } };
  });
}

// THE FIELD of one cluster. Samples lie ON the grid: sample (i, j) is at x0 + i cs, z0 + j cs, so a hill's outline runs
// exactly along sample lines and its edge samples are its own (flat at its top).
//   -> { h, rock, cell, owner, dom, heightAt, grad, slopeDeg, relief, levelAt }
//   cell[k]  the terrace height under the sample (0 = the ground); owner[k] the index (in hills) of the hill whose bank
//   or top the sample is (-1: the ground). h - cell = how far the ground there rises above the floor it stands on.
export function buildField(hills, P, dom, seed = 1, cutters = []) {
  const { x0, z0, cs, nx: W, nz: H } = dom, N = W * H;
  const X = (i) => x0 + i * cs, Z = (j) => z0 + j * cs;
  const cell = new Float32Array(N), owner = new Int16Array(N).fill(-1);
  hills.forEach((hl, hi) => {
    for (const [gx, gz] of hl.cells) {
      const i0 = Math.max(0, Math.round((gx * CELL - x0) / cs)), i1 = Math.min(W - 1, Math.round(((gx + 1) * CELL - x0) / cs));
      const j0 = Math.max(0, Math.round((gz * CELL - z0) / cs)), j1 = Math.min(H - 1, Math.round(((gz + 1) * CELL - z0) / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i; if (hl.y >= cell[k]) { cell[k] = hl.y; owner[k] = hi; } }
    }
  });
  const levels = [...new Set(cell)].sort((p, q) => p - q); if (levels[0] !== 0) levels.unshift(0);
  // where a bank is a rock face (0..1): the bank of a hill whose `cliff` is set. It goes by which hill is NEARER (a rock
  // hill or a grass one), never by how far out the sample is: a rock weight that fell off down the bank made the angle
  // gentler further out, and the bank rose again into a berm with a trench at the cliff's foot (Gemini 2026-10-24,
  // "an unnatural sunken ditch ... before rising into the outer berm"). Between a rock hill and a grass hill it tapers
  // over a few feet, so the cliff runs into the grass bank beside it.
  const rock = new Float32Array(N);
  const cliffMask = new Uint8Array(N), grassMask = new Uint8Array(N); let anyCliff = false, anyGrass = false;
  for (let k = 0; k < N; k++) if (owner[k] >= 0) { if (hills[owner[k]].cliff) { cliffMask[k] = 1; anyCliff = true; } else { grassMask[k] = 1; anyGrass = true; } }
  if (anyCliff && !anyGrass) rock.fill(1);
  else if (anyCliff) {
    const dC = distTo(cliffMask, W, H), dG = distTo(grassMask, W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; rock[k] = sstep(-3, 3, (dG[k] - dC[k]) * cs + 1.5 * noise(X(i) / 9, Z(j) / 9, seed + 61)); }
  }
  // per-sample bank tangent and outline wander
  const tanA = new Float32Array(N), wob = new Float32Array(N), rg = P.rough, cliffDeg = P.cliffAngle || 76;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, x = X(i), z = Z(j), c = rock[k];
    const a = P.angle * (1 + 0.42 * rg * noise(x / 23 + 3, z / 23 - 8, seed + 11));
    tanA[k] = Math.tan(Math.min(80, a + (cliffDeg - a) * c) * Math.PI / 180);
    // grass: the outline wanders, almost always outward (so terraces keep their squares). rock: broken into buttresses
    wob[k] = rg * (2.6 * fbm(x, z, 24, seed + 21) + 0.8 * fbm(x, z, 7, seed + 22) - 1.6) + c * (2.0 * noise(x / 6.1, z / 6.1, seed + 31) + 0.9 * noise(x / 2.3, z / 2.3, seed + 32) - 0.6);
  }
  let h = new Float32Array(N).fill(0); const push = 1.2 * P.soft, win = new Int16Array(N).fill(-1);
  for (let li = 1; li < levels.length; li++) {
    const v = levels[li], mask = roundMask(thresh(cell, (c) => c >= v), W, H, P.round / cs);
    const dOut = distTo(mask, W, H), dIn = distTo(inv(mask), W, H);
    for (let k = 0; k < N; k++) {
      const s = (mask[k] ? -(dIn[k] - 0.5) : dOut[k] - 0.5) * cs + wob[k] - push * (1 - 0.8 * rock[k]); // signed distance to the outline, feet, + outside
      const val = v - tanA[k] * Math.max(0, s);
      if (val > h[k]) { h[k] = val; win[k] = li; }
    }
  }
  const raw = h; h = blur(raw, W, H, P.soft / cs);
  if (h !== raw) for (let k = 0; k < N; k++) h[k] += (raw[k] - h[k]) * rock[k] * 0.8; // a rock face keeps its crisp lip
  // lumps on the banks only: scaled by how steep the ground is, so terraces and the lawn stay flat
  const at = (i, j) => h[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
  if (rg > 0) {
    const lump = new Float32Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const g = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * cs), x = X(i), z = Z(j);
      lump[j * W + i] = sstep(0.06, 0.32, g) * rg * (0.55 * fbm(x, z, 7, seed + 41) + 0.16 * noise(x / 1.7, z / 1.7, seed + 44));
    }
    for (let k = 0; k < N; k++) h[k] += lump[k];
  }
  // A TERRACE IS LEVEL to its edge (a pawn's base on an edge square must not tip), and nothing dips under the floor it
  // stands on; the ground beyond the bank's foot is exactly the ground
  // (a sample on a terrace whose own level won: its top. A lower terrace under a higher hill's bank is that bank's.)
  const top = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (owner[k] >= 0 && levels[win[k]] === cell[k]) { top[k] = 1; h[k] = cell[k]; continue; }
    if (h[k] < cell[k] || h[k] - cell[k] < 0.004) h[k] = cell[k];
  }
  // ROOMS TRUMP THE BANK (2026-10-24): inside a room's outline (its grid lines included) the ground is cut down to the
  // room's floor, so nothing of a hill rises inside it. The step from the cut to the bank beside it lies between the grid
  // line and the next sample out (half a foot, at the usual spacing): inside the wall, whose outer face is half a foot
  // out, so the earth meets the wall's face at its own height, banked up against it.
  const cut = new Uint8Array(N); // (samples the cut lowered: where they meet uncut ground the earth's face is drawn, client/terrain.js)
  for (const c of cutters) {
    for (const [gx, gz] of c.cells) {
      const i0 = Math.max(0, Math.round((gx * CELL - x0) / cs)), i1 = Math.min(W - 1, Math.round(((gx + 1) * CELL - x0) / cs));
      const j0 = Math.max(0, Math.round((gz * CELL - z0) / cs)), j1 = Math.min(H - 1, Math.round(((gz + 1) * CELL - z0) / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i; if (h[k] > c.y) { h[k] = c.y; cell[k] = Math.min(cell[k], c.y); top[k] = 0; cut[k] = 1; } }
    }
  }
  // whose ground a bank sample is: the hill at the winning level nearest to it (several hills at one height)
  for (let k = 0; k < N; k++) {
    if (top[k]) continue;
    if (win[k] < 0 || h[k] - cell[k] < 0.004) { owner[k] = owner[k] >= 0 ? owner[k] : -1; continue; }
    const v = levels[win[k]], x = X(k % W), z = Z(Math.floor(k / W)); let best = -1, bd = Infinity;
    for (let hi = 0; hi < hills.length; hi++) { const hl = hills[hi]; if (hl.y !== v && !(hl.y > v)) continue; const b = hl.box, d = Math.hypot(Math.max(b[0] - x, 0, x - b[2]), Math.max(b[1] - z, 0, z - b[3])) + (hl.y === v ? 0 : 1e3); if (d < bd) { bd = d; best = hi; } }
    owner[k] = best;
  }
  const F = { h, rock, cell, owner, top, cut, hills, dom, levels };
  F.heightAt = (x, z) => {
    const fx = Math.min(W - 1.001, Math.max(0, (x - x0) / cs)), fz = Math.min(H - 1.001, Math.max(0, (z - z0) / cs));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * W + i;
    return h[k] * (1 - u) * (1 - v) + h[k + 1] * u * (1 - v) + h[k + W] * (1 - u) * v + h[k + W + 1] * u * v;
  };
  F.inside = (x, z) => x >= x0 && z >= z0 && x <= x0 + (W - 1) * cs && z <= z0 + (H - 1) * cs;
  F.sample = (arr, x, z) => arr[Math.min(H - 1, Math.max(0, Math.round((z - z0) / cs))) * W + Math.min(W - 1, Math.max(0, Math.round((x - x0) / cs)))];
  F.grad = (x, z, e = 1) => [(F.heightAt(x + e, z) - F.heightAt(x - e, z)) / (2 * e), (F.heightAt(x, z + e) - F.heightAt(x, z - e)) / (2 * e)]; // points uphill
  F.slopeDeg = (x, z, e = 1) => { const g = F.grad(x, z, e); return Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI; };
  // how far the ground under a round base of radius r departs from level (feet, highest minus lowest)
  F.relief = (x, z, r) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 8; a++) { const y = F.heightAt(x + Math.cos(a * Math.PI / 4) * r, z + Math.sin(a * Math.PI / 4) * r); lo = Math.min(lo, y); hi = Math.max(hi, y); } const c = F.heightAt(x, z); return Math.max(hi, c) - Math.min(lo, c); };
  return F;
}

// THE WHOLE AREA'S TERRAIN: one field per cluster of hills. heightAt(x, z): the ground's height there (0 off every
// field). key: changes exactly when the field would (the hills, their heights, shapes, cliffs and the settings).
// (2026-10-24) the rooms that cut a cluster: those whose outline meets its samples
export function terrainKey(entities, P = BANKS, hidden = []) {
  const hills = hillsOf(entities), clusters = clustersOf(hills, P), all = cuttersOf(entities, hidden);
  const cut = clusters.map(c => { const d = c.dom, box = [d.x0, d.z0, d.x0 + (d.nx - 1) * d.cs, d.z0 + (d.nz - 1) * d.cs]; return all.filter(r => boxesMeet(r.box, box)); });
  const key = JSON.stringify([P, hills.map(h => [h.id, h.y, h.cells.length, h.box, h.cliff, h.floor, h.hidden, h.cells.map(c => c.join(':')).join(',')]), cut.map(rs => rs.map(r => [r.id, r.y, r.cells.map(c => c.join(':')).join(',')]))]);
  return { key, hills, clusters, cut };
}
export function terrainOf(entities, P = BANKS, hidden = []) {
  const { key, hills, clusters, cut } = terrainKey(entities, P, hidden);
  const fields = clusters.map((c, i) => buildField(c.hills, P, c.dom, 1 + seedOf(c.hills), cut[i]));
  return { key, hills, fields, heightAt: (x, z) => { let y = 0; for (const F of fields) if (F.inside(x, z)) y = Math.max(y, F.heightAt(x, z)); return y; } };
}
// a cluster's seed from its hills' ids, so a hill's bank looks the same however the others around it change
function seedOf(hills) { let s = 7; for (const h of hills) for (let i = 0; i < h.id.length; i++) s = Math.imul(s ^ h.id.charCodeAt(i), 16777619) >>> 0; return s % 100000; }

// THE DRESSING (Harry: "Rock is generated props on top ... They overlap rather than butt"): seeded, worked out from the
// field, never stored. The demo's rules, without the trees (they stand over pawns' squares): rocks pushed into the foot
// of a rock face; bushes, half-buried boulders on the grass banks. Nothing on a hill's top (that is where pawns stand),
// nothing where `keepOut(x, z, r)` says (a room's floor, a thing).
//   -> [{ id: 'rock-boulder' | 'bush', x, y, z, yaw, scale: [sx, sy, sz] }]
export function dressingOf(F, P = BANKS, { seed = 1, keepOut = () => false } = {}) {
  const rng = mulberry32(seed * 977 + 13), out = [], taken = [];
  const free = (x, z, r) => !taken.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r) && !keepOut(x, z, r) && F.inside(x, z);
  const put = (o, r) => { taken.push({ x: o.x, z: o.z, r }); out.push(o); };
  const { x0, z0, cs, nx, nz } = F.dom, x1 = x0 + (nx - 1) * cs, z1 = z0 + (nz - 1) * cs;
  const bank = (x, z) => F.sample(F.h, x, z) - F.sample(F.cell, x, z) > 0.15; // on a bank (not a terrace, not the ground)
  // rock faces first: walk down from a point on the face to its foot, and push rocks into it there
  const face = [];
  for (let z = z0; z <= z1; z += 1.5) for (let x = x0; x <= x1; x += 1.5) if (F.sample(F.rock, x, z) >= 0.55 && bank(x, z) && F.slopeDeg(x, z, 0.75) >= 42) face.push([x, z]);
  for (let i = face.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [face[i], face[j]] = [face[j], face[i]]; }
  for (let i = 0; i < Math.min(face.length, 120); i++) {
    let [x, z] = face[i]; const acc = rng(), sz = rng(), jit = rng();
    for (let s = 0; s < 60 && F.slopeDeg(x, z, 1) > 14; s++) { const g = F.grad(x, z, 0.75), m = Math.hypot(g[0], g[1]) || 1; x -= g[0] / m * 0.5; z -= g[1] / m * 0.5; }
    if (acc > 0.25 + P.dress * 1.1) continue;
    const g = F.grad(x, z, 3), m = Math.hypot(g[0], g[1]); if (m < 0.02) continue;
    const ux = g[0] / m, uz = g[1] / m, s = 0.8 + sz * 0.7, px = x + ux * 0.6 * s - uz * (jit - 0.5) * 3, pz = z + uz * 0.6 * s + ux * (jit - 0.5) * 3;
    if (!free(px, pz, 2.2 * s)) continue;
    put({ id: 'rock-boulder', x: px, z: pz, y: F.heightAt(px, pz) - 0.7 * s, yaw: jit * 6.283, scale: [s * (0.85 + acc), s * (0.8 + jit * 0.5), s] }, 2.4 * s);
  }
  // then the grass banks: bushes and half-buried boulders
  const N = Math.round((x1 - x0) * (z1 - z0) / 9);
  for (let i = 0; i < N; i++) {
    const x = x0 + rng() * (x1 - x0), z = z0 + rng() * (z1 - z0), roll = rng(), acc = rng(), sz = rng(), yawR = rng() * Math.PI * 2;
    if (!bank(x, z) || F.sample(F.rock, x, z) > 0.45) continue;
    const sd = F.slopeDeg(x, z, 1.5); if (sd < 12) continue;
    if (acc > P.dress * 0.42) continue;
    const tan = Math.tan(sd * Math.PI / 180);
    if (roll < 0.45) { const s = 0.75 + sz * 0.5; if (free(x, z, 1.9 * s)) put({ id: 'bush', pick: Math.floor(roll * 9), x, z, y: F.heightAt(x, z) - 0.2 - tan * 1.2 * s, yaw: yawR, scale: [s, s, s] }, 1.9 * s); }
    else { const s = 0.55 + sz * 0.6, r = 2.4 * s; if (free(x, z, r)) put({ id: 'rock-boulder', x, z, y: F.heightAt(x, z) - 0.9 * s - tan * r * 0.75, yaw: yawR, scale: [s * (0.8 + roll * 0.6), s * (0.75 + sz * 0.4), s] }, r); }
  }
  return out;
}
