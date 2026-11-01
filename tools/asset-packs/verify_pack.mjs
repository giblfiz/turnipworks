// Verify one unpacked asset pack: every GLB through the Khronos glTF-Validator AND three.js's GLTFLoader (headless),
// every texture decoded to pixels, and every model's world-space box compared with the size its catalog entry claims.
//
//   node tools/asset-packs/verify_pack.mjs <unpacked pack dir> [--three-dir DIR] [--validator <path to gltf-validator>] [--sharp <path to sharp>]
//
// Prints one JSON line: { pack, glbs, validator: {errors, warnings, codes}, three: {ok, failed}, textures, size: {...}, bad: [...] }
// Exit 1 if any file fails to validate (errors), fails to parse, has an undecodable texture, or is off its catalog size by > 2%.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const dir = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const require = createRequire(import.meta.url);
const validator = require(opt('--validator', '/var/tmp/tw-asset-cost/tools/node_modules/gltf-validator'));
const sharp = require(opt('--sharp', 'tools/spawn-tuner/prep/node_modules/sharp'));
// --three-dir: an installed three@0.170.0 package directory (its GLTFLoader imports 'three' from beside itself)
const T = opt('--three-dir', path.resolve('node_modules/three'));
const THREE = await import(path.join(T, 'build/three.module.js'));
const { GLTFLoader } = await import(path.join(T, 'examples/jsm/loaders/GLTFLoader.js'));

// --- headless image path: GLTFLoader puts an embedded image in a Blob, makes an object URL and hands it to
// ImageBitmapLoader. Keep the blobs, and decode them with sharp to raw pixels (a real decode, not a header read).
globalThis.self = globalThis; // GLTFLoader reads self.URL
const blobs = new Map(); let nBlob = 0;
URL.createObjectURL = (b) => { const u = `blob:verify/${nBlob++}`; blobs.set(u, b); return u; };
URL.revokeObjectURL = (u) => blobs.delete(u);
globalThis.createImageBitmap = globalThis.createImageBitmap || (() => { throw new Error('unused'); });
// EXT_texture_webp: the loader probes browser support with a 1-px WebP in an <img>; say yes (sharp decodes WebP below)
globalThis.Image = class { set src(_) { this.width = this.height = 1; setTimeout(() => this.onload?.()); } };
let decoded = 0;
THREE.ImageBitmapLoader.prototype.load = function (url, onLoad, _p, onError) {
  const b = blobs.get(url);
  if (!b) { onError?.(new Error('image not embedded: ' + url)); return; }
  b.arrayBuffer().then(ab => sharp(Buffer.from(ab)).raw().toBuffer({ resolveWithObject: true })).then(({ data, info }) => {
    if (!info.width || !info.height || data.length < info.width * info.height) throw new Error('empty image');
    decoded++; onLoad({ width: info.width, height: info.height, close() {} });
  }).catch(e => onError?.(e));
};

const cat = JSON.parse(fs.readFileSync(path.join(dir, 'catalog.json'), 'utf8'));
const byFile = new Map(cat.entries.map(e => [e.file, e]));
const out = { pack: cat.pack, tier: cat.tier, glbs: 0, images: 0, validator: { errors: 0, warnings: 0, infos: 0, codes: {} },
              three: { ok: 0, failed: 0 }, textures: 0, size: { checked: 0, worst_pct: 0, worst: null }, bad: [] };
const loader = new GLTFLoader();

for (const e of cat.entries) {
  const f = path.join(dir, e.file);
  if (!fs.existsSync(f)) { out.bad.push([e.file, 'listed but missing']); continue; }
  if (!e.file.endsWith('.glb')) { // an image: decode it
    try { await sharp(f).raw().toBuffer(); out.images++; } catch (err) { out.bad.push([e.file, 'image: ' + err.message]); }
    continue;
  }
  out.glbs++;
  const bytes = new Uint8Array(fs.readFileSync(f));
  const rep = await validator.validateBytes(bytes, { maxIssues: 50 });
  const iss = rep.issues;
  out.validator.errors += iss.numErrors; out.validator.warnings += iss.numWarnings; out.validator.infos += iss.numInfos;
  for (const m of iss.messages) if (m.severity <= 1) out.validator.codes[m.code] = (out.validator.codes[m.code] || 0) + 1;
  if (iss.numErrors) out.bad.push([e.file, 'validator: ' + iss.messages.filter(m => m.severity === 0).map(m => m.code).join(',')]);
  try {
    const before = decoded;
    const g = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    let meshes = 0, maps = 0;
    g.scene.traverse(o => { if (o.isMesh) { meshes++; if (o.material?.map?.image?.width > 0) maps++; } });
    if (!meshes || maps < meshes || decoded === before) throw new Error(`meshes ${meshes}, textured ${maps}`);
    out.textures += decoded - before; out.three.ok++;
    g.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g.scene), s = box.getSize(new THREE.Vector3());
    if (Math.abs(box.min.y) > 0.01 * Math.max(s.y, 0.01)) out.bad.push([e.file, `not standing on the origin: min y ${box.min.y.toFixed(4)}`]);
    // the size claim: props and figures by their largest dimension (uniform scale), kit pieces per axis
    let pct;
    if (e.size_m) {
      const want = e.size_m, kit = e.placement === 'kit' || (e.applied_scale && new Set(e.applied_scale.map(v => v.toFixed(5))).size > 1);
      if (kit) {
        // kitScale stretches in the mesh's own axes so that AFTER the yaw the world box is the catalog box: x = width,
        // y = height, z = depth, whatever the yaw (only 0/90/180/270 are exact; others are checked loosely below)
        const got = [s.x, s.y, s.z], w = [want[0], want[2], want[1]]; // catalog is w x d x h; world is x, y(up), z
        const q = ((Math.round(e.applied_yaw_deg || 0) % 90) + 90) % 90;
        pct = q ? Math.abs(s.y - w[1]) / w[1] * 100 : Math.max(...got.map((v, i) => Math.abs(v - w[i]) / Math.max(w[i], 1e-3) * 100));
      } else {
        // props scale uniformly in their OWN frame; turned off-axis (a 45/135 deg tuner correction) the world box grows,
        // so measure the model with the root node's yaw taken back out
        let t = s;
        if (((Math.round(e.applied_yaw_deg || 0) % 90) + 90) % 90) {
          const root = g.scene.children.length === 1 ? g.scene.children[0] : null;
          if (root) { const r = root.rotation.y; root.rotation.y = 0; g.scene.updateMatrixWorld(true); t = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3()); root.rotation.y = r; }
        }
        pct = Math.abs(Math.max(t.x, t.y, t.z) - Math.max(...want)) / Math.max(...want) * 100;
      }
    } else if (e.measured_height_m) {
      pct = Math.abs(s.y - e.measured_height_m) / e.measured_height_m * 100;
    }
    if (pct != null) {
      out.size.checked++;
      if (pct > out.size.worst_pct) { out.size.worst_pct = +pct.toFixed(3); out.size.worst = e.file; }
      if (pct > 2) out.bad.push([e.file, `size off by ${pct.toFixed(1)}%`]);
    }
  } catch (err) { out.three.failed++; out.bad.push([e.file, 'three: ' + (err.message || err)]); }
}
// every file in models/ must be in the catalog
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]);
for (const f of walk(dir)) { const rel = path.relative(dir, f); if ((rel.startsWith('models/') || rel.startsWith('images/')) && !byFile.has(rel)) out.bad.push([rel, 'not in catalog']); }
for (const need of ['LICENSE-ASSETS', 'ATTRIBUTION.txt', 'README.md', 'catalog.csv']) if (!fs.existsSync(path.join(dir, need))) out.bad.push([need, 'missing']);
console.log(JSON.stringify(out));
process.exit(out.bad.length ? 1 : 0);
