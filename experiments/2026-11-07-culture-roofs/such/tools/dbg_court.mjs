const TU = 'tools/spawn-tuner/';
const [type, w, d, seed] = process.argv.slice(2, 6);
process.argv = [process.argv[0], process.argv[1], TU];
const { loadTree, makeHarness } = await import(TU + 'test/ccm_lib.mjs');
const S = await loadTree('real'), H = makeHarness(S);
for (const id of ['mes-court-wall', 'mes-court-ring']) { const o = S.lib.objects[id]; console.log(id, o.size, o.skus.map(k => k.bounds)); }
const r = H.mk('r', type, 10, 10, +w, +d, +seed, 2), B = H.build([r]), L = B.solve('r');
console.log(L.placements.map(p => `${p.id}@${p.x.toFixed(1)},${p.z.toFixed(1)} dims ${p.dims.map(v=>v.toFixed(1))} [${p.rule}]`).join('\n'));
console.log('unplaced', JSON.stringify(L.unplaced?.slice(0, 12)));
