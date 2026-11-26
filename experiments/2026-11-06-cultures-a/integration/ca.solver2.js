// ======================= culture packs A: the room skeleton (2026-11-06, cultures-a) =======================
// Japan, China and India rooms are each ONE line of data run by two programs (the smithy's lesson: a room is data on a
// skeleton). Helpers ccm* / castle* are the ones above; this block stands after them.
//
// caRoom(ctx, S): an INDOOR room read from the door down one axis.
//   focal   [ids]   the room's signature piece, centred on the wall facing the door (focalAt 'centre': mid-floor)
//   flank   { ids, off }       a mirrored pair either side of it (lamps, guardians, vases)
//   before  [{ id, s, dx, rot, layer }]  pieces on the axis in front of it: `s` ft out from the focal's front, mirrored
//           at +-dx when dx is given; rot 'door' faces the door, 'focal' faces the focal piece (worshippers, the offering box)
//   ranks   { id, gap, aisle, turn, s0, per }   rows of one thing facing the focal (temple cushions, teahouse tables)
//   island  { id, seats, n, at }  a table in the floor with seats round it, facing it (at: 'centre' or ft out from the focal)
//   clear   [w, d]     a rectangle in the middle kept EMPTY (the dojo's practice floor), in ft (fractions of the room <= 1)
//   walls   [ids]      down the side walls, in turn, repeating with size;   doorWall [ids]: by the main door
//   corners [ids]      in the two far corners;   hung [{ ids, sides: 'far'|'lat'|'all', n, height }]
//   ceiling [{ id, s, dx }]  hung from the ceiling on the axis;   lamps { wall, floor, every };   rugs [{ id, s }]: flats on the axis
// caYard(ctx, S): an OUTDOOR room (no walls): the path from the gate to the main door laid and kept clear first.
//   focal   [ids] in the open (centre), before the path;   gatePiece id: astride the path just inside the gate
//   line    { ids, every, off }  pairs lining the path;   beside [{ id, at: 'door'|'gate'|'mid', off }] beside the path
//   steps   id: a flat laid along the path every 2.5 ft (stepping stones);   corners [ids]; edge: fence id on open sides
//   edgeItems [ids] against the open edges and building walls;   n: how many edgeItems as the yard grows
const CA = {}; // room key -> its line of data (the jpn / chn / ind blocks below fill it)
function caNear(ctx, id, at, rot, { why = '', layer = 'furnish', rule = 'placed', reach = 3, step = 0.5, extra = {}, unique = false } = {}) {
  if (!ccmHas(ctx, id)) return null;
  return ccmQuiet(ctx, () => ctx.put(id, function* () { for (let dx = -reach; dx <= reach + 1e-6; dx += step) for (let dz = -reach; dz <= reach + 1e-6; dz += step) yield { x: at[0] + dx, z: at[1] + dz, rot, r: Math.hypot(dx, dz) }; }, (c) => c.r, { layer, rule, why, extra, unique }));
}
// a hung thing at (or as near as it fits to) a point along one wall, its bottom at `bottom` ft and its top under the
// ceiling (ctx.mount rolls a random spot: a focal piece needs the middle of its wall). Same clearances as ctx.mount.
function caMountAt(ctx, id, side, tWant, { bottom = 6.5, layer = 'dress', rule = 'wall-mount', why = '', extra = {}, reach = 3 } = {}) {
  if (!ccmHas(ctx, id)) return null;
  const sku = ctx.chooseSku(id); if (!sku) return null;
  const dm = ctx.dims(id, sku), flat = sku.kind === 'flat', w = dm.w, d = flat ? 0.05 : dm.d, L = ctx.sideLen(side);
  for (let k = 0; k <= reach * 2; k++) { const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
    const t = tWant + off;
    if (t - w / 2 < 0.3 || t + w / 2 > L - 0.3) continue;
    if (ctx.overlapsT(ctx.doorT[side], t - w / 2 - 0.4, t + w / 2 + 0.4) || ctx.overlapsT(ctx.windowT[side], t - w / 2, t + w / 2)) continue;
    if (ctx.mounts[side].some(([a, b]) => t - w / 2 < b + 0.3 && a - 0.3 < t + w / 2)) continue;
    ctx.mounts[side].push([t - w / 2, t + w / 2]);
    const [x, z] = ctx.sidePoint(side, t, d / 2 + 0.02);
    return ctx.record(id, sku, dm, x, Math.max(2.5, Math.min(bottom, CEIL - 0.25 - dm.h)), z, SIDES[side].rot, layer, rule, why, { side, orient: flat ? 'wall' : undefined, ...extra });
  }
  return null;
}
const caLayer = (id) => /lamp|lantern|andon|toro|candle|diya|dipa/.test(id) ? 'light' : 'furnish';
function caRoom(ctx, S) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = castleFar(ctx, 2.5, { shortEnd: !!S.shortEnd }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx), ALL = ['N', 'S', 'E', 'W'];
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), toDoor = SIDES[far].rot, toFar = toDoor + Math.PI;
  // 1. the signature piece
  let focal = null;
  if (S.focalHung) for (const id of S.focal) { // a HUNG signature piece (the kamidana): centred high on the wall facing the door
    if (focal || !ccmHas(ctx, id)) continue;
    for (const s of [far, ...lat]) { if (focal) break; // (a window or a door in the middle of the far wall: as near the middle as it fits, then a side wall's middle)
      focal = caMountAt(ctx, id, s, ctx.sideLen(s) / 2, { bottom: (ctx.lib.objects[id].mount ?? 78) / 12, layer: 'anchor', rule: 'key-focal', reach: ctx.sideLen(s) / 2, why: `the ${S.label}: high on the ${s === far ? 'wall facing the door' : 'side wall'}, as near its middle as it fits`, extra: { focal: true } }); }
  }
  else if (S.focalAt === 'centre') focal = ccmCentre(ctx, S.focal, { label: S.label, rot: toDoor, rule: 'key-focal', why: `the ${S.label}: in the middle of the floor` });
  else {
    focal = ccmFocalOn(ctx, far, S.focal, { label: S.label, rule: 'key-focal', gap: S.gap ?? 0.05, slack: Math.max(0.5, L / 2 - 3), why: `the ${S.label}: centred on the wall facing the door` });
    if (!focal) for (const id of S.focal) { if (focal) break; focal = ccmQuiet(ctx, () => ctx.wall(id, { sides: [far, ...lat], layer: 'anchor', rule: 'key-focal', why: `the ${S.label}, against a wall` })); }
  }
  if (!focal) return { fail: `${S.name} has no ${S.label} (${S.focal.some(i => ccmHas(ctx, i)) ? 'nothing fits' : 'no mesh'})` };
  ctx.focal = { label: S.label, id: focal.id, side: S.focalAt === 'centre' ? null : far, ok: true, centre: S.focalAt === 'centre' };
  dunSight(ctx, focal);
  const fs = S.focalHung ? 0.5 : S.focalAt === 'centre' ? deep / 2 + focal.dims[2] / 2 : focal.dims[2] + (S.gap ?? 0.05); // ft out from the far wall to the focal's front
  // 2. the walking line from the door to the front of the focal piece, and every other door to it
  const stand = S.focalAt === 'centre' ? front(focal, 1.5) : axis(Math.min(deep - 2, fs + 1.6));
  if (d) { ccmWalk(ctx, 'approach', [d.inner, stand], { width: S.aisle ?? 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, stand]); }
  // 3. the pair beside it, and the pieces on the axis before it
  if (S.flank) ccmFlank(ctx, focal, S.flank.ids, { off: S.flank.off ?? 0.6, why: S.flank.why || `either side of the ${S.label}`, layer: S.flank.layer || caLayer(S.flank.ids[0]), rule: 'flank' });
  const placed = { focal: 1, before: 0, ranks: 0, seats: 0, walls: 0, door: 0, hung: 0, lights: 0, rugs: 0 };
  for (const g of S.rugs || []) { const s = fs + g.s; if (s < deep - 1 && castleRug(ctx, g.id, ...axis(s), toDoor + (g.turn || 0), {}, g.why || `laid on the axis before the ${S.label}`)) placed.rugs++; }
  for (const b of S.before || []) for (const sg of b.dx ? [-1, 1] : [0]) {
    const s = fs + b.s, rot = b.rot === 'focal' ? toFar : b.rot === 'side' ? toDoor + sg * Math.PI / 2 : toDoor;
    if (s > deep - 1) continue;
    const p = caNear(ctx, b.id, axis(s, L / 2 + sg * (b.dx || 0) + (b.dt || 0)), b.face === 'in' && sg ? toDoor - sg * Math.PI / 2 : rot, { layer: b.layer || caLayer(b.id), rule: 'axis', reach: b.reach ?? 1.5, why: b.why || `before the ${S.label}, on its axis` });
    if (p) placed.before++;
  }
  // 4. ranks of one thing facing the focal piece, either side of the aisle
  if (S.ranks && ccmHas(ctx, S.ranks.id)) {
    const r = S.ranks, rk = ccmRanks(ctx, { far, s0: fs + (r.s0 ?? 3), s1: deep - (r.s1 ?? 4), gap: r.gap ?? 3, aisle: r.aisle ?? 4, turn: r.turn ?? 0, proto: r.id, choose: () => r.id, limit: Math.max(2, Math.round(cells / (r.per ?? 2))), layer: 'furnish', rule: 'rank', why: r.why || `in rows facing the ${S.label}` });
    placed.ranks = rk.placed.length;
    if (r.seats) for (const t of rk.placed) for (const sg of [-1, 1]) { const [fx, fz] = ctx.facingVec(t.rot), lx = fz, lz = -fx, off = t.dims[0] / 2 + 0.9;
      if (caNear(ctx, r.seats, [t.x + lx * sg * off, t.z + lz * sg * off], t.rot - sg * Math.PI / 2, { rule: 'seat', reach: 0.5, why: 'a seat at the table' })) placed.seats++; }
    if (placed.ranks > 1) ctx.growth.push(`${r.id} repeat in rows: ${placed.ranks}`);
  }
  // 5. the island: a table in the floor, seats round it
  if (S.island && ccmHas(ctx, S.island.id)) {
    const I = S.island, at = I.at === 'centre' || I.at == null ? [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2] : axis(Math.min(deep - 3, fs + I.at));
    // (the walk from the door to the focal piece usually crosses the middle: the island steps aside, left or right, as little as it must)
    const [iw] = ccmSize(ctx, I.id), [lx0, lz0] = [Math.cos(toDoor), -Math.sin(toDoor)];
    let t = null;
    for (const k of [0, 1, -1, 1.6, -1.6]) { if (t) break; const sh = k * (iw / 2 + 1.7); t = caNear(ctx, I.id, [at[0] + lx0 * sh, at[1] + lz0 * sh], toDoor, { layer: 'furnish', rule: 'island', reach: k ? 1.2 : 2, why: I.why || 'in the middle of the floor, room to sit all round it' }); }
    if (t && I.seats) { const [fx, fz] = ctx.facingVec(t.rot), lx = fz, lz = -fx, n = I.n ?? 4;
      const spots = [[0, 1], [0, -1], [1, 0], [-1, 0], [0.5, 1], [-0.5, 1], [0.5, -1], [-0.5, -1]].slice(0, n);
      for (const [u, v] of spots) { const ox = u * (t.dims[0] / 2 + 0.9) * (v ? 0.6 : 1), oz = v * (t.dims[2] / 2 + 0.9), x = t.x + lx * ox + fx * oz, z = t.z + lz * ox + fz * oz;
        if (caNear(ctx, I.seats, [x, z], Math.atan2(t.x - x, t.z - z), { rule: 'seat', reach: 0.4, step: 0.2, why: `a seat at the ${I.id.replace(/^[a-z]+-/, '').replace(/-/g, ' ')}` })) placed.seats++; } }
  }
  // 6. the floor kept clear (a practice floor; a hall's open middle)
  if (S.clear) { const [cw, cd] = S.clear.map((v, i) => v <= 1 ? v * (i ? deep : L) : v), [cx, cz] = axis(fs + (deep - fs) / 2); ctx.mark(cx, cz, far === 'N' || far === 'S' ? cw : cd, far === 'N' || far === 'S' ? cd : cw, KEEP); }
  const clearOfDoors = ([a, b]) => { const x = [a, b].includes('W') ? ctx.X0 + 1 : ctx.X1 - 1, z = [a, b].includes('N') ? ctx.Z0 + 1 : ctx.Z1 - 1; return !ctx.doors.some(o => Math.hypot(o.inner[0] - x, o.inner[1] - z) < 5); }; // (a corner a door opens beside takes nothing: it would stand in the doorway)
  // floor lamps first, in the corners (the door wall's first), before the walls fill them: never a corner a door opens beside
  if (S.lamps?.floor) for (const c of [...(d ? ccmLat(d.side).map(s => [d.side, s]) : []), ...lat.map(s => [far, s])].filter(clearOfDoors)) { if (placed.lights >= 2) break; if (ccmCorner(ctx, ccmAny(ctx, S.lamps.floor), c, { why: 'a lamp in a corner', layer: 'light' })) placed.lights++; }
  // 7. the walls: side walls in turn, then by the door; the far corners
  const wallN = Math.max(1, Math.round((S.walls || []).length * Math.min(2, cells / 14)));
  const fside = focal.side || far, wsides = S.focalHung ? ALL.filter(s => s !== fside && (!d || s !== d.side)) : [lat[0], lat[1], far]; // (nothing stands under a hung signature piece)
  for (let k = 0; k < wallN && (S.walls || []).length; k++) { const id = S.walls[k % S.walls.length], sides = k % 2 ? [...wsides].reverse() : wsides;
    const p = isHung(ctx.lib.objects[id], id) ? ccmQuiet(ctx, () => ctx.mount(id, { sides, height: 5.2, why: 'on the side wall' })) : ccmQuiet(ctx, () => ctx.wall(id, { sides, layer: /chest|tansu|shelf|shelves|rack|cask|sack|jar|bin|pot/.test(id) ? 'store' : 'furnish', why: S.wallWhy || 'against the side wall' }));
    if (p) placed.walls++; }
  if (d && S.doorWall) placed.door = castleNear(ctx, S.doorWall, [d.side, ...ccmLat(d.side)], d.inner, { layer: 'store', why: 'by the door' }).length;
  for (const [i, s] of lat.entries()) { const id = (S.corners || [])[i % Math.max(1, (S.corners || []).length)]; if (id && clearOfDoors([far, s])) ccmCorner(ctx, id, [far, s], { why: 'in a far corner', layer: caLayer(id) }); }
  // 8. hung things and ceiling things
  for (const h of S.hung || []) { const sides = h.sides === 'far' ? [far] : h.sides === 'lat' ? lat : h.sides === 'door' && d ? [d.side] : ALL; placed.hung += castleHang(ctx, h.ids, sides, h.n ?? 1, { height: h.height ?? 5.6, why: h.why || 'on the wall' }); }
  for (const c of S.ceiling || []) for (const sg of c.dx ? [-1, 1] : [0]) { const s = fs + c.s; if (s > deep - 1 || !ccmHas(ctx, c.id)) continue; if (ccmQuiet(ctx, () => ctx.ceiling(c.id, { at: axis(s, L / 2 + sg * (c.dx || 0)), layer: caLayer(c.id) === 'light' ? 'light' : 'dress', why: c.why || 'hung from the ceiling' }))) placed.hung++; }
  // 9. light
  if (S.lamps?.wall) placed.lights += ccmWallLights(ctx, S.lamps.wall, lat, { every: S.lamps.every ?? 14, height: 6.2, why: 'a lamp on the wall', min: 1, max: 4 });
  if (!ccmLit(ctx) && S.lamps?.floor) for (const c of [['N', 'W'], ['N', 'E'], ['S', 'E'], ['S', 'W']].filter(clearOfDoors)) { if (ccmLit(ctx)) break; ccmCorner(ctx, ccmAny(ctx, S.lamps.floor), c, { why: 'the one light the room must have, in a corner clear of its doors', layer: 'light' }); }
  if (!ccmLit(ctx) && S.lamps?.floor && S.focalAt !== 'centre' && !S.focalHung) ccmFlank(ctx, focal, S.lamps.floor, { n: 1, off: 0.3, why: 'the one light, beside the ' + S.label + ' (a small room: its corners are taken)' });
  if (!ccmLit(ctx) && S.lamps?.floor) { const id = ccmAny(ctx, S.lamps.floor); // (still dark: the floor spot farthest from every door that takes it)
    if (id) ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (let x = ctx.X0 + dm.w / 2 + 0.2; x <= ctx.X1 - dm.w / 2 - 0.2; x += 0.5) for (let z = ctx.Z0 + dm.d / 2 + 0.2; z <= ctx.Z1 - dm.d / 2 - 0.2; z += 0.5) { const dd = Math.min(99, ...ctx.doors.map(o => Math.hypot(o.inner[0] - x, o.inner[1] - z))); if (dd >= 3.5) yield { x, z, rot: toDoor, dd }; } }, (c) => -c.dd, { layer: 'light', rule: 'lamp', why: 'the one light the room must have, as far from its doors as it fits' })); }
  ccmEnsureLight(ctx, S.lamps?.wall || ['lantern-wall-iron'], S.lamps?.floor || ['candlestick-floor']);
  ctx.caInfo = { culture: S.culture, room: S.name, ...placed };
  ccmDone(ctx);
  return { feature: focal, what: `${S.name}: the ${S.label}${placed.before ? `, ${placed.before} before it` : ''}${placed.ranks ? `, ${placed.ranks} in rows` : ''}${placed.seats ? `, ${placed.seats} seats` : ''}`, approach: null, passage: true };
}
// the stretches of each side that are a building's wall (the rest is open ground); open stretches take no wall things
function caYardSides(ctx) {
  const ALL = ['N', 'S', 'E', 'W'], built = ctx.openings.filter(o => o.to && /^(wall|window|door)$/.test(o.kind));
  for (const s of ALL) { const n = Math.round((ctx.sideLen(s) + 2 * INSET) / CELL); for (let i = 0; i < n; i++) if (!built.some(o => o.side === s && o.index === i)) ctx.mounts[s].push([i * CELL - INSET, (i + 1) * CELL - INSET]); }
  return { built, backSides: ALL.filter(s => built.some(o => o.side === s)) };
}
function caYard(ctx, S) {
  const ALL = ['N', 'S', 'E', 'W'], A = ctx.area(), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const { built, backSides } = caYardSides(ctx);
  const gate = ctx.openings.find(o => o.kind === 'gate') || null, openSegs = gate?.open || [];
  const gateT = gate ? gate.index * CELL - INSET + CELL / 2 : 0, gatePt = gate ? ctx.sidePoint(gate.side, gateT, 2.6) : null;
  const target = ctx.densityTarget = S.density ?? Math.max(1.6, yardTarget(A) * 1.2), want = Math.max(5, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length, room = () => count() < want;
  const doors = [...ctx.doors].sort((a, b) => b.width - a.width);
  ctx.mainDoor = doors[0] || ctx.mainDoor || null;
  const d = ctx.mainDoor, end = d ? d.inner : [cx, cz], start = gatePt || (d ? [cx, cz] : null);
  if (gate) ctx.keepClear(gate.side, gateT, 5, 3.5);
  // 1. the focal piece in the open (before the path, so the path goes round it), on its floor painting when it has one
  let focal = null;
  if (S.centreRug) castleRug(ctx, S.centreRug, cx, cz, 0, {}, `the floor painting under the ${S.label}`);
  if (S.focal) { const rot = gate ? SIDES[gate.side].rot : 0;
    for (const id of S.focal) { if (focal || !ccmHas(ctx, id)) continue;
      focal = ccmQuiet(ctx, () => ctx.put(id, function* () { for (let r = 0; r <= 8; r += 0.5) for (const [ux, uz] of r ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[0, 0]]) yield { x: cx + ux * r, z: cz + uz * r, rot, r }; }, (c) => c.r, { layer: 'anchor', rule: 'yard-focal', unique: true, why: `the ${S.label}: in the open`, extra: { focal: true } })); }
    if (focal) { ctx.focal = { label: S.label, id: focal.id, ok: true, centre: true }; ccmClearRound(ctx, focal, S.round ?? 1.2); } }
  // 2. the path: gate -> main door (with no gate: the middle -> the door), kept clear; every other door joins it
  const path = start && Math.hypot(end[0] - start[0], end[1] - start[1]) >= 4 ? [start, end] : null;
  if (path) ccmWalk(ctx, 'path', path, { width: S.pathW ?? 4 });
  for (const o of ctx.doors) if (o !== d && start) ccmWalk(ctx, 'path', [o.inner, start], { width: 3.5 });
  const along = (f) => path ? [path[0][0] + (path[1][0] - path[0][0]) * f, path[0][1] + (path[1][1] - path[0][1]) * f] : [cx, cz];
  const pathRot = path ? Math.atan2(path[1][0] - path[0][0], path[1][1] - path[0][1]) : 0, plen = path ? Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1]) : 0;
  const lx = Math.cos(pathRot), lz = -Math.sin(pathRot); // the path's left
  // 3. what stands astride the path just inside the gate (the torii): its legs either side, the path through it
  let gp = null;
  if (S.gatePiece && path && ccmHas(ctx, S.gatePiece)) { let [x, z] = along(Math.min(0.35, 3.5 / Math.max(plen, 1)));
    const sk = ctx.chooseSku(S.gatePiece); if (sk) { const dm = ctx.dims(S.gatePiece, sk), rot = pathRot + Math.PI, [aw, ad] = ctx.aabb(dm.w, dm.d, rot);
      // (a gate near a corner: slide it along its own width until it stands on the ground; too wide for the ground: none)
      x = Math.min(ctx.X1 - aw / 2 - 0.1, Math.max(ctx.X0 + aw / 2 + 0.1, x)); z = Math.min(ctx.Z1 - ad / 2 - 0.1, Math.max(ctx.Z0 + ad / 2 + 0.1, z));
      if (aw <= ctx.W - 0.2 && ad <= ctx.D - 0.2) { gp = ctx.record(S.gatePiece, sk, dm, x, 0, z, rot, 'anchor', 'yard-gatepiece', `the ${S.gatePiece.replace(/^[a-z]+-/, '')}: astride the way in, the path through it`, { focal: !focal });
        for (const sg of [-1, 1]) ctx.mark(x + lx * sg * (dm.w / 2 - 0.4), z + lz * sg * (dm.w / 2 - 0.4), 1.2, 1.2); } }
    if (!focal) { focal = gp; ctx.focal = { label: S.label, id: gp?.id, ok: !!gp }; } }
  // 4. pairs lining the path; things beside it
  let lined = 0;
  if (S.line && path) { const n = Math.max(1, Math.floor((plen - 4) / (S.line.every ?? 8)));
    for (let i = 0; i < n && room(); i++) { const f = (i + 1) / (n + 1), [x, z] = along(f);
      for (const sg of [-1, 1]) { const id = ccmAny(ctx, S.line.ids); if (id && caNear(ctx, id, [x + lx * sg * (S.line.off ?? 3.2), z + lz * sg * (S.line.off ?? 3.2)], pathRot + sg * Math.PI / 2, { layer: caLayer(id), rule: 'path-line', reach: 1, why: 'lining the path, in pairs' })) lined++; } } }
  for (const b of S.beside || []) { if (!room() && !b.must) break; const f = b.at === 'door' ? 0.82 : b.at === 'gate' ? 0.18 : typeof b.at === 'number' ? b.at : 0.5, [x, z] = along(f), sg0 = b.side ?? (hash(ctx.baseSeed ?? ctx.room.seed, 'ca-beside', b.id) % 2 ? 1 : -1);
    const off = (S.pathW ?? 4) / 2 + (b.off ?? 2.5);
    for (const sg of b.pair ? [-1, 1] : [sg0]) caNear(ctx, b.id, [x + lx * sg * off, z + lz * sg * off], b.face === 'path' ? pathRot - sg * Math.PI / 2 : b.face === 'gate' ? pathRot + Math.PI : pathRot - sg * Math.PI / 2, { layer: caLayer(b.id), rule: 'beside-path', reach: b.reach ?? 3, why: b.why || 'beside the path' }); }
  // 5. stepping stones laid along the path (a flat), every 2.5 ft
  let steps = 0;
  if (S.steps && path && ccmHas(ctx, S.steps)) for (let s = 2; s < plen - 1; s += 2.5) { const [x, z] = along(s / plen); if (castleRug(ctx, S.steps, x, z, pathRot + (steps % 2 ? 0.3 : -0.2), {}, 'a stepping stone on the path')) steps++; }
  // 6. the corners and the edges; the fence on the open sides (not across the gate)
  for (const [a, b] of [['N', 'W'], ['N', 'E'], ['S', 'E'], ['S', 'W']]) { if (!room()) break; const id = ccmAny(ctx, S.corners || []); if (id) ccmCorner(ctx, id, [a, b], { why: 'in a corner of the ground', layer: caLayer(id), inset: 0.6 }); }
  let edge = 0;
  if (S.edge && ccmHas(ctx, S.edge)) for (const s of openSegs) { if (gate && s.side === gate.side && s.index === gate.index) continue; const t0 = s.index * CELL - INSET, [x, z] = ctx.sidePoint(s.side, t0 + CELL / 2, -INSET), sk = ctx.chooseSku(S.edge); if (!sk) break;
    ctx.record(S.edge, sk, ctx.dims(S.edge, sk), x, 0, z, SIDES[s.side].rot, 'anchor', 'yard-edge', 'a fence along the open edge', { side: s.side }); edge++; }
  const atEdge = (id, why) => ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, ALL, { gap: 0.5, windows: false }), () => ctx.rng() * 30, { layer: caLayer(id) === 'light' ? 'light' : /tree|pine|maple|bush|plant/.test(id) ? 'furnish' : 'store', rule: 'at-edge', why })) : null;
  for (let k = 0, n = Math.max(2, Math.round(A / (S.per ?? 150))); k < n && room() && (S.edgeItems || []).length; k++) atEdge(S.edgeItems[k % S.edgeItems.length], 'at the edge of the ground');
  if (S.lamp && !ccmLit(ctx)) for (const id of S.lamp) if (!ccmLit(ctx)) atEdge(id, 'a light at the edge');
  ctx.yardInfo = { vibe: S.name, edge: S.edge && edge ? S.edge : 'none', edgePieces: edge, wallFt: built.length * CELL, gate: gate ? gate.side : null, focal: focal ? { id: focal.id, kind: S.label } : null, lined, steps, doors: [], signs: 0, wear: 0, plants: { placed: 0, slot: [], waiting: [] } };
  ccmDone(ctx);
  return { feature: focal, what: `${S.name}: ${focal ? `the ${S.label}` : 'no centre piece'}${lined ? `, ${lined} lining the path` : ''}${steps ? `, ${steps} stepping stones` : ''}`, approach: null, passage: true, outdoor: true };
}
// hook a culture's rooms into the dispatcher: KEY (the program), DENSITY (the target finish() reports), KEY_RE (audit:
// the piece that proves the room's purpose) and an annex menu (an L-shaped room's leg: lights and wall things only)
function caRegister(rooms) {
  for (const [key, S] of Object.entries(rooms)) {
    CA[key] = S;
    KEY[key] = S.outdoor ? (ctx) => caYard(ctx, S) : (ctx) => caRoom(ctx, S);
    DENSITY[key] = S.density ?? (S.outdoor ? 2 : 5);
    KEY_RE[key] = S.proof ? new RegExp(S.proof) : null;
    if (!S.outdoor) MENUS[key] = ccmAnnex((ctx) => { if (S.lamps?.wall) ccmWallLights(ctx, S.lamps.wall, ['N', 'S', 'E', 'W'], { every: 16, height: 6.2, why: 'a lamp on the wall', min: 1, max: 2 }); for (const id of (S.walls || []).slice(0, 2)) ccmQuiet(ctx, () => ctx.wall(id, { why: 'against the wall' })); });
  }
}
