// One City room solved alone, every placement printed (debugging the programs).
//   node experiments/2026-11-06-sprawl/integration/dbg_room.mjs tools/spawn-tuner mod-bar 6 5 833
import { loadTree, makeHarness } from '../../../tools/spawn-tuner/test/ccm_lib.mjs';
const S = await loadTree('mod'), H = makeHarness(S);
const [key, w, d, seed] = process.argv.slice(3);
const B = H.build([H.mk('r', key, 10, 10, +w, +d, +seed, 1)]), L = B.solve('r');
console.log('purpose', L.purposeFail, JSON.stringify(L.modInfo), 'paths', JSON.stringify(L.paths.map(p => [p.kind, p.ok])));
for (const p of L.placements) console.log(p.id, p.sku, p.rule, p.x, p.z, p.rot, p.dims.join('x'));
console.log('unplaced', JSON.stringify(L.unplaced).slice(0, 800));
if (process.argv[7]) { const [px, pz] = process.argv[7].split(',').map(Number), g = L.grid; const i = Math.floor((px - g.x0) / g.res), j = Math.floor((pz - g.z0) / g.res); console.log('grid at', px, pz, '=', g.cells[j * g.nx + i], 'res', g.res, 'openings', JSON.stringify(L.openings)); }
