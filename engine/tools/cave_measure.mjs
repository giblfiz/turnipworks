// HOW FAR CAVE ROCK REACHES INTO THE FLOOR, OVER MANY CAVES (2026-10-25). The pilot's measure (and browser_caves.py's),
// on the real vertices of the game's chunks: every vertex between 0.15 and 6.5 ft over the floor, placed as the rule
// places it (position, turn, scale), tested against the floor squares; and whether a 5-ft round base on an edge square
// would touch it. Over every size and many seeds, not one campaign.
//     node engine/tools/cave_measure.mjs [seeds per size, default 40]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.argv.push('--quiet');
const { vertsOf } = await import(pathToFileURL(path.join(ROOT, 'engine/tools/cave_hulls.mjs')).href);
const CV = await import(pathToFileURL(path.join(ROOT, 'engine/core/caves.js')).href);
const { KIT } = await import(pathToFileURL(path.join(ROOT, 'engine/core/cavekit.js')).href);
const N = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 40);
const V = {}; for (const id of Object.keys(KIT).filter(k => !k.startsWith('_'))) V[id] = (await vertsOf(id)).filter((_, i) => i % 2 === 0);
const sizes = [[4, 4], [6, 4], [7, 5], [8, 6], [9, 7], [12, 9], [16, 12], [16, 16], [3, 10], [2, 8]];
let caves = 0, placements = 0, worst = 0, overLine = 0, baseTouch = 0, edgeCells = 0; const byRole = {}, examples = [];
for (const [w, d] of sizes) for (let s = 0; s < N; s++) {
  const S = CV.caveShape({ x: 0, z: 0, w, d }, 1000 + s * 37), R = { id: 'r', kind: 'room', recipe: { type: 'cave', ...S, y: -10 } }, C = CV.caveOf({ r: R }, R); caves++;
  const cells = C.cells, edge = new Map();
  for (const key of cells) { const [i, j] = key.split(',').map(Number); const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => !cells.has(`${i + a},${j + b}`)); if (sides.length) edge.set(key, { sides, deep: 0, base: false }); }
  edgeCells += edge.size;
  for (const p of C.placements) {
    if (p.role === 'stalagmite' || !V[p.id]) continue; placements++;
    const c = Math.cos(p.rot), sn = Math.sin(p.rot); let mine = 0;
    for (const [x0, y0, z0] of V[p.id]) {
      const lx = x0 * p.scale[0], ly = y0 * p.scale[1], lz = z0 * p.scale[2], y = ly + (p.y || 0);
      if (y < 0.15 || y > 6.5) continue;
      const x = p.x + lx * c + lz * sn, z = p.z - lx * sn + lz * c, i = Math.floor(x / 5), j = Math.floor(z / 5), k = `${i},${j}`, e = edge.get(k);
      if (!e) { if (cells.has(k)) mine = Math.max(mine, 5); continue; }
      let dd = Infinity; for (const [a, b] of e.sides) dd = Math.min(dd, a === -1 ? x - i * 5 : a === 1 ? (i + 1) * 5 - x : b === -1 ? z - j * 5 : (j + 1) * 5 - z);
      if (dd > e.deep) e.deep = dd; mine = Math.max(mine, dd);
      if (Math.hypot(x - (i + 0.5) * 5, z - (j + 0.5) * 5) < 2.5) e.base = true;
    }
    if (mine > 0.01) { (byRole[p.role] ||= []).push(+mine.toFixed(2)); if (examples.length < 6) examples.push([w, d, S.seed, p.role, p.id, +mine.toFixed(2)]); }
    worst = Math.max(worst, mine);
  }
  for (const e of edge.values()) { if (e.deep > 0.1) overLine++; if (e.base) baseTouch++; }
}
const summary = Object.fromEntries(Object.entries(byRole).map(([r, a]) => [r, { n: a.length, max: Math.max(...a) }]));
console.log(JSON.stringify({ caves, placements, edgeCells, worst_into_floor_ft: +worst.toFixed(2), edge_squares_with_rock_over_line: overLine, edge_squares_a_5ft_base_touches: baseTouch, intruding_by_role: summary, examples }));
