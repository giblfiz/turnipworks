// The GET API: a thin wrapper over the SAME commands the browser sends (principle 7).
// Built for the weakest chat-window LLM: no tools, no MCP, no POST, no headers. It reads a rules card, fetches
// plain URLs, and gets small semantic JSON back. Writes are GETs carrying the seat token, a nonce (idempotency)
// and based_on (the seq it read), so a retry never double-applies and a stale plan is caught.
import { quatOfEntity } from '../core/orient.js';
import { REGISTRY } from '../core/commands.js';
import { can, canSee, entityVisible, visibilityOf } from '../core/perms.js';
import { entityPoint, areaCentroid, projectCampaign } from '../core/state.js';
import { seesLabels, stripEntity } from '../core/labels.js';
import { piecesOf, polyFeet } from '../core/footprint.js';
import * as H from '../core/height.js';
import { stairsOf, stairInfo, stairEnds, stairTop, stairBase, isConnector } from '../core/stairs.js';
import { FIGURES, findFigures, figureArgs, brief as figBrief } from './figures.js';
import { forPlayers as turnsForPlayers, turnRows, keyOfPawn, keyPawns, bonusOf, isTurnKey, turnKeyOf } from '../core/turns.js';
import { pawnKindLabel } from '../core/pawn.js';
import { isGmSide } from '../core/perms.js';
import { areaRules, RULE_KEYS } from '../core/state.js';
import { parseDice, rollDice } from '../core/dice.js';
import { factionCatalog, resolveFaction } from '../core/faction-catalog.js';
import { thingFor, lightOf, opens, findThings, placeArgs, similarArgs, freeSpot } from './things.js';
import { ruleCard, helpPage, CONDITIONS } from './llm-card.js';
export { ruleCard } from './llm-card.js';

const NONCE_RE = /^[\w.:-]{1,64}$/;
import { isId } from '../core/ids.js';
import crypto from 'node:crypto';

// Commands that CREATE something: the id may be left out and the relay mints one (returned as "id"); with a nonce the
// minted id is derived from it, so a retry gets the same id (Dawnhaven session, 2026-10-04: id="c123" was refused)
export const MINT = { 'token.create': 'tok', 'object.place': 'obj', 'room.spawn': 'room', 'chat.say': 'msg', 'dice.roll': 'msg', 'area.create': 'area', 'seat.create': 'seat', 'request.create': 'req' };
const mintId = (prefix, seat, nonce) => `${prefix}_${(nonce ? crypto.createHash('sha256').update(`${seat}|${nonce}`).digest('hex') : crypto.randomBytes(16).toString('hex')).replace(/[^0-9a-z]/g, '').slice(0, 12)}`;
// Units (2026-10-04): the GET API speaks FEET everywhere, reading and writing. Rooms sit on the 5-ft grid, so room.spawn's
// x, z, w, d (and room.move's dx, dz) are feet in multiples of 5; cells only by name: cx, cz, cw, cd (cdx, cdz).
// One release of backward compatibility: units=cells, or values that are not multiples of 5, read as the old cells.
const CELL_NAMES = { 'room.spawn': [['x', 'cx'], ['z', 'cz'], ['w', 'cw'], ['d', 'cd']], 'room.move': [['dx', 'cdx'], ['dz', 'cdz']] };
export function toCells(type, args, q) {
  const names = CELL_NAMES[type]; if (!names) return { args };
  const out = { ...args };
  if (names.some(([, c]) => q.has(c))) { for (const [f, c] of names) if (q.has(c)) { out[f] = q.get(c); delete out[c]; } return { args: out }; }
  const vals = names.map(([f]) => Number(out[f])).filter(v => Number.isFinite(v));
  if (q.get('units') === 'cells' || vals.some(v => v % 5 !== 0)) return { args: out, note: `read ${names.map(([f]) => f).join(', ')} as 5-ft CELLS (old units; deprecated, this release only): send feet in multiples of 5, or name cells ${names.map(([, c]) => c).join(', ')}` };
  for (const [f] of names) if (out[f] != null && out[f] !== '') out[f] = String(Number(out[f]) / 5);
  return { args: out };
}

function shapeArgs(rt, cmd, q) {
  const a = { ...cmd.args }, num = (k) => Number(a[k]);
  if (typeof a.outline === 'string' && a.outline) { // feet, absolute -> cells, relative to the room's rectangle
    let pts; try { pts = JSON.parse(a.outline); } catch { return { error: 'outline must be JSON: [[x, z], ...]' }; }
    if (!Array.isArray(pts) || !pts.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return { error: 'outline: [[x, z], ...] in feet' };
    const cells = CELL_NAMES['room.spawn'].some(([, c]) => q.has(c)) || q.get('units') === 'cells';
    a.outline = pts.map(([x, z]) => cells ? [x - num('x'), z - num('z')] : [x / 5 - num('x'), z / 5 - num('z')]);
  }
  if (q.get('clip') === '1' || q.get('clip') === 'true') {
    const rect = { x: num('x'), z: num('z'), w: num('w'), d: num('d') };
    if (!Object.values(rect).every(Number.isInteger) || rect.w < 1 || rect.d < 1 || rect.w > 16 || rect.d > 16) return { error: 'clip: x, z, w, d must be a rectangle on the 5-ft grid (5..80 ft a side)' };
    const E = rt.state.areas[cmd.area]?.entities || {}, [y0, y1] = H.spanOfArgs(E, { y: Number(a.y) || 0, tall: Number(a.tall) || 1 }); // only the rooms at this height are in the way
    const others = Object.values(E).filter(e => e.kind === 'room' && H.spansOverlap(y0, y1, H.roomY(e.recipe), H.roomTop(E, e))).map(e => e.recipe);
    const { pieces } = piecesOf(rect, others);
    if (!pieces.length) return { error: 'nothing to make: that rectangle is entirely inside existing rooms' };
    const p = pieces[0];
    if (p.hole) return { error: 'that rectangle would wrap right round another room; draw it beside the room instead' };
    Object.assign(a, { x: p.x, z: p.z, w: p.w, d: p.d, outline: p.outline });
    if (!p.outline) delete a.outline;
    return { args: a, note: `clip: made the part that does not overlap existing rooms${pieces.length > 1 ? ` (the larger of ${pieces.length} separate pieces; draw the others as their own rooms)` : ''}: ${p.cells * 25} sq ft, in a ${p.w * 5}×${p.d * 5} ft box at x=${p.x * 5}, z=${p.z * 5}${p.outline ? ', not a rectangle (see its outline in "state")' : ''}.` };
  }
  return { args: a };
}

// semantic view of an area for an LLM: ids, names, feet; rooms with their one-line summaries
export function areaForLlm(rt, seat, area) {
  const T = rt.state.areas[area];
  const seats = rt.state.seats;
  const labels = seesLabels(rt.state, seat, area);
  const es = Object.values(T.entities).filter(e => entityVisible(rt.state, seat, e)).map(e => labels ? e : stripEntity(e));
  const me = rt.state.seats[seat];
  const actAs = me.kind === 'llm' ? me.creator : me.id;
  // HEIGHT (docs/VERTICAL.md): everything this seat can see, by id; where a pawn stands is worked out from its height
  // against the rooms THIS SEAT can see (a hidden cellar under a pawn's feet says nothing)
  const seen = Object.fromEntries(es.map(e => [e.id, e]));
  const where = (e) => { const f = H.tokenFloor(seen, e); return { y: round(e.y || 0), storey: f.storey, level: f.level, ...(f.room && { room: f.room }) }; };
  // ROOFS (Stage F): the style each room's roof wears (its own, its building's, or by wall family), worked out as the client does
  let fam = new Map(); try { fam = new Map((rt.roomgen?.roomsOf(seen) || []).map(r => [r.id, r.family])); } catch { }
  const outdoor = (e) => !!rt.roomgen?.isOutdoor?.(e.recipe.type);
  const roofOf = (e) => H.roomY(e.recipe) < 0 || outdoor(e) ? null : { style: H.roofStyleOf(seen, e, (r) => fam.get(r.id)), ...(e.roof?.style && { own: true }), ...(e.roof?.off && { off: true }) };
  return {
    area: { id: T.id, name: T.name, visibility: visibilityOf(T), seq: T.seq },
    units: 'feet; x grows east, z grows south, y is height (0 = the ground, negative = below it); rooms are drawn on a 5-ft grid; a storey is 10 ft unless its building says otherwise',
    // figure: the miniature the pawn wears (an id in the figure list; absent = the plain pawn); squares: how many 5-ft squares a side its base covers
    // damage: counted up from 0 (0 = unhurt); there is no hp
    // the area's play rules (2026-10-20): fogOfWar, darkness (in the dark a player sees by darkvision and lights), light
    // (time of day), fog (atmosphere), freeMoves, touch (may players open and light things), grid
    rules: rulesOf(rt, area),
    tokens: es.filter(e => e.kind === 'token').map(e => pawnFor(rt, e, seats, actAs, where)),
    buildings: es.filter(e => e.kind === 'building').map(e => ({ id: e.id, name: e.name, base: H.baseOf(e), storeyHeight: H.storeyHeightOf(e), levels: H.levelsOf(seen, e.id), roof: e.roof || 'auto' })),
    rooms: es.filter(e => e.kind === 'room').map(e => ({
      id: e.id, type: e.recipe.type, ...(e.name && { name: e.name }), ...(e.building && { building: e.building }), x: e.recipe.x * 5, z: e.recipe.z * 5, w: e.recipe.w * 5, d: e.recipe.d * 5, y: H.roomY(e.recipe), height: H.roomHeight(seen, e), storey: H.storeyOf(seen, e), level: H.levelLabel(H.storeyOf(seen, e)), ...(e.recipe.tall > 1 && { tall: e.recipe.tall }), seed: e.recipe.seed, ...(e.recipe.turn && { turn: e.recipe.turn }), ...(e.hidden && { hidden: true }), ...(e.fog != null && { fog: e.fog }),
      ...(e.recipe.outline && { outline: polyFeet(e.recipe), shape: 'not a rectangle: x, z, w, d are its bounding box; outline is its true shape (feet)' }),
      ...(roofOf(e) && { roof: roofOf(e) }), ...factionField(rt, seen, e),
      objects: e.layout?.placements?.length || 0, summary: e.layout?.summary || null,
    })),
    // stairs and ladders: what each joins and where its two ends are (a pawn crosses with token.move&stair=ID)
    stairs: stairsOf(seen).map(s => stairInfo(seen, s)),
    // each thing's catalog piece ("cat"), and when it applies: light (its kind), lit, radius (feet, in the dark), open (a
    // door, chest, shutter), locked, pinned, faction (2026-10-20)
    objects: es.filter(e => e.kind === 'object').map(e => ({ id: e.id, name: e.name, x: round(e.x), z: round(e.z), y: round(e.y || 0), ...(isConnector(e) && { stair: true }), ...(quatOfEntity(e) && { quat: quatOfEntity(e) }), ...(e.room && { room: e.room }), ...(e.hidden && { hidden: true }), ...thingFor(rt, e) })),
    // measuring templates kept on the table (docs/RULERS.md), water, and the walls someone edited (a gap, a door swapped)
    templates: es.filter(e => e.kind === 'template').map(e => templateFor(rt, e)),
    water: es.filter(e => e.kind === 'water').map(e => ({ id: e.id, kind: e.body?.kind, points: e.body?.pts?.length || 0, ...(e.hidden && { hidden: true }) })),
    walls: es.filter(e => e.kind === 'edge').map(e => ({ key: e.key, ...(e.as && { as: e.as }), ...(e.piece && { piece: e.piece }), ...(e.doorType && { door: e.doorType }), ...(e.hidden && { hidden: true }) })),
    // THE TURN ORDER (docs/PAWNS.md): absent when there is none. Each entry is one pawn, or every pawn of a kind as one
    // ("Goblin ×3"); `current` marks whose turn it is; `initiative` is the number rolled or typed (null = not yet).
    // A seat on the player side is given the order without the entries it cannot see.
    ...turnsForLlm(rt, seat, T, seen, actAs),
    chat: (T.chat || []).slice(-10).map(c => ({ by: rt.state.seats[c.by]?.name || c.by, text: c.text, ...(c.roll && { roll: c.roll }) })),
  };
}
const round = (v) => Math.round(v * 100) / 100;
const rulesOf = (rt, area) => { const r = areaRules(rt.state, area); return Object.fromEntries(Object.keys(RULE_KEYS).filter(k => r[k] !== undefined && k !== 'music').map(k => [k, r[k]])); };
// a pawn as an AI seat reads it; darkvision, lightCarried and visionRadius only when the pawn has its own
const pawnFor = (rt, e, seats, actAs, where) => ({ id: e.id, name: e.name, x: round(e.x), z: round(e.z), ...where(e), owner: e.owner ? seats[e.owner]?.name || e.owner : null, yours: e.owner === actAs, damage: e.damage || 0, ...(e.conditions?.length && { conditions: e.conditions }), ...(e.mark && { mark: e.mark }), ...(e.fig && { figure: e.fig }), ...(e.size > 1 && { squares: e.size }), ...(e.main && { main: true }), ...(e.darkvision != null && { darkvision: e.darkvision }), ...(e.lightCarried != null && { lightCarried: e.lightCarried }), ...(e.visionRadius != null && { visionRadius: e.visionRadius }), ...(e.hidden && { hidden: true }) });
const templateFor = (rt, e) => ({ id: e.id, shape: e.shape, x: round(e.x), z: round(e.z), ...(e.y && { y: e.y }), dir: e.dir || 0, size: e.size, ...(e.width && { width: e.width }), ...(e.rounds && { rounds: e.rounds, left: e.left ?? e.rounds }), ...(e.attach && { attach: e.attach }), ...(e.name && { name: e.name }), owner: rt.state.seats[e.owner]?.name || null, ...(e.hidden && { hidden: true }) });
// a room's faction: its own, its building's, or its type's default (core/factions.js effectiveFaction); own: true when set on it
function factionField(rt, seen, e) { let f = null; try { f = rt.roomgen?.factionOf?.(seen, e) || null; } catch { } return f ? { faction: f, ...(e.recipe?.flavor && { factionOwn: true }) } : {}; }
const typeLabel = (rt, type) => { const m = rt._typeLabels || (rt._typeLabels = new Map((rt.roomgen?.typeList || []).map(t => [t.key, t.label]))); return m.get(type) || type; };
// what a seat may see of an area, labels and GM notes already taken out for those who may not have them
function seenOf(rt, seat, area) {
  const T = rt.state.areas[area], labels = seesLabels(rt.state, seat, area);
  const es = Object.values(T.entities).filter(e => entityVisible(rt.state, seat, e)).map(e => labels ? e : stripEntity(e));
  return { T, es, seen: Object.fromEntries(es.map(e => [e.id, e])), actAs: rt.state.seats[seat].kind === 'llm' ? rt.state.seats[seat].creator : seat };
}
const whereOf = (seen) => (e) => { const f = H.tokenFloor(seen, e); return { y: round(e.y || 0), storey: f.storey, level: f.level, ...(f.room && { room: f.room }) }; };
const roomBrief = (rt, seen, e, things) => ({ id: e.id, type: e.recipe.type, label: e.name || typeLabel(rt, e.recipe.type), ...(e.name && { name: e.name }), ...(e.building && { building: e.building }), x: e.recipe.x * 5, z: e.recipe.z * 5, w: e.recipe.w * 5, d: e.recipe.d * 5, y: H.roomY(e.recipe), level: H.levelLabel(H.storeyOf(seen, e)), ...(e.hidden && { hidden: true }), ...(e.locked && { locked: true }), ...factionField(rt, seen, e), things: things.filter(o => o.room === e.id).length });

// THE SCENE (2026-10-20): the first read for a weak model. Everything it needs to act on, small: the rooms (with their
// label for the GM side only), the pawns, the lights and the doors (things it can light and open) with ids, the stairs,
// the turn order and the last few lines of chat. The furniture itself is in /room/<ROOM_ID>; everything in /state.
export function sceneForLlm(rt, seat, area) {
  const { T, es, seen, actAs } = seenOf(rt, seat, area), seats = rt.state.seats;
  const things = es.filter(e => e.kind === 'object');
  const named = (o) => ({ id: o.id, name: o.name, ...(o.room && { room: o.room }) });
  return {
    area: { id: T.id, name: T.name, visibility: visibilityOf(T), seq: T.seq },
    rules: rulesOf(rt, area),
    rooms: es.filter(e => e.kind === 'room').map(e => roomBrief(rt, seen, e, things)),
    pawns: es.filter(e => e.kind === 'token').map(e => pawnFor(rt, e, seats, actAs, whereOf(seen))),
    lights: things.map(o => [o, lightOf(rt, o)]).filter(([, L]) => L).map(([o, L]) => ({ ...named(o), lit: L.lit, kind: L.kind, radius: L.radius, ...(o.locked && { locked: true }), ...(o.hidden && { hidden: true }) })),
    doors: things.filter(o => opens(rt, o)).map(o => ({ ...named(o), open: !!o.open, ...(o.locked && { locked: true }), ...(o.hidden && { hidden: true }) })),
    stairs: stairsOf(seen).map(s => { const i = stairInfo(seen, s); return { id: i.id, kind: i.kind, from: i.from, to: i.to, works: i.works }; }),
    ...(es.some(e => e.kind === 'template') && { templates: es.filter(e => e.kind === 'template').map(e => templateFor(rt, e)) }),
    ...turnsForLlm(rt, seat, T, seen, actAs),
    chat: (T.chat || []).slice(-5).map(c => ({ by: seats[c.by]?.name || c.by, text: c.text, ...(c.roll && { roll: c.roll }) })),
    more: 'room/ROOM_ID lists everything in one room; state has it all',
  };
}
// ONE ROOM (2026-10-20): the room, and every thing and pawn in it, with ids and what each can do. A room this seat may
// not see answers exactly like one that does not exist.
export function roomForLlm(rt, seat, area, id) {
  const { T, es, seen, actAs } = seenOf(rt, seat, area), r = seen[id];
  if (!r || r.kind !== 'room') return null;
  const things = es.filter(e => e.kind === 'object');
  const inRoom = (p) => H.tokenFloor(seen, p).room === id;
  return {
    area: { id: T.id, name: T.name, seq: T.seq },
    room: { ...roomBrief(rt, seen, r, things), storey: H.storeyOf(seen, r), height: H.roomHeight(seen, r), seed: r.recipe.seed, ...(r.recipe.tall > 1 && { tall: r.recipe.tall }), ...(r.fog != null && { fog: r.fog }), ...(r.recipe.outline && { outline: polyFeet(r.recipe) }), summary: r.layout?.summary || null },
    things: things.filter(o => o.room === id).map(o => ({ id: o.id, name: o.name, x: round(o.x), z: round(o.z), y: round(o.y || 0), ...(o.rot && { rot: round(o.rot) }), ...(isConnector(o) && { stair: true }), ...(o.hidden && { hidden: true }), ...thingFor(rt, o) })),
    pawns: es.filter(e => e.kind === 'token' && inRoom(e)).map(e => pawnFor(rt, e, rt.state.seats, actAs, whereOf(seen))),
    stairs: stairsOf(seen).map(s => stairInfo(seen, s)).filter(s => s.from === id || s.to === id),
  };
}
function turnsForLlm(rt, seat, T, seen, actAs) {
  const turns = isGmSide(rt.state, seat) ? T.turns : turnsForPlayers(T);
  if (!turns) return {};
  const A = { ...T, entities: seen, turns };
  return { turns: { round: turns.round, current: turns.at, started: turns.at != null, order: turnRows(A).map(r => ({ key: r.key, name: r.name, pawns: r.ids, initiative: r.init, bonus: r.bonus, ...(r.current && { current: true }), ...(r.ids.some(id => seen[id]?.owner === actAs) && { yours: true }), ...(r.out && { notInOrder: true }), ...(r.hidden && { hidden: true }) })) } };
}
// ROLL INITIATIVE over GET: do?cmd=turn.roll&id=TOKEN (or &key=KEY). The RELAY rolls d20 and adds the entry's bonus
// ("the result comes from the roller or the server"); n=17 is taken as the number instead (dice rolled at the table).
// The roll shows in the chat as any roll does, unless every pawn of the entry is hidden from players (a roll line
// would give it away). Then turn.init puts the entry in its place. Checked as turn.init is: a player's seat (and her
// agents) may roll only for her own pawn.
function turnRoll(rt, seat, cmd, q, nonce) {
  const T = rt.state.areas[cmd.area];
  if (!T) return { ok: false, code: 'invisible', why: 'no such area visible to you' };
  if (!T.turns) return { ok: false, code: 'invalid', why: 'there is no turn order here (the GM starts one: turn.start)' };
  const id = q.get('id'), e = id ? T.entities[id] : null;
  if (id && (!e || e.kind !== 'token' || !entityVisible(rt.state, seat, e))) return { ok: false, code: 'invalid', why: `no token ${id} in this area` };
  const key = e ? (keyOfPawn(T.turns, e) || turnKeyOf(e)) : q.get('key');
  if (!isTurnKey(key)) return { ok: false, code: 'invalid', why: 'turn.roll needs id=TOKEN (or key=KEY as "turns" in state lists them)' };
  const typed = q.has('n') && q.get('n') !== '' ? Number(q.get('n')) : null;
  if (typed !== null && !Number.isInteger(typed)) return { ok: false, code: 'invalid', why: 'n: a whole number (the initiative you rolled yourself)' };
  const bonus = bonusOf(T, T.turns, key) || 0, die = typed === null ? crypto.randomInt(1, 21) : null, n = typed ?? die + bonus;
  // the number first (it is the part that can be refused: not your pawn, no such entry), then the roll line
  const res = rt.dispatch(seat, { type: 'turn.init', area: cmd.area, args: { key, n } }, { cid: nonce || null });
  if (!res.ok) return res;
  let shown = false, note;
  const ps = keyPawns(T, T.turns, key);
  if (typed === null && !res.duplicate && ps.some(p => !p.hidden) && can(rt.state, seat, 'chat', cmd.area).ok) {
    const name = ps.length > 1 ? pawnKindLabel(ps[0]) : ps[0].name;
    const r = rt.dispatch(seat, { type: 'dice.roll', area: cmd.area, args: { id: mintId('msg', seat, nonce ? nonce + ':roll' : null), expr: bonus ? `d20${bonus < 0 ? '-' : '+'}${Math.abs(bonus)}` : 'd20', rolls: [die], total: n, why: `Initiative: ${name}`.slice(0, 80) } }, { cid: nonce ? `${nonce}:roll` : null });
    shown = !!r.ok; if (!r.ok) note = `the number is set; the roll line was not posted: ${r.why}`;
  }
  rt.llmSeen.set(seat, Date.now());
  const now = rt.state.areas[cmd.area].turns;
  return { ...res, key, initiative: n, ...(typed === null ? { roll: die, bonus } : { typed: true }), place: now.order.indexOf(key) + 1, of: now.order.length, shownInChat: shown, ...(note && { note }) };
}

// the follow filter (Harry 2026-10-04: AI seats wake on any say or roll): kinds=chat,roll keeps only says and rolls, each
// with who (name, human or AI), its area, and the text or the roll
const KIND_OF = { 'chat.say': 'chat', 'dice.roll': 'roll' };
export const parseKinds = (q) => q.has('kinds') ? new Set(String(q.get('kinds')).split(',').map(k => k.trim()).filter(Boolean)) : null;
function talkEvents(rt, seat, area, entries, kinds) {
  const T = rt.state.areas[area];
  return entries.filter(e => kinds.has(KIND_OF[e.type])).map(e => {
    const who = rt.state.seats[e.by];
    return { seq: e.seq, area, areaName: T?.name, kind: KIND_OF[e.type], by: who?.name || e.by, byId: e.by, byKind: who?.kind === 'llm' ? 'ai' : 'human', you: e.by === seat,
      ...(e.type === 'chat.say' ? { text: e.args.text } : { roll: { expr: e.args.expr, rolls: e.args.rolls, total: e.args.total, ...(e.args.why && { why: e.args.why }) } }) };
  });
}
// who is where, pointing at what (Harry 2026-10-04: "Fauna, what do you think of this chair?"): every other seat in an
// area this seat can see, with its cursor (feet), its area, and its current selection as ids with names. Hidden things
// are left out for anyone who couldn't see them; walls and posts read as "wall" / "post".
export function presenceFor(rt, seat) {
  const now = Date.now(), online = rt.online(), out = [];
  for (const [sid, p] of rt.lastPres) {
    const s = rt.state.seats[sid];
    if (!s || sid === seat || !online.has(sid) || now - p.at > 120e3 || !canSee(rt.state, seat, p.area)) continue;
    const T = rt.state.areas[p.area], labels = seesLabels(rt.state, seat, p.area);
    const selection = (p.sel || []).map(id => {
      if (id.startsWith('wall:')) return { id, name: id[5] === 'c' ? 'post' : 'wall' };
      const e = T?.entities[id]; if (!e || !entityVisible(rt.state, seat, e)) return null;
      const v = labels ? e : stripEntity(e);
      return { id, kind: e.kind, name: v.name || v.recipe?.type || e.cat || e.kind, ...(e.cat && { cat: e.cat }), ...(e.x != null && { x: round(e.x), z: round(e.z) }) };
    }).filter(Boolean);
    out.push({ seat: sid, name: s.name, kind: s.kind === 'llm' ? 'ai' : 'human', role: s.role, color: s.color, area: p.area, areaName: T?.name, cursor: p.cursor && !(p.secret && !isGmSide(rt.state, seat)) ? [round(p.cursor[0]), round(p.cursor[1])] : null, selection, secondsAgo: Math.round((now - p.at) / 1000) });
  }
  for (const [sid, g] of rt.ghosts || []) { // other AI seats: where their ghost cursor is
    const s = rt.state.seats[sid];
    if (!s || sid === seat || !g?.area || !canSee(rt.state, seat, g.area) || g.secret) continue;
    out.push({ seat: sid, name: s.name, kind: 'ai', role: s.role, color: s.color, area: g.area, areaName: rt.state.areas[g.area]?.name, cursor: g.pos ? [round(g.pos[0]), round(g.pos[1])] : null, selection: [] });
  }
  return { seats: out };
}
// a campaign-wide cursor over every area the seat can see: "area_x:12,area_y:7" (pass it back as after=)
const cursorOf = (seqs) => Object.entries(seqs).map(([a, n]) => `${a}:${n}`).join(',');
const parseCursor = (s) => Object.fromEntries(String(s || '').split(',').map(x => x.split(':')).filter(([a, n]) => a && Number.isFinite(+n)).map(([a, n]) => [a, +n]));
function campaignTalk(rt, seat, after, kinds) {
  const areas = rt.state.areaOrder.filter(a => canSee(rt.state, seat, a));
  const seqs = {}, events = [];
  for (const a of areas) {
    const T = rt.state.areas[a], from = after[a] ?? T.seq;
    const r = rt.entriesAfter(a, Math.min(from, T.seq), seat);
    if (!r.resync) events.push(...talkEvents(rt, seat, a, r.entries, kinds));
    seqs[a] = T.seq;
  }
  return { events, cursor: cursorOf(seqs), areas };
}

// Route GET /c/:cid/... for any seat (LLM or human). Returns [status, body, contentType].
export async function handleGet(rt, seat, token, rest, q, base) {
  const s = rt.state.seats[seat];
  const isLlm = s.kind === 'llm';
  if (isLlm) rt.llmSeen.set(seat, Date.now());
  // the card and its help pages write the SHORT form of the seat's token into every address (relay/tokens.js short)
  const shortTok = rt.tokens.short ? rt.tokens.short(rt.id, s) : token;
  if (rest[0] === 'card' || rest.length === 0) return [200, ruleCard(rt, seat, base, shortTok), 'text/plain; charset=utf-8'];
  // THE HELP PAGES the card links to (2026-10-20): /help lists them, /help/<topic> is one (relay/llm-card.js)
  if (rest[0] === 'help') return [200, helpPage(rt, seat, base, shortTok, rest[1] || null), 'text/plain; charset=utf-8'];
  // CATALOGS (2026-10-20): the library's pieces (things?q=candle), the room types by kind, the factions, the conditions
  if (rest[0] === 'things') { const qq = q.get('q') || ''; return [200, { ok: true, ...(qq ? { q: qq, things: findThings(rt, qq, Math.min(40, Number(q.get('limit')) || 12)) } : { how: 'add q=WORDS (q=candle, q=chest, q=barrel); put one down with object.place&cat=ID&x=FEET&z=FEET' }) }]; }
  if (rest[0] === 'rooms') { const groups = {}; for (const t of rt.roomgen?.typeList || []) (groups[t.group || 'Inn & home'] ||= []).push({ type: t.key, name: t.label, ...(t.cells && { size_ft: t.cells.map(n => n * 5) }) }); return [200, { ok: true, how: 'room.spawn&type=TYPE&x=FEET&z=FEET&w=FEET&d=FEET', groups }]; }
  if (rest[0] === 'factions') { const lib = rt.roomgen?.lib; return [200, { ok: true, how: 'faction.set&id=ROOM_OR_BUILDING_ID&flavor=FACTION (flavor=inherit goes back)', factions: lib ? factionCatalog(lib).factions.map(f => ({ id: f.id, name: f.label, group: f.group })) : [] }]; }
  if (rest[0] === 'conditions') return [200, { ok: true, how: 'token.set&id=PAWN_ID&conditions=prone,poisoned (the whole list; conditions= clears); any short word works', conditions: CONDITIONS }];
  if (rest[0] === 'state') return [200, { you: rt.describeSeat(seat), campaign: projectCampaign(rt.state, seat, rt.online()) }];
  // THE FIGURE LIST, searched: /c/<campaign>/figures?q=owlbear (name, id, group, class, race, tags, SRD monster names)
  if (rest[0] === 'figures') { const qq = q.get('q') || ''; return [200, { ok: true, total: FIGURES.list.length, ...(qq ? { q: qq, figures: findFigures(qq, Math.min(40, Number(q.get('limit')) || 12)) } : { groups: Object.fromEntries([...new Set(FIGURES.list.map(f => f.group))].map(g => [g, FIGURES.list.filter(f => f.group === g).length])), examples: FIGURES.list.filter((f, i) => i % Math.max(1, Math.floor(FIGURES.list.length / 12)) === 0).slice(0, 12).map(figBrief), how: 'add q=WORDS to search (q=owlbear, q=elf+wizard, q=townsfolk)' }) }]; }
  if (rest[0] === 'token') { // re-issue a seat's token (invite links): GM, or the seat's creator
    const target = rt.state.seats[q.get('for')];
    if (!target) return [404, { ok: false, why: 'no such seat' }];
    if (!(target.creator === seat || can(rt.state, seat, 'seat.admin').ok)) return [403, { ok: false, code: 'forbidden', why: 'only the GM or the creator' }];
    return [200, { ok: true, seat: target.id, token: rt.tokens.mint(rt.id, target) }];
  }
  if (rest[0] === 'do') return [200, act(rt, seat, { type: q.get('cmd'), args: Object.fromEntries(q) }, q)];
  if (rest[0] === 'presence') return [200, presenceFor(rt, seat)];
  if (rest[0] === 'changes') { // campaign-wide follow: says and rolls in every area you can see (kinds=chat,roll by default)
    const kinds = parseKinds(q) || new Set(['chat', 'roll']);
    const after = parseCursor(q.get('after'));
    const wait = Math.min(30, Math.max(0, Number(q.get('wait') ?? 25)));
    const now = campaignTalk(rt, seat, after, kinds);
    if (now.events.length || wait === 0) return [200, { events: now.events, cursor: now.cursor }];
    const from = Object.fromEntries(now.cursor.split(',').filter(Boolean).map(x => x.split(':')).map(([a, n]) => [a, +n]));
    return new Promise(resolve => {
      let done = false, offs = [];
      const finish = (force) => {
        if (done) return;
        const r = campaignTalk(rt, seat, from, kinds);
        if (!r.events.length && !force) { arm(); return; } // something else changed (a move, a spawn): keep sleeping
        done = true; clearTimeout(timer); offs.forEach(f => f());
        resolve([200, { events: r.events, cursor: r.cursor }]);
      };
      const arm = () => { offs.forEach(f => f()); offs = now.areas.map(a => rt.wait(a, () => finish(false))); };
      arm();
      const timer = setTimeout(() => finish(true), wait * 1000);
    });
  }
  if ((rest[0] === 'a' || rest[0] === 't') && rest[1]) { // /a/<area>/…; /t/ is the pre-rename alias (one release)
    const area = rest[1];
    // invisible areas answer exactly like missing ones: a player's agent learns nothing about GM-only areas
    if (!canSee(rt.state, seat, area)) return [404, { ok: false, code: 'invisible', why: 'no such area visible to you' }];
    const T = rt.state.areas[area];
    const op = rest[2] || 'state';
    // the AI seat's ghost cursor glides to what it reads; into a hidden room it is the GM side's only (2026-10-20: a GM
    // assistant's look or room read inside a hidden room used to show its ghost there to the players)
    const glide = (pt) => { if (isLlm) rt.ghostTo(seat, area, pt, true, isGmSide(rt.state, seat) && rt.cursorInHidden(area, pt)); };
    if (op === 'state') {
      glide(areaCentroid(T));
      return [200, areaForLlm(rt, seat, area)];
    }
    if (op === 'scene') {
      glide(areaCentroid(T));
      return [200, sceneForLlm(rt, seat, area)];
    }
    if (op === 'room') {
      const v = rest[3] ? roomForLlm(rt, seat, area, rest[3]) : null;
      if (!v) return [404, { ok: false, code: 'invalid', why: `no room ${String(rest[3] || '').slice(0, 40)} in this area ("rooms" in the scene lists them)` }];
      glide([v.room.x + v.room.w / 2, v.room.z + v.room.d / 2]);
      return [200, v];
    }
    if (op === 'look') {
      const x = +q.get('x'), z = +q.get('z'), r = Math.min(200, +(q.get('r') || 10));
      if (!Number.isFinite(x) || !Number.isFinite(z)) return [400, { ok: false, why: 'x and z (feet) required' }];
      glide([x, z]);
      // y (optional): only what is on the storey at that height (within 5 ft above it and below the next floor); without
      // it, everything at every height near the point, each with its own y and storey
      const vis = Object.values(T.entities).filter(e => entityVisible(rt.state, seat, e)), seen = Object.fromEntries(vis.map(e => [e.id, e]));
      const yq = q.has('y') && q.get('y') !== '' ? +q.get('y') : null;
      if (yq !== null && !Number.isFinite(yq)) return [400, { ok: false, why: 'y (feet) must be a number' }];
      const hOf = (e) => e.kind === 'room' ? H.roomY(e.recipe) : e.y || 0;
      const sOf = (e) => e.kind === 'room' ? H.storeyOf(seen, e) : H.tokenFloor(seen, e).storey;
      const near = vis.map(e => seesLabels(rt.state, seat, area) ? e : stripEntity(e)).map(e => ({ e, p: entityPoint(e) })).filter(({ e, p }) => p && Math.hypot(p[0] - x, p[1] - z) <= r && (yq === null || (hOf(e) >= yq - 0.5 && hOf(e) < yq + H.STOREY - 0.5)))
        .map(({ e, p }) => ({ id: e.id, kind: e.kind, name: e.name || e.recipe?.type, x: round(p[0]), z: round(p[1]), y: round(hOf(e)), storey: sOf(e), level: H.levelLabel(sOf(e)), dist: round(Math.hypot(p[0] - x, p[1] - z)) })).sort((a, b) => a.dist - b.dist);
      return [200, { seq: T.seq, at: [x, z], ...(yq !== null && { y: yq }), r, near }];
    }
    if (op === 'changes' && parseKinds(q)) { // only says and rolls wake you (kinds=chat,roll)
      const kinds = parseKinds(q), after = Number(q.get('after') ?? T.seq);
      const wait = Math.min(30, Math.max(0, Number(q.get('wait') ?? 25)));
      const pick = () => { const r = rt.entriesAfter(area, Math.min(after, T.seq), seat); return r.resync ? { resync: true, seq: T.seq, events: [], why: 'too far behind; read state again' } : { events: talkEvents(rt, seat, area, r.entries, kinds), seq: r.seq }; };
      const now = pick();
      if (now.events.length || now.resync || wait === 0) return [200, now];
      return new Promise(resolve => {
        let done = false, off = null;
        const finish = (force) => {
          if (done) return;
          if (!canSee(rt.state, seat, area)) { done = true; clearTimeout(timer); off?.(); return resolve([200, { ok: false, code: 'invisible', why: 'area no longer visible' }]); }
          const r = pick();
          if (!r.events.length && !r.resync && !force) { off = rt.wait(area, () => finish(false)); return; }
          done = true; clearTimeout(timer); off?.(); resolve([200, r]);
        };
        off = rt.wait(area, () => finish(false));
        const timer = setTimeout(() => finish(true), wait * 1000);
      });
    }
    if (op === 'changes') {
      const after = Number(q.get('after') ?? T.seq);
      const wait = Math.min(30, Math.max(0, Number(q.get('wait') ?? 25)));
      const now = rt.entriesAfter(area, after, seat);
      if (now.resync || now.entries.length || wait === 0) return [200, now.resync ? { ...now, why: 'too far behind; read state again' } : now];
      return new Promise(resolve => {
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); off(); resolve([200, canSee(rt.state, seat, area) ? rt.entriesAfter(area, after, seat) : { ok: false, code: 'invisible', why: 'area no longer visible' }]); };
        const off = rt.wait(area, finish);
        const timer = setTimeout(finish, wait * 1000);
      });
    }
    if (op === 'do') return [200, act(rt, seat, { type: q.get('cmd'), area, args: Object.fromEntries(q) }, q)];
  }
  return [404, { ok: false, why: 'unknown path; fetch the rules card: /c/<campaign>/card?seat=<token>' }];
}

// WHAT A WEAK MODEL TYPES, made exact (2026-10-20, from the live trials in experiments/2026-10-20-llm-api/): the same
// command the browser sends, with the arguments a chat window can type filled in or read the way it meant them.
//   lists        conditions=prone,poisoned (and order=a,b) as well as JSON; conditions= with nothing clears
//   switches     true/false, 1/0, yes/no, on/off; anything else is REFUSED (before, hidden=hide read as false: revealed)
//   entity.flag  id= as well as ids=
//   area.set     a play rule by name (darkness=true, fogOfWar=true, light=night, touch=none; =default goes back) into its settings
//   faction.set  flavor by name (Sun, dragon, "Sword & shield")
//   room.reroll  the relay solves the new layout (seed optional), as it does for room.spawn
function friendly(rt, seat, cmd, q) {
  const d = REGISTRY[cmd.type]; if (!d) return { cmd };
  const a = { ...cmd.args };
  for (const [k, spec0] of Object.entries(d.args)) {
    const spec = spec0.replace('?', ''), v = a[k];
    if (typeof v !== 'string') continue;
    if ((spec === 'list' || spec === 'keys') && !v.trim().startsWith('[')) a[k] = JSON.stringify(v.split(',').map(x => x.trim()).filter(Boolean));
    if (spec === 'bool') { const b = { true: 'true', '1': 'true', yes: 'true', on: 'true', false: 'false', '0': 'false', no: 'false', off: 'false' }[v.trim().toLowerCase()]; if (!b) return { error: `${k}: true or false (not "${v.slice(0, 20)}")` }; a[k] = b; }
  }
  if (cmd.type === 'entity.flag' && !a.ids && a.id) a.ids = a.id;
  if (cmd.type === 'area.set') {
    const set = {}; let n = 0;
    for (const k of Object.keys(RULE_KEYS)) if (a[k] != null) { const v = String(a[k]); n++; set[k] = v === 'default' ? null : RULE_KEYS[k] === 'bool' ? ['true', '1', 'yes', 'on'].includes(v.toLowerCase()) : v; delete a[k]; }
    if (n) { let was = {}; try { was = a.settings ? JSON.parse(a.settings) : {}; } catch { return { error: 'settings must be JSON' }; } a.settings = JSON.stringify({ ...was, ...set }); }
  }
  if (cmd.type === 'faction.set' && a.flavor && rt.roomgen?.lib && a.flavor !== 'inherit' && !factionCatalog(rt.roomgen.lib).factions.some(f => f.id === a.flavor)) a.flavor = resolveFaction(rt.roomgen.lib, a.flavor) || a.flavor;
  return { cmd: { ...cmd, args: a } };
}
// A ROLL OVER GET (2026-10-20): THE RELAY ROLLS. An AI seat sends expr (d20, 2d6, 4d6kh3, d20adv) and optionally bonus
// and why; the numbers are drawn here with the browser's own parser (core/dice.js), so no chat window can pick its luck.
// Numbers an AI seat sends anyway are ignored (said in "note"). A person's seat over GET may still send its own rolls
// and total (dice rolled at the table), as before. There is no `throw` (no physics here): every browser that has the
// area open throws the dice itself and lands them on these numbers (client/surfaces/dice.js "A ROLL WITH NO THROW").
function diceArgs(rt, seat, a) {
  const m = String(a.expr || '').trim().match(/^(.*?)\s*(adv|advantage|dis|disadvantage)?$/i); // (d20adv and "d20 adv" alike)
  let expr = m[1].replace(/\s+(?=\d|d\d)/gi, '+'); // (a "+" in a URL is a space: "d20 5" meant d20+5)
  const bonus = a.bonus != null && a.bonus !== '' ? Number(a.bonus) : 0;
  if (!Number.isInteger(bonus) || Math.abs(bonus) > 1000) return { error: 'bonus: a whole number (bonus=-1 subtracts)' };
  if (bonus) expr = `${expr}${bonus < 0 ? '-' : '+'}${Math.abs(bonus)}`;
  if (m[2]) expr += ` ${m[2]}`;
  const p = parseDice(expr);
  if (!p) return { error: `expr: not a roll ("${String(a.expr || '').slice(0, 30)}"); try expr=d20, expr=2d6, expr=4d6kh3, expr=d20adv, with bonus=NUMBER` };
  const own = rt.state.seats[seat].kind !== 'llm' && a.rolls != null && a.total != null;
  if (own) return { args: a };
  const r = rollDice(p), { bonus: _, ...rest } = a;
  return { args: { ...rest, expr: p.label, rolls: JSON.stringify(r.rolls), total: String(r.total) }, rolled: r, ...(a.rolls != null && { note: 'the relay rolls for AI seats: the rolls and total you sent were not used' }) };
}

function act(rt, seat, cmd0, q) {
  const nonce = q.get('nonce');
  if (nonce != null && !NONCE_RE.test(nonce)) return { ok: false, code: 'invalid', why: 'nonce: letters, digits, _ . : - (max 64)' };
  if (cmd0.type === 'turn.roll') return turnRoll(rt, seat, cmd0, q, nonce);
  const fr = friendly(rt, seat, cmd0, q);
  if (fr.error) return { ok: false, code: 'invalid', why: fr.error };
  let cmd = fr.cmd, minted = null, extra = {};
  // a retry of an action already done answers as it did, before anything is rolled or worked out again (with the id it
  // made, and a roll's numbers read back from its chat line)
  if (nonce && rt.nonces.has(`${seat}|${nonce}`)) {
    const id = MINT[cmd.type] && (cmd.args.id || mintId(MINT[cmd.type], seat, nonce)), line = cmd.type === 'dice.roll' && (rt.state.areas[cmd.area]?.chat || []).find(c => c.id === id);
    return { ...rt.nonces.get(`${seat}|${nonce}`), duplicate: true, ...(id && { id }), ...(line?.roll && { expr: line.roll.expr, rolls: line.roll.rolls, total: line.roll.total }) };
  }
  const E = rt.state.areas[cmd.area]?.entities || {}, sees = (id) => !!E[id] && entityVisible(rt.state, seat, E[id]);
  if (cmd.type === 'dice.roll') {
    const r = diceArgs(rt, seat, cmd.args); if (r.error) return { ok: false, code: 'invalid', why: r.error };
    cmd = { ...cmd, args: r.args }; if (r.rolled) extra = { expr: r.args.expr, rolls: r.rolled.rolls, total: r.rolled.total }; if (r.note) extra.note = r.note;
  }
  // A PIECE OF THE LIBRARY BY ITS ID: object.place&cat=candlestick (the mesh and its size from the library), in the room
  // it stands in (so it moves, turns and hides with that room)
  if (cmd.type === 'object.place' && cmd.args.cat && cmd.args.place !== 'stair') {
    const r = placeArgs(rt, cmd.args); if (r.error) return { ok: false, code: 'invalid', why: r.error };
    cmd = { ...cmd, args: r.args };
    if (!cmd.args.room && cmd.args.x != null) { const seen = Object.fromEntries(Object.entries(E).filter(([id]) => sees(id))), f = H.floorUnder(seen, +cmd.args.x, +cmd.args.z, +(cmd.args.y || 0)); if (f?.room) cmd = { ...cmd, args: { ...cmd.args, room: f.room } }; }
  }
  // REPLACE WITH SIMILAR: object.replace&id=THING with no cat picks the next look of the piece, else a close cousin
  if (cmd.type === 'object.replace' && cmd.args.id) {
    if (!sees(cmd.args.id) || E[cmd.args.id].kind !== 'object') return { ok: false, code: 'invalid', why: `no object ${cmd.args.id}` };
    const r = cmd.args.cat ? placeArgs(rt, { ...cmd.args, name: cmd.args.name || cmd.args.cat.replace(/-/g, ' ') }) : similarArgs(rt, E[cmd.args.id], cmd.args);
    if (r.error) return { ok: false, code: 'invalid', why: r.error };
    const { place, y, room, ...rest } = r.args; cmd = { ...cmd, args: rest };
  }
  // RE-ROLL OR RETYPE A ROOM: the relay solves it (the browser's app.rerollRoom: pinned things stay)
  if (cmd.type === 'room.reroll' && !cmd.args.layout && sees(cmd.args.id) && E[cmd.args.id].kind === 'room' && rt.roomgen) {
    const r = E[cmd.args.id], seed = cmd.args.seed != null && cmd.args.seed !== '' ? Number(cmd.args.seed) : crypto.randomInt(1, 1e6), type = cmd.args.type || null;
    if (type && !rt.roomgen.types.has(type)) return { ok: false, code: 'invalid', why: `unknown room type ${type} (the list: /rooms)` };
    let L; try { L = rt.roomgen.solve(E, { id: r.id, type: type || r.recipe.type, seed }, r.order, rt.roomgen.pinnedOf(E, r.id)); } catch (err) { return { ok: false, code: 'invalid', why: `could not re-roll: ${err.message}` }; }
    cmd = { ...cmd, args: { ...cmd.args, seed: String(seed), engineVersion: rt.roomgen.version, layout: JSON.stringify({ hash: L.hash, summary: L.summary, objects: L.objects }) } };
  }

  const prefix = MINT[cmd.type];
  if (prefix) {
    const id = cmd.args.id;
    if (id == null || id === '') { minted = mintId(prefix, seat, nonce); cmd = { ...cmd, args: { ...cmd.args, id: minted } }; }
    else if (!isId(id)) return { ok: false, code: 'invalid', why: `id: "${String(id).slice(0, 40)}" is not an id like ${prefix}_ab12cd34ef. Leave id out and the relay makes one (the answer gives it back).` };
  }
  const conv = toCells(cmd.type, cmd.args, q);
  cmd = { ...cmd, args: conv.args };
  // A ROOM THAT IS NOT A RECTANGLE (2026-10-05), for seats that speak GET:
  //   outline=[[x,z],...]  its outline, in the same units as x and z (feet, absolute), clockwise from its top-left corner
  //   clip=1               "make whatever part of this rectangle does not overlap existing rooms" (what dragging a room
  //                        over others does in the browser): the relay works out the outline; the larger piece when the
  //                        rectangle is cut in two
  if (cmd.type === 'room.spawn') {
    const shaped = shapeArgs(rt, cmd, q);
    if (shaped.error) return { ok: false, code: 'invalid', why: shaped.error };
    cmd = { ...cmd, args: shaped.args }; if (shaped.note) conv.note = [conv.note, shaped.note].filter(Boolean).join(' ');
  }
  // A PAWN WEARING A FIGURE: token.create&fig=FIGURE_ID (and token.set&fig=...). The id is checked against the figure
  // list, the base's size comes from the list, and a pawn with no name takes the figure's.
  if (cmd.type === 'token.create' || cmd.type === 'token.set') {
    const fa = figureArgs(cmd.type, cmd.args);
    if (fa.error) return { ok: false, code: 'invalid', why: fa.error };
    cmd = { ...cmd, args: fa.args };
  }
  // INTO A ROOM: token.create&room=ROOM (or token.move&id=PAWN&room=ROOM) with no x and z: the free square nearest the
  // room's middle, on its floor. Only a room this seat may see.
  if ((cmd.type === 'token.create' || cmd.type === 'token.move') && cmd.args.room && (cmd.args.x == null || cmd.args.x === '')) {
    const r = E[cmd.args.room];
    if (!r || r.kind !== 'room' || !sees(r.id)) return { ok: false, code: 'invalid', why: `no room ${String(cmd.args.room).slice(0, 40)} in this area ("rooms" in the scene lists them)` };
    const size = Number(cmd.args.size) || (cmd.type === 'token.move' ? E[cmd.args.id]?.size : 1) || 1;
    const others = Object.fromEntries(Object.entries(E).filter(([id, e]) => id !== cmd.args.id && sees(id)));
    const at = freeSpot(others, r, size);
    if (!at) return { ok: false, code: 'invalid', why: `no free square in ${r.name || r.recipe.type}; give x and z` };
    cmd = { ...cmd, args: { ...cmd.args, x: String(at.x), z: String(at.z), ...(at.y && { y: String(at.y) }) } };
  }
  // A PAWN ACROSS A STAIR: token.move&id=TOKEN&stair=STAIR_ID puts the pawn at the stair's other end (the top landing
  // if it is at or below the stair's foot, else the foot). x, z and y are worked out here; only stairs the seat can see.
  if (cmd.type === 'token.move' && q.get('stair')) {
    const E = rt.state.areas[cmd.area]?.entities || {}, s = E[q.get('stair')], t = E[cmd.args.id];
    if (!s || !isConnector(s) || !entityVisible(rt.state, seat, s)) return { ok: false, code: 'invalid', why: `no stair ${q.get('stair')} in this area ("stairs" in state lists them)` };
    if (!t || t.kind !== 'token') return { ok: false, code: 'invalid', why: `no token ${cmd.args.id} in this area` };
    const ends = stairEnds(s, E, t), to = q.get('to') === 'top' ? ends.top : q.get('to') === 'bottom' ? ends.foot : (t.y || 0) < (stairBase(s) + stairTop(s)) / 2 ? ends.top : ends.foot;
    cmd = { ...cmd, args: { ...cmd.args, x: to.x, z: to.z, y: to.y } };
  }
  const basedOn = q.has('based_on') ? Number(q.get('based_on')) : null;
  const res = rt.dispatch(seat, cmd, { cid: nonce || null, basedOn: Number.isFinite(basedOn) ? basedOn : null, force: q.get('force') === '1', fromQuery: true, stair: q.get('stair') !== '0' });
  if (res.ok && !res.duplicate) rt.llmSeen.set(seat, Date.now());
  const placed = res.ok && (cmd.type === 'token.create' || (cmd.type === 'token.move' && cmd.args.room) || cmd.type === 'object.place') ? { at: { x: Number(cmd.args.x), z: Number(cmd.args.z), ...(cmd.args.y != null && { y: Number(cmd.args.y) }) } } : {};
  return { ...res, ...(prefix && res.ok && { id: cmd.args.id }), ...(res.ok && extra), ...placed, ...(cmd.type === 'object.replace' && res.ok && { now: cmd.args.cat }), ...((conv.note || (!res.ok && extra.note)) && { note: [conv.note, extra.note].filter(Boolean).join(' ') }) };
}
