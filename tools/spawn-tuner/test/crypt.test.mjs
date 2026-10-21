// Crypt (2026-10-05): seven room types, crypt-stone walls, no windows.
//   node tests/crypt.test.mjs [tuner dir] [--print]      default tree: ../sandbox/crypt (make_sandbox.py crypt)
// At integration: copy to tools/spawn-tuner/test/ with ccm_lib.mjs and run it against tools/spawn-tuner itself.
//   rooms     every room type x 6 sizes x 8 seeds x 3 arrangements (alone; off an antechamber; in a packed crypt):
//             the shared checks (ccm_lib.mjs: no purpose fail, nothing outside or overlapping, focal piece present,
//             paths clear, key feature in view, nothing hung on a door or panel, deterministic) + lit, no windows
//   walls     the family is crypt-stone, corners borrow dressed stone; special panels only on plain outside walls of the
//             rooms that have them, never on a door edge; the catacomb's long walls carry niches; doors are the iron gate
//             (outside) and the oak crypt door (between rooms)
//   a crypt   seven rooms laid side by side: every room reachable, and what the door policy does with five terminals
//   partial   only the first plates accepted (groups p1 + sib1): which rooms still have their purpose
import { loadTree, makeHarness, CELL, standing, aabb, fireType, HERE } from './ccm_lib.mjs';
import { existsSync } from 'node:fs';
const S = await loadTree('crypt'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = ['crypt-antechamber', 'crypt-vault', 'crypt-ossuary', 'crypt-catacomb', 'crypt-chapel', 'crypt-embalming', 'crypt-relic'];
for (const k of KEYS) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FOCAL = { 'crypt-antechamber': /^(statue-weeping-angel|monument-urn-draped)$/, 'crypt-vault': /^(sarcophagus|effigy-knight|stone-coffin-lidless|coffin)$/, 'crypt-ossuary': /^(ossuary-shrine|skull-pile|bones-pile)$/,
  'crypt-catacomb': null, 'crypt-chapel': /^altar-stone$/, 'crypt-embalming': /^(embalming-table|rite-corpse-on-slab)$/, 'crypt-relic': /^(reliquary-shrine|pedestal-display|sarcophagus)$/ };
const FIRE = [[/flame-bowl/, 'brazier'], [/sand-tray/, 'stubs']]; // the two fireType() lines the crypt adds (hung_and_lights.md)
// sizes in cells: the designer's default, smaller, bigger, both oblongs, a hall
const SIZES = { 'crypt-antechamber': [[4, 3], [3, 3], [2, 3], [6, 4], [3, 6], [8, 6]], 'crypt-vault': [[5, 4], [3, 3], [4, 4], [8, 5], [5, 8], [10, 8]], 'crypt-ossuary': [[4, 4], [3, 3], [5, 3], [6, 5], [4, 7], [8, 8]],
  'crypt-catacomb': [[10, 3], [3, 2], [2, 6], [12, 2], [6, 2], [2, 10]], 'crypt-chapel': [[4, 5], [3, 4], [4, 7], [6, 8], [8, 4], [5, 5]], 'crypt-embalming': [[4, 3], [3, 3], [3, 4], [6, 4], [4, 6], [8, 6]], 'crypt-relic': [[3, 3], [2, 2], [3, 2], [4, 4], [5, 4], [6, 6]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: (k, w, d, s) => [mk('h', k === 'crypt-antechamber' ? 'crypt-catacomb' : 'crypt-antechamber', 10, 6, Math.max(w, 4), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', 'crypt-antechamber', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', 'crypt-catacomb', 10, 10 + d, w, 2, s + 2, 3), mk('v', k === 'crypt-vault' ? 'crypt-relic' : 'crypt-vault', 10 + w, 10, 5, d, s + 3, 4)],
};
const stats = {}; let rooms = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const res = H.checkRoom(tag, B, r, L, { focal: FOCAL[k], lights: true, fire: FIRE, windows: false });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], light: 0, panels: 0, fails: 0, score: 0, things: new Map() };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); st.score += res.score; st.light += L.placements.filter(p => fireType(p.id, FIRE)).length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  // walls: family, no windows anywhere on the room, panels where the type has them
  ok(r.family === 'crypt-stone', `${tag} family ${r.family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  ok(!mine.some(e => e.kind === 'window' && e.owner.room === r.id), `${tag} a window on a crypt wall`);
  const panels = mine.filter(e => e.panel && e.owner.room === r.id); st.panels += panels.length;
  for (const e of panels) { ok(e.kind === 'wall' && e.sides.length === 1, `${tag} panel ${e.panel} on a ${e.kind} edge with ${e.sides.length} sides`); ok(S.w.PANELS[k]?.some(rule => rule.ids.includes(e.panel)), `${tag} panel ${e.panel} is not this room type's`); }
  if (k === 'crypt-catacomb' && arr === 'alone' && Math.max(w, d) >= 6) ok(panels.length >= Math.max(w, d), `${tag} only ${panels.length} niche panels on a ${Math.max(w, d)}-cell corridor`);
  if (k === 'crypt-catacomb') ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} no clear through-line`);
  // the rework (2026-10-05, blind reads): a lone corridor is entered at an END and has a way on at the other; no rack, urn niche or plaque in it
  if (k === 'crypt-catacomb' && arr === 'alone' && w !== d) { const ds = mine.filter(e => e.kind === 'door'), end = w > d ? ['W', 'E'] : ['N', 'S'];
    ok(ds.length === 2 && ds.every(e => end.includes(e.owner.side)) && ds.filter(e => e.flag === 'way-on').length === 1, `${tag} a lone corridor should have a door in each end wall: ${ds.map(e => e.owner.side + (e.flag ? ':' + e.flag : '')).join(', ')}`); }
  if (k === 'crypt-catacomb') ok(!L.placements.some(p => /^(catacomb-shelf-bones|burial-urn-niche|rite-memorial-plaque|stone-coffin-lidless|candle-drippings-mound)$/.test(p.id)), `${tag} a thing that misreads from above stands in the corridor`);
  // the ossuary is built round a heap, never the shrine (it read as a throne); its outside walls are skull panels
  if (k === 'crypt-ossuary') { ok(!L.placements.some(p => p.id === 'ossuary-shrine'), `${tag} the bone shrine is back`); ok(L.placements.some(p => p.rule === 'key-heap'), `${tag} no heap as the key piece`); }
  // the chapel: its outside door faces the altar down the long axis when it stands alone; what lies in state is a coffin or a
  // wrapped body on the bare bier (the red pall read as a throne), and the altar has no cloth (it read as an open book)
  if (k === 'crypt-chapel') { const bier = L.placements.find(p => p.rule === 'key-bier');
    ok(!L.placements.some(p => p.id === 'rite-funeral-pall' || p.id === 'rite-altar-cloth'), `${tag} the pall or the altar cloth is back`);
    if (bier) ok(L.placements.some(p => p.parent === bier.uid && /^(coffin|rite-mummified-remains)$/.test(p.id)), `${tag} nothing lies on the bier`);
    if (arr === 'alone' && w !== d) ok(mine.filter(e => e.kind === 'door').every(e => (w > d ? ['W', 'E'] : ['N', 'S']).includes(e.owner.side)), `${tag} a lone chapel's door should be in a short wall`); }
  // tall things never stand in front of a special panel (a 7-ft bone rack hiding the burial niches)
  const ops = r.panels || [], X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5;
  for (const p of standing(L).filter(p => p.dims[1] > 3.6 && p.side)) for (const o of ops.filter(o => o.side === p.side)) {
    const t = p.side === 'N' || p.side === 'S' ? p.x - X0 : p.z - Z0, half = (p.side === 'N' || p.side === 'S' ? aabb(p)[0] : aabb(p)[1]) / 2, near = (p.side === 'N' ? p.z - Z0 : p.side === 'S' ? Z1 - p.z : p.side === 'W' ? p.x - X0 : X1 - p.x) < aabb(p)[1] / 2 + 1;
    if (near) ok(!(t + half > o.index * CELL - 0.5 + 0.05 && t - half < o.index * CELL + 4.5 - 0.05), `${tag} tall ${p.id} stands in front of a ${o.panel} panel`);
    ok(B.E.edges.get(o.key)?.panel === o.panel, `${tag} room.panels and the edge map disagree`);
  }
  // doors: the iron gate to outside (the relic chamber may have the oak door), oak between crypt rooms
  for (const e of mine.filter(e => e.kind === 'door')) ok(e.sides.length === 1 ? (e.doorType === 'crypt-gate-iron' || (k === 'crypt-relic' && e.doorType === 'door-crypt') || (e.flag === 'way-on' && e.doorType === 'door-crypt')) : /^(door-crypt|crypt-gate-iron)$/.test(e.doorType), `${tag} door type ${e.doorType} (${e.sides.length} sides)`);
  // type-specific
  if (k === 'crypt-chapel' && w * d >= 20 && Math.min(w, d) >= 4) ok(L.placements.filter(p => p.rule === 'pew').length >= 2, `${tag} a chapel of ${w * d} cells with ${L.placements.filter(p => p.rule === 'pew').length} seats`);
  if (k === 'crypt-vault' && w * d >= 40) ok(L.placements.filter(p => /^(sarcophagus|effigy-knight|stone-coffin-lidless)/.test(p.id) && /tomb/.test(p.rule)).length >= 4, `${tag} a ${w * d}-cell vault with under 4 tombs`);
  if (k === 'crypt-relic') ok(B.E.openings.get(r.id).filter(o => o.kind === 'door' && !o.part).length <= 1 || arr === 'packed', `${tag} the relic chamber has more than one door`);
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} crypt rooms solved (7 types x 6 sizes x 3 arrangements x 8 seeds)`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(18)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)}), ${(st.light / st.n).toFixed(1)} lights, ${(st.panels / st.n).toFixed(1)} panels; per room: ${top}`); }

// ---- the leg of an L-shaped room (args.annex: no key program runs there): dressed, lit, and NO second key piece
if (/args\.annex/.test((await import('node:fs')).readFileSync(S.dir + 'js/solver2.js', 'utf8'))) {
  let n = 0, props = 0;
  for (const k of KEYS) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 6; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door'); // a leg has joins, not doors of its own
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => /^(altar-stone|statue-weeping-angel|monument-urn-draped|ossuary-shrine|reliquary-shrine|embalming-table|rite-corpse-on-slab|sarcophagus|effigy-knight|rite-funeral-pall|rite-funeral-bier|crypt-gate-iron|wall-|door-|tomb-door|ossuary-wall)/.test(p.id)), `${tag} a key piece or kit piece in the annex: ${L.placements.map(p => p.id).filter(i => /^(altar|statue|monument|ossuary-shrine|reliquary-shrine|embalming|rite-corpse|sarcophagus|effigy|rite-funeral|crypt-gate|wall-|door-|tomb-door|ossuary-wall)/.test(i))}`);
    ok(L.placements.some(p => fireType(p.id, FIRE)), `${tag} annex unlit`);
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id}/${fl[j].id}`); }
  }
  console.log(`annex (the leg of a shaped room, no key program): ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
} else console.log('annex: this tree\'s solver2.js has no args.annex (shaped rooms not merged yet): skipped');

// ---- corners borrow dressed stone; the family is offered by the Walls select
ok(S.w.WALL_FAMILIES.includes('crypt-stone') && S.w.FAMILY_FALLBACK['crypt-stone'] === 'dressed-stone' && S.w.meshFamily('crypt-stone') === 'dressed-stone', 'crypt-stone is registered and borrows dressed stone');
for (const piece of ['wall-straight', 'wall-doorway', 'wall-crypt-niches', 'ossuary-wall']) ok(S.lib.objects[piece]?.skus.some(s => s.family === 'crypt-stone' && s.bounds), `the library has a crypt-stone ${piece}`);
ok(!S.lib.objects['wall-window-small'].skus.some(s => s.family === 'crypt-stone'), 'there is no crypt-stone window piece (and none is ever asked for)');

// ---- a whole crypt, side by side (what the building tool makes): every room reachable; count the outside doors
{ let outside = 0, forced = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rs = [mk('a', 'crypt-antechamber', 10, 10, 4, 3, seed, 1), mk('c', 'crypt-catacomb', 14, 10, 6, 3, seed + 1, 2), mk('v', 'crypt-vault', 10, 13, 5, 4, seed + 2, 3), mk('o', 'crypt-ossuary', 15, 13, 5, 4, seed + 3, 4),
      mk('h', 'crypt-chapel', 20, 10, 4, 7, seed + 4, 5), mk('e', 'crypt-embalming', 10, 17, 5, 3, seed + 5, 6), mk('x', 'crypt-relic', 15, 17, 5, 3, seed + 6, 7)];
    const B = H.build(rs); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of doors) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = doors.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(seen.size === rs.length, `a packed crypt (seed ${seed}): ${rs.length - seen.size} rooms cannot be reached`);
    outside += doors.filter(e => e.sides.length === 1).length; forced += doors.filter(e => e.flag).length;
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `packed crypt seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a whole crypt (7 rooms side by side, ${n} seeds): every room reachable; ${(outside / n).toFixed(1)} outside doors per crypt, ${(forced / n).toFixed(1)} doors added for reachability`);
}

// ---- partial delivery: only the first plates' meshes (groups p1 + sib1) exist. Which rooms still work?
{ const part = `${HERE}/../sandbox/crypt-p1/`;
  if (existsSync(part + 'data/library.json')) {
    const { readFileSync } = await import('node:fs'); const lib = JSON.parse(readFileSync(part + 'data/library.json')), types = JSON.parse(readFileSync(part + 'data/rooms.json')), T2 = Object.fromEntries(types.map(t => [t.key, t]));
    const out = [];
    for (const k of KEYS) { let fail = 0, n = 0, dark = 0;
      for (const [w, d] of SIZES[k].slice(0, 3)) for (let seed = 1; seed <= 6; seed++) { const r = mk('r', k, 10, 10, w, d, seed * 31 + w, 1); r.extDoor = S.w.chooseExteriorDoor(r, [r]); const E = S.w.computeEdges([r], { engine: 'v2' });
        const L = S.s2.solveRoom2({ lib, type: T2[k], room: r, openings: E.openings.get('r'), opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k }); n++; if (L.purposeFail) fail++; if (!L.placements.some(p => fireType(p.id, FIRE))) dark++; }
      out.push(`${k.replace('crypt-', '')} ${fail}/${n} fail${dark ? `, ${dark} unlit` : ''}`); ok(dark === 0, `partial delivery: ${k} unlit in ${dark} rooms`); }
    console.log(`partial delivery (p1 + sib1 only, 23 meshes): ${out.join('; ')}`);
  } else console.log('partial delivery: skipped (python3 make_sandbox.py crypt-p1 --scope once,crypt --accept p1+sib1 --types crypt)');
}
H.report('crypt');
