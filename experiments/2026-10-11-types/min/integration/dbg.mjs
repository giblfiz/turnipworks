// node dbg.mjs <tree> <roomKey> <w> <d> <alone|offHall|packed> <seed 1..8> : one room of the mine test, its placements and paths
import { loadTree, makeHarness } from 'tools/spawn-tuner/test/ccm_lib.mjs';
const [, , , k, W, D, arr, sd] = process.argv; const w = +W, d = +D, S = await loadTree('x'), H = makeHarness(S), mk = H.mk, s = (+sd || 1) * 97 + w * 7 + d;
const ARR = { alone: () => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: () => [mk('h', k === 'min-tunnel' ? 'min-shaft-head' : 'min-tunnel', 10, 7, Math.max(w, 4), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: () => [mk('a', 'min-tool-store', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', 'min-tunnel', 10, 10 + d, w, 2, s + 2, 3), mk('v', k === 'min-mess' ? 'min-powder-store' : 'min-mess', 10 + w, 10, 4, d, s + 3, 4)] };
const B = H.build(ARR[arr || 'alone']()), L = B.solve('r');
console.log(k, w + 'x' + d, 'seed', s, 'fail:', L.purposeFail || '-', '| doors', B.E.openings.get('r').filter(o => o.kind === 'door').map(o => o.side + o.index).join(','), '| paths', L.paths.map(p => p.kind + (p.ok ? '' : '!')).join(','));
for (const p of L.placements) console.log(' ', p.id.padEnd(24), (p.sku || '').padEnd(28), p.rule.padEnd(14), (p.x - 50).toFixed(1).padStart(6), (p.z - 50).toFixed(1).padStart(6), (p.rot * 180 / Math.PI).toFixed(0).padStart(5), p.dims.map(v => v.toFixed(1)).join('x'));
if (L.unplaced?.length) console.log('  unplaced:', L.unplaced.map(u => u.id + ':' + u.why).join('; '));
if (process.argv.includes('--sum')) console.log(S.s2.summarize2(L));
