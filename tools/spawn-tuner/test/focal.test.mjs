// General rules (Harry 2026-10-01, "right, and generalize"): node tools/spawn-tuner/test/focal.test.mjs
// 1. AXIAL FOCAL PLACEMENT: a showpiece key feature sits on the wall OPPOSITE the main door, CENTRED, companions flanking it
//    symmetrically (beds: nightstands both sides; the front-desk counter: the keeper behind, candles at both ends); it is
//    exempt from the coffin / blast-line penalty; it falls back only when the facing wall can't fit it + both flankers.
//    Instances: the guest and fine-room beds (fine: unless promoted to the centre island), the front-desk counter, the
//    common-room hearth when the wall facing the door is a short wall.
// 2. GRADE FLOOR: rooms have a wealth, objects a grade; a fine room never places poor-grade objects (no straw pallet ever;
//    the servant's bed is at least a common bed).
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2, gradeOf } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', m); } };
const SEEDS = Array.from({ length: 12 }, (_, i) => (i + 1) * 5381 + 7);
function solve(type, w, d, seed) {
  const r = { id: 'r1', type, x: 2, z: 2, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created: 1 };
  r.extDoor = chooseExteriorDoor(r, [r]); const E = computeEdges([r], { engine: 'v2' });
  return solveRoom2({ lib, type: T[type], room: r, openings: E.openings.get('r1'), opts: { orient }, roomTypeOf: () => null });
}
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const box = (L) => { const g = L.grid; return [g.x0, g.z0, g.x0 + g.nx * g.res, g.z0 + g.nz * g.res]; };
// where p sits on the wall facing the main door: distance from that wall and offset from its centre
function onFarWall(L, p) {
  const [X0, Z0, X1, Z1] = box(L), side = OPP[L.mainDoor.side];
  const fromWall = { N: p.z - Z0, S: Z1 - p.z, W: p.x - X0, E: X1 - p.x }[side];
  const off = side === 'N' || side === 'S' ? p.x - (X0 + X1) / 2 : p.z - (Z0 + Z1) / 2;
  return { side, fromWall, off };
}
const counts = { bedFocal: 0, bedN: 0, deskFocal: 0, deskN: 0, hearthFocal: 0, hearthN: 0 };
// ---- beds: guest (non-dorm sizes) and fine (not promoted)
for (const [type, sizes] of [['guest', [[3, 3], [4, 3], [4, 4]]], ['fine', [[3, 4], [4, 4], [5, 5], [6, 4]]]]) for (const [w, d] of sizes) for (const seed of SEEDS) {
  const L = solve(type, w, d, seed), tag = `${type} ${w * 5}x${d * 5} s${seed}`, sum = summarize2(L);
  const bed = L.placements.find(p => /^bed-/.test(p.id) && p.layer === 'anchor');
  ok(bed, `${tag}: no bed`); if (!bed) continue;
  ok(/^Focal: /m.test(sum), `${tag}: summary has no Focal line`);
  if (bed.rule === 'key-bed-island') continue; // promoted (big fine rooms): the centre island rule applies instead
  counts.bedN++;
  if (!L.focal?.ok) { ok(/can't fit|under/.test(L.focal?.why || ''), `${tag}: bed not focal without a size reason (${L.focal?.why})`); continue; }
  counts.bedFocal++;
  const f = onFarWall(L, bed);
  ok(bed.rule === 'key-bed-focal' && f.fromWall < bed.dims[2] / 2 + 0.6 && Math.abs(f.off) <= 1.5, `${tag}: focal bed not centred on the ${f.side} wall (off ${f.off.toFixed(1)} ft, ${f.fromWall.toFixed(1)} ft out)`);
  // nightstands on BOTH sides (lateral offsets of opposite sign along the bed's width axis)
  const lx = Math.cos(bed.rot), lz = -Math.sin(bed.rot);
  const ns = L.placements.filter(p => p.rule === 'nightstand').map(p => (p.x - bed.x) * lx + (p.z - bed.z) * lz);
  ok(ns.some(v => v > 0.5) && ns.some(v => v < -0.5) && ns.every(v => Math.abs(v) < bed.dims[0] / 2 + 3), `${tag}: nightstands not on both sides of the focal bed (${ns.map(v => v.toFixed(1))})`);
  // exempt from the coffin / blast penalty
  const cmd = L.checks.command.find(c => c.uid === bed.uid);
  ok(cmd && !cmd.blast && cmd.focal, `${tag}: focal bed still flagged as a coffin`);
}
// ---- the front-desk counter
for (const [w, d] of [[3, 3], [4, 3], [4, 4], [5, 4]]) for (const seed of SEEDS.slice(0, 8)) {
  const L = solve('desk', w, d, seed), tag = `desk ${w * 5}x${d * 5} s${seed}`;
  const c = L.placements.find(p => p.id === 'counter-shop'); ok(c, `${tag}: no counter`); if (!c) continue;
  counts.deskN++;
  if (!L.focal?.ok) continue;
  counts.deskFocal++;
  const f = onFarWall(L, c);
  ok(Math.abs(f.off) <= 1.5, `${tag}: focal counter not centred (off ${f.off.toFixed(1)})`);
  ok(L.placements.some(p => p.rule === 'keeper'), `${tag}: no keeper's chair behind the focal counter`);
}
// ---- the common-room hearth: axial only when the wall facing the door is a short wall (otherwise noted)
for (const [w, d] of [[6, 4], [4, 6], [6, 6], [8, 5]]) for (const seed of SEEDS.slice(0, 6)) {
  const L = solve('common', w, d, seed), tag = `common ${w * 5}x${d * 5} s${seed}`, sum = summarize2(L);
  const h = L.placements.find(p => p.id === 'fireplace-wall'); if (!h) continue;
  counts.hearthN++;
  ok(/^Focal: hearth/m.test(sum), `${tag}: no Focal line for the hearth`);
  if (L.focal?.ok) { counts.hearthFocal++; const f = onFarWall(L, h); ok(Math.abs(f.off) <= 1.5, `${tag}: focal hearth not centred (off ${f.off.toFixed(1)})`); }
}
// ---- grade floor: no poor-grade object in a fine room, ever (servant's corner included)
let fineObjs = 0, servants = 0;
for (const [w, d] of [[3, 4], [4, 4], [6, 6], [8, 11], [10, 10]]) for (const seed of SEEDS) {
  const L = solve('fine', w, d, seed), tag = `fine ${w * 5}x${d * 5} s${seed}`;
  fineObjs += L.placements.length;
  const poor = L.placements.filter(p => gradeOf(p.id) === 0);
  ok(!poor.length, `${tag}: poor-grade objects in a fine room: ${[...new Set(poor.map(p => p.id))].join(', ')}`);
  ok(!L.placements.some(p => p.id === 'bed-straw-pallet'), `${tag}: a straw pallet in a fine room`);
  const sv = L.zones.find(z => z.kind === 'servant');
  if (sv) { servants++; const b = sv.items.map(u => L.placements.find(p => p.uid === u)).find(p => p && /^bed-/.test(p.id)); ok(b && b.id !== 'bed-straw-pallet', `${tag}: servant's bed below common (${b?.id})`); }
}
ok(servants >= 3, `only ${servants} fine rooms got a servant's corner to check`);
// common rooms are unaffected: a guest dorm may still roll straw pallets
let pallets = 0; for (const seed of SEEDS) { const L = solve('guest', 10, 12, seed); pallets += L.placements.filter(p => p.id === 'bed-straw-pallet').length; }
ok(pallets > 0, 'the grade floor leaked into common rooms (no dorm ever rolls straw pallets)');
console.log(`focal beds ${counts.bedFocal}/${counts.bedN}, counters ${counts.deskFocal}/${counts.deskN}, hearths ${counts.hearthFocal}/${counts.hearthN}; fine rooms checked ${fineObjs} objects, ${servants} servant corners; dorm pallets still rolled ${pallets}`);
console.log(`focal: ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
