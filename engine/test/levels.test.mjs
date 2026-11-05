// ONE LEVEL MODEL FOR THE MAP (2026-10-26; Harry: "I keep getting pawns popping up and down by full level increments
// incorrectly when I snap to floor ... refactor to a universal level height model", and "A stair is not a teleporter. A
// stair is a place that people can stand"). docs/VERTICAL.md "Universal levels". The rules: core/height.js (levelAt,
// meetsGround, levelY, cutRooms, earthAt, pawnStepTo, baseUnder) and core/stairs.js (stairWalk).
//   node engine/test/levels.test.mjs
// 1. Harry's "Intesst" (cmp_q2bjx70ajq, rebuilt here by hand): a cathedral on a 10-ft hill in a building that also has
//    rooms on the plain, a mansion hall whose grand stair climbs to the hill's hallway, a second building's upper hall.
//    Every jump measured on dev before the change (experiments/2026-10-26-levels/PLAN.md) is a check here.
// 2. stairs are walked: smooth up and down, let go halfway it stands halfway, its level is the lower one until the top
// 3. the frozen corpus of saved campaigns: no standing pawn changes height by being moved nowhere; nothing changes for a
//    map without hills (doors, sight, fog, the cut)
import fs from 'node:fs';
import path from 'node:path';
import { corpusDir } from './corpus.mjs';
import * as HT from '../core/height.js';
import * as S from '../core/stairs.js';

let n = 0, fails = 0;
const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } else if (process.env.V) console.log('ok  ', name); };
const C = (g) => g * 5 + 2.5;
const room = (id, type, x, z, w, d, y, building) => ({ id, kind: 'room', order: 1, recipe: { type, x, z, w, d, seed: 1, wallSeed: 2, ...(y && { y }) }, building });
const ents = (...es) => Object.fromEntries(es.map(e => [e.id, e]));
// a walk along a line, as a drag carries a pawn (client/input.js startWalk): its base carried from point to point
const walk = (E, [x0, z0], y0, [x1, z1], k = 40) => {
  let y = y0, fb = HT.baseUnder(E, x0, z0, y0); const ys = [];
  for (let i = 1; i <= k; i++) { const t = HT.pawnStepTo(E, x0 + (x1 - x0) * i / k, z0 + (z1 - z0) * i / k, y, null, fb); if (!t.below || t.walk) { y = t.y; fb = t; } ys.push(t.below && !t.walk ? { hang: y, to: t.y } : y); }
  return ys;
};
const last = (ys) => ys.at(-1);
const smooth = (ys) => ys.every((y, i) => typeof y === 'number' && (!i || Math.abs(y - ys[i - 1]) < 1.5));

// ---- 1. Intesst ----
const E = ents(
  room('room_hill', 'hill', 7, -5, 16, 16, 10, null),
  room('room_mansion', 'mansion-hall', 13, 10, 2, 15, 0, 'bld_1'), room('room_great', 'great-hall', 15, 14, 6, 11, 0, 'bld_1'),
  room('room_cath', 'cathedral', 9, -5, 12, 13, 10, 'bld_1'), room('room_hallway', 'hallway', 13, 8, 2, 3, 10, 'bld_1'), room('room_vestry', 'temple-vestry', 17, 8, 4, 3, 10, 'bld_1'),
  room('room_upper', 'mansion-hall', 13, 12, 2, 1, 10, 'bld_2'),
  { id: 'bld_1', kind: 'building', name: 'Building 1' }, { id: 'bld_2', kind: 'building', name: 'Building 2' },
  { id: 'obj_hole', kind: 'object', cat: 'hole-round', place: 'floor', layer: 'floor', flat: true, x: 75, y: 10, z: 0, dims: [20, 0.05, 20], room: 'room_cath' }, // (Harry's, in the cathedral's floor)
  { id: 'obj_grand', kind: 'object', cat: 'stair-grand', place: 'kit', layer: 'furnish', x: 70, y: 0, z: 57.5, rot: 0, dims: [10, 13.17, 15], room: 'room_mansion' },
);
const R = (id) => E[id];
ok('ground contact is per room: the cathedral, hallway and vestry stand on the hill and meet the ground, whatever else their building has', ['room_cath', 'room_hallway', 'room_vestry', 'room_mansion', 'room_great'].every(id => HT.meetsGround(E, R(id))) && !HT.meetsGround(E, R('room_upper')));
ok('...so they are ground storeys for sight (0) and fog (the type\'s default); the second building\'s upper hall sees at 10 with no fog', ['room_cath', 'room_hallway', 'room_vestry'].every(id => HT.levelY(E, R(id)) === 0 && HT.fogDefault(E, R(id)) === null) && HT.levelY(E, R('room_upper')) === 10 && HT.fogDefault(E, R('room_upper')) === 0);
ok('the map\'s levels: everything at 10 ft is lv 2, the plain lv 1', ['room_cath', 'room_hallway', 'room_upper'].every(id => HT.levelLabel(HT.levelOf(E, R(id))) === 'lv 2') && HT.levelLabel(HT.levelOf(E, R('room_great'))) === 'lv 1');
{ const c9 = HT.cutRooms(E, 9);
  ok('lv 1 (cut 9): the cathedral and the vestry stand clear on the hill and show; the hallway (over the mansion hall\'s dug-in end) and the upper hall are hidden', [...c9.clear].sort().join() === 'room_cath,room_vestry' && [...c9.hidden].sort().join() === 'room_hallway,room_upper', [[...c9.clear], [...c9.hidden]]);
  ok('...a pawn in the cathedral shows at lv 1 (before: hidden with the cathedral, its building counted from the plain)', !HT.cutHidesBase(E, HT.baseUnder(E, C(15), C(2), 10), 9)); }
// the jumps measured on dev (experiments/2026-10-26-levels/before.json), each as the walk a drag makes now
ok('great hall -> the mansion hall\'s north end (under the upper hall): stays on lv 1 (before: popped to 10 with all levels showing)', walk(E, [C(17), C(18)], 0, [C(14), C(13)]).every(y => y === 0));
const gc = walk(E, [C(17), C(18)], 0, [C(15), C(2)]);
ok('great hall -> the cathedral: the hill\'s earth rises through lv 1 there, so it climbs onto the cathedral floor at 10 (before, at lv 1: left at 0, buried in the hill)', last(gc) === 10 && gc.every(y => y === 0 || y === 10), gc);
ok('...and the earth has no ground at 0 inside it (earthAt)', HT.earthAt(E, C(15), C(2)) === 10 && HT.earthAt(E, C(17), C(18)) === 0);
ok('within the cathedral, on lv 2: never leaves 10, over its round hole too (before: down to 0 inside the hill there: Tony\'s y 0 on dev)', walk(E, [C(12), C(0)], 10, [C(17), C(4)]).every(y => y === 10) && walk(E, [C(10), C(0)], 10, [C(20), C(0)]).every(y => y === 10));
ok('...the hole is over the hill\'s solid earth: a pawn there rests on the earth\'s top, the cathedral\'s floor (nothing to fall into)', (() => { const b = HT.baseUnder(E, 75, 0, 10); return b.y === 10 && b.room === 'room_cath'; })(), HT.baseUnder(E, 75, 0, 10));
const off = walk(E, [C(12), C(0)], 10, [C(3), C(0)]);
ok('cathedral -> hilltop -> off the hill\'s edge: walks down onto the plain (a bank, not a drop: no fall offer)', last(off) === 0 && off.every(y => y === 10 || y === 0), off);
ok('plain -> onto the hill: up onto its top', last(walk(E, [C(3), C(0)], 0, [C(8), C(0)])) === 10);
ok('lv 2 across buildings: the hill\'s hallway -> the vestry -> the cathedral, all at 10', walk(E, [C(13), C(9)], 10, [C(18), C(9)]).every(y => y === 10) && walk(E, [C(18), C(9)], 10, [C(15), C(3)]).every(y => y === 10));
// the grand stair: from the mansion hall (0) north up to the hallway (10)
const W = S.stairWalk(E);
ok('the grand stair is walked (it joins the mansion hall to the hill\'s level above)', W.list.length === 1 && W.list[0].base === 0 && W.list[0].top === 10);
const up = walk(E, [72.5, 70], 0, [72.5, 45], 50), dn = walk(E, [72.5, 45], 10, [72.5, 70], 50);
ok('up the grand stair: smoothly from 0 to 10, then on the hallway floor (before: dropped on it, teleported to the top landing)', smooth(up) && up[0] === 0 && last(up) === 10 && up.some(y => y > 4 && y < 6), up.filter((_, i) => i % 5 === 0));
ok('down it: smoothly from 10 to 0', smooth(dn) && last(dn) === 0, dn.filter((_, i) => i % 5 === 0));
{ const a = HT.pawnStepTo(E, 72.5, 57.5, 0, null, HT.baseUnder(E, 72.5, 67.5, 0)), b = HT.pawnStepTo(E, 72.5, 47.5 + 5, 10, null, HT.baseUnder(E, 72.5, 47.5, 10));
  ok('let go halfway along it, from lv 1 it stands on the treads halfway up (5 ft); from lv 2, dropped just past the top on the hole, on the treads there (before: no move at all)', a.on === 'stair' && a.y > 5 && a.y < 6.5 && b.on === 'stair' && b.y > 6 && b.y < 10, [a, b]); }
{ const h = HT.pawnStepTo(E, 72.5, 57.5, 0).y, b = HT.baseUnder(E, 72.5, 57.5, h);
  ok('a pawn halfway up is on lv 1: its base rests on the stair, its room the mansion hall; sight from lv 1\'s surface; shown with the cut at lv 1', b.on === 'stair' && b.y === h && b.room === 'room_mansion' && HT.levelAt(b.y) === 0 && HT.sightLevel(E, 72.5, 57.5, h) === 0 && !HT.cutHidesBase(E, b, 9) && HT.tokenFloor(E, { x: 72.5, z: 57.5, y: h }).level === 'lv 1', b); }
ok('a stair that is walked is never hopped (a ladder or a spiral still is)', S.stairHop(E, 72.5, 57.5, 0) === null && S.stairWalks({ kind: 'object', cat: 'ladder-wood', place: 'kit', dims: [2, 10, 1] }) === false && S.stairWalks({ kind: 'object', cat: 'stair-spiral-wide', place: 'kit', dims: [8, 10, 8] }) === false);

// ---- 2. an inn: stairs inside one building, an upper floor's edge, a hole ----
{
  const I = ents(room('room_inn', 'common', 0, 0, 6, 4, 0, 'bld_i'), room('room_up', 'guest', 0, 0, 4, 4, 10, 'bld_i'), { id: 'bld_i', kind: 'building', name: 'Inn' },
    { id: 'obj_st', kind: 'object', cat: 'stair-straight', place: 'kit', layer: 'furnish', x: 10, y: 0, z: 12.5, rot: -Math.PI / 2, dims: [4.4, 10, 10], room: 'room_inn' });
  const u = walk(I, [2.5, 12.5], 0, [17.5, 12.5]);
  ok('an inn\'s flight: walked from its foot it rises smoothly to the floor above', smooth(u) && last(u) === 10, u.filter((_, i) => i % 4 === 0));
  { const hm = HT.pawnStepTo(I.entities || I, 10, 12.5, 0).y, top = HT.baseUnder(I, 14.9, 12.5, 9.9), mid = HT.baseUnder(I, 10, 12.5, hm);
    ok('halfway up it sees from the room below (0); at its top from the room above (10)', HT.sightLevel(I, 10, 12.5, hm) === 0 && mid.room === 'room_inn' && HT.sightLevel(I, 14.99, 12.5, 10) === 10, [mid, top]); }
  const roof = walk(I, [C(2), C(1)], 10, [C(5), C(1)]), edge = walk(I, [C(2), C(1)], 10, [C(8), C(1)]);
  ok('lv 2 out over the one-storey part: it walks onto that part\'s roof, level with the floor (a room\'s top is ground)', roof.every(y => y === 10) && HT.pawnStepTo(I, C(5), C(1), 10, null, HT.baseUnder(I, C(2), C(1), 10)).on === 'top');
  ok('...and on past the building\'s edge: it hangs at its height over the drop, the fall to offer (not walked down)', typeof last(edge) === 'object' && last(edge).hang === 10 && last(edge).to === 0, edge.slice(-3));
  ok('a lv 1 pawn walking under the upper floor stays on lv 1', walk(I, [C(5), C(1)], 0, [C(0), C(1)]).every(y => y === 0));
  const Ih = { ...I, obj_hole: { id: 'obj_hole', kind: 'object', cat: 'hole', place: 'tile', layer: 'floor', flat: true, x: C(1), y: 10, z: C(1), dims: [5, 0.05, 5], room: 'room_up' } };
  const h = walk(Ih, [C(3), C(1)], 10, [C(1), C(1)]);
  ok('over a hole in the upper floor: it hangs, offered the fall to the floor below (0)', typeof last(h) === 'object' && last(h).to === 0, last(h));
  ok('raise / lower is not a walk: a pawn raised 30 ft keeps its base where it is (the highest ground under it)', HT.baseUnder(I, C(1), C(1), 30).y === 20);
}

// ---- 2b. solid rock below the ground (Harry 2026-11-03: "Nope, dragging thru rock should push back onto legal space on
// the same level."). The shape of the dev map where a pawn went missing, made here by hand: a one-square passage at -20
// (cell 6, z -6..5) under a cave at -10, a ladder in the passage, a 10-ft hill to the east. A drag that slips off the
// passage into the rock keeps the pawn at -20 on the last passage square it crossed (client/input.js walkTo: `ok`);
// before, the rock lifted it to the earth's top, 0 ft, and it walked on up there.
{
  const R2 = ents(room('room_pass', 'crypt-passage', 6, -6, 1, 12, -20, 'bld_r'), room('room_cave', 'cave', 6, -6, 16, 11, -10, 'bld_r'), room('room_hill', 'hill', 7, -5, 16, 16, 10, null),
    { id: 'bld_r', kind: 'building', name: 'B' },
    { id: 'obj_lad', kind: 'object', cat: 'ladder-wood', place: 'wall', layer: 'furnish', x: 31.5, y: -20, z: -21, rot: Math.PI / 2, dims: [3.86, 10, 2.07], room: 'room_pass' });
  // a drag as client/input.js carries it, through points: { y, at: [x, z] where it is shown / let go, rock }
  const drag = (E, pts, y0) => {
    let [x0, z0] = pts[0], y = y0, fb = HT.baseUnder(E, x0, z0, y0), at = [x0, z0], rock = false, ever = false, up = false; const seen = [];
    for (let p = 0; p + 1 < pts.length; p++) for (let i = 1; i <= 30; i++) {
      const x = pts[p][0] + (pts[p + 1][0] - pts[p][0]) * i / 30, z = pts[p][1] + (pts[p + 1][1] - pts[p][1]) * i / 30, t = HT.pawnStepTo(E, x, z, y, null, fb);
      if (!t.below || t.walk) { y = t.y; fb = t; at = [x, z]; rock = false; } else rock = !!t.rock;
      ever ||= rock; up ||= y > y0 + 0.5; seen.push(y);
    }
    return { y, at, rock, ever, up, seen };
  };
  const along = drag(R2, [[32.5, 25], [28, 5], [32.5, -21]], -20); // down the passage, the pointer slipping a square west of it on the way
  ok('rock: a drag along the one-square passage that slips into the rock beside it stays at -20 the whole way (before: up to 0 ft for good)', along.ever && !along.up && along.seen.every(y => y === -20) && along.y === -20, along);
  ok('...and ends in the passage, on its floor, where the pointer came back to it', !along.rock && HT.floorUnder(R2, ...along.at, -20)?.room === 'room_pass', along.at);
  const fl = HT.floorUnder(R2, ...along.at, along.y)?.y, hop = S.stairHop(R2, 32.5, -21, fl);
  ok('...so dropped on the ladder there it climbs it, to the cave at -10 (on dev the pawn missed the ladder at 0 ft and was left inside a hill\'s bank)', fl === -20 && hop && hop.y === -10 && HT.floorUnder(R2, hop.x, hop.z, -10)?.room === 'room_cave', hop);
  const out = drag(R2, [[32.5, 10], [32.5, 0], [60, 0], [90, 5]], -20); // off the passage's side and on through rock with no floor of lv -2 anywhere
  ok('rock with no floor of its level anywhere near: held on the last passage square it crossed, still at -20, over rock (let go: there)', out.rock && out.y === -20 && !out.up && HT.floorUnder(R2, ...out.at, -20)?.room === 'room_pass', out);
  const st = HT.pawnStepTo(R2, 60, 0, -20, null, HT.baseUnder(R2, 32.5, 0, -20));
  ok('pawnStepTo over rock below the ground says so and climbs nothing', st.rock && st.below && st.y === -20 && !st.climb, st);
  ok('...at lv -1 too, where the earth\'s top is one storey up (the old climb out of a cellar through its wall)', HT.pawnStepTo(R2, 115, 0, -10, null, HT.baseUnder(R2, 50, 0, -10)).rock);
  const inCave = drag(R2, [[50, -15], [80, -15]], -10);
  ok('the cave at lv -1 is walked as any floor (no rock inside a room of the level)', !inCave.ever && inCave.seen.every(y => y === -10), inCave);
  ok('above the ground nothing changed: onto the hill from its foot, up onto its top', last(walk(R2, [C(3), C(8)], 0, [C(10), C(8)])) === 10);
  // a room of the level with an opening (a pit) over a room further down is not rock: the fall, as above the ground
  const R3 = ents(room('room_cel', 'cellar', 0, 0, 4, 4, -10), room('room_deep', 'cellar', 0, 0, 4, 4, -20),
    { id: 'obj_pit', kind: 'object', cat: 'hole-round', place: 'floor', layer: 'floor', flat: true, x: 10, y: -10, z: 10, dims: [5, 0.05, 5], room: 'room_cel' });
  const ph = HT.pawnStepTo(R3, 10, 10, -10, null, HT.baseUnder(R3, 2.5, 2.5, -10));
  ok('a hole in a cellar floor is not rock: the pawn hangs over it with the fall to the room under it offered (before: up to the ground at 0)', !ph.rock && ph.below && !ph.climb && ph.y === -20, ph);
}

// ---- 3. the corpus ----
{
  const dir = corpusDir(); let camps = 0, pawns = 0, buried = 0, moved = [], hillless = 0, diffs = [];
  const sealedOld = (E, r) => (r.recipe.y || 0) !== 0; // the old rule on a map with no hills: every building meets the ground at 0
  for (const c of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.startsWith('cmp_')) : []) {
    const f = path.join(dir, c, 'snapshot.json'); if (!fs.existsSync(f)) continue;
    let s; try { s = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    camps++;
    for (const A of Object.values(s.state?.areas || s.state?.tables || {})) {
      const E2 = A.entities || {}, rooms = Object.values(E2).filter(e => e.kind === 'room' && e.recipe), hills = rooms.some(r => HT.isTerrain(r.recipe));
      for (const t of Object.values(E2).filter(e => e.kind === 'token')) {
        const fb = HT.baseUnder(E2, t.x, t.z, t.y || 0); if ((t.y || 0) - fb.y >= 5) continue; // (a flyer keeps its height)
        if (fb.on === 'ground' && fb.y < 0) { buried++; continue; } // (lowered into the earth before 2026-10-20: moved, it comes up to the ground)
        pawns++; const st = HT.pawnStepTo(E2, t.x, t.z, fb.y, null, fb);
        if (Math.abs(st.y - fb.y) > 0.01 && !st.below) moved.push([c, t.id, fb.y, st.y]);
      }
      if (!hills) { hillless++; for (const r of rooms) if (HT.meetsGround(E2, r) === sealedOld(E2, r) || HT.levelY(E2, r) !== (r.recipe.y || 0) * (HT.meetsGround(E2, r) ? 0 : 1)) diffs.push([c, r.id]); }
    }
  }
  console.log(`  (corpus: ${camps} campaigns, ${pawns} standing pawns (and ${buried} in the earth below the ground: moved, they come up onto it), ${hillless} areas without hills)`);
  ok('no standing pawn in a saved campaign changes height by being moved where it already is (its level is its own)', moved.length === 0, moved.slice(0, 5));
  ok('on a map with no hills, ground contact is exactly as before: a room meets the ground iff its floor is at 0 (doors, the stair offer, fog defaults, sight)', diffs.length === 0, diffs.slice(0, 5));
}
console.log(`levels: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
