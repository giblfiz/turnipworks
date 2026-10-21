// Random buildings through the v2 door policy + solver: no exceptions, every room reachable, no terminal-terminal doors.
import { readFileSync } from 'node:fs';
import { solveRoom2 } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor, overlaps, roleOf, isOutdoor } from '../js/walls.js';
import { mulberry32 } from '../js/solver.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json'));
const orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t])), keys = types.map(t => t.key);
let fails = 0, rooms_total = 0, purposeFails = 0, yards = 0, yardDoors = 0;
const fail = (m) => { fails++; if (fails < 15) console.log('FAIL', m); };
for (let s = 1; s <= 60; s++) {
  const rng = mulberry32(s * 977), rooms = [];
  let tries = 0;
  while (rooms.length < 2 + Math.floor(rng() * 6) && tries++ < 200) {
    const type = keys[Math.floor(rng() * keys.length)], [cw, cd] = T[type].cells;
    const w = Math.max(1, cw + Math.floor(rng() * 3) - 1), d = Math.max(1, cd + Math.floor(rng() * 3) - 1);
    // attach to an existing room's edge (touching), or start at the origin
    let x = 4, z = 4;
    if (rooms.length) { const b = rooms[Math.floor(rng() * rooms.length)]; const side = Math.floor(rng() * 4); x = side === 0 ? b.x + b.w : side === 1 ? b.x - w : b.x + Math.floor(rng() * b.w); z = side === 2 ? b.z + b.d : side === 3 ? b.z - d : b.z + Math.floor(rng() * b.d); }
    const r = { id: `r${rooms.length}`, type, x, z, w, d, seed: Math.floor(rng() * 1e9), wallSeed: Math.floor(rng() * 1e9), family: T[type].family, created: rooms.length + 1 };
    if (x < 0 || z < 0 || rooms.some(o => overlaps(o, r))) continue;
    r.extDoor = chooseExteriorDoor(r, [...rooms, r]);
    rooms.push(r);
  }
  let E;
  try { E = computeEdges(rooms, { engine: 'v2' }); } catch (e) { fail(`s${s} computeEdges: ${e.message}`); continue; }
  // reachability from live exterior doors
  const adj = new Map(rooms.map(r => [r.id, new Set()])), src = new Set();
  for (const e of E.edges.values()) if (e.kind === 'door') { if (e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); } else src.add(e.sides[0].room); }
  // outdoors: a yard has no walls, so one with any open side is a way in by itself; a door onto a yard joins the two
  // (for the building it is an exterior door: already a source above). A closed court is reached through those doors.
  for (const r of rooms) if (isOutdoor(r.type) && (E.open.get(r.id).length || [...E.edges.values()].some(e => e.kind === 'door' && e.yard?.room === r.id))) src.add(r.id);
  for (const e of E.edges.values()) { if (e.sides.some(x => isOutdoor(rooms.find(r => r.id === x.room).type))) fail(`s${s} a wall (${e.key}) belongs to a yard`); if (e.yard && e.kind === 'door') yardDoors++; }
  const seen = new Set(src), q = [...src]; while (q.length) { const id = q.shift(); for (const n of adj.get(id)) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  for (const r of rooms) if (!seen.has(r.id)) fail(`s${s} ${r.type} ${r.id} unreachable`);
  for (const e of E.edges.values()) if (e.kind === 'door' && e.sides.length === 2 && !e.flag) {
    const [a, b] = e.sides.map(x => rooms.find(r => r.id === x.room).type);
    if (roleOf(a) === 'terminal' && roleOf(b) === 'terminal') fail(`s${s} terminal-terminal door ${a}/${b} without a reachability flag`);
  }
  for (const r of rooms) {
    rooms_total++;
    try {
      const L = solveRoom2({ lib, type: T[r.type], room: r, openings: E.openings.get(r.id), opts: { orient, bestOf: 2 }, roomTypeOf: (id) => rooms.find(x => x.id === id)?.type });
      if (L.purposeFail) purposeFails++;
      if (isOutdoor(r.type)) { // the yard in a random building: paths clear, sparse, nothing hung on thin air
        yards++;
        if (L.purposeFail || !L.paths.every(p => p.ok)) fail(`s${s} yard ${r.id}: ${L.purposeFail || 'blocked path'}`);
        if (r.w * r.d >= 12 && L.checks.density.value > 1.5 * L.checks.density.target) fail(`s${s} yard ${r.id} density ${L.checks.density.value}`);
        if (L.placements.some(p => p.rule === 'yard-sign' || p.rule === 'yard-light') && !L.yard.wallFt) fail(`s${s} yard ${r.id} hung something with no wall`);
      }
    } catch (e) { fail(`s${s} solve ${r.type}: ${e.stack.split('\n').slice(0, 2).join(' ')}`); }
  }
}
console.log(`${rooms_total} rooms in 60 random buildings (${yards} yards, ${yardDoors} doors onto them); ${fails} failures; purpose fails ${purposeFails} (small random sizes allowed)`);
process.exit(fails ? 1 : 0);
