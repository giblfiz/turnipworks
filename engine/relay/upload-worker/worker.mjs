// THE UPLOAD CONVERTER (2026-11-06; docs/UPLOADS.md). One job: a stranger's model file in, our own three tiers out.
//
//   node worker.mjs <jobDir>        reads <jobDir>/in.bin and <jobDir>/opts.json, writes <jobDir>/out/t0.glb t1.glb
//                                   t2.glb, prints ONE line of JSON on stdout: { ok, ... } or { ok: false, why }
//
// relay/uploads.js is the only caller, and it runs this in a box: node's permission model (no reading outside this folder
// and the job folder, no writing outside the job folder, no child processes, no workers), the network shut off in-process
// (sandbox.mjs, loaded first), a CPU-seconds and file-size limit (prlimit), a lower priority (nice), a wall-clock timeout
// and a memory watch that kills it. The file is DATA: nothing in it is ever run, fetched or followed.
//
// What comes out is rebuilt, never passed through: the scene is flattened into plain meshes, every external reference,
// animation, skin, morph target, camera, light, script-ish extra and unknown extension is gone, every picture is decoded
// by an allow-listed decoder and re-encoded as WebP at our sizes, the geometry is simplified to our tiers and meshopt-
// compressed the way docs/ASSET_DELIVERY.md compresses the library, and each tier is read back and validated (Khronos
// glTF-Validator: zero errors) before it counts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization, KHRTextureTransform, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { dedup, flatten, join, weld, prune, simplify, meshopt, textureCompress, getBounds, unpartition, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import validator from 'gltf-validator';
import { LIMITS, TIERS, PEWTER } from './limits.mjs';

// libvips may only DECODE the three picture formats a model is allowed to carry, and only from memory (never a file
// name, never a URL: libvips has loaders for those too, and a native addon is outside node's permission model)
sharp.block({ operation: ['VipsForeignLoad'] });
sharp.unblock({ operation: ['VipsForeignLoadPngBuffer', 'VipsForeignLoadJpegBuffer', 'VipsForeignLoadWebpBuffer'] });
sharp.cache(false); sharp.concurrency(1);

class Refuse extends Error { constructor(why) { super(why); this.refuse = true; } }
const refuse = (why) => { throw new Refuse(why); };
const quiet = { debug() {}, info() {}, warn() {}, error() {} };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const KEPT_EXT = new Set(['KHR_mesh_quantization', 'KHR_texture_transform', 'EXT_meshopt_compression', 'EXT_texture_webp', 'KHR_materials_emissive_strength']);
const io = () => new NodeIO().setAllowNetwork(false)
  .registerExtensions([EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization, KHRTextureTransform, KHRMaterialsEmissiveStrength])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// ---------------------------------------------------------------- what kind of file
export function sniff(buf, hint = '') {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'glTF') return 'glb';
  const head = buf.toString('latin1', 0, Math.min(buf.length, 512)).replace(/^﻿/, '').trimStart();
  if (head.startsWith('{')) return 'gltf';
  if (buf.length >= 84 && 84 + 50 * buf.readUInt32LE(80) === buf.length) return 'stl';
  if (/^solid\b/i.test(head) && /\bfacet\b/i.test(buf.toString('latin1', 0, Math.min(buf.length, 4096)))) return 'stl-ascii';
  if (/^(#.*\n|\s*\n|(v|vn|vt|f|o|g|s|mtllib|usemtl)\s)/m.test(head) && /^v\s+-?[\d.]/m.test(buf.toString('latin1', 0, Math.min(buf.length, 65536)))) return 'obj';
  if (hint === 'obj' && /^v\s/m.test(head)) return 'obj';
  return null;
}

// ---------------------------------------------------------------- glTF: checked as JSON before any library sees it
function depthOk(text, max) { let d = 0, inStr = false; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); if (inStr) { if (c === 92) i++; else if (c === 34) inStr = false; continue; } if (c === 34) inStr = true; else if (c === 123 || c === 91) { if (++d > max) return false; } else if (c === 125 || c === 93) d--; } return true; }
const PROTO = /"(__proto__|constructor|prototype)"\s*:/;
function parseJson(text) {
  if (text.length > LIMITS.jsonBytes) refuse(`its scene description is over ${LIMITS.jsonBytes / 1048576} MB`);
  if (!depthOk(text, 64)) refuse('its scene description is nested too deeply');
  if (PROTO.test(text)) refuse('its scene description has a forbidden key');
  try { return JSON.parse(text); } catch { refuse('its scene description is not valid JSON'); }
}
const IMG_MAGIC = (b) => b.length >= 12 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG' ? 'image/png' : b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'image/jpeg' : b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
// a picture's size from its header alone (a decompression bomb is a small file that says it is huge): null = unreadable
export function imageSize(b) {
  const t = IMG_MAGIC(b);
  if (t === 'image/png') return b.length >= 24 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
  if (t === 'image/webp') {
    const k = b.toString('ascii', 12, 16);
    if (k === 'VP8X' && b.length >= 30) return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (k === 'VP8L' && b.length >= 25) { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    if (k === 'VP8 ' && b.length >= 30) return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    return null;
  }
  if (t === 'image/jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1]; if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
    return null;
  }
  return null;
}
const COMP = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
function dataUri(uri) {
  const m = /^data:([\w/+.-]*)(;base64)?,/.exec(uri); if (!m || !m[2]) return null;
  const body = uri.slice(m[0].length);
  if (body.length * 0.75 > LIMITS.bytes) refuse('an embedded file is too large');
  return Buffer.from(body, 'base64');
}

// glTF JSON + its binary resources -> the JSON we let gltf-transform read, with every resource already in memory.
// Everything not on the allow list is removed here, and said in `notes` (the GM is told what was left behind).
export function cleanGltf(json, glbBin, notes) {
  if (typeof json !== 'object' || !json || Array.isArray(json)) refuse('its scene description is not a glTF object');
  if (String(json.asset?.version || '').split('.')[0] !== '2') refuse('only glTF 2.0 files are read');
  const req = (json.extensionsRequired || []).filter(x => !KEPT_EXT.has(x));
  if (req.includes('KHR_draco_mesh_compression')) refuse('Draco-compressed files are not read yet: export it again without Draco compression');
  if (req.length) refuse(`it needs ${req.slice(0, 3).join(', ')}, which we do not read`);
  const count = (k, max, what) => { const n = Array.isArray(json[k]) ? json[k].length : 0; if (json[k] != null && !Array.isArray(json[k])) refuse(`${k} is not a list`); if (n > max) refuse(`it has ${n} ${what} (at most ${max})`); return n; };
  count('nodes', LIMITS.nodes, 'nodes'); count('meshes', LIMITS.meshes, 'meshes'); count('materials', LIMITS.materials, 'materials');
  count('textures', LIMITS.textures, 'textures'); count('images', LIMITS.images, 'pictures'); count('accessors', LIMITS.accessors, 'accessors');
  count('bufferViews', LIMITS.accessors, 'buffer views'); count('samplers', 64, 'samplers'); count('scenes', 16, 'scenes'); count('buffers', 16, 'buffers');
  // drop what we never keep, before anything reads it
  const dropped = (k, what) => { if (Array.isArray(json[k]) && json[k].length) { notes.push(`${json[k].length} ${what} left out`); } delete json[k]; };
  dropped('animations', 'animation(s)'); dropped('skins', 'skin(s)'); dropped('cameras', 'camera(s)');
  const strip = (o) => { if (!o || typeof o !== 'object') return; delete o.extras; if (o.extensions && typeof o.extensions === 'object') for (const k of Object.keys(o.extensions)) if (!KEPT_EXT.has(k)) delete o.extensions[k]; };
  const unknownUsed = (json.extensionsUsed || []).filter(x => !KEPT_EXT.has(x));
  if (unknownUsed.length) notes.push(`extensions left out: ${unknownUsed.slice(0, 6).join(', ')}`);
  json.extensionsUsed = (json.extensionsUsed || []).filter(x => KEPT_EXT.has(x)); json.extensionsRequired = (json.extensionsRequired || []).filter(x => KEPT_EXT.has(x));
  strip(json); strip(json.asset);
  for (const k of ['nodes', 'meshes', 'materials', 'textures', 'images', 'accessors', 'bufferViews', 'samplers', 'scenes', 'buffers']) for (const o of json[k] || []) strip(o);
  let prims = 0, tris = 0, morphs = 0;
  for (const m of json.meshes || []) {
    if (!Array.isArray(m.primitives)) refuse('a mesh has no primitives list');
    delete m.weights;
    for (const p of m.primitives) {
      if (++prims > LIMITS.primitives) refuse(`it has over ${LIMITS.primitives} mesh parts`);
      strip(p); if (p.targets) { morphs++; delete p.targets; } delete p.extensions;
      const mode = p.mode ?? 4; if (mode !== 4) { p.__drop = true; continue; } // points, lines, strips, fans: not drawn (the rest of the file still is)
      const acc = json.accessors?.[p.indices ?? p.attributes?.POSITION]; const n = acc?.count || 0;
      tris += (p.indices != null ? n : n) / 3;
      for (const a of Object.keys(p.attributes || {})) if (!/^(POSITION|NORMAL|TEXCOORD_0|TEXCOORD_1|COLOR_0|TANGENT)$/.test(a)) delete p.attributes[a]; // JOINTS/WEIGHTS and custom _ATTRIBUTES go
    }
    const before = m.primitives.length; m.primitives = m.primitives.filter(p => !p.__drop);
    if (m.primitives.length < before) notes.push(`${before - m.primitives.length} point or line part(s) left out`);
  }
  if (morphs) notes.push(`${morphs} morph target set(s) left out`);
  if (tris > LIMITS.trianglesIn) refuse(`it has about ${Math.round(tris).toLocaleString('en-US')} triangles; the most we take is ${LIMITS.trianglesIn.toLocaleString('en-US')} (the Import Lab reduces a big model in your browser first)`);
  if (tris < 1) refuse('it has no triangles');
  for (const n of json.nodes || []) { delete n.skin; delete n.camera; delete n.weights; if (n.children && !Array.isArray(n.children)) refuse('a node has a bad child list'); }
  // accessors: every count bounded, so nothing allocates more than the limit (a sparse accessor with no buffer is all zeros of `count`)
  for (const a of json.accessors || []) {
    if (!(Number.isInteger(a.count) && a.count >= 0 && a.count <= LIMITS.accessorCount)) refuse('an accessor is too large');
    if (!COMP[a.componentType] || !NCOMP[a.type]) refuse('an accessor has an unknown type');
    if (a.sparse && !(Number.isInteger(a.sparse.count) && a.sparse.count <= a.count)) refuse('a sparse accessor is malformed');
  }
  // buffers and pictures: only what is inside the file. A link to anything outside (a web address, a file beside it) is refused for
  // geometry (it cannot be drawn without it) and left out for pictures (the model is drawn without that picture).
  const resources = {};
  (json.buffers || []).forEach((b, i) => {
    if (b.uri == null && b.extensions?.EXT_meshopt_compression?.fallback) { resources[`tw-fallback-${i}.bin`] = Buffer.alloc(0); return; } // (a meshopt placeholder buffer: nothing in it)
    if (b.uri == null) { if (i !== 0 || !glbBin) refuse('a buffer has no data'); resources['@glb.bin'] = glbBin; return; }
    const bytes = typeof b.uri === 'string' && b.uri.startsWith('data:') ? dataUri(b.uri) : null;
    if (!bytes) refuse('it refers to a file outside itself (a separate .bin): export it as a single .glb');
    const key = `tw-buffer-${i}.bin`; resources[key] = bytes; b.uri = key;
  });
  let unpacked = 0; // what meshopt-compressed views say they decode to: a small file that unpacks to gigabytes is refused before it is decoded
  for (const v of json.bufferViews || []) {
    const M = v.extensions?.EXT_meshopt_compression;
    if (M) {
      const src = json.buffers?.[M.buffer], sb = src && (src.uri ? resources[src.uri] : resources['@glb.bin']);
      if (!sb || !(Number.isInteger(M.byteLength) && (M.byteOffset || 0) + M.byteLength <= sb.length)) refuse('a compressed buffer view points outside its buffer');
      if (!(Number.isInteger(M.count) && Number.isInteger(M.byteStride) && M.count >= 0 && M.byteStride > 0 && M.byteStride <= 256)) refuse('a compressed buffer view is malformed');
      unpacked += M.count * M.byteStride;
      if (unpacked > LIMITS.unpackedBytes) refuse(`its compressed geometry unpacks to over ${LIMITS.unpackedBytes / 1048576} MB`);
      continue; // (its own buffer may be a placeholder with no bytes: the compressed copy is what is read)
    }
    const buf = json.buffers?.[v.buffer]; const bytes = buf && (buf.uri ? resources[buf.uri] : resources['@glb.bin']);
    if (!bytes || !(Number.isInteger(v.byteLength) && v.byteLength >= 0 && (v.byteOffset || 0) + v.byteLength <= bytes.length)) refuse('a buffer view points outside its buffer');
  }
  let pics = 0;
  (json.images || []).forEach((im, i) => {
    let bytes = null;
    if (typeof im.uri === 'string') { if (im.uri.startsWith('data:')) bytes = dataUri(im.uri); else { notes.push('a picture linked from outside the file was left out'); } }
    else if (im.bufferView != null) { const v = json.bufferViews?.[im.bufferView]; const buf = v && json.buffers?.[v.buffer]; const all = buf && (buf.uri ? resources[buf.uri] : resources['@glb.bin']); bytes = all ? all.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength) : null; }
    const type = bytes && IMG_MAGIC(bytes), size = bytes && imageSize(bytes);
    const ok = type && size && size[0] > 0 && size[1] > 0 && size[0] <= LIMITS.imageSide && size[1] <= LIMITS.imageSide && bytes.length <= LIMITS.imageBytes;
    if (!ok) {
      if (bytes) notes.push(!type ? 'a picture in a format we do not read was left out' : !size ? 'an unreadable picture was left out' : `a picture over ${LIMITS.imageSide} px or ${LIMITS.imageBytes / 1048576} MB was left out`);
      im.__drop = true; return;
    }
    pics++;
    const key = `tw-image-${i}${type === 'image/png' ? '.png' : type === 'image/jpeg' ? '.jpg' : '.webp'}`;
    resources[key] = Buffer.from(bytes); im.uri = key; im.mimeType = type; delete im.bufferView;
  });
  // a dropped picture: every texture that used it, and every material slot that used those, goes (the colour factor stays)
  const goneTex = new Set();
  (json.textures || []).forEach((t, i) => { const src = t.source ?? t.extensions?.EXT_texture_webp?.source; if (src == null || json.images?.[src]?.__drop) goneTex.add(i); });
  if (goneTex.size) {
    const walk = (o) => { if (!o || typeof o !== 'object') return; for (const k of Object.keys(o)) { const v = o[k]; if (v && typeof v === 'object' && Number.isInteger(v.index) && /Texture$/.test(k) && goneTex.has(v.index)) delete o[k]; else walk(v); } };
    for (const m of json.materials || []) walk(m);
  }
  return { json, resources, tris: Math.round(tris), pictures: pics };
}

// ---------------------------------------------------------------- STL and OBJ: geometry only, built by hand
function meshDoc(pos, idx, zUp, name) {
  const doc = new Document(); doc.setLogger(quiet);
  const buf = doc.createBuffer();
  if (zUp) for (let i = 0; i < pos.length; i += 3) { const y = pos[i + 1]; pos[i + 1] = pos[i + 2]; pos[i + 2] = -y; } // Z up (print files) -> Y up
  const P = doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', P);
  if (idx) prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf));
  const mesh = doc.createMesh(name).addPrimitive(prim);
  doc.createScene().addChild(doc.createNode(name).setMesh(mesh));
  return doc;
}
function finite(a) { for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) refuse('it has a corner at an impossible position'); return a; }
export function readStl(buf, ascii, zUp) {
  if (!ascii) {
    const n = buf.readUInt32LE(80); if (!n) refuse('it has no triangles');
    if (n > LIMITS.trianglesIn) refuse(`it has ${n.toLocaleString('en-US')} triangles; the most we take is ${LIMITS.trianglesIn.toLocaleString('en-US')}`);
    const pos = new Float32Array(n * 9);
    for (let t = 0; t < n; t++) for (let k = 0; k < 9; k++) pos[t * 9 + k] = buf.readFloatLE(84 + t * 50 + 12 + k * 4);
    return meshDoc(finite(pos), null, zUp, 'stl');
  }
  const text = buf.toString('latin1'), out = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g; let m;
  while ((m = re.exec(text))) { out.push(+m[1], +m[2], +m[3]); if (out.length > LIMITS.trianglesIn * 9) refuse(`it has over ${LIMITS.trianglesIn.toLocaleString('en-US')} triangles`); }
  const n = Math.floor(out.length / 9); if (!n) refuse('it has no triangles');
  return meshDoc(finite(new Float32Array(out.slice(0, n * 9))), null, zUp, 'stl');
}
export function readObj(buf, zUp) {
  const text = buf.toString('latin1'), v = [], idx = [];
  let lines = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (++lines > LIMITS.objLines) refuse('it is too long');
    const line = raw.trim(); if (!line || line[0] === '#') continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v') { if (v.length / 3 >= LIMITS.accessorCount) refuse('it has too many corners'); v.push(+parts[1], +parts[2], +parts[3]); }
    else if (parts[0] === 'f') {
      const f = parts.slice(1).map(p => { let i = parseInt(p.split('/')[0], 10); if (i < 0) i = v.length / 3 + i + 1; return i - 1; });
      if (f.length < 3 || f.some(i => !(Number.isInteger(i) && i >= 0 && i < v.length / 3))) refuse('a face points at a corner that is not there');
      for (let k = 1; k + 1 < f.length; k++) { idx.push(f[0], f[k], f[k + 1]); if (idx.length / 3 > LIMITS.trianglesIn) refuse(`it has over ${LIMITS.trianglesIn.toLocaleString('en-US')} triangles`); }
    }
    // (vt, vn, mtllib, usemtl, o, g, s: not used. An .obj's materials and pictures are separate files, which we never read)
  }
  if (!idx.length) refuse('it has no faces');
  return meshDoc(finite(new Float32Array(v)), new Uint32Array(idx), zUp, 'obj');
}

// SMOOTH NORMALS for a part that has none (print files never do). gltf-transform's normals() makes FLAT ones by
// unwelding every triangle, which leaves nothing for the simplifier to collapse; these are area-weighted per corner.
function smoothNormals(doc) {
  const buf = doc.getRoot().listBuffers()[0] || doc.createBuffer();
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const P = p.getAttribute('POSITION'), I = p.getIndices(); if (!P || p.getAttribute('NORMAL')) continue;
    const n = P.getCount(), N = new Float32Array(n * 3), a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
    const tri = I ? I.getCount() / 3 : n / 3, at = (k) => I ? I.getScalar(k) : k;
    for (let t = 0; t < tri; t++) {
      const i0 = at(3 * t), i1 = at(3 * t + 1), i2 = at(3 * t + 2); P.getElement(i0, a); P.getElement(i1, b); P.getElement(i2, c);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [i0, i1, i2]) { N[3 * i] += nx; N[3 * i + 1] += ny; N[3 * i + 2] += nz; }
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(N[3 * i], N[3 * i + 1], N[3 * i + 2]) || 1; N[3 * i] /= l; N[3 * i + 1] /= l; N[3 * i + 2] /= l; if (!Number.isFinite(N[3 * i])) { N[3 * i] = 0; N[3 * i + 1] = 1; N[3 * i + 2] = 0; } }
    p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(buf));
  }
}

// ---------------------------------------------------------------- the hard reductions (a tier the plain simplifier could not reach)
// mode 'seams': meshopt's simplifier with attributes and the Permissive flag: it may collapse across a UV seam, and the
// texture coordinates are part of the error it minimises, so the picture slides as little as it can. mode 'sloppy': the
// topology-blind simplifier (clusters corners in space): worse geometry, but it reaches any target. Both keep the
// primitive's own corners (only the triangle list changes), so every attribute stays as it was.
function floatArray(acc) {
  const a = acc.getArray(); if (a instanceof Float32Array && !acc.getNormalized()) return a;
  const n = acc.getCount(), k = acc.getElementSize(), out = new Float32Array(n * k), el = new Array(k);
  for (let i = 0; i < n; i++) { acc.getElement(i, el); for (let j = 0; j < k; j++) out[i * k + j] = el[j]; }
  return out;
}
function reduceHard(doc, target, mode) {
  const total = measure(doc).tris; if (total <= target) return;
  const ratio = target / total;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const P = p.getAttribute('POSITION'); if (!P) continue;
    const pos = floatArray(P), nv = P.getCount();
    let I = p.getIndices(), idx = I ? Uint32Array.from(I.getArray()) : Uint32Array.from({ length: nv }, (_, i) => i);
    const want = Math.max(3, Math.floor(ratio * idx.length / 3) * 3);
    if (want >= idx.length) continue;
    let dst;
    if (mode === 'seams') {
      const uv = p.getAttribute('TEXCOORD_0'), attr = uv ? floatArray(uv) : new Float32Array(0);
      [dst] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, attr, uv ? 2 : 0, uv ? [0.5, 0.5] : [], null, want, 1, ['Permissive']);
    } else {
      [dst] = MeshoptSimplifier.simplifySloppy(idx, pos, 3, null, want, 1);
    }
    if (!dst || dst.length < 3 || dst.length >= idx.length) continue;
    const buf = (I || P).getBuffer() || doc.getRoot().listBuffers()[0];
    const next = doc.createAccessor().setType('SCALAR').setArray(nv <= 65534 ? new Uint16Array(dst) : new Uint32Array(dst)).setBuffer(buf);
    p.setIndices(next); if (I && !I.listParents().some(x => x !== doc.getRoot())) I.dispose();
    compactPrimitive(p);
  }
}

// ---------------------------------------------------------------- measuring
function measure(doc) {
  let tris = 0, verts = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) { const P = p.getAttribute('POSITION'); if (!P) continue; const I = p.getIndices(); verts += P.getCount(); tris += (I ? I.getCount() : P.getCount()) / 3; }
  return { tris: Math.round(tris), verts };
}
const sceneOf = (doc) => doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];

// ---------------------------------------------------------------- the job
export async function convert(input, opts = {}) {
  const notes = [];
  if (input.length > LIMITS.bytes) refuse(`it is over ${LIMITS.bytes / 1048576} MB`);
  const kind = sniff(input, opts.ext || '');
  if (!kind) refuse('it is not a model we read (.glb, .gltf with everything inside it, .stl or .obj)');
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const zUp = opts.up === 'z' || (opts.up !== 'y' && (kind === 'stl' || kind === 'stl-ascii')); // a print file stands on Z; everything else on Y
  let doc, inputReport = null;
  if (kind === 'glb' || kind === 'gltf') {
    let json, bin = null;
    if (kind === 'glb') {
      if (input.readUInt32LE(4) !== 2) refuse('only glTF 2.0 files are read');
      if (input.readUInt32LE(8) !== input.length) refuse('the file is cut short or has extra bytes (its length does not match)');
      let o = 12, jsonText = null;
      while (o + 8 <= input.length) {
        const len = input.readUInt32LE(o), type = input.readUInt32LE(o + 4);
        if (o + 8 + len > input.length) refuse('a part of the file runs past its end');
        if (type === 0x4e4f534a && jsonText === null) jsonText = input.toString('utf8', o + 8, o + 8 + len);
        else if (type === 0x004e4942 && !bin) bin = input.subarray(o + 8, o + 8 + len);
        o += 8 + len; // (a chunk's length already counts its padding)
      }
      if (jsonText == null) refuse('it has no scene description');
      json = parseJson(jsonText);
    } else json = parseJson(input.toString('utf8').replace(/^﻿/, ''));
    const C = cleanGltf(json, bin, notes);
    // the validator reads the ORIGINAL too, for the record, but only once our own checks have bounded it (an accessor
    // that says it holds a billion elements made it spin), and it may fetch nothing
    if (kind === 'glb') { try { const r = await validator.validateBytes(new Uint8Array(input), { maxIssues: 20, externalResourceFunction: () => Promise.reject(new Error('no external resources')) }); inputReport = { errors: r.issues.numErrors, warnings: r.issues.numWarnings }; } catch { inputReport = { errors: -1 }; } }
    const reader = io();
    try { doc = await reader.readJSON({ json: C.json, resources: C.resources }); } catch (e) { refuse(`it could not be read (${String(e.message || e).slice(0, 120)})`); }
  } else if (kind === 'stl' || kind === 'stl-ascii') doc = readStl(input, kind === 'stl-ascii', zUp);
  else doc = readObj(input, zUp);
  doc.setLogger(quiet);
  if (zUp && kind !== 'stl' && kind !== 'stl-ascii' && kind !== 'obj') { const s = sceneOf(doc); const r = doc.createNode('tw-zup').setRotation([-Math.SQRT1_2, 0, 0, Math.SQRT1_2]); for (const c of s.listChildren()) { s.removeChild(c); r.addChild(c); } s.addChild(r); }

  // one scene, flat: other scenes go, every node's transform is baked into its mesh, meshes of one material become one
  const root = doc.getRoot(), main = sceneOf(doc); if (!main) refuse('it has no scene');
  for (const s of root.listScenes()) if (s !== main) s.dispose();
  for (const a of root.listAnimations()) a.dispose(); for (const s of root.listSkins()) s.dispose(); for (const c of root.listCameras()) c.dispose();
  await doc.transform(unpartition(), dedup(), flatten(), join({ keepNamed: false }), weld(), prune({ keepLeaves: false }));
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) if (!p.getAttribute('POSITION')) p.dispose();
  const before = measure(doc); if (!before.tris) refuse('it has no triangles');

  // its size: base on the ground, centred, its longest side 1 (like every generated mesh); the game scales it to real size
  const b = getBounds(main), size = [0, 1, 2].map(k => b.max[k] - b.min[k]), L = Math.max(...size);
  if (!(L > 0 && Number.isFinite(L))) refuse('it has no size');
  if (Math.min(...size) / L < 1e-6 && size.filter(x => x / L < 1e-6).length > 1) refuse('it is a line, not a model');
  const top = doc.createNode('tw-root').setScale([1 / L, 1 / L, 1 / L]).setTranslation([-(b.min[0] + size[0] / 2) / L, -b.min[1] / L, -(b.min[2] + size[2] / 2) / L]);
  for (const c of main.listChildren()) { main.removeChild(c); top.addChild(c); }
  main.addChild(top);
  await doc.transform(flatten());

  // uncoloured (no picture, no colour of its own): the pewter miniature look (docs/IMPORTS.md "Decided")
  const mats = root.listMaterials(), textured = mats.some(m => m.getBaseColorTexture());
  const plain = !textured && (mats.length === 0 || mats.every(m => { const f = m.getBaseColorFactor(); return f[0] > 0.95 && f[1] > 0.95 && f[2] > 0.95; }));
  if (plain) {
    const pewter = doc.createMaterial('pewter').setBaseColorFactor(PEWTER.color).setMetallicFactor(PEWTER.metallic).setRoughnessFactor(PEWTER.roughness);
    for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) p.setMaterial(pewter);
    await doc.transform(prune());
  }
  for (const t of root.listTextures()) { const im = t.getImage(); if (!im || !IMG_MAGIC(Buffer.from(im))) t.dispose(); }
  // a picture on a part that has no texture coordinates cannot be drawn (and does not validate): that part loses its pictures
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial(); if (!m || p.getAttribute('TEXCOORD_0')) continue;
    if (![m.getBaseColorTexture(), m.getNormalTexture(), m.getEmissiveTexture(), m.getOcclusionTexture(), m.getMetallicRoughnessTexture()].some(Boolean)) continue;
    p.setMaterial(m.clone().setBaseColorTexture(null).setNormalTexture(null).setEmissiveTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null));
    notes.push('pictures on a part with no texture coordinates were left out');
  }
  await doc.transform(prune());

  // the intermediate, from which each tier is made
  const W = io(), mid = await W.writeBinary(doc);
  const out = opts.outDir; fs.mkdirSync(out, { recursive: true });
  const tiers = [];
  for (const T of TIERS) {
    const d = await W.readBinary(mid); d.setLogger(quiet);
    const have = measure(d).tris;
    let how = 'as-is';
    if (have > T.tris) {
      how = 'simplify';
      for (const error of [0.002, 0.01, 0.05, 0.2]) {
        const ratio = T.tris / measure(d).tris; if (ratio >= 1) break;
        await d.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }));
        if (measure(d).tris <= T.tris * 1.15) break;
      }
      // (2026-11-23, F1) a textured model's UV seams lock the plain simplifier: a corner on a seam is two corners and it
      // will not collapse across one. A generated figure has hundreds of UV islands, so ours (20,000 triangles, 1024 px)
      // stopped near 3,000 and were refused at the 1,500 tier. Next, while the tier is still over: collapse ACROSS seams
      // (meshopt's Permissive mode, the texture coordinates weighed into its error), a few passes while each still gains.
      // That gets our figures to 1.7-2.4x the low tier's aim with their pictures intact, and the tier ships there: a
      // BEST-EFFORT tier, never refused for its count (the byte cap below and the 500,000-triangle cap on input still
      // bound it, and the box's CPU and time limits bound the passes). Only a model still over 3x the aim (a triangle soup, which
      // no topology-following simplifier can reduce) goes through the topology-blind (sloppy) simplifier, which reaches
      // any count but scrambles a picture: measured 2026-11-23, it turned the 20k figures' 1,500 tier to confetti.
      for (let k = 0; k < 4 && measure(d).tris > T.tris * 1.15; k++) { const b4 = measure(d).tris; reduceHard(d, T.tris, 'seams'); how = 'seams'; if (measure(d).tris > b4 * 0.97) break; }
      if (measure(d).tris > T.tris * 3) { reduceHard(d, T.tris, 'sloppy'); how = 'sloppy'; }
      await d.transform(weld(), prune());
    }
    smoothNormals(d);
    const got = measure(d);
    if (got.tris > T.tris * 1.15) how += '+best-effort';
    if (d.getRoot().listTextures().length) await d.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [T.tex, T.tex], quality: 82 }));
    await d.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const bytes = Buffer.from(await W.writeBinary(d));
    if (bytes.length > T.maxBytes) refuse(`its ${T.name === 't0' ? 'high' : T.name === 't1' ? 'medium' : 'low'}-detail copy came out over ${T.maxBytes / 1048576} MB: try it with smaller pictures (2048 px is plenty) or fewer triangles`);
    // read back and validate: what we serve must be a clean glTF (zero errors), and still the model
    const report = await validator.validateBytes(new Uint8Array(bytes), { maxIssues: 10, externalResourceFunction: () => Promise.reject(new Error('none')) });
    if (report.issues.numErrors) refuse(`our ${T.name} copy did not validate (${report.issues.messages.filter(m => m.severity === 0).map(m => m.code).slice(0, 3).join(', ')})`);
    const back = await W.readBinary(new Uint8Array(bytes)); const bb = getBounds(sceneOf(back));
    const nb = [0, 1, 2].map(k => +(bb.max[k] - bb.min[k]).toFixed(4));
    fs.writeFileSync(path.join(out, `${T.name}.glb`), bytes);
    tiers.push({ name: T.name, tris: got.tris, how, bytes: bytes.length, sha: sha(bytes).slice(0, 16), bounds: nb, textures: back.getRoot().listTextures().length });
  }
  const bounds = tiers[0].bounds; // [w, h, d] with the longest side 1
  return { ok: true, format: kind, up: zUp ? 'z' : 'y', trianglesIn: before.tris, bounds, size: size.map(x => +x.toPrecision(6)), plain, notes: [...new Set(notes)].slice(0, 12), input: inputReport, tiers };
}

// ---------------------------------------------------------------- as a process
const realOf = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && realOf(new URL(import.meta.url).pathname) === realOf(process.argv[1])) {
  const job = process.argv[2];
  let r;
  try {
    const input = fs.readFileSync(path.join(job, 'in.bin'));
    const opts = JSON.parse(fs.readFileSync(path.join(job, 'opts.json'), 'utf8'));
    r = await convert(input, { ...opts, outDir: path.join(job, 'out') });
  } catch (e) { r = { ok: false, why: e.refuse ? e.message : `it could not be converted (${String(e?.message || e).slice(0, 160)})`, refused: !!e.refuse }; }
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(0);
}
