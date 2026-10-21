// node one.mjs <tree> <roomKey> <w> <d> <seed> : solve one room alone and print the placements
const [, , tree, key, w, d, seed] = process.argv;
const { loadTree, makeHarness } = await import(new URL('test/ccm_lib.mjs', 'file://' + (await import('node:path')).resolve(tree) + '/').href);
process.argv[2] = tree;
const S = await loadTree('x'), H = makeHarness(S);
const B = H.build([H.mk('r', key, 10, 10, +w, +d, +seed || 1, 1)]), L = B.solve('r');
console.log(key, w + 'x' + d, 'fail:', L.purposeFail || '-', '| doors', B.E.openings.get('r').filter(o => o.kind === 'door').map(o => o.side + o.index).join(','), '| paths', L.paths.map(p => p.kind + (p.ok ? '' : '!')).join(','), '|', L.checks.purpose.what);
for (const p of L.placements) console.log(' ', p.id.padEnd(24), (p.sku || '').padEnd(28), p.rule.padEnd(14), p.x.toFixed(1).padStart(6), p.z.toFixed(1).padStart(6), (p.rot * 180 / Math.PI).toFixed(0).padStart(5), p.dims.map(v => v.toFixed(1)).join('x'), p.y ? 'y' + p.y : '');
if (L.unplaced?.length) console.log('  unplaced:', L.unplaced.map(u => u.id + ':' + u.why).join('; '));
