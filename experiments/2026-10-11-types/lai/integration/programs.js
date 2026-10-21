// >>> type:lai
// ---------------- monster lair (2026-10-11): ten rooms ----------------
// A lair is the home of a creature, so a lair room is defined by its OCCUPANT. Four of the rooms are DENS and share one
// skeleton, laiDen(ctx, K), dressed by the creature kind K:
//   BED     where it sleeps: the deepest corner (the one by the bolt hole when the room has a second door). The key piece.
//   SPOT    a clear patch of floor before the bed, the size of the creature's base: where the GM stands its figure.
//   HOARD   what it hoards or guards: within reach of the bed, farther from the door than the bed's front.
//   FEED    where it eats, with the leftovers: in the open floor between the door and the bed, off the walking line.
//   SIGNS   what warns the party: within a few steps inside the main door.
//   ESCAPE  its bolt hole: every second door is joined to the SPOT by a kept-clear line ('escape'); a den with one door
//           gets the creature's own stand-in where it has one (the goblins' ladder).
// Every placement carries the beat in its rule (den-bed, den-hoard, den-feed, den-sign, den-escape), so the test and a
// building generator can read the skeleton back. The other six rooms (cave mouth, passage, larder, hatchery, prisoner
// pit, trophy cave) are one small program each. Pieces are named in order of preference: the wanted lair meshes first
// (docs/ASSETS_TO_BUILD.md), then the dungeon batch's (sku tier 'dun'), then what the library has always had, so every
// room solves on the library as it stands and gets better as meshes land. Dens are DARK: no torch unless something
// that uses fire lives there (the goblins; the larder and the pit have a keeper's torch by the door).
const LAI_TORCH = ['torch-bracket-rough', 'torch-sconce'], LAI_STAND = ['torch-stand', 'brazier-standing'];
const LAI_WEB = ['giant-web-floor', 'decal-web-floor'], LAI_SCORCH = ['decal-scorch'], LAI_BONES = ['decal-bones-scatter'];
const LAI_CARCASS = [['gnawed-carcass', 1], ['carcass-ribcage', 1], ['bones-pile', 1.4], ['bones-pile', 1]], LAI_DEAD = [['adventurer-remains', 1], ['bones-pile', 1]];
const LAI_ROCK = ['boulder-pile', 'stalagmite', 'boulder-pile', 'rubble-pile'].slice(0, 3); // (the dungeon's rubble pile reads as skulls from above: not used as rock)
const laiSeed = (ctx, ...k) => hash(ctx.baseSeed ?? ctx.room.seed, 'lai', ...k);
const laiPairs = (ctx, ids) => [].concat(ids).map(v => Array.isArray(v) ? v : [v, 1]).filter(([id]) => ccmHas(ctx, id)); // [id, scale] in order of preference
const laiTurn = (ctx) => ctx.r(0, Math.PI * 2);
// one thing at a spot (or the first of several spots that is free), `k` times the size it ships at
function laiPut(ctx, ids, spots, o = {}) {
  for (const [id, k] of laiPairs(ctx, ids)) { const p = ccmScaled(ctx, id, k * (o.k || 1), () => castlePut(ctx, id, spots, o)); if (p) return p; }
  return null;
}
// one thing free on the floor near a point
function laiFree(ctx, ids, near, radius, why, o = {}) {
  for (const [id, k] of laiPairs(ctx, ids)) {
    const p = ccmQuiet(ctx, () => ccmScaled(ctx, id, k * (o.k || 1), () => ctx.free(id, { near, radius, margin: o.margin ?? 0.4, layer: o.layer || 'furnish', rule: o.rule || 'free', why, rot: o.rot === undefined ? laiTurn(ctx) : o.rot, face: o.face || null, sku: o.sku, unique: !!o.unique })));
    if (p) return p;
  }
  return null;
}
// `n` things against the walls, the sides in turn, each from `ids` by variety, a little askew (nothing in a lair is set square)
function laiWalls(ctx, ids, sides, n, why, o = {}) {
  const out = [], pool = laiPairs(ctx, ids);
  for (let i = 0; i < n && pool.length && sides.length; i++) {
    const [id, k] = pool.find(([q]) => q === ccmAny(ctx, pool.map(([q2]) => q2))) || pool[0], side = sides[i % sides.length];
    const p = ccmQuiet(ctx, () => ccmScaled(ctx, id, k * (typeof o.k === 'function' ? o.k(i) : o.k || 1), () => isHung(ctx.lib.objects[id], id) ? ctx.mount(id, { sides: [side], height: o.height ?? 4.6, why })
      : ctx.wall(id, { sides: [side], layer: o.layer || 'furnish', rule: o.rule || 'against-wall', why, prefer: o.prefer || 'random', near: o.near || null, jitter: o.jitter ?? 0.3, sku: o.sku, maxDist: o.maxDist ?? Infinity })));
    if (p) out.push(p);
  }
  return out;
}
// a flat laid at an exact spot, stretched to `size` [w, d] ft where given (as the dungeon's dunFlat). `over`: it may lie
// over other flats (a web under a cocoon, soot under a carcass); each gets its own height so two never fight for a pixel
function laiFlat(ctx, ids, x, z, rot, why, o = {}) {
  for (const [id] of laiPairs(ctx, ids)) {
    const sk = ctx.chooseSku(id, o.sku || {}); if (!sk) continue;
    const dm = { ...ctx.dims(id, sk) }; if (o.size) { dm.w = o.size[0]; dm.d = o.size[1]; dm.h = 0.05; }
    const [aw, ad] = ctx.aabb(dm.w, dm.d, rot);
    if (x - aw / 2 < ctx.X0 - 0.06 || x + aw / 2 > ctx.X1 + 0.06 || z - ad / 2 < ctx.Z0 - 0.06 || z + ad / 2 > ctx.Z1 + 0.06) continue;
    if (!o.over) { if (ctx.rugs.some(b => Math.abs(b.x - x) < (b.w + aw) / 2 && Math.abs(b.z - z) < (b.d + ad) / 2)) continue; ctx.rugs.push({ x, z, w: aw - 0.04, d: ad - 0.04 }); }
    ctx.laiFlats = (ctx.laiFlats || 0) + 1;
    return ctx.record(id, sk, dm, x, 0.025 + (ctx.laiFlats % 40) * 0.004, z, rot, o.layer || 'floor-dress', o.rule || 'floor-flat', why, { orient: 'floor', ...(o.extra || {}) });
  }
  return null;
}
// `n` flats at random spots, clear of the given walking lines [[a, b], ...]
function laiScatter(ctx, ids, n, why, keep = [], o = {}) {
  let done = 0; const m = Math.min(1.5, (Math.min(ctx.W, ctx.D) - 0.2) / 2);
  for (let k = 0; k < n * 6 && done < n; k++) {
    const x = ctx.r(ctx.X0 + m, ctx.X1 - m), z = ctx.r(ctx.Z0 + m, ctx.Z1 - m);
    if (keep.some(([a, b]) => a && b && segDist([x, z], a, b) < (o.clear ?? 2.2))) continue;
    const id = ccmAny(ctx, ids); if (!id) return done;
    if (o.size ? laiFlat(ctx, [id], x, z, laiTurn(ctx), why, { size: o.size(k), rule: o.rule }) : ccmQuiet(ctx, () => ctx.rug(id, { at: [x, z], rot: laiTurn(ctx), why, rule: o.rule || 'rug' }))) done++;
  }
  return done;
}
// the focal piece centred on wall `far` (then anywhere on it, nearest the centre), by preference, at its scale
function laiFocal(ctx, far, ids, { label, rule = 'key-focal', why = '', gap = 0.05, layer = 'anchor', k = 1, sku, allowKeep = false } = {}) {
  const L = ctx.sideLen(far);
  for (const [id, s] of laiPairs(ctx, ids)) for (const sl of [0.5, L / 2]) {
    const p = ccmQuiet(ctx, () => ccmScaled(ctx, id, s * k, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap, tRange: [L / 2 - sl, L / 2 + sl], step: 0.25 }), (c) => Math.abs(c.t - L / 2), { layer, rule, unique: true, sku, allowKeep, why: why || `${label}: on the ${SIDE_LABEL[far]} wall, facing the way in`, extra: { focal: true } })));
    if (p) { ctx.focal = { label, id: p.id, side: far, ok: true }; return p; }
  }
  ctx.focal = { label, ok: false, why: `nothing fits on the ${SIDE_LABEL[far]} wall` };
  return null;
}
// a tall thin thing leaned against a wall, its foot on the floor (the ladder: hung by ctx.mount it would pass the wall tops)
function laiLean(ctx, id, sides, why, rule = 'leaned') {
  if (!ccmHas(ctx, id)) return null;
  return laiCap(ctx, 8.9, () => ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap: 0.05 }), () => ctx.rng(), { layer: 'furnish', rule, why })));
}
// whatever fn places is held under `maxH` ft (the wall tops are at 9), shrunk whole when it ships taller
function laiCap(ctx, maxH, fn) {
  const d0 = ctx.dims;
  ctx.dims = function (i, sku) { const dm = d0.call(this, i, sku); if (dm.h <= maxH || !dm.s) return dm; const f = maxH / dm.h; return { ...dm, w: dm.w * f, d: dm.d * f, h: dm.h * f, s: dm.s.map(v => v * f) }; };
  try { return fn(); } finally { ctx.dims = d0; if (!Object.prototype.hasOwnProperty.call(ctx, 'dims') || d0 === Object.getPrototypeOf(ctx).dims) delete ctx.dims; }
}
// the creature's own floor: its base (K.stand ft), no more than two fifths of the room's short side
const laiStand = (K, F) => Math.max(0, Math.min(K.stand || 5, Math.round(F.small * 0.4)));
function laiSight(ctx, p) { const d = ctx.mainDoor; if (d && p && ctx.losClear(d.inner, [p.x, p.z], new Set([p.uid])).ok) { ctx.sight = [d.inner, [p.x, p.z]]; ctx.sightFeature = p.id; } } // the doorway's view of the key piece, where it has one
const laiClamp = (ctx, [x, z], m) => [Math.max(ctx.X0 + m, Math.min(ctx.X1 - m, x)), Math.max(ctx.Z0 + m, Math.min(ctx.Z1 - m, z))];
// webs: hung high on the walls, and laid over the floor
function laiCobwebs(ctx, sides, n, why = 'web hung on the wall') {
  if (!ccmHas(ctx, 'decal-cobweb')) return 0;
  let k = 0; const d0 = ctx.dims;
  for (let i = 0; i < n; i++) { const f = [1.7, 2.6, 1.3][i % 3]; // (a flat has no mesh scale: its plane is sized here, 3 to 5 ft across)
    ctx.dims = function (id, sku) { const dm = d0.call(this, id, sku); return id === 'decal-cobweb' ? { ...dm, w: dm.w * f, h: dm.h * f } : dm; };
    try { if (ccmQuiet(ctx, () => ctx.mount('decal-cobweb', { sides: [sides[i % sides.length]], height: [6.4, 5.4, 7][i % 3], why }))) k++; } finally { delete ctx.dims; } }
  return k;
}
// the frame every lair room is laid in: `far` = the wall facing the main door; at(t, s) = t ft along it, s ft out from it
function laiFrame(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const at = (t, s) => ctx.sidePoint(far, t, s), esc = ctx.doors.filter(o => o !== d);
  let low = laiSeed(ctx, 'corner') % 2 === 0; // the bed's corner: by seed, or the far corner nearest the bolt hole
  if (esc.length) { const a = at(0, 0), b = at(L, 0), e = esc[0].inner; low = Math.hypot(e[0] - a[0], e[1] - a[1]) <= Math.hypot(e[0] - b[0], e[1] - b[1]); }
  const door = d ? d.inner : at(L / 2, deep - 1.5), mid = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2];
  return { d, far, lat, L, deep, at, esc, low, door, mid, corner: (m, n = m) => at(low ? m : L - m, n), bedSide: lat[low ? 0 : 1], otherSide: lat[low ? 1 : 0], cells: ccmCells(ctx), small: Math.min(ctx.W, ctx.D), area: ctx.area() };
}
// a point `f` of the way from the door to a piece, `off` ft to one side of that line (the feeding spot, the trail)
function laiBetween(ctx, F, p, f, off = 0, key = 'feed') {
  const a = F.door, dx = p.x - a[0], dz = p.z - a[1], len = Math.hypot(dx, dz) || 1, sg = laiSeed(ctx, key) % 2 ? 1 : -1;
  return laiClamp(ctx, [a[0] + dx * f + (dz / len) * off * sg, a[1] + dz * f - (dx / len) * off * sg], 1.5);
}

// THE DEN SKELETON. K = { kind, label, bedName, stand (ft: the creature's base), bed(ctx, F) -> placement (may set F.spot),
// hoard / feed / signs (ctx, F, bed) -> placements, escape(ctx, F, bed) -> placement | null, dress(ctx, F, bed, lines),
// torches: n }. Returns the usual key-purpose record; the beats are recorded on the bed's placement (`lair`: kind, spot, stand, counts, escape) for the test and the generator.
function laiDen(ctx, K) {
  const F = laiFrame(ctx), { d } = F;
  const bed = K.bed(ctx, F);
  if (!bed) return { fail: `${K.label} has no ${K.bedName} (no mesh, or no floor for it)` };
  ctx.focal = { label: K.bedName, id: bed.id, ok: true };
  // SPOT: the creature's own ground, before its bed on the door's side (the dragon's is the hollow of its hoard)
  let st = F.hollow ? F.hollow.st : laiStand(K, F);
  if (!F.spot) { const [bw, bd] = ctx.aabb(bed.dims[0], bed.dims[2], bed.rot), dx = F.door[0] - bed.x, dz = F.door[1] - bed.z, clear = (q, s) => Math.abs(q[0] - bed.x) >= (bw + s) / 2 - 0.05 || Math.abs(q[1] - bed.z) >= (bd + s) / 2 - 0.05;
    const spots = (s) => (Math.abs(dx) >= Math.abs(dz) ? [[1, 0], [0, 1]] : [[0, 1], [1, 0]]).map(([ax, az]) => laiClamp(ctx, [bed.x + ax * Math.sign(dx || 1) * (bw / 2 + s / 2 + 0.3), bed.z + az * Math.sign(dz || 1) * (bd / 2 + s / 2 + 0.3)], s / 2 + 0.2));
    for (const s of [st, 5, 3, 0]) { if (s > st) continue; const q = spots(s).find(p => clear(p, s)); if (q) { F.spot = q; st = s; break; } }
    if (!F.spot) { F.spot = spots(0)[0]; st = 0; } }
  if (st >= 3) ctx.mark(F.spot[0], F.spot[1], st, st, KEEP);
  const lines = [];
  if (d) { ccmWalk(ctx, 'approach', [d.inner, F.spot]); lines.push([d.inner, F.spot]); }
  for (const o of F.esc) { ccmWalk(ctx, 'escape', [F.spot, o.inner]); lines.push([F.spot, o.inner]); } // ESCAPE: the bolt hole is never blocked
  laiSight(ctx, bed);
  const list = (v) => (v || []).filter(Boolean);
  const hoard = list(K.hoard && K.hoard(ctx, F, bed)), feed = list(K.feed && K.feed(ctx, F, bed)), signs = d ? list(K.signs && K.signs(ctx, F, bed)) : [];
  const hole = !F.esc.length && K.escape ? K.escape(ctx, F, bed) : null;
  if (K.dress) K.dress(ctx, F, bed, lines);
  if (K.torches) { ccmWallLights(ctx, LAI_TORCH, d ? [d.side, ...F.lat] : F.lat, { every: 999, min: K.torches(F), max: K.torches(F), why: 'a torch on the wall' }); ccmEnsureLight(ctx, LAI_TORCH, LAI_STAND); }
  bed.lair = ctx.laiInfo = { kind: K.kind, bed: bed.id, spot: F.spot.map(v => +v.toFixed(1)), stand: st, hoard: hoard.length, feed: feed.length, signs: signs.length, escape: F.esc.length ? 'door' : hole ? hole.id : null };
  ccmDone(ctx);
  return { feature: bed, what: `${K.kind} den: ${K.bedName} in the far corner, ${hoard.length} of what it hoards, ${feed.length} at its feeding spot, ${signs.length} warning sign${signs.length === 1 ? '' : 's'} inside the door${F.esc.length ? ', a bolt hole kept clear' : hole ? `, a ${hole.id.replace(/-/g, ' ')} for a bolt hole` : ''}`, approach: null, passage: true };
}
// the leftovers: a carcass at the feeding spot with a stain under it and loose bones round it
// (in the half of the room the bed is NOT in, about `s` of the way out from the far wall: the bed, the creature's floor and
//  the way in fill the other half)
function laiFeed(ctx, F, bed, { under = ['decal-blood'], size = 5, s = 0.55, t = 0.7 } = {}) {
  const out = []; let c = null;
  for (const [g, h, r] of [[t, s, 3], [t + 0.08, s + 0.1, 4.5], [t - 0.1, s + 0.15, 5.5], [t, s, 8]]) if (!c) c = laiFree(ctx, LAI_CARCASS, laiClamp(ctx, F.at(F.L * (F.low ? g : 1 - g), F.deep * h), 2.5), r, 'its last meal: in the open floor, off the way in', { rule: 'den-feed', margin: 0.8 });
  if (!c) return out;
  out.push(c, laiFlat(ctx, under, c.x, c.z, laiTurn(ctx), 'under the carcass', { size: [size, size], over: true, rule: 'den-feed' }));
  for (let i = 0; i < (F.cells >= 20 ? 2 : 1); i++) { const a = laiTurn(ctx); out.push(ccmQuiet(ctx, () => ctx.rug('decal-bones-scatter', { at: [c.x + Math.cos(a) * 3.2, c.z + Math.sin(a) * 3.2], rot: a, why: 'gnawed bones round the carcass', rule: 'den-feed' }))); }
  return out;
}

// DRAGON'S HOARD (terminal, the heart of the lair): the hoard IS the bed. The great heap against the wall facing the way
// in; before it a hollow kept clear for the dragon (10 ft where the room allows), ringed by a crescent of smaller heaps,
// bars and chests that opens toward the door; soot in the hollow, on the feeding spot and inside the door.
const LAI_DRAGON = { kind: 'dragon', label: "dragon's hoard", bedName: 'the hoard it sleeps on', stand: 10,
  bed(ctx, F) {
    const size = F.small >= 28 ? 1 : F.small >= 18 ? 0.8 : 0.6;
    const heap = laiFocal(ctx, F.far, [['treasure-hoard-heap', size], ['dun-treasure-hoard', Math.max(0.8, size * 1.15)], ['coin-pile', 4 * size]], { label: 'the great heap', rule: 'den-bed', sku: { shape: '' }, why: 'the great heap of the hoard: against the wall facing the way in (it sleeps on it)' });
    if (!heap) return null;
    const ns = F.far === 'N' || F.far === 'S';
    const out = (ns ? Math.abs(heap.z - F.at(0, 0)[1]) : Math.abs(heap.x - F.at(0, 0)[0])) + (ns ? ctx.aabb(heap.dims[0], heap.dims[2], heap.rot)[1] : ctx.aabb(heap.dims[0], heap.dims[2], heap.rot)[0]) / 2; // the heap's front, ft out from the wall
    let st = Math.min(laiStand(this, F), Math.floor(F.deep - out - 3)); if (st < 3) st = 0; // the hollow: before the heap, wholly clear of it
    const t = ns ? heap.x - ctx.X0 : heap.z - ctx.Z0, C = F.at(Math.max(st / 2 + 0.2, Math.min(F.L - st / 2 - 0.2, t)), out + st / 2 + 0.4);
    F.spot = C; F.hollow = { C, st, out, t };
    return heap;
  },
  hoard(ctx, F, bed) {
    const { C, st, t } = F.hollow, got = [], n = SIDES[F.far].n, u = [n[0], n[1]], v = [u[1], -u[0]]; // u: out from the far wall; v: along it
    if (st >= 3) ctx.mark(C[0], C[1], st, st, KEEP);
    // the crescent: heaps beside the hollow, then its horns toward the door (a room of 5 x 5 cells and up)
    const ring = [[105, ['treasure-hoard-heap', 0.6]], [-105, ['dun-treasure-hoard', 0.8]], [60, ['gold-bars', 1.5]], [-60, ['silver-plate-pile', 1.6]], [140, ['armor-chainmail-heap', 1.4]], [-140, ['treasure-hoard-heap', 0.5]]].slice(0, F.small >= 23 ? 6 : F.small >= 16 ? 4 : 2);
    for (const [deg, want] of ring) { const a = deg * Math.PI / 180, dir = [u[0] * Math.cos(a) + v[0] * Math.sin(a), u[1] * Math.cos(a) + v[1] * Math.sin(a)];
      got.push(laiPut(ctx, [want, ['coin-pile', 1.8]], [2.2, 3, 3.8, 4.6, 5.6].map(e => [C[0] + dir[0] * (st / 2 + e), C[1] + dir[1] * (st / 2 + e), laiTurn(ctx)]), { layer: 'store', rule: 'den-hoard', sku: { shape: 's2' }, why: 'a heap of the hoard, ringing the hollow where it lies' })); }
    // chests against the far wall either side of the great heap, a crown left on the first; loose sacks by the heap
    const chests = laiWalls(ctx, ['chest-treasure', 'chest-treasure-open', 'chest-ironbound-open', 'mimic-chest', 'chest-ironbound', 'strongbox-stack'], [F.far, ...F.lat], Math.max(1, Math.min(6, Math.round(F.cells / 9))), 'a chest of the hoard, by the wall', { rule: 'den-hoard', layer: 'store', near: [bed.x, bed.z], prefer: 'near' });
    const lid = chests.find(p => /^chest-(treasure|ironbound)$/.test(p.id)); if (lid) ccmOn(ctx, 'crown', lid, 0, 0, 'a crown left on the lid');
    for (let i = 0; i < Math.min(3, Math.round(F.cells / 14)); i++) got.push(laiFree(ctx, ['loot-sack', 'gold-bars', ['coin-pile', 0.7]], [bed.x, bed.z], Math.max(bed.dims[0], bed.dims[2]) / 2 + 4, 'spilled from the heap', { rule: 'den-hoard', layer: 'store', margin: 0.3 }));
    void t;
    return [...got, ...chests];
  },
  feed(ctx, F, bed) { return laiFeed(ctx, F, bed, { under: LAI_SCORCH, size: 7, s: 0.74, t: 0.74 }); },
  signs(ctx, F, bed) {
    const d = F.d, out = [], n = SIDES[d.side].n;
    for (const [s, size] of [[3.2, 6], [8.5, 8]].slice(0, F.deep >= 22 ? 2 : 1)) out.push(laiFlat(ctx, LAI_SCORCH, ...laiClamp(ctx, [d.inner[0] + n[0] * s, d.inner[1] + n[1] * s], size * 0.71 + 0.1), laiTurn(ctx), 'the floor burnt black inside the way in', { size: [size, size], over: true, rule: 'den-sign' }));
    out.push(laiFree(ctx, LAI_DEAD, d.inner, 8, 'one who got this far: inside the way in', { rule: 'den-sign', margin: 0.4 }) || laiFree(ctx, [['bones-pile', 0.8], ['skull-pile', 0.8]], d.inner, 11, 'what is left of one who got this far', { rule: 'den-sign', margin: 0.4 }));
    out.push(...laiWalls(ctx, ['skull-pile'], [d.side], 1, 'skulls by the way in', { rule: 'den-sign', near: d.inner, prefer: 'near', k: 0.9, maxDist: 11 }));
    void bed;
    return out;
  },
  dress(ctx, F, bed, lines) {
    const { C, st } = F.hollow;
    laiFlat(ctx, LAI_SCORCH, C[0], C[1], laiTurn(ctx), 'soot and shed scales where it lies', { size: [Math.max(4, st * 0.9), Math.max(4, st * 0.9)], over: true });
    if (F.cells >= 42) laiWalls(ctx, [['dragon-skull', 0.55]], [F.otherSide, F.bedSide], 1, 'the skull of a rival, kept by the wall', { jitter: 0.2 });
    if (F.cells >= 12) laiWalls(ctx, LAI_ROCK, [...F.lat, F.d ? F.d.side : F.far], Math.max(1, Math.min(4, Math.round(F.cells / 14))), 'rock left standing by the wall', { prefer: 'corner' });
    laiScatter(ctx, [...LAI_SCORCH, ...LAI_BONES], Math.max(2, Math.min(6, Math.round(F.area / 200))), 'on the burnt floor', lines);
    void bed;
  } };

// GIANT-SPIDER NEST (terminal): the web fills the far corner (a sheet over the floor, webs up both walls) with the egg
// sacs in it; its catch is wrapped and kept along the walls; webs over the floor and on every wall; no light at all.
const LAI_COCOON = [['web-cocoon', 1], ['rite-mummified-remains', 1]], LAI_EGGS = [['egg-sacs-floor', 1.2], ['eggs-monster', 1.3]];
const LAI_SPIDER = { kind: 'spider', label: 'spider nest', bedName: 'the web', stand: 5,
  bed(ctx, F) {
    const sz = Math.max(5, Math.min(11, F.small - 3)), c = F.corner(sz / 2 + 0.2);
    laiFlat(ctx, LAI_WEB, c[0], c[1], SIDES[F.far].rot + (F.low ? 0 : -Math.PI / 2), 'the web: a sheet over the floor of the far corner', { size: [sz, sz], rule: 'den-web' });
    F.web = { c, sz };
    const fk = F.small >= 23 ? 1 : F.small >= 17 ? 0.8 : 0.62, fs = ccmSize(ctx, 'web-funnel')[0] * fk, fc = F.corner(fs / 2 + 0.25), fr = Math.atan2(F.mid[0] - fc[0], F.mid[1] - fc[1]);
    const funnel = F.small >= 13 ? laiPut(ctx, [['web-funnel', fk]], [[fc[0], fc[1], Math.round(fr / (Math.PI / 2)) * (Math.PI / 2)]], { layer: 'anchor', rule: 'den-bed', why: 'the funnel of its web: filling the far corner, its mouth to the room', unique: true, extra: { focal: true } }) : null;
    if (funnel) return funnel;
    return laiFree(ctx, [...LAI_EGGS, ...LAI_COCOON], F.corner(2.6), 3.5, 'in the heart of the web, in the far corner', { rule: 'den-bed', layer: 'anchor', margin: 0.3, unique: true })
      || laiFree(ctx, [['bones-pile', 1.4]], F.corner(2.6), 4, 'what is left in the heart of the web', { rule: 'den-bed', layer: 'anchor', margin: 0.3 });
  },
  hoard(ctx, F, bed) {
    const out = [], n = Math.max(1, Math.min(5, Math.round(F.cells / 8)));
    for (let i = 0; i < n; i++) out.push(laiFree(ctx, [['egg-sacs-floor', [1.3, 1, 1.6][i % 3]], ['eggs-monster', [1.5, 1, 1.9][i % 3]], ['web-cocoon', 0.8], ['rite-mummified-remains', 1], ['skull-pile', 0.7]], F.web.c, F.web.sz / 2 + 3, 'an egg sac in the web', { rule: 'den-hoard', layer: 'store', margin: 0.3 }));
    void bed;
    return out;
  },
  feed(ctx, F, bed) {
    const out = [], n = Math.max(2, Math.min(8, Math.round(F.cells / 5))), sides = [F.otherSide, F.far, F.bedSide, ...(F.d ? [F.d.side] : [])];
    for (let i = 0; i < n; i++) {
      const p = ccmHas(ctx, 'web-cocoon') ? laiWalls(ctx, ['web-cocoon'], [sides[i % sides.length]], 1, 'its catch: wrapped and kept by the wall', { rule: 'den-feed', layer: 'store', k: [1, 0.8, 1.15][i % 3], jitter: 0.5 })[0] : ccmLieAlong(ctx, 'rite-mummified-remains', [sides[i % sides.length]], { rule: 'den-feed', layer: 'store', why: 'its catch: wrapped and laid by the wall' });
      if (p) { out.push(p); laiFlat(ctx, LAI_WEB, ...laiClamp(ctx, [p.x, p.z], 2.2), laiTurn(ctx), 'web spun round the catch', { size: [4, 4], over: true }); }
    }
    void bed;
    return out;
  },
  signs(ctx, F, bed) {
    const d = F.d, n = SIDES[d.side].n, out = [];
    out.push(laiFlat(ctx, LAI_WEB, ...laiClamp(ctx, [d.inner[0] + n[0] * 2.6, d.inner[1] + n[1] * 2.6], 3.6), 0, 'web across the floor inside the way in', { size: [5, 5], over: true, rule: 'den-sign' }));
    out.push(laiFree(ctx, [...LAI_COCOON.slice(0, 1), ...LAI_DEAD], d.inner, 7, 'the first of its catch: just inside the way in', { rule: 'den-sign', margin: 0.4 }) || laiFree(ctx, [['bones-pile', 0.8], ['skull-pile', 0.8]], d.inner, 11, 'what it left inside the way in', { rule: 'den-sign', margin: 0.4 }));
    if (laiCobwebs(ctx, [d.side], 2, 'web hung on the wall by the way in')) out.push(ctx.placements[ctx.placements.length - 1]);
    void bed;
    return out;
  },
  dress(ctx, F, bed, lines) {
    laiCobwebs(ctx, [F.far, F.bedSide, F.otherSide, F.far, F.bedSide, ...(F.d ? [F.d.side] : [])], Math.max(4, Math.min(14, Math.round((ctx.W + ctx.D) * 2 / 8))));
    laiScatter(ctx, LAI_WEB, Math.max(2, Math.round(F.area / 70)), 'web over the floor', [], { size: (k) => [[4, 4], [6, 6], [3, 3]][k % 3] });
    laiScatter(ctx, LAI_BONES, Math.max(1, Math.round(F.area / 160)), 'dry bones under the webs', lines);
    if (F.cells >= 16) laiWalls(ctx, LAI_ROCK.slice(0, 1), F.lat, 1, 'rock left standing by the wall', { prefer: 'corner' });
    void bed;
  } };

// BEAST DEN (terminal: bear, wolves, owlbear): bedding in the far corner; the kill dragged into the open floor, with blood
// under it; what it has dragged home beside the bed; bones and a blood trail inside the mouth; no light, nothing made.
const LAI_BEAST = { kind: 'beast', label: 'beast den', bedName: 'its bedding', stand: 10,
  bed(ctx, F) {
    const k = F.small >= 18 ? 1 : 0.75, c = F.corner(4.6);
    laiFlat(ctx, ['rug-hay-scatter', 'rural-straw-bedding'], ...laiClamp(ctx, c, 4.1), laiTurn(ctx), 'trampled bedding under and round the nest', { size: [8, 8] });
    return laiFree(ctx, [['nest-giant', k], ['nest-monster', k], ['hay-pile', 1.25 * k]], c, 3, 'its bed: a nest of bedding in the far corner, away from the mouth', { rule: 'den-bed', layer: 'anchor', margin: 0.3, unique: true });
  },
  hoard(ctx, F, bed) {
    const r = Math.max(bed.dims[0], bed.dims[2]) / 2 + 4, out = [];
    out.push(laiFree(ctx, [...LAI_DEAD, ['bones-pile', 1.3]], [bed.x, bed.z], r, 'dragged home and kept by the bed', { rule: 'den-hoard', layer: 'store', margin: 0.3 }));
    out.push(laiFree(ctx, ['loot-sack', 'pelts-stack', 'tusks', ['skull-pile', 0.8]], [bed.x, bed.z], r, 'what it keeps by the bed', { rule: 'den-hoard', layer: 'store', margin: 0.3 }));
    if (F.cells >= 20) out.push(laiFree(ctx, [['bones-pile', 1.5]], [bed.x, bed.z], r + 2, 'old kills heaped by the bed', { rule: 'den-hoard', layer: 'store', margin: 0.3 }));
    return out;
  },
  feed(ctx, F, bed) { return laiFeed(ctx, F, bed, { under: ['decal-blood'], size: 5 }); },
  signs(ctx, F, bed) {
    const d = F.d, out = [];
    for (const f of [0.14, 0.3]) { const [x, z] = laiBetween(ctx, F, bed, f, 1.2, 'trail'); out.push(laiFlat(ctx, ['decal-claw-marks', 'decal-blood'], x, z, laiTurn(ctx), 'a blood trail in from the mouth', { size: [2.6, 2.6], over: true, rule: 'den-sign' })); }
    out.push(...laiWalls(ctx, [['bones-pile', 0.9], ['skull-pile', 0.8]], [d.side], F.cells >= 16 ? 2 : 1, 'bones thrown out by the mouth', { rule: 'den-sign', near: d.inner, prefer: 'near', maxDist: 11 }));
    void bed;
    return out;
  },
  dress(ctx, F, bed, lines) {
    laiWalls(ctx, [...LAI_ROCK, ['bones-pile', 1], ['skull-pile', 0.7]], [F.otherSide, F.far, F.bedSide], Math.max(1, Math.min(6, Math.round(F.cells / 6))), 'by the wall', { prefer: 'corner' });
    laiScatter(ctx, [...LAI_BONES, ...LAI_BONES, 'decal-moss', 'puddle'], Math.max(2, Math.round(F.area / 60)), 'on the den floor', lines);
    void bed;
  } };

// GOBLIN / KOBOLD WARREN (hub): a tribe's den, so the skeleton's beats are plural and it has a seventh: the chieftain's
// seat on the wall facing the way in. Bunks, pallets and bedrolls down one side wall; the cook fire in the middle with log
// seats round it; stolen goods heaped down the other side wall; a snare and skulls inside the door; a ladder for a bolt
// hole; torches (goblins use fire).
function laiWarren(ctx) {
  const F = laiFrame(ctx), { d, far, lat, L, deep, cells } = F, lines = [];
  const seat = laiFocal(ctx, far, ['bone-throne', 'throne', 'chair-armed'], { label: "the chieftain's seat", rule: 'key-seat', gap: 0.5 });
  if (!seat) return { fail: `warren has no chieftain's seat (${ctx.focal?.why || 'no throne mesh'})` };
  laiSight(ctx, seat);
  ccmScaled(ctx, 'skull-pile', 1.5, () => ccmFlank(ctx, seat, ['skull-pile', 'bones-pile'], { off: 0.5, layer: 'dress', rule: 'flank', why: "skulls heaped each side of the chieftain's seat" }));
  laiPut(ctx, ['banner-standard-war', 'banner-pole'], [3.2, 4, 5].map(e => [...F.at(L / 2 + (F.low ? e : -e), 1.1), SIDES[far].rot]), { rule: 'flank', why: "a stolen banner by the chieftain's seat" });
  const before = front(seat, 2.6);
  if (d) { ccmWalk(ctx, 'approach', [d.inner, before]); lines.push([d.inner, before]); }
  for (const o of F.esc) { ccmWalk(ctx, 'escape', [before, o.inner]); lines.push([before, o.inner]); }
  // (a hub's swirl is walked through the room's inset corners AFTER the program, attempt(): a way from the middle to each
  //  corner is kept clear now, so goods heaped down two walls never close a corner off)
  if (F.area >= 900) { const ins = Math.max(3, Math.min(6, F.small * 0.18)); for (const c of [[ctx.X0 + ins, ctx.Z0 + ins], [ctx.X1 - ins, ctx.Z0 + ins], [ctx.X1 - ins, ctx.Z1 - ins], [ctx.X0 + ins, ctx.Z1 - ins]]) { ctx.walk('reach', [F.mid, c]); ctx.paths.pop(); } }
  if (ccmHas(ctx, 'rug-bearskin') || ccmHas(ctx, 'rug-fur')) ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, ['rug-bearskin', 'rug-wolfskin', 'rug-fur']), { at: front(seat, 2.4), rot: seat.rot, why: "a skin before the chieftain's seat" }));
  // SIGNS: a snare beside the way in, skulls and spears at the door
  const signs = [];
  if (d) { const [tx, tz] = laiBetween(ctx, F, seat, Math.min(0.3, 5 / (deep || 5)), 2.3, 'trap');
    signs.push(laiFree(ctx, ['trap-bear', 'bear-trap', 'trap-spikes', 'pressure-plate'], [tx, tz], 2.5, 'a snare set beside the way in', { rule: 'den-sign', margin: 0.5 }));
    signs.push(...laiWalls(ctx, ['totem-skull', 'skull-pile', 'mil-spear-tripod'], [d.side], 2, 'a warning at the door', { rule: 'den-sign', near: d.inner, prefer: 'near', jitter: 0.2, k: 0.9, maxDist: 11 })); }
  // BED: the tribe sleeps down one side wall
  const nb = Math.max(2, Math.min(9, Math.round(cells / 6))), beds = [];
  if (Math.min(ctx.W, ctx.D) >= 18) beds.push(...laiWalls(ctx, ['bunk-crude', 'bunk-bed'], [F.bedSide], Math.max(1, Math.round(nb / 3)), 'a crude bunk against the side wall', { rule: 'den-bed', jitter: 0.06 }));
  beds.push(...laiWalls(ctx, ['bed-straw-pallet', 'bedroll', 'bed-straw-pallet'], [F.bedSide, ...(cells >= 30 ? [d ? d.side : far] : [])], nb - beds.length, 'a pallet on the floor by the wall', { rule: 'den-bed', jitter: 0.4 }));
  if (!beds.length) beds.push(...laiWalls(ctx, ['bedroll', 'bed-straw-pallet'], [F.otherSide, far, ...(d ? [d.side] : [])], 2, 'a bedroll on the floor by the wall', { rule: 'den-bed', jitter: 0.4 }));
  // FEED: the cook fire, off the walking line, log seats round it
  const fp = laiBetween(ctx, F, seat, 0.5, Math.min(4.5, L / 2 - 4), 'fire'), feed = [];
  let fire = null;
  if (cells >= 9) for (const [r, m, ids] of [[4, 2.2, ['campfire', 'firepit-stone-round']], [8, 2, ['campfire', 'firepit-stone-round']], [11, 1.6, ['campfire', 'firepit-stone-round', 'fire-ring-iron', 'cauldron-huge']], [16, 1.2, ['fire-ring-iron', 'cauldron-huge']]]) if (!fire) fire = laiFree(ctx, ids, fp, r, 'the cook fire: in the middle of the warren', { rule: 'den-feed', layer: 'light', margin: m, rot: 0, unique: true });
  if (fire) { feed.push(fire); ccmClearRound(ctx, fire, 0.9);
    const ns = Math.min(4, Math.max(2, Math.round(cells / 12)));
    for (let i = 0; i < ns; i++) { const a = laiSeed(ctx, 'seat') % 6 + i * 2 * Math.PI / ns, r = Math.max(fire.dims[0], fire.dims[2]) / 2 + 2.4, x = fire.x + Math.cos(a) * r, z = fire.z + Math.sin(a) * r;
      feed.push(laiPut(ctx, i % 2 ? ['stool-three-leg', 'log-seat'] : ['log-seat', 'stool-three-leg'], [[x, z, Math.atan2(fire.x - x, fire.z - z)]], { rule: 'den-feed', why: 'a seat by the cook fire' })); }
    feed.push(laiFree(ctx, ['soup-cauldron-full', 'cauldron', ['bones-pile', 0.7]], [fire.x, fire.z], Math.max(fire.dims[0], fire.dims[2]) / 2 + 3.5, 'the pot, by the fire', { rule: 'den-feed', margin: 0.6 })); }
  // HOARD: stolen goods, heaped anyhow down the other side wall and into the far corner
  const loot = laiWalls(ctx, ['crate', 'barrel', 'sack', 'chest-plain-open', 'loot-sack', 'chest-plain', 'malt-sacks', 'trade-barrel-chalked', 'apple-crate', 'chest-ironbound', 'mil-shield-stack'], [F.otherSide, F.otherSide, far], Math.max(3, Math.min(12, Math.round(cells / 3.5))), 'stolen goods heaped by the wall', { rule: 'den-hoard', layer: 'store', jitter: 0.45, k: (i) => [1, 1.25, 0.85][i % 3] });
  // ESCAPE: a second door (kept clear above)
  const hole = null; // (no stand-in: a rolled ladder is a real stair since 2026-10-12 and would open the floor above; a second door is the warren's bolt hole)
  laiWalls(ctx, ['weapon-rack', 'drum-war', 'hide-drying-rack', 'woodpile', 'refuse-pile', 'bucket-slop'], [d ? d.side : far, far, F.bedSide], Math.max(1, Math.min(4, Math.round(cells / 14))), 'against the wall', { jitter: 0.2 });
  laiScatter(ctx, [...LAI_BONES, ...LAI_BONES, 'rug-hay-scatter', 'decal-dirt-patch', ...LAI_BONES, 'puddle'], Math.max(3, Math.round(F.area / 60)), 'gnawed bones and filth on the trodden floor', lines, { clear: 1 });
  const torches = Math.max(2, Math.min(5, Math.round(F.area / 260)));
  ccmWallLights(ctx, LAI_TORCH, d ? [d.side, ...lat, far] : [...lat, far], { every: 999, min: torches, max: torches, why: 'a torch on the wall' });
  ccmEnsureLight(ctx, LAI_TORCH, LAI_STAND);
  const ok = (a) => a.filter(Boolean).length;
  seat.lair = ctx.laiInfo = { kind: 'goblin', bed: beds[0]?.id || null, spot: before.map(v => +v.toFixed(1)), stand: 0, beds: beds.length, hoard: ok(loot), feed: ok(feed), signs: ok(signs), escape: F.esc.length ? 'door' : hole ? hole.id : null, seat: seat.id };
  ccmDone(ctx);
  return { feature: seat, what: `goblin warren: the chieftain's seat facing the way in, ${beds.length} beds down one wall, ${fire ? 'the cook fire in the middle' : 'no fire'}, ${ok(loot)} heaps of stolen goods`, approach: null, passage: true };
}

// LARDER (terminal): the kill is kept here. Carcasses hang in rows over the far half of the floor, the chopping block
// stands under the first of them with blood round it, racks and salt along the walls, the next meal still alive in a
// cage in a far corner; a keeper's torch by the door.
function laiLarder(ctx) {
  const F = laiFrame(ctx), { d, far, lat, L, deep, cells } = F, lines = [];
  const block = laiPut(ctx, ['butcher-block', 'chopping-block-kitchen', 'block-headsman'], [0.45, 0.55, 0.38, 0.62].map(f => [...F.at(L / 2, deep * f), SIDES[far].rot]), { layer: 'anchor', rule: 'key-block', why: 'the chopping block: in the middle of the floor', unique: true, extra: { focal: true } });
  const hung = [], rows = Math.max(1, Math.min(3, Math.floor(deep / 9))), per = Math.max(1, Math.min(5, Math.floor((L - 2) / 4.6)));
  if (ccmHas(ctx, 'carcass-hanging')) for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
    const [x, z] = F.at(Math.max(2.9, Math.min(L - 2.9, (i + 0.5) * L / per)), 3 + r * 4.6);
    if (block && Math.hypot(x - block.x, z - block.z) < 2) continue;
    const p = ccmQuiet(ctx, () => ccmScaled(ctx, 'carcass-hanging', 1, () => ctx.ceiling('carcass-hanging', { at: [x, z], layer: 'store', rule: 'hung-kill', why: 'a kill hung from the roof to keep' }))); if (p) hung.push(p);
  }
  const key = block || hung[0];
  if (!key) return { fail: 'larder has neither a chopping block nor a hung carcass' };
  ctx.focal = { label: 'the chopping block under the hung kills', id: key.id, ok: true };
  laiSight(ctx, key);
  if (d) { const to = block ? front(block, 1.6) : F.at(L / 2, deep * 0.6); ccmWalk(ctx, 'approach', [d.inner, to]); lines.push([d.inner, to]); for (const o of F.esc) { ccmWalk(ctx, 'branch', [o.inner, to]); lines.push([o.inner, to]); } }
  if (block) { laiFlat(ctx, ['decal-blood'], block.x, block.z, laiTurn(ctx), 'blood round the block', { size: [5, 5], over: true }); ccmOn(ctx, ccmFirst(ctx, ['meat-raw-joint', 'bone-meaty']), block, 0, 0, 'on the block'); }
  const racks = laiWalls(ctx, ['smoked-meat-rack', 'hide-drying-rack'], [far, ...lat], Math.max(1, Math.min(4, Math.round(cells / 7))), 'a rack of smoked meat against the wall', { layer: 'store', jitter: 0.05 });
  const cage = cells >= 9 ? laiPut(ctx, [['cage-sacrifice', 0.9], ['cage-floor', 0.8]], [[...F.corner(3.2), SIDES[far].rot], [...F.corner(3.8), SIDES[far].rot]], { layer: 'store', rule: 'live-prey', why: 'the next meal, still alive: a cage in the far corner' }) : null;
  laiWalls(ctx, ['barrel', 'salt-sack', 'sack', 'barrel', 'crate', 'bucket', 'trade-barrel-chalked'], [...lat, far, ...(d ? [d.side] : [])], Math.max(2, Math.min(9, Math.round(cells / 3.5))), 'stores along the wall', { layer: 'store', jitter: 0.25 });
  laiScatter(ctx, ['decal-blood', 'rug-hay-scatter', 'puddle'], Math.max(1, Math.round(F.area / 140)), 'on the larder floor', lines);
  ccmWallLights(ctx, LAI_TORCH, d ? [d.side] : lat, { every: 999, min: 1, max: 1, why: "the keeper's torch by the door" }); ccmEnsureLight(ctx, LAI_TORCH, LAI_STAND);
  ctx.laiInfo = { kind: 'larder', hung: hung.length, racks: racks.length, cage: !!cage };
  ccmDone(ctx);
  return { feature: key, what: `larder: ${hung.length} kills hung in ${rows} row${rows > 1 ? 's' : ''}${block ? ', the chopping block under them' : ''}, ${racks.length} racks${cage ? ', a cage of live prey' : ''}`, approach: null, passage: true };
}

// HATCHERY (terminal, deep): the great clutch in the middle of the floor on a bed of straw, a brazier each side to keep it
// warm (half of them: something tends these eggs); smaller clutches on straw round the walls; the brood mother's nest
// in the far corner with her own floor before it.
function laiHatchery(ctx) {
  const F = laiFrame(ctx), { d, far, lat, L, deep, cells } = F, EGG = [['dragon-eggs', 1], ['eggs-monster', 1]], STRAW = ['rug-hay-scatter', 'rural-straw-bedding'], lines = [];
  if (!laiPairs(ctx, EGG).length) return { fail: 'hatchery has no eggs (no egg mesh in the library yet)' };
  const big = F.small >= 18 ? 2 : 1.5, EGG1 = [['dragon-eggs', F.small >= 18 ? 1.3 : 1], ['eggs-monster', big]];
  // the great clutch lies IN a nest (eggs loose on the floor read as fruit in a pantry): the nest first, the eggs recorded in its hollow
  const gn = F.small >= 13 ? laiPut(ctx, [['nest-giant', F.small >= 18 ? 0.8 : 0.62], ['nest-monster', 0.8]], [0.5, 0.42, 0.58].map(f => [...F.at(L / 2, deep * f), 0]), { layer: 'anchor', rule: 'key-nest', why: 'the great nest: in the middle of the floor', unique: true }) : null;
  const inNest = (nest, k) => { for (const [id, s] of laiPairs(ctx, EGG1)) { const sk = ctx.chooseSku(id); if (!sk) continue; const dm = ccmScaled(ctx, id, s * k, () => ctx.dims(id, sk)); if (Math.max(dm.w, dm.d) > Math.min(nest.dims[0], nest.dims[2]) * 0.72) continue; return ctx.record(id, sk, dm, nest.x, Math.max(0.5, nest.dims[1] * 0.3), nest.z, laiTurn(ctx), 'anchor', 'key-clutch', 'the great clutch: in the hollow of the nest', { on: nest.uid, focal: true }); } return null; };
  const clutch = (gn && (inNest(gn, 1) || inNest(gn, 0.7))) || laiPut(ctx, EGG1, [0.5, 0.42, 0.58].map(f => [...F.at(L / 2, deep * f), 0]), { layer: 'anchor', rule: 'key-clutch', why: 'the great clutch: in the middle of the floor', unique: true, extra: { focal: true } });
  if (!clutch) return { fail: 'hatchery has no floor for its clutch' };
  ctx.focal = { label: 'the great clutch', id: clutch.id, ok: true, centre: true };
  laiSight(ctx, clutch);
  laiFlat(ctx, STRAW, clutch.x, clutch.z, laiTurn(ctx), 'a bed of straw under the clutch', { size: [Math.min(8, F.small - 2), Math.min(8, F.small - 2)], over: true });
  ccmClearRound(ctx, gn || clutch, 1.1);
  if (d) { const to = laiClamp(ctx, [clutch.x + Math.sign(d.inner[0] - clutch.x) * (Math.abs(d.inner[0] - clutch.x) > 2 ? clutch.dims[0] / 2 + 1.6 : 0), clutch.z + Math.sign(d.inner[1] - clutch.z) * (Math.abs(d.inner[1] - clutch.z) > 2 ? clutch.dims[2] / 2 + 1.6 : 0)], 1); ccmWalk(ctx, 'approach', [d.inner, to]); lines.push([d.inner, to]); for (const o of F.esc) { ccmWalk(ctx, 'branch', [o.inner, to]); lines.push([o.inner, to]); } }
  const tended = laiSeed(ctx, 'tended') % 2 === 0, warm = tended ? laiWalls(ctx, ['brazier-standing', 'brazier-tripod'], lat, 2, 'a brazier by the wall to keep the cave warm (beside the nest it read as a cooking fire)', { layer: 'light', jitter: 0, prefer: 'center' }) : [];
  const nest = cells >= 16 ? laiFree(ctx, [['nest-monster', 0.75], ['nest-giant', 0.6], ['hay-pile', 1.1]], F.corner(4.4), 3, "the brood mother's nest: in the far corner", { rule: 'den-bed', layer: 'anchor', margin: 0.3 }) : null;
  const n = Math.max(2, Math.min(7, Math.round(cells / 4.5))), clutches = [];
  for (let i = 0; i < n; i++) { const p = laiWalls(ctx, [['eggs-monster', [1, 1.35, 0.8, 1.15][i % 4]], ['egg-sacs-floor', 1], ['dragon-eggs', 0.7]], [[...lat, far, ...(d ? [d.side] : [])][i % (d ? 4 : 3)]], 1, 'a clutch on straw by the wall', { rule: 'clutch', layer: 'store', jitter: 0.6 })[0];
    if (p) { clutches.push(p); laiFlat(ctx, STRAW, ...laiClamp(ctx, [p.x, p.z], 2.3), laiTurn(ctx), 'straw under the clutch', { size: [4.2, 4.2], over: true }); } }
  laiWalls(ctx, [['bones-pile', 0.8], 'stalagmite', ['skull-pile', 0.7]], d ? [d.side] : lat, cells >= 12 ? 2 : 1, 'by the wall', { prefer: 'corner' });
  laiScatter(ctx, [...STRAW.slice(0, 1), ...LAI_BONES, 'decal-moss'], Math.max(1, Math.round(F.area / 120)), 'on the hatchery floor', lines);
  if (tended) ccmEnsureLight(ctx, LAI_TORCH, LAI_STAND);
  ctx.laiInfo = { kind: 'hatchery', clutches: clutches.length + 1, warm: warm.length, nest: nest?.id || null, tended };
  ccmDone(ctx);
  return { feature: clutch, what: `hatchery: the great clutch in the middle${warm.length ? ', braziers by the walls' : ''}, ${clutches.length} clutches on straw round the walls${nest ? ", the brood mother's nest in the far corner" : ''}`, approach: null, passage: true };
}

// PRISONER PIT (terminal): the pit in the middle of the floor (a painted hole where the library has one, else the
// grating over it), kept clear; cages against the walls, manacles between them, the ladder hung out of reach, straw and
// a slop bucket; the keeper's stool, keys and torch by the door.
function laiPit(ctx) {
  const F = laiFrame(ctx), { d, far, lat, L, deep, cells } = F, lines = [];
  const s = F.small >= 23 ? 10 : F.small >= 13 ? 5 : 0, c = F.at(L / 2, deep / 2);
  let pit = s ? laiFlat(ctx, ['pit-open'], c[0], c[1], 0, 'the pit: in the middle of the floor', { size: [s, s], rule: 'key-pit', layer: 'anchor', extra: { focal: true } }) : null;
  if (pit) { ctx.mark(c[0], c[1], s, s); for (const id of ['ladder-wood']) void id; }
  else pit = ccmCentre(ctx, ['oubliette-hatch', 'cage-floor'], { label: 'the pit', rule: 'key-pit', rot: SIDES[far].rot, why: 'the grating over the pit: in the middle of the floor' });
  if (!pit) return { fail: 'prisoner pit has no pit (no pit flat, grating or cage mesh)' };
  ctx.focal = { label: 'the pit', id: pit.id, ok: true, centre: true };
  laiSight(ctx, pit);
  const half = (s || Math.max(pit.dims[0], pit.dims[2])) / 2;
  if (d) { const n = SIDES[d.side].n, to = laiClamp(ctx, [c[0] - n[0] * (half + 1.6), c[1] - n[1] * (half + 1.6)], 1); ccmWalk(ctx, 'approach', [d.inner, to]); lines.push([d.inner, to]); for (const o of F.esc) { ccmWalk(ctx, 'branch', [o.inner, to]); lines.push([o.inner, to]); } }
  const cages = laiWalls(ctx, [['cage-sacrifice', 0.9], ['cage-floor', 0.85], ['gibbet-cage', 1]], [far, ...lat], cells >= 30 ? 3 : cells >= 16 ? 2 : 1, 'a cage against the wall', { rule: 'cage', jitter: 0.08, k: (i) => [1, 0.9, 1.05][i % 3] });
  const hung = castleHang(ctx, ['manacles-wall'], [...lat, far], Math.max(2, Math.min(6, Math.round(cells / 6))), { height: 4.4, why: 'manacles on the wall' });
  const ladder = null; // (a rolled ladder is a real stair since 2026-10-12: none here)
  for (const p of cages) laiFlat(ctx, ['rug-hay-scatter'], ...laiClamp(ctx, front(p, 1.4), 2), laiTurn(ctx), 'filthy straw by the cage', { size: [3.6, 3.6], over: true });
  laiWalls(ctx, ['skeleton-chained', 'bucket-slop', 'shackles-leg', ['bones-pile', 0.8], 'bucket-slop', 'chain-pile'], [...lat, far], Math.max(2, Math.min(6, Math.round(cells / 6))), 'by the wall', { jitter: 0.3 });
  if (d) { laiWalls(ctx, ['stool-three-leg', 'barrel'], [d.side], 1, "the keeper's seat by the door", { near: d.inner, prefer: 'near', jitter: 0.2 }); if (ccmHas(ctx, 'key-hook-board')) ccmQuiet(ctx, () => ctx.mount('key-hook-board', { sides: [d.side], height: 5, why: 'the keys, by the door' })); }
  laiScatter(ctx, [...LAI_BONES, 'decal-blood', 'puddle'], Math.max(1, Math.round(F.area / 110)), 'on the floor round the pit', lines);
  ccmWallLights(ctx, LAI_TORCH, d ? [d.side] : lat, { every: 999, min: 1, max: cells >= 30 ? 2 : 1, why: "the keeper's torch by the door" }); ccmEnsureLight(ctx, LAI_TORCH, LAI_STAND);
  ctx.laiInfo = { kind: 'pit', pit: pit.id, size: s, cages: cages.length, hung, ladder: !!ladder };
  ccmDone(ctx);
  return { feature: pit, what: `prisoner pit: ${s ? `a ${s}-ft pit` : 'the grating over the pit'} in the middle of the floor, ${cages.length} cage${cages.length === 1 ? '' : 's'} against the walls, ${hung} sets of manacles`, approach: null, passage: true };
}

// TROPHY CAVE (passage: a gallery walked through on the way to the heart of the lair): the middle is kept clear from end
// to end; down both long walls stand what it took from those who came for it (their armour on stands, their weapons,
// shields and banners) with heads and shields hung above; at the far end, when there is no way on, the best of it on a
// plinth between two heaps of skulls.
function laiTrophy(ctx) {
  const F = laiFrame(ctx), { d, cells } = F, line = throughLine(ctx), long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D);
  if (!line.path.ok) return { fail: 'trophy cave: the way through is blocked' };
  for (const o of ctx.doors) { if ((o.inner[0] === line.a[0] && o.inner[1] === line.a[1]) || (o.inner[0] === line.b[0] && o.inner[1] === line.b[1])) continue; ccmWalk(ctx, 'branch', [o.inner, line.mid]); }
  let prize = null;
  if (ctx.doors.length <= 1 && d) { const end = OPP_SIDE[d.side];
    prize = laiFocal(ctx, end, [['dragon-skull', wide >= 13.5 ? 0.7 : 0.5], ['pedestal-display', 1], ['skull-pile', 2.2]], { label: 'the prize', rule: 'key-prize', gap: 0.6, allowKeep: true });
    if (prize && prize.id === 'pedestal-display') ccmOn(ctx, ccmFirst(ctx, ['skull-monster', 'crown', 'helm-great', 'skull-single']), prize, 0, 0, 'the prize, on its plinth');
    if (prize) ccmFlank(ctx, prize, ['banner-standard-war', 'banner-pole', 'totem-skull'], { off: 0.5, layer: 'dress', why: 'a taken banner each side of the prize' }); }
  const stood = wide >= 8.5 ? laiWalls(ctx, ['pedestal-display', 'mil-shield-stack', 'totem-skull', 'banner-pole', 'pedestal-display', 'hide-drying-rack', 'weapon-rack', 'statue-petrified'], long, Math.max(2, Math.min(14, Math.round(Lr / 5.5))), 'taken from those who came: stood down the wall', { rule: 'trophy', jitter: 0.08 }) : [];
  const hungN = castleHang(ctx, ['monster-head-trophy', 'trophy-head', 'shield-display', 'heraldic-shield', 'trophy-head', 'horn-hunting'], [...long, ...ctx.shortSides()], Math.max(2, Math.min(12, Math.round(Lr / 6))), { height: 5.8, why: 'a head or a shield hung on the wall' });
  for (const [i, p] of stood.filter(q => q.id === 'pedestal-display').entries()) ccmOn(ctx, ccmFirst(ctx, [['crown', 'helm-great', 'skull-single', 'skull-monster'][i % 4], 'helm-great', 'skull-single']), p, 0, 0, 'a trophy on its plinth');
  if (!prize && !stood.length && !hungN) return { fail: 'trophy cave has no trophies (nothing fits)' };
  const key = prize || stood[0] || ctx.placements.find(p => p.rule === 'wall-mount');
  ctx.focal = { label: 'the trophies down the walls', id: key.id, ok: true };
  laiScatter(ctx, [...LAI_BONES, 'decal-moss'], Math.max(1, Math.round(F.area / 140)), 'on the floor', [[line.a, line.b]]);
  ctx.laiInfo = { kind: 'trophy', stood: stood.length, hung: hungN, prize: prize?.id || null };
  ccmDone(ctx);
  void cells;
  return { feature: prize || null, what: `trophy cave: a clear way down the middle, ${stood.length} trophies stood down the walls, ${hungN} hung${prize ? ', the prize at the far end' : ''}`, approach: null, passage: true };
}

// CAVE PASSAGE (passage: the connective tissue of a lair). The way through WINDS: the walking line is laid first, door
// to door, bending from side to side about every 9 ft (kept clear), and rock is then left standing in the pocket the
// line bends away from. One cell wide, the line is straight and nothing stands. Whose passage it is shows by seed (old
// bones; webs; trodden and torch-lit) and is the next room's cue.
function laiPassage(ctx) {
  const long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D), style = ['bones', 'webs', 'trodden'][laiSeed(ctx, 'passage') % 3], rock = [];
  let a, b; const d = ctx.mainDoor;
  if (ctx.doors.length >= 2) { let best = -1; for (const x of ctx.doors) for (const y of ctx.doors) { const dd = Math.hypot(x.inner[0] - y.inner[0], x.inner[1] - y.inner[1]); if (dd > best) { best = dd; a = x.inner; b = y.inner; } } }
  else if (d) { a = d.inner; const n = SIDES[d.side].n; b = laiClamp(ctx, [a[0] + n[0] * 99, a[1] + n[1] * 99], 2); }
  else { a = ctx.sidePoint(ctx.shortSides()[0], ctx.sideLen(ctx.shortSides()[0]) / 2, 1.5); b = ctx.sidePoint(ctx.shortSides()[1], ctx.sideLen(ctx.shortSides()[1]) / 2, 1.5); }
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, lat = [dz / len, -dx / len], amp = Math.min(2.4, wide / 2 - 2.3), bends = [];
  if (amp >= 1 && len >= 13) { const n = Math.max(1, Math.round(len / 9)), s0 = laiSeed(ctx, 'bend') % 2 ? 1 : -1;
    for (let i = 0; i < n; i++) { const f = (i + 0.5) / n, sg = i % 2 ? -s0 : s0; bends.push({ p: laiClamp(ctx, [a[0] + dx * f + lat[0] * amp * sg, a[1] + dz * f + lat[1] * amp * sg], 1.6), f, sg }); } }
  let path = ctx.walk('through', [a, ...bends.map(q => q.p), b]);
  if (!path.ok && bends.length) { ctx.paths.pop(); bends.length = 0; path = ctx.walk('through', [a, b]); }
  if (!path.ok) return { fail: 'cave passage: the way through is blocked' };
  const mid = bends.length ? bends[Math.floor(bends.length / 2)].p : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (const o of ctx.doors) { if ((o.inner[0] === a[0] && o.inner[1] === a[1]) || (o.inner[0] === b[0] && o.inner[1] === b[1])) continue; ccmWalk(ctx, 'branch', [o.inner, mid]); }
  // rock in the pockets: against the wall the line bends away from, level with the bend
  for (const q of bends) { const tgt = [a[0] + dx * q.f - lat[0] * wide * q.sg, a[1] + dz * q.f - lat[1] * wide * q.sg], side = long.slice().sort((s1, s2) => Math.hypot(...ctx.sidePoint(s1, ctx.sideLen(s1) / 2, 0).map((v, i) => v - tgt[i])) - Math.hypot(...ctx.sidePoint(s2, ctx.sideLen(s2) / 2, 0).map((v, i) => v - tgt[i])))[0];
    const id = ccmAny(ctx, ['boulder-pile', 'stalagmite', 'boulder-pile', 'rock-outcrop']) || ccmAny(ctx, ['bones-pile', 'skull-pile']); if (!id) break;
    const p = ccmQuiet(ctx, () => ccmScaled(ctx, id, id === 'rock-outcrop' ? 0.6 : wide >= 13.5 ? 1.2 : 0.8, () => ctx.put(id, (dm) => ctx.wallGen(dm, [side], { gap: 0.1 }), (c) => Math.hypot(c.x - tgt[0], c.z - tgt[1]), { layer: 'furnish', rule: 'rock', why: 'rock left standing: the way bends round it' })));
    if (p) rock.push(p); }
  const keep = [[a, ...bends.map(q => q.p), b]].flatMap(pts => pts.slice(1).map((q, i) => [pts[i], q])), n = Math.max(1, Math.round(ctx.area() / 60));
  if (style === 'webs') { laiCobwebs(ctx, [...long, ...ctx.shortSides()], Math.max(2, Math.min(8, Math.round(Lr / 7)))); laiScatter(ctx, LAI_WEB, n, 'web over the floor', [], { size: (k) => [[3, 3], [4.5, 4.5]][k % 2] }); }
  else if (style === 'trodden') { laiScatter(ctx, ['decal-dirt-patch', 'puddle', 'rug-hay-scatter', ...LAI_BONES], n + 1, 'on the trodden floor', keep); ccmWallLights(ctx, LAI_TORCH, long, { every: 999, min: 1, max: Math.max(1, Math.round(Lr / 28)), why: 'a torch left burning in the passage' }); }
  else laiScatter(ctx, [...LAI_BONES, ...LAI_BONES, 'puddle', 'decal-moss', 'decal-blood'], n + 1, 'old bones on the passage floor', keep);
  if (style !== 'webs') laiCobwebs(ctx, long, 1);
  ctx.laiInfo = { kind: 'passage', style, rock: rock.length, bends: bends.length, doors: ctx.doors.length };
  ccmDone(ctx);
  return { feature: null, what: `cave passage ${Math.round(Lr)} ft long (${style}): ${bends.length ? `the way winds through ${bends.length} bend${bends.length === 1 ? '' : 's'}, ${rock.length} stand${rock.length === 1 ? '' : 's'} of rock in the pockets` : 'a clear way through'}`, approach: null, passage: true };
}

// CAVE MOUTH (outdoor: the ground before the lair; the entrance of the whole site). Open ground with no edge of its own.
// The way in is kept clear from the open side to the lair's door; skulls heaped either side of it where it reaches the
// door, bones and the dead along it; off to one side the cold camp of the last party who came (fire ring, bedrolls, a
// log, their packs); scrub at the edges away from the door. Dark: nobody keeps a light here.
function laiMouth(ctx) {
  const A = ctx.area(), target = ctx.densityTarget = yardTarget(A), want = Math.max(4, Math.round(target * A / 100)), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const count = () => ctx.placements.filter(p => p.orient !== 'floor').length, room = () => count() < Math.round(want * 1.3);
  const gate = ctx.openings.find(o => o.kind === 'gate') || null, doors = ctx.doors, lair = doors[0] || null;
  const gatePt = gate ? ctx.sidePoint(gate.side, gate.index * CELL - INSET + CELL / 2, 2.6) : null;
  // the lair's side: its door, or (standing alone) the side facing the open side
  const inSide = lair ? lair.side : gate ? OPP_SIDE[gate.side] : 'N', L = ctx.sideLen(inSide), deep = inSide === 'N' || inSide === 'S' ? ctx.D : ctx.W;
  const at = (t, s) => ctx.sidePoint(inSide, t, s), mouthT = lair ? (inSide === 'N' || inSide === 'S' ? lair.inner[0] - ctx.X0 : lair.inner[1] - ctx.Z0) : L / 2, mouth0 = lair ? lair.inner : at(L / 2, 1.5);
  // standing alone (no lair's door on this ground) the cave mouth itself stands at the lair's edge, its opening to the clearing;
  // beside a lair, the lair's own door is the mouth and rock stands either side of it
  const cave = !lair ? laiCap(ctx, 8.95, () => laiPut(ctx, ['cave-mouth'], [0.4, 0.8].map(g => [...at(mouthT, ccmSize(ctx, 'cave-mouth')[1] / 2 + g), SIDES[inSide].rot]), { layer: 'anchor', rule: 'key-mouth', why: 'the cave mouth: at the edge of the clearing, its opening to the way in', unique: true, extra: { focal: true } })) : null;
  const mouth = cave ? front(cave, 1.4) : mouth0, from = gatePt || at(mouthT, deep - 2), lines = [[from, mouth]];
  ccmWalk(ctx, 'path', [from, mouth], { width: YARD.path });
  for (const sg of [-1, 1]) laiCap(ctx, 8.95, () => laiPut(ctx, [['rock-outcrop', 0.75], ['boulder-pile', 1.4]], [9, 10.5, 12, 14].map(e => [...at(mouthT + sg * e, 3.4), SIDES[inSide].rot + sg * 0.3]), { layer: 'anchor', rule: 'rock', why: 'rock either side of the mouth' }));
  for (const o of doors.slice(1)) { ccmWalk(ctx, 'path', [o.inner, mouth], { width: YARD.path }); lines.push([o.inner, mouth]); }
  // the warning: skulls either side of the way in, 4 to 7 ft out from the mouth; the dead along the way
  const signs = [];
  for (const sg of [-1, 1]) signs.push(laiPut(ctx, ['totem-skull', ['skull-pile', 2.3], ['bones-pile', 1.8]], [4.2, 5.2, 6.4, 7.6].map(e => [mouth[0] + (inSide === 'N' || inSide === 'S' ? sg * e : SIDES[inSide].n[0] * 2.2), mouth[1] + (inSide === 'N' || inSide === 'S' ? SIDES[inSide].n[1] * 2.2 : sg * e), SIDES[inSide].rot]), { layer: 'anchor', rule: 'den-sign', why: 'skulls heaped either side of the way in: the warning' }));
  const key = cave || signs.find(Boolean);
  if (!key) return { fail: 'cave mouth has no warning (no skull or bone mesh, or no ground for one)' };
  ctx.focal = { label: cave ? 'the cave mouth' : 'the skulls either side of the way in', id: key.id, ok: true };
  const dead = [];
  for (const f of [0.3, 0.6, 0.85].slice(0, A >= 900 ? 3 : 2)) { const p = [mouth[0] + (from[0] - mouth[0]) * f, mouth[1] + (from[1] - mouth[1]) * f]; dead.push(laiFree(ctx, f < 0.5 ? LAI_DEAD : [['bones-pile', 1.1], ['gnawed-carcass', 1], ['carcass-ribcage', 1]], p, 5.5, 'the dead along the way in', { rule: 'den-sign', margin: 0.6 })); }
  // loose bones ON the way in (flat, so the way stays clear: from the table camera they are what reads as bones), blood by the mouth
  for (const [f, off] of [[0.12, 1.4], [0.3, -1.6], [0.5, 1.2], [0.7, -1.5], [0.88, 1.6]].slice(0, A >= 700 ? 5 : 3)) { const lx = (from[1] - mouth[1]), lz = -(from[0] - mouth[0]), ll = Math.hypot(lx, lz) || 1, q = laiClamp(ctx, [mouth[0] + (from[0] - mouth[0]) * f + lx / ll * off, mouth[1] + (from[1] - mouth[1]) * f + lz / ll * off], 2.6);
    laiFlat(ctx, LAI_BONES, q[0], q[1], laiTurn(ctx), 'loose bones along the way in', { size: [4.2, 3.6], over: true, rule: 'den-sign' }); }
  laiFlat(ctx, ['decal-blood'], ...laiClamp(ctx, at(mouthT + 1.5, 4.5), 2.6), laiTurn(ctx), 'old blood before the mouth', { size: [4, 4], over: true, rule: 'den-sign' });
  // the last party's cold camp, off to one side
  const camp = [], sg = laiSeed(ctx, 'camp') % 2 ? 1 : -1, cp = laiClamp(ctx, at(mouthT + sg * Math.max(8, L * 0.3), deep * 0.58), 5);
  const fire = A >= 500 ? laiFree(ctx, ['campfire', 'firepit-stone-round', 'fire-ring-iron'], cp, 5, "the last party's camp: a cold fire ring, off the way in", { rule: 'camp', layer: 'furnish', margin: 3, rot: 0 }) : null;
  if (fire) { camp.push(fire); const k = Math.min(4, Math.max(2, Math.round(A / 450)));
    for (let i = 0; i < k; i++) { const a = (laiSeed(ctx, 'bedroll') % 6) + i * 2 * Math.PI / k, r = Math.max(fire.dims[0], fire.dims[2]) / 2 + 3.4, x = fire.x + Math.cos(a) * r, z = fire.z + Math.sin(a) * r;
      camp.push(laiPut(ctx, i === 1 ? ['log-seat', 'bedroll'] : ['bedroll', 'bed-straw-pallet'], [[x, z, Math.atan2(fire.x - x, fire.z - z) + (i === 1 ? 0 : Math.PI / 2)]], { rule: 'camp', why: 'left where they slept, round the cold fire' })); }
    for (const ids of [['loot-sack', 'sack'], ['crate', 'barrel'], ['mil-spear-tripod', 'woodpile']]) if (room()) camp.push(laiFree(ctx, ids, [fire.x, fire.z], 8, 'their packs, left behind', { rule: 'camp', margin: 0.8 })); }
  if (A >= 1400 && room()) laiFree(ctx, ['wagon-wreck', 'cart-hand', 'wagon'], laiClamp(ctx, at(mouthT - sg * Math.max(9, L * 0.3), deep * 0.7), 6), 7, 'their cart, left where it stopped', { rule: 'camp', margin: 1.5 });
  // rock and scrub at the edges away from the mouth; bones and scorched ground between
  const far = ['N', 'S', 'E', 'W'].filter(s => s !== inSide);
  for (let i = 0; i < Math.min(6, 2 + Math.round(A / 500)) && room(); i++) { const id = ccmAny(ctx, ['tree-burnt', 'boulder-pile', 'tree-burnt', 'bush', 'rock-outcrop', 'bush-berry']); if (!id) break;
    laiCap(ctx, 8.95, () => ccmQuiet(ctx, () => ccmScaled(ctx, id, /rock/.test(id) ? 0.6 : 1, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far[i % far.length]], { gap: 0.6, windows: false }), () => ctx.rng(), { layer: 'plants', rule: 'scrub', why: 'scrub, rock and burnt trees at the edge of the clearing' })))); }
  laiScatter(ctx, [...LAI_BONES, ...LAI_BONES, 'decal-dirt-patch', ...LAI_SCORCH, 'decal-grass-worn'], Math.max(3, Math.round(A / 110)), 'on the trampled ground', lines, { clear: 1 });
  const ok = (a) => a.filter(Boolean).length;
  ctx.yardInfo = { vibe: 'cave mouth', edge: 'none', edgePieces: 0, wallFt: 0, gate: gate ? gate.side : null, focal: { id: key.id, kind: 'warning skulls' }, signs: ok(signs), wear: 0, doors: doors.map(o => ({ to: o.to, side: o.side, things: [] })), plants: { placed: 0, slot: [], waiting: [] } };
  ctx.laiInfo = { kind: 'mouth', signs: ok(signs), dead: ok(dead), camp: ok(camp) };
  ccmDone(ctx);
  return { feature: key, what: `cave mouth: the way in kept clear, ${ok(signs)} heaps of skulls either side of it, ${ok(dead)} dead along it${fire ? ", the last party's cold camp off to one side" : ''}`, outdoor: true };
}

// the leg of an L-shaped lair room: bones and rock by the walls, never a second bed, heap or pit
function laiAnnex(ctx, { wall = [['bones-pile', 1], 'stalagmite', ['skull-pile', 0.8]], webs = 0, torch = false } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']);
  laiWalls(ctx, wall, sides, Math.max(1, Math.round(ctx.area() / 120)), 'against the wall');
  if (webs) laiCobwebs(ctx, sides, webs);
  laiScatter(ctx, LAI_BONES, 1, 'on the floor');
  if (torch) { ccmWallLights(ctx, LAI_TORCH, sides, { every: 999, min: 1, max: 1, why: 'a torch on the wall' }); ccmEnsureLight(ctx, LAI_TORCH, LAI_STAND); }
}
Object.assign(KEY, { 'lair-mouth': laiMouth, 'lair-passage': laiPassage, 'lair-warren': laiWarren, 'lair-beast': (ctx) => laiDen(ctx, LAI_BEAST), 'lair-spider': (ctx) => laiDen(ctx, LAI_SPIDER),
  'lair-larder': laiLarder, 'lair-pit': laiPit, 'lair-hatchery': laiHatchery, 'lair-trophy': laiTrophy, 'lair-dragon': (ctx) => laiDen(ctx, LAI_DRAGON) });
Object.assign(MENUS, {
  'lair-passage': ccmAnnex((ctx) => laiAnnex(ctx)), 'lair-beast': ccmAnnex((ctx) => laiAnnex(ctx)), 'lair-spider': ccmAnnex((ctx) => laiAnnex(ctx, { wall: LAI_COCOON, webs: 3 })),
  'lair-warren': ccmAnnex((ctx) => laiAnnex(ctx, { wall: ['crate', 'barrel', 'bed-straw-pallet', 'sack'], torch: true })), 'lair-larder': ccmAnnex((ctx) => laiAnnex(ctx, { wall: ['barrel', 'smoked-meat-rack', ['bones-pile', 1]], torch: true })),
  'lair-pit': ccmAnnex((ctx) => laiAnnex(ctx, { wall: ['bucket-slop', ['bones-pile', 1], 'shackles-leg'], torch: true })), 'lair-hatchery': ccmAnnex((ctx) => laiAnnex(ctx, { wall: [['eggs-monster', 1], ['bones-pile', 0.8]] })),
  'lair-trophy': ccmAnnex((ctx) => laiAnnex(ctx, { wall: ['armor-stand', ['skull-pile', 1], 'mil-shield-stack'] })), 'lair-dragon': ccmAnnex((ctx) => laiAnnex(ctx, { wall: [['coin-pile', 1.4], 'chest-ironbound', 'stalagmite'] })),
});
// (no indoor target under 3.5: test/yard.test.mjs holds the yard's against 0.6x of every other entry; no line for the cave mouth: it sets its own, as a yard does)
Object.assign(DENSITY, { 'lair-passage': 3.5, 'lair-warren': 5.5, 'lair-beast': 3.5, 'lair-spider': 4.5, 'lair-larder': 5.5, 'lair-pit': 4, 'lair-hatchery': 4.5, 'lair-trophy': 4.5, 'lair-dragon': 3.5 });
Object.assign(FOCAL, { 'lair-warren': "the chieftain's seat (wall facing the way in)", 'lair-beast': 'its bedding (the far corner)', 'lair-spider': 'the web (the far corner)', 'lair-larder': 'the chopping block under the hung kills', 'lair-pit': 'the pit (in the middle of the floor)',
  'lair-hatchery': 'the great clutch (in the middle of the floor)', 'lair-trophy': 'the prize at the far end (when there is no way on)', 'lair-dragon': 'the great heap of the hoard (wall facing the way in)', 'lair-mouth': 'the skulls either side of the way in' });
Object.assign(KEY_RE, { 'lair-mouth': null, 'lair-passage': null, 'lair-warren': /^(bone-throne|throne|chair-armed)$/, 'lair-beast': /^(nest-giant|nest-monster|hay-pile)$/, 'lair-spider': /^(web-funnel|egg-sacs-floor|eggs-monster|web-cocoon|rite-mummified-remains|bones-pile)$/,
  'lair-larder': /^(butcher-block|chopping-block-kitchen|block-headsman|carcass-hanging)$/, 'lair-pit': /^(pit-open|oubliette-hatch|cage-floor)$/, 'lair-hatchery': /^(dragon-eggs|eggs-monster)$/, 'lair-trophy': null, 'lair-dragon': /^(treasure-hoard-heap|dun-treasure-hoard|coin-pile)$/ });
// <<< type:lai
