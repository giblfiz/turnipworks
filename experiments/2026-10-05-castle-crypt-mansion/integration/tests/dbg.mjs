// node test/_dbg.mjs . TYPEGROUP key w d seedN arr   (seedN = 1..8 as in the tests; castle seeds: n*89 + w*5 + d)
import { loadTree, makeHarness } from './ccm_lib.mjs';
const [grp, k, W, D, N, arr = 'alone'] = process.argv.slice(3), w = +W, d = +D;
const S = await loadTree(grp), H = makeHarness(S), { mk } = H;
const s = grp === 'castle' ? +N * 89 + w * 5 + d : grp === 'crypt' ? +N * 97 + w * 7 + d : +N;
const ARR = {
  alone: () => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: () => [mk('h', k === 'great-hall' ? 'gatehouse' : 'great-hall', 10, 5, Math.max(w, 6), 5, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: () => [mk('a', k === 'gatehouse' ? 'armoury' : 'gatehouse', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', k === 'barracks' ? 'armoury' : 'barracks', 10, 10 + d, Math.max(w, 3), 4, s + 2, 3), mk('y', 'courtyard', 10 + w, 10, 6, d, s + 3, 4)],
};
const B = H.build(ARR[arr]()), L = B.solve('r');
console.log('seed', s, L.summary?.split('\n').slice(0, 9).join('\n') || '');
for (const p of L.placements) if (!/on-surface|wall-light|wall-mount/.test(p.rule) || process.argv.includes('--all')) console.log(p.id.padEnd(24), (p.sku || '').padEnd(26), String(p.x).padStart(6), String(p.y).padStart(5), String(p.z).padStart(6), (p.rot * 180 / Math.PI).toFixed(0).padStart(5), p.dims.join('x').padEnd(16), p.rule);
console.log(JSON.stringify(L.openings), L.purposeFail || '', JSON.stringify(L.checks?.sight || L.sight || ''));
