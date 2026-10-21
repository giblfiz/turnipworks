// Shared by crypt.test.mjs / castle.test.mjs / mansion.test.mjs (modelled on tools/spawn-tuner/test/yard.test.mjs).
// Loads a tuner tree (argv[2], default: the sandbox named for the type), builds scenes, and holds the checks every
// indoor room of the three types must pass: no purpose fail, nothing outside the room, nothing overlapping, the focal
// piece present, paths clear, the key feature in view from the door, deterministic, nothing hung on a door / window /
// special panel, the room lit.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const HERE = dirname(fileURLToPath(import.meta.url));
export async function loadTree(defaultName) {
  const arg = process.argv.slice(2).find(a => !a.startsWith('--'));
  const dir = resolve(arg || `${HERE}/../sandbox/${defaultName}`) + '/';
  const s2 = await import(dir + 'js/solver2.js'), s1 = await import(dir + 'js/solver.js'), w = await import(dir + 'js/walls.js');
  const lib = JSON.parse(readFileSync(dir + 'data/library.json')), types = JSON.parse(readFileSync(dir + 'data/rooms.json')), orient = JSON.parse(readFileSync(dir + 'data/orient.json'));
  return { dir, s1, s2, w, lib, types, orient, T: Object.fromEntries(types.map(t => [t.key, t])) };
}
export const CELL = 5, INSET = 0.5, TOL = 2 / 12;
export const aabb = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; };
export const standing = (L) => L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall' && p.rule !== 'wall-mount' && p.rule !== 'wall-light' && p.rule !== 'ceiling');
export const overlap = (a, b) => { const [aw, ad] = aabb(a), [bw, bd] = aabb(b); return Math.abs(a.x - b.x) < (aw + bw) / 2 - TOL && Math.abs(a.z - b.z) < (ad + bd) / 2 - TOL; };
// the fx module's fireType(), so a "light" is something the game will actually light (js/fx/fire.js imports three.js: mirrored here)
export function fireType(id = '', extra = []) {
  if (/^(fireplace|cook-hearth|hearth)/.test(id) || /-hearth$|^hearth-/.test(id)) return 'hearth';
  if (/rug|rake|mat\b/.test(id)) return null;
  if (/oven/.test(id)) return 'oven';
  if (/brazier|fire-pit|firepit/.test(id)) return 'brazier';
  if (/torch/.test(id)) return 'torch';
  if (/chandelier/.test(id)) return 'chandelier';
  if (/candelabra/.test(id)) return 'candelabra';
  if (/candle-stubs/.test(id)) return 'stubs';
  if (/candle/.test(id)) return 'candle';
  if (/lantern|lamp/.test(id)) return 'lantern';
  for (const [re, kind] of extra) if (re.test(id)) return kind;
  return null;
}
export function makeHarness(S) {
  let fails = 0, checks = 0; const seen = new Map();
  const ok = (c, m) => { checks++; if (!c) { fails++; const k = m.replace(/[\d.]+/g, '#'); seen.set(k, (seen.get(k) || 0) + 1); if (fails <= 30) console.log('FAIL', m); } return c; };
  const mk = (id, type, x, z, w, d, seed, created) => { const r = { id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, created }; r.family = S.w.familyFor(r, S.T[type].family); return r; };
  function build(rooms, { lib = S.lib } = {}) {
    const made = []; for (const r of [...rooms].sort((a, b) => a.created - b.created)) { made.push(r); r.extDoor = S.w.chooseExteriorDoor(r, made); }
    const E = S.w.computeEdges(rooms, { engine: 'v2' });
    const solve = (id, opts = {}) => { const r = rooms.find(x => x.id === id); return S.s2.solveRoom2({ lib, type: S.T[r.type], room: r, openings: E.openings.get(id), opts: { orient: S.orient, minStars: 3, hideMasking: true, ...opts }, roomTypeOf: (q) => rooms.find(x => x.id === q)?.type }); };
    return { rooms, E, solve };
  }
  // every check an indoor room must pass. spec: { focal: RegExp | null, lights: bool, fire: [[re, kind]], windows: bool }
  function checkRoom(tag, B, r, L, spec) {
    const X0 = r.x * CELL + INSET, Z0 = r.z * CELL + INSET, X1 = (r.x + r.w) * CELL - INSET, Z1 = (r.z + r.d) * CELL - INSET;
    ok(!L.purposeFail, `${tag} PURPOSE FAIL: ${L.purposeFail}`);
    ok(L.role === S.w.roleOf(r.type), `${tag} role ${L.role}`);
    for (const p of L.placements) { const [aw, ad] = aabb(p); ok(p.x - aw / 2 >= X0 - TOL && p.x + aw / 2 <= X1 + TOL && p.z - ad / 2 >= Z0 - TOL && p.z + ad / 2 <= Z1 + TOL, `${tag} ${p.id} (${p.rule}) outside the room`); ok(p.y >= 0 && p.y + (p.orient === 'floor' ? 0 : p.dims[1]) <= (/pillar/.test(p.id) ? 10.4 : 9.01), `${tag} ${p.id} above the ceiling or under the floor (y ${p.y}, h ${p.dims[1]})`); } // (pillars are catalogued at wall height and props scale by their largest side: they overtop the 9-ft wall by up to a foot, reported in RISKS.md)
    const fl = standing(L);
    for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) ok(!overlap(fl[i], fl[j]), `${tag} overlap ${fl[i].id} (${fl[i].rule}) / ${fl[j].id} (${fl[j].rule})`);
    if (spec.focal) ok(L.placements.some(p => spec.focal.test(p.id)), `${tag} no focal piece (${spec.focal})`);
    ok(L.paths.every(p => p.ok), `${tag} blocked path: ${L.paths.filter(p => !p.ok).map(p => p.kind)}`);
    ok(L.checks.purpose.visibleFromDoor !== false, `${tag} the key feature is hidden from the doorway`);
    // doors stay usable: nothing standing within 1.2 ft of the inside of a door
    const ops = [...B.E.openings.get(r.id), ...(r.panels || []).map(p => ({ ...p, kind: 'panel' }))];
    for (const o of ops.filter(o => o.kind === 'door')) {
      const t = o.index * CELL - INSET + CELL / 2, pt = o.side === 'N' ? [X0 + t, Z0 + 1.2] : o.side === 'S' ? [X0 + t, Z1 - 1.2] : o.side === 'W' ? [X0 + 1.2, Z0 + t] : [X1 - 1.2, Z0 + t];
      for (const p of fl) { const [aw, ad] = aabb(p); ok(!(Math.abs(p.x - pt[0]) < aw / 2 + 0.9 && Math.abs(p.z - pt[1]) < ad / 2 + 0.9), `${tag} ${p.id} stands in the ${o.side} doorway`); }
    }
    // nothing hangs on a door, a window or a special panel; hung things are on a wall of this room
    const span = (o) => [o.index * CELL - INSET, o.index * CELL - INSET + CELL * (o.kind === 'door' && !o.part ? 1 : 1)];
    for (const p of L.placements.filter(p => p.rule === 'wall-mount' || p.rule === 'wall-light')) {
      const side = p.side, t = side === 'N' || side === 'S' ? p.x - X0 : p.z - Z0, half = (side === 'N' || side === 'S' ? aabb(p)[0] : aabb(p)[1]) / 2;
      ok(!!side && Math.abs((side === 'N' ? p.z - Z0 : side === 'S' ? Z1 - p.z : side === 'W' ? p.x - X0 : X1 - p.x)) < Math.max(1.6, p.dims[2] / 2 + 0.5), `${tag} ${p.id} hung away from its wall`); // (its centre is half its own depth out: the real plank bed is 3.3 ft deep)
      for (const o of ops.filter(o => o.side === side && /^(door|window|panel)$/.test(o.kind))) { const [a, b] = span(o); ok(!(t + half > a + 0.05 && t - half < b - 0.05), `${tag} ${p.id} hung on a ${o.kind}`); }
    }
    if (spec.windows === false) ok(!ops.some(o => o.kind === 'window'), `${tag} has a window`);
    if (spec.lights) ok(L.placements.some(p => fireType(p.id, spec.fire || [])), `${tag} has no light (windowless room)`);
    // deterministic
    const again = B.solve(r.id);
    ok(JSON.stringify(again.placements.map(p => [p.id, p.sku, p.x, p.z, p.rot])) === JSON.stringify(L.placements.map(p => [p.id, p.sku, p.x, p.z, p.rot])), `${tag} not deterministic`);
    return { props: L.placements.filter(p => p.orient !== 'floor').length, density: L.checks.density.value, target: L.checks.density.target, score: L.score };
  }
  const report = (label) => { console.log(`\n${label}: ${checks} checks, ${fails} failures`); if (fails) for (const [k, n] of [...seen].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${String(n).padStart(4)} x ${k}`); process.exit(fails ? 1 : 0); };
  return { ok, mk, build, checkRoom, report, counts: () => ({ fails, checks }) };
}
