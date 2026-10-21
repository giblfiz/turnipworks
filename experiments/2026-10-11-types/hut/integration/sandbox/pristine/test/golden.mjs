// "The inn is unchanged": every room type that exists today must lay out EXACTLY as it did, with the integration applied
// and the whole batch in the library.     node tests/golden.mjs <pristine tuner dir> <integrated tuner dir> [--print]
// Solves the same rooms with both trees (their own solver.js / solver2.js / walls.js and their own data/) and compares
// every placement (id, sku, position, turn, size), every wall edge (kind, family, door type, span) and the v1 engine too.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const [A, B] = process.argv.slice(2, 4).map(p => resolve(p) + '/');
const load = async (dir) => {
  const s2 = await import(dir + 'js/solver2.js'), s1 = await import(dir + 'js/solver.js'), w = await import(dir + 'js/walls.js');
  const lib = JSON.parse(readFileSync(dir + 'data/library.json')), types = JSON.parse(readFileSync(dir + 'data/rooms.json')), orient = JSON.parse(readFileSync(dir + 'data/orient.json'));
  return { s1, s2, w, lib, types, orient, T: Object.fromEntries(types.map(t => [t.key, t])) };
};
const P = await load(A), N = await load(B);
const OLD = P.types.map(t => t.key);
const mk = (S, id, type, x, z, w, d, seed, created) => { const r = { id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, created }; r.family = S.w.familyFor(r, S.T[type].family); return r; };
const SIZES = { common: [[6, 4], [8, 6], [4, 4]], kitchen: [[4, 3], [6, 6], [8, 6]], storeroom: [[3, 3], [5, 5]], cellar: [[4, 3], [6, 5]], guest: [[3, 3], [4, 4], [8, 6]], fine: [[4, 4], [6, 6], [10, 8]],
  privy: [[2, 2], [3, 3]], hallway: [[6, 2], [10, 2]], desk: [[3, 3], [5, 4]], stable: [[6, 4], [8, 8]], barn: [[6, 5], [8, 6]], yard: [[6, 5], [8, 8], [3, 3]] };
function scene(S, type, w, d, seed, arr) {
  const rooms = [mk(S, 'a', type, 10, 10, w, d, seed, 1)];
  if (arr === 'inn') { rooms.push(mk(S, 'c', 'common', 10, 6, 6, 4, seed + 1, 2), mk(S, 'k', 'kitchen', 10 + w, 10, 4, 3, seed + 2, 3), mk(S, 'y', 'yard', 10, 10 + d, w, 4, seed + 3, 4)); }
  const made = []; for (const r of rooms) { made.push(r); r.extDoor = S.w.chooseExteriorDoor(r, made); }
  const E = S.w.computeEdges(rooms, { engine: 'v2' });
  const edges = [...E.edges.values()].map(e => [e.key, e.kind, e.family, e.doorType || '', e.span || 1, e.panel || '', e.doorLeaf || ''].join('|')).sort().join(';');
  const out = [edges];
  for (const r of rooms) {
    const L = S.s2.solveRoom2({ lib: S.lib, type: S.T[r.type], room: r, openings: E.openings.get(r.id), opts: { orient: S.orient, minStars: 3, hideMasking: true }, roomTypeOf: (q) => rooms.find(x => x.id === q)?.type });
    out.push(r.id + ':' + L.score + ':' + L.placements.map(p => [p.id, p.sku, p.x, p.y, p.z, p.rot, p.dims.join('x'), p.rule].join(',')).join(';'));
  }
  const r0 = rooms[0], E1 = S.w.computeEdges(rooms);
  const L1 = S.s1.solveRoom({ lib: S.lib, type: S.T[r0.type], room: r0, openings: E1.openings.get(r0.id), opts: { orient: S.orient, minStars: 3, hideMasking: true } });
  out.push('v1:' + L1.placements.map(p => [p.id, p.sku, p.x, p.z, p.rot].join(',')).join(';'));
  return out;
}
let n = 0, diff = 0; const byType = {};
for (const type of OLD) for (const [w, d] of SIZES[type] || [[4, 4]]) for (const arr of ['alone', 'inn']) for (let seed = 1; seed <= 6; seed++) {
  const a = scene(P, type, w, d, seed * 101 + w, arr), b = scene(N, type, w, d, seed * 101 + w, arr);
  n++;
  const bad = a.findIndex((x, i) => x !== b[i]);
  if (bad >= 0 || a.length !== b.length) {
    diff++; (byType[type] ||= []).push(`${w}x${d} ${arr} seed ${seed * 101 + w}`);
    if (process.argv.includes('--print') && diff <= 6) { // first differing placement
      const xa = a[bad].split(';'), xb = b[bad].split(';'), k = xa.findIndex((x, i) => x !== xb[i]);
      console.log(`DIFF ${type} ${w}x${d} ${arr}: part ${bad}, item ${k}\n   was ${xa[k]}\n   now ${xb[k]}`);
    }
  }
}
console.log(`golden: ${n} scenes of ${OLD.length} existing room types (v2 for every room in the scene, v1 for the first, and the wall map); ${diff} differ`);
for (const [t, l] of Object.entries(byType)) console.log(`  ${t}: ${l.length} differ, e.g. ${l.slice(0, 3).join('; ')}`);
process.exit(diff ? 1 : 0);
