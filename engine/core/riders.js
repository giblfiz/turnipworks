// RIDERS: WHAT STANDS ON A THING MOVES WITH IT (Harry 2026-11-07: "If I stand a pawn on a table, and then I move the table,
// it should move the pawn with it." It came up designing an elevator: a shaft and a car, and moving the car up carries
// everything on it). docs/PAWNS.md "Riders".
//
// Two kinds of rider, one rule each, and both are what the player SEES standing there:
//   a THING rides the thing it was put on: its `parent` (set where it was dropped, by the same downward look that drew it
//          on the top: world.surfaceBelow). restingOn / goesWith below, unchanged since 2026-11-02 (for every action on
//          a parent: move, turn, raise, hide, copy, delete). A LOCKED thing stays, and so does what stands on it.
//   a PAWN rides the thing its base stands on. A pawn has no parent: its base is drawn on the highest surface under its
//          middle (world.pawnBaseAt, the same downward look). The browser asks THAT look at the start of a move
//          (client/main.js app.pawnCarrier); a seat with no view (an AI seat through the relay, relay/llm.js) asks the
//          data: pawnRestsOn below, the thing's box (dims) standing at its place. The two agree wherever the mesh fills
//          its box, which the library's fitting makes so (client/kitfit.js); the tests hold a table to both.
// Membership is decided ONCE, when the move starts (a snapshot): dragging a table under a pawn does not scoop it up.
// What carries: an ordinary thing. Not a floor tile, a hole or a pit, a stair or ladder (a floor, not a tray), a wall
// piece, a door or a window (the room's shell), nor a thing hung on a wall. Rooms are not carriers here: a room's move
// (room.move, room.rotate, its height) carries its contents by its own rules, as it always did.
// What rides: pawns standing on its top, and things whose parent it is (a picture hung on a wall has no parent: it
// rides nothing; what was put on a wall shelf rides the shelf, as it always did).
import { isConnector } from './stairs.js';
import { isOpening, isHole, pitOf } from './holes.js';
import { isCar, carDeckY } from './elevator.js';

export const restingOn = (entities, id) => Object.values(entities).filter(e => e.kind === 'object' && e.parent === id);
export function goesWith(entities, id) {
  const gone = [], kept = [], seen = new Set([id]);
  const walk = (at) => { for (const c of restingOn(entities, at)) { if (seen.has(c.id)) continue; seen.add(c.id); if (c.locked) kept.push(c); else { gone.push(c.id); walk(c.id); } } };
  walk(id);
  return { gone, kept };
}

const isTileE = (e) => e?.kind === 'object' && e.place === 'tile';
const shell = (e) => !!e.fromEdge || e.place === 'kit' || e.layer === 'walls' || e.layer === 'openings';
export const canCarry = (e) => e?.kind === 'object' && !isTileE(e) && !isOpening(e) && !isHole(e) && !pitOf(e) && !isConnector(e) && !shell(e) && e.place !== 'wall';

// (x, z) in a thing's own frame: along its width (dims[0]) and its depth (dims[2]), turned by rot as world.js draws it
// (Ry(rot): the turn ops use x' = dx cos + dz sin, z' = -dx sin + dz cos)
const local = (c, x, z) => { const dx = x - c.x, dz = z - c.z, cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0); return [dx * cs - dz * sn, dx * sn + dz * cs]; };
export const topOf = (c) => isCar(c) ? carDeckY(c) : (c.y || 0) + (c.dims?.[1] ?? 2); // (2026-11-07, modrooms: an elevator car's top is its floor inside the cab, core/elevator.js)
// is (x, z) over the thing's footprint (slack: feet beyond its box that still count)?
export function over(c, x, z, slack = 0) { const [u, v] = local(c, x, z), [w, , d] = c.dims || [2, 2, 2]; return Math.abs(u) <= w / 2 + slack && Math.abs(v) <= d / 2 + slack; }

// THE DATA'S ANSWER (no view): does pawn p's base stand on the top of thing c? Its middle is over c's footprint and its
// figure stands at c's top (as a pawn let go over a table settles there: main.js pawnLandY), within TOP_SLACK. A pawn
// raised a few feet over the table (flying) is not on it. A tipped thing (quat) carries nothing this way: its top is
// not where its box says.
export const TOP_SLACK = 0.6; // ft
export function pawnRestsOn(p, c) {
  if (p?.kind !== 'token' || !canCarry(c) || c.quat) return false;
  const y = p.y || 0, top = topOf(c);
  return y > (c.y || 0) + 0.05 && Math.abs(y - top) <= TOP_SLACK && over(c, p.x, p.z);
}
// the thing a pawn stands on, by the data: of the things it rests on, the one whose top is nearest its feet (a cup's
// saucer on the table: the saucer). null = on a floor (or flying).
export function carrierOfPawn(entities, p) {
  let best = null, bd = Infinity;
  for (const c of Object.values(entities)) if (pawnRestsOn(p, c)) { const d = Math.abs((p.y || 0) - topOf(c)); if (d < bd) { bd = d; best = c; } }
  return best;
}

// EVERYTHING THAT RIDES thing `id`, however deep (a mug on a tray on a table; a pawn on the tray): the things (goesWith:
// parents, exactly as before 2026-11-07, locked ones staying with what is on them) and the pawns standing on it or on
// any of them that can carry (canCarry). pawnOn(p) -> the id of the thing pawn p stands on (the browser: its downward
// look; default: the data, carrierOfPawn). -> [ids], things first, then pawns.
export function ridersOf(entities, id, { pawnOn = (p) => carrierOfPawn(entities, p)?.id || null } = {}) {
  if (entities[id]?.kind !== 'object') return [];
  const things = goesWith(entities, id).gone;
  const carriers = new Set([id, ...things].filter(c => canCarry(entities[c])));
  const pawns = carriers.size ? Object.values(entities).filter(e => e.kind === 'token' && carriers.has(pawnOn(e))).map(e => e.id) : [];
  return [...things, ...pawns];
}

// THE RELAY'S CHECK of a carry list (object.move `carry`). A THING may be carried only if it stands on the carrier by
// its parent, however deep (goesWith: the data says so exactly, and a locked one never goes). A PAWN may be carried if a
// seat could have seen it standing there before the move: over the footprint of the carrier or of another carried
// thing that can carry (a pawn on a tray on the table), its feet between that thing's floor and a little over its top.
// Generous on purpose (the browser decided by what it drew, and a mesh is inside its box), strict enough that moving a
// table cannot take along a pawn from across the room. -> null, or why not
export const NEAR_SLACK = 1; // ft beyond the box, either way
export function carryProblem(entities, id, carry) {
  const c = entities[id], list = [...new Set(carry)], chain = new Set(goesWith(entities, id).gone);
  const under = [c, ...list.map(r => entities[r]).filter(u => u?.kind === 'object' && chain.has(u.id))].filter(canCarry);
  for (const rid of list) {
    const r = entities[rid];
    if (!r) return `no ${rid} in this area`;
    if (rid === id) return `${c.name || id} cannot carry itself`;
    if (r.kind === 'object') { if (!chain.has(rid)) return `${r.name || rid} is not standing on ${c.name || id}${r.locked ? ' (it is locked)' : ''}`; continue; }
    if (r.kind !== 'token') return `${r.name || rid} cannot ride`;
    const y = r.y || 0, ok = under.some(u => !u.quat && over(u, r.x, r.z, NEAR_SLACK) && y >= (u.y || 0) - 0.5 && y <= topOf(u) + NEAR_SLACK);
    if (!ok) return `${r.name || rid} is not standing on ${c.name || id}`;
  }
  return null;
}
