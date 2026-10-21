// STAIRS: vertical connectors (docs/VERTICAL.md "Getting up and down"; Harry 2026-10-05: "best shot, explore together").
// A stair joins two rooms one above the other the way a door joins two side by side.
//
//   stair  an OBJECT of the LOWER room: { kind:'object', place:'stair', rise (ft), x, y, z, rot, dims:[w, rise, run], room }
//          y = the lower floor; its top tread is level with the floor at y + rise. rot is a quarter turn; at rot 0 it
//          climbs toward +z. Its footprint is whole 5-ft cells, worked out from dims and rot (never stored).
//   hole   DERIVED: the cells of the floor at y + rise that the stair comes up through (no floor tiles, no slab, no
//          furniture there). A stair that goes up to open ground cuts the ground.
//   ends   the foot landing (the cell before its low end, on the lower floor) and the top landing (the cell beyond its
//          high end, on the upper floor): where a pawn stands before and after.
//
// Pure data: the relay and the browser run the same code. `entities` is an area's entity map.
import { hasCell, cellsOf } from './footprint.js';
import { roomY, roomTop, roomHeight, buildingOf, baseOf, floorUnder, STEP, isStoneFamily } from './height.js';

const CELL = 5;
// the kinds of stair the generator places, each with the catalog ids that can draw it (first one in the library wins;
// none = the client's geometric stand-in) and its box: [width, (rise), run] in feet; cells: [across, along]
export const STAIR_KINDS = {
  straight: { cells: [1, 2], dims: [4.4, 10], ids: ['stair-straight', 'stair-exterior-wood'], name: 'stair' },
  half: { cells: [1, 1], dims: [4.4, 5], ids: ['stair-half', 'stair-straight'], name: 'half stair' },
  ladder: { cells: [1, 1], dims: [2.2, 1.6], ids: ['ladder-wood'], name: 'ladder' },
};
export const isStair = (e) => e?.kind === 'object' && e.place === 'stair';
// A STAIR THAT IS FURNITURE (2026-10-11; Harry: "The grand entrance double-stairs don't cut through to the higher
// floor"). Until then only a `place: 'stair'` object was a stair, and only the automatic planner makes those. Every
// other stair in the game is an ordinary thing of its room with a stair's catalog role: the mansion hall's grand stair
// and the cellar's and hallway's flights (rolled by the room's layout), and any stair, spiral or ladder put down from
// the library. They had no hole, no railing and no way up. Now the ROLE makes the connector: such a thing opens the
// floor it reaches exactly as a planned stair does, worked out from where it stands (never stored).
//   rise  how far it climbs, in feet, from the floor it stands on (never read off the box: a balustrade stands higher)
//   turn  it comes out at the top on the side it is entered from (a spiral of one full turn; a ladder against a wall)
//   focal the room is built round it (the grand stair): it is always the way up (see stairsOf)
// Its FRONT (local +z, the orientation step's rule) is its foot: a flight climbs toward local -z (measured on every
// piece: engine/test/browser_grandstair.py). `stair-landing` is a level block, not a way up, and is not listed.
export const STAIR_ROLES = {
  'stair-straight': { rise: 10 }, 'stair-exterior-wood': { rise: 10 }, 'stair-wall-hugging': { rise: 10 }, 'stair-grand': { rise: 10, focal: true },
  'stair-half': { rise: 5 }, 'stair-spiral-wide': { rise: 10, turn: true }, 'ladder-wood': { rise: 10, turn: true },
};
export const stairRole = (e) => (e?.kind === 'object' && e.place !== 'stair' && !e.parent && !e.flat && STAIR_ROLES[e.cat]) || null;
export const isConnector = (e) => isStair(e) || !!stairRole(e); // anything that joins two floors
const baseOf_ = (s) => stairRole(s) ? Math.round((s.y || 0) / CELL) * CELL : s.y || 0; // the floor it stands on
export const stairBase = baseOf_;
export const stairRise = (s) => { const R = stairRole(s); return R ? s.rise || R.rise : s.rise || 10; }; // (a piece may carry its own: a storey that is not 10 ft)
export const stairTop = (s) => baseOf_(s) + stairRise(s);
// PLACED OR FURNITURE (2026-10-11). A stair the room's own layout rolled (it carries the layout's `rule`: the mansion
// hall's grand stair, a cellar's flight) is furniture: re-rolled and hidden with its room. Every other stair was PUT
// there: from the library, by "Add stairs down", by the building generator, or by the planner of 2026-10-05 (those
// were `place: 'stair'` objects; core/migrate.js turns them into this kind). A placed stair stays through a re-roll
// and is hidden with EITHER room it joins. Both kinds open the floor, are railed, carry pawns and switch up / down.
export const isPlacedStair = (e) => isConnector(e) && !e.rule;
export const stairKind = (s) => s.stair || (/ladder/.test(s.cat || '') ? 'ladder' : stairRise(s) <= 5 ? 'half' : 'straight');
const quarter = (rot) => ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4;
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // which way it climbs, by quarter turn (three.js: +z turned about Y)
// which way it climbs: a planned stair toward its own +z, a catalog piece away from its front
export const stairDir = (s) => DIRS[(quarter(s.rot) + (stairRole(s) ? 2 : 0)) % 4];
const alongOf = (s) => Math.max(1, Math.round((s.dims?.[2] || 5) / CELL)), acrossOf = (s) => Math.max(1, Math.round((s.dims?.[0] || 5) / CELL));
// a catalog piece stands where it was put, not always on whole squares (the grand stair is centred on a wall): it takes
// every square it covers by more than SLIVER ft each way, so no part of it comes up through floor that was left in
const SLIVER = 1;
function span(s) { // -> [gx0, gz0, gx1, gz1] the squares a catalog piece covers
  const c = Math.abs(Math.cos(s.rot || 0)), n = Math.abs(Math.sin(s.rot || 0)), w = s.dims?.[0] || CELL, d = s.dims?.[2] || CELL, hx = (c * w + n * d) / 2, hz = (n * w + c * d) / 2;
  const lo = (v) => Math.floor((v + SLIVER) / CELL + 1e-9), hi = (v) => Math.ceil((v - SLIVER) / CELL - 1e-9) - 1;
  let gx0 = lo(s.x - hx), gx1 = hi(s.x + hx), gz0 = lo(s.z - hz), gz1 = hi(s.z + hz);
  if (gx1 < gx0) gx0 = gx1 = Math.floor(s.x / CELL + 1e-6);
  if (gz1 < gz0) gz0 = gz1 = Math.floor(s.z / CELL + 1e-6);
  return [gx0, gz0, gx1, gz1];
}
// the cells it stands on, as [gx, gz], low end first
export function stairCells(s) {
  const [dx, dz] = stairDir(s), out = [];
  if (stairRole(s)) {
    const [gx0, gz0, gx1, gz1] = span(s);
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) out.push([gx, gz]);
    return out.sort((p, q) => (p[0] * dx + p[1] * dz) - (q[0] * dx + q[1] * dz) || (p[0] * dz + p[1] * dx) - (q[0] * dz + q[1] * dx));
  }
  const n = alongOf(s), m = acrossOf(s);
  for (let k = 0; k < n; k++) for (let j = 0; j < m; j++) {
    const a = (k - (n - 1) / 2) * CELL, b = (j - (m - 1) / 2) * CELL;
    out.push([Math.floor((s.x + dx * a - dz * b) / CELL + 1e-6), Math.floor((s.z + dz * a + dx * b) / CELL + 1e-6)]);
  }
  return out;
}
const key = (gx, gz) => `${gx}:${gz}`;
const roomWithCell = (entities, y, gx, gz) => Object.values(entities || {}).find(e => e.kind === 'room' && roomY(e.recipe) === y && hasCell(e.recipe, gx, gz)) || null;
const centreOf = ([gx, gz], y) => ({ x: (gx + 0.5) * CELL, z: (gz + 0.5) * CELL, y });
// of several squares, the one nearest a point (where the pawn was dropped), else the middle one
const pick = (list, near) => near ? list.reduce((b, c) => Math.hypot((c[0] + 0.5) * CELL - near.x, (c[1] + 0.5) * CELL - near.z) < Math.hypot((b[0] + 0.5) * CELL - near.x, (b[1] + 0.5) * CELL - near.z) ? c : b) : list[Math.floor((list.length - 1) / 2)];
// where a pawn stands at each end: { foot: {x, z, y}, top: {x, z, y}, footCell, topCell, exits }
//   foot   the square before its low end, on the floor it stands on
//   top    the square it leads out onto, on the floor it reaches: straight on beyond its high end; where that is no
//          floor of the room it comes up into (the grand stair climbs to the hall's far wall), the squares BESIDE its
//          top row, on either hand. A piece that turns (a spiral, a ladder) comes out on the side it was entered from.
//   exits  every square of that way out ([gx, gz]): the railing leaves them open
//   floor  is there a room's floor at its top at all (with `entities`)
// `entities` lets it look at the floor above (without it: straight on); `near` {x, z} picks the nearer of several squares.
export function stairEnds(s, entities = null, near = null) {
  const [dx, dz] = stairDir(s), cells = stairCells(s), R = stairRole(s), top = stairTop(s), base = baseOf_(s);
  const along = (c) => c[0] * dx + c[1] * dz, lo = Math.min(...cells.map(along)), hi = Math.max(...cells.map(along));
  const lowRow = cells.filter(c => along(c) === lo), highRow = cells.filter(c => along(c) === hi);
  const footCells = lowRow.map(c => [c[0] - dx, c[1] - dz]), outRow = R?.turn ? lowRow : highRow, [ox, oz] = R?.turn ? [-dx, -dz] : [dx, dz];
  const ahead = outRow.map(c => [c[0] + ox, c[1] + oz]);
  const across = (c) => c[0] * -oz + c[1] * ox, a0 = Math.min(...outRow.map(across)), a1 = Math.max(...outRow.map(across));
  const beside = [outRow.find(c => across(c) === a0), outRow.find(c => across(c) === a1)].map((c, i) => [c[0] + (i ? 1 : -1) * -oz, c[1] + (i ? 1 : -1) * ox]);
  let exits = ahead;
  const U = entities && cells.map(c => roomWithCell(entities, top, ...c)).find(Boolean);
  if (U) {
    const holes = holesAt(entities, top), floor = (c) => hasCell(U.recipe, ...c) && !holes.has(key(...c));
    const A = ahead.filter(floor), B = beside.filter(floor);
    exits = A.length ? A : B.length ? B : ahead;
  }
  const footCell = pick(footCells, near), topCell = pick(exits, near);
  return { foot: centreOf(footCell, base), top: centreOf(topCell, top), footCell, topCell, exits, floor: !!U }; // floor: there is a room's floor at its top
}
// every stair of an area: the planned ones and the catalog pieces alike.
// ONE EXCEPTION, so that maps made before 2026-10-11 keep their floors: a flight or ladder that a room's LAYOUT put
// there as dressing (it carries the layout's `rule`: the cellar's "stair up, along a wall", a hallway's end flight)
// stays dressing while that room has a planned stair of its own going up. Every inn cellar has both; without this
// each would open a second hole under the common room's furniture. Delete the planned stair and the flight takes over.
// A piece put down by hand, and the grand stair, always count.
export function stairsOf(entities) {
  // (the planned stairs are ordinary PLACED stairs since the same day, core/migrate.js: "a planned stair of its own" reads
  // "a stair that was put there", by the planner then or by hand now)
  const all = Object.values(entities || {}).filter(isConnector), served = new Set(all.filter(s => !s.rule && s.room).map(s => s.room));
  return served.size ? all.filter(s => !s.rule || !(!STAIR_ROLES[s.cat]?.focal && served.has(s.room))) : all;
}
// the cells of the floor at height y that stairs come up through: Set of 'gx:gz'
export function holesAt(entities, y) {
  const out = new Set();
  for (const s of stairsOf(entities)) if (stairTop(s) === y) for (const [gx, gz] of stairCells(s)) out.add(key(gx, gz));
  return out;
}
// the two rooms a stair joins: { from, to } (room ids; to = null: it comes up onto open ground or a deck)
export function stairLinks(entities, s) {
  const cells = stairCells(s), E = stairEnds(s, entities);
  const from = (s.room && entities[s.room] ? entities[s.room] : roomWithCell(entities, baseOf_(s), ...cells[0]))?.id || null;
  const up = roomWithCell(entities, stairTop(s), ...E.topCell) || cells.map(c => roomWithCell(entities, stairTop(s), ...c)).find(Boolean) || null;
  return { from, to: up?.id || null };
}
// every stair that touches a room: the ones that stand in it, and the ones that come up through its floor
export function stairsTouching(entities, room) {
  const y = roomY(room.recipe), out = [];
  for (const s of stairsOf(entities)) {
    if (s.room === room.id) { out.push({ stair: s, as: 'lower' }); continue; }
    if (stairTop(s) === y && stairCells(s).some(([gx, gz]) => hasCell(room.recipe, gx, gz))) out.push({ stair: s, as: 'upper' });
  }
  return out;
}
// is this room already joined to a storey above or below it by a stair?
export const hasStair = (entities, room, as = null) => stairsTouching(entities, room).some(t => !as || t.as === as);

// THE RAILING ROUND A STAIR'S HOLE (Harry 2026-10-06: "I think we do need them, but just as a normal kind of furniture
// that gets placed by default"). Worked out from the stair, so it is there by default, follows the hole when the stair
// is moved or turned, and comes and goes with the stair (undo included). One 5-ft section on every open side of the
// hole in the floor the stair comes up through: an edge of a hole square whose other side is floor of the same room.
// Never on the side the stair's top tread leads out of (the top landing stays clear), never where a wall already
// stands (the room's edge), and none round a stair that comes up onto open ground.
// Each section has a KEY ('r' + the grid edge at that floor's height: 'rh:3:4@10'), so it is a thing of its own the way
// a wall piece is: an 'edge' override removes it, and editing it puts an ordinary object in its place.
// -> [{ key, x, z, y, rot, room, stair }]  (feet; rot 0 runs along x; room = the room whose floor has the hole)
export function stairRails(entities, s, holes = null) {
  const top = stairTop(s), cells = stairCells(s), way = new Set(stairEnds(s, entities).exits.map(c => key(...c)));
  const sfx = top ? `@${top}` : '', out = [];
  holes ||= holesAt(entities, top);
  for (const [gx, gz] of cells) {
    const U = roomWithCell(entities, top, gx, gz); if (!U) continue;
    for (const [ex, ez] of DIRS) {
      const nx = gx + ex, nz = gz + ez;
      if (holes.has(key(nx, nz)) || !hasCell(U.recipe, nx, nz)) continue;
      if (way.has(key(nx, nz))) continue; // the way out at the top (straight on, or on either hand of a stair that climbs to a wall)
      const k = (ex ? `rv:${ex > 0 ? gx + 1 : gx}:${gz}` : `rh:${gx}:${ez > 0 ? gz + 1 : gz}`) + sfx;
      out.push({ key: k, x: ex ? (ex > 0 ? gx + 1 : gx) * CELL : (gx + 0.5) * CELL, z: ez ? (ez > 0 ? gz + 1 : gz) * CELL : (gz + 0.5) * CELL, y: top, rot: ex ? Math.PI / 2 : 0, room: U.id, stair: s.id });
    }
  }
  return out;
}
// every railing section of an area's stairs (or only those in one room's floor)
export function railsOf(entities, roomId = null) {
  const out = [], byTop = new Map();
  for (const s of stairsOf(entities)) { const t = stairTop(s); if (!byTop.has(t)) byTop.set(t, holesAt(entities, t)); for (const r of stairRails(entities, s, byTop.get(t))) if (!roomId || r.room === roomId) out.push(r); }
  return out;
}

// THE GROUND A ROOM'S SOLVER MUST KEEP CLEAR for the stairs that touch it, as fixed placements the layout engine lays
// furniture around (the same door it uses for pinned things): the stair's own footprint and its landing, on the floor
// it stands on; the hole and the top landing, on the floor it comes up through. Heights are absolute (the solver's
// caller takes the room's own height off).
export function stairBlocks(entities, room) {
  const y = roomY(room.recipe), out = [];
  const block = (id, s, x, z, rot, dims) => ({ id, cat: s.place === 'stair' ? s.cat || 'stair-straight' : 'stair-straight', sku: s.place === 'stair' ? s.sku || null : null, flat: false, place: 'floor', layer: 'furnish', x, y, z, rot, dims, pinned: true, stairBlock: true });
  for (const { stair: s, as } of stairsTouching(entities, room)) {
    if (stairRole(s)) {
      // a catalog piece is the lower room's own furniture (its layout made it, or it was put there): nothing to add
      // below. Above: its hole, and each square of its way out.
      const cells = stairCells(s), xs = cells.map(c => c[0]), zs = cells.map(c => c[1]), x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, z0 = Math.min(...zs), z1 = Math.max(...zs) + 1;
      if (as !== 'upper') {
        // (2026-10-11) but a stair that was PUT there and is not pinned stays through a re-roll without being handed to
        // the layout as a pinned thing: its squares and its foot are kept clear here
        if (s.rule || s.pinned) continue;
        out.push(block(`${s.id}`, s, (x0 + x1) * CELL / 2, (z0 + z1) * CELL / 2, 0, [(x1 - x0) * CELL - 0.4, Math.min(8, stairRise(s)), (z1 - z0) * CELL - 0.4]));
        const f = stairEnds(s).footCell; if (f) out.push(block(`${s.id}:foot`, s, (f[0] + 0.5) * CELL, (f[1] + 0.5) * CELL, 0, [CELL - 0.4, 3, CELL - 0.4]));
        continue;
      }
      out.push(block(`${s.id}`, s, (x0 + x1) * CELL / 2, (z0 + z1) * CELL / 2, 0, [(x1 - x0) * CELL - 0.4, 3, (z1 - z0) * CELL - 0.4]));
      stairEnds(s, { ...entities, [room.id]: { ...entities[room.id], id: room.id, kind: 'room', recipe: room.recipe } }).exits.forEach((c, i) => out.push(block(`${s.id}:out${i}`, s, (c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL, 0, [CELL - 0.4, 3, CELL - 0.4])));
      continue;
    }
    const [dx, dz] = stairDir(s), n = alongOf(s), shift = (as === 'lower' ? -1 : 1) * CELL / 2; // one more cell at the landing's end
    out.push(block(`${s.id}`, s, s.x + dx * shift, s.z + dz * shift, s.rot || 0, [acrossOf(s) * CELL - 0.4, as === 'lower' ? Math.min(8, s.rise || 10) : 3, (n + 1) * CELL - 0.4]));
  }
  return out;
}

// which catalog piece draws a stair of this kind in a building of this wall family: { cat, sku, url } (url null = the
// client's stand-in: nothing is ever listed without its file). `lib` is the tuner's library.
export function stairPiece(lib, kind = 'straight', family = '') {
  const K = STAIR_KINDS[kind] || STAIR_KINDS.straight;
  for (const id of K.ids) {
    const o = lib?.objects?.[id]; if (!o) continue;
    const skus = o.skus.filter(k => k.bounds && k.url);
    const want = isStoneFamily(family) ? 'stone' : 'timber'; // (2026-10-06: a castle's and a crypt's walls are stone too)
    // the vertical kit's pieces made for a 10-ft storey come first (tier 'storey': stair-straight--*--t10, the upright
    // ladder); the older inn meshes of the same role neither climb 10 ft nor fit a 5-ft cell
    const made = skus.filter(k => k.tier === 'storey' || /--t10$/.test(k.sku)), pool = made.length ? made : skus;
    const sku = pool.find(k => k.sku.includes(want)) || pool.find(k => /--upright$/.test(k.sku)) || pool.find(k => !/--s\d+$/.test(k.sku)) || pool[0];
    if (sku) return { cat: id, sku: sku.sku, url: sku.url };
  }
  return { cat: K.ids[0], sku: null, url: null };
}

// PLACE ONE AUTOMATICALLY (Harry: "a new upper room with no connection below gets a stair placed automatically (with
// undo), the way doors are"). For a room above its building's base: a stair up into it from a room it stands on. For
// a room below the base: a stair from it up to the room above it, or up to open ground. A room that already has such a
// stair, or a ground-floor room, gets none.
//   doors   [{ x, z, y }] door positions in feet (so no stair lands in a doorway); optional
//   blocked (gx, gz, y) -> true for a cell that must stay free; optional
// Returns the stair's object args without id / cat / sku / url (the caller names the piece: stairPiece), plus
// { kind, from, to }, or null with planStair.why set when no spot is free.
// Since 2026-10-11 what it returns is an ORDINARY placed stair (a catalog piece; its front, local +z, is its foot), and
// the planner is no longer run for a room drawn by hand (stairOffer, below, decides whether to OFFER one).
//   kinds    which to try, in order (a ladder only where no flight fits)
//   pairOk   ({ lower, upper }) -> false to leave a pair of rooms out (the offer: only a plausible room to arrive in)
//   loose    ids of rooms whose furniture does not count (it is laid again round the stair by the caller)
//   strict   both landings must be free of furniture too, and a doorway is never beside it
export function planStair(entities, room, { doors = [], family = '', kinds = ['straight', 'ladder'], pairOk = null, loose = [], strict = false } = {}) {
  planStair.why = '';
  if (!room?.recipe) return null;
  const b = buildingOf(entities, room), base = baseOf(b), y = roomY(room.recipe), rooms = Object.values(entities).filter(e => e.kind === 'room' && e.id !== room.id);
  const shares = (o) => cellsOf(o.recipe).some(([i, j]) => hasCell(room.recipe, o.recipe.x + i, o.recipe.z + j));
  let pairs; // [{ lower, upper (null = open ground), rise }]
  if (y > base) {
    if (hasStair(entities, room, 'upper')) return null;
    pairs = rooms.filter(o => roomTop(entities, o) === y && shares(o)).sort((p, q) => p.order - q.order).map(o => ({ lower: o, upper: room, rise: roomHeight(entities, o) }));
    if (!pairs.length) { planStair.why = 'no room directly below to come up from'; return null; }
  } else if (y < base) {
    if (hasStair(entities, room, 'lower')) return null;
    const top = roomTop(entities, room), rise = roomHeight(entities, room), ups = rooms.filter(o => roomY(o.recipe) === top && shares(o)).sort((p, q) => p.order - q.order);
    pairs = ups.map(o => ({ lower: room, upper: o, rise }));
    if (top === base) pairs.push({ lower: room, upper: null, rise }); // or straight up onto the ground beside the building
    if (!pairs.length) { planStair.why = 'nothing above to come out into'; return null; }
  } else return null;
  if (pairOk) { pairs = pairs.filter(pairOk); if (!pairs.length) { planStair.why = 'no hallway or common room to line it up with'; return null; } }
  if (pairs[0].rise % STEP) { planStair.why = 'the storey height is not a multiple of 5 ft'; return null; }

  const boxes = (rid, yy) => loose.includes(rid) ? [] : Object.values(entities).filter(e => e.kind === 'object' && e.room === rid && !e.parent && e.place !== 'tile' && e.place !== 'ceiling' && !isConnector(e) && !(e.flat && e.place === 'floor') && (e.y || 0) - yy < (e.place === 'wall' ? 2.5 : 6.5)).map(e => { // (a thing hung on the wall above head height is not in the way of the foot of a stair)
    const c = Math.abs(Math.cos(e.rot || 0)), s = Math.abs(Math.sin(e.rot || 0)), hw = (c * e.dims[0] + s * e.dims[2]) / 2, hd = (s * e.dims[0] + c * e.dims[2]) / 2;
    return [e.x - hw, e.z - hd, e.x + hw, e.z + hd];
  });
  // how much of a square furniture stands on, in square feet (of 25). A square counts as free when that is no more than
  // SLIVER: the edge of a chair or a table poking over the line is not "furniture on the spot" (measured on furnished
  // inns: asking for nothing at all leaves 1 to 4 free squares in a 30 x 20 ft room, and hardly ever two in a row)
  const SLIVER = 2.5;
  const area = (bs, gx, gz) => bs.reduce((sum, [x0, z0, x1, z1]) => sum + Math.max(0, Math.min(x1, (gx + 1) * CELL) - Math.max(x0, gx * CELL)) * Math.max(0, Math.min(z1, (gz + 1) * CELL) - Math.max(z0, gz * CELL)), 0);
  const centred = (bs, gx, gz) => bs.some(([x0, z0, x1, z1]) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; return cx > gx * CELL && cx < (gx + 1) * CELL && cz > gz * CELL && cz < (gz + 1) * CELL; }); // a small thing wholly in the square is on the spot
  const hits = (bs, gx, gz) => area(bs, gx, gz) > SLIVER || centred(bs, gx, gz) ? 1 : 0;
  const nearDoor = (gx, gz, yy) => doors.some(d => (d.y || 0) === yy && Math.abs(d.x - (gx + 0.5) * CELL) < 3.2 && Math.abs(d.z - (gz + 0.5) * CELL) < 3.2);
  let best = null;
  for (const kind of kinds) {
    const K = STAIR_KINDS[kind];
    for (const { lower, upper, rise } of pairs) {
      const ly = roomY(lower.recipe), uy = ly + rise, lowBoxes = boxes(lower.id, ly), upBoxes = upper ? boxes(upper.id, uy) : [];
      const taken = new Set([...holesAt(entities, ly), ...holesAt(entities, uy)]); // other stairs' holes, on either floor
      for (const s of stairsOf(entities)) if (baseOf_(s) === ly || baseOf_(s) === uy) for (const [gx, gz] of stairCells(s)) taken.add(key(gx, gz));
      const inUpper = (gx, gz) => upper ? hasCell(upper.recipe, gx, gz) : !roomWithCell(entities, uy, gx, gz);
      for (const [i, j] of cellsOf(lower.recipe)) for (let q = 0; q < 4; q++) {
        const gx0 = lower.recipe.x + i, gz0 = lower.recipe.z + j, [dx, dz] = DIRS[q], n = K.cells[1];
        const cells = Array.from({ length: n }, (_, k) => [gx0 + dx * k, gz0 + dz * k]), foot = [gx0 - dx, gz0 - dz], beyond = [gx0 + dx * n, gz0 + dz * n], top = kind === 'ladder' ? foot : beyond; // (a ladder is left at the top on the side it was climbed from)
        if (!cells.every(([gx, gz]) => hasCell(lower.recipe, gx, gz) && inUpper(gx, gz) && !taken.has(key(gx, gz)))) continue;
        if (!hasCell(lower.recipe, ...foot) || !inUpper(...top) || taken.has(key(...foot)) || taken.has(key(...top))) continue;
        if (cells.some(c => nearDoor(...c, ly) || nearDoor(...c, uy)) || nearDoor(...foot, ly) || nearDoor(...top, uy)) continue;
        if (cells.some(c => hits(lowBoxes, ...c) || hits(upBoxes, ...c))) continue; // it removes nothing: a spot with furniture on it is not a spot
        // against a wall (a long side on the lower room's edge), its back to a wall, landings free of furniture
        const side = [[-dz, dx], [dz, -dx]].map(([sx, sz]) => cells.every(([gx, gz]) => !hasCell(lower.recipe, gx + sx, gz + sz))).filter(Boolean).length;
        const back = !hasCell(lower.recipe, ...beyond) ? 1 : 0;
        if (strict && (hits(lowBoxes, ...foot) || hits(upBoxes, ...top))) continue;
        const score = side * 4 + back * 2 - hits(lowBoxes, ...foot) * 3 - hits(upBoxes, ...top) * 3 + (upper ? 1 : 0) - cells.reduce((t, c) => t + area(lowBoxes, ...c) + area(upBoxes, ...c), 0) * 0.5;
        if (!best || score > best.score) best = { score, kind, lower, upper, rise, cells, q };
      }
    }
    if (best) break; // a ladder only where no flight fits
  }
  if (!best) { planStair.why = 'no free spot for a stair (furniture or doors in the way everywhere): place one by hand'; return null; }
  const K = STAIR_KINDS[best.kind], n = K.cells[1], [c0, c1] = [best.cells[0], best.cells[n - 1]], [dx, dz] = DIRS[best.q], lean = best.kind === 'ladder' ? 1.9 : 0; // a ladder stands at the far side of its square
  // `down`: it was put in for the room ABOVE (an upper room's way down), so it goes when that room is deleted; a cellar's
  // stair up belongs to the cellar
  const down = roomY(room.recipe) > base;
  return { kind: best.kind, from: best.lower.id, to: best.upper?.id || null, cells: best.cells,
    args: { name: K.name, layer: 'furnish', ...(best.rise !== 10 && { rise: best.rise }), ...(down && { down: true }), x: (c0[0] + c1[0] + 1) * CELL / 2 + dx * lean, y: roomY(best.lower.recipe), z: (c0[1] + c1[1] + 1) * CELL / 2 + dz * lean,
      rot: ((best.q + 2) % 4) * Math.PI / 2, room: best.lower.id, ...(best.lower.hidden || best.upper?.hidden ? { hidden: true } : {}) } };
}
// the rest of a planned stair's object args: the catalog piece for this kind and wall family, at its own size.
// `sizeOf(cat, sku)` is roomgen's ({ sku, url, place, s, yaw, dims }); without it, or for a kind the library has no
// piece for, a plain box the client draws as a stand-in.
export function stairPieceArgs(lib, sizeOf, kind = 'straight', family = '', rise = 10) {
  const K = STAIR_KINDS[kind] || STAIR_KINDS.straight, P = stairPiece(lib, kind, family), Z = P.url && sizeOf ? sizeOf(P.cat, P.sku) : null;
  if (!Z) return { cat: K.ids[0], place: 'kit', dims: [K.dims[0], rise, kind === 'ladder' ? K.dims[1] : K.cells[1] * CELL] };
  const f = rise / (STAIR_ROLES[P.cat]?.rise || 10); // a taller storey: the piece is stretched up, never the run
  return { cat: P.cat, sku: Z.sku, url: Z.url, place: Z.place || 'kit', yaw: Z.yaw || 0, ...(Z.s && { s: [Z.s[0], Z.s[1] * f, Z.s[2]] }), dims: [Z.dims[0], Z.dims[1] * f, Z.dims[2]] };
}

// DOES IT WORK WHERE IT STANDS? (2026-10-11: "a stair that cannot work where it is should still be placeable but say so
// visibly rather than silently being decoration"). Worked out, never stored. -> { code: null | <code>, why }
//   open           nothing is built over it yet: it stands there, and opens the floor the day a room is built above
//   nothing-below  no floor under it (a "stairs down" with no storey below; a stair left in the air)
//   wall-below     a wall of the storey it stands on runs through it
//   foot           nowhere to step on at its foot (a wall, or the edge of the floor)
//   wall-above     it comes up through a wall, or half outside the room above
//   no-exit        it comes up against a wall with no floor to step off onto
const DEAD = new Set(['open', 'nothing-below', 'no-exit']); // a pawn does not cross these
export function stairStatus(entities, s) {
  const base = baseOf_(s), top = stairTop(s), cells = stairCells(s), ground = (y, r) => r ? r.id : y === 0 ? 'ground' : null;
  const low = cells.map(c => ground(base, roomWithCell(entities, base, ...c))), up = cells.map(c => roomWithCell(entities, top, ...c));
  if (low.every(v => !v)) return { code: 'nothing-below', why: base < 0 ? 'nothing is built below: it leads down into the earth' : 'it stands on no floor' };
  if (new Set(low).size > 1) return { code: 'wall-below', why: 'a wall runs through it where it stands' };
  const E = stairEnds(s, entities), holes = holesAt(entities, top);
  const footOk = E.footCell && ground(base, roomWithCell(entities, base, ...E.footCell)) === low[0];
  if (up.every(v => !v)) {
    if (top === 0) return footOk ? { code: null, why: '' } : { code: 'foot', why: 'there is no floor to step on at its foot' }; // it comes up onto open ground
    return { code: 'open', why: 'no floor is built over it yet: it will open the floor above when there is one' };
  }
  if (up.some(v => !v) || new Set(up.map(r => r.id)).size > 1) return { code: 'wall-above', why: 'it comes up through a wall of the floor above' };
  if (!E.exits.some(c => hasCell(up[0].recipe, ...c) && !holes.has(key(...c)))) return { code: 'no-exit', why: 'it comes up against a wall: there is no floor to step off onto' };
  if (!footOk) return { code: 'foot', why: 'there is no floor to step on at its foot' };
  return { code: null, why: '' };
}

// UP OR DOWN (Harry 2026-10-11: "a context menu that lets you switch them to 'stairs down' instead of 'stairs up'").
// A stair put down on a level goes UP from it. Switched to DOWN it keeps its place in plan and its turn, and its body
// moves down one flight: its top is now level with the floor it was put on (the hole is in THAT floor) and it stands
// on the storey below. So the same physical stair is "up" from the floor at its foot and "down" from the floor at its
// top; `down: true` records which of the two it was put in for (its home level: the one it is deleted with, the one
// the switch is counted from). The hole is never stored: it is always the floor at the stair's top.
//   stairHome(s)             the height of its home level
//   stairSide(s, level)      'up' | 'down': how it reads from `level` (a level that is neither end: from its home)
//   stairFlip(s, level)      -> { y, down } the same piece leading the OTHER way from `level` (stair.flip's arguments)
export const stairHome = (s) => s.down ? stairTop(s) : baseOf_(s);
export const stairSide = (s, level = null) => (level != null && Math.abs(level - stairTop(s)) < 0.5) || (!(level != null && Math.abs(level - baseOf_(s)) < 0.5) && s.down) ? 'down' : 'up';
export function stairFlip(s, level = null) {
  const here = stairSide(s, level) === 'down' ? stairTop(s) : baseOf_(s), rise = stairRise(s), lift = (s.y || 0) - baseOf_(s);
  return stairSide(s, level) === 'down' ? { y: here + lift, down: false } : { y: here - rise + lift, down: true };
}
// the room a stair standing at height y belongs to: the one under its low end
export const stairRoomAt = (entities, s, y) => { const t = { ...s, y }; return stairCells(t).map(c => roomWithCell(entities, baseOf_(t), ...c)).find(Boolean)?.id || null; };

// OFFER ONE, DO NOT SCATTER THEM (Harry 2026-10-11: "let's not default to dropping stairs everywhere … maybe we should
// generally let players place their own stairs unless it looks like we can line one up from a plausible target to a
// plausible target below"). A room drawn by hand gets NO stair. This says whether one would line up: a straight flight
// (never a ladder), between the new room and a HALLWAY OR COMMON-TYPE room, standing on a free run of floor with free
// floor at both landings and no doorway beside it. The new room's own furniture does not count: taking the offer lays
// that room again round the stair (same seed). -> planStair's result (+ label), or null.
export const STAIR_TARGETS = /^(hallway|common|great-hall|mansion-hall|gatehouse|crypt-antechamber|chapel|crypt-chapel)$/;
export function stairOffer(entities, room, { doors = [] } = {}) {
  const P = planStair(entities, room, { doors, kinds: ['straight'], strict: true, loose: [room.id], pairOk: ({ lower, upper }) => { const other = lower.id === room.id ? upper : lower; return !!other && STAIR_TARGETS.test(other.recipe.type || ''); } });
  return P && { ...P, label: P.args.down ? 'Add stairs down' : 'Add stairs up' };
}

// A STAIR CORE THROUGH SEVERAL STOREYS (for the building generator). One flight per storey, as a switchback: the
// flights take turns on two lanes side by side, each climbing the opposite way to the one under it, so every flight's
// hole is over its own lane only and you step sideways from the top of one to the foot of the next.
//   at     { gx, gz, q }: the square at the low end of the FIRST flight, and the quarter turn it climbs toward
//          (0 +z, 1 +x, 2 -z, 3 -x). The second lane is on its left (q + 1), unless side: -1.
//   levels the floor heights it joins, lowest first ([0, 10, 20]): one flight per gap
//   kind   'straight' (two squares per flight; the core is 2 x 2 squares plus a landing square at each end of each
//          lane) or 'ladder' (one square; ladders stand over one another and take turns on two squares)
// -> { stairs: [object args without id and piece: name, layer, x, y, z, rot, rise, pinned], keep: [{ y, cells }] }
//    keep = the squares of each floor the generator must leave free of walls and furniture (the flight standing on
//    that floor with its foot landing, the hole of the flight below with its top landing).
// It checks nothing: the generator owns the plan. roomgen.stairCore adds the pieces; app.placeStairCore sends them as
// one command. stairStatus tells afterwards whether each flight works.
export function stairCore({ at, levels, kind = 'straight', side = 1 }) {
  const K = STAIR_KINDS[kind] || STAIR_KINDS.straight, n = K.cells[1], [dx, dz] = DIRS[((at.q % 4) + 4) % 4], [sx, sz] = [dz * side, -dx * side].map(v => v || 0);
  const stairs = [], keep = new Map(), add = (y, c) => { if (!keep.has(y)) keep.set(y, new Map()); keep.get(y).set(key(...c), c); };
  for (let i = 0; i + 1 < levels.length; i++) {
    const y = levels[i], rise = levels[i + 1] - y, odd = i % 2, lane = [at.gx + (odd ? sx : 0), at.gz + (odd ? sz : 0)];
    // an odd flight starts at the far end of the second lane and climbs back (a ladder is left at the top on the side it
    // was climbed from, so ladders all face the same way: the next one's foot is beside the last one's top)
    const rev = odd && kind !== 'ladder', [fx, fz] = rev ? [-dx, -dz] : [dx, dz], c0 = rev ? [lane[0] + dx * (n - 1), lane[1] + dz * (n - 1)] : lane, q = ((at.q + (rev ? 2 : 0)) % 4 + 4) % 4;
    const cells = Array.from({ length: n }, (_, k) => [c0[0] + fx * k, c0[1] + fz * k]), foot = [c0[0] - fx, c0[1] - fz], beyond = [c0[0] + fx * n, c0[1] + fz * n], top = kind === 'ladder' ? foot : beyond, c1 = cells[n - 1], lean = kind === 'ladder' ? 1.9 : 0;
    stairs.push({ name: K.name, layer: 'furnish', pinned: true, ...(rise !== 10 && { rise }), x: (c0[0] + c1[0] + 1) * CELL / 2 + fx * lean, y, z: (c0[1] + c1[1] + 1) * CELL / 2 + fz * lean, rot: ((q + 2) % 4) * Math.PI / 2, kind, rise_: rise });
    for (const c of [...cells, foot]) add(y, c);
    for (const c of [...cells, top]) add(levels[i + 1], c);
  }
  return { stairs: stairs.map(({ rise_, ...a }) => ({ ...a, rise: rise_ })), keep: [...keep].map(([y, m]) => ({ y, cells: [...m.values()] })) };
}

// AN OLD STAIR BECOMES AN ORDINARY ONE (core/migrate.js migrateStairs). Until 2026-10-11 the planner's stairs were
// `place: 'stair'` objects with their own box [width, rise, run], climbing toward their +z. The same stair as a catalog
// piece: its front is its foot (so the turn is the other way round), the library's size for its sku, `rise` kept only
// when it is not the piece's own, and `down` when it was put in for the room above. Same squares, same hole, same ends.
// `pieceOf(kind, sku, rise)` -> the piece's object args (stairPieceArgs with a named sku); null = keep its own box.
export function migrateStair(e, pieceOf = null) {
  if (!isStair(e)) return e;
  const kind = stairKind(e), rise = e.rise || 10, [dx, dz] = DIRS[quarter(e.rot)], { stair, rise: _r, ...rest } = e;
  const P = (pieceOf && pieceOf(kind, e.sku || null, rise)) || { cat: e.cat || STAIR_KINDS[kind]?.ids[0] || 'stair-straight', place: 'kit', dims: e.dims };
  const lean = kind === 'ladder' ? 1.9 : 0; // (the old ladder was drawn leaning at the far side of its square; now it stands there)
  return { ...rest, ...P, sku: P.sku ?? e.sku ?? null, url: P.url ?? e.url ?? null, yaw: P.yaw || 0, s: P.s || null, x: e.x + dx * lean, z: e.z + dz * lean, rot: ((quarter(e.rot) + 2) % 4) * Math.PI / 2,
    ...(rise !== (STAIR_ROLES[P.cat]?.rise || 10) && { rise }), ...((e.y || 0) >= 0 && { down: true }) };
}

// A PAWN DROPPED ON A STAIR GOES TO ITS OTHER END: from the lower floor (anywhere on the stair's cells or its foot
// landing... no: its cells) to the top landing; from the upper floor (dropped on the hole) to the foot landing.
// (x, z): where it was dropped; y: the height of the floor it was dropped on. -> { x, z, y, stair } or null
export function stairHop(entities, x, z, y = 0) {
  const gx = Math.floor(x / CELL + 1e-6), gz = Math.floor(z / CELL + 1e-6), near = { x, z };
  for (const s of stairsOf(entities)) {
    if (!stairCells(s).some(c => c[0] === gx && c[1] === gz)) continue;
    if (DEAD.has(stairStatus(entities, s).code)) continue; // no floor at one of its ends: it leads nowhere yet, the pawn just stands there
    if (Math.abs(baseOf_(s) - y) < 0.5 && onPiece(s, x, z)) {
      const E = stairEnds(s, entities, near);
      if (stairRole(s) && !E.floor && stairTop(s) !== 0) continue; // a catalog stair under no floor (a one-storey hall) leads nowhere: the pawn stays where it was put
      return { ...E.top, stair: s.id };
    }
    if (Math.abs(stairTop(s) - y) < 0.5) return { ...stairEnds(s, entities, near).foot, stair: s.id };
  }
  return null;
}
// from below, a catalog piece is climbed where it really stands (its box), not on the whole of every square it touches:
// the floor beside a stair that is narrower than its squares is just floor
function onPiece(s, x, z) {
  if (!stairRole(s) || stairKind(s) === 'ladder') return true; // (a ladder has its whole square: it is a hand's breadth deep)
  const c = Math.cos(s.rot || 0), n = Math.sin(s.rot || 0), ux = x - s.x, uz = z - s.z, lx = ux * c - uz * n, lz = ux * n + uz * c;
  return Math.abs(lx) <= (s.dims?.[0] || CELL) / 2 + 0.25 && Math.abs(lz) <= (s.dims?.[2] || CELL) / 2 + 0.25;
}
// what a seat is told about a stair (feet): where it is, what it joins, where each end is
export function stairInfo(entities, s) {
  const L = stairLinks(entities, s), E = stairEnds(s, entities), cells = stairCells(s);
  const fl = (yy, p) => floorUnder(entities, p.x, p.z, yy);
  const Q = stairStatus(entities, s);
  return { id: s.id, kind: stairKind(s), ...(stairRole(s) && { piece: s.cat }), ...(s.down && { down: true }), works: !Q.code, ...(Q.code && { problem: Q.code, why: Q.why }), rise: stairTop(s) - baseOf_(s), from: L.from, to: L.to, fromLevel: fl(baseOf_(s), s)?.level || null, toLevel: fl(stairTop(s), E.top)?.level || null,
    cells: cells.map(([gx, gz]) => [gx * CELL, gz * CELL]), bottom: [E.foot.x, E.foot.z, E.foot.y], top: [E.top.x, E.top.z, E.top.y],
    railing: stairRails(entities, s).filter(r => entities['edge_' + r.key.replace(/:/g, 'z').replace(/-/g, 'm').replace('@', 'a')]?.as !== 'open').map(r => ({ key: r.key, x: r.x, z: r.z })) }; // the sections round its hole upstairs (edge.set key=KEY as=open removes one)
}
