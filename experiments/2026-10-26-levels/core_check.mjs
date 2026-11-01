// The universal-level rules on Harry's "Intesst" map, in node (no browser): where a pawn goes, step by step.
//   node experiments/2026-10-26-levels/core_check.mjs <snapshot.json>
import fs from 'node:fs';
const ENG = new URL('../../engine/', import.meta.url).href;
const HT = await import(ENG + 'core/height.js'), ST = await import(ENG + 'core/stairs.js');
const E = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state.areas.area_gmisutca4n.entities;
const C = (g) => g * 5 + 2.5;
for (const r of Object.values(E).filter(e => e.kind === 'room')) console.log(r.recipe.type.padEnd(14), 'y', HT.roomY(r.recipe), 'meetsGround', HT.meetsGround(E, r), 'sight', HT.levelY(E, r), 'fog', HT.fogDefault(E, r));
for (const cut of [9, 19]) { const c = HT.cutRooms(E, cut); console.log('cut', cut, 'hidden:', [...c.hidden].map(id => E[id].recipe.type).join(','), '| clear:', [...c.clear].map(id => E[id].recipe.type).join(',')); }
console.log('walked stairs', ST.stairWalk(E).list.map(t => [t.id, t.base, t.top, t.lower, t.upper]));
// walk a pawn along a line from a start base, as a drag does (the base it is on carried point to point)
const walk = (name, [x0, z0], y0, [x1, z1], n = 20) => {
  let y = y0, fb = HT.baseUnder(E, x0, z0, y0 + 0.5); const ys = [];
  for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n, s = HT.pawnStepTo(E, x, z, y, null, fb); if (!s.below || s.walk) { y = s.y; fb = s; } ys.push(s.below && !s.walk ? `(${s.y}↓)` : String(s.y)); }
  console.log(name.padEnd(30), ys.join(' '));
};
walk('greathall -> mansion N end', [C(17), C(18)], 0, [C(14), C(13)]);
walk('greathall -> cathedral', [C(17), C(18)], 0, [C(15), C(2)]);
walk('cathedral -> hilltop -> plain', [C(12), C(0)], 10, [C(3), C(0)]);
walk('plain -> hilltop', [C(3), C(0)], 0, [C(8), C(0)]);
walk('stair foot -> top exit', [72.5, 70], 0, [72.5, 45], 25);
walk('stair top -> foot', [72.5, 45], 10, [72.5, 70], 25);
walk('hallway -> upper hall (lv 2)', [C(13), C(9)], 10, [C(13), C(12)]);
walk('upper hall -> greathall', [C(13), C(12)], 10, [C(17), C(18)]);
console.log('mid-stair base', HT.baseUnder(E, 72.5, 57.5, 5), 'sight', HT.sightLevel(E, 72.5, 57.5, 5), 'floor', HT.tokenFloor(E, { x: 72.5, z: 57.5, y: 5 }).level);
console.log('lv2 pawn over the hole', HT.baseUnder(E, 72.5, 52, 10));
