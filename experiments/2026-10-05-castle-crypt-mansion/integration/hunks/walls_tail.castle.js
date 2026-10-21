// ---- castle (2026-10-05): nine rooms. castle-rough (dark rough ashlar, arrow slits for windows) for the working rooms,
// dressed-stone for the great hall, throne room and chapel (their room types name it; no FAMILY_ODDS entry, so no roll) ----
Object.assign(ROLES, {
  'great-hall': { role: 'hub', who: 'the household' },
  'throne-room': { role: 'terminal', who: 'petitioners' },                  // one way in: the door faces the throne
  'armoury': { role: 'terminal', who: 'the garrison' },                     // lockable, one door
  'barracks': { role: 'terminal', who: 'the garrison' },
  'chapel': { role: 'terminal', who: 'the household' },
  // the dungeon is a TERMINAL, not the stable's 'mixed': a mixed room moves its one outside door onto any yard beside it
  // and takes wide doors; a prison has one lockable door, and hangs off a passage or the hall like any other terminal
  'dungeon': { role: 'terminal', who: 'the jailer' },
  'gatehouse': { role: 'passage', who: 'carts and riders', yardDoor: true },
  'castle-kitchen': { role: 'uses', who: 'staff', uses: ['cellar', 'storeroom', 'mansion-cellar'] },
  'courtyard': { role: 'outdoor', who: 'everyone: the garrison, carts, horses' },
});
WALL_FAMILIES.push('castle-rough');
FAMILY_FALLBACK['castle-rough'] = 'fieldstone'; // corners (stone pillars), floors and family-keyed props borrow fieldstone
TO_KIT['castle-rough'] = 'kit-stone';
// wide outside doors: the hall, throne room and chapel double doors are 10 ft; the gatehouse portcullis is a two-cell panel
Object.assign(SPANS, { 'great-hall': [2], 'throne-room': [2], 'chapel': [2], 'gatehouse': [2] });
{ // the castle's door is the iron-bound oak LEAF (a second leaf under the inn's door-reinforced role: shape 'castle-leaf')
  const leaf = { 'door-reinforced': 'castle-leaf' }, plain = { main: 'door-reinforced', inner: 'door-reinforced', leaf };
  for (const k of ['armoury', 'barracks', 'dungeon', 'castle-kitchen']) DOORS[k] = plain;
  for (const k of ['great-hall', 'throne-room', 'chapel']) DOORS[k] = { main: 'door-reinforced', wide: 'door-double-grand', inner: 'door-reinforced', leaf };
  DOORS['gatehouse'] = { main: 'door-reinforced', wide: 'portcullis', inner: 'door-reinforced', leaf }; }
Object.assign(PANELS, { // stained glass in the long walls, one panel in two (outside walls only: it is a window)
  'throne-room': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
  'chapel': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
});
// the hall, the throne room and the chapel are entered at an END, facing the dais down the long axis (the designers'
// layouts assume it; with the door in a long wall the hearth and the door landing took the trestle rows)
DOOR_ENDS.add('great-hall'); DOOR_ENDS.add('throne-room'); DOOR_ENDS.add('chapel'); DOOR_ENDS.add('gatehouse'); // (the gatehouse: the passage runs the long way)
// a gatehouse standing alone has a gate at EACH end of its passage, straight across (blind reads: with one gate it is a guardroom)
THROUGH.add('gatehouse'); WAY_ON['gatehouse'] = { any: true, same: true, door: 'gate-double-timber' }; // the outer portcullis, and the timber gate on the castle's side
