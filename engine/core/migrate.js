// "table" → "area" (Harry 2026-10-03). A playable area used to be called a table; "table" now means furniture only.
// Everything persisted or sent under the old names reads as the new ones through these pure, idempotent functions:
// snapshots and journal records on load, inbound socket messages, GET API paths and query params, and capability
// token claims (an LLM seat's scope used to say `tables`). relay/migrate-areas.js rewrites a data dir once.
export const DATA_FORMAT = 2; // 1 = tables, 2 = areas

const TYPES = { 'table.create': 'area.create', 'table.visibility': 'area.visibility' };
const CLASSES = { 'table.admin': 'area.admin' };
export const migrateType = (t) => TYPES[t] || t;
export const migrateClass = (c) => CLASSES[c] || c;

const rekey = (o, from, to) => {
  if (!o || typeof o !== 'object' || !(from in o)) return o;
  const { [from]: v, ...rest } = o;
  return to in rest ? rest : { ...rest, [to]: v };
};

// command args: `table: id` (area.visibility, seat.locate) → `area: id`; an LLM seat's scope (seat.create)
export function migrateArgs(args) {
  const a = rekey(args, 'table', 'area');
  return a && typeof a === 'object' && a.scope && typeof a.scope === 'object' ? { ...a, scope: migrateScope(a.scope) } : a;
}

// a command as a client or the GET API sends it: { type, table?, args }
export function migrateCommand(cmd) {
  if (!cmd || typeof cmd !== 'object') return cmd;
  const c = rekey(cmd, 'table', 'area');
  return { ...c, type: migrateType(c.type), args: migrateArgs(c.args) };
}

// an LLM seat's scope: { tables: '*'|[ids], classes: [...] } → { areas, classes }
export function migrateScope(scope) {
  if (!scope || typeof scope !== 'object') return scope;
  const s = rekey(scope, 'tables', 'areas');
  return Array.isArray(s.classes) ? { ...s, classes: s.classes.map(migrateClass) } : s;
}
export function migrateSeat(seat) { return seat && seat.scope ? { ...seat, scope: migrateScope(seat.scope) } : seat; }

// the default names the relay used to mint ("Table 1") read as "Area 1"; any name a person chose is kept
const migrateName = (n) => typeof n === 'string' && /^Table \d+$/.test(n) ? n.replace(/^Table/, 'Area') : n;

export function migrateCampaign(state) {
  if (!state || typeof state !== 'object') return state;
  let s = rekey(rekey(state, 'tables', 'areas'), 'tableOrder', 'areaOrder');
  if (s.areas) s = { ...s, areas: Object.fromEntries(Object.entries(s.areas).map(([id, a]) => [id, { ...a, name: migrateName(a.name) }])) };
  if (s.seats) s = { ...s, seats: Object.fromEntries(Object.entries(s.seats).map(([id, seat]) => [id, migrateSeat(seat)])) };
  return s;
}

const migrateInv = (inv) => inv && typeof inv === 'object' ? { ...inv, type: migrateType(inv.type), args: migrateArgs(inv.args) } : inv;

// one journal record: { r, at, by, cid, camp?, fx: [{table, seq, type, args, inv?}], undo?: {table,...}, redo?: {table,...} }
export function migrateRecord(rec) {
  if (!rec || typeof rec !== 'object') return rec;
  let r = rec;
  if (r.camp) {
    const args = migrateArgs(r.camp.args);
    r = { ...r, camp: { ...r.camp, type: migrateType(r.camp.type), args: r.camp.type === 'table.create' && args ? { ...args, name: migrateName(args.name) } : args } };
  }
  if (Array.isArray(r.fx)) r = { ...r, fx: r.fx.map(fx => { const f = rekey(fx, 'table', 'area'); return { ...f, type: migrateType(f.type), args: migrateArgs(f.args), ...(f.inv ? { inv: migrateInv(f.inv) } : {}) }; }) };
  if (r.undo) r = { ...r, undo: rekey(r.undo, 'table', 'area') };
  if (r.redo) r = { ...r, redo: rekey(r.redo, 'table', 'area') };
  if (r.result && typeof r.result === 'object') r = { ...r, result: rekey(r.result, 'table', 'area') };
  return r;
}

// a snapshot: { r, state, undo: [[area, [..]]], redo: [[key, [..]]], nonces, tails: [[area, [entry]]] }
export function migrateSnapshot(snap) {
  if (!snap || typeof snap !== 'object' || snap.format >= DATA_FORMAT) return snap;
  return {
    ...snap, format: DATA_FORMAT,
    state: migrateCampaign(snap.state),
    tails: (snap.tails || []).map(([a, es]) => [a, es.map(e => { const x = rekey(e, 'table', 'area'); return { ...x, type: migrateType(x.type), args: migrateArgs(x.args) }; })]),
    undo: (snap.undo || []).map(([a, us]) => [a, us.map(u => ({ ...u, inv: migrateInv(u.inv) }))]),
    redo: (snap.redo || []).map(([k, rs]) => [k, rs.map(x => ({ ...x, inv: migrateInv(x.inv) }))]),
  };
}

// an inbound socket message: { t, table?, type?, args? }
export function migrateMessage(m) {
  if (!m || typeof m !== 'object') return m;
  const x = rekey(m, 'table', 'area');
  return x.t === 'cmd' ? { ...x, type: migrateType(x.type), args: migrateArgs(x.args) } : x;
}

// capability token claims ({ c, s, cr, sc }): sc is an LLM seat's scope or a human's role string
export function migrateClaims(claims) { return claims && typeof claims.sc === 'object' ? { ...claims, sc: migrateScope(claims.sc) } : claims; }

// ---------------- hit points → damage (Harry 2026-10-06) ----------------
// A pawn used to carry `hp` and `hpMax`. It now carries `damage`, counted up from 0 (core/pawn.js). Old data is
// CONVERTED, never dropped on the floor:
//   damage = hpMax - hp   where the pawn had both (never below 0)
//   damage = 0            where it had only one of them, or neither (most pawns: hp was null)
// and the hp / hpMax fields go. A pawn at 0 damage carries no `damage` field. Pure and idempotent: a pawn with neither
// old field is returned as it is (the same object), so a second pass changes nothing.
// WHERE IT RUNS: the relay replays a campaign's snapshot and journal exactly as they were written (the reducers still
// understand the old arguments), then calls migratePawns once on what it has in memory (relay/campaign.js load) and,
// if anything changed, writes a fresh snapshot. No file is rewritten in place and no *.pre copy is needed: the old
// journal lines stay on disk behind the new snapshot and are never replayed again.
// ---------------- the pawn lock is dropped (Harry 2026-10-11) ----------------
// A pawn could be locked (entity.flag { locked }). The feature is gone (core/commands.js unlockPawn says why), so a
// saved pawn that is locked LOADS UNLOCKED: `locked: true` reads as `locked: false`, in the live state and in every
// stored inverse (an undo or a redo kept from that time must not put the lock back). The same pass as the one above,
// with the same rules: pure, idempotent, the same object back when there is nothing to do.
import { isStair, migrateStair } from './stairs.js';
export function migratePawn(e) {
  if (!e || typeof e !== 'object' || e.kind !== 'token' || !('hp' in e || 'hpMax' in e || e.locked)) return e;
  if (!('hp' in e || 'hpMax' in e)) return { ...e, locked: false };
  const { hp, hpMax, ...rest } = e;
  if (rest.locked) rest.locked = false;
  const damage = Number.isFinite(hp) && Number.isFinite(hpMax) ? Math.max(0, Math.round(hpMax - hp)) : 0;
  return damage > 0 ? { ...rest, damage } : rest;
}
const mapSame = (o, f) => { let changed = false; const out = {}; for (const [k, v] of Object.entries(o || {})) { const n = f(v); out[k] = n; if (n !== v) changed = true; } return changed ? out : o; };
// a stored command's arguments (an undo's inverse, a redo, a log-tail entry): the pawns inside it
function migratePawnArgs(type, args) {
  if (!args || typeof args !== 'object') return args;
  if (type === 'entities.set') { const set = mapSame(args.set, migratePawn); return set === args.set ? args : { ...args, set }; }
  if (type === 'transfer.in') { const entity = migratePawn(args.entity); return entity === args.entity ? args : { ...args, entity }; }
  if (type === 'batch') { let changed = false; const ops = (args.ops || []).map(op => { const a = migratePawnArgs(op.type, op.args); if (a !== op.args) changed = true; return a === op.args ? op : { ...op, args: a }; }); return changed ? { ...args, ops } : args; }
  if ((type === 'token.create' || type === 'token.set') && ('hp' in args || 'hpMax' in args)) { // history only (the log tail): say it in the new word where it can be said
    const { hp, hpMax, ...rest } = args;
    return type === 'token.create' && Number.isFinite(hp) && Number.isFinite(hpMax) && hpMax > hp ? { ...rest, damage: Math.round(hpMax - hp) } : rest;
  }
  return args;
}
const migrateStored = (x) => { if (!x || typeof x !== 'object' || !x.type) return x; const args = migratePawnArgs(x.type, x.args); return args === x.args ? x : { ...x, args }; };
// rt: { state, undo: Map(area -> [{inv}]), redo: Map(key -> [{inv}]), tails: Map(area -> [entry]) }, changed in place.
// Returns how many pawns in the live state were converted (0 = nothing to do).
export function migratePawns(rt) {
  let n = 0, unlocked = 0;
  const areas = mapSame(rt.state?.areas, (A) => { const entities = mapSame(A.entities, (e) => { const m = migratePawn(e); if (m !== e) { n++; if (e.locked) unlocked++; } return m; }); return entities === A.entities ? A : { ...A, entities }; });
  if (rt.state && areas !== rt.state.areas) rt.state = { ...rt.state, areas };
  let stored = 0;
  const inv = (it) => { const m = migrateStored(it.inv); if (m !== it.inv) { it.inv = m; stored++; } };
  for (const list of rt.undo?.values() || []) for (const it of list) inv(it);
  for (const list of rt.redo?.values() || []) for (const it of list) inv(it);
  for (const [a, list] of rt.tails || []) { let changed = false; const next = list.map(e => { const m = migrateStored(e); if (m !== e) changed = true; return m; }); if (changed) { rt.tails.set(a, next); stored++; } }
  migratePawns.last = { pawns: n, unlocked, stored }; // (the relay's log line, tests)
  return n + stored;
}

// ---------------- the planner's stairs → ordinary placed stairs (2026-10-11) ----------------
// Until 2026-10-11 a stair the game placed was a `place: 'stair'` object, and a stair from the library was furniture
// with no hole. They are ONE kind now (core/stairs.js: the catalog role makes the stair). Old stairs are CONVERTED
// (core/stairs.js migrateStair: same squares, same hole, same two ends; its turn is restated, because a catalog piece's
// front is its foot). It runs where migratePawns does: the relay replays the journal as written (object.place still
// takes place: 'stair'), then converts what it has in memory and writes a fresh snapshot. Idempotent.
//   pieceOf(kind, sku, rise) -> the catalog piece's object args (the relay: roomgen.stairPieceOf); null = keeps its box
// Returns { stairs: how many in the live state were converted, stored: how many inside undo / redo / log entries }.
function migrateStairArgs(type, args, f) {
  if (!args || typeof args !== 'object') return args;
  if (type === 'entities.set') { const set = mapSame(args.set, f); return set === args.set ? args : { ...args, set }; }
  if (type === 'transfer.in') { const entity = f(args.entity); return entity === args.entity ? args : { ...args, entity }; }
  if (type === 'batch') { let changed = false; const ops = (args.ops || []).map(op => { const a = migrateStairArgs(op.type, op.args, f); if (a !== op.args) changed = true; return a === op.args ? op : { ...op, args: a }; }); return changed ? { ...args, ops } : args; }
  if (type === 'object.place' && args.place === 'stair') { const { kind, ...e } = f({ kind: 'object', ...args }); return e; } // (a redo of the planner's own command)
  return args;
}
export function migrateStairs(rt, pieceOf = null) {
  let stairs = 0, stored = 0;
  const f = (e) => isStair(e) ? migrateStair(e, pieceOf) : e;
  const areas = mapSame(rt.state?.areas, (A) => { const entities = mapSame(A.entities, (e) => { const m = f(e); if (m !== e) stairs++; return m; }); return entities === A.entities ? A : { ...A, entities }; });
  if (rt.state && areas !== rt.state.areas) rt.state = { ...rt.state, areas };
  const st = (x) => { if (!x || typeof x !== 'object' || !x.type) return x; const args = migrateStairArgs(x.type, x.args, f); return args === x.args ? x : { ...x, args }; };
  const inv = (it) => { const m = st(it.inv); if (m !== it.inv) { it.inv = m; stored++; } };
  for (const list of rt.undo?.values() || []) for (const it of list) inv(it);
  for (const list of rt.redo?.values() || []) for (const it of list) inv(it);
  return { stairs, stored };
}

// ---------------- a thing's tilt -> its orientation (2026-10-12) ----------------
// For one day (2026-10-11) a tipped thing carried `tiltZ`: an angle about its own front-to-back axis. Roll is about the
// VIEW's axis now and rolls compose, so a thing carries a whole orientation, `quat` (core/orient.js). A saved `tiltZ`
// is converted to the quat it means ([0, 0, sin(t/2), cos(t/2)]: the thing is drawn exactly as it was), in the live
// state and in every stored entity (an undo or redo kept from then). Stored COMMANDS that say tiltZ (object.set,
// object.place) are left as written: the reducers still take the argument. Pure, idempotent.
import { quatFromTiltZ } from './orient.js';
export function migrateTilt(e) {
  if (!e || typeof e !== 'object' || !('tiltZ' in e)) return e;
  const { tiltZ, ...rest } = e, q = rest.quat || quatFromTiltZ(tiltZ);
  return q ? { ...rest, quat: q } : rest;
}
function migrateTiltArgs(type, args) {
  if (!args || typeof args !== 'object') return args;
  if (type === 'entities.set') { const set = mapSame(args.set, migrateTilt); return set === args.set ? args : { ...args, set }; }
  if (type === 'transfer.in') { const entity = migrateTilt(args.entity); return entity === args.entity ? args : { ...args, entity }; }
  if (type === 'batch') { let changed = false; const ops = (args.ops || []).map(op => { const a = migrateTiltArgs(op.type, op.args); if (a !== op.args) changed = true; return a === op.args ? op : { ...op, args: a }; }); return changed ? { ...args, ops } : args; }
  return args;
}
export function migrateTilts(rt) {
  let things = 0, stored = 0;
  const areas = mapSame(rt.state?.areas, (A) => { const entities = mapSame(A.entities, (e) => { const m = migrateTilt(e); if (m !== e) things++; return m; }); return entities === A.entities ? A : { ...A, entities }; });
  if (rt.state && areas !== rt.state.areas) rt.state = { ...rt.state, areas };
  const st = (x) => { if (!x || typeof x !== 'object' || !x.type) return x; const args = migrateTiltArgs(x.type, x.args); return args === x.args ? x : { ...x, args }; };
  const inv = (it) => { const m = st(it.inv); if (m !== it.inv) { it.inv = m; stored++; } };
  for (const list of rt.undo?.values() || []) for (const it of list) inv(it);
  for (const list of rt.redo?.values() || []) for (const it of list) inv(it);
  for (const [a, list] of rt.tails || []) { let changed = false; const next = list.map(e => { const m = st(e); if (m !== e) changed = true; return m; }); if (changed) { rt.tails.set(a, next); stored++; } }
  return { things, stored };
}
