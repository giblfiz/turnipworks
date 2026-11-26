// node experiments/2026-11-06-cultures-b/tools/dbg_hub.mjs <type> <w> <d> <s> <neighbour type>  (the test's off-hub arrangement, real library)
const [type, w, d, s, hub] = process.argv.slice(2, 7);
const TU = new URL('../../../tools/spawn-tuner/', import.meta.url).pathname;
process.argv = [process.argv[0], process.argv[1], TU];
const { loadTree, makeHarness } = await import(TU + 'test/ccm_lib.mjs');
const S = await loadTree('real'), H = makeHarness(S);
const rooms = [H.mk('h', hub, 10 - 6, 10, 6, Math.max(+d, 4), +s + 1, 1), H.mk('r', type, 10, 10, +w, +d, +s, 2)];
const B = H.build(rooms), L = B.solve('r');
console.log('fail:', L.purposeFail || '-', 'unplaced:', JSON.stringify(L.unplaced).slice(0, 400));
console.log(L.placements.filter(p => p.orient !== 'floor').map(p => `${p.id}@${p.x.toFixed(1)},${p.z.toFixed(1)} [${p.rule}]`).join(' | '));
console.log('doors:', B.E.openings.get('r').filter(o => o.kind === 'door').map(o => `${o.side}${o.index}`).join(' '), 'windows:', B.E.openings.get('r').filter(o => o.kind === 'window').map(o => `${o.side}${o.index}`).join(' '));
