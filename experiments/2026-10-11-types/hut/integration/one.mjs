// node one.mjs <tree> <roomKey> <w> <d> <seed> [neighbourType] : solve one room (optionally beside a neighbour) and print the placements
import { loadTree, makeHarness } from '../../../../tools/spawn-tuner/test/ccm_lib.mjs';
const [, , , key, w, d, seed, nb] = process.argv; const S = await loadTree('x'), H = makeHarness(S);
const rooms = [H.mk('r', key, 10, 10, +w, +d, +seed || 1, 2)]; if (nb) rooms.push(H.mk('n', nb, 10, 10 - 4, Math.max(+w, 4), 4, (+seed || 1) + 1, 1));
const B = H.build(rooms), L = B.solve('r');
console.log(key, w + 'x' + d, 'fail:', L.purposeFail || '-', '| doors', B.E.openings.get('r').filter(o => o.kind === 'door' || o.kind === 'gate').map(o => o.kind[0] + o.side + o.index).join(','), '| paths', L.paths.map(p => p.kind + (p.ok ? '' : '!')).join(','), '| density', L.checks.density.value, '/', L.checks.density.target, '| what:', L.checks.purpose.what);
for (const p of L.placements) console.log(' ', p.id.padEnd(24), (p.sku || '').padEnd(28), p.rule.padEnd(14), p.x.toFixed(1).padStart(6), p.z.toFixed(1).padStart(6), (p.rot * 180 / Math.PI).toFixed(0).padStart(5), p.dims.map(v => v.toFixed(1)).join('x'), p.y ? 'y' + p.y.toFixed(1) : '');
if (L.unplaced?.length) console.log('  unplaced:', L.unplaced.map(u => u.id + ':' + u.why).join('; '));
if (L.notes?.length) console.log('  notes:', L.notes.join('; '));
