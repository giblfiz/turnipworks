// v2 engine: v1 invariants + principle checks.   node tools/spawn-tuner/test/solver2.test.mjs [--print TYPE WxD]
import { readFileSync } from 'node:fs';
import { solveRoom2, summarize2, DENSITY } from '../js/solver2.js';
import { solveRoom } from '../js/solver.js';
import { computeEdges, chooseExteriorDoor, CELL, roleOf } from '../js/walls.js';

const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json'));
const types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = (() => { try { return JSON.parse(readFileSync(here + 'data/orient.json')); } catch { return {}; } })();
const T = Object.fromEntries(types.map(t => [t.key, t]));
const argv = process.argv;
const printType = argv.includes('--print') ? argv[argv.indexOf('--print') + 1] : null;
const printSize = argv.includes('--print') && argv[argv.indexOf('--print') + 2]?.includes('x') ? argv[argv.indexOf('--print') + 2].split('x').map(Number) : null;

const TOL = 2 / 12;
let fails = 0, checks = 0;
const fail = (m) => { fails++; if (fails <= 30) console.log('FAIL', m); };
const ok = (c, m) => { checks++; if (!c) fail(m); };
const aabb = (p) => { const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot)); return [c * p.dims[0] + s * p.dims[2], s * p.dims[0] + c * p.dims[2]]; };

export function solve2(rooms, which, opts = {}) {
  for (const r of rooms) if (r.extDoor === undefined) r.extDoor = chooseExteriorDoor(r, rooms);
  const E = computeEdges(rooms, { engine: 'v2' });
  const r = rooms.find(x => x.id === which);
  const typeOf = (id) => rooms.find(x => x.id === id)?.type;
  return solveRoom2({ lib, type: T[r.type], room: r, openings: E.openings.get(r.id), opts: { orient, ...opts }, roomTypeOf: typeOf });
}
const mk = (id, type, x, z, w, d, seed, created = 1) => ({ id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created });

// --- invariants over every type, several sizes and seeds
let n = 0;
for (const t of types) {
  for (const [w, d] of [t.cells, [t.cells[0] + 2, t.cells[1] + 1], [2, 2], [8, 6]]) {
    for (let seed = 1; seed <= 5; seed++) {
      const L = solve2([mk('r1', t.key, 2, 2, w, d, seed * 7919)], 'r1'); n++;
      const X0 = 2 * CELL + 0.5, Z0 = 2 * CELL + 0.5, X1 = (2 + w) * CELL - 0.5, Z1 = (2 + d) * CELL - 0.5;
      const floor = L.placements.filter(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.orient !== 'wall' && p.rule !== 'wall-mount');
      for (const p of L.placements) {
        if (p.orient === 'wall' || p.rule === 'wall-mount' || p.rule === 'yard-edge') continue; // (a yard's fence stands on its boundary line: test/yard.test.mjs)
        const [aw, ad] = aabb(p);
        ok(!(p.x - aw / 2 < X0 - TOL || p.x + aw / 2 > X1 + TOL || p.z - ad / 2 < Z0 - TOL || p.z + ad / 2 > Z1 + TOL), `${t.key} ${w}x${d} s${seed} ${p.id} outside walls`);
      }
      for (let i = 0; i < floor.length; i++) for (let j = i + 1; j < floor.length; j++) {
        const a = floor[i], b = floor[j], [aw, ad] = aabb(a), [bw, bd] = aabb(b);
        if (a.rule === 'yard-edge' && b.rule === 'yard-edge') continue; // fence sections meet at posts and corners
        ok(!(Math.abs(a.x - b.x) < (aw + bw) / 2 - TOL && Math.abs(a.z - b.z) < (ad + bd) / 2 - TOL), `${t.key} ${w}x${d} s${seed} overlap ${a.id}/${b.id}`);
      }
      const byUid = new Map(L.placements.map(p => [p.uid, p]));
      for (const p of L.placements.filter(p => p.parent)) { const s = byUid.get(p.parent); ok(s && Math.abs(p.y - (s.y + s.dims[1])) < 0.01, `${p.id} not on top of its surface`); }
      const again = solve2([mk('r1', t.key, 2, 2, w, d, seed * 7919)], 'r1');
      ok(JSON.stringify(again.placements) === JSON.stringify(L.placements), `${t.key} not deterministic`);
      ok(L.role === roleOf(t.key), `${t.key} role`);
      // key purpose in the type's default and larger sizes must not fail
      if (w >= t.cells[0] && d >= t.cells[1]) ok(!L.purposeFail, `${t.key} ${w}x${d} s${seed} purpose fail: ${L.purposeFail}`);
      // no coffin beds; beds not in the door's blast line
      for (const c of L.checks.command.filter(c => c.label === 'bed' && w >= t.cells[0])) ok(!c.blast, `${t.key} ${w}x${d} s${seed} bed in the door's blast line (coffin)`);
      // the key feature in view from the door (privacy rooms: out of its line)
      if (L.checks.purpose.visibleFromDoor !== null && w >= t.cells[0]) ok(L.checks.purpose.visibleFromDoor, `${t.key} ${w}x${d} s${seed} key feature not ${L.checks.purpose.privacy ? 'out of the door line' : 'visible from the door'}`);
      if (printType === t.key && seed === 1 && (printSize ? (w === printSize[0] && d === printSize[1]) : (w === t.cells[0] && d === t.cells[1]))) console.log('\n' + summarize2(L) + '\n');
    }
  }
}

// --- principle cases
{ // 5x5 privy must get a seat
  const L = solve2([mk('p', 'privy', 2, 2, 1, 1, 11)], 'p');
  ok(!L.purposeFail && L.placements.some(p => /privy-seat/.test(p.id)), `1x1 privy has no seat: ${L.purposeFail}`);
}
{ // desk: a clear through-line between two doors (desk between street and common room)
  const rooms = [mk('d', 'desk', 2, 2, 3, 3, 5, 2), mk('c', 'common', 5, 1, 6, 5, 9, 1)];
  const L = solve2(rooms, 'd');
  const through = L.paths.find(p => p.kind === 'through');
  ok(through && through.ok, 'desk through-line blocked');
  ok(L.placements.some(p => p.id === 'counter-shop'), 'desk has no counter');
}
{ // hub loop exists and every door is on it
  const rooms = [mk('c', 'common', 2, 2, 6, 4, 21, 1), mk('k', 'kitchen', 8, 2, 4, 3, 22, 2), mk('h', 'hallway', 2, 6, 6, 2, 23, 3)];
  const L = solve2(rooms, 'c');
  const loop = L.paths.find(p => p.kind === 'loop');
  ok(loop && loop.ok, 'hub has no clear loop');
  const doors = L.openings.filter(o => o.kind === 'door');
  ok(doors.length >= 2, `hub should have several doors, has ${doors.length}`);
}
{ // terminals don't open into each other; a guest room off a hallway gets ONE door, to the hallway
  const rooms = [mk('h', 'hallway', 2, 2, 6, 2, 31, 1), mk('g1', 'guest', 2, 4, 3, 3, 32, 2), mk('g2', 'guest', 5, 4, 3, 3, 33, 3)];
  for (const r of rooms) r.extDoor = chooseExteriorDoor(r, rooms);
  const E = computeEdges(rooms, { engine: 'v2' });
  const doors = (id) => E.openings.get(id).filter(o => o.kind === 'door' && !o.part);
  ok(doors('g1').length === 1 && doors('g1')[0].to === 'h', `guest g1 doors ${JSON.stringify(doors('g1'))}`);
  ok(!E.openings.get('g1').some(o => o.kind === 'door' && o.to === 'g2'), 'two guest rooms got a door between them');
  // v1 unchanged: one door per pair
  const E1 = computeEdges(rooms);
  ok(E1.openings.get('g1').some(o => o.kind === 'door' && o.to === 'g2'), 'v1 behaviour changed (expected guest-guest door in v1)');
}
{ // reachability: a guest room touching only another guest room still gets a way in
  const rooms = [mk('h', 'hallway', 2, 2, 6, 2, 41, 1), mk('g1', 'guest', 2, 4, 3, 3, 42, 2), mk('g2', 'guest', 2, 7, 3, 3, 43, 3)];
  for (const r of rooms) r.extDoor = chooseExteriorDoor(r, rooms);
  const E = computeEdges(rooms, { engine: 'v2' });
  ok(E.openings.get('g2').some(o => o.kind === 'door'), 'g2 stranded with no door');
}
{ // density not counts: 40x60 common room (8x12 cells) not sparser than 85% of a 30x20; zones grow with area
  const small = [1, 2, 3].map(s => solve2([mk('a', 'common', 2, 2, 6, 4, s * 101)], 'a'));
  const big = [1, 2, 3].map(s => solve2([mk('a', 'common', 2, 2, 12, 8, s * 101)], 'a'));
  const avg = (xs, f) => xs.reduce((a, x) => a + f(x), 0) / xs.length;
  const ds = avg(small, L => L.checks.density.value), db = avg(big, L => L.checks.density.value);
  const zs = avg(small, L => L.zones.length), zb = avg(big, L => L.zones.length);
  ok(db >= 0.85 * ds, `40x60 density ${db.toFixed(1)} < 85% of 30x20 ${ds.toFixed(1)}`);
  ok(zb > zs, `zones don't grow with area (${zs} -> ${zb})`);
  console.log(`density 30x20 ${ds.toFixed(1)} vs 60x40 ${db.toFixed(1)} per 100 sq ft; zones ${zs.toFixed(1)} -> ${zb.toFixed(1)}`);
  // fine bedroom grows zones progressively
  const fz = [[3, 3], [4, 4], [5, 5], [6, 6]].map(([w, d]) => solve2([mk('f', 'fine', 2, 2, w, d, 77)], 'f').zones.map(z => z.kind));
  console.log('fine bedroom zones by size:', fz.map(z => z.join('+')).join(' | '));
  ok(fz[3].length > fz[0].length, 'fine bedroom does not grow zones');
}
{ // outdoors: a yard beside an inn has no walls of its own, the inn's door opens onto it, and the way to the gate is clear
  const rooms = [mk('c', 'common', 2, 2, 6, 4, 51, 1), mk('y', 'yard', 2, 6, 6, 5, 52, 2)];
  for (const r of rooms) r.extDoor = chooseExteriorDoor(r, rooms);
  const E = computeEdges(rooms, { engine: 'v2' });
  ok(rooms[1].extDoor === null && E.open.get('y').length === 16 && [...E.edges.values()].every(e => e.sides.every(x => x.room === 'c')), 'yard built walls of its own');
  ok(E.openings.get('y').some(o => o.kind === 'door' && o.to === 'c') && E.openings.get('y').some(o => o.kind === 'gate'), 'yard has no door from the inn or no gate');
  const L = solve2(rooms, 'y');
  ok(L.role === 'outdoor' && L.paths.length && L.paths.every(p => p.ok) && L.placements.some(p => p.rule === 'yard-focal'), `yard: ${L.paths.length} paths, focal ${L.placements.some(p => p.rule === 'yard-focal')}`);
  ok(L.checks.density.target <= DENSITY.yard && L.checks.density.value <= 1.5 * DENSITY.yard && DENSITY.yard < DENSITY.hallway, `yard is not sparse: ${L.checks.density.value} (target ${DENSITY.yard})`);
  if (printType === 'yard') console.log('\n' + summarize2(L) + '\n');
}
console.log(`${n} rooms solved; ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
