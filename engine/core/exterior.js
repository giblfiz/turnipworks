// EXTERIORS ABOVE (2026-11-24; Harry on dev, Dragon Temple: "he can't see stuff on level 2 even when there's no roof ...
// we need some version of seeing the exterior of buildings that are up a level"; then: "there's a hidden sculpture on top
// of the pillar right out in front of the temple that shouldn't be hidden; it's standing out there right out in the open").
// docs/VERTICAL.md "Exteriors above". Pure data: no DOM, no three.js; the fog worker and the page run the same code.
//
// Sight is worked out one SIGHT LEVEL at a time (core/height.js levelY: the outdoor surface is 0, an upper storey its own
// floor). The fog's PICTURE is drawn by height: a fragment uses the mask of the highest BAND (a floor height) at or below
// it (fx/fogwar.js). Before this file the bands WERE the sight levels, so on a map with any upper storey everything 10 ft
// or more up (a temple on a 10-ft hill, a statue on a pillar, every roof) read the upper storey's mask, which only people
// standing upstairs ever write: checker. Now:
//
//  * BANDS are physical heights (bandsOf): every sight level, every room's floor and top (a roof sits on a top), hill tops.
//  * A band's mask is COMPOSED (bandParts): the sight level of that height, plus the exterior seen at that height (below),
//    plus, where a room spans the band but sees at another level (a hilltop room sees at 0; a tall room's upper half), that
//    room's own sight level inside its footprint, plus a hill's top (the outdoor surface) inside the hill, plus the roof
//    zone of a room you have been inside (its own level, where nothing spans the band there).
//  * THE EXTERIOR AT A BAND (key extKey(b) = b + 0.5, stored and remembered like any level): a pawn standing UNDER THE SKY
//    (underSky: no roofed room around it, nothing over it) sees, at every band above its feet, what a floor plan at that
//    height lets it see: everything standing at that height blocks (walls, doors and windows, shut OR open, glass too:
//    vision.js blockingSegments `exterior`), and nothing below it does (a one-storey house does not hide the temple's upper
//    storey behind it). The exterior never covers the inside of a roofed room spanning that band (coveredAt): those cells
//    are cleared after the raster, so an upper room's contents stay hidden until a pawn is in there, whatever got through.
//  * LOOKING DOWN (2026-11-24 later; Harry: "Line of sight down from a terrace should work too"): a pawn under the sky
//    standing above the ground (a terrace, a roof, a roof-off room, a hilltop) also sees every band below its own, as far
//    as its own band lets it see across (walls and parapets at its own height block, as for looking up); nothing lower
//    blocks (you look over it). What it never shows (blindAt): under a floor or a hill's earth higher up than that band,
//    so not through the slab you stand on; inside a roofed room (its roof is what you see). Kept in the same keys.
//  * A THING IS EXPOSED (underSky at its own height): outside every room, or in a room open to the sky (roof off, an
//    outdoor type), with nothing over it; standing on a pillar, a wall top or a roof counts. An exposed thing is known
//    when its own spot's exterior is (the centre, not its box: a box reaches through a wall). A thing under a roof or a
//    ceiling is ruled exactly as before (fog.js rule).
//
// What the cheap rule gets wrong (rooms are the only cover it knows): a canopy, pergola or tent that is a placed OBJECT
// covers nothing; eaves that overhang a wall cover nothing past the wall line; a pawn indoors on the ground floor looking
// out of a window sees no exteriors above (only pawns under the sky look up); bars, glass and open doors block the
// exterior although they pass sight on the pawn's own level. In a dark area there is no exterior sight yet.
import { roomY, roomTop, isTerrain, levelY } from './height.js';
import { contains } from './footprint.js';

export const EXT = 0.5;
export const extKey = (band) => band + EXT;
const frac = (k) => { const f = Number(k) % 1; return f < 0 ? f + 1 : f; };
export const isExtKey = (k) => Math.abs(frac(k) - EXT) < 1e-6;
// HOLES (2026-11-25; Harry: "you SHOULD be able to see down into it based on line of sight"). Two more keys per band:
//   b + 0.25  THROUGH AN OPENING: the part of the floor below a hole (or a through pit) that a pawn at its edge sees through
//             it (client/vision.js: the opening's cone, clipped to the lower level's walls); kept like any level
//   b + 0.75  AT ITS FEET: where two rooms of one sight level overlap at different heights (a hall on a hill and a passage
//             dug into the hill under it: both see at 0; vision.js stackedOverlaps), a level cell there would mean both,
//             so no pawn's level sight is kept there; each pawn's is kept again here, at the band of its feet
export const HOLE = 0.25, FEET = 0.75;
export const holeKey = (band) => band + HOLE, feetKey = (band) => band + FEET;
export const isSideKey = (k) => frac(k) > 1e-6; // any of the three (not a sight level)
export const bandIn = (bands, y) => { let b = bands?.[0] ?? 0; for (const v of bands || []) if (y + 0.08 >= v) b = v; return b; };
export const MAX_BANDS = 16; // fx/fogwar.js packs at most 16 levels

const BUILT = new WeakMap(); // (per entity map: the page asks underSky for many things and wall samples each refresh)
const builtRooms = (E) => { if (!E) return []; let r = BUILT.get(E); if (!r) BUILT.set(E, r = Object.values(E).filter(e => e?.kind === 'room' && e.recipe && !isTerrain(e.recipe))); return r; };
// a room SPANS a height when its floor is at or below it and its top is above it
export const spans = (E, r, b) => roomY(r.recipe) <= b + 1e-6 && roomTop(E, r) > b + 1e-6;

// UNDER THE SKY at (x, z) at height y: no built room there reaches above y, except one y is IN that is open to the sky.
export function underSky(E, x, z, y = 0, isOpen = null) {
  for (const r of builtRooms(E)) {
    if (!contains(r.recipe, x, z)) continue;
    if (roomTop(E, r) <= y + 0.5) continue; // under the thing, or the thing stands on its top (a roof, a deck)
    if (roomY(r.recipe) <= y + 0.5 && isOpen?.(r)) continue; // in it, and nothing roofs it
    return false;
  }
  return true;
}

// THE BANDS of a map: floor heights the fog's picture is cut into (sorted). `extra`: the sight levels of the pawns.
export function bandsOf(E, extra = []) {
  const s = new Set([0, ...extra.filter(Number.isFinite)]);
  for (const e of Object.values(E || {})) {
    if (e?.kind !== 'room' || !e.recipe) continue;
    if (isTerrain(e.recipe)) { const t = roomY(e.recipe); if (t > 0) s.add(t); continue; }
    s.add(levelY(E, e)); s.add(roomY(e.recipe)); s.add(roomTop(E, e));
  }
  let out = [...s].sort((a, b) => a - b);
  // more than the picture can hold: keep every sight level and the lowest heights, drop the highest roof-only bands
  if (out.length > MAX_BANDS) { const keep = new Set([0, ...extra]); for (const e of builtRooms(E)) keep.add(levelY(E, e)); const must = out.filter(b => keep.has(b)); out = [...new Set([...must, ...out.filter(b => !keep.has(b)).slice(0, Math.max(0, MAX_BANDS - must.length))])].sort((a, b) => a - b).slice(0, MAX_BANDS); }
  return out;
}

// the ROOFED rooms spanning band b: no exterior is ever kept inside them
export const coveredAt = (E, b, isOpen = null) => builtRooms(E).filter(r => spans(E, r, b) && !isOpen?.(r));
// WHAT THE OUTSIDE AT BAND b NEVER HOLDS (LOOKING DOWN, 2026-11-24 later; Harry: "Line of sight down from a terrace should
// work too"): the inside of a roofed room spanning it (you see its roof, not its contents), and what lies under a floor or
// a hill's earth higher up (a floor slab or the hill you stand on hides what is directly beneath it: you see past its
// edge, not through it). Conservative: a floor hides what is under it from every viewer, above or below it.
const BLIND = new WeakMap();
export function blindAt(E, b, isOpen = null) {
  let m = BLIND.get(E || {}); if (!m && E) BLIND.set(E, m = new Map()); const k = String(b);
  if (m?.has(k)) return m.get(k);
  const out = [...coveredAt(E, b, isOpen), ...builtRooms(E).filter(r => roomY(r.recipe) > b + 1e-6 && !spans(E, r, b)),
    ...Object.values(E || {}).filter(e => e?.kind === 'room' && isTerrain(e.recipe) && roomY(e.recipe) > b + 1e-6)];
  m?.set(k, out); return out;
}

// WHAT BAND b's MASK IS MADE OF: [{ key, within?: [room], hills?: [hill], minus?: [room] }] ("within": only inside those
// footprints; "minus": not inside those). The masks (client/fog-grid.js maskLevels) union the parts.
export function bandParts(E, b, isOpen = null) {
  const parts = [{ key: b }, { key: extKey(b), minus: blindAt(E, b, isOpen) }, { key: holeKey(b) }, { key: feetKey(b) }];
  const rooms = builtRooms(E), spanning = rooms.filter(r => spans(E, r, b)), byLevel = new Map(), roofs = new Map();
  for (const r of spanning) { const L = levelY(E, r); if (L !== b) { if (!byLevel.has(L)) byLevel.set(L, []); byLevel.get(L).push(r); } }
  for (const [L, within] of byLevel) parts.push({ key: L, within });
  const hills = Object.values(E || {}).filter(e => e?.kind === 'room' && isTerrain(e.recipe) && roomY(e.recipe) === b && b !== 0);
  if (hills.length) parts.push({ key: 0, within: hills });
  // the roof zone of a roofed room whose top is this band: known as far as its inside is (you have stood in it)
  for (const r of rooms) if (b !== 0 && Math.abs(roomTop(E, r) - b) < 1e-6 && !isOpen?.(r)) { const L = levelY(E, r); if (!roofs.has(L)) roofs.set(L, []); roofs.get(L).push(r); }
  for (const [L, within] of roofs) parts.push({ key: L, within, minus: spanning });
  return parts;
}
