// Dungeon & prison (2026-10-11): fourteen room types, dressed-stone and cut-rock walls, no windows.
//   node test/dun.test.mjs [tuner dir] [--print]
//   rooms     every room type x 6 sizes x 8 seeds x 3 arrangements (alone; off a corridor; packed between others): the
//             shared checks (ccm_lib.mjs: no purpose fail, nothing outside or overlapping, focal piece present, paths
//             clear, key feature in view, nothing hung on a door, deterministic) + lit, no windows
//   corridors a lone corridor is entered at an end and has a way on; 1 cell wide it still solves and nothing stands in it;
//             a junction (a door in a long wall) joins the through-line; with one door it ends in a rock fall
//   strips    the chasm runs wall to wall and nothing but the bridge and the pillar tops stands on it; the sewer channel
//             likewise; the walk crosses the chasm
//   traps     trap things carry the catalog's trap / hazard affordance; a trap corridor has at least two on its line
//   a dungeon fourteen rooms side by side: every room reachable
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
const S = await loadTree('dun'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = S.w.DUN_ROOMS;
ok(KEYS.length === 14, 'fourteen dungeon rooms');
for (const k of KEYS) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FOCAL = { 'dun-corridor': null, 'dun-trap-corridor': /^(pressure-plate|trap-|pit-open|bear-trap)/, 'dun-dead-end': /^(collapse-rubble|rubble-pile|door-rune-sealed|door-face-carved|tomb-door-sealed|statue-|shrine-wayside|mimic-chest|chest-)/,
  'dun-cell-block': /^cell-bars$/, 'dun-guard-room': /^table-/, 'dun-interrogation': /^(chair-interrogation|rack-torture)$/, 'dun-vault': /^(chest-treasure|dun-treasure-hoard|chest-ironbound)/, 'dun-sewer': /^sewer-/,
  'dun-puzzle-hall': /^(door-rune-sealed|door-face-carved|tomb-door-sealed|rune-tile|floor-mosaic|statue-rotating)/, 'dun-chasm': /^(chasm-strip|pit-open)/, 'dun-den': /^(nest-monster|bones-pile)$/,
  'dun-shrine': /^(shrine-wayside|statue-forgotten-god|altar-stone|statue-weeping-angel)$/, 'dun-flooded': /^(statue-|pillar-|fountain-wall-skull|sewer-grate)/, 'dun-collapsed': /^(collapse-rubble|rubble-pile|stone-blocks-stack)$/ };
const FIRE = [[/flame-bowl/, 'brazier'], [/sand-tray/, 'stubs']];
const FAMILY = (k) => /cell-block|guard-room|interrogation|vault|sewer|flooded/.test(k) ? 'dressed-stone' : 'cut-rock';
const SIZES = { 'dun-corridor': [[8, 2], [6, 1], [1, 7], [10, 3], [3, 2], [2, 12]], 'dun-trap-corridor': [[8, 2], [6, 1], [2, 6], [10, 3], [4, 2], [3, 12]], 'dun-dead-end': [[4, 2], [3, 1], [2, 2], [2, 5], [5, 3], [3, 3]],
  'dun-cell-block': [[8, 6], [8, 5], [4, 3], [3, 2], [6, 10], [12, 6]], 'dun-guard-room': [[5, 4], [3, 3], [3, 2], [6, 5], [4, 7], [8, 6]], 'dun-interrogation': [[5, 4], [3, 3], [4, 3], [6, 5], [4, 7], [8, 6]],
  'dun-vault': [[4, 4], [3, 3], [2, 3], [5, 4], [4, 6], [7, 6]], 'dun-sewer': [[8, 3], [6, 2], [1, 6], [2, 8], [12, 3], [5, 4]], 'dun-puzzle-hall': [[6, 6], [4, 4], [3, 3], [5, 7], [8, 6], [10, 8]],
  'dun-chasm': [[7, 4], [5, 3], [4, 4], [3, 8], [8, 6], [10, 5]], 'dun-den': [[5, 5], [3, 3], [4, 3], [6, 5], [4, 7], [8, 7]], 'dun-shrine': [[3, 3], [2, 2], [3, 2], [4, 4], [3, 5], [6, 5]],
  'dun-flooded': [[5, 4], [3, 3], [4, 3], [6, 6], [4, 7], [8, 6]], 'dun-collapsed': [[6, 5], [4, 4], [3, 4], [5, 7], [8, 6], [10, 7]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: (k, w, d, s) => [mk('h', k === 'dun-corridor' ? 'dun-guard-room' : 'dun-corridor', 10, 7, Math.max(w, 4), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', 'dun-guard-room', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', 'dun-corridor', 10, 10 + d, w, 2, s + 2, 3), mk('v', k === 'dun-vault' ? 'dun-shrine' : 'dun-vault', 10 + w, 10, 4, d, s + 3, 4)],
};
const inRect = (p, x, z, w, d) => { const [aw, ad] = aabb(p); return Math.abs(p.x - x) < (aw + w) / 2 - 0.2 && Math.abs(p.z - z) < (ad + d) / 2 - 0.2; };
const stats = {}; let rooms = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const tiny = Math.min(w, d) === 1 || w * d <= 4;
  const res = H.checkRoom(tag, B, r, L, { focal: L.purposeFail || (k === 'dun-sewer' && Math.min(w, d) === 1) ? null : FOCAL[k], lights: true, fire: FIRE, windows: false });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], light: 0, fails: 0, things: new Map() };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); st.light += L.placements.filter(p => fireType(p.id, FIRE)).length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  ok(r.family === FAMILY(k), `${tag} family ${r.family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  ok(!mine.some(e => e.kind === 'window' && e.owner.room === r.id), `${tag} a window on a dungeon wall`);
  for (const e of mine.filter(e => e.kind === 'door' && e.owner.room === r.id)) ok(/^(door-reinforced|crypt-gate-iron|door-cell-bars)$/.test(e.doorType), `${tag} door type ${e.doorType}`);
  const fl = standing(L), doors = mine.filter(e => e.kind === 'door');
  // corridors
  if (k === 'dun-chasm' && arr === 'alone') ok(doors.length === 2 && doors.filter(e => e.flag === 'way-on').length === 1, `${tag} a lone chasm crossing should have a door each side: ${doors.length}`);
  if (/corridor|sewer/.test(k) && arr === 'alone' && w !== d) { const end = w > d ? ['W', 'E'] : ['N', 'S'];
    ok(doors.length === 2 && doors.every(e => end.includes(e.owner.side)) && doors.filter(e => e.flag === 'way-on').length === 1, `${tag} a lone passage should have a door in each end wall: ${doors.map(e => e.owner.side + (e.flag ? ':' + e.flag : '')).join(', ')}`); }
  if (/corridor|sewer/.test(k)) ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} no clear through-line`);
  if (k === 'dun-corridor' && Math.min(w, d) === 1) ok(fl.filter(p => !/collapse|rubble|stone-blocks/.test(p.id)).length === 0, `${tag} something stands in a corridor one cell wide: ${fl.map(p => p.id)}`);
  if (k === 'dun-trap-corridor' && !L.purposeFail) { const traps = L.placements.filter(p => p.rule === 'trap'); ok(traps.length >= 2, `${tag} only ${traps.length} traps`);
    for (const p of traps) ok(/trap|hazard/.test((S.lib.objects[p.id].aff || []).join(' ')), `${tag} ${p.id} lacks the trap / hazard affordance`); }
  // strips: wall to wall, in one row, nothing else standing on them
  for (const [strip, allowed] of [[/^chasm-strip/, /^(bridge-stone-natural|plank-bridge|stepping-pillars)$/], [/^sewer-channel-strip/, /^(sewer-|flotsam-crate)/]]) {
    const ss = L.placements.filter(p => strip.test(p.id)); if (!ss.length) continue;
    const horiz = Math.abs(Math.sin(ss[0].rot)) < 0.5, span = ss.reduce((a, p) => a + p.dims[0], 0), len = horiz ? r.w * CELL - 1 : r.d * CELL - 1;
    ok(Math.abs(span - len) < 0.3, `${tag} the strip row is ${span.toFixed(1)} ft in a ${len}-ft room`);
    ok(new Set(ss.map(p => (horiz ? p.z : p.x).toFixed(1))).size === 1, `${tag} the strip tiles are not in one row`);
    for (const p of fl) for (const s of ss) { const [sw, sd] = aabb(s); if (inRect(p, s.x, s.z, sw, sd - 1.2)) ok(allowed.test(p.id), `${tag} ${p.id} (${p.rule}) stands in the ${s.id}`); }
  }
  if (k === 'dun-chasm' && !L.purposeFail) { ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} the walk does not cross the chasm`); if (arr === 'alone' && Math.min(w, d) >= 4) ok(L.placements.some(p => p.rule === 'key-bridge'), `${tag} no bridge`); }
  if (k === 'dun-cell-block' && !L.purposeFail && w * d >= 40 && Math.min(w, d) >= 4) ok(L.placements.filter(p => p.id === 'cell-bars').length >= 2, `${tag} a ${w * d}-cell block with under 2 cells`);
  if (k === 'dun-guard-room') ok(L.placements.filter(p => p.id === 'cot').length <= 3, `${tag} more than 3 cots (a barracks)`);
  if (k === 'dun-flooded') ok(S.T[k].floors.length === 1 && S.T[k].floors[0] === 'floor-water-flooded', 'the flooded chamber\'s only floor is water');
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
  void tiny;
}
console.log(`rooms: ${rooms} dungeon rooms solved (14 types x 6 sizes x 3 arrangements x 8 seeds)`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(18)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)}), ${(st.light / st.n).toFixed(1)} lights; per room: ${top}`);
  ok(st.fails <= st.n * 0.2, `${k}: purpose fails in ${st.fails} of ${st.n} rooms`); }

// ---- a junction and a dead end: the corridor adapts to its doors
{ let j = 0, de = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const rs = [mk('c', 'dun-corridor', 10, 10, 8, 2, seed, 1), mk('n', 'dun-guard-room', 12, 6, 4, 4, seed + 1, 2), mk('s', 'dun-shrine', 13, 12, 3, 3, seed + 2, 3)], B = H.build(rs), L = B.solve('c');
    ok(!L.purposeFail, `junction seed ${seed}: ${L.purposeFail}`);
    const ds = B.E.openings.get('c').filter(o => o.kind === 'door'); if (ds.length >= 3) { j++; ok(L.paths.filter(p => p.ok).length >= 2, `junction seed ${seed}: the side door is not joined to the through-line`); }
    const one = mk('r', 'dun-corridor', 10, 10, 6, 2, seed * 13, 1), E = S.w.computeEdges([one], { engine: 'v2' }), ops = E.openings.get('r').filter(o => !(o.kind === 'door' && o.flag === 'way-on'));
    if (ops.filter(o => o.kind === 'door').length === 1) { const L1 = S.s2.solveRoom2({ lib: S.lib, type: S.T['dun-corridor'], room: one, openings: ops, opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => 'dun-corridor' }); if (L1.placements.some(p => p.rule === 'key-collapse')) de++; }
  }
  ok(j >= 3, `only ${j} of 10 packed corridors had a side door (a junction)`); ok(de >= 6, `only ${de} of 10 one-door corridors end in a rock fall`);
  console.log(`corridor: ${j} junctions of 10 (side door joined to the line), ${de} of 10 one-door corridors end in a rock fall`);
}

// ---- the leg of an L-shaped room: dressed, lit, no key piece
{ let n = 0, props = 0;
  for (const k of KEYS) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 4; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => /^(chasm-strip|sewer-channel|cell-bars|door-|wall-|nest-monster|chair-interrogation|dun-treasure-hoard|shrine-wayside|collapse-rubble|trap-)/.test(p.id)), `${tag} a key piece in the annex: ${L.placements.map(p => p.id)}`);
    ok(L.placements.some(p => fireType(p.id, FIRE)), `${tag} annex unlit`);
  }
  console.log(`annex: ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
}

// ---- the wall family
ok(S.w.WALL_FAMILIES.includes('cut-rock') && S.w.FAMILY_FALLBACK['cut-rock'] === 'dressed-stone' && S.w.meshFamily('cut-rock') === 'dressed-stone', 'cut-rock is registered and borrows dressed stone');
for (const piece of ['wall-straight', 'wall-doorway']) ok(S.lib.objects[piece]?.skus.some(s => s.family === 'cut-rock' && s.bounds), `the library has a cut-rock ${piece}`);
ok(!S.lib.objects['wall-window-small'].skus.some(s => s.family === 'cut-rock'), 'there is no cut-rock window piece');
for (const id of ['pressure-plate', 'trap-spikes', 'trap-blade', 'trap-dart-wall', 'pit-open']) if (S.lib.objects[id]) ok(/trap|hazard/.test(S.lib.objects[id].aff.join(' ')), `${id} carries trap / hazard`);

// ---- a whole dungeon, side by side: every room reachable
{ let outside = 0, n = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const rs = [mk('c', 'dun-corridor', 10, 14, 14, 2, seed, 1), mk('g', 'dun-guard-room', 10, 10, 4, 4, seed + 1, 2), mk('b', 'dun-cell-block', 14, 8, 6, 6, seed + 2, 3), mk('i', 'dun-interrogation', 20, 10, 4, 4, seed + 3, 4),
      mk('v', 'dun-vault', 10, 16, 4, 4, seed + 4, 5), mk('p', 'dun-puzzle-hall', 14, 16, 5, 5, seed + 5, 6), mk('s', 'dun-shrine', 19, 16, 3, 3, seed + 6, 7), mk('d', 'dun-den', 22, 16, 5, 5, seed + 7, 8),
      mk('t', 'dun-trap-corridor', 24, 14, 6, 2, seed + 8, 9), mk('x', 'dun-chasm', 24, 8, 4, 6, seed + 9, 10)];
    const B = H.build(rs); n++;
    const ds = [...B.E.edges.values()].filter(e => e.kind === 'door'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of ds) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = ds.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(seen.size === rs.length, `a packed dungeon (seed ${seed}): ${rs.length - seen.size} rooms cannot be reached`);
    outside += ds.filter(e => e.sides.length === 1).length;
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail || /too short/.test(L.purposeFail), `packed dungeon seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a whole dungeon (10 rooms side by side, ${n} seeds): every room reachable; ${(outside / n).toFixed(1)} outside doors`);
}
H.report('dungeon');
