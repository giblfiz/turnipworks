// Darkness in fog of war (2026-10-20): core/darkness.js (the rule, the light table) and client/darksight.js (the sight).
import test from 'node:test';
import assert from 'node:assert/strict';
import { darkSight, rasterDark, rasterPolys, darkVisibleAt, intersectRows, unionRows } from '../client/darksight.js';
import { rasterVision } from '../client/fog-grid.js';
import { visibilityPolygon } from '../client/vision.js';
import { hasFogCell } from '../core/fog.js';
import { lightKind, lightRadiusOf, darkvisionOf, carriedLightOf, hintOf, darknessFor, LIGHT_RADII, DARKVISION_DEFAULT, pawnDarkProblem } from '../core/darkness.js';

const bounds = [-60, -60, 160, 160];
const seats = [{ id: 'a', role: 'player' }, { id: 'b', role: 'player' }, { id: 'gm', role: 'gm' }];
const pawn = (id, owner, x, z, extra = {}) => ({ id, kind: 'token', owner, x, z, ...extra });
// a 50 x 20 hall (0..50, 0..20) and a room B (50..70) beyond a wall at x = 50 with a door gap 8..12 when open
const hall = (doorOpen) => [[0, 0, 70, 0], [0, 20, 70, 20], [0, 0, 0, 20], [70, 0, 70, 20], ...(doorOpen ? [[50, 0, 50, 8], [50, 12, 50, 20]] : [[50, 0, 50, 20]])];
const edgesFor = (segs) => segs; // blockingSegments is bypassed: the walls Map below is filled directly
const sight = ({ entities, segs, lights = [], hint = 2, viewer = 'a', party = false }) => {
  const walls = new Map([[0, segs]]);
  return darkSight({ entities, edges: [], lights, hint, bounds, walls, viewer, seats, party });
};
const cells = (s) => rasterDark(s, bounds);
const seenAt = (r, x, z) => hasFogCell(r.current, x, z, 0), knownAt = (r, x, z) => hasFogCell(r.reach, x, z, 0);

test('the light table and defaults', () => {
  assert.equal(darkvisionOf({}), DARKVISION_DEFAULT); assert.equal(darkvisionOf({ darkvision: 60 }), 60); assert.equal(darkvisionOf({ darkvision: 0 }), 0);
  assert.equal(carriedLightOf({}), 0); assert.equal(hintOf(undefined), 2); assert.equal(hintOf({ dark: { hint: 5 } }), 5); assert.equal(hintOf({ dark: { hint: 99 } }), 6);
  const k = (cat, fire, aff = ['lit']) => lightKind(cat, fire, aff);
  assert.equal(k('sconce-candle-single', 'candle'), 'candle'); assert.equal(k('candle-tree', 'candelabra'), 'candle');
  assert.equal(k('torch-stand', 'torch'), 'torch'); assert.equal(k('cresset-wall', 'torch'), 'torch');
  assert.equal(k('lantern-wall-iron', 'lantern'), 'lantern'); assert.equal(k('hearth-raised-square', 'hearth'), 'fire');
  assert.equal(k('brazier-tripod', 'brazier'), 'fire'); assert.equal(k('forge', 'brazier'), 'fire'); assert.equal(k('chandelier-iron', 'chandelier'), 'chandelier');
  assert.equal(k('rushlight-holder-wall', null), 'candle'); assert.equal(k('glowworm-ceiling', null), 'glow'); assert.equal(k('alch-crucible-glowing', null), 'glow');
  assert.equal(k('glass-furnace', null), 'oven'); assert.equal(k('barrel', null, []), null);
  assert.deepEqual([LIGHT_RADII.candle, LIGHT_RADII.torch, LIGHT_RADII.lantern, LIGHT_RADII.fire, LIGHT_RADII.chandelier, LIGHT_RADII.glow], [10, 40, 60, 40, 40, 20]);
  assert.equal(lightRadiusOf({}, 'torch'), 40); assert.equal(lightRadiusOf({ lightRadius: 15 }, 'torch'), 15);
  assert.equal(pawnDarkProblem({ darkvision: 60 }), null); assert.ok(pawnDarkProblem({ darkvision: 130 })); assert.ok(pawnDarkProblem({ darkvision: -5 })); assert.equal(pawnDarkProblem({ darkvision: null }), null);
  const c = { defaults: {}, areas: [{ id: 'x', settings: {} }, { id: 'y', settings: { darkness: true } }] };
  assert.equal(darknessFor(c, 'x'), false); assert.equal(darknessFor(c, 'y'), true);
  assert.equal(darknessFor({ ...c, defaults: { darkness: true } }, 'x'), true);
  assert.equal(darknessFor({ ...c, defaults: { darkness: true }, areas: [{ id: 'x', settings: { darkness: false } }] }, 'x'), false);
});

test('rasterPolys = rasterVision cell for cell (the edge-bucketed raster)', () => {
  const segs = hall(true);
  for (const [o, r] of [[[5, 10], Infinity], [[30, 5], 22], [[60, 10], 40], [[49.9, 10], 12.3]]) for (const cell of [1.25, 0.3125, 0.4]) {
    const p = visibilityPolygon(o, segs, { bounds, radius: r });
    assert.deepEqual(rasterPolys([p], bounds, cell), rasterVision(new Map([[0, [{ points: p }]]]), bounds, cell)[0]);
  }
  assert.deepEqual(intersectRows({ 1: [[0, 5], [8, 12]] }, { 1: [[3, 9]], 2: [[0, 1]] }), { 1: [[3, 5], [8, 9]] });
  assert.deepEqual(unionRows({ 1: [[0, 2]] }, { 1: [[3, 5]], 2: [[0, 0]] }), { 1: [[0, 5]], 2: [[0, 0]] });
});

test('darkvision 30, hint 2: 27 ft visible; 29 ft explored, not visible; nothing past 30', () => {
  const entities = { a: pawn('a', 'a', 2.5, 10) }, s = sight({ entities, segs: hall(false) }), r = cells(s);
  assert.ok(seenAt(r, 29.5, 10), '27 ft seen'); assert.ok(darkVisibleAt(s, 29.5, 10));
  assert.ok(!seenAt(r, 31.5, 10) && knownAt(r, 31.5, 10), '29 ft: explored, not visible'); assert.ok(!darkVisibleAt(s, 31.5, 10));
  assert.ok(!knownAt(r, 33.5, 10) && !knownAt(r, 37.5, 10), '31 and 35 ft: nothing'); assert.ok(!darkVisibleAt(s, 37.5, 10));
  // H = 0: a hard edge at 30; darkvision 60 sees 55 ft; darkvision 0 sees nothing (but stands in line of sight)
  const h0 = cells(sight({ entities, segs: hall(false), hint: 0 }));
  assert.ok(seenAt(h0, 31.5, 10) && !knownAt(h0, 33.5, 10));
  const far = cells(sight({ entities: { a: pawn('a', 'a', 2.5, 10, { darkvision: 60 }) }, segs: hall(false) }));
  assert.ok(seenAt(far, 47.5, 10));
  const blind = cells(sight({ entities: { a: pawn('a', 'a', 2.5, 10, { darkvision: 0 }) }, segs: hall(false) }));
  assert.ok(!knownAt(blind, 3.5, 10));
  // visionRadius still caps everything (its old meaning)
  const capped = sight({ entities: { a: pawn('a', 'a', 2.5, 10, { visionRadius: 10 }) }, segs: hall(false) });
  assert.ok(!darkVisibleAt(capped, 20, 10) && darkVisibleAt(capped, 9, 10));
});

test('a torch in the next room: seen through the open door, never through the wall; snuffed, gone', () => {
  const entities = { a: pawn('a', 'a', 2.5, 10) }, torch = { x: 62.5, z: 10, level: 0, radius: 20 };
  const open = sight({ entities, segs: hall(true), lights: [torch] }), ro = cells(open);
  assert.ok(seenAt(ro, 60, 10) && darkVisibleAt(open, 60, 10), 'B lit, seen through the door');
  assert.ok(seenAt(ro, 45, 10) && darkVisibleAt(open, 45, 10), 'the light through the door reaches the hall');
  assert.ok(!seenAt(ro, 45, 2) && !darkVisibleAt(open, 45, 2), 'the hall beside the door: the wall shades it');
  assert.ok(!seenAt(ro, 65, 2), 'B out of the line of sight through the door: lit but unseen');
  const shut = sight({ entities, segs: hall(false), lights: [torch] }), rs = cells(shut);
  assert.ok(!seenAt(rs, 60, 10) && !knownAt(rs, 60, 10) && !darkVisibleAt(shut, 60, 10), 'door shut: B not seen');
  assert.ok(!seenAt(rs, 45, 10) && !knownAt(rs, 45, 10), 'door shut: the light never lights through the wall');
  const snuffed = cells(sight({ entities, segs: hall(true), lights: [] }));
  assert.ok(!seenAt(snuffed, 60, 10) && !seenAt(snuffed, 45, 10), 'snuffed: B and the hall dark again');
  // lit cells for everyone: a lit room is visible far past darkvision; the hint band rims the light too
  assert.ok(knownAt(ro, 62.5 - 19, 10) && !seenAt(ro, 62.5 - 19, 10), 'the light\'s own outer 2 ft is remembered, not seen');
});

test('a carried light lights for everyone; hidden carriers light nothing; party vision shares sight', () => {
  const entities = { a: pawn('a', 'a', 2.5, 10), m: pawn('m', null, 45, 10, { lightCarried: 10 }) };
  const s = sight({ entities, segs: hall(false) });
  assert.ok(darkVisibleAt(s, 45, 10) && darkVisibleAt(s, 40, 10), 'the monster\'s torch shows it');
  const hid = sight({ entities: { ...entities, m: { ...entities.m, hidden: true } }, segs: hall(false) });
  assert.ok(!darkVisibleAt(hid, 45, 10));
  const party = sight({ entities: { a: pawn('a', 'a', 2.5, 10), b: pawn('b', 'b', 45, 10) }, segs: hall(false), party: true });
  assert.ok(darkVisibleAt(party, 45, 10) && darkVisibleAt(party, 25, 10));
});

test('lights out of every viewer\'s sight are not considered; polygons are cached', () => {
  const entities = { a: pawn('a', 'a', 2.5, 10) }, cache = new Map(), walls = new Map([[0, hall(false)]]);
  const lights = [{ x: 30, z: 10, level: 0, radius: 10 }, { x: 140, z: 140, level: 0, radius: 10 }, { x: 30, z: 10, level: 10, radius: 10 }];
  const s = darkSight({ entities, edges: [], lights, hint: 2, bounds, cache, walls, viewer: 'a', seats });
  assert.equal(s.get(0).lights, 1); assert.equal([...cache.keys()].filter(k => !k.startsWith('U|')).length, 1);
  const again = darkSight({ entities, edges: [], lights, hint: 2, bounds, cache, walls, viewer: 'a', seats });
  assert.equal(again.get(0).lit[0], s.get(0).lit[0], 'the same polygon object, from the cache');
});

// ---- the commands: area rule, pawn fields, a light's own radius (checked, applied, cleared by null)
import { newCampaign, newArea, areaRules, projectCampaign } from '../core/state.js';
import { REGISTRY, checkCommand } from '../core/commands.js';
function world() {
  let s = newCampaign('campaign_t', 'TEST darkness (throwaway)');
  s.seats = { gm: { id: 'gm', kind: 'human', role: 'gm' }, p1: { id: 'p1', kind: 'human', role: 'player' }, p2: { id: 'p2', kind: 'human', role: 'player' } };
  s.areas = { a: newArea('a', 'Crypt'), b: newArea('b', 'Inn') }; s.areaOrder = ['a', 'b'];
  return s;
}
const run = (s, type, args, area = 'a') => { const d = REGISTRY[type]; if (d.level === 'area') { const t = d.apply(s.areas[area], args); return { ...s, areas: { ...s.areas, [area]: t } }; } return d.apply(s, args); };
const chk = (s, by, type, args, area = 'a') => checkCommand({ state: s, by, area: s.areas[area] }, { type, area, args });

test('darkness is an area play rule: off by default, the campaign default, an area override, GM only', () => {
  let s = world();
  assert.equal(areaRules(s, 'a').darkness, false);
  s = run(s, 'campaign.set', { defaults: { darkness: true } });
  assert.deepEqual([areaRules(s, 'a').darkness, areaRules(s, 'b').darkness], [true, true]);
  s = run(s, 'area.set', { area: 'b', settings: { darkness: false } });
  assert.deepEqual([areaRules(s, 'a').darkness, areaRules(s, 'b').darkness], [true, false]);
  assert.ok(chk(s, 'p1', 'area.set', { area: 'a', settings: { darkness: true } }), 'a player cannot');
  assert.ok(chk(s, 'gm', 'area.set', { area: 'a', settings: { darkness: 'yes' } }), 'a bool');
  assert.equal(projectCampaign(s, 'p1').areas.find(x => x.id === 'b').settings.darkness, false, 'players receive it');
});

test('darkvision and a carried light: on a pawn, its definition, brought onto the table; checked; null = the default', () => {
  let s = world();
  s = run(s, 'token.create', { id: 't1', name: 'Mira', x: 2, z: 2, owner: 'p1', darkvision: 60 });
  assert.equal(s.areas.a.entities.t1.darkvision, 60);
  assert.equal(chk(s, 'p1', 'token.set', { id: 't1', darkvision: 90 }), null, 'its owner may');
  assert.ok(chk(s, 'p2', 'token.set', { id: 't1', darkvision: 90 }), 'another player may not');
  assert.equal(chk(s, 'gm', 'token.set', { id: 't1', darkvision: 90 }), null, 'the GM may');
  assert.ok(chk(s, 'gm', 'token.set', { id: 't1', darkvision: 500 })); assert.ok(chk(s, 'gm', 'token.set', { id: 't1', lightCarried: -1 }));
  s = run(s, 'token.set', { id: 't1', darkvision: 0, lightCarried: 40 });
  assert.deepEqual([s.areas.a.entities.t1.darkvision, s.areas.a.entities.t1.lightCarried], [0, 40]);
  s = run(s, 'token.set', { id: 't1', darkvision: null });
  assert.equal('darkvision' in s.areas.a.entities.t1, false); assert.equal(darkvisionOf(s.areas.a.entities.t1), 30);
  // the definition (Settings ▸ Me ▸ My pawns) carries it onto the table
  assert.equal(chk(s, 'p1', 'pawn.define', { id: 'def1', name: 'Bram', darkvision: 60 }), null);
  assert.ok(chk(s, 'p1', 'pawn.define', { id: 'def1', name: 'Bram', darkvision: 121 }));
  s = run(s, 'pawn.define', { ...REGISTRY['pawn.define'].fill(s, { id: 'def1', name: 'Bram', darkvision: 60 }, 'p1') });
  assert.equal(s.pawns.def1.darkvision, 60);
  const bring = REGISTRY['pawn.bring'].fill(s, { id: 't2', def: 'def1', x: 5, z: 5 });
  s = run(s, 'pawn.bring', bring);
  assert.equal(s.areas.a.entities.t2.darkvision, 60);
  s = run(s, 'pawn.define', { id: 'def1', darkvision: null });
  assert.equal('darkvision' in s.pawns.def1, false);
});

test('a light\'s own radius: object.set lightRadius, null = its kind\'s', () => {
  let s = world();
  s = run(s, 'object.place', { id: 'o1', x: 5, z: 5, cat: 'torch-stand' });
  assert.equal(chk(s, 'gm', 'object.set', { id: 'o1', lightRadius: 15 }), null);
  assert.ok(chk(s, 'gm', 'object.set', { id: 'o1', lightRadius: 900 }));
  s = run(s, 'object.set', { id: 'o1', lightRadius: 15 });
  assert.equal(lightRadiusOf(s.areas.a.entities.o1, 'torch'), 15);
  s = run(s, 'object.set', { id: 'o1', lightRadius: null });
  assert.equal('lightRadius' in s.areas.a.entities.o1, false); assert.equal(lightRadiusOf(s.areas.a.entities.o1, 'torch'), 40);
});

// COST (DARK_BENCH=1): the worker's work per vision update on the 50-room fixture with 50 lights and 4 pawns, plain fog
// of war vs a dark area, warm light cache (a pawn moved) and cold (the walls changed). CPU, Node; the worker runs the same code.
import { computeVision, blockingSegments as BS } from '../client/vision.js';
import { maskLevels } from '../client/fog-grid.js';
import { unionLevels } from '../core/fog.js';
import { makeRoomGen } from '../core/roomgen.js';
import * as walls_ from '../../tools/spawn-tuner/js/walls.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import * as solver2 from '../../tools/spawn-tuner/js/solver2.js';
import { readFileSync } from 'node:fs';
if (process.env.DARK_BENCH) test('cost: 50 rooms, 50 lights, 4 pawns (CPU)', t => {
  const read = n => JSON.parse(readFileSync(new URL('../tuner-data/' + n, import.meta.url)));
  const roomgen = makeRoomGen({ walls: walls_, solver, solver2, lib: read('library.json'), types: read('types.json'), orient: {}, version: 'dark-bench' });
  const entities = Object.fromEntries(Array.from({ length: 50 }, (_, i) => { const id = 'r' + i; return [id, { id, kind: 'room', order: i, recipe: { type: 'bedroom', x: (i % 10) * 4, z: Math.floor(i / 10) * 4, w: 4, d: 4, seed: i + 1, wallSeed: i * 7 + 1 } }]; }));
  const edges = roomgen.edges(entities).edges;
  for (const e of edges.values()) if (e.kind === 'door') entities['o' + e.key] = { kind: 'edge', key: e.key, as: 'open' }; // every door open: the most sight
  const B = [-30, -30, 230, 130];
  const lights = Array.from({ length: 50 }, (_, i) => ({ x: (i % 10) * 20 + 4.3, z: Math.floor(i / 10) * 20 + 6.1, level: 0, radius: [10, 40, 60, 40, 20][i % 5] }));
  const pawns = i => Object.fromEntries(Array.from({ length: 4 }, (_, k) => ['p' + k, pawn('p' + k, 'a', 7.5 + k * 20 + (i % 3), 7.5 + (i % 2) * 5)]));
  const times = fn => { const out = []; for (let i = 0; i < 120; i++) { const s = performance.now(); fn(i); if (i >= 20) out.push(performance.now() - s); } out.sort((a, b) => a - b); return { medianMs: +out[50].toFixed(3), p95Ms: +out[95].toFixed(3) }; };
  const plain = times(i => { const E = { ...entities, ...pawns(i) }, v = computeVision({ entities: E, edges, viewer: 'a', seats, bounds: B }); const c = rasterVision(v, B); maskLevels(c, unionLevels({}, c), B, [0], v); });
  const cache = new Map(), wallMap = new Map();
  const darkRun = (i, cold) => { const E = { ...entities, ...pawns(i) }; if (cold) { cache.clear(); wallMap.clear(); }
    const s = darkSight({ entities: E, edges, lights, hint: 2, bounds: B, cache, walls: wallMap, viewer: 'a', seats }); const r = rasterDark(s, B);
    maskLevels(r.current, unionLevels({}, r.reach), B, [0], s, (b, step) => rasterDark(s, b, step, { hint: false }).current); return s; };
  const warm = times(i => darkRun(i, false)), cold = times(i => darkRun(i, true));
  const used = darkRun(0, false).get(0).lights;
  t.diagnostic(JSON.stringify({ rooms: 50, lights: 50, lightsConsidered: used, pawns: 4, plain, darkWarm: warm, darkCold: cold, addedWarmMedianMs: +(warm.medianMs - plain.medianMs).toFixed(3), addedColdMedianMs: +(cold.medianMs - plain.medianMs).toFixed(3) }));
});

// ---------------- the light reach look (2026-10-21; core/darkness.js lightTable, tuner fx/lightreach.js) ----------------
import fs from 'node:fs';
import { lightTable, LIGHT_BRIGHT, LIGHT_KINDS } from '../core/darkness.js';
import { REACH_DEFAULTS, BRIGHT_DEFAULTS, reachTable, LIGHT_KINDS as TUNER_KINDS } from '../../tools/spawn-tuner/js/fx/lightreach.js';
import { lightOf, fireTypeOf } from '../relay/things.js';
const TUNER = new URL('../../tools/spawn-tuner/', import.meta.url).pathname;
const LIB = JSON.parse(fs.readFileSync(TUNER + 'data/library.json', 'utf8'));
const fireType = fireTypeOf(TUNER + 'js');

// THE TABLE: every catalog piece that is a light (a fire type, or `aff: lit`), and the row it lands in. A new light piece
// in the catalog fails this test until it is given a row here (on purpose: someone decides how far it reaches).
const ROWS = {
  candle: 'candelabra candelabra-standing candle candle-black candle-box-sconce candle-cluster candle-drippings-mound candle-stubs-dish candle-tree candlestand-pricket candlestick candlestick-floor flavor-censer prayer-candle-rack rite-bone-candelabra rite-memorial-sand-tray rite-offering-candles-tray rite-pillar-candle-tall rushlight-holder rushlight-holder-wall sconce-candle-double sconce-candle-single sconce-candle-triple shrine-wayside skull-candle',
  // oil lamps: every id with "lamp" except the street lights (lamp-post-*, lamp-pole), which stay lanterns
  lamp: 'lamp-oil-brass lamp-wall-bracket lamp-wall-shelf mine-lamp-rack oil-lamp rite-sanctuary-lamp',
  lantern: 'lamp-pole lamp-post-iron lamp-post-wood lantern-hand lantern-hanging lantern-pierced-tin lantern-post lantern-post-indoor lantern-wall-brass lantern-wall-horn lantern-wall-iron mil-guard-lantern rural-lantern-barn watch-lantern-bell',
  torch: 'cresset-wall torch-bracket-fine torch-bracket-rough torch-sconce torch-stand',
  fire: 'brazier-irons brazier-large brazier-standing brazier-tripod cauldron-crane cook-hearth-spit elemental-brazier fire-basket-stand fire-ring-iron firepit-log-spit firepit-stone-round firepit-sunken fireplace-grand fireplace-marble fireplace-wall forge hearth-central hearth-central-hood hearth-raised-square mil-boiling-oil-pot mil-signal-beacon pig-on-spit rite-sacred-flame-bowl',
  chandelier: 'chandelier-grand chandelier-ring',
  oven: 'alch-athanor bread-oven bread-oven-open brew-copper dutch-oven kiln-pottery smelter',
  glow: 'arcane-pylon crystal-formation crystal-glowing kebab-grill pumpkin-carved sconce-reflector stew-pot-full',
};

test('every catalog light lands in its row of the table (lamps are not lanterns)', () => {
  assert.ok(fireType, 'the tuner fire.js fireType is readable');
  const want = {}; for (const [k, ids] of Object.entries(ROWS)) for (const id of ids.split(' ')) want[id] = k;
  const got = {};
  for (const [id, o] of Object.entries(LIB.objects)) { const k = lightKind(id, fireType(id) || null, o.aff || []); if (k) got[id] = k; }
  for (const [id, k] of Object.entries(got)) assert.equal(k, want[id] ?? '(not in the test table)', id);
  for (const id of Object.keys(want)) assert.ok(got[id], `${id} is still a light`);
  // every fire type and every `aff: lit` piece is a light at all
  for (const [id, o] of Object.entries(LIB.objects)) if (fireType(id) || o.aff?.includes('lit')) assert.ok(got[id], `${id} is a light`);
  assert.deepEqual(Object.keys(ROWS).sort(), [...LIGHT_KINDS].sort());
});

test('the override chain: no look = today except lamp 45; the look\'s rows; scale; dim off; a GM\'s own radius wins', () => {
  // no house look: the table of 2026-10-20 exactly, but for the new lamp row (45, D&D's lamp; it was lantern 60)
  const today = { candle: 10, lamp: 45, lantern: 60, torch: 40, fire: 40, chandelier: 40, oven: 10, glow: 20 };
  for (const p of [undefined, null, {}, { dark: { hint: 2 } }, { name: 'fogwar-default', bank: {}, dark: { hint: 3 } }]) assert.deepEqual(lightTable(p), today);
  assert.deepEqual(lightTable(null), LIGHT_RADII);
  // a look's own rows (others stay), clamped 0..120; a broken value falls back to the default
  assert.deepEqual(lightTable({ reach: { torch: 25, lamp: 300, candle: -4, glow: 'x' } }), { ...today, torch: 25, lamp: 120, candle: 0 });
  // the overall scale, clamped 0.25 .. 1.5
  assert.deepEqual(lightTable({ dark: { scale: 0.5 } }), Object.fromEntries(Object.entries(today).map(([k, v]) => [k, v / 2])));
  assert.equal(lightTable({ dark: { scale: 9 } }).lantern, 90); assert.equal(lightTable({ dark: { scale: 0 } }).lantern, 15);
  // Count dim light off: bright only (PHB candle 5, lamp 15, lantern 30, torch 20; the rest are guesses), its own rows
  assert.deepEqual(lightTable({ dark: { dim: false } }), { candle: 5, lamp: 15, lantern: 30, torch: 20, fire: 20, chandelier: 20, oven: 5, glow: 10 });
  assert.deepEqual(lightTable({ dark: { dim: false } }), LIGHT_BRIGHT);
  assert.equal(lightTable({ dark: { dim: false }, reach: { torch: 99 }, bright: { torch: 15 } }).torch, 15);
  assert.equal(lightTable({ dark: { dim: false, scale: 1.5 }, bright: { lamp: 10 } }).lamp, 15);
  // a GM's own lightRadius on the thing beats every table and is never scaled
  const t = lightTable({ dark: { dim: false, scale: 0.5 } });
  assert.equal(lightRadiusOf({ lightRadius: 35 }, 'torch', t), 35); assert.equal(lightRadiusOf({}, 'torch', t), 10); assert.equal(lightRadiusOf({}, 'lamp'), 45);
  // the tuner's copy (its sliders' defaults and its dark preview) is the same table, rule for rule
  assert.deepEqual(REACH_DEFAULTS, LIGHT_RADII); assert.deepEqual(BRIGHT_DEFAULTS, LIGHT_BRIGHT); assert.deepEqual(TUNER_KINDS, LIGHT_KINDS);
  for (const p of [null, { dark: { scale: 0.7 } }, { dark: { dim: false }, bright: { glow: 40 } }, { reach: { lamp: 15 }, dark: { scale: 1.25 } }, { dark: { scale: 3 } }]) assert.deepEqual(reachTable(p), lightTable(p));
});

test('the GET API reports the effective radius (the relay\'s house table, else the core table)', () => {
  const rt = (table) => ({ roomgen: { lib: LIB, fireType, ...(table && { lightTable: table }) } });
  const lamp = { kind: 'object', cat: 'lamp-oil-brass' }, post = { kind: 'object', cat: 'lamp-pole', lit: false }, own = { kind: 'object', cat: 'torch-sconce', lightRadius: 12 };
  assert.deepEqual(lightOf(rt(null), lamp), { kind: 'lamp', radius: 45, lit: true });
  assert.deepEqual(lightOf(rt(null), post), { kind: 'lantern', radius: 60, lit: false });
  const bright = lightTable({ dark: { dim: false } });
  assert.equal(lightOf(rt(bright), lamp).radius, 15); assert.equal(lightOf(rt(bright), post).radius, 30); assert.equal(lightOf(rt(bright), own).radius, 12);
  assert.equal(lightOf(rt(null), { kind: 'object', cat: 'barrel' }), null);
});
