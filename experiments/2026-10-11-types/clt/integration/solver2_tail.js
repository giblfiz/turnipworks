
// >>> types:flavor
// ======================= FLAVOR SLOTS (2026-10-11; shared by every religious type: cult sanctum, temple) =======================
// A flavor is a symbol-theme (never a named god) that re-dresses a religious place. Architecture and furniture are
// flavor-neutral; the iconography is on six roles, one sku per flavor, sku `<role>--<flavor>`, the flavor = the sku's shape:
//   flavor-altarpiece (mesh, on the altar)   flavor-idol (mesh, floor)      flavor-banner (flat, wall)
//   flavor-relief (flat wall card)           flavor-sigil (flat, floor)     flavor-censer (mesh, floor light)
//   flavor-sculpture (mesh, floor: a second showpiece, not the idol)         flavor-buttress (mesh, against a wall: the `buttress` box, used indoors too)
// withFlavor(ctx, list) picks the room's flavor and makes EVERY roll of a `flavor-*` role in this room take that flavor's
// sku, whoever asks (a program, mount(), rug(), the shared chapel()). A slot the flavor has no sku for stays EMPTY
// (chooseSku answers null): never another flavor's piece. A program names the neutral fallback itself.
// The room's flavor, in order: room.flavor (the flavor system, when it exists) ; opts.flavor (the tuner: ?flavor=spiders) ;
// the room's BUILDING (every room of one building agrees: a seeded pick among the list's flavors that have an idol) ;
// the first flavor of the type's list. So rooms side by side never disagree by accident.
// (This block is defined ONCE. A second type's block must not repeat it: it calls withFlavor(ctx, FLAVORS.good).)
const FLAVORS = { evil: ['devils', 'spiders', 'dragons', 'skulls', 'tentacles'], good: ['sun', 'moon', 'nature', 'sword-shield'] };
const FLAVOR_SLOTS = ['flavor-altarpiece', 'flavor-idol', 'flavor-banner', 'flavor-relief', 'flavor-sigil', 'flavor-censer', 'flavor-sculpture', 'flavor-buttress'];
function flavorOf(ctx, list) {
  const all = [...FLAVORS.evil, ...FLAVORS.good], ask = ctx.room.flavor || ctx.opts?.flavor;
  if (ask && all.includes(ask)) return ask; // asked for by name: any flavor, in any type (a temple of spiders)
  const made = list.filter(f => ctx.lib.objects['flavor-idol']?.skus.some(s => s.shape === f)), pool = made.length ? made : list;
  return ctx.room.building ? pool[hash(ctx.room.building, 'flavor') % pool.length] : pool[0];
}
// forced: { role: shape } for neutral roles a religious room wants in ONE version (the plain ritual circle)
function withFlavor(ctx, list, forced = {}) {
  const f = ctx.flavor = flavorOf(ctx, list), roll = ctx.chooseSku;
  ctx.chooseSku = function (id, want = {}) {
    if (id.startsWith('flavor-')) return this.skuPool(id).some(s => s.shape === f) ? roll.call(this, id, { ...want, shape: f }) : null;
    if (forced[id] !== undefined && want.shape === undefined && this.skuPool(id).some(s => s.shape === forced[id])) return roll.call(this, id, { ...want, shape: forced[id] });
    return roll.call(this, id, want);
  };
  return f;
}
const flavorHas = (ctx, id) => ctx.has(id) && ctx.skuPool(id).some(s => s.shape === ctx.flavor); // this room's flavor fills this slot
// <<< types:flavor

// >>> types:clt.solver2
// ---------------- cult sanctum (2026-10-11): nine rooms, black-stone walls, no windows; iconography only in the flavor slots ----------------
const CULT_TORCH = ['torch-sconce', 'torch-bracket-rough'], CULT_STAND = ['rite-pillar-candle-tall', 'candlestand-pricket', 'candle-tree', 'candlestick-floor'];
const CULT_BRAZIER = ['elemental-brazier', 'brazier-standing', 'brazier-tripod'], CULT_FLAVORS = FLAVORS.evil;
const CULT_TOP = 8.6; // ft: the walls are 9 ft; an idol, an arch or a buttress specified at 9-10 ft is scaled to stand under them
function cultStart(ctx) {
  withFlavor(ctx, CULT_FLAVORS, { 'decal-ritual-circle': 'plain' });
  const d0 = ctx.dims;
  ctx.dims = function (id, sku) { const dm = d0.call(this, id, sku); if (!dm.s || dm.h <= CULT_TOP || this.lib.objects[id].place === 'kit') return dm; const f = CULT_TOP / dm.h; return { ...dm, w: dm.w * f, d: dm.d * f, h: dm.h * f, s: dm.s.map(v => v * f) }; };
  return ccmPanels(ctx);
}
const cultS = (ctx, far, p) => far === 'N' ? p.z - ctx.Z0 : far === 'S' ? ctx.Z1 - p.z : far === 'W' ? p.x - ctx.X0 : ctx.X1 - p.x; // ft out from wall `far`
// a flat on the floor at an exact spot, at k times its size; `nested` = it lies inside another flat (the sigil in the circle)
function cultFlat(ctx, id, x, z, rot, { k = 1, why = '', nested = false } = {}) {
  if (!ccmHas(ctx, id)) return null;
  const sk = ctx.chooseSku(id); if (!sk) return null;
  const d0 = ctx.dims(id, sk), dm = { ...d0, w: d0.w * k, d: d0.d * k }, [aw, ad] = ctx.aabb(dm.w, dm.d, rot);
  if (x - aw / 2 < ctx.X0 - 0.01 || x + aw / 2 > ctx.X1 + 0.01 || z - ad / 2 < ctx.Z0 - 0.01 || z + ad / 2 > ctx.Z1 + 0.01) return null;
  if (!nested) { if (ctx.rugs.some(b => Math.abs(b.x - x) < (b.w + aw) / 2 && Math.abs(b.z - z) < (b.d + ad) / 2)) return null; ctx.rugs.push({ x, z, w: aw, d: ad }); }
  return ctx.record(id, sk, dm, x, 0.03 + (ctx.rugs.length + (nested ? 1 : 0)) * 0.01, z, rot, 'floor-dress', 'rug', why, { orient: 'floor' });
}
// THE RITUAL CIRCLE: the plain ring with the flavor's sigil inside it, centred on (x, z); the floor under it is kept clear.
// A room too small for the ring gets the sigil alone, smaller. Returns { r (ft), ring, sigil } or null.
function cultCircle(ctx, x, z, rot, room) {
  const [cw] = ccmSize(ctx, 'decal-ritual-circle'), [sw] = ccmSize(ctx, 'flavor-sigil');
  let ring = null, sigil = null, r = 0;
  if (ccmHas(ctx, 'decal-ritual-circle') && room >= cw + 0.5) { ring = cultFlat(ctx, 'decal-ritual-circle', x, z, rot, { why: 'the ritual circle: a plain ring drawn on the floor' }); if (ring) r = ring.dims[0] / 2; }
  if (flavorHas(ctx, 'flavor-sigil')) { const k = ring ? Math.min(1, cw * 0.7 / sw) : Math.min(1, (room - 0.5) / sw);
    if (k >= 0.5) sigil = cultFlat(ctx, 'flavor-sigil', x, z, rot, { k, nested: !!ring, why: ring ? `the ${ctx.flavor} sigil inside the circle` : `the ${ctx.flavor} sigil on the floor` });
    if (sigil && !ring) r = sigil.dims[0] / 2; }
  if (!ring && !sigil) return null;
  ctx.mark(x, z, 2 * r, 2 * r, KEEP);
  return { r, ring, sigil, x, z };
}
// the flavor on the walls: banners and relief cards in turn (flats, hung like the castle's banners); returns how many hung
function cultHang(ctx, sides, n, { why = 'the cult\'s sign on the wall', first = 0 } = {}) {
  const ids = ['flavor-banner', 'flavor-relief'].filter(id => flavorHas(ctx, id)); let k = 0;
  for (let i = 0; i < n && ids.length; i++) if (ccmQuiet(ctx, () => ctx.mount(ids[(i + first) % ids.length], { sides: [sides[i % sides.length]], height: 5.8, why }))) k++;
  return k;
}
// a pair of standing lights: the flavor's censer where it has one, else neutral tall candles
const cultCenser = (ctx) => flavorHas(ctx, 'flavor-censer') ? 'flavor-censer' : ccmFirst(ctx, CULT_STAND);
function cultTable(ctx, sides, near, things, why) {
  const id = ccmFirst(ctx, ['table-square', 'table-round-small', 'table-side']); if (!id) return null;
  const t = ccmQuiet(ctx, () => ctx.wall(id, { sides, prefer: near ? 'near' : 'random', near, why }));
  if (t) for (const th of things) if (ccmHas(ctx, th)) ccmQuiet(ctx, () => ctx.surface(th, { on: s => s.uid === t.uid, layer: /candle/.test(th) ? 'light' : 'dress', why: 'on the table' }));
  return t;
}
function cultWalks(ctx, to) { const d = ctx.mainDoor; if (!d) return; ccmWalk(ctx, 'approach', [d.inner, to]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, to]); }

// SANCTUM (terminal, entered at the end): the idol on the end wall, the altar slab before it with the altar-piece and
// two candles, a standing light each side, the ritual circle with the sigil on the axis before the altar, a few rows
// of seats behind the circle, pillars and hooded statues down the sides, the cult's signs on the long walls
function cultSanctum(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, far = castleFar(ctx, 2.6, { shortEnd: true }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx);
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), toDoor = SIDES[far].rot;
  const idol = deep >= 19 && L >= 9 && flavorHas(ctx, 'flavor-idol') ? ccmFocalOn(ctx, far, ['flavor-idol'], { label: 'idol', rule: 'key-idol', gap: 0.3, strict: true, why: `the ${ctx.flavor} idol: centred on the end wall, over the altar` }) : null;
  const s0 = idol ? cultS(ctx, far, idol) + idol.dims[2] / 2 + 1.0 : 1.4;
  let altar = null;
  const aid = ccmFirst(ctx, ['altar-sacrificial', 'altar-stone']), ask = aid && ctx.chooseSku(aid);
  if (ask) { const dm = ctx.nominalDims(aid, ask), cross = dm.d > dm.w && L >= dm.d + 5, out = cross ? dm.w : dm.d; // the slab lies ACROSS the axis where the room is wide enough
    altar = castlePut(ctx, aid, [0, 0.4, 0.8, 1.2].map(e => [...axis(s0 + e + out / 2), toDoor + (cross ? Math.PI / 2 : 0)]), { sku: { shape: ask.shape }, layer: 'anchor', rule: 'key-altar', unique: true, extra: { focal: true }, why: 'the altar slab: on the axis before the end wall' }); }
  if (!altar) altar = ccmFocalOn(ctx, far, ['altar-sacrificial', 'altar-stone'], { label: 'altar', rule: 'key-altar', gap: 1.2, why: 'the altar: centred on the end wall' });
  if (!altar) return { fail: `sanctum has no altar (${aid ? 'no room on the end wall' : 'no altar mesh'})` };
  ctx.focal = { label: 'altar', id: altar.id, side: far, ok: true };
  if (d) { ctx.sight = [d.inner, [altar.x, altar.z]]; ctx.sightFeature = altar.id; }
  const [aaw, aad] = ctx.aabb(altar.dims[0], altar.dims[2], altar.rot), ns = far === 'N' || far === 'S', aOut = ns ? aad : aaw, aAlong = ns ? aaw : aad, sAlt = cultS(ctx, far, altar), frontS = sAlt + aOut / 2;
  // on the altar: the flavor's altar-piece in the middle, a candle toward each end, one ritual thing
  const crossed = Math.abs(Math.sin(altar.rot - toDoor)) > 0.5, on = (id, e, why, layer) => ccmOn(ctx, id, altar, crossed ? 0 : e, crossed ? e : 0, why, layer);
  if (flavorHas(ctx, 'flavor-altarpiece')) on('flavor-altarpiece', 0, `the ${ctx.flavor} altar-piece, in the middle of the altar`);
  { const c = ccmFirst(ctx, ['candle-black', 'candle-cluster', 'candlestick']); if (c) for (const e of [-0.38, 0.38]) on(c, e, 'a candle toward each end of the altar', 'light'); }
  { const t = ccmAny(ctx, ['dagger-ritual', 'chalice-dark', 'rite-blood-bowl']); if (t) on(t, 0.2, 'on the altar'); }
  // a standing light each side of the altar (the flavor's censer where it has one)
  for (const sg of [-1, 1]) { const id = cultCenser(ctx); if (id) castlePut(ctx, id, [1.2, 1.6, 2.0].map(e => [...axis(sAlt, L / 2 + sg * (aAlong / 2 + e)), toDoor]), { layer: 'light', rule: 'flank', why: 'a standing light each side of the altar' }); }
  // the circle, on the axis before the altar
  const [cw] = ccmSize(ctx, 'decal-ritual-circle'), roomC = Math.min(L - 3, deep - frontS - 7);
  const circ = roomC >= 5 ? cultCircle(ctx, ...axis(frontS + 1.5 + Math.min(cw, roomC) / 2), toDoor, roomC) : null;
  const openS = circ ? frontS + 1.5 + 2 * circ.r : frontS;
  castleStrip(ctx, far, frontS, deep, 3.5);
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, axis(deep - 2.5), axis(frontS + 1.2)], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(Math.min(deep - 2.5, openS + 2))]); }
  // pillars against the side walls (a mirrored avenue), then seats in at most four rows behind the circle
  const pillars = [], butt = L >= 29 && flavorHas(ctx, 'flavor-buttress');
  if (butt) for (let k = 0, n = Math.max(2, Math.round(deep / 10)); k < n; k++) for (const side of lat) { const t = deep * (k + 0.5) / n; // (the flavor's buttress in mirrored pairs: pier to the wall, arch reaching into the room)
    const p = ccmQuiet(ctx, () => ctx.put('flavor-buttress', (dm) => ctx.wallGen(dm, [side], { gap: 0.02, tRange: [t - 1.2, t + 1.2], step: 0.3 }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'avenue', why: `a ${ctx.flavor} buttress against each long wall (mirrored pairs)` })); if (p) pillars.push(p); }
  else if (L >= 19 && ccmHas(ctx, 'pillar-square')) for (let s = Math.max(4, frontS - 1); s <= deep - 4; s += 9) for (const sg of [-1, 1]) { const p = castlePut(ctx, 'pillar-square', [...axis(s, L / 2 + sg * (L / 2 - 1.6)), 0], { layer: 'anchor', rule: 'avenue', why: 'a pillar each side, down the sanctum (mirrored)' }); if (p) pillars.push(p); }
  const margin = butt && pillars.length ? 4.7 : pillars.length ? 3.0 : 0.6, seat = ['pew', 'bench-stone', 'bench-long'].filter(id => ccmHas(ctx, id)).find(id => ccmSize(ctx, id)[0] <= (L - 4) / 2 - margin + 0.01);
  const sd = seat ? ccmSize(ctx, seat)[1] : 2, pitch = 3.6, rows0 = openS + 2.2;
  const ranks = seat ? ccmRanks(ctx, { far, s0: rows0, s1: Math.min(deep - 4, rows0 + 4 * pitch - (pitch - sd) + 0.01), gap: pitch - sd, aisle: 4, margin, turn: 0, proto: seat, choose: () => seat, rule: 'pew', why: 'seats in rows facing the altar, behind the circle' }) : { placed: [], rows: 0 };
  if (ranks.placed.length) ctx.growth.push(`${ranks.placed.length} seats in ${ranks.rows} rows facing the altar`);
  // hooded statues in the corners of the end wall; fire bowls either side of the circle (or by the door)
  { const sc = flavorHas(ctx, 'flavor-sculpture'); // the flavor's sculpture in a mirrored pair in the corners of the end wall; the hooded statues then stand by the door
    for (const s of lat) ccmCorner(ctx, sc ? 'flavor-sculpture' : 'statue-hooded', [far, s], { why: sc ? `a ${ctx.flavor} sculpture in each corner of the end wall` : 'a hooded statue in the corner of the end wall', inset: 0.4, layer: 'anchor' });
    if (sc && d && cells >= 30) for (const s of ccmLat(d.side)) ccmCorner(ctx, 'statue-hooded', [d.side, s], { why: 'a hooded statue in the corner of the door wall', inset: 0.4, layer: 'anchor' }); }
  if (circ && L / 2 - circ.r >= 4.2) for (const sg of [-1, 1]) { const id = ccmFirst(ctx, CULT_BRAZIER); if (id) castlePut(ctx, id, [...axis(cultS(ctx, far, circ), L / 2 + sg * (circ.r + 1.6)), 0], { layer: 'light', rule: 'flank', why: 'a fire bowl each side of the circle' }); }
  else if (d && !(flavorHas(ctx, 'flavor-sculpture') && cells >= 30)) for (const s of ccmLat(d.side)) ccmCorner(ctx, ccmFirst(ctx, CULT_BRAZIER), [d.side, s], { why: 'a fire bowl in the corner of the door wall', layer: 'light' });
  if (cells >= 30) ccmAlong(ctx, ['rite-kneeler-cushion'], [far], 2, { why: 'a kneeling cushion before the altar wall', layer: 'dress' });
  const hung = cultHang(ctx, [...lat, ...(idol ? [] : [far])], Math.max(2, Math.round(deep / 7) * 2), { why: 'the cult\'s banners and reliefs down the long walls' });
  ccmWallLights(ctx, CULT_TORCH, d ? [d.side, ...lat] : lat, { every: 16, min: 1, why: 'wall torch' });
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
  ctx.cultInfo = { flavor: ctx.flavor, idol: !!idol, circle: !!circ?.ring, sigil: !!circ?.sigil, seats: ranks.placed.length, hung, pillars: pillars.length };
  ccmDone(ctx);
  return { feature: altar, what: `altar slab${idol ? ` under the ${ctx.flavor} idol` : ''}${circ ? ', the ritual circle before it' : ''}, ${ranks.placed.length} seats`, approach: null, passage: true };
}

// PROCESSIONAL PASSAGE (a through-way, entered at an end): a clear line down the middle on the runner, hooded statues
// in mirrored pairs about every 10 ft with fire bowls between, the cult's signs on the plain panels (alcoves are panels)
function cultPassage(ctx) {
  const panels = cultStart(ctx);
  const d = ctx.mainDoor, long = ctx.longSides(), ends = ctx.shortSides(), Lr = Math.max(ctx.W, ctx.D), across = Math.min(ctx.W, ctx.D), horiz = long[0] === 'N';
  const cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, at = (t, o) => ctx.sidePoint(long[0], t, o);
  ctx.mark(cx, cz, horiz ? ctx.W : 3.2, horiz ? 3.2 : ctx.D, KEEP);
  const a = at(1.8, across / 2), b = at(Lr - 1.8, across / 2);
  if (d) { const near = Math.hypot(d.inner[0] - a[0], d.inner[1] - a[1]) <= Math.hypot(d.inner[0] - b[0], d.inner[1] - b[1]) ? [a, b] : [b, a];
    ccmWalk(ctx, 'through', [d.inner, near[0], near[1]], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'through', [d.inner, ...(Math.hypot(o.inner[0] - near[1][0], o.inner[1] - near[1][1]) < Lr / 2 ? near : [near[0]]), o.inner]); }
  else ccmWalk(ctx, 'through', [a, b], { width: 3 });
  const [, rl] = ccmSize(ctx, 'rug-runner'); let runners = 0;
  if (across >= 9) for (let t = 0.5; t + rl <= Lr - 0.5; t += rl) if (castleRug(ctx, 'rug-runner', ...at(t + rl / 2, across / 2), SIDES[long[0]].rot + Math.PI / 2, {}, 'the runner down the middle of the passage')) runners++;
  // statues and fire bowls in mirrored pairs against the long walls, never before an alcove panel (windowT holds them)
  const things = []; let k = 0;
  if (across >= 9) for (let t = 3; t <= Lr - 3 + 1e-6; t += 5, k++) for (const side of long) {
    const id = k % 2 ? ccmFirst(ctx, CULT_BRAZIER) : k % 4 === 2 && flavorHas(ctx, 'flavor-sculpture') ? 'flavor-sculpture' : ccmFirst(ctx, ['statue-hooded', 'pillar-square']); if (!id) continue; // (every second pair of figures is the flavor's sculpture)
    const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [side], { gap: 0.15, tRange: [t - 1.6, t + 1.6], step: 0.4 }), (c) => Math.abs(c.t - t), { layer: k % 2 ? 'light' : 'anchor', rule: 'avenue', why: k % 2 ? 'a fire bowl between the statues' : 'a hooded statue, one of a pair facing across the way' }));
    if (p) things.push(p);
  }
  const hung = cultHang(ctx, long, Math.max(2, Math.round(Lr / 8) * 2), { why: 'the cult\'s banners and reliefs along the passage' });
  ccmWallLights(ctx, CULT_TORCH, across >= 9 ? ends : [...ends, ...long], { every: across >= 9 ? 10 : 14, min: 1, max: across >= 9 ? 2 : 6, why: 'wall torch' });
  if (ccmHas(ctx, 'candle-drippings-mound') && ctx.chance(0.5)) ccmQuiet(ctx, () => ctx.wall('candle-drippings-mound', { sides: long, layer: 'light', why: 'old candle wax at the foot of the wall' }));
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
  ctx.cultInfo = { flavor: ctx.flavor, panels, statues: things.filter(p => p.id === 'statue-hooded').length, runners, hung };
  ccmDone(ctx);
  return { feature: null, what: `a clear way between ${things.length} statues and fire bowls${panels ? `, ${panels} alcoves` : ''}`, approach: null, passage: true };
}

// SUMMONING CHAMBER (terminal): the circle with the sigil dead centre, a boundary stone at each of its four points, a
// tall candle between each two, the empty arch on the wall facing the door, the chained book on its lectern facing the circle
function cultSummoning(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), small = Math.min(ctx.W, ctx.D);
  const cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, rot = SIDES[far].rot;
  const circ = cultCircle(ctx, cx, cz, rot, small - 5.5);
  const stones = [], R = circ ? circ.r + 0.2 : Math.max(2, small / 2 - 3.5);
  if (!circ) ctx.mark(cx, cz, 2 * R - 1.5, 2 * R - 1.5, KEEP);
  for (let i = 0; i < 4; i++) { const a = rot + Math.PI / 4 + i * Math.PI / 2, p = castlePut(ctx, 'rite-sigil-stone', [cx + Math.sin(a) * R, cz + Math.cos(a) * R, a + Math.PI], { layer: 'anchor', rule: 'key-circle', allowKeep: true, why: 'a boundary stone at each of the circle\'s four points', extra: { focal: true } }); if (p) stones.push(p); }
  const cand = ccmFirst(ctx, ['rite-pillar-candle-tall', 'candlestick-floor', 'candlestand-pricket']); let candles = 0;
  if (cand) for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2 + (i % 2 ? 0 : 0), s = (i === 0 || i === 2); // on the axis only where no walk comes in: the two side points
    if (s) continue; if (castlePut(ctx, cand, [cx + Math.sin(a) * R, cz + Math.cos(a) * R, 0], { layer: 'light', rule: 'key-circle', allowKeep: true, why: 'a tall candle between the stones' })) candles++; }
  const arch = ccmFocalOn(ctx, far, ['portal-arch'], { label: 'arch', rule: 'key-arch', gap: 0.4, why: 'the empty arch: centred on the wall facing the door, beyond the circle' });
  const key = stones[0] || arch || circ?.ring || circ?.sigil;
  if (!key) return { fail: 'summoning chamber has no circle, stones or arch' };
  ctx.focal = { label: 'ritual circle', id: key.id, ok: true, centre: true };
  if (d) { ctx.sight = [d.inner, [cx, cz]]; ctx.sightFeature = key.id; }
  { const toD = d ? Math.atan2(d.inner[0] - cx, d.inner[1] - cz) : rot, edge = [cx + Math.sin(toD) * (R + 1.2), cz + Math.cos(toD) * (R + 1.2)]; cultWalks(ctx, edge); }
  // the lectern: just outside the circle on the door side, off the line from the door, turned to the circle
  if (ccmHas(ctx, 'spellbook-lectern') || ccmHas(ctx, 'lectern')) { const id = ccmFirst(ctx, ['spellbook-lectern', 'lectern']), sg = ctx.chance(0.5) ? 1 : -1;
    castlePut(ctx, id, [sg, -sg].flatMap(g => [0.6, 0.9].map(f => { const a = rot + Math.PI + g * f, x = cx + Math.sin(a) * (R + 1.6), z = cz + Math.cos(a) * (R + 1.6); return [x, z, Math.atan2(cx - x, cz - z)]; })), { rule: 'lectern', why: 'the book on its lectern, at the edge of the circle, turned to it' }); }
  for (const s of lat) ccmCorner(ctx, ccmFirst(ctx, CULT_BRAZIER), [far, s], { why: 'a fire bowl in the far corner', layer: 'light', inset: 0.5 });
  if (d && ccmCells(ctx) >= 16) cultTable(ctx, [d.side, ...ccmLat(d.side)], d.inner, ['tome-grimoire', 'rite-ritual-hand-bell', 'rite-blood-bowl', 'candle-black'], 'the work table: against the wall by the door');
  if (ccmCells(ctx) >= 25) for (const s of lat) ccmQuiet(ctx, () => ctx.wall('pedestal-display', { sides: [s], why: 'a pedestal against the side wall' }));
  cultHang(ctx, lat, 2, { first: 1 });
  ccmWallLights(ctx, CULT_TORCH, d ? [d.side] : lat, { every: 14, min: 1, max: 2, why: 'torch on the door wall' });
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
  ctx.cultInfo = { flavor: ctx.flavor, circle: !!circ?.ring, sigil: !!circ?.sigil, stones: stones.length, candles, arch: !!arch };
  ccmDone(ctx);
  return { feature: key, what: `${circ?.ring ? 'the ritual circle' : 'a ring of stones'} with ${stones.length} boundary stones${arch ? ', the arch beyond it' : ''}`, approach: null, passage: true };
}

// HOLDING CELLS (terminal, dark): cages in a row down the wall facing the door, a way kept clear before them,
// manacles and a plank bench on a side wall, a pallet and bucket, the gaoler's table and stool by the door, ONE fire
function cultCells(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), cells = ccmCells(ctx), cages = [];
  const n = Math.max(1, Math.min(5, Math.floor((L - 1) / 6)));
  for (let k = 0; k < n; k++) { const t = L * (k + 0.5) / n, id = ccmFirst(ctx, k % 2 ? ['cage-floor', 'cage-sacrifice'] : ['cage-sacrifice', 'cage-floor']); if (!id) break;
    const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap: 0.4, tRange: [t - 1.5, t + 1.5], step: 0.25, windows: false }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'key-cage', why: 'a cage, one of a row along the wall facing the door', extra: { focal: true } }));
    if (p) cages.push(p); }
  if (!cages.length) for (const s of lat) { const p = ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['cage-sacrifice', 'cage-floor']), { sides: [s], layer: 'anchor', rule: 'key-cage', why: 'a cage against the side wall' })); if (p) { cages.push(p); break; } }
  if (!cages.length) return { fail: `holding cells have no cage (${ccmFirst(ctx, ['cage-sacrifice', 'cage-floor']) ? 'no wall run clear of the doors' : 'no cage mesh'})` };
  ctx.focal = { label: 'cage', id: cages[0].id, side: far, ok: true };
  const mid = cages[Math.floor(cages.length / 2)];
  if (d) { ctx.sight = [d.inner, [mid.x, mid.z]]; ctx.sightFeature = mid.id; }
  cultWalks(ctx, front(mid, 1.8));
  for (const c of cages.filter((_, i) => i % 2 === 0)) ccmQuiet(ctx, () => ctx.companion(c, ccmAny(ctx, ['bucket-slop', 'bucket']), { why: 'a bucket by the cage', maxDist: 3.5 }));
  for (let i = 0, m = cells >= 20 ? 2 : 1; i < m; i++) ccmQuiet(ctx, () => ctx.mount('manacles-wall', { sides: [lat[i % 2]], height: 4.6, why: 'manacles on the side wall' }));
  if (cells >= 16) ccmLieAlong(ctx, 'bed-straw-pallet', lat, { why: 'a straw pallet along the side wall' });
  if (cells >= 20) ccmQuiet(ctx, () => ctx.wall('chest-ironbound', { sides: lat, layer: 'store', why: 'the prisoners\' things, locked away' }));
  if (d) { const t = cultTable(ctx, [d.side, ...ccmLat(d.side)], d.inner, ['lantern-hand', 'candlestick', 'tankard'], 'the gaoler\'s table: against the wall by the door');
    if (t) ccmQuiet(ctx, () => ctx.companion(t, 'stool-three-leg', { why: 'the gaoler\'s stool', maxDist: 3 }));
    ccmQuiet(ctx, () => ctx.mount('key-hook-board', { sides: [d.side], height: 5, why: 'the keys, by the door' })); }
  ccmCorner(ctx, ccmFirst(ctx, ['brazier-standing', 'brazier-tripod', 'elemental-brazier']), [d ? d.side : far, lat[ctx.ri(0, 1)]], { why: 'the one fire, in a corner by the door', layer: 'light' });
  ccmEnsureLight(ctx, CULT_TORCH, ['brazier-standing', ...CULT_STAND]);
  ctx.cultInfo = { flavor: ctx.flavor, cages: cages.length };
  ccmDone(ctx);
  return { feature: mid, what: `${cages.length} cage${cages.length === 1 ? '' : 's'} in a row facing the door`, approach: null, passage: true };
}

// ROBING ROOM (uses the sanctum): robes are the read. A rail of hooded robes standing in the open (two in a big room),
// peg rails of robes on the walls, a bench, chests, a table with masks and a folded robe, somewhere to wash by the door
function cultVestry(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx);
  const cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, longNS = ctx.D > ctx.W, rails = [];
  // the rail: long side along the room's long axis, off the door's line; against the far wall in a small room
  const [rw] = ccmSize(ctx, 'robe-stand'), two = cells >= 20 && Math.min(ctx.W, ctx.D) >= 14;
  if (ccmHas(ctx, 'robe-stand')) {
    if (Math.min(ctx.W, ctx.D) >= 13 && Math.max(ctx.W, ctx.D) >= rw + 7) for (const sg of two ? [-1, 1] : [1]) { const o = two ? 3.2 : 0, p = castlePut(ctx, 'robe-stand', [0, 1, -1, 2, -2].map(e => longNS ? [cx + sg * o, cz + e, Math.PI / 2] : [cx + e, cz + sg * o, 0]), { layer: 'anchor', rule: 'key-robes', why: 'the rail of robes: standing in the open, the room\'s purpose', extra: { focal: true } }); if (p) rails.push(p); }
    if (!rails.length) { const p = ccmFocalOn(ctx, far, ['robe-stand'], { label: 'rail of robes', rule: 'key-robes', gap: 0.3, slack: Math.max(0.5, L / 2 - rw / 2 - 0.5), why: 'the rail of robes: against the wall facing the door' }); if (p) rails.push(p); }
  }
  const pegs = []; for (let i = 0, m = Math.max(rails.length ? 1 : 2, Math.min(4, Math.round(cells / 6))); i < m; i++) { const p = ccmQuiet(ctx, () => ctx.mount('robe-rack', { sides: [[...lat, far][i % 3]], height: 4.2, layer: 'furnish', why: 'robes on a peg rail' })); if (p) pegs.push(p); }
  if (d) rails.sort((a, b) => Math.hypot(a.x - d.inner[0], a.z - d.inner[1]) - Math.hypot(b.x - d.inner[0], b.z - d.inner[1])); // (the nearer rail is the one seen from the door)
  let key = rails[0] || pegs[0];
  if (!key) { key = ccmQuiet(ctx, () => ctx.wall('wardrobe', { sides: [far, ...lat], layer: 'anchor', why: 'the wardrobe (no robe rail mesh)' })); }
  if (!key) return { fail: 'robing room has no robes (no robe-stand, robe-rack or wardrobe mesh, or no wall for one)' };
  ctx.focal = { label: 'robes', id: key.id, ok: true };
  if (d) { ctx.sight = [d.inner, [key.x, key.z]]; ctx.sightFeature = key.id; }
  cultWalks(ctx, rails.length && !key.side ? [key.x + (longNS ? (d && d.inner[0] < key.x ? -1 : 1) * 2.4 : 0), key.z + (longNS ? 0 : (d && d.inner[1] < key.z ? -1 : 1) * 2.4)] : front(key, 1.8));
  ccmAlong(ctx, ['bench-long', 'bench-stone'], lat, cells >= 16 ? 2 : 1, { why: 'a bench to change on, along the wall' });
  ccmAlong(ctx, ['chest-plain', 'linen-chest'], [far, ...lat], Math.max(1, Math.min(3, Math.round(cells / 8))), { why: 'a chest against the wall', layer: 'store' });
  if (cells >= 16) ccmQuiet(ctx, () => ctx.wall('wardrobe', { sides: [far, ...lat], why: 'a wardrobe against the wall' }));
  cultTable(ctx, [far, ...lat], null, ['rite-cult-mask-blank', 'rite-hooded-robe-folded', 'candle-black', 'rite-cult-mask-blank'], 'a table against the wall: masks and a folded robe');
  for (const b of ctx.placements.filter(p => /^bench-/.test(p.id)).slice(0, 1)) ccmOn(ctx, 'rite-hooded-robe-folded', b, 0.25, 0, 'a folded robe left on the bench');
  if (d) ccmQuiet(ctx, () => ctx.wall(ccmAny(ctx, ['washstand', 'basin-stone']), { sides: [d.side, ...ccmLat(d.side)], prefer: 'near', near: d.inner, why: 'somewhere to wash, by the door' }));
  ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, CULT_STAND), { sides: [far, ...lat], prefer: 'corner', layer: 'light', why: 'a tall candle in the corner' }));
  ccmWallLights(ctx, ['sconce-candle-single', 'torch-sconce'], d ? [d.side] : lat, { every: 12, min: 1, max: 2, why: 'a light on the door wall' });
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
  ctx.cultInfo = { flavor: ctx.flavor, rails: rails.length, pegs: pegs.length };
  ccmDone(ctx);
  return { feature: key, what: `${rails.length} rail${rails.length === 1 ? '' : 's'} of robes, ${pegs.length} peg rails on the walls`, approach: null, passage: true };
}

// FORBIDDEN LIBRARY (terminal): the chained book on its lectern in the middle of the floor facing the door, bookcases
// butted along the walls until half the wall is books, a reading table with the bound tomes and candles
function cultLibrary(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), cells = ccmCells(ctx), small = Math.min(ctx.W, ctx.D);
  const LECT = ['spellbook-lectern', 'lectern'];
  let lect = small >= 13 ? ccmCentre(ctx, LECT, { label: 'the chained book', rule: 'key-lectern', rot: SIDES[far].rot, why: 'the chained book on its lectern: in the middle of the floor, facing the door' }) : null;
  if (!lect) lect = ccmFocalOn(ctx, far, LECT, { label: 'the chained book', rule: 'key-lectern', gap: 0.6, why: 'the chained book on its lectern: centred on the wall facing the door' });
  if (lect && lect.id === 'lectern') ccmOn(ctx, ccmFirst(ctx, ['tome-chained', 'tome-grimoire', 'tome-holy', 'book-open']), lect, 0, 0, 'the book on the lectern');
  if (lect) { ccmClearRound(ctx, lect, 1.0); if (d) { ctx.sight = [d.inner, [lect.x, lect.z]]; ctx.sightFeature = lect.id; } cultWalks(ctx, front(lect, 1.8)); }
  // books: cases side by side, the wall facing the door first, then the side walls, until half the wall length is books
  const BOOKS = ['bookshelf', 'bookcase-ladder', 'shelving-freestanding'].filter(id => ccmHas(ctx, id)), cases = []; let run = 0;
  const want = (ctx.W + ctx.D) * 2 * 0.5;
  for (const side of [far, ...lat, ...(d ? [d.side] : [])]) for (let i = 0; i < 8 && run < want && BOOKS.length; i++) {
    const id = BOOKS[(cases.length === 0 && BOOKS.includes('bookcase-ladder')) ? BOOKS.indexOf('bookcase-ladder') : 0], prev = cases.filter(c => c.side === side).pop();
    const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [side], { gap: 0.05, step: 0.25 }), (c) => prev ? Math.abs(Math.hypot(c.x - prev.x, c.z - prev.z) - (prev.dims[0] + c.dm?.w || prev.dims[0]) / 2) : Math.abs(c.t - ctx.sideLen(side) / 2) * 0.2 + ctx.rng(), { layer: 'store', rule: 'bookcase', why: 'bookcases side by side along the wall' }));
    if (!p) break; p.side ||= side; cases.push(p); run += p.dims[0];
  }
  if (!lect && !cases.length) return { fail: 'forbidden library has neither a lectern nor a bookcase' };
  const key = lect || cases[0]; ctx.focal = { label: lect ? 'the chained book' : 'bookcases', id: key.id, ok: true };
  if (!lect && d) { ctx.sight = [d.inner, [key.x, key.z]]; ctx.sightFeature = key.id; cultWalks(ctx, front(key, 1.8)); }
  // the reading table (a big room: in the open beside the lectern; else against a wall), the bound tomes on it
  const tid = ccmFirst(ctx, cells >= 20 ? ['table-library', 'table-trestle', 'desk-writing'] : ['desk-writing', 'table-square', 'table-side']);
  const table = tid && ccmQuiet(ctx, () => ctx.wall(tid, { sides: [...lat, ...(d ? [d.side] : [])], why: 'the reading table against the wall' }));
  if (table) { for (const th of ['rite-tome-stack-forbidden', 'tome-chained', 'tome-grimoire', 'candle-black', 'skull-single', 'book-open', 'inkwell-quill']) if (ccmHas(ctx, th)) ccmQuiet(ctx, () => ctx.surface(th, { on: s => s.uid === table.uid, layer: /candle/.test(th) ? 'light' : 'dress', why: 'on the reading table' }));
    ccmQuiet(ctx, () => ctx.companion(table, 'stool-three-leg', { why: 'a stool at the reading table', maxDist: 3 })); }
  if (lect) for (const sg of [-1, 1].slice(0, cells >= 16 ? 2 : 1)) { const [fx, fz] = ctx.facingVec(lect.rot), id = ccmFirst(ctx, CULT_STAND); if (id) castlePut(ctx, id, [1.3, 1.7].map(e => [lect.x + fz * sg * (lect.dims[0] / 2 + e), lect.z - fx * sg * (lect.dims[0] / 2 + e), lect.rot]), { layer: 'light', rule: 'flank', allowKeep: true, why: 'a tall candle beside the lectern' }); }
  if (cells >= 16) ccmQuiet(ctx, () => ctx.wall('book-pile-floor', { sides: [far, ...lat], prefer: 'corner', layer: 'dress', why: 'books heaped in a corner' }));
  ccmWallLights(ctx, ['sconce-candle-single', 'torch-sconce'], d ? [d.side] : lat, { every: 12, min: 1, max: 2, why: 'a light on the door wall' });
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
  ctx.cultInfo = { flavor: ctx.flavor, cases: cases.length, books: +(run / ((ctx.W + ctx.D) * 2)).toFixed(2), lectern: lect?.id || null };
  ccmDone(ctx);
  return { feature: key, what: `${lect ? 'the chained book on its lectern, ' : ''}${cases.length} bookcases along the walls`, approach: null, passage: true };
}

// ACOLYTES' QUARTERS (terminal): pallets heads to the wall down the long walls, one per 4.5 ft, a chest at each foot
// where there is room to walk past, robes on the door wall, one small table, a kneeling cushion or two. No arms.
function cultQuarters(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, long = ctx.longSides(), across = Math.min(ctx.W, ctx.D), Lr = Math.max(ctx.W, ctx.D), cells = ccmCells(ctx);
  const bedId = ccmFirst(ctx, cells >= 35 ? ['bunk-bed', 'bed-straw-pallet', 'bedroll'] : ['bed-straw-pallet', 'bedroll', 'bunk-bed']);
  if (!bedId) return { fail: 'acolytes\' quarters have no bed (no pallet or bunk mesh)' };
  const [, bd] = ccmSize(ctx, bedId), [, fd] = ccmSize(ctx, 'chest-plain');
  const both = across >= 2 * bd * 1.05 + 3.6, far1 = d && long.includes(OPP_SIDE[d.side]) ? OPP_SIDE[d.side] : long.find(s => !ctx.doorT[s].length) || long[0];
  const walls = both ? long : [far1], foot = across >= (both ? 2 : 1) * (bd + fd + 0.3) + 4.2, aisleO = both ? across / 2 : Math.min(across - 1.7, (bd + (foot ? fd + 0.5 : 0) + across) / 2);
  { const horiz = long[0] === 'N', [ax, az] = ctx.sidePoint(walls[0], Lr / 2, aisleO); ctx.mark(ax, az, horiz ? ctx.W : 3, horiz ? 3 : ctx.D, KEEP);
    for (const o of ctx.doors) { const pr = horiz ? [Math.max(ctx.X0 + 2, Math.min(ctx.X1 - 2, o.inner[0])), az] : [ax, Math.max(ctx.Z0 + 2, Math.min(ctx.Z1 - 2, o.inner[1]))]; ctx.mark((o.inner[0] + pr[0]) / 2, (o.inner[1] + pr[1]) / 2, Math.abs(o.inner[0] - pr[0]) + 3, Math.abs(o.inner[1] - pr[1]) + 3, KEEP); } }
  const beds = [];
  for (const side of walls) for (let t = 2.3; t <= Lr - 2.2; t += 4.5) {
    const b = ccmQuiet(ctx, () => ctx.put(bedId, (dm) => ctx.wallGen(dm, [side], { tRange: [t - 1.1, t + 1.1] }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'key-bed', why: 'a pallet, head to the wall, one per 4.5 ft', extra: { focal: true } }));
    if (!b) continue; beds.push(b);
    if (foot) { const [fx, fz] = front(b, 0.15 + fd / 2); castlePut(ctx, 'chest-plain', [fx, fz, b.rot], { layer: 'store', rule: 'companion', why: 'a chest at the foot of the pallet', extra: { with: b.uid } }); }
  }
  if (!beds.length) return { fail: 'acolytes\' quarters have no bed (no wall run clear of the doors)' };
  if (d) beds.sort((a, b) => Math.hypot(a.x - d.inner[0], a.z - d.inner[1]) - Math.hypot(b.x - d.inner[0], b.z - d.inner[1])); // (the nearest bed is the one seen from the door)
  ctx.focal = { label: 'pallets', id: beds[0].id, ok: true };
  { const ends = [ctx.sidePoint(walls[0], 2.5, aisleO), ctx.sidePoint(walls[0], Lr - 2.5, aisleO)];
    if (d) { ccmWalk(ctx, 'aisle', [d.inner, ends[0]]); ccmWalk(ctx, 'aisle', [d.inner, ends[1]]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, ctx.sidePoint(walls[0], Lr / 2, aisleO)]); } }
  if (d) { ctx.sight = [d.inner, [beds[0].x, beds[0].z]]; ctx.sightFeature = beds[0].id; }
  const dw = d ? [d.side, ...ctx.shortSides().filter(s => s !== d.side)] : ctx.shortSides();
  for (let i = 0, m = cells >= 20 ? 2 : 1; i < m; i++) ccmQuiet(ctx, () => ctx.mount('robe-rack', { sides: [dw[i % dw.length]], height: 4.2, layer: 'furnish', why: 'robes on a peg rail by the door' }));
  cultTable(ctx, dw, d?.inner, ['candle-black', 'chalice-dark', 'bowl-clay', 'rite-hooded-robe-folded'], 'a small table against the end wall');
  for (const b of beds.filter((_, i) => i % 3 === 1)) ccmQuiet(ctx, () => ctx.companion(b, 'rite-kneeler-cushion', { why: 'a kneeling cushion by the pallet', layer: 'dress', maxDist: 3 }));
  ccmWallLights(ctx, ['sconce-candle-single', 'torch-sconce'], dw, { every: 12, min: 1, max: 2, why: 'a light on the end wall' });
  ccmEnsureLight(ctx, CULT_TORCH, ['candlestick-floor', ...CULT_STAND]);
  ctx.cultInfo = { flavor: ctx.flavor, beds: beds.length };
  if (beds.length > 2) ctx.growth.push(`pallets repeat: ${beds.length} along the wall${walls.length > 1 ? 's' : ''}`);
  ccmDone(ctx);
  return { feature: beds[0], what: `${beds.length} ${bedId === 'bunk-bed' ? 'bunks' : 'pallets'} heads to the wall`, approach: null, passage: true };
}

// INNER SANCTUM (terminal, one door, the reward room): the idol on the wall facing the door, the offering bowl before
// it on the sigil, a standing light each side, treasure at the walls
function cultVault(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), cells = ccmCells(ctx);
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), toDoor = SIDES[far].rot;
  let idol = flavorHas(ctx, 'flavor-idol') && deep >= 12 ? ccmFocalOn(ctx, far, ['flavor-idol'], { label: 'idol', rule: 'key-idol', gap: 0.3, why: `the ${ctx.flavor} idol: centred on the wall facing the door` }) : null;
  if (!idol) idol = ccmFocalOn(ctx, far, ['altar-sacrificial', 'statue-hooded', 'pedestal-display'], { label: 'shrine', rule: 'key-idol', gap: 0.4, why: 'the shrine: centred on the wall facing the door' });
  if (!idol) idol = ccmCentre(ctx, ['pedestal-display', 'statue-hooded'], { label: 'shrine', rule: 'key-idol', rot: toDoor, why: 'the shrine: in the middle of the room' });
  if (!idol) return { fail: 'inner sanctum has no idol or shrine' };
  if (idol.id === 'altar-sacrificial' && flavorHas(ctx, 'flavor-altarpiece')) ccmOn(ctx, 'flavor-altarpiece', idol, 0, 0, `the ${ctx.flavor} altar-piece on the altar`);
  if (idol.id === 'pedestal-display') ccmOn(ctx, ccmFirst(ctx, flavorHas(ctx, 'flavor-altarpiece') ? ['flavor-altarpiece'] : ['tome-grimoire', 'chalice-dark']), idol, 0, 0, 'on the pedestal');
  if (d) { ctx.sight = [d.inner, [idol.x, idol.z]]; ctx.sightFeature = idol.id; }
  const frontS = cultS(ctx, far, idol) + idol.dims[2] / 2;
  const roomC = Math.min(L - 3, deep - frontS - 3.5), circ = roomC >= 4 && flavorHas(ctx, 'flavor-sigil') ? cultFlat(ctx, 'flavor-sigil', ...axis(frontS + 0.6 + Math.min(roomC, ccmSize(ctx, 'flavor-sigil')[0] * 0.75) / 2), toDoor, { k: Math.min(0.75, roomC / ccmSize(ctx, 'flavor-sigil')[0]), why: `the ${ctx.flavor} sigil on the floor before the idol` }) : null;
  const bowl = ccmHas(ctx, 'cauldron-bronze-ritual') && deep - frontS >= 6.5 ? castlePut(ctx, 'cauldron-bronze-ritual', [1.0, 1.4].map(e => [...axis(frontS + e + ccmSize(ctx, 'cauldron-bronze-ritual')[1] / 2), toDoor]), { layer: 'store', rule: 'offering', why: 'the offering bowl before the idol' }) : null;
  cultWalks(ctx, bowl ? front(bowl, 1.6) : front(idol, 1.8));
  for (const sg of [-1, 1]) { const id = cultCenser(ctx); if (id) castlePut(ctx, id, [1.0, 1.4, 1.8].map(e => [...axis(Math.max(1.2, frontS - 1), L / 2 + sg * (idol.dims[0] / 2 + e)), toDoor]), { layer: 'light', rule: 'flank', why: 'a standing light each side of the idol' }); }
  const cs = lat[ctx.ri(0, 1)];
  ccmCorner(ctx, 'chest-treasure', [d ? d.side : far, cs], { why: 'the hoard: an open chest in the corner', layer: 'store', inset: 0.6 });
  ccmAlong(ctx, ['chest-ironbound', 'chest-plain'], lat, Math.max(1, Math.min(3, Math.round(cells / 8))), { why: 'a chest against the side wall', layer: 'store' });
  if (cells >= 12) for (const s of lat) { const p = ccmQuiet(ctx, () => ctx.put('pedestal-display', (dm) => ctx.wallGen(dm, [s]), (c) => Math.abs(c.t - ctx.sideLen(s) * 0.5), { rule: 'display', why: 'a pedestal against the side wall' })); if (p) ccmOn(ctx, ccmAny(ctx, ['tome-grimoire', 'chalice-dark', 'dagger-ritual', 'candle-cluster', 'casket-ornate']), p, 0, 0, 'on the pedestal'); }
  if (cells >= 20) lat.forEach((s, i) => i === 0 && flavorHas(ctx, 'flavor-sculpture') ? ccmCorner(ctx, 'flavor-sculpture', [far, s], { why: `a ${ctx.flavor} sculpture in the far corner`, layer: 'anchor', inset: 0.4 }) : ccmCorner(ctx, ccmFirst(ctx, CULT_BRAZIER), [far, s], { why: 'a fire bowl in the far corner', layer: 'light', inset: 0.5 }));
  cultHang(ctx, lat, cells >= 16 ? 2 : 1);
  if (d) ccmWallLights(ctx, CULT_TORCH, [d.side], { every: 14, max: 2, why: 'torch on the door wall' });
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
  ctx.cultInfo = { flavor: ctx.flavor, idol: idol.id, sigil: !!circ, bowl: !!bowl };
  ccmDone(ctx);
  return { feature: idol, what: `${idol.id === 'flavor-idol' ? `the ${ctx.flavor} idol` : 'a shrine'} facing the door${bowl ? ', the offering bowl before it' : ''}`, approach: null, passage: true };
}

// HIDDEN ENTRANCE (a through-way dressed as a cellar store): barrels, crates and sacks thin along the walls, one set of
// shelves, a lantern: nothing of the cult shows. The way on is the bookcase (walls.js DOORS), a trapdoor sometimes.
function cultEntry(ctx) {
  cultStart(ctx);
  const d = ctx.mainDoor, cells = ccmCells(ctx), sides = ['N', 'S', 'E', 'W'], cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  ctx.mark(cx, cz, 3, 3, KEEP);
  if (d) { ccmWalk(ctx, 'through', [d.inner, [cx, cz]]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'through', [d.inner, [cx, cz], o.inner]); }
  const plain = sides.filter(s => !ctx.doorT[s].length), walls = plain.length ? plain : sides, stuff = [];
  const shelf = ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['shelving-freestanding', 'cupboard']), { sides: walls, layer: 'anchor', rule: 'key-store', why: 'store shelves against the wall: an ordinary cellar', extra: { focal: true } }));
  if (shelf) stuff.push(shelf);
  for (let i = 0, n = Math.max(3, Math.min(8, Math.round(cells / 2))); i < n; i++) { const p = ccmQuiet(ctx, () => ctx.wall(ccmAny(ctx, i % 3 === 2 ? ['sack', 'crate'] : i % 3 ? ['crate', 'barrel'] : ['barrel', 'crate']), { sides: ctx.shuffle(walls), prefer: i < 3 ? 'corner' : 'random', layer: 'store', why: 'stores against the wall' })); if (p) stuff.push(p); }
  if (!stuff.length) return { fail: 'hidden entrance has nothing of a cellar in it (no barrel, crate or shelf fits)' };
  ctx.focal = { label: 'cellar stores', id: stuff[0].id, ok: true };
  if (ccmHas(ctx, 'floor-trapdoor') && cells >= 12 && ctx.chance(0.35)) ccmQuiet(ctx, () => ccmAt(ctx, 'floor-trapdoor', [cx + (ctx.chance(0.5) ? 2.6 : -2.6), cz + (ctx.chance(0.5) ? 2.6 : -2.6), 0].length ? [[ctx.X0 + 2.5 + Math.floor(ctx.r(0, (ctx.W - 5) / 5)) * 5, ctx.Z0 + 2.5 + Math.floor(ctx.r(0, (ctx.D - 5) / 5)) * 5, 0]] : [], { layer: 'anchor', rule: 'trapdoor', why: 'a trapdoor in the floor: another way down' }));
  if (ccmHas(ctx, 'rug-small') && ctx.chance(0.4)) ccmQuiet(ctx, () => ctx.rug('rug-small', { why: 'an old rug' }));
  if (ccmHas(ctx, 'decal-cobweb')) ccmQuiet(ctx, () => ctx.mount('decal-cobweb', { height: 7.8, why: 'cobwebs up by the ceiling' }));
  ccmQuiet(ctx, () => ctx.ceiling('lantern-hanging', { at: [cx, cz], why: 'a lantern over the middle of the cellar' }));
  ccmWallLights(ctx, CULT_TORCH, d ? [d.side] : walls, { every: 16, min: 1, max: 1, why: 'a torch by the door' });
  ccmEnsureLight(ctx, CULT_TORCH, ['candlestick-floor']);
  ctx.cultInfo = { flavor: ctx.flavor, stores: stuff.length };
  ccmDone(ctx);
  return { feature: stuff[0], what: `a cellar store (${stuff.length} things at the walls); the way on is hidden`, approach: null, passage: true };
}

// the leg of an L-shaped sanctum room (ccmAnnex): walls, lights, the flavor on the walls; never a second key piece
function cultAnnex(ctx, { wall = [], hang = 2, seats = false, lights = CULT_TORCH } = {}) {
  withFlavor(ctx, CULT_FLAVORS, { 'decal-ritual-circle': 'plain' });
  const sides = ['N', 'S', 'E', 'W'], n = Math.max(1, Math.round(ctx.area() / 120));
  if (wall.length) ccmAlong(ctx, wall, ctx.shuffle(sides), n, { why: 'against the wall', layer: 'store' });
  if (seats) ccmAlong(ctx, ['bench-stone', 'bench-long'], ctx.longSides(), Math.max(1, Math.min(3, Math.round(Math.max(ctx.W, ctx.D) / 10))), { why: 'a bench along the wall' });
  if (hang) cultHang(ctx, ctx.shuffle(sides), hang);
  ccmWallLights(ctx, lights, ctx.shuffle(sides), { every: 26, min: 1, why: 'wall torch' });
  ccmEnsureLight(ctx, CULT_TORCH, CULT_STAND);
}

// ---- cult sanctum: hooks into the dispatcher ----
Object.assign(MENUS, {
  'cult-entry': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['barrel', 'crate', 'sack'], hang: 0 })),
  'cult-passage': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['brazier-standing'], hang: 2 })),
  'cult-sanctum': ccmAnnex((ctx) => cultAnnex(ctx, { seats: true, hang: 2 })),
  'cult-summoning': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['pedestal-display'], hang: 1 })),
  'cult-cells': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['bucket-slop', 'bed-straw-pallet'], hang: 0 })),
  'cult-vestry': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['chest-plain'], seats: true, hang: 0, lights: ['sconce-candle-single', 'torch-sconce'] })),
  'cult-library': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['shelving-freestanding', 'book-pile-floor'], hang: 0, lights: ['sconce-candle-single', 'torch-sconce'] })),
  'cult-quarters': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['chest-plain'], hang: 0, lights: ['sconce-candle-single', 'torch-sconce'] })),
  'cult-vault': ccmAnnex((ctx) => cultAnnex(ctx, { wall: ['chest-ironbound', 'chest-plain'], hang: 1 })),
});
Object.assign(KEY, { 'cult-entry': cultEntry, 'cult-passage': cultPassage, 'cult-sanctum': cultSanctum, 'cult-summoning': cultSummoning, 'cult-cells': cultCells,
  'cult-vestry': cultVestry, 'cult-library': cultLibrary, 'cult-quarters': cultQuarters, 'cult-vault': cultVault });
Object.assign(DENSITY, { 'cult-entry': 3.5, 'cult-passage': 3.5, 'cult-sanctum': 4, 'cult-summoning': 4, 'cult-cells': 3.5, 'cult-vestry': 4.5, 'cult-library': 5, 'cult-quarters': 4.5, 'cult-vault': 4.5 }); // (none under 3.5: test/yard.test.mjs holds the yard's 2 to 0.6x of every indoor target)
Object.assign(FOCAL, { 'cult-sanctum': 'altar slab (before the idol, on the end wall)', 'cult-summoning': 'ritual circle (in the middle of the floor)', 'cult-vault': 'idol (on the wall facing the door)', 'cult-library': 'the chained book on its lectern', 'cult-cells': 'cages (in a row facing the door)', 'cult-vestry': 'rail of robes' });
Object.assign(KEY_RE, { 'cult-entry': /^(shelving-freestanding|cupboard|barrel|crate|sack)$/, 'cult-passage': null, 'cult-sanctum': /^(altar-sacrificial|altar-stone)$/, 'cult-summoning': /^(rite-sigil-stone|portal-arch|decal-ritual-circle|flavor-sigil)$/,
  'cult-cells': /^(cage-sacrifice|cage-floor)$/, 'cult-vestry': /^(robe-stand|robe-rack|wardrobe)$/, 'cult-library': /^(spellbook-lectern|lectern|bookshelf|bookcase-ladder|shelving-freestanding)$/, 'cult-quarters': /^(bed-straw-pallet|bunk-bed|bedroll)$/,
  'cult-vault': /^(flavor-idol|altar-sacrificial|statue-hooded|pedestal-display)$/ });
// <<< types:clt.solver2
