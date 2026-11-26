// Denser City and Cyberpunk rooms (2026-11-07, experiments/2026-11-07-denserooms). Harry: "many of the cyberpunk rooms
// need to default to denser packing as well as with modern rooms", "note some of our isle-packing options", "look at how
// storage rooms are done in fantasy (aisles)", "re-use from our existing model sets".
//   node test/dense.test.mjs [tuner dir]
//   density   every DENSER room, at its default size and two others, six seeds: the mean props / 100 sq ft reaches 80% of
//             its DENSITY target, or 35% of the floor is covered (a warehouse of racking is full by floor first); on the old
//             programs these stood at 33-80% and 14-34%. No target went down
//   walking   every one of those layouts: every door reaches the main door, and the main door reaches standing room by
//             the key piece (ccm_lib walkCheck: a 2-ft walker on the finished layout)
//   aisles    the rooms that are rows in life lay them on the storeroom's grammar (aisleStore): the corner store's
//             shelving, the server room's racks, the warehouse's racking, the magic shop's middle shelves (a shop deep
//             enough from the door and wide enough to keep the door line open: 6x5 cells), and a middle row of capsules in a hall wide enough for one (10x8)
//   shared    the plain set's produce, bottles and books turn up where they belong (MOD_SHARED), and only shared roles do
//   open      the open rooms (street, alley, parking garage, corporate lobby, rooftop) keep their targets
import { loadTree, makeHarness, walkCheck, standing, aabb } from './ccm_lib.mjs';
const S = await loadTree('dense'), H = makeHarness(S), { ok, mk } = H;
const D = S.s2.DENSITY, KR = S.s2.KEY_RE || {}, SHARED = { has: (id) => !!S.s2.modShared?.(id) }, LOOKS = (id) => S.s2.modLooks?.(id);
ok(!!S.s2.MOD_SHARED && S.s2.MOD_SHARED.size > 10 && !!S.s2.MX_BORROW, 'solver2 exports MOD_SHARED (this lane\'s shared roles) beside MX_BORROW');
// the targets: [old, new] (new >= old); the rooms that fill toward them
const TARGET = { 'mod-apartment': 4.5, 'mod-office': 5, 'mod-bar': 4.5, 'mod-store': 5, 'mod-warehouse': 3.5, 'cyb-clinic': 5, 'cyb-server': 5, 'cyb-noodle': 6, 'cyb-hideout': 5, 'cyb-talisman': 5, 'cyb-rigger': 4.5, 'cyb-safehouse': 4.5 };
const FOCAL = { 'mod-apartment': /^(tv-stand|sofa)$/, 'mod-office': /^cubicle-desk$/, 'mod-bar': /^bar-counter$/, 'mod-store': /^(store-shelving|drinks-cooler)$/, 'mod-warehouse': /^(pallet-racking|shipping-container)$/,
  'cyb-clinic': /^surgical-chair$/, 'cyb-server': /^server-rack$/, 'cyb-noodle': /^noodle-counter$/, 'cyb-hideout': /^oil-drum-fire$/, 'cyb-talisman': /^display-counter-glass$/, 'cyb-rigger': /^(car-sedan|car-hatchback|workbench-garage)$/, 'cyb-safehouse': /^terminal-desk$/, 'cyb-capsule': /^capsule-pod$/ };
const OPEN = { 'mod-garage': 3.5, 'cyb-lobby': 3.5 }; // (street, alley, rooftop: outdoor, their own targets)
for (const [k, t] of Object.entries(TARGET)) ok(D[k] === t, `${k}: target ${D[k]}, want ${t}`);
for (const [k, t] of Object.entries(OPEN)) ok(D[k] === t, `${k} (open): target ${D[k]}, want ${t} unchanged`);
const sizes = (k) => { const c = S.T[k].cells; return [c, [c[0] + 2, c[1] + 2], [Math.max(4, c[0] - 1), Math.max(4, c[1] - 1)]]; };
const solve = (k, w, d, seed) => { const B = H.build([mk('r', k, 10, 10, w, d, seed * 137 + w * 5 + d, 1)]); return { B, r: B.rooms[0], L: B.solve('r') }; };
const table = [];
for (const k of Object.keys(TARGET)) {
  const dens = [], covs = [], ids = new Map();
  for (const [w, d] of sizes(k)) for (let seed = 1; seed <= 6; seed++) {
    const { B, r, L } = solve(k, w, d, seed), tag = `${k} ${w}x${d} seed ${seed}`;
    ok(!L.purposeFail, `${tag} PURPOSE FAIL ${L.purposeFail}`);
    dens.push(L.checks.density.value);
    covs.push(standing(L).filter(p => p.rule !== 'yard-edge').reduce((a, p) => { const [aw, ad] = aabb(p); return a + aw * ad; }, 0) / ((L.room.feet[0] - 1) * (L.room.feet[1] - 1)));
    const wc = walkCheck(r, B.E.openings.get('r'), L, FOCAL[k]);
    ok(wc.doors, `${tag}: a door is cut off from the main door`);
    ok(wc.focal !== false, `${tag}: no way from the door to the key piece`);
    for (const p of L.placements) ids.set(p.id, (ids.get(p.id) || 0) + 1);
  }
  const mean = dens.reduce((a, b) => a + b, 0) / dens.length;
  const cov = covs.reduce((a, b) => a + b, 0) / covs.length; // (a room of big pieces is full by floor before it is full by count: racking, racks)
  ok(mean >= 0.8 * D[k] || cov >= 0.35, `${k}: mean density ${mean.toFixed(2)} under 80% of its target ${D[k]} and floor ${(cov * 100).toFixed(0)}% covered (under 35%)`);
  table.push(`${k.padEnd(14)} target ${String(D[k]).padEnd(4)} mean ${mean.toFixed(2)} floor ${(cov * 100).toFixed(0)}%`);
  if (k === 'mod-store') ok(['cabbage-crate', 'potato-crate'].some(i => ids.get(i)), `${k}: no produce from the plain set`);
  if (k === 'cyb-noodle') ok(['dumplings-bowl', 'bowl', 'bowl-stack'].some(i => ids.get(i)), `${k}: no bowls on the counter or the tables`);
  if (k === 'cyb-talisman') ok(['dried-herbs-jar', 'jar-pickles', 'herb-pot', 'book-open', 'flowers-dried', 'honey-jar-dipper'].some(i => ids.get(i)), `${k}: nothing on the glass counter`);
}
// the aisles: on the storeroom's grammar (L.store: aisleStore's record), at the default size unless named
const AISLES = [['mod-store', null, /^store-shelving$/], ['cyb-server', null, /^server-rack$/], ['mod-warehouse', null, /^pallet-racking$/], ['cyb-talisman', [6, 5], /^curio-shelf$/], ['cyb-capsule', [10, 8], /^capsule-pod$/]];
for (const [k, size, re] of AISLES) {
  let rows = 0, n = 0;
  for (let seed = 1; seed <= 6; seed++) { const [w, d] = size || S.T[k].cells, { L } = solve(k, w, d, seed); n++;
    if (L.store && L.store.rowsCount >= 1 && L.store.rowIds.every(i => re.test(i))) rows++; }
  ok(rows >= Math.ceil(n * 2 / 3), `${k}${size ? ' ' + size.join('x') : ''}: rows on the aisle grammar in ${rows} of ${n}`);
  table.push(`${k.padEnd(14)} aisle rows in ${rows}/${n}`);
}
// shared roles only: every placement in a City / Cyberpunk room is a modern sku or a plain one of a shared role
const SKU = new Map(); for (const o of Object.values(S.lib.objects)) for (const s of o.skus) SKU.set(s.sku, s);
for (const k of [...Object.keys(TARGET), 'cyb-capsule']) for (let seed = 1; seed <= 3; seed++) { const [w, d] = S.T[k].cells, { L } = solve(k, w, d, seed);
  for (const p of L.placements) { const t = SKU.get(p.sku)?.tier; ok(t === 'mod' || t === 'cyb' || (SHARED.has(p.id) && (!t || t === 'common' || t === 'fine')), `${k} seed ${seed}: ${p.id} (${p.sku}, tier ${t}) is neither modern nor shared`);
    const looks = SHARED.has(p.id) && !(t === 'mod' || t === 'cyb') ? LOOKS(p.id) : null; if (looks) ok(looks.includes(p.sku), `${k} seed ${seed}: ${p.sku}: a shared role in a look nobody vetted (${looks})`); } }
ok(JSON.stringify(S.s2.MOD_LOOKS?.crate) === '["crate--s4"]', 'the crate is shared in its one modern-looking look');
console.log(table.join('\n'));
H.report('dense');
