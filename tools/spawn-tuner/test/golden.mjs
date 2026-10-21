// "The inn is unchanged": every room type that exists today must lay out EXACTLY as it did, with the integration applied
// and the whole batch in the library.     node tests/golden.mjs <pristine tuner dir> <integrated tuner dir> [--print]
// Solves the same rooms with both trees (their own solver.js / solver2.js / walls.js and their own data/) and compares
// every placement (id, sku, position, turn, size), every wall edge (kind, family, door type, span) and the v1 engine too.
// --faction-fix accepts ONLY the exact before/after scene hashes in faction-golden.json (2026-10-13).
// --record-faction-fix re-records those religious classic scenes; refuses any v2/wall change. Review before committing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const [A, B] = process.argv.slice(2, 4).map(p => resolve(p) + '/');
const load = async (dir) => {
  const s2 = await import(dir + 'js/solver2.js'), s1 = await import(dir + 'js/solver.js'), w = await import(dir + 'js/walls.js');
  const lib = JSON.parse(readFileSync(dir + 'data/library.json')), types = JSON.parse(readFileSync(dir + 'data/rooms.json')), orient = JSON.parse(readFileSync(dir + 'data/orient.json'));
  return { s1, s2, w, lib, types, orient, T: Object.fromEntries(types.map(t => [t.key, t])) };
};
const P = await load(A), N = await load(B);
const recordFaction = process.argv.includes('--record-faction-fix'), acceptFaction = process.argv.includes('--faction-fix');
const recordFile = new URL('./faction-golden.json', import.meta.url);
const accepted = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile)) : { scenes: {} };
const recorded = { reason: 'One faction per room: blind classic rolls mixed sun/moon in Temple rooms and devils/spiders in four Cult rooms.', scenes: {} };
const recordRecipes = process.argv.find(a => a.startsWith('--record-recipes='))?.slice('--record-recipes='.length);
const acceptRecipes = process.argv.find(a => a.startsWith('--accept-recipes='))?.slice('--accept-recipes='.length);
const recipeExpected = acceptRecipes ? JSON.parse(readFileSync(acceptRecipes)) : {scenes:{}};
const recipeRecorded = {reason:'Reviewed faction corbel recipes and sun idol replacement', scenes:{}};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const factionRoom = t => t.startsWith('temple-') || ['cathedral', 'cathedral-dark', 'cult-passage', 'cult-sanctum', 'cult-summoning', 'cult-vault'].includes(t);
const OLD = P.types.map(t => t.key).filter(t => !recordFaction || factionRoom(t));
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
const allowed = new Set((process.argv.find(a => a.startsWith('--allow-types=')) || '').slice('--allow-types='.length).split(',').filter(Boolean));
let n = 0, diff = 0, intentional = 0; const byType = {};
for (const type of OLD) for (const [w, d] of SIZES[type] || [[4, 4]]) for (const arr of ['alone', 'inn']) for (let seed = 1; seed <= 6; seed++) {
  const a = scene(P, type, w, d, seed * 101 + w, arr), b = scene(N, type, w, d, seed * 101 + w, arr);
  n++;
  const bad = a.findIndex((x, i) => x !== b[i]);
  if (bad >= 0 || a.length !== b.length) {
    const key = `${type} ${w}x${d} ${arr} seed ${seed * 101 + w}`, hashes = { before: digest(a), after: digest(b) };
    if (recordFaction && factionRoom(type)) {
      if (JSON.stringify(a.slice(0, -1)) !== JSON.stringify(b.slice(0, -1))) throw new Error(`Refusing to record a non-classic faction difference: ${key}`);
      recorded.scenes[key] = hashes;
    }
    const known = accepted.scenes[key];
    if (recordRecipes && allowed.has(type)) recipeRecorded.scenes[key] = hashes;
    const recipeKnown = recipeExpected.scenes[key];
    if ((recordRecipes && allowed.has(type)) || (acceptRecipes && recipeKnown?.before === hashes.before && recipeKnown?.after === hashes.after) || (acceptFaction && factionRoom(type) && known?.before === hashes.before && known?.after === hashes.after)) intentional++;
    else diff++;
    (byType[type] ||= []).push(`${w}x${d} ${arr} seed ${seed * 101 + w}`);
    if (process.argv.includes('--print') && diff <= 6) { // first differing placement
      const xa = a[bad].split(';'), xb = b[bad].split(';'), k = xa.findIndex((x, i) => x !== xb[i]);
      console.log(`DIFF ${type} ${w}x${d} ${arr}: part ${bad}, item ${k}\n   was ${xa[k]}\n   now ${xb[k]}`);
    }
  }
}
if (recordRecipes && !diff) writeFileSync(recordRecipes, JSON.stringify(recipeRecorded, null, 2) + '\n');
if (recordFaction) writeFileSync(recordFile, JSON.stringify(recorded, null, 2) + '\n');
console.log(`golden: ${n} scenes of ${OLD.length} existing room types (v2 for every room in the scene, v1 for the first, and the wall map); ${diff} unaccepted differences; ${intentional} accepted recipe/faction differences`);
for (const [t, l] of Object.entries(byType)) console.log(`  ${t}: ${l.length} differ, e.g. ${l.slice(0, 3).join('; ')}`);
process.exit(diff && !recordFaction ? 1 : 0);
