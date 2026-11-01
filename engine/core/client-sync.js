// The optimistic client, shared by the browser and the Node test harness (transport injected).
//
// Per subscribed area it keeps:
//   confirmed  the area exactly as the relay committed it, at confirmed.seq
//   pending    my commands sent but not yet seen in the log, in send order
//   view       confirmed with pending re-applied on top: what the renderer draws
// When a log entry arrives it is applied to `confirmed` in relay order (server order wins); if it is one of
// mine it leaves `pending`; then `view` is rebuilt. That rebuild is the rebase: my unconfirmed intents are
// replayed on top of whatever the relay decided, and any that no longer make sense simply drop out.
//
// Wire protocol (JSON over one socket):
//  client → relay  hello{token} | sub{area,since?} | unsub{area} | cmd{cid,type,area?,args} | pres{area,cursor,drag} | ping{ts}
//                  kick{seat} (a human GM: close that seat's connections now; not a ban)
//  relay → client  welcome{seat,campaign} | denied{why} | snap{area,state} | log{entries} | ack{cid,...} | nack{cid,code,why}
//                  camp{view} | pres{area,seat,...} | hidden{area} | pong{ts} | turns{area,turns}
//                  kicked{by} (the GM disconnected this connection: no reconnecting until rejoin()) | kickdone{ok,seat,n?,why?}
//  whispers        client → relay  whisper{id,to,text}      relay → the two seats only  whisper{id,from,to,text,at}
//                  relay → sender  whispered{id,ok,delivered,why?}
import { REGISTRY, applyArea, parseArgs } from './commands.js';
import { newId } from './ids.js';

export class ClientSync {
  constructor({ token, transport, onEntry = () => {}, onChange = () => {}, onPresence = () => {}, onCampaign = () => {}, onNack = () => {}, onStatus = () => {}, onAck = () => {}, onWhisper = () => {}, onNotice = () => {}, onKick = () => {}, log = () => {}, staleMs = 8000 }) {
    Object.assign(this, { token, transport, onEntry, onChange, onPresence, onCampaign, onNack, onStatus, onAck, onWhisper, onNotice, onKick, log, staleMs });
    this.areas = new Map();   // id -> { confirmed, pending, view, want }
    this.campaignPending = []; // campaign commands awaiting ack (no optimism: roster changes are rare)
    this.campaign = null; this.me = null;
    this.status = 'idle'; this.conn = null; this.backoff = 250; this.closed = false; this.rtt = null;
    this.stats = { sent: 0, recv: 0, nacks: 0, rebases: 0, resyncs: 0, reconnects: 0 };
  }

  // ---------- connection ----------
  connect() {
    this.closed = false;
    this.setStatus('connecting');
    const gen = this.gen = (this.gen || 0) + 1; // (a connection given up on as dead is ignored if it speaks or closes later)
    this.pingAt = this.pongAt = 0;
    this.conn = this.transport.connect({
      open: () => { if (gen === this.gen) this.send({ t: 'hello', token: this.token, v: 1 }); },
      message: (m) => { if (gen === this.gen) this.onMessage(m); },
      close: () => { if (gen === this.gen) this.onClose(); },
    });
  }
  close() { this.closed = true; this.conn?.close(); this.setStatus('closed'); }
  // after the GM's disconnect: the same link, a fresh connection (resubscribes and catches up like any reconnect)
  rejoin() { if (this.status !== 'kicked') return false; this.kickedBy = null; this.backoff = 250; this.connect(); return true; }
  // (a human GM) close that seat's connections now; the answer comes back as onKick({ ok, seat, n | why })
  kick(seat) { return this.send({ t: 'kick', seat }); }
  send(m) { if (this.conn?.isOpen()) { this.conn.send(m); this.stats.sent++; return true; } return false; }
  setStatus(s) { this.status = s; this.onStatus(s); }
  onClose() {
    this.conn = null;
    if (this.closed) return;
    this.setStatus('offline');
    const wait = Math.min(4000, this.backoff) * (0.75 + Math.random() * 0.5);
    this.backoff = Math.min(4000, this.backoff * 2);
    this.stats.reconnects++;
    setTimeout(() => { if (!this.closed) this.connect(); }, wait);
  }

  // ---------- areas ----------
  subscribe(area) {
    let T = this.areas.get(area);
    if (!T) { T = { confirmed: null, pending: [], view: null, want: true }; this.areas.set(area, T); }
    T.want = true;
    if (this.status === 'live') this.send({ t: 'sub', area, since: T.confirmed?.seq });
  }
  unsubscribe(area) {
    const T = this.areas.get(area);
    if (!T) return;
    if (T.pending.length) { T.want = false; } else this.areas.delete(area); // keep until my intents land
    this.send({ t: 'unsub', area });
  }
  view(area) { return this.areas.get(area)?.view || null; }
  pendingCount() { let n = this.campaignPending.length; for (const T of this.areas.values()) n += T.pending.length; return n; }

  // ---------- commands: the one door on the client side ----------
  // Returns the client command id (cid), which doubles as the relay's idempotency nonce.
  submit(type, args, area = null) {
    const d = REGISTRY[type];
    if (!d) throw new Error(`unknown command ${type}`);
    const p = parseArgs(type, args);
    if (p.error) { this.onNack({ cid: null, code: 'invalid', why: p.error, type }); return null; }
    const cid = newId('c', 12);
    const cmd = { cid, type, area, args: p.args };
    if (d.level === 'area') {
      const T = this.areas.get(area);
      if (!T) throw new Error(`not subscribed to ${area}`);
      T.pending.push(cmd);
      this.rebuild(area);
    } else this.campaignPending.push(cmd);
    this.send({ t: 'cmd', ...cmd });
    return cid;
  }
  undo(area, seq) { return this.submitRaw({ type: 'undo', area, args: seq ? { seq } : {} }); }
  // commands without optimism (undo: only the relay knows the inverse)
  submitRaw({ type, area, args }) {
    const cid = newId('c', 12);
    this.campaignPending.push({ cid, type, area, args });
    this.send({ t: 'cmd', cid, type, area, args });
    return cid;
  }
  presence(area, data) { return this.send({ t: 'pres', area, ...data }); }
  // a WHISPER: a private line to one seat. Never a command: not in any log or snapshot; the relay hands it to that
  // seat's connections (and my own other tabs) and to nobody else. Returns its id; `whispered` reports the delivery.
  whisper(to, text) { const id = newId('wsp', 12); return this.send({ t: 'whisper', id, to, text }) ? id : null; }

  // view = confirmed + pending replayed (the rebase)
  rebuild(area) {
    const T = this.areas.get(area);
    if (!T || !T.confirmed) return;
    let v = T.confirmed;
    for (const c of T.pending) {
      if (!this.locallyValid(v, c)) continue; // the relay will nack it; don't draw it meanwhile
      v = applyArea(v, c.type, c.args, { by: this.me });
    }
    T.view = v;
    this.onChange(area, v);
  }
  locallyValid(area, c) {
    const d = REGISTRY[c.type];
    if (!d.check) return true;
    try {
      const seats = Object.fromEntries((this.campaign?.seats || []).map(s => [s.id, s]));
      return !d.check({ state: { local: true, seats, areas: { [area.id]: area } }, area, by: this.me }, c.args);
    } catch { return true; } // not enough local knowledge to judge: optimistic
  }

  // ---------- inbound ----------
  onMessage(m) {
    this.stats.recv++;
    switch (m.t) {
      case 'welcome': {
        this.me = m.seat; this.campaign = m.campaign; this.backoff = 250;
        this.setStatus('live');
        this.onCampaign(m.campaign);
        for (const [area, T] of this.areas) if (T.want) this.send({ t: 'sub', area, since: T.confirmed?.seq });
        // re-send unacknowledged intents in order; the relay dedups by cid, so a command that did land
        // before the connection dropped is not applied twice
        for (const T of this.areas.values()) for (const c of T.pending) this.send({ t: 'cmd', ...c });
        for (const c of this.campaignPending) this.send({ t: 'cmd', ...c });
        break;
      }
      case 'kicked': this.closed = true; this.kickedBy = m.by || null; this.setStatus('kicked'); this.log('disconnected by ' + (m.by || 'the GM')); this.conn?.close(); break;
      case 'kickdone': this.onKick(m); break;
      case 'denied': this.closed = true; this.setStatus('denied'); this.log('denied: ' + m.why); this.onNack({ cid: null, code: 'denied', why: m.why }); this.conn?.close(); break;
      case 'snap': {
        const T = this.areas.get(m.area);
        if (!T) break;
        T.confirmed = m.state;
        // pending commands whose log entry is already in this snapshot will never arrive as entries: the relay
        // tells us which cids it has committed for this area
        if (m.cids) T.pending = T.pending.filter(c => !m.cids.includes(c.cid));
        this.rebuild(m.area);
        break;
      }
      case 'log': this.applyEntries(m.entries); break;
      case 'ack': {
        this.campaignPending = this.campaignPending.filter(c => c.cid !== m.cid);
        for (const T of this.areas.values()) if (m.dup) T.pending = T.pending.filter(c => c.cid !== m.cid);
        this.onAck(m);
        break;
      }
      case 'nack': {
        this.stats.nacks++;
        this.campaignPending = this.campaignPending.filter(c => c.cid !== m.cid);
        for (const [area, T] of this.areas) {
          const n = T.pending.length;
          T.pending = T.pending.filter(c => c.cid !== m.cid);
          if (T.pending.length !== n) this.rebuild(area);
        }
        this.onNack(m);
        break;
      }
      // the turn order as this (player) seat may see it, sent on its own when something other than a turn command
      // changed it (a pawn in it was hidden or revealed): relay/campaign.js sendPlayerTurns
      case 'turns': {
        const T = this.areas.get(m.area);
        if (!T || !T.confirmed) break;
        const { turns: _, ...rest } = T.confirmed;
        T.confirmed = m.turns ? { ...rest, turns: m.turns } : rest;
        this.rebuild(m.area);
        break;
      }
      case 'camp': this.campaign = m.view; this.onCampaign(m.view); break;
      case 'hidden': { const T = this.areas.get(m.area); if (T) { T.confirmed = null; T.view = null; T.want = false; this.onChange(m.area, null); } break; }
      case 'pres': this.onPresence(m); break;
      case 'whisper': case 'whispered': this.onWhisper(m); break;
      case 'pong': this.rtt = Date.now() - m.ts; this.pongAt = Date.now();
        // the relay's clock (2026-10-30, for the music: client/music.js): its time minus ours, from the quickest answer seen
        if (Number.isFinite(m.now) && !(this.skewRtt <= this.rtt)) { this.skew = m.now - (m.ts + this.rtt / 2); this.skewRtt = this.rtt; }
        break;
      // a banner from the relay's operator (the nightly release roll: "Server updating at 3:30"); docs/NETCODE.md "Two servers"
      case 'notice': this.onNotice(m); break;
    }
  }

  // A batch is applied as a unit (a cross-area transfer arrives as one batch touching two areas).
  applyEntries(entries) {
    const touched = new Set();
    for (const e of entries) {
      const T = this.areas.get(e.area);
      if (!T || !T.confirmed) continue;
      if (e.seq <= T.confirmed.seq) continue; // already have it (snapshot raced the log)
      if (e.seq !== T.confirmed.seq + 1) { // a gap: ask for everything since what we have
        // one outstanding catch-up request per area; it returns every entry after what we have
        if (T.resyncFrom !== T.confirmed.seq) { T.resyncFrom = T.confirmed.seq; this.stats.resyncs++; this.send({ t: 'sub', area: e.area, since: T.confirmed.seq }); }
        continue;
      }
      T.confirmed = { ...applyArea(T.confirmed, e.type, e.args, { by: e.by }), seq: e.seq };
      this.onEntry(e);
      if (e.by === this.me && e.cid) {
        const n = T.pending.length;
        T.pending = T.pending.filter(c => c.cid !== e.cid);
        if (n !== T.pending.length) this.campaignPending = this.campaignPending.filter(c => c.cid !== e.cid);
      } else if (T.pending.length) this.stats.rebases++;
      if (e.by === this.me && e.cid) this.campaignPending = this.campaignPending.filter(c => c.cid !== e.cid);
      touched.add(e.area);
    }
    for (const t of touched) this.rebuild(t);
    // an area I stopped wanting can be forgotten once my intents on it have landed
    for (const [id, T] of this.areas) if (!T.want && !T.pending.length) this.areas.delete(id);
  }

  // the 2 s ping (client/main.js), and the watchdog on it: a ping unanswered for 8 s means the connection is dead though
  // it still says open (a phone or laptop waking after the relay or Cloudflare closed it; a network gone): give it up
  // and reconnect now, instead of sitting "live" until the browser notices (seen 2026-10-28 on dev: ~30 s over SSE).
  // A background tab pings less often, never less answered, so it is not dropped for being slow.
  ping() {
    const now = Date.now();
    if (this.status === 'live' && this.pingAt > this.pongAt && now - this.pingAt > this.staleMs) {
      this.stats.stale = (this.stats.stale || 0) + 1; this.log(`no pong for ${Math.round((now - this.pingAt) / 1000)} s: reconnecting`);
      const dead = this.conn; this.gen++; this.onClose(); try { dead?.close(); } catch { }
      return;
    }
    if (this.send({ t: 'ping', ts: now }) && !(this.pingAt > this.pongAt)) this.pingAt = now; // (the oldest unanswered one counts)
  }
}
