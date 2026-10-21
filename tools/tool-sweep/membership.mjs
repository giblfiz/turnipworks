// Which meshes stand in each Alignment Bench queue, computed with the BENCH'S OWN code (web/align/js/queues.js) and the
// TUNER'S OWN fireType (cut out of tools/spawn-tuner/js/fx/fire.js, which cannot be imported in node: it imports three).
// So the sweep, the check and the page Harry opens can never disagree about who is in a queue.
//   node membership.mjs <library.json> <fire.js> <queues.js> <bench.json or ->   -> JSON on stdout
import fs from 'fs';
import { pathToFileURL } from 'url';
const [libPath, firePath, queuesPath, benchPath] = process.argv.slice(2);
const lib = JSON.parse(fs.readFileSync(libPath, 'utf8'));
const src = fs.readFileSync(firePath, 'utf8');
const m = src.match(/export function fireType\(id = ''\) \{[\s\S]*?\n\}/);
if (!m) { console.error('membership: fireType() not found in ' + firePath); process.exit(2); }
const fireType = new Function(`${m[0].replace('export ', '')}; return fireType;`)();
const { buildQueues } = await import(pathToFileURL(queuesPath).href);
const bench = benchPath && benchPath !== '-' && fs.existsSync(benchPath) ? JSON.parse(fs.readFileSync(benchPath, 'utf8')) : {};
const Q = buildQueues(lib, {}, { fireType, bench });
const slim = (e) => ({ id: e.id, sku: e.sku, mesh: e.mesh, ...(e.type && { type: e.type }), ...(e.kind && { kind: e.kind }), ...(e.twin && { twin: { id: e.twin.id, sku: e.twin.sku, mesh: e.twin.mesh, url: e.twin.url } }), url: e.url });
const types = {};
for (const o of Object.values(lib.objects)) types[o.id] = fireType(o.id);
process.stdout.write(JSON.stringify({ fire: Q.fire.map(slim), water: Q.water.map(slim), open: Q.open.map(slim), fireType: types }));
