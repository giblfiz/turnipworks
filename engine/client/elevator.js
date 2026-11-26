// THE ELEVATOR in the client (core/elevator.js holds the rules; docs/VERTICAL.md "Elevators"). Modrooms lane, 2026-11-07.
// A car put down from the library (Build ▸ Modern ▸ City: "elevator car") is an ordinary thing. Its commands (client/
// commands.js, the ring's "Elevator" list):
//   Build the shaft   the holes over the car on every floor above it that has a room there, one storey after another,
//                     and the landing doors at the car's front on each floor: ONE command (one undo)
//   Up a floor / Down a floor   object.move with the next stop's height (core/elevator.js carNextStop). What stands on
//                     the car rides along by the global rule "things ride what they stand on" (core/riders.js: app.liftTo's carry).
import * as EL from '../core/elevator.js';
import * as HT from '../core/height.js';
import { newId } from '../core/ids.js';
import * as FP from '../core/footprint.js';

export function installElevator(app, { roomgen, toast }) {
  const ents = () => app.entities();
  app.EL = EL;
  app.elevatorCars = (list = app.selected()) => list.filter(EL.isCar);
  app.elevatorNext = (car, dir) => EL.carNextStop(ents(), car, dir);
  app.elevatorMove = (car, dir) => {
    const y = EL.carNextStop(ents(), car, dir);
    if (y == null) { toast(dir > 0 ? 'The shaft goes no higher (build the shaft, or a room above it)' : 'The car is at the bottom of its shaft', true); return null; }
    // app.liftTo (the ring's raise / lower, client/main.js): the riders lane's carry list goes inside the car's own
    // object.move (core/riders.js), so what stands on its floor rides it in one entry, one undo
    return app.liftTo ? app.liftTo(car, y) : app.dispatch('object.move', { id: car.id, x: car.x, z: car.z, y, rot: car.rot || 0 });
  };
  // the commands that build a car's shaft: holes on the floors above, doors on every floor (none twice)
  app.elevatorShaftOps = (car) => {
    const E = ents(), rooms = (y, gx, gz) => Object.values(E).some(e => e.kind === 'room' && e.recipe && HT.roomY(e.recipe) === y && !HT.isTerrain(e.recipe) && FP.hasCell(e.recipe, gx, gz));
    const P = EL.shaftPlan(E, car, rooms), door = roomgen.sizeOf(EL.DOOR_CAT, null), ops = [];
    for (const h of P.holes) ops.push({ type: 'object.place', args: { id: newId('obj'), name: 'elevator shaft', cat: 'hole', flat: true, place: 'tile', layer: 'floor', x: h.x, y: h.y, z: h.z, rot: 0, yaw: 0, dims: [5, 0.05, 5], room: app.roomAt(h.x, h.z, h.y)?.id || undefined } });
    // (the doors' mesh is a deep frame: laid as a 1-ft-deep panel at the shaft's front, squashed front to back only)
    const k = door && door.dims[2] > 1.2 ? 1 / door.dims[2] : 1, dd = door && [door.dims[0], door.dims[1], door.dims[2] * k], ds = door?.s && [door.s[0], door.s[1], door.s[2] * k];
    if (door) for (const d of P.doors) ops.push({ type: 'object.place', args: { id: newId('obj'), name: 'elevator doors', cat: EL.DOOR_CAT, sku: door.sku, url: door.url, place: door.place || 'wall', x: d.x, y: d.y, z: d.z, rot: d.rot, yaw: door.yaw || 0, ...(ds && { s: ds }), dims: dd, room: app.roomAt(d.x, d.z, d.y)?.id || undefined } });
    return { ops, plan: P };
  };
  app.elevatorShaft = (car) => {
    const { ops, plan } = app.elevatorShaftOps(car);
    if (!ops.length) { toast(plan.floors.length > 1 ? 'The shaft is built' : 'No room above the car to run a shaft up to: build the floors above first', plan.floors.length < 2); return null; }
    const cid = app.batch(ops);
    if (cid) toast(`Shaft: ${plan.floors.length} floors (${plan.holes.length} holes, ${plan.doors.length} doors)`);
    return cid;
  };
}
