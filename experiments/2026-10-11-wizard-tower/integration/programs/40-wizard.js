// ======================= wizard's tower (2026-10-11) =======================
// Eleven rooms, appended below the castle / crypt / mansion block and built on its helpers (ccm*, mansionAt, mansionWall,
// mansionHang, front): each program lays the whole room and ends with ccmDone(ctx). Tower rooms are SMALL (a floor of a
// tower is 15 to 25 ft across), so every program is written from 2x2 cells up and never fails for want of space: the
// focal piece falls back from its best place to any wall that takes it.
// What reads from the table camera (the crypt's lesson) is colour and silhouette: the laboratory is glass colours on
// benches and a brick furnace; the study is untidy books; the summoning chamber is a circle on the floor ringed by
// candles; the observatory is a brass tube aimed up; the scrying room is a basin and a white ball; the menagerie is cages.
// ARCANE ICONOGRAPHY IS ON SEPARATE PROPS ONLY (decal-ritual-circle, decal-star-floor, map-wall): a "flavors" system can
// swap those without touching walls or furniture.
const WIZ_SCONCE = ['sconce-candle-single', 'sconce-candle-double', 'lantern-wall-iron'], WIZ_TORCH = ['torch-sconce', 'lantern-wall-iron'];
const WIZ_CANDLE = ['candle-tree', 'candlestand-pricket', 'candlestick-floor'];
const wizDoorSides = (ctx) => { const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far); return { d, far, lat, other: [...lat, ...(d ? [d.side] : [])], all: [far, ...lat, ...(d ? [d.side] : [])] }; };
// the focal piece: its best place first (centre of the floor when asked and the room is big enough, else centred on the
// wall facing the door), then a side wall, then the door wall, then anywhere it fits
function wizFocal(ctx, ids, { label, rule = 'key-focal', gap = 0.05, centre = false, why = '' } = {}) {
  const { d, far, lat } = wizDoorSides(ctx);
  let f = centre ? ccmCentre(ctx, ids, { label, rule, rot: SIDES[far].rot, why: why || `${label}: in the middle of the floor` }) : null;
  if (!f) f = ccmFocalOn(ctx, far, ids, { label, rule, gap, why: why || `${label}: centred on the wall facing the door (axial focal)` });
  for (const strict of [true, false]) for (const s of lat) if (!f) f = ccmFocalOn(ctx, s, ids, { label, rule, gap, strict, slack: Math.max(0.5, ctx.sideLen(s) / 2 - 2), why: `${label}: against a side wall (the wall facing the door cannot take it)` });
  if (!f && d) f = ccmFocalOn(ctx, d.side, ids, { label, rule, gap, slack: Math.max(0.5, ctx.sideLen(d.side) / 2 - 2), why: `${label}: on the door wall (nowhere else takes it)` });
  if (!f && !centre) f = ccmCentre(ctx, ids, { label, rule, rot: SIDES[far].rot, why: `${label}: in the middle of the floor` });
  for (const id of ids) if (!f && ccmHas(ctx, id)) { f = ccmQuiet(ctx, () => ctx.wall(id, { layer: 'anchor', rule, why: `${label}: wherever a wall takes it`, unique: true })); if (f) ctx.focal = { label, id: f.id, ok: true }; }
  if (f && d) { ctx.sight = [d.inner, [f.x, f.z]]; ctx.sightFeature = f.id; }
  return f;
}
// the way in: the door to a standing place before the focal piece; other doors join it. A line that cannot be found in
// a room this small is dropped (the room is one step across; attempt() still checks the doors themselves).
function wizWalk(ctx, to) {
  const d = ctx.mainDoor; if (!d) return;
  const drop = (p) => { if (p && !p.ok) ctx.paths.splice(ctx.paths.indexOf(p), 1); };
  drop(ccmWalk(ctx, 'approach', [d.inner, to]));
  for (const o of ctx.doors) if (o !== d) drop(ccmWalk(ctx, 'branch', [o.inner, to]));
}
// n of the given things against walls, each wherever it fits best (shelves, cabinets); returns the placements
function wizWalls(ctx, ids, sides, n, o = {}) {
  const out = [];
  for (let k = 0; k < n; k++) { const id = o.inOrder ? ids.filter(i => ccmHas(ctx, i))[k % Math.max(1, ids.filter(i => ccmHas(ctx, i)).length)] : ccmAny(ctx, ids); if (!id) break;
    const p = mansionWall(ctx, id, sides, { sideCost: o.sideCost ?? 1.5, at: o.at ?? ctx.r(0.15, 0.85), layer: o.layer || 'store', rule: o.rule || 'against-wall', why: o.why || 'against the wall' }); if (p) out.push(p); }
  return out;
}
// things set down on the floor near a point (crates by the shelves, book piles by the desk)
function wizFloor(ctx, ids, n, near, o = {}) {
  let k = 0;
  for (let i = 0; i < n; i++) { const id = ccmAny(ctx, ids); if (id && ccmQuiet(ctx, () => ctx.free(id, { near, radius: o.radius ?? 6, margin: o.margin ?? 0.5, layer: o.layer || 'dress', why: o.why || 'set down on the floor' }))) k++; }
  return k;
}
function wizOnto(ctx, surf, ids, n, why) { if (surf) for (const id of ctx.pick(ids.filter(i => ccmHas(ctx, i)), n)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === surf.uid, layer: /candle/.test(id) ? 'light' : 'dress', why })); }
// light: wall candles on the walls that have room, a lantern overhead in a room big enough, a floor candle stand otherwise
function wizLights(ctx, { wall = WIZ_SCONCE, every = 13, at = null, overhead = true, floor = WIZ_CANDLE, min = 1 } = {}) {
  const hung = ccmWallLights(ctx, wall, ctx.shuffle(['N', 'S', 'E', 'W']), { every: every * 2, height: 5.8, why: 'a wall light', min, max: 4 });
  if (overhead && ccmCells(ctx) >= 9 && ccmHas(ctx, 'lantern-hanging')) ccmQuiet(ctx, () => ctx.ceiling('lantern-hanging', { at: at || [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], why: 'a lantern hanging overhead' }));
  if (!hung || ccmCells(ctx) >= 16) { const id = ccmAny(ctx, floor); if (id) ccmQuiet(ctx, () => ctx.wall(id, { prefer: 'corner', layer: 'light', why: 'a candle stand in the corner', gap: 0.3 })); }
  ccmEnsureLight(ctx, wall, floor);
}

// ALCHEMY LABORATORY (uses the store): the brick furnace on the wall facing the door; the dressed benches along the
// side walls (their glass is the room's colour); the still and the green cauldron as the room grows; reagent shelves
function wizLab(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx);
  const focal = wizFocal(ctx, ['alch-athanor', 'alch-bench-dressed', 'alch-still-copper-large', 'cauldron', 'table-kitchen-prep'], { label: 'furnace', rule: 'key-furnace' });
  if (!focal) return { fail: `laboratory has no furnace, bench or still (${ctx.focal?.why || 'no mesh'})` };
  wizWalk(ctx, front(focal, 2.2));
  const benches = focal.id === 'alch-bench-dressed' ? [focal] : [];
  for (let k = 0, n = Math.max(1, Math.min(4, Math.round(cells / 8))); k < n; k++) { const b = mansionWall(ctx, 'alch-bench-dressed', [lat[k % 2], far, ...(d ? [d.side] : [])], { sideCost: 3, at: k < 2 ? 0.35 : 0.75, layer: 'anchor', rule: 'bench', why: 'a work bench of apparatus along the wall' }); if (b) benches.push(b); }
  for (const b of benches.slice(0, 2)) mansionAt(ctx, 'stool-three-leg', [...front(b, 0.9), b.rot + Math.PI], { rule: 'desk-chair', why: 'a stool at the bench', allowKeep: true });
  if (cells >= 12) mansionWall(ctx, 'alch-still-copper-large', [far, ...lat], { sideCost: 1, at: 0.15, layer: 'anchor', rule: 'still', why: 'the copper still, beside the furnace' });
  // the cauldron of green brew: out on the floor in a room with space, else by the wall
  if (cells >= 16) ccmQuiet(ctx, () => ctx.free(ccmFirst(ctx, ['alch-cauldron-bubbling-green', 'cauldron']), { near: front(focal, 5), radius: 4, margin: 1.2, layer: 'anchor', rule: 'cauldron', why: 'the cauldron of green brew, out on the floor' }));
  else if (cells >= 9) mansionWall(ctx, ccmFirst(ctx, ['alch-cauldron-bubbling-green', 'cauldron-small']), other, { layer: 'anchor', rule: 'cauldron', why: 'the cauldron of green brew' });
  const shelves = wizWalls(ctx, ['alch-reagent-shelf-tall', 'alch-reagent-shelf-tall', 'apothecary-drawers'], other.concat(far), Math.max(1, Math.min(4, Math.round(cells / 9))), { why: 'reagent shelves against the wall' });
  if (cells >= 20) mansionWall(ctx, 'alch-homunculus-vat', [far, ...lat], { sideCost: 1, at: 0.85, layer: 'anchor', rule: 'vat', why: 'the growing vat, deep in the room' });
  // the mixing table in the middle of a big laboratory, apparatus on it
  if (cells >= 24) { const t = ccmQuiet(ctx, () => ctx.free('table-kitchen-prep', { near: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], radius: 5, margin: 2, layer: 'furnish', rule: 'work-table', why: 'the mixing table in the middle of the room', rot: focal.rot }));
    wizOnto(ctx, t, ['alembic', 'potion-bottles', 'mortar-pestle', 'book-open', 'alch-mandrake-pot', 'skull-single', 'candlestick'], 5, 'on the mixing table'); }
  wizFloor(ctx, ['alch-specimen-jar-large', 'alch-carboy-wicker', 'alch-carboy-wicker', 'barrel', 'alch-potion-crate-straw'], Math.max(1, Math.min(5, Math.round(cells / 6))), shelves[0] ? [shelves[0].x, shelves[0].z] : [focal.x, focal.z], { why: 'jars and carboys on the floor by the shelves', layer: 'store' });
  if (ccmHas(ctx, 'alch-formula-chalkboard') && cells >= 16) mansionWall(ctx, 'alch-formula-chalkboard', other, { why: 'the slate of working', layer: 'dress' });
  wizLights(ctx, { at: front(focal, 4) });
  ctx.wizInfo = { benches: benches.length, shelves: shelves.length };
  ccmDone(ctx);
  return { feature: focal, what: `furnace, ${benches.length} benches of apparatus`, approach: null, passage: true };
}

// LIBRARY & STUDY (terminal): the desk before a wall of crammed bookcases, the great book on its lectern beside it; the
// armillary, scroll rack and staves round the walls; books in heaps on the floor
function wizStudy(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), toDoor = SIDES[far].rot, deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const focal = wizFocal(ctx, ['bookshelf', 'scroll-rack', 'desk-writing'], { label: 'bookcase', rule: 'key-bookcase' });
  if (!focal) return { fail: `study has no bookcase or desk (${ctx.focal?.why || 'no mesh'})` };
  const deskId = ccmFirst(ctx, ['desk-writing', 'desk-partners']);
  const dk = deskId && deep >= 12 && focal.id !== 'desk-writing' ? mansionAt(ctx, deskId, [3.2, 3.8, 2.8, 4.4].map(a => [...front(focal, a + ccmSize(ctx, deskId)[1] / 2), toDoor]), { layer: 'anchor', rule: 'desk', why: 'the desk before the bookcase, the door in view' }) : null;
  if (dk) { const k = mansionAt(ctx, 'chair-armed', [1.2, 1.4, 1.0].map(a => [dk.x - Math.sin(dk.rot) * (dk.dims[2] / 2 + a), dk.z - Math.cos(dk.rot) * (dk.dims[2] / 2 + a), dk.rot]), { rule: 'keeper', why: 'the desk chair: back to the books', allowKeep: true }); if (k) ctx.command('desk chair', k);
    wizOnto(ctx, dk, ['tome-grimoire', 'book-open', 'inkwell-quill', 'scroll-pile', 'crystal-ball', 'alch-hourglass-sand-colored', 'candlestick', 'skull-single'], 4, 'on the desk'); }
  wizWalk(ctx, front(dk || focal, 2));
  // bookcases butted along the walls until about half the wall is books
  const wallFt = 2 * (ctx.W + ctx.D), cases = focal.id === 'bookshelf' ? [focal] : []; let booked = cases.length ? focal.dims[0] : 0;
  for (let k = 0; k < 30 && booked < wallFt * 0.42; k++) {
    const b = ccmQuiet(ctx, () => ctx.put('bookshelf', (dm) => ctx.wallGen(dm, [far, ...lat], { step: 0.25 }), (c) => (c.side === far ? 0 : 3) + Math.min(9, ...cases.concat(focal).map(q => Math.hypot(q.x - c.x, q.z - c.z))), { layer: 'store', rule: 'bookcase', why: 'bookcases butted side by side along the wall' }));
    if (!b) break; cases.push(b); booked += b.dims[0];
  }
  // the great book on its lectern, out from the wall where the light falls on it
  const lec = dk ? ccmQuiet(ctx, () => ctx.companion(dk, 'spellbook-lectern', { why: 'the great book on its lectern, beside the desk', maxDist: 6 })) : mansionWall(ctx, 'spellbook-lectern', other, { layer: 'anchor', why: 'the great book on its lectern' });
  mansionWall(ctx, 'scroll-rack', other, { sideCost: 1, at: 0.3, why: 'the scroll rack' });
  if (cells >= 12) ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['armillary-great', 'trade-globe-terrestrial']), { sides: other, prefer: 'corner', why: 'the armillary sphere in the corner', gap: 0.4 }));
  if (cells >= 12) mansionWall(ctx, 'staff-rack', other, { sideCost: 1, at: 0.8, why: 'the rack of staves by the door' });
  if (cells >= 16) mansionWall(ctx, ccmFirst(ctx, ['cabinet-curios', 'alch-formula-chalkboard']), other, { sideCost: 1, at: 0.55, why: 'the cabinet of curiosities' });
  if (cells >= 20) { mansionWall(ctx, 'alch-formula-chalkboard', other, { why: 'the slate of working', layer: 'dress' }); ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['orb-socket-pedestal', 'statue-bust']), { sides: other, prefer: 'corner', why: 'in the corner', gap: 0.4 })); }
  if (cells >= 25) ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, ['table-library', 'table-games']) || 'table-library', ['chair-armed'], 2, { why: 'the reading table' }));
  wizFloor(ctx, ['book-pile-floor'], Math.max(1, Math.min(4, Math.round(cells / 6))), [dk?.x ?? focal.x, dk?.z ?? focal.z], { why: 'books piled on the floor', radius: 7 });
  if (dk) ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, ['rug-round', 'rug-small']), { at: front(dk, 2.4), why: 'a rug before the desk' }));
  if (ccmHas(ctx, 'map-wall')) ccmQuiet(ctx, () => ctx.mount('map-wall', { sides: other, height: 4.2, why: 'a chart pinned to the wall' }));
  wizLights(ctx, { at: dk ? [dk.x, dk.z] : front(focal, 4) });
  ctx.wizInfo = { cases: cases.length, desk: !!dk, lectern: !!lec };
  ccmDone(ctx);
  return { feature: focal, what: `${cases.length} crammed bookcases${dk ? ', the desk before them' : ''}`, approach: null, passage: true };
}

// SUMMONING CHAMBER (terminal, no windows): the circle in the exact middle of the floor, nothing standing in it, tall
// candles round its rim; a crystal pylon toward each corner; the book on its lectern on the wall facing the door,
// a brazier each side of it
function wizSummoning(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, least = Math.min(ctx.W, ctx.D);
  // the circle: as big as the room allows a walk round it (the catalog's 9 ft, from 0.55x in a 9-ft room to 1.5x in a hall)
  const want = Math.max(5, Math.min(14, least - 6)), k = want / (ccmSize(ctx, 'decal-ritual-circle')[0] || 9.17);
  let circle = ccmHas(ctx, 'decal-ritual-circle') ? ccmScaled(ctx, 'decal-ritual-circle', k, () => ccmQuiet(ctx, () => ctx.rug('decal-ritual-circle', { at: [cx, cz], rot: SIDES[far].rot, layer: 'anchor', rule: 'key-circle', why: 'the circle: in the exact middle of the floor' }))) : null;
  const R = circle ? circle.dims[0] / 2 : Math.max(2, Math.min(4.5, least / 2 - 3.2));
  // candles on the rim (five in a small room, seven from 16 cells), then the inside of the circle is kept clear
  const cand = ccmFirst(ctx, ['rite-pillar-candle-tall', 'candlestick-floor', 'candlestand-pricket']), n = cells >= 16 ? 7 : 5, a0 = SIDES[far].rot, ring = [];
  if (cand) for (let i = 0; i < n; i++) { const a = a0 + i * 2 * Math.PI / n; if (ctx.doors.some(o => Math.hypot(cx + Math.sin(a) * R - o.inner[0], cz + Math.cos(a) * R - o.inner[1]) < 2.6)) continue; /* never in a doorway */ const p = ccmQuiet(ctx, () => ccmAt(ctx, cand, [1, 0.94, 1.06].map(f => [cx + Math.sin(a) * (R - 0.15) * f, cz + Math.cos(a) * (R - 0.15) * f, a + Math.PI]), { layer: 'light', rule: 'circle-candle', why: 'a tall candle on the rim of the circle', allowKeep: true })); if (p) ring.push(p); }
  ctx.mark(cx, cz, 2 * R * 0.72, 2 * R * 0.72, KEEP);
  // the book on its lectern facing the circle, a brazier each side of it
  const lec = wizFocal(ctx, ['spellbook-lectern', 'lectern', 'elemental-brazier', 'brazier-tripod', 'pedestal-display'], { label: 'lectern', rule: 'key-lectern', gap: 0.5 });
  const focal = circle || lec || ring[0];
  if (!focal) return { fail: 'summoning chamber has no circle, lectern or brazier' };
  ctx.focal = { label: circle ? 'the circle' : 'lectern', id: focal.id, ok: true, centre: !!circle };
  if (d) { ctx.sight = [d.inner, [cx, cz]]; ctx.sightFeature = focal.id; }
  if (lec && /lectern/.test(lec.id)) ccmFlank(ctx, lec, ['elemental-brazier', 'brazier-tripod', 'brazier-standing'], { off: least >= 16 ? 2.2 : 0.8, why: 'a brazier each side of the lectern' });
  if (d) { const [nx, nz] = SIDES[d.side].n, edge = [cx - nx * (R + 1.2), cz - nz * (R + 1.2)]; wizWalk(ctx, Math.hypot(edge[0] - d.inner[0], edge[1] - d.inner[1]) < Math.hypot(cx + nx * (R + 1.2) - d.inner[0], cz + nz * (R + 1.2) - d.inner[1]) ? edge : [cx + nx * (R + 1.2), cz + nz * (R + 1.2)]); }
  // a crystal pylon toward each corner (two in a small room: the far corners)
  const corners = [[far, lat[0]], [far, lat[1]], ...(d && cells >= 12 ? [[d.side, lat[0]], [d.side, lat[1]]] : [])]; let py = 0;
  if (cells >= 9) for (const c of corners) if (ccmCorner(ctx, 'arcane-pylon', c, { why: 'a crystal pylon toward the corner', inset: 0.5, layer: 'anchor' })) py++;
  if (cells >= 16) { ccmQuiet(ctx, () => ctx.wall('chest-ironbound', { sides: other, why: 'the locked chest of what the rite needs' })); wizFloor(ctx, ['candle-drippings-mound', 'crystal-glowing', 'skull-pile'], Math.round(cells / 12), [cx, cz], { radius: R + 3, margin: 0.4, why: 'left at the edge of the circle', layer: 'dress' }); }
  if (cells >= 20) mansionWall(ctx, ccmFirst(ctx, ['pedestal-display', 'scroll-rack']), other, { why: 'against the wall' });
  ccmWallLights(ctx, WIZ_TORCH, d ? [d.side, ...lat] : lat, { every: 16, why: 'a torch on the wall', min: ring.length ? 0 : 1, max: 3 });
  ccmEnsureLight(ctx, WIZ_TORCH, WIZ_CANDLE);
  ctx.wizInfo = { circle: !!circle, candles: ring.length, pylons: py, radius: +R.toFixed(2) };
  ccmDone(ctx);
  return { feature: focal, what: `${circle ? 'the circle' : 'a ring'} with ${ring.length} candles, ${py} pylons`, approach: null, passage: true };
}

// OBSERVATORY (terminal; the top of the tower): the great telescope in the middle of the floor on the inlaid star chart,
// the armillary and the orrery toward the corners, a chart table by the wall
function wizObservatory(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, least = Math.min(ctx.W, ctx.D);
  const star = ccmHas(ctx, 'decal-star-floor') && least >= 12 ? ccmScaled(ctx, 'decal-star-floor', Math.max(6, Math.min(13, least - 5)) / (ccmSize(ctx, 'decal-star-floor')[0] || 9.17), () => ccmQuiet(ctx, () => ctx.rug('decal-star-floor', { at: [cx, cz], rot: SIDES[far].rot, why: 'the star chart inlaid in the middle of the floor' }))) : null;
  const focal = wizFocal(ctx, least >= 13 ? ['telescope-great', 'armillary-great', 'telescope'] : ['telescope', 'armillary-great', 'telescope-great', 'trade-globe-terrestrial'], { label: 'telescope', rule: 'key-telescope', centre: least >= 13, why: least >= 13 ? 'the great telescope: in the middle of the floor, on the star chart' : '' });
  if (!focal) return { fail: `observatory has no telescope or armillary (${ctx.focal?.why || 'no mesh'})` };
  if (focal.id === 'telescope-great') ccmClearRound(ctx, focal, 1.2);
  wizWalk(ctx, front(focal, 2.4));
  const corner = (id, c, why) => ccmHas(ctx, id) && ccmCorner(ctx, id, c, { why, inset: 0.6, layer: 'anchor' });
  if (focal.id !== 'armillary-great' && cells >= 9) corner('armillary-great', [far, lat[0]], 'the armillary sphere toward the corner');
  if (cells >= 12) corner('orrery', [far, lat[1]], 'the orrery toward the corner');
  const tb = cells >= 12 ? mansionWall(ctx, ccmFirst(ctx, ['table-library', 'desk-writing', 'table-kitchen-prep']), other, { sideCost: 1, layer: 'furnish', rule: 'chart-table', why: 'the chart table by the wall' }) : null;
  if (tb) { wizOnto(ctx, tb, ['map-rolled', 'book-open', 'scroll-pile', 'alch-hourglass-sand-colored', 'inkwell-quill', 'candlestick'], 4, 'charts on the table'); mansionAt(ctx, 'chair-armed', [...front(tb, 1.1), tb.rot + Math.PI], { rule: 'desk-chair', why: 'a chair at the chart table', allowKeep: true }); }
  if (focal.id !== 'telescope' && cells >= 16) ccmQuiet(ctx, () => ctx.wall('telescope', { sides: other, prefer: 'corner', why: 'the small telescope by the wall', gap: 0.4 }));
  if (cells >= 16) mansionWall(ctx, ccmFirst(ctx, ['scroll-rack', 'bookshelf']), other, { why: 'charts in their rack' });
  if (cells >= 20) { mansionWall(ctx, 'bookshelf', other, { why: 'a bookcase of tables and almanacs' }); ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['trade-globe-terrestrial', 'library-steps']), { sides: other, why: 'by the wall', gap: 0.3 })); }
  if (ccmHas(ctx, 'map-wall')) for (let i = 0, n = cells >= 16 ? 2 : 1; i < n; i++) ccmQuiet(ctx, () => ctx.mount('map-wall', { sides: [other[i % other.length]], height: 4.2, why: 'a star chart pinned to the wall' }));
  wizLights(ctx, { overhead: false, every: 16 });
  ctx.wizInfo = { star: !!star, focal: focal.id };
  ccmDone(ctx);
  return { feature: focal, what: `${focal.id === 'telescope-great' ? 'the great telescope' : focal.id}${star ? ' on the star chart' : ''}`, approach: null, passage: true };
}

// SCRYING ROOM (terminal, no windows): the basin in the middle of the floor, the great crystal ball on its pedestal on
// the wall facing the door, a standing mirror, cushions to sit on, candles in the corners
function wizScrying(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), least = Math.min(ctx.W, ctx.D);
  const pool = least >= 12 ? ccmCentre(ctx, ['scrying-pool'], { label: 'scrying basin', rule: 'key-pool', rot: SIDES[far].rot, why: 'the scrying basin: in the middle of the floor' }) : null;
  if (pool) ccmClearRound(ctx, pool, 1.4);
  const orb = wizFocal(ctx, pool ? ['orb-socket-pedestal', 'mirror-standing', 'pedestal-display'] : ['orb-socket-pedestal', 'scrying-pool', 'mirror-standing', 'table-round-small'], { label: 'crystal ball', rule: 'key-orb', gap: 0.4 });
  const focal = pool || orb;
  if (!focal) return { fail: `scrying room has no basin or crystal ball (${ctx.focal?.why || 'no mesh'})` };
  if (pool) { ctx.focal = { label: 'scrying basin', id: pool.id, ok: true, centre: true }; if (d) { ctx.sight = [d.inner, [pool.x, pool.z]]; ctx.sightFeature = pool.id; } }
  wizWalk(ctx, pool && d ? [pool.x + (d.inner[0] - pool.x) * 0.55, pool.z + (d.inner[1] - pool.z) * 0.55] : front(focal, 2));
  if (orb && orb.id === 'orb-socket-pedestal') ccmFlank(ctx, orb, ['candle-tree', 'candlestick-floor', 'rite-pillar-candle-tall'], { off: 0.9, why: 'a candle stand each side of the crystal ball' });
  // (blind reads, 2026-10-12: the cushion pile was "a cot", the mirror in the corner "a crossbow on the floor": the room was a guard's
  // cell. What reads is the basin with lights round it: a tall candle at each diagonal of the basin, one stool to sit and look)
  if (pool) { const cand = ccmFirst(ctx, ['rite-pillar-candle-tall', 'candlestick-floor']), R = (pool.dims[0] / 2 + 0.7) / 0.71; /* (clear of the basin's box on both axes) */
    if (cand) for (const [ax, az] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = pool.x + ax * R * 0.71, z = pool.z + az * R * 0.71; if (!ctx.doors.some(o => Math.hypot(x - o.inner[0], z - o.inner[1]) < 2.4)) ccmQuiet(ctx, () => ccmAt(ctx, cand, [x, z, pool.rot], { layer: 'light', rule: 'pool-candle', why: 'a tall candle at each diagonal of the basin', allowKeep: true })); }
    wizFloor(ctx, ['stool-three-leg'], 1, [pool.x, pool.z], { radius: pool.dims[0] / 2 + 3.2, margin: 0.3, why: 'a stool by the basin', layer: 'furnish' }); }
  if (cells >= 16) ccmQuiet(ctx, () => ctx.wall('mirror-standing', { sides: other, why: 'the standing mirror against the wall', gap: 0.2 }));
  if (cells >= 16) { const t = ccmQuiet(ctx, () => ctx.cluster('table-round-small', ['chair-armed'], 2, { why: 'the reading table, a ball between two chairs' })); wizOnto(ctx, t?.table || t, ['crystal-ball', 'candle', 'tome-grimoire'], 2, 'on the reading table'); }
  if (cells >= 12) ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['crystal-formation', 'crystal-glowing']), { sides: other, prefer: 'corner', why: 'crystals in the corner', gap: 0.3 }));
  if (cells >= 20) mansionWall(ctx, ccmFirst(ctx, ['cabinet-curios', 'bookshelf']), other, { why: 'against the wall' });
  ccmWallLights(ctx, WIZ_SCONCE, other, { every: 18, why: 'a candle on the wall', min: 0, max: 2 });
  ccmEnsureLight(ctx, WIZ_SCONCE, WIZ_CANDLE);
  ccmDone(ctx);
  return { feature: focal, what: pool ? `the scrying basin${orb ? ', the crystal ball beyond it' : ''}` : 'the crystal ball', approach: null, passage: true };
}

// POTION STORE (terminal, no windows): shelves of bottles on every wall that takes one, the drawer cabinet facing the
// door, crates and carboys on the floor in front of them
function wizStore(ctx) {
  const { d, far, lat, other, all } = wizDoorSides(ctx), cells = ccmCells(ctx);
  const focal = wizFocal(ctx, ['apothecary-drawers', 'alch-reagent-shelf-tall', 'cabinet-curios', 'shelving-freestanding'], { label: 'drawer cabinet', rule: 'key-drawers' });
  if (!focal) return { fail: `potion store has no shelves (${ctx.focal?.why || 'no mesh'})` };
  wizWalk(ctx, front(focal, 2));
  const wallFt = 2 * (ctx.W + ctx.D), shelves = [focal]; let run = focal.dims[0];
  for (let k = 0; k < 24 && run < wallFt * 0.5; k++) { const id = ccmFirst(ctx, ['alch-reagent-shelf-tall', 'shelving-freestanding']); if (!id) break; /* (blind reads: the curio cabinet and plain shelving read as bookcases, the store as a study) */
    const s = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, all, { step: 0.25 }), (c) => (d && c.side === d.side ? 5 : 0) + Math.min(...shelves.map(q => Math.hypot(q.x - c.x, q.z - c.z))), { layer: 'store', rule: 'shelf', why: 'shelves of bottles side by side along the wall' }));
    if (!s) break; shelves.push(s); run += s.dims[0]; }
  wizFloor(ctx, ['alch-potion-crate-straw', 'alch-potion-crate-straw', 'alch-carboy-wicker', 'alch-specimen-jar-large', 'barrel', 'barrel', 'crate', 'crate', 'sack', 'storage-jar'], Math.max(4, Math.min(14, Math.round(cells / 1.5))), [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], { radius: 9, margin: 0.4, why: 'stock on the floor by the shelves', layer: 'store' });
  if (cells >= 16) { const t = ccmQuiet(ctx, () => ctx.free('table-kitchen-prep', { near: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], radius: 4, margin: 2, why: 'the sorting table', rot: focal.rot })); wizOnto(ctx, t, ['potion-bottles', 'mortar-pestle', 'jar-lidded-stoneware', 'bottle-cluster', 'alch-mandrake-pot'], 4, 'on the sorting table'); }
  wizLights(ctx, { wall: ['lantern-wall-iron', 'sconce-candle-single'], floor: ['lantern-post-indoor', 'candlestick-floor'] });
  ctx.wizInfo = { shelves: shelves.length, wall: +(run / wallFt).toFixed(2) };
  ccmDone(ctx);
  return { feature: focal, what: `${shelves.length} shelves and cabinets of stock`, approach: null, passage: true };
}

// APOTHECARY SHOP (uses the store and the laboratory): the counter across the room before the wall of drawers, the
// keeper's side behind it; the customers' side by the door with a bench; the display window is a wall panel
function wizApothecary(ctx) {
  ccmPanels(ctx);
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), L = ctx.sideLen(far), toDoor = SIDES[far].rot, deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  // behind the counter first: the drawer cabinet centred on the far wall, shelves of bottles beside it
  const back = ccmFocalOn(ctx, far, ['apothecary-drawers', 'alch-reagent-shelf-tall', 'cabinet-curios'], { label: 'drawer cabinet', rule: 'back-wall', why: 'the wall of drawers behind the counter' });
  const cid = ccmFirst(ctx, ['alch-counter-apothecary', 'counter-shop']), [cw, cd] = cid ? ccmSize(ctx, cid) : [8, 2.3];
  let counter = null;
  if (cid && deep >= 12 && L >= cw + 2.4) { const s = (back ? back.dims[2] : 1) + 3.1 + cd / 2; counter = mansionAt(ctx, cid, [0, 0.4, -0.4, 0.8].flatMap(e => [L / 2, cw / 2 + 0.3, L - cw / 2 - 0.3].map(t => [...ctx.sidePoint(far, t, s + e), toDoor])), { layer: 'anchor', rule: 'key-counter', why: 'the counter across the shop, the keeper\'s side behind it', extra: { focal: true } }); }
  if (!counter) counter = wizFocal(ctx, [cid, 'counter-shop', 'table-kitchen-prep'].filter(Boolean), { label: 'counter', rule: 'key-counter' });
  const focal = counter || back;
  if (!focal) return { fail: `apothecary has no counter or drawers (${ctx.focal?.why || 'no mesh'})` };
  ctx.focal = { label: 'counter', id: focal.id, ok: true };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; }
  wizWalk(ctx, front(focal, 2.2));
  if (counter && back) { mansionAt(ctx, 'stool-bar', [counter.x - Math.sin(counter.rot) * (counter.dims[2] / 2 + 1.1), counter.z - Math.cos(counter.rot) * (counter.dims[2] / 2 + 1.1), counter.rot], { rule: 'keeper', why: 'the keeper\'s stool behind the counter', allowKeep: true });
    if (counter.id !== 'alch-counter-apothecary') wizOnto(ctx, counter, ['potion-bottles', 'mortar-pestle', 'scales-balance', 'ledger-counter-bell', 'bottle-cluster'], 4, 'on the counter'); }
  const shelves = wizWalls(ctx, ['alch-reagent-shelf-tall', 'alch-reagent-shelf-tall', 'cabinet-curios'], [far, ...lat], Math.max(1, Math.min(5, Math.round(cells / 5))), { sideCost: 2, why: 'shelves of remedies along the wall' });
  if (cells >= 12 && d) mansionWall(ctx, 'bench-long', [d.side, ...lat], { near: d.inner, sideCost: 1, layer: 'furnish', why: 'a bench for customers who wait' });
  wizFloor(ctx, ['alch-potion-crate-straw', 'alch-carboy-wicker', 'barrel'], Math.max(1, Math.min(3, Math.round(cells / 8))), back ? [back.x, back.z] : [focal.x, focal.z], { why: 'stock behind the counter', layer: 'store', radius: 6 });
  if (d && ccmHas(ctx, 'alch-sign-apothecary')) ccmQuiet(ctx, () => ctx.mount('alch-sign-apothecary', { sides: [d.side], height: 6.2, why: 'the mortar-and-pestle sign, by the door' }));
  if (cells >= 12) ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['fern-potted', 'planter-topiary']), { sides: d ? [d.side] : other, prefer: 'corner', layer: 'plants', why: 'a potted plant by the door', gap: 0.2 }));
  if (counter) ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, ['rug-small', 'rug-striped-woven']), { at: front(counter, 2.2), rot: counter.rot, why: 'a mat before the counter' }));
  wizLights(ctx, { at: [focal.x, focal.z] });
  ctx.wizInfo = { counter: counter?.id || null, shelves: shelves.length };
  ccmDone(ctx);
  return { feature: focal, what: `the counter${back ? ' before the wall of drawers' : ''}`, approach: null, passage: true };
}

// WIZARD'S BEDCHAMBER (terminal): the curtained bed on the wall facing the door, the robe and hat on their stand beside
// it (the one piece that says whose room it is), a trunk at the foot, the familiar's perch, books
function wizBedchamber(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx);
  const bed = wizFocal(ctx, ['bed-canopy', 'bed-double', 'bed-single'], { label: 'bed', rule: 'key-bed-focal', why: 'the curtained bed: head to the wall facing the door (axial focal)' });
  if (!bed) return { fail: `bedchamber has no bed (${ctx.focal?.why || 'no bed mesh'})` };
  const stands = ccmFlank(ctx, bed, ['table-side'], { off: 0.15, layer: 'furnish', rule: 'nightstand', why: 'a bedside table', n: cells >= 12 ? 2 : 1 });
  for (const t of stands) wizOnto(ctx, t, ['candlestick', 'book-stack', 'crystal-ball', 'candle'], 1, 'on the bedside table');
  ctx.command('bed', bed, { focal: true });
  wizWalk(ctx, front(bed, 2.6));
  { const [aw, ad] = ctx.aabb(bed.dims[0] + 2.4, bed.dims[2] + 2.2, bed.rot), [fx, fz] = ctx.facingVec(bed.rot); ctx.mark(bed.x + fx * 1.1, bed.z + fz * 1.1, aw, ad, KEEP); }
  // the robe and hat: against a wall, as near the bed as it goes
  const hat = mansionWall(ctx, 'hatstand-wizard', [far, ...lat, ...(d ? [d.side] : [])], { near: [bed.x, bed.z], sideCost: 0.5, layer: 'anchor', rule: 'hatstand', why: 'the robe and pointed hat on their stand, by the bed' });
  if (cells >= 9) mansionAt(ctx, ccmFirst(ctx, ['trunk-travel', 'chest-plain']), [0.25, 0.5].map(a => [...front(bed, a + 0.9), bed.rot + Math.PI]), { rule: 'companion', why: 'a travelling trunk at the foot of the bed', extra: { with: bed.uid }, allowKeep: true });
  if (cells >= 9) mansionWall(ctx, 'wardrobe', other, { at: 0.75, why: 'the wardrobe' });
  if (cells >= 12) mansionWall(ctx, 'bookshelf', other, { at: 0.3, why: 'a crammed bookcase', layer: 'store' });
  if (cells >= 12) ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['alch-familiar-perch', 'birdcage-standing']), { sides: other, prefer: 'corner', why: 'the familiar\'s perch', gap: 0.4 }));
  if (cells >= 16) { const b = mansionWall(ctx, ccmFirst(ctx, ['desk-bureau', 'desk-writing']), other, { sideCost: 1, at: 0.25, why: 'the writing bureau' }); if (b) mansionAt(ctx, 'chair-armed', [...front(b, 1.05), b.rot + Math.PI], { rule: 'desk-chair', why: 'a chair at the bureau' }); }
  if (cells >= 16) mansionWall(ctx, ccmFirst(ctx, ['fireplace-wall']), lat, { layer: 'light', rule: 'hearth', why: 'a small hearth on the side wall' });
  if (cells >= 20) { ccmQuiet(ctx, () => ctx.wall('mirror-standing', { sides: other, prefer: 'corner', why: 'the standing mirror', gap: 0.4 })); mansionWall(ctx, 'chair-upholstered', other, { why: 'a reading chair by the wall' }); }
  wizFloor(ctx, ['book-pile-floor', 'cat-bed-basket', 'pillows-cushions'], Math.max(1, Math.min(3, Math.round(cells / 8))), front(bed, 4), { why: 'left on the floor', radius: 6 });
  ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, ['rug-round', 'rug-sheepskin', 'rug-small']), { at: front(bed, 3.2), rot: bed.rot, why: 'a rug at the foot of the bed' }));
  wizLights(ctx, { overhead: cells >= 16, at: front(bed, 2) });
  ctx.wizInfo = { hat: !!hat };
  ccmDone(ctx);
  return { feature: bed, what: `the curtained bed${hat ? ', the robe and hat beside it' : ''}`, approach: null, passage: true };
}

// FAMILIARS' MENAGERIE (terminal): the perch tree in the middle of the floor; cages, the hutch and the planted tank round
// the walls; the great egg in its nest in a far corner; feed by the door; straw on the floor
function wizMenagerie(ctx) {
  const { d, far, lat, other, all } = wizDoorSides(ctx), cells = ccmCells(ctx), least = Math.min(ctx.W, ctx.D);
  const focal = wizFocal(ctx, least >= 13 ? ['cage-floor', 'birdcage-standing', 'egg-nest-great'] : ['birdcage-standing', 'animal-hutch', 'vivarium', 'egg-nest-great', 'cage-floor', 'alch-familiar-perch'], { label: least >= 13 ? 'the great cage' : 'cage', rule: 'key-perch', centre: least >= 13, why: least >= 13 ? 'the great iron cage: in the middle of the floor, on straw (blind reads: cages are what says animals; the nest was a fire pit, the perch tree a coat rack)' : '' });
  if (!focal) return { fail: `menagerie has no cage or nest (${ctx.focal?.why || 'no mesh'})` };
  const mid = focal.rule === 'key-perch' && !!ctx.focal?.centre;
  if (mid) { ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: [focal.x, focal.z], why: 'straw under the cage' })); ccmClearRound(ctx, focal, 1.3); }
  wizWalk(ctx, front(focal, 2.6));
  const cages = wizWalls(ctx, ['birdcage-standing', 'birdcage-standing', 'animal-hutch', 'birdcage-standing', 'birdcage-standing', 'vivarium'], [far, ...lat, ...(d ? [d.side] : [])], Math.max(2, Math.min(9, Math.round(cells / 2.6))), { inOrder: true, sideCost: 1, layer: 'anchor', rule: 'cage', why: 'cages and tanks round the walls' });
  const nest = cells >= 12 && ccmHas(ctx, 'egg-nest-great') ? ccmQuiet(ctx, () => ctx.wall('egg-nest-great', { sides: [far, ...lat], prefer: 'corner', layer: 'anchor', rule: 'nest', why: 'the great egg in its nest, in a quiet corner', gap: 0.5 })) : null;
  if (cells >= 9) ccmQuiet(ctx, () => ctx.wall('perch-tree', { sides: [far, ...lat], prefer: 'corner', layer: 'anchor', rule: 'perch', why: 'the perch tree, in a far corner', gap: 0.5 }));
  // feed by the door: sacks, a bin, a bucket; a trough in a big room
  wizFloor(ctx, ['sack', 'rural-feed-sack-open', 'barrel', 'grain-bin-stable'], Math.max(1, Math.min(4, Math.round(cells / 6))), d ? d.inner : [focal.x, focal.z], { radius: 7, margin: 0.5, why: 'feed and water by the door', layer: 'store' });
  if (cells >= 20) mansionWall(ctx, ccmFirst(ctx, ['feed-trough', 'grain-bin-stable']), other, { why: 'the feed bin' });
  for (let i = 0, n = Math.max(1, Math.round(cells / 8)); i < n; i++) ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { why: 'straw on the floor' }));
  if (cells >= 12) ccmQuiet(ctx, () => ctx.wall('fern-potted', { sides: all, prefer: 'corner', layer: 'plants', why: 'a potted fern', gap: 0.2 }));
  wizLights(ctx, { wall: ['lantern-wall-iron', 'sconce-candle-single'], floor: ['lantern-post-indoor', 'candlestick-floor'], overhead: !mid });
  ctx.wizInfo = { cages: cages.length, nest: !!nest };
  ccmDone(ctx);
  return { feature: focal, what: `${mid ? 'the great cage' : 'a cage'}, ${cages.length} cages and tanks round the walls`, approach: null, passage: true };
}

// TOWER STAIR (hub): the spiral in a far corner (9 ft across: it leaves an L of floor to cross from door to door), a
// bust or an armillary on the landing, torches. In a room too small for the spiral a bust faces the door.
// The spiral is laid as a piece, as the mansion's grand stair is
// (since 2026-10-11 the role makes the stair: the game opens the floor above it, rails the hole and carries pawns: engine/core/stairs.js).
function wizStair(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), least = Math.min(ctx.W, ctx.D);
  let stair = null;
  if (ccmHas(ctx, 'stair-spiral-wide') && least >= 13) {
    const sk = ctx.chooseSku('stair-spiral-wide'), dm = sk && ctx.dims('stair-spiral-wide', sk), m = dm ? Math.max(dm.w, dm.d) / 2 + 0.15 : 4.65;
    const spots = [], at = (a, b) => { const x = [a, b].includes('W') ? ctx.X0 + m : [a, b].includes('E') ? ctx.X1 - m : null, z = [a, b].includes('N') ? ctx.Z0 + m : [a, b].includes('S') ? ctx.Z1 - m : null; if (x !== null && z !== null) spots.push([x, z, SIDES[far].rot]); };
    for (const s of ctx.shuffle([...lat])) at(far, s);
    if (d) for (const s of lat) at(d.side, s); // (a door in the far corner's walls: the corners of the door wall)
    spots.push([(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2, SIDES[far].rot]);
    stair = mansionAt(ctx, 'stair-spiral-wide', spots, { layer: 'anchor', rule: 'key-stair', why: 'the spiral stair: in a far corner, the floor left as an L from door to door', extra: { focal: true } });
    if (stair) { ctx.focal = { label: 'spiral stair', id: stair.id, ok: true }; if (d) { ctx.sight = [d.inner, [stair.x, stair.z]]; ctx.sightFeature = stair.id; } }
  }
  const focal = stair || wizFocal(ctx, ['statue-bust', 'armillary-great', 'pedestal-display', 'bench-long'], { label: 'bust', rule: 'key-bust', gap: 0.3 });
  if (!focal) return { fail: `tower stair has no stair or bust (${ctx.focal?.why || 'no mesh'})` };
  if (d && stair) { const [nx, nz] = SIDES[d.side].n; wizWalk(ctx, [d.inner[0] - nx * 2.2, d.inner[1] - nz * 2.2]); } else wizWalk(ctx, front(focal, 2));
  if (stair && cells >= 12) ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['statue-bust', 'armillary-great', 'pedestal-display']), { sides: d ? [d.side, ...lat] : lat, prefer: 'corner', layer: 'anchor', why: 'on the landing, in the corner', gap: 0.4 }));
  if (cells >= 12) mansionWall(ctx, ccmFirst(ctx, ['bench-long', 'chest-plain']), other, { why: 'a bench on the landing', layer: 'furnish' });
  if (cells >= 16) { mansionWall(ctx, 'bookshelf', other, { why: 'a bookcase on the landing', layer: 'store' }); mansionWall(ctx, 'staff-rack', other, { why: 'staves by the door' }); }
  if (ccmHas(ctx, 'tapestry')) ccmQuiet(ctx, () => ctx.mount('tapestry', { sides: other, height: 2.6, why: 'a hanging on the wall' }));
  ccmWallLights(ctx, WIZ_TORCH, ctx.shuffle(['N', 'S', 'E', 'W']), { every: 14, why: 'a torch on the stair wall', min: 1, max: 4 });
  ccmEnsureLight(ctx, WIZ_TORCH, WIZ_CANDLE);
  ctx.wizInfo = { spiral: !!stair };
  ccmDone(ctx);
  return { feature: focal, what: stair ? 'the spiral stair in the corner' : 'a landing with a bust', approach: null, passage: true };
}

// ENCHANTER'S WORKSHOP (terminal): the stone arch on the wall facing the door, a crystal pylon each side of it; the
// enchanter's table in the middle before it; staves, scrolls and curios round the walls; crystals in the corners
function wizWorkshop(ctx) {
  const { d, far, lat, other } = wizDoorSides(ctx), cells = ccmCells(ctx), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, toDoor = SIDES[far].rot;
  const arch = ccmHas(ctx, 'portal-arch') && ctx.sideLen(far) >= 9 ? ccmFocalOn(ctx, far, ['portal-arch'], { label: 'the arch', rule: 'key-arch', gap: 0.6, why: 'the stone arch: centred on the wall facing the door (axial focal)' }) : null;
  if (arch) ccmFlank(ctx, arch, ['arcane-pylon'], { off: 0.7, layer: 'anchor', why: 'a crystal pylon each side of the arch' });
  let table = arch && deep >= 14 ? mansionAt(ctx, ccmFirst(ctx, ['enchanting-table', 'table-kitchen-prep']), [3.4, 4, 2.8, 4.8].map(a => [...front(arch, a + 1.25), toDoor]), { layer: 'anchor', rule: 'key-table', why: 'the enchanter\'s table before the arch', extra: { focal: true } }) : null;
  if (!arch && !table) table = wizFocal(ctx, ['enchanting-table', 'arcane-pylon', 'table-kitchen-prep', 'crystal-formation'], { label: 'enchanter\'s table', rule: 'key-table', centre: Math.min(ctx.W, ctx.D) >= 13 });
  const focal = arch || table;
  if (!focal) return { fail: `workshop has no arch or table (${ctx.focal?.why || 'no mesh'})` };
  if (arch) { ctx.focal = { label: 'the arch', id: arch.id, side: far, ok: true }; if (d) { ctx.sight = [d.inner, [arch.x, arch.z]]; ctx.sightFeature = arch.id; } }
  if (table && table.id !== 'enchanting-table') wizOnto(ctx, table, ['tome-grimoire', 'crystal-ball', 'potion-bottles', 'scroll-pile', 'candlestick'], 4, 'on the work table');
  if (table) mansionAt(ctx, 'stool-three-leg', [...front(table, 0.9), table.rot + Math.PI], { rule: 'desk-chair', why: 'a stool at the table', allowKeep: true });
  wizWalk(ctx, front(table || focal, 2.2));
  for (const s of lat) if (cells >= 12) ccmCorner(ctx, ccmFirst(ctx, ['crystal-formation', 'crystal-glowing']), [far, s], { why: 'crystals growing in the corner', inset: 0.4, layer: 'anchor' });
  if (cells >= 9) mansionWall(ctx, 'staff-rack', other, { sideCost: 1, at: 0.3, why: 'the rack of staves' });
  if (cells >= 12) mansionWall(ctx, ccmFirst(ctx, ['alch-bench-dressed', 'table-kitchen-prep']), other, { sideCost: 1, at: 0.6, layer: 'furnish', why: 'the bench where the work is prepared' });
  if (cells >= 16) { mansionWall(ctx, 'scroll-rack', other, { sideCost: 1, at: 0.8, why: 'the scroll rack' }); mansionWall(ctx, 'cabinet-curios', other, { sideCost: 1, at: 0.2, why: 'the cabinet of curiosities' }); }
  if (cells >= 20) { ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['orb-socket-pedestal', 'egg-nest-great', 'chest-ironbound']), { sides: other, prefer: 'corner', why: 'in the corner', gap: 0.4 })); mansionWall(ctx, 'spellbook-lectern', other, { why: 'the great book on its lectern' }); }
  if (d && cells >= 12) for (const s of lat) ccmCorner(ctx, ccmFirst(ctx, ['elemental-brazier', 'brazier-tripod']), [d.side, s], { why: 'a brazier in the corner by the door', inset: 0.5, layer: 'light' });
  wizLights(ctx, { at: table ? [table.x, table.z] : front(focal, 4), every: 16 });
  ctx.wizInfo = { arch: !!arch, table: table?.id || null };
  ccmDone(ctx);
  return { feature: focal, what: arch ? `the stone arch${table ? ', the enchanter\'s table before it' : ''}` : 'the enchanter\'s table', approach: null, passage: true };
}

// the leg of an L-shaped tower room (see ccmAnnex): more of the same walls, never a second key piece
function wizAnnex(ctx, { wall = [], floor = [], n = null } = {}) {
  const k = n ?? Math.max(1, Math.round(ctx.area() / 90));
  if (wall.length) wizWalls(ctx, wall, ctx.shuffle(['N', 'S', 'E', 'W']), k, { why: 'against the wall' });
  if (floor.length) wizFloor(ctx, floor, k, [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], { why: 'set down in the alcove' });
  ccmWallLights(ctx, WIZ_SCONCE, ctx.shuffle(['N', 'S', 'E', 'W']), { every: 14, why: 'a wall light', min: 1, max: 2 });
}

// ---- wizard's tower: hooks into the dispatcher ----
Object.assign(KEY, { 'wiz-lab': wizLab, 'wiz-study': wizStudy, 'wiz-summoning': wizSummoning, 'wiz-observatory': wizObservatory, 'wiz-scrying': wizScrying, 'wiz-store': wizStore,
  'wiz-apothecary': wizApothecary, 'wiz-bedchamber': wizBedchamber, 'wiz-menagerie': wizMenagerie, 'wiz-stair': wizStair, 'wiz-workshop': wizWorkshop });
Object.assign(MENUS, {
  'wiz-lab': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['alch-reagent-shelf-tall', 'apothecary-drawers'], floor: ['alch-carboy-wicker', 'barrel'] })),
  'wiz-study': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['bookshelf', 'bookshelf', 'scroll-rack'], floor: ['book-pile-floor'] })),
  'wiz-summoning': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['chest-ironbound', 'pedestal-display'], floor: ['candle-drippings-mound'] })),
  'wiz-observatory': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['bookshelf', 'scroll-rack', 'telescope'] })),
  'wiz-scrying': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['mirror-standing'], floor: ['crystal-glowing'] })),
  'wiz-store': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['alch-reagent-shelf-tall', 'shelving-freestanding'], floor: ['crate', 'barrel', 'alch-potion-crate-straw'] })),
  'wiz-apothecary': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['alch-reagent-shelf-tall', 'cabinet-curios'], floor: ['barrel'] })),
  'wiz-bedchamber': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['wardrobe', 'bookshelf'], floor: ['book-pile-floor'] })),
  'wiz-menagerie': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['birdcage-standing', 'animal-hutch'], floor: ['sack', 'hay-bale'] })),
  'wiz-stair': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['bench-long', 'statue-bust'] })),
  'wiz-workshop': ccmAnnex((ctx) => wizAnnex(ctx, { wall: ['staff-rack', 'scroll-rack', 'cabinet-curios'], floor: ['crystal-glowing'] })),
});
// (test/yard.test.mjs holds the yard's 2 to 0.6x of EVERY indoor target, so nothing indoors goes under 3.5)
Object.assign(DENSITY, { 'wiz-lab': 4.5, 'wiz-study': 6, 'wiz-summoning': 4.5, 'wiz-observatory': 3.5, 'wiz-scrying': 3.5, 'wiz-store': 5.5, 'wiz-apothecary': 5, 'wiz-bedchamber': 4.5, 'wiz-menagerie': 4.5, 'wiz-stair': 3.5, 'wiz-workshop': 3.5 });
Object.assign(FOCAL, { 'wiz-lab': 'brick furnace', 'wiz-study': 'bookcase (the desk before it)', 'wiz-summoning': 'the circle (in the middle of the floor)', 'wiz-observatory': 'great telescope (in the middle of the floor)',
  'wiz-scrying': 'scrying basin (in the middle of the floor)', 'wiz-store': 'drawer cabinet', 'wiz-apothecary': 'counter', 'wiz-bedchamber': 'curtained bed', 'wiz-menagerie': 'the great iron cage (in the middle of the floor)',
  'wiz-stair': 'spiral stair (in a far corner)', 'wiz-workshop': 'stone arch' });
Object.assign(KEY_RE, { 'wiz-lab': /^(alch-athanor|alch-bench-dressed|alch-still-copper-large|cauldron|table-kitchen-prep)/, 'wiz-study': /^(bookshelf|scroll-rack|desk-)/, 'wiz-summoning': null,
  'wiz-observatory': /^(telescope|armillary-great|trade-globe)/, 'wiz-scrying': /^(scrying-pool|orb-socket-pedestal|mirror-standing|table-round-small|pedestal-display)$/, 'wiz-store': /^(apothecary-drawers|alch-reagent-shelf-tall|cabinet-curios|shelving)/,
  'wiz-apothecary': /^(alch-counter-apothecary|counter-shop|apothecary-drawers|alch-reagent-shelf-tall|table-kitchen-prep|cabinet-curios)$/, 'wiz-bedchamber': /^bed-/, 'wiz-menagerie': /^(egg-nest-great|perch-tree|birdcage-standing|cage-floor|vivarium|animal-hutch|alch-familiar-perch)$/,
  'wiz-stair': /^(stair-spiral-wide|statue-bust|armillary-great|pedestal-display|bench-long)$/, 'wiz-workshop': /^(portal-arch|enchanting-table|arcane-pylon|table-kitchen-prep|crystal-formation)$/ });
