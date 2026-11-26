// Culture packs B (2026-11-06, experiments/2026-11-06-cultures-b): Norse steading, Middle East (Mamluk), medieval Rus',
// Mexica, on the culture-room skeleton (js/solver2.js cb:solver2).
//   node test/cultures_b.test.mjs [tuner dir] [--pack=nrs,mde] [--fake] [--print]
//   rooms   every room type of the pack x sizes x seeds x arrangements (alone; off the pack's hub): the shared checks of
//           ccm_lib.mjs (no purpose fail, inside the room, no overlap, paths clear, the focal piece, seen from the door,
//           deterministic, nothing hung on a door or window, lit) + the room's SIGNATURE piece (what names it from above)
//   purity  a room of one culture holds no piece of another culture (sku prefixes nrs- mde- rus- mes-)
//   outdoor the plots: the signature piece, the ways clear, nothing outside
//   --fake  before the meshes exist: the pack's room types (culture_packs_b.py, dumped by the experiment's tools/fake_types.py)
//           and every planned mesh at its catalog size are put into the library in memory, so the programs can be tested
import { readFileSync, existsSync } from 'node:fs';
import { loadTree, makeHarness } from './ccm_lib.mjs';
const S = await loadTree('real'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const arg = (k) => (process.argv.find(a => a.startsWith(k + '=')) || '').slice(k.length + 1) || null;
const E = S.dir + '../../experiments/2026-11-06-cultures-b/';
const PACKS = (arg('--pack') || 'nrs,mde,rus,mes').split(',');
if (process.argv.includes('--fake')) {
  const T = JSON.parse(readFileSync(E + 'targets.json')), RT = JSON.parse(readFileSync(E + 'fake_types.json'));
  for (const t of T) { if (t.kind === 'wall' || !PACKS.includes(t.code)) continue; const o = S.lib.objects[t.obj];
    const sku = { sku: t.obj === t.id ? t.id : `${t.obj}--${t.code}`, family: '', tier: t.code, shape: t.obj === t.id ? '' : t.code, kind: 'mesh', url: 'x', bounds: [t.size[0] / 12, t.size[2] / 12, t.size[1] / 12] };
    if (o) { if (!o.skus.some(s => s.sku === sku.sku)) o.skus.push(sku); }
    else S.lib.objects[t.obj] = { id: t.obj, desc: t.desc, place: t.place, fp: t.fp, size: t.size, scale: [0.9, 1.1], mat: t.mat, aff: (t.aff || '-').split(',').filter(a => a !== '-'), gen: 'mesh', pri: t.pri, hint: t.hint, var: [], skus: [sku], only: [t.code], ...(t.flags.includes('hung') ? { hung: true } : {}) }; }
  for (const rt of RT) if (PACKS.includes(rt.key.slice(0, 3)) && !S.T[rt.key]) { S.T[rt.key] = { ...rt, slots: {}, missing: [] }; S.types.push(S.T[rt.key]); }
}
// the piece that names each room from the table camera
const SIG = {
  'nrs-longhouse': /^nrs-long-hearth$/, 'nrs-meadhall': /^nrs-high-seat$/, 'nrs-smithy': /^nrs-forge$/, 'nrs-boathouse': /^nrs-boat$/, 'nrs-weaving': /^nrs-loom$/, 'nrs-yard': /^nrs-runestone$/,
  'mde-courtyard': /^(mde-floor-fountain|well)$/, 'mde-souk': /^counter-shop$/, 'mde-hammam': /^mde-floor-fountain$/, 'mde-audience': /^mde-dais$/, 'mde-coffee': /^mde-coffee-brazier$/, 'mde-garden': /^(mde-floor-fountain|fountain-courtyard)$/,
  'rus-izba': /^rus-stove$/, 'rus-terem': /^rus-tiled-stove$/, 'rus-banya': /^rus-banya-heater$/, 'rus-church': /^rus-iconostasis$/, 'rus-market': /^counter-shop$/, 'rus-yard': /^rus-well-sweep$/,
  'mes-shrine': /^mes-altar$/, 'mes-ballcourt': /^mes-court-ring$/, 'mes-house': /^mes-icpalli$/, 'mes-market': /^mes-spread-/, 'mes-chinampa': /^mes-chinampa-bed$/, 'mes-scribe': /^mes-codex-mat$/,
};
// what js/fx/fire.js lights beyond ccm_lib's mirror of it (apply.py FIRE)
const FIRE = [[/^nrs-forge$/, 'brazier'], [/^mde-coffee-brazier$/, 'brazier'], [/^rus-(stove|tiled-stove|banya-heater)$/, 'oven']];
const keys = Object.keys(SIG).filter(k => PACKS.includes(k.slice(0, 3)) && S.T[k]);
ok(keys.length > 0, `no room type of packs ${PACKS} in rooms.json (land a pack, or --fake)`);
const SIZES = (k) => { const [w, d] = S.T[k].cells; return [[w, d], [d, w], [Math.max(3, w - 1), Math.max(3, d - 1)], [w + 2, d + 1]]; };
const HUB = { nrs: 'nrs-longhouse', mde: 'mde-audience', rus: 'rus-izba', mes: 'mes-house' };
const stats = {}; let izbaLimit = 0;
for (const k of keys) {
  const out = S.w.isOutdoor(k), code = k.slice(0, 3);
  for (const [w, d] of SIZES(k)) for (const arr of ['alone', 'off-hub']) for (let seed = 1; seed <= 6; seed++) {
    const s = seed * 131 + w * 7 + d, rooms = [mk('r', k, 10, 10, w, d, s, 2)];
    if (arr === 'off-hub') { const hub = HUB[code] === k ? (out ? HUB[code] : `${code}-yard`) : HUB[code]; if (!S.T[hub]) continue; rooms.unshift(mk('h', hub, 10 - 6, 10, 6, Math.max(d, 4), s + 1, 1)); }
    const B = H.build(rooms), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
    // (a known limit, counted not failed: a 15 x 15 ft izba with doors in the middle of two walls has no corner and no
    // middle left for a 5 x 6 ft stove clear of the way between its doors; the default izba is 20 x 20 ft)
    if (k === 'rus-izba' && w * d < 16 && arr === 'off-hub' && /no the great stove/.test(L.purposeFail || '')) { izbaLimit++; continue; }
    if (!out) H.checkRoom(tag, B, r, L, { focal: SIG[k], lights: true, fire: FIRE });
    else { ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`); ok(L.placements.some(p => SIG[k].test(p.id)), `${tag} no signature piece`); ok(L.paths.every(p => p.ok), `${tag} blocked path`); }
    for (const p of L.placements) { const pre = (p.sku || p.id).match(/(^|--)(nrs|mde|rus|mes)(-|$)/); ok(!pre || pre[2] === code, `${tag} holds another culture's piece: ${p.sku}`); }
    const st = stats[k] ||= { n: 0, sig: 0, props: 0, things: new Map() };
    st.n++; if (L.placements.some(p => SIG[k].test(p.id))) st.sig++; st.props += L.placements.filter(p => p.orient !== 'floor').length;
    for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  }
}
for (const [k, st] of Object.entries(stats)) {
  console.log(`${k.padEnd(16)} ${st.n} solves, signature ${st.sig}/${st.n}, ${(st.props / st.n).toFixed(1)} things a room`);
  if (PRINT) console.log('   ', [...st.things].sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${n}`).join(', '));
}
if (izbaLimit) console.log(`known limit: ${izbaLimit} small izbas with two mid-wall doors have no place for the stove`);
H.report("culture packs B");
