// node test/elevator.test.mjs : THE ELEVATOR (modrooms lane, 2026-11-07; core/elevator.js, docs/VERTICAL.md "Elevators").
// Harry: "a shaft and an object, and if a pawn stands on the object (car) and you move it up, it takes everything on it up".
//   shaft    Build the shaft over a car in a two-storey office: a hole upstairs over its square, doors on both floors;
//            built again, nothing more; the stops are 0 and 10
//   deck     the car's floor is ground (core/height.js baseUnder `on: 'car'`), at the bottom and up in the shaft; with
//            the car gone from a floor, that floor's shaft is open (over the drop)
//   riders   the data's answer (an AI seat, core/riders.js): a pawn standing on the car's FLOOR (inside its cab, not on its
//            8-ft walls) rides it; a crate put on it rides by its parent; the relay's carry check passes them; moving the
//            car up a floor with them (applyArea object.move + carry) brings all of them to the upper floor, standing on it;
//            a pawn beside the car stays
import * as EL from '../core/elevator.js';
import * as HT from '../core/height.js';
import * as RD from '../core/riders.js';
import { applyArea } from '../core/commands.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } else console.log('ok  ', name); };
const room = (id, y) => ({ id, kind: 'room', recipe: { type: 'mod-office', x: 40, z: 0, w: 6, d: 5, ...(y && { y }) } });
const car = { id: 'car', kind: 'object', cat: 'elevator-car', x: 202.5, y: 0, z: 2.5, rot: 0, dims: [5, 4.81, 4.27], room: 'o0' };
let E = { o0: room('o0'), o1: room('o1', 10), car };
const rooms = (y, gx, gz) => Object.values(E).some(e => e.kind === 'room' && HT.roomY(e.recipe) === y && gx >= 40 && gx < 46 && gz >= 0 && gz < 5);
// ---- shaft
const P = EL.shaftPlan(E, car, rooms);
ok('the shaft runs up to the office upstairs', JSON.stringify(P.floors) === '[0,10]', P.floors);
ok('one hole upstairs over the car\'s square', P.holes.length === 1 && P.holes[0].x === 202.5 && P.holes[0].z === 2.5 && P.holes[0].y === 10, P.holes);
ok('doors on both floors at the car\'s front', P.doors.length === 2 && P.doors.every(d => Math.abs(d.z - (2.5 + 2.135 + 0.45)) < 0.01), P.doors);
E = { ...E, h1: { id: 'h1', kind: 'object', cat: 'hole', place: 'tile', flat: true, x: 202.5, y: 10, z: 2.5, rot: 0, dims: [5, 0.05, 5] }, ...Object.fromEntries(P.doors.map((d, i) => [`d${i}`, { id: `d${i}`, kind: 'object', cat: EL.DOOR_CAT, ...d, dims: [5, 8, 1] }])) };
ok('built again, there is nothing more to build', (() => { const Q = EL.shaftPlan(E, E.car, rooms); return !Q.holes.length && !Q.doors.length; })());
ok('its stops are 0 and 10; the next one up is 10, none down', JSON.stringify(EL.shaftStops(E, E.car)) === '[0,10]' && EL.carNextStop(E, E.car, 1) === 10 && EL.carNextStop(E, E.car, -1) === null);
// ---- deck
const deck = EL.carDeckY(E.car);
ok('the deck is the cab\'s floor, under a foot up (not the top of its walls)', deck > 0.3 && deck < 1 && deck < RD.topOf({ ...E.car, cat: 'crate' }), deck);
const b0 = HT.baseUnder(E, 202.5, 2.5, deck);
ok('a pawn over the car stands on its deck', b0.on === 'car' && b0.car === 'car' && b0.y === deck && b0.room === 'o0', b0);
const up0 = HT.baseUnder(E, 202.5, 2.5, 10.5);
ok('upstairs, with the car down, the shaft is open: the base is on the car below', up0.y === deck && up0.on === 'car', up0);
// ---- riders (the data's answer, as an AI seat's)
E = { ...E, rider: { id: 'rider', kind: 'token', name: 'Rider', x: 202.5, z: 2.5, y: deck }, stay: { id: 'stay', kind: 'token', name: 'Stay', x: 208.5, z: 8.5, y: 0 },
  crate: { id: 'crate', kind: 'object', cat: 'cardboard-boxes', x: 203.4, y: deck, z: 3, rot: 0, dims: [1.6, 1.4, 1.3], parent: 'car' } };
const R = RD.ridersOf(E, 'car');
ok('what rides the car: the crate (its parent) and the pawn on its floor, not the pawn beside it', R.includes('crate') && R.includes('rider') && !R.includes('stay'), R);
ok('the relay\'s carry check passes them', !RD.carryProblem(E, 'car', R), RD.carryProblem(E, 'car', R));
const area = { entities: E }, moved = applyArea(area, 'object.move', { id: 'car', x: 202.5, z: 2.5, y: 10, carry: R }) || area;
const M = moved.entities || moved;
ok('Up a floor: the car is at 10', (M.car.y || 0) === 10, M.car.y);
ok('the pawn and the crate rode up with it, standing on its floor', Math.abs(M.rider.y - deck - 10) < 0.01 && Math.abs(M.crate.y - deck - 10) < 0.01, [M.rider.y, M.crate.y]);
ok('the pawn beside it stayed', (M.stay.y || 0) === 0);
const b1 = HT.baseUnder(M, 202.5, 2.5, M.rider.y);
ok('upstairs the pawn stands on the car, in the office upstairs', b1.on === 'car' && b1.room === 'o1' && Math.abs(b1.y - deck - 10) < 0.01, b1);
console.log(`\nelevator: ${n - fails}/${n} passed`); process.exit(fails ? 1 : 0);
