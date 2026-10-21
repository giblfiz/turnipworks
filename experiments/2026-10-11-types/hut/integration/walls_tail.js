// >>> type:hut
// ---- farmstead (2026-10-11): sixteen rooms, the humble end of the world. Walls: wattle-daub (its own family, hut-01) for
// the house, half-timber for the better farmhouse; rough-timber (and its log-cabin share) for the outbuildings; fieldstone for
// what is dug in or kept cool. Each room type rolls among them by its wall seed (FAMILY_ODDS). Doors are plank doors;
// the hay barn's is the wide barn door. Five rooms are OUTDOOR (no walls: their fence is furniture laid by the program).
// Graph roles for a building layout: the cottage and the farmhouse kitchen are HUBS (everything opens off them); the
// cross-passage is the PASSAGE (house at one end, byre at the other: a longhouse); the rest are terminals; the byre and
// the hay barn are 'mixed' (beasts and carts go through, hands stop). `uses` here is documentation for the layout
// generator (which rooms want to touch which): HUT_USES, exported. ----
Object.assign(ROLES, {
  'hut-cottage': { role: 'hub', who: 'the family' },
  'hut-kitchen': { role: 'hub', who: 'the family' },
  'hut-bedroom': { role: 'terminal', who: 'the family' },
  'hut-loft': { role: 'terminal', who: 'the children, the hired hand' },
  'hut-passage': { role: 'passage', who: 'the family and the beasts' },
  'hut-cellar': { role: 'terminal', who: 'the family' },
  'hut-byre': { role: 'mixed', who: 'cattle: passage; the milker: terminal' },
  'hut-coop': { role: 'terminal', who: 'hens' },
  'hut-barn': { role: 'mixed', who: 'carts: passage; hands: terminal' },
  'hut-granary': { role: 'terminal', who: 'the farmer' },
  'hut-dairy': { role: 'terminal', who: 'the dairymaid' },
  'hut-pigsty': { role: 'outdoor', who: 'pigs' },
  'hut-garden': { role: 'outdoor', who: 'the family' },
  'hut-field': { role: 'outdoor', who: 'the plough team' },
  'hut-orchard': { role: 'outdoor', who: 'the family' },
  'hut-farmyard': { role: 'outdoor', who: 'everyone: the family, carts, beasts' },
});
export const HUT_ROOMS = ['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-pigsty', 'hut-barn', 'hut-granary', 'hut-dairy', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard'];
// what each room wants to touch (a layout generator's adjacency wishes) and where it stands: `apart` = an outbuilding or
// a plot that sits in the yard, never packed inside the house; `level` = below (-1) or above (+1) the house floor
export const HUT_USES = {
  'hut-cottage': { uses: ['hut-farmyard', 'hut-garden', 'hut-byre', 'hut-cellar'] },
  'hut-kitchen': { uses: ['hut-bedroom', 'hut-passage', 'hut-dairy', 'hut-cellar', 'hut-loft', 'hut-farmyard', 'hut-garden'] },
  'hut-bedroom': { uses: ['hut-kitchen'] },
  'hut-loft': { uses: ['hut-kitchen', 'hut-cottage'], level: 1 },
  'hut-passage': { uses: ['hut-kitchen', 'hut-byre', 'hut-farmyard'] },
  'hut-cellar': { uses: ['hut-kitchen', 'hut-cottage'], level: -1 },
  'hut-byre': { uses: ['hut-passage', 'hut-farmyard', 'hut-barn'], apart: 'attached or apart' },
  'hut-coop': { uses: ['hut-farmyard', 'hut-garden'], apart: true },
  'hut-pigsty': { uses: ['hut-farmyard'], apart: true },
  'hut-barn': { uses: ['hut-farmyard', 'hut-field', 'hut-granary'], apart: true },
  'hut-granary': { uses: ['hut-barn', 'hut-farmyard'], apart: true },
  'hut-dairy': { uses: ['hut-kitchen', 'hut-byre'], apart: 'attached or apart' },
  'hut-garden': { uses: ['hut-kitchen', 'hut-cottage'], apart: true },
  'hut-field': { uses: ['hut-barn', 'hut-farmyard'], apart: true },
  'hut-orchard': { uses: ['hut-garden', 'hut-farmyard'], apart: true },
  'hut-farmyard': { uses: ['hut-cottage', 'hut-kitchen', 'hut-byre', 'hut-barn'], apart: true },
};
NO_WINDOWS.add('hut-cellar'); NO_WINDOWS.add('hut-passage'); // (a cross-passage is lit by its two doors: with windows down both long walls it read as a guard corridor)
// the farm's own wall family (hut-01, 2026-10-12): wattle-daub = cracked lime-washed daub between a sill beam and a wall plate,
// no frame showing (half-timber is the better house). It borrows half-timber's corner posts, floors and family-keyed props.
WALL_FAMILIES.push('wattle-daub');
FAMILY_FALLBACK['wattle-daub'] = 'half-timber';
TO_KIT['wattle-daub'] = 'kit-half-timber';
Object.assign(FAMILY_ODDS, {
  'hut-cottage': { 'wattle-daub': 0.55, 'rough-timber': 0.25, fieldstone: 0.2 },
  'hut-kitchen': { 'wattle-daub': 0.4, 'half-timber': 0.25, fieldstone: 0.2, 'rough-timber': 0.15 },
  'hut-bedroom': { 'wattle-daub': 0.5, 'half-timber': 0.3, 'rough-timber': 0.2 },
  'hut-passage': { 'wattle-daub': 0.5, 'rough-timber': 0.3, fieldstone: 0.2 },
  'hut-byre': { 'rough-timber': 0.6, fieldstone: 0.4 },
  'hut-granary': { 'rough-timber': 0.7, fieldstone: 0.3 },
  'hut-dairy': { fieldstone: 0.7, 'wattle-daub': 0.3 },
});
SPANS['hut-barn'] = [2, 3]; // the cart door: 10 or 15 ft
{ const plank = { main: 'door-plank', inner: 'door-plank' };
  for (const k of HUT_ROOMS) if (!isOutdoor(k)) DOORS[k] = plank; // (an outdoor room has no doors of its own: its neighbours' doors keep their own rule)
  DOORS['hut-barn'] = { main: 'door-plank', wide: 'door-barn-double', inner: 'door-plank' }; }
DOOR_ENDS.add('hut-passage'); THROUGH.add('hut-passage'); // walked end to end: house door at one end, the byre (or the yard) at the other
// <<< type:hut
