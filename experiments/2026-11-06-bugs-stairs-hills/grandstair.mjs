// The Intesst grand stair (engine/test/levels.test.mjs's hand-built copy): which rooms are over each of its squares,
// and what stairStatus says about it.   node experiments/2026-11-06-bugs-stairs-hills/grandstair.mjs
const ENG = new URL('../../engine/', import.meta.url).href;
const HT = await import(ENG + 'core/height.js'), S = await import(ENG + 'core/stairs.js');
const room = (id, type, x, z, w, d, y, building) => ({ id, kind: 'room', order: 1, recipe: { type, x, z, w, d, seed: 1, wallSeed: 2, ...(y && { y }) }, building });
const ents = (...es) => Object.fromEntries(es.map(e => [e.id, e]));
const E = ents(
  room('room_hill', 'hill', 7, -5, 16, 16, 10, null),
  room('room_mansion', 'mansion-hall', 13, 10, 2, 15, 0, 'bld_1'), room('room_great', 'great-hall', 15, 14, 6, 11, 0, 'bld_1'),
  room('room_cath', 'cathedral', 9, -5, 12, 13, 10, 'bld_1'), room('room_hallway', 'hallway', 13, 8, 2, 3, 10, 'bld_1'), room('room_vestry', 'temple-vestry', 17, 8, 4, 3, 10, 'bld_1'),
  room('room_upper', 'mansion-hall', 13, 12, 2, 1, 10, 'bld_2'),
  { id: 'obj_grand', kind: 'object', cat: 'stair-grand', place: 'kit', layer: 'furnish', x: 70, y: 0, z: 57.5, rot: 0, dims: [10, 13.17, 15], room: 'room_mansion' });
if (process.argv[2] === 'no-upper') delete E.room_upper; // (without the second building's upper hall over the flight's foot)
const s = E.obj_grand;
console.log('top', S.stairTop(s), 'status', JSON.stringify(S.stairStatus(E, s)));
console.log('ends', JSON.stringify(S.stairEnds(s, E)));
const inR = (e, [gx, gz]) => gx >= e.recipe.x && gx < e.recipe.x + e.recipe.w && gz >= e.recipe.z && gz < e.recipe.z + e.recipe.d;
for (const c of S.stairCells(s)) console.log(JSON.stringify(c), 'at 10:', Object.values(E).filter(e => e.kind === 'room' && HT.roomY(e.recipe) === 10 && inR(e, c)).map(e => e.id).join(','));
