// >>> type:hut
// ---------------- farmstead (2026-10-11): sixteen rooms, built from the library as it stood ----------------
// The humble end of the world. No mesh of its own and no exclusive tier: every piece is one the inn, the yard, the stable
// or another type already had, so what makes a farm room is WHAT stands in it and how: an open fire in the middle of an
// earth floor, a pallet in the corner, sacks and roots, straw. Wealth: the cottage and the loft are 'poor' (straw pallet,
// three-legged stools, rushlights, the fire on the floor); the farmhouse rooms are 'common' (a bedstead, a trestle and
// benches, a hearth in the wall). room.wealth or opts.wealth ('poor' | 'common') overrides the type's.
// Animals are FIGURES (figures.json), never props: byre, sty and coop are dressed empty.
// Source of this block: experiments/2026-10-11-types/hut/integration/solver2_tail.js (apply.py puts it here whole).
const hutPoor = (ctx) => (ctx.room.wealth || ctx.opts?.wealth || ctx.type.wealth || 'common') === 'poor';
// the size a role's mesh really stands at (w across, d front to back, in feet): catalog boxes are scaled by the mesh's largest dimension, so proportions differ
const hutDims = (ctx, id) => { const k = ccmHas(ctx, id) ? ctx.skuPool(id)[0] : null; if (!k) return ccmSize(ctx, id); const dm = ctx.nominalDims(id, k); return [dm.w, dm.d, dm.h]; };
// the ground a room most likely shows (look.js floorFor's rule; the game may choose otherwise: a hint for dressing only)
const hutGround = (ctx) => { const r = ctx.room; if (r.floor && r.floor !== 'auto') return r.floor; const list = (ctx.type.floors || []).filter(f => ctx.lib.objects[f]); if (!list.length) return ''; const h = hash(r.wallSeed, 'floor'); return h % 2 === 0 ? list[0] : list[h % list.length]; };
// pieces laid edge to edge (crop rows, beds, trees on a grid) stand at their nominal size: no scale-variety roll
function hutExact(ctx, fn) { const saved = ctx.opts; ctx.opts = { ...saved, scaleVariety: 0 }; try { return fn(); } finally { ctx.opts = saved; } }
// one piece laid by measurement where pieces touch (crop patches edge to edge): recorded and marked without the grid's fit test, which sees two boxes that share an edge as overlapping
function hutLay(ctx, id, x, z, rot, layer, rule, why) { const sku = ctx.chooseSku(id); if (!sku) return null; const dm = ctx.dims(id, sku), [aw, ad] = ctx.aabb(dm.w, dm.d, rot); if (x - aw / 2 < ctx.X0 - 0.01 || x + aw / 2 > ctx.X1 + 0.01 || z - ad / 2 < ctx.Z0 - 0.01 || z + ad / 2 > ctx.Z1 + 0.01) return null; ctx.mark(x, z, aw - 0.1, ad - 0.1); return ctx.record(id, sku, dm, x, 0, z, rot, layer, rule, why); }
const HUT_LIGHT = ['rural-lantern-barn', 'rushlight-holder-wall', 'lantern-pierced-tin'];
const HUT_SACKS = ['grain-sack-open', 'barley-sack', 'rural-oat-sack', 'flour-sack-open', 'grain-sack-open', 'malt-sacks', 'beans-dried-sack', 'sack']; // (open sacks first: a shut sack reads as a bedroll from above)
// a thing against a wall (the first id that has a mesh, or a varied one with `any`): near a point, or at a fraction along
function hutWall(ctx, ids, sides, o = {}) {
  const id = Array.isArray(ids) ? (o.any ? ccmAny(ctx, ids) : ccmFirst(ctx, ids)) : (ccmHas(ctx, ids) ? ids : null); if (!id) return null;
  if (isHung(ctx.lib.objects[id], id)) return ccmQuiet(ctx, () => ctx.mount(id, { sides, height: o.height ?? 5.2, layer: o.layer || 'dress', why: o.why || '' }));
  return ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap: o.gap ?? 0.08 }), (c) => sides.indexOf(c.side) * (o.sideCost ?? 4) + (o.near ? Math.hypot(c.x - o.near[0], c.z - o.near[1]) : Math.abs(c.t - ctx.sideLen(c.side) * (o.at ?? 0.5))), { layer: o.layer || 'furnish', rule: o.rule || 'against-wall', why: o.why || '', sku: o.sku, unique: !!o.unique }));
}
const hutAt = (ctx, id, spots, o = {}) => spots.length ? mansionAt(ctx, id, spots, o) : null;
// a heap of stores in a corner: sacks, crates, barrels packed along both walls from the corner out
const hutPile = (ctx, ids, n, why) => ccmQuiet(ctx, () => ctx.cornerPile(ids.filter(i => ccmHas(ctx, i)), n, { why }));
// a thing on the floor near a point, turned any way (a stool by the fire, a bucket by the trough)
function hutNear(ctx, ids, pt, { r0 = 0, r1 = 4, why = '', layer = 'furnish', rule = 'near', face = true, rots = null, allowKeep = false } = {}) {
  const id = Array.isArray(ids) ? ccmAny(ctx, ids) : (ccmHas(ctx, ids) ? ids : null); if (!id) return null;
  return ccmQuiet(ctx, () => ctx.put(id, function* () { for (let x = pt[0] - r1; x <= pt[0] + r1 + 1e-6; x += 0.5) for (let z = pt[1] - r1; z <= pt[1] + r1 + 1e-6; z += 0.5) { const dd = Math.hypot(x - pt[0], z - pt[1]); if (dd < r0 || dd > r1) continue; for (const rot of rots || [face ? Math.atan2(pt[0] - x, pt[1] - z) : 0]) yield { x, z, rot, dd, rect: [ctx.X0 + 0.25, ctx.Z0 + 0.25, ctx.X1 - 0.25, ctx.Z1 - 0.25] }; } },
    (c) => Math.abs(c.dd - (r0 + r1) / 2) + ctx.rng() * 0.4, { layer, rule, why, allowKeep }));
}
// things on a table / chest / barrel: n picks from a list
function hutOnto(ctx, surf, ids, n, why, layer = 'dress') { if (!surf) return; for (const id of ctx.pick(ids, n)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === surf.uid, layer: /candle|lantern|rushlight|lamp/.test(id) ? 'light' : layer, why })); }
function hutLights(ctx, sides, o = {}) { return ccmWallLights(ctx, o.ids || HUT_LIGHT, sides, { every: o.every ?? 16, height: 5.6, why: o.why || 'a lantern on the wall', min: o.min ?? 1, max: o.max ?? 4 }); }
// a hub with two doors or more: attempt() walks a closed loop round its doors AFTER the furniture is down. Walk the same
// loop first, so the furniture leaves it free (and nothing is then allowed to stand on a reserved strip: hutKeep).
function hutLoop(ctx) { const pts = ctx.doors.map(o => o.inner); if (ctx.role !== 'hub' || pts.length < 2) return; const c = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2];
  ctx.walk('loop', [...pts].sort((p, q) => Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(q[1] - c[1], q[0] - c[0])), { closed: true, quietSkips: true }); }
const hutKeep = (ctx) => !(ctx.role === 'hub' && ctx.doors.length >= 2);
function hutWalks(ctx, to, kind = 'approach') { const d = ctx.mainDoor; if (!d || !to) return; ccmWalk(ctx, kind, [d.inner, to]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, to]); }
const hutFloorScatter = (ctx, n, at = null) => { for (let i = 0; i < n; i++) ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: at ? [at[0] + ctx.r(-1.5, 1.5) * i, at[1] + ctx.r(-1.5, 1.5) * i] : null, why: 'straw on the floor' })); };

// COTTAGE (hub; the one room a family lives in): the fire first. Poor: an open hearth on the floor near the middle,
// stools round it, the pot on it. Common: the hearth in the wall facing the door. The bed in the corner farthest from
// the door, head to the wall (a second pallet in a bigger room), a chest at its foot; a table with stools on the
// door's side of the fire; stores heaped in one corner; tools and pegs by the door; a shelf, strings of onions.
function hutCottage(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), poor = hutPoor(ctx), n = SIDES[far].n;
  const cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  let fire = null, open = false;
  if (poor || !ccmHas(ctx, 'fireplace-wall')) { const k = Math.min(2.5, Math.max(0, (far === 'N' || far === 'S' ? ctx.D : ctx.W) / 2 - 6.5)); // a little toward the far wall, off the doorway's landing
    fire = ccmCentre(ctx, cells >= 20 ? ['hearth-raised-square', 'hearth-central'] : ['hearth-central', 'hearth-raised-square'], { label: 'hearth', rule: 'key-hearth', off: [-n[0] * k, -n[1] * k], why: 'the open hearth: on the floor in the middle of the room, the smoke finding its own way out' }); open = !!fire; }
  if (!fire) fire = ccmFocalOn(ctx, far, ['fireplace-wall', 'cook-hearth-spit'], { label: 'hearth', rule: 'key-hearth', why: 'the hearth: centred on the wall facing the door' });
  if (!fire) return { fail: `cottage has no hearth (${ctx.focal?.why || 'no room on the floor'})` };
  if (d) { ctx.sight = [d.inner, [fire.x, fire.z]]; ctx.sightFeature = fire.id; }
  hutLoop(ctx);
  if (open) { ccmOn(ctx, ccmFirst(ctx, ['pot-iron-large', 'cooking-pot', 'stew-pot-full']), fire, 0, 0, 'the pot on the fire'); }
  else { const [fx, fz] = ctx.facingVec(fire.rot), [aw, ad] = ctx.aabb(fire.dims[0] + 0.5, 2.5, fire.rot); ctx.mark(fire.x + fx * (fire.dims[2] / 2 + 1.25), fire.z + fz * (fire.dims[2] / 2 + 1.25), aw, ad, KEEP); }
  const hearthPt = open ? [fire.x, fire.z] : front(fire, 2);
  // the bed: the far corner, on the side away from the door; head to the far wall
  const doorT = d ? (d.side === far || d.side === OPP_SIDE[far] ? d.tc : (d.side === lat[0] ? 0 : ctx.sideLen(far))) : 0, L = ctx.sideLen(far);
  const bedSide = doorT > L / 2 ? 0 : 1, corner = ctx.sidePoint(far, bedSide ? L - 1.5 : 1.5, 3);
  const bedIds = poor ? ['bed-straw-pallet', 'bedroll', 'bed-single'] : ['bed-single', 'cot', 'bed-straw-pallet'];
  const bed = hutWall(ctx, bedIds, open ? [far] : lat, { near: corner, layer: 'anchor', rule: 'key-bed', why: 'the bed: in the corner farthest from the door, head to the wall' }) || hutWall(ctx, bedIds, [far, ...lat], { near: corner, layer: 'anchor', rule: 'key-bed', why: 'the bed: head to the wall' });
  if (open) ccmClearRound(ctx, fire, cells >= 12 ? 1.6 : 1.1); // standing room round the fire (after the bed has its corner: a 15-ft cottage has room for both, just)
  hutWalks(ctx, open ? [fire.x + n[0] * -(fire.dims[2] / 2 + 2.2), fire.z + n[1] * -(fire.dims[2] / 2 + 2.2)] : front(fire, 2.6));
  if (bed) { ctx.command('bed', bed, { flanks: false });
    if (cells >= 20) hutWall(ctx, ['bedroll', 'bed-straw-pallet'], [far, ...lat], { near: [bed.x, bed.z], sideCost: 0, rule: 'bed', why: 'the children\'s pallet, beside the big bed' }); // (two beds in a small room read as a lodging house)
    hutNear(ctx, ['chest-plain'], front(bed, 0.4), { r0: 0, r1: 2.5, face: false, rots: [bed.rot, bed.rot + Math.PI / 2], why: 'the family chest at the foot of the bed' });
    ccmQuiet(ctx, () => ctx.rug(ccmAny(ctx, poor ? ['rug-rush-mat'] : ['rug-sheepskin', 'rug-rush-mat', 'rug-braided-round']), { at: [bed.x + Math.cos(bed.rot) * (bed.dims[0] / 2 + 1.3), bed.z - Math.sin(bed.rot) * (bed.dims[0] / 2 + 1.3)], rot: bed.rot, why: 'a mat beside the bed' })); }
  // the table: on the door's side of the fire, toward the side away from the bed; stools at it, supper on it
  const deepC = far === 'N' || far === 'S' ? ctx.D : ctx.W, tPt = ctx.sidePoint(far, bedSide ? L * 0.27 : L * 0.73, Math.min(deepC - 4.5, deepC * 0.7));
  const table = hutNear(ctx, cells >= 20 && !poor ? ['table-trestle'] : ['table-square'], tPt, { r0: 0, r1: 4.5, face: false, rots: [SIDES[far].rot], rule: 'key-table', why: 'the table: where the family eats' })
    || hutWall(ctx, ['table-square'], [...lat, ...(d ? [d.side] : [])], { near: tPt, why: 'the table, pushed against the wall' });
  if (table) { for (let i = 0, k = cells >= 12 ? 3 : 2; i < k; i++) hutNear(ctx, poor || i < 2 ? ['stool-three-leg'] : ['bench-long', 'stool-three-leg'], [table.x, table.z], { r0: table.dims[0] / 2 + 0.55, r1: table.dims[0] / 2 + 1.3, allowKeep: hutKeep(ctx), rule: 'seat', why: 'a stool at the table' });
    hutOnto(ctx, table, ['bread-loaf', 'bowl-wood-small', 'porridge-bowl', 'turnip-stew-bowl', 'cheese-wedge', 'jug-clay', 'egg-basket', 'turnip'], poor ? 3 : 4, 'supper on the table'); hutOnto(ctx, table, poor ? ['candle-stubs-dish', 'candle'] : ['candle', 'candlestick', 'lantern-hand'], 1, 'the light on the table', 'light'); }
  // round the fire: stools (and a settle in a common house)
  const seats = [];
  if (open) for (let i = 0, k = Math.min(4, 2 + Math.floor(cells / 9)); i < k; i++) { const s = hutNear(ctx, poor || i ? ['stool-three-leg'] : ['stool-three-leg', 'bench-long'], [fire.x, fire.z], { r0: fire.dims[0] / 2 + 0.9, r1: fire.dims[0] / 2 + 2.2, allowKeep: hutKeep(ctx), rule: 'inward-seat', why: 'a stool by the fire' }); if (s) seats.push(s); }
  else { const s = hutNear(ctx, ['settle', 'bench-long'], front(fire, 4.2), { r0: 0, r1: 2.5, rule: 'inward-seat', why: 'the settle before the fire' }); if (s) seats.push(s); hutNear(ctx, ['stool-three-leg'], front(fire, 2.6), { r0: 1.5, r1: 3.5, rule: 'inward-seat', why: 'a stool by the fire' }); }
  // stores: one corner heaped; a shelf with the bowls; a barrel; by the door: pegs, tools, the broom, a bucket
  hutPile(ctx, ['sack', 'barrel', 'crate', 'sack', 'baskets-stack', 'storage-jar'], Math.max(2, Math.min(5, Math.round(cells / 4))), 'the stores, heaped in a corner');
  hutNear(ctx, ['turnip-pile', 'potato-pile', 'onion-pile'], ctx.placements.find(p => p.rule === 'corner-pile') ? [ctx.placements.find(p => p.rule === 'corner-pile').x, ctx.placements.find(p => p.rule === 'corner-pile').z] : [cx, cz], { r0: 1.2, r1: 3.5, layer: 'dress', why: 'roots heaped by the stores' });
  const walls = ctx.wallsByDoor();
  for (let i = 0, k = cells >= 16 ? 2 : 1; i < k; i++) { const sh = ccmQuiet(ctx, () => ctx.mount('shelf-wall', { sides: [walls[i % walls.length]], height: 4.4, why: 'a shelf for the bowls' })); }
  if (d) { ccmQuiet(ctx, () => ctx.mount('coat-pegs', { sides: [d.side], height: 5, why: 'pegs by the door' })); hutWall(ctx, ['broom'], [d.side, ...lat], { near: d.inner, layer: 'dress', rule: 'floor-clutter', why: 'the broom by the door' }); /* (no fork or spade: leaning by the door they read as a weapon rack) */ hutWall(ctx, ['bucket', 'firewood-basket'], [d.side, ...lat], { any: true, near: d.inner, layer: 'dress', rule: 'floor-clutter', why: 'the bucket by the door' }); }
  hutNear(ctx, ['kindling-bundle', 'firewood-basket'], hearthPt, { r0: 2, r1: 4.5, layer: 'dress', why: 'firewood within reach of the hearth', face: false });
  for (let i = 0, k = cells >= 16 ? 3 : 2; i < k; i++) ccmQuiet(ctx, () => ctx.mount(ccmAny(ctx, ['garlic-braid', 'herb-bundle-fresh', 'utensil-rack-wall']), { sides: [walls[i % walls.length]], height: 5.3, why: 'hung on the wall to dry' }));
  hutWall(ctx, ['butter-churn'], lat, { at: 0.7, sideCost: 0.5, why: 'the butter churn against the wall' });
  if (cells >= 16) hutWall(ctx, poor ? ['barrel', 'chest-plain'] : ['cupboard', 'chest-plain'], lat, { at: 0.75, why: 'against the wall' });
  if (cells >= 20) { hutWall(ctx, ['bench-long'], [...lat, far], { at: 0.3, sideCost: 1, why: 'a bench along the wall' }); hutPile(ctx, ['sack', 'barrel', 'hay-bale', 'crate'], 3, 'more stores in another corner'); }
  if (cells >= 24) hutWall(ctx, ['table-kitchen-prep', 'chest-plain'], [...lat, far], { at: 0.6, sideCost: 1, why: 'a work board against the wall' });
  // light: a rushlight by the bed or the table; never none
  hutNear(ctx, poor ? ['rushlight-holder'] : ['rushlight-holder', 'candlestick-floor'], bed ? front(bed, 1) : hearthPt, { r0: 1, r1: 4, layer: 'light', why: 'a rushlight on its stand', face: false });
  if (!poor) hutLights(ctx, lat, { every: 18, min: 1, max: 2 });
  ctx.hutInfo = { wealth: poor ? 'poor' : 'common', fire: fire.id, open, beds: ctx.placements.filter(p => /^(bed-|bedroll|cot)/.test(p.id)).length };
  ctx.growth.push(`${poor ? 'poor' : 'common'} cottage: ${open ? 'an open fire on the floor' : 'a hearth in the wall'}, ${ctx.hutInfo.beds} bed${ctx.hutInfo.beds === 1 ? '' : 's'}`);
  ccmDone(ctx);
  return { feature: fire, what: `${open ? 'open hearth' : 'hearth'}${bed ? ', bed in the corner' : ''}${table ? ', table' : ''}`, approach: null, passage: true };
}

// FARMHOUSE KITCHEN (hub: the room the farm lives in): the cooking hearth centred on the wall facing the door; ONE long
// table in the middle with a bench each side; the settle and the rocking chair by the fire; the dresser with its plates
// on a side wall; flour bin, barrels and sacks; the washtub by the door; hams and onions hung over the table.
function hutKitchen(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), poor = hutPoor(ctx);
  const L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, P = (t, s) => ctx.sidePoint(far, t, s);
  let fire = ccmFocalOn(ctx, far, ['fireplace-wall', 'cook-hearth-spit'], /* (the plain stone fireplace first: the spit hearth's dark ironwork and green pot read as a still, and the kitchen as an alchemist's) */ { label: 'cooking hearth', rule: 'key-hearth', why: 'the cooking hearth: centred on the wall facing the door' });
  if (!fire) for (const s of lat) if (!fire) fire = ccmFocalOn(ctx, s, ['cook-hearth-spit', 'fireplace-wall'], { label: 'cooking hearth', rule: 'key-hearth', slack: Math.max(0.5, ctx.sideLen(s) / 2 - 4), why: 'the cooking hearth: on a side wall (the wall facing the door cannot take it)' });
  if (!fire) return { fail: `farmhouse kitchen has no hearth (${ctx.focal?.why || 'no hearth mesh'})` };
  if (d) { ctx.sight = [d.inner, [fire.x, fire.z]]; ctx.sightFeature = fire.id; }
  { const [fx, fz] = ctx.facingVec(fire.rot), [aw, ad] = ctx.aabb(fire.dims[0] + 0.5, 3, fire.rot); ctx.mark(fire.x + fx * (fire.dims[2] / 2 + 1.5), fire.z + fz * (fire.dims[2] / 2 + 1.5), aw, ad, KEEP); }
  // the table: lengthways on the room's long axis, in the middle of the floor left before the hearth
  const axisAlong = (far === 'N' || far === 'S') ? ctx.W >= ctx.D : ctx.D > ctx.W; // is the long axis parallel to the hearth wall?
  const tid = ccmFirst(ctx, cells >= 12 ? ['table-trestle', 'table-square'] : ['table-square', 'table-trestle']);
  const fs = fire.side === far ? fire.dims[2] + 3.4 : 2.5, mid = (fs + deep - 3) / 2, trot = SIDES[far].rot + (axisAlong ? 0 : Math.PI / 2);
  const spots = [0, 1, -1, 2, -2, -3].flatMap(e => [0, 1.5, -1.5, 3, -3].map(u => [...P(L / 2 + u, mid + e), trot]));
  let table = null; for (const id of [tid, 'table-square'].filter((v, i, l) => v && l.indexOf(v) === i)) table ||= hutAt(ctx, id, spots, { layer: 'anchor', rule: 'key-table', why: 'the kitchen table: in the middle of the room' }) || hutAt(ctx, id, spots, { layer: 'anchor', rule: 'key-table', why: 'the kitchen table: in the middle of the room', allowKeep: true });
  ccmFlank(ctx, fire, ['firewood-basket', 'kindling-bundle', 'fire-irons'], { off: 0.3, n: 1, layer: 'dress', why: 'firewood beside the hearth' });
  if (table) { const [fx, fz] = ctx.facingVec(table.rot);
    for (const sg of [1, -1]) { const bid = ccmFirst(ctx, table.dims[0] >= 5 ? ['bench-long', 'stool-three-leg'] : ['stool-three-leg', 'chair-plain']); if (!bid) break; const [bw, bd] = hutDims(ctx, bid), off = table.dims[2] / 2 + 0.3 + bd / 2; /* (the mesh's own depth: a bench is deeper than its catalog foot) */
      for (const u of table.dims[0] >= 5 && bw < 4 ? [-1.4, 1.4] : [0]) hutExact(ctx, () => hutAt(ctx, bid, [0, 0.25, 0.5].map(e => [table.x + fx * (off + e) * sg + fz * u, table.z + fz * (off + e) * sg - fx * u, table.rot + (sg > 0 ? Math.PI : 0)]).filter(([x, z]) => ctx.doors.every(o => { const q = ctx.axis(o, x, z); return q.along >= 3.2 + bd / 2 || q.lat > o.width / 2 + bw / 2 + 0.6; })) /* (never in a doorway: a small kitchen has a bench on the hearth side only) */, { rule: 'seat', why: 'a bench each side of the table', allowKeep: hutKeep(ctx) })); }
    hutOnto(ctx, table, ['bread-loaf', 'cheese-wheel', 'pitcher-of-milk', 'bowl-wood-small', 'plate-wood-round', 'jug-clay', 'butter-crock', 'stew-pot-full', 'cup-clay', 'spoon-wooden', 'egg-basket', 'apple-basket', 'pie'], Math.max(3, Math.min(7, Math.round(table.dims[0] * 0.9))), 'on the kitchen table');
    hutOnto(ctx, table, ['candle', 'candlestick'], 1, 'a candle on the table', 'light');
    for (const [id, u] of [[ccmAny(ctx, ['ham-hanging', 'onion-string']), -1.6], [ccmAny(ctx, ['onion-string', 'sausage-string', 'dried-fruit-string']), 1.6]]) if (id && table.dims[0] >= 5) ccmQuiet(ctx, () => ctx.ceiling(id, { at: [table.x + Math.cos(table.rot) * u, table.z - Math.sin(table.rot) * u], layer: 'dress', why: 'hung from the beam over the table' })); }
  hutLoop(ctx); // (after the table and its benches: the walks go round them)
  hutWalks(ctx, front(fire, 2.6));
  if (table) ccmClearRound(ctx, table, 2.2);
  // by the fire: the settle against the hearth wall, the rocking chair turned to the fire
  const settle = hutWall(ctx, ['settle', 'bench-long'], fire.side === far ? [far] : [fire.side], { near: [fire.x, fire.z], why: 'the settle in the chimney corner' });
  hutNear(ctx, poor ? ['stool-three-leg'] : ['rocking-chair', 'craft-wicker-chair', 'stool-three-leg'], front(fire, 3.2), { r0: 1.8, r1: 4.2, rule: 'inward-seat', why: 'the chair by the fire' });
  hutNear(ctx, ['cat-bed-basket'], front(fire, 1.6), { r0: 1.5, r1: 4, layer: 'dress', why: 'the cat\'s basket by the hearth', face: false });
  // the dresser on a side wall, the cupboard on the other; a work board; the flour bin and stores
  const dr = hutWall(ctx, ['dresser-plates', 'cupboard'], lat, { at: 0.45, why: 'the dresser with its plates' });
  const other = dr ? lat.filter(s => s !== dr.side).concat(lat) : lat;
  if (cells >= 16) { const cb = hutWall(ctx, ['cupboard', 'table-kitchen-prep'], other, { at: 0.5, why: 'the cupboard' }); hutOnto(ctx, cb, ['bread-loaf', 'bowl-stack', 'cheese-wheel', 'plate-stack-wood'], 2, 'on the cupboard'); /* (not jars and glazed pitchers: from above they were 'glowing potions') */ }
  if (cells >= 20) { const wb = hutWall(ctx, ['table-kitchen-prep'], [...other, ...(d ? [d.side] : [])], { at: 0.25, sideCost: 1, why: 'the work board against the wall' }); hutOnto(ctx, wb, ['dough-bowl', 'rolling-pin', 'cutting-board-round', 'cabbage-single', 'turnip', 'mortar-wood', 'bowl-wood-large'], 3, 'work on the board'); }
  hutWall(ctx, ['flour-bin', 'barrel'], [...other, far], { at: 0.85, sideCost: 1, layer: 'store', why: 'the flour bin' });
  if (!poor) hutWall(ctx, ['butter-churn'], [...other, far], { near: dr ? [dr.x, dr.z] : null, sideCost: 1, why: 'the butter churn by the dresser' });
  hutPile(ctx, ['sack', 'barrel', 'crate', 'storage-jar', 'baskets-stack', 'sack'], Math.max(2, Math.min(5, Math.round(cells / 6))), 'stores in the corner');
  if (d) { hutWall(ctx, ['washtub', 'bucket'], [d.side, ...lat], { near: d.inner, layer: 'dress', why: 'the washtub by the door' }); hutWall(ctx, ['bucket', 'broom'], [d.side, ...lat], { any: true, near: d.inner, layer: 'dress', rule: 'floor-clutter', why: 'by the door' }); ccmQuiet(ctx, () => ctx.mount('coat-pegs', { sides: [d.side], height: 5, why: 'pegs by the door' })); }
  const walls = ctx.wallsByDoor();
  for (let i = 0, k = Math.max(2, Math.min(5, Math.round(cells / 6))); i < k; i++) ccmQuiet(ctx, () => ctx.mount(ccmAny(ctx, ['utensil-rack-wall', 'garlic-braid', 'shelf-wall', 'herb-bundle-fresh', 'salt-box']), { sides: [walls[i % walls.length]], height: 5, why: 'on the kitchen wall' }));
  ccmQuiet(ctx, () => ctx.rug(ccmAny(ctx, ['rug-braided-round', 'rug-rush-mat']), { at: front(fire, 3.4), rot: fire.rot, why: 'the rag rug before the fire' }));
  if (cells >= 24) { hutWall(ctx, ['bench-long', 'chest-plain'], [...lat, ...(d ? [d.side] : [])], { at: 0.2, sideCost: 1, why: 'a bench along the wall' }); hutPile(ctx, ['barrel', 'sack', 'crate', 'firewood-basket'], 3, 'more stores'); }
  hutLights(ctx, lat, { ids: ['lamp-wall-shelf', 'rushlight-holder-wall', 'rural-lantern-barn'], every: 16, min: 1, max: 3 });
  ccmDone(ctx);
  return { feature: fire, what: `cooking hearth${table ? ', the long table' : ''}${dr ? ', dresser' : ''}`, approach: null, passage: true };
}

// SLEEPING LOFT (terminal, poor): pallets in a row under the eaves, heads to the long wall; the stores that keep dry
// up here (apples, sacks, onions) at the other end. (No ladder: the ladder mesh is 10 ft, a storey high.)
function hutLoft(ctx) {
  const d = ctx.mainDoor, cells = ccmCells(ctx), long = ctx.longSides(), back = d && long.includes(d.side) ? OPP_SIDE[d.side] : long[0], L = ctx.sideLen(back);
  const n = Math.max(1, Math.min(6, Math.floor((L - 1) / 4.2), Math.round(cells / 4))), beds = [];
  const from = d && !long.includes(d.side) ? (d.side === 'W' || d.side === 'N' ? 1 : 0) : ctx.ri(0, 1); // the beds start at the end away from an end door
  for (let i = 0; i < n; i++) { const t = from ? L - 2 - i * 4.2 : 2 + i * 4.2, id = ccmAny(ctx, i % 3 === 2 ? ['bedroll', 'bed-straw-pallet'] : ['bed-straw-pallet', 'bedroll', 'cot']);
    const b = id && ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [back], { gap: 0.1, step: 0.25 }), (c) => Math.abs(c.t - t), { layer: i ? 'furnish' : 'anchor', rule: i ? 'bed' : 'key-bed', why: 'a pallet under the eaves, head to the wall' })); if (b) beds.push(b); }
  if (!beds.length) return { fail: 'sleeping loft has no bed (no wall free for a pallet)' };
  if (d) { ctx.sight = [d.inner, [beds[0].x, beds[0].z]]; ctx.sightFeature = beds[0].id; }
  hutWalks(ctx, front(beds[Math.floor(beds.length / 2)], 2.2));
  for (const [i, b] of beds.entries()) if (i % 2 === 0) hutNear(ctx, ['blankets-folded', 'bundle-wrapped', 'chest-plain'], front(b, 0.5), { r0: 0, r1: 2, layer: 'dress', face: false, why: 'at the foot of the pallet' });
  const end = ctx.sidePoint(back, from ? 1.5 : L - 1.5, 3);
  hutPile(ctx, ['apple-crate', 'sack', 'crate', 'grain-sack-open', 'baskets-stack', 'barrel', 'hay-bale'], Math.max(3, Math.min(7, Math.round(cells / 2.5))), 'what keeps dry up here: apples, grain, seed');
  if (cells >= 12) hutPile(ctx, ['hay-pile', 'hay-bale', 'sack'], 2, 'hay in the corner');
  if (d) hutNear(ctx, ['loft-ladder-head'], [d.inner[0] + SIDES[d.side].n[0] * 4, d.inner[1] + SIDES[d.side].n[1] * 4], { r0: 0, r1: 4, face: false, rots: [SIDES[d.side].rot], rule: 'key-hatch', why: 'the hatch and the ladder head: how you came up' });
  const walls = ctx.wallsByDoor();
  for (let i = 0, k = Math.max(1, Math.min(4, Math.round(cells / 5))); i < k; i++) ccmQuiet(ctx, () => ctx.ceiling(ccmAny(ctx, ['onion-string', 'dried-fruit-string']), { layer: 'dress', why: 'strung from the rafters to dry' }));
  ccmQuiet(ctx, () => ctx.mount('garlic-braid', { sides: [walls[0]], height: 5, why: 'hung to dry' }));
  hutFloorScatter(ctx, Math.max(1, Math.round(cells / 8)));
  hutNear(ctx, ['rushlight-holder', 'lantern-hand'], front(beds[0], 1.5), { r0: 0.5, r1: 4, layer: 'light', face: false, why: 'the one light up here' }) || hutLights(ctx, walls.slice(0, 2), { min: 1, max: 1 });
  ctx.growth.push(`${beds.length} pallet${beds.length === 1 ? '' : 's'} in a row under the eaves`);
  ccmDone(ctx);
  return { feature: beds[0], what: `${beds.length} pallet${beds.length === 1 ? '' : 's'} under the eaves, stores at the end`, approach: null, passage: true };
}

// CROSS-PASSAGE (passage): the through-line from the house door to the byre or the yard, kept clear; nearly bare:
// cloaks on pegs, boots and a bucket inside the doors, a barrel or a sack against the wall. One lantern.
function hutPassage(ctx) {
  const line = throughLine(ctx);
  if (!line.path.ok) return { fail: 'cross-passage through-line is blocked' };
  const along = ctx.W >= ctx.D, sides = along ? ['N', 'S'] : ['W', 'E'], L = Math.max(ctx.W, ctx.D), n = Math.max(2, Math.round(L / 7));
  // (no bench, no chest: from above a bench is a work table and the passage read as a workshop. What stands here is what
  // is set down on the way through: a barrel, sacks, a bucket, boots; what hangs: cloaks on pegs.)
  let first = null;
  for (let i = 0; i < n; i++) { const side = sides[i % 2], t = L * (i + 0.5) / n, id = ccmAny(ctx, ['barrel', 'sack', 'crate', 'firewood-basket']);
    const p = id && ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [side], { tRange: [t - 3, t + 3] }), (c) => Math.abs(c.t - t), { layer: 'store', rule: 'alternate', why: 'set down against the passage wall, clear of the way through' })); first ||= p;
    ccmQuiet(ctx, () => ctx.mount(ccmAny(ctx, ['coat-pegs', 'cloak-hanging']), { sides: [sides[(i + 1) % 2]], height: 5, why: 'cloaks on their pegs' })); }
  for (const dd of ctx.doors.slice(0, 2)) hutWall(ctx, ['boots-row', 'bucket', 'broom'], sides, { any: true, near: dd.inner, layer: 'dress', rule: 'floor-clutter', why: 'set down inside the door' });
  ccmQuiet(ctx, () => ctx.rug('rug-rush-mat', { at: [line.a[0] + (line.b[0] - line.a[0]) * 0.15, line.a[1] + (line.b[1] - line.a[1]) * 0.15], rot: along ? Math.PI / 2 : 0, why: 'a rush mat inside the door' }));
  hutLights(ctx, sides, { every: 20, min: 1, max: 2 });
  ccmDone(ctx);
  return { feature: first, what: 'clear way through, cloaks on pegs, what was set down inside the doors', approach: null, passage: true };
}

// ROOT CELLAR (terminal, dug in, no windows): shelving on the wall facing the door, more down the sides; roots heaped on
// the earth floor, crates of them stacked low, barrels and crocks; onions and a ham hung; the ladder by the door.
function hutCellar(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx);
  const sh = ccmFocalOn(ctx, far, ['shelving-freestanding', 'cheese-shelf-aging', 'cupboard'], { label: 'store shelves', rule: 'key-shelves', why: 'the store shelves: centred on the wall facing the door' }) || hutWall(ctx, ['shelving-freestanding', 'cupboard'], [far, ...lat], { layer: 'anchor', rule: 'key-shelves', why: 'the store shelves' });
  if (!sh) return { fail: 'root cellar has no shelves (no wall free)' };
  if (d) { ctx.sight = [d.inner, [sh.x, sh.z]]; ctx.sightFeature = sh.id; }
  hutWalks(ctx, front(sh, 2.4));
  for (let i = 0, k = Math.max(1, Math.min(6, Math.round(cells / 4))); i < k; i++) hutWall(ctx, i % 3 === 2 ? ['cheese-shelf-aging', 'shelving-freestanding'] : ['shelving-freestanding'], [far, ...lat], { near: [sh.x, sh.z], sideCost: 0, rule: 'like-with-like', why: 'more shelves along the wall' });
  // the roots: heaps on the floor (bigger than a kitchen's), then low crates of them
  const heapAt = (id, k, s) => ccmScaled(ctx, id, k, () => hutWall(ctx, [id], [...lat, far], { at: s, sideCost: 0.5, layer: 'store', rule: 'heap', why: 'roots heaped on the earth floor', gap: 0.3 }));
  hutWall(ctx, ['root-sand-box'], [...lat, far], { at: 0.5, sideCost: 0.5, layer: 'store', rule: 'key-clamp', why: 'the sand box: carrots and beets bedded in rows' });
  heapAt('potato-pile', 2, 0.25); heapAt('turnip-pile', 1.8, 0.75); if (cells >= 12) { heapAt('onion-pile', 2, 0.5); heapAt('carrot-pile', 2, 0.6); }
  for (let i = 0, k = Math.max(3, Math.min(9, Math.round(cells / 2))); i < k; i++) ccmQuiet(ctx, () => { const id = ccmAny(ctx, ['potato-crate', 'cabbage-crate', 'apple-crate', 'vegetable-crate-mixed', 'crate']); return id && ccmScaled(ctx, id, id === 'crate' ? 1 : 1.3, () => ctx.wall(id, { sides: [...lat, far, ...(d ? [d.side] : [])], prefer: 'random', layer: 'store', rule: 'like-with-like', why: 'a crate of roots against the wall', gap: 0.1 })); });
  hutPile(ctx, ['barrel', 'storage-jar', 'sack', 'potato-sack-open', 'demijohn', 'barrel'], Math.max(2, Math.min(5, Math.round(cells / 4))), 'barrels and crocks in the corner');
  const top = ctx.placements.filter(p => /^barrel$/.test(p.id)); if (top[0]) hutOnto(ctx, top[0], ['lantern-hand', 'candle-stubs-dish'], 1, 'the lantern, set down on a barrel', 'light');
  for (let i = 0, k = Math.max(2, Math.min(5, Math.round(cells / 4))); i < k; i++) ccmQuiet(ctx, () => ctx.ceiling(ccmAny(ctx, ['onion-string', 'ham-hanging', 'dried-fruit-string', 'onion-string']), { layer: 'dress', why: 'hung from the joists' }));
  if (d) hutWall(ctx, ['ladder-wood'], [d.side, ...lat], { near: d.inner, why: 'the ladder down' });
  ccmEnsureLight(ctx, ['rural-lantern-barn', 'rushlight-holder-wall', 'lantern-pierced-tin'], ['rushlight-holder']);
  ccmDone(ctx);
  return { feature: sh, what: 'store shelves, roots heaped and crated', approach: null, passage: true };
}

// BYRE (mixed): the stable's stall rows and centre aisle (stableStalls) with nothing of the horse about it: no saddles,
// no blanket rail, no farrier. Then the milker's things: a stool and a pail before the stalls, the barrow by the door,
// hay and feed against the bare wall. The cattle are figures.
const HUT_NO_HORSE = /^(saddle-rack|rural-saddle-riding|saddle|horse-blanket-rail|farrier-stand|bridle-hanging|rural-horse-brasses|tack-wall|smith-|horse-collar|rural-harness-draft)/;
function hutByre(ctx) {
  const has0 = ctx.has; ctx.has = function (id) { return !HUT_NO_HORSE.test(id) && has0.call(this, id); };
  let kp; try { kp = ccmQuiet(ctx, () => stableStalls(ctx)); } finally { delete ctx.has; }
  if (!kp || kp.fail) return { fail: (kp?.fail || 'no stalls').replace(/stable/g, 'byre') };
  const d = ctx.mainDoor, back = kp.stallsAlong, cells = ccmCells(ctx);
  if (d && back) { const L = ctx.sideLen(back); ccmWalk(ctx, 'lane', [d.inner, ctx.sidePoint(back, 2, 7.5), ctx.sidePoint(back, L - 2, 7.5)]); }
  const gates = ctx.placements.filter(p => /^stable-stall-(gate|door)/.test(p.id));
  for (const [i, g] of gates.entries()) if (i % 2 === 0) { const [fx, fz] = [Math.sin(g.rot), Math.cos(g.rot)], cxm = (ctx.X0 + ctx.X1) / 2, czm = (ctx.Z0 + ctx.Z1) / 2, sg = Math.sign((cxm - g.x) * fx + (czm - g.z) * fz) || 1, pt = [g.x + fx * sg * 1.6, g.z + fz * sg * 1.6];
    hutNear(ctx, ['stool-three-leg'], pt, { r0: 0, r1: 1.6, allowKeep: true, face: false, rule: 'milking', why: 'the milking stool before the stall' }); hutNear(ctx, i ? ['bucket', 'rural-water-bucket-stable'] : ['rural-milk-churn-tall', 'bucket'], pt, { r0: 0.8, r1: 2.4, allowKeep: true, face: false, layer: 'dress', rule: 'milking', why: 'the milk pail' }); }
  const walls = ctx.wallsByDoor();
  if (d) hutWall(ctx, ['rural-manure-barrow', 'wheelbarrow'], [d.side, ...walls], { near: d.inner, why: 'the muck barrow by the door' });
  hutPile(ctx, ['hay-bale', 'rural-feed-sack-open', 'hay-bale', 'rural-oat-sack', 'grain-bin-stable', 'rural-straw-bundle'], Math.max(2, Math.min(5, Math.round(cells / 6))), 'hay and feed in the corner');
  hutWall(ctx, ['pitchfork', 'rake', 'broom'], walls, { any: true, layer: 'dress', rule: 'floor-clutter', why: 'the fork against the wall' });
  if (!ccmLit(ctx)) hutLights(ctx, walls.slice(0, 2), { ids: ['rural-lantern-barn'], min: 1, max: 2 });
  ccmDone(ctx);
  return { ...kp, what: `byre: ${ctx.stableInfo?.stalls ?? gates.length} stalls, milking stools and pails`, approach: null, passage: true };
}

// CHICKEN COOP (terminal, small): a row of nest boxes along the wall facing the door (crates, a nest in each, an egg in
// some); a perch rail along a side wall; the feed trough and a sack by the door; straw underfoot. Hens are figures.
function hutCoop(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far);
  const boxes = [], unit = ccmHas(ctx, 'nest-box-row'), bw = unit ? hutDims(ctx, 'nest-box-row')[0] + 0.3 : 2.3, n = Math.max(unit ? 1 : 2, Math.min(8, Math.floor((L - 0.6) / bw)));
  // the nest boxes: the three-box unit (hut-01) in a row along the wall facing the door; before that mesh, crates with a nest in each
  const nest = (b, i) => { if (unit) return; ccmOn(ctx, 'nest-bird', b, 0, 0, 'a nest of straw in the box'); if (i % 2 === 0) ccmOn(ctx, 'egg', b, 0.18, 0.12, 'an egg in the nest'); };
  for (let i = 0; i < n; i++) { const t = L / 2 + (i - (n - 1) / 2) * bw; const b = ccmQuiet(ctx, () => ctx.put(unit ? 'nest-box-row' : 'crate', (dm) => ctx.wallGen(dm, [far], { gap: 0.1, step: 0.1, tRange: [t - 0.4, t + 0.4] }), (c) => Math.abs(c.t - t), { layer: i ? 'furnish' : 'anchor', rule: 'nest-box', why: 'nest boxes in a row along the wall' })); if (b) { boxes.push(b); nest(b, i); } }
  if (!boxes.length) return { fail: 'chicken coop has no nest boxes (no wall free)' };
  if (d) { ctx.sight = [d.inner, [boxes[0].x, boxes[0].z]]; ctx.sightFeature = boxes[0].id; }
  if (cells >= 6) for (const sd of lat.slice(0, 1)) for (let i = 0, k = Math.min(unit ? 2 : 3, Math.floor(ctx.sideLen(sd) / (unit ? 5.5 : 5))); i < k; i++) { const b = ccmQuiet(ctx, () => ctx.put(unit ? 'nest-box-row' : 'crate', (dm) => ctx.wallGen(dm, [sd], { gap: 0.1 }), (c) => Math.hypot(c.x - boxes[0].x, c.z - boxes[0].z) + ctx.rng(), { rule: 'nest-box', why: 'more nest boxes down the side' })); if (b) { boxes.push(b); nest(b, boxes.length); } }
  hutWalks(ctx, front(boxes[Math.floor(n / 2)] || boxes[0], 1.8));
  hutWall(ctx, ['chicken-perch-ladder', 'sawhorse', 'quilt-rack'], [...lat].reverse(), { at: 0.5, why: 'the roost: perches along the side wall' }); // (not ladder-wood: that mesh is 10 ft and would stand through the roof)
  hutWall(ctx, ['feed-trough', 'bucket'], [...(d ? [d.side] : []), ...lat], { near: d ? d.inner : null, why: 'the feed trough by the door' });
  hutWall(ctx, ['rural-feed-sack-open', 'grain-sack-open', 'sack'], [...(d ? [d.side] : []), ...lat], { near: d ? d.inner : null, layer: 'store', why: 'a sack of corn by the door' });
  hutWall(ctx, ['rural-water-bucket-stable', 'bucket'], [...lat, ...(d ? [d.side] : [])], { layer: 'dress', rule: 'floor-clutter', why: 'the water' });
  { const top = hutWall(ctx, ['barrel', 'crate'], [...(d ? [d.side] : []), ...lat], { near: d ? d.inner : null, layer: 'store', why: 'a barrel by the door' }); if (top) ccmOn(ctx, ccmFirst(ctx, ['egg-basket', 'eggs-bowl', 'egg']), top, 0, 0, 'the morning\'s eggs, on the barrel'); }
  if (cells >= 6) hutPile(ctx, ['hay-pile', 'rural-straw-bundle', 'hay-bale'], cells >= 9 ? 2 : 1, 'straw for the boxes');
  hutFloorScatter(ctx, Math.max(2, Math.round(cells / 2))); // (not rural-straw-bedding: that flat is a made-up pallet with a blanket, and the coop read as a bedroom)
  hutLights(ctx, lat, { ids: ['rural-lantern-barn'], min: 1, max: 1 });
  ccmDone(ctx);
  return { feature: boxes[0], what: `${boxes.length} nest boxes, the roost ladder, feed by the door`, approach: null, passage: true };
}

// GRANARY & THRESHING FLOOR (terminal): the grain bins centred on the wall facing the door, sacks stacked in the corners;
// the MIDDLE is the threshing floor: swept boards kept clear, straw scattered on it, sheaves standing at its edge, the
// straw heap in a far corner, fork, rake and broom to hand; the sieve on a barrel; the cat, because of the mice.
function hutGranary(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const bin = ccmFocalOn(ctx, far, ['grain-bin-stable', 'flour-bin'], { label: 'grain bins', rule: 'key-bins', why: 'the grain bins: centred on the wall facing the door' }) || hutWall(ctx, ['grain-bin-stable', 'flour-bin', 'barrel'], [far, ...lat], { layer: 'anchor', rule: 'key-bins', why: 'the grain bins' });
  if (!bin) return { fail: 'granary has no grain bin (no wall free)' };
  if (d) { ctx.sight = [d.inner, [bin.x, bin.z]]; ctx.sightFeature = bin.id; }
  // the threshing floor: a clear rectangle in the middle, a third of the room each way (at least 6 ft)
  const tw = Math.max(6, ctx.W * 0.4), td = Math.max(6, ctx.D * 0.4), thresh = Math.min(ctx.W, ctx.D) >= 13;
  if (thresh) ctx.mark(cx, cz, tw, td, KEEP);
  hutWalks(ctx, thresh ? [cx, cz] : front(bin, 2.4));
  for (const sg of [1, -1, 2, -2].slice(0, Math.max(2, Math.min(4, Math.round(ctx.sideLen(far) / 6))))) { const id = ccmAny(ctx, ['grain-bin-stable', 'flour-bin', 'barrel']); if (id) ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap: 0.08, step: 0.25 }), (c) => Math.abs(c.x - bin.x - (far === 'N' || far === 'S' ? sg * 3.4 : 0)) + Math.abs(c.z - bin.z - (far === 'N' || far === 'S' ? 0 : sg * 3.4)), { layer: 'store', rule: 'like-with-like', why: 'bins and barrels of grain in a row' })); }
  for (let i = 0, k = Math.max(1, Math.min(3, Math.round(cells / 10))); i < k; i++) hutPile(ctx, HUT_SACKS, Math.max(3, Math.min(5, Math.round(cells / 5))), 'sacks of grain stacked in the corner');
  for (let i = 0, k = Math.max(2, Math.min(6, Math.round(cells / 5))); i < k; i++) hutWall(ctx, ['barrel', 'grain-bin-stable', 'flour-bin'], [...lat, ...(d ? [d.side] : [])], { any: true, at: (i + 0.5) / k, sideCost: 0.3, layer: 'store', rule: 'like-with-like', why: 'barrels and bins of grain along the walls' });
  if (thresh) { const heap = hutAt(ctx, 'rural-grain-heap-threshed', [[cx + tw * 0.12, cz - td * 0.1, 0]], { layer: 'anchor', rule: 'key-heap', why: 'the threshed grain, heaped in the middle of the floor', allowKeep: true }); if (heap) hutNear(ctx, ['winnowing-basket'], [heap.x, heap.z], { r0: heap.dims[0] / 2 + 0.6, r1: heap.dims[0] / 2 + 2.2, allowKeep: true, layer: 'dress', face: false, why: 'the winnowing basket by the heap' });
    ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: [cx, cz], why: 'straw on the threshing floor' })); ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: [cx + tw * 0.28, cz - td * 0.25], why: 'straw on the threshing floor' }));
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]].slice(0, Math.max(3, Math.min(6, Math.round(cells / 4))));
    for (const [ux, uz] of ring) hutNear(ctx, ['rural-grain-stook', 'rural-straw-bundle'], [cx + ux * (tw / 2 + 0.9), cz + uz * (td / 2 + 0.9)], { r0: 0, r1: 1.8, face: false, rule: 'sheaf', why: 'sheaves standing at the edge of the threshing floor' });
    hutAt(ctx, 'pitchfork', [[cx - tw * 0.3, cz + td * 0.25, ctx.r(0, Math.PI)], [cx - tw * 0.35, cz, 0]], { layer: 'dress', rule: 'floor-clutter', why: 'the fork, dropped on the threshing floor', allowKeep: true });
    ccmScaled(ctx, 'hay-pile', 0.7, () => hutWall(ctx, ['hay-pile'], [...lat, ...(d ? [d.side] : [])], { at: 0.8, sideCost: 0.5, why: 'the threshed straw, forked into a heap', gap: 0.3 })); }
  const walls = ctx.wallsByDoor();
  hutWall(ctx, ['rake', 'broom'], walls, { any: true, layer: 'dress', rule: 'floor-clutter', why: 'the rake against the wall' });
  if (d) { hutWall(ctx, ['grindstone', 'cart-hand', 'barrel'], [d.side, ...lat], { near: d.inner, why: 'by the door' }); }
  const br = ctx.placements.find(p => p.id === 'barrel'); if (br) hutOnto(ctx, br, ['sieve-wooden-drum', 'scoop-flour', 'rural-feed-scoop'], 1, 'the sieve, set down on a barrel');
  hutNear(ctx, ['cat-bed-basket', 'mousetrap-cheese'], [bin.x, bin.z], { r0: 2.5, r1: 6, layer: 'dress', face: false, why: 'because of the mice' });
  if (cells >= 20) hutWall(ctx, ['ladder-wood'], lat, { at: 0.3, why: 'the ladder to the upper bins' });
  hutLights(ctx, walls.slice(0, 3), { ids: ['rural-lantern-barn'], every: 22, min: 1, max: 3 });
  ccmDone(ctx);
  return { feature: bin, what: `grain bins${thresh ? ', a clear threshing floor' : ''}, sacks in the corners`, approach: null, passage: true };
}

// DAIRY (terminal, cool, stone): the cheese shelves centred on the wall facing the door; the work table in the middle
// with the day's butter and curds on it; the press in a corner; the brine trough along a wall; pails and the washtub
// by the door; crocks. Kept bare and clean: few things, each one its work.
function hutDairy(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const sh = ccmFocalOn(ctx, far, ['cheese-shelf-aging', 'trade-cheese-aging-shelf', 'shelving-freestanding'], { label: 'cheese shelves', rule: 'key-shelves', why: 'the cheese shelves: centred on the wall facing the door' }) || hutWall(ctx, ['cheese-shelf-aging', 'trade-cheese-aging-shelf'], [far, ...lat], { layer: 'anchor', rule: 'key-shelves', why: 'the cheese shelves' });
  if (!sh) return { fail: 'dairy has no cheese shelves (no wall free)' };
  if (d) { ctx.sight = [d.inner, [sh.x, sh.z]]; ctx.sightFeature = sh.id; }
  const tid = ccmFirst(ctx, cells >= 9 ? ['table-kitchen-prep', 'table-trestle', 'table-square'] : ['table-square', 'table-kitchen-prep']);
  const mid = (sh.dims[2] + 2.6 + deep - 3) / 2, table = tid ? hutAt(ctx, tid, [0, 0.5, -0.5, 1, -1, 1.5].map(e => [...ctx.sidePoint(far, L / 2, mid + e), SIDES[far].rot]), { layer: 'anchor', rule: 'key-table', why: 'the dairy table: in the middle, worked from both sides' }) : null;
  if (table) { ccmClearRound(ctx, table, 1.6); ccmScaled(ctx, 'cheese-wheel', 1.6, () => hutOnto(ctx, table, ['cheese-wheel', 'cheese-wheel', 'cheese-wheel'], Math.max(2, Math.min(4, Math.round(table.dims[0] * 0.6))), 'cheeses on the table')); hutOnto(ctx, table, ['cheese-wheel-cut', 'pitcher-of-milk', 'cheese-small-round', 'cheese-wax-sealed', 'butter-dish'], 2, 'the day\'s butter and curds on the table'); }
  hutWalks(ctx, table ? front(table, 1.4) : front(sh, 2.4));
  for (let i = 0, k = Math.max(1, Math.min(4, Math.round(cells / 5))); i < k; i++) hutWall(ctx, i % 2 ? ['trade-cheese-aging-shelf', 'cheese-shelf-aging'] : ['cheese-shelf-aging', 'trade-cheese-aging-shelf'], [far, ...lat], { near: [sh.x, sh.z], sideCost: 0, rule: 'like-with-like', why: 'more cheese shelves' });
  if (ccmHas(ctx, 'cheese-press')) hutWall(ctx, ['cheese-press'], lat, { at: 0.3, sideCost: 0.5, why: 'the cheese press against the wall' }); else if (cells >= 12) ccmQuiet(ctx, () => ctx.wall('cider-press', { sides: lat, prefer: 'corner', why: 'the press, in the corner' })); // (the cider press stood in before hut-01; in a small dairy it read as an armour stand)
  if (table) { hutNear(ctx, ['butter-churn'], front(table, 1.2), { r0: 1.4, r1: 3.6, face: false, rule: 'companion', why: 'the butter churn, by the table' }); for (let i = 0, k = cells >= 12 ? 3 : 2; i < k; i++) hutNear(ctx, ['rural-milk-churn-tall'], [table.x, table.z], { r0: Math.max(table.dims[0], table.dims[2]) / 2 + 0.4, r1: Math.max(table.dims[0], table.dims[2]) / 2 + 2.6, face: false, layer: 'dress', rule: 'milk', why: 'pails of the morning\'s milk, standing by the table' }); } else hutWall(ctx, ['butter-churn'], lat, { why: 'the butter churn' });
  hutWall(ctx, ['trade-salting-trough'], lat, { at: 0.6, sideCost: 0.5, why: 'the brine trough along the wall' });
  for (let i = 0, k = Math.max(2, Math.min(5, Math.round(cells / 4))); i < k; i++) ccmScaled(ctx, 'cheese-stack', 1.4, () => hutWall(ctx, ['cheese-stack', 'stinking-cheese-giant'], [...lat, ...(d ? [d.side] : [])], { any: i > 1, at: (i + 0.5) / k, sideCost: 0.3, layer: 'store', rule: 'like-with-like', why: 'cheeses stacked on the floor to ripen' }));
  if (d) { hutWall(ctx, ['washtub', 'dish-tub'], [d.side, ...lat], { near: d.inner, layer: 'dress', why: 'the scalding tub by the door' }); for (let i = 0; i < 2; i++) hutWall(ctx, i ? ['bucket', 'rural-water-bucket-stable'] : ['rural-milk-churn-tall', 'bucket'], [d.side, ...lat], { any: i > 0, near: d.inner, layer: 'dress', rule: 'floor-clutter', why: 'milk pails set down inside the door' }); }
  if (cells >= 12) hutPile(ctx, ['barrel', 'storage-jar', 'cheese-stack'], 2, 'a barrel of whey in the corner');
  if (table) hutNear(ctx, ['stool-three-leg'], front(table, 0.9), { r0: 0, r1: 1.5, rule: 'seat', why: 'the stool at the table' });
  const walls = ctx.wallsByDoor();
  ccmQuiet(ctx, () => ctx.mount('towel-hanging', { sides: [walls[0]], height: 4.8, why: 'a cloth on the dairy wall' }));
  hutLights(ctx, lat, { min: 1, max: 2 }); // (no lantern hung over the table: from above it lies ON the table, and read as an anvil)
  ccmDone(ctx);
  return { feature: sh, what: `cheese shelves${table ? ', the dairy table' : ''}, press and brine trough`, approach: null, passage: true };
}

// ---- outdoors: a plot with no walls. hutPlot() is the part every one shares: which stretches are a building's wall
// (nothing hangs in mid-air on the rest), the gate, the edge kit laid on the open grid edges (the yard's own code, with
// the kind named by the room instead of rolled from the neighbours), and the density target.
function hutPlot(ctx, vibe, kinds) {
  const A = ctx.area(), ALL = ['N', 'S', 'E', 'W'];
  ctx.densityTarget = yardTarget(A);
  const info = ctx.yardInfo = { vibe, edge: 'none', edgePieces: 0, wallFt: 0, gate: null, focal: null, signs: 0, doors: [], plants: { placed: 0, slot: ctx.slot('plants'), waiting: [] }, wear: 0 };
  const wallT = { N: [], S: [], E: [], W: [] }, openT = {};
  for (const o of ctx.openings) { if (!o.to || !/^(wall|window|door)$/.test(o.kind)) continue; wallT[o.side].push([Math.max(0, o.index * CELL - INSET), Math.min(ctx.sideLen(o.side), (o.index + 1) * CELL - INSET)]); }
  for (const s of ALL) { const m = []; for (const r of wallT[s].sort((a, b) => a[0] - b[0])) { if (m.length && r[0] <= m.at(-1)[1] + 1e-6) m.at(-1)[1] = Math.max(m.at(-1)[1], r[1]); else m.push([...r]); }
    wallT[s] = m; openT[s] = []; let t = 0; for (const [a, b] of m) { if (a > t + 1e-6) openT[s].push([t, a]); t = b; } if (t < ctx.sideLen(s) - 1e-6) openT[s].push([t, ctx.sideLen(s)]);
    ctx.mounts[s].push(...openT[s].map(r => [...r])); info.wallFt += m.reduce((a, [t0, t1]) => a + t1 - t0, 0); }
  info.wallFt = Math.round(info.wallFt);
  const backSides = ALL.filter(s => wallT[s].length);
  const g = ctx.openings.find(o => o.kind === 'gate'), gtc = g ? g.index * CELL - INSET + CELL / 2 : 0;
  const gate = g ? { side: g.side, tc: gtc, at: ctx.sidePoint(g.side, gtc, 0), inner: ctx.sidePoint(g.side, gtc, 1.4) } : null;
  if (gate) { ctx.keepClear(gate.side, gate.tc, 5, 3); info.gate = gate.side; }
  let edgeIn = 0; const openSegs = g?.open || [];
  const ok = kinds.filter(k => k === 'none' || YARD_EDGES[k].every(i => ccmHas(ctx, i)));
  const kind = openSegs.length && ok.length ? (ok.length > 1 ? ctx.roll('plot edge', ok) : ok[0]) : 'none';
  if (kind !== 'none') {
    const [straight, post, gateId] = YARD_EDGES[kind], fence = /fence/.test(kind), pieces = [];
    const lay = (id, x, z, rot, why, side) => { const sku = ctx.chooseSku(id); if (!sku) return null; const p = ctx.record(id, sku, ctx.dims(id, sku), x, 0, z, rot, 'anchor', 'yard-edge', why, { ...(side ? { side } : {}), edge: kind }); pieces.push(p); return p; };
    const vkey = (x, z) => `${Math.round(x * 2)}:${Math.round(z * 2)}`, verts = new Map(), built = new Set();
    for (const o of ctx.openings) if (o.to && /^(wall|window|door)$/.test(o.kind)) for (const t of [o.index * CELL - INSET, (o.index + 1) * CELL - INSET]) built.add(vkey(...ctx.sidePoint(o.side, t, -INSET)));
    for (const s of openSegs) {
      const t0 = s.index * CELL - INSET, [x, z] = ctx.sidePoint(s.side, t0 + CELL / 2, -INSET), isGate = s.side === g.side && s.index === g.index;
      const p = lay(isGate ? gateId : straight, x, z, SIDES[s.side].rot, isGate ? `the gate in the ${kind}` : `${kind} along the open edge`, s.side);
      const dep = p && !isGate ? p.dims[2] / 2 - INSET + 0.15 : 0;
      if (dep > 0.15) { edgeIn = Math.max(edgeIn, Math.ceil(dep / RES) * RES); const [mx, mz] = ctx.sidePoint(s.side, t0 + CELL / 2, dep / 2), horiz = s.side === 'N' || s.side === 'S'; ctx.mark(mx, mz, horiz ? CELL : dep, horiz ? dep : CELL); }
      for (const t of [t0, t0 + CELL]) { const [vx, vz] = ctx.sidePoint(s.side, t, -INSET), k = vkey(vx, vz), v = verts.get(k) || { x: vx, z: vz, sides: new Set(), n: 0, gate: false }; v.sides.add(s.side); v.n++; v.gate ||= isGate; verts.set(k, v); }
    }
    for (const [k, v] of verts) { if (built.has(k)) continue; if (v.n === 2 && v.sides.size === 1 && !(v.gate && fence)) continue; lay(post, v.x, v.z, 0, v.sides.size > 1 ? `corner of the ${kind}` : v.gate ? 'gate post' : `end of the ${kind}`, null); }
    info.edge = kind; info.edgePieces = pieces.filter(Boolean).length;
  }
  const d = ctx.mainDoor, cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length;
  // the way in: from the house door (or the middle) to the gate, kept clear; a second leg from every other door
  const start = d ? d.inner : null, way = gate ? gate.inner : null;
  const m = edgeIn + 0.35, rect = [ctx.X0 + m, ctx.Z0 + m, ctx.X1 - m, ctx.Z1 - m];
  // against a building wall (back to it) / along the open edge (inside the fence, facing in)
  const inR = (rs, a, b) => rs.some(([t0, t1]) => a >= t0 - 1e-6 && b <= t1 + 1e-6);
  const alongOf = (dm, side) => { const [aw, ad] = ctx.aabb(dm.w, dm.d, SIDES[side].rot); return side === 'N' || side === 'S' ? aw : ad; };
  const edgeGen = function* (dm, { gap = 0.3, built: wantBuilt = null, clearGate = 3.5 } = {}) { for (const c of ctx.wallGen(dm, ALL, { gap: gap + edgeIn, step: 0.5, windows: false })) { const al = alongOf(dm, c.side), onWall = inR(wallT[c.side], c.t - al / 2, c.t + al / 2), onOpen = inR(openT[c.side], c.t - al / 2, c.t + al / 2); if (wantBuilt === true ? !onWall : wantBuilt === false ? !onOpen : !(onWall || onOpen)) continue; if (gate && c.side === gate.side && Math.abs(c.t - gate.tc) < al / 2 + clearGate) continue; yield c; } };
  const atEdge = (ids, o = {}) => { const id = Array.isArray(ids) ? (o.any ? ccmAny(ctx, ids) : ccmFirst(ctx, ids)) : (ccmHas(ctx, ids) ? ids : null); if (!id) return null;
    return ccmQuiet(ctx, () => ctx.put(id, (dm) => edgeGen(dm, o), (c) => (o.near ? Math.hypot(c.x - o.near[0], c.z - o.near[1]) : ctx.rng() * 30) + (o.far ? -Math.hypot(c.x - o.far[0], c.z - o.far[1]) : 0), { layer: o.layer || 'furnish', rule: o.rule || 'yard-edge-thing', why: o.why || '', sku: o.sku })); };
  const corner = (ids, pt, o = {}) => atEdge(ids, { ...o, near: pt });
  const farCorner = () => { const ref = start || way || [ctx.X0, ctx.Z0]; return [[ctx.X0, ctx.Z0], [ctx.X1, ctx.Z0], [ctx.X0, ctx.Z1], [ctx.X1, ctx.Z1]].sort((a, b) => Math.hypot(b[0] - ref[0], b[1] - ref[1]) - Math.hypot(a[0] - ref[0], a[1] - ref[1])); };
  // a flat patch on the ground at a spot (mud, straw, a worn place): never blocks, overlaps freely
  const patch = (id, x, z, rot, why, k = 1) => { if (!ccmHas(ctx, id)) return null; const sku = ctx.chooseSku(id); if (!sku) return null; const dm0 = ctx.dims(id, sku), dm = k === 1 ? dm0 : { ...dm0, w: dm0.w * k, d: dm0.d * k, s: dm0.s && dm0.s.map(v => v * k) };
    const [aw, ad] = ctx.aabb(dm.w, dm.d, rot); x = Math.min(ctx.X1 - aw / 2, Math.max(ctx.X0 + aw / 2, x)); z = Math.min(ctx.Z1 - ad / 2, Math.max(ctx.Z0 + ad / 2, z));
    return ctx.record(id, sku, dm, x, 0.02 + (ctx.hutPatch = (ctx.hutPatch || 0) + 1) * 0.002, z, rot, 'floor-dress', 'ground-patch', why, { orient: 'floor' }); };
  const path = (wear = true) => { if (!way) return; const from = start || [cx, cz]; ccmWalk(ctx, 'path', [from, way], { width: 4 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'path', [o.inner, way], { width: 3 });
    if (wear && ccmHas(ctx, 'decal-path-worn')) { const len = Math.hypot(way[0] - from[0], way[1] - from[1]), rot = Math.atan2(way[0] - from[0], way[1] - from[1]); for (let s = 1.4; s < len; s += 2.8) if (patch('decal-path-worn', from[0] + (way[0] - from[0]) * s / len, from[1] + (way[1] - from[1]) * s / len, rot, 'the trodden way to the gate')) info.wear++; } };
  const plants = (ids, n, o = {}) => { for (let i = 0; i < n; i++) if (atEdge(ids, { any: true, built: false, layer: 'dress', rule: 'yard-plant', why: o.why || 'at the edge of the plot', ...o })) info.plants.placed++; };
  return { A, info, gate, d, cx, cz, edgeIn, rect, backSides, wallT, openT, count, atEdge, corner, farCorner, path, patch, plants, kind, start, way };
}
const hutPlotFail = (ctx, why) => { ctx.purposeFail = why; ccmDone(ctx); return { fail: why, feature: null, what: '—', approach: null, passage: true }; }; // (attempt() records a fail only for indoor rooms)
function hutPlotDone(ctx, Y, focal, what) { if (focal) Y.info.focal = { id: focal.id, kind: what.split(':')[0] }; ccmDone(ctx); return { feature: focal || null, what, approach: null, passage: true }; }

// PIGSTY (outdoor, small): wattle hurdles all round and a gate; the trough inside the gate; a low shelter in the far
// corner with straw before it; the wallow (churned mud) in the middle; a slop bucket; the muck heap. Pigs are figures.
function hutPigsty(ctx) {
  const Y = hutPlot(ctx, 'pigsty', ['wattle fence', 'post-and-rail fence']), { cx, cz, gate, A } = Y, far = Y.farCorner();
  const ref = gate ? gate.inner : Y.start || [cx, cz];
  const trough = Y.atEdge(['feed-trough', 'water-trough'], { near: ref, clearGate: 2.6, layer: 'anchor', rule: 'key-trough', why: 'the trough: inside the gate, where the swill is tipped' });
  if (gate) ccmWalk(ctx, 'path', [Y.start || [cx, cz], gate.inner], { width: 3 });
  const ark = Y.corner(['pigsty', 'dog-kennel'], far[0], { layer: 'anchor', rule: 'sty-shelter', why: 'the sty: a low shelter in the far corner' }) || Y.corner(['dog-kennel'], far[0], { layer: 'anchor', rule: 'sty-shelter', why: 'the sty: a low shelter in the far corner' });
  if (ark) { const [px, pz] = front(ark, 1.8); Y.patch('rug-hay-scatter', px, pz, ark.rot, 'straw trodden out of the sty', 1.2); Y.patch('rug-hay-scatter', px + 1.2, pz + 0.8, ark.rot + 0.9, 'straw trodden out of the sty'); }
  // the wallow: churned mud in the middle (dark patches laid over each other; NOT the puddle flat: it is a turquoise pond, and the sty read as a shrine round a magic spring)
  for (const [ux, uz, k] of [[0, 0, 1.6], [1.8, -1.2, 1.3], [-1.6, 1.4, 1.3], [0.6, 1.9, 1.1], ...(A >= 180 ? [[-3, -2.2, 1.3], [3.2, 2.4, 1.2]] : [])]) Y.patch('decal-dirt-patch', cx + ux, cz + uz, ctx.r(0, 6), 'the wallow: churned mud', k);
  Y.atEdge(['bucket-slop', 'bucket'], { near: trough ? [trough.x, trough.z] : ref, layer: 'dress', why: 'the slop bucket by the trough' });
  ccmScaled(ctx, 'hay-pile', 0.6, () => Y.corner(['hay-pile'], far[1], { why: 'straw for the sty, forked into the corner' }));
  if (A >= 150) Y.atEdge(['turnip-pile', 'rural-feed-sack-open'], { near: trough ? [trough.x, trough.z] : ref, layer: 'store', why: 'roots for the pigs' });
  Y.atEdge(['water-trough', 'feed-trough'], { far: ref, why: 'the water trough on the far side' });
  if (A >= 250) Y.corner(['rural-manure-barrow', 'wheelbarrow'], far[2], { why: 'the muck barrow' });
  return hutPlotDone(ctx, Y, trough || ark, `pigsty: ${Y.info.edge === 'none' ? 'open' : Y.info.edge + ' all round'}, the trough, the wallow`);
}

// VEGETABLE GARDEN (outdoor): a wattle (or picket) fence and a gate; BEDS IN ROWS, long sides parallel, a 2.5-ft path
// between every two; one in four is herbs; the way from the door to the gate stays clear. The compost heap in the far
// corner, the water barrel at the house wall (or by the gate), the barrow, a spade left standing in a bed's end,
// baskets of what was pulled today; berry bushes inside the fence.
function hutGarden(ctx) {
  const Y = hutPlot(ctx, 'vegetable garden', ['wattle fence', 'wattle fence', 'picket fence']), { cx, cz, gate, A, rect } = Y;
  const line = gate && Y.start ? [Y.start, gate.inner] : null; // the way from the house door to the gate: no bed lies across it
  const [bw, bd] = hutDims(ctx, 'vegetable-patch'); // (the herb bed is narrower and a little shorter: it sits inside the same pitch)
  // beds run across the plot's SHORT axis (their length), in a row along its long axis; two rows where the depth allows
  const alongX = ctx.W >= ctx.D, U0 = alongX ? rect[0] : rect[1], U1 = alongX ? rect[2] : rect[3], V0 = alongX ? rect[1] : rect[0], V1 = alongX ? rect[3] : rect[2];
  const pitch = bw + 2.5, rows = (V1 - V0) >= 2 * bd + 5.5 ? 2 : 1, vFree = V1 - V0 - rows * bd, vGap = rows === 2 ? Math.min(4, vFree / 3) : 0, v0 = V0 + (vFree - vGap) / 2;
  const cols = Math.max(1, Math.floor((U1 - U0 - 1 + 2.5) / pitch)), u0 = (U0 + U1) / 2 - (cols - 1) * pitch / 2, beds = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const herb = (c + r * 2) % 4 === 3 && ccmHas(ctx, 'trade-herb-bed'), id = herb ? 'trade-herb-bed' : 'vegetable-patch', u = u0 + c * pitch, v = v0 + bd / 2 + r * (bd + vGap);
    if (line && segHitsRect(line[0], line[1], alongX ? u : v, alongX ? v : u, (alongX ? bw : bd) / 2 + 1.4, (alongX ? bd : bw) / 2 + 1.4)) continue;
    const b = ccmHas(ctx, id) && hutExact(ctx, () => hutAt(ctx, id, [[alongX ? u : v, alongX ? v : u, alongX ? 0 : Math.PI / 2]], { layer: beds.length ? 'furnish' : 'anchor', rule: 'garden-bed', why: 'vegetable beds in rows, a path between every two' })); if (b) beds.push(b); }
  if (!beds.length) { const b = ccmCentre(ctx, ['vegetable-patch', 'trade-herb-bed'], { label: 'vegetable bed', rule: 'garden-bed', rot: alongX ? 0 : Math.PI / 2 }); if (b) beds.push(b); }
  if (!beds.length) return hutPlotFail(ctx, 'vegetable garden has no room for a bed');
  if (line) Y.path(/grass|lawn/.test(hutGround(ctx)));
  const far = Y.farCorner(), ref = Y.start || (gate ? gate.inner : [cx, cz]);
  Y.corner(['compost-heap'], far[0], { why: 'the compost heap in the far corner' });
  Y.atEdge(['rain-barrel', 'barrel'], { built: Y.backSides.length ? true : null, near: ref, why: 'the water barrel' });
  Y.atEdge(['wheelbarrow'], { near: gate ? gate.inner : ref, clearGate: 3, why: 'the barrow, inside the gate' });
  const b0 = beds[beds.length > 2 ? 1 : 0];
  hutNear(ctx, ['spade-garden', 'rake'], [b0.x + (alongX ? bw / 2 + 0.8 : 0), b0.z + (alongX ? 0 : bw / 2 + 0.8)], { r0: 0, r1: 1.8, layer: 'dress', face: false, rots: [alongX ? 0 : Math.PI / 2], rule: 'floor-clutter', why: 'the spade, laid down in the path' });
  for (const b of ctx.pick(beds.map((_, i) => i), 9).slice(0, Math.max(1, Math.min(3, Math.round(beds.length / 3)))).map(i => beds[i]).filter((b, i, l) => l.indexOf(b) === i)) hutNear(ctx, ['turnip-basket', 'vegetable-basket-mixed', 'watering-can', 'cabbage-crate', 'bucket'], [b.x, b.z], { r0: Math.min(bw, bd) / 2 + 0.4, r1: Math.max(bw, bd) / 2 + 1.6, layer: 'dress', face: false, why: 'what was pulled today, set down by the bed' });
  Y.atEdge(['bean-poles-wigwam'], { built: false, far: ref, why: 'the bean poles, at the far side' }); if (A >= 450) Y.atEdge(['bean-poles-wigwam'], { built: false, far: ref, why: 'a second wigwam of beans' });
  Y.atEdge(['beehive-skep'], { built: false, near: far[1], why: 'the bee skeps, out of the way' });
  if (A >= 400) Y.atEdge(['scarecrow-post'], { built: false, near: far[2], why: 'the scarecrow' });
  Y.plants(['bush-berry', 'bush', 'planter-barrel'], Math.max(1, Math.min(4, Math.round(A / 220))), { why: 'berry bushes inside the fence' });
  if (A >= 600) Y.atEdge(['bench-garden', 'log-seat'], { near: ref, why: 'a seat by the door' });
  if (A >= 700) Y.atEdge(['dog-kennel', 'compost-heap'], { near: gate ? gate.inner : far[1], why: 'by the gate' });
  ctx.growth.push(`${beds.length} beds in ${rows} row${rows > 1 ? 's' : ''}`);
  return hutPlotDone(ctx, Y, beds[0], `vegetable garden: ${beds.length} beds in rows, ${Y.info.edge}`);
}

// FIELD EDGE (outdoor): the crop stands in one block, rows running the long way, to the far side of the plot; a headland
// (the unploughed strip, 7 ft) along the near side holds what the work needs: sheaves stood in stooks, bales, the cart,
// a fork, sacks. Post-and-rail on the open edges, a field gate.
function hutField(ctx) {
  const Y = hutPlot(ctx, 'field edge', ['post-and-rail fence', 'post-and-rail fence', 'wattle fence', 'none']), { cx, cz, gate, A, rect } = Y;
  const near = Y.d ? Y.d.side : gate ? gate.side : ctx.longSides()[0], horiz = near === 'N' || near === 'S', deep = horiz ? ctx.D : ctx.W, L = ctx.sideLen(near);
  const head = Math.min(9.5, Math.max(5, deep * 0.3)), P = (t, s) => ctx.sidePoint(near, t, s);
  const [bw, bd] = hutDims(ctx, 'vegetable-patch'); // (w across, d front to back, as the mesh stands)
  // crop block: patches edge to edge, rows parallel to the near side (so the furrows run the length of the field)
  // the way out: a gate in the far edge gets a lane through the crop straight to it; a gate in a side edge a verge along that side
  const gFar = gate && gate.side === OPP_SIDE[near], gLat = gate && gate.side !== near && !gFar, latLow = gLat && (gate.side === 'W' || gate.side === 'N');
  const s1 = deep - Y.edgeIn - 0.5, s0 = Math.max(head + 0.6, Math.min(deep * 0.42, s1 - 2 * (bw + 0.06) - 0.05)), /* (the crop stands on the far part; between it and the headland the ground lies ploughed and bare) */ t0 = Y.edgeIn + 0.5 + (gLat && latLow ? 4.4 : 0), t1 = L - Y.edgeIn - 0.5 - (gLat && !latLow ? 4.4 : 0), rot = SIDES[near].rot + Math.PI / 2;
  const nT = Math.max(1, Math.floor((t1 - t0) / (bd + 0.06))), nS = Math.max(1, Math.floor((s1 - s0) / (bw + 0.06))), crop = [];
  const tt0 = (t0 + t1) / 2 - (nT - 1) * (bd + 0.06) / 2, ss0 = s1 - bw / 2 - (nS - 1) * (bw + 0.06);
  if (ccmHas(ctx, 'vegetable-patch') && s1 - s0 >= bw) for (let j = 0; j < nS; j++) for (let i = 0; i < nT; i++) { const [x, z] = P(tt0 + i * (bd + 0.06), ss0 + j * (bw + 0.06)); if (gFar && Math.abs(tt0 + i * (bd + 0.06) - gate.tc) < bd / 2 + 2.2) continue; /* the lane to the far gate */ const p = hutExact(ctx, () => hutLay(ctx, 'vegetable-patch', x, z, rot, crop.length ? 'furnish' : 'anchor', 'crop-row', 'the crop: rows side by side, running the length of the field')); if (p) crop.push(p); }
  if (!crop.length) return hutPlotFail(ctx, 'field edge has no room for a crop row');
  // the headland: the way from the gate (or the door) along it, kept clear on its field side
  if (gate) ccmWalk(ctx, 'path', [Y.start || P(L / 2, head / 2), gate.inner], { width: 3 });
  const stooks = Math.max(2, Math.min(7, Math.round(L / 7)));
  for (let i = 0; i < stooks; i++) { const [x, z] = P(L * (i + 0.5) / stooks, head - 1.1); hutNear(ctx, ['rural-grain-stook', 'rural-straw-bundle'], [x, z], { r0: 0, r1: 1.5, face: false, rule: 'sheaf', why: 'stooks stood up in a row along the headland' }); if (i % 2 === 0 && !ccmHas(ctx, 'rural-grain-stook')) hutNear(ctx, ['rural-straw-bundle'], [x + (horiz ? 1.2 : 0), z + (horiz ? 0 : 1.2)], { r0: 0, r1: 1.2, face: false, rule: 'sheaf', why: 'sheaves leaning together' }); }
  { const [x, z] = P(L * 0.5, (head + s0) / 2 + 1); hutNear(ctx, ['scarecrow-post'], [x, z], { r0: 0, r1: 3, face: false, rots: [SIDES[OPP_SIDE[near]].rot], rule: 'scarecrow', why: 'the scarecrow, between the stooks and the crop' }); }
  if (A >= 500) ccmScaled(ctx, 'haystack-field', 0.8, () => hutNear(ctx, ['haystack-field'], P(L * 0.1 + 3, head / 2 + 0.5), { r0: 0, r1: 4, face: false, layer: 'anchor', rule: 'yard-stack', why: 'the haystack at the end of the headland' }));
  hutNear(ctx, ['plough'], P(L * 0.5, head + 2.2), { r0: 0, r1: 5, face: false, rots: [rot], rule: 'plough', why: 'the plough, left at the end of its furrow' });
  const cart = A >= 700 ? hutNear(ctx, ['wagon', 'cart-hand'], P(L * 0.72, 2.6), { r0: 0, r1: 5, face: false, rots: [rot], why: 'the cart on the headland' }) : hutNear(ctx, ['cart-hand', 'wheelbarrow'], P(L * 0.72, 2.2), { r0: 0, r1: 4, face: false, rots: [rot], why: 'the hand cart on the headland' });
  for (let i = 0, k = Math.max(2, Math.min(5, Math.round(A / 220))); i < k; i++) hutNear(ctx, ['hay-bale'], P(L * 0.25, head / 2 - 0.5), { r0: 0, r1: 3.5, face: false, rots: [rot, rot + Math.PI / 2], rule: 'like-with-like', why: 'bales stacked on the headland' });
  hutNear(ctx, ['sack', 'grain-sack-open'], cart ? [cart.x, cart.z] : P(L / 2, head / 2), { r0: 2, r1: 5, layer: 'store', face: false, why: 'sacks by the cart' });
  hutNear(ctx, ['pitchfork', 'rake'], P(L * 0.45, head / 2), { r0: 0, r1: 3, layer: 'dress', face: false, rule: 'floor-clutter', why: 'the fork, dropped where the work stopped' });
  for (let i = 0, k = Math.max(2, Math.round(L / 9)); i < k; i++) Y.patch('decal-grass-tuft', ...P(L * (i + 0.5) / k + ctx.r(-1.5, 1.5), ctx.r(1, head - 1)), ctx.r(0, 6), 'grass on the unploughed headland');
  if (A >= 500) Y.plants(['tree-deciduous', 'bush'], 1, { near: P(Y.edgeIn + 3, 2), why: 'a tree at the corner of the field' });
  if (A >= 900) Y.plants(['bush', 'bush-berry'], 2, { why: 'the hedge beginning' });
  ctx.growth.push(`${crop.length} crop patches in ${nS} band${nS > 1 ? 's' : ''}`);
  return hutPlotDone(ctx, Y, crop[0], `field edge: crop rows the length of the plot, a headland with sheaves${cart ? ' and the cart' : ''}`);
}

// ORCHARD CORNER (outdoor): fruit trees IN ROWS on a square grid (that is what makes it an orchard and not a wood),
// meadow grass under them; under and between: crates and baskets of apples, a log to sit on, the barrow; a dry-stone
// wall or a rail fence; the press by the gate in a big one.
function hutOrchard(ctx) {
  const Y = hutPlot(ctx, 'orchard', ['stone wall', 'stone wall', 'post-and-rail fence', 'wattle fence']), { cx, cz, gate, A, rect } = Y; // (no reserved path: you walk under the trees, between the rows)
  const k = 0.72, crown = Math.max(...hutDims(ctx, 'tree-fruit').slice(0, 2)) * k, pitch = crown + 2.2, trees = [];
  const nx = Math.max(1, Math.floor((rect[2] - rect[0] - crown) / pitch) + 1), nz = Math.max(1, Math.floor((rect[3] - rect[1] - crown) / pitch) + 1);
  const x0 = (rect[0] + rect[2]) / 2 - (nx - 1) * pitch / 2, z0 = (rect[1] + rect[3]) / 2 - (nz - 1) * pitch / 2;
  if (ccmHas(ctx, 'tree-fruit')) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const t = hutExact(ctx, () => ccmScaled(ctx, 'tree-fruit', k, () => hutAt(ctx, 'tree-fruit', [[x0 + i * pitch, z0 + j * pitch, ctx.ri(0, 3) * Math.PI / 2]], { layer: trees.length ? 'furnish' : 'anchor', rule: 'orchard-tree', why: 'fruit trees in rows, a cart\'s width apart' }))); if (t) trees.push(t); }
  if (!trees.length) { const t = ccmCentre(ctx, ['tree-fruit', 'tree-deciduous'], { label: 'fruit tree', rule: 'orchard-tree' }); if (t) trees.push(t); }
  if (!trees.length) return hutPlotFail(ctx, 'orchard has no room for a tree');
  Y.info.plants.placed = trees.length;
  // the harvest: crates and baskets at the foot of some trees (outside the crown's box: between the rows)
  const between = (t, r) => [t.x + (pitch / 2) * (ctx.chance(0.5) ? 1 : -1) * (r ? 1 : 0), t.z + (pitch / 2) * (ctx.chance(0.5) ? 1 : -1) * (r ? 0 : 1)];
  for (const [i, t] of trees.entries()) { if (i % 2) continue; const pt = between(t, i % 4 === 0); hutNear(ctx, ['apple-crate', 'fruit-crate-mixed', 'apple-basket'], pt, { r0: 0, r1: 2.5, layer: 'store', face: false, why: 'apples picked and crated between the rows' }); if (i % 4 === 0) hutNear(ctx, ['apple-basket', 'apple-pile', 'bucket'], pt, { r0: 0.8, r1: 3, layer: 'dress', face: false, why: 'a basket of windfalls' }); }
  const ref = Y.start || (gate ? gate.inner : [cx, cz]);
  Y.atEdge(['log-seat', 'bench-garden'], { near: ref, why: 'a log to sit on' });
  Y.atEdge(['beehive-skep'], { built: false, far: ref, why: 'the bee skeps at the far wall' });
  Y.atEdge(['wheelbarrow', 'cart-hand'], { near: gate ? gate.inner : ref, clearGate: 3, why: 'the barrow, inside the gate' });
  if (A >= 700) { Y.atEdge(['cider-press'], { near: gate ? gate.inner : ref, clearGate: 4, why: 'the cider press, set up by the gate for the pressing' }); Y.atEdge(['barrel'], { near: gate ? gate.inner : ref, clearGate: 4, layer: 'store', why: 'a barrel for the juice' }); }
  if (A >= 500) Y.plants(['bush-berry', 'bush'], Math.min(3, Math.round(A / 400)), { why: 'brambles along the wall' });
  for (let i = 0, n = Math.max(3, Math.round(A / 110)); i < n; i++) Y.patch('decal-grass-tuft', ctx.r(rect[0], rect[2]), ctx.r(rect[1], rect[3]), ctx.r(0, 6), 'long grass under the trees');
  ctx.growth.push(`${trees.length} fruit trees in ${nz} row${nz > 1 ? 's' : ''} of ${nx}`);
  return hutPlotDone(ctx, Y, trees[0], `orchard: ${trees.length} fruit trees in rows, ${Y.info.edge}`);
}

// FARMYARD (outdoor): the well in the open (off the straight way from the door to the gate), a trough by it; the way
// to the gate trodden bare; at the house wall the woodpile and the chopping block, the water barrel; at the edges the
// cart, bales under a scatter of hay, the kennel by the gate, the muck heap in the far corner; in a big yard a
// woodshed or the outhouse on the far edge and a tree. Sparse: the middle stays open for turning a cart.
function hutFarmyard(ctx) {
  const Y = hutPlot(ctx, 'farmyard', ['wattle fence', 'post-and-rail fence', 'post-and-rail fence', 'stone wall']) /* (never open: without its fence it read as a workshop yard) */, { cx, cz, gate, A, rect } = Y;
  Y.path(/grass|lawn/.test(hutGround(ctx)));
  const ref = Y.start || (gate ? gate.inner : [cx, cz]), far = Y.farCorner(), want = Math.max(5, Math.round(yardTarget(A) * A / 100 * 1.25)), room = () => Y.count() < want;
  let well = null;
  if (Math.min(ctx.W, ctx.D) >= 13) { const line = gate && Y.start ? [Y.start, gate.inner] : null;
    well = ccmQuiet(ctx, () => ctx.put(ccmFirst(ctx, A >= 900 && ctx.chance(0.4) ? ['well-house', 'well'] : ['well', 'well-house']), function* (dm) { for (let x = rect[0] + dm.w / 2 + 2; x <= rect[2] - dm.w / 2 - 2; x += 0.5) for (let z = rect[1] + dm.d / 2 + 2; z <= rect[3] - dm.d / 2 - 2; z += 0.5) yield { x, z, rot: 0 }; },
      (c) => Math.hypot(c.x - cx, c.z - cz) + (line && segDist([c.x, c.z], line[0], line[1]) < 5.5 ? 50 : 0), { layer: 'anchor', rule: 'yard-focal', unique: true, why: 'the well: in the open, off the way to the gate', extra: { focal: true } }));
    if (well) { ccmClearRound(ctx, well, 1.2); hutNear(ctx, ['bucket', 'rural-water-bucket-stable'], [well.x, well.z], { r0: well.dims[0] / 2 + 0.5, r1: well.dims[0] / 2 + 1.6, allowKeep: true, layer: 'dress', face: false, why: 'the bucket by the well' });
      hutNear(ctx, ['water-trough', 'feed-trough'], [well.x, well.z], { r0: well.dims[0] / 2 + 2.2, r1: well.dims[0] / 2 + 5, face: false, rots: [0, Math.PI / 2], why: 'the trough, filled from the well' }); } }
  // at the house wall (or, alone, along the edge by the gate)
  const built = Y.backSides.length ? true : null;
  const wood = Y.atEdge(A >= 500 ? ['woodpile-long', 'woodpile'] : ['woodpile'], { built, near: ref, why: 'the woodpile against the wall', layer: 'store' });
  if (wood) { hutNear(ctx, ['chopping-block'], front(wood, 2), { r0: 0, r1: 2.5, face: false, why: 'the chopping block before the woodpile' }); }
  if (room()) Y.atEdge(['rain-barrel', 'barrel'], { built, near: ref, layer: 'store', why: 'the water barrel under the eaves' });
  if (room() && gate) Y.atEdge(['dog-kennel'], { near: gate.inner, clearGate: 3, why: 'the kennel by the gate' });
  if (room()) ccmScaled(ctx, 'manure-heap', A >= 600 ? 1 : 0.7, () => Y.corner(['manure-heap'], far[0], { why: 'the muck heap in the far corner' }));
  // the cart and the hay
  const cart = room() ? Y.atEdge(A >= 800 ? ['wagon', 'cart-hand'] : ['cart-hand', 'wheelbarrow'], { built: false, far: ref, why: 'the cart, drawn up at the edge' }) : null;
  let hay = null; for (let i = 0, k = Math.max(1, Math.min(4, Math.round(A / 300))); i < k && room(); i++) hay = (hay ? hutNear(ctx, ['hay-bale'], [hay.x, hay.z], { r0: 1, r1: 3, face: false, rots: [hay.rot], rule: 'like-with-like', why: 'bales stacked together' }) : Y.atEdge(['hay-bale'], { near: far[1], why: 'bales at the edge of the yard' })) || hay;
  if (hay) { Y.patch('rug-hay-scatter', hay.x + 0.8, hay.z + 0.8, ctx.r(0, 3), 'hay dropped round the bales'); for (let i = 0; i < (A >= 600 ? 2 : 1); i++) hutNear(ctx, ['rural-grain-stook'], [hay.x, hay.z], { r0: 2, r1: 5.5, face: false, rule: 'sheaf', why: 'stooks stood to dry by the hay' }); }
  if (A >= 450) ccmScaled(ctx, 'haystack-field', A >= 900 ? 1 : 0.8, () => Y.corner(['haystack-field'], far[1], { built: false, layer: 'anchor', rule: 'yard-stack', why: 'the haystack at the edge of the yard' }));
  if (A >= 1100) Y.corner(['dovecote'], far[3], { built: false, layer: 'anchor', rule: 'yard-building', why: 'the dovecote' });
  if (room() && A >= 700) Y.atEdge(['plough'], { near: far[2], why: 'the plough, left at the edge' });
  if (room() && A >= 450) Y.atEdge(['hitching-post', 'grindstone'], { any: true, near: gate ? gate.inner : ref, clearGate: 3.5, why: 'by the gate' });
  if (room() && A >= 600) Y.atEdge(['wheelbarrow', 'rural-manure-barrow'], { near: far[0], why: 'the barrow by the muck heap' });
  if (A >= 900) Y.corner(['woodshed', 'outhouse', 'cart-shed'], far[2], { built: false, why: 'an outbuilding on the far edge', layer: 'anchor', rule: 'yard-building' });
  if (A >= 1300) Y.atEdge(['outhouse', 'cart-shed'], { built: false, far: ref, why: 'another outbuilding on the far edge', layer: 'anchor', rule: 'yard-building' });
  if (A >= 700) { Y.atEdge(['washtub'], { built, near: ref, layer: 'dress', why: 'the washtub by the door' }); if (A >= 1000) Y.atEdge(['clothesline'], { built: false, far: gate ? gate.inner : ref, why: 'the washing line at the quiet edge' }); }
  if (A >= 500) Y.plants(A >= 900 ? ['tree-deciduous', 'tree-fruit'] : ['bush', 'bush-berry'], 1, { near: far[3], why: 'at the corner of the yard' });
  if (A >= 700) Y.plants(['bush', 'bush-berry'], Math.min(3, Math.round(A / 500)), {});
  // mud where the beasts stand
  if (well) Y.patch('decal-dirt-patch', well.x + 2.5, well.z + 1.5, ctx.r(0, 3), 'trodden mud by the well', 1.3);
  if (gate) Y.patch('decal-dirt-patch', gate.inner[0], gate.inner[1], ctx.r(0, 3), 'trodden mud in the gateway', 1.2);
  if (A >= 500) Y.patch('puddle', cx + ctx.r(-4, 4), cz + ctx.r(-4, 4), ctx.r(0, 3), 'a puddle', 1.6);
  return hutPlotDone(ctx, Y, well || wood || cart, `farmyard: ${well ? 'the well, ' : ''}${Y.info.edge === 'none' ? 'open' : Y.info.edge}${cart ? ', the cart' : ''}`);
}

// the leg of an L-shaped farm room: stores along the walls and one light, never a second hearth
function hutAnnex(ctx, { wall = ['bench-long', 'chest-plain', 'barrel'], pile = ['sack', 'barrel', 'crate'] } = {}) {
  const walls = ctx.wallsByDoor(), cells = ccmCells(ctx);
  for (let i = 0, k = Math.max(1, Math.min(4, Math.round(cells / 5))); i < k; i++) hutWall(ctx, wall, walls, { any: true, at: (i + 0.5) / k, sideCost: 0.5, why: 'against the wall' });
  hutPile(ctx, pile, Math.max(2, Math.min(5, Math.round(cells / 3))), 'stores in the corner');
  hutLights(ctx, walls.slice(0, 2), { min: 1, max: 2 });
}

// ---- registration
PROGRAM_OF['hut-bedroom'] = 'guest'; // the farmhouse bedroom IS the inn's guest room program (bed, wash, stow) dressed from the farm's recipe
PROGRAM_OF['hut-barn'] = 'barn';     // the hay barn IS the inn's barn (the drive, the mow, the pens, the tool wall)
Object.assign(KEY, { 'hut-cottage': hutCottage, 'hut-kitchen': hutKitchen, 'hut-loft': hutLoft, 'hut-passage': hutPassage, 'hut-cellar': hutCellar, 'hut-byre': hutByre, 'hut-coop': hutCoop,
  'hut-granary': hutGranary, 'hut-dairy': hutDairy, 'hut-pigsty': hutPigsty, 'hut-garden': hutGarden, 'hut-field': hutField, 'hut-orchard': hutOrchard, 'hut-farmyard': hutFarmyard });
Object.assign(MENUS, {
  'hut-cottage': ccmAnnex((ctx) => hutAnnex(ctx)), 'hut-kitchen': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['cupboard', 'bench-long', 'barrel'] })), 'hut-loft': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['bed-straw-pallet', 'chest-plain'], pile: ['sack', 'apple-crate', 'hay-bale'] })),
  'hut-passage': ccmAnnex((ctx) => hutAnnex(ctx)), 'hut-cellar': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['shelving-freestanding', 'barrel'], pile: ['potato-crate', 'sack', 'barrel', 'cabbage-crate'] })),
  'hut-byre': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['feed-trough', 'hay-bale', 'grain-bin-stable'], pile: ['hay-bale', 'rural-feed-sack-open', 'rural-straw-bundle'] })), 'hut-coop': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['crate', 'feed-trough'], pile: ['hay-pile', 'rural-feed-sack-open'] })),
  'hut-granary': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['grain-bin-stable', 'flour-bin', 'barrel'], pile: HUT_SACKS })), 'hut-dairy': ccmAnnex((ctx) => hutAnnex(ctx, { wall: ['cheese-shelf-aging', 'storage-jar'], pile: ['storage-jar', 'barrel', 'cheese-stack'] })),
});
Object.assign(DENSITY, { 'hut-cottage': 6, 'hut-kitchen': 5.5, 'hut-bedroom': 8, 'hut-loft': 5, 'hut-passage': 3.5, 'hut-cellar': 9, 'hut-byre': 5, 'hut-coop': 12, 'hut-barn': 4.5, 'hut-granary': 6, 'hut-dairy': 7 });
Object.assign(FOCAL, { 'hut-cottage': 'the hearth (open, in the middle, when poor)', 'hut-kitchen': 'cooking hearth', 'hut-cellar': 'store shelves', 'hut-coop': 'nest boxes', 'hut-granary': 'grain bins', 'hut-dairy': 'cheese shelves',
  'hut-garden': 'beds in rows', 'hut-field': 'the crop rows', 'hut-orchard': 'trees in rows', 'hut-farmyard': 'the well', 'hut-pigsty': 'the trough' });
Object.assign(KEY_RE, { 'hut-cottage': /^(hearth-|fireplace-wall|cook-hearth)/, 'hut-kitchen': /^(cook-hearth|fireplace-wall)/, 'hut-bedroom': /^bed-/, 'hut-loft': /^(bed-straw-pallet|bedroll|cot)$/, 'hut-passage': null, 'hut-cellar': /^(shelving-freestanding|cheese-shelf-aging|cupboard)$/,
  'hut-byre': /^stable-stall/, 'hut-coop': /^(nest-box-row|crate)$/, 'hut-barn': null, 'hut-granary': /^(grain-bin-stable|flour-bin|barrel)$/, 'hut-dairy': /^(cheese-shelf-aging|trade-cheese-aging-shelf|shelving-freestanding)$/,
  'hut-pigsty': null, 'hut-garden': null, 'hut-field': null, 'hut-orchard': null, 'hut-farmyard': null });
// <<< type:hut
