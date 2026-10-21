// ======================= temple & chapel (2026-10-11) =======================
// Ten room types (walls.js: the appended tem:walls block). The architecture and the furniture are flavor-NEUTRAL; every
// piece of iconography is one of six SLOT roles, `flavor-*` (catalog/objects-flavor.catalog.md, shared with the cult
// sanctum), whose skus are named for the flavor: `flavor-idol--sun`, `--moon`, `--devils`, `--spiders` ...
//   slot 1  flavor-altarpiece   on the altar, centred
//   slot 2  flavor-idol         the large statue: on the dais behind the altar, or the focus of a shrine
//   slot 3  flavor-banner       flat hangings on the side walls
//   slot 4  flavor-relief       wall medallion (stands in for a window motif)
//   slot 5  flavor-sigil        flat floor emblem: before the altar, in the chancel, under a shrine
//   slot 6  flavor-censer       floor candle-holder: the pair flanking the altar or the idol
//   slot 7  flavor-sculpture    a second showpiece that is not the idol: the door end of a nave, the head of a side aisle, a cloister
//   slot 8  flavor-buttress     a flying buttress in the flavor's motif (the vertical kit's `buttress` box): along the walls INSIDE a cathedral
// WHICH FLAVOR: the shared rule of the flavor block (flavorOf, written with the cult sanctum: `types:flavor` in this file)
// when it is here: room.flavor (the hook for Harry's flavor system), opts.flavor (the tuner's ?flavor=moon), the room's
// building, else the first of the room type's `flavors` (rooms.json) that has an idol. Until that block lands, the same
// rule without the building. A slot the flavor has no piece for is left empty; flavors are never mixed in one room.
const TEM_ALL = ['sun', 'moon', 'nature', 'sword-shield', 'devils', 'spiders', 'dragons', 'skulls', 'tentacles'];
function temFlavor(ctx) {
  const list = ctx.type.flavors || [];
  if (typeof flavorOf === 'function') return flavorOf(ctx, list);
  const ask = ctx.room.flavor || ctx.opts.flavor;
  if (ask && TEM_ALL.includes(ask)) return ask;
  return list.find(f => ctx.lib.objects['flavor-idol']?.skus.some(k => k.shape === f)) || list[0] || null;
}
// run a program with every `flavor-*` role rolled in this room's flavor only (and the one-step square dais, as the castle chapel)
function temWith(ctx, fn) {
  const f = temFlavor(ctx), roll = ctx.chooseSku, has0 = ctx.has;
  ctx.chooseSku = function (id, want = {}) {
    if (id === 'dais' && want.shape === undefined) return roll.call(this, id, { ...want, shape: 's2' });
    if (!/^flavor-/.test(id)) return roll.call(this, id, want);
    const sku = f ? roll.call(this, id, { ...want, shape: f }) : null;
    return sku && sku.shape === f ? sku : null;
  };
  ctx.has = function (id) { return /^flavor-/.test(id) ? !!f && !!this.lib.objects[id]?.skus.some(s => s.shape === f) : has0.call(this, id); };
  // a FLAT in the relief slot is a 34-in medallion, whatever box the role's carved tablets have
  ctx.dims = function (i, sku) { const dm = Object.getPrototypeOf(this).dims.call(this, i, sku); return i === 'flavor-relief' && sku?.kind === 'flat' ? { ...dm, w: 34 / 12, d: 0.05, h: 34 / 12 } : dm; };
  ctx.flavor = f;
  try { return fn(f); } finally { delete ctx.chooseSku; delete ctx.has; delete ctx.dims; }
}
const TEM_SCONCE = ['sconce-candle-triple', 'sconce-candle-single'], TEM_TORCH = ['torch-bracket-fine', 'torch-sconce', 'cresset-wall'];
const temRect = (ctx, far, t0, t1, s0, s1, val = KEEP) => { const [ax, az] = ctx.sidePoint(far, t0, s0), [bx, bz] = ctx.sidePoint(far, t1, s1); ctx.mark((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) || 0.1, Math.abs(bz - az) || 0.1, val); };
// ctx.dims for one call, then put back whatever was there (ccmScaled deletes the property, and with it temWith's)
function temDims(ctx, map, fn) { const own = Object.prototype.hasOwnProperty.call(ctx, 'dims'), d0 = ctx.dims; ctx.dims = function (i, sku) { return map(d0.call(this, i, sku), i, sku); }; try { return fn(); } finally { if (own) ctx.dims = d0; else delete ctx.dims; } }
const temMul = (dm, f) => ({ ...dm, w: dm.w * f, d: dm.d * f, h: dm.h * f, s: dm.s && dm.s.map(v => v * f) });
// one placement a hair under its catalog box (a 9-ft buttress under a 9-ft wall, whatever the size variety dial says)
const temUnder = (ctx, id, max, fn) => temDims(ctx, (dm, i) => i === id && dm.h > max ? temMul(dm, max / dm.h) : dm, fn);
// one placement at k times its size, inside the catalog's scale range (as ccmScaled)
const temScaled = (ctx, id, k, fn) => { const o = ctx.lib.objects[id]; return !o || k === 1 ? fn() : temDims(ctx, (dm, i) => { if (i !== id) return dm; const cat = Math.max(...o.size) / 12, big = Math.max(dm.w, dm.d, dm.h); return temMul(dm, Math.max(o.scale[0] * cat, Math.min(o.scale[1] * cat, big * k)) / big); }, fn); };
const temFace = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const temMount = (ctx, id, sides, n, height, why, layer = 'dress') => { let k = 0; for (let i = 0; i < n; i++) if (ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.mount(id, { sides: [sides[i % sides.length]], height, layer, why }))) k++; return k; };
const temWall = (ctx, ids, sides, o = {}) => { const id = Array.isArray(ids) ? ccmFirst(ctx, ids) : ccmHas(ctx, ids) ? ids : null; return id ? ccmQuiet(ctx, () => ctx.wall(id, { sides, layer: 'furnish', ...o })) : null; };
// the flat floor emblem (slot 5), `ft` feet across (the catalog lets it run 4 to 12 ft)
function temSigil(ctx, at, rot, ft, why) {
  if (!ccmHas(ctx, 'flavor-sigil')) return null;
  return temScaled(ctx, 'flavor-sigil', Math.max(0.5, Math.min(1.5, ft / 8)), () => ccmQuiet(ctx, () => ctx.rug('flavor-sigil', { at, rot, why })));
}
// what every temple room ends with: reliefs and banners (slots 4 and 3), wall lights, a light for certain
function temFinish(ctx, { relief = [], reliefN = 1, banner = [], bannerN = 0, lights = TEM_SCONCE, lightSides = ['N', 'S', 'E', 'W'], every = 13, floorLights = ['candlestick-floor', 'candle-tree'] } = {}) {
  if (relief.length) temMount(ctx, 'flavor-relief', relief, reliefN, 6.0, 'slot 4: the faith\'s medallion on the wall');
  if (banner.length) temMount(ctx, 'flavor-banner', banner, bannerN, 5.4, 'slot 3: a banner of the faith on the wall');
  ccmWallLights(ctx, lights, lightSides, { every, height: 5.8, min: 1, why: 'candle sconce on the wall' });
  ccmEnsureLight(ctx, TEM_TORCH, floorLights);
  ccmDone(ctx);
}
function temAnnex(ctx, { wall = ['bench-stone'], floor = [] } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']), n = Math.max(1, Math.round(ctx.area() / 110));
  temWith(ctx, () => { ccmAlong(ctx, wall, sides, n, { why: 'against the wall' }); for (const id of floor.slice(0, n)) temWall(ctx, id, sides, { why: 'against the wall' });
    temMount(ctx, 'flavor-relief', sides, 1, 6.0, 'slot 4: the faith\'s medallion'); ccmWallLights(ctx, TEM_SCONCE, sides, { every: 24, min: 1, why: 'candle sconce' }); ccmEnsureLight(ctx, TEM_TORCH, ['candlestick-floor', 'candle-tree']); });
}

// ---------------- NAVE (temple-nave, cathedral, cathedral-dark): the shared chapel() with the slots, scaled by size ----------------
//   chapel   under 30 ft deep: the altar on the end wall (no dais), two or three rows of seats, the idol in a corner or behind it
//   nave     from 30 ft deep: the one-step dais with the altar on it and the idol behind; from 34 ft a 9-ft chancel with
//            the sigil in its floor, a pulpit one side and the lectern the other
//   cathedral  from 34 ft across and 45 ft deep: two rows of columns (the arcade) with the seats between them and the side
//            aisles kept clear, a 15-ft chancel with choir stalls facing each other across the sigil, the organ and
//            confessionals at the door end
const TEM_NAVE = { altar: ['altar-stone'], aisle: 5, seats: ['pew', 'bench-stone'], altarFlank: ['flavor-censer', 'candelabra-standing', 'candle-tree', 'candlestick-floor'],
  altarLights: ['candlestick', 'candelabra'], altarThings: [], overAltar: 'rite-sanctuary-lamp', sconces: TEM_SCONCE, doorWallLights: TEM_TORCH };
function templeNave(ctx) { return temWith(ctx, (flavor) => {
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot;
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), aisle = TEM_NAVE.aisle, pewW = ccmSize(ctx, 'pew')[0], colW = 3.2 /* the real column is 3.1 ft across at its capital */, off = aisle / 2 + pewW + 0.7 + colW / 2;
  const big = L >= 34 && deep >= 45, mid = !big && deep >= 34 && L >= 19, useDais = deep >= 30 && L >= 14 && ccmHas(ctx, 'dais');
  const chancel = big ? 17 : mid ? 9 : deep >= 24 ? 5 : 4, altarGap = useDais ? 4.1 : deep >= 26 ? 4.1 : 1.5; // (the real moon idol is 3.7 ft deep: it stands between the wall and the altar)
  let cols = 0, organ = null, booths = 0, butts = 0, sculpt = 0;
  if (big) {
    if (ccmHas(ctx, 'pillar-round')) for (let s = 12; s <= deep - 7; s += 11) for (const sg of [-1, 1]) { const [x, z] = axis(s, L / 2 + sg * off); if (ccmQuiet(ctx, () => ccmAt(ctx, 'pillar-round', [x, z, toDoor], { layer: 'anchor', rule: 'colonnade', why: 'a column of the nave arcade: two rows, the seats between them, an aisle outside each' }))) cols++; }
    const dw = OPP_SIDE[far];
    if (ccmHas(ctx, 'organ-pipe')) organ = ccmQuiet(ctx, () => ctx.put('organ-pipe', (dm) => ctx.wallGen(dm, [dw], { gap: 0.05 }), (c) => Math.min(c.t, L - c.t), { layer: 'furnish', rule: 'organ', why: 'the organ: against the door wall, in a corner of the west end', unique: true }));
    for (const sg of [-1, 1]) { const near = axis(deep - 9, sg < 0 ? 0 : L); if (ccmHas(ctx, 'confessional') && ccmQuiet(ctx, () => ctx.put('confessional', (dm) => ctx.wallGen(dm, [lat[sg < 0 ? 0 : 1], dw], { gap: 0.05 }), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer: 'furnish', rule: 'confessional', why: 'a confessional against the aisle wall, near the door end' }))) booths++; }
    // slot 8: flying buttresses along the aisle walls, inside, one about every 20 ft (the plain kit buttress where the flavor has none)
    for (const sg of [-1, 1]) for (let s = 17.5; s <= deep - 12; s += 22) { const id = ccmFirst(ctx, ['flavor-buttress', 'buttress']), near = axis(s, sg < 0 ? 0 : L); if (id && temUnder(ctx, id, 8.98, () => ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [lat[sg < 0 ? 0 : 1]], { gap: 0.02 }), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer: 'anchor', rule: 'buttress', why: 'slot 8: a flying buttress against the aisle wall, inside' })))) butts++; }
    // slot 7: the sculpture at the head of each side aisle, facing down it
    for (const sg of [-1, 1]) { const [x, z] = axis(3.2, L / 2 + sg * (off + L / 2) / 2); if (ccmHas(ctx, 'flavor-sculpture') && ccmQuiet(ctx, () => ccmAt(ctx, 'flavor-sculpture', [[x, z, toDoor]], { layer: 'anchor', rule: 'sculpture', why: 'slot 7: the sculpture at the head of the side aisle' }))) sculpt++; }
    for (const sg of [-1, 1]) temRect(ctx, far, sg < 0 ? 0.2 : L / 2 + off, sg < 0 ? L / 2 - off : L - 0.2, 4, deep - 0.6); // the side aisles stay clear: no seats outside the columns
  }
  const tiny = !useDais && altarGap < 3; // a roadside chapel: no room to flank the altar, the idol takes one corner of the altar wall and a light the other
  const kp = chapel(ctx, { ...TEM_NAVE, ...(tiny ? { altarFlank: null } : {}), ...(useDais ? { dais: ['dais'] } : {}), altarGap, firstRow: chancel, pitch: deep >= 30 ? 4.6 : 4, backGap: deep >= 30 ? 5 : 3.5, maxRows: big ? 9 : 6,
    hung: flavor ? ['flavor-banner'] : [], hangMax: big ? 8 : 4, lectern: big || mid ? null : 'lectern', byDoor: [['font-holy', 0], ['rite-alms-box', 0], ['prayer-candle-rack', 28]] });
  if (kp.fail) return kp;
  const sideDoor = big && d && (d.side !== OPP_SIDE[far] || Math.abs(d.tc - L / 2) > 3); // (or off the axis: a door shared with a passage)
  if (sideDoor) { ctx.sight = null; ctx.sightFeature = null; } // entered from the side (a transept door): the arcade stands between the door and the altar, as it should
  const altar = kp.feature, dais = ctx.placements.find(p => p.id === 'dais') || null, base = dais || altar, frontS = (dais ? dais.dims[2] : altarGap + altar.dims[2]) + 0.05;
  // slot 1: the centrepiece on the altar (a chalice where the flavor has none)
  if (!ccmOn(ctx, 'flavor-altarpiece', altar, 0, 0.05, 'slot 1: the faith\'s emblem on the altar')) { const id = ccmAny(ctx, ['chalice-altar', 'tome-holy']); if (id) ccmOn(ctx, id, altar, 0, 0.05, 'on the altar'); }
  // slot 2: the idol behind the altar (on the dais where there is one), else in a corner of the altar wall
  let idol = null;
  if (ccmHas(ctx, 'flavor-idol')) temScaled(ctx, 'flavor-idol', dais ? 0.88 : 1, () => {
    const sk = ctx.chooseSku('flavor-idol'), dm = sk && ctx.dims('flavor-idol', sk);
    if (dm && altarGap >= 3 && dm.d + 0.2 <= altarGap && dm.h + (dais ? dais.dims[1] : 0) <= 9.0) { const [x, z] = axis(0.12 + dm.d / 2); idol = ctx.record('flavor-idol', sk, dm, x, dais ? dais.dims[1] : 0, z, toDoor, 'anchor', 'flavor-idol', 'slot 2: the idol behind the altar, against the end wall', { ...(dais ? { on: dais.uid } : {}), side: far, slot: 'idol' }); }
    else idol = ccmCorner(ctx, 'flavor-idol', [far, lat[0]], { why: 'slot 2: the idol in the corner beside the altar', inset: 0.5, layer: 'anchor' });
  });
  // slot 5: the sigil in the chancel floor, on the axis
  temSigil(ctx, axis(frontS + chancel / 2), toDoor, big ? 7.6 : mid ? 5.6 : 4, 'slot 5: the faith\'s emblem in the floor before the altar');
  // the chancel: choir stalls facing each other across the axis (cathedral), the pulpit one side and the lectern the other
  let stalls = 0;
  if (big && ccmHas(ctx, 'rite-choir-stall')) { const [sl, sd] = ccmSize(ctx, 'rite-choir-stall'); for (const sg of [-1, 1]) { const [x, z] = axis(frontS + 2 + sl / 2, L / 2 + sg * (4.2 + sd / 2)), [ax, az] = axis(frontS + 2 + sl / 2);
    if (ccmQuiet(ctx, () => ccmAt(ctx, 'rite-choir-stall', [[x, z, temFace(x, z, ax, az)]], { layer: 'furnish', rule: 'choir', why: 'choir stalls facing each other across the chancel' }))) stalls++; } }
  const beside = (id, sg) => { if (!ccmHas(ctx, id)) return null; const sk0 = ctx.skuPool(id)[0], dm0 = sk0 && ctx.dims(id, sk0), [w, dd] = dm0 ? [dm0.w, dm0.d] : ccmSize(ctx, id) /* (real meshes are stouter than their catalog lines) */, half = base.dims[0] / 2, spots = [];
    for (const [s0, lc] of [[frontS + 0.9, aisle / 2 + 4.6 + w / 2], [frontS + 10.2, aisle / 2 + 1.2 + w / 2], [frontS + 5.4, aisle / 2 + 4.6 + w / 2], [frontS + 0.9, half + 0.6 + w / 2], [frontS + 0.9, aisle / 2 + 1 + w / 2], [0.8, half + 2.6 + w / 2], [frontS + 3.5, aisle / 2 + 1 + w / 2], [frontS + 8.5, aisle / 2 + 2 + w / 2]]) { if (L / 2 - lc - w / 2 < 0.4) continue; const [x, z] = axis(s0 + dd / 2, L / 2 + sg * lc); spots.push([x, z, toDoor]); }
    return spots.length ? ccmQuiet(ctx, () => ccmAt(ctx, id, spots, { layer: 'furnish', rule: 'chancel', why: `the ${id}: at the chancel step, turned to the seats` })) : null; };
  const pulpit = big || mid ? beside('pulpit', -1) : null; if (big || mid) beside('lectern', 1);
  // slot 4: medallions on the end wall either side of the idol (one on the door wall of a small chapel)
  temMount(ctx, 'flavor-relief', L >= 19 ? [far] : [OPP_SIDE[far]], L >= 19 ? 2 : 1, 6.2, 'slot 4: the faith\'s medallion on the wall');
  if (big) for (const sg of [-1, 1]) { const id = ccmFirst(ctx, ['candle-tree', 'candelabra-standing']), [x, z] = axis(frontS + 1.2, L / 2 + sg * (off - 2.2)); if (id) ccmQuiet(ctx, () => ccmAt(ctx, id, [[x, z, toDoor]], { layer: 'light', rule: 'chancel-light', why: 'a tall light at the chancel step' })); }
  if (!big && deep >= 24 && d && ccmHas(ctx, 'flavor-sculpture') && ccmQuiet(ctx, () => ctx.wall('flavor-sculpture', { sides: [d.side], prefer: 'corner', layer: 'anchor', rule: 'sculpture', why: 'slot 7: the sculpture at the door end, in a corner' }))) sculpt++;
  ctx.templeInfo = { buttresses: butts, sculptures: sculpt, flavor, scale: big ? 'cathedral' : mid ? 'nave' : 'chapel', columns: cols, stalls, organ: !!organ, booths, dais: !!dais, idol: idol ? (idol.on ? 'dais' : idol.rule === 'corner' ? 'corner' : 'floor') : null, pulpit: !!pulpit, seats: ctx.chapelInfo?.seats || 0 };
  if (cols) ctx.growth.push(`${cols} columns in two rows`);
  // a chapel too narrow for seats either side of the aisle: benches along the side walls instead
  if (!ctx.chapelInfo?.seats) { const b = [], id = ccmFirst(ctx, ['bench-stone', 'bench-long']); for (let k = 0; id && k < 4 && b.length < (deep >= 24 ? 4 : 2); k++) { const near = axis(deep * (k < 2 ? 0.55 : 0.8), k % 2 ? L : 0), p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [lat[k % 2]], { gap: 0.05, windows: false }), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer: 'furnish', rule: 'pew', why: 'a bench along the side wall, facing the aisle (a low seat may stand under a window)' })); if (p) b.push(p); } if (ctx.chapelInfo) ctx.chapelInfo.seats = b.length; }
  if (tiny) ccmCorner(ctx, ccmFirst(ctx, ['flavor-censer', 'candelabra-standing', 'candle-tree', 'candlestick-floor']), [far, lat[1]], { why: 'slot 6: a tall light in the other corner of the altar wall', layer: 'light', inset: 0.4 });
  return { ...kp, ...(sideDoor ? { feature: null } : {}), what: `${kp.what}${cols ? `, ${cols} columns` : ''}${flavor ? `, dressed for the ${flavor}` : ''}` };
}); }

// ---------------- SHRINE / side chapel: the idol (slot 2) is the focus, facing the door ----------------
function templeShrine(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  let focus = ccmFocalOn(ctx, far, ['flavor-idol'], { label: 'idol', rule: 'key-idol', gap: 0.15, why: 'slot 2: the idol, centred on the wall facing the door' }), altar = null;
  if (!focus) focus = altar = ccmFocalOn(ctx, far, ['altar-stone'], { label: 'altar', rule: 'key-altar', gap: 0.3 });
  if (!focus) return { fail: `shrine has no idol and no altar (${ctx.focal?.why || 'no mesh'})` };
  if (d) { ctx.sight = [d.inner, [focus.x, focus.z]]; ctx.sightFeature = focus.id; }
  // (tried on 2026-10-12: a small altar before the idol. The blind judge then called the shrine a dining room; without it
  // the sun idol between its two stands is 'a sun-themed chapel' or 'a sun-themed throne room' by turns. Left as it was.)
  const fs = 0.3 + focus.dims[2];
  { const [ax, az] = axis((fs + deep) / 2), horiz = far === 'N' || far === 'S'; ctx.mark(ax, az, horiz ? 3 : deep - fs, horiz ? deep - fs : 3, KEEP); }
  if (d) { ccmWalk(ctx, 'approach', [d.inner, axis(Math.min(deep - 2, fs + 2.4))], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(deep - 2.5)]); }
  ccmFlank(ctx, focus, ['flavor-censer', 'rite-pillar-candle-tall', 'candelabra-standing', 'candlestick-floor'], { off: 0.7, why: 'slot 6: one each side of the idol' });
  if (altar) { for (const e of [-0.36, 0.36]) ccmOn(ctx, ccmFirst(ctx, ['candlestick', 'candelabra']), altar, e, 0, 'on the altar', 'light'); ccmOn(ctx, ccmFirst(ctx, ['flavor-altarpiece', 'chalice-altar']), altar, 0, 0.05, 'on the altar'); }
  const sig = Math.max(4, Math.min(8, L - 5, deep - fs - 4));
  temSigil(ctx, axis(fs + 0.8 + sig / 2), toDoor, sig, 'slot 5: the faith\'s emblem in the floor before the idol');
  // kneeling desks either side of the approach, facing the idol; cushions before it
  if (ccmHas(ctx, 'rite-prie-dieu')) { const [pw, pd] = ccmSize(ctx, 'rite-prie-dieu'); for (const sg of L >= 14 ? [-1, 1] : [1]) { const [x, z] = axis(fs + 2.2 + pd / 2, L / 2 + sg * (1.7 + pw / 2)); ccmQuiet(ctx, () => ccmAt(ctx, 'rite-prie-dieu', [[x, z, toDoor]] /* (its front is the side you kneel at: orient.json) */, { rule: 'kneeler', why: 'a kneeling desk before the idol, beside the approach' })); } }
  // the side walls: the candle rack and the sand tray near the idol, a stone bench nearer the door; the alms box by the door
  temWall(ctx, ['prayer-candle-rack', 'rite-memorial-sand-tray'], [lat[0]], { prefer: 'near', near: axis(2.5, 0), layer: 'light', why: 'offering candles against the side wall, near the idol' });
  temWall(ctx, ['rite-memorial-sand-tray', 'candle-drippings-mound'], [lat[1]], { prefer: 'near', near: axis(2.5, L), layer: 'light', why: 'memorial candles against the side wall' });
  if (deep >= 19) for (const k of [0, 1]) temWall(ctx, 'bench-stone', [lat[k]], { prefer: 'near', near: axis(deep - 5, k ? L : 0), why: 'a bench against the side wall' });
  if (d) temWall(ctx, 'rite-alms-box', [d.side, ...lat], { prefer: 'near', near: d.inner, why: 'the alms box by the door' });
  ctx.templeInfo = { flavor, focus: focus.id };
  temFinish(ctx, { banner: lat, bannerN: Math.max(2, Math.round(deep / 9)), lightSides: lat });
  if (!temMount(ctx, 'flavor-relief', [OPP_SIDE[far]], 1, 6.0, 'slot 4: the faith\'s medallion on the door wall')) temMount(ctx, 'flavor-relief', lat, 2, 6.0, 'slot 4: the faith\'s medallion on a side wall');
  return { feature: focus, what: `${altar ? 'altar' : 'idol'} facing the door${flavor ? `, dressed for the ${flavor}` : ''}`, approach: null, passage: true };
}); }

// ---------------- VESTRY: the robes on their stands along the wall facing the door, the vessels on a table ----------------
function templeVestry(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  const robe0 = ccmFocalOn(ctx, far, ['rite-vestments-stand'], { label: 'vestments', rule: 'key-vestments', gap: 0.2, why: 'the vestments on their stand: centred on the wall facing the door' });
  const robe = robe0 || temWall(ctx, 'rite-vestments-stand', [...lat, far, OPP_SIDE[far]], { layer: 'anchor', rule: 'key-vestments', why: 'the vestments on their stand, against the wall' }); // (a door in the middle of the facing wall)
  if (!robe) return { fail: `vestry has no vestments (${ctx.focal?.why || 'no mesh'})` };
  if (!robe0) ctx.focal = { label: 'vestments', id: robe.id, ok: true };
  if (d) { ctx.sight = [d.inner, [robe.x, robe.z]]; ctx.sightFeature = robe.id; }
  // (blind read: three robes in a row are a tailor's shop. ONE more at most, and the church's own things round them)
  const more = L >= 13 && robe0 ? ccmFlank(ctx, robe, ['rite-vestments-stand'], { off: 0.9, layer: 'furnish', why: 'a second set of vestments', n: 1 }) : [];
  if (robe0) ccmFlank(ctx, robe, ['rite-pillar-candle-tall', 'candlestick-floor'], { off: more.length ? 4.2 : 0.8, why: 'a tall candle each side of the vestments' });
  temWall(ctx, 'rite-prie-dieu', [lat[1], lat[0]], { prefer: 'near', near: axis(2.5, L), rule: 'kneeler', why: 'the priest\'s kneeling desk, where he prepares' });
  temWall(ctx, ['font-holy', 'washstand'], [lat[0], lat[1]], { prefer: 'near', near: axis(2.5, 0), why: 'the basin where the vessels are washed' });
  // the vesting table against a SIDE wall with the vessels on it (live blind reads, 2026-10-12: in the middle of the room,
  // before a robe on its stand, it was a lord's desk with a high-backed chair behind it)
  let table = null;
  { const id = ccmFirst(ctx, deep >= 16 ? ['table-trestle', 'table-square'] : ['table-square']); if (id) table = ccmQuiet(ctx, () => ctx.wall(id, { sides: [lat[0], lat[1]], prefer: 'near', near: axis(deep * 0.55, 0), layer: 'furnish', rule: 'vesting-table', why: 'the vesting table against the side wall' })); }
  if (table) { for (const id of ['flavor-altarpiece', 'chalice-altar', 'tome-holy', 'candelabra', 'reliquary']) if (ccmHas(ctx, id)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'candelabra' ? 'light' : 'dress', why: 'laid out on the vesting table' })); }
  if (d) ccmWalk(ctx, 'approach', [d.inner, axis(robe.dims[2] + 2.2)]);
  const n = Math.max(2, Math.round(ctx.area() / 60));
  ccmAlong(ctx, ['chest-plain', 'chest-ironbound', 'cupboard'], lat, n, { why: 'vestment chests and cupboards along the side walls' });
  temWall(ctx, ['scroll-rack', 'wardrobe'], [...lat, OPP_SIDE[far]], { why: 'against the wall' });
  ccmCorner(ctx, ccmFirst(ctx, ['candle-tree', 'candlestick-floor']), [far, lat[0]], { why: 'a light in the corner', layer: 'light' });
  ctx.templeInfo = { flavor, stands: 1 + more.length, table: !!table };
  temFinish(ctx, { relief: [OPP_SIDE[far]], banner: lat, bannerN: 2, lightSides: lat });
  return { feature: robe, what: `${1 + more.length} sets of vestments${table ? ', the vesting table' : ''}`, approach: null, passage: true };
}); }

// ---------------- CLOISTER WALK (the type's passage): a row of columns down one side, benches down the other ----------------
function templeCloister(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), across = Math.min(ctx.W, ctx.D), horiz = long[0] === 'N' || long[0] === 'S';
  const colSide = long.slice().sort((a, b) => ctx.doorT[a].length - ctx.doorT[b].length)[0], benchSide = OPP_SIDE[colSide], mid = (t) => ctx.sidePoint(colSide, t, across / 2);
  // the walk: a clear line down the middle from end to end, every door joined to it
  { const [mx, mz] = mid(Lr / 2); ctx.mark(mx, mz, horiz ? Lr : 3, horiz ? 3 : Lr, KEEP); }
  const ds = ctx.doors; if (ds.length >= 2) ccmWalk(ctx, 'through', [ds[0].inner, mid(Lr / 2), ds[1].inner]); else if (ds[0]) ccmWalk(ctx, 'through', [ds[0].inner, mid(Lr / 2)]);
  for (const o of ds.slice(2)) ccmWalk(ctx, 'branch', [o.inner, mid(Lr / 2)]);
  let cols = 0; const colId = ccmFirst(ctx, ['pillar-round', 'pillar-square']);
  if (colId && across >= 9) for (let t = 2.5; t <= Lr - 2.4; t += 7.5) { const [x, z] = ctx.sidePoint(colSide, t, 1.7); if (ccmQuiet(ctx, () => ccmAt(ctx, colId, [[x, z, SIDES[colSide].rot]], { layer: 'anchor', rule: 'colonnade', why: 'the cloister arcade: a row of columns down one side of the walk' }))) cols++; }
  const benches = ccmAlong(ctx, ['bench-stone'], [benchSide], Math.max(1, Math.round(Lr / 13)), { why: 'a stone bench against the wall of the walk' });
  for (const s of ctx.shortSides()) ccmCorner(ctx, ccmFirst(ctx, ['urn-decorative', 'planter-stone']), [s, benchSide], { why: 'an urn in the corner' });
  temWall(ctx, 'flavor-sculpture', [benchSide], { prefer: 'near', near: ctx.sidePoint(benchSide, Lr / 2, 0), layer: 'anchor', rule: 'sculpture', why: 'slot 7: the sculpture against the wall, half way down the walk' });
  if (across >= 13) temSigil(ctx, mid(Lr / 2), SIDES[colSide].rot, Math.min(6, across - 8), 'slot 5: the faith\'s emblem in the floor of the walk');
  const d0 = ctx.mainDoor, colsP = ctx.placements.filter(p => p.rule === 'colonnade'), key = (d0 && colsP.length ? colsP.reduce((a, b) => Math.hypot(a.x - d0.inner[0], a.z - d0.inner[1]) <= Math.hypot(b.x - d0.inner[0], b.z - d0.inner[1]) ? a : b) : colsP[0]) || benches[0] || null;
  ctx.templeInfo = { flavor, columns: cols, benches: benches.length };
  temFinish(ctx, { relief: [benchSide], reliefN: Math.max(1, Math.round(Lr / 20)), lights: TEM_TORCH, lightSides: [benchSide, ...ctx.shortSides()], every: 16, floorLights: ['torch-stand', 'candlestick-floor'] });
  return { feature: key, what: `a walk with ${cols} columns and ${benches.length} benches`, approach: null, passage: true };
}); }

// ---------------- SCRIPTORIUM: copying desks in rows facing the lectern ----------------
function templeScriptorium(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  if (!ccmHas(ctx, 'scriptorium-desk')) return { fail: 'scriptorium has no copying desk (no mesh)' };
  const lect = ccmFocalOn(ctx, far, ['lectern', 'spellbook-lectern'], { label: 'lectern', rule: 'reader', gap: 0.8, why: 'the reader\'s lectern: centred on the wall the desks face' });
  { const [ax, az] = axis((2 + deep) / 2), horiz = far === 'N' || far === 'S'; ctx.mark(ax, az, horiz ? 3 : deep - 2, horiz ? deep - 2 : 3, KEEP); }
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, axis(deep - 2.5), axis(3.6)], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(deep - 2.5)]); }
  const [, dd] = ccmSize(ctx, 'scriptorium-desk');
  const ranks = ccmRanks(ctx, { far, s0: 4.8, s1: deep - 3.6, gap: 2.4, aisle: 4, margin: 1.2, turn: Math.PI /* (a desk's front is its seat side: the scribes face the reader) */, proto: 'scriptorium-desk', choose: () => 'scriptorium-desk', rule: 'desk', layer: 'anchor', why: 'copying desks in rows, facing the reader' });
  if (!ranks.placed.length) return { fail: 'scriptorium has no room for a copying desk' };
  ctx.growth.push(`${ranks.placed.length} desks in ${ranks.rows} rows`);
  if (d) { ctx.sight = [d.inner, [ranks.placed[0].x, ranks.placed[0].z]]; ctx.sightFeature = 'scriptorium-desk'; }
  ccmAlong(ctx, ['scroll-rack', 'cupboard', 'chest-plain'], lat, Math.max(2, Math.round(deep / 6)), { why: 'scrolls and books along the side walls' });
  for (const s of lat) ccmCorner(ctx, ccmFirst(ctx, ['candle-tree', 'lamp-pole', 'candlestick-floor']), [far, s], { why: 'a tall light in the corner by the reader', layer: 'light' });
  if (lect) ccmOn(ctx, ccmFirst(ctx, ['tome-holy', 'book-open']), lect, 0, 0, 'the book being read aloud');
  ctx.templeInfo = { flavor, desks: ranks.placed.length };
  temFinish(ctx, { relief: [OPP_SIDE[far]], lightSides: lat, every: 11 });
  return { feature: ranks.placed[0], what: `${ranks.placed.length} copying desks in ${ranks.rows} rows`, approach: null, passage: true };
}); }

// ---------------- INFIRMARY: beds head to the wall down the long walls, the healer's end ----------------
function templeInfirmary(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, long = ctx.longSides(), short = ctx.shortSides(), across = Math.min(ctx.W, ctx.D), Lr = Math.max(ctx.W, ctx.D), horiz = long[0] === 'N' || long[0] === 'S';
  const bedId = ccmFirst(ctx, ['bed-single', 'cot', 'sickbed']) /* (blind reads, 2026-10-12: the cots are green-topped tables from above and the room a barracks mess; the made bed with its pillow is a bed. The real sickbed mesh is 6.5 ft square) */; if (!bedId) return { fail: 'infirmary has no bed (no mesh)' };
  const [, bd] = ccmSize(ctx, bedId), both = across >= 2 * bd + 4, walls = both ? long : [d && long.includes(OPP_SIDE[d.side]) ? OPP_SIDE[d.side] : long[0]];
  const aisleO = both ? across / 2 : (bd + across) / 2 + 0.3, dd = (sd) => d ? Math.hypot(...ctx.sidePoint(sd, across / 2, 0).map((v, i) => v - d.inner[i])) : 0, end = short.slice().sort((a, b) => ctx.doorT[a].length - ctx.doorT[b].length || dd(b) - dd(a))[0] /* the healer's end: the short wall with no door, the one farther from the way in */, endAt = (t, s) => ctx.sidePoint(end, t, s);
  { const [ax, az] = ctx.sidePoint(walls[0], Lr / 2, aisleO); ctx.mark(ax, az, horiz ? Lr : 3, horiz ? 3 : Lr, KEEP);
    for (const o of ctx.doors) { const pr = horiz ? [Math.max(ctx.X0 + 2, Math.min(ctx.X1 - 2, o.inner[0])), az] : [ax, Math.max(ctx.Z0 + 2, Math.min(ctx.Z1 - 2, o.inner[1]))]; ctx.mark((o.inner[0] + pr[0]) / 2, (o.inner[1] + pr[1]) / 2, Math.abs(o.inner[0] - pr[0]) + 3, Math.abs(o.inner[1] - pr[1]) + 3, KEEP); } }
  // the healer's end first: the drawers on the end wall, the treatment bench before them lying across the room
  const drawers = ccmFocalOn(ctx, end, ['apothecary-drawers', 'cupboard'], { label: 'drawers', rule: 'apothecary', layer: 'furnish', gap: 0.1, why: 'the apothecary\'s drawers: centred on the end wall' });
  // the treatment bench: in the MIDDLE of the ward, along the aisle, where the room is wide enough to walk past it on both
  // sides (blind reads, 2026-10-12: beds in two rows with the bench at the end were a dormitory); else before the drawers
  let bench = null, mid = across - 2 * bd >= 9.4;
  if (ccmHas(ctx, 'trade-treatment-bench') && Lr >= 20) { const [x, z] = mid ? ctx.sidePoint(walls[0], Lr / 2, aisleO) : endAt(across / 2, (drawers ? drawers.dims[2] : 0) + 4.3);
    if (mid || !ctx.doors.some(o => Math.hypot(o.inner[0] - x, o.inner[1] - z) < 9)) bench = ccmQuiet(ctx, () => ccmAt(ctx, 'trade-treatment-bench', [[x, z, SIDES[end].rot + (mid ? 0 : Math.PI / 2)]], { layer: 'anchor', rule: 'treatment', why: mid ? 'the treatment bench: in the middle of the ward, a way past it on each side' : 'the treatment bench: before the drawers, with room to work on both sides', allowKeep: true })); }
  // the healer's table by the drawers, with the basin and the tinctures on it
  let htable = null; if (ccmHas(ctx, 'table-square') && Lr >= 24) { const [x, z] = endAt(across / 2, (drawers ? drawers.dims[2] : 0) + 3.2); htable = ccmQuiet(ctx, () => ccmAt(ctx, 'table-square', [[x, z, SIDES[end].rot]], { rule: 'healer-table', why: 'the healer\'s table before the drawers', allowKeep: true })); }
  if (htable) for (const id of ['trade-fever-basin', 'trade-tincture-rack', 'mortar-pestle', 'candlestick']) if (ccmHas(ctx, id)) ccmQuiet(ctx, () => ctx.surface(id, { on: q => q.uid === htable.uid, layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the healer\'s table' }));
  if (bench) ccmClearRound(ctx, bench, 1.4);
  const beds = [];
  for (const side of walls) for (let t = 3; t <= Lr - 2.6; t += 6.5) { const b = ccmQuiet(ctx, () => ctx.put(bedId, (dm) => ctx.wallGen(dm, [side], { tRange: [t - 1.2, t + 1.2] }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'sickbed', why: 'a sickbed, head to the wall, one about every 6.5 ft: room for the healer between them' })); if (b) beds.push(b); }
  if (!beds.length) { const b = ccmQuiet(ctx, () => ctx.wall(bedId, { layer: 'anchor', rule: 'sickbed', why: 'a sickbed against the wall' })); if (b) beds.push(b); }
  if (!beds.length) return { fail: 'infirmary has no bed (no wall run clear of the doors)' };
  ctx.growth.push(`${beds.length} beds along ${walls.length === 2 ? 'both long walls' : 'one long wall'}`);
  if (d) { // the aisle walk stops short of the healer's end (the bench lies across it)
    const zone = (drawers ? drawers.dims[2] : 0) + (htable ? 3.2 + htable.dims[2] / 2 + 2 : bench && !mid ? 4.3 + bench.dims[0] / 2 + 2.2 : 2.5), ec = endAt(across / 2, 0), P = [2.5, Lr - 2.5].map(t => ctx.sidePoint(walls[0], t, aisleO)), nearEnd = Math.hypot(P[0][0] - ec[0], P[0][1] - ec[1]) < Math.hypot(P[1][0] - ec[0], P[1][1] - ec[1]) ? 0 : 1;
    P[nearEnd] = ctx.sidePoint(walls[0], nearEnd ? Lr - Math.max(2.5, zone) : Math.max(2.5, zone), aisleO);
    for (const p of P) ccmWalk(ctx, 'aisle', [d.inner, p]); }
  const key = d ? beds.reduce((a, b) => Math.hypot(a.x - d.inner[0], a.z - d.inner[1]) <= Math.hypot(b.x - d.inner[0], b.z - d.inner[1]) ? a : b) : beds[0];
  beds.forEach((b, i) => { if (ccmHas(ctx, 'stool-three-leg')) { const [fx, fz] = ctx.facingVec(b.rot), lx = fz, lz = -fx; ccmQuiet(ctx, () => ccmAt(ctx, 'stool-three-leg', [1, -1].map(sg => [b.x + lx * sg * (b.dims[0] / 2 + 0.9) - fx * (b.dims[2] / 2 - 1.2), b.z + lz * sg * (b.dims[0] / 2 + 0.9) - fz * (b.dims[2] / 2 - 1.2), b.rot]), { rule: 'bedside', why: 'a stool at the bedside' })); } });
  if (d) temWall(ctx, ['washstand', 'chest-plain'], [d.side, ...ccmLat(d.side)], { prefer: 'near', near: d.inner, why: 'a washstand by the door' });
  temMount(ctx, 'basin-stone', [end, ...long], 1, 3.2, 'a stone basin on the wall');
  for (let k = 0, n = Math.max(1, Math.round(Lr / 16)); k < n; k++) if (ccmHas(ctx, 'lantern-hanging')) ctx.ceiling('lantern-hanging', { at: ctx.sidePoint(walls[0], Lr * (k + 0.5) / n, aisleO), why: 'a lantern over the aisle' });
  ctx.templeInfo = { flavor, beds: beds.length, walls: walls.length, bench: !!bench, drawers: !!drawers };
  temFinish(ctx, { relief: [OPP_SIDE[end]], lightSides: short, every: 18 });
  return { feature: key, what: `${beds.length} sickbeds${bench ? ', the treatment bench' : ''}${drawers ? ', the apothecary\'s drawers' : ''}`, approach: null, passage: true };
}); }

// ---------------- PRIEST'S CELL: a narrow bed along the wall, a kneeling desk under the medallion, a desk ----------------
function templeCell(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  const bedId = ccmFirst(ctx, ['bed-single', 'cot', 'sickbed']); if (!bedId) return { fail: 'cell has no bed (no mesh)' };
  const bed = ccmLieAlong(ctx, bedId, [lat[0], lat[1], far], { near: axis(3, 0), layer: 'anchor', rule: 'cell-bed', why: 'the narrow bed along the wall, away from the door' });
  if (!bed) return { fail: 'cell has no room for its bed' };
  if (d) { ctx.sight = [d.inner, [bed.x, bed.z]]; ctx.sightFeature = bed.id; ccmWalk(ctx, 'approach', [d.inner, [(bed.x + (ctx.X0 + ctx.X1) / 2) / 2, (bed.z + (ctx.Z0 + ctx.Z1) / 2) / 2]]); }
  const knee = temWall(ctx, 'rite-prie-dieu', [far, lat[1]], { prefer: 'near', near: axis(0.5, L - 2.5), rule: 'kneeler', why: 'the kneeling desk against the wall, under the medallion' });
  temWall(ctx, 'desk-writing', [lat[1], OPP_SIDE[far], lat[0]], { prefer: 'near', near: axis(deep - 4, L), why: 'a small writing desk' });
  temWall(ctx, 'chest-plain', [lat[0], OPP_SIDE[far], lat[1]], { prefer: 'near', near: [bed.x, bed.z], layer: 'store', why: 'the one chest' });
  temWall(ctx, ['candlestick-floor', 'candle-tree'], [far, ...lat], { prefer: 'corner', layer: 'light', why: 'a candle' });
  if (ccmHas(ctx, 'rug-rush-mat') && L >= 9 && deep >= 9) ccmQuiet(ctx, () => ctx.rug('rug-rush-mat', { at: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], rot: toDoor, why: 'a rush mat on the floor' }));
  ctx.templeInfo = { flavor, kneeler: !!knee };
  temFinish(ctx, { relief: [knee?.side || far], lights: ['sconce-candle-single', 'sconce-candle-triple'], every: 30 });
  return { feature: bed, what: `a narrow bed${knee ? ', a kneeling desk' : ''}`, approach: null, passage: true };
}); }

// ---------------- BELL TOWER BASE: the bell in its frame in the middle of the floor ----------------
function templeBelltower(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far);
  const bell = ccmCentre(ctx, ['bell-on-frame'], { label: 'bell', rot: SIDES[far].rot, why: 'the great bell in its frame: in the middle of the floor, under the tower' });
  if (!bell) return { fail: 'bell tower has no bell (no mesh, or no room in the middle)' };
  ccmClearRound(ctx, bell, 1.3);
  if (d) { ctx.sight = [d.inner, [bell.x, bell.z]]; ctx.sightFeature = bell.id; ccmWalk(ctx, 'approach', [d.inner, front(bell, 1.5)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(bell, 1.5)]); }
  const n = Math.max(1, Math.round(ctx.area() / 120));
  ccmAlong(ctx, ['bench-long', 'chest-plain'], [far, ...lat], n + 1, { why: 'the ringers\' bench and chest against the wall' });
  for (const s of lat.slice(0, n)) ccmCorner(ctx, ccmFirst(ctx, ['barrel', 'crate']), [far, s], { why: 'stores in the corner', layer: 'store' });
  ctx.templeInfo = { flavor };
  temFinish(ctx, { relief: [far], lights: TEM_TORCH, every: 14, floorLights: ['torch-stand', 'candlestick-floor'] });
  return { feature: bell, what: 'the great bell in its frame', approach: null, passage: true };
}); }

Object.assign(KEY, { 'temple-nave': templeNave, 'temple-shrine': templeShrine, 'temple-vestry': templeVestry, 'temple-cloister': templeCloister, 'temple-scriptorium': templeScriptorium,
  'temple-infirmary': templeInfirmary, 'temple-cell': templeCell, 'temple-belltower': templeBelltower });
PROGRAM_OF['cathedral'] = 'temple-nave'; PROGRAM_OF['cathedral-dark'] = 'temple-nave'; // the same nave at another default size, and in dark walls for the evil flavors
Object.assign(MENUS, {
  'temple-nave': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-stone'], floor: ['prayer-candle-rack'] })),
  'temple-shrine': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-stone'], floor: ['prayer-candle-rack'] })),
  'temple-vestry': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['chest-plain', 'cupboard'] })),
  'temple-cloister': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-stone'] })),
  'temple-scriptorium': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['scroll-rack', 'chest-plain'] })),
  'temple-infirmary': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['chest-plain', 'cupboard'] })),
  'temple-cell': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['chest-plain'] })),
  'temple-belltower': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-long', 'chest-plain'] })),
});
Object.assign(DENSITY, { 'temple-nave': 5, 'cathedral': 4.5, 'cathedral-dark': 4.5, 'temple-shrine': 5, 'temple-vestry': 5, 'temple-cloister': 3.5, 'temple-scriptorium': 5, 'temple-infirmary': 5, 'temple-cell': 5, 'temple-belltower': 4 });
Object.assign(FOCAL, { 'temple-nave': 'altar on the end wall, the idol behind it', 'cathedral': 'altar on the dais (end wall), the idol behind it', 'cathedral-dark': 'altar on the dais (end wall), the idol behind it', 'temple-shrine': 'the idol, facing the door',
  'temple-vestry': 'vestments on their stand', 'temple-scriptorium': 'copying desks in rows', 'temple-infirmary': 'sickbeds along the long walls', 'temple-cell': 'the narrow bed', 'temple-belltower': 'the great bell' });
Object.assign(KEY_RE, { 'temple-nave': /^altar-stone$/, 'cathedral': /^altar-stone$/, 'cathedral-dark': /^altar-stone$/, 'temple-shrine': /^(flavor-idol|altar-stone)$/, 'temple-vestry': /^rite-vestments-stand$/, 'temple-cloister': null,
  'temple-scriptorium': /^scriptorium-desk$/, 'temple-infirmary': /^(sickbed|cot|bed-single)$/, 'temple-cell': /^(cot|sickbed|bed-single)$/, 'temple-belltower': /^bell-on-frame$/ });
