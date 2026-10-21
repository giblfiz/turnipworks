// Mine (2026-10-11): thirteen room types; mine-timbered / cut-rock walls and no windows underground, a yard and a
// fieldstone smelter house on the surface.
//   node test/min.test.mjs [tuner dir] [--print]
//   rooms     every room type x 6 sizes x 8 seeds x 3 arrangements (alone; off a tunnel; packed between others): the
//             shared checks (ccm_lib.mjs: no purpose fail, nothing outside or overlapping, focal piece present, paths
//             clear, key feature in view, nothing hung on a door, deterministic) + lit, no windows underground
//   tunnels   a lone tunnel is entered at an end and has a way on; one cell wide it still solves and nothing stands in
//             it; the cart road is one row, wall to wall, and only carts and timber sets stand on it
//   graph     roles (passage / hub / terminal / uses / outdoor), a depth hint for every room; a whole mine side by side:
//             every room reachable
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
const S = await loadTree('min'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const KEYS = S.w.MIN_ROOMS, UNDER = new Set(S.w.MIN_UNDER);
ok(KEYS.length === 13, 'thirteen mine rooms');
for (const k of KEYS) { ok(!!S.T[k], `room type ${k} is in rooms.json`); ok(['surface', 'shaft', 'mid', 'deep', 'any'].includes(S.w.MIN_DEPTH[k]), `${k} has a depth hint`); }
const ROLE = { 'min-tunnel': 'passage', 'min-junction': 'hub', 'min-shaft-head': 'hub', 'min-sorting': 'uses', 'min-pithead': 'outdoor' };
for (const k of KEYS) ok(S.w.roleOf(k) === (ROLE[k] || 'terminal'), `${k} role ${S.w.roleOf(k)}`);
const FOCAL = { 'min-tunnel': null, 'min-junction': null, 'min-face': /^(ore-vein|collapse-rubble|rubble-pile|rural-tailings-pile|ore-pile|mil-catapult-stones|stone-blocks-stack)$/, 'min-collapsed': /^(collapse-rubble|rubble-pile|rural-tailings-pile|stone-blocks-stack)$/,
  'min-flooded': /^(rural-water-pump-mine|collapse-rubble|rubble-pile|rural-tailings-pile|stone-blocks-stack|post-timber|pillar-waterline)$/, 'min-shaft-head': /^(mine-shaft-collar|pit-open|well|floor-trapdoor|oubliette-hatch)$/, 'min-sorting': /^(sorting-table|table-|ore-pile|rural-tailings-pile|mil-catapult-stones)/,
  'min-tool-store': /^(mine-tool-rack|garden-tools-leaning|rural-pit-props-stack|shelving-freestanding|crate)$/, 'min-mess': /^table-/, 'min-powder-store': /^(powder-keg-stack|barrel|crate)$/, 'min-seam': /^(crystal-|ore-vein|geode-cluster)/, 'min-pithead': /^(mine-headframe|well-house|well)$/, 'min-smelter': /^(smelter|hearth-|bread-oven)/ };
const FIRE = [[/crystal-|geode-cluster|ore-vein/, 'glow'], [/smelter|cauldron-crane|firepit|hearth-/, 'hearth'], [/mine-lamp-rack|watch-lantern-bell/, 'lantern']];
const FAMILY = (k) => /pithead|smelter/.test(k) ? 'fieldstone' : /face|sorting|mess|seam/.test(k) ? 'cut-rock' : 'mine-timbered';
const HAS = (id) => !!S.lib.objects[id]?.skus.length, SEAM_OK = HAS('crystal-formation') || HAS('crystal-glowing') || HAS('ore-vein') || HAS('geode-cluster');
if (!SEAM_OK) console.log('NOTE: no crystal or vein mesh in this library: the crystal seam cannot solve and is skipped');
const SIZES = { 'min-tunnel': [[8, 2], [6, 1], [1, 7], [10, 3], [3, 2], [2, 12]], 'min-junction': [[4, 4], [3, 3], [2, 2], [5, 4], [5, 5], [6, 6]], 'min-face': [[4, 3], [3, 2], [2, 2], [2, 5], [5, 3], [3, 3]],
  'min-collapsed': [[6, 2], [4, 2], [2, 5], [3, 3], [8, 3], [5, 4]], 'min-flooded': [[6, 3], [4, 2], [3, 3], [2, 6], [8, 4], [5, 5]], 'min-shaft-head': [[5, 5], [3, 3], [4, 3], [4, 4], [6, 5], [7, 7]],
  'min-sorting': [[6, 5], [4, 3], [3, 3], [5, 7], [8, 6], [10, 7]], 'min-tool-store': [[4, 3], [3, 2], [2, 2], [3, 5], [5, 4], [6, 5]], 'min-mess': [[6, 4], [4, 3], [3, 3], [4, 6], [7, 5], [8, 6]],
  'min-powder-store': [[3, 3], [2, 2], [3, 2], [4, 3], [3, 5], [5, 4]], 'min-seam': [[5, 5], [3, 3], [4, 3], [6, 5], [4, 7], [8, 6]], 'min-pithead': [[8, 7], [6, 5], [5, 5], [10, 8], [7, 9], [12, 10]],
  'min-smelter': [[5, 4], [3, 3], [4, 3], [6, 5], [4, 6], [7, 5]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offHall: (k, w, d, s) => [mk('h', k === 'min-tunnel' ? 'min-shaft-head' : 'min-tunnel', 10, 7, Math.max(w, 4), 3, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => [mk('a', 'min-tool-store', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', 'min-tunnel', 10, 10 + d, w, 2, s + 2, 3), mk('v', k === 'min-mess' ? 'min-powder-store' : 'min-mess', 10 + w, 10, 4, d, s + 3, 4)],
};
const TALL = /^(ladder-wood|post-timber|mine-headframe|well-house)$/;
const inRect = (p, x, z, w, d) => { const [aw, ad] = aabb(p); return Math.abs(p.x - x) < (aw + w) / 2 - 0.2 && Math.abs(p.z - z) < (ad + d) / 2 - 0.2; };
const stats = {}; let rooms = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  if (k === 'min-seam' && !SEAM_OK) continue;
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  // (a ladder is the climb to the next storey, a pit prop touches the roof, the headframe stands in the open: taller than a 9-ft wall on purpose)
  const Lc = { ...L, placements: L.placements.map(p => TALL.test(p.id) ? { ...p, dims: [p.dims[0], Math.min(p.dims[1], 9), p.dims[2]] } : p) };
  const res = H.checkRoom(tag, B, r, Lc, { focal: L.purposeFail ? null : FOCAL[k], lights: k !== 'min-pithead', fire: FIRE, windows: UNDER.has(k) ? false : undefined });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], light: 0, fails: 0, things: new Map() };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); st.light += L.placements.filter(p => fireType(p.id, FIRE)).length; if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  if (k !== 'min-pithead') ok(r.family === FAMILY(k) || k === 'min-smelter', `${tag} family ${r.family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  if (UNDER.has(k)) { ok(!mine.some(e => e.kind === 'window' && e.owner.room === r.id), `${tag} a window on a mine wall`);
    for (const e of mine.filter(e => e.kind === 'door' && e.owner.room === r.id)) ok(/^(door-plank|door-reinforced)$/.test(e.doorType), `${tag} door type ${e.doorType}`); }
  const fl = standing(L), doors = mine.filter(e => e.kind === 'door');
  if (k === 'min-tunnel' && arr === 'alone' && w !== d) { const end = w > d ? ['W', 'E'] : ['N', 'S'];
    ok(doors.length === 2 && doors.every(e => end.includes(e.owner.side)) && doors.filter(e => e.flag === 'way-on').length === 1, `${tag} a lone tunnel should have a door in each end wall: ${doors.map(e => e.owner.side + (e.flag ? ':' + e.flag : '')).join(', ')}`); }
  if (k === 'min-tunnel') ok(L.paths.some(p => p.kind === 'through' && p.ok), `${tag} no clear through-line`);
  if (k === 'min-tunnel' && Math.min(w, d) === 1) ok(fl.filter(p => !/collapse|rubble|stone-blocks|tailings|ore-pile|catapult/.test(p.id)).length === 0, `${tag} something stands in a tunnel one cell wide: ${fl.map(p => p.id)}`);
  // the cart road: one row, wall to wall; only carts and timber sets on it
  { const ss = k === 'min-junction' ? [] : L.placements.filter(p => p.id === 'mine-rail-strip'); if (ss.length) { /* (the junction's roads cross: two rows) */
    const horiz = Math.abs(Math.sin(ss[0].rot)) < 0.5, span = ss.reduce((a, p) => a + p.dims[0], 0), len = horiz ? r.w * CELL - 1 : r.d * CELL - 1;
    ok(Math.abs(span - len) < 0.3, `${tag} the cart road is ${span.toFixed(1)} ft in a ${len}-ft room`);
    ok(new Set(ss.map(p => (horiz ? p.z : p.x).toFixed(1))).size === 1, `${tag} the rail tiles are not in one row`);
    if (k !== 'min-collapsed') for (const p of fl) for (const s of ss) { const [sw, sd] = aabb(s); if (inRect(p, s.x, s.z, sw, sd - 1.6)) ok(/^(mine-cart|wheelbarrow|cart-hand|shoring-timber|rural-ore-cart-tipped)$/.test(p.id) || p.rule === 'key-end', `${tag} ${p.id} (${p.rule}) stands on the cart road`); } } }
  if (k === 'min-mess') ok(L.placements.filter(p => /^(cot|bunk-bed)$/.test(p.id)).length <= 2, `${tag} more than 2 bunks (a barracks)`);
  if (k === 'min-flooded') ok(S.T[k].floors.length === 1 && S.T[k].floors[0] === 'floor-water-flooded', 'the flooded gallery\'s only floor is water');
  ok(!L.placements.some(p => p.id === 'ladder-wood'), `${tag} rolls a ladder (a ladder is a stair: it would open the floor above; the building generator plans the ladder way)`);
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} mine rooms solved (13 types x 6 sizes x 3 arrangements x 8 seeds)`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(18)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)}), ${(st.light / st.n).toFixed(1)} lights; per room: ${top}`);
  ok(st.fails <= st.n * 0.2, `${k}: purpose fails in ${st.fails} of ${st.n} rooms`); }

// ---- the leg of an L-shaped room: dressed, lit, no key piece
{ let n = 0, props = 0;
  for (const k of KEYS.filter(k => k !== 'min-pithead')) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 4; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => /^(mine-rail|mine-shaft-collar|pit-open|windlass|smelter|mine-headframe|ore-vein|collapse-rubble|sorting-table|powder-keg-stack|mine-tool-rack)/.test(p.id)), `${tag} a key piece in the annex: ${L.placements.map(p => p.id)}`);
  }
  console.log(`annex: ${n} legs, ${(props / n).toFixed(1)} things each, no key piece repeated`);
}

// ---- the wall family
ok(S.w.WALL_FAMILIES.includes('mine-timbered') && S.w.FAMILY_FALLBACK['mine-timbered'] === 'cut-rock', 'mine-timbered is registered and borrows cut-rock');
ok(!S.lib.objects['wall-window-small'].skus.some(s => s.family === 'mine-timbered'), 'there is no mine-timbered window piece');

// ---- a whole mine, side by side: every room reachable from the yard
{ let n = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const rs = [mk('y', 'min-pithead', 10, 2, 8, 6, seed, 1), mk('h', 'min-shaft-head', 10, 8, 5, 5, seed + 1, 2), mk('t', 'min-tunnel', 15, 9, 10, 2, seed + 2, 3), mk('o', 'min-sorting', 4, 8, 6, 5, seed + 3, 4),
      mk('m', 'min-mess', 15, 5, 6, 4, seed + 4, 5), mk('p', 'min-powder-store', 21, 6, 3, 3, seed + 5, 6), mk('j', 'min-junction', 25, 8, 4, 4, seed + 6, 7), mk('f', 'min-face', 29, 9, 4, 3, seed + 7, 8),
      mk('c', 'min-collapsed', 25, 12, 2, 6, seed + 8, 9), mk('w', 'min-flooded', 19, 11, 6, 3, seed + 9, 10), mk('k', 'min-tool-store', 10, 13, 4, 3, seed + 10, 11), ...(SEAM_OK ? [mk('s', 'min-seam', 25, 3, 5, 5, seed + 11, 12)] : []),
      mk('e', 'min-smelter', 18, 0, 5, 4, seed + 12, 13)];
    const B = H.build(rs); n++;
    const ds = [...B.E.edges.values()].filter(e => e.kind === 'door' || e.kind === 'gate'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of ds) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = ds.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src]; // (the yard has no walls: a door onto it is an outside door)
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(rs.filter(r => r.id !== 'y').every(r => seen.has(r.id)), `a packed mine (seed ${seed}): ${rs.filter(r => r.id !== 'y' && !seen.has(r.id)).map(r => r.type)} cannot be reached`);
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `packed mine seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a whole mine (13 rooms side by side, ${n} seeds): every room reachable from the pithead yard`);
}
H.report('mine');
