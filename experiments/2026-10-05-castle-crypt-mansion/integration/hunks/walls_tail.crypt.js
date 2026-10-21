// ---- crypt (2026-10-05): seven rooms, wall family crypt-stone (dark damp dressed stone), NO windows ----
Object.assign(ROLES, {
  'crypt-antechamber': { role: 'passage', who: 'mourners' },                 // a through-way with a monument facing the gate
  'crypt-catacomb': { role: 'passage', who: 'mourners' },                    // the corridor: its walls are the feature
  'crypt-vault': { role: 'terminal', who: 'the dead' },
  'crypt-ossuary': { role: 'terminal', who: 'the dead' },
  'crypt-chapel': { role: 'terminal', who: 'mourners' },
  'crypt-relic': { role: 'terminal', who: 'whoever finds it' },              // the reward room: exactly one door
  'crypt-embalming': { role: 'uses', who: 'staff', uses: ['crypt-vault', 'crypt-chapel'] }, // a work room: it serves the vault and the chapel
});
for (const k of ['crypt-antechamber', 'crypt-catacomb', 'crypt-vault', 'crypt-ossuary', 'crypt-chapel', 'crypt-relic', 'crypt-embalming']) NO_WINDOWS.add(k);
WALL_FAMILIES.push('crypt-stone');
FAMILY_FALLBACK['crypt-stone'] = 'dressed-stone'; // corners (stone pillars), floors and family-keyed props borrow dressed stone
TO_KIT['crypt-stone'] = 'kit-stone';
{ const crypt = { main: 'crypt-gate-iron', inner: 'door-crypt' }; // the iron gate to outside, black oak between rooms
  for (const k of ['crypt-antechamber', 'crypt-catacomb', 'crypt-vault', 'crypt-ossuary', 'crypt-chapel', 'crypt-embalming']) DOORS[k] = crypt;
  DOORS['crypt-relic'] = { main: ['door-crypt', 'crypt-gate-iron'], inner: ['door-crypt', 'crypt-gate-iron'] }; } // shut, or the gold seen through bars
Object.assign(PANELS, {
  'crypt-vault': [{ ids: ['wall-crypt-niches'], sides: 'long', every: [1, 2] }],
  'crypt-catacomb': [{ ids: ['wall-crypt-niches'], sides: 'long', every: [1, 1] }],      // every segment of both long walls: between plain panels the niches read as shelves of sacks (blind reads, 2026-10-05)
  'crypt-ossuary': [{ ids: ['ossuary-wall'], sides: 'all', every: [1, 1], ends: true, doorWall: false }], // faced with skulls wall to wall; the door wall stays plain for the torches
  'crypt-antechamber': [{ ids: ['tomb-door-sealed'], one: true, chance: 1 / 3, centre: false }],   // a blind sealed door, never behind the monument
  'crypt-relic': [{ ids: ['tomb-door-sealed'], one: true, chance: 1 / 3, centre: false }],
});
THROUGH.add('crypt-catacomb'); // alone, the corridor has a gate at each end
DOOR_ENDS.add('crypt-catacomb'); DOOR_ENDS.add('crypt-chapel'); // a corridor is entered at its end; the chapel's door faces the altar down the aisle
