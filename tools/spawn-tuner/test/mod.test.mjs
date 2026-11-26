// Modern city (sprawl pack, 2026-11-06): the Modern genre's first eight rooms (its City type until 2026-11-07, now in its buildings) in drywall / city-brick / concrete,
// the street and the alley outdoor.
//   node test/mod.test.mjs [tuner dir] [--print]
//   genre     engine types.json has a `modern` genre holding the buildings of engine/tools/modern_buildings.json (2026-11-07:
//             no City / Cyberpunk types), every City room in one of them; every fantasy type keeps genre fantasy
//   rooms     every room type x 5 sizes x 6 seeds x 2 arrangements (alone; beside a street): the shared checks
//             (ccm_lib.mjs: no purpose fail, nothing outside or overlapping, focal piece present, paths clear, ...) plus:
//             every placement is a modern sku (tier mod) or a modern wall; doors are modern doors; the family is the room's
//   reads     the signature of each room is laid: a sofa facing a TV, cubicle ranks, the bar with stools, parked cars and
//             the centre line, the dumpster between brick walls, cars in bays, aisles and coolers, racking
//   leak      no fantasy room in a sample of every fantasy type ever places a modern sku
//   lights    the modern lights are electric in fx/fire.js (no flame) and in core/darkness.js
import { readFileSync } from 'node:fs';
import { loadTree, makeHarness } from './ccm_lib.mjs';
const S = await loadTree('mod'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
// (2026-11-07) roles of the plain set the modern set shares (solver2.js modShared: MX_BORROW + MOD_SHARED), in their vetted looks (modLooks)
const SHARED = { has: (id) => !!S.s2.modShared?.(id) }, LOOKS = (id) => S.s2.modLooks?.(id), PLAIN = (t) => !t || t === 'common' || t === 'fine';
const KEYS = S.w.MOD_ROOMS, OUT = new Set(['mod-street', 'mod-alley']);
const SKU = new Map(); for (const o of Object.values(S.lib.objects)) for (const s of o.skus) SKU.set(s.sku, s);
const HAS = (id) => (S.lib.objects[id]?.skus || []).some(s => s.tier === 'mod');
// ---- genre
const TY = JSON.parse(readFileSync(new URL('../../../engine/client/data/types.json', import.meta.url)));
ok(TY.genres.map(g => g.key).slice(0, 2).join() === 'fantasy,modern', `genres ${TY.genres.map(g => g.key)}`); // (fantasy first, modern second; the culture packs' genre after)
const MB = JSON.parse(readFileSync(new URL('../../../engine/tools/modern_buildings.json', import.meta.url)));
ok(TY.types.filter(t => t.genre === 'modern').map(t => t.code).join() === MB.buildings.map(b => b.code).join() && !TY.types.some(t => ['MOD', 'CYB'].includes(t.code)), 'the modern genre holds the buildings (no City or Cyberpunk type: 2026-11-07)', TY.types.filter(t => t.genre === 'modern').map(t => t.code));
ok(TY.types.filter(t => t.genre !== 'modern').every(t => t.genre === 'fantasy' || t.genre === 'cultures'), 'every other type is fantasy (or a culture pack)');
for (const k of S.w.MOD_ROOMS) ok(TY.types.some(t => t.genre === 'modern' && t.rooms?.includes(k)), `${k} is in a modern building`);
ok(KEYS.length === 8, 'eight modern rooms');
for (const k of KEYS) { ok(!!S.T[k], `room type ${k} is in rooms.json`); ok((S.T[k]?.tiers || []).join() === 'mod', `${k} rolls tier mod only`); ok(S.T[k]?.recipes.every(r => r.startsWith('mod-')), `${k} recipes are MOD's (the catalog's modern code; the Build tray files it by modern_buildings.json)`); }
for (const k of OUT) ok(S.w.roleOf(k) === 'outdoor', `${k} is outdoor`);
// ---- lights (fx/fire.js imports three: read its source)
const FIRE = readFileSync(new URL('../js/fx/fire.js', import.meta.url), 'utf8');
for (const [id, t] of [['light-fluorescent', 'tube'], ['sign-neon', 'neon'], ['streetlight', 'sodium'], ['lamp-floor', 'bulb'], ['tv-stand', 'screen']]) ok(new RegExp(`return '${t}'`).test(FIRE) && FIRE.includes(id), `fire.js has the electric type ${t} for ${id}`);
ok(/tube:\s*\{ kind: 'small', flames: 'none', electric:/.test(FIRE), 'the fluorescent tube is a flameless electric light');
const DK = await import(new URL('../../../engine/core/darkness.js', import.meta.url));
ok(DK.lightKind('light-fluorescent', 'tube', []) === 'lamp' && DK.lightKind('streetlight', 'sodium', []) === 'lantern' && DK.lightKind('sign-neon', 'neon', []) === 'glow', 'darkness reaches of the electric lights');
// ---- the engine's family tables, doors, packing and words
const HT = await import(new URL('../../../engine/core/height.js', import.meta.url));
for (const f of S.w.MOD_FAMILIES) ok(HT.ROOF_BY_FAMILY[f] === 'lead' && HT.isStoneFamily(f) === (f !== 'drywall'), `${f}: flat sheet-metal roof; a stone-like slab unless drywall`);
ok(!HT.isStoneFamily('rough-timber') && HT.isStoneFamily('dressed-stone'), 'isStoneFamily keeps its fantasy answers');
const OL = readFileSync(new URL('../../../engine/client/openlook.js', import.meta.url), 'utf8');
ok(/'door-roller-shutter': \{ mode: 'slide'/.test(OL) && /'door-flush': LEAF/.test(OL), 'the roller shutter slides up, the slab door swings (openlook.js RIGS)');
const PK = readFileSync(new URL('../../../engine/client/pack.js', import.meta.url), 'utf8');
ok(/\['mod-street', 'mod-alley'/.test(PK), 'streets and alleys are never packed inside a dragged building (pack.js APART)');
const BW = await import(new URL('../../../engine/client/barwords.js', import.meta.url));
ok(MB.buildings.every(b => (BW.COMMAND_WORDS[`build.type.t:${b.code}`] || []).includes('modern')) && (BW.COMMAND_WORDS['build.mod-store'] || []).includes('convenience store'), 'the command bar knows the modern words ("modern": every modern building)');
ok((BW.COMMAND_WORDS['build.mod-bar'] || []).includes('bar') && !(BW.COMMAND_WORDS['build.type.t:TAV'] || []).includes('bar') && (BW.COMMAND_WORDS['build.type.t:TAV'] || []).includes('tavern'), '"bar" is the modern bar (2026-11-07: it opened the tavern); "tavern" is the tavern');
ok((BW.COMMAND_WORDS['build.mkt-street'] || []).includes('street'), '... and "street" keeps its fantasy meaning');
const ELEC = [[/^light-fluorescent/, 'tube'], [/^(sign-neon|jukebox|dj-booth)/, 'neon'], [/^streetlight/, 'sodium'], [/^lamp-floor/, 'bulb'], [/^(tv-stand|drinks-cooler|atm)$/, 'screen']];
// ---- rooms
const FAMILY = { 'mod-apartment': 'drywall', 'mod-office': 'drywall', 'mod-bar': 'city-brick', 'mod-garage': 'concrete', 'mod-store': 'drywall', 'mod-warehouse': 'concrete' };
const FOCAL = { 'mod-apartment': /^(tv-stand|sofa)$/, 'mod-office': /^cubicle-desk$/, 'mod-bar': /^bar-counter$/, 'mod-street': null, 'mod-alley': /^dumpster$/, 'mod-garage': /^(car-sedan|car-hatchback|pillar-concrete)$/,
  'mod-store': /^(store-shelving|drinks-cooler)$/, 'mod-warehouse': /^(pallet-racking|shipping-container)$/ };
const SIZES = { 'mod-apartment': [[6, 5], [5, 4], [7, 6], [4, 6], [8, 5]], 'mod-office': [[8, 6], [6, 5], [10, 8], [5, 7], [12, 6]], 'mod-bar': [[8, 6], [6, 5], [10, 7], [5, 8], [12, 8]],
  'mod-street': [[10, 5], [8, 4], [14, 5], [5, 10], [12, 6]], 'mod-alley': [[8, 2], [6, 2], [12, 2], [2, 8], [10, 3]], 'mod-garage': [[8, 6], [10, 9], [6, 5], [6, 10], [12, 7]],
  'mod-store': [[6, 5], [5, 4], [8, 6], [4, 6], [7, 7]], 'mod-warehouse': [[8, 8], [6, 6], [10, 8], [6, 9], [12, 10]] };
const ARR = { alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  street: (k, w, d, s) => k === 'mod-street' ? [mk('a', 'mod-bar', 10, 10 - 6, w, 6, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)] : [mk('st', 'mod-street', 10, 10 + d, Math.max(w, 6), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)] };
const MOD_DOORS = /^(door-flush|door-steel|door-shopfront|door-roller-shutter)$/;
const stats = {}; let rooms = 0;
const ready = KEYS.filter(k => FOCAL[k] ? [...FOCAL[k].source.matchAll(/[a-z][a-z-]+[a-z]/g)].some(m => HAS(m[0])) : HAS('car-sedan') || HAS('road-strip'));
if (ready.length < KEYS.length) console.log('NOTE: no modern meshes yet for', KEYS.filter(k => !ready.includes(k)).join(', '), ': those rooms are skipped');
for (const k of ready) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 6; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 131 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const Lc = { ...L, placements: L.placements.filter(p => p.rule !== 'yard-edge').map(p => /^(streetlight|pallet-racking|shipping-container)$/.test(p.id) ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9), p.dims[2]] } : p) };
  if (OUT.has(k)) { ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`); for (const p of L.placements) if (p.rule !== 'yard-edge') { const X0 = r.x * 5, Z0 = r.z * 5; ok(p.x >= X0 && p.x <= X0 + r.w * 5 && p.z >= Z0 && p.z <= Z0 + r.d * 5, `${tag} ${p.id} outside the street`); } }
  else H.checkRoom(tag, B, r, Lc, { focal: L.purposeFail ? null : FOCAL[k], lights: true, fire: ELEC });
  const st = stats[k] ||= { n: 0, props: 0, fails: 0, things: new Map() };
  st.n++; st.props += L.placements.length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  for (const p of L.placements) ok(SKU.get(p.sku)?.tier === 'mod' || (SHARED.has(p.id) && PLAIN(SKU.get(p.sku)?.tier) && (!LOOKS(p.id) || LOOKS(p.id).includes(p.sku))), `${tag} ${p.id} (${p.sku}) is not a modern sku (nor a plain one of a role the modern set shares)`);
  if (FAMILY[k]) ok(r.family === FAMILY[k], `${tag} family ${r.family}`);
  for (const e of [...B.E.edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => s.room === 'r') && FAMILY[k])) ok(MOD_DOORS.test(e.doorType), `${tag} door type ${e.doorType}`);
  const I = L.modInfo || {};
  if (!L.purposeFail) {
    if (k === 'mod-apartment') ok(I.tv || I.sofa, `${tag} neither the screen nor the sofa`);
    if (k === 'mod-office') ok(I.desks >= 1 && I.chairs >= 1, `${tag} desks ${I.desks} chairs ${I.chairs}`);
    if (k === 'mod-bar') ok(I.counters >= 1 && I.stools >= 1, `${tag} bar ${I.counters} stools ${I.stools}`);
    if (k === 'mod-street' && Math.min(w, d) >= 4) ok(I.centre > 0 && I.cars > 0, `${tag} centre line ${I.centre}, cars ${I.cars}`);
    if (k === 'mod-alley') ok(I.dumpster && I.walls > 0, `${tag} dumpster ${I.dumpster}, walls ${I.walls}`);
    if (k === 'mod-store') ok(I.aisles + I.coolers >= 2, `${tag} aisles ${I.aisles} coolers ${I.coolers}`);
    if (k === 'mod-warehouse') ok(I.racks >= 1, `${tag} racks ${I.racks}`);
  }
  if (k === 'mod-alley') ok(L.placements.filter(p => p.rule === 'yard-edge').every(p => SKU.get(p.sku)?.family === 'city-brick'), `${tag} the alley walls are city brick`);
}
// ---- leak: fantasy rooms never place a modern sku
let fant = 0;
for (const t of S.types.filter(t => !t.key.startsWith('mod-') && !t.key.startsWith('cyb-') && !t.byHand && t.key !== 'hill')) for (let seed = 1; seed <= 2; seed++) {
  const B = H.build([mk('r', t.key, 10, 10, t.cells[0], t.cells[1], seed * 53, 1)]), L = B.solve('r'); fant++;
  ok(!L.placements.some(p => SKU.get(p.sku)?.tier === 'mod'), `fantasy ${t.key} seed ${seed} places a modern sku: ${L.placements.filter(p => SKU.get(p.sku)?.tier === 'mod').map(p => p.sku)}`);
}
if (PRINT) for (const [k, st] of Object.entries(stats)) console.log(k.padEnd(16), `${st.n} rooms, ${(st.props / st.n).toFixed(1)} placements, ${st.fails} fails;`, [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([i, n]) => `${i} ${n}`).join(', '));
console.log(`mod: ${rooms} modern rooms, ${fant} fantasy rooms solved`);
H.report('mod');
