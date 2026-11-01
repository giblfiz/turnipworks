// HEIGHT: the one rule file (docs/VERTICAL.md, Harry 2026-10-05). All heights are in FEET.
//
//   room.recipe.y      the room's floor height (integer, a multiple of 5; absent = 0; negative = below ground)
//   room.recipe.tall   how many storeys the room spans (integer >= 1; absent = 1). A tall room is ONE room.
//   object.y, token.y  the thing's ABSOLUTE height (a thing standing on the floor of a room at y = 10 has y = 10)
//
// ONE LEVEL MODEL FOR THE WHOLE MAP (Harry 2026-10-26: "refactor to a universal level height model"). A storey is 10 ft
// everywhere (a 9-ft wall and a 1-ft slab) and level n's floor is at 10 * (n - 1) ft wherever it is: lv 1 is 0..9 ft, lv 2
// 10..19, lv -1 -10..-1. Nothing about levels belongs to a building any more: `building.base` and `building.storey`
// (settable 2026-10-05 to 2026-10-26, never set by the game, set on no saved campaign) are ignored if present. What a
// building's numbering used to stand for, GROUND CONTACT (an outside door, no stair offer down, fog defaults, sight), is
// asked of each room: does it meet the ground (meetsGround)?
//
// NOTHING STORES A "FLOOR" FOR A PAWN, an object or a room. Which level something is on is always worked out here,
// from its height (Foundry stores both, and its worst bugs come from the two disagreeing).
//
// Pure data, no three.js, no DOM: the relay and the browser run the same code. `entities` is an area's entity map.
import { contains, overlap as footprintsOverlap, hasCell, cellsOf } from './footprint.js';
import { openingIndex, openAtFast } from './holes.js';
import { stairWalk } from './stairs.js'; // (a cycle, stairs.js imports this file: both only call each other at run time)

export const STOREY = 10, SLAB = 1, STEP = 5, MAX_Y = 200, MAX_TALL = 6;

export const roomY = (rc) => rc?.y || 0;
export const buildingOf = (entities, room) => (room?.building && entities?.[room.building]) || null;
// a room's height floor to floor-above, its top (where the next storey's floor is) and its ceiling (the underside of
// the slab above: THE NUMBER A CUT IS SET TO, so "base at or below the cut" hides the room above and shows this one)
export const roomHeight = (entities, room) => (room.recipe.tall || 1) * STOREY;
export const roomTop = (entities, room) => roomY(room.recipe) + roomHeight(entities, room);
export const ceilingOf = (entities, room) => roomTop(entities, room) - SLAB;
// THE LEVEL (Harry 2026-10-26: "cutaways are universal, not per building"; then "a universal level height model"). A
// level is a 10-ft band of heights counted from the ground (0). A shrine on a 10-ft hill is on lv 2; the meter means the
// same height everywhere; a pawn halfway up a stair (its base 5 ft up) is on lv 1 until its base reaches 10 ft.
//   levelAt(y) -> the level index (0 = lv 1, -1 = lv -1); levelOf(entities, room) -> that of the room's floor
export const levelAt = (y) => Math.floor((y || 0) / STOREY + 1e-9);
export const levelOf = (entities, room) => levelAt(roomY(room?.recipe));
export const levelFloor = (y) => levelAt(y) * STOREY; // the floor height of the level a height is on
// what people are shown: "lv 1" for level 0, "lv 2" for 1, "lv -1" for -1 (there is no lv 0)
export const levelLabel = (storey) => `lv ${storey >= 0 ? storey + 1 : storey}`;
// the cut rule (Harry: something that spans the cut is shown whole if its BASE is at or below the cut)
export const visibleAt = (baseY, cut) => cut == null || (baseY || 0) <= cut;

// TERRAIN (2026-10-24, docs/VERTICAL.md "Terrain: computed banks"; Harry: "a way to raise some earth ... get things one
// story up"). A HILL is a room of a terrain type: a flat terrace of raised ground whose floor (`y`, a multiple of 5) is
// its TOP, outdoor (no walls), solid from the ground up to that top. The bank down to the lower ground is worked out by
// the engine (core/terrain.js), never stored. It is ground, not a storey: no building, no slab, no supports, never hidden
// by the cut, and for sight and fog it is the ground (sightLevel).
export const TERRAIN_TYPES = new Set(['hill']);
export const isTerrain = (rc) => !!rc && TERRAIN_TYPES.has(typeof rc === 'string' ? rc : rc.type);
export const isTerrainRoom = (e) => e?.kind === 'room' && isTerrain(e.recipe);
// a new hill is one storey up; the menu and the bar offer one or two storeys (2026-10-26, Harry: "5-foot hills can be done
// as objects, sort of like tables": a 5-ft or 15-ft hill on disk still loads and draws, but nothing offers one now)
export const HILL_STEP = 10, HILL_STEPS = [10, 20];
// the highest terrain top at (x, z) (feet), else the ground (0): where a hill drawn here starts from
export function terrainTopAt(entities, x, z) {
  let top = 0;
  for (const e of Object.values(entities || {})) if (isTerrainRoom(e) && contains(e.recipe, x, z) && !terrainTakenAt(entities, e, x, z)) top = Math.max(top, roomY(e.recipe)); // (where a room takes the hill, it is that room's floor, not the hill's top)
  return top;
}

// ROOMS ON AND IN HILLS (2026-10-24; Harry: "Existing (and new) rooms should trump hill slope, so that they can have a
// 'dug out' look"). A room (not terrain) TAKES a hill's ground wherever its footprint covers it, when its floor is at or
// below the hill's top and it reaches above the ground, and its floor is at or above the ground (2026-10-27, Harry: "Rooms
// _under_ the ground level shouldn't change the shape of the hill": a cellar or a cave under a hill never takes it, however
// tall it is):
//   floor = the hill's top    it stands ON the hill (a shrine on the hilltop): its floor is the ground there
//   floor below the top       it is DUG INTO the hill: its walls hold the earth back, its floor is its own
// Where a room takes it, a hill has no top (its tiles are not drawn, nothing stands on it, the pointer goes through) and
// its bank is cut away down to the room's floor at the room's outline (core/terrain.js), so the earth lies banked up
// against the room's walls from outside, whichever was drawn first. Nothing is stored: the rooms and hills decide it.
const TAKERS = new WeakMap();
function takersOf(entities) {
  let T = TAKERS.get(entities); if (T) return T;
  T = Object.values(entities || {}).filter(e => e.kind === 'room' && e.recipe && !isTerrain(e.recipe) && roomY(e.recipe) >= 0 && roomTop(entities, e) > 0).map(e => ({ id: e.id, rc: e.recipe, y: roomY(e.recipe) }));
  if (entities && typeof entities === 'object') TAKERS.set(entities, T);
  return T;
}
// the rooms that take a hill's ground: [{ id, rc, y }] (y: the room's floor) -> every room with a floor at or below
// `hillY` (a hill's top) that reaches above the ground, its floor not below it
export const terrainTakers = (entities, hillY = Infinity) => takersOf(entities).filter(t => t.y <= hillY);
// does a room take this hill's top at (x, z)?
export const terrainTakenAt = (entities, hill, x, z) => { const y = roomY(hill.recipe || hill); return takersOf(entities).some(t => t.y <= y && contains(t.rc, x, z)); };
// THE GROUND A ROOM STANDS ON (feet): the highest solid ground under its floor. A hill it overlaps carries it up to the
// hill's top, or (dug in) up to its own floor; else the ground, 0. A shrine on a 10-ft hill: 10; a room dug into the
// hill at the ground: 0; a room at 10 ft dug into a 15-ft hill: 10 (it rests on the hill's solid ground).
const HILLS = new WeakMap();
const hillList = (entities) => { let L = entities && typeof entities === 'object' ? HILLS.get(entities) : null; if (!L) { L = Object.values(entities || {}).filter(isTerrainRoom); if (entities && typeof entities === 'object') HILLS.set(entities, L); } return L; };
export function hillUnder(entities, rc) {
  const y = roomY(rc); let g = 0;
  for (const e of hillList(entities)) if (e.recipe !== rc && footprintsOverlap(e.recipe, rc)) g = Math.max(g, Math.min(roomY(e.recipe), y));
  return g;
}
// GROUND CONTACT, PER ROOM (2026-10-26; it was per building, `hillBaseOf`, from 2026-10-24). A room MEETS THE GROUND when
// its floor is the ground it stands on: on the open ground at 0, ON a hill at the hill's top, or dug into a hill (its floor
// is the earth's there). Such a room is a ground storey wherever it is, whatever else its building has: it has an outside
// door (core/roomgen.js), no stair offer down, a ground storey's fog default, and it sees and is seen on the outdoor sight
// surface (levelY 0). A room over another room, or over air, does not; nor does a room below the ground.
export const meetsGround = (entities, room) => { const rc = room?.recipe; if (!rc || isTerrain(rc)) return false; const y = roomY(rc); return y >= 0 && y === hillUnder(entities, rc); };
// THE SIGHT LEVEL OF A ROOM (feet): what SIGHT and FOG go by (vision.js, fog.js, the atmosphere's level). OUTDOORS IS ONE
// SIGHT SURFACE: the open ground, every hill's top and every room that meets the ground are 0 (a pawn on a hilltop sees
// the plain and is seen from it; the walls of a shrine on the hill block it as a ground building's walls block the yard).
// INDOORS, one level at a time: every other room sees at its own floor height (an upper storey at 10, the one above at 20,
// a cellar at -10). Not the cut: the cut and the level numbers are the map's (levelAt, cutRooms).
export const levelY = (entities, room) => room?.recipe ? (isTerrain(room.recipe) || meetsGround(entities, room) ? 0 : roomY(room.recipe)) : 0;
// how far a room's own heights are above its sight level (its walls at height h stand on sight level h - this): the
// floor of a room that meets the ground, else 0 (vision.js blockingSegments)
export const sightGround = (entities, room) => room?.recipe && !isTerrain(room.recipe) ? roomY(room.recipe) - levelY(entities, room) : 0;

// THE CUT HIDES WHAT COVERS THE LEVEL YOU ARE ON (2026-10-26, docs/VERTICAL.md "The cut, one numbering for the map"). The
// cut `c` is a ceiling (feet, the map's own heights; null = all levels). A room whose floor is at or below c shows. A room
// above c is hidden, unless it STANDS CLEAR: the view is at or above the ground (c >= 0), no part of it lies, in plan,
// over a room you can see (a room, not a hill, with its floor at or below c and at or above the ground), and what it
// stands on stands clear too: either it meets the ground above the cut (it stands on, or is dug into, a hill higher than
// the cut), or every room it stands on (a room whose top is its floor, under it in plan) stands clear. Such rooms cover
// only a hill's solid earth, so they show WHOLE, every storey stacked on them, like a castle on the horizon; the hill
// under them is never hidden. Everything else above the cut is hidden. On the open ground nothing stands clear (it meets
// the ground at 0, never above a cut at or over the ground): its hidden rooms are exactly { y > c }.
// Judged per STACK of rooms (2026-10-26, universal levels; it was per building): a storey standing on a hidden room is
// hidden (it would float), and a building that has rooms both on the plain and on a hill (Harry's cathedral, "Intesst")
// shows its hilltop rooms like any hilltop building's.
//   -> { hidden: Set(room id), clear: Set(room id) }  (clear: above the cut and shown; cached per state and cut)
const CUTS = new WeakMap();
export function cutRooms(entities, cut) {
  const none = { hidden: new Set(), clear: new Set() };
  if (cut == null || !entities || typeof entities !== 'object') return none;
  let M = CUTS.get(entities); if (!M) CUTS.set(entities, M = new Map());
  if (M.has(cut)) return M.get(cut);
  const rooms = Object.values(entities).filter(e => e.kind === 'room' && e.recipe && !isTerrain(e.recipe));
  const above = rooms.filter(r => roomY(r.recipe) > cut), out = { hidden: new Set(), clear: new Set() };
  if (cut >= 0 && above.length && hillList(entities).length) {
    const seen = rooms.filter(r => { const y = roomY(r.recipe); return y <= cut && y >= 0; });
    const memo = new Map();
    const clear = (r) => {
      if (memo.has(r.id)) return memo.get(r.id); memo.set(r.id, false); // (a loop of rooms "standing on" each other stands on nothing)
      let ok = !seen.some(s => footprintsOverlap(s.recipe, r.recipe)); // it would be a lid over a room in view
      if (ok) {
        if (meetsGround(entities, r)) ok = roomY(r.recipe) > cut;
        else { const under = rooms.filter(u => u !== r && roomTop(entities, u) === roomY(r.recipe) && footprintsOverlap(u.recipe, r.recipe)); ok = under.length > 0 && under.every(u => roomY(u.recipe) > cut && clear(u)); }
      }
      memo.set(r.id, ok); return ok;
    };
    for (const r of above) if (clear(r)) out.clear.add(r.id);
  }
  for (const r of above) if (!out.clear.has(r.id)) out.hidden.add(r.id);
  M.set(cut, out); return out;
}
// is something whose base rests on `base` (core baseUnder: { y, room }) hidden by the cut? `y` is the height it is judged
// by: a pawn's base (the default), a loose thing's own height (as ever: a crate raised to 12 ft hides at lv 1). At or
// below the cut it shows; above it, it goes with what it stands on: a room's (a building standing clear shows whole), a
// hill's top (the earth: shown while the view is at or above the ground, hidden below it, as the open ground's things
// are), the open ground or the air (hidden).
export function cutHidesBase(entities, base, cut, y = base.y) {
  if (cut == null || visibleAt(y, cut)) return false;
  const r = base.room && entities?.[base.room];
  if (!r?.recipe) return true;
  if (isTerrain(r.recipe)) return cut < 0;
  return !cutRooms(entities, cut).clear.has(r.id);
}

// do two height spans [y, top) share any height?
export const spansOverlap = (aY, aTop, bY, bTop) => aY < bTop && bY < aTop;
const span = (entities, room) => [roomY(room.recipe), roomTop(entities, room)];
// the height span a room about to be made (or moved) would take: args { y?, tall? }
export function spanOfArgs(entities, a) {
  const y = a.y || 0;
  return [y, y + (a.tall || 1) * STOREY];
}
// the room that a footprint at a height span would collide with (footprints share a cell AND heights overlap), or null
export function roomClash(entities, rect, [y, top], exceptId = null) {
  const T = isTerrain(rect);
  for (const e of Object.values(entities)) {
    if (e.kind !== 'room' || e.id === exceptId) continue;
    const eT = isTerrain(e.recipe);
    // TERRAIN: two hills clash only at the SAME height (a hill on a hill is a higher terrace; the tool joins same-height
    // draws into one shape). A room and a hill never clash (2026-10-24): a room at the hill's top stands on it, a room
    // lower down is dug into it (rooms trump the hill: terrainTakenAt), whichever was drawn first.
    if (T || eT) {
      if (T && eT && (rect.y || 0) === roomY(e.recipe) && footprintsOverlap(e.recipe, rect)) return e;
      continue;
    }
    const [ey, et2] = span(entities, e);
    if (spansOverlap(y, top, ey, et2) && footprintsOverlap(e.recipe, rect)) return e;
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
    if (ry > (y || 0) + 0.5 || (best && (ry < roomY(best.recipe) || (ry === roomY(best.recipe) && !isTerrain(best.recipe))))) continue;
    if (contains(e.recipe, x, z) && !(isTerrain(e.recipe) && terrainTakenAt(entities, e, x, z))) best = e; // (a hill's top where a room takes it is no floor)
  }
  if (!best) return null;
  return { room: best.id, y: roomY(best.recipe), storey: levelOf(entities, best), level: levelLabel(levelOf(entities, best)), building: best.building || null }; // (storey: the level's index, the map's since 2026-10-26: 0 = lv 1)
}
// where a pawn (or any thing with x, z, y) is: DERIVED, never stored.  -> { y, room, storey, level, building }
export function tokenFloor(entities, t) {
  const f = floorUnder(entities, t.x, t.z, t.y || 0);
  // inside a room's height? (a flyer far above a roof is over the building, not on a storey of it)
  if (f && (t.y || 0) < roomTop(entities, entities[f.room])) return { ...f, floorY: f.y, y: t.y || 0 };
  const storey = levelAt(t.y || 0);
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
// A HOLE OR A PIT'S OPENING IS NO GROUND (2026-10-22, core/holes.js): a floor with an opening at (x, z) is passed over
// (and so is the top of the room under it: that is the same floor seen from below), so the base is on what is under it.
// A STAIR IS A PLACE TO STAND (Harry 2026-10-26: "A stair is not a teleporter. A stair is a place that people can
// stand"): a flight's treads are ground at the height of the flight at that point along its run (core/stairs.js
// stairWalk), and the floor at its top has no ground on the stair's squares (the hole), so over the hole the base is on
// the treads under it. `on: 'stair'`, `stair`: its id; `room`: the room it stands in, or at its very top the room it
// comes up into (what the level's sight and the cut go by).
export function baseUnder(entities, x, z, y = 0, isOpen = null) {
  let best = null; y = y || 0;
  const holes = openingIndex(entities), W = stairWalk(entities), sq = W.holes.size ? `${Math.floor(x / 5 + 1e-6)}:${Math.floor(z / 5 + 1e-6)}` : null;
  const gone = (h) => (holes ? openAtFast(entities, x, z, h) : false) || (sq != null && !!W.holes.get(h)?.has(sq));
  for (const t of W.at(x, z)) if (t.y <= y + 0.5 && (!best || t.y > best.y)) best = { y: t.y, room: t.room, on: 'stair', stair: t.id };
  for (const e of Object.values(entities || {})) {
    if (e.kind !== 'room' || !e.recipe) continue;
    const ry = roomY(e.recipe); if (ry > y + 0.5) continue;
    const hill = isTerrain(e.recipe); // (a hill's top is its floor: there is nothing above it to rest on; where a room takes it, it is no ground)
    if (hill && (!contains(e.recipe, x, z) || terrainTakenAt(entities, e, x, z))) continue;
    const top = hill ? ry : roomTop(entities, e); let onTop = !hill && y >= top && !(isOpen && isOpen(e)) && !gone(top);
    if (!onTop && gone(ry)) continue; // its floor has an opening there (and its top is not under the figure, or is open too)
    const by = onTop ? top : ry;
    if (best && (by < best.y || (by === best.y && (onTop || best.on === 'floor')))) continue; // (a tie: the upper room's floor, not the lower room's top; a floor, not the stair's foot)
    if (contains(e.recipe, x, z)) best = { y: by, room: e.id, on: onTop ? 'top' : 'floor' };
  }
  const out = best || { y: Math.min(0, y), room: null, on: 'ground' };
  // A HOLE OVER SOLID EARTH (2026-10-26; Harry's cathedral on its hill has a 20-ft round hole in its floor): under it is
  // the hill's earth, not the ground 10 ft down inside it, so the base rests on the earth's top there (the floor the
  // hole is in), as a hole in the open ground over nothing leaves a pawn on the ground (core/holes.js)
  if ((!out.room || isTerrain(entities?.[out.room]?.recipe)) && hillList(entities).length) {
    const e = earthAt(entities, x, z);
    if (e > out.y + 0.5 && e <= y + 0.5) { const k = takersOf(entities).find(t => t.y === e && contains(t.rc, x, z)), h = hillList(entities).find(q => roomY(q.recipe) === e && contains(q.recipe, x, z)); return { y: e, room: k?.id || h?.id || null, on: 'floor' }; }
  }
  return out;
}
// THE LEVEL SIGHT AND FOG GO BY (2026-10-24; universal levels 2026-10-26): the sight level of what a pawn's base rests on
// (levelY): outdoors (the open ground, a hill's top, a room that meets the ground) is one surface, 0; indoors a room's own
// floor height. On a stair: the room it stands in (the lower level) until its base reaches the top.
export function sightLevel(entities, x, z, y = 0, isOpen = null) {
  const b = baseUnder(entities, x, z, y, isOpen), r = b.room && entities?.[b.room];
  if (!r?.recipe) return b.on === 'ground' && b.y === 0 ? 0 : b.y;
  if (b.on === 'floor' || b.on === 'stair') return levelY(entities, r);
  return isTerrain(r.recipe) ? 0 : b.y; // (on a room's top: a roof or a deck, the open air at that height)
}

// THE EARTH AT (x, z) (feet): how high the ground is solid there. The open ground is solid to 0; a hill to its top,
// except where a room takes it, where it is cut down to that room's floor (a shrine ON the hill: its floor, the hill's
// top; a room dug into it: its own floor). Nothing stands inside it.
export function earthAt(entities, x, z) {
  let top = 0;
  for (const h of hillList(entities)) {
    if (!contains(h.recipe, x, z)) continue;
    const hy = roomY(h.recipe); let t = hy;
    for (const k of takersOf(entities)) if (k.y <= hy && contains(k.rc, x, z)) t = Math.min(t, k.y);
    top = Math.max(top, t);
  }
  return top;
}
// does a base rest on the OUTDOOR surface (the open ground, a hill's top, the floor of a room that meets the ground)?
export const outdoorBase = (entities, b) => { const r = b?.room && entities?.[b.room]; return !r?.recipe ? b?.on === 'ground' && (b.y || 0) === 0 : b.on === 'floor' && (isTerrain(r.recipe) || meetsGround(entities, r)); };

// WHERE A STANDING PAWN GOES WHEN IT IS MOVED TO (x, z) (Harry 2026-10-26: "pawns popping up and down by full level
// increments incorrectly ... refactor to a universal level height model"; "pawns going up and down stairs"; "a stair is
// a place that people can stand"). `from` is the height its base is at now. A PAWN KEEPS ITS LEVEL: it goes to the
// floor of that level under (x, z), whatever building is there. It changes level only by:
//   a stair      a flight under (x, z) whose treads there are within 5 ft of `from`: the treads' height (so a drag along a
//                stair carries it smoothly up or down, never a jump; let go halfway, it stands halfway)
//   the earth    the level is solid earth there (a hill rises through it, or it is below the ground): it climbs to the
//                top of the earth there, the hill's top or the floor of the room on it (terrain is walked, not built)
//   nothing      no floor of its level there (off a hill's edge, an upper floor's edge, over a hole or a pit's opening):
//                the highest ground below, `below: true` (a caller walks it there off a hill onto lower ground, `walk`,
//                and otherwise leaves it hanging over the drop and offers the fall)
// An explicit raise / lower is not this (it sets the figure's height; the base falls to what is under it).
// `fromBase`: what its base rests on now (baseUnder where it stands), for `walk`; without it nothing walks down.
//   -> { y, room, on, stair?, below?, walk?, climb? }
export function pawnStepTo(entities, x, z, from = 0, isOpen = null, fromBase = null) {
  from = from || 0;
  for (const t of stairWalk(entities).at(x, z)) if (Math.abs(t.y - from) <= STEP + 1e-9) return { y: t.y, room: t.room, on: 'stair', stair: t.id }; // (treads within 5 ft of its feet: under 5 ft is standing, the house's D&D rule; a stairwell further down is a drop)
  // off a stair it steps onto the floor of the NEARER end's level (just under the top tread it is all but upstairs; a pawn
  // standing on a stair is on the lower level until its feet reach the top: levelAt, for the cut, sight and the labels)
  const ws = fromBase?.on === 'stair' ? stairWalk(entities).list.find(t => t.id === fromBase.stair) : null;
  const lo = levelFloor(ws ? (from - ws.base <= ws.top - from ? ws.base : ws.top) : from), hi = lo + STOREY, earth = earthAt(entities, x, z);
  const b = baseUnder(entities, x, z, hi - 1, isOpen); // (a foot under the next level: baseUnder takes floors half a foot over what it is given)
  // a floor of this level: a room's floor or top, a stair; the ground or a hill's top only where no higher earth is over it
  // (inside a hill there is no ground at 0; a terrace on a terrace buries the lower top), and never the ground below 0
  const br = b.room && entities?.[b.room], earthy = !br?.recipe || isTerrain(br.recipe);
  const real = b.y >= lo - 0.5 && !(earthy && earth > b.y + 0.5) && !(b.on === 'ground' && b.y < 0);
  if (real) return b;
  if (earth > lo + 0.5) { const u = baseUnder(entities, x, z, earth + 0.5, isOpen); return { ...u, climb: true }; }
  const walk = !!fromBase && outdoorBase(entities, fromBase) && outdoorBase(entities, b);
  return { ...b, below: true, ...(walk && { walk: true }) };
}

// AN UPPER ROOM MUST STAND ON SOMETHING: every one of its cells within `reach` cells (two: a jetty, or posts) of a cell
// of a room whose top is its floor height. Returns null when supported, else a reason.
// the test both the core and the room tool use: (gx, gz) -> is this square within `reach` of a square of a room whose
// top is y? `any` = is there such a room at all. (The room tool lights exactly the squares this accepts.)
// (2026-10-24) A HILL CARRIES what stands on it: solid ground up to its top, so any floor at or below its top (a shrine
// on the hilltop, a room dug in half way up a taller hill) is over ground there, and may overhang its edge like a jetty.
export function supportAt(entities, y, reach = 2) {
  const below = Object.values(entities || {}).filter(e => e.kind === 'room' && e.recipe && (isTerrain(e.recipe) ? roomY(e.recipe) >= y : roomTop(entities, e) === y)).map(e => e.recipe);
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
// rim = how far past the line (the DRAWN slab passes client/bands.js SLAB_RIM_UNDER_BAND, 0: since 2026-10-24 the band
// between storeys, a foot of the wall itself, covers the slab's edge, and the slab stays inside the wall's thickness)
export const SLAB_RIM = 0.5;
export function slabRects(w, d, cells, open = null, cell = 5, rim = SLAB_RIM) {
  const R = rim, set = cells ? new Set(cells.map(([i, j]) => `${i}:${j}`)) : null;
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
  if (!rc || y <= 0 || isTerrain(rc)) return out; // (a hill is solid ground: nothing holds it up)
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
    for (const o of Object.values(entities)) if (o.kind === 'room' && o.id !== room.id) { const t = isTerrain(o.recipe) ? roomY(o.recipe) : roomTop(entities, o); /* (a hill's top is its ground: a post under an overhang stands on a lower hill) */ if (t < y && t > y0 && [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].some(([a, b]) => contains(o.recipe, vx * 5 + a, vz * 5 + b))) y0 = t; }
    // the outline edges that leave this vertex (exactly one of the two squares beside the edge is the room's)
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => { const a = dx ? [dx > 0 ? vx : vx - 1, vz - 1] : [vx - 1, dz > 0 ? vz : vz - 1], b = dx ? [a[0], vz] : [vx, a[1]]; return has(...a) !== has(...b); });
    out.posts.push({ key: `p${k}${sfx}`, vx, vz, y0, dirs, inn: [ix, iz] }); // inn: which way the floor it carries lies from the vertex
  }
  return out;
}
export const supportKeys = (entities, room) => { const P = supportPlan(entities, room); return [...P.brackets.map(b => b.key), ...P.posts.map(p => p.key)]; };

export function supportProblem(entities, rect, y, reach = 2) {
  const S = supportAt(entities, y, reach);
  if (!S.any) return `nothing to stand on: no room or hill reaches up to ${y} ft here (build the storey below first)`;
  let bad = null, any = false;
  for (const [i, j] of cellsOf(rect)) { const gx = rect.x + i, gz = rect.z + j; if (S.ok(gx, gz)) any = true; else bad ||= [gx, gz]; }
  if (!any) return `nothing to stand on: no room or hill reaches up to ${y} ft under this one (build the storey below first)`;
  return bad ? `an upper room may overhang the rooms (or the hill) below it by at most ${reach * 5} ft (the square at x=${bad[0] * 5}, z=${bad[1] * 5} is further out)` : null;
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

// the levels a building has rooms on, lowest first, with their labels (for the LLM API): { storey: the level's index,
// level: 'lv 2', y: the level's floor height }
export function levelsOf(entities, buildingId) {
  const out = new Map();
  for (const e of Object.values(entities || {})) if (e.kind === 'room' && e.building === buildingId) { const s = levelOf(entities, e); if (!out.has(s)) out.set(s, { storey: s, level: levelLabel(s), y: s * STOREY }); }
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
//   room.roof       { style?, seed?, off?, shape?, axis? }: this room's own style, the seed of its trim (dormers, a finial),
//                   no roof at all (off: the room is OPEN TO THE SKY: Delete on a selected roof, 2026-10-27), its SHAPE
//                   ('gable' | 'hip' | 'flat'; absent = automatic: gable, or flat where the style is flat or something is
//                   built on part of it) and the way its RIDGE runs in plan ('x' | 'z'; absent = automatic: along the long
//                   side, a wing pointed at its neighbour). Turning a roof 90 degrees (roof.turn) sets `axis`; a turn back to
//                   what the automatic choice would be stores nothing. A room turned by room.rotate an odd number of quarter
//                   turns has its axis turned with it.
//                   trim: { <piece key>: { at: [x, z] } | { gone: true } }: a chimney, dormer or finial moved (feet from the
//                   room's corner) or removed (client/roofs.js "THE TRIM IS TOUCHABLE"); the rest stays by rule
//                   edge, turrets: what runs round the edge of its flat roof, its corner turrets (2026-10-27)
//   building.roofShape  the shape every roof of the building takes where its room has none of its own (absent = automatic)
// FLAT SURFACES (2026-10-27, Harry: "We need flat rooves to be more of a thing, it should be a substitute option. (Or
// several)"): five styles are FLAT SURFACES: a style that is one of them makes the roof flat, and it is what the flat part
// of any roof wears. 'flat' (2026-10-05 to 10-27: one stand-in deck of floorboards) stays a valid word, so saved maps and
// journals load and replay: it means the plank deck (ROOF_ALIAS).
export const FLAT_STYLES = ['deck', 'flagstone', 'lead', 'turf', 'plaster'];
export const ROOF_ALIAS = { flat: 'deck' };
export const ROOF_STYLE_KEYS = ['thatch', 'tile', 'slate', 'shingle', 'marble', ...FLAT_STYLES, 'flat']; // marble: the temple roof (2026-10-27)
export const roofStyleKey = (s) => ROOF_ALIAS[s] || s; // the style a word means ('flat' -> 'deck')
export const isFlatStyle = (s) => FLAT_STYLES.includes(roofStyleKey(s));
// THE EDGE OF A FLAT ROOF (2026-10-27, Harry: "Some like castles want like edges with crenellations (basically as
// railings)"): battlements (merlons and crenels), a plain stone parapet (what every flat roof had until then), a timber
// railing, or nothing. Never stored unless chosen (room.roof.edge); the default is by building and surface (roofEdgeOf).
export const ROOF_EDGES = ['battlements', 'parapet', 'railing', 'none'];
export const ROOF_BY_FAMILY = { 'rough-timber': 'thatch', 'log-cabin': 'shingle', 'half-timber': 'tile', fieldstone: 'shingle', 'dressed-stone': 'slate', 'noble-interior': 'slate', 'crypt-stone': 'slate',
  'castle-rough': 'flagstone', 'noble-panel': 'slate', 'noble-paper': 'slate', conservatory: 'slate' }; // castle and mansion (2026-10-06); a conservatory wants a glass roof, which does not exist yet. castle-rough: flagstone since 2026-10-27 (it was slate)
ROOF_BY_FAMILY['temple-stone'] = 'marble'; // temple & chapel (2026-10-11: slate; 2026-10-27, Harry: "we probably need a marble roof to look like a temple": a NEW DEFAULT, every 'auto' temple roof turns marble. The cathedral keeps its slate: ROOF_BY_TYPE)
ROOF_BY_FAMILY['cut-rock'] = 'turf'; // type:dun (2026-10-11): a hewn dungeon has rock over it, not a roof; where one is drawn it is flat (earth over it: turf since 2026-10-27; it was the plank deck)
ROOF_BY_FAMILY['tower-stone'] = 'slate'; // wizard's tower (2026-10-11)
ROOF_BY_FAMILY['mine-timbered'] = 'turf'; // type:min (2026-10-11): rock over a mine too (turf since 2026-10-27)
ROOF_BY_FAMILY['black-stone'] = 'slate'; // cult sanctum (2026-10-11, types:clt)
export const ROOF_DEFAULT = 'thatch';
ROOF_BY_FAMILY['cut-rock'] ??= 'turf'; // type:lai (2026-10-11): a lair is under rock; cut-rock is shared with the dungeon, which sets the same
ROOF_BY_FAMILY['wattle-daub'] = 'thatch'; // type:hut (hut-01): the farm's own wall family
// type:hut (2026-10-11): a room type whose roof does not follow its wall family. The farmstead's rooms roll half-timber (tile by
// family) or fieldstone (shingle) and are thatched all the same: wattle-and-daub under thatch is the look. A building's own
// roof (building.roof) and a room's own (room.roof.style) still win. Decided by the building's first room (its keep).
export const ROOF_BY_TYPE = Object.fromEntries(['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-byre', 'hut-coop', 'hut-barn', 'hut-granary', 'hut-dairy'].map(k => [k, 'thatch']));
ROOF_BY_TYPE.cathedral = 'slate'; // (2026-10-27) a Gothic cathedral is steep and slated, not a marble temple, though its walls are the temple's
// FLAT BY DEFAULT (2026-10-27, Harry: "Many building types and room types should default to flat roofs as well"; the
// list is docs/VERTICAL.md "Flat roofs"). A CASTLE: its keep is flagstoned and battlemented, whichever stone its first
// room's walls rolled (the great hall's dressed stone was slate). Dungeon, mine and lair rooms: turf (cut-rock and
// mine-timbered above).
export const CASTLE_TYPES = ['great-hall', 'throne-room', 'armoury', 'barracks', 'castle-kitchen', 'dungeon', 'gatehouse', 'castle-passage'];
for (const k of CASTLE_TYPES) ROOF_BY_TYPE[k] = 'flagstone';
// a room type that is flat whatever building it is in (its own type decides, before the building's first room): the
// wizard's observatory is the platform on top of the tower, the watch house a lookout
export const ROOF_BY_ROOM_TYPE = { 'wiz-observatory': 'flagstone', 'mkt-watch': 'flagstone' };
// battlements by default: a castle's roofs (by its first room's type, or castle-rough walls), and the watch house
const BATTLED_TYPES = new Set([...CASTLE_TYPES, 'mkt-watch']);
// the other flat surfaces' own edge: a plank deck has a timber railing, the rest a stone parapet (turf too: Gemini read a
// turf roof with no rim as "a floating patch of terrain", 2026-10-27)
export const EDGE_BY_SURFACE = { deck: 'railing', flagstone: 'parapet', lead: 'parapet', turf: 'parapet', plaster: 'parapet' };
// a room.set / building.set roof argument: null, or why it is refused
export const ROOF_SHAPES = ['gable', 'hip', 'flat'];
export const ROOF_AXES = ['x', 'z'];
const ROOF_FIELDS = ['style', 'seed', 'off', 'shape', 'axis', 'trim', 'edge', 'turrets'];
const TRIM_KEY = /^[a-z][a-z-]{0,23}:[A-Za-z0-9_.:-]{1,80}$/;
export function roofProblem(v, forBuilding = false) {
  if (forBuilding) return v === 'auto' || ROOF_STYLE_KEYS.includes(v) ? null : `roof: one of ${ROOF_STYLE_KEYS.join(', ')}, or auto`;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'roof: an object { style?, seed?, off?, shape?, axis?, trim?, edge?, turrets? }';
  for (const k of Object.keys(v)) if (!ROOF_FIELDS.includes(k)) return `roof: unknown field ${k} (${ROOF_FIELDS.join(', ')})`;
  if (v.style !== undefined && v.style !== 'auto' && !ROOF_STYLE_KEYS.includes(v.style)) return `roof.style: one of ${ROOF_STYLE_KEYS.join(', ')}, or auto (the building's)`;
  if (v.seed !== undefined && !(Number.isInteger(v.seed) && Math.abs(v.seed) <= 2 ** 31)) return 'roof.seed: an integer';
  if (v.off !== undefined && typeof v.off !== 'boolean') return 'roof.off: true or false';
  if (v.shape !== undefined && v.shape !== 'auto' && !ROOF_SHAPES.includes(v.shape)) return `roof.shape: one of ${ROOF_SHAPES.join(', ')}, or auto`;
  if (v.axis !== undefined && v.axis !== 'auto' && !ROOF_AXES.includes(v.axis)) return "roof.axis: 'x' or 'z' (the way the ridge runs), or auto";
  if (v.trim !== undefined) {
    if (!v.trim || typeof v.trim !== 'object' || Array.isArray(v.trim)) return 'roof.trim: an object { <piece key>: { at: [x, z] } | { gone: true } | null }';
    const ks = Object.keys(v.trim); if (ks.length > 64) return 'roof.trim: at most 64 pieces';
    for (const k of ks) {
      if (!TRIM_KEY.test(k)) return `roof.trim: not a piece key: ${k.slice(0, 40)}`;
      const t = v.trim[k]; if (t === null) continue;
      if (!t || typeof t !== 'object' || Array.isArray(t)) return `roof.trim.${k}: { at: [x, z] } or { gone: true } (null: back where the roof puts it)`;
      const tk = Object.keys(t); if (tk.length !== 1 || !['at', 'gone'].includes(tk[0])) return `roof.trim.${k}: { at: [x, z] } or { gone: true }`;
      if (tk[0] === 'gone' && t.gone !== true) return `roof.trim.${k}.gone: true`;
      if (tk[0] === 'at' && !(Array.isArray(t.at) && t.at.length === 2 && t.at.every(n => Number.isFinite(n) && Math.abs(n) <= 2000))) return `roof.trim.${k}.at: [x, z] in feet from the room's corner`;
    }
  }
  if (v.edge !== undefined && v.edge !== 'auto' && !ROOF_EDGES.includes(v.edge)) return `roof.edge: one of ${ROOF_EDGES.join(', ')}, or auto (by the building and the surface)`;
  if (v.turrets !== undefined && v.turrets !== 'auto' && typeof v.turrets !== 'boolean') return 'roof.turrets: true, false or auto';
  return null;
}
// a building.set roofShape argument: null, or why it is refused
export const roofShapeProblem = (v) => v === 'auto' || ROOF_SHAPES.includes(v) ? null : `roofShape: one of ${ROOF_SHAPES.join(', ')}, or auto`;
// a room's roof field after a room.set (style, shape, axis, edge and turrets 'auto', seed 0 and off false are the defaults: not stored); undefined = no field
export function mergeRoof(old, v) {
  const n = { ...(old || {}), ...v };
  for (const k of ['style', 'shape', 'axis']) if (n[k] === 'auto' || n[k] === undefined) delete n[k];
  if (v?.trim) { const t = { ...(old?.trim || {}) }; for (const [k, x] of Object.entries(v.trim)) if (x === null) delete t[k]; else t[k] = x; n.trim = t; } // (piece by piece: null puts one back)
  if (n.trim && !Object.keys(n.trim).length) delete n.trim;
  if (!n.seed) delete n.seed;
  if (!n.off) delete n.off;
  if (n.edge === 'auto' || n.edge === undefined) delete n.edge;
  if (n.turrets === 'auto' || n.turrets === undefined) delete n.turrets;
  return Object.keys(n).length ? n : undefined;
}
// the shape a room's roof is asked to take: its own, else its building's; undefined = automatic (client/roofs.js decides)
export function roofShapeOf(entities, room) {
  if (ROOF_SHAPES.includes(room?.roof?.shape)) return room.roof.shape;
  const b = buildingOf(entities, room);
  return ROOF_SHAPES.includes(b?.roofShape) ? b.roofShape : undefined;
}
// the room whose type and walls decide a building's roof: its first room (lowest, then oldest); a lone room is its own
function roofLead(entities, room) {
  const b = buildingOf(entities, room);
  const mates = b ? Object.values(entities).filter(e => e.kind === 'room' && e.building === b.id).sort((p, q) => roomY(p.recipe) - roomY(q.recipe) || (p.order || 0) - (q.order || 0)) : [room];
  return { b, lead: mates[0] || room };
}
// the style a room's roof wears: its own, else its building's, else its own type's (ROOF_BY_ROOM_TYPE), else by the first
// room's type, else by wall family. familyOf(room entity) -> the room's wall family as drawn ('half-timber', ...); without
// it the default. Always a style KEY ('flat' comes back as 'deck').
export function roofStyleOf(entities, room, familyOf = null) {
  if (room?.roof?.style && ROOF_STYLE_KEYS.includes(room.roof.style)) return roofStyleKey(room.roof.style);
  const { b, lead } = roofLead(entities, room);
  if (b?.roof && ROOF_STYLE_KEYS.includes(b.roof)) return roofStyleKey(b.roof);
  const own = ROOF_BY_ROOM_TYPE[room?.recipe?.type]; if (own) return own;
  const byType = ROOF_BY_TYPE[lead?.recipe?.type]; if (byType) return byType; // type:hut: a farm room is thatched whatever its walls rolled
  const fam = familyOf ? familyOf(lead) : null;
  return ROOF_BY_FAMILY[fam] || ROOF_DEFAULT;
}
// is this room's roof a castle's (battlements by default)? by its own type, its building's first room's type, or its walls
export function castleRoof(entities, room, familyOf = null) {
  const { lead } = roofLead(entities, room);
  return BATTLED_TYPES.has(room?.recipe?.type) || BATTLED_TYPES.has(lead?.recipe?.type) || (!!familyOf && familyOf(lead) === 'castle-rough');
}
// what runs round the open edges of the FLAT part of a room's roof: its own choice, else battlements on a castle, else by
// the flat surface it wears (EDGE_BY_SURFACE). flatSurface: the surface its flat part wears (client/roofs.js flatSurfaceOf).
export function roofEdgeOf(entities, room, flatSurface, familyOf = null) {
  if (room?.roof?.edge && ROOF_EDGES.includes(room.roof.edge)) return room.roof.edge;
  if (castleRoof(entities, room, familyOf)) return 'battlements';
  return EDGE_BY_SURFACE[roofStyleKey(flatSurface)] || 'parapet';
}
// corner turrets (bartizans) on the outer corners of a flat roof: its own choice (on any edge), else a castle's battlements have them
export function roofTurretsOf(entities, room, edge, familyOf = null) {
  if (typeof room?.roof?.turrets === 'boolean') return room.roof.turrets;
  return edge === 'battlements' && castleRoof(entities, room, familyOf);
}

// FOG AND STOREYS (Harry 2026-10-06: "No fog on 2nd story or higher by default"). A room a storey or more up that does
// not meet the ground (an upper storey; not a shrine on a hill, since 2026-10-26 judged per room) has fog height 0 unless
// it has been given its own (`room.fog`, the room menu's Fog height slider), whatever its room type's default is (the
// tuner's data/fog_defaults.json). Nothing is stored: a room that was never set simply follows this, so campaigns on disk
// are unchanged. Returns the default to use, or null = the type's own.
// (a hill: 0, as it always worked out: its own top over no ground below it read as "a storey up")
export function fogDefault(entities, room) { return room?.recipe && roomY(room.recipe) >= STOREY && (isTerrain(room.recipe) || !meetsGround(entities, room)) ? 0 : null; }
