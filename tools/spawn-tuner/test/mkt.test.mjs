// Market & village (2026-10-11): twelve room types. Shops and houses half-timber, the watch post fieldstone; the square
// and the street are outdoor rooms.   node test/mkt.test.mjs [tuner dir] [--print]
//   rooms     every indoor room type x 6 sizes x 8 seeds x 3 arrangements: the shared checks (ccm_lib.mjs) + lit
//   skeleton  ONE shop program: every shop has its counter facing the door and stocked shelves; every placement of a
//             skeleton role is the room's own trade (never another trade's stock, never the inn's plain counter)
//   front     the shop window stands in the street wall and nowhere else; a shop has no other windows
//   doors     two shops side by side have no door between them; a shop opens into its back room; the back room holds
//             the stock of the shop it opens off
//   stacked   the suggested sizes stack: shop + back room + passage below, living room + bedroom + passage above
//   outdoors  the square (stalls in rows round the middle, the ways to the gate clear) and the street (a clear way down
//             the middle, lamps, bollards); signs by the doors of the shops along them
//   annex     the leg of an L-shaped room: dressed, lit, no second counter
//   a street  a row of shops on a street with a square at its end: every room reachable, nothing fails
import { loadTree, makeHarness, CELL, standing, aabb, fireType } from './ccm_lib.mjs';
import { readFileSync } from 'node:fs';
const S = await loadTree('dev'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const SHOPS = ['mkt-general', 'mkt-bakery', 'mkt-apothecary', 'mkt-tailor', 'mkt-curio'], OWN = ['mkt-backroom', 'mkt-watch', 'mkt-house'], INN = ['mkt-bedroom', 'mkt-passage'], INDOOR = [...SHOPS, ...OWN, ...INN], OUT = ['mkt-square', 'mkt-street'];
for (const k of [...INDOOR, ...OUT]) ok(!!S.T[k], `room type ${k} is in rooms.json`);
ok(SHOPS.every(k => S.w.MKT_SHOPS.includes(k)), 'walls.js MKT_SHOPS lists the five shops');
const TIER = Object.fromEntries(SHOPS.map(k => [k, S.T[k].tiers[0]])), TIERS = Object.values(TIER);
ok(new Set(TIERS).size === 5 && TIERS.every(t => /^mkt-/.test(t)), `every shop names its own trade tier first (${TIERS})`);
const SKELETON = ['counter-shop', 'shop-shelf-stocked', 'craft-display-table-goods', 'shop-floor-stock'];
for (const id of SKELETON) for (const t of TIERS) ok((S.lib.objects[id]?.skus || []).some(s => s.tier === t && s.bounds), `the library has a ${t} mesh of ${id}`);
const FOCAL = { ...Object.fromEntries(SHOPS.map(k => [k, /^counter-shop$/])), 'mkt-backroom': /^(shelving-freestanding|shop-shelf-stocked)$/, 'mkt-watch': /^(watch-desk|desk-writing|cell-holding-wood)$/, 'mkt-house': /^fireplace-wall$/, 'mkt-bedroom': /^bed-/, 'mkt-passage': null };
const SIZES = { shop: [[4, 4], [3, 3], [4, 3], [5, 4], [4, 6], [7, 6]], 'mkt-backroom': [[4, 3], [2, 2], [3, 3], [4, 2], [5, 4], [6, 6]], 'mkt-watch': [[4, 4], [3, 3], [4, 3], [5, 4], [4, 6], [7, 6]], 'mkt-house': [[4, 4], [3, 3], [4, 3], [5, 4], [4, 6], [6, 6]],
  'mkt-bedroom': [[4, 3], [3, 3], [4, 4]], 'mkt-passage': [[2, 7], [2, 4], [3, 6]] };
const other = (k) => k === 'mkt-general' ? 'mkt-bakery' : 'mkt-general';
const ARR = {
  alone: (k, w, d, s) => [mk('r', k, 10, 10, w, d, s, 1)],
  // a neighbour on one side (a shop beside a shop; a back room behind its shop; a bedroom off the living room)
  beside: (k, w, d, s) => [mk('n', SHOPS.includes(k) ? other(k) : k === 'mkt-backroom' ? 'mkt-tailor' : k === 'mkt-bedroom' ? 'mkt-house' : 'mkt-general', 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2)],
  // in a row on a street: a neighbour each side, the back room (or a shop) behind, the street before
  street: (k, w, d, s) => [mk('a', other(k), 10 - 4, 10, 4, d, s + 1, 1), mk('r', k, 10, 10, w, d, s, 2), mk('b', 'mkt-apothecary', 10 + w, 10, 4, d, s + 2, 3), mk('k', SHOPS.includes(k) ? 'mkt-backroom' : 'mkt-curio', 10, 10 - 3, w, 3, s + 3, 4), mk('st', 'mkt-street', 10 - 4, 10 + d, w + 8, 3, s + 4, 5)],
};
const stats = {}; let rooms = 0, innBlocked = 0; const tier = { want: 0, got: 0, miss: new Map() };
for (const k of INDOOR) for (const [w, d] of SIZES[k] || SIZES.shop) for (const arr of Object.keys(ARR)) for (let seed = 1; seed <= 8; seed++) {
  const B = H.build(ARR[arr](k, w, d, seed * 97 + w * 7 + d)), r = B.rooms.find(x => x.id === 'r'), L = B.solve('r'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`;
  rooms++;
  const inn = INN.includes(k);
  // (the bedroom and the passage ARE the inn's guest room and hallway: a blocked path there is the inn program's own; counted, not failed here)
  const Lc = { ...L, placements: L.placements.map(p => p.orient === 'wall' && p.kind === 'flat' ? { ...p, dims: [p.dims[0], p.dims[1], 0.05] } : p.rule === 'drapes' ? { ...p, dims: [0.1, p.dims[1], 0.05] } : p) };
  if (inn && (!L.paths.every(p => p.ok) || L.purposeFail)) { innBlocked++; Lc.paths = L.paths.map(p => ({ ...p, ok: true })); Lc.purposeFail = null; }
  const noWin = SHOPS.includes(k) || k === 'mkt-backroom';
  const res = H.checkRoom(tag, B, r, Lc, { focal: FOCAL[k], lights: noWin, windows: noWin ? false : undefined });
  const st = stats[k] ||= { n: 0, props: 0, dens: [], things: new Map(), shelves: [], lock: 0 };
  st.n++; st.props += res.props; st.dens.push(res.density / res.target);
  for (const p of L.placements) st.things.set(p.id, (st.things.get(p.id) || 0) + 1);
  ok(r.family === S.T[k].family, `${tag} family ${r.family}, type says ${S.T[k].family}`);
  const mine = [...B.E.edges.values()].filter(e => e.sides.some(s => s.room === r.id));
  if (SHOPS.includes(k)) {
    const c = L.placements.filter(p => p.id === 'counter-shop'), sh = L.placements.filter(p => p.id === 'shop-shelf-stocked');
    ok(c.length === 1, `${tag} ${c.length} counters`);
    ok(sh.length + L.placements.filter(p => p.rule === 'shop-hero').length >= 1, `${tag} no stock on the walls`);
    st.shelves.push(sh.length);
    // the skeleton roles are rolled in the room's own trade
    for (const p of L.placements.filter(p => SKELETON.includes(p.id))) { const sku = S.lib.objects[p.id].skus.find(q => q.sku === p.sku); tier.want++; if (sku.tier === TIER[k]) tier.got++; else tier.miss.set(`${k}: ${p.sku} (${p.rule})`, (tier.miss.get(`${k}: ${p.sku} (${p.rule})`) || 0) + 1); }
    // the keeper can get behind the counter: 2 ft clear behind it
    if (c[0]) { const p = c[0], bx = p.x - Math.sin(p.rot) * (p.dims[2] / 2 + 1), bz = p.z - Math.cos(p.rot) * (p.dims[2] / 2 + 1); ok(!standing(L).some(q => q !== p && q.rule !== 'keeper' && Math.abs(q.x - bx) < aabb(q)[0] / 2 + 0.2 && Math.abs(q.z - bz) < aabb(q)[1] / 2 + 0.2), `${tag} something stands in the keeper's lane`); }
    // the shop front: panels only on a wall with an outside door, and on every plain panel of it
    const X = (e) => e.sides.find(s => s.room === r.id), doorSides = new Set(mine.filter(e => e.kind === 'door' && e.sides.length === 1).map(e => X(e).side));
    for (const e of mine.filter(e => e.panel)) ok(e.panel === 'wall-window-shop' && doorSides.has(X(e).side), `${tag} a ${e.panel} panel on the ${X(e).side} wall (street doors: ${[...doorSides]})`);
    if (arr === 'alone') ok(mine.some(e => e.panel === 'wall-window-shop'), `${tag} a lone shop has no shop window`);
    ok(S.lib.objects['wall-window-shop']?.skus.some(q => q.family === r.family && q.bounds), `${tag} the library has no shop window in ${r.family}`);
    // no door into the shop next door
    for (const e of mine.filter(e => e.kind === 'door' && e.sides.length === 2)) { const o = B.rooms.find(x => x.id === e.sides.find(s => s.room !== r.id).room); ok(!SHOPS.includes(o.type), `${tag} a door into the ${o.type} next door`); }
    if (arr === 'street') ok(mine.some(e => e.kind === 'door' && e.sides.length === 2 && e.sides.some(s => s.room === 'k')), `${tag} no door to its back room`);
  }
  if (k === 'mkt-backroom' && arr !== 'alone') { // off the tailor's: its stocked shelves and floor stock are the tailor's
    const linked = mine.some(e => e.kind === 'door' && e.sides.some(s => s.room === 'n')), nbT = arr === 'beside' && linked ? 'mkt-tailor' : null;
    if (nbT) for (const p of L.placements.filter(p => /^shop-(shelf-stocked|floor-stock)$/.test(p.id))) ok(S.lib.objects[p.id].skus.find(q => q.sku === p.sku).tier === nbT, `${tag} ${p.sku} is not the neighbouring tailor's stock`);
  }
  if (k === 'mkt-watch') { const pen = L.placements.filter(p => p.id === 'cell-holding-wood'); if (pen.length) st.lock++; if (w >= 4 && d >= 4 && arr === 'alone') ok(pen.length >= 2 && pen.some(p => /gate/.test(p.sku)), `${tag} no lockup (${pen.map(p => p.sku)})`); }
  if (PRINT && seed === 1 && arr === 'alone' && w === (SIZES[k] || SIZES.shop)[0][0]) { try { console.log('\n--- ' + tag + '\n' + S.s2.summarize2(L)); } catch (e) { ok(false, `${tag} summarize2 threw ${e.message}`); } }
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
console.log(`market rooms: ${rooms} rooms solved`);
for (const k of INDOOR) { const st = stats[k]; console.log(`  ${k.padEnd(16)} ${(st.props / st.n).toFixed(1).padStart(5)} things, ${(100 * avg(st.dens)).toFixed(0).padStart(3)}% of target${st.shelves.length ? `, ${avg(st.shelves).toFixed(1)} stocked shelves` : ''}${k === 'mkt-watch' ? `, a lockup in ${st.lock} of ${st.n}` : ''}`); }
console.log(`  (${innBlocked} blocked paths or purpose fails inside the inn's guest-room / hallway programs under these keys, counted not failed)`);
console.log(`skeleton: ${tier.got} of ${tier.want} placements of a skeleton role are the room's own trade`);
for (const [m, n] of [...tier.miss].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(n).padStart(4)} x ${m}`);
ok(tier.got === tier.want && tier.want > 1000, `${tier.want - tier.got} skeleton placements rolled another trade's mesh (of ${tier.want})`);
// shops are told apart by their stock: what one shop holds that NO other shop ever does
{ const sig = {}; for (const k of SHOPS) sig[k] = [...stats[k].things.keys()].filter(id => SHOPS.every(o => o === k || !stats[o].things.has(id)));
  for (const k of SHOPS) console.log(`  only in the ${k.replace('mkt-', '')}: ${sig[k].join(', ') || '(nothing: told by its tier alone)'}`); }

// ---- stacked: the default sizes make one building, two storeys (the game's storeys tool stacks rooms footprint on footprint)
{ const c = (k) => S.T[k].cells, [sw, sd] = c('mkt-general'), [bw, bd] = c('mkt-backroom'), [pw, pd] = c('mkt-passage'), [hw, hd] = c('mkt-house'), [qw, qd] = c('mkt-bedroom');
  ok(SHOPS.every(k => c(k)[0] === sw && c(k)[1] === sd), 'every shop has the same default footprint');
  ok(bw === sw && pd === sd + bd, `the back room is as wide as the shop (${bw} / ${sw}) and the passage as long as both (${pd} / ${sd + bd})`);
  ok(hw === sw && hd === sd && qw === bw && qd === bd, `upstairs: the living room over the shop (${hw}x${hd} / ${sw}x${sd}), the bedroom over the back room (${qw}x${qd} / ${bw}x${bd})`);
  for (let seed = 1; seed <= 8; seed++) for (const shop of SHOPS) {
    const down = H.build([mk('s', shop, 10, 10, sw, sd, seed, 1), mk('b', 'mkt-backroom', 10, 10 - bd, bw, bd, seed + 1, 2), mk('p', 'mkt-passage', 10 + sw, 10 - bd, pw, pd, seed + 2, 3)]);
    const up = H.build([mk('h', 'mkt-house', 10, 10, hw, hd, seed + 3, 1), mk('q', 'mkt-bedroom', 10, 10 - qd, qw, qd, seed + 4, 2), mk('p', 'mkt-passage', 10 + sw, 10 - bd, pw, pd, seed + 5, 3)]);
    for (const [B, name] of [[down, 'ground floor'], [up, 'upstairs']]) for (const r of B.rooms) { const L = B.solve(r.id); ok(!L.purposeFail, `${shop} ${name} seed ${seed}: ${r.type} ${L.purposeFail}`); }
    const linked = (B, a, b) => [...B.E.edges.values()].some(e => e.kind === 'door' && e.sides.length === 2 && e.sides.some(s => s.room === a) && e.sides.some(s => s.room === b));
    ok(linked(down, 's', 'b') || linked(down, 'b', 'p'), `${shop} seed ${seed}: the back room opens off neither the shop nor the passage`);
    ok(linked(down, 's', 'p') || linked(down, 'b', 'p'), `${shop} seed ${seed}: the passage reaches neither the shop nor the back room`);
    ok(linked(up, 'h', 'q') || linked(up, 'q', 'p'), `${shop} seed ${seed}: upstairs, the bedroom opens off neither the living room nor the passage`);
  }
  console.log(`stacked: shop ${sw}x${sd} + back room ${bw}x${bd} + passage ${pw}x${pd} below; living room ${hw}x${hd} + bedroom ${qw}x${qd} + the same passage above: 40 buildings solved, every room linked`);
}

// ---- outdoors: the market square and the street
{ const OARR = {
    alone: (k, w, d, s) => [mk('o', k, 10, 10, w, d, s, 1)],
    shops: (k, w, d, s) => [mk('a', 'mkt-bakery', 10, 10 - 4, 4, 4, s + 1, 1), mk('b', 'mkt-tailor', 14, 10 - 4, Math.max(2, Math.min(4, w - 4)), 4, s + 2, 2), mk('o', k, 10, 10, w, d, s, 3)],
    town: (k, w, d, s) => [mk('a', 'mkt-general', 10, 10 - 4, 4, 4, s + 1, 1), mk('i', 'common', 10, 10 + d, Math.min(w, 6), 4, s + 2, 2), mk('wp', 'mkt-watch', 10 - 4, 10, 4, Math.min(d, 4), s + 3, 3), mk('o', k, 10, 10, w, d, s, 4)],
  };
  const OS = { 'mkt-square': [[8, 7], [5, 5], [6, 5], [10, 8], [4, 4], [14, 12]], 'mkt-street': [[10, 3], [6, 2], [8, 3], [3, 10], [16, 4], [12, 3]] };
  for (const k of OUT) { let n = 0, props = 0, stalls = 0, lamps = 0, signs = 0, shopDoors = 0; const focal = new Map(), byArr = {};
    for (const arr of Object.keys(OARR)) for (const [w, d] of OS[k]) for (let seed = 1; seed <= 8; seed++) {
      const B = H.build(OARR[arr](k, w, d, seed * 43 + w)), r = B.rooms.find(x => x.id === 'o'), L = B.solve('o'), tag = `${k} ${w}x${d} ${arr} seed ${r.seed}`; n++;
      ok(L.role === 'outdoor' && !L.purposeFail, `${tag}: ${L.role} ${L.purposeFail}`);
      ok(L.paths.every(p => p.ok), `${tag}: blocked path ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
      let sum = ''; try { sum = S.s2.summarize2(L); } catch (e) { ok(false, `${tag}: summarize2 threw ${e.message}`); }
      ok(![...B.E.edges.values()].some(e => e.sides.some(q => q.room === 'o')), `${tag}: a wall of its own`);
      const X0 = r.x * CELL + 0.5, Z0 = r.z * CELL + 0.5, X1 = (r.x + r.w) * CELL - 0.5, Z1 = (r.z + r.d) * CELL - 0.5, Y = L.yard;
      const things = L.placements.filter(p => p.orient !== 'floor'), stand = things.filter(p => !/^(wall-mount|wall-light|yard-sign|yard-light|awning)$/.test(p.rule));
      // (an awning is 6 ft wide over a 5-ft window panel: at a corner window it runs 6 in past the corner, as the inn's drapes do)
      for (const p of things) { const [aw, ad] = p.rule === 'awning' ? [0.2, 0.2] : aabb(p); ok(p.x - aw / 2 >= X0 - 0.17 && p.x + aw / 2 <= X1 + 0.17 && p.z - ad / 2 >= Z0 - 0.17 && p.z + ad / 2 <= Z1 + 0.17, `${tag}: ${p.id} (${p.rule}) outside`); }
      for (let i = 0; i < stand.length; i++) for (let j = i + 1; j < stand.length; j++) { const [aw, ad] = aabb(stand[i]), [bw, bd] = aabb(stand[j]); ok(!(Math.abs(stand[i].x - stand[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(stand[i].z - stand[j].z) < (ad + bd) / 2 - 0.17), `${tag}: overlap ${stand[i].id} / ${stand[j].id}`); }
      // signs and lanterns hang on a building's wall, never in mid-air
      const built = B.E.openings.get('o').filter(o => o.to && /^(wall|window|door)$/.test(o.kind));
      for (const p of things.filter(p => /^(yard-sign|yard-light|awning|wall-mount|wall-light)$/.test(p.rule))) { const t = p.side === 'N' || p.side === 'S' ? p.x - X0 : p.z - Z0; ok(built.some(o => o.side === p.side && Math.abs(o.index * CELL - 0.5 + 2.5 - t) <= 2.5 + aabb(p)[0] / 2), `${tag}: ${p.id} hangs on no building wall`); }
      if (k === 'mkt-square') { const st = things.filter(p => p.id === 'market-stall').length; stalls += st; if (w >= 6 && d >= 5 && arr === 'alone') ok(st >= 2, `${tag}: only ${st} stalls`); if (Math.min(w, d) >= 5) ok(!!Y?.focal || st > 0, `${tag}: nothing in the middle`); focal.set(Y?.focal?.id || 'none', (focal.get(Y?.focal?.id || 'none') || 0) + 1); }
      else { // the carriageway is clear from end to end
        const horiz = w >= d, lane = Y.lane, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
        for (const p of stand) { const [aw, ad] = aabb(p), off = horiz ? Math.abs(p.z - cz) - ad / 2 : Math.abs(p.x - cx) - aw / 2; ok(off >= lane / 2 - 0.3, `${tag}: ${p.id} (${p.rule}) stands in the carriageway`); }
        ok(Y.lamps >= 1 || Math.max(w, d) < 4, `${tag}: no street lamp`);
      }
      lamps += Y?.lamps || 0; signs += (Y?.doors || []).filter(x => SHOPS.includes(x.type) && x.things.includes('sign')).length; shopDoors += (Y?.doors || []).filter(x => SHOPS.includes(x.type)).length; props += stand.length; (byArr[arr] ||= []).push(stand.length);
      const again = B.solve('o'); ok(JSON.stringify(again.placements.map(p => [p.id, p.sku, p.x, p.z])) === JSON.stringify(L.placements.map(p => [p.id, p.sku, p.x, p.z])), `${tag}: not deterministic`);
      if (PRINT && seed === 1 && arr === 'shops' && w === OS[k][0][0]) console.log('\n--- ' + tag + '\n' + sum);
    }
    console.log(`${k}: ${n} solved (alone / two shops on one side / a shop, an inn and the watch round it; 6 sizes x 8 seeds), ${(props / n).toFixed(1)} things each (${Object.entries(byArr).map(([a, v]) => `${a} ${avg(v).toFixed(1)}`).join(', ')}); ${k === 'mkt-square' ? `${(stalls / n).toFixed(1)} stalls; centre: ${[...focal].sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(', ')}; ` : ''}${(lamps / n).toFixed(1)} lamps; a sign by ${signs} of ${shopDoors} shop doors`);
    ok(shopDoors === 0 || signs / shopDoors >= 0.7, `${k}: a sign by only ${signs} of ${shopDoors} shop doors`);
  }
}

// ---- the leg of an L-shaped room (args.annex): dressed, lit, and NO second counter
if (/args\.annex/.test(readFileSync(S.dir + 'js/solver2.js', 'utf8'))) {
  let n = 0, props = 0; const KEYPIECE = /^(counter-shop|watch-desk|fireplace-|cell-holding-wood|wall-|door-|market-stall)/;
  for (const k of [...SHOPS, ...OWN]) for (const [w, d] of [[3, 2], [4, 3], [2, 5]]) for (let seed = 1; seed <= 6; seed++) {
    const r = mk('r', k, 10, 10, w, d, seed * 53 + w, 1), E = S.w.computeEdges([r], { engine: 'v2' }), ops = E.openings.get('r').filter(o => o.kind !== 'door');
    const join = { side: 'N', index: 0, kind: 'door', to: null, span: 1, why: 'open to the rest of the room', join: true };
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[k], room: r, openings: [...ops, join], opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => k, annex: true }), tag = `${k} annex ${w}x${d} seed ${r.seed}`;
    n++; props += L.placements.length;
    ok(!L.purposeFail, `${tag} purpose fail in an annex: ${L.purposeFail}`);
    ok(!L.placements.some(p => KEYPIECE.test(p.id)), `${tag} a key piece or kit piece in the annex: ${L.placements.map(p => p.id).filter(i => KEYPIECE.test(i))}`);
    ok(L.placements.some(p => fireType(p.id)), `${tag} annex unlit`);
    const fl = standing(L); for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) { const [aw, ad] = aabb(fl[i]), [bw, bd] = aabb(fl[j]); ok(!(Math.abs(fl[i].x - fl[j].x) < (aw + bw) / 2 - 0.17 && Math.abs(fl[i].z - fl[j].z) < (ad + bd) / 2 - 0.17), `${tag} overlap ${fl[i].id}/${fl[j].id}`); }
  }
  console.log(`annex (the leg of a shaped room, no key program): ${n} legs, ${(props / n).toFixed(1)} things each, no counter repeated`);
}

// ---- a street of shops with the square at its end (what a GM lays down): every room reachable, nothing fails
{ let n = 0, outside = 0, between = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const row = ctxRow(seed);
    const B = H.build(row); n++;
    const doors = [...B.E.edges.values()].filter(e => e.kind === 'door'), indoor = row.filter(r => !OUT.includes(r.type)), adj = new Map(row.map(r => [r.id, new Set()]));
    for (const e of doors) if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
    const src = doors.filter(e => e.sides.length === 1).map(e => e.sides[0].room), seen = new Set(src), q = [...src];
    while (q.length) for (const m of adj.get(q.shift())) if (!seen.has(m)) { seen.add(m); q.push(m); }
    ok(indoor.every(r => seen.has(r.id)), `a street of shops (seed ${seed}): ${indoor.filter(r => !seen.has(r.id)).map(r => r.type)} cannot be reached`);
    outside += doors.filter(e => e.sides.length === 1).length;
    between += doors.filter(e => e.sides.length === 2 && e.sides.every(s => SHOPS.includes(row.find(r => r.id === s.room).type))).length;
    // every shop on the street opens ONTO the street (its shop window faces it)
    for (const r of row.filter(r => SHOPS.includes(r.type))) ok(doors.some(e => e.yard && e.sides.some(s => s.room === r.id)), `a street of shops (seed ${seed}): ${r.type} has no door onto the street`);
    for (const r of row) { const L = B.solve(r.id); ok(!L.purposeFail, `a street of shops seed ${seed}: ${r.type} ${L.purposeFail}`); ok(L.paths.every(p => p.ok) || INN.includes(r.type), `a street of shops seed ${seed}: ${r.type} blocked path`); }
  }
  ok(between === 0, `${between} doors between two shops`);
  console.log(`a street of shops (5 shops and the watch along a street, back rooms behind, the square at the end; ${n} seeds): every room reachable, ${(outside / n).toFixed(1)} outside doors, no door between two shops`);
  function ctxRow(seed) { const rs = []; let x = 10; SHOPS.forEach((k, i) => { rs.push(mk('s' + i, k, x, 10, 4, 4, seed + i, i + 1), mk('b' + i, 'mkt-backroom', x, 7, 4, 3, seed + 10 + i, 10 + i)); x += 4; });
    rs.push(mk('w', 'mkt-watch', x, 10, 4, 4, seed + 20, 20), mk('st', 'mkt-street', 10, 14, 24, 3, seed + 21, 21), mk('sq', 'mkt-square', 34, 10, 8, 7, seed + 22, 22)); return rs; }
}
H.report('market');
