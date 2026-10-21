// The conversion the Import Lab is here to judge. All of it runs in this browser tab; nothing is uploaded.
//   ingest(root)            any loaded model -> one welded triangle soup + a BVH + (if it has any) its colour sources
//   convert(high, options)  weld -> simplify (meshoptimizer) -> normals -> [box unwrap -> bake normal map (+ colour)]
//                           -> export a real GLB -> measure it -> measure the surface error
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshBVH } from 'three-mesh-bvh';
import { MeshoptSimplifier } from '../vendor/meshopt_simplifier-1.3.0.js';
import { weldPositions, creasedNormals, groupedNormals, faceNormals, areaSampler } from './mesh.js';
import { boxUnwrap } from './unwrap.js';
import { bake, sampleHighColor } from './bake.js';

export const CREASE_DEG = 50, LOW_CREASE_BAKED = 80;
const tick = () => new Promise(r => setTimeout(r));
const lin2srgb = (c) => { c = c < 0 ? 0 : c > 1 ? 1 : c; return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };

function imageData(tex, cap = 2048) {
  const img = tex?.image; if (!img || !(img.width > 0)) return null;
  const k = Math.min(1, cap / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(img, 0, 0, w, h); return { data: g.getImageData(0, 0, w, h).data, w, h, flipY: !!tex.flipY }; } catch { return null; }
}

// root: a THREE.Object3D (from GLTFLoader / OBJLoader) or a Mesh wrapping an STL geometry
export async function ingest(root, onStep = () => { }) {
  const t0 = performance.now();
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o); });
  let nt = 0; for (const m of meshes) nt += ((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3) | 0;
  if (!nt) throw new Error('no triangles in this file');
  const anyUV = meshes.some(m => m.geometry.attributes.uv && [].concat(m.material).some(x => x?.map)), anyCol = meshes.some(m => m.geometry.attributes.color);
  const corners = new Float32Array(nt * 9), UV = anyUV ? new Float32Array(nt * 6) : null, COL = anyCol ? new Float32Array(nt * 9).fill(1) : null;
  const matId = new Uint16Array(nt), mats = [], matIndex = new Map();
  const matOf = (m) => {
    if (!matIndex.has(m)) {
      const c = m?.color || new THREE.Color(1, 1, 1);
      matIndex.set(m, mats.length);
      // roughness / metalness: one number each for the converted model. Where the original paints them with a texture
      // (glTF: green = roughness, blue = metalness), take the texture's average; its factor alone would say "all metal".
      let rough = m?.roughness ?? 0.8, metal = m?.metalness ?? 0;
      const avg = (tex, ch) => { const d = imageData(tex, 64); if (!d) return 1; let s = 0; for (let i = ch; i < d.data.length; i += 4) s += d.data[i]; return s / (d.data.length / 4) / 255; };
      if (m?.roughnessMap) rough *= avg(m.roughnessMap, 1);
      if (m?.metalnessMap) metal *= avg(m.metalnessMap, 2);
      mats.push({ rgb: [c.r, c.g, c.b], img: m?.map ? imageData(m.map) : null, rough, metal, area: 0 });
    }
    return matIndex.get(m);
  };
  await onStep('reading triangles');
  let t = 0; const v = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position, I = g.index, A = g.attributes.uv, C = g.attributes.color, M = m.matrixWorld;
    const n = ((I ? I.count : P.count) / 3) | 0;
    const groups = Array.isArray(m.material) && g.groups.length ? g.groups : [{ start: 0, count: n * 3, materialIndex: 0 }];
    for (const grp of groups) {
      const mi = matOf(Array.isArray(m.material) ? m.material[grp.materialIndex] : m.material);
      const f0 = (grp.start / 3) | 0, f1 = Math.min(n, ((grp.start + grp.count) / 3) | 0);
      for (let f = f0; f < f1; f++, t++) {
        matId[t] = mi;
        for (let k = 0; k < 3; k++) {
          const i = I ? I.getX(3 * f + k) : 3 * f + k;
          v.fromBufferAttribute(P, i).applyMatrix4(M);
          corners[9 * t + 3 * k] = v.x; corners[9 * t + 3 * k + 1] = v.y; corners[9 * t + 3 * k + 2] = v.z;
          if (UV && A) { UV[6 * t + 2 * k] = A.getX(i); UV[6 * t + 2 * k + 1] = A.getY(i); }
          if (COL && C) { COL[9 * t + 3 * k] = C.getX(i); COL[9 * t + 3 * k + 1] = C.getY(i); COL[9 * t + 3 * k + 2] = C.getZ(i); }
        }
      }
    }
  }
  nt = t;
  await onStep('welding vertices');
  const w = weldPositions(corners.subarray(0, nt * 9), nt * 3);
  // drop triangles that collapsed to a line or a point
  let idx = new Uint32Array(nt * 3), keep = 0; const kept = new Uint32Array(nt);
  for (let f = 0; f < nt; f++) {
    const a = w.remap[3 * f], b = w.remap[3 * f + 1], c = w.remap[3 * f + 2];
    if (a === b || b === c || a === c) continue;
    idx[3 * keep] = a; idx[3 * keep + 1] = b; idx[3 * keep + 2] = c; kept[keep++] = f;
  }
  const pick = (src, stride) => { if (!src) return null; const out = new Float32Array(keep * stride); for (let i = 0; i < keep; i++) out.set(src.subarray(kept[i] * stride, kept[i] * stride + stride), i * stride); return out; };
  const high = { pos: w.pos, idx: idx.slice(0, keep * 3), nt: keep, nv: w.count, sourceTriangles: nt };
  const fnA = faceNormals(high.pos, high.idx);
  const mid = new Uint16Array(keep); for (let i = 0; i < keep; i++) { mid[i] = matId[kept[i]]; mats[mid[i]].area += fnA.area[i]; }
  const differing = mats.some(m => m.img) || !!COL || mats.some(m => Math.max(Math.abs(m.rgb[0] - mats[0].rgb[0]), Math.abs(m.rgb[1] - mats[0].rgb[1]), Math.abs(m.rgb[2] - mats[0].rgb[2])) > 0.02)
    || Math.min(...mats[0].rgb) < 0.98;
  high.colour = differing ? { uv: pick(UV, 6), col: pick(COL, 9), matId: mid, mats } : null;
  const dom = mats.reduce((a, b) => (b.area > a.area ? b : a), mats[0]);
  high.surface = { rough: dom.rough, metal: dom.metal };
  await onStep('working out normals');
  high.cn = creasedNormals(high.pos, high.idx, CREASE_DEG, fnA);
  await onStep('building the ray-cast index');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(high.pos, 3)); g.setIndex(new THREE.BufferAttribute(high.idx, 1));
  high.bvh = new MeshBVH(g, { indirect: true, maxLeafTris: 8 });
  high.indexed = g;
  g.computeBoundingBox(); high.box = g.boundingBox.clone(); high.diag = high.box.getSize(new THREE.Vector3()).length();
  high.ingestMs = performance.now() - t0;
  return high;
}

// geometry for showing the original with the same creased normals the baker reads
export function highDisplayGeometry(high) {
  const n = high.nt * 3, P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const p = high.idx[i] * 3; P[3 * i] = high.pos[p]; P[3 * i + 1] = high.pos[p + 1]; P[3 * i + 2] = high.pos[p + 2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(high.cn, 3));
  g.boundingBox = high.box.clone(); g.boundingSphere = high.box.getBoundingSphere(new THREE.Sphere());
  return g;
}

function simplify(high, budget) {
  if (high.nt <= budget) return { idx: high.idx, error: 0, how: 'kept as is (already under the budget)' };
  const target = budget * 3;
  let [idx, error] = MeshoptSimplifier.simplify(high.idx, high.pos, 3, target, 1.0);
  let how = 'meshoptimizer simplify';
  if (idx.length > target * 1.15) { // loose shells and open borders can stop it short: allow it to drop specks, then to ignore topology
    const [i2, e2] = MeshoptSimplifier.simplify(high.idx, high.pos, 3, target, 1.0, ['Prune']);
    if (i2.length < idx.length) { idx = i2; error = e2; how = 'meshoptimizer simplify + prune loose specks'; }
  }
  if (idx.length > target * 1.5) {
    const [i3, e3] = MeshoptSimplifier.simplifySloppy(high.idx, high.pos, 3, null, target, 1.0);
    if (i3.length && i3.length < idx.length) { idx = i3; error = e3; how = 'meshoptimizer sloppy simplify (the model is in too many loose pieces for the careful one)'; }
  }
  return { idx, error, how };
}

function rgbaTexture(data, size, srgb) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').putImageData(new ImageData(data, size, size), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export async function exportGLB(object) {
  return new GLTFExporter().parseAsync(object, { binary: true });
}

// options: { budget, bake, texSize }. Returns { mesh (THREE.Mesh, model space), glb (ArrayBuffer), stats }
export async function convert(high, { budget, bake: wantBake, texSize }, onStep = () => { }) {
  await MeshoptSimplifier.ready;
  const stats = { budget, bake: wantBake, texSize: wantBake ? texSize : null, phases: {} };
  const T0 = performance.now(); let tp = T0;
  const phase = (name) => { const now = performance.now(); stats.phases[name] = Math.round(now - tp); tp = now; };

  await onStep('simplifying');
  const s = simplify(high, budget);
  // compact: only the vertices the simplified mesh still uses
  const map = new Int32Array(high.nv).fill(-1); let nv = 0;
  const li = new Uint32Array(s.idx.length);
  for (let i = 0; i < s.idx.length; i++) { const v = s.idx[i]; if (map[v] < 0) map[v] = nv++; li[i] = map[v]; }
  const lp = new Float32Array(nv * 3);
  for (let v = 0; v < high.nv; v++) if (map[v] >= 0) { lp[3 * map[v]] = high.pos[3 * v]; lp[3 * map[v] + 1] = high.pos[3 * v + 1]; lp[3 * map[v] + 2] = high.pos[3 * v + 2]; }
  const nt = li.length / 3;
  stats.triangles = nt; stats.simplifier = s.how; stats.simplifyError = s.error;
  phase('simplify');

  await onStep('recomputing normals');
  // a baked model wants smooth shading normals except at true hard edges (the map carries the rest); unbaked keeps the tighter crease
  const gn = groupedNormals(lp, li, wantBake ? LOW_CREASE_BAKED : CREASE_DEG), cn = gn.normals;
  let un = null;
  if (wantBake) { await onStep('unwrapping'); un = boxUnwrap(lp, li, { size: texSize, pad: texSize >= 2048 ? 4 : 3 }); stats.charts = un.charts; stats.texelsPerUnit = un.texelsPerUnit; stats.uvFill = un.fill; }
  // final vertices: split where the chart or the normal differs
  const key = new Map(), P = [], Nn = [], U = [], Tn = [], idx = new Uint32Array(nt * 3);
  for (let f = 0; f < nt; f++) for (let k = 0; k < 3; k++) {
    const v = li[3 * f + k], o = 9 * f + 3 * k;
    const id = `${v}:${un ? un.chart[f] : 0}:${gn.group[3 * f + k]}`;
    let n = key.get(id);
    if (n === undefined) { n = P.length / 3; key.set(id, n); P.push(lp[3 * v], lp[3 * v + 1], lp[3 * v + 2]); Nn.push(cn[o], cn[o + 1], cn[o + 2]); if (un) {
        U.push(un.uv[6 * f + 2 * k], un.uv[6 * f + 2 * k + 1]);
        // tangent: the chart's u direction with the part along the normal removed (its v direction if that leaves nothing)
        const c = 3 * un.chart[f], nx = cn[o], ny = cn[o + 1], nz = cn[o + 2];
        let d = un.chartU[c] * nx + un.chartU[c + 1] * ny + un.chartU[c + 2] * nz, tx = un.chartU[c] - d * nx, ty = un.chartU[c + 1] - d * ny, tz = un.chartU[c + 2] - d * nz, l = Math.hypot(tx, ty, tz);
        if (l < 0.05) { d = un.chartV[c] * nx + un.chartV[c + 1] * ny + un.chartV[c + 2] * nz; tx = un.chartV[c] - d * nx; ty = un.chartV[c + 1] - d * ny; tz = un.chartV[c + 2] - d * nz; l = Math.hypot(tx, ty, tz) || 1; }
        Tn.push(tx / l, ty / l, tz / l);
      }
    }
    idx[3 * f + k] = n;
  }
  const low = { pos: new Float32Array(P), nrm: new Float32Array(Nn), uv: un ? new Float32Array(U) : null, tan: un ? new Float32Array(Tn) : null, idx };
  stats.vertices = low.pos.length / 3;
  phase('normals_unwrap');

  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: high.surface.rough, metalness: high.surface.metal });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(low.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(low.nrm, 3));
  g.setIndex(new THREE.BufferAttribute(stats.vertices > 65535 ? idx : new Uint16Array(idx), 1));
  if (wantBake) {
    g.setAttribute('uv', new THREE.BufferAttribute(low.uv, 2));
    const t4 = new Float32Array(stats.vertices * 4); for (let v = 0; v < stats.vertices; v++) { t4[4 * v] = low.tan[3 * v]; t4[4 * v + 1] = low.tan[3 * v + 1]; t4[4 * v + 2] = low.tan[3 * v + 2]; t4[4 * v + 3] = 1; }
    g.setAttribute('tangent', new THREE.BufferAttribute(t4, 4));
    const b = await bake({ low, high, size: texSize, maxDist: high.diag * 0.03, wantColor: !!high.colour, onProgress: (p) => onStep(`baking the normal map ${Math.round(p * 100)}%`) });
    mat.normalMap = rgbaTexture(b.normal, texSize, false);
    if (b.color) mat.map = rgbaTexture(b.color, texSize, true);
    stats.bakeCoverage = b.stats.covered; stats.bakeMissed = b.stats.missed; stats.bakeRays = b.stats.rays;
    phase('bake');
  } else if (high.colour) { // no texture: carry colour on the vertices (nearest point of the original)
    await onStep('carrying colour to the vertices');
    const C = new Float32Array(stats.vertices * 3), p = new THREE.Vector3(), hit = {}, bc = [0, 0, 0], rgb = [0, 0, 0];
    for (let v = 0; v < stats.vertices; v++) {
      const c = high.bvh.closestPointToPoint(p.set(low.pos[3 * v], low.pos[3 * v + 1], low.pos[3 * v + 2]), hit);
      const f = c.faceIndex, a = high.idx[3 * f] * 3, b = high.idx[3 * f + 1] * 3, cc = high.idx[3 * f + 2] * 3;
      THREE.Triangle.getBarycoord(c.point, new THREE.Vector3(high.pos[a], high.pos[a + 1], high.pos[a + 2]), new THREE.Vector3(high.pos[b], high.pos[b + 1], high.pos[b + 2]), new THREE.Vector3(high.pos[cc], high.pos[cc + 1], high.pos[cc + 2]), p);
      sampleHighColor(high, f, p.x, p.y, p.z, rgb); C[3 * v] = rgb[0]; C[3 * v + 1] = rgb[1]; C[3 * v + 2] = rgb[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); mat.vertexColors = true;
    phase('vertex_colour');
  }
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'converted';

  await onStep('writing the GLB');
  const glb = await exportGLB(mesh);
  stats.glbBytes = glb.byteLength;
  phase('export');
  stats.ms = Math.round(performance.now() - T0); // everything a real import would do; the measurements below are extra
  // texture cost: what the PNGs inside the GLB weigh, and what the same textures would weigh as WebP (three's exporter
  // only writes PNG / JPEG, so the WebP figure is the GLB with its textures re-encoded, not a second file)
  const geomBytes = low.pos.byteLength + low.nrm.byteLength + (low.uv ? low.uv.byteLength + stats.vertices * 16 : 0) + g.index.array.byteLength + (g.attributes.color ? g.attributes.color.array.byteLength : 0);
  stats.geometryBytes = geomBytes; stats.textureBytes = Math.max(0, stats.glbBytes - geomBytes); stats.glbBytesWebp = null;
  if (wantBake) {
    const blob = (c, type, q) => new Promise(r => c.toBlob(b => r(b ? b.size : 0), type, q));
    let png = 0, webp = 0;
    for (const t of [mat.normalMap, mat.map]) if (t) { png += await blob(t.image, 'image/png'); webp += await blob(t.image, 'image/webp', 0.9); }
    if (webp) stats.glbBytesWebp = stats.glbBytes - png + webp;
    stats.textureBytes = png;
  }

  await onStep('measuring the surface error');
  stats.error = surfaceError(high, lp, li);
  phase('measure');
  await tick();
  return { mesh, glb, stats, low };
}

// two-sided distance between the surfaces, 20,000 random points each way, in model units
export function surfaceError(high, lp, li, samples = 20000) {
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setIndex(new THREE.BufferAttribute(li, 1));
  const lbvh = new MeshBVH(lg, { indirect: true });
  const p = [0, 0, 0], v = new THREE.Vector3(), hit = {};
  const run = (sampler, bvh) => { let sum = 0, max = 0, sq = 0; for (let i = 0; i < samples; i++) { sampler(p); const d = bvh.closestPointToPoint(v.set(p[0], p[1], p[2]), hit).distance; sum += d; sq += d * d; if (d > max) max = d; } return { mean: sum / samples, rms: Math.sqrt(sq / samples), max }; };
  const a = run(areaSampler(lp, li, 7), high.bvh), b = run(areaSampler(high.pos, high.idx, 11), lbvh);
  return { mean: (a.mean + b.mean) / 2, rms: Math.max(a.rms, b.rms), max: Math.max(a.max, b.max), lowToHigh: a, highToLow: b };
}

export { lin2srgb };
