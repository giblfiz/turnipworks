// node tests/dbg.mjs <tuner dir> <room key> [w d seed] [--with shopkey]   one room, its placements and summary
import { loadTree, makeHarness } from '../sandbox/real/test/ccm_lib.mjs';
const S = await loadTree('dev'), H = makeHarness(S), { mk } = H;
const [, key, w = 0, d = 0, seed = 11] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const withI = process.argv.indexOf('--with'), nb = withI > 0 ? process.argv[withI + 1] : null;
const keys = key === 'all' ? S.types.filter(t => t.key.startsWith('mkt-')).map(t => t.key) : [key];
for (const k of keys) {
  const [cw, cd] = +w ? [+w, +d] : S.T[k].cells;
  const rooms = [mk('r', k, 10, 10, cw, cd, +seed, 2)]; if (nb) rooms.unshift(mk('n', nb, 10, 10 - 4, cw, 4, +seed + 1, 1));
  const B = H.build(rooms), L = B.solve('r');
  console.log(`\n== ${k} ${cw}x${cd} seed ${seed}: ${L.purposeFail ? 'FAIL ' + L.purposeFail : 'ok'} | ${L.placements.length} placements | density ${L.checks.density.value?.toFixed?.(1)} / ${L.checks.density.target} | paths ${L.paths.map(p => p.kind + (p.ok ? '' : '!')).join(',')}`);
  console.log('  ' + (L.summary || '').split('\n').slice(0, 3).join('\n  '));
  const by = new Map(); for (const p of L.placements) by.set(`${p.id}${p.sku !== p.id ? '[' + p.sku.replace(p.id, '') + ']' : ''} (${p.rule})`, (by.get(`${p.id}${p.sku !== p.id ? '[' + p.sku.replace(p.id, '') + ']' : ''} (${p.rule})`) || 0) + 1);
  console.log('  ' + [...by].map(([a, n]) => n > 1 ? `${n}x ${a}` : a).join(' · '));
  if (L.unplaced?.length) console.log('  unplaced: ' + L.unplaced.map(u => `${u.id} (${u.why})`).join(', '));
  if (process.argv.includes('--edges')) console.log([...B.E.edges.values()].filter(e => e.sides.some(s => s.room === 'r') && e.kind !== 'wall' || e.panel).map(e => `${e.kind}${e.panel ? ':' + e.panel : ''} ${e.sides.map(s => s.room + s.side + s.index).join('|')} ${e.doorType || ''}`).join('\n'));
}
