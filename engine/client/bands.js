// THE BAND BETWEEN STOREYS (Harry 2026-10-24: "for two story rooms, we need a way to fill in the 1ft floor gaps between
// story 1 and 2 walls"). docs/VERTICAL.md "The band between storeys".
//
// A storey is 10 ft: a 9-ft wall and a 1-ft floor slab. So between the top of one storey's wall (9 ft) and the bottom of
// the next one's (10 ft) there is a foot of nothing the wall kit covers. Where an upper room stands on a slab, that foot
// showed the slab's plain timber-brown or grey box edge; in a TALL room (no slab) it was a see-through slot between the
// wall pieces of its two storeys.
//
// THE FILL IS A SLICE OF THE FAMILY'S OWN WALL: the plain wall piece (and the corner or jamb post) that stands above
// the gap, one foot of it, cut out of its mesh and set into the gap under it. No new mesh, no texture, no stretch: the
// pieces are the wall kit's, at the kit's own scale, so the band is the wall's material and style by construction.
// Which foot of the piece: BAND_SLICE (feet up from the piece's base): the piece's own first foot, its sole plate or
// plinth course, so the band reads as the course the storey above stands on (a string-course).
//
// The slice is real geometry (cut on the CPU once per mesh, triangles clipped to the foot), so it is picked, casts and
// takes shadows, sleeps, flies and spawns exactly like any shell piece, with no shader of its own. All the bands of one
// room at one height are merged into one mesh per material (one or two draw calls a room).
import * as THREE from 'three';

export const BAND = 1;        // ft: the gap (= core/height.js SLAB)
const qSlice = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('bandslice')) : NaN; // (?bandslice=N: compare slices; not saved)
export const BAND_SLICE = Number.isFinite(qSlice) && qSlice >= 0 && qSlice <= 8 ? qSlice : 5; // ft up the piece where the foot that fills the gap is cut from (0 = its base)
// the drawn slab stops ON the grid line again where a band is drawn over its edge (2026-10-14 it was pushed out 6 in to
// the wall's outer face, because nothing covered the foot under the upper wall's outer half). Under a band it must stay
// inside the wall: anywhere the band's relief is deeper than the slab's edge (a stone joint), the slab's flat face
// showed through it as a plain patch (measured: rays at 9.5 ft met the slab, not the band, on dressed stone with the
// slab 3 in out). core/height.js SLAB_RIM (the plan the Wall fit bench builds) is unchanged.
export const SLAB_RIM_UNDER_BAND = 0;

const ATTRS = ['position', 'normal', 'uv', 'uv1', 'color'];
const sliceCache = new Map(); // geometry uuid | matrix | range -> { arrays: {name: Float32Array}, sizes }

// the triangles of `geo` under matrix `M`, clipped to y0 <= y <= y1 (in M's frame): plain arrays per attribute
function sliceGeometry(geo, M, y0, y1) {
  const key = `${geo.uuid}|${M.elements.map(v => v.toFixed(4)).join(',')}|${y0}|${y1}`;
  if (sliceCache.has(key)) return sliceCache.get(key);
  const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count : pos.count;
  const names = ATTRS.filter(a => geo.attributes[a]), sizes = Object.fromEntries(names.map(a => [a, geo.attributes[a].itemSize]));
  const N3 = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3();
  // every vertex once: [y, ...attribute values in M's frame]
  const vert = (i) => {
    const out = {};
    for (const a of names) {
      const at = geo.attributes[a], s = at.itemSize;
      if (a === 'position') { v.fromBufferAttribute(at, i).applyMatrix4(M); out[a] = [v.x, v.y, v.z]; }
      else if (a === 'normal') { v.fromBufferAttribute(at, i).applyMatrix3(N3).normalize(); out[a] = [v.x, v.y, v.z]; }
      else { const r = [at.getX(i)]; if (s > 1) r.push(at.getY(i)); if (s > 2) r.push(at.getZ(i)); if (s > 3) r.push(at.getW(i)); out[a] = r; }
    }
    return out;
  };
  const lerp = (p, q, t) => { const o = {}; for (const a of names) o[a] = p[a].map((x, k) => x + (q[a][k] - x) * t); if (o.normal) { const l = Math.hypot(...o.normal) || 1; o.normal = o.normal.map(x => x / l); } return o; };
  const clip = (poly, keep, at) => { // Sutherland–Hodgman against one horizontal plane
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length], ip = keep(p.position[1]), iq = keep(q.position[1]);
      if (ip) out.push(p);
      if (ip !== iq) out.push(lerp(p, q, (at - p.position[1]) / (q.position[1] - p.position[1])));
    }
    return out;
  };
  const acc = Object.fromEntries(names.map(a => [a, []])), cache = new Map(), get = (i) => cache.get(i) || cache.set(i, vert(i)).get(i);
  for (let t = 0; t < n; t += 3) {
    const ia = idx ? idx.getX(t) : t, ib = idx ? idx.getX(t + 1) : t + 1, ic = idx ? idx.getX(t + 2) : t + 2;
    const A = get(ia), B = get(ib), C = get(ic), lo = Math.min(A.position[1], B.position[1], C.position[1]), hi = Math.max(A.position[1], B.position[1], C.position[1]);
    if (hi < y0 || lo > y1) continue;
    let poly = [A, B, C];
    if (lo < y0) poly = clip(poly, (y) => y >= y0, y0);
    if (poly.length >= 3 && hi > y1) poly = clip(poly, (y) => y <= y1, y1);
    for (let k = 1; k + 1 < poly.length; k++) for (const p of [poly[0], poly[k], poly[k + 1]]) for (const a of names) acc[a].push(...p[a]);
  }
  const res = { arrays: Object.fromEntries(names.map(a => [a, new Float32Array(acc[a])])), sizes, count: acc.position.length / 3 };
  sliceCache.set(key, res);
  return res;
}

// ONE MERGED BAND from piece visuals. parts: [{ visual, x, y, z, rot, key }] each a kit visual (look.makeVisual) placed in the
// band's own frame (its group sits at the band's bottom). Each part's foot from BAND_SLICE is cut and moved into
// 0 <= y <= BAND. -> a THREE.Group of one mesh per material (or null: nothing to cut)
export function bandVisual(parts, slice = BAND_SLICE) {
  const byMat = new Map();
  for (const { visual, x, y, z, rot, key } of parts) {
    if (!visual) continue;
    visual.updateMatrixWorld(true); // (an unparented visual: its matrixWorld is its frame from its own root)
    const c = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    visual.traverse(o => {
      if (!o.isMesh || !o.geometry?.attributes?.position || o.userData.halo) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (!mat) return;
      const s = sliceGeometry(o.geometry, o.matrixWorld, slice, slice + BAND); if (!s.count) return; // (in the piece's own frame: cached per mesh)
      const sig = `${mat.uuid}|${Object.keys(s.arrays).join(',')}`;
      (byMat.get(sig) || byMat.set(sig, { mat, cast: o.castShadow, recv: o.receiveShadow, list: [] }).get(sig)).list.push({ s, x, y: y - slice, z, c, sn, key });
    });
  }
  if (!byMat.size) return null;
  const g = new THREE.Group();
  for (const { mat, cast, recv, list } of byMat.values()) {
    const geo = new THREE.BufferGeometry();
    for (const a of Object.keys(list[0].s.arrays)) {
      const total = list.reduce((t, p) => t + p.s.arrays[a].length, 0), buf = new Float32Array(total), k = list[0].s.sizes[a]; let off = 0;
      for (const { s, x, y, z, c, sn } of list) {
        const src = s.arrays[a];
        if (a === 'position' || a === 'normal') for (let i = 0; i < src.length; i += 3) { // turned about y by rot (three's rotation.y), then moved
          const px = src[i], py = src[i + 1], pz = src[i + 2];
          buf[off + i] = c * px + sn * pz + (a === 'position' ? x : 0); buf[off + i + 1] = py + (a === 'position' ? y : 0); buf[off + i + 2] = -sn * px + c * pz + (a === 'position' ? z : 0);
        }
        else buf.set(src, off);
        off += src.length;
      }
      geo.setAttribute(a, new THREE.BufferAttribute(buf, k));
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast !== false; m.receiveShadow = recv !== false; m.userData.band = true;
    // which piece each run of triangles was cut from: a click on the band is a click on the wall or post above it
    let t0 = 0; m.userData.bandKeys = list.map(p => { const n = p.s.count / 3, r = [t0, t0 + n, p.key || null]; t0 += n; return r; });
    g.add(m);
  }
  g.userData.band = true;
  return g;
}

// HOW SOLID A FOOT OF A PIECE IS (for choosing BAND_SLICE, and tests): the share of the piece's face, `len` ft long
// and one foot high from `s0`, that its triangles cover seen straight on (projected along z in the piece's frame; a
// see-through slot or a hole in the mesh is uncovered). `visual` = a kit visual from look.makeVisual.
export function sliceCoverage(visual, s0, len = 5, nx = 60, ny = 12) {
  visual.updateMatrixWorld(true);
  const grid = new Uint8Array(nx * ny);
  visual.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const s = sliceGeometry(o.geometry, o.matrixWorld, s0, s0 + BAND), P = s.arrays.position;
    for (let t = 0; t < P.length; t += 9) {
      const xs = [P[t], P[t + 3], P[t + 6]].map(x => (x / len + 0.5) * nx), ys = [P[t + 1], P[t + 4], P[t + 7]].map(y => (y - s0) / BAND * ny);
      const area = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]); if (Math.abs(area) < 1e-9) continue;
      for (let j = Math.max(0, Math.floor(Math.min(...ys))); j <= Math.min(ny - 1, Math.floor(Math.max(...ys))); j++) for (let i = Math.max(0, Math.floor(Math.min(...xs))); i <= Math.min(nx - 1, Math.floor(Math.max(...xs))); i++) {
        const px = i + 0.5, py = j + 0.5; let inside = true;
        for (let e = 0; e < 3 && inside; e++) { const a = e, b = (e + 1) % 3; if (((xs[b] - xs[a]) * (py - ys[a]) - (ys[b] - ys[a]) * (px - xs[a])) * Math.sign(area) < 0) inside = false; }
        if (inside) grid[j * nx + i] = 1;
      }
    }
  });
  return grid.reduce((t, v) => t + v, 0) / grid.length;
}

// the key of the piece (the wall or post above) a ray hit on a band mesh belongs to, or null
export function bandKeyAt(mesh, faceIndex) {
  for (const [a, b, k] of mesh?.userData?.bandKeys || []) if (faceIndex >= a && faceIndex < b) return k;
  return null;
}
