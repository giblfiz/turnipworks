// ---- Japan (culture pack, 2026-11-06, cultures-a): a Kyoto townhouse, tea house and Shinto shrine of the late Edo period.
// Walls: jpn-shoji (dark cedar posts and rails, white shoji lattice or earthen plaster) for the house, tea house, dojo and
// shop; jpn-shrine (vermilion posts and beams, white plaster) for the shrine hall. Doors: the wooden lattice street door
// (koshido) to outside, fusuma panels between rooms (both are leaves that swing: the engine has no sliding door yet).
// Two rooms are OUTDOOR: the shrine approach and the tea garden. Graph roles for a building layout: the tatami room and
// the shop are hubs; the rest terminals. ----
Object.assign(ROLES, {
  'jpn-house': { role: 'hub', who: 'the household and its guests' },
  'jpn-teahouse': { role: 'terminal', who: 'the host and up to five guests' },
  'jpn-dojo': { role: 'terminal', who: 'the master and the students' },
  'jpn-shrine': { role: 'terminal', who: 'worshippers' },
  'jpn-shrine-court': { role: 'outdoor', who: 'worshippers on the approach' },
  'jpn-shop': { role: 'hub', who: 'customers at the front, the household behind' },
  'jpn-garden': { role: 'outdoor', who: 'the host and the tea guests' },
});
export const JPN_ROOMS = ['jpn-house', 'jpn-teahouse', 'jpn-dojo', 'jpn-shrine', 'jpn-shrine-court', 'jpn-shop', 'jpn-garden'];
WALL_FAMILIES.push('jpn-shoji', 'jpn-shrine');
FAMILY_FALLBACK['jpn-shoji'] = 'half-timber'; FAMILY_FALLBACK['jpn-shrine'] = 'half-timber'; // (corner posts, floors and family-keyed props borrow half-timber's)
TO_KIT['jpn-shoji'] = 'kit-half-timber'; TO_KIT['jpn-shrine'] = 'kit-half-timber';
NO_WINDOWS.add('jpn-shrine'); // a worship hall: its walls are plain (jpn-shrine has no window piece)
{ const leaf = { 'door-plank': 'jpn-koshido-leaf', 'door-panelled': 'jpn-fusuma-leaf' }, house = { main: 'door-plank', inner: 'door-panelled', leaf };
  for (const k of ['jpn-house', 'jpn-teahouse', 'jpn-dojo', 'jpn-shop']) DOORS[k] = house;
  DOORS['jpn-shrine'] = { main: 'door-panelled', inner: 'door-panelled', leaf }; } // (the hall's front stands open in life; a fusuma-like panel until an open front exists)
DOOR_ENDS.add('jpn-shrine'); // entered facing the offering table down the long axis
