// UNIVERSAL VTT EXPORT, the pure half (core/uvtt.js; docs/UI.md "Universal VTT export"), on real rooms and the real wall
// engine: every wall the world builds is in line_of_sight, every door and window is a portal and a gap, nothing else.
//   node engine/test/uvtt.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoomgen } from '../relay/server.js';
import { applyArea } from '../core/commands.js';
import { newArea } from '../core/state.js';
import * as U from '../core/uvtt.js';
import { keyLevel } from '../core/footprint.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), TUNER = path.join(HERE, '../../tools/spawn-tuner');
const rg = await loadRoomgen(path.join(TUNER, 'js'), path.join(TUNER, 'data'), { orientApi: null });
let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, d); } };
const room = (id, type, x, z, w, d, y = 0, seed = 7) => ({ id, type, x, z, w, d, y, seed, building: 'bld_uvtt00001', buildingName: 'Inn', layout: { hash: 'h', summary: {}, objects: [] } });

let A = newArea('area_uvtt0001', 'uvtt');
A = applyArea(A, 'room.spawn', room('room_common01', 'common', 2, 1, 6, 4));
A = applyArea(A, 'room.spawn', room('room_kitchen1', 'kitchen', 8, 1, 4, 4, 0, 11));
A = applyArea(A, 'room.spawn', room('room_guest001', 'guest', 2, 1, 6, 4, 10, 13));
const E = A.entities;
const { edges } = rg.edges(E);
const box = U.mapBox(U.roomsFor(E));
ok(box && box.x0 === 1 && box.z0 === 0 && box.w === 12 && box.d === 6, 'the box: every room (all levels) and one square round it', JSON.stringify(box));

// ---- the ground floor ----
const G = U.wallsAndPortals({ edges, level: 0, box });
const ground = [...edges.values()].filter(e => keyLevel(e.key) === 0);
const kinds = (k) => ground.filter(e => e.kind === k);
ok(G.counts.levelEdges === ground.length && ground.length > 0, 'every ground edge was looked at', `${G.counts.levelEdges} of ${ground.length}`);
ok(G.counts.wall === kinds('wall').length, 'walls counted = the engine\'s wall edges', `${G.counts.wall} vs ${kinds('wall').length}`);
ok(G.portals.filter(p => p.closed).length === kinds('door').length && kinds('door').length >= 1, 'one closed portal per door', `${G.portals.length} portals, ${kinds('door').length} doors`);
ok(G.portals.filter(p => !p.closed).length === kinds('window').length, 'one open portal (not blocking sight) per window', `${kinds('window').length} windows`);
// the perimeter of the two ground rooms: 2*(6+4) + 2*(4+4) unit edges, less the shared 4 counted twice = 32 distinct edges
ok(ground.length === 32, 'ground edges: the two rooms\' perimeters with the shared wall once (32)', ground.length);
// the walls' total length + the doors' and windows' widths = every edge of the level, once
const len = (s) => Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y);
const wallLen = G.walls.reduce((a, s) => a + len(s), 0), portLen = G.portals.reduce((a, p) => a + len(p.bounds), 0);
const spans = kinds('door-span').length;
ok(Math.abs(wallLen + portLen - ground.length) < 1e-6, 'wall length + portal widths = the level\'s edges (no doubles, no holes)', `${wallLen} + ${portLen} vs ${ground.length} (${spans} door-span)`);
// no wall runs through a portal: a portal's midpoint is on no wall segment
const onSeg = (p, s) => { const [a, b] = s, cr = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); return Math.abs(cr) < 1e-6 && p.x >= Math.min(a.x, b.x) - 1e-6 && p.x <= Math.max(a.x, b.x) + 1e-6 && p.y >= Math.min(a.y, b.y) - 1e-6 && p.y <= Math.max(a.y, b.y) + 1e-6; };
ok(G.portals.every(p => !G.walls.some(s => onSeg(p.position, s))), 'every door and window is a gap in the walls');
ok(G.portals.every(p => Math.abs(p.position.x - (p.bounds[0].x + p.bounds[1].x) / 2) < 1e-9 && (p.rotation === 0) === (p.bounds[0].y === p.bounds[1].y)), 'a portal\'s position is its middle; rotation 0 along x, pi/2 along y');
// coordinates: in grid squares from the box's corner; the common room's west wall is at x = 2 - 1 = 1
ok(G.walls.some(s => s[0].x === 1 && s[1].x === 1), 'the west wall stands at x = 1 (the room at cell 2, the box from cell 1)');
const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= box.w && p.y <= box.d;
ok(G.walls.every(s => s.every(inside)) && G.portals.every(p => p.bounds.every(inside)), 'everything inside the map');
// straight runs are merged: no two wall segments on one line touch end to end
const touching = G.walls.some((s, i) => G.walls.some((t, j) => i !== j && (s[0].x === s[1].x) === (t[0].x === t[1].x) && (s[1].x === t[0].x && s[1].y === t[0].y)));
ok(!touching, 'collinear walls are one segment');

// ---- the upper floor: its own walls only ----
const Up = U.wallsAndPortals({ edges, level: 10, box });
const upper = [...edges.values()].filter(e => keyLevel(e.key) === 10);
ok(upper.length === 20 && Up.counts.levelEdges === 20, 'level 10: the guest room\'s 20 edges only', upper.length);
ok(Up.portals.every(p => p.closed === false || p.closed === true) && Up.walls.length > 0, 'level 10 has walls of its own');

// ---- hidden rooms; deleted walls; a tall room's stack; a moved wall ----
const hid = new Set(['room_kitchen1']);
const Ghid = U.wallsAndPortals({ edges, level: 0, box, hidden: hid });
ok(Ghid.counts.hidden === 12, 'a hidden room\'s own walls (12, not the shared 4) are left out', Ghid.counts.hidden);
ok(U.wallsAndPortals({ edges, level: 0, box, hidden: hid, includeHidden: true }).counts.hidden === 0, '"include hidden" keeps them');
const e0 = kinds('wall')[0], copy = new Map([...edges].map(([k, e]) => [k, k === e0.key ? { ...e, open: true } : e]));
ok(U.wallsAndPortals({ edges: copy, level: 0, box }).counts.wall === G.counts.wall - 1, 'a deleted wall is no wall');
const S = U.wallsAndPortals({ edges: new Map(), level: 10, box, stacks: ['h:2:1@10', 'h:3:1@10', 'v:2:1@10'] });
ok(S.counts.stack === 3 && S.walls.length === 2, 'a tall room\'s carried-up walls: walls at that level (merged)', JSON.stringify(S.walls));
const M = U.wallsAndPortals({ edges: new Map(), level: 0, box, moved: [{ fromEdge: 'h:4:1', x: 22.5, z: 10, rot: 0, dims: [5, 10, 1] }] });
ok(M.counts.moved === 1 && M.walls[0][0].x === 3 && M.walls[0][1].x === 4 && M.walls[0][0].y === 2, 'a wall made a thing and moved: a 5-ft wall where it stands', JSON.stringify(M.walls));

// ---- lights, the document, the size limit ----
const L = U.uvttLights([{ x: 22.5, z: 12.5, radius: 40, kind: 'fire' }], box);
ok(L[0].position.x === 3.5 && L[0].position.y === 2.5 && L[0].range === 8 && /^[0-9a-f]{8}$/.test(L[0].color), 'a 40-ft fire at (22.5, 12.5) ft: (3.5, 2.5) squares, range 8, AARRGGBB', JSON.stringify(L[0]));
const D = U.uvttDocument({ box, ppg: 100, walls: G.walls, portals: G.portals, lights: L });
ok(D.format === 0.3 && D.resolution.map_size.x === 12 && D.resolution.pixels_per_grid === 100 && D.resolution.map_origin.x === 0, 'the document: format 0.3, map size in squares, origin 0');
for (const k of ['format', 'resolution', 'line_of_sight', 'objects_line_of_sight', 'portals', 'environment', 'lights', 'image']) ok(k in D, `the document has ${k}`);
ok(U.sizeProblem({ w: 30, d: 30 }, 200) === null && /pick fewer/.test(U.sizeProblem({ w: 100, d: 90 }, 200) || ''), 'the size limit: 30x30 at 200 fits, 100x90 at 200 does not');

console.log(`uvtt: ${checks - fails}/${checks} ok`);
if (fails) process.exit(1);
