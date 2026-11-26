// THE ELEVATOR (modrooms lane, 2026-11-07; docs/VERTICAL.md "Elevators"). Harry: "oh and elevators!", then the ruling:
// "elevator is maybe just a room and a shaft? or like a shaft and an object, and if a pawn stands on the object (car) and
// you move it up, it takes everything on it up?"
//
//   shaft  ORDINARY SQUARE HOLES (core/holes.js 'hole'), one on each floor above the shaft's bottom floor, over the car's
//          squares: you see down it and fall down it where the car is not (core/height.js baseUnder, core/holes.js).
//   car    an ORDINARY THING (cat 'elevator-car', its y = the floor it is at). Its deck is GROUND: a pawn over the car's
//          squares stands on it wherever the car is, on the bottom floor or up in the shaft (baseUnder, below). It goes up
//          or down by object.move with a new y, like any thing's height change; what stands on it rides along by the
//          global rule "things ride what they stand on" (the `riders` lane, 2026-11-07), not by anything here.
//   doors  ordinary things (cat 'elevator-doors') at the shaft's front on each floor it serves.
// Nothing new is stored: the stops are read off the holes over the car (shaftStops), the deck off the car's box. Pure data
// (no three.js, no DOM): the relay and the browser run the same code.
import { holeCellsAt } from './holes.js';

const CELL = 5, SLIVER = 0.35, STOREY = 10;
export const CAR_CATS = new Set(['elevator-car']);
export const DOOR_CAT = 'elevator-doors';
export const isCar = (e) => e?.kind === 'object' && !e.parent && !e.flat && CAR_CATS.has(e.cat);
// the car's box in plan (it may be turned a quarter): half its width and depth along x and z
function half(e) {
  const c = Math.abs(Math.cos(e.rot || 0)), s = Math.abs(Math.sin(e.rot || 0)), w = e.dims?.[0] || CELL, d = e.dims?.[2] || CELL;
  return [(c * w + s * d) / 2, (s * w + c * d) / 2];
}
export function carContains(e, x, z) { const [hx, hz] = half(e); return Math.abs(x - e.x) <= hx + 0.05 && Math.abs(z - e.z) <= hz + 0.05; }
// the squares the car stands on (more than a sliver of each), [[gx, gz], ...]: the shaft's squares
export function carCells(e) {
  const [hx, hz] = half(e), out = [];
  for (let gx = Math.floor((e.x - hx) / CELL); gx * CELL < e.x + hx; gx++) for (let gz = Math.floor((e.z - hz) / CELL); gz * CELL < e.z + hz; gz++) {
    if (Math.min((gx + 1) * CELL, e.x + hx) - Math.max(gx * CELL, e.x - hx) > SLIVER && Math.min((gz + 1) * CELL, e.z + hz) - Math.max(gz * CELL, e.z - hz) > SLIVER) out.push([gx, gz]);
  }
  return out.length ? out : [[Math.floor(e.x / CELL), Math.floor(e.z / CELL)]];
}
const carFloor = (e) => Math.round(e.y || 0);
// THE DECK UNDER A POINT: the highest car whose box holds (x, z) and whose deck (carDeckY, below) is at or below y (+ half a foot of
// slack, as every floor has). -> { y (the deck), floor (the floor it is at), car } or null. Hot path (a pawn's base is asked every frame): one pass.
export function carDeckAt(entities, x, z, y = 0) {
  let best = null;
  for (const e of Object.values(entities || {})) if (isCar(e) && carDeckY(e) <= y + 0.5 && (!best || carDeckY(e) > best.y) && carContains(e, x, z)) best = { y: carDeckY(e), floor: carFloor(e), car: e.id };
  return best;
}
// THE SHAFT'S STOPS: the floors (ft) the car can be at, lowest first. From the floor it is at, up while the floor above
// has holes over all its squares, and down while the floor it is at has them (then the floor below is the next stop): a
// shaft is a column of holes, and its bottom floor is the first one with no hole.
export function shaftStops(entities, e) {
  const cells = carCells(e), open = (y) => { const H = holeCellsAt(entities, y); return cells.every(([gx, gz]) => H.has(`${gx}:${gz}`)); };
  const y0 = carFloor(e), out = [y0];
  for (let y = y0 + STOREY; open(y) && out.length < 40; y += STOREY) out.push(y);
  for (let y = y0; open(y) && out.length < 40; y -= STOREY) out.unshift(y - STOREY);
  return out;
}
// where the car goes for "up a floor" (dir 1) or "down a floor" (dir -1): the next stop, or null at the end of the shaft
export function carNextStop(entities, e, dir) {
  const S = shaftStops(entities, e), i = S.indexOf(carFloor(e)), j = i + Math.sign(dir);
  return j >= 0 && j < S.length ? S[j] : null;
}
// THE SHAFT TO BUILD for a car: the floors above it that have a room over every one of its squares, one storey after
// another, as far up as the rooms go (a gap ends it); the holes those floors need (the ones not there yet) and the doors
// for every floor of the shaft, its own included (on the car's front, its open side: local +z, facing out of the shaft).
//   rooms(y, gx, gz) -> is there a room's floor at height y over that square (the caller's: core/height.js knows rooms)
// -> { floors: [y...], holes: [{ x, z, y }], doors: [{ x, z, y, rot }] }
export function shaftPlan(entities, e, rooms) {
  const cells = carCells(e), y0 = carFloor(e), floors = [y0], holes = [], doors = [];
  for (let y = y0 + STOREY; floors.length < 40 && cells.every(([gx, gz]) => rooms(y, gx, gz)); y += STOREY) floors.push(y);
  for (const y of floors.slice(1)) { const H = holeCellsAt(entities, y); for (const [gx, gz] of cells) if (!H.has(`${gx}:${gz}`)) holes.push({ x: (gx + 0.5) * CELL, z: (gz + 0.5) * CELL, y }); }
  const fx = Math.sin(e.rot || 0), fz = Math.cos(e.rot || 0), [hx, hz] = half(e), reach = Math.abs(fx) > 0.5 ? hx : hz;
  const have = (y) => Object.values(entities || {}).some(o => o.kind === 'object' && o.cat === DOOR_CAT && Math.round(o.y || 0) === y && Math.hypot(o.x - (e.x + fx * (reach + 0.45)), o.z - (e.z + fz * (reach + 0.45))) < 1.5);
  for (const y of floors) if (!have(y)) doors.push({ x: e.x + fx * (reach + 0.45), z: e.z + fz * (reach + 0.45), y, rot: e.rot || 0 });
  return { floors, holes, doors };
}
// WHERE A RIDER STANDS ON A CAR (for the riders lane's "things ride what they stand on"): the car's DECK, at the floor it
// is at, not the top of its box (the cab's walls are 8 ft tall). A pawn whose base is `on: 'car'` (baseUnder) rides it.
// The cab's floor plate is CAR_DECK of its height (measured on the mesh: every vertical line through its floor meets it at
// 0.124 of the box). The browser's downward look (world.surfaceBelow) finds that floor; core/riders.js topOf asks this, so
// an AI seat's data agrees with what is drawn (the box's own top is the cab's walls).
export const CAR_DECK = 0.124;
export const carDeckY = (e) => Math.round(((e.y || 0) + CAR_DECK * (e.dims?.[1] ?? 4.8)) * 100) / 100;
