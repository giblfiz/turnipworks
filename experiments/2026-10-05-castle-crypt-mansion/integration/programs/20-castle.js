// ---------------- castle (2026-10-05): nine rooms ----------------
// great hall, throne room, armoury, barracks, dungeon, gatehouse: one self-contained program each (below).
// chapel = the shared chapel() with CASTLE_CHAPEL; castle kitchen = the inn's kitchen program (castleKitchen wraps it);
// courtyard = an outdoor room (walls.js role 'outdoor') with its own program, castleCourtyard, in place of yard().
// Castle variants of roles the inn already had (the great chandelier, the high seat, the 11-ft cooking hearth) are sku
// tier 'castle'; castle room types list tiers ['castle', 'ccm'], so chooseSku PREFERS them. A placement that wants the
// plain mesh passes sku: { tiers: [] }; one that wants a named variant passes sku: { shape: '...' }.
const CASTLE_TORCH = ['torch-bracket-rough', 'torch-sconce'], CASTLE_TORCH_FINE = ['torch-bracket-fine', 'torch-sconce'];
const castleTops = new WeakMap(); // a dais -> the footprints of what stands on it

// one thing at one exact spot (or the first of several that fits), with a sku wish (ccmAt has none)
function castlePut(ctx, id, spots, o = {}) {
  if (!ccmHas(ctx, id)) return null;
  const list = Array.isArray(spots[0]) ? spots : [spots];
  return ccmQuiet(ctx, () => ctx.put(id, () => list.map(([x, z, rot], i) => ({ x, z, rot, i })), (c) => c.i, { layer: o.layer || 'furnish', rule: o.rule || 'placed', why: o.why || '', allowKeep: !!o.allowKeep, sku: o.sku, extra: o.extra || {}, unique: !!o.unique, failWhy: 'no room at its spot' }));
}
// a thing standing ON a platform (the high table and its chairs, the throne): wholly on it, clear of what is already there.
// The platform blocks the floor grid; what stands on it is recorded at the platform's height.
function castleOn(ctx, id, base, x, z, rot, o = {}) {
  if (!base || !ccmHas(ctx, id)) return null;
  const sk = ctx.chooseSku(id, o.sku || {}); if (!sk) return null;
  const dm = ctx.dims(id, sk), [aw, ad] = ctx.aabb(dm.w, dm.d, rot), [bw, bd] = ctx.aabb(base.dims[0], base.dims[2], base.rot);
  if (Math.abs(x - base.x) + aw / 2 > bw / 2 + 0.05 || Math.abs(z - base.z) + ad / 2 > bd / 2 + 0.05) return null;
  const tops = castleTops.get(base) || []; castleTops.set(base, tops);
  if (tops.some(q => Math.abs(q.x - x) < (q.aw + aw) / 2 && Math.abs(q.z - z) < (q.ad + ad) / 2)) return null;
  tops.push({ x, z, aw, ad });
  return ctx.record(id, sk, dm, x, base.dims[1], z, rot, o.layer || 'furnish', o.rule || 'on-dais', o.why || 'on the dais', { on: base.uid, ...(o.extra || {}) });
}
// a flat laid at an exact spot with a sku wish (ctx.rug rolls any sku): the royal runner
function castleRug(ctx, id, x, z, rot, sku, why) {
  if (!ccmHas(ctx, id)) return null;
  const sk = ctx.chooseSku(id, sku || {}); if (!sk) return null;
  const dm = ctx.dims(id, sk), [aw, ad] = ctx.aabb(dm.w, dm.d, rot);
  if (x - aw / 2 < ctx.X0 - 0.01 || x + aw / 2 > ctx.X1 + 0.01 || z - ad / 2 < ctx.Z0 - 0.01 || z + ad / 2 > ctx.Z1 + 0.01) return null;
  if (ctx.rugs.some(b => Math.abs(b.x - x) < (b.w + aw) / 2 && Math.abs(b.z - z) < (b.d + ad) / 2)) return null;
  ctx.rugs.push({ x, z, w: aw, d: ad });
  return ctx.record(id, sk, dm, x, 0.03 + ctx.rugs.length * 0.01, z, rot, 'floor-dress', 'rug', why, { orient: 'floor' });
}
// THE DAIS: centred on wall `far`, its LONG side along the wall (a high table is 10-14 ft long). The batch's spec box is
// 110 wide x 170 deep, so the mesh as specified is laid turned a quarter; with the size override in
// manifest_overrides.castle.json (170 x 110: the solver's own box rule then turns the mesh) it is laid straight. Either
// way the program reads the mesh's box and puts the long side to the wall. A short wall gets the one-step 9-ft-square
// dais (sku --s2). Returns { p, depth, width } (ft out from the wall, ft along it) or null.
function castleDais(ctx, far, { square = false } = {}) {
  if (!ccmHas(ctx, 'dais')) return null;
  const L = ctx.sideLen(far), at = (s) => ctx.sidePoint(far, L / 2, s), box = (shape) => { const sk = ctx.skuPool('dais').find(k => k.shape === shape); return sk ? ctx.nominalDims('dais', sk) : null; };
  const big = box(''), small = box('s2');
  let p = null;
  if (big && !square) { const turn = big.w < big.d, along = Math.max(big.w, big.d), out = Math.min(big.w, big.d);
    if (L >= along * 1.08 + 2) p = castlePut(ctx, 'dais', [0.3, 0.6, 0.9, 1.2].map(g => [...at(out / 2 + g), SIDES[far].rot + (turn ? Math.PI / 2 : 0)]), { sku: { shape: '' }, layer: 'anchor', rule: 'key-dais', why: 'the dais: against the end wall, its long side to the hall', unique: true, extra: { focal: true } }); }
  if (!p && small && L >= small.w + 1) p = castlePut(ctx, 'dais', [0.3, 0.6, 0.9, 1.2].map(g => [...at(small.d / 2 + g), SIDES[far].rot]), { sku: { shape: 's2' }, layer: 'anchor', rule: 'key-dais', why: 'the dais (one step, 9 ft square): centred on the end wall', unique: true, extra: { focal: true } });
  if (!p) return null;
  const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot), ns = far === 'N' || far === 'S';
  const out = far === 'N' ? p.z - ctx.Z0 : far === 'S' ? ctx.Z1 - p.z : far === 'W' ? p.x - ctx.X0 : ctx.X1 - p.x; // its centre, ft out from the wall
  return { p, depth: out + (ns ? ad : aw) / 2, width: ns ? aw : ad };
}
// the wall for the room's focal piece: ccmFar's choice unless a door stands in its middle (a second door, a neighbour's);
// then the other end wall, then a side wall, whichever has `half` ft clear each side of its centre
function castleFar(ctx, half, o = {}) {
  const first = ccmFar(ctx, o), free = (s) => !ctx.overlapsT(ctx.doorT[s], ctx.sideLen(s) / 2 - half, ctx.sideLen(s) / 2 + half) && ctx.sideLen(s) >= 2 * half;
  const d = ctx.mainDoor, order = [first, OPP_SIDE[first], ...ccmLat(first)].filter((s, i, a) => a.indexOf(s) === i);
  return order.find(s => free(s) && (!d || s !== d.side)) || order.find(free) || first;
}
// hung flats and trophies down the given walls, taking the sides in turn
function castleHang(ctx, ids, sides, n, { height = 5.6, why = 'on the wall' } = {}) {
  let k = 0;
  for (let i = 0; i < n; i++) { const id = ccmAny(ctx, ids); if (!id) break; if (ccmQuiet(ctx, () => ctx.mount(id, { sides: [sides[i % sides.length]], height, why }))) k++; }
  return k;
}
// a chandelier at a point: the 6-ft great ring where it hangs 5 ft clear of every wall, the inn's 3-ft ring elsewhere
// (ctx.ceiling rolls any sku and turns it at random: a 6-ft ring 4 ft from a wall would pass through it)
function castleChandelier(ctx, at, why) {
  if (!ccmHas(ctx, 'chandelier-ring')) return null;
  const sk = ctx.chooseSku('chandelier-ring', ctx.wallDist(at[0], at[1]) >= 5 ? {} : { tiers: [] }); if (!sk) return null;
  const dm = ctx.dims('chandelier-ring', sk);
  return ctx.record('chandelier-ring', sk, dm, at[0], Math.max(0.5, CEIL - dm.h - 0.25), at[1], ctx.r(0, Math.PI * 2), 'light', 'ceiling', why);
}
// a strip of floor kept clear on the focal axis, from sA to sB ft out from wall `far`, `w` ft wide
function castleStrip(ctx, far, sA, sB, w) {
  const L = ctx.sideLen(far), [x, z] = ctx.sidePoint(far, L / 2, (sA + sB) / 2), ns = far === 'N' || far === 'S';
  ctx.mark(x, z, ns ? w : sB - sA, ns ? sB - sA : w, KEEP);
}
// things against a wall near a point, in order (the kit by a door)
function castleNear(ctx, ids, sides, near, { layer = 'furnish', why = '', maxDist = 14 } = {}) {
  const out = [];
  for (const id of ids) { if (!ccmHas(ctx, id)) continue; const p = ccmQuiet(ctx, () => isHung(ctx.lib.objects[id], id) ? ctx.mount(id, { sides: [sides[0]], layer, why }) : ctx.put(id, (dm) => ctx.wallGen(dm, sides), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer, rule: 'by-door', why })); if (p && Math.hypot(p.x - near[0], p.z - near[1]) <= maxDist + 20) out.push(p); }
  return out;
}

// GREAT HALL (hub): the dais and high table on the short wall facing the door, the great hearth centred on a long wall,
// trestle tables end to end down the hall either side of a centre aisle, benches both sides of each
function castleGreatHall(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = castleFar(ctx, 5.2, { shortEnd: true }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx);
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), toDoor = SIDES[far].rot;
  // (a 9-ft square dais cannot carry a 10-ft table: a narrow hall has none. Nor has a hall whose only free wall is a long
  // one with under 24 ft before it, a through-hall with a door in each end: dais and hearth would cut it in two)
  const tight = deep < 24 && L > deep + 1, D = L >= 17 && !tight ? castleDais(ctx, far) : null;
  // the high table: ON the dais, parallel to the wall, a foot back from its front edge; with no dais, on the floor before the wall
  let table = null; const [, td] = ccmSize(ctx, 'table-feast'), [, cd] = ccmSize(ctx, 'chair-armed');
  const tS = D ? D.depth - 1.0 - td / 2 : 0.6 + cd + 0.5 + td / 2;
  if (D) for (const shape of D.width >= 14.1 ? ['', 's2'] : ['s2']) table = table || castleOn(ctx, 'table-feast', D.p, ...axis(tS), toDoor, { sku: { shape }, layer: 'anchor', rule: 'key-high-table', why: 'the high table: on the dais, parallel to the end wall', extra: { focal: true } });
  if (!table) for (const [id, sku] of [['table-feast', { shape: 's2' }], ['table-trestle', {}]]) table = table || (D ? castleOn(ctx, id, D.p, ...axis(tS), toDoor, { sku, layer: 'anchor', rule: 'key-high-table', why: 'the high table: on the dais', extra: { focal: true } }) : castlePut(ctx, id, [...axis(tS), toDoor], { sku, layer: 'anchor', rule: 'key-high-table', why: 'the high table: across the end of the hall, the lord\'s side to the wall', unique: true, extra: { focal: true } }));
  // (a small hall whose door landings cover the end of the room: the table may stand in a landing rather than not at all)
  if (!table) for (const [id, sku] of [['table-feast', { shape: 's2' }], ['table-trestle', {}]]) table = table || castlePut(ctx, id, [0, 1.5, 3].map(g => [...axis(0.6 + cd + 0.5 + td / 2 + g), toDoor]), { sku, layer: 'anchor', rule: 'key-high-table', why: 'the high table: across the end of the hall', unique: true, allowKeep: true, extra: { focal: true } });
  if (!table) return { fail: 'great hall has no high table (no table-feast mesh, or the end wall is under 11 ft)' };
  ctx.focal = { label: 'high table', id: table.id, side: far, ok: true };
  // the lord's side only: the high seat centred behind the table, armed chairs either side, nobody on the hall side
  const tOut = far === 'N' ? table.z - ctx.Z0 : far === 'S' ? ctx.Z1 - table.z : far === 'W' ? table.x - ctx.X0 : ctx.X1 - table.x; // the table's centre, ft out from the wall
  const cS = Math.max(cd / 2 + 0.6, tOut - table.dims[2] / 2 - 0.45 - (cd + 0.6) / 2), seat = (id, t, sku, why) => D ? castleOn(ctx, id, D.p, ...axis(cS, t), toDoor, { sku, rule: 'high-seat', why }) : castlePut(ctx, id, [...axis(cS, t), toDoor], { sku, rule: 'high-seat', why });
  const high = seat('chair-armed', L / 2, { shape: 'high-seat' }, 'the high seat: centred behind the high table, back to the wall') || seat('chair-armed', L / 2, { tiers: [] }, 'the lord\'s chair: centred behind the high table');
  let side = 0; for (let k = 1; k <= 3; k++) for (const sg of [-1, 1]) if (k * 2.7 + 1 <= table.dims[0] / 2 && seat('chair-armed', L / 2 + sg * k * 2.7, { tiers: [] }, 'an armed chair beside the high seat, facing the hall')) side++;
  if (d) { ctx.sight = [d.inner, [table.x, table.z]]; ctx.sightFeature = table.id; }
  // the hearth: centred on a long wall (the one without the door), 5 ft of working face kept clear
  // (a door in a LONG wall: hearth and door landing would both stand in the trestle rows, so the hearth takes the end wall
  // opposite the dais and faces it down the aisle)
  const sideDoor = !tight && d && lat.includes(d.side) && !ctx.doorT[OPP_SIDE[far]].length, hs = sideDoor ? OPP_SIDE[far] : lat.find(s => !ctx.doorT[s].length) || lat[0];
  let hearth = ccmFocalOn(ctx, hs, ['fireplace-grand', 'fireplace-wall'], { label: 'hearth', rule: 'pole-hearth', slack: sideDoor ? 0.5 : Math.max(0.5, deep / 2 - (D ? D.depth : 6) - 5), why: sideDoor ? 'the great hearth: on the end wall, facing the dais down the hall' : 'the great hearth: centred on a long wall' });
  for (const w2 of [...lat, ...(tight ? [] : [OPP_SIDE[far]])]) if (!hearth && w2 !== hs) hearth = ccmFocalOn(ctx, w2, ['fireplace-grand', 'fireplace-wall'], { label: 'hearth', rule: 'pole-hearth', strict: true, slack: Math.max(0.5, ctx.sideLen(w2) / 2 - (lat.includes(w2) ? (D ? D.depth : 6) + 5 : 5)), why: 'the great hearth: on the wall that has room for it' });
  ctx.focal = { label: 'high table', id: table.id, side: far, ok: true };
  if (hearth) { const [fx, fz] = front(hearth, 2.5), [aw, ad] = ctx.aabb(hearth.dims[0] + 1, 5, hearth.rot); ctx.mark(fx, fz, aw, ad, KEEP); }
  // the centre aisle, kept clear from the dais foot to the door wall; the walk: door -> the door end of the aisle -> the dais foot
  const footS = (D ? D.depth : tS + td / 2) + 1.2;
  castleStrip(ctx, far, footS, deep, 5);
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, axis(deep - 3), axis(footS + 1)], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(Math.max(footS + 1, Math.min(deep - 3, deep / 2)))]); }
  // the lower tables end to end in two rows (one under 24 ft across, on the side away from the hearth), a bench each side.
  // Blind reads (2026-10-06): light trestles with tankards on them were "common tables for patrons" and the hall "a tavern
  // common room or a castle mess hall". So the rows are the dark 10-ft feast tables where the hall is wide enough for two
  // rows of them (trestles in a narrow hall), set with a feast, benches both sides measured from the REAL meshes (the
  // tables are 3.5-4 ft deep, not the catalog's 2.5: no bench found room), and the royal runner lies down the aisle.
  // (NOT the 10-ft `table-feast--s2`: its top is green, and five of them were "gaming tables, likely for billiards")
  const rowSku = L >= 26 && ctx.skuPool('table-feast').some(k => k.shape === '') ? ['table-feast', { shape: '' }] : ['table-trestle', {}];
  const nomOf = (id, want) => { const pool = ctx.skuPool(id).filter(k => want.shape === undefined || k.shape === want.shape); return pool.map(k => ctx.nominalDims(id, k)).reduce((m, dm) => ({ w: Math.max(m.w, dm.w), d: Math.max(m.d, dm.d) }), { w: 0, d: 0 }); };
  const tN = nomOf(rowSku[0], rowSku[1]), bN = nomOf('bench-long', {}), tw = tN.w || ccmSize(ctx, rowSku[0])[0], tdp = tN.d || ccmSize(ctx, rowSku[0])[1], bdp = bN.d || 1.5;
  const off = 2.5 + 0.35 + bdp + 0.55 + tdp / 2, rows = L >= 2 * (off + tdp / 2 + 0.55 + bdp + 0.4) ? [-1, 1] : L >= off + tdp / 2 + 0.55 + bdp + 0.4 + 4 ? [(sideDoor ? d.side : hs) === lat[0] ? 1 : -1] : [];
  const trestles = [];
  for (const sg of rows) for (let s = footS + 1.2; s + tw <= deep - 3.5 + 1e-6;) { // (a table that meets the hearth's face or a door landing slides on a foot at a time)
    const [x, z] = axis(s + tw / 2, L / 2 + sg * off), t = castlePut(ctx, rowSku[0], [x, z, toDoor + Math.PI / 2], { sku: rowSku[1], layer: 'anchor', rule: 'trestle-row', why: 'the lower tables end to end down the hall' });
    if (!t) { s += 1; continue; }
    trestles.push(t); const sc = s + tw / 2; s += tw + 0.6;
    for (const bs of [-1, 1]) castlePut(ctx, 'bench-long', [0.55, 0.8, 1.05].map(g => { const [bx, bz] = axis(sc, L / 2 + sg * off + bs * (Math.min(t.dims[0], t.dims[2]) / 2 + g + bdp / 2)); return [bx, bz, Math.atan2(x - bx, z - bz)]; }), { rule: 'seat', why: 'a bench along the table', extra: { group: t.uid } });
  }
  if (trestles.length) ctx.growth.push(`trestles repeat: ${trestles.length} in ${rows.length} row${rows.length === 1 ? '' : 's'} down the hall`);
  { const [, rl] = ccmSize(ctx, 'rug-runner'); for (let s = footS + 0.4; s + rl <= deep - 0.3; s += rl) castleRug(ctx, 'rug-runner', ...axis(s + rl / 2), toDoor, { shape: 'royal' }, 'the runner: down the aisle from the door to the dais'); }
  // on the tables: linen, the high table's silver and a candelabrum; a feast on the lower tables (no tankards: that is the inn)
  ccmQuiet(ctx, () => ccmOn(ctx, 'tablecloth-white', table, 0, 0, 'linen on the high table'));
  for (const id of ['candelabra', 'salt-cellar-ship', ...ctx.pick(['goblet-silver', 'platter-silver', 'boar-head-platter', 'goblet-silver', 'pitcher', 'roast-pig'], 4)]) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'candelabra' ? 'light' : 'dress', why: 'on the high table' }));
  const FEAST = ['roast-pig', 'boar-head-platter', 'platter-silver', 'pie-meat', 'bread-loaf', 'plate-roast-veg', 'goblet-silver', 'goblet', 'pitcher', 'trencher-meal', 'drumstick', 'cheese-wheel-cut'];
  for (const t of trestles) { ccmQuiet(ctx, () => ctx.surface('candelabra', { on: s => s.uid === t.uid, layer: 'light', why: 'a candelabrum on the table' })); for (const id of ctx.pick(FEAST, 4)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === t.uid, why: 'the feast on the lower table' })); }
  // banner poles flanking the dais, armour by the door, shields and hangings on the long walls
  for (const sg of [-1, 1]) castlePut(ctx, 'banner-pole', [...axis(1.0, L / 2 + sg * ((D ? D.width : table.dims[0]) / 2 + 1.3)), toDoor], { rule: 'flank', why: 'a banner either side of the dais' });
  if (d) for (const sg of [-1, 1]) ccmQuiet(ctx, () => ctx.put('armor-stand', (dm) => ctx.wallGen(dm, [d.side]), (c) => Math.abs(c.t - (d.tc + sg * (d.width / 2 + 2.2))), { rule: 'by-door', why: 'a suit of armour either side of the door' }));
  castleHang(ctx, ['heraldic-shield'], [far], 1, { height: 7.0, why: 'the arms on the wall behind the high seat' });
  castleHang(ctx, ['banner-wall', 'tapestry'], [far], 2, { height: 5.8, why: 'banners behind the high table' });
  // (banners and tapestries only, one per 6 ft: shield displays and trophy heads were "weapon racks" and "framed pictures", a tavern's walls)
  castleHang(ctx, ['banner-wall', 'tapestry', 'banner-wall'], lat, Math.max(2, Math.round(deep / 6) * 2), { height: 5.8, why: 'banners and tapestries down the long walls' });
  ccmWallLights(ctx, CASTLE_TORCH_FINE, lat, { every: 13, height: 6.2, why: 'a torch every 10-15 ft of the long walls' });
  // (no chandelier over the aisle: from the table camera the 6-ft ring is "a wagon wheel on the floor", "a round floor grate"; the hall is lit by its hearth, torches and the candelabrum on the high table)
  for (const sg of [-1, 1]) castlePut(ctx, ccmFirst(ctx, ['candelabra-standing', 'torch-stand']), [...axis(footS - 0.4, L / 2 + sg * Math.min(L / 2 - 1.5, (D ? D.width : table.dims[0]) / 2 + 3.2)), toDoor], { layer: 'light', rule: 'flank', why: 'a standing light at each end of the dais step' });
  if (!hearth) castlePut(ctx, 'brazier-large', [0.5, 0.35, 0.65, 0.2, 0.8].flatMap(f => (rows.length === 1 ? [-rows[0]] : [1, -1]).flatMap(sg => [4, 5.5, 3.2].map(o => [...axis(footS + (deep - footS) * f, L / 2 + sg * o), 0]))), { layer: 'light', why: 'a brazier beside the aisle (no wall free for the hearth)' });
  ccmEnsureLight(ctx, CASTLE_TORCH_FINE, ['candle-tree', 'torch-stand']);
  ctx.hallInfo = { dais: !!D, chairs: side + (high ? 1 : 0), trestles: trestles.length, hearth: hearth?.id || null };
  ccmDone(ctx);
  return { feature: table, what: `high table${D ? ' on the dais' : ''} (${side + (high ? 1 : 0)} seats on the lord's side), ${hearth ? 'the great hearth' : 'no hearth'}, ${trestles.length} trestles`, approach: null, passage: true };
}

// THRONE ROOM (terminal): the dais centred on the wall facing the door, the throne on it, the runner from the door to
// its foot kept clear, a mirrored avenue either side (pillar, brazier, armour, repeating), courtiers' stools at the dais foot
function castleThrone(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = castleFar(ctx, 2.2, { shortEnd: true }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx);
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), toDoor = SIDES[far].rot;
  const D = castleDais(ctx, far, { square: L < 19 || deep < 24 });
  const [, thd] = ccmSize(ctx, 'throne');
  let throne = D ? castleOn(ctx, 'throne', D.p, ...axis(Math.min(1.0 + thd / 2, D.depth / 2)), toDoor, { layer: 'anchor', rule: 'key-throne', why: 'the throne: on the dais, centred, facing the door', extra: { focal: true } }) : null;
  if (!throne) throne = ccmFocalOn(ctx, far, ['throne'], { label: 'throne', rule: 'key-throne', gap: 0.6, why: 'the throne: centred on the wall facing the door (no room for a dais)' });
  if (!throne) return { fail: `throne room has no throne (${ccmHas(ctx, 'throne') ? 'a door stands where it would go' : 'no throne mesh'})` };
  ctx.focal = { label: 'throne', id: throne.id, side: far, ok: true };
  if (d) { ctx.sight = [d.inner, [throne.x, throne.z]]; ctx.sightFeature = throne.id; }
  const onDais = throne.y > 0, footS = onDais ? D.depth + 0.6 : 0.6 + throne.dims[2] + 1.5;
  // a banner either side of the throne, on the floor at the ends of the dais (a 9-ft pole on a 16-in step would pass the wall tops)
  for (const sg of [-1, 1]) castlePut(ctx, 'banner-pole', [...axis(1.0, L / 2 + sg * ((onDais ? D.width : throne.dims[0]) / 2 + 1.4)), toDoor], { rule: 'flank', why: 'a banner either side of the throne' });
  // the processional line: the runner laid end to end from the dais foot toward the door, 5 ft kept clear, the walk on it
  castleStrip(ctx, far, footS, deep, 5);
  const [, rl] = ccmSize(ctx, 'rug-runner'); let runners = 0;
  for (let s = footS + 0.3; s + rl <= deep - 0.3; s += rl) if (castleRug(ctx, 'rug-runner', ...axis(s + rl / 2), toDoor, { shape: 'royal--s1' }, 'the runner: from the door to the foot of the dais')) runners++;
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, axis(deep - 2.5), axis(footS + 1)], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(Math.max(footS + 1, deep / 2))]); }
  // the avenue: mirrored left and right, repeating down the room: pillar, brazier, armour (facing the runner)
  const off = Math.min(L / 2 - 1.8, 6.5), seq = ['pillar-round', 'brazier', 'armor-stand']; let avenue = 0;
  if (off >= 4.2) for (let s = footS + 1.6, k = 0; s <= deep - 4.5; s += 3.4, k++) for (const sg of [-1, 1]) {
    const kind = seq[k % 3], id = kind === 'brazier' ? ccmFirst(ctx, k % 2 ? ['brazier-standing', 'brazier-large'] : ['brazier-large', 'brazier-standing']) : kind, [x, z] = axis(s, L / 2 + sg * off), [ax, az] = axis(s);
    if (id && castlePut(ctx, id, [x, z, Math.atan2(ax - x, az - z)], { layer: kind === 'brazier' ? 'light' : kind === 'pillar-round' ? 'anchor' : 'furnish', rule: 'avenue', why: 'the avenue either side of the runner (mirrored)' })) avenue++;
  }
  // courtiers' stools at the dais foot, to one side; the regalia chest in a big room
  const cs = ctx.chance(0.5) ? 1 : -1;
  for (let k = 0, n = cells >= 30 ? 4 : 2; k < n; k++) castlePut(ctx, 'faldstool', [...axis(footS + 0.9 + Math.floor(k / 2) * 2.2, L / 2 + cs * (3.6 + (k % 2) * 2.2)), toDoor], { why: 'a courtier\'s stool at the foot of the dais' });
  if (cells >= 35) castlePut(ctx, 'chest-treasure', [...axis(footS + 1, L / 2 - cs * 4.4), toDoor], { layer: 'store', why: 'the regalia chest by the dais' });
  castleHang(ctx, ['heraldic-shield'], [far], 1, { height: 7.0, why: 'the arms above the throne' });
  castleHang(ctx, ['banner-wall', 'tapestry', 'banner-wall'], [far, ...lat], Math.max(2, Math.round(deep / 10) * 2), { height: 5.8, why: 'banners behind the throne and down the long walls' });
  ccmWallLights(ctx, CASTLE_TORCH_FINE, lat, { every: 14, height: 6.2, why: 'torch on the long wall' });
  for (let k = 0, n = Math.max(1, Math.round(deep / 30)); k < n; k++) castleChandelier(ctx, axis(Math.max(5.2, Math.min(deep - 5.2, footS + (deep - footS) * (k + 0.5) / n))), 'chandelier over the runner');
  if (d) for (const s of ccmLat(d.side)) ccmCorner(ctx, ccmAny(ctx, ['candelabra-standing', 'torch-stand']), [d.side, s], { why: 'a light in the corner of the door wall', layer: 'light' });
  ccmEnsureLight(ctx, CASTLE_TORCH_FINE, ['torch-stand', 'brazier-standing']);
  ctx.throneInfo = { dais: onDais, runners, avenue };
  ccmDone(ctx);
  return { feature: throne, what: `throne${onDais ? ' on the dais' : ''}, ${runners ? 'the runner to its foot' : 'a clear line to it'}, an avenue of ${avenue}`, approach: null, passage: true };
}

// ARMOURY (terminal): the tall rack on the wall facing the door, weapon racks along every free run of wall, ranks of
// armour stands facing the door from 20 x 20 ft (corners below that), the repair bench and grindstone by the door
function castleArmoury(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx);
  let focal = ccmFocalOn(ctx, far, ['weapon-rack'], { label: 'weapon rack', rule: 'key-rack', why: 'the tall weapon rack: on the wall facing the door' });
  if (!focal) focal = ccmQuiet(ctx, () => ctx.wall('weapon-rack', { sides: [far, ...lat], layer: 'anchor', rule: 'key-rack', why: 'weapon rack against the wall' })) || ccmCentre(ctx, ['armor-stand'], { label: 'armour stand', rule: 'key-stand', rot: SIDES[far].rot });
  if (!focal) return { fail: 'armoury has no weapon rack or armour stand' };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; ccmWalk(ctx, 'approach', [d.inner, front(focal, 1.8)]); }
  let stands = 0;
  if (Math.min(ctx.W, ctx.D) >= 19) {
    castleStrip(ctx, far, 2, deep, 3);
    const rk = ccmRanks(ctx, { far, s0: 5, s1: deep - 6, gap: 2.5, aisle: 4, turn: Math.PI, proto: 'armor-stand', choose: () => 'armor-stand', limit: Math.max(4, Math.round(cells / 3)), layer: 'anchor', rule: 'stand-rank', why: 'armour stands in ranks, all facing the door' });
    stands = rk.placed.length; if (stands) ctx.growth.push(`armour stands repeat: ${stands} in ${rk.rows} ranks`);
  } else for (const [a, b] of [[far, lat[0]], [far, lat[1]]]) if (ccmCorner(ctx, 'armor-stand', [a, b], { why: 'an armour stand in the corner', inset: 0.4 })) stands++;
  // by the door: the repair bench and the grindstone (the tally-desk slot), arrow barrels, shields, a chest
  const doorSides = d ? [d.side, ...ccmLat(d.side)] : lat, nearPt = d ? d.inner : [ctx.X0, ctx.Z0];
  const racks0 = ccmAlong(ctx, ['weapon-rack'], [...lat, far], 2, { why: 'weapon racks along the walls', layer: 'anchor' }); // (two before the kit by the door: the real racks are 5 ft wide and a 20-ft room ran out of wall)
  const kit = castleNear(ctx, ['mil-armor-repair-bench', 'grindstone', 'arrow-barrel', 'chest-ironbound', 'mil-shield-stack', ...(cells >= 20 ? ['arrow-barrel', 'mil-pavise'] : [])], doorSides, nearPt, { layer: 'store', why: 'kept by the door' });
  // racks: one per 5 ft of what wall is left
  const free = 2 * (ctx.W + ctx.D), racks = racks0.concat(ccmAlong(ctx, ['weapon-rack'], [...lat, far, ...(d ? [d.side] : [])], Math.max(0, Math.min(14, Math.round(free / 11)) - racks0.length), { why: 'weapon racks along the walls', layer: 'anchor' }));
  for (let k = racks.length + 1; k < 3; k++) if (!ccmQuiet(ctx, () => ctx.put('weapon-rack', (dm) => ctx.wallGen(dm, ['N', 'S', 'E', 'W']), () => 0, { layer: 'anchor', rule: 'wall-run', why: 'a narrow rack where the wide ones found no wall', sku: { shape: 's2' } }))) break; // (the real racks are 5 ft wide; the tall one is 3)
  for (const c of kit.filter(p => /^chest/.test(p.id))) for (const id of ctx.pick(['helm-great', 'helm-open', 'armor-breastplate', 'crossbow', 'sword-short', 'axe-hand', 'mace-flanged', 'warhammer', 'quiver-arrows'], 2)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === c.uid, why: 'loose arms on the chest' }));
  castleHang(ctx, ['mil-crossbow-rack', 'smith-helm-row-shelf', 'shield-display'], [...lat, far], Math.max(1, Math.round(cells / 8)), { height: 6.4, why: 'hung between the racks' });
  if (d) castleHang(ctx, ['heraldic-shield'], [d.side], 1, { height: 7.0, why: 'the arms on the door wall' });
  ccmWallLights(ctx, ['torch-bracket-rough', 'lantern-wall-iron'], [...lat, far], { every: 24, min: 1, why: 'a light on the wall' });
  ccmEnsureLight(ctx, ['torch-bracket-rough', 'lantern-wall-iron'], ['torch-stand']);
  ccmDone(ctx);
  return { feature: focal, what: `${racks.length + 1} weapon racks along the walls, ${stands} armour stands`, approach: null, passage: true };
}

// BARRACKS (terminal): the guard-room table by the door first, then bunks head to the wall down both long walls, a
// footlocker at each foot, helmet pegs between them; one wall of bunks only where the room is under 19 ft across
function castleBarracks(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, long = ctx.longSides(), across = Math.min(ctx.W, ctx.D), Lr = Math.max(ctx.W, ctx.D), cells = ccmCells(ctx), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const [bw, bd] = ccmSize(ctx, 'bunk-bed'), [, fd] = ccmSize(ctx, 'mil-footlocker');
  // bunks: one per 5 ft of long wall; both walls when the room holds two bunks and a 4-ft way between, else the long wall
  // farther from the door. A footlocker at each foot where that still leaves 4.5 ft to walk; the default 30 x 20 would be
  // left 3.3, so there only one wall's bunks have theirs (the real bunk meshes are 4 ft wide: no room beside them)
  const both = across >= 2 * bd * 1.05 + 4, footBoth = !both || across >= 2 * (bd + fd + 0.3) + 4.5, far1 = d && long.includes(OPP_SIDE[d.side]) ? OPP_SIDE[d.side] : long.find(s => !ctx.doorT[s].length) || long[0];
  const walls = both ? long : [far1], bunks = [], aisleO = both ? across / 2 + (footBoth ? 0 : fd / 2) : Math.min(across - 1.7, (bd + fd + 0.5 + across) / 2), aisleW = 3;
  { // the aisle down the room, kept clear before the bunks (in the middle, or along the bare wall), and a straight way to it from every door
    const horiz = long[0] === 'N', [ax, az] = ctx.sidePoint(walls[0], Lr / 2, aisleO);
    ctx.mark(ax, az, horiz ? ctx.W : aisleW, horiz ? aisleW : ctx.D, KEEP);
    for (const o of ctx.doors) { const pr = horiz ? [Math.max(ctx.X0 + 2, Math.min(ctx.X1 - 2, o.inner[0])), az] : [ax, Math.max(ctx.Z0 + 2, Math.min(ctx.Z1 - 2, o.inner[1]))];
      ctx.mark((o.inner[0] + pr[0]) / 2, (o.inner[1] + pr[1]) / 2, Math.abs(o.inner[0] - pr[0]) + 3, Math.abs(o.inner[1] - pr[1]) + 3, KEEP); } }
  // the guard-room zone: a table against the door wall beside the door, a seat at each end of it along the wall, the duty
  // lantern on it. It stays within a bunk's depth of the wall, so the way down the room is never the table's
  let table = null;
  if (d && cells >= 12) {
    table = ccmQuiet(ctx, () => ctx.put('table-square', (dm) => ctx.wallGen(dm, [d.side], { gap: 0.2 }), (c) => Math.abs(Math.abs(c.t - d.tc) - (d.width / 2 + 4.2)), { layer: 'furnish', rule: 'guard-table', why: 'the guard-room table: against the wall beside the door' }));
    if (table) { const along = d.side === 'N' || d.side === 'S' ? [1, 0] : [0, 1];
      for (const sg of [-1, 1]) castlePut(ctx, ccmAny(ctx, ['stool-three-leg']) || 'bench-long', [0.85, 1.1].map(g => { const x = table.x + along[0] * sg * (table.dims[0] / 2 + g), z = table.z + along[1] * sg * (table.dims[0] / 2 + g); return [x, z, Math.atan2(table.x - x, table.z - z)]; }), { rule: 'seat', why: 'a seat at the guard table' });
      for (const id of ['mil-guard-lantern', 'dice-and-cup', 'tankard']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'mil-guard-lantern' ? 'light' : 'dress', why: 'on the guard table' })); }
  }
  for (const side of walls) for (let t = 2.5; t <= Lr - 2.4; t += 5) {
    const b = ccmQuiet(ctx, () => ctx.put(ccmFirst(ctx, ['bunk-bed', 'cot']), (dm) => ctx.wallGen(dm, [side], { tRange: [t - 1.2, t + 1.2] }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'bunk', why: 'a bunk, head to the wall, one per 5 ft' }));
    if (!b) continue;
    bunks.push(b);
    const [fx, fz] = front(b, 0.15 + fd / 2);
    if (footBoth || side === walls[0]) castlePut(ctx, 'mil-footlocker', [fx, fz, b.rot], { layer: 'store', rule: 'companion', why: 'a footlocker at the foot of the bunk', extra: { with: b.uid } });
  }
  if (!bunks.length) return { fail: 'barracks has no bunk (no wall run clear of the doors)' };
  { const ends = [ctx.sidePoint(walls[0], 2.5, aisleO), ctx.sidePoint(walls[0], Lr - 2.5, aisleO)]; // the walks, found along the kept aisle
    if (d) { ccmWalk(ctx, 'aisle', [d.inner, ends[0]]); ccmWalk(ctx, 'aisle', [d.inner, ends[1]]); for (const o2 of ctx.doors) if (o2 !== d) ccmWalk(ctx, 'branch', [o2.inner, ctx.sidePoint(walls[0], Lr / 2, aisleO)]); } }
  ctx.growth.push(`bunks repeat: ${bunks.length} along ${walls.length === 2 ? 'both long walls' : 'one long wall'}`);
  const key = d ? bunks.reduce((a, b) => Math.hypot(a.x - d.inner[0], a.z - d.inner[1]) <= Math.hypot(b.x - d.inner[0], b.z - d.inner[1]) ? a : b) : bunks[0];
  // beside the door: a weapon rack and an armour stand; a brazier near the table; pegs, roster and horn on the walls
  if (d) castleNear(ctx, ['weapon-rack', 'armor-stand', 'mil-shield-stack'], [d.side, ...ccmLat(d.side)], d.inner, { why: 'arms kept beside the door' });
  if (table) ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['brazier-tripod', 'brazier-standing']), { sides: [d.side, ...ccmLat(d.side)], prefer: 'near', near: [table.x, table.z], layer: 'light', gap: 0.4, why: 'a brazier by the guard table' }));
  castleHang(ctx, ['mil-helmet-peg-rack', 'smith-helm-row-shelf'], walls, Math.max(1, Math.round(bunks.length / 2)), { height: 6.6, why: 'helmet pegs between the bunks' });
  if (d) castleHang(ctx, ['mil-duty-roster', 'horn-hunting'], [d.side], 2, { height: 5.4, why: 'by the door' });
  for (let k = 0, n = Math.max(1, Math.round(Lr / 18)); k < n; k++) if (ccmHas(ctx, 'lantern-hanging')) ctx.ceiling('lantern-hanging', { at: long[0] === 'N' ? [ctx.X0 + Lr * (k + 0.5) / n, cz] : [cx, ctx.Z0 + Lr * (k + 0.5) / n], why: 'lantern over the aisle' });
  ccmWallLights(ctx, CASTLE_TORCH, ctx.shortSides(), { every: 20, min: 1, max: 2, why: 'torch on the end wall' });
  ccmEnsureLight(ctx, CASTLE_TORCH, ['brazier-tripod']);
  ctx.barracksInfo = { bunks: bunks.length, walls: walls.length, guardTable: !!table };
  ccmDone(ctx);
  return { feature: key, what: `${bunks.length} bunks along ${walls.length === 2 ? 'both long walls' : 'one long wall'}${table ? ', the guard table by the door' : ''}`, approach: null, passage: true };
}

// DUNGEON (terminal): cells 10 ft deep along ONE long wall (full-height partitions, barred fronts, one barred door a
// cell), a 5-ft aisle before them, and the open half: the rack, the iron maiden on the wall facing the door, the irons.
// Under 300 sq ft, or under 21 ft across: no cells, a torture chamber.
function castleDungeon(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), area = ctx.area(), cells = ccmCells(ctx), long = ctx.longSides(), across = Math.min(ctx.W, ctx.D), Lr = Math.max(ctx.W, ctx.D);
  // (2026-10-05: `door-cell-bars` was rejected at the mesh gate. Until it is re-made the cell door is the crypt's iron gate,
  // a 4-ft barred leaf in the 5-ft half of the front; one cell in five stands open: no leaf, the gap is the way in)
  const CELL_D = 10, cellDoor = ccmFirst(ctx, ['door-cell-bars', 'crypt-gate-iron']), withCells = area >= 300 && across >= 21 && ccmHas(ctx, 'cell-bars');
  // the cell wall: a long wall with no door in it (never the main door's)
  const cw = withCells ? long.find(s => !ctx.doorT[s].length) || null : null;
  const made = []; let open = 0;
  if (cw) {
    const rotIn = SIDES[cw].rot, rotAcross = rotIn + Math.PI / 2, wall = { family: 'castle-rough' }, n = Math.floor((Lr + 0.5) / 10), t0 = (Lr - n * 10) / 2;
    const piece = (id, t, s, rot, sku, why) => castlePut(ctx, id, [...ctx.sidePoint(cw, t, s), rot], { sku, layer: 'anchor', rule: 'cell', why });
    for (let k = 0; k <= n; k++) { // partitions: two 5-ft wall panels out from the cell wall (the room's own end walls close the end cells)
      const t = t0 + k * 10; if (t < 0.8 || t > Lr - 0.8) continue;
      for (const s of [2.5, 7.5]) piece('wall-straight', t, s, rotAcross, wall, 'a full-height partition between two cells');
    }
    for (let k = 0; k < n; k++) { // fronts: one barred panel and one barred door to a cell, the door on a seeded side
      const t = t0 + k * 10, flip = hash(ctx.baseSeed ?? ctx.room.seed, 'cell-door', k) % 2, twin = cellDoor === 'door-cell-bars' && ccmHas(ctx, 'door-cell-bars-open'), isOpen = (twin || cellDoor === 'crypt-gate-iron') && hash(ctx.baseSeed ?? ctx.room.seed, 'cell-open', k) % 5 === 0;
      const bars = piece('cell-bars', t + (flip ? 7.5 : 2.5), CELL_D + 0.45, rotIn, {}, 'the barred front of a cell');
      const door = !cellDoor || (isOpen && !twin) ? null : piece(isOpen ? 'door-cell-bars-open' : cellDoor, t + (flip ? 2.5 : 7.5), CELL_D + 0.45 + (isOpen ? 1.4 : 0), rotIn, {}, isOpen ? 'a cell door standing open' : 'the barred door of a cell') || piece(cellDoor, t + (flip ? 2.5 : 7.5), CELL_D + 0.45, rotIn, {}, 'the barred door of a cell');
      if (!bars && !door) continue;
      if (door?.id === 'door-cell-bars-open' || (isOpen && !door)) open++;
      made.push({ t, k });
      // inside: a pallet along the back wall (or bones, one cell in six), a slop bucket in the corner, hay underfoot
      const bones = hash(ctx.baseSeed ?? ctx.room.seed, 'cell-bones', k) % 6 === 0, [pw, pd] = ccmSize(ctx, 'bed-straw-pallet');
      if (bones) castlePut(ctx, 'bones-pile', [...ctx.sidePoint(cw, t + 3, 2), rotIn], { layer: 'dress', rule: 'in-cell', why: 'what is left of a prisoner' });
      else castlePut(ctx, 'bed-straw-pallet', [...ctx.sidePoint(cw, t + 0.8 + pd / 2, 0.3 + pw / 2), rotAcross], { rule: 'in-cell', why: 'a straw pallet along the back wall of the cell' });
      castlePut(ctx, 'bucket-slop', [...ctx.sidePoint(cw, t + 9, 1.2), 0], { layer: 'store', rule: 'in-cell', why: 'the slop bucket in the corner of the cell' });
      ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: ctx.sidePoint(cw, t + 5, 5), why: 'hay on the cell floor' }));
    }
    if (made.length) { const [x, z] = ctx.sidePoint(cw, Lr / 2, CELL_D + 0.6 + 2.5), ns = cw === 'N' || cw === 'S'; ctx.mark(x, z, ns ? Lr : 5, ns ? 5 : Lr, KEEP); // the aisle before the cells: 5 ft, clear
      castleHang(ctx, ['manacles-wall', 'cell-bench-plank'], [cw], made.length, { height: 4.2, why: 'on the back wall of a cell' }); ctx.growth.push(`cells repeat: ${made.length} along the ${SIDE_LABEL[cw]} wall`); }
  }
  // the open floor: everything between the aisle and the wall opposite the cells (the whole room when there are none)
  const s0 = made.length ? CELL_D + 5.8 : 0, depthOpen = across - s0, base = cw || long[0], mid = (t, s) => ctx.sidePoint(base, t, s0 + s), rackRot = SIDES[base].rot + Math.PI / 2;
  const rack = castlePut(ctx, 'rack-torture', [[...mid(Lr * 0.5, depthOpen / 2 + (made.length ? 0.5 : 0)), rackRot], [...mid(Lr * 0.35, depthOpen / 2 + 0.5), rackRot], [...mid(Lr * 0.65, depthOpen / 2 + 0.5), rackRot], [...mid(Lr * 0.5, depthOpen / 2 + 0.5), rackRot + Math.PI / 2]], { layer: 'anchor', rule: 'key-rack', why: 'the rack: in the open floor, its long axis along the room', unique: true });
  if (rack) ccmClearRound(ctx, rack, 1.5);
  // the iron maiden: centred on the wall facing the door when that wall is free (and is not the cell wall), else a far corner
  const maidenIds = ctx.chance(1 / 3) && ccmHas(ctx, 'iron-maiden-open') ? ['iron-maiden-open', 'iron-maiden'] : ['iron-maiden'];
  let maiden = far !== cw ? ccmFocalOn(ctx, far, maidenIds, { label: 'iron maiden', rule: 'key-maiden', strict: false, slack: made.length ? Math.max(0.5, ctx.sideLen(far) / 2 - 2) : 0.5, why: 'the iron maiden: against the wall facing the door' }) : null;
  if (!maiden) for (const s of lat) maiden = maiden || ccmCorner(ctx, 'iron-maiden', [cw ? OPP_SIDE[cw] : far, s], { why: 'the iron maiden: in a far corner', layer: 'anchor', inset: 0.5 });
  // the room's key piece is whichever of the two the doorway can see (the cells' full-height fronts may hide the other)
  const seen = (p) => p && (!d || ctx.losClear(d.inner, [p.x, p.z], new Set([p.uid])).ok), feature = [rack, maiden].find(seen) || (made.length ? null : rack || maiden || null), any = rack || maiden;
  if (!any && !made.length) return { fail: 'dungeon has no cells, rack or iron maiden' };
  ctx.focal = maiden?.focal ? { label: 'iron maiden', id: maiden.id, side: far, ok: true } : { label: 'iron maiden', ok: false, why: 'the wall facing the door is the cell wall or has no room' };
  if (d && feature) { ctx.sight = [d.inner, [feature.x, feature.z]]; ctx.sightFeature = feature.id;
    // (the doorway's view of it is kept: the real cage and pillory stand 5.5-6 ft, taller than their catalog lines, and put() judges tall by the catalog)
    const n = Math.ceil(Math.hypot(feature.x - d.inner[0], feature.z - d.inner[1]) / 1.5); for (let i = 1; i < n; i++) ctx.mark(d.inner[0] + (feature.x - d.inner[0]) * i / n, d.inner[1] + (feature.z - d.inner[1]) * i / n, 2.5, 2.5, KEEP); }
  // (the walk ends beside the rack, on the door's side of it; where the real rack, 3.6 ft wide, leaves no room between itself and that wall, on its other side)
  const rackSide = (sg) => { const a = rack.rot + Math.PI / 2, k = rack.dims[0] / 2 + 1.6; return [rack.x + Math.sin(a) * k * sg, rack.z + Math.cos(a) * k * sg]; };
  const rackSg = rack && d ? (((d.inner[0] - rack.x) * Math.sin(rack.rot + Math.PI / 2) + (d.inner[1] - rack.z) * Math.cos(rack.rot + Math.PI / 2)) >= 0 ? 1 : -1) : 1;
  if (d) { if (any) ccmWalk(ctx, 'approach', [d.inner, rack ? ([rackSg, -rackSg].map(rackSide).find(([x, z]) => ctx.wallDist(x, z) >= 1.4) || rackSide(rackSg)) : front(any, 1.8)]);
    if (made.length) ccmWalk(ctx, 'aisle', [d.inner, ctx.sidePoint(cw, 3, CELL_D + 3), ctx.sidePoint(cw, Lr - 3, CELL_D + 3)], { width: 3 });
    for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, d.inner]); }
  if (rack) ccmQuiet(ctx, () => ctx.companion(rack, ccmFirst(ctx, ['brazier-irons', 'brazier-standing']), { why: 'the irons heating beside the rack', layer: 'light', maxDist: 6 }));
  if (area >= 600) ccmQuiet(ctx, () => ctx.put('table-experiment', (dm) => ctx.rectGen(dm, [ctx.X0 + 2, ctx.Z0 + 2, ctx.X1 - 2, ctx.Z1 - 2], [rackRot + Math.PI / 2, rackRot], 1), (c) => rack ? Math.abs(Math.hypot(c.x - rack.x, c.z - rack.z) - 9) : 0, { rule: 'near', why: 'the examination table, in the open half' }));
  // along the far wall as the room grows: stocks, pillory, cage, block; the jailer's station by the door; the hatch in a far corner
  const farWalls = cw ? [OPP_SIDE[cw], ...ccmLat(cw)] : [far, ...lat], grows = ['stocks', 'pillory', 'cage-floor', 'block-headsman'].filter(i => ccmHas(ctx, i)).slice(0, Math.max(0, Math.min(4, Math.round((area - 250) / 180))));
  for (const id of grows) ccmQuiet(ctx, () => ctx.wall(id, { sides: farWalls, layer: 'furnish', why: 'along the far wall' }));
  if (d) { const st = castleNear(ctx, [...(cells >= 16 ? ['table-square'] : []), 'chest-ironbound'], [d.side, ...ccmLat(d.side)], d.inner, { why: 'the jailer\'s station by the door' }).find(p => p.id === 'table-square');
    if (st) { ccmQuiet(ctx, () => ctx.free('stool-three-leg', { near: [st.x, st.z], radius: 3, margin: 0.4, face: [st.x, st.z], rule: 'seat', why: 'the jailer\'s stool' })); ccmQuiet(ctx, () => ctx.surface('mil-guard-lantern', { on: s => s.uid === st.uid, layer: 'light', why: 'the jailer\'s lantern' })); }
    castleHang(ctx, ['lever-wall', 'key-hook-board'], [d.side], 2, { height: 5.2, why: 'by the door: the lever and the keys' }); }
  if (area >= 500) ccmCorner(ctx, 'oubliette-hatch', [cw ? OPP_SIDE[cw] : far, lat[ctx.ri(0, 1)]], { why: 'the oubliette hatch in a far corner', layer: 'anchor', inset: 1.2, rot: 0 });
  if (ccmHas(ctx, 'decal-blood') && rack) ccmQuiet(ctx, () => ctx.rug('decal-blood', { at: front(rack, 0.2), why: 'by the rack' }));
  if (!made.length) castleHang(ctx, ['manacles-wall'], [far, ...lat], 2, { height: 4.2, why: 'manacles on the wall' });
  // dark on purpose: one light per 250 sq ft
  ccmWallLights(ctx, ['torch-bracket-rough', 'torch-sconce'], farWalls.concat(d ? [d.side] : []), { every: 999, min: Math.max(1, Math.round(area / 250)), max: 6, why: 'a rough torch (dark on purpose)' });
  ccmEnsureLight(ctx, CASTLE_TORCH, ['brazier-irons', 'brazier-standing']);
  ctx.dungeonInfo = { cells: made.length, open, rack: !!rack, maiden: maiden?.id || null };
  ccmDone(ctx);
  return { feature, what: made.length ? `${made.length} cells behind bars${open ? ` (${open} standing open)` : ''}, ${rack ? 'the rack' : 'no rack'}${maiden ? ' and the iron maiden' : ''} in the open half` : `a torture chamber: ${[rack && 'the rack', maiden && 'the iron maiden'].filter(Boolean).join(' and ')}`, approach: null, passage: true };
}

// GATEHOUSE (passage): gate to gate, 10 ft wide, kept completely clear; the windlass against the wall beside the outer
// gate with its lever; everything else lives in the bands either side of the passage
function castleGatehouse(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, cells = ccmCells(ctx);
  let a, b;
  if (ctx.doors.length >= 2) { let best = -1; for (const x of ctx.doors) for (const y of ctx.doors) { const dd = Math.hypot(x.inner[0] - y.inner[0], x.inner[1] - y.inner[1]); if (dd > best) { best = dd; a = x.inner; b = y.inner; } } }
  if ((!a || Math.hypot(a[0] - b[0], a[1] - b[1]) < 8) && d) { a = d.inner; b = ctx.sidePoint(OPP_SIDE[d.side], d.tc, 1.6); } // (one gate, or two doors in the same corner: the line runs from the gate to the wall facing it)
  if (!a) return { fail: 'gatehouse has no gate' };
  const acrossW = d.side === 'N' || d.side === 'S' ? ctx.W : ctx.D, width = Math.max(4, Math.min(10, acrossW - 7));
  const path = ctx.walk('through', [a, b], { width });
  if (!path.ok) return { fail: 'gatehouse: the through-line from gate to gate is blocked' };
  // the worn way from gate to gate, on the floor (with nothing on the floor to say "through", two barred gates were a cell)
  if (ccmHas(ctx, 'decal-path-worn')) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2, n = Math.max(1, Math.round(len / 5.2)); /* (the decal's long side is its width) */ for (let i = 0; i < n; i++) castleRug(ctx, 'decal-path-worn', a[0] + (b[0] - a[0]) * (i + 0.5) / n, a[1] + (b[1] - a[1]) * (i + 0.5) / n, rot, {}, 'the worn way from gate to gate'); }
  const sides = d ? [d.side, ...ccmLat(d.side)] : ['N', 'S', 'E', 'W'], lat = d ? ccmLat(d.side) : ['W', 'E'];
  const windlass = ccmQuiet(ctx, () => ctx.put('windlass', (dm) => ctx.wallGen(dm, sides), (c) => Math.hypot(c.x - d.inner[0], c.z - d.inner[1]) + (c.side === d.side ? 0 : 2), { layer: 'anchor', rule: 'key-windlass', why: 'the windlass: against the wall beside the outer gate', unique: true }));
  if (windlass) ccmQuiet(ctx, () => ctx.mount('lever-wall', { sides: [windlass.side], height: 5.2, why: 'the gate lever, by the windlass' }));
  // the bands either side: the guard table on one, fire and arms on the other
  const band = lat[ctx.ri(0, 1)], other = OPP_SIDE[band];
  // (the guard table only from 30 cells: with a table, a stool and dice the blind reads called every gatehouse a guardroom)
  const table = cells < 30 ? null : ccmQuiet(ctx, () => ctx.put('table-square', (dm) => ctx.wallGen(dm, [band], { gap: 1.2 }), (c) => Math.abs(c.t - ctx.sideLen(band) / 2), { rule: 'guard-table', why: 'the guard table, in the band beside the passage' }));
  if (table) { ccmQuiet(ctx, () => ctx.free(ccmAny(ctx, ['stool-three-leg', 'bench-long']), { near: [table.x, table.z], radius: 2.8, margin: 0.3, face: [table.x, table.z], rule: 'seat', why: 'a seat at the guard table' })); for (const id of ['mil-guard-lantern', 'dice-and-cup']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'mil-guard-lantern' ? 'light' : 'dress', why: 'on the guard table' })); }
  ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['brazier-large', 'fire-basket-stand', 'brazier-standing']), { sides: [other], prefer: 'center', layer: 'light', gap: 0.6, why: 'a fire in the band beside the passage' }));
  // (under 24 cells: no arms at all. Racks, a spear tripod, a pavise and pegs made every small gatehouse "a castle guardroom or armory")
  const arms = (cells >= 24 ? ['mil-spear-tripod', 'arrow-barrel', 'mil-pavise', 'arrow-barrel', 'weapon-rack', 'armor-stand'] : []).filter(i => ccmHas(ctx, i));
  for (let k = 0, n = Math.min(arms.length, Math.max(2, Math.round(cells / 4))); k < n; k++) ccmQuiet(ctx, () => ctx.wall(arms[k], { sides: [k % 2 ? band : other, k % 2 ? other : band], layer: 'store', why: 'arms in the band beside the passage' }));
  if (Math.min(ctx.W, ctx.D) >= 14) ccmCorner(ctx, 'mil-boiling-oil-pot', [d.side, other], { why: 'the oil pot in the corner by the outer gate', layer: 'anchor', inset: 0.6 });
  castleHang(ctx, cells >= 24 ? ['mil-crossbow-rack', 'mil-helmet-peg-rack', 'horn-hunting', 'mil-duty-roster', 'heraldic-shield'] : ['heraldic-shield', 'horn-hunting'], lat, cells >= 24 ? Math.max(2, Math.round(cells / 6)) : 2, { height: 6.2, why: 'on the gatehouse wall' });
  ccmWallLights(ctx, CASTLE_TORCH, lat, { every: 18, min: 1, why: 'torch on the gatehouse wall' });
  ccmEnsureLight(ctx, CASTLE_TORCH, ['fire-basket-stand', 'brazier-standing']);
  ccmDone(ctx);
  return { feature: windlass || null, what: `a clear ${width.toFixed(0)}-ft way from gate to gate${windlass ? ', the windlass beside the outer gate' : ''}`, approach: null, passage: true };
}

// CASTLE CHAPEL: the shared chapel program. The one-step dais on the end wall with the altar on it, pews in rows facing
// it (a chapel too narrow for two blocks of 8-ft pews seats on the stone bench), font and candle rack by the door, no bier
const CASTLE_CHAPEL = {
  dais: ['dais'], altar: ['altar-stone'], altarGap: 3, aisle: 5, pitch: 5, backGap: 4, firstRow: 5, // (firstRow was 8: in a 25-ft chapel the one row then stood in the door's landing)
 
  seats: ['pew', 'bench-stone'], altarFlank: ['candelabra-standing', 'candle-tree', 'candlestick-floor'], lectern: 'lectern',
  cloth: 'rite-altar-cloth', altarLights: ['candlestick', 'candelabra'], altarThings: ['chalice-altar', 'tome-holy', 'reliquary'],
  overAltar: 'rite-sanctuary-lamp', hung: [], sconces: ['sconce-candle-triple', 'sconce-candle-single'], doorWallLights: ['torch-bracket-fine', 'torch-sconce'],
  byDoor: [['font-holy', 0], ['prayer-candle-rack', 0]],
};
function castleChapel(ctx) {
  // chapel() rolls any dais sku; the castle chapel's is the one-step 9-ft square (--s2): the wish is added for this room only
  const roll = ctx.chooseSku.bind(ctx);
  ctx.chooseSku = (id, want = {}) => roll(id, id === 'dais' && want.shape === undefined ? { ...want, shape: 's2' } : want);
  const kp = chapel(ctx, CASTLE_CHAPEL);
  delete ctx.chooseSku;
  return kp;
}

// COURTYARD (outdoor: a bailey). No walls of its own; its edge is ALWAYS the curtain wall: a section on every open grid
// edge, on the grid line, a turret where a run ends or turns (never where it meets a building), the portcullis at the
// gate. One focal thing in the open, the ways from every door to the gate kept clear, the watch by the gate, each
// door dressed by what it leads to, a training corner from 900 sq ft, siege stores at the wall. Bare: no plants, no
// inn sign, no kennel, no washing line. Runs instead of yard() (attempt(): `(KEY[key] || yard)(ctx)`).
const COURT_BY_DOOR = { 'great-hall': ['torch-stand', 'banner-pole'], 'throne-room': ['torch-stand', 'banner-pole'], chapel: ['torch-stand'], 'castle-kitchen': ['woodpile', 'barrel', 'crate', 'rain-barrel'], kitchen: ['woodpile', 'barrel', 'crate'],
  stable: ['water-trough', 'hay-bale', 'hitching-post'], barn: ['water-trough', 'hay-bale'], barracks: ['weapon-rack', 'mil-shield-stack'], armoury: ['arrow-barrel', 'mil-shield-stack'], gatehouse: ['sentry-box', 'mil-pavise'], dungeon: ['stocks'] };
function castleCourtyard(ctx) {
  const A = ctx.area(), ALL = ['N', 'S', 'E', 'W'], cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, w = ctx.room.w, dz = ctx.room.d;
  const target = ctx.densityTarget = yardTarget(A), want = Math.max(4, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length, room = (k = 0) => count() + k < Math.round(want * 1.3);
  // --- surroundings: building-wall stretches (the rest is open), the gate, the doors
  const gate = ctx.openings.find(o => o.kind === 'gate') || null, open = gate ? gate.open : [], isOpen = (side, i) => open.some(s => s.side === side && s.index === i);
  const built = ctx.openings.filter(o => o.to && /^(wall|window|door)$/.test(o.kind)), wallFt = built.length * CELL;
  for (const s of ALL) { const n = s === 'N' || s === 'S' ? w : dz; for (let i = 0; i < n; i++) if (!built.some(o => o.side === s && o.index === i)) ctx.mounts[s].push([i * CELL - INSET, (i + 1) * CELL - INSET]); } // nothing hangs in mid-air
  const backSides = ALL.filter(s => built.some(o => o.side === s)), openSides = ALL.filter(s => open.some(o => o.side === s));
  // --- the curtain wall. Kit pieces are recorded on the grid line (outside the yard's own rect, like the yard's fence);
  // the strip of ground each covers inside the rect is blocked
  const KIT = ccmHas(ctx, 'city-wall') ? { wall: 'city-wall', post: 'city-wall-turret', fam: 'castle-rough', name: 'curtain wall' } : ccmHas(ctx, 'wall-crenellated') ? { wall: 'wall-crenellated', post: 'wall-crenellated-corner', fam: 'dressed-stone', name: 'crenellated wall' } : null;
  const gx0 = ctx.X0 - INSET, gz0 = ctx.Z0 - INSET, len = (s) => s === 'N' || s === 'S' ? w : dz;
  const segAt = (side, t) => side === 'N' ? [gx0 + t, gz0] : side === 'S' ? [gx0 + t, gz0 + dz * CELL] : side === 'W' ? [gx0, gz0 + t] : [gx0 + w * CELL, gz0 + t]; // a point t ft along a side, on the grid line
  const kit = (id, fam, x, z, rot, why, cover) => { const sk = ctx.skuPool(id).find(k => k.family === fam) || ctx.skuPool(id)[0]; if (!sk) return null; const dm = ctx.dims(id, sk);
    if (cover) ctx.mark(cover[0], cover[1], cover[2], cover[3]);
    return ctx.record(id, sk, dm, x, 0, z, rot, 'anchor', 'yard-edge', why); };
  let edgePieces = 0, gateSegs = new Set(), gatePiece = null;
  if (KIT && gate) {
    // the gate: the two-cell portcullis (or the timber gate, 1 in 3) across the gate's segment and an open neighbour; a
    // one-segment gap between two turrets where no neighbour is open
    const nb = [gate.index + 1, gate.index - 1].find(i => i >= 0 && i < len(gate.side) && isOpen(gate.side, i));
    const gid = nb !== undefined ? ccmFirst(ctx, ctx.roll('courtyard gate', ['portcullis', 'portcullis', 'timber gate']) === 'timber gate' ? ['gate-double-timber', 'portcullis'] : ['portcullis', 'gate-double-timber']) : null;
    gateSegs.add(`${gate.side}:${gate.index}`);
    if (gid) { gateSegs.add(`${gate.side}:${nb}`); const t = Math.max(gate.index, nb) * CELL, [x, z] = segAt(gate.side, t), [mx, mz] = ctx.sidePoint(gate.side, t - INSET, 0.5), ns = gate.side === 'N' || gate.side === 'S'; gatePiece = kit(gid, KIT.fam, x, z, SIDES[gate.side].rot, 'the gate in the curtain wall', [mx, mz, ns ? 2 * CELL : 1, ns ? 1 : 2 * CELL]); if (gatePiece) edgePieces++; }
    const [wW, wD] = (ctx.skuPool(KIT.wall).find(k => k.family === KIT.fam)?.size || ctx.lib.objects[KIT.wall].size).map(v => v / 12), inside = Math.max(0.5, wD / 2 - INSET + 0.2);
    for (const sg of open) { if (gateSegs.has(`${sg.side}:${sg.index}`)) continue;
      const t = sg.index * CELL + CELL / 2, [x, z] = segAt(sg.side, t), [mx, mz] = ctx.sidePoint(sg.side, t - INSET, inside / 2), ns = sg.side === 'N' || sg.side === 'S';
      if (kit(KIT.wall, KIT.fam, x, z, SIDES[sg.side].rot, 'the curtain wall: a section on every open edge', [mx, mz, ns ? CELL : inside, ns ? inside : CELL])) edgePieces++; }
    // turrets: grid vertices where the wall turns, or ends in the open (beside the gate gap, or against another yard)
    if (ccmHas(ctx, KIT.post)) { const V = new Map(), touch = (vx, vz, what, side) => { const k = `${vx}:${vz}`, v = V.get(k) || { vx, vz, sides: new Set(), n: 0, built: 0, gate: 0 }; if (what === 'open') { v.sides.add(side); v.n++; } else if (what === 'gate') { v.sides.add(side); v.gate++; } else v.built++; V.set(k, v); };
      const ends = (side, i) => side === 'N' ? [[i, 0], [i + 1, 0]] : side === 'S' ? [[i, dz], [i + 1, dz]] : side === 'W' ? [[0, i], [0, i + 1]] : [[w, i], [w, i + 1]];
      for (const sg of open) for (const [vx, vz] of ends(sg.side, sg.index)) touch(vx, vz, gateSegs.has(`${sg.side}:${sg.index}`) ? 'gate' : 'open', sg.side);
      for (const o of built) for (const [vx, vz] of ends(o.side, o.index)) touch(vx, vz, 'built');
      const [pW] = ccmSize(ctx, KIT.post), half = pW / 2;
      for (const v of V.values()) {
        if (v.built || !v.n) continue;                              // it meets a building there, or only the gate touches it
        const turns = v.sides.size > 1, ends1 = v.n === 1 && (!v.gate || !gatePiece); // a run's last section: in the open, or at a gate that is only a gap
        if (!turns && !ends1) continue;                             // (mid-run, or the run meets the gate piece)
        const x = gx0 + v.vx * CELL, z = gz0 + v.vz * CELL, mx = Math.max(ctx.X0 + half / 2, Math.min(ctx.X1 - half / 2, x)), mz = Math.max(ctx.Z0 + half / 2, Math.min(ctx.Z1 - half / 2, z));
        if (kit(KIT.post, KIT.fam, x, z, 0, 'a turret where the curtain wall turns or ends', [mx, mz, half, half])) edgePieces++; } }
  }
  // --- the gate's inside point and the doors' (Ctx2 already keeps a landing clear inside each door)
  const gateT = gate ? (gatePiece ? Math.max(...[...gateSegs].map(k => +k.split(':')[1])) * CELL - INSET : gate.index * CELL - INSET + CELL / 2) : 0, gatePt = gate ? ctx.sidePoint(gate.side, gateT, 2.6) : null;
  if (gate) ctx.keepClear(gate.side, gateT, gatePiece ? 10.5 : 5.5, 4.5);
  // --- ONE focal thing in the open, before the paths (the path bends round it): the well, 2 in 3, else the stone trough
  let focal = null;
  if (Math.min(ctx.W, ctx.D) >= YARD.focalMin && A >= YARD.focalArea) {
    const ids = ctx.roll('courtyard focal', ['well', 'well', 'trough']) === 'trough' ? ['horse-trough-stone', 'well'] : ['well', 'horse-trough-stone'], md = ctx.mainDoor;
    for (const id of ids) { if (focal || !ccmHas(ctx, id)) continue;
      focal = ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (let x = ctx.X0 + 5; x <= ctx.X1 - 5; x += 1) for (let z = ctx.Z0 + 5; z <= ctx.Z1 - 5; z += 1) yield { x, z, rot: 0 }; }, (c) => Math.hypot(c.x - cx, c.z - cz) + (md && gatePt ? Math.max(0, 6 - segDist([c.x, c.z], md.inner, gatePt)) * 4 : 0), { layer: 'anchor', rule: 'yard-focal', why: `the ${id === 'well' ? 'well' : 'trough'}: the one thing in the open, clear of the way to the gate`, sku: id === 'well' ? { shape: '' } : {} })); }
    if (focal) ccmClearRound(ctx, focal, 1.5);
  }
  // --- the ways: every door to the gate (a closed court: door to door), 4 ft wide, reserved before anything gathers
  if (gatePt) for (const o of ctx.doors) ccmWalk(ctx, 'path', [o.inner, gatePt], { width: YARD.path });
  else for (let i = 1; i < ctx.doors.length; i++) ccmWalk(ctx, 'path', [ctx.doors[0].inner, ctx.doors[i].inner], { width: YARD.path });
  const AT = 1.25; // things "at the wall" stand clear of the strip the curtain wall covers
  const atWall = (id, sides, near, why, layer = 'furnish', rule = 'at-wall') => ccmHas(ctx, id) && sides.length ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap: AT, windows: false }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 20, { layer, rule, why })) : null;
  // --- the watch by the gate: sentry box one side, a fire the other, a banner, the watch lantern
  const things = [];
  if (gate) { const gs = [gate.side], pt = (k) => ctx.sidePoint(gate.side, gateT + k, 2.5);
    for (const [id, k, layer] of [['sentry-box', -9, 'furnish'], [ccmFirst(ctx, A >= 1500 ? ['mil-signal-beacon', 'brazier-large'] : ['brazier-large', 'fire-basket-stand', 'brazier-standing']), 9, 'light'], ['banner-pole', -13, 'furnish'], ['watch-lantern-bell', 13, 'light']]) if (id && room()) { const p = atWall(id, gs, pt(k), 'the watch by the gate', layer, 'by-gate'); if (p && Math.hypot(p.x - pt(k)[0], p.z - pt(k)[1]) < 14) things.push(p); } }
  // --- beside each door, by what the door leads to (against the building's own wall), and a torch on that wall
  const doorInfo = [];
  for (const o of ctx.openings.filter(o => o.kind === 'door' && !o.part && o.to)) {
    const type = ctx.typesOf?.(o.to) || '', t = o.index * CELL - INSET + (o.span || 1) * CELL / 2, here = ctx.sidePoint(o.side, t, 1), put = [];
    for (const id of (COURT_BY_DOOR[type] || []).slice(0, 3)) if (room()) { const p = ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [o.side], { gap: 0.25, windows: false }), (c) => Math.abs(Math.hypot(c.x - here[0], c.z - here[1]) - 5), { layer: /torch|brazier/.test(id) ? 'light' : 'furnish', rule: 'by-door', why: `by the ${type} door` })) : null; if (p && Math.hypot(p.x - here[0], p.z - here[1]) < 16) put.push(p.id); }
    if (ccmQuiet(ctx, () => ctx.mount(ccmFirst(ctx, ['torch-bracket-rough', 'torch-sconce']), { sides: [o.side], height: 6, layer: 'light', rule: 'yard-light', why: 'a torch on the building wall' }))) put.push('torch');
    doorInfo.push({ to: o.to, side: o.side, things: put });
  }
  // --- the training corner (from 900 sq ft): the corner farthest from the gate. Dummies and a pell in a line, butts
  // against the wall with the range before them kept clear, the practice weapons at the wall
  let training = 0;
  if (A >= 900) { const ref = gatePt || (ctx.mainDoor ? ctx.mainDoor.inner : [ctx.X0, ctx.Z0]), corners = [['N', 'W'], ['N', 'E'], ['S', 'W'], ['S', 'E']].map(([a, b]) => ({ a, b, x: b === 'W' ? ctx.X0 : ctx.X1, z: a === 'N' ? ctx.Z0 : ctx.Z1 })).sort((p, q) => Math.hypot(q.x - ref[0], q.z - ref[1]) - Math.hypot(p.x - ref[0], p.z - ref[1]));
    const c = corners[0], sx = c.b === 'W' ? 1 : -1, sz = c.a === 'N' ? 1 : -1;
    for (let k = 0; k < 2; k++) { const butt = ccmHas(ctx, 'archery-target') ? ccmQuiet(ctx, () => ctx.put('archery-target', (dm) => ctx.wallGen(dm, [c.a], { gap: AT, windows: false }), (q) => Math.abs(Math.abs(q.x - c.x) - (5 + k * 5)), { rule: 'training', why: 'an archery butt against the wall, the range before it clear' })) : null;
      if (butt) { training++; const range = Math.min(25, ctx.D - 12); ctx.mark(butt.x, butt.z + sz * (butt.dims[2] / 2 + range / 2), 3.5, range, KEEP); } }
    for (let k = 0; k < 3; k++) { const id = k === 2 ? 'mil-pell' : 'training-dummy'; if (ccmQuiet(ctx, () => ccmAt(ctx, id, [c.x + sx * (16 + k * 6), c.z + sz * 8, sz > 0 ? 0 : Math.PI], { rule: 'training', why: 'the training line: dummies and a pell 6 ft apart' }))) training++; }
    for (const id of ['mil-wasters-rack', 'weapon-rack', 'arrow-barrel']) if (atWall(id, [c.b], [c.x, c.z + sz * 12], 'practice arms at the wall by the training corner', 'store', 'training')) training++;
  }
  // --- siege stores and yard work at the wall, toward the target (a bailey is sparse: the middle stays open)
  const wallSides = [...openSides, ...backSides].filter((s, i, a) => a.indexOf(s) === i);
  for (const id of ctx.shuffle(['stone-blocks-stack', 'mil-catapult-stones', 'grindstone', 'stocks', 'sawhorse', 'mil-shield-stack', 'mil-pavise', 'cart-hand', 'arrow-barrel'])) { if (count() >= want) break; atWall(id, ctx.shuffle(wallSides), null, 'at the wall'); }
  if (A >= 1500 && gatePt) atWall('ballista', [gate.side], ctx.sidePoint(gate.side, gateT + 18, 3), 'a ballista near the gate', 'anchor');
  if (!ccmLit(ctx)) for (const id of ['torch-stand', 'fire-basket-stand', 'brazier-standing']) if (!ccmLit(ctx)) atWall(id, ctx.shuffle(ALL), null, 'a light in the bailey', 'light'); // (never in the gateway: no allowKeep)
  ctx.yardInfo = { vibe: 'castle courtyard', edge: KIT && gate ? KIT.name : 'none', edgePieces, wallFt, gate: gate ? gate.side : null, focal: focal ? { id: focal.id, kind: focal.id === 'well' ? 'well' : 'trough' } : null, signs: 0, wear: 0, doors: doorInfo, training, plants: { placed: 0, slot: [], waiting: [] } };
  ccmDone(ctx);
  return { feature: focal, what: `castle courtyard: ${KIT && gate ? `${KIT.name} all round, ${gatePiece ? gatePiece.id.replace(/-/g, ' ') : 'a gap'} at the gate` : 'a closed court'}${focal ? `, the ${ctx.yardInfo.focal.kind} in the open` : ''}${training ? ', a training corner' : ''}`, outdoor: true };
}

// the leg of an L-shaped castle room (ccmAnnex): more of the same walls, never a second dais, throne, hearth or cell
function castleAnnex(ctx, { wall = [], hung = [], lights = CASTLE_TORCH, floor = [], height = 6 } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']), n = Math.max(1, Math.round(ctx.area() / 110));
  if (wall.length) ccmAlong(ctx, wall, sides, n, { why: 'against the wall' });
  for (const id of floor.slice(0, n)) ccmQuiet(ctx, () => ctx.wall(id, { sides, layer: 'furnish', why: 'against the wall' }));
  castleHang(ctx, hung, sides, n + 1, { height, why: 'on the wall' });
  ccmWallLights(ctx, lights, sides, { every: 26, min: 1, why: 'wall torch' });
  ccmEnsureLight(ctx, CASTLE_TORCH, ['torch-stand', 'brazier-standing']);
}

// ---- castle: hooks into the dispatcher ----
// CASTLE KITCHEN = the inn's kitchen program whole (cooking lines, bake corners, work rows, the fill), in castle walls.
// It is NOT run through PROGRAM_OF: castle room types prefer tier 'castle' meshes, and KEY.kitchen asks for its hearth
// by role, so every cooking line would roll the 11-ft great hearth and a kitchen with no 11-ft run of wall would have
// none. Here the FIRST cooking line is the great hearth when a wall has a clear 12-ft run, every later one the inn's;
// the 10-ft great prep table only in an industrial kitchen (from 700 sq ft). Menus and the kitchen fill are the inn's.
function castleKitchen(ctx) {
  const roll = ctx.chooseSku.bind(ctx), run = (s) => { let best = 0, t = 0; for (const [a, b] of [...ctx.doorT[s], ...ctx.windowT[s]].sort((x, y) => x[0] - y[0])) { best = Math.max(best, a - t); t = Math.max(t, b); } return Math.max(best, ctx.sideLen(s) - t); };
  let great = ['N', 'S', 'E', 'W'].some(s => run(s) >= 12.5) && ctx.area() >= 500;
  ctx.chooseSku = (id, want = {}) => {
    if (id === 'cook-hearth-spit' && want.shape === undefined && want.tiers === undefined) { const w2 = great ? { ...want, shape: 'great' } : { ...want, tiers: [] }; great = false; return roll(id, w2); }
    if (id === 'table-kitchen-prep' && want.tiers === undefined && ctx.area() < 700) return roll(id, { ...want, tiers: [] });
    return roll(id, want);
  };
  const kp = KEY.kitchen(ctx);
  delete ctx.chooseSku;
  if (!kp?.fail) {
    // the service triangle is walked (and so kept clear) BEFORE the castle's pieces go down; attempt() walks it again for the record
    if (kp.triangle) { const n = ctx.paths.length, m = ctx.notes.length; ctx.walk('service', kp.triangle); if (kp.guest) ctx.walk('service', [kp.guest.inner, kp.triangle[1]]); ctx.paths.length = n; ctx.notes.length = m; }
    castleKitchenWorks(ctx);
  }
  return kp;
}
// What the castle adds to the inn's cooking triangle, before the zones (blind reads, 2026-10-06: the inn's kitchen alone in
// a 750-sq-ft room was named a workshop or a storeroom: four larder corners of sacks and baskets, and the bread oven is
// taken for a bellows). The cauldron on its crane in the open before the great hearth, the 10-ft table as the work row
// across the middle with the roast on it, the pig on its spit at the table's end, hams on the hook rail over the table,
// cupboards on the walls. Nothing here stands in an aisle or a working face: those are kept by the inn's program.
function castleKitchenWorks(ctx) {
  const hearth = ctx.placements.find(p => p.sku === 'cook-hearth-spit--great') || ctx.placements.find(p => p.id === 'cook-hearth-spit');
  if (!hearth) return;
  const box = [ctx.X0 + 1.5, ctx.Z0 + 1.5, ctx.X1 - 1.5, ctx.Z1 - 1.5], [fx, fz] = ctx.facingVec(hearth.rot), lx = fz, lz = -fx, near = (pt) => (c) => Math.hypot(c.x - pt[0], c.z - pt[1]);
  const open = (id, pt, rots, o = {}) => ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.rectGen(dm, box, rots, 1), near(pt), { layer: o.layer || 'furnish', rule: o.rule || 'castle-kitchen', why: o.why || '', sku: o.sku, failWhy: 'no room in the open floor' })) : null;
  const house = ctx.type.key === 'mansion-kitchen'; // (a house kitchen: no cauldron on a crane and no second chopping block. With them the mansion's was "an alchemist's workshop" 8 times in 8)
  const crane = house ? null : open('cauldron-crane', front(hearth, 6.5), [hearth.rot], { layer: 'light', rule: 'key-crane', why: 'the cauldron on its crane: in the open before the great hearth' });
  let table = ctx.area() >= 450 ? open('table-kitchen-prep', front(hearth, 12.5), [hearth.rot], { sku: { shape: 'great' }, layer: 'anchor', rule: 'work-row', why: 'the long work table: across the middle, parallel to the hearth' }) : null;
  table = table || ctx.placements.find(p => p.id === 'table-kitchen-prep') || null;
  if (table) {
    for (const id of ['roast-pig', 'fish-kettle', ...ctx.pick(['pie-meat', 'bread-loaf', 'bread-long-loaf', 'cabbage-single', 'cheese-wheel-cut', 'sausage-link', 'plate-roast-veg', 'pot-copper'], 4), ...ctx.pick(KITCHEN_WORK, 3)]) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, why: 'on the work table' }));
    const [tx, tz] = [Math.sin(table.rot + Math.PI / 2), Math.cos(table.rot + Math.PI / 2)], end = (sg, e) => [table.x + tx * sg * (table.dims[0] / 2 + e), table.z + tz * sg * (table.dims[0] / 2 + e)];
    const sg = ctx.chance(0.5) ? 1 : -1;
    open('pig-on-spit', end(sg, 4), [table.rot + Math.PI / 2, table.rot], { layer: 'light', rule: 'row-end', why: 'the pig on its spit: at the end of the work table' });
    if (!house) open('chopping-block-kitchen', end(-sg, 2), [table.rot], { rule: 'row-end', why: 'the chopping block at the other end of the table' });
    const inRoom = (x, z, m) => [Math.max(ctx.X0 + m, Math.min(ctx.X1 - m, x)), Math.max(ctx.Z0 + m, Math.min(ctx.Z1 - m, z))]; // (what hangs stays inside the walls, whatever the table's place)
    if (ccmHas(ctx, 'trade-butcher-hooks-rail')) ccmQuiet(ctx, () => ctx.ceiling('trade-butcher-hooks-rail', { at: inRoom(table.x - tx * sg * 2.5, table.z - tz * sg * 2.5, 3.2), layer: 'dress', why: 'the hook rail over the work table' }));
    for (const e of [1.5, -4.5]) if (ccmHas(ctx, 'ham-hanging')) ccmQuiet(ctx, () => ctx.ceiling('ham-hanging', { at: inRoom(table.x + tx * sg * e, table.z + tz * sg * e, 1.2), layer: 'dress', why: 'a ham hung over the work table' }));
  } else if (!crane && !house) open('pig-on-spit', front(hearth, 7), [hearth.rot], { layer: 'light', rule: 'row-end', why: 'the pig on its spit before the hearth' });
  ccmAlong(ctx, ['cupboard'], ['N', 'S', 'E', 'W'].filter(s => s !== hearth.side), ctx.area() >= 600 ? 3 : 2, { why: 'a cupboard of plate and pots on the wall', layer: 'store' });
  ctx.castleKitchenInfo = { crane: !!crane, table: table?.sku || null };
}
// the castle kitchen's fill: the inn's hung racks (half as many), the tables dressed with work in progress, one stack in a
// corner. Not the inn's larder runs along every free wall: sacks, baskets and barrels in number made the room a storeroom.
function castleKitchenFill(ctx) {
  const per = Math.max(3, Math.round((ctx.W + ctx.D) / 5));
  for (let k = 0, miss = 0; k < per && miss < 6; k++) { const id = ['utensil-rack-wall', 'knife-rack-wall', 'pot-hook-chain', 'garlic-braid', 'utensil-rack-wall', 'dish-rag-hanging'][k % 6]; if (!ctx.has(id) || !ccmQuiet(ctx, () => ctx.mount(id, { why: 'hung on a free run of wall', height: k % 2 ? 5.6 : 6.2 }))) miss++; }
  ccmQuiet(ctx, () => ctx.cornerPile(['barrel', 'sack', 'flour-sack-open', 'barrel'], 3, { why: 'a stack in the corner' }));
  for (const s of ctx.surfaces) { const want = /^table/.test(s.id) ? 8 : /^(chopping|counter|cupboard)/.test(s.id) ? 2 : 0; for (let i = s.items.length, tries = 0; i < want && tries < want + 3; tries++) if (ctx.surface(ctx.pick(KITCHEN_WORK)[0], { on: x => x === s, why: 'work in progress' })) i++; }
  ctx.unplaced = ctx.unplaced.filter(u => !/no room on the chosen surface|no bare wall|every corner already full|no free surface/.test(u.why));
}
Object.assign(KEY, { 'great-hall': castleGreatHall, 'throne-room': castleThrone, 'armoury': castleArmoury, 'barracks': castleBarracks, 'dungeon': castleDungeon, 'gatehouse': castleGatehouse, 'chapel': castleChapel, 'castle-kitchen': castleKitchen,
  'courtyard': castleCourtyard }); // (outdoor: needs the scope-castle hook in attempt(), `(KEY[key] || yard)(ctx)`)
Object.assign(MENUS, {
  // the inn's scullery, ONE larder corner and its serving pass (no bake corner: the bread oven reads as a bellows from above,
  // and the room as a forge; no prep island or staff table: the work row is laid by castleKitchenWorks), then the castle's own fill
  'castle-kitchen': [...MENUS.kitchen.filter(m => ['wash', 'larder', 'pass'].includes(m.kind)).map(m => ({ ...m, repeat: 1, per: undefined })), { kind: 'kitchen-fill', label: 'kitchen fill', size: [1, 1], minArea: 0, repeat: 1, quiet: true, pref: (ctx, r) => Math.hypot(r[0] - ctx.X0, r[1] - ctx.Z0), fill: (ctx) => castleKitchenFill(ctx) }],
  'great-hall': ccmAnnex((ctx) => castleAnnex(ctx, { wall: ['bench-long'], hung: ['banner-wall', 'tapestry', 'shield-display', 'trophy-head'], lights: CASTLE_TORCH_FINE })),
  'throne-room': ccmAnnex((ctx) => castleAnnex(ctx, { wall: ['armor-stand'], hung: ['banner-wall', 'tapestry'], lights: CASTLE_TORCH_FINE })),
  'armoury': ccmAnnex((ctx) => castleAnnex(ctx, { wall: ['weapon-rack', 'armor-stand'], floor: ['arrow-barrel', 'mil-shield-stack'], hung: ['mil-crossbow-rack', 'smith-helm-row-shelf'] })),
  'barracks': ccmAnnex((ctx) => castleAnnex(ctx, { wall: ['weapon-rack'], floor: ['mil-footlocker', 'mil-shield-stack', 'chest-plain'], hung: ['mil-helmet-peg-rack', 'smith-helm-row-shelf'] })),
  'dungeon': ccmAnnex((ctx) => castleAnnex(ctx, { floor: ['stocks', 'bucket-slop', 'chest-ironbound'], hung: ['manacles-wall'], height: 4.2 })),
  'gatehouse': ccmAnnex((ctx) => castleAnnex(ctx, { wall: ['weapon-rack'], floor: ['arrow-barrel', 'mil-pavise'], hung: ['mil-crossbow-rack', 'mil-helmet-peg-rack'] })),
  'chapel': ccmAnnex((ctx) => castleAnnex(ctx, { wall: ['bench-stone'], floor: ['prayer-candle-rack'], hung: [], lights: ['sconce-candle-triple', 'torch-bracket-fine', 'torch-sconce'] })),
});
// (no DENSITY line for the courtyard: yard() sets its own tapering target, and test/yard.test.mjs holds the yard's 2 to
// 0.6x of every OTHER entry in this table. No indoor target here is under 3.5 for the same reason.)
Object.assign(DENSITY, { 'great-hall': 4.5, 'throne-room': 3.5, 'armoury': 5, 'barracks': 5, 'dungeon': 4, 'gatehouse': 4, 'chapel': 5, 'castle-kitchen': 10 });
Object.assign(FOCAL, { 'great-hall': 'high table on the dais (short wall facing the door)', 'throne-room': 'throne on the dais', 'armoury': 'the tall weapon rack', 'dungeon': 'iron maiden (when the wall facing the door is free)', 'chapel': 'altar on the dais (end wall)' });
Object.assign(KEY_RE, { 'great-hall': /^(table-feast|table-trestle)$/, 'throne-room': /^throne$/, 'armoury': /^(weapon-rack|armor-stand)$/, 'barracks': /^(bunk-bed|cot)$/, 'dungeon': /^(rack-torture|iron-maiden|cell-bars|door-cell-bars)/,
  'gatehouse': /^windlass$/, 'chapel': /^altar-stone$/, 'castle-kitchen': /^cook-hearth/, 'courtyard': null });
