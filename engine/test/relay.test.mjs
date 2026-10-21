// Relay integration: real sockets, the shared ClientSync, the GET API, restart durability.
//   node engine/test/relay.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
import { stableStringify } from '../core/hash.js';
import { edgeId } from '../core/commands.js';
const shift20 = (k) => k.replace('@-10', '@-20');

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch {} await sleep(20); }
  console.log(`  (timed out waiting for ${what})`);
  return false;
}
const quiet = () => {};
// (/tmp is RAM-backed on the build box: every temp dir this suite makes is removed when it exits)
const madeDirs = [];
process.on('exit', () => { for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true }); });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-relay-')); madeDirs.push(dataDir);
let relay = await startRelay({ port: 0, dataDir, log: quiet });
let base = `http://127.0.0.1:${relay.port}`;
const post = (p, b) => fetch(base + p, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const get = (p) => fetch(base + p).then(async r => ({ status: r.status, body: r.headers.get('content-type').includes('json') ? await r.json() : await r.text() }));

function client(token, extra = {}) {
  const events = { pres: [], nacks: [], acks: [], camp: null };
  const c = new ClientSync({
    token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket),
    onPresence: (m) => events.pres.push({ ...m, at: Date.now() }), onNack: (m) => events.nacks.push(m), onAck: (m) => events.acks.push(m),
    onCampaign: (v) => { events.camp = v; }, ...extra,
  });
  c.ev = events;
  c.connect();
  return c;
}

// ---- campaign, GM, player ----
const C = await post('/campaigns', { name: 'Relay test', gm: 'Harry' });
ok(C.ok && C.token, 'campaign created');
const T1 = C.area;
const gm = client(C.token);
await waitFor(() => gm.status === 'live', 3000, 'gm live');
gm.subscribe(T1);
await waitFor(() => gm.view(T1), 3000, 'gm snapshot');
gm.submit('seat.create', { id: 'seat_brakka001', kind: 'human', role: 'player', name: 'Brakka', color: '#6fc36f' });
await waitFor(() => gm.ev.acks.some(a => a.token), 3000, 'player seat token');
const playerToken = gm.ev.acks.find(a => a.token).token;
const pl = client(playerToken);
await waitFor(() => pl.status === 'live');
pl.subscribe(T1);
await waitFor(() => pl.view(T1));
ok(pl.campaign.my.role === 'player' && pl.campaign.seats.length === 2, 'player joined, roster has 2');

// ---- rung 1: one token, two clients ----
gm.submit('token.create', { id: 'tok_brakka001', name: 'Brakka', x: 10, z: 10, owner: 'seat_brakka001' }, T1);
gm.submit('token.create', { id: 'tok_keeper001', name: 'Innkeeper', x: 30, z: 10 }, T1);
ok(gm.view(T1).entities.tok_brakka001, 'optimistic: GM sees token before the relay answers');
await waitFor(() => pl.view(T1)?.entities.tok_keeper001, 3000, 'player sees tokens');
pl.submit('token.move', { id: 'tok_brakka001', x: 22, z: 14 }, T1);
await waitFor(() => gm.view(T1).entities.tok_brakka001.x === 22);
ok(gm.view(T1).entities.tok_brakka001.x === 22, 'player drop lands on GM');
pl.submit('token.move', { id: 'tok_keeper001', x: 0, z: 0 }, T1);
ok(pl.view(T1).entities.tok_keeper001.x === 30, 'locally invalid move is not even drawn');
await waitFor(() => pl.ev.nacks.length, 3000, 'nack');
ok(pl.ev.nacks[0]?.code === 'invalid' && /belongs/.test(pl.ev.nacks[0].why), 'relay refuses moving the NPC');
// concurrent drops on the same token from both seats: server order wins, both converge
for (let i = 0; i < 10; i++) { gm.submit('token.move', { id: 'tok_brakka001', x: 100 + i, z: 0 }, T1); pl.submit('token.move', { id: 'tok_brakka001', x: 200 + i, z: 0 }, T1); }
await waitFor(() => gm.pendingCount() === 0 && pl.pendingCount() === 0 && stableStringify(gm.view(T1)) === stableStringify(pl.view(T1)), 4000, 'converge');
ok(stableStringify(gm.view(T1)) === stableStringify(pl.view(T1)), 'concurrent drops converge to the same state');
{ const R = relay.campaigns.get(C.campaign).state.areas[T1]; ok(stableStringify([gm.view(T1).seq, gm.view(T1).entities]) === stableStringify([R.seq, R.entities]), '...which is the relay state'); }

// ---- presence: cursors relayed to watchers of that area only ----
gm.presence(T1, { cursor: [12.5, 7.25], drag: null });
await waitFor(() => pl.ev.pres.some(p => p.seat === gm.me && p.cursor?.[0] === 12.5), 2000, 'cursor');
ok(pl.ev.pres.some(p => p.seat === gm.me && p.cursor?.[0] === 12.5 && p.name === 'Harry'), 'player receives GM cursor as a ground point');
pl.presence(T1, { cursor: [3, 3], drag: { id: 'tok_brakka001', x: 3, z: 3 } });
await waitFor(() => gm.ev.pres.some(p => p.drag?.some?.(d => d.id === 'tok_brakka001')), 2000, 'drag');
ok(gm.ev.pres.some(p => p.seat === pl.me && p.drag?.[0]?.x === 3), 'drag in progress travels as presence');

// ---- rooms: GM spawns by seed; the creator sends the solved layout + hash ----
const rg = relay.roomgen;
{
  const T = gm.view(T1);
  const L = rg.solve(T.entities, { id: 'room_inn00001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 4242 }, T.order + 1);
  gm.submit('room.spawn', { id: 'room_inn00001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 4242, engine: 'v2', engineVersion: rg.version, layout: L }, T1);
  await waitFor(() => pl.view(T1).entities.room_inn00001);
  const R = pl.view(T1).entities.room_inn00001;
  const mine = rg.solve(Object.fromEntries(Object.entries(pl.view(T1).entities).filter(([k]) => k !== R.id)), { id: R.id, ...R.recipe }, R.order);
  ok(R.layout.hash === L.hash && mine.hash === L.hash, `player's re-solve matches creator hash ${L.hash}`);
}

// ---- tab closes and rejoins ----
pl.close();
gm.submit('token.move', { id: 'tok_keeper001', x: 44, z: 4 }, T1);
await waitFor(() => gm.pendingCount() === 0);
const pl2 = client(playerToken);
await waitFor(() => pl2.status === 'live'); pl2.subscribe(T1);
await waitFor(() => pl2.view(T1)?.entities.tok_keeper001?.x === 44, 3000, 'rejoin');
ok(stableStringify(pl2.view(T1)) === stableStringify(gm.view(T1)), 'rejoined tab gets the full state');

// ---- LLM seats ----
gm.submit('seat.create', { id: 'seat_assist01', kind: 'llm', name: 'Assistant', scope: { areas: [T1], classes: ['token.move', 'room', 'object', 'chat'] } });
pl2.submit('seat.create', { id: 'seat_advise01', kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: ['token.move'] } });
await waitFor(() => gm.ev.acks.filter(a => a.token).length >= 2 && pl2.ev.acks.some(a => a.token), 3000, 'agent tokens');
const asTok = gm.ev.acks.filter(a => a.token).at(-1).token, adTok = pl2.ev.acks.find(a => a.token).token;
const cp = `/c/${C.campaign}`;
// the rules card and every help page it lists (2026-10-20: the card became short; the detail moved to /help/<topic>)
const docs = async (tok) => { const card = (await get(`${cp}/card?seat=${tok}`)).body, idx = (await get(`${cp}/help?seat=${tok}`)).body; let all = card; for (const t of new Set([...idx.matchAll(/\/help\/([\w-]+)\?/g)].map(m => m[1]))) all += '\n' + (await get(`${cp}/help/${t}?seat=${tok}`)).body; return all; };
{
  const card = await get(`${cp}/card?seat=${adTok}`);
  ok(card.status === 200 && /Advisor \(Brakka's agent\)/.test(card.body) && !/room.spawn/.test(card.body), 'advisor rules card: whose agent, no room commands');
  const st = await get(`${cp}/a/${T1}/state?seat=${asTok}`);
  ok(st.body.area.seq > 0 && st.body.rooms[0]?.summary, 'assistant reads semantic area with room summary');
  await waitFor(() => gm.ev.pres.some(p => p.ghost && p.seat === 'seat_assist01' && p.thinking), 2000, 'ghost thinking');
  ok(gm.ev.pres.some(p => p.ghost && p.seat === 'seat_assist01' && p.thinking && /Harry's GM assistant/.test(p.label)), 'ghost cursor appears with "thinking" and whose agent');
  const seq = st.body.area.seq;
  const r1 = await get(`${cp}/a/${T1}/do?cmd=room.spawn&id=room_kitch001&type=kitchen&x=6&z=0&w=4&d=4&seed=77&based_on=${seq}&nonce=k1&seat=${asTok}`);
  ok(r1.body.ok, 'GM assistant spawns a room via GET (relay solves it)');
  const r1b = await get(`${cp}/t/${T1}/do?cmd=room.spawn&id=room_kitch001&type=kitchen&x=6&z=0&w=4&d=4&seed=77&based_on=${seq}&nonce=k1&seat=${asTok}`);
  ok(r1b.body.ok && r1b.body.duplicate && r1b.body.seqs[T1] === r1.body.seqs[T1], 'same nonce: idempotent (no second room), through the old /t/ path alias');
  ok(/CELLS/.test(r1.body.note || ''), 'old cell units (x=6, w=4: not multiples of 5) still work this release, with a deprecation note');
  // units: feet everywhere (Dawnhaven, 2026-10-04): what you send is what "state" reports
  const card2 = { body: await docs(asTok) };
  ok(/x, z, w, d in FEET/.test(card2.body) && /leave id out/.test(card2.body) && /room_ab12cd34ef/.test(card2.body), 'the card says FEET for room.spawn and that ids may be left out (with the prefix if sent)');
  const rf = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=storeroom&x=75&z=0&w=20&d=15&seed=5&nonce=feet1&seat=${asTok}`);
  ok(rf.body.ok && /^room_[0-9a-z]{12}$/.test(rf.body.id) && !rf.body.note, `room.spawn in feet with no id: the relay mints one and returns it (${rf.body.id})`);
  const rf2 = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=storeroom&x=75&z=0&w=20&d=15&seed=5&nonce=feet1&seat=${asTok}`);
  ok(rf2.body.ok && rf2.body.duplicate && rf2.body.id === rf.body.id, 'a retry with the same nonce gets the same id back (no second room)');
  await waitFor(() => gm.view(T1).entities[rf.body.id], 3000, 'feet room arrives');
  const fr = gm.view(T1).entities[rf.body.id].recipe;
  const sf = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body.rooms.find(r => r.id === rf.body.id);
  ok(fr.x === 15 && fr.w === 4 && fr.d === 3 && sf.x === 75 && sf.z === 0 && sf.w === 20 && sf.d === 15, 'x=75 w=20 d=15 FEET lands on cells 15/4/3, and state reports it back in the same feet');
  // ROOFS (Stage F): an AI seat reads each room's roof style and sets it
  ok(sf.roof && ['thatch', 'tile', 'slate', 'shingle', 'flat'].includes(sf.roof.style) && !sf.roof.own, `state gives a room its roof style (${sf.roof?.style}: from its walls)`);
  const rr1 = await get(`${cp}/a/${T1}/do?cmd=room.set&id=${rf.body.id}&roof=${encodeURIComponent(JSON.stringify({ style: 'slate', seed: 9 }))}&nonce=roof1&seat=${asTok}`);
  await waitFor(() => gm.view(T1).entities[rf.body.id].roof?.style === 'slate', 3000, 'roof style arrives');
  const sf2 = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body;
  ok(rr1.body.ok && gm.view(T1).entities[rf.body.id].roof.seed === 9 && sf2.rooms.find(r => r.id === rf.body.id).roof.style === 'slate' && sf2.rooms.find(r => r.id === rf.body.id).roof.own === true, 'room.set roof over GET: the room\'s own style and seed; state reports it back');
  const rr2 = await get(`${cp}/a/${T1}/do?cmd=room.set&id=${rf.body.id}&roof=${encodeURIComponent(JSON.stringify({ style: 'gold' }))}&nonce=roof2&seat=${asTok}`);
  ok(!rr2.body.ok && /thatch/.test(rr2.body.why || rr2.body.error || JSON.stringify(rr2.body)), 'a bad style is refused, naming the styles');
  const bld = gm.view(T1).entities[rf.body.id].building;
  if (bld) { const rr3 = await get(`${cp}/a/${T1}/do?cmd=building.set&id=${bld}&roof=tile&nonce=roof3&seat=${asTok}`); await waitFor(() => gm.view(T1).entities[bld].roof === 'tile', 3000, 'building roof');
    ok(rr3.body.ok && (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body.buildings.find(b => b.id === bld).roof === 'tile', 'building.set roof over GET; state gives each building its roof style'); }
  ok(/roof=\{"style":"tile"\}/.test(card2.body) && /roof=slate/.test(card2.body), 'the card\'s help pages explain roofs');
  const rc = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=privy&cx=21&cz=0&cw=2&cd=2&seed=6&nonce=cells1&seat=${asTok}`);
  await waitFor(() => rc.body.ok && gm.view(T1).entities[rc.body.id], 3000, 'cells room');
  ok(rc.body.ok && gm.view(T1).entities[rc.body.id].recipe.x === 21 && gm.view(T1).entities[rc.body.id].recipe.w === 2, 'cells only by explicit name: cx, cz, cw, cd');
  const cs = await get(`${cp}/a/${T1}/do?cmd=chat.say&text=Hello%20Dawnhaven&nonce=say1&seat=${asTok}`);
  ok(cs.body.ok && /^msg_[0-9a-z]{12}$/.test(cs.body.id), `chat.say with no id: minted and returned (${cs.body.id} ${JSON.stringify(cs.body).slice(0, 200)})`);
  const cb = await get(`${cp}/a/${T1}/do?cmd=chat.say&id=c123&text=hi&nonce=say2&seat=${adTok}`);
  ok(cb.body.ok === false && /msg_ab12cd34ef/.test(cb.body.why) && /Leave id out/.test(cb.body.why), 'a malformed id names the right prefix and says it can be left out');
  // selections travel in presence (Harry 2026-10-04): others see them; a hidden thing in a GM's selection never reaches a player
  gm.submit('object.place', { id: 'obj_secret001', name: 'secret chest', x: 4, z: 4, hidden: true }, T1);
  gm.presence(T1, { cursor: [12.5, 7.25], drag: null, sel: ['tok_keeper001', 'obj_secret001'] });
  await waitFor(() => pl2.ev.pres.some(p => p.seat === gm.me && p.sel), 2000, 'sel');
  const ps1 = pl2.ev.pres.filter(p => p.seat === gm.me && p.sel).at(-1);
  ok(ps1 && ps1.sel.length === 1 && ps1.sel[0] === 'tok_keeper001', `a seat's selection travels in presence, minus anything hidden for a player (${JSON.stringify(ps1?.sel)})`);
  // presence for AI seats: who is pointing at what
  gm.presence(T1, { cursor: [20, 10], drag: null, sel: ['tok_keeper001', 'obj_secret001'] });
  await sleep(300);
  const pA = (await get(`${cp}/presence?seat=${asTok}`)).body, pB = (await get(`${cp}/presence?seat=${adTok}`)).body;
  const hA = pA.seats?.find(x => x.name === 'Harry'), hB = pB.seats?.find(x => x.name === 'Harry');
  ok(hA && hA.kind === 'human' && hA.area === T1 && hA.cursor?.[0] === 20 && hA.selection.map(x => x.name).join() === 'Innkeeper,secret chest', `GET /presence: each seat's area, cursor and selection with names (${JSON.stringify(hA?.selection?.map(x => x.name))})`);
  ok(hB && hB.selection.map(x => x.id).join() === 'tok_keeper001', "a player's agent doesn't learn about the hidden thing in the GM's selection");
  ok(/\/presence\?/.test(await docs(asTok)), 'the card (or its help pages) lists the presence URL');
  // AI seats wake on says and rolls (Harry 2026-10-04): the kinds filter, the card's etiquette, the rate limit, the loop breaker
  const cardA = (await get(`${cp}/card?seat=${asTok}`)).body;
  ok(/ETIQUETTE FOR AI SEATS/.test(cardA) && /do nothing/.test(cardA) && /Never reply to another AI seat/.test(cardA) && /kinds=chat,roll/.test(cardA), 'the AI card has the etiquette FAQ and the says-and-rolls follow URL');
  const sq0 = (await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body.area.seq;
  let woke = null;
  const poll = get(`${cp}/a/${T1}/changes?after=${sq0}&kinds=chat,roll&wait=8&seat=${adTok}`).then(r => (woke = r.body));
  await sleep(300);
  pl2.submit('token.move', { id: 'tok_brakka001', x: 12, z: 12 }, T1);
  await sleep(700);
  ok(woke === null, 'a move does not wake a kinds=chat,roll follower');
  pl2.submit('chat.say', { id: 'msg_hello0001', text: 'Hi table' }, T1);
  await poll;
  ok(woke?.events?.length === 1 && woke.events[0].kind === 'chat' && woke.events[0].text === 'Hi table' && woke.events[0].byKind === 'human' && woke.events[0].area === T1 && woke.events[0].by, `a say wakes it: who, human or AI, area and text (${JSON.stringify(woke?.events?.[0] || woke).slice(0, 160)})`);
  const cw0 = (await get(`${cp}/changes?kinds=chat,roll&wait=0&seat=${adTok}`)).body;
  let cw = null;
  const poll2 = get(`${cp}/changes?kinds=chat,roll&after=${encodeURIComponent(cw0.cursor)}&wait=8&seat=${adTok}`).then(r => (cw = r.body));
  await sleep(300);
  pl2.submit('dice.roll', { id: 'msg_roll00001', expr: 'd20+5', rolls: [12], total: 17 }, T1);
  await poll2;
  ok(cw?.events?.length === 1 && cw.events[0].kind === 'roll' && cw.events[0].roll.total === 17 && cw.events[0].byKind === 'human' && typeof cw.cursor === 'string', 'campaign-wide /changes?kinds=chat,roll wakes on a roll in any visible area, with a cursor to pass back');
  // rate limit: the assistant has said one thing; two more are fine, the fourth in a minute is refused
  const say = (tok, n) => get(`${cp}/a/${T1}/do?cmd=chat.say&text=${encodeURIComponent('note ' + n)}&nonce=${n}&seat=${tok}`).then(r => r.body);
  const rl = [await say(asTok, 'rl2'), await say(asTok, 'rl3'), await say(asTok, 'rl4')];
  ok(rl[0].ok && rl[1].ok && rl[2].ok === false && rl[2].code === 'rate_limited' && rl[2].retry_after > 0, `an AI seat is rate-limited at 3 says a minute (${rl[2].why})`);
  // the loop breaker: two AI seats alternating more than 3 times with no human in between are paused
  const mk = async (id, name) => { const n0 = gm.ev.acks.filter(a => a.token).length; gm.submit('seat.create', { id, kind: 'llm', name, scope: { areas: [T1], classes: ['chat'] } }); await waitFor(() => gm.ev.acks.filter(a => a.token).length > n0, 3000, 'seat ' + name); return gm.ev.acks.filter(a => a.token).at(-1).token; };
  const E = await mk('seat_echo0001', 'Echo'), F = await mk('seat_fox00001', 'Fox'), G = await mk('seat_gull0001', 'Gull'), H = await mk('seat_hawk0001', 'Hawk');
  const loop = [await say(E, 'e1'), await say(F, 'f1'), await say(E, 'e2'), await say(F, 'f2'), await say(E, 'e3'), await say(F, 'f3')];
  ok(loop.slice(0, 4).every(r => r.ok) && loop[4].code === 'throttled' && loop[5].code === 'throttled', `two AI seats answering each other: 4 messages pass, then both are throttled (${loop[4].why})`);
  const rs = [await say(G, 'g1'), await say(H, 'h1'), await say(G, 'g2')];
  pl2.submit('chat.say', { id: 'msg_human0001', text: 'Brakka here' }, T1); await waitFor(() => pl2.pendingCount() === 0);
  rs.push(await say(H, 'h2'), await say(G, 'g3'), await say(H, 'h3'));
  ok(rs.every(r => r.ok), 'a human message in between resets the count (G, H, G, human, H, G, H all pass)');
  await waitFor(() => gm.view(T1).entities.room_kitch001 && pl2.view(T1).entities.room_kitch001, 3000, 'kitchen arrives');
  ok(gm.view(T1).entities.room_kitch001.layout.hash === pl2.view(T1).entities.room_kitch001.layout.hash, 'LLM-spawned room identical in both tabs');
  const pre = gm.ev.pres.filter(p => p.seat === 'seat_assist01').length;
  await sleep(600);
  const glide = gm.ev.pres.filter(p => p.seat === 'seat_assist01').slice(pre);
  ok(glide.length >= 4 && glide.some(p => !p.thinking), `ghost glides after acting (${glide.length} samples in 0.6 s, thinking cleared)`);
  // stale: advisor read at seq S, someone moves Brakka, advisor acts on the old seq
  const s2 = (await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body.area.seq;
  gm.submit('token.move', { id: 'tok_brakka001', x: 5, z: 5 }, T1);
  await waitFor(() => gm.pendingCount() === 0);
  const st2 = await get(`${cp}/a/${T1}/do?cmd=token.move&id=tok_brakka001&x=9&z=9&based_on=${s2}&nonce=a1&seat=${adTok}`);
  ok(st2.body.code === 'stale' && st2.body.changes?.some(c => c.args.id === 'tok_brakka001'), "stale based_on returns 'stale' and what changed");
  const st3 = await get(`${cp}/a/${T1}/do?cmd=token.move&id=tok_brakka001&x=9&z=9&based_on=${st2.body.seq}&nonce=a2&seat=${adTok}`);
  ok(st3.body.ok, "advisor moves the player's own token with a fresh seq");
  const ref = await get(`${cp}/a/${T1}/do?cmd=room.spawn&id=room_nope0001&type=privy&x=20&z=20&w=2&d=2&seed=1&nonce=a3&seat=${adTok}`);
  ok(ref.body.ok === false && ref.body.code === 'forbidden', `player-created seat REFUSED a GM-only command (${ref.body.why})`);
  const ref2 = await get(`${cp}/a/${T1}/do?cmd=token.move&id=tok_keeper001&x=1&z=1&nonce=a4&seat=${adTok}`);
  ok(ref2.body.ok === false, "advisor refused moving someone else's token");
  // long-poll follows along
  const lp = get(`${cp}/a/${T1}/changes?after=${st3.body.seqs[T1]}&wait=5&seat=${adTok}`);
  await sleep(150);
  gm.submit('token.move', { id: 'tok_keeper001', x: 41, z: 4 }, T1);
  const lpr = await lp;
  ok(lpr.body.entries?.length === 1 && lpr.body.entries[0].args.x === 41, 'long-poll returns the change as it happens');
}

// ---- second area: GM-only, transfer, visibility ----
gm.submit('area.create', { id: 'tbl_cellar01', name: 'The cellar', visibility: 'gm' });
await waitFor(() => gm.campaign.areas.length === 2);
ok(pl2.campaign.areas.length === 1, 'player view does not list the GM-only area');
gm.subscribe('tbl_cellar01');
await waitFor(() => gm.view('tbl_cellar01'));
{
  const r = await get(`${cp}/a/tbl_cellar01/state?seat=${adTok}`);
  ok(r.status === 404 && r.body.code === 'invisible', "player-created seat can't read the GM-only area");
  pl2.subscribe('tbl_cellar01');
  await sleep(200);
  ok(!pl2.view('tbl_cellar01'), 'player socket refused subscription to GM-only area');
  const logs = [];
  const raw = gm.onMessage.bind(gm);
  gm.onMessage = (m) => { if (m.t === 'log') logs.push(m); raw(m); };
  gm.submit('transfer', { id: 'tok_keeper001', from: T1, to: 'tbl_cellar01', x: 10, z: 10 });
  await waitFor(() => gm.view('tbl_cellar01').entities.tok_keeper001, 3000, 'transfer');
  const batch = logs.find(m => m.entries.some(e => e.type === 'transfer.in'));
  ok(batch && batch.entries.length === 2 && batch.entries[0].xid === batch.entries[1].xid, 'transfer arrives as ONE batch with both halves');
  ok(!gm.view(T1).entities.tok_keeper001 && gm.view('tbl_cellar01').entities.tok_keeper001.x === 10, 'keeper left area 1 and is on the cellar');
  await waitFor(() => !pl2.view(T1).entities.tok_keeper001);
  ok(!pl2.view(T1).entities.tok_keeper001, 'player sees the keeper leave (and nothing of the cellar)');
// area thumbnails (Settings ▸ World navigation): uploaded by a person who can see the area, served only to those who can
{
  const webp = (n) => { const b = Buffer.alloc(n); b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(n - 8, 4); b.write('WEBP', 8, 'ascii'); return b; };
  const up = (area, tok, body) => fetch(`${base}/c/${C.campaign}/a/${area}/thumb?seat=${tok}`, { method: 'POST', headers: { 'content-type': 'image/webp' }, body }).then(async r => ({ status: r.status, body: await r.json() }));
  const g1 = await up(T1, C.token, webp(2048));
  ok(g1.status === 200 && g1.body.ok && g1.body.bytes === 2048, 'the GM uploads an area thumbnail (WebP)');
  const img = await fetch(`${base}/c/${C.campaign}/a/${T1}/thumb?seat=${playerToken}`);
  ok(img.status === 200 && img.headers.get('content-type') === 'image/webp' && (await img.arrayBuffer()).byteLength === 2048, 'a player fetches the thumbnail of an area they can see');
  await up('tbl_cellar01', C.token, webp(1024));
  const hid = await fetch(`${base}/c/${C.campaign}/a/tbl_cellar01/thumb?seat=${playerToken}`);
  const lst = (await get(`/c/${C.campaign}/thumbs?seat=${playerToken}`)).body, lgm = (await get(`/c/${C.campaign}/thumbs?seat=${C.token}`)).body;
  ok(hid.status === 404 && lst.thumbs[T1] && !lst.thumbs.tbl_cellar01 && lgm.thumbs.tbl_cellar01, "a GM-only area's picture is invisible to players (404, not listed); the GM lists both");
  const fr = await fetch(`${base}/c/${C.campaign}/a/${T1}/thumb?seat=${C.token}&frame=25,20,61.5,-20,52,1.6`, { method: 'POST', headers: { 'content-type': 'image/webp' }, body: webp(2048) }).then(r => r.json());
  const bad = await fetch(`${base}/c/${C.campaign}/a/${T1}/thumb?seat=${C.token}&frame=25,20,nope`, { method: 'POST', headers: { 'content-type': 'image/webp' }, body: webp(2048) }).then(r => r.json());
  const lf = (await get(`/c/${C.campaign}/thumbs?seat=${playerToken}`)).body.thumbs[T1];
  ok(fr.ok && fr.frame?.dist === 61.5 && fr.frame.focus[0] === 25 && fr.frame.focus[2] === 20 && fr.frame.yaw === -20 && fr.frame.pitch === 52 && fr.frame.aspect === 1.6 && bad.ok && !bad.frame && lf && !lf.frame,
    'a thumbnail carries the camera it was shot from (listed with it); a malformed frame is dropped, the picture kept');
  ok((await up(T1, C.token, Buffer.from('not an image at all, honest'))).status === 400, 'only WebP is accepted');
  ok((await up(T1, C.token, webp(301 * 1024))).status === 413, 'size-capped at 300 KB');
  ok((await up(T1, asTok, webp(512))).status === 403, 'an AI seat cannot upload a picture');
  ok((await up('tbl_cellar01', playerToken, webp(512))).status === 404, 'a player cannot upload to an area they cannot see');
}
  // GM undo: transfer back, then move back
  gm.undo('tbl_cellar01');
  await waitFor(() => gm.view(T1).entities.tok_keeper001, 3000, 'undo transfer');
  ok(gm.view(T1).entities.tok_keeper001?.x === 41 && !gm.view('tbl_cellar01').entities.tok_keeper001, 'GM undo reverses the transfer atomically');
  gm.undo(T1);
  await waitFor(() => gm.view(T1).entities.tok_keeper001?.x === 44, 3000, 'undo move');
  ok(gm.view(T1).entities.tok_keeper001?.x === 44, 'GM undo restores the previous move');
  await waitFor(() => pl2.view(T1).entities.tok_keeper001?.x === 44);
  ok(pl2.view(T1).entities.tok_keeper001?.x === 44, 'undo reaches the player');
  // per-seat undo: the player undoes their own last move; asking to undo the GM's is refused
  const before = pl2.view(T1).entities.tok_brakka001;
  pl2.submit('token.move', { id: 'tok_brakka001', x: 7, z: 7 }, T1);
  await waitFor(() => gm.view(T1).entities.tok_brakka001.x === 7);
  pl2.undo(T1);
  await waitFor(() => gm.view(T1).entities.tok_brakka001.x === before.x);
  ok(gm.view(T1).entities.tok_brakka001.x === before.x, "player undoes their own move (per-seat undo)");
  pl2.submitRaw({ type: 'redo', area: T1, args: {} });
  await waitFor(() => gm.view(T1).entities.tok_brakka001.x === 7);
  ok(gm.view(T1).entities.tok_brakka001.x === 7, 'player redoes it');
  pl2.submitRaw({ type: 'undo', area: T1, args: { who: gm.me } });
  await waitFor(() => pl2.ev.nacks.some(n => n.code === 'forbidden'));
  ok(pl2.ev.nacks.some(n => n.code === 'forbidden'), "player may not undo the GM's actions");
  gm.submitRaw({ type: 'undo', area: T1, args: { who: pl2.me } });
  await waitFor(() => gm.view(T1).entities.tok_brakka001.x === before.x);
  ok(gm.view(T1).entities.tok_brakka001.x === before.x, "GM undoes the player's action");
}

// ---- relay restart (graceful) mid-session: nothing lost, clients reconnect on their own ----
{
  const before = stableStringify(relay.campaigns.get(C.campaign).state);
  const port = relay.port;
  await relay.close();
  relay = await startRelay({ port, dataDir, log: quiet });
  ok(stableStringify(relay.campaigns.get(C.campaign).state) === before, 'state identical after restart');
  await waitFor(() => gm.status === 'live' && pl2.status === 'live', 8000, 'auto-reconnect');
  ok(gm.status === 'live' && pl2.status === 'live', 'both clients reconnected by themselves');
  pl2.submit('token.move', { id: 'tok_brakka001', x: 33, z: 33 }, T1);
  await waitFor(() => gm.view(T1).entities.tok_brakka001.x === 33, 4000, 'post-restart move');
  ok(gm.view(T1).entities.tok_brakka001.x === 33, 'play continues after restart');
  const r = await get(`${cp}/a/${T1}/state?seat=${asTok}`);
  ok(r.body.rooms.length === 4, 'LLM token still valid after restart'); // the inn, the kitchen, and the feet/cells rooms
}

// ---- labels (Harry 2026-10-03): room and building names never reach seats that may not edit rooms ----
{
  // a raw socket as the player, so we see exactly what crosses the wire (not what ClientSync makes of it)
  const frames = [];
  const raw = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`);
  await new Promise(r => raw.on('open', r));
  raw.on('message', (d) => frames.push(String(d)));
  raw.send(JSON.stringify({ t: 'hello', token: playerToken }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')), 3000, 'raw welcome');
  raw.send(JSON.stringify({ t: 'sub', area: T1 }));
  await waitFor(() => frames.some(f => f.includes('"snap"') || f.includes('"log"')), 3000, 'raw sub');
  const T = gm.view(T1);
  const L = rg.solve(T.entities, { id: 'room_vault001', type: 'storeroom', x: 20, z: 20, w: 3, d: 3, seed: 7 }, T.order + 1);
  gm.submit('batch', { ops: [
    { type: 'room.spawn', args: { id: 'room_vault001', building: 'bld_keep00001', buildingName: 'Keep of Whispers', name: 'Secret vault', type: 'storeroom', x: 20, z: 20, w: 3, d: 3, seed: 7, engine: 'v2', engineVersion: rg.version, layout: L } },
  ] }, T1);
  await waitFor(() => gm.pendingCount() === 0 && pl2.view(T1)?.entities.room_vault001, 3000, 'vault arrives');
  gm.submit('room.set', { id: 'room_vault001', name: 'Secret vault (the real one)' }, T1);
  gm.submit('building.set', { id: 'bld_keep00001', name: 'Keep of Very Loud Whispers' }, T1);
  await waitFor(() => gm.pendingCount() === 0, 3000, 'renames');
  gm.submit('undo', {}, T1); // the building rename's inverse is an entities.set carrying the old name
  await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities.bld_keep00001.name === 'Keep of Whispers', 3000, 'undo rename');
  await sleep(200);
  ok(gm.view(T1).entities.room_vault001.name === 'Secret vault (the real one)' && gm.view(T1).entities.bld_keep00001.name === 'Keep of Whispers', 'the GM sees room and building labels (and renames them, undoably)');
  const pv = pl2.view(T1);
  ok(pv.entities.room_vault001 && !('name' in pv.entities.room_vault001) && pv.entities.bld_keep00001?.name === 'Building', 'the player has the room and its building, without their labels');
  // a rejoin (snapshot) and a raw-frame audit
  raw.send(JSON.stringify({ t: 'unsub', area: T1 })); raw.send(JSON.stringify({ t: 'sub', area: T1 }));
  await sleep(300);
  const leaked = frames.filter(f => /Secret vault|Whispers/.test(f));
  ok(frames.length > 3 && !leaked.length, `no frame to the player carries a label (${frames.length} frames, incl. a snapshot)`, leaked[0]?.slice(0, 120));
  raw.close();
  // the player's agent (GET) and the GM's assistant (may edit rooms)
  const adv = JSON.stringify((await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body) + JSON.stringify((await get(`${cp}/a/${T1}/look?x=27&z=27&r=20&seat=${adTok}`)).body) + JSON.stringify((await get(`${cp}/a/${T1}/changes?after=0&wait=0&seat=${adTok}`)).body);
  ok(!/Secret vault|Whispers/.test(adv), "the player's agent never reads a label (state, look, changes)");
  const asst = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body;
  ok(asst.rooms.find(r => r.id === 'room_vault001')?.name === 'Secret vault (the real one)', "the GM's assistant (may edit rooms) reads the label");
}

// ---- the pawn's ring (Harry 2026-10-06): GM notes never reach the player side; the damage undo's audience ----
{
  const frames = [];
  const raw = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`);
  await new Promise(r => raw.on('open', r));
  raw.on('message', (d) => frames.push(String(d)));
  raw.send(JSON.stringify({ t: 'hello', token: playerToken }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')), 3000, 'raw welcome (pawn ring)');
  raw.send(JSON.stringify({ t: 'sub', area: T1 }));
  await waitFor(() => frames.some(f => f.includes('"snap"') || f.includes('"log"')), 3000, 'raw sub (pawn ring)');
  // a fourth seat: a second player who neither made the change nor owns the pawn
  const nAck = gm.ev.acks.filter(a => a.token).length;
  gm.submit('seat.create', { id: 'seat_kit000001', kind: 'human', role: 'player', name: 'Kit', color: '#5aa9e6' });
  await waitFor(() => gm.ev.acks.filter(a => a.token).length > nAck, 3000, 'kit token');
  const kit = client(gm.ev.acks.filter(a => a.token).at(-1).token);
  await waitFor(() => kit.status === 'live'); kit.subscribe(T1); await waitFor(() => kit.view(T1));
  const P = 'tok_ringpc0001', M = 'tok_ringmon001', SECRET = 'QZX-the-innkeeper-is-the-traitor';
  gm.submit('batch', { ops: [{ type: 'token.create', args: { id: P, name: 'Mira', x: 60, z: 60, owner: 'seat_brakka001', damage: 7, gmNotes: `${SECRET} (at creation)` } }, { type: 'token.create', args: { id: M, name: 'Ogre', x: 65, z: 60 } }] }, T1);
  await waitFor(() => gm.pendingCount() === 0 && pl2.view(T1)?.entities[P] && kit.view(T1)?.entities[M], 3000, 'ring pawns arrive');
  gm.submit('token.set', { id: P, gmNotes: SECRET }, T1);                       // the note alone
  gm.submit('token.set', { id: P, gmNotes: `${SECRET} 2`, notes: 'afraid of fire' }, T1); // with a shared note
  await waitFor(() => gm.pendingCount() === 0 && pl2.view(T1).entities[P].notes === 'afraid of fire', 3000, 'notes');
  gm.submit('undo', {}, T1);                                                    // its inverse is an entities.set carrying the old note
  await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities[P].gmNotes === SECRET, 3000, 'undo note');
  pl2.submit('token.set', { id: P, notes: 'afraid of spiders' }, T1);           // the owner's own edit, and its undo, pass through the relay's full copy
  await waitFor(() => pl2.pendingCount() === 0 && gm.view(T1).entities[P].notes === 'afraid of spiders', 3000, 'owner note');
  pl2.submit('undo', {}, T1);
  await waitFor(() => pl2.pendingCount() === 0 && gm.view(T1).entities[P].notes !== 'afraid of spiders', 3000, 'owner undo');
  gm.submit('entity.flag', { ids: [P], hidden: true }, T1); await waitFor(() => !pl2.view(T1).entities[P], 3000, 'hidden');
  gm.submit('token.set', { id: P, gmNotes: `${SECRET} 3` }, T1);
  gm.submit('entity.flag', { ids: [P], hidden: false }, T1); await waitFor(() => pl2.view(T1).entities[P], 3000, 'revealed'); // a projection of the whole pawn
  await waitFor(() => gm.pendingCount() === 0, 3000);
  ok(gm.view(T1).entities[P].gmNotes === `${SECRET} 3`, 'the GM writes and reads GM notes');
  ok(pl2.view(T1).entities[P] && !('gmNotes' in pl2.view(T1).entities[P]) && !('gmNotes' in kit.view(T1).entities[P]), 'the players (the owner too) have the pawn without them');
  ok((await new Promise(r => { const n = pl2.ev.nacks.length; pl2.submit('token.set', { id: P, gmNotes: 'ha' }, T1); waitFor(() => pl2.ev.nacks.length > n, 3000, 'gm note nack').then(() => r(pl2.ev.nacks.at(-1)))} ))?.code === 'invalid', 'a player cannot write a GM note');
  raw.send(JSON.stringify({ t: 'unsub', area: T1 })); raw.send(JSON.stringify({ t: 'sub', area: T1 })); // a rejoin: the snapshot
  await sleep(300);
  const leaked = frames.filter(f => f.includes('QZX') || f.includes('gmNotes'));
  ok(frames.length > 6 && frames.some(f => f.includes('afraid of fire')) && !leaked.length, `no frame to a player carries a GM note or its field name: live, an undo, a reveal, a snapshot (${frames.length} frames)`, leaked[0]?.slice(0, 160));
  raw.close();
  const adv = JSON.stringify((await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body) + JSON.stringify((await get(`${cp}/a/${T1}/look?x=60&z=60&r=20&seat=${adTok}`)).body) + JSON.stringify((await get(`${cp}/a/${T1}/changes?after=0&wait=0&seat=${adTok}`)).body);
  ok(!/QZX|gmNotes/.test(adv), "the player's agent never reads a GM note (state, look, changes)");
  const stale = (await get(`${cp}/a/${T1}/do?cmd=token.move&id=${P}&x=61&z=60&based_on=1&nonce=ringstale1&seat=${adTok}`)).body;
  ok(!/QZX|gmNotes|Secret vault|Whispers/.test(JSON.stringify(stale)), 'nor in the "what changed" a stale command is answered with', JSON.stringify(stale).slice(0, 160));
  // DAMAGE: anyone; the undo of it: the changer, the pawn's owner, the GM. Kit hits Mira (owned by pl2's seat).
  const dmg = (c, id) => c.view(T1).entities[id].damage || 0;
  kit.submit('token.damage', { id: P, damage: 14 }, T1);
  await waitFor(() => kit.pendingCount() === 0 && dmg(gm, P) === 14, 3000, 'kit hits');
  ok(dmg(gm, P) === 14 && dmg(pl2, P) === 14, "a player changes another player's pawn's damage");
  const seqA = gm.view(T1).seq;
  const tryUndo = async (c, who, seq) => { const n = c.ev.nacks.length, a = c.ev.acks.length; c.submitRaw({ type: 'undo', area: T1, args: { who, seq } }); await waitFor(() => c.ev.nacks.length > n || c.ev.acks.length > a, 3000, 'undo answer'); return c.ev.nacks.length > n ? c.ev.nacks.at(-1) : { ok: true }; };
  const ownerUndo = await tryUndo(pl2, 'seat_kit000001', seqA);
  await waitFor(() => dmg(gm, P) === 7, 3000, 'owner undo lands');
  ok(ownerUndo.ok && dmg(gm, P) === 7, 'the OWNER undoes it, by its number');
  gm.submit('token.damage', { id: M, damage: 10 }, T1); await waitFor(() => gm.pendingCount() === 0 && dmg(kit, M) === 10, 3000);
  const seqB = gm.view(T1).seq, r4 = await tryUndo(kit, gm.me, seqB);
  ok(r4.code === 'forbidden' && dmg(gm, M) === 10, "a seat that neither made the change nor owns the pawn cannot undo it (the GM's change to the GM's ogre)", JSON.stringify(r4));
  pl2.submit('token.damage', { id: M, damage: 17 }, T1); await waitFor(() => pl2.pendingCount() === 0 && dmg(gm, M) === 17, 3000);
  const seqC = gm.view(T1).seq, r5 = await tryUndo(kit, 'seat_brakka001', seqC);
  ok(r5.code === 'forbidden' && dmg(gm, M) === 17, "nor another player's change to a monster");
  const r6 = await tryUndo(gm, 'seat_brakka001', seqC); await waitFor(() => dmg(gm, M) === 10, 3000);
  ok(r6.ok && dmg(gm, M) === 10, 'the GM undoes anyone\'s');
  // the owner's reach is damage changes only: not a move the GM made of the owner's pawn, and not without naming the change
  gm.submit('token.move', { id: P, x: 70, z: 70 }, T1); await waitFor(() => gm.pendingCount() === 0, 3000);
  const r7 = await tryUndo(pl2, gm.me, gm.view(T1).seq);
  kit.submit('token.damage', { id: P, damage: 10 }, T1); await waitFor(() => kit.pendingCount() === 0 && dmg(gm, P) === 10, 3000);
  const n8 = pl2.ev.nacks.length; pl2.submitRaw({ type: 'undo', area: T1, args: { who: 'seat_kit000001' } }); await waitFor(() => pl2.ev.nacks.length > n8, 3000, 'unnamed undo refused');
  ok(r7.code === 'forbidden' && gm.view(T1).entities[P].x === 70 && pl2.ev.nacks.length > n8 && dmg(gm, P) === 10, "the owner cannot undo someone's MOVE of the pawn, nor \"their last action\" unnamed");
  // several pawns in one change: every one must be the asker's
  kit.submit('batch', { ops: [{ type: 'token.damage', args: { id: P, damage: 20 } }, { type: 'token.damage', args: { id: M, damage: 20 } }] }, T1); await waitFor(() => kit.pendingCount() === 0 && dmg(gm, M) === 20, 3000);
  const r9 = await tryUndo(pl2, 'seat_kit000001', gm.view(T1).seq), r10 = await tryUndo(kit, 'seat_kit000001', gm.view(T1).seq);
  await waitFor(() => dmg(gm, M) === 10, 3000);
  ok(r9.code === 'forbidden' && r10.ok && dmg(gm, M) === 10 && dmg(gm, P) === 10, 'a change to two pawns is not one owner\'s to undo (the changer undoes it)');
  // an old client or agent that still sends hit points is told what changed
  { const n = gm.ev.nacks.length; gm.submit('token.set', { id: M, hp: 5 }, T1); await waitFor(() => gm.ev.nacks.length > n, 3000, 'legacy hp nack'); ok(/damage now/.test(gm.ev.nacks.at(-1)?.why || ''), 'a live token.set { hp } is refused with the reason (damage now)'); }
  // indicators and control
  kit.submit('token.mark', { id: M, mark: 'skull' }, T1); await waitFor(() => pl2.view(T1).entities[M].mark === 'skull', 3000);
  ok(gm.view(T1).entities[M].mark === 'skull' && pl2.view(T1).entities[M].mark === 'skull', 'an indicator set by one player is seen by every seat');
  gm.submit('token.owner', { id: M, owner: 'seat_kit000001' }, T1); await waitFor(() => kit.view(T1).entities[M].owner === 'seat_kit000001', 3000);
  kit.submit('token.move', { id: M, x: 66, z: 61 }, T1); await waitFor(() => kit.pendingCount() === 0 && gm.view(T1).entities[M].x === 66, 3000);
  ok(gm.view(T1).entities[M].x === 66, 'a pawn given to a player is theirs to move');
  const viaGet = (await get(`${cp}/a/${T1}/do?cmd=token.damage&id=${M}&damage=38&nonce=ringdmg1&force=1&seat=${adTok}`)).body;
  ok(viaGet.code === 'forbidden' && dmg(gm, M) === 10, "an AI seat is still held to its scope: one without the pawn class cannot change damage over GET", JSON.stringify(viaGet).slice(0, 120));
  const st = (await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body.tokens;
  ok(st.find(t => t.id === P)?.damage === 10 && st.find(t => t.id === M)?.mark === 'skull' && !st.some(t => 'hp' in t || 'hpMax' in t), "an AI seat's state lists each pawn's damage (and indicator); no hit points", JSON.stringify(st.find(t => t.id === P)));
  kit.close();
}

// ---- rooms turn and hide over the wire (Harry 2026-10-05): a hidden room never reaches the player side ----
{
  const frames = [];
  const raw = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`);
  await new Promise(r => raw.on('open', r));
  raw.on('message', (d) => frames.push(String(d)));
  raw.send(JSON.stringify({ t: 'hello', token: playerToken }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')), 3000, 'raw welcome');
  raw.send(JSON.stringify({ t: 'sub', area: T1 }));
  await waitFor(() => frames.some(f => f.includes('"snap"') || f.includes('"log"')), 3000, 'raw sub');
  const V = 'room_vault001', objs = (c) => Object.values(c.view(T1).entities).filter(e => e.kind === 'object' && e.room === V);
  const n0 = objs(gm).length, mark = frames.length;
  ok(n0 > 3 && objs(pl2).length === n0, `before: the player has the vault and its ${n0} things`);
  // the GM's assistant turns it through the GET door: the same command, the same result on every seat
  const rc0 = gm.view(T1).entities[V].recipe, before = Object.fromEntries(objs(gm).map(o => [o.id, [o.x, o.z]]));
  const rot = await get(`${cp}/a/${T1}/do?cmd=room.rotate&id=${V}&turns=1&nonce=turn-vault-1&seat=${asTok}`);
  await waitFor(() => pl2.view(T1).entities[V]?.recipe.turn === 1 && gm.view(T1).entities[V]?.recipe.turn === 1, 3000, 'turn arrives');
  const cx = (rc0.x + rc0.w / 2) * 5, cz = (rc0.z + rc0.d / 2) * 5, rc1 = gm.view(T1).entities[V].recipe, nx = (rc1.x + rc1.w / 2) * 5, nz = (rc1.z + rc1.d / 2) * 5;
  ok(rot.body.ok && objs(pl2).length === n0 && objs(pl2).every(o => Math.abs(o.x - (nx - (before[o.id][1] - cz))) < 0.02 && Math.abs(o.z - (nz + (before[o.id][0] - cx))) < 0.02), "an AI seat turns a room with the same command (GET room.rotate): every thing in it turns with it, on the player's side too");
  ok(stableStringify(gm.view(T1).entities) !== '' && objs(gm).every(o => stableStringify(o) === stableStringify({ ...pl2.view(T1).entities[o.id] })), 'GM and player hold identical things after the turn');
  // hide it: one id in, the whole room out of the player's world
  gm.submit('entity.flag', { ids: [V], hidden: true }, T1);
  await waitFor(() => gm.pendingCount() === 0 && !pl2.view(T1).entities[V], 3000, 'vault hidden from the player');
  ok(gm.view(T1).entities[V].hidden && objs(gm).length === n0 && objs(gm).every(o => o.hidden), 'the GM keeps the hidden room and its things (all flagged hidden)');
  ok(!pl2.view(T1).entities[V] && objs(pl2).length === 0, "the player's world loses the room and everything in it");
  // the GM works on it while it is hidden: nothing of that crosses to the player
  gm.submit('room.rotate', { id: V, turns: 1 }, T1); gm.submit('room.move', { id: V, dx: 1, dz: 0 }, T1);
  gm.submit('object.place', { id: 'obj_vaultgold1', cat: 'crate', x: 110, z: 110, room: V, dims: [2, 2, 2] }, T1);
  await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities.obj_vaultgold1, 3000, 'GM edits while hidden');
  { // the GM's plain cursor inside the hidden room: raw frames show the player gets 'gone' once, nothing while in, the cursor again outside
    const rc = gm.view(T1).entities[V].recipe, inX = (rc.x + rc.w / 2) * 5, inZ = (rc.z + rc.d / 2) * 5, pres = () => frames.filter(f => f.includes('"pres"')).map(f => JSON.parse(f)).filter(m => m.seat === gm.me);
    gm.presence(T1, { cursor: [200, 200], drag: null }); await waitFor(() => pres().some(m => m.cursor?.[0] === 200), 2000, 'outside cursor');
    const m1 = pres().length; gm.presence(T1, { cursor: [inX, inZ], drag: null }); await waitFor(() => pres().length > m1, 2000, 'gone on entering');
    gm.presence(T1, { cursor: [inX + 0.5, inZ], drag: null }); gm.presence(T1, { cursor: [inX + 1, inZ], drag: null }); await sleep(300);
    const inside = pres().slice(m1);
    ok(inside.length === 1 && inside[0].gone === true && !inside[0].cursor, `entering a hidden room: the player gets one 'gone' and no cursor (${inside.map(m => m.gone ? 'gone' : JSON.stringify(m.cursor)).join()})`);
    ok(!JSON.stringify(inside).includes(String(inX)), 'no frame to the player carries a coordinate inside the hidden room');
    ok(pl2.ev.pres.filter(m => m.seat === gm.me && m.cursor && Math.abs(m.cursor[0] - inX) < 2 && Math.abs(m.cursor[1] - inZ) < 2).length === 0, 'the player client never saw it either');
    const m2 = pres().length; gm.presence(T1, { cursor: [210, 210], drag: null }); await waitFor(() => pres().length > m2 && pres().at(-1).cursor?.[0] === 210, 2000, 'cursor back outside');
    ok(true, 'leaving the hidden room: the player receives the cursor again');
    gm.presence(T1, { cursor: [inX, inZ], drag: null }); await sleep(300);
    const pAI2 = (await get(`${cp}/presence?seat=${adTok}`)).body, gAI2 = (await get(`${cp}/presence?seat=${asTok}`)).body;
    ok(JSON.stringify(gAI2).includes(String(inX)), "the GM's own assistant still reads the cursor");
    ok(JSON.stringify(pAI2).includes(String(inX)) === false, "a player's agent is not told where the GM's cursor is inside the hidden room");
    gm.presence(T1, { cursor: [210, 210], drag: null }); await sleep(100);
  }
  raw.send(JSON.stringify({ t: 'unsub', area: T1 })); raw.send(JSON.stringify({ t: 'sub', area: T1 })); // and a fresh snapshot
  await sleep(300);
  const after = frames.slice(mark).filter(f => { const i = f.lastIndexOf(V); return i >= 0; });
  const lastMention = frames.map((f, i) => f.includes(V) || f.includes('obj_vaultgold1') ? i : -1).filter(i => i >= 0).pop() ?? -1;
  const hideFrame = frames.findIndex((f, i) => i >= mark && f.includes('"entities.set"') && f.includes(`"${V}":null`));
  const snap = frames.filter(f => f.includes('"snap"')).pop() || '';
  ok(snap && !snap.includes('bld_keep00001') && snap.includes('"entities"'), 'a fresh snapshot for the player also leaves out the building that has no room they can see');
  ok(hideFrame >= 0 && lastMention === hideFrame && gm.view(T1).entities.obj_vaultgold1.hidden, `after the frame that takes the room away, no frame to the player mentions it again (turned, moved, a thing placed in it, a fresh snapshot); ${frames.length - mark} frames`, frames[lastMention]?.slice(0, 160));
  const adv = JSON.stringify((await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body) + JSON.stringify((await get(`${cp}/a/${T1}/look?x=110&z=110&r=40&seat=${adTok}`)).body);
  const asst = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body;
  ok(!adv.includes(V) && !adv.includes('obj_vaultgold1') && asst.rooms.find(r => r.id === V)?.hidden === true, "AI seats inherit their creator's view: the player's agent reads nothing of the hidden room, the GM's assistant reads it (marked hidden)");
  const refused = await get(`${cp}/a/${T1}/do?cmd=room.rotate&id=${V}&turns=1&nonce=turn-vault-2&seat=${adTok}`);
  ok(refused.body.ok === false, "the player's agent cannot act on it", refused.body.why);
  // reveal: the whole room comes back
  gm.submit('entity.flag', { ids: [V], hidden: false }, T1);
  await waitFor(() => gm.pendingCount() === 0 && pl2.view(T1).entities[V] && objs(pl2).length === n0 + 1, 3000, 'vault revealed');
  ok(objs(pl2).length === n0 + 1 && !objs(pl2).some(o => o.hidden) && !('name' in pl2.view(T1).entities[V]), 'revealing gives the player the whole room back (still without its label)');
  raw.close();
}

// ---- rooms that are not rectangles, through the GET door (Harry 2026-10-05) ----
{
  const seq0 = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body;
  const kit = seq0.rooms.find(r => r.id === 'room_kitch001'); // the kitchen at x 30..50, z 0..20 (feet)
  // a rectangle drawn over the kitchen's south-east corner: refused as it stands, an L with clip=1
  const plain = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=storeroom&x=40&z=10&w=30&d=25&seed=9&nonce=shape-0&seat=${asTok}`);
  ok(plain.body.ok === false && /overlaps/.test(plain.body.why), 'a rectangle over an existing room is still refused when sent as it is', plain.body.why);
  const clipped = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=storeroom&x=40&z=10&w=30&d=25&seed=9&clip=1&nonce=shape-1&seat=${asTok}`);
  const st = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body, lr = st.rooms.find(r => r.id === clipped.body.id);
  ok(clipped.body.ok && /does not overlap/.test(clipped.body.note || '') && lr?.outline?.length >= 6 && /not a rectangle/.test(lr.shape), `with clip=1 the relay makes the part that does not overlap: an L-shaped room (${lr?.outline?.length} corners)`, clipped.body.why || clipped.body.note);
  const feet = lr.outline, inKitchen = (x, z) => x > kit.x && x < kit.x + kit.w && z > kit.z && z < kit.z + kit.d;
  ok(feet.every(([x, z]) => x % 5 === 0 && z % 5 === 0) && !feet.some(([x, z]) => inKitchen(x, z)) && lr.objects !== undefined, 'its outline is reported in feet and keeps out of the kitchen');
  await waitFor(() => gm.view(T1).entities[clipped.body.id] && pl2.view(T1).entities[clipped.body.id], 3000, 'L arrives');
  const le = gm.view(T1).entities[clipped.body.id], lo = Object.values(gm.view(T1).entities).filter(e => e.kind === 'object' && e.room === le.id);
  ok(le.recipe.outline && lo.length > 5 && stableStringify(pl2.view(T1).entities[le.id].recipe) === stableStringify(le.recipe), `the relay furnished it (${lo.length} things) and every seat holds the same shape`);
  // an explicit outline in feet, in the L's own notch... no: beside it, to prove the conversion (a 15 x 10 ft L)
  const ex = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=privy&x=200&z=200&w=15&d=10&seed=3&outline=${encodeURIComponent('[[200,200],[205,200],[205,205],[215,205],[215,210],[200,210]]')}&nonce=shape-2&seat=${asTok}`);
  await waitFor(() => gm.view(T1).entities[ex.body.id], 3000, 'explicit outline arrives');
  ok(ex.body.ok && stableStringify(gm.view(T1).entities[ex.body.id]?.recipe.outline) === '[[0,0],[1,0],[1,1],[3,1],[3,2],[0,2]]', 'an outline given in feet is stored in cells, relative to the room', ex.body.why);
  const badO = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=privy&x=300&z=300&w=15&d=10&seed=3&outline=${encodeURIComponent('[[300,300],[315,310],[300,310]]')}&nonce=shape-3&seat=${asTok}`);
  ok(badO.body.ok === false && /outline/.test(badO.body.why), 'a bad outline is refused with a reason', badO.body.why);
  const inside = await get(`${cp}/a/${T1}/do?cmd=room.spawn&type=privy&x=35&z=5&w=10&d=10&seed=3&clip=1&nonce=shape-4&seat=${asTok}`);
  ok(inside.body.ok === false && /entirely inside/.test(inside.body.why), 'clip=1 on a rectangle wholly inside a room: refused, nothing to make', inside.body.why);
  const card3 = await docs(asTok);
  ok(/clip=1/.test(card3) && /outline=/.test(card3), 'the rules card explains clip=1 and outline');
  gm.submit('room.rotate', { id: ex.body.id, turns: 1 }, T1); // the small L standing by itself
  await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities[ex.body.id].recipe.turn === 1 && pl2.view(T1).entities[ex.body.id]?.recipe.turn === 1, 3000, 'L turned');
  const tr = gm.view(T1).entities[ex.body.id].recipe;
  ok(tr.w === 2 && tr.d === 3 && stableStringify(tr.outline) === '[[0,0],[2,0],[2,1],[1,1],[1,3],[0,3]]' && stableStringify(pl2.view(T1).entities[ex.body.id].recipe) === stableStringify(tr), 'an L-shaped room turns over the wire (its outline with it), the same for every seat');
}

// ---- storeys (2026-10-05): height through the GET door; a hidden upper or lower room never reaches the player side ----
{
  const doGet = (qs, nonce) => get(`${cp}/a/${T1}/do?${qs}&nonce=${nonce}&seat=${asTok}`).then(r => r.body);
  const g = await doGet('cmd=room.spawn&type=common&x=300&z=300&w=30&d=20&seed=11', 'st-g');
  const u = await doGet('cmd=room.spawn&type=guest&x=300&z=300&w=20&d=20&y=10&seed=12', 'st-u');
  const dn = await doGet('cmd=room.spawn&type=cellar&x=300&z=300&w=20&d=20&y=-10&seed=13', 'st-d');
  ok(g.ok && u.ok && dn.ok, 'an AI seat builds a ground room, a room on top of it (y=10) and a cellar under it (y=-10): same x and z, three heights', JSON.stringify([g.why, u.why, dn.why]));
  const G = g.id, U = u.id, D = dn.id;
  const st = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body, rm = (id) => st.rooms.find(r => r.id === id);
  ok(rm(G).y === 0 && rm(G).storey === 0 && rm(G).level === 'lv 1' && rm(U).y === 10 && rm(U).storey === 1 && rm(U).level === 'lv 2' && rm(U).height === 10 && rm(D).y === -10 && rm(D).storey === -1 && rm(D).level === 'lv -1', 'state reports each room\'s height in feet, its derived storey and its level label', JSON.stringify([rm(G), rm(U), rm(D)].map(r => [r.y, r.storey, r.level])));
  const b = st.buildings.find(x => x.id === rm(G).building);
  ok(rm(G).building && rm(U).building === rm(G).building && rm(D).building === rm(G).building && b && b.base === 0 && b.storeyHeight === 10 && b.levels.map(l => l.level).join() === 'lv -1,lv 1,lv 2', 'the stacked rooms join the building below them; the building lists its base, storey height and levels', JSON.stringify(b));
  await waitFor(() => gm.view(T1).entities[U] && gm.view(T1).entities[D] && pl2.view(T1).entities[U] && pl2.view(T1).entities[D], 3000, 'storeys arrive');
  const E = gm.view(T1).entities, objsOf = (c, id) => Object.values(c.view(T1).entities).filter(e => e.kind === 'object' && e.room === id);
  // STAIRS (core/stairs.js): a room made off the ground floor over GET gets its stair, as its own command
  const ST = await import('../core/stairs.js');
  await waitFor(() => gm.view(T1).entities[u.stair] && (!dn.stair || gm.view(T1).entities[dn.stair]) && pl2.view(T1).entities[u.stair], 3000, 'stairs arrive');
  { const su = gm.view(T1).entities[u.stair], sd = gm.view(T1).entities[dn.stair];
    ok(ST.isPlacedStair(su) && !ST.isStair(su) && su.down === true && su.room === G && su.y === 0 && ST.stairRise(su) === 10 && (sd ? ST.isPlacedStair(sd) && !sd.down && sd.room === D && sd.y === -10 : /no stair added: no free spot/.test(dn.stairNote)) && !g.stair && !g.stairNote, 'a GET room.spawn off the ground floor adds a stair or a ladder up into the upper room from the room below; a cellar gets one up into the room above, or is told there is no free spot; the ground room gets none', JSON.stringify([u.stair, dn.stair, u.stairNote, dn.stairNote]));
    const hole = ST.stairCells(su), up = objsOf(gm, U).filter(o => !o.parent && o.place !== 'wall' && o.place !== 'ceiling' && !o.flat);
    ok(!up.some(o => hole.some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7)), 'the relay furnished the upper room clear of the stair\'s hole');
    const st2 = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body, si = st2.stairs.find(x => x.id === u.stair);
    ok(si && si.from === G && si.to === U && si.fromLevel === 'lv 1' && si.toLevel === 'lv 2' && si.top[2] === 10 && si.bottom[2] === 0 && st2.stairs.length >= 1, 'state lists stairs: the rooms and levels each joins, its squares and both ends, in feet', JSON.stringify(si));
    gm.submit('token.create', { id: 'tok_stairs0001', name: 'Stepper', x: si.bottom[0], z: si.bottom[1] }, T1);
    await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities.tok_stairs0001, 3000, 'stepper');
    const hop = await doGet(`cmd=token.move&id=tok_stairs0001&stair=${u.stair}&x=0&z=0`, 'st-hop'), at1 = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body.tokens.find(t => t.id === 'tok_stairs0001');
    const back = await doGet(`cmd=token.move&id=tok_stairs0001&stair=${u.stair}&x=0&z=0`, 'st-hop2'), at2 = (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body.tokens.find(t => t.id === 'tok_stairs0001');
    ok(hop.ok && at1.y === 10 && at1.room === U && at1.level === 'lv 2' && at1.x === si.top[0] && back.ok && at2.y === 0 && at2.room === G && at2.x === si.bottom[0], 'token.move&stair=ID takes a pawn to the stair\'s other end: up to the top landing (lv 2), and back down to the foot', JSON.stringify([at1, at2]));
    const bad = await doGet('cmd=token.move&id=tok_stairs0001&stair=obj_nostair001&x=0&z=0', 'st-hop3'); ok(bad.ok === false && /no stair/.test(bad.why), 'an unknown stair id is refused with a pointer to state');
    const card2 = await docs(asTok); ok(/stair=STAIR_ID/.test(card2) && /stair=0/.test(card2), 'the rules card explains stairs');
    // one undo by the seat that made the room removes just the stair
    const g2 = await doGet('cmd=room.spawn&type=common&x=600&z=300&w=30&d=20&seed=21', 'st-g2'), u2 = await doGet('cmd=room.spawn&type=guest&x=600&z=300&w=20&d=20&y=10&seed=22', 'st-u2');
    await waitFor(() => gm.view(T1).entities[u2.stair], 3000, 'second stair');
    gm.submit('undo', { who: 'seat_assist01' }, T1); const un = { ok: true }; await waitFor(() => gm.pendingCount() === 0 && !gm.view(T1).entities[u2.stair], 3000, 'stair undone'); // (the GM undoes the assistant's last action)
    ok(g2.ok && u2.ok && u2.stair && un.ok && !gm.view(T1).entities[u2.stair] && gm.view(T1).entities[u2.id], 'the first undo of that seat\'s work removes just the stair; the upper room stays', JSON.stringify([g2.ok, u2, un, !!gm.view(T1).entities[u2.id]]));
    gm.submit('redo', { who: 'seat_assist01' }, T1); await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities[u2.stair], 3000, 'stair redone'); ok(gm.view(T1).entities[u2.stair], 'and redo brings it back'); }
  ok(objsOf(gm, U).length > 1 && objsOf(gm, U).every(o => o.y >= 10 && o.y < 20) && objsOf(gm, D).every(o => o.y >= -10 && o.y < 0) && objsOf(gm, G).every(o => (o.y || 0) >= 0 && (o.y || 0) < 10), 'furniture is solved at its room\'s height (absolute y)');
  const far = await doGet('cmd=room.spawn&type=guest&x=600&z=600&w=20&d=20&y=10&seed=1', 'st-far');
  const out = await doGet('cmd=room.spawn&type=guest&x=320&z=300&w=40&d=20&y=10&seed=1', 'st-out');
  const odd = await doGet('cmd=room.spawn&type=guest&x=300&z=300&w=20&d=20&y=7&seed=1', 'st-odd');
  const dup = await doGet('cmd=room.spawn&type=guest&x=310&z=300&w=20&d=20&y=10&seed=1', 'st-dup');
  const jet = await doGet('cmd=room.spawn&type=storeroom&x=320&z=300&w=20&d=20&y=10&seed=5&stair=0', 'st-jet');
  ok(far.ok === false && /nothing to stand on/.test(far.why) && out.ok === false && /overhang/.test(out.why) && odd.ok === false && /multiple of 5/.test(odd.why) && dup.ok === false && /overlaps/.test(dup.why), 'refused: an upper room with nothing under it, one that overhangs by more than two squares, a height off the 5-ft lattice, two rooms sharing space at one height', JSON.stringify([far.why, out.why, odd.why, dup.why]));
  ok(jet.ok, 'an upper room may overhang the room below by up to two squares (10 ft)', jet.why);
  ok(jet.ok && !jet.stair && !jet.stairNote, 'stair=0: no stair is added');
  // the wall map: per height; no outside door off the ground floor, no windows below ground
  await waitFor(() => gm.view(T1).entities[jet.id], 3000, 'jetty room arrives');
  const W = rg.edges(gm.view(T1).entities), at = (y) => [...W.edges.values()].filter(e => (e.y || 0) === y && e.sides.some(s => [G, U, D, jet.id].includes(s.room)));
  ok(at(10).length && at(10).every(e => e.key.endsWith('@10')) && at(-10).every(e => e.key.endsWith('@-10')) && at(0).every(e => !e.key.includes('@')), 'walls are worked out per height; keys off the ground carry their level');
  ok(!at(10).some(e => e.kind === 'door' && e.sides.length === 1) && !at(-10).some(e => (e.kind === 'door' && e.sides.length === 1) || e.kind === 'window') && at(10).some(e => e.kind === 'door' && e.sides.length === 2), 'no outside door upstairs or below ground, no windows below ground; the two upstairs rooms share a door');
  // a pawn's floor is derived from its height
  gm.submit('token.create', { id: 'tok_climb0001', name: 'Climber', x: 310, z: 310, }, T1);
  await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities.tok_climb0001, 3000, 'climber');
  const mv = await doGet('cmd=token.move&id=tok_climb0001&x=310&z=310&y=10', 'st-mv');
  const tk = async () => (await get(`${cp}/a/${T1}/state?seat=${asTok}`)).body.tokens.find(t => t.id === 'tok_climb0001');
  const up = await tk(); await doGet('cmd=token.move&id=tok_climb0001&x=310&z=310&y=-10', 'st-mv2'); const down = await tk();
  ok(mv.ok && up.y === 10 && up.storey === 1 && up.level === 'lv 2' && up.room === U && down.y === -10 && down.storey === -1 && down.room === D && !('floor' in gm.view(T1).entities.tok_climb0001), 'a pawn moved to y=10 is on storey 1 in the upper room, at y=-10 in the cellar: derived, nothing stored', JSON.stringify([up, down]));
  const lk = (await get(`${cp}/a/${T1}/look?x=310&z=310&r=12&y=10&seat=${asTok}`)).body;
  ok(lk.near.some(n => n.id === U) && !lk.near.some(n => n.id === G || n.id === D) && lk.near.every(n => n.y >= 9.5 && n.y < 19.5), 'look with y= lists only that storey');
  const card = await docs(asTok);
  ok(/HEIGHT AND STOREYS/.test(card) && /y=FEET/.test(card), 'the rules card explains height and storeys');
  // a wall edit upstairs, then hide the upper room and the cellar
  const UK = `h:${E[U].recipe.x}:${E[U].recipe.z}@10`, DK = `h:${E[D].recipe.x}:${E[D].recipe.z}@-10`;
  gm.submit('edge.set', { key: UK, as: 'open' }, T1); gm.submit('edge.set', { key: DK, as: 'open' }, T1);
  await waitFor(() => gm.pendingCount() === 0 && pl2.view(T1).entities[edgeId(UK)] && pl2.view(T1).entities[edgeId(DK)], 3000, 'wall edits at height arrive');
  const frames = [];
  const raw = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`);
  await new Promise(r => raw.on('open', r));
  raw.on('message', (d) => frames.push(String(d)));
  raw.send(JSON.stringify({ t: 'hello', token: playerToken }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')), 3000, 'raw welcome (storeys)');
  raw.send(JSON.stringify({ t: 'sub', area: T1 }));
  await waitFor(() => frames.some(f => f.includes('"snap"') || f.includes('"log"')), 3000, 'raw sub (storeys)');
  const secret = [U, D, edgeId(UK), edgeId(DK), ...objsOf(gm, U).map(o => o.id), ...objsOf(gm, D).map(o => o.id)];
  gm.submit('entity.flag', { ids: [U, D], hidden: true }, T1);
  await waitFor(() => gm.pendingCount() === 0 && !pl2.view(T1).entities[U] && !pl2.view(T1).entities[D], 3000, 'upper room and cellar hidden');
  ok(secret.every(id => !pl2.view(T1).entities[id]) && pl2.view(T1).entities[G] && pl2.view(T1).entities[jet.id], 'hiding the upper room and the cellar takes them, their things and their @-keyed wall edits out of the player\'s world; the ground floor stays');
  ok(gm.view(T1).entities[u.stair].hidden && !pl2.view(T1).entities[u.stair] && (!dn.stair || (gm.view(T1).entities[dn.stair].hidden && !pl2.view(T1).entities[dn.stair])) && ST.stairsOf(pl2.view(T1).entities).filter(x => x.room === G).length === 0 && ST.holesAt(pl2.view(T1).entities, 0).size === 0 && !ST.stairCells(gm.view(T1).entities[u.stair]).some(c => ST.holesAt(pl2.view(T1).entities, 10).has(c.join(':'))),
    'the stair up to the hidden room and the stair down to the hidden cellar are hidden with them: the player has no stair and no hole in any floor', JSON.stringify([gm.view(T1).entities[u.stair]?.hidden, !!pl2.view(T1).entities[u.stair], dn.stair, ST.stairsOf(pl2.view(T1).entities).map(x => [x.id, x.room]), [...ST.holesAt(pl2.view(T1).entities, 0)], [...ST.holesAt(pl2.view(T1).entities, 10)]]));
  ok(!(await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body.stairs.some(x => x.from === G || x.to === U), "and the player's agent is told of no stair there");
  const mark = frames.length;
  gm.submit('object.place', { id: 'obj_upgold0001', cat: 'crate', x: 310, z: 310, y: 10, room: U, dims: [2, 2, 2] }, T1);
  gm.submit('edge.set', { key: `h:${E[U].recipe.x + 1}:${E[U].recipe.z}@10`, as: 'open' }, T1);
  gm.submit('room.move', { id: D, dx: 0, dz: 0, dy: -10 }, T1);
  await waitFor(() => gm.pendingCount() === 0 && gm.view(T1).entities[D]?.recipe.y === -20, 3000, 'GM edits hidden storeys');
  ok(gm.view(T1).entities[edgeId(shift20(DK))] && !gm.view(T1).entities[edgeId(DK)] && objsOf(gm, D).every(o => o.y >= -20 && o.y < -10), 'room.move dy carries the room, its things and its wall edits to the new height');
  raw.send(JSON.stringify({ t: 'unsub', area: T1 })); raw.send(JSON.stringify({ t: 'sub', area: T1 }));
  await sleep(300);
  const later = frames.slice(mark).join('\n'), all = [...secret, u.stair, ...(dn.stair ? [dn.stair] : []), 'obj_upgold0001', '@10', '@-10', '@-20'];
  // (the stored wall edits' ids end a10 / am10 / am20. Looked for as edge ids only: until 2026-10-11 the bare letters were looked for, and a random object id holding "a10" failed this about one run in four)
  const edgeIds = later.match(/edge_[a-z0-9]+a(?:10|m10|m20)(?![a-z0-9])/g) || []; if (edgeIds.length) all.push(edgeIds[0]);
  ok(frames.slice(mark).some(f => f.includes('"snap"')) && !edgeIds.length && all.every(k => k === edgeIds[0] || !later.includes(k)), 'after that, no frame to the player (edits upstairs and below, a fresh snapshot) mentions the hidden storeys, their things or their wall keys', all.find(k => later.includes(k)));
  const adv = JSON.stringify((await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body) + JSON.stringify((await get(`${cp}/a/${T1}/look?x=310&z=310&r=40&seat=${adTok}`)).body);
  const advSt = (await get(`${cp}/a/${T1}/state?seat=${adTok}`)).body;
  ok(all.slice(0, secret.length + 1).every(k => !adv.includes(k)) && advSt.rooms.some(r => r.id === G) && !advSt.buildings.find(x => x.id === rm(G).building).levels.some(l => l.storey === -1), "the player's agent reads nothing of the hidden storeys over GET (state, look, the building's level list)");
  gm.submit('entity.flag', { ids: [U], hidden: false }, T1);
  await waitFor(() => gm.pendingCount() === 0 && pl2.view(T1).entities[U], 3000, 'upper room revealed');
  ok(pl2.view(T1).entities[edgeId(UK)] && objsOf(pl2, U).length === objsOf(gm, U).length, 'revealing the upper room gives the player the room, its things and its wall edits');
  ok(pl2.view(T1).entities[u.stair] && !pl2.view(T1).entities[u.stair].hidden && (!dn.stair || !pl2.view(T1).entities[dn.stair]), 'and the stair up to it (a cellar\'s stays hidden with the cellar)');
  raw.close();
}

// ---- revocation cascade, live ----
{
  gm.submit('seat.revoke', { who: 'seat_brakka001' });
  await waitFor(() => pl2.status === 'denied', 3000, 'player denied');
  ok(pl2.status === 'denied', "revoked player's socket is closed");
  const r = await get(`${cp}/a/${T1}/state?seat=${adTok}`);
  ok(r.status === 403, "the player's advisor is revoked with them");
  const r2 = await get(`${cp}/a/${T1}/state?seat=${asTok}`);
  ok(r2.status === 200, "the GM's assistant is unaffected");
  ok(!gm.campaign.seats.some(s => s.id === 'seat_advise01'), 'roster drops both');
}
gm.close();
await relay.close();

// ---- hard crash: kill -9 the relay process between acknowledged commands; nothing acknowledged is lost ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-crash-')); madeDirs.push(dir);
  const boot = () => new Promise((resolve) => {
    const p = spawn(process.execPath, [new URL('../relay/server.js', import.meta.url).pathname], { env: { ...process.env, PORT: '18198', DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.on('data', (d) => { if (/listening/.test(d)) resolve(p); });
  });
  let p = await boot();
  base = 'http://127.0.0.1:18198';
  const c = await post('/campaigns', { name: 'crash', gm: 'H' });
  const acked = [];
  for (let i = 0; i < 40; i++) {
    const r = await get(`/c/${c.campaign}/a/${c.area}/do?cmd=object.place&id=obj_crash${String(i).padStart(3, '0')}&name=crate&x=${i}&z=0&nonce=n${i}&seat=${c.token}`);
    if (r.body.ok) acked.push(i);
  }
  p.kill('SIGKILL');
  await new Promise(r => p.on('exit', r));
  // a torn write at the end of the journal (crash mid-line) must be cut, not crash the load
  fs.appendFileSync(path.join(dir, c.campaign, 'journal.jsonl'), '{"r":999,"fx":[{"tab');
  p = await boot();
  const st = await get(`/c/${c.campaign}/a/${c.area}/state?seat=${c.token}`);
  ok(st.body.objects?.length === acked.length && acked.length === 40, `kill -9: all ${acked.length} acknowledged commands survived; torn tail cut`);
  const again = await get(`/c/${c.campaign}/a/${c.area}/do?cmd=object.place&id=obj_crash039&name=crate&x=39&z=0&nonce=n39&seat=${c.token}`);
  ok(again.body.duplicate, 'idempotency survives a crash (nonce replayed from the journal)');
  p.kill('SIGTERM');
}

// ---- deleting a campaign; a shutdown that meets a campaign whose folder is gone (2026-10-06) ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-relay-del-')); madeDirs.push(dir);
  const logs = [];
  let r = await startRelay({ port: 0, dataDir: dir, log: (m) => logs.push(m) });
  const b = `http://127.0.0.1:${r.port}`;
  const mk = (name) => fetch(b + '/campaigns', { method: 'POST', body: JSON.stringify({ name, gm: 'GM' }) }).then(x => x.json());
  const J = (p, method = 'GET') => fetch(b + p, { method }).then(async x => ({ status: x.status, body: await x.json() }));
  const [A, B, C, D] = [await mk('first'), await mk('gone under it'), await mk('last'), await mk('TEST delete me (throwaway)')];
  // -- delete: who may
  const pl = await J(`/c/${D.campaign}/do?cmd=seat.create&id=seat_delplayr1&kind=human&role=player&name=P&seat=${D.token}`);
  const ai = await J(`/c/${D.campaign}/do?cmd=seat.create&id=seat_delgmai01&kind=llm&name=Helper&scope=${encodeURIComponent(JSON.stringify({ areas: '*', classes: ['object'] }))}&seat=${D.token}`);
  ok(pl.body.token && ai.body.token, 'delete: a player seat and a GM-made AI seat exist', [pl.body, ai.body]);
  ok((await J(`/c/${D.campaign}/delete?seat=${pl.body.token}`, 'POST')).status === 403, 'delete: a player is refused');
  ok((await J(`/c/${D.campaign}/delete?seat=${ai.body.token}`, 'POST')).status === 403, 'delete: an AI seat is refused, even the GM\'s own');
  ok((await J(`/c/${D.campaign}/delete?seat=${D.token}`)).status === 405 && (await J(`/c/${A.campaign}/delete?seat=${D.token}`, 'POST')).status === 404, 'delete: POST only, and a GM token deletes only its own campaign');
  ok(r.campaigns.has(D.campaign) && fs.existsSync(path.join(dir, D.campaign, 'journal.jsonl')), 'delete: nothing was deleted by the refused calls');
  // -- delete: an open connection is told and closed; the folder is moved aside, not destroyed
  const c = new ClientSync({ token: D.token, transport: wsTransport(`ws://127.0.0.1:${r.port}/ws`, WebSocket) });
  c.connect(); await waitFor(() => c.status === 'live', 4000, 'gm live'); c.subscribe(D.area); await waitFor(() => c.view(D.area), 4000, 'view');
  const del = await J(`/c/${D.campaign}/delete?seat=${D.token}`, 'POST');
  ok(del.body.ok && del.body.name === 'TEST delete me (throwaway)' && /^removed-\d{4}-\d\d-\d\d\//.test(del.body.kept || ''), 'delete: the GM deletes her campaign; the answer names it and where its files went', del.body);
  ok(!r.campaigns.has(D.campaign) && !fs.existsSync(path.join(dir, D.campaign)) && fs.existsSync(path.join(dir, del.body.kept, 'journal.jsonl')) && fs.existsSync(path.join(dir, del.body.kept, 'snapshot.json')), 'delete: off the relay, its folder moved to removed-<date>/ whole (journal and a last snapshot)');
  ok(await waitFor(() => c.status !== 'live', 4000, 'conn closed'), 'delete: the open connection was closed');
  c.close?.();
  ok((await J(`/c/${D.campaign}/state?seat=${D.token}`)).status === 404 && (await J('/health')).body.campaigns === 3, 'delete: its token opens nothing any more; the relay counts three campaigns');
  // -- purge=1 removes the files
  const E = await mk('TEST purge me (throwaway)');
  const pur = await J(`/c/${E.campaign}/delete?seat=${E.token}&purge=1`, 'POST');
  ok(pur.body.ok && pur.body.purged && !fs.existsSync(path.join(dir, E.campaign)) && !fs.readdirSync(dir).filter(d => d.startsWith('removed-')).some(d => fs.existsSync(path.join(dir, d, E.campaign))), 'delete with purge=1: the folder is gone, not moved');
  // -- a campaign's folder deleted under the running relay: the ones after it still get their shutdown snapshot
  for (const X of [A, B, C]) await J(`/c/${X.campaign}/a/${X.area}/do?cmd=object.place&id=obj_shut00001&name=crate&x=1&z=1&seat=${X.token}`);
  const order = [...r.campaigns.keys()], iB = order.indexOf(B.campaign);
  const before = Object.fromEntries([A, C].map(X => [X.campaign, fs.existsSync(path.join(dir, X.campaign, 'snapshot.json'))]));
  fs.rmSync(path.join(dir, B.campaign), { recursive: true, force: true });
  let threw = null; try { await r.close(); } catch (e) { threw = e; }
  ok(!threw, 'shutdown with a campaign whose folder is gone: close() does not throw', threw?.message);
  const snapped = (X) => { try { return JSON.parse(fs.readFileSync(path.join(dir, X.campaign, 'snapshot.json'), 'utf8')).state.areas[X.area].entities.obj_shut00001?.x === 1; } catch { return false; } };
  ok(snapped(A) && snapped(C) && !before[A.campaign] && !before[C.campaign], 'every other campaign, before and after it in the order, got its shutdown snapshot', { order, iB });
  ok(logs.some(m => m.includes(B.campaign) && /could not save on shutdown/.test(m)), 'the one that could not be saved is named in the log');
  // -- and the relay comes back: two campaigns, the deleted and the vanished ones not loaded
  r = await startRelay({ port: 0, dataDir: dir, log: quiet });
  ok(r.campaigns.size === 2 && r.campaigns.has(A.campaign) && r.campaigns.has(C.campaign), 'after a restart: the two saved campaigns load; removed-<date>/ is not read');
  await r.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---- a thing's orientation (quat; it was tiltZ on 2026-10-11): saved, reloaded, synced, undone; carried by a move, a re-roll (pinned), a storey move ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-relay-tilt-')); madeDirs.push(dir);
  let r = await startRelay({ port: 0, dataDir: dir, log: quiet });
  const b2 = () => `http://127.0.0.1:${r.port}`;
  const acks = [];
  const mk = (token) => { const ev = { pres: [] }; const c = new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${r.port}/ws`, WebSocket), onPresence: (m) => ev.pres.push(m), onAck: (m) => acks.push(m) }); c.ev = ev; c.connect(); return c; };
  const K = await fetch(b2() + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'TEST tilt (throwaway)', gm: 'Harry' }) }).then(x => x.json());
  const A = K.area, H = Math.PI / 2, near = (a, b) => Math.abs(a - b) < 1e-3;
  const T = (e) => e?.quat ? 2 * Math.atan2(e.quat[2], e.quat[3]) : undefined, QZ = (t) => [0, 0, Math.sin(t / 2), Math.cos(t / 2)]; // (these rolls are all about the thing's own z: the angle back out of the quat)
  const g = mk(K.token); await waitFor(() => g.status === 'live'); g.subscribe(A); await waitFor(() => g.view(A));
  g.submit('seat.create', { id: 'seat_tiltpl001', kind: 'human', role: 'player', name: 'Brakka' });
  await waitFor(() => acks.some(a => a.token), 3000, 'tilt: player token');
  const p = mk(acks.find(a => a.token).token); await waitFor(() => p.status === 'live'); p.subscribe(A); await waitFor(() => p.view(A));
  const eg = (id) => g.view(A).entities[id], ep = (id) => p.view(A).entities[id];
  g.submit('object.place', { id: 'obj_barrel0001', cat: 'barrel', x: 12, z: 12, dims: [2, 3, 2] }, A);
  g.submit('object.place', { id: 'obj_plain00001', cat: 'crate', x: 20, z: 12, dims: [2, 2, 2] }, A);
  await waitFor(() => ep('obj_barrel0001') && ep('obj_plain00001'), 3000, 'tilt: things arrive');
  ok(!('quat' in eg('obj_barrel0001')), 'a new thing has no tilt field');
  // a tilt being dragged travels as presence
  g.presence(A, { cursor: [12, 12], drag: [{ id: 'obj_barrel0001', x: 12, z: 12, quat: QZ(0.5236) }] });
  await waitFor(() => p.ev.pres.some(m => [].concat(m.drag || []).some(d => d.id === 'obj_barrel0001' && d.quat && near(2 * Math.atan2(d.quat[2], d.quat[3]), 0.5236))), 3000, 'tilt: presence drag');
  ok(p.ev.pres.some(m => [].concat(m.drag || []).some(d => d.quat && near(2 * Math.atan2(d.quat[2], d.quat[3]), 0.5236))), 'a tilt in progress reaches the other seat as presence (drag.quat)');
  g.presence(A, { cursor: [12, 12], drag: null });
  g.submit('object.set', { id: 'obj_barrel0001', quat: QZ(H) }, A);
  await waitFor(() => near(T(ep('obj_barrel0001')) ?? 9, H), 3000, 'tilt: reaches the player');
  ok(near(T(ep('obj_barrel0001')), H) && near(T(eg('obj_barrel0001')), H), 'a tilt reaches the other seat');
  g.undo(A);
  await waitFor(() => !('quat' in ep('obj_barrel0001')), 3000, 'tilt: undo');
  ok(!('quat' in ep('obj_barrel0001')) && !('quat' in eg('obj_barrel0001')), 'one undo stands it up again, for both seats');
  g.submit('object.set', { id: 'obj_barrel0001', quat: QZ(H) }, A);
  g.submit('object.move', { id: 'obj_barrel0001', x: 14, z: 13, rot: 1.2 }, A);
  await waitFor(() => ep('obj_barrel0001')?.x === 14, 3000, 'tilt: move');
  ok(near(T(ep('obj_barrel0001')), H) && ep('obj_barrel0001').rot === 1.2, 'a move and a turn keep the tilt');
  // a room with a tilted, pinned thing: the re-roll keeps it tilted; a storey move carries it
  const R = 'room_tilt00001';
  g.submit('room.spawn', { id: R, type: 'common', x: 10, z: 10, w: 4, d: 4, seed: 5, engine: 'v2', engineVersion: 't', layout: { hash: 'h1', summary: '', objects: [{ id: 'obj_rtilt00001', cat: 'chair', x: 55, z: 55, dims: [2, 3, 2], quat: QZ(-H), pinned: true }, { id: 'obj_rloose0001', cat: 'stool', x: 60, z: 60, dims: [1, 2, 1], quat: QZ(0.7854) }] } }, A);
  await waitFor(() => ep('obj_rtilt00001') && ep('obj_rloose0001'), 3000, 'tilt: room');
  ok(near(T(eg('obj_rtilt00001')), -H) && near(T(ep('obj_rloose0001')), 0.7854), 'a room spawned from a layout (a pasted room) keeps its things\' tilts');
  g.submit('room.reroll', { id: R, seed: 6, layout: { hash: 'h2', summary: '', objects: [{ id: 'obj_rnew000001', cat: 'table', x: 58, z: 58, dims: [4, 3, 3] }] } }, A);
  await waitFor(() => ep('obj_rnew000001') && !ep('obj_rloose0001'), 3000, 'tilt: reroll');
  ok(near(T(ep('obj_rtilt00001')) ?? 9, -H) && !ep('obj_rloose0001') && !('quat' in ep('obj_rnew000001')), 'a re-roll keeps the pinned thing, still tilted');
  g.submit('room.move', { id: R, dx: 1, dz: 0, dy: 10 }, A);
  await waitFor(() => ep('obj_rtilt00001')?.y === 10, 3000, 'tilt: storey move');
  ok(near(T(ep('obj_rtilt00001')), -H) && ep('obj_rtilt00001').y === 10 && ep('obj_rtilt00001').x === 60, 'a room moved up a storey carries the thing, still tilted');
  // the GET API: state says it, do sets it
  g.submit('seat.create', { id: 'seat_tiltai001', kind: 'llm', name: 'Helper', scope: { areas: [A], classes: ['object'] } });
  await waitFor(() => acks.filter(a => a.token).length === 2, 3000, 'tilt: ai token');
  const ai = acks.filter(a => a.token)[1].token, cp2 = `${b2()}/c/${K.campaign}`;
  const st = await fetch(`${cp2}/a/${A}/state?seat=${ai}`).then(x => x.json());
  ok(near(T(st.objects.find(o => o.id === 'obj_barrel0001')) ?? 9, H) && !('quat' in st.objects.find(o => o.id === 'obj_plain00001')), 'GET state reports a tilted thing\'s tilt in degrees (tiltDeg), and nothing for an upright one');
  const d = await fetch(`${cp2}/a/${A}/do?cmd=object.set&id=obj_plain00001&tiltZ=0.2618&nonce=tz1&seat=${ai}`).then(x => x.json());
  await waitFor(() => near(T(eg('obj_plain00001')) ?? 9, 0.2618), 3000, 'tilt: GET do');
  ok(d.ok && near(T(eg('obj_plain00001')), 0.2618), 'GET do object.set&tiltZ= tilts a thing');
  g.submit('object.set', { id: 'obj_plain00001', quat: QZ(0) }, A);
  await waitFor(() => g.pendingCount() === 0 && !('quat' in eg('obj_plain00001')), 3000, 'tilt: upright');
  // saved and reloaded
  const want = stableStringify(r.campaigns.get(K.campaign).state), port = r.port;
  g.close?.(); p.close?.();
  await r.close();
  const snap = JSON.parse(fs.readFileSync(path.join(dir, K.campaign, 'snapshot.json'), 'utf8')).state.areas[A].entities;
  ok(near(T(snap.obj_barrel0001), H) && near(T(snap.obj_rtilt00001), -H) && !('quat' in snap.obj_plain00001) && !('quat' in snap.obj_rnew000001), 'the saved campaign holds the tilts, and no field on an upright thing');
  r = await startRelay({ port: 0, dataDir: dir, log: quiet });
  ok(stableStringify(r.campaigns.get(K.campaign).state) === want, 'the campaign reloads identical (tilts and all)');
  // A SAVE FROM 2026-10-11 (tiltZ): loaded, the thing carries the quat it means; a second seat gets it; undo works on it
  {
    await r.close();
    const f0 = path.join(dir, K.campaign, 'snapshot.json'), yest = JSON.parse(fs.readFileSync(f0, 'utf8')), ents = yest.state.areas[A].entities;
    for (const e of Object.values(ents)) if (e.quat) { e.tiltZ = 2 * Math.atan2(e.quat[2], e.quat[3]); delete e.quat; } // the file as yesterday's relay wrote it
    const tilted = Object.values(ents).filter(e => 'tiltZ' in e).length;
    fs.writeFileSync(f0, JSON.stringify(yest)); if (fs.existsSync(path.join(dir, K.campaign, 'journal.jsonl'))) fs.writeFileSync(path.join(dir, K.campaign, 'journal.jsonl'), '');
    const logs = []; r = await startRelay({ port: 0, dataDir: dir, log: (m) => logs.push(String(m)) });
    const now = r.campaigns.get(K.campaign).state.areas[A].entities;
    ok(tilted >= 2 && Object.values(now).every(e => !('tiltZ' in e)) && near(T(now.obj_barrel0001), H) && near(T(now.obj_rtilt00001), -H) && logs.some(m => /tilted thing\(s\) now carry an orientation/.test(m)), `yesterday's save (${tilted} things with tiltZ) loads with each as the quat it means, and the relay says so`, logs.filter(m => /tilt/.test(m))[0]);
    ok(!('tiltZ' in JSON.parse(fs.readFileSync(f0, 'utf8')).state.areas[A].entities.obj_barrel0001) && JSON.parse(fs.readFileSync(f0, 'utf8')).state.areas[A].entities.obj_barrel0001.quat, 'and a fresh snapshot is written at once (the old field is gone from disk)');
    const g2 = mk(K.token); await waitFor(() => g2.status === 'live'); g2.subscribe(A); await waitFor(() => g2.view(A));
    ok(near(T(g2.view(A).entities.obj_barrel0001), H), 'a seat joining afterwards is sent the quat');
    g2.submit('object.set', { id: 'obj_barrel0001', quat: [0.5, 0.5, -0.5, 0.5] }, A);
    await waitFor(() => g2.pendingCount() === 0 && g2.view(A).entities.obj_barrel0001.quat?.[0] === 0.5, 3000, 'tilt: general quat');
    g2.undo(A); await waitFor(() => near(T(g2.view(A).entities.obj_barrel0001) ?? 9, H) && g2.view(A).entities.obj_barrel0001.quat[0] === 0, 3000, 'tilt: undo to migrated');
    ok(near(T(g2.view(A).entities.obj_barrel0001), H) && g2.view(A).entities.obj_barrel0001.quat[0] === 0, 'a general orientation set on the migrated thing, then one undo: back to the migrated orientation');
    g2.submit('object.set', { id: 'obj_plain00001', tiltZ: 0.5 }, A); // an old client still sends the old argument
    await waitFor(() => g2.pendingCount() === 0 && near(T(g2.view(A).entities.obj_plain00001) ?? 9, 0.5), 3000, 'tilt: old arg');
    ok(near(T(r.campaigns.get(K.campaign).state.areas[A].entities.obj_plain00001), 0.5) && !('tiltZ' in r.campaigns.get(K.campaign).state.areas[A].entities.obj_plain00001), 'an old client\'s object.set tiltZ is stored as a quat');
    g2.submit('object.set', { id: 'obj_plain00001', quat: [0, 0, 0, 1] }, A); await waitFor(() => g2.pendingCount() === 0 && !g2.view(A).entities.obj_plain00001.quat, 3000);
    g2.close?.();
  }
  // an old save: the same file with every tilt field taken out loads, and stays without the field
  await r.close();
  const f = path.join(dir, K.campaign, 'snapshot.json'), old = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const e of Object.values(old.state.areas[A].entities)) delete e.quat;
  fs.writeFileSync(f, JSON.stringify(old)); for (const j of ['journal.jsonl']) if (fs.existsSync(path.join(dir, K.campaign, j))) fs.writeFileSync(path.join(dir, K.campaign, j), '');
  r = await startRelay({ port: 0, dataDir: dir, log: quiet });
  ok(stableStringify(r.campaigns.get(K.campaign).state.areas[A].entities) === stableStringify(old.state.areas[A].entities), 'a save with no tilt fields loads unchanged (nothing is added)');
  await r.close();
}

// ---- room pawn cascade: actual wire, atomic hidden arrival, undo and durable provenance ----
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-cascade-')); madeDirs.push(dir);
  let r = await startRelay({ port: 0, dataDir: dir, log: quiet });
  const K = await fetch(`http://127.0.0.1:${r.port}/campaigns`, { method: 'POST', body: JSON.stringify({ name: 'TEST room cascade (throwaway)', gm: 'GM' }) }).then(x => x.json());
  const A = K.area, R = 'room_hidepawn1', B = 'bld_hidepawn01';
  let rt = r.campaigns.get(K.campaign);
  const G = Object.values(rt.state.seats).find(s => s.role === 'gm').id, P = 'seat_hidepl001';
  const doCmd = (type, args, by = G, area = A) => { const out = rt.dispatch(by, { type, area, args }); if (!out.ok) throw new Error(`${type}: ${out.why}`); return out; };
  const player = doCmd('seat.create', { id: P, kind: 'human', role: 'player', name: 'Player', location: A });
  const frames = [], raw = new WebSocket(`ws://127.0.0.1:${r.port}/ws`);
  await new Promise(resolve => raw.on('open', resolve)); raw.on('message', d => frames.push(String(d)));
  raw.send(JSON.stringify({ t: 'hello', token: player.token }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')));
  raw.send(JSON.stringify({ t: 'sub', area: A })); await waitFor(() => frames.some(f => f.includes('"snap"')));
  const E = () => rt.state.areas[A].entities;
  doCmd('room.spawn', { id: R, building: B, type: 'common', x: 0, z: 0, w: 4, d: 4, seed: 1, layout: { hash: '', summary: '', objects: [] } });
  const token = (id, extras = {}) => doCmd('token.create', { id, name: id, x: 5, z: 5, ...extras });
  token('tok_hidecas01'); token('tok_hidepre01', { hidden: true }); token('tok_hidepl001', { owner: P }); token('tok_hidegm001', { owner: G });
  await sleep(70); frames.length = 0;
  doCmd('entity.flag', { ids: [R], hidden: true }); await sleep(70);
  ok(E().tok_hidecas01.hidden && E().tok_hidegm001.hidden && !E().tok_hidepl001.hidden, 'room hides NPC + GM-owned pawn while player pawn remains public');
  const hideWire = frames.join('');
  ok(hideWire.includes('"tok_hidecas01":null') && !hideWire.includes('tok_hidepre01') && !hideWire.includes('hiddenByRoom') && !hideWire.includes('_roomPlayerOwners'), 'wire only removes formerly visible pawns; no prehidden ids or provenance');
  doCmd('undo', {}); await sleep(50);
  ok(!E()[R].hidden && !E().tok_hidecas01.hidden && E().tok_hidepre01.hidden, 'one relay undo restores room and its cascade, preserves prehidden pawn');
  doCmd('entity.flag', { ids: [B], hidden: true }); await sleep(50); frames.length = 0;
  token('tok_hideborn1');
  token('tok_hideborn2', { owner: G });
  doCmd('batch', { ops: [{ type: 'token.create', args: { id: 'tok_hidebatch', name: 'Batch ambush', x: 7, z: 7, owner: G } }] });
  doCmd('pawn.define', { id: 'pawn_hidegm01', name: 'Bench ambush', owner: G });
  doCmd('pawn.bring', { id: 'tok_hidebench', def: 'pawn_hidegm01', x: 6, z: 6 });
  await sleep(70);
  ok(['tok_hideborn1', 'tok_hideborn2', 'tok_hidebatch', 'tok_hidebench'].every(id => E()[id].hidden && E()[id].hiddenByRoom === R), 'create, GM-owned create, batch and bench arrival all atomically hidden');
  ok(!/tok_hideborn|tok_hidebatch|tok_hidebench|Bench ambush|Batch ambush/.test(frames.join('')), 'raw player socket receives no id, name or data for hidden arrivals');
  token('tok_hidedrop1', { x: 40, z: 40 });
  doCmd('template.place', { id: 'tpl_hidedrop1', shape: 'circle', x: 40, z: 40, size: 5, attach: 'tok_hidedrop1' });
  await sleep(50); frames.length = 0;
  // Presence while dragging into the room must not flash the candidate drop to players.
  const from = { seat: G }, dest = { area: A, drag: [{ id: 'tok_hidedrop1', x: 5, z: 5 }] };
  rt.broadcastPresence(from, dest); await sleep(50);
  ok(!frames.join('').includes('tok_hidedrop1'), 'hidden-room drag destination withheld before drop');
  doCmd('token.move', { id: 'tok_hidedrop1', x: 5, z: 5 }); await sleep(50);
  ok(E().tok_hidedrop1.hidden && frames.join('').includes('"tok_hidedrop1":null') && !frames.join('').includes('"x":5'), 'drop takes pawn away without sending hidden destination');
  ok(E().tpl_hidedrop1.hidden && frames.join('').includes('"tpl_hidedrop1":null'), 'attached template disappears in same drop without leaking hidden pawn');
  doCmd('token.move', { id: 'tok_hideborn1', x: 40, z: 40 });
  ok(E().tok_hideborn1.hidden && !E().tok_hideborn1.hiddenByRoom, 'moving out keeps hidden and releases room provenance');
  const A2 = 'tbl_hideother1';
  doCmd('area.create', { id: A2, name: 'TEST source (throwaway)' });
  doCmd('token.create', { id: 'tok_hidexfer1', name: 'Transfer ambush', x: 40, z: 40 }, G, A2);
  frames.length = 0;
  doCmd('transfer', { id: 'tok_hidexfer1', from: A2, to: A, x: 5, z: 5 }); await sleep(50);
  ok(E().tok_hidexfer1.hidden && E().tok_hidexfer1.hiddenByRoom === R && !frames.join('').includes('tok_hidexfer1'), 'cross-area transfer into hidden room arrives without exposing pawn data');
  doCmd('undo', {});
  ok(!E().tok_hidexfer1 && !rt.state.areas[A2].entities.tok_hidexfer1.hidden, 'transfer undo restores source pawn visibility too');
  doCmd('redo', {});
  ok(E().tok_hidexfer1.hidden && E().tok_hidexfer1.hiddenByRoom === R, 'transfer redo restores hidden arrival');
  doCmd('token.create', { id: 'tok_hidetravel', name: 'Travel ambush', x: 40, z: 40 }, G, A2);
  doCmd('travel', { id: 'tok_hidetravel', from: A2, to: A });
  ok(E().tok_hidetravel.hidden && E().tok_hidetravel.hiddenByRoom === R, 'travel arrival beside player pawn inside hidden room is also hidden');
  doCmd('pawn.define', { id: 'pawn_hidebat1', name: 'Batch bench ambush', owner: G });
  doCmd('batch', { ops: [{ type: 'pawn.bring', args: { id: 'tok_hidebatbr', def: 'pawn_hidebat1', x: 6, z: 6 } }] });
  ok(E().tok_hidebatbr.hidden && E().tok_hidebatbr.owner === G && E().tok_hidebatbr.name === 'Batch bench ambush', 'batch pawn.bring resolves its definition and hidden-room arrival');
  const before = stableStringify(rt.state);
  raw.close(); await r.close();
  const disk = JSON.parse(fs.readFileSync(path.join(dir, K.campaign, 'snapshot.json'))).state;
  ok(disk.areas[A].entities.tok_hidecas01.hiddenByRoom === R && !disk.areas[A].entities.tok_hidepre01.hiddenByRoom, 'disk records cascade provenance but not independently hidden pawn');
  r = await startRelay({ port: 0, dataDir: dir, log: quiet }); rt = r.campaigns.get(K.campaign);
  ok(stableStringify(rt.state) === before, 'save/reload preserves all cascade state exactly');
  doCmd('entity.flag', { ids: [B], hidden: false });
  ok(!E().tok_hidecas01.hidden && !E().tok_hideborn2.hidden && !E().tok_hidebatch.hidden && !E().tok_hidebench.hidden && !E().tok_hidedrop1.hidden, 'reveal after reload shows original cascade and hidden-room arrivals');
  ok(E().tok_hidepre01.hidden && E().tok_hideborn1.hidden && !E().tok_hidepl001.hidden, 'prehidden and moved-out pawns stay hidden; player pawn remains public');
  doCmd('undo', {});
  ok(E()[R].hidden && E().tok_hidecas01.hidden && E().tok_hidecas01.hiddenByRoom === R, 'undo reveal restores hidden flags and provenance together');
  await r.close();
}

console.log(`relay: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
