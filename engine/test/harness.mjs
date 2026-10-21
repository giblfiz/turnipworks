// Multi-client convergence harness under simulated network conditions.
//   node engine/test/harness.mjs [--seconds 12] [--seed 7] [--min 50] [--max 400] [--loss 0.2]
//
// One GM and three players over sockets with 50–400 ms jitter each way (FIFO, as TCP) and presence loss; two LLM
// seats acting over GET with the same latency. A command storm with conflicting drops on shared tokens, GM moves,
// object placement, undo and cross-area transfers. Mid-storm, one client's connection is dropped with commands in
// flight, and later the relay itself restarts. Then everything stops and we assert:
//   1. every client converges to the relay's state, with nothing pending
//   2. every client applied the same entries in the same order as the relay log (server order wins)
//   3. every acknowledged command is in the log exactly once; refused ones are absent (idempotent resends)
//   4. cursors converge despite presence loss (sender settle + heartbeat)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport, sseTransport } from '../core/transport.js';
import { NodeEventSource } from './node-eventsource.mjs';
import { withNetSim, mulberry32 } from '../core/netsim.js';
import { PresenceSender, PresenceView } from '../core/presence.js';
import { stableStringify } from '../core/hash.js';
import { newId } from '../core/ids.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const TRANSPORT = (() => { const i = process.argv.indexOf('--transport'); return i > 0 ? process.argv[i + 1] : 'mixed'; })();
const SECONDS = arg('seconds', 12), SEED = arg('seed', 7), MIN = arg('min', 50), MAX = arg('max', 400), LOSS = arg('loss', 0.2);
const rng = mulberry32(SEED);
const pick = (xs) => xs[Math.floor(rng() * xs.length)];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let checks = 0, fails = 0;
const ok = (c, m) => { checks++; console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++; };

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-harness-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true })); // /tmp is RAM on the build box
let relay = await startRelay({ port: 0, dataDir, log: () => {} });
const port = relay.port, base = `http://127.0.0.1:${port}`;
const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'harness', gm: 'GM' }) }).then(r => r.json());
const T1 = C.area, T2 = 'tbl_harness2';
const lagged = async (p) => { await sleep(MIN + rng() * (MAX - MIN)); const r = await fetch(base + p).then(r => r.json()); await sleep(MIN + rng() * (MAX - MIN)); return r; };

const clients = [];
// ws, sse, or mixed: even clients on websockets, odd ones on SSE + POST (the Cloudflare path)
const pickTransport = (i) => (TRANSPORT === 'sse' || (TRANSPORT === 'mixed' && i % 2)) ? sseTransport(base, { ES: NodeEventSource }) : wsTransport(`ws://127.0.0.1:${port}/ws`, WebSocket);
function mkClient(name, token) {
  const c = new ClientSync({
    token, transport: withNetSim(pickTransport(clients.length), { minMs: MIN, maxMs: MAX, loss: LOSS, rng: mulberry32(SEED * 31 + clients.length) }),
    onEntry: (e) => { (c.applied[e.area] ||= new Map()).set(e.seq, e.cid); if (e.by === c.me && e.cid && c.sentAt.has(e.cid)) c.rtts.push(Date.now() - c.sentAt.get(e.cid)); },
    onAck: (m) => c.acked.add(m.cid), onNack: (m) => { if (m.cid) c.nacked.add(m.cid); },
    onPresence: (m) => { c.presRecv++; c.pv.ingest(m); },
  });
  Object.assign(c, { name, applied: {}, acked: new Set(), nacked: new Set(), submitted: [], sentAt: new Map(), rtts: [], presRecv: 0, presSent: 0, pv: new PresenceView() });
  c.ps = new PresenceSender((p) => { const s = c.presence(p.area, p); if (s) c.presSent++; return s; });
  const sub = c.submit.bind(c);
  c.submit = (type, args, area) => { const cid = sub(type, args, area); if (cid) { c.submitted.push(cid); c.sentAt.set(cid, Date.now()); } return cid; };
  c.connect();
  clients.push(c);
  return c;
}
async function until(fn, ms, what) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return Date.now() - t0; await sleep(25); } console.log(`  (timeout: ${what})`); return -1; }

// ---- setup: GM, three players with a token each, a party area, NPCs ----
const gm = mkClient('GM', C.token);
await until(() => gm.status === 'live', 5000, 'gm');
gm.subscribe(T1);
gm.submit('area.create', { id: T2, name: 'Side scene', visibility: 'party' });
const players = [];
for (let i = 0; i < 3; i++) {
  gm.submit('seat.create', { id: `seat_player0${i}`, kind: 'human', role: 'player', name: `P${i}` });
  gm.submit('token.create', { id: `tok_player0${i}`, name: `P${i}`, x: 10 * i, z: 0, owner: `seat_player0${i}` }, T1);
}
for (let i = 0; i < 4; i++) gm.submit('token.create', { id: `tok_npc00000${i}`, name: `NPC${i}`, x: 10 * i, z: 20 }, T1);
await until(() => gm.pendingCount() === 0 && gm.acked.size >= 4, 8000, 'setup');
gm.subscribe(T2);
const tokenOf = async (seat) => (await fetch(`${base}/c/${C.campaign}/token?seat=${C.token}&for=${seat}`).then(r => r.json())).token;
for (let i = 0; i < 3; i++) { const p = mkClient(`P${i}`, await tokenOf(`seat_player0${i}`)); players.push(p); }
await until(() => players.every(p => p.status === 'live'), 5000, 'players');
for (const p of players) p.subscribe(T1);
gm.submit('seat.create', { id: 'seat_assistnt', kind: 'llm', name: 'Assistant', scope: { areas: '*', classes: ['token.move', 'object'] } });
players[0].submit('seat.create', { id: 'seat_advisor0', kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: ['token.move'] } });
await until(() => [gm, ...players].every(c => c.pendingCount() === 0 && c.view(T1)), 8000, 'subscribed');
const agents = [{ seat: 'seat_assistnt', token: await tokenOf('seat_assistnt'), mine: (e) => true }, { seat: 'seat_advisor0', token: await tokenOf('seat_advisor0'), mine: (e) => e.owner === 'seat_player00' }];
console.log(`setup: transports ${clients.map(c => c.transport.kind || 'ws').join('/')}, ${clients.length} socket clients + ${agents.length} GET agents, latency ${MIN}-${MAX} ms, presence loss ${LOSS * 100}%, ${SECONDS}s storm, seed ${SEED}`);

// ---- the storm ----
let running = true;
const stats = { getErrors: 0, getActs: 0, getStale: 0, getDup: 0, getOk: 0, getRefused: 0 };
const cursor = new Map(clients.map(c => [c, [rng() * 40, rng() * 40]]));
const stepper = setInterval(() => { for (const c of clients) { c.pv.step(1 / 60); c.ps.tick(); } }, 16);
async function human(c, isGm) {
  while (running) {
    await sleep(40 + rng() * 160);
    const v = c.view(T1); if (!v || c.status !== 'live') continue;
    const cur = cursor.get(c); cur[0] += (rng() - 0.5) * 6; cur[1] += (rng() - 0.5) * 6;
    const roll = rng();
    const toks = Object.values(v.entities).filter(e => e.kind === 'token' && (isGm || e.owner === c.me));
    if (roll < 0.55 && toks.length) {
      const t = pick(toks); // drag: presence while moving, then the drop as a command
      c.ps.set(T1, { cursor: cur, drag: { id: t.id, x: cur[0], z: cur[1] } });
      await sleep(30 + rng() * 60);
      c.submit('token.move', { id: t.id, x: +cur[0].toFixed(2), z: +cur[1].toFixed(2) }, T1);
      c.ps.set(T1, { cursor: cur, drag: null });
    } else if (roll < 0.62 && !isGm) {
      const others = Object.values(v.entities).filter(e => e.kind === 'token' && e.owner !== c.me);
      if (others.length) c.submit('token.move', { id: pick(others).id, x: 1, z: 1 }, T1); // will be refused
    } else if (isGm && roll < 0.75) {
      c.submit('object.place', { id: newId('obj'), name: 'crate', x: +cur[0].toFixed(2), z: +cur[1].toFixed(2) }, T1);
    } else if (isGm && roll < 0.82) {
      c.undo(T1);
    } else if (isGm && roll < 0.88) {
      const v2 = c.view(T2);
      const npc1 = Object.values(v.entities).filter(e => e.kind === 'token' && !e.owner);
      const npc2 = v2 ? Object.values(v2.entities).filter(e => e.kind === 'token') : [];
      if (npc1.length && rng() < 0.6) c.submit('transfer', { id: pick(npc1).id, from: T1, to: T2, x: 5, z: 5 });
      else if (npc2.length) c.submit('transfer', { id: pick(npc2).id, from: T2, to: T1, x: 15, z: 15 });
    } else c.ps.set(T1, { cursor: cur, drag: null });
  }
}
async function agent(a) {
  const cp = `/c/${C.campaign}/a/${T1}`;
  while (running) {
    await sleep(100 + rng() * 300);
    try { await agentStep(a, cp); } catch { stats.getErrors++; } // e.g. the relay is mid-restart: a real agent retries
  }
}
async function agentStep(a, cp) {
  {
    const st = await lagged(`${cp}/state?seat=${a.token}`);
    const toks = (st.tokens || []).filter(t => a.seat === 'seat_assistnt' || t.yours);
    if (!toks.length) return;
    const t = pick(toks), nonce = newId('n');
    const url = `${cp}/do?cmd=token.move&id=${t.id}&x=${(rng() * 40).toFixed(1)}&z=${(rng() * 40).toFixed(1)}&based_on=${st.area.seq}&nonce=${nonce}&seat=${a.token}`;
    const r = await lagged(url); stats.getActs++;
    if (r.ok) stats.getOk++; else if (r.code === 'stale') stats.getStale++; else stats.getRefused++;
    if (r.ok && (rng() < 0.5 || stats.getDup === 0)) { const again = await lagged(url); if (again.duplicate && again.seqs[T1] === r.seqs[T1]) stats.getDup++; else { fails++; console.log('  FAIL retry with same nonce was not a duplicate', again); } }
  }
}
const workers = [human(gm, true), ...players.map(p => human(p, false)), ...agents.map(agent)];
const t0 = Date.now();
await sleep(SECONDS * 1000 * 0.33);
console.log(`  t=${((Date.now() - t0) / 1000).toFixed(1)}s dropping P1's connection with ${players[1].pendingCount()} commands in flight`);
players[1].conn?.close();
await sleep(SECONDS * 1000 * 0.25);
console.log(`  t=${((Date.now() - t0) / 1000).toFixed(1)}s restarting the relay`);
await relay.close();
relay = await startRelay({ port, dataDir, log: () => {} });
await sleep(SECONDS * 1000 * 0.42);
running = false;
await Promise.all(workers);

// ---- convergence ----
const rt = () => relay.campaigns.get(C.campaign);
const same = (c, t) => { const v = c.view(t), R = rt().state.areas[t]; return v && stableStringify([v.seq, v.entities]) === stableStringify([R.seq, R.entities]); };
const settleMs = await until(() => clients.every(c => c.status === 'live' && c.pendingCount() === 0 && same(c, T1)) && same(gm, T2), 15000, 'convergence');
console.log('results:');
ok(settleMs >= 0, `all ${clients.length} clients converged to the relay state ${settleMs} ms after the storm stopped`);
for (const c of clients) if (!same(c, T1)) console.log(`   ${c.name}: seq ${c.view(T1)?.seq} vs relay ${rt().state.areas[T1].seq}, pending ${c.pendingCount()}, status ${c.status}`);

// ---- order: each client's applied (seq -> cid) agrees with the relay's log ----
const relayCid = (t) => new Map((rt().tails.get(t) || []).map(e => [e.seq, e.cid]));
let orderChecked = 0, orderBad = 0;
for (const c of clients) for (const [t, m] of Object.entries(c.applied)) { const R = relayCid(t); for (const [seq, cid] of m) if (R.has(seq)) { orderChecked++; if (R.get(seq) !== cid) orderBad++; } }
ok(orderBad === 0 && orderChecked > 200, `same order everywhere: ${orderChecked} applied entries checked against the relay log, ${orderBad} disagreements`);

// ---- exactly once ----
const count = new Map();
for (const [, es] of rt().tails) for (const e of es) if (e.cid) count.set(`${e.cid}|${e.area}`, (count.get(`${e.cid}|${e.area}`) || 0) + 1);
const cidCount = (cid) => [...count.entries()].filter(([k]) => k.startsWith(cid + '|')).map(([, n]) => n);
let landed = 0, refused = 0, dup = 0, lost = 0, wrongly = 0;
for (const c of clients) for (const cid of c.submitted) {
  const n = cidCount(cid);
  if (n.some(x => x > 1)) dup++;
  if (c.nacked.has(cid)) { refused++; if (n.length) wrongly++; } else if (n.length || c.acked.has(cid)) landed++; else lost++;
}
ok(dup === 0 && lost === 0 && wrongly === 0, `exactly once: ${landed} landed, ${refused} refused, ${dup} duplicated, ${lost} lost, ${wrongly} refused-but-applied`);
ok(stats.getDup > 0 && stats.getOk > 0, `GET agents: ${stats.getErrors} fetch errors retried, ${stats.getActs} acts, ${stats.getOk} ok, ${stats.getStale} stale (caught), ${stats.getRefused} refused, ${stats.getDup} nonce retries deduplicated`);

// ---- cursors converge despite loss ----
const T0 = Date.now(); if (process.env.TW_DEBUG) { const R = rt(); const pr = R.presence.bind(R); R.presence = (conn, m) => { if (m.cursor?.[0] > 99) console.log(`   ${Date.now() - T0}ms RELAY pres from ${clients.find(x => x.me === conn.seat)?.name} via ${conn.kind} subs=${conn.subs.has(m.area)} budget=${conn.presBudget.n}`); return pr(conn, m); }; }
if (process.env.TW_DEBUG) for (const c of clients) { const ps = c.ps.send; c.ps.send = (p) => { const r = ps(p); if (p.cursor?.[0] > 99) console.log(`   ${Date.now() - T0}ms ${c.name} sends (${r})`); return r; }; const ing = c.pv.ingest.bind(c.pv); c.pv.ingest = (m) => { if (m.cursor?.[0] > 99 && !m.ghost) console.log(`   ${Date.now() - T0}ms ${c.name} got ${clients.find(x => x.me === m.seat)?.name}`); ing(m); }; }
for (const c of clients) { const cur = cursor.get(c); cur[0] = 100 + rng() * 10; cur[1] = 100 + rng() * 10; c.ps.set(T1, { cursor: cur, drag: null }); }
const dbg = process.env.TW_DEBUG ? setInterval(() => { for (const a of clients) for (const b of clients) { if (a === b) continue; const s = a.pv.seats.get(`${T1}|${b.me}`); const w = cursor.get(b); console.log(`   ${a.name}<-${b.name}`, s ? `d=${Math.hypot(s.pos[0]-w[0], s.pos[1]-w[1]).toFixed(2)} tgt=${s.target?.map(v=>v.toFixed(1))} age=${Date.now()-s.at}` : 'none', `bSent=${b.presSent} bStatus=${b.status}`); } console.log('   --'); }, 1000) : null;
const curMs = await until(() => clients.every(a => clients.every(b => a === b || (() => { const s = a.pv.seats.get(`${T1}|${b.me}`); const want = cursor.get(b); return s && s.pos && Math.hypot(s.pos[0] - want[0], s.pos[1] - want[1]) < 0.05; })())), 3000, 'cursors');
if (dbg) clearInterval(dbg);
ok(curMs >= 0, `every cursor converged on every other client ${curMs} ms after the last move (presence loss ${LOSS * 100}% each way)`);
const sent = clients.reduce((n, c) => n + c.presSent, 0), recv = clients.reduce((n, c) => n + c.presRecv, 0);
const rtts = clients.flatMap(c => c.rtts).sort((a, b) => a - b);
const q = (p) => rtts[Math.floor(p * (rtts.length - 1))];
const st = clients.reduce((a, c) => ({ rebases: a.rebases + c.stats.rebases, resyncs: a.resyncs + c.stats.resyncs, reconnects: a.reconnects + c.stats.reconnects, nacks: a.nacks + c.stats.nacks }), { rebases: 0, resyncs: 0, reconnects: 0, nacks: 0 });
console.log(`stats: command round trip median ${q(0.5)} ms, p95 ${q(0.95)} ms (n=${rtts.length}); presence ${sent} sent, ${recv} received (fan-out ×${clients.length - 1}, ~${Math.round(100 * recv / (sent * (clients.length - 1)))}% delivered incl. ghosts); rebases ${st.rebases}, gap resyncs ${st.resyncs}, reconnects ${st.reconnects}, nacks ${st.nacks}; relay log T1 seq ${rt().state.areas[T1].seq}`);

clearInterval(stepper);
for (const c of clients) c.close();
await relay.close();
console.log(`harness: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
