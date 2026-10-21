// Layout solver: a procedural program Fauna writes ahead of time (Harry 2026-09-30: seeded randomness within rules,
// no LLM at runtime). Pure data in, pure data out; no three.js, so node can test it.
//
// Units are feet. North is -Z. A mesh's front faces its local +Z (checked on 10 TRELLIS meshes via Gemini, 2026-09-30),
// so an object standing against the N wall has rot 0, S wall rot PI, W wall rot PI/2, E wall rot -PI/2.
// Kit pieces are stretched to their catalog box; props scale uniformly (by height, or by footprint for flat-ish
// things), so heroic meshes keep their ~1.3x stoutness and the occupancy grid uses the real scaled bounds.
import { CELL, hash, meshFamily } from './walls.js';

export const RES = 0.5;      // occupancy grid, feet
export const INSET = 0.5;    // half wall thickness (walls are 12 in thick, centred on the grid line)
export const CEIL = 9;       // wall height 108 in
const FREE = 0, BLOCK = 1, KEEP = 2; // KEEP = keep clear (door approach, bar lane); small clutter may not use it

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIDES = {
  N: { rot: 0, n: [0, 1] }, S: { rot: Math.PI, n: [0, -1] },
  W: { rot: Math.PI / 2, n: [1, 0] }, E: { rot: -Math.PI / 2, n: [-1, 0] },
};
const SURFACE_RE = /^(table|desk|counter|bar-counter|workbench|chest|crate|barrel|cupboard|washstand|grain-bin|strongbox|linen-chest|chopping-block)/;
const SEAT_RE = /^(chair|stool|bench|settle)/;

// Harry's ratings filter (2026-10-01): a masking problem can make a mesh unusable whatever its stars, so masking-flagged
// meshes are hidden by default; below minStars is hidden; unrated meshes are always kept.
// Mesh orientation (2026-10-01): yaw (degrees, three.js sense: + = counter-clockwise seen from above) that turns the raw
// GLB's front to +Z. Sources, later wins: data/orient.json (Gemini front sweep) < Harry's corrections. Replaces the
// long-axis heuristic when present. Keyed by MESH, not sku (2026-10-02): inn-02 regenerated meshes under the same sku
// names, so a yaw measured on one mesh must never land on another. sku.mesh = "<src>/<sku>@<sha1-8 of the GLB>".
export function orientDeg(sku, opts) { const o = opts?.orient, k = sku?.mesh; return o && k && o[k] != null ? +o[k] : null; }
// kit pieces are stretched per axis: a 90/270 pre-turn swaps which mesh axis must reach the catalog width
export function kitScale(cw, cd, ch, b, yawDeg) {
  const q = ((Math.round(yawDeg || 0) % 180) + 180) % 180;
  return q === 90 ? [cd / b[0], ch / b[1], cw / b[2]] : [cw / b[0], ch / b[1], cd / b[2]];
}

export function skuUsable(s, opts = {}) {
  const m = s.model;
  if (!m) return true;
  if ((opts.hideMasking ?? true) && m.masking) return false;
  const min = opts.minStars ?? 3;
  return min < 0 || m.stars == null || m.stars >= min;
}

// Things that hang on a wall (catalog place "wall" covers both these and furniture that stands against a wall).
// Thin-and-short wall items hang; a few deep trophies are named. Harry 2026-10-02: the stag head and shield display stood on the floor.
const HUNG_IDS = new Set(['trophy-head', 'monster-head-trophy', 'torch-sconce', 'shelf-wall', 'bounty-poster', 'proclamation-scroll']);
export function isHung(o, id) { if (!o || o.place !== 'wall') return false; if (HUNG_IDS.has(id)) return true; const [, d, h] = o.size || []; return d <= 8 && h <= 48; }

export class Ctx {
  constructor({ lib, type, room, openings = [], locked = [], opts = {} }) {
    this.lib = lib; this.type = type; this.room = room; this.opts = opts;
    this.rng = mulberry32(hash(room.seed, room.type));
    this.X0 = room.x * CELL + INSET; this.X1 = (room.x + room.w) * CELL - INSET;
    this.Z0 = room.z * CELL + INSET; this.Z1 = (room.z + room.d) * CELL - INSET;
    this.W = this.X1 - this.X0; this.D = this.Z1 - this.Z0;
    this.nx = Math.round(this.W / RES); this.nz = Math.round(this.D / RES);
    this.grid = new Uint8Array(this.nx * this.nz);
    this.placements = []; this.unplaced = []; this.notes = []; this.surfaces = []; this.mounts = { N: [], S: [], E: [], W: [] };
    this.rugs = []; this.used = new Map(); this.uid = 0;
    this.openings = openings;
    this.doorT = { N: [], S: [], E: [], W: [] }; this.windowT = { N: [], S: [], E: [], W: [] };
    for (const o of openings) { // t = feet along the side measured from X0 (N/S) or Z0 (W/E)
      if (o.kind !== 'door' && o.kind !== 'window') continue; // a yard's openings also name its building walls and its gate
      const t0 = o.index * CELL - INSET, t1 = t0 + CELL;
      (o.kind === 'door' ? this.doorT : this.windowT)[o.side].push([t0, t1]);
      if (o.kind === 'door') this.keepClear(o.side, (t0 + t1) / 2, 4.5, 4.5);
    }
    this.lockedById = new Map();
    for (const p of locked) this.adoptLocked(p);
  }

  // ---------- small helpers ----------
  r(a = 0, b = 1) { return a + (b - a) * this.rng(); }
  ri(a, b) { return Math.floor(this.r(a, b + 1)); }
  chance(p) { return this.rng() < p; }
  shuffle(xs) { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  has(id) { const o = this.lib.objects[id]; return !!o && (!o.only || o.only.some(t => (this.type.tiers || []).includes(t))); } // o.only: every mesh of this role has an exclusive tier (build_data.py)
  slot(name) { return (this.type.slots[name] || []).filter(id => this.has(id)); }
  area() { return this.W * this.D; }
  sideLen(s) { return s === 'N' || s === 'S' ? this.W : this.D; }
  longSides() { return this.W >= this.D ? ['N', 'S'] : ['W', 'E']; }
  shortSides() { return this.W >= this.D ? ['W', 'E'] : ['N', 'S']; }
  doorSides() { return [...new Set(this.openings.filter(o => o.kind === 'door').map(o => o.side))]; }

  // pick n distinct ids (cycling if needed), favouring the least-used so rooms show variety
  pick(ids, n = 1) {
    ids = ids.filter(id => this.has(id) && this.skuPool(id).length);
    if (!ids.length) return [];
    const out = [];
    let pool = [];
    while (out.length < n) {
      if (!pool.length) pool = this.shuffle(ids).sort((a, b) => (this.used.get(a) || 0) - (this.used.get(b) || 0));
      out.push(pool.shift());
    }
    return out;
  }

  skuPool(id) {
    const o = this.lib.objects[id];
    return o.skus.filter(s => (s.kind === 'flat' || s.bounds) && skuUsable(s, this.opts));
  }

  // a sku's footprint at its nominal scale (no scale-variety roll), without using the rng
  nominalDims(id, sku) {
    const saved = this.opts;
    this.opts = { ...saved, scaleVariety: 0 };
    try { return this.dims(id, sku); } finally { this.opts = saved; }
  }

  chooseSku(id, want = {}) {
    let pool = this.skuPool(id);
    if (!pool.length) return null;
    const fam = pool.filter(s => s.family === (want.family ?? meshFamily(this.room.family)));
    if (fam.length) pool = fam;
    if (want.piece) { const p = pool.filter(s => s.piece === want.piece); if (p.length) pool = p; }
    else { const whole = pool.filter(s => !s.piece); if (whole.length) pool = whole; }
    // exclusive tiers (build_data.py: the mansion's 'noble', the storey kit's 'storey') are rolled only by room types that
    // list them in `tiers`, in that order of preference; every other room rolls exactly what it rolled before
    // (want.tiers overrides the room's list for one placement: [] = the plain meshes; want.shape names one variant)
    const tiers = want.tiers || this.type.tiers || [], named = want.shape !== undefined ? pool.filter(s => s.shape === want.shape) : [];
    if (named.length) pool = named;
    else { const open = pool.filter(s => !s.tier || s.tier === 'common' || s.tier === 'fine' || tiers.includes(s.tier)); if (open.length) pool = open; }
    if (!named.length && tiers.length) { const own = pool.filter(s => s.tier === tiers[0]); if (own.length) pool = own; }
    const tier = this.type.wealth === 'fine' ? 'fine' : 'common';
    const t = pool.filter(s => s.tier === tier || (!s.tier && tier === 'common'));
    if (t.length) pool = t;
    // want.maxD: only variants no deeper than that (feet) when any are, e.g. a foot chest in a band sized for one variant
    if (want.maxD) { const fit = pool.filter(s => s.kind !== 'mesh' || this.nominalDims(id, s).d <= want.maxD); if (fit.length) pool = fit; }
    return pool[Math.floor(this.rng() * pool.length)];
  }

  // local dims in feet (w along local X, d along local Z = front/back, h up) and the GLB scale that gets there
  dims(id, sku) {
    const o = this.lib.objects[id];
    const [cw, cd, ch] = (sku.size || o.size).map(v => v / 12); // sku.size: this mesh's own size (build_data, outdoors-02), else the catalog's
    if (sku.kind === 'flat') {
      // the image's own aspect is the truth for floor flats: lay the catalog box's long side along the image's long side
      if (o.place !== 'wall' && sku.px) {
        const L = Math.max(cw, cd), S = Math.min(cw, cd), k = sku.px[0] / sku.px[1];
        const [w, d] = k >= 1 ? [L, Math.max(S, L / k)] : [Math.max(S, L * k), L];
        return { w, d, h: ch, s: null };
      }
      return { w: cw, d: cd, h: ch, s: null };
    }
    const [bx, by, bz] = sku.bounds;
    if (o.place === 'kit' || sku.fit === 'box') { /* (fit box: a kit-generated piece that stands as a prop, the castle dais: build_data.py) */ const oy = orientDeg(sku, this.opts); return { w: cw, d: cd, h: ch, s: kitScale(cw, cd, ch, sku.bounds, oy), yaw: oy ? oy * Math.PI / 180 : 0 }; }
    // auto = largest dimension to largest dimension: immune to a mesh lying down that the catalog has standing up
    // (a 42-in lute case stays 42 in), and equal to "by height" for chairs, barrels, wardrobes.
    const rule = this.opts.sizeRule || 'auto';
    let s = rule === 'height' ? ch / by
      : rule === 'volume' ? Math.cbrt((cw * cd * ch) / (bx * by * bz))
        : rule === 'footprint' ? Math.max(cw, cd) / Math.max(bx, bz)
          : Math.max(cw, cd, ch) / Math.max(bx, by, bz);
    const v = this.opts.scaleVariety ?? 0.15;
    const [lo, hi] = o.scale;
    if (v > 0 && (lo < 1 || hi > 1)) s *= 1 + (this.r(lo, hi) - 1) * v;
    // Some meshes are modelled lengthwise along the other axis from their catalog box (2 of 3 bench-long meshes run
    // front-to-back). Pre-turn those by -90 deg so the long side matches the catalog: benches put their long side to
    // the wall, and bed-single s1's headboard (at -X) ends up at the back, against the wall.
    let ex = bx, ez = bz, yaw = 0;
    const oy = orientDeg(sku, this.opts);
    if (oy != null) { // known front: footprint = AABB of the bounds turned by that yaw (matters at 45 deg)
      yaw = oy * Math.PI / 180;
      const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw));
      ex = c * bx + sn * bz; ez = sn * bx + c * bz;
    } else {
      const catLong = cw / cd, meshLong = bx / bz;
      if ((catLong > 1.4 && meshLong < 1 / 1.4) || (catLong < 1 / 1.4 && meshLong > 1.4)) { yaw = -Math.PI / 2; [ex, ez] = [bz, bx]; }
    }
    return { w: ex * s, d: ez * s, h: by * s, s: [s, s, s], yaw };
  }

  // ---------- occupancy grid ----------
  aabb(w, d, rot) { const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot)); return [c * w + s * d, s * w + c * d]; }
  cells(x, z, aw, ad) {
    const i0 = Math.floor((x - aw / 2 - this.X0) / RES + 1e-6), i1 = Math.ceil((x + aw / 2 - this.X0) / RES - 1e-6);
    const j0 = Math.floor((z - ad / 2 - this.Z0) / RES + 1e-6), j1 = Math.ceil((z + ad / 2 - this.Z0) / RES - 1e-6);
    return [i0, i1, j0, j1];
  }
  fits(x, z, aw, ad, allowKeep = false) {
    const [i0, i1, j0, j1] = this.cells(x, z, aw, ad);
    if (i0 < 0 || j0 < 0 || i1 > this.nx || j1 > this.nz) return false;
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const g = this.grid[j * this.nx + i];
      if (g === BLOCK || (g === KEEP && !allowKeep)) return false;
    }
    return true;
  }
  mark(x, z, aw, ad, val = BLOCK) {
    const [i0, i1, j0, j1] = this.cells(x, z, aw, ad);
    for (let j = Math.max(0, j0); j < Math.min(this.nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(this.nx, i1); i++) {
      if (val === BLOCK || this.grid[j * this.nx + i] === FREE) this.grid[j * this.nx + i] = val;
    }
  }
  // world centre of a point t along a side, offset `off` feet into the room
  sidePoint(side, t, off) {
    const n = SIDES[side].n;
    if (side === 'N') return [this.X0 + t, this.Z0 + off];
    if (side === 'S') return [this.X0 + t, this.Z1 - off];
    if (side === 'W') return [this.X0 + off, this.Z0 + t];
    return [this.X1 - off, this.Z0 + t];
  }
  keepClear(side, t, width, depth) {
    const [x, z] = this.sidePoint(side, t, depth / 2);
    const horiz = side === 'N' || side === 'S';
    this.mark(x, z, horiz ? width : depth, horiz ? depth : width, KEEP);
  }
  overlapsT(ranges, a, b) { return ranges.some(([t0, t1]) => a < t1 && t0 < b); }

  // ---------- records ----------
  record(id, sku, dm, x, y, z, rot, layer, rule, why, extra = {}) {
    const o = this.lib.objects[id];
    const p = {
      uid: this.nextUid(), id, sku: sku.sku, kind: sku.kind, url: sku.url, place: o.place, layer, rule, why,
      x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), rot: +rot.toFixed(4), s: dm.s, dims: [+dm.w.toFixed(2), +dm.h.toFixed(2), +dm.d.toFixed(2)],
      catalog: o.size, ...(dm.yaw ? { yaw: dm.yaw } : {}), ...extra,
    };
    this.placements.push(p);
    this.used.set(id, (this.used.get(id) || 0) + 1);
    if (SURFACE_RE.test(id) && dm.h + y <= 4.6 && sku.kind !== 'flat' && !extra.parent) {
      const [aw, ad] = this.aabb(dm.w, dm.d, rot);
      const k = /round|barrel/.test(id) ? 0.62 : 0.8;
      this.surfaces.push({ uid: p.uid, id, x, z, w: aw * k, d: ad * k, top: y + dm.h, items: [] });
    }
    return p;
  }
  // uids skip any a locked (adopted) placement already holds, so a roll never hands a locked object's id to a newcomer
  nextUid() { let u; do { u = `${this.room.id}:${++this.uid}`; } while (this.placements.some(p => p.uid === u)); return u; }
  miss(id, why) { this.unplaced.push({ id, why }); return null; }

  adoptLocked(p) {
    const keep = { ...p, locked: true };
    this.placements.push(keep);
    this.lockedById.set(p.id, keep);
    this.used.set(p.id, (this.used.get(p.id) || 0) + 1);
    if (!p.parent && p.y < 0.5 && p.kind !== 'flat') {
      const [aw, ad] = this.aabb(p.dims[0], p.dims[2], p.rot);
      this.mark(p.x, p.z, aw, ad);
    }
    if (SURFACE_RE.test(p.id) && !p.parent) {
      const [aw, ad] = this.aabb(p.dims[0], p.dims[2], p.rot);
      this.surfaces.push({ uid: p.uid, id: p.id, x: p.x, z: p.z, w: aw * 0.8, d: ad * 0.8, top: p.y + p.dims[1], items: [] });
    }
  }
  lockedOne(id, unique) { return unique && this.lockedById.has(id) ? this.lockedById.get(id) : undefined; }

  // ---------- placement rules ----------
  // Stand against a wall, back to the wall, facing into the room.
  wall(id, { sides, prefer = 'random', near = null, layer = 'furnish', rule = 'against-wall', why = '', gap = 0.05, unique = false, sku: want, jitter = 0, allowKeep = false, maxDist = Infinity } = {}) {
    const lk = this.lockedOne(id, unique); if (lk !== undefined) return lk;
    if (!this.has(id)) return this.miss(id, 'not in library');
    if (isHung(this.lib.objects[id], id)) return this.mount(id, { sides, layer, why });
    const sku = this.chooseSku(id, want || {}); if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    let best = null;
    for (const side of sides || this.shuffle(['N', 'S', 'E', 'W'])) {
      const L = this.sideLen(side), rot = SIDES[side].rot + jitter * this.r(-1, 1);
      const [aw, ad] = this.aabb(dm.w, dm.d, rot);
      const along = side === 'N' || side === 'S' ? aw : ad, depth = side === 'N' || side === 'S' ? ad : aw;
      for (let t = along / 2; t <= L - along / 2 + 1e-6; t += RES) {
        if (dm.h > 3.5 && this.overlapsT(this.windowT[side], t - along / 2, t + along / 2)) continue;
        if (this.overlapsT(this.doorT[side], t - along / 2 - 0.5, t + along / 2 + 0.5)) continue;
        const [x, z] = this.sidePoint(side, t, depth / 2 + gap);
        if (!this.fits(x, z, aw, ad, allowKeep)) continue;
        if (near && Math.hypot(x - near[0], z - near[1]) > maxDist) continue;
        let score = this.rng() * 0.8;
        if (prefer === 'center') score += Math.abs(t - L / 2);
        else if (prefer === 'corner') score += Math.min(t - along / 2, L - along / 2 - t);
        else if (prefer === 'near' && near) score += Math.hypot(x - near[0], z - near[1]);
        else score += this.rng() * L;
        if (!best || score < best.score) best = { score, x, z, rot, aw, ad, side, t };
      }
    }
    if (!best) return this.miss(id, maxDist < Infinity ? 'corner already full' : `no wall space (${(sides || ['any']).join('/')})`);
    this.mark(best.x, best.z, best.aw, best.ad);
    return this.record(id, sku, dm, best.x, 0, best.z, best.rot, layer, rule, why || `against ${best.side} wall`, { side: best.side });
  }

  // Free-standing on the floor, away from walls by `margin`.
  free(id, { near = null, radius = 99, margin = 1.5, layer = 'furnish', rule = 'free', why = '', face = null, rot = null, unique = false, sku: want, prefer = 'random', allowKeep = false } = {}) {
    const lk = this.lockedOne(id, unique); if (lk !== undefined) return lk;
    if (!this.has(id)) return this.miss(id, 'not in library');
    const sku = this.chooseSku(id, want || {}); if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    let best = null;
    for (let k = 0; k < 160; k++) {
      let x, z;
      if (near && radius < 99) { // sample in a disc around `near`, clamped to the room
        const a = this.r(0, Math.PI * 2), rr = radius * Math.sqrt(this.rng());
        x = Math.min(this.X1 - margin, Math.max(this.X0 + margin, near[0] + Math.cos(a) * rr));
        z = Math.min(this.Z1 - margin, Math.max(this.Z0 + margin, near[1] + Math.sin(a) * rr));
        if (k === 0) { x = Math.min(this.X1 - margin, Math.max(this.X0 + margin, near[0])); z = Math.min(this.Z1 - margin, Math.max(this.Z0 + margin, near[1])); }
      } else {
        x = this.r(this.X0 + margin, this.X1 - margin); z = this.r(this.Z0 + margin, this.Z1 - margin);
      }
      if (near && Math.hypot(x - near[0], z - near[1]) > radius + 1e-6) continue;
      const rr = rot ?? (face ? Math.atan2(face[0] - x, face[1] - z) : Math.round(this.r(0, 3)) * Math.PI / 2);
      const [aw, ad] = this.aabb(dm.w, dm.d, rr);
      if (!this.fits(x, z, aw, ad, allowKeep)) continue;
      const score = prefer === 'center' ? Math.hypot(x - (this.X0 + this.X1) / 2, z - (this.Z0 + this.Z1) / 2) + this.r(0, 2)
        : near ? Math.hypot(x - near[0], z - near[1]) : this.rng();
      if (!best || score < best.score) best = { score, x, z, rr, aw, ad };
    }
    if (!best) return this.miss(id, 'no free floor');
    this.mark(best.x, best.z, best.aw, best.ad);
    return this.record(id, sku, dm, best.x, 0, best.z, best.rr, layer, rule, why || 'free-standing');
  }

  // A table with seats around it, every seat facing the table. Trestles get benches on their long sides.
  cluster(tableId, seatIds, nSeats, { why = '', layer = 'furnish' } = {}) {
    if (!this.has(tableId)) return this.miss(tableId, 'not in library');
    const sku = this.chooseSku(tableId); if (!sku) return this.miss(tableId, 'every mesh hidden by the ratings filter');
    const dm = this.dims(tableId, sku);
    const seats = this.pick(seatIds, nSeats).map(id => { const s = this.chooseSku(id); return s && { id, sku: s, dm: this.dims(id, s) }; }).filter(Boolean);
    // every spot on a 1-ft lattice, both orientations, in seeded random order: dense rooms still find the gaps
    const cands = [];
    for (let x = this.X0 + 1.5; x <= this.X1 - 1.5; x += 1) for (let z = this.Z0 + 1.5; z <= this.Z1 - 1.5; z += 1) cands.push([x, z, this.chance(0.5) ? 0 : Math.PI / 2]);
    for (const [x, z, rot] of this.shuffle(cands)) {
      const [aw, ad] = this.aabb(dm.w, dm.d, rot);
      if (!this.fits(x, z, aw + 0.6, ad + 0.6)) continue;
      // seat slots: the two long sides first, then the ends
      const long = aw >= ad;
      const slots = long
        ? [[0, -1], [0, 1], [-1, 0], [1, 0]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const placed = [];
      let ok = true;
      for (let i = 0; i < seats.length && i < 4; i++) {
        const st = seats[i], [ux, uz] = slots[i];
        const off = (ux ? aw : ad) / 2 + 0.15;
        const sx = x + ux * (off + st.dm.d / 2), sz = z + uz * (off + st.dm.d / 2);
        const srot = Math.atan2(x - sx, z - sz); // front faces the table
        const [sw, sd] = this.aabb(st.dm.w, st.dm.d, srot);
        if (!this.fits(sx, sz, sw, sd) || placed.some(p => Math.abs(p.sx - sx) < (p.sw + sw) / 2 && Math.abs(p.sz - sz) < (p.sd + sd) / 2)) { ok = false; break; }
        placed.push({ ...st, sx, sz, srot, sw, sd });
      }
      if (!ok) continue;
      this.mark(x, z, aw, ad);
      const t = this.record(tableId, sku, dm, x, 0, z, rot, layer, 'cluster', why || `table with ${placed.length} seats`);
      // walkway: a 1-ft keep-clear ring around the whole cluster so the next furniture doesn't crowd its seats
      const xs = [x - aw / 2, x + aw / 2, ...placed.flatMap(p => [p.sx - p.sw / 2, p.sx + p.sw / 2])];
      const zs = [z - ad / 2, z + ad / 2, ...placed.flatMap(p => [p.sz - p.sd / 2, p.sz + p.sd / 2])];
      const [cx0, cx1, cz0, cz1] = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...zs) - 1, Math.max(...zs) + 1];
      this.mark((cx0 + cx1) / 2, (cz0 + cz1) / 2, cx1 - cx0, cz1 - cz0, KEEP);
      for (const p of placed) {
        this.mark(p.sx, p.sz, p.sw, p.sd);
        this.record(p.id, p.sku, p.dm, p.sx, 0, p.sz, p.srot, layer, 'seat', `seat facing ${tableId}`, { group: t.uid });
      }
      return t;
    }
    return this.miss(tableId, 'no floor for a table cluster');
  }

  // On top of a surface (table, counter, chest, barrel). `on` limits which surfaces.
  surface(id, { on = null, layer = 'dress', rule = 'on-surface', why = '' } = {}) {
    if (!this.has(id)) return this.miss(id, 'not in library');
    const sku = this.chooseSku(id); if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    let cands = this.surfaces.filter(s => (!on || on(s)));
    cands = this.shuffle(cands).sort((a, b) => a.items.length / (a.w * a.d) - b.items.length / (b.w * b.d));
    for (const s of cands) {
      for (let k = 0; k < 14; k++) {
        const rot = this.r(0, Math.PI * 2);
        const [aw, ad] = this.aabb(dm.w, dm.d, rot);
        if (aw > s.w || ad > s.d) break;
        const x = s.x + this.r(-(s.w - aw) / 2, (s.w - aw) / 2), z = s.z + this.r(-(s.d - ad) / 2, (s.d - ad) / 2);
        if (s.items.some(b => Math.abs(b.x - x) < (b.w + aw) / 2 + 0.03 && Math.abs(b.z - z) < (b.d + ad) / 2 + 0.03)) continue;
        s.items.push({ x, z, w: aw, d: ad });
        return this.record(id, sku, dm, x, s.top, z, rot, layer, rule, why || `on ${s.id}`, { parent: s.uid });
      }
    }
    return this.miss(id, on ? 'no room on the chosen surface' : 'no free surface');
  }

  // Hung on a wall at eye height (small wall things, posters, trophies). Doesn't touch the floor grid.
  mount(id, { sides, height = 5.4, layer = 'dress', rule = 'wall-mount', why = '', atWindow = false } = {}) {
    if (!this.has(id)) return this.miss(id, 'not in library');
    const sku = this.chooseSku(id); if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    const flat = sku.kind === 'flat';
    const w = dm.w, d = flat ? 0.05 : dm.d, h = flat ? dm.h : dm.h;
    for (const side of sides || this.shuffle(['N', 'S', 'E', 'W'])) {
      const L = this.sideLen(side);
      const wins = this.windowT[side].filter(([a, b]) => !this.mounts[side].some(([c, d]) => a < d && c < b));
      for (let k = 0; k < (atWindow ? wins.length : 20); k++) {
        const t = atWindow ? (wins[k][0] + wins[k][1]) / 2 : this.r(w / 2 + 0.3, L - w / 2 - 0.3);
        if (this.overlapsT(this.doorT[side], t - w / 2 - 0.4, t + w / 2 + 0.4)) continue;
        if (!atWindow && this.overlapsT(this.windowT[side], t - w / 2, t + w / 2)) continue;
        if (this.mounts[side].some(([a, b]) => t - w / 2 < b + 0.3 && a - 0.3 < t + w / 2)) continue;
        // don't hang it behind something tall standing against this wall
        const [px, pz] = this.sidePoint(side, t, 0.6);
        const behind = this.placements.some(p => p.side === side && p.y === 0 && p.dims[1] > height - h / 2 - 0.2
          && Math.hypot(p.x - px, p.z - pz) < (p.dims[0] + w) / 2);
        if (behind && !atWindow) continue; // drapes hang at windows, which tall furniture already avoids
        this.mounts[side].push([t - w / 2, t + w / 2]);
        const [x, z] = this.sidePoint(side, t, d / 2 + 0.02);
        const y = atWindow ? Math.max(0.2, Math.min(height - h / 2, CEIL - 0.2 - h)) : Math.max(2.5, height - h / 2);
        return this.record(id, sku, dm, x, y, z, SIDES[side].rot, layer, rule, why || `hung on ${side} wall`, { side, orient: flat ? 'wall' : undefined });
      }
    }
    return this.miss(id, 'no bare wall');
  }

  // Hanging from the ceiling (chandeliers, lanterns, hams). Doesn't touch the floor grid.
  ceiling(id, { at = null, layer = 'light', rule = 'ceiling', why = '' } = {}) {
    if (!this.has(id)) return this.miss(id, 'not in library');
    const sku = this.chooseSku(id); if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    // keep the whole (randomly turned) item inside the walls: margin = half its diagonal, not a fixed 1.5 ft
    const m = Math.max(1.5, Math.hypot(dm.w, dm.d) / 2 + 0.05), cx = (this.X0 + this.X1) / 2, cz = (this.Z0 + this.Z1) / 2;
    const rx = this.r(this.X0 + m, this.X1 - m), rz = this.r(this.Z0 + m, this.Z1 - m);
    const x = at ? at[0] : (this.X1 - this.X0 > 2 * m ? rx : cx), z = at ? at[1] : (this.Z1 - this.Z0 > 2 * m ? rz : cz);
    return this.record(id, sku, dm, x, Math.max(0.5, CEIL - dm.h - 0.25), z, this.r(0, Math.PI * 2), layer, rule, why || 'hangs from the ceiling');
  }

  // Flat on the floor (rugs, straw, puddles): never blocks furniture, never overlaps another rug.
  rug(id, { at = null, rot = null, layer = 'floor-dress', rule = 'rug', why = '' } = {}) {
    if (!this.has(id)) return this.miss(id, 'not in library');
    const sku = this.chooseSku(id); if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    for (let k = 0; k < 40; k++) {
      const rr = rot ?? (this.chance(0.5) ? 0 : Math.PI / 2);
      const [aw, ad] = this.aabb(dm.w, dm.d, rr);
      const x = at ? at[0] : this.r(this.X0 + aw / 2, this.X1 - aw / 2), z = at ? at[1] : this.r(this.Z0 + ad / 2, this.Z1 - ad / 2);
      if (x - aw / 2 < this.X0 - 0.01 || x + aw / 2 > this.X1 + 0.01 || z - ad / 2 < this.Z0 - 0.01 || z + ad / 2 > this.Z1 + 0.01) { if (at) break; continue; }
      if (this.rugs.some(b => Math.abs(b.x - x) < (b.w + aw) / 2 && Math.abs(b.z - z) < (b.d + ad) / 2)) { if (at) break; continue; }
      this.rugs.push({ x, z, w: aw, d: ad });
      return this.record(id, sku, dm, x, 0.03 + this.rugs.length * 0.01, z, rr, layer, rule, why || 'on the floor', { orient: 'floor' });
    }
    return this.miss(id, 'no floor for a rug');
  }

  // Default rule from catalog semantics: the generic program for anything a room program doesn't special-case.
  auto(id, { layer = 'dress', why = '', on = null, near = null } = {}) {
    if (!this.has(id)) return this.miss(id, 'not in library');
    const o = this.lib.objects[id];
    const flat = o.gen === 'flat';
    const [cw, cd, ch] = o.size.map(v => v / 12);
    const big = Math.max(cw, cd, ch) >= 2.5;
    if (flat) {
      if (o.place === 'wall') return this.mount(id, { layer, why });
      if (o.place === 'surface') return this.surface(id, { layer, why, on });
      return this.rug(id, { layer: 'floor-dress', why });
    }
    switch (o.place) {
      case 'surface': return this.surface(id, { layer, why, on }) || (Math.max(cw, cd, ch) < 1.5 ? this.wall(id, { layer, rule: 'floor-clutter', why: 'set down by the wall (no surface free)', jitter: 0.5, gap: 0.2 }) : null);
      case 'wall': return (ch >= 3 || cd >= 1.5) ? this.wall(id, { layer, why }) : this.mount(id, { layer, why });
      case 'attach': return this.mount(id, { layer, why });
      case 'ceiling': return this.ceiling(id, { layer: o.aff.includes('lit') ? 'light' : layer, why });
      case 'kit': return this.miss(id, 'kit piece needs an explicit rule');
      default:
        if (o.aff.includes('sleep')) return this.wall(id, { layer, why: why || 'headboard to the wall' });
        if (near) return this.free(id, { near, radius: 6, margin: 0.6, layer, why, rule: 'near' }) || this.wall(id, { layer, prefer: 'near', near, why });
        if (big) return this.wall(id, { layer, why });
        return this.wall(id, { layer, prefer: this.chance(0.5) ? 'corner' : 'random', rule: 'floor-clutter', why: why || 'by the wall', jitter: 0.6, gap: 0.15 });
    }
  }

  // n items from a slot, each by its default rule
  fill(slotOrIds, n, opts = {}) {
    const ids = Array.isArray(slotOrIds) ? slotOrIds : this.slot(slotOrIds);
    return this.pick(ids, n).map(id => this.auto(id, opts)).filter(Boolean);
  }

  // a cluster of storage in one corner: items packed along both walls from the corner outwards
  cornerPile(ids, n, { layer = 'store', why = 'stacked in a corner' } = {}) {
    const corners = this.shuffle([['N', 'W'], ['N', 'E'], ['S', 'W'], ['S', 'E']]);
    for (const [a, b] of corners) {
      const cx = b === 'W' ? this.X0 : this.X1, cz = a === 'N' ? this.Z0 : this.Z1;
      const out = [], misses = this.unplaced.length;
      for (const id of this.pick(ids, n)) {
        const p = this.wall(id, { sides: [a, b], prefer: 'near', near: [cx, cz], layer, rule: 'corner-pile', why, jitter: 0.35, gap: 0.05, maxDist: 7 });
        if (!p) { this.unplaced.length = misses; break; } // corner is full: the pile is just smaller
        out.push(p);
      }
      if (out.length) return out;
    }
    this.miss(ids[0], 'every corner already full');
    return [];
  }

  tablesOf() { return this.surfaces.filter(s => /^table|desk/.test(s.id)); }
}

// ---------------- room programs ----------------
export function scaleN(ctx, per, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(ctx.area() / per))); }

export function barRun(ctx, sides, maxN = 4) { // maxN: v2 lets the bar extend as the room grows (ROOMS.md growth mode)
  // A counter run parallel to a wall with a 3.5-ft bartender lane behind it, back shelves on the wall, stools in front.
  const pieceW = 5;
  const shelf = ctx.chooseSku('back-bar-shelves');
  const lane = (shelf ? ctx.dims('back-bar-shelves', shelf).d : 1.5) + 3; // shelves + 3 ft for the barkeep
  for (const side of sides) {
    const L = ctx.sideLen(side);
    const n = Math.max(2, Math.min(maxN, Math.floor((L - 6) / pieceW)));
    if (L < 12 || (side === 'N' || side === 'S' ? ctx.D : ctx.W) < 14) continue;
    const proto = ctx.chooseSku('bar-counter', { piece: 'straight' }); if (!proto) return null;
    const dm0 = ctx.dims('bar-counter', proto);
    for (const shift of [0, 2.5, -2.5, 5, -5]) {
      const t0 = L / 2 - (n * pieceW) / 2 + shift;
      if (t0 < 0.5 || t0 + n * pieceW > L - 0.5) continue;
      const horiz = side === 'N' || side === 'S';
      const off = lane + dm0.d / 2;
      const centres = Array.from({ length: n }, (_, i) => ctx.sidePoint(side, t0 + pieceW * (i + 0.5), off));
      const fp = horiz ? [pieceW, dm0.d] : [dm0.d, pieceW];
      if (!centres.every(([x, z]) => ctx.fits(x, z, fp[0], fp[1]))) continue;
      const [lx, lz] = ctx.sidePoint(side, t0 + (n * pieceW) / 2, lane / 2);
      if (!ctx.fits(lx, lz, horiz ? n * pieceW : lane, horiz ? lane : n * pieceW, false)) continue;
      // commit: lane kept clear, then the counter pieces
      ctx.mark(lx, lz, horiz ? n * pieceW : lane, horiz ? lane : n * pieceW, KEEP);
      const pieces = ['end', ...Array(n - 2).fill('straight'), 'flap'];
      const placed = [];
      centres.forEach(([x, z], i) => {
        const sku = ctx.chooseSku('bar-counter', { piece: pieces[i] }) || proto;
        const dm = ctx.dims('bar-counter', sku);
        ctx.mark(x, z, fp[0], fp[1]);
        placed.push(ctx.record('bar-counter', sku, dm, x, 0, z, SIDES[side].rot, 'anchor', 'bar-run', `bar counter (${pieces[i]}), ${n} pieces parallel to the ${side} wall`, { side }));
      });
      const mid = ctx.sidePoint(side, t0 + (n * pieceW) / 2, 0);
      ctx.wall('back-bar-shelves', { sides: [side], prefer: 'near', near: mid, layer: 'anchor', rule: 'behind-bar', why: 'back-bar shelves behind the counter', allowKeep: true });
      ctx.wall('cask-rack', { sides: [side], prefer: 'near', near: mid, layer: 'anchor', rule: 'behind-bar', why: 'casks within the barkeep\'s reach', allowKeep: true });
      // stools on the customer side
      const stools = Math.round(n * 1.2);
      for (let i = 0; i < stools; i++) {
        const t = t0 + (n * pieceW) * (i + 0.5) / stools;
        const [sx, sz] = ctx.sidePoint(side, t, lane + dm0.d + 1.0);
        ctx.free('stool-bar', { near: [sx, sz], radius: 0.6, margin: 0.4, face: mid, rule: 'bar-stool', why: 'stool at the bar' });
      }
      return { side, n, t0, placed };
    }
  }
  ctx.notes.push('no wall long enough for a bar run with a barkeep lane');
  return null;
}

const PROGRAMS = {
  common(ctx) {
    const hearth = ctx.wall('fireplace-wall', { sides: ctx.shuffle(ctx.longSides()), prefer: 'center', layer: 'anchor', rule: 'hearth', why: 'hearth centred on a long wall, clear of doors', unique: true });
    const barSides = ctx.shuffle(['N', 'S', 'E', 'W'].filter(s => !hearth || s !== hearth.side));
    const bar = ctx.has('bar-counter') ? barRun(ctx, barSides) : null;
    const nT = scaleN(ctx, 110, 1, 9);
    const tables = ['table-round-small', 'table-square', 'table-trestle'].filter(i => ctx.has(i));
    for (let i = 0; i < nT; i++) {
      const t = tables[ctx.ri(0, tables.length - 1)];
      if (t === 'table-trestle') ctx.cluster(t, ['bench-long'], 2, { why: 'trestle with benches' });
      else ctx.cluster(t, ['chair-plain', 'stool-bar', 'chair-plain'], ctx.ri(2, t === 'table-square' ? 4 : 3));
    }
    if (ctx.area() >= 450 && ctx.has('bard-instrument-stand')) {
      const st = ctx.wall('bard-instrument-stand', { prefer: 'corner', layer: 'anchor', rule: 'bard-corner', why: 'bard corner' });
      if (st) for (const id of ctx.pick(ctx.slot('dress').filter(i => i.startsWith('bard-')), 3)) ctx.auto(id, { near: [st.x, st.z], why: 'bard corner clutter' });
    }
    if (hearth && ctx.has('settle')) {
      const st = ctx.free('settle', { near: [hearth.x, hearth.z], radius: 9, margin: 1, face: [hearth.x, hearth.z], rule: 'by-hearth', why: 'settle facing the fire' });
      if (st) { const [aw, ad] = ctx.aabb(st.dims[0], st.dims[2], st.rot); ctx.mark(st.x, st.z, aw + 1.5, ad + 1.5, KEEP); }
    }
    if (hearth) {
      const [fx, fz] = ctx.sidePoint(hearth.side, (hearth.side === 'N' || hearth.side === 'S' ? hearth.x - ctx.X0 : hearth.z - ctx.Z0), hearth.dims[2] + 2.2);
      ctx.rug(ctx.pick(['rug-hearth-halfmoon', 'rug-bearskin', 'rug-oval', 'rug-small'])[0], { at: [fx, fz], rot: hearth.rot, why: 'rug before the hearth, top edge to the fire' });
    }
    for (const t of ctx.tablesOf().slice(0, ctx.ri(0, 2))) ctx.rug(ctx.pick(t.id.includes('round') ? ['rug-round', 'rug-braided-round'] : ['rug-striped-woven', 'rug-oval', 'rug-small'])[0], { at: [t.x, t.z], why: 'rug under a table' });
    ctx.cornerPile(['barrel', 'barrel', 'crate'], ctx.ri(2, 4));
    if (ctx.area() > 500) ctx.cornerPile(['barrel', 'crate'], ctx.ri(1, 3));
    ctx.fill(['shelf-wall'], 1, { layer: 'store' });
    // light
    const tables_ = ctx.tablesOf();
    const nC = scaleN(ctx, 380, 1, 3);
    for (let i = 0; i < nC; i++) {
      const t = tables_[i % Math.max(1, tables_.length)];
      ctx.ceiling('chandelier-ring', { at: t ? [t.x, t.z] : null, why: t ? 'chandelier over a table' : 'chandelier' });
    }
    if (bar) ctx.ceiling('lantern-hanging', { at: ctx.sidePoint(bar.side, bar.t0 + bar.n * 2.5, 2), why: 'lantern over the bar' });
    for (const t of tables_) if (ctx.chance(0.7)) ctx.surface(ctx.pick(['candle', 'candlestick'])[0], { on: s => s === t, layer: 'light', why: 'candle on a table' });
    // dress: tables get place settings and food, the bar gets drink
    const settings = [...ctx.slot('plate'), ...ctx.slot('cutlery'), ...ctx.slot('drink'), ...ctx.slot('extra')];
    const food = [...ctx.type.slots.dress || []].filter(i => /bowl|plate|pie|bread|cheese|roast|stew|soup|drumstick|ribs|pretzel|apple|pear|bun|muffin|sausage|egg|fish|scone|cookies|pasty/.test(i));
    tables_.forEach((t, i) => {
      if (i === 0 && ctx.area() > 300) { // the adventurers' table
        for (const id of ctx.pick(['map-treasure', 'playing-cards', 'coin-stack', 'dagger', 'journal-leather', 'key-large', 'dice-and-cup'], ctx.ri(3, 5))) ctx.surface(id, { on: s => s === t, why: 'adventurers\' table' });
        for (const id of ctx.pick(['backpack', 'loot-sack', 'sword-long'], ctx.ri(1, 2))) ctx.free(id, { near: [t.x, t.z], radius: 4, margin: 0.4, rule: 'near', why: 'adventurers\' gear by their table', layer: 'dress' });
        return;
      }
      for (const id of ctx.pick(settings, ctx.ri(2, 4))) ctx.surface(id, { on: s => s === t, why: 'place setting' });
      for (const id of ctx.pick(food, ctx.ri(1, 3))) ctx.surface(id, { on: s => s === t, why: 'supper on the table' });
    });
    if (bar) {
      const barDrink = [...ctx.slot('bottles'), ...ctx.slot('pour'), ...ctx.slot('drink'), 'tray-wood-round', 'mugs-empty-cluster'];
      for (const id of ctx.pick(barDrink, bar.n * 2 + 1)) ctx.surface(id, { on: s => s.id === 'bar-counter', why: 'on the bar' });
    }
    ctx.wall('notice-board', { prefer: 'near', near: ctx.doorNear(), layer: 'dress', rule: 'by-door', why: 'notice board by the door' });
    for (const id of ctx.pick(['trophy-head', 'shield-display', 'monster-head-trophy', 'bounty-poster', 'proclamation-scroll', 'bard-playbill'], scaleN(ctx, 150, 2, 5))) ctx.mount(id, { why: 'on the walls' });
    for (const id of ctx.pick(['barrel', 'crate'], 2)) ctx.surface(ctx.pick(['tankard', 'bottle', 'pitcher'])[0], { on: s => s.id.startsWith(id), why: 'set down on a barrel' });
    if (ctx.chance(0.6)) ctx.fill(['tankard-tipped-spill', 'bottle-broken'], 1, { layer: 'dress' });
  },

  kitchen(ctx) {
    const hearth = ctx.wall('cook-hearth-spit', { sides: ctx.shuffle(ctx.longSides()), prefer: 'center', layer: 'anchor', rule: 'hearth', why: 'cooking hearth centred on a long wall', unique: true });
    ctx.wall('bread-oven', { prefer: 'corner', layer: 'anchor', rule: 'oven', why: 'bread oven in a corner' });
    const nT = scaleN(ctx, 200, 1, 2);
    for (let i = 0; i < nT; i++) ctx.free('table-kitchen-prep', { prefer: 'center', margin: 3, layer: 'anchor', rule: 'work-table', why: 'prep table in the middle of the room' });
    ctx.fill(['pantry-shelf', 'cupboard'], scaleN(ctx, 150, 1, 3), { layer: 'store' });
    ctx.cornerPile(['sack', 'barrel', 'crock', 'flour-sack-open'], ctx.ri(2, 4));
    ctx.cornerPile(['potato-pile', 'vegetable-basket-mixed', 'turnip-basket', 'apple-basket'], ctx.ri(1, 3));
    if (hearth) for (const id of ctx.pick(['cooking-pot', 'cauldron', 'chopping-block-kitchen'], 2)) ctx.free(id, { near: [hearth.x, hearth.z], radius: 7, margin: 0.5, rule: 'by-hearth', layer: 'furnish', why: 'by the cooking fire' });
    const prep = s => s.id === 'table-kitchen-prep';
    for (const id of ctx.pick([...ctx.slot('tools'), ...ctx.slot('serve'), 'cutting-board', 'pan-frying'], scaleN(ctx, 40, 3, 7))) ctx.surface(id, { on: prep, why: 'on the prep table' });
    for (const id of ctx.pick(ctx.slot('dress').filter(i => !/hanging|string|braid|rack/.test(i)), scaleN(ctx, 40, 3, 8))) ctx.surface(id, { why: 'food being prepared' });
    for (const id of ctx.pick(['pot-rack-hanging', 'utensil-rack-wall', 'knife-rack-wall', 'dish-rag-hanging'], 3)) ctx.auto(id, { why: 'kitchen walls' });
    for (const id of ctx.pick(['ham-hanging', 'onion-string', 'garlic-braid', 'herb-bundle-fresh'], ctx.ri(2, 3))) ctx.auto(id, { why: 'hung to cure' });
    ctx.ceiling('lantern-hanging', { why: 'kitchen light' });
    for (let i = 0; i < 2; i++) ctx.surface('candle', { layer: 'light', why: 'candle on a work surface' });
    ctx.fill(['bucket', 'washing-bowl-dishes', 'broom'], 2, { why: 'kitchen clutter' });
  },

  store(ctx) {
    const fam = meshFamily(ctx.room.family);
    ctx.fill(['shelving-freestanding', 'cask-rack', 'wine-rack', 'pantry-shelf', 'shelving-freestanding'], scaleN(ctx, 90, 1, 4), { layer: 'anchor' });
    if (ctx.has('floor-trapdoor') && ctx.chance(0.6)) {
      const sku = ctx.chooseSku('floor-trapdoor', { family: fam });
      if (sku) ctx.free('floor-trapdoor', { margin: 2, layer: 'anchor', rule: 'trapdoor', why: 'trapdoor to the level below', rot: 0 });
    }
    if (ctx.type.key === 'cellar' && ctx.has('stair-straight')) ctx.wall('stair-straight', { prefer: 'corner', layer: 'anchor', rule: 'stair', why: 'stair up, along a wall' });
    const goods = [...ctx.slot('store')];
    const nPiles = scaleN(ctx, 70, 2, 5);
    for (let i = 0; i < nPiles; i++) ctx.cornerPile(goods, ctx.ri(2, 4));
    ctx.fill(goods, scaleN(ctx, 40, 2, 6), { layer: 'store' });
    for (const id of ctx.pick(ctx.slot('dress').filter(i => /hanging|string|braid/.test(i)), 2)) ctx.auto(id, { why: 'hung from the beams' });
    for (const id of ctx.pick(ctx.slot('dress').filter(i => !/hanging|string|braid|cobweb/.test(i)), scaleN(ctx, 25, 3, 10))) ctx.auto(id, { why: 'stores' });
    if (ctx.has('decal-cobweb')) ctx.mount('decal-cobweb', { height: 7.8, why: 'cobwebs up by the ceiling' });
    for (const id of ctx.pick(['lantern-hand', 'candle'], 2)) ctx.surface(id, { layer: 'light', why: 'a light left on the stores' });
  },

  bedroom(ctx) {
    const fine = ctx.type.wealth === 'fine';
    const beds = fine ? ['bed-canopy'] : ['bed-single', 'bed-double'];
    const nBeds = fine ? 1 : ctx.area() >= 160 ? 2 : 1;
    const placedBeds = [];
    for (let i = 0; i < nBeds; i++) {
      const b = ctx.wall(ctx.pick(beds)[0], { prefer: i ? 'corner' : 'center', layer: 'anchor', rule: 'bed', why: 'bed with its head to the wall' });
      if (b) placedBeds.push(b);
    }
    for (const b of placedBeds) {
      ctx.free('table-side', { near: [b.x, b.z], radius: b.dims[0] / 2 + 2.5, margin: 0.3, rot: b.rot, rule: 'bedside', why: 'bedside table' });
      ctx.free(ctx.pick(fine ? ['chest-ironbound', 'linen-chest'] : ['chest-plain', 'linen-chest', 'clothes-chest-open'])[0], { near: [b.x, b.z], radius: b.dims[2] / 2 + 3, margin: 0.3, rot: b.rot, rule: 'foot-of-bed', layer: 'store', why: 'chest at the foot of the bed' });
    }
    if (fine) {
      ctx.wall('fireplace-wall', { prefer: 'center', layer: 'anchor', rule: 'hearth', why: 'a fire of their own', sku: { family: undefined } });
      ctx.fill(['desk-writing', 'table-vanity', 'screen-folding', 'mirror-standing', 'washstand', 'bathtub-wood'], 4, { layer: 'furnish' });
      ctx.free('chair-upholstered', { prefer: 'center', margin: 2, rule: 'free', why: 'armchair' });
      ctx.rug(ctx.pick(['rug-grand', 'rug-round-fine'])[0], { at: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], why: 'fine rug in the middle of the room' });
      for (const b of placedBeds) { const [x, z] = [b.x + Math.sin(b.rot) * (b.dims[2] / 2 + 1.2), b.z + Math.cos(b.rot) * (b.dims[2] / 2 + 1.2)]; ctx.rug(ctx.pick(['rug-sheepskin', 'rug-bearskin'])[0], { at: [x, z], rot: b.rot, why: 'pelt at the foot of the bed' }); }
      ctx.mount('painting-portrait', { why: 'portrait' });
      for (const s of ['N', 'S', 'E', 'W']) for (let i = 0; i < ctx.windowT[s].length; i++) ctx.mount('curtains-drapes', { sides: [s], height: 5.2, atWindow: true, why: 'drapes at the window' });
      ctx.fill(['candelabra', 'candlestick'], 2, { layer: 'light' });
      ctx.fill(['vase-flowers', 'pillows-cushions', 'chamber-pot'], 3);
    } else {
      ctx.wall(ctx.pick(['wardrobe', 'washstand'])[0], { layer: 'furnish', why: 'against a wall' });
      ctx.free('chair-plain', { margin: 1, rule: 'free', why: 'a chair' });
      ctx.rug(ctx.pick(['rug-round', 'rug-braided-round', 'rug-striped-woven', 'rug-small'])[0], { why: 'rug' });
      if (ctx.chance(0.5)) for (const b of placedBeds.slice(0, 1)) ctx.rug('rug-sheepskin', { at: [b.x + Math.sin(b.rot) * (b.dims[2] / 2 + 1), b.z + Math.cos(b.rot) * (b.dims[2] / 2 + 1)], rot: b.rot, why: 'sheepskin by the bed' });
      for (const id of ctx.pick(['pitcher', 'bowl', 'water-jug-basin', 'blankets-folded', 'towel-stack'], ctx.ri(2, 4))) ctx.auto(id);
      ctx.fill(['candle', 'candlestick'], 1, { layer: 'light' });
      ctx.fill(['chamber-pot', 'basket-laundry', 'pillows-cushions'], ctx.ri(1, 2));
    }
  },

  privy(ctx) {
    const seat = ctx.pick(['privy-seat-double', 'privy-seat-single'].filter(i => ctx.has(i)))[0] || 'privy-seat-single';
    ctx.wall(seat, { prefer: 'center', sides: ctx.shuffle(['N', 'S', 'E', 'W'].filter(s => !ctx.doorSides().includes(s))), layer: 'anchor', rule: 'privy', why: 'seat on the wall away from the door' });
    ctx.fill(['bucket-slop', 'bucket', 'chamber-pot', 'broom', 'mop'], ctx.ri(2, 3), { layer: 'store' });
    ctx.fill(['washstand'], 1, { layer: 'furnish' });
    ctx.fill(['candle', 'lantern-hand'], 1, { layer: 'light' });
  },

  hallway(ctx) {
    const along = ctx.W >= ctx.D;
    const cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
    ctx.rug('rug-runner', { at: [cx, cz], rot: along ? Math.PI / 2 : 0, why: 'runner down the length of the hall' });
    if (ctx.has('stair-straight') && Math.max(ctx.W, ctx.D) >= 20) ctx.wall('stair-straight', { prefer: 'corner', sides: ctx.shortSides(), layer: 'anchor', rule: 'stair', why: 'stair at the end of the hall' });
    ctx.fill(['bench-long', 'table-side', 'chest-plain', 'coat-pegs'], scaleN(ctx, 60, 1, 3), { layer: 'furnish' });
    const n = Math.max(1, Math.round(Math.max(ctx.W, ctx.D) / 12));
    for (let i = 0; i < n; i++) ctx.mount('torch-sconce', { sides: ctx.longSides(), height: 6, layer: 'light', why: 'sconce every 12 ft or so' });
    ctx.fill(['painting-landscape', 'key-hook-board'], 2);
    ctx.fill(['broom'], 1);
  },

  desk(ctx) {
    // a reception room: counter facing the door with the keeper's stuff behind it, a waiting bench, luggage, notices
    const door = ctx.doorSides()[0];
    const opp = { N: 'S', S: 'N', E: 'W', W: 'E' }[door] || 'N';
    const counter = ctx.wall('counter-shop', { sides: [opp], prefer: 'center', gap: 3, layer: 'anchor', rule: 'desk', why: 'counter facing the door, room to stand behind it', unique: true });
    if (counter) {
      ctx.wall('strongbox', { sides: [opp], prefer: 'near', near: [counter.x, counter.z], layer: 'store', why: 'strongbox behind the counter', allowKeep: true });
      ctx.wall('shelf-wall', { sides: [opp], prefer: 'near', near: [counter.x, counter.z], layer: 'store', why: 'shelves behind the counter', allowKeep: true });
      ctx.free('chair-plain', { near: ctx.sidePoint(opp, (opp === 'N' || opp === 'S' ? counter.x - ctx.X0 : counter.z - ctx.Z0), 1.2), radius: 1.5, margin: 0.4, face: [counter.x, counter.z], rule: 'keeper', why: 'the keeper\'s chair behind the counter', allowKeep: true });
      for (const id of ctx.pick(['ledger-counter-bell', 'ledger-accounts', 'key-simple', 'key-ring', 'coin-stack', 'candlestick', 'bottle', 'tankard', 'map-treasure'], scaleN(ctx, 40, 4, 7))) ctx.surface(id, { on: s => s.id === 'counter-shop', why: 'on the counter' });
    }
    ctx.wall('key-hook-board', { layer: 'store', why: 'room keys on the wall' }) || ctx.mount('key-hook-board', { why: 'room keys on the wall' });
    ctx.wall('notice-board', { prefer: 'near', near: ctx.doorNear(), layer: 'dress', rule: 'by-door', why: 'notices by the door' });
    for (let i = 0; i < scaleN(ctx, 110, 1, 3); i++) ctx.wall('bench-long', { layer: 'furnish', why: 'waiting bench, long side to the wall' });
    ctx.fill(['coat-pegs', 'chest-plain', 'table-side', 'barrel', 'crate'], scaleN(ctx, 60, 2, 5), { layer: 'furnish' });
    ctx.fill(['backpack', 'loot-sack', 'sack', 'blankets-folded', 'broom', 'bucket'], scaleN(ctx, 45, 2, 5), { why: 'luggage and odds left by guests' });
    for (const id of ctx.pick(['bounty-poster', 'proclamation-scroll', 'painting-landscape', 'shield-display', 'trophy-head'], scaleN(ctx, 70, 2, 4))) ctx.mount(id, { why: 'on the walls' });
    ctx.rug(ctx.pick(['rug-striped-woven', 'rug-oval', 'rug-small'])[0], { at: ctx.sidePoint(door || 'S', CELL * 0.5 + (ctx.openings.find(o => o.kind === 'door')?.index || 0) * CELL - INSET, 3), why: 'mat inside the door' });
    ctx.ceiling('lantern-hanging', { at: counter ? [counter.x, counter.z] : null, why: 'lantern over the counter' });
    if (ctx.area() > 300) ctx.ceiling('chandelier-ring', { why: 'chandelier' });
    for (const s of ctx.surfaces.filter(s => s.id !== 'counter-shop').slice(0, 2)) ctx.surface(ctx.pick(['candle', 'candlestick'])[0], { on: x => x === s, layer: 'light', why: 'a candle' });
  },

  stable(ctx) {
    // stalls along the back (long) wall: partitions every 10 ft, straw in each stall, a manger on the back wall
    const back = ctx.shuffle(ctx.longSides().filter(s => !ctx.doorSides().includes(s)).concat(ctx.longSides()))[0];
    const L = ctx.sideLen(back), stallW = 10;
    const n = Math.floor(L / stallW);
    for (let i = 0; i <= n; i++) {
      const t = Math.min(L - 0.3, Math.max(0.3, i * stallW + (L - n * stallW) / 2));
      const p = ctx.sidePoint(back, t, 2.6);
      const sku = ctx.chooseSku('stable-stall');
      if (!sku) break;
      const dm = ctx.dims('stable-stall', sku);
      const rot = SIDES[back].rot + Math.PI / 2; // partition runs out from the wall
      const [aw, ad] = ctx.aabb(dm.w, dm.d, rot);
      if (ctx.fits(p[0], p[1], aw, ad, true)) {
        ctx.mark(p[0], p[1], aw, ad);
        ctx.record('stable-stall', sku, dm, p[0], 0, p[1], rot, 'anchor', 'stall', `stall partition ${i + 1} of ${n + 1}, 10 ft apart`, { side: back });
      } else ctx.miss('stable-stall', `partition ${i + 1} blocked (door or window run)`);
      if (i < n) {
        const mid = ctx.sidePoint(back, t + stallW / 2, 2.6);
        ctx.rug(ctx.pick(['rug-hay-scatter', 'rural-straw-bedding', 'rug-hay-scatter'])[0], { at: mid, why: 'hay in the stall' });
        // half-height stall door across the stall front, 5 ft out from the back wall
        const ds = ctx.chooseSku('stable-stall-door');
        if (ds) {
          const dd = ctx.dims('stable-stall-door', ds);
          const [fx, fz] = ctx.sidePoint(back, t + stallW / 2, 5.2);
          const [aw, ad] = ctx.aabb(dd.w, dd.d, SIDES[back].rot);
          if (ctx.fits(fx, fz, aw, ad, true)) { ctx.mark(fx, fz, aw, ad); ctx.record('stable-stall-door', ds, dd, fx, 0, fz, SIDES[back].rot, 'anchor', 'stall', 'half door across the stall front', { side: back }); }
        }
        ctx.mount('rural-manger-wall', { sides: [back], height: 3.5, why: 'manger on the stall wall' });
      }
    }
    ctx.fill(['grain-bin-stable', 'farrier-stand', 'tack-wall', 'horse-blanket-rail', 'rural-saddle-riding', 'bridle-hanging'], scaleN(ctx, 120, 2, 5), { layer: 'furnish' });
    ctx.cornerPile(['hay-bale', 'hay-bale', 'rural-oat-sack'], ctx.ri(2, 4));
    ctx.fill(['bucket', 'rural-water-bucket-stable', 'rural-grooming-box', 'rural-manure-barrow', 'wheel-spare', 'rural-nosebag', 'manure-heap'], scaleN(ctx, 60, 2, 6));
    ctx.fill(['rural-lantern-barn', 'lantern-hanging'], 2, { layer: 'light' });
    for (let i = 0; i < scaleN(ctx, 150, 1, 4); i++) ctx.rug('rug-hay-scatter', { why: 'hay scattered on the floor' });
  },

  barn(ctx) {
    ctx.free('wagon', { prefer: 'center', margin: 3, layer: 'anchor', rule: 'wagon', why: 'wagon in the middle of the barn' });
    ctx.wall('ladder-wood', { prefer: 'corner', layer: 'anchor', rule: 'ladder', why: 'ladder to the loft' });
    ctx.fill(['water-trough', 'feed-trough'], 2, { layer: 'furnish' });
    for (let i = 0; i < scaleN(ctx, 150, 1, 3); i++) ctx.cornerPile(['hay-bale', 'hay-bale', 'hay-pile'], ctx.ri(2, 5));
    ctx.fill(['cart-hand', 'wheelbarrow', 'saddle-rack', 'barrel', 'sack', 'horse-collar', 'bridle-hanging'], scaleN(ctx, 80, 2, 6), { layer: 'store' });
    ctx.fill(['pitchfork', 'rural-curry-comb', 'rural-hoof-pick', 'horseshoe-single', 'manure-heap', 'blankets-folded', 'rural-saddle-riding'], scaleN(ctx, 60, 2, 6));
    ctx.fill(['lantern-hanging', 'lantern-hand'], 2, { layer: 'light' });
    for (let i = 0; i < scaleN(ctx, 120, 2, 5); i++) ctx.rug('rug-hay-scatter', { why: 'hay scattered on the floor' });
  },
};

// v1 has no yard grammar (the yard is a v2 room, js/solver2.js): a handful of yard things so the classic engine still runs
PROGRAMS.outdoors = (ctx) => {
  ctx.free('well', { prefer: 'center', margin: 3, layer: 'anchor', rule: 'well', why: 'well in the middle of the yard' });
  ctx.fill(['woodpile', 'bench-village', 'barrel', 'rain-barrel', 'cart-hand', 'water-trough'], scaleN(ctx, 150, 2, 5), { layer: 'furnish' });
};

Ctx.prototype.doorNear = function () {
  const d = this.openings.find(o => o.kind === 'door' && !o.part);
  if (!d) return [(this.X0 + this.X1) / 2, (this.Z0 + this.Z1) / 2];
  return this.sidePoint(d.side, d.index * CELL - INSET + (d.span || 1) * CELL / 2, 0);
};

export function solveRoom(args) {
  const ctx = new Ctx(args);
  const program = PROGRAMS[args.type.program];
  if (!program) throw new Error(`no program ${args.type.program}`);
  program(ctx);
  const usual = args.type.cells[0] * args.type.cells[1], here = args.room.w * args.room.d;
  if (here >= 2.5 * usual) ctx.notes.push(`this is ${(here / usual).toFixed(1)}× the usual ${args.type.label.toLowerCase()} (${args.type.cells.map(c => c * CELL).join('×')} ft); the program doesn't scale its contents that far, so it will read sparse`);
  return {
    room: { id: args.room.id, type: args.type.key, label: args.type.label, cells: [args.room.w, args.room.d], feet: [args.room.w * CELL, args.room.d * CELL], seed: args.room.seed, family: args.room.family },
    openings: args.openings.map(o => ({ side: o.side, at_ft: o.index * CELL, kind: o.kind, to: o.to })),
    placements: ctx.placements, unplaced: ctx.unplaced, notes: ctx.notes,
    grid: { x0: ctx.X0, z0: ctx.Z0, nx: ctx.nx, nz: ctx.nz, res: RES, cells: Array.from(ctx.grid) },
  };
}

// ---------------- readable summary ----------------
const SIDE_NAME = { N: 'north', S: 'south', E: 'east', W: 'west' };
export function summarize(layout, roomLabel = id => id) {
  const { room, placements, unplaced, openings, notes } = layout;
  const lines = [];
  const doors = openings.filter(o => o.kind === 'door').map(o => `${SIDE_NAME[o.side]} wall at ${o.at_ft} ft${o.to ? ` → ${roomLabel(o.to)}` : ' (outside)'}`);
  const wins = openings.filter(o => o.kind === 'window').length;
  lines.push(`${room.label} ${room.feet[0]}×${room.feet[1]} ft (${room.cells[0]}×${room.cells[1]} cells), seed ${room.seed}, ${room.family} walls.`);
  lines.push(`Doors: ${doors.length ? doors.join('; ') : 'none'}. Windows: ${wins}.`);
  const anchors = placements.filter(p => p.layer === 'anchor');
  const byRule = new Map();
  for (const p of anchors) { const k = `${p.id}|${p.why.replace(/ \(.+?\)/, '').replace(/partition \d+ of \d+/, 'partitions')}`; byRule.set(k, (byRule.get(k) || 0) + 1); }
  if (anchors.length) lines.push('Anchors: ' + [...byRule].map(([k, n]) => { const [id, why] = k.split('|'); return `${id}${n > 1 ? ` ×${n}` : ''} (${why})`; }).join('; ') + '.');
  const count = (pred) => { const m = new Map(); for (const p of placements.filter(pred)) m.set(p.id, (m.get(p.id) || 0) + 1); return [...m].map(([id, n]) => n > 1 ? `${id} ×${n}` : id).join(', '); };
  const tables = placements.filter(p => p.rule === 'cluster');
  if (tables.length) lines.push(`Seating: ${tables.length} table${tables.length > 1 ? 's' : ''} (${count(p => p.rule === 'cluster')}) with ${placements.filter(p => p.rule === 'seat').length} seats; ${placements.filter(p => p.rule === 'bar-stool').length} bar stools.`);
  const furn = count(p => p.layer === 'furnish' && !['cluster', 'seat', 'bar-stool'].includes(p.rule));
  if (furn) lines.push(`Furniture: ${furn}.`);
  const store = count(p => p.layer === 'store');
  if (store) lines.push(`Storage: ${store}.`);
  const light = count(p => p.layer === 'light');
  if (light) lines.push(`Light: ${light}.`);
  const onS = placements.filter(p => p.parent && p.layer === 'dress').length, mounted = placements.filter(p => p.rule === 'wall-mount' && p.layer === 'dress').length;
  const rugs = count(p => p.layer === 'floor-dress');
  lines.push(`Dressing: ${onS} things on surfaces, ${mounted} on the walls${rugs ? `, floor: ${rugs}` : ''}.`);
  if (unplaced.length) {
    const byWhy = new Map();
    for (const u of unplaced) { if (!byWhy.has(u.why)) byWhy.set(u.why, new Map()); const m = byWhy.get(u.why); m.set(u.id, (m.get(u.id) || 0) + 1); }
    lines.push(`Couldn't place (${unplaced.length}): ` + [...byWhy].map(([why, m]) => `${why}: ${[...m].map(([id, n]) => n > 1 ? `${id} ×${n}` : id).join(', ')}`).join('; ') + '.');
  }
  for (const n of notes) lines.push(`Note: ${n}.`);
  lines.push(`Total: ${placements.length} objects.`);
  return lines.join('\n');
}

// >>> ccm:solver.once
// ======================= castle / crypt / mansion (2026-10-05) =======================
// v1 has no grammar for the new room types (they are v2 rooms, js/solver2.js): the classic engine lays the recipe's
// anchors, furniture, lights and dressing by their default rules, so it still runs
PROGRAMS.generic = (ctx) => {
  for (const id of ctx.slot('anchor').slice(0, 2)) ctx.auto(id, { layer: 'anchor' });
  ctx.fill('furnish', scaleN(ctx, 80, 1, 5), { layer: 'furnish' });
  ctx.fill('store', scaleN(ctx, 120, 0, 3), { layer: 'store' });
  ctx.fill('light', scaleN(ctx, 150, 1, 4), { layer: 'light' });
  ctx.fill('dress', scaleN(ctx, 60, 1, 6));
};
// <<< ccm:solver.once

// >>> ccm:solver.crypt
// crypt: hangs on the wall although it is deeper than isHung()'s 8 in (the urn niche is a 16-in stone box on brackets)
HUNG_IDS.add('burial-urn-niche');
// <<< ccm:solver.crypt

// >>> ccm:solver.castle
// castle: these hang on the wall although isHung()'s size test (depth <= 8 in, height <= 48 in) misses them
for (const id of ['mil-crossbow-rack', 'smith-helm-row-shelf', 'mil-helmet-peg-rack', 'cell-bench-plank']) HUNG_IDS.add(id);
// <<< ccm:solver.castle

// >>> ccm:solver.mansion
// mansion: the gilt pier mirror hangs on the wall although it is 78 in tall (isHung()'s size test stops at 48 in)
HUNG_IDS.add('mirror-pier-gilt');
// <<< ccm:solver.mansion

// >>> tem:solver
// temple & chapel (2026-10-11): the flat slots hang on the wall
HUNG_IDS.add('flavor-relief'); HUNG_IDS.add('flavor-banner');
// <<< tem:solver

// >>> wiz:solver.wizard
// wizard's tower: these hang on the wall although isHung()'s size test (depth <= 8 in, height <= 48 in) misses them
for (const id of ['alch-sign-apothecary']) HUNG_IDS.add(id);
// <<< wiz:solver.wizard

// >>> mkt:solver
// market & village (2026-10-11): the awning hangs on the wall although it is 36 in deep (isHung()'s size test stops at 8 in)
HUNG_IDS.add('awning');
// <<< mkt:solver
// >>> types:clt.solver
// cult sanctum: robes on pegs hang on the wall although the bundle is 10 in deep and 5 ft tall
HUNG_IDS.add('robe-rack');
// <<< types:clt.solver
