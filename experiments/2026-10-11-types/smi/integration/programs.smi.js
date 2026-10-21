// ======================= smithy & workshop (2026-10-11) =======================
// Nine rooms, appended like castle / crypt / mansion (helpers ccm*, castlePut, front, surfaceAt are the ones above;
// mktRegisterTrade is the market type's: this block must stand AFTER the mkt:solver2 block).
//
// THE WORKSHOP SKELETON. Every workshop is the same room: the HEAT source (forge, kiln) centred on the wall facing the
// door, its helpers beside it on that wall (bellows, fuel), the WORKSTATION one step in front of it in the middle of the
// floor with standing room all round (anvil, wheel; where the craft has no fire the workstation IS the middle of the
// room: the carpenter's bench), a quench or water vessel beside the workstation, a BENCH under the TOOL WALL on one side
// wall, FINISHED goods on racks down the other side wall, RAW stock by the door. The CRAFT is data: SMI_CRAFTS[room key]
// names the piece for each role. A NEW CRAFT = its workstation mesh (+ its heat source, tool board and stock if it has
// its own) + one line here + one room-type line in build_data.py.
//   heat      [ids] in order of preference: centred on the far wall. [] = none (the workstation is the focal piece)
//   beside    [ids] against the same wall, one each side of the heat source
//   station   [ids] the workstation; `across`: its long side across the room (a bench you walk round)
//   by        [ids] within reach of the workstation (the quench trough; water for the wheel)
//   bench     [ids] against a side wall;  tools [ids] hung over it (hung boards) or standing beside it
//   done      [ids] finished goods, on the other side wall, repeating as the room grows
//   raw       [ids] raw stock, by the door and in the corners;  floor [ids] loose kit as the room grows
const SMI_LAMPS = ['lantern-wall-iron', 'torch-sconce', 'torch-bracket-rough'];
const SMI_CRAFTS = {
  'smi-forge': { name: "blacksmith's forge", label: 'forge', heat: ['forge'], beside: ['bellows-great', 'coal-bin'], station: ['anvil'], by: ['quench-trough', 'grindstone'],
    bench: ['table-work'], tools: ['tool-rack-smith', 'smith-horseshoe-rack', 'tool-rack-smith'], done: ['shop-shelf-stocked', 'weapon-rack'], raw: ['metal-stock', 'smith-coal-heap', 'barrel', 'crate'],
    floor: ['smith-soot-bucket', 'barrel', 'crate', 'bucket', 'firewood-basket', 'metal-stock'], on: ['warhammer', 'horseshoes-pile', 'bellows-hand'] },
  'smi-armoury': { name: "armourer's workshop", label: 'armour form', heat: [], beside: [], station: ['smith-breastplate-on-form', 'armor-stand'], by: ['armor-stand', 'grindstone'], /* (no anvil: with one in the middle of the floor the room read as the forge) */
    bench: ['mil-armor-repair-bench', 'table-work'], tools: ['tool-rack-smith', 'smith-helm-row-shelf', 'shield-display'], done: ['armor-stand', 'weapon-rack', 'armor-stand', 'shop-shelf-stocked', 'armor-stand', 'weapon-rack'], raw: ['metal-stock', 'shop-floor-stock', 'mil-shield-stack', 'chest-ironbound'],
    floor: ['grindstone', 'shop-floor-stock', 'mil-shield-stack', 'crate', 'barrel'], on: ['helm-open', 'armor-breastplate', 'helm-great', 'sword-short'], ranks: 'armor-stand' },
  'smi-carpenter': { name: "carpenter's woodshop", label: "carpenter's bench", heat: [], beside: [], station: ['carpenter-bench'], across: true, by: ['craft-shavings-pile', 'sawhorse'],
    bench: ['sawhorse'], tools: ['craft-tool-wall-pegboard', 'craft-tool-wall-pegboard'], done: ['craft-chair-half-built', 'chair-plain', 'table-square', 'chest-plain', 'chair-plain', 'stool-three-leg'], raw: ['craft-boards-planed-stack', 'craft-wood-offcut-bin', 'woodpile', 'craft-boards-planed-stack'],
    floor: ['craft-shavings-pile', 'sawhorse', 'wheel-spare', 'barrel', 'crate', 'craft-wood-offcut-bin'], on: [] },
  'smi-potter': { name: "potter's workshop", label: 'kiln', heat: ['kiln-pottery'], beside: ['woodpile', 'clay-bin'], station: ['potters-wheel'], by: ['clay-bin', 'rural-water-bucket-stable', 'bucket'],
    bench: ['table-work'], tools: ['pots-drying-shelf'], done: ['pots-drying-shelf', 'pots-drying-shelf', 'shelving-freestanding', 'pots-drying-shelf'], raw: ['pottery-for-sale', 'storage-jar', 'urn-garden', 'storage-jar'],
    floor: ['pottery-for-sale', 'storage-jar', 'firewood-basket', 'barrel', 'urn-garden'], on: ['jug-clay', 'bowl-clay', 'cup-clay', 'bottle-clay'] },
};
// a thing standing in the floor at (or as near as it fits to) a spot, turned `rot`
function smiNear(ctx, id, at, rot, { why = '', layer = 'furnish', rule = 'work-floor', reach = 4, step = 0.5, extra = {}, unique = false, allowKeep = false } = {}) {
  if (!ccmHas(ctx, id)) return null;
  return ccmQuiet(ctx, () => ctx.put(id, function* () { for (let dx = -reach; dx <= reach + 1e-6; dx += step) for (let dz = -reach; dz <= reach + 1e-6; dz += step) yield { x: at[0] + dx, z: at[1] + dz, rot, r: Math.hypot(dx, dz) }; }, (c) => c.r, { layer, rule, why, extra, unique, allowKeep }));
}
// against a wall, as near a point as it fits (hung things are mounted on the first wall that takes them)
function smiWallNear(ctx, id, sides, near, { why = '', layer = 'furnish', rule = 'against-wall', gap = 0.05, height = 5.2, windows = true } = {}) {
  if (!ccmHas(ctx, id) || !sides.length) return null;
  if (isHung(ctx.lib.objects[id], id)) { for (const s of sides) { const p = ccmQuiet(ctx, () => ctx.mount(id, { sides: [s], height, layer, why })); if (p) return p; } return null; }
  return ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap, step: 0.25, windows }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 20, { layer, rule, why }));
}

function smiWorkshop(ctx) {
  const C = SMI_CRAFTS[ctx.type.key] || SMI_CRAFTS['smi-forge'];
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot, ALL = ['N', 'S', 'E', 'W'];
  const at = (t, s) => ctx.sidePoint(far, t, s);
  // 1. the heat source: centred on the wall facing the door (off centre where a door or a window is in the way; a side wall last)
  let heat = null;
  if (C.heat.length) {
    heat = ccmFocalOn(ctx, far, C.heat, { label: C.label, rule: 'key-heat', slack: Math.max(0.5, L / 2 - 4.5), why: `the ${C.label}: on the wall facing the door, the whole room works toward it` });
    if (!heat) for (const id of C.heat) { heat = heat || smiWallNear(ctx, id, [far, ...lat], at(L / 2, 0), { layer: 'anchor', rule: 'key-heat', why: `the ${C.label}, against the wall` }); }
    if (!heat) return { fail: `${C.name} has no ${C.label} (no wall takes it)` };
    ctx.focal = { label: C.label, id: heat.id, side: heat.side || far, ok: true };
  }
  // 2. the workstation: one step (3 ft) in front of the heat source, or in the middle of the floor; 1.6 ft kept clear all round
  const hf = heat ? front(heat, 3.0) : null, mid = at(L / 2, Math.min(deep / 2, deep - 6.5));
  let station = null;
  for (const id of C.station) { if (station) break;
    const dm = ccmSize(ctx, id), rot = C.across ? toDoor : (heat ? heat.rot : toDoor), spot = heat ? [hf[0] + Math.sin(heat.rot) * dm[1] / 2, hf[1] + Math.cos(heat.rot) * dm[1] / 2] : mid;
    station = smiNear(ctx, id, spot, rot, { layer: 'anchor', rule: 'key-station', unique: true, reach: heat ? 2.5 : 4, why: heat ? `the ${id.replace(/-/g, ' ')}: one step from the ${C.label}` : `the ${C.label}: in the middle of the floor, room to work all round it`, extra: heat ? {} : { focal: true } }); }
  if (!station && !heat) return { fail: `${C.name} has no workstation` };
  if (!heat) ctx.focal = { label: C.label, id: station.id, ok: true, centre: true };
  const feature = heat || station, work = station || heat;
  if (station) ccmClearRound(ctx, station, 1.6);
  if (heat) ctx.mark(...front(heat, 1.4), ...(heat.side === 'E' || heat.side === 'W' ? [2.6, Math.min(heat.dims[0], 5)] : [Math.min(heat.dims[0], 5), 2.6]), KEEP); // standing room at the fire
  // walking lines, before anything else stands: every door to the workstation's near side
  const stand = station ? [station.x + (d ? Math.sign(d.inner[0] - station.x) * (far === 'E' || far === 'W' ? station.dims[2] / 2 + 1.8 : 0) : 0), station.z + (d ? Math.sign(d.inner[1] - station.z) * (far === 'N' || far === 'S' ? station.dims[2] / 2 + 1.8 : 0) : 0)] : front(heat, 2.2);
  if (d) { ctx.sight = [d.inner, [feature.x, feature.z]]; ctx.sightFeature = feature.id; ccmWalk(ctx, 'approach', [d.inner, stand]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, stand]); }
  // 3. beside the heat source, on its wall: the bellows one side, the fuel the other
  const besides = heat ? C.beside.map((id, i) => ccmFlank(ctx, heat, [id], { off: 0.4, n: 1, layer: 'store', rule: 'by-heat', why: `beside the ${C.label}, on its wall` })[0] || smiWallNear(ctx, id, [heat.side || far], [heat.x, heat.z], { layer: 'store', rule: 'by-heat', why: `beside the ${C.label}` })).filter(Boolean) : [];
  if (besides.length === 1 && C.beside[1] && heat) { const [fx, fz] = ctx.facingVec(heat.rot), lx = fz, lz = -fx, sg = Math.sign((besides[0].x - heat.x) * lx + (besides[0].z - heat.z) * lz) || 1, id = C.beside[1], dm = ccmSize(ctx, id);
    const p = smiNear(ctx, id, [heat.x - lx * sg * (heat.dims[0] / 2 + 0.4 + dm[0] / 2), heat.z - lz * sg * (heat.dims[0] / 2 + 0.4 + dm[0] / 2)], heat.rot, { layer: 'store', rule: 'by-heat', reach: 1.5, step: 0.25, why: `the other side of the ${C.label}` }); if (p) besides.push(p); }
  // 4. within reach of the workstation: the quench trough (water) beside the anvil, the clay by the wheel
  const bys = [];
  if (station) { const [fx, fz] = ctx.facingVec(station.rot), lx = fz, lz = -fx;
    C.by.slice(0, cells >= 16 ? 2 : 1).forEach((id, i) => { const sg = i ? -1 : 1, dm = ccmSize(ctx, id), off = station.dims[0] / 2 + 1.7 + Math.min(dm[0], dm[1]) / 2;
      const put = (s, reach) => smiNear(ctx, id, [station.x + lx * s * off, station.z + lz * s * off], station.rot + Math.PI / 2, { rule: 'by-station', reach, why: `within reach of the ${station.id.replace(/-/g, ' ')}` });
      const p = put(sg, 3) || put(-sg, 3) || put(sg, 6); if (p) bys.push(p); }); }
  // 5. the bench against one side wall with the tool wall over and beside it; finished goods down the other side wall
  const side0 = lat[hash(ctx.baseSeed ?? ctx.room.seed, 'smi-bench') % 2], side1 = lat.find(s => s !== side0), wp = [work.x, work.z];
  const bench = (() => { for (const id of C.bench) { const p = smiWallNear(ctx, id, [side0, side1], wp, { layer: 'anchor', rule: 'bench', why: 'the bench, against the side wall nearest the work' }); if (p) return p; } return null; })();
  if (bench) { C.on.slice(0, 2).forEach((id, i) => ccmOn(ctx, id, bench, i ? 0.28 : -0.28, 0, 'on the bench')); ccmQuiet(ctx, () => ctx.companion(bench, 'stool-three-leg', { why: 'the stool at the bench', maxDist: 4 })); }
  const bside = bench?.side || side0, tools = [];
  for (const id of C.tools.slice(0, Math.max(1, Math.min(C.tools.length, Math.round(cells / 9))))) { const p = smiWallNear(ctx, id, [bside, far, side1], bench ? [bench.x, bench.z] : wp, { layer: 'store', rule: 'tool-wall', height: 5.6, why: 'the tool wall: over and beside the bench' }); if (p) tools.push(p); }
  const dside = bside === side0 ? side1 : side0, done = [], nDone = Math.max(1, Math.min(C.done.length, Math.round(cells / 5)));
  for (const id of C.done.slice(0, nDone)) { const last = done.at(-1), p = smiWallNear(ctx, id, [dside, far, bside, ...(d ? [d.side] : [])], last ? [last.x, last.z] : ctx.sidePoint(dside, ctx.sideLen(dside) / 2, 0), { layer: 'furnish', rule: 'finished', why: 'finished work, down the side wall' }); if (p) done.push(p); }
  // (a big armoury: finished harness on stands in ranks before the door wall, all facing the door)
  if (C.ranks && cells >= 30 && station) { const s0 = (far === 'N' || far === 'S' ? Math.abs(station.z - at(0, 0)[1]) : Math.abs(station.x - at(0, 0)[0])) + station.dims[2] / 2 + 4;
    const rk = ccmRanks(ctx, { far, s0, s1: deep - 4.5, gap: 2.5, aisle: 5, turn: Math.PI, proto: C.ranks, choose: () => C.ranks, limit: Math.round(cells / 6), rule: 'finished', why: 'finished harness on stands, in ranks' }); done.push(...rk.placed); }
  // 6. raw stock by the door and in the corners of the door wall; loose kit as the room grows
  const dsides = d ? [d.side, ...ccmLat(d.side)] : ALL, raws = [];
  for (const id of C.raw.slice(0, Math.max(1, Math.min(C.raw.length, Math.round(cells / 6))))) {
    const p = C.lie && C.lie.test(id) ? ccmLieAlong(ctx, id, ctx.shuffle([...dsides]), { layer: 'store', rule: 'raw-stock', why: 'raw stock, stacked along the wall' }) : smiWallNear(ctx, id, dsides, d ? d.inner : null, { layer: 'store', rule: 'raw-stock', why: 'raw stock, by the door', windows: false });
    if (p) raws.push(p); }
  for (const id of ctx.pick(C.floor, Math.max(1, Math.min(C.floor.length, Math.round(cells / 7))))) smiWallNear(ctx, id, ctx.shuffle(ALL), null, { layer: 'store', rule: 'loose-kit', why: 'against the wall', windows: false });
  // 7. light: the fire is one; lanterns on the walls
  ccmWallLights(ctx, SMI_LAMPS, [...lat, ...(d ? [d.side] : [])], { every: 24, height: 6.3, why: 'a wall lantern', min: 1, max: 3 });
  ccmEnsureLight(ctx, SMI_LAMPS, ['torch-stand', 'candlestick-floor']);
  ctx.workInfo = { craft: C.name, heat: heat?.id || null, station: station?.id || null, bench: bench?.id || null, tools: tools.length, done: done.length, raw: raws.length, by: bys.map(p => p.id) };
  if (done.length > 1) ctx.growth.push(`finished goods repeat along the wall: ${done.length}`);
  ccmDone(ctx);
  return { feature, what: `${C.name}: ${heat ? `the ${C.label}, ` : ''}${station ? `the ${station.id.replace(/-/g, ' ')}` : 'no workstation'}, ${tools.length} on the tool wall, ${done.length} finished, ${raws.length} raw`, approach: null, passage: true };
}

// ---------------- THE SHOP FRONT is a TRADE of the market type's shop skeleton (mktShop: the counter facing the door, the
// keeper's lane, stocked shelves behind and down the sides, the display table and the trade's own pieces in the floor,
// floor stock by the counter and the door, the shop window in the street wall). The workshop's FINISHED-goods rack, its
// sword barrel and its sign are the skeleton's own roles (shop-shelf-stocked, shop-floor-stock, shop-sign) in tier `smi`:
// the making side and the selling side share them ----------------
mktRegisterTrade('smi-shopfront', { tier: 'smi', name: "smith's shop", hero: [['smith-breastplate-on-form', 'floor'], ['weapon-rack', 'wall'], ['armor-stand', 'wall'], ['weapon-rack', 'wall']],
  floor: ['mil-shield-stack', 'chest-ironbound', 'crate', 'barrel', 'armor-stand'], by: ['barrel'], sign: 'shop-sign' });
// mktRegisterTrade also adds the tier to MKT_TIERS, the list the market SQUARE deals its open trestles and ground displays from: every square
// would re-roll (test/golden.mjs: 12 squares differ) and one table in six would be the smith's. That is a decision about the market, not about
// the smithy, so the tier is taken out again: squares stay exactly as they were. To put the smith in the market: delete this line and add `smi`
// to the `tiers` of mkt-square, mkt-street and mkt-backroom in build_data.py (ROOMS.md, "Adding a trade").
{ const i = MKT_TIERS.indexOf('smi'); if (i >= 0) MKT_TIERS.splice(i, 1); }

// ---------------- THE STOCK STORE: every craft's raw material, like with like, round the walls; a clear middle ----------------
function smiStock(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), cells = ccmCells(ctx), ALL = ['N', 'S', 'E', 'W'];
  const centre = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2];
  if (d) ccmWalk(ctx, 'approach', [d.inner, centre]);
  for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, centre]);
  // the metal first, on the wall facing the door; then one kind after another, each beside the last
  const first = ccmFocalOn(ctx, far, ['shelving-freestanding', 'metal-stock', 'coal-bin'], { label: 'raw stock', rule: 'key-stock', slack: Math.max(0.5, L / 2 - 2.5), why: 'store shelving: on the wall facing the door (a store is told by its shelves and stacks; the bar iron stands beside it)' })
    || smiWallNear(ctx, ccmFirst(ctx, ['metal-stock', 'shelving-freestanding', 'coal-bin', 'crate']), ALL, null, { layer: 'anchor', rule: 'key-stock', why: 'raw stock against the wall' });
  if (!first) return { fail: 'stock store has no stock on its walls' };
  ctx.focal = { label: 'raw stock', id: first.id, side: far, ok: true };
  if (d) { ctx.sight = [d.inner, [first.x, first.z]]; ctx.sightFeature = first.id; }
  // (blind reads: a coal bin read as a forge, bar-iron racks as benches, a desk as a workbench: the room was "a workshop". A store is shelves and stacks;
  //  ONE rack of bar iron and the sawn boards say whose store it is)
  const kinds = ['shelving-freestanding', 'metal-stock', 'shelving-freestanding', 'craft-boards-planed-stack', 'shelving-freestanding', 'woodpile', 'shelving-freestanding', 'craft-wood-offcut-bin', 'stone-blocks-stack'], put = [first];
  const wallFt = 2 * (ctx.W + ctx.D); let run = first.dims[0];
  for (let k = 0; k < kinds.length && run < wallFt * 0.5; k++) { const id = kinds[k], last = put.at(-1);
    const p = smiWallNear(ctx, id, [far, ...lat, ...(d ? [d.side] : [])], [last.x, last.z], { layer: 'store', rule: 'stock', why: 'raw stock round the walls, like with like', windows: false });
    if (p) { put.push(p); run += Math.max(p.dims[0], p.dims[2]); } }
  for (const id of ctx.shuffle(['crate', 'barrel', 'sack']).slice(0, cells >= 12 ? 3 : 2)) ctx.cornerPile([id], Math.max(3, Math.min(6, Math.round(cells / 3.5))), { why: 'stock stacked in a corner, like with like' });
  for (const id of ctx.pick(['barrel', 'crate', 'sack', 'barrel', 'crate'], Math.max(2, Math.round(cells / 4)))) smiWallNear(ctx, id, ctx.shuffle(ALL), null, { layer: 'store', rule: 'stock', why: 'more stock against the wall', windows: false });
  ccmQuiet(ctx, () => ctx.mount('key-hook-board', { sides: d ? [d.side] : ALL, height: 5.2, why: 'keys by the door' }));
  ccmWallLights(ctx, SMI_LAMPS, ALL, { every: 30, height: 6.3, why: 'a wall lantern', min: 1, max: 2 });
  ccmEnsureLight(ctx, SMI_LAMPS, ['torch-stand', 'candlestick-floor']);
  ctx.workInfo = { craft: 'stock store', kinds: [...new Set(put.map(p => p.id))].length, pieces: put.length };
  ccmDone(ctx);
  return { feature: first, what: `stock store: ${put.length} lots of raw stock round the walls (${ctx.workInfo.kinds} kinds)`, approach: null, passage: true };
}

// ---------------- THE SMITH'S YARD (outdoor: no walls; the neighbours' doors open onto it). The shoeing stocks stand in
// the open with the farrier's anvil and box beside them; the hitching rail and the trough by the way in; fuel, timber,
// a furnace and the cart at the edges; the smithy's sign and a lantern on the building wall by each workshop door ----------------
function smiYard(ctx) {
  const ALL = ['N', 'S', 'E', 'W'], w = ctx.room.w, dz = ctx.room.d, A = ctx.area(), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const gate = ctx.openings.find(o => o.kind === 'gate') || null, open = gate ? gate.open : [];
  const built = ctx.openings.filter(o => o.to && /^(wall|window|door)$/.test(o.kind));
  for (const s of ALL) { const n = s === 'N' || s === 'S' ? w : dz; for (let i = 0; i < n; i++) if (!built.some(o => o.side === s && o.index === i)) ctx.mounts[s].push([i * CELL - INSET, (i + 1) * CELL - INSET]); } // nothing hangs in mid-air
  const gateT = gate ? gate.index * CELL - INSET + CELL / 2 : 0, gatePt = gate ? ctx.sidePoint(gate.side, gateT, 2.6) : null;
  const backSides = ALL.filter(s => built.some(o => o.side === s)), openSides = ALL.filter(s => open.some(o => o.side === s)), edgeSides = [...backSides, ...openSides].filter((s, i, a) => a.indexOf(s) === i);
  const target = ctx.densityTarget = Math.max(1.8, yardTarget(A) * 1.4), want = Math.max(8, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor').length, room = () => count() < Math.round(want * 1.3);
  if (gate) ctx.keepClear(gate.side, gateT, 5.5, 4.5);
  // the shoeing stocks: the one thing in the open (a small yard: the hitching rail), turned so a horse walks in from the gate
  const rot0 = gate ? SIDES[gate.side].rot : 0;
  let focal = null;
  for (const id of Math.min(ctx.W, ctx.D) >= 19 ? ['smith-shoeing-stocks', 'hitching-post', 'horse-trough-stone'] : ['hitching-post', 'horse-trough-stone', 'anvil']) { if (focal || !ccmHas(ctx, id)) continue;
    focal = ccmQuiet(ctx, () => ctx.put(id, function* () { for (let r = 0; r <= 6; r += 1) for (const [ux, uz] of r ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] : [[0, 0]]) yield { x: cx + ux * r, z: cz + uz * r, rot: rot0, r }; }, (c) => c.r, { layer: 'anchor', rule: 'yard-focal', unique: true, why: id === 'smith-shoeing-stocks' ? 'the shoeing stocks: in the open, a horse is led straight in from the gate' : `the ${id.replace(/-/g, ' ')}: the one thing in the open`, extra: { focal: true } })); }
  if (focal) { ctx.focal = { label: 'shoeing stand', id: focal.id, ok: true, centre: true }; ccmClearRound(ctx, focal, 1.5); }
  // the ways: every door to the gate (a closed yard: door to door)
  if (gatePt) for (const o of ctx.doors) ccmWalk(ctx, 'path', [o.inner, gatePt], { width: 4 });
  else for (let i = 1; i < ctx.doors.length; i++) ccmWalk(ctx, 'path', [ctx.doors[0].inner, ctx.doors[i].inner], { width: 4 });
  // the farrier's kit, within reach of the stocks
  const kit = [];
  if (focal) { const [fx, fz] = ctx.facingVec(focal.rot), lx = fz, lz = -fx;
    [['anvil', 1, 1], ['farrier-stand', -1, 1], ['smith-farrier-box', -1, -0.4], ['bucket', 1, -0.6]].forEach(([id, sg, fw]) => { if (!room()) return; const off = focal.dims[0] / 2 + 2.6;
      const p = smiNear(ctx, id, [focal.x + lx * sg * off + fx * fw * 2, focal.z + lz * sg * off + fz * fw * 2], focal.rot, { rule: 'farrier', reach: 3, why: "the farrier's kit, within reach of the horse" }); if (p) kit.push(p); }); }
  const AT = 0.5, atEdge = (id, sides, near, why, layer = 'furnish', rule = 'at-edge') => ccmHas(ctx, id) && sides.length ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap: AT, windows: false }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 30, { layer, rule, why })) : null;
  // by the way in: the hitching rail and the trough (water)
  const inPt = gatePt || (ctx.mainDoor ? ctx.mainDoor.inner : [cx, cz]), inSides = gate ? [gate.side, ...ccmLat(gate.side)] : edgeSides;
  const tied = [];
  for (const id of ['hitching-post', 'horse-trough-stone', 'hitching-post']) { if (focal?.id === id && id !== 'hitching-post') continue; const p = atEdge(id, inSides.length ? inSides : ALL, inPt, id === 'hitching-post' ? 'the hitching rail, by the way in' : 'the horse trough, by the hitching rail', 'furnish', 'by-gate'); if (p) tied.push(p); if (A < 500 && tied.length >= 2) break; }
  // beside each door: the smithy's sign and a lantern on the building wall; the craft's own things outside its door
  const BY = { 'smi-forge': ['smith-coal-heap', 'grindstone'], 'smi-armoury': ['grindstone', 'barrel'], 'smi-carpenter': ['craft-boards-planed-stack', 'sawhorse'], 'smi-potter': ['pottery-for-sale', 'woodpile'], 'smi-stock': ['crate', 'barrel'], 'smi-shopfront': ['craft-display-table-goods', 'bench-village'], stable: ['water-trough'], common: ['bench-village'] };
  const doorInfo = [];
  for (const o of ctx.openings.filter(o => o.kind === 'door' && !o.part && o.to)) {
    const type = ctx.typesOf?.(o.to) || '', t = o.index * CELL - INSET + (o.span || 1) * CELL / 2, here = ctx.sidePoint(o.side, t, 1), things = [];
    if (/^smi-(forge|armoury|shopfront)$/.test(type) && ccmQuiet(ctx, () => ctx.mount('shop-sign', { sides: [o.side], height: 7.2, rule: 'yard-sign', why: "the smithy's sign, on its wall" }))) things.push('sign');
    for (const id of (BY[type] || []).slice(0, 2)) if (room()) { const p = ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [o.side], { gap: 0.25, windows: false }), (c) => Math.abs(Math.hypot(c.x - here[0], c.z - here[1]) - 4.5), { layer: 'store', rule: 'by-door', why: `outside the ${type.replace(/^smi-/, '')} door` })) : null; if (p && Math.hypot(p.x - here[0], p.z - here[1]) < 13) things.push(p.id); }
    if (ccmQuiet(ctx, () => ctx.mount(ccmFirst(ctx, ['lantern-wall-iron', 'torch-sconce']), { sides: [o.side], height: 6.4, layer: 'light', rule: 'yard-light', why: 'a lantern by the door' }))) things.push('lantern');
    doorInfo.push({ to: o.to, type, side: o.side, things });
  }
  // the yard's own work, at the edges: fuel, the furnace, timber, the cart, a spare wheel
  const fire = A >= 500 ? atEdge(ccmFirst(ctx, ['smelter', 'kiln-pottery']), edgeSides.length ? ctx.shuffle([...edgeSides]) : ALL, null, 'the furnace, out in the yard where its smoke can go', 'anchor', 'yard-work') : null;
  if (fire) atEdge('smith-coal-heap', edgeSides.length ? edgeSides : ALL, [fire.x, fire.z], 'fuel by the furnace', 'store', 'yard-work');
  for (const id of ['smith-coal-heap', ccmAny(ctx, A >= 900 ? ['wagon', 'cart-hand'] : ['cart-hand']), 'craft-boards-planed-stack', 'wheel-spare', 'woodpile', 'rain-barrel', 'coal-bin', 'barrel', 'stone-blocks-stack', 'bench-village', 'crate', 'log-seat', 'grindstone', 'sawhorse']) { if (!id || count() >= want) break; atEdge(id, edgeSides.length ? ctx.shuffle([...edgeSides]) : ctx.shuffle(ALL), null, 'at the edge of the yard', /barrel|crate|heap|pile|stack|bin/.test(id) ? 'store' : 'furnish'); }
  if (!ccmLit(ctx)) for (const id of ['lantern-post', 'lamp-post-wood', 'torch-stand']) if (!ccmLit(ctx)) atEdge(id, ctx.shuffle(ALL), null, 'a light in the yard', 'light');
  ctx.yardInfo = { vibe: "smith's yard", edge: 'none', edgePieces: 0, wallFt: built.length * CELL, gate: gate ? gate.side : null, focal: focal ? { id: focal.id, kind: focal.id.replace(/-/g, ' ') } : null, signs: doorInfo.filter(x => x.things.includes('sign')).length, wear: 0, doors: doorInfo, farrier: kit.length, tied: tied.length, furnace: fire?.id || null, plants: { placed: 0, slot: [], waiting: [] } };
  ccmDone(ctx);
  return { feature: focal || tied[0] || null, what: `smith's yard: ${focal ? `the ${focal.id.replace(/-/g, ' ')} in the open, ` : ''}${tied.length} at the way in (rail, trough)${fire ? `, the ${fire.id.replace(/-/g, ' ')} at the edge` : ''}`, outdoor: true };
}

// the quarters above the shop ARE the inn's guest room, the passage the inn's hallway, in half-timber walls
PROGRAM_OF['smi-quarters'] = 'guest';
PROGRAM_OF['smi-passage'] = 'hallway';
Object.assign(KEY, { ...Object.fromEntries(Object.keys(SMI_CRAFTS).map(k => [k, smiWorkshop])), 'smi-stock': smiStock, 'smi-yard': smiYard });
// the leg of an L-shaped room: more of the same walls, never a second forge or counter
const smiAnnex = (ctx, wall, hung = []) => { for (const id of wall) smiWallNear(ctx, id, ctx.shuffle(['N', 'S', 'E', 'W']), null, { layer: 'store', why: 'against the wall' }); for (const id of hung) ccmQuiet(ctx, () => ctx.mount(id, { height: 5.6, why: 'on the wall' })); ccmWallLights(ctx, SMI_LAMPS, ['N', 'S', 'E', 'W'], { every: 24, height: 6.3, min: 1, max: 3 }); };
Object.assign(MENUS, {
  ...Object.fromEntries(Object.entries(SMI_CRAFTS).map(([k, C]) => [k, ccmAnnex((ctx) => smiAnnex(ctx, [...C.done.slice(0, 2), ...C.raw.slice(0, 2), ...C.floor.slice(0, 2)], C.tools.slice(0, 1)))])),
  'smi-stock': ccmAnnex((ctx) => smiAnnex(ctx, ['metal-stock', 'shelving-freestanding', 'crate', 'barrel', 'coal-bin'])),
});
// (no DENSITY line for the yard: it sets its own target, as yard() does)
Object.assign(DENSITY, { ...Object.fromEntries(Object.keys(SMI_CRAFTS).map(k => [k, 4])), 'smi-stock': 5, 'smi-quarters': DENSITY.guest ?? 8, 'smi-passage': DENSITY.hallway ?? 3.5 });
Object.assign(FOCAL, { 'smi-forge': 'forge (on the wall facing the door, the anvil one step before it)', 'smi-armoury': 'armour on its form (middle of the floor)', 'smi-carpenter': "carpenter's bench (middle of the floor)", 'smi-potter': 'kiln (on the wall facing the door, the wheel before it)',
  'smi-stock': 'store shelving on the wall facing the door, bar iron beside it', 'smi-yard': 'shoeing stocks in the open' });
Object.assign(KEY_RE, { 'smi-forge': /^forge$/, 'smi-armoury': /^(smith-breastplate-on-form|armor-stand)$/, 'smi-carpenter': /^carpenter-bench$/, 'smi-potter': /^kiln-pottery$/, 
  'smi-stock': /^(metal-stock|shelving-freestanding|coal-bin|crate)$/, 'smi-yard': null, 'smi-quarters': KEY_RE.guest, 'smi-passage': KEY_RE.hallway });
