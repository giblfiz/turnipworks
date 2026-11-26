// ---- Mexica (MES, 2026-11-06, experiments/2026-11-06-cultures-b): six rooms in `mes-stucco` (cream-white lime stucco over
// stone, a red base band; open doorways under a heavy lintel hung with a woven cotton curtain, never a hinged door; no
// windows). It borrows dressed stone's corner pillars, floors and family-keyed props ----
WALL_FAMILIES.push('mes-stucco');
FAMILY_FALLBACK['mes-stucco'] = 'dressed-stone';
TO_KIT['mes-stucco'] = 'kit-stone';
export const MES_ROOMS = ['mes-shrine', 'mes-ballcourt', 'mes-house', 'mes-market', 'mes-chinampa', 'mes-scribe'];
Object.assign(ROLES, {
  'mes-shrine': { role: 'terminal', who: 'the priests' },
  'mes-ballcourt': { role: 'outdoor', who: 'the players and the onlookers' },
  'mes-house': { role: 'hub', who: 'the household' },
  'mes-market': { role: 'outdoor', who: 'vendors and buyers' },
  'mes-chinampa': { role: 'outdoor', who: 'the farmers' },
  'mes-scribe': { role: 'terminal', who: 'the painter-scribe' },
});
for (const k of MES_ROOMS) if (!isOutdoor(k)) { NO_WINDOWS.add(k); DOORS[k] = { main: 'door-curtain', inner: 'door-curtain' }; }
