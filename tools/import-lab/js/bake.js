// Bake: paint the ORIGINAL's surface detail onto the simplified mesh's texture.
// For every texel of the simplified mesh we stand on its surface, look along its normal (both ways) for the original
// surface, and write down which way the original faces there, expressed in the simplified mesh's own tangent frame
// (a tangent-space normal map). Colour, if the original has any, is read at the same spot.
//
// The tangent frame is explicit: every vertex of the simplified mesh carries a tangent (its chart's u direction laid
// into the vertex's tangent plane, glTF TANGENT with w = +1), and the baker rebuilds the frame exactly as three.js does
// when a mesh has tangents: T and B = cross(N, T) per vertex, interpolated, normalised per pixel. A first version used
// three's derivative frame (no tangents stored); that frame jumps at every triangle edge, and texture filtering across
// the jump drew the whole triangle mesh onto the model as thin lines (LAB_NOTES 2026-10-05).
import * as THREE from 'three';

const SRGB2LIN = new Float32Array(256), tmp = new THREE.Color();
for (let i = 0; i < 256; i++) { const c = i / 255; SRGB2LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const lin2srgb = (c) => { c = c < 0 ? 0 : c > 1 ? 1 : c; return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); };

// colour of the original at (face, barycentrics): material colour x texture x vertex colour, linear RGB into out
export function sampleHighColor(high, f, b0, b1, b2, out) {
  const C = high.colour, m = C.mats[C.matId[f]];
  let r = m.rgb[0], g = m.rgb[1], b = m.rgb[2];
  if (m.img && C.uv) {
    const o = 6 * f;
    let u = C.uv[o] * b0 + C.uv[o + 2] * b1 + C.uv[o + 4] * b2, v = C.uv[o + 1] * b0 + C.uv[o + 3] * b1 + C.uv[o + 5] * b2;
    u -= Math.floor(u); v -= Math.floor(v); if (m.img.flipY) v = 1 - v;
    const x = Math.min(m.img.w - 1, (u * m.img.w) | 0), y = Math.min(m.img.h - 1, (v * m.img.h) | 0), p = (y * m.img.w + x) * 4;
    r *= SRGB2LIN[m.img.data[p]]; g *= SRGB2LIN[m.img.data[p + 1]]; b *= SRGB2LIN[m.img.data[p + 2]];
  }
  if (C.col) { const o = 9 * f; r *= C.col[o] * b0 + C.col[o + 3] * b1 + C.col[o + 6] * b2; g *= C.col[o + 1] * b0 + C.col[o + 4] * b1 + C.col[o + 7] * b2; b *= C.col[o + 2] * b0 + C.col[o + 5] * b1 + C.col[o + 8] * b2; }
  out[0] = r; out[1] = g; out[2] = b; return out;
}

// barycentrics of point p in triangle f of the original
function baryIn(high, f, px, py, pz, out) {
  const P = high.pos, a = high.idx[3 * f] * 3, b = high.idx[3 * f + 1] * 3, c = high.idx[3 * f + 2] * 3;
  const v0x = P[b] - P[a], v0y = P[b + 1] - P[a + 1], v0z = P[b + 2] - P[a + 2];
  const v1x = P[c] - P[a], v1y = P[c + 1] - P[a + 1], v1z = P[c + 2] - P[a + 2];
  const v2x = px - P[a], v2y = py - P[a + 1], v2z = pz - P[a + 2];
  const d00 = v0x * v0x + v0y * v0y + v0z * v0z, d01 = v0x * v1x + v0y * v1y + v0z * v1z, d11 = v1x * v1x + v1y * v1y + v1z * v1z;
  const d20 = v2x * v0x + v2y * v0y + v2z * v0z, d21 = v2x * v1x + v2y * v1y + v2z * v1z, den = d00 * d11 - d01 * d01;
  if (Math.abs(den) < 1e-30) { out[0] = 1; out[1] = 0; out[2] = 0; return out; }
  let v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
  v = v < 0 ? 0 : v > 1 ? 1 : v; w = w < 0 ? 0 : w > 1 ? 1 : w;
  out[0] = Math.max(0, 1 - v - w); out[1] = v; out[2] = w; return out;
}

// low: { pos, nrm, tan, uv, idx } (final split vertices; tan = unit tangent per vertex). Returns { normal: Uint8ClampedArray RGBA, color?: RGBA, stats }
export async function bake({ low, high, size, maxDist, wantColor, onProgress = () => { } }) {
  const S = size, N = S * S;
  const nrm = new Uint8ClampedArray(N * 4), col = wantColor ? new Uint8ClampedArray(N * 4) : null, mask = new Uint8Array(N);
  const ray = new THREE.Ray(), fwd = new THREE.Vector3(), target = {}, bc = [0, 0, 0], rgb = [0, 0, 0];
  const { pos, uv, idx } = low, LN = low.nrm, HN = high.cn, bvh = high.bvh, nt = idx.length / 3;
  const LT = low.tan, nvl = pos.length / 3, LB = new Float32Array(nvl * 3);
  for (let v = 0; v < nvl; v++) { // B = normalize(cross(N, T)), per vertex, as in three's vertex shader
    const nx = LN[3 * v], ny = LN[3 * v + 1], nz = LN[3 * v + 2], tx = LT[3 * v], ty = LT[3 * v + 1], tz = LT[3 * v + 2];
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx, l = Math.hypot(bx, by, bz) || 1;
    LB[3 * v] = bx / l; LB[3 * v + 1] = by / l; LB[3 * v + 2] = bz / l;
  }
  let covered = 0, missed = 0, rays = 0, last = performance.now();
  for (let f = 0; f < nt; f++) {
    const ia = idx[3 * f], ib = idx[3 * f + 1], ic = idx[3 * f + 2];
    const x0 = uv[2 * ia] * S, y0 = uv[2 * ia + 1] * S, x1 = uv[2 * ib] * S, y1 = uv[2 * ib + 1] * S, x2 = uv[2 * ic] * S, y2 = uv[2 * ic + 1] * S;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    const pax = pos[3 * ia], pay = pos[3 * ia + 1], paz = pos[3 * ia + 2];
    const e1x = pos[3 * ib] - pax, e1y = pos[3 * ib + 1] - pay, e1z = pos[3 * ib + 2] - paz;
    const e2x = pos[3 * ic] - pax, e2y = pos[3 * ic + 1] - pay, e2z = pos[3 * ic + 2] - paz;
    const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2) - 0.5)), maxx = Math.min(S - 1, Math.ceil(Math.max(x0, x1, x2) - 0.5));
    const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2) - 0.5)), maxy = Math.min(S - 1, Math.ceil(Math.max(y0, y1, y2) - 0.5));
    const slack = -0.75 / Math.sqrt(Math.abs(area)); // take texels just outside the edge too: bilinear filtering reads them
    for (let py = miny; py <= maxy; py++) for (let px = minx; px <= maxx; px++) {
      const t = py * S + px; if (mask[t] === 2) continue;
      const cx = px + 0.5, cy = py + 0.5;
      let w1 = ((cx - x0) * (y2 - y0) - (x2 - x0) * (cy - y0)) / area, w2 = ((x1 - x0) * (cy - y0) - (cx - x0) * (y1 - y0)) / area, w0 = 1 - w1 - w2;
      if (w0 < slack || w1 < slack || w2 < slack) continue;
      const inside = w0 >= 0 && w1 >= 0 && w2 >= 0;
      if (!inside && mask[t]) continue; // an edge texel someone already filled
      if (!inside) { w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2); const s = w0 + w1 + w2; w0 /= s; w1 /= s; w2 /= s; }
      const Px = pax + e1x * w1 + e2x * w2, Py = pay + e1y * w1 + e2y * w2, Pz = paz + e1z * w1 + e2z * w2;
      let Nx = LN[3 * ia] * w0 + LN[3 * ib] * w1 + LN[3 * ic] * w2, Ny = LN[3 * ia + 1] * w0 + LN[3 * ib + 1] * w1 + LN[3 * ic + 1] * w2, Nz = LN[3 * ia + 2] * w0 + LN[3 * ib + 2] * w1 + LN[3 * ic + 2] * w2;
      const nl = Math.hypot(Nx, Ny, Nz) || 1; Nx /= nl; Ny /= nl; Nz /= nl;
      // find the original surface along +N and -N; nearest hit whose face looks the same way wins
      let hf = -1, hx = 0, hy = 0, hz = 0, hd = Infinity;
      for (let dir = 1; dir >= -1; dir -= 2) {
        ray.origin.set(Px, Py, Pz); ray.direction.set(Nx * dir, Ny * dir, Nz * dir); rays++;
        const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxDist);
        if (h && h.distance < hd && h.face.normal.x * Nx + h.face.normal.y * Ny + h.face.normal.z * Nz > 0.1) { hf = h.faceIndex; hx = h.point.x; hy = h.point.y; hz = h.point.z; hd = h.distance; }
      }
      if (hf < 0) { // no luck along the normal: take the nearest point of the original instead
        const c = bvh.closestPointToPoint(fwd.set(Px, Py, Pz), target, 0, maxDist * 4);
        if (c) { hf = c.faceIndex; hx = c.point.x; hy = c.point.y; hz = c.point.z; }
      }
      let ox = Nx, oy = Ny, oz = Nz;
      if (hf >= 0) {
        baryIn(high, hf, hx, hy, hz, bc);
        const o = 9 * hf;
        ox = HN[o] * bc[0] + HN[o + 3] * bc[1] + HN[o + 6] * bc[2]; oy = HN[o + 1] * bc[0] + HN[o + 4] * bc[1] + HN[o + 7] * bc[2]; oz = HN[o + 2] * bc[0] + HN[o + 5] * bc[1] + HN[o + 8] * bc[2];
        if (ox * Nx + oy * Ny + oz * Nz < 0) { ox = -ox; oy = -oy; oz = -oz; } // inside-out original (bad winding): face the same way
        if (col) { sampleHighColor(high, hf, bc[0], bc[1], bc[2], rgb); col[4 * t] = lin2srgb(rgb[0]); col[4 * t + 1] = lin2srgb(rgb[1]); col[4 * t + 2] = lin2srgb(rgb[2]); col[4 * t + 3] = 255; }
      } else { missed++; if (col) { col[4 * t] = col[4 * t + 1] = col[4 * t + 2] = 128; col[4 * t + 3] = 255; } }
      // the frame three.js builds from vertex tangents: interpolate T and B, normalise each
      let Tx = LT[3 * ia] * w0 + LT[3 * ib] * w1 + LT[3 * ic] * w2, Ty = LT[3 * ia + 1] * w0 + LT[3 * ib + 1] * w1 + LT[3 * ic + 1] * w2, Tz = LT[3 * ia + 2] * w0 + LT[3 * ib + 2] * w1 + LT[3 * ic + 2] * w2;
      let Bx = LB[3 * ia] * w0 + LB[3 * ib] * w1 + LB[3 * ic] * w2, By = LB[3 * ia + 1] * w0 + LB[3 * ib + 1] * w1 + LB[3 * ic + 1] * w2, Bz = LB[3 * ia + 2] * w0 + LB[3 * ib + 2] * w1 + LB[3 * ic + 2] * w2;
      const tl = Math.hypot(Tx, Ty, Tz) || 1, bl = Math.hypot(Bx, By, Bz) || 1;
      Tx /= tl; Ty /= tl; Tz /= tl; Bx /= bl; By /= bl; Bz /= bl;
      // solve [T B N] t = o  (inverse of a 3x3 by cofactors)
      const c00 = By * Nz - Bz * Ny, c01 = Bz * Nx - Bx * Nz, c02 = Bx * Ny - By * Nx;
      const d = Tx * c00 + Ty * c01 + Tz * c02;
      let tx = 0, ty = 0, tz = 1;
      if (Math.abs(d) > 1e-12) {
        tx = (ox * c00 + oy * c01 + oz * c02) / d;
        ty = (ox * (Ny * Tz - Nz * Ty) + oy * (Nz * Tx - Nx * Tz) + oz * (Nx * Ty - Ny * Tx)) / d;
        tz = (ox * (Ty * Bz - Tz * By) + oy * (Tz * Bx - Tx * Bz) + oz * (Tx * By - Ty * Bx)) / d;
        if (tz < 0.05) tz = 0.05;
        const l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
      }
      nrm[4 * t] = tx * 127.5 + 127.5; nrm[4 * t + 1] = ty * 127.5 + 127.5; nrm[4 * t + 2] = tz * 127.5 + 127.5; nrm[4 * t + 3] = 255;
      if (!mask[t]) covered++;
      mask[t] = inside ? 2 : 1;
    }
    if ((f & 255) === 0 && performance.now() - last > 120) { onProgress(f / nt); await new Promise(r => setTimeout(r)); last = performance.now(); }
  }
  dilate(nrm, col, mask, S, 12);
  for (let t = 0; t < N; t++) if (!mask[t]) { nrm[4 * t] = 128; nrm[4 * t + 1] = 128; nrm[4 * t + 2] = 255; nrm[4 * t + 3] = 255; if (col) { col[4 * t] = col[4 * t + 1] = col[4 * t + 2] = 128; col[4 * t + 3] = 255; } }
  return { normal: nrm, color: col, stats: { covered: covered / N, missed, rays } };
}

// grow the painted texels outward into the gutters so filtering and mip-maps never pick up blank texture
function dilate(a, b, mask, S, rounds) {
  let frontier = [];
  for (let t = 0; t < S * S; t++) if (mask[t]) frontier.push(t);
  for (let r = 0; r < rounds && frontier.length; r++) {
    const next = [];
    for (const t of frontier) {
      const x = t % S, y = (t / S) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0) - (k === 1), ny = y + (k === 2) - (k === 3);
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const u = ny * S + nx; if (mask[u]) continue;
        mask[u] = 3; next.push(u);
        a[4 * u] = a[4 * t]; a[4 * u + 1] = a[4 * t + 1]; a[4 * u + 2] = a[4 * t + 2]; a[4 * u + 3] = 255;
        if (b) { b[4 * u] = b[4 * t]; b[4 * u + 1] = b[4 * t + 1]; b[4 * u + 2] = b[4 * t + 2]; b[4 * u + 3] = 255; }
      }
    }
    frontier = next;
  }
}
