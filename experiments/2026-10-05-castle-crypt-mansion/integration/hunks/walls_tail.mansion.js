// ---- mansion (2026-10-05): eight state rooms + two service rooms. Families noble-panel (oak wainscot), noble-paper
// (damask over a dado) and conservatory (glass on a brick plinth); the service wing keeps noble-interior / dressed-stone ----
Object.assign(ROLES, {
  'mansion-hall': { role: 'hub', who: 'guests' },                       // every other room opens off it
  'mansion-ballroom': { role: 'hub', who: 'guests' },
  'mansion-drawing': { role: 'terminal', who: 'guests' },
  'mansion-dining': { role: 'terminal', who: 'guests' },
  'mansion-library': { role: 'terminal', who: 'the family' },
  'mansion-bedroom': { role: 'terminal', who: 'the family' },
  'mansion-conservatory': { role: 'terminal', who: 'guests' },
  'mansion-garden': { role: 'outdoor', who: 'guests' },                 // a yard: no walls of its own (the yard grammar lays it)
  'mansion-kitchen': { role: 'uses', who: 'staff', uses: ['mansion-cellar', 'cellar', 'storeroom'] }, // the inn's kitchen in noble-interior walls
  'mansion-cellar': { role: 'terminal', who: 'staff' },                 // the inn's cellar with wine bins
});
for (const k of ['mansion-conservatory', 'mansion-cellar']) NO_WINDOWS.add(k); // the conservatory's wall IS the window; a cellar has none
WALL_FAMILIES.push('noble-panel', 'noble-paper', 'conservatory');
Object.assign(FAMILY_FALLBACK, { 'noble-panel': 'noble-interior', 'noble-paper': 'noble-interior', conservatory: 'noble-interior' }); // posts, floors, family-keyed props
Object.assign(TO_KIT, { 'noble-panel': 'kit-half-timber', 'noble-paper': 'kit-half-timber', conservatory: 'kit-half-timber' });
Object.assign(SPANS, { 'mansion-hall': [2], 'mansion-ballroom': [2] }); // the front door and the ballroom door are two cells wide
{ // doors: panelled leaves between rooms; the walnut double door (leaf 'fine-leaf', not the inn's studded oak) where the opening is wide
  const grand = { main: 'door-panelled', wide: 'door-double-grand', inner: 'door-panelled', leaf: { 'door-double-grand': 'fine-leaf' } };
  const state = { main: 'door-panelled', inner: 'door-panelled' };
  Object.assign(DOORS, { 'mansion-hall': grand, 'mansion-ballroom': grand, 'mansion-drawing': state, 'mansion-dining': state, 'mansion-library': state, 'mansion-bedroom': state,
    'mansion-conservatory': { main: 'door-glazed', inner: 'door-glazed' },
    'mansion-kitchen': { main: 'door-plank', inner: 'door-panelled' },   // the yard door is a plank door
    'mansion-cellar': { main: 'door-reinforced', inner: 'door-reinforced' } });
}
