import { loadTree, makeHarness } from './ccm_lib.mjs';
const S = await loadTree('tem'), H = makeHarness(S), [k, w, d, seed, flavor] = process.argv.slice(3);
const B = H.build([H.mk('r', k, 10, 10, +w, +d, +seed, 1)]), L = B.solve('r', flavor ? { flavor } : {});
console.log('fail:', L.purposeFail, '| notes', L.notes?.slice(0, 4), '| door', B.rooms[0].extDoor?.side);
for (const p of L.placements) console.log(p.id.padEnd(24), (p.sku || '').padEnd(34), p.rule.padEnd(14), p.x.toFixed(1), p.z.toFixed(1), 'y', p.y.toFixed(2), 'dims', p.dims.map(v => v.toFixed(2)).join('x'), p.side || '', (p.rot * 180 / Math.PI).toFixed(0));
console.log('unplaced', L.unplaced?.slice(0, 12).map(u => u.id + ': ' + u.why).join(' | '));
