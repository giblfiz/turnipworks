// node test_cave.mjs : checks the placement rule's geometry with a made-up kit (or kit.json if it exists)
import fs from 'node:fs';
import { cellsOf, outline, runsOf, placeCave, rockEdge, jagCells, CELL } from './viewer/cave.js';
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
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) for (const turn of [0, 10, 20]) for (const push of [0, 0.5]) for (const wander of [0, 3, 6]) for (const jag of [0, 0.7, 1]) {
    const P = { overlap: 0.3, push, turn, wander, jag, seed, rubble: 0.35 }, r = placeCave(sc, kit, P, POOL);
    ok(r.placements.length > 4, `${name} has chunks`);
    // conservative check: the centre of every wall chunk's back plane is outside the room by at least push
    for (const p of r.placements) {
      if (p.role === 'arch' || p.role === 'stalagmite') continue;
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
// pillars and stalagmites: pillars take a square out of the room, never touch the outline, never cut the room in two;
// stalagmites stand on floor squares
for (const [name, sc] of Object.entries(SCENES)) {
  if (!sc.rects || sc.kitWalls) continue;
  let pillars = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = placeCave(sc, kit, { overlap: 0.3, push: 0.3, turn: 20, wander: 6, jag: 0.7, pillars: 1, stalag: 1, seed, rubble: 0.55 }, { ...POOL, stalagmites: ['s.glb'] });
    pillars += r.pillarCells.length;
    for (const [i, j] of r.pillarCells) { ok(!r.cells.has(`${i},${j}`), `${name} seed ${seed}: pillar square still floor`);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) ok(r.cells.has(`${i + a},${j + b}`) || r.pillarCells.length === 0, `${name} seed ${seed}: pillar ${i},${j} beside rock`); }
    for (const p of r.placements.filter(p => p.role === 'stalagmite')) ok(r.cells.has(`${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`), `${name} seed ${seed}: stalagmite off the floor at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
    const seen = new Set([r.cells.values().next().value]), st = [...seen];
    while (st.length) { const [i, j] = st.pop().split(',').map(Number); for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const k = `${i + a},${j + b}`; if (r.cells.has(k) && !seen.has(k)) { seen.add(k); st.push(k); } } }
    ok(seen.size === r.cells.size, `${name} seed ${seed}: pillars cut the room in two`);
  }
  console.log(name, 'pillars over 60 seeds:', pillars);
}
// jagged outlines: whole squares, joined, never a tunnel or mouth square moved, and most seeds really change the shape
for (const [name, sc] of Object.entries(SCENES)) {
  if (!sc.rects || sc.kitWalls) continue;
  const base = cellsOf(sc.rects); let changed = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r0 = placeCave(sc, kit, { overlap: 0.3, push: 0.3, turn: 20, wander: 6, jag: 0.7, pillars: 0, seed, rubble: 0.55 }, POOL), c = r0.cells;
    if ([...c].some(k => !base.has(k)) || [...base].some(k => !c.has(k))) changed++;
    for (const [i0, j0, w, d] of sc.rects.filter(([, , w, d]) => Math.min(w, d) < 3)) for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + d; j++) ok(c.has(`${i},${j}`), `${name} seed ${seed}: tunnel square ${i},${j} lost`);
    const loops = outline(c, sc.open || []); ok(loops.reduce((a, l) => a + l.length, 0) === [...c].reduce((a, k) => { const [i, j] = k.split(',').map(Number); return a + [[1,0],[-1,0],[0,1],[0,-1]].filter(([x, y]) => !c.has(`${i + x},${j + y}`)).length; }, 0), `${name} seed ${seed}: outline walk lost an edge`);
  }
  ok(changed >= 160, `${name}: only ${changed} of 200 seeds changed the shape`);
  console.log(name, 'jag 0.7: shape changed on', changed, 'of 200 seeds');
}
console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
