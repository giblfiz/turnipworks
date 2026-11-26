// THE MESHY DROP-IN, BATCH 2 (2026-11-10, experiments/2026-11-10-meshy-batch/integration/dropin.json): the skus listed there show the
// Meshy Smart Topology mesh. Their library records name a meshy-02 mesh, keep the old mesh under `was` (its orientation
// records stay filed) and carry `rev` (the colour map's URL changes with the mesh: the .webp ladder is cached 4 h).
// The runtime GLB on disk, where there is one, has the record's bounds (else the solver sizes a mesh that is not shown).
// On the library before the drop-in every sku fails.
//   node tools/spawn-tuner/test/meshy_dropin2.test.mjs [tuner dir]
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const TU = resolve(process.argv[2] || resolve(HERE, '..')), REPO = resolve(TU, '../..');
const D = JSON.parse(readFileSync(resolve(REPO, 'experiments/2026-11-10-meshy-batch/integration/dropin.json')));
const L = JSON.parse(readFileSync(resolve(TU, 'data/library.json')));
let n = 0, fail = 0;
const check = (ok, what, detail = '') => { n++; if (!ok) fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ' — ' + detail : ''}`); };
function glbBounds(path) { // extent of every POSITION accessor's min/max (glTF requires them), x / up / z
  const b = readFileSync(path), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString());
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of j.meshes || []) for (const p of m.primitives) { const a = j.accessors[p.attributes.POSITION]; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a.min[i]); hi[i] = Math.max(hi[i], a.max[i]); } }
  return hi.map((v, i) => v - lo[i]);
}
for (const [sku, stem] of Object.entries(D.choices)) {
  const cat = D.category[sku], rec = L.objects[cat]?.skus.find(s => s.sku === sku);
  check(!!rec, `${sku}: in the library under ${cat}`);
  if (!rec) continue;
  check(rec.src === 'meshy-02' && /^meshy-02\//.test(rec.mesh || ''), `${sku}: shows the Meshy mesh (${stem})`, rec.mesh);
  check(Array.isArray(rec.was) && rec.was.length > 0 && !/^meshy-0[12]\//.test(rec.was[0].mesh), `${sku}: the shipped mesh is kept under was`, rec.was?.[0]?.mesh);
  check(rec.rev && rec.mesh.endsWith('@' + rec.rev), `${sku}: rev busts the colour map's cache`, rec.rev);
  const glb = resolve(TU, rec.url);
  if (existsSync(glb)) {
    const got = glbBounds(glb), off = Math.max(...got.map((v, i) => Math.abs(v - rec.bounds[i]) / Math.max(rec.bounds[i], 1e-6)));
    check(off < 0.02, `${sku}: the runtime GLB has the record's bounds`, `${got.map(v => v.toFixed(3))} vs ${rec.bounds}`);
  } else console.log(`  (no ${rec.url} here: a fresh worktree; the bounds check is skipped)`);
}
console.log(`meshy-dropin2: ${n} checks, ${fail} failures`);
process.exit(fail ? 1 : 0);
