// The command registry: the one door (principle 2) and the one protocol (principle 7).
// A command is { type, area?, args }. Each type declares:
//   level   'area' (lives in that area's ordered log) or 'campaign' (the thin campaign log)
//   cls     the permission class it needs (core/perms.js), or a function of (state, by, args)
//   args    the shape: { name: 'id' | 'num' | 'int' | 'str' | 'color' | 'bool' | 'obj' | 'enum:a|b' }, '?' = optional
//   check   semantic validation against current state; returns null or a reason string
//   apply   a PURE reducer: (area, args) → area for area commands, (campaign, args, meta) → campaign otherwise
//   touches the entity ids it changes (staleness checks and undo)
//   stale   GET based_on policy: 'reject' (default) returns "stale, here's what changed"; 'apply' goes ahead
// The relay runs check + apply; clients run apply optimistically. The same code, both sides.
import { factionScope, factionSlot, isFactionPiece, withFaction } from './factions.js';
import { isId } from './ids.js';
import { quatOf, quatFromTiltZ, quatProblem } from './orient.js';
import { can, canSee, liveSeat, principalOf, scopeWithin, isGmSide, isOpen } from './perms.js';
import { arrivalPoint } from './travel.js';
import { pawnDarkProblem, withDarkFields, feetProblem, LIGHT_RADIUS_MAX } from './darkness.js';
import { newArea, areaRules, settingsProblem, mergeSettings, RULE_KEYS, CAMPAIGN_KEYS } from './state.js';
import { overlap as roomsOverlap, outlineProblem, storedOutline, turnOutline, perimeterKeys as footprintKeys, keyBase, keyLevel, levelSuffix, hasCell } from './footprint.js';
import { roofProblem, mergeRoof, heightProblem, spanOfArgs, roomClash, supportProblem, storeyHeightOf, roomY, roomTop, baseOf, STEP, MAX_Y } from './height.js';
import { isStair, isConnector, isPlacedStair, stairRole, stairsTouching, stairLinks, stairTop, stairBase, stairRise, stairRoomAt } from './stairs.js';
import { MARK_KEYS, sheetProblem, cleanSheet, DAMAGE_LIMIT } from './pawn.js';
import { PARTY_NOTES_MAX, DEFS_PER_SEAT, CAST_MAX, GROUP_MAX } from './party.js';
import * as TU from './turns.js';
import * as MS from './measure.js';
import { floorUnder, tokenFloor } from './height.js';

import { emptyFog, levelsProblem, exploreFog, unionLevels, mergeFog } from './fog.js';

export const REGISTRY = {};
const def = (type, spec) => { REGISTRY[type] = { type, stale: 'reject', touches: () => [], ...spec }; };

const LIM = 100000; // feet; generous, just keeps junk out
const put = (area, e) => ({ ...area, entities: { ...area.entities, [e.id]: e } });
const drop = (area, id) => { const entities = { ...area.entities }; delete entities[id]; return { ...area, entities }; };
const ent = (area, id, kind) => { const e = area?.entities[id]; return e && (!kind || e.kind === kind) ? e : null; };
const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

// ---------------- area commands ----------------
// Fog memory merges independently of world entities. Contributions are attributed
// by the relay; no client may name another viewer. Quiet writes have no inverse.
def('fog.explore', {
  level:'area', cls:'pawn', args:{epoch:'int',levels:'obj',partyLevels:'obj?'}, quiet:true, stale:'apply', noBatch:true,
  check:({area,state,by},a)=>a.epoch !== (area.fog?.epoch||0) ? 'fog epoch changed; refresh before exploring' : levelsProblem(a.levels) || (a.partyLevels && ((!state.defaults?.sharedPartyVision && !isGmSide(state,by)) ? 'shared party vision is off' : levelsProblem(a.partyLevels))),
  apply:(t,a,meta)=>{const f=exploreFog(t.fog,meta?.by,a.levels,a.epoch);return {...t,fog:a.partyLevels&&a.epoch===f.epoch?{...f,party:unionLevels(f.party,a.partyLevels)}:f};}, inverse:()=>null,
});
def('fog.reveal', {
  level:'area', cls:'room', args:{epoch:'int',levels:'obj'}, stale:'apply', noBatch:true,
  check:({state,by,area},a)=>!isGmSide(state,by)?'only the GM reveals explored ground':a.epoch !== (area.fog?.epoch||0)?'fog epoch changed':levelsProblem(a.levels),
  apply:(t,a)=>{const f=t.fog||emptyFog();return a.epoch!==f.epoch?t:{...t,fog:{...f,revealed:unionLevels(f.revealed,a.levels)}};},
  inverse:t=>({type:'fog.revealed',args:{levels:t.fog?.revealed||{}}}),
});
def('fog.revealed',{level:'area',cls:'campaign.admin',args:{levels:'obj'},internal:true,
  apply:(t,a)=>({...t,fog:{...(t.fog||emptyFog()),revealed:a.levels,epoch:(t.fog?.epoch||0)+1}}),
  inverse:t=>({type:'fog.revealed',args:{levels:t.fog?.revealed||{}}})});
// Reset's relay transaction emits one clear per area. Anchor names the area in
// whose ordinary undo history the campaign-wide reset is accessible.
def('fog.reset',{level:'campaign',cls:'campaign.admin',args:{area:'id'},apply:s=>s,
  check:({state},a)=>state.areas[a.area]?null:'no such area'});
def('fog.clear',{level:'area',cls:'campaign.admin',args:{},internal:true,apply:t=>({...t,fog:{...emptyFog(),epoch:(t.fog?.epoch||0)+1}})});
def('fog.restore',{level:'area',cls:'campaign.admin',args:{fog:'obj',merge:'bool?'},internal:true,
  apply:(t,a)=>({...t,fog:{...(a.merge?mergeFog(t.fog,a.fog):a.fog),epoch:(t.fog?.epoch||0)+1}}),
  inverse:t=>({type:'fog.restore',args:{fog:t.fog||emptyFog(),merge:false}})});
def('fog.restoreAll',{level:'area',cls:'campaign.admin',args:{states:'obj',merge:'bool?'},internal:true,apply:t=>t});
// Projected snapshots keep sequence numbers intact without disclosing other
// players' explored records in logs, resets, inverses, or catch-up tails.
def('fog.view',{level:'area',cls:'campaign.admin',args:{fog:'obj'},internal:true,quiet:true,apply:(t,a)=>({...t,fog:a.fog})});

// Entities (all plain data):
//   token  { id, kind:'token', name, x, z, rot, color, owner, damage?, conditions, hidden, locked, sheet?, notes?, gmNotes?, mark? }
//          damage counts UP from 0 (absent = unhurt); before 2026-10-06 a pawn carried hp / hpMax (core/migrate.js)
//   object { id, kind:'object', name, cat, sku, url, flat, place, layer, x, y, z, rot, yaw, s, dims, room, parent,
//            hidden, locked, pinned, open }     cat = catalog object id; s = mesh scale [x,y,z]; dims = [w,h,d] ft
//   room   { id, kind:'room', recipe:{type,x,z,w,d,seed,wallSeed,engine,engineVersion,wallFamily,floor,turn?,outline?}, order,
//            (x, z, w, d: its bounding rectangle in 5-ft cells; outline: only when it is not the whole rectangle, core/footprint.js)
//            layout:{hash, summary}, hidden, locked }     its furniture are object entities with room = its id
// Chat and rolls live in area.chat (last CHAT_KEEP lines).
const CHAT_KEEP = 100;
const ownsOrGm = (state, by, e) => { const who = principalOf(state, by); return who.role === 'gm' || e.owner === who.id; };
const OBJ_ARGS = { flavor: 'str?', factionMissing: 'bool?', factionWasHidden: 'bool?', rise: 'int?', stair: 'str?', down: 'bool?', fromEdge: 'str?', rule: 'str?', orient: 'str?', lit: 'bool?', name: 'str?', cat: 'str?', sku: 'str?', url: 'url?', flat: 'bool?', place: 'str?', layer: 'str?', y: 'num?', rot: 'num?', yaw: 'num?', tiltZ: 'num?', quat: 'quat?', s: 'vec3?', dims: 'vec3?', room: 'id?', parent: 'id?', color: 'color?', hidden: 'bool?', pinned: 'bool?' };
// A THING TIPPED OVER: `quat`, a unit quaternion [x, y, z, w] = its orientation under its Turn (core/orient.js: what is
// drawn is Ry(rot) · Q(quat)). Absent = upright, so every campaign from before loads unchanged. Named for what it is,
// never for the button's label ("Roll"); nothing to do with `yaw` (a mesh's alignment correction). It replaced `tiltZ`
// on 2026-10-12 (one angle about the thing's own front-to-back axis, 2026-10-11): `tiltZ` is still TAKEN as an argument
// (an old client, an AI seat, a journal line) and stored as the quat it means; saved things are converted on load
// (core/migrate.js migrateTilts). The renderer keeps the thing's lowest point where it was (client/world.js seatTilt):
// `y` stays the height of what it rests on. Furniture only: not a stair, a ladder, a floor tile or a wall piece.
export const tiltOf = (v) => { if (!Number.isFinite(v)) return 0; const t = Math.atan2(Math.sin(v), Math.cos(v)), r = Math.round(t * 1e4) / 1e4; return Math.abs(r) < 1e-3 ? 0 : r; };
const quatArg = (a) => a.quat !== undefined ? quatOf(a.quat) : a.tiltZ !== undefined ? quatFromTiltZ(a.tiltZ) : null; // the orientation an argument list asks for (null: upright, or not said)
export const canTilt = (e) => !!e && e.kind !== 'token' && !['stair', 'tile', 'kit'].includes(e.place) && !e.fromEdge && !isConnector({ ...e, kind: 'object' }); // (nor a stair that is furniture: it opens the floor above where it stands)
const objectFrom = (a, extra = {}) => ({
  id: a.id, kind: 'object', name: a.name || a.cat || 'object', cat: a.cat || null, sku: a.sku || null, url: a.url || null, flat: !!a.flat,
  place: a.place || 'floor', layer: a.layer || 'furnish', x: a.x, y: a.y || 0, z: a.z, rot: a.rot || 0, yaw: a.yaw || 0,
  s: a.s || null, dims: a.dims || [2, 2, 2], room: a.room || null, parent: a.parent || null, color: a.color || null,
  ...(a.flavor && a.flavor !== 'inherit' && { flavor: a.flavor }), ...(a.factionMissing && { factionMissing: true, factionWasHidden: !!a.factionWasHidden }), hidden: !!a.hidden, locked: false, pinned: !!a.pinned, open: false, rule: a.rule || null, orient: a.orient || null, lit: a.lit ?? true, ...(quatArg(a) && canTilt(a) && { quat: quatArg(a) }), ...(a.fromEdge && { fromEdge: a.fromEdge }), ...(a.place === 'stair' && { rise: a.rise || 10, ...(a.stair && { stair: a.stair }) }),
  // a stair of the catalog (core/stairs.js STAIR_ROLES): `down` = it was put in for the level at its TOP; `rise` only when it is not the piece's own
  ...(a.place !== 'stair' && a.down && { down: true }), ...(a.place !== 'stair' && a.rise && a.rise !== 10 && { rise: a.rise }), ...extra,
});
const buildingRooms = (t, id) => t ? Object.values(t.entities).filter(e => e.kind === 'room' && e.building === id) : [];
const roomObjects = (t, id) => t ? Object.values(t.entities).filter(e => e.kind === 'object' && e.room === id) : [];
const layoutObjectsOk = (t, L) => {
  if (!L || typeof L.hash !== 'string' || !Array.isArray(L.objects)) return 'layout must be {hash, summary, objects}';
  for (const o of L.objects) { if (!isId(o.id)) return 'layout object ids must be ids'; if (t.entities[o.id]) return `id ${o.id} already exists`; }
  return null;
};

// a pawn's extras (the ring's sheet card and indicators, Harry 2026-10-06): sheet = its character-sheet link (http/https
// only), notes = shared text, gmNotes = text the player side NEVER receives (core/labels.js strips it, as it strips room
// labels), mark = one of the eight indicators (core/pawn.js MARKS). Absent = none.
const NOTE_MAX = 4000;
const pawnExtrasProblem = (state, by, a) => a.gmNotes !== undefined && !isGmSide(state, by) ? 'GM notes are the GM\'s' : a.sheet !== undefined && sheetProblem(a.sheet) ? sheetProblem(a.sheet) : a.mark !== undefined && a.mark !== '' && !MARK_KEYS.includes(a.mark) ? `mark: one of ${MARK_KEYS.join(', ')} (or empty to clear)` : null;
const withExtras = (e, a) => { const n = { ...e }; for (const k of ['sheet', 'notes', 'gmNotes', 'mark']) if (a[k] !== undefined) { if (a[k]) n[k] = a[k]; else delete n[k]; } return n; };
// LEGACY (before 2026-10-06 a pawn carried hp and hpMax): `hp` / `hpMax` are still in the argument lists of token.create
// and token.set ONLY so that an old journal replays exactly as it was written (apply runs on replay; check does not).
// A live command that sends them is refused. The relay turns every old pawn into damage once a campaign has loaded
// (core/migrate.js migratePawns: damage = hpMax - hp where both exist, else 0).
const LEGACY_HP = 'pawns count damage now, up from 0 (0 = unhurt): send token.damage, not hp (reload the page if you did not type this)';
const damageProblem = (v) => v !== undefined && (v < 0 || v > DAMAGE_LIMIT) ? `damage is 0 to ${DAMAGE_LIMIT}` : null;
const withDamage = (e, damage) => { const { damage: _, ...n } = e; return damage > 0 ? { ...n, damage } : n; };
// A PAWN'S FIGURE (2026-10-06): `fig` is the id of a figure in the figure library (tools/spawn-tuner/data/figures.json);
// absent = the plain stand-in. `size` is how many 5-ft squares a side its base covers (absent = 1; a large creature 2).
// Both are plain pawn data: every seat that sees the pawn sees its figure. The core only checks their shape; which
// ids exist is the library's business (the relay checks an AI seat's ids against it: relay/llm.js).
const FIG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const figProblem = (a) => a.fig && !FIG_RE.test(a.fig) ? 'fig: a figure id (lower-case letters, digits and dashes), or none' : a.size != null && !(a.size >= 1 && a.size <= 4) ? 'size: squares a side, 1 to 4' : null;
// Room hiding is one command, including its pawns. The relay records the player owners so journal
// replay and reducers need no campaign state; callers cannot supply this private argument (parseArgs drops it).
export const HIDE_ROOM_HIDES_PLAYER_PAWNS = false;
const playerOwners = (seats) => Object.values(seats || {}).filter(s => (s.kind === 'llm' ? Object.values(seats || {}).find(p => p.id === s.creator) : s)?.role === 'player').map(s => s.id);
const playerPawn = (e, owners) => !!e?.owner && (owners ? owners.includes(e.owner) : true);
const hideRooms = (t, ids) => new Set(ids.flatMap(id => t.entities[id]?.kind === 'building' ? buildingRooms(t, id).map(r => r.id) : t.entities[id]?.kind === 'room' ? [id] : []));
// The client uses this same membership/ownership rule for the GM's one-line exception note.
export const roomPlayerPawns = (area, ids, seats) => {
  const rooms = hideRooms(area, ids), owners = playerOwners(seats);
  return Object.values(area.entities).filter(e => e.kind === 'token' && playerPawn(e, owners) && rooms.has(tokenFloor(area.entities, e).room));
};
export function prepareRoomHiding(state, type, args) {
  if (type === 'batch') return { ...args, ops: args.ops.map(op => ({ ...op, args: prepareRoomHiding(state, op.type, op.args) })) };
  if (type === 'pawn.bring' && state.pawns?.[args.def]) args = REGISTRY[type].fill(state, args);
  return ['entity.flag', 'token.create', 'token.move', 'pawn.bring'].includes(type) ? { ...args, _roomPlayerOwners: playerOwners(state.seats) } : args;
}
export const pawnIntoRoom = (t, e, a) => {
  const room = tokenFloor(t.entities, e).room;
  let next = e;
  // Leaving stays hidden, but is now the GM's independent ambush pawn, no longer revealed with the old room.
  if (e.hiddenByRoom && e.hiddenByRoom !== room) { next = { ...e }; delete next.hiddenByRoom; }
  if (!next.hidden && room && t.entities[room]?.hidden && (HIDE_ROOM_HIDES_PLAYER_PAWNS || !playerPawn(next, a._roomPlayerOwners))) next = { ...next, hidden: true, hiddenByRoom: room };
  return next;
};
const movedPawn = (t, a) => pawnIntoRoom(t, { ...t.entities[a.id], x: a.x, z: a.z, ...(a.rot != null && { rot: a.rot }), ...(a.y != null && { y: a.y }) }, a);
const pawnMoveTargets = (t, a) => [a.id, ...(t && !t.entities[a.id]?.hidden && movedPawn(t, a).hidden ? Object.values(t.entities).filter(e => e.kind === 'template' && e.attach === a.id && !e.hidden).map(e => e.id) : [])];
const mainsOf = (t, owner, except) => Object.values(t.entities).filter(o => o.kind === 'token' && o.main && o.owner === owner && o.id !== except);
def('token.create', {
  level: 'area', cls: 'token.edit',
  args: { id: 'id', name: 'str', x: 'num', z: 'num', y: 'num?', rot: 'num?', color: 'color?', owner: 'id?', damage: 'int?', hp: 'int?', hpMax: 'int?', hidden: 'bool?', conditions: 'list?', sheet: 'text?', notes: 'long?', gmNotes: 'long?', mark: 'str?', fig: 'str?', size: 'int?', main: 'bool?', def: 'id?', initBonus: 'int?', visionRadius: 'numOrNone?', darkvision: 'numOrNone?', lightCarried: 'numOrNone?' }, // def: the cast entry (or a player's definition) it was placed from
  check: ({ state, area, by }, a) => area.entities[a.id] ? `id ${a.id} already exists` : a.owner && !state?.seats[a.owner] ? `unknown owner ${a.owner}` : a.hp !== undefined || a.hpMax !== undefined ? LEGACY_HP : damageProblem(a.damage) || (a.visionRadius != null && a.visionRadius < 0 ? 'vision radius must be nonnegative or null (unlimited)' : null) || pawnDarkProblem(a) || pawnExtrasProblem(state, by, a) || figProblem(a),
  apply: (t, a) => put(t, pawnIntoRoom(t, withExtras({ id: a.id, kind: 'token', name: a.name, x: a.x, z: a.z, ...(a.y && { y: a.y }), rot: a.rot || 0, color: a.color || '#d9a441', owner: a.owner || null, ...(a.damage > 0 && { damage: a.damage }), ...((a.hp !== undefined || a.hpMax !== undefined) && { hp: a.hp ?? null, hpMax: a.hpMax ?? a.hp ?? null }), conditions: a.conditions || [], hidden: !!a.hidden, locked: false, ...(a.fig && a.fig !== 'none' && { fig: a.fig }), ...(a.size > 1 && { size: a.size }), ...(a.main && { main: true }), ...(Number.isInteger(a.initBonus) && Math.abs(a.initBonus) <= TU.BONUS_MAX && { initBonus: a.initBonus }), ...(a.def && { def: a.def }), ...(a.visionRadius != null && {visionRadius:a.visionRadius}), ...(a.darkvision != null && { darkvision: a.darkvision }), ...(a.lightCarried != null && { lightCarried: a.lightCarried }) }, a), a)),
  touches: (a) => [a.id],
});
def('token.move', {
  level: 'area', cls: 'token.move',
  args: { id: 'id', x: 'num', z: 'num', rot: 'num?', y: 'num?' },
  check: ({ state, area, by }, a) => {
    const e = ent(area, a.id, 'token');
    if (!e) return `no token ${a.id} in this area`;
    const who = principalOf(state, by);
    if (who.role !== 'gm' && e.owner !== who.id) return `${e.name} belongs to someone else`;
    return null; // (a pawn has no lock since 2026-10-11: PAWN LOCK IS DROPPED, see unlockPawn below)
  },
  apply: (t, a) => {
    let next = put(t, movedPawn(t, a));
    // An attached visible template must not disclose the newly hidden pawn's id or its destination.
    for (const id of pawnMoveTargets(t, a).slice(1)) next = put(next, { ...t.entities[id], hidden: true });
    return next;
  }, // y is in feet; room membership is derived (core/height.js)
  touches: (a, t) => pawnMoveTargets(t, a),
});
// a pawn's own sheet-ish fields: label, conditions, facing, its sheet link and notes. Players may edit their own pawns.
// (Damage is token.damage, below: everyone's. hp / hpMax here are legacy, for replay only.)
def('token.set', {
  level: 'area', cls: 'pawn',
  // fig: another figure ('none' = back to the plain stand-in); size: its base, in squares a side
  // main: this is its player's MAIN pawn (it wears the full-detail figure). One per seat: marking a pawn unmarks the
  // seat's other pawns in the area, in the same command (so one undo puts both back). Nobody's pawn can be marked too.
  // initBonus: the pawn's initiative bonus, the one piece of system data held (core/turns.js); null takes it away
  args: { id: 'id', name: 'str?', hp: 'int?', hpMax: 'int?', conditions: 'list?', rot: 'num?', color: 'color?', sheet: 'text?', notes: 'long?', gmNotes: 'long?', fig: 'str?', size: 'int?', main: 'bool?', initBonus: 'intOrNone?', visionRadius: 'numOrNone?', darkvision: 'numOrNone?', lightCarried: 'numOrNone?' }, // darkvision / lightCarried: ft in a dark area (core/darkness.js); null = the default
  check: ({ state, area, by }, a) => {
    const e = ent(area, a.id, 'token');
    if (!e) return `no token ${a.id} in this area`;
    if (!ownsOrGm(state, by, e)) return `${e.name} belongs to someone else`;
    if (a.conditions && !a.conditions.every(c => typeof c === 'string' && c.length <= 24)) return 'conditions are short words';
    if (a.name !== undefined && !a.name.trim()) return 'a pawn needs a name';
    if (a.hp !== undefined || a.hpMax !== undefined) return LEGACY_HP;
    if (a.initBonus != null && Math.abs(a.initBonus) > TU.BONUS_MAX) return `an initiative bonus is -${TU.BONUS_MAX} to ${TU.BONUS_MAX}`;
    if (a.visionRadius != null && a.visionRadius < 0) return 'vision radius must be nonnegative or null (unlimited)';
    return pawnDarkProblem(a) || pawnExtrasProblem(state, by, a) || figProblem(a);
  },
  apply: (t, a) => {
    const { id, sheet, notes, gmNotes, fig, size, main, initBonus, visionRadius, darkvision, lightCarried, ...rest } = a; let e = { ...t.entities[id], ...rest };
    e = withDarkFields(e, a);
    if (visionRadius !== undefined) { if (visionRadius === null) delete e.visionRadius; else e.visionRadius = visionRadius; }
    if (initBonus !== undefined) { if (initBonus === null) delete e.initBonus; else e.initBonus = initBonus; }
    if (main != null) { if (main) e.main = true; else delete e.main; }
    if (main && e.owner) for (const o of mainsOf(t, e.owner, id)) { const { main: _m, ...x } = o; t = put(t, x); }
    if (fig != null) { if (fig !== 'none') e.fig = fig; else delete e.fig; }
    if (size != null) { if (size > 1) e.size = size; else delete e.size; }
    return put(t, withExtras(e, a));
  },
  touches: (a, area) => a.main && area?.entities[a.id]?.owner ? [a.id, ...mainsOf(area, area.entities[a.id].owner, a.id).map(o => o.id)] : [a.id],
});
// EVERYONE CAN CHANGE EVERYONE'S DAMAGE (Harry 2026-10-06: "I also kind of think everyone can change everyones HP by
// default, and it comes with an undo float"; the same day the number became damage, counted up from 0). So this is its
// own command with no owner check: any seat that may edit pawns at all may set the damage of any pawn it can see. Each
// change leaves an undo for the changer, the pawn's owner and the GM (core/pawn.js seesDamageUndo; relay doUndo).
def('token.damage', {
  level: 'area', cls: 'pawn', args: { id: 'id', damage: 'int' },
  check: ({ area }, a) => !ent(area, a.id, 'token') ? `no token ${a.id} in this area` : damageProblem(a.damage),
  apply: (t, a) => put(t, withDamage(t.entities[a.id], a.damage)),
  touches: (a) => [a.id],
});
// AN INDICATOR over a pawn (core/pawn.js MARKS): anyone may point at anything ("this one"), so no owner check. '' clears.
def('token.mark', {
  level: 'area', cls: 'pawn', args: { id: 'id', mark: 'str?' },
  check: ({ area }, a) => !ent(area, a.id, 'token') ? `no token ${a.id} in this area` : a.mark && !MARK_KEYS.includes(a.mark) ? `mark: one of ${MARK_KEYS.join(', ')} (or none to clear)` : null,
  apply: (t, a) => put(t, withExtras(t.entities[a.id], { mark: a.mark || '' })),
  touches: (a) => [a.id],
});
// GIVE CONTROL of a pawn to a player (the GM's chore): owner = a seat, or none (the GM's own)
def('token.owner', {
  level: 'area', cls: 'token.edit', args: { id: 'id', owner: 'idOrNone' },
  check: ({ state, area }, a) => !ent(area, a.id, 'token') ? `no token ${a.id} in this area` : a.owner && !state?.seats[a.owner] ? `unknown seat ${a.owner}` : a.owner && state.seats[a.owner].kind === 'llm' ? 'give a pawn to a person (their agents act for them)' : null,
  apply: (t, a) => { const { lender, ...e } = t.entities[a.id]; return put(t, { ...e, owner: a.owner || null }); }, // (the GM's word ends a loan: token.lend)
  touches: (a) => [a.id],
});
def('token.delete', {
  level: 'area', cls: 'token.edit', args: { id: 'id' },
  check: ({ area }, a) => ent(area, a.id, 'token') ? null : `no token ${a.id}`,
  apply: (t, a) => drop(t, a.id), touches: (a) => [a.id],
});

// TURN ORDER AND INITIATIVE (Harry 2026-10-06; docs/PAWNS.md; the rules are core/turns.js). The order is area state,
// `area.turns`, beside the chat. Class `turn`: every seat holds it; what a PLAYER may do with it is said per command.
//   turn.start { order? }   GM   "Start fight": a new order (the default: owners' pawns by name, then the kinds)
//   turn.end {}             GM   "End fight": the order goes
//   turn.next / turn.prev   GM; the owner of the pawn whose turn it is may send turn.next (end my turn)
//   turn.order { order }    GM   the order as dragged; with no order yet it makes one (no fight needed)
//   turn.at { key }         GM   the marker onto an entry
//   turn.init { key, n }    the number for an entry (n: null takes it away). GM: any entry. A player: her own pawn.
// PLAYER SEATS NEVER RECEIVE THESE AS SENT: the relay sends them `turn.view` with what they may see (core/turns.js
// forPlayers), so an entry of hidden pawns is in nothing a player's connection carries.
// MEASURING TEMPLATES (Harry and Fauna 2026-10-11; docs/RULERS.md; the geometry is core/measure.js). A plain ruler is
// never a command: it is presence, and gone when it is let go. A KEPT template is an entity like any other thing, so
// it is in the log, in the saved campaign, in a snapshot, and its undo is the ordinary one (the entity as it was):
//   template { id, kind:'template', shape, x, z, y, dir, size, width?, owner, rounds?, left?, attach?, src?, name?, hidden }
//     owner    the seat that placed it (written here from who sent it, never from the arguments)
//     rounds   it lasts this many rounds: it has a row in the turn order and counts down (core/turns.js); absent = kept
//     left     rounds left, once a fight has counted any (absent = all of them); 0 = expired, waiting for Remove / Keep
//     attach   a pawn it travels with (an aura); src: the pawn it was cast from (where its row sits in the order)
//     hidden   the GM side's only: a template on a hidden pawn or in a hidden room MUST be hidden (refused otherwise),
//              and the relay then sends no word of it to a player seat, as with any hidden thing
// Class `template`, which players hold: anyone may place one anywhere in an area they can see; its owner and the GM
// side change and remove it.
const TPL_SHAPE = `enum:${MS.SHAPES.join('|')}`;
const tplOwns = (state, by, e) => isGmSide(state, by) || (!!e.owner && (e.owner === by || principalOf(state, e.owner)?.id === principalOf(state, by)?.id)); // (a person and their agents are one owner)
const tplProblem = (a) => a.size !== undefined && !(a.size > 0 && a.size <= MS.SIZE_MAX) ? `size: more than 0, at most ${MS.SIZE_MAX} ft`
  : a.width !== undefined && !(a.width > 0 && a.width <= MS.WIDTH_MAX) ? `width: more than 0, at most ${MS.WIDTH_MAX} ft`
  : a.rounds != null && !(a.rounds >= 0 && a.rounds <= MS.ROUNDS_MAX) ? `rounds: 1 to ${MS.ROUNDS_MAX} (0 = kept until removed)`
  : a.y !== undefined && Math.abs(a.y) > MAX_Y ? 'y: out of range' : null;
// what must be hidden: a template riding a hidden pawn, or standing in a hidden room
const tplMustHide = (area, e) => { const p = e.attach && area.entities[e.attach]; if (p?.kind === 'token' && p.hidden) return true; if (p?.kind === 'token') return false; const f = floorUnder(area.entities, e.x, e.z, e.y || 0); return !!(f && area.entities[f.room]?.hidden); };
const tplHideProblem = (state, by, area, e) => !isGmSide(state, by) ? (e.hidden ? 'hiding a template is the GM\'s' : null) : tplMustHide(area, e) && !e.hidden ? 'a template on a hidden pawn or in a hidden room must be hidden too: send hidden=true' : null;
const tplPawn = (state, by, area, id, what) => { const p = id && area.entities[id]; return !id ? null : !p || p.kind !== 'token' || (p.hidden && !isGmSide(state, by)) ? `no pawn ${id} in this area` : null; };
const tplFrom = (a, by) => ({ id: a.id, kind: 'template', shape: a.shape, x: a.x, z: a.z, y: a.y || 0, dir: a.dir || 0, size: a.size, ...(a.shape === 'line' && a.width && a.width !== MS.LINE_WIDTH && { width: a.width }), owner: by || null,
  ...(a.rounds > 0 && { rounds: a.rounds }), ...(a.attach && { attach: a.attach }), ...(a.src && { src: a.src }), ...(a.name && { name: a.name }), hidden: !!a.hidden, locked: false });
const TPL_PER_AREA = 200;
def('template.place', {
  level: 'area', cls: 'template',
  args: { id: 'id', keepSession: 'str?', shape: TPL_SHAPE, x: 'num', z: 'num', y: 'num?', dir: 'num?', size: 'num', width: 'num?', rounds: 'int?', attach: 'id?', src: 'id?', name: 'str?', hidden: 'bool?' },
  check: ({ state, area, by }, a) => !a.id.startsWith(TU.TPL) ? 'a template\'s id starts with tpl_' : area.entities[a.id] ? `id ${a.id} already exists` : tplProblem(a) || tplPawn(state, by, area, a.attach, 'attach') || tplPawn(state, by, area, a.src, 'src')
    || (Object.values(area.entities).filter(e => e.kind === 'template').length >= TPL_PER_AREA ? `an area holds at most ${TPL_PER_AREA} templates (the GM can clear them)` : null) || tplHideProblem(state, by, area, tplFrom(a, by)),
  apply: (t, a, meta = {}) => { const e = tplFrom(a, meta.by), n = put(t, e); return t.turns ? { ...n, turns: TU.withTemplate(n, t.turns, e) } : n; }, // (in a fight, one that lasts rounds takes its row at once)
  touches: (a) => [a.id],
  inverse: (t, a) => ({ type: 'entities.set', args: { set: { [a.id]: null } } }),
});
// change one: move it, turn it, resize it, make it another shape, give it rounds (0 = none: kept until removed; a new
// number starts the count again), attach it to a pawn or let it go (attach: '').
def('template.set', {
  level: 'area', cls: 'template',
  args: { id: 'id', keepSession: 'str?', shape: `${TPL_SHAPE}?`, x: 'num?', z: 'num?', y: 'num?', dir: 'num?', size: 'num?', width: 'num?', rounds: 'int?', attach: 'idOrNone?', name: 'str?', hidden: 'bool?' },
  check: ({ state, area, by }, a) => {
    const e = ent(area, a.id, 'template');
    if (!e) return `no ${a.id} in this area`;
    if (!tplOwns(state, by, e)) return 'that template is someone else\'s (its owner or the GM changes it)';
    return tplProblem(a) || tplPawn(state, by, area, a.attach, 'attach') || tplHideProblem(state, by, area, tplSet(e, a));
  },
  apply: (t, a) => { const e = tplSet(t.entities[a.id], a), n = put(t, e); return t.turns ? { ...n, turns: TU.withTemplate(n, t.turns, e) } : n; },
  touches: (a) => [a.id],
});
function tplSet(e0, a) {
  const e = { ...e0 };
  for (const k of ['shape', 'x', 'z', 'y', 'dir', 'size', 'name', 'hidden']) if (a[k] !== undefined) e[k] = a[k];
  if (a.width !== undefined) { if (a.width !== MS.LINE_WIDTH) e.width = a.width; else delete e.width; }
  if (e.shape !== 'line') delete e.width;
  if (a.rounds !== undefined) { delete e.left; if (a.rounds > 0) e.rounds = a.rounds; else delete e.rounds; }
  if (a.attach !== undefined) { if (a.attach) e.attach = a.attach; else delete e.attach; }
  return e;
}
def('template.delete', {
  level: 'area', cls: 'template', args: { id: 'id' },
  check: ({ state, area, by }, a) => { const e = ent(area, a.id, 'template'); return !e ? `no ${a.id} in this area` : tplOwns(state, by, e) ? null : 'that template is someone else\'s (its owner or the GM removes it)'; },
  apply: (t, a) => drop(t, a.id), touches: (a) => [a.id],
});
// the GM's broom: every template in the area goes (one undo brings them all back)
def('template.clear', {
  level: 'area', cls: 'template', args: {},
  check: ({ state, area, by }) => !isGmSide(state, by) ? 'clearing every template is the GM\'s' : Object.values(area.entities).some(e => e.kind === 'template') ? null : 'there are no templates here',
  apply: (t) => ({ ...t, entities: Object.fromEntries(Object.entries(t.entities).filter(([, e]) => e.kind !== 'template')) }),
  touches: (a, t) => t ? Object.values(t.entities).filter(e => e.kind === 'template').map(e => e.id) : [],
});

// Undo: Start, End and a drag put the order back as it was (the GM's); a number goes back to the number before; Next
// and Previous leave no undo (the other key is the undo).
const noTurns = 'there is no turn order here (the GM starts one: "start fight")';
const gmOnly = (state, by, what) => isGmSide(state, by) ? null : `${what} is the GM's`;
const turnsBack = (t) => ({ type: 'turn.view', args: { turns: t.turns || null } });
const withTurns = (t, turns) => { if (turns) return { ...t, turns }; const { turns: _, ...rest } = t; return rest; };
def('turn.start', {
  level: 'area', cls: 'turn', args: { order: 'keys?' },
  check: ({ state, by }, a) => gmOnly(state, by, 'starting a fight') || (a.order ? TU.orderProblem(a.order) : null),
  apply: (t, a) => withTurns(t, TU.withTemplates(t, TU.newTurns(a.order || TU.defaultOrder(t)))), // (templates that last rounds get their rows: core/turns.js)
  inverse: turnsBack,
});
def('turn.end', {
  level: 'area', cls: 'turn', args: {},
  check: ({ state, area, by }) => gmOnly(state, by, 'ending a fight') || (area.turns ? null : noTurns),
  apply: (t) => withTurns(t, null),
  inverse: turnsBack,
});
const mayStep = (state, area, by) => { if (isGmSide(state, by)) return true; const at = area.turns?.at, e = at && area.entities[at]; return !!e && !!e.owner && e.owner === principalOf(state, by)?.id; };
def('turn.next', {
  level: 'area', cls: 'turn', args: {},
  check: ({ state, area, by }) => !area.turns ? noTurns : mayStep(state, area, by) ? null : 'it is not your turn (the GM, or whoever\'s turn it is, moves on)',
  apply: (t) => t.turns ? TU.advance(t, 1) : t, // (the templates it passes count down: core/turns.js advance)
  touches: (a, t) => TU.tickTouches(t), incidental: true, stale: 'apply', // (what it touches is a consequence, not its target: a hidden template never refuses a player's "end my turn")
  inverse: () => null,
});
def('turn.prev', {
  level: 'area', cls: 'turn', args: {},
  check: ({ state, area, by }) => gmOnly(state, by, 'going back a turn') || (area.turns ? null : noTurns),
  apply: (t) => t.turns ? TU.advance(t, -1) : t,
  touches: (a, t) => TU.tickTouches(t), incidental: true, stale: 'apply', // (what it touches is a consequence, not its target: a hidden template never refuses a player's "end my turn")
  inverse: () => null,
});
def('turn.order', {
  level: 'area', cls: 'turn', args: { order: 'keys' },
  check: ({ state, by }, a) => gmOnly(state, by, 'the turn order') || TU.orderProblem(a.order),
  apply: (t, a) => withTurns(t, TU.reorder(t.turns, a.order)),
  inverse: turnsBack,
});
def('turn.at', {
  level: 'area', cls: 'turn', args: { key: 'key' },
  check: ({ state, area, by }, a) => gmOnly(state, by, 'the turn marker') || (!area.turns ? noTurns : area.turns.order.includes(a.key) ? null : `${a.key} is not in the turn order`),
  apply: (t, a) => t.turns ? withTurns(t, { ...t.turns, at: a.key }) : t,
  inverse: () => null,
});
def('turn.init', {
  level: 'area', cls: 'turn', args: { key: 'key', n: 'intOrNone' },
  check: ({ state, area, by }, a) => {
    if (!area.turns) return noTurns;
    if (a.n != null && (a.n < TU.INIT_MIN || a.n > TU.INIT_MAX)) return `an initiative number is ${TU.INIT_MIN} to ${TU.INIT_MAX}`;
    const ps = TU.keyPawns(area, area.turns, a.key);
    if (!isGmSide(state, by)) { // a player: her own pawn, by its id (and never a word about a pawn she cannot see)
      const e = ps[0];
      if (a.key.startsWith(TU.KIND) || !e || e.hidden) return `no pawn ${a.key} in this area`;
      if (e.owner !== principalOf(state, by)?.id) return `${e.name} belongs to someone else`;
    }
    if (!ps.length && !area.turns.order.includes(a.key)) return `no pawn for ${a.key} in this area`;
    return null;
  },
  apply: (t, a) => t.turns ? withTurns(t, TU.setInit(t, t.turns, a.key, a.n ?? null)) : t,
  inverse: (t, a) => t.turns ? { type: 'turn.init', args: { key: a.key, n: t.turns.init[a.key] ?? null } } : null,
});
// what a seat holds of the order, whole (the relay sends it to player seats in place of every turn.* command; it is
// also what an undo of Start, End or a drag applies). turns: null = no order.
// set: the templates a Next or Previous changed, as the receiving seat may see them (null = gone): a player seat gets
// no turn.next, so what it did to the templates travels here (relay/campaign.js entryFor).
def('turn.view', {
  level: 'area', cls: 'undo', args: { turns: 'obj?', set: 'obj?' }, quiet: true, internal: true, stale: 'apply',
  apply: (t, a) => { if (a.set) { const entities = { ...t.entities }; for (const [id, e] of Object.entries(a.set)) if (e) entities[id] = e; else delete entities[id]; t = { ...t, entities }; } return withTurns(t, a.turns || null); },
  inverse: turnsBack,
});

// STAIRS (core/stairs.js): an object of the lower room with place 'stair' and a rise in feet. It is hidden from players
// when EITHER room it joins is hidden (a stair up to a secret attic, or down to a secret cellar, would give it away;
// players then see a whole floor: the hole is worked out from the stairs a seat has).
const stairProblem = (a) => a.rise != null && !(a.rise % STEP === 0 && a.rise >= 5 && a.rise <= 60) ? `rise: feet, a multiple of ${STEP} from 5 to 60` : a.dims && !(a.dims[0] <= 20 && a.dims[2] <= 40) ? 'a stair is at most 20 ft wide and 40 ft long' : null;
const stairVeiled = (t, s, shown = null, veiled = null) => { const L = stairLinks(t.entities, s); return [s.room || L.from, L.to].some(id => id && !shown?.has(id) && (veiled?.has(id) || t.entities[id]?.hidden)); };
def('object.place', {
  level: 'area', cls: 'object',
  args: { id: 'id', x: 'num', z: 'num', ...OBJ_ARGS },
  check: ({ area }, a) => area.entities[a.id] ? `id ${a.id} already exists` : a.room && !ent(area, a.room, 'room') ? `no room ${a.room}` : a.place === 'stair' || a.rise != null ? stairProblem(a) : null,
  apply: (t, a) => put(t, objectFrom(a, (a.room && t.entities[a.room]?.hidden) || (isPlacedStair(objectFrom(a)) && stairVeiled(t, objectFrom(a))) ? { hidden: true } : {})), // a thing put into a hidden room is hidden with it (a stair: with either room it joins)
  touches: (a) => [a.id],
});
def('object.move', {
  level: 'area', cls: 'object', args: { id: 'id', x: 'num', z: 'num', y: 'num?', rot: 'num?', parent: 'idOrNone?', room: 'idOrNone?' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : e.locked ? `${e.name} is locked` : null; },
  apply: (t, a) => {
    const e = t.entities[a.id];
    return put(t, { ...e, x: a.x, z: a.z, y: a.y ?? e.y, rot: a.rot ?? e.rot, ...(a.parent !== undefined && { parent: a.parent || null }), ...(a.room !== undefined && { room: a.room || null }) });
  },
  touches: (a) => [a.id],
});
def('object.set', {
  level: 'area', cls: 'object', args: { id: 'id', name: 'str?', s: 'vec3?', dims: 'vec3?', tiltZ: 'num?', quat: 'quat?', lightRadius: 'numOrNone?' }, // lightRadius: the GM's own reach for a light in a dark area (core/darkness.js); null = its kind's
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : e.locked ? `${e.name} is locked` : feetProblem(a.lightRadius, LIGHT_RADIUS_MAX, 'a light radius') || (a.quat !== undefined || a.tiltZ !== undefined) && quatArg(a) && !canTilt(e) ? 'a stair, a ladder, a floor tile or a wall piece cannot be tilted' : null; },
  apply: (t, a) => { // quat: its whole orientation under the Turn; [0, 0, 0, 1] = upright again (the field is removed). tiltZ: the old way to say it
    const { id, tiltZ, quat, lightRadius, ...rest } = a, e = withDarkFields({ ...t.entities[id], ...rest }, a, ['lightRadius']);
    if (quat !== undefined || tiltZ !== undefined) { const q = quatArg(a); delete e.tiltZ; if (q) e.quat = q; else delete e.quat; }
    return put(t, e);
  },
  touches: (a) => [a.id],
});
def('object.open', {
  level: 'area', cls: 'open', args: { id: 'id', open: 'bool' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : e.locked ? `${e.name} is locked` : null; },
  apply: (t, a) => put(t, { ...t.entities[a.id], open: a.open }),
  touches: (a) => [a.id],
});
// light or put out a fireplace, candle, lantern… (the fire FX follows `lit` in every tab). Players may (class 'open').
def('object.light', {
  level: 'area', cls: 'open', args: { id: 'id', lit: 'bool' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : e.locked ? `${e.name} is locked` : null; },
  apply: (t, a) => put(t, { ...t.entities[a.id], lit: a.lit }),
  touches: (a) => [a.id],
});
// replace with a similar asset (another sku of the same catalog object, or a sibling object), keeping place and pose
def('object.replace', {
  level: 'area', cls: 'object', args: { id: 'id', cat: 'str', sku: 'str?', url: 'url?', flat: 'bool?', s: 'vec3?', dims: 'vec3?', yaw: 'num?', name: 'str?' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : e.locked ? `${e.name} is locked` : null; },
  apply: (t, a) => { const { id, ...rest } = a, e = t.entities[id]; if (e.place === 'stair') { delete rest.s; delete rest.dims; delete rest.yaw; } return put(t, { ...e, ...rest }); }, // (a stair keeps its own box: its rise and run)
  touches: (a) => [a.id],
});
// STAIRS UP / STAIRS DOWN (core/stairs.js "UP OR DOWN"): the same piece, in the same place in plan, moved one flight so
// that it leads the other way from a level. y: its new height; down: whether its home level is now the one at its top.
// The hole and the railing are worked out from where it stands, so they move with it; undo puts it back.
def('stair.flip', {
  level: 'area', cls: 'object', args: { id: 'id', y: 'num', down: 'bool' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : !isConnector(e) ? `${e.name} is not a stair` : e.locked ? `${e.name} is locked` : Math.abs(Math.abs(a.y - (e.y || 0)) - stairRise(e)) > 0.01 ? 'a stair switches by exactly its own rise' : null; },
  apply: (t, a) => {
    const { down, ...e } = t.entities[a.id], room = stairRoomAt(t.entities, e, a.y), next = { ...e, y: a.y, room, ...(a.down && { down: true }) };
    return put(t, { ...next, hidden: !!e.hidden || !!(room && t.entities[room]?.hidden) || (isPlacedStair(next) && stairVeiled(t, next)) }); // (it never comes OUT of hiding by being switched)
  },
  touches: (a) => [a.id],
});
def('object.delete', {
  level: 'area', cls: 'object', args: { id: 'id' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'object'); return !e ? `no object ${a.id}` : e.locked ? `${e.name} is locked` : null; },
  apply: (t, a) => { // things resting on it fall to the floor with it gone (parent cleared)
    let out = drop(t, a.id);
    for (const e of Object.values(out.entities)) if (e.kind === 'object' && e.parent === a.id) out = put(out, { ...e, parent: null });
    return out;
  },
  touches: (a, t) => [a.id, ...(t ? Object.values(t.entities).filter(e => e.parent === a.id).map(e => e.id) : [])],
});
// flags on many things at once: hidden (GM: 'reveal'), locked and pinned (GM: 'object')
// HIDING A ROOM hides the whole of it (Harry 2026-10-05): the room, everything in it and the wall edits only it owns, so
// nothing of it is sent to the player side (the relay filters hidden entities; labels never travel anyway). A building
// hides as its rooms. Revealing does the reverse. The cascade lives here, in the command, so an LLM seat that flags only
// the room id gets the same result as the ring's button.
const flagTargets = (t, a) => {
  if (a.hidden === undefined || !t) return a.ids;
  const out = new Set(a.ids);
  for (const id of a.ids) if (t.entities[id]?.kind === 'building') for (const r of buildingRooms(t, id)) out.add(r.id);
  const rooms = new Set([...out].filter(id => t.entities[id]?.kind === 'room'));
  for (const id of rooms) {
    for (const o of roomObjects(t, id)) if (!isPlacedStair(o)) out.add(o.id);
    for (const eid of lonelyEdges(t, id)) out.add(eid);
    // its stairs, up and down: hidden with either room; shown again only when neither room it joins stays hidden
    for (const { stair: s } of stairsTouching(t.entities, t.entities[id])) if (isPlacedStair(s) && (a.hidden ? true : !stairVeiled(t, s, rooms))) out.add(s.id); // (a stair the room's layout rolled is furniture of the room it stands in: hidden and shown with that room only)
  }
  for (const e of Object.values(t.entities)) if (e.kind === 'token' && !out.has(e.id)) {
    const room = tokenFloor(t.entities, e).room;
    if (a.hidden ? rooms.has(room) && !e.hidden && (HIDE_ROOM_HIDES_PLAYER_PAWNS || !playerPawn(e, a._roomPlayerOwners))
      : e.hiddenByRoom && rooms.has(e.hiddenByRoom) && room === e.hiddenByRoom) out.add(e.id);
  }
  // templates (docs/RULERS.md): one whose origin stands on a room's floor is hidden and shown with that room; an aura
  // is hidden and shown with the pawn it is attached to
  if (t) for (const e of Object.values(t.entities)) if (e.kind === 'template' && !out.has(e.id)) {
    if (e.attach && out.has(e.attach) && t.entities[e.attach]?.kind === 'token') out.add(e.id);
    else if (rooms.size && rooms.has(floorUnder(t.entities, e.x, e.z, e.y || 0)?.room)) out.add(e.id);
  }
  return [...out];
};
// PAWN LOCK IS DROPPED (Harry 2026-10-11, docs/design/orbital-menu-2026-10-11: "Why pawn Lock was dropped"). It froze a
// pawn for its own GM in the client and not in the core, stopped a player's travel and nothing else. A pawn is never
// locked now: no command sets it (entity.flag skips pawns), nothing reads it (token.move, travel), an old stored
// inverse cannot bring it back (entities.set, transfer.in), and a saved pawn that was locked loads unlocked
// (core/migrate.js migratePawn). The field itself stays on a pawn, always false, so nobody's saved campaign changes
// shape. Things and rooms keep their lock; the GM's lock on travel between areas is another thing entirely.
export const unlockPawn = (e) => e && e.kind === 'token' && e.locked ? { ...e, locked: false } : e;
def('entity.flag', {
  level: 'area', cls: (state, by, a) => a.hidden !== undefined ? 'reveal' : 'object',
  args: { ids: 'ids', hidden: 'bool?', locked: 'bool?', pinned: 'bool?' },
  check: ({ area }, a) => {
    if (a.hidden === undefined && a.locked === undefined && a.pinned === undefined) return 'nothing to set';
    for (const id of a.ids) if (!area.entities[id]) return `no ${id}`;
    if (a.locked && a.hidden === undefined && a.pinned === undefined && a.ids.every(id => area.entities[id].kind === 'token')) return 'pawns cannot be locked (the pawn lock was dropped: a pawn always moves for its owner and the GM)';
    return null;
  },
  apply: (t, a) => {
    const entities = { ...t.entities }, named = new Set(a.ids);
    for (const id of flagTargets(t, a)) {
      const old = entities[id];
      entities[id] = { ...old, ...(a.hidden !== undefined && { hidden: a.hidden }), ...(named.has(id) && a.locked !== undefined && old.kind !== 'token' && { locked: a.locked }), ...(named.has(id) && a.pinned !== undefined && { pinned: a.pinned }) };
      // A missing faction asset is suppressed independently of the GM's hide/reveal choice.
      // Update that choice without exposing the placeholder or its attachment/asset data.
      if (old.factionMissing && a.hidden !== undefined) Object.assign(entities[id], { hidden: true, factionWasHidden: a.hidden });
      if (old.kind === 'token' && a.hidden !== undefined) {
        if (a.hidden && !named.has(id) && !old.hidden) entities[id].hiddenByRoom = tokenFloor(t.entities, old).room;
        else delete entities[id].hiddenByRoom; // explicit pawn hide/reveal takes over from the room
      }
    }
    return { ...t, entities };
  },
  touches: (a, t) => flagTargets(t, a),
});

// Water bodies (2026-10-04): rivers, canals, streams (a spline CHANNEL) and ponds (a closed outline), drawn by the Spawn
// Tuner's shared water (fx/water.js via world.js -> fx.water.setBodies; the look is the house water).
//   water  { id, kind:'water', body:{ kind:'channel'|'pond', pts:[[x, z]...] ft, width?, depth?, flow? ft/s, dir? deg, y?, ground? },
//            hidden, locked }
const WATER_NUM = { width: [0.5, 200], depth: [0.1, 40], flow: [0, 20], dir: [-360, 360], y: [-50, 50], ground: [-50, 50], bankWet: [0, 10] };
function waterBody(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return 'body must be an object';
  if (b.kind !== 'channel' && b.kind !== 'pond') return 'body.kind must be channel or pond';
  const n = b.kind === 'channel' ? 2 : 3;
  if (!Array.isArray(b.pts) || b.pts.length < n || b.pts.length > 400) return `body.pts: ${n} to 400 [x, z] points`;
  if (!b.pts.every(p => Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(v) && Math.abs(v) <= LIM))) return 'body.pts: [x, z] numbers';
  for (const [k, [lo, hi]] of Object.entries(WATER_NUM)) if (b[k] != null && !(Number.isFinite(b[k]) && b[k] >= lo && b[k] <= hi)) return `body.${k} must be ${lo}..${hi}`;
  return null;
}
const waterClean = (b) => ({ kind: b.kind, pts: b.pts.map(([x, z]) => [x, z]), ...Object.fromEntries(Object.keys(WATER_NUM).filter(k => b[k] != null).map(k => [k, b[k]])) });
def('water.set', {
  level: 'area', cls: 'object', args: { id: 'id', body: 'obj' },
  check: ({ area }, a) => { const e = area.entities[a.id]; return e && e.kind !== 'water' ? `${a.id} is not water` : e?.locked ? 'that water is locked' : waterBody(a.body); },
  apply: (t, a) => put(t, { id: a.id, kind: 'water', body: waterClean(a.body), hidden: !!t.entities[a.id]?.hidden, locked: false }),
  touches: (a) => [a.id],
});
def('water.remove', {
  level: 'area', cls: 'object', args: { id: 'id' },
  check: ({ area }, a) => { const e = ent(area, a.id, 'water'); return !e ? `no water ${a.id}` : e.locked ? 'that water is locked' : null; },
  apply: (t, a) => drop(t, a.id), touches: (a) => [a.id],
});

// Rooms. The recipe (type, rect in 5-ft cells, seed) plus the creator's solved layout: {hash, summary, objects}. The
// furniture become object entities of the room in the same command (one undo step). The relay solves when the layout is
// absent (LLM seats); clients re-solve to check the hash but always use the layout they were sent.
const ROOM_ARGS = { flavor: 'str?', building: 'id?', buildingName: 'str?', name: 'str?', type: 'str', x: 'int', z: 'int', w: 'int', d: 'int', y: 'int?', tall: 'int?', seed: 'int', wallSeed: 'int?', engine: 'str?', engineVersion: 'str?', wallFamily: 'str?', floor: 'str?', turn: 'int?', outline: 'obj?', layout: 'obj?', plan: 'obj?' }; // plan: a generated building's doors for this room (core/roomgen.js roomsOf)
def('room.spawn', {
  level: 'area', cls: 'room',
  args: { id: 'id', ...ROOM_ARGS },
  check: ({ area, roomTypes }, a) => {
    if (area.entities[a.id]) return `id ${a.id} already exists`;
    if (roomTypes && !roomTypes.has(a.type)) return `unknown room type ${a.type} (try: ${[...roomTypes].join(', ')})`;
    if (a.w < 1 || a.d < 1 || a.w > 16 || a.d > 16) return 'rooms are 1..16 cells (5..80 ft) on a side';
    if (Math.abs(a.x) > 400 || Math.abs(a.z) > 400) return 'room is off the map';
    const shape = outlineProblem(a); if (shape) return shape; // a room that is not its whole rectangle (core/footprint.js)
    const tall = heightProblem(a); if (tall) return tall; // y, tall: feet and storeys (core/height.js)
    if (a.plan != null && (typeof a.plan !== 'object' || Array.isArray(a.plan) || JSON.stringify(a.plan).length > 4000)) return 'plan: a small object';
    const hit = roomClash(area.entities, a, spanOfArgs(area.entities, a)); if (hit) return `overlaps room ${hit.id}`; // footprints AND heights
    if ((a.y || 0) > 0 && (a.y || 0) > baseOf(area.entities[a.building])) { const why = supportProblem(area.entities, a, a.y); if (why) return why; } // an upper room stands on something
    return a.layout ? layoutObjectsOk(area, a.layout) : null;
  },
  apply: (t, a) => {
    const order = t.order + 1;
    const recipe = { ...(a.flavor && a.flavor !== 'inherit' && { flavor: a.flavor }), type: a.type, x: a.x, z: a.z, w: a.w, d: a.d, seed: a.seed, wallSeed: a.wallSeed ?? a.seed * 7 + 1, engine: a.engine || 'v2', engineVersion: a.engineVersion || '', wallFamily: a.wallFamily || 'auto', floor: a.floor || 'auto', ...(a.y && { y: a.y }), ...(a.tall > 1 && { tall: a.tall }), ...(a.turn && { turn: ((a.turn % 4) + 4) % 4 }), ...(storedOutline(a) && { outline: storedOutline(a) }), ...(a.plan && { plan: a.plan }) };
    let out = { ...put(t, { id: a.id, kind: 'room', recipe, order, ...(a.name?.trim() && { name: a.name.trim().slice(0, 60) }), building: a.building || null, layout: { hash: a.layout?.hash || '', summary: a.layout?.summary || '' }, hidden: false, locked: false }), order };
    if (a.building && !out.entities[a.building]) out = put(out, { id: a.building, kind: 'building', name: a.buildingName || 'Building', hidden: false, locked: false });
    for (const o of a.layout?.objects || []) out = put(out, objectFrom({ ...o, room: a.id }));
    return out;
  },
  touches: (a, t) => [a.id, ...(a.layout?.objects || []).map(o => o.id), ...(a.building && !t?.entities[a.building] ? [a.building] : [])],
});
// Re-roll (new seed, same rectangle) or retype a room. Pinned furniture stays; the rest is replaced by the new layout
// (solved with the pinned pieces as fixed obstacles).
def('room.reroll', {
  level: 'area', cls: 'room',
  args: { id: 'id', seed: 'int', type: 'str?', engineVersion: 'str?', layout: 'obj' },
  check: ({ area, roomTypes }, a) => {
    const r = ent(area, a.id, 'room');
    if (!r) return `no room ${a.id}`;
    if (r.locked) return 'that room is locked';
    if (a.type && roomTypes && !roomTypes.has(a.type)) return `unknown room type ${a.type}`;
    return layoutObjectsOk(area, a.layout);
  },
  apply: (t, a) => {
    const r = t.entities[a.id];
    let out = t;
    for (const o of roomObjects(t, a.id)) if (!o.pinned && !o.fromEdge && o.place !== 'tile' && !isPlacedStair(o)) out = drop(out, o.id); // pinned props, edited walls, painted floor tiles and stairs stay
    out = put(out, { ...r, recipe: { ...r.recipe, seed: a.seed, ...(a.type && { type: a.type }), ...(a.engineVersion && { engineVersion: a.engineVersion }) }, layout: { hash: a.layout.hash, summary: a.layout.summary || '' } });
    for (const o of a.layout.objects) out = put(out, objectFrom({ ...o, room: a.id }, r.hidden ? { hidden: true } : {}));
    return out;
  },
  touches: (a, t) => [a.id, ...roomObjects(t, a.id).filter(o => !o.pinned && o.place !== 'tile' && !isPlacedStair(o)).map(o => o.id), ...(a.layout?.objects || []).map(o => o.id)],
});
// A TALL ROOM (docs/VERTICAL.md: a great hall, a temple nave): ONE room that spans several storeys. `tall` = how many
// (1 = an ordinary room: the field is removed). Refused when the taller room would run into a room above it.
def('room.tall', {
  level: 'area', cls: 'room', args: { id: 'id', tall: 'int' },
  check: ({ area }, a) => {
    const r = ent(area, a.id, 'room'); if (!r) return `no room ${a.id}`; if (r.locked) return 'that room is locked';
    const why = heightProblem({ y: roomY(r.recipe), tall: a.tall }); if (why) return why;
    const hit = roomClash(area.entities, r.recipe, spanOfArgs(area.entities, { y: roomY(r.recipe), tall: a.tall, building: r.building }), r.id);
    return hit ? `there is a room above it (${hit.name || hit.recipe.type}): a taller room would run into it` : null;
  },
  apply: (t, a) => { const r = t.entities[a.id], { tall, ...rc } = r.recipe; return put(t, { ...r, recipe: { ...rc, ...(a.tall > 1 && { tall: a.tall }) } }); },
  touches: (a) => [a.id],
});
export const FOG_MAX = 8; // ft: the top of the Fog height slider (the tuner's Room panel and the game's room menu)
def('room.set', {
  // name: the room's label ('' = its type's)
  // fog: this room's own FOG HEIGHT in feet (Harry 2026-10-05: the tuner's Fog height slider, on the room's menu).
  //      0 = no fog, up to FOG_MAX; any negative number = back to the room type's default (the field is removed)
  level: 'area', cls: 'room', args: { id: 'id', wallFamily: 'str?', floor: 'str?', name: 'str?', fog: 'num?', roof: 'obj?' }, // roof: { style?, seed?, off? } (core/height.js ROOFS)
  check: ({ area }, a) => { const r = ent(area, a.id, 'room'); return !r ? `no room ${a.id}` : r.locked ? 'that room is locked' : a.name && a.name.length > 60 ? 'names are at most 60 characters' : a.fog > FOG_MAX ? `fog height is 0 to ${FOG_MAX} ft (0 = none; -1 = the room type's default)` : a.roof !== undefined ? roofProblem(a.roof) : null; },
  apply: (t, a) => {
    const r = t.entities[a.id];
    let n = { ...r, recipe: { ...r.recipe, ...(a.wallFamily && { wallFamily: a.wallFamily }), ...(a.floor && { floor: a.floor }) } };
    if (a.name !== undefined) { if (a.name.trim()) n = { ...n, name: a.name.trim() }; else { const { name, ...rest } = n; n = rest; } }
    if (a.fog !== undefined) { if (a.fog >= 0) n = { ...n, fog: Math.round(a.fog * 100) / 100 }; else { const { fog, ...rest } = n; n = rest; } }
    if (a.roof !== undefined) { const { roof: was, ...rest } = n, roof = mergeRoof(was, a.roof); n = roof ? { ...rest, roof } : rest; }
    return put(t, n);
  },
  touches: (a) => [a.id],
});
// the wall-edge keys around a room ('h:x:z' runs along x at line z; 'v:x:z' along z at line x), and the overrides on
// them no other room shares: a deleted room takes its edge overrides with it (a later room there gets fresh walls)
// (and the posts on its outline: 'c<x>:<z>' grid vertices)
const perimeterKeys = footprintKeys; // the room's true boundary (an L-shaped room's inner walls and posts included)
// THE PIECES STOREYS GENERATE FOR A ROOM (2026-10-06): what holds its overhang up ('j…' brackets, 'p…' posts), the
// railing round the stair holes in its floor ('r…'), and a tall room's upper walls and posts (plain wall keys at the
// upper storey's height). An edit of one is the room's own, as an edit of its wall is: it goes, moves, turns and hides
// with the room. Whose a bracket, post or railing key is does not depend on what is generated right now (that changes
// when the room below moves): it is the room at that height whose floor the key's edge or vertex lies on.
const genOwns = (rc, key) => {
  if (!/^[jpr]/.test(key) || keyLevel(key) !== roomY(rc)) return false;
  const k = keyBase(key);
  if (k[0] === 'p') { const [x, z] = k.slice(1).split(':').map(Number); return [[x - 1, z - 1], [x, z - 1], [x - 1, z], [x, z]].some(([a, b]) => hasCell(rc, a, b)); }
  const [d, xs, zs] = k.split(':'), x = +xs, z = +zs;
  return d[1] === 'h' ? hasCell(rc, x, z - 1) || hasCell(rc, x, z) : hasCell(rc, x - 1, z) || hasCell(rc, x, z);
};
const tallKeys = (t, r, level = null) => {
  const rc = r.recipe, out = []; if (!((rc.tall || 1) > 1)) return out;
  const y = roomY(rc), H = storeyHeightOf(t.entities[r.building]);
  for (let k = 1; k < rc.tall; k++) if (level == null || level === y + k * H) out.push(...perimeterKeys({ ...rc, y: y + k * H }));
  return out;
};
const ownsKey = (t, r, key) => perimeterKeys(r.recipe).includes(key) || genOwns(r.recipe, key) || tallKeys(t, r, keyLevel(key)).includes(key);
const lonelyEdges = (t, id) => {
  const r = t.entities[id]; if (!r) return [];
  const rooms = Object.values(t.entities).filter(e => e.kind === 'room' && e.id !== id);
  const others = new Set(rooms.flatMap(e => perimeterKeys(e.recipe)));
  const gen = Object.values(t.entities).filter(e => e.kind === 'edge' && genOwns(r.recipe, e.key) && !rooms.some(o => genOwns(o.recipe, e.key))).map(e => e.id);
  return [...[...perimeterKeys(r.recipe), ...tallKeys(t, r)].filter(k => !others.has(k)).map(edgeId).filter(eid => t.entities[eid]), ...gen];
};
// A stair that came UP into a room goes with that room when it is deleted (Stage G): otherwise it would lead to open
// air. Same command, so one undo brings back the room and its stair. Kept: a pinned stair, and a stair whose top is at
// ground level (a cellar's stair simply comes up onto open ground).
const strandedStairs = (t, id) => { const r = t?.entities[id]; return r?.recipe ? stairsTouching(t.entities, r).filter(x => x.as === 'upper' && !x.stair.pinned && (isStair(x.stair) ? stairTop(x.stair) !== 0 : isPlacedStair(x.stair) && x.stair.down)).map(x => x.stair) : []; }; // (2026-10-11: of the ordinary kind, the stairs put in FOR this room: `down`)
def('room.delete', {
  level: 'area', cls: 'room', args: { id: 'id' },
  check: ({ area }, a) => { const r = ent(area, a.id, 'room'); return !r ? `no room ${a.id}` : r.locked ? 'that room is locked' : null; },
  apply: (t, a) => {
    if (!t.entities[a.id]) return t; // (asked what a batch touches against a LATER state: a building made again deletes rooms that are gone by then; without this the undo chip's check threw every frame)
    const b = t.entities[a.id].building;
    let out = drop(t, a.id); for (const o of roomObjects(t, a.id)) out = drop(out, o.id);
    for (const s of strandedStairs(t, a.id)) out = drop(out, s.id); // the stair that came up into it would lead to open air
    for (const eid of lonelyEdges(t, a.id)) out = drop(out, eid);
    if (b && out.entities[b] && !buildingRooms(out, b).length) out = drop(out, b); // the last room takes its building with it
    return out;
  },
  touches: (a, t) => { const b = t?.entities[a.id]?.building; return [a.id, ...roomObjects(t, a.id).map(o => o.id), ...(t ? strandedStairs(t, a.id).map(s => s.id) : []), ...(t ? lonelyEdges(t, a.id) : []), ...(b ? [b] : [])]; },
});
// Move a room by whole cells: its furniture moves with it (moving a parent moves its contents).
// Nothing is re-solved: the room's things are entities, so they go exactly where they were, relative to the room.
const roomOverlap = (area, id, rect) => { const r = area.entities[id], y = rect.y || 0; return roomClash(area.entities, rect, [y, y + (roomTop(area.entities, r) - roomY(r.recipe))], id); }; // footprints AND heights
// the room's own wall edits travel with it: every one leaves its old key first, then lands on its new one (two passes,
// because a key one edit leaves is often the key its neighbour arrives on)
const carryEdges = (t, out, id, mapKey) => {
  const mine = lonelyEdges(t, id).map(eid => t.entities[eid]);
  for (const e of mine) out = drop(out, e.id);
  for (const e of mine) { const key = mapKey(e.key); out = put(out, { ...e, id: edgeId(key), key }); }
  return out;
};
def('room.move', {
  level: 'area', cls: 'room', args: { id: 'id', dx: 'int', dz: 'int', dy: 'int?' }, // dx, dz: cells; dy: FEET (a multiple of 5): to another height
  check: ({ area }, a) => {
    const r = ent(area, a.id, 'room'); if (!r) return `no room ${a.id}`; if (r.locked) return 'that room is locked';
    const moved = movedRecipe(r.recipe, a);
    if (Math.abs(moved.x) > 400 || Math.abs(moved.z) > 400) return 'room is off the map';
    if (a.dy && (a.dy % STEP !== 0 || Math.abs(moved.y || 0) > MAX_Y)) return `dy: feet, a multiple of ${STEP}; a room's floor stays within ±${MAX_Y} ft`;
    const hit = roomOverlap(area, a.id, moved);
    return hit ? `would overlap room ${hit.id}` : null;
  },
  apply: (t, a) => {
    const r = t.entities[a.id], dx = a.dx * 5, dz = a.dz * 5, dy = a.dy || 0;
    let out = put(t, { ...r, recipe: movedRecipe(r.recipe, a) });
    for (const o of roomObjects(t, a.id)) out = put(out, { ...o, x: o.x + dx, z: o.z + dz, ...(dy && { y: (o.y || 0) + dy }), ...(o.fromEdge && { fromEdge: shiftKey(o.fromEdge, a.dx, a.dz, dy) }) });
    return carryEdges(t, out, a.id, (key) => shiftKey(key, a.dx, a.dz, dy)); // its wall edits move with it
  },
  touches: (a, t) => [a.id, ...roomObjects(t, a.id).map(o => o.id), ...(t ? lonelyEdges(t, a.id).flatMap(eid => [eid, edgeId(shiftKey(t.entities[eid].key, a.dx, a.dz, a.dy || 0))]) : [])],
});
const movedRecipe = (rc, a) => { const { y: y0, ...rest } = rc, y = (y0 || 0) + (a.dy || 0); return { ...rest, x: rc.x + a.dx, z: rc.z + a.dz, ...(y && { y }) }; };
// a wall key moved by whole cells (and feet of height): its '@<y>' level suffix is kept, or re-made at the new height
const shiftKey = (key0, dx, dz, dy = 0) => {
  const key = keyBase(key0), sfx = levelSuffix(keyLevel(key0) + dy);
  if (key[0] === 'c' || key[0] === 'p') { const [x, z] = key.slice(1).split(':'); return `${key[0]}${+x + dx}:${+z + dz}${sfx}`; } // a post at a vertex (a corner post, or the post under an overhang)
  const [d, x, z] = key.split(':'); return `${d}:${+x + dx}:${+z + dz}${sfx}`; // ('h', 'v', and the bracket and railing keys 'jh', 'rv', ...)
};

// Turn a room by quarter turns, clockwise seen from above (Harry 2026-10-05), about its centre. Rooms sit on the 5-ft
// grid and share walls, so a turn is always 90 degrees and the turned rectangle is snapped back onto the grid: when
// width and depth differ by an odd number of cells the true centre is half a cell off, and the snap goes one way on the
// 1st and 3rd quarter and back on the 2nd and 4th, so two turns are exactly 180 degrees and four are where it started.
// Nothing is re-solved. The room's things (its furniture, things placed by hand, painted floor tiles, edited walls) are
// entities and turn with it: the layout the user saw is the layout they keep, including whatever they moved, added,
// pinned or deleted. recipe.turn (0..3) remembers how the room stands, so its own outside door stays on the same wall OF
// THE ROOM (tools/spawn-tuner/js/walls.js chooseExteriorDoor); the rest of the shell re-forms against the neighbours.
export function turnedRect(rc) {
  const odd = (rc.turn || 0) % 2 === 1, snap = odd ? Math.ceil : Math.floor;
  return { x: snap(rc.x + rc.w / 2 - rc.d / 2), z: snap(rc.z + rc.d / 2 - rc.w / 2), w: rc.d, d: rc.w, turn: ((rc.turn || 0) + 1) % 4, ...(rc.outline && { outline: turnOutline(rc.outline, rc.w, rc.d) }) };
}
// where things go in one clockwise quarter turn of the room `rc` into `n` (= turnedRect(rc)): points in feet, wall keys in cells
export function quarterTurn(rc, n = turnedRect(rc)) {
  const cx = (rc.x + rc.w / 2) * 5, cz = (rc.z + rc.d / 2) * 5, nx = (n.x + n.w / 2) * 5, nz = (n.z + n.d / 2) * 5;
  const r2 = (v) => Math.round(v * 100) / 100;
  const vert = (gx, gz) => [n.x + rc.d - (gz - rc.z), n.z + (gx - rc.x)];
  return {
    point: (x, z) => [r2(nx - (z - cz)), r2(nz + (x - cx))],
    rot: (rot) => { let a = (rot || 0) - Math.PI / 2; while (a <= -Math.PI) a += 2 * Math.PI; while (a > Math.PI) a -= 2 * Math.PI; return a; },
    key: (key0) => { // (a key's '@<y>' level suffix rides along untouched)
      const key = keyBase(key0), sfx = key0.slice(key.length);
      if (key[0] === 'c' || key[0] === 'p') { const [x, z] = key.slice(1).split(':').map(Number); const [X, Z] = vert(x, z); return `${key[0]}${X}:${Z}${sfx}`; }
      const [d0, xs, zs] = key.split(':'), pre = d0.length > 1 ? d0[0] : '', d = d0[d0.length - 1], x = +xs, z = +zs, [X, Z] = vert(x, z); // (pre: 'j' a bracket, 'r' a railing, on that edge)
      return pre + (d === 'h' ? `v:${X}:${Z}` : `h:${X - 1}:${Z}`) + sfx;
    },
  };
}
// k quarter turns as one map (composed from the room's ORIGINAL place, so a half turn never depends on where a quarter
// turn would have stood)
export function turnPlan(rc0, k) {
  let rc = rc0; const qs = [];
  for (let i = 0; i < k; i++) { const n = turnedRect(rc); qs.push(quarterTurn(rc, n)); rc = { ...rc, ...n }; }
  return { rc, point: (x, z) => qs.reduce((p, q) => q.point(p[0], p[1]), [x, z]), rot: (r) => qs.reduce((v, q) => q.rot(v), r), key: (key) => qs.reduce((v, q) => q.key(v), key) };
}
const turnsOf = (a) => ((a.turns % 4) + 4) % 4;
def('room.rotate', {
  level: 'area', cls: 'room', args: { id: 'id', turns: 'int' }, // quarter turns clockwise; -1 (or 3) = one anticlockwise
  check: ({ area }, a) => {
    const r = ent(area, a.id, 'room'); if (!r) return `no room ${a.id}`; if (r.locked) return 'that room is locked';
    if (!turnsOf(a)) return 'turns: 1, 2 or 3 quarter turns (or -1)';
    const { rc } = turnPlan(r.recipe, turnsOf(a));
    if (Math.abs(rc.x) > 400 || Math.abs(rc.z) > 400) return 'room is off the map';
    const hit = roomOverlap(area, a.id, rc);
    return hit ? `would overlap room ${hit.id}` : null;
  },
  apply: (t, a) => {
    const r = t.entities[a.id], q = turnPlan(r.recipe, turnsOf(a));
    let out = put(t, { ...r, recipe: q.rc });
    for (const o of roomObjects(t, a.id)) { const [x, z] = q.point(o.x, o.z); out = put(out, { ...o, x, z, rot: q.rot(o.rot), ...(o.fromEdge && { fromEdge: q.key(o.fromEdge) }) }); }
    return carryEdges(t, out, a.id, q.key);
  },
  touches: (a, t) => {
    const r = t?.entities[a.id]; if (!r?.recipe) return [a.id];
    const q = turnPlan(r.recipe, turnsOf(a));
    return [a.id, ...roomObjects(t, a.id).map(o => o.id), ...lonelyEdges(t, a.id).flatMap(eid => [eid, edgeId(q.key(t.entities[eid].key))])];
  },
});
// Buildings own rooms. A room spawned touching no other room starts a new building in the same command.
// Walls, doors and windows (Harry 2026-10-04): the shell is a pure function of the rooms, plus an override per edge,
// kept as an 'edge' entity (one per wall segment: concurrent edits of different walls never collide):
//   as 'open'      a wall segment leaves an opening (shared walls open up both rooms)
//   as 'wall'      a door or window reverts to plain wall
//   piece/family/pick   swap a wall or window for a similar piece;   doorType   swap a door for one that fits the span
// a wall segment ('h:x:z', 'v:x:z') or a post at a grid vertex ('cx:z': corner and jamb posts, 2026-10-04)
// and, off the ground, the height of its rooms' floor in feet: 'h:3:4@10', 'c3:4@-10' (core/footprint.js; no suffix at 0)
// 2026-10-06, the pieces storeys generate are things of their own too, each with a key of the same shape:
//   'jh:x:z@y' / 'jv:x:z@y'   the bracket under a jetty, on the wall edge it leans against (y = the upper room's floor)
//   'p<x>:<z>@y'              the post or pier under a two-square overhang, at a grid vertex
//   'rh:x:z@y' / 'rv:x:z@y'   a railing section on an edge of a stair's hole in the floor at y
// and a tall room's upper wall pieces and posts use the plain wall keys at their own height ('h:3:4@10').
export const EDGE_KEY_RE = /^([jr]?[hv]:-?\d{1,4}:-?\d{1,4}|[cp]-?\d{1,4}:-?\d{1,4})(@-?\d{1,3})?$/;
export const edgeId = (key) => 'edge_' + key.replace(/:/g, 'z').replace(/-/g, 'm').replace('@', 'a');
const hiddenWall = (t, key) => { const own = Object.values(t.entities).filter(e => e.kind === 'room' && ownsKey(t, e, key)); return own.length > 0 && own.every(r => r.hidden); };
def('edge.set', {
  level: 'area', cls: 'room', args: { key: 'str', as: 'str?', piece: 'str?', family: 'str?', pick: 'int?', doorType: 'str?' },
  check: (_, a) => !EDGE_KEY_RE.test(a.key) ? `not a wall segment: ${a.key}` : a.as && !['open', 'wall', ''].includes(a.as) ? 'as: open or wall' : null,
  apply: (t, a) => {
    // (a NEW edit on a wall that only hidden rooms own is hidden with them: a wall edit made upstairs in a hidden storey
    // must not reach the player side)
    const id = edgeId(a.key), old = t.entities[id] || { id, kind: 'edge', key: a.key, ...(hiddenWall(t, a.key) && { hidden: true }) };
    const n = { ...old };
    for (const k of ['as', 'piece', 'family', 'pick', 'doorType']) if (a[k] !== undefined) { if (a[k] === '' ) delete n[k]; else n[k] = a[k]; }
    return Object.keys(n).some(k => !['id', 'kind', 'key', 'hidden'].includes(k)) ? put(t, n) : drop(t, id);
  },
  touches: (a) => [edgeId(a.key)],
});
def('edge.reset', {
  level: 'area', cls: 'room', args: { key: 'str' },
  check: (_, a) => EDGE_KEY_RE.test(a.key) ? null : `not a wall segment: ${a.key}`,
  apply: (t, a) => drop(t, edgeId(a.key)),
  touches: (a) => [edgeId(a.key)],
});
// A building: its label, and its heights (docs/VERTICAL.md): base = where it meets the ground (feet, a multiple of 5),
// storey = floor to floor (feet; 10 unless set: a 9-ft wall and a 1-ft slab). Storeys are counted from the base, per
// building, never map-wide. Changing them does not move the rooms: it changes which storey each height counts as.
def('building.set', {
  level: 'area', cls: 'room', args: { id: 'id', name: 'str?', base: 'int?', storey: 'int?', roof: 'str?', gen: 'obj?' }, // gen: the recipe a generated building was made from (docs/BUILDINGS.md): type, footprint, seed, storeys, dials, flavor // roof: the building's roof style, or 'auto' (by wall family)
  check: ({ area }, a) => !ent(area, a.id, 'building') ? `no building ${a.id}` : a.name === undefined && a.base === undefined && a.storey === undefined && a.roof === undefined && a.gen === undefined ? 'nothing to set'
    : a.gen !== undefined && (typeof a.gen !== 'object' || Array.isArray(a.gen) || JSON.stringify(a.gen).length > 2000) ? 'gen: a small object'
    : a.roof !== undefined && roofProblem(a.roof, true) ? roofProblem(a.roof, true)
    : a.base !== undefined && (a.base % STEP !== 0 || Math.abs(a.base) > MAX_Y) ? `base: feet, a multiple of ${STEP}, within ±${MAX_Y}`
    : a.storey !== undefined && (a.storey % STEP !== 0 || a.storey < 5 || a.storey > 40) ? 'storey: feet floor to floor, a multiple of 5 from 5 to 40' : null,
  apply: (t, a) => { const { base: b0, storey: s0, roof: r0, ...b } = t.entities[a.id], base = a.base ?? b0, storey = a.storey ?? s0, roof = a.roof ?? r0; return put(t, { ...b, ...(a.gen !== undefined && { gen: a.gen }), ...(a.name !== undefined && { name: a.name }), ...(base && { base }), ...(storey && storey !== 10 && { storey }), ...(roof && roof !== 'auto' && { roof }) }); },
  touches: (a) => [a.id],
});

// One logged operation for every faction UI. The payload contains asset identities only; no transforms or
// replacement entities can enter through it. The scope also protects explicit room/object overrides.
def('faction.set', {
  level: 'area', cls: 'room', args: { id: 'id', flavor: 'str', swaps: 'obj?' },
  check: ({ area }, a) => {
    const e = area.entities[a.id];
    if (!e || !(['room', 'building'].includes(e.kind) || isFactionPiece(e))) return 'choose a room, building or faction piece';
    if (e.locked) return 'that thing is locked';
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(a.flavor)) return 'invalid faction';
    if (!Array.isArray(a.swaps) || a.swaps.length > 2000) return 'faction swaps must be a bounded array';
    const scope = new Set(factionScope(area.entities, a.id).map(o => o.id)), seen = new Set();
    for (const s of a.swaps) {
      if (!s || !scope.has(s.id) || seen.has(s.id)) return 'faction swap is outside its inherited slot pieces';
      seen.add(s.id);
      const o = area.entities[s.id];
      if (s.missing === true && Object.keys(s).every(k => ['id', 'missing'].includes(k))) continue;
      if (s.cat !== factionSlot(o)) return 'faction swap must keep its slot';
      if (Object.keys(s).some(k => !['id', 'cat', 'faction', 'sku', 'url', 'flat', 'name'].includes(k))) return 'faction swaps change assets only';
      if (typeof s.sku !== 'string' || !s.sku.startsWith(s.cat + '--') || typeof s.url !== 'string' || s.url.length > 200 || !/^[\w./@-]+$/.test(s.url) || s.url.includes('..') || typeof s.flat !== 'boolean' || typeof s.name !== 'string') return 'invalid faction asset';
      if (typeof s.faction !== 'string' || (a.flavor !== 'inherit' && s.faction !== a.flavor)) return 'slot piece must match its faction';
    }
    return null;
  },
  apply: (t, a) => {
    let out = put(t, withFaction(t.entities[a.id], a.flavor));
    for (const s of a.swaps) if (out.entities[s.id]) {
      const old = out.entities[s.id];
      if (s.missing) out = put(out, { ...old, factionMissing: true, factionWasHidden: old.factionMissing ? old.factionWasHidden : old.hidden, hidden: true });
      else {
        const { factionMissing, factionWasHidden, ...keep } = old;
        out = put(out, { ...keep, ...(factionMissing && { hidden: !!factionWasHidden || !!out.entities[old.room]?.hidden }), cat: s.cat, sku: s.sku, url: s.url, flat: s.flat, name: s.name });
      }
    }
    return out;
  },
  touches: (a) => [a.id, ...a.swaps.map(s => s.id)],
});

// Several area commands as ONE step (a multi-select drag, a paste, a duplicate, delete of a selection):
// every op is checked against the area as the earlier ops left it; one log entry, one undo.
const BATCHABLE = () => Object.values(REGISTRY).filter(d => d.level === 'area' && !d.special && !d.internal && !d.noBatch && d.type !== 'batch').map(d => d.type);
def('batch', {
  level: 'area', cls: null, // each op is checked with its own class (checkCommand)
  args: { ops: 'ops' },
  apply: (t, a, meta) => a.ops.reduce((tt, op) => REGISTRY[op.type].apply(tt, op.args, meta), t),
  touches: (a, t) => { const out = new Set(); let tt = t; for (const op of a.ops) { for (const id of REGISTRY[op.type].touches(op.args, tt)) out.add(id); if (tt) tt = REGISTRY[op.type].apply(tt, op.args); } return [...out]; },
});

// Chat and dice ("say …" in the bar). Undo of a line removes it; a roll is one step.
const chatLine = (t, line) => ({ ...t, chat: [...(t.chat || []), line].slice(-CHAT_KEEP) });
def('chat.say', {
  level: 'area', cls: 'chat', args: { id: 'id', text: 'text' },
  check: ({ area }, a) => (area.chat || []).some(c => c.id === a.id) ? 'duplicate message id' : null,
  apply: (t, a, meta) => chatLine(t, { id: a.id, by: meta?.by || null, text: a.text }),
  inverse: (t, a) => ({ type: 'chat.unsay', args: { id: a.id } }),
});
// `throw` (2026-10-19, real 3D dice): the roller's recorded tumble (tuner js/fx/dicephys.js encode), played back by every
// seat that receives the entry. It never decides a number (the numbering is turned to `rolls` at playback) and it is
// not kept in the chat line: only the entry carries it, so a snapshot or a late joiner has the line and no throw.
const throwProblem = (t) => {
  if (t == null) return null;
  if (typeof t.b !== 'string' || t.b.length > 120000 || !/^[A-Za-z0-9+/]*=*$/.test(t.b)) return 'throw: not a dice recording';
  if (t.t != null && (typeof t.t !== 'string' || t.t.length > 20000 || !/^[A-Za-z0-9+/]*=*$/.test(t.t))) return 'throw: bad keyframe times';
  if (!Array.isArray(t.d) || !t.d.length || t.d.length > 40 || !t.d.every(x => /^d(4|6|8|10t?|12|20)$/.test(x))) return 'throw: dice must be d4 d6 d8 d10 d10t d12 d20 (40 at most)';
  if (![t.hz, t.s, t.f].every(n => Number.isFinite(n) && n > 0 && n < 1e5) || !Array.isArray(t.o) || t.o.length !== 3 || !t.o.every(Number.isFinite)) return 'throw: bad header';
  return null;
};
def('dice.roll', {
  level: 'area', cls: 'chat', args: { id: 'id', expr: 'str', rolls: 'list', total: 'int', why: 'str?', throw: 'obj?' },
  check: ({ area }, a) => (area.chat || []).some(c => c.id === a.id) ? 'duplicate roll id' : a.rolls.length > 100 ? 'too many dice' : throwProblem(a.throw),
  apply: (t, a, meta) => chatLine(t, { id: a.id, by: meta?.by || null, roll: { expr: a.expr, rolls: a.rolls, total: a.total }, text: a.why || '' }),
  inverse: (t, a) => ({ type: 'chat.unsay', args: { id: a.id } }),
});
def('chat.unsay', {
  level: 'area', cls: 'undo', args: { id: 'id' }, quiet: true, internal: true,
  apply: (t, a) => ({ ...t, chat: (t.chat || []).filter(c => c.id !== a.id) }),
  inverse: (t, a) => { const line = (t.chat || []).find(c => c.id === a.id); return line ? { type: 'chat.restore', args: { line } } : null; },
});
def('chat.restore', {
  level: 'area', cls: 'undo', args: { line: 'obj' }, quiet: true, internal: true,
  apply: (t, a) => chatLine(t, a.line),
  inverse: (t, a) => ({ type: 'chat.unsay', args: { id: a.line.id } }),
});
// Undo's generic inverse: set these entities back to these exact values (null = remove).
def('entities.set', {
  level: 'area', cls: 'undo', args: { set: 'obj' }, stale: 'apply', quiet: true,
  check: (_, a) => Object.keys(a.set).every(isId) ? null : 'bad ids in set',
  apply: (t, a) => {
    const entities = { ...t.entities };
    for (const [id, e] of Object.entries(a.set)) if (e) entities[id] = unlockPawn(e); else delete entities[id]; // (an inverse stored while pawns could be locked)
    return { ...t, entities };
  },
  touches: (a) => Object.keys(a.set),
});
// Per-seat undo/redo (Figma's model): the relay resolves them to stored inverses and commits THOSE.
// who: whose action (default: your own). Only the GM side may undo someone else's.
def('undo', { level: 'area', cls: 'undo', args: { seq: 'int?', who: 'id?' }, special: true, apply: (t) => t });
def('redo', { level: 'area', cls: 'undo', args: { who: 'id?' }, special: true, apply: (t) => t });
// The two halves of a cross-area transfer. Never sent by clients; the relay emits them from `transfer`.
def('transfer.out', { level: 'area', cls: 'transfer', args: { id: 'id', to: 'id' }, internal: true, apply: (t, a) => drop(t, a.id), touches: (a) => [a.id] });
def('transfer.in', { level: 'area', cls: 'transfer', args: { entity: 'obj', from: 'id' }, internal: true, apply: (t, a) => put(t, unlockPawn(a.entity)), touches: (a) => [a.entity.id] });

// ---------------- campaign commands ----------------
// AN AREA IS OPEN OR HIDDEN (Harry 2026-10-06). THE FIRST AREA OF A CAMPAIGN IS OPEN; EVERY AREA CREATED AFTER IT STARTS
// HIDDEN, whatever the sender asks for ("so the GM can build tomorrow's dungeon in the same campaign"): `fill` runs on
// the relay before the command is journaled, so the journal holds the visibility that was decided. (`apply` still
// honours what a record says, and reads a record with none as 'open': that is how records written before this replay.)
// 'party' and 'gm' are the old names for not-open: accepted from old clients and old journals, read as hidden.
const HIDDEN_WORDS = 'open|hidden|party|gm';
def('area.create', {
  level: 'campaign', cls: 'area.admin', args: { id: 'id', name: 'str', visibility: `enum:${HIDDEN_WORDS}?` },
  fill: (state, a) => ({ ...a, visibility: state.areaOrder.length ? 'hidden' : 'open' }),
  check: ({ state }, a) => state.areas[a.id] ? `area ${a.id} exists` : null,
  apply: (s, a) => ({ ...s, areas: { ...s.areas, [a.id]: newArea(a.id, a.name, a.visibility || 'open') }, areaOrder: [...s.areaOrder, a.id] }),
});
// open an area to the players, or hide it again (the GM; Settings, the floating button, the command bar)
def('area.visibility', {
  level: 'campaign', cls: 'area.admin', args: { area: 'id', visibility: `enum:${HIDDEN_WORDS}` },
  fill: (state, a) => ({ ...a, visibility: a.visibility === 'open' ? 'open' : 'hidden' }),
  check: ({ state }, a) => state.areas[a.area] ? null : `no area ${a.area}`,
  apply: (s, a) => ({ ...s, areas: { ...s.areas, [a.area]: { ...s.areas[a.area], visibility: a.visibility } } }),
});
def('seat.create', {
  level: 'campaign',
  // humans are created by the GM; LLM seats by any human seat, for themselves
  cls: (state, by, a) => a.kind === 'llm' ? 'seat.agent' : 'seat.admin',
  args: { id: 'id', kind: 'enum:human|llm', role: 'enum:gm|player?', name: 'str', color: 'color?', scope: 'obj?', invisible: 'bool?', location: 'id?' },
  check: ({ state, by }, a) => {
    if (state.seats[a.id]) return `seat ${a.id} exists`;
    if (a.kind === 'human') return a.role ? null : 'human seats need a role';
    const creator = state.seats[by];
    if (creator.kind !== 'human') return 'only human seats create agents';
    const r = scopeWithin(state, by, a.scope);
    return r.ok ? null : `scope too wide: ${r.why}`;
  },
  apply: (s, a, meta) => {
    const creator = a.kind === 'llm' ? meta.by : (meta.by || null);
    const role = a.kind === 'llm' ? s.seats[meta.by].role : a.role;
    const seat = {
      id: a.id, kind: a.kind, role, name: a.name, color: a.color || '#7fb0ff', creator,
      scope: a.kind === 'llm' ? a.scope : null, revoked: false, invisible: !!a.invisible,
      location: a.location || (a.kind === 'llm' ? s.seats[meta.by]?.location : s.areaOrder[0]) || null,
    };
    return { ...s, seats: { ...s.seats, [a.id]: seat } };
  },
});
def('seat.revoke', {
  level: 'campaign',
  cls: (state, by, a) => state.seats[a.who]?.creator === by && state.seats[a.who]?.kind === 'llm' ? 'seat.agent' : 'seat.admin',
  args: { who: 'id' },
  check: ({ state, by }, a) => !state.seats[a.who] ? `no seat ${a.who}` : a.who === by ? 'cannot revoke yourself' : null,
  apply: (s, a) => { // cascade: the seat and every seat it created (transitively)
    const seats = { ...s.seats };
    const kill = (id) => { seats[id] = { ...seats[id], revoked: true }; for (const c of Object.values(seats)) if (c.creator === id && !c.revoked) kill(c.id); };
    kill(a.who);
    return { ...s, seats };
  },
});
def('seat.locate', {
  level: 'campaign',
  cls: (state, by, a) => (a.who || by) === by ? 'seat.locate' : 'seat.admin',
  args: { who: 'id?', area: 'id' },
  check: ({ state, by }, a) => {
    // (a hidden area answers exactly like a missing one: a seat that cannot see it learns nothing about it)
    if (!state.areas[a.area] || !canSee(state, by, a.area)) return 'no such area visible to you';
    const who = a.who || by;
    if (!state.seats[who]) return `no seat ${who}`;
    return null;
  },
  apply: (s, a, meta) => { const id = a.who || meta.by; return { ...s, seats: { ...s.seats, [id]: { ...s.seats[id], location: a.area } } }; },
});
def('seat.set', {
  level: 'campaign',
  // yourself: name and colour (Settings ▸ Me); your agents; anyone (the GM)
  cls: (state, by, a) => a.who === by && a.invisible === undefined ? 'seat.self' : state.seats[a.who]?.creator === by ? 'seat.agent' : 'seat.admin',
  args: { who: 'id', invisible: 'bool?', name: 'str?', color: 'color?' },
  check: ({ state }, a) => !state.seats[a.who] ? `no seat ${a.who}` : a.name !== undefined && (!a.name.trim() || a.name.length > 40) ? 'names are 1 to 40 characters' : null,
  apply: (s, a) => ({ ...s, seats: { ...s.seats, [a.who]: { ...s.seats[a.who], ...(a.invisible !== undefined && { invisible: a.invisible }), ...(a.name && { name: a.name.trim() }), ...(a.color && { color: a.color }) } } }),
});
// Settings ▸ World navigation / ▸ Area (Harry 2026-10-04): rename an area and its play settings (null = inherit the
// campaign default; core/state.js RULE_KEYS). `grants` (seats let into an area beyond its visibility rule) was retired
// on 2026-10-06, when an area became open or hidden and nothing else: the argument is still read so that old journals
// replay to the same bytes, and a stored list opens nothing (core/perms.js canSee).
def('area.set', {
  level: 'campaign', cls: 'area.admin', args: { area: 'id', name: 'str?', settings: 'obj?', grants: 'list?' },
  check: ({ state }, a) => {
    if (!state.areas[a.area]) return `no area ${a.area}`;
    if (a.name !== undefined && (!a.name.trim() || a.name.length > 60)) return 'area names are 1 to 60 characters';
    if (a.grants && !a.grants.every(id => typeof id === 'string' && state.seats[id])) return 'grants must be seat ids';
    return settingsProblem(a.settings, RULE_KEYS);
  },
  apply: (s, a) => { const T = s.areas[a.area]; return { ...s, areas: { ...s.areas, [a.area]: { ...T, ...(a.name && { name: a.name.trim() }), ...(a.settings && { settings: mergeSettings(T.settings, a.settings) }), ...(a.grants && { grants: [...new Set(a.grants)] }) } } }; },
});
def('area.delete', {
  level: 'campaign', cls: 'area.admin', args: { area: 'id' },
  check: ({ state }, a) => !state.areas[a.area] ? `no area ${a.area}` : state.areaOrder.length < 2 ? 'a campaign keeps at least one area' : null,
  apply: (s, a) => { // whoever was there moves to the first area left
    const areas = { ...s.areas }; delete areas[a.area];
    const areaOrder = s.areaOrder.filter(t => t !== a.area), seats = { ...s.seats };
    for (const x of Object.values(seats)) if (x.location === a.area) seats[x.id] = { ...x, location: areaOrder[0] };
    return { ...s, areas, areaOrder, seats };
  },
});
// Settings ▸ Global defaults: the campaign's name, the play-setting defaults every area inherits, and campaign-wide
// items (units, genre, house look, public vs hidden rolls). null = back to the built-in.
def('campaign.set', {
  level: 'campaign', cls: 'campaign.admin', args: { name: 'str?', defaults: 'obj?' },
  check: (_, a) => a.name !== undefined && (!a.name.trim() || a.name.length > 80) ? 'campaign names are 1 to 80 characters' : settingsProblem(a.defaults, { ...RULE_KEYS, ...CAMPAIGN_KEYS }),
  apply: (s, a) => ({ ...s, ...(a.name && { name: a.name.trim() }), ...(a.defaults && { defaults: mergeSettings(s.defaults, a.defaults) }) }),
});
// Players ask the GM to import or export; the GM approves or denies (Settings ▸ Campaign admin). An import carries
// its campaign JSON; the GM's client applies it on approval, then the payload is dropped.
def('request.create', {
  level: 'campaign', cls: 'request', args: { id: 'id', kind: 'enum:import|export', note: 'str?', payload: 'obj?' },
  check: ({ state }, a) => state.requests?.[a.id] ? `request ${a.id} exists` : a.payload && a.kind !== 'import' ? 'only an import carries a payload' : null,
  apply: (s, a, meta) => ({ ...s, requests: { ...(s.requests || {}), [a.id]: { id: a.id, by: meta?.by || null, kind: a.kind, note: a.note || '', status: 'pending', ...(a.payload && { payload: a.payload }) } } }),
});
def('request.resolve', {
  level: 'campaign', cls: 'campaign.admin', args: { id: 'id', ok: 'bool' },
  check: ({ state }, a) => !state.requests?.[a.id] ? `no request ${a.id}` : state.requests[a.id].status !== 'pending' ? 'already answered' : null,
  apply: (s, a) => { const { payload, ...r } = s.requests[a.id]; return { ...s, requests: { ...s.requests, [a.id]: { ...r, status: a.ok ? 'approved' : 'denied' } } }; },
});
// Cross-area transfer: ONE campaign command. The relay applies it to both areas in one journal record,
// emitting transfer.out on `from` and transfer.in on `to`, so it is atomic on disk and on every client.
// (`hide` and `open` are never arguments a seat can send: parseArgs drops them. Only the relay writes them, into the
// inverse of a `travel` that opened an area: undoing it hides `from` again, redoing it opens `to` again.)
def('transfer', {
  level: 'campaign', cls: 'transfer', args: { id: 'id', from: 'id', to: 'id', x: 'num?', z: 'num?' },
  areas: (a) => [a.from, a.to],
  check: ({ state }, a) => {
    const F = state.areas[a.from], T = state.areas[a.to];
    if (!F || !T) return 'unknown area';
    if (a.from === a.to) return 'same area';
    const e = F.entities[a.id];
    if (!e) return `no ${a.id} on ${F.name}`;
    if (e.kind === 'room') return 'rooms do not travel';
    if (T.entities[a.id]) return `${a.id} already on ${T.name}`;
    return null;
  },
  apply: (s, a) => a.hide ? setVisibility(s, a.from, 'hidden') : a.open ? setVisibility(s, a.to, 'open') : s,
  touches: (a) => [a.id],
});
const setVisibility = (s, area, visibility) => s.areas[area] ? { ...s, areas: { ...s.areas, [area]: { ...s.areas[area], visibility } } } : s;

// TRAVEL (Harry 2026-10-06; docs/PAWNS.md "Areas"): a pawn goes to another area. One campaign command; the relay commits
// it as the two halves of a transfer (so it is atomic, and its undo is the pawn coming back to exactly where it stood).
//   - PLAYERS TRAVEL FREELY with their own pawns, to any area that is open (a hidden area answers like a missing one).
//   - THE GM CAN LOCK TRAVEL for players (the campaign setting `travelLocked`, Settings ▸ Global defaults); an area
//     whose moves are locked (Settings ▸ Area) cannot be left either. The refusal says which.
//   - THE GM SENDS A PLAYER'S PAWN INTO A HIDDEN AREA: THE PAWN GOES AND THE AREA OPENS (`opens`, decided by `fill`).
//     Undoing it sends the pawn back AND hides the area again (Harry's rule, exactly). A pawn that is nobody's, or the
//     GM's own, goes in quietly: the area stays hidden.
//   - WHERE IT ARRIVES is never the sender's choice: core/travel.js arrivalPoint (one function).
// The relay fills x, z, y (the arrival) and `opens` before the command is journaled.
def('travel', {
  level: 'campaign', cls: 'travel', args: { id: 'id', from: 'id', to: 'id' },
  areas: (a) => [a.from, a.to],
  fill: (state, a, by) => {
    const F = state.areas[a.from], T = state.areas[a.to], e = F?.entities[a.id];
    if (!T || !e) return a;
    const at = arrivalPoint(T.entities, state.seats, { id: a.id });
    const owner = principalOf(state, e.owner);
    return { ...a, x: at.x, z: at.z, y: at.y, ...(isGmSide(state, by) && owner?.role === 'player' && !isOpen(T) && { opens: true }) };
  },
  check: ({ state, by }, a) => {
    const F = state.areas[a.from], T = state.areas[a.to], gm = isGmSide(state, by), who = principalOf(state, by);
    if (a.from === a.to) return 'it is already in that area';
    const e = F.entities[a.id];
    if (!e || e.kind !== 'token' || (e.hidden && !gm)) return `no pawn ${a.id} in that area`;
    if (!gm) {
      if (e.owner !== who.id) return `${e.name} belongs to someone else`;
      if (state.defaults?.travelLocked) return { code: 'forbidden', why: 'the GM has locked travel between areas' };
      if (areaRules(state, a.from).freeMoves === false) return { code: 'forbidden', why: 'the GM has locked moves in this area' };
    }
    if (T.entities[a.id]) return `${e.name} is already in ${T.name}`;
    return null;
  },
  apply: (s, a) => a.opens ? setVisibility(s, a.to, 'open') : s,
  touches: (a) => [a.id],
});

// ---------------- the party, a player's pawns, the GM's cast (core/party.js; docs/PAWNS.md) ----------------
// LEND A PAWN (hand-off: "lend my pawn to another player or to an AI seat while I am away"). The owner gives it to
// another person, or to no one (the GM side moves it: that is the GM's assistants too; a player's own agents already
// act for her). The pawn remembers its `lender`, who may take it back at any time. The GM's Give control ends a loan.
def('token.lend', {
  level: 'area', cls: 'pawn', args: { id: 'id', to: 'idOrNone' },
  check: ({ state, area, by }, a) => {
    const e = ent(area, a.id, 'token'); if (!e) return `no token ${a.id} in this area`;
    const who = principalOf(state, by)?.id, back = e.lender && e.lender === who;
    if (!back && e.owner !== who) return `${e.name} is not yours to lend`;
    if (a.to && (!state?.seats[a.to] || state.seats[a.to].kind === 'llm')) return 'lend a pawn to a person, or to no one (the GM and the GM\'s assistants)';
    if (back && a.to && a.to !== who && e.owner !== who) return `take ${e.name} back first`;
    return (a.to || null) === (e.owner || null) ? 'nothing would change' : null;
  },
  apply: (t, a) => { const { lender, ...e } = t.entities[a.id], from = lender || e.owner, to = a.to || null; return put(t, { ...e, owner: to, ...(to !== from && from && { lender: from }) }); },
  touches: (a) => [a.id],
});
// BRING A DEFINED PAWN ONTO THE TABLE (the bench: "bring one on, send one back"). A player may: it is her own pawn, and
// nobody approves it. The relay writes the pawn from the definition (`fill`), so what stands on the table is what was
// defined, whatever the sender's browser says. One pawn per definition, campaign-wide.
const benchDef = (state, by, id) => { const d = state?.pawns?.[id]; return d && (isGmSide(state, by) || d.owner === principalOf(state, by)?.id) ? d : null; };
const fromDef = (d, a, color) => ({ id: a.id, def: d.id, x: a.x, z: a.z, ...(a.y != null && { y: a.y }), ...(a.rot != null && { rot: a.rot }), name: d.name, owner: d.owner, color: color || a.color || '#d9a441', ...(d.fig && { fig: d.fig }), ...(d.size > 1 && { size: d.size }), ...(d.sheet && { sheet: d.sheet }), ...(d.notes && { notes: d.notes }), ...(d.main && { main: true }), ...(d.darkvision != null && { darkvision: d.darkvision }), ...(d.lightCarried != null && { lightCarried: d.lightCarried }) });
def('pawn.bring', {
  level: 'area', cls: 'pawn',
  args: { id: 'id', def: 'id', x: 'num', z: 'num', y: 'num?', rot: 'num?', name: 'str?', owner: 'id?', color: 'color?', fig: 'str?', size: 'int?', sheet: 'text?', notes: 'long?', main: 'bool?', darkvision: 'numOrNone?', lightCarried: 'numOrNone?' },
  fill: (state, a) => { const d = state.pawns?.[a.def]; return d ? fromDef(d, a, state.seats[d.owner]?.color) : a; },
  check: ({ state, area, by }, a) => {
    if (area.entities[a.id]) return `id ${a.id} already exists`;
    if (state?.local) return null; // (a browser judging its own command before the relay answers: the relay decides)
    const d = benchDef(state, by, a.def); if (!d) return 'that is not one of your pawns';
    for (const T of Object.values(state.areas)) for (const e of Object.values(T.entities || {})) if (e.kind === 'token' && e.def === a.def) return `${d.name} is already on a table${T.id === area.id ? '' : ` (${T.name})`}`;
    return pawnDarkProblem(a) || figProblem(a);
  },
  apply: (t, a) => {
    let out = t;
    if (a.main && a.owner) for (const o of mainsOf(t, a.owner, a.id)) { const { main: _m, ...x } = o; out = put(out, x); }
    return put(out, pawnIntoRoom(out, { id: a.id, kind: 'token', name: a.name || 'Pawn', x: a.x, z: a.z, ...(a.y && { y: a.y }), rot: a.rot || 0, color: a.color || '#d9a441', owner: a.owner || null, conditions: [], hidden: false, locked: false, def: a.def,
      ...(a.fig && { fig: a.fig }), ...(a.size > 1 && { size: a.size }), ...(a.sheet && { sheet: a.sheet }), ...(a.notes && { notes: a.notes }), ...(a.main && { main: true }), ...(a.darkvision != null && { darkvision: a.darkvision }), ...(a.lightCarried != null && { lightCarried: a.lightCarried }) }, a));
  },
  touches: (a, t) => a.main && a.owner && t ? [a.id, ...mainsOf(t, a.owner, a.id).map(o => o.id)] : [a.id],
});
// SEND IT BACK to the bench: the pawn leaves the table; its definition stays. Its owner, whoever lent it, or the GM.
def('pawn.bench', {
  level: 'area', cls: 'pawn', args: { id: 'id' },
  check: ({ state, area, by }, a) => {
    const e = ent(area, a.id, 'token'); if (!e) return `no token ${a.id} in this area`;
    if (!e.def) return `${e.name} has no place on a bench (it was not brought on from one)`;
    const who = principalOf(state, by);
    return who.role === 'gm' || e.owner === who.id || e.lender === who.id ? null : `${e.name} belongs to someone else`;
  },
  apply: (t, a) => drop(t, a.id), touches: (a) => [a.id],
});

// DEFINE A PAWN (Settings ▸ Me ▸ My pawns): a figure from our set, a name, a sheet link, notes, whose pet it is, and
// whether it is the main one. A player defines her own; the GM anyone's (`owner`). Saving an existing id changes it.
// '' clears sheet, notes, fig ('none') and petOf.
def('pawn.define', {
  level: 'campaign', cls: 'pawn',
  args: { id: 'id', name: 'str?', fig: 'str?', size: 'int?', sheet: 'text?', notes: 'long?', petOf: 'idOrNone?', main: 'bool?', owner: 'id?', darkvision: 'numOrNone?', lightCarried: 'numOrNone?' },
  fill: (state, a, by) => { const old = state.pawns?.[a.id], who = principalOf(state, by); return { ...a, owner: old ? old.owner : (who?.role === 'gm' && a.owner) || who?.id, ...(a.sheet && { sheet: cleanSheet(a.sheet) }) }; },
  check: ({ state, by }, a) => {
    const old = state.pawns?.[a.id], who = principalOf(state, by), gm = who?.role === 'gm';
    if (old ? (!gm && old.owner !== who.id) : (!gm && a.owner && a.owner !== who.id)) return 'that pawn belongs to someone else';
    const owner = old ? old.owner : a.owner || who.id;
    if (!state.seats[owner] || state.seats[owner].kind !== 'human') return 'a pawn belongs to a person';
    if (!old && !(a.name || '').trim()) return 'a pawn needs a name';
    if (a.name !== undefined && !a.name.trim()) return 'a pawn needs a name';
    if (!old && Object.values(state.pawns || {}).filter(d => d.owner === owner).length >= DEFS_PER_SEAT) return `at most ${DEFS_PER_SEAT} pawns each`;
    if (a.petOf && (a.petOf === a.id || state.pawns?.[a.petOf]?.owner !== owner)) return 'petOf: another of the same person\'s pawns';
    return (a.sheet ? sheetProblem(cleanSheet(a.sheet)) : null) || pawnDarkProblem(a) || figProblem(a);
  },
  apply: (s, a) => {
    const old = s.pawns?.[a.id] || { id: a.id, owner: a.owner }, d = withDarkFields(old, a);
    if (a.name !== undefined) d.name = a.name.trim();
    if (a.fig !== undefined) { if (a.fig && a.fig !== 'none') d.fig = a.fig; else delete d.fig; }
    if (a.size !== undefined) { if (a.size > 1) d.size = a.size; else delete d.size; }
    for (const k of ['sheet', 'notes', 'petOf']) if (a[k] !== undefined) { if (a[k]) d[k] = a[k]; else delete d[k]; }
    if (a.main !== undefined) { if (a.main) d.main = true; else delete d.main; }
    const pawns = { ...(s.pawns || {}) };
    if (d.main) for (const o of Object.values(pawns)) if (o.owner === d.owner && o.main && o.id !== d.id) { const { main, ...x } = o; pawns[o.id] = x; } // one main pawn each
    pawns[d.id] = d;
    return { ...s, pawns };
  },
});
def('pawn.forget', {
  level: 'campaign', cls: 'pawn', args: { id: 'id' },
  check: ({ state, by }, a) => { const d = state.pawns?.[a.id], who = principalOf(state, by); return !d ? `no such pawn ${a.id}` : who.role !== 'gm' && d.owner !== who.id ? 'that pawn belongs to someone else' : null; },
  apply: (s, a) => { const pawns = { ...(s.pawns || {}) }; delete pawns[a.id]; for (const o of Object.values(pawns)) if (o.petOf === a.id) { const { petOf, ...x } = o; pawns[o.id] = x; } return { ...s, pawns }; },
});
// THE GM'S CAST: named individuals and saved groups (GM side only; never sent to a player seat: core/party.js castFor).
//   one     { name, fig?, size?, sheet?, notes?, gmNotes? }
//   group   { name, members: [{ name, fig?, size?, dx, dz }] }   dx, dz: feet from the lead (the first member)
// `at` is the campaign's seq when it was last saved or used, so the most recent come first. cast.use only moves `at`.
const castProblem = (a) => {
  if (a.kind === 'group') {
    const m = a.members;
    if (!Array.isArray(m) || !m.length || m.length > GROUP_MAX) return `a group is 1 to ${GROUP_MAX} pawns`;
    for (const x of m) if (!x || typeof x.name !== 'string' || !x.name.trim() || x.name.length > 80 || figProblem(x) || ![x.dx, x.dz].every(v => Number.isFinite(v) && Math.abs(v) <= 500)) return 'members: [{ name, fig?, size?, dx, dz }]';
    return null;
  }
  return a.members !== undefined ? 'only a group has members' : (a.sheet ? sheetProblem(cleanSheet(a.sheet)) : null) || figProblem(a);
};
def('cast.save', {
  level: 'campaign', cls: 'token.edit',
  args: { id: 'id', kind: 'enum:one|group?', name: 'str?', fig: 'str?', size: 'int?', sheet: 'text?', notes: 'long?', gmNotes: 'long?', members: 'obj?' },
  check: ({ state, by }, a) => {
    if (!isGmSide(state, by)) return { code: 'forbidden', why: 'the cast is the GM\'s' };
    const old = state.cast?.[a.id];
    if (!old && !(a.name || '').trim()) return 'a cast entry needs a name';
    if (a.name !== undefined && !a.name.trim()) return 'a cast entry needs a name';
    if (old && a.kind && a.kind !== old.kind) return 'a cast entry does not change kind';
    if (!old && Object.keys(state.cast || {}).length >= CAST_MAX) return `at most ${CAST_MAX} cast entries`;
    return castProblem({ ...a, kind: old?.kind || a.kind || 'one' });
  },
  apply: (s, a) => {
    const old = s.cast?.[a.id] || { id: a.id, kind: a.kind || 'one' }, c = { ...old, at: s.cseq + 1 };
    if (a.name !== undefined) c.name = a.name.trim();
    if (c.kind === 'group') { if (a.members) c.members = a.members.map(m => ({ name: m.name.trim(), ...(m.fig && m.fig !== 'none' && { fig: m.fig }), ...(m.size > 1 && { size: m.size }), dx: Math.round(m.dx * 100) / 100, dz: Math.round(m.dz * 100) / 100 })); }
    else {
      if (a.fig !== undefined) { if (a.fig && a.fig !== 'none') c.fig = a.fig; else delete c.fig; }
      if (a.size !== undefined) { if (a.size > 1) c.size = a.size; else delete c.size; }
      for (const k of ['sheet', 'notes', 'gmNotes']) if (a[k] !== undefined) { if (a[k]) c[k] = k === 'sheet' ? cleanSheet(a[k]) : a[k]; else delete c[k]; }
    }
    return { ...s, cast: { ...(s.cast || {}), [c.id]: c } };
  },
});
def('cast.use', {
  level: 'campaign', cls: 'token.edit', args: { id: 'id' },
  check: ({ state, by }, a) => !isGmSide(state, by) ? { code: 'forbidden', why: 'the cast is the GM\'s' } : state.cast?.[a.id] ? null : `no cast entry ${a.id}`,
  apply: (s, a) => ({ ...s, cast: { ...s.cast, [a.id]: { ...s.cast[a.id], at: s.cseq + 1 } } }),
});
def('cast.forget', {
  level: 'campaign', cls: 'token.edit', args: { id: 'id' },
  check: ({ state, by }, a) => !isGmSide(state, by) ? { code: 'forbidden', why: 'the cast is the GM\'s' } : state.cast?.[a.id] ? null : `no cast entry ${a.id}`,
  apply: (s, a) => { const cast = { ...s.cast }; delete cast[a.id]; return { ...s, cast }; },
});
// THE PARTY: one shared text everyone can edit (the last save wins), and the marching order (seat ids, front first).
def('party.set', {
  level: 'campaign', cls: 'chat', args: { notes: 'long?', order: 'list?' },
  check: ({ state }, a) => a.notes === undefined && a.order === undefined ? 'nothing to set' : a.notes !== undefined && a.notes.length > PARTY_NOTES_MAX ? `party notes are at most ${PARTY_NOTES_MAX} characters`
    : a.order && !(a.order.every(id => typeof id === 'string' && state.seats[id]) && new Set(a.order).size === a.order.length) ? 'order: seat ids, each once' : null,
  apply: (s, a) => ({ ...s, party: { ...(s.party || {}), ...(a.notes !== undefined && { notes: a.notes }), ...(a.order && { order: a.order }) } }),
});

// ---------------- shape validation & coercion ----------------
// Turns raw args (JSON from a socket, or strings from a GET query) into typed args, or explains why not.
const CLEARABLE = new Set(['sheet', 'notes', 'gmNotes', 'mark']);
export function parseArgs(type, raw, { fromQuery = false, depth = 0 } = {}) {
  const d = REGISTRY[type];
  if (!d) return { error: `unknown command ${type}. Known: ${Object.keys(REGISTRY).filter(k => !REGISTRY[k].internal && !REGISTRY[k].quiet).join(', ')}` };
  const out = {};
  for (const [k, spec0] of Object.entries(d.args)) {
    const opt = spec0.endsWith('?');
    const spec = opt ? spec0.slice(0, -1) : spec0;
    let v = raw?.[k];
    if (spec === 'idOrNone' && (v === '' || v === null)) { out[k] = ''; continue; }
    if (['intOrNone','numOrNone'].includes(spec) && (v === null || v === '' || v === 'none' || v === 'null')) { out[k] = null; continue; } // null (or an empty value in a query) takes the number away
    if (v === '' && opt && CLEARABLE.has(k)) { out[k] = ''; continue; } // '' clears a pawn's sheet link, notes or indicator
    if (v === undefined || v === null || v === '') { if (opt) continue; return { error: `missing ${k} (${spec})` }; }
    if (fromQuery && typeof v === 'string') {
      if (spec === 'num' || spec === 'int') v = Number(v);
      else if (spec === 'bool') v = v === 'true' || v === '1';
      else if (['intOrNone','numOrNone'].includes(spec)) v = Number(v);
      else if (['obj', 'vec3', 'quat', 'list', 'ops', 'keys'].includes(spec)) { try { v = JSON.parse(v); } catch { return { error: `${k} must be JSON` }; } }
      else if (spec === 'ids') v = v.split(',').filter(Boolean);
    }
    const bad = (why) => ({ error: `${k}: ${why}` });
    const num = (x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= LIM;
    if ((spec === 'id' || spec === 'idOrNone') && !isId(v)) return bad('not an id like tok_ab12cd34ef');
    if (['num','numOrNone'].includes(spec) && !num(v)) return bad('not a number');
    if (spec === 'int' && !(Number.isInteger(v) && Math.abs(v) <= 2 ** 31)) return bad('not an integer');
    if (spec === 'intOrNone' && !(Number.isInteger(v) && Math.abs(v) <= 2 ** 31)) return bad('not an integer (or none)');
    if (spec === 'key' && !TU.isTurnKey(v)) return bad('not a turn-order key: a pawn id (tok_…) or kind:<name>');
    if (spec === 'keys' && TU.orderProblem(v)) return bad(TU.orderProblem(v));
    if (spec === 'str' && !(typeof v === 'string' && v.length <= 80)) return bad('not a short string');
    if (spec === 'text' && !(typeof v === 'string' && v.length <= 500)) return bad('not text (500 characters at most)');
    if (spec === 'long' && !(typeof v === 'string' && v.length <= 4000)) return bad('not text (4000 characters at most)');
    if (spec === 'url' && !(typeof v === 'string' && v.length <= 200 && /^[\w./@-]+$/.test(v) && !v.includes('..'))) return bad('not an asset path');
    if (spec === 'color' && !(typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))) return bad('not a #rrggbb colour');
    if (spec === 'bool' && typeof v !== 'boolean') return bad('not true/false');
    if (spec === 'vec3' && !(Array.isArray(v) && v.length === 3 && v.every(num))) return bad('not [x, y, z]');
    if (spec === 'quat' && quatProblem(v)) return bad('not a unit quaternion [x, y, z, w]');
    if (spec === 'list' && !(Array.isArray(v) && v.length <= 100 && v.every(x => num(x) || (typeof x === 'string' && x.length <= 40)))) return bad('not a short list');
    if (spec === 'ids' && !(Array.isArray(v) && v.length && v.length <= 2000 && v.every(isId))) return bad('not a list of ids');
    if (spec === 'obj' && !(v && typeof v === 'object' && JSON.stringify(v).length < 400000)) return bad('not an object (or too large)');
    if (spec.startsWith('enum:') && !spec.slice(5).split('|').includes(v)) return bad(`one of ${spec.slice(5)}`);
    if (spec === 'ops') {
      if (depth || !Array.isArray(v) || !v.length || v.length > 2000) return bad('a list of {type, args} (1..2000)');
      const ops = [];
      for (const op of v) {
        if (!op || !BATCHABLE().includes(op.type)) return bad(`${op?.type} cannot go in a batch`);
        const p = parseArgs(op.type, op.args, { fromQuery: false, depth: 1 });
        if (p.error) return bad(`${op.type}: ${p.error}`);
        ops.push({ type: op.type, args: p.args });
      }
      v = ops;
    }
    out[k] = v;
  }
  return { args: out };
}

// ---------------- the checks the relay runs on every command ----------------
// ctx: { state, by, roomTypes? }. cmd: { type, area?, args } with args already parsed.
// Returns null when allowed, or { code, why } (code: 'forbidden' | 'invisible' | 'invalid').
export function checkCommand(ctx, cmd) {
  const d = REGISTRY[cmd.type];
  if (!d) return { code: 'invalid', why: `unknown command ${cmd.type}` };
  if (d.internal) return { code: 'invalid', why: `${cmd.type} is internal` };
  const { state, by } = ctx;
  if (!liveSeat(state, by)) return { code: 'forbidden', why: 'seat revoked or unknown' };
  const areaIds = d.level === 'area' ? [cmd.area] : d.areas ? d.areas(cmd.args) : [];
  for (const t of areaIds) {
    // invisible before forbidden: a seat that cannot see an area learns nothing about it, not even that it exists
    // (an area that does not exist gets the same answer, word for word: 2026-10-06)
    if (!state.areas[t] || !canSee(state, by, t)) return { code: 'invisible', why: 'no such area visible to you' };
  }
  if (d.type === 'batch') { // every op, with its own class, against the area as the earlier ops left it
    let area = state.areas[cmd.area];
    for (const op of cmd.args.ops) {
      const err = checkOne({ ...ctx, area }, REGISTRY[op.type], cmd.area, op.args);
      if (err) return { ...err, why: `${op.type}: ${err.why}` };
      area = REGISTRY[op.type].apply(area, op.args, { by });
    }
    return null;
  }
  if (d.level !== 'area') {
    const cls = typeof d.cls === 'function' ? d.cls(state, by, cmd.args) : d.cls;
    for (const t of areaIds.length ? areaIds : [null]) { const r = can(state, by, cls, t); if (!r.ok) return { code: 'forbidden', why: r.why }; }
    const why = d.check ? d.check({ ...ctx, area: null }, cmd.args) : null;
    return why ? (typeof why === 'object' ? why : { code: 'invalid', why }) : null; // (a check may name its own code: travel's "locked" is forbidden, not invalid)
  }
  return checkOne({ ...ctx, area: state.areas[cmd.area] }, d, cmd.area, cmd.args);
}
function checkOne(ctx, d, areaId, args) {
  const { state, by, area } = ctx;
  const cls = typeof d.cls === 'function' ? d.cls(state, by, args) : d.cls;
  const r = can(state, by, cls, areaId);
  if (!r.ok) return { code: 'forbidden', why: r.why };
  // the area's play settings bind the player side (Settings ▸ Area: free moves, what players may touch)
  if (!isGmSide(state, by) && (cls === 'token.move' || cls === 'open')) {
    const rules = areaRules(state, areaId);
    if (cls === 'token.move' && rules.freeMoves === false) return { code: 'forbidden', why: 'the GM has locked moves in this area' };
    if (cls === 'open' && rules.touch === 'none') return { code: 'forbidden', why: 'the GM has locked doors, chests and lights in this area' };
  }
  // things hidden from players do not exist for the player side: same answer as a missing id
  if (!isGmSide(state, by) && !d.incidental) for (const id of d.touches(args, area)) if (area.entities[id]?.hidden) return { code: 'invalid', why: `no ${id} in this area` };
  const why = d.check ? d.check(ctx, args) : null;
  return why ? { code: 'invalid', why } : null;
}

// Apply an area command to an area (pure). Used by the relay for commits and by clients for optimism.
export function applyArea(area, type, args, meta = {}) {
  return REGISTRY[type].apply(area, args, meta);
}

// The inverse of an area command against the area it is about to change: a command's own inverse when it has one
// (chat lines), else put every touched entity back exactly as it was.
export function inverseOf(area, type, args) {
  const d = REGISTRY[type];
  if (d.inverse) return d.inverse(area, args);
  const set = {};
  for (const id of d.touches(args, area)) set[id] = area.entities[id] ?? null;
  return { type: 'entities.set', args: { set } };
}

export const isAreaCommand = (type) => REGISTRY[type]?.level === 'area';
