// TRAVEL: a pawn goes to another area (Harry 2026-10-06; docs/PAWNS.md "Areas: travel, and keeping surprises hidden").
// The command and its rules are in core/commands.js (`travel`); the relay turns it into the two halves of a transfer.
// This file answers ONE question, in ONE function, so the answer is easy to change:
//
//   WHERE DOES A TRAVELLING PAWN ARRIVE?   arrivalPoint(entities, seats, { id }) -> { x, z, y, by }
//     1. 'mark'    the GM's arrival mark in that area, if there is one (an object with place 'arrival': it is placed,
//                  moved, hidden and deleted like any other thing; several marks: the first placed)
//     2. 'party'   else beside the party pawn nearest the middle of the party pawns already there (a party pawn is a
//                  pawn owned by a player's seat)
//     3. 'side'    else NOT the middle of the area: out on open ground to the side of everything built, so a newcomer
//                  arrives beside the map rather than inside a room they have not found. The side is the SOUTH one
//                  (ARRIVAL_SIDE, +z: the edge nearest the camera in the home view, so the pawn stands in front of
//                  the buildings, not behind them), level with the middle of what is built, ARRIVAL_WALK feet (two
//                  squares) out from the built edge, at ground level. An area with nothing built: 0, 0.
//   and ALWAYS on a free square: the centre of a 5-ft square (pawns snap to the squares) with no pawn and no furniture
//   on it, on the same floor as the spot it was aiming for (open ground stays open ground), the nearest such square to
//   that spot. So several arrivals never stack.
// Harry, 2026-10-06: "pawn arrival: marked location > a party pawn there > NOT area center. out in the fog sea to the
// side of the area."
import { floorUnder } from './height.js';

export const ARRIVAL_PLACE = 'arrival';
export const TRAVEL_CELL = 5;
export const ARRIVAL_SIDE = 'south', ARRIVAL_WALK = 10; // which side of what is built, and how far out (feet)
const centreOf = (v) => (Math.floor(v / TRAVEL_CELL) + 0.5) * TRAVEL_CELL;
const isMark = (e) => e.kind === 'object' && e.place === ARRIVAL_PLACE;
// things that never fill a square: floor tiles, the mark itself, stairs (a pawn may stand on one), what hangs on a wall
const FLAT = new Set(['tile', ARRIVAL_PLACE, 'stair', 'wall', 'ceiling', 'surface']);

export function arrivalMarks(entities) { return Object.values(entities || {}).filter(isMark).sort((a, b) => (a.id < b.id ? -1 : 1)); }

export function arrivalPoint(entities, seats = {}, { id = null } = {}) {
  const E = Object.values(entities || {}).filter(e => e.id !== id);
  const mark = arrivalMarks(entities)[0];
  if (mark) return { ...freeSquare(E, entities, mark.x, mark.z, mark.y || 0, true), by: 'mark' };
  const isPlayer = (sid) => { const s = seats[sid], p = s?.kind === 'llm' ? seats[s.creator] : s; return !!p && !s.revoked && p.role === 'player'; };
  const party = E.filter(e => e.kind === 'token' && e.owner && isPlayer(e.owner));
  if (party.length) {
    const cx = party.reduce((a, e) => a + e.x, 0) / party.length, cz = party.reduce((a, e) => a + e.z, 0) / party.length;
    const near = party.reduce((a, e) => Math.hypot(e.x - cx, e.z - cz) < Math.hypot(a.x - cx, a.z - cz) ? e : a);
    return { ...freeSquare(E, entities, near.x, near.z, near.y || 0, false), by: 'party' };
  }
  const box = builtBox(E);
  if (!box) return { ...freeSquare(E, entities, 0, 0, 0, true), by: 'side' };
  const mid = (a, b) => (a + b) / 2, out = ARRIVAL_WALK + TRAVEL_CELL / 2;
  const at = { south: [mid(box.x0, box.x1), box.z1 + out], north: [mid(box.x0, box.x1), box.z0 - out], east: [box.x1 + out, mid(box.z0, box.z1)], west: [box.x0 - out, mid(box.z0, box.z1)] }[ARRIVAL_SIDE];
  return { ...freeSquare(E, entities, at[0], at[1], 0, true), by: 'side' };
}

// the box round everything built in an area, in feet: every room on every level (a cellar counts), and every thing
// that is not a pawn or the mark; null when nothing is built
export function builtBox(E) {
  let b = null; const grow = (x0, z0, x1, z1) => { b = b ? { x0: Math.min(b.x0, x0), z0: Math.min(b.z0, z0), x1: Math.max(b.x1, x1), z1: Math.max(b.z1, z1) } : { x0, z0, x1, z1 }; };
  for (const e of E) {
    if (e.kind === 'room' && e.recipe) grow(e.recipe.x * TRAVEL_CELL, e.recipe.z * TRAVEL_CELL, (e.recipe.x + e.recipe.w) * TRAVEL_CELL, (e.recipe.z + e.recipe.d) * TRAVEL_CELL);
    else if (e.kind === 'object' && !isMark(e) && Number.isFinite(e.x) && Number.isFinite(e.z)) { const r = Math.max(e.dims?.[0] || 0, e.dims?.[2] || 0) / 2; grow(e.x - r, e.z - r, e.x + r, e.z + r); }
  }
  return b;
}

// the nearest free square to (x, z) at height y; `self`: may it be the square (x, z) is in (no: "beside" a pawn)
export function freeSquare(E, entities, x, z, y = 0, self = true) {
  const bx = centreOf(x), bz = centreOf(z), floor = floorUnder(entities, bx, bz, y), H = TRAVEL_CELL / 2;
  const blocked = (cx, cz) => E.some(e => {
    if (Math.abs((e.y || 0) - y) >= 8) return false; // another floor
    if (e.kind === 'token') return Math.abs(e.x - cx) < H && Math.abs(e.z - cz) < H;
    if (e.kind !== 'object' || FLAT.has(e.place) || e.layer === 'floor') return false;
    const [w, , d] = e.dims || [2, 2, 2], r = Math.max(0.5, Math.min(w, d) / 2 - 0.25); // its narrow half: a long table blocks its own squares, not the aisle beside it
    return Math.abs(e.x - cx) < H + r - 0.5 && Math.abs(e.z - cz) < H + r - 0.5;
  });
  // on the same floor as the spot: in a room when the spot is in one (never the far side of the outside wall's void)
  const sameFloor = (cx, cz) => { const f = floorUnder(entities, cx, cz, y); return floor ? !!f && f.y === floor.y : !f; };
  const cand = [];
  for (let r = 0; r <= 12 && !cand.length; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r || (r === 0 && !self)) continue;
      const cx = bx + i * TRAVEL_CELL, cz = bz + j * TRAVEL_CELL;
      if (sameFloor(cx, cz) && !blocked(cx, cz)) cand.push([Math.hypot(cx - x, cz - z), cx, cz]);
    }
  }
  if (!cand.length) return { x: bx, z: bz, y: floor ? floor.y : y };
  cand.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  return { x: cand[0][1], z: cand[0][2], y: floor ? floor.y : y };
}
