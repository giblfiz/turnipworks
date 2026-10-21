// Layout engine v2: placement from principles (Harry + Fauna, 2026-10-01). Pure data in, pure data out; node-testable.
//
// Order of operations, per room:
//   1. ROLE (hub / passage / terminal / uses / mixed) from the room type; doors come from walls.js's v2 door policy.
//   2. KEY PURPOSE first, with pride of place by role: a terminal's feature is the destination at the end of the door's
//      line (diagonal, never in the door's blast line, no coffin beds; a privy seat stays OUT of the line for privacy);
//      a passage's checkpoint sits beside the through-line facing it; a hub's anchors are the poles of the loop;
//      a uses-room builds its work triangle off the guest line. If it cannot be placed: purposeFail, loudly.
//   3. DESIRE LINES (chi flow): walking paths ~3 ft wide found by A* on the occupancy grid and reserved before furniture
//      (terminal: door -> feature; passage: door -> door; hub: a loop linking every door and anchor; uses: service lines).
//   4. ZONES: rug + inward-facing seating around a focus + its own light, packed into what the paths leave. Each type has
//      an ordered menu that grows with area (a fine bedroom adds seating, then reading, then a fireplace, then bathing).
//   5. EDGES to a DENSITY target (props per 100 sq ft), not a fixed count: big rooms don't read bare.
//   6. CHECKS: command position for primary spots (tortoise back, phoenix front, dragon/tiger flanks, door in view),
//      key feature visible from the doorway (one camera angle), paths clear. Best of N candidates by score.
import { Ctx, RES, INSET, CEIL, barRun, skuUsable, mulberry32, isHung } from './solver.js';
import { CELL, hash, ROLES, roleOf, YARD_DOOR_RANK } from './walls.js';

const FREE = 0, BLOCK = 1, KEEP = 2;
const SIDES = {
  N: { rot: 0, n: [0, 1] }, S: { rot: Math.PI, n: [0, -1] },
  W: { rot: Math.PI / 2, n: [1, 0] }, E: { rot: -Math.PI / 2, n: [-1, 0] },
};
const DEG = 180 / Math.PI;
const TALL = 4.8; // ft: objects taller than this block sight lines

// props per 100 sq ft of floor (interior), by type: the density target edges fill toward
// working faces (ft of standing room kept clear in front); beds get side clearance instead (see workFace)
// GRADE FLOOR (Harry 2026-10-01: "no straw pallet in fine rooms, ever"): rooms have a wealth; objects a grade. A room never
// places objects below its floor. Data-driven so a poor room type (a hovel) can flip it later. Catalog tiers (common/fine
// SKUs) still steer chooseSku; this list catches whole objects that are poor in themselves.
export const ROOM_WEALTH = { fine: 'fine' };                 // everything else is 'common'; a future hovel: 'poor'
const WEALTH_FLOOR = { poor: 0, common: 0, fine: 1 };         // minimum object grade a room of that wealth accepts
export const POOR = new Set(['bed-straw-pallet', 'stool-three-leg', 'sickbed', 'mug-chipped', 'tankard-dented', 'bottle-broken', 'bard-lute-broken',
  'bread-stale-moldy', 'bread-burnt', 'book-waterlogged', 'rural-straw-bedding', 'bucket-slop', 'chamber-pot']);
export function gradeOf(id) { return POOR.has(id) || /(^|-)(broken|chipped|dented|moldy|rotten|crude|stale|burnt|rusty)(-|$)/.test(id) ? 0 : 1; }
// AXIAL FOCAL PLACEMENT (Harry 2026-10-01: "right, and generalize"): a showpiece key feature goes on the wall OPPOSITE the
// main door, CENTRED, its companions flanking it symmetrically; it overrides the coffin / blast-line penalty for that feature.
// Exceptions: privacy features (privy seat, bath), repeated features (cooking lines, stalls, shelving, dorm beds: aisle
// grammar), and the fine-room bed's centre-island promotion when the room is big.
export const FOCAL = { yard: 'well (one focal thing in the open)', guest: 'bed', fine: 'bed', desk: 'counter', common: 'hearth (when the wall facing the door is a short wall)' };
const WORK_FACE = { 'bread-oven': 4, 'cook-hearth-spit': 4, 'fireplace-wall': 2, wardrobe: 2.5, cupboard: 2.5, 'pantry-shelf': 2.5, washstand: 2, 'table-vanity': 2, 'privy-seat-single': 1.5, 'privy-seat-double': 1.5 };
function segHitsRect(a, b, cx, cz, hw, hd) { // slab test: does segment a-b cross the axis-aligned box?
  let t0 = 0, t1 = 1;
  for (const [o, dv, lo, hi] of [[a[0], b[0] - a[0], cx - hw, cx + hw], [a[1], b[1] - a[1], cz - hd, cz + hd]]) {
    if (Math.abs(dv) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let u = (lo - o) / dv, v = (hi - o) / dv; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
function segDist(p, a, b) { const vx = b[0] - a[0], vz = b[1] - a[1], L2 = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / L2)); return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vz); }
const doorAnchor = (d) => d && { id: 'door', uid: null, x: d.at[0], z: d.at[1], side: d.side, rot: SIDES[d.side].rot };
export const DENSITY = { common: 8, kitchen: 10, storeroom: 11, cellar: 11, guest: 8, fine: 6.5, privy: 12, hallway: 3.5, desk: 6.5, stable: 5, barn: 4.5, yard: 2 };

export class Ctx2 extends Ctx {
  constructor(args) {
    super({ ...args, locked: [] });
    this.grid.fill(FREE);               // v1's 4.5-ft door squares are replaced by role-aware keep zones below
    this.claim = new Uint8Array(this.nx * this.nz); // zone claims (paths route around zones)
    this.zones = []; this.paths = []; this.primary = []; this.checks = {}; this.purposeFail = null;
    this.faces = []; this.growth = []; this.rolls = []; // zone anatomy (ROOMS.md): working faces kept clear, growth modes, style rolls
    this.role = roleOf(this.type.key); this.roleInfo = ROLES[this.type.key] || {};
    this.doors = (args.openings || []).filter(o => o.kind === 'door' && !o.part).map(o => {
      const span = o.span || 1, t0 = o.index * CELL - INSET, t1 = t0 + span * CELL, tc = (t0 + t1) / 2;
      return { side: o.side, t0, t1, tc, width: span * CELL, to: o.to, ext: !o.to, why: o.why, flag: o.flag, at: this.sidePoint(o.side, tc, 0), inner: this.sidePoint(o.side, tc, 1.4), ...(o.join && { join: true }) };
    });
    // door approach keep zone, scaled down in tiny rooms (a 5x5 privy must still fit its seat)
    for (const d of this.doors) {
      // hubs and passages get a landing inside each door (you walk in, pause, take in the room); others a short approach
      const deep = d.side === 'N' || d.side === 'S' ? this.D : this.W;
      const depth = this.role === 'hub' || this.role === 'passage' ? Math.min(6, Math.max(1.2, 0.3 * deep)) : Math.min(3.5, Math.max(1.2, 0.3 * deep));
      this.keepClear(d.side, d.tc, Math.min(d.width, this.sideLen(d.side)) + 0.5, depth);
    }
    for (const p of args.locked || []) this.adoptLocked(p);
    this.mainDoor = this.pickMainDoor(args.roomTypes || {});
  }

  pickMainDoor(typesById) {
    if (!this.doors.length) return null;
    // the door that "counts": for a terminal, its only door; for a uses-room, the guest/service door; else the exterior
    const rank = (d) => d.ext ? (this.role === 'hub' || this.role === 'passage' || this.role === 'mixed' ? 0 : 2) : 1;
    // a JOIN is not a door: it is where one rectangle of a shaped room opens into the next (the game furnishes an
    // L-shaped room as its largest rectangle plus the rest, 2026-10-05). It is kept clear like a doorway, but a real
    // door, when there is one, is the door that counts.
    const real = this.doors.filter(d => !d.join);
    return [...(real.length ? real : this.doors)].sort((a, b) => rank(a) - rank(b) || b.width - a.width)[0];
  }

  // ---------- geometry ----------
  rc(x, z) { return [Math.floor((x - this.X0) / RES), Math.floor((z - this.Z0) / RES)]; }
  xz(i, j) { return [this.X0 + (i + 0.5) * RES, this.Z0 + (j + 0.5) * RES]; }
  axis(d, x, z) { // depth along the door's inward normal, and lateral offset from its centre line
    const n = SIDES[d.side].n, vx = x - d.at[0], vz = z - d.at[1];
    return { along: vx * n[0] + vz * n[1], lat: Math.abs(vx * n[1] - vz * n[0]) };
  }
  inBlast(d, x, z, halfW = 0) { const a = this.axis(d, x, z); return a.along > 0 && a.lat < d.width / 2 + halfW; }
  angleFromDoor(d, x, z) { const a = this.axis(d, x, z); return Math.atan2(a.lat, Math.max(0.01, a.along)) * DEG; }
  facingVec(rot) { return [Math.sin(rot), Math.cos(rot)]; }
  wallDist(x, z) { return Math.min(x - this.X0, this.X1 - x, z - this.Z0, this.Z1 - z); }

  // sight line in plan: blocked by any floor-standing object taller than TALL whose footprint the segment crosses
  losClear(a, b, ignore = new Set()) {
    const tall = this.placements.filter(p => !p.parent && p.y < 0.5 && p.dims[1] + p.y >= TALL && !ignore.has(p.uid) && p.orient !== 'floor');
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
    for (let k = 1; k < n; k++) {
      const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
      for (const p of tall) {
        const [aw, ad] = this.aabb(p.dims[0], p.dims[2], p.rot);
        if (Math.abs(x - p.x) < aw / 2 && Math.abs(z - p.z) < ad / 2) return { ok: false, by: p };
      }
    }
    return { ok: true };
  }

  // ---------- generic best-candidate placement ----------
  gradeOk(id) { return gradeOf(id) >= (WEALTH_FLOOR[ROOM_WEALTH[this.type.key] || this.type.wealth || 'common'] ?? 0); }
  has(id) { return super.has(id) && this.gradeOk(id); }
  put(id, gen, score, { layer = 'furnish', rule = 'placed', why = '', allowKeep = false, sku: want, zone = null, extra = {}, failWhy = 'no space', y = 0, unique = false } = {}) {
    const lk = this.lockedOne(id, unique); if (lk !== undefined) return lk;
    if (!this.has(id)) return this.miss(id, this.lib.objects[id] ? "below this room's grade" : 'not in library');
    const sku = this.chooseSku(id, want || {});
    if (!sku) return this.miss(id, 'every mesh hidden by the ratings filter');
    const dm = this.dims(id, sku);
    let best = null;
    const tall = dm.h + y >= TALL && this.sight && id !== this.sightFeature;
    const wf = y < 0.5 ? WORK_FACE[id] : null; // its own working face must be free of furniture (paths may cross it)
    for (const c of gen(dm)) {
      const [aw, ad] = this.aabb(dm.w, dm.d, c.rot);
      if (tall && segHitsRect(this.sight[0], this.sight[1], c.x, c.z, aw / 2, ad / 2)) continue; // one camera angle: keep the door->key-feature view
      if (wf) { const fx = Math.sin(c.rot), fz = Math.cos(c.rot), off = dm.d / 2 + wf / 2, [fw, fd] = this.aabb(dm.w + 0.5, wf, c.rot); if (!this.fits(c.x + fx * off, c.z + fz * off, fw, fd, true)) continue; }
      if (c.rect && !(c.x - aw / 2 >= c.rect[0] - 1e-6 && c.x + aw / 2 <= c.rect[2] + 1e-6 && c.z - ad / 2 >= c.rect[1] - 1e-6 && c.z + ad / 2 <= c.rect[3] + 1e-6)) continue;
      if (!this.fits(c.x, c.z, aw, ad, allowKeep)) continue;
      const s = score(c, dm, aw, ad) + this.rng() * 0.05;
      if (!best || s < best.s) best = { ...c, aw, ad, s };
    }
    if (!best) return this.miss(id, failWhy);
    this.mark(best.x, best.z, best.aw, best.ad);
    const p = this.record(id, sku, dm, best.x, y, best.z, best.rot, layer, rule, why, { side: best.side, ...(zone ? { zone } : {}), ...extra });
    return p;
  }
  // candidates standing against walls, back to the wall, facing in
  *wallGen(dm, sides, { gap = 0.05, step = 0.5, rect = null, tRange = null, windows = true } = {}) {
    for (const side of sides) {
      const L = this.sideLen(side), rot = SIDES[side].rot;
      const [aw, ad] = this.aabb(dm.w, dm.d, rot);
      const along = side === 'N' || side === 'S' ? aw : ad, depth = side === 'N' || side === 'S' ? ad : aw;
      for (let t = along / 2; t <= L - along / 2 + 1e-6; t += step) {
        if (tRange && (t < tRange[0] || t > tRange[1])) continue;
        if (this.overlapsT(this.doorT[side], t - along / 2 - 0.3, t + along / 2 + 0.3)) continue;
        if (windows && dm.h > 3.5 && this.overlapsT(this.windowT[side], t - along / 2, t + along / 2)) continue;
        const [x, z] = this.sidePoint(side, t, depth / 2 + gap);
        yield { x, z, rot, side, t, rect };
      }
    }
  }
  *rectGen(dm, rect, rots, step = 0.5) {
    for (const rot of rots) {
      const [aw, ad] = this.aabb(dm.w, dm.d, rot);
      for (let x = rect[0] + aw / 2; x <= rect[2] - aw / 2 + 1e-6; x += step) for (let z = rect[1] + ad / 2; z <= rect[3] - ad / 2 + 1e-6; z += step) yield { x, z, rot, rect };
    }
  }
  wallsByDoor() { const ds = new Set(this.doors.map(d => d.side)); return ['N', 'S', 'E', 'W'].sort((a, b) => (ds.has(a) - ds.has(b))); }

  // ---------- desire lines ----------
  passable(radius = 1.25) {
    const r = Math.ceil(radius / RES), nx = this.nx, nz = this.nz, out = new Uint8Array(nx * nz).fill(1);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (this.claim[k]) out[k] = 0;
      if (this.grid[k] !== BLOCK) continue;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (di * di + dj * dj > r * r) continue;
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) out[jj * nx + ii] = 0;
      }
    }
    return out;
  }
  nearestOpen(pass, x, z) {
    const [i0, j0] = this.rc(x, z);
    for (let r = 0; r < 24; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj;
      if (i >= 0 && j >= 0 && i < this.nx && j < this.nz && pass[j * this.nx + i]) return [i, j];
    }
    return null;
  }
  astar(pass, a, b) {
    const nx = this.nx, nz = this.nz, N = nx * nz;
    const s = this.nearestOpen(pass, ...a), g = this.nearestOpen(pass, ...b);
    if (!s || !g) return null;
    const start = s[1] * nx + s[0], goal = g[1] * nx + g[0];
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const h = (k) => { const dx = Math.abs(k % nx - g[0]), dz = Math.abs(Math.floor(k / nx) - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const open = [[h(start), start]]; gs[start] = 0;
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.length) {
      let bi = 0; for (let q = 1; q < open.length; q++) if (open[q][0] < open[bi][0]) bi = q;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) break;
      if (closed[cur]) continue; closed[cur] = 1;
      const ci = cur % nx, cj = Math.floor(cur / nx);
      for (const [di, dj, c] of NB) {
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const k = j * nx + i; if (!pass[k] || closed[k]) continue;
        const ng = gs[cur] + c; if (ng < gs[k]) { gs[k] = ng; came[k] = cur; open.push([ng + h(k), k]); }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const cells = []; for (let k = goal; k !== -1; k = came[k]) { cells.push(k); if (k === start) break; }
    return cells.reverse();
  }
  // find a walkway through the given waypoints (closed = loop), reserve it ~3 ft wide, record it for the overlay
  walk(kind, pts, { closed = false, width = 3, quietSkips = false } = {}) {
    const opts = { quietSkips };
    const pass = this.passable(1.25);
    const seq = closed ? [...pts, pts[0]] : pts;
    const cells = []; let ok = true, dropped = 0;
    // route waypoint to waypoint; an unreachable waypoint is skipped (connect around it) rather than failing the walk
    let from = 0, joined = 1;
    for (let k = 1; k < seq.length; k++) {
      const c = this.astar(pass, seq[from], seq[k]);
      if (c) { cells.push(...c); from = k; joined++; }
      else if (k === seq.length - 1 || !closed) { ok = false; }
      else dropped++;
    }
    if (joined < Math.min(3, seq.length) || cells.length * RES < 3) ok = false; // a walk that links nothing is not a path
    if (dropped && !opts.quietSkips) this.notes.push(`${kind} path skipped ${dropped} unreachable waypoint(s)`);
    const r = Math.ceil(width / 2 / RES);
    for (const k of cells) {
      const ci = k % this.nx, cj = Math.floor(k / this.nx);
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = ci + di, j = cj + dj;
        if (di * di + dj * dj > r * r || i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
        if (this.grid[j * this.nx + i] === FREE) this.grid[j * this.nx + i] = KEEP;
      }
    }
    // simplified polyline (keep turning points) for the overlay and the summary
    const poly = []; let lastDir = null;
    cells.forEach((k, idx) => {
      const p = this.xz(k % this.nx, Math.floor(k / this.nx));
      if (idx === 0 || idx === cells.length - 1) { poly.push(p); return; }
      const n = cells[idx + 1], dir = `${(n % this.nx) - (k % this.nx)},${Math.floor(n / this.nx) - Math.floor(k / this.nx)}`;
      if (dir !== lastDir) poly.push(p);
      lastDir = dir;
    });
    const len = cells.length * RES;
    const path = { kind, pts: poly.map(([x, z]) => [+x.toFixed(2), +z.toFixed(2)]), ok, len: +len.toFixed(1) };
    this.paths.push(path);
    return path;
  }

  // ---------- zones ----------
  rectFree(r, allowKeep = false) {
    const [i0, j0] = this.rc(r[0] + 1e-6, r[1] + 1e-6), [i1, j1] = this.rc(r[2] - 1e-6, r[3] - 1e-6);
    if (i0 < 0 || j0 < 0 || i1 >= this.nx || j1 >= this.nz) return false;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * this.nx + i; if (this.claim[k] || this.grid[k] === BLOCK || (!allowKeep && this.grid[k] === KEEP)) return false; }
    return true;
  }
  claimRect(r) {
    const [i0, j0] = this.rc(r[0] + 1e-6, r[1] + 1e-6), [i1, j1] = this.rc(r[2] - 1e-6, r[3] - 1e-6);
    for (let j = Math.max(0, j0); j <= Math.min(this.nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) this.claim[j * this.nx + i] = 1;
  }
  // best free rectangle for a zone of size w x d (either orientation); pref(rect) -> lower is better
  findRect(w, d, pref, { allowKeep = false } = {}) {
    // summed-area table of "taken" cells: every candidate rect is checked in O(1)
    const nx = this.nx, nz = this.nz, S = new Int32Array((nx + 1) * (nz + 1));
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, bad = this.claim[k] || this.grid[k] === BLOCK || (!allowKeep && this.grid[k] === KEEP) ? 1 : 0;
      S[(j + 1) * (nx + 1) + i + 1] = bad + S[j * (nx + 1) + i + 1] + S[(j + 1) * (nx + 1) + i] - S[j * (nx + 1) + i];
    }
    const taken = (r) => {
      const [i0, j0] = this.rc(r[0] + 1e-6, r[1] + 1e-6), [i1, j1] = this.rc(r[2] - 1e-6, r[3] - 1e-6);
      if (i0 < 0 || j0 < 0 || i1 >= nx || j1 >= nz) return true;
      return S[(j1 + 1) * (nx + 1) + i1 + 1] - S[j0 * (nx + 1) + i1 + 1] - S[(j1 + 1) * (nx + 1) + i0] + S[j0 * (nx + 1) + i0] > 0;
    };
    let best = null;
    for (const [rw, rd] of w === d ? [[w, d]] : [[w, d], [d, w]]) {
      if (rw > this.W || rd > this.D) continue;
      for (let x = this.X0; x + rw <= this.X1 + 1e-6; x += 1) for (let z = this.Z0; z + rd <= this.Z1 + 1e-6; z += 1) {
        const r = [x, z, x + rw, z + rd];
        if (taken(r)) continue;
        const s = pref(r) + this.rng() * 0.5;
        if (!best || s < best.s) best = { r, s };
      }
    }
    return best ? best.r : null;
  }
  touchesWall(r, tol = 0.6) { return r[0] - this.X0 < tol || this.X1 - r[2] < tol || r[1] - this.Z0 < tol || this.Z1 - r[3] < tol; }
  rectWallSide(r) { // the wall a rect hugs (closest), for wall-anchored zones
    const d = { W: r[0] - this.X0, E: this.X1 - r[2], N: r[1] - this.Z0, S: this.Z1 - r[3] };
    return Object.entries(d).sort((a, b) => a[1] - b[1])[0][0];
  }
  zoneDist(r) { // distance from rect centre to the nearest existing zone centre
    const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2;
    return this.zones.reduce((m, z) => Math.min(m, Math.hypot(cx - (z.rect[0] + z.rect[2]) / 2, cz - (z.rect[1] + z.rect[3]) / 2)), 99);
  }
  doorDist(r) { const cx = (r[0] + r[2]) / 2, cz = (r[1] + r[3]) / 2; return this.doors.reduce((m, d) => Math.min(m, Math.hypot(cx - d.inner[0], cz - d.inner[1])), 99); }
  addZone(kind, label, rect) {
    this.claimRect(rect);
    const z = { kind, label, rect: rect.map(v => +v.toFixed(2)), items: [] };
    this.zones.push(z);
    return z;
  }
  tag(z, p) { if (p) { p.zone = z.kind; z.items.push(p.uid); } return p; }

  // seats around a focus point inside a rect, all facing it (inward seating)
  ring(z, ids, n, focus, radius, rect) {
    const out = [];
    rect = [Math.max(this.X0, rect[0] - 1), Math.max(this.Z0, rect[1] - 1), Math.min(this.X1, rect[2] + 1), Math.min(this.Z1, rect[3] + 1)];
    for (const id of this.pick(ids, n)) {
      const k = out.length, a0 = this.r(0, Math.PI * 2);
      const self = this, float = this.area() >= 450 && /^(chair|settle|stool)/.test(id) ? 2.5 : 0; // big rooms: seats float off the walls
      const p = this.put(id, function* (dm) {
        for (let q = 0; q < 16; q++) {
          const a = a0 + (q + k * 0.5) * Math.PI / 8, r = radius + dm.d / 2;
          const x = focus[0] + Math.cos(a) * r, zz = focus[1] + Math.sin(a) * r;
          if (float && self.wallDist(x, zz) < float + dm.d / 2) continue;
          yield { x, z: zz, rot: Math.atan2(focus[0] - x, focus[1] - zz), rect };
        }
      }, (c) => out.reduce((m, o) => m - Math.min(3, Math.hypot(c.x - o.x, c.z - o.z)), 0), { zone: z.kind, rule: 'inward-seat', why: `${z.label}: seat facing in`, failWhy: `no room for a seat in ${z.label}` });
      if (p) { this.tag(z, p); out.push(p); }
    }
    return out;
  }
  // a rug filling most of a zone, a focus object at its centre
  zoneRug(z, ids, rect, rot = null) {
    if (!ids.length) return null;
    const cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2;
    const id = this.pick(ids)[0];
    const p = this.rug(id, { at: [cx, cz], rot: rot ?? ((rect[2] - rect[0]) >= (rect[3] - rect[1]) ? Math.PI / 2 : 0), why: `${z.label}: rug defines the zone` });
    return this.tag(z, p);
  }
  centerPut(z, id, rect, { rots = [0, Math.PI / 2], why = '', rule = 'zone-focus' } = {}) {
    const cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2;
    return this.tag(z, this.put(id, (dm) => this.rectGen(dm, rect, rots), (c) => Math.hypot(c.x - cx, c.z - cz), { zone: z.kind, rule, why: why || `${z.label}: focus`, failWhy: `no room for the focus of ${z.label}` }));
  }
  wallPut(z, id, rect, side, { why = '', rule = 'zone-wall', layer = 'furnish' } = {}) {
    if (isHung(this.lib.objects[id], id)) return this.tag(z, this.mount(id, { sides: [side], layer, why: why || `${z.label}: on the wall` }));
    return this.tag(z, this.put(id, (dm) => this.wallGen(dm, [side], { rect }), (c) => { const cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2; return Math.hypot(c.x - cx, c.z - cz); }, { zone: z.kind, rule, layer, why: why || `${z.label}: against the wall`, failWhy: `no wall in ${z.label}` }));
  }
  onTop(z, ids, n, onP, why) { for (const id of this.pick(ids, n)) this.tag(z, this.surface(id, { on: s => s.uid === onP?.uid, why })); }

  // ---------- zone anatomy (ROOMS.md, Harry 2026-10-01) ----------
  // working face: standing room kept clear in front of things you use (oven mouth, hearth, wardrobe doors, bed sides)
  record(...a) { const p = super.record(...a); if (p && !p.parent && p.y < 0.5 && p.orient !== 'floor') this.workFace(p); return p; }
  workFace(p) {
    const depth = WORK_FACE[p.id] ?? (/^bed-/.test(p.id) && !/pallet/.test(p.id) ? 'bed' : null);
    if (!depth || !this.faces) return;
    const [fx, fz] = this.facingVec(p.rot), lx = -fz, lz = fx;
    const keep = (cx, cz, across, along) => { const [aw, ad] = this.aabb(across, along, p.rot); this.mark(cx, cz, aw, ad, KEEP); };
    if (depth === 'bed') { // both long sides, the foot half (the head half is for the nightstands)
      for (const s of [1, -1]) { const off = p.dims[0] / 2 + 1.0; keep(p.x + lx * off * s + fx * p.dims[2] * 0.2, p.z + lz * off * s + fz * p.dims[2] * 0.2, 2.0, p.dims[2] * 0.6); }
      this.faces.push({ uid: p.uid, id: p.id, depth: 2 });
      return;
    }
    const off = p.dims[2] / 2 + depth / 2;
    keep(p.x + fx * off, p.z + fz * off, p.dims[0] + 0.5, depth);
    this.faces.push({ uid: p.uid, id: p.id, depth });
  }
  // v1's wall() doesn't know about working faces: anything that has one goes through put(), which checks its face is free
  wall(id, o = {}) {
    if (!WORK_FACE[id] || isHung(this.lib.objects[id], id)) return super.wall(id, o);
    const near = o.near, sides = o.sides || this.shuffle(['N', 'S', 'E', 'W']);
    return this.put(id, (dm) => this.wallGen(dm, sides, { gap: o.gap ?? 0.05 }), (c) => (near ? Math.hypot(c.x - near[0], c.z - near[1]) : this.rng() * 10) + (o.maxDist && near && Math.hypot(c.x - near[0], c.z - near[1]) > o.maxDist ? 1e3 : 0),
      { layer: o.layer || 'furnish', rule: o.rule || 'against-wall', why: o.why || 'against a wall, with room in front', allowKeep: !!o.allowKeep, unique: !!o.unique, sku: o.sku, failWhy: 'no wall space with room in front of it' });
  }
  // a style choice rolled once per generation (every best-of-N candidate shares it; Roll again re-rolls), reported
  roll(name, options) {
    const v = options[Math.floor(mulberry32(hash(this.baseSeed ?? this.room.seed, 'roll', name))() * options.length)];
    if (!this.rolls.some(x => x.startsWith(name + ':'))) this.rolls.push(`${name}: ${v}`);
    return v;
  }
  // companions: things that belong within reach of another (peel with the oven, towel with the tub), never in its face
  companion(anchor, id, { z = null, why = '', layer = 'furnish', maxDist = 6 } = {}) {
    if (!anchor || !id || !this.has(id)) return null;
    const self = this, ax = anchor.x, az = anchor.z, wallOnly = this.lib.objects[id].place === 'wall';
    const sides = anchor.side ? [anchor.side, ...['N', 'S', 'E', 'W'].filter(s => s !== anchor.side)] : ['N', 'S', 'E', 'W'];
    const box = [Math.max(this.X0, ax - maxDist), Math.max(this.Z0, az - maxDist), Math.min(this.X1, ax + maxDist), Math.min(this.Z1, az + maxDist)];
    const gen = function* (dm) {
      for (const c of self.wallGen(dm, sides)) if (Math.hypot(c.x - ax, c.z - az) <= maxDist) yield c;
      if (!wallOnly) for (const c of self.rectGen(dm, box, [anchor.rot || 0, (anchor.rot || 0) + Math.PI / 2])) if (Math.hypot(c.x - ax, c.z - az) <= maxDist) yield c;
    };
    const p = this.put(id, gen, (c) => Math.hypot(c.x - ax, c.z - az) - (c.side && c.side === anchor.side ? 1 : 0), { zone: z?.kind, layer, rule: 'companion', why: why || `goes with the ${anchor.id}`, failWhy: `no room within ${maxDist} ft of the ${anchor.id}`, extra: anchor.uid ? { with: anchor.uid } : {} });
    return z ? this.tag(z, p) : p;
  }
  // dividers: a folding screen standing on a zone's open edge (never against a wall), between the zone and the door
  divider(z, rect, why) {
    if (!this.has('screen-folding')) return null;
    const self = this, d = this.mainDoor, cx = (rect[0] + rect[2]) / 2, cz = (rect[1] + rect[3]) / 2;
    const gap = { N: (v) => v - self.Z0, S: (v) => self.Z1 - v, W: (v) => v - self.X0, E: (v) => self.X1 - v };
    const edges = [['N', rect[1]], ['S', rect[3]], ['W', rect[0]], ['E', rect[2]]].filter(([s, v]) => gap[s](v) > 1.5);
    const gen = function* (dm) {
      for (const [s, v] of edges) {
        const horiz = s === 'N' || s === 'S', rot = horiz ? 0 : Math.PI / 2;
        const [a0, a1] = horiz ? [rect[0], rect[2]] : [rect[1], rect[3]];
        const inward = s === 'N' || s === 'W' ? 1 : -1;
        for (const sh of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5, -2.0]) for (let t = a0 + dm.w / 2 - 0.5; t <= a1 - dm.w / 2 + 0.5 + 1e-6; t += 0.5) { const vv = v + inward * sh; if (gap[s](vv) > 1.2) yield horiz ? { x: t, z: vv, rot } : { x: vv, z: t, rot }; }
      }
    };
    // closest to the line of sight from the door to the zone's middle: that's what the screen hides
    const score = (c) => d ? segDist([c.x, c.z], d.inner, [cx, cz]) : 0;
    return this.tag(z, this.put('screen-folding', gen, score, { zone: z.kind, rule: 'zone-divider', why: why || `${z.label}: screen on the open edge`, failWhy: `no open edge for a screen around the ${z.label}` }));
  }
  // like with like: put another barrel by the barrels, another hay bale by the hay
  nearMates(id, mates, why) {
    const self = this;
    const gen = function* (dm) {
      for (const c of self.wallGen(dm, ['N', 'S', 'E', 'W'])) yield c;
      for (const m of mates) yield* self.rectGen(dm, [Math.max(self.X0, m.x - 4), Math.max(self.Z0, m.z - 4), Math.min(self.X1, m.x + 4), Math.min(self.Z1, m.z + 4)], [0, Math.PI / 2, 0.6]);
    };
    const near = (c) => Math.min(...mates.map(m => Math.hypot(c.x - m.x, c.z - m.z)));
    const p = this.put(id, function* (dm) { for (const c of gen(dm)) if (near(c) <= 4.5) yield c; }, (c) => near(c), { layer: 'store', rule: 'like-with-like', why: why || `with the other ${id}s`, failWhy: 'no room by its kind' });
    return p;
  }

  // ---------- checks ----------
  command(label, p, { back = true, flanks: needFlanks = true, focal = false } = {}) {
    if (!p) return null;
    const [fx, fz] = this.facingVec(p.rot);
    const halfD = p.dims[2] / 2, halfW = p.dims[0] / 2;
    const bx = p.x - fx * (halfD + 0.6), bz = p.z - fz * (halfD + 0.6);
    const solid = (x, z) => this.wallDist(x, z) < 0.35 || this.placements.some(q => q.uid !== p.uid && !q.parent && q.orient !== 'floor' && q.y < 0.5 && (() => { const [aw, ad] = this.aabb(q.dims[0], q.dims[2], q.rot); return Math.abs(x - q.x) < aw / 2 + 0.2 && Math.abs(z - q.z) < ad / 2 + 0.2; })());
    const tortoise = !back || solid(bx, bz) || this.wallDist(p.x, p.z) < halfD + 0.8;
    const ffx = p.x + fx * (halfD + 2), ffz = p.z + fz * (halfD + 2);
    const phoenix = ffx > this.X0 && ffx < this.X1 && ffz > this.Z0 && ffz < this.Z1 && !this.placements.some(q => q.uid !== p.uid && !q.parent && q.orient !== 'floor' && q.y < 0.5 && q.dims[1] > 4.0 && Math.hypot(q.x - ffx, q.z - ffz) < 1.0); // only things above seated eye level block the phoenix view
    const lx = -fz, lz = fx, off = halfW + 1.2, back3 = -halfD * 0.55; // flanks sampled toward the back (a bed's head)
    const flank = (sgn) => solid(p.x + lx * off * sgn + fx * back3, p.z + lz * off * sgn + fz * back3) || solid(p.x + lx * off * sgn, p.z + lz * off * sgn);
    const flanks = needFlanks ? flank(1) && flank(-1) : null;
    let doorView = null, blast = false;
    const d = this.mainDoor;
    if (d) {
      const vx = d.inner[0] - p.x, vz = d.inner[1] - p.z, L = Math.hypot(vx, vz) || 1;
      const ang = Math.acos(Math.max(-1, Math.min(1, (vx * fx + vz * fz) / L))) * DEG;
      blast = this.inBlast(d, p.x, p.z, 0.5);
      if (focal || p.focal) blast = false; // axial focal: facing the door on purpose (the grand reveal), not a coffin
      doorView = ang <= 115 && this.losClear([p.x, p.z], d.inner, new Set([p.uid])).ok && !blast;
    }
    const c = { label, uid: p.uid, id: p.id, focal: !!(focal || p.focal) || undefined, tortoise, phoenix, flanks, doorView, blast, score: [tortoise, phoenix, flanks !== false, doorView !== false].filter(Boolean).length / 4 };
    this.primary.push(c);
    return c;
  }
}

// ---------------- zone menus: ordered, growing with area ----------------
// Each entry: kind, label, size [w,d] ft, minArea (sq ft of interior before it appears), repeat (max), pref(ctx, rect)
const near = (ctx, p, r) => p ? Math.hypot((r[0] + r[2]) / 2 - p.x, (r[1] + r[3]) / 2 - p.z) : 0;

function zIsland(ctx, z, rect, { tables = ['table-round-small', 'table-square'], seats = ['chair-plain', 'stool-bar', 'chair-plain'], rugs = ['rug-round', 'rug-striped-woven', 'rug-oval', 'rug-small', 'rug-braided-round'], dress = [], seatsN = null } = {}) {
  ctx.zoneRug(z, rugs.filter(r => ctx.has(r)), rect);
  const t = ctx.centerPut(z, ctx.pick(tables.filter(i => ctx.has(i)))[0] || 'table-square', rect, { why: `${z.label}: table at the centre` });
  if (!t) return;
  ctx.ring(z, seats, seatsN ?? ctx.ri(3, 4), [t.x, t.z], Math.max(t.dims[0], t.dims[2]) / 2 + 0.2, rect);
  ctx.onTop(z, ['candle', 'candlestick'], 1, t, `${z.label}: candle`);
  if (dress.length) ctx.onTop(z, dress, ctx.ri(2, 4), t, `${z.label}: on the table`);
}

const kitchenDoor = (ctx) => ctx.doors.find(d => d.to && ctx.typesOf?.(d.to) === 'kitchen');
const guestDoorOf = (ctx) => ctx.doors.find(d => d.to && !/cellar|storeroom/.test(ctx.typesOf?.(d.to) || '')) || ctx.mainDoor;
const winPref = (ctx, r) => { const side = ctx.rectWallSide(r), w = ctx.windowT[side] || []; if (!w.length || !ctx.touchesWall(r)) return 500; const c = rcx(r), tc = side === 'N' || side === 'S' ? c[0] - ctx.X0 : c[1] - ctx.Z0; return Math.min(...w.map(([a, b]) => Math.abs((a + b) / 2 - tc))); };
const hasWindow = (ctx) => Object.values(ctx.windowT).some(a => a.length);
const rcx = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
// window seat (guest, fine): a bench or chair under a window, with something soft underfoot
function windowSeat(ctx, z, r) {
  const side = ctx.rectWallSide(r), wins = ctx.windowT[side] || [];
  if (!wins.length) return;
  const c = rcx(r), tc = side === 'N' || side === 'S' ? c[0] - ctx.X0 : c[1] - ctx.Z0;
  const [w0, w1] = wins.reduce((a, b) => Math.abs((a[0] + a[1]) / 2 - tc) <= Math.abs((b[0] + b[1]) / 2 - tc) ? a : b);
  const id = ctx.roll('window seat', ['bench-long', 'chair-upholstered']);
  const st = ctx.tag(z, ctx.put(id, (dm) => ctx.wallGen(dm, [side]), (cc) => Math.abs(cc.t - (w0 + w1) / 2), { zone: z.kind, rule: 'window-seat', why: 'window seat under the window', failWhy: 'no room under the window' }));
  if (st) ctx.tag(z, ctx.rug(ctx.pick(['rug-sheepskin', 'rug-small', 'rug-braided-round'])[0], { at: front(st, 1.2), rot: st.rot, why: 'window seat: something soft underfoot' }));
}
// animal pen (barn): two 10-ft partitions out from the wall and two gates across the front, hay and a trough inside
function buildPen(ctx, z, r) {
  const side = ctx.rectWallSide(r), horiz = side === 'N' || side === 'S';
  const at = (id, x, zz, rot, why) => ctx.tag(z, ctx.put(id, () => [{ x, z: zz, rot }], () => 0, { zone: z.kind, layer: 'anchor', rule: 'pen', why, failWhy: 'pen piece blocked' }));
  const back = { N: r[1], S: r[3], W: r[0], E: r[2] }[side], dir = side === 'N' || side === 'W' ? 1 : -1;
  const mid = back + dir * 5, frontLine = back + dir * 10.25;
  if (horiz) { at('stable-stall-partition', r[0] + 0.25, mid, Math.PI / 2, 'animal pen: side rail'); at('stable-stall-partition', r[2] - 0.25, mid, Math.PI / 2, 'animal pen: side rail'); }
  else { at('stable-stall-partition', mid, r[1] + 0.25, 0, 'animal pen: side rail'); at('stable-stall-partition', mid, r[3] - 0.25, 0, 'animal pen: side rail'); }
  const gr = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 }[side];
  for (const off of [2.5, 7.5]) if (horiz) at('stable-stall-gate', r[0] + off, frontLine, gr, 'animal pen: gate'); else at('stable-stall-gate', frontLine, r[1] + off, gr, 'animal pen: gate');
  ctx.tag(z, ctx.rug('rug-hay-scatter', { at: horiz ? [rcx(r)[0], mid] : [mid, rcx(r)[1]], why: 'hay in the pen' }));
  ctx.wallPut(z, ctx.pick(['feed-trough', 'water-trough'])[0], r, side, { why: 'trough in the pen' });
}

const COMMON_FOOD = ['plate', 'tankard', 'mug-of-ale', 'tankard-of-ale', 'bread-loaf', 'stew-bowl', 'soup-bowl', 'cheese-slice', 'drumstick', 'pie-meat', 'pitcher', 'bottle', 'apple', 'plate-roast-veg', 'trencher-meal', 'cup-clay', 'knife-table', 'spoon-wooden'];

const MENUS = {
  common: [
    { kind: 'dining', label: 'dining island', size: [8, 8], fallback: [[7, 7]], minArea: 0, repeat: 9, phase: 'core', pref: (ctx, r) => -Math.min(10, ctx.zoneDist(r)) + 0.15 * ctx.wallDist((r[0] + r[2]) / 2, (r[1] + r[3]) / 2) * -1 + (ctx.touchesWall(r) ? 2 : 0), fill: (ctx, z, r) => zIsland(ctx, z, r, { dress: COMMON_FOOD }) },
    { kind: 'nook', label: "adventurers' nook", size: [9, 8], minArea: 520, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -4 : 0) - Math.min(8, ctx.doorDist(r)) * 0.3, fill: (ctx, z, r) => {
      zIsland(ctx, z, r, { tables: ['table-square'], rugs: ['rug-bearskin', 'rug-striped-woven'], dress: ['map-treasure', 'playing-cards', 'coin-stack', 'dagger', 'journal-leather', 'dice-and-cup'] });
      for (const id of ctx.pick(['backpack', 'loot-sack', 'sword-long'], 2)) ctx.tag(z, ctx.put(id, (dm) => ctx.rectGen(dm, r, [0, Math.PI / 2, 0.7]), () => 0, { zone: z.kind, layer: 'dress', rule: 'zone-gear', why: "adventurers' gear by their table" }));
    } },
    { kind: 'barrels', label: 'barrel table', size: [6, 6], minArea: 800, repeat: 6, phase: 'core', pref: (ctx, r) => -Math.min(8, ctx.zoneDist(r)) * 0.5, fill: (ctx, z, r) => {
      const b = ctx.centerPut(z, 'barrel', r, { why: 'barrel table: a standing spot for drinkers' });
      if (b) { ctx.ring(z, ['stool-bar'], 2, [b.x, b.z], b.dims[0] / 2 + 0.2, r); ctx.onTop(z, ['tankard', 'mug-of-ale', 'tankard-of-ale', 'dice-and-cup', 'bottle'], 2, b, 'on the barrel'); }
    } },
    { kind: 'entry', label: 'entry landing', size: [6, 3], minArea: 300, repeat: 1, quiet: true, when: (ctx) => !!ctx.mainDoor, pref: (ctx, r) => 1.5 * ctx.doorDist(r) + (ctx.touchesWall(r) ? -3 : 3), fill: (ctx, z, r) => {
      const d = doorAnchor(ctx.mainDoor);
      ctx.tag(z, ctx.mount('coat-pegs', { sides: [d.side], why: 'entry landing: pegs by the door' }));
      ctx.companion(d, 'notice-board', { z, why: 'entry landing: notices by the door', maxDist: 10, layer: 'dress' });
      ctx.companion(d, 'bench-long', { z, why: 'entry landing: a bench by the door', maxDist: 10 });
    } },
    { kind: 'serve', label: 'serving station', size: [6, 4], minArea: 450, repeat: 1, quiet: true, when: (ctx) => !!kitchenDoor(ctx), pref: (ctx, r) => { const k = kitchenDoor(ctx); return Math.hypot(rcx(r)[0] - k.inner[0], rcx(r)[1] - k.inner[1]) + (ctx.touchesWall(r) ? -3 : 3); }, fill: (ctx, z, r) => {
      const k = doorAnchor(kitchenDoor(ctx));
      const t = ctx.companion(k, 'table-side', { z, why: 'serving station by the kitchen door', maxDist: 9 });
      if (t) ctx.onTop(z, ['tray-wood-round', 'tray-long-tavern', 'tankard', 'pitcher', 'plate', 'stew-bowl'], 3, t, 'serving station: ready to go out');
      const b = ctx.companion(t || k, 'barrel', { z, why: 'a tapped cask at the serving station', maxDist: 6 });
      if (b) ctx.onTop(z, ['cask-small-spigot'], 1, b, 'tap on the cask');
    } },
    { kind: 'stage', label: "bard's corner", size: [9, 8], minArea: 420, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -5 : 3) + (ctx.rectWallSide(r) && ctx.doors.some(d => d.side === ctx.rectWallSide(r)) ? 2 : 0), fill: (ctx, z, r) => {
      const side = ctx.rectWallSide(r);
      const st = ctx.wallPut(z, 'bard-instrument-stand', r, side, { why: "bard's corner: the stage", rule: 'zone-focus' });
      if (!st) return;
      ctx.zoneRug(z, ['rug-small', 'rug-striped-woven'].filter(i => ctx.has(i)), r);
      for (const id of ctx.pick(['bard-lute-case', 'bard-tip-hat', 'bard-songbook', 'bard-sheet-music-scatter', 'bard-playbill'], 2)) ctx.tag(z, ctx.auto(id, { near: [st.x, st.z], why: "bard's corner clutter" }));
      ctx.ring(z, ['stool-bar', 'chair-plain'], 3, [st.x, st.z], 3.2, r);
    } },
  ],
  guest: [
    { kind: 'wash', label: 'washstand corner', size: [5, 4], minArea: 0, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 3) + 0.4 * ctx.doorDist(r), fill: (ctx, z, r) => {
      const w = ctx.wallPut(z, 'washstand', r, ctx.rectWallSide(r), { why: 'washstand by the door (transition zone)' });
      if (w) ctx.onTop(z, ['water-jug-basin', 'pitcher', 'bowl', 'towel-stack'], 2, w, 'on the washstand');
      ctx.tag(z, ctx.wallPut(z, 'chest-plain', r, ctx.rectWallSide(r), { why: 'chest by the door', layer: 'store' }));
    } },
    { kind: 'seat', label: 'sitting spot', size: [6, 6], minArea: 130, repeat: 1, pref: (ctx, r) => -0.3 * ctx.doorDist(r) + (ctx.touchesWall(r) ? -1 : 1), fill: (ctx, z, r) => {
      ctx.zoneRug(z, ['rug-round', 'rug-braided-round', 'rug-striped-woven'].filter(i => ctx.has(i)), r);
      const t = ctx.centerPut(z, 'table-side', r, { why: 'sitting spot: small table' });
      if (t) { ctx.ring(z, ['chair-plain'], 1, [t.x, t.z], Math.max(t.dims[0], t.dims[2]) / 2 + 0.3, r); ctx.onTop(z, ['candle', 'candlestick'], 1, t, 'candle'); }
    } },
    { kind: 'window', label: 'window seat', size: [6, 4], minArea: 150, repeat: 1, quiet: true, when: hasWindow, pref: (ctx, r) => winPref(ctx, r), fill: windowSeat },
    { kind: 'store', label: 'wardrobe wall', size: [6, 3], minArea: 200, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 5), fill: (ctx, z, r) => { ctx.tag(z, ctx.wallPut(z, ctx.pick(['wardrobe', 'linen-chest', 'clothes-chest-open'])[0], r, ctx.rectWallSide(r), { why: 'storage on the wall', layer: 'store' })); } },
  ],
  fine: [
    { kind: 'seat', label: 'seating zone', size: [9, 8], fallback: [[7, 6]], minArea: 0, repeat: 2, pref: (ctx, r) => -Math.min(9, ctx.zoneDist(r)) * 0.4 + 0.15 * ctx.doorDist(r), fill: (ctx, z, r) => {
      ctx.zoneRug(z, ['rug-round-fine', 'rug-round', 'rug-oval'].filter(i => ctx.has(i)), r);
      const t = ctx.centerPut(z, 'table-side', r, { why: 'seating zone: low table' });
      if (t) { ctx.ring(z, ['chair-upholstered', 'chair-upholstered', 'chair-plain'], 2, [t.x, t.z], Math.max(t.dims[0], t.dims[2]) / 2 + 0.3, r); ctx.onTop(z, ['candelabra', 'vase-flowers'], 1, t, 'on the table'); }
    } },
    { kind: 'read', label: 'reading & writing corner', size: [7, 6], minArea: 280, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -4 : 3), fill: (ctx, z, r) => {
      const d = ctx.wallPut(z, 'desk-writing', r, ctx.rectWallSide(r), { why: 'writing desk on the wall', rule: 'zone-focus' });
      if (d) { ctx.ring(z, ['chair-plain', 'chair-upholstered'], 1, [d.x, d.z], Math.max(d.dims[0], d.dims[2]) / 2 + 0.2, r); ctx.onTop(z, ['candlestick', 'journal-leather', 'ledger-accounts'], 2, d, 'on the desk'); ctx.command('writing desk', d, { back: false }); }
    } },
    { kind: 'fire', label: 'fireplace zone', size: [10, 8], minArea: 360, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -5 : 5) + (ctx.doors.some(d => d.side === ctx.rectWallSide(r)) ? 3 : 0), fill: (ctx, z, r) => {
      const side = ctx.rectWallSide(r);
      const f = ctx.wallPut(z, 'fireplace-wall', r, side, { why: 'fireplace: a fire of their own', rule: 'zone-focus', layer: 'anchor' });
      if (!f) return;
      const [nx, nz] = SIDES[side].n;
      ctx.tag(z, ctx.rug(ctx.pick(['rug-bearskin', 'rug-hearth-halfmoon', 'rug-sheepskin'])[0], { at: [f.x + nx * (f.dims[2] / 2 + 1.6), f.z + nz * (f.dims[2] / 2 + 1.6)], rot: f.rot, why: 'pelt before the fire' }));
      ctx.ring(z, ['chair-upholstered'], 2, [f.x + nx * (f.dims[2] / 2), f.z + nz * (f.dims[2] / 2)], 3.6, r);
    } },
    // privacy gradient: bathing and dressing go deep (far from the door) and screened; sitting stays nearer the door
    { kind: 'bath', label: 'bathing zone', size: [9, 7], minArea: 460, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -2 : 2) - 0.6 * ctx.doorDist(r), fill: (ctx, z, r) => {
      const tub = ctx.centerPut(z, 'bathtub-wood', r, { why: 'bathing zone: the tub' });
      if (!tub) return;
      if (ctx.area() >= 900 && ctx.roll('tubs', ['one tub', 'two tubs']) === 'two tubs') ctx.companion(tub, 'bathtub-wood', { z, why: 'tubs live together', maxDist: 6 });
      const stand = ctx.companion(tub, 'washstand', { z, why: 'towels within reach of the tub', maxDist: 5 }) || ctx.companion(tub, 'table-side', { z, why: 'towels within reach of the tub', maxDist: 6 });
      if (stand) ctx.unplaced = ctx.unplaced.filter(u => !(u.id === 'washstand' && /within/.test(u.why)));
      if (stand) ctx.onTop(z, ['towel-stack'], 1, stand, 'towel by the tub');
      ctx.divider(z, r, 'bathing zone: a screen for privacy');
    } },
    { kind: 'dress', label: 'dressing area', size: [8, 6], minArea: 520, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 40) - 0.4 * ctx.doorDist(r), fill: (ctx, z, r) => {
      const w = ctx.wallPut(z, 'wardrobe', r, ctx.rectWallSide(r), { why: 'dressing area: wardrobe', rule: 'zone-focus', layer: 'store' });
      if (!w) return;
      ctx.companion(w, 'mirror-standing', { z, why: 'mirror beside the wardrobe', maxDist: 6 });
      ctx.companion(w, 'table-vanity', { z, why: 'vanity in the dressing area', maxDist: 7 });
      ctx.divider(z, r, 'dressing area: a screen to change behind');
    } },
    { kind: 'dine', label: 'private dining', size: [8, 8], minArea: 650, repeat: 1, quiet: true, pref: (ctx, r) => -Math.min(9, ctx.zoneDist(r)) * 0.3 + 0.1 * ctx.doorDist(r), fill: (ctx, z, r) => zIsland(ctx, z, r, { tables: ['table-round-small'], seats: ['chair-upholstered', 'chair-plain'], seatsN: 2, rugs: ['rug-round-fine', 'rug-round', 'rug-oval'], dress: ['plate', 'bottle-of-wine-open', 'cup-pewter', 'candelabra', 'bread-loaf', 'cheese-slice'] }) },
    { kind: 'window', label: 'window seat', size: [6, 4], minArea: 400, repeat: 1, quiet: true, when: hasWindow, pref: (ctx, r) => winPref(ctx, r), fill: windowSeat },
    { kind: 'servant', label: "servant's corner", size: [8, 8], minArea: 900, repeat: 1, quiet: true, pref: (ctx, r) => 0.8 * ctx.doorDist(r) + (ctx.touchesWall(r) ? -3 : 3), fill: (ctx, z, r) => {
      const opts = ['bed-straw-pallet', 'bed-single'].filter(i => ctx.has(i)); // the grade floor keeps a pallet out of a fine room
      const b = opts.length ? ctx.wallPut(z, ctx.roll("servant's bed", opts), r, ctx.rectWallSide(r), { why: "servant's corner: a bed near the door" }) : null;
      if (b) { ctx.companion(b, ['stool-three-leg', 'chair-plain'].find(i => ctx.has(i)), { z, why: "servant's stool", maxDist: 4 }); ctx.companion(b, 'chest-plain', { z, why: "servant's chest", maxDist: 4.5, layer: 'store' }); }
    } },
  ],
  kitchen: [
    // bake corner (Harry: the peel goes with the oven; the rack must not block it; the oven mouth must stay clear)
    { kind: 'bake', label: 'bake corner', size: [9, 7], fallback: [[9, 5.2], [8, 5]], minArea: 260, repeat: 4, per: 700, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4), fill: (ctx, z, r) => {
      // choose the oven's spot knowing its companions: a clear 5 ft of wall (no window, no door) on at least one side for the peel
      const side = ctx.rectWallSide(r), c0 = rcx(r);
      const o = ctx.tag(z, ctx.put('bread-oven', (dm) => ctx.wallGen(dm, [side], { rect: r }), (c, dm) => {
        const L = ctx.sideLen(c.side), half = dm.w / 2, clear = (a, b) => a >= 0 && b <= L && !ctx.overlapsT(ctx.windowT[c.side], a, b) && !ctx.overlapsT(ctx.doorT[c.side], a, b);
        return (clear(c.t - half - 5, c.t - half) || clear(c.t + half, c.t + half + 5) ? 0 : 10) + Math.hypot(c.x - c0[0], c.z - c0[1]) * 0.2;
      }, { zone: z.kind, layer: 'anchor', rule: 'zone-focus', why: 'bake corner: the bread oven, with wall beside it for the peel', failWhy: 'no wall in the bake corner' }));
      if (!o) return;
      ctx.companion(o, 'bread-peel', { z, why: 'the peel lives beside the oven', maxDist: 7 }); // the peel mesh is modelled diagonally: 4.6 ft wide at catalog scale
      ctx.companion(o, 'bread-rack', { z, why: 'bread rack beside the oven, clear of its mouth', maxDist: 7 });
      ctx.companion(o, 'flour-sack-open', { z, why: 'flour within reach of the oven', maxDist: 7, layer: 'store' });
    } },
    { kind: 'wash', label: 'scullery', size: [6, 4], minArea: 150, repeat: 3, per: 1100, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) + 0.2 * ctx.doorDist(r), fill: (ctx, z, r) => {
      for (const id of ctx.pick(['washing-bowl-dishes', 'bucket', 'barrel', 'broom', 'bucket'], 4)) ctx.tag(z, ctx.auto(id, { near: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], why: 'scullery: washing up' }));
      for (const s of ctx.surfaces.filter(s => z.items.includes(s.uid))) for (const id of ctx.pick(['dish-rag-hanging', 'bowl', 'plate', 'cup-clay', 'spoon-wooden', 'mug-chipped'].filter(i => ctx.lib.objects[i]?.place === 'surface'), 3)) ctx.tag(z, ctx.surface(id, { on: x => x === s, why: 'washing-up clutter' }));
      ctx.unplaced = ctx.unplaced.filter(u => u.why !== 'no room on the chosen surface');
    } },
    { kind: 'larder', label: 'larder corner', size: [6, 5], minArea: 120, repeat: 4, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) - Math.min(8, ctx.zoneDist(r)) * 0.2, fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['sack', 'potato-pile', 'vegetable-basket-mixed', 'turnip-basket', 'apple-basket', 'crock', 'flour-sack-open', 'barrel'], 4)) ctx.tag(z, ctx.auto(id, { near: c, why: 'larder corner', layer: 'store' })); } },
    { kind: 'pass', label: 'serving pass', size: [6, 4], minArea: 350, repeat: 1, quiet: true, when: (ctx) => !!guestDoorOf(ctx) && !ctx.zones.some(z => z.kind === 'pass'), pref: (ctx, r) => { const g = guestDoorOf(ctx); return Math.hypot(rcx(r)[0] - g.inner[0], rcx(r)[1] - g.inner[1]) + (ctx.touchesWall(r) ? -3 : 3); }, fill: (ctx, z, r) => {
      const t = ctx.companion(doorAnchor(guestDoorOf(ctx)), ctx.pick(['table-side', 'table-kitchen-prep'])[0], { z, why: 'serving pass by the door to the guests', maxDist: 9 });
      if (t) ctx.onTop(z, ['plate', 'stew-bowl', 'soup-bowl', 'bread-loaf', 'tray-wood-round', 'tray-long-tavern', 'plate-roast-veg'], 4, t, 'serving pass: plates going out');
    } },
    { kind: 'prep', label: 'prep island', size: [9, 7], minArea: 600, repeat: 2, quiet: true, when: (ctx) => !ctx.kitchenRows, pref: (ctx, r) => -Math.min(8, ctx.wallDist(...rcx(r))) * 0.5 + (ctx.touchesWall(r) ? 4 : 0), fill: (ctx, z, r) => {
      const t = ctx.centerPut(z, 'table-kitchen-prep', r, { why: 'prep island in the open floor' });
      if (!t) return;
      ctx.ring(z, ['stool-three-leg', 'stool-bar'], 2, [t.x, t.z], Math.max(t.dims[0], t.dims[2]) / 2 + 0.2, r);
      ctx.onTop(z, ['cutting-board', 'knife-carving', 'cleaver', 'onion-sliced', 'potato-peeled', 'dough-kneading', 'bowl-wood-small'], 4, t, 'prep island: work in progress');
    } },
    { kind: 'staff', label: 'staff table', size: [11, 7], minArea: 750, repeat: 1, quiet: true, when: (ctx) => !ctx.zones.some(z => z.kind === 'staff'), pref: (ctx, r) => -Math.min(8, ctx.zoneDist(r)) * 0.3 + (ctx.touchesWall(r) ? -1 : 1), fill: (ctx, z, r) => zIsland(ctx, z, r, { tables: [ctx.roll('staff table', ['table-trestle', 'table-square'])], seats: ['bench-long', 'stool-three-leg'], rugs: [], dress: ['bowl', 'stew-bowl', 'bread-loaf', 'mug-of-ale', 'cup-clay', 'spoon-wooden'] }) },
  ],
  desk: [
    { kind: 'wait', label: 'waiting bench', size: [7, 4], minArea: 0, repeat: 2, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) - Math.min(9, ctx.zoneDist(r)) * 0.2, fill: (ctx, z, r) => { const b = ctx.wallPut(z, 'bench-long', r, ctx.rectWallSide(r), { why: 'waiting bench, long side to the wall' }); if (b) ctx.tag(z, ctx.mount(ctx.pick(['bounty-poster', 'proclamation-scroll', 'painting-landscape'])[0], { sides: [ctx.rectWallSide(r)], why: 'something to read while waiting' })); } },
    { kind: 'luggage', label: 'luggage pile', size: [5, 4], minArea: 120, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -2 : 3) + 0.15 * ctx.doorDist(r), fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['backpack', 'loot-sack', 'sack', 'blankets-folded', 'chest-plain', 'carpetbag'], 3)) ctx.tag(z, ctx.auto(id, { near: c, why: "guests' luggage" })); } },
    { kind: 'notice', label: 'notice wall', size: [6, 3], minArea: 200, repeat: 1, quiet: true, when: (ctx) => !!ctx.mainDoor, pref: (ctx, r) => ctx.doorDist(r) + (ctx.touchesWall(r) ? -4 : 4), fill: (ctx, z, r) => {
      const nb = ctx.companion(doorAnchor(ctx.mainDoor), 'notice-board', { z, why: 'notice wall by the way in', maxDist: 14, layer: 'dress' });
      if (nb) for (const id of ctx.pick(['bounty-poster', 'proclamation-scroll', 'bard-playbill'], 2)) ctx.tag(z, ctx.mount(id, { sides: [nb.side || ctx.rectWallSide(r)], why: 'posted on the notice wall' }));
    } },
    { kind: 'lounge', label: 'lounge', size: [9, 9], minArea: 380, repeat: 1, pref: (ctx, r) => -Math.min(9, ctx.zoneDist(r)) * 0.3, fill: (ctx, z, r) => zIsland(ctx, z, r, { tables: ['table-round-small'], dress: ['tankard', 'pitcher', 'cup-clay'] }) },
  ],
  hallway: [],
  privy: [],
  storeroom: [
    { kind: 'tally', label: 'tally desk', size: [6, 5], minArea: 600, repeat: 1, quiet: true, doorSide: true, pref: (ctx, r) => 0.8 * ctx.doorDist(r) + (ctx.touchesWall(r) ? -3 : 3), fill: (ctx, z, r) => {
      const did = ctx.has('desk-writing') ? 'desk-writing' : 'table-side';
      const d = r.doorSide ? ctx.companion(doorAnchor(ctx.mainDoor), did, { z, why: 'tally desk by the door: who took what', maxDist: 12 }) : ctx.wallPut(z, did, r, ctx.rectWallSide(r), { why: 'tally desk: who took what', rule: 'zone-focus' });
      if (d) { ctx.companion(d, 'stool-three-leg', { z, why: "the tally clerk's stool", maxDist: 4 }); ctx.onTop(z, ['ledger-accounts', 'candlestick', 'coin-stack', 'key-ring'], 3, d, 'on the tally desk'); }
    } },
  ],
  cellar: [
    { kind: 'cold', label: 'cold store', size: [7, 4], minArea: 400, repeat: 1, quiet: true, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 5) - 0.2 * ctx.doorDist(r), fill: (ctx, z, r) => {
      const a = ctx.wallPut(z, ctx.pick(['cheese-shelf-aging', 'smoked-meat-rack'])[0], r, ctx.rectWallSide(r), { why: 'cold store: aging and curing', layer: 'store', rule: 'zone-focus' });
      if (!a) return;
      ctx.companion(a, a.id === 'cheese-shelf-aging' ? 'smoked-meat-rack' : 'cheese-shelf-aging', { z, why: 'cold store', maxDist: 7, layer: 'store' });
      ctx.tag(z, ctx.ceiling('ham-hanging', { at: [a.x, a.z], layer: 'dress', why: 'hams curing overhead' }));
    } },
    { kind: 'tap', label: 'tapping spot', size: [7, 7], minArea: 550, repeat: 1, quiet: true, pref: (ctx, r) => 0.4 * ctx.doorDist(r) - Math.min(6, ctx.zoneDist(r)) * 0.2, fill: (ctx, z, r) => {
      const b = ctx.centerPut(z, 'barrel', r, { why: 'tapping spot: a barrel for a table' });
      if (b) { ctx.onTop(z, ['cask-small-spigot', 'tankard', 'cup-clay', 'candle'], 3, b, 'tasting the stock'); ctx.ring(z, ['stool-three-leg'], 2, [b.x, b.z], b.dims[0] / 2 + 0.2, r); }
    } },
  ],
  stable: [
    { kind: 'tack', label: 'tack corner', size: [6, 4], minArea: 0, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4), fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['tack-wall', 'rural-saddle-riding', 'bridle-hanging', 'horse-blanket-rail', 'saddle-rack'], 3)) ctx.tag(z, ctx.auto(id, { near: c, why: 'tack corner', layer: 'store' })); } },
    { kind: 'feed', label: 'feed corner', size: [6, 5], minArea: 0, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) - Math.min(9, ctx.zoneDist(r)) * 0.2, fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['grain-bin-stable', 'rural-oat-sack', 'hay-bale', 'hay-bale'], 3)) ctx.tag(z, ctx.auto(id, { near: c, why: 'feed corner', layer: 'store' })); } },
    { kind: 'groom', label: 'grooming spot', size: [6, 5], minArea: 300, repeat: 1, pref: (ctx, r) => -Math.min(9, ctx.zoneDist(r)) * 0.2, fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['farrier-stand', 'rural-grooming-box', 'rural-water-bucket-stable', 'bucket'], 3)) ctx.tag(z, ctx.auto(id, { near: c, why: 'grooming spot' })); } },
    { kind: 'muck', label: 'muck corner', size: [5, 5], minArea: 420, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) - 0.3 * ctx.doorDist(r), fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['manure-heap', 'rural-manure-barrow', 'pitchfork'], 2)) ctx.tag(z, ctx.auto(id, { near: c, why: 'muck corner, far from the door' })); } },
  ],
  barn: [
    { kind: 'hay', label: 'hay store', size: [8, 6], minArea: 0, repeat: 3, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) - Math.min(10, ctx.zoneDist(r)) * 0.2, fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['hay-bale', 'hay-bale', 'hay-pile'], ctx.ri(3, 5))) ctx.tag(z, ctx.put(id, (dm) => ctx.rectGen(dm, r, [0, Math.PI / 2, 0.3]), (cc) => Math.hypot(cc.x - c[0], cc.z - c[1]), { zone: z.kind, layer: 'store', rule: 'zone-pile', why: 'hay store' })); ctx.tag(z, ctx.rug('rug-hay-scatter', { at: c, why: 'loose hay' })); } },
    { kind: 'tools', label: 'tool wall', size: [7, 4], minArea: 0, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4), fill: (ctx, z, r) => { const c = [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]; for (const id of ctx.pick(['pitchfork', 'wheelbarrow', 'cart-hand', 'ladder-wood', 'saddle-rack', 'horse-collar'], 3)) ctx.tag(z, ctx.auto(id, { near: c, why: 'tool wall' })); } },
    { kind: 'pen', label: 'animal pen', size: [10.5, 10.5], minArea: 600, repeat: 2, quiet: true, pref: (ctx, r) => (ctx.touchesWall(r) ? -4 : 50) - Math.min(10, ctx.zoneDist(r)) * 0.2 + (ctx.doorDist(r) < 8 ? 6 : 0), fill: buildPen },
    { kind: 'feedstore', label: 'feed store', size: [6, 5], minArea: 300, repeat: 1, quiet: true, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4) + 0.1 * ctx.doorDist(r), fill: (ctx, z, r) => {
      const g = ctx.wallPut(z, 'grain-bin-stable', r, ctx.rectWallSide(r), { why: 'feed store: the grain bin', rule: 'zone-focus', layer: 'store' });
      for (const id of ['rural-oat-sack', 'sack', 'feed-trough']) ctx.companion(g, id, { z, why: 'feed store', maxDist: 6, layer: 'store' });
    } },
    { kind: 'water', label: 'troughs', size: [8, 4], minArea: 300, repeat: 1, pref: (ctx, r) => (ctx.touchesWall(r) ? -3 : 4), fill: (ctx, z, r) => { for (const id of ['water-trough', 'feed-trough']) ctx.tag(z, ctx.wallPut(z, id, r, ctx.rectWallSide(r), { why: 'troughs along the wall' })); } },
  ],
};

// ---------------- key purpose + flow by role ----------------
function bedPlace(ctx, ids, label) {
  const d = ctx.mainDoor;
  for (const id of ids) {
    if (!ctx.has(id)) continue;
    const p = ctx.put(id, (dm) => ctx.wallGen(dm, ctx.wallsByDoor()), (c, dm) => {
      let s = 0;
      if (d) {
        const dist = Math.hypot(c.x - d.inner[0], c.z - d.inner[1]);
        s -= dist;                                                    // deep: the destination at the end of the line
        if (ctx.inBlast(d, c.x, c.z, 0.5)) s += 40;                    // centre in the door's straight-in band
        const [fx, fz] = ctx.facingVec(c.rot), n = SIDES[d.side].n;
        if (Math.abs(fx * n[0] + fz * n[1]) > 0.9 && ctx.inBlast(d, c.x, c.z, dm.w / 2)) s += 60; // coffin: foot down the line
        s += Math.abs(ctx.angleFromDoor(d, c.x, c.z) - 40) * 0.08;    // diagonal from the door
        if (c.side === d.side) s += 12;                                // not on the door's own wall
      }
      // room for nightstands on both flanks (dragon & tiger)
      const [fx, fz] = ctx.facingVec(c.rot), lx = -fz, lz = fx, o = dm.w / 2 + 1.0;
      if (!ctx.fits(c.x + lx * o, c.z + lz * o, 1.4, 1.4)) s += 2;
      if (!ctx.fits(c.x - lx * o, c.z - lz * o, 1.4, 1.4)) s += 2;
      return s;
    }, { layer: 'anchor', rule: 'key-bed', unique: true, why: `${label}: head to the wall, deep and diagonal from the door`, failWhy: 'no wall run long enough for the bed' });
    if (p) return p;
  }
  return null;
}

// an item at an exact point on a surface (symmetric flankers); registered with the surface so later items avoid it
function surfaceAt(ctx, id, surf, x, z, why, layer = 'light') {
  if (!ctx.has(id)) return null;
  const sk = ctx.chooseSku(id); if (!sk) return null;
  const dm = ctx.dims(id, sk), s = ctx.surfaces.find(q => q.uid === surf.uid);
  const p = ctx.record(id, sk, dm, x, surf.y + surf.dims[1], z, surf.rot, layer, 'on-surface', why, { parent: surf.uid });
  if (s) s.items.push({ x, z, w: dm.w, d: dm.d });
  return p;
}
// Put a focal feature centred on the wall opposite the main door, leaving room for `flankW` ft of companions on each side.
// Returns { p } on success or { fallback: reason } (no door, door on that wall, wall too short, or nothing fits).
function focalPlace(ctx, ids, { label, rule, why, flankW = 2, clearance = 0.6, gap = 0.05, minArea = 0 } = {}) {
  const d = ctx.mainDoor;
  if (!d) return { fallback: 'no main door' };
  if (ctx.area() < minArea) return { fallback: `room under ${minArea} sq ft` };
  const opp = OPP_SIDE[d.side], L = ctx.sideLen(opp);
  let reason = 'nothing fits centred on the far wall';
  if (ctx.doorT[opp].length) reason = `a door on the far (${SIDE_LABEL[opp]}) wall: the axis is a through-way, not a showpiece wall`;
  for (const id of ids) {
    if (!ctx.has(id)) continue;
    const sk = ctx.chooseSku(id); if (!sk) continue;
    const dm = ctx.dims(id, sk);
    if (dm.w + 2 * (flankW + 0.3) + clearance > L) { reason = `the far wall (${L.toFixed(0)} ft) can't fit the ${label} + both flankers`; continue; }
    // centring beats the window: if only a window stands in the way, the piece goes in front of it (a bed under the
    // window, a counter before it) and the window's drapes are skipped (that span is booked as mounted)
    for (const windows of [true, false]) {
      const p = ctx.put(id, (dm2) => ctx.wallGen(dm2, [opp], { gap, tRange: [L / 2 - 0.5, L / 2 + 0.5], step: 0.25, windows }), (c) => Math.abs(c.t - L / 2), { layer: 'anchor', rule, unique: true, why, extra: { focal: true } });
      if (p) {
        const half = (opp === 'N' || opp === 'S' ? ctx.aabb(p.dims[0], p.dims[2], p.rot)[0] : ctx.aabb(p.dims[0], p.dims[2], p.rot)[1]) / 2, t = opp === 'N' || opp === 'S' ? p.x - ctx.X0 : p.z - ctx.Z0;
        const hid = (ctx.windowT[opp] || []).filter(([a, b]) => a < t + half && t - half < b);
        if (hid.length && p.dims[1] > 3.5) { ctx.mounts[opp].push(...hid); ctx.notes.push(`the ${label} stands in front of the ${SIDE_LABEL[opp]} window (centring wins)`); }
        ctx.focal = { label, id: p.id, side: opp, ok: true, window: hid.length > 0 };
        return { p };
      }
      ctx.unplaced.pop();
    }
  }
  ctx.focal = { label, ok: false, why: reason };
  return { fallback: reason };
}

const KEY = {
  // terminals: the destination
  guest(ctx) {
    if (ctx.area() >= 380 && Math.min(ctx.W, ctx.D) >= 14) return dormitory(ctx);
    const ids = ctx.area() >= 150 ? ['bed-double', 'bed-single'] : ['bed-single', 'bed-double'];
    const ft = focalPlace(ctx, ids, { label: 'bed', rule: 'key-bed-focal', why: 'bed: centred on the wall facing the door (axial focal), nightstands either side' });
    const bed = ft.p || bedPlace(ctx, ids, 'bed');
    if (!bed) return { fail: 'guest room has no bed (no wall long enough clear of the door)' };
    flankBed(ctx, bed, ft.p ? { focal: true } : {});
    return { feature: bed, what: 'bed', approach: front(bed, 1.6) };
  },
  fine(ctx) {
    const big = Math.min(ctx.W, ctx.D) >= 30 && ctx.area() >= 1000; // promote only in genuinely big rooms (Harry's case: 40x55)
    const island = big ? islandBed(ctx, ['bed-canopy', 'bed-double'], 'canopy bed') : null;
    if (big && !island) ctx.notes.push('room is big enough to promote the bed, but no central floor for the island');
    // not promoted: the grand-bedroom reveal, centred on the wall facing the door (axial focal), nightstands both sides
    const ft = island ? {} : focalPlace(ctx, ['bed-canopy', 'bed-double'], { label: 'canopy bed', rule: 'key-bed-focal', why: 'canopy bed: centred on the wall facing the door (axial focal, the grand reveal)', minArea: 200 });
    const bed = island || ft.p || bedPlace(ctx, ['bed-canopy', 'bed-double'], 'canopy bed');
    if (!bed) return { fail: 'fine room has no bed' };
    flankBed(ctx, bed, island ? { back: false } : ft.p ? { focal: true } : {}); // a canopy is its own back
    if (island) {
      ctx.growth.push('bed promoted to a freestanding centre island');
      const [aw, ad] = ctx.aabb(bed.dims[0], bed.dims[2], bed.rot), m = 2.5;
      const z = ctx.addZone('sleep', 'sleeping island', [Math.max(ctx.X0, bed.x - aw / 2 - m), Math.max(ctx.Z0, bed.z - ad / 2 - m), Math.min(ctx.X1, bed.x + aw / 2 + m), Math.min(ctx.Z1, bed.z + ad / 2 + m)]);
      z.items.push(bed.uid);
      ctx.tag(z, ctx.rug(ctx.pick(['rug-grand', 'rug-round-fine'])[0], { at: [bed.x, bed.z], rot: bed.rot, why: 'rug under the bed island' }) || ctx.rug('rug-round-fine', { at: [bed.x, bed.z], why: 'rug under the bed island' }));
      const [fx, fz] = front(bed, 1.0);
      ctx.tag(z, ctx.put(ctx.pick(['chest-ironbound', 'linen-chest'])[0], () => [{ x: fx, z: fz, rot: bed.rot + Math.PI / 2 }, { x: fx, z: fz, rot: bed.rot }], () => 0, { zone: 'sleep', layer: 'store', rule: 'companion', why: 'chest at the foot of the bed', allowKeep: true, extra: { with: bed.uid } }));
    } else {
      const [x, z] = front(bed, 1.3);
      ctx.rug(ctx.pick(['rug-sheepskin', 'rug-bearskin'])[0], { at: [x, z], rot: bed.rot, why: 'pelt at the foot of the bed' });
    }
    return { feature: bed, what: island ? 'bed (centre island)' : 'bed', approach: front(bed, 2.4) };
  },
  privy(ctx) {
    const d = ctx.mainDoor;
    for (const id of ['privy-seat-single', 'privy-seat-double']) {
      for (const allowKeep of [false, true]) {
        const p = ctx.put(id, (dm) => ctx.wallGen(dm, ctx.wallsByDoor(), { step: 0.25 }), (c, dm) => {
          let s = 0;
          if (d) { if (ctx.inBlast(d, c.x, c.z, dm.w / 2)) s += 20; if (c.side === d.side) s += 30; s -= 0.3 * Math.hypot(c.x - d.inner[0], c.z - d.inner[1]); }
          return s;
        }, { layer: 'anchor', rule: 'key-privy', unique: true, why: 'privy seat: deep, out of the door\'s line (privacy)', allowKeep, failWhy: 'no wall for the seat' });
        if (p) {
          if (allowKeep) ctx.notes.push('the seat had to use the door approach (very small privy)');
          // growth mode REPEAT: a bigger privy grows a bank of seats along the same wall
          const more = ctx.area() >= 90 ? Math.min(4, Math.floor(ctx.sideLen(p.side) / 3.2) - 1) : 0, bank = [p];
          for (let i = 0; i < more; i++) {
            const q = ctx.put('privy-seat-single', (dm) => ctx.wallGen(dm, [p.side], { step: 0.25 }), (c, dm) => Math.abs(Math.min(...bank.map(b => Math.hypot(b.x - c.x, b.z - c.z))) - (dm.w + 0.8)) + (d && ctx.inBlast(d, c.x, c.z, dm.w / 2) ? 10 : 0), { layer: 'anchor', rule: 'seat-bank', why: 'seat bank: the next seat along the wall', failWhy: 'no more wall for seats' });
            if (!q) { ctx.unplaced.pop(); break; }
            bank.push(q);
          }
          if (bank.length > 1) ctx.growth.push(`seat bank: ${bank.length} seats along the ${SIDE_LABEL[p.side]} wall`);
          return { feature: p, what: bank.length > 1 ? `seat bank (${bank.length})` : 'seat', privacy: true, approach: front(p, 1.0) };
        }
      }
    }
    return { fail: `privy has no seat: ${(ctx.W).toFixed(1)}×${(ctx.D).toFixed(1)} ft inside is too small for any seat mesh` };
  },
  // stacked rooms: the aisles are the desire lines (recorded + reserved), so the generic door->feature walk is dropped
  storeroom(ctx) { const kp = deepStore(ctx, ['shelving-freestanding', 'cask-rack', 'wine-rack'], 'shelving'); if (!kp.fail && aisleStore(ctx, 'storeroom', kp.feature)) { kp.approach = null; kp.aisle = false; } return kp; },
  cellar(ctx) { const kp = deepStore(ctx, ['cask-rack', 'shelving-freestanding', 'wine-rack', 'tun-large'], 'casks & shelves'); if (!kp.fail && aisleStore(ctx, 'cellar', kp.feature)) { kp.approach = null; kp.aisle = false; } return kp; },
  // passages: the checkpoint beside the through-line
  desk(ctx) {
    // a one-door lobby is a dead end: the counter IS the destination, so it takes the axial spot first and the
    // through-line ends at its front; with a door beyond, the through-line is reserved first and the counter fits beside it
    const deadEnd = ctx.doors.length < 2;
    const ft0 = deadEnd ? focalPlace(ctx, ['counter-shop'], { label: 'counter', rule: 'key-desk-focal', why: 'counter centred on the wall facing the door (axial focal): the checkpoint you walk up to', flankW: 1.2, gap: 3.5 }) : null; // 3.5 ft behind: a big chair (2.7 ft) clears the counter on the 0.5-ft grid
    const line = throughLine(ctx, ft0?.p ? front(ft0.p, 1.5) : null);
    const mid = line.mid;
    const sides = ['N', 'S', 'E', 'W'].filter(s => !ctx.doors.some(d => d.side === s)).concat(['N', 'S', 'E', 'W'].filter(s => ctx.doors.some(d => d.side === s)));
    const ft = ft0 || focalPlace(ctx, ['counter-shop'], { label: 'counter', rule: 'key-desk-focal', why: 'counter centred on the wall facing the door (axial focal): the checkpoint you walk up to', flankW: 1.2, gap: 3.5 });
    const c = ft.p || ctx.put('counter-shop', (dm) => ctx.wallGen(dm, sides, { gap: 3.0 }), (cc, dm) => {
      const kx = cc.x - Math.sin(cc.rot) * (dm.d / 2 + 1.3), kz = cc.z - Math.cos(cc.rot) * (dm.d / 2 + 1.3); // the keeper's seat
      return Math.abs(Math.hypot(cc.x - mid[0], cc.z - mid[1]) - 4) + (ctx.doors.some(d => d.side === cc.side) ? 6 : 0) + (ctx.mainDoor && ctx.inBlast(ctx.mainDoor, kx, kz, 0.5) ? 8 : 0);
    }, { layer: 'anchor', rule: 'key-desk', unique: true, why: 'counter beside the through-line, facing it: the checkpoint', failWhy: 'no wall for the counter clear of the through-line' });
    if (!c) return { fail: 'front desk has no counter (the through-line leaves no wall for it)' };
    const back = (k) => [c.x - Math.sin(c.rot) * (c.dims[2] / 2 + k), c.z - Math.cos(c.rot) * (c.dims[2] / 2 + k)];
    const keeper = ctx.put('chair-plain', (dm) => [1.3, 1.5, 1.7, 1.1, 1.9].map(k => { const [x, z] = back(k); return { x, z, rot: c.rot }; }), (cc) => Math.abs(Math.hypot(cc.x - c.x, cc.z - c.z) - c.dims[2] / 2 - 1.5), { rule: 'keeper', why: "the keeper's chair: back to the wall, door in view", allowKeep: true });
    if (keeper) ctx.command("keeper's chair", keeper);
    if (ft.p) for (const end of [-1, 1]) { // candles at both ends of the counter: symmetric flankers
      const ex = c.x + Math.cos(c.rot) * end * (c.dims[0] / 2 - 0.5), ez = c.z - Math.sin(c.rot) * end * (c.dims[0] / 2 - 0.5);
      surfaceAt(ctx, ctx.has('candlestick') ? 'candlestick' : 'candle', c, ex, ez, 'candle at the end of the counter (symmetric)');
    }
    ctx.put('strongbox', (dm) => ctx.wallGen(dm, [c.side], { tRange: null }), (cc) => Math.hypot(cc.x - c.x, cc.z - c.z), { layer: 'store', rule: 'behind-desk', why: 'strongbox behind the counter', allowKeep: true });
    for (const id of ctx.pick(['ledger-counter-bell', 'ledger-accounts', 'key-simple', 'key-ring', 'coin-stack', 'candlestick'], 4)) ctx.surface(id, { on: s => s.uid === c.uid, why: 'on the counter' });
    ctx.wall('key-hook-board', { sides: [c.side], prefer: 'near', near: [c.x, c.z], layer: 'store', why: 'room keys behind the counter', allowKeep: true }) || ctx.mount('key-hook-board', { sides: [c.side], why: 'room keys behind the counter' });
    return { feature: c, what: 'counter', passage: true };
  },
  hallway(ctx) {
    const line = throughLine(ctx);
    if (!line.path.ok) return { fail: 'hallway through-line is blocked' };
    // the runner lies along the line; benches and sconces alternate sides to slow the chi
    const along = ctx.W >= ctx.D;
    ctx.rug('rug-runner', { at: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], rot: along ? Math.PI / 2 : 0, why: 'runner down the through-line' });
    const sides = along ? ['N', 'S'] : ['W', 'E'], L = Math.max(ctx.W, ctx.D);
    const n = Math.max(1, Math.round(L / 10));
    for (let i = 0; i < n; i++) {
      const side = sides[i % 2], t = L * (i + 0.5) / n;
      const alt = ctx.pick(['bench-long', 'table-side', 'chest-plain', 'coat-pegs'])[0];
      if (isHung(ctx.lib.objects[alt], alt)) ctx.mount(alt, { sides: [side], rule: 'alternate', why: 'alternating sides to slow a long run' });
      else ctx.put(alt, (dm) => ctx.wallGen(dm, [side], { tRange: [t - 3, t + 3] }), (c) => Math.abs(c.t - t), { rule: 'alternate', why: 'alternating sides to slow a long run', allowKeep: false });
      ctx.mount('torch-sconce', { sides: [sides[(i + 1) % 2]], height: 6, layer: 'light', why: 'sconce, alternating side' });
      if (L >= 20) ctx.mount(ctx.pick(['painting-landscape', 'painting-portrait', 'trophy-head', 'shield-display'])[0], { sides: [side], why: 'display wall: something to look at along the hall' });
    }
    return { feature: null, what: 'clear through-line', passage: true };
  },
  // hub: the poles of the loop
  common(ctx) {
    const doorSides = new Set(ctx.doors.map(d => d.side));
    // axial focal hearth: only when the wall facing the main door is a short wall (or the room is square), so it is
    // also the hub's far pole; a long facing wall keeps the hearth on a short wall (the swirl needs its poles at the ends)
    const md = ctx.mainDoor, oppW = md ? OPP_SIDE[md.side] : null;
    const shortOpp = oppW && !doorSides.has(oppW) && (Math.abs(ctx.W - ctx.D) < 5 || !ctx.longSides().includes(oppW));
    const ft = shortOpp ? focalPlace(ctx, ['fireplace-wall'], { label: 'hearth', rule: 'pole-hearth', why: 'hearth: centred on the wall facing the door (axial focal) and the far pole of the loop', flankW: 2.5 }) : { fallback: 'the wall facing the door is a long wall: the hearth stays a short-wall pole' };
    if (!shortOpp) ctx.focal = { label: 'hearth', ok: false, why: ft.fallback };
    const hearth = ft.p || ctx.put('fireplace-wall', (dm) => ctx.wallGen(dm, ['N', 'S', 'E', 'W']), (c, dm) => (doorSides.has(c.side) ? 8 : 0) + ((ctx.W / ctx.D > 1.3 && (c.side === 'N' || c.side === 'S')) || (ctx.D / ctx.W > 1.3 && (c.side === 'E' || c.side === 'W')) ? 6 : 0) + ctx.doors.reduce((m, d) => m + (ctx.inBlast(d, c.x, c.z, dm.w / 2 + 1) ? 14 : 0), 0) + Math.abs(c.t - ctx.sideLen(c.side) / 2) * 0.3 - 0 + ctx.doors.reduce((m, d) => m + Math.max(0, 8 - Math.hypot(c.x - d.inner[0], c.z - d.inner[1])), 0), { layer: 'anchor', rule: 'pole-hearth', unique: true, why: 'hearth: one pole of the loop, on a long wall away from doors', failWhy: 'no wall for the hearth' });
    if (!hearth) return { fail: 'common room has no hearth' };
    const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
    const sides = ['N', 'S', 'E', 'W'].filter(s => s !== hearth.side).sort((a, b) => (a === OPP[hearth.side] ? -1 : 0) - (b === OPP[hearth.side] ? -1 : 0) || (doorSides.has(a) - doorSides.has(b)));
    const bar = barRun(ctx, sides, Math.min(8, 2 + Math.floor(ctx.area() / 400))); // growth mode EXTEND: the bar gets longer
    if (bar && bar.n > 4) ctx.growth.push(`bar extended to ${bar.n} pieces`);
    const out = { feature: hearth, what: 'hearth + bar', poles: [hearth] };
    if (bar) out.poles.push(bar.placed[Math.floor(bar.placed.length / 2)]);
    else ctx.notes.push('no bar: the hub has a single pole');
    // hearth circle zone right in front of the fire (claimed before the loop so the swirl goes around it)
    const [nx, nz] = SIDES[hearth.side].n, dep = 8;
    const ideal = [hearth.x + nx * (hearth.dims[2] / 2 + dep / 2 + 0.2), hearth.z + nz * (hearth.dims[2] / 2 + dep / 2 + 0.2)];
    let clip = null;
    for (const w of [Math.max(hearth.dims[0] + 3, 9), 8, 7]) {
      const [rw, rd] = nx ? [dep, w] : [w, dep];
      const r = ctx.findRect(rw, rd, (rr) => 3 * Math.hypot((rr[0] + rr[2]) / 2 - ideal[0], (rr[1] + rr[3]) / 2 - ideal[1]), { allowKeep: true });
      if (r && Math.hypot((r[0] + r[2]) / 2 - ideal[0], (r[1] + r[3]) / 2 - ideal[1]) < 2.5) { clip = r; break; }
    }
    if (!clip) ctx.notes.push('no floor in front of the hearth for a hearth circle');
    if (clip) {
      const z = ctx.addZone('hearth', 'hearth circle', clip);
      z.items.push(hearth.uid);
      ctx.tag(z, ctx.rug(ctx.pick(['rug-hearth-halfmoon', 'rug-bearskin', 'rug-oval'])[0], { at: [hearth.x + nx * (hearth.dims[2] / 2 + 1.6), hearth.z + nz * (hearth.dims[2] / 2 + 1.6)], rot: hearth.rot, why: 'hearth rug, top edge to the fire' }));
      const focus = [hearth.x + nx * (hearth.dims[2] / 2), hearth.z + nz * (hearth.dims[2] / 2)];
      const settle = ctx.tag(z, ctx.put('settle', (dm) => ctx.rectGen(dm, clip, [hearth.rot + Math.PI]), (c) => Math.abs(Math.hypot(c.x - focus[0], c.z - focus[1]) - 4.6), { zone: 'hearth', rule: 'inward-seat', why: 'settle facing the fire' }));
      if (settle) ctx.command('hearth settle', settle, { back: false, flanks: false });
      ctx.ring(z, ['chair-plain', 'chair-upholstered'], 2, focus, 2.6, clip);
    }
    if (bar) { const mid = bar.placed[Math.floor(bar.placed.length / 2)]; ctx.primary.push(...[]); out.bar = bar; out.barkeep = ctx.sidePoint(bar.side, bar.t0 + bar.n * 2.5, 1.0); }
    return out;
  },
  // uses-room: the work triangle off the guest line
  kitchen(ctx) {
    const guest = ctx.doors.find(d => d.to && !/cellar|storeroom/.test(ctx.typesOf?.(d.to) || '')) || ctx.mainDoor;
    const service = ctx.doors.filter(d => d !== guest);
    const hearth = ctx.put('cook-hearth-spit', (dm) => ctx.wallGen(dm, ['N', 'S', 'E', 'W']), (c) => (guest ? -Math.hypot(c.x - guest.inner[0], c.z - guest.inner[1]) + (c.side === guest.side ? 10 : 0) : 0) + Math.abs(c.t - ctx.sideLen(c.side) / 2) * 0.2, { layer: 'anchor', rule: 'key-hearth', unique: true, why: 'cooking hearth: away from the guest door', failWhy: 'no wall for the cooking hearth' });
    if (!hearth) return { fail: 'kitchen has no cooking hearth' };
    const hf = front(hearth, 1.0);
    const store = service[0]?.inner || ctx.sidePoint(['N', 'S', 'E', 'W'].find(s => s !== hearth.side) || 'S', 4, 1);
    const cfg = kitchenRowCfg(ctx, hearth);
    const industrial = ctx.area() >= cfg.min.area && Math.min(ctx.W, ctx.D) >= cfg.min.side;
    const putPrep = () => ctx.put('table-kitchen-prep', (dm) => ctx.rectGen(dm, [ctx.X0 + 1.5, ctx.Z0 + 1.5, ctx.X1 - 1.5, ctx.Z1 - 1.5], [0, Math.PI / 2], 1), (c) => {
      const a = Math.hypot(c.x - hf[0], c.z - hf[1]), b = Math.hypot(c.x - store[0], c.z - store[1]);
      return Math.max(0, a - 7) + Math.max(0, 3.5 - a) * 3 + Math.max(0, b - 9) * 0.5 + (guest && ctx.inBlast(guest, c.x, c.z, 1.5) ? 10 : 0);
    }, { layer: 'anchor', rule: 'key-prep', unique: true, why: 'prep table: the work triangle between hearth and stores', failWhy: 'no floor for the prep table' });
    // wall kitchens: the triangle's prep table first. Industrial kitchens: walls, then rows, then the triangle (below)
    let prep = industrial ? null : putPrep();
    if (!industrial && !prep) return { fail: 'kitchen has no prep table' };
    // growth mode REPEAT: the cooking line repeats along the walls as the kitchen grows (never a centerpiece)
    // Harry 2026-10-01: "they should just get lots of cooking zones and baking areas": uncapped, area-driven
    const lines = Math.max(1, Math.min(10, 1 + Math.floor(Math.max(0, ctx.area() - 450) / 350))), stations = [hearth];
    for (let i = 1; i < lines; i++) {
      const h2 = ctx.put('cook-hearth-spit', (dm) => ctx.wallGen(dm, ['N', 'S', 'E', 'W'].filter(sd => !guest || sd !== guest.side)), (c, dm) => { const nb = Math.min(...stations.map(st => Math.hypot(st.x - c.x, st.z - c.z))); return (c.side === hearth.side ? 0 : 4) + Math.abs(nb - (dm.w + 3)) * 0.5; }, { layer: 'anchor', rule: 'cooking-line', why: `cooking line ${i + 1}: the line repeats along the wall`, failWhy: 'no wall for another cooking station' });
      if (!h2) { ctx.unplaced.pop(); break; }
      stations.push(h2);
    }
    if (stations.length > 1) ctx.growth.push(`cooking line ×${stations.length} along the walls`);
    // an industrial kitchen "basically devolves to aisles": parallel work rows in the middle (storeroom grammar reused).
    // The serving pass (guest line) goes down first, against a wall, so the rows flow around it.
    let rows = null;
    ctx.expectRows = industrial;
    if (industrial) {
      earlyZone(ctx, 'kitchen', 'pass'); // the guest line; shallow enough for the wall band (the staff table comes after the rows, if it fits)
      rows = aisleStore(ctx, 'kitchen', null, cfg);
      // the triangle's prep station: a separate table if one still fits near the hearth, else the nearest row table
      prep = putPrep();
      if (!prep) { ctx.unplaced = ctx.unplaced.filter(u => u.id !== 'table-kitchen-prep'); prep = ctx.placements.filter(p => p.rule === 'work-row' && /^table/.test(p.id)).sort((a, b) => Math.hypot(a.x - hf[0], a.z - hf[1]) - Math.hypot(b.x - hf[0], b.z - hf[1]))[0] || null; }
      if (!prep) return { fail: 'kitchen has no prep table or work row' };
    }
    for (const st of stations) {
      ctx.companion(st, ctx.pick(['cooking-pot', 'cauldron', 'pot-iron-small'])[0], { why: 'pot beside the cooking fire, not in front of it', maxDist: 5 });
      ctx.ceiling(ctx.pick(['kettle-hanging', 'pot-hook-chain', 'ham-hanging'])[0], { at: front(st, 0.3), layer: 'dress', why: 'hung over the cooking fire' });
    }
    ctx.companion(hearth, 'chopping-block-kitchen', { why: 'chopping block within reach of the fire', maxDist: 7 });
    for (const id of ctx.pick([...ctx.slot('tools'), ...ctx.slot('serve'), 'cutting-board', 'pan-frying', 'dough-kneading', 'onion-sliced', 'potato-peeled'], 5)) ctx.surface(id, { on: s => s.uid === prep.uid, why: 'on the prep table' });
    ctx.unplaced = ctx.unplaced.filter(u => !(u.why === 'no room on the chosen surface'));
    for (const id of ctx.pick(['pot-rack-hanging', 'utensil-rack-wall', 'knife-rack-wall'], 2)) ctx.auto(id, { why: 'hung near the hearth' });
    ctx.kitchenInfo = { lines: stations.length, rows: rows ? rows.rowsCount : 0, tables: rows ? rows.units : 0, caps: rows ? rows.endCaps : 0 };
    if (rows) ctx.growth.push(`industrial kitchen: ${rows.rowsCount} work row${rows.rowsCount > 1 ? 's' : ''} (${rows.units} stations, ${rows.endCaps} end caps)`);
    return { feature: hearth, what: 'cooking triangle', triangle: [hf, [prep.x, prep.z], store], guest, service };
  },
  stable(ctx) { return stableStalls(ctx); },
  barn(ctx) {
    const d = ctx.mainDoor;
    const lane = throughLine(ctx);
    if (!lane.path.ok) return { fail: 'barn has no clear wagon lane' };
    const w = ctx.put('wagon', (dm) => ctx.rectGen(dm, [ctx.X0 + 1, ctx.Z0 + 1, ctx.X1 - 1, ctx.Z1 - 1], [0, Math.PI / 2], 1), (c) => Math.hypot(c.x - lane.mid[0], c.z - lane.mid[1]), { layer: 'anchor', rule: 'key-wagon', why: 'wagon parked off the lane', failWhy: 'no floor for the wagon' });
    if (!w) ctx.notes.push('no wagon (hidden by the ratings filter or no floor); the clear lane is the barn\'s purpose');
    return { feature: w, what: 'wagon floor & clear lane', passage: true };
  },
};
function front(p, dist) { const [fx, fz] = [Math.sin(p.rot), Math.cos(p.rot)]; return [p.x + fx * (p.dims[2] / 2 + dist), p.z + fz * (p.dims[2] / 2 + dist)]; }
function flankBed(ctx, bed, cmd = {}) {
  const [fx, fz] = [Math.sin(bed.rot), Math.cos(bed.rot)], lx = -fz, lz = fx;
  for (const sgn of [1, -1]) {
    const t = ctx.put('table-side', function* (dm) { // beside the head of the bed, sized from the nightstand's real footprint
      for (const extra of [0.05, 0.3, 0.6]) for (const back of [0, 0.4, 0.8]) {
        const lat = bed.dims[0] / 2 + dm.w / 2 + extra, along = bed.dims[2] / 2 - dm.d / 2 - back;
        yield { x: bed.x + lx * lat * sgn - fx * along, z: bed.z + lz * lat * sgn - fz * along, rot: bed.rot };
      }
    }, () => 0, { rule: 'nightstand', why: 'nightstand: dragon & tiger flank the bed', failWhy: 'no room for a nightstand' });
    if (t) ctx.surface(ctx.pick(['candle', 'candlestick'])[0], { on: s => s.uid === t.uid, layer: 'light', why: 'bedside candle' });
  }
  ctx.command('bed', bed, cmd);
}

// growth mode PROMOTE (ROOMS.md): in a big fine room the bed leaves the wall and becomes the centerpiece island
// (Harry moved a canopy bed 23 ft into the middle of a 40x55 room): central, door in view diagonally, never the coffin line
function islandBed(ctx, ids, label) {
  const d = ctx.mainDoor, cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const core = [cx - ctx.W * 0.22, cz - ctx.D * 0.22, cx + ctx.W * 0.22, cz + ctx.D * 0.22];
  for (const id of ids) {
    if (!ctx.has(id)) continue;
    const p = ctx.put(id, function* (dm) { for (const c of ctx.rectGen(dm, core, [0, Math.PI / 2, Math.PI, -Math.PI / 2], 1)) if (!d || !ctx.inBlast(d, c.x, c.z, dm.w / 2 + 0.5)) yield c; }, (c, dm, aw, ad) => {
      let s = Math.hypot(c.x - cx, c.z - cz) * 0.6;
      if (d) {
        if (ctx.inBlast(d, c.x, c.z, dm.w / 2)) s += 40;
        const [fx, fz] = ctx.facingVec(c.rot), vx = d.inner[0] - c.x, vz = d.inner[1] - c.z, L = Math.hypot(vx, vz) || 1;
        const ang = Math.acos(Math.max(-1, Math.min(1, (vx * fx + vz * fz) / L))) * DEG; // 0 = the door straight past the foot
        s += ang < 12 ? 30 : Math.abs(ang - 40) * 0.05;                                 // coffin line vs. a diagonal view
      }
      if (!ctx.fits(c.x, c.z, aw + 5, ad + 5)) s += 15; // room all round for nightstands and to walk
      return s;
    }, { layer: 'anchor', rule: 'key-bed-island', unique: true, why: `${label}: promoted to a freestanding island at the centre of a big room`, failWhy: 'no central floor for the bed island' });
    if (p) return p;
  }
  return null;
}

// growth mode for a big guest room (ROOMS.md): a DORMITORY, a row of beds sharing the wash and stow zones
function dormitory(ctx) {
  const d = ctx.mainDoor, id = ctx.roll('dormitory beds', ['bed-single', 'bed-single', 'bed-straw-pallet']);
  const nMax = Math.min(48, Math.floor(ctx.area() / 65)), beds = [];
  // with room for middle rows, wall beds leave the band clear of the door end for the shared wash/stow zones
  const bedSku = ctx.chooseSku(ctx.has(id) ? id : 'bed-single'), bedDm = bedSku ? ctx.dims(ctx.has(id) ? id : 'bed-single', bedSku) : null;
  const chestSku = ctx.chooseSku('chest-plain'), chestD = chestSku ? ctx.dims('chest-plain', chestSku).d : 1.7;
  // barracks: big enough for middle rows -> beds on the two long walls only, rows down the middle along the long axis
  const rowsFit = bedDm && ctx.area() >= 600 && Math.min(ctx.W, ctx.D) >= 2 * (bedDm.d + chestD + 0.4) + 2 * 3 + bedDm.d + chestD;
  const wallSides = rowsFit ? ctx.wallsByDoor().filter(sd => ctx.longSides().includes(sd)) : ctx.wallsByDoor();
  for (let i = 0; i < nMax; i++) {
    const p = ctx.put(ctx.has(id) ? id : 'bed-single', (dm) => ctx.wallGen(dm, wallSides.length ? wallSides : ctx.wallsByDoor()), (c, dm) => {
      let s = 0;
      if (d) { if (ctx.inBlast(d, c.x, c.z, dm.w / 2)) s += 40; if (c.side === d.side) s += 15; }
      if (beds.length) { const nb = Math.min(...beds.map(b => Math.hypot(b.x - c.x, b.z - c.z))); s += Math.abs(nb - (dm.w + 2.5)) * 2 + (beds.some(b => b.side === c.side) ? 0 : 4); }
      else if (d) s -= Math.hypot(c.x - d.inner[0], c.z - d.inner[1]) * 0.5;
      return s;
    }, { layer: 'anchor', rule: 'dorm-bed', why: `dormitory bed ${i + 1}: head to the wall, in a row`, failWhy: 'no more wall for dormitory beds' });
    if (!p) { ctx.unplaced.pop(); break; }
    beds.push(p);
  }
  if (!beds.length) return { fail: 'dormitory has no bed (no wall clear of the door)' };
  ctx.command('bed', beds[0]);
  beds.forEach((b, i) => {
    ctx.companion(b, ctx.pick(['chest-plain', 'chest-plain', 'linen-chest'])[0], { why: 'a chest by each bed', layer: 'store', maxDist: 4.5 });
    if (i % 2 === 0) ctx.mount('coat-pegs', { sides: [b.side], why: 'pegs over the beds' });
  });
  ctx.unplaced = ctx.unplaced.filter(u => !/^(chest-plain|linen-chest|coat-pegs)$/.test(u.id));
  // the middle fills with rows of beds when there's depth: the storeroom aisle grammar (head-to-head or single rows rolled)
  const rows = rowsFit ? aisleStore(ctx, 'dorm', null, dormRowCfg(ctx, ctx.has(id) ? id : 'bed-single', bedDm.d, chestD)) : null;
  const rowBeds = rows ? rows.units : 0;
  ctx.dormInfo = { wall: beds.length, rowBeds, rows: rows ? rows.rowsCount : 0, kind: rows ? rows.rows + (rows.mixedRows ? ' + single' : '') + (rows.rowsDowngraded ? ' (rolled double, room for single)' : '') : null, aisle: rows ? rows.aisle : null, feet: rows ? rows.feet || 0 : 0 };
  ctx.growth.push(`dormitory: ${beds.length + rowBeds} beds (${beds.length} on the walls${rows ? ` + ${rowBeds} in ${rows.rowsCount} middle row${rows.rowsCount > 1 ? 's' : ''}` : ''}) sharing the wash and stow zones`);
  return { feature: beds[0], what: `dormitory (${beds.length + rowBeds} beds)`, approach: front(beds[0], 1.6), dorm: beds.length + rowBeds };
}
function stallRect(ctx, side, t, w) {
  const a = ctx.sidePoint(side, t, 0), b = ctx.sidePoint(side, t + w, 5.2);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}
function deepStore(ctx, ids, what) {
  const d = ctx.mainDoor, OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const far = d ? OPP[d.side] : ctx.longSides()[0];
  let feature = null;
  for (const id of ids) {
    if (!ctx.has(id)) continue;
    feature = ctx.put(id, (dm) => ctx.wallGen(dm, [far, ...['N', 'S', 'E', 'W'].filter(s => s !== far && (!d || s !== d.side))]), (c) => (c.side === far ? 0 : 6) + Math.abs(c.t - ctx.sideLen(c.side) / 2) * 0.2, { layer: 'anchor', rule: 'key-store', unique: true, why: `${what}: deepest wall, facing the door`, failWhy: 'no deep wall' });
    if (feature) break;
  }
  if (!feature) return { fail: `${ctx.type.label.toLowerCase()} has no ${what}` };
  return { feature, what, approach: front(feature, 1.5), aisle: true };
}
// ---------------- storerooms & cellars: aisles of shelving (Harry 2026-10-01) ----------------
// Small rooms keep storage on the walls. From ~20x20 ft the middle fills with parallel rows of shelving (library stacks /
// big-box store) with cart-width aisles, a cross aisle at the door end that every aisle starts from, extra cross aisles
// every 25-35 ft in very long rows, end caps facing the cross aisles, wall shelving on every wall but the door's, and
// lanterns over the aisles. Four choices are random per generation (Harry: "that can be random from gen to gen"), seeded
// from the room's base seed so all best-of-N candidates share them and Roll again can give a different answer:
//   rows single | double (back to back) · aisles point away from the door | run along the long axis
//   receiving area inside the door yes | no · cellar rows: casks & wine racks only | mixed with shelving
const AISLE_MIN = { area: 330, side: 17 }; // interior ft: about a 20x20-ft room
const KITCHEN_WORK = ['cutting-board', 'knife-carving', 'cleaver', 'rolling-pin', 'ladle', 'onion-sliced', 'potato-peeled', 'dough-kneading', 'bowl-wood-small',
  'serving-bowl-large', 'pot-iron-small', 'pot-lidded', 'pan-long-handle', 'pan-frying', 'cooking-pot', 'carrot', 'onion', 'potato', 'cabbage-single', 'turnip', 'egg',
  'sausage-link', 'bread-long-loaf', 'herb-bundle-fresh', 'butter-pat', 'cheese-wedge', 'colander', 'sieve-hair', 'whisk-twig', 'crock', 'salt-box', 'jar-oil', 'platter-wood'];
// industrial kitchen rows (Harry 2026-10-01): work/prep tables end to end with cooking stations as segments and end caps;
// 4-5 ft working aisles (cooks pass with hot pots; every row face is a working face); cross aisle at the door end and every
// 25-35 ft; the wall band (cooking lines + their 4-ft faces, bake corners) stays for the walls; orientation is a style roll
function kitchenRowCfg(ctx, hearth) {
  const hd = hearth ? Math.min(...ctx.aabb(hearth.dims[0], hearth.dims[2], hearth.rot)) : 3;
  const ov = ctx.chooseSku('bread-oven'), od = ov ? ctx.dims('bread-oven', ov).d : 4.5;
  return {
    min: { area: 700, side: 24 }, seedKey: 'kitchen-rows', aisle: [4, 5], receiving: false, downgrade: true, fillSlack: true, avoidBlocked: true,
    rowPool: ['table-kitchen-prep'], unitPool: ['table-kitchen-prep', 'table-kitchen-prep', 'table-kitchen-prep', 'cauldron', 'chopping-block-kitchen'],
    wallPool: null, wallBand: Math.max(hd, od) + 0.3, endBand: Math.max(hd, od) + 4.3, capIds: /* row ends have no aisle to double as the cooking lines' 4-ft working face */ ['cauldron', 'chopping-block-kitchen', 'barrel', 'flour-sack-open', 'sack'],
    rule: 'work-row', layer: 'furnish', zone: { kind: 'workrows', label: 'work rows' }, infoKey: 'kitchenRows',
    why: (i, ch) => `work row ${i + 1} (${ch.rows}): stations end to end, a working aisle on each face`, capWhy: 'cooking station capping the row',
    hang: ['ham-hanging', 'onion-string', 'ham-hanging', 'onion-string', 'kettle-hanging'], hangEvery: 3, hangMax: 70, hangWhy: 'hung to cure over the working aisle',
    failNote: 'kitchen at the edge of work-row size: no work row fit, the work stays on the walls',
    afterUnit: (rec, z) => { // load every work surface: tools and food being prepared
      if (!/^(table|chopping-block)/.test(rec.id)) return;
      const n = /^table/.test(rec.id) ? 9 : 3;
      for (const id of ctx.pick(KITCHEN_WORK, n)) { const q = ctx.surface(id, { on: x => x.uid === rec.uid, why: 'work in progress on the row' }); if (q) ctx.tag(z, q); }
      ctx.unplaced = ctx.unplaced.filter(u => u.why !== 'no room on the chosen surface');
    },
  };
}
// place one menu zone now (before a grammar claims the floor); the menu entry later skips itself if the zone exists
function earlyZone(ctx, key, kind) {
  const m = (MENUS[key] || []).find(x => x.kind === kind);
  if (!m || ctx.area() < m.minArea || (m.when && !m.when(ctx))) return null;
  let r = null;
  // early zones hug a wall (the middle is about to become rows): off-wall rects cost a lot, deep ones a little
  for (const sz of [m.size, ...(m.fallback || [])]) { r = ctx.findRect(sz[0], sz[1], (rr) => m.pref(ctx, rr) + (ctx.touchesWall(rr) ? 0 : 200) + 2 * ctx.wallDist(...rcx(rr))); if (r) break; }
  if (!r) return null;
  const z = ctx.addZone(m.kind, m.label, r);
  m.fill(ctx, z, r);
  if (!z.items.length) { ctx.zones.pop(); return null; }
  return z;
}
// dormitory rows (Harry 2026-10-01: "you never make the dorm room beds into rows down the middle when there is space")
function dormRowCfg(ctx, bedId, bedLen, chestD) {
  return {
    min: { area: 600, side: 26 }, seedKey: 'dorm-rows', aisle: [3, 4], receiving: false, downgrade: true, fillSlack: true, avoidBlocked: true, orient: 'long', endBand: 0.6,
    rowPool: [bedId], wallPool: null, wallBand: bedLen + chestD + 0.4, capIds: [],
    foot: { ids: ['chest-plain', 'chest-plain', 'linen-chest'], depth: chestD, why: 'a chest at the foot of each bed' },
    unitGap: 1.8, rule: 'dorm-row-bed', layer: 'anchor', zone: { kind: 'dorm', label: 'dormitory rows' }, infoKey: 'dormRows',
    why: (i, ch) => `dormitory row ${i + 1} (${ch.rows === 'double' ? 'head to head' : 'single'}): foot to the aisle`,
    failNote: 'dormitory too shallow for a middle row of beds: beds stay on the walls',
  };
}
const OPP_SIDE = { N: 'S', S: 'N', E: 'W', W: 'E' };
// The same row grammar serves other rooms through `cfg` (2026-10-01): industrial kitchens ("an industrial kitchen
// basically devolves to aisles": work-table rows, cooking stations as segments and end caps, 4-5 ft working aisles) and
// dormitories (bed rows head to head, a foot chest at each foot). With no cfg, storerooms and cellars are unchanged.
function aisleStore(ctx, kind, feature = null, cfg = {}) {
  const min = cfg.min || AISLE_MIN;
  if (ctx.opts?.noAisles || ctx.area() < min.area || Math.min(ctx.W, ctx.D) < min.side) return null;
  const rng = mulberry32(hash(ctx.baseSeed ?? ctx.room.seed, cfg.seedKey || 'aisle-choices'));
  const d = ctx.mainDoor;
  const [aLo, aHi] = cfg.aisle || [3.5, 4];
  const choice = {
    rows: rng() < 0.5 ? 'double' : 'single',
    orient: d && rng() < 0.5 ? 'door' : 'long',
    receiving: rng() < 0.5,
    mix: kind === 'cellar' ? (rng() < 0.5 ? 'racks' : 'mixed') : undefined,
    aisle: +(aLo + rng() * (aHi - aLo)).toFixed(1),
  };
  if (cfg.receiving === false) choice.receiving = false;
  if (cfg.orient) choice.orient = cfg.orient; // dorms: rows run along the long axis, parallel to the wall beds
  const aisle = choice.aisle;
  // axes: rows (and aisles) run along u; v is across the rows
  const u = choice.orient === 'door' ? (d.side === 'N' || d.side === 'S' ? 'z' : 'x') : (ctx.W >= ctx.D ? 'x' : 'z');
  const P = (uu, vv) => (u === 'x' ? [uu, vv] : [vv, uu]);
  const [uMin, uMax] = u === 'x' ? [ctx.X0, ctx.X1] : [ctx.Z0, ctx.Z1];
  const [vMin, vMax] = u === 'x' ? [ctx.Z0, ctx.Z1] : [ctx.X0, ctx.X1];
  const rect = (u0, u1, v0, v1) => { const [a, b] = P(u0, v0), [c, e] = P(u1, v1); return [Math.min(a, c), Math.min(b, e), Math.max(a, c), Math.max(b, e)]; };
  const keepRect = (r) => ctx.mark((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1], KEEP);
  // which end of the rows the door is on (end wall), or where along u it opens (side wall)
  const endSide = { x: { W: 'min', E: 'max' }, z: { N: 'min', S: 'max' } }[u];
  const doorEnd = d ? endSide[d.side] || null : null;
  const doorU = d ? (u === 'x' ? d.inner[0] : d.inner[1]) : null;
  // pools
  const has = (id) => ctx.has(id) && ctx.skuPool(id).length;
  const rowPool = (cfg.rowPool || (kind === 'cellar' ? (choice.mix === 'racks' ? ['cask-rack', 'wine-rack'] : ['cask-rack', 'wine-rack', 'shelving-freestanding'])
    : ['shelving-freestanding', 'shelving-freestanding', 'cheese-shelf-aging'])).filter(has);
  const wallPool = (cfg.wallPool !== undefined ? (cfg.wallPool || []) : (kind === 'cellar' ? ['cask-rack', 'wine-rack', ...(choice.mix === 'mixed' ? ['shelving-freestanding', 'smoked-meat-rack'] : [])]
    : ['shelving-freestanding', 'wine-rack', 'cheese-shelf-aging', 'smoked-meat-rack'])).filter(has);
  if (!rowPool.length) return null;
  const depthOf = (id) => { const sk = ctx.chooseSku(id); return sk ? ctx.dims(id, sk).d : 2.5; };
  // the wall band fits ordinary shelving; deeper racks simply skip wall spots they don't fit (a 20x20 room still gets a row)
  const wallBand = cfg.wallBand ?? Math.min(3.2, Math.max(2.4, depthOf(wallPool[0] || rowPool[0]) + 0.15));
  const foot = cfg.foot || null, gap = cfg.unitGap ?? 0.05;
  const unitRule = cfg.rule || 'aisle-row', unitLayer = cfg.layer || 'store';
  // the key feature (placed first, e.g. a 4-ft cask rack or a 9-ft tun) widens the band on its own wall so no aisle runs into it
  const wallOf = { vLo: u === 'x' ? 'N' : 'W', vHi: u === 'x' ? 'S' : 'E', uMin: u === 'x' ? 'W' : 'N', uMax: u === 'x' ? 'E' : 'S' };
  const featDepth = feature ? (() => { const [aw, ad] = ctx.aabb(feature.dims[0], feature.dims[2], feature.rot); return feature.side === 'N' || feature.side === 'S' ? ad : aw; })() : 0;
  const band = (w) => feature && feature.side === w ? Math.max(wallBand, featDepth + 0.15) : wallBand;
  const bandVLo = band(wallOf.vLo), bandVHi = band(wallOf.vHi);
  const RECV = 6.5;
  const capIds = (cfg.capIds || (kind === 'cellar' ? ['barrel', 'barrel', 'crate'] : ['barrel', 'crate', 'sack', 'crate'])).filter(has);
  const capFoot = (id) => { const sk = ctx.chooseSku(id); if (!sk) return 2; const dm = ctx.dims(id, sk); return Math.max(dm.w, dm.d); };
  const CAP = cfg.capIds && !capIds.length ? 0 : Math.ceil((Math.max(1.5, ...capIds.map(capFoot)) + 0.2) / RES) * RES; // the end-cap slot fits its biggest item (none when there are no caps)
  // the rows' footprint: inside the wall band + a perimeter aisle; the door end gets the cross aisle (+ receiving area)
  if (choice.receiving && doorEnd && (uMax - uMin) - (aisle + RECV + 0.3) - (wallBand + 0.3) < 10) { choice.receiving = false; choice.receivingDropped = true; }
  // things already against the door wall (kitchen: the serving pass) push the door-end cross aisle inward until it's clear
  let doorExtra = 0;
  if (cfg.avoidBlocked && doorEnd) {
    const anyBlock = (r) => { const [i0, i1, j0, j1] = ctx.cells((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1]); for (let j = Math.max(0, j0); j < Math.min(ctx.nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(ctx.nx, i1); i++) if (ctx.grid[j * ctx.nx + i] === BLOCK) return true; return false; };
    const crossAt = (ex) => { const a = doorEnd === 'min' ? uMin + ex + 0.15 : uMax - ex - aisle - 0.15; return rect(a, a + aisle, vMin + bandVLo, vMax - bandVHi); };
    while (doorExtra < 9 && anyBlock(crossAt(doorExtra))) doorExtra += RES;
  }
  const endMargin = (end) => end === doorEnd ? doorExtra + aisle + (choice.receiving ? RECV : 0) + 0.3 : (cfg.endBand ?? band(end === 'min' ? wallOf.uMin : wallOf.uMax)) + 0.3;
  const u0 = uMin + endMargin('min'), u1 = uMax - endMargin('max');
  const v0 = vMin + bandVLo + aisle, v1 = vMax - bandVHi - aisle;
  if (u1 - u0 < 6 || v1 - v0 < 2) return null;
  const info0 = {};
  // plan the rows first (ids, grid-snapped depths) so a room too narrow for one row gets no phantom aisles
  const snap = (x) => Math.ceil(x / RES - 1e-6) * RES; // whole occupancy cells: faces butt without sharing a cell
  const plan = []; let used = 0;
  for (let guard = 0; guard < 40; guard++) {
    const id = rowPool[Math.floor(rng() * rowPool.length)], dd = snap(depthOf(id) + (foot ? foot.depth + 0.6 : 0) + 0.05), depth = choice.rows === 'double' ? 2 * dd : dd;
    const need = used + (plan.length ? aisle : 0) + depth;
    if (need > v1 - v0 + 1e-6) break;
    plan.push({ id, dd, depth }); used = need;
  }
  if (!plan.length && cfg.downgrade && choice.rows === 'double') { // rolled double, only room for single: say so, use single
    choice.rows = 'single'; choice.rowsDowngraded = true;
    for (let guard = 0; guard < 40; guard++) {
      const id = rowPool[Math.floor(rng() * rowPool.length)], dd = snap(depthOf(id) + (foot ? foot.depth + 0.6 : 0) + 0.05);
      const need = used + (plan.length ? aisle : 0) + dd;
      if (need > v1 - v0 + 1e-6) break;
      plan.push({ id, dd, depth: dd }); used = need;
    }
  }
  if (plan.length && cfg.fillSlack && choice.rows === 'double') { // leftover depth for a single row: take it (mixed rows)
    for (let guard = 0; guard < 6; guard++) {
      const id = rowPool[Math.floor(rng() * rowPool.length)], dd = snap(depthOf(id) + (foot ? foot.depth + 0.6 : 0) + 0.05);
      if (used + aisle + dd > v1 - v0 + 1e-6) break;
      plan.push({ id, dd, depth: dd, single: true }); used += aisle + dd; choice.mixedRows = true;
    }
  }
  if (!plan.length) return null;
  let vStart = vMin + Math.round((v0 - vMin + (v1 - v0 - used) / 2) / RES) * RES; // centre the pattern, on the grid
  if (cfg.avoidBlocked) {
    // things placed before the grammar (kitchen: cooking lines, serving pass, staff table; dorm: wall beds) must not end up
    // under a reserved aisle: slide the pattern within its slack until every lane is clear, dropping rows if none is
    const ua0 = doorEnd === 'max' ? u1 + aisle : u0 - (doorEnd === 'min' ? aisle : 0), ub0 = doorEnd === 'max' ? u0 : u1;
    const blocked = (r) => { const [i0, i1, j0, j1] = ctx.cells((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1]); for (let j = Math.max(0, j0); j < Math.min(ctx.nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(ctx.nx, i1); i++) if (ctx.grid[j * ctx.nx + i] === BLOCK) return true; return false; };
    const lanesClear = (vs) => { let v = vs - aisle / 2; const ls = [v]; for (const q of plan) { v += aisle / 2 + q.depth + aisle / 2; ls.push(v); } return ls.every(lv => !blocked(rect(Math.min(ua0, ub0), Math.max(ua0, ub0), lv - aisle / 2 + 0.05, lv + aisle / 2 - 0.05))); };
    let found = null;
    while (plan.length && found === null) {
      const lo = vMin + Math.ceil((v0 - vMin) / RES - 1e-6) * RES, hi = v1 - used;
      const cands = []; for (let vs = lo; vs <= hi + 1e-6; vs += RES) cands.push(vs);
      cands.sort((a, b) => Math.abs(a - vStart) - Math.abs(b - vStart));
      found = cands.find(lanesClear) ?? null;
      if (found === null) { const q = plan.pop(); used -= q.depth + (plan.length ? aisle : 0); info0.droppedRows = (info0.droppedRows || 0) + 1; vStart = vMin + Math.round((v0 - vMin + (v1 - v0 - used) / 2) / RES) * RES; }
    }
    if (!plan.length) return null;
    vStart = found;
  }
  const planDbg = ctx.opts?.debugAisles ? { v0: +v0.toFixed(1), v1: +v1.toFixed(1), bandVLo, bandVHi, plan: plan.map(q => q.depth), used } : null;
  // cross aisles (centre u): the door end (or at the door, when the door is on a side wall), then every 25-35 ft
  const cross = [];
  if (doorEnd === 'min') cross.push({ at: u0 - (aisle + 0.3) / 2, door: true });
  else if (doorEnd === 'max') cross.push({ at: u1 + (aisle + 0.3) / 2, door: true });
  else if (doorU !== null) cross.push({ at: Math.min(u1 - 3, Math.max(u0 + 3, doorU)), door: true });
  const span = 25 + rng() * 10;
  if (u1 - u0 > span + 8) {
    // spaced from the door's cross aisle (end door: from that end; side door: outward both ways from the door's aisle)
    const origins = doorEnd ? [[doorEnd === 'max' ? u1 : u0, doorEnd === 'max' ? -1 : 1]] : cross.length ? [[cross[0].at, 1], [cross[0].at, -1]] : [[u0, 1]];
    for (const [from, dir] of origins) for (let k = 1; ; k++) {
      const at = from + dir * k * span; if (at < u0 + 6 || at > u1 - 6) break;
      if (cross.every(c => Math.abs(c.at - at) > 12)) cross.push({ at, door: false });
    }
  }
  // segments of u between cross aisles (inside [u0, u1])
  // cross-aisle edges snapped outward to the grid, so end caps and row units can sit flush against them
  const gLo = (x) => uMin + Math.floor((x - uMin) / RES + 1e-6) * RES, gHi = (x) => uMin + Math.ceil((x - uMin) / RES - 1e-6) * RES;
  for (const c of cross) { c.lo = gLo(c.at - aisle / 2); c.hi = gHi(c.at + aisle / 2); }
  const cuts = cross.filter(c => c.at > u0 && c.at < u1).map(c => [c.lo, c.hi]).sort((a, b) => a[0] - b[0]);
  const segs = []; let cur = u0;
  for (const [a, b] of cuts) { if (a - cur >= 3) segs.push([cur, a]); cur = b; }
  if (u1 - cur >= 3) segs.push([cur, u1]);
    // snapshot: if no row unit fits after all, undo the reservations and caps (fall back to wall storage cleanly)
  const snap0 = { grid: ctx.grid.slice(), n: ctx.placements.length, surf: ctx.surfaces.length, un: ctx.unplaced.length };
  // reserve cross aisles and the receiving area before any row unit goes down
  const laneRects = cross.map(c => rect(c.lo, c.hi, vMin + bandVLo, vMax - bandVHi));
  for (const r of laneRects) keepRect(r);
  let recv = null;
  if (choice.receiving && d) {
    if (doorEnd) { const a = doorEnd === 'min' ? uMin + 0.2 : uMax - RECV - 0.2; recv = rect(a, a + RECV, Math.max(vMin + bandVLo, (u === 'x' ? d.inner[1] : d.inner[0]) - 7), Math.min(vMax - bandVHi, (u === 'x' ? d.inner[1] : d.inner[0]) + 7)); }
    else { const dv = u === 'x' ? d.inner[1] : d.inner[0], inward = (d.side === 'N' || d.side === 'W') ? 1 : -1; const a = dv, b = dv + inward * RECV; recv = rect(doorU - 7, doorU + 7, Math.min(a, b), Math.max(a, b)); }
    keepRect(recv);
  }
  // rows across v
  const info = { ...choice, ...info0, planDbg, rowsCount: 0, units: 0, endCaps: 0, crossAisles: cross.length, axis: u === 'x' ? 'east-west' : 'north-south' };
  const z = { kind: cfg.zone?.kind || 'stacks', label: cfg.zone?.label || 'shelving aisles', rect: rect(u0, u1, v0, v1).map(x => +x.toFixed(2)), items: [] };
  ctx.zones.push(z); // not claimed: the aisles inside it are walkable
  const rowIds = [], aisles = [];
  let v = vStart, rowIdx = 0;
  for (const { id, dd, depth, single } of plan) {
    const faces = choice.rows === 'double' && !single ? [[v + dd / 2, -1], [v + dd + dd / 2, 1]] : [[v + dd / 2, rowIdx % 2 ? -1 : 1]];
    let placed = 0;
    for (const [s0, s1] of segs) {
      // end caps on the end(s) of this segment that face a cross aisle
      const capMin = cross.some(c => Math.abs(c.hi - s0) < 0.01) || (doorEnd === 'min' && s0 === u0);
      const capMax = cross.some(c => Math.abs(c.lo - s1) < 0.01) || (doorEnd === 'max' && s1 === u1);
      const a = uMin + Math.ceil((s0 + (capMin ? CAP : 0) - uMin) / RES - 1e-6) * RES, b = s1 - (capMax ? CAP : 0);
      for (const [vc, fv] of faces) {
        const rot = u === 'x' ? (fv > 0 ? 0 : Math.PI) : (fv > 0 ? Math.PI / 2 : -Math.PI / 2);
        let t = a, tries = 0;
        while (true) {
          const uid = cfg.unitPool ? cfg.unitPool[Math.floor(rng() * cfg.unitPool.length)] : id; // mixed rows (kitchen: tables + cooking stations)
          if (!has(uid)) { t += RES; if (t > b) break; continue; }
          const sk = ctx.chooseSku(uid); if (!sk) break;
          const dm = ctx.dims(uid, sk), [aw, ad] = ctx.aabb(dm.w, dm.d, rot), len = u === 'x' ? aw : ad, dep = u === 'x' ? ad : aw;
          // scale variety re-rolls each unit's size: one deeper than its row would poke into the aisle, so re-roll it
          if (dep + (foot ? foot.depth + 0.6 : 0) > dd + 0.01) { if (++tries < 4) continue; tries = 0; t += RES; if (t > b) break; continue; }
          tries = 0;
          if (t + len > b + 1e-6) { if (ctx.opts?.debugAisles) (info.dbgEnd ||= []).push([+t.toFixed(1), +len.toFixed(1), +a.toFixed(1), +b.toFixed(1), +s0.toFixed(1), +s1.toFixed(1)]); break; }
          const vu = foot ? vc + fv * (dep - dd) / 2 : vc; // with a foot item the unit sits at the back of its band (head to the row's spine)
          const [x, zz] = P(t + len / 2, vu);
          if (!ctx.fits(x, zz, aw, ad)) { info.fitFails = (info.fitFails || 0) + 1; if (ctx.opts?.debugAisles) (info.dbg ||= []).push({ id: uid, x: +x.toFixed(1), z: +zz.toFixed(1), aw: +aw.toFixed(1), ad: +ad.toFixed(1), len: +len.toFixed(1) }); }
          if (ctx.fits(x, zz, aw, ad)) {
            ctx.mark(x, zz, aw, ad);
            const rec = ctx.tag(z, ctx.record(uid, sk, dm, x, 0, zz, rot, unitLayer, unitRule, cfg.why ? cfg.why(rowIdx, choice) : `row ${rowIdx + 1} of the stacks (${choice.rows}), facing the aisle`));
            placed++; info.units++;
            if (foot && rec) { // the foot item (a bed's chest) between the unit and the aisle
              const fid = foot.ids[Math.floor(rng() * foot.ids.length)];
              const [fx, fz] = P(t + len / 2, vc + fv * (dd / 2 - foot.depth / 2 - 0.05));
              // 2026-10-02: the band is sized from one chest variant, so roll among the variants that fit it (inn-02's shallow
              // chest-plain--s4 sized it and the deeper s1-s3 no longer fit), and when the rolled item can't fit (a linen chest
              // is ~3 ft deep) fall back to the other foot items rather than leaving the bed without one
              const putFoot = (id) => has(id) ? ctx.put(id, function* () { yield { x: fx, z: fz, rot }; yield { x: fx, z: fz, rot: rot + Math.PI / 2 }; }, () => 0, { layer: 'store', rule: 'companion', why: foot.why, failWhy: 'no room at the foot', sku: { maxD: foot.depth * 1.05 }, extra: { with: rec.uid } }) : null;
              let fp = putFoot(fid);
              for (const alt of [...new Set(foot.ids)]) if (!fp && alt !== fid) fp = putFoot(alt);
              if (fp) { ctx.tag(z, fp); info.feet = (info.feet || 0) + 1; }
            }
            if (rec && cfg.afterUnit) cfg.afterUnit(rec, z);
          }
          t += snap(len + gap);
        }
      }
      // end caps: barrels / crates / sacks at the row end, facing the cross aisle
      for (const [end, on] of [['min', capMin], ['max', capMax]]) {
        if (!on) continue;
        const cu = end === 'min' ? s0 + CAP / 2 : s1 - CAP / 2, fu = end === 'min' ? -1 : 1;
        const rotCap = u === 'x' ? (fu > 0 ? Math.PI / 2 : -Math.PI / 2) : (fu > 0 ? 0 : Math.PI);
        for (const [vc] of faces) { // one cap per face: a double row gets a pair
          if (!capIds.length) break;
          const id2 = capIds[Math.floor(rng() * capIds.length)];
          const p = ctx.put(id2, function* () { yield { x: P(cu, vc)[0], z: P(cu, vc)[1], rot: rotCap }; }, () => 0, { layer: 'store', rule: 'end-cap', why: cfg.capWhy || 'end cap facing the cross aisle', failWhy: 'no room for an end cap' });
          if (p) { ctx.tag(z, p); info.endCaps++; if (cfg.afterUnit) cfg.afterUnit(p, z); }
        }
      }
    }
    if (placed) { info.rowsCount++; rowIds.push(id); }
    if (rowIdx < plan.length - 1) aisles.push(v + depth + aisle / 2);
    v = v + depth + aisle; rowIdx++;
  }
  ctx.unplaced = ctx.unplaced.filter(x => x.why !== 'no room for an end cap' && x.why !== 'no room at the foot');
  if (!info.units) { // planned rows but nothing fit (doors, stair): fall back to wall storage, no phantom aisles
    ctx.zones.splice(ctx.zones.indexOf(z), 1);
    ctx.grid.set(snap0.grid); ctx.placements.length = snap0.n; ctx.surfaces.length = snap0.surf; ctx.unplaced.length = snap0.un;
    ctx.notes.push(cfg.failNote || 'room is at the edge of aisle size: no shelving row fit, storage stays on the walls');
    return null;
  }
  // aisles (between rows, plus the two along the wall bands) are desire lines: reserve and record them
  const lanes = [vStart - aisle / 2, ...aisles, vStart + used + aisle / 2];
  const ua = doorEnd === 'max' ? u1 + aisle : u0 - (doorEnd === 'min' ? aisle : 0), ub = doorEnd === 'max' ? u0 : u1;
  for (const lv of lanes) {
    const lr = rect(Math.min(ua, ub), Math.max(ua, ub), lv - aisle / 2 + 0.05, lv + aisle / 2 - 0.05);
    laneRects.push(lr); keepRect(lr);
    const a = P(ua, lv), b = P(ub - Math.sign(ub - ua) * 0.6, lv); // the line stops just short of the far shelving it dead-ends at
    ctx.paths.push({ kind: 'aisle', pts: [a, b].map(([x, zz]) => [+x.toFixed(2), +zz.toFixed(2)]), ok: true, len: +Math.abs(ub - ua).toFixed(1) });
  }
  for (const c of cross) { const a = P(c.at, vMin + bandVLo + 0.5), b = P(c.at, vMax - bandVHi - 0.5); ctx.paths.push({ kind: 'cross-aisle', pts: [a, b].map(([x, zz]) => [+x.toFixed(2), +zz.toFixed(2)]), ok: true, len: +(vMax - vMin - bandVLo - bandVHi - 1).toFixed(1) }); }
  // cellar stair / trapdoor at the entrance end, after the rows and aisles are reserved (it can't block either)
  if (kind === 'cellar' && d) {
    const st = has('stair-straight') ? ctx.put('stair-straight', (dm) => ctx.wallGen(dm, ['N', 'S', 'E', 'W'].filter(x => x !== d.side)),
      (c) => Math.hypot(c.x - d.inner[0], c.z - d.inner[1]), { layer: 'anchor', rule: 'stair', why: 'stair up, at the entrance end', failWhy: 'no wall for the stair' }) : null;
    if (!st && has('floor-trapdoor')) ctx.put('floor-trapdoor', (dm) => ctx.rectGen(dm, [ctx.X0 + 1, ctx.Z0 + 1, ctx.X1 - 1, ctx.Z1 - 1], [0]),
      (c) => Math.hypot(c.x - d.inner[0], c.z - d.inner[1]) + (Math.hypot(c.x - d.inner[0], c.z - d.inner[1]) < 4 ? 50 : 0), { layer: 'anchor', rule: 'trapdoor', why: 'trapdoor at the entrance end' });
  }
  // wall shelving on every wall but the door's
  const wallSides = ['N', 'S', 'E', 'W'].filter(x => !d || x !== d.side);
  for (let k = 0, miss = 0; k < 60 && miss < 6; k++) {
    const id = wallPool[k % wallPool.length]; if (!id) break;
    const p = ctx.put(id, (dm) => ctx.wallGen(dm, wallSides), (c) => c.t * 0.01 + wallSides.indexOf(c.side) * 1000, { layer: 'store', rule: 'wall-shelving', why: 'wall shelving (every wall but the door\'s)', failWhy: 'wall full' });
    if (!p) miss++;
  }
  ctx.unplaced = ctx.unplaced.filter(x => x.why !== 'wall full');
  // receiving area: a few crates and sacks waiting to be shelved
  const inLane = (x, zz, aw, ad) => laneRects.some(r => x + aw / 2 > r[0] && x - aw / 2 < r[2] && zz + ad / 2 > r[1] && zz - ad / 2 < r[3])
    || (d && ctx.inBlast(d, x, zz, Math.max(aw, ad) / 2 + 0.5) && ctx.axis(d, x, zz).along < RECV + 1.5); // stock flanks a clear corridor from the door through the receiving area
  if (recv) for (const id of ctx.pick(['crate', 'crate', 'sack', 'barrel', 'potato-sack-open'], ctx.ri(3, 5))) ctx.put(id, function* (dm) { for (const c of ctx.rectGen(dm, recv, [0, 0.4, Math.PI / 2], 0.5)) { const [aw, ad] = ctx.aabb(dm.w, dm.d, c.rot); if (!inLane(c.x, c.z, aw, ad)) yield c; } }, () => ctx.r(0, 1), { layer: 'store', rule: 'receiving', why: 'receiving area: waiting to be shelved', allowKeep: true, failWhy: 'receiving area full' });
  ctx.unplaced = ctx.unplaced.filter(x => x.why !== 'receiving area full');
  // lanterns over the aisles, ~every 16 ft
  let lamps = 0;
  for (const lv of lanes) for (let t = Math.min(ua, ub) + 6; t < Math.max(ua, ub) - 2 && lamps < 16; t += 16) { ctx.ceiling('lantern-hanging', { at: P(t, lv), why: 'lantern over the aisle' }); lamps++; }
  if (cfg.hang?.length) { // things hung over the working aisles (kitchen: hams, onion strings, kettles), between the lanterns
    let n = 0;
    for (const lv of lanes) for (let t = Math.min(ua, ub) + 3; t < Math.max(ua, ub) - 2 && n < (cfg.hangMax ?? 40); t += cfg.hangEvery ?? 5) {
      if (Math.abs(((t - Math.min(ua, ub) - 6) % 16 + 16) % 16) < 1.5) continue; // leave the lantern spots
      const hid = cfg.hang[Math.floor(rng() * cfg.hang.length)];
      if (has(hid) && ctx.ceiling(hid, { at: P(t, lv + (rng() - 0.5) * 1.2), layer: 'dress', why: cfg.hangWhy || 'hung over the aisle' })) n++;
    }
    info.hung = n;
  }
  const footprint = (p) => { const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot); return aw * ad; };
  const covered = ctx.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor').reduce((a, p) => a + footprint(p), 0);
  if (!ctx.opts?.debugAisles) delete info.dbg;
  const out = { ...info, rowIds: [...new Set(rowIds)], recvArea: !!recv, coverage: +(covered / ctx.area()).toFixed(2), kind };
  ctx[cfg.infoKey || 'storeInfo'] = out;
  return out;
}

// ---------------- stables: rows of 5x10-ft stalls along a ~10-ft centre aisle (Harry 2026-10-01) ----------------
// Must: stalls 5 ft wide x 10 ft deep (a 10-ft partition every 5 ft running out from its back line, a half-height gate
// across each 5-ft front, a manger or water bucket at the back, dense hay inside); a centre aisle ~10 ft wide (horses turn),
// the horses' through-line, reserved as a path. Rolls (per generation, seeded from the room's base seed so every
// best-of-N candidate shares it): stall rows on ONE long wall or BOTH. Grows: once the room is deep enough, back-to-back
// double rows in the middle (sharing a back line of partitions laid end to end), with aisles between; rows longer than
// ~40 ft get cross aisles every ~30 ft. The end of the room away from the main door keeps a band for tack/feed/muck zones.
const STALL = { w: 5, d: 10, aisleMin: 9, aisle: 10, wall: 0.5 };
function stableStalls(ctx) {
  const d = ctx.mainDoor;
  const rng = mulberry32(hash(ctx.baseSeed ?? ctx.room.seed, 'stable-choices'));
  const choice = { walls: rng() < 0.5 ? 'one' : 'both' };
  const roll2 = rng();
  // rows run along the long axis (u); square rooms run them toward the main door so the aisle meets it
  const u = Math.abs(ctx.W - ctx.D) < 5 && d ? (d.side === 'N' || d.side === 'S' ? 'z' : 'x') : (ctx.W >= ctx.D ? 'x' : 'z');
  const P = (uu, vv) => (u === 'x' ? [uu, vv] : [vv, uu]);
  const [uMin, uMax] = u === 'x' ? [ctx.X0, ctx.X1] : [ctx.Z0, ctx.Z1];
  const [vMin, vMax] = u === 'x' ? [ctx.Z0, ctx.Z1] : [ctx.X0, ctx.X1];
  const U = uMax - uMin, V = vMax - vMin;
  const wallLo = u === 'x' ? 'N' : 'W', wallHi = u === 'x' ? 'S' : 'E';
  const rect = (u0, u1, v0, v1) => { const [a, b] = P(Math.min(u0, u1), Math.min(v0, v1)), [c, e] = P(Math.max(u0, u1), Math.max(v0, v1)); return [Math.min(a, c), Math.min(b, e), Math.max(a, c), Math.max(b, e)]; };
  const keepRect = (r) => ctx.mark((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[2] - r[0], r[3] - r[1], KEEP);
  // stall depth: 10 ft; tiny stables shrink it (pony stalls) rather than fail, and say so
  let depth = STALL.d;
  if (V < depth + STALL.aisleMin) { depth = Math.max(5, V - 6); ctx.notes.push(`only ${V.toFixed(0)} ft deep: stalls shortened to ${depth.toFixed(0)} ft (pony stalls)`); }
  // which long walls carry stalls: prefer the one without the main door
  const doorOn = d ? d.side : null;
  let walls;
  if (choice.walls === 'both' && V >= 2 * depth + STALL.aisleMin) walls = [wallLo, wallHi];
  else { if (choice.walls === 'both') choice.bothDropped = true; walls = [doorOn === wallLo ? wallHi : doorOn === wallHi ? wallLo : (roll2 < 0.5 ? wallLo : wallHi)]; }
  // middle back-to-back double rows while there is depth for them (super-jumbo stables)
  const dbl = 2 * depth + STALL.wall;
  let middle = 0;
  while (walls.length * depth + (middle + 1) * dbl + (walls.length + middle + (walls.length === 1 ? 1 : 0)) * STALL.aisle <= V + 1e-6) middle++;
  const nAisles = walls.length === 2 ? middle + 1 : middle + 1; // one between every pair of row blocks (+ the open side for one-wall)
  const rowDepth = walls.length * depth + middle * dbl;
  // aisles share the spare width; with stalls on one wall only, anything past ~13 ft stays an open band by the bare wall
  const aisle = walls.length === 2 ? (V - rowDepth) / nAisles : Math.min(13, (V - rowDepth) / nAisles);
  if (aisle < 5.5) return { fail: 'stable too narrow for a stall row and an aisle' };
  // v layout: blocks in order from vLo
  const blocks = []; let v = vMin;
  if (walls.includes(wallLo)) { blocks.push({ kind: 'wall', back: vMin, dir: 1, side: wallLo }); v = vMin + depth; }
  const aisles = [];
  // a middle row's shared back line sits in exactly one 6-in grid cell, so stall partitions can butt against it
  const onCell = (x) => vMin + Math.round((x - vMin - 0.25) / RES) * RES + 0.25;
  for (let k = 0; k < middle; k++) {
    const back = onCell(v + aisle + depth + STALL.wall / 2); // aisles are measured from the snapped back line
    aisles.push([v, back - depth - STALL.wall / 2]); blocks.push({ kind: 'double', back }); v = back + depth + STALL.wall / 2;
  }
  if (walls.includes(wallHi)) { aisles.push([walls.length === 1 && !middle ? vMax - depth - aisle : v, vMax - depth]); blocks.push({ kind: 'wall', back: vMax, dir: -1, side: wallHi }); }
  else aisles.push([v, Math.min(vMax, v + aisle)]);
  // u extent: an end band (tack / feed / muck zones) at the end away from the main door, both ends in long stables
  const doorEnd = d ? ({ x: { W: 'min', E: 'max' }, z: { N: 'min', S: 'max' } }[u][d.side] || null) : null;
  const band = U >= 28 ? 6 : 0;
  // one end band, away from the main door (a long-wall door: the max end); both ends only in long stables
  const bandHi = band && (doorEnd !== 'max' || U >= 50) ? band : 0, bandLo = band && (doorEnd === 'max' || U >= 50) ? band : 0;
  // aisles are reserved first (the horses' through-line), full length
  const aisleRects = aisles.map(([a, b]) => rect(uMin, uMax, a + 0.05, b - 0.05));
  for (const r of aisleRects) keepRect(r);
  // cross aisles through the middle rows every ~30 ft once rows run past ~40 ft
  const mu0 = uMin + STALL.aisle, mu1 = uMax - STALL.aisle;
  const cross = [];
  if (middle && mu1 - mu0 > 40) { const n = Math.round((mu1 - mu0) / 30); for (let k = 1; k < n; k++) cross.push(mu0 + (mu1 - mu0) * k / n); }
  for (const c of cross) for (const blk of blocks.filter(b => b.kind === 'double')) keepRect(rect(c - STALL.aisle / 2, c + STALL.aisle / 2, blk.back - depth - STALL.wall / 2, blk.back + depth + STALL.wall / 2));
  if (middle) for (const blk of blocks.filter(b => b.kind === 'double')) for (const [a, b] of [[uMin, mu0], [mu1, uMax]]) keepRect(rect(a, b, blk.back - depth - STALL.wall / 2, blk.back + depth + STALL.wall / 2));
  const info = { walls: walls.length === 2 ? 'both' : 'one', bothDropped: !!choice.bothDropped, middleRows: middle, stalls: 0, gates: 0, mangers: 0, buckets: 0, hayStalls: 0, aisle: +aisle.toFixed(1), aisles: aisles.length, crossAisles: cross.length, depth, axis: u === 'x' ? 'east-west' : 'north-south' };
  const zone = { kind: 'stalls', label: 'stall rows', rect: rect(uMin, uMax, vMin, vMax).map(x => +x.toFixed(2)), items: [] };
  ctx.zones.push(zone); // not claimed: the aisles inside are walkable
  const kitDm = (id, w, dd, h) => { const sk = ctx.chooseSku(id); if (!sk) return null; const dm = ctx.dims(id, sk); const sx = w / dm.w, sz = dd / dm.d, sy = h / dm.h; return { sk, dm: { ...dm, w, d: dd, h, s: dm.s ? [dm.s[0] * sx, dm.s[1] * sy, dm.s[2] * sz] : dm.s } }; };
  const along = u === 'x' ? 0 : Math.PI / 2; // rot whose local X runs along u
  const across = u === 'x' ? Math.PI / 2 : 0; // rot whose local X runs along v
  const facing = (fv) => (u === 'x' ? (fv > 0 ? 0 : Math.PI) : (fv > 0 ? Math.PI / 2 : -Math.PI / 2)); // front (+Z) toward +v / -v
  const placeKit = (id, w, dd, h, x, z, rot, why, extra = {}) => {
    const k = kitDm(id, w, dd, h); if (!k) return null;
    const [aw, ad] = ctx.aabb(w, dd, rot);
    if (!ctx.fits(x, z, aw, ad, true)) return null;
    ctx.mark(x, z, aw, ad);
    return ctx.tag(zone, ctx.record(id, k.sk, k.dm, x, 0, z, rot, 'anchor', 'stall', why, extra));
  };
  const partId = ctx.has('stable-stall-partition') && ctx.skuPool('stable-stall-partition').length ? 'stable-stall-partition' : 'stable-stall';
  const gateId = ['stable-stall-gate', 'stable-stall-door'].find(i => ctx.has(i) && ctx.skuPool(i).length);
  const hayIds = ['rug-hay-scatter'].filter(i => ctx.has(i));
  const stallFree = (u0, v0, v1) => ctx.rectFree(rect(u0 + 0.3, u0 + STALL.w - 0.3, Math.min(v0, v1) + 0.3, Math.max(v0, v1) - 0.3), false);
  // one row of stalls: back line at vb, stalls extend toward fv; uA..uB is the row's span
  const stallRow = (vb, fv, uA, uB, rowLabel, side = null) => {
    const v0 = vb + fv * (side ? 0 : STALL.wall / 2), v1 = v0 + fv * depth;
    const slots = [];
    for (let s0 = uA; s0 + STALL.w <= uB + 1e-6; s0 += STALL.w) {
      if (cross.some(c => s0 < c + STALL.aisle / 2 && s0 + STALL.w > c - STALL.aisle / 2)) continue;
      if (!stallFree(s0, v0, v1)) continue;
      slots.push(s0);
    }
    if (!slots.length) return 0;
    const runs = []; for (const s0 of slots) { const last = runs.at(-1); if (last && Math.abs(last.at(-1) + STALL.w - s0) < 1e-6) last.push(s0); else runs.push([s0]); }
    let made = 0;
    for (const run of runs) {
      // partitions at every boundary of the run (n + 1), 10 ft out from the back line. Each sits in one whole 6-in grid
      // cell (centred +0.25 into the stall; the closing one -0.25 inside the run), so the gate between gets a clean
      // 4.5-ft opening instead of colliding with a partition straddling a cell line.
      const pw = Math.min(depth, STALL.d);
      const parts = [...run.map(s0 => s0 + 0.25), run.at(-1) + STALL.w - 0.25];
      for (const pu of parts) { const [x, z] = P(pu, (v0 + v1) / 2); placeKit(partId, pw, 0.5, 5, x, z, across, `${rowLabel}: stall partition, ${pw} ft out from the back line`); }
      for (const [k, s0] of run.entries()) {
        const gu0 = parts[k] + 0.25, gu1 = parts[k + 1] - 0.25, cu = (gu0 + gu1) / 2;
        // the gate across the stall front, between the partitions
        if (gateId) { const [x, z] = P(cu, v1 - fv * 0.25); if (placeKit(gateId, gu1 - gu0 - 0.02, 0.33, 4.5, x, z, facing(fv), `${rowLabel}: stall gate across the 5-ft front`)) info.gates++; }
        // manger at the back (or a water bucket on the floor in the back corner)
        const mk = ctx.chooseSku('rural-manger-wall');
        if (mk && rng() < 0.75) {
          const dm = ctx.dims('rural-manger-wall', mk), k = Math.min(1, (STALL.w - 0.8) / dm.w);
          const dm2 = { ...dm, w: dm.w * k, d: dm.d * k, h: dm.h * k, s: dm.s ? dm.s.map(q => q * k) : dm.s };
          const [x, z] = P(cu, v0 + fv * (dm2.d / 2 + 0.05));
          ctx.tag(zone, ctx.record('rural-manger-wall', mk, dm2, x, 1.6, z, facing(fv), 'anchor', 'stall-manger', `${rowLabel}: manger on the stall's back wall`)); info.mangers++;
        } else {
          const p = ctx.put('rural-water-bucket-stable', function* () { for (const du of [-1.3, 1.3]) { const [x, z] = P(cu + du, v0 + fv * 0.8); yield { x, z, rot: facing(fv) }; } }, () => 0, { layer: 'store', rule: 'stall-bucket', why: `${rowLabel}: water bucket in the back of the stall`, failWhy: 'no room for a stall bucket' });
          if (p) { ctx.tag(zone, p); info.buckets++; }
        }
        // a loose bale or pile in some stalls, then dense hay scatters over the stall floor (decals: they may overlap)
        if (rng() < 0.4) {
          const id = rng() < 0.5 ? 'hay-bale' : 'hay-pile';
          const r = rect(s0 + 0.35, s0 + STALL.w - 0.35, v0 + fv * 0.4, v0 + fv * (depth * 0.55));
          const p = ctx.put(id, (dm) => ctx.rectGen(dm, r, [0, Math.PI / 2, 0.4], 0.5), () => ctx.r(0, 1), { layer: 'store', rule: 'stall-hay', why: `${rowLabel}: hay in the stall`, failWhy: 'no room for hay in the stall' });
          if (p) ctx.tag(zone, p);
        }
        const nh = 2 + Math.floor(rng() * 2);
        let laid = 0;
        for (let q = 0; q < nh && hayIds.length; q++) {
          const sk = ctx.chooseSku(hayIds[0]); if (!sk) break;
          const dm = ctx.dims(hayIds[0], sk), k = (0.55 + rng() * 0.25) * Math.min(1, (STALL.w - 0.6) / Math.min(dm.w, dm.d));
          const dm2 = { ...dm, w: dm.w * k, d: dm.d * k };
          const rot = rng() * Math.PI * 2, [aw, ad] = ctx.aabb(dm2.w, dm2.d, rot);
          const fu = s0 + 0.3 + aw / 2 + rng() * Math.max(0, STALL.w - 0.6 - aw), fvv = v0 + fv * (0.3 + ad / 2 + rng() * Math.max(0, depth - 0.6 - ad));
          const [x, z] = P(fu, fvv);
          ctx.tag(zone, ctx.record(hayIds[0], sk, dm2, x, 0.035 + 0.006 * q, z, rot, 'floor-dress', 'stall-hay', `${rowLabel}: hay strewn in the stall`, { orient: 'floor' })); laid++;
        }
        if (laid) info.hayStalls++;
        // the stall interior belongs to the horse: no zones, no edge dressing
        const ir = rect(gu0 + 0.01, gu1 - 0.01, v0, v1 - fv * 0.5);
        ctx.claimRect(ir); ctx.mark((ir[0] + ir[2]) / 2, (ir[1] + ir[3]) / 2, ir[2] - ir[0], ir[3] - ir[1]);
        info.stalls++; made++;
      }
    }
    // tack never hangs on a wall that stalls back onto
    if (side) ctx.mounts[side].push([run0(runs) - uMin, runEnd(runs) - uMin]);
    return made;
  };
  const run0 = (runs) => runs[0][0], runEnd = (runs) => runs.at(-1).at(-1) + STALL.w;
  let rowNo = 0;
  for (const blk of blocks) {
    if (blk.kind === 'wall') { rowNo++; stallRow(blk.back, blk.dir, uMin + bandLo, uMax - bandHi, `row ${rowNo} (${SIDE_LABEL[blk.side]} wall)`, blk.side); }
    else {
      // shared back line: partitions laid end to end along u, stalls on both sides
      const bu0 = uMin + STALL.aisle, bu1 = uMax - STALL.aisle;
      const segs = []; let cur = bu0;
      for (const c of cross) { segs.push([cur, c - STALL.aisle / 2]); cur = c + STALL.aisle / 2; }
      segs.push([cur, bu1]);
      rowNo++;
      for (const [a, b] of segs) {
        const n = Math.floor((b - a) / STALL.w); if (n < 1) continue;
        const a2 = uMin + Math.round((a + ((b - a) - n * STALL.w) / 2 - uMin) / RES) * RES, b2 = a2 + n * STALL.w; // grid-aligned (see stallRow)
        for (let t = a2; t < b2 - 1e-6; t += STALL.d) { const w = Math.min(STALL.d, b2 - t); const [x, z] = P(t + w / 2, blk.back); placeKit(partId, w, 0.5, 5, x, z, along, `middle row ${rowNo}: shared back wall of the double row`); }
        stallRow(blk.back, -1, a2, b2, `middle row ${rowNo}, side A`);
        stallRow(blk.back, 1, a2, b2, `middle row ${rowNo}, side B`);
      }
    }
  }
  if (!info.stalls) return { fail: 'stable has no stalls (no row fits)' };
  ctx.unplaced = ctx.unplaced.filter(x => !/stall bucket|hay in the stall/.test(x.why));
  // aisles are the horses' through-line: record them; the main door walks onto the nearest aisle
  for (const [a, b] of aisles) { const vc = (a + b) / 2, p0 = P(uMin + 1, vc), p1 = P(uMax - 1, vc); ctx.paths.push({ kind: 'aisle', pts: [p0, p1].map(([x, zz]) => [+x.toFixed(2), +zz.toFixed(2)]), ok: true, len: +(U - 2).toFixed(1), width: +(b - a).toFixed(1) }); }
  for (const c of cross) { const p0 = P(c, vMin + 0.5), p1 = P(c, vMax - 0.5); ctx.paths.push({ kind: 'cross-aisle', pts: [p0, p1].map(([x, zz]) => [+x.toFixed(2), +zz.toFixed(2)]), ok: true, len: +(V - 1).toFixed(1) }); }
  if (d) {
    const dv = u === 'x' ? d.inner[1] : d.inner[0], du = u === 'x' ? d.inner[0] : d.inner[1];
    const main = aisles.map(([a, b]) => (a + b) / 2).sort((p, q) => Math.abs(p - dv) - Math.abs(q - dv))[0];
    const far = Math.abs(du - uMin) > Math.abs(du - uMax) ? uMin + 2 : uMax - 2;
    ctx.walk('lane', [d.inner, P(Math.min(uMax - 2, Math.max(uMin + 2, du)), main), P(far, main)], { width: 3 });
  }
  // lanterns over the aisles, ~every 15 ft
  let lamps = 0;
  for (const [a, b] of aisles) for (let t = uMin + 6; t < uMax - 3 && lamps < 16; t += 15) { ctx.ceiling(ctx.has('rural-lantern-barn') && ctx.lib.objects['rural-lantern-barn'].place === 'ceiling' ? 'rural-lantern-barn' : 'lantern-hanging', { at: P(t, (a + b) / 2), why: 'lantern over the aisle' }); lamps++; }
  const foot = (p) => { const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot); return aw * ad; };
  const covered = ctx.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor').reduce((a2, p) => a2 + foot(p), 0) + info.stalls * STALL.w * depth * 0.9;
  info.coverage = +(Math.min(1, covered / ctx.area())).toFixed(2);
  // stalls on ONE long wall: the open band along the bare wall reads empty, so it becomes the tack & feed wall
  // (Harry 2026-10-01). Clusters walk along the wall; the reserved aisle stays clear (wall() refuses keep cells).
  if (info.walls === 'one') {
    const bare = walls[0] === wallLo ? wallHi : wallLo, L = ctx.sideLen(bare);
    const groups = [
      ['tack-wall', 'saddle-rack', 'horse-blanket-rail', 'rural-saddle-riding', '+bridle-hanging', '+rural-horse-brasses', '+horse-collar'],
      ['grain-bin-stable', 'rural-oat-sack', 'rural-oat-sack', 'hay-bale', 'hay-bale'],
      ['farrier-stand', 'rural-water-bucket-stable', 'bucket', '+bridle-hanging'],
    ];
    let n = 0, gi = Math.floor(rng() * groups.length);
    for (let t = 2.5, guard = 0; t < L - 2 && guard < 40; guard++) {
      const g = groups[gi++ % groups.length];
      let placedHere = 0, far = t;
      for (const raw of g) {
        const mountIt = raw.startsWith('+'), id = mountIt ? raw.slice(1) : raw;
        if (!ctx.has(id)) continue;
        const why = `${mountIt ? 'hung on' : 'along'} the bare ${SIDE_LABEL[bare]} wall (stalls on the other wall): ${g === groups[0] ? 'tack' : g === groups[1] ? 'feed store' : 'grooming station'}`;
        const p = mountIt ? ctx.mount(id, { sides: [bare], why }) : ctx.wall(id, { sides: [bare], prefer: 'near', near: ctx.sidePoint(bare, far + 1, 1), maxDist: 5, layer: 'store', rule: 'bare-wall', why, jitter: /sack|bale|bucket/.test(id) ? 0.25 : 0 });
        if (p) { placedHere++; n++; if (!mountIt) { const tt = bare === 'N' || bare === 'S' ? p.x - ctx.X0 : p.z - ctx.Z0; far = Math.max(far, tt + 1); } }
      }
      t = placedHere ? far + 1.5 : t + 3;
    }
    ctx.unplaced = ctx.unplaced.filter(x => !/^(no bare wall|corner already full)/.test(x.why) && !(x.why || '').startsWith('no wall space'));
    info.bareSide = bare; info.bareItems = n;
  }
  ctx.stableInfo = info;
  const gates = ctx.placements.filter(p => p.rule === 'stall' && p.id === gateId);
  // the feature is the nearest stall front you can actually see from the door (one camera angle: a row of gates in view)
  const byDist = d ? gates.sort((p, q) => Math.hypot(p.x - d.inner[0], p.z - d.inner[1]) - Math.hypot(q.x - d.inner[0], q.z - d.inner[1])) : gates;
  const feature = (d && byDist.find(g => ctx.losClear(d.inner, [g.x, g.z], new Set([g.uid])).ok)) || byDist[0];
  return { feature: feature || null, what: `${info.stalls} stall(s) in ${blocks.length + middle} row(s)` };
}
const SIDE_LABEL = { N: 'north', S: 'south', E: 'east', W: 'west' };

// passage through-line: between the two doors farthest apart; with one door, to the far wall (a dead-end lobby)
function throughLine(ctx, end = null) {
  let a, b;
  if (ctx.doors.length >= 2) {
    let best = -1;
    for (const x of ctx.doors) for (const y of ctx.doors) { const dd = Math.hypot(x.inner[0] - y.inner[0], x.inner[1] - y.inner[1]); if (dd > best) { best = dd; a = x.inner; b = y.inner; } }
  } else {
    const d = ctx.mainDoor || { side: 'S', tc: ctx.sideLen('S') / 2 };
    const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
    a = d.inner || ctx.sidePoint(d.side, d.tc, 1.4); b = end || ctx.sidePoint(OPP[d.side], d.tc, 2.0);
    ctx.notes.push(end ? 'passage with one door: the through-line runs to the counter (a dead-end lobby)' : 'passage with one door: the through-line runs to the far wall (a dead-end lobby)');
  }
  const path = ctx.walk('through', [a, b]);
  return { path, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], a, b };
}

// ---------------- outdoors: the yard (Harry 2026-10-05) ----------------
// A room with NO walls: its own ground, open edges, neighbours' doors opening onto it. Sparse on purpose (YARD.density,
// far under any indoor room). Things gather where they would in a real yard: against the BUILDING wall, beside each
// door (by what that door leads to: the common room hangs its sign, the kitchen keeps its rain barrel and crates, the
// stable its trough and hay), along the path from door to gate (the path itself stays clear), and around ONE focal
// thing in the open (a well; a big tree once trees exist). The middle stays open. Plants are a recipe slot (`plants`)
// that is empty until bush / tree meshes exist and fills by itself when they do.
export const YARD = { density: 2, taper: 600, focalMin: 14, focalArea: 300, path: 4, plants: [2, 4] };
// a yard's things gather along its walls and edges, which grow with its perimeter, not its area: past ~600 sq ft the
// target thins with the square root, so a big yard is emptier per square foot, never busier (the middle stays open)
export const yardTarget = (area) => +(YARD.density * Math.min(1, Math.sqrt(YARD.taper / area))).toFixed(2);
// the hanging sign is a board on a wall bracket; the notices are paper. (price-board's mesh is an easel 1.7 ft deep, not a
// board flat to the wall: hung on a wall it floats, Gemini 2026-10-05. It stays indoors.)
const YARD_SIGNS = ['sign-hanging'], YARD_BOARDS = ['bounty-poster', 'proclamation-scroll'];
const YARD_LIGHTS = { common: ['lantern-wall-iron', 'lantern-wall-brass', 'lantern-wall-horn'], desk: ['lantern-wall-brass', 'lantern-wall-iron'], hallway: ['lantern-wall-horn', 'lantern-wall-iron'],
  kitchen: ['lamp-wall-bracket', 'lantern-pierced-tin', 'lantern-wall-horn'], stable: ['rural-lantern-barn', 'torch-bracket-rough'], barn: ['rural-lantern-barn', 'torch-bracket-rough'], any: ['lantern-pierced-tin', 'torch-bracket-rough', 'rural-lantern-barn'] };
// edge kits: [straight 5-ft section, the piece that ends or turns a run, the gate]. A kind is offered once all three have a mesh.
export const YARD_EDGES = { 'post-and-rail fence': ['fence-post-rail', 'fence-post-corner', 'gate-fence'], 'picket fence': ['fence-picket', 'fence-post-corner', 'gate-fence'], 'wattle fence': ['fence-wattle', 'fence-post-corner', 'gate-fence'],
  hedge: ['hedge-straight', 'hedge-end-block', 'hedge-gap-arch'], 'stone wall': ['wall-drystone', 'wall-drystone-pier', 'wall-drystone-gate'] };
const YARD_BENCH = ['bench-village', 'bench-street', 'bench-long'], YARD_SEAT = ['bench-long', 'bench-village']; // out in the open, by the focal thing, the plain long bench reads best
function yard(ctx) {
  const A = ctx.area(), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, ALL = ['N', 'S', 'E', 'W'];
  const want = Math.max(3, Math.round((ctx.densityTarget = yardTarget(A)) * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length, room = () => count() < want; // the fence is the yard's edge, not one of its things
  const quiet = (fn) => { const u = ctx.unplaced.length, r = fn(); ctx.unplaced.length = u; return r; }; // a yard's wishes are optional
  const first = (ids) => ids.find(i => i && ctx.has(i) && ctx.skuPool(i).length) || null;  // in order of preference
  const any = (ids) => ctx.pick(ids.filter(i => i && ctx.has(i)))[0] || null;                // variety
  const zone = (kind, label, items) => { items = items.filter(Boolean); if (!items.length) return null; let r = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of items) { const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot); r = [Math.min(r[0], p.x - aw / 2), Math.min(r[1], p.z - ad / 2), Math.max(r[2], p.x + aw / 2), Math.max(r[3], p.z + ad / 2)]; p.zone = kind; }
    const z = { kind, label, rect: r.map(v => +v.toFixed(2)), items: items.map(p => p.uid) }; ctx.zones.push(z); return z; };

  // --- surroundings: which stretches of each side are a building's wall (the rest is open), who lives behind each door
  const wallT = { N: [], S: [], E: [], W: [] }, openT = {};
  for (const o of ctx.openings) { if (!o.to || !/^(wall|window|door)$/.test(o.kind)) continue; wallT[o.side].push([Math.max(0, o.index * CELL - INSET), Math.min(ctx.sideLen(o.side), (o.index + 1) * CELL - INSET)]); }
  for (const s of ALL) {
    const m = []; for (const r of wallT[s].sort((a, b) => a[0] - b[0])) { if (m.length && r[0] <= m.at(-1)[1] + 1e-6) m.at(-1)[1] = Math.max(m.at(-1)[1], r[1]); else m.push([...r]); }
    wallT[s] = m; openT[s] = []; let t = 0; for (const [a, b] of m) { if (a > t + 1e-6) openT[s].push([t, a]); t = b; } if (t < ctx.sideLen(s) - 1e-6) openT[s].push([t, ctx.sideLen(s)]);
    ctx.mounts[s].push(...openT[s].map(r => [...r])); // nothing hangs in mid-air: open stretches take no wall things
  }
  ctx.wallT = wallT;
  const backSides = ALL.filter(s => wallT[s].length), wallFt = ALL.reduce((a, s) => a + wallT[s].reduce((b, [t0, t1]) => b + t1 - t0, 0), 0);
  const inR = (rs, a, b) => rs.some(([t0, t1]) => a >= t0 - 1e-6 && b <= t1 + 1e-6);
  const alongOf = (dm, side) => { const [aw, ad] = ctx.aabb(dm.w, dm.d, SIDES[side].rot); return side === 'N' || side === 'S' ? aw : ad; };
  const typeOf = (d) => ctx.typesOf?.(d.to) || 'any';
  const doors = [...ctx.doors].sort((a, b) => (YARD_DOOR_RANK[roleOf(typeOf(a))] ?? 5) - (YARD_DOOR_RANK[roleOf(typeOf(b))] ?? 5) || b.width - a.width || a.tc - b.tc);
  ctx.mainDoor = doors[0] || null;
  const kinds = new Set([...new Set(ctx.openings.filter(o => o.to).map(o => o.to))].map(id => ctx.typesOf?.(id)));
  const inn = ['common', 'desk', 'hallway'].some(k => kinds.has(k)), horses = kinds.has('stable') || kinds.has('barn'), cook = kinds.has('kitchen');
  const front = doors.some(d => /entrance from outside/.test(d.why || '') && ['common', 'desk'].includes(typeOf(d)));
  const vibe = [inn ? (front ? 'inn forecourt' : 'inn yard') : null, horses ? 'stable yard' : null, cook ? 'kitchen garden' : null].filter(Boolean).join(' + ') || (kinds.size ? 'back yard' : 'open yard');
  const info = ctx.yardInfo = { vibe, edge: 'none', wallFt: +wallFt.toFixed(0), want, focal: null, gate: null, doors: [], signs: 0, plants: { slot: ctx.slot('plants'), waiting: (ctx.type.missing || []).filter(i => /^(tree-|bush|shrub|flowerbed|flowers-|planter-|grass-|fern)/.test(i)), placed: 0 }, wear: 0 };

  // candidates against a building wall (back to the wall, facing the yard) / along an open edge (facing in)
  const backGen = function* (dm, { sides = backSides, gap = 0.25, step = 0.5 } = {}) { for (const c of ctx.wallGen(dm, sides, { gap, step })) { const al = alongOf(dm, c.side); if (inR(wallT[c.side], c.t - al / 2, c.t + al / 2)) yield c; } };
  let edgeIn = 0; // how far a thick hedge or stone wall on the open edge reaches into the yard: things at the edge stand inside it
  const edgeGen = function* (dm, { gap = 0.35, step = 0.5, clearGate = 4 } = {}) { for (const c of ctx.wallGen(dm, ALL, { gap: gap + edgeIn, step, windows: false })) { const al = alongOf(dm, c.side); if (!inR(openT[c.side], c.t - al / 2, c.t + al / 2)) continue; if (gate && c.side === gate.side && Math.abs(c.t - gate.tc) < al / 2 + clearGate) continue; yield c; } };
  const hang = (id, side, tWant, { bottom = 6, layer = 'dress', rule = 'yard-sign', why = '', reach = 12 } = {}) => {
    if (!id || !ctx.has(id)) return null; const sku = ctx.chooseSku(id); if (!sku) return null;
    let dm = ctx.dims(id, sku); const flat = sku.kind === 'flat';
    if (flat && dm.h < 0.2 && dm.d > 0.2) dm = { ...dm, h: dm.d, d: 0.05 }; // paper on a wall: some catalog lines give its height as depth
    const w = dm.w, d = flat ? 0.05 : dm.d, mt = ctx.lib.objects[id].mount;
    for (let k = 0; k <= reach * 2; k++) for (const sg of k ? [1, -1] : [1]) {
      const t = tWant + sg * k * 0.5;
      // on plain wall: clear of the door's jamb posts (about 8 in each side of the opening) and of windows
      if (!inR(wallT[side], t - w / 2 - 0.2, t + w / 2 + 0.2) || ctx.overlapsT(ctx.doorT[side], t - w / 2 - 0.85, t + w / 2 + 0.85) || ctx.overlapsT(ctx.windowT[side], t - w / 2 - 0.2, t + w / 2 + 0.2)) continue;
      if (ctx.mounts[side].some(([a, b]) => t - w / 2 < b + 0.3 && a - 0.3 < t + w / 2)) continue;
      ctx.mounts[side].push([t - w / 2, t + w / 2]);
      const [x, z] = ctx.sidePoint(side, t, d / 2 + (flat ? 0.1 : 0.02)); // paper stands a little proud of the wall's timbers
      return ctx.record(id, sku, dm, x, Math.max(2.5, Math.min(mt != null ? mt / 12 : bottom, CEIL - 0.2 - dm.h)), z, SIDES[side].rot, layer, rule, why, { side, orient: flat ? 'wall' : undefined });
    }
    return null;
  };
  const atWall = (id, near, { why, rule = 'yard-wall', layer = 'store', maxDist = 99, sides = backSides, gap = 0.25, minDoor = 0 } = {}) => !id || !backSides.length ? null : quiet(() => ctx.put(id, function* (dm) { for (const c of backGen(dm, { sides, gap })) { const dd = near ? Math.hypot(c.x - near[0], c.z - near[1]) : 0; if (dd <= maxDist && dd >= minDoor) yield c; } },
    (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 20, { layer, rule, why, failWhy: 'no room at the building wall' }));
  const nearPt = (id, pt, { why, rule = 'yard-near', layer = 'furnish', r0 = 0, r1 = 5, rots = null, face = null } = {}) => !id ? null : quiet(() => ctx.put(id, function* (dm) {
    for (let x = pt[0] - r1; x <= pt[0] + r1 + 1e-6; x += 0.5) for (let z = pt[1] - r1; z <= pt[1] + r1 + 1e-6; z += 0.5) { const dd = Math.hypot(x - pt[0], z - pt[1]); if (dd < r0 || dd > r1) continue; for (const rot of rots || [face ? Math.atan2(pt[0] - x, pt[1] - z) : 0]) yield { x, z, rot, rect: [ctx.X0 + 0.3, ctx.Z0 + 0.3, ctx.X1 - 0.3, ctx.Z1 - 0.3] }; } },
    (c) => Math.abs(Math.hypot(c.x - pt[0], c.z - pt[1]) - (r0 + r1) / 2), { layer, rule, why, failWhy: 'no room' }));

  // --- the gate and the paths: laid first and kept clear (door -> gate; with no gate, door -> the middle)
  const g = ctx.openings.find(o => o.kind === 'gate');
  const gtc = g ? g.index * CELL - INSET + CELL / 2 : 0;
  const gate = g ? { side: g.side, tc: gtc, at: ctx.sidePoint(g.side, gtc, 0), inner: ctx.sidePoint(g.side, gtc, 1.2) } : null;
  if (gate) { ctx.keepClear(gate.side, gate.tc, 5, 3); info.gate = gate.side; info.gateAt = gate.at.map(v => +v.toFixed(2)); }
  // --- the edge (the kits arrived 2026-10-05): a low fence, a hedge or a dry-stone wall along the OPEN sides. One 5-ft
  // section per grid edge, on the grid line (where a wall would stand); a post / block / pier where a run ends or turns
  // (not where it ends against the building); the gate piece where the path leaves. A side shared with another yard
  // stays open: two yards are one stretch of ground. "none" stays in the roll: not every yard is fenced.
  const edgeKinds = Object.keys(YARD_EDGES).filter(k => YARD_EDGES[k].every(i => ctx.has(i) && ctx.skuPool(i).length));
  const openSegs = g?.open || [];
  if (openSegs.length && edgeKinds.length) {
    const taste = horses ? ['post-and-rail fence', 'post-and-rail fence', 'stone wall'] : cook && !inn ? ['wattle fence', 'picket fence', 'hedge'] : inn ? ['stone wall', 'hedge', 'picket fence', 'post-and-rail fence'] : ['post-and-rail fence', 'hedge', 'stone wall', 'wattle fence'];
    const kind = ctx.roll('yard edge', [...taste.filter(k => edgeKinds.includes(k)), 'none']);
    if (kind !== 'none') {
      const [straight, post, gateId] = YARD_EDGES[kind], fence = /fence/.test(kind), pieces = [];
      const lay = (id, x, z, rot, why, side) => { const sku = ctx.chooseSku(id); if (!sku) return null; const p = ctx.record(id, sku, ctx.dims(id, sku), x, 0, z, rot, 'anchor', 'yard-edge', why, { ...(side ? { side } : {}), edge: kind }); pieces.push(p); return p; };
      const vkey = (x, z) => `${Math.round(x * 2)}:${Math.round(z * 2)}`, verts = new Map(), built = new Set();
      for (const o of ctx.openings) if (o.to && /^(wall|window|door)$/.test(o.kind)) for (const t of [o.index * CELL - INSET, (o.index + 1) * CELL - INSET]) built.add(vkey(...ctx.sidePoint(o.side, t, -INSET)));
      // a door that reaches the yard's corner (a wide stable or inn door, half of it past the yard): the run on the
      // side that starts at that corner would end in the middle of the doorway, so its first section is left out
      const gaps = [], last = (sd) => Math.round(ctx.sideLen(sd) / CELL + 2 * INSET / CELL) - 1;
      const CORNER = { N: [['W', 0], ['E', 0]], S: [['W', -1], ['E', -1]], W: [['N', 0], ['S', 0]], E: [['N', -1], ['S', -1]] };
      for (const d of ctx.doors) for (const [end, [sd, ix]] of CORNER[d.side].entries()) if (end === 0 ? d.t0 <= 0.6 : d.t1 >= ctx.sideLen(d.side) - 0.6) gaps.push({ side: sd, index: ix < 0 ? last(sd) : 0 });
      info.edgeGaps = gaps.filter(q => openSegs.some(s => s.side === q.side && s.index === q.index) && !(q.side === g.side && q.index === g.index));
      for (const s of openSegs) {
        if (info.edgeGaps.some(q => q.side === s.side && q.index === s.index)) continue;
        const t0 = s.index * CELL - INSET, [x, z] = ctx.sidePoint(s.side, t0 + CELL / 2, -INSET), isGate = s.side === g.side && s.index === g.index;
        const p = lay(isGate ? gateId : straight, x, z, SIDES[s.side].rot, isGate ? `the gate in the ${kind}` : `${kind} along the open edge`, s.side);
        const dep = p && !isGate ? p.dims[2] / 2 - INSET + 0.15 : 0; // how far a thick hedge or wall reaches into the yard's ground
        if (dep > 0.15) { edgeIn = Math.max(edgeIn, Math.ceil(dep / RES) * RES); const [mx, mz] = ctx.sidePoint(s.side, t0 + CELL / 2, dep / 2), horiz = s.side === 'N' || s.side === 'S'; ctx.mark(mx, mz, horiz ? CELL : dep, horiz ? dep : CELL); }
        for (const t of [t0, t0 + CELL]) { const [vx, vz] = ctx.sidePoint(s.side, t, -INSET), k = vkey(vx, vz), v = verts.get(k) || { x: vx, z: vz, sides: new Set(), n: 0, gate: false }; v.sides.add(s.side); v.n++; v.gate ||= isGate; verts.set(k, v); }
      }
      for (const [k, v] of verts) {
        if (built.has(k)) continue;                                  // the run ends against the building
        if (v.n === 2 && v.sides.size === 1 && !(v.gate && fence)) continue; // mid-run (a fence gate hangs between two posts)
        lay(post, v.x, v.z, 0, v.sides.size > 1 ? `corner of the ${kind}` : v.gate ? 'gate post' : `end of the ${kind}`, null);
      }
      info.edge = kind; info.edgePieces = pieces.filter(Boolean).length;
    }
  }
  // the main door walks to the gate (with no gate: to the middle); every other door walks to the gate too (to the main
  // door when there is no gate). Not "to the nearest point of the main path": that runs along the building wall from
  // door to door and reserves the very wall the yard's things gather against.
  const far = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) >= 4; // shorter than that: the landing is the path
  const lines = doors.slice(0, 1).map(d => [d.inner, gate ? gate.inner : [cx, cz]]).filter(([a, b]) => far(a, b));

  // --- 1. the focal thing in the open, placed BEFORE the paths so they run past it, never through it (when the yard is big enough to have an "open")
  let focal = null; const around = [];
  if (Math.min(ctx.W, ctx.D) >= YARD.focalMin && A >= YARD.focalArea) {
    const trees = info.plants.slot.filter(i => /^tree-/.test(i));
    const kind = ctx.roll('yard focal', [...(trees.length ? ['a big tree', 'a big tree'] : []), 'well', 'well', 'well', ...(horses ? ['horse trough'] : inn ? ['fire pit'] : [])]);
    const ids = kind === 'a big tree' ? [...ctx.shuffle(trees.some(i => i !== 'tree-birch') ? trees.filter(i => i !== 'tree-birch') : trees), 'well'] : kind === 'horse trough' ? ['horse-trough-stone', 'well'] : kind === 'fire pit' ? ['firepit-stone-round', 'firepit-log-spit', 'well'] : ['well'];
    // in the open: off every edge, as near the middle as it can be while standing clear of the straight door-to-gate lines
    // (in a small yard it cannot: then the path, laid next, bends round it)
    const m = Math.max(3.5, Math.min(ctx.W, ctx.D) * 0.22);
    for (const id of ids) {
      if (!ctx.has(id)) continue;
      focal = quiet(() => ctx.put(id, (dm) => ctx.rectGen(dm, [ctx.X0 + m, ctx.Z0 + m, ctx.X1 - m, ctx.Z1 - m], kind === 'horse trough' ? [0, Math.PI / 2] : [0]),
        (c, dm) => Math.hypot(c.x - cx, c.z - cz) - 3 * Math.min(YARD.path / 2 + 1.5, ...lines.map(([a, b]) => segDist([c.x, c.z], a, b) - Math.max(dm.w, dm.d) / 2), YARD.path / 2 + 1.5), { layer: 'anchor', rule: 'yard-focal', why: `the yard's one focal thing, in the open: ${kind}`, failWhy: 'no open ground for the focal thing' }));
      if (focal) break;
    }
    if (focal) { focal.focal = true; info.focal = { id: focal.id, kind: kind === 'a big tree' && !/^tree-/.test(focal.id) ? 'well' : kind }; } // (no tree fitted: the well stands in)
  } else ctx.notes.push('too small for a focal thing in the open (needs 15 ft each way and about 300 sq ft)');
  // --- the paths, reserved before anything gathers
  if (lines.length) ctx.walk('path', lines[0], { width: YARD.path });
  for (const d of doors.slice(1)) { const to = gate ? gate.inner : doors[0].inner; if (far(d.inner, to)) ctx.walk('branch', [d.inner, to], { width: YARD.path }); }
  { // what goes with the focal thing: after the paths, so a bench never sits on one
    if (focal) {
      const kind = info.focal.kind, R = Math.max(focal.dims[0], focal.dims[2]) / 2;
      if (/^well/.test(focal.id)) around.push(nearPt(first(['bucket', 'rural-water-bucket-stable']), [focal.x, focal.z], { r0: R + 0.6, r1: R + 1.6, why: 'bucket by the well', rule: 'yard-focal-with', layer: 'dress' }));
      if (/^firepit/.test(focal.id)) for (let i = 0; i < (A >= 700 ? 3 : 2); i++) around.push(nearPt(first(['log-seat', ...YARD_SEAT]), [focal.x, focal.z], { r0: R + 2.2, r1: R + 3.4, face: true, why: 'seat by the fire pit, facing it', rule: 'yard-focal-with' }));
      else if (A >= 500 && (inn || !kinds.size)) around.push(nearPt(first(YARD_SEAT), [focal.x, focal.z], { r0: R + 2.5, r1: R + 4, face: true, why: `bench by the ${kind}, facing it`, rule: 'yard-focal-with' }));
      { const [aw, ad] = ctx.aabb(focal.dims[0] + 5, focal.dims[2] + 5, focal.rot); ctx.mark(focal.x, focal.z, aw, ad, KEEP); } // room to walk round it
      zone('focal', `focal (${kind})`, [focal, ...around]);
    }
  }

  // --- 2. beside each door, by what the door leads to. Tier 1 (always): the sign and a light. Then one thing per door, then extras.
  const D = doors.map(d => ({ d, type: typeOf(d), items: [], pt: d.inner, left: d.t0 - 2.1, right: d.t1 + 2.1, flip: hash(ctx.baseSeed ?? ctx.room.seed, 'yard-door', d.side, d.tc) % 2 === 1 }));
  for (const q of D) {
    const [a, b] = q.flip ? [q.right, q.left] : [q.left, q.right];
    // beside the door: this side, else the other side, else further along the same wall
    const beside = (id, t1, t2, o) => hang(id, q.d.side, t1, { ...o, reach: 3 }) || hang(id, q.d.side, t2, { ...o, reach: 3 }) || hang(id, q.d.side, t1, { ...o, reach: 40 });
    if (q.type === 'common' || q.type === 'desk') { const s = beside(first(YARD_SIGNS), a, b, { bottom: 6.2, why: `the inn's sign on the wall by the ${q.type === 'desk' ? 'front-desk' : 'common-room'} door, facing the yard` }); if (s) { q.items.push(s); info.signs++; } }
    q.items.push(beside(any(YARD_LIGHTS[q.type] || YARD_LIGHTS.any), q.type === 'common' || q.type === 'desk' ? b : a, q.type === 'common' || q.type === 'desk' ? a : b, { layer: 'light', rule: 'yard-light', why: 'a light by the door' }));
  }
  const byDoor = (q, id, o = {}) => { const p = atWall(id, q.pt, { maxDist: q.d.width / 2 + 8.5, sides: [q.d.side], ...o }); if (p) q.items.push(p); return p; };
  for (const q of D) { // one thing each: these say whose door it is, so they do not wait on the budget
    if (q.type === 'common' || q.type === 'desk' || q.type === 'hallway') byDoor(q, any(YARD_BENCH), { why: 'bench against the wall by the door', layer: 'furnish', rule: 'yard-door' });
    else if (q.type === 'kitchen') byDoor(q, first(['rain-barrel', 'barrel']), { why: 'rain barrel by the kitchen door', rule: 'yard-door' });
    else if (q.type === 'stable' || q.type === 'barn') { // a trough along the wall; where the wide door leaves no wall for one, a short trough, else hay
      const o = { why: 'trough along the wall by the stable door', layer: 'furnish', rule: 'yard-door' };
      byDoor(q, any(['water-trough', 'horse-trough-stone', 'feed-trough']), o) || byDoor(q, 'feed-trough', o) || byDoor(q, 'hay-bale', { ...o, why: 'hay by the stable door', layer: 'store' });
    }
    else if (q.type === 'privy') byDoor(q, first(['bucket']), { why: 'bucket by the privy door', rule: 'yard-door' });
  }
  // a lamp post beside the gate: with the sign, the thing that says "outside" (so it does not wait on the budget)
  const way = [], gn = gate ? SIDES[gate.side].n : [0, 0], glat = [gn[1], -gn[0]], gsgn = hash(ctx.baseSeed ?? ctx.room.seed, 'gate-side') % 2 ? 1 : -1;
  const besideGate = (k, depth) => [gate.at[0] + glat[0] * gsgn * k + gn[0] * depth, gate.at[1] + glat[1] * gsgn * k + gn[1] * depth];
  if (gate && A >= 250) way.push(nearPt(any(['lantern-post', 'lamp-post-wood']) || first(['torch-stand']), besideGate(4.2, 1.6), { r1: 3, why: 'lamp post beside the gate', rule: 'yard-gate', layer: 'light', rots: [SIDES[gate.side].rot] }));
  // the woodpile and its chopping block: against the wall, by the kitchen door if there is one
  const piles = [];
  if (backSides.length && room()) {
    const k = D.find(q => q.type === 'kitchen') || D.find(q => q.type === 'common') || D[0];
    const nearK = k ? k.pt : null;
    const long = wallFt >= 22 && ctx.has('woodpile-long') && ctx.skuPool('woodpile-long').length ? 'woodpile-long' : null; // one long low stack instead of two short ones side by side
    for (let i = 0; i < (wallFt >= 45 ? 3 : wallFt >= 22 ? 2 : 1) - (long ? 1 : 0) && room(); i++) {
      const p = piles.length ? atWall('woodpile', [piles.at(-1).x, piles.at(-1).z], { why: 'firewood stacked along the wall', rule: 'yard-woodpile', maxDist: 6 + (long ? 3 : 0) }) : (long && atWall(long, nearK, { why: 'firewood in one long stack against the building wall', rule: 'yard-woodpile', minDoor: nearK ? 6.5 : 0 })) || atWall('woodpile', nearK, { why: 'firewood stacked against the building wall', rule: 'yard-woodpile', minDoor: nearK ? 4.5 : 0 });
      if (!p) break; piles.push(p);
      if (piles.length === 1 && k?.type === 'kitchen' && Math.hypot(p.x - nearK[0], p.z - nearK[1]) < 12) p.why += ', handy for the kitchen door';
    }
    if (piles.length && room()) { const w = piles[0], f = [w.x + Math.sin(w.rot) * (w.dims[2] / 2 + 2.2), w.z + Math.cos(w.rot) * (w.dims[2] / 2 + 2.2)]; piles.push(nearPt('chopping-block', f, { r0: 0, r1: 2.5, why: 'chopping block in front of the woodpile', rule: 'yard-woodpile' })); }
    zone('wood', 'woodpile', piles);
  }
  for (const q of D) { // extras per door, while the yard still has room
    const extra = (ids, o) => { for (const id of ids) { if (!room()) return; byDoor(q, id, { rule: 'yard-door', ...o }); } };
    if (q.type === 'common' || q.type === 'desk') { if (room()) q.items.push(hang(any(YARD_BOARDS), q.d.side, q.flip ? q.left - 2 : q.right + 2, { bottom: 4.2, rule: 'yard-sign', why: 'notices on the wall by the door' })); extra(ctx.pick(['barrel', 'barrel', 'bottles-empty-crate', 'crate'], 2), { why: 'barrels and empties by the tavern door' }); }
    else if (q.type === 'kitchen') extra([any(['vegetable-crate-mixed', 'cabbage-crate', 'potato-crate', 'apple-crate']), 'bucket', A >= 500 ? any(['washtub', 'washboard-tub']) : null, any(['cabbage-crate', 'potato-crate', 'turnip-pile'])].filter(Boolean), { why: 'by the kitchen door: deliveries, slops and wash day' });
    else if (q.type === 'stable' || q.type === 'barn') {
      extra(['hay-bale', 'hay-bale', A >= 500 ? 'rural-mounting-block' : null, A >= 700 ? any(['wheelbarrow', 'rural-manure-barrow']) : null].filter(Boolean), { why: 'by the stable door: hay, a mounting block, a barrow' });
      if (room()) { const n = SIDES[q.d.side].n, lat = [n[1], -n[0]], off = (q.flip ? -1 : 1) * (q.d.width / 2 + 3.5); q.items.push(nearPt('hitching-post', [q.pt[0] + n[0] * 5 + lat[0] * off, q.pt[1] + n[1] * 5 + lat[1] * off], { r1: 3, rots: [SIDES[q.d.side].rot], why: 'hitching rail outside the stable', rule: 'yard-door' })); }
      if (room() && A >= 600) q.items.push(atWall('manure-heap', q.pt, { why: 'muck heap along the wall, away from the door', minDoor: 10, rule: 'yard-door' }));
      const hay = q.items.filter(p => p && /^hay/.test(p.id)); if (hay.length) quiet(() => ctx.rug('rug-hay-scatter', { at: [hay[0].x + SIDES[q.d.side].n[0] * 2.2, hay[0].z + SIDES[q.d.side].n[1] * 2.2], why: 'loose hay trodden out of the stable' }));
    }
  }
  for (const q of D) { const z = zone('door', `by the ${ctx.type.labels?.[q.type] || q.type} door`, q.items); info.doors.push({ to: q.type, side: q.d.side, things: q.items.filter(Boolean).map(p => p.id) }); }

  // --- 3. along the path and at the gate: the hand cart, a notice board, a hitching rail out front (the lamp post went in early)
  if (gate) {
    if (inn && room() && A >= 500) { const sg = ctx.roll('yard gate sign', ['notice-board', 'sign-post-inn']), id = first([sg, 'notice-board']); way.push(nearPt(id, besideGate(-4.6, 1.8), { r1: 3, rots: [SIDES[gate.side].rot], why: id === 'sign-post-inn' ? "the inn's sign on its own post by the gate, facing the road" : 'notice board by the gate, facing people coming in', rule: 'yard-gate' })); }
    if (inn && !horses && room() && A >= 700) way.push(nearPt('hitching-post', besideGate(-8.5, 5), { r1: 4, rots: [SIDES[gate.side].rot + Math.PI / 2], why: 'hitching rail by the gate for riders', rule: 'yard-gate' }));
  }
  if (gate && room() && A >= 900) way.push(nearPt(any(['fire-basket-stand', 'brazier-tripod']), besideGate(-8, 1.8), { r1: 3.5, why: 'a fire basket by the gate for the night watch', rule: 'yard-gate', layer: 'light' }));
  if (backSides.length && room()) way.push(atWall('cart-hand', gate ? gate.inner : null, { why: 'hand cart parked against the wall', rule: 'yard-wall', layer: 'furnish' }));
  if (!cook && backSides.length && room()) way.push(atWall('rain-barrel', null, { why: 'rain barrel under the eaves', rule: 'yard-wall' }));
  zone('gate', 'gate & path', way);

  // --- 4. plants: 2-4 bush / tree picks by the edges and beside the doors. The slot is EMPTY until plant meshes exist.
  const greens = [];
  if (info.plants.slot.length) {
    const nPl = Math.max(YARD.plants[0], Math.min(YARD.plants[1], Math.round(A / 300)));
    const small = info.plants.slot.filter(i => !/^(tree-|hedge)/.test(i)), big = info.plants.slot.filter(i => /^tree-/.test(i) && i !== focal?.id);
    const plant = (id, q) => (q && small.includes(id) && atWall(id, q.pt, { maxDist: 9, sides: [q.d.side], gap: 0.3, why: 'a bush by the door', rule: 'yard-plant', layer: 'dress' }))
      || quiet(() => ctx.put(id, (dm) => edgeGen(dm, { gap: /^tree-/.test(id) ? 1 : 0.4 }), (c) => -Math.min(12, ...greens.map(o => Math.hypot(c.x - o.x, c.z - o.z)), 12) - Math.min(6, Math.hypot(c.x - cx, c.z - cz) / 4) + ctx.rng(), { layer: 'dress', rule: 'yard-plant', why: `${/^tree-/.test(id) ? 'a tree' : 'planting'} along the open edge`, failWhy: 'no open edge for a plant' }))
      || (small.includes(id) && backSides.length ? atWall(id, null, { gap: 0.3, why: 'planting against the wall', rule: 'yard-plant', layer: 'dress' }) : null);
    for (let i = 0; i < nPl; i++) { // every other pick flanks a door; the rest stand at the open edges (a tree where there is room, else a bush)
      const q = i % 2 === 0 && D[i / 2] ? D[i / 2] : null, tree = i % 2 === 1 && A >= 500 && big.length ? ctx.pick(big)[0] : null, bush = ctx.pick(small.length ? small : big)[0];
      const p = (tree && plant(tree, null)) || (bush && plant(bush, q));
      if (p) greens.push(p);
    }
    info.plants.placed = greens.length; zone('plants', 'plants', greens);
  }

  // --- 4b. yard furniture from the 2026-10-05 batch (docs/ASSETS_TO_BUILD.md). Each waits for its mesh and for room in
  // the (low) budget, so a yard takes one or two of these, never all: a picnic table out from the inn's door, a
  // vegetable or herb bed and the tools by the kitchen door, a trellis on the wall, the kennel by the gate, the
  // washing line and the compost bin at the far edge.
  {
    const got = [], can = (id) => id && ctx.has(id) && ctx.skuPool(id).length && room();
    const onEdge = (id, why, far = false) => !can(id) ? null : quiet(() => ctx.put(id, (dm) => edgeGen(dm, { gap: 0.5, step: 1, clearGate: 6 }), (c) => (far ? -1 : 1) * Math.min(20, ...doors.map(d => Math.hypot(c.x - d.at[0], c.z - d.at[1])), 20) + ctx.rng() * 3, { layer: 'furnish', rule: 'yard-garden', why, failWhy: 'no open edge' }));
    const kq = D.find(q => q.type === 'kitchen'), iq = D.find(q => q.type === 'common' || q.type === 'desk' || q.type === 'hallway');
    if (iq && A >= 500 && can('table-picnic')) { const n = SIDES[iq.d.side].n, lat = [n[1], -n[0]], k = iq.flip ? 1 : -1; got.push(nearPt('table-picnic', [iq.pt[0] + n[0] * 7 + lat[0] * k * 7, iq.pt[1] + n[1] * 7 + lat[1] * k * 7], { r1: 6, rots: [SIDES[iq.d.side].rot, SIDES[iq.d.side].rot + Math.PI / 2], why: 'a picnic table out from the door: the beer garden', rule: 'yard-garden' })); }
    if (kq) {
      if (can('garden-tools-leaning')) got.push(byDoor(kq, 'garden-tools-leaning', { why: 'spade, rake and hoe leaning by the kitchen door', rule: 'yard-garden', layer: 'dress' }));
      got.push(onEdge(ctx.roll('kitchen garden bed', ['vegetable-patch', 'trade-herb-bed']), 'the kitchen garden: a bed on the open edge'));
      if (A >= 600) got.push(onEdge('compost-heap', 'compost bin at the far edge of the kitchen garden', true));
      if (A >= 700) got.push(onEdge('clothesline', 'washing line on the open edge', true));
    }
    if (backSides.length && (inn || cook) && can('trellis-vine')) got.push(atWall('trellis-vine', null, { why: 'a trellis and its climber on the building wall', rule: 'yard-garden', layer: 'dress', gap: 0.05 }));
    if (gate && !horses && A >= 400 && can('dog-kennel') && ctx.roll('yard kennel', ['no', 'no', 'yes']) === 'yes') got.push(nearPt('dog-kennel', besideGate(7, 2.2), { r1: 4, rots: [SIDES[gate.side].rot], why: 'the kennel by the gate', rule: 'yard-garden' }));
    zone('garden', 'garden & beer garden', got);
  }

  // --- 5. big yards: an outbuilding or two on the open edge (never in the middle)
  const out = [];
  if (A >= 1100) {
    const edgePut = (id, why) => !id || !ctx.has(id) || !room() ? null : quiet(() => ctx.put(id, (dm) => edgeGen(dm, { gap: 0.6, step: 1, clearGate: 7 }), (c) => -Math.min(14, ...[...out.filter(Boolean), ...doors.map(d => ({ x: d.at[0], z: d.at[1] }))].map(o => Math.hypot(c.x - o.x, c.z - o.z)), 14) + ctx.rng() * 3, { layer: 'furnish', rule: 'yard-outbuilding', why, failWhy: 'no open edge' }));
    if (!kinds.has('privy')) out.push(edgePut('outhouse', 'outhouse at the far edge of the yard'));
    out.push(edgePut(inn || cook ? 'woodshed' : null, 'woodshed on the open edge'));
    if (A >= 1500) out.push(edgePut(horses || inn ? first(['cart-shed', 'wagon']) : null, 'cart shelter on the open edge'));
    zone('outbuildings', 'outbuildings', out);
  }

  // --- 6. toward the (low) density target: more of what already stands at the wall, like with like. Never the middle.
  const FILL = [...(horses ? ['hay-bale', 'sack', 'bucket'] : []), ...(cook ? ['crate', 'sack', 'baskets-stack'] : []), 'barrel', 'crate', 'barrel', 'firewood-basket', 'sack', 'bucket', 'broom'];
  const more = [];
  for (let k = 0, miss = 0; room() && backSides.length && miss < 6 && k < 40; k++) {
    const id = FILL[k % FILL.length]; if (!ctx.has(id)) { miss++; continue; }
    const mates = ctx.placements.filter(q => (q.id === id || (q.rule || '').startsWith('yard-') && q.layer === 'store') && !q.parent && q.y < 0.5 && q.side);
    const m = mates.length ? mates[Math.floor(ctx.rng() * mates.length)] : null;
    const p = atWall(id, m ? [m.x, m.z] : null, { why: m ? 'more stores gathered at the wall, like with like' : 'stores against the building wall', rule: 'yard-fill', maxDist: m ? 7 : 99 });
    if (p) { more.push(p); miss = 0; } else miss++;
  }
  zone('stores', 'stores at the wall', more);

  // a yard too small and too alone for any of that is still somewhere: one thing at its edge rather than bare grass
  if (!count()) for (const id of ['bench-long', 'barrel', 'bucket']) { const p = ctx.has(id) && quiet(() => ctx.put(id, (dm) => edgeGen(dm, { clearGate: 2 }), () => ctx.rng(), { layer: 'furnish', rule: 'yard-edge', why: 'the one thing in a small bare yard, at its edge', failWhy: 'no room' })); if (p) { zone('edge', 'at the edge', [p]); break; } }

  // --- 7. the trodden path: worn earth along the MAIN walking line (flat decals; they never block). Waits for its own
  // asset (decal-path-worn, docs/ASSETS_TO_BUILD.md): the mud patches we have read as blobs on grass (Gemini, 2026-10-05).
  const WEAR = 'decal-path-worn';
  if (ctx.has(WEAR)) for (const path of ctx.paths.slice(0, 1)) {
    if (!path.ok) continue;
    for (let i = 0; i + 1 < path.pts.length; i++) {
      const [a, b] = [path.pts[i], path.pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2.8));
      for (let k = 0; k < n; k++) {
        const sku = ctx.chooseSku(WEAR); if (!sku) break;
        const dm = ctx.dims(WEAR, sku), u = (k + 0.5) / n, x = a[0] + (b[0] - a[0]) * u + ctx.r(-0.5, 0.5), z = a[1] + (b[1] - a[1]) * u + ctx.r(-0.5, 0.5);
        const rad = Math.hypot(dm.w, dm.d) / 2; if (x - rad < ctx.X0 || x + rad > ctx.X1 || z - rad < ctx.Z0 || z + rad > ctx.Z1) continue;
        ctx.record(WEAR, sku, dm, x, 0.03 + info.wear * 0.0012, z, Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2 + ctx.r(-0.4, 0.4), 'floor-dress', 'path-wear', 'the path worn into the ground', { orient: 'floor', soft: true });
        info.wear++;
      }
    }
  }
  return { feature: focal, what: `${vibe}: open ground${gate && doors.length ? ', a clear way from the door to the gate' : ''}${focal ? `, ${info.focal.kind} in the open` : ''}`, outdoor: true };
}

// ---------------- one candidate ----------------
function attempt(args, k) {
  const room = { ...args.room, seed: k === 0 ? args.room.seed : hash(args.room.seed, 'v2', k) };
  const ctx = new Ctx2({ ...args, room });
  ctx.baseSeed = args.room.seed; // per-generation choices (e.g. storeroom aisles) shared by every candidate
  ctx.typesOf = (id) => args.roomTypeOf?.(id);
  const type = args.type, key = PROGRAM_OF[type.key] || type.key; // a room type that IS an inn room in other walls runs the inn's program (PROGRAM_OF, in the appended block)
  if (ctx.role === 'outdoor') return finish(ctx, (KEY[key] || yard)(ctx), args); // no walls, no zone menu, no density fill: its own grammar (the yard's, or the type's own: KEY)
  // 1-2. key purpose first (with its own reserved flow for passages)
  // args.annex: this rectangle is the REST of a shaped room whose largest rectangle already holds the key purpose (the
  // bed, the hearth, the stalls): no second one here, just zones, edges and light. Harry: in an odd-shaped room the
  // largest rectangle inside is "the room"; the rest only has to look lived in.
  const kp = args.annex ? { fail: null, feature: null, what: 'the rest of the room' } : (KEY[key] || (() => ({ fail: null, feature: null, what: '—' })))(ctx) || {};
  if (kp.fail) ctx.purposeFail = kp.fail;
  if (kp.feature && ctx.mainDoor && !kp.privacy) { ctx.sight = [ctx.mainDoor.inner, [kp.feature.x, kp.feature.z]]; ctx.sightFeature = kp.feature.id; }
  const area = ctx.area();
  const placeZones = (filter) => {
    for (const m of (MENUS[key] || []).filter(filter)) {
      if (area < m.minArea || (m.when && !m.when(ctx))) continue;
      const reps = m.repeat > 1 ? Math.min(m.repeat, Math.max(1, Math.floor(area / (m.per || m.size[0] * m.size[1] * 2.4)))) : 1;
      // hub islands sit in the core: keep a ~4-ft band along the walls for the swirl and the wall furniture
      const band = m.phase === 'core' && ctx.role === 'hub' ? Math.min(4, Math.max(0, (Math.min(ctx.W, ctx.D) - m.size[0]) / 2 - 0.5)) : 0;
      const coreOk = (r) => r[0] - ctx.X0 >= band && ctx.X1 - r[2] >= band && r[1] - ctx.Z0 >= band && ctx.Z1 - r[3] >= band;
      for (let i = 0; i < reps; i++) {
        let r = null;
        for (const sz of [m.size, ...(m.fallback || [])]) { r = ctx.findRect(sz[0], sz[1], (rr) => m.pref(ctx, rr) + (coreOk(rr) ? 0 : 1000)); if (r) break; }
        if (r && !coreOk(r) && band > 0 && i > 0) r = null; // only the first island may spill into the band
        if (!r && m.doorSide && i === 0 && ctx.mainDoor) { const di = ctx.mainDoor.inner; r = [di[0] - 0.25, di[1] - 0.25, di[0] + 0.25, di[1] + 0.25]; r.doorSide = true; } // door-side zones fall back to wall by the door
        if (!r) { if (i === 0 && !m.quiet) ctx.unplaced.push({ id: `zone:${m.kind}`, why: `no room left for the ${m.label} (${m.size.join('×')} ft)` }); break; }
        const z = ctx.addZone(m.kind, m.label + (m.repeat > 1 && reps > 1 ? ` ${i + 1}` : ''), r);
        m.fill(ctx, z, r);
        if (z.items.length === 0) ctx.zones.pop();
      }
    }
  };
  if (ctx.role === 'hub') placeZones(m => m.phase === 'core');
  // 3. desire lines
  const doorPts = ctx.doors.map(d => d.inner);
  if (ctx.role === 'hub' && doorPts.length) {
    // the swirl: doors and the poles' fronts, plus inset corners in big rooms so the loop wraps the zones
    const c = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], ins = Math.max(3, Math.min(6, Math.min(ctx.W, ctx.D) * 0.18));
    const corners = ctx.area() >= 900 ? [[ctx.X0 + ins, ctx.Z0 + ins], [ctx.X1 - ins, ctx.Z0 + ins], [ctx.X1 - ins, ctx.Z1 - ins], [ctx.X0 + ins, ctx.Z1 - ins]] : [];
    const way = [...doorPts, ...(kp.poles || []).map((p, i) => front(p, i === 0 ? 9.5 : 4.5)), ...corners]
      .filter(p => p[0] > ctx.X0 && p[0] < ctx.X1 && p[1] > ctx.Z0 && p[1] < ctx.Z1)
      .sort((p, q) => Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(q[1] - c[1], q[0] - c[0]));
    if (way.length >= 2) ctx.walk('loop', way, { closed: true, quietSkips: true });
  } else if (ctx.role === 'terminal' && ctx.mainDoor && kp.approach && !kp.privacy) {
    if (kp.aisle) ctx.walk('aisle', [ctx.mainDoor.inner, kp.approach], { width: 3.5 });
    else ctx.walk('approach', [ctx.mainDoor.inner, kp.approach]);
  } else if (ctx.role === 'uses' && kp.triangle) {
    const [hf, pp, st] = kp.triangle;
    ctx.walk('service', [hf, pp, st]);
    if (kp.guest) ctx.walk('service', [kp.guest.inner, pp]);
  } else if (ctx.role === 'mixed' && key === 'stable' && ctx.mainDoor) {
    const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
    const back = kp.stallsAlong, L = back ? ctx.sideLen(back) : 0;
    if (back) ctx.walk('lane', [ctx.mainDoor.inner, ctx.sidePoint(back, 2, 7.5), ctx.sidePoint(back, L - 2, 7.5)]);
  }
  // other doors also need a way in to the room's paths (every door joins the network)
  if (ctx.role !== 'hub' && ctx.doors.length > 1 && ctx.paths.length) {
    const hubPt = ctx.paths[0].pts[Math.floor(ctx.paths[0].pts.length / 2)] || null;
    for (const d of ctx.doors) if (d !== ctx.mainDoor && hubPt && !(kp.passage)) ctx.walk('branch', [d.inner, hubPt]);
  }
  // 4. zones: ordered menu, growing with area, repeatables fill big rooms (hub islands were placed before the loop)
  placeZones(m => !(ctx.role === 'hub' && m.phase === 'core'));
  // 4b. per-type fill before the generic edges (kitchens: "fill this crap up")
  if (key === 'kitchen') kitchenFill(ctx);
  // 5. edges toward the density target
  fillDensity(ctx);
  // lights for big rooms: a chandelier per ~350 sq ft over zone centres
  if (ctx.role === 'hub' || area > 300) for (const z of ctx.zones.slice(0, Math.max(1, Math.round(area / 350)))) {
    const m = 2.6, at = [Math.min(ctx.X1 - m, Math.max(ctx.X0 + m, (z.rect[0] + z.rect[2]) / 2)), Math.min(ctx.Z1 - m, Math.max(ctx.Z0 + m, (z.rect[1] + z.rect[3]) / 2))];
    const hang = ctx.slot('light').filter(id => ctx.lib.objects[id]?.place === 'ceiling');
    const lamp = (ctx.role === 'hub' || key === 'fine') && ctx.has('chandelier-ring') ? 'chandelier-ring' : (hang.find(i => i !== 'chandelier-ring') || 'lantern-hanging');
    ctx.tag(z, ctx.ceiling(lamp, { at, why: `light over the ${z.label}` }));
  }
  // 6. checks
  return finish(ctx, kp, args);
}

// Harry 2026-10-01 on big kitchens: "way under density target, fill this crap up!" Wall racks and hanging things on every
// free wall run, larder stacks in the corners, and every work surface loaded; working faces and walkways stay clear.
function kitchenFill(ctx) {
  const per = Math.max(4, Math.round((ctx.W + ctx.D) * 2 / 5));
  for (let k = 0, miss = 0; k < per && miss < 8; k++) {
    const id = ['utensil-rack-wall', 'knife-rack-wall', 'dish-rag-hanging', 'garlic-braid', 'utensil-rack-wall', 'pot-hook-chain'][k % 6];
    if (!ctx.has(id) || !ctx.mount(id, { why: 'hung on a free run of wall', height: k % 2 ? 5.6 : 6.2 })) miss++;
  }
  for (let i = 0; i < Math.min(4, Math.max(1, Math.floor(ctx.area() / 500))); i++) ctx.cornerPile(['sack', 'barrel', 'potato-pile', 'vegetable-basket-mixed', 'apple-basket', 'turnip-basket', 'flour-sack-open', 'sack'], ctx.ri(3, 5), { why: 'larder stack in the corner' });
  // free wall runs (not the cooking lines' faces, not the aisles: both are reserved) take cupboards and larder stacks
  const LARDER = ['sack', 'barrel', 'potato-pile', 'vegetable-basket-mixed', 'apple-basket', 'turnip-basket', 'flour-sack-open', 'cupboard', 'cupboard'];
  for (let k = 0, miss = 0; k < per * 2 && miss < 10; k++) {
    const id = LARDER[k % LARDER.length];
    if (!ctx.has(id)) { miss++; continue; }
    const mates = id !== 'cupboard' ? ctx.placements.filter(q => q.id === id && !q.parent && q.y < 0.5) : [];
    const p = (mates.length && ctx.nearMates(id, mates)) || ctx.wall(id, { layer: 'store', rule: id === 'cupboard' ? 'against-wall' : 'larder-stack', why: id === 'cupboard' ? 'cupboard on a free run of wall' : 'larder stack along a free wall', jitter: id === 'cupboard' ? 0 : 0.3, gap: 0.1 });
    if (p) miss = 0; else miss++;
  }
  for (const s of ctx.surfaces) { // every work surface in use
    const want = /^table/.test(s.id) ? 9 : /^(chopping|counter)/.test(s.id) ? 3 : /^(barrel|crate|cupboard)/.test(s.id) ? 2 : 0;
    for (let i = s.items.length, tries = 0; i < want && tries < want + 3; tries++) { if (ctx.surface(ctx.pick(KITCHEN_WORK)[0], { on: x => x === s, why: 'work in progress' })) i++; }
  }
  ctx.unplaced = ctx.unplaced.filter(u => !/no room on the chosen surface|no bare wall|every corner already full/.test(u.why));
}

function fillDensity(ctx) {
  const target = DENSITY[ctx.type.key] ?? 7;
  const want = Math.max(1, Math.round(target * ctx.area() / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor').length;
  const pool = ['store', 'dress', 'light', 'furnish', 'anchor'].flatMap(s => ctx.slot(s)).filter(id => {
    const o = ctx.lib.objects[id]; return o && o.place !== 'kit' && !/^(bed|fireplace|cook-hearth|counter-shop|privy-seat|outhouse|bar-counter|table-trestle|wagon|stair|floor-|rural-manger-wall|rural-straw-bedding|screen-folding|bathtub|wardrobe|mirror-standing|table-vanity|bread-oven|bread-peel|bread-rack)/.test(id)
      && !(ctx.area() >= 450 && /^chair/.test(id)); // screens are dividers, never edge dressing; big rooms: seats float in zones
  });
  const LIKE = /^(barrel|crate|sack|hay-bale|cask|potato-sack|barley-sack|salt-sack)/;
  let misses = 0; const u0 = ctx.unplaced.length;
  while (count() < want && misses < 60) {
    const before = ctx.placements.length;
    const id = ctx.pick(pool)[0];
    if (!id) break;
    const mates = LIKE.test(id) ? ctx.placements.filter(q => q.id === id && !q.parent && q.y < 0.5) : [];
    const p = (mates.length ? ctx.nearMates(id, mates) : null) || ctx.auto(id, { why: 'edge dressing toward the density target' });
    if (p) { p.zone = p.zone || 'edge'; misses = 0; } else misses++;
    if (ctx.placements.length === before) misses++;
  }
  ctx.unplaced.length = u0; // density filling is best-effort: its misses are not interesting
}

function finish(ctx, kp, args) {
  const props = ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length; // a yard's fence is its edge, not its props
  const density = props / ctx.area() * 100, target = ctx.densityTarget ?? DENSITY[ctx.type.key] ?? 7;
  // one camera angle: the key feature in view from the main door (privacy rooms: the opposite)
  let visible = null;
  if (kp.feature && ctx.mainDoor) {
    const f = kp.feature;
    if (kp.privacy) visible = !ctx.inBlast(ctx.mainDoor, f.x, f.z, 0);
    else { // any of centre / both ends in view counts (one camera angle: you see it as you walk in)
      const [fx, fz] = [Math.sin(f.rot), Math.cos(f.rot)], lx = -fz * f.dims[0] * 0.4, lz = fx * f.dims[0] * 0.4;
      visible = [[f.x, f.z], [f.x + lx, f.z + lz], [f.x - lx, f.z - lz]].some(pt => ctx.losClear(ctx.mainDoor.inner, pt, new Set([f.uid])).ok);
    }
  }
  // stacked storerooms: the storage itself is the key purpose, and the doorway view is down the aisles
  let viewNote = null;
  if (ctx.storeInfo && ctx.mainDoor && !kp.privacy) {
    const lanes = ctx.paths.filter(p => p.kind === 'aisle' || p.kind === 'cross-aisle');
    const seen = lanes.some(p => p.pts.some(pt => ctx.losClear(ctx.mainDoor.inner, pt).ok && Math.hypot(pt[0] - ctx.mainDoor.inner[0], pt[1] - ctx.mainDoor.inner[1]) > 6));
    if (seen) { visible = true; viewNote = 'down the aisles'; }
  }
  const cmdScore = ctx.primary.length ? ctx.primary.reduce((a, c) => a + c.score, 0) / ctx.primary.length : 1;
  const pathOk = ctx.paths.length ? ctx.paths.filter(p => p.ok).length / ctx.paths.length : 1;
  const grammarLost = ctx.expectRows && !(ctx.kitchenRows && ctx.kitchenRows.units >= 4) ? 15 : 0; // an industrial kitchen whose rows collapsed loses to one that kept them
  const score = (ctx.purposeFail ? 0 : 100) - grammarLost + 20 * cmdScore + 15 * pathOk + 10 * Math.min(1, density / target) + 3 * ctx.zones.length + (visible === false ? -30 : 0) - 0.3 * ctx.unplaced.length;
  return {
    engine: 'v2', role: ctx.role, who: ctx.roleInfo.who, purposeFail: ctx.purposeFail, score: +score.toFixed(1),
    room: { id: args.room.id, type: args.type.key, label: args.type.label, cells: [args.room.w, args.room.d], feet: [args.room.w * CELL, args.room.d * CELL], seed: args.room.seed, family: args.room.family },
    openings: args.openings.filter(o => o.kind !== 'wall').map(o => ({ side: o.side, at_ft: o.index * CELL, kind: o.kind, to: o.to, yard: o.yard || undefined, why: o.why, flag: o.flag, part: o.part || undefined, span: o.span })),
    placements: ctx.placements, unplaced: ctx.unplaced, notes: ctx.notes,
    zones: ctx.zones, paths: ctx.paths, store: ctx.storeInfo || undefined, stable: ctx.stableInfo || undefined,
    kitchen: ctx.kitchenInfo ? { ...ctx.kitchenInfo, ovens: ctx.placements.filter(p => p.id === 'bread-oven').length, rowsInfo: ctx.kitchenRows ? { rows: ctx.kitchenRows.rows + (ctx.kitchenRows.mixedRows ? ' + single' : '') + (ctx.kitchenRows.rowsDowngraded ? ' (rolled double, room for single)' : ''), orient: ctx.kitchenRows.orient, aisle: ctx.kitchenRows.aisle, axis: ctx.kitchenRows.axis, cross: ctx.kitchenRows.crossAisles, hung: ctx.kitchenRows.hung || 0 } : undefined } : undefined,
    focal: ctx.focal || undefined, wealth: ROOM_WEALTH[args.type.key] || args.type.wealth || 'common',
    yard: ctx.yardInfo || undefined, dorm: ctx.dormInfo || undefined, rows: ctx.kitchenRows || ctx.dormRows || undefined,
    growth: ctx.growth, rolls: ctx.rolls,
    anatomy: { companions: ctx.placements.filter(p => p.rule === 'companion').length, faces: ctx.faces.length, dividers: ctx.placements.filter(p => p.rule === 'zone-divider').length, likeWithLike: ctx.placements.filter(p => p.rule === 'like-with-like').length },
    checks: { purpose: { ok: !ctx.purposeFail, what: kp.what || '—', feature: kp.feature?.uid || null, visibleFromDoor: visible, view: viewNote || undefined, privacy: !!kp.privacy }, command: ctx.primary, paths: ctx.paths.map(p => ({ kind: p.kind, ok: p.ok, len: p.len })), density: { value: +density.toFixed(1), target } },
    mainDoor: ctx.mainDoor ? { side: ctx.mainDoor.side, at: ctx.mainDoor.at, inner: ctx.mainDoor.inner } : null,
    grid: { x0: ctx.X0, z0: ctx.Z0, nx: ctx.nx, nz: ctx.nz, res: RES, cells: Array.from(ctx.grid) },
  };
}

// ---------------- entry: best of N candidates ----------------
export function solveRoom2(args) {
  const N = args.opts?.bestOf ?? 4;
  let best = null;
  for (let k = 0; k < N; k++) {
    const L = attempt(args, k);
    if (!best || L.score > best.score) best = { ...L, candidate: k };
  }
  best.candidates = N;
  return best;
}

// ---------------- readable summary ----------------
const SIDE_NAME = { N: 'north', S: 'south', E: 'east', W: 'west' };
const mark = (b) => b === null || b === undefined ? '–' : b ? '✓' : '✗';
export function summarize2(L, roomLabel = id => id) {
  const lines = [];
  if (L.purposeFail) lines.push(`⚠ PURPOSE FAIL: ${L.purposeFail}.`);
  const R = L.room;
  lines.push(`${R.label} ${R.feet[0]}×${R.feet[1]} ft: ${L.role.toUpperCase()} (who counts: ${L.who || 'guests'}), seed ${R.seed}, ${L.role === 'outdoor' ? 'no walls' : `${R.family} walls`}. Engine v2, best of ${L.candidates} (score ${L.score}).`);
  const doors = L.openings.filter(o => o.kind === 'door' && !o.part);
  lines.push(`Doors: ${doors.length ? doors.map(o => `${SIDE_NAME[o.side]} at ${o.at_ft} ft${o.span > 1 ? ` (${o.span * CELL} ft wide)` : ''}${o.to ? ` → ${roomLabel(o.to)}` : o.yard ? ' → the yard' : ' (outside)'}${o.why ? ` [${o.why}${o.flag ? ', ' + o.flag : ''}]` : ''}`).join('; ') : 'none'}.`);
  const P = L.checks.purpose;
  lines.push(`Key purpose: ${P.what} ${P.ok ? '✓' : '✗'}${P.visibleFromDoor === null ? '' : P.privacy ? `; out of the door's line ${mark(P.visibleFromDoor)}` : `; in view from the doorway ${mark(P.visibleFromDoor)}${P.view ? ` (${P.view})` : ''}`}.`);
  if (L.paths.length) lines.push(`Paths: ${L.paths.map(p => `${p.kind} ${p.len} ft ${p.ok ? 'clear' : 'BLOCKED'}`).join('; ')}.`);
  if (L.store) { const S = L.store; lines.push(`Aisles: ${S.rowsCount} ${S.rows} rows (${S.rowIds.join(', ')}, ${S.units} units) running ${S.axis}, ${S.aisle}-ft aisles ${S.orient === 'door' ? 'pointing away from the door' : 'along the long axis'}; ${S.crossAisles} cross aisle${S.crossAisles === 1 ? '' : 's'}; ${S.endCaps} end caps; receiving area ${S.recvArea ? 'by the door' : S.receivingDropped ? 'none (rolled yes, no room)' : 'none'}; floor coverage ${Math.round(S.coverage * 100)}%${S.mix ? `; rows: ${S.mix === 'racks' ? 'casks & wine racks only' : 'racks mixed with shelving'}` : ''}.`); }
  if (L.stable) { const S = L.stable; lines.push(`Stalls: ${S.stalls} (5×${S.depth} ft) on ${S.walls === 'both' ? 'both long walls' : 'one long wall'}${S.bothDropped ? ' (rolled both; too narrow)' : ''}${S.middleRows ? ` + ${S.middleRows} back-to-back middle row${S.middleRows > 1 ? 's' : ''}` : ''}, rows running ${S.axis}; ${S.aisles} aisle${S.aisles > 1 ? 's' : ''} ${S.aisle} ft wide${S.crossAisles ? `, ${S.crossAisles} cross aisle${S.crossAisles > 1 ? 's' : ''}` : ''}; ${S.gates} gates, ${S.mangers} mangers, ${S.buckets} water buckets, hay in ${S.hayStalls} stalls; floor coverage ${Math.round(S.coverage * 100)}%${S.bareSide ? `; the bare ${SIDE_NAME[S.bareSide]} wall holds tack, feed and grooming (${S.bareItems} pieces)` : ''}.`); }
  if (L.focal) lines.push(L.focal.ok ? `Focal: ${L.focal.label} centred opposite the door ✓.` : `Focal: ${L.focal.label} not axial (${L.focal.why}).`);
  if (L.kitchen) { const K = L.kitchen, R = K.rowsInfo; lines.push(`Kitchen: ${K.lines} cooking line${K.lines > 1 ? 's' : ''} on the walls, ${K.ovens} bake corner${K.ovens === 1 ? '' : 's'}${K.rows ? `; ${K.rows} ${R.rows} work row${K.rows > 1 ? 's' : ''} (${K.tables} stations, ${K.caps} end caps) running ${R.axis}, ${R.aisle}-ft working aisles ${R.orient === 'door' ? 'pointing away from the door' : 'along the long axis'}, ${R.cross} cross aisle${R.cross === 1 ? '' : 's'}, ${R.hung} things hung over the aisles` : '; no work rows (wall kitchen)'}.`); }
  if (L.yard) { const Y = L.yard, P = Y.plants;
    lines.push(`Yard: ${Y.vibe}; no walls (edge: ${Y.edge}${Y.edgePieces ? `, ${Y.edgePieces} pieces` : ''}); ${Y.wallFt} ft of building wall to gather against; gate ${Y.gate ? `on the ${SIDE_NAME[Y.gate]} side` : 'none (closed court)'}; focal ${Y.focal ? `${Y.focal.id} (${Y.focal.kind})` : 'none'}; ${Y.signs} sign${Y.signs === 1 ? '' : 's'} on the building wall${Y.wear ? `; ${Y.wear} patches of worn path` : ''}.`);
    if (Y.doors.length) lines.push(`By the doors: ${Y.doors.map(d => `${roomLabel(d.to) === d.to ? d.to : roomLabel(d.to)} (${SIDE_NAME[d.side]}): ${d.things.join(', ') || 'nothing'}`).join('; ')}.`);
    lines.push(`Plants: ${P.placed ? `${P.placed} placed from ${P.slot.join(', ')}` : P.slot.length ? 'slot has meshes but nothing fitted' : `slot empty: 2–4 bush/tree picks by the edges and doors will appear when plant meshes exist (waiting on ${P.waiting.join(', ') || 'catalog entries'})`}.`); }
  if (L.dorm) { const D = L.dorm; lines.push(`Dorm: ${D.wall + D.rowBeds} beds in ${D.rows + (D.wall ? 1 : 0)} rows (${D.wall} along the walls${D.rows ? ` + ${D.rowBeds} in ${D.rows} middle row${D.rows > 1 ? 's' : ''}, ${D.kind === 'double' ? 'head to head' : 'single'}, ${D.aisle}-ft aisles, ${D.feet} foot chests` : ''}).`); }
  if (L.zones.length) lines.push(`Zones (${L.zones.length}): ${L.zones.map(z => { const ids = z.items.map(u => L.placements.find(p => p.uid === u)?.id).filter(Boolean); const c = new Map(); ids.forEach(i => c.set(i, (c.get(i) || 0) + 1)); return `${z.label} (${[...c].map(([i, n]) => n > 1 ? `${i} ×${n}` : i).join(', ')})`; }).join('; ')}.`);
  if (L.anatomy && !L.yard) { const A = L.anatomy; lines.push(`Anatomy: ${A.companions} companions within reach, ${A.faces} working faces kept clear, ${A.dividers} screen${A.dividers === 1 ? '' : 's'} as dividers, ${A.likeWithLike} like-with-like.`); }
  if (L.growth?.length) lines.push(`Growth: ${L.growth.join('; ')}.`);
  if (L.rolls?.length) lines.push(`Rolls: ${L.rolls.join('; ')}.`);
  for (const c of L.checks.command) lines.push(`Command: ${c.label}: back ${mark(c.tortoise)} front ${mark(c.phoenix)} flanks ${mark(c.flanks)} door-view ${mark(c.doorView)}${c.blast ? ' (in the door\'s blast line)' : ''}.`);
  const D = L.checks.density;
  lines.push(`Density: ${D.value} props / 100 sq ft (target ${D.target}); ${L.placements.length} objects.`);
  if (L.unplaced.length) {
    const byWhy = new Map();
    for (const u of L.unplaced) { if (!byWhy.has(u.why)) byWhy.set(u.why, new Map()); const m = byWhy.get(u.why); m.set(u.id, (m.get(u.id) || 0) + 1); }
    lines.push(`Couldn't place (${L.unplaced.length}): ` + [...byWhy].map(([w, m]) => `${w}: ${[...m].map(([i, n]) => n > 1 ? `${i} ×${n}` : i).join(', ')}`).join('; ') + '.');
  }
  for (const n of L.notes) lines.push(`Note: ${n}.`);
  return lines.join('\n');
}

// ---------------- engine-neutral principle audit (scores v1 and v2 layouts the same way) ----------------
const KEY_RE = { guest: /^bed-/, fine: /^bed-/, privy: /^privy-seat/, desk: /^counter-shop/, common: /^fireplace-wall/, kitchen: /^cook-hearth/, storeroom: /^(shelving|cask-rack|wine-rack)/, cellar: /^(cask-rack|shelving|wine-rack|tun)/, stable: /^stable-stall(-partition|-gate)?$/, barn: /^(wagon|hay)/, hallway: null, yard: null };
export function audit(L, args) {
  const ctx = new Ctx2({ ...args, locked: [] });
  ctx.placements = L.placements;
  for (const p of L.placements) if (!p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall' && p.rule !== 'wall-mount') { const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot); ctx.mark(p.x, p.z, aw, ad); }
  const key = args.type.key, re = KEY_RE[key];
  const feature = re ? L.placements.find(p => re.test(p.id)) : null;
  const purpose = re ? !!feature : true;
  let visible = null;
  if (feature && ctx.mainDoor) {
    if (key === 'privy') visible = !ctx.inBlast(ctx.mainDoor, feature.x, feature.z, 0);
    else { const [fx, fz] = [Math.sin(feature.rot), Math.cos(feature.rot)], lx = -fz * feature.dims[0] * 0.4, lz = fx * feature.dims[0] * 0.4; visible = [[feature.x, feature.z], [feature.x + lx, feature.z + lz], [feature.x - lx, feature.z - lz]].some(pt => ctx.losClear(ctx.mainDoor.inner, pt, new Set([feature.uid])).ok); }
  }
  const cmd = [];
  for (const b of L.placements.filter(p => /^bed-/.test(p.id))) cmd.push(ctx.command('bed', b));
  const counter = L.placements.find(p => p.id === 'counter-shop');
  if (counter) { const k = L.placements.filter(p => /^chair/.test(p.id)).sort((a, b) => Math.hypot(a.x - counter.x, a.z - counter.z) - Math.hypot(b.x - counter.x, b.z - counter.z))[0]; if (k) cmd.push(ctx.command("keeper's chair", k)); }
  const settle = L.placements.find(p => p.id === 'settle'); if (settle) cmd.push(ctx.command('hearth settle', settle, { back: false, flanks: false }));
  // walkable: every door to every other door, and the main door to the key feature (3-ft clearance on the real furniture)
  const pass = ctx.passable(1.25), legs = [];
  for (let i = 0; i < ctx.doors.length; i++) for (let j = i + 1; j < ctx.doors.length; j++) legs.push([ctx.doors[i].inner, ctx.doors[j].inner]);
  if (feature && ctx.mainDoor && key !== 'privy') legs.push([ctx.mainDoor.inner, front(feature, 1.5)]);
  const walkable = legs.length ? legs.filter(([a, b]) => ctx.astar(pass, a, b)).length / legs.length : 1;
  const props = L.placements.filter(p => p.orient !== 'floor').length, density = props / ctx.area() * 100, target = DENSITY[key] ?? 7;
  const blast = cmd.filter(c => c.label === 'bed' && c.blast).length;
  const cmdScore = cmd.length ? cmd.reduce((a, c) => a + c.score, 0) / cmd.length : 1;
  const score = (purpose ? 100 : 0) + 20 * cmdScore + 15 * walkable + 10 * Math.min(1, density / target) + (visible === false ? -30 : 0) - 15 * blast;
  return { score: +score.toFixed(1), purpose, visible, walkable: +walkable.toFixed(2), command: +cmdScore.toFixed(2), density: +density.toFixed(1), coffin: blast };
}

// >>> ccm:solver2.common
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
  dunSight(ctx, altar);
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
// <<< ccm:solver2.common

// >>> ccm:solver2.crypt
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
  dunSight(ctx, focal);
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
  dunSight(ctx, key);
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
  dunSight(ctx, slab);
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
// <<< ccm:solver2.crypt

// >>> ccm:solver2.castle
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
  if (D) for (const shape of D.width >= 14.1 ? ['', 's2'] : ['s2']) table = table || castleOn(ctx, 'table-feast', D.p, ...axis(tS), toDoor, { sku: { shape }, layer: 'anchor', rule: 'key-high-table', why: 'the high table: on the dais, parallel to the end wall', extra: { focal: true } });
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
  dunSight(ctx, table);
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
  // the lower tables end to end in two rows (one under 24 ft across, on the side away from the hearth), a bench each side.
  // Blind reads (2026-10-06): light trestles with tankards on them were "common tables for patrons" and the hall "a tavern
  // common room or a castle mess hall". So the rows are the dark 10-ft feast tables where the hall is wide enough for two
  // rows of them (trestles in a narrow hall), set with a feast, benches both sides measured from the REAL meshes (the
  // tables are 3.5-4 ft deep, not the catalog's 2.5: no bench found room), and the royal runner lies down the aisle.
  // (NOT the 10-ft `table-feast--s2`: its top is green, and five of them were "gaming tables, likely for billiards")
  const rowSku = L >= 26 && ctx.skuPool('table-feast').some(k => k.shape === '') ? ['table-feast', { shape: '' }] : ['table-trestle', {}];
  const nomOf = (id, want) => { const pool = ctx.skuPool(id).filter(k => want.shape === undefined || k.shape === want.shape); return pool.map(k => ctx.nominalDims(id, k)).reduce((m, dm) => ({ w: Math.max(m.w, dm.w), d: Math.max(m.d, dm.d) }), { w: 0, d: 0 }); };
  const tN = nomOf(rowSku[0], rowSku[1]), bN = nomOf('bench-long', {}), tw = tN.w || ccmSize(ctx, rowSku[0])[0], tdp = tN.d || ccmSize(ctx, rowSku[0])[1], bdp = bN.d || 1.5;
  const off = 2.5 + 0.35 + bdp + 0.55 + tdp / 2, rows = L >= 2 * (off + tdp / 2 + 0.55 + bdp + 0.4) ? [-1, 1] : L >= off + tdp / 2 + 0.55 + bdp + 0.4 + 4 ? [(sideDoor ? d.side : hs) === lat[0] ? 1 : -1] : [];
  const trestles = [];
  for (const sg of rows) for (let s = footS + 1.2; s + tw <= deep - 3.5 + 1e-6;) { // (a table that meets the hearth's face or a door landing slides on a foot at a time)
    const [x, z] = axis(s + tw / 2, L / 2 + sg * off), t = castlePut(ctx, rowSku[0], [x, z, toDoor + Math.PI / 2], { sku: rowSku[1], layer: 'anchor', rule: 'trestle-row', why: 'the lower tables end to end down the hall' });
    if (!t) { s += 1; continue; }
    trestles.push(t); const sc = s + tw / 2; s += tw + 0.6;
    for (const bs of [-1, 1]) castlePut(ctx, 'bench-long', [0.55, 0.8, 1.05].map(g => { const [bx, bz] = axis(sc, L / 2 + sg * off + bs * (Math.min(t.dims[0], t.dims[2]) / 2 + g + bdp / 2)); return [bx, bz, Math.atan2(x - bx, z - bz)]; }), { rule: 'seat', why: 'a bench along the table', extra: { group: t.uid } });
  }
  if (trestles.length) ctx.growth.push(`trestles repeat: ${trestles.length} in ${rows.length} row${rows.length === 1 ? '' : 's'} down the hall`);
  { const [, rl] = ccmSize(ctx, 'rug-runner'); for (let s = footS + 0.4; s + rl <= deep - 0.3; s += rl) castleRug(ctx, 'rug-runner', ...axis(s + rl / 2), toDoor, { shape: 'royal' }, 'the runner: down the aisle from the door to the dais'); }
  // on the tables: linen, the high table's silver and a candelabrum; a feast on the lower tables (no tankards: that is the inn)
  ccmQuiet(ctx, () => ccmOn(ctx, 'tablecloth-white', table, 0, 0, 'linen on the high table'));
  for (const id of ['candelabra', 'salt-cellar-ship', ...ctx.pick(['goblet-silver', 'platter-silver', 'boar-head-platter', 'goblet-silver', 'pitcher', 'roast-pig'], 4)]) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'candelabra' ? 'light' : 'dress', why: 'on the high table' }));
  const FEAST = ['roast-pig', 'boar-head-platter', 'platter-silver', 'pie-meat', 'bread-loaf', 'plate-roast-veg', 'goblet-silver', 'goblet', 'pitcher', 'trencher-meal', 'drumstick', 'cheese-wheel-cut'];
  for (const t of trestles) { ccmQuiet(ctx, () => ctx.surface('candelabra', { on: s => s.uid === t.uid, layer: 'light', why: 'a candelabrum on the table' })); for (const id of ctx.pick(FEAST, 4)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === t.uid, why: 'the feast on the lower table' })); }
  // banner poles flanking the dais, armour by the door, shields and hangings on the long walls
  for (const sg of [-1, 1]) castlePut(ctx, 'banner-pole', [...axis(1.0, L / 2 + sg * ((D ? D.width : table.dims[0]) / 2 + 1.3)), toDoor], { rule: 'flank', why: 'a banner either side of the dais' });
  if (d) for (const sg of [-1, 1]) ccmQuiet(ctx, () => ctx.put('armor-stand', (dm) => ctx.wallGen(dm, [d.side]), (c) => Math.abs(c.t - (d.tc + sg * (d.width / 2 + 2.2))), { rule: 'by-door', why: 'a suit of armour either side of the door' }));
  castleHang(ctx, ['heraldic-shield'], [far], 1, { height: 7.0, why: 'the arms on the wall behind the high seat' });
  castleHang(ctx, ['banner-wall', 'tapestry'], [far], 2, { height: 5.8, why: 'banners behind the high table' });
  // (banners and tapestries only, one per 6 ft: shield displays and trophy heads were "weapon racks" and "framed pictures", a tavern's walls)
  castleHang(ctx, ['banner-wall', 'tapestry', 'banner-wall'], lat, Math.max(2, Math.round(deep / 6) * 2), { height: 5.8, why: 'banners and tapestries down the long walls' });
  ccmWallLights(ctx, CASTLE_TORCH_FINE, lat, { every: 13, height: 6.2, why: 'a torch every 10-15 ft of the long walls' });
  // (no chandelier over the aisle: from the table camera the 6-ft ring is "a wagon wheel on the floor", "a round floor grate"; the hall is lit by its hearth, torches and the candelabrum on the high table)
  for (const sg of [-1, 1]) castlePut(ctx, ccmFirst(ctx, ['candelabra-standing', 'torch-stand']), [...axis(footS - 0.4, L / 2 + sg * Math.min(L / 2 - 1.5, (D ? D.width : table.dims[0]) / 2 + 3.2)), toDoor], { layer: 'light', rule: 'flank', why: 'a standing light at each end of the dais step' });
  if (!hearth) castlePut(ctx, 'brazier-large', [0.5, 0.35, 0.65, 0.2, 0.8].flatMap(f => (rows.length === 1 ? [-rows[0]] : [1, -1]).flatMap(sg => [4, 5.5, 3.2].map(o => [...axis(footS + (deep - footS) * f, L / 2 + sg * o), 0]))), { layer: 'light', why: 'a brazier beside the aisle (no wall free for the hearth)' });
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
  dunSight(ctx, throne);
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
  const racks0 = ccmAlong(ctx, ['weapon-rack'], [...lat, far], 2, { why: 'weapon racks along the walls', layer: 'anchor' }); // (two before the kit by the door: the real racks are 5 ft wide and a 20-ft room ran out of wall)
  const kit = castleNear(ctx, ['mil-armor-repair-bench', 'grindstone', 'arrow-barrel', 'chest-ironbound', 'mil-shield-stack', ...(cells >= 20 ? ['arrow-barrel', 'mil-pavise'] : [])], doorSides, nearPt, { layer: 'store', why: 'kept by the door' });
  // racks: one per 5 ft of what wall is left
  const free = 2 * (ctx.W + ctx.D), racks = racks0.concat(ccmAlong(ctx, ['weapon-rack'], [...lat, far, ...(d ? [d.side] : [])], Math.max(0, Math.min(14, Math.round(free / 11)) - racks0.length), { why: 'weapon racks along the walls', layer: 'anchor' }));
  for (let k = racks.length + 1; k < 3; k++) if (!ccmQuiet(ctx, () => ctx.put('weapon-rack', (dm) => ctx.wallGen(dm, ['N', 'S', 'E', 'W']), () => 0, { layer: 'anchor', rule: 'wall-run', why: 'a narrow rack where the wide ones found no wall', sku: { shape: 's2' } }))) break; // (the real racks are 5 ft wide; the tall one is 3)
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
  // (2026-10-05: `door-cell-bars` was rejected at the mesh gate. Until it is re-made the cell door is the crypt's iron gate,
  // a 4-ft barred leaf in the 5-ft half of the front; one cell in five stands open: no leaf, the gap is the way in)
  const CELL_D = 10, cellDoor = ccmFirst(ctx, ['door-cell-bars', 'crypt-gate-iron']), withCells = area >= 300 && across >= 21 && ccmHas(ctx, 'cell-bars');
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
      const t = t0 + k * 10, flip = hash(ctx.baseSeed ?? ctx.room.seed, 'cell-door', k) % 2, twin = cellDoor === 'door-cell-bars' && ccmHas(ctx, 'door-cell-bars-open'), isOpen = (twin || cellDoor === 'crypt-gate-iron') && hash(ctx.baseSeed ?? ctx.room.seed, 'cell-open', k) % 5 === 0;
      const bars = piece('cell-bars', t + (flip ? 7.5 : 2.5), CELL_D + 0.45, rotIn, {}, 'the barred front of a cell');
      const door = !cellDoor || (isOpen && !twin) ? null : piece(isOpen ? 'door-cell-bars-open' : cellDoor, t + (flip ? 2.5 : 7.5), CELL_D + 0.45 + (isOpen ? 1.4 : 0), rotIn, {}, isOpen ? 'a cell door standing open' : 'the barred door of a cell') || piece(cellDoor, t + (flip ? 2.5 : 7.5), CELL_D + 0.45, rotIn, {}, 'the barred door of a cell');
      if (!bars && !door) continue;
      if (door?.id === 'door-cell-bars-open' || (isOpen && !door)) open++;
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
  if (d && feature) { ctx.sight = [d.inner, [feature.x, feature.z]]; ctx.sightFeature = feature.id;
    // (the doorway's view of it is kept: the real cage and pillory stand 5.5-6 ft, taller than their catalog lines, and put() judges tall by the catalog)
    const n = Math.ceil(Math.hypot(feature.x - d.inner[0], feature.z - d.inner[1]) / 1.5); for (let i = 1; i < n; i++) ctx.mark(d.inner[0] + (feature.x - d.inner[0]) * i / n, d.inner[1] + (feature.z - d.inner[1]) * i / n, 2.5, 2.5, KEEP); }
  // (the walk ends beside the rack, on the door's side of it; where the real rack, 3.6 ft wide, leaves no room between itself and that wall, on its other side)
  const rackSide = (sg) => { const a = rack.rot + Math.PI / 2, k = rack.dims[0] / 2 + 1.6; return [rack.x + Math.sin(a) * k * sg, rack.z + Math.cos(a) * k * sg]; };
  const rackSg = rack && d ? (((d.inner[0] - rack.x) * Math.sin(rack.rot + Math.PI / 2) + (d.inner[1] - rack.z) * Math.cos(rack.rot + Math.PI / 2)) >= 0 ? 1 : -1) : 1;
  if (d) { if (any) ccmWalk(ctx, 'approach', [d.inner, rack ? ([rackSg, -rackSg].map(rackSide).find(([x, z]) => ctx.wallDist(x, z) >= 1.4) || rackSide(rackSg)) : front(any, 1.8)]);
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
  if ((!a || Math.hypot(a[0] - b[0], a[1] - b[1]) < 8) && d) { a = d.inner; b = ctx.sidePoint(OPP_SIDE[d.side], d.tc, 1.6); } // (one gate, or two doors in the same corner: the line runs from the gate to the wall facing it)
  if (!a) return { fail: 'gatehouse has no gate' };
  const acrossW = d.side === 'N' || d.side === 'S' ? ctx.W : ctx.D, width = Math.max(4, Math.min(10, acrossW - 7));
  const path = ctx.walk('through', [a, b], { width });
  if (!path.ok) return { fail: 'gatehouse: the through-line from gate to gate is blocked' };
  // the worn way from gate to gate, on the floor (with nothing on the floor to say "through", two barred gates were a cell)
  if (ccmHas(ctx, 'decal-path-worn')) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]), rot = Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2, n = Math.max(1, Math.round(len / 5.2)); /* (the decal's long side is its width) */ for (let i = 0; i < n; i++) castleRug(ctx, 'decal-path-worn', a[0] + (b[0] - a[0]) * (i + 0.5) / n, a[1] + (b[1] - a[1]) * (i + 0.5) / n, rot, {}, 'the worn way from gate to gate'); }
  const sides = d ? [d.side, ...ccmLat(d.side)] : ['N', 'S', 'E', 'W'], lat = d ? ccmLat(d.side) : ['W', 'E'];
  const windlass = ccmQuiet(ctx, () => ctx.put('windlass', (dm) => ctx.wallGen(dm, sides), (c) => Math.hypot(c.x - d.inner[0], c.z - d.inner[1]) + (c.side === d.side ? 0 : 2), { layer: 'anchor', rule: 'key-windlass', why: 'the windlass: against the wall beside the outer gate', unique: true }));
  if (windlass) ccmQuiet(ctx, () => ctx.mount('lever-wall', { sides: [windlass.side], height: 5.2, why: 'the gate lever, by the windlass' }));
  // the bands either side: the guard table on one, fire and arms on the other
  const band = lat[ctx.ri(0, 1)], other = OPP_SIDE[band];
  // (the guard table only from 30 cells: with a table, a stool and dice the blind reads called every gatehouse a guardroom)
  const table = cells < 30 ? null : ccmQuiet(ctx, () => ctx.put('table-square', (dm) => ctx.wallGen(dm, [band], { gap: 1.2 }), (c) => Math.abs(c.t - ctx.sideLen(band) / 2), { rule: 'guard-table', why: 'the guard table, in the band beside the passage' }));
  if (table) { ccmQuiet(ctx, () => ctx.free(ccmAny(ctx, ['stool-three-leg', 'bench-long']), { near: [table.x, table.z], radius: 2.8, margin: 0.3, face: [table.x, table.z], rule: 'seat', why: 'a seat at the guard table' })); for (const id of ['mil-guard-lantern', 'dice-and-cup']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'mil-guard-lantern' ? 'light' : 'dress', why: 'on the guard table' })); }
  ccmQuiet(ctx, () => ctx.wall(ccmFirst(ctx, ['brazier-large', 'fire-basket-stand', 'brazier-standing']), { sides: [other], prefer: 'center', layer: 'light', gap: 0.6, why: 'a fire in the band beside the passage' }));
  // (under 24 cells: no arms at all. Racks, a spear tripod, a pavise and pegs made every small gatehouse "a castle guardroom or armory")
  const arms = (cells >= 24 ? ['mil-spear-tripod', 'arrow-barrel', 'mil-pavise', 'arrow-barrel', 'weapon-rack', 'armor-stand'] : []).filter(i => ccmHas(ctx, i));
  for (let k = 0, n = Math.min(arms.length, Math.max(2, Math.round(cells / 4))); k < n; k++) ccmQuiet(ctx, () => ctx.wall(arms[k], { sides: [k % 2 ? band : other, k % 2 ? other : band], layer: 'store', why: 'arms in the band beside the passage' }));
  if (Math.min(ctx.W, ctx.D) >= 14) ccmCorner(ctx, 'mil-boiling-oil-pot', [d.side, other], { why: 'the oil pot in the corner by the outer gate', layer: 'anchor', inset: 0.6 });
  castleHang(ctx, cells >= 24 ? ['mil-crossbow-rack', 'mil-helmet-peg-rack', 'horn-hunting', 'mil-duty-roster', 'heraldic-shield'] : ['heraldic-shield', 'horn-hunting'], lat, cells >= 24 ? Math.max(2, Math.round(cells / 6)) : 2, { height: 6.2, why: 'on the gatehouse wall' });
  ccmWallLights(ctx, CASTLE_TORCH, lat, { every: 18, min: 1, why: 'torch on the gatehouse wall' });
  ccmEnsureLight(ctx, CASTLE_TORCH, ['fire-basket-stand', 'brazier-standing']);
  ccmDone(ctx);
  return { feature: windlass || null, what: `a clear ${width.toFixed(0)}-ft way from gate to gate${windlass ? ', the windlass beside the outer gate' : ''}`, approach: null, passage: true };
}

// CASTLE CHAPEL: the shared chapel program. The one-step dais on the end wall with the altar on it, pews in rows facing
// it (a chapel too narrow for two blocks of 8-ft pews seats on the stone bench), font and candle rack by the door, no bier
const CASTLE_CHAPEL = {
  dais: ['dais'], altar: ['altar-stone'], altarGap: 3, aisle: 5, pitch: 5, backGap: 4, firstRow: 5, // (firstRow was 8: in a 25-ft chapel the one row then stood in the door's landing)
 
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
  const kp = KEY.kitchen(ctx);
  delete ctx.chooseSku;
  if (!kp?.fail) {
    // the service triangle is walked (and so kept clear) BEFORE the castle's pieces go down; attempt() walks it again for the record
    if (kp.triangle) { const n = ctx.paths.length, m = ctx.notes.length; ctx.walk('service', kp.triangle); if (kp.guest) ctx.walk('service', [kp.guest.inner, kp.triangle[1]]); ctx.paths.length = n; ctx.notes.length = m; }
    castleKitchenWorks(ctx);
  }
  return kp;
}
// What the castle adds to the inn's cooking triangle, before the zones (blind reads, 2026-10-06: the inn's kitchen alone in
// a 750-sq-ft room was named a workshop or a storeroom: four larder corners of sacks and baskets, and the bread oven is
// taken for a bellows). The cauldron on its crane in the open before the great hearth, the 10-ft table as the work row
// across the middle with the roast on it, the pig on its spit at the table's end, hams on the hook rail over the table,
// cupboards on the walls. Nothing here stands in an aisle or a working face: those are kept by the inn's program.
function castleKitchenWorks(ctx) {
  const hearth = ctx.placements.find(p => p.sku === 'cook-hearth-spit--great') || ctx.placements.find(p => p.id === 'cook-hearth-spit');
  if (!hearth) return;
  const box = [ctx.X0 + 1.5, ctx.Z0 + 1.5, ctx.X1 - 1.5, ctx.Z1 - 1.5], [fx, fz] = ctx.facingVec(hearth.rot), lx = fz, lz = -fx, near = (pt) => (c) => Math.hypot(c.x - pt[0], c.z - pt[1]);
  const open = (id, pt, rots, o = {}) => ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.rectGen(dm, box, rots, 1), near(pt), { layer: o.layer || 'furnish', rule: o.rule || 'castle-kitchen', why: o.why || '', sku: o.sku, failWhy: 'no room in the open floor' })) : null;
  const house = ctx.type.key === 'mansion-kitchen'; // (a house kitchen: no cauldron on a crane and no second chopping block. With them the mansion's was "an alchemist's workshop" 8 times in 8)
  const crane = house ? null : open('cauldron-crane', front(hearth, 6.5), [hearth.rot], { layer: 'light', rule: 'key-crane', why: 'the cauldron on its crane: in the open before the great hearth' });
  let table = ctx.area() >= 450 ? open('table-kitchen-prep', front(hearth, 12.5), [hearth.rot], { sku: { shape: 'great' }, layer: 'anchor', rule: 'work-row', why: 'the long work table: across the middle, parallel to the hearth' }) : null;
  table = table || ctx.placements.find(p => p.id === 'table-kitchen-prep') || null;
  if (table) {
    for (const id of ['roast-pig', 'fish-kettle', ...ctx.pick(['pie-meat', 'bread-loaf', 'bread-long-loaf', 'cabbage-single', 'cheese-wheel-cut', 'sausage-link', 'plate-roast-veg', 'pot-copper'], 4), ...ctx.pick(KITCHEN_WORK, 3)]) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, why: 'on the work table' }));
    const [tx, tz] = [Math.sin(table.rot + Math.PI / 2), Math.cos(table.rot + Math.PI / 2)], end = (sg, e) => [table.x + tx * sg * (table.dims[0] / 2 + e), table.z + tz * sg * (table.dims[0] / 2 + e)];
    const sg = ctx.chance(0.5) ? 1 : -1;
    open('pig-on-spit', end(sg, 4), [table.rot + Math.PI / 2, table.rot], { layer: 'light', rule: 'row-end', why: 'the pig on its spit: at the end of the work table' });
    if (!house) open('chopping-block-kitchen', end(-sg, 2), [table.rot], { rule: 'row-end', why: 'the chopping block at the other end of the table' });
    const inRoom = (x, z, m) => [Math.max(ctx.X0 + m, Math.min(ctx.X1 - m, x)), Math.max(ctx.Z0 + m, Math.min(ctx.Z1 - m, z))]; // (what hangs stays inside the walls, whatever the table's place)
    if (ccmHas(ctx, 'trade-butcher-hooks-rail')) ccmQuiet(ctx, () => ctx.ceiling('trade-butcher-hooks-rail', { at: inRoom(table.x - tx * sg * 2.5, table.z - tz * sg * 2.5, 3.2), layer: 'dress', why: 'the hook rail over the work table' }));
    for (const e of [1.5, -4.5]) if (ccmHas(ctx, 'ham-hanging')) ccmQuiet(ctx, () => ctx.ceiling('ham-hanging', { at: inRoom(table.x + tx * sg * e, table.z + tz * sg * e, 1.2), layer: 'dress', why: 'a ham hung over the work table' }));
  } else if (!crane && !house) open('pig-on-spit', front(hearth, 7), [hearth.rot], { layer: 'light', rule: 'row-end', why: 'the pig on its spit before the hearth' });
  ccmAlong(ctx, ['cupboard'], ['N', 'S', 'E', 'W'].filter(s => s !== hearth.side), ctx.area() >= 600 ? 3 : 2, { why: 'a cupboard of plate and pots on the wall', layer: 'store' });
  ctx.castleKitchenInfo = { crane: !!crane, table: table?.sku || null };
}
// the castle kitchen's fill: the inn's hung racks (half as many), the tables dressed with work in progress, one stack in a
// corner. Not the inn's larder runs along every free wall: sacks, baskets and barrels in number made the room a storeroom.
function castleKitchenFill(ctx) {
  const per = Math.max(3, Math.round((ctx.W + ctx.D) / 5));
  for (let k = 0, miss = 0; k < per && miss < 6; k++) { const id = ['utensil-rack-wall', 'knife-rack-wall', 'pot-hook-chain', 'garlic-braid', 'utensil-rack-wall', 'dish-rag-hanging'][k % 6]; if (!ctx.has(id) || !ccmQuiet(ctx, () => ctx.mount(id, { why: 'hung on a free run of wall', height: k % 2 ? 5.6 : 6.2 }))) miss++; }
  ccmQuiet(ctx, () => ctx.cornerPile(['barrel', 'sack', 'flour-sack-open', 'barrel'], 3, { why: 'a stack in the corner' }));
  for (const s of ctx.surfaces) { const want = /^table/.test(s.id) ? 8 : /^(chopping|counter|cupboard)/.test(s.id) ? 2 : 0; for (let i = s.items.length, tries = 0; i < want && tries < want + 3; tries++) if (ctx.surface(ctx.pick(KITCHEN_WORK)[0], { on: x => x === s, why: 'work in progress' })) i++; }
  ctx.unplaced = ctx.unplaced.filter(u => !/no room on the chosen surface|no bare wall|every corner already full|no free surface/.test(u.why));
}
Object.assign(KEY, { 'great-hall': castleGreatHall, 'throne-room': castleThrone, 'armoury': castleArmoury, 'barracks': castleBarracks, 'dungeon': castleDungeon, 'gatehouse': castleGatehouse, 'chapel': castleChapel, 'castle-kitchen': castleKitchen,
  'courtyard': castleCourtyard }); // (outdoor: needs the scope-castle hook in attempt(), `(KEY[key] || yard)(ctx)`)
Object.assign(MENUS, {
  // the inn's scullery, ONE larder corner and its serving pass (no bake corner: the bread oven reads as a bellows from above,
  // and the room as a forge; no prep island or staff table: the work row is laid by castleKitchenWorks), then the castle's own fill
  'castle-kitchen': [...MENUS.kitchen.filter(m => ['wash', 'larder', 'pass'].includes(m.kind)).map(m => ({ ...m, repeat: 1, per: undefined })), { kind: 'kitchen-fill', label: 'kitchen fill', size: [1, 1], minArea: 0, repeat: 1, quiet: true, pref: (ctx, r) => Math.hypot(r[0] - ctx.X0, r[1] - ctx.Z0), fill: (ctx) => castleKitchenFill(ctx) }],
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
// <<< ccm:solver2.castle

// >>> ccm:solver2.mansion
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
  dunSight(ctx, f);
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
  dunSight(ctx, T0);
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
  dunSight(ctx, bed);
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
// <<< ccm:solver2.mansion

// >>> buildings:solver2.halls
// ======================= hallways for the castle, the mansion and the crypt (2026-10-11) =======================
// Every building type has a hallway room: the whole-building generator's spine (docs/BUILDINGS.md; the inn's is KEY.hallway
// above, unchanged). One program, three tables. A corridor is what is LEFT after the rooms are placed, so it is dressed
// LIGHTLY and only from meshes the library already had:
//   the through-line first (door to door, kept clear);
//   a light about every 12 ft of length, the long walls in turn;
//   2 cells wide (10 ft): now and then one thing standing against a wall (a bench, a suit of armour, a console, an urn);
//   1 cell wide (5 ft): nothing stands on the floor at all, only hung things and lights;
//   a runner down the mansion's corridor; in the crypt a cobweb and, rarely, moss.
// It solves at 1 and 2 cells wide and 2..16 long (test/halls.test.mjs). The leg of an L-shaped corridor (ccmAnnex) gets the
// same dressing without a second through-line.
const HALLS = {
  'castle-passage': { stand: ['armor-stand', 'bench-long', 'chest-plain'], hung: ['banner-wall', 'tapestry', 'shield-display', 'weapon-rack'], lights: CASTLE_TORCH, floorLights: ['torch-stand'], hangEvery: 16 },
  'mansion-corridor': { stand: ['bench-upholstered', 'urn-decorative', 'pedestal-display', 'statue-bust'], console: true, hung: MANSION_PAINT, lights: MANSION_SCONCE, floorLights: [], hangEvery: 12, runner: 'rug-runner', lightHeight: 5.9 },
  'crypt-passage': { stand: ['bench-stone', 'urn-decorative'], hung: ['rite-memorial-plaque'], lights: CRYPT_TORCH, floorLights: CRYPT_STAND, hangEvery: 22, cobweb: true, standChance: 0.4 },
};
function hallDress(ctx, cfg, line = null) {
  const long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D) >= 8.5, along = ctx.W >= ctx.D;
  if (cfg.runner && line && Lr >= 14 && ccmHas(ctx, cfg.runner)) ccmQuiet(ctx, () => ctx.rug(cfg.runner, { at: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], rot: along ? Math.PI / 2 : 0, why: 'runner down the corridor' }));
  // now and then something against a wall, only where the corridor is two cells wide; the sides take turns
  let stood = 0;
  if (wide) for (let i = 0, n = Math.max(1, Math.round(Lr / 15)); i < n; i++) {
    if (!ctx.chance(cfg.standChance ?? 0.6)) continue;
    const side = long[i % 2], t = Lr * (i + 0.5) / n;
    if (cfg.console && Lr >= 14 && !stood && ctx.chance(0.6)) { if (mansionConsole(ctx, side, (i + 0.5) / n)) stood++; continue; }
    const id = ccmAny(ctx, cfg.stand); if (!id) break;
    if (ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [side], { tRange: [t - 4, t + 4] }), (c) => Math.abs(c.t - t), { layer: 'furnish', rule: 'hall-niche', why: 'against the wall, out of the through-line' }))) stood++;
  }
  // something to look at along the walls (hung: never in anyone's way)
  castleHang(ctx, cfg.hung, long, Math.max(Lr >= 9 ? 1 : 0, Math.round(Lr / cfg.hangEvery)), { why: 'on the corridor wall' });
  if (cfg.cobweb) { cryptCobweb(ctx); if (wide && ccmHas(ctx, 'decal-moss') && ctx.chance(0.3)) ccmQuiet(ctx, () => ctx.rug('decal-moss', { why: 'moss on the damp floor' })); }
  // a light about every 12 ft of corridor, the long walls in turn (a short stub: its end walls too)
  const sides = Lr >= 9 ? ctx.shuffle([...long]) : ctx.shuffle(['N', 'S', 'E', 'W']);
  ccmWallLights(ctx, cfg.lights, sides, { every: sides.length * 12, height: cfg.lightHeight || 6, min: 1, why: 'wall light along the corridor' });
  ccmEnsureLight(ctx, [...cfg.lights, 'torch-sconce'], wide ? cfg.floorLights : []);
  return stood;
}
function hallProgram(ctx) {
  const cfg = HALLS[ctx.type.key];
  ccmPanels(ctx);
  // one door, and it is in a LONG wall (the main run of an L-shaped corridor is entered from its leg; a dead-end spur off a
  // room): the line runs from that door down the corridor to its farther end, not 4 ft straight across it
  const d = ctx.doors.length === 1 ? ctx.doors[0] : null, Lr = Math.max(ctx.W, ctx.D);
  let end = null;
  if (d && Lr > Math.min(ctx.W, ctx.D) + 1 && ctx.longSides().includes(d.side)) {
    const pts = ctx.shortSides().map(s => ctx.sidePoint(s, ctx.sideLen(s) / 2, Math.min(2, Lr / 4))), at = d.inner || d.at;
    end = pts.sort((p, q) => Math.hypot(q[0] - at[0], q[1] - at[1]) - Math.hypot(p[0] - at[0], p[1] - at[1]))[0];
  }
  const line = throughLine(ctx, end);
  if (end) ctx.notes.pop(); // (throughLine's note says "to the counter")
  if (!line.path.ok) return { fail: 'corridor: the through-line is blocked' };
  const stood = hallDress(ctx, cfg, line);
  ctx.hallInfo = { stood, lit: ccmLit(ctx) };
  ccmDone(ctx);
  return { feature: null, what: 'a clear through-line', approach: null, passage: true };
}
for (const k of Object.keys(HALLS)) { KEY[k] = hallProgram; MENUS[k] = ccmAnnex((ctx) => hallDress(ctx, HALLS[k])); DENSITY[k] = 3.5; KEY_RE[k] = null; }
// <<< buildings:solver2.halls

// >>> tem:solver2
// ======================= temple & chapel (2026-10-11) =======================
// Ten room types (walls.js: the appended tem:walls block). The architecture and the furniture are flavor-NEUTRAL; every
// piece of iconography is one of six SLOT roles, `flavor-*` (catalog/objects-flavor.catalog.md, shared with the cult
// sanctum), whose skus are named for the flavor: `flavor-idol--sun`, `--moon`, `--devils`, `--spiders` ...
//   slot 1  flavor-altarpiece   on the altar, centred
//   slot 2  flavor-idol         the large statue: on the dais behind the altar, or the focus of a shrine
//   slot 3  flavor-banner       flat hangings on the side walls
//   slot 4  flavor-relief       wall medallion (stands in for a window motif)
//   slot 5  flavor-sigil        flat floor emblem: before the altar, in the chancel, under a shrine
//   slot 6  flavor-censer       floor candle-holder: the pair flanking the altar or the idol
//   slot 7  flavor-sculpture    a second showpiece that is not the idol: the door end of a nave, the head of a side aisle, a cloister
//   slot 8  flavor-buttress     a flying buttress in the flavor's motif (the vertical kit's `buttress` box): along the walls INSIDE a cathedral
// WHICH FLAVOR: the shared rule of the flavor block (flavorOf, written with the cult sanctum: `types:flavor` in this file)
// when it is here: room.flavor (the hook for Harry's flavor system), opts.flavor (the tuner's ?flavor=moon), the room's
// building, else the first of the room type's `flavors` (rooms.json) that has an idol. Until that block lands, the same
// rule without the building. A slot the flavor has no piece for is left empty; flavors are never mixed in one room.
const TEM_ALL = ['sun', 'moon', 'nature', 'sword-shield', 'devils', 'spiders', 'dragons', 'skulls', 'tentacles'];
function temFlavor(ctx) {
  const list = ctx.type.flavors || [];
  if (typeof flavorOf === 'function') return flavorOf(ctx, list);
  const ask = ctx.room.flavor || ctx.opts.flavor;
  if (ask && TEM_ALL.includes(ask)) return ask;
  return list.find(f => ctx.lib.objects['flavor-idol']?.skus.some(k => k.shape === f)) || list[0] || null;
}
// run a program with every `flavor-*` role rolled in this room's flavor only (and the one-step square dais, as the castle chapel)
function temWith(ctx, fn) {
  const f = temFlavor(ctx), roll = ctx.chooseSku, has0 = ctx.has;
  ctx.chooseSku = function (id, want = {}) {
    if (id === 'dais' && want.shape === undefined) return roll.call(this, id, { ...want, shape: 's2' });
    if (!/^flavor-/.test(id)) return roll.call(this, id, want);
    const sku = f ? roll.call(this, id, { ...want, shape: f }) : null;
    return sku && sku.shape === f ? sku : null;
  };
  ctx.has = function (id) { return /^flavor-/.test(id) ? !!f && !!this.lib.objects[id]?.skus.some(s => s.shape === f) : has0.call(this, id); };
  // a FLAT in the relief slot is a 34-in medallion, whatever box the role's carved tablets have
  ctx.dims = function (i, sku) { const dm = Object.getPrototypeOf(this).dims.call(this, i, sku); return i === 'flavor-relief' && sku?.kind === 'flat' ? { ...dm, w: 34 / 12, d: 0.05, h: 34 / 12 } : dm; };
  ctx.flavor = f;
  try { return fn(f); } finally { delete ctx.chooseSku; delete ctx.has; delete ctx.dims; }
}
const TEM_SCONCE = ['sconce-candle-triple', 'sconce-candle-single'], TEM_TORCH = ['torch-bracket-fine', 'torch-sconce', 'cresset-wall'];
const temRect = (ctx, far, t0, t1, s0, s1, val = KEEP) => { const [ax, az] = ctx.sidePoint(far, t0, s0), [bx, bz] = ctx.sidePoint(far, t1, s1); ctx.mark((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) || 0.1, Math.abs(bz - az) || 0.1, val); };
// ctx.dims for one call, then put back whatever was there (ccmScaled deletes the property, and with it temWith's)
function temDims(ctx, map, fn) { const own = Object.prototype.hasOwnProperty.call(ctx, 'dims'), d0 = ctx.dims; ctx.dims = function (i, sku) { return map(d0.call(this, i, sku), i, sku); }; try { return fn(); } finally { if (own) ctx.dims = d0; else delete ctx.dims; } }
const temMul = (dm, f) => ({ ...dm, w: dm.w * f, d: dm.d * f, h: dm.h * f, s: dm.s && dm.s.map(v => v * f) });
// one placement a hair under its catalog box (a 9-ft buttress under a 9-ft wall, whatever the size variety dial says)
const temUnder = (ctx, id, max, fn) => temDims(ctx, (dm, i) => i === id && dm.h > max ? temMul(dm, max / dm.h) : dm, fn);
// one placement at k times its size, inside the catalog's scale range (as ccmScaled)
const temScaled = (ctx, id, k, fn) => { const o = ctx.lib.objects[id]; return !o || k === 1 ? fn() : temDims(ctx, (dm, i) => { if (i !== id) return dm; const cat = Math.max(...o.size) / 12, big = Math.max(dm.w, dm.d, dm.h); return temMul(dm, Math.max(o.scale[0] * cat, Math.min(o.scale[1] * cat, big * k)) / big); }, fn); };
const temFace = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const temMount = (ctx, id, sides, n, height, why, layer = 'dress') => { let k = 0; for (let i = 0; i < n; i++) if (ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.mount(id, { sides: [sides[i % sides.length]], height, layer, why }))) k++; return k; };
const temWall = (ctx, ids, sides, o = {}) => { const id = Array.isArray(ids) ? ccmFirst(ctx, ids) : ccmHas(ctx, ids) ? ids : null; return id ? ccmQuiet(ctx, () => ctx.wall(id, { sides, layer: 'furnish', ...o })) : null; };
// the flat floor emblem (slot 5), `ft` feet across (the catalog lets it run 4 to 12 ft)
function temSigil(ctx, at, rot, ft, why) {
  if (!ccmHas(ctx, 'flavor-sigil')) return null;
  return temScaled(ctx, 'flavor-sigil', Math.max(0.5, Math.min(1.5, ft / 8)), () => ccmQuiet(ctx, () => ctx.rug('flavor-sigil', { at, rot, why })));
}
// what every temple room ends with: reliefs and banners (slots 4 and 3), wall lights, a light for certain
function temFinish(ctx, { relief = [], reliefN = 1, banner = [], bannerN = 0, lights = TEM_SCONCE, lightSides = ['N', 'S', 'E', 'W'], every = 13, floorLights = ['candlestick-floor', 'candle-tree'] } = {}) {
  if (relief.length) temMount(ctx, 'flavor-relief', relief, reliefN, 6.0, 'slot 4: the faith\'s medallion on the wall');
  if (banner.length) temMount(ctx, 'flavor-banner', banner, bannerN, 5.4, 'slot 3: a banner of the faith on the wall');
  ccmWallLights(ctx, lights, lightSides, { every, height: 5.8, min: 1, why: 'candle sconce on the wall' });
  ccmEnsureLight(ctx, TEM_TORCH, floorLights);
  ccmDone(ctx);
}
function temAnnex(ctx, { wall = ['bench-stone'], floor = [] } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']), n = Math.max(1, Math.round(ctx.area() / 110));
  temWith(ctx, () => { ccmAlong(ctx, wall, sides, n, { why: 'against the wall' }); for (const id of floor.slice(0, n)) temWall(ctx, id, sides, { why: 'against the wall' });
    temMount(ctx, 'flavor-relief', sides, 1, 6.0, 'slot 4: the faith\'s medallion'); ccmWallLights(ctx, TEM_SCONCE, sides, { every: 24, min: 1, why: 'candle sconce' }); ccmEnsureLight(ctx, TEM_TORCH, ['candlestick-floor', 'candle-tree']); });
}

// ---------------- NAVE (temple-nave, cathedral, cathedral-dark): the shared chapel() with the slots, scaled by size ----------------
//   chapel   under 30 ft deep: the altar on the end wall (no dais), two or three rows of seats, the idol in a corner or behind it
//   nave     from 30 ft deep: the one-step dais with the altar on it and the idol behind; from 34 ft a 9-ft chancel with
//            the sigil in its floor, a pulpit one side and the lectern the other
//   cathedral  from 34 ft across and 45 ft deep: two rows of columns (the arcade) with the seats between them and the side
//            aisles kept clear, a 15-ft chancel with choir stalls facing each other across the sigil, the organ and
//            confessionals at the door end
const TEM_NAVE = { altar: ['altar-stone'], aisle: 5, seats: ['pew', 'bench-stone'], altarFlank: ['flavor-censer', 'candelabra-standing', 'candle-tree', 'candlestick-floor'],
  altarLights: ['candlestick', 'candelabra'], altarThings: [], overAltar: 'rite-sanctuary-lamp', sconces: TEM_SCONCE, doorWallLights: TEM_TORCH };
function templeNave(ctx) { return temWith(ctx, (flavor) => {
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot;
  const axis = (s, t = L / 2) => ctx.sidePoint(far, t, s), aisle = TEM_NAVE.aisle, pewW = ccmSize(ctx, 'pew')[0], colW = 3.2 /* the real column is 3.1 ft across at its capital */, off = aisle / 2 + pewW + 0.7 + colW / 2;
  const big = L >= 34 && deep >= 45, mid = !big && deep >= 34 && L >= 19, useDais = deep >= 30 && L >= 14 && ccmHas(ctx, 'dais');
  const chancel = big ? 17 : mid ? 9 : deep >= 24 ? 5 : 4, altarGap = useDais ? 4.1 : deep >= 26 ? 4.1 : 1.5; // (the real moon idol is 3.7 ft deep: it stands between the wall and the altar)
  let cols = 0, organ = null, booths = 0, butts = 0, sculpt = 0;
  if (big) {
    if (ccmHas(ctx, 'pillar-round')) for (let s = 12; s <= deep - 7; s += 11) for (const sg of [-1, 1]) { const [x, z] = axis(s, L / 2 + sg * off); if (ccmQuiet(ctx, () => ccmAt(ctx, 'pillar-round', [x, z, toDoor], { layer: 'anchor', rule: 'colonnade', why: 'a column of the nave arcade: two rows, the seats between them, an aisle outside each' }))) cols++; }
    const dw = OPP_SIDE[far];
    if (ccmHas(ctx, 'organ-pipe')) organ = ccmQuiet(ctx, () => ctx.put('organ-pipe', (dm) => ctx.wallGen(dm, [dw], { gap: 0.05 }), (c) => Math.min(c.t, L - c.t), { layer: 'furnish', rule: 'organ', why: 'the organ: against the door wall, in a corner of the west end', unique: true }));
    for (const sg of [-1, 1]) { const near = axis(deep - 9, sg < 0 ? 0 : L); if (ccmHas(ctx, 'confessional') && ccmQuiet(ctx, () => ctx.put('confessional', (dm) => ctx.wallGen(dm, [lat[sg < 0 ? 0 : 1], dw], { gap: 0.05 }), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer: 'furnish', rule: 'confessional', why: 'a confessional against the aisle wall, near the door end' }))) booths++; }
    // slot 8: flying buttresses along the aisle walls, inside, one about every 20 ft (the plain kit buttress where the flavor has none)
    for (const sg of [-1, 1]) for (let s = 17.5; s <= deep - 12; s += 22) { const id = ccmFirst(ctx, ['flavor-buttress', 'buttress']), near = axis(s, sg < 0 ? 0 : L); if (id && temUnder(ctx, id, 8.98, () => ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [lat[sg < 0 ? 0 : 1]], { gap: 0.02 }), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer: 'anchor', rule: 'buttress', why: 'slot 8: a flying buttress against the aisle wall, inside' })))) butts++; }
    // slot 7: the sculpture at the head of each side aisle, facing down it
    for (const sg of [-1, 1]) { const [x, z] = axis(3.2, L / 2 + sg * (off + L / 2) / 2); if (ccmHas(ctx, 'flavor-sculpture') && ccmQuiet(ctx, () => ccmAt(ctx, 'flavor-sculpture', [[x, z, toDoor]], { layer: 'anchor', rule: 'sculpture', why: 'slot 7: the sculpture at the head of the side aisle' }))) sculpt++; }
    for (const sg of [-1, 1]) temRect(ctx, far, sg < 0 ? 0.2 : L / 2 + off, sg < 0 ? L / 2 - off : L - 0.2, 4, deep - 0.6); // the side aisles stay clear: no seats outside the columns
  }
  const tiny = !useDais && altarGap < 3; // a roadside chapel: no room to flank the altar, the idol takes one corner of the altar wall and a light the other
  const kp = chapel(ctx, { ...TEM_NAVE, ...(tiny ? { altarFlank: null } : {}), ...(useDais ? { dais: ['dais'] } : {}), altarGap, firstRow: chancel, pitch: deep >= 30 ? 4.6 : 4, backGap: deep >= 30 ? 5 : 3.5, maxRows: big ? 9 : 6,
    hung: flavor ? ['flavor-banner'] : [], hangMax: big ? 8 : 4, lectern: big || mid ? null : 'lectern', byDoor: [['font-holy', 0], ['rite-alms-box', 0], ['prayer-candle-rack', 28]] });
  if (kp.fail) return kp;
  const sideDoor = big && d && (d.side !== OPP_SIDE[far] || Math.abs(d.tc - L / 2) > 3); // (or off the axis: a door shared with a passage)
  if (sideDoor) { ctx.sight = null; ctx.sightFeature = null; } // entered from the side (a transept door): the arcade stands between the door and the altar, as it should
  const altar = kp.feature, dais = ctx.placements.find(p => p.id === 'dais') || null, base = dais || altar, frontS = (dais ? dais.dims[2] : altarGap + altar.dims[2]) + 0.05;
  // slot 1: the centrepiece on the altar (a chalice where the flavor has none)
  if (!ccmOn(ctx, 'flavor-altarpiece', altar, 0, 0.05, 'slot 1: the faith\'s emblem on the altar')) { const id = ccmAny(ctx, ['chalice-altar', 'tome-holy']); if (id) ccmOn(ctx, id, altar, 0, 0.05, 'on the altar'); }
  // slot 2: the idol behind the altar (on the dais where there is one), else in a corner of the altar wall
  let idol = null;
  if (ccmHas(ctx, 'flavor-idol')) temScaled(ctx, 'flavor-idol', dais ? 0.88 : 1, () => {
    const sk = ctx.chooseSku('flavor-idol'), dm = sk && ctx.dims('flavor-idol', sk);
    if (dm && altarGap >= 3 && dm.d + 0.2 <= altarGap && dm.h + (dais ? dais.dims[1] : 0) <= 9.0) { const [x, z] = axis(0.12 + dm.d / 2); idol = ctx.record('flavor-idol', sk, dm, x, dais ? dais.dims[1] : 0, z, toDoor, 'anchor', 'flavor-idol', 'slot 2: the idol behind the altar, against the end wall', { ...(dais ? { on: dais.uid } : {}), side: far, slot: 'idol' }); }
    else idol = ccmCorner(ctx, 'flavor-idol', [far, lat[0]], { why: 'slot 2: the idol in the corner beside the altar', inset: 0.5, layer: 'anchor' });
  });
  // slot 5: the sigil in the chancel floor, on the axis
  temSigil(ctx, axis(frontS + chancel / 2), toDoor, big ? 7.6 : mid ? 5.6 : 4, 'slot 5: the faith\'s emblem in the floor before the altar');
  // the chancel: choir stalls facing each other across the axis (cathedral), the pulpit one side and the lectern the other
  let stalls = 0;
  if (big && ccmHas(ctx, 'rite-choir-stall')) { const [sl, sd] = ccmSize(ctx, 'rite-choir-stall'); for (const sg of [-1, 1]) { const [x, z] = axis(frontS + 2 + sl / 2, L / 2 + sg * (4.2 + sd / 2)), [ax, az] = axis(frontS + 2 + sl / 2);
    if (ccmQuiet(ctx, () => ccmAt(ctx, 'rite-choir-stall', [[x, z, temFace(x, z, ax, az)]], { layer: 'furnish', rule: 'choir', why: 'choir stalls facing each other across the chancel' }))) stalls++; } }
  const beside = (id, sg) => { if (!ccmHas(ctx, id)) return null; const sk0 = ctx.skuPool(id)[0], dm0 = sk0 && ctx.dims(id, sk0), [w, dd] = dm0 ? [dm0.w, dm0.d] : ccmSize(ctx, id) /* (real meshes are stouter than their catalog lines) */, half = base.dims[0] / 2, spots = [];
    for (const [s0, lc] of [[frontS + 0.9, aisle / 2 + 4.6 + w / 2], [frontS + 10.2, aisle / 2 + 1.2 + w / 2], [frontS + 5.4, aisle / 2 + 4.6 + w / 2], [frontS + 0.9, half + 0.6 + w / 2], [frontS + 0.9, aisle / 2 + 1 + w / 2], [0.8, half + 2.6 + w / 2], [frontS + 3.5, aisle / 2 + 1 + w / 2], [frontS + 8.5, aisle / 2 + 2 + w / 2]]) { if (L / 2 - lc - w / 2 < 0.4) continue; const [x, z] = axis(s0 + dd / 2, L / 2 + sg * lc); spots.push([x, z, toDoor]); }
    return spots.length ? ccmQuiet(ctx, () => ccmAt(ctx, id, spots, { layer: 'furnish', rule: 'chancel', why: `the ${id}: at the chancel step, turned to the seats` })) : null; };
  const pulpit = big || mid ? beside('pulpit', -1) : null; if (big || mid) beside('lectern', 1);
  // slot 4: medallions on the end wall either side of the idol (one on the door wall of a small chapel)
  temMount(ctx, 'flavor-relief', L >= 19 ? [far] : [OPP_SIDE[far]], L >= 19 ? 2 : 1, 6.2, 'slot 4: the faith\'s medallion on the wall');
  if (big) for (const sg of [-1, 1]) { const id = ccmFirst(ctx, ['candle-tree', 'candelabra-standing']), [x, z] = axis(frontS + 1.2, L / 2 + sg * (off - 2.2)); if (id) ccmQuiet(ctx, () => ccmAt(ctx, id, [[x, z, toDoor]], { layer: 'light', rule: 'chancel-light', why: 'a tall light at the chancel step' })); }
  if (!big && deep >= 24 && d && ccmHas(ctx, 'flavor-sculpture') && ccmQuiet(ctx, () => ctx.wall('flavor-sculpture', { sides: [d.side], prefer: 'corner', layer: 'anchor', rule: 'sculpture', why: 'slot 7: the sculpture at the door end, in a corner' }))) sculpt++;
  ctx.templeInfo = { buttresses: butts, sculptures: sculpt, flavor, scale: big ? 'cathedral' : mid ? 'nave' : 'chapel', columns: cols, stalls, organ: !!organ, booths, dais: !!dais, idol: idol ? (idol.on ? 'dais' : idol.rule === 'corner' ? 'corner' : 'floor') : null, pulpit: !!pulpit, seats: ctx.chapelInfo?.seats || 0 };
  if (cols) ctx.growth.push(`${cols} columns in two rows`);
  // a chapel too narrow for seats either side of the aisle: benches along the side walls instead
  if (!ctx.chapelInfo?.seats) { const b = [], id = ccmFirst(ctx, ['bench-stone', 'bench-long']); for (let k = 0; id && k < 4 && b.length < (deep >= 24 ? 4 : 2); k++) { const near = axis(deep * (k < 2 ? 0.55 : 0.8), k % 2 ? L : 0), p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [lat[k % 2]], { gap: 0.05, windows: false }), (c) => Math.hypot(c.x - near[0], c.z - near[1]), { layer: 'furnish', rule: 'pew', why: 'a bench along the side wall, facing the aisle (a low seat may stand under a window)' })); if (p) b.push(p); } if (ctx.chapelInfo) ctx.chapelInfo.seats = b.length; }
  if (tiny) ccmCorner(ctx, ccmFirst(ctx, ['flavor-censer', 'candelabra-standing', 'candle-tree', 'candlestick-floor']), [far, lat[1]], { why: 'slot 6: a tall light in the other corner of the altar wall', layer: 'light', inset: 0.4 });
  return { ...kp, ...(sideDoor ? { feature: null } : {}), what: `${kp.what}${cols ? `, ${cols} columns` : ''}${flavor ? `, dressed for the ${flavor}` : ''}` };
}); }

// ---------------- SHRINE / side chapel: the idol (slot 2) is the focus, facing the door ----------------
function templeShrine(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  let focus = ccmFocalOn(ctx, far, ['flavor-idol'], { label: 'idol', rule: 'key-idol', gap: 0.15, why: 'slot 2: the idol, centred on the wall facing the door' }), altar = null;
  if (!focus) focus = altar = ccmFocalOn(ctx, far, ['altar-stone'], { label: 'altar', rule: 'key-altar', gap: 0.3 });
  if (!focus) return { fail: `shrine has no idol and no altar (${ctx.focal?.why || 'no mesh'})` };
  if (d) { ctx.sight = [d.inner, [focus.x, focus.z]]; ctx.sightFeature = focus.id; }
  // (tried on 2026-10-12: a small altar before the idol. The blind judge then called the shrine a dining room; without it
  // the sun idol between its two stands is 'a sun-themed chapel' or 'a sun-themed throne room' by turns. Left as it was.)
  const fs = 0.3 + focus.dims[2];
  { const [ax, az] = axis((fs + deep) / 2), horiz = far === 'N' || far === 'S'; ctx.mark(ax, az, horiz ? 3 : deep - fs, horiz ? deep - fs : 3, KEEP); }
  if (d) { ccmWalk(ctx, 'approach', [d.inner, axis(Math.min(deep - 2, fs + 2.4))], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(deep - 2.5)]); }
  ccmFlank(ctx, focus, ['flavor-censer', 'rite-pillar-candle-tall', 'candelabra-standing', 'candlestick-floor'], { off: 0.7, why: 'slot 6: one each side of the idol' });
  if (altar) { for (const e of [-0.36, 0.36]) ccmOn(ctx, ccmFirst(ctx, ['candlestick', 'candelabra']), altar, e, 0, 'on the altar', 'light'); ccmOn(ctx, ccmFirst(ctx, ['flavor-altarpiece', 'chalice-altar']), altar, 0, 0.05, 'on the altar'); }
  const sig = Math.max(4, Math.min(8, L - 5, deep - fs - 4));
  temSigil(ctx, axis(fs + 0.8 + sig / 2), toDoor, sig, 'slot 5: the faith\'s emblem in the floor before the idol');
  // kneeling desks either side of the approach, facing the idol; cushions before it
  if (ccmHas(ctx, 'rite-prie-dieu')) { const [pw, pd] = ccmSize(ctx, 'rite-prie-dieu'); for (const sg of L >= 14 ? [-1, 1] : [1]) { const [x, z] = axis(fs + 2.2 + pd / 2, L / 2 + sg * (1.7 + pw / 2)); ccmQuiet(ctx, () => ccmAt(ctx, 'rite-prie-dieu', [[x, z, toDoor]] /* (its front is the side you kneel at: orient.json) */, { rule: 'kneeler', why: 'a kneeling desk before the idol, beside the approach' })); } }
  // the side walls: the candle rack and the sand tray near the idol, a stone bench nearer the door; the alms box by the door
  temWall(ctx, ['prayer-candle-rack', 'rite-memorial-sand-tray'], [lat[0]], { prefer: 'near', near: axis(2.5, 0), layer: 'light', why: 'offering candles against the side wall, near the idol' });
  temWall(ctx, ['rite-memorial-sand-tray', 'candle-drippings-mound'], [lat[1]], { prefer: 'near', near: axis(2.5, L), layer: 'light', why: 'memorial candles against the side wall' });
  if (deep >= 19) for (const k of [0, 1]) temWall(ctx, 'bench-stone', [lat[k]], { prefer: 'near', near: axis(deep - 5, k ? L : 0), why: 'a bench against the side wall' });
  if (d) temWall(ctx, 'rite-alms-box', [d.side, ...lat], { prefer: 'near', near: d.inner, why: 'the alms box by the door' });
  ctx.templeInfo = { flavor, focus: focus.id };
  temFinish(ctx, { banner: lat, bannerN: Math.max(2, Math.round(deep / 9)), lightSides: lat });
  if (!temMount(ctx, 'flavor-relief', [OPP_SIDE[far]], 1, 6.0, 'slot 4: the faith\'s medallion on the door wall')) temMount(ctx, 'flavor-relief', lat, 2, 6.0, 'slot 4: the faith\'s medallion on a side wall');
  return { feature: focus, what: `${altar ? 'altar' : 'idol'} facing the door${flavor ? `, dressed for the ${flavor}` : ''}`, approach: null, passage: true };
}); }

// ---------------- VESTRY: the robes on their stands along the wall facing the door, the vessels on a table ----------------
function templeVestry(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  const robe0 = ccmFocalOn(ctx, far, ['rite-vestments-stand'], { label: 'vestments', rule: 'key-vestments', gap: 0.2, why: 'the vestments on their stand: centred on the wall facing the door' });
  const robe = robe0 || temWall(ctx, 'rite-vestments-stand', [...lat, far, OPP_SIDE[far]], { layer: 'anchor', rule: 'key-vestments', why: 'the vestments on their stand, against the wall' }); // (a door in the middle of the facing wall)
  if (!robe) return { fail: `vestry has no vestments (${ctx.focal?.why || 'no mesh'})` };
  if (!robe0) ctx.focal = { label: 'vestments', id: robe.id, ok: true };
  if (d) { ctx.sight = [d.inner, [robe.x, robe.z]]; ctx.sightFeature = robe.id; }
  // (blind read: three robes in a row are a tailor's shop. ONE more at most, and the church's own things round them)
  const more = L >= 13 && robe0 ? ccmFlank(ctx, robe, ['rite-vestments-stand'], { off: 0.9, layer: 'furnish', why: 'a second set of vestments', n: 1 }) : [];
  if (robe0) ccmFlank(ctx, robe, ['rite-pillar-candle-tall', 'candlestick-floor'], { off: more.length ? 4.2 : 0.8, why: 'a tall candle each side of the vestments' });
  temWall(ctx, 'rite-prie-dieu', [lat[1], lat[0]], { prefer: 'near', near: axis(2.5, L), rule: 'kneeler', why: 'the priest\'s kneeling desk, where he prepares' });
  temWall(ctx, ['font-holy', 'washstand'], [lat[0], lat[1]], { prefer: 'near', near: axis(2.5, 0), why: 'the basin where the vessels are washed' });
  // the vesting table against a SIDE wall with the vessels on it (live blind reads, 2026-10-12: in the middle of the room,
  // before a robe on its stand, it was a lord's desk with a high-backed chair behind it)
  let table = null;
  { const id = ccmFirst(ctx, deep >= 16 ? ['table-trestle', 'table-square'] : ['table-square']); if (id) table = ccmQuiet(ctx, () => ctx.wall(id, { sides: [lat[0], lat[1]], prefer: 'near', near: axis(deep * 0.55, 0), layer: 'furnish', rule: 'vesting-table', why: 'the vesting table against the side wall' })); }
  if (table) { for (const id of ['flavor-altarpiece', 'chalice-altar', 'tome-holy', 'candelabra', 'reliquary']) if (ccmHas(ctx, id)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: id === 'candelabra' ? 'light' : 'dress', why: 'laid out on the vesting table' })); }
  if (d) ccmWalk(ctx, 'approach', [d.inner, axis(robe.dims[2] + 2.2)]);
  const n = Math.max(2, Math.round(ctx.area() / 60));
  ccmAlong(ctx, ['chest-plain', 'chest-ironbound', 'cupboard'], lat, n, { why: 'vestment chests and cupboards along the side walls' });
  temWall(ctx, ['scroll-rack', 'wardrobe'], [...lat, OPP_SIDE[far]], { why: 'against the wall' });
  ccmCorner(ctx, ccmFirst(ctx, ['candle-tree', 'candlestick-floor']), [far, lat[0]], { why: 'a light in the corner', layer: 'light' });
  ctx.templeInfo = { flavor, stands: 1 + more.length, table: !!table };
  temFinish(ctx, { relief: [OPP_SIDE[far]], banner: lat, bannerN: 2, lightSides: lat });
  return { feature: robe, what: `${1 + more.length} sets of vestments${table ? ', the vesting table' : ''}`, approach: null, passage: true };
}); }

// ---------------- CLOISTER WALK (the type's passage): a row of columns down one side, benches down the other ----------------
function templeCloister(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), across = Math.min(ctx.W, ctx.D), horiz = long[0] === 'N' || long[0] === 'S';
  const colSide = long.slice().sort((a, b) => ctx.doorT[a].length - ctx.doorT[b].length)[0], benchSide = OPP_SIDE[colSide], mid = (t) => ctx.sidePoint(colSide, t, across / 2);
  // the walk: a clear line down the middle from end to end, every door joined to it
  { const [mx, mz] = mid(Lr / 2); ctx.mark(mx, mz, horiz ? Lr : 3, horiz ? 3 : Lr, KEEP); }
  const ds = ctx.doors; if (ds.length >= 2) ccmWalk(ctx, 'through', [ds[0].inner, mid(Lr / 2), ds[1].inner]); else if (ds[0]) ccmWalk(ctx, 'through', [ds[0].inner, mid(Lr / 2)]);
  for (const o of ds.slice(2)) ccmWalk(ctx, 'branch', [o.inner, mid(Lr / 2)]);
  let cols = 0; const colId = ccmFirst(ctx, ['pillar-round', 'pillar-square']);
  if (colId && across >= 9) for (let t = 2.5; t <= Lr - 2.4; t += 7.5) { const [x, z] = ctx.sidePoint(colSide, t, 1.7); if (ccmQuiet(ctx, () => ccmAt(ctx, colId, [[x, z, SIDES[colSide].rot]], { layer: 'anchor', rule: 'colonnade', why: 'the cloister arcade: a row of columns down one side of the walk' }))) cols++; }
  const benches = ccmAlong(ctx, ['bench-stone'], [benchSide], Math.max(1, Math.round(Lr / 13)), { why: 'a stone bench against the wall of the walk' });
  for (const s of ctx.shortSides()) ccmCorner(ctx, ccmFirst(ctx, ['urn-decorative', 'planter-stone']), [s, benchSide], { why: 'an urn in the corner' });
  temWall(ctx, 'flavor-sculpture', [benchSide], { prefer: 'near', near: ctx.sidePoint(benchSide, Lr / 2, 0), layer: 'anchor', rule: 'sculpture', why: 'slot 7: the sculpture against the wall, half way down the walk' });
  if (across >= 13) temSigil(ctx, mid(Lr / 2), SIDES[colSide].rot, Math.min(6, across - 8), 'slot 5: the faith\'s emblem in the floor of the walk');
  const d0 = ctx.mainDoor, colsP = ctx.placements.filter(p => p.rule === 'colonnade'), key = (d0 && colsP.length ? colsP.reduce((a, b) => Math.hypot(a.x - d0.inner[0], a.z - d0.inner[1]) <= Math.hypot(b.x - d0.inner[0], b.z - d0.inner[1]) ? a : b) : colsP[0]) || benches[0] || null;
  ctx.templeInfo = { flavor, columns: cols, benches: benches.length };
  temFinish(ctx, { relief: [benchSide], reliefN: Math.max(1, Math.round(Lr / 20)), lights: TEM_TORCH, lightSides: [benchSide, ...ctx.shortSides()], every: 16, floorLights: ['torch-stand', 'candlestick-floor'] });
  return { feature: key, what: `a walk with ${cols} columns and ${benches.length} benches`, approach: null, passage: true };
}); }

// ---------------- SCRIPTORIUM: copying desks in rows facing the lectern ----------------
function templeScriptorium(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  if (!ccmHas(ctx, 'scriptorium-desk')) return { fail: 'scriptorium has no copying desk (no mesh)' };
  const lect = ccmFocalOn(ctx, far, ['lectern', 'spellbook-lectern'], { label: 'lectern', rule: 'reader', gap: 0.8, why: 'the reader\'s lectern: centred on the wall the desks face' });
  { const [ax, az] = axis((2 + deep) / 2), horiz = far === 'N' || far === 'S'; ctx.mark(ax, az, horiz ? 3 : deep - 2, horiz ? deep - 2 : 3, KEEP); }
  if (d) { ccmWalk(ctx, 'aisle', [d.inner, axis(deep - 2.5), axis(3.6)], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, axis(deep - 2.5)]); }
  const [, dd] = ccmSize(ctx, 'scriptorium-desk');
  const ranks = ccmRanks(ctx, { far, s0: 4.8, s1: deep - 3.6, gap: 2.4, aisle: 4, margin: 1.2, turn: Math.PI /* (a desk's front is its seat side: the scribes face the reader) */, proto: 'scriptorium-desk', choose: () => 'scriptorium-desk', rule: 'desk', layer: 'anchor', why: 'copying desks in rows, facing the reader' });
  if (!ranks.placed.length) return { fail: 'scriptorium has no room for a copying desk' };
  ctx.growth.push(`${ranks.placed.length} desks in ${ranks.rows} rows`);
  if (d) { ctx.sight = [d.inner, [ranks.placed[0].x, ranks.placed[0].z]]; ctx.sightFeature = 'scriptorium-desk'; }
  ccmAlong(ctx, ['scroll-rack', 'cupboard', 'chest-plain'], lat, Math.max(2, Math.round(deep / 6)), { why: 'scrolls and books along the side walls' });
  for (const s of lat) ccmCorner(ctx, ccmFirst(ctx, ['candle-tree', 'lamp-pole', 'candlestick-floor']), [far, s], { why: 'a tall light in the corner by the reader', layer: 'light' });
  if (lect) ccmOn(ctx, ccmFirst(ctx, ['tome-holy', 'book-open']), lect, 0, 0, 'the book being read aloud');
  ctx.templeInfo = { flavor, desks: ranks.placed.length };
  temFinish(ctx, { relief: [OPP_SIDE[far]], lightSides: lat, every: 11 });
  return { feature: ranks.placed[0], what: `${ranks.placed.length} copying desks in ${ranks.rows} rows`, approach: null, passage: true };
}); }

// ---------------- INFIRMARY: beds head to the wall down the long walls, the healer's end ----------------
function templeInfirmary(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, long = ctx.longSides(), short = ctx.shortSides(), across = Math.min(ctx.W, ctx.D), Lr = Math.max(ctx.W, ctx.D), horiz = long[0] === 'N' || long[0] === 'S';
  const bedId = ccmFirst(ctx, ['bed-single', 'cot', 'sickbed']) /* (blind reads, 2026-10-12: the cots are green-topped tables from above and the room a barracks mess; the made bed with its pillow is a bed. The real sickbed mesh is 6.5 ft square) */; if (!bedId) return { fail: 'infirmary has no bed (no mesh)' };
  const [, bd] = ccmSize(ctx, bedId), both = across >= 2 * bd + 4, walls = both ? long : [d && long.includes(OPP_SIDE[d.side]) ? OPP_SIDE[d.side] : long[0]];
  const aisleO = both ? across / 2 : (bd + across) / 2 + 0.3, dd = (sd) => d ? Math.hypot(...ctx.sidePoint(sd, across / 2, 0).map((v, i) => v - d.inner[i])) : 0, end = short.slice().sort((a, b) => ctx.doorT[a].length - ctx.doorT[b].length || dd(b) - dd(a))[0] /* the healer's end: the short wall with no door, the one farther from the way in */, endAt = (t, s) => ctx.sidePoint(end, t, s);
  { const [ax, az] = ctx.sidePoint(walls[0], Lr / 2, aisleO); ctx.mark(ax, az, horiz ? Lr : 3, horiz ? 3 : Lr, KEEP);
    for (const o of ctx.doors) { const pr = horiz ? [Math.max(ctx.X0 + 2, Math.min(ctx.X1 - 2, o.inner[0])), az] : [ax, Math.max(ctx.Z0 + 2, Math.min(ctx.Z1 - 2, o.inner[1]))]; ctx.mark((o.inner[0] + pr[0]) / 2, (o.inner[1] + pr[1]) / 2, Math.abs(o.inner[0] - pr[0]) + 3, Math.abs(o.inner[1] - pr[1]) + 3, KEEP); } }
  // the healer's end first: the drawers on the end wall, the treatment bench before them lying across the room
  const drawers = ccmFocalOn(ctx, end, ['apothecary-drawers', 'cupboard'], { label: 'drawers', rule: 'apothecary', layer: 'furnish', gap: 0.1, why: 'the apothecary\'s drawers: centred on the end wall' });
  // the treatment bench: in the MIDDLE of the ward, along the aisle, where the room is wide enough to walk past it on both
  // sides (blind reads, 2026-10-12: beds in two rows with the bench at the end were a dormitory); else before the drawers
  let bench = null, mid = across - 2 * bd >= 9.4;
  if (ccmHas(ctx, 'trade-treatment-bench') && Lr >= 20) { const [x, z] = mid ? ctx.sidePoint(walls[0], Lr / 2, aisleO) : endAt(across / 2, (drawers ? drawers.dims[2] : 0) + 4.3);
    if (mid || !ctx.doors.some(o => Math.hypot(o.inner[0] - x, o.inner[1] - z) < 9)) bench = ccmQuiet(ctx, () => ccmAt(ctx, 'trade-treatment-bench', [[x, z, SIDES[end].rot + (mid ? 0 : Math.PI / 2)]], { layer: 'anchor', rule: 'treatment', why: mid ? 'the treatment bench: in the middle of the ward, a way past it on each side' : 'the treatment bench: before the drawers, with room to work on both sides', allowKeep: true })); }
  // the healer's table by the drawers, with the basin and the tinctures on it
  let htable = null; if (ccmHas(ctx, 'table-square') && Lr >= 24) { const [x, z] = endAt(across / 2, (drawers ? drawers.dims[2] : 0) + 3.2); htable = ccmQuiet(ctx, () => ccmAt(ctx, 'table-square', [[x, z, SIDES[end].rot]], { rule: 'healer-table', why: 'the healer\'s table before the drawers', allowKeep: true })); }
  if (htable) for (const id of ['trade-fever-basin', 'trade-tincture-rack', 'mortar-pestle', 'candlestick']) if (ccmHas(ctx, id)) ccmQuiet(ctx, () => ctx.surface(id, { on: q => q.uid === htable.uid, layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the healer\'s table' }));
  if (bench) ccmClearRound(ctx, bench, 1.4);
  const beds = [];
  for (const side of walls) for (let t = 3; t <= Lr - 2.6; t += 6.5) { const b = ccmQuiet(ctx, () => ctx.put(bedId, (dm) => ctx.wallGen(dm, [side], { tRange: [t - 1.2, t + 1.2] }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'sickbed', why: 'a sickbed, head to the wall, one about every 6.5 ft: room for the healer between them' })); if (b) beds.push(b); }
  if (!beds.length) { const b = ccmQuiet(ctx, () => ctx.wall(bedId, { layer: 'anchor', rule: 'sickbed', why: 'a sickbed against the wall' })); if (b) beds.push(b); }
  if (!beds.length) return { fail: 'infirmary has no bed (no wall run clear of the doors)' };
  ctx.growth.push(`${beds.length} beds along ${walls.length === 2 ? 'both long walls' : 'one long wall'}`);
  if (d) { // the aisle walk stops short of the healer's end (the bench lies across it)
    const zone = (drawers ? drawers.dims[2] : 0) + (htable ? 3.2 + htable.dims[2] / 2 + 2 : bench && !mid ? 4.3 + bench.dims[0] / 2 + 2.2 : 2.5), ec = endAt(across / 2, 0), P = [2.5, Lr - 2.5].map(t => ctx.sidePoint(walls[0], t, aisleO)), nearEnd = Math.hypot(P[0][0] - ec[0], P[0][1] - ec[1]) < Math.hypot(P[1][0] - ec[0], P[1][1] - ec[1]) ? 0 : 1;
    P[nearEnd] = ctx.sidePoint(walls[0], nearEnd ? Lr - Math.max(2.5, zone) : Math.max(2.5, zone), aisleO);
    for (const p of P) ccmWalk(ctx, 'aisle', [d.inner, p]); }
  const key = d ? beds.reduce((a, b) => Math.hypot(a.x - d.inner[0], a.z - d.inner[1]) <= Math.hypot(b.x - d.inner[0], b.z - d.inner[1]) ? a : b) : beds[0];
  beds.forEach((b, i) => { if (ccmHas(ctx, 'stool-three-leg')) { const [fx, fz] = ctx.facingVec(b.rot), lx = fz, lz = -fx; ccmQuiet(ctx, () => ccmAt(ctx, 'stool-three-leg', [1, -1].map(sg => [b.x + lx * sg * (b.dims[0] / 2 + 0.9) - fx * (b.dims[2] / 2 - 1.2), b.z + lz * sg * (b.dims[0] / 2 + 0.9) - fz * (b.dims[2] / 2 - 1.2), b.rot]), { rule: 'bedside', why: 'a stool at the bedside' })); } });
  if (d) temWall(ctx, ['washstand', 'chest-plain'], [d.side, ...ccmLat(d.side)], { prefer: 'near', near: d.inner, why: 'a washstand by the door' });
  temMount(ctx, 'basin-stone', [end, ...long], 1, 3.2, 'a stone basin on the wall');
  for (let k = 0, n = Math.max(1, Math.round(Lr / 16)); k < n; k++) if (ccmHas(ctx, 'lantern-hanging')) ctx.ceiling('lantern-hanging', { at: ctx.sidePoint(walls[0], Lr * (k + 0.5) / n, aisleO), why: 'a lantern over the aisle' });
  ctx.templeInfo = { flavor, beds: beds.length, walls: walls.length, bench: !!bench, drawers: !!drawers };
  temFinish(ctx, { relief: [OPP_SIDE[end]], lightSides: short, every: 18 });
  return { feature: key, what: `${beds.length} sickbeds${bench ? ', the treatment bench' : ''}${drawers ? ', the apothecary\'s drawers' : ''}`, approach: null, passage: true };
}); }

// ---------------- PRIEST'S CELL: a narrow bed along the wall, a kneeling desk under the medallion, a desk ----------------
function templeCell(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, lat = ccmLat(far), toDoor = SIDES[far].rot, axis = (s, t = L / 2) => ctx.sidePoint(far, t, s);
  const bedId = ccmFirst(ctx, ['bed-single', 'cot', 'sickbed']); if (!bedId) return { fail: 'cell has no bed (no mesh)' };
  const bed = ccmLieAlong(ctx, bedId, [lat[0], lat[1], far], { near: axis(3, 0), layer: 'anchor', rule: 'cell-bed', why: 'the narrow bed along the wall, away from the door' });
  if (!bed) return { fail: 'cell has no room for its bed' };
  if (d) { ctx.sight = [d.inner, [bed.x, bed.z]]; ctx.sightFeature = bed.id; ccmWalk(ctx, 'approach', [d.inner, [(bed.x + (ctx.X0 + ctx.X1) / 2) / 2, (bed.z + (ctx.Z0 + ctx.Z1) / 2) / 2]]); }
  const knee = temWall(ctx, 'rite-prie-dieu', [far, lat[1]], { prefer: 'near', near: axis(0.5, L - 2.5), rule: 'kneeler', why: 'the kneeling desk against the wall, under the medallion' });
  temWall(ctx, 'desk-writing', [lat[1], OPP_SIDE[far], lat[0]], { prefer: 'near', near: axis(deep - 4, L), why: 'a small writing desk' });
  temWall(ctx, 'chest-plain', [lat[0], OPP_SIDE[far], lat[1]], { prefer: 'near', near: [bed.x, bed.z], layer: 'store', why: 'the one chest' });
  temWall(ctx, ['candlestick-floor', 'candle-tree'], [far, ...lat], { prefer: 'corner', layer: 'light', why: 'a candle' });
  if (ccmHas(ctx, 'rug-rush-mat') && L >= 9 && deep >= 9) ccmQuiet(ctx, () => ctx.rug('rug-rush-mat', { at: [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], rot: toDoor, why: 'a rush mat on the floor' }));
  ctx.templeInfo = { flavor, kneeler: !!knee };
  temFinish(ctx, { relief: [knee?.side || far], lights: ['sconce-candle-single', 'sconce-candle-triple'], every: 30 });
  return { feature: bed, what: `a narrow bed${knee ? ', a kneeling desk' : ''}`, approach: null, passage: true };
}); }

// ---------------- BELL TOWER BASE: the bell in its frame in the middle of the floor ----------------
function templeBelltower(ctx) { return temWith(ctx, (flavor) => {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far);
  const bell = ccmCentre(ctx, ['bell-on-frame'], { label: 'bell', rot: SIDES[far].rot, why: 'the great bell in its frame: in the middle of the floor, under the tower' });
  if (!bell) return { fail: 'bell tower has no bell (no mesh, or no room in the middle)' };
  ccmClearRound(ctx, bell, 1.3);
  if (d) { ctx.sight = [d.inner, [bell.x, bell.z]]; ctx.sightFeature = bell.id; ccmWalk(ctx, 'approach', [d.inner, front(bell, 1.5)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, front(bell, 1.5)]); }
  const n = Math.max(1, Math.round(ctx.area() / 120));
  ccmAlong(ctx, ['bench-long', 'chest-plain'], [far, ...lat], n + 1, { why: 'the ringers\' bench and chest against the wall' });
  for (const s of lat.slice(0, n)) ccmCorner(ctx, ccmFirst(ctx, ['barrel', 'crate']), [far, s], { why: 'stores in the corner', layer: 'store' });
  ctx.templeInfo = { flavor };
  temFinish(ctx, { relief: [far], lights: TEM_TORCH, every: 14, floorLights: ['torch-stand', 'candlestick-floor'] });
  return { feature: bell, what: 'the great bell in its frame', approach: null, passage: true };
}); }

Object.assign(KEY, { 'temple-nave': templeNave, 'temple-shrine': templeShrine, 'temple-vestry': templeVestry, 'temple-cloister': templeCloister, 'temple-scriptorium': templeScriptorium,
  'temple-infirmary': templeInfirmary, 'temple-cell': templeCell, 'temple-belltower': templeBelltower });
PROGRAM_OF['cathedral'] = 'temple-nave'; PROGRAM_OF['cathedral-dark'] = 'temple-nave'; // the same nave at another default size, and in dark walls for the evil flavors
Object.assign(MENUS, {
  'temple-nave': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-stone'], floor: ['prayer-candle-rack'] })),
  'temple-shrine': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-stone'], floor: ['prayer-candle-rack'] })),
  'temple-vestry': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['chest-plain', 'cupboard'] })),
  'temple-cloister': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-stone'] })),
  'temple-scriptorium': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['scroll-rack', 'chest-plain'] })),
  'temple-infirmary': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['chest-plain', 'cupboard'] })),
  'temple-cell': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['chest-plain'] })),
  'temple-belltower': ccmAnnex((ctx) => temAnnex(ctx, { wall: ['bench-long', 'chest-plain'] })),
});
Object.assign(DENSITY, { 'temple-nave': 5, 'cathedral': 4.5, 'cathedral-dark': 4.5, 'temple-shrine': 5, 'temple-vestry': 5, 'temple-cloister': 3.5, 'temple-scriptorium': 5, 'temple-infirmary': 5, 'temple-cell': 5, 'temple-belltower': 4 });
Object.assign(FOCAL, { 'temple-nave': 'altar on the end wall, the idol behind it', 'cathedral': 'altar on the dais (end wall), the idol behind it', 'cathedral-dark': 'altar on the dais (end wall), the idol behind it', 'temple-shrine': 'the idol, facing the door',
  'temple-vestry': 'vestments on their stand', 'temple-scriptorium': 'copying desks in rows', 'temple-infirmary': 'sickbeds along the long walls', 'temple-cell': 'the narrow bed', 'temple-belltower': 'the great bell' });
Object.assign(KEY_RE, { 'temple-nave': /^altar-stone$/, 'cathedral': /^altar-stone$/, 'cathedral-dark': /^altar-stone$/, 'temple-shrine': /^(flavor-idol|altar-stone)$/, 'temple-vestry': /^rite-vestments-stand$/, 'temple-cloister': null,
  'temple-scriptorium': /^scriptorium-desk$/, 'temple-infirmary': /^(sickbed|cot|bed-single)$/, 'temple-cell': /^(cot|sickbed|bed-single)$/, 'temple-belltower': /^bell-on-frame$/ });
// <<< tem:solver2
// >>> type:dun
// ---------------- dungeon & prison (2026-10-11): fourteen rooms ----------------
// THE D&D dungeon: an adventure site. One self-contained program a room, as the castle's (they use its helpers: castlePut,
// castleHang, castleNear and the ccm* kit above). Chasms and sewer channels are FLATS laid in a row on the floor (terrain
// below floor level does not exist): the row is kept clear, a bridge is set over it. Traps are ordinary placed things.
const DUN_TORCH = ['torch-bracket-rough', 'torch-sconce'], DUN_STAND = ['torch-stand', 'brazier-standing'];
const dunSeed = (ctx, ...k) => hash(ctx.baseSeed ?? ctx.room.seed, 'dun', ...k);
// a flat laid at an exact spot, optionally stretched to `size` [w, d] ft (strip tiles are fitted to the room's length)
function dunFlat(ctx, id, x, z, rot, why, o = {}) {
  if (!ccmHas(ctx, id)) return null;
  const sk = ctx.chooseSku(id, o.sku || {}); if (!sk) return null;
  const dm = { ...ctx.dims(id, sk) }; if (o.size) { dm.w = o.size[0]; dm.d = o.size[1]; }
  const [aw, ad] = ctx.aabb(dm.w, dm.d, rot);
  if (x - aw / 2 < ctx.X0 - 0.06 || x + aw / 2 > ctx.X1 + 0.06 || z - ad / 2 < ctx.Z0 - 0.06 || z + ad / 2 > ctx.Z1 + 0.06) return null;
  if (!o.over) ctx.rugs.push({ x, z, w: aw - 0.04, d: ad - 0.04 });
  return ctx.record(id, sk, dm, x, o.y ?? 0.02, z, rot, o.layer || 'floor-dress', o.rule || 'floor-flat', why, { orient: 'floor', ...(o.extra || {}) });
}
// `n` decals at random spots, clear of the segment a-b (the walking line) when given
function dunScatter(ctx, ids, n, why, a = null, b = null) {
  let done = 0;
  for (let k = 0; k < n * 5 && done < n; k++) {
    const id = ccmAny(ctx, ids); if (!id) return done;
    const x = ctx.r(ctx.X0 + 1.5, ctx.X1 - 1.5), z = ctx.r(ctx.Z0 + 1.5, ctx.Z1 - 1.5);
    if (a && b && segDist([x, z], a, b) < 2.5) continue;
    if (ccmQuiet(ctx, () => ctx.rug(id, { at: [x, z], rot: ctx.r(0, Math.PI * 2), why }))) done++;
  }
  return done;
}
// the focal piece centred on wall `far` (then anywhere on it, nearest the centre), with a sku wish and a scale
function dunFocal(ctx, far, ids, { label, rule = 'key-focal', why = '', gap = 0.05, slack = 0.5, sku, layer = 'anchor', k = 1, loose = true } = {}) {
  const L = ctx.sideLen(far);
  for (const id of ids) {
    if (!ccmHas(ctx, id)) continue;
    for (const sl of loose ? [slack, L / 2] : [slack]) {
      const p = ccmQuiet(ctx, () => ccmScaled(ctx, id, k, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap, tRange: [L / 2 - sl, L / 2 + sl], step: 0.25 }), (c) => Math.abs(c.t - L / 2), { layer, rule, unique: true, sku, why: why || `${label}: on the ${SIDE_LABEL[far]} wall, facing the door`, extra: { focal: true } })));
      if (p) { ctx.focal = { label, id: p.id, side: far, ok: true }; return p; }
    }
  }
  ctx.focal = { label, ok: false, why: `nothing fits on the ${SIDE_LABEL[far]} wall` };
  return null;
}
// things against the walls, sides in turn (statues, heaps, racks), `n` of them, each from `ids` by variety
function dunWalls(ctx, ids, sides, n, why, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) { const id = ccmAny(ctx, ids); if (!id) break; const p = ccmQuiet(ctx, () => isHung(ctx.lib.objects[id], id) ? ctx.mount(id, { sides: [sides[i % sides.length]], height: o.height ?? 4.2, why }) : ctx.wall(id, { sides: [sides[i % sides.length]], layer: o.layer || 'furnish', why, prefer: o.prefer || 'random', near: o.near || null, sku: o.sku })); if (p) out.push(p); }
  return out;
}
const dunFree = (ctx, id, near, radius, why, o = {}) => ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.free(id, { near, radius, margin: o.margin ?? 0.5, layer: o.layer || 'furnish', rule: o.rule || 'free', why, face: o.face || null, rot: o.rot ?? null, sku: o.sku, unique: !!o.unique })) : null;
// dark on purpose: `n` torches, the sides in turn; a windowless room always gets one
function dunLights(ctx, sides, n, why = 'a rough torch (dark on purpose)') { const k = ccmWallLights(ctx, DUN_TORCH, sides, { every: 999, min: n, max: n, why }); ccmEnsureLight(ctx, DUN_TORCH, DUN_STAND); return k; }
// the walk: main door -> target, every other door -> the main door
function dunWalks(ctx, target, kind = 'approach') { const d = ctx.mainDoor; if (!d) return; if (target) ccmWalk(ctx, kind, [d.inner, target]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, target || d.inner]); }
const dunAtDoor = (ctx, x, z, r = 3) => ctx.doors.some(o => Math.hypot(o.inner[0] - x, o.inner[1] - z) < r); // a spot that would stand in a doorway
function dunSight(ctx, p) { const d = ctx.mainDoor; if (d && p && ctx.losClear(d.inner, [p.x, p.z], new Set([p.uid])).ok) { ctx.sight = [d.inner, [p.x, p.z]]; ctx.sightFeature = p.id; } } // the doorway's view of the key piece, where it has one
const dunSeen = (ctx, list) => { const d = ctx.mainDoor; return list.filter(Boolean).find(p => !d || ctx.losClear(d.inner, [p.x, p.z], new Set([p.uid])).ok) || null; }; // the first of these the doorway can see (the room's key piece for the audit)
function dunCobweb(ctx, n = 1) { for (let i = 0; i < n; i++) if (ccmHas(ctx, 'decal-cobweb')) ccmQuiet(ctx, () => ctx.mount('decal-cobweb', { height: 6.5, why: 'cobweb high on the wall' })); }
// a passage's lines: the through-line between its two farthest doors, and every other door joined to it (a junction)
function dunThrough(ctx) {
  const line = throughLine(ctx);
  for (const o of ctx.doors) { if ((o.inner[0] === line.a[0] && o.inner[1] === line.a[1]) || (o.inner[0] === line.b[0] && o.inner[1] === line.b[1])) continue; ccmWalk(ctx, 'branch', [o.inner, line.mid]); }
  const dx = line.b[0] - line.a[0], dz = line.b[1] - line.a[1], len = Math.hypot(dx, dz) || 1;
  return { ...line, len, dir: [dx / len, dz / len], rot: Math.atan2(dx, dz), at: (f, lat = 0) => [line.a[0] + dx * f + (dz / len) * lat, line.a[1] + dz * f - (dx / len) * lat] };
}

// CORRIDOR (passage): the connective tissue. A clear through-line door to door (side doors join it: a junction), torches
// in turn down the long walls, and by its width: 1 cell = bare (things hang, nothing stands); 2 cells = what stands by the
// wall on the side the line leaves free; 3 cells = alcove statues facing each other in pairs. One door and no way on =
// the corridor ends in a fall of rock.
function dunCorridor(ctx) {
  const line = dunThrough(ctx);
  if (!line.path.ok) return { fail: 'corridor: the through-line is blocked' };
  const long = ctx.longSides(), ends = ctx.shortSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D), style = ['bare', 'alcoves', 'haunted'][dunSeed(ctx, 'corridor') % 3];
  let stood = 0, blocked = null;
  if (ctx.doors.length === 1 && ctx.mainDoor) { const far = OPP_SIDE[ctx.mainDoor.side]; // a dead end: rock has come down across it
    blocked = dunFocal(ctx, far, ['collapse-rubble', 'rubble-pile', 'stone-blocks-stack'], { label: 'rock fall', rule: 'key-collapse', sku: ctx.sideLen(far) < 10 ? { shape: 's2' } : undefined, why: 'the corridor ends in a fall of rock' }); }
  if (wide >= 13.5 || (wide >= 8.5 && style === 'alcoves')) { // statues along the walls, in facing pairs where the corridor is 3 cells wide
    const n = Math.max(1, Math.round(Lr / 14)), ids = ['statue-guardian', 'statue-rotating', 'pillar-square', 'obelisk-rune'].filter(i => ccmHas(ctx, i)).slice(0, 2);
    for (let i = 0; i < n; i++) for (const side of wide >= 13.5 ? long : [long[i % 2]]) { const t = Lr * (i + 0.5) / n, id = ids[0]; if (!id) break;
      if (ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [side], { gap: 0.1 }), (c) => Math.abs(c.t - t), { layer: 'furnish', rule: 'alcove', why: 'a statue standing in its alcove along the wall' }))) stood++; }
  } else if (wide >= 8.5) { // what the dungeon has left by the wall
    const ids = style === 'haunted' ? ['adventurer-remains', 'bones-pile', 'rubble-pile', 'skull-pile'] : ['rubble-pile', 'bones-pile', 'barrel', 'crate'];
    stood += dunWalls(ctx, ids, long, Math.max(1, Math.round(Lr / 16)), 'left by the wall', { sku: { shape: 's2' } }).length;
  }
  if (style === 'haunted' || wide < 8.5) dunWalls(ctx, ['manacles-wall'], long, Lr >= 20 ? 1 : 0, 'manacles on the wall');
  dunScatter(ctx, ['decal-cracks', 'decal-rubble-scatter', 'decal-moss', 'puddle', 'decal-bones-scatter'], Math.max(1, Math.round(ctx.area() / 70)), 'on the corridor floor');
  dunCobweb(ctx, Lr >= 25 ? 2 : 1);
  dunLights(ctx, wide >= 8.5 ? long : [...long, ...ends], Math.max(1, Math.min(6, Math.round(Lr / 14))), 'a torch down the corridor');
  ctx.dunInfo = { kind: 'corridor', style, doors: ctx.doors.length, deadEnd: !!blocked };
  ccmDone(ctx);
  return { feature: blocked, what: `${ctx.doors.length >= 3 ? 'a junction' : blocked ? 'a corridor ending in a rock fall' : 'a corridor'} ${Math.round(Lr)} ft long, a clear through-line${stood ? `, ${stood} thing${stood > 1 ? 's' : ''} along the walls` : ''}`, approach: null, passage: true };
}

// TRAP CORRIDOR (passage): a gauntlet. The through-line is found first; then the traps are set ON it, in turn, about
// every 9 ft: pressure plates, the spike plate, the open pit, the swinging blade across the way, the flame jet; dart walls
// stand against the side walls beside the plates; the lever that stops it all is by the far door; whoever came before
// lies short of the first trap. Traps are ordinary things with the catalog's trap / hazard affordances: no behaviour.
function dunTrapCorridor(ctx) {
  const line = dunThrough(ctx);
  if (!line.path.ok) return { fail: 'trap corridor: the through-line is blocked' };
  const long = ctx.longSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D), n = Math.max(2, Math.min(7, Math.round((line.len - 6) / 6))), f0 = Math.min(0.3, 3.6 / line.len);
  // (blind reads, 2026-10-12: from the table a pressure plate is a chopping block and a dart wall a rack of pigeon-holes; what says
  // "trap" is the blade across the way, the open pit, the spikes and blood beside each: those first, plates between them)
  const big = ctx.shuffle(['trap-blade', 'pit-open', 'trap-spike-pit', 'trap-spikes'].filter(id => ccmHas(ctx, id) && wide >= (id === 'trap-blade' ? 7 : 6))), small = ['pressure-plate', 'trap-flame-jet', 'bear-trap'].filter(id => ccmHas(ctx, id));
  const kinds = []; for (let i = 0; i < Math.max(big.length, small.length); i++) { if (big[i]) kinds.push(big[i]); if (small[i] && (i === 0 || !big.length)) kinds.push(small[i]); } if (!kinds.length) kinds.push(...small);
  const traps = []; let darts = 0;
  for (let i = 0; i < n && kinds.length; i++) {
    const id = kinds[i % kinds.length]; const f = f0 + (1 - 2 * f0) * (n === 1 ? 0.5 : i / (n - 1)); let [x, z] = line.at(f, id === 'trap-flame-jet' || id === 'trap-crossbow' ? Math.min(2, wide / 2 - 1.2) : 0);
    if (dunAtDoor(ctx, x, z, 1.9 + Math.max(...ccmSize(ctx, id).slice(0, 2)) / 2)) continue;
    if (Math.max(...ccmSize(ctx, id).slice(0, 2)) > 3.2) { if (ctx.W >= ctx.D) z = (ctx.Z0 + ctx.Z1) / 2; else x = (ctx.X0 + ctx.X1) / 2; } if (dunAtDoor(ctx, x, z, 1.9 + Math.max(...ccmSize(ctx, id).slice(0, 2)) / 2)) continue; /* a big trap fills the corridor: it sits on the centre line, not on the door's row */
    const p = id === 'pit-open' ? dunFlat(ctx, id, x, z, line.rot, 'an open pit across the way', { rule: 'trap', layer: 'anchor' })
      : castlePut(ctx, id, [[x, z, line.rot]], { allowKeep: true, layer: 'anchor', rule: 'trap', why: id === 'trap-blade' ? 'the swinging blade, across the way' : id === 'pressure-plate' ? 'a pressure plate in the walking line' : 'a trap set in the walking line' });
    if (!p) continue;
    traps.push(p);
    if (id === 'pit-open') ctx.mark(x, z, 4, 4, KEEP);
    if (id === 'trap-flame-jet' && ccmHas(ctx, 'decal-scorch')) ccmQuiet(ctx, () => ctx.rug('decal-scorch', { at: line.at(f), why: 'scorched floor before the flame jet' }));
    if (ccmHas(ctx, 'decal-blood') && id !== 'pit-open' && traps.length % 2) ccmQuiet(ctx, () => ctx.rug('decal-blood', { at: line.at(f - 2.6 / line.len, 1.2), why: 'blood by the trap' }));
    if (id === 'pressure-plate' && wide >= 6 && !darts && ccmHas(ctx, 'trap-dart-wall')) { const side = long[darts % 2]; if (ccmQuiet(ctx, () => ctx.put('trap-dart-wall', (dm) => ctx.wallGen(dm, [side, OPP_SIDE[side]], { gap: 0.05 }), (c) => Math.hypot(c.x - x, c.z - z), { layer: 'anchor', rule: 'trap', why: 'the dart wall its plate fires' }))) darts++; }
  }
  for (const f of [0.5, 0.38, 0.62, 0.3, 0.7, 0.44, 0.56, 0.25, 0.75, 0.2, 0.8]) { if (traps.length >= 2 || !ccmHas(ctx, 'pressure-plate')) break; const [x, z] = line.at(f); if (dunAtDoor(ctx, x, z, 2.4) || traps.some(q => Math.hypot(q.x - x, q.z - z) < 3.2)) continue; const p = castlePut(ctx, 'pressure-plate', [[x, z, line.rot]], { allowKeep: true, layer: 'anchor', rule: 'trap', why: 'a pressure plate in the walking line' }); if (p) traps.push(p); }
  if (!traps.length) return { fail: 'trap corridor has no trap (no pressure plate, spikes or blade mesh)' };
  const d = ctx.mainDoor, first = traps[0];
  if (ccmHas(ctx, 'trap-crossbow') && wide >= 8.5) ccmQuiet(ctx, () => ctx.wall('trap-crossbow', { sides: ctx.shortSides(), layer: 'anchor', rule: 'trap', why: 'a crossbow on a trip cord, aimed down the corridor' }));
  if (ccmHas(ctx, 'boulder-rolling') && wide >= 13.5) ccmQuiet(ctx, () => ctx.wall('boulder-rolling', { sides: ctx.shortSides(), prefer: 'corner', layer: 'anchor', rule: 'trap', why: 'the boulder, waiting at the end' }));
  if (!ccmQuiet(ctx, () => ccmHas(ctx, 'lever-floor') && ctx.wall('lever-floor', { sides: long, prefer: 'near', near: line.b, layer: 'furnish', why: 'the lever that stops the traps, by the far door' }))) castleHang(ctx, ['lever-wall'], long, 1, { height: 4.6, why: 'the lever that stops the traps' });
  const before = line.at(Math.max(0.05, f0 + 2.5 / line.len), wide >= 8.5 ? 2.4 : 0);
  dunFree(ctx, 'adventurer-remains', before, 5, 'whoever came before, short of the first trap', { margin: 0.2 }) || dunWalls(ctx, ['bones-pile'], long, 1, 'what is left of the last one through', { prefer: 'near', near: before });
  if (ccmHas(ctx, 'decal-blood')) ccmQuiet(ctx, () => ctx.rug('decal-blood', { at: [first.x + line.dir[0] * 2.5, first.z + line.dir[1] * 2.5], why: 'by the first trap' }));
  dunScatter(ctx, ['decal-bones-scatter', 'decal-bones-scatter', 'decal-cracks'], Math.max(2, Math.round(ctx.area() / 55)), 'on the corridor floor');
  dunLights(ctx, long, Math.max(1, Math.min(5, Math.round(Lr / 16))), 'a torch down the corridor');
  ctx.dunInfo = { kind: 'trap-corridor', traps: traps.map(p => p.id), darts };
  dunSight(ctx, first);
  ccmDone(ctx);
  return { feature: dunSeen(ctx, traps), what: `a gauntlet of ${traps.length} traps on the walking line${darts ? `, ${darts} dart wall${darts > 1 ? 's' : ''}` : ''}, the lever at the far end`, approach: null, passage: true };
}

// DEAD END (terminal): a short passage that stops, and what it stops at, by seed: a fall of rock; a sealed rune door
// (blind: it is the wall); a guardian statue or a small shrine; a chest (one in three is the mimic) with a body before it.
function dunDeadEnd(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, v = dunSeed(ctx, 'dead-end') % 4;
  const tries = [
    () => dunFocal(ctx, far, ['collapse-rubble', 'rubble-pile'], { label: 'rock fall', rule: 'key-collapse', sku: L < 10 ? { shape: 's2' } : undefined, why: 'the passage ends in a fall of rock' }),
    () => dunFocal(ctx, far, ['door-rune-sealed', 'door-face-carved', 'tomb-door-sealed'], { label: 'sealed door', rule: 'key-sealed', gap: 0.02, why: 'a sealed stone door in the end wall: it does not open' }),
    () => dunFocal(ctx, far, ['collapse-rubble', 'rubble-pile'], { label: 'rock fall', rule: 'key-collapse', sku: L < 10 ? { shape: 's2' } : undefined, why: 'the passage ends in a fall of rock' }), // (a statue at the end read as a guard post: the fall twice in four)
    () => dunFocal(ctx, far, dunSeed(ctx, 'mimic') % 3 === 0 ? ['mimic-chest', 'chest-treasure', 'chest-ironbound'] : ['chest-treasure', 'chest-ironbound', 'mimic-chest'], { label: 'chest', why: 'a chest at the end of the passage (too easy)' }),
  ];
  let key = null; for (let i = 0; i < 4 && !key; i++) key = tries[(v + i) % 4]();
  if (!key) return { fail: 'dead end has nothing at its end (no rubble, door, statue or chest mesh)' };
  dunWalks(ctx, front(key, 1.6));
  dunSight(ctx, key);
  if (/collapse|rubble/.test(key.id)) { dunWalls(ctx, ['rubble-pile'], lat, 2, 'fallen stone by the wall', { prefer: 'near', near: [key.x, key.z] }); dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks'], 3, 'chips and dust'); }
  else if (/chest/.test(key.id)) { dunFree(ctx, 'adventurer-remains', front(key, 3), 5, 'the last one to try the chest', { margin: 0.2 }); if (ccmHas(ctx, 'decal-blood')) ccmQuiet(ctx, () => ctx.rug('decal-blood', { at: front(key, 1.5), why: 'before the chest' })); }
  else if (/statue|shrine/.test(key.id)) { ccmFlank(ctx, key, ['rite-pillar-candle-tall', 'candlestick-floor', 'torch-stand'], { off: 0.6, why: 'a light each side of it' }); if (ccmHas(ctx, 'offering-bowl')) ccmQuiet(ctx, () => castlePut(ctx, 'offering-bowl', [...front(key, 0.9), key.rot], { layer: 'dress', why: 'an offering left before it' })); }
  else ccmWallLights(ctx, DUN_TORCH, [far], { every: 999, min: L >= 9 ? 2 : 1, max: 2, why: 'a torch beside the sealed door' });
  if (deep >= 18) dunWalls(ctx, ['bones-pile', 'rubble-pile'], lat, 1, 'by the wall', { sku: { shape: 's2' } });
  dunCobweb(ctx, 1);
  dunLights(ctx, lat, 1);
  ctx.dunInfo = { kind: 'dead-end', ends: key.id };
  ccmDone(ctx);
  return { feature: key, what: `a dead end: ${key.id}`, approach: null, passage: true };
}

// CELL BLOCK (terminal): an aisle with barred cells off it. Cells stand along one long wall, or both where the room is 29 ft
// across; each is 10 ft wide, its front one bar panel and one barred door, its sides full-height stone partitions; a cell
// a door of the room would open into is left out (that bay is the way in). Inside: a pallet or a stone bunk, a bucket,
// straw; one cell in five holds a chained skeleton. A room too small for a row has one cage across its far end.
function dunCellBlock(ctx) {
  const d = ctx.mainDoor, long = ctx.longSides(), across = Math.min(ctx.W, ctx.D), Lr = Math.max(ctx.W, ctx.D), area = ctx.area();
  if (!ccmHas(ctx, 'cell-bars')) return { fail: 'cell block has no bars (cell-bars mesh)' };
  const doorId = ccmFirst(ctx, ['door-cell-bars', 'crypt-gate-iron']), fam = ctx.skuPool('wall-straight').some(k => k.family === ctx.room.family) ? ctx.room.family : 'dressed-stone';
  const CELL_D = across >= 19 ? 10 : across >= 13.5 ? 7.5 : 0, both = across >= 28.5, sides = !CELL_D || Lr < 14 ? [] : both ? long : [long.find(s => !ctx.doorT[s].length) || long[0]];
  const made = []; let bones = 0;
  const doorIn = (pt) => ctx.doors.some(o => Math.hypot(o.inner[0] - pt[0], o.inner[1] - pt[1]) < 6.2);
  for (const cw of sides) {
    const rotIn = SIDES[cw].rot, rotAcross = rotIn + Math.PI / 2, n = Math.floor((Lr + 0.5) / 10), t0 = (Lr - n * 10) / 2;
    const piece = (id, t, s, rot, sku, why, o = {}) => castlePut(ctx, id, [...ctx.sidePoint(cw, t, s), rot], { sku, layer: o.layer || 'anchor', rule: o.rule || 'cell', why });
    const skip = Array.from({ length: n }, (_, k) => doorIn(ctx.sidePoint(cw, t0 + k * 10 + 5, CELL_D / 2)) || ctx.overlapsT(ctx.doorT[cw], t0 + k * 10, t0 + k * 10 + 10));
    for (let k = 0; k <= n; k++) { const t = t0 + k * 10; if (t < 0.8 || t > Lr - 0.8 || ((k === 0 || skip[k - 1]) && (k === n || skip[k]))) continue;
      for (let s = 2.5; s < CELL_D; s += 5) piece('wall-straight', t, Math.min(s, CELL_D - 2.5), rotAcross, { family: fam }, 'a full-height partition between two cells'); }
    for (let k = 0; k < n; k++) { if (skip[k]) continue;
      const t = t0 + k * 10, flip = dunSeed(ctx, 'cell-door', cw, k) % 2, open = !doorId || dunSeed(ctx, 'cell-open', cw, k) % 6 === 0;
      const bars = piece('cell-bars', t + (flip ? 7.5 : 2.5), CELL_D + 0.45, rotIn, {}, 'the barred front of a cell');
      const door = open ? null : piece(doorId, t + (flip ? 2.5 : 7.5), CELL_D + 0.45, rotIn, {}, 'the barred door of a cell');
      if (!bars && !door) continue;
      made.push({ cw, k, open: !door });
      const kind = dunSeed(ctx, 'cell', cw, k) % 5, back = (dt, s) => ctx.sidePoint(cw, t + dt, s), bed = ccmFirst(ctx, kind % 2 ? ['bed-cell-stone', 'bed-straw-pallet'] : ['bed-straw-pallet', 'bed-cell-stone']);
      if (kind === 0 && ccmHas(ctx, 'skeleton-chained')) { if (piece('skeleton-chained', t + 5, 0.75, rotIn, {}, 'the forgotten prisoner, still chained to the back wall', { layer: 'dress', rule: 'in-cell' })) bones++; }
      else if (kind === 0) piece('bones-pile', t + 3, 2, rotIn, {}, 'what is left of a prisoner', { layer: 'dress', rule: 'in-cell' });
      else if (bed) { const [pw, pd] = ccmSize(ctx, bed); piece(bed, t + 0.9 + pd / 2, 0.35 + pw / 2, rotAcross, {}, 'the bed along the back wall of the cell', { layer: 'furnish', rule: 'in-cell' }); }
      piece('bucket-slop', t + 9, 1.2, 0, {}, 'the slop bucket in the corner of the cell', { layer: 'store', rule: 'in-cell' });
      if (kind === 3) piece('ball-and-chain', t + 6.5, CELL_D - 2.2, rotIn + 0.6, {}, 'left on the cell floor', { layer: 'dress', rule: 'in-cell' });
      const straw = ccmFirst(ctx, ['decal-straw-scatter', 'rug-hay-scatter']); if (straw) ccmQuiet(ctx, () => ctx.rug(straw, { at: back(5, CELL_D / 2), why: 'straw on the cell floor' }));
    }
  }
  let cage = null;
  if (!made.length) { // one cage across the far end: bars from wall to wall, 8 ft deep (or as deep as a short room allows)
    const far = ccmFar(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, s = Math.min(8, deep - 5.5), rot = SIDES[far].rot, n = Math.max(1, Math.floor((L + 0.5) / 5)), t0 = (L - n * 5) / 2, gate = dunSeed(ctx, 'cage-door') % n;
    if (s >= 3.5) for (let k = 0; k < n; k++) { const id = k === gate && doorId && n > 1 ? doorId : 'cell-bars'; const p = castlePut(ctx, id, [...ctx.sidePoint(far, t0 + k * 5 + 2.5, s + 0.45), rot], { layer: 'anchor', rule: 'cell', why: id === 'cell-bars' ? 'bars across the far end: one cell' : 'the barred door of the cell' }); cage = cage || p; }
    if (!cage) return { fail: 'cell block: no room for a cell' };
    const bed = ccmFirst(ctx, ['bed-straw-pallet', 'bed-cell-stone']); if (bed) ccmQuiet(ctx, () => ctx.put(bed, (dm) => ctx.wallGen(dm, [far]), () => ctx.rng(), { rule: 'in-cell', why: 'the bed against the back wall of the cell' }));
    ccmQuiet(ctx, () => ctx.wall('bucket-slop', { sides: [far], prefer: 'corner', layer: 'store', rule: 'in-cell', why: 'the slop bucket' }));
    made.push({ cw: far, k: 0, open: false, cage: true });
  }
  // the aisle: kept clear, walked end to end; the jailer's corner at its far end, the keys and the lever by the door
  const aisleS = cage ? null : CELL_D + 0.9, base = sides[0], aisleW = cage ? 0 : across - (both ? 2 : 1) * (CELL_D + 0.9), mid = cage ? null : (t) => ctx.sidePoint(base, t, aisleS + aisleW / 2);
  if (mid) { const [x, z] = mid(Lr / 2), ns = base === 'N' || base === 'S', w = Math.min(4, aisleW); ctx.mark(x, z, ns ? Lr : w, ns ? w : Lr, KEEP);
    if (d) { ccmWalk(ctx, 'aisle', [d.inner, mid(2.5), mid(Lr - 2.5)], { width: 3 }); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, mid(Lr / 2)]); } }
  else dunWalks(ctx, front(cage, 2));
  const farWalls = cage ? ccmLat(made[0].cw) : both ? ctx.shortSides() : [OPP_SIDE[base], ...ctx.shortSides()];
  if (d) castleHang(ctx, ['key-hook-board', 'lever-wall'], [d.side, ...farWalls], 2, { height: 5.2, why: 'by the door: the keys and the lever' });
  if (!cage && aisleW >= 8) { const st = castleNear(ctx, ['table-square'], farWalls, d ? d.inner : mid(2), { why: 'the jailer\'s table in the aisle' })[0];
    if (st) { dunFree(ctx, 'stool-three-leg', [st.x, st.z], 3, 'the jailer\'s stool', { margin: 0.4, face: [st.x, st.z], rule: 'seat' }); ccmQuiet(ctx, () => ctx.surface('mil-guard-lantern', { on: s => s.uid === st.uid, layer: 'light', why: 'the jailer\'s lantern' })); ccmQuiet(ctx, () => ctx.surface('key-ring', { on: s => s.uid === st.uid, why: 'the keys' })); } }
  if (!both && !cage && aisleW >= 9) dunWalls(ctx, ['stocks', 'chain-pile', 'chest-ironbound', 'barrel'], [OPP_SIDE[base]], Math.round(Lr / 14), 'along the wall facing the cells');
  dunWalls(ctx, ['manacles-wall'], farWalls, 1, 'manacles on the wall');
  dunLights(ctx, farWalls.concat(d ? [d.side] : []), Math.max(1, Math.min(5, Math.round(area / 280))));
  const first = ctx.placements.find(p => p.rule === 'cell' && /bars|gate/.test(p.id)) || null;
  ctx.dunInfo = { kind: 'cell-block', cells: made.length, open: made.filter(m => m.open).length, skeletons: bones, cage: !!cage };
  if (made.length && !cage) ctx.growth.push(`cells repeat: ${made.length} along ${both ? 'both long walls' : `the ${SIDE_LABEL[base]} wall`}`);
  ccmDone(ctx);
  return { feature: null, what: cage ? 'one barred cell across the far end' : `${made.length} cells behind bars off a ${Math.round(aisleW)}-ft aisle${bones ? `, ${bones} with a chained skeleton` : ''}`, approach: null, passage: true };
}

// GUARD ROOM (uses): the table in the middle with stools round it, dice and tankards on it; cots along one side wall (three
// at most: more reads as a barracks), arms on the wall facing the door, keys and the roster by the door, a brazier.
function dunGuardRoom(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), area = ctx.area();
  const table = ccmCentre(ctx, ['table-square', 'table-round', 'table-trestle'], { label: 'guards\' table', rule: 'key-table', why: 'the guards\' table: in the middle of the room' });
  if (!table) return { fail: 'guard room has no table' };
  ccmClearRound(ctx, table, 0.4);
  const seats = Math.max(2, Math.min(4, Math.round(cells / 5)));
  for (let i = 0; i < seats; i++) { const a = table.rot + i * Math.PI / 2 + Math.PI / 2, k = Math.max(table.dims[0], table.dims[2]) / 2 + 1.1, id = ccmFirst(ctx, ['stool-three-leg', 'stool', 'chair-plain']); if (id && !dunAtDoor(ctx, table.x + Math.sin(a) * k, table.z + Math.cos(a) * k)) ccmQuiet(ctx, () => castlePut(ctx, id, [table.x + Math.sin(a) * k, table.z + Math.cos(a) * k, a + Math.PI], { rule: 'seat', why: 'a stool at the guards\' table', allowKeep: true })); }
  for (const id of ['dice-and-cup', 'tankard', 'mil-guard-lantern', 'tankard', 'key-ring'].slice(0, cells >= 12 ? 5 : 3)) if (ccmHas(ctx, id)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === table.uid, layer: /lantern/.test(id) ? 'light' : 'dress', why: 'on the guards\' table' }));
  dunWalks(ctx, front(table, 1.8));
  dunSight(ctx, table);
  const racks = dunWalls(ctx, ['weapon-rack'], [far], cells >= 20 ? 2 : 1, 'arms racked on the wall facing the door', { sku: { tiers: [] } });
  castleHang(ctx, ['mil-crossbow-rack', 'mil-helmet-peg-rack', 'shield-round'], [far, ...lat], cells >= 16 ? 3 : 2, { height: 5.4, why: 'kit hung on the wall' });
  const cots = cells >= 12 ? ccmAlong(ctx, ['cot'], [lat[dunSeed(ctx, 'cots') % 2]], Math.min(3, Math.round(cells / 8)), { why: 'a cot for the watch off duty, head to the wall' }) : [];
  for (const c of cots.slice(0, 2)) if (ccmHas(ctx, 'mil-footlocker')) ccmQuiet(ctx, () => castlePut(ctx, 'mil-footlocker', [...front(c, 0.2 + ccmSize(ctx, 'mil-footlocker')[1] / 2), c.rot], { layer: 'store', why: 'a footlocker at the foot of the cot' }));
  if (d) castleHang(ctx, ['key-hook-board', 'mil-duty-roster', 'lever-wall'], [d.side, ...lat], cells >= 12 ? 3 : 2, { height: 5.2, why: 'by the door: keys, the roster, the lever' });
  dunWalls(ctx, ['chest-ironbound', 'barrel', 'armor-stand', 'mil-shield-stack'], [...lat, far], Math.max(1, Math.round(cells / 8)), 'against the wall');
  ccmQuiet(ctx, () => ccmHas(ctx, 'brazier-standing') && ctx.wall('brazier-standing', { prefer: 'corner', layer: 'light', why: 'the watch\'s brazier in the corner', sku: { tiers: [] } }));
  dunLights(ctx, [far, ...lat], Math.max(1, Math.min(4, Math.round(area / 220))), 'a torch on the wall');
  ctx.dunInfo = { kind: 'guard-room', seats, cots: cots.length, racks: racks.length };
  ccmDone(ctx);
  return { feature: table, what: `the guards' table with ${seats} stools, ${cots.length} cots, arms on the far wall`, approach: null, passage: true };
}

// INTERROGATION ROOM (terminal): the restraint chair in the middle of the floor, facing the door (the rack where there is
// no chair), the brazier of irons beside it and the table of tools on the nearest wall; the iron maiden against the wall
// facing the door; the post, the cage and the block along the walls as the room grows.
function dunInterrogation(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), area = ctx.area(), toDoor = SIDES[far].rot;
  const chair = ccmCentre(ctx, ['chair-interrogation', 'rack-torture'], { label: 'the chair', rot: toDoor, rule: 'key-chair', why: 'the restraint chair: in the middle of the floor, facing the door' });
  if (!chair) return { fail: 'interrogation room has no chair or rack' };
  if (chair.id === 'rack-torture') { /* the rack lies along the room */ } 
  ccmClearRound(ctx, chair, 1.2);
  dunWalks(ctx, front(chair, 2.2));
  dunSight(ctx, chair);
  const irons = ccmQuiet(ctx, () => ctx.companion(chair, ccmFirst(ctx, ['brazier-irons', 'brazier-standing']), { why: 'the irons heating beside the chair', layer: 'light', maxDist: 5 }));
  const maiden = dunFocal(ctx, far, ctx.chance(1 / 3) ? ['iron-maiden-open', 'iron-maiden'] : ['iron-maiden'], { label: 'iron maiden', rule: 'key-maiden', why: 'the iron maiden: against the wall facing the door' });
  ctx.focal = { label: 'the chair', id: chair.id, ok: true, centre: true };
  const tools = ccmQuiet(ctx, () => ccmHas(ctx, 'table-torture-tools') && ctx.wall('table-torture-tools', { sides: lat, prefer: 'near', near: [chair.x, chair.z], layer: 'anchor', why: 'the table of tools, on the wall nearest the chair' }));
  if (chair.id !== 'rack-torture' && area >= 380) ccmQuiet(ctx, () => ctx.wall('rack-torture', { sides: lat, layer: 'anchor', why: 'the rack, along the side wall' }));
  const grows = ['whipping-post', 'gibbet-cage-standing', 'cage-floor', 'block-headsman', 'stocks'].filter(i => ccmHas(ctx, i)).slice(0, Math.max(1, Math.min(4, Math.round((area - 150) / 130))));
  for (const id of grows) ccmQuiet(ctx, () => ctx.wall(id, { sides: [far, ...lat], prefer: id === 'gibbet-cage-standing' || id === 'cage-floor' ? 'corner' : 'random', layer: 'furnish', why: 'along the wall' }));
  castleHang(ctx, ['manacles-wall'], [...lat, far], cells >= 16 ? 3 : 2, { height: 4.2, why: 'manacles on the wall' });
  if (ccmHas(ctx, 'skeleton-chained') && ctx.chance(0.5)) dunWalls(ctx, ['skeleton-chained'], lat, 1, 'one who did not talk');
  ccmQuiet(ctx, () => ccmHas(ctx, 'bucket-slop') && ctx.wall('bucket-slop', { prefer: 'corner', layer: 'store', why: 'a bucket in the corner' }));
  if (ccmHas(ctx, 'decal-blood')) { ccmQuiet(ctx, () => ctx.rug('decal-blood', { at: [chair.x, chair.z], why: 'under the chair' })); ccmQuiet(ctx, () => ctx.rug('decal-blood', { at: front(chair, 1.5), why: 'before the chair' })); }
  dunLights(ctx, [far, ...lat, ...(d ? [d.side] : [])], Math.max(1, Math.min(4, Math.round(area / 250))));
  ctx.dunInfo = { kind: 'interrogation', chair: chair.id, maiden: maiden?.id || null, tools: !!tools, irons: !!irons };
  ccmDone(ctx);
  return { feature: chair, what: `${chair.id === 'rack-torture' ? 'the rack' : 'the restraint chair'} in the middle${irons ? ', irons heating beside it' : ''}${maiden ? ', the iron maiden on the far wall' : ''}`, approach: null, passage: true };
}

// TREASURE VAULT (terminal): gold seen from the door. The open chest on the wall facing the door with gold stacked either
// side; in a vault of 16 cells or more the hoard itself in the middle of the floor; strongboxes and loaded shelves down the
// side walls, heaps of coin between; a stone guardian in each far corner of a big vault; a pressure plate inside the door.
function dunVault(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const chest = dunFocal(ctx, far, ['chest-treasure-open', 'chest-treasure', 'chest-ironbound'], { label: 'treasure chest', rule: 'key-chest', why: 'the great chest: on the wall facing the door' });
  const hoard = cells >= 30 ? ccmCentre(ctx, ['dun-treasure-hoard', 'treasure-hoard'], { label: 'the hoard', rule: 'key-hoard', why: 'the hoard: heaped in the middle of the floor' }) : null;
  const key = hoard || chest;
  if (!key) return { fail: 'vault has no treasure (no chest or hoard mesh)' };
  if (chest) ctx.focal = { label: 'treasure chest', id: chest.id, side: far, ok: true };
  dunWalks(ctx, front(key, 1.8));
  dunSight(ctx, key);
  if (chest) ccmFlank(ctx, chest, ['gold-bars', 'coin-pile', 'silver-plate-pile'], { off: 0.5, layer: 'store', why: 'gold stacked each side of the chest' });
  if (cells >= 20) for (const s of lat) ccmCorner(ctx, 'statue-guardian', [far, s], { why: 'a stone guardian in the far corner', inset: 0.4 });
  const n = Math.max(2, Math.min(8, Math.round(deep / 5)));
  const side = dunWalls(ctx, ['chest-treasure', 'chest-ironbound', 'strongbox-stack', 'gold-bars', 'coin-pile', 'chest-treasure'], lat, n, 'strongboxes and loaded shelves down the side wall', { layer: 'store' });
  const heaps = Math.max(2, Math.min(7, Math.round(cells / 4))); let got = 0;
  for (let i = 0; i < heaps; i++) { const id = ccmAny(ctx, ['coin-pile', 'gold-bars', 'coin-pile']); if (id && dunFree(ctx, id, [key.x, key.z], Math.max(5, deep / 2), 'a heap of it on the floor', { margin: 0.3, layer: 'store' })) got++; }
  if (dunSeed(ctx, 'mimic') % 3 === 0) dunWalls(ctx, ['mimic-chest'], lat, 1, 'one chest is not a chest', { layer: 'store' });
  if (ccmHas(ctx, 'pedestal-display') && cells >= 12) { const ped = ccmQuiet(ctx, () => ctx.wall('pedestal-display', { sides: lat, layer: 'furnish', why: 'a pedestal for the best piece' })); if (ped) ccmOn(ctx, ccmAny(ctx, ['casket-ornate', 'crown', 'reliquary']), ped, 0, 0, 'the best piece, on its pedestal'); }
  if (d && ccmHas(ctx, 'pressure-plate') && dunSeed(ctx, 'plate') % 2 === 0) castlePut(ctx, 'pressure-plate', [d.inner[0] + (key.x - d.inner[0]) * 0.35, d.inner[1] + (key.z - d.inner[1]) * 0.35, 0], { allowKeep: true, layer: 'dress', rule: 'trap', why: 'a pressure plate between the door and the gold' });
  dunLights(ctx, [...lat, ...(d ? [d.side] : [])], cells >= 16 ? 2 : 1, 'a torch on the wall');
  ctx.dunInfo = { kind: 'vault', hoard: !!hoard, chest: chest?.id || null, side: side.length, heaps: got };
  ccmDone(ctx);
  return { feature: key, what: `${hoard ? 'the hoard in the middle, ' : ''}${chest ? 'the great chest on the far wall, ' : ''}${side.length} strongboxes and shelves, ${got} heaps of coin`, approach: null, passage: true };
}

// SEWER (passage): a channel of foul water down the length of it (a row of strip flats, kept clear) with a walkway beside
// it; the row is one no door opens onto. A pipe mouth or a barred outfall at each end of the channel that has no door, a
// sluice and a clog of refuse in the water, a ladder up on the walkway wall. One cell wide = a culvert: no channel.
function dunSewer(ctx) {
  const d = ctx.mainDoor, long = ctx.longSides(), ends = ctx.shortSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D), base = long[0], rows = Math.round((wide + 1) / 5), ns = base === 'N' || base === 'S';
  const strips = []; let rowS = null; const inWater = [];
  if (rows >= 2 && ccmHas(ctx, 'sewer-channel-strip')) {
    const doorS = ctx.doors.filter(o => ends.includes(o.side)).map(o => ns ? (base === 'N' ? o.inner[1] - ctx.Z0 : ctx.Z1 - o.inner[1]) : (base === 'W' ? o.inner[0] - ctx.X0 : ctx.X1 - o.inner[0]));
    // the channel's row: the middle one where every door is an end door on one side of it, else a row against a long wall
    // that has no door, in line with no end door; the doors then all open onto one walkway
    const S_OF = (r) => Math.max(2.5, Math.min(wide - 2.5, r * 5 + 2)), sideDoors = new Set(ctx.doors.filter(o => long.includes(o.side)).map(o => o.side)), clear = (s) => doorS.every(v => Math.abs(v - s) >= 4.2);
    const mid = rows >= 3 ? S_OF(Math.floor(rows / 2)) : null;
    if (mid !== null && !sideDoors.size && clear(mid) && (doorS.every(v => v > mid) || doorS.every(v => v < mid))) rowS = mid;
    else rowS = [[S_OF(0), base], [S_OF(rows - 1), OPP_SIDE[base]]].filter(([s, wall]) => !sideDoors.has(wall) && clear(s)).map(([s]) => s)[dunSeed(ctx, 'row') % 2] ?? [[S_OF(0), base], [S_OF(rows - 1), OPP_SIDE[base]]].filter(([s, wall]) => !sideDoors.has(wall) && clear(s)).map(([s]) => s)[0] ?? null;
  }
  if (rowS !== null) {
    const n = Math.round((Lr + 1) / 5), w = Lr / n, rot = ns ? 0 : Math.PI / 2;
    for (let k = 0; k < n; k++) { const [x, z] = ctx.sidePoint(base, (k + 0.5) * w, rowS); const p = dunFlat(ctx, 'sewer-channel-strip', x, z, rot, 'the channel: foul water between stone kerbs', { size: [w, 5], rule: 'key-channel', layer: 'anchor' }); if (p) strips.push(p); }
    // what stands in the water goes in before the channel is closed to everything else
    for (const e of ends) { const t = e === ccmLat(base)[0] ? 0 : Lr, [x, z] = ctx.sidePoint(base, Math.abs(t - 0.01), rowS), id = ccmAny(ctx, ['sewer-outflow', 'sewer-grate']);
      if (!id || ctx.doors.some(o => o.side === e)) continue; const dm = ccmSize(ctx, id), back = dm[1] / 2 + 0.1, [fx, fz] = ctx.facingVec(SIDES[e].rot);
      const p = castlePut(ctx, id, [x + fx * back * (t ? 1 : 1), z + fz * back, SIDES[e].rot], { layer: 'anchor', rule: 'outfall', why: 'where the channel runs out through the wall' }); if (p) inWater.push(p); }
    for (const [id, f, why] of [['sewer-sluice-gate', 0.5, 'the sluice across the channel'], ['sewer-debris-clog', 0.28, 'a clog of refuse in the water'], ['flotsam-crate', 0.74, 'something floating in the channel']]) { if (!ccmHas(ctx, id) || (id === 'sewer-sluice-gate' && Lr < 24)) continue; const [x, z] = ctx.sidePoint(base, Lr * f, rowS); const p = castlePut(ctx, id, [x, z, rot + (id === 'sewer-sluice-gate' ? Math.PI / 2 : 0)], { layer: 'furnish', rule: 'in-channel', why }); if (p) inWater.push(p); }
    const [cx, cz] = ctx.sidePoint(base, Lr / 2, rowS); ctx.mark(cx, cz, ns ? Lr : 5, ns ? 5 : Lr);
  }
  const line = dunThrough(ctx);
  if (!line.path.ok) return { fail: 'sewer: the walkway is blocked' };
  const walls = rowS === null ? long : [rowS < wide / 2 ? OPP_SIDE[base] : base, ...(rows >= 3 ? [rowS < wide / 2 ? base : OPP_SIDE[base]] : [])];
  if (rowS === null) for (const id of ['sewer-grate', 'sewer-outflow']) { if (ctx.placements.some(p => /^sewer-/.test(p.id))) break; for (const side of [...ends.filter(e => !ctx.doors.some(o => o.side === e)), ...long]) if (ccmHas(ctx, id) && ccmQuiet(ctx, () => ctx.wall(id, { sides: [side], layer: 'anchor', rule: 'outfall', why: 'an outfall in the wall' }))) break; }
  if (wide >= 8.5) dunWalls(ctx, ['barrel', 'refuse-pile', 'crate', 'sewer-debris-clog'], walls, Math.max(1, Math.round(Lr / 16)), 'on the walkway, against the wall');
  dunScatter(ctx, ['decal-slime', 'puddle', 'decal-moss'], Math.max(2, Math.round(ctx.area() / 60)), 'on the wet stone', line.a, line.b);
  dunLights(ctx, walls.concat(ends), Math.max(1, Math.min(4, Math.round(Lr / 18))), 'a torch over the walkway');
  const key = inWater.find(p => p.rule === 'outfall') || strips[0] || ctx.placements.find(p => /sewer/.test(p.id)) || null;
  if (!key && wide >= 8.5) return { fail: 'sewer has no channel or outfall (no sewer flat or mesh)' };
  ctx.dunInfo = { kind: 'sewer', strips: strips.length, inWater: inWater.map(p => p.id) };
  ccmDone(ctx);
  return { feature: null, what: strips.length ? `a channel ${Math.round(Lr)} ft long with a walkway beside it, ${inWater.length} things in the water` : 'a culvert with an outfall in the wall', approach: null, passage: true };
}

// PUZZLE HALL (terminal): the sealed rune door on the wall facing the entrance (the puzzle's lock) with an orb pedestal
// each side; a square of rune tiles in the middle of the floor (or the mosaic, one hall in three); a turning statue at each
// corner of the square, each facing its own way; the sliding block off to one side with its scrape marks; levers by the entrance.
function dunPuzzleHall(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), small = Math.min(ctx.W, ctx.D), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const door = dunFocal(ctx, far, ['door-rune-sealed', 'door-face-carved', 'tomb-door-sealed'], { label: 'sealed door', rule: 'key-sealed', gap: 0.02, why: 'the sealed door: the puzzle\'s lock, on the wall facing the entrance' });
  if (door) ccmFlank(ctx, door, ['orb-socket-pedestal', 'obelisk-rune', 'pedestal-display'], { off: 1.2, layer: 'anchor', why: 'an orb pedestal each side of the sealed door' });
  const g = small >= 24 ? 3 : small >= 14 ? 2 : 0, T = 4.6, mosaic = g && dunSeed(ctx, 'mosaic') % 3 === 0 && ccmHas(ctx, 'floor-mosaic');
  const tiles = [];
  if (mosaic) { const p = dunFlat(ctx, 'floor-mosaic', cx, cz, 0, 'the mosaic: the answer is in the floor', { rule: 'key-floor', layer: 'anchor' }); if (p) tiles.push(p); }
  else if (g && ccmHas(ctx, 'rune-tile')) for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) { const p = dunFlat(ctx, 'rune-tile', cx + (i - (g - 1) / 2) * T, cz + (j - (g - 1) / 2) * T, (dunSeed(ctx, 'tile', i, j) % 4) * Math.PI / 2, 'a rune tile: step on them in the right order', { size: [T - 0.1, T - 0.1], rule: 'key-floor', layer: 'anchor' }); if (p) tiles.push(p); }
  const half = mosaic ? 5 : g * T / 2, statues = [];
  if (g) for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]].slice(0, small >= 19 ? 4 : 2)) { const id = ccmFirst(ctx, ['statue-rotating', 'statue-guardian']); if (!id) break; const k = half + 1.9;
    const p = castlePut(ctx, id, [[cx + sx * k, cz + sz * k, (dunSeed(ctx, 'statue', sx, sz) % 4) * Math.PI / 2], [cx + sx * (k + 0.8), cz + sz * (k + 0.8), 0]], { layer: 'anchor', rule: 'puzzle-statue', why: 'a turning statue at the corner of the tiles, facing its own way' }); if (p) statues.push(p); }
  const key = door || tiles[0] || statues[0] || ccmCentre(ctx, ['puzzle-dial-pillar', 'block-sliding', 'orb-socket-pedestal'], { label: 'puzzle', why: 'the puzzle: in the middle of the floor' });
  if (!key) return { fail: 'puzzle hall has no puzzle (no sealed door, rune tile or statue)' };
  dunWalks(ctx, door ? front(door, 2) : [cx, cz]);
  dunSight(ctx, key);
  const block = ccmHas(ctx, 'block-sliding') && cells >= 16 ? ccmQuiet(ctx, () => ctx.wall('block-sliding', { sides: lat, layer: 'anchor', gap: 1.6, why: 'the sliding block, pushed off to one side' })) : null;
  if (block && ccmHas(ctx, 'decal-drag-marks')) ccmQuiet(ctx, () => ctx.rug('decal-drag-marks', { at: front(block, 2), rot: block.rot + Math.PI / 2, why: 'the block\'s scrape marks' }));
  if (cells >= 20) dunWalls(ctx, ['puzzle-dial-pillar', 'obelisk-rune'], lat, 2, 'against the side wall');
  if (d) { if (!ccmQuiet(ctx, () => ccmHas(ctx, 'lever-floor') && ctx.wall('lever-floor', { sides: [d.side, ...lat], prefer: 'near', near: d.inner, why: 'a lever by the entrance' }))) castleHang(ctx, ['lever-wall'], [d.side], 1, { height: 4.6, why: 'a lever by the entrance' }); if (cells >= 25) castleHang(ctx, ['lever-wall'], lat, 2, { height: 4.6, why: 'one of the levers' }); }
  if (cells >= 16 && ctx.chance(0.6)) dunWalls(ctx, ['adventurer-remains', 'bones-pile'], [...(d ? [d.side] : []), ...lat], 1, 'one who guessed wrong', { prefer: 'corner' });
  if (ccmHas(ctx, 'decal-glyph-warding') && door) ccmQuiet(ctx, () => ctx.rug('decal-glyph-warding', { at: front(door, 1.6), why: 'a warding glyph before the sealed door' }));
  dunLights(ctx, [...lat, far, ...(d ? [d.side] : [])], Math.max(2, Math.min(5, Math.round(ctx.area() / 220))), 'a torch on the wall');
  ctx.dunInfo = { kind: 'puzzle-hall', door: door?.id || null, tiles: tiles.length, statues: statues.length, block: !!block, mosaic: !!mosaic };
  ccmDone(ctx);
  return { feature: dunSeen(ctx, [door, ...statues, key]), what: `${door ? 'the sealed door on the far wall, ' : ''}${mosaic ? 'the mosaic' : `${tiles.length} rune tiles`} in the floor, ${statues.length} turning statues${block ? ', the sliding block' : ''}`, approach: null, passage: true };
}

// CHASM CROSSING (passage): the floor is cut from wall to wall by a chasm (a row of strip flats, kept clear: 10 ft wide
// where the room is 24 ft deep and the wide strip exists, else 5 ft), across the way from the door. The stone bridge lies on
// the door's own line and the walk goes over it; posts stand at its ends, pillar tops stand in the gap as the other way over.
function dunChasm(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, ns = far === 'N' || far === 'S';
  const wideOk = deep >= 24 && ccmHas(ctx, 'chasm-strip-wide'), id = wideOk ? 'chasm-strip-wide' : ccmFirst(ctx, ['chasm-strip', 'chasm-strip-wide', 'pit-open']), gap = id === 'chasm-strip-wide' ? 10 : 5;
  if (!id || deep < gap + 8) return { fail: !id ? 'chasm crossing has no chasm (no strip flat)' : 'chasm crossing: the room is too short for a chasm and two banks' };
  const sMid = deep / 2, n = Math.max(1, Math.round((L + 1) / 5)), w = L / n, rot = ns ? 0 : Math.PI / 2, strips = [];
  for (let k = 0; k < n; k++) { const [x, z] = ctx.sidePoint(far, (k + 0.5) * w, sMid); const p = dunFlat(ctx, id, x, z, rot, 'the chasm: a drop from wall to wall', { size: [w, gap], rule: 'key-chasm', layer: 'anchor' }); if (p) strips.push(p); }
  if (!strips.length) return { fail: 'chasm crossing: the chasm could not be laid' };
  // the crossing line: straight out from the main door (held 3 ft clear of the side walls)
  const tDoor = d ? (ns ? d.inner[0] - ctx.X0 : d.inner[1] - ctx.Z0) : L / 2, tc0 = far === 'N' || far === 'W' ? tDoor : tDoor, tc = Math.max(3, Math.min(L - 3, d && (d.side === far || d.side === OPP_SIDE[far]) ? tc0 : L / 2));
  const on = (s, t = tc) => ctx.sidePoint(far, far === 'S' || far === 'E' ? L - t : t, s), near = on(deep - 1.6), farPt = on(1.8), bridgeId = ccmFirst(ctx, ['bridge-stone-natural', 'plank-bridge']);
  const other = ctx.doors.find(o => o !== d && o.side === far);
  const path = ccmWalk(ctx, 'through', [d ? d.inner : near, on(sMid + gap / 2 + 1.5), on(sMid - gap / 2 - 1.5), other ? other.inner : farPt], { width: 3 });
  for (const o of ctx.doors) if (o !== d && o !== other) ccmWalk(ctx, 'branch', [o.inner, on(o.side === far ? 3 : deep - 3)]);
  let bridge = null;
  if (bridgeId && deep >= 17 && !ctx.doors.some(o => o.side !== far && o.side !== OPP_SIDE[far] && segDist(o.inner, on(1), on(deep - 1)) < 4.5)) { const bd = ccmSize(ctx, bridgeId)[1], k = Math.min(1, (deep - 6.5) / bd, Math.max(0.6, (gap + 4) / bd)); bridge = ccmScaled(ctx, bridgeId, k, () => castlePut(ctx, bridgeId, [[...on(sMid), SIDES[far].rot], [...on(sMid, tc + 0.5), SIDES[far].rot], [...on(sMid, tc - 0.5), SIDES[far].rot]], { allowKeep: true, layer: 'anchor', rule: 'key-bridge', why: 'the bridge: on the door\'s line, over the chasm', unique: true })); }
  const inGap = [];
  if (false && ccmHas(ctx, 'stepping-pillars')) { /* (a pillar top in the gap read as a well cover) */ const t2 = tc > L / 2 ? Math.max(2.2, tc - Math.max(6, L / 3)) : Math.min(L - 2.2, tc + Math.max(6, L / 3)); for (const e of [0]) { const p = castlePut(ctx, 'stepping-pillars', [...on(sMid + e, t2 + e * 0.3), ctx.r(0, 6.28)], { layer: 'furnish', rule: 'in-chasm', why: 'a pillar top standing in the gap: the other way over' }); if (p) inGap.push(p); } }
  const [gx, gz] = ctx.sidePoint(far, L / 2, sMid); ctx.mark(gx, gz, ns ? L : gap - 0.6, ns ? gap - 0.6 : L);
  if (bridge && ccmHas(ctx, 'bridge-post-rope')) for (const s of [sMid + gap / 2 + 1.2, sMid - gap / 2 - 1.2]) for (const e of [-1, 1]) castlePut(ctx, 'bridge-post-rope', [...on(s, tc + e * (bridge.dims[0] / 2 + 1)), SIDES[far].rot], { layer: 'furnish', why: 'a post at the end of the bridge' });
  dunWalls(ctx, ['rubble-pile', 'bones-pile'], [OPP_SIDE[far], far, ...lat], Math.max(1, Math.round(ctx.area() / 250)), 'by the wall', { sku: { shape: 's2' } });
  dunFree(ctx, 'adventurer-remains', on(sMid + gap / 2 + 3.5, Math.max(2, Math.min(L - 2, tc + 4))), 5, 'one who did not cross', { margin: 0.2 });
  dunScatter(ctx, ['decal-cracks', 'decal-rubble-scatter'], Math.max(2, Math.round(ctx.area() / 90)), 'near the edge');
  dunLights(ctx, [OPP_SIDE[far], far, ...lat], Math.max(2, Math.min(4, Math.round(ctx.area() / 220))), 'a torch on the wall');
  ctx.dunInfo = { kind: 'chasm', gap, strips: strips.length, bridge: bridge?.id || null, pillars: inGap.length, crossed: !!(path && path.ok) };
  ccmDone(ctx);
  return { feature: null, what: `a ${gap}-ft chasm from wall to wall${bridge ? ', a bridge over it on the door\'s line' : ' (no bridge)'}${inGap.length ? `, ${inGap.length} pillar tops in the gap` : ''}`, approach: null, passage: true };
}

// MONSTER DEN (terminal): the nest in a far corner with its eggs, the picked carcass in the open floor, what it has caught
// wrapped along the walls, bones everywhere, the last party's remains nearest the door. One torch, by the door: dark.
function dunDen(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), area = ctx.area(), L = ctx.sideLen(far), side = lat[dunSeed(ctx, 'nest') % 2];
  const corner = ctx.sidePoint(far, side === lat[0] ? 3.5 : L - 3.5, 3.5);
  const nest = (ccmHas(ctx, 'nest-monster') && Math.min(ctx.W, ctx.D) >= 13 ? ccmQuiet(ctx, () => ctx.free('nest-monster', { near: corner, radius: 9, margin: 0.2, layer: 'anchor', rule: 'key-nest', why: 'the nest: in the far corner, away from the door', unique: true })) : null)
    || ccmQuiet(ctx, () => ccmScaled(ctx, 'bones-pile', 1.6, () => ctx.wall('bones-pile', { sides: [far], layer: 'anchor', rule: 'key-nest', why: 'the heap it sleeps on, against the far wall', unique: true })));
  if (!nest) return { fail: 'monster den has no nest or bone heap' };
  dunWalks(ctx, [nest.x + (d ? Math.sign(d.inner[0] - nest.x) : 0) * (nest.dims[0] / 2 + 1.6), nest.z + (d ? Math.sign(d.inner[1] - nest.z) : 1) * (nest.dims[2] / 2 + 1.6)]);
  dunSight(ctx, nest);
  dunFree(ctx, 'eggs-monster', [nest.x, nest.z], Math.max(nest.dims[0], nest.dims[2]) / 2 + 3.5, 'a clutch of eggs beside the nest', { margin: 0.2, layer: 'anchor' });
  const carcass = cells >= 16 ? dunFree(ctx, 'carcass-ribcage', [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], 6, 'the picked carcass of something big, in the open floor', { margin: 0.6, rot: ctx.r(0, Math.PI) }) : null;
  const cocoons = dunWalls(ctx, ['web-cocoon'], [far, ...lat], Math.max(1, Math.min(5, Math.round(cells / 7))), 'what it has caught, wrapped and kept by the wall');
  for (const c of cocoons.slice(0, 2)) if (ccmHas(ctx, 'decal-web-floor')) ccmQuiet(ctx, () => ctx.rug('decal-web-floor', { at: front(c, 1.5), why: 'web across the floor' }));
  const heaps = dunWalls(ctx, ['bones-pile', 'skull-pile', 'refuse-pile', 'bones-pile'], [...lat, far, ...(d ? [d.side] : [])], Math.max(2, Math.min(6, Math.round(cells / 6))), 'bones heaped by the wall');
  const dead = d ? [dunFree(ctx, 'adventurer-remains', d.inner, 9, 'the last party: nearest the door', { margin: 0.3 }), cells >= 25 ? dunFree(ctx, 'adventurer-remains', [(d.inner[0] + nest.x) / 2, (d.inner[1] + nest.z) / 2], 6, 'one who got further', { margin: 0.3 }) : null].filter(Boolean) : [];
  if (cells >= 12) dunWalls(ctx, ['stalagmite', 'mushroom-cave-giant'], [...lat, far], Math.max(1, Math.round(cells / 10)), 'grown from the rock floor', { prefer: 'corner' });
  if (d && ccmHas(ctx, 'decal-claw-marks')) ccmQuiet(ctx, () => ctx.rug('decal-claw-marks', { at: [d.inner[0] + (nest.x - d.inner[0]) * 0.3, d.inner[1] + (nest.z - d.inner[1]) * 0.3], why: 'claw marks inside the door' }));
  dunScatter(ctx, ['decal-bones-scatter', 'decal-bones-scatter', 'decal-bones-scatter', 'decal-blood', 'decal-slime'], Math.max(3, Math.round(area / 45)), 'on the den floor');
  dunLights(ctx, d ? [d.side] : lat, 1, 'one torch by the door (the den is dark)');
  ctx.dunInfo = { kind: 'den', nest: nest.id, cocoons: cocoons.length, heaps: heaps.length, dead: dead.length, carcass: !!carcass };
  ccmDone(ctx);
  return { feature: nest, what: `the nest in the far corner, ${cocoons.length} wrapped victims, ${heaps.length} heaps of bones, ${dead.length} of the last party`, approach: null, passage: true };
}

// SHRINE (terminal): the shrine on the wall facing the door, a candle each side, an offering and a kneeler before it; candle
// trays and urns along the side walls as it grows; two stone benches at most (more reads as a chapel, which the temple has).
function dunShrine(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), lat = ccmLat(far), cells = ccmCells(ctx);
  const shrine = dunFocal(ctx, far, cells >= 16 ? ['statue-forgotten-god', 'shrine-wayside', 'altar-stone', 'statue-weeping-angel'] : ['shrine-wayside', 'statue-forgotten-god', 'altar-stone', 'statue-weeping-angel'], { label: 'shrine', rule: 'key-shrine', loose: false, why: 'the shrine: centred on the wall facing the door' })
    || dunFocal(ctx, far, ['shrine-wayside', 'altar-stone', 'statue-weeping-angel'], { label: 'shrine', rule: 'key-shrine', why: 'the shrine: on the wall facing the door' });
  if (!shrine) return { fail: 'shrine has no shrine (no shrine, idol or altar mesh)' };
  dunSight(ctx, shrine);
  const lights = ccmFlank(ctx, shrine, ['rite-pillar-candle-tall', 'candlestick-floor', 'candlestand-pricket', 'brazier-standing'], { off: 0.5, why: 'a tall candle each side of the shrine' });
  if (ccmHas(ctx, 'offering-bowl')) castlePut(ctx, 'offering-bowl', [...front(shrine, 0.8), shrine.rot], { layer: 'dress', rule: 'offering', why: 'an offering bowl before the shrine' });
  if (ccmHas(ctx, 'rite-kneeler-cushion') && cells >= 6) castlePut(ctx, 'rite-kneeler-cushion', [...front(shrine, 2.4), shrine.rot + Math.PI], { layer: 'dress', why: 'a kneeler before the shrine' });
  dunWalks(ctx, front(shrine, 3.4));
  if (cells >= 9) dunWalls(ctx, ['rite-offering-candles-tray', 'rite-memorial-sand-tray', 'urn-decorative'], lat, Math.min(4, Math.round(cells / 5)), 'against the side wall', { layer: 'light' });
  if (cells >= 20) ccmAlong(ctx, ['bench-stone'], lat, 2, { why: 'a stone bench along the side wall' });
  if (cells >= 16 && d) for (const s of lat) ccmCorner(ctx, ccmFirst(ctx, ['statue-guardian', 'urn-decorative']), [d.side, s], { why: 'in the corner by the door', inset: 0.4 });
  dunScatter(ctx, ['decal-moss', 'decal-cracks'], Math.max(1, Math.round(ctx.area() / 110)), 'on the old floor');
  ccmWallLights(ctx, DUN_TORCH, d ? [d.side] : lat, { every: 999, min: cells >= 16 ? 2 : lights.length ? 0 : 1, max: 2, why: 'a torch on the door wall' });
  ccmEnsureLight(ctx, DUN_TORCH, DUN_STAND);
  ctx.dunInfo = { kind: 'shrine', shrine: shrine.id, candles: lights.length };
  ccmDone(ctx);
  return { feature: shrine, what: `the shrine (${shrine.id}) on the far wall, ${lights.length} candles beside it, an offering before it`, approach: null, passage: true };
}

// FLOODED CHAMBER (terminal): the floor IS water (the room type's only floor). Pillars stand in it in two rows with a tide
// mark; a statue on the far wall; pillar tops lead from the door toward it as stepping stones; crates float; rubble breaks the surface.
function dunFlooded(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const statue = dunFocal(ctx, far, ['sewer-outflow', 'sewer-grate', 'fountain-wall-skull'], { label: 'outfall', rule: 'key-statue', why: 'where the water comes in: on the wall facing the door' }); // (a statue there made the room a shrine in every blind read)
  const target = statue ? front(statue, 2) : ctx.sidePoint(far, L / 2, 3);
  dunWalks(ctx, target);
  const pil = ccmFirst(ctx, ['pillar-waterline', 'pillar-square', 'pillar-round']), pillars = [];
  if (pil && L >= 13.5) { const nz = Math.max(1, Math.round(deep / 11)); for (let j = 0; j < nz; j++) for (const f of [0.22, 0.78]) { const [x, z] = ctx.sidePoint(far, L * f, deep * (j + 0.5) / nz); const p = castlePut(ctx, pil, [[x, z, 0], [x + 0.7, z, 0], [x - 0.7, z, 0]], { layer: 'anchor', rule: 'key-pillar', why: 'a pillar standing in the water, a tide mark round it' }); if (p) pillars.push(p); } }
  const key = statue || pillars[0];
  if (!key) return { fail: 'flooded chamber has no statue or pillar standing in the water' };
  dunSight(ctx, key);
  const stones = [];
  if (d && ccmHas(ctx, 'stepping-pillars')) { const dx = target[0] - d.inner[0], dz = target[1] - d.inner[1], len = Math.hypot(dx, dz), n = Math.min(6, Math.floor(len / 4.5)); for (let i = 1; i <= n; i++) { const f = i / (n + 1), e = (i % 2 ? 1 : -1) * 0.5; if (dunAtDoor(ctx, d.inner[0] + dx * f, d.inner[1] + dz * f, 4.6)) continue; const p = castlePut(ctx, 'stepping-pillars', [d.inner[0] + dx * f + (dz / len) * e, d.inner[1] + dz * f - (dx / len) * e, ctx.r(0, 6.28)], { allowKeep: true, layer: 'furnish', rule: 'stepping-stone', why: 'a pillar top above the water: the dry way across' }); if (p) stones.push(p); } }
  const flot = []; for (let i = 0, n = Math.max(2, Math.min(5, Math.round(cells / 6))); i < n; i++) { const p = dunFree(ctx, ccmAny(ctx, ['flotsam-crate', 'flotsam-crate', 'barrel']), [ctx.r(ctx.X0 + 3, ctx.X1 - 3), ctx.r(ctx.Z0 + 3, ctx.Z1 - 3)], 6, 'floating in the water', { margin: 0.4, rot: ctx.r(0, 6.28) }); if (p) flot.push(p); }
  dunWalls(ctx, ['rubble-pile', 'column-drums-fallen', 'collapse-rubble'], [...lat, far], Math.max(1, Math.round(cells / 10)), 'breaking the surface by the wall', { sku: { shape: 's2' } });
  if (statue?.id !== 'sewer-grate') dunWalls(ctx, ['sewer-grate'], lat, 1, 'a barred drain in the side wall', { layer: 'anchor' });
  dunLights(ctx, [...lat, ...(d ? [d.side] : [])], Math.max(1, Math.min(3, Math.round(ctx.area() / 250))), 'a torch above the water');
  ctx.dunInfo = { kind: 'flooded', statue: statue?.id || null, pillars: pillars.length, stones: stones.length, flotsam: flot.length };
  ccmDone(ctx);
  return { feature: key, what: `water wall to wall, ${pillars.length} pillars standing in it${statue ? ', an outfall in the far wall' : ''}, ${stones.length} stepping stones from the door`, approach: null, passage: true };
}

// COLLAPSED HALL (terminal): the far end of a pillared hall has come down. Rock falls side by side along the far wall, a
// ceiling slab and fallen column drums before them; two rows of columns, whole near the door and broken toward the fall;
// a timber prop someone set; a body at the foot of the rubble.
function dunCollapsed(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const falls = [];
  for (let i = 0, n = Math.max(1, Math.floor((L + 0.3) / 9.3)); i < n; i++) { const t = L * (i + 0.5) / n; const p = ccmQuiet(ctx, () => { const id = ccmFirst(ctx, ['collapse-rubble', 'rubble-pile', 'stone-blocks-stack']); return id && ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap: 0.05 }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'key-collapse', why: 'the fall: rock down across the far end of the hall', sku: L / n < 9.2 ? { shape: 's2' } : { shape: '' } }); }); if (p) falls.push(p); }
  if (!falls.length) return { fail: 'collapsed hall has no rubble (no collapse or rubble mesh)' };
  const key = falls[Math.floor(falls.length / 2)], reach = Math.max(...falls.map(p => p.dims[2])) + 0.5;
  dunWalks(ctx, ctx.sidePoint(far, L / 2, Math.min(deep - 2, reach + 5)));
  dunSight(ctx, key);
  ctx.focal = { label: 'rock fall', id: key.id, side: far, ok: true };
  const cols = [];
  if (L >= 13.5 && deep >= 18) { const nz = Math.max(2, Math.round((deep - reach) / 9)); for (let j = 0; j < nz; j++) for (const f of [0.2, 0.8]) { const s = reach + 2 + (deep - reach - 4) * (j + 0.5) / nz, broken = j < nz / 2, id = ccmFirst(ctx, broken ? ['pillar-broken', 'pillar-round'] : ['pillar-round', 'pillar-square', 'pillar-broken']); if (!id) continue; const [x, z] = ctx.sidePoint(far, L * f, s); const p = castlePut(ctx, id, [[x, z, 0], [x, z + 0.8, 0], [x + 0.8, z, 0]], { layer: 'anchor', rule: 'column', why: broken ? 'a column snapped by the fall' : 'a column still standing, near the door' }); if (p) cols.push(p); } }
  const mid = ctx.sidePoint(far, L / 2, reach + 4);
  dunFree(ctx, 'collapse-rubble', mid, 6, 'more of the roof, down in the middle of the hall', { margin: 0.6, sku: { shape: 's2' }, rot: ctx.r(0, 6.28) });
  const drums = dunFree(ctx, 'column-drums-fallen', ctx.sidePoint(far, L * 0.7, reach + 7), 7, 'column drums toppled across the floor', { margin: 0.5, rot: SIDES[far].rot + 0.6 }), slab = dunFree(ctx, 'ceiling-slab-fallen', ctx.sidePoint(far, L * 0.3, reach + 3), 7, 'a slab of the ceiling, down and cracked', { margin: 0.4, rot: ctx.r(0, 3.14) });
  const piles = []; for (let i = 0, n = Math.max(2, Math.min(7, Math.round(cells / 6))); i < n; i++) { const p = dunFree(ctx, 'rubble-pile', [ctx.r(ctx.X0 + 2, ctx.X1 - 2), ctx.r(ctx.Z0 + 2, ctx.Z1 - 2)], 6, 'fallen stone on the floor', { margin: 0.5, rot: ctx.r(0, 6.28), sku: i % 2 ? { shape: 's2' } : undefined }); if (p) piles.push(p); }
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks', 'decal-rubble-scatter'], Math.max(3, Math.round(ctx.area() / 45)), 'chips, dust and cracks');
  dunLights(ctx, [...(d ? [d.side] : []), ...lat], Math.max(1, Math.min(3, Math.round(ctx.area() / 260))), 'a torch on the wall that still stands');
  ctx.dunInfo = { kind: 'collapsed', falls: falls.length, columns: cols.length, broken: cols.filter(p => p.id === 'pillar-broken').length, piles: piles.length, drums: !!drums, slab: !!slab };
  ccmDone(ctx);
  return { feature: dunSeen(ctx, falls), what: `${falls.length} rock fall${falls.length > 1 ? 's' : ''} across the far end, ${cols.length} columns (${cols.filter(p => p.id === 'pillar-broken').length} broken), ${piles.length} piles of fallen stone`, approach: null, passage: true };
}

// the leg of a shaped room: wall things and a torch, never the key piece
function dunAnnex(ctx, { wall = [], hung = [], n = null } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']), k = n ?? Math.max(1, Math.round(ctx.area() / 120));
  dunWalls(ctx, wall, sides, k, 'against the wall');
  castleHang(ctx, hung, sides, hung.length ? k : 0, { height: 4.4, why: 'on the wall' });
  dunScatter(ctx, ['decal-cracks', 'decal-moss'], 1, 'on the floor');
  dunLights(ctx, sides, 1);
}
Object.assign(KEY, { 'dun-corridor': dunCorridor, 'dun-trap-corridor': dunTrapCorridor, 'dun-dead-end': dunDeadEnd, 'dun-cell-block': dunCellBlock, 'dun-guard-room': dunGuardRoom, 'dun-interrogation': dunInterrogation,
  'dun-vault': dunVault, 'dun-sewer': dunSewer, 'dun-puzzle-hall': dunPuzzleHall, 'dun-chasm': dunChasm, 'dun-den': dunDen, 'dun-shrine': dunShrine, 'dun-flooded': dunFlooded, 'dun-collapsed': dunCollapsed });
Object.assign(MENUS, {
  'dun-corridor': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['rubble-pile', 'bones-pile'], n: 1 })),
  'dun-trap-corridor': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['bones-pile'], hung: ['lever-wall'], n: 1 })),
  'dun-dead-end': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['rubble-pile'], n: 1 })),
  'dun-cell-block': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['bucket-slop', 'chain-pile', 'barrel'], hung: ['manacles-wall'] })),
  'dun-guard-room': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['barrel', 'chest-ironbound', 'weapon-rack'], hung: ['mil-helmet-peg-rack'] })),
  'dun-interrogation': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['stocks', 'bucket-slop'], hung: ['manacles-wall'] })),
  'dun-vault': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['strongbox-stack', 'chest-ironbound', 'coin-pile'] })),
  'dun-sewer': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['refuse-pile', 'barrel'] })),
  'dun-puzzle-hall': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['obelisk-rune', 'statue-guardian'], hung: ['lever-wall'] })),
  'dun-chasm': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['rubble-pile'] })),
  'dun-den': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['bones-pile', 'web-cocoon', 'refuse-pile'] })),
  'dun-shrine': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['urn-decorative', 'bench-stone'] })),
  'dun-flooded': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['rubble-pile', 'flotsam-crate'] })),
  'dun-collapsed': ccmAnnex((ctx) => dunAnnex(ctx, { wall: ['rubble-pile', 'pillar-broken'] })),
});
// (no indoor target under 3.5: test/yard.test.mjs holds the yard's against 0.6x of every other entry)
Object.assign(DENSITY, { 'dun-corridor': 3.5, 'dun-trap-corridor': 3.5, 'dun-dead-end': 3.5, 'dun-cell-block': 5, 'dun-guard-room': 5, 'dun-interrogation': 4.5, 'dun-vault': 5, 'dun-sewer': 3.5, 'dun-puzzle-hall': 3.5, 'dun-chasm': 3.5, 'dun-den': 4.5, 'dun-shrine': 4.5, 'dun-flooded': 3.5, 'dun-collapsed': 4 });
Object.assign(FOCAL, { 'dun-dead-end': 'what the passage ends at (rock fall, sealed door, statue or chest)', 'dun-interrogation': 'the restraint chair (in the middle of the floor)', 'dun-vault': 'the great chest (wall facing the door)', 'dun-puzzle-hall': 'the sealed rune door (wall facing the entrance)', 'dun-shrine': 'the shrine (wall facing the door)', 'dun-flooded': 'the drowned statue', 'dun-collapsed': 'the rock fall' });
Object.assign(KEY_RE, { 'dun-corridor': null, 'dun-trap-corridor': /^(pressure-plate|trap-|pit-open|bear-trap)/, 'dun-dead-end': /^(collapse-rubble|rubble-pile|door-rune-sealed|door-face-carved|tomb-door-sealed|statue-|shrine-wayside|mimic-chest|chest-)/, 'dun-cell-block': /^(cell-bars|door-cell-bars)/,
  'dun-guard-room': /^table-/, 'dun-interrogation': /^(chair-interrogation|rack-torture)$/, 'dun-vault': /^(chest-treasure|dun-treasure-hoard|treasure-hoard|chest-ironbound)/, 'dun-sewer': /^sewer-/, 'dun-puzzle-hall': /^(door-rune-sealed|door-face-carved|tomb-door-sealed|rune-tile|floor-mosaic|statue-rotating|puzzle-dial-pillar|block-sliding|orb-socket-pedestal)/,
  'dun-chasm': /^(chasm-strip|pit-open)/, 'dun-den': /^(nest-monster|bones-pile)$/, 'dun-shrine': /^(shrine-wayside|statue-forgotten-god|altar-stone|statue-weeping-angel)$/, 'dun-flooded': /^(statue-|pillar-|fountain-wall-skull|sewer-grate)/, 'dun-collapsed': /^(collapse-rubble|rubble-pile|stone-blocks-stack)$/ });
// <<< type:dun

// >>> wiz:solver2.wizard
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
// <<< wiz:solver2.wizard

// >>> mkt:solver2
// ======================= market & village (2026-10-11) =======================
// Twelve rooms, appended like castle / crypt / mansion (helpers ccm*, castlePut, front, surfaceAt are the ones above).
//
// THE SHOP SKELETON. Every shop is the same room: the counter facing the door with the keeper's lane behind it, stocked
// shelves on the wall behind and down the side walls, a display table and the trade's own pieces in the floor before the
// counter, floor stock by the counter and the door, the shop window in the street wall (walls.js PANELS). The TRADE is
// data: MKT_TRADES[room key] names a sku tier and the trade's signature pieces. The room type lists that tier first
// (build_data.py `tiers`), so chooseSku rolls the baker's counter in the bakery and the tailor's in the tailor's.
// A NEW TRADE = meshes for the five skeleton roles in a new tier + one line here + one room-type line in build_data.py.
//   shelf: only this shape of the stocked shelf (the tailor's chest-high unit, folded cloth on its top, read as a bed)
//   show: pieces set out in a row before the counter · noTable: no cloth-covered display table (the tailor's read as a bed)
//   where: 'far' centred on the wall behind the counter · 'wall' against a side wall · 'floor' in the floor before the counter
const MKT_TRADES = {
  'mkt-general': { tier: 'mkt-general', name: 'general store', hero: [['bins-dry-goods', 'wall']], floor: ['barrel', 'sack', 'crate', 'spice-sacks-open', 'pottery-for-sale', 'baskets-stack', 'rope-coil'], by: ['barrel', 'crate'], sign: 'shop-sign' },
  'mkt-bakery': { tier: 'mkt-bakery', name: 'bakery', hero: [['bread-oven', 'wall'], ['bread-rack', 'wall'], ['dough-trough', 'floor'], ['pretzel-rack', 'wall']], floor: ['flour-sack-open', 'flour-bin', 'sack', 'firewood-basket', 'barley-sack'], by: ['trade-bread-crate-delivery', 'flour-sack-open'], sign: 'trade-sign-pretzel',
    table: ['bread-loaf', 'pastry-tray', 'pie', 'bread-pile', 'bread-rolls-basket', 'cake-round'] },
  'mkt-apothecary': { tier: 'mkt-apoth', name: 'apothecary', hero: [['apothecary-drawers', 'far'], ['trade-tincture-rack', 'wall'], ['table-side', 'floor']], floor: ['spice-sacks-open', 'crate', 'demijohn', 'jar-lidded-stoneware'], by: ['planter-barrel', 'crate'], sign: 'shop-sign',
    table: ['mortar-wood', 'dried-herbs-jar', 'spice-jars', 'bottle-cluster', 'herb-bundle-fresh', 'scales-balance'] },
  'mkt-tailor': { tier: 'mkt-tailor', name: "tailor's shop", hero: [['cutting-table-tailor', 'floor'], ['mirror-standing', 'wall'], ['spinning-wheel', 'wall']], show: ['dress-form', 'dress-form', 'dress-form'], shelf: 'tailor', noTable: true, floor: ['baskets-stack', 'chest-plain', 'basket-laundry'], by: ['dress-form'], sign: 'shop-sign', rug: ['rug-striped-woven', 'rug-oval'] },
  'mkt-curio': { tier: 'mkt-curio', name: 'curio shop', hero: [['display-case-glass', 'floor'], ['pedestal-display', 'floor'], ['telescope', 'wall'], ['trade-globe-terrestrial', 'floor'], ['pedestal-display', 'floor']], floor: ['chest-ironbound', 'trunk-travel', 'book-pile-floor', 'urn-decorative'], by: ['urn-decorative'], sign: 'shop-sign', rug: ['rug-round-fine', 'rug-oval'] },
};
const MKT_TIERS = Object.values(MKT_TRADES).map(t => t.tier);
const MKT_LAMPS = ['lantern-wall-iron', 'lantern-wall-brass', 'lantern-wall-horn', 'candle-box-sconce'];
// one placement rolled in another trade's stock (the back room behind a bakery, a stall table in the square): chooseSku
// reads the room type's `tiers`, and ctx.mount / ctx.surface take no `sku` wish, so the type is swapped for the call
function mktAs(ctx, tier, fn) { if (!tier) return fn(); const t0 = ctx.type; ctx.type = { ...t0, tiers: [tier, 'mkt'] }; try { return fn(); } finally { ctx.type = t0; } }
const mktTradeOf = (ctx, to) => MKT_TRADES[ctx.typesOf?.(to) || ''] || null;
const mktSkuSize = (ctx, id) => { const ds = ctx.lib.objects[id] ? ctx.skuPool(id).map(k => ctx.nominalDims(id, k)) : []; return ds.length ? [Math.max(...ds.map(d => d.w)), Math.max(...ds.map(d => d.d))] : [2, 2]; }; // a role's largest footprint as its meshes really are (the stalls came out 8 ft wide and 5.5 to 8.5 ft deep; the catalog line says 6 x 9)
// a hub's doors are joined to each other before anything stands (attempt() draws a door-to-door loop through a hub AFTER its program)
function mktDoorWays(ctx) { for (let i = 0; i < ctx.doors.length; i++) for (let j = i + 1; j < ctx.doors.length; j++) ccmWalk(ctx, 'branch', [ctx.doors[i].inner, ctx.doors[j].inner]); }
// a thing standing in the floor at (or as near as it fits to) a spot, turned `rot`
function mktNear(ctx, id, at, rot, { why = '', layer = 'furnish', rule = 'shop-floor', reach = 5, step = 0.5, sku, box = null } = {}) {
  if (!ccmHas(ctx, id)) return null;
  return ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (let dx = -reach; dx <= reach + 1e-6; dx += step) for (let dz = -reach; dz <= reach + 1e-6; dz += step) { const x = at[0] + dx, z = at[1] + dz; if (box && (x < box[0] || x > box[2] || z < box[1] || z > box[3])) continue; yield { x, z, rot, r: Math.hypot(dx, dz) }; } }, (c) => c.r, { layer, rule, why, sku }));
}
// against a wall, as near a point as it fits
function mktWallNear(ctx, id, sides, near, { why = '', layer = 'furnish', rule = 'against-wall', gap = 0.05, max = 99, sku, windows = true } = {}) {
  if (!ccmHas(ctx, id) || !sides.length) return null;
  if (isHung(ctx.lib.objects[id], id)) return ccmQuiet(ctx, () => ctx.mount(id, { sides, layer, why }));
  const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, sides, { gap, step: 0.25, windows }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 20, { layer, rule, why, sku }));
  return p;
}

function mktShop(ctx) {
  const T = MKT_TRADES[ctx.type.key] || MKT_TRADES['mkt-general'];
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot;
  const at = (t, s) => ctx.sidePoint(far, t, s);
  // the counter: parallel to the wall facing the door, a lane behind it for the keeper and the shelves (4.2 ft; 3.3 in a
  // shallow shop), as near the middle as the doors allow, at least 2.5 ft clear at one end to walk round
  const lane = deep >= 18 ? 4.2 : 3.7;
  const counter = ccmQuiet(ctx, () => ctx.put('counter-shop', function* (dm) { const m = L - dm.w >= 6 ? 1.2 : 0.3; for (let t = dm.w / 2 + m; t <= L - dm.w / 2 - m + 1e-6; t += 0.25) { if (Math.max(t - dm.w / 2, L - t - dm.w / 2) < 2.5) continue; const [x, z] = at(t, lane + dm.d / 2); yield { x, z, rot: toDoor, t }; } },
    (c) => Math.abs(c.t - L / 2), { layer: 'anchor', rule: 'key-counter', unique: true, why: `the ${T.name}'s counter: facing the door, the keeper's lane and the shelves behind it`, extra: { focal: true, side: far } }));
  if (!counter) return { fail: `${T.name} has no counter (no room for it before the ${SIDE_LABEL[far]} wall)` };
  ctx.focal = { label: 'shop counter', id: counter.id, side: far, ok: true };
  const ct = far === 'N' || far === 'S' ? counter.x - ctx.X0 : counter.z - ctx.Z0, cFront = lane + counter.dims[2];
  // walking lines, before anything else stands: door -> the counter's front; round the roomier end of the counter to the lane behind it
  if (d) { ctx.sight = [d.inner, [counter.x, counter.z]]; ctx.sightFeature = counter.id; ccmWalk(ctx, 'approach', [d.inner, at(ct, cFront + 1.7)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, at(ct, cFront + 1.7)]); }
  mktDoorWays(ctx);
  const endT = ct >= L / 2 ? ct - counter.dims[0] / 2 - 1.5 : ct + counter.dims[0] / 2 + 1.5;
  ccmWalk(ctx, 'service', [at(ct, cFront + 1.7), at(endT, cFront + 1.7), at(endT, lane - 1.0)], { width: 2.4 });
  { const [kx, kz] = at(ct, lane - 1.0), ns = far === 'N' || far === 'S'; ctx.mark(kx, kz, ns ? counter.dims[0] : 2, ns ? 2 : counter.dims[0], KEEP); } // the keeper's lane: 2 ft behind the counter, clear of the shelves on the wall
  const stool = ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['stool-three-leg', 'stool-bar', 'chair-plain']), [[...at(ct, lane - 1.0), toDoor], [...at(ct + 1.5, lane - 1.0), toDoor], [...at(ct - 1.5, lane - 1.0), toDoor]], { rule: 'keeper', why: "the keeper's stool behind the counter", allowKeep: true }));
  if (stool) ctx.command('keeper', stool, { flanks: false });
  // the trade's piece on the wall behind the counter (the apothecary's drawers), then the trade's wall pieces on the side walls
  const walls = [counter];
  for (const [id, where] of T.hero) if (where === 'far') { const p = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { step: 0.25 }), (c) => Math.abs(c.t - ct), { layer: 'anchor', rule: 'shop-hero', why: `the ${T.name}'s own piece, on the wall behind the counter` })); if (p) walls.push(p); }
  for (const [id, where] of T.hero) if (where === 'wall' && (cells >= 12 || !walls.some(p => p.rule === 'shop-hero'))) { const p = mktWallNear(ctx, id, lat, at(L / 2, deep * 0.55), { layer: 'anchor', rule: 'shop-hero', why: `the ${T.name}'s own piece, against a side wall` }); if (p) walls.push(p); }
  // stocked shelves: the wall behind the counter first, then the side walls, each butted against the last, until about
  // 45% of the wall is stock (the door wall is the shop window: it stays clear)
  const wallFt = 2 * (ctx.W + ctx.D); let stock = walls.slice(1).reduce((a, p) => a + p.dims[0], 0), shelves = 0;
  for (let k = 0; k < 24 && stock < wallFt * 0.45; k++) {
    const b = ccmQuiet(ctx, () => ctx.put('shop-shelf-stocked', (dm) => ctx.wallGen(dm, [far, ...lat], { step: 0.25 }), (c) => (c.side === far ? 0 : 5) + Math.min(...walls.map(q => Math.hypot(q.x - c.x, q.z - c.z))) * (c.side === far ? 0.2 : 1), { layer: 'store', rule: 'shop-shelf', why: 'stocked shelves, butted side by side along the wall', sku: T.shelf ? { shape: T.shelf } : undefined }));
    if (!b) break; walls.push(b); stock += b.dims[0]; shelves++;
  }
  if (!shelves && !walls.some(p => p.rule === 'shop-hero')) ctx.notes.push('no stocked shelf fitted on the walls');
  // the floor before the counter: one slot each side of the way in. The display table on one, the trade's floor pieces
  // on the other and beyond; all parallel to the side walls so the way to the counter stays open
  const s0 = cFront + 3.2, s1 = deep - 3, mid = (s0 + s1) / 2, slots = [], sideRot = toDoor + Math.PI / 2;
  if (s1 - s0 >= 2.5) { const first = ctx.ri(0, 1); for (const k of [first, 1 - first]) { const t = k ? L - Math.min(L * 0.27, 6) : Math.min(L * 0.27, 6); if (Math.abs(t - ct) >= 3.2 || L >= 13) slots.push(at(t, mid)); } if (L >= 28) slots.push(at(L / 2 - 6.5, mid), at(L / 2 + 6.5, mid)); }
  // on show before the counter (the tailor's dress forms): a row facing the door, either side of the way in. (Not in the shop
  // window: the wall nearest the table camera hides the 6 ft of floor behind it. They stand before anything else takes the floor.)
  const shown = [], showSide = T.show ? (ctx.chance(0.5) ? 1 : -1) : 0;
  if (T.show && s1 - cFront >= 5) { const side = showSide; for (const [i, id] of T.show.slice(0, L >= 18 ? 3 : 2).entries()) { const p = mktNear(ctx, id, at(ct + side * (2.7 + i * 2.3), cFront + 4.3), toDoor, { reach: 1.5, layer: 'anchor', rule: 'shop-show', why: 'on show before the counter, in a row to one side of the way in, facing the door' }); if (p) shown.push(p); } }
  const floorBox = [ctx.X0 + 1.9, ctx.Z0 + 1.9, ctx.X1 - 1.9, ctx.Z1 - 1.9], floorHeroes = T.hero.filter(h => h[1] === 'floor').map(h => h[0]), laid = [];
  const want = [...(L >= 13 && s1 - s0 >= 5 && !T.noTable ? ['craft-display-table-goods'] : []), ...floorHeroes, ...(cells >= 30 && !T.noTable ? ['craft-display-table-goods'] : [])];
  if (showSide && slots.length > 1) slots.sort((a, b) => (Math.hypot(b[0] - at(ct + showSide * 5, mid)[0], b[1] - at(ct + showSide * 5, mid)[1])) - (Math.hypot(a[0] - at(ct + showSide * 5, mid)[0], a[1] - at(ct + showSide * 5, mid)[1]))); // the floor pieces take the side the show does not
  for (let i = 0; i < want.length && slots.length; i++) { const id = want[i], spot = slots[i % slots.length], long = /table|case|trough/.test(id);
    const p = mktNear(ctx, id, spot, long ? sideRot : toDoor + Math.PI, { box: floorBox, reach: i < slots.length ? 2.5 : 6, why: id === 'craft-display-table-goods' ? 'the display table, in the floor before the counter' : `the ${T.name}'s own piece, in the floor before the counter`, layer: i < 2 ? 'anchor' : 'furnish', rule: 'shop-floor' });
    if (p) laid.push(p); }
  if (T.table) { const tb = laid.find(p => /^table-/.test(p.id)); if (tb) for (const id of ctx.pick(T.table, 3)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === tb.uid, why: 'on the table' })); }
  if (T.rug && s1 - s0 >= 5) ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, T.rug), { at: at(ct, cFront + 3.5), why: 'a rug before the counter' }));
  // floor stock: one at an end of the counter, one by the door, more against the walls as the shop grows
  ccmFlank(ctx, counter, ['shop-floor-stock'], { off: 0.5, n: 1, layer: 'store', rule: 'shop-stock', why: "the trade's stock, standing by the counter" });
  if (d) mktWallNear(ctx, 'shop-floor-stock', [d.side], d.inner, { layer: 'store', rule: 'shop-stock', why: "the trade's stock, by the door", windows: false, max: 9 });
  const extra = Math.max(1, Math.min(7, Math.round(cells / 6)));
  for (const id of ctx.pick(T.floor, extra)) mktWallNear(ctx, id, ctx.shuffle([...lat, far, ...(d ? [d.side] : [])]), null, { layer: 'store', rule: 'shop-stock', why: 'stock against the wall', windows: false });
  // on the walls: a price board, lanterns
  ccmQuiet(ctx, () => ctx.mount('price-board', { sides: lat, height: 5.4, why: 'the price board' }));
  ccmWallLights(ctx, MKT_LAMPS, d ? [d.side, ...lat] : lat, { every: 22, height: 6.4, why: 'a wall lantern', min: 1, max: 3 });
  ccmEnsureLight(ctx, MKT_LAMPS, ['candlestick-floor', 'candle-tree', 'candlestand-pricket']);
  ctx.shopInfo = { trade: T.name, tier: T.tier, shelves, stock: +(stock / wallFt).toFixed(2), floor: [...shown, ...laid].map(p => p.id) };
  if (shelves > 1) ctx.growth.push(`stocked shelves repeat along the walls: ${shelves} (${Math.round(stock / wallFt * 100)}% of the wall)`);
  ccmDone(ctx);
  return { feature: counter, what: `${T.name}: the counter, ${shelves} stocked shelves${laid.length ? ', ' + laid.length + ' piece' + (laid.length > 1 ? 's' : '') + ' in the floor' : ''}`, approach: null, passage: true };
}

// ---------------- the back room: the shop's store, shared by every trade. Its stock is the trade of the shop it opens off ----------------
function mktBackroom(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), ALL = ['N', 'S', 'E', 'W'];
  const nb = ctx.doors.map(o => o.to && mktTradeOf(ctx, o.to)).find(Boolean) || null, tier = nb ? nb.tier : 'mkt-general', sku = { tiers: [tier, 'mkt'] };
  const centre = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2];
  if (d) ccmWalk(ctx, 'approach', [d.inner, centre]);
  for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, centre]);
  // racks round the walls: the trade's stocked shelves and plain storeroom shelving in turn, the wall facing the door first
  const racks = [], wallFt = 2 * (ctx.W + ctx.D); let run = 0;
  for (let k = 0; k < 20 && run < wallFt * 0.4; k++) {
    const id = k % 3 === 1 && ccmHas(ctx, 'shop-shelf-stocked') ? 'shop-shelf-stocked' : ccmFirst(ctx, ['shelving-freestanding', 'shop-shelf-stocked']); /* (mostly plain storeroom shelving: a wall of stocked shelves read as a shop) */
    if (!id) break;
    const b = ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far, ...lat], { step: 0.25 }), (c) => (c.side === far ? 0 : 4) + (racks.length ? Math.min(...racks.map(q => Math.hypot(q.x - c.x, q.z - c.z))) * 0.5 : Math.abs(c.t - ctx.sideLen(c.side) / 2)), { layer: k ? 'store' : 'anchor', rule: 'store-rack', why: 'racks round the walls of the back room', sku: id === 'shop-shelf-stocked' ? sku : undefined, ...(k ? {} : { unique: true, extra: { focal: true } }) }));
    if (!b) break; racks.push(b); run += b.dims[0];
  }
  if (!racks.length) return { fail: 'back room has no rack on its walls' };
  ctx.focal = { label: 'store racks', id: racks[0].id, side: far, ok: true };
  if (d) { ctx.sight = [d.inner, [racks[0].x, racks[0].z]]; ctx.sightFeature = racks[0].id; }
  // the trade's stock standing on the floor, then crates, barrels and sacks, like with like, in the corners
  for (let i = 0, n = Math.max(1, Math.round(cells / 8)); i < n; i++) mktWallNear(ctx, 'shop-floor-stock', ctx.shuffle(ALL), racks[i % racks.length] ? [racks[i % racks.length].x, racks[i % racks.length].z] : null, { layer: 'store', rule: 'shop-stock', why: "the shop's stock, waiting to go out front", sku, windows: false });
  const kinds = ctx.shuffle(['crate', 'barrel', 'sack']).slice(0, cells >= 12 ? 3 : 2);
  for (const id of kinds) ctx.cornerPile([id], Math.max(2, Math.min(5, Math.round(cells / 5))), { why: 'stock stacked in a corner, like with like' });
  for (const id of ctx.pick((nb?.floor || MKT_TRADES['mkt-general'].floor).filter(i => !/crate|barrel|sack$/.test(i)), Math.max(1, Math.round(cells / 10)))) mktWallNear(ctx, id, ctx.shuffle(ALL), null, { layer: 'store', rule: 'shop-stock', why: 'stock against the wall', windows: false });
  // the tally desk by the door: the ledger, a candle, the strongbox beside it
  if (cells >= 9 && d) { const desk = mktWallNear(ctx, 'desk-writing', [d.side, ...lat], d.inner, { why: 'the tally desk, by the door', rule: 'tally' });
    if (desk) { for (const id of ['ledger-accounts', 'candlestick']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === desk.uid, layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the tally desk' }));
      ccmQuiet(ctx, () => ctx.companion(desk, 'stool-three-leg', { why: 'the stool at the tally desk', maxDist: 4 })); ccmQuiet(ctx, () => ctx.companion(desk, 'strongbox', { why: 'the strongbox by the desk', maxDist: 5 })); } }
  ccmQuiet(ctx, () => ctx.mount('key-hook-board', { sides: d ? [d.side] : ALL, height: 5.2, why: 'keys by the door' }));
  ccmWallLights(ctx, MKT_LAMPS, ALL, { every: 30, height: 6.4, why: 'a wall lantern', min: 1, max: 2 });
  ccmEnsureLight(ctx, MKT_LAMPS, ['candlestick-floor', 'candle-tree', 'candlestand-pricket']);
  ctx.shopInfo = { trade: nb ? nb.name : null, tier, shelves: racks.length };
  ccmDone(ctx);
  return { feature: racks[0], what: `back room: ${racks.length} racks${nb ? `, the ${nb.name}'s stock` : ''}`, approach: null, passage: true };
}

// ---------------- the watch post: the sergeant's desk facing the door, a timber lockup in a far corner ----------------
function mktWatch(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot, ALL = ['N', 'S', 'E', 'W'];
  const at = (t, s) => ctx.sidePoint(far, t, s);
  // the lockup: a pen of timber bars in a corner of the far wall (the corner with no door beside it), 5 ft deep, one or
  // two panels wide; its front is bars and one gate, its open side one more panel. Inside: the plank bed, a bucket
  let pen = null;
  if (L >= 14 && deep >= 14 && ccmHas(ctx, 'cell-holding-wood')) {
    const wide = L >= 19 ? 2 : 1, PD = 5, /* (one panel wide read as a tall cabinet from the table: two from 19 ft of wall) */ sides = [0, 1].filter(k => !ctx.overlapsT(ctx.doorT[far], k ? L - wide * 5 - 1 : 0, k ? L : wide * 5 + 1) && !ctx.overlapsT(ctx.doorT[lat[k]], 0, PD + 1) && !ctx.overlapsT(ctx.doorT[lat[k]], ctx.sideLen(lat[k]) - PD - 1, ctx.sideLen(lat[k])));
    const k = sides.length ? sides[hash(ctx.baseSeed ?? ctx.room.seed, 'lockup') % sides.length] : -1;
    if (k >= 0) {
      const t0 = k ? L - wide * 5 : 0, tIn = k ? t0 : wide * 5, gateAt = hash(ctx.baseSeed ?? ctx.room.seed, 'lockup-gate') % wide, made = [];
      const piece = (t, s, rot, shape, why) => castlePut(ctx, 'cell-holding-wood', [...at(t, s), rot], { sku: { shape }, layer: 'anchor', rule: 'lockup', why });
      for (let i = 0; i < wide; i++) made.push(piece(t0 + i * 5 + 2.5, PD + 0.35, toDoor, i === gateAt ? 'gate' : '', i === gateAt ? 'the lockup: its barred gate' : 'the lockup: a front of timber bars'));
      made.push(piece(tIn + (k ? -0.35 : 0.35), 2.5, toDoor + Math.PI / 2, '', 'the lockup: its side of timber bars'));
      if (made.some(Boolean)) { pen = { k, t0, wide, PD, pieces: made.filter(Boolean) };
        if (wide > 1) ccmQuiet(ctx, () => ccmAt(ctx, 'bed-straw-pallet', [[...at(t0 + 5, 1.9), toDoor + Math.PI / 2], [...at(t0 + 4.5, 1.9), toDoor + Math.PI / 2]], { rule: 'in-lockup', why: 'a straw pallet along the back wall of the lockup' }));
        else ccmQuiet(ctx, () => ccmAt(ctx, 'stool-three-leg', [[...at(k ? L - 3.4 : 3.4, 1.2), toDoor]], { rule: 'in-lockup', why: 'a stool in the lockup' }));
        ccmQuiet(ctx, () => ctx.rug('rug-hay-scatter', { at: at(t0 + wide * 2.5, PD / 2), why: 'hay on the lockup floor' }));
        ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['bucket-slop', 'bucket']), [[...at(k ? L - 0.9 : 0.9, PD - 1.1), 0]], { layer: 'store', rule: 'in-lockup', why: 'the bucket in the lockup' }));
        const [mx, mz] = at(t0 + wide * 2.5, PD / 2), ns = far === 'N' || far === 'S'; ctx.mark(mx, mz, ns ? wide * 5 : PD, ns ? PD : wide * 5); // nothing else stands in the pen
        const [gx, gz] = at(t0 + gateAt * 5 + 2.5, PD + 2); ctx.mark(gx, gz, 3, 3, KEEP); } // the gate swings into the room
    }
  }
  // the desk: facing the door, the sergeant's chair behind it, centred on what the lockup leaves of the far wall
  const free0 = pen && !pen.k ? pen.wide * 5 + 0.6 : 0, free1 = pen && pen.k ? pen.t0 - 0.6 : L, tc = (free0 + free1) / 2, lane = deep >= 14 ? 3.4 : 2.8;
  const desk = ccmQuiet(ctx, () => ctx.put(ccmFirst(ctx, ['watch-desk', 'desk-writing']) || 'watch-desk', function* (dm) { for (let t = free0 + dm.w / 2 + 0.3; t <= free1 - dm.w / 2 - 0.3 + 1e-6; t += 0.25) { const [x, z] = at(t, lane + dm.d / 2); yield { x, z, rot: toDoor, t }; } }, (c) => Math.abs(c.t - tc), { layer: 'anchor', rule: 'key-desk', unique: true, why: "the sergeant's desk: facing the door, his chair behind it", extra: { focal: true, side: far } }));
  if (!desk && !pen) return { fail: 'watch post has neither its desk nor its lockup' };
  const feature = desk || pen.pieces[0];
  ctx.focal = { label: "sergeant's desk", id: feature.id, side: far, ok: !!desk };
  if (d) { ctx.sight = [d.inner, [feature.x, feature.z]]; ctx.sightFeature = feature.id; ccmWalk(ctx, 'approach', [d.inner, desk ? front(desk, 1.7) : at(tc, deep / 2)]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, desk ? front(desk, 1.7) : at(tc, deep / 2)]); }
  mktDoorWays(ctx);
  if (desk) { const dt = far === 'N' || far === 'S' ? desk.x - ctx.X0 : desk.z - ctx.Z0;
    const ch = ccmQuiet(ctx, () => ccmAt(ctx, ccmFirst(ctx, ['chair-plain', 'stool-three-leg']), [[...at(dt, lane - 1.2), toDoor], [...at(dt, lane - 1.5), toDoor]], { rule: 'keeper', why: "the sergeant's chair, back to the wall, the door in view", allowKeep: true })); if (ch) ctx.command('sergeant', ch, { flanks: false });
    if (desk.id !== 'watch-desk') for (const id of ['ledger-accounts', 'key-ring', 'mil-guard-lantern']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => s.uid === desk.uid, layer: /lantern/.test(id) ? 'light' : 'dress', why: 'on the desk' })); }
  // arms on the wall behind the desk and down a side wall; the bench where people wait, by the door
  const racks = []; for (let i = 0, n = Math.max(1, Math.min(4, Math.round(cells / 9))); i < n; i++) { const p = mktWallNear(ctx, 'weapon-rack', i ? [...lat, far] : [far, ...lat], at(tc, 0), { layer: 'store', rule: 'arms', why: "the watch's arms, on the wall" }); if (p) racks.push(p); }
  if (d) mktWallNear(ctx, ccmFirst(ctx, ['bench-long', 'bench-village']), [d.side, ...lat], d.inner, { why: 'the bench by the door, for whoever is waiting', windows: false });
  for (const id of ['mil-footlocker', 'chest-ironbound', 'mil-shield-stack', 'arrow-barrel'].slice(0, Math.max(1, Math.round(cells / 8)))) mktWallNear(ctx, id, ctx.shuffle(lat), null, { layer: 'store', why: 'kit against the wall', windows: false });
  // off duty (from 20 cells): a table with stools and dice; from 30, a cot
  if (cells >= 20) { const tb = ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, ['table-square', 'table-round-small']), ['stool-three-leg', 'chair-plain'], 3, { why: 'the off-duty table' })); if (tb) for (const id of ['dice-and-cup', 'tankard', 'candlestick']) ccmQuiet(ctx, () => ctx.surface(id, { on: s => /^table-/.test(s.id), layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the off-duty table' })); }
  if (cells >= 30) mktWallNear(ctx, 'cot', lat, null, { why: 'a cot for the night watch' });
  // the walls: the wanted wall by the door (notices and bounties), the roster, keys, helmets; manacles by the lockup
  const doorSides = d ? [d.side, ...lat] : ALL;
  for (const id of ['bounty-poster', 'bounty-poster', 'proclamation-scroll', 'mil-duty-roster', 'key-hook-board', 'mil-helmet-peg-rack'].slice(0, 3 + Math.round(cells / 8))) ccmQuiet(ctx, () => ctx.mount(id, { sides: doorSides, height: 5.3, why: /bounty|proclam/.test(id) ? 'the wanted wall' : 'on the wall' }));
  if (pen) ccmQuiet(ctx, () => ctx.mount('manacles-wall', { sides: [lat[pen.k]], height: 4.2, why: 'manacles on the wall by the lockup' }));
  ccmWallLights(ctx, ['lantern-wall-iron', 'torch-sconce', 'torch-bracket-rough'], ALL, { every: 22, height: 6.2, why: 'a wall lantern', min: 1, max: 3 });
  ctx.watchInfo = { lockup: pen ? pen.wide : 0, desk: desk?.id || null, racks: racks.length };
  ccmDone(ctx);
  return { feature, what: `watch post: ${desk ? "the sergeant's desk" : 'no desk'}${pen ? `, a ${pen.wide * 5}-ft timber lockup in the corner` : ''}, ${racks.length} arms racks`, approach: null, passage: true };
}

// ---------------- the town house's living room: the hearth facing the door, the family table, the dresser ----------------
function mktHouse(ctx) {
  ccmPanels(ctx);
  const d = ctx.mainDoor, far = ccmFar(ctx), L = ctx.sideLen(far), lat = ccmLat(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cells = ccmCells(ctx), toDoor = SIDES[far].rot, ALL = ['N', 'S', 'E', 'W'];
  const at = (t, s) => ctx.sidePoint(far, t, s);
  let fire = ccmFocalOn(ctx, far, ['fireplace-wall'], { label: 'hearth', rule: 'key-hearth', slack: Math.max(0.5, L / 2 - 4), why: 'the hearth: on the wall facing the door (axial focal)' });
  if (!fire) fire = mktWallNear(ctx, 'fireplace-wall', lat, at(L / 2, deep / 3), { layer: 'anchor', rule: 'key-hearth', why: 'the hearth, on a side wall' });
  if (!fire) return { fail: 'town house has no hearth' };
  ctx.focal = ctx.focal?.ok ? ctx.focal : { label: 'hearth', id: fire.id, ok: true };
  const hf = front(fire, 3.2);
  ctx.mark(...front(fire, 1.2), 3.5, 2.4, KEEP);
  if (d) { ctx.sight = [d.inner, [fire.x, fire.z]]; ctx.sightFeature = fire.id; ccmWalk(ctx, 'approach', [d.inner, hf]); for (const o of ctx.doors) if (o !== d) ccmWalk(ctx, 'branch', [o.inner, hf]); }
  mktDoorWays(ctx);
  // by the fire: the settle one side, the rocking chair the other, turned to it; the cradle within reach; the hearth's things
  const [fx, fz] = ctx.facingVec(fire.rot), lx = fz, lz = -fx, seats = [];
  for (const [sgn, ids] of [[ctx.chance(0.5) ? 1 : -1, ['rocking-chair', 'chair-armed', 'chair-plain']], [0, ['chair-armed', 'chair-upholstered', 'chair-plain']] /* (not the settle: from above it read as a bed) */]) { const sg = sgn || -Math.sign(seats[0] ? (seats[0].x - fire.x) * lx + (seats[0].z - fire.z) * lz : 1), id = ccmFirst(ctx, ids); if (!id) continue;
    // (facing the fire, one each side of the way to it: the way is 3 ft wide, so each seat's inner edge is 1.8 ft off the centre line)
    const p = ccmQuiet(ctx, () => ctx.put(id, function* (dm) { for (const e of [0, 0.5, 1, 1.5]) for (const f of [0, 0.5, -0.5, 1]) { const latd = 1.8 + e + dm.w / 2, fwd = fire.dims[2] / 2 + 3.6 + f + dm.d / 2; yield { x: fire.x + fx * fwd + lx * sg * latd, z: fire.z + fz * fwd + lz * sg * latd, rot: fire.rot + Math.PI, e: e + Math.abs(f) }; } }, (c) => c.e, { rule: 'hearth-seat', why: 'by the fire, facing it' })); if (p) seats.push(p); }
  ccmQuiet(ctx, () => ctx.rug(ccmFirst(ctx, ['rug-hearth-halfmoon', 'rug-braided-round', 'rug-small']), { at: front(fire, 2.2), rot: fire.rot, why: 'the hearth rug' }));
  for (const id of ['firewood-basket', 'cradle', 'fire-irons', 'kettle']) if (id !== 'cradle' || (cells >= 12 && ctx.chance(0.6))) ccmQuiet(ctx, () => ctx.companion(fire, id, { why: id === 'cradle' ? 'the cradle, within reach of the fire' : 'by the hearth', maxDist: id === 'cradle' ? 7 : 5 }));
  // the family table in the door half, laid for a meal
  let table = null;
  if (cells >= 9) { table = ccmQuiet(ctx, () => ctx.cluster(ccmFirst(ctx, cells >= 20 ? ['table-trestle', 'table-square'] : ['table-square', 'table-round-small']), ['chair-plain', 'stool-three-leg'], cells >= 16 ? 4 : 3, { why: 'the family table' }));
    if (table) for (const id of ctx.pick(['bread-loaf', 'pitcher', 'plate', 'bowl', 'mug-glazed', 'candlestick', 'cheese-wedge', 'vase-flowers', 'stew-pot-full'], 4)) ccmQuiet(ctx, () => ctx.surface(id, { on: s => /^table-/.test(s.id), layer: id === 'candlestick' ? 'light' : 'dress', why: 'on the family table' })); }
  // against the walls: the dresser of plates, a cupboard, the spinning wheel by a window, a chest; pegs by the door
  const wallIds = ['dresser-plates', 'cupboard', 'chest-plain', 'bench-long', 'baskets-stack', 'barrel', 'broom']; // (no spinning wheel: from above it read as a workbench with gears, and the room as a workshop)
  for (const id of wallIds.slice(0, Math.max(2, Math.min(wallIds.length, Math.round(cells / 4))))) mktWallNear(ctx, id, ctx.shuffle([...lat, ...(d ? [d.side] : []), far]), null, { why: 'against the wall', layer: /chest|barrel|basket/.test(id) ? 'store' : 'furnish', });
  for (const id of ['coat-pegs', 'shelf-wall', 'painting-still-life'].slice(0, cells >= 16 ? 3 : 2)) ccmQuiet(ctx, () => ctx.mount(id, { sides: id === 'coat-pegs' && d ? [d.side] : lat, height: 5.4, why: id === 'coat-pegs' ? 'pegs by the door' : 'on the wall' }));
  ccmWallLights(ctx, ['candle-box-sconce', 'lantern-wall-iron', 'sconce-candle-single'], [...lat, ...(d ? [d.side] : [])], { every: 30, height: 6, why: 'a wall light', min: 1, max: 2 });
  ctx.houseInfo = { seats: seats.length, table: !!table };
  ccmDone(ctx);
  return { feature: fire, what: `living room: the hearth with ${seats.length} seat${seats.length === 1 ? '' : 's'} by it${table ? ', the family table' : ''}`, approach: null, passage: true };
}

// ---------------- OUTDOORS. Both are role `outdoor` (no walls; the neighbours' doors open onto them; walls.js gives a gate) ----------------
// what a building's door gets beside it, by what is behind the door (against the building's own wall)
const MKT_BY_DOOR = { common: ['bench-village', 'barrel'], desk: ['bench-village'], kitchen: ['rain-barrel', 'crate'], stable: ['hitching-post', 'horse-trough-stone'], 'mkt-watch': ['watch-lantern-bell', 'notice-board'], 'mkt-house': ['planter-barrel', 'bench-street'], 'mkt-backroom': ['crate', 'barrel'], 'mkt-passage': ['rain-barrel'] };
const MKT_SIGN = { common: 'sign-hanging', desk: 'sign-hanging' };
// the surroundings every outdoor program needs (as castleCourtyard has them)
function mktOutdoor(ctx) {
  const ALL = ['N', 'S', 'E', 'W'], w = ctx.room.w, dz = ctx.room.d;
  const gate = ctx.openings.find(o => o.kind === 'gate') || null, open = gate ? gate.open : [];
  const built = ctx.openings.filter(o => o.to && /^(wall|window|door)$/.test(o.kind));
  for (const s of ALL) { const n = s === 'N' || s === 'S' ? w : dz; for (let i = 0; i < n; i++) if (!built.some(o => o.side === s && o.index === i)) ctx.mounts[s].push([i * CELL - INSET, (i + 1) * CELL - INSET]); } // nothing hangs in mid-air
  const gateT = gate ? gate.index * CELL - INSET + CELL / 2 : 0, gatePt = gate ? ctx.sidePoint(gate.side, gateT, 2.6) : null;
  return { ALL, gate, open, built, gateT, gatePt, backSides: ALL.filter(s => built.some(o => o.side === s)), openSides: ALL.filter(s => open.some(o => o.side === s)), wallFt: built.length * CELL };
}
// beside each building door: the trade's sign on the wall, its stock and a thing or two against the wall, a lantern
function mktDoors(ctx, room, { stock = true } = {}) {
  const info = [];
  for (const o of ctx.openings.filter(o => o.kind === 'door' && !o.part && o.to)) {
    const type = ctx.typesOf?.(o.to) || '', T = MKT_TRADES[type], t = o.index * CELL - INSET + (o.span || 1) * CELL / 2, here = ctx.sidePoint(o.side, t, 1), put = [];
    const sign = T ? T.sign : MKT_SIGN[type];
    if (sign && ccmHas(ctx, sign) && mktAs(ctx, T?.tier, () => ccmQuiet(ctx, () => ctx.mount(sign, { sides: [o.side], height: 7.2, rule: 'yard-sign', why: `the ${T ? T.name : 'inn'}'s sign, on its wall` })))) put.push('sign');
    const ids = T ? [...(stock ? ['shop-floor-stock'] : []), ...T.by] : MKT_BY_DOOR[type] || [];
    for (const id of ids.slice(0, 2)) if (room()) { const p = ccmHas(ctx, id) ? mktAs(ctx, T?.tier, () => ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, [o.side], { gap: 0.25, windows: false }), (c) => Math.abs(Math.hypot(c.x - here[0], c.z - here[1]) - 4.5), { layer: 'store', rule: 'by-door', why: `outside the ${T ? T.name : type.replace(/^mkt-/, '')} door` }))) : null; if (p && Math.hypot(p.x - here[0], p.z - here[1]) < 13) put.push(p.id); }
    if (ccmQuiet(ctx, () => ctx.mount(ccmFirst(ctx, ['lantern-wall-iron', 'lantern-wall-brass', 'rural-lantern-barn']), { sides: [o.side], height: 6.4, layer: 'light', rule: 'yard-light', why: 'a lantern by the door' }))) put.push('lantern');
    info.push({ to: o.to, type, side: o.side, things: put });
  }
  return info;
}
// awnings over the windows of the buildings that face the street (at most one window in two)
function mktAwnings(ctx, sides, max) { let n = 0; if (!ccmHas(ctx, 'awning')) return 0; for (const s of sides) for (let i = 0; i < ctx.windowT[s].length && n < max; i += 2) if (ccmQuiet(ctx, () => ctx.mount('awning', { sides: [s], height: 8.6, atWindow: true, rule: 'awning', why: 'an awning over the window' }))) n++; return n; }
const MKT_STREET_LAMP = ['lamp-post-iron', 'lamp-post-wood', 'lantern-post'];

// THE MARKET SQUARE: one thing in the middle (the market cross, a well, a fountain, the pump), stalls in two rows facing
// each other across it with a 12-ft way between, open tables and ground displays at the ends of the rows, carts and the
// town's furniture at the edges. Every door's way to the gate is reserved first: no stall stands in it.
function mktSquare(ctx) {
  const O = mktOutdoor(ctx), { ALL, gate, gatePt, gateT } = O, A = ctx.area(), cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const target = ctx.densityTarget = Math.max(1.6, yardTarget(A) * 1.5), want = Math.max(5, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor' && p.rule !== 'yard-edge').length, room = (k = 0) => count() + k < Math.round(want * 1.4);
  if (gate) ctx.keepClear(gate.side, gateT, 5.5, 4.5);
  // (the rows are sized before the middle is chosen: a square too shallow for two rows of stalls has ONE row, backs to an edge,
  // and its middle thing stands in the middle of what that row leaves)
  const horiz = ctx.W >= ctx.D, Lr = horiz ? ctx.W : ctx.D, across = horiz ? ctx.D : ctx.W, [sw, sd] = ccmHas(ctx, 'market-stall') ? mktSkuSize(ctx, 'market-stall') : [8, 6];
  const two = across >= 12 + 2 * sd + 1, oneRow = !two && across >= sd + 14 && ccmHas(ctx, 'market-stall'), shift = oneRow ? (sd + 0.6) / 2 : 0;
  // the middle
  let focal = null;
  if (Math.min(ctx.W, ctx.D) >= 15) { const kind = ctx.roll('market centre', ['market cross', 'market cross', 'well', 'fountain', 'pump']);
    const ids = { 'market cross': ['market-cross', 'well', 'fountain-courtyard'], well: ['well', 'well-house', 'market-cross'], fountain: ['fountain-courtyard', 'market-cross', 'well'], pump: ['pump-trough-village', 'market-cross', 'well'] }[kind];
    focal = ccmCentre(ctx, ids.filter(id => mktSkuSize(ctx, id)[0] <= Math.min(ctx.W, ctx.D) - shift * 2 - 9), { off: horiz ? [0, shift] : [shift, 0], label: 'market centre', rule: 'yard-focal', why: 'the middle of the square: the one thing everything else stands round' });
    if (focal) ccmClearRound(ctx, focal, 2.5); }
  // the ways: every door to the gate (a closed square: door to door), 5 ft wide
  if (gatePt) for (const o of ctx.doors) ccmWalk(ctx, 'path', [o.inner, gatePt], { width: 5 });
  else for (let i = 1; i < ctx.doors.length; i++) ccmWalk(ctx, 'path', [ctx.doors[0].inner, ctx.doors[i].inner], { width: 5 });
  const doorInfo = mktDoors(ctx, room, { stock: false });
  // the stalls: two rows along the square's long axis, facing each other across the middle; a gap in each row where the
  // cross way passes. Rows are 12 ft apart face to face (16 with a big thing in the middle)
  const way = Math.max(12, Math.min(across - 2 * sd - 1, (focal ? Math.max(focal.dims[0], focal.dims[2]) : 0) + 9));
  const stalls = [], P = (a, b) => horiz ? [ctx.X0 + a, ctx.Z0 + b] : [ctx.X0 + b, ctx.Z0 + a]; // a along the rows, b across them
  if (ccmHas(ctx, 'market-stall') && (two || oneRow) && Lr >= sw + 6) {
    const per = Math.max(1, Math.floor((Lr / 2 - 3.5 - 1.5) / (sw + 1.5))), rows = across >= way + 4 * sd + 14 ? 2 : 1;
    for (let r = 0; r < rows; r++) for (const sgn of two ? [-1, 1] : [-1]) for (const half of [-1, 1]) for (let i = 0; i < per; i++) {
      if (Lr < 2 * sw + 9 && half > 0) continue; // a short square: one stall a row, in the middle of the row
      const a = Lr < 2 * sw + 9 ? Lr / 2 : Lr / 2 + half * (3.5 + sw / 2 + i * (sw + 1.5)), b = two ? across / 2 + sgn * (way / 2 + sd / 2 + r * (sd + 7)) : sd / 2 + 0.6;
      const rot = horiz ? (sgn < 0 ? 0 : Math.PI) : (sgn < 0 ? Math.PI / 2 : -Math.PI / 2); // facing the middle
      const p = castlePut(ctx, 'market-stall', [[...P(a, b), rot], [...P(a + half, b), rot], [...P(a + 2 * half, b), rot]], { layer: 'anchor', rule: 'stall', why: 'a market stall: in a row, facing the way through the middle' });
      if (p) stalls.push(p);
    }
  }
  if (!focal && !stalls.length) { const any = ccmCentre(ctx, ['market-stall', 'craft-display-table-goods', 'well'], { label: 'market', rule: 'yard-focal', why: 'the one stall of a small market' }); if (any) (any.id === 'market-stall' ? stalls : []).push(any); focal = focal || any; }
  // open tables and ground displays: at the ends of the rows and before the stalls' corners, each of a different trade
  const tiers = ctx.shuffle(MKT_TIERS), ground = ctx.shuffle(['pottery-for-sale', 'spice-sacks-open', 'flower-buckets', 'rug-merchant-stack', 'fish-barrel-salted', 'apple-crate', 'cabbage-crate', 'vegetable-crate-mixed', 'fruit-crate-mixed', 'shop-floor-stock', 'turnip-pile', 'baskets-stack']);
  let tables = 0, displays = 0;
  for (let i = 0; i < stalls.length && room(); i++) { const s = stalls[i], [fx, fz] = ctx.facingVec(s.rot), lx = fz, lz = -fx, side = i % 2 ? 1 : -1, id = ground[i % ground.length];
    const p = mktAs(ctx, tiers[i % tiers.length], () => mktNear(ctx, id, [s.x + lx * side * (s.dims[0] / 2 + 1.6) + fx * 0.5, s.z + lz * side * (s.dims[0] / 2 + 1.6) + fz * 0.5], s.rot, { reach: 2.5, layer: 'store', rule: 'market-display', why: 'wares set out on the ground beside a stall' })); if (p) displays++; }
  const nTables = Math.max(stalls.length ? 1 : 2, Math.round(A / 450));
  for (let i = 0; i < nTables && room(); i++) { const ang = (i + 0.5) / nTables * Math.PI * 2 + (ctx.baseSeed ?? ctx.room.seed) % 6, rr = Math.min(ctx.W, ctx.D) / 2 - 4.5, spot = [cx + Math.cos(ang) * rr * (ctx.W / Math.min(ctx.W, ctx.D)) * 0.8, cz + Math.sin(ang) * rr * (ctx.D / Math.min(ctx.W, ctx.D)) * 0.8];
    const rot = Math.atan2(cx - spot[0], cz - spot[1]), snap = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
    if (mktAs(ctx, tiers[(i + 2) % tiers.length], () => mktNear(ctx, 'craft-display-table-goods', spot, snap, { reach: 5, rule: 'market-table', why: 'an open trestle of wares, facing the middle' }))) tables++; }
  // the town's furniture: the crier's stand by the centre, a cart at the edge, the notice board by the gate, lamps in the corners, benches
  if (focal && A >= 700) mktNear(ctx, 'town-crier-platform', front(focal, 4), focal.rot, { reach: 6, rule: 'market-town', why: "the crier's stand, by the middle of the square" });
  const edgeSides = [...O.openSides, ...O.backSides].filter((s, i, a) => a.indexOf(s) === i), AT = 0.6;
  const atEdge = (id, near, why, layer = 'furnish', rule = 'at-edge') => ccmHas(ctx, id) && edgeSides.length ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, ctx.shuffle(edgeSides), { gap: AT, windows: false }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 30, { layer, rule, why })) : null;
  const corners = [[ctx.X0 + 2.5, ctx.Z0 + 2.5], [ctx.X1 - 2.5, ctx.Z1 - 2.5], [ctx.X1 - 2.5, ctx.Z0 + 2.5], [ctx.X0 + 2.5, ctx.Z1 - 2.5]];
  let lamps = 0; const lampId = ccmFirst(ctx, MKT_STREET_LAMP);
  if (lampId) for (const c of corners.slice(0, A >= 900 ? 4 : 2)) if (mktNear(ctx, lampId, c, 0, { reach: 3, layer: 'light', rule: 'street-lamp', why: 'a street lamp at the corner of the square' })) lamps++;
  if (gatePt && room()) atEdge('notice-board', ctx.sidePoint(gate.side, gateT + 7, 1), 'the notice board, where people come into the square');
  for (const id of ctx.shuffle(['cart-merchant-covered', 'cart-hand', 'wagon']).slice(0, A >= 1500 ? 2 : 1)) if (room()) atEdge(id, null, 'a cart drawn up at the edge of the square');
  for (const id of ['bench-village', 'bench-street', 'horse-trough-stone', 'hitching-post', ...(A >= 1100 ? ['stocks', 'pillory'].filter(() => ctx.chance(0.5)) : []), 'planter-stone', 'barrel', 'crate']) { if (count() >= want) break; atEdge(id, null, 'at the edge of the square'); }
  if (gate) for (const k of [-1, 1]) ccmQuiet(ctx, () => ccmAt(ctx, 'bollard-stone', [[...ctx.sidePoint(gate.side, gateT + k * 3.4, 0.9), 0]], { rule: 'bollard', why: 'a bollard each side of the way into the square', layer: 'dress' }));
  const awn = mktAwnings(ctx, O.backSides, 4);
  ctx.yardInfo = { vibe: 'market square', edge: 'none', edgePieces: 0, wallFt: O.wallFt, gate: gate ? gate.side : null, focal: focal ? { id: focal.id, kind: focal.id.replace(/-/g, ' ') } : null, signs: doorInfo.filter(x => x.things.includes('sign')).length, wear: 0, doors: doorInfo, stalls: stalls.length, tables, displays, lamps, awnings: awn, plants: { placed: 0, slot: [], waiting: [] } };
  if (stalls.length > 1) ctx.growth.push(`stalls repeat in rows: ${stalls.length}`);
  ccmDone(ctx);
  return { feature: focal || stalls[0] || null, what: `market square: ${focal && focal.id !== 'market-stall' ? `the ${focal.id.replace(/-/g, ' ')} in the middle, ` : ''}${stalls.length} stalls, ${tables} open tables, ${displays} ground displays`, outdoor: true };
}

// THE STREET: a clear way down the middle from end to end; everything stands in a 3-ft band at the two sides. Lamps
// about every 25 ft, on alternate sides; signs, stock and awnings by the doors of the buildings along it; a pump or a
// trough, a bench, a cart drawn up; bollards at both ends.
function mktStreet(ctx) {
  const O = mktOutdoor(ctx), { ALL, gate, gatePt } = O, A = ctx.area(), horiz = ctx.W >= ctx.D, Lr = horiz ? ctx.W : ctx.D, across = horiz ? ctx.D : ctx.W;
  const long = horiz ? ['N', 'S'] : ['W', 'E'], ends = horiz ? ['W', 'E'] : ['N', 'S'], cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const target = ctx.densityTarget = Math.max(1.6, yardTarget(A) * 1.3), want = Math.max(4, Math.round(target * A / 100));
  const count = () => ctx.placements.filter(p => p.orient !== 'floor').length, room = (k = 0) => count() + k < Math.round(want * 1.4);
  // the carriageway: the middle of the street, end to end (at least 6 ft, half the width in a wide street)
  const lane = across < 12 ? Math.max(3, across - 5.6) : Math.max(Math.min(6, across - 5), across * 0.5);
  if (lane >= 3) ctx.mark(cx, cz, horiz ? Lr : lane, horiz ? lane : Lr, KEEP);
  const e0 = ctx.sidePoint(ends[0], across / 2, 1.5), e1 = ctx.sidePoint(ends[1], across / 2, 1.5);
  ccmWalk(ctx, 'through', [e0, e1], { width: Math.min(4, Math.max(3, lane)) });
  for (const o of ctx.doors) ccmWalk(ctx, 'path', [o.inner, [horiz ? o.inner[0] : cx, horiz ? cz : o.inner[1]]]);
  const doorInfo = mktDoors(ctx, room);
  // lamps: about every 25 ft, alternate sides, 1.2 ft in from the edge
  const lampId = ccmFirst(ctx, MKT_STREET_LAMP), nL = Math.max(1, Math.round(Lr / 25)); let lamps = 0;
  if (lampId) for (let i = 0; i < nL; i++) { const t = Lr * (i + 0.5) / nL;
    if (ccmQuiet(ctx, () => ctx.put(lampId, (dm) => ctx.wallGen(dm, [long[i % 2], long[(i + 1) % 2]], { gap: 0.15, step: 0.5, windows: false }), (c) => Math.abs(c.t - t) + (c.side === long[i % 2] ? 0 : 6), { layer: 'light', rule: 'street-lamp', why: 'a street lamp at the side of the way' }))) lamps++; }
  const atSide = (id, near, why, layer = 'furnish') => ccmHas(ctx, id) ? ccmQuiet(ctx, () => ctx.put(id, (dm) => ctx.wallGen(dm, ctx.shuffle(long), { gap: 0.4, windows: false }), (c) => near ? Math.hypot(c.x - near[0], c.z - near[1]) : ctx.rng() * 40, { layer, rule: 'street-side', why })) : null;
  // the water: a pump and trough (or the stone trough) from 40 ft of street; a bench; a cart drawn up at the side
  const things = [];
  if (Lr >= 40 && room()) { const p = atSide(ccmFirst(ctx, ctx.chance(0.6) ? ['pump-trough-village', 'horse-trough-stone'] : ['horse-trough-stone', 'pump-trough-village']), null, 'the street pump and its trough'); if (p) things.push(p); }
  for (const id of [ccmFirst(ctx, ['bench-street', 'bench-village']), ...(across >= 15 && Lr >= 35 ? [ccmAny(ctx, ['cart-hand', 'cart-merchant-covered'])] : []), 'hitching-post', 'flower-buckets', 'planter-stone', 'rain-barrel', 'barrel', 'crate', 'planter-barrel', 'notice-board']) { if (!id || count() >= want) break; const p = atSide(id, null, 'at the side of the street', /barrel|crate/.test(id) ? 'store' : 'furnish'); if (p) things.push(p); }
  // bollards: a pair at each open end, either side of the carriageway
  let bollards = 0;
  for (const s of ends) if (O.open.some(o => o.side === s)) for (const k of [-1, 1]) if (ccmQuiet(ctx, () => ccmAt(ctx, 'bollard-stone', [[...ctx.sidePoint(s, across / 2 + k * (lane / 2 + 0.9), 1.0), 0]], { rule: 'bollard', why: 'a bollard at the end of the street, beside the way', layer: 'dress' }))) bollards++;
  const awn = mktAwnings(ctx, O.backSides, Math.max(1, Math.round(Lr / 20)));
  ctx.yardInfo = { vibe: 'town street', edge: 'none', edgePieces: 0, wallFt: O.wallFt, gate: gate ? gate.side : null, focal: null, signs: doorInfo.filter(x => x.things.includes('sign')).length, wear: 0, doors: doorInfo, lamps, bollards, awnings: awn, lane, plants: { placed: 0, slot: [], waiting: [] } };
  if (lamps > 1) ctx.growth.push(`street lamps repeat along the way: ${lamps}`);
  ccmDone(ctx);
  const lampP = ctx.placements.find(p => p.rule === 'street-lamp') || things[0] || null;
  return { feature: lampP, what: `town street: a clear way ${Math.round(lane)} ft wide down the middle, ${lamps} lamp${lamps === 1 ? '' : 's'}${doorInfo.length ? `, ${doorInfo.length} door${doorInfo.length === 1 ? '' : 's'} dressed` : ''}`, outdoor: true };
}

// the bedroom above the shop IS the inn's guest room, the passage the inn's hallway, in half-timber walls
PROGRAM_OF['mkt-bedroom'] = 'guest';
PROGRAM_OF['mkt-passage'] = 'hallway';
// mktRegisterTrade(key, trade): everything the solver knows about a shop, for one room key. A later trade (the smithy's
// shopfront, a cobbler) calls it from its own appended block with its own line of data; walls.js has mktRegisterShop(key).
function mktRegisterTrade(key, trade) {
  if (trade) MKT_TRADES[key] = trade;
  if (!MKT_TIERS.includes(MKT_TRADES[key].tier)) MKT_TIERS.push(MKT_TRADES[key].tier);
  KEY[key] = mktShop; DENSITY[key] = 4.5; FOCAL[key] = 'shop counter (facing the door, shelves behind)'; KEY_RE[key] = /^counter-shop$/;
  MENUS[key] = ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['shop-shelf-stocked', 'shop-shelf-stocked', 'shop-floor-stock', 'craft-display-table-goods'] })); // the leg of an L-shaped shop: more shelves, never a second counter
}
const mktAnnex = (ctx, { wall = [], hung = [], lights = MKT_LAMPS } = {}) => { for (const id of wall) mktWallNear(ctx, id, ctx.shuffle(['N', 'S', 'E', 'W']), null, { layer: 'store', why: 'against the wall' }); for (const id of hung) ccmQuiet(ctx, () => ctx.mount(id, { height: 5.4, why: 'on the wall' })); ccmWallLights(ctx, lights, ['N', 'S', 'E', 'W'], { every: 24, height: 6.4, min: 1, max: 3 }); };
for (const k of Object.keys(MKT_TRADES)) mktRegisterTrade(k);
Object.assign(KEY, { 'mkt-backroom': mktBackroom, 'mkt-watch': mktWatch, 'mkt-house': mktHouse, 'mkt-square': mktSquare, 'mkt-street': mktStreet });
Object.assign(MENUS, {
  'mkt-backroom': ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['shelving-freestanding', 'crate', 'barrel', 'sack'] })),
  'mkt-watch': ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['weapon-rack', 'bench-long', 'mil-footlocker'], hung: ['bounty-poster'], lights: ['lantern-wall-iron', 'torch-sconce'] })),
  'mkt-house': ccmAnnex((ctx) => mktAnnex(ctx, { wall: ['cupboard', 'chest-plain', 'bench-long'], hung: ['shelf-wall'], lights: ['candle-box-sconce', 'lantern-wall-iron'] })),
});
// (no DENSITY line for the square or the street: each sets its own target, as yard() does)
Object.assign(DENSITY, { 'mkt-backroom': 5, 'mkt-watch': 4, 'mkt-house': 5, 'mkt-bedroom': DENSITY.guest ?? 5, 'mkt-passage': DENSITY.hallway ?? 3.5 });
Object.assign(FOCAL, { 'mkt-watch': "sergeant's desk", 'mkt-house': 'hearth', 'mkt-square': 'market cross (or the well, fountain or pump) in the middle' });
Object.assign(KEY_RE, { 'mkt-backroom': /^(shelving-freestanding|shop-shelf-stocked)$/, 'mkt-watch': /^(watch-desk|desk-writing|cell-holding-wood)$/, 'mkt-house': /^fireplace-wall$/, 'mkt-square': null, 'mkt-street': null,
  'mkt-bedroom': KEY_RE.guest, 'mkt-passage': KEY_RE.hallway });
// <<< mkt:solver2

// >>> type:min
// ---------------- mine (2026-10-11): thirteen rooms ----------------
// A mine is mostly TUNNEL. One self-contained program a room, as the dungeon's (they use its helpers: dunFlat, dunFocal,
// dunWalls, dunFree, dunScatter, dunWalks, dunThrough, and the ccm* kit). The CART ROAD is a row of flat rail tiles on the
// floor (as the sewer's channel: terrain does not exist), kept clear of furniture, with carts standing on it. READS (table
// camera, 2026-10-12): rails and a loaded cart name a mine every time; timber sets standing over the road read as stable
// stalls, a frame by a door as stocks, the ore-scatter decal as hay, a puddle as a glowing rune, an axe in its block as an
// anvil, a helmet rack as a weapon rack: none of those is laid any more (the timbering is in the wall panels). Every list is in order of preference and ends
// in pieces the library already had, so a room still solves, plainer, while a mesh is missing.
const MIN_LAMP = ['lantern-wall-iron', 'lantern-wall-horn', 'torch-bracket-rough'], MIN_STAND = ['lantern-post-indoor', 'torch-stand'];
const MIN_HEAP = ['ore-pile', 'rural-tailings-pile', 'mil-catapult-stones', 'rubble-pile', 'stone-blocks-stack']; // a heap of broken rock, best first
const MIN_FALL = ['collapse-rubble', 'rubble-pile', 'rural-tailings-pile', 'stone-blocks-stack'];
const MIN_CART = ['mine-cart', 'wheelbarrow', 'cart-hand'], MIN_STORE = ['rural-pit-props-stack', 'lumber-pile', 'crate', 'barrel', 'sack'];
const minSeed = (ctx, ...k) => hash(ctx.baseSeed ?? ctx.room.seed, 'min', ...k);
// dim on purpose: `n` lanterns, the sides in turn; a room with no windows always gets one
function minLights(ctx, sides, n, why = 'a lantern on the rock') { const k = ccmWallLights(ctx, MIN_LAMP, sides, { every: 999, min: n, max: n, height: 5.4, why }); ccmEnsureLight(ctx, MIN_LAMP, MIN_STAND); return k; }
// THE CART ROAD: rail tiles (flat `mine-rail-strip`) in one row down the long way of the room. Two cells wide and more: the
// row lies against a long wall that has no door, out of line with every end door, so the doors open onto the walkway
// beside it. `single`: a tunnel one cell wide is all road (you walk between the rails). Without the flat the road is still
// kept clear (bare floor under the timber sets). keep() closes it to furniture; call it after the carts are on.
function minRoad(ctx, { single = false } = {}) {
  const long = ctx.longSides(), ends = ctx.shortSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D), base = long[0], ns = base === 'N' || base === 'S', rows = Math.round((wide + 1) / 5);
  const S_OF = (r) => Math.max(2.5, Math.min(wide - 2.5, r * 5 + 2));
  const doorS = ctx.doors.filter(q => ends.includes(q.side)).map(q => ns ? (base === 'N' ? q.inner[1] - ctx.Z0 : ctx.Z1 - q.inner[1]) : (base === 'W' ? q.inner[0] - ctx.X0 : ctx.X1 - q.inner[0]));
  const sideDoors = new Set(ctx.doors.filter(q => long.includes(q.side)).map(q => q.side)), clear = (s) => doorS.every(v => Math.abs(v - s) >= 4.2);
  let rowS = null, wall = null;
  if (rows >= 2) { const cand = [[S_OF(0), base], [S_OF(rows - 1), OPP_SIDE[base]]].filter(([s, w]) => !sideDoors.has(w) && clear(s)); if (cand.length) [rowS, wall] = cand[minSeed(ctx, 'road') % cand.length]; }
  else if (single) rowS = wide / 2;
  if (rowS === null) return null;
  const n = Math.max(1, Math.round((Lr + 1) / 5)), w = Lr / n, rot = ns ? 0 : Math.PI / 2, across = ns ? Math.PI / 2 : 0, strips = [], pt = (t) => ctx.sidePoint(base, t, rowS);
  if (ccmHas(ctx, 'mine-rail-strip')) for (let k = 0; k < n; k++) { const [x, z] = pt((k + 0.5) * w); const p = dunFlat(ctx, 'mine-rail-strip', x, z, rot, 'the cart road: rails on sleepers', { size: [w, Math.min(5, wide)], rule: 'key-road', layer: 'anchor' }); if (p) strips.push(p); }
  return { rowS, wall, base, ns, Lr, wide, rows, rot, across, strips, pt, keep() { const [cx, cz] = pt(Lr / 2); ctx.mark(cx, cz, ns ? Lr : 4.4, ns ? 4.4 : Lr, KEEP); } };
}
// a timber set is WALKED THROUGH (two props and a cap, open between): its footprint goes back to the walking grid as
// keep-clear, so a path may pass under it and nothing else is stood in it
function minOpen(ctx, p) { if (!p) return p; const [aw, ad] = ctx.aabb(p.dims[0], p.dims[2], p.rot), [i0, i1, j0, j1] = ctx.cells(p.x, p.z, aw, ad); for (let j = Math.max(0, j0); j < Math.min(ctx.nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(ctx.nx, i1); i++) ctx.grid[j * ctx.nx + i] = KEEP; return p; }
const minPutSet = (ctx, spots, o) => minOpen(ctx, castlePut(ctx, 'shoring-timber', spots, o));
// timber sets standing over the road, about every `every` ft, clear of the doors
function minSets(ctx, road, every = 10, o = {}) {
  const out = []; if (!road || road.rows < 2 || !ccmHas(ctx, 'shoring-timber')) return out;
  const n = Math.max(1, Math.round(road.Lr / every));
  for (let i = 0; i < n; i++) { const [x, z] = road.pt(road.Lr * (i + 0.5) / n); if (dunAtDoor(ctx, x, z, 3.4)) continue;
    const p = minPutSet(ctx, [[x, z, road.across]], { allowKeep: true, layer: 'anchor', rule: 'timber-set', why: 'a timber set over the cart road: two props and a cap', sku: o.sku }); if (p) out.push(p); }
  return out;
}
// carts standing on the road at the given fractions of its length (never under a timber set)
function minCarts(ctx, road, fs, why = 'an ore cart on the road', ids = MIN_CART) {
  const out = []; if (!road || road.rows < 2) return out;
  for (const f of fs) { const id = ccmFirst(ctx, ids); if (!id) break; const [x, z] = road.pt(road.Lr * f); if (ctx.placements.some(q => q.rule === 'timber-set' && Math.hypot(q.x - x, q.z - z) < 3.6)) continue;
    const p = castlePut(ctx, id, [[x, z, road.across + (minSeed(ctx, 'cart', Math.round(f * 100)) % 2 ? Math.PI : 0)]], { allowKeep: true, layer: 'furnish', rule: 'on-road', why }); if (p) out.push(p); }
  return out;
}
// the wall across from the road (or both long walls where there is none): where things may stand without closing the way
const minOff = (ctx, road) => road && road.wall ? [OPP_SIDE[road.wall]] : ctx.longSides();

// MINE TUNNEL (passage): the connective tissue. A clear through-line door to door; the cart road beside the walkway with a
// timber set over it about every 10 ft and a cart or two standing on it; lanterns down the walls; from three cells wide,
// pit props, ore and barrels against the wall across from the road. One door and no way on: it ends at a heap of rock.
function minTunnel(ctx) {
  const line = dunThrough(ctx);
  if (!line.path.ok) return { fail: 'tunnel: the through-line is blocked' };
  const long = ctx.longSides(), ends = ctx.shortSides(), Lr = Math.max(ctx.W, ctx.D), wide = Math.min(ctx.W, ctx.D);
  const road = minRoad(ctx, { single: true });
  let end = null;
  if (ctx.doors.length === 1 && ctx.mainDoor && ends.includes(ctx.mainDoor.side)) end = dunFocal(ctx, OPP_SIDE[ctx.mainDoor.side], [...MIN_FALL, ...MIN_HEAP], { label: 'the end of the tunnel', rule: 'key-end', sku: wide < 10 ? { shape: 's2' } : undefined, why: 'the tunnel ends at a heap of broken rock' });
  const sets = [], carts = minCarts(ctx, road, Lr >= 44 ? [0.2, 0.5, 0.8] : Lr >= 24 ? [0.3, 0.7] : Lr >= 14 ? [0.6] : []);
  road?.keep();
  let stood = 0;
  if (wide >= 13.5) stood = dunWalls(ctx, [...MIN_STORE.slice(0, 4), 'ore-pile', 'mine-tool-rack'], minOff(ctx, road), Math.max(1, Math.round(Lr / 13)), 'stores against the tunnel wall').length;
  else if (!road && wide >= 8.5) stood = dunWalls(ctx, ['rural-pit-props-stack', 'crate', 'barrel'], long, Math.max(1, Math.round(Lr / 18)), 'left by the wall').length;
  castleHang(ctx, ['rural-sign-danger-mine'], road && road.wall ? [road.wall] : long, Lr >= 24 ? 1 : 0, { height: 5.2, why: 'a warning board' });
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks', 'decal-coal-dust'], Math.max(1, Math.min(3, Math.round(ctx.area() / 150))), 'on the tunnel floor', line.a, line.b);
  minLights(ctx, wide >= 8.5 ? long : [...long, ...ends], Math.max(1, Math.min(6, Math.round(Lr / 13))), 'a lantern down the tunnel');
  ctx.minInfo = { kind: 'tunnel', road: road ? (road.rows < 2 ? 'single' : road.wall) : null, strips: road ? road.strips.length : 0, sets: sets.length, carts: carts.length, stood, deadEnd: !!end };
  ccmDone(ctx);
  return { feature: end, what: `${ctx.doors.length >= 3 ? 'a tunnel with a side turning' : end ? 'a tunnel ending at broken rock' : 'a tunnel'} ${Math.round(Lr)} ft long${road ? `, the cart road ${road.rows < 2 ? 'filling it' : 'beside the walkway'}` : ''}, ${carts.length} cart${carts.length === 1 ? '' : 's'}`, approach: null, passage: true };
}

// TUNNEL JUNCTION (hub): where the roads meet. The turntable (a flat) in the middle with every door joined to it, a timber
// set just inside each door, stores and a heap in the corners, a signpost and a waiting cart beside the turntable.
function minJunction(ctx) {
  const d = ctx.mainDoor, cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, ALL = ['N', 'S', 'E', 'W'], narrow = Math.min(ctx.W, ctx.D);
  // the roads: a row of track through the middle each way, the turntable where they cross
  const arms = [];
  if (narrow >= 13.5 && ccmHas(ctx, 'mine-rail-strip')) for (const [len, rot, at] of [[ctx.W, 0, (t) => [ctx.X0 + t, cz]], [ctx.D, Math.PI / 2, (t) => [cx, ctx.Z0 + t]]]) { const n = Math.max(1, Math.round((len + 1) / 5)), w = len / n;
    for (let k = 0; k < n; k++) { const [x, z] = at((k + 0.5) * w); const p = dunFlat(ctx, 'mine-rail-strip', x, z, rot, 'a cart road into the junction', { size: [w, 5], rule: 'key-road', layer: 'anchor', over: rot !== 0 }); if (p) arms.push(p); } }
  const table = narrow >= 8.5 && ccmHas(ctx, 'mine-rail-cross') ? dunFlat(ctx, 'mine-rail-cross', cx, cz, 0, 'the turntable: where the cart roads meet', { rule: 'key-turntable', layer: 'anchor', over: true, y: 0.035 }) : null;
  for (const o of ctx.doors) ccmWalk(ctx, o === d ? 'approach' : 'branch', [o.inner, [cx, cz]]);
  if (ctx.doors.length >= 2) ctx.walk('ring', ctx.doors.map(o => o.inner).sort((p, q) => Math.atan2(p[1] - cz, p[0] - cx) - Math.atan2(q[1] - cz, q[0] - cx)), { closed: true, quietSkips: true }); /* a hub: the way round from door to door, kept before the stores go in */
  const sets = [], doorSides = new Set(ctx.doors.map(o => o.side));
  // a loaded cart on the arm that runs to a wall with no door (none where every wall has one)
  let cart = null;
  if (arms.length) for (const [side, x, z, rot] of ctx.shuffle([['W', cx - ctx.W * 0.3, cz, Math.PI / 2], ['E', cx + ctx.W * 0.3, cz, Math.PI / 2], ['N', cx, cz - ctx.D * 0.3, 0], ['S', cx, cz + ctx.D * 0.3, 0]])) { if (cart || doorSides.has(side)) continue; cart = castlePut(ctx, ccmFirst(ctx, ['mine-cart']), [[x, z, rot]], { allowKeep: true, layer: 'furnish', rule: 'on-road', why: 'a loaded cart on the road, waiting for the turntable' }); }
  if (arms.length) { ctx.mark(cx, cz, ctx.W, 4.4, KEEP); ctx.mark(cx, cz, 4.4, ctx.D, KEEP); } else ctx.mark(cx, cz, Math.min(5, ctx.W - 4), Math.min(5, ctx.D - 4), KEEP);
  const corners = [['N', 'W'], ['S', 'E'], ['N', 'E'], ['S', 'W']], ids = ctx.shuffle([ccmFirst(ctx, MIN_STORE), ccmFirst(ctx, MIN_HEAP), ccmFirst(ctx, MIN_HEAP), ccmFirst(ctx, ['barrel', 'crate'])].filter(Boolean)), stood = [];
  if (narrow >= 8.5) corners.slice(0, Math.max(2, Math.min(4, Math.round(ccmCells(ctx) / 5)))).forEach((c, i) => { const id = ids[i % Math.max(1, ids.length)]; const p = id && ccmCorner(ctx, id, c, { why: 'stores in the corner of the junction', inset: 0.5 }); if (p) stood.push(p); });
  const post = narrow >= 13.5 ? dunFree(ctx, 'signpost', [cx + 4.4, cz + 4.4], 3, 'the way-board: which road goes where', { margin: 0.3, unique: true }) : null;
  if (!cart && narrow >= 13.5) cart = dunFree(ctx, ccmFirst(ctx, MIN_CART), [cx - 4.6, cz + 4.6], 3.5, 'a cart waiting its turn', { margin: 0.3, rot: ctx.r(0, 6.28) });
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks'], 1, 'on the floor');
  minLights(ctx, ALL, Math.max(1, Math.min(4, Math.round(ctx.area() / 130))), 'a lantern at the junction');
  const key = table || sets[0] || post || cart || stood[0] || null;
  ctx.minInfo = { kind: 'junction', doors: ctx.doors.length, turntable: !!table, arms: arms.length, sets: sets.length, corners: stood.length, post: !!post, cart: cart?.id || null };
  ccmDone(ctx);
  return { feature: null, what: `a junction of ${ctx.doors.length} way${ctx.doors.length === 1 ? '' : 's'}${table ? ' round a turntable' : ''}${arms.length ? ', track through the middle each way' : ''}${cart ? ', a cart waiting' : ''}, stores in ${stood.length} corners`, approach: null, passage: true, key };
}

// slabs of worked rock with the vein in it, side by side across wall `far` (end to end or not at all: one alone reads as furniture)
function minVeins(ctx, far, o = {}) {
  const out = []; if (!ccmHas(ctx, 'ore-vein')) return out;
  const L = ctx.sideLen(far), n = Math.max(1, Math.floor((L + 0.4) / ccmSize(ctx, 'ore-vein')[0]));
  for (let i = 0; i < n; i++) { const t = L * (i + 0.5) / n; const p = ccmQuiet(ctx, () => ctx.put('ore-vein', (dm) => ctx.wallGen(dm, [far], { gap: 0.02, step: 0.25 }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'key-face', why: 'the face: the vein showing in the worked rock', sku: o.sku, extra: { focal: true } })); if (p) out.push(p); }
  return out;
}
// WORKING FACE (terminal, a dead end): the vein across the end wall (or the muck pile where there is no vein mesh), a prop
// set under the roof before it, a cart waiting to be filled, tools against the side wall, broken rock on the floor.
function minFace(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), lat = ccmLat(far), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const veins = minVeins(ctx, far, { sku: { shape: '' } }), muck = veins.length ? null : dunFocal(ctx, far, [...MIN_FALL, ...MIN_HEAP], { label: 'the face', rule: 'key-face', sku: L < 10 ? { shape: 's2' } : undefined, why: 'the face: the last round of broken rock, not yet mucked out' });
  const key = veins[Math.floor(veins.length / 2)] || muck;
  if (!key) return { fail: 'working face has nothing at its face (no vein, rubble or ore mesh)' };
  ctx.focal = { label: 'the face', id: key.id, side: far, ok: true };
  dunWalks(ctx, front(key, 2));
  dunSight(ctx, key);
  const heaps = []; for (const f of veins.length ? [0.24, 0.78] : [0.14, 0.86]) { const p = deep >= 8.5 && L >= 8.5 ? dunFree(ctx, ccmFirst(ctx, MIN_HEAP), ctx.sidePoint(far, L * f, key.dims[2] + 2.3), 3.2, 'broken ore at the foot of the face', { margin: 0.2, rot: ctx.r(0, 6.28), sku: { shape: '' } }) : null; if (p) heaps.push(p); }
  const cart = deep >= 13.5 ? dunFree(ctx, ccmFirst(ctx, MIN_CART), ctx.sidePoint(far, L * (minSeed(ctx, 'cart') % 2 ? 0.72 : 0.28), Math.min(deep - 3.5, key.dims[2] + 6.5)), 4.5, 'a cart being filled', { margin: 0.3, rot: SIDES[far].rot, sku: { shape: '' } }) : null;
  const prop = false && deep >= 13.5 && L >= 13.5 ? dunFree(ctx, 'shoring-timber', ctx.sidePoint(far, L * (minSeed(ctx, 'cart') % 2 ? 0.25 : 0.75), Math.min(deep - 3, key.dims[2] + 5)), 5, 'a prop set under the new roof', { margin: 0.3, rot: SIDES[far].rot }) : null;
  const tools = dunWalls(ctx, ccmHas(ctx, 'mine-tool-rack') ? ['mine-tool-rack', 'rural-ore-bucket'] : ['garden-tools-leaning', 'bucket'], lat, L >= 8.5 ? 2 : 1, 'tools left against the wall');
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks'], Math.max(1, Math.min(3, Math.round(ctx.area() / 90))), 'chips and dust');
  minLights(ctx, lat, 1);
  ctx.minInfo = { kind: 'face', veins: veins.length, muck: muck?.id || null, heaps: heaps.length, cart: cart?.id || null, prop: !!prop, tools: tools.length };
  ccmDone(ctx);
  return { feature: key, what: `${veins.length ? `the vein across the end wall (${veins.length} slab${veins.length > 1 ? 's' : ''})` : 'a muck pile at the end wall'}, ${heaps.length} heaps of broken ore${cart ? ', a cart waiting' : ''}`, approach: null, passage: true };
}

// COLLAPSED TUNNEL (terminal, a dead end): the roof is down across the far end; the cart road runs under the fall; a
// cracked timber set before it, a cart caught and tipped, a fallen beam and loose rock on the floor.
function minCollapsed(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const road = deep >= L ? minRoad(ctx, { single: true }) : null, falls = []; /* (the road is NOT kept clear here: it is buried) */
  for (let i = 0, n = Math.max(1, Math.round(L / 9.5)); i < n; i++) { const t = L * (i + 0.5) / n;
    let p = null; for (const id of ['rural-tailings-pile', ...MIN_FALL]) { if (p || !ccmHas(ctx, id)) continue; /* (the dungeon's rock fall reads as a mound of skulls from above: the grey waste heap first, grown to close the tunnel) */
      for (const k of id === 'rural-tailings-pile' ? [Math.min(1.7, (L / n - 0.4) / ccmSize(ctx, id)[0]), 1] : [1]) { if (p) break; p = ccmQuiet(ctx, () => ccmScaled(ctx, id, k, () => ctx.put(id, (dm) => ctx.wallGen(dm, [far], { gap: 0.05 }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'key-collapse', why: 'the fall: the roof down across the tunnel', sku: id !== 'rural-tailings-pile' && L / n < 9.4 ? { shape: 's2' } : undefined }))); } } if (p) falls.push(p); }
  if (!falls.length) return { fail: 'collapsed tunnel has no fall (no collapse or rubble mesh)' };
  const key = falls[Math.floor(falls.length / 2)], reach = Math.max(...falls.map(p => p.dims[2])) + 0.3, room = deep - reach;
  ctx.focal = { label: 'rock fall', id: key.id, side: far, ok: true };
  // what names it a COLLAPSE from above: broken roof timbers at the foot of the fall, a cart caught on its side, rock thinning away
  const bid = ccmFirst(ctx, ['beam-collapsed', 'ceiling-slab-fallen']), bw = bid ? Math.max(...ccmSize(ctx, bid).slice(0, 2)) : 0;
  const beam = bid && room >= 9 ? ccmScaled(ctx, bid, Math.min(1, Math.max(0.7, (L - 1.2) / bw)), () => castlePut(ctx, bid, [0, 0.6, -0.6, 1.2, -1.2].map(e => [...ctx.sidePoint(far, L / 2 + e, reach + Math.min(bw, L - 1.2) * 0.42 + 0.2), SIDES[far].rot]), { allowKeep: true, layer: 'anchor', rule: 'debris', why: 'roof timbers down at the foot of the fall' })) : null;
  let edge = reach + (beam ? Math.min(beam.dims[0], beam.dims[2]) + 0.6 : 0.5);
  const tipId = ccmFirst(ctx, ['rural-ore-cart-tipped', 'mine-cart', 'wheelbarrow']), tt = road && road.rows >= 2 ? (road.wall === lat[0] ? Math.min(2.6, L / 2) : Math.max(L - 2.6, L / 2)) : L * 0.5;
  const cart = tipId && deep - edge >= 8 ? castlePut(ctx, tipId, [0, 0.8, 1.6].map(e => [...ctx.sidePoint(far, Math.max(2.6, Math.min(L - 2.6, tt)), edge + 2.6 + e), SIDES[far].rot]), { allowKeep: true, layer: 'furnish', rule: 'on-road', why: 'a cart caught by the fall, on its side across the rails' }) : null;
  if (cart) edge += 5.4;
  const piles = []; for (let i = 0, n = Math.max(1, Math.min(4, Math.round(cells / 6))); i < n; i++) { const p = ccmScaled(ctx, 'rural-tailings-pile', 0.5, () => dunFree(ctx, ccmFirst(ctx, ['rural-tailings-pile', 'mil-catapult-stones', 'rubble-pile']), ctx.sidePoint(far, ctx.r(1.6, L - 1.6), reach + ctx.r(1, Math.max(2, Math.min(room - 6, edge - reach + 3)))), 3.5, 'fallen rock on the floor, thinning away from the fall', { margin: 0.3, rot: ctx.r(0, 6.28) })); if (p) piles.push(p); }
  const maxS = Math.max(edge, ...piles.map(p => (far === 'N' ? p.z - ctx.Z0 : far === 'S' ? ctx.Z1 - p.z : far === 'W' ? p.x - ctx.X0 : ctx.X1 - p.x) + 1.6));
  if (deep - maxS >= 5) dunWalks(ctx, ctx.sidePoint(far, L / 2, Math.min(deep - 2, maxS + 1.5)));
  { const seen = dunSeen(ctx, [key, ...falls]); if (seen) dunSight(ctx, seen); }
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks'], Math.max(2, Math.min(4, Math.round(ctx.area() / 70))), 'chips, dust and cracks');
  castleHang(ctx, ['rural-sign-danger-mine'], d ? [d.side] : lat, 1, { height: 5.2, why: 'a warning nobody heeded' });
  minLights(ctx, [...(d ? [d.side] : []), ...lat], 1, 'one lantern still burning, by the way in');
  ctx.minInfo = { kind: 'collapsed', falls: falls.length, cart: cart?.id || null, beam: beam?.id || null, piles: piles.length, strips: road ? road.strips.length : 0 };
  ccmDone(ctx);
  return { feature: dunSeen(ctx, falls), what: `${falls.length} rock fall${falls.length > 1 ? 's' : ''} across the far end${beam ? ', roof timbers down before it' : ''}${cart ? ', a cart caught by it' : ''}, ${piles.length} smaller heaps`, approach: null, passage: true };
}

// FLOODED GALLERY (terminal): still water wall to wall (the floor is the water). Timber props stand in it in two rows, what
// stopped the work is at the far end (the pump, or the fall that let the water in), a cart sits half-drowned and stores float.
function minFlooded(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: true }), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const end = dunFocal(ctx, far, ['rural-water-pump-mine', ...MIN_FALL], { label: 'the far end', rule: 'key-end', sku: L < 10 ? { shape: 's2' } : undefined, why: 'at the far end, in the water: what stopped the work here' });
  const target = end ? front(end, 2) : ctx.sidePoint(far, L / 2, 3);
  dunWalks(ctx, target);
  const pil = ccmFirst(ctx, ['post-timber', 'pillar-waterline']), posts = [];
  if (pil && L >= 8.5) { const nz = Math.max(1, Math.round(deep / 9)); for (let j = 0; j < nz; j++) for (const f of L >= 13.5 ? [0.2, 0.8] : [0.14, 0.86]) { const [x, z] = ctx.sidePoint(far, L * f, deep * (j + 0.5) / nz); const p = castlePut(ctx, pil, [[x, z, 0], [x + 0.6, z, 0], [x - 0.6, z, 0], [x, z + 0.6, 0]], { layer: 'anchor', rule: 'key-prop', why: 'a timber prop standing in the water' }); if (p) posts.push(p); } }
  const key = end || posts[0];
  if (!key) return { fail: 'flooded gallery has nothing standing in the water (no pump, fall or prop mesh)' };
  dunSight(ctx, dunSeen(ctx, [end, ...posts]) || key);
  const cart = L >= 8.5 ? dunFree(ctx, ccmFirst(ctx, ['mine-cart', 'wheelbarrow']), ctx.sidePoint(far, L * (minSeed(ctx, 'cart') % 2 ? 0.7 : 0.3), deep * 0.45), 6, 'a cart left where the water caught it', { margin: 0.4, rot: ctx.r(0, 6.28) }) : null;
  const flot = []; for (let i = 0, n = Math.max(1, Math.min(4, Math.round(cells / 7))); i < n; i++) { const p = dunFree(ctx, ccmAny(ctx, ['flotsam-crate', 'barrel', 'crate', 'bucket']), [ctx.r(ctx.X0 + 2, ctx.X1 - 2), ctx.r(ctx.Z0 + 2, ctx.Z1 - 2)], 6, 'floating in the water', { margin: 0.4, rot: ctx.r(0, 6.28) }); if (p) flot.push(p); }
  dunWalls(ctx, ['rubble-pile', 'rural-pit-props-stack', 'crate'], lat, Math.max(1, Math.round(cells / 9)), 'breaking the surface by the wall', { sku: { shape: 's2' } });
  minLights(ctx, [...(d ? [d.side] : []), ...lat], Math.max(1, Math.min(3, Math.round(ctx.area() / 220))), 'a lantern above the water');
  ctx.minInfo = { kind: 'flooded', end: end?.id || null, posts: posts.length, cart: cart?.id || null, flotsam: flot.length };
  ccmDone(ctx);
  return { feature: dunSeen(ctx, [end, ...posts]), what: `water wall to wall, ${posts.length} timber props standing in it${end ? `, ${end.id.replace(/^rural-/, '').replace(/-/g, ' ')} at the far end` : ''}, ${flot.length} things afloat`, approach: null, passage: true };
}

// SHAFT HEAD (hub; THE VERTICAL LINK): the shaft in the middle of the floor (its timber collar; else the open-pit flat; else a
// well), the winch beside it on the side away from the door, the ladder way on the wall behind, kibbles (ore buckets) at
// the lip, the signal bell, a cart waiting, lamps and stores round the walls. Every door is joined to the shaft.
function minShaftHead(ctx) {
  const d = ctx.mainDoor, cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2, ALL = ['N', 'S', 'E', 'W'], narrow = Math.min(ctx.W, ctx.D), cells = ccmCells(ctx), far = ccmFar(ctx);
  let shaft = narrow >= 11 ? ccmCentre(ctx, ['mine-shaft-collar'], { label: 'the shaft', rule: 'key-shaft', why: 'the shaft: its timber collar in the middle of the floor' }) : null, half = shaft ? Math.max(shaft.dims[0], shaft.dims[2]) / 2 : 2.5;
  if (!shaft && narrow >= 11 && ccmHas(ctx, 'pit-open')) { shaft = dunFlat(ctx, 'pit-open', cx, cz, 0, 'the shaft: a square hole going down into the dark', { rule: 'key-shaft', layer: 'anchor' }); if (shaft) ctx.mark(cx, cz, 4.4, 4.4); }
  if (!shaft) { shaft = ccmCentre(ctx, ['well', 'floor-trapdoor', 'oubliette-hatch'], { label: 'the shaft', rule: 'key-shaft', why: 'the shaft mouth' }); if (shaft) half = Math.max(shaft.dims[0], shaft.dims[2]) / 2; }
  if (!shaft) return { fail: 'shaft head has no shaft (no collar, pit or well)' };
  ctx.focal = { label: 'the shaft', id: shaft.id, ok: true, centre: true };
  const sx = shaft.x, sz = shaft.z, [fx, fz] = ctx.facingVec(SIDES[far].rot); // (fx, fz): from the far wall into the room
  for (const o of ctx.doors) { const dx = o.inner[0] - sx, dz = o.inner[1] - sz, len = Math.hypot(dx, dz) || 1; ccmWalk(ctx, o === d ? 'approach' : 'branch', [o.inner, [sx + dx / len * (half + 1.6), sz + dz / len * (half + 1.6)]]); }
  if (ctx.doors.length >= 2) { const way = ctx.doors.map(o => o.inner).sort((p, q) => Math.atan2(p[1] - sz, p[0] - sx) - Math.atan2(q[1] - sz, q[0] - sx)); ctx.walk('ring', way, { closed: true, quietSkips: true }); } /* a hub: the way round the shaft from door to door, kept before anything else stands here */
  const road = narrow >= 18.5 ? minRoad(ctx) : null; /* a siding along a wall with no door: the cart that takes what the winch brings up */ road?.keep();
  // the winch: beside the shaft, away from the door, its drum toward the shaft
  let winch = null;
  if (ccmHas(ctx, 'windlass') && shaft.id !== 'well') { const [, wd] = ccmSize(ctx, 'windlass'), r = half + wd / 2 + 0.35, spots = [[sx - fx * r, sz - fz * r, SIDES[far].rot], [sx + fz * r, sz - fx * r, SIDES[far].rot - Math.PI / 2], [sx - fz * r, sz + fx * r, SIDES[far].rot + Math.PI / 2]];
    winch = castlePut(ctx, 'windlass', spots, { layer: 'anchor', rule: 'key-winch', why: 'the winch: beside the shaft, its rope going down', unique: true }); }
  const ladder = null; /* NO ladder is rolled here: a `ladder-wood` IS a stair (core/stairs.js: it opens the floor above), so the ladder way is the building generator's planned core, or is put down by hand ("Stairs down" at the shaft); the collar mesh shows the ladder's top */
  const kib = []; for (const [ax, az] of [[1, 1], [-1, 1]]) { const p = narrow >= 13.5 ? dunFree(ctx, ccmFirst(ctx, ['rural-ore-bucket', 'bucket']), [sx + ax * (half + 1.2), sz + az * (half + 1.2) * (fz || 1)], 2.6, 'a kibble at the lip of the shaft', { margin: 0.15 }) : null; if (p) kib.push(p); }
  const bell = false && narrow >= 13.5 ? dunFree(ctx, 'watch-lantern-bell', [sx + fz * (half + 2.2) + fx * 1.5, sz - fx * (half + 2.2) + fz * 1.5], 3, 'the signal bell and its lantern: ring for the winch', { margin: 0.2, layer: 'light', unique: true }) : null;
  const cart = road ? minCarts(ctx, road, [0.5], 'a loaded cart on the siding by the shaft', ['mine-cart'])[0] || null : narrow >= 13.5 && d ? dunFree(ctx, ccmFirst(ctx, MIN_CART), [(sx + d.inner[0]) / 2 + fz * 3.5, (sz + d.inner[1]) / 2 - fx * 3.5], 4.5, 'a cart waiting at the shaft', { margin: 0.3, rot: SIDES[far].rot + Math.PI / 2 }) : null;
  const heap = narrow >= 13.5 ? dunFree(ctx, ccmFirst(ctx, ['ore-pile']), [sx + fz * (half + 2.6), sz - fx * (half + 2.6)], 3.5, 'ore tipped out of the kibble, beside the shaft', { margin: 0.3, rot: ctx.r(0, 6.28) }) : null;
  const stood = dunWalls(ctx, ['mine-lamp-rack', 'rural-pit-props-stack', 'mine-tool-rack', 'crate', 'barrel'], ctx.shuffle(ALL), Math.max(1, Math.round(cells / 7)), 'stores against the wall');
  castleHang(ctx, ['coat-pegs', 'rural-sign-danger-mine'], ctx.shuffle(ALL), 1, { height: 5, why: 'coats on pegs by the shaft' });
  void heap;
  minLights(ctx, ALL, Math.max(2, Math.min(4, Math.round(ctx.area() / 150))), 'a lantern at the shaft head');
  ctx.minInfo = { kind: 'shaft-head', shaft: shaft.id, winch: !!winch || shaft.id === 'well', ladder: !!ladder, kibbles: kib.length, bell: !!bell, cart: cart?.id || null, stood: stood.length };
  ccmDone(ctx);
  return { feature: shaft.orient === 'floor' ? null : shaft, what: `the shaft (${shaft.id.replace(/-/g, ' ')}) in the middle${winch ? ', the winch beside it' : ''}, ${kib.length} kibbles at the lip`, approach: null, passage: true };
}

// ORE-SORTING CHAMBER (uses the stores): sorting tables down the middle of the floor, heaps of ore in a row along the far
// wall (like with like), a cart road down one side with loaded carts on it, barrels, crates and a barrow round the rest.
function minSorting(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W;
  const road = Math.min(ctx.W, ctx.D) >= 13.5 ? minRoad(ctx) : null, carts = minCarts(ctx, road, road && road.Lr >= 24 ? [0.3, 0.7] : [0.5], 'a loaded cart on the siding');
  road?.keep();
  const heapWall = road && road.wall === far ? OPP_SIDE[far] : far, heapId = ccmFirst(ctx, MIN_HEAP);
  const tid = ccmFirst(ctx, L >= 13.5 || deep >= 13.5 ? ['sorting-table', 'table-trestle', 'table-square'] : ['table-square', 'sorting-table']), tables = [];
  if (tid) { const [tw] = ccmSize(ctx, tid), alongT = L - (road && lat.includes(road.wall) ? 5 : 0) >= tw + 5, n = Math.max(1, Math.min(3, Math.round(cells / 14))), off = road && lat.includes(road.wall) ? (ctx.sidePoint(far, 0, 0)[0] === ctx.sidePoint(road.wall, 0, 0)[0] && ctx.sidePoint(far, 0, 0)[1] === ctx.sidePoint(road.wall, 0, 0)[1] ? 2.5 : -2.5) : 0;
    const order = [...Array(n).keys()].sort((a, b) => Math.abs(a - (n - 1) / 2) - Math.abs(b - (n - 1) / 2)); /* the middle table first: the walks are drawn to it, the others keep off them */
    for (const i of order) { const s = deep * (i + 1) / (n + 1) + (heapId && heapWall === far ? 1 : 0), [x, z] = ctx.sidePoint(far, L / 2 + off, s); const p = castlePut(ctx, tid, [[x, z, SIDES[far].rot + (alongT ? 0 : Math.PI / 2)], [x + 1, z, SIDES[far].rot + (alongT ? 0 : Math.PI / 2)], [x, z + 1, SIDES[far].rot + (alongT ? 0 : Math.PI / 2)]], { layer: 'anchor', rule: 'key-table', why: 'a sorting table in the middle of the floor' });
      if (p) { tables.push(p); if (tables.length === 1) dunWalks(ctx, front(p, 1.8)); } } }
  if (!tables.length) dunWalks(ctx, ctx.sidePoint(heapWall, ctx.sideLen(heapWall) / 2, 4.5));
  const heaps = heapId ? ccmAlong(ctx, [heapId], [heapWall], Math.max(1, Math.min(4, Math.floor(ctx.sideLen(heapWall) / 6))), { why: 'ore in heaps along the wall, sorted by kind', layer: 'anchor', rule: 'key-heap' }) : [];
  const key = tables[0] || heaps[0];
  if (!key) return { fail: 'sorting chamber has no table and no ore (no table or heap mesh)' };
  ctx.focal = { label: 'the sorting table', id: key.id, ok: true, centre: !!tables.length };
  dunSight(ctx, key);
  for (const t of tables) { if (t.id === 'sorting-table') continue; ccmOn(ctx, ccmFirst(ctx, ['rural-sieve-riddle', 'sieve-wooden-drum']), t, -0.3, 0, 'a sieve on the table'); ccmOn(ctx, ccmFirst(ctx, ['rural-ore-iron-chunk', 'salt-block']), t, 0.25, 0.1, 'a lump being looked at'); }
  const walls = ['N', 'S', 'E', 'W'].filter(s => s !== heapWall && s !== road?.wall);
  const stood = dunWalls(ctx, ['crate', 'barrel', 'sack', 'wheelbarrow', 'rural-ore-basket', 'bucket', 'crate', 'barrel'], walls, Math.max(2, Math.round(cells / 5)), 'sorted ore boxed and barrelled against the wall');
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-coal-dust'], Math.max(1, Math.min(3, Math.round(ctx.area() / 200))), 'grit on the floor');
  minLights(ctx, walls.length ? walls : lat, Math.max(2, Math.min(4, Math.round(ctx.area() / 180))), 'a lantern over the sorting floor');
  ctx.minInfo = { kind: 'sorting', tables: tables.length, heaps: heaps.length, carts: carts.length, road: road?.wall || null, stood: stood.length };
  ccmDone(ctx);
  return { feature: key, what: `${tables.length} sorting table${tables.length === 1 ? '' : 's'}, ${heaps.length} heaps of ore along the wall${road ? `, a siding with ${carts.length} cart${carts.length === 1 ? '' : 's'}` : ''}`, approach: null, passage: true };
}

// TOOL STORE (terminal): the tool rack on the wall facing the door, more tools and timber round the walls (like with like:
// props with props, tools with tools), helmets on pegs, a grindstone, a barrow.
function minToolStore(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far);
  const key = dunFocal(ctx, far, ['mine-tool-rack', 'garden-tools-leaning', 'rural-pit-props-stack', 'shelving-freestanding', 'crate'], { label: 'the tool rack', why: 'the tool rack: on the wall facing the door' });
  if (!key) return { fail: 'tool store has no rack or stack (no tool mesh)' };
  dunWalks(ctx, front(key, 1.8));
  dunSight(ctx, key);
  const tools = dunWalls(ctx, ['garden-tools-leaning', 'spade-garden'], [far, lat[0]], cells >= 12 ? 2 : 1, /* (ONE pick rack, the focal piece: two read as an armoury; shovels and rakes leaning say "tool shed") */ 'tools kept together', { prefer: 'near', near: [key.x, key.z] });
  const timber = dunWalls(ctx, ['wheelbarrow', 'rural-pit-props-stack', 'lumber-pile', 'rural-ore-bucket', 'rural-pit-props-stack', 'crate'], [lat[1], ...(d ? [d.side] : []), lat[0]], Math.max(2, Math.round(cells / 3.2)), 'timber and stores against the wall');
  castleHang(ctx, ['coat-pegs'], [...lat, far], 1, { height: 5, why: 'coats on pegs' });
  minLights(ctx, lat, 1);
  ctx.minInfo = { kind: 'tool-store', key: key.id, tools: tools.length, timber: timber.length };
  ccmDone(ctx);
  return { feature: key, what: `the tool rack facing the door, ${tools.length} more lots of tools, ${timber.length} lots of timber and stores`, approach: null, passage: true };
}

// MINERS' MESS (terminal): one long table down the middle with a bench each side and food on it, the cook fire on the wall
// facing the door, a couple of bunks along one wall (two at most: more is a barracks), kegs and pegs by the door.
function minMess(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), deep = far === 'N' || far === 'S' ? ctx.D : ctx.W, cx = (ctx.X0 + ctx.X1) / 2, cz = (ctx.Z0 + ctx.Z1) / 2;
  const fire = dunFocal(ctx, far, ['cauldron-crane', 'firepit-stone-round', 'brazier-standing'], { label: 'the cook fire', rule: 'key-fire', gap: 0.4, loose: true, layer: 'light', why: 'the cook fire: on the wall facing the door' });
  const reach = fire ? fire.dims[2] + 2.6 : 2, tid = ccmFirst(ctx, deep - reach >= 11 || L >= 14 ? ['table-trestle', 'table-square'] : ['table-square', 'table-trestle']);
  if (!tid) return { fail: 'mess has no table' };
  const [tw, td] = ccmSize(ctx, tid), alongS = deep - reach >= tw + 4.5, rot = SIDES[far].rot + (alongS ? Math.PI / 2 : 0), sMid = alongS ? reach + (deep - reach) / 2 : Math.min(deep - td / 2 - 3.2, reach + 1.4 + td / 2 + 1.5), [tx, tz] = ctx.sidePoint(far, L / 2, sMid);
  const table = castlePut(ctx, tid, [[tx, tz, rot], [tx, tz, rot + Math.PI / 2], [cx, cz, rot]], { layer: 'anchor', rule: 'key-table', why: 'the mess table: in the middle of the floor' });
  if (!table) return { fail: 'mess: the table does not fit' };
  ctx.focal = { label: 'the mess table', id: table.id, ok: true, centre: true };
  const [ux, uz] = [Math.sin(table.rot), Math.cos(table.rot)], seats = [];
  for (const sgn of [1, -1]) { const id = ccmFirst(ctx, table.dims[0] >= 6 ? ['bench-long', 'stool-three-leg'] : ['stool-three-leg', 'bench-long']); if (!id) break; const off = table.dims[2] / 2 + ccmSize(ctx, id)[1] / 2 + 0.25; const p = castlePut(ctx, id, [0.15, 0.45, 0.75, 1.1].map(e => [table.x + ux * (off + e) * sgn, table.z + uz * (off + e) * sgn, table.rot + (sgn > 0 ? Math.PI : 0)]), { layer: 'furnish', rule: 'seat', why: 'a bench at the mess table' }); /* (real benches are deeper than their catalog line: a few gaps are tried) */ if (p) seats.push(p); }
  ccmClearRound(ctx, table, 1.4);
  dunWalks(ctx, d ? [table.x + (d.inner[0] - table.x) * 0.35, table.z + (d.inner[1] - table.z) * 0.35] : null);
  let food = 0; for (const [id, fxr, fzr] of [['pasty', -0.3, 0.1], ['tankard', -0.1, -0.2], ['bread-loaf', 0.12, 0.15], ['mug-wooden', 0.3, -0.15], ['lantern-hand', 0.02, 0], ['jerky-bundle', 0.4, 0.2]]) if (ccmOn(ctx, id, table, fxr * (table.dims[0] >= 6 ? 1 : 0.7), fzr, 'on the mess table')) food++;
  const bunkWall = lat[minSeed(ctx, 'bunks') % 2], bunks = [];
  if (L >= 13.5) for (let i = 0; i < (deep >= 18 ? 2 : 1); i++) { const p = ccmLieAlong(ctx, ccmFirst(ctx, ['bunk-bed', 'cot']), [bunkWall], { why: 'a bunk along the wall, for the shift that sleeps here', near: ctx.sidePoint(far, bunkWall === lat[0] ? 0 : L, deep * (i ? 0.72 : 0.3)) }); if (p) bunks.push(p); }
  const other = [OPP_SIDE[bunkWall], ...(d ? [d.side] : []), ...(bunks.length ? [] : [bunkWall])];
  const stood = dunWalls(ctx, ['barrel', 'crate', 'rain-barrel', 'sack', 'bucket'], other, Math.max(1, Math.round(cells / 8)), 'water, ale and stores against the wall');
  castleHang(ctx, ['coat-pegs'], other, 1, { height: 5, why: 'coats on pegs' });
  minLights(ctx, [...lat, ...(d ? [d.side] : [])], Math.max(1, Math.min(3, Math.round(ctx.area() / 200))), 'a lantern over the mess');
  ctx.minInfo = { kind: 'mess', table: table.id, seats: seats.length, fire: fire?.id || null, bunks: bunks.length, food, stood: stood.length };
  ccmDone(ctx);
  return { feature: table, what: `the mess table with ${seats.length} benches${fire ? ', the cook fire on the far wall' : ''}, ${bunks.length} bunk${bunks.length === 1 ? '' : 's'}`, approach: null, passage: true };
}

// POWDER & LAMP STORE (terminal, locked): the powder on the wall facing the door and in a row along the walls (kegs with
// kegs), the lamps racked on the door wall as far from it as the room allows, a sand bucket, ONE closed lantern by the door.
function minPowder(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far);
  const key = dunFocal(ctx, far, ['powder-keg-stack', 'barrel', 'crate'], { label: 'the powder', rule: 'key-powder', why: 'the powder: stacked on the wall facing the door' });
  if (!key) return { fail: 'powder store has no kegs (no keg or barrel mesh)' };
  dunWalks(ctx, front(key, 1.8));
  dunSight(ctx, key);
  const kegs = dunWalls(ctx, ['powder-keg-stack', 'barrel', 'barrel', 'crate'], [far, ...lat], Math.max(2, Math.round(cells / 2.2)), 'kegs in a row along the wall', { prefer: 'near', near: [key.x, key.z] });
  const lamps = dunWalls(ctx, ['mine-lamp-rack', 'shelving-freestanding', 'crate'], d ? [d.side, ...lat] : lat, 1, 'the lamps: racked by the door, away from the powder', { prefer: 'near', near: d ? d.inner : null });
  dunWalls(ctx, ['bucket', 'sack'], d ? [d.side] : lat, 1, 'a bucket of sand by the door');
  castleHang(ctx, ['rural-sign-danger-mine', 'key-hook-board'], [far, ...lat], 1, { height: 6, why: 'a warning board over the powder' });
  ccmWallLights(ctx, ['lantern-wall-horn', 'lantern-wall-iron'], d ? [d.side] : lat, { every: 999, min: 1, max: 1, height: 5.4, why: 'one closed lantern, by the door: no naked flame here' }); ccmEnsureLight(ctx, MIN_LAMP, MIN_STAND);
  ctx.minInfo = { kind: 'powder-store', key: key.id, kegs: kegs.length + 1, lamps: lamps[0]?.id || null };
  ccmDone(ctx);
  return { feature: key, what: `${kegs.length + 1} lots of kegs along the walls${lamps.length ? ', the lamps racked by the door' : ''}, one closed lantern`, approach: null, passage: true };
}

// CRYSTAL SEAM (terminal; the reward room): the great crystal in the middle of the floor (on the far wall in a small
// room), the vein across the wall behind it, crystals growing out of the rock along the walls, and by the door what the
// finders left: a cart, their tools. Almost no lamp: the crystals are the light.
function minSeam(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far), narrow = Math.min(ctx.W, ctx.D);
  const veins = minVeins(ctx, far, { sku: { shape: 's2' } });
  const big = narrow >= 13.5 ? ccmCentre(ctx, ['crystal-formation'], { label: 'the great crystal', rot: ctx.r(0, 6.28), why: 'the great crystal: in the middle of the floor' }) : veins.length ? null : dunFocal(ctx, far, ['crystal-formation', 'crystal-glowing', 'geode-cluster'], { label: 'the great crystal', why: 'the crystal: on the wall facing the door' });
  const small = ['crystal-glowing', 'crystal-formation', 'geode-cluster'].filter(i => ccmHas(ctx, i)), grown = []; /* (a split geode reads as a planter: crystals first) */
  const grow = (i) => { const id = small[i % Math.min(2, small.length)]; const p = ccmQuiet(ctx, () => ccmScaled(ctx, id, id === 'crystal-formation' ? 0.5 : 1 + (minSeed(ctx, 'grow', i) % 3) * 0.4, () => ctx.wall(id, { sides: [[far, ...lat][i % 3]], layer: 'light', rule: 'crystal', why: 'crystals growing out of the rock', prefer: 'random' }))); if (p) grown.push(p); return p; };
  const key = big || veins[Math.floor(veins.length / 2)] || (small.length ? grow(0) : null);
  if (!key) return { fail: 'crystal seam has no crystal (no crystal or vein mesh)' };
  ctx.focal = { label: 'the great crystal', id: key.id, side: big && narrow >= 13.5 ? undefined : far, ok: true, centre: !!(big && narrow >= 13.5) };
  dunWalks(ctx, front(key, 2));
  dunSight(ctx, key);
  for (let i = grown.length, n = Math.max(2, Math.min(9, Math.round(cells / 3))); i < n && small.length; i++) grow(i);
  const left = d ? dunWalls(ctx, ['mine-tool-rack', ...MIN_CART.slice(0, 2), 'ore-pile', 'crate'], [d.side], narrow >= 13.5 ? 2 : 1, 'left by whoever found it', { prefer: 'near', near: d.inner }) : [];
  dunScatter(ctx, ['decal-rubble-scatter'], 1, 'chips on the floor');
  if (!grown.length && !big) minLights(ctx, d ? [d.side] : lat, 1, 'a lantern by the way in'); else ccmEnsureLight(ctx, MIN_LAMP, MIN_STAND);
  ctx.minInfo = { kind: 'seam', big: big?.id || null, veins: veins.length, grown: grown.length, left: left.length };
  ccmDone(ctx);
  return { feature: key, what: `${big ? 'the great crystal, ' : ''}${veins.length ? `the vein across the far wall, ` : ''}${grown.length} crystals growing along the walls`, approach: null, passage: true };
}

// PITHEAD YARD (outdoor, a hub in use: no walls of its own). The headframe over the shaft mouth in the middle (else a
// well-house, else a well) with the winch beside it; the stockpile (heaps in a row, like with like) along one edge, timber
// along another; carts, a barrow and a hand cart standing about; lantern posts; a way-board by the way in.
function minPithead(ctx) {
  const A = ctx.area(), cells = ccmCells(ctx), ALL = ['N', 'S', 'E', 'W'], d = ctx.mainDoor, narrow = Math.min(ctx.W, ctx.D);
  const info = ctx.yardInfo = { vibe: 'pithead yard', edge: 'none', edgePieces: 0, wallFt: 0, gate: null, focal: null, signs: 0, wear: 0, doors: [], training: false, plants: { placed: 0, slot: [], waiting: [] }, pairs: 0, singles: 0 };
  ctx.densityTarget = yardTarget(A);
  for (const s of ALL) { const m = ctx.openings.filter(o => o.side === s && o.to && /^(wall|window|door)$/.test(o.kind)).map(o => [Math.max(0, o.index * CELL - INSET), Math.min(ctx.sideLen(s), (o.index + 1) * CELL - INSET)]).sort((a, b) => a[0] - b[0]);
    info.wallFt += m.reduce((a, [t0, t1]) => a + t1 - t0, 0); let t = 0; for (const [a, b] of m) { if (a > t + 1e-6) ctx.mounts[s].push([t, a]); t = Math.max(t, b); } if (t < ctx.sideLen(s) - 1e-6) ctx.mounts[s].push([t, ctx.sideLen(s)]); }
  info.wallFt = Math.round(info.wallFt);
  const head = ccmCentre(ctx, narrow >= 13.5 ? ['mine-headframe', 'well-house', 'well'] : ['well', 'well-house'], { label: 'the headframe', rule: 'key-headframe', why: 'the headframe: over the shaft mouth, in the middle of the yard' });
  if (!head) return { fail: 'pithead yard has no headframe (no headframe, well-house or well)' };
  info.focal = { id: head.id, kind: head.id === 'mine-headframe' ? 'headframe' : 'winding house' };
  const half = Math.max(head.dims[0], head.dims[2]) / 2;
  for (const o of ctx.doors) { const dx = o.inner[0] - head.x, dz = o.inner[1] - head.z, len = Math.hypot(dx, dz) || 1; ccmWalk(ctx, o === d ? 'approach' : 'branch', [o.inner, [head.x + dx / len * (half + 1.8), head.z + dz / len * (half + 1.8)]]); }
  const winch = ccmHas(ctx, 'windlass') && head.id !== 'well' ? castlePut(ctx, 'windlass', [[head.x + half + 2, head.z, -Math.PI / 2], [head.x - half - 2, head.z, Math.PI / 2], [head.x, head.z + half + 2, Math.PI], [head.x, head.z - half - 2, 0]], { layer: 'anchor', rule: 'key-winch', why: 'the winch beside the shaft mouth', unique: true }) : null;
  const order = ctx.shuffle(ALL.filter(s => !d || s !== d.side)), heapSide = order[0], timberSide = order[1] || order[0];
  const hid = [...new Set(['rural-tailings-pile', 'ore-pile', 'rural-slag-heap', 'mil-catapult-stones', 'stone-blocks-stack'].filter(i => ccmHas(ctx, i)))].slice(0, 2), heaps = [];
  for (let i = 0, n = Math.max(2, Math.min(6, Math.round(cells / 9))); i < n && hid.length; i++) { const t = ctx.sideLen(heapSide) * (i + 0.5) / n; const p = ccmQuiet(ctx, () => ctx.put(hid[i % hid.length], (dm) => ctx.wallGen(dm, [heapSide], { gap: 0.6 }), (c) => Math.abs(c.t - t), { layer: 'anchor', rule: 'key-heap', why: 'the stockpile: heaps in a row along the edge of the yard', sku: i % 2 ? { shape: 's2' } : undefined })); if (p) heaps.push(p); }
  const timber = dunWalls(ctx, ['lumber-pile', 'rural-pit-props-stack', 'crate', 'barrel', 'sack'], [timberSide], Math.max(1, Math.min(4, Math.round(cells / 14))), 'timber and stores stacked at the edge of the yard');
  const carts = []; for (const [id, ax, az] of [[ccmFirst(ctx, ['mine-cart', 'cart-hand']), -1, 1], ['wheelbarrow', 1, 1], [ccmFirst(ctx, ['cart-hand', 'mine-cart']), 1, -1]].slice(0, narrow >= 18 ? 3 : 2)) { const p = id && dunFree(ctx, id, [head.x + ax * (half + 5), head.z + az * (half + 4)], 6, 'standing in the yard, between the shaft and the heaps', { margin: 0.4, rot: ctx.r(0, 6.28) }); if (p) carts.push(p); }
  const shed = cells >= 42 ? ccmCorner(ctx, 'cart-shed', [timberSide, ccmLat(timberSide)[0]], { why: 'the cart shed in the corner of the yard', inset: 0.8 }) : null;
  const wash = dunWalls(ctx, ['sluice-box', 'water-trough', 'rain-barrel'], order.slice(2).length ? order.slice(2) : [timberSide], 1, 'water for washing the ore');
  const lamps = []; for (const [ax, az] of [[1, -1], [-1, 1], [-1, -1]].slice(0, Math.max(1, Math.min(3, Math.round(cells / 20))))) { const p = dunFree(ctx, ccmFirst(ctx, ['lantern-post', 'lamp-post-wood', 'lantern-post-indoor']), [head.x + ax * (half + 3), head.z + az * (half + 3)], 5, 'a lantern post in the yard', { margin: 0.3, layer: 'light' }); if (p) lamps.push(p); }
  if (d) { const [fx, fz] = ctx.facingVec(SIDES[d.side].rot); if (dunFree(ctx, ccmFirst(ctx, ['signpost', 'notice-board']), [d.inner[0] + fz * 4 + fx * 2, d.inner[1] - fx * 4 + fz * 2], 4, 'the way-board by the way in', { margin: 0.3, unique: true })) info.signs = 1; }
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-coal-dust'], Math.max(1, Math.min(4, Math.round(A / 400))), 'trodden into the yard');
  info.singles = heaps.length + timber.length + carts.length;
  ctx.minInfo = { kind: 'pithead', head: head.id, winch: !!winch, heaps: heaps.length, timber: timber.length, carts: carts.length, shed: !!shed, wash: wash.length, lamps: lamps.length };
  ccmDone(ctx);
  return { feature: head, what: `pithead yard: the ${info.focal.kind} over the shaft${winch ? ' with its winch' : ''}, ${heaps.length} heaps in the stockpile, ${carts.length} carts and barrows`, outdoor: true, approach: null, passage: true };
}

// SMELTER HOUSE (terminal; on the surface, in fieldstone): the furnace on the wall facing the door with standing room
// before it, fuel and the quench trough beside it, ingots stacked along one wall, ore waiting by the door, a wash tub.
function minSmelter(ctx) {
  const d = ctx.mainDoor, far = ccmFar(ctx), lat = ccmLat(far), cells = ccmCells(ctx), L = ctx.sideLen(far);
  const key = dunFocal(ctx, far, ['smelter', 'hearth-raised-square', 'hearth-central-hood', 'bread-oven'], { label: 'the furnace', rule: 'key-furnace', gap: 0.3, why: 'the furnace: on the wall facing the door' });
  if (!key) return { fail: 'smelter house has no furnace (no smelter or hearth mesh)' };
  dunWalks(ctx, front(key, 2.4));
  dunSight(ctx, key);
  { const [px, pz] = front(key, 1.6); ctx.mark(px, pz, 4, 3.2, KEEP); }
  const by = dunWalls(ctx, ['coal-bin', 'quench-trough', 'rural-bellows-ventilation', 'smith-soot-bucket'], [far, ...lat], L >= 13.5 ? 2 : 1, 'fuel and the quench trough, beside the furnace', { prefer: 'near', near: [key.x, key.z] });
  const ingots = dunWalls(ctx, ['ingot-stack', 'crate', 'chest-plain'], [lat[0]], Math.max(1, Math.round(cells / 9)), 'ingots stacked along the wall');
  const ore = dunWalls(ctx, [...MIN_HEAP.slice(0, 3), 'wheelbarrow', 'sack', 'barrel'], d ? [d.side, lat[1]] : [lat[1]], Math.max(1, Math.round(cells / 7)), 'ore waiting by the door', { prefer: 'near', near: d ? d.inner : null });
  const wash = dunWalls(ctx, ['washtub', 'water-trough', 'rain-barrel', 'bucket', 'grindstone'], [lat[1], lat[0]], cells >= 16 ? 2 : 1, 'water for washing the ore');
  dunScatter(ctx, ['decal-coal-dust', 'decal-scorch'], Math.max(1, Math.min(2, Math.round(ctx.area() / 200))), 'soot on the floor');
  minLights(ctx, lat, 1, 'a lantern (the furnace is the light when it burns)');
  ctx.minInfo = { kind: 'smelter', furnace: key.id, by: by.length, ingots: ingots.length, ore: ore.length, wash: wash.length };
  ccmDone(ctx);
  return { feature: key, what: `the furnace facing the door, ${by.length} things beside it, ${ingots.length} stacks of ingots, ore by the door`, approach: null, passage: true };
}

// the leg of a shaped room: stores against the wall and a lantern, never the key piece
function minAnnex(ctx, { wall = MIN_STORE, n = null } = {}) {
  const sides = ctx.shuffle(['N', 'S', 'E', 'W']), k = n ?? Math.max(1, Math.round(ctx.area() / 120));
  dunWalls(ctx, wall, sides, k, 'against the wall');
  dunScatter(ctx, ['decal-rubble-scatter', 'decal-cracks'], 1, 'on the floor');
  minLights(ctx, sides, 1);
}
Object.assign(KEY, { 'min-tunnel': minTunnel, 'min-junction': minJunction, 'min-face': minFace, 'min-collapsed': minCollapsed, 'min-flooded': minFlooded, 'min-shaft-head': minShaftHead, 'min-sorting': minSorting,
  'min-tool-store': minToolStore, 'min-mess': minMess, 'min-powder-store': minPowder, 'min-seam': minSeam, 'min-pithead': minPithead, 'min-smelter': minSmelter });
Object.assign(MENUS, {
  'min-tunnel': ccmAnnex((ctx) => minAnnex(ctx, { n: 1 })), 'min-junction': ccmAnnex((ctx) => minAnnex(ctx, { n: 1 })),
  'min-face': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['rubble-pile', 'crate'], n: 1 })), 'min-collapsed': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['rubble-pile'], n: 1 })),
  'min-flooded': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['rubble-pile', 'flotsam-crate', 'barrel'] })), 'min-shaft-head': ccmAnnex((ctx) => minAnnex(ctx)),
  'min-sorting': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['crate', 'barrel', 'sack', ...MIN_HEAP] })), 'min-tool-store': ccmAnnex((ctx) => minAnnex(ctx)),
  'min-mess': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['barrel', 'crate', 'cot'] })), 'min-powder-store': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['barrel', 'crate'] })),
  'min-seam': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['crystal-glowing', 'geode-cluster', 'rubble-pile'] })), 'min-smelter': ccmAnnex((ctx) => minAnnex(ctx, { wall: ['crate', 'barrel', 'sack'] })),
});
// (no indoor target under 3.5: test/yard.test.mjs holds the yard's against 0.6x of every other entry; no line for the pithead: it sets its own)
Object.assign(DENSITY, { 'min-tunnel': 3.5, 'min-junction': 3.5, 'min-face': 4, 'min-collapsed': 4, 'min-flooded': 3.5, 'min-shaft-head': 4.5, 'min-sorting': 5, 'min-tool-store': 6, 'min-mess': 5, 'min-powder-store': 6, 'min-seam': 4, 'min-smelter': 5 });
Object.assign(FOCAL, { 'min-face': 'the vein (across the end wall) or the muck pile', 'min-collapsed': 'the rock fall', 'min-flooded': 'what stopped the work (far end, in the water)', 'min-shaft-head': 'the shaft (in the middle of the floor)', 'min-sorting': 'the sorting table (in the middle of the floor)',
  'min-tool-store': 'the tool rack (wall facing the door)', 'min-mess': 'the mess table (in the middle of the floor)', 'min-powder-store': 'the powder (wall facing the door)', 'min-seam': 'the great crystal', 'min-pithead': 'the headframe (in the middle of the yard)', 'min-smelter': 'the furnace (wall facing the door)' });
Object.assign(KEY_RE, { 'min-tunnel': null, 'min-junction': null, 'min-face': /^(ore-vein|collapse-rubble|rubble-pile|rural-tailings-pile|ore-pile|mil-catapult-stones|stone-blocks-stack)$/, 'min-collapsed': /^(collapse-rubble|rubble-pile|rural-tailings-pile|stone-blocks-stack)$/,
  'min-flooded': /^(rural-water-pump-mine|collapse-rubble|rubble-pile|rural-tailings-pile|stone-blocks-stack|post-timber|pillar-waterline)$/, 'min-shaft-head': /^(mine-shaft-collar|pit-open|well|floor-trapdoor|oubliette-hatch|windlass)$/, 'min-sorting': /^(sorting-table|table-|ore-pile|rural-tailings-pile|mil-catapult-stones|rubble-pile|stone-blocks-stack)/,
  'min-tool-store': /^(mine-tool-rack|garden-tools-leaning|rural-pit-props-stack|shelving-freestanding|crate)$/, 'min-mess': /^table-/, 'min-powder-store': /^(powder-keg-stack|barrel|crate)$/, 'min-seam': /^(crystal-|ore-vein|geode-cluster)/, 'min-pithead': null, 'min-smelter': /^(smelter|hearth-|bread-oven)/ });
// <<< type:min
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
    const id = k % 4 === 3 ? null : k % 2 ? ccmFirst(ctx, CULT_BRAZIER) : k % 4 === 2 && flavorHas(ctx, 'flavor-sculpture') ? 'flavor-sculpture' : ccmFirst(ctx, ['statue-hooded', 'pillar-square']); if (!id) continue; /* (blind reads, 2026-10-12: six fire bowls and two statues read as a forge: figures outnumber fires) */ // (every second pair of figures is the flavor's sculpture)
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
    if (cells >= 30 && Math.min(ctx.W, ctx.D) >= 13 && Math.max(ctx.W, ctx.D) >= rw + 7) for (const sg of two /* (blind reads, 2026-10-12: a rail of hoods alone in the middle of a small room read as a rack of maces, the room as an armoury: under 30 cells it stands at the wall) */ ? [-1, 1] : [1]) { const o = two ? 3.2 : 0, p = castlePut(ctx, 'robe-stand', [0, 1, -1, 2, -2].map(e => longNS ? [cx + sg * o, cz + e, Math.PI / 2] : [cx + e, cz + sg * o, 0]), { layer: 'anchor', rule: 'key-robes', why: 'the rail of robes: standing in the open, the room\'s purpose', extra: { focal: true } }); if (p) rails.push(p); }
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
  if (cells >= 12) ccmQuiet(ctx, () => ctx.wall('wardrobe', { sides: [far, ...lat], why: 'a wardrobe against the wall' }));
  if (flavorHas(ctx, 'flavor-banner')) ccmQuiet(ctx, () => ctx.mount('flavor-banner', { sides: lat, height: 5.8, why: 'the cult\'s banner over the robes: whose robes these are' }));
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
