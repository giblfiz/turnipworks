// A BUILDING PLAN INTO COMMANDS (docs/BUILDINGS.md). The tuner's js/buildings.js makes a plan (rooms, doors, stairs) from
// a footprint, a type and a seed; this turns one into the ops of ONE batch: every room, furnished, its doors as the plan
// says; the stairs; and the building's own recipe (`gen`), so it can be made again with another seed or storey count.
// Pure: the browser and the tests run the same code; the relay only checks and applies the ops.
//
// The order matters and is the point (Harry: "place the stair core first"): every room and every stair is known before
// any room is furnished, so furniture keeps off the stairs, their holes and landings, and off every door.
import { traceOutline, overlap } from './footprint.js';
import { fnv1a } from './hash.js';
import { roomY, roomTop, spansOverlap } from './height.js';

// gen: what a generated building remembers (building.gen): enough to make it again
export const genOf = (plan, extra = {}) => ({ v: 1, code: plan.code, x: plan.rect.x, z: plan.rect.z, w: plan.rect.w, d: plan.rect.d, seed: plan.seed, storeys: plan.storeys, front: plan.front,
  ...(extra.dials && Object.keys(extra.dials).length && { dials: extra.dials }), ...(extra.outbuildings === false && { outbuildings: false }), ...(plan.flavor && { flavor: plan.flavor }), ...(extra.cellar === false && { cellar: false }) }); // cellar: false (2026-11-12) = made without its cellar (a new building's default); absent = as before, with it

//   plan      from buildings.generate()
//   roomgen   core/roomgen.js makeRoomGen(...)        entities  the area's entities now       order  the area's order now
//   building  the building's id (new, or the one being replaced)      name   its label
//   replace   ids of the rooms this building had (they are deleted first, in the same batch)
//   y0        the height of the plan's ground floor (feet)
// -> { ops, rooms: [ids], stairs: [ids], left: [what was left out and why], fails: [rooms whose key piece did not fit] }
export function planOps(plan, { roomgen, entities, order, building, name, newId, replace = [], y0 = 0, gen = null, flavor = null }) {
  const E = { ...entities }, ops = [], left = [], fails = [];
  for (const id of replace) { if (!E[id]) continue; ops.push({ type: 'room.delete', args: { id } }); for (const o of Object.values(E)) if (o.kind === 'object' && o.room === id) delete E[o.id]; delete E[id]; }
  if (replace.length && !Object.values(E).some(e => e.kind === 'room' && e.building === building)) delete E[building];
  E[building] = { ...(E[building] || { id: building, kind: 'building' }), gen: gen || {}, ...((flavor || plan.flavor) && { flavor: flavor || plan.flavor }) };
  // rooms outside the dragged rectangle (yard, stable, court) are left out where something already stands
  const others = Object.values(E).filter(e => e.kind === 'room');
  const taken = (r) => others.some(o => spansOverlap(y0 + r.y, y0 + r.y + 10, roomY(o.recipe), roomTop(E, o)) && overlap(o.recipe, recipeShape(r)));
  const skip = new Set();
  for (const r of plan.rooms) if (taken(r)) { if (!r.outside) return { ops: [], rooms: [], stairs: [], left: [`${r.type}: the ground is taken`], fails, blocked: true }; skip.add(r.id); left.push(`${r.type}: no free ground outside the footprint`); }
  const rooms = plan.rooms.filter(r => !skip.has(r.id)).sort((a, b) => (a.level < 0) - (b.level < 0) || Math.abs(a.level) - Math.abs(b.level)); // ground first, then up; cellars after
  const idOf = new Map(rooms.map(r => [r.id, newId('room')]));
  const rel = (r, e) => [e[0], e[1] - r.x, e[2] - r.z, ...(e.length > 3 ? [e[3]] : [])];
  const stubs = rooms.map((r, i) => {
    const seed = fnv1a(`${plan.seed}|${r.id}|${r.type}`) % 1000000, y = y0 + r.y;
    const outline = r.shaped ? traceOutline(r.cells.map(([gx, gz]) => [gx - r.x, gz - r.z])) : undefined;
    const links = Object.fromEntries(Object.entries(r.links).filter(([id]) => idOf.has(id)).map(([id, e]) => [idOf.get(id), rel(r, e)]));
    const pl = r.free && r.role !== 'yard' ? undefined : { b: building, links, ...(r.entry && { entry: rel(r, r.entry) }), ...(r.depth != null && { depth: r.depth }), role: r.role, ...(r.priv && { priv: true }), ...(flavor && { flavor }) };
    const args = { id: idOf.get(r.id), building, ...(r.name && { name: r.name }), type: r.type, x: r.x, z: r.z, w: r.w, d: r.d, ...(y && { y }), seed, ...(outline && { outline }), ...(pl && { plan: pl }) };
    return { r, args, ord: order + 1 + i };
  });
  for (const s of stubs) if (s.r.shaped && !s.args.outline) return { ops: [], rooms: [], stairs: [], left: [`${s.r.type}: not one simple shape`], fails, blocked: true };
  for (const s of stubs) E[s.args.id] = { id: s.args.id, kind: 'room', order: s.ord, building, recipe: { ...s.args, wallSeed: s.args.seed * 7 + 1, wallFamily: 'auto', floor: 'auto' } };
  // the stairs, before any furniture: each an object of its LOWER room, in the stair piece of that room's walls
  const fam = new Map(roomgen.roomsOf(E).map(r => [r.id, r.family]));
  const stairOps = [];
  for (const s of plan.stairs) {
    const lower = idOf.get(s.from), upper = idOf.get(s.to); if (!lower || !upper) { left.push('a stair: one of its rooms was left out'); continue; }
    // one flight through core/stairs.js stairCore (the `stairs` branch's interface for a generator, 2026-10-11): the
    // square at the low end of the flight and the way it climbs; it returns an ordinary stair piece of the library
    const id = newId('obj'), low = s.cells.find(c => Math.abs(c[0] - s.foot[0]) + Math.abs(c[1] - s.foot[1]) === 1) || s.cells[0], q = ((Math.round(s.rot / (Math.PI / 2)) % 4) + 4) % 4;
    const C = roomgen.stairCore({ at: { gx: low[0], gz: low[1], q }, levels: [y0 + s.y, y0 + s.y + s.rise], kind: s.kind, family: fam.get(lower) || '' });
    // (not pinned: a pinned stair is handed to the layout as its box only; unpinned, core/stairs.js stairBlocks keeps its
    // squares AND its foot clear, and it still stays through a re-roll of its room)
    const { pinned: _pin, ...piece } = C.stairs[0], a = { id, ...piece, room: lower };
    stairOps.push({ type: 'object.place', args: a }); E[id] = { kind: 'object', ...a };
  }
  // THE LIFT (plan.lifts, modhalls lane 2026-11-07; core/elevator.js): the car on the lowest floor it serves, a square hole
  // over it on every floor above (the shaft: ordinary holes, so the car's stops are read off them), the landing doors at its
  // front on every floor, all of it before the furniture: the shaft square and the square in front of it are kept clear in
  // every room they are in (handed to the layout as fixed blocks, as a stair's are)
  const liftOps = [], pins = new Map(), pin = (id, b) => { if (id) (pins.get(id) || pins.set(id, []).get(id)).push(b); };
  for (const l of plan.lifts || []) {
    const ids = l.rooms.map(id => idOf.get(id)), fids = (l.frontRooms || l.rooms).map(id => idOf.get(id));
    const car = roomgen.sizeOf('elevator-car', null), door = roomgen.sizeOf('elevator-doors', null);
    if (!car || ids.some(x => !x)) { left.push(car ? 'the lift: one of its rooms was left out' : 'the lift: no elevator car in the library'); continue; }
    const C = 5, [gx, gz] = l.cell, dx = l.front[0] - gx, dz = l.front[1] - gz, rot = Math.atan2(dx, dz), cx = (gx + 0.5) * C, cz = (gz + 0.5) * C;
    const carId = newId('obj'), a = { id: carId, name: 'elevator car', cat: 'elevator-car', sku: car.sku, url: car.url, place: car.place || 'floor', x: cx, y: y0, z: cz, rot, yaw: car.yaw || 0, ...(car.s && { s: car.s }), dims: car.dims, room: ids[0] };
    liftOps.push({ type: 'object.place', args: a }); E[carId] = { kind: 'object', ...a };
    // (the doors' mesh is a deep frame: laid as a 1-ft panel at the shaft's front, squashed front to back only, as client/elevator.js does)
    const k = door && door.dims[2] > 1.2 ? 1 / door.dims[2] : 1, dd = door && [door.dims[0], door.dims[1], door.dims[2] * k], ds = door?.s && [door.s[0], door.s[1], door.s[2] * k], reach = car.dims[2] / 2 + 0.45;
    l.levels.forEach((Lv, i) => {
      const y = y0 + Lv * 10;
      if (i > 0) { const h = { id: newId('obj'), name: 'elevator shaft', cat: 'hole', flat: true, place: 'tile', layer: 'floor', x: cx, y, z: cz, rot: 0, yaw: 0, dims: [5, 0.05, 5], room: ids[i] }; liftOps.push({ type: 'object.place', args: h }); E[h.id] = { kind: 'object', ...h }; }
      if (door) { const d = { id: newId('obj'), name: 'elevator doors', cat: 'elevator-doors', sku: door.sku, url: door.url, place: door.place || 'wall', x: cx + dx * reach, y, z: cz + dz * reach, rot, yaw: door.yaw || 0, ...(ds && { s: ds }), dims: dd, room: fids[i] || ids[i] }; liftOps.push({ type: 'object.place', args: d }); E[d.id] = { kind: 'object', ...d }; }
      const blk = (id, x, z, h, w, d) => ({ id, cat: 'elevator-car', sku: null, flat: false, place: 'floor', layer: 'furnish', x, y, z, rot, dims: [w, h, d], pinned: true, stairBlock: true });
      // the shaft; and a strip 1.5 ft deep before its doors (the doors' own panel and a step clear of it), NOT the whole square
      // in front: in a corridor two squares wide that square is the way past the lift
      pin(ids[i], blk(`lift:${i}`, cx, cz, 8, C - 0.4, C - 0.4)); pin(fids[i] || ids[i], blk(`lift:${i}:front`, cx + dx * (C / 2 + 0.75), cz + dz * (C / 2 + 0.75), 3, C - 0.4, 1.5));
    });
  }
  // furnish every room against the whole building
  stubs.forEach((s, i) => {
    const L = roomgen.solve(E, { ...s.args }, s.ord, pins.get(s.args.id) || []);
    if (L.fail) fails.push({ id: s.args.id, type: s.r.type, w: s.r.w, d: s.r.d, why: L.fail });
    ops.push({ type: 'room.spawn', args: { ...s.args, ...(i === 0 && name && { buildingName: name }), engine: 'v2', engineVersion: roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } });
  });
  ops.push(...stairOps, ...liftOps);
  if ((gen || flavor || plan.flavor) && stubs.length) ops.push({ type: 'building.set', args: { id: building, gen: { ...(gen || {}), ...((flavor || plan.flavor) && { flavor: flavor || plan.flavor }) } } });
  return { ops, rooms: stubs.map(s => s.args.id), stairs: stairOps.map(o => o.args.id), lifts: liftOps.filter(o => o.args.cat === 'elevator-car').map(o => o.args.id), left, fails, idOf };
}
const recipeShape = (r) => ({ x: r.x, z: r.z, w: r.w, d: r.d, ...(r.shaped && { outline: traceOutline(r.cells.map(([gx, gz]) => [gx - r.x, gz - r.z])) || undefined }) });
// the rooms a generated building has now (for a re-roll or a change of storeys)
export const roomsOfBuilding = (entities, id) => Object.values(entities).filter(e => e.kind === 'room' && e.building === id).map(e => e.id);
