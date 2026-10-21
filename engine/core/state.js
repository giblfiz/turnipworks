// World state as plain data (principle 1): campaign → areas → entities. No three.js, no sockets.
// The campaign is the only global (principle 4); every entity lives under exactly one area.
//
// Campaign  { id, name, cseq, seats: {id: Seat}, areas: {id: Area}, areaOrder: [id] }
// Seat      { id, kind: 'human'|'llm', role: 'gm'|'player', name, color, creator, scope, revoked, location, invisible }
// Area     { id, name, visibility: 'open'|'hidden' (stored 'party' / 'gm' from before 2026-10-06 read as hidden: perms.js), seq, order, entities: {id: Entity} }
// Entity    token  { id, kind:'token', name, x, z, color, owner }                       x, z in feet
//           room   { id, kind:'room', recipe:{type,x,z,w,d,seed,wallSeed,engine,engineVersion}, order, layout:{hash, placements} }
//                  room x, z, w, d are in 5-ft cells (the tuner's grid)
//           object { id, kind:'object', name, x, z, rot, dims:[w,h,d], color }
import { fogFor } from './fog.js';
import { canSee, liveSeat, principalOf, effectiveClasses, visibilityOf } from './perms.js';
import { labelPoint } from './footprint.js';
import { forPlayers as turnsForPlayers } from './turns.js';
import { defsFor, castFor, partyFor } from './party.js';

export function newCampaign(id, name) {
  return { id, name, cseq: 0, seats: {}, areas: {}, areaOrder: [], defaults: {}, requests: {} };
}

// Area play settings (Settings ▸ Area, ▸ Global defaults; Harry 2026-10-04). An area's own value overrides the
// campaign default, which overrides the built-in. null / missing = inherit. fog and music are stored placeholders.
export const RULE_DEFAULTS = { light: 'house', grid: true, freeMoves: true, touch: 'open', fog: false, fogOfWar: false, darkness: false, music: '' };
// fogOfWar: vision fog (client/fog.js). Per-area override of the campaign default (Harry 2026-10-15); an area's explored memory
// is kept while it is off, so turning it back on restores it. `fog` below is the old placeholder, unused.
export const RULE_KEYS = { light: ['house', 'day', 'night', 'deep-night', 'daylight'], grid: 'bool', freeMoves: 'bool', touch: ['open', 'none'], fog: 'bool', fogOfWar: 'bool', darkness: 'bool', music: 'str' };
// campaign-wide items that areas do not override
// travelLocked: players may not send their pawns to another area (Harry 2026-10-06: "the GM ... can lock travel")
// distance: how a distance is counted (core/measure.js RULES): 'true' straight line (the default) | 'five' squares, every
// diagonal 5 ft | 'alt' squares, diagonals alternating 5 / 10. units: what a readout is written in.
// sharedPartyVision stays campaign-wide (one party union per area; per-area would add nothing a player could use).
export const CAMPAIGN_KEYS = { sharedPartyVision: 'bool', travelLocked: 'bool', distance: ['true', 'five', 'alt'], units: ['ft', 'm'], genre: 'str', rolls: ['public', 'hidden'], houseAnim: 'str', houseLight: 'str', houseSelection: 'str' };
const defined = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== null && v !== undefined));
export function areaRules(state, areaId) {
  return { ...RULE_DEFAULTS, ...defined(pick(state.defaults, RULE_KEYS)), ...defined(state.areas[areaId]?.settings) };
}
const pick = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => k in keys));
// a settings patch is valid if every key is known and every value fits (null = back to inherited)
export function settingsProblem(patch, keys) {
  for (const [k, v] of Object.entries(patch || {})) {
    const t = keys[k];
    if (!t) return `unknown setting ${k}`;
    if (v === null) continue;
    if (t === 'bool' ? typeof v !== 'boolean' : t === 'str' ? typeof v !== 'string' || v.length > 80 : !t.includes(v)) return `bad value for ${k}`;
  }
  return null;
}
export const mergeSettings = (cur, patch) => { const out = { ...(cur || {}) }; for (const [k, v] of Object.entries(patch || {})) if (v === null) delete out[k]; else out[k] = v; return out; };

export function newArea(id, name, visibility = 'open') {
  return { id, name, visibility, seq: 0, order: 0, entities: {}, settings: {} };
}

// What one seat is allowed to know about the campaign: the roster (locations only where it can see them)
// and the areas it can see. Computed by the relay and sent instead of raw campaign state.
export function projectCampaign(state, viewerId, online = new Set()) {
  const me = liveSeat(state, viewerId);
  if (!me) return null;
  const viewerIsGm = principalOf(state, viewerId)?.role === 'gm';
  const seats = [];
  for (const s of Object.values(state.seats)) {
    if (!liveSeat(state, s.id)) continue;
    const creator = s.kind === 'llm' ? state.seats[s.creator] : null;
    if (s.invisible && !viewerIsGm && s.creator !== viewerId && s.id !== viewerId) continue;
    // a seat in an area this viewer cannot see has NO location for them: not its name, not even "elsewhere" (that word
    // told players a hidden area existed and who was in it; Harry 2026-10-06: hidden means hidden everywhere)
    const where = s.location;
    const visible = where && canSee(state, viewerId, where);
    seats.push({
      id: s.id, kind: s.kind, role: s.role, name: s.name, color: s.color,
      creator: s.creator || null, label: creator ? `${creator.name}'s ${s.role === 'gm' ? 'GM assistant' : 'agent'}` : null,
      location: visible ? where : null, elsewhere: false, invisible: !!s.invisible, online: online.has(s.id),
    });
  }
  const areas = state.areaOrder.filter(t => canSee(state, viewerId, t)).map(t => {
    const T = state.areas[t];
    return { id: T.id, name: T.name, visibility: visibilityOf(T), seq: T.seq, settings: T.settings || {} };
  });
  // requests: the GM sees every one (with an import's payload, to apply on approval); a player only their own
  const requests = Object.values(state.requests || {}).filter(r => viewerIsGm || r.by === viewerId).map(r => viewerIsGm ? r : { ...r, payload: undefined });
  return {
    id: state.id, name: state.name, cseq: state.cseq, me: viewerId,
    my: { kind: me.kind, role: principalOf(state, viewerId).role, name: me.name, color: me.color, classes: effectiveClasses(state, viewerId, null), location: me.location && canSee(state, viewerId, me.location) ? me.location : null },
    seats, areas, defaults: state.defaults || {}, requests,
    // the party rows, this seat's defined pawns (the GM side: everyone's) and, for the GM side ONLY, the cast (core/party.js)
    party: partyFor(state, viewerId), pawns: defsFor(state, viewerId), ...(viewerIsGm && { cast: castFor(state, viewerId) }),
  };
}

// A area as sent to a client that can see it. Player-side seats never receive things hidden from players: a hidden
// room goes whole (the room, its things, its own wall edits: core/commands.js entity.flag), and a building none of whose
// rooms a player can see is not sent either (an empty building would say "something is hidden here").
export function areaForClient(area, gmSide = true, viewer = null, shared = false) {
  let entities = area.entities;
  if (!gmSide) {
    const seen = new Set(Object.values(area.entities).filter(e => e.kind === 'room' && !e.hidden && e.building).map(e => e.building));
    entities = Object.fromEntries(Object.entries(area.entities).filter(([, e]) => !e.hidden && (e.kind !== 'building' || seen.has(e.id))));
  }
  // the turn order (core/turns.js): whole for the GM side; for players, without the entries of hidden pawns
  const turns = gmSide ? area.turns : turnsForPlayers(area);
  return { id: area.id, name: area.name, seq: area.seq, order: area.order, entities, ...(area.fog && {fog:fogFor(area.fog,viewer,shared,gmSide)}), chat: area.chat || [], ...(turns && { turns }) };
}

// Plain centroid of the things in an area (feet), used for "glide to what I read".
export function entityPoint(e) {
  if (!e) return null;
  if (e.kind === 'room') return labelPoint(e.recipe); // the middle of the largest rectangle inside it (core/footprint.js)
  return Number.isFinite(e.x) && Number.isFinite(e.z) ? [e.x, e.z] : null; // buildings have no point of their own
}
export function areaCentroid(area) {
  const pts = Object.values(area.entities).map(entityPoint).filter(Boolean);
  if (!pts.length) return [0, 0];
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}
