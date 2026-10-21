// ---- wizard's tower (2026-10-11): eleven rooms. Wall family tower-stone (warm buff ashlar, a plum-grey band course, a
// leaded lancet for its window); the apothecary shop is half-timber with a shop display window as a special panel ----
Object.assign(ROLES, {
  'wiz-stair': { role: 'hub', who: 'everyone who climbs the tower' },            // every floor's rooms open off the stair
  'wiz-lab': { role: 'uses', who: 'the alchemist', uses: ['wiz-store', 'storeroom', 'cellar'] },
  'wiz-apothecary': { role: 'uses', who: 'customers', uses: ['wiz-store', 'wiz-lab', 'storeroom'] }, // the shop is served from the store and the laboratory
  'wiz-study': { role: 'terminal', who: 'the wizard' },
  'wiz-summoning': { role: 'terminal', who: 'the wizard' },                      // one lockable door
  'wiz-observatory': { role: 'terminal', who: 'the wizard' },
  'wiz-scrying': { role: 'terminal', who: 'the wizard' },
  'wiz-store': { role: 'terminal', who: 'the alchemist' },
  'wiz-bedchamber': { role: 'terminal', who: 'the wizard' },
  'wiz-menagerie': { role: 'terminal', who: 'the familiars' },
  'wiz-workshop': { role: 'terminal', who: 'the wizard' },
});
for (const k of ['wiz-summoning', 'wiz-scrying', 'wiz-store']) NO_WINDOWS.add(k); // rites and scrying want the dark; a store has no window to climb through
WALL_FAMILIES.push('tower-stone');
FAMILY_FALLBACK['tower-stone'] = 'dressed-stone'; // corners (stone pillars), stairs, floors and family-keyed props borrow dressed stone
TO_KIT['tower-stone'] = 'kit-stone';
{ const tower = { main: 'door-tower', inner: 'door-tower' }; // the pale round-topped oak leaf in every tower doorway
  for (const k of ['wiz-stair', 'wiz-lab', 'wiz-study', 'wiz-summoning', 'wiz-observatory', 'wiz-scrying', 'wiz-store', 'wiz-bedchamber', 'wiz-menagerie', 'wiz-workshop']) DOORS[k] = tower; }
// the apothecary's display window: one panel on a plain outside wall (it is 18 in thick and grows outward, as every special panel does)
PANELS['wiz-apothecary'] = [{ ids: ['wall-shop-window'], one: true, chance: 1 }];
