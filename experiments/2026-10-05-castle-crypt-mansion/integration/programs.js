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
function ccmCorner(ctx, id, [a, b], { why = '', layer = 'furnish', inset = 0.3, rot = null } = {}) {
  if (!ccmHas(ctx, id)) return null;
  const [w, d] = ccmSize(ctx, id), m = Math.max(w, d) / 2 + inset;
  const x = [a, b].includes('W') ? ctx.X0 + m : [a, b].includes('E') ? ctx.X1 - m : null, z = [a, b].includes('N') ? ctx.Z0 + m : [a, b].includes('S') ? ctx.Z1 - m : null;
  if (x === null || z === null) return null;
  const r = rot ?? Math.atan2((ctx.X0 + ctx.X1) / 2 - x, (ctx.Z0 + ctx.Z1) / 2 - z); // facing the middle of the room
  return ccmQuiet(ctx, () => ccmAt(ctx, id, [[x, z, r], [x + Math.sign((ctx.X0 + ctx.X1) / 2 - x) * 0.5, z + Math.sign((ctx.Z0 + ctx.Z1) / 2 - z) * 0.5, r]], { layer, rule: 'corner', why: why || 'in the corner' }));
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
  const ranks = seat ? ccmRanks(ctx, { far, s0: rowsFrom, s1: deep - backGap, gap: pitch - seatD, aisle, margin, turn: 0, proto: seat, choose: () => ccmAny(ctx, cfg.seatsMix || [seat]) || seat, rule: 'pew', why: 'seats in rows facing the altar, either side of the centre aisle' }) : { placed: [], rows: 0 };
  ctx.chapelInfo = { seats: ranks.placed.length, rows: ranks.rows, bier: bier?.id || null, dais: !!dais, far };
  if (ranks.placed.length) ctx.growth.push(`${ranks.placed.length} seats in ${ranks.rows} rows facing the altar`);
  // beside the altar
  if (cfg.altarFlank) ccmFlank(ctx, base, cfg.altarFlank, { off: 1.0, why: 'one each side of the altar' });
  if (cfg.corner && ctx.chance(cfg.cornerChance ?? 0.7)) ccmCorner(ctx, ccmAny(ctx, cfg.corner), [far, lat[ctx.ri(0, 1)]], { why: 'in a corner beside the altar', inset: 0.6 });
  if (cfg.endCorners) for (const s of lat) ccmCorner(ctx, ccmAny(ctx, cfg.endCorners), [far, s], { why: 'in the corner of the altar wall' });
  if (cfg.lectern && ccmHas(ctx, cfg.lectern)) { const [x, z] = axis(frontS + 1.2, L / 2 - altar.dims[0] / 2 - 2); ccmQuiet(ctx, () => ccmAt(ctx, cfg.lectern, [x, z, toDoor], { why: 'lectern beside the altar, turned to the seats' })); }
  // on the altar: a cloth, a candelabrum toward each end, one thing in the middle
  if (cfg.cloth) ccmOn(ctx, cfg.cloth, altar, 0, 0, 'altar cloth');
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

// OSSUARY (terminal): a storeroom of bones. The bone shrine centred on the wall facing the door, walls faced with skulls
// (wall panels), skull-faced pillars on a grid clear of the door-shrine line, troughs and shelves at the walls, heaps in corners
function cryptOssuary(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), lat = ccmLat(far);
  let focal = ccmFocalOn(ctx, far, ['ossuary-shrine'], { label: 'bone shrine', rule: 'key-shrine', why: 'the bone shrine: flat to the wall facing the door, centred (axial focal)' });
  if (!focal) focal = ccmCentre(ctx, ['skull-pile', 'bones-pile'], { label: 'skull heap', rule: 'key-heap', why: 'a great heap of skulls in the middle of the floor (no shrine)' });
  if (!focal) return { fail: `ossuary has no shrine or skull heap (${ctx.focal?.why || 'no mesh'})` };
  if (d) { ctx.sight = [d.inner, [focal.x, focal.z]]; ctx.sightFeature = focal.id; ccmWalk(ctx, 'approach', [d.inner, front(focal, 1.8)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(focal, 1.8)]); }
  const shrine = focal.id === 'ossuary-shrine';
  if (shrine) { ccmFlank(ctx, focal, ['candle-drippings-mound'], { off: 0.4, why: 'candle stubs either side of the shrine' }); if (cells >= 25) ccmFlank(ctx, focal, ['rite-pillar-candle-tall', 'candlestand-pricket'], { off: 2.4, why: 'a tall candle either side of the shrine' }); }
  // pillars: 2 from 16 cells, 4 from 30, either side of the centre line
  const nP = cells >= 30 ? 4 : cells >= 16 && Math.min(ctx.W, ctx.D) >= 16 ? 2 : 0, pillars = [];
  for (let k = 0; k < nP; k++) { const sgn = k % 2 ? 1 : -1, s = nP === 4 ? deep * (k < 2 ? 0.36 : 0.7) : deep * 0.55, [x, z] = ctx.sidePoint(far, L / 2 + sgn * Math.max(4, L / 4), s); const p = ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['ossuary-pillar', 'pillar-square']), [x, z, 0], { layer: 'anchor', rule: 'pillar', why: 'a skull-faced pillar where a support would stand' })); if (p) pillars.push(p); }
  // the walls: bone shelves on the plain panels, a trough per 15 ft of side wall
  const shelves = ccmAlong(ctx, ['catacomb-shelf-bones'], [...lat, ...(d ? [d.side] : [])], Math.max(1, Math.min(3, Math.round(cells / 10))), { why: 'a rack of bones against a plain panel', layer: 'store' });
  const troughs = ccmAlong(ctx, ['charnel-trough'], lat, Math.max(1, Math.min(4, Math.round(deep / 15))), { why: 'a bone trough along the side wall', layer: 'store' });
  // heaps cluster: in the corners and at the feet of the pillars
  const nH = Math.max(2, Math.min(5, Math.round(cells / 6)));
  ccmQuiet(ctx, () => ctx.cornerPile(CRYPT_HEAP.filter(i => ccmHas(ctx, i)), Math.min(nH, 3), { why: 'bones heaped in a corner' }));
  for (let i = 0; i < nH - 3 && pillars.length; i++) ccmQuiet(ctx, () => ctx.companion(pillars[i % pillars.length], ccmAny(ctx, CRYPT_HEAP), { why: 'a heap at the foot of the pillar', layer: 'store', maxDist: 3.5 }));
  cryptScatter(ctx, 'decal-bones-scatter', Math.round(ctx.area() / 90), d?.inner, d ? [focal.x, focal.z] : null);
  for (const t of [...troughs, ...shelves.filter(p => p.dims[1] < 4)].slice(0, 3)) if (ctx.chance(0.7)) ccmOn(ctx, 'skull-candle', t, ctx.r(-0.3, 0.3), 0, 'a skull candle on top', 'light');
  cryptHung(ctx, [...lat, far], { plaques: 0, niches: ctx.ri(0, 2) });
  ccmWallLights(ctx, ['torch-bracket-rough', 'torch-sconce'], [...lat, ...(d ? [d.side] : []), far], { every: 20, min: 2, max: 4, why: 'rough torch on a plain panel' });
  cryptCobweb(ctx);
  ccmEnsureLight(ctx, ['torch-bracket-rough', 'torch-sconce'], CRYPT_STAND);
  ccmDone(ctx);
  return { feature: focal, what: shrine ? 'bone shrine' : 'skull heap', approach: null, passage: true };
}

// CATACOMB CORRIDOR (passage): the key feature is the WALLS (burial-niche panels, walls.js PANELS); a clear line down the
// middle, bone racks and coffins against the plain panels alternating sides, heaps only in the end corners, few torches
function cryptCatacomb(ctx) {
  const panels = ccmPanels(ctx);
  const line = throughLine(ctx);
  if (!line.path.ok) return { fail: 'catacomb corridor: the through-line is blocked' };
  const long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D);
  const shelves = wide >= 8.5 ? ccmAlong(ctx, ['catacomb-shelf-bones'], long, Math.max(1, Math.round(Lr / 25)), { why: 'a rack of bones against a plain panel', layer: 'anchor' }) : [];
  if (wide >= 8.5) for (let i = 0, n = Math.min(2, Math.round(Lr / 30)); i < n; i++) ccmLieAlong(ctx, 'coffin', [long[i % 2]], { why: 'a coffin pushed against the wall' });
  if (wide >= 9 && ctx.chance(0.5)) ccmLieAlong(ctx, 'stone-coffin-lidless', long, { why: 'a lidless stone coffin against the wall' });
  if (ctx.chance(0.5)) ccmLieAlong(ctx, 'rite-mummified-remains', long, { why: 'wrapped remains on the floor along the wall' });
  ccmQuiet(ctx, () => ctx.cornerPile(CRYPT_HEAP.filter(i => ccmHas(ctx, i)), Math.max(1, Math.min(3, Math.round(Lr / 25))), { why: 'bones heaped in an end corner' }));
  cryptScatter(ctx, 'decal-bones-scatter', Math.round(ctx.area() / 120), line.a, line.b);
  if (ccmHas(ctx, 'decal-moss')) for (let i = 0; i < Math.round(ctx.area() / 150); i++) ccmQuiet(ctx, () => ctx.rug('decal-moss', { why: 'moss on the damp floor' }));
  cryptHung(ctx, long, { plaques: ctx.ri(0, 2), niches: ctx.ri(0, 2) });
  // darker than the other rooms on purpose: one torch every 12-15 ft, alternating sides, on the plain panels between niche runs
  ccmWallLights(ctx, [...CRYPT_TORCH, 'lantern-wall-iron'], long, { every: 13.5, why: 'torch on a plain panel between the niche runs' });
  for (let i = 0, n = ctx.ri(0, 2); i < n; i++) ccmQuiet(ctx, () => ctx.wall('candle-drippings-mound', { sides: long, layer: 'light', why: 'candle stubs on the floor under a niche', gap: 0.3 }));
  cryptCobweb(ctx);
  ccmEnsureLight(ctx, CRYPT_TORCH, ['candle-drippings-mound', ...CRYPT_STAND]);
  ctx.catacombInfo = { niches: panels, shelves: shelves.length };
  ccmDone(ctx);
  return { feature: shelves[0] || null, what: `${panels} burial-niche panels along the walls, a clear through-line`, approach: null, passage: true };
}

// CHAPEL OF REST (terminal): the shared chapel program. Altar on the end wall, a pall-draped coffin on its bier before
// it with a tall candle at each corner, stone benches in rows facing the altar (pews when their mesh exists)
const CRYPT_CHAPEL = {
  altar: ['altar-stone'], altarGap: 1.5, aisle: 4, pitch: 3.5, backGap: 4, bierMinCells: 15, bierOff: 3.5,
  bier: ['rite-funeral-pall', 'rite-funeral-bier'], bierRoll: (ctx) => ccmFirst(ctx, ctx.roll('lying in state', ['pall', 'pall', 'pall', 'empty bier']) === 'empty bier' ? ['rite-funeral-bier', 'rite-funeral-pall'] : ['rite-funeral-pall', 'rite-funeral-bier']),
  bierCandles: ['rite-pillar-candle-tall', 'candlestick-floor', 'candlestand-pricket'], bierFoot: ['vase-flowers', 'flowers-dried'],
  seats: ['pew', 'bench-stone'], corner: ['statue-weeping-angel', 'monument-urn-draped'], endCorners: ['urn-decorative'], lectern: 'lectern',
  cloth: 'rite-altar-cloth', altarLights: ['candelabra', 'rite-bone-candelabra', 'candlestick'], altarThings: ['rite-offering-candles-tray', 'reliquary', 'tome-holy'],
  overAltar: 'rite-sanctuary-lamp', overBier: 'censer-hanging', hung: ['rite-memorial-plaque'], hangMax: 4,
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
  'crypt-ossuary': ccmAnnex((ctx) => cryptAnnex(ctx, { wall: ['catacomb-shelf-bones', 'charnel-trough'], heaps: true, hung: { plaques: 0, niches: 1 }, torches: ['torch-bracket-rough', 'torch-sconce'] })),
  'crypt-catacomb': ccmAnnex((ctx) => cryptAnnex(ctx, { lie: ['coffin', 'rite-mummified-remains'], wall: ['catacomb-shelf-bones'], heaps: true, hung: { plaques: 1, niches: 1 } })),
  'crypt-chapel': ccmAnnex((ctx) => cryptAnnex(ctx, { seats: true, wall: ['urn-decorative'], hung: { plaques: 3 }, torches: ['sconce-candle-single', 'torch-sconce'], every: 10 })),
  'crypt-embalming': ccmAnnex((ctx) => cryptAnnex(ctx, { lie: ['coffin'], wall: ['shelving-freestanding', 'coffin-maker-stack', 'storage-jar'], hung: { plaques: 0, masks: 1 }, torches: ['lantern-wall-iron', 'torch-sconce'] })),
  'crypt-relic': ccmAnnex((ctx) => cryptAnnex(ctx, { wall: ['chest-ironbound', 'chest-plain', 'urn-decorative', 'pedestal-display'], hung: { plaques: 0, masks: 1 }, torches: ['torch-sconce'] })),
});
Object.assign(KEY, { 'crypt-antechamber': cryptAntechamber, 'crypt-vault': cryptVault, 'crypt-ossuary': cryptOssuary, 'crypt-catacomb': cryptCatacomb,
  'crypt-chapel': (ctx) => chapel(ctx, CRYPT_CHAPEL), 'crypt-embalming': cryptEmbalming, 'crypt-relic': cryptRelic });
// (targets follow the designer's COUNTS per room size; the 'about N per 100 sq ft' lines in rooms.json run 1.4-2x over those counts)
Object.assign(DENSITY, { 'crypt-antechamber': 4, 'crypt-vault': 4, 'crypt-ossuary': 4, 'crypt-catacomb': 3.5, 'crypt-chapel': 5, 'crypt-embalming': 5.5, 'crypt-relic': 4.5 }); // (catacomb 3.5, not the designer's 3: test/yard.test.mjs holds the yard's 2 to 0.6x of EVERY indoor target)
Object.assign(FOCAL, { 'crypt-antechamber': 'monument', 'crypt-ossuary': 'bone shrine', 'crypt-chapel': 'altar (on the end wall)', 'crypt-relic': 'reliquary shrine', 'crypt-vault': 'the founder\'s tomb (in a vault of ranks)' });
Object.assign(KEY_RE, { 'crypt-antechamber': /^(statue-weeping-angel|monument-urn-draped)$/, 'crypt-vault': /^(sarcophagus|effigy-knight|stone-coffin-lidless|coffin)/, 'crypt-ossuary': /^(ossuary-shrine|skull-pile|bones-pile)$/,
  'crypt-catacomb': null, 'crypt-chapel': /^altar-stone$/, 'crypt-embalming': /^(embalming-table|rite-corpse-on-slab)$/, 'crypt-relic': /^(reliquary-shrine|pedestal-display|sarcophagus)$/ });
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
  if (D) for (const shape of D.width >= 14.4 ? ['', 's2'] : ['s2']) table = table || castleOn(ctx, 'table-feast', D.p, ...axis(tS), toDoor, { sku: { shape }, layer: 'anchor', rule: 'key-high-table', why: 'the high table: on the dais, parallel to the end wall', extra: { focal: true } });
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
  // trestles end to end in two rows (one under 24 ft across, on the side away from the hearth), a bench each side
  const [tw, tdp] = ccmSize(ctx, 'table-trestle'), off = 2.5 + 0.5 + 1.6 + 0.3 + (tdp + 1.2) / 2, rows = L >= 23.5 ? [-1, 1] : L >= 2 * (off + tdp / 2 + 1.3 + 1.3) ? [(sideDoor ? d.side : hs) === lat[0] ? 1 : -1] : [];
  const trestles = [];
  for (const sg of rows) for (let s = footS + 1.2; s + tw <= deep - 3.5 + 1e-6;) { // (a table that meets the hearth's face or a door landing slides on a foot at a time)
    const [x, z] = axis(s + tw / 2, L / 2 + sg * off), t = castlePut(ctx, 'table-trestle', [x, z, toDoor + Math.PI / 2], { layer: 'anchor', rule: 'trestle-row', why: 'trestle tables end to end down the hall' });
    if (!t) { s += 1; continue; }
    trestles.push(t); s += tw + 0.5;
    for (const bs of [-1, 1]) castlePut(ctx, 'bench-long', [0.75, 1.0, 1.3].map(g => { const [bx, bz] = axis(s - 0.5 - tw / 2, L / 2 + sg * off + bs * (Math.min(t.dims[0], t.dims[2]) / 2 + g)); return [bx, bz, Math.atan2(x - bx, z - bz)]; }), { rule: 'seat', why: 'a bench along the trestle', extra: { group: t.uid } });
  }
  if (trestles.length) ctx.growth.push(`trestles repeat: ${trestles.length} in ${rows.length} row${rows.length === 1 ? '' : 's'} down the hall`);
  // on the tables: the high table's silver and a candelabrum, common tableware on the trestles
  for (const id of ['candelabra', 'salt-cellar-ship', ...ctx.pick(['goblet-silver', 'platter-silver', 'boar-head-platter', 'goblet-silver', 'pitcher', 'roast-pig'], 4)]) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'candelabra' ? 'light' : 'dress', why: 'on the high table' }));
  for (const t of trestles) for (const id of ctx.pick(COMMON_FOOD, 3)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === t.uid, why: 'supper on the trestle' }));
  // banner poles flanking the dais, armour by the door, shields and hangings on the long walls
  for (const sg of [-1, 1]) castlePut(ctx, 'banner-pole', [...axis(1.0, L / 2 + sg * ((D ? D.width : table.dims[0]) / 2 + 1.3)), toDoor], { rule: 'flank', why: 'a banner either side of the dais' });
  if (d) for (const sg of [-1, 1]) ccmQuiet(ctx, () => ctx.put('armor-stand', (dm) => ctx.wallGen(dm, [d.side]), (c) => Math.abs(c.t - (d.tc + sg * (d.width / 2 + 2.2))), { rule: 'by-door', why: 'a suit of armour either side of the door' }));
  castleHang(ctx, ['heraldic-shield'], [hearth ? hearth.side : hs], 1, { height: 7.0, why: 'the arms beside the hearth' });
  castleHang(ctx, ['banner-wall', 'tapestry', 'banner-wall', 'shield-display', 'trophy-head'], lat, Math.max(2, Math.round(deep / 10) * 2), { height: 5.8, why: 'hangings down the long walls' });
  ccmWallLights(ctx, CASTLE_TORCH_FINE, lat, { every: 13, height: 6.2, why: 'a torch every 10-15 ft of the long walls' });
  for (let k = 0, n = Math.max(1, Math.round(deep / 25)); k < n; k++) castleChandelier(ctx, axis(Math.max(5.2, Math.min(deep - 5.2, footS + (deep - footS) * (k + 0.5) / n))), 'the great chandelier over the centre aisle');
  if (!hearth) castlePut(ctx, 'brazier-large', [...axis((footS + deep) / 2, L / 2 + (rows.length === 1 ? -rows[0] : 0) * 4), 0], { layer: 'light', why: 'a brazier (no wall free for the hearth)', allowKeep: true });
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
  const kit = castleNear(ctx, ['mil-armor-repair-bench', 'grindstone', 'arrow-barrel', 'chest-ironbound', 'mil-shield-stack', ...(cells >= 20 ? ['arrow-barrel', 'mil-pavise'] : [])], doorSides, nearPt, { layer: 'store', why: 'kept by the door' });
  // racks: one per 5 ft of what wall is left
  const free = 2 * (ctx.W + ctx.D), racks = ccmAlong(ctx, ['weapon-rack'], [...lat, far, ...(d ? [d.side] : [])], Math.max(2, Math.min(14, Math.round(free / 11))), { why: 'weapon racks along the walls', layer: 'anchor' });
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
  const CELL_D = 10, withCells = area >= 300 && across >= 21 && ccmHas(ctx, 'cell-bars') && ccmHas(ctx, 'door-cell-bars');
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
      const t = t0 + k * 10, flip = hash(ctx.baseSeed ?? ctx.room.seed, 'cell-door', k) % 2, isOpen = ccmHas(ctx, 'door-cell-bars-open') && hash(ctx.baseSeed ?? ctx.room.seed, 'cell-open', k) % 5 === 0;
      const bars = piece('cell-bars', t + (flip ? 7.5 : 2.5), CELL_D + 0.2, rotIn, {}, 'the barred front of a cell');
      const door = piece(isOpen ? 'door-cell-bars-open' : 'door-cell-bars', t + (flip ? 2.5 : 7.5), CELL_D + 0.2 + (isOpen ? 1.4 : 0), rotIn, {}, isOpen ? 'a cell door standing open' : 'the barred door of a cell') || piece('door-cell-bars', t + (flip ? 2.5 : 7.5), CELL_D + 0.2, rotIn, {}, 'the barred door of a cell');
      if (!bars && !door) continue;
      if (door?.id === 'door-cell-bars-open') open++;
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
  if (d && feature) { ctx.sight = [d.inner, [feature.x, feature.z]]; ctx.sightFeature = feature.id; }
  if (d) { if (any) ccmWalk(ctx, 'approach', [d.inner, rack ? [rack.x + Math.sin(rack.rot + Math.PI / 2) * (rack.dims[0] / 2 + 1.6) * (((d.inner[0] - rack.x) * Math.sin(rack.rot + Math.PI / 2) + (d.inner[1] - rack.z) * Math.cos(rack.rot + Math.PI / 2)) >= 0 ? 1 : -1), rack.z + Math.cos(rack.rot + Math.PI / 2) * (rack.dims[0] / 2 + 1.6) * (((d.inner[0] - rack.x) * Math.sin(rack.rot + Math.PI / 2) + (d.inner[1] - rack.z) * Math.cos(rack.rot + Math.PI / 2)) >= 0 ? 1 : -1)] : front(any, 1.8)]);
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
  else if (d) { a = d.inner; b = ctx.sidePoint(OPP_SIDE[d.side], d.tc, 1.6); }
  if (!a) return { fail: 'gatehouse has no gate' };
  const acrossW = d.side === 'N' || d.side === 'S' ? ctx.W : ctx.D, width = Math.max(4, Math.min(10, acrossW - 7));
  const path = ctx.walk('through', [a, b], { width });
  if (!path.ok) return { fail: 'gatehouse: the through-line from gate to gate is blocked' };
  const sides = d ? [d.side, ...ccmLat(d.side)] : ['N', 'S', 'E', 'W'], lat = d ? ccmLat(d.side) : ['W', 'E'];
  const windlass = ccmQuiet(ctx, () => ctx.put('windlass', (dm) => ctx.wallGen(dm, sides), (c) => Math.hypot(c.x - d.inner[0], c.z - d.inner[1]) + (c.side === d.side ? 0 : 2), { layer: 'anchor', rule: 'key-windlass', why: 'the windlass: against the wall beside the outer gate', unique: true }));
  if (windlass) ccmQuiet(ctx, () => ctx.mount('lever-wall', { sides: [windlass.side], height: 5.2, why: 'the gate lever, by the windlass' }));
  // the bands either side: the guard table on one, fire and arms on the other
  const band = lat[ctx.ri(0, 1)], other = OPP_SIDE[band];
  const table = ccmQuiet(ctx, () => ctx.put('table-square', (dm) => ctx.wallGen(dm, [band], { gap: 1.2 }), (c) => Math.abs(c.t - ctx.sideLen(band) / 2), { rule: 'guard-table', why: 'the guard table, in the band beside the passage' }));
  if (table) { ccmQuiet(ctx, () => ctx.free(ccmAny(ctx, ['stool-three-leg', 'bench-long']), { near: [table.x, table.z], radius: 2.8, margin: 0.3, face: [table.x, table.z], rule: 'seat', why: 'a seat at the guard table' })); for (const id of ['mil-guard-lantern', 'dice-and-cup']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'mil-guard-lantern' ? 'light' : 'dress', why: 'on the guard table' })); }
  ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['brazier-large', 'fire-basket-stand', 'brazier-standing']), { sides: [other], prefer: 'center', layer: 'light', gap: 0.6, why: 'a fire in the band beside the passage' }));
  const arms = ['mil-spear-tripod', 'arrow-barrel', 'mil-pavise', 'armor-stand', 'weapon-rack', 'arrow-barrel', 'armor-stand'].filter(i => ccmHas(ctx, i));
  for (let k = 0, n = Math.max(2, Math.min(arms.length, Math.round(cells / 4))); k < n; k++) ccmQuiet(ctx, () => ctx.wall(arms[k], { sides: [k % 2 ? band : other, k % 2 ? other : band], layer: 'store', why: 'arms in the band beside the passage' }));
  if (Math.min(ctx.W, ctx.D) >= 19) ccmCorner(ctx, 'mil-boiling-oil-pot', [d.side, other], { why: 'the oil pot in the corner by the outer gate', layer: 'anchor', inset: 0.6 });
  castleHang(ctx, ['mil-crossbow-rack', 'mil-helmet-peg-rack', 'horn-hunting', 'mil-duty-roster', 'heraldic-shield'], lat, Math.max(2, Math.round(cells / 6)), { height: 6.2, why: 'on the gatehouse wall' });
  ccmWallLights(ctx, CASTLE_TORCH, lat, { every: 18, min: 1, why: 'torch on the gatehouse wall' });
  ccmEnsureLight(ctx, CASTLE_TORCH, ['fire-basket-stand', 'brazier-standing']);
  ccmDone(ctx);
  return { feature: windlass || null, what: `a clear ${width.toFixed(0)}-ft way from gate to gate${windlass ? ', the windlass beside the outer gate' : ''}`, approach: null, passage: true };
}

// CASTLE CHAPEL: the shared chapel program. The one-step dais on the end wall with the altar on it, pews in rows facing
// it (a chapel too narrow for two blocks of 8-ft pews seats on the stone bench), font and candle rack by the door, no bier
const CASTLE_CHAPEL = {
  dais: ['dais'], altar: ['altar-stone'], altarGap: 3, aisle: 5, pitch: 5, backGap: 4, firstRow: 8,
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
  return KEY.kitchen(ctx);
}
Object.assign(KEY, { 'great-hall': castleGreatHall, 'throne-room': castleThrone, 'armoury': castleArmoury, 'barracks': castleBarracks, 'dungeon': castleDungeon, 'gatehouse': castleGatehouse, 'chapel': castleChapel, 'castle-kitchen': castleKitchen,
  'courtyard': castleCourtyard }); // (outdoor: needs the scope-castle hook in attempt(), `(KEY[key] || yard)(ctx)`)
Object.assign(MENUS, {
  // the inn's kitchen zones, then its fill (attempt() runs kitchenFill only for the key 'kitchen': here it is the last menu entry)
  'castle-kitchen': [...MENUS.kitchen, { kind: 'kitchen-fill', label: 'kitchen fill', size: [1, 1], minArea: 0, repeat: 1, quiet: true, pref: (ctx, r) => Math.hypot(r[0] - ctx.X0, r[1] - ctx.Z0), fill: (ctx) => kitchenFill(ctx) }],
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
  // reading by the fire (from 16 cells): the green fireplace on a side wall, two wing chairs, a side table between
  let fire = null;
  if (cells >= 16) { fire = mansionHearth(ctx, lat, { shape: 's2' }); if (fire) mansionSitting(ctx, fire, { small: true, chairSku: { shape: 'fine--s3' } }); }
  // the study table in the middle of a big library
  if (cells >= 25) ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, ['table-library', 'table-games']) || 'table-library', ['chair-armed'], 4, { why: 'the library table' }));
  // bookcases: the far wall first, then the side walls, each butted against the last, until half the wall is books
  const wallFt = 2 * (ctx.W + ctx.D), cases = [focal]; let booked = focal.dims[0];
  for (let k = 0; k < 40 && booked < wallFt * 0.55; k++) {
    const b = ccmQuiet(ctx, () => ctx.put('bookshelf', (dm) => ctx.wallGen(dm, [far, ...lat], { step: 0.25 }), (c) => (c.side === far ? 0 : 3) + Math.min(...cases.map(q => Math.hypot(q.x - c.x, q.z - c.z))), { layer: 'store', rule: 'bookcase', why: 'bookcases butted side by side along the wall' }));
    if (!b) break; cases.push(b); booked += b.dims[0];
  }
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
  // the light IS the focal piece: one grand chandelier per 3 cells of length, evenly spaced on the long centre line
  const nC = Math.max(1, Math.round(Lr / 15)), lamps = [];
  for (let i = 0; i < nC; i++) { const u = (i + 0.5) / nC - 0.5, p = mansionChandelier(ctx, longX ? [cx + u * ctx.W, cz] : [cx, cz + u * ctx.D], Math.min(ctx.W, ctx.D) < 18, 'a grand chandelier on the centre line of the dance floor'); if (p) lamps.push(p); }
  if (!lamps.length) return { fail: 'ballroom has no chandelier (no chandelier-grand mesh)' };
  ctx.focal = { label: 'chandelier row', id: lamps[0].id, ok: true, centre: true };
  // the dance floor: reserved before anything stands (a 3.2-ft band stays at the walls, more at the musicians' end)
  const band = 3.2, mus = Math.min(11, Lr * 0.28), r = [ctx.X0 + band, ctx.Z0 + band, ctx.X1 - band, ctx.Z1 - band];
  if (end === 'W') r[0] = ctx.X0 + mus; if (end === 'E') r[2] = ctx.X1 - mus; if (end === 'N') r[1] = ctx.Z0 + mus; if (end === 'S') r[3] = ctx.Z1 - mus;
  ctx.danceFloor = r.map(v => +v.toFixed(2));
  if (r[2] - r[0] > 2 && r[3] - r[1] > 2) ctx.mark((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1], KEEP);
  // the musicians: harpsichord 3 ft off the end wall at an angle, its stool, the harp, stands and chairs in a shallow arc
  const at = (t, s) => ctx.sidePoint(end, t, s), hp = ccmHas(ctx, 'harpsichord') && mus >= 9 ? mansionAt(ctx, 'harpsichord', [[...at(Le * 0.42, 3 + 3.9), SIDES[end].rot + 0.42], [...at(Le * 0.42, 3 + 3.9), SIDES[end].rot + 1.2], [...at(Le * 0.4, 5), SIDES[end].rot + Math.PI / 2]], { layer: 'anchor', rule: 'key-instrument', why: 'the harpsichord: at the musicians\' end, 3 ft off the wall, at an angle', allowKeep: true }) : null;
  if (hp) ccmQuiet(ctx, () => ctx.companion(hp, 'stool-upholstered', { why: 'the stool at the keyboard', maxDist: 5 }));
  const harp = mansionAt(ctx, 'harp', [[...at(Le * 0.72, 3.2), SIDES[end].rot], [...at(Le * 0.75, 2.2), SIDES[end].rot]], { rule: 'instrument', why: 'the harp beside the harpsichord', allowKeep: true });
  if (harp) ccmQuiet(ctx, () => ctx.companion(harp, 'stool-upholstered', { why: 'the harpist\'s stool', maxDist: 3 }));
  for (let i = 0, n = Math.max(1, Math.min(4, Math.round(Le / 9))); i < n; i++) { const t = Le * (0.2 + 0.6 * (n === 1 ? 0.5 : i / (n - 1))), s = mus - 2.2 - Math.abs(t - Le / 2) * 0.12; const st = mansionAt(ctx, 'music-stand', [[...at(t, s), SIDES[end].rot + Math.PI], [...at(t + 1, s), SIDES[end].rot + Math.PI]], { rule: 'music', why: 'a music stand in the musicians\' arc', allowKeep: true }); if (st) mansionAt(ctx, 'chair-salon-gilt', [[...at(mansionT(ctx, end, st), s - 2), SIDES[end].rot], [...at(mansionT(ctx, end, st), s - 2.5), SIDES[end].rot]], { rule: 'seat', why: 'a musician\'s chair behind the stand', allowKeep: true }); }
  for (const s of ccmLat(end)) ccmCorner(ctx, 'candelabra-standing', [end, s], { why: 'a floor candelabrum at each end of the musicians\' group', layer: 'light', inset: 0.5 });
  // the long walls: a console under a pier mirror at the middle, runs of chairs and benches either side of it, mirrors beyond
  let chairs = 0;
  for (const s of longs) {
    mansionConsole(ctx, s, 0.5);
    const L = ctx.sideLen(s), n = Math.max(2, Math.round(L / 3.2));
    for (let i = 0; i < n; i++) { const t = L * (i + 0.5) / n, bench = i % 5 === 2, id = bench ? 'bench-upholstered' : 'chair-salon-gilt';
      const p = ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [s], { tRange: [t - 1.2, t + 1.2] }), (c) => Math.abs(c.t - t), { rule: 'wall-seat', why: 'chairs and benches in a line along the long wall, backs to it', sku: bench ? { shape: 's1' } : undefined })); if (p) chairs++; }
    for (const u of [0.2, 0.8]) { const m = mansionHang(ctx, 'mirror-pier-gilt', s, L * u, 3.0, { why: 'a pier mirror on the long wall' }); for (const sg of [-1, 1]) mansionHang(ctx, 'sconce-candle-triple', s, L * u + sg * ((m ? m.dims[0] : 3) / 2 + 1.1), 5.0, { layer: 'light', why: 'candle sconce beside the mirror' }); }
  }
  const door = [...shorts].find(s => s !== end);
  for (const s of ccmLat(door)) ccmCorner(ctx, ccmAny(ctx, ['statue-bust', 'urn-decorative', 'palm-potted']), [door, s], { why: 'in the corner by the door', inset: 0.4 });
  if (cells >= 40) { const sb = mansionWall(ctx, ccmFirst(ctx, ['sideboard', 'table-console']), [door, ...longs], { at: 0.25, why: 'the refreshment sideboard' }); if (sb) for (const id of ctx.pick(['wassail-bowl', 'tray-silver', 'goblet-silver', 'decanter-crystal'], 3)) ccmOn(ctx, id, sb, ctx.r(-0.35, 0.35), 0, 'refreshments on the sideboard'); }
  mansionPaintings(ctx, 2, shorts);
  mansionDrapes(ctx);
  if (d) for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, d.inner]);
  ctx.ballInfo = { chandeliers: lamps.length, chairs, end, floor: +(((r[2] - r[0]) * (r[3] - r[1])) / ctx.area()).toFixed(2) };
  ccmDone(ctx);
  return { feature: hp || null, what: `an empty dance floor (${Math.round(ctx.ballInfo.floor * 100)}% of the room) under ${lamps.length} chandelier${lamps.length > 1 ? 's' : ''}, the musicians at the ${SIDE_LABEL[end]} end`, approach: null, passage: true };
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
PROGRAM_OF['mansion-kitchen'] = 'kitchen'; PROGRAM_OF['mansion-cellar'] = 'cellar';
{ const innKitchen = KEY.kitchen;
  KEY.kitchen = (ctx) => {
    const kp = innKitchen(ctx);
    if (ctx.type.key === 'mansion-kitchen' && !kp.fail) { const hd = ctx.doors.find(o => o.to) || ctx.mainDoor; if (hd) ccmQuiet(ctx, () => ctx.mount('bell-board-servants', { sides: [hd.side], height: 6.7, why: 'the servants\' bell board beside the door to the house' })) || ccmQuiet(ctx, () => ctx.mount('bell-board-servants', { sides: ccmLat(hd.side), height: 6.7, why: 'the servants\' bell board, on the wall nearest the door to the house' })); }
    return kp;
  };
  const innCellar = KEY.cellar; // ... and a mansion cellar lines what wall the cask hall left with arched wine bins
  KEY.cellar = (ctx) => {
    const kp = innCellar(ctx);
    if (ctx.type.key === 'mansion-cellar' && !kp.fail) for (let i = 0, n = Math.max(2, Math.min(6, Math.round(ctx.area() / 60))); i < n; i++) if (!mansionWall(ctx, 'wine-bin-arched', ctx.wallsByDoor(), { sideCost: 0.5, at: ctx.r(0.1, 0.9), layer: 'store', rule: 'wine-bin', why: 'arched wine bins lining the wall' })) break;
    return kp;
  }; }

// ---- mansion: hooks into the dispatcher ----
Object.assign(KEY, { 'mansion-hall': mansionHall, 'mansion-drawing': mansionDrawing, 'mansion-dining': mansionDining, 'mansion-library': mansionLibrary, 'mansion-bedroom': mansionBedroom, 'mansion-ballroom': mansionBallroom, 'mansion-conservatory': mansionConservatory,
  'mansion-garden': mansionGarden }); // (outdoor: attempt() runs KEY[key] in place of yard() when the type has one)
Object.assign(MENUS, {
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
  'mansion-ballroom': /^chandelier-/, 'mansion-conservatory': /^(fountain-courtyard|palm-potted|citrus-tree-tub|fern-potted)$/, 'mansion-garden': null, 'mansion-kitchen': /^cook-hearth/, 'mansion-cellar': /^(cask-rack|shelving|wine-rack|tun|wine-bin)/ });
