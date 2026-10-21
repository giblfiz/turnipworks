// >>> type:lai
// ---- monster lair (2026-10-11): ten rooms, NO windows. Walls: cut-rock (hewn from the living rock: the dungeon batch's
// family, shared). A NATURAL cave-rock family is wanted and not built (docs/ASSETS_TO_BUILD.md -> Monster lair); until
// then every lair room names cut-rock. The role is the room's place in a carved site's graph, for the building generator:
//   lair-mouth    outdoor   ENTRANCE (depth 0): the ground before the lair; the first passage's door opens onto it
//   lair-passage  passage   MID: the connective tissue; loops are made of these (a den's bolt hole joins one)
//   lair-warren   hub       MID: the tribe's common den; passages, larder, pit and trophy cave open off it
//   lair-beast    terminal  MID: one way in (a second door, if the generator gives it one, is its bolt hole)
//   lair-spider   terminal  MID or DEEP
//   lair-larder   uses      MID: serves a den (its door is on the den's side)
//   lair-pit      terminal  MID: off the warren or a passage, away from the entrance
//   lair-hatchery terminal  DEEP: behind a den, never off the entrance
//   lair-trophy   passage   DEEP: the gallery walked through to reach the heart
//   lair-dragon   terminal  HEART (deepest): one way in, through the trophy cave or the last passage
Object.assign(ROLES, {
  'lair-mouth': { role: 'outdoor', who: 'whoever comes for it', depth: 'entrance' },
  'lair-passage': { role: 'passage', who: 'what lives here', depth: 'mid' },
  'lair-warren': { role: 'hub', who: 'the tribe', depth: 'mid' },
  'lair-beast': { role: 'terminal', who: 'what lives here', depth: 'mid', boltHole: true },
  'lair-spider': { role: 'terminal', who: 'what lives here', depth: 'mid', boltHole: true },
  'lair-larder': { role: 'uses', who: 'what lives here', uses: ['lair-warren', 'lair-beast', 'lair-spider', 'lair-dragon'], depth: 'mid' },
  'lair-pit': { role: 'terminal', who: 'its keepers', depth: 'mid' },
  'lair-hatchery': { role: 'terminal', who: 'what lives here', depth: 'deep' },
  'lair-trophy': { role: 'passage', who: 'what lives here', depth: 'deep', yardDoor: false },
  'lair-dragon': { role: 'terminal', who: 'the dragon', depth: 'heart' },
});
export const LAI_ROOMS = ['lair-mouth', 'lair-passage', 'lair-warren', 'lair-beast', 'lair-spider', 'lair-larder', 'lair-pit', 'lair-hatchery', 'lair-trophy', 'lair-dragon'];
for (const k of LAI_ROOMS) if (k !== 'lair-mouth') NO_WINDOWS.add(k);
// (cut-rock is registered by the dungeon's block above: family list, fallback, kit)
{ // doors: a lair has few. The goblins hang plank doors; the pit and the larder are shut with the iron gate (the crypt's)
  // or the iron-bound oak; every other opening takes the iron-bound oak leaf until a leafless cave opening exists
  // (wanted: docs/ASSETS_TO_BUILD.md -> Monster lair -> "an opening with no leaf")
  const leaf = { 'door-reinforced': 'castle-leaf' }, oak = { main: 'door-reinforced', inner: 'door-reinforced', leaf };
  for (const k of ['lair-passage', 'lair-beast', 'lair-spider', 'lair-hatchery', 'lair-trophy', 'lair-dragon']) DOORS[k] = oak;
  DOORS['lair-warren'] = { main: 'door-plank', inner: 'door-plank' };
  DOORS['lair-larder'] = { main: 'door-plank', inner: ['door-plank', 'door-reinforced'], leaf };
  DOORS['lair-pit'] = { main: 'crypt-gate-iron', inner: 'crypt-gate-iron' }; }
THROUGH.add('lair-passage'); DOOR_ENDS.add('lair-passage'); DOOR_ENDS.add('lair-trophy'); // walked end to end
// <<< type:lai
