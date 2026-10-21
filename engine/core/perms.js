// Seats, permissions and visibility. Pure functions of campaign state; the relay calls them on every command
// and every read, clients call them only to grey out buttons.
//
// A seat is a participant (principle 5): human or LLM, each with a role, a location and a visibility.
// Every LLM seat is created by a human seat and acts with a SUBSET of its creator's permissions, never more:
// its effective permissions are re-derived from the creator's on every check, intersected with the seat's own
// scope. So demoting or revoking the creator immediately narrows or kills the agent (cascade by construction).

// Command classes: the unit a GM grants to an agent ("may place furniture", "may move NPCs").
export const CLASSES = {
  'token.move': 'move tokens (players: only their own)',
  'token.edit': 'create, rename and delete tokens',
  room: 'spawn and delete rooms',
  object: 'place, move and delete objects',
  undo: 'undo your own changes (the GM: anyone\'s)',
  pawn: 'edit your own pawns (label, conditions, facing, notes); change any pawn\'s damage and indicator',
  open: 'open and close doors, chests and shutters; light and put out fires and candles',
  reveal: 'hide things from players, and reveal them',
  chat: 'talk and roll dice',
  template: 'place measuring templates anywhere you can see, change and remove your own (the GM: anyone\'s, and clear them all)',
  turn: 'follow the turn order: roll or set your own initiative, end your own turn (the GM: start and end a fight, next and previous, reorder, anyone\'s number)',
  'area.admin': 'create areas and set their visibility',
  transfer: 'move things between areas',
  travel: 'send your own pawns to another open area (the GM: any pawn, to any area)',
  'seat.admin': 'create and revoke player seats, move people between areas',
  'seat.agent': 'create and revoke your own LLM seats',
  'seat.locate': 'go to an area you can see',
  'seat.self': 'change your own name and colour',
  request: 'ask the GM to import or export (the GM approves or denies)',
  'campaign.admin': 'change campaign-wide defaults, approve requests, restore snapshots',
};
export const ALL_CLASSES = Object.keys(CLASSES);
const PLAYER_CLASSES = new Set(['token.move', 'seat.agent', 'seat.locate', 'pawn', 'open', 'chat', 'turn', 'template', 'undo', 'seat.self', 'request', 'travel']);
const AGENTS_NEVER = new Set(['seat.agent', 'seat.admin', 'seat.locate', 'seat.self', 'request']); // agents do not mint agents, move people or file requests

// AN AREA IS OPEN OR HIDDEN. NOTHING ELSE (Harry 2026-10-06; docs/PAWNS.md "Areas").
//   open   : every seat in the campaign can see the area
//   hidden : the GM side only. Hidden means hidden EVERYWHERE, and this file's canSee is the one filter the relay asks:
//            the area list, subscriptions, log entries, presence and pings, pictures, GET reads, travel.
// Before 2026-10-06 there were three rules ('open', 'party', 'gm') plus per-seat grants. Stored values are never
// rewritten: 'party' and 'gm' READ as hidden (isOpen), and grants no longer open anything. On the day of the change no
// saved campaign had a 'party' area, nor a grant on an area that was not open, so no player sees more or less than
// before (engine/test/migrate.test.mjs holds every campaign on disk to that).
export const VISIBILITIES = ['open', 'hidden'];
export const isOpen = (area) => !!area && area.visibility === 'open';
export const visibilityOf = (area) => isOpen(area) ? 'open' : 'hidden';

const no = (why) => ({ ok: false, why });
const yes = { ok: true };

// A seat is live if it exists, is not revoked, and (for an LLM) its creator is live. Cascade revocation
// therefore holds even if a revoke record somehow missed a child.
export function liveSeat(state, id) {
  const s = state.seats[id];
  if (!s || s.revoked) return null;
  if (s.kind === 'llm' && !liveSeat(state, s.creator)) return null;
  return s;
}

// The human a seat ultimately acts as: itself for humans, its creator for LLM seats.
export function principalOf(state, id) {
  const s = state.seats[id];
  if (!s) return null;
  return s.kind === 'llm' ? state.seats[s.creator] || null : s;
}

function scopeAllows(scope, cls, areaId) {
  if (!scope) return false;
  const classOk = scope.classes === '*' || (Array.isArray(scope.classes) && scope.classes.includes(cls));
  return classOk && scopeHasArea(scope, areaId);
}
function scopeHasArea(scope, areaId) {
  if (areaId == null) return true; // campaign-level classes are not area-scoped
  return scope.areas === '*' || (Array.isArray(scope.areas) && scope.areas.includes(areaId));
}

// Can seat `id` use command class `cls` in area `areaId` (null for campaign-level)?
export function can(state, id, cls, areaId = null) {
  const s = liveSeat(state, id);
  if (!s) return no(state.seats[id] ? 'seat revoked' : 'unknown seat');
  if (!CLASSES[cls]) return no(`unknown command class ${cls}`);
  if (s.kind === 'llm') {
    if (AGENTS_NEVER.has(cls)) return no(`agents cannot ${CLASSES[cls]}`);
    if (!scopeAllows(s.scope, cls, areaId)) return no(`outside this agent's scope (${cls}${areaId ? ' on ' + areaId : ''})`);
    const viaCreator = can(state, s.creator, cls, areaId); // never more than the creator, evaluated now
    return viaCreator.ok ? yes : no(`creator cannot: ${viaCreator.why}`);
  }
  if (s.role === 'gm') return yes;
  return PLAYER_CLASSES.has(cls) ? yes : no(`players cannot ${CLASSES[cls]}`);
}

// Can seat `id` see area `areaId`? Used for subscriptions, reads, presence routing and command checks.
export function canSee(state, id, areaId) {
  const t = state.areas[areaId];
  const s = liveSeat(state, id);
  if (!t || !s) return false;
  if (s.kind === 'llm') return scopeHasArea(s.scope, areaId) && canSee(state, s.creator, areaId);
  if (s.role === 'gm') return true;
  return isOpen(t);
}

// Is `scope` (requested for a new LLM seat) within what `creatorId` holds right now?
// GM creators may grant any subset of classes on any areas; players only their own classes.
export function scopeWithin(state, creatorId, scope) {
  if (!scope || typeof scope !== 'object') return no('scope required');
  const classes = scope.classes === '*' ? ALL_CLASSES.filter(c => !AGENTS_NEVER.has(c)) : scope.classes;
  if (!Array.isArray(classes) || !classes.length) return no('scope.classes must be "*" or a non-empty list');
  const areas = scope.areas === '*' ? Object.keys(state.areas) : scope.areas;
  if (!Array.isArray(areas)) return no('scope.areas must be "*" or a list');
  for (const t of areas) if (!state.areas[t]) return no(`unknown area ${t}`);
  for (const c of classes) {
    if (!CLASSES[c]) return no(`unknown class ${c}`);
    if (AGENTS_NEVER.has(c)) return no(`agents cannot hold ${c}`);
    const r = can(state, creatorId, c, null);
    if (!r.ok) return no(`creator lacks ${c}: ${r.why}`);
  }
  return yes;
}

// What a seat may do, for the rules card and the UI (not used for enforcement).
export function effectiveClasses(state, id, areaId) {
  return ALL_CLASSES.filter(c => can(state, id, c, areaId).ok);
}

// Entity-level visibility: things hidden from players exist only for the GM side (the GM and the GM's agents).
// The relay filters them out of everything a player-side seat receives: snapshots, log entries, presence, GET reads.
export const isGmSide = (state, id) => principalOf(state, id)?.role === 'gm';
export function entityVisible(state, id, e) { return !!e && (!e.hidden || isGmSide(state, id)); }
