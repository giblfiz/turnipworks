// CAVES (2026-10-25; docs/VERTICAL.md "Caves"; Harry, after the caves pilot: "looks a lot more like a cave. Add a few
// pillars, stalagmites and such, and let's push it into the game!"). A CAVE is a room of the type `cave` whose walls are
// natural rock (its wall family 'auto', or 'cave-rock'): drawn with the room tool, below the ground by default (lv -1,
// y = -10), its walls the pilot's overlapping generated rock chunks instead of a wall kit.
//
// WHAT IS STORED: the room, as any room (type, x, z, w, d, y, seed, and its OUTLINE). The jagged outline (the pilot's
// jagCells: sides stepping in and out by whole squares) is worked out ONCE, when the cave is made (caveShape below), and
// stored as the room's outline, so a later change to the rule never reshapes a saved cave, and the squares a pawn can
// stand on are plain room squares everywhere (fog regions, the pointer, the layout solver, the export).
// (Since 2026-10-27 the STALAGMITES are stored too: ordinary things of the room, placed by the rule once; see
// STALAG_CAT below.)
// WHAT IS DERIVED (never stored): everything else, by the pilot's rule (core/caverule.js, a byte copy of
// experiments/2026-10-05-caves/viewer/cave.js; engine/tools/sync_cave_rule.mjs keeps it so) from the stored squares and
// the room's `seed`: the chunks along the outline, the corner columns, the rubble, the PILLARS (whole squares of rock
// standing in the cave: they block sight, and nothing stands on them), where the stalagmites go (made into things once,
// see STALAG_CAT; drawn as rock only for a cave from before 2026-10-27 not yet converted), the rock face behind the chunks and the lip where the ground above is cut open; then one step of the game's own
// (keepOutOfFloor, below: no chunk's measured footprint over a floor square). Every seat, the relay and the tests
// work it out the same; "Re-roll" (a new seed) rearranges the rock and keeps the shape.
//
// Pure data, no three.js, no DOM: the relay and the browser run the same code.
import { CELL, placeCave, rockEdge } from './caverule.js';
import { KIT, POOL } from './cavekit.js';
import { PROFILES, PROFILE_BIN } from './cavehulls.js';
import { cellsOf, rectsOf, traceOutline, hasCell } from './footprint.js';

export const CAVE_TYPES = new Set(['cave']);
export const CAVE_FAMILY = 'cave-rock';
export const CAVE_DEPTH = -10; // a new cave's floor: one storey under the ground (lv -1)
// The pilot's settings as Harry approved them (the page's defaults, 2026-10-25), except the wall top: in the game the
// cave's floor is 10 ft under the ground, so the chunks reach about 10.6 ft and stand up out of the ground's cut edge as
// a lumpy rim, the way the pilot's stood up out of its flat rock top.
export const CAVE_P = Object.freeze({ overlap: 0.3, push: 0.3, turn: 20, wander: 6, jag: 0.7, pillars: 1, stalag: 1, rubble: 0.55, topH: 10.6 });
// where the ground above is cut open (the LIP: feet behind the wandering line the chunks stand on, so their fronts show
// from above and their tops come up through the ground) and where the rock face stands (behind the chunks, so a gap
// between two of them shows rock, not a slot into the dark), each with a little raggedness (the pilot's rockEdge)
export const LIP_BACK = 0.6, LIP_RAGGED = 0.6, FACE_BACK = 1.5, FACE_RAGGED = 1.2;
export const OUTLINE_MAX = 200;
export const PILLAR_SIGHT_R = 1.7; // ft: the octagon a pillar stops sight with (inside its rock) // points (core/footprint.js outlineProblem): a jagged cave has many corners

export const isCave = (rc) => !!rc && CAVE_TYPES.has(rc.type) && (!rc.wallFamily || rc.wallFamily === 'auto' || rc.wallFamily === CAVE_FAMILY);
export const isCaveRoom = (e) => e?.kind === 'room' && isCave(e.recipe);
const k2 = (i, j) => `${i},${j}`;
const roomYOf = (rc) => rc?.y || 0;
// the pieces the rule may stand: those the kit measured
const pool = () => POOL;

// the room as the rule's rectangles (world cells [i, j, w, d]); null when they do not cover its squares
function rectsOfRoom(rc) {
  const rs = rectsOf(rc, 24).map(r => [rc.x + r.i, rc.z + r.j, r.w, r.d]);
  const n = rs.reduce((a, r) => a + r[2] * r[3], 0);
  return n === cellsOf(rc).length ? rs : null;
}
// the room's squares as the rule's keys ("i,j", world cells)
export function caveCells(rc) { const s = new Set(); for (const [i, j] of cellsOf(rc)) s.add(k2(rc.x + i, rc.z + j)); return s; }
// the cave's edges with another room on the other side at the same height: no rock there (the rule's `open` edges)
export function openEdges(entities, room) {
  const rc = room.recipe, y = roomYOf(rc), others = Object.values(entities || {}).filter(e => e.kind === 'room' && e.id !== room.id && e.recipe && roomYOf(e.recipe) === y);
  if (!others.length) return [];
  const out = [];
  for (const [i0, j0] of cellsOf(rc)) {
    const i = rc.x + i0, j = rc.z + j0;
    for (const [side, a, b] of [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]]) {
      if (hasCell(rc, i + a, j + b)) continue;
      if (others.some(o => hasCell(o.recipe, i + a, j + b))) out.push(`${i},${j},${side}`);
    }
  }
  return out;
}

// THE CAVE, worked out: { cells (floor squares, pillars taken out), pillarCells, placements, faceLoops, lipLoops, box, y }
// placements: the rule's, in world feet (x, z; y over the cave's floor), rot = three.js rotation.y; roles wall, rubble,
// corner-in, corner-out, pillar (a kit piece id), stalagmite (a library mesh file, its height h).
const CACHE = new Map();
export function caveOf(entities, room) {
  const rc = room.recipe, open = openEdges(entities, room), seed = rc.seed | 0;
  const key = JSON.stringify([rc.x, rc.z, rc.w, rc.d, rc.outline || null, roomYOf(rc), seed, open]);
  let C = CACHE.get(key);
  if (C) return C;
  const rects = rectsOfRoom(rc) || cellsOf(rc).map(([i, j]) => [rc.x + i, rc.z + j, 1, 1]);
  const P = { ...CAVE_P, seed }, r = placeCave({ rects, open }, KIT, P, pool(), caveCells(rc));
  const pushed = keepOutOfFloor(r.placements, r.cells);
  const faceLoops = rockEdge(r.loops, P, FACE_BACK, FACE_RAGGED), lipLoops = rockEdge(r.loops, P, LIP_BACK, LIP_RAGGED);
  // SIGHT STOPS AT THE LIP, not at the grid line (2026-10-25: Gemini, a player's view: the rock "as disjointed floating
  // pieces" in the fog, because sight stopped at the grid line and the floor between it and the chunks stayed unexplored).
  // rockEdge gives 5 points per grid edge of each loop, in order; a stretch along an OPEN edge (a room beside the cave)
  // blocks nothing here: the wall engine's edge there (a wall, a doorway) does, on the grid line.
  const sight = [];
  r.loops.forEach((loop, li) => { const L = lipLoops[li], m = L.length; for (let k = 0; k < m; k++) { const e0 = loop[Math.floor(k / 5)], e1 = loop[Math.floor(((k + 1) % m) / 5)]; if (e0.open || e1.open) continue; const a = L[k], b = L[(k + 1) % m]; sight.push([a[0], a[1], b[0], b[1]]); } });
  const xs = lipLoops.flat().map(p => p[0]).concat(faceLoops.flat().map(p => p[0])), zs = lipLoops.flat().map(p => p[1]).concat(faceLoops.flat().map(p => p[1]));
  C = { id: room.id, y: roomYOf(rc), seed, cells: r.cells, pillarCells: r.pillarCells || [], placements: r.placements, pushed, faceLoops, lipLoops, open, sight,
    box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] };
  if (CACHE.size > 64) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, C);
  return C;
}
export const cavesOf = (entities) => Object.values(entities || {}).filter(isCaveRoom).map(e => caveOf(entities, e));

// STALAGMITES ARE THINGS (2026-10-27; Harry: "are you not letting me select the stalagmites in caves? is there a reason
// they are not objects?"). The rule still says WHERE they go (its 'stalag' stream, unchanged), but only once: when the
// cave is made, and at a re-roll. Each spot becomes an ordinary object of the room (the library's own `stalagmite`,
// its sku, as tall as the rule asked), made in the same command as the room (core/roomgen.js solve), so it is the GM's
// to select, move, turn, delete and copy. A cave whose stalagmites are things carries `recipe.stalagObjects`; a cave
// without it (one made before 2026-10-27, not yet converted: core/migrate.js migrateCaves) still DRAWS the rule's
// stalagmites as rock (client/caves.js), so none is ever lost. Each such thing carries `fromCave` until the GM moves,
// turns or resizes it (core/commands.js): a re-roll replaces the cave's own and keeps everything else in it.
export const STALAG_CAT = 'stalagmite';
export const stalagObjectsOf = (rc) => !!rc?.stalagObjects;
export const caveStalagmites = (entities, room) => caveOf(entities, room).placements.filter(p => p.role === 'stalagmite');

// NO ROCK IN A FLOOR SQUARE, EXACTLY (2026-10-25). The pilot's rule stands each chunk out by its measured reach, allowing
// for its turn; over 400 caves the real meshes still reached into a floor square 23 times in 23,583 pieces (19 of them
// rubble, which the rule turns by up to 20 degrees at a join near a corner; up to 0.93 ft; engine/tools/cave_measure.mjs).
// So the game checks every wall chunk and rubble against its piece's measured footprint (core/cavehulls.js: the profile
// in plan from the floor to head height, from the game's own meshes) and steps it straight out from its wall, a tenth of
// a foot at a time, until no part of it is over a floor square. Most pieces never move. -> how many were moved
const FLOOR_EPS = 0;
export function overFloor(p, cells) {
  const Pf = PROFILES[p.id]; if (!Pf) return false;
  const c = Math.cos(p.rot), s = Math.sin(p.rot), sx = p.scale[0], sz = p.scale[2], h = PROFILE_BIN / 2;
  const on = (lx, lz) => { lx *= sx; lz *= sz; const x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c, i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    if (!cells.has(k2(i, j))) return false; return Math.min(x - i * CELL, (i + 1) * CELL - x, z - j * CELL, (j + 1) * CELL - z) > FLOOR_EPS; };
  for (const [x, lo, hi] of Pf) for (const lx of [x - h, x + h]) { const n = Math.max(1, Math.ceil((hi - lo) / 0.5)); for (let q = 0; q <= n; q++) if (on(lx, lo + (hi - lo) * q / n)) return true; }
  return false;
}
// (A step out from its wall is tried first, up to 1.5 ft; a piece that crosses a corner into the next wall's squares is
// slid along its own wall instead, up to 2.5 ft either way; one that fits neither way is left out: the rock face stands
// behind it. Never further out than that: a piece pushed far could reach the floor on the far side of a thin rock.)
function keepOutOfFloor(placements, cells) {
  let moved = 0;
  for (let n = placements.length - 1; n >= 0; n--) {
    const p = placements[n];
    if ((p.role !== 'wall' && p.role !== 'rubble') || !p.out || !overFloor(p, cells)) continue;
    const x0 = p.x, z0 = p.z, [ox, oz] = p.out, dx = -oz, dz = ox; moved++;
    let ok = false;
    for (let k = 1; k <= 15 && !ok; k++) { p.x = x0 + ox * k * 0.1; p.z = z0 + oz * k * 0.1; if (!overFloor(p, cells)) { ok = true; p.moved = ['out', +(k * 0.1).toFixed(1)]; } }
    for (let k = 1; k <= 10 && !ok; k++) for (const sg of [1, -1]) { if (ok) break; p.x = x0 + dx * sg * k * 0.25; p.z = z0 + dz * sg * k * 0.25; if (!overFloor(p, cells)) { ok = true; p.moved = ['along', +(sg * k * 0.25).toFixed(2)]; } }
    if (!ok) placements.splice(n, 1);
  }
  return moved;
}

// THE SHAPE OF A NEW CAVE (made once, at creation): the drawn rectangle (or the shape the room tool left of it) with
// its sides stepped in and out by whole squares (the pilot's jag, 0.7). `taken(gx, gz)`: a square another room at that
// height already stands on; a jag that would reach one is not used (the next seed's is tried; after six, the shape as
// drawn). -> { x, z, w, d, outline?, seed } (outline in the room's own cells, as core/footprint.js stores it)
export function caveShape(drawn, seed, taken = () => false) {
  const rc = { x: drawn.x, z: drawn.z, w: drawn.w, d: drawn.d, ...(drawn.outline && { outline: drawn.outline }) };
  const rects = rectsOfRoom(rc);
  if (rects) for (let k = 0; k < 6; k++) {
    const s = (seed + k * 7919) % 1000000, r = placeCave({ rects, open: [] }, KIT, { ...CAVE_P, seed: s }, pool());
    const cells = [...r.cells].map(c => c.split(',').map(Number)).concat(r.pillarCells || []);
    if (cells.some(([i, j]) => !hasCell(rc, i, j) && taken(i, j))) continue;
    const x = Math.min(...cells.map(c => c[0])), z = Math.min(...cells.map(c => c[1])), w = Math.max(...cells.map(c => c[0])) - x + 1, d = Math.max(...cells.map(c => c[1])) - z + 1;
    const outline = traceOutline(cells.map(([i, j]) => [i - x, j - z]));
    if (!outline || outline.length > OUTLINE_MAX) continue;
    return { x, z, w, d, ...(cells.length !== w * d && { outline }), seed: s, jagged: true };
  }
  return { ...rc, seed, jagged: false };
}

// WHAT A CAVE ADDS TO SIGHT (client/vision.js blockingSegments), at the cave's level: its LIP (where the rock band
// between the grid line and the solid rock ends: so a player sees the chunks' fronts and the floor under them, as the
// pilot drew it, and nothing beyond), less the stretches along open edges, and every pillar as an octagon a little
// INSIDE its rock (radius PILLAR_SIGHT_R; the column is about 4.5 ft across): sight reaches the pillar's own surface, so
// fog of war never paints over a pillar that is in plain view (Gemini 2026-10-25: pillars "with the checkerboard" when
// the whole square stopped sight), and nothing behind it is seen.
// The wall engine's edges along the cave's outline that face rock (isCaveRockEdge) then block nothing.
export function caveBlockers(entities, level, { pillars = true, lip = true } = {}) {
  const out = [];
  for (const e of Object.values(entities || {})) {
    if (!isCaveRoom(e) || roomYOf(e.recipe) !== level || e.hidden) continue;
    const C = caveOf(entities, e);
    if (lip) for (const s of C.sight) out.push(s);
    if (pillars) for (const [i, j] of C.pillarCells) { const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL; for (let k = 0; k < 8; k++) { const a0 = (k + 0.5) * Math.PI / 4, a1 = (k + 1.5) * Math.PI / 4; out.push([cx + PILLAR_SIGHT_R * Math.cos(a0), cz + PILLAR_SIGHT_R * Math.sin(a0), cx + PILLAR_SIGHT_R * Math.cos(a1), cz + PILLAR_SIGHT_R * Math.sin(a1)]); } }
  }
  return out;
}
// is this wall-engine edge a cave's outside wall facing rock? (one side, a wall, its room a cave: its rock and its lip
// stand for it, for sight and for drawing)
export const isCaveRockEdge = (entities, e) => !!e && (e.sides || []).length === 1 && (e.kind === 'wall' || e.kind === 'window') && !e.open && isCave(entities?.[e.owner?.room ?? e.sides?.[0]?.room]?.recipe);
// is (x, z) on a pillar of a cave at height y? (a pillar square is rock: no floor, nothing stands there)
export function onPillar(entities, x, z, y) {
  const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL);
  for (const e of Object.values(entities || {})) if (isCaveRoom(e) && roomYOf(e.recipe) === y && hasCell(e.recipe, gx, gz) && caveOf(entities, e).pillarCells.some(([i, j]) => i === gx && j === gz)) return e;
  return null;
}
// the lips of the caves the ground is opened over (world.js rebuildGround), in feet: [{ id, loops, box }]
export const lipsOf = (entities, ids) => cavesOf(entities).filter(c => ids.has(c.id)).map(c => ({ id: c.id, loops: c.lipLoops, box: c.box }));

// THE SOLID GROUND OF A BOX WITH HOLES, as strips (the ground's cut over a cave, world.js): rows `dz` feet deep, each
// the box less the inside of any loop (even-odd, at the row's middle) less the `openCell(gx, gz)` squares. -> [[x0, z0,
// x1, z1], ...] quads. Pure, so the test can check it: no strip reaches inside a lip, and outside every lip nothing is lost.
export function solidStrips(box, loops, openCell = () => false, dz = 0.25) {
  const [x0, z0, x1, z1] = box, out = [];
  for (let z = z0; z < z1 - 1e-9; z += dz) {
    const zt = Math.min(z1, z + dz), zm = (z + zt) / 2, xs = [];
    for (const L of loops) for (let a = 0, n = L.length; a < n; a++) {
      const p = L[a], q = L[(a + 1) % n];
      if ((p[1] > zm) !== (q[1] > zm)) xs.push(p[0] + (zm - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((a, b) => a - b);
    // the box's span less the holes' spans
    let spans = [[x0, x1]];
    for (let k = 0; k + 1 < xs.length; k += 2) spans = spans.flatMap(([a, b]) => { const lo = Math.max(a, xs[k]), hi = Math.min(b, xs[k + 1]); return hi <= lo ? [[a, b]] : [[a, lo], [hi, b]].filter(([u, v]) => v - u > 1e-6); });
    // less the open squares on this row
    const gz = Math.floor(zm / CELL);
    spans = spans.flatMap(([a, b]) => { const r = []; let s = a; for (let gx = Math.floor(a / CELL); gx * CELL < b; gx++) { if (!openCell(gx, gz)) continue; const lo = Math.max(s, gx * CELL), hi = Math.min(b, (gx + 1) * CELL); if (hi > lo) { if (lo > s) r.push([s, lo]); s = hi; } } if (b > s) r.push([s, b]); return r; });
    for (const [a, b] of spans) out.push([a, z, b, zt]);
  }
  return out;
}
