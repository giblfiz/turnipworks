// Banks demo: the ground as a height field worked out from flat terraces. No three.js in here (it also runs in node:
// ../test_terrain.mjs).
//
// THE DATA is only: flat terraces (rectangles on the 5-ft grid, each at a height that is a multiple of 5 ft), a list of
// places where an edge is a rock face instead of a grass bank, and ramps (a graded path between two heights).
// THE BANKS are not data. Wherever two heights meet, this file lays a slope from the upper one down to the lower one:
//
//     height(p) = the highest, over every terrace level v, of   v - tan(bank angle) * distance from p to that level
//
// "distance" is the true distance to the outline of everything at height v or above, so an outside corner comes out
// round (a quarter cone) with no extra work. The upper terrace keeps its whole footprint; the bank lies on the lower one.
// Corner rounding: the outline is opened and closed with a disc of that radius first (square corners become arcs).
// Edge softness: the finished height field is blurred by that many feet (the crease at the top and foot becomes a curve).
//   The outline is pushed out by 1.2 x that first, so the rounding happens beyond the terrace's own edge and the
//   terrace itself stays level right up to it (a pawn's base on an edge cell must not tip).
// Roughness: the outline wanders, the angle varies a little and the bank gets small lumps; terraces stay flat.

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// smooth value noise in [-1, 1]
function hash(ix, iz, seed) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1274126177); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967295 * 2 - 1; }
export function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z, wl, seed) => 0.6 * noise(x / wl, z / wl, seed) + 0.28 * noise(x / wl * 2.1 + 9, z / wl * 2.1 - 4, seed + 1) + 0.12 * noise(x / wl * 4.3 - 3, z / wl * 4.3 + 7, seed + 2);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// distance (in cells) from every cell to the nearest cell where mask is set (Felzenszwalb & Huttenlocher, exact)
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
  if (!er.some(Boolean)) return mask;                       // narrower than the disc: leave it square rather than lose it
  const op = thresh(distTo(er, W, H), (d) => d <= rc);
  const di = thresh(distTo(op, W, H), (d) => d <= rc);
  return thresh(distTo(inv(di), W, H), (d) => d > rc);
}
function blur(h, W, H, sigma) {   // gaussian, sigma in cells
  if (sigma < 0.3) return h;
  const r = Math.ceil(sigma * 3), k = new Float32Array(2 * r + 1); let s = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-i * i / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(W * H), o = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * h[y * W + Math.min(W - 1, Math.max(0, x + i))]; t[y * W + x] = a; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * t[Math.min(H - 1, Math.max(0, y + i)) * W + x]; o[y * W + x] = a; }
  return o;
}
const rectDist = (x, z, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));

export const CLIFF_DEG = 76;
// def: { base, terraces: [{rect:[x0,z0,x1,z1], h}], cliffs: [rect], ramps: [{a:[x,z,h], b:[x,z,h], w}], paths: [rect] }
// P:   { angle (deg), soft (ft), round (ft), rough (0..1), cliffs: 'scene' | 'none' | 'all', seed }
// dom: { x0, z0, n, cs }   n x n samples, sample (i, j) at x0 + (i + .5) cs, z0 + (j + .5) cs
export function buildField(def, P, dom) {
  const { x0, z0, n, cs } = dom, N = n * n, seed = P.seed | 0;
  const X = (i) => x0 + (i + 0.5) * cs, Z = (j) => z0 + (j + 0.5) * cs;
  const base = def.base || 0, cell = new Float32Array(N).fill(base);
  for (const t of def.terraces) {
    const [a, b, c, d] = t.rect;
    for (let j = 0; j < n; j++) { const z = Z(j); if (z < b || z > d) continue; for (let i = 0; i < n; i++) { const x = X(i); if (x >= a && x <= c) cell[j * n + i] = t.h; } }
  }
  const levels = [...new Set(cell)].sort((p, q) => p - q);
  // where an edge is a rock face (0..1, feathered over 6 ft so a cliff tapers into the grass bank beside it)
  const rock = new Float32Array(N), cl = P.cliffs === 'none' ? [] : (def.cliffs || []);
  if (P.cliffs === 'all') rock.fill(1);
  else if (cl.length) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let m = 1e9; for (const r of cl) m = Math.min(m, rectDist(X(i), Z(j), r)); rock[j * n + i] = 1 - sstep(0, 6, m + 3.5 * noise(X(i) / 9, Z(j) / 9, seed + 61) + 1.5); }
  // per-sample bank tangent and outline wander
  const tanA = new Float32Array(N), wob = new Float32Array(N), rg = P.rough;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = X(i), z = Z(j), c = rock[k];
    const a = P.angle * (1 + 0.42 * rg * noise(x / 23 + 3, z / 23 - 8, seed + 11));
    tanA[k] = Math.tan(Math.min(80, a + (CLIFF_DEG - a) * c) * Math.PI / 180);
    // grass: the outline wanders, almost always outward (so terraces keep their cells). rock: always broken into buttresses
    wob[k] = rg * (2.6 * fbm(x, z, 24, seed + 21) + 0.8 * fbm(x, z, 7, seed + 22) - 1.6) + c * (2.0 * noise(x / 6.1, z / 6.1, seed + 31) + 0.9 * noise(x / 2.3, z / 2.3, seed + 32) - 0.6);
  }
  let h = new Float32Array(N).fill(levels[0]); const push = 1.2 * P.soft;
  for (const v of levels.slice(1)) {
    const mask = roundMask(thresh(cell, (c) => c >= v), n, n, P.round / cs);
    const dOut = distTo(mask, n, n), dIn = distTo(inv(mask), n, n);
    for (let k = 0; k < N; k++) {
      const s = (mask[k] ? -(dIn[k] - 0.5) : dOut[k] - 0.5) * cs + wob[k] - push * (1 - 0.8 * rock[k]);   // signed distance to the outline, feet, + outside
      const val = v - tanA[k] * Math.max(0, s);
      if (val > h[k]) h[k] = val;
    }
  }
  const raw = h; h = blur(raw, n, n, P.soft / cs);
  if (h !== raw) for (let k = 0; k < N; k++) h[k] += (raw[k] - h[k]) * rock[k] * 0.8;   // a rock face keeps its crisp lip
  // lumps on the banks only: scaled by how steep the ground is, so terraces and the lawn stay flat
  const at = (i, j) => h[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))];
  const lump = new Float32Array(N);
  if (rg > 0) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const g = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * cs), x = X(i), z = Z(j);
    lump[j * n + i] = sstep(0.06, 0.32, g) * rg * (0.55 * fbm(x, z, 7, seed + 41) + 0.16 * noise(x / 1.7, z / 1.7, seed + 44));
  }
  for (let k = 0; k < N; k++) h[k] += lump[k];
  // ramps: a graded strip between two heights, cut into (or built out of) whatever is there, with banks at the bank angle
  const path = new Float32Array(N), tanB = Math.tan(P.angle * Math.PI / 180);
  for (const r of def.ramps || []) {
    const [ax, az, ah] = r.a, [bx, bz, bh] = r.b, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, hw = r.w / 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i, px = X(i) - ax, pz = Z(j) - az, along = px * ux + pz * uz, lat = Math.abs(px * uz - pz * ux);
      const over = Math.max(0, -along, along - L); if (lat > hw + 40 || over > 12) continue;
      const t = Math.min(1, Math.max(0, along / L)), hr = ah + (bh - ah) * t;
      const fall = Math.max(2.5, Math.abs(hr - h[k]) / tanB * 1.3);
      const w = (1 - sstep(hw, hw + fall, lat)) * (1 - sstep(0, 5, over));
      h[k] += (hr - h[k]) * w;
      path[k] = Math.max(path[k], (1 - sstep(hw - 2.6, hw - 0.6, lat + 1.1 * noise(X(i) / 6, Z(j) / 6, seed + 51) + 0.5 * noise(X(i) / 2.2, Z(j) / 2.2, seed + 53))) * (1 - sstep(-3, 2, over + 1.5 * noise(X(i) / 4, Z(j) / 4, seed + 54))));
    }
  }
  for (const r of def.paths || []) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const d = rectDist(X(i), Z(j), r) + 0.9 * noise(X(i) / 5, Z(j) / 5, seed + 52) + 0.4 * noise(X(i) / 1.8, Z(j) / 1.8, seed + 55); if (d < 1.5) path[j * n + i] = Math.max(path[j * n + i], 1 - sstep(-0.9, 0.9, d));
  }
  const F = { h, rock, path, cell, levels, dom };
  F.heightAt = (x, z) => {
    const fx = Math.min(n - 1.001, Math.max(0, (x - x0) / cs - 0.5)), fz = Math.min(n - 1.001, Math.max(0, (z - z0) / cs - 0.5));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * n + i;
    return h[k] * (1 - u) * (1 - v) + h[k + 1] * u * (1 - v) + h[k + n] * (1 - u) * v + h[k + n + 1] * u * v;
  };
  F.sample = (arr, x, z) => arr[Math.min(n - 1, Math.max(0, Math.round((z - z0) / cs - 0.5))) * n + Math.min(n - 1, Math.max(0, Math.round((x - x0) / cs - 0.5)))];
  F.grad = (x, z, e = 1) => [(F.heightAt(x + e, z) - F.heightAt(x - e, z)) / (2 * e), (F.heightAt(x, z + e) - F.heightAt(x, z - e)) / (2 * e)];   // points uphill
  F.slopeDeg = (x, z, e = 1) => { const g = F.grad(x, z, e); return Math.atan(Math.hypot(g[0], g[1])) * 180 / Math.PI; };
  // how far the ground under a round base of radius r departs from level (feet, highest minus lowest)
  F.relief = (x, z, r) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 8; a++) { const y = F.heightAt(x + Math.cos(a * Math.PI / 4) * r, z + Math.sin(a * Math.PI / 4) * r); lo = Math.min(lo, y); hi = Math.max(hi, y); } const c = F.heightAt(x, z); return Math.max(hi, c) - Math.min(lo, c); };
  return F;
}
