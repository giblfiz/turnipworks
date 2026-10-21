// HEIGHT: the one rule file (docs/VERTICAL.md, Harry 2026-10-05). All heights are in FEET.
//
//   room.recipe.y      the room's floor height (integer, a multiple of 5; absent = 0; negative = below ground)
//   room.recipe.tall   how many storeys the room spans (integer >= 1; absent = 1). A tall room is ONE room.
//   building.base      where the building meets the ground (absent = 0)
//   building.storey    floor to floor (absent = 10: a 9-ft wall and a 1-ft slab)
//   object.y, token.y  the thing's ABSOLUTE height (a thing standing on the floor of a room at y = 10 has y = 10)
//
// NOTHING STORES A "FLOOR" FOR A PAWN, an object or a room. Which storey something is on is always worked out here,
// from its height (Foundry stores both, and its worst bugs come from the two disagreeing).
//
// Pure data, no three.js, no DOM: the relay and the browser run the same code. `entities` is an area's entity map.
import { contains, overlap as footprintsOverlap, hasCell, cellsOf } from './footprint.js';

export const STOREY = 10, SLAB = 1, STEP = 5, MAX_Y = 200, MAX_TALL = 6;

export const roomY = (rc) => rc?.y || 0;
export const buildingOf = (entities, room) => (room?.building && entities?.[room.building]) || null;
export const baseOf = (b) => b?.base || 0;
export const storeyHeightOf = (b) => b?.storey || STOREY;
// a room's height floor to floor-above, its top (where the next storey's floor is) and its ceiling (the underside of
// the slab above: THE NUMBER A CUT IS SET TO, so "base at or below the cut" hides the room above and shows this one)
export const roomHeight = (entities, room) => (room.recipe.tall || 1) * storeyHeightOf(buildingOf(entities, room));
export const roomTop = (entities, room) => roomY(room.recipe) + roomHeight(entities, room);
export const ceilingOf = (entities, room) => roomTop(entities, room) - SLAB;
// the storey a height is on in a building: 0 = the building's ground floor, 1 = the one above, -1 = the first below
export const storeyAt = (b, y) => Math.floor(((y || 0) - baseOf(b)) / storeyHeightOf(b) + 1e-9);
export const storeyOf = (entities, room) => storeyAt(buildingOf(entities, room), roomY(room.recipe));
// what people are shown: "lv 1" for storey 0, "lv 2" for 1, "lv -1" for -1 (there is no lv 0)
export const levelLabel = (storey) => `lv ${storey >= 0 ? storey + 1 : storey}`;
// the cut rule (Harry: something that spans the cut is shown whole if its BASE is at or below the cut)
export const visibleAt = (baseY, cut) => cut == null || (baseY || 0) <= cut;

// do two height spans [y, top) share any height?
export const spansOverlap = (aY, aTop, bY, bTop) => aY < bTop && bY < aTop;
const span = (entities, room) => [roomY(room.recipe), roomTop(entities, room)];
// the height span a room about to be made (or moved) would take: args { y?, tall?, building? }
export function spanOfArgs(entities, a) {
  const y = a.y || 0;
  return [y, y + (a.tall || 1) * storeyHeightOf(a.building ? entities?.[a.building] : null)];
}
// the room that a footprint at a height span would collide with (footprints share a cell AND heights overlap), or null
export function roomClash(entities, rect, [y, top], exceptId = null) {
  for (const e of Object.values(entities)) {
    if (e.kind !== 'room' || e.id === exceptId) continue;
    const [ey, et] = span(entities, e);
    if (spansOverlap(y, top, ey, et) && footprintsOverlap(e.recipe, rect)) return e;
  }
  return null;
}

// THE FLOOR UNDER A POINT: the room whose floor a thing at (x, z, y) stands over: the highest room floor at or below
// y (half a foot of slack) whose footprint holds the point. null = open ground at height 0 (or nothing below).
//   -> { room, y, storey, level, building }
export function floorUnder(entities, x, z, y = 0) {
  let best = null;
  for (const e of Object.values(entities || {})) {
    if (e.kind !== 'room') continue;
    const ry = roomY(e.recipe);
    if (ry > (y || 0) + 0.5 || (best && ry <= roomY(best.recipe))) continue;
    if (contains(e.recipe, x, z)) best = e;
  }
  if (!best) return null;
  const storey = storeyOf(entities, best);
  return { room: best.id, y: roomY(best.recipe), storey, level: levelLabel(storey), building: best.building || null };
}
// where a pawn (or any thing with x, z, y) is: DERIVED, never stored.  -> { y, room, storey, level, building }
export function tokenFloor(entities, t) {
  const f = floorUnder(entities, t.x, t.z, t.y || 0);
  // inside a room's height? (a flyer far above a roof is over the building, not on a storey of it)
  if (f && (t.y || 0) < roomTop(entities, entities[f.room])) return { ...f, floorY: f.y, y: t.y || 0 };
  const storey = storeyAt(null, t.y || 0);
  return { y: t.y || 0, room: null, storey, level: levelLabel(storey), building: null, floorY: null };
}

// WHERE A PAWN'S BASE RESTS (Harry 2026-10-13: "raise & lower a pawn should leave its base on the ground ... The base
// should 'fall' to the highest ground it's above and decide what height cutoff hides the pawn"). A pawn's `y` is where
// its FIGURE is; its base is DERIVED, never stored: the highest GROUND at or below the figure in the pawn's square:
//   the floor of a room the figure is in or over (half a foot of slack, as floorUnder)
//   the TOP of a room the figure is above (its roof or deck: where the next storey's floor would be), unless that room
//     is open to the sky (`isOpen(room)`: a yard, a room whose roof is off): then its floor
//   else the open ground at 0 (or the figure's own height, below ground with no room there)
// This is the same answer tokenFloor gives for "which room is it in" (a pawn whose base is on a room's top is not IN
// that room). THE CUT ASKS THIS LEVEL, not the figure's height (visibleAt(baseUnder(...).y, cut)).
//   -> { y, room, on: 'floor' | 'top' | 'ground' }
// THE LOWEST FLOOR AT (x, z) (2026-10-20): a pawn is never put below it. The ground (0) unless a room there sits lower
// (a cellar), then that room's floor. Harry's Ring lab pawns had been lowered to -12 and -20 over a -10 cellar, out of
// sight and out of reach.
export function lowestFloorAt(entities, x, z) {
  let low = 0;
  for (const e of Object.values(entities || {})) if (e.kind === 'room' && e.recipe && contains(e.recipe, x, z)) low = Math.min(low, roomY(e.recipe));
  return low;
}
export function baseUnder(entities, x, z, y = 0, isOpen = null) {
  let best = null; y = y || 0;
  for (const e of Object.values(entities || {})) {
    if (e.kind !== 'room' || !e.recipe) continue;
    const ry = roomY(e.recipe); if (ry > y + 0.5) continue;
    const top = roomTop(entities, e), onTop = y >= top && !(isOpen && isOpen(e)), by = onTop ? top : ry;
    if (best && (by < best.y || (by === best.y && (onTop || best.on === 'floor')))) continue; // (a tie: the upper room's floor, not the lower room's top)
    if (contains(e.recipe, x, z)) best = { y: by, room: e.id, on: onTop ? 'top' : 'floor' };
  }
  return best || { y: Math.min(0, y), room: null, on: 'ground' };
}

// AN UPPER ROOM MUST STAND ON SOMETHING: every one of its cells within `reach` cells (two: a jetty, or posts) of a cell
// of a room whose top is its floor height. Returns null when supported, else a reason.
// the test both the core and the room tool use: (gx, gz) -> is this square within `reach` of a square of a room whose
// top is y? `any` = is there such a room at all. (The room tool lights exactly the squares this accepts.)
export function supportAt(entities, y, reach = 2) {
  const below = Object.values(entities || {}).filter(e => e.kind === 'room' && roomTop(entities, e) === y).map(e => e.recipe);
  const on = (gx, gz) => below.some(b => hasCell(b, gx, gz));
  // how far out a square is: 0 = over a room below, 1 = one square out (a jetty), 2 = two out (posts), Infinity = too far
  const out = (gx, gz) => { if (on(gx, gz)) return 0; let best = Infinity; for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) if (on(gx + dx, gz + dz)) best = Math.min(best, Math.max(Math.abs(dx), Math.abs(dz))); return best; };
  return { any: below.length > 0, on, out, ok: (gx, gz) => out(gx, gz) <= reach };
}
// STONE OR TIMBER (2026-10-06): the one test for "is this wall family masonry", used for what holds an overhang up,
// which stair is placed and which railing goes round a stair's hole. A castle's rough walls and a crypt are stone though
// 'castle-rough' has no "stone" in its name.
// THE FLOOR SLAB'S PLAN (2026-10-14, Wall fit bench): the boxes, in feet from the corner of the room's bounding rectangle, of the
// 1-ft slab under an upper room. The wall above stands on the grid line with half its 12 in on each side, so along the room's
// outer edge the slab runs SLAB_RIM (6 in) past the grid line to meet the wall's outer face; the slab used to end on the line
// and every upper wall overhung it by 6 in. A side that meets another cell of the room (or a stair's hole) stays on its line.
// cells = the room's [i, j] (null = the whole w x d rectangle); open(i, j) = a cell with no floor (a stair's hole).
export const SLAB_RIM = 0.5;
export function slabRects(w, d, cells, open = null, cell = 5) {
  const R = SLAB_RIM, set = cells ? new Set(cells.map(([i, j]) => `${i}:${j}`)) : null;
  const has = (i, j) => set ? set.has(`${i}:${j}`) : i >= 0 && j >= 0 && i < w && j < d;
  const list = cells || Array.from({ length: w * d }, (_, k) => [k % w, Math.floor(k / w)]);
  if (!cells && !(open && list.some(([i, j]) => open(i, j)))) return [[-R, -R, w * cell + R, d * cell + R]];
  return list.filter(([i, j]) => !(open && open(i, j))).map(([i, j]) => [i * cell - (has(i - 1, j) ? 0 : R), j * cell - (has(i, j - 1) ? 0 : R), (i + 1) * cell + (has(i + 1, j) ? 0 : R), (j + 1) * cell + (has(i, j + 1) ? 0 : R)]);
}
export const isStoneFamily = (family) => /stone|castle|crypt/.test(family || '');

// WHAT HOLDS AN OVERHANG UP (Harry 2026-10-05: "one square out is a jetty that gets brackets underneath automatically;
// two squares out gets posts or flying buttresses filled in automatically"). Worked out from the rooms, like walls;
// never stored. Each piece has a KEY, so it is a thing of its own like a wall piece or a corner post (Harry
// 2026-10-06: "I don't seem to be able to select them as first-class objects"): an 'edge' override on that key removes
// it, and editing it puts an ordinary object in its place (core/commands.js edge.set).
//   bracket  under a square ONE out, against the wall below, one per 5 ft. Key 'j' + the wall edge it leans on at the
//            upper room's height: 'jv:6:2@10'.
//   post     under a square TWO out: from the ground (or the roof below) to the slab, at the overhang's outer corners
//            and every 10 ft along its outer edge. Key 'p<gx>:<gz>@<y>': the grid vertex, at the upper room's height.
// -> { brackets: [{ key, gx, gz, dx, dz }], posts: [{ key, vx, vz, y0, dirs: [[dx, dz]...] }] }  (cells and vertices;
// (dx, dz) points OUT from the wall; a post's dirs run along the overhang's outer edge from it: where its braces go)
export function supportPlan(entities, room) {
  const out = { brackets: [], posts: [] }, rc = room?.recipe, y = roomY(rc);
  if (!rc || y <= 0) return out;
  const S = supportAt(entities, y); if (!S.any) return out;
  const cells = cellsOf(rc).map(([i, j]) => [rc.x + i, rc.z + j]), mine = new Set(cells.map(c => c.join(':'))), has = (gx, gz) => mine.has(`${gx}:${gz}`);
  const sfx = `@${y}`, posts = new Map();
  for (const [gx, gz] of cells) {
    const o = S.out(gx, gz);
    if (o === 1) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!S.on(gx - dx, gz - dz)) continue;
      const key = (dx ? `jv:${dx > 0 ? gx : gx + 1}:${gz}` : `jh:${gx}:${dz > 0 ? gz : gz + 1}`) + sfx;
      out.brackets.push({ key, gx, gz, dx, dz });
    }
    if (o === 2) for (const [vx, vz] of [[gx, gz], [gx + 1, gz], [gx, gz + 1], [gx + 1, gz + 1]]) {
      const around = [[vx - 1, vz - 1], [vx, vz - 1], [vx - 1, vz], [vx, vz]], inRoom = around.filter(([a, b]) => has(a, b));
      if (inRoom.length === 4 || around.some(([a, b]) => S.out(a, b) < 2)) continue; // inside the floor, or next to where a wall or a bracket already carries it
      const corner = inRoom.length === 1 || inRoom.length === 3;
      if (corner || (inRoom.length === 2 && (vx + vz) % 2 === 0)) posts.set(`${vx}:${vz}`, [vx, vz, Math.sign(inRoom.reduce((t, c) => t + c[0] + 0.5 - vx, 0)), Math.sign(inRoom.reduce((t, c) => t + c[1] + 0.5 - vz, 0))]);
    }
  }
  for (const [k, [vx, vz, ix, iz]] of posts) {
    // from whatever is under it: the top of the highest room below this floor at that corner, else the ground
    let y0 = 0;
    for (const o of Object.values(entities)) if (o.kind === 'room' && o.id !== room.id) { const t = roomTop(entities, o); if (t < y && t > y0 && [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].some(([a, b]) => contains(o.recipe, vx * 5 + a, vz * 5 + b))) y0 = t; }
    // the outline edges that leave this vertex (exactly one of the two squares beside the edge is the room's)
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => { const a = dx ? [dx > 0 ? vx : vx - 1, vz - 1] : [vx - 1, dz > 0 ? vz : vz - 1], b = dx ? [a[0], vz] : [vx, a[1]]; return has(...a) !== has(...b); });
    out.posts.push({ key: `p${k}${sfx}`, vx, vz, y0, dirs, inn: [ix, iz] }); // inn: which way the floor it carries lies from the vertex
  }
  return out;
}
export const supportKeys = (entities, room) => { const P = supportPlan(entities, room); return [...P.brackets.map(b => b.key), ...P.posts.map(p => p.key)]; };

export function supportProblem(entities, rect, y, reach = 2) {
  const S = supportAt(entities, y, reach);
  if (!S.any) return `nothing to stand on: no room reaches up to ${y} ft here (build the storey below first)`;
  let bad = null, any = false;
  for (const [i, j] of cellsOf(rect)) { const gx = rect.x + i, gz = rect.z + j; if (S.ok(gx, gz)) any = true; else bad ||= [gx, gz]; }
  if (!any) return `nothing to stand on: no room reaches up to ${y} ft under this one (build the storey below first)`;
  return bad ? `an upper room may overhang the rooms below it by at most ${reach * 5} ft (the square at x=${bad[0] * 5}, z=${bad[1] * 5} is further out)` : null;
}

// THE ROOM A POINT AT A HEIGHT IS IN: the room whose footprint holds (x, z) and whose height span holds y (half a foot of
// slack at the floor). Used wherever the flat game asked "which room is this point in".
export function roomAtHeight(entities, x, z, y = 0) {
  const f = floorUnder(entities, x, z, y), r = f && entities[f.room];
  return r && (y || 0) < roomTop(entities, r) ? r : null;
}

// THE BUILDING A NEW ROOM JOINS: the building of a room it touches (side by side at an overlapping height, or stacked:
// directly above or below), else none. Same-height neighbours first, then the room below, then the room above.
export function buildingAt(entities, rect, [y, top]) {
  const touch = (r) => rect.x <= r.x + r.w && r.x <= rect.x + rect.w && rect.z <= r.z + r.d && r.z <= rect.z + rect.d;
  let best = null, rank = 9;
  for (const e of Object.values(entities || {})) {
    if (e.kind !== 'room' || !e.building) continue;
    const [ey, et] = span(entities, e);
    const k = spansOverlap(y, top, ey, et) ? (touch(e.recipe) ? 0 : 9) : et === y && footprintsOverlap(e.recipe, rect) ? 1 : ey === top && footprintsOverlap(e.recipe, rect) ? 2 : et === y && touch(e.recipe) ? 3 : 9;
    if (k < rank || (k === rank && k < 9 && e.order < best.order)) { best = e; rank = k; }
  }
  return rank < 9 ? best.building : null;
}

// the heights a building's storeys sit at, lowest first, with their labels (for the level control and the LLM API)
export function levelsOf(entities, buildingId) {
  const b = entities?.[buildingId], out = new Map();
  for (const e of Object.values(entities || {})) if (e.kind === 'room' && e.building === buildingId) { const s = storeyOf(entities, e); if (!out.has(s)) out.set(s, { storey: s, level: levelLabel(s), y: baseOf(b) + s * storeyHeightOf(b) }); }
  return [...out.values()].sort((a, c) => a.storey - c.storey);
}

// why a height is not acceptable for a room, or null
export function heightProblem(a) {
  if (a.y != null && !(Number.isInteger(a.y) && a.y % STEP === 0 && Math.abs(a.y) <= MAX_Y)) return `y: a room's floor height is in feet, a multiple of ${STEP}, within ±${MAX_Y}`;
  if (a.tall != null && !(Number.isInteger(a.tall) && a.tall >= 1 && a.tall <= MAX_TALL)) return `tall: how many storeys the room spans, 1 to ${MAX_TALL}`;
  return null;
}

// ---------------- ROOFS (storeys, Stage F; Harry 2026-10-05: "A roof is basically a kind of room") ----------------
// A roof is DERIVED (client/roofs.js works out its shape from the rooms); only its STYLE and a few choices are data:
//   building.roof   the building's roof style; absent = 'auto' = picked from the wall family of the building's oldest room
//   room.roof       { style?, seed?, off? }: this room's own style, the seed of its trim (dormers, a finial), no roof at all
export const ROOF_STYLE_KEYS = ['thatch', 'tile', 'slate', 'shingle', 'flat'];
export const ROOF_BY_FAMILY = { 'rough-timber': 'thatch', 'log-cabin': 'shingle', 'half-timber': 'tile', fieldstone: 'shingle', 'dressed-stone': 'slate', 'noble-interior': 'slate', 'crypt-stone': 'slate',
  'castle-rough': 'slate', 'noble-panel': 'slate', 'noble-paper': 'slate', conservatory: 'slate' }; // castle and mansion (2026-10-06); a conservatory wants a glass roof, which does not exist yet
ROOF_BY_FAMILY['temple-stone'] = 'slate'; // temple & chapel (2026-10-11)
ROOF_BY_FAMILY['cut-rock'] = 'flat'; // type:dun (2026-10-11): a hewn dungeon has rock over it, not a roof; where one is drawn it is flat
ROOF_BY_FAMILY['tower-stone'] = 'slate'; // wizard's tower (2026-10-11)
ROOF_BY_FAMILY['mine-timbered'] = 'flat'; // type:min (2026-10-11): rock over a mine too
ROOF_BY_FAMILY['black-stone'] = 'slate'; // cult sanctum (2026-10-11, types:clt)
export const ROOF_DEFAULT = 'thatch';
ROOF_BY_FAMILY['cut-rock'] ??= 'flat'; // type:lai (2026-10-11): a lair is under rock; cut-rock is shared with the dungeon, which sets the same
ROOF_BY_FAMILY['wattle-daub'] = 'thatch'; // type:hut (hut-01): the farm's own wall family
// type:hut (2026-10-11): a room type whose roof does not follow its wall family. The farmstead's rooms roll half-timber (tile by
// family) or fieldstone (shingle) and are thatched all the same: wattle-and-daub under thatch is the look. A building's own
// roof (building.roof) and a room's own (room.roof.style) still win.
export const ROOF_BY_TYPE = Object.fromEntries(['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-byre', 'hut-coop', 'hut-barn', 'hut-granary', 'hut-dairy'].map(k => [k, 'thatch']));
// a room.set / building.set roof argument: null, or why it is refused
export function roofProblem(v, forBuilding = false) {
  if (forBuilding) return v === 'auto' || ROOF_STYLE_KEYS.includes(v) ? null : `roof: one of ${ROOF_STYLE_KEYS.join(', ')}, or auto`;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'roof: an object { style?, seed?, off? }';
  for (const k of Object.keys(v)) if (!['style', 'seed', 'off'].includes(k)) return `roof: unknown field ${k} (style, seed, off)`;
  if (v.style !== undefined && v.style !== 'auto' && !ROOF_STYLE_KEYS.includes(v.style)) return `roof.style: one of ${ROOF_STYLE_KEYS.join(', ')}, or auto (the building's)`;
  if (v.seed !== undefined && !(Number.isInteger(v.seed) && Math.abs(v.seed) <= 2 ** 31)) return 'roof.seed: an integer';
  if (v.off !== undefined && typeof v.off !== 'boolean') return 'roof.off: true or false';
  return null;
}
// a room's roof field after a room.set (style 'auto', seed 0 and off false are the defaults: not stored); undefined = no field
export function mergeRoof(old, v) {
  const n = { ...(old || {}), ...v };
  if (n.style === 'auto' || n.style === undefined) delete n.style;
  if (!n.seed) delete n.seed;
  if (!n.off) delete n.off;
  return Object.keys(n).length ? n : undefined;
}
// the style a room's roof wears: its own, else its building's, else by wall family. familyOf(room entity) -> the room's
// wall family as drawn ('half-timber', ...); without it the default.
export function roofStyleOf(entities, room, familyOf = null) {
  if (room?.roof?.style && ROOF_STYLE_KEYS.includes(room.roof.style)) return room.roof.style;
  const b = buildingOf(entities, room);
  if (b?.roof && ROOF_STYLE_KEYS.includes(b.roof)) return b.roof;
  const mates = b ? Object.values(entities).filter(e => e.kind === 'room' && e.building === b.id).sort((p, q) => roomY(p.recipe) - roomY(q.recipe) || (p.order || 0) - (q.order || 0)) : [room];
  const byType = ROOF_BY_TYPE[(mates[0] || room)?.recipe?.type]; if (byType) return byType; // type:hut: a farm room is thatched whatever its walls rolled
  const fam = familyOf ? familyOf(mates[0] || room) : null;
  return ROOF_BY_FAMILY[fam] || ROOF_DEFAULT;
}

// FOG AND STOREYS (Harry 2026-10-06: "No fog on 2nd story or higher by default"). A room on its building's second
// storey or above has fog height 0 unless it has been given its own (`room.fog`, the room menu's Fog height slider),
// whatever its room type's default is (the tuner's data/fog_defaults.json). Nothing is stored: a room that was never
// set simply follows this, so campaigns on disk are unchanged. Returns the default to use, or null = the type's own.
export function fogDefault(entities, room) { return room?.recipe && storeyOf(entities, room) >= 1 ? 0 : null; }
