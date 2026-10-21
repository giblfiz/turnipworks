// One live campaign on the relay: authoritative state, the per-area ordered logs, undo, idempotency,
// subscriptions, presence routing and the synthesized presence of LLM seats.
//
// dispatch() is the relay's one door. Socket commands and GET commands both come through it, so an LLM seat and
// a browser are checked by exactly the same code (core/commands.js checkCommand) and land in the same log.
import { emptyFog, fogFor } from '../core/fog.js';
import { REGISTRY, checkCommand, applyArea, inverseOf, parseArgs, prepareRoomHiding, pawnIntoRoom, HIDE_ROOM_HIDES_PLAYER_PAWNS } from '../core/commands.js';
import { newCampaign, projectCampaign, areaForClient, entityPoint, areaCentroid } from '../core/state.js';
import { canSee, liveSeat, principalOf, isGmSide, entityVisible } from '../core/perms.js';
import { newId } from '../core/ids.js';
import { buildingAt, spanOfArgs, floorUnder } from '../core/height.js';
import { Journal } from './store.js';
import { seesLabels, stripEntry, stripEntity, stripEntities, unnoteEntry, unnoteEntity, unnoteEntities } from '../core/labels.js';
import { seesDamageUndo } from '../core/pawn.js';
import { forPlayers as turnsForPlayers } from '../core/turns.js';
import { cleanRuler } from '../core/measure.js';
import { partySignature } from '../core/party.js';
import { DATA_FORMAT, migrateSnapshot, migrateRecord, migrateCommand, migratePawns, migrateStairs, migrateTilts } from '../core/migrate.js';
import { migrateStair } from '../core/stairs.js';

const TAIL = 2000;        // log entries kept per area for reconnect catch-up
const SNAP_EVERY = 100;   // records between snapshots
const NONCES = 5000;      // remembered (seat, nonce) results for idempotency
const UNDO_DEPTH = 200;

const CHAT_CMDS = new Set(['chat.say', 'dice.roll']);
export const CHAT_RATE = { min: 3, hour: 20 };
export const LOOP_MAX = 3, LOOP_HOLD = 60e3;

export class CampaignRuntime {
  constructor({ id, dir, tokens, roomgen = null, log = () => {} }) {
    Object.assign(this, { id, tokens, roomgen, log });
    this.journal = new Journal(dir);
    this.state = null;
    this.r = 0;
    this.tails = new Map();   // area -> [entry]
    this.undo = new Map();    // area -> [{seq, inv, xid, by, undone}]  (per-seat undo: `by` is whose action it was)
    this.redo = new Map();    // `${area}|${seat}` -> [{inv}]
    this.nonces = new Map();  // `${seat}|${nonce}` -> result
    this.conns = new Set();
    this.waiters = new Map(); // area -> Set(fn) for long-polls
    this.ghosts = new Map();  // llm seat -> {area, pos, target, thinking, ...}
    this.llmSeen = new Map(); // llm seat -> last request ms (counts as online)
    this.chatLog = new Map(); // llm seat -> [ms of its says/rolls] (rate limit)
    this.aiRun = new Map();   // area -> { pair: [seat, seat], last, n } (AI-to-AI loop breaker)
    this.chatHold = new Map(); // llm seat -> ms until which its chat is throttled
    this.lastPres = new Map(); // human seat -> { area, cursor, sel, at } (GET /presence)
    this.sinceSnap = 0;
  }

  // ---------------- lifecycle ----------------
  load({ stairs = true } = {}) { // (stairs: false leaves old stairs as they were stored; the migration's own test compares the two)
    const { snap: snap0, records: recs0 } = this.journal.load();
    const snap = migrateSnapshot(snap0), records = recs0.map(migrateRecord); // old "table" files read as areas
    if (snap) {
      this.r = snap.r; this.state = snap.state;
      this.tails = new Map(snap.tails); this.undo = new Map(snap.undo); this.nonces = new Map(snap.nonces); this.redo = new Map(snap.redo || []);
    }
    for (const rec of records) this.applyRecord(rec);
    if (this.journal.truncated) this.log(`${this.id}: cut a torn journal tail of ${this.journal.truncated} bytes`);
    if (!this.state) throw new Error(`campaign ${this.id} has no genesis`);
    // hit points -> damage (2026-10-06, core/migrate.js): old pawns are converted once the campaign is in memory, and a
    // fresh snapshot is written so the old journal lines behind it are never replayed again
    const pawns = migratePawns(this);
    // (2026-10-11: the same pass unlocks a pawn saved locked, and takes the lock out of stored undo and redo steps)
    if (pawns) { const L = migratePawns.last; this.snapshot(); this.log(`${this.id}: ${pawns} old pawn records converted (${L.pawns} pawns in play, ${L.unlocked} of them unlocked: the pawn lock is dropped; ${L.stored} stored undo / redo / log entries)`); }
    // the planner's stairs -> ordinary placed stairs (2026-10-11, core/migrate.js): the same way
    const st = stairs ? migrateStairs(this, this.roomgen?.stairPieceOf || null) : { stairs: 0, stored: 0 };
    if (st.stairs || st.stored) { this.snapshot(); this.log(`${this.id}: ${st.stairs} stair(s) are now ordinary placed stairs (${st.stored} more in undo history)`); }
    // a thing's tilt (tiltZ, 2026-10-11) -> its orientation (quat, 2026-10-12, core/orient.js): the same way
    const tl = migrateTilts(this);
    if (tl.things || tl.stored) { this.snapshot(); this.log(`${this.id}: ${tl.things} tilted thing(s) now carry an orientation (${tl.stored} more in undo history)`); }
    return { replayed: records.length, fromSnapshot: !!snap, pawns, stairs: st.stairs, tilts: tl.things };
  }

  // A new campaign: genesis, the GM's seat and a first area, all journaled like everything else.
  static create({ id, dir, name, gmName, tokens, roomgen, log }) {
    const rt = new CampaignRuntime({ id, dir, tokens, roomgen, log });
    rt.journal.load();
    const gm = newId('seat'), t1 = newId('area');
    rt.commit({ by: null, genesis: { id, name, defaults: { fogOfWar: true, sharedPartyVision: false } } });
    rt.commit({ by: null, camp: { type: 'area.create', args: { id: t1, name: 'Area 1', visibility: 'open' } } });
    rt.commit({ by: null, camp: { type: 'seat.create', args: { id: gm, kind: 'human', role: 'gm', name: gmName || 'GM', color: '#e0b04a', location: t1 } } });
    return { rt, gmSeat: gm, token: tokens.mint(id, rt.state.seats[gm]) };
  }

  snapshot() {
    const tails = [...this.tails].map(([t, es]) => [t, es.slice(-300)]);
    this.journal.snapshot({ format: DATA_FORMAT, r: this.r, state: this.state, undo: [...this.undo], redo: [...this.redo], nonces: [...this.nonces].slice(-NONCES), tails });
    this.sinceSnap = 0;
  }
  close() { clearTimeout(this.partyTimer); this.snapshot(); this.journal.close(); for (const c of this.conns) c.close(); }

  // ---------------- records: the only way state changes ----------------
  // Journal first (fdatasync), then apply in memory, then broadcast. Replay calls applyRecord alone.
  commit(rec0) {
    const rec = { r: this.r + 1, at: Date.now(), ...rec0, fx: rec0.fx || [] };
    this.journal.append(rec);
    this.applyRecord(rec);
    if (++this.sinceSnap >= SNAP_EVERY) this.snapshot();
    return rec;
  }

  applyRecord(rec) {
    this.r = rec.r;
    if (rec.genesis) { this.state = newCampaign(rec.genesis.id, rec.genesis.name);
      // Historical genesis records omit defaults: existing campaigns keep fog off.
      if (rec.genesis.defaults) this.state.defaults = { ...rec.genesis.defaults }; }
    if (rec.camp && REGISTRY[rec.camp.type].apply) {
      this.state = REGISTRY[rec.camp.type].apply(this.state, rec.camp.args, { by: rec.by });
    }
    if (rec.camp || rec.genesis) this.state = { ...this.state, cseq: this.state.cseq + 1 };
    const actor = rec.as || rec.by; // whose action this is (a GM undoing Brakka's move acts AS Brakka for redo)
    for (const fx of rec.fx) {
      const t = this.state.areas[fx.area];
      const ids = REGISTRY[fx.type].touches ? REGISTRY[fx.type].touches(fx.args, t) : [];
      const next = { ...applyArea(t, fx.type, fx.args, { by: fx.type === 'fog.explore' ? (principalOf(this.state,rec.by)?.id || rec.by) : rec.by }), seq: fx.seq };
      this.state = { ...this.state, areas: { ...this.state.areas, [fx.area]: next } };
      // priv: the entry touches something hidden from players (before or after). Player-side seats get a projection.
      const priv = ids.some(id => t.entities[id]?.hidden || next.entities[id]?.hidden);
      // pre: of the touched ids, the ones a player could see BEFORE this entry. A projection only has to take away what a
      // player had; things that were hidden all along (or are born hidden) are not mentioned to players at all
      const pre = priv ? ids.filter(id => t.entities[id] && !t.entities[id].hidden) : undefined;
      const entry = { area: fx.area, seq: fx.seq, type: fx.type, args: fx.args, by: rec.by, cid: rec.cid || null, xid: fx.xid, undoOf: rec.undo?.seq, ids, priv, ...(pre && { pre }) };
      if (!this.tails.has(fx.area)) this.tails.set(fx.area, []);
      const tail = this.tails.get(fx.area);
      tail.push(entry); if (tail.length > TAIL) tail.splice(0, tail.length - TAIL);
      if (fx.inv) {
        if (!this.undo.has(fx.area)) this.undo.set(fx.area, []);
        const u = this.undo.get(fx.area);
        // The Keep bar writes immediately, but its successive settings are one creation gesture.
        // Only the same seat/template/session at that seat's undo head can join. Another seat's
        // unrelated actions are fine; edits to this template, undo/redo or an idle interval close it. Store this metadata so journal replay agrees.
        const last = u.findLast(it => it.by === actor && !it.undone), session = fx.args.keepSession;
        const joinsKeep = fx.type === 'template.set' && session && last?.keep
          && !last.undone && last.by === actor && last.keep.id === fx.args.id
          && last.keep.session === session && tail[0].seq <= last.keep.seq + 1
          && !tail.some(e => e.seq > last.keep.seq && e.seq < fx.seq && e.ids.includes(fx.args.id) && !['turn.next', 'turn.prev'].includes(e.type))
          && rec.at >= last.keep.at && rec.at - last.keep.at <= 10000;
        if (joinsKeep) { last.keep.at = rec.at; last.keep.seq = fx.seq; }
        else u.push({ seq: fx.seq, inv: fx.inv, xid: fx.xid || null, by: actor, undone: false,
          ...(fx.type === 'template.place' && session && { keep: { id: fx.args.id, session, at: rec.at, seq: fx.seq } }),
          ...(damageIds(fx) && { dmg: damageIds(fx) }) });
        if (u.length > UNDO_DEPTH) u.splice(0, u.length - UNDO_DEPTH);
        if (!rec.undo && !rec.redo) this.redo.delete(`${fx.area}|${actor}`); // a fresh action clears your redo
      }
    }
    if (rec.undo) {
      for (const it of this.undo.get(rec.undo.area) || []) if (it.seq === rec.undo.seq) it.undone = true;
      // a transfer is one undo step on both areas it touched
      if (rec.undo.xid) for (const u of this.undo.values()) for (const it of u) if (it.xid === rec.undo.xid) it.undone = true;
      if (rec.undo.redo) { const k = `${rec.undo.area}|${rec.undo.who}`; if (!this.redo.has(k)) this.redo.set(k, []); this.redo.get(k).push({ inv: rec.undo.redo }); }
    }
    if (rec.redo) this.redo.get(`${rec.redo.area}|${rec.redo.who}`)?.pop();
    if (rec.by && rec.cid) {
      this.nonces.set(`${rec.by}|${rec.cid}`, { ok: true, r: rec.r, seqs: Object.fromEntries(rec.fx.map(f => [f.area, f.seq])), cseq: this.state.cseq, result: rec.result });
      if (this.nonces.size > NONCES * 1.2) for (const k of [...this.nonces.keys()].slice(0, this.nonces.size - NONCES)) this.nonces.delete(k);
    }
  }

  // ---------------- the one door ----------------
  // cmd: { type, area?, args (raw) }. opts: { cid (nonce), basedOn, force, fromQuery, conn }
  dispatch(by, cmd0, opts = {}) {
    const cmd = migrateCommand(cmd0); // `table`, `table.create` and friends from an old client or agent
    const { cid = null } = opts;
    if (cid && this.nonces.has(`${by}|${cid}`)) return { ...this.nonces.get(`${by}|${cid}`), duplicate: true };
    const d = REGISTRY[cmd.type];
    if (!d || d.internal) return { ok: false, code: 'invalid', why: `unknown command ${cmd.type}` };
    const p = parseArgs(cmd.type, cmd.args || {}, { fromQuery: !!opts.fromQuery });
    if (p.error) return { ok: false, code: 'invalid', why: p.error };
    const c = { type: cmd.type, area: d.level === 'area' ? cmd.area : null, args: p.args };
    // a room made without a layout or a building (a seat that speaks GET) joins the building it touches or stands on (an
    // upper storey belongs to the building below it, core/height.js), or starts a new one, as a room drawn in the browser does
    if (c.type === 'room.spawn' && !c.args.layout && !c.args.building && this.state.areas[c.area]) { const E = this.state.areas[c.area].entities, b = buildingAt(E, c.args, spanOfArgs(E, c.args)); c.args = b ? { ...c.args, building: b } : { ...c.args, building: newId('bld'), buildingName: `Building ${Object.values(E).filter(e => e.kind === 'building').length + 1}` }; }
    // The relay resolves faction assets from its own library. A client may preview swaps optimistically,
    // but cannot substitute another slot, omit followers, or smuggle arbitrary URLs into the journal.
    if (c.type === 'faction.set' || (c.type === 'batch' && c.args.ops.some(op => op.type === 'faction.set'))) {
      if (!this.roomgen?.factionChange) return { ok: false, code: 'invalid', why: 'faction library unavailable on the relay' };
      let area = this.state.areas[c.area];
      if (!area) return { ok: false, code: 'invalid', why: 'unknown area' };
      try {
        const normalize = op => {
          const next = op.type === 'faction.set' ? { ...op, args: this.roomgen.factionChange(area.entities, op.args.id, op.args.flavor) } : op;
          const state = { ...this.state, areas: { ...this.state.areas, [c.area]: area } };
          const problem = checkCommand({ state, by, roomTypes: this.roomgen.types }, { ...next, area: c.area });
          if (problem) throw new Error(problem.why || 'invalid faction operation');
          area = REGISTRY[next.type].apply(area, next.args);
          return next;
        };
        if (c.type === 'batch') c.args = { ops: c.args.ops.map(normalize) };
        else c.args = normalize(c).args;
      } catch (error) { return { ok: false, code: 'invalid', why: error.message }; }
    }
    const err = checkCommand({ state: this.state, by, roomTypes: this.roomgen?.types }, c);
    if (err) return { ok: false, ...err };
    if (CHAT_CMDS.has(c.type)) { const g = this.chatGuard(by, c.area); if (g) return g; }
    // what only the relay decides, written into the command before it is journaled (core/commands.js `fill`): a new
    // area's visibility (the first is open, later ones start hidden), a travelling pawn's arrival and whether it opens the area
    if (d.fill) c.args = d.fill(this.state, c.args, by);
    c.args = prepareRoomHiding(this.state, c.type, c.args);
    if (c.type === 'undo') return this.doUndo(by, c, cid);
    if (c.type === 'redo') return this.doRedo(by, c, cid);

    // staleness (GET seats send based_on): did anything this command touches change since they looked?
    if (opts.basedOn != null && d.level === 'area' && !opts.force && d.stale === 'reject') {
      const T = this.state.areas[c.area];
      if (opts.basedOn < T.seq) {
        const tail = this.tails.get(c.area) || [];
        const after = tail.filter(e => e.seq > opts.basedOn);
        const covered = tail.length && tail[0].seq <= opts.basedOn + 1;
        const mine = new Set(d.touches(c.args));
        const clash = !covered || after.some(e => REGISTRY[e.type].touches(e.args).some(id => mine.has(id)));
        if (clash) return { ok: false, code: 'stale', why: `the area changed since seq ${opts.basedOn}; read the changes and retry with based_on=${T.seq} (or add force=1)`, seq: T.seq, changes: covered ? after.map(e => slim(this.entryFor(by, e))) : null }; // (as this seat may see them: they were raw entries before 2026-10-06)
      }
    }

    // a `place: 'stair'` object is the old way of saying a stair (an AI seat's notes, a page loaded before 2026-10-11):
    // it is put down as the ordinary kind (core/stairs.js migrateStair), so nothing of the old shape is ever stored anew
    const plain = (a) => a?.place === 'stair' ? (({ kind, ...e }) => e)(migrateStair({ kind: 'object', ...a }, this.roomgen?.stairPieceOf || null)) : a;
    if (c.type === 'object.place') c.args = plain(c.args);
    else if (c.type === 'batch' && Array.isArray(c.args?.ops)) c.args = { ...c.args, ops: c.args.ops.map(op => op?.type === 'object.place' ? { ...op, args: plain(op.args) } : op) };
    let stair = null, stairWhy = null;
    if (c.type === 'room.spawn' && !c.args.layout) {
      if (!this.roomgen) return { ok: false, code: 'invalid', why: 'room engine unavailable on the relay; send a solved layout' };
      const T = this.state.areas[c.area];
      // a storey with no connection gets a stair, as in the browser (core/stairs.js): planned before the room is
      // furnished (the layout keeps off the hole and the landing), committed as its own command right after the room
      // (one undo removes just the stair). A seat that wants none says stair=0.
      let ents = T.entities;
      if (c.args.y && opts.stair !== false && this.roomgen.stairFor) {
        const stub = { id: c.args.id, kind: 'room', recipe: { ...c.args, wallFamily: c.args.wallFamily || 'auto' }, building: c.args.building, order: T.order + 1 };
        const P = this.roomgen.stairFor({ ...T.entities, [stub.id]: stub }, stub);
        if (P) { stair = { id: newId('obj'), ...P.args }; ents = { ...T.entities, [stair.id]: { kind: 'object', ...stair } }; } else stairWhy = this.roomgen.stairFor.why || '';
      }
      const L = this.roomgen.solve(ents, c.args, T.order + 1);
      c.args = { ...c.args, layout: { hash: L.hash, summary: L.summary, objects: L.objects }, engine: 'v2', engineVersion: this.roomgen.version };
    }

    let rec;
    if (c.type === 'fog.reset') {
      const states = Object.fromEntries(Object.values(this.state.areas).map(t=>[t.id,t.fog||emptyFog()]));
      const xid = newId('fog');
      rec = this.commit({by,cid,camp:{type:c.type,args:c.args},fx:Object.values(this.state.areas).map(t=>({area:t.id,seq:t.seq+1,type:'fog.clear',args:{},xid,
        inv:t.id===c.args.area?{type:'fog.restoreAll',args:{states,merge:true}}:null}))});
    } else if (d.level === 'area') {
      const T = this.state.areas[c.area];
      rec = this.commit({ by, cid, fx: [{ area: c.area, seq: T.seq + 1, type: c.type, args: c.args, inv: inverseOf(T, c.type, c.args) }] });
    } else if (c.type === 'transfer') {
      rec = this.commit({ by, cid, camp: { type: 'transfer', args: c.args }, fx: this.transferFx(c.args) });
    } else if (c.type === 'travel') {
      // a pawn to another area: the two halves of a transfer, in one record with the travel itself (which opens the area
      // when the GM sends a player's pawn into a hidden one). The answer says where it arrived and what was opened.
      const fx = this.transferFx(c.args, { hide: !!c.args.opens });
      rec = this.commit({ by, cid, camp: { type: 'travel', args: c.args }, fx, result: { to: c.args.to, x: c.args.x, z: c.args.z, y: c.args.y, opened: !!c.args.opens, seq: fx[0].seq } });
    } else {
      const result = c.type === 'seat.create' ? { seat: c.args.id } : undefined;
      rec = this.commit({ by, cid, camp: { type: c.type, args: c.args }, result });
    }
    if (CHAT_CMDS.has(c.type)) this.noteChat(by, c.area);
    this.afterCommit(rec, by, opts.conn);
    const out = { ok: true, r: rec.r, seqs: Object.fromEntries(rec.fx.map(f => [f.area, f.seq])), cseq: this.state.cseq, result: rec.result };
    if (c.type === 'seat.create') out.token = this.tokens.mint(this.id, this.state.seats[c.args.id]);
    if (stair) { const r2 = this.dispatch(by, { type: 'object.place', area: c.area, args: stair }, { cid: cid ? `${cid}:stair` : null, conn: opts.conn }); out.stair = r2.ok ? stair.id : null; if (!r2.ok) out.stairNote = `no stair added: ${r2.why}`; }
    else if (stairWhy) out.stairNote = `no stair added: ${stairWhy}`;
    return out;
  }

  // ---------------- AI seats: chat guardrails (Harry 2026-10-04: AI seats wake on every say and roll, restraint is etiquette;
  // these back it up). Human seats are never limited.
  //   rate limit   an AI seat may say/roll CHAT_RATE.min times a minute and CHAT_RATE.hour times an hour (code rate_limited)
  //   loop breaker two AI seats alternating more than LOOP_MAX times with no human message between: both are throttled
  //                for LOOP_HOLD ms (code throttled); any human say or roll in that area resets the count
  isAi(seat) { return this.state.seats[seat]?.kind === 'llm'; }
  chatGuard(by, area, now = Date.now()) {
    if (!this.isAi(by)) return null;
    const hold = this.chatHold.get(by) || 0;
    if (hold > now) return { ok: false, code: 'throttled', why: `AI seats were answering each other with no human in between; your chat is paused for ${Math.ceil((hold - now) / 1000)} s. Wait for a human.`, retry_after: Math.ceil((hold - now) / 1000) };
    const ts = (this.chatLog.get(by) || []).filter(t => now - t < 3600e3);
    const lastMin = ts.filter(t => now - t < 60e3);
    if (lastMin.length >= CHAT_RATE.min) return { ok: false, code: 'rate_limited', why: `at most ${CHAT_RATE.min} messages a minute for an AI seat; try again in ${Math.ceil((60e3 - (now - lastMin[0])) / 1000)} s`, retry_after: Math.ceil((60e3 - (now - lastMin[0])) / 1000) };
    if (ts.length >= CHAT_RATE.hour) return { ok: false, code: 'rate_limited', why: `at most ${CHAT_RATE.hour} messages an hour for an AI seat`, retry_after: Math.ceil((3600e3 - (now - ts[0])) / 1000) };
    const run = this.aiRun.get(area);
    if (run && run.last !== by && this.isAi(run.last) && run.pair.includes(by) && run.pair.length === 2 && run.n + 1 > LOOP_MAX) {
      for (const s of run.pair) this.chatHold.set(s, now + LOOP_HOLD);
      this.aiRun.delete(area);
      this.log(`${this.id}: AI chat loop between ${run.pair.join(' and ')} in ${area}: throttled ${LOOP_HOLD / 1000} s`);
      return { ok: false, code: 'throttled', why: `you and another AI seat have answered each other ${LOOP_MAX} times with no human in between; your chat is paused for ${LOOP_HOLD / 1000} s`, retry_after: LOOP_HOLD / 1000 };
    }
    return null;
  }
  noteChat(by, area, now = Date.now()) {
    if (!this.isAi(by)) { this.aiRun.delete(area); return; } // a human spoke: the AI-to-AI count starts again
    this.chatLog.set(by, [...(this.chatLog.get(by) || []).filter(t => now - t < 3600e3), now]);
    const run = this.aiRun.get(area);
    if (!run || run.last === by) { if (!run) this.aiRun.set(area, { pair: [by], last: by, n: 0 }); return; }
    if (run.pair.length === 2 && run.pair.includes(by)) { run.n++; run.last = by; return; }
    this.aiRun.set(area, { pair: [run.last, by], last: by, n: 1 }); // a new pair starts alternating
  }

  // a transfer as two area effects in one record, with a shared xid; its undo is the reverse transfer
  // hide: this is a travel that OPENED `to` for the players; its undo must hide `to` again (Harry 2026-10-06)
  transferFx(a, { inv = true, hide = false } = {}) {
    const F = this.state.areas[a.from], T = this.state.areas[a.to];
    const e = F.entities[a.id];
    // room and parent ids belong to the old area: a thing arriving elsewhere stands on its own
    let moved = { ...e, ...(a.x != null && { x: a.x }), ...(a.z != null && { z: a.z }), ...(a.y != null && { y: a.y }), ...(e.kind === 'object' && { room: null, parent: null }) };
    if (e.kind === 'token') {
      if (!inv && a._restorePawnHide) {
        moved = { ...moved, hidden: a._restorePawnHide.hidden };
        delete moved.hiddenByRoom;
        if (a._restorePawnHide.hiddenByRoom) moved.hiddenByRoom = a._restorePawnHide.hiddenByRoom;
      } else moved = pawnIntoRoom(T, moved, prepareRoomHiding(this.state, 'token.move', {}));
    }
    const xid = newId('x');
    const back = inv ? { type: 'transfer', args: { id: a.id, from: a.to, to: a.from, ...(e.x != null && { x: e.x, z: e.z }), ...(a.y != null && { y: e.y || 0 }), ...(hide && { hide: true }), ...(e.kind === 'token' && { _restorePawnHide: { hidden: !!e.hidden, hiddenByRoom: e.hiddenByRoom || null } }) } } : undefined;
    return [
      { area: a.from, seq: F.seq + 1, type: 'transfer.out', args: { id: a.id, to: a.to }, xid, inv: back },
      { area: a.to, seq: T.seq + 1, type: 'transfer.in', args: { entity: moved, from: a.from }, xid, inv: back },
    ];
  }

  // Per-seat undo (Figma's model): your own latest action in this area, or, for the GM side, anyone's (`who`).
  // The undo record carries the redo (a snapshot of what the undo is about to overwrite), so redo survives restarts.
  doUndo(by, c, cid) {
    const who = c.args.who || by;
    const items = (this.undo.get(c.area) || []).filter(u => !u.undone && u.by === who && (c.args.seq == null || u.seq === c.args.seq));
    const it = items.at(-1);
    // someone else's action: the GM side may undo anything; the owner of a pawn may undo a DAMAGE change made to it, named by
    // its seq (core/pawn.js seesDamageUndo: Harry 2026-10-06, "everyone can change everyones HP ... it comes with an undo float")
    if (who !== by && !isGmSide(this.state, by)) {
      const E = this.state.areas[c.area]?.entities || {};
      const mine = it && c.args.seq != null && it.dmg?.length && it.dmg.every(id => E[id] && !E[id].hidden && seesDamageUndo({ seat: principalOf(this.state, by)?.id, gmSide: false, by: who, owner: E[id].owner }));
      if (!mine) return { ok: false, code: 'forbidden', why: "you can only undo your own actions" };
    }
    if (!it) return { ok: false, code: 'invalid', why: who === by ? 'nothing of yours to undo in this area' : 'nothing of theirs to undo in this area' };
    let rec;
    if (it.inv.type === 'fog.restoreAll') {
      const states = Object.fromEntries(Object.keys(it.inv.args.states).filter(id=>this.state.areas[id]).map(id=>[id,this.state.areas[id].fog||emptyFog()]));
      rec = this.commit({by,as:who,cid,fx:this.fogRestoreFx(it.inv.args),undo:{area:c.area,seq:it.seq,xid:it.xid,who,redo:{type:'fog.restoreAll',args:{states,merge:false}}}});
    } else if (it.inv.type === 'transfer') {
      const a = it.inv.args;
      const err = REGISTRY.transfer.check({ state: this.state }, a) || this.travelBackProblem(by, a);
      if (err) return { ok: false, code: 'invalid', why: `cannot undo that transfer: ${err}` };
      const e = this.state.areas[a.from].entities[a.id];
      const redo = { type: 'transfer', args: { id: a.id, from: a.to, to: a.from, x: e.x, z: e.z, ...(a.y != null && { y: e.y || 0 }), ...(a.hide && { open: true }), ...(e.kind === 'token' && { _restorePawnHide: { hidden: !!e.hidden, hiddenByRoom: e.hiddenByRoom || null } }) } };
      rec = this.commit({ by, as: who, cid, camp: { type: 'transfer', args: a }, fx: this.transferFx(a, { inv: false }), undo: { area: c.area, seq: it.seq, xid: it.xid, who, redo } });
    } else {
      if (it.inv.type === 'entities.set') for (const [id, v] of Object.entries(it.inv.args.set)) { // never resurrect something that moved areas
        if (!v) continue;
        for (const T of Object.values(this.state.areas)) if (T.id !== c.area && T.entities[id]) return { ok: false, code: 'invalid', why: `${id} is now on ${T.name}; undo that transfer first` };
      }
      const T = this.state.areas[c.area];
      const redo = inverseOf(T, it.inv.type, it.inv.args);
      rec = this.commit({ by, as: who, cid, fx: [{ area: c.area, seq: T.seq + 1, type: it.inv.type, args: it.inv.args }], undo: { area: c.area, seq: it.seq, who, redo } });
    }
    this.afterCommit(rec, by);
    return { ok: true, r: rec.r, undid: it.seq, seqs: Object.fromEntries(rec.fx.map(f => [f.area, f.seq])) };
  }
  // a PLAYER undoing (or redoing) their own travel is travelling again: only into an area still open to them, and not
  // while the GM has travel locked. The GM side is never refused.
  travelBackProblem(by, a) {
    if (isGmSide(this.state, by)) return null;
    if (!canSee(this.state, by, a.to) || !canSee(this.state, by, a.from)) return 'that area is not open to you';
    if (this.state.defaults?.travelLocked) return 'the GM has locked travel between areas';
    return null;
  }
  doRedo(by, c, cid) {
    const who = c.args.who || by;
    if (who !== by && !isGmSide(this.state, by)) return { ok: false, code: 'forbidden', why: "you can only redo your own actions" };
    const r = this.redo.get(`${c.area}|${who}`)?.at(-1);
    if (!r) return { ok: false, code: 'invalid', why: 'nothing to redo' };
    let rec;
    if (r.inv.type === 'fog.restoreAll') {
      const states = Object.fromEntries(Object.keys(r.inv.args.states).filter(id=>this.state.areas[id]).map(id=>[id,this.state.areas[id].fog||emptyFog()]));
      const fx=this.fogRestoreFx(r.inv.args);const anchor=fx.find(f=>f.area===c.area);
      if(anchor)anchor.inv={type:'fog.restoreAll',args:{states,merge:true}};
      rec=this.commit({by,as:who,cid,fx,redo:{area:c.area,who}});
    } else if (r.inv.type === 'transfer') {
      const err = REGISTRY.transfer.check({ state: this.state }, r.inv.args) || this.travelBackProblem(by, r.inv.args);
      if (err) return { ok: false, code: 'invalid', why: `cannot redo: ${err}` };
      rec = this.commit({ by, as: who, cid, camp: { type: 'transfer', args: r.inv.args }, fx: this.transferFx(r.inv.args, { hide: !!r.inv.args.open }), redo: { area: c.area, who } });
    } else {
      const T = this.state.areas[c.area];
      rec = this.commit({ by, as: who, cid, fx: [{ area: c.area, seq: T.seq + 1, type: r.inv.type, args: r.inv.args, inv: inverseOf(T, r.inv.type, r.inv.args) }], redo: { area: c.area, who } });
    }
    this.afterCommit(rec, by);
    return { ok: true, r: rec.r, seqs: Object.fromEntries(rec.fx.map(f => [f.area, f.seq])) };
  }

  fogRestoreFx({states,merge}) {
    return Object.entries(states).filter(([id])=>this.state.areas[id]).map(([id,fog])=>({area:id,seq:this.state.areas[id].seq+1,type:'fog.restore',args:{fog,merge:!!merge}}));
  }

  // what a recipient may receive of a log entry: player-side seats get entries that touch hidden things as a
  // projection (the touched entities as they now look to them, hidden ones absent)
  // (and seats that may not edit rooms get every entry without room and building labels: core/labels.js)
  entryFor(seat, e0) {
    // the two halves of a transfer name the OTHER area: a seat that cannot see that area is not told which it was
    // (a pawn sent into a hidden area just leaves; hidden means hidden everywhere)
    const other = e0.type === 'transfer.out' ? e0.args.to : e0.type === 'transfer.in' ? e0.args.from : null;
    let e = other && !canSee(this.state, seat, other) ? { ...e0, args: e0.type === 'transfer.out' ? { id: e0.args.id } : { entity: e0.args.entity } } : e0;
    const T = this.state.areas[e.area], labels = seesLabels(this.state, seat, e.area), gm = isGmSide(this.state, seat);
    if(e.type.startsWith('fog.')) return wire({...e,type:'fog.view',args:{fog:fogFor(T.fog,principalOf(this.state,seat)?.id,!!this.state.defaults?.sharedPartyVision,gm)}});
    // THE TURN ORDER (core/turns.js): a player seat never receives a turn.* command as it was sent (an order names its
    // entries, and an entry may be a hidden pawn). It gets `turn.view` with the order as it may see it NOW, in the
    // command's place, so the sequence numbers still line up. The same inside a batch.
    if (!gm && isTurnEntry(e)) {
      // (a Next or Previous also counts down the templates it passes, and removes an expired one: core/turns.js advance.
      // Those travel in the same turn.view as `set`: each as this seat may see it now, null = gone, and not a word of
      // one that was hidden from it all along.)
      const set = {};
      for (const id of e.ids || []) { const x = T.entities[id]; if (x && !x.hidden) set[id] = x; else if (!e.pre || e.pre.includes(id)) set[id] = null; }
      const view = { type: 'turn.view', args: { turns: turnsForPlayers(T), ...(Object.keys(set).length && { set }) } };
      const args = e.type === 'batch' ? { ops: e.args.ops.map(o => o.type.startsWith('turn.') ? view : o) } : view.args;
      e = { ...e, type: e.type === 'batch' ? 'batch' : 'turn.view', args };
      if (e.type === 'turn.view') return wire(e); // (complete as it is: nothing else of the entry is this seat's)
    }
    // (and the player side gets every entry without a pawn's GM notes: core/labels.js unnote*)
    if (!e.priv || gm) return wire(gm ? (labels ? e : stripEntry(e, T)) : unnoteEntry(labels ? e : stripEntry(e, T)));
    const set = {};
    for (const id of e.ids) {
      if (entityVisible(this.state, seat, T.entities[id])) set[id] = unnoteEntity(labels ? T.entities[id] : stripEntity(T.entities[id]));
      else if (!e.pre || e.pre.includes(id)) set[id] = null; // it was theirs to see: now it is gone. (Never theirs: not a word; a hidden room worked on by the GM sends players an empty step)
    }
    return { area: e.area, seq: e.seq, type: 'entities.set', args: { set }, by: e.by, cid: e.cid };
  }

  // ---------------- fan-out ----------------
  afterCommit(rec, by, originConn) {
    // log entries, filtered per connection by subscription AND visibility (visibility is re-checked on every send)
    const entries = rec.fx.map(fx => this.tails.get(fx.area).find(e => e.seq === fx.seq));
    for (const conn of this.conns) {
      const mine = entries.filter(e => conn.subs.has(e.area) && canSee(this.state, conn.seat, e.area)).map(e => this.entryFor(conn.seat, e));
      if (mine.length) conn.send({ t: 'log', entries: mine });
    }
    // a change that is not a turn command can still change what PLAYERS may see of the order (a pawn in it is hidden,
    // revealed, renamed, given away, deleted, arrives): they are sent the order again, on its own, when it differs
    // from what they were last sent. (GM-side seats hold the real order and work the rest out from the pawns.)
    for (const fx of rec.fx) this.sendPlayerTurns(fx.area);
    for (const fx of rec.fx) this.wake(fx.area);
    if (rec.camp) {
      this.campaignChanged();
      if(rec.camp.type==='campaign.set' && Object.hasOwn(rec.camp.args.defaults||{},'sharedPartyVision')) {
        for(const conn of this.conns) for(const id of conn.subs) this.subscribe(conn,id);
      }
    }
    // THE PARTY ROWS AND THE BENCHES are part of every seat's campaign view (core/party.js). A change on a table that
    // they show (a pawn's damage, conditions, owner, figure; a pawn arriving, leaving, hidden) sends fresh views, a
    // moment later and once for a burst. A plain move changes nothing they show.
    else if (rec.fx.some(fx => fx.type !== 'token.move' && fx.type !== 'chat.say' && fx.type !== 'dice.roll')) {
      const sig = partySignature(this.state);
      if (sig !== this.partySig) { this.partySig = sig; if (!this.partyTimer) { this.partyTimer = setTimeout(() => { this.partyTimer = null; this.sendCampaignViews(); }, 60); this.partyTimer.unref?.(); } }
    }
    // LLM presence: glide to what it just acted on
    if (by && this.state.seats[by]?.kind === 'llm') {
      const fx = rec.fx.at(-1);
      if (fx) {
        const e = fx.type === 'transfer.in' ? fx.args.entity : this.state.areas[fx.area].entities[REGISTRY[fx.type].touches(fx.args)[0]];
        this.ghostTo(by, fx.area, entityPoint(e) || areaCentroid(this.state.areas[fx.area]), false, !!e?.hidden);
      }
    }
  }

  sendPlayerTurns(area, only = null) {
    const T = this.state.areas[area]; if (!T) return;
    const turns = turnsForPlayers(T), key = JSON.stringify(turns);
    this.playerTurns ||= new Map();
    if (!only && this.playerTurns.get(area) === key) return;
    if (!only) this.playerTurns.set(area, key);
    for (const conn of only ? [only] : this.conns) if (conn.subs.has(area) && canSee(this.state, conn.seat, area) && !isGmSide(this.state, conn.seat)) conn.send({ t: 'turns', area, seq: T.seq, turns });
  }

  campaignChanged() {
    for (const conn of [...this.conns]) {
      if (!liveSeat(this.state, conn.seat)) { conn.send({ t: 'denied', why: 'seat revoked' }); conn.close(); continue; }
      for (const t of [...conn.subs]) if (!canSee(this.state, conn.seat, t)) { conn.subs.delete(t); conn.send({ t: 'hidden', area: t }); }
    }
    this.sendCampaignViews();
    for (const [seat, g] of this.ghosts) if (!liveSeat(this.state, seat)) { this.sendGhost(seat, g, true); this.ghosts.delete(seat); }
  }
  online() {
    const s = new Set([...this.conns].map(c => c.seat));
    const now = Date.now();
    for (const [seat, t] of this.llmSeen) if (now - t < 120000) s.add(seat);
    return s;
  }
  sendCampaignViews() {
    const on = this.online();
    for (const conn of this.conns) conn.send({ t: 'camp', view: projectCampaign(this.state, conn.seat, on) });
  }

  // ---------------- connections ----------------
  attach(conn) { this.conns.add(conn); this.sendCampaignViews(); }
  detach(conn) {
    if (!this.conns.delete(conn)) return;
    for (const t of conn.subs) this.broadcastPresence(conn, { area: t, cursor: null, drag: null, gone: true });
    this.sendCampaignViews();
  }

  // join or rejoin an area: the log tail since `since` if we still have it, else a full snapshot
  subscribe(conn, area, since) {
    if (!canSee(this.state, conn.seat, area)) { conn.send({ t: 'hidden', area }); return; }
    conn.subs.add(area);
    const T = this.state.areas[area];
    const tail = this.tails.get(area) || [];
    const gm = isGmSide(this.state, conn.seat);
    const range = since != null ? tail.filter(e => e.seq > since) : [];
    // player-side catch-up through entries that touched hidden things is served as a filtered snapshot instead
    if (since != null && since <= T.seq && (since === T.seq || (tail.length && tail[0].seq <= since + 1)) && (gm || !range.some(e => e.priv))) {
      if (range.length) conn.send({ t: 'log', entries: range.map(e => this.entryFor(conn.seat, e)) });
      if (!gm) this.sendPlayerTurns(area, conn); // (what a player may see of the turn order can have changed with no turn command: see afterCommit)
    } else {
      // my own commands already folded into this snapshot, so the client can drop them from pending
      const cids = tail.filter(e => e.by === conn.seat && e.cid).map(e => e.cid);
      const st = areaForClient(T, gm, principalOf(this.state,conn.seat)?.id, !!this.state.defaults?.sharedPartyVision);
      const ents = seesLabels(this.state, conn.seat, area) ? st.entities : stripEntities(st.entities);
      conn.send({ t: 'snap', area, state: { ...st, entities: gm ? ents : unnoteEntities(ents) }, cids });
    }
    // current ghosts in this area
    for (const [seat, g] of this.ghosts) if (g.area === area && !this.state.seats[seat]?.invisible && (!g.secret || gm)) conn.send(this.ghostMsg(seat, g));
  }

  // ---------------- whispers ----------------
  // A PRIVATE LINE TO ONE SEAT (docs/PAWNS.md, the party row's whisper). It is NOT a command: it is never journaled,
  // never in a log, a snapshot, an undo or the GET API, so there is nothing to filter later. It goes to the
  // connections of the seat it is for, and to the sender's own other connections, and to no one else: not the GM, not
  // the sender's or the receiver's agents. A seat nobody is connected as is not reached, and the sender is told so.
  whisper(conn, m) {
    const now = Date.now(), b = conn.whisperBudget || (conn.whisperBudget = { t: 0, n: 0 });
    if (now - b.t > 10000) { b.t = now; b.n = 0; }
    const id = typeof m.id === 'string' && /^[a-z]{1,6}_[0-9a-z]{4,24}$/.test(m.id) ? m.id : null;
    const no = (why) => conn.send({ t: 'whispered', id, ok: false, delivered: 0, why });
    if (!id) return no('a whisper needs an id');
    if (++b.n > 20) return no('slow down: 20 whispers in 10 seconds is the most');
    const text = typeof m.text === 'string' ? m.text.trim() : '';
    if (!text || text.length > 500) return no('a whisper is 1 to 500 characters');
    const from = this.state.seats[conn.seat], to = liveSeat(this.state, m.to);
    // (a seat this sender is not shown in the roster answers exactly like one that does not exist)
    if (!to || to.id === conn.seat || (to.invisible && !isGmSide(this.state, conn.seat) && to.creator !== conn.seat)) return no('no such person at the table');
    if (to.kind === 'llm') return no(`${to.name} is an AI seat: it cannot be whispered to yet`);
    if (!from || from.kind === 'llm') return no('AI seats do not whisper');
    const msg = { t: 'whisper', id, from: from.id, to: to.id, text, at: now };
    let delivered = 0;
    for (const c of this.conns) { if (c.seat === to.id) { c.send(msg); delivered++; } else if (c.seat === from.id && c !== conn) c.send(msg); }
    conn.send({ t: 'whispered', id, ok: delivered > 0, delivered, to: to.id, text, at: now, ...(delivered ? {} : { why: `${to.name} is not at the table right now: not delivered` }) });
  }

  // ---------------- presence ----------------
  // lossy and never stored: cursors as ground points, drags in progress. Shed under backpressure.
  presence(conn, m) {
    if (!conn.subs.has(m.area) || !canSee(this.state, conn.seat, m.area)) return;
    const pt = (v) => Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e5);
    const cursor = pt(m.cursor) ? m.cursor : null;
    const drag = m.drag ? [].concat(m.drag).slice(0, 64).filter(d => d && typeof d.id === 'string' && d.id.length < 40 && pt([d.x, d.z])).map(d => ({ id: d.id, x: d.x, z: d.z, ...(Number.isFinite(d.rot) && { rot: d.rot }), ...(Number.isFinite(d.y) && Math.abs(d.y) < 1000 && { y: d.y }), ...(Array.isArray(d.quat) && d.quat.length === 4 && d.quat.every(v => Number.isFinite(v) && Math.abs(v) <= 1.01) && { quat: d.quat }) })) : null;
    if (m.ping && cursor) {
      // A PING (Alt+click, or a double-click anywhere: Harry 2026-10-06): a brief mark at a spot, in the seat's colour.
      // Never stored, never in the log. At most 4 in 3 s per connection. A ping INSIDE A HIDDEN ROOM reaches the GM
      // side only: a player must not learn where a hidden room is from someone pointing into it.
      const now = Date.now(), b = conn.pingBudget || (conn.pingBudget = { t: 0, n: 0 });
      if (now - b.t > 3000) { b.t = now; b.n = 0; }
      if (++b.n > 4) return;
      const T = this.state.areas[m.area], f = T && floorUnder(T.entities, cursor[0], cursor[1], cursor[2] || 0);
      const secret = !!m.secret || !!(f?.room && T.entities[f.room]?.hidden); // (the sender also says so when the thing it pointed at is hidden)
      this.broadcastPresence(conn, { area: m.area, cursor, ping: true }, secret);
      return;
    }
    const sel = Array.isArray(m.sel) ? m.sel.filter(id => typeof id === 'string' && /^[\w:.-]{1,48}$/.test(id)).slice(0, 64) : null;
    // A RULER being drawn, a dragged pawn's travelled line, a template not yet kept (docs/RULERS.md): its two ends, never
    // stored. One that touches a hidden pawn, or has an end in a hidden room, reaches the GM side only (below).
    const ruler = cleanRuler(m.ruler);
    this.lastPres.set(conn.seat, { area: m.area, cursor, sel: sel || [], at: Date.now(), ...(cursor && isGmSide(this.state, conn.seat) && this.cursorInHidden(m.area, cursor) && { secret: true }) }); // for the AI seats' presence read
    this.broadcastPresence(conn, { area: m.area, cursor, drag: drag?.length ? drag : null, ...(sel?.length && { sel }), ...(ruler && { ruler }) });
  }
  cursorInHidden(area, pt) { const T = this.state.areas[area], f = T && floorUnder(T.entities, pt[0], pt[1], pt[2] || 0); return !!(f?.room && T.entities[f.room]?.hidden); }
  broadcastPresence(from, p, gmOnly = false) {
    const s = this.state.seats[from.seat];
    if (!s) return;
    const msg = { t: 'pres', seat: s.id, name: s.name, color: s.color, ...p };
    const T = this.state.areas[p.area];
    const secretDrag = (d) => { const e = T?.entities[d.id]; const f = T && floorUnder(T.entities, d.x, d.z, d.y ?? e?.y ?? 0); return !!e?.hidden || !!(f?.room && T.entities[f.room]?.hidden && (e?.kind !== 'token' || HIDE_ROOM_HIDES_PLAYER_PAWNS || principalOf(this.state, e.owner)?.role !== 'player')); };
    const hiddenDrag = p.drag?.some(secretDrag), hiddenSel = p.sel?.some(id => T?.entities[id]?.hidden);
    // players never see hidden things being dragged, nor that someone has a hidden thing selected
    const inHidden = (pt) => { const f = T && floorUnder(T.entities, pt[0], pt[1], pt[2] || 0); return !!(f?.room && T.entities[f.room]?.hidden); };
    const hiddenRuler = !!p.ruler && !!T && (!!T.entities[p.ruler.ap]?.hidden || !!T.entities[p.ruler.bp]?.hidden || inHidden(p.ruler.a) || inHidden(p.ruler.b));
    // A GM-side seat's own CURSOR inside a hidden room is withheld from players (relay filters, not the client): they get one
    // 'gone' when it goes in, nothing while it is in there, and the cursor again when it comes out. Players' cursors are untouched.
    if (!p.gone && !p.ping && isGmSide(this.state, from.seat)) {
      const was = !!from.cursorHidden, now = !!p.cursor && inHidden(p.cursor);
      from.cursorHidden = now;
      if (now) {
        if (!was) for (const c of this.conns) if (c !== from && c.subs.has(p.area) && canSee(this.state, c.seat, p.area) && !isGmSide(this.state, c.seat)) c.sendLossy({ t: 'pres', seat: s.id, name: s.name, color: s.color, area: p.area, cursor: null, drag: null, gone: true });
        for (const c of this.conns) if (c !== from && c.subs.has(p.area) && canSee(this.state, c.seat, p.area) && isGmSide(this.state, c.seat)) c.sendLossy(msg);
        return;
      }
    } else if (p.gone) from.cursorHidden = false;
    const cut = hiddenDrag || hiddenSel || hiddenRuler;
    const pub = cut ? { ...msg, ...(hiddenDrag && { drag: p.drag.filter(d => !secretDrag(d)) }), ...(hiddenSel && { sel: p.sel.filter(id => !T.entities[id]?.hidden) }), ...(hiddenRuler && { ruler: undefined }) } : msg;
    for (const c of this.conns) if (c !== from && c.subs.has(p.area) && canSee(this.state, c.seat, p.area) && (!gmOnly || isGmSide(this.state, c.seat))) c.sendLossy(cut && !isGmSide(this.state, c.seat) ? pub : msg);
  }

  // ---------------- LLM seats: synthesized presence ----------------
  // A ghost cursor glides to whatever the agent last read or acted on; "thinking…" shows between a read and the
  // next act; the name tag says whose agent it is. A seat flagged invisible gets none of this.
  ghostTo(seat, area, point, thinking, secret = false) {
    this.llmSeen.set(seat, Date.now());
    let g = this.ghosts.get(seat);
    if (g && g.area !== area) { this.sendGhost(seat, g, true); g = null; }
    if (!g) { const start = this.state.areas[area] ? areaCentroid(this.state.areas[area]) : [0, 0]; g = { area, pos: [...start], target: [...point], thinking, since: Date.now(), last: 0 }; this.ghosts.set(seat, g); }
    g.target = [...point]; g.thinking = thinking; g.since = Date.now(); g.dirty = true; g.secret = secret; // secret: aimed at something hidden
  }
  ghostMsg(seat, g, gone = false) {
    const s = this.state.seats[seat], creator = this.state.seats[s.creator];
    return { t: 'pres', area: g.area, seat, ghost: true, name: s.name, color: s.color, label: `${creator?.name || '?'}'s ${s.role === 'gm' ? 'GM assistant' : 'agent'}`,
      cursor: gone ? null : [+g.pos[0].toFixed(2), +g.pos[1].toFixed(2)], thinking: !gone && g.thinking, gone };
  }
  sendGhost(seat, g, gone = false) {
    if (this.state.seats[seat]?.invisible && !gone) return;
    const msg = this.ghostMsg(seat, g, gone);
    for (const c of this.conns) if (c.subs.has(g.area) && canSee(this.state, c.seat, g.area) && (!g.secret || gone || isGmSide(this.state, c.seat))) c.sendLossy(msg);
  }
  tickGhosts(dt) {
    const now = Date.now();
    for (const [seat, g] of this.ghosts) {
      if (g.thinking && now - g.since > 60000) { g.thinking = false; g.dirty = true; }
      const dx = g.target[0] - g.pos[0], dz = g.target[1] - g.pos[1], dist = Math.hypot(dx, dz);
      const k = 1 - Math.exp(-dt * 3.2);
      if (dist > 0.02) { g.pos[0] += dx * k; g.pos[1] += dz * k; g.dirty = true; } else { g.pos = [...g.target]; }
      if (g.dirty || now - g.last > 1000) { this.sendGhost(seat, g); g.last = now; g.dirty = dist > 0.02; }
    }
  }

  // ---------------- long-poll support ----------------
  wait(area, fn) { if (!this.waiters.has(area)) this.waiters.set(area, new Set()); this.waiters.get(area).add(fn); return () => this.waiters.get(area)?.delete(fn); }
  wake(area) { const w = this.waiters.get(area); if (!w) return; this.waiters.delete(area); for (const fn of w) fn(); }
  entriesAfter(area, after, seat = null) {
    const tail = this.tails.get(area) || [];
    const T = this.state.areas[area];
    if (after >= T.seq) return { entries: [], seq: T.seq };
    if (!tail.length || tail[0].seq > after + 1) return { resync: true, seq: T.seq };
    return { entries: tail.filter(e => e.seq > after).map(e => slim(seat ? this.entryFor(seat, e) : e)), seq: T.seq };
  }

  // who a seat is, for the rules card / state reads
  describeSeat(seat) {
    const s = this.state.seats[seat], p = principalOf(this.state, seat);
    return { id: s.id, name: s.name, kind: s.kind, role: s.role, actsAs: p?.id === s.id ? null : p?.name, scope: s.scope };
  }
}

// the pawns an entry changed the damage of, when that is ALL it did (token.damage, or a batch of them): such an entry's
// undo is open to those pawns' owners too
const damageIds = (fx) => fx.type === 'token.damage' ? [fx.args.id] : fx.type === 'batch' && fx.args.ops?.length && fx.args.ops.every(o => o.type === 'token.damage') ? fx.args.ops.map(o => o.args.id) : null;
const isTurnEntry = (e) => e.type.startsWith('turn.') || (e.type === 'batch' && e.args.ops?.some(o => o.type.startsWith('turn.')));
const wire = (e) => ({ area: e.area, seq: e.seq, type: e.type, args: e.args, by: e.by, cid: e.cid, ...(e.xid && { xid: e.xid }), ...(e.undoOf && { undoOf: e.undoOf }) });
// (a roll's recorded tumble, args.throw, is for the screens, not the GET API)
const slim = (e) => ({ seq: e.seq, type: e.type, args: e.type === 'dice.roll' && e.args?.throw ? (({ throw: _, ...a }) => a)(e.args) : e.args, by: e.by, ...(e.xid && { xid: e.xid }), ...(e.undoOf && { undoOf: e.undoOf }) });
