// Old tree vs this tree: every room type x sizes x seeds; the placements must be identical except the height of floor flats.
//   node experiments/2026-11-07-streetfix/ydiff.mjs <old tuner dir> <new tuner dir>
import { readFileSync } from 'node:fs'; import { resolve } from 'node:path';
const load = async (d) => { d = resolve(d) + '/'; const s2 = await import(d + 'js/solver2.js'), w = await import(d + 'js/walls.js'); const lib = JSON.parse(readFileSync(d + 'data/library.json')), types = JSON.parse(readFileSync(d + 'data/rooms.json')), orient = JSON.parse(readFileSync(d + 'data/orient.json')); return { s2, w, lib, types, orient, T: Object.fromEntries(types.map(t => [t.key, t])) }; };
const [A, B] = [await load(process.argv[2]), await load(process.argv[3])];
const solve = (S, key, w, d, seed) => { const r = { id: 'r', type: key, x: 10, z: 10, w, d, seed, wallSeed: seed * 3 + 1, created: 1 }; r.family = S.w.familyFor(r, S.T[key].family); r.extDoor = S.w.chooseExteriorDoor(r, [r]); const E = S.w.computeEdges([r], { engine: 'v2' }); return S.s2.solveRoom2({ lib: S.lib, type: S.T[key], room: r, openings: E.openings.get('r'), opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: () => key }); };
let rooms = 0, same = 0, yOnly = 0, other = 0, moved = 0; const ex = [];
for (const t of A.types) for (const [w, d] of [[6, 5], [10, 5], [8, 8]]) for (let s = 1; s <= 3; s++) {
  const seed = s * 977 + w * 13 + d; let a, b; try { a = solve(A, t.key, w, d, seed); b = solve(B, t.key, w, d, seed); } catch { continue; } rooms++;
  const k = (p, y) => [p.id, p.sku, p.x, y ? p.y : '', p.z, p.rot, p.dims.join('x'), p.rule].join(',');
  const fa = a.placements.map(p => k(p, p.orient !== 'floor')).join(';'), fb = b.placements.map(p => k(p, p.orient !== 'floor')).join(';');
  if (fa !== fb) { other++; if (ex.length < 5) ex.push(t.key); continue; }
  const full = a.placements.map(p => k(p, true)).join(';') === b.placements.map(p => k(p, true)).join(';');
  if (full) same++; else { yOnly++; moved += a.placements.filter((p, i) => p.y !== b.placements[i].y).length; }
}
console.log({ rooms, identical: same, floorFlatHeightsOnly: yOnly, flatsRaised: moved, anythingElseChanged: other, examples: ex });
process.exit(other ? 1 : 0);
