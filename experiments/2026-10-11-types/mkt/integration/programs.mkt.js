// ======================= market & village (2026-10-11) =======================
// Twelve rooms, appended like castle / crypt / mansion (helpers ccm*, castlePut, front, surfaceAt are the ones above).
//
// THE SHOP SKELETON. Every shop is the same room: the counter facing the door with the keeper's lane behind it, stocked
// shelves on the wall behind and down the side walls, a display table and the trade's own pieces in the floor before the
// counter, floor stock by the counter and the door, the shop window in the street wall (walls.js PANELS). The TRADE is
// data: MKT_TRADES[room key] names a sku tier and the trade's signature pieces. The room type lists that tier first
// (build_data.py `tiers`), so chooseSku rolls the baker's counter in the bakery and the tailor's in the tailor's.
// A NEW TRADE = meshes for the five skeleton roles in a new tier + one line here + one room-type line in build_data.py.
//   shelf: only this shape of the stocked shelf (the tailor's chest-high unit, folded cloth on its top, read as a bed)
//   show: pieces set out in a row before the counter · noTable: no cloth-covered display table (the tailor's read as a bed)
//   where: 'far' centred on the wall behind the counter · 'wall' against a side wall · 'floor' in the floor before the counter
const MKT_TRADES = {
  'mkt-general': { tier: 'mkt-general', name: 'general store', hero: [['bins-dry-goods', 'wall']], floor: ['barrel', 'sack', 'crate', 'spice-sacks-open', 'pottery-for-sale', 'baskets-stack', 'rope-coil'], by: ['barrel', 'crate'], sign: 'shop-sign' },
  'mkt-bakery': { tier: 'mkt-bakery', name: 'bakery', hero: [['bread-oven', 'wall'], ['bread-rack', 'wall'], ['dough-trough', 'floor'], ['pretzel-rack', 'wall']], floor: ['flour-sack-open', 'flour-bin', 'sack', 'firewood-basket', 'barley-sack'], by: ['trade-bread-crate-delivery', 'flour-sack-open'], sign: 'trade-sign-pretzel',
    table: ['bread-loaf', 'pastry-tray', 'pie', 'bread-pile', 'bread-rolls-basket', 'cake-round'] },
  'mkt-apothecary': { tier: 'mkt-apoth', name: 'apothecary', hero: [['apothecary-drawers', 'far'], ['trade-tincture-rack', 'wall'], ['table-side', 'floor']], floor: ['spice-sacks-open', 'crate', 'demijohn', 'jar-lidded-stoneware'], by: ['planter-barrel', 'crate'], sign: 'shop-sign',
    table: ['mortar-wood', 'dried-herbs-jar', 'spice-jars', 'bottle-cluster', 'herb-bundle-fresh', 'scales-balance'] },
  'mkt-tailor': { tier: 'mkt-tailor', name: "tailor's shop", hero: [['cutting-table-tailor', 'floor'], ['mirror-standing', 'wall'], ['spinning-wheel', 'wall']], show: ['dress-form', 'dress-form', 'dress-form'], shelf: 'tailor', noTable: true, floor: ['baskets-stack', 'chest-plain', 'basket-laundry'], by: ['dress-form'], sign: 'shop-sign', rug: ['rug-striped-woven', 'rug-oval'] },
  'mkt-curio': { tier: 'mkt-curio', name: 'curio shop', hero: [['display-case-glass', 'floor'], ['pedestal-display', 'floor'], ['telescope', 'wall'], ['trade-globe-terrestrial', 'floor'], ['pedestal-display', 'floor']], floor: ['chest-ironbound', 'trunk-travel', 'book-pile-floor', 'urn-decorative'], by: ['urn-decorative'], sign: 'shop-sign', rug: ['rug-round-fine', 'rug-oval'] },
};
const MKT_TIERS = Object.values(MKT_TRADES).map(t => t.tier);
const MKT_LAMPS = ['lantern-wall-iron', 'lantern-wall-brass', 'lantern-wall-horn', 'candle-box-sconce'];
// one placement rolled in another trade's stock (the back room behind a bakery, a stall table in the square): chooseSku
// reads the room type's `tiers`, and ctx.mount / ctx.surface take no `sku` wish, so the type is swapped for the call
function mktAs(ctx, tier, fn) { if (!tier) return fn(); const t0 = ctx.type; ctx.type = { ...t0, tiers: [tier, 'mkt'] }; try { return fn(); } finally { ctx.type = t0; } }
const mktTradeOf = (ctx, to) => MKT_TRADES[ctx.typesOf?.(to) || ''] || null;
const mktSkuSize = (ctx, id) => { const ds = ctx.lib.objects[id] ? ctx.skuPool(id).map(k => ctx.nominalDims(id, k)) : []; return ds.length ? [Math.max(...ds.map(d => d.w)), Math.max(...ds.map(d => d.d))] : [2, 2]; }; // a role's largest footprint as its meshes really are (the stalls came out 8 ft wide and 5.5 to 8.5 ft deep; the catalog line says 6 x 9)
// a hub's doors are joined to each other before anything stands (attempt() draws a door-to-door loop through a hub AFTER its program)
function mktDoorWays(ctx) { for (let i = 0; i < ctx.doors.length; i++) for (let j = i + 1; j < ctx.doors.length; j++) ccmWalk(ctx, 'branch', [ctx.doors[i].inner, ctx.doors[j].inner]); }
// a thing standing in the floor at (or as near as it fits to) a spot, turned `rot`
function mktNear(ctx, id, at, rot, { why = '', layer = 'furnish', rule = 'shop-floor', reach = 5, step = 0.5, sku, box = null } = {}) {
  if (!ccmHas(ctx, id)) return null;
  return ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (let dx = -reach; dx <= reach + 1e-6; dx += step) for (let dz = -reach; dz <= reach + 1e-6; dz += step) { const x = at[0] + dx, z = at[1] + dz; if (box && (x < box[0] || x > box[2] || z < box[1] || z > box[3])) continue; yield { x, z, rot, r: Math.hypot(dx, dz) }; } }, (c) => c.r, { layer, rule, why, sku }));
}
// against a wall, as near a point as it fits
function mktWallNear(ctx, id, sides, near, { why = '', layer = 'furnish', rule = 'against-wall', gap = 0.05, max = 99, sku, windows = true } = {}) {
  if (!ccmHas(ctx, id) || !sides.length) return null;
  if (isHung(ctx.lib.objects[id], id)) return ccmQuiet(ctx, () => ctx.mount(id, { sides, layer, why }));
  const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap, step: 0.25, windows }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 20, { layer, rule, why, sku }));
  return p;
}

function mktShop(ctx) {
  const T = MKT_TRADES[ctx.type.key] || MKT_TRADES['mkt-general'];
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot;
  const at = (t, s) => ctx.sidePoint(far, t, s);
  // the counter: parallel to the wall facing the door, a lane behind it for the keeper and the shelves (4.2 ft; 3.3 in a
  // shallow shop), as near the middle as the doors allow, at least 2.5 ft clear at one end to walk round
  const lane = deep >= 18 ? 4.2 : 3.7;
  const counter = ccmQuiet(ctx, () => ctx.put('counter-shop', function* (dm) { const m = L - dm.w >= 6 ? 1.2 : 0.3; for (let t = dm.w / 2 + m; t <= L - dm.w / 2 - m + 1e-6; t += 0.25) { if (Math.max(t - dm.w / 2, L - t - dm.w / 2) < 2.5) continue; const [x, z] = at(t, lane + dm.d / 2); yield { x, z, rot: toDoor, t }; } },
    (c) => Math.abs(c.t - L / 2), { layer: 'anchor', rule: 'key-counter', unique: true, why: `the ${T.name}'s counter: facing the door, the keeper's lane and the shelves behind it`, extra: { focal: true, side: far } }));
  if (!counter) return { fail: `${T.name} has no counter (no room for it before the ${SIDE_LABEL[far]} wall)` };
  ctx.focal = { label: 'shop counter', id: counter.id, side: far, ok: true };
  const ct = far === 'N' || far === 'S' ? counter.x - ctx.X0 : counter.z - ctx.Z0, cFront = lane + counter.dims[2];
  // walking lines, before anything else stands: door -> the counter's front; round the roomier end of the counter to the lane behind it
  if (d) { ctx.sight = [d.inner, [counter.x, counter.z]]; ctx.sightFeature = counter.id; ccmWalk(ctx, 'approach', [d.inner, at(ct, cFront + 1.7)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, at(ct, cFront + 1.7)]); }
  mktDoorWays(ctx);
  const endT = ct >= L / 2 ? ct - counter.dims[0] / 2 - 1.5 : ct + counter.dims[0] / 2 + 1.5;
  ccmWalk(ctx, 'service', [at(ct, cFront + 1.7), at(endT, cFront + 1.7), at(endT, lane - 1.0)], { width: 2.4 });
  { const [kx, kz] = at(ct, lane - 1.0), ns = far === 'N' || far === 'S'; ctx.mark(kx, kz, ns ? counter.dims[0] : 2, ns ? 2 : counter.dims[0], KEEP); } // the keeper's lane: 2 ft behind the counter, clear of the shelves on the wall
  const stool = ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['stool-three-leg', 'stool-bar', 'chair-plain']), [[...at(ct, lane - 1.0), toDoor], [...at(ct + 1.5, lane - 1.0), toDoor], [...at(ct - 1.5, lane - 1.0), toDoor]], { rule: 'keeper', why: "the keeper's stool behind the counter", allowKeep: true }));
  if (stool) ctx.command('keeper', stool, { flanks: false });
  // the trade's piece on the wall behind the counter (the apothecary's drawers), then the trade's wall pieces on the side walls
  const walls = [counter];
  for (const [id, where] of T.hero) if (where === 'far') { const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { step: 0.25 }), (c) => Math.abs(c.t - ct), { layer: 'anchor', rule: 'shop-hero', why: `the ${T.name}'s own piece, on the wall behind the counter` })); if (p) walls.push(p); }
  for (const [id, where] of T.hero) if (where === 'wall' && (cells >= 12 || !walls.some(p => p.rule === 'shop-hero'))) { const p = mktWallNear(ctx, id, lat, at(L / 2, deep * 0.55), { layer: 'anchor', rule: 'shop-hero', why: `the ${T.name}'s own piece, against a side wall` }); if (p) walls.push(p); }
  // stocked shelves: the wall behind the counter first, then the side walls, each butted against the last, until about
  // 45% of the wall is stock (the door wall is the shop window: it stays clear)
  const wallFt = 2 * (ctx.W + ctx.D); let stock = walls.slice(1).reduce((a, p) => a + p.dims[0], 0), shelves = 0;
  for (let k = 0; k < 24 && stock < wallFt * 0.45; k++) {
    const b = ccmQuiet(ctx, () => ctx.put('shop-shelf-stocked', (dm) => ctx.wallGen(dm, [far, ...lat], { step: 0.25 }), (c) => (c.side === far ? 0 : 5) + Math.min(...walls.map(q => Math.hypot(q.x - c.x, q.z - c.z))) * (c.side === far ? 0.2 : 1), { layer: 'store', rule: 'shop-shelf', why: 'stocked shelves, butted side by side along the wall', sku: T.shelf ? { shape: T.shelf } : undefined }));
    if (!b) break; walls.push(b); stock += b.dims[0]; shelves++;
  }
  if (!shelves && !walls.some(p => p.rule === 'shop-hero')) ctx.notes.push('no stocked shelf fitted on the walls');
  // the floor before the counter: one slot each side of the way in. The display table on one, the trade's floor pieces
  // on the other and beyond; all parallel to the side walls so the way to the counter stays open
  const s0 = cFront + 3.2, s1 = deep - 3, mid = (s0 + s1) / 2, slots = [], sideRot = toDoor + Math.PI / 2;
  if (s1 - s0 >= 2.5) { const first = ctx.ri(0, 1); for (const k of [first, 1 - first]) { const t = k ? L - Math.min(L * 0.27, 6) : Math.min(L * 0.27, 6); if (Math.abs(t - ct) >= 3.2 || L >= 13) slots.push(at(t, mid)); } if (L >= 28) slots.push(at(L / 2 - 6.5, mid), at(L / 2 + 6.5, mid)); }
  // on show before the counter (the tailor's dress forms): a row facing the door, either side of the way in. (Not in the shop
  // window: the wall nearest the table camera hides the 6 ft of floor behind it. They stand before anything else takes the floor.)
  const shown = [], showSide = T.show ? (ctx.chance(0.5) ? 1 : -1) : 0;
  if (T.show && s1 - cFront >= 5) { const side = showSide; for (const [i, id] of T.show.slice(0, L >= 18 ? 3 : 2).entries()) { const p = mktNear(ctx, id, at(ct + side * (2.7 + i * 2.3), cFront + 4.3), toDoor, { reach: 1.5, layer: 'anchor', rule: 'shop-show', why: 'on show before the counter, in a row to one side of the way in, facing the door' }); if (p) shown.push(p); } }
  const floorBox = [ctx.X0 + 1.9, ctx.Z0 + 1.9, ctx.X1 - 1.9, ctx.Z1 - 1.9], floorHeroes = T.hero.filter(h => h[1] === 'floor').map(h => h[0]), laid = [];
  const want = [...(L >= 13 && s1 - s0 >= 5 && !T.noTable ? ['craft-display-table-goods'] : []), ...floorHeroes, ...(cells >= 30 && !T.noTable ? ['craft-display-table-goods'] : [])];
  if (showSide && slots.length > 1) slots.sort((a, b) => (Math.hypot(b[0] - at(ct + showSide * 5, mid)[0], b[1] - at(ct + showSide * 5, mid)[1])) - (Math.hypot(a[0] - at(ct + showSide * 5, mid)[0], a[1] - at(ct + showSide * 5, mid)[1]))); // the floor pieces take the side the show does not
  for (let i = 0; i < want.length && slots.length; i++) { const id = want[i], spot = slots[i % slots.length], long = /table|case|trough/.test(id);
    const p = mktNear(ctx, id, spot, long ? sideRot : toDoor + Math.PI, { box: floorBox, reach: i < slots.length ? 2.5 : 6, why: id === 'craft-display-table-goods' ? 'the display table, in the floor before the counter' : `the ${T.name}'s own piece, in the floor before the counter`, layer: i < 2 ? 'anchor' : 'furnish', rule: 'shop-floor' });
    if (p) laid.push(p); }
  if (T.table) { const tb = laid.find(p => /^table-/.test(p.id)); if (tb) for (const id of ctx.pick(T.table, 3)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === tb.uid, why: 'on the table' })); }
  if (T.rug && s1 - s0 >= 5) ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, T.rug), { at: at(ct, cFront + 3.5), why: 'a rug before the counter' }));
  // floor stock: one at an end of the counter, one by the door, more against the walls as the shop grows
  ccmFlank(ctx, counter, ['shop-floor-stock'], { off: 0.5, n: 1, layer: 'store', rule: 'shop-stock', why: "the trade's stock, standing by the counter" });
  if (d) mktWallNear(ctx, 'shop-floor-stock', [d.side], d.inner, { layer: 'store', rule: 'shop-stock', why: "the trade's stock, by the door", windows: false, max: 9 });
  const extra = Math.max(1, Math.min(7, Math.round(cells / 6)));
  for (const id of ctx.pick(T.floor, extra)) mktWallNear(ctx, id, ctx.shuffle([...lat, far, ...(d ? [d.side] : [])]), null, { layer: 'store', rule: 'shop-stock', why: 'stock against the wall', windows: false });
  // on the walls: a price board, lanterns
  ccmQuiet(ctx, () => ctx.mount('price-board', { sides: lat, height: 5.4, why: 'the price board' }));
  ccmWallLights(ctx, MKT_LAMPS, d ? [d.side, ...lat] : lat, { every: 22, height: 6.4, why: 'a wall lantern', min: 1, max: 3 });
  ccmEnsureLight(ctx, MKT_LAMPS, ['candlestick-floor', 'candle-tree', 'candlestand-pricket']);
  ctx.shopInfo = { trade: T.name, tier: T.tier, shelves, stock: +(stock / wallFt).toFixed(2), floor: [...shown, ...laid].map(p => p.id) };
  if (shelves > 1) ctx.growth.push(`stocked shelves repeat along the walls: ${shelves} (${Math.round(stock / wallFt * 100)}% of the wall)`);
  ccmDone(ctx);
  return { feature: counter, what: `${T.name}: the counter, ${shelves} stocked shelves${laid.length ? ', ' + laid.length + ' piece' + (laid.length > 1 ? 's' : '') + ' in the floor' : ''}`, approach: null, passage: true };
}

// ---------------- the back room: the shop's store, shared by every trade. Its stock is the trade of the shop it opens off ----------------
function mktBackroom(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), ALL = ['N', 'S', 'E', 'W'];
  const nb = ctx.doors.map(o => o.to && mktTradeOf(ctx, o.to)).find(Boolean) || null, tier = nb ? nb.tier : 'mkt-general', sku = { tiers: [tier, 'mkt'] };
  const centre = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2];
  if (d) ccmWalk(ctx, 'approach', [d.inner, centre]);
  for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, centre]);
  // racks round the walls: the trade's stocked shelves and plain storeroom shelving in turn, the wall facing the door first
  const racks = [], wallFt = 2 * (ctx.W + ctx.D); let run = 0;
  for (let k = 0; k < 20 && run < wallFt * 0.4; k++) {
    const id = k % 3 === 1 && ccmHas(ctx, 'shop-shelf-stocked') ? 'shop-shelf-stocked' : ccmFirst(ctx, ['shelving-freestanding', 'shop-shelf-stocked']); /* (mostly plain storeroom shelving: a wall of stocked shelves read as a shop) */
    if (!id) break;
    const b = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far, ...lat], { step: 0.25 }), (c) => (c.side === far ? 0 : 4) + (racks.length ? Math.min(...racks.map(q => Math.hypot(q.x - c.x, q.z - c.z))) * 0.5 : Math.abs(c.t - ctx.sideLen(c.side) / 2)), { layer: k ? 'store' : 'anchor', rule: 'store-rack', why: 'racks round the walls of the back room', sku: id === 'shop-shelf-stocked' ? sku : undefined, ...(k ? {} : { unique: true, extra: { focal: true } }) }));
    if (!b) break; racks.push(b); run += b.dims[0];
  }
  if (!racks.length) return { fail: 'back room has no rack on its walls' };
  ctx.focal = { label: 'store racks', id: racks[0].id, side: far, ok: true };
  if (d) { ctx.sight = [d.inner, [racks[0].x, racks[0].z]]; ctx.sightFeature = racks[0].id; }
  // the trade's stock standing on the floor, then crates, barrels and sacks, like with like, in the corners
  for (let i = 0, n = Math.max(1, Math.round(cells / 8)); i < n; i++) mktWallNear(ctx, 'shop-floor-stock', ctx.shuffle(ALL), racks[i % racks.length] ? [racks[i % racks.length].x, racks[i % racks.length].z] : null, { layer: 'store', rule: 'shop-stock', why: "the shop's stock, waiting to go out front", sku, windows: false });
  const kinds = ctx.shuffle(['crate', 'barrel', 'sack']).slice(0, cells >= 12 ? 3 : 2);
  for (const id of kinds) ctx.cornerPile([id], Math.max(2, Math.min(5, Math.round(cells / 5))), { why: 'stock stacked in a corner, like with like' });
  for (const id of ctx.pick((nb?.floor || MKT_TRADES['mkt-general'].floor).filter(i => !/crate|barrel|sack$/.test(i)), Math.max(1, Math.round(cells / 10)))) mktWallNear(ctx, id, ctx.shuffle(ALL), null, { layer: 'store', rule: 'shop-stock', why: 'stock against the wall', windows: false });
  // the tally desk by the door: the ledger, a candle, the strongbox beside it
  if (cells >= 9 && d) { const desk = mktWallNear(ctx, 'desk-writing', [d.side, ...lat], d.inner, { why: 'the tally desk, by the door', rule: 'tally' });
    if (desk) { for (const id of ['ledger-accounts', 'candlestick']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === desk.uid, layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the tally desk' }));
      ccmQuiet(ctx, () => ctx.companion(desk, 'stool-three-leg', { why: 'the stool at the tally desk', maxDist: 4 })); ccmQuiet(ctx, () => ctx.companion(desk, 'strongbox', { why: 'the strongbox by the desk', maxDist: 5 })); } }
  ccmQuiet(ctx, () => ctx.mount('key-hook-board', { sides: d ? [d.side] : ALL, height: 5.2, why: 'keys by the door' }));
  ccmWallLights(ctx, MKT_LAMPS, ALL, { every: 30, height: 6.4, why: 'a wall lantern', min: 1, max: 2 });
  ccmEnsureLight(ctx, MKT_LAMPS, ['candlestick-floor', 'candle-tree', 'candlestand-pricket']);
  ctx.shopInfo = { trade: nb ? nb.name : null, tier, shelves: racks.length };
  ccmDone(ctx);
  return { feature: racks[0], what: `back room: ${racks.length} racks${nb ? `, the ${nb.name}'s stock` : ''}`, approach: null, passage: true };
}

// ---------------- the watch post: the sergeant's desk facing the door, a timber lockup in a far corner ----------------
function mktWatch(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot, ALL = ['N', 'S', 'E', 'W'];
  const at = (t, s) => ctx.sidePoint(far, t, s);
  // the lockup: a pen of timber bars in a corner of the far wall (the corner with no door beside it), 5 ft deep, one or
  // two panels wide; its front is bars and one gate, its open side one more panel. Inside: the plank bed, a bucket
  let pen = null;
  if (L >= 14 && deep >= 14 && ccmHas(ctx, 'cell-holding-wood')) {
    const wide = L >= 19 ? 2 : 1, PD = 5, /* (one panel wide read as a tall cabinet from the table: two from 19 ft of wall) */ sides = [0, 1].filter(k => !ctx.overlapsT(ctx.doorT[far], k ? L - wide * 5 - 1 : 0, k ? L : wide * 5 + 1) && !ctx.overlapsT(ctx.doorT[lat[k]], 0, PD + 1) && !ctx.overlapsT(ctx.doorT[lat[k]], ctx.sideLen(lat[k]) - PD - 1, ctx.sideLen(lat[k])));
    const k = sides.length ? sides[hash(ctx.baseSeed ?? ctx.room.seed, 'lockup') % sides.length] : -1;
    if (k >= 0) {
      const t0 = k ? L - wide * 5 : 0, tIn = k ? t0 : wide * 5, gateAt = hash(ctx.baseSeed ?? ctx.room.seed, 'lockup-gate') % wide, made = [];
      const piece = (t, s, rot, shape, why) => castlePut(ctx, 'cell-holding-wood', [...at(t, s), rot], { sku: { shape }, layer: 'anchor', rule: 'lockup', why });
      for (let i = 0; i < wide; i++) made.push(piece(t0 + i * 5 + 2.5, PD + 0.35, toDoor, i === gateAt ? 'gate' : '', i === gateAt ? 'the lockup: its barred gate' : 'the lockup: a front of timber bars'));
      made.push(piece(tIn + (k ? -0.35 : 0.35), 2.5, toDoor + Math.PI / 2, '', 'the lockup: its side of timber bars'));
      if (made.some(Boolean)) { pen = { k, t0, wide, PD, pieces: made.filter(Boolean) };
        if (wide > 1) ccmQuiet(ctx, () => ccmAt(ctx, 'bed-straw-pallet', [[...at(t0 + 5, 1.9), toDoor + Math.PI / 2], [...at(t0 + 4.5, 1.9), toDoor + Math.PI / 2]], { rule: 'in-lockup', why: 'a straw pallet along the back wall of the lockup' }));
        else ccmQuiet(ctx, () => ccmAt(ctx, 'stool-three-leg', [[...at(k ? L - 3.4 : 3.4, 1.2), toDoor]], { rule: 'in-lockup', why: 'a stool in the lockup' }));
        ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: at(t0 + wide * 2.5, PD / 2), why: 'hay on the lockup floor' }));
        ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['bucket-slop', 'bucket']), [[...at(k ? L - 0.9 : 0.9, PD - 1.1), 0]], { layer: 'store', rule: 'in-lockup', why: 'the bucket in the lockup' }));
        const [mx, mz] = at(t0 + wide * 2.5, PD / 2), ns = far === 'N' || far === 'S'; ctx.mark(mx, mz, ns ? wide * 5 : PD, ns ? PD : wide * 5); // nothing else stands in the pen
        const [gx, gz] = at(t0 + gateAt * 5 + 2.5, PD + 2); ctx.mark(gx, gz, 3, 3, KEEP); } // the gate swings into the room
    }
  }
  // the desk: facing the door, the sergeant's chair behind it, centred on what the lockup leaves of the far wall
  const free0 = pen && !pen.k ? pen.wide * 5 + 0.6 : 0, free1 = pen && pen.k ? pen.t0 - 0.6 : L, tc = (free0 + free1) / 2, lane = deep >= 14 ? 3.4 : 2.8;
  const desk = ccmQuiet(ctx, () => ctx.put(ccmFirst(ctx, ['watch-desk', 'desk-writing']) || 'watch-desk', function* (dm) { for (let t = free0 + dm.w / 2 + 0.3; t <= free1 - dm.w / 2 - 0.3 + 1e-6; t += 0.25) { const [x, z] = at(t, lane + dm.d / 2); yield { x, z, rot: toDoor, t }; } }, (c) => Math.abs(c.t - tc), { layer: 'anchor', rule: 'key-desk', unique: true, why: "the sergeant's desk: facing the door, his chair behind it", extra: { focal: true, side: far } }));
  if (!desk && !pen) return { fail: 'watch post has neither its desk nor its lockup' };
  const feature = desk || pen.pieces[0];
  ctx.focal = { label: "sergeant's desk", id: feature.id, side: far, ok: !!desk };
  if (d) { ctx.sight = [d.inner, [feature.x, feature.z]]; ctx.sightFeature = feature.id; ccmWalk(ctx, 'approach', [d.inner, desk ? front(desk, 1.7) : at(tc, deep / 2)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, desk ? front(desk, 1.7) : at(tc, deep / 2)]); }
  mktDoorWays(ctx);
  if (desk) { const dt = far === 'N' || far === 'S' ? desk.x - ctx.X0 : desk.z - ctx.Z0;
    const ch = ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['chair-plain', 'stool-three-leg']), [[...at(dt, lane - 1.2), toDoor], [...at(dt, lane - 1.5), toDoor]], { rule: 'keeper', why: "the sergeant's chair, back to the wall, the door in view", allowKeep: true })); if (ch) ctx.command('sergeant', ch, { flanks: false });
    if (desk.id !== 'watch-desk') for (const id of ['ledger-accounts', 'key-ring', 'mil-guard-lantern']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === desk.uid, layer: /lantern/.test(id) ? 'light' : 'dress', why: 'on the desk' })); }
  // arms on the wall behind the desk and down a side wall; the bench where people wait, by the door
  const racks = []; for (let i = 0, n = Math.max(1, Math.min(4, Math.round(cells / 9))); i < n; i++) { const p = mktWallNear(ctx, 'weapon-rack', i ? [...lat, far] : [far, ...lat], at(tc, 0), { layer: 'store', rule: 'arms', why: "the watch's arms, on the wall" }); if (p) racks.push(p); }
  if (d) mktWallNear(ctx, ccmFirst(ctx, ['bench-long', 'bench-village']), [d.side, ...lat], d.inner, { why: 'the bench by the door, for whoever is waiting', windows: false });
  for (const id of ['mil-footlocker', 'chest-ironbound', 'mil-shield-stack', 'arrow-barrel'].slice(0, Math.max(1, Math.round(cells / 8)))) mktWallNear(ctx, id, ctx.shuffle(lat), null, { layer: 'store', why: 'kit against the wall', windows: false });
  // off duty (from 20 cells): a table with stools and dice; from 30, a cot
  if (cells >= 20) { const tb = ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, ['table-square', 'table-round-small']), ['stool-three-leg', 'chair-plain'], 3, { why: 'the off-duty table' })); if (tb) for (const id of ['dice-and-cup', 'tankard', 'candlestick']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => /^table-/.test(s.id), layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the off-duty table' })); }
  if (cells >= 30) mktWallNear(ctx, 'cot', lat, null, { why: 'a cot for the night watch' });
  // the walls: the wanted wall by the door (notices and bounties), the roster, keys, helmets; manacles by the lockup
  const doorSides = d ? [d.side, ...lat] : ALL;
  for (const id of ['bounty-poster', 'bounty-poster', 'proclamation-scroll', 'mil-duty-roster', 'key-hook-board', 'mil-helmet-peg-rack'].slice(0, 3 + Math.round(cells / 8))) ccmQuiet(ctx, () => ctx.mount(id, { sides: doorSides, height: 5.3, why: /bounty|proclam/.test(id) ? 'the wanted wall' : 'on the wall' }));
  if (pen) ccmQuiet(ctx, () => ctx.mount('manacles-wall', { sides: [lat[pen.k]], height: 4.2, why: 'manacles on the wall by the lockup' }));
  ccmWallLights(ctx, ['lantern-wall-iron', 'torch-sconce', 'torch-bracket-rough'], ALL, { every: 22, height: 6.2, why: 'a wall lantern', min: 1, max: 3 });
  ctx.watchInfo = { lockup: pen ? pen.wide : 0, desk: desk?.id || null, racks: racks.length };
  ccmDone(ctx);
  return { feature, what: `watch post: ${desk ? "the sergeant's desk" : 'no desk'}${pen ? `, a ${pen.wide * 5}-ft timber lockup in the corner` : ''}, ${racks.length} arms racks`, approach: null, passage: true };
}

// ---------------- the town house's living room: the hearth facing the door, the family table, the dresser ----------------
function mktHouse(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot, ALL = ['N', 'S', 'E', 'W'];
  const at = (t, s) => ctx.sidePoint(far, t, s);
  let fire = ccmFocalOn(ctx, far, ['fireplace-wall'], { label: 'hearth', rule: 'key-hearth', slack: Math.max(0.5, L / 2 - 4), why: 'the hearth: on the wall facing the door (axial focal)' });
  if (!fire) fire = mktWallNear(ctx, 'fireplace-wall', lat, at(L / 2, deep / 3), { layer: 'anchor', rule: 'key-hearth', why: 'the hearth, on a side wall' });
  if (!fire) return { fail: 'town house has no hearth' };
  ctx.focal = ctx.focal?.ok ? ctx.focal : { label: 'hearth', id: fire.id, ok: true };
  const hf = front(fire, 3.2);
  ctx.mark(...front(fire, 1.2), 3.5, 2.4, KEEP);
  if (d) { ctx.sight = [d.inner, [fire.x, fire.z]]; ctx.sightFeature = fire.id; ccmWalk(ctx, 'approach', [d.inner, hf]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, hf]); }
  mktDoorWays(ctx);
  // by the fire: the settle one side, the rocking chair the other, turned to it; the cradle within reach; the hearth's things
  const [fx, fz] = ctx.facingVec(fire.rot), lx = fz, lz = -fx, seats = [];
  for (const [sgn, ids] of [[ctx.chance(0.5) ? 1 : -1, ['rocking-chair', 'chair-armed', 'chair-plain']], [0, ['chair-armed', 'chair-upholstered', 'chair-plain']] /* (not the settle: from above it read as a bed) */]) { const sg = sgn || -Math.sign(seats[0] ? (seats[0].x - fire.x) * lx + (seats[0].z - fire.z) * lz : 1), id = ccmFirst(ctx, ids); if (!id) continue;
    // (facing the fire, one each side of the way to it: the way is 3 ft wide, so each seat's inner edge is 1.8 ft off the centre line)
    const p = ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (const e of [0, 0.5, 1, 1.5]) for (const f of [0, 0.5, -0.5, 1]) { const latd = 1.8 + e + dm.w / 2, fwd = fire.dims[2] / 2 + 3.6 + f + dm.d / 2; yield { x: fire.x + fx * fwd + lx * sg * latd, z: fire.z + fz * fwd + lz * sg * latd, rot: fire.rot + Math.PI, e: e + Math.abs(f) }; } }, (c) => c.e, { rule: 'hearth-seat', why: 'by the fire, facing it' })); if (p) seats.push(p); }
  ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, ['rug-hearth-halfmoon', 'rug-braided-round', 'rug-small']), { at: front(fire, 2.2), rot: fire.rot, why: 'the hearth rug' }));
  for (const id of ['firewood-basket', 'cradle', 'fire-irons', 'kettle']) if (id !== 'cradle' || (cells >= 12 && ctx.chance(0.6))) ccmQuiet(ctx, () => ctx.companion(fire, id, { why: id === 'cradle' ? 'the cradle, within reach of the fire' : 'by the hearth', maxDist: id === 'cradle' ? 7 : 5 }));
  // the family table in the door half, laid for a meal
  let table = null;
  if (cells >= 9) { table = ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, cells >= 20 ? ['table-trestle', 'table-square'] : ['table-square', 'table-round-small']), ['chair-plain', 'stool-three-leg'], cells >= 16 ? 4 : 3, { why: 'the family table' }));
    if (table) for (const id of ctx.pick(['bread-loaf', 'pitcher', 'plate', 'bowl', 'mug-glazed', 'candlestick', 'cheese-wedge', 'vase-flowers', 'stew-pot-full'], 4)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => /^table-/.test(s.id), layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the family table' })); }
  // against the walls: the dresser of plates, a cupboard, the spinning wheel by a window, a chest; pegs by the door
  const wallIds = ['dresser-plates', 'cupboard', 'chest-plain', 'bench-long', 'baskets-stack', 'barrel', 'broom']; // (no spinning wheel: from above it read as a workbench with gears, and the room as a workshop)
  for (const id of wallIds.slice(0, Math.max(2, Math.min(wallIds.length, Math.round(cells / 4))))) mktWallNear(ctx, id, ctx.shuffle([...lat, ...(d ? [d.side] : []), far]), null, { why: 'against the wall', layer: /chest|barrel|basket/.test(id) ? 'store' : 'furnish', });
  for (const id of ['coat-pegs', 'shelf-wall', 'painting-still-life'].slice(0, cells >= 16 ? 3 : 2)) ccmQuiet(ctx, () => ctx.mount(id, { sides: id === 'coat-pegs' && d ? [d.side] : lat, height: 5.4, why: id === 'coat-pegs' ? 'pegs by the door' : 'on the wall' }));
  ccmWallLights(ctx, ['candle-box-sconce', 'lantern-wall-iron', 'sconce-candle-single'], [...lat, ...(d ? [d.side] : [])], { every: 30, height: 6, why: 'a wall light', min: 1, max: 2 });
  ctx.houseInfo = { seats: seats.length, table: !!table };
  ccmDone(ctx);
  return { feature: fire, what: `living room: the hearth with ${seats.length} seat${seats.length === 1 ? '' : 's'} by it${table ? ', the family table' : ''}`, approach: null, passage: true };
}

// ---------------- OUTDOORS. Both are role `outdoor` (no walls; the neighbours' doors open onto them; walls.js gives a gate) ----------------
// what a building's door gets beside it, by what is behind the door (against the building's own wall)
const MKT_BY_DOOR = { common: ['bench-village', 'barrel'], desk: ['bench-village'], kitchen: ['rain-barrel', 'crate'], stable: ['hitching-post', 'horse-trough-stone'], 'mkt-watch': ['watch-lantern-bell', 'notice-board'], 'mkt-house': ['planter-barrel', 'bench-street'], 'mkt-backroom': ['crate', 'barrel'], 'mkt-passage': ['rain-barrel'] };
const MKT_SIGN = { common: 'sign-hanging', desk: 'sign-hanging' };
// the surroundings every outdoor program needs (as castleCourtyard has them)
function mktOutdoor(ctx) {
  const ALL = ['N', 'S', 'E', 'W'], w = ctx.room.w, dz = ctx.room.d;
  const gate = ctx.openings.find(o => o.kind === 'gate') || null, open = gate ? gate.open : [];
  const built = ctx.openings.filter(o => o.to && /^(wall|window|door)$/.test(o.kind));
  for (const s of ALL) { const n = s === 'N' || s === 'S' ? w : dz; for (let i = 0; i < n; i++) if (!built.some(o => o.side === s && o.index === i)) ctx.mounts[s].push([i * CELL - INSET, (i + 1) * CELL - INSET]); } // nothing hangs in mid-air
  const gateT = gate ? gate.index * CELL - INSET + CELL / 2 : 0, gatePt = gate ? ctx.sidePoint(gate.side, gateT, 2.6) : null;
  return { ALL, gate, open, built, gateT, gatePt, backSides: ALL.filter(s => built.some(o => o.side === s)), openSides: ALL.filter(s => open.some(o => o.side === s)), wallFt: built.length * CELL };
}
// beside each building door: the trade's sign on the wall, its stock and a thing or two against the wall, a lantern
function mktDoors(ctx, room, { stock = true } = {}) {
  const info = [];
  for (const o of ctx.openings.filter(o => o.kind === 'door' && !o.part && o.to)) {
    const type = ctx.typesOf?.(o.to) || '', T = MKT_TRADES[type], t = o.index * CELL - INSET + (o.span || 1) * CELL / 2, here = ctx.sidePoint(o.side, t, 1), put = [];
    const sign = T ? T.sign : MKT_SIGN[type];
    if (sign && ccmHas(ctx, sign) && mktAs(ctx, T?.tier, () => ccmQuiet(ctx, () => ctx.mount(sign, { sides: [o.side], height: 7.2, rule: 'yard-sign', why: `the ${T ? T.name : 'inn'}'s sign, on its wall` })))) put.push('sign');
    const ids = T ? [...(stock ? ['shop-floor-stock'] : []), ...T.by] : MKT_BY_DOOR[type] || [];
    for (const id of ids.slice(0, 2)) if (room()) { const p = ccmHas(ctx, id) ? mktAs(ctx, T?.tier, () => ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [o.side], { gap: 0.25, windows: false }), (c) => Math.abs(Math.hypot(c.x - here[0], c.z - here[1]) - 4.5), { layer: 'store', rule: 'by-door', why: `outside the ${T ? T.name : type.replace(/^mkt-/, '')} door` }))) : null; if (p && Math.hypot(p.x - here[0], p.z - here[1]) < 13) put.push(p.id); }
    if (ccmQuiet(ctx, () => ctx.mount(ccmFirst(ctx, ['lantern-wall-iron', 'lantern-wall-brass', 'rural-lantern-barn']), { sides: [o.side], height: 6.4, layer: 'light', rule: 'yard-light', why: 'a lantern by the door' }))) put.push('lantern');
    info.push({ to: o.to, type, side: o.side, things: put });
  }
  return info;
}
// awnings over the windows of the buildings that face the street (at most one window in two)
function mktAwnings(ctx, sides, max) { let n = 0; if (!ccmHas(ctx, 'awning')) return 0; for (const s of sides) for (let i = 0; i < ctx.windowT[s].length && n < max; i += 2) if (ccmQuiet(ctx, () => ctx.mount('awning', { sides: [s], height: 8.6, atWindow: true, rule: 'awning', why: 'an awning over the window' }))) n++; return n; }
const MKT_STREET_LAMP = ['lamp-post-iron', 'lamp-post-wood', 'lantern-post'];

// THE MARKET SQUARE: one thing in the middle (the market cross, a well, a fountain, the pump), stalls in two rows facing
// each other across it with a 12-ft way between, open tables and ground displays at the ends of the rows, carts and the
// town's furniture at the edges. Every door's way to the gate is reserved first: no stall stands in it.
function mktSquare(ctx) {
  const O = mktOutdoor(ctx), { ALL, gate, gatePt, gateT } = O, A = ctx.area(), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const target = ctx.densityTarget = Math.max(1.6, yardTarget(A) * 1.5), want = Math.max(5, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length, room = (k = 0) => count() + k < Math.round(want * 1.4);
  if (gate) ctx.keepClear(gate.side, gateT, 5.5, 4.5);
  // (the rows are sized before the middle is chosen: a square too shallow for two rows of stalls has ONE row, backs to an edge,
  // and its middle thing stands in the middle of what that row leaves)
  const horiz = ctx.W >= ctx.D, Lr = horiz ? ctx.W : ctx.D, across = horiz ? ctx.D : ctx.W, [sw, sd] = ccmHas(ctx, 'market-stall') ? mktSkuSize(ctx, 'market-stall') : [8, 6];
  const two = across >= 12 + 2 * sd + 1, oneRow = !two && across >= sd + 14 && ccmHas(ctx, 'market-stall'), shift = oneRow ? (sd + 0.6) / 2 : 0;
  // the middle
  let focal = null;
  if (Math.min(ctx.W, ctx.D) >= 15) { const kind = ctx.roll('market centre', ['market cross', 'market cross', 'well', 'fountain', 'pump']);
    const ids = { 'market cross': ['market-cross', 'well', 'fountain-courtyard'], well: ['well', 'well-house', 'market-cross'], fountain: ['fountain-courtyard', 'market-cross', 'well'], pump: ['pump-trough-village', 'market-cross', 'well'] }[kind];
    focal = ccmCentre(ctx, ids.filter(id => mktSkuSize(ctx, id)[0] <= Math.min(ctx.W, ctx.D) - shift * 2 - 9), { off: horiz ? [0, shift] : [shift, 0], label: 'market centre', rule: 'yard-focal', why: 'the middle of the square: the one thing everything else stands round' });
    if (focal) ccmClearRound(ctx, focal, 2.5); }
  // the ways: every door to the gate (a closed square: door to door), 5 ft wide
  if (gatePt) for (const o of ctx.doors) ccmWalk(ctx, 'path', [o.inner, gatePt], { width: 5 });
  else for (let i = 1; i < ctx.doors.length; i++) ccmWalk(ctx, 'path', [ctx.doors[0].inner, ctx.doors[i].inner], { width: 5 });
  const doorInfo = mktDoors(ctx, room, { stock: false });
  // the stalls: two rows along the square's long axis, facing each other across the middle; a gap in each row where the
  // cross way passes. Rows are 12 ft apart face to face (16 with a big thing in the middle)
  const way = Math.max(12, Math.min(across - 2 * sd - 1, (focal ? Math.max(focal.dims[0], focal.dims[2]) : 0) + 9));
  const stalls = [], P = (a, b) => horiz ? [ctx.X0 + a, ctx.Z0 + b] : [ctx.X0 + b, ctx.Z0 + a]; // a along the rows, b across them
  if (ccmHas(ctx, 'market-stall') && (two || oneRow) && Lr >= sw + 6) {
    const per = Math.max(1, Math.floor((Lr / 2 - 3.5 - 1.5) / (sw + 1.5))), rows = across >= way + 4 * sd + 14 ? 2 : 1;
    for (let r = 0; r < rows; r++) for (const sgn of two ? [-1, 1] : [-1]) for (const half of [-1, 1]) for (let i = 0; i < per; i++) {
      if (Lr < 2 * sw + 9 && half > 0) continue; // a short square: one stall a row, in the middle of the row
      const a = Lr < 2 * sw + 9 ? Lr / 2 : Lr / 2 + half * (3.5 + sw / 2 + i * (sw + 1.5)), b = two ? across / 2 + sgn * (way / 2 + sd / 2 + r * (sd + 7)) : sd / 2 + 0.6;
      const rot = horiz ? (sgn < 0 ? 0 : Math.PI) : (sgn < 0 ? Math.PI / 2 : -Math.PI / 2); // facing the middle
      const p = castlePut(ctx, 'market-stall', [[...P(a, b), rot], [...P(a + half, b), rot], [...P(a + 2 * half, b), rot]], { layer: 'anchor', rule: 'stall', why: 'a market stall: in a row, facing the way through the middle' });
      if (p) stalls.push(p);
    }
  }
  if (!focal && !stalls.length) { const any = ccmCentre(ctx, ['market-stall', 'craft-display-table-goods', 'well'], { label: 'market', rule: 'yard-focal', why: 'the one stall of a small market' }); if (any) (any.id === 'market-stall' ? stalls : []).push(any); focal = focal || any; }
  // open tables and ground displays: at the ends of the rows and before the stalls' corners, each of a different trade
  const tiers = ctx.shuffle(MKT_TIERS), ground = ctx.shuffle(['pottery-for-sale', 'spice-sacks-open', 'flower-buckets', 'rug-merchant-stack', 'fish-barrel-salted', 'apple-crate', 'cabbage-crate', 'vegetable-crate-mixed', 'fruit-crate-mixed', 'shop-floor-stock', 'turnip-pile', 'baskets-stack']);
  let tables = 0, displays = 0;
  for (let i = 0; i < stalls.length && room(); i++) { const s = stalls[i], [fx, fz] = ctx.facingVec(s.rot), lx = fz, lz = -fx, side = i % 2 ? 1 : -1, id = ground[i % ground.length];
    const p = mktAs(ctx, tiers[i % tiers.length], () => mktNear(ctx, id, [s.x + lx * side * (s.dims[0] / 2 + 1.6) + fx * 0.5, s.z + lz * side * (s.dims[0] / 2 + 1.6) + fz * 0.5], s.rot, { reach: 2.5, layer: 'store', rule: 'market-display', why: 'wares set out on the ground beside a stall' })); if (p) displays++; }
  const nTables = Math.max(stalls.length ? 1 : 2, Math.round(A / 450));
  for (let i = 0; i < nTables && room(); i++) { const ang = (i + 0.5) / nTables * Math.PI * 2 + (ctx.baseSeed ?? ctx.room.seed) % 6, rr = Math.min(ctx.W, ctx.D) / 2 - 4.5, spot = [cx + Math.cos(ang) * rr * (ctx.W / Math.min(ctx.W, ctx.D)) * 0.8, cz + Math.sin(ang) * rr * (ctx.D / Math.min(ctx.W, ctx.D)) * 0.8];
    const rot = Math.atan2(cx - spot[0], cz - spot[1]), snap = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
    if (mktAs(ctx, tiers[(i + 2) % tiers.length], () => mktNear(ctx, 'craft-display-table-goods', spot, snap, { reach: 5, rule: 'market-table', why: 'an open trestle of wares, facing the middle' }))) tables++; }
  // the town's furniture: the crier's stand by the centre, a cart at the edge, the notice board by the gate, lamps in the corners, benches
  if (focal && A >= 700) mktNear(ctx, 'town-crier-platform', front(focal, 4), focal.rot, { reach: 6, rule: 'market-town', why: "the crier's stand, by the middle of the square" });
  const edgeSides = [...O.openSides, ...O.backSides].filter((s, i, a) => a.indexOf(s) === i), AT = 0.6;
  const atEdge = (id, near, why, layer = 'furnish', rule = 'at-edge') => ccmHas(ctx, id) && edgeSides.length ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, ctx.shuffle(edgeSides), { gap: AT, windows: false }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 30, { layer, rule, why })) : null;
  const corners = [[ctx.X0 + 2.5, ctx.Z0 + 2.5], [ctx.X1 - 2.5, ctx.Z1 - 2.5], [ctx.X1 - 2.5, ctx.Z0 + 2.5], [ctx.X0 + 2.5, ctx.Z1 - 2.5]];
  let lamps = 0; const lampId = ccmFirst(ctx, MKT_STREET_LAMP);
  if (lampId) for (const c of corners.slice(0, A >= 900 ? 4 : 2)) if (mktNear(ctx, lampId, c, 0, { reach: 3, layer: 'light', rule: 'street-lamp', why: 'a street lamp at the corner of the square' })) lamps++;
  if (gatePt && room()) atEdge('notice-board', ctx.sidePoint(gate.side, gateT + 7, 1), 'the notice board, where people come into the square');
  for (const id of ctx.shuffle(['cart-merchant-covered', 'cart-hand', 'wagon']).slice(0, A >= 1500 ? 2 : 1)) if (room()) atEdge(id, null, 'a cart drawn up at the edge of the square');
  for (const id of ['bench-village', 'bench-street', 'horse-trough-stone', 'hitching-post', ...(A >= 1100 ? ['stocks', 'pillory'].filter(() => ctx.chance(0.5)) : []), 'planter-stone', 'barrel', 'crate']) { if (count() >= want) break; atEdge(id, null, 'at the edge of the square'); }
  if (gate) for (const k of [-1, 1]) ccmQuiet(ctx, () => ccmAt(ctx, 'bollard-stone', [[...ctx.sidePoint(gate.side, gateT + k * 3.4, 0.9), 0]], { rule: 'bollard', why: 'a bollard each side of the way into the square', layer: 'dress' }));
  const awn = mktAwnings(ctx, O.backSides, 4);
  ctx.yardInfo = { vibe: 'market square', edge: 'none', edgePieces: 0, wallFt: O.wallFt, gate: gate ? gate.side : null, focal: focal ? { id: focal.id, kind: focal.id.replace(/-/g, ' ') } : null, signs: doorInfo.filter(x => x.things.includes('sign')).length, wear: 0, doors: doorInfo, stalls: stalls.length, tables, displays, lamps, awnings: awn, plants: { placed: 0, slot: [], waiting: [] } };
  if (stalls.length > 1) ctx.growth.push(`stalls repeat in rows: ${stalls.length}`);
  ccmDone(ctx);
  return { feature: focal || stalls[0] || null, what: `market square: ${focal && focal.id !== 'market-stall' ? `the ${focal.id.replace(/-/g, ' ')} in the middle, ` : ''}${stalls.length} stalls, ${tables} open tables, ${displays} ground displays`, outdoor: true };
}

// THE STREET: a clear way down the middle from end to end; everything stands in a 3-ft band at the two sides. Lamps
// about every 25 ft, on alternate sides; signs, stock and awnings by the doors of the buildings along it; a pump or a
// trough, a bench, a cart drawn up; bollards at both ends.
function mktStreet(ctx) {
  const O = mktOutdoor(ctx), { ALL, gate, gatePt } = O, A = ctx.area(), horiz = ctx.W >= ctx.D, Lr = horiz ? ctx.W : ctx.D, across = horiz ? ctx.D : ctx.W;
  const long = horiz ? ['N', 'S'] : ['W', 'E'], ends = horiz ? ['W', 'E'] : ['N', 'S'], cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const target = ctx.densityTarget = Math.max(1.6, yardTarget(A) * 1.3), want = Math.max(4, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor').length, room = (k = 0) => count() + k < Math.round(want * 1.4);
  // the carriageway: the middle of the street, end to end (at least 6 ft, half the width in a wide street)
  const lane = across < 12 ? Math.max(3, across - 5.6) : Math.max(Math.min(6, across - 5), across * 0.5);
  if (lane >= 3) ctx.mark(cx, cz, horiz ? Lr : lane, horiz ? lane : Lr, KEEP);
  const e0 = ctx.sidePoint(ends[0], across / 2, 1.5), e1 = ctx.sidePoint(ends[1], across / 2, 1.5);
  ccmWalk(ctx, 'through', [e0, e1], { width: Math.min(4, Math.max(3, lane)) });
  for (const o of ctx.doors) ccmWalk(ctx, 'path', [o.inner, [horiz ? o.inner[0] : cx, horiz ? cz : o.inner[1]]]);
  const doorInfo = mktDoors(ctx, room);
  // lamps: about every 25 ft, alternate sides, 1.2 ft in from the edge
  const lampId = ccmFirst(ctx, MKT_STREET_LAMP), nL = Math.max(1, Math.round(Lr / 25)); let lamps = 0;
  if (lampId) for (let i = 0; i < nL; i++) { const t = Lr * (i + 0.5) / nL;
    if (ccmQuiet(ctx, () => ctx.put(lampId, (dm) => ctx.wallGen(dm, [long[i % 2], long[(i + 1) % 2]], { gap: 0.15, step: 0.5, windows: false }), (c) => Math.abs(c.t - t) + (c.side === long[i % 2] ? 0 : 6), { layer: 'light', rule: 'street-lamp', why: 'a street lamp at the side of the way' }))) lamps++; }
  const atSide = (id, near, why, layer = 'furnish') => ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, ctx.shuffle(long), { gap: 0.4, windows: false }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 40, { layer, rule: 'street-side', why })) : null;
  // the water: a pump and trough (or the stone trough) from 40 ft of street; a bench; a cart drawn up at the side
  const things = [];
  if (Lr >= 40 && room()) { const p = atSide(ccmFirst(ctx, ctx.chance(0.6) ? ['pump-trough-village', 'horse-trough-stone'] : ['horse-trough-stone', 'pump-trough-village']), null, 'the street pump and its trough'); if (p) things.push(p); }
  for (const id of [ccmFirst(ctx, ['bench-street', 'bench-village']), ...(across >= 15 && Lr >= 35 ? [ccmAny(ctx, ['cart-hand', 'cart-merchant-covered'])] : []), 'hitching-post', 'flower-buckets', 'planter-stone', 'rain-barrel', 'barrel', 'crate', 'planter-barrel', 'notice-board']) { if (!id || count() >= want) break; const p = atSide(id, null, 'at the side of the street', /barrel|crate/.test(id) ? 'store' : 'furnish'); if (p) things.push(p); }
  // bollards: a pair at each open end, either side of the carriageway
  let bollards = 0;
  for (const s of ends) if (O.open.some(o => o.side === s)) for (const k of [-1, 1]) if (ccmQuiet(ctx, () => ccmAt(ctx, 'bollard-stone', [[...ctx.sidePoint(s, across / 2 + k * (lane / 2 + 0.9), 1.0), 0]], { rule: 'bollard', why: 'a bollard at the end of the street, beside the way', layer: 'dress' }))) bollards++;
  const awn = mktAwnings(ctx, O.backSides, Math.max(1, Math.round(Lr / 20)));
  ctx.yardInfo = { vibe: 'town street', edge: 'none', edgePieces: 0, wallFt: O.wallFt, gate: gate ? gate.side : null, focal: null, signs: doorInfo.filter(x => x.things.includes('sign')).length, wear: 0, doors: doorInfo, lamps, bollards, awnings: awn, lane, plants: { placed: 0, slot: [], waiting: [] } };
  if (lamps > 1) ctx.growth.push(`street lamps repeat along the way: ${lamps}`);
  ccmDone(ctx);
  const lampP = ctx.placements.find(p => p.rule === 'street-lamp') || things[0] || null;
  return { feature: lampP, what: `town street: a clear way ${Math.round(lane)} ft wide down the middle, ${lamps} lamp${lamps === 1 ? '' : 's'}${doorInfo.length ? `, ${doorInfo.length} door${doorInfo.length === 1 ? '' : 's'} dressed` : ''}`, outdoor: true };
}

// the bedroom above the shop IS the inn's guest room, the passage the inn's hallway, in half-timber walls
PROGRAM_OF['mkt-bedroom'] = 'guest';
PROGRAM_OF['mkt-passage'] = 'hallway';
// mktRegisterTrade(key, trade): everything the solver knows about a shop, for one room key. A later trade (the smithy's
// shopfront, a cobbler) calls it from its own appended block with its own line of data; walls.js has mktRegisterShop(key).
function mktRegisterTrade(key, trade) {
  if (trade) MKT_TRADES[key] = trade;
  if (!MKT_TIERS.includes(MKT_TRADES[key].tier)) MKT_TIERS.push(MKT_TRADES[key].tier);
  KEY[key] = mktShop; DENSITY[key] = 4.5; FOCAL[key] = 'shop counter (facing the door, shelves behind)'; KEY_RE[key] = /^counter-shop$/;
  MENUS[key] = ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['shop-shelf-stocked', 'shop-shelf-stocked', 'shop-floor-stock', 'craft-display-table-goods'] })); // the leg of an L-shaped shop: more shelves, never a second counter
}
const mktAnnex = (ctx, { wall = [], hung = [], lights = MKT_LAMPS } = {}) => { for (const id of wall) mktWallNear(ctx, id, ctx.shuffle(['N', 'S', 'E', 'W']), null, { layer: 'store', why: 'against the wall' }); for (const id of hung) ccmQuiet(ctx, () => ctx.mount(id, { height: 5.4, why: 'on the wall' })); ccmWallLights(ctx, lights, ['N', 'S', 'E', 'W'], { every: 24, height: 6.4, min: 1, max: 3 }); };
for (const k of Object.keys(MKT_TRADES)) mktRegisterTrade(k);
Object.assign(KEY, { 'mkt-backroom': mktBackroom, 'mkt-watch': mktWatch, 'mkt-house': mktHouse, 'mkt-square': mktSquare, 'mkt-street': mktStreet });
Object.assign(MENUS, {
  'mkt-backroom': ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['shelving-freestanding', 'crate', 'barrel', 'sack'] })),
  'mkt-watch': ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['weapon-rack', 'bench-long', 'mil-footlocker'], hung: ['bounty-poster'], lights: ['lantern-wall-iron', 'torch-sconce'] })),
  'mkt-house': ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['cupboard', 'chest-plain', 'bench-long'], hung: ['shelf-wall'], lights: ['candle-box-sconce', 'lantern-wall-iron'] })),
});
// (no DENSITY line for the square or the street: each sets its own target, as yard() does)
Object.assign(DENSITY, { 'mkt-backroom': 5, 'mkt-watch': 4, 'mkt-house': 5, 'mkt-bedroom': DENSITY.guest ?? 5, 'mkt-passage': DENSITY.hallway ?? 3.5 });
Object.assign(FOCAL, { 'mkt-watch': "sergeant's desk", 'mkt-house': 'hearth', 'mkt-square': 'market cross (or the well, fountain or pump) in the middle' });
Object.assign(KEY_RE, { 'mkt-backroom': /^(shelving-freestanding|shop-shelf-stocked)$/, 'mkt-watch': /^(watch-desk|desk-writing|cell-holding-wood)$/, 'mkt-house': /^fireplace-wall$/, 'mkt-square': null, 'mkt-street': null,
  'mkt-bedroom': KEY_RE.guest, 'mkt-passage': KEY_RE.hallway });
