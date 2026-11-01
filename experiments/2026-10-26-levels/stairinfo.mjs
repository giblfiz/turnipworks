// What Harry's "Intesst" area is, by the core rules: rooms, their per-building numbers, the cut, the stairs. (Written for
// the BASE code, e43075cb: on the branch storeyOf / groundOf are gone and print '-'; core_check.mjs is the branch's view.)
//   node experiments/2026-10-26-levels/stairinfo.mjs <snapshot.json>   (a copy of the campaign; nothing is written)
import fs from 'node:fs';
const ENG = new URL('../../engine/', import.meta.url).href;
const ST = await import(ENG + 'core/stairs.js'), HT = await import(ENG + 'core/height.js');
const S = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
const E = S.areas[process.argv[3] || 'area_gmisutca4n'].entities;
for (const s of ST.stairsOf(E)) { const I = ST.stairInfo(E, s); console.log(s.id, s.cat, JSON.stringify({ cells: ST.stairCells(s), base: ST.stairBase(s), top: ST.stairTop(s), ends: ST.stairEnds(s, E), status: ST.stairStatus(E, s).code, from: I.from, to: I.to, dims: s.dims, rot: s.rot, x: s.x, z: s.z })); }
const f = (fn) => { try { return fn(); } catch { return '-'; } };
for (const r of Object.values(E).filter(e => e.kind === 'room')) console.log(r.id, r.recipe.type, 'y', HT.roomY(r.recipe), 'storeyOf', f(() => HT.storeyOf(E, r)), 'levelY', f(() => HT.levelY(E, r)), 'groundOf', f(() => HT.groundOf(E, r)), 'level', HT.levelLabel(HT.levelOf(E, r)), 'fogDefault', HT.fogDefault(E, r));
for (const cut of [9, 19, null]) { const c = HT.cutRooms(E, cut); console.log('cut', cut, 'hidden', [...c.hidden].map(id => E[id].recipe.type).join(','), '| clear', [...c.clear].map(id => E[id].recipe.type).join(',')); }
