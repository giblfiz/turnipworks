// ---------------- crypt (2026-10-05): seven rooms. No windows anywhere: every room ends with at least one light ----------------
const CRYPT_TORCH = ['torch-sconce', 'torch-bracket-rough'], CRYPT_STAND = ['rite-pillar-candle-tall', 'candlestand-pricket', 'candle-tree', 'candlestick-floor'];
const CRYPT_BRAZIER = ['brazier-standing', 'brazier-tripod', 'rite-sacred-flame-bowl'], CRYPT_HEAP = ['skull-pile', 'bones-pile'];
// memorials on the plain panels of the given walls: plaques at 54 in, the odd urn niche at 36 in, a death mask
function cryptHung(ctx, sides, { plaques = 2, niches = 0, masks = 0 } = {}) {
  let k = 0; const side = () => sides[k++ % sides.length];
  for (let i = 0; i < plaques; i++) ccmQuiet(ctx, () => ctx.mount('rite-memorial-plaque', { sides: [side()], height: 5.1, why: 'memorial plaque on a plain panel' }));
  for (let i = 0; i < niches; i++) ccmQuiet(ctx, () => ctx.mount('burial-urn-niche', { sides: [side()], height: 4.25, why: 'urn niche on a plain panel' }));
  for (let i = 0; i < masks; i++) ccmQuiet(ctx, () => ctx.mount('rite-death-mask', { sides: [side()], height: 5.6, why: 'death mask on the wall' }));
}
const cryptCobweb = (ctx) => { if (ccmHas(ctx, 'decal-cobweb') && ctx.chance(0.6)) ccmQuiet(ctx, () => ctx.mount('decal-cobweb', { height: 7.8, why: 'cobwebs up by the ceiling' })); };
// loose bones on the floor (flat decals), thin, never on the walking line a..b
function cryptScatter(ctx, id, n, a = null, b = null) {
  if (!ccmHas(ctx, id)) return;
  for (let k = 0, done = 0; k < n * 4 && done < n; k++) {
    const x = ctx.r(ctx.X0 + 2, ctx.X1 - 2), z = ctx.r(ctx.Z0 + 2, ctx.Z1 - 2);
    if (a && b && segDist([x, z], a, b) < 3) continue;
    if (ccmQuiet(ctx, () => ctx.rug(id, { at: [x, z], rot: ctx.r(0, Math.PI * 2), why: 'loose bones on the floor' }))) done++;
  }
}

// ANTECHAMBER (a through-way with a monument): the mourning statue centred on the wall facing the gate, a brazier each
// side of it, stone benches down the side walls, urns in the corners of the door wall; the middle stays a walking line
function cryptAntechamber(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), FOCAL_IDS = ['statue-weeping-angel', 'monument-urn-draped'];
  // the onward door in the middle of the far wall: the monument stands in the middle of the room and the way passes either side
  let focal = ccmFocalOn(ctx, far, ctx.shuffle(FOCAL_IDS), { label: 'monument', rule: 'key-monument', gap: 0.3, why: 'the monument: centred on the wall facing the gate (axial focal)' });
  if (!focal && Math.min(ctx.W, ctx.D) >= 13) focal = ccmCentre(ctx, ctx.shuffle(FOCAL_IDS), { label: 'monument', rule: 'key-monument', rot: d ? SIDES[far].rot : 0, why: 'the monument: in the middle of the room (a door stands where it would go), the way passing either side' });
  // too narrow for that: the monument stands centred on a side wall, the way passing in front of it
  for (const strict of [true, false]) for (const s of lat) if (!focal) focal = ccmFocalOn(ctx, s, FOCAL_IDS, { label: 'monument', rule: 'key-monument', gap: 0.2, strict, slack: Math.max(0.5, ctx.sideLen(s) / 2 - 2.5), why: 'the monument: against a side wall (a door stands in the wall facing the gate)' });
  if (!focal) return { fail: `antechamber has no monument (${ctx.focal?.why || 'no statue or monument mesh'})` };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; }
  if (d) { ccmWalk(ctx, 'approach', [d.inner, front(focal, 2.2)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'through', [d.inner, front(focal, 2.2), o.inner]); }
  const braziers = ccmFlank(ctx, focal, CRYPT_BRAZIER, { off: ctx.sideLen(far) >= 16 ? 3 : 1.2, why: 'a brazier each side of the monument' });
  if (ctx.chance(0.5)) { const [x, z] = front(focal, 0.9); ccmQuiet(ctx, () => ccmAt(ctx, 'candle-drippings-mound', [x, z, focal.rot], { layer: 'light', why: 'candle stubs at the foot of the monument', allowKeep: true })); }
  // benches: one per 10 ft of side wall, at most 4; urns in the two corners of the door wall
  const run = Math.max(...lat.map(s => ctx.sideLen(s)));
  ccmAlong(ctx, ['bench-stone'], lat, Math.min(4, 2 * Math.max(1, Math.round(run / 10))), { why: 'stone bench along the side wall' });
  if (d) for (const s of ccmLat(d.side)) ccmCorner(ctx, 'urn-decorative', [d.side, s], { why: 'urn in the corner of the door wall' });
  if (cells >= 20) for (const s of lat) ccmCorner(ctx, cells >= 24 ? 'urn-decorative' : 'pedestal-display', [far, s], { why: 'in the corner beside the monument', inset: 0.5 });
  if (cells >= 20) ccmQuiet(ctx, () => ctx.wall('pedestal-display', { sides: lat, why: 'a pedestal against the side wall' }));
  if (cells >= 24 && Math.min(ctx.W, ctx.D) >= 18) for (const sgn of [-1, 1]) { // two pillars, off the centre line
    const L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, [x, z] = ctx.sidePoint(far, L / 2 + sgn * L / 4, deep / 2);
    ccmQuiet(ctx, () => ccmAt(ctx, 'pillar-square', [x, z, 0], { layer: 'anchor', rule: 'pillar', why: 'a pillar either side of the way' }));
  }
  cryptHung(ctx, lat, { plaques: cells >= 20 ? 4 : 2, niches: cells >= 20 ? 2 : ctx.ri(0, 1), masks: ctx.ri(0, 1) });
  ccmWallLights(ctx, CRYPT_TORCH, lat, { every: 11, why: 'wall torch, one every 10-12 ft, alternating sides' });
  cryptCobweb(ctx);
  ccmEnsureLight(ctx, CRYPT_TORCH, ['torch-stand', ...CRYPT_BRAZIER]);
  ccmDone(ctx);
  return { feature: focal, what: `monument (${focal.id}) between ${braziers.length} braziers`, approach: null, passage: true };
}

// BURIAL VAULT (terminal): small, ONE tomb in the middle of the floor; from 20 cells, ranks of tombs lying across the
// room either side of a centre aisle, the founder (an effigy) at the far end, a cross aisle at the door end
function cryptVault(ctx) {
  const panels = ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), lat = ccmLat(far);
  const TOMB = ['sarcophagus', 'stone-coffin-lidless', 'coffin'], openTomb = ccmHas(ctx, 'sarcophagus-open');
  const tombs = []; let founder = null;
  if (cells < 20 || Math.min(ctx.W, ctx.D) < 17) {
    // long axis along the room's long axis, the foot toward the main door when the door is at an end
    const longNS = ctx.D > ctx.W, rot = d && (longNS === (d.side === 'N' || d.side === 'S')) ? SIDES[far].rot : (longNS ? 0 : Math.PI / 2);
    founder = ccmCentre(ctx, ['effigy-knight', ...TOMB].filter((id, i) => i > 0 || ctx.chance(0.3)), { label: 'tomb', rule: 'key-tomb', rot, why: 'the tomb: alone in the middle of the vault' });
    if (founder) tombs.push(founder);
  } else {
    // deep vaults (room for two ranks beyond it): the founder at the far end on the centre line, foot to the door.
    // Then ranks of tombs lying across, 4-ft aisles; in a shallower vault the founder is the first tomb of the far rank
    const fid = ccmFirst(ctx, ['effigy-knight', 'sarcophagus']), [, fd] = ccmSize(ctx, fid || 'sarcophagus'), axial = fid && deep >= 1.8 + fd + 3.5 + 3 + 4 + 3 + 5.5;
    if (axial) founder = ccmQuiet(ctx, () => ccmAt(ctx, fid, [...ctx.sidePoint(far, L / 2, 1.8 + fd / 2), SIDES[far].rot], { layer: 'anchor', rule: 'key-tomb', why: 'the founder\'s tomb: at the far end, on the centre line, foot to the door', unique: true, extra: { focal: true } }));
    if (founder) { tombs.push(founder); ctx.focal = { label: 'founder\'s tomb', id: founder.id, side: far, ok: true }; }
    const want = Math.max(2, Math.round(cells / 7)) - tombs.length, s0 = founder ? 1.8 + fd + 3.5 : 3;
    const rk = ccmRanks(ctx, { far, s0, s1: deep - 5.5, gap: 4, aisle: 4.5, turn: Math.PI / 2, proto: 'sarcophagus', limit: want, layer: 'anchor', rule: 'tomb-rank',
      choose: (row, col, n) => !founder && n === 0 && ccmHas(ctx, 'effigy-knight') ? 'effigy-knight' : openTomb && hash(ctx.baseSeed ?? ctx.room.seed, 'open-tomb', row, col) % 6 === 0 ? 'sarcophagus-open' : ccmFirst(ctx, n % 5 === 4 ? ['stone-coffin-lidless', 'sarcophagus'] : ['sarcophagus', 'stone-coffin-lidless']), why: 'tombs in ranks either side of the centre aisle, lying across the vault' });
    if (!founder && rk.placed.length) founder = rk.placed.find(p => p.id === 'effigy-knight') || null;
    tombs.push(...rk.placed.filter(p => p !== founder)); if (founder && !tombs.includes(founder)) tombs.unshift(founder);
    ctx.vaultInfo = { tombs: tombs.length, ranks: rk.rows, columns: rk.cols, open: rk.placed.filter(p => p.id === 'sarcophagus-open').length, founder: founder?.id || null, niches: panels };
    if (rk.placed.length) ctx.growth.push(`tombs repeat: ${tombs.length} in ${rk.rows} rank${rk.rows === 1 ? '' : 's'} of ${rk.cols}`);
  }
  if (!tombs.length) return { fail: 'burial vault has no tomb (no sarcophagus or coffin mesh, or no floor for one)' };
  const key = founder || tombs[0];
  if (d) { ctx.sight = [d.inner, [key.x, key.z]]; ctx.sightFeature = key.id; }
  for (const t of tombs) ccmClearRound(ctx, t, 1.2);
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, ctx.sidePoint(far, L / 2, deep - 2.6), founder && tombs.length > 1 ? front(founder, 1.5) : front(key, 1.8)], { width: 3.5 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, ctx.sidePoint(far, L / 2, deep - 2.6)]); }
  // tall candles at the head corners of the focal tomb; jars at the foot of one tomb in four; a skull or candle stubs on a closed lid
  const [fx, fz] = ctx.facingVec(key.rot), lx = fz, lz = -fx;
  for (const sgn of [1, -1]) { const id = ccmAny(ctx, CRYPT_STAND); if (id) ccmQuiet(ctx, () => ccmAt(ctx, id, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.4].map(e => [key.x + lx * sgn * (key.dims[0] / 2 + e) - fx * (key.dims[2] / 2 - 0.3), key.z + lz * sgn * (key.dims[0] / 2 + e) - fz * (key.dims[2] / 2 - 0.3), key.rot]), { layer: 'light', rule: 'tomb-candle', why: 'a tall candle at each head corner of the tomb', allowKeep: true })); }
  tombs.forEach((t, i) => {
    if (i % 4 === 1 || (tombs.length === 1 && ctx.chance(0.5))) { const [x, z] = front(t, 0.9); ccmQuiet(ctx, () => ccmAt(ctx, 'rite-canopic-jars-set', [x, z, t.rot], { layer: 'dress', why: 'canopic jars at the foot of the tomb', allowKeep: true })); }
    if (/^(sarcophagus|coffin)$/.test(t.id) && ctx.chance(0.2)) ccmOn(ctx, ccmAny(ctx, ['skull-single', 'candle-drippings-mound']), t, 0, ctx.r(-0.25, 0.25), 'left on the lid');
  });
  // against the plain wall: coffins lying along it, a lidless stone coffin, a bench; urns in the door-wall corners; pillars when big
  const walls = [...lat, far];
  for (let i = 0, n = Math.min(3, Math.round(cells / 12)); i < n; i++) ccmLieAlong(ctx, 'coffin', walls, { why: 'a coffin lying along the wall' });
  if (ctx.chance(0.5)) ccmLieAlong(ctx, 'stone-coffin-lidless', walls, { why: 'a lidless stone coffin along the wall' });
  if (ctx.chance(0.5)) ccmAlong(ctx, ['bench-stone'], walls, 1, { why: 'a stone bench against the wall' });
  if (d) for (const s of ccmLat(d.side)) ccmCorner(ctx, 'urn-decorative', [d.side, s], { why: 'urn in the corner of the door wall' });
  if (cells >= 36) for (const sgn of [-1, 1]) { const [x, z] = ctx.sidePoint(far, L / 2 + sgn * (L / 2 - 2.2), deep - 4.5); ccmQuiet(ctx, () => ccmAt(ctx, 'pillar-square', [x, z, 0], { layer: 'anchor', rule: 'pillar', why: 'a pillar at the cross aisle' })); }
  if (ccmHas(ctx, 'decal-grave-ledger')) for (let i = 0, n = cells >= 36 ? 2 : ctx.ri(0, 1); i < n; i++) ccmQuiet(ctx, () => ctx.rug('decal-grave-ledger', { at: ctx.sidePoint(far, L * (i ? 0.3 : 0.7), deep - 3), rot: SIDES[far].rot + Math.PI / 2, why: 'a grave ledger set in the floor of the cross aisle' }));
  cryptHung(ctx, walls, { plaques: Math.max(1, Math.round((ctx.W + ctx.D) / 15)), niches: ctx.ri(0, 2), masks: ctx.ri(0, 1) });
  ccmWallLights(ctx, CRYPT_TORCH, d ? [d.side, far, ...lat] : walls, { every: 22, min: 2, why: 'wall torch on a plain panel' });
  cryptCobweb(ctx);
  ccmEnsureLight(ctx, CRYPT_TORCH, CRYPT_STAND);
  ccmDone(ctx);
  return { feature: key, what: tombs.length > 1 ? `${tombs.length} tombs in ranks${founder ? ', the founder at the far end' : ''}` : `one tomb (${key.id}) in the middle`, approach: null, passage: true };
}

// OSSUARY (terminal): a storeroom of bones, with NO single seat or altar in it. A great heap of skulls in the middle of the floor
// (the room's key piece, at the largest size the catalog allows), more bones heaped against it, skull-faced pillars round it,
// every outside wall faced with skulls (wall panels), bone troughs and skull heaps along the walls, bones all over the floor.
// (blind reads at table distance, 2026-10-05: the bone shrine read as a THRONE or an altar in 8 rooms of 8 and the room as a
//  "throne room" or "tomb chamber", the room "built around" it; what read as an ossuary was the bone-strewn floor, the skull
//  pillars, the trough ("a sarcophagus filled with skeletal remains") and the loose-bone decals ("skeletons"). The shrine is
//  no longer placed.)
function cryptOssuary(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), lat = ccmLat(far), small = Math.min(ctx.W, ctx.D);
  const big = small >= 17 ? 1.4 : small >= 13 ? 1.15 : 1; // the heap: 5 ft across in a room of 4 x 4 cells, as shipped (3.7 ft) in a small one
  const focal = ccmScaled(ctx, 'skull-pile', big, () => ccmCentre(ctx, ['skull-pile'], { label: 'great heap of skulls', rule: 'key-heap', rot: SIDES[far].rot, why: 'a great heap of skulls in the middle of the floor: what the room is for' }))
    || ccmCentre(ctx, ['bones-pile', 'charnel-trough'], { label: 'heap of bones', rule: 'key-heap', rot: SIDES[far].rot, why: 'a heap of bones in the middle of the floor' });
  if (!focal) return { fail: `ossuary has no heap of skulls or bones (${ctx.focal?.why || 'no mesh, or no floor for one'})` };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; ccmWalk(ctx, 'approach', [d.inner, front(focal, 1.8)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(focal, 1.8)]); }
  // more bones against the heap: behind it and (in a wide room) either side, touching, so it reads as ONE mound
  const [fx, fz] = ctx.facingVec(focal.rot), lx = fz, lz = -fx, mound = [focal];
  const against = (id, ux, uz, k) => ccmScaled(ctx, id, k, () => ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (const e of [0.05, 0.3, 0.55]) { const r = (ux ? focal.dims[0] + dm.w : focal.dims[2] + dm.d) / 2 + e; yield { x: focal.x + (lx * ux - fx * uz) * r, z: focal.z + (lz * ux - fz * uz) * r, rot: focal.rot + ux * Math.PI / 2, e }; } }, (c) => c.e, { layer: 'store', rule: 'mound', why: 'bones heaped against the great heap (one mound)', extra: { with: focal.uid } })));
  if (small >= 13) { const p = against('bones-pile', 0, 1, 0.8); if (p) mound.push(p); }
  if (small >= 23) for (const sgn of [1, -1]) { const p = against(sgn > 0 ? 'bones-pile' : 'skull-pile', sgn, 0, 0.8); if (p) mound.push(p); }
  // pillars: skull-faced, on the corners of a square round the mound (two beside it in a room under 17 ft)
  const pillars = [], pid = ccmFirst(ctx, ['ossuary-pillar', 'pillar-square']), off = Math.max(4.6, Math.min(L, deep) * 0.27);
  if (pid && small >= 13) for (const [a, b] of small >= 17 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 0], [1, 0]]) {
    const [x, z] = ctx.sidePoint(far, L / 2 + a * off, deep / 2 + b * off), p = ccmQuiet(ctx, () => ccmAt(ctx, pid, [x, z, 0], { layer: 'anchor', rule: 'pillar', why: 'a skull-faced pillar beside the great heap' })); if (p) pillars.push(p);
  }
  // the walls: a bone trough per 12 ft of side wall (low: it stands under the skull panels), a rack of bones wherever a
  // plain panel is left (a wall shared with another room, the door wall), skulls stacked between them and in the far corners
  const troughs = ccmAlong(ctx, ['charnel-trough'], lat, Math.max(2, Math.min(6, 2 * Math.round(deep / 12))), { why: 'a bone trough along the side wall', layer: 'store' });
  const shelves = cells >= 16 ? ccmAlong(ctx, ['catacomb-shelf-bones'], [...(d ? [d.side] : []), ...lat], Math.max(1, Math.min(3, Math.round(cells / 20))), { why: 'a rack of bones against a plain panel', layer: 'store' }) : [];
  for (const s of lat) ccmCorner(ctx, 'skull-pile', [far, s], { why: 'skulls heaped in the far corner', layer: 'store', inset: 0.15 });
  ccmAlong(ctx, ['skull-pile', 'bones-pile'], [far, ...lat], Math.max(1, Math.min(6, Math.round(cells / 9))), { why: 'skulls and bones stacked against the wall', layer: 'store' });
  for (const p of pillars.slice(0, cells >= 30 ? 4 : 2)) ccmQuiet(ctx, () => ctx.companion(p, 'bones-pile', { why: 'bones at the foot of the pillar', layer: 'store', maxDist: 3.5 }));
  cryptScatter(ctx, 'decal-bones-scatter', Math.max(3, Math.round(ctx.area() / 55)), d?.inner, d ? [focal.x, focal.z] : null);
  // light: a tall candle either side of the mound toward the door, skull candles on the troughs, torches where a plain panel is left
  for (const sgn of [1, -1]) { const id = ccmFirst(ctx, ['rite-pillar-candle-tall', 'candlestand-pricket', 'candlestick-floor']); if (id) ccmQuiet(ctx, () => ccmAt(ctx, id, [0.6, 0.9, 1.3, 1.8].map(e => [focal.x + lx * sgn * (focal.dims[0] / 2 + e) + fx * (focal.dims[2] / 2 + 0.2), focal.z + lz * sgn * (focal.dims[0] / 2 + e) + fz * (focal.dims[2] / 2 + 0.2), focal.rot]), { layer: 'light', rule: 'heap-candle', why: 'a tall candle either side of the great heap' })); }
  [...troughs, ...shelves.filter(p => p.dims[1] < 4)].slice(0, 4).forEach((tr, i) => { if (ctx.chance(0.7)) ccmOn(ctx, i === 0 && ccmHas(ctx, 'rite-bone-candelabra') ? 'rite-bone-candelabra' : 'skull-candle', tr, ctx.r(-0.3, 0.3), 0, i === 0 ? 'the bone candelabrum on the first trough' : 'a skull candle on top', 'light'); });
  ccmWallLights(ctx, ['torch-bracket-rough', 'torch-sconce'], [...(d ? [d.side] : []), ...lat, far], { every: 20, min: 2, max: 4, why: 'rough torch on a plain panel' });
  cryptCobweb(ctx);
  ccmEnsureLight(ctx, ['torch-bracket-rough', 'torch-sconce'], CRYPT_STAND);
  ctx.ossuaryInfo = { mound: mound.length, pillars: pillars.length, troughs: troughs.length };
  ccmDone(ctx);
  return { feature: focal, what: `a great heap of skulls${mound.length > 1 ? ` (a mound of ${mound.length} heaps)` : ''} between ${pillars.length} skull pillars`, approach: null, passage: true };
}

// CATACOMB CORRIDOR (passage): the key feature is the WALLS: both long walls are burial niches from end to end (walls.js
// PANELS), and the corridor is entered at an end (walls.js DOOR_ENDS). A clear line down the middle; the dead who found no
// niche lie along the walls under them (coffins and wrapped bodies in turn), loose bones on the floor, a candle on the floor
// every 14 ft and a torch on each end wall. No furniture.
// (blind reads at table distance, 2026-10-05, five rounds: niche panels BETWEEN plain panels read as "shelves of sacks" and the
//  room as a crypt STOREROOM; the same panels on every segment of both long walls read as "burial niches ... like the loculi
//  of a catacomb", whichever version. The urn niche on a plain panel read as a wine rack, the bone rack as a wine rack or a
//  bookcase, heaps of skulls as hay or sacks, the lidless stone coffin as a workbench, candle stubs as gold or a forge. What
//  reads as burial from above: a coffin, a wrapped body on the floor, the loose-bone decals ("whole skeletons"))
function cryptCatacomb(ctx) {
  const panels = ccmPanels(ctx);
  const line = throughLine(ctx);
  if (!line.path.ok) return { fail: 'catacomb corridor: the through-line is blocked' };
  const long = ctx.longSides(), ends = ctx.shortSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D);
  const along = (side, t, s) => ctx.sidePoint(side, Math.max(0.5, Math.min(Lr - 0.5, t)), s);
  // the dead along the walls: one about every 9 ft, sides in turn (both sides at once in a corridor 3 cells wide)
  // (the walking line of a corridor 2 cells wide runs down one half of it: the dead lie on whichever side has the room)
  const n = Math.max(wide >= 8.5 ? 2 : 1, Math.round(Lr / 9)), lying = [];
  for (let i = 0; i < n * (wide >= 13.5 ? 2 : 1); i++) {
    const k = wide >= 13.5 ? Math.floor(i / 2) : i, side = long[i % 2], id = wide < 8.5 || (i + (ctx.room.seed ?? 0)) % 3 === 1 ? 'rite-mummified-remains' : 'coffin';
    const p = ccmLieAlong(ctx, id, [side, OPP_SIDE[side]], { near: along(side, Lr * (k + 0.5) / n, 1), why: id === 'coffin' ? 'a coffin against the wall, under the niches' : 'wrapped remains on the floor, under the niches' });
    if (p) lying.push(p);
  }
  const shelves = []; // (the rack of bones read as a bookshelf and the corridor as a library: none here)
  cryptScatter(ctx, 'decal-bones-scatter', Math.max(3, Math.round(ctx.area() / 45)), line.a, line.b);
  if (ccmHas(ctx, 'decal-moss') && ctx.chance(0.5)) ccmQuiet(ctx, () => ctx.rug('decal-moss', { why: 'moss on the damp floor' }));
  // darker than the other rooms on purpose. Nothing hangs on a niche panel, so the long walls are lit from the floor
  const cand = ccmFirst(ctx, ['rite-pillar-candle-tall', 'candlestick-floor', 'candlestand-pricket']);
  if (cand) for (let i = 0, m = Math.max(2, Math.round(Lr / 14)); i < m; i++) { const side = long[(i + 1) % 2], t = Lr * (i + 0.5) / m; ccmQuiet(ctx, () => ccmAt(ctx, cand, [0, 1.5, -1.5, 3, -3, 4.5, -4.5].map(e => [...along(side, t + e, 0.75), 0]), { layer: 'light', rule: 'floor-candle', why: 'a tall candle on the floor by the niches (nothing hangs on a niche panel)' })); }
  ccmWallLights(ctx, CRYPT_TORCH, ends, { every: 10, min: 1, max: 2, why: 'torch on the end wall' });
  cryptCobweb(ctx);
  ccmEnsureLight(ctx, CRYPT_TORCH, CRYPT_STAND);
  ctx.catacombInfo = { niches: panels, shelves: shelves.length, lying: lying.length };
  ccmDone(ctx);
  return { feature: shelves[0] || null, what: `${panels} burial-niche panels along the walls, ${lying.length} of the dead lying under them, a clear through-line`, approach: null, passage: true };
}

// CHAPEL OF REST (terminal): the shared chapel program. Altar on the end wall, a pall-draped coffin on its bier before
// it with a tall candle at each corner, stone benches in rows facing the altar (pews when their mesh exists)
// (blind reads at table distance, 2026-10-05: the pall-draped coffin, red and gold, read as a THRONE or a draped table and the
//  chapel as a "throne room / audience chamber"; the bare bier read as "a bier or catafalque" and the chapel as a funerary
//  hall; the altar cloth read as an open book (the altar as a desk or lectern); the second urn as a barrel; 29 stone benches
//  in a big chapel as rows of cots (a barracks). So: a coffin (or a wrapped body) lies ON the bare bier, the pall only stands
//  in when there is no bier mesh, the altar is bare stone with its candles, at most six rows of seats, and in a long chapel
//  tombs lie along the side walls behind the seats. The door is on the short wall facing the altar (walls.js DOOR_ENDS).)
const CRYPT_CHAPEL = {
  altar: ['altar-stone'], altarGap: 1.5, aisle: 4, pitch: 3.5, backGap: 4, bierMinCells: 15, bierOff: 3.5, maxRows: 6,
  bier: ['rite-funeral-bier', 'rite-funeral-pall'], onBier: (ctx) => ccmFirst(ctx, ctx.roll('lying in state', ['a coffin', 'a coffin', 'a coffin', 'a wrapped body']) === 'a wrapped body' ? ['rite-mummified-remains', 'coffin'] : ['coffin', 'rite-mummified-remains']),
  bierCandles: ['rite-pillar-candle-tall', 'candlestick-floor', 'candlestand-pricket'], bierFoot: ['vase-flowers', 'flowers-dried'],
  seats: ['bench-stone', 'pew'], corner: ['statue-weeping-angel', 'monument-urn-draped'], endCorners: ['urn-decorative'], endCornerSku: { shape: 's1' }, // (stone benches first and no lectern: the castle's wooden pews and lectern joined the library after this room's blind reads; the altar already read as a desk once)
  cloth: null, altarLights: ['rite-bone-candelabra', 'candelabra', 'candlestick'], altarThings: ['rite-offering-candles-tray', 'reliquary', 'tome-holy'],
  overAltar: 'rite-sanctuary-lamp', overBier: 'censer-hanging', hung: ['rite-memorial-plaque'], hangMax: 4,
  sideTombs: ['sarcophagus', 'effigy-knight'], sideTombMax: 4,
  sconces: ['sconce-candle-single'], doorWallLights: ['torch-sconce'], byDoor: [['rite-memorial-sand-tray', 24]],
};

// EMBALMING ROOM (a work room): the stone slab in the middle with standing room down both sides, the salt tub at its
// foot, a work line of prep table and jar shelves on one wall, coffins waiting against another
function cryptEmbalming(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, cells = ccmCells(ctx), longNS = ctx.D > ctx.W, two = cells >= 24 && Math.min(ctx.W, ctx.D) >= 17;
  // the slab lies along the room; its head points at the end wall that has no door (the work line may stand there)
  const ends = longNS ? ['N', 'S'] : ['W', 'E'], headWall = ends.find(s => !ctx.doorT[s].length) || ends[0], rot = SIDES[headWall].rot;
  const pickSlab = (occupied) => ccmFirst(ctx, occupied ? ['rite-corpse-on-slab', 'embalming-table'] : ['embalming-table', 'rite-corpse-on-slab']);
  const occupied = ctx.roll('the slab', ['a shrouded body', 'a shrouded body', 'empty']) !== 'empty';
  const off = two ? (longNS ? [-3.9, 0] : [0, -3.9]) : [0, 0];
  const slab = ccmCentre(ctx, [pickSlab(occupied)].filter(Boolean), { label: 'embalming slab', rule: 'key-slab', rot, off, why: 'the stone slab: in the middle of the room, standing room on every side' });
  if (!slab) return { fail: 'embalming room has no slab (no embalming-table mesh, or no floor for it)' };
  const slabs = [slab];
  if (two) { const s2 = ccmCentre(ctx, [pickSlab(!occupied)].filter(Boolean), { label: 'second slab', rule: 'slab', rot, off: off.map(v => -v), why: 'a second slab beside the first, 5 ft apart' }); if (s2) { slabs.push(s2); ctx.growth.push('the slab repeats: 2 slabs side by side'); } ctx.focal = { label: 'embalming slab', id: slab.id, ok: true, centre: true }; }
  if (d) { ctx.sight = [d.inner, [slab.x, slab.z]]; ctx.sightFeature = slab.id; }
  // companions within reach, then the standing room: the tub at the foot (the drain end), a bucket under the spout, linen by the head
  const [fx, fz] = ctx.facingVec(slab.rot), lx = fz, lz = -fx, [tw, td] = ccmSize(ctx, 'natron-tub');
  // (an end of the slab that faces a door in the end wall stays empty: the tub would stand in that doorway's way)
  const endFree = (side) => { const tc = side === 'N' || side === 'S' ? slab.x - ctx.X0 : slab.z - ctx.Z0; return !ctx.overlapsT(ctx.doorT[side], tc - 3.5, tc + 3.5); };
  // ... and an end with under 3 ft left beyond the companion stays empty too, so there is always a way round the slab
  const endRoom = ((longNS ? ctx.D : ctx.W) - slab.dims[2]) / 2, fits = (dep) => endRoom >= 0.5 + dep + 3;
  const footFree = endFree(OPP_SIDE[headWall]) && fits(td), headFree = endFree(headWall) && fits(ccmSize(ctx, 'linen-wrappings-basket')[1]);
  const tubSpots = [...(footFree ? [[...front(slab, 0.5 + td / 2), slab.rot]] : []), ...(headFree ? [[slab.x - fx * (slab.dims[2] / 2 + 0.5 + td / 2), slab.z - fz * (slab.dims[2] / 2 + 0.5 + td / 2), slab.rot]] : [])];
  let tub = tubSpots.length ? ccmQuiet(ctx, () => ccmAt(ctx, 'natron-tub', tubSpots, { rule: 'companion', why: 'the salt tub at the foot of the slab', extra: { with: slab.uid } })) : null;
  ccmQuiet(ctx, () => ccmAt(ctx, ccmAny(ctx, ['bucket', 'bucket-slop']), [...(footFree ? [[slab.x + fx * (slab.dims[2] / 2 + 0.7) + lx * (tw / 2 + 0.9), slab.z + fz * (slab.dims[2] / 2 + 0.7) + lz * (tw / 2 + 0.9), 0]] : []), [slab.x + fx * (slab.dims[2] / 2 - 0.5) + lx * (slab.dims[0] / 2 + 0.7), slab.z + fz * (slab.dims[2] / 2 - 0.5) + lz * (slab.dims[0] / 2 + 0.7), 0]], { layer: 'store', rule: 'companion', why: 'a bucket under the slab\'s spout' }));
  { const [, bd] = ccmSize(ctx, 'linen-wrappings-basket'), k = slab.dims[2] / 2 + 0.5 + bd / 2, side = tub && (tub.x - slab.x) * fx + (tub.z - slab.z) * fz < 0 ? 1 : 0; // (the tub took the head end: the basket goes beside it)
    ccmQuiet(ctx, () => ccmAt(ctx, 'linen-wrappings-basket', [...(headFree ? [[slab.x - fx * k + lx * side * (tw / 2 + bd / 2 + 0.4), slab.z - fz * k + lz * side * (tw / 2 + bd / 2 + 0.4), slab.rot]] : []), [slab.x - fx * (k - 1.5) + lx * (slab.dims[0] / 2 + bd / 2 + 0.3), slab.z - fz * (k - 1.5) + lz * (slab.dims[0] / 2 + bd / 2 + 0.3), slab.rot]], { layer: 'store', rule: 'companion', why: 'linen wrappings by the head of the slab' })); }
  // standing room and the walking lines FIRST, then the walls take what still fits (a 15-ft room has no slack)
  for (const s of slabs) { const [aw, ad] = ctx.aabb(s.dims[0] + 6, s.dims[2] + 1, s.rot); ctx.mark(s.x, s.z, aw, ad, KEEP); } // 3 ft of standing room down both sides
  { const beside = (pt) => { const sg = (pt[0] - slab.x) * lx + (pt[1] - slab.z) * lz >= 0 ? 1 : -1, k = slab.dims[0] / 2 + 1.5; return [slab.x + lx * sg * k, slab.z + lz * sg * k]; }; // the side of the slab that door is on
    if (d) { ccmWalk(ctx, 'service', [d.inner, beside(d.inner)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, beside(o.inner)]); }
    const k = slab.dims[0] / 2 + 1.5; ccmWalk(ctx, 'round', [[slab.x + lx * k, slab.z + lz * k], [slab.x - lx * k, slab.z - lz * k]]); } // the way round the slab, reserved before the walls fill
  if (!tub) tub = ccmQuiet(ctx, () => ctx.wall('natron-tub', { prefer: 'near', near: front(slab, 2), rule: 'companion', why: 'the salt tub against the wall nearest the slab\'s foot (no room at the foot itself)' }));
  // the work line: prep table and jar shelves on a long wall that has no door, coffins on the wall opposite
  // (3 ft of standing room each side of the slab AND a 3-ft table on a side wall need a room 17 ft across: a narrower
  // room keeps its work line on the end wall beyond the slab's head, and the long walls take the coffins)
  const longs = ctx.longSides(), across = Math.min(ctx.W, ctx.D), sideWork = across >= (two ? 25 : 17);
  const work = sideWork ? (longs.find(s => !ctx.doorT[s].length) || longs[0]) : headWall, other = OPP_SIDE[work], coffinWalls = sideWork ? [other, ...ccmLat(work)] : [...ccmLat(work), other];
  const table = ccmQuiet(ctx, () => ctx.put('table-kitchen-prep', (dm) => ctx.wallGen(dm, [work, ...(sideWork ? [] : ccmLat(work))]), (c) => (c.side === work ? 0 : 20) + Math.abs(c.t - ctx.sideLen(c.side) * (sideWork ? 0.35 : 0.5)), { layer: 'anchor', rule: 'work-line', why: 'the work table on the work-line wall' }));
  const nShelf = cells >= 20 ? 2 : 1, shelves = [];
  for (let i = 0; i < nShelf; i++) { const p = ccmQuiet(ctx, () => ctx.put('shelving-freestanding', (dm) => ctx.wallGen(dm, [work, ...ccmLat(work)]), (c) => (c.side === work ? 0 : 5) + (table ? Math.abs(Math.hypot(c.x - table.x, c.z - table.z) - 5.5 - i * 4.5) : 0), { layer: 'store', rule: 'work-line', why: 'jar shelves beside the work table' })); if (p) shelves.push(p); }
  if (table) { for (const id of ['rite-embalming-tools', 'rite-canopic-jars-set', 'candlestick']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the work table' })); for (const id of ctx.pick(['rite-canopic-jar', 'jar-lidded-stoneware', 'oil-jar', 'rite-burial-shroud-folded', 'rite-canopic-jar'], cells >= 20 ? 4 : 2)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, why: 'jars and linen on the work table' })); ccmQuiet(ctx, () => ctx.mount('shelf-wall', { sides: [work], height: 5.6, layer: 'store', why: 'a shelf on the wall of the work line' })); }
  for (const sh of shelves) ccmQuiet(ctx, () => ctx.companion(sh, 'storage-jar', { why: 'a big jar beside the shelves', layer: 'store', maxDist: 4 }));
  for (let i = 0, n = cells >= 20 ? 2 : 1; i < n; i++) ccmLieAlong(ctx, 'coffin', coffinWalls, { why: 'a coffin waiting against the wall' });
  if (cells >= 16) ccmQuiet(ctx, () => ctx.wall('coffin-maker-stack', { sides: coffinWalls, prefer: 'corner', layer: 'store', why: 'new coffins stacked in a corner' }));
  if (d && ctx.chance(0.5)) ccmLieAlong(ctx, 'rite-mummified-remains', [d.side, ...ccmLat(d.side)], { why: 'finished work, wrapped, waiting by the door', near: d.inner });
  if (d) ccmQuiet(ctx, () => ctx.wall(ccmAny(ctx, ['washstand', 'basin-stone']), { sides: [d.side, ...ccmLat(d.side)], prefer: 'near', near: d.inner, why: 'somewhere to wash, by the door' }));
  ctx.ceiling('lantern-hanging', { at: [slab.x, slab.z], why: 'lantern over the slab' });
  if (ctx.chance(0.4) && ccmHas(ctx, 'censer-hanging')) ctx.ceiling('censer-hanging', { at: [ctx.X0 + 2.2, ctx.Z0 + 2.2], layer: 'dress', why: 'a censer hanging in the corner' });
  ccmWallLights(ctx, ['lantern-wall-iron', 'torch-sconce'], [work], { every: 14, height: 6, why: 'lantern on the work-line wall', max: 2 });
  cryptHung(ctx, [other, ...ccmLat(work)], { plaques: 0, masks: ctx.ri(0, 2) });
  ccmEnsureLight(ctx, ['lantern-wall-iron', 'torch-sconce'], ['candlestick-floor']);
  ccmDone(ctx);
  return { feature: slab, what: `embalming slab (${occupied ? 'a shrouded body on it' : 'empty'})${slabs.length > 1 ? ' ×2' : ''}`, approach: null, passage: true };
}

// RELIC CHAMBER (terminal, the reward room): the gold reliquary shrine facing the door between two fire bowls, an open
// chest of gold in a far corner turned toward the door, chests and coin heaps at the walls
function cryptRelic(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), cells = ccmCells(ctx), lat = ccmLat(far);
  let focal = cells >= 16 ? ccmCentre(ctx, ['reliquary-shrine'], { label: 'reliquary shrine', rule: 'key-shrine', rot: SIDES[far].rot, why: 'the reliquary shrine: dead centre, facing the door' }) : null;
  if (!focal) focal = ccmFocalOn(ctx, far, ['reliquary-shrine'], { label: 'reliquary shrine', rule: 'key-shrine', gap: Math.min(ctx.W, ctx.D) >= 13 ? 2 : 0.4, why: 'the reliquary shrine: centred opposite the door (axial focal)' });
  let relic = null;
  if (!focal) { focal = ccmCentre(ctx, ['pedestal-display'], { label: 'relic on its pedestal', rule: 'key-pedestal', rot: SIDES[far].rot, why: 'a pedestal in the middle of the room, the relic on it' }); if (focal) relic = ccmOn(ctx, ccmAny(ctx, ['reliquary', 'casket-ornate', 'reliquary-hand']), focal, 0, 0, 'the relic on its pedestal'); }
  if (!focal) focal = ccmCentre(ctx, ['sarcophagus'], { label: 'tomb', rule: 'key-tomb', rot: SIDES[far].rot, why: 'a tomb in the middle of the room (no shrine, no pedestal)' });
  if (!focal) return { fail: 'relic chamber has no shrine, pedestal or tomb' };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; ccmWalk(ctx, 'approach', [d.inner, front(focal, 1.6)]); }
  ccmFlank(ctx, focal, ['rite-sacred-flame-bowl', 'brazier-standing', 'brazier-tripod'], { off: 0.8, why: 'a fire bowl each side of the shrine' });
  // the reward shot: the open chest of gold in a far corner, turned 15-30 degrees toward the door
  const cs = lat[ctx.ri(0, 1)];
  if (ccmHas(ctx, 'chest-treasure')) { const [w] = ccmSize(ctx, 'chest-treasure'), m = w / 2 + 0.9, x = [far, cs].includes('W') ? ctx.X0 + m : [far, cs].includes('E') ? ctx.X1 - m : null, z = [far, cs].includes('N') ? ctx.Z0 + m : ctx.Z1 - m; const tgt = d ? d.inner : [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], base = SIDES[far].rot, want = Math.atan2(tgt[0] - x, tgt[1] - z); let dd = ((want - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI; dd = Math.sign(dd || 1) * Math.min(Math.max(Math.abs(dd), 0.26), 0.52); const [nx, nz] = SIDES[far].n; ccmQuiet(ctx, () => ccmAt(ctx, 'chest-treasure', [0, 1, 2, 3, 4.5, 6].map(k => [x + nx * k, z + nz * k, base + dd]), { layer: 'anchor', rule: 'reward', why: 'the open chest of gold: in a far corner, turned toward the door' })); }
  const chests = ccmAlong(ctx, ['chest-ironbound', 'chest-plain'], lat, Math.max(1, Math.min(3, Math.round(cells / 7))), { why: 'a chest against the side wall', layer: 'store' });
  const treasure = ctx.placements.filter(p => /^chest-/.test(p.id));
  for (let i = 0, n = cells >= 16 ? 3 : 1; i < n && treasure.length; i++) ccmQuiet(ctx, () => ctx.companion(treasure[i % treasure.length], ccmAny(ctx, i === 1 ? ['rite-grave-goods-pile', 'coin-pile'] : ['coin-pile', 'rite-grave-goods-pile']), { why: 'heaped beside the chest (like with like)', layer: 'store', maxDist: 3.5 }));
  if (d) for (const s of ccmLat(d.side)) ccmCorner(ctx, ctx.chance(0.4) && ccmHas(ctx, 'candlestand-pricket') ? 'candlestand-pricket' : 'urn-decorative', [d.side, s], { why: 'in the corner of the door wall', layer: 'furnish' });
  if (cells >= 12) for (const s of lat) { const p = ccmQuiet(ctx, () => ctx.put('pedestal-display', (dm) => ctx.wallGen(dm, [s]), (c) => Math.abs(c.t - ctx.sideLen(s) * 0.5), { rule: 'display', why: 'a pedestal against the side wall, a relic on it' })); if (p && p !== focal) ccmOn(ctx, ccmAny(ctx, ['reliquary-hand', 'rite-relic-bone-fragment', 'casket-ornate', 'urn-ashes-small']), p, 0, 0, 'a relic on its pedestal'); }
  if (cells >= 20) ccmCorner(ctx, 'monument-urn-draped', [far, lat.find(s => s !== cs)], { why: 'a draped urn in the far corner', inset: 0.5 });
  for (const c of chests.slice(0, 1)) ccmQuiet(ctx, () => ctx.surface('coin-stack', { on: s => s.uid === c.uid, why: 'coins on the chest lid' }));
  cryptHung(ctx, [far], { plaques: 0, masks: ctx.ri(1, 2) });
  if (d) ccmWallLights(ctx, ['torch-sconce'], [d.side], { every: 14, max: 2, why: 'torch on the door wall' });
  ccmEnsureLight(ctx, CRYPT_TORCH, ['candlestand-pricket', ...CRYPT_BRAZIER]);
  ccmDone(ctx);
  return { feature: focal, what: focal.id === 'reliquary-shrine' ? 'reliquary shrine between two fire bowls' : relic ? 'a relic on its pedestal' : focal.id, approach: null, passage: true };
}

// the leg of an L-shaped crypt room (see ccmAnnex): more of the same walls, never a second monument, altar or slab
function cryptAnnex(ctx, { lie = [], wall = [], heaps = false, seats = false, hung = { plaques: 2 }, torches = CRYPT_TORCH, every = 13 } = {}) {
  const sides = ['N', 'S', 'E', 'W'], n = Math.max(1, Math.round(ctx.area() / 120));
  for (let i = 0; i < n && lie.length; i++) ccmLieAlong(ctx, ccmAny(ctx, lie), ctx.shuffle(sides), { why: 'lying along the wall' });
  if (wall.length) ccmAlong(ctx, wall, ctx.shuffle(sides), n, { why: 'against the wall', layer: 'store' });
  if (seats) ccmAlong(ctx, ['bench-stone'], ctx.longSides(), Math.max(1, Math.min(4, Math.round(Math.max(ctx.W, ctx.D) / 10))), { why: 'stone bench along the wall' });
  if (heaps) ccmQuiet(ctx, () => ctx.cornerPile(CRYPT_HEAP.filter(i => ccmHas(ctx, i)), Math.min(3, n + 1), { why: 'bones heaped in a corner' }));
  cryptHung(ctx, sides, hung);
  ccmWallLights(ctx, torches, ctx.shuffle(sides), { every: every * 2, min: 1, why: 'wall torch' });
  ccmEnsureLight(ctx, CRYPT_TORCH, CRYPT_STAND);
}

// ---- crypt: hooks into the dispatcher ----
Object.assign(MENUS, {
  'crypt-antechamber': ccmAnnex((ctx) => cryptAnnex(ctx, { seats: true, wall: ['urn-decorative'], hung: { plaques: 2, niches: 1 } })),
  'crypt-vault': ccmAnnex((ctx) => cryptAnnex(ctx, { lie: ['coffin', 'stone-coffin-lidless'], wall: ['urn-decorative'], hung: { plaques: 2, niches: 1 } })),
  'crypt-ossuary': ccmAnnex((ctx) => cryptAnnex(ctx, { wall: ['charnel-trough', 'catacomb-shelf-bones'], heaps: true, hung: { plaques: 0, niches: 1 }, torches: ['torch-bracket-rough', 'torch-sconce'] })),
  'crypt-catacomb': ccmAnnex((ctx) => cryptAnnex(ctx, { lie: ['coffin', 'rite-mummified-remains'], hung: { plaques: 0 } })),
  'crypt-chapel': ccmAnnex((ctx) => cryptAnnex(ctx, { seats: true, wall: ['urn-decorative'], hung: { plaques: 3 }, torches: ['sconce-candle-single', 'torch-sconce'], every: 10 })),
  'crypt-embalming': ccmAnnex((ctx) => cryptAnnex(ctx, { lie: ['coffin'], wall: ['shelving-freestanding', 'coffin-maker-stack', 'storage-jar'], hung: { plaques: 0, masks: 1 }, torches: ['lantern-wall-iron', 'torch-sconce'] })),
  'crypt-relic': ccmAnnex((ctx) => cryptAnnex(ctx, { wall: ['chest-ironbound', 'chest-plain', 'urn-decorative', 'pedestal-display'], hung: { plaques: 0, masks: 1 }, torches: ['torch-sconce'] })),
});
Object.assign(KEY, { 'crypt-antechamber': cryptAntechamber, 'crypt-vault': cryptVault, 'crypt-ossuary': cryptOssuary, 'crypt-catacomb': cryptCatacomb,
  'crypt-chapel': (ctx) => chapel(ctx, CRYPT_CHAPEL), 'crypt-embalming': cryptEmbalming, 'crypt-relic': cryptRelic });
// (targets follow the designer's COUNTS per room size; the 'about N per 100 sq ft' lines in rooms.json run 1.4-2x over those counts)
Object.assign(DENSITY, { 'crypt-antechamber': 4, 'crypt-vault': 4, 'crypt-ossuary': 4, 'crypt-catacomb': 3.5, 'crypt-chapel': 5, 'crypt-embalming': 5.5, 'crypt-relic': 4.5 }); // (catacomb 3.5, not the designer's 3: test/yard.test.mjs holds the yard's 2 to 0.6x of EVERY indoor target)
Object.assign(FOCAL, { 'crypt-antechamber': 'monument', 'crypt-ossuary': 'great heap of skulls (in the middle of the floor)', 'crypt-chapel': 'altar (on the end wall)', 'crypt-relic': 'reliquary shrine', 'crypt-vault': 'the founder\'s tomb (in a vault of ranks)' });
Object.assign(KEY_RE, { 'crypt-antechamber': /^(statue-weeping-angel|monument-urn-draped)$/, 'crypt-vault': /^(sarcophagus|effigy-knight|stone-coffin-lidless|coffin)/, 'crypt-ossuary': /^(skull-pile|bones-pile|charnel-trough)$/,
  'crypt-catacomb': null, 'crypt-chapel': /^altar-stone$/, 'crypt-embalming': /^(embalming-table|rite-corpse-on-slab)$/, 'crypt-relic': /^(reliquary-shrine|pedestal-display|sarcophagus)$/ });
