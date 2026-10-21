// ---------------- mansion (2026-10-05): eight state rooms, two service rooms ----------------
// Every mansion room type carries wealth 'fine' and tiers ['noble', 'ccm'] (build_data.py): chooseSku rolls the
// mansion's own meshes (tier 'noble') wherever a role has one, the inn's fine mesh where it has none. A program names a
// variant with `sku: { shape }` only where the design asks for one piece in particular (the 8-ft oval table, the green
// fireplace, the small chandelier).
const MANSION_PAINT = ['painting-landscape', 'painting-still-life', 'painting-portrait'], MANSION_SCONCE = ['sconce-candle-triple'];
const mansionT = (ctx, side, p) => side === 'N' || side === 'S' ? p.x - ctx.X0 : p.z - ctx.Z0; // where along a wall a piece stands
const mansionSkuSize = (ctx, id, shape) => { const o = ctx.lib.objects[id], k = o?.skus.find(s => s.shape === shape) || o?.skus[0]; return ((k && k.size) || o?.size || [24, 24, 24]).map(v => v / 12); };
// one thing at one exact spot (ccmAt with a sku wish), quietly
function mansionAt(ctx, id, spots, o = {}) {
  if (!ccmHas(ctx, id)) return null;
  const list = Array.isArray(spots[0]) ? spots : [spots];
  return ccmQuiet(ctx, () => ctx.put(id, () => list.map(([x, z, rot], i) => ({ x, z, rot, i })), (c) => c.i, { layer: o.layer || 'furnish', rule: o.rule || 'placed', why: o.why || '', allowKeep: !!o.allowKeep, sku: o.sku, extra: o.extra || {}, failWhy: 'no room at its spot' }));
}
// a thing against a wall near a point along it (t), or wherever that wall has room
function mansionWall(ctx, id, sides, o = {}) {
  if (!ccmHas(ctx, id)) return null;
  return ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap: o.gap ?? 0.05 }), (c) => sides.indexOf(c.side) * (o.sideCost ?? 4) + (o.near ? Math.hypot(c.x - o.near[0], c.z - o.near[1]) : Math.abs(c.t - ctx.sideLen(c.side) * (o.at ?? 0.5))), { layer: o.layer || 'furnish', rule: o.rule || 'against-wall', why: o.why || '', sku: o.sku }));
}
// hang something at an exact place on a wall: t ft along it, its bottom `bottom` ft up (a pier mirror over its console,
// a sconce either side of it). Never on a door or a window, never over another hung thing.
function mansionHang(ctx, id, side, t, bottom, o = {}) {
  if (!ccmHas(ctx, id)) return null;
  const sku = ctx.chooseSku(id, o.sku || {}); if (!sku) return null;
  const dm = ctx.dims(id, sku), flat = sku.kind === 'flat', w = dm.w, L = ctx.sideLen(side);
  if (t - w / 2 < 0.2 || t + w / 2 > L - 0.2) return null;
  if (ctx.overlapsT(ctx.doorT[side], t - w / 2 - 0.3, t + w / 2 + 0.3) || ctx.overlapsT(ctx.windowT[side], t - w / 2, t + w / 2) || ctx.mounts[side].some(([a, b]) => t - w / 2 < b + 0.15 && a - 0.15 < t + w / 2)) return null;
  ctx.mounts[side].push([t - w / 2, t + w / 2]);
  const [x, z] = ctx.sidePoint(side, t, (flat ? 0.05 : dm.d) / 2 + 0.02);
  return ctx.record(id, sku, dm, x, Math.max(0.3, Math.min(bottom, CEIL - 0.2 - dm.h)), z, SIDES[side].rot, o.layer || 'dress', o.layer === 'light' ? 'wall-light' : 'wall-mount', o.why || `hung on the ${SIDE_LABEL[side]} wall`, { side, orient: flat ? 'wall' : undefined });
}
// a console table against a wall with the gilt pier mirror hung above it and a candle sconce either side of the mirror
function mansionConsole(ctx, side, at = 0.5) {
  const c = mansionWall(ctx, 'table-console', [side], { at, why: 'console table against the wall, under its pier mirror' });
  if (!c) return null;
  const t = mansionT(ctx, side, c), m = mansionHang(ctx, 'mirror-pier-gilt', side, t, 3.0, { why: 'gilt pier mirror above the console' });
  const half = (m ? m.dims[0] : c.dims[0]) / 2 + 1.1;
  for (const sg of [-1, 1]) mansionHang(ctx, 'sconce-candle-triple', side, t + sg * half, 5.0, { layer: 'light', why: 'candle sconce beside the pier mirror' });
  ccmQuiet(ctx, () => ctx.surface(ccmAny(ctx, ['vase-flowers', 'clock-mantel', 'candelabra']), { on: s => s.uid === c.uid, why: 'on the console' }));
  return c;
}
// a hanging light of a named variant (ctx.ceiling() takes no sku wish): the grand chandelier, or its small brother
function mansionChandelier(ctx, at, small, why) {
  const id = ccmFirst(ctx, ['chandelier-grand', 'chandelier-ring']); if (!id) return null;
  const sku = ctx.chooseSku(id, id === 'chandelier-grand' ? { shape: small ? 's2' : '' } : {}); if (!sku) return null;
  const dm = ctx.dims(id, sku), m = Math.hypot(dm.w, dm.d) / 2 + 0.1;
  const x = Math.min(ctx.X1 - m, Math.max(ctx.X0 + m, at[0])), z = Math.min(ctx.Z1 - m, Math.max(ctx.Z0 + m, at[1]));
  return ctx.record(id, sku, dm, x, Math.max(0.5, CEIL - dm.h - 0.25), z, 0, 'light', 'ceiling', why || 'chandelier');
}
// drapes at every window that nothing was hung over (rule 'drapes': they belong ON the window)
function mansionDrapes(ctx) { for (const s of ['N', 'S', 'E', 'W']) for (let i = 0; i < ctx.windowT[s].length; i++) ccmQuiet(ctx, () => ctx.mount('curtains-drapes', { sides: [s], height: 5.2, atWindow: true, rule: 'drapes', why: 'drapes at the window' })); }
function mansionPaintings(ctx, n, sides = ['N', 'S', 'E', 'W']) { for (let i = 0; i < n; i++) { const id = ccmAny(ctx, MANSION_PAINT); if (id) ccmQuiet(ctx, () => ctx.mount(id, { sides: [sides[i % sides.length]], height: 5.6, why: 'a painting on the wall' })); } }
// the marble fireplace on a wall, a 2.5-ft hearth kept clear, a sconce either side, fire-screen and irons beside it
function mansionHearth(ctx, sides, { shape, focal = false, label = 'marble fireplace' } = {}) {
  let f = null;
  if (focal) f = ccmFocalOn(ctx, sides[0], ['fireplace-marble', 'fireplace-wall'], { label, rule: 'key-hearth', why: 'the marble fireplace: centred on the wall facing the door (axial focal)' });
  if (!f) { const id = ccmFirst(ctx, ['fireplace-marble', 'fireplace-wall']); if (id) f = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides), (c) => sides.indexOf(c.side) * 6 + Math.abs(c.t - ctx.sideLen(c.side) / 2), { layer: 'anchor', rule: focal ? 'key-hearth' : 'hearth', why: 'the marble fireplace, centred on its wall', sku: shape ? { shape } : undefined, unique: focal })); }
  if (!f) return null;
  const [fx, fz] = ctx.facingVec(f.rot), [aw, ad] = ctx.aabb(f.dims[0] + 0.5, 2.5, f.rot);
  ctx.mark(f.x + fx * (f.dims[2] / 2 + 1.25), f.z + fz * (f.dims[2] / 2 + 1.25), aw, ad, KEEP);
  const t = mansionT(ctx, f.side, f);
  for (const sg of [-1, 1]) mansionHang(ctx, 'sconce-candle-triple', f.side, t + sg * (f.dims[0] / 2 + 1.0), 5.0, { layer: 'light', why: 'candle sconce beside the fireplace' });
  ccmFlank(ctx, f, ['fire-screen'], { off: 0.3, n: 1, layer: 'dress', why: 'fire screen beside the hearth' });
  mansionAt(ctx, 'fire-irons', [f.x - fz * -(f.dims[0] / 2 + 0.7), f.z + fx * -(f.dims[0] / 2 + 0.7) , f.rot], { layer: 'dress', why: 'fire irons beside the hearth' });
  return f;
}
// a sitting group before a hearth: rug, a sofa (or settee) facing the fire across it, an armchair each side turned
// inward, a low table in the middle, a footstool. All of it floats clear of the walls.
function mansionSitting(ctx, f, { sofa = ['sofa', 'settee'], chairs = ['chair-upholstered'], chairSku, dist = 7.5, small = false } = {}) {
  const [fx, fz] = ctx.facingVec(f.rot), lx = fz, lz = -fx, at = (a, l) => [f.x + fx * (f.dims[2] / 2 + a) + lx * l, f.z + fz * (f.dims[2] / 2 + a) + lz * l];
  const out = [];
  ccmQuiet(ctx, () => ctx.rug(ccmAny(ctx, small ? ['rug-round-fine', 'rug-small'] : ['rug-grand', 'rug-round-fine']), { at: at(dist / 2 + 1, 0), rot: f.rot, why: 'the rug before the hearth' })) || ccmQuiet(ctx, () => ctx.rug('rug-small', { at: at(3.5, 0), rot: f.rot, why: 'a rug before the hearth' }));
  const sid = small ? null : ccmFirst(ctx, sofa);
  const s = sid ? mansionAt(ctx, sid, [dist, dist + 0.5, dist - 1, dist + 1.5, dist - 2].map(a => [...at(a + ccmSize(ctx, sid)[1] / 2, 0), f.rot + Math.PI]), { rule: 'inward-seat', why: 'facing the fire across the rug' }) : null;
  if (s) out.push(s);
  const side = small ? 2.6 : Math.max(3.6, (s ? s.dims[0] : 5) / 2 + 1.9);
  for (const sg of [-1, 1]) { const id = ccmAny(ctx, chairs); const c = id && mansionAt(ctx, id, [3.6, 4.4, 5.2, 3].map(a => [...at(a, sg * side), Math.atan2(-sg * lx - fx * 0.25, -sg * lz - fz * 0.25)]), { rule: 'inward-seat', why: 'armchair turned to the fire', sku: chairSku }); if (c) out.push(c); }
  const tb = mansionAt(ctx, 'table-round-small', [3.9, 4.4, 3.4].map(a => [...at(a, 0), f.rot]), { why: 'a low table in the middle of the group' });
  if (tb) for (const id of ctx.pick(['tea-service-tray', 'vase-flowers', 'clock-mantel', 'candelabra', 'plant-pot'], 2)) ccmQuiet(ctx, () => ctx.surface(id, { on: q => q.uid === tb.uid, layer: /candel/.test(id) ? 'light' : 'dress', why: 'on the low table' }));
  { const ch = out.find(p => /^chair/.test(p.id)); if (ch) mansionAt(ctx, 'footstool', [0.7, 0.9, 1.1].map(a => [...front(ch, a), ch.rot]), { why: 'a footstool before the armchair', allowKeep: true }); }
  return { seats: out, table: tb };
}

// ENTRANCE HALL (hub): the grand stair centred on the wall facing the front door (or, in a hall too small for it or with
// a door in that wall, a round table at the exact centre), a console under a pier mirror on each side wall, a long-case clock, the hall stand
// by the door. Sparse and symmetric: the floor pattern is part of the read.
function mansionHall(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), lat = ccmLat(far), toDoor = SIDES[far].rot;
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), [sw, sd] = mansionSkuSize(ctx, 'stair-grand', '');
  // the stair needs its run plus 9 ft of hall in front of it, and a way past on each side
  const stairFits = ccmHas(ctx, 'stair-grand') && deep >= sd + 9 && L >= sw + 8 && !ctx.doorT[far].length;
  const stair = stairFits ? ccmFocalOn(ctx, far, ['stair-grand'], { label: 'grand stair', rule: 'key-stair', why: 'the grand stair: centred on the wall facing the front door, rising away from it (axial focal)' }) : null;
  const foot = stair ? stair.dims[2] : 0;
  let table = null;
  if (!stair || deep - foot >= 14) {
    const c = stair ? axis(foot + (deep - foot) / 2) : [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2];
    table = mansionAt(ctx, 'table-pedestal-round', [0, 0.5, -0.5, 1].map(k => [c[0] + SIDES[far].n[0] * k, c[1] + SIDES[far].n[1] * k, toDoor]), { layer: 'anchor', rule: stair ? 'centre-table' : 'key-table', why: stair ? 'the round table, halfway between the door and the foot of the stair' : 'the round table: at the exact centre of the hall', extra: stair ? {} : { focal: true } });
    if (table) { ccmQuiet(ctx, () => ctx.rug('rug-round-fine', { at: [table.x, table.z], why: 'round rug under the centre table' })); ccmQuiet(ctx, () => ctx.surface('vase-flowers', { on: s => s.uid === table.uid, why: 'flowers on the centre table' })); }
  }
  const focal = stair || table || ccmFocalOn(ctx, far, ['clock-longcase', 'table-console'], { label: 'long-case clock', rule: 'key-clock', why: 'the long-case clock: centred on the wall facing the front door (a hall too small for stair or table)' });
  if (!focal) return { fail: `entrance hall has no stair, centre table or clock (${ctx.focal?.why || 'no mesh'})` };
  if (!stair) ctx.focal = { label: table ? 'centre table' : 'long-case clock', id: focal.id, ok: true, centre: !!table };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; ccmWalk(ctx, 'approach', [d.inner, front(table || focal, 1.6)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(table || focal, 1.6)]); }
  if (table) ccmClearRound(ctx, table, 2);
  if (stair && d) ccmQuiet(ctx, () => ctx.rug('rug-runner', { at: axis(foot + (deep - foot) / 2 + (table ? 99 : 0)), rot: toDoor, why: 'runner from the door to the foot of the stair' }));
  // the side walls: console + pier mirror + sconces in the open stretch, benches on what is left
  for (const s of lat) { const c = mansionConsole(ctx, s, stair ? Math.min(0.75, (foot + (deep - foot) / 2) / deep) : 0.5); if (!c) mansionPaintings(ctx, 1, [s]); }
  const flank = ccmFlank(ctx, stair || focal, [ccmHas(ctx, 'statue-bust') ? 'statue-bust' : 'urn-decorative'], { off: stair ? 0.6 : 2.2, layer: 'furnish', why: 'a bust either side', fwd: stair ? foot / 2 + 1 : 0 });
  if (d) { mansionWall(ctx, 'hall-stand', [d.side], { near: d.inner, why: 'the hall stand beside the front door' }); mansionWall(ctx, 'clock-longcase', focal.id === 'clock-longcase' ? [] : [d.side, ...lat], { near: d.inner, sideCost: 3, why: 'the long-case clock' }); }
  if (d) for (const s of ccmLat(d.side)) ccmCorner(ctx, ccmAny(ctx, ['planter-topiary', 'palm-potted']), [d.side, s], { why: 'in the corner of the door wall', inset: 0.4 });
  ccmAlong(ctx, ['bench-upholstered'], lat, Math.min(4, Math.max(0, Math.round((deep - 8) / 10)) * 2), { why: 'a bench against the side wall' });
  if (cells >= 30) for (const s of lat) ccmCorner(ctx, ccmAny(ctx, ['armor-stand', 'urn-decorative']), [far, s], { why: 'in the far corner', inset: 0.5 });
  if (cells >= 36) ccmFlank(ctx, table || focal, ['candelabra-standing'], { off: 3.2, why: 'a floor candelabrum either side' });
  mansionPaintings(ctx, Math.max(2, Math.min(6, Math.round(cells / 8))), [...lat, ...(d ? [d.side] : []), far]);
  mansionDrapes(ctx);
  const cc = table ? [table.x, table.z] : axis(foot + (deep - foot) / 2);
  mansionChandelier(ctx, cc, cells < 20, 'the chandelier over the middle of the hall');
  if (cells >= 42 && stair) mansionChandelier(ctx, axis(foot / 2), false, 'a second chandelier over the stair');
  ccmDone(ctx);
  return { feature: focal, what: stair ? `grand stair${table ? ' and centre table' : ''}` : focal.id === 'table-pedestal-round' ? 'centre table' : 'long-case clock', approach: null, passage: true };
}

// DRAWING ROOM (terminal): the fine room's grammar without the bed. The marble fireplace on the wall facing the door, a
// sitting group floating before it, then (as the room grows) a card table, a bureau, a harp corner, a chaise
function mansionDrawing(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), cells = ccmCells(ctx), lat = ccmLat(far), other = [...lat, ...(d ? [d.side] : [])];
  const f = mansionHearth(ctx, [far, ...lat], { focal: true });
  if (!f) return { fail: `drawing room has no fireplace (${ctx.focal?.why || 'no fireplace mesh'})` };
  if (d) { ctx.sight = [d.inner, [f.x, f.z]]; ctx.sightFeature = f.id; }
  const g = mansionSitting(ctx, f, { small: Math.min(ctx.W, ctx.D) < 13 });
  for (const s of g.seats) ctx.command('sitting', s, { back: false, flanks: false });
  if (d) { ccmWalk(ctx, 'approach', [d.inner, front(f, Math.min(11, (f.side === 'N' || f.side === 'S' ? ctx.D : ctx.W) - 5))]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, d.inner]); }
  if (cells >= 16) { ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, ['table-card', 'table-games']) || 'table-card', ['chair-salon-gilt'], cells >= 24 ? 4 : 2, { why: 'the card table' })); // games
    const b = mansionWall(ctx, 'desk-bureau', other, { sideCost: 1, at: 0.3, why: 'the writing bureau against the wall' }); if (b) mansionAt(ctx, 'chair-salon-gilt', [...front(b, 0.2 + 0.85), b.rot + Math.PI], { rule: 'desk-chair', why: 'a chair at the bureau' }); }
  if (cells >= 20) { const h = ccmCorner(ctx, 'harp', [d ? d.side : far, lat[ctx.ri(0, 1)]], { why: 'the harp in its corner', inset: 1.2 }); if (h) { ccmQuiet(ctx, () => ctx.companion(h, 'stool-upholstered', { why: 'the harpist\'s stool', maxDist: 3 })); ccmQuiet(ctx, () => ctx.companion(h, 'music-stand', { why: 'a music stand by the harp', maxDist: 3.5 })); } }
  mansionWall(ctx, 'cabinet-china', other, { sideCost: 1, why: 'the china cabinet, centred on a free wall' });
  if (cells >= 24) mansionConsole(ctx, lat[ctx.ri(0, 1)], 0.5);
  if (cells >= 30) mansionWall(ctx, 'daybed', other, { sideCost: 1, at: 0.7, why: 'the chaise by the wall' });
  for (const s of lat) if (ctx.chance(0.6)) ccmCorner(ctx, ccmAny(ctx, ['palm-potted', 'fern-potted']), [far, s], { why: 'a potted plant in the corner', inset: 0.4 });
  mansionPaintings(ctx, Math.max(3, Math.min(6, Math.round(cells / 6))));
  mansionDrapes(ctx);
  mansionChandelier(ctx, g.table ? [g.table.x, g.table.z] : front(f, 5), cells < 20, 'the chandelier over the sitting group');
  if (cells >= 36) mansionChandelier(ctx, [(ctx.X0 + ctx.X1) / 2 * 2 - (g.table ? g.table.x : f.x), (ctx.Z0 + ctx.Z1) / 2 * 2 - (g.table ? g.table.z : f.z)], false, 'a second chandelier over the far half');
  ccmDone(ctx);
  return { feature: f, what: `marble fireplace and a sitting group of ${g.seats.length}`, approach: null, passage: true };
}

// DINING ROOM (terminal): ONE long table in the middle, on the room's long axis; a chair every 2 ft down both sides,
// a carver at each end, a place laid before every chair; the fireplace on a short wall, the sideboard on a long one
function mansionDining(ctx) {
  const d = ctx.mainDoor, cells = ccmCells(ctx), longX = ctx.W >= ctx.D, rot = longX ? 0 : Math.PI / 2, Lr = Math.max(ctx.W, ctx.D), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const ax = longX ? [1, 0] : [0, 1], shape = Lr >= 28 ? 'fine' : 'fine--s2', two = Lr >= 44, tl = mansionSkuSize(ctx, 'table-feast', shape)[0];
  const tables = [];
  for (const k of two ? [-1, 1] : [0]) { const t = mansionAt(ctx, 'table-feast', [0, 0.5, -0.5, 1, -1].map(e => [cx + ax[0] * (k * (tl / 2 + 0.03) + e), cz + ax[1] * (k * (tl / 2 + 0.03) + e), rot]), { layer: 'anchor', rule: tables.length ? 'table' : 'key-table', why: two ? 'two long tables end to end as one' : 'the dining table: in the middle of the room, on its long axis', sku: { shape }, extra: { focal: true } }) || (tables.length ? null : ccmCentre(ctx, ['table-feast', 'table-trestle'], { label: 'dining table', rule: 'key-table', rot })); if (t) tables.push(t); }
  if (!tables.length) return { fail: 'dining room has no table (no table-feast mesh, or no floor for it)' };
  const T0 = tables[0]; ctx.focal = { label: 'dining table', id: T0.id, ok: true, centre: true };
  if (d) { ctx.sight = [d.inner, [T0.x, T0.z]]; ctx.sightFeature = T0.id; }
  // chairs: along both long sides (about one per 2 ft), a carver at each free end; a place laid before each
  const seats = [], lay = (t, fxr, fzr) => { for (const [id, a, b] of [['plate-silver', 0, 0], ['goblet-silver', 0.45, 0.1], ['cutlery-set-silver', -0.55, 0]]) if (ccmHas(ctx, id)) ccmOn(ctx, id, t, fxr + a / t.dims[0], fzr * (1 - 0.9 / t.dims[2]) + b * Math.sign(-fzr) / t.dims[2], 'a place laid at the table'); };
  for (const t of tables) {
    const [fx, fz] = ctx.facingVec(t.rot), lx = fz, lz = -fx, n = Math.max(2, Math.floor((t.dims[0] - 0.6) / 2.1)), [cw, cd] = ccmSize(ctx, 'chair-plain');
    for (const sg of [-1, 1]) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n - 0.5; // (tucked as near as the half-foot grid lets it stand)
      const c = mansionAt(ctx, 'chair-plain', [0.95, 1.1, 1.25, 1.4, 1.6].map(g => [t.x + lx * u * (t.dims[0] - 0.6) + fx * sg * (t.dims[2] / 2 + g), t.z + lz * u * (t.dims[0] - 0.6) + fz * sg * (t.dims[2] / 2 + g), t.rot + (sg > 0 ? Math.PI : 0)]), { rule: 'seat', why: 'a chair at the table, one every two feet', extra: { group: t.uid } });
      if (c) { seats.push(c); lay(t, u * (t.dims[0] - 0.6) / t.dims[0], sg * 0.5); }
    }
  }
  for (const [t, sg] of [[tables[0], -1], [tables.at(-1), 1]]) { const [fx, fz] = ctx.facingVec(t.rot), lx = fz, lz = -fx; const c = mansionAt(ctx, 'chair-armed', [1.05, 1.2, 1.35, 1.5, 1.7].map(g => [t.x + lx * sg * (t.dims[0] / 2 + g), t.z + lz * sg * (t.dims[0] / 2 + g), Math.atan2(-sg * lx, -sg * lz)]), { rule: 'seat', why: 'the carver at the head of the table', extra: { group: t.uid } }); if (c) seats.push(c); }
  // on the table's centre line: the epergne, a candelabrum at each third (the chairs' places are booked first)
  tables.forEach((t, i) => { if (i === 0) ccmOn(ctx, 'centerpiece-epergne', t, two ? 0.3 : 0, 0, 'the centrepiece'); for (const u of two ? [0] : [-0.3, 0.3]) ccmOn(ctx, 'candelabra', t, u, 0, 'a candelabrum on the table', 'light'); });
  // 3 ft of walking room behind every chair, then the walk from the door round the table
  { const all = [...tables, ...seats], x0 = Math.min(...all.map(p => p.x - ctx.aabb(p.dims[0], p.dims[2], p.rot)[0] / 2)), x1 = Math.max(...all.map(p => p.x + ctx.aabb(p.dims[0], p.dims[2], p.rot)[0] / 2)), z0 = Math.min(...all.map(p => p.z - ctx.aabb(p.dims[0], p.dims[2], p.rot)[1] / 2)), z1 = Math.max(...all.map(p => p.z + ctx.aabb(p.dims[0], p.dims[2], p.rot)[1] / 2));
    ctx.mark((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + 5, z1 - z0 + 5, KEEP); ctx.diningRect = [x0, z0, x1, z1]; }
  ccmQuiet(ctx, () => ctx.rug('rug-grand', { at: [cx, cz], rot: rot + Math.PI / 2, why: 'the rug under the table' }));
  if (d) for (const o of ctx.doors) ccmWalk(ctx, o === d ? 'approach' : 'branch', [o.inner, [o.inner[0] + SIDES[o.side].n[0] * 2.5, o.inner[1] + SIDES[o.side].n[1] * 2.5]]);
  // the walls: fireplace on a short wall, sideboard on the long wall away from the door, the china cabinet opposite
  const shorts = ctx.shortSides().sort((a, b) => (ctx.doorT[a].length - ctx.doorT[b].length)), longs = ctx.longSides().sort((a, b) => (ctx.doorT[a].length - ctx.doorT[b].length));
  mansionHearth(ctx, shorts, { shape: 's2' });
  const sb = mansionWall(ctx, 'sideboard', longs, { why: 'the sideboard, centred on the long wall away from the door' });
  if (sb) for (const id of ctx.pick(['tray-silver', 'pitcher-silver', 'decanter-crystal', 'platter-silver-domed', 'candelabra'], 3)) ccmOn(ctx, id, sb, ctx.r(-0.35, 0.35), 0, 'on the sideboard', /candel/.test(id) ? 'light' : 'dress');
  mansionWall(ctx, 'cabinet-china', [...longs].reverse(), { at: 0.3, why: 'the china cabinet' });
  if (two) mansionWall(ctx, 'sideboard', [...longs].reverse(), { at: 0.7, why: 'a second sideboard' });
  if (d) mansionWall(ctx, 'table-side', [d.side], { near: d.inner, why: 'a serving table by the door' });
  if (cells >= 36) for (const s of ccmLat(shorts[0])) ccmCorner(ctx, 'candelabra-standing', [shorts[0], s], { why: 'a floor candelabrum in the corner', layer: 'light' });
  for (const s of longs) { const L = ctx.sideLen(s); for (const u of [0.2, 0.8]) for (const sg of [-1, 1]) if (cells >= 24 || sg < 0) mansionHang(ctx, 'sconce-candle-triple', s, L * u + sg * 0.01, 5.0, { layer: 'light', why: 'candle sconce on the long wall' }); }
  mansionPaintings(ctx, Math.max(2, Math.min(5, Math.round(cells / 8))));
  mansionDrapes(ctx);
  for (const t of tables) mansionChandelier(ctx, [t.x, t.z], false, 'the chandelier over the table');
  ctx.diningInfo = { tables: tables.length, seats: seats.length };
  ccmDone(ctx);
  return { feature: T0, what: `${two ? 'a double-length' : 'the'} dining table laid for ${seats.length}`, approach: null, passage: true };
}

// LIBRARY (terminal): the storeroom's wall-rack grammar with bookcases as the rack. The ladder bookcase centred on the
// wall facing the door, bookcases butted side by side along the walls (at least half the free wall), the partners'
// desk before the focal bookcase with its chair's back to the books and the door in view
function mansionLibrary(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), cells = ccmCells(ctx), lat = ccmLat(far), toDoor = SIDES[far].rot, deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const focal = ccmFocalOn(ctx, far, ['bookcase-ladder', 'bookshelf'], { label: 'ladder bookcase', rule: 'key-bookcase', why: 'the ladder bookcase: centred on the wall facing the door (axial focal)' });
  if (!focal) return { fail: `library has no bookcase on the wall facing the door (${ctx.focal?.why || 'no bookcase mesh'})` };
  // the desk: 5-6 ft before the focal bookcase, long side parallel to it; the armchair behind it, a chair in front
  const deskId = ccmFirst(ctx, ['desk-partners', 'desk-writing']), dk = deskId && deep >= 16 ? mansionAt(ctx, deskId, [5, 4.5, 4, 5.5].map(a => [...front(focal, a + ccmSize(ctx, deskId)[1] / 2), toDoor]), { layer: 'anchor', rule: 'desk', why: 'the partners\' desk before the bookcase, parallel to it' }) : null;
  if (dk) { const k = mansionAt(ctx, 'chair-armed', [1.3, 1.5, 1.1].map(a => [dk.x - Math.sin(dk.rot) * (dk.dims[2] / 2 + a), dk.z - Math.cos(dk.rot) * (dk.dims[2] / 2 + a), dk.rot]), { rule: 'keeper', why: 'the desk chair: back to the books, the door in view', allowKeep: true }); if (k) ctx.command('desk chair', k);
    mansionAt(ctx, 'chair-plain', [...front(dk, 1.2), dk.rot + Math.PI], { rule: 'desk-chair', why: 'a visitor\'s chair before the desk' });
    for (const id of ctx.pick(['inkwell-quill', 'book-open', 'letters-bundle', 'ledger-accounts', 'candlestick', 'book-stack'], 4)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === dk.uid, layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the desk' }));
    ccmQuiet(ctx, () => ctx.companion(dk, 'trade-globe-terrestrial', { why: 'the globe beside the desk', maxDist: 5 })); }
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; ccmWalk(ctx, 'approach', [d.inner, front(dk || focal, 1.8)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(dk || focal, 1.8)]); }
  // (the bookcases go up BEFORE the fire and the table: the real cases are 5 to 8 ft wide and a library is its books; at
  // least four where the walls allow, on the door wall too)
  // bookcases: the far wall first, then the side walls, each butted against the last, until half the wall is books
  const wallFt = 2 * (ctx.W + ctx.D), cases = [focal]; let booked = focal.dims[0];
  for (let k = 0; k < 40 && booked < wallFt * (cells >= 16 && cases.length < 4 ? 0.9 : 0.5); k++) {
    const b = ccmQuiet(ctx, () => ctx.put('bookshelf', (dm) => ctx.wallGen(dm, [far, ...lat, ...(d ? [d.side] : [])], { step: 0.25 }), (c) => (c.side === far ? 0 : d && c.side === d.side ? 6 : 3) + Math.min(...cases.map(q => Math.hypot(q.x - c.x, q.z - c.z))), { layer: 'store', rule: 'bookcase', why: 'bookcases butted side by side along the wall' }));
    if (!b) break; cases.push(b); booked += b.dims[0];
  }
  // reading by the fire (from 16 cells): the green fireplace on a side wall, two wing chairs, a side table between
  let fire = null;
  if (cells >= 16) { fire = mansionHearth(ctx, lat, { shape: 's2' }); if (fire) mansionSitting(ctx, fire, { small: true, chairSku: { shape: 'fine--s3' } }); }
  // the study table in the middle of a big library
  if (cells >= 25) ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, ['table-library', 'table-games']) || 'table-library', ['chair-armed'], 4, { why: 'the library table' }));
  ctx.libraryInfo = { cases: cases.length, wall: +(booked / wallFt).toFixed(2) };
  if (cases.length > 2) ctx.growth.push(`bookcases repeat along the walls: ${cases.length} (${Math.round(booked / wallFt * 100)}% of the wall)`);
  for (let i = 0, n = Math.max(1, Math.round(cells / 20)); i < n; i++) ccmQuiet(ctx, () => ctx.companion(cases[1 + i] || focal, 'library-steps', { why: 'library steps before a bookcase', maxDist: 4 }));
  if (d) mansionWall(ctx, 'clock-longcase', [d.side], { near: d.inner, why: 'the long-case clock on the door wall' });
  ccmQuiet(ctx, () => ctx.wall('telescope', { prefer: 'corner', why: 'a telescope by the wall', gap: 0.4 }));
  if (cells >= 20 && d) ccmCorner(ctx, 'statue-bust', [d.side, lat[0]], { why: 'a bust in the corner', inset: 0.5 });
  for (let i = 0, n = ctx.ri(0, 2); i < n; i++) ccmQuiet(ctx, () => ctx.free('book-pile-floor', { near: fire ? front(fire, 5) : [dk?.x ?? focal.x, dk?.z ?? focal.z], radius: 6, margin: 0.6, why: 'books piled on the floor', layer: 'dress' }));
  mansionPaintings(ctx, Math.max(1, Math.min(3, Math.round(cells / 12))), d ? [d.side, ...lat] : lat);
  mansionDrapes(ctx);
  mansionChandelier(ctx, dk ? [dk.x, dk.z] : front(focal, 5), true, 'the chandelier over the desk');
  ccmDone(ctx);
  return { feature: focal, what: `ladder bookcase and ${cases.length - 1} bookcases${dk ? ', the desk before them' : ''}`, approach: null, passage: true };
}

// MASTER BEDROOM (terminal): the fine room with the mansion's pieces. The state bed centred on the wall facing the door,
// a bedside cabinet each side, an upholstered bench across its foot; a hearth with two chairs on a side wall; a dressing
// corner behind a screen; a bureau, a chaise and a washstand as the room grows
function mansionBedroom(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), cells = ccmCells(ctx), lat = ccmLat(far), other = [...lat, ...(d ? [d.side] : [])];
  const big = Math.min(ctx.W, ctx.D) >= 30 && ctx.area() >= 1000;
  let bed = big ? ccmCentre(ctx, ['bed-canopy'], { label: 'state bed', rule: 'key-bed-island', rot: SIDES[far].rot, off: [SIDES[far].n[0] * -4, SIDES[far].n[1] * -4], why: 'the state bed: promoted to an island in a big room' }) : null;
  const island = !!bed;
  if (!bed) bed = ccmFocalOn(ctx, far, ['bed-canopy', 'bed-double'], { label: 'state bed', rule: 'key-bed-focal', why: 'the state bed: centred on the wall facing the door, head to the wall (axial focal)' });
  if (!bed) for (const s of lat) if (!bed) bed = ccmFocalOn(ctx, s, ['bed-canopy', 'bed-double'], { label: 'state bed', rule: 'key-bed', slack: Math.max(0.5, ctx.sideLen(s) / 2 - 4), why: 'the state bed: head to a side wall (the wall facing the door cannot take it)' });
  if (!bed) return { fail: `master bedroom has no bed (${ctx.focal?.why || 'no bed mesh'})` };
  if (island) ctx.growth.push('bed promoted to a freestanding centre island');
  if (d) { ctx.sight = [d.inner, [bed.x, bed.z]]; ctx.sightFeature = bed.id; }
  const stands = ccmFlank(ctx, bed, ['table-side', 'commode'], { off: 0.15, layer: 'furnish', rule: 'nightstand', why: 'a bedside cabinet each side of the bed' });
  for (const t of stands) ccmQuiet(ctx, () => ctx.surface(ccmAny(ctx, ['candlestick', 'book-stack', 'candle']), { on: s => s.uid === t.uid, layer: 'light', why: 'on the bedside cabinet' }));
  mansionAt(ctx, 'bench-upholstered', [0.3, 0.6].map(a => [...front(bed, a + 0.8), bed.rot + Math.PI]), { rule: 'companion', why: 'an upholstered bench across the foot of the bed', sku: { shape: 's2' }, extra: { with: bed.uid } });
  ctx.command('bed', bed, { focal: !island, back: !island });
  if (!island && bed.side) { const t = mansionT(ctx, bed.side, bed); for (const sg of [-1, 1]) mansionHang(ctx, 'sconce-candle-triple', bed.side, t + sg * (bed.dims[0] / 2 + 2.6), 5.2, { layer: 'light', why: 'candle sconce beside the bed' }); }
  if (d) { ccmWalk(ctx, 'approach', [d.inner, front(bed, 3.2)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(bed, 3.2)]); }
  { const [aw, ad] = ctx.aabb(bed.dims[0] + 4.5, bed.dims[2] + 3, bed.rot), [fx, fz] = ctx.facingVec(bed.rot); ctx.mark(bed.x + fx * 1.5, bed.z + fz * 1.5, aw, ad, KEEP); } // room to walk round the bed
  // hearth sitting on a side wall, dressing on the other (wardrobe, vanity and stool, commode, the cheval mirror, a screen)
  const fire = cells >= 16 ? mansionHearth(ctx, lat, { shape: 's2' }) : null;
  if (fire) mansionSitting(ctx, fire, { small: true });
  const dress = [...lat].sort((a, b) => (fire?.side === a) - (fire?.side === b)).concat(d ? [d.side] : []);
  const wr = mansionWall(ctx, 'wardrobe', dress, { at: 0.7, why: 'the wardrobe' });
  const van = mansionWall(ctx, 'table-vanity', dress, { near: wr ? [wr.x, wr.z] : null, at: 0.4, why: 'the dressing table beside the wardrobe' });
  if (van) { mansionAt(ctx, 'stool-upholstered', [...front(van, 0.9), van.rot + Math.PI], { rule: 'desk-chair', why: 'the stool at the dressing table', allowKeep: true }); for (const id of ctx.pick(['perfume-bottles', 'jewelry-box', 'hand-mirror', 'candlestick'], 2)) ccmOn(ctx, id, van, ctx.r(-0.3, 0.3), 0.1, 'on the dressing table'); }
  const com = mansionWall(ctx, 'commode', dress, { near: wr ? [wr.x, wr.z] : null, at: 0.3, why: 'the commode' });
  if (com) for (const id of ctx.pick(['clock-mantel', 'vase-flowers', 'plant-pot'], 2)) ccmOn(ctx, id, com, ctx.r(-0.3, 0.3), 0, 'on the commode');
  if (wr && cells >= 20) { ccmQuiet(ctx, () => ctx.companion(wr, 'gown-on-form', { why: 'a gown on its form beside the wardrobe', maxDist: 5 })); ccmQuiet(ctx, () => ctx.companion(van || wr, 'mirror-standing', { why: 'the cheval mirror by the dressing table', maxDist: 6 }));
    const [sx, sz] = front(van || wr, 4.2); mansionAt(ctx, 'screen-folding', [[sx, sz, (van || wr).rot + Math.PI / 2], [sx, sz, (van || wr).rot]], { rule: 'zone-divider', why: 'a folding screen on the open side of the dressing corner' }); }
  if (cells >= 24) { const b = mansionWall(ctx, 'desk-bureau', other, { sideCost: 1, at: 0.25, why: 'the bureau' }); if (b) mansionAt(ctx, 'chair-salon-gilt', [...front(b, 1.05), b.rot + Math.PI], { rule: 'desk-chair', why: 'a chair at the bureau' }); }
  if (cells >= 30) mansionWall(ctx, 'daybed', other, { sideCost: 1, at: 0.75, why: 'the chaise by the wall' });
  if (cells >= 24) mansionWall(ctx, 'washstand', other, { sideCost: 1, at: 0.9, why: 'the washstand' });
  if (cells >= 25) ccmQuiet(ctx, () => ctx.wall('bathtub-wood', { sides: other, prefer: 'corner', why: 'the bath, deep in the room' }));
  ccmQuiet(ctx, () => ctx.rug(ccmAny(ctx, ['rug-sheepskin', 'rug-small']), { at: front(bed, 3.4), rot: bed.rot, why: 'a rug at the foot of the bed' }));
  mansionPaintings(ctx, Math.max(2, Math.min(4, Math.round(cells / 8))), other);
  mansionDrapes(ctx);
  mansionChandelier(ctx, front(bed, 1), true, 'the chandelier over the foot of the bed');
  ccmDone(ctx);
  return { feature: bed, what: island ? 'state bed (centre island)' : 'state bed', approach: null, passage: true };
}

// BALLROOM (hub): the barn's clear floor as a dance floor. The middle stays EMPTY (no props, no rugs); chandeliers hang
// in a row down the long centre line; the musicians keep the short end farthest from the door; gilt chairs and benches
// stand in runs along the long walls with their backs to them, pier mirrors over consoles at the middle of each
function mansionBallroom(ctx) {
  const d = ctx.mainDoor, cells = ccmCells(ctx), longX = ctx.W >= ctx.D, Lr = Math.max(ctx.W, ctx.D), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const shorts = ctx.shortSides(), longs = ctx.longSides();
  const dist = (s) => d ? Math.hypot(...ctx.sidePoint(s, ctx.sideLen(s) / 2, 0).map((v, i) => v - d.at[i])) : 0;
  const end = [...shorts].sort((a, b) => dist(b) - dist(a))[0], Le = ctx.sideLen(end), [nx, nz] = SIDES[end].n; // the musicians' end
  // NO chandeliers over the dance floor (the designer's focal piece): from the table camera they were "ornate, spiky golden
  // chandeliers that have fallen or are being stored on the floor", and the room a parlor. The empty floor is the room.
  const lamps = [];
  ctx.focal = { label: 'the dance floor', ok: true, centre: true };
  // the dance floor: reserved before anything stands (a 3.2-ft band stays at the walls, more at the musicians' end)
  const band = 3.2, mus = Math.min(11, Lr * 0.28), r = [ctx.X0 + band, ctx.Z0 + band, ctx.X1 - band, ctx.Z1 - band];
  if (end === 'W') r[0] = ctx.X0 + mus; if (end === 'E') r[2] = ctx.X1 - mus; if (end === 'N') r[1] = ctx.Z0 + mus; if (end === 'S') r[3] = ctx.Z1 - mus;
  ctx.danceFloor = r.map(v => +v.toFixed(2));
  if (r[2] - r[0] > 2 && r[3] - r[1] > 2) ctx.mark((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1], KEEP);
  if (d) for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, d.inner]); // (before the chairs and the musicians: a side door's way round the floor stays open)
  // the musicians: harpsichord 3 ft off the end wall at an angle, its stool, the harp, stands and chairs in a shallow arc
  // THE MUSICIANS' STAGE (round 3 of the blind reads: with the floor empty and the players on it the room was "a formal
  // antechamber", "a dressing room", "a gallery"; the gilt chairs along the walls were not seen at all). A low platform
  // centred on the end wall, the harp and a player's stand and chair on it: a stage at one end of an empty floor.
  // RESULT: worse. The harp on the platform was "a throne-like object on a raised dais" and the room "an audience chamber" 6 times in 8. Off (kept for the record of what was tried).
  const stage = false && mus >= 9.8 && ccmHas(ctx, 'dais') ? castleDais(ctx, end, { square: true }) : null;
  if (stage) { const on = (id, t, s2, rot, why) => castleOn(ctx, id, stage.p, ...ctx.sidePoint(end, t, s2), rot, { rule: 'on-stage', why });
    on('harp', Le / 2 - 2.4, stage.depth * 0.45, SIDES[end].rot, 'the harp on the stage');
    on('stool-upholstered', Le / 2 - 2.4, stage.depth * 0.45 - 2.4, SIDES[end].rot, 'the harpist\'s stool');
    on('music-stand', Le / 2 + 2.2, stage.depth * 0.62, SIDES[end].rot + Math.PI, 'a music stand on the stage');
    on('chair-salon-gilt', Le / 2 + 2.2, stage.depth * 0.62 - 2.9, SIDES[end].rot, 'the player\'s chair'); }
  const at = (t, s) => ctx.sidePoint(end, t, s), hp = ccmHas(ctx, 'harpsichord') && mus >= 9 && cells >= 70 /* (the harpsichord from above: "a billiards or game table", "a war table") */ ? mansionAt(ctx, 'harpsichord', [[...at(Le * 0.42, 3 + 3.9), SIDES[end].rot + 0.42], [...at(Le * 0.42, 3 + 3.9), SIDES[end].rot + 1.2], [...at(Le * 0.4, 5), SIDES[end].rot + Math.PI / 2]], { layer: 'anchor', rule: 'key-instrument', why: 'the harpsichord: at the musicians\' end, 3 ft off the wall, at an angle', allowKeep: true }) : null;
  if (hp) ccmQuiet(ctx, () => ctx.companion(hp, 'stool-upholstered', { why: 'the stool at the keyboard', maxDist: 5 }));
  const harp = stage ? null : mansionAt(ctx, 'harp', [[...at(Le * 0.72, 3.2), SIDES[end].rot], [...at(Le * 0.75, 2.2), SIDES[end].rot]], { rule: 'instrument', why: 'the harp beside the harpsichord', allowKeep: true });
  if (harp) ccmQuiet(ctx, () => ctx.companion(harp, 'stool-upholstered', { why: 'the harpist\'s stool', maxDist: 3 }));
  if (!stage) for (let i = 0, n = Math.max(1, Math.min(4, Math.round(Le / 9))); i < n; i++) { const t = Le * (0.2 + 0.6 * (n === 1 ? 0.5 : i / (n - 1))), s = mus - 2.2 - Math.abs(t - Le / 2) * 0.12; const st = mansionAt(ctx, 'music-stand', [[...at(t, s), SIDES[end].rot + Math.PI], [...at(t + 1, s), SIDES[end].rot + Math.PI]], { rule: 'music', why: 'a music stand in the musicians\' arc', allowKeep: true }); if (st) mansionAt(ctx, 'chair-salon-gilt', [[...at(mansionT(ctx, end, st), s - 2), SIDES[end].rot], [...at(mansionT(ctx, end, st), s - 2.5), SIDES[end].rot]], { rule: 'seat', why: 'a musician\'s chair behind the stand', allowKeep: true }); }
  for (const s of ccmLat(end)) ccmCorner(ctx, 'candelabra-standing', [end, s], { why: 'a floor candelabrum at each end of the musicians\' group', layer: 'light', inset: 0.5 });
  // the long walls: a console under a pier mirror at the middle, runs of chairs and benches either side of it, mirrors beyond
  let chairs = 0;
  for (const s of longs) {
    mansionConsole(ctx, s, 0.5);
    const L = ctx.sideLen(s), n = Math.max(2, Math.round(L / 3.2));
    for (let i = 0; i < n; i++) { const t = L * (i + 0.5) / n, bench = false /* (benches were "green sofas": a parlor) */, id = bench ? 'bench-upholstered' : 'chair-salon-gilt';
      const p = ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [s], { tRange: [t - 1.2, t + 1.2] }), (c) => Math.abs(c.t - t), { rule: 'wall-seat', why: 'chairs and benches in a line along the long wall, backs to it', sku: bench ? { shape: 's1' } : undefined })); if (p) chairs++; }
    for (const u of [0.2, 0.8]) { const m = mansionHang(ctx, 'mirror-pier-gilt', s, L * u, 3.0, { why: 'a pier mirror on the long wall' }); for (const sg of [-1, 1]) mansionHang(ctx, 'sconce-candle-triple', s, L * u + sg * ((m ? m.dims[0] : 3) / 2 + 1.1), 5.0, { layer: 'light', why: 'candle sconce beside the mirror' }); }
  }
  const door = [...shorts].find(s => s !== end);
  for (const s of ccmLat(door)) ccmCorner(ctx, ccmAny(ctx, ['statue-bust', 'urn-decorative', 'palm-potted']), [door, s], { why: 'in the corner by the door', inset: 0.4 });
  if (cells >= 70) { const sb = mansionWall(ctx, ccmFirst(ctx, ['sideboard', 'table-console']), [door, ...longs], { at: 0.25, why: 'the refreshment sideboard' }); if (sb) for (const id of ctx.pick(['wassail-bowl', 'tray-silver', 'goblet-silver', 'decanter-crystal'], 3)) ccmOn(ctx, id, sb, ctx.r(-0.35, 0.35), 0, 'refreshments on the sideboard'); }
  mansionPaintings(ctx, 2, shorts);
  mansionDrapes(ctx);
  ctx.ballInfo = { chandeliers: lamps.length, chairs, end, floor: +(((r[2] - r[0]) * (r[3] - r[1])) / ctx.area()).toFixed(2) };
  ccmDone(ctx);
  return { feature: hp || harp || stage?.p || null, what: `an empty dance floor (${Math.round(ctx.ballInfo.floor * 100)}% of the room), gilt chairs along the walls, the musicians at the ${SIDE_LABEL[end]} end`, approach: null, passage: true };
}

// CONSERVATORY (terminal; the wall is the window, so no windows, no drapes): a fountain or a tall palm at the centre with
// the path running to it and round it, palms in the corners, tiered plant stands against the glass, orange trees along
// the path, a sitting clearing, a potting corner
function mansionConservatory(ctx) {
  const d = ctx.mainDoor, cells = ccmCells(ctx), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, far = ccmFar(ctx), lat = ccmLat(far), narrow = Math.min(ctx.W, ctx.D);
  // (the 5-ft fountain needs 17 ft across: itself, a 3-ft path each side and a plant stand at the glass; else the palm)
  const centre = narrow >= 17 && cells >= 15 ? mansionAt(ctx, 'fountain-courtyard', [cx, cz, 0], { layer: 'anchor', rule: 'key-centre', why: 'the fountain: at the centre, the path running round it', sku: { shape: 's2' }, extra: { focal: true } }) : null;
  const focal = centre || ccmCentre(ctx, ['palm-potted', 'citrus-tree-tub', 'fern-potted'], { label: 'centre palm', rule: 'key-centre', why: 'the tall palm: at the centre of the conservatory' });
  if (!focal) return { fail: 'conservatory has no centre piece (no fountain or palm mesh, or no floor)' };
  ctx.focal = { label: centre ? 'fountain' : 'centre palm', id: focal.id, ok: true, centre: true };
  // the path: door -> beside the centre -> round it -> the other doors (a ring kept clear)
  { const [aw, ad] = ctx.aabb(focal.dims[0], focal.dims[2], focal.rot), m = Math.min(3, (narrow - Math.max(aw, ad)) / 2 - 2.4); if (m > 1) ctx.mark(focal.x, focal.z, aw + 2 * m, ad + 2 * m, KEEP); }
  if (d) for (const o of ctx.doors) { const v = [focal.x - o.inner[0], focal.z - o.inner[1]], l = Math.hypot(...v) || 1, k = Math.max(0, l - (Math.max(focal.dims[0], focal.dims[2]) / 2 + 1.6)); ccmWalk(ctx, o === d ? 'approach' : 'branch', [o.inner, [o.inner[0] + v[0] / l * k, o.inner[1] + v[1] / l * k]]); }
  // plants: a palm in every corner, plant stands at the glass, orange trees and ferns between
  let plants = 0;
  for (const [a, b] of [['N', 'W'], ['N', 'E'], ['S', 'W'], ['S', 'E']]) if (ccmCorner(ctx, ccmAny(ctx, narrow >= 17 ? ['palm-potted'] : ['fern-potted', 'planter-topiary', 'citrus-tree-tub']), [a, b], { why: 'a palm in the corner', inset: 0.3, layer: 'plants' })) plants++;
  const walls = ['N', 'S', 'E', 'W'].sort((a, b) => ctx.doorT[a].length - ctx.doorT[b].length);
  plants += ccmAlong(ctx, ['plant-stand-tiered'], walls, Math.max(1, Math.round((ctx.W + ctx.D) * 2 / 22)), { why: 'a tiered plant stand against the glass', layer: 'plants' }).length;
  if (d) for (const sg of [-1, 1]) { const t = d.tc + sg * (d.width / 2 + 1.6), [x, z] = ctx.sidePoint(d.side, t, 1.3); if (t > 1.2 && t < ctx.sideLen(d.side) - 1.2 && mansionAt(ctx, 'planter-topiary', [x, z, 0], { layer: 'plants', why: 'a topiary each side of the house door' })) plants++; }
  // the sitting clearing: two wicker chairs and a small table, off the centre; the potting corner farthest from the door
  const [nx, nz] = SIDES[far].n, sit = [focal.x - nx * 0 + (far === 'N' || far === 'S' ? Math.min(ctx.W / 4, 6) : 0), focal.z + (far === 'W' || far === 'E' ? Math.min(ctx.D / 4, 6) : 0)];
  const tb = cells >= 12 ? ccmQuiet(ctx, () => ctx.free('table-round-small', { near: sit, radius: 4, margin: 2.6, layer: 'furnish', rule: 'clearing', why: 'the table in the sitting clearing' })) : null;
  if (tb) { for (const sg of [-1, 1]) mansionAt(ctx, ccmFirst(ctx, ['craft-wicker-chair', 'chair-salon-gilt']), [[tb.x + sg * (tb.dims[0] / 2 + 1.2), tb.z, Math.atan2(-sg, 0)], [tb.x, tb.z + sg * (tb.dims[2] / 2 + 1.2), Math.atan2(0, -sg)]], { rule: 'inward-seat', why: 'a wicker chair at the table' });
    for (const id of ['tea-service-tray', 'plant-pot']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === tb.uid, why: 'on the table' })); }
  const bench = mansionWall(ctx, 'bench-potting', [far, ...lat], { at: 0.85, sideCost: 2, why: 'the potting bench in the working corner', layer: 'store' });
  if (bench) { ccmQuiet(ctx, () => ctx.companion(bench, 'garden-tools-leaning', { why: 'garden tools leaning by the potting bench', maxDist: 5, layer: 'store' })); for (const id of ['trowel-garden', 'plant-pot']) ccmOn(ctx, id, bench, ctx.r(-0.3, 0.3), 0.1, 'on the potting bench'); }
  if (cells >= 20) mansionWall(ctx, 'fountain-wall', d ? [d.side] : walls, { at: 0.75, why: 'a wall fountain on the house wall' });
  // toward the target: orange trees, ferns and topiaries wherever the path leaves room (three quarters of the room is plants)
  const want = Math.round(6.5 * ctx.area() / 100);
  for (let k = 0, miss = 0; ccmCount(ctx) < want && miss < 14; k++) { const id = ccmAny(ctx, ['citrus-tree-tub', 'fern-potted', 'fern-potted', 'planter-topiary', 'urn-garden']); if (!id) break; const p = ccmQuiet(ctx, () => k % 3 === 0 ? ctx.free(id, { near: [focal.x, focal.z], radius: Math.max(ctx.W, ctx.D) / 2, margin: 1.2, layer: 'plants', rule: 'plant', why: 'a tub by the path' }) : ctx.wall(id, { layer: 'plants', rule: 'plant', why: 'a pot against the glass', gap: 0.2 })); if (p) { plants++; miss = 0; } else miss++; }
  if (d && d.to) for (const u of [0.2, 0.8, 0.5]) if (mansionHang(ctx, 'trellis-vine', d.side, ctx.sideLen(d.side) * u, 0.3, { why: 'a vine trellis on the house wall' })) break; // (7 ft tall: it stands from the floor, ctx.mount() would lift it through the ceiling)
  ccmQuiet(ctx, () => d && ctx.mount('lantern-wall-brass', { sides: [d.side], height: 6, layer: 'light', rule: 'wall-light', why: 'a brass lantern on the house wall' })) || ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['lantern-post-indoor', 'lamp-pole']), { layer: 'light', why: 'a lamp beside the clearing' }));
  ctx.conservatoryInfo = { centre: focal.id, plants };
  ccmDone(ctx);
  return { feature: focal, what: `${centre ? 'the fountain' : 'a tall palm'} at the centre, ${plants} plants round the path`, approach: null, passage: true };
}

// FORMAL GARDEN (outdoor: no walls of its own, ground for a floor; attempt() runs KEY[key] for an outdoor type that has
// one, else the inn's yard()). It is a yard whose style is not a roll: the edge is ALWAYS a clipped hedge, the layout is
// mirror-symmetric about the main axis, and nothing of the inn's yard appears (no sign, well, woodpile, kennel, fence).
//   edge      hedge-straight on every open grid edge, ON the grid line; hedge-end-block where a run ends or turns (not
//             where it ends against the house); hedge-gap-arch on the gate's segment. Rule 'yard-edge', as the yard's.
//   axes      the main axis runs from the house door (else from the gate) straight across the garden, the cross axis
//             through the middle of it; both are 5-ft walks kept clear of everything; the fountain stands at the crossing
//             and the walk parts round it
//   pairs     everything else stands in MIRRORED PAIRS about the main axis (both or neither): topiaries at the crossing
//             and by the door, a parterre in each quarter with roses round it, statues at the ends of the cross axis,
//             benches facing the fountain, lamp posts and urns at the far end, orange tubs by the house, trees in the
//             two far corners. From 42 cells a gazebo closes the main axis (when the gate is not there); from 56 a
//             lily pond takes one far quarter and a sundial lawn balances it.
function mansionGarden(ctx) {
  const A = ctx.area(), cells = ccmCells(ctx), ALL = ['N', 'S', 'E', 'W'];
  const info = ctx.yardInfo = { vibe: 'formal garden', edge: 'none', edgePieces: 0, wallFt: 0, gate: null, focal: null, signs: 0, doors: [], plants: { placed: 0, slot: ctx.slot('plants'), waiting: [] }, pairs: 0, singles: 0 };
  ctx.densityTarget = yardTarget(A); // the yard's thinning rule (the designer's own word); the pairs below aim a little over it
  // --- surroundings: which stretches of each side are the house's wall; nothing hangs in mid-air on the open ones
  for (const s of ALL) { const m = ctx.openings.filter(o => o.side === s && o.to && /^(wall|window|door)$/.test(o.kind)).map(o => [Math.max(0, o.index * CELL - INSET), Math.min(ctx.sideLen(s), (o.index + 1) * CELL - INSET)]).sort((a, b) => a[0] - b[0]);
    info.wallFt += m.reduce((a, [t0, t1]) => a + t1 - t0, 0); let t = 0; for (const [a, b] of m) { if (a > t + 1e-6) ctx.mounts[s].push([t, a]); t = Math.max(t, b); } if (t < ctx.sideLen(s) - 1e-6) ctx.mounts[s].push([t, ctx.sideLen(s)]); }
  info.wallFt = Math.round(info.wallFt);
  const g = ctx.openings.find(o => o.kind === 'gate'), d = ctx.mainDoor;
  const gtc = g ? g.index * CELL - INSET + CELL / 2 : 0;
  if (g) { ctx.keepClear(g.side, gtc, 5, 3); info.gate = g.side; }
  // --- the hedge
  let edgeIn = 0;
  const openSegs = g?.open || [];
  if (openSegs.length && ['hedge-straight', 'hedge-end-block', 'hedge-gap-arch'].every(i => ccmHas(ctx, i))) {
    const pieces = [], lay = (id, x, z, rot, why, side) => { const sku = ctx.chooseSku(id); if (!sku) return null; const p = ctx.record(id, sku, ctx.dims(id, sku), x, 0, z, rot, 'anchor', 'yard-edge', why, { ...(side ? { side } : {}), edge: 'hedge' }); pieces.push(p); return p; };
    const vkey = (x, z) => `${Math.round(x * 2)}:${Math.round(z * 2)}`, verts = new Map(), built = new Set();
    for (const o of ctx.openings) if (o.to && /^(wall|window|door)$/.test(o.kind)) for (const t of [o.index * CELL - INSET, (o.index + 1) * CELL - INSET]) built.add(vkey(...ctx.sidePoint(o.side, t, -INSET)));
    for (const s of openSegs) {
      const t0 = s.index * CELL - INSET, [x, z] = ctx.sidePoint(s.side, t0 + CELL / 2, -INSET), isGate = s.side === g.side && s.index === g.index;
      const p = lay(isGate ? 'hedge-gap-arch' : 'hedge-straight', x, z, SIDES[s.side].rot, isGate ? 'the arch in the hedge: the garden gate' : 'clipped hedge along the open edge', s.side);
      const dep = p && !isGate ? p.dims[2] / 2 - INSET + 0.15 : 0; // how far the hedge reaches into the garden's ground
      if (dep > 0.15) { edgeIn = Math.max(edgeIn, Math.ceil(dep / RES) * RES); const [mx, mz] = ctx.sidePoint(s.side, t0 + CELL / 2, dep / 2), horiz = s.side === 'N' || s.side === 'S'; ctx.mark(mx, mz, horiz ? CELL : dep, horiz ? dep : CELL); }
      for (const t of [t0, t0 + CELL]) { const [vx, vz] = ctx.sidePoint(s.side, t, -INSET), k = vkey(vx, vz), v = verts.get(k) || { x: vx, z: vz, sides: new Set(), n: 0 }; v.sides.add(s.side); v.n++; verts.set(k, v); }
    }
    for (const [k, v] of verts) { if (built.has(k) || (v.n === 2 && v.sides.size === 1)) continue; lay('hedge-end-block', v.x, v.z, 0, v.sides.size > 1 ? 'corner of the hedge' : 'end of the hedge', null); }
    info.edge = 'hedge'; info.edgePieces = pieces.filter(Boolean).length;
  }
  // --- the axes. near = the side the main axis starts from (the house door's, else the gate's); t along it, s out from it
  const near = d ? d.side : g ? g.side : ctx.longSides()[0], far = OPP_SIDE[near], L = ctx.sideLen(near), deep = near === 'N' || near === 'S' ? ctx.D : ctx.W;
  const tA = L / 2, sc = deep / 2; // the axis is the garden's own centre line (the mirror needs both halves); an off-centre door or gate joins it by a short walk
  const P = (t, s) => ctx.sidePoint(near, t, s), half = Math.min(tA, L - tA), toNear = SIDES[far].rot, toFar = SIDES[near].rot, horiz = near === 'N' || near === 'S';
  const strip = (t0, t1, s0, s1, val = KEEP) => { const [x, z] = P((t0 + t1) / 2, (s0 + s1) / 2); ctx.mark(x, z, horiz ? t1 - t0 : s1 - s0, horiz ? s1 - s0 : t1 - t0, val); };
  const WALK = 5, tiny = Math.min(L, deep) < 13.5;
  info.axis = { near, t: +tA.toFixed(2), s: +sc.toFixed(2), walk: WALK, cross: !tiny };
  // --- the centrepiece at the crossing, before the walks (they part round it)
  // (the 8-ft tiered fountain, its walk and four 6-ft parterres need about 33 ft each way: below that the 5-ft fountain)
  const big = cells >= 42 && Math.min(half * 2, deep) >= 33, mid = !big && Math.min(half * 2, deep) >= 16;
  const focal = tiny ? null : mansionAt(ctx, big || mid ? 'fountain-courtyard' : 'sundial', [...P(tA, sc), toNear], { layer: 'anchor', rule: 'yard-focal', why: 'the centrepiece: where the two walks cross', sku: big ? { shape: '' } : mid ? { shape: 's2' } : undefined, extra: { focal: true } })
    || (tiny ? null : mansionAt(ctx, 'sundial', [...P(tA, sc), toNear], { layer: 'anchor', rule: 'yard-focal', why: 'the sundial where the two walks cross', extra: { focal: true } }));
  const R = focal ? Math.max(focal.dims[0], focal.dims[2]) / 2 : 0, hug = R + 2, ring = focal ? R + 4.6 : 0; // the walk hugs the basin 2 ft off it; nothing stands inside `ring`
  if (focal) info.focal = { id: focal.id, kind: focal.id === 'sundial' ? 'sundial' : 'fountain' };
  // the gazebo closes the main axis at its far end, unless the gate (or a door) is there: then the walk runs out through it
  const farBusy = (g && g.side === far && Math.abs(gtc - tA) < 8) || ctx.doors.some(o => o.side === far && Math.abs(o.tc - tA) < 8);
  const gz = cells >= 42 && !farBusy && deep >= 34 ? mansionAt(ctx, 'gazebo', [...P(tA, deep - edgeIn - ccmSize(ctx, 'gazebo')[1] / 2 - 0.6), toNear], { layer: 'anchor', rule: 'yard-building', why: 'the gazebo: closing the main axis at its far end' }) : null;
  const axisEnd = gz ? deep - edgeIn - gz.dims[2] - 1.2 : deep - edgeIn;
  strip(tA - WALK / 2, tA + WALK / 2, 0, axisEnd);                                   // the main walk
  // the cross walk runs between its two statues (they stand at its ends, 1.8 ft inside the edge)
  const statueU = !tiny && half - edgeIn - 1.8 > ring + 2.5 && ccmHas(ctx, 'statue-garden') ? half - edgeIn - 1.8 : 0, crossU = statueU ? statueU - 2.3 : half - edgeIn;
  if (!tiny) strip(tA - crossU, tA + crossU, sc - WALK / 2, sc + WALK / 2);
  // the walks themselves, as straight legs (a diagonal would sweep a quarter): down the main axis and BOTH ways round the
  // centrepiece (the mirror holds); then every door and the gate joins the nearest walk square-on, along the edge
  { const line = (pts, o) => ccmWalk(ctx, 'path', pts.filter((q, i, l) => !i || Math.hypot(q[0] - l[i - 1][0], q[1] - l[i - 1][1]) > 1.2), o);
    const s0 = Math.min(1.4, sc), s1 = Math.max(s0, axisEnd - 1.2);
    if (focal) for (const sg of [1, -1]) line([...(sg > 0 ? [P(tA, s0)] : []), P(tA, Math.max(s0, sc - hug)), P(tA + sg * hug, sc), P(tA, Math.min(s1, sc + hug)), ...(sg > 0 ? [P(tA, s1)] : [])], { width: 4 });
    else line([P(tA, s0), P(tA, sc), P(tA, s1)], { width: 4 });
    const ts = (q) => [horiz ? q[0] - ctx.X0 : q[1] - ctx.Z0, near === 'N' ? q[1] - ctx.Z0 : near === 'S' ? ctx.Z1 - q[1] : near === 'W' ? q[0] - ctx.X0 : ctx.X1 - q[0]];
    const join = (pt, side) => { const [te, se] = ts(pt);
      if (side === near) return line([pt, P(te, 2.2), P(tA, 2.2)], { width: 3 });
      if (side === far) return line([pt, P(te, deep - edgeIn - 2.2), P(tA, deep - edgeIn - 2.2), P(tA, s1)], { width: 3 });
      const tin = te > L / 2 ? L - edgeIn - 4.8 : edgeIn + 4.8; return line([pt, P(tin, se), P(tin, sc), P(tA + Math.sign(te - L / 2) * Math.min(hug + 1, Math.abs(tin - tA)), sc)], { width: 3 }); };
    for (const o of ctx.doors) join(o.inner, o.side);
    if (g) join(ctx.sidePoint(g.side, gtc, 1.2), g.side); }
  // --- mirrored pairs about the main axis: both stand or neither does
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length;
  const fill = Math.max(4, Math.round(2.4 * A / 100)); // how many things the pairs stop at
  // (sku sizes differ: the parterre is a foot wider than the plain bed, the big oak twice the small one; a wish for one shape narrows it)
  const boxOf = (id, shape) => { const pool = ctx.skuPool(id).filter(q => shape === undefined || q.shape === shape), sz = (pool.length ? pool : ctx.skuPool(id)).map(q => q.size || ctx.lib.objects[id].size); return [Math.max(...sz.map(v => v[0])) / 12 * 1.03, Math.max(...sz.map(v => v[1])) / 12 * 1.03]; };
  const free = (id, x, z, rot, m = 0.15, shape) => { const [w, dd] = boxOf(id, shape), [aw, ad] = ctx.aabb(w, dd, rot); return ctx.fits(x, z, aw + 2 * m, ad + 2 * m); };
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const pair = (ids, u, s, { rot = null, why = '', layer = 'furnish', rule = 'garden-pair', sku, to = null, m, alts = [] } = {}) => {
    const id = ccmFirst(ctx, ids); if (!id) return [];
    // the spot, or the nearest of its alternatives (alts: [du, ds] shifts, tried in order) where BOTH sides are free
    const rotAt = (x, z) => rot ?? (to ? face(x, z, ...to) : toNear), ok1 = (q) => free(id, ...q, rotAt(...q), m, sku?.shape);
    const spot = [[0, 0], ...alts].map(([du, ds]) => [u + du, s + ds]).find(([uu, ss]) => uu >= 0.5 && tA - uu >= edgeIn && tA + uu <= L - edgeIn && ss >= 0.5 && ss <= deep - edgeIn - 0.3 && (tiny || rule === 'garden-statue' || Math.abs(ss - sc) >= WALK / 2 + Math.max(...boxOf(id, sku?.shape)) / 2) && ok1(P(tA - uu, ss)) && ok1(P(tA + uu, ss)));
    if (!spot) return [];
    const a = P(tA - spot[0], spot[1]), b = P(tA + spot[0], spot[1]);
    const out = [a, b].map(([x, z]) => mansionAt(ctx, id, [x, z, rotAt(x, z)], { layer, rule, why, sku })).filter(Boolean);
    if (out.length === 2) { info.pairs++; if (layer === 'plants') info.plants.placed += 2; } else info.singles += out.length;
    return out;
  };
  const C = P(tA, sc), qT = half - WALK / 2 - edgeIn, qN = sc - WALK / 2 - (d ? 1.5 : edgeIn), qF = deep - edgeIn - sc - WALK / 2 - (gz ? 0 : 0); // a quarter's width, near depth, far depth
  const uq = WALK / 2 + qT / 2, sN = sc - WALK / 2 - qN / 2, sF = sc + WALK / 2 + qF / 2;                                                   // the quarters' centres
  // statues at the two ends of the cross walk, facing the fountain
  if (statueU) pair(['statue-garden'], statueU, sc, { to: C, why: 'a statue at each end of the cross walk, facing the centre', layer: 'anchor', rule: 'garden-statue' });
  // a parterre centred in each quarter (the lily pond takes one far quarter of a big garden, a sundial lawn balances it)
  const grid = (out) => { const l = []; for (let du = 0; du <= 4; du += 0.5) for (let ds = 0; ds <= 4; ds += 0.5) if (du || ds) l.push([du, out * ds]); return l.sort((p, q) => Math.hypot(...p) - Math.hypot(...q)); }; // outward from the quarter's middle, nearest first
  const beds = [], pond = cells >= 56 && qT >= 12 && qF >= 12 && ccmHas(ctx, 'lily-pond');
  for (const [s, q, isFar] of [[sN, qN, false], [sF, qF, true]]) {
    if (Math.min(qT, q) < 7.5) { if (Math.min(qT, q) >= 4.5) pair(['bush-rose'], uq, s, { why: 'a rose bush in the quarter', layer: 'plants' }); continue; }
    if (isFar && pond) { const a = mansionAt(ctx, 'lily-pond', [...P(tA - uq, s), toNear], { layer: 'anchor', rule: 'garden-water', why: 'the lily pond: in one far quarter' }), b = mansionAt(ctx, 'sundial', [...P(tA + uq, s), toNear], { rule: 'garden-balance', why: 'a sundial on the lawn of the other far quarter, balancing the pond' }); info.singles += [a, b].filter(Boolean).length; if (a) info.pond = true; continue; }
    const out = isFar ? 1 : -1, bed = pair(['flowerbed'], uq, s, { why: 'a parterre in the middle of the quarter (clear of the walk round the fountain)', layer: 'plants', rule: 'garden-bed', m: 0.3, alts: grid(out) });
    beds.push(...bed.map(p => ({ p, s })));
  }
  // roses round each parterre (two by two, mirrored), where the quarter has the room
  for (const { p, s } of beds.filter((b, i) => i % 2 === 0)) { const r = p.dims[0] / 2 + 1.9, u0 = Math.abs((horiz ? p.x - C[0] : p.z - C[1])); for (const ds of [-1, 1]) for (const du of [-1, 1]) if (count() < fill + 6) pair(['bush-rose'], u0 + du * r, s + ds * r, { why: 'roses round the parterre', layer: 'plants' }); }
  // trees only in the two far corners, and only where the parterres left the room (the beds come first)
  if (cells >= 42) { const tr = ccmFirst(ctx, ['tree-fruit', 'tree-deciduous']), cw = tr ? ((ctx.lib.objects[tr].skus.find(q => q.shape === 's') || {}).size || ctx.lib.objects[tr].size)[0] / 12 : 9; if (tr && half - edgeIn - cw / 2 - 0.5 > WALK / 2 + cw / 2) pair([tr], half - edgeIn - cw / 2 - 0.5, deep - edgeIn - cw / 2 - 0.5, { why: 'a tree in each far corner, off both axes', layer: 'plants', rule: 'garden-tree', sku: { shape: 's' } }); }
  // topiaries: at the four corners of the crossing (outside the ring round the fountain), then flanking the door
  const k = Math.max(WALK / 2 + 1.2, (ring + 1.6) / Math.SQRT2);
  if (!tiny) for (const sg of [-1, 1]) pair(['planter-topiary'], k, sc + sg * k, { why: 'a clipped topiary at each corner of the crossing', layer: 'plants', sku: { shape: 's1' }, alts: [[0.5, sg * 0.5], [1, sg], [1.5, sg * 1.5], [1, 0], [0, sg], [2, 0], [0, sg * 2]] });
  if (d) pair(['planter-topiary'], d.width / 2 + 1.6, 1.3, { why: 'a topiary each side of the house door', layer: 'plants' });
  // the far end of the main walk: lamp posts, then urns beyond them (by the gate when the gate is there)
  const sEnd = (gz ? axisEnd : deep - edgeIn) - 1.7;
  pair(['lamp-post-iron', 'lantern-post'], WALK / 2 + 1.0, sEnd, { why: 'a lamp post each side of the walk where it leaves the garden', layer: 'light', rule: 'yard-light' });
  pair(['urn-garden'], WALK / 2 + 3.2, sEnd, { why: 'an urn each side of the walk at the far end' });
  // benches facing the fountain, beside the main walk; orange tubs by the house
  if (focal) { pair(['bench-garden', 'bench-street'], WALK / 2 + ccmSize(ctx, 'bench-garden')[0] / 2 + 0.4, sc + ring + 1.4, { rot: toNear, why: 'a bench facing the fountain', alts: [[0, 0.5], [0, 1], [0, 1.5], [0.5, 1], [1, 1.5]] }); if (cells >= 42) pair(['bench-garden', 'bench-street'], WALK / 2 + ccmSize(ctx, 'bench-garden')[0] / 2 + 0.4, sc - ring - 1.4, { rot: toFar, why: 'a bench facing the fountain', alts: [[0, -0.5], [0, -1], [0, -1.5], [0.5, -1], [1, -1.5]] }); }
  if (d && info.wallFt >= 15) pair(['citrus-tree-tub'], Math.min(half - edgeIn - 2, d.width / 2 + 5), 1.8, { why: 'an orange tree in its tub each side of the door, by the house', layer: 'plants' });
  // toward the count: urns where the cross walk meets the edge, bushes at the hedge foot (still in pairs)
  const want = fill;
  if (!tiny && count() < want) pair(['urn-garden'], half - edgeIn - 1.6, sc + WALK / 2 + 1.4, { why: 'an urn where the cross walk meets the hedge' });
  for (let i = 0, s = deep - edgeIn - 2; i < 6 && count() < want && s > sc + WALK; i++, s -= 4.5) pair(['bush-rose', 'bush'], half - edgeIn - 1.9, s, { why: 'a rose at the foot of the hedge', layer: 'plants' });
  for (let i = 0, s = 4.5; i < 4 && count() < want && s < sc - WALK; i++, s += 4.5) pair(['bush-rose', 'bush'], half - edgeIn - 1.9, s, { why: 'a rose at the foot of the hedge', layer: 'plants' });
  ccmDone(ctx);
  const feature = focal || gz || ctx.placements.find(p => p.rule !== 'yard-edge') || null;
  return { feature, what: `formal garden: ${info.edge === 'hedge' ? 'hedged, ' : ''}two walks crossing${focal ? ` at the ${info.focal.kind}` : ''}, ${info.pairs} mirrored pairs${gz ? ', a gazebo closing the axis' : ''}`, outdoor: true, approach: null, passage: true };
}

// the leg of an L-shaped mansion room (see ccmAnnex): more of the same walls, never a second key piece
function mansionAnnex(ctx, { wall = [], seats = ['bench-upholstered'], console = true, paintings = 2, plants = [], drapes = true } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']), n = Math.max(1, Math.round(ctx.area() / 130));
  if (console && Math.max(ctx.W, ctx.D) >= 9) mansionConsole(ctx, ctx.longSides()[ctx.ri(0, 1)], 0.5);
  if (wall.length) ccmAlong(ctx, wall, sides, n, { why: 'against the wall' });
  if (seats.length) ccmAlong(ctx, seats, ctx.longSides(), Math.max(1, Math.min(3, n)), { why: 'a seat against the wall' });
  for (const id of plants.slice(0, 2)) ccmQuiet(ctx, () => ctx.wall(id, { prefer: 'corner', layer: 'plants', why: 'a potted plant', gap: 0.2 }));
  mansionPaintings(ctx, paintings, sides);
  if (drapes) mansionDrapes(ctx);
  let lit = 0; for (const s of sides) if (lit < 2 && ccmQuiet(ctx, () => ctx.mount('sconce-candle-triple', { sides: [s], height: 5.9, layer: 'light', rule: 'wall-light', why: 'candle sconce' }))) lit++;
  if (!lit) mansionChandelier(ctx, [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], true, 'a small chandelier');
}

// ---- service rooms: the inn's Kitchen and Cellar programs whole (PROGRAM_OF), in the mansion's walls. The one mansion
// addition the inn's kitchen cannot make by itself is the servants' bell board: KEY.kitchen is wrapped so that a mansion
// kitchen hangs it beside the door to the house once the inn's program has finished (an inn kitchen takes the old path
// untouched: tests/golden.mjs). The wine bins need nothing: they are wall pieces in the cellar's recipe slots.
PROGRAM_OF['mansion-cellar'] = 'cellar';
// THE MANSION KITCHEN is the castle's: the inn's cooking triangle, then the works (cauldron crane, the long work table with
// the roast, the spit, the hook rail, cupboards), ONE larder corner and the castle's fill. Blind reads (2026-10-06) of the
// inn's kitchen whole in this room: "an alchemist's laboratory", "a potter's workshop and storeroom", "a forge".
// Round 3: it IS castleKitchen now, the 11-ft great hearth included (with the inn's small hearth and the cauldron crane the
// room was still "an alchemist's laboratory" 4 times in 4), and the default is the castle kitchen's 6x5.
function mansionKitchen(ctx) { return castleKitchen(ctx); } // (KEY.kitchen is wrapped below: the bell board)
{ const innKitchen = KEY.kitchen;
  KEY.kitchen = (ctx) => {
    const kp = innKitchen(ctx);
    if (ctx.type.key === 'mansion-kitchen' && !kp.fail) { const hd = ctx.doors.find(o => o.to) || ctx.mainDoor; if (hd) ccmQuiet(ctx, () => ctx.mount('bell-board-servants', { sides: [hd.side], height: 6.7, why: 'the servants\' bell board beside the door to the house' })) || ccmQuiet(ctx, () => ctx.mount('bell-board-servants', { sides: ccmLat(hd.side), height: 6.7, why: 'the servants\' bell board, on the wall nearest the door to the house' })); }
    return kp;
  };
  const innCellar = KEY.cellar; // ... and a mansion cellar lines what wall the cask hall left with arched wine bins
  KEY.cellar = (ctx) => {
    const kp = innCellar(ctx);
    // (no wine-bin mesh yet: wine racks line the wall instead, dusty bottles on what stands there; read blind the inn's cellar was "a cellar or storeroom", never wine)
    if (ctx.type.key === 'mansion-cellar' && !kp.fail && !ccmHas(ctx, 'wine-bin-arched')) { for (let i = 0, n = Math.max(3, Math.min(8, Math.round(ctx.area() / 70))); i < n; i++) if (!mansionWall(ctx, 'wine-rack', ctx.wallsByDoor(), { sideCost: 0.5, at: ctx.r(0.1, 0.9), layer: 'store', rule: 'wine-bin', why: 'wine racks lining the wall' })) break;
      for (const s of ctx.surfaces.slice(0, 8)) ccmQuiet(ctx, () => ctx.surface('bottle-wine-dusty', { on: x => x === s, why: 'a dusty bottle set down' })); }
    if (ctx.type.key === 'mansion-cellar' && !kp.fail) for (let i = 0, n = Math.max(2, Math.min(6, Math.round(ctx.area() / 60))); i < n; i++) if (!mansionWall(ctx, 'wine-bin-arched', ctx.wallsByDoor(), { sideCost: 0.5, at: ctx.r(0.1, 0.9), layer: 'store', rule: 'wine-bin', why: 'arched wine bins lining the wall' })) break;
    return kp;
  }; }

// ---- mansion: hooks into the dispatcher ----
Object.assign(KEY, { 'mansion-hall': mansionHall, 'mansion-drawing': mansionDrawing, 'mansion-dining': mansionDining, 'mansion-library': mansionLibrary, 'mansion-bedroom': mansionBedroom, 'mansion-ballroom': mansionBallroom, 'mansion-conservatory': mansionConservatory,
  'mansion-garden': mansionGarden, 'mansion-kitchen': mansionKitchen }); // (outdoor: attempt() runs KEY[key] in place of yard() when the type has one)
Object.assign(MENUS, {
  'mansion-kitchen': MENUS['castle-kitchen'],
  'mansion-hall': ccmAnnex((ctx) => mansionAnnex(ctx, { wall: ['clock-longcase', 'statue-bust'] })),
  'mansion-drawing': ccmAnnex((ctx) => mansionAnnex(ctx, { wall: ['cabinet-china', 'desk-bureau'], seats: ['settee', 'chair-upholstered'], plants: ['fern-potted'] })),
  'mansion-dining': ccmAnnex((ctx) => mansionAnnex(ctx, { wall: ['sideboard', 'cabinet-china'], seats: [], console: false })),
  'mansion-library': ccmAnnex((ctx) => mansionAnnex(ctx, { wall: ['bookshelf', 'bookshelf', 'bookshelf'], seats: ['chair-upholstered'], console: false, paintings: 1 })),
  'mansion-bedroom': ccmAnnex((ctx) => mansionAnnex(ctx, { wall: ['wardrobe', 'commode'], seats: ['daybed'], console: false })),
  'mansion-ballroom': ccmAnnex((ctx) => mansionAnnex(ctx, { seats: ['chair-salon-gilt', 'bench-upholstered'], paintings: 0 })),
  'mansion-conservatory': ccmAnnex((ctx) => mansionAnnex(ctx, { wall: ['plant-stand-tiered', 'citrus-tree-tub'], seats: [], console: false, paintings: 0, plants: ['palm-potted', 'fern-potted'], drapes: false })),
});
// (the designer asks "about 3" for the hall and 2.5 for the ballroom; test/yard.test.mjs holds the yard's 2 to 0.6x of EVERY
// indoor target, so nothing indoors goes under 3.5. The garden has NO entry: yard() sets its own tapering target, and an
// entry of 2 here would trip that same test's filter, which only skips the key 'yard'.)
Object.assign(DENSITY, { 'mansion-hall': 3.5, 'mansion-drawing': 5, 'mansion-dining': 7, 'mansion-library': 4.5, 'mansion-bedroom': 6.5, 'mansion-ballroom': 3.5, 'mansion-conservatory': 6.5, 'mansion-kitchen': 10, 'mansion-cellar': 11 });
Object.assign(FOCAL, { 'mansion-hall': 'grand stair (or the centre table)', 'mansion-drawing': 'marble fireplace', 'mansion-library': 'ladder bookcase', 'mansion-bedroom': 'state bed', 'mansion-garden': 'fountain (where the two walks cross)' });
Object.assign(KEY_RE, { 'mansion-hall': /^(stair-grand|table-pedestal-round|clock-longcase|table-console)$/, 'mansion-drawing': /^fireplace-/, 'mansion-dining': /^table-(feast|trestle)$/, 'mansion-library': /^(bookcase-ladder|bookshelf)$/, 'mansion-bedroom': /^bed-/,
  'mansion-ballroom': /^(harp|harpsichord|music-stand|chair-salon-gilt|dais)$/, 'mansion-conservatory': /^(fountain-courtyard|palm-potted|citrus-tree-tub|fern-potted)$/, 'mansion-garden': null, 'mansion-kitchen': /^cook-hearth/, 'mansion-cellar': /^(cask-rack|shelving|wine-rack|tun|wine-bin)/ });
