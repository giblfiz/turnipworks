// Mesh plumbing for the Import Lab: flat typed arrays in, flat typed arrays out. No three.js objects in here.
//   weldPositions   corners that share an exact position become one vertex (STL has no shared vertices at all)
//   faceNormals     unit normal + area per triangle
//   creasedNormals  one normal per CORNER: smooth across soft edges, hard across edges sharper than the crease angle
//   faceAdjacency   the triangle across each edge (or -1)
//   areaSampler     seeded random points spread evenly over a surface

// corners: Float32Array of n*3 positions. Returns the unique positions and, per corner, which unique vertex it is.
export function weldPositions(corners, n = corners.length / 3) {
  const P = new Float32Array(corners.length);
  for (let i = 0; i < corners.length; i++) P[i] = corners[i] + 0; // -0 -> +0 so the bit patterns match
  const bits = new Uint32Array(P.buffer);
  let size = 1; while (size < n * 2) size <<= 1;
  const mask = size - 1, table = new Int32Array(size).fill(-1);
  const remap = new Uint32Array(n), out = new Float32Array(n * 3);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const a = bits[3 * i], b = bits[3 * i + 1], c = bits[3 * i + 2];
    let h = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) & mask;
    for (; ;) {
      const j = table[h];
      if (j < 0) { table[h] = count; out[3 * count] = P[3 * i]; out[3 * count + 1] = P[3 * i + 1]; out[3 * count + 2] = P[3 * i + 2]; remap[i] = count++; break; }
      const ob = j * 3;
      if (out[ob] === P[3 * i] && out[ob + 1] === P[3 * i + 1] && out[ob + 2] === P[3 * i + 2]) { remap[i] = j; break; }
      h = (h + 1) & mask;
    }
  }
  return { pos: out.slice(0, count * 3), remap, count };
}

// unit face normals (nt*3) and areas (nt). A degenerate triangle gets a zero normal and zero area.
export function faceNormals(pos, idx) {
  const nt = idx.length / 3, fn = new Float32Array(nt * 3), area = new Float32Array(nt);
  for (let f = 0; f < nt; f++) {
    const a = idx[3 * f] * 3, b = idx[3 * f + 1] * 3, c = idx[3 * f + 2] * 3;
    const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz);
    area[f] = l / 2;
    if (l > 0) { fn[3 * f] = nx / l; fn[3 * f + 1] = ny / l; fn[3 * f + 2] = nz / l; }
  }
  return { fn, area };
}

// Per-corner normals (nt*9). Around each vertex, a corner averages (area-weighted) the faces within `creaseDeg` of its
// own face, so a dragon's flank is smooth and a cube's edges stay hard.
export function creasedNormals(pos, idx, creaseDeg = 50, fnIn = null) {
  const nt = idx.length / 3, nv = pos.length / 3;
  const { fn, area } = fnIn || faceNormals(pos, idx);
  const start = new Uint32Array(nv + 1);
  for (let i = 0; i < idx.length; i++) start[idx[i] + 1]++;
  for (let v = 0; v < nv; v++) start[v + 1] += start[v];
  const fill = start.slice(0, nv), faces = new Uint32Array(idx.length);
  for (let f = 0; f < nt; f++) for (let k = 0; k < 3; k++) faces[fill[idx[3 * f + k]]++] = f;
  const cos = Math.cos(creaseDeg * Math.PI / 180), out = new Float32Array(nt * 9);
  for (let f = 0; f < nt; f++) {
    const fx = fn[3 * f], fy = fn[3 * f + 1], fz = fn[3 * f + 2];
    for (let k = 0; k < 3; k++) {
      const v = idx[3 * f + k];
      let x = 0, y = 0, z = 0;
      for (let j = start[v]; j < start[v + 1]; j++) {
        const g = faces[j], gx = fn[3 * g], gy = fn[3 * g + 1], gz = fn[3 * g + 2];
        if (g === f || fx * gx + fy * gy + fz * gz >= cos) { const w = area[g]; x += gx * w; y += gy * w; z += gz * w; }
      }
      const l = Math.hypot(x, y, z), o = 9 * f + 3 * k;
      if (l > 0) { out[o] = x / l; out[o + 1] = y / l; out[o + 2] = z / l; } else if (fx || fy || fz) { out[o] = fx; out[o + 1] = fy; out[o + 2] = fz; } else out[o + 1] = 1; // a zero-area sliver: any unit normal
    }
  }
  return out;
}

// nb[3f+k] = the face across edge (corner k -> corner k+1) of face f, or -1 (border, or a third face on the same edge)
export function faceAdjacency(idx, nv) {
  const nt = idx.length / 3, nb = new Int32Array(idx.length).fill(-1), seen = new Map();
  for (let f = 0; f < nt; f++) for (let k = 0; k < 3; k++) {
    const a = idx[3 * f + k], b = idx[3 * f + (k + 1) % 3];
    const key = a < b ? a * nv + b : b * nv + a, other = seen.get(key);
    if (other === undefined) seen.set(key, 3 * f + k);
    else if (other >= 0) { nb[3 * f + k] = (other / 3) | 0; nb[other] = f; seen.set(key, -1); }
  }
  return nb;
}

export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// sample(out) writes a random point on the surface (uniform by area) into out[0..2]
export function areaSampler(pos, idx, seed = 1) {
  const { area } = faceNormals(pos, idx), nt = area.length, cum = new Float64Array(nt);
  let s = 0; for (let f = 0; f < nt; f++) { s += area[f]; cum[f] = s; }
  const rnd = mulberry32(seed);
  return (out) => {
    const r = rnd() * s; let lo = 0, hi = nt - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const a = idx[3 * lo] * 3, b = idx[3 * lo + 1] * 3, c = idx[3 * lo + 2] * 3, w = 1 - u - v;
    out[0] = pos[a] * w + pos[b] * u + pos[c] * v; out[1] = pos[a + 1] * w + pos[b + 1] * u + pos[c + 1] * v; out[2] = pos[a + 2] * w + pos[b + 2] * u + pos[c + 2] * v;
    return out;
  };
}

// Smoothing groups, for the simplified mesh. creasedNormals() above judges each corner against its own face, which is
// not transitive: three faces fanning round a vertex can each get a slightly different normal with no real crease
// between them, and a baked normal map then shows every such edge as a thin line. Here faces round a vertex are
// joined across every edge softer than the crease angle, and each joined fan shares ONE normal, so the shading normal
// only breaks at true creases. Returns { normals (nt*9), group (nt*3: an id per corner, equal ids share a normal) }.
export function groupedNormals(pos, idx, creaseDeg = 50) {
  const nt = idx.length / 3, nv = pos.length / 3, { fn, area } = faceNormals(pos, idx), nb = faceAdjacency(idx, nv);
  const parent = new Uint32Array(nt * 3); for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const cornerAt = (g, v) => (idx[3 * g] === v ? 3 * g : idx[3 * g + 1] === v ? 3 * g + 1 : 3 * g + 2);
  const cos = Math.cos(creaseDeg * Math.PI / 180);
  for (let f = 0; f < nt; f++) for (let k = 0; k < 3; k++) {
    const g = nb[3 * f + k]; if (g < f) continue; // -1, or already joined from the other side
    if (fn[3 * f] * fn[3 * g] + fn[3 * f + 1] * fn[3 * g + 1] + fn[3 * f + 2] * fn[3 * g + 2] < cos) continue;
    const k2 = (k + 1) % 3, a = find(3 * f + k), b = find(cornerAt(g, idx[3 * f + k])); if (a !== b) parent[a] = b;
    const c = find(3 * f + k2), d = find(cornerAt(g, idx[3 * f + k2])); if (c !== d) parent[c] = d;
  }
  const sum = new Float32Array(nt * 9), group = new Uint32Array(nt * 3), normals = new Float32Array(nt * 9);
  for (let f = 0; f < nt; f++) for (let k = 0; k < 3; k++) {
    const r = find(3 * f + k); group[3 * f + k] = r;
    // weight by area and by the corner's angle, so a long thin triangle does not drag the normal
    const v = idx[3 * f + k] * 3, p = idx[3 * f + (k + 1) % 3] * 3, q = idx[3 * f + (k + 2) % 3] * 3;
    const ax = pos[p] - pos[v], ay = pos[p + 1] - pos[v + 1], az = pos[p + 2] - pos[v + 2], bx = pos[q] - pos[v], by = pos[q + 1] - pos[v + 1], bz = pos[q + 2] - pos[v + 2];
    const la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz), w = la && lb ? Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (la * lb)))) : 0;
    sum[3 * r] += fn[3 * f] * w; sum[3 * r + 1] += fn[3 * f + 1] * w; sum[3 * r + 2] += fn[3 * f + 2] * w;
  }
  for (let i = 0; i < nt * 3; i++) {
    const r = group[i], l = Math.hypot(sum[3 * r], sum[3 * r + 1], sum[3 * r + 2]), f = (i / 3) | 0;
    if (l > 0) { normals[3 * i] = sum[3 * r] / l; normals[3 * i + 1] = sum[3 * r + 1] / l; normals[3 * i + 2] = sum[3 * r + 2] / l; }
    else if (fn[3 * f] || fn[3 * f + 1] || fn[3 * f + 2]) { normals[3 * i] = fn[3 * f]; normals[3 * i + 1] = fn[3 * f + 1]; normals[3 * i + 2] = fn[3 * f + 2]; }
    else normals[3 * i + 1] = 1;
  }
  return { normals, group };
}
