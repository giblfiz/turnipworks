// Zones from ROOMS.md (Harry + Fauna, 2026-10-01): node tools/spawn-tuner/test/zones.test.mjs
// Zone anatomy (companions, working faces, dividers, like with like, privacy gradient, floating seating), the growth
// modes (promote / repeat / extend, dormitory, seat bank) and the new zones per room. Fixtures come from Harry's notes and
// moves in reviews/tuner/map.jsonl: the peel goes with the oven, the bread rack must not block it, the oven mouth stays
// clear, the big fine-room bed becomes the centerpiece, screens separate zones (not on walls), tubs live together and
// bathing gets privacy, armchairs come ~3 ft off the walls.
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2 } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor, CELL } from '../js/walls.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', m); } };
const SEEDS = Array.from({ length: 10 }, (_, i) => (i + 1) * 4243 + 17);

function build(rooms, which) {
  for (const r of rooms) if (r.extDoor === undefined) r.extDoor = chooseExteriorDoor(r, rooms);
  const E = computeEdges(rooms, { engine: 'v2' }), r = rooms.find(x => x.id === which);
  return solveRoom2({ lib, type: T[r.type], room: r, openings: E.openings.get(r.id), opts: { orient }, roomTypeOf: (id) => rooms.find(x => x.id === id)?.type });
}
const mk = (id, type, x, z, w, d, seed, created = 1) => ({ id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created });
const solve = (type, w, d, seed) => build([mk('r1', type, 2, 2, w, d, seed)], 'r1');
const box = (L) => { const g = L.grid; return [g.x0, g.z0, g.x0 + g.nx * g.res, g.z0 + g.nz * g.res]; };
const wallDist = (L, x, z) => { const [X0, Z0, X1, Z1] = box(L); return Math.min(x - X0, X1 - x, z - Z0, Z1 - z); };
const aabb = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; };
const overlap = (a, b) => { const [aw, ad] = aabb(a), [bw, bd] = aabb(b); return Math.abs(a.x - b.x) < (aw + bw) / 2 - 0.05 && Math.abs(a.z - b.z) < (ad + bd) / 2 - 0.05; };
// the working face of p as a pseudo-placement (depth ft in front, its width + 0.5)
const face = (p, depth) => { const fx = Math.sin(p.rot), fz = Math.cos(p.rot), off = p.dims[2] / 2 + depth / 2; return { x: p.x + fx * off, z: p.z + fz * off, rot: p.rot, dims: [p.dims[0] + 0.5, 0, depth] }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const zc = (z) => ({ x: (z.rect[0] + z.rect[2]) / 2, z: (z.rect[1] + z.rect[3]) / 2 });
const FACES = { 'bread-oven': 4, 'cook-hearth-spit': 4, wardrobe: 2.5, cupboard: 2.5 };
const floorThings = (L) => L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall' && p.rule !== 'wall-mount' && p.rule !== 'ceiling');

// ---- 1. bake corner: the peel goes WITH the oven (within reach), nothing stands in the oven's mouth
let peelNear = 0, peelTotal = 0;
for (const [w, d] of [[8, 12], [5, 6], [6, 6]]) for (const seed of SEEDS) {
  const L = solve('kitchen', w, d, seed), tag = `kitchen ${w * 5}x${d * 5} s${seed}`;
  const ov = L.placements.find(p => p.id === 'bread-oven');
  if (!ov) continue;
  const peel = L.placements.find(p => p.id === 'bread-peel');
  peelTotal++; if (peel && dist(peel, ov) <= 7.5) peelNear++;
  for (const p of floorThings(L)) if (p.uid !== ov.uid) ok(!overlap(p, face(ov, 4)), `${tag}: ${p.id} stands in front of the oven's mouth`);
}
ok(peelTotal > 0 && peelNear / peelTotal >= 0.8, `the peel is within reach of the oven in only ${peelNear}/${peelTotal} kitchens`);

// ---- 2. working faces kept clear (ovens, cooking hearths, wardrobes, cupboards) in every type that has them
for (const t of ['kitchen', 'fine', 'guest']) for (const [w, d] of [T[t].cells, [8, 8]]) for (const seed of SEEDS.slice(0, 6)) {
  const L = solve(t, w, d, seed), things = floorThings(L);
  for (const a of things.filter(p => FACES[p.id])) for (const p of things) if (p.uid !== a.uid && p.with !== a.uid) ok(!overlap(p, face(a, FACES[a.id])), `${t} ${w * 5}x${d * 5} s${seed}: ${p.id} (${p.rule}) blocks the working face of ${a.id}`);
}

// ---- 3-8. fine rooms: promote, companions, dividers, like with like, privacy gradient, floating seating
let privacyHits = 0, privacyN = 0, twoTubs = 0, screenHits = 0, screenN = 0;
for (const seed of SEEDS) {
  const L = solve('fine', 8, 11, seed), tag = `fine 40x55 s${seed}`, sum = summarize2(L);
  const bed = L.placements.find(p => /^bed-/.test(p.id) && p.layer === 'anchor');
  ok(bed && bed.rule === 'key-bed-island' && wallDist(L, bed.x, bed.z) >= 10, `${tag}: bed not promoted to a centre island (${bed?.rule}, ${bed && wallDist(L, bed.x, bed.z).toFixed(1)} ft from the wall)`);
  ok(L.placements.some(p => /^rug-/.test(p.id) && bed && dist(p, bed) < 1.5), `${tag}: no rug under the bed island`);
  ok(L.placements.filter(p => p.rule === 'nightstand').length >= 1, `${tag}: island bed has no nightstand`);
  ok(/Growth: .*bed promoted/.test(sum), `${tag}: summary doesn't report the promotion`);
  for (const s of L.placements.filter(p => p.id === 'screen-folding')) ok(s.rule === 'zone-divider' && wallDist(L, s.x, s.z) >= 1.5, `${tag}: screen used as wall dressing (${s.rule}, ${wallDist(L, s.x, s.z).toFixed(1)} ft from the wall)`);
  const tubs = L.placements.filter(p => p.id === 'bathtub-wood');
  if (tubs.length >= 2) { twoTubs++; ok(dist(tubs[0], tubs[1]) <= 6.5, `${tag}: tubs apart (${dist(tubs[0], tubs[1]).toFixed(1)} ft): tubs live together`); }
  for (const tb of tubs) ok(L.placements.some(p => p.id === 'towel-stack' && dist(p, tb) <= 8), `${tag}: no towel within reach of the tub`);
  const bath = L.zones.find(z => z.kind === 'bath'), dress = L.zones.find(z => z.kind === 'dress'), seat = L.zones.find(z => z.kind === 'seat');
  ok(bath, `${tag}: no bathing zone`); if (!dress) console.log(`  (note) ${tag}: no dressing area`);
  for (const z of [bath, dress].filter(Boolean)) { screenN++; if (z.items.some(u => L.placements.find(p => p.uid === u)?.rule === 'zone-divider')) screenHits++; }
  const w = L.placements.find(p => p.id === 'wardrobe' && p.zone === 'dress');
  if (w) ok(L.placements.some(p => p.id === 'mirror-standing' && dist(p, w) <= 7), `${tag}: mirror not beside the wardrobe`);
  if (bath && seat && L.mainDoor) { privacyN++; const di = (z) => Math.hypot(zc(z).x - L.mainDoor.inner[0], zc(z).z - L.mainDoor.inner[1]); if (di(bath) > di(seat)) privacyHits++; }
  for (const p of L.placements.filter(p => /^chair/.test(p.id) && p.rule === 'inward-seat')) ok(wallDist(L, p.x, p.z) - p.dims[2] / 2 >= 2.4, `${tag}: ${p.id} in ${p.zone} hugs the wall (${(wallDist(L, p.x, p.z) - p.dims[2] / 2).toFixed(1)} ft): big rooms float their seats`);
  for (const k of ['dine', 'window', 'servant']) if (!L.zones.some(z => z.kind === k)) console.log(`  (note) ${tag}: no ${k} zone`);
}
ok(screenN && screenHits / screenN >= 0.7, `screens shelter only ${screenHits}/${screenN} bathing/dressing zones (a screen loses if it would hide the bed from the door)`);
ok(privacyN && privacyHits / privacyN >= 0.7, `privacy gradient: bathing deeper than sitting in only ${privacyHits}/${privacyN}`);
// a small fine room keeps the bed on the wall
for (const seed of SEEDS.slice(0, 4)) { const L = solve('fine', 4, 4, seed); const bed = L.placements.find(p => /^bed-/.test(p.id) && p.layer === 'anchor'); ok(bed && /^key-bed(-focal)?$/.test(bed.rule), `fine 20x20 s${seed}: bed should stay on the wall, not promoted (${bed?.rule})`); }

// ---- 9. repeat: kitchen cooking lines grow along the walls (never central)
for (const seed of SEEDS.slice(0, 5)) {
  const small = solve('kitchen', 4, 3, seed), big = solve('kitchen', 8, 12, seed);
  const hs = (L) => L.placements.filter(p => p.id === 'cook-hearth-spit');
  ok(hs(small).length === 1, `kitchen 20x15 s${seed}: ${hs(small).length} cooking hearths (want 1)`);
  ok(hs(big).length >= 2 && hs(big).every(h => wallDist(big, h.x, h.z) < h.dims[2]), `kitchen 40x60 s${seed}: cooking line didn't repeat along the walls (${hs(big).length})`);
  ok(/Growth: .*cooking line/.test(summarize2(big)), `kitchen 40x60 s${seed}: summary doesn't report the repeat`);
  for (const k of ['bake', 'pass']) ok(big.zones.some(z => z.kind === k), `kitchen 40x60 s${seed}: no ${k} zone`);
  // the staff table: required in wall kitchens; an industrial kitchen gives its floor to work rows first
  ok(big.zones.some(z => z.kind === 'staff') || big.zones.some(z => z.kind === 'workrows'), `kitchen 40x60 s${seed}: no staff table and no work rows`);
  // an industrial kitchen replaces prep islands with work rows (Harry: "an industrial kitchen basically devolves to aisles")
  ok(big.zones.some(z => z.kind === 'prep' || z.kind === 'workrows'), `kitchen 40x60 s${seed}: no prep island or work rows`);
}

// ---- 10. extend: the bar gets longer as the common room grows
let barSmall = 0, barBig = 0;
for (const seed of SEEDS.slice(0, 6)) {
  barSmall += solve('common', 6, 4, seed).placements.filter(p => p.id === 'bar-counter').length;
  const big = solve('common', 12, 8, seed); barBig += big.placements.filter(p => p.id === 'bar-counter').length;
  ok(big.zones.some(z => z.kind === 'entry'), `common 60x40 s${seed}: no entry landing`);
}
ok(barBig / 6 >= 5 && barBig > barSmall, `bar didn't extend: 30x20 avg ${(barSmall / 6).toFixed(1)}, 60x40 avg ${(barBig / 6).toFixed(1)}`);
// serving station appears when a kitchen door opens off the common room
let serve = 0;
for (const seed of SEEDS.slice(0, 6)) {
  const L = build([mk('c', 'common', 2, 2, 10, 6, seed, 1), mk('k', 'kitchen', 12, 2, 5, 6, seed + 1, 2)], 'c');
  if (L.zones.some(z => z.kind === 'serve')) serve++;
}
ok(serve >= 4, `serving station by the kitchen door in only ${serve}/6 common rooms`);

// ---- 11. dormitory: a big guest room becomes a row of beds sharing wash and stow
const dormRolls = new Set();
for (const seed of SEEDS.slice(0, 6)) {
  const L = solve('guest', 6, 6, seed), beds = L.placements.filter(p => p.rule === 'dorm-bed');
  ok(beds.length >= 4, `guest 30x30 s${seed}: dormitory has only ${beds.length} beds`);
  ok(/Growth: dormitory/.test(summarize2(L)), `guest 30x30 s${seed}: summary doesn't report the dormitory`);
  (L.rolls || []).filter(r => r.startsWith('dormitory beds')).forEach(r => dormRolls.add(r));
  const s = solve('guest', 3, 3, seed);
  ok(s.placements.filter(p => /^bed-/.test(p.id)).length === 1 && !s.placements.some(p => p.rule === 'dorm-bed'), `guest 15x15 s${seed}: should be one bed, no dormitory`);
}
ok(dormRolls.size >= 2, `dormitory bed style never varies across seeds (${[...dormRolls]})`);

// ---- 12. the other new zones
const appear = (t, w, d, kind, min) => { let n = 0; for (const seed of SEEDS.slice(0, 6)) if (solve(t, w, d, seed).zones.some(z => z.kind === kind)) n++; ok(n >= min, `${t} ${w * 5}x${d * 5}: ${kind} zone in only ${n}/6`); };
appear('desk', 4, 4, 'notice', 4);
appear('barn', 8, 8, 'pen', 4); appear('barn', 8, 8, 'feedstore', 4);
appear('cellar', 8, 6, 'cold', 3); appear('storeroom', 10, 8, 'tally', 3);
for (const seed of SEEDS.slice(0, 6)) {
  const p = solve('privy', 2, 3, seed); ok(p.placements.filter(q => /^privy-seat/.test(q.id)).length >= 2, `privy 10x15 s${seed}: no seat bank`);
  const h = solve('hallway', 8, 2, seed); ok(h.placements.some(q => /^(painting|trophy|shield)/.test(q.id)), `hallway 40x10 s${seed}: no display wall`);
  const b = solve('barn', 8, 8, seed);
  for (const z of b.zones.filter(z => z.kind === 'pen')) { const ids = z.items.map(u => b.placements.find(q => q.uid === u)?.id); ok(ids.filter(i => i === 'stable-stall-partition').length === 2 && ids.filter(i => i === 'stable-stall-gate').length === 2, `barn 40x40 s${seed}: pen pieces ${ids.join(',')}`); }
}
console.log(`zones: ${checks} checks, ${fails} failures; privacy ${privacyHits}/${privacyN}; screens ${screenHits}/${screenN}; peel by the oven ${peelNear}/${peelTotal}; two-tub rooms ${twoTubs}/${SEEDS.length}; bar 30x20 ${(barSmall / 6).toFixed(1)} -> 60x40 ${(barBig / 6).toFixed(1)} pieces; serving stations ${serve}/6`);
process.exit(fails ? 1 : 0);
