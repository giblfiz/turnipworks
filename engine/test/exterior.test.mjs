// EXTERIORS ABOVE (2026-11-24, core/exterior.js; docs/VERTICAL.md "Exteriors above"). Harry on dev: a player out in the open
// could not see the temple on its 10-ft hill, nor a statue on a pillar in front of it: everything 10 ft or more up read the
// upper storey's fog. Pure data: bands, cover, the exterior's sight and the composed masks.
//   node engine/test/exterior.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { bandsOf, underSky, bandParts, coveredAt, blindAt, extKey, isExtKey } from '../core/exterior.js';
import { computeVision, exteriorSegments } from '../client/vision.js';
import { rasterVision, maskLevels, clearCovered, resetFootprints } from '../client/fog-grid.js';
import { hasFogCell, unionLevels, levelsProblem } from '../core/fog.js';

// a rectangle's four walls as generated edges at height y (cells of 5 ft)
const walls = (room, { x, z, w, d }, y = 0, kind = 'wall') => {
  const out = [], at = y ? `@${y}` : '';
  for (let i = 0; i < w; i++) for (const gz of [z, z + d]) out.push({ key: `h:${x + i}:${gz}${at}`, dir: 'h', gx: x + i, gz, y, kind, sides: [{ room }] });
  for (let i = 0; i < d; i++) for (const gx of [x, x + w]) out.push({ key: `v:${gx}:${z + i}${at}`, dir: 'v', gx, gz: z + i, y, kind, sides: [{ room }] });
  return out;
};
const room = (id, recipe, extra = {}) => ({ id, kind: 'room', recipe: { type: 'common', ...recipe }, ...extra });
// G: a one-storey ground building (0..30 x 0..20 ft); U: a roofed upper room over its west third; T: an open terrace (roof
// off) over its middle; H: a 10-ft hill (40..60) with S, a roofed shrine on it (a ground storey on the hill, sight level 0)
const R = {
  G: room('G', { x: 0, z: 0, w: 6, d: 4 }),
  U: room('U', { x: 0, z: 0, w: 2, d: 4, y: 10 }),
  T: room('T', { x: 2, z: 0, w: 2, d: 4, y: 10 }, { roof: { off: true } }),
  H: room('H', { type: 'hill', x: 8, z: 0, w: 4, d: 6, y: 10 }),
  S: room('S', { x: 9, z: 1, w: 2, d: 2, y: 10 }),
};
const isOpen = r => !!r.roof?.off;
const seats = [{ id: 'a', role: 'player' }];
const pawn = (id, x, z, y = 0) => ({ id, kind: 'token', owner: 'a', x, z, y });
const edges = [...walls('G', R.G.recipe), ...walls('U', R.U.recipe, 10, 'window'), ...walls('S', R.S.recipe, 10)];
const bounds = [-40, -40, 80, 80];

test('the bands are heights: every floor, every top, every hill top', () => {
  assert.deepEqual(bandsOf(R), [0, 10, 20]);
  assert.deepEqual(bandsOf(R, [-10]), [-10, 0, 10, 20]);
});

test('under the sky: outdoors, an open terrace and a roof top; not indoors, not under a storey', () => {
  assert.equal(underSky(R, 10, 40, 0, isOpen), true, 'the open ground');
  assert.equal(underSky(R, 25, 10, 0, isOpen), false, 'in the ground building');
  assert.equal(underSky(R, 5, 10, 10, isOpen), false, 'in the roofed upper room');
  assert.equal(underSky(R, 15, 10, 10, isOpen), true, 'on the open terrace');
  assert.equal(underSky(R, 15, 10, 0, isOpen), false, 'under the terrace');
  assert.equal(underSky(R, 25, 10, 10, isOpen), true, 'on the ground building\'s roof');
  assert.equal(underSky(R, 50, 25, 10, isOpen), true, 'a hill top');
  assert.equal(underSky(R, 50, 10, 10, isOpen), false, 'in the shrine on the hill');
});

test('at a height, every wall standing there blocks, windows and open doors too; lower walls do not', () => {
  const at10 = exteriorSegments(edges, R, 10), at0 = exteriorSegments(edges, R, 0);
  const blocks = (segs, x0, z0, x1, z1) => segs.some(s => Math.min(s[0], s[2]) <= Math.max(x0, x1) && Math.max(s[0], s[2]) >= Math.min(x0, x1) && Math.min(s[1], s[3]) <= Math.max(z0, z1) && Math.max(s[1], s[3]) >= Math.min(z0, z1) && (s[0] === s[2] ? (s[0] - x0) * (s[0] - x1) <= 0 : (s[1] - z0) * (s[1] - z1) <= 0));
  assert.ok(blocks(at10, 5, 30, 5, 10), 'the upper room\'s windowed wall blocks at 10');
  assert.ok(!blocks(at10, 25, 30, 25, 10), 'the ground building\'s walls are not at 10');
  assert.ok(blocks(at0, 25, 30, 25, 10), 'they are at 0');
  const open = [...edges.filter(e => e.y === 10 && e.sides[0].room === 'U').map(e => ({ ...e, kind: 'door', open: true }))];
  assert.ok(blocks(exteriorSegments(open, R, 10), 5, 30, 5, 10), 'an open door still blocks the exterior');
});

test('a pawn under the sky sees each band above it; a pawn indoors sees none', () => {
  const out = computeVision({ entities: { ...R, p: pawn('p', 15, 40) }, edges, seats, viewer: 'a', bounds, bands: [0, 10, 20], isOpen });
  assert.deepEqual([...out.keys()].sort((a, b) => a - b), [0, extKey(10), extKey(20)]);
  assert.ok(isExtKey(extKey(10)) && !isExtKey(10) && !isExtKey(0));
  const inside = computeVision({ entities: { ...R, p: pawn('p', 25, 10) }, edges, seats, viewer: 'a', bounds, bands: [0, 10, 20], isOpen });
  assert.deepEqual([...inside.keys()], [0]);
  const plain = computeVision({ entities: { ...R, p: pawn('p', 15, 40) }, edges, seats, viewer: 'a', bounds });
  assert.deepEqual([...plain.keys()], [0], 'no bands asked: the old answer');
});

test('the exterior never keeps the inside of a roofed room; it does keep an open terrace, a roof and a hill top', () => {
  resetFootprints();
  const v = computeVision({ entities: { ...R, p: pawn('p', 15, 40) }, edges, seats, viewer: 'a', bounds, bands: [0, 10, 20], isOpen });
  const cur = clearCovered(rasterVision(v, bounds), b => blindAt(R, b, isOpen), bounds), k = extKey(10);
  assert.ok(!hasFogCell(cur, 5, 10, k), 'the upper room\'s inside');
  assert.ok(!hasFogCell(cur, 50, 10, k), 'the shrine\'s inside');
  assert.ok(hasFogCell(cur, 15, 10, k), 'the open terrace');
  assert.ok(hasFogCell(cur, 25, 10, k), 'over the ground building\'s roof');
  assert.ok(hasFogCell(cur, 50, 26, k), 'the hill top');
  assert.ok(hasFogCell(cur, 15, 22, k), 'just outside the upper room\'s wall (its outer face)');
  assert.equal(levelsProblem(cur), null, 'the relay stores it as it is (fog.explore)');
});

test('a band\'s mask: its own sight, the exterior, and inside a hilltop room that room\'s own sight level', () => {
  resetFootprints();
  const parts = bandParts(R, 10, isOpen);
  assert.deepEqual(parts.map(p => p.key), [10, extKey(10), 10.25, 10.75, 0, 0, 0], 'own level, exterior, through openings, raised feet, the shrine (level 0), the hill top, the roof zone of the ground building');
  // seen: on the ground (level 0) the shrine's inside from its door; nothing else
  const current = { 0: rasterVision(new Map([[0, [{ points: [[46, 6], [54, 6], [54, 14], [46, 14]] }]]]), bounds)[0] };
  const [g, up] = maskLevels(current, current, bounds, [0, 10], null, null, b => bandParts(R, b, isOpen));
  const at = (L, x, z) => { const ix = Math.floor((x - L.bounds[0]) / (L.bounds[2] - L.bounds[0]) * L.width), iz = Math.floor((z - L.bounds[1]) / (L.bounds[3] - L.bounds[1]) * L.height); return L.data[(iz * L.width + ix) * 4]; };
  assert.equal(at(g, 50, 10), 255, 'band 0 inside the shrine');
  assert.equal(at(up, 50, 10), 255, 'band 10 inside the shrine: its floor is 10 ft up and sees at 0');
  assert.equal(at(up, 5, 10), 0, 'band 10 inside the roofed upper room: nobody has been there');
  // the old answer without composition: band 10 knows nothing of level 0 (the checker Harry saw on the temple)
  const [, old] = maskLevels(current, current, bounds, [0, 10]);
  assert.equal(at(old, 50, 10), 0);
});

test('exterior memory unions like any level', () => {
  const a = { [extKey(10)]: { 0: [[0, 3]] } }, b = { [extKey(10)]: { 0: [[2, 6]] }, 0: { 1: [[0, 0]] } };
  assert.deepEqual(unionLevels(a, b)[extKey(10)][0], [[0, 6]]);
});

// LOOKING DOWN (Harry: "Line of sight down from a terrace should work too"). B: a little roof-off balcony at 10 ft over open
// ground (30..35 x 20..25), beside the ground building.
const RB = { ...R, B: room('B', { x: 6, z: 4, w: 1, d: 1, y: 10 }, { roof: { off: true } }) };
const downFrom = (x, z, y) => { resetFootprints(); const v = computeVision({ entities: { ...RB, p: pawn('p', x, z, y) }, edges, seats, viewer: 'a', bounds, bands: bandsOf(RB), isOpen });
  return { v, cur: clearCovered(rasterVision(v, bounds), b => blindAt(RB, b, isOpen), bounds) }; };

test('looking down from the terrace: the ground past the edges, not what is under a floor, not inside the roofed building', () => {
  const { v, cur } = downFrom(15, 10, 10), k = extKey(0);
  assert.ok(v.get(k)?.some(p => p.down), 'a look down at the ground band');
  assert.ok(hasFogCell(cur, 15, 32, k), 'the open ground past the building\'s edge');
  assert.ok(hasFogCell(cur, 64, 34, k), 'the plain beside the hill');
  assert.ok(!hasFogCell(cur, 32, 22, k), 'directly under the balcony\'s floor');
  assert.ok(!hasFogCell(cur, 25, 10, k), 'inside the roofed ground building');
  assert.ok(!hasFogCell(cur, 15, 10, k), 'under the terrace it stands on');
  assert.ok(hasFogCell(cur, 25, 10, extKey(10)), 'but the ground building\'s roof, at the terrace\'s own height');
});

test('looking down from a hilltop: the plain beyond the hill, never the hill\'s own earth; a pawn on the ground looks down at nothing', () => {
  const { cur } = downFrom(50, 28, 10), k = extKey(0);
  assert.ok(hasFogCell(cur, 66, 12, k), 'the plain past the hill\'s edge');
  assert.ok(!hasFogCell(cur, 50, 20, k), 'under the hill top it stands on');
  const ground = downFrom(15, 40, 0).v;
  assert.ok(![...ground.values()].flat().some(p => p.down), 'a pawn on the ground has nothing below it');
});

test('walls at the viewer\'s own height still block the look down', () => {
  // from inside the roof-off balcony walled at 10 ft, the ground beyond its walls is not seen
  const walled = [...edges, ...walls('B', RB.B.recipe, 10)];
  resetFootprints();
  const v = computeVision({ entities: { ...RB, p: pawn('p', 32.5, 22.5, 10) }, edges: walled, seats, viewer: 'a', bounds, bands: bandsOf(RB), isOpen });
  const cur = clearCovered(rasterVision(v, bounds), b => blindAt(RB, b, isOpen), bounds);
  assert.ok(!hasFogCell(cur, 32, 40, extKey(0)), 'the ground past its walls');
});

// HOLES (2026-11-25; Harry, on the 20-ft hole in the Dragon Temple's floor: "it's acting like a pillar (you can't see past it
// onto the same level), and honestly you SHOULD be able to see down into it based on line of sight"). A 10-ft hill (0..80 x
// 0..60) with a hall on it (HA: 10..70 x 10..50, floor 10, sees at 0) and a passage dug into the hill under the hall's middle
// (PA: 25..55 x 15..45, floor 0, also sees at 0), a 20-ft round hole in the hall's floor over it (40, 30); and on the plain a
// house (HO: 100..130 x 0..20) with a 5-ft square hole in its floor over a cellar (CE: 100..130 x 0..20, floor -10).
const RH = {
  HL: room('HL', { type: 'hill', x: 0, z: 0, w: 16, d: 12, y: 10 }),
  HA: room('HA', { x: 2, z: 2, w: 12, d: 8, y: 10 }),
  PA: room('PA', { x: 5, z: 3, w: 6, d: 6 }),
  HO: room('HO', { x: 20, z: 0, w: 6, d: 4 }),
  CE: room('CE', { x: 20, z: 0, w: 6, d: 4, y: -10 }),
  hole: { id: 'hole', kind: 'object', cat: 'hole-round', x: 40, z: 30, y: 10, dims: [20, 0.05, 20] },
  hole2: { id: 'hole2', kind: 'object', cat: 'hole', x: 112.5, z: 7.5, y: 0, dims: [5, 0.05, 5] },
};
const edgesH = [...walls('HA', RH.HA.recipe, 10), ...walls('PA', RH.PA.recipe, 0), ...walls('HO', RH.HO.recipe, 0), ...walls('CE', RH.CE.recipe, -10)];
const BH = [-40, -40, 180, 100];
const seeH = (x, z, y, more = {}) => { resetFootprints(); const E = { ...RH, p: pawn('p', x, z, y), ...more };
  const v = computeVision({ entities: E, edges: edgesH, seats, viewer: 'a', bounds: BH, bands: bandsOf(E), isOpen, openings: [RH.hole, RH.hole2] });
  return { v, cur: clearCovered(rasterVision(v, BH), b => blindAt(E, b, isOpen), BH) }; };

test('a hole is not a pillar: the walls of the passage under the hall do not stand in the hall', () => {
  const { cur } = seeH(65, 45, 10);
  assert.ok(hasFogCell(cur, 15, 15, 10.75), 'the hall\'s far corner, past the hole, is seen (kept at the hall\'s height)');
  assert.ok(hasFogCell(cur, 30, 20, 10.75), 'the hall\'s floor over the passage too');
  assert.ok(!hasFogCell(cur, 40, 25, 0) && !hasFogCell(cur, 30, 20, 0), 'level 0 keeps nothing where the hall and the passage overlap (it would mean both)');
  assert.ok(hasFogCell(cur, 15, 15, 0), 'the hall where nothing is under it stays at level 0, as before');
});

test('looking down a hole: the floor below through the opening, not the rest of the room under the floor', () => {
  const { cur } = seeH(55, 30, 10), k = 0.25;
  // from (55, 30), eyes 5 ft up, the hole's near edge at 50: the passage floor 10 ft down is seen from 3x as far out
  assert.ok(hasFogCell(cur, 32, 30, k), 'the passage floor beyond the hole\'s middle, in the cone');
  assert.ok(!hasFogCell(cur, 52, 30, k), 'the passage floor under the pawn\'s own side of the floor');
  assert.ok(!hasFogCell(cur, 40, 17, k), 'off the cone\'s side');
  assert.ok(!hasFogCell(cur, 15, 30, k), 'past the passage\'s own wall (it is clipped by the lower walls)');
});

test('a shaft to a cellar: only the cone through the opening; a pawn away from the edge, no closer look', () => {
  const near = seeH(117.5, 7.5, 0).cur, k = -9.75;
  assert.ok(hasFogCell(near, 108, 7.5, k), 'the cellar floor across from the opening');
  assert.ok(!hasFogCell(near, 125, 7.5, k), 'the cellar under the pawn\'s side');
  assert.ok(!hasFogCell(near, 108, 18, k), 'off the cone');
  const far = seeH(70, 70, 0).cur;
  assert.ok(!Object.keys(far).some(l => +l === k && Object.keys(far[l]).length), 'a pawn outside the house does not see the opening, so nothing below');
});

test('a shaft through two floors: down the hall\'s hole and the passage\'s hole under it to the cave, only what lines up with both', () => {
  const more = { hole3: { id: 'hole3', kind: 'object', cat: 'hole-round', x: 40, z: 30, y: 0, dims: [10, 0.05, 10] }, CA: room('CA', { x: 4, z: 2, w: 8, d: 8, y: -10 }) };
  resetFootprints(); const E = { ...RH, ...more, p: pawn('p', 52, 30, 10) };
  const v = computeVision({ entities: E, edges: [...edgesH, ...walls('CA', more.CA.recipe, -10)], seats, viewer: 'a', bounds: BH, bands: bandsOf(E), isOpen, openings: [RH.hole, RH.hole2, more.hole3] });
  const cur = rasterVision(v, BH), k = -9.75;
  // eyes at 15: the cave floor (-10) lines up with the 10-ft hole (floor 0) scaled by 25/15 and the 20-ft one (floor 10) by 25/5
  assert.ok(hasFogCell(cur, 35, 30, k), 'the cave floor lined up with both openings');
  assert.ok(!hasFogCell(cur, 20, 30, k), 'past the small hole\'s cone, though inside the big one\'s');
  assert.ok(hasFogCell(cur, 32, 30, 0.25), 'and the passage floor seen through the first hole');
});
