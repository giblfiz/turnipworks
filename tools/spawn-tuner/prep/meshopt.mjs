// Meshopt-compress GLBs for delivery (prep/delivery.py calls this; docs/ASSET_DELIVERY.md).           2026-10-11
//   node meshopt.mjs jobs.json        jobs.json = [[in.glb, out.glb], ...]; one JSON line per file on stdout
//   node meshopt.mjs in.glb out.glb   one file
// What is written: EXT_meshopt_compression at gltf-transform's level "high", the setting trialled in
// experiments/2026-10-11-asset-cost/A_compression.md: vertices reordered for the codec, positions quantized to 14 bits
// (with the scale put on the mesh's node), UVs to 12 bits, normals to 8-bit octahedral. Textures and materials inside
// a file (figures) pass through untouched. The source file is never changed.
// Every output is read back and checked against its source before it counts (ok:false = the source is delivered as it
// is): same triangle count, no more vertices, the model's box within 0.02% of its largest side (the trial's worst
// vertex moved 0.007%), the UV box within 1/1024 (the trial: 1/6 texel at 1024 px).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const quiet = { debug() {}, info() {}, warn() {}, error() {} };

function measure(doc) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], uv = [Infinity, Infinity, -Infinity, -Infinity];
  let verts = 0, tris = 0; const e = [0, 0, 0], u = [0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION'), T = p.getAttribute('TEXCOORD_0'), I = p.getIndices(); if (!P) continue;
      const n = P.getCount(); verts += n; tris += (I ? I.getCount() : n) / 3;
      for (let i = 0; i < n; i++) {
        P.getElement(i, e);
        const x = M[0] * e[0] + M[4] * e[1] + M[8] * e[2] + M[12], y = M[1] * e[0] + M[5] * e[1] + M[9] * e[2] + M[13], z = M[2] * e[0] + M[6] * e[1] + M[10] * e[2] + M[14];
        if (x < lo[0]) lo[0] = x; if (y < lo[1]) lo[1] = y; if (z < lo[2]) lo[2] = z; if (x > hi[0]) hi[0] = x; if (y > hi[1]) hi[1] = y; if (z > hi[2]) hi[2] = z;
        if (T) { T.getElement(i, u); if (u[0] < uv[0]) uv[0] = u[0]; if (u[1] < uv[1]) uv[1] = u[1]; if (u[0] > uv[2]) uv[2] = u[0]; if (u[1] > uv[3]) uv[3] = u[1]; }
      }
    }
  }
  return { lo, hi, uv, verts, tris };
}

async function one(inp, out) {
  const doc = await io.read(inp); doc.setLogger(quiet);
  const A = measure(doc);
  if (!A.tris) return { ok: false, why: 'no triangles in the file' };
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const tmp = out.replace(/\.glb$/, '') + '.part.glb'; await io.write(tmp, doc); // (the name must end .glb: the writer picks its format by it)
  const B = measure(await io.read(tmp));
  const side = Math.max(A.hi[0] - A.lo[0], A.hi[1] - A.lo[1], A.hi[2] - A.lo[2]) || 1;
  const box = Math.max(...[0, 1, 2].flatMap(k => [Math.abs(A.lo[k] - B.lo[k]), Math.abs(A.hi[k] - B.hi[k])])) / side;
  const uvd = Number.isFinite(A.uv[0]) ? Math.max(...[0, 1, 2, 3].map(k => Math.abs(A.uv[k] - B.uv[k]))) : 0;
  const why = B.tris !== A.tris ? `triangles ${A.tris} -> ${B.tris}` : B.verts > A.verts ? `vertices ${A.verts} -> ${B.verts}` : box > 2e-4 ? `box moved ${(box * 100).toFixed(4)}% of the largest side` : uvd > 1 / 1024 ? `UV box moved ${uvd.toFixed(5)}` : null;
  if (why) { fs.rmSync(tmp, { force: true }); return { ok: false, why }; }
  fs.renameSync(tmp, out);
  return { ok: true, tris: A.tris, verts: [A.verts, B.verts], bytes: [fs.statSync(inp).size, fs.statSync(out).size], err: { box: +(box * 100).toFixed(5), uv: +uvd.toFixed(6) } };
}

const args = process.argv.slice(2);
const jobs = args.length === 1 ? JSON.parse(fs.readFileSync(args[0], 'utf8')) : [[args[0], args[1]]];
for (const [inp, out] of jobs) {
  let r; try { r = await one(inp, out); } catch (err) { r = { ok: false, why: String(err?.message || err).slice(0, 200) }; }
  process.stdout.write(JSON.stringify({ in: inp, ...r }) + '\n');
}
