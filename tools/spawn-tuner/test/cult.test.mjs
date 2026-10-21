// Cult sanctum (2026-10-11): nine room types, black-stone walls (the hidden entrance: a dressed-stone cellar), no windows,
// and the FLAVOR SLOTS (solver2.js types:flavor): devils and spiders.
//   node test/cult.test.mjs [tuner dir] [--print]
//   rooms     every room type x 6 sizes x 6 seeds x 3 arrangements x 2 flavors: the shared checks (ccm_lib.mjs) + lit, no
//             windows; every flavor-* placement is the room's flavor, and the other flavor's skus never appear
//   walls     family, doors (black oak; the bookcase between the hidden entrance and the sanctum; a lone entrance has its
//             way on), panels (alcoves down the passage, the secret door in the vault)
//   annex     the leg of a shaped room: lit, no second key piece
//   a sanctum nine rooms side by side: every room reachable, one flavor throughout (by building)
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
import { readFileSync } from 'node:fs';
const S = await loadTree('cult'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = ['cult-entry', 'cult-passage', 'cult-sanctum', 'cult-summoning', 'cult-cells', 'cult-vestry', 'cult-library', 'cult-quarters', 'cult-vault'];
for (const k of KEYS) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FOCAL = { 'cult-entry': /^(shelving-freestanding|cupboard|barrel|crate|sack)$/, 'cult-passage': null, 'cult-sanctum': /^(altar-sacrificial|altar-stone)$/, 'cult-summoning': /^(rite-sigil-stone|portal-arch|decal-ritual-circle|flavor-sigil)$/,
  'cult-cells': /^(cage-sacrifice|cage-floor)$/, 'cult-vestry': /^(robe-stand|robe-rack|wardrobe)$/, 'cult-library': /^(spellbook-lectern|lectern|bookshelf|bookcase-ladder|shelving-freestanding)$/, 'cult-quarters': /^(bed-straw-pallet|bunk-bed|bedroll)$/,
  'cult-vault': /^(flavor-idol|altar-sacrificial|statue-hooded|pedestal-display)$/ };
const FIRE = [[/flame-bowl/, 'brazier'], [/^flavor-censer/, 'candle']];
const SIZES = { 'cult-entry': [[4, 3], [3, 3], [2, 3], [5, 4], [3, 5], [6, 5]], 'cult-passage': [[8, 3], [3, 2], [2, 6], [12, 3], [6, 2], [3, 10]], 'cult-sanctum': [[5, 8], [4, 5], [3, 4], [6, 10], [9, 5], [8, 12]],
  'cult-summoning': [[5, 5], [3, 3], [4, 4], [6, 5], [4, 7], [8, 8]], 'cult-cells': [[5, 4], [3, 3], [4, 3], [6, 5], [3, 6], [8, 6]], 'cult-vestry': [[4, 3], [3, 3], [3, 4], [5, 4], [4, 6], [7, 5]],
  'cult-library': [[4, 4], [3, 3], [4, 3], [6, 4], [4, 6], [7, 6]], 'cult-quarters': [[5, 4], [3, 3], [4, 3], [7, 5], [4, 7], [9, 6]], 'cult-vault': [[3, 4], [2, 2], [3, 3], [4, 4], [5, 4], [6, 6]] };
const other = (k) => k === 'cult-passage' ? 'cult-vestry' : 'cult-passage';
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: (k, w, d, s) => [mk('h', other(k), 10, 7, Math.max(w, 4), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', k === 'cult-entry' ? 'cult-vestry' : 'cult-entry', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', other(k), 10, 10 + d, Math.max(w, 3), 3, s + 2, 3), mk('v', k === 'cult-cells' ? 'cult-quarters' : 'cult-cells', 10 + w, 10, 4, d, s + 3, 4)],
};
const FLV = ['devils', 'spiders'], stats = {}; let rooms = 0, flavored = 0;
const flavOf = (p) => /^flavor-/.test(p.id) ? S.lib.objects[p.id]?.skus.find(s => s.sku === p.sku)?.shape : null;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 6; seed++) {
  const flavor = FLV[seed % 2], B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r');
  const solve0 = B.solve; B.solve = (id, o = {}) => solve0(id, { flavor, ...o }); // (checkRoom solves again for the determinism check)
  const L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed} ${flavor}`;
  rooms++;
  const res = H.checkRoom(tag, B, r, L, { focal: FOCAL[k], lights: true, fire: FIRE, windows: false });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], light: 0, panels: 0, fails: 0, flav: 0, things: new Map() };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); st.light += L.placements.filter(p => fireType(p.id, FIRE)).length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  // flavor: every flavor piece is the room's flavor; nothing of the cult shows in the false cellar
  const fl = L.placements.filter(p => flavOf(p)); st.flav += fl.length; flavored += fl.length;
  for (const p of fl) ok(flavOf(p) === flavor, `${tag}: ${p.sku} in a ${flavor} room`);
  if (k === 'cult-entry') ok(!fl.length && !L.placements.some(p => /^(statue-hooded|altar-|robe-|rite-|candle-black|elemental-brazier)/.test(p.id)), `${tag}: something of the cult shows in the false cellar`);
  if (k === 'cult-sanctum' && w * d >= 40 && arr === 'alone') { ok(fl.some(p => p.id === 'flavor-idol'), `${tag}: a ${w * d}-cell sanctum has no idol`); ok(fl.some(p => p.id === 'flavor-altarpiece'), `${tag}: no altar-piece on the altar`); ok(fl.some(p => p.id === 'flavor-sigil'), `${tag}: no sigil`); ok(fl.some(p => /^flavor-(banner|relief)$/.test(p.id)), `${tag}: nothing of the flavor on the walls`); }
  if (/^cult-(sanctum|summoning)$/.test(k)) { const ring = L.placements.find(p => p.id === 'decal-ritual-circle'); if (ring) ok(/--plain$/.test(ring.sku), `${tag}: the ritual circle is ${ring.sku}, not the plain ring`); }
  // walls
  ok(r.family === (k === 'cult-entry' ? 'dressed-stone' : 'black-stone'), `${tag} family ${r.family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  ok(!mine.some(e => e.kind === 'window' && e.owner.room === r.id), `${tag} a window on a sanctum wall`);
  const panels = mine.filter(e => e.panel && e.owner.room === r.id); st.panels += panels.length;
  for (const e of panels) { ok(e.kind === 'wall' && e.sides.length === 1, `${tag} panel ${e.panel} on a ${e.kind} edge`); ok(S.w.PANELS[k]?.some(rule => rule.ids.includes(e.panel)), `${tag} panel ${e.panel} is not this room type's`); }
  if (k === 'cult-passage') ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} no clear through-line`);
  if (k === 'cult-passage' && arr === 'alone' && w !== d) { const ds = mine.filter(e => e.kind === 'door'), end = w > d ? ['W', 'E'] : ['N', 'S'];
    ok(ds.length === 2 && ds.every(e => end.includes(e.owner.side)), `${tag} a lone passage should have a door in each end wall: ${ds.map(e => e.owner.side).join(', ')}`); }
  if (k === 'cult-sanctum' && arr === 'alone' && w !== d) ok(mine.filter(e => e.kind === 'door').every(e => (w > d ? ['W', 'E'] : ['N', 'S']).includes(e.owner.side)), `${tag} a lone sanctum's door should be in a short wall`);
  // doors: black oak; the hidden entrance: a cellar door outside, the bookcase toward the sanctum (and as a lone entrance's way on)
  for (const e of mine.filter(e => e.kind === 'door')) {
    const types = e.sides.map(s => B.rooms.find(x => x.id === s.room).type), want = e.flag === 'way-on' ? (k === 'cult-entry' ? 'door-secret-bookcase' : 'door-crypt')
      : e.sides.length === 1 ? (k === 'cult-entry' ? 'door-reinforced' : 'door-crypt') : types.includes('cult-entry') ? 'door-secret-bookcase' : 'door-crypt';
    ok(e.doorType === want, `${tag} door ${e.doorType} (${types.join(' | ')}${e.flag ? ', ' + e.flag : ''}), wanted ${want}`);
  }
  if (k === 'cult-entry' && arr === 'alone') ok(mine.some(e => e.kind === 'door' && e.doorType === 'door-secret-bookcase'), `${tag} a lone hidden entrance has no bookcase door`);
  // tall things never stand in front of a special panel
  const ops = r.panels || [], X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5;
  for (const p of standing(L).filter(p => p.dims[1] > 3.6 && p.side)) for (const o of ops.filter(o => o.side === p.side)) {
    const t = p.side === 'N' || p.side === 'S' ? p.x - X0 : p.z - Z0, half = (p.side === 'N' || p.side === 'S' ? aabb(p)[0] : aabb(p)[1]) / 2, near = (p.side === 'N' ? p.z - Z0 : p.side === 'S' ? Z1 - p.z : p.side === 'W' ? p.x - X0 : X1 - p.x) < aabb(p)[1] / 2 + 1.2;
    if (near) ok(!(t + half > o.index * CELL - 0.5 + 0.05 && t - half < o.index * CELL + 4.5 - 0.05), `${tag} tall ${p.id} stands in front of a ${o.panel} panel`);
  }
  // type-specific
  if (k === 'cult-quarters' && w * d >= 20) ok(L.placements.filter(p => p.rule === 'key-bed').length >= 3, `${tag} a ${w * d}-cell dormitory with under 3 beds`);
  if (k === 'cult-quarters') ok(!L.placements.some(p => /^(mil-|weapon-rack|armor-stand)/.test(p.id)), `${tag} arms in the acolytes' quarters`);
  if (k === 'cult-library' && w * d >= 16) ok(L.placements.filter(p => p.rule === 'bookcase').length >= 2, `${tag} a ${w * d}-cell library with under 2 bookcases`);
  if (k === 'cult-cells' && w * d >= 20) ok(L.placements.filter(p => p.rule === 'key-cage').length >= 2, `${tag} a ${w * d}-cell gaol with under 2 cages`);
  if (k === 'cult-summoning' && Math.min(w, d) >= 4) ok(L.placements.filter(p => p.id === 'rite-sigil-stone').length === 4, `${tag}: ${L.placements.filter(p => p.id === 'rite-sigil-stone').length} boundary stones, not 4`);
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} sanctum rooms solved (9 types x 6 sizes x 3 arrangements x 6 seeds, flavors in turn); ${flavored} flavor pieces placed, each its room's flavor`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(15)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)}), ${(st.light / st.n).toFixed(1)} lights, ${(st.flav / st.n).toFixed(1)} flavor pieces, ${(st.panels / st.n).toFixed(1)} panels | ${top}`); }

// ---- flavor rules: the default, the building, a flavor with nothing made
{ const one = (k, room, opts = {}, lib = S.lib) => { const r = { ...mk('r', k, 10, 10, ...S.T[k].cells, 77, 1), ...room }; r.extDoor = S.w.chooseExteriorDoor(r, [r]); const E = S.w.computeEdges([r], { engine: 'v2' });
    return S.s2.solveRoom2({ lib, type: S.T[k], room: r, openings: E.openings.get('r'), opts: { orient: S.orient, minStars: 3, hideMasking: true, ...opts }, roomTypeOf: () => k }); };
  const fl = (L) => [...new Set(L.placements.map(flavOf).filter(Boolean))];
  ok(fl(one('cult-sanctum', {})).join() === 'devils', `with nothing said, a sanctum is ${fl(one('cult-sanctum', {}))} (devils is the default)`);
  ok(fl(one('cult-sanctum', { flavor: 'spiders' })).join() === 'spiders', 'room.flavor decides');
  ok(fl(one('cult-sanctum', { flavor: 'spiders' }, { flavor: 'devils' })).join() === 'spiders', 'room.flavor beats opts.flavor');
  const seen = new Set(); for (let b = 0; b < 24; b++) { const id = 'bld_' + b, a = fl(one('cult-sanctum', { building: id })), c = fl(one('cult-vault', { building: id })), p = fl(one('cult-passage', { building: id }));
    ok(a.length === 1 && c.join() === a.join() && (!p.length || p.join() === a.join()), `building ${id}: sanctum ${a}, vault ${c}, passage ${p}`); seen.add(a[0]); }
  ok(seen.has('devils') && seen.has('spiders'), `24 buildings between them take both flavors (${[...seen]})`);
  const empty = structuredClone(S.lib); // A deliberately unfilled known faction, independent of future asset deliveries.
  for (const [id,o] of Object.entries(empty.objects)) if (id.startsWith('flavor-')) o.skus = o.skus.filter(s => s.shape !== 'tentacles');
  const none = one('cult-sanctum', { flavor: 'tentacles' }, {}, empty);
  ok(!none.purposeFail && !none.placements.some(flavOf) && none.placements.some(p => p.id === 'altar-sacrificial'), `a flavor with no pieces leaves its slots empty and the sanctum whole (${fl(none)})`);
  ok(none.placements.some(p => fireType(p.id, FIRE)), 'a sanctum of a flavor with no censer is still lit');
}

// ---- the leg of an L-shaped room
if (/args\.annex/.test(readFileSync(S.dir + 'js/solver2.js', 'utf8'))) {
  let n = 0, props = 0;
  for (const k of KEYS) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 6; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => /^(altar-|flavor-idol|flavor-altarpiece|portal-arch|spellbook-lectern|robe-stand|cage-|rite-sigil-stone|decal-ritual-circle|flavor-sigil)/.test(p.id)), `${tag} a key piece in an annex: ${L.placements.map(p => p.id).join(', ')}`);
    ok(L.placements.some(p => fireType(p.id, FIRE)), `${tag} annex unlit`);
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id} / ${fl[j].id}`); }
  }
  console.log(`annex (the leg of a shaped room, no key program): ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
}

// ---- the family
ok(S.w.WALL_FAMILIES.includes('black-stone') && S.w.FAMILY_FALLBACK['black-stone'] === 'dressed-stone' && S.w.meshFamily('black-stone') === 'dressed-stone', 'black-stone is registered and borrows dressed stone');
for (const piece of ['wall-straight', 'wall-doorway', 'wall-alcove', 'wall-secret-door']) ok(S.lib.objects[piece]?.skus.some(s => s.family === 'black-stone' && s.bounds), `the library has a black-stone ${piece}`);
ok(!S.lib.objects['wall-window-small'].skus.some(s => s.family === 'black-stone'), 'there is no black-stone window piece');
for (const id of ['flavor-idol', 'flavor-altarpiece', 'flavor-banner', 'flavor-relief', 'flavor-sigil']) for (const f of FLV) ok(S.lib.objects[id]?.skus.some(s => s.shape === f && !s.tier), `${id} has a ${f} sku with no tier`);
ok(S.lib.objects['door-secret-bookcase']?.skus.some(s => s.piece === 'leaf'), 'the bookcase door is a leaf');

// ---- a whole sanctum, side by side: every room reachable, one flavor
{ let outside = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rs = [mk('e', 'cult-entry', 10, 10, 4, 3, seed, 1), mk('p', 'cult-passage', 14, 10, 8, 3, seed + 1, 2), mk('s', 'cult-sanctum', 22, 10, 5, 8, seed + 2, 3), mk('v', 'cult-vestry', 14, 13, 4, 3, seed + 3, 4),
      mk('l', 'cult-library', 18, 13, 4, 4, seed + 4, 5), mk('q', 'cult-quarters', 10, 13, 4, 5, seed + 5, 6), mk('c', 'cult-cells', 14, 16, 4, 4, seed + 6, 7), mk('m', 'cult-summoning', 27, 10, 5, 5, seed + 7, 8), mk('x', 'cult-vault', 27, 15, 3, 4, seed + 8, 9)];
    for (const r of rs) r.building = 'bld_' + seed;
    const B = H.build(rs); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of doors) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = doors.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(seen.size === rs.length, `a packed sanctum (seed ${seed}): ${rs.length - seen.size} rooms cannot be reached`);
    outside += doors.filter(e => e.sides.length === 1).length;
    const fl = new Set();
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `packed sanctum seed ${seed}: ${r.type} ${L.purposeFail}`); for (const p of L.placements) if (flavOf(p)) fl.add(flavOf(p)); }
    ok(fl.size === 1, `packed sanctum seed ${seed}: flavors ${[...fl]} in one building`);
    for (const e of doors.filter(e => e.sides.some(s => s.room === 'e') && e.sides.length === 2)) ok(e.doorType === 'door-secret-bookcase', `packed sanctum seed ${seed}: the entrance's inner door is ${e.doorType}`);
  }
  console.log(`a whole sanctum (9 rooms side by side, ${n} seeds): every room reachable; ${(outside / n).toFixed(1)} outside doors each; one flavor per building`);
}
H.report('cult');
