// MOVEMENT RINGS (docs/UI.md "Movement rings"; core/walk.js): the walking-distance field and the route through it.
//   open ground is round · a wall bends the ring · an open door lets it through, a shut one stops it · a window is a wall
//   for feet · fog of war is a wall · nothing past the reach · and THE FOG RULE: ground a seat has not explored, and every
//   wall in it, changes nothing in that seat's field
//   node engine/test/walk.test.mjs
import { walkField, routeTo, distanceAt, FAR, WALK } from '../core/walk.js';
import { blockingSegments } from '../client/vision.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const O = [2.5, 2.5], CELL = WALK.cell, TOL = CELL * 0.75; // a cell's value is its centre's: up to ~0.9 ft from a point's own

// ---- open ground: round rings (true distance in every direction, not an octagon)
{
  const F = walkField({ origin: O, reach: 40 });
  let worst = 0;
  for (let a = 0; a < 360; a += 7.5) for (const r of [10, 20, 30, 40]) { const x = O[0] + r * Math.cos(a * Math.PI / 180), z = O[1] + r * Math.sin(a * Math.PI / 180); worst = Math.max(worst, Math.abs(distanceAt(F, x, z) - r)); }
  ok(worst <= TOL, 'open ground: the walk is the straight-line distance in every direction (round rings)', worst);
  ok(distanceAt(F, O[0] + 46, O[1]) === FAR && distanceAt(F, O[0], O[1] - 46) === FAR, 'nothing is worked out past the reach (and its margin)');
  let over = 0; for (const d of F.dist) if (d < FAR && d > F.R + 1e-3) over++;
  ok(over === 0 && F.R <= 40 + WALK.margin * CELL + 1e-9, '40-ft cap: no reached cell is further than the reach and its few margin cells', { over, R: F.R });
  const r = routeTo(F, 30, 20);
  ok(r && !r.bends && r.points.length === 2 && near(r.length, Math.hypot(27.5, 17.5), 1e-6), 'open ground: the route is the straight line', r);
  const reach30 = walkField({ origin: O, reach: 30 });
  ok(distanceAt(reach30, O[0] + 36, O[1]) === FAR && distanceAt(reach30, O[0] + 29, O[1]) < FAR, 'the reach is the look\'s: 30 stops at 30 (and its margin)');
}

// ---- a wall bends the ring: a wall along x = 10 from z = -5 down to z = 60; the walk goes round its end
{
  const segs = [[10, -5, 10, 60]];
  const F = walkField({ origin: O, reach: 40, segments: segs }), P = [12.5, 2.5];
  const taut = Math.hypot(10 - O[0], -5 - O[1]) + Math.hypot(P[0] - 10, P[1] + 5); // a string pulled round the wall's end
  const d = distanceAt(F, ...P);
  // (the walk bends only at cell centres, 0.9 ft off a wall's true end: up to about a foot or two over the taut string a corner)
  ok(d >= taut - 0.5 && d <= taut + 2.5 && d > Math.hypot(P[0] - O[0], P[1] - O[1]) + 3, 'a wall bends the ring: just behind it the walk is round its end', { d, taut });
  const r = routeTo(F, ...P);
  ok(r && r.bends && r.points.some(([x, z]) => Math.hypot(x - 10, z + 5) < 1.5) && r.length >= taut - 0.5 && r.length <= taut + 2.5, 'the route turns at the wall\'s end and its length is the walk', r);
  const free = walkField({ origin: O, reach: 40 });
  ok(near(distanceAt(F, 2.5, 22.5), distanceAt(free, 2.5, 22.5), 1e-6), 'ground the wall does not shade is unchanged');
  // a wall off the grid's lines (a door piece turned freely, a cave's lip) blocks the cells it crosses
  const G = walkField({ origin: O, reach: 40, segments: [[8, -40, 14, 45]] });
  ok(distanceAt(G, 16, 2.5) === FAR || distanceAt(G, 16, 2.5) > 30, 'a slanted wall stops the walk too', distanceAt(G, 16, 2.5));
  // a corner where two walls meet is never squeezed through
  const C = walkField({ origin: O, reach: 40, segments: [[10, -50, 10, 10], [10, 10, -50, 10]] });
  ok(distanceAt(C, 12.5, 12.5) > 20, 'the outside of a closed corner is not reached through its corner point', distanceAt(C, 12.5, 12.5));
}

// ---- doors, through the walking walls (client/vision.js blockingSegments { walk: true }): a room 0..10 x -40..40 whose
// east wall (x = 10, gx 2) has one door at gz 0 (z 0..5); everything past it is only reachable through the door
{
  const edges = new Map();
  for (let gz = -8; gz < 8; gz++) { const key = `v:2:${gz}`; edges.set(key, { key, dir: 'v', gx: 2, gz, kind: gz === 0 ? 'door' : 'wall', sides: [{ room: 'r1' }, { room: 'r2' }], owner: { room: 'r1' } }); }
  const field = (E = {}, ed = edges) => walkField({ origin: O, reach: 40, segments: blockingSegments(ed, E, 0, { walk: true }) });
  const P = [12.5, 2.5];
  ok(distanceAt(field(), ...P) === FAR, 'a shut door stops the walk');
  const opened = new Map([...edges].map(([k, e]) => [k, k === 'v:2:0' ? { ...e, open: true } : e]));
  ok(near(distanceAt(field({}, opened), ...P), 10, TOL), 'an open door lets it through (straight through the doorway)', distanceAt(field({}, opened), ...P));
  // the same door made a thing (door.open: the edge taken over, the door an object of its own), shut, then open
  const over = { edge_v20: { id: 'edge_v20', kind: 'edge', key: 'v:2:0', as: 'open' } };
  const door = (open) => ({ ...over, obj_d: { id: 'obj_d', kind: 'object', cat: 'door-wood-plank', fromEdge: 'v:2:0', layer: 'walls', x: 10, z: 2.5, rot: Math.PI / 2, dims: [5, 7, 0.4], open } });
  ok(distanceAt(field(door(false)), ...P) === FAR, 'a door piece that is shut stops it');
  ok(near(distanceAt(field(door(true)), ...P), 10, TOL), 'the same piece opened lets it through');
  ok(blockingSegments(edges, door(false), 0).length > 0 && blockingSegments(edges, door(true), 0, { walk: true }).length === blockingSegments(edges, door(true), 0).length, 'walls for feet and for sight agree on doors');
  // a window is a wall for feet but not for sight
  const win = new Map([...edges].map(([k, e]) => [k, k === 'v:2:0' ? { ...e, kind: 'window' } : e]));
  ok(distanceAt(field({}, win), ...P) === FAR, 'a window is a wall for walking');
  ok(blockingSegments(win, {}, 0).length !== blockingSegments(win, {}, 0, { walk: true }).length, '... while sight still passes it (the vision rule is unchanged)');
  // a barred door: seen through (vision), but shut it stops a walker
  const bars = new Map([...edges].map(([k, e]) => [k, k === 'v:2:0' ? { ...e, doorType: 'door-cell-bars' } : e]));
  ok(distanceAt(field({}, bars), ...P) === FAR, 'a shut barred door stops the walk (it is only seen through)');
}

// ---- fog of war is a wall; and THE FOG RULE
{
  const room = [[10, -50, 10, 0], [10, 5, 10, 50]]; // the room's east wall with a doorway at z 0..5
  const corridor = [[15, -50, 15, 10], [15, 10, 60, 10], [20, 15, 60, 15]]; // past the doorway: a wall that would bend a ring
  const exploredB = (x) => x < 12.5;  // Kit: the room and the doorway's own cells
  const exploredA = (x) => x < 45;    // Mira: she walked the corridor
  const fB = walkField({ origin: O, reach: 40, segments: [...room, ...corridor], known: (x) => exploredB(x) });
  ok(distanceAt(fB, 13.75, 2.5) === FAR && distanceAt(fB, 11.875, 2.5) < FAR, 'unexplored ground is a wall: the ring stops at the fog\'s edge', [distanceAt(fB, 13.75, 2.5), distanceAt(fB, 11.875, 2.5)]);
  let reachedPast = 0; for (let k = 0; k < fB.dist.length; k++) if (fB.dist[k] < FAR && fB.x0 + (k % fB.n + 0.5) * fB.cell >= 12.5) reachedPast++;
  ok(reachedPast === 0, 'not one cell past the fog\'s edge is reached', reachedPast);
  // the leak test: every wall in ground Kit has not explored, taken away or moved, leaves her field exactly as it is
  const same = (a, b) => a.dist.length === b.dist.length && a.dist.every((d, k) => d === b.dist[k]);
  const fB0 = walkField({ origin: O, reach: 40, segments: room, known: (x) => exploredB(x) });
  const fB2 = walkField({ origin: O, reach: 40, segments: [...room, [16, -30, 16, 30], [12.6, -40, 40, 30]], known: (x) => exploredB(x) });
  ok(same(fB, fB0) && same(fB, fB2), 'THE FOG RULE: walls in unexplored ground change nothing in that seat\'s field (no bend, no hint)');
  const fA = walkField({ origin: O, reach: 40, segments: [...room, ...corridor], known: (x) => exploredA(x) });
  const fA0 = walkField({ origin: O, reach: 40, segments: room, known: (x) => exploredA(x) });
  ok(!same(fA, fA0) && distanceAt(fA, 17.5, -10) > distanceAt(fA0, 17.5, -10) + 10, 'the seat who explored the corridor does get its walls (her ring bends round them)', [distanceAt(fA, 17.5, -10), distanceAt(fA0, 17.5, -10)]);
  ok(routeTo(fB, 20, 2.5) === null, 'no route into ground the seat has not explored (the straight line stands)');
  // a seat that knows its own pawn: the start is open even where nothing is explored yet
  const none = walkField({ origin: O, reach: 40, known: () => false });
  ok(none.stats.reached === 1, 'nothing explored: only the pawn\'s own place, no ring', none.stats.reached);
}

// ---- cost: the field for a 40-ft reach in a busy room stays small
{
  const segs = []; for (let k = -6; k <= 6; k++) segs.push([k * 5, -40, k * 5, -40 + ((k * 37) % 50 + 50) % 50], [-40, k * 5, -40 + ((k * 23) % 60 + 60) % 60, k * 5]);
  walkField({ origin: O, reach: 40, segments: segs }); // (warm)
  const t = performance.now(); for (let i = 0; i < 10; i++) walkField({ origin: [O[0] + i * 0.3, O[1]], reach: 40, segments: segs });
  const ms = (performance.now() - t) / 10;
  ok(ms < 40, 'a 40-ft field costs a few ms', ms.toFixed(2));
  console.log(`  field: ${ms.toFixed(2)} ms (node, warm, ${segs.length} walls)`);
}

console.log(`walk: ${checks - fails}/${checks} ok`);
process.exit(fails ? 1 : 0);
