// Floor flats never share a height with the floor or with each other (streetfix, 2026-11-07). Harry on dev: "on the
// street the crosswalks and sidewalks show up glitchy? I think they might not be being drawn above the floor but equal to
// it?" They were: dunFlat (the strip rows: the street's pavement, centre line and zebra crossing, the dungeon's chasm and
// sewer, the mine's rails, the rune tiles) laid every flat at y 0.02, the floor tiles' own height, so the two planes
// fought for each pixel (z-fighting). The rule, for every room type of every pack:
//   floor     a flat on the floor (orient 'floor', on the ground) stands at least GAP above the floor tiles
//             (look.floorSpecs: y 0.02)
//   stacks    two opaque floor flats that overlap differ in height by at least GAP (the crossing over the centre line,
//             the manhole on it, litter on the pavement)
//   low       and none rises past 0.5 ft (a flat is a picture on the floor: feet still stand on the floor)
// GAP = 0.008 ft: the depth step at the far edge of a table view (camera near 0.5 ft, 24-bit depth, ~200 ft) is ~0.005.
// The solver's own `soft` flag is not exempt: it never reaches the game, which draws every placed flat as an opaque
// cut-out that writes depth (the worn path's 0.0012-ft steps rounded to one height there).
// The fix is general (solver.js Ctx.flatHeight, in record()), so this runs every room type of every pack.
//   node tools/spawn-tuner/test/flats.test.mjs [tuner dir] [--print]
import { loadTree, makeHarness, aabb, TOL } from './ccm_lib.mjs';
const S = await loadTree('flats'), H = makeHarness(S), { ok, mk } = H, PRINT = process.argv.includes('--print');
const FLOOR_Y = 0.02, GAP = 0.008;
const opaqueFlat = (p) => p.orient === 'floor' && p.y < 0.5 && !p.parent; // (every one: the game draws each placed flat as an opaque cut-out that writes depth; the tuner's soft flag does not reach it)
const over = (a, b) => { const [aw, ad] = aabb(a), [bw, bd] = aabb(b); return Math.abs(a.x - b.x) < (aw + bw) / 2 - TOL && Math.abs(a.z - b.z) < (ad + bd) / 2 - TOL; };
// every room type, three sizes, three seeds; outdoor rooms a long strip as well (the street needs >= 30 ft for its crossing)
const SIZES = [[6, 5], [10, 5], [8, 8]];
const bad = new Map(); let rooms = 0, flats = 0, maxY = [0, ''];
const note = (k, tag) => { if (!bad.has(k)) bad.set(k, []); bad.get(k).push(tag); };
for (const t of S.types) for (const [w, d] of SIZES) for (let s = 1; s <= 3; s++) {
  const seed = s * 977 + w * 13 + d, r = mk('r', t.key, 10, 10, w, d, seed, 1), tag = `${t.key} ${w}x${d} seed ${seed}`;
  let L; try { L = H.build([r]).solve('r'); } catch (e) { continue; } // (a type that cannot solve alone is the type's own suite's business)
  if (!L?.placements) continue;
  rooms++;
  const F = L.placements.filter(opaqueFlat); flats += F.length;
  for (const p of F) {
    if (p.y > maxY[0]) maxY = [p.y, `${tag} ${p.id}`];
    ok(p.y <= 0.5, `${tag} ${p.id} at y ${p.y}: a flat risen off the floor`);
    if (!ok(p.y >= FLOOR_Y + GAP - 1e-9, `${tag} ${p.id} (${p.rule}) at y ${p.y.toFixed(4)}: on the floor's own plane (${FLOOR_Y})`)) note(`${t.key}: ${p.id} on the floor`, tag);
  }
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
    const a = F[i], b = F[j];
    if (over(a, b) && !ok(Math.abs(a.y - b.y) >= GAP - 1e-9, `${tag} ${a.id} (${a.y.toFixed(4)}) / ${b.id} (${b.y.toFixed(4)}) overlap at the same height`)) note(`${t.key}: ${a.id} / ${b.id}`, tag);
  }
}
ok(rooms > 300, `rooms solved: ${rooms}`); ok(flats > 500, `opaque floor flats checked: ${flats}`);
// the street itself, by name: its rows lie over the asphalt, the crossing over the centre line
{ const r = mk('r', 'mod-street', 10, 10, 10, 5, 7, 1), L = H.build([r]).solve('r'), P = L.placements;
  const y = (id) => P.filter(p => p.id === id).map(p => p.y);
  for (const id of ['floor-tile-pavement', 'road-strip', 'crosswalk-strip']) ok(y(id).length && y(id).every(v => v >= FLOOR_Y + GAP), `street: every ${id} above the floor (${[...new Set(y(id))]})`);
  const cross = P.filter(p => p.id === 'crosswalk-strip'), centre = P.filter(p => p.id === 'road-strip');
  ok(cross.some(c => centre.some(m => over(c, m))), 'street: the crossing does cross the centre line (the case the stack rule is for)');
  ok(cross.every(c => centre.filter(m => over(c, m)).every(m => c.y >= m.y + GAP)), 'street: the crossing is drawn over the centre line, not under it');
  if (PRINT) console.log('street heights', Object.fromEntries([...new Set(P.filter(opaqueFlat).map(p => p.id))].map(id => [id, [...new Set(y(id))]])));
}
if (bad.size) { console.log('\nwhere:'); for (const [k, v] of bad) console.log(`  ${k}  (${v.length}; e.g. ${v[0]})`); }
console.log(`${rooms} rooms, ${flats} floor flats; highest ${maxY[0]} (${maxY[1]})`);
H.report('flats');
