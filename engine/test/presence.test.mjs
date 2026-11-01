// Who is at the table (2026-10-28; docs/NETCODE.md "Ghost connections", "Disconnect"):
//   the reaper   a connection silent for reapMs (no message, no websocket pong) is closed and its seat goes offline:
//                a ws client that stops answering, an SSE session whose POSTs stop, a real process frozen with SIGSTOP
//                (a phone asleep); one that only answers protocol pings stays
//   disconnect   only a human GM may; never a GM, never yourself, never an AI seat; every connection of that seat
//                closes (ws and SSE), the seat goes offline at once, the client stops reconnecting, rejoin() works
//   watchdog     the client gives up a connection whose pings go unanswered for staleMs, and reconnects
//   node engine/test/presence.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport, sseTransport } from '../core/transport.js';
import { NodeEventSource } from './node-eventsource.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m, extra ?? ''); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return Date.now() - t0; } catch {} await sleep(20); }
  console.log(`  (timed out waiting for ${what})`);
  return false;
}
const madeDirs = [], kids = [];
process.on('exit', () => { for (const k of kids) { try { k.kill('SIGKILL'); } catch { } } for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true }); });
const logs = [];
async function relayWith(opts = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-presence-')); madeDirs.push(dataDir);
  const r = await startRelay({ port: 0, dataDir, log: (m) => logs.push(m), ...opts });
  r.base = `http://127.0.0.1:${r.port}`;
  r.post = (p, b) => fetch(r.base + p, { method: 'POST', body: JSON.stringify(b) }).then(x => x.json());
  return r;
}
function client(r, token, kind = 'ws') {
  const ev = { kicks: [], camp: null };
  const c = new ClientSync({
    token, transport: kind === 'sse' ? sseTransport(r.base, { ES: NodeEventSource }) : wsTransport(`ws://127.0.0.1:${r.port}/ws`, WebSocket),
    onCampaign: (v) => { ev.camp = v; }, onKick: (m) => ev.kicks.push(m),
  });
  c.ev = ev; c.connect(); return c;
}
const onlineIn = (c, seat) => !!c.campaign?.seats.find(s => s.id === seat)?.online;
async function table(r) {
  const C = await r.post('/campaigns', { name: 'Presence test', gm: 'Harry' });
  const gm = client(r, C.token);
  await waitFor(() => gm.status === 'live', 3000, 'gm live');
  const seat = (id, kind, role, name) => { gm.submit('seat.create', { id, kind, role, name, color: '#6fc36f' }); };
  seat('seat_tonyplayr', 'human', 'player', 'Tony');
  seat('seat_foggyplyr', 'human', 'player', 'Foggy');
  seat('seat_cogmhuman', 'human', 'gm', 'Marta');
  gm.submit('seat.create', { id: 'seat_helperllm', kind: 'llm', name: 'helper', scope: { areas: '*', classes: ['chat'] } });
  await waitFor(() => gm.ev.camp?.seats.length === 5, 3000, 'seats');
  const tokenOf = async (id) => (await fetch(`${r.base}/c/${C.campaign}/token?seat=${encodeURIComponent(C.token)}&for=${id}`).then(x => x.json())).token;
  return { C, gm, tokenOf, rt: r.campaigns.get(C.campaign) };
}

// ======================= DISCONNECT (default reap time: nothing here goes quiet for 90 s) =======================
{
  const r = await relayWith();
  const { gm, tokenOf, rt } = await table(r);
  const tonyTok = await tokenOf('seat_tonyplayr'), foggyTok = await tokenOf('seat_foggyplyr'), martaTok = await tokenOf('seat_cogmhuman');
  ok(tonyTok && foggyTok && martaTok, 'seat tokens re-issued for the test seats');
  const tony = client(r, tonyTok), tony2 = client(r, tonyTok, 'sse'), foggy = client(r, foggyTok), marta = client(r, martaTok);
  await waitFor(() => [tony, tony2, foggy, marta].every(c => c.status === 'live'), 4000, 'everyone live');
  ok(tony2.transport.kind === 'sse' && [...rt.conns].filter(c => c.seat === 'seat_tonyplayr').length === 2, 'Tony has two connections (a websocket and an SSE session)');
  await waitFor(() => onlineIn(gm, 'seat_tonyplayr') && onlineIn(gm, 'seat_foggyplyr'), 2000, 'online');
  ok(gm.campaign.seats.filter(s => s.id === 'seat_tonyplayr').length === 1, 'two connections of one seat are one roster entry');

  // a player cannot kick anyone, the GM included
  foggy.kick('seat_tonyplayr'); await waitFor(() => foggy.ev.kicks.length === 1, 2000, 'foggy refused');
  ok(foggy.ev.kicks[0]?.ok === false && /only the GM/.test(foggy.ev.kicks[0].why), 'a player cannot disconnect another player', foggy.ev.kicks[0]);
  foggy.kick(gm.me); await waitFor(() => foggy.ev.kicks.length === 2, 2000, 'foggy refused 2');
  ok(foggy.ev.kicks[1]?.ok === false && gm.status === 'live' && tony.status === 'live', 'a player cannot disconnect the GM; nobody was disconnected');
  // the GM: not a GM seat, not yourself, not an AI seat, not nonsense
  gm.kick('seat_cogmhuman'); gm.kick(gm.me); gm.kick('seat_helperllm'); gm.kick('seat_nosuchseat'); gm.kick({ evil: 1 });
  await waitFor(() => gm.ev.kicks.length === 5, 2000, 'gm refusals');
  ok(gm.ev.kicks.every(k => k.ok === false) && /AI seat/.test(gm.ev.kicks[2]?.why), 'the GM cannot disconnect a GM, themself, an AI seat or a seat that does not exist', gm.ev.kicks.map(k => k.why));
  ok(marta.status === 'live' && gm.status === 'live', 'the co-GM and the GM are still connected');

  // the real thing
  const t0 = Date.now();
  gm.kick('seat_tonyplayr');
  const took = await waitFor(() => tony.status === 'kicked' && tony2.status === 'kicked' && !onlineIn(gm, 'seat_tonyplayr'), 3000, 'tony kicked');
  ok(took !== false, `the GM disconnects Tony: both his connections get "kicked" and the GM sees him offline (${Date.now() - t0} ms)`);
  ok(gm.ev.kicks.at(-1)?.ok === true && gm.ev.kicks.at(-1).n === 2 && gm.ev.kicks.at(-1).name === 'Tony', 'the GM is told: Tony, 2 connections', gm.ev.kicks.at(-1));
  ok(tony.kickedBy === 'Harry', 'Tony is told who disconnected him');
  ok([...rt.conns].filter(c => c.seat === 'seat_tonyplayr').length === 0, 'the relay holds no connection of his');
  ok(onlineIn(gm, 'seat_foggyplyr') && foggy.status === 'live', 'Foggy is untouched');
  await sleep(1500);
  ok(tony.status === 'kicked' && tony2.status === 'kicked' && !onlineIn(gm, 'seat_tonyplayr'), 'a disconnected client does not reconnect by itself');
  ok(rt.state.seats.seat_tonyplayr && !rt.state.seats.seat_tonyplayr.revoked, 'not a ban: the seat is still there, not revoked');
  ok(tony.rejoin(), 'rejoin');
  await waitFor(() => tony.status === 'live' && onlineIn(gm, 'seat_tonyplayr'), 3000, 'tony back');
  ok(tony.status === 'live' && onlineIn(gm, 'seat_tonyplayr'), 'Tony rejoins on the same link and is online again');
  ok(logs.some(l => /disconnected seat_tonyplayr \(2 connections\)/.test(l)), 'the relay logs the disconnect');
  for (const c of [gm, tony, tony2, foggy, marta]) c.close();
  await r.close();
}

// ======================= THE REAPER (reapMs 600 ms) =======================
{
  const REAP = 600;
  const r = await relayWith({ reapMs: REAP });
  const { C, gm, tokenOf, rt } = await table(r);
  const tonyTok = await tokenOf('seat_tonyplayr'), foggyTok = await tokenOf('seat_foggyplyr');
  const tonyConns = () => [...rt.conns].filter(c => c.seat === 'seat_tonyplayr').length;

  // 1. a websocket that stops answering anything (a sleeping phone: its pongs stop, its 2 s pings stop)
  const ghost = new WebSocket(`ws://127.0.0.1:${r.port}/ws`, { autoPong: false });
  await new Promise(res => ghost.on('open', res));
  ghost.send(JSON.stringify({ t: 'hello', token: tonyTok }));
  await waitFor(() => onlineIn(gm, 'seat_tonyplayr'), 2000, 'ghost online');
  ok(onlineIn(gm, 'seat_tonyplayr'), 'a websocket says hello: Tony is online');
  let t0 = Date.now(), closed = false; ghost.on('close', () => { closed = true; });
  await waitFor(() => !onlineIn(gm, 'seat_tonyplayr'), REAP * 4, 'ghost reaped');
  const wsMs = Date.now() - t0;
  ok(!onlineIn(gm, 'seat_tonyplayr') && wsMs >= REAP * 0.8 && wsMs < REAP + 600, `a websocket that answers nothing is reaped after the timeout (${wsMs} ms, timeout ${REAP})`);
  await waitFor(() => closed, 1000, 'ghost socket closed');
  ok(closed && tonyConns() === 0, 'its socket is closed and the relay keeps nothing of it');
  ok(logs.some(l => /reaped a silent ws connection \(seat_tonyplayr/.test(l)), 'the relay logs the reap');

  // 2. a websocket that sends nothing but answers protocol pings (a background tab whose timers are throttled) stays
  const quiet = new WebSocket(`ws://127.0.0.1:${r.port}/ws`);
  await new Promise(res => quiet.on('open', res));
  quiet.send(JSON.stringify({ t: 'hello', token: foggyTok }));
  await waitFor(() => onlineIn(gm, 'seat_foggyplyr'), 2000, 'quiet online');
  await sleep(REAP * 3);
  ok(onlineIn(gm, 'seat_foggyplyr') && quiet.readyState === 1, 'a websocket that only answers the relay\'s pings stays connected (3 timeouts)');
  quiet.close();

  // 3. an SSE session whose POSTs stop (its stream is still open)
  const sid = 's' + Math.random().toString(36).slice(2).padEnd(20, '0');
  let ended = false;
  const es = new NodeEventSource(`${r.base}/sse/${sid}/events`); es.onerror = () => { ended = true; };
  await sleep(100);
  await fetch(`${r.base}/sse/${sid}/send`, { method: 'POST', body: JSON.stringify({ n: 1, msgs: [{ t: 'hello', token: tonyTok }] }) });
  await waitFor(() => onlineIn(gm, 'seat_tonyplayr'), 2000, 'sse online');
  ok(onlineIn(gm, 'seat_tonyplayr'), 'an SSE session says hello: Tony is online');
  t0 = Date.now();
  await waitFor(() => !onlineIn(gm, 'seat_tonyplayr') && ended, REAP * 4, 'sse reaped');
  const sseMs = Date.now() - t0;
  ok(!onlineIn(gm, 'seat_tonyplayr') && ended && sseMs < REAP + 600, `an SSE session that stops posting is reaped and its stream ended (${sseMs} ms)`);
  const late = await fetch(`${r.base}/sse/${sid}/send`, { method: 'POST', body: JSON.stringify({ n: 2, msgs: [{ t: 'ping', ts: 1 }] }) });
  ok(late.status === 410, 'its late POST is told the session is gone (the client reconnects)', late.status);

  // 4. a real client, frozen (SIGSTOP: a phone asleep, a laptop lid shut), then thawed: reaped, then back by itself
  const kid = spawn(process.execPath, [path.join(HERE, 'presence-child.mjs'), `ws://127.0.0.1:${r.port}/ws`, tonyTok], { stdio: ['ignore', 'pipe', 'inherit'] });
  kids.push(kid);
  let kidOut = ''; kid.stdout.on('data', d => { kidOut += d; });
  await waitFor(() => /live/.test(kidOut) && onlineIn(gm, 'seat_tonyplayr'), 4000, 'child live');
  ok(onlineIn(gm, 'seat_tonyplayr'), 'a real client (its own process, pinging like a browser) is online');
  await sleep(REAP * 2);
  ok(onlineIn(gm, 'seat_tonyplayr'), 'while it runs it stays online');
  kid.kill('SIGSTOP'); t0 = Date.now();
  await waitFor(() => !onlineIn(gm, 'seat_tonyplayr'), REAP * 4, 'frozen child reaped');
  const stopMs = Date.now() - t0;
  ok(!onlineIn(gm, 'seat_tonyplayr') && stopMs < REAP + 600, `frozen, it is reaped within the timeout (${stopMs} ms)`);
  kid.kill('SIGCONT');
  await waitFor(() => onlineIn(gm, 'seat_tonyplayr'), 5000, 'thawed child back');
  ok(onlineIn(gm, 'seat_tonyplayr'), 'thawed, it reconnects by itself and is online again');
  kid.kill('SIGKILL');
  void C;
  gm.close(); ghost.terminate(); es.close();
  await r.close();
}

// ======================= THE CLIENT'S WATCHDOG: a connection that says "open" but answers nothing =======================
{
  const r = await relayWith();
  const { gm, tokenOf } = await table(r);
  const tonyTok = await tokenOf('seat_tonyplayr');
  // a websocket that goes deaf and mute at the flip of a switch (a laptop waking after the far end closed: the browser
  // has not noticed yet, its sends go nowhere and nothing comes back)
  let deaf = false;
  const base = wsTransport(`ws://127.0.0.1:${r.port}/ws`, WebSocket);
  const tr = { kind: 'ws', connect(h) { const c = base.connect({ open: h.open, message: (m) => { if (!deaf) h.message(m); }, close: h.close }); return { isOpen: c.isOpen, send: (m) => { if (!deaf) c.send(m); }, close: c.close }; } };
  const logsC = [];
  const tony = new ClientSync({ token: tonyTok, transport: tr, staleMs: 400, log: (m) => logsC.push(m) }); tony.connect();
  await waitFor(() => tony.status === 'live', 3000, 'tony live');
  for (let i = 0; i < 4; i++) { tony.ping(); await sleep(150); }
  ok(tony.status === 'live' && tony.pongAt >= tony.pingAt && !tony.stats.stale, 'answered pings: the watchdog leaves a live connection alone');
  deaf = true; const reconnects0 = tony.stats.reconnects;
  const t0 = Date.now();
  const iv = setInterval(() => tony.ping(), 100);
  await waitFor(() => tony.stats.stale >= 1, 3000, 'watchdog');
  ok(tony.stats.stale === 1 && tony.stats.reconnects === reconnects0 + 1 && Date.now() - t0 < 1200, `a connection that answers nothing is given up after the stale time (${Date.now() - t0} ms, staleMs 400) and a reconnect starts`, logsC.at(-1));
  deaf = false;
  await waitFor(() => tony.status === 'live' && onlineIn(gm, 'seat_tonyplayr'), 4000, 'tony back');
  await sleep(600);
  ok(tony.status === 'live' && tony.stats.stale === 1 && onlineIn(gm, 'seat_tonyplayr'), 'the new connection is live, answered, and Tony is online');
  clearInterval(iv); tony.close(); gm.close();
  await r.close();
}

console.log(`presence: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
