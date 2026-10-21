// Room and building labels (Harry 2026-10-03): rooms and buildings carry a name that the GM side sees as a label
// ("Common room", "Secret vault") and clicks to select the whole room or building. Seats that may not edit rooms
// never RECEIVE those names: the relay strips them from snapshots, log entries and the GET API, so a label like
// "Secret vault" cannot leak to a player's client or a player's agent, whatever that client does.
//   room      .name  (absent = the room type's label, which the client knows from the recipe anyway)
//   building  .name  (stripped to the neutral 'Building')
import { can } from './perms.js';

export const NEUTRAL_BUILDING = 'Building';

// may this seat see labels in this area? (anyone who may alter rooms there)
export const seesLabels = (state, seat, area) => can(state, seat, 'room', area).ok;

export function stripEntity(e) {
  if (!e || typeof e !== 'object') return e;
  if (e.kind === 'room' && 'name' in e) { const { name, ...rest } = e; return rest; }
  if (e.kind === 'building' && e.name !== NEUTRAL_BUILDING) return { ...e, name: NEUTRAL_BUILDING };
  return e;
}
export const stripEntities = (entities) => Object.fromEntries(Object.entries(entities).map(([id, e]) => [id, stripEntity(e)]));

// a log entry's (type, args) as a label-blind seat may receive it; null = unchanged
function stripOp(type, args, area) {
  switch (type) {
    case 'room.spawn': { if (!('buildingName' in args) && !('name' in args)) return null; const { buildingName, name, ...a } = args; return { type, args: a }; }
    case 'room.set': { if (!('name' in args)) return null; const { name, ...a } = args; return { type, args: a }; }
    case 'building.set': { // a rename the seat may not see: a no-op that keeps the seq; its heights (base, storey) are not a label and do travel
      if (!('name' in args)) return null;
      const { name, ...a } = args;
      return a.base !== undefined || a.storey !== undefined || a.roof !== undefined ? { type, args: a } : { type: 'entities.set', args: { set: {} } };
    }
    case 'entities.set': {
      const set = {}; let changed = false;
      for (const [id, e] of Object.entries(args.set || {})) { const s = stripEntity(e); set[id] = s; if (s !== e) changed = true; }
      return changed ? { type, args: { ...args, set } } : null;
    }
    case 'batch': {
      let changed = false;
      const ops = (args.ops || []).map(op => { const s = stripOp(op.type, op.args, area); if (s) { changed = true; return s; } return op; });
      return changed ? { type, args: { ...args, ops } } : null;
    }
    default: return null;
  }
}
// entry: { type, args, ... }; area: the area as it stands now (for building.set's projection)
export function stripEntry(entry, area) {
  const s = stripOp(entry.type, entry.args || {}, area);
  return s ? { ...entry, type: s.type, args: s.args } : entry;
}

// GM NOTES ON A PAWN (Harry 2026-10-06: the sheet card's "GM notes" tab): the same rule as the labels above, on a
// different axis. A pawn's `gmNotes` is never SENT to a seat that is not on the GM side (the GM and the GM's agents):
// the relay takes it out of snapshots, log entries (the command itself, its undo, a batch, a projection, a transfer)
// and the GET API. `unnote*` return the same object when there is nothing to take out.
export function unnoteEntity(e) {
  if (!e || typeof e !== 'object' || e.kind !== 'token' || !('gmNotes' in e)) return e;
  const { gmNotes, ...rest } = e; return rest;
}
export const unnoteEntities = (entities) => { let changed = false; const out = {}; for (const [id, e] of Object.entries(entities)) { const s = unnoteEntity(e); out[id] = s; if (s !== e) changed = true; } return changed ? out : entities; };
function unnoteOp(type, args) {
  switch (type) {
    case 'token.set': case 'token.create': {
      if (!args || !('gmNotes' in args)) return null;
      const { gmNotes, ...a } = args;
      // a change that was ONLY the GM's note: a no-op that keeps the seq (a player learns nothing, not even that a note was written)
      return type === 'token.set' && Object.keys(a).length === 1 ? { type: 'entities.set', args: { set: {} } } : { type, args: a };
    }
    case 'entities.set': { const set = unnoteEntities(args.set || {}); return set === args.set ? null : { type, args: { ...args, set } }; }
    case 'transfer.in': { const e = unnoteEntity(args.entity); return e === args.entity ? null : { type, args: { ...args, entity: e } }; }
    case 'batch': {
      let changed = false;
      const ops = (args.ops || []).map(op => { const s = unnoteOp(op.type, op.args); if (s) { changed = true; return s; } return op; });
      return changed ? { type, args: { ...args, ops } } : null;
    }
    default: return null;
  }
}
export function unnoteEntry(entry) {
  const cleanPrivate = (type, args) => { const { _roomPlayerOwners, ...rest } = args; return type === 'batch' ? { ...rest, ops: rest.ops.map(op => ({ ...op, args: cleanPrivate(op.type, op.args) })) } : rest; };
  const args = cleanPrivate(entry.type, entry.args || {});
  const s = unnoteOp(entry.type, args);
  return s ? { ...entry, type: s.type, args: s.args } : { ...entry, args };
}
