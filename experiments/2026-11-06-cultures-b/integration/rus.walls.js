// ---- Medieval Rus' (RUS, 2026-11-06, experiments/2026-11-06-cultures-b): six rooms in `rus-log` (horizontal round logs, a
// carved board under the wall plate, a carved lintel, a small mica window in a plain frame). It borrows the log cabin's
// corners and doorway when it lacks them, and rough timber's floors and props ----
WALL_FAMILIES.push('rus-log');
FAMILY_FALLBACK['rus-log'] = 'log-cabin';
TO_KIT['rus-log'] = 'kit-plank';
export const RUS_ROOMS = ['rus-izba', 'rus-terem', 'rus-banya', 'rus-church', 'rus-market', 'rus-yard'];
Object.assign(ROLES, {
  'rus-izba': { role: 'hub', who: 'the family' },
  'rus-terem': { role: 'hub', who: 'the boyar, his family and guests' },
  'rus-banya': { role: 'terminal', who: 'the bathers' },
  'rus-church': { role: 'terminal', who: 'the priest and the faithful' },
  'rus-yard': { role: 'outdoor', who: 'everyone' },
});
mktRegisterShop('rus-market');
NO_WINDOWS.add('rus-banya');
for (const k of ['rus-izba', 'rus-terem', 'rus-banya', 'rus-church', 'rus-market']) DOORS[k] = { main: 'door-plank', inner: 'door-plank' };
