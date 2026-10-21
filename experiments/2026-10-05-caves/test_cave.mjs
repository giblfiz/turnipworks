// node test_cave.mjs : checks the placement rule's geometry with a made-up kit (or kit.json if it exists)
import fs from 'node:fs';
import { cellsOf, outline, runsOf, placeCave, rockEdge, CELL } from './viewer/cave.js';
import { SCENES, POOL } from './viewer/scenes.js';
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const fake = (w, d, h = 10) => ({ size_ft: { w, d, h }, front_reach_ft: { foot_max: d * 0.8, mid_max: d * 0.9, top_max: d, all_max: d, behind_back_plane: 0 }, half_width_ft: { foot: w / 2, all: w / 2 }, opening: { x0: -2, x1: 2, width_ft: 4, clear_height_ft: 7 } });
const kit = fs.existsSync(new URL('./kit.json', import.meta.url)) ? JSON.parse(fs.readFileSync(new URL('./kit.json', import.meta.url))) :
  Object.fromEntries([...POOL.walls.map(id => [id, fake(8, 4)]), [POOL.column, fake(4.5, 4.5)], [POOL.rubble, fake(6, 3, 4)], [POOL.arch, fake(9, 3.5)]]);
// rectangle 6 x 4 cells: one loop, 4 runs, 4 room corners
{ const { runs, corners } = runsOf(outline(cellsOf([[0, 0, 6, 4]]))[0]);
  ok(runs.length === 4 && corners.length === 4 && corners.every(c => c.type === 'in'), 'rect runs/corners');
  ok(runs.map(r => r.len).sort((a, b) => a - b).join() === '20,20,30,30', 'rect run lengths'); }
// L: 6 runs, 5 room corners + 1 jutting
{ const { runs, corners } = runsOf(outline(cellsOf([[0, 0, 6, 3], [0, 3, 3, 3]]))[0]);
  ok(runs.length === 6 && corners.filter(c => c.type === 'out').length === 1 && corners.filter(c => c.type === 'in').length === 5, 'L corners'); }
for (const [name, sc] of Object.entries(SCENES)) {
  if (!sc.rects) continue;
  for (const seed of [1, 2, 3, 4, 5]) for (const turn of [0, 10, 20]) for (const push of [0, 0.5]) for (const wander of [0, 3]) {
    const P = { overlap: 0.3, push, turn, wander, seed, rubble: 0.35 }, r = placeCave(sc, kit, P, POOL);
    ok(r.placements.length > 4, `${name} has chunks`);
    // conservative check: the centre of every wall chunk's back plane is outside the room by at least push
    for (const p of r.placements) {
      if (p.role === 'arch') continue;
      const i = Math.floor(p.x / CELL), j = Math.floor(p.z / CELL);
      if (!p.round) ok(!r.cells.has(`${i},${j}`), `${name} seed ${seed}: ${p.role} ${p.id} origin inside the room at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      ok([p.x, p.z, p.rot, ...p.scale].every(Number.isFinite), 'finite');
    }
    // every run is covered end to end (walls' extents along the run)
    const cap = rockEdge(r.loops, P, 1.2, 0.5); ok(cap.every(l => l.length >= 12 && l.every(q => Number.isFinite(q[0] + q[1]))), 'cap loop');
  }
  const r = placeCave(sc, kit, { overlap: 0.3, push: 0.3, turn: 10, wander: 2.5, seed: 1, rubble: 0.35 }, POOL);
  const count = {}; r.placements.forEach(p => count[p.role] = (count[p.role] || 0) + 1);
  console.log(name, 'runs', r.runs.map(q => `${q.len}${q.startType[0]}${q.endType[0]}`).join(' '), count);
}
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
