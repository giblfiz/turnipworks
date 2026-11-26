// ---- Norse steading (NRS, 2026-11-06, experiments/2026-11-06-cultures-b): six rooms in `norse-stave` (upright staves under a
// wall plate carved with interlace; a low carved portal). No windows: a hall is lit by its hearth, the smoke hole and its doors.
// The family borrows rough-timber's corner posts, floors and family-keyed props (trapdoors) ----
WALL_FAMILIES.push('norse-stave');
FAMILY_FALLBACK['norse-stave'] = 'rough-timber';
TO_KIT['norse-stave'] = 'kit-plank';
export const NRS_ROOMS = ['nrs-longhouse', 'nrs-meadhall', 'nrs-smithy', 'nrs-boathouse', 'nrs-weaving', 'nrs-yard'];
Object.assign(ROLES, {
  'nrs-longhouse': { role: 'hub', who: 'the household' },
  'nrs-meadhall': { role: 'hub', who: 'the chieftain, his household and his guests' },
  'nrs-smithy': { role: 'terminal', who: 'the smith' },
  'nrs-boathouse': { role: 'terminal', who: 'the crew' },
  'nrs-weaving': { role: 'terminal', who: 'the weavers' },
  'nrs-yard': { role: 'outdoor', who: 'everyone' },
});
for (const k of NRS_ROOMS) if (!isOutdoor(k)) { NO_WINDOWS.add(k); DOORS[k] = { main: 'door-plank', inner: 'door-plank' }; }
SPANS['nrs-boathouse'] = [2, 3]; // the boat goes out through a wide end door
