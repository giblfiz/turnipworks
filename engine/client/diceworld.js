// WHAT THE DICE HIT (2026-10-19): the colliders a throw is simulated against, built from the area as the ROLLER's
// client holds it. Pure (no three.js, no DOM): engine/test/diceworld.test.mjs runs it in node.
//   floors and level surfaces  each room on the roller's level as a slab at its floor height, and open ground at 0
//   walls and closed doors     vision.js blockingSegments (the same walls that stop sight), as boxes a storey high
//   props                      their library box (dims), turned with the thing
//   pawns                      upright cylinders (fixed: dice never move a prop or a pawn)
// SECRECY: nothing hidden from players is ever a collider, even when the GM rolls in public: a die that bounced off a
// hidden pawn or a hidden room's wall would show the players where it stands. So hidden rooms, their walls (an edge
// whose every side is a hidden room), hidden things, things inside a hidden room and hidden pawns are all left out.
import { blockingSegments } from './vision.js';
import { baseUnder, roomTop } from '../core/height.js';

const WALL_T = 0.6, STOREY = 10;
const roomY = (r) => (r.recipe.y || 0);
const near = (x, z, from, reach) => Math.abs(x - from.x) <= reach && Math.abs(z - from.z) <= reach;

export function diceWorld({ entities = {}, edges = null, from, level = 0, reach = 20, isOpen = null, pawnRadius = (t) => 0.9 * Math.max(0.5, t.size || 1) }) {
  const E = entities, hiddenRooms = new Set(Object.values(E).filter(e => e.kind === 'room' && e.hidden).map(e => e.id));
  const secret = (e) => !!e.hidden || (e.room && hiddenRooms.has(e.room));
  // what players may know of: everything not hidden (the GM's view has the hidden things too, flagged)
  const known = Object.fromEntries(Object.entries(E).filter(([, e]) => !secret(e)));
  const out = { surfaces: [], boxes: [], cylinders: [], left: { rooms: 0, things: 0, pawns: 0, walls: 0 } };
  // floors: the rooms of this level (their bounding rectangles), and the open ground under everything
  for (const r of Object.values(E)) {
    if (r.kind !== 'room' || !r.recipe) continue;
    if (secret(r)) { out.left.rooms++; continue; }
    const y = roomY(r); if (Math.abs(y - level) > 0.5) continue;
    out.surfaces.push({ x0: r.recipe.x * 5, z0: r.recipe.z * 5, x1: (r.recipe.x + r.recipe.w) * 5, z1: (r.recipe.z + r.recipe.d) * 5, y });
  }
  if (level <= 0.5) out.surfaces.push({ x0: from.x - reach - 10, z0: from.z - reach - 10, x1: from.x + reach + 10, z1: from.z + reach + 10, y: Math.min(0, level) });
  // walls: the sight-blocking segments of the edges players can know about
  if (edges) {
    const all = edges instanceof Map ? [...edges.values()] : Object.values(edges);
    const vis = all.filter(e => { const hid = (e.sides || []).length > 0 && e.sides.every(s => hiddenRooms.has(s.room)); if (hid) out.left.walls++; return !hid; });
    for (const [x0, z0, x1, z1] of blockingSegments(vis, known, level)) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; if (!near(cx, cz, from, reach + 10)) continue;
      const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.01) continue;
      out.boxes.push({ x: cx, y: level + STOREY / 2, z: cz, hx: len / 2 + WALL_T / 2, hy: STOREY / 2, hz: WALL_T / 2, yaw: -Math.atan2(z1 - z0, x1 - x0), wall: true });
    }
  }
  // props and pawns near the throw
  for (const e of Object.values(E)) {
    if (e.kind === 'object') {
      if (secret(e)) { out.left.things++; continue; }
      if (!Number.isFinite(e.x) || !near(e.x, e.z, from, reach)) continue;
      const d = e.dims; if (!d || d[1] < 0.15 || e.flat) continue; // (rugs, decals and flats: nothing to bounce off)
      if (/^wall-straight|^door-|(^|-)gate(-|$)|portcullis/.test(e.cat || '') || e.fromEdge) continue; // (walls and doors come from the edges)
      const base = Number.isFinite(e.y) ? e.y : baseUnder(E, e.x, e.z, 0, isOpen).y;
      if (base > level + STOREY || base + d[1] < level - 0.5) continue;
      out.boxes.push({ x: e.x, y: base + d[1] / 2, z: e.z, hx: d[0] / 2, hy: d[1] / 2, hz: d[2] / 2, yaw: e.rot || 0, id: e.id });
    } else if (e.kind === 'token') {
      if (secret(e)) { out.left.pawns++; continue; }
      if (!Number.isFinite(e.x) || !near(e.x, e.z, from, reach)) continue;
      const y0 = baseUnder(E, e.x, e.z, e.y || 0, isOpen).y; if (Math.abs(y0 - level) > STOREY) continue;
      out.cylinders.push({ x: e.x, z: e.z, y0, y1: y0 + 5.5, r: pawnRadius(e), id: e.id });
    }
  }
  return out;
}
// the floor a point stands on, as the roller's client sees it (for the throw's start and target)
export const floorAt = (entities, x, z, y = 0, isOpen = null) => baseUnder(entities, x, z, y, isOpen).y;
export { roomTop };
