// node test/caves.test.mjs : CAVES IN THE GAME (2026-10-25; Harry, after the caves pilot: "looks a lot more like a
// cave. Add a few pillars, stalagmites and such, and let's push it into the game!"). docs/VERTICAL.md "Caves".
// What is checked, on the pure code the browser and the relay share (core/caves.js, core/caverule.js):
//   one rule     the engine's copy of the pilot's rule and measurements is the pilot's, byte for byte
//   stored       a new cave's jagged shape is worked out once and stored as its outline; drawing it again never reshapes it
//   derived      the rock is worked out from the stored squares and the seed, the same every time; a re-roll moves the
//                rock and keeps the squares; a room beside it leaves that wall open
//   pawns        no rock in a floor square below head height (the pilot measured mesh vertices; here, every chunk's front)
//   blocking     pillars are whole squares taken out of the floor, and they stop sight (vision.js)
//   the ground   the ground over a cave is cut along its lip: nothing of the lid inside it, nothing lost outside it
//   things       (2026-10-27) a new cave's stalagmites are things of the room, at the rule's spots, in the same command
//                (one undo); a moved one stays through a re-roll, its own follow; an old cave converts once, the same spots
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CV from '../core/caves.js';
import { KIT, POOL } from '../core/cavekit.js';
import { placeCave, CELL } from '../core/caverule.js';
import { outlineProblem, cellsOf, hasCell } from '../core/footprint.js';
import { blockingSegments, computeVision, visibleAt } from '../client/vision.js';
import { kitModule, ruleText, RULE_DST, KIT_DST } from '../tools/sync_cave_rule.mjs';
import { applyArea, inverseOf } from '../core/commands.js';
import { newArea } from '../core/state.js';
import { migrateCaves, caveStalagId } from '../core/migrate.js';
import { loadRoomgen } from '../relay/server.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const HERE = path.dirname(fileURLToPath(import.meta.url));

// 1. ONE RULE
ok('core/caverule.js is the pilot\'s cave.js, byte for byte (node engine/tools/sync_cave_rule.mjs)', fs.readFileSync(RULE_DST, 'utf8') === ruleText());
ok('core/cavekit.js is the pilot\'s kit.json and POOL', fs.readFileSync(KIT_DST, 'utf8') === await kitModule());
ok('the pool names pieces the kit measured (walls, column, rubble)', [...POOL.walls, POOL.column, POOL.rubble].every(id => KIT[id]?.size_ft), POOL);
ok('the pool has the library stalagmites', (POOL.stalagmites || []).length === 2, POOL.stalagmites);

// 2. WHAT A CAVE IS
ok('a cave room is a cave (walls by type)', CV.isCave({ type: 'cave', wallFamily: 'auto' }) && CV.isCave({ type: 'cave' }) && CV.isCave({ type: 'cave', wallFamily: 'cave-rock' }));
ok('a cave given hewn walls is not drawn as natural rock', !CV.isCave({ type: 'cave', wallFamily: 'cut-rock' }));
ok('a dungeon room is not a cave', !CV.isCave({ type: 'dun-corridor' }) && !CV.isCave(null));

// 3. THE SHAPE, MADE ONCE
const shapes = [];
for (const [w, d] of [[7, 5], [8, 6], [12, 9], [16, 16], [4, 4], [2, 8]]) for (const seed of [1, 2, 3, 77, 4242]) shapes.push({ w, d, seed, S: CV.caveShape({ x: 10, z: -4, w, d }, seed) });
const bad = shapes.filter(({ S }) => outlineProblem(S));
ok('every new cave shape is a valid room outline (30 shapes)', !bad.length, bad.slice(0, 2).map(b => [b.w, b.d, b.seed, outlineProblem(b.S)]));
ok('most are jagged (the sides step in and out)', shapes.filter(s => s.S.jagged && s.S.outline).length >= 24, shapes.filter(s => s.S.jagged && s.S.outline).length);
const long = shapes.map(s => s.S.outline?.length || 4).sort((a, b) => b - a)[0];
ok('outlines may have more than 64 points (the limit is 200 now)', long <= CV.OUTLINE_MAX, long);
ok('the same drawing and seed make the same shape', JSON.stringify(CV.caveShape({ x: 10, z: -4, w: 12, d: 9 }, 77)) === JSON.stringify(shapes.find(s => s.w === 12 && s.seed === 77).S));
ok('another seed makes another shape', JSON.stringify(CV.caveShape({ x: 10, z: -4, w: 12, d: 9 }, 78).outline) !== JSON.stringify(shapes.find(s => s.w === 12 && s.seed === 77).S.outline));
const narrow = shapes.filter(s => s.w === 2);
ok('a tunnel 2 squares wide keeps its straight sides (the rule never jags a tunnel)', narrow.every(s => !s.S.outline && s.S.w === 2 && s.S.d === 8), narrow.map(s => [s.S.w, s.S.d]));
// a jag never takes a square another room stands on
const takenSet = new Set(); for (let gz = -10; gz < 20; gz++) takenSet.add(`${22},${gz}`).add(`${23},${gz}`); // a room along x = 22..23, right beside a cave drawn at x 10..21
const T = (gx, gz) => takenSet.has(`${gx},${gz}`);
let reach = 0;
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const S = CV.caveShape({ x: 10, z: 0, w: 12, d: 8 }, seed, T); for (const [i, j] of cellsOf(S)) if (T(S.x + i, S.z + j)) reach++; }
ok('a jag never steps onto a square another room stands on', reach === 0, reach);

// 4. DERIVED, NOT STORED
const cave = (id, S, y = -10, extra = {}) => ({ id, kind: 'room', order: 1, recipe: { type: 'cave', x: S.x, z: S.z, w: S.w, d: S.d, ...(S.outline && { outline: S.outline }), y, seed: S.seed, wallSeed: 1, wallFamily: 'auto', floor: 'auto', ...extra } });
const S1 = CV.caveShape({ x: 0, z: 0, w: 9, d: 7 }, 31);
const R1 = cave('room_c1', S1), E1 = { room_c1: R1 };
const C1 = CV.caveOf(E1, R1);
const stored = new Set(cellsOf(R1.recipe).map(([i, j]) => `${R1.recipe.x + i},${R1.recipe.z + j}`));
const derivedAll = new Set([...C1.cells, ...C1.pillarCells.map(([i, j]) => `${i},${j}`)]);
ok('drawing a saved cave uses its stored squares exactly (floor + pillars = its outline)', derivedAll.size === stored.size && [...stored].every(k => derivedAll.has(k)), [derivedAll.size, stored.size]);
const again = placeCave({ rects: [[0, 0, 1, 1]], open: [] }, KIT, { ...CV.CAVE_P, seed: S1.seed, jag: 1 }, POOL, CV.caveCells(R1.recipe));
ok('the stored squares are not jagged again, whatever the jag setting', again.cells.size === C1.cells.size && JSON.stringify(again.placements) === JSON.stringify(C1.placements));
ok('the rock is the same every time (a second seat works out the same)', JSON.stringify(CV.caveOf({ room_c1: cave('room_c1', S1) }, cave('room_c1', S1)).placements) === JSON.stringify(C1.placements));
const roles = {}; for (const p of C1.placements) roles[p.role] = (roles[p.role] || 0) + 1;
ok('a cave has wall chunks, corner columns, rubble, pillars and stalagmites', roles.wall > 10 && (roles['corner-in'] || 0) + (roles['corner-out'] || 0) >= 4 && roles.rubble > 0 && roles.pillar >= 1 && roles.stalagmite > 4, roles);
const Rr = cave('room_c1', { ...S1, seed: S1.seed + 1 }), Cr = CV.caveOf({ room_c1: Rr }, Rr);
ok('a re-roll (a new seed) moves the rock and keeps the squares', JSON.stringify(Cr.placements) !== JSON.stringify(C1.placements) && cellsOf(Rr.recipe).length === cellsOf(R1.recipe).length);
// a room beside it at the same height: that wall is open (no rock), and it is not open at another height
const side = (y) => ({ id: 'room_d', kind: 'room', order: 2, recipe: { type: 'dun-corridor', x: R1.recipe.x + R1.recipe.w, z: R1.recipe.z, w: 2, d: R1.recipe.d, y, seed: 5 } });
const Eo = { room_c1: R1, room_d: side(-10) }, Co = CV.caveOf(Eo, R1);
ok('a room beside the cave at its height: the walls they share are open', Co.open.length > 0 && Co.open.every(k => k.endsWith(',E')), Co.open.length);
ok('... and the rock there is gone (fewer chunks)', Co.placements.filter(p => p.role === 'wall').length < roles.wall, [Co.placements.filter(p => p.role === 'wall').length, roles.wall]);
ok('a room beside it on another level changes nothing', CV.caveOf({ room_c1: R1, room_d: side(0) }, R1).open.length === 0);

// 5. PAWNS: no rock in a floor square below head height. Every wall chunk's front (the measured reach of its piece,
// across 80% of its width; rubble's across its middle 40%), turned and scaled as placed, stands outside every floor
// square (browser_caves.py measures the real mesh vertices, as the pilot did); pillars stand on their
// own square; stalagmites stand on floor squares, never on a pillar.
const floorAt = (C, x, z) => C.cells.has(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
let worst = 0, tested = 0, stalOff = 0, pillarOff = 0, intrude = [];
for (const S of shapes.map(s => s.S).slice(0, 18)) {
  const R = cave('room_t', S), C = CV.caveOf({ room_t: R }, R);
  for (const p of C.placements) {
    if (p.role === 'stalagmite') { if (!floorAt(C, p.x, p.z)) stalOff++; continue; }
    if (p.role === 'pillar') { const [i, j] = p.cell; if (Math.hypot(p.x - (i + 0.5) * CELL, p.z - (j + 0.5) * CELL) > 2.6) pillarOff++; continue; }
    if (p.role !== 'wall' && p.role !== 'rubble') continue;
    const k = KIT[p.id], u = p.scale[2], reachFt = Math.max(k.front_reach_ft.foot_max, k.front_reach_ft.mid_max) * u, hw = k.half_width_ft.all * p.scale[0];
    for (const t of p.role === 'wall' ? [-0.8, -0.4, 0, 0.4, 0.8] : [-0.4, 0, 0.4]) { // (rubble is a low rounded heap: its box's corners are not rock; the browser test measures its real vertices)
      const lx = t * hw, lz = reachFt, c = Math.cos(p.rot), s = Math.sin(p.rot), x = p.x + lx * c + lz * s, z = p.z - lx * s + lz * c; tested++;
      if (floorAt(C, x, z)) { intrude.push([p.role, p.id, +x.toFixed(1), +z.toFixed(1)]); worst++; }
    }
  }
}
ok(`no chunk's front reaches into a floor square (${tested} front points, 18 caves)`, worst === 0, intrude.slice(0, 4));
ok('every stalagmite stands on a floor square (not on rock, not on a pillar)', stalOff === 0, stalOff);
{ // the game's guard (2026-10-25): over 200 caves, no wall chunk or rubble's measured footprint (core/cavehulls.js) is over a floor square
  let over = 0, moved = 0, pieces = 0;
  for (const [w, d] of [[4, 4], [6, 4], [7, 5], [9, 7], [12, 9], [16, 12], [16, 16], [3, 10]]) for (let s = 0; s < 25; s++) {
    const S = CV.caveShape({ x: 0, z: 0, w, d }, 1000 + s * 37), R = cave('room_g', S), C = CV.caveOf({ room_g: R }, R); moved += C.pushed;
    for (const p of C.placements) if (p.role === 'wall' || p.role === 'rubble') { pieces++; if (CV.overFloor(p, C.cells)) over++; }
  }
  ok(`no wall chunk or rubble over a floor square by its measured footprint (200 caves, ${pieces} pieces; ${moved} stepped out, slid along or left out)`, over === 0 && moved > 0, over);
}
ok('every pillar stands on its own square', pillarOff === 0, pillarOff);

// 6. PILLARS BLOCK
ok('pillar squares are taken out of the floor', C1.pillarCells.every(([i, j]) => !C1.cells.has(`${i},${j}`) && hasCell(R1.recipe, i, j)));
ok('each pillar has floor all round it (it never closes a way through)', C1.pillarCells.every(([i, j]) => [-1, 0, 1].every(a => [-1, 0, 1].every(b => (!a && !b) || C1.cells.has(`${i + a},${j + b}`)))));
const segs = CV.caveBlockers(E1, -10, { lip: false });
ok('each pillar stops sight with an octagon inside its rock, at the cave\'s level', segs.length === 8 * C1.pillarCells.length && CV.caveBlockers(E1, 0).length === 0 && segs.every(([x, z]) => C1.pillarCells.some(([i, j]) => Math.abs(Math.hypot(x - (i + 0.5) * CELL, z - (j + 0.5) * CELL) - CV.PILLAR_SIGHT_R) < 1e-6)), segs.length);
const bs = blockingSegments([], E1, -10);
ok('vision.js blockingSegments carries the pillars and the lip', bs.length >= 4 + C1.sight.length * 0.5, [bs.length, C1.sight.length]);
{ // sight stops at the LIP: the rock band between the grid line and the solid rock is seen (the chunks' fronts and the floor under them), beyond the lip nothing
  const inside = (x, z) => { let c = false; for (const L of C1.lipLoops) for (let a = 0, b = L.length - 1; a < L.length; b = a++) { const [xa, za] = L[a], [xb, zb] = L[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; };
  const k0 = [...C1.cells].map(k => k.split(',').map(Number)).find(([i, j]) => !C1.cells.has(`${i},${j - 1}`) && !C1.pillarCells.some(([a, b]) => a === i && b === j - 1)); // a floor square on the cave's north edge
  const [i, j] = k0, pawn = { id: 'tok_b', kind: 'token', x: (i + 0.5) * CELL, z: (j + 0.5) * CELL, y: -10, owner: 'seat_p' };
  const V = computeVision({ entities: { ...E1, tok_b: pawn }, edges: [], viewer: 'seat_p', seats: [{ id: 'seat_p', role: 'player' }] });
  const band = [(i + 0.5) * CELL, j * CELL - 0.35], beyond = [(i + 0.5) * CELL, j * CELL - 12];
  ok('a pawn by the wall sees the rock band just past the grid line (inside the lip)', inside(...band) && visibleAt(V, ...band, -10), [k0, band]);
  ok('... and nothing beyond the lip (the solid rock)', !inside(...beyond) && !visibleAt(V, ...beyond, -10));
}
{ // along an open edge (a room beside the cave) the lip blocks nothing: the shared wall on the grid line does
  const xs = R1.recipe.x + R1.recipe.w; // the grid line the corridor shares, feet = xs * 5
  ok('no lip stretch stands in the doorway side (along an open edge)', Co.sight.every(([a, b, c, d]) => !(Math.abs((a + c) / 2 - xs * CELL) < 2.5 && Math.abs(a - c) < 1.5 && Co.open.some(k => { const [oi, oj] = k.split(',').map(Number); return (b + d) / 2 > oj * CELL && (b + d) / 2 < (oj + 1) * CELL; }))));
}
{ // a pawn west of a pillar does not see the square just east of it; it does see a square beside it
  const [pi, pj] = C1.pillarCells[0], px = (pi - 1 + 0.5) * CELL, pz = (pj + 0.5) * CELL;
  const pawn = { id: 'tok_a', kind: 'token', x: px, z: pz, y: -10, owner: 'seat_p' };
  const E = { ...E1, tok_a: pawn }, V = computeVision({ entities: E, edges: [], viewer: 'seat_p', seats: [{ id: 'seat_p', role: 'player' }] });
  ok('a pawn cannot see through a pillar', !visibleAt(V, (pi + 1 + 0.5) * CELL, (pj + 0.5) * CELL, -10) && visibleAt(V, (pi - 1 + 0.5) * CELL, (pj - 1 + 0.5) * CELL, -10), [pi, pj]);
}
ok('onPillar finds the pillar square, and nothing on a floor square', !!CV.onPillar(E1, (C1.pillarCells[0][0] + 0.5) * CELL, (C1.pillarCells[0][1] + 0.5) * CELL, -10) && !CV.onPillar(E1, ...[...C1.cells][0].split(',').map(v => (+v + 0.5) * CELL), -10));

// 7. THE GROUND OVER IT: cut along the lip
const lip = C1.lipLoops, box = [C1.box[0] - 5, C1.box[1] - 5, C1.box[2] + 5, C1.box[3] + 5];
const strips = CV.solidStrips(box, lip);
const inside = (x, z) => { let c = false; for (const L of lip) for (let a = 0, b = L.length - 1; a < L.length; b = a++) { const [xa, za] = L[a], [xb, zb] = L[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; };
let into = 0, lost = 0, probes = 0;
for (let k = 0; k < 4000; k++) { // probes on the strips' middle lines (where a strip is cut exactly), off the cut ends by a hair
  const rows = Math.floor((box[3] - box[1]) / 0.25), z = box[1] + ((k * 104729) % rows + 0.5) * 0.25, x = box[0] + ((k * 7919) % 1000 + 0.5) / 1000 * (box[2] - box[0]); probes++;
  const solid = strips.some(([a, b, c, d]) => x > a + 1e-6 && x < c - 1e-6 && z > b && z < d), hole = inside(x, z), edge = strips.some(([a, b, c, d]) => z > b && z < d && (Math.abs(x - a) < 1e-3 || Math.abs(x - c) < 1e-3));
  if (solid && hole) into++;
  if (!solid && !hole && !edge) lost++;
}
ok('the ground has no hole outside the lip', lost === 0, lost);
ok(`the ground covers nothing inside the lip (${probes} probes on the strips' middle lines)`, into === 0, into);
ok('the lip lies outside every floor square (the cut is never smaller than the cave)', [...C1.cells].every(k => { const [i, j] = k.split(',').map(Number); return inside((i + 0.5) * CELL, (j + 0.5) * CELL); }));
ok('the lip is within 10 ft of the grid outline (wander 6 ft + push and lip)', C1.box[0] >= R1.recipe.x * CELL - 10 && C1.box[2] <= (R1.recipe.x + R1.recipe.w) * CELL + 10, C1.box.map(v => +v.toFixed(1)));
const t0 = performance.now(); for (let k = 0; k < 10; k++) CV.caveOf({ r: cave('r', { ...S1, seed: 1000 + k }) }, cave('r', { ...S1, seed: 1000 + k })); const ms = (performance.now() - t0) / 10;
ok('working a cave out takes a few milliseconds', ms < 30, `${ms.toFixed(1)} ms`);

// 8. STALAGMITES ARE THINGS (2026-10-27; Harry: "are you not letting me select the stalagmites in caves? is there a
// reason they are not objects?"). Through the real room engine (the relay's), on the reducers every seat runs.
{
  const TUNER = path.join(HERE, '..', '..', 'tools', 'spawn-tuner');
  const rg = await loadRoomgen(path.join(TUNER, 'js'), path.join(TUNER, 'data'), { orientApi: null });
  const S = CV.caveShape({ x: 0, z: 0, w: 9, d: 7 }, 31), args = { id: 'room_cv1', type: 'cave', x: S.x, z: S.z, w: S.w, d: S.d, ...(S.outline && { outline: S.outline }), y: -10, seed: S.seed, floor: 'floor-cave-rock', building: 'bld_cv1' };
  const L = rg.solve({}, args, 1);
  const rule = CV.caveStalagmites({ room_cv1: cave('room_cv1', S) }, cave('room_cv1', S));
  const st = L.objects.filter(o => o.cat === CV.STALAG_CAT);
  ok('a new cave\'s layout has the rule\'s stalagmites as things, one per spot', L.stalagObjects && st.length === rule.length && rule.length > 4, [st.length, rule.length]);
  ok('... each exactly where the rule puts it, turned as it turns it, as tall as it asks', rule.every((p, k) => { const o = st[k]; return o && o.x === p.x && o.z === p.z && o.rot === p.rot && Math.abs(o.dims[1] - p.h) < 0.01 && o.sku === p.file.replace(/\.glb$/, '') && o.y === -10 && o.fromCave && o.place === 'floor'; }), st.slice(0, 2).map(o => [o.sku, o.x, o.z, o.dims]));
  let A = applyArea(newArea('area_t', 'T'), 'room.spawn', { ...args, engine: 'v2', layout: { hash: L.hash, summary: L.summary, objects: L.objects }, stalagObjects: true });
  const inRoom = (T) => Object.values(T.entities).filter(e => e.kind === 'object' && e.room === 'room_cv1' && e.cat === CV.STALAG_CAT);
  ok('one room.spawn makes the cave and its stalagmites (marked: they are things)', inRoom(A).length === rule.length && A.entities.room_cv1.recipe.stalagObjects === true, inRoom(A).length);
  const undo = inverseOf(newArea('area_t', 'T'), 'room.spawn', { ...args, layout: { hash: L.hash, objects: L.objects } });
  const U = applyArea(A, undo.type, undo.args);
  ok('one undo takes away the cave and every stalagmite', !U.entities.room_cv1 && Object.values(U.entities).filter(e => e.kind === 'object').length === 0);
  // the GM's: move one, delete one, put one of his own in, then re-roll
  const [m, d] = inRoom(A);
  A = applyArea(A, 'object.move', { id: m.id, x: m.x + 1.5, z: m.z, rot: m.rot });
  ok('a moved stalagmite is the GM\'s (no longer the cave\'s own)', !A.entities[m.id].fromCave && A.entities[m.id].x === m.x + 1.5);
  A = applyArea(A, 'object.delete', { id: d.id });
  ok('a stalagmite can be deleted like any thing', !A.entities[d.id]);
  A = applyArea(A, 'object.place', { id: 'obj_mine00001', cat: 'stalagmite', sku: 'stalagmite', name: 'stalagmite', x: 12, z: 12, y: -10, dims: [2, 2, 2], room: 'room_cv1' });
  A = applyArea(A, 'object.place', { id: 'obj_chest0001', cat: 'chest', name: 'chest', x: 17, z: 12, y: -10, dims: [3, 2, 2], room: 'room_cv1' });
  const L2 = rg.solve(A.entities, { id: 'room_cv1', type: 'cave', seed: S.seed + 1 }, A.entities.room_cv1.order, rg.pinnedOf(A.entities, 'room_cv1'));
  const R2 = applyArea(A, 'room.reroll', { id: 'room_cv1', seed: S.seed + 1, layout: { hash: L2.hash, summary: L2.summary, objects: L2.objects }, stalagObjects: true });
  const own = inRoom(R2).filter(o => o.fromCave), rule2 = CV.caveStalagmites(R2.entities, R2.entities.room_cv1);
  ok('a re-roll: the cave\'s own stalagmites follow (the new seed\'s spots, none of the old)', own.length > 0 && own.every(o => rule2.some(p => p.x === o.x && p.z === o.z)) && !own.some(o => A.entities[o.id]), [own.length, rule2.length]);
  ok('... the one the GM moved, his own stalagmite and his chest stay', !!R2.entities[m.id] && R2.entities[m.id].x === m.x + 1.5 && !!R2.entities.obj_mine00001 && !!R2.entities.obj_chest0001 && !R2.entities[d.id]);
  ok('... no new stalagmite lands on what stayed', !own.some(o => [R2.entities[m.id], R2.entities.obj_chest0001].some(k => Math.hypot(o.x - k.x, o.z - k.z) < 1.2)));
  const legacy = applyArea(A, 'room.reroll', { id: 'room_cv1', seed: S.seed + 1, layout: { hash: L2.hash, summary: '', objects: [] } });
  ok('a re-roll journaled before 2026-10-27 (no flag) replays as it did: every unpinned thing goes', inRoom(legacy).length === 0 && !legacy.entities.obj_chest0001);
  const pin = applyArea(A, 'entity.flag', { ids: [inRoom(A).find(o => o.fromCave).id], pinned: true }), pid = inRoom(A).find(o => o.fromCave).id;
  const L3 = rg.solve(pin.entities, { id: 'room_cv1', type: 'cave', seed: S.seed + 2 }, 1, rg.pinnedOf(pin.entities, 'room_cv1'));
  ok('a pinned stalagmite of the cave\'s own stays through a re-roll', !!applyArea(pin, 'room.reroll', { id: 'room_cv1', seed: S.seed + 2, layout: { hash: L3.hash, summary: '', objects: L3.objects }, stalagObjects: true }).entities[pid]);
  // AN OLD CAVE (made before 2026-10-27: no things, no mark): it still draws them; the relay converts it once
  const oldArgs = { ...args, id: 'room_old01', layout: { hash: 'x', summary: '', objects: [] } };
  const O = applyArea(newArea('area_o', 'O'), 'room.spawn', oldArgs), oldUndo = { inv: inverseOf(newArea('area_o', 'O'), 'room.spawn', oldArgs) };
  ok('an old cave carries no mark (its stalagmites are drawn as before)', !O.entities.room_old01.recipe.stalagObjects);
  const rt = { state: { areas: { area_o: O } }, undo: new Map([['area_o|seat_g', [oldUndo]]]), redo: new Map() };
  const make = (E, room, idOf) => rg.caveStalagObjects(E, room, { idOf });
  const M = migrateCaves(rt, make), Ec = rt.state.areas.area_o.entities, conv = Object.values(Ec).filter(e => e.kind === 'object' && e.room === 'room_old01');
  const ruleO = CV.caveStalagmites(O.entities, O.entities.room_old01);
  ok('converting: every spot the old cave drew becomes a thing, the same place, turn and height', M.caves === 1 && conv.length === ruleO.length && ruleO.every((p, k) => { const o = Ec[caveStalagId('room_old01', k)]; return o && o.x === p.x && o.z === p.z && o.rot === p.rot && Math.abs(o.dims[1] - p.h) < 0.01; }) && Ec.room_old01.recipe.stalagObjects, [M, conv.length, ruleO.length]);
  ok('... with fixed ids, so a second pass changes nothing', migrateCaves(rt, make).caves === 0 && Object.keys(rt.state.areas.area_o.entities).length === Object.keys(Ec).length);
  ok('... and the stored undo of its drawing takes the converted stalagmites away too', M.stored === 1 && conv.every(o => oldUndo.inv.args.set[o.id] === null) && Object.values(applyArea(rt.state.areas.area_o, oldUndo.inv.type, oldUndo.inv.args).entities).filter(e => e.kind !== 'area').length === 0);
  ok('without the room engine an old cave is left as it was (still drawn)', migrateCaves({ state: { areas: { area_o: O } } }, null).caves === 0);
  // where it runs: the relay's load (relay/campaign.js), on a campaign written before 2026-10-27
  const { CampaignRuntime } = await import('../relay/campaign.js'), { makeTokens } = await import('../relay/tokens.js'), os = await import('node:os');
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tw-caves-')), 'cmp_oldcave01'); fs.mkdirSync(dir, { recursive: true });
  const J = [
    { r: 1, at: 1, by: null, genesis: { id: 'cmp_oldcave01', name: 'Old cave' }, fx: [] },
    { r: 2, at: 2, by: null, camp: { type: 'area.create', args: { id: 'area_oldc01', name: 'Area 1', visibility: 'open' } }, fx: [] },
    { r: 3, at: 3, by: null, camp: { type: 'seat.create', args: { id: 'seat_oldgm01', kind: 'human', role: 'gm', name: 'GM', location: 'area_oldc01' } }, fx: [] },
    { r: 4, at: 4, by: 'seat_oldgm01', cid: 'c_cave1', fx: [{ area: 'area_oldc01', seq: 1, type: 'room.spawn', args: oldArgs, inv: inverseOf(newArea('area_oldc01', 'A'), 'room.spawn', oldArgs) }] },
  ];
  fs.writeFileSync(path.join(dir, 'journal.jsonl'), J.map(r => JSON.stringify(r)).join('\n') + '\n');
  const tokens = makeTokens('t'), quiet = () => { };
  const R0 = new CampaignRuntime({ id: 'cmp_oldcave01', dir, tokens, log: quiet }); R0.load(); R0.close?.();
  ok('relay: an old campaign loads unchanged without the room engine', !R0.state.areas.area_oldc01.entities.room_old01.recipe.stalagObjects);
  const R1 = new CampaignRuntime({ id: 'cmp_oldcave01', dir, tokens, roomgen: rg, log: quiet }), r1 = R1.load(); R1.close?.();
  const E1c = R1.state.areas.area_oldc01.entities;
  ok('relay: loading it with the room engine converts the cave once (the same spots) and writes a snapshot', r1.caves === 1 && E1c.room_old01.recipe.stalagObjects && ruleO.every((p, k) => E1c[caveStalagId('room_old01', k)]?.x === p.x) && fs.existsSync(path.join(dir, 'snapshot.json')), r1);
  const R2r = new CampaignRuntime({ id: 'cmp_oldcave01', dir, tokens, roomgen: rg, log: quiet }), r2 = R2r.load(); R2r.close?.();
  ok('relay: loading it again converts nothing (the same state)', r2.caves === 0 && JSON.stringify(R2r.state.areas.area_oldc01.entities) === JSON.stringify(E1c), r2);
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
}

console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
