// Wizard's tower (2026-10-11): eleven room types, tower-stone walls (the apothecary: half-timber).
//   node tests/wizard.test.mjs [tuner dir] [--print]      default tree: ../sandbox/wizard (make_sandbox.py wizard)
// At integration: copied to tools/spawn-tuner/test/ beside ccm_lib.mjs and run against tools/spawn-tuner itself.
//   rooms     every room type x 6 sizes x 8 seeds x 3 arrangements (alone; off the stair; in a packed tower floor): the
//             shared checks (ccm_lib.mjs: no purpose fail, nothing outside or overlapping, the focal piece present, paths
//             clear, the key feature in view, nothing hung on a door / window / panel, deterministic) + what each room is for
//   walls     the family, the tower door, no windows where the type has none, one shop window on the apothecary
//   annex     the leg of an L-shaped room: dressed, lit, no second key piece
//   a tower   one floor of four rooms round the stair: every room reachable
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
const S = await loadTree('wizard'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = ['wiz-lab', 'wiz-study', 'wiz-summoning', 'wiz-observatory', 'wiz-scrying', 'wiz-store', 'wiz-apothecary', 'wiz-bedchamber', 'wiz-menagerie', 'wiz-stair', 'wiz-workshop'];
for (const k of KEYS) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const have = (id) => !!S.lib.objects[id]?.skus.some(s => s.bounds || s.kind === 'flat');
const FOCAL = { 'wiz-lab': /^(alch-athanor|alch-bench-dressed|alch-still-copper-large|cauldron|table-kitchen-prep)/, 'wiz-study': /^(bookshelf|scroll-rack|desk-)/, 'wiz-summoning': /^(decal-ritual-circle|spellbook-lectern|lectern|elemental-brazier|brazier-|rite-pillar-candle-tall|candle|pedestal-display)/,
  'wiz-observatory': /^(telescope|armillary-great|trade-globe)/, 'wiz-scrying': /^(scrying-pool|orb-socket-pedestal|mirror-standing|table-round-small|pedestal-display)$/, 'wiz-store': /^(apothecary-drawers|alch-reagent-shelf-tall|cabinet-curios|shelving)/,
  'wiz-apothecary': /^(alch-counter-apothecary|counter-shop|apothecary-drawers|alch-reagent-shelf-tall|table-kitchen-prep|cabinet-curios)$/, 'wiz-bedchamber': /^bed-/, 'wiz-menagerie': /^(egg-nest-great|perch-tree|birdcage-standing|cage-floor|vivarium|animal-hutch|alch-familiar-perch)$/,
  'wiz-stair': /^(stair-spiral-wide|statue-bust|armillary-great|pedestal-display|bench-long)$/, 'wiz-workshop': /^(portal-arch|enchanting-table|arcane-pylon|table-kitchen-prep|crystal-formation)$/ };
const NOWIN = new Set(['wiz-summoning', 'wiz-scrying', 'wiz-store']);
// sizes in cells: the default, the smallest tower room, an oblong each way, bigger, a hall
const SIZES = Object.fromEntries(KEYS.map(k => [k, [S.T[k].cells, [2, 2], [3, 4], [5, 3], [5, 5], [8, 6]]]));
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offStair: (k, w, d, s) => [mk('h', k === 'wiz-stair' ? 'wiz-study' : 'wiz-stair', 10, 7, Math.max(w, 3), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', 'wiz-stair', 10 - 3, 10, 3, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', k === 'wiz-store' ? 'wiz-lab' : 'wiz-store', 10, 10 + d, w, 3, s + 2, 3), mk('v', k === 'wiz-study' ? 'wiz-bedchamber' : 'wiz-study', 10 + w, 10, 4, d, s + 3, 4)],
};
const stats = {}; let rooms = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  // (the spiral rises through the ceiling to the floor above: its height is not this room's to hold)
  const res = H.checkRoom(tag, B, r, { ...L, placements: L.placements.map(p => p.id === 'stair-spiral-wide' ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9), p.dims[2]] } : p) }, { focal: FOCAL[k], lights: true, fire: [], windows: NOWIN.has(k) ? false : undefined });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], fails: 0, things: new Map(), min: 99 };
  st.n++; st.props += res.props; st.min = Math.min(st.min, res.props); st.dens.push(res.density / res.target); if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  ok(r.family === (k === 'wiz-apothecary' ? 'half-timber' : 'tower-stone'), `${tag} family ${r.family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  if (NOWIN.has(k)) ok(!mine.some(e => e.kind === 'window' && e.owner.room === r.id), `${tag} a window on a windowless room's wall`);
  // doors: the tower leaf in every tower doorway (a door shared with the apothecary may be the shop's)
  for (const e of mine.filter(e => e.kind === 'door')) { const types = e.sides.map(s => B.rooms.find(x => x.id === s.room).type); if (!types.includes('wiz-apothecary')) ok(e.doorType === 'door-tower', `${tag} door ${e.doorType} between ${types}`); }
  // the apothecary's display window: one panel, on a plain outside wall, where the room has one free
  if (k === 'wiz-apothecary') { const panels = mine.filter(e => e.panel && e.owner.room === r.id); ok(panels.length <= 1 && panels.every(e => e.panel === 'wall-shop-window' && e.kind === 'wall' && e.sides.length === 1), `${tag} shop window panels: ${panels.map(e => e.panel + ':' + e.kind)}`);
    if (arr === 'alone' && w * d >= 9) ok(panels.length === 1, `${tag} a lone shop has no display window`); }
  const cells = w * d, least = Math.min(w, d), has = (re, n = 1) => L.placements.filter(p => re.test(p.id)).length >= n;
  // what each room is for, from the default size up, when the piece exists in this library
  if (k === 'wiz-lab' && cells >= 12 && have('alch-bench-dressed')) ok(has(/^alch-bench-dressed$/), `${tag} a laboratory with no bench of apparatus`);
  if (k === 'wiz-study' && cells >= 12) ok(has(/^bookshelf$/, 2), `${tag} a study with under two bookcases`);
  if (k === 'wiz-summoning' && least >= 3) { if (have('decal-ritual-circle')) ok(has(/^decal-ritual-circle$/), `${tag} no circle`); ok(L.placements.filter(p => p.rule === 'circle-candle').length >= 4, `${tag} only ${L.placements.filter(p => p.rule === 'circle-candle').length} candles on the circle`);
    const c = L.placements.find(p => p.id === 'decal-ritual-circle'); if (c) for (const p of standing(L)) ok(p.rule === 'circle-candle' || Math.hypot(p.x - c.x, p.z - c.z) > c.dims[0] / 2 * 0.6, `${tag} ${p.id} stands inside the circle`); }
  if (k === 'wiz-observatory' && least >= 3 && have('telescope-great')) ok(has(/^telescope-great$/), `${tag} no great telescope`);
  if (k === 'wiz-scrying' && least >= 3 && have('scrying-pool')) ok(has(/^scrying-pool$/), `${tag} no scrying basin`);
  if (k === 'wiz-store' && cells >= 9) ok(L.placements.filter(p => /^(alch-reagent-shelf-tall|apothecary-drawers|cabinet-curios|shelving-freestanding)$/.test(p.id)).length >= 3, `${tag} a store with under three shelves`);
  if (k === 'wiz-bedchamber' && cells >= 9 && have('hatstand-wizard')) ok(has(/^hatstand-wizard$/), `${tag} no robe and hat`);
  if (k === 'wiz-menagerie' && cells >= 9) ok(L.placements.filter(p => /^(birdcage-standing|animal-hutch|vivarium|cage-floor|perch-tree)$/.test(p.id)).length >= 3, `${tag} a menagerie with under three cages`);
  if (k === 'wiz-stair' && least >= 3 && arr === 'alone') ok(has(/^stair-spiral-wide$/), `${tag} no spiral stair`);
  if (k === 'wiz-workshop' && cells >= 12 && least >= 3 && have('portal-arch')) ok(has(/^(portal-arch|enchanting-table)$/), `${tag} no arch and no enchanter's table`);
  if (PRINT && seed === 1 && arr === 'alone' && w === S.T[k].cells[0] && d === S.T[k].cells[1]) console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} wizard's tower rooms solved (${KEYS.length} types x 6 sizes x 3 arrangements x 8 seeds)`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(16)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props (min ${st.min}), density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target; ${top}`); }

// ---- the leg of an L-shaped room (args.annex: no key program runs there): dressed, lit, and NO second key piece
{ let n = 0, props = 0;
  for (const k of KEYS) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 6; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => /^(alch-athanor|decal-ritual-circle|telescope-great|scrying-pool|alch-counter-apothecary|bed-canopy|cage-floor|stair-spiral-wide|portal-arch|enchanting-table)$/.test(p.id)), `${tag} a key piece in the annex: ${L.placements.map(p => p.id)}`);
    ok(L.placements.some(p => fireType(p.id)), `${tag} annex unlit`);
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id} / ${fl[j].id}`); }
  }
  console.log(`annex (the leg of a shaped room, no key program): ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
}

// ---- the family is registered and borrows dressed stone; its pieces are in the library
ok(S.w.WALL_FAMILIES.includes('tower-stone') && S.w.FAMILY_FALLBACK['tower-stone'] === 'dressed-stone' && S.w.meshFamily('tower-stone') === 'dressed-stone', 'tower-stone is registered and borrows dressed stone');
for (const piece of ['wall-straight', 'wall-window-small']) ok(S.lib.objects[piece]?.skus.some(s => s.family === 'tower-stone' && s.bounds), `the library has a tower-stone ${piece}`);
ok(S.lib.objects['door-tower']?.skus.some(s => s.piece === 'leaf'), 'the tower door is a leaf');

// ---- one floor of a tower (what the building tool makes): four rooms round the stair, every room reachable
{ let outside = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rs = [mk('s', 'wiz-stair', 13, 13, 3, 3, seed, 1), mk('a', 'wiz-lab', 9, 13, 4, 4, seed + 1, 2), mk('b', 'wiz-study', 16, 12, 4, 4, seed + 2, 3), mk('c', 'wiz-store', 13, 10, 3, 3, seed + 3, 4), mk('d', 'wiz-apothecary', 13, 16, 4, 3, seed + 4, 5), mk('e', 'wiz-summoning', 5, 13, 4, 4, seed + 5, 6)];
    const B = H.build(rs); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of doors) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = doors.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(seen.size === rs.length, `a tower floor (seed ${seed}): ${rs.length - seen.size} rooms cannot be reached`);
    outside += doors.filter(e => e.sides.length === 1).length;
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `tower floor seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a tower floor (6 rooms round the stair, ${n} seeds): every room reachable; ${(outside / n).toFixed(1)} outside doors`);
}
H.report('wizard');
