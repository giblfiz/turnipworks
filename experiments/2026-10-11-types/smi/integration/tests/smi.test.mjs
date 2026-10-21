// Smithy & workshop (2026-10-11): nine room types; ONE workshop program whose craft is a line of data.
//   node smi.test.mjs [tuner dir] [--print]      (copied to tools/spawn-tuner/test/ at integration)
//   rooms     every indoor type x 6 sizes x 8 seeds x 3 arrangements (alone; off the forge; in a packed smithy): the
//             shared checks (ccm_lib.mjs) + the skeleton: heat source on a wall, the workstation within reach of it,
//             a bench, tools, finished goods and raw stock; each craft holds only its own signature pieces
//   crafts    two crafts never share a signature piece (what tells them apart from the table camera)
//   yard      the outdoor program: the shoeing stocks or the rail in the open, the trough and the rail, ways clear
//   a smithy  nine rooms side by side: every room reachable, no purpose fail
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
const S = await loadTree('real'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const WORK = ['smi-forge', 'smi-armoury', 'smi-carpenter', 'smi-potter'], KEYS = [...WORK, 'smi-shopfront', 'smi-stock', 'smi-quarters', 'smi-passage'];
for (const k of [...KEYS, 'smi-yard']) ok(!!S.T[k], `room type ${k} is in rooms.json`);
const FIRE = [[/^forge$/, 'brazier'], [/^kiln-/, 'oven'], [/^smelter/, 'oven']];
const FOCAL = { 'smi-forge': /^forge$/, 'smi-armoury': /^(smith-breastplate-on-form|armor-stand)$/, 'smi-carpenter': /^carpenter-bench$/, 'smi-potter': /^kiln-pottery$/, 'smi-shopfront': /^counter-shop$/, 'smi-stock': /^(metal-stock|shelving-freestanding|coal-bin|crate)$/, 'smi-quarters': /^bed-/, 'smi-passage': null };
// what belongs to ONE craft: another workshop holding it would read as that craft
const SIGN = { 'smi-forge': /^(forge|bellows-great|coal-bin|quench-trough)$/, 'smi-armoury': /^(smith-breastplate-on-form|armor-stand|mil-armor-repair-bench|shop-floor-stock|mil-shield-stack)$/, 'smi-carpenter': /^(carpenter-bench|craft-tool-wall-pegboard|craft-boards-planed-stack|craft-shavings-pile|craft-chair-half-built|craft-wood-offcut-bin|sawhorse)$/, 'smi-potter': /^(kiln-pottery|potters-wheel|pots-drying-shelf|clay-bin|pottery-for-sale)$/ };
const SIZES = { 'smi-forge': [[5, 4], [4, 4], [4, 3], [6, 5], [4, 6], [8, 6]], 'smi-armoury': [[5, 4], [4, 4], [4, 3], [6, 5], [4, 6], [8, 6]], 'smi-carpenter': [[5, 4], [4, 4], [4, 3], [6, 5], [4, 6], [8, 6]], 'smi-potter': [[5, 4], [4, 4], [4, 3], [6, 5], [4, 6], [8, 6]],
  'smi-shopfront': [[4, 4], [3, 3], [4, 3], [5, 4], [3, 5], [6, 5]], 'smi-stock': [[4, 3], [3, 3], [3, 2], [5, 4], [3, 5], [6, 5]], 'smi-quarters': [[4, 3], [3, 3], [4, 4]], 'smi-passage': [[2, 6], [6, 2], [3, 5]] };
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  offForge: (k, w, d, s) => [mk('h', k === 'smi-forge' ? 'smi-shopfront' : 'smi-forge', 10, 6, Math.max(w, 5), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  packed: (k, w, d, s) => k === 'smi-shopfront' ? [mk('f', 'smi-forge', 10, 10 - 4, Math.max(w, 5), 4, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('p', 'smi-passage', 10 + w, 10, 2, d, s + 2, 3)] /* a shop front has the street before it: the forge behind, the passage beside */ : [mk('a', 'smi-shopfront', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('c', k === 'smi-stock' ? 'smi-carpenter' : 'smi-stock', 10, 10 + d, Math.max(w, 3), 3, s + 2, 3), mk('y', 'smi-yard', 10 + w, 10, 5, Math.max(d, 4), s + 3, 4)],
};
const stats = {}; let rooms = 0, noCounter = 0;
for (const k of KEYS) for (const [w, d] of SIZES[k]) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  if (k === 'smi-shopfront' && arr !== 'alone' && w * d < 16) continue; // (a shop under 20 x 20 ft with a second door has no wall left for its counter: the market's skeleton says so too)
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  if (k === 'smi-shopfront' && arr !== 'alone' && /no counter/.test(L.purposeFail || '')) { noCounter++; continue; } // (mktShop's own limit: a door in the wall behind the counter of a small shop; counted below)
  const inn = k === 'smi-quarters' || k === 'smi-passage';
  const res = H.checkRoom(tag, B, r, L, { focal: FOCAL[k], lights: !inn, fire: FIRE });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], fails: 0, things: new Map(), full: 0 };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target); if (L.purposeFail) st.fails++;
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  ok(r.family === S.T[k].family || (S.T[k].family === 'rough-timber' && r.family === 'log-cabin'), `${tag} family ${r.family}`); // (rough timber rolls the log cabin now and then, as the inn does)
  const has = (re) => L.placements.some(p => re.test(p.id)), rule = (x) => L.placements.filter(p => p.rule === x), TOOLS = /^(tool-rack-smith|smith-horseshoe-rack|smith-helm-row-shelf|shield-display|craft-tool-wall-pegboard|pots-drying-shelf)$/;
  if (WORK.includes(k)) {
    const W = L.work || L.info?.work || null, cells = w * d;
    // the skeleton: the station stands; from 16 cells every role of the skeleton is filled
    ok(rule('key-station').length === 1 || (k !== 'smi-carpenter' && k !== 'smi-armoury' && rule('key-heat').length === 1), `${tag} no workstation`);
    if (k === 'smi-forge' || k === 'smi-potter') { const heat = rule('key-heat')[0], stn = rule('key-station')[0];
      ok(!!heat, `${tag} no heat source`);
      if (heat && stn) ok(Math.hypot(heat.x - stn.x, heat.z - stn.z) <= Math.max(heat.dims[0], heat.dims[2]) / 2 + Math.max(stn.dims[0], stn.dims[2]) / 2 + 6.5, `${tag} the workstation is ${Math.hypot(heat.x - stn.x, heat.z - stn.z).toFixed(1)} ft from the heat source`);
      if (cells >= 20 && arr === 'alone') ok(rule('by-heat').length >= 1, `${tag} nothing beside the heat source`); }
    if (cells >= 16) { const full = rule('bench').length >= 1 && has(TOOLS) && rule('finished').length >= 1 && rule('raw-stock').length >= 1; if (full) st.full++;
      if (cells >= 20 && arr === 'alone') ok(rule('finished').length >= 1, `${tag} no finished goods`); ok(rule('raw-stock').length >= 1, `${tag} no raw stock`); ok(has(TOOLS) || rule('bench').length >= 1, `${tag} neither a bench nor a tool wall`); }
    if (k === 'smi-forge' && cells >= 16 && arr === 'alone') ok(has(/^(quench-trough|horse-trough-stone)$/), `${tag} no quench trough by the anvil`);
    // no other craft's signature piece in this workshop
    for (const o of WORK) if (o !== k) { const bad = L.placements.filter(p => SIGN[o].test(p.id) && !SIGN[k].test(p.id) && !(o === 'smi-armoury' && k === 'smi-forge' && false)); ok(!bad.length, `${tag} holds the ${o.slice(4)}'s ${[...new Set(bad.map(p => p.id))].join(', ')}`); }
  }
  if (k === 'smi-shopfront') { ok(L.placements.some(p => p.id === 'counter-shop' && /smith/.test(p.sku)), `${tag} the counter is not the smith's (${L.placements.find(p => p.id === 'counter-shop')?.sku})`); ok(rule('shop-shelf').length >= 1 || arr !== 'alone', `${tag} no rack of finished work`); for (const p of L.placements.filter(p => /^(counter-shop|shop-shelf-stocked|shop-floor-stock|craft-display-table-goods|shop-sign)$/.test(p.id))) ok(/smith/.test(p.sku), `${tag} ${p.sku} is another trade's stock`); }
  if (k === 'smi-stock') ok(!B.E.openings.get(r.id).some(o => o.kind === 'window'), `${tag} a window in the stock store`);
  if (PRINT && seed === 1 && arr === 'alone') console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L));
}
console.log(`rooms: ${rooms} smithy rooms solved`);
ok(noCounter <= 5, `${noCounter} shop fronts with neighbours have no counter (5 allowed of 96)`); console.log(`  shop fronts with a neighbour and no wall for the counter: ${noCounter}`);
for (const [k, st] of Object.entries(stats)) { const top = [...st.things].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([i, n]) => `${i} ${(n / st.n).toFixed(1)}`).join(', ');
  console.log(`  ${k.padEnd(14)} ${String(st.n).padStart(3)} rooms, purpose fails ${st.fails}, ${(st.props / st.n).toFixed(1)} props, density ${(st.dens.reduce((a, b) => a + b, 0) / st.n).toFixed(2)}x target (min ${Math.min(...st.dens).toFixed(2)})${WORK.includes(k) ? `, whole skeleton in ${st.full}` : ''}; per room: ${top}`); }
// ---- the inn does not roll the smith's counter (exclusive tier), the smithy does not roll the inn's
{ const B = H.build([mk('d', 'desk', 10, 10, 3, 3, 5, 1)]), L = B.solve('d'); ok(!L.placements.some(p => /smith/.test(p.sku || '')), "the inn's front desk rolled the smith's counter"); }
ok(S.lib.objects['counter-shop'].skus.some(s => s.tier === 'smi'), "the smith's counter carries the exclusive tier smi");
// ---- the yard
{ ok(S.w.isOutdoor('smi-yard'), 'the yard is an outdoor room');
  const CARR = {
    alone: (w, d, s) => [mk('y', 'smi-yard', 10, 10, w, d, s, 1)],
    forge: (w, d, s) => [mk('h', 'smi-forge', 10, 6, 5, 4, s + 1, 1), mk('y', 'smi-yard', 10, 10, w, d, s, 2)],
    smithy: (w, d, s) => [mk('h', 'smi-forge', 10, 6, 5, 4, s + 1, 1), mk('k', 'smi-carpenter', 10 - 5, 10, 5, 4, s + 2, 2), mk('y', 'smi-yard', 10, 10, w, d, s, 3), mk('g', 'smi-stock', 10 + w, 10, 4, 3, s + 3, 4)],
  }, st = { n: 0, props: 0, stocks: 0, rail: 0, trough: 0, signs: 0 };
  for (const [w, d] of [[6, 5], [4, 4], [5, 3], [8, 6], [4, 7], [10, 8]]) for (const arr of Object.keys(CARR)) for (let seed = 1; seed <= 8; seed++) {
    const B = H.build(CARR[arr](w, d, seed * 71 + w)), y = B.rooms.find(r => r.id === 'y'), L = B.solve('y'), tag = `smi-yard ${w}x${d} ${arr} seed ${y.seed}`; st.n++;
    const X0 = y.x * CELL + 0.5, Z0 = y.z * CELL + 0.5, X1 = (y.x + y.w) * CELL - 0.5, Z1 = (y.z + y.d) * CELL - 0.5;
    ok(L.role === 'outdoor' && !L.purposeFail && L.yard?.vibe === "smith's yard", `${tag} role / purpose / program: ${L.role} ${L.purposeFail} ${L.yard?.vibe}`);
    for (const p of L.placements) { const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - 0.17 && p.x + aw / 2 <= X1 + 0.17 && p.z - ad / 2 >= Z0 - 0.17 && p.z + ad / 2 <= Z1 + 0.17, `${tag} ${p.id} (${p.rule}) outside the yard`); }
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id}/${fl[j].id}`); }
    ok(L.paths.every(p => p.ok), `${tag} blocked path: ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
    const n = L.placements.filter(p => p.orient !== 'floor').length; st.props += n;
    ok(n >= 8, `${tag} only ${n} things`);
    ok(L.placements.some(p => /^(hitching-post|smith-shoeing-stocks)$/.test(p.id)), `${tag} neither a hitching rail nor the shoeing stocks`);
    if (Math.min(w, d) >= 4) { if (L.placements.some(p => p.id === 'smith-shoeing-stocks')) st.stocks++; }
    if (L.placements.some(p => p.id === 'hitching-post')) st.rail++; if (L.placements.some(p => /trough/.test(p.id))) st.trough++;
    st.signs += L.placements.filter(p => p.id === 'shop-sign').length;
    ok(!L.placements.some(p => /^(bed-|table-|chair-|wardrobe|fireplace)/.test(p.id)), `${tag} indoor furniture in the yard`);
    const again = B.solve('y'); ok(JSON.stringify(again.placements.map(p => [p.id, p.x, p.z])) === JSON.stringify(L.placements.map(p => [p.id, p.x, p.z])), `${tag} not deterministic`);
  }
  console.log(`yard: ${st.n} solved; ${(st.props / st.n).toFixed(1)} things, shoeing stocks in ${st.stocks}, a rail in ${st.rail}, a trough in ${st.trough}, ${(st.signs / st.n).toFixed(1)} signs`);
}
// ---- a whole smithy, side by side: every room reachable; the forge is the hub
{ let outside = 0, n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const rs = [mk('s', 'smi-shopfront', 10, 10, 4, 4, seed, 1), mk('f', 'smi-forge', 14, 10, 5, 4, seed + 1, 2), mk('a', 'smi-armoury', 19, 10, 5, 4, seed + 2, 3), mk('k', 'smi-stock', 14, 14, 4, 3, seed + 3, 4),
      mk('c', 'smi-carpenter', 18, 14, 5, 4, seed + 4, 5), mk('p', 'smi-potter', 5, 14, 5, 4, seed + 5, 6), mk('g', 'smi-passage', 10, 14, 2, 5, seed + 6, 7), mk('q', 'smi-quarters', 12, 14, 2, 3, seed + 7, 8), mk('y', 'smi-yard', 14, 5, 6, 5, seed + 8, 9)];
    const B = H.build(rs); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), adj = new Map(rs.map(r => [r.id, new Set()]));
    for (const e of doors) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = doors.filter(e => e.sides.length === 1 || e.sides.some(s => s.room === 'y')).flatMap(e => e.sides.map(s => s.room)), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(rs.every(r => seen.has(r.id) || r.id === 'y'), `a packed smithy (seed ${seed}): ${rs.filter(r => !seen.has(r.id) && r.id !== 'y').map(r => r.type)} cannot be reached`); // (the yard is outside: doors onto it are outside doors)
    outside += doors.filter(e => e.sides.length === 1).length;
    for (const r of rs) { const L = B.solve(r.id); ok(!L.purposeFail, `packed smithy seed ${seed}: ${r.type} ${L.purposeFail}`); }
  }
  console.log(`a whole smithy (9 rooms side by side, ${n} seeds): every room reachable; ${(outside / n).toFixed(1)} outside doors per smithy`);
}
H.report('smi');
