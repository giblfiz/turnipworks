// ======================= castle / crypt / mansion (2026-10-05) =======================
// One appended block; nothing above it changes. Each new room type is ONE self-contained program, KEY[key](ctx): it lays
// the whole room (the focal piece first, then its own walking lines, then walls, lights and dressing to its own count)
// and returns the usual key-purpose record with `approach: null`, so attempt() adds no walk of its own (as the stacked
// storeroom does) and `passage: true`, the flag for "my doors are already joined" (no branch walks added after the
// furniture is down). It ends with ccmDone(ctx): attempt()'s generic density fill draws from the recipe's slots, and would
// stand a second altar against a wall as "edge dressing".
//   HOOK INTO THE DISPATCHER: `KEY['<room key>'] = program` (attempt(): `(KEY[key] || ...)(ctx)`), plus one line each in
//   DENSITY (the target finish() reports against), FOCAL (the docs table) and KEY_RE (audit(): which piece proves the
//   room's purpose). Roles, doors, windows and wall panels are registered in walls.js; v1 runs PROGRAMS.generic.
// Frame used by every program: `far` = the wall the focal piece stands on (normally the one facing the main door);
// t = feet along that wall, s = feet out from it into the room; ctx.sidePoint(far, t, s) is the world point.

// PROGRAM_OF: a room type that IS an inn room in other walls (the castle kitchen, the mansion's kitchen and wine cellar)
// runs the inn's program whole: attempt() reads `PROGRAM_OF[type.key] || type.key` for KEY / MENUS / the kitchen fill.
// Its role, density target and audit line are still registered under its own key.
const PROGRAM_OF = {};

const ccmHas = (ctx, id) => !!id && ctx.has(id) && ctx.skuPool(id).length > 0;
const ccmFirst = (ctx, ids) => ids.find(id => ccmHas(ctx, id)) || null;                       // in order of preference
const ccmAny = (ctx, ids) => ctx.pick(ids.filter(id => ccmHas(ctx, id)))[0] || null;           // variety
const ccmQuiet = (ctx, fn) => { const u = ctx.unplaced.length, r = fn(); ctx.unplaced.length = u; return r; }; // an optional wish: its miss is not news
const ccmCount = (ctx) => ctx.placements.filter(p => p.orient !== 'floor').length;
const ccmCells = (ctx) => ctx.room.w * ctx.room.d;
const ccmSize = (ctx, id) => (ctx.lib.objects[id]?.size || [24, 24, 24]).map(v => v / 12);     // catalog w, d, h in feet (for laying out before a sku is rolled)
const ccmLat = (side) => side === 'N' || side === 'S' ? ['W', 'E'] : ['N', 'S'];              // the two walls beside a wall
// ONE placement at `k` times the size it ships at, held inside the catalog's allowed scale range for the role (o.scale x
// the catalog box): a heap of skulls that is the room's focal piece, not one more heap by the wall
function ccmScaled(ctx, id, k, fn) {
  const o = ctx.lib.objects[id]; if (!o || k === 1) return fn();
  const d0 = ctx.dims;
  ctx.dims = function (i, sku) {
    const dm = d0.call(this, i, sku); if (i !== id || !dm.s) return dm;
    const cat = Math.max(...o.size) / 12, big = Math.max(dm.w, dm.d, dm.h), f = Math.max(o.scale[0] * cat, Math.min(o.scale[1] * cat, big * k)) / big;
    return { ...dm, w: dm.w * f, d: dm.d * f, h: dm.h * f, s: dm.s.map(v => v * f) };
  };
  try { return fn(); } finally { delete ctx.dims; }
}
function ccmDone(ctx) { ctx.slot = () => []; ctx.ccmComplete = true; } // the room is complete: nothing is left for the generic density fill or the zone lights

// ANNEX: a shaped room (an L, a U: engine/core/roomgen.js) is solved as rectangles; the largest is "the room" and runs
// its KEY program, each other one is solved with args.annex and attempt() runs NO key program there, only the type's
// zone menu and the generic density fill. For the new types that fill would be wrong (its pool is the recipe's slots,
// anchors included: a second altar in the L's leg), so each gets ONE menu entry, MENUS[key] = ccmAnnex(fn): it runs
// only where the key program did not, dresses the leg with fn(ctx) (wall things and lights, never the key piece) and
// closes the generic fill. HOOK: `MENUS['<room key>'] = ccmAnnex((ctx) => { ... })`.
const ccmAnnex = (fn) => [{ kind: 'annex', label: 'the rest of the room', size: [1, 1], minArea: 0, repeat: 1, quiet: true, when: (ctx) => !ctx.ccmComplete,
  pref: (ctx, r) => Math.min(Math.hypot(r[0] - ctx.X0, r[1] - ctx.Z0), Math.hypot(ctx.X1 - r[2], ctx.Z1 - r[3])), // (its 1-ft marker sits in a corner, out of every path)
  fill: (ctx) => { ccmPanels(ctx); fn(ctx); ccmDone(ctx); } }];

// special wall panels (walls.js PANELS: burial niches, bone walls, stained glass) behave like windows for furniture:
// nothing tall stands in front of them, nothing hangs on them; low things (a coffin, a bench, a trough) may
function ccmPanels(ctx) {
  ctx.panelT = { N: [], S: [], E: [], W: [] };
  for (const o of ctx.room.panels || []) { // (walls.js specialPanels; sides and indexes are the room's own)
    const r = [Math.max(0, o.index * CELL - INSET), Math.min(ctx.sideLen(o.side), (o.index + 1) * CELL - INSET)];
    ctx.panelT[o.side].push(r); ctx.windowT[o.side].push(r); ctx.mounts[o.side].push([...r]);
  }
  return Object.values(ctx.panelT).reduce((n, a) => n + a.length, 0);
}
// which wall carries the focal piece: the one facing the main door; `shortEnd` rooms (a chapel, a throne room) take the
// short wall farther from the door when the door came out on a long wall of a clearly oblong room (a side porch)
function ccmFar(ctx, { shortEnd = false } = {}) {
  const d = ctx.mainDoor;
  if (!d) return ctx.shortSides()[0];
  if (shortEnd && Math.max(ctx.W, ctx.D) / Math.min(ctx.W, ctx.D) > 1.3 && ctx.longSides().includes(d.side)) {
    const [a, b] = ctx.shortSides(), da = Math.hypot(...ctx.sidePoint(a, ctx.sideLen(a) / 2, 0).map((v, i) => v - d.at[i])), db = Math.hypot(...ctx.sidePoint(b, ctx.sideLen(b) / 2, 0).map((v, i) => v - d.at[i]));
    return da >= db ? a : b;
  }
  return OPP_SIDE[d.side];
}
// one thing at one exact spot (with a few fallback spots): a kit of parts laid by measurement, not by search
function ccmAt(ctx, id, spots, o = {}) {
  if (!ccmHas(ctx, id)) return null;
  const list = Array.isArray(spots[0]) ? spots : [spots];
  return ctx.put(id, () => list.map(([x, z, rot], i) => ({ x, z, rot, i })), (c) => c.i, { layer: o.layer || 'furnish', rule: o.rule || 'placed', why: o.why || '', allowKeep: !!o.allowKeep, zone: o.zone || null, extra: o.extra || {}, failWhy: o.failWhy || 'no room at its spot', unique: !!o.unique, sku: o.sku });
}
// the focal piece, centred on wall `far`, `gap` ft off it, facing the room (Principle 8); returns the placement or null
function ccmFocalOn(ctx, far, ids, { label, rule = 'key-focal', why = '', gap = 0.05, slack = 0.5, layer = 'anchor', strict = false } = {}) {
  const L = ctx.sideLen(far);
  for (const id of ids) {
    if (!ccmHas(ctx, id)) continue;
    // (a window or a special panel in the way: centring wins, as focalPlace() has it; the plain wall is tried first)
    for (const windows of strict ? [true] : [true, false]) {
      const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap, tRange: [L / 2 - slack, L / 2 + slack], step: 0.25, windows }), (c) => Math.abs(c.t - L / 2), { layer, rule, unique: true, why: why || `${label}: centred on the ${SIDE_LABEL[far]} wall, facing the room (axial focal)`, extra: { focal: true } }));
      if (p) { ctx.focal = { label, id: p.id, side: far, ok: true }; return p; }
    }
  }
  ctx.focal = { label, ok: false, why: ctx.doorT[far].length ? `a door in the middle of the ${SIDE_LABEL[far]} wall` : `nothing fits centred on the ${SIDE_LABEL[far]} wall` };
  return null;
}
// the focal piece in the middle of the floor (a tomb, a slab, a shrine in a bigger room), turned by `rot`
function ccmCentre(ctx, ids, { label, rot = 0, rule = 'key-focal', why = '', off = [0, 0], layer = 'anchor' } = {}) {
  const cx = (ctx.X0 + ctx.X1) / 2 + off[0], cz = (ctx.Z0 + ctx.Z1) / 2 + off[1];
  for (const id of ids) {
    if (!ccmHas(ctx, id)) continue;
    const p = ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (let r = 0; r <= 3; r += 0.5) for (const [ux, uz] of r ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]]) yield { x: cx + ux * r, z: cz + uz * r, rot, r }; }, (c) => c.r, { layer, rule, unique: true, why: why || `${label}: in the middle of the floor`, extra: { focal: true } }));
    if (p) { ctx.focal = { label, id: p.id, ok: true, centre: true }; return p; }
  }
  return null;
}
// a mirrored pair, one each side of a piece (braziers by a monument, candle stands by an altar); `off` ft clear of it
function ccmFlank(ctx, p, ids, { off = 1.5, why = '', layer = 'light', rule = 'flank', fwd = 0, n = 2 } = {}) {
  const [fx, fz] = ctx.facingVec(p.rot), lx = fz, lz = -fx, out = [];
  for (const sgn of [1, -1].slice(0, n)) {
    const id = ccmFirst(ctx, ids); if (!id) break;
    const q = ccmQuiet(ctx, () => ctx.put(id, function* (dm) {
      for (const e of [0, 0.5, 1, -0.5, 1.5, 2]) { const lat = p.dims[0] / 2 + off + e + dm.w / 2, along = fwd - (p.dims[2] - dm.d) / 2; yield { x: p.x + lx * lat * sgn + fx * along, z: p.z + lz * lat * sgn + fz * along, rot: p.rot, e }; }
    }, (c) => Math.abs(c.e), { layer, rule, why: why || `one each side of the ${p.id}`, extra: { with: p.uid } }));
    if (q) out.push(q);
  }
  return out;
}
// `n` of something spread along walls, backs to the wall, taking the sides in turn (benches along the side walls)
function ccmAlong(ctx, ids, sides, n, { why = '', layer = 'furnish', rule = 'wall-run', gap = 0.05 } = {}) {
  const out = [], per = Math.ceil(n / Math.max(1, sides.length));
  for (let k = 0; k < n; k++) {
    const side = sides[k % sides.length], L = ctx.sideLen(side), t = L * (Math.floor(k / sides.length) + 0.5) / per, id = ccmAny(ctx, ids);
    if (!id) break;
    const p = ccmQuiet(ctx, () => isHung(ctx.lib.objects[id], id) ? ctx.mount(id, { sides: [side], layer, why }) : ctx.put(id, (dm) => ctx.wallGen(dm, [side], { gap }), (c) => Math.abs(c.t - t), { layer, rule, why: why || `along the ${SIDE_LABEL[side]} wall` }));
    if (p) out.push(p);
  }
  return out;
}
// a long low thing lying ALONG a wall, its side to the wall (a coffin, wrapped remains): its catalog box has the long side as depth
function ccmLieAlong(ctx, id, sides, { why = '', layer = 'furnish', rule = 'along-wall', near = null, gap = 0.1 } = {}) {
  if (!ccmHas(ctx, id)) return null;
  return ccmQuiet(ctx, () => ctx.put(id, function* (dm) {
    for (const side of sides) {
      const rot = SIDES[side].rot + Math.PI / 2, [aw, ad] = ctx.aabb(dm.w, dm.d, rot), L = ctx.sideLen(side);
      const along = side === 'N' || side === 'S' ? aw : ad, depth = side === 'N' || side === 'S' ? ad : aw;
      for (let t = along / 2 + 0.2; t <= L - along / 2 - 0.2 + 1e-6; t += 0.5) {
        if (ctx.overlapsT(ctx.doorT[side], t - along / 2 - 0.3, t + along / 2 + 0.3)) continue;
        const [x, z] = ctx.sidePoint(side, t, depth / 2 + gap);
        yield { x, z, rot, side, t };
      }
    }
  }, (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 10, { layer, rule, why: why || 'lying along the wall' }));
}
// something small in a corner of the room (an urn in each corner of the door wall); corner = [wallA, wallB]
function ccmCorner(ctx, id, [a, b], { why = '', layer = 'furnish', inset = 0.3, rot = null, sku } = {}) {
  if (!ccmHas(ctx, id)) return null;
  const [w, d] = ccmSize(ctx, id), m = Math.max(w, d) / 2 + inset;
  const x = [a, b].includes('W') ? ctx.X0 + m : [a, b].includes('E') ? ctx.X1 - m : null, z = [a, b].includes('N') ? ctx.Z0 + m : [a, b].includes('S') ? ctx.Z1 - m : null;
  if (x === null || z === null) return null;
  const r = rot ?? Math.atan2((ctx.X0 + ctx.X1) / 2 - x, (ctx.Z0 + ctx.Z1) / 2 - z); // facing the middle of the room
  return ccmQuiet(ctx, () => ccmAt(ctx, id, [[x, z, r], [x + Math.sign((ctx.X0 + ctx.X1) / 2 - x) * 0.5, z + Math.sign((ctx.Z0 + ctx.Z1) / 2 - z) * 0.5, r]], { layer, rule: 'corner', why: why || 'in the corner', sku }));
}
// wall lights: one about every `every` ft of the given walls, taking the sides in turn; never on a door, a window or a
// special panel (the panels are booked in ctx.mounts). Returns how many hung.
function ccmWallLights(ctx, ids, sides, { every = 11, height = 6, why = '', min = 1, max = 12 } = {}) {
  const total = sides.reduce((a, s) => a + ctx.sideLen(s), 0), n = Math.max(min, Math.min(max, Math.round(total / every)));
  let hung = 0;
  for (let k = 0; k < n; k++) { const id = ccmAny(ctx, ids); if (!id) break; if (ccmQuiet(ctx, () => ctx.mount(id, { sides: [sides[k % sides.length]], height, layer: 'light', rule: 'wall-light', why: why || 'wall light' }))) hung++; }
  return hung;
}
// a room with no windows must have a light: if nothing lit was placed, hang or stand one wherever it fits
const ccmLit = (ctx) => ctx.placements.filter(p => p.layer === 'light').length;
function ccmEnsureLight(ctx, wallIds, floorIds) {
  if (ccmLit(ctx)) return;
  for (const id of wallIds) if (ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.mount(id, { height: 6, layer: 'light', rule: 'wall-light', why: 'the one light a windowless room must have' }))) return;
  for (const id of floorIds) if (ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.wall(id, { layer: 'light', prefer: 'corner', why: 'the one light a windowless room must have', allowKeep: true }))) return;
  ctx.notes.push('no light could be placed in a room with no windows');
}
// RANKS: rows of one kind of thing across the room, in two blocks either side of a centre aisle on the focal axis
// (chapel benches facing the altar, tombs lying across a vault, armour stands in an armoury). Rows run from s0 to s1
// (ft out from the `far` wall), `gap` ft apart; a room too narrow for two blocks gets one centred column.
//   turn   0 = facing the far wall, PI = facing away from it, PI / 2 = lying across the axis
//   choose (row, col, n) -> id (or null to leave the place empty); limit = at most this many pieces
function ccmRanks(ctx, { far, s0, s1, gap, aisle = 4, margin = 0.6, turn = 0, choose, limit = 99, proto, layer = 'furnish', rule = 'rank', why = '' }) {
  const L = ctx.sideLen(far), rot = SIDES[OPP_SIDE[far]].rot + turn, [cw, cd] = ccmSize(ctx, proto);
  const across = Math.abs(Math.sin(turn)) > 0.5, alongT = across ? cd : cw, alongS = across ? cw : cd;
  const blockW = (L - aisle) / 2 - margin, per = Math.floor((blockW + 0.4) / (alongT + 0.4));
  const cols = [];
  if (per >= 1) for (const sgn of [-1, 1]) for (let i = 0; i < per; i++) cols.push(L / 2 + sgn * (aisle / 2 + alongT / 2 + i * (alongT + 0.4)));
  else if (L - alongT >= 5.5) cols.push(L / 2); // one column down the middle, a walkway each side
  const out = []; let row = 0;
  for (let s = s0 + alongS / 2; s + alongS / 2 <= s1 + 1e-6 && out.length < limit; s += alongS + gap, row++) {
    cols.forEach((t, col) => {
      if (out.length >= limit) return;
      const id = choose(row, col, out.length); if (!id || !ccmHas(ctx, id)) return;
      const [x, z] = ctx.sidePoint(far, t, s);
      const p = ccmQuiet(ctx, () => ccmAt(ctx, id, [x, z, rot], { layer, rule, why: why || `rank ${row + 1}` }));
      if (p) { p.rank = [row, col]; out.push(p); }
    });
  }
  return { placed: out, rows: row, cols: cols.length, single: per < 1 };
}
// a thing set ON a piece that is not one of the solver's surfaces (a skull on a tomb lid, cloth and candles on an altar):
// fx = fraction of the piece's width from its centre (-0.5 .. 0.5), fz = of its depth
function ccmOn(ctx, id, surf, fx, fz, why, layer = 'dress') {
  if (!surf || !ccmHas(ctx, id)) return null;
  const c = Math.cos(surf.rot), s = Math.sin(surf.rot), lx = fx * surf.dims[0], lz = fz * surf.dims[2];
  return surfaceAt(ctx, id, surf, surf.x + c * lx + s * lz, surf.z - s * lx + c * lz, why, layer);
}
// a walking line, reserved; a hop of under 4 ft needs none (walk() calls a path under 3 ft blocked)
function ccmWalk(ctx, kind, pts, o = {}) {
  const far = pts.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  if (far < 4) return null;
  const p = ctx.walk(kind, pts, o);
  if (p && !p.ok && p.len > 0 && p.len < 3) { ctx.paths.pop(); return null; } // found, but shorter than walk() counts as a path
  return p;
}
// keep standing room clear round a piece (a slab you work at from both sides, a tomb you walk round)
function ccmClearRound(ctx, p, m) { const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot); ctx.mark(p.x, p.z, aw + 2 * m, ad + 2 * m, KEEP); }

// ---------------- chapel (shared: the crypt's chapel of rest, the castle chapel) ----------------
// An axial focal (the altar on the end wall, on a dais where the type has one), a centre aisle on its axis, ranks of
// seats facing it, and whatever lies in state before it. cfg names the pieces; every list is in order of preference.
function chapel(ctx, cfg) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx);
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), toDoor = SIDES[far].rot, lat = ccmLat(far);
  // the dais first (castle), the altar on it; else the altar `altarGap` ft off the wall
  const dais = cfg.dais ? ccmFocalOn(ctx, far, cfg.dais, { label: 'dais', rule: 'key-dais', why: 'dais: centred on the end wall' }) : null;
  let altar;
  if (dais) { // the dais is a low platform: the altar stands ON it, its long side to the room
    const id = ccmFirst(ctx, cfg.altar), sk = id && ctx.chooseSku(id);
    if (sk) { const dm = ctx.dims(id, sk), [x, z] = axis(Math.min(cfg.altarGap ?? 3, dais.dims[2] - dm.d) + dm.d / 2); altar = ctx.record(id, sk, dm, x, dais.dims[1], z, toDoor, 'anchor', 'key-altar', 'altar: on the dais, long side to the room', { focal: true, on: dais.uid, side: far }); ctx.focal = { label: 'altar', id, side: far, ok: true }; }
  } else altar = ccmFocalOn(ctx, far, cfg.altar, { label: 'altar', rule: 'key-altar', gap: cfg.altarGap ?? 1.5, why: 'altar: centred on the end wall, facing down the aisle (axial focal)' });
  if (!altar) return { fail: `${ctx.type.label.toLowerCase()} has no altar (${ctx.focal?.why || 'no altar mesh'})` };
  if (d) { ctx.sight = [d.inner, [altar.x, altar.z]]; ctx.sightFeature = altar.id; }
  const base = dais || altar, frontS = (cfg.dais ? base.dims[2] : (cfg.altarGap ?? 1.5) + altar.dims[2]) + 0.05; // where the open floor starts
  // what lies in state before the altar (crypt): on the centre line, long axis on the axis; dropped in a small chapel.
  // Seats start `afterBier` ft behind it; a chapel too short for two rows there seats its mourners EITHER SIDE of the
  // bier instead (the aisle widens to hold it), starting `firstRow` ft from the altar.
  let bier = null, rowsFrom = frontS + (cfg.firstRow ?? 6), aisle = cfg.aisle ?? 4, margin = 0.6;
  // the seat: the first of cfg.seats that fits a block beside the aisle (a pew is 8 ft; a narrow chapel takes the stone bench)
  const seatFor = (a, m = 0.6) => cfg.seats.filter(id => ccmHas(ctx, id)).find(id => ccmSize(ctx, id)[0] <= (L - a) / 2 - m + 0.01) || cfg.seats.filter(id => ccmHas(ctx, id)).sort((x, y) => ccmSize(ctx, x)[0] - ccmSize(ctx, y)[0])[0] || null;
  let seat0 = seatFor(cfg.aisle ?? 4); const seatD = seat0 ? ccmSize(ctx, seat0)[1] : 2, pitch = cfg.pitch ?? 3.5, backGap = cfg.backGap ?? 4;
  if (cfg.bier && cells >= (cfg.bierMinCells ?? 15)) {
    const id = cfg.bierRoll ? cfg.bierRoll(ctx) : ccmFirst(ctx, cfg.bier), [bw, bd] = ccmSize(ctx, id || cfg.bier[0]), off = cfg.bierOff ?? 3.5;
    if (id && frontS + off + bd + 3 < deep - 3) {
      bier = ccmQuiet(ctx, () => ccmAt(ctx, id, [...axis(frontS + off + bd / 2), toDoor], { layer: 'anchor', rule: 'key-bier', why: 'lying in state before the altar, on the centre line' }));
      if (bier) {
        if (cfg.onBier && bier.id !== 'rite-funeral-pall') { const on = cfg.onBier(ctx); if (on) ccmOn(ctx, on, bier, 0, 0, 'lying in state on the bier', 'dress'); }
        const [fx, fz] = ctx.facingVec(bier.rot), lx = fz, lz = -fx, cand = ccmAny(ctx, cfg.bierCandles || []);
        if (cand) for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ccmQuiet(ctx, () => ccmAt(ctx, cand, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1].map(e => [bier.x + lx * a * (bier.dims[0] / 2 + e) + fx * b * (bier.dims[2] / 2 - 0.3), bier.z + lz * a * (bier.dims[0] / 2 + e) + fz * b * (bier.dims[2] / 2 - 0.3), bier.rot]), { layer: 'light', rule: 'bier-candle', why: 'a tall candle at each corner of the bier' }));
        const behind = frontS + off + bd + (cfg.afterBier ?? 4);
        if (behind + seatD + pitch <= deep - backGap) rowsFrom = behind;
        else { rowsFrom = frontS + (cfg.firstRow ?? 4); aisle = Math.max(aisle, bier.dims[0] + 2 * 1.85); margin = 0.3; seat0 = seatFor(aisle, margin); { const sw = seat0 ? ccmSize(ctx, seat0)[0] : 0; if (sw > (L - aisle) / 2 - margin && L - 2 * (sw + margin) >= bier.dims[0] + 2 * 1.5) aisle = L - 2 * (sw + margin); } /* real meshes: a wide pall left 5.45 ft a side for a 5.5-ft bench; the walk beside the bier may narrow to 1.5 ft */ ctx.notes.push('too short for rows behind the bier: the seats stand either side of it'); }
      }
    }
  }
  // the aisle is kept clear on the axis before the seats go down (a strip exactly on the centre line), and the walk is
  // found: main door -> the door end of the aisle -> the foot of the bier (or the altar step); other doors join it.
  // (the bier's candles stand under 4.8 ft: nothing tall may cross the doorway's view of the altar, put() sees to that)
  const foot = bier ? front(bier, 2.4) : axis(Math.min(deep - 2, frontS + 2)), footS = bier ? frontS + (cfg.bierOff ?? 3.5) + bier.dims[2] + 0.5 : frontS;
  { const [ax, az] = axis((footS + deep) / 2), lenS = deep - footS, horiz = far === 'N' || far === 'S'; ctx.mark(ax, az, horiz ? 3 : lenS, horiz ? lenS : 3, KEEP); }
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, axis(deep - 2.5), foot], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(deep - 2.5)]); }
  // ranks of seats facing the altar, either side of the aisle, stopping short of the door wall
  const seat = seat0;
  const rowsTo = Math.min(deep - backGap, cfg.maxRows ? rowsFrom + cfg.maxRows * pitch - (pitch - seatD) + 0.01 : Infinity);
  const ranks = seat ? ccmRanks(ctx, { far, s0: rowsFrom, s1: rowsTo, gap: pitch - seatD, aisle, margin, turn: 0, proto: seat, choose: () => ccmAny(ctx, cfg.seatsMix || [seat]) || seat, rule: 'pew', why: 'seats in rows facing the altar, either side of the centre aisle' }) : { placed: [], rows: 0 };
  ctx.chapelInfo = { seats: ranks.placed.length, rows: ranks.rows, bier: bier?.id || null, dais: !!dais, far };
  if (ranks.placed.length) ctx.growth.push(`${ranks.placed.length} seats in ${ranks.rows} rows facing the altar`);
  // beside the altar
  if (cfg.altarFlank) ccmFlank(ctx, base, cfg.altarFlank, { off: 1.0, why: 'one each side of the altar' });
  if (cfg.corner && ctx.chance(cfg.cornerChance ?? 0.7)) ccmCorner(ctx, ccmAny(ctx, cfg.corner), [far, lat[ctx.ri(0, 1)]], { why: 'in a corner beside the altar', inset: 0.6 });
  if (cfg.endCorners) for (const s of lat) ccmCorner(ctx, ccmAny(ctx, cfg.endCorners), [far, s], { why: 'in the corner of the altar wall', sku: cfg.endCornerSku });
  // a long chapel: tombs lying along the side walls in the floor the capped rows leave free, toward the door
  if (cfg.sideTombs && rowsTo + 9 <= deep - 3) for (let k = 0, n = Math.min(cfg.sideTombMax ?? 4, 2 * Math.floor((deep - 3 - rowsTo - 2) / 10)); k < n; k++) { const s = lat[k % 2], id = ccmAny(ctx, cfg.sideTombs); if (id) ccmLieAlong(ctx, id, [s], { why: 'a tomb along the side wall, behind the seats', near: ctx.sidePoint(far, s === lat[0] ? 1.5 : L - 1.5, rowsTo + 6 + Math.floor(k / 2) * 10), layer: 'anchor', rule: 'side-tomb' }); }
  if (cfg.lectern && ccmHas(ctx, cfg.lectern)) { const [x, z] = axis(frontS + 1.2, L / 2 - altar.dims[0] / 2 - 2); ccmQuiet(ctx, () => ccmAt(ctx, cfg.lectern, [x, z, toDoor], { why: 'lectern beside the altar, turned to the seats' })); }
  // on the altar: a cloth, a candelabrum toward each end, one thing in the middle
  if (cfg.cloth && ccmHas(ctx, cfg.cloth)) ccmOn(ctx, cfg.cloth, altar, 0, 0, 'altar cloth');
  const stick = ccmFirst(ctx, cfg.altarLights || []);
  if (stick) for (const e of [-0.36, 0.36]) ccmOn(ctx, stick, altar, e, 0, 'on the altar, one toward each end', 'light');
  const mid = ccmAny(ctx, cfg.altarThings || []); if (mid) ccmOn(ctx, mid, altar, 0, 0.05, 'on the altar');
  if (bier && cfg.bierFoot) { const id = ccmAny(ctx, cfg.bierFoot), [x, z] = front(bier, 0.6); if (id) ccmQuiet(ctx, () => ccmAt(ctx, id, [x, z, bier.rot], { layer: 'dress', why: 'flowers at the foot of the bier', allowKeep: true })); }
  // overhead
  if (cfg.overAltar && ccmHas(ctx, cfg.overAltar)) ctx.ceiling(cfg.overAltar, { at: axis(frontS + 1), why: 'hangs before the altar' });
  if (bier && cfg.overBier && ccmHas(ctx, cfg.overBier)) ctx.ceiling(cfg.overBier, { at: [bier.x, bier.z], layer: 'dress', why: 'hangs over the bier' });
  // the side walls: memorials and candle sconces in turn; by the door: whatever the type keeps there
  const hang = Math.max(2, Math.min(cfg.hangMax ?? 4, Math.round(deep / 8)));
  for (let k = 0; k < hang; k++) { const id = ccmAny(ctx, cfg.hung || []); if (id) ccmQuiet(ctx, () => ctx.mount(id, { sides: [lat[k % 2]], height: 5.1, why: 'on the side wall' })); }
  if (cfg.sconces) ccmWallLights(ctx, cfg.sconces, lat, { every: 12, height: 5.6, why: 'candle sconce on the side wall', min: cells >= 30 ? 2 : 0 });
  if (cfg.doorWallLights && d) ccmWallLights(ctx, cfg.doorWallLights, [d.side], { every: 14, why: 'torch on the door wall', min: 1, max: 2 });
  for (const [id, minCells] of cfg.byDoor || []) if (cells >= minCells && ccmHas(ctx, id) && d) ccmQuiet(ctx, () => ctx.wall(id, { sides: [d.side, ...lat], prefer: 'near', near: d.inner, layer: /candle|tray|lamp/.test(id) ? 'light' : 'furnish', why: 'against the wall near the door' }));
  ccmEnsureLight(ctx, cfg.doorWallLights || ['torch-sconce'], ['candlestick-floor', 'candle-tree', 'candlestand-pricket']);
  ccmDone(ctx);
  return { feature: altar, what: `altar${bier ? ' and bier' : ''}, ${ranks.placed.length} seats facing it`, approach: null, passage: true };
}
