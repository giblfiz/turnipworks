// HOLES IN A FLOOR (2026-10-22; Harry: "would be great if we could place holes between floors. Almost like a floor tile,
// but also this could be round pits. Not sure how to place it like an object?"; and "we *have* a few 'pits' and those
// need to have some of that stair behavior"). docs/VERTICAL.md "Holes and pits".
//
// A HOLE IS AN ORDINARY OBJECT; nothing new is stored. What makes it a hole is its catalog id:
//   'hole'        a SQUARE hole: one 5-ft square, laid like a floor tile ({ place: 'tile' }: painted cell by cell, one
//                 per square, moved on the grid). Its x, z are the square's centre.
//   'hole-round'  a ROUND hole: placed like a thing, dims [d, 0.05, d] with d its diameter in feet (5, 10, 15 or 20:
//                 HOLE_SIZES); resized by object.set { dims }. Its centre sits on a square's centre (5, 15) or on a
//                 grid crossing (10, 20), so it cuts whole squares symmetrically.
// Both sit ON the floor they cut: y = that floor's height (a room's floor; 0 = the ground).
// And the library's own PITS (PIT_CATS, below: the pieces that are an opening in the floor) open the floor the same way.
//
// WHAT AN OPENING DOES, all worked out from these objects (never stored):
//   drawn      the floor it is on has no floor tile, no slab and no ground on the squares it covers (core/stairs.js
//              holesAt: the same cut a stair makes in the floor above). A round hole's squares are cut whole and the
//              floor round the circle is drawn again, clipped to it (client/world.js).
//   stood on   a pawn's base never rests on it (core/height.js baseUnder): over a hole the base is on the floor below,
//              so a pawn let go there hangs over the drop and is offered the fall (client/surfaces/falls.js).
//   pointed at the pointer goes through it to the floor below (client/world.js floorPoint, floorStop).
// Pure data, no three.js, no DOM: the relay and the browser run the same code.

const CELL = 5, SLIVER = 0.35; // a round hole cuts a square it covers by more than SLIVER ft (a 10-ft circle on a crossing: its four squares)
export const HOLE_SIZES = [5, 10, 15, 20];
export const HOLE_CATS = { hole: { shape: 'square' }, 'hole-round': { shape: 'round' } };
// THE LIBRARY'S PITS (2026-10-22, Harry: "we *have* a few 'pits' and those need to have some of that stair behavior").
// Measured (engine/test/browser_falls.py PIT; docs/VERTICAL.md "Pits"): NONE of the library's pit pieces goes below the
// floor. Each stands on it with its own bottom a few inches up (a spiked floor, a painted black drop), and reads as a pit
// from above. So:
//   to: 'below'   a THROUGH pit: the floor under its opening is cut (like a hole) and its own black bottom is cut out
//                 of the mesh (client/holes.js clipShapes), so you see, and fall, to the floor below. Over nothing (the
//                 ground with no cellar) it falls INTO it, as a 'bottom' pit.
//   to: 'bottom'  a pit with its own bottom: a pawn dropped on it is offered "Fall into the spike pit?", and taking it puts
//                 the pawn in it (its middle, at its bottom) and says so in the chat.
//   open          the share of its box that is the opening (measured off the mesh: the frame or kerb round it is not)
//   bottom        how far above the floor its bottom is, ft; name: what the chat calls it
// Not pits: the oubliette hatch (a closed grate), the floor trapdoor (closed; a wall-kit piece with no open state), the
// well. Asked for but not in the library: floor-broken-hole, sinkhole, rural-trap-pit-covered, chasm-edge, floor-pit-edge,
// sewer-ladder-manhole, stair-rope-trapdoor.
export const PIT_CATS = {
  'mine-shaft-collar': { to: 'below', open: 0.66, shape: 'square', bottom: 0, name: 'the mine shaft' },
  'trap-spike-pit': { to: 'bottom', open: 0.62, shape: 'square', bottom: 0.25, name: 'the spike pit' },
  'pit-open': { to: 'bottom', open: 0.8, shape: 'square', bottom: 0, name: 'the pit' },
  'chasm-strip': { to: 'bottom', open: 0.8, shape: 'square', bottom: 0, name: 'the chasm' },
  'chasm-strip-wide': { to: 'bottom', open: 0.8, shape: 'square', bottom: 0, name: 'the chasm' },
};
export const isHoleCat = (cat) => !!HOLE_CATS[cat];
export const isHole = (e) => e?.kind === 'object' && !e.parent && !!HOLE_CATS[e.cat];
export const isPit = (e) => e?.kind === 'object' && !e.parent && !!PIT_CATS[e.cat];
export const pitOf = (e) => (isPit(e) && PIT_CATS[e.cat]) || null;
export const isOpening = (e) => isHole(e) || pitOf(e)?.to === 'below'; // what cuts the floor it is on
const snapSize = (d) => HOLE_SIZES.reduce((b, s) => Math.abs(s - d) < Math.abs(b - d) ? s : b, HOLE_SIZES[0]);
export const holeSize = (e) => e.cat === 'hole' ? CELL : snapSize(e.dims?.[0] || 10); // its diameter (round) or side (square), ft
export const holeShape = (e) => isPit(e) ? (PIT_CATS[e.cat].shape || 'square') : HOLE_CATS[e.cat]?.shape || 'square';
export const holeFloor = (e) => Math.round(e.y || 0);
// THE PIT A PAWN STANDING ON THE FLOOR AT `by` IS IN, at (x, z): a pit of that floor whose opening holds the point, or null
export function pitAt(entities, x, z, by) {
  for (const e of Object.values(entities || {})) if (isPit(e) && Math.abs(holeFloor(e) - by) < 0.6 && holeContains(e, x, z)) return e;
  return null;
} // the floor it is on (a floor is a whole number of feet)
// where a round hole of diameter d centred near (x, z) sits: a square's centre (an odd number of squares across) or a crossing
export function roundCentre(x, z, d) {
  const n = Math.round(snapSize(d) / CELL), at = (v) => n % 2 ? (Math.floor(v / CELL) + 0.5) * CELL : Math.round(v / CELL) * CELL;
  return [at(x), at(z)];
}
// the opening's shape in plan: { shape, x, z, r } (round: centre and radius) or { shape: 'square', x0, z0, x1, z1 }
export function holeShapeOf(e) {
  if (isPit(e)) {
    const P = PIT_CATS[e.cat], w = (e.dims?.[0] || CELL) * (P.open ?? 1), d = (e.dims?.[2] || CELL) * (P.open ?? 1);
    if ((P.shape || 'square') === 'round') return { shape: 'round', x: e.x, z: e.z, r: Math.min(w, d) / 2 };
    const c = Math.abs(Math.cos(e.rot || 0)), s = Math.abs(Math.sin(e.rot || 0)), hx = (c * w + s * d) / 2, hz = (s * w + c * d) / 2;
    return { shape: 'square', x0: e.x - hx, z0: e.z - hz, x1: e.x + hx, z1: e.z + hz };
  }
  if (holeShape(e) === 'round') return { shape: 'round', x: e.x, z: e.z, r: holeSize(e) / 2 };
  const gx = Math.floor(e.x / CELL + 1e-6), gz = Math.floor(e.z / CELL + 1e-6);
  return { shape: 'square', x0: gx * CELL, z0: gz * CELL, x1: (gx + 1) * CELL, z1: (gz + 1) * CELL };
}
// is (x, z) in the opening? (a round one: inside its circle; the corners of its squares are floor again)
export function holeContains(e, x, z) {
  const S = holeShapeOf(e);
  return S.shape === 'round' ? Math.hypot(x - S.x, z - S.z) < S.r : x >= S.x0 && x < S.x1 && z >= S.z0 && z < S.z1;
}
// how much of square (gx, gz) the opening covers, in ft along each side (0 = none): a square counts when more than SLIVER
function covers(S, gx, gz) {
  const x0 = gx * CELL, z0 = gz * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
  if (S.shape === 'square') return Math.min(x1, S.x1) - Math.max(x0, S.x0) > SLIVER && Math.min(z1, S.z1) - Math.max(z0, S.z0) > SLIVER;
  const nx = Math.max(x0, Math.min(S.x, x1)), nz = Math.max(z0, Math.min(S.z, z1)); // the square's point nearest the centre
  return Math.hypot(nx - S.x, nz - S.z) < S.r - SLIVER;
}
// the squares it cuts: [[gx, gz], ...]
export function holeCells(e) {
  const S = holeShapeOf(e), out = [];
  const [a, b, c, d] = S.shape === 'round' ? [S.x - S.r, S.z - S.r, S.x + S.r, S.z + S.r] : [S.x0, S.z0, S.x1, S.z1];
  for (let gx = Math.floor(a / CELL); gx * CELL < c; gx++) for (let gz = Math.floor(b / CELL); gz * CELL < d; gz++) if (covers(S, gx, gz)) out.push([gx, gz]);
  return out;
}
export const openingsOf = (entities) => Object.values(entities || {}).filter(isOpening);
// the squares of the floor at height y that openings cut: Set of 'gx:gz' (core/stairs.js holesAt adds them to a stair's)
export function holeCellsAt(entities, y) {
  const out = new Set();
  for (const e of openingsOf(entities)) if (holeFloor(e) === y) for (const [gx, gz] of holeCells(e)) out.add(`${gx}:${gz}`);
  return out;
}
// the round openings of the floor at height y, for drawing the floor again round the circle: [{ x, z, r, cells }]
export function roundHolesAt(entities, y) {
  return openingsOf(entities).filter(e => holeFloor(e) === y && holeShapeOf(e).shape === 'round').map(e => { const S = holeShapeOf(e); return { id: e.id, x: S.x, z: S.z, r: S.r, cells: holeCells(e) }; });
}
// is there no floor at (x, z) at height y because an opening is there?
export function openAt(entities, x, z, y) {
  for (const e of openingsOf(entities)) if (holeFloor(e) === y && holeContains(e, x, z)) return e;
  return null;
}
// a cheap index for the hot paths (a pawn's base is asked every frame): openings by floor height, or null when there are none
const IDX = new WeakMap();
export function openingIndex(entities) {
  if (!entities) return null;
  let v = IDX.get(entities); if (v !== undefined) return v;
  const list = openingsOf(entities); v = null;
  if (list.length) { v = new Map(); for (const e of list) { const y = holeFloor(e); (v.get(y) || v.set(y, []).get(y)).push(e); } }
  IDX.set(entities, v); return v;
}
export const openAtFast = (entities, x, z, y) => { const I = openingIndex(entities), L = I && I.get(y); return !!L && L.some(e => holeContains(e, x, z)); };
// why a hole cannot be put here, or null (a seat is told rather than left wondering): object.place / object.set args
export function holeProblem(a) {
  if (!HOLE_CATS[a.cat]) return null;
  if (a.cat === 'hole-round' && a.dims && !HOLE_SIZES.includes(Math.round(a.dims[0]))) return `a round hole is ${HOLE_SIZES.join(', ')} ft across`;
  return null;
}
