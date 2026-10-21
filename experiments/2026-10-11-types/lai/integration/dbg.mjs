const [, , tree, key, w, d, seed] = process.argv;
const path = await import('node:path'); const dir = path.resolve(tree) + '/';
const { loadTree, makeHarness } = await import('file://' + dir + 'test/ccm_lib.mjs');
process.argv[2] = tree; const S = await loadTree('x'), H = makeHarness(S);
const B = H.build([H.mk('r', key, 10, 10, +w, +d, +seed || 1, 1)]), L = B.solve('r');
console.log(JSON.stringify(L.unplaced), JSON.stringify(L.notes), JSON.stringify(L.checks?.purpose));
console.log(Object.keys(L));
