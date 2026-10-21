// Box unwrap: UVs for a simplified mesh, made in milliseconds, so a normal map can be baked onto it.
// Every triangle is projected flat along whichever of the six axis directions it faces most squarely; neighbouring
// triangles that share a direction form a chart; the charts are packed into a square with a gutter between them.
// It is not xatlas (more charts, more seams, roughly half the texture is gutter and gaps), but stretch is bounded
// (a face is never more than ~70 degrees off its projection) and it never fails.
import { faceNormals, faceAdjacency } from './mesh.js';

const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// pos, idx: welded simplified mesh. Returns chart id per face and a UV per corner (nt*6), v measured in texture ROWS
// (row 0 first: the glTF convention, so the texture is used with flipY = false).
export function boxUnwrap(pos, idx, { size = 1024, pad = 3 } = {}) {
  const nt = idx.length / 3, nv = pos.length / 3;
  const { fn } = faceNormals(pos, idx), nb = faceAdjacency(idx, nv);
  const along = (f, c) => fn[3 * f] * AX[c][0] + fn[3 * f + 1] * AX[c][1] + fn[3 * f + 2] * AX[c][2];
  let cls = new Uint8Array(nt);
  for (let f = 0; f < nt; f++) { let best = 0, bv = -2; for (let c = 0; c < 6; c++) { const d = along(f, c); if (d > bv) { bv = d; best = c; } } cls[f] = best; }
  // smooth the labels: a face that two of its three neighbours out-vote joins them, if it still faces that way enough
  for (let it = 0; it < 4; it++) {
    const next = cls.slice();
    for (let f = 0; f < nt; f++) {
      const a = nb[3 * f], b = nb[3 * f + 1], c = nb[3 * f + 2];
      const ca = a < 0 ? 255 : cls[a], cb = b < 0 ? 255 : cls[b], cc = c < 0 ? 255 : cls[c];
      const want = ca === cb || ca === cc ? ca : cb === cc ? cb : 255;
      if (want !== 255 && want !== cls[f] && along(f, want) > 0.35) next[f] = want;
    }
    cls = next;
  }
  const chart = new Int32Array(nt);
  let charts = 0, sizes = [];
  const flood = () => {
    chart.fill(-1); charts = 0; sizes = [];
    const stack = [];
    for (let s = 0; s < nt; s++) {
      if (chart[s] >= 0) continue;
      chart[s] = charts; stack.push(s); let n = 0;
      while (stack.length) { const f = stack.pop(); n++; for (let k = 0; k < 3; k++) { const g = nb[3 * f + k]; if (g >= 0 && chart[g] < 0 && cls[g] === cls[f]) { chart[g] = charts; stack.push(g); } } }
      sizes.push(n); charts++;
    }
  };
  // fold crumbs (charts of a few faces) into a neighbouring chart they can still be projected along
  for (let round = 0; round < 3; round++) {
    flood();
    const members = Array.from({ length: charts }, () => null);
    for (let f = 0; f < nt; f++) if (sizes[chart[f]] < 8) (members[chart[f]] ||= []).push(f);
    let moved = 0;
    for (let c = 0; c < charts; c++) {
      const m = members[c]; if (!m) continue;
      const votes = new Map();
      for (const f of m) for (let k = 0; k < 3; k++) { const g = nb[3 * f + k]; if (g >= 0 && chart[g] !== c && sizes[chart[g]] >= sizes[c]) votes.set(cls[g], (votes.get(cls[g]) || 0) + 1); }
      let best = -1, bv = 0;
      for (const [k, v] of votes) if (v > bv && m.every(f => along(f, k) > 0.2)) { bv = v; best = k; }
      if (best >= 0) { for (const f of m) cls[f] = best; moved++; }
    }
    if (!moved) break;
  }
  flood();

  // project each chart; record its rectangle (longer side along u)
  const cu = new Float32Array(nt * 3), cv = new Float32Array(nt * 3);
  const rect = new Float64Array(charts * 4).fill(0); // umin, vmin, w, h
  const lo = new Float64Array(charts * 2).fill(Infinity), hi = new Float64Array(charts * 2).fill(-Infinity);
  const chartCls = new Uint8Array(charts);
  for (let f = 0; f < nt; f++) {
    const c = chart[f], k = cls[f], ax = k >> 1; chartCls[c] = k;
    const ua = (ax + 1) % 3, va = (ax + 2) % 3, sign = k & 1 ? -1 : 1;
    for (let j = 0; j < 3; j++) {
      const p = idx[3 * f + j] * 3, u = pos[p + ua] * sign, v = pos[p + va];
      cu[3 * f + j] = u; cv[3 * f + j] = v;
      if (u < lo[2 * c]) lo[2 * c] = u; if (u > hi[2 * c]) hi[2 * c] = u;
      if (v < lo[2 * c + 1]) lo[2 * c + 1] = v; if (v > hi[2 * c + 1]) hi[2 * c + 1] = v;
    }
  }
  const turn = new Uint8Array(charts);
  let maxDim = 0;
  for (let c = 0; c < charts; c++) {
    let w = hi[2 * c] - lo[2 * c], h = hi[2 * c + 1] - lo[2 * c + 1];
    if (h > w) { turn[c] = 1; [w, h] = [h, w]; }
    rect[4 * c + 2] = w; rect[4 * c + 3] = h; maxDim = Math.max(maxDim, w);
  }
  const order = Array.from({ length: charts }, (_, i) => i).sort((a, b) => rect[4 * b + 3] - rect[4 * a + 3]);
  const px = new Float32Array(charts), py = new Float32Array(charts);
  const tryPack = (s, gutter) => { // shelves, tallest first
    let x = 0, y = 0, shelf = 0;
    for (const c of order) {
      const W = Math.ceil(rect[4 * c + 2] * s) + 2 * gutter + 1, H = Math.ceil(rect[4 * c + 3] * s) + 2 * gutter + 1;
      if (W > size) return false;
      if (x + W > size) { x = 0; y += shelf; shelf = 0; }
      if (y + H > size) return false;
      px[c] = x + gutter + 0.5; py[c] = y + gutter + 0.5; x += W; if (H > shelf) shelf = H;
    }
    return true;
  };
  let gutter = pad, scale = 0;
  for (; gutter >= 0; gutter--) {
    let a = 0, b = (size - 2 * gutter - 2) / Math.max(maxDim, 1e-12);
    if (!tryPack(b * 1e-6, gutter)) continue; // too many charts for this gutter even at zero size
    for (let i = 0; i < 28; i++) { const m = (a + b) / 2; if (tryPack(m, gutter)) a = m; else b = m; }
    scale = a; tryPack(scale, gutter); break;
  }
  if (gutter < 0) throw new Error(`box unwrap: ${charts} charts do not fit a ${size}px texture`);
  const uv = new Float32Array(nt * 6);
  let used = 0;
  for (let f = 0; f < nt; f++) {
    const c = chart[f];
    for (let j = 0; j < 3; j++) {
      let u = cu[3 * f + j] - lo[2 * c], v = cv[3 * f + j] - lo[2 * c + 1];
      if (turn[c]) [u, v] = [v, u];
      uv[6 * f + 2 * j] = (px[c] + u * scale) / size; uv[6 * f + 2 * j + 1] = (py[c] + v * scale) / size;
    }
    const x0 = uv[6 * f], y0 = uv[6 * f + 1], x1 = uv[6 * f + 2], y1 = uv[6 * f + 3], x2 = uv[6 * f + 4], y2 = uv[6 * f + 5];
    used += Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2;
  }
  // the direction in space that +u runs along, per chart (the baker lays it into each vertex's tangent plane)
  const chartU = new Float32Array(charts * 3), chartV = new Float32Array(charts * 3);
  for (let c = 0; c < charts; c++) {
    const k = chartCls[c], ax = k >> 1, ua = (ax + 1) % 3, va = (ax + 2) % 3, sign = k & 1 ? -1 : 1;
    if (turn[c]) { chartU[3 * c + va] = 1; chartV[3 * c + ua] = sign; } else { chartU[3 * c + ua] = sign; chartV[3 * c + va] = 1; }
  }
  return { chart, uv, charts, chartU, chartV, texelsPerUnit: scale, gutter, fill: used };
}
