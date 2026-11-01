// Cave rock chunks -> game-ready GLBs in the canonical piece frame (feet).                                2026-10-25
//
// Run (from anywhere; node 20+):
//   node .claude/worktrees/agent-a19592b24579594f4/experiments/2026-10-25-caves-game/prep_chunks.mjs [id ...]
// No ids = all 8 pieces in kit.json. Writes, per piece:
//   <main checkout>/engine/client/data/caves/<id>.glb     (git-ignored binaries)
//   <this worktree>/engine/client/data/caves/<id>.glb     (same bytes)
// and the verification report ./chunks.json next to this script.
//
// What it does to each TRELLIS.2 mesh (experiments/2026-10-05-caves/web-models/<id>.glb, read-only):
//  1. Bakes the pilot viewer's makePiece transform into the vertices + normals (inverse-transpose for the stretch):
//       world = T(-cx,-y0,-back_z) * S(sx,1,sz) * Ry(yaw_deg) * S(scale) * nodeWorld * v
//     so the file loads straight into the canonical frame: feet, origin on the ground at the middle of the BACK plane,
//     front toward +Z, width along X, y up. `gain` is NOT applied (the game sets it as material colour).
//  2. One mesh / one material: baseColor texture kept, metallicRoughness (and any normal/occlusion/emissive) maps
//     dropped; roughness 0.95, metalness 0, doubleSided (as the viewer renders it).
//  3. meshoptimizer simplify to ~6,000 triangles (LockBorder on; ratio iterated until 4,000-8,000). Shells the
//     simplifier cannot get under 8,000 (ledge, overhang: fragmented sheets), or that lose >3% silhouette (arch), are rebuilt instead
//     (Blender solidify + voxel remesh, meshopt simplify, base colour baked onto new UVs in Blender) -- see REMESH_PY below. Needs `blender` on PATH.
//  4. Colour texture -> 512x512 WebP (EXT_texture_webp; three.js GLTFLoader reads it natively).
//  5. House meshopt compression: tools/spawn-tuner/prep/meshopt.mjs (EXT_meshopt_compression, level 'high', with its
//     own read-back check). Quantization puts a dequantize scale/offset on the mesh node (KHR_mesh_quantization); the
//     root node stays identity and the loaded world-space box is the canonical one.
//  6. Verifies the final: decode with the meshopt decoder, triangle count, bytes, texture size, world box in feet,
//     compared with kit.json (size_ft, front_reach_ft, half_width_ft); flags any axis off by > 3% of the piece's size.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PREP = 'tools/spawn-tuner/prep';
const require = createRequire(PREP + '/meshopt.mjs');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { simplify, weld, prune, dedup, textureCompress, transformMesh } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKTREE = path.resolve(HERE, '../..');
const MAIN = '<repo>';
const SRC_DIR = MAIN + '/experiments/2026-10-05-caves/web-models';
const KIT = WORKTREE + '/experiments/2026-10-05-caves/kit.json';
const OUT_DIRS = [MAIN + '/engine/client/data/caves', WORKTREE + '/engine/client/data/caves'];
const TMP = HERE + '/.tmp';
const TARGET_TRIS = 6000, MIN_TRIS = 4000, MAX_TRIS = 8000, TEX = 512, TOL = 0.03;

await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const quiet = { debug() {}, info() {}, warn() {}, error() {} };

// column-major 4x4 helpers (glTF / gl-matrix layout)
const mul = (A, B) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k]; return o; };
function canonical(k) {
  const t = (k.yaw_deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), q = k.scale;
  const sx = k.stretch?.[0] ?? 1, sz = k.stretch?.[1] ?? 1;
  // a = diag(sx,1,sz) * Ry(t) * q ; Ry (three.js) = [[c,0,s],[0,1,0],[-s,0,c]]
  return [sx * c * q, 0, -sz * s * q, 0, 0, q, 0, 0, sx * s * q, 0, sz * c * q, 0, -k.cx, -k.y0, -k.back_z, 1];
}

function measure(doc) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], e = [0, 0, 0];
  let tris = 0, verts = 0, meshes = 0, prims = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; meshes++;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      prims++;
      const P = p.getAttribute('POSITION'), I = p.getIndices(), n = P.getCount(); verts += n; tris += (I ? I.getCount() : n) / 3;
      for (let i = 0; i < n; i++) {
        P.getElement(i, e);
        const v = [0, 1, 2].map(r => M[r] * e[0] + M[4 + r] * e[1] + M[8 + r] * e[2] + M[12 + r]);
        for (let a = 0; a < 3; a++) { if (v[a] < lo[a]) lo[a] = v[a]; if (v[a] > hi[a]) hi[a] = v[a]; }
      }
    }
  }
  const r3 = a => a.map(x => +x.toFixed(3));
  return { tris, verts, meshes, prims, min: r3(lo), max: r3(hi), size: r3([0, 1, 2].map(a => hi[a] - lo[a])) };
}

async function bakeAndClean(id, k, src = path.join(SRC_DIR, k.file)) {
  const doc = await io.read(src); doc.setLogger(quiet);
  const root = doc.getRoot();
  const meshNodes = root.listNodes().filter(n => n.getMesh());
  if (meshNodes.length !== 1 || root.listMeshes().length !== 1 || root.listMeshes()[0].listPrimitives().length !== 1)
    throw new Error(`${id}: expected exactly one mesh node / mesh / primitive`);
  const node = meshNodes[0], mesh = node.getMesh();
  const scene = root.listScenes()[0];
  if (!node.getParentNode()) {   // keep root (identity) -> mesh node, so meshopt's dequantize transform lands below the root
    const top = doc.createNode(id + '-root'); scene.removeChild(node); top.addChild(node); scene.addChild(top);
  }
  transformMesh(mesh, mul(canonical(k), node.getWorldMatrix()));   // positions + inverse-transpose normals; winding kept (det>0)
  for (const n of root.listNodes()) n.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  const prim = mesh.listPrimitives()[0];
  for (const sem of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(sem)) prim.setAttribute(sem, null);
  const mat = prim.getMaterial();
  for (const m of root.listMaterials()) if (m !== mat) m.dispose();
  mat.setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null)
    .setEmissiveFactor([0, 0, 0]).setRoughnessFactor(0.95).setMetallicFactor(0).setAlphaMode('OPAQUE').setDoubleSided(true)
    .setBaseColorFactor([1, 1, 1, 1]).setName(id);
  mesh.setName(id); node.setName(id);
  await doc.transform(prune(), dedup());
  return doc;
}

// Fallback: rebuild the surface. Some TRELLIS meshes are jigsaws of thin sheets: cave-wall-ledge has 26k open-boundary
// edges and 3,000+ loose flakes, cave-wall-overhang 14k boundary edges, so the simplifier floors at ~33k / ~17k triangles
// with LockBorder and ~20.7k / ~8.2k without (tried 2026-10-25: LockBorder on/off, Permissive, Prune, simplifyPrune,
// tolerance snapping, Blender hole-fill + Decimate: nothing got the ledge under 15k). cave-wall-arch reaches ~7k locked
// but loses 3.6% of its top silhouette doing so. The rebuild, in the source's native frame (~1-unit extent):
//   Blender: Solidify the sheets to a slab (0.008, ~0.08 ft) so cracks and flakes fuse, voxel remesh at 0.003 (~0.03 ft)
//   meshoptimizer: simplify the now-manifold voxel shell to the target (Blender's Decimate at a ~0.3% ratio folded the
//     overhang into origami: 19% of its surface facing the wrong way; meshopt: 8%, silhouette loss ~1%)
//   Blender: Smart-UV-project, bake the original's base colour onto the new UVs (Cycles, selected-to-active, 1024 px,
//     cage 0.02 / ray 0.06 so deep crevices still hit the source; downsized to 512 later).
// The canonical transform is then baked exactly as for the other pieces. The slab is ~0.04 ft fatter per side.
const REMESH_PY = String.raw`
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
mode = a[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
def only(o):
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
if mode == 'remesh':   # src out voxel thick
    src, out, voxel, thick = a[1], a[2], float(a[3]), float(a[4])
    bpy.ops.import_scene.gltf(filepath=src)
    ob = next(o for o in bpy.context.scene.objects if o.type == 'MESH'); only(ob)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    ob.data.materials.clear()
    s = ob.modifiers.new('so', 'SOLIDIFY'); s.thickness = thick; s.offset = 0; s.use_even_offset = False
    bpy.ops.object.modifier_apply(modifier='so')
    r = ob.modifiers.new('rm', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel; r.adaptivity = 0
    bpy.ops.object.modifier_apply(modifier='rm')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_texcoords=False, export_normals=False, export_materials='NONE')
    print('REMESH_OK', len(ob.data.polygons))
else:                  # bake: src lo out px reach
    src, lo_path, out, px, reach = a[1], a[2], a[3], int(a[4]), float(a[5])
    bpy.ops.import_scene.gltf(filepath=src); hi = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
    bpy.ops.import_scene.gltf(filepath=lo_path); lo = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o != hi][0]
    for o in (hi, lo):
        only(o); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # smooth by angle, not plain smooth: a thin slab's top and bottom meet at a sharp rim, and fully smooth normals
    # averaged across it shaded the overhang's roof dark and "crumpled"
    only(lo); lo.data.materials.clear(); bpy.ops.object.shade_smooth_by_angle(angle=0.87)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new('baked', px, px, alpha=False)
    mat = bpy.data.materials.new('baked'); mat.use_nodes = True; nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); nt.nodes.active = tex
    lo.data.materials.append(mat)
    sc = bpy.context.scene
    try: sc.render.engine = 'CYCLES'
    except TypeError: pass
    sc.cycles.device = 'CPU'; sc.cycles.samples = 1
    bk = sc.render.bake; bk.use_selected_to_active = True; bk.cage_extrusion = reach; bk.max_ray_distance = reach * 3; bk.margin = 6
    bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=True)
    img.pack(); only(lo)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_image_format='JPEG')
    print('BAKE_OK', len(lo.data.polygons))
`;
const REMESH = { voxel: 0.003, thick: 0.008, bakePx: 1024, reach: 0.02 };
async function remesh(id, k) {
  const py = path.join(TMP, 'remesh_bake.py'); fs.writeFileSync(py, REMESH_PY);
  const src = path.join(SRC_DIR, k.file), vox = path.join(TMP, `${id}.vox.glb`), lo = path.join(TMP, `${id}.lo.glb`), out = path.join(TMP, `${id}.remeshed.glb`);
  const blender = (args, ok) => { const log = execFileSync('blender', ['-b', '--python', py, '--', ...args.map(String)], { encoding: 'utf8', maxBuffer: 256 << 20 }); if (!log.includes(ok)) throw new Error(`${id}: blender ${args[0]} failed:\n${log.slice(-2000)}`); };
  blender(['remesh', src, vox, REMESH.voxel, REMESH.thick], 'REMESH_OK');
  const plain = new NodeIO();   // the voxel shell: positions only, then meshopt to the target
  let n = null, ratio = null, got = null;
  for (let i = 0; i < 4; i++) {
    const d = await plain.read(vox); d.setLogger(quiet); const p = d.getRoot().listMeshes()[0].listPrimitives()[0];
    for (const s of p.listSemantics()) if (s !== 'POSITION') p.setAttribute(s, null);
    await d.transform(weld());
    n ??= p.getIndices().getCount() / 3; ratio ??= TARGET_TRIS / n;
    await d.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 1 }));
    got = p.getIndices().getCount() / 3;
    if (Math.abs(got - TARGET_TRIS) < 400 || i === 3) { await plain.write(lo, d); break; }
    ratio *= TARGET_TRIS / got;
  }
  blender(['bake', src, lo, out, REMESH.bakePx, REMESH.reach], 'BAKE_OK');
  return { path: out, voxel_tris: n, simplified_tris: got };
}

async function reduce(id, k) {
  const base = await bakeAndClean(id, k);
  const baked = measure(base);
  // meshoptimizer simplify with LockBorder (keeps open rims, e.g. the foot, where they are); ratio iterated to the target.
  let ratio = TARGET_TRIS / baked.tris, doc, got, tries = [], prev = null, method = 'meshopt-simplify LockBorder';
  for (let i = 0; i < 6; i++) {
    doc = await bakeAndClean(id, k);
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 1, lockBorder: true }));
    got = measure(doc).tris; tries.push({ ratio: +ratio.toFixed(4), tris: got });
    const inRange = got >= MIN_TRIS && got <= MAX_TRIS, stuck = prev !== null && Math.abs(got - prev) < 0.02 * got;
    if ((inRange && Math.abs(got - TARGET_TRIS) < 600) || stuck) break;
    prev = got; ratio = Math.min(1, ratio * TARGET_TRIS / got);
  }
  // Rebuild the surface when the locked border alone holds more than the budget, or when the simplified shell loses more
  // than 3% of the full-res silhouette in any view; keep whichever candidate loses less silhouette (within budget).
  const fullTri = triangles(base), worst = s => Math.max(...Object.values(s).map(v => v.lost_pct));
  let sil = silhouette(fullTri, triangles(doc));
  tries.push({ meshopt_silhouette_lost_max_pct: worst(sil) });
  if (got > MAX_TRIS || worst(sil) > 3) {
    const rm = await remesh(id, k);
    const rdoc = await bakeAndClean(id, k, rm.path); let rgot = measure(rdoc).tris;
    if (rgot > MAX_TRIS) { await rdoc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: TARGET_TRIS / rgot, error: 1 })); rgot = measure(rdoc).tris; }
    const rsil = silhouette(fullTri, triangles(rdoc));
    tries.push({ remesh: REMESH, voxel_tris: rm.voxel_tris, tris: rgot, silhouette_lost_max_pct: worst(rsil) });
    if (got > MAX_TRIS || worst(rsil) < worst(sil)) { doc = rdoc; got = rgot; sil = rsil; method = 'blender solidify+voxel remesh, meshopt simplify, colour baked in blender'; }
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 85 }),
    prune(), dedup(),
  );
  return { doc, baked, tries, method };
}

// Area-weighted surface samples in world space, the way measure.py (trimesh.sample.sample_surface) took the kit's
// percentile numbers: front_reach_ft.all_max = 99.5th pct of z, behind_back_plane = 0.5th pct, half_width.all = 99th pct |x|.
function triangles(doc) {   // world-space corners (+ UVs) of every triangle, as a loader would place them
  const tri = [], e = [0, 0, 0], t2 = [0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION'), T = p.getAttribute('TEXCOORD_0'), I = p.getIndices();
      const W = [], U = [];
      for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); W.push([0, 1, 2].map(r => M[r] * e[0] + M[4 + r] * e[1] + M[8 + r] * e[2] + M[12 + r])); if (T) { T.getElement(i, t2); U.push([t2[0], t2[1]]); } }
      for (let t = 0; t < I.getCount(); t += 3) { const ix = [I.getScalar(t), I.getScalar(t + 1), I.getScalar(t + 2)]; tri.push({ p: ix.map(i => W[i]), uv: T ? ix.map(i => U[i]) : null }); }
    }
  }
  return tri;
}
function surfaceSamples(tri, n = 300000) {
  let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cum = new Float64Array(tri.length); let acc = 0;
  tri.forEach(({ p: [a, b, c] }, i) => { const u = [0, 1, 2].map(j => b[j] - a[j]), v = [0, 1, 2].map(j => c[j] - a[j]); acc += 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); cum[i] = acc; });
  const xs = new Float64Array(n), zs = new Float64Array(n), uvs = new Float32Array(n * 2);
  for (let s = 0; s < n; s++) {
    const r = rnd() * acc; let lo = 0, hi = tri.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const { p: [a, b, c], uv } = tri[lo]; xs[s] = Math.abs(a[0] + u * (b[0] - a[0]) + v * (c[0] - a[0])); zs[s] = a[2] + u * (b[2] - a[2]) + v * (c[2] - a[2]);
    if (uv) for (let j = 0; j < 2; j++) uvs[s * 2 + j] = uv[0][j] + u * (uv[1][j] - uv[0][j]) + v * (uv[2][j] - uv[0][j]);
  }
  return { xs, zs, uvs };
}
function surfacePercentiles({ xs, zs }) {
  const X = Float64Array.from(xs).sort(), Z = Float64Array.from(zs).sort(), pct = (arr, q) => +arr[Math.min(arr.length - 1, Math.floor((q / 100) * arr.length))].toFixed(2);
  return { z_p99_5: pct(Z, 99.5), z_p0_5: pct(Z, 0.5), absx_p99: pct(X, 99) };
}
// share of the surface whose texel is black/unpainted (max channel < 12), as measure.py counted `unpainted`
async function unpaintedShare(doc, uvs) {
  const t = doc.getRoot().listMaterials()[0]?.getBaseColorTexture(); if (!t) return null;
  const { data, info } = await sharp(Buffer.from(t.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let bad = 0; const n = uvs.length / 2;
  for (let s = 0; s < n; s++) {
    const u = uvs[s * 2] - Math.floor(uvs[s * 2]), v = uvs[s * 2 + 1] - Math.floor(uvs[s * 2 + 1]);
    const x = Math.min(info.width - 1, Math.floor(u * info.width)), y = Math.min(info.height - 1, Math.floor(v * info.height));   // glTF UV: v down
    const o = (y * info.width + x) * 3; if (Math.max(data[o], data[o + 1], data[o + 2]) < 12) bad++;
  }
  return +(bad / n).toFixed(4);
}
// orthographic silhouette coverage (front = XY, top = XZ, side = ZY) of `test` against `ref`, on a 256 grid over ref's box
function silhouette(refTri, testTri) {
  const lo = [0, 1, 2].map(k => Math.min(...refTri.map(t => Math.min(t.p[0][k], t.p[1][k], t.p[2][k])))), hi = [0, 1, 2].map(k => Math.max(...refTri.map(t => Math.max(t.p[0][k], t.p[1][k], t.p[2][k]))));
  const G = 256, S = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * 1.1;
  const cover = (tri, ax) => {
    const m = new Uint8Array(G * G);
    for (const { p } of tri) {
      const v = p.map(q => [(q[ax[0]] - lo[ax[0]] + S * 0.05) / S * G, (q[ax[1]] - lo[ax[1]] + S * 0.05) / S * G]);
      const x0 = Math.max(0, Math.floor(Math.min(v[0][0], v[1][0], v[2][0]))), x1 = Math.min(G - 1, Math.ceil(Math.max(v[0][0], v[1][0], v[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(v[0][1], v[1][1], v[2][1]))), y1 = Math.min(G - 1, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1])));
      const d = (v[1][1] - v[2][1]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][1] - v[2][1]); if (Math.abs(d) < 1e-12) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const a = ((v[1][1] - v[2][1]) * (px - v[2][0]) + (v[2][0] - v[1][0]) * (py - v[2][1])) / d, b = ((v[2][1] - v[0][1]) * (px - v[2][0]) + (v[0][0] - v[2][0]) * (py - v[2][1])) / d;
        if (a >= 0 && b >= 0 && a + b <= 1) m[y * G + x] = 1;
      }
    }
    return m;
  };
  const out = {};
  for (const [name, ax] of [['front', [0, 1]], ['top', [0, 2]], ['side', [2, 1]]]) {
    const r = cover(refTri, ax), c = cover(testTri, ax); let lost = 0, gained = 0, n = 0;
    for (let i = 0; i < r.length; i++) { n += r[i]; if (r[i] && !c[i]) lost++; if (!r[i] && c[i]) gained++; }
    out[name] = { lost_pct: +(100 * lost / n).toFixed(2), gained_pct: +(100 * gained / n).toFixed(2) };
  }
  return out;
}

async function verify(id, k, doc, bytes, fullRes) {
  const m = measure(doc), root = doc.getRoot(), tri = triangles(doc), smp = surfaceSamples(tri), sp = surfacePercentiles(smp);
  const unpainted = await unpaintedShare(doc, smp.uvs), sil = silhouette(triangles(fullRes), tri);
  const rootNodes = root.listScenes()[0].listChildren();
  const rootIdentity = rootNodes.every(n => n.getMatrix().every((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) < 1e-9));
  const tex = root.listTextures().map(t => ({ mime: t.getMimeType(), size: t.getSize() }));
  const mats = root.listMaterials();
  // box numbers vs kit box numbers (size_ft = ptp of the surface samples, already including any stretch; h = target);
  // surface percentiles vs the kit's percentile numbers (front_reach / behind_back_plane / half_width are percentiles,
  // not extremes, so the absolute box overshoots them by design).
  const exp = {
    w: k.size_ft.w, h: k.size_ft.h, d: k.size_ft.d, y_min: 0, y_max: k.size_ft.h,
    front_reach_p99_5: k.front_reach_ft.all_max, behind_back_p0_5: k.front_reach_ft.behind_back_plane, half_width_p99: k.half_width_ft.all,
  };
  const got = { w: m.size[0], h: m.size[1], d: m.size[2], y_min: m.min[1], y_max: m.max[1], front_reach_p99_5: sp.z_p99_5, behind_back_p0_5: sp.z_p0_5, half_width_p99: sp.absx_p99 };
  const scale = { w: exp.w, h: exp.h, d: exp.d, y_min: exp.h, y_max: exp.h, front_reach_p99_5: exp.d, behind_back_p0_5: exp.d, half_width_p99: exp.w };
  const off = {}, flags = [];
  for (const key of Object.keys(exp)) {
    const f = (got[key] - exp[key]) / scale[key]; off[key] = +(f * 100).toFixed(2);
    if (Math.abs(f) > TOL) flags.push(`${key} ${got[key]} vs kit ${exp[key]} (${off[key]}% of size)`);
  }
  const x_centre = +((m.min[0] + m.max[0]) / 2).toFixed(3);
  if (Math.abs(x_centre) / exp.w > TOL) flags.push(`x centre ${x_centre}`);
  if (!rootIdentity) flags.push('root node not identity');
  if (m.meshes !== 1 || m.prims !== 1 || mats.length !== 1) flags.push(`meshes ${m.meshes} prims ${m.prims} materials ${mats.length}`);
  if (tex.length !== 1 || tex[0].size?.[0] !== TEX || tex[0].size?.[1] !== TEX) flags.push(`texture ${JSON.stringify(tex)}`);
  if (m.tris < MIN_TRIS || m.tris > MAX_TRIS) flags.push(`tris ${m.tris}`);
  if (bytes > 300 * 1024) flags.push(`bytes ${bytes} > 300 KB`);
  if (unpainted !== null && unpainted > (k.unpainted?.all_surface ?? 0) + 0.02) flags.push(`unpainted ${unpainted} vs kit ${k.unpainted?.all_surface}`);
  for (const [view, s] of Object.entries(sil)) if (s.lost_pct > 3 || s.gained_pct > 4) flags.push(`silhouette ${view} lost ${s.lost_pct}% gained ${s.gained_pct}%`);
  const mat = mats[0];
  return {
    ok: flags.length === 0, flags, tris: m.tris, verts: m.verts, bytes, kb: +(bytes / 1024).toFixed(1), texture: tex,
    unpainted_share: unpainted, kit_unpainted_share: k.unpainted?.all_surface ?? null, silhouette_vs_full_res: sil,
    material: { roughness: mat.getRoughnessFactor(), metalness: mat.getMetallicFactor(), baseColorTexture: !!mat.getBaseColorTexture(), mrTexture: !!mat.getMetallicRoughnessTexture(), doubleSided: mat.getDoubleSided() },
    extensions: root.listExtensionsUsed().map(e => e.extensionName), root_identity: rootIdentity,
    box_ft: { min: m.min, max: m.max, size: m.size, x_centre }, surface_percentiles_ft: sp, kit: exp, measured: got, off_pct_of_size: off,
  };
}

const kit = JSON.parse(fs.readFileSync(KIT, 'utf8'));
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(kit).filter(id => kit[id]?.file);
fs.mkdirSync(TMP, { recursive: true }); for (const d of OUT_DIRS) fs.mkdirSync(d, { recursive: true });
const reportPath = HERE + '/chunks.json';
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : {};
report._about = { made: new Date().toISOString(), script: path.basename(fileURLToPath(import.meta.url)), frame: 'feet; origin = ground, middle of back plane; front +Z; width X; y up; gain not applied', tolerance: '3% of the piece size per axis', kit: KIT };
for (const id of ids) {
  const k = kit[id]; if (!k) throw new Error(`no piece ${id} in kit.json`);
  const { doc, baked, tries, method } = await reduce(id, k);
  const mid = path.join(TMP, `${id}.reduced.glb`); await io.write(mid, doc);
  const final = path.join(OUT_DIRS[0], `${id}.glb`);
  const line = execFileSync('node', [PREP + '/meshopt.mjs', mid, final], { encoding: 'utf8' }).trim();
  const mo = JSON.parse(line);
  if (!mo.ok) throw new Error(`${id}: meshopt.mjs refused: ${mo.why}`);
  for (const d of OUT_DIRS.slice(1)) fs.copyFileSync(final, path.join(d, `${id}.glb`));
  const back = await io.read(final); back.setLogger(quiet);   // decode exactly as delivered (meshopt decoder)
  const v = await verify(id, k, back, fs.statSync(final).size, await bakeAndClean(id, k));
  report[id] = { ...v, method, source_tris: k.tris, baked_full_res_box_ft: { min: baked.min, max: baked.max, size: baked.size }, simplify_tries: tries, meshopt: { reduced_bytes: mo.bytes[0], err: mo.err }, outputs: OUT_DIRS.map(d => path.join(d, `${id}.glb`)) };
  fs.rmSync(mid, { force: true });
  console.log(`${id.padEnd(20)} ${method.startsWith('blender') ? 'REMESH ' : 'meshopt'} tris ${String(v.tris).padStart(5)}  ${String(v.kb).padStart(6)} KB  box w/d/h ${v.box_ft.size[0]}/${v.box_ft.size[2]}/${v.box_ft.size[1]} vs kit ${k.size_ft.w}/${k.size_ft.d}/${k.size_ft.h}  ${v.ok ? 'ok' : 'FLAG: ' + v.flags.join('; ')}`);
}
fs.rmSync(TMP, { recursive: true, force: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 1) + '\n');
console.log('report', reportPath);
