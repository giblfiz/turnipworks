// debug: the mansion-dining plates over the feast table (resting.test.mjs flags them)
import { loadTree, makeHarness } from '../../tools/spawn-tuner/test/ccm_lib.mjs';
const S = await loadTree('x'), H = makeHarness(S);
const [type, w, d, seed] = [process.argv[3] || 'mansion-dining', +(process.argv[4] || 8), +(process.argv[5] || 6), +(process.argv[6] || 163)];
const r = H.mk('r', type, 10, 10, w, d, seed, 1), B = H.build([r]), L = B.solve('r');
const pat = new RegExp(process.argv[7] || 'table-feast|plate-silver|goblet|dais|platform');
for (const p of L.placements) if (pat.test(p.id)) console.log(JSON.stringify({ uid: p.uid, id: p.id, sku: p.sku, rule: p.rule, x: +p.x.toFixed(2), y: +(p.y || 0).toFixed(3), z: +p.z.toFixed(2), dims: p.dims.map(v => +v.toFixed(3)), s: p.s?.map(v => +v.toFixed(3)), parent: p.parent, on: p.on }));
