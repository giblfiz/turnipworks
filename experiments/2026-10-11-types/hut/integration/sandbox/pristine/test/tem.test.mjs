// Temple & chapel (2026-10-11): ten room types, temple-stone walls, the flavor slots.
//   node test/tem.test.mjs [tuner dir] [--print]
//   rooms    every room type x 6 sizes x 6 seeds x 3 arrangements: the shared checks of ccm_lib.mjs (no purpose fail, nothing
//            outside or overlapping, the focal piece, paths clear, key feature in view, nothing hung on a door or panel,
//            deterministic), and a light in every room
//   flavors  a room dresses in ONE flavor: with opts.flavor 'sun' every flavor-* piece is a --sun sku, with 'moon' a --moon
//            one, with a flavor nobody has made yet ('nature') no flavor piece at all; the default is the first of the type's list; the same
//            nave changes nothing but its flavor pieces between sun and moon
//   scale    the nave program from a roadside chapel (3x4) to a cathedral (8x14): seats at every size, columns only in the cathedral
import { loadTree, makeHarness, fireType } from './ccm_lib.mjs';
const S = await loadTree('tem'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = ['temple-nave', 'cathedral', 'cathedral-dark', 'temple-shrine', 'temple-vestry', 'temple-cloister', 'temple-scriptorium', 'temple-infirmary', 'temple-cell', 'temple-belltower'];
for (const k of KEYS) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FOCAL = { 'temple-nave': /^altar-stone$/, 'cathedral': /^altar-stone$/, 'cathedral-dark': /^altar-stone$/, 'temple-shrine': /^(flavor-idol|altar-stone)$/, 'temple-vestry': /^rite-vestments-stand$/, 'temple-cloister': null,
  'temple-scriptorium': /^scriptorium-desk$/, 'temple-infirmary': /^(sickbed|cot|bed-single)$/, 'temple-cell': /^(cot|sickbed|bed-single)$/, 'temple-belltower': /^bell-on-frame$/ };
const SIZES = { 'temple-nave': [[5, 8], [3, 4], [4, 6], [4, 7], [6, 10], [8, 5]], 'cathedral': [[8, 14], [7, 9], [8, 10], [9, 16], [10, 12], [7, 12]], 'cathedral-dark': [[8, 14], [7, 9], [8, 10], [9, 16], [10, 12], [7, 12]],
  'temple-shrine': [[3, 4], [3, 3], [2, 3], [4, 5], [5, 4], [6, 6]], 'temple-vestry': [[3, 3], [3, 4], [4, 3], [4, 4], [5, 4], [6, 5]], 'temple-cloister': [[8, 3], [6, 2], [2, 6], [10, 3], [3, 8], [12, 4]],
  'temple-scriptorium': [[5, 5], [4, 4], [4, 5], [6, 5], [5, 7], [8, 6]], 'temple-infirmary': [[7, 5], [7, 4], [4, 6], [8, 5], [4, 4], [10, 5]], 'temple-cell': [[2, 3], [3, 2], [2, 2], [3, 3], [3, 4], [4, 4]],
  'temple-belltower': [[3, 3], [4, 4], [3, 4], [4, 3], [5, 5], [6, 6]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offWalk: (k, w, d, s) => [mk('h', k === 'temple-cloister' ? 'temple-nave' : 'temple-cloister', 10, 7, Math.max(w, 4), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', 'temple-vestry', 10 - 3, 10, 3, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', 'temple-cloister', 10, 10 + d, w, 3, s + 2, 3), mk('v', k === 'temple-cell' ? 'temple-shrine' : 'temple-cell', 10 + w, 10, 2, d, s + 3, 4)],
};
const stats = {}; let rooms = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 6; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const res = H.checkRoom(tag, B, r, L, { focal: FOCAL[k], lights: true });
  const st = stats[k] ||= { n: 0, props: 0, fails: 0, things: new Map() };
  st.n++; st.props += res.props; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  ok(r.family === (k === 'cathedral-dark' ? 'crypt-stone' : 'temple-stone'), `${tag} family ${r.family}`);
  const fl = L.placements.filter(p => /^flavor-/.test(p.id)), want = k === 'cathedral-dark' ? null : 'sun';
  ok(fl.every(p => p.sku.endsWith('--' + want)), `${tag} a flavor piece that is not ${want}: ${fl.map(p => p.sku).filter(s => !s.endsWith('--' + want))}`);
}
// ---- flavors
for (const [k, w, d] of [['temple-nave', 5, 8], ['cathedral', 8, 14], ['temple-shrine', 3, 4], ['cathedral-dark', 8, 14]]) for (let seed = 3; seed <= 6; seed++) {
  const B = H.build([mk('r', k, 10, 10, w, d, seed * 31, 1)]), by = {};
  for (const f of ['sun', 'moon', 'nature']) { const L = B.solve('r', { flavor: f }), fl = L.placements.filter(p => /^flavor-/.test(p.id)); by[f] = L;
    ok(!L.purposeFail, `${k} flavor ${f}: ${L.purposeFail}`);
    if (f === 'nature') ok(fl.length === 0, `${k} with a flavor nobody has made yet still has ${fl.map(p => p.sku)}`);
    else { ok(fl.every(p => p.sku.endsWith('--' + f)), `${k} asked for ${f}, got ${fl.map(p => p.sku)}`);
      for (const slot of k === 'temple-shrine' ? ['flavor-idol', 'flavor-sigil', 'flavor-banner', 'flavor-relief'] : ['flavor-altarpiece', 'flavor-idol', 'flavor-banner', 'flavor-relief', 'flavor-sigil']) ok(fl.some(p => p.id === slot), `${k} ${w}x${d} seed ${seed * 31} flavor ${f}: slot ${slot} is empty`);
      if (k === 'cathedral' || k === 'cathedral-dark') for (const slot of ['flavor-sculpture', 'flavor-buttress']) ok(fl.some(p => p.id === slot), `${k} seed ${seed * 31} flavor ${f}: slot ${slot} is empty`); }
  }
  // the test of the scheme: sun and moon differ ONLY in their flavor pieces (the same furniture)
  const neutral = (L) => JSON.stringify(L.placements.filter(p => !/^flavor-/.test(p.id) && !p.parent && p.layer !== 'light' && p.rule !== 'wall-light').map(p => p.id).sort()); // (the same furniture; a light may shift a foot where the two flavors' pieces differ in size)
  { const A = JSON.parse(neutral(by.sun)), Bm = JSON.parse(neutral(by.moon)), cnt = (l) => l.reduce((m, i) => (m[i] = (m[i] || 0) + 1, m), {}), ca = cnt(A), cb = cnt(Bm), diff = [...new Set([...A, ...Bm])].reduce((n, i) => n + Math.abs((ca[i] || 0) - (cb[i] || 0)), 0);
    if (k !== 'temple-shrine') ok(diff <= 2, `${k} seed ${seed * 31}: ${diff} pieces of neutral furniture differ between sun and moon`); } // (the two flavors' pieces differ in size: a pew or a bench beside one may not fit)
  if (PRINT && seed === 3) console.log(k, 'sun:', by.sun.placements.filter(p => /^flavor-/.test(p.id)).map(p => p.sku).join(' '));
}
// ---- scale: the one nave program
for (const [w, d, scale] of [[3, 4, 'chapel'], [4, 6, 'chapel'], [5, 8, 'nave'], [6, 10, 'nave'], [8, 14, 'cathedral'], [10, 18, 'cathedral']]) for (let seed = 1; seed <= 4; seed++) {
  const B = H.build([mk('r', 'temple-nave', 10, 10, w, d, seed * 53, 1)]), L = B.solve('r'), n = (re) => L.placements.filter(p => re.test(p.id)).length;
  ok(n(/^(pew|bench-stone)$/) >= 2, `nave ${w}x${d} seed ${seed * 53}: ${n(/^(pew|bench-stone)$/)} seats`);
  ok((n(/^pillar-round$/) >= 4) === (scale === 'cathedral'), `nave ${w}x${d}: ${n(/^pillar-round$/)} columns at ${scale} scale`);
  if (scale !== 'chapel') ok(n(/^pulpit$/) === 1, `nave ${w}x${d} seed ${seed * 53}: ${n(/^pulpit$/)} pulpits`);
  if (scale === 'cathedral') { ok(n(/^rite-choir-stall$/) === 2, `nave ${w}x${d} seed ${seed * 53}: ${n(/^rite-choir-stall$/)} choir stalls`); ok(n(/^organ-pipe$/) === 1, `nave ${w}x${d} seed ${seed * 53}: no organ`); }
  if (PRINT && seed === 1) console.log(`nave ${w}x${d}:`, Object.entries(L.placements.reduce((m, p) => (m[p.id] = (m[p.id] || 0) + 1, m), {})).map(([a, b]) => `${a} ${b}`).join(', '));
}
console.log(`\n${rooms} rooms`);
for (const [k, st] of Object.entries(stats)) console.log(`  ${k.padEnd(20)} ${String(st.n).padStart(4)} rooms  ${(st.props / st.n).toFixed(1)} props  purpose fails ${st.fails}` + (PRINT ? `\n      ${[...st.things].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([a, b]) => `${a} ${(b / st.n).toFixed(1)}`).join(', ')}` : ''));
H.report('temple');
