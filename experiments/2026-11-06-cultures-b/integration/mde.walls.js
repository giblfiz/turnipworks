// ---- Middle East / Mamluk (MDE, 2026-11-06, experiments/2026-11-06-cultures-b): six rooms in `mde-plaster` (cream lime plaster
// over striped ablaq stone, a pointed striped arch for the doorway, a mashrabiya lattice for the window). It borrows dressed
// stone's corner pillars, floors and family-keyed props ----
WALL_FAMILIES.push('mde-plaster');
FAMILY_FALLBACK['mde-plaster'] = 'dressed-stone';
TO_KIT['mde-plaster'] = 'kit-stone';
export const MDE_ROOMS = ['mde-courtyard', 'mde-souk', 'mde-hammam', 'mde-audience', 'mde-coffee', 'mde-garden'];
Object.assign(ROLES, {
  'mde-courtyard': { role: 'outdoor', who: 'merchants, their beasts and goods' },
  'mde-hammam': { role: 'terminal', who: 'the bathers' },
  'mde-audience': { role: 'hub', who: 'the host and his guests' },
  'mde-coffee': { role: 'hub', who: 'the customers' },
  'mde-garden': { role: 'outdoor', who: 'the household' },
});
mktRegisterShop('mde-souk'); // a shop of the market's skeleton: hub, open to the street (no glazed shop window in this family)
NO_WINDOWS.add('mde-hammam'); // (a bath is lit from its dome; its walls are benches and basins)
for (const k of ['mde-hammam', 'mde-audience', 'mde-coffee', 'mde-souk']) DOORS[k] = { main: 'door-reinforced', inner: 'door-plank' };
