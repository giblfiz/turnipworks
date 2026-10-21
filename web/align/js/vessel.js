// Vessel interiors from a top-down height map (Alignment Bench WATER mode, 2026-10-04). Pure: no three.js, no DOM.
// The bench casts rays straight down over a grid in the mesh's own frame and hands the surface heights here.
//   basin()      priority-flood from the grid border: W = the level water would rise to before spilling out.
//                Cells where W stands clearly above the surface are pooled; the largest connected pool is the vessel,
//                its spill level is the RIM (a spout notch lowers it, as it should), its low cells the FLOOR.
//   footprint()  the cells under a water level -> an ellipse (moments) or a convex polygon (hull), grown/shrunk,
//                inset from the walls and shifted, in the caller's units (the bench uses feet). With `inside(x, z)`
//                the outline is first shrunk toward its centre until it lies over water cells (no poking through a
//                wall, a handle slot or a spout), then inset.

class Heap { // min-heap of [key, index]
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, i) { const a = this.a; a.push([k, i]); let j = a.length - 1; while (j > 0) { const p = (j - 1) >> 1; if (a[p][0] <= a[j][0]) break; [a[p], a[j]] = [a[j], a[p]]; j = p; } }
  pop() {
    const a = this.a, top = a[0], end = a.pop();
    if (a.length) { a[0] = end; let j = 0; for (;;) { const l = 2 * j + 1, r = l + 1; let m = j; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === j) break; [a[m], a[j]] = [a[j], a[m]]; j = m; } }
    return top;
  }
}

// H: Float64Array(nx*nz) of surface heights (index = iz*nx + ix), NaN = no surface (outside the object)
// minDepth: how far below its spill level a cell must sit to count as pooled (same units as H)
export function basin({ nx, nz, H, floorY, minDepth, minCells = 12 }) {
  const n = nx * nz, Hc = new Float64Array(n), W = new Float64Array(n).fill(NaN), done = new Uint8Array(n), heap = new Heap();
  for (let i = 0; i < n; i++) Hc[i] = Number.isFinite(H[i]) ? H[i] : floorY;
  for (let ix = 0; ix < nx; ix++) for (const iz of [0, nz - 1]) { const i = iz * nx + ix; if (!done[i]) { done[i] = 1; W[i] = Hc[i]; heap.push(W[i], i); } }
  for (let iz = 0; iz < nz; iz++) for (const ix of [0, nx - 1]) { const i = iz * nx + ix; if (!done[i]) { done[i] = 1; W[i] = Hc[i]; heap.push(W[i], i); } }
  while (heap.size) {
    const [w, i] = heap.pop(), ix = i % nx, iz = (i / nx) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = ix + dx, z = iz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
      const j = z * nx + x; if (done[j]) continue;
      done[j] = 1; W[j] = Math.max(Hc[j], w); heap.push(W[j], j);
    }
  }
  // pooled cells, 4-connected components, the largest wins
  const pooled = new Uint8Array(n), comp = new Int32Array(n).fill(-1), comps = [];
  for (let i = 0; i < n; i++) pooled[i] = Number.isFinite(H[i]) && W[i] - Hc[i] > minDepth ? 1 : 0;
  for (let s = 0; s < n; s++) {
    if (!pooled[s] || comp[s] >= 0) continue;
    const id = comps.length, cells = [s]; comp[s] = id;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k], ix = i % nx, iz = (i / nx) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = ix + dx, z = iz + dz; if (x < 0 || z < 0 || x >= nx || z >= nz) continue;
        const j = z * nx + x; if (pooled[j] && comp[j] < 0) { comp[j] = id; cells.push(j); }
      }
    }
    comps.push(cells);
  }
  if (!comps.length) return null;
  const cells = comps.reduce((a, b) => (b.length > a.length ? b : a));
  if (cells.length < Math.max(minCells, n * 0.015)) return null; // pin-holes and texture noise are not a vessel
  const rim = Math.min(...cells.map(i => W[i])); // the level at which this pool spills
  const hs = cells.map(i => Hc[i]).sort((a, b) => a - b);
  const floor = hs[Math.floor(hs.length * 0.1)];
  return { cells, rim, floor, W, Hc, pools: comps.length };
}

// convex hull (Andrew's monotone chain), points [[x, z]], counter-clockwise
export function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const area = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const centroid = (P) => { const n = P.length; return [P.reduce((s, p) => s + p[0], 0) / n, P.reduce((s, p) => s + p[1], 0) / n]; };

// shrink a convex CCW polygon by d (each edge moves inward by d); vertices may move at most 3d (sharp corners)
export function insetConvex(P, d) {
  if (P.length < 3 || !d) return P.map(p => p.slice());
  const n = P.length, lines = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1;
    const nx = -ez / L, nz = ex / L; // inward normal for CCW
    lines.push({ p: [a[0] + nx * d, a[1] + nz * d], v: [ex / L, ez / L] });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const l1 = lines[(i - 1 + n) % n], l2 = lines[i], den = l1.v[0] * l2.v[1] - l1.v[1] * l2.v[0];
    let q;
    if (Math.abs(den) < 1e-9) q = l2.p;
    else { const t = ((l2.p[0] - l1.p[0]) * l2.v[1] - (l2.p[1] - l1.p[1]) * l2.v[0]) / den; q = [l1.p[0] + l1.v[0] * t, l1.p[1] + l1.v[1] * t]; }
    const dx = q[0] - P[i][0], dz = q[1] - P[i][1], m = Math.hypot(dx, dz);
    if (m > 3 * Math.abs(d)) q = [P[i][0] + dx / m * 3 * Math.abs(d), P[i][1] + dz / m * 3 * Math.abs(d)];
    out.push(q);
  }
  return area(out) > 0 ? out : [centroid(P)];
}

// cells: [[x, z]] centres (caller's units), cell: cell size. opts: shape 'ellipse'|'poly', inset (>=0), grow (×), shift [dx, dz]
export function footprint(cells, cell, { shape = 'ellipse', inset = 0, grow = 1, shift = [0, 0], segments = 48, inside = null, within = 0.92 } = {}) {
  if (!cells.length) return null;
  const n = cells.length, cx = cells.reduce((s, c) => s + c[0], 0) / n, cz = cells.reduce((s, c) => s + c[1], 0) / n;
  let sxx = cell * cell / 12, szz = sxx, sxz = 0; // a uniform cell's own spread
  for (const [x, z] of cells) { sxx += (x - cx) ** 2 / n; szz += (z - cz) ** 2 / n; sxz += (x - cx) * (z - cz) / n; }
  // principal axes; a uniformly filled ellipse with semi-axis a has variance a^2 / 4 along it
  const tr = sxx + szz, det = sxx * szz - sxz * sxz, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(1e-12, tr / 2 - disc);
  const rot = Math.abs(sxz) < 1e-12 ? (sxx >= szz ? 0 : Math.PI / 2) : Math.atan2(l1 - sxx, sxz);
  // the largest scale (<= 1) at which the outline's points lie over water cells: `within` of them (92%), so a ragged
  // generated wall can't collapse it (the inset then takes the outline clear of the wall)
  const fit = (pts) => {
    if (!inside) return 1;
    for (let k = 1; k > 0.2; k -= 0.02) {
      const ok = pts.filter(([x, z]) => inside(cx + (x - cx) * k, cz + (z - cz) * k)).length;
      if (ok >= pts.length * within) return k;
    }
    return 0.2;
  };
  const ring = (A, B) => Array.from({ length: segments }, (_, i) => { const t = i / segments * Math.PI * 2, ex = Math.cos(t) * A, ez = Math.sin(t) * B; return [cx + ex * Math.cos(rot) - ez * Math.sin(rot), cz + ex * Math.sin(rot) + ez * Math.cos(rot)]; });
  // containment first, then Harry's size dial (so "bigger" can still push past the fit when he wants it)
  const a0 = 2 * Math.sqrt(l1), b0 = 2 * Math.sqrt(l2), ke = fit(ring(a0, b0));
  const a = Math.max(cell * 0.25, a0 * ke * grow - inset), b = Math.max(cell * 0.25, b0 * ke * grow - inset);
  const c = [cx + shift[0], cz + shift[1]];
  // how full is the pool's box in its principal axes? ~1 for a rectangle (trough, basin), ~0.79 for a disc or oval
  const ux = Math.cos(rot), uz = Math.sin(rot), pu = cells.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), pv = cells.map(([x, z]) => -(x - cx) * uz + (z - cz) * ux);
  const boxFill = n * cell * cell / Math.max(1e-9, (Math.max(...pu) - Math.min(...pu) + cell) * (Math.max(...pv) - Math.min(...pv) + cell));
  const ellipse = { c, r: [a, b], rot, fit: +ke.toFixed(2), boxFill: +boxFill.toFixed(3) };
  let poly;
  if (shape === 'poly') {
    const h = cell / 2, corners = [];
    for (const [x, z] of cells) corners.push([x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]);
    let P = hull(corners);
    // densify the hull's edges so the containment test sees the whole outline, not just the corners
    const dense = P.flatMap((p, i) => { const q = P[(i + 1) % P.length]; return Array.from({ length: 6 }, (_, j) => [p[0] + (q[0] - p[0]) * j / 6, p[1] + (q[1] - p[1]) * j / 6]); });
    const kp = fit(dense); ellipse.fit = +kp.toFixed(2);
    P = insetConvex(P.map(([x, z]) => [cx + (x - cx) * kp * grow, cz + (z - cz) * kp * grow]), inset);
    poly = P.map(([x, z]) => [x + shift[0], z + shift[1]]);
  } else {
    poly = Array.from({ length: segments }, (_, i) => {
      const t = i / segments * Math.PI * 2, ex = Math.cos(t) * a, ez = Math.sin(t) * b;
      return [c[0] + ex * Math.cos(rot) - ez * Math.sin(rot), c[1] + ex * Math.sin(rot) + ez * Math.cos(rot)];
    });
  }
  return { poly, ellipse, cells: n, rect: boxFill > 0.9 };
}
