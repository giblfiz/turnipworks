// ---- China (culture pack, 2026-11-06, cultures-a): a well-off official's courtyard house in mid-Qing Beijing and a
// Buddhist temple hall. Walls: chn-brick (blue-grey brick between dark red-brown columns, timber lattice partitions) for
// the house rooms and the tea house; chn-temple (red ochre plaster, red columns, a blue-green painted beam) for the
// temple hall only (red is the temple's, not the house's). Doors: the dark lacquered street door with bronze studs to
// outside, lattice doors between rooms (leaves that swing). The market street and the courtyard are OUTDOOR. Graph:
// the hall and the tea house are hubs, the study and the temple hall terminals. ----
Object.assign(ROLES, {
  'chn-hall': { role: 'hub', who: 'the household and its guests' },
  'chn-teahouse': { role: 'hub', who: 'customers' },
  'chn-study': { role: 'terminal', who: 'the scholar' },
  'chn-temple': { role: 'terminal', who: 'worshippers and monks' },
  'chn-market': { role: 'outdoor', who: 'everyone' },
  'chn-courtyard': { role: 'outdoor', who: 'the household' },
});
export const CHN_ROOMS = ['chn-hall', 'chn-teahouse', 'chn-study', 'chn-temple', 'chn-market', 'chn-courtyard'];
WALL_FAMILIES.push('chn-brick', 'chn-temple');
FAMILY_FALLBACK['chn-brick'] = 'half-timber'; FAMILY_FALLBACK['chn-temple'] = 'half-timber'; // (timber corner posts: the culture's own red-brown column where it has one)
TO_KIT['chn-brick'] = 'kit-stone'; TO_KIT['chn-temple'] = 'kit-stone';
NO_WINDOWS.add('chn-temple'); // the hall's light comes through its doors (chn-temple has no window piece)
{ const leaf = { 'door-plank': 'chn-gate-leaf', 'door-panelled': 'chn-lattice-leaf' }, house = { main: 'door-plank', inner: 'door-panelled', leaf };
  for (const k of ['chn-hall', 'chn-teahouse', 'chn-study']) DOORS[k] = house;
  DOORS['chn-temple'] = { main: 'door-panelled', inner: 'door-panelled', leaf }; } // a temple hall's front is a row of lattice doors
DOOR_ENDS.add('chn-temple'); // entered facing the altar down the long axis
