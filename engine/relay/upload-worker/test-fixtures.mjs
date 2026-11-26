// Model files for the tests (engine/test/uploads.test.mjs): a good one of each kind, and hostile ones. Made here, by
// code, so the tests need no asset from outside the repo. Test fixtures only: none of this is ever drawn in the game.
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';

const io = new NodeIO();
const box = (w = 1, h = 2, d = 0.5) => { // 12 triangles, with UVs
  const x = w / 2, z = d / 2, P = [], U = [], I = [];
  const face = (a, b, c, e) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...e); U.push(0, 0, 1, 0, 1, 1, 0, 1); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  face([-x, 0, z], [x, 0, z], [x, h, z], [-x, h, z]); face([x, 0, -z], [-x, 0, -z], [-x, h, -z], [x, h, -z]);
  face([-x, h, z], [x, h, z], [x, h, -z], [-x, h, -z]); face([-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z]);
  face([x, 0, z], [x, 0, -z], [x, h, -z], [x, h, z]); face([-x, 0, -z], [-x, 0, z], [-x, h, z], [-x, h, -z]);
  return { P: new Float32Array(P), U: new Float32Array(U), I: new Uint16Array(I) };
};
// a sphere-ish mesh of about n triangles (to test simplification)
const blob = (n) => {
  const seg = Math.max(4, Math.round(Math.sqrt(n / 2))), P = [], I = [];
  for (let i = 0; i <= seg; i++) for (let j = 0; j <= seg; j++) { const t = i / seg * Math.PI, p = j / seg * 2 * Math.PI, r = 1 + 0.1 * Math.sin(5 * t) * Math.cos(3 * p); P.push(r * Math.sin(t) * Math.cos(p), 1 + r * Math.cos(t), r * Math.sin(t) * Math.sin(p)); }
  for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; I.push(a, b, a + 1, a + 1, b, b + 1); }
  return { P: new Float32Array(P), I: new Uint32Array(I) };
};
async function glbOf({ tris = 0, texture = 0, color = null, animation = false, extras = false } = {}) {
  const doc = new Document(), buf = doc.createBuffer();
  const g = tris ? blob(tris) : box();
  const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.P).setBuffer(buf)).setIndices(doc.createAccessor().setType('SCALAR').setArray(g.I).setBuffer(buf));
  if (g.U) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(g.U).setBuffer(buf));
  const mat = doc.createMaterial('m'); if (color) mat.setBaseColorFactor(color);
  if (texture) { const png = await sharp({ create: { width: texture, height: texture, channels: 3, noise: { type: 'gaussian', mean: 120, sigma: 40 } } }).png().toBuffer(); /* noise: a solid colour would be folded into the material */ mat.setBaseColorTexture(doc.createTexture('t').setImage(new Uint8Array(png)).setMimeType('image/png')); }
  prim.setMaterial(mat);
  const node = doc.createNode('thing').setMesh(doc.createMesh('m').addPrimitive(prim));
  if (extras) node.setExtras({ onload: 'alert(1)', script: '<script>x</script>' });
  doc.createScene().addChild(node);
  if (animation) { const s = doc.createAnimationSampler().setInput(doc.createAccessor().setArray(new Float32Array([0, 1])).setBuffer(buf)).setOutput(doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 1, 1, 1])).setBuffer(buf)); doc.createAnimation('a').addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(s)); }
  return Buffer.from(await io.writeBinary(doc));
}
// a GLB from hand-written JSON and a binary chunk (for the hostile ones gltf-transform would never write)
export function rawGlb(json, bin = Buffer.alloc(0)) {
  let j = Buffer.from(typeof json === 'string' ? json : JSON.stringify(json)); j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const b = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const parts = [Buffer.alloc(12), Buffer.alloc(8), j, ...(b.length ? [Buffer.alloc(8), b] : [])];
  const total = parts.reduce((n, p) => n + p.length, 0);
  parts[0].write('glTF', 0, 'ascii'); parts[0].writeUInt32LE(2, 4); parts[0].writeUInt32LE(total, 8);
  parts[1].writeUInt32LE(j.length, 0); parts[1].writeUInt32LE(0x4e4f534a, 4);
  if (b.length) { parts[3].writeUInt32LE(b.length, 0); parts[3].writeUInt32LE(0x004e4942, 4); }
  return Buffer.concat(parts);
}
const triJson = (extra = {}) => { const P = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]); return { json: { asset: { version: '2.0' }, buffers: [{ byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0, ...extra }, bin: Buffer.from(P.buffer) }; };
export function stlBinary(n) { const b = Buffer.alloc(84 + 50 * n); b.writeUInt32LE(n, 80); for (let t = 0; t < n; t++) { const o = 84 + t * 50 + 12; const x = t % 1000, z = Math.floor(t / 1000); b.writeFloatLE(x, o); b.writeFloatLE(0, o + 4); b.writeFloatLE(z, o + 8); b.writeFloatLE(x + 1, o + 12); b.writeFloatLE(0, o + 16); b.writeFloatLE(z, o + 20); b.writeFloatLE(x, o + 24); b.writeFloatLE(0, o + 28); b.writeFloatLE(z + 1 + (t % 7) * 0.1, o + 32); } return b; }
// a pyramid standing on Z (a print file's way up)
export function stlPyramid() { const V = [[0, 0, 2], [-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], F = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [1, 3, 2], [1, 4, 3]]; return Buffer.from(`solid p\n${F.map(f => `facet normal 0 0 0\nouter loop\n${f.map(i => `vertex ${V[i].join(' ')}`).join('\n')}\nendloop\nendfacet`).join('\n')}\nendsolid p\n`); }
export const objCube = () => Buffer.from('# a cube\nmtllib ../../etc/passwd\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1\nf 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 5 1 4 8\n');
// a PNG whose header says 30000 x 30000 (a decompression bomb: tiny on disk, 3.6 GB decoded)
export function bombPng() { const b = Buffer.alloc(64); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(30000, 16); b.writeUInt32BE(30000, 20); b[24] = 8; b[25] = 2; return b; }

export async function fixtures() {
  const T = triJson();
  const withImage = (img, extra = {}) => { const bin = Buffer.concat([T.bin, img, Buffer.alloc((4 - (img.length % 4)) % 4)]); return rawGlb({ ...T.json, buffers: [{ byteLength: bin.length }], bufferViews: [{ buffer: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: img.length }], images: [{ bufferView: 1, mimeType: 'image/png' }], textures: [{ source: 0 }], materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], ...extra }, bin); };
  const bigPng = await sharp({ create: { width: 4097, height: 16, channels: 3, background: '#000' } }).png().toBuffer();
  return {
    good: await glbOf({ texture: 64 }),
    plain: await glbOf({}),
    coloured: await glbOf({ color: [0.2, 0.5, 0.2, 1] }),
    dense: await glbOf({ tris: 60000, texture: 2048 }),
    animated: await glbOf({ animation: true, extras: true }),
    stl: stlPyramid(), obj: objCube(),
    // hostile
    truncated: (() => { const g = rawGlb(T.json, T.bin); return g.subarray(0, g.length - 8); })(),
    lengthLie: (() => { const g = rawGlb(T.json, T.bin); g.writeUInt32LE(g.length + 100, 8); return g; })(),
    notModel: Buffer.from('MZ\x90\x00 this is an executable, honest' + 'x'.repeat(100)),
    html: Buffer.from('<html><script>alert(1)</script></html>' + ' '.repeat(40)),
    externalBuffer: Buffer.from(JSON.stringify({ ...T.json, buffers: [{ byteLength: 36, uri: 'https://evil.example/x.bin' }] })),
    externalFile: Buffer.from(JSON.stringify({ ...T.json, buffers: [{ byteLength: 36, uri: '../../../../etc/passwd' }] })),
    externalImage: rawGlb({ ...T.json, images: [{ uri: 'http://metadata.invalid/latest/meta-data/' }], textures: [{ source: 0 }], materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }] }, T.bin),
    bomb: withImage(bombPng()),
    hugeTexture: withImage(bigPng),
    sparseBomb: rawGlb({ ...T.json, accessors: [...T.json.accessors, { componentType: 5126, count: 1e9, type: 'VEC3', sparse: { count: 1, indices: { bufferView: 0, componentType: 5125 }, values: { bufferView: 0 } } }] }, T.bin),
    draco: rawGlb({ ...T.json, extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'] }, T.bin),
    unknownRequired: rawGlb({ ...T.json, extensionsUsed: ['EVIL_run_code'], extensionsRequired: ['EVIL_run_code'] }, T.bin),
    deep: rawGlb({ ...T.json, extras: JSON.parse('['.repeat(200) + ']'.repeat(200)) }, T.bin),
    proto: rawGlb(JSON.stringify(T.json).replace('"asset":{', '"asset":{"__proto__":{"polluted":1},'), T.bin),
    tooManyTris: stlBinary(500001),
    shortData: Buffer.from(JSON.stringify({ ...T.json, buffers: [{ byteLength: 36, uri: 'data:application/octet-stream;base64,AAAA' }] })), // (says 36 bytes, holds 3)
    viewOutside: rawGlb({ ...T.json, bufferViews: [{ buffer: 0, byteLength: 36, byteOffset: 1 << 30 }] }, T.bin),
    nanVerts: (() => { const P = new Float32Array([0, 0, 0, NaN, 0, 0, 0, 1, 0]); return rawGlb(T.json, Buffer.from(P.buffer)); })(),
  };
}

// as a program: node test-fixtures.mjs <dir>   writes good.glb, plain.glb, pyramid.stl, cube.obj, html.glb (a page named
// .glb) for the browser test (engine/test/browser_uploads.py)
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname) && process.argv[2]) {
  const F = await fixtures(), dir = process.argv[2]; fs.mkdirSync(dir, { recursive: true });
  for (const [name, k] of [['good.glb', 'good'], ['plain.glb', 'plain'], ['pyramid.stl', 'stl'], ['cube.obj', 'obj'], ['html.glb', 'html']]) fs.writeFileSync(path.join(dir, name), F[k]);
  console.log(fs.readdirSync(dir).join(' '));
}
