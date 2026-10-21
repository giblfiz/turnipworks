// A PAWN'S BASE (Harry 2026-10-13; docs/PAWNS.md "A raised pawn"): core/height.js baseUnder, the one rule for where a
// raised pawn's base rests and so for what the cut does with it.   node engine/test/pawnbase.test.mjs
//   1. the rule itself, on a hand-made area (open ground, a yard, two storeys, a tall room, a cellar, a roof that is off)
//   2. it agrees with tokenFloor on "which room is the pawn in" for every roofed room
//   3. the frozen corpus of saved campaigns: no pawn needs migrating (a pawn that stood on its floor still does: its
//      base is where its figure is), and every pawn in the air gets a base at or below its figure
import fs from 'node:fs';
import path from 'node:path';
import { corpusDir } from './corpus.mjs';
import { baseUnder, tokenFloor, floorUnder, visibleAt, ceilingOf, roomTop } from '../core/height.js';

let pass = 0, fail = 0;
const check = (name, ok, ev = '') => { if (ok) pass++; else { fail++; console.log('FAIL ' + name + (ev !== '' ? '  [' + JSON.stringify(ev) + ']' : '')); } };
const room = (id, x, z, w, d, extra = {}, more = {}) => ({ id, kind: 'room', order: 1, recipe: { type: 'common', x, z, w, d, ...extra }, ...more });

// cells are 5 ft: the inn covers x 0..30, z 0..20
const E = Object.fromEntries([
  room('inn', 0, 0, 6, 4),                                  // ground floor, top at 10
  room('up', 0, 0, 4, 4, { y: 10 }),                        // over the west part (x 0..20), top at 20
  room('third', 0, 0, 2, 4, { y: 20 }),                     // over x 0..10, top at 30
  room('yard', 8, 0, 4, 4, { type: 'yard' }),               // x 40..60: open to the sky
  room('hall', 14, 0, 4, 4, { tall: 2 }),                   // x 70..90: one room two storeys high, top at 20
  room('cellar', 20, 0, 4, 4, { y: -10 }),                  // x 100..120, under the ground, top at 0
  room('ruin', 26, 0, 4, 4, {}, { roof: { off: true } }),   // x 130..150: its roof is off
].map(r => [r.id, r]));
const open = (r) => r.recipe.type === 'yard' || !!r.roof?.off;
const B = (x, z, y) => baseUnder(E, x, z, y, open);
const is = (b, y, on, rm = undefined) => b.y === y && b.on === on && (rm === undefined || b.room === rm);

// ---- 1. the rule ----
check('open ground, standing', is(B(200, 200, 0), 0, 'ground', null));
check('open ground, 40 ft up: the base is on the ground', is(B(200, 200, 40), 0, 'ground', null), B(200, 200, 40));
check('over a yard, 40 ft up: on the yard\'s own ground (a yard has no top)', is(B(50, 10, 40), 0, 'floor', 'yard'), B(50, 10, 40));
check('in the inn, raised 6 ft: on the inn\'s floor', is(B(25, 10, 6), 0, 'floor', 'inn'), B(25, 10, 6));
check('over the inn\'s one-storey part, 40 ft up: on its roof (the room\'s top)', is(B(25, 10, 40), 10, 'top', 'inn'), B(25, 10, 40));
check('just under that ceiling (9.8 ft): still in the room, on its floor', is(B(25, 10, 9.8), 0, 'floor', 'inn'), B(25, 10, 9.8));
check('exactly at the top: on it', is(B(25, 10, 10), 10, 'top', 'inn'), B(25, 10, 10));
check('upstairs, standing: on the upper floor', is(B(15, 10, 10), 10, 'floor', 'up'), B(15, 10, 10));
check('upstairs, raised 5 ft: on the upper floor', is(B(15, 10, 15), 10, 'floor', 'up'), B(15, 10, 15));
check('raised from the ground floor through the ceiling (12 ft): on the upper floor, not the lower room\'s top', is(B(15, 10, 12), 10, 'floor', 'up'), B(15, 10, 12));
check('over the two-storey part, 40 ft up: on the upper room\'s top (20)', is(B(15, 10, 40), 20, 'top', 'up'), B(15, 10, 40));
check('third floor, standing', is(B(5, 10, 20), 20, 'floor', 'third'), B(5, 10, 20));
check('over the third floor, 45 ft up: on its top (30)', is(B(5, 10, 45), 30, 'top', 'third'), B(5, 10, 45));
check('in a tall room, 15 ft up: on its floor (it is one room)', is(B(80, 10, 15), 0, 'floor', 'hall'), B(80, 10, 15));
check('over a tall room, 40 ft up: on its top (20)', is(B(80, 10, 40), 20, 'top', 'hall'), B(80, 10, 40));
check('in the cellar: on the cellar floor', is(B(110, 10, -10), -10, 'floor', 'cellar'), B(110, 10, -10));
check('over the cellar, 40 ft up: on the ground over it (the cellar\'s top, 0)', is(B(110, 10, 40), 0, 'top', 'cellar'), B(110, 10, 40));
check('over a room whose roof is off: down on its floor', is(B(140, 10, 40), 0, 'floor', 'ruin'), B(140, 10, 40));
check('with no isOpen given, a yard counts as roofed (the core alone does not know room types)', baseUnder(E, 50, 10, 40).y === 10);
check('below ground with no room: where the figure is', is(B(300, 300, -10), -10, 'ground', null));

// ---- the cut asks the base (the acceptance test, in data) ----
check('Harry\'s dragon: outdoors at 40 ft, the cut at 20 ft: shown', visibleAt(B(200, 200, 40).y, 20));
check('the dragon over the yard, looking into the ground floor (cut 9): shown', visibleAt(B(50, 10, 40).y, ceilingOf(E, E.inn)));
check('a pawn standing on the third floor, looking into the first: hidden', !visibleAt(B(5, 10, 20).y, ceilingOf(E, E.inn)));
check('a pawn standing on the third floor, looking into the third: shown', visibleAt(B(5, 10, 20).y, ceilingOf(E, E.third)));
check('a flyer over the inn\'s roof, looking into the ground floor: hidden (its base is on the roof)', !visibleAt(B(25, 10, 40).y, ceilingOf(E, E.inn)));
check('a pawn raised 6 ft inside the inn, looking into the inn: shown', visibleAt(B(25, 10, 6).y, ceilingOf(E, E.inn)));

// ---- 2. the room a pawn is in (hide/reveal, the room-hide cascade: core/commands.js asks tokenFloor) ----
{
  let n = 0, bad = [];
  for (const x of [5, 15, 25, 80, 110, 200]) for (const y of [-10, -4, 0, 3, 9.8, 10, 12, 15, 19.9, 20, 25, 30, 45]) {
    const b = B(x, 10, y), t = tokenFloor(E, { x, z: 10, y }), inRoom = b.on === 'floor' ? b.room : null; n++;
    if ((t.room || null) !== inRoom) bad.push([x, y, t.room, b]);
  }
  check(`the base's room is tokenFloor's room for every roofed room (${n} places)`, !bad.length, bad.slice(0, 3));
}

// ---- 3. the frozen corpus ----
{
  const dir = corpusDir(); let camps = 0, pawns = 0, standing = 0, raised = 0, bad = [], odd = [];
  const maps = (o, out) => { // every entity map in a snapshot: an object whose values are entities
    if (!o || typeof o !== 'object') return out;
    if (!Array.isArray(o)) { const vs = Object.values(o); if (vs.length && vs.every(v => v && typeof v === 'object' && typeof v.kind === 'string' && typeof v.id === 'string')) { out.push(o); return out; } }
    for (const v of Array.isArray(o) ? o : Object.values(o)) maps(v, out);
    return out;
  };
  for (const c of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.startsWith('cmp_')) : []) {
    const f = path.join(dir, c, 'snapshot.json'); if (!fs.existsSync(f)) continue;
    let snap; try { snap = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    camps++;
    for (const ents of maps(snap, [])) for (const t of Object.values(ents)) {
      if (t.kind !== 'token') continue; pawns++;
      const y = t.y || 0, b = baseUnder(ents, t.x, t.z, y), fl = floorUnder(ents, t.x, t.z, y)?.y ?? Math.min(0, y);
      if (!Number.isFinite(b.y) || b.y > y + 0.5) bad.push([c, t.id, y, b]);
      if (Math.abs(y - fl) <= 0.3) { standing++; if (Math.abs(y - b.y) > 0.5) odd.push([c, t.id, y, b]); } else raised++;
      for (const k of Object.keys(t)) if (/^(base|baseY|foot)$/.test(k)) bad.push([c, t.id, 'stores ' + k]);
    }
  }
  console.log(`  (corpus: ${camps} campaigns with a snapshot, ${pawns} pawns: ${standing} standing on their floor, ${raised} in the air)`);
  check('the corpus was read', camps > 0 && pawns > 0, { camps, pawns });
  check('every saved pawn gets a base at or below its figure; none stores one', !bad.length, bad.slice(0, 3));
  check('every pawn that stood on its floor still does (its base is where its figure is: nothing to migrate)', !odd.length, odd.slice(0, 3));
}
void roomTop;
console.log(`pawnbase: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
