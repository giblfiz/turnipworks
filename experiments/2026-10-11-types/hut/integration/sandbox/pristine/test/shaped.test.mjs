// Rooms that are not rectangles (the game's L-shaped rooms, Harry 2026-10-05).   node tools/spawn-tuner/test/shaped.test.mjs
// The game gives such a room `cells` (the 5-ft cells it stands on, [i, j] from its bounding rectangle's corner) and
// furnishes it as rectangles: the largest one as the room it is, the rest with `annex: true`, told of the JOINS between
// them. This file checks the tuner's side of that:
//   walls     perimeter() follows the cells (inner walls carry `line`); rectangles are untouched; a room in the notch
//             shares the inside corner's walls; the inside corner gets a post; a wide outside door stays on one straight wall
//   turns     a turned room keeps its outside door on the same wall of the room (room.turn)
//   solver    annex: no key purpose; a join is kept clear and is not the door that counts when a real one exists
import { readFileSync } from 'node:fs';
import { solveRoom2 } from '../js/solver2.js';
import { computeEdges, chooseExteriorDoor, perimeter, turnSide } from '../js/walls.js';

const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json')), types = JSON.parse(readFileSync(here + 'data/rooms.json')), orient = JSON.parse(readFileSync(here + 'data/orient.json'));
const T = Object.fromEntries(types.map(t => [t.key, t]));
let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; if (fails < 40) console.log('FAIL', m); } };
const mk = (id, type, x, z, w, d, seed, created, extra = {}) => ({ id, type, x, z, w, d, seed, wallSeed: seed * 3 + 1, family: T[type].family, created, ...extra });
const cellsOfL = (w, d, nw, nd) => { const out = []; for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) if (!(i >= w - nw && j < nd)) out.push([i, j]); return out; }; // a w x d room with its north-east nw x nd corner missing

// ---- walls ----
{
  const rect = mk('r', 'common', 2, 3, 5, 4, 1, 1), P = perimeter(rect);
  ok(P.length === 18 && P.every(e => e.line === undefined) && P[0].key === 'h:2:3' && P[0].side === 'N', 'a rectangle\'s perimeter is exactly as before (no cells, no line)');
  const L = mk('L', 'common', 10, 10, 7, 6, 5, 1, { cells: cellsOfL(7, 6, 3, 3) }), PL = perimeter(L);
  const inner = PL.filter(e => (e.side === 'E' && e.line === 4) || (e.side === 'N' && e.line === 3));
  ok(PL.length === 26 && inner.length === 6 && inner.map(e => e.key).sort().join() === 'h:14:13,h:15:13,h:16:13,v:14:10,v:14:11,v:14:12', `an L's perimeter follows its cells: 26 segments, six on the two walls of the inside corner (${inner.map(e => e.key)})`);
  ok(PL.filter(e => e.side === 'N').every(e => (e.index < 4 && e.line === 0) || (e.index >= 4 && e.line === 3)) && !PL.some(e => e.key === 'h:14:10'), 'side and index are named along the bounding rectangle; nothing is built round the notch');
  const E = computeEdges([L], { engine: 'v2' });
  ok(E.corners.some(c => c.gx === 14 && c.gz === 13) && !E.corners.some(c => c.gx === 17 && c.gz === 10) && inner.every(e => E.edges.get(e.key)?.owner.room === 'L'), 'the inside corner gets a post and both its walls; the notch\'s far corner gets nothing');
  ok((E.openings.get('L') || []).every(o => o.line !== undefined && o.key), 'a shaped room\'s openings carry their wall line and key (the game maps them onto its rectangles)');
  const N = mk('N', 'privy', 14, 10, 3, 3, 9, 2), E2 = computeEdges([L, N], { engine: 'v2' });
  ok(inner.every(e => E2.edges.get(e.key).sides.length === 2) && [...E2.edges.values()].filter(e => e.sides.length === 2).length === 6, 'a room built in the notch shares exactly the inside corner\'s six wall segments with the L');
  // a wide outside door never bends round a corner: every one of its segments is on the same straight wall
  let wide = 0, bent = 0;
  for (let seed = 1; seed <= 400; seed++) for (const type of ['barn', 'stable', 'common']) {
    const r = mk('B', type, 0, 0, 8, 6, seed, 1, { cells: cellsOfL(8, 6, 3, 2) }), dr = chooseExteriorDoor(r, [r]);
    if (!dr || dr.span < 2) continue; wide++;
    const segs = perimeter(r).filter(e => dr.keys.includes(e.key));
    if (segs.length !== dr.span || new Set(segs.map(e => e.line)).size !== 1 || new Set(segs.map(e => e.side)).size !== 1) bent++;
  }
  ok(wide > 100 && bent === 0, `${wide} wide outside doors on L-shaped barns, stables and common rooms: each on one straight wall`);
}
// ---- turns: the outside door goes round with the room ----
{
  let same = 0, n = 0;
  for (let seed = 1; seed <= 300; seed++) for (const type of ['guest', 'common', 'kitchen', 'storeroom']) {
    const r0 = mk('T', type, 0, 0, 5, 4, seed, 1), d0 = chooseExteriorDoor(r0, [r0]);
    for (let turn = 1; turn <= 3; turn++) {
      const r = { ...r0, w: turn % 2 ? 4 : 5, d: turn % 2 ? 5 : 4, turn }, dt = chooseExteriorDoor(r, [r]); n++;
      if (dt && dt.side === turnSide(d0.side, turn) && dt.span === d0.span) same++;
    }
  }
  ok(n === 3600 && same === n, `a turned room's outside door is on the same wall of the room, the same width (${same}/${n})`);
  const r0 = mk('T', 'guest', 0, 0, 5, 4, 7, 1);
  ok(JSON.stringify(chooseExteriorDoor({ ...r0, turn: 0 }, [r0])) === JSON.stringify(chooseExteriorDoor(r0, [r0])), 'turn 0 is the room as it always was');
}
// ---- the solver: an annex, and joins ----
{
  let keyed = 0, n = 0, joinMain = 0, blocked = 0, realMain = 0;
  for (let seed = 1; seed <= 40; seed++) for (const type of ['guest', 'common', 'kitchen', 'fine', 'storeroom', 'stable']) {
    const room = mk('A', type, 0, 0, 3, 3, seed, 1), join = [0, 1, 2].map(t => ({ side: 'W', index: t, kind: 'door', to: 'A', key: 'join', span: 3, part: t > 0, join: true, why: 'open to the rest of the room' }));
    const real = { side: 'S', index: 1, kind: 'door', to: null, key: 'h:1:3', span: 1 };
    const A = solveRoom2({ lib, type: T[type], room, openings: [...join, real], opts: { orient, minStars: 3, hideMasking: true, scaleVariety: 0.15, sizeRule: 'auto' }, annex: true });
    n++;
    if (A.checks.purpose.feature) keyed++;
    if (A.mainDoor?.side === 'S') realMain++; else joinMain++;
    // nothing floor-standing within 1 ft of the join line (the west side, x = 0.5 .. 1.5 ft from the wall line)
    if (A.placements.some(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && p.kind !== 'flat' && p.x - Math.max(p.dims[0], p.dims[2]) / 2 < 1.0)) blocked++;
    const J = solveRoom2({ lib, type: T[type], room, openings: join, opts: { orient, minStars: 3, hideMasking: true, scaleVariety: 0.15, sizeRule: 'auto' }, annex: true });
    if (!J.mainDoor) joinMain = -1e9; // with no real door the join is the way in
  }
  ok(n === 240 && keyed === 0, `an annex has no key purpose of its own: no second bed, hearth or stalls (${keyed}/${n} had one)`);
  ok(realMain === n && joinMain === 0, `a real door, when there is one, is the door that counts; a join stands in when there is none (${realMain}/${n})`);
  ok(blocked === 0, `the join is kept clear: nothing stands in it (${blocked}/${n} rooms had something there)`);
  const plain = solveRoom2({ lib, type: T.guest, room: mk('P', 'guest', 0, 0, 5, 4, 3, 1), openings: [{ side: 'S', index: 2, kind: 'door', to: null, key: 'h:2:4', span: 1 }], opts: { orient, minStars: 3, hideMasking: true, scaleVariety: 0.15, sizeRule: 'auto' } });
  ok(!!plain.checks.purpose.feature, 'an ordinary room still has its key purpose');
}
console.log(`shaped: ${checks} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
