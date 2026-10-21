// ---- temple & chapel (2026-10-11): ten rooms. Wall family temple-stone (pale dressed limestone, lancet windows; corners,
// doorways and floors borrow dressed-stone). The dark cathedral is the same nave in crypt-stone, for the evil flavors ----
Object.assign(ROLES, {
  'temple-nave': { role: 'terminal', who: 'the faithful' },                 // entered at the end, facing the altar
  'cathedral': { role: 'terminal', who: 'the faithful' },
  'cathedral-dark': { role: 'terminal', who: 'the faithful' },
  'temple-shrine': { role: 'terminal', who: 'pilgrims' },
  'temple-vestry': { role: 'uses', who: 'the clergy', uses: ['temple-nave', 'cathedral', 'cathedral-dark', 'chapel'] },
  'temple-cloister': { role: 'passage', who: 'the clergy' },                // the type's hallway
  'temple-scriptorium': { role: 'terminal', who: 'the clergy' },
  'temple-infirmary': { role: 'terminal', who: 'the sick' },
  'temple-cell': { role: 'terminal', who: 'one priest' },
  'temple-belltower': { role: 'terminal', who: 'the ringers' },
});
WALL_FAMILIES.push('temple-stone');
FAMILY_FALLBACK['temple-stone'] = 'dressed-stone';
TO_KIT['temple-stone'] = 'kit-stone';
Object.assign(SPANS, { 'temple-nave': [2], 'cathedral': [2], 'cathedral-dark': [2] }); // the 10-ft double door
{ const leaf = { 'door-reinforced': 'castle-leaf' }, plain = { main: 'door-reinforced', inner: 'door-reinforced', leaf }; // the iron-bound oak leaf
  for (const k of ['temple-shrine', 'temple-vestry', 'temple-cloister', 'temple-scriptorium', 'temple-infirmary', 'temple-cell', 'temple-belltower']) DOORS[k] = plain;
  for (const k of ['temple-nave', 'cathedral', 'cathedral-dark']) DOORS[k] = { main: 'door-reinforced', wide: 'door-double-grand', inner: 'door-reinforced', leaf }; }
Object.assign(PANELS, { // stained glass (an abstract pattern: flavor-neutral) in the long walls, one panel in two; a family without the piece shows plain wall
  'temple-nave': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
  'cathedral': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
});
NO_WINDOWS.add('cathedral-dark'); // crypt-stone has no window piece
for (const k of ['temple-nave', 'cathedral', 'cathedral-dark', 'temple-cloister']) DOOR_ENDS.add(k);
THROUGH.add('temple-cloister'); // alone, the walk has a door at each end
