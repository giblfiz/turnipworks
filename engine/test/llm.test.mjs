// The GET API for AI seats, 2026-10-20 update (experiments/2026-10-20-llm-api/): the short card and its help pages, the
// new reads (scene, room, catalogs), the relay's own dice, the conveniences a weak model needs, and the permission
// checks on every one of them: an AI seat never does more than its creator, and a player's AI never sees what the
// player may not (hidden rooms and what is in them, room labels, GM notes, the GM side's ghost in a hidden room).
//   node engine/test/llm.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra).slice(0, 400)); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-llm-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
const relay = await startRelay({ port: 0, dataDir, log: () => {} });
const base = `http://127.0.0.1:${relay.port}`;
const get = (p) => fetch(base + p).then(async r => ({ status: r.status, body: (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text() }));
const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'GET API', gm: 'Harry' }) }).then(r => r.json());
const cp = `/c/${C.campaign}`, A = C.area, RT = relay.campaigns.get(C.campaign);
const enc = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('&');
let n = 0;
const act = async (tok, cmd, args = {}, area = A) => (await get(`${area ? `${cp}/a/${area}` : cp}/do?cmd=${cmd}${Object.keys(args).length ? '&' + enc(args) : ''}&nonce=t${++n}&seat=${tok}`)).body;
const read = async (tok, p) => (await get(`${cp}/a/${A}/${p}${p.includes('?') ? '&' : '?'}seat=${tok}`));
const seat = async (tok, args) => (await get(`${cp}/do?cmd=seat.create&${enc(args)}&seat=${tok}`)).body;
const human = async () => act(C.token, 'chat.say', { text: '(the table talks)' }); // a person speaking resets the AI-to-AI loop count

const gmAi = await seat(C.token, { kind: 'llm', name: 'Helper', scope: { areas: '*', classes: '*' } });
const pl = await seat(C.token, { kind: 'human', role: 'player', name: 'Brakka' });
const PLAYER = ['token.move', 'pawn', 'open', 'chat', 'turn', 'template', 'undo', 'travel'];
const plAi = await seat(pl.token, { kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: PLAYER } });
const narrow = await seat(C.token, { kind: 'llm', name: 'Narrator', scope: { areas: '*', classes: ['chat'] } });
const G = gmAi.token, P = plAi.token, N = narrow.token;
ok(G && P && N && pl.token, 'seats: a GM assistant (every class), a player and her advisor, a chat-only narrator');

// ---- the scene: an inn's common room (open), a hidden vault beside it, a goblin, the player's pawn ----
const inn = await act(G, 'room.spawn', { type: 'common', x: 0, z: 0, w: 30, d: 25, seed: 4, name: 'The Gilded Goose' });
const vault = await act(G, 'room.spawn', { type: 'crypt-vault', x: 30, z: 0, w: 20, d: 20, seed: 7, name: 'Secret vault' });
ok(inn.ok && vault.ok, 'two rooms over GET, with labels', [inn, vault]);
const R = inn.id, V = vault.id;
ok((await act(G, 'entity.flag', { id: V, hidden: 'yes' })).ok, 'entity.flag takes id= and hidden=yes (a weak model\'s spelling)');
const mine = await act(G, 'token.create', { name: 'Brakka', x: 7.5, z: 7.5, owner: pl.id });
ok(mine.ok, 'the player\'s pawn');

// ---- 1. the card is short, exact and filtered; every help page it names answers ----
{
  const card = (await get(`${cp}/card?seat=${G}`)).body, pcard = (await get(`${cp}/card?seat=${P}`)).body, ncard = (await get(`${cp}/card?seat=${N}`)).body;
  const words = (s) => s.split(/\s+/).length;
  ok(card.length < 10500 && words(card) < 1000, `the GM assistant's card is small (${card.length} chars, ${words(card)} words; it was 22.5k / 2985 before 2026-10-20)`);
  for (const k of ['/scene?', '/room/ROOM_ID?', 'cmd=dice.roll&expr=d20&bonus=0&why=REASON', 'cmd=token.create&fig=FIGURE_ID&room=ROOM_ID', 'cmd=object.light&id=THING_ID&lit=true', 'cmd=entity.flag&ids=ID&hidden=true', 'cmd=room.set&id=ROOM_ID&name=NAME', 'ROOM LABELS', 'WORKED EXAMPLE', 'ETIQUETTE FOR AI SEATS', '/help/TOPIC?'])
    ok(card.includes(k), `the GM card has: ${k}`);
  ok(!/HIDDEN from players/.test(pcard) && !pcard.includes(V) && !pcard.includes('Secret vault'), 'the advisor\'s card names nothing hidden');
  for (const k of ['room.spawn', 'token.create', 'entity.flag', 'area.visibility', 'object.place', 'room.set', 'ROOM LABELS']) ok(!pcard.includes(k), `the advisor's card offers no GM command (${k})`);
  ok(pcard.includes('cmd=token.move') && pcard.includes('cmd=object.light') && pcard.includes('cmd=dice.roll') && /Only your own pawns/.test(pcard), 'the advisor\'s card has its own tasks');
  ok(ncard.includes('cmd=chat.say') && ncard.includes('cmd=dice.roll') && !ncard.includes('cmd=token.move') && !ncard.includes('cmd=object.light'), 'a chat-only seat\'s card offers only talk and dice');
  const idx = (await get(`${cp}/help?seat=${G}`)).body, topics = [...idx.matchAll(/\/help\/([\w-]+)\?/g)].map(m => m[1]);
  ok(topics.length >= 9, 'the help index lists the topics', topics);
  const SG = relay.tokens.short(C.campaign, RT.state.seats[gmAi.id]);
  for (const t of topics.filter(t => t !== 'commands')) { const h = await get(`${cp}/help/${t}?seat=${G}`); ok(h.status === 200 && h.body.length > 300 && h.body.includes(`seat=${SG}`), `help/${t} answers with the seat's own addresses`); }
  const ph = (await get(`${cp}/help/rooms?seat=${P}`)).body;
  ok(/cannot build/.test(ph) && !ph.includes('room.spawn') && !ph.includes('entity.flag'), 'help/rooms for the advisor: no building, no hiding');
  const pi = (await get(`${cp}/help?seat=${P}`)).body;
  ok(!/\/help\/rooms\?/.test(pi) && !/\/help\/things\?/.test(pi), 'the advisor\'s help index leaves out rooms and things');
  const pc = (await get(`${cp}/help/commands?seat=${P}`)).body;
  ok(!/room\.spawn|token\.create|entity\.flag|area\.visibility|campaign\.set/.test(pc) && /token\.move/.test(pc), 'help/commands lists only the advisor\'s own commands');
  ok(!/\bhp\b|hpMax|factionMissing|keepSession|throw/.test((await get(`${cp}/help/commands?seat=${G}`)).body), 'help/commands leaves out legacy and browser-only arguments');
}

// ---- 2. the scene and one room: what each side may see ----
{
  const gs = (await read(G, 'scene')).body, ps = (await read(P, 'scene')).body;
  const gInn = gs.rooms.find(r => r.id === R), gV = gs.rooms.find(r => r.id === V), pInn = ps.rooms.find(r => r.id === R);
  ok(gInn?.name === 'The Gilded Goose' && gInn.label === 'The Gilded Goose' && gV?.hidden && gV.name === 'Secret vault', 'the GM side\'s scene: labels, and the hidden vault marked hidden');
  ok(pInn && !('name' in pInn) && pInn.label === 'Common room' && !ps.rooms.some(r => r.id === V), 'the advisor\'s scene: no label (the type\'s name only), no hidden vault');
  const pStr = JSON.stringify(ps) + JSON.stringify((await read(P, 'state')).body);
  ok(!pStr.includes('Gilded') && !pStr.includes('Secret vault') && !pStr.includes(V), 'nothing of the label or the vault in the advisor\'s scene or state');
  const vaultThings = Object.values(RT.state.areas[A].entities).filter(e => e.room === V).map(e => e.id);
  ok(vaultThings.length && !vaultThings.some(id => pStr.includes(id)), 'none of the vault\'s things either');
  ok(gs.lights.length > 0 && gs.lights.every(l => typeof l.lit === 'boolean' && l.radius > 0 && l.kind), 'the scene lists lights with lit, kind, radius', gs.lights.slice(0, 2));
  ok(gs.rules && 'darkness' in gs.rules && 'fogOfWar' in gs.rules, 'the scene carries the area\'s rules');
  const pr = await read(P, `room/${V}`), px = await read(P, 'room/room_nosuch0001');
  ok(pr.status === 404 && px.status === 404 && pr.body.why.replace(V, '') === px.body.why.replace('room_nosuch0001', ''), 'the advisor asking for the hidden vault gets the same answer as a room that does not exist');
  const gr = (await read(G, `room/${R}`)).body;
  ok(gr.room.id === R && gr.things.length > 10 && gr.pawns.some(p => p.id === mine.id), 'one room: its things and the pawns in it');
  ok(gr.things.some(t => t.light) && gr.things.every(t => t.cat), 'a room\'s things say what they are and which are lights');
}

// ---- 3. dice: the relay rolls ----
{
  await human();
  const r = await act(G, 'dice.roll', { expr: 'd20', bonus: 3, why: 'Goblin stealth' });
  ok(r.ok && r.rolls.length === 1 && r.rolls[0] >= 1 && r.rolls[0] <= 20 && r.total === r.rolls[0] + 3 && r.expr === 'd20+3', 'dice.roll: the relay rolls and answers the numbers', r);
  const line = RT.state.areas[A].chat.find(c => c.id === r.id);
  ok(line?.roll.total === r.total && line.text === 'Goblin stealth', 'the roll is in the chat as any roll is');
  const cheat = await act(G, 'dice.roll', { expr: 'd20', rolls: [20], total: 20 });
  ok(cheat.ok && /relay rolls/.test(cheat.note || '') && RT.state.areas[A].chat.find(c => c.id === cheat.id).roll.total === cheat.total, 'an AI seat\'s own numbers are not used (said in "note")', cheat);
  await human();
  const G2 = (await seat(C.token, { kind: 'llm', name: 'Dice', scope: { areas: '*', classes: ['chat'] } })).token; // (an AI seat may roll 3 times a minute)
  const adv = await act(G2, 'dice.roll', { expr: 'd20adv' });
  const sp = await get(`${cp}/a/${A}/do?cmd=dice.roll&expr=2d6+1&nonce=spaced1&seat=${G2}`); // (a raw "+" in a URL is a space)
  ok(adv.ok && adv.rolls.length === 2 && adv.total === Math.max(...adv.rolls) && adv.expr === 'd20 adv' && sp.body.ok && sp.body.expr === '2d6+1' && sp.body.rolls.length === 2, 'd20adv rolls two and keeps the higher; "2d6 1" reads as 2d6+1', [adv, sp.body]);
  const again = await get(`${cp}/a/${A}/do?cmd=dice.roll&expr=2d6+1&nonce=spaced1&seat=${G2}`);
  ok(again.body.duplicate && again.body.total === sp.body.total && JSON.stringify(again.body.rolls) === JSON.stringify(sp.body.rolls), 'a retry with the same nonce answers the same numbers, rolled once');
  await human();
  ok(!(await act(G2, 'dice.roll', { expr: 'fireball' })).ok, 'not a roll: refused with how');
  // a person's seat over GET still may give the numbers rolled at the table; with none, the relay rolls
  const table = await act(C.token, 'dice.roll', { expr: 'd20', rolls: [17], total: 17 });
  ok(table.ok && RT.state.areas[A].chat.find(c => c.id === table.id).roll.total === 17, 'a person over GET may still send a table roll (back-compat)');
  const seen = new Set(); let inRange = true;
  for (let i = 0; i < 300; i++) { const x = await act(C.token, 'dice.roll', { expr: 'd20' }); seen.add(x.total); inRange &&= x.total >= 1 && x.total <= 20; }
  ok(inRange && seen.size === 20, `300 relay rolls of a d20: every face 1..20 came up (${seen.size} distinct)`);
  await human();
  ok((await act(P, 'dice.roll', { expr: 'd8', why: 'my axe' })).ok && !(await act(P, 'dice.roll', { expr: 'd8' }, 'area_nosuch0001')).ok, 'the advisor rolls where it may see, nowhere else');
}

// ---- 4. pawns: into a room, conditions, darkvision; the advisor only its own ----
{
  const gob = await act(G, 'token.create', { fig: 'foe-goblin-club', room: R });
  const E = () => RT.state.areas[A].entities, g = E()[gob.id];
  ok(gob.ok && g && g.x > 0 && g.x < 30 && g.z > 0 && g.z < 25 && g.fig === 'foe-goblin-club' && gob.at, 'token.create&room=: on a square inside the room, wearing the figure', gob);
  const two = await act(G, 'token.create', { fig: 'foe-goblin-club', room: R });
  ok(two.ok && (E()[two.id].x !== g.x || E()[two.id].z !== g.z) && (Math.abs(E()[two.id].x - E()[mine.id].x) >= 5 || Math.abs(E()[two.id].z - E()[mine.id].z) >= 5), 'a second one takes another free square (never on a pawn)');
  const inV = await act(G, 'token.create', { name: 'Lich', room: V });
  ok(inV.ok && E()[inV.id].hidden, 'a pawn put into the hidden vault is hidden with it');
  ok(!(await act(P, 'token.create', { fig: 'foe-goblin-club', room: R })).ok, 'the advisor cannot create pawns');
  const pv = await act(P, 'token.move', { id: mine.id, room: V }), px = await act(P, 'token.move', { id: mine.id, room: 'room_nosuch0001' });
  ok(!pv.ok && pv.why.replace(V, '') === px.why.replace('room_nosuch0001', ''), 'the advisor moving into the hidden vault: the answer for a room that does not exist', [pv, px]);
  ok((await act(P, 'token.move', { id: mine.id, room: R })).ok && !(await act(P, 'token.move', { id: gob.id, x: 2.5, z: 2.5 })).ok, 'the advisor moves its own pawn into a room, not the goblin');
  const c1 = await act(G, 'token.set', { id: gob.id, conditions: 'prone,poisoned', darkvision: 60 });
  const sc = (await read(G, 'scene')).body.pawns.find(p => p.id === gob.id);
  ok(c1.ok && JSON.stringify(sc.conditions) === '["prone","poisoned"]' && sc.darkvision === 60, 'conditions=prone,poisoned (no JSON) and darkvision show in the scene', sc);
  ok((await act(G, 'token.set', { id: gob.id, conditions: '' })).ok && !E()[gob.id].conditions.length, 'conditions= clears them');
  ok(!(await act(P, 'token.set', { id: gob.id, conditions: 'prone' })).ok && (await act(P, 'token.damage', { id: gob.id, damage: 5 })).ok, 'the advisor may not set the goblin\'s conditions, may change its damage (everyone\'s, as in the browser)');
  ok(!(await act(G, 'entity.flag', { ids: gob.id, hidden: 'maybe' })).ok, 'a switch that is not true or false is refused (it used to read as false: revealed)');
}

// ---- 5. things: lights, doors, the library, replace with similar, re-roll; rules ----
{
  const s0 = (await read(G, 'scene')).body, L = s0.lights.find(l => l.room === R), VL = Object.values(RT.state.areas[A].entities).find(e => e.room === V && /candle|torch|lantern|brazier|lamp/.test(e.cat || ''));
  ok(L, 'a light in the inn');
  ok((await act(G, 'object.light', { id: L.id, lit: !L.lit })).ok && (await read(G, 'scene')).body.lights.find(l => l.id === L.id).lit === !L.lit, 'object.light: the scene shows it');
  ok((await act(P, 'object.light', { id: L.id, lit: L.lit })).ok, 'the advisor may light and put out (class open)');
  if (VL) ok(!(await act(P, 'object.light', { id: VL.id, lit: false })).ok, 'not a light in the hidden vault');
  ok((await act(G, 'area.set', { area: A, touch: 'none' }, null)).ok && !(await act(P, 'object.light', { id: L.id, lit: !L.lit })).ok, 'touch=none (area.set by rule name): the advisor may not light things');
  ok((await act(G, 'area.set', { area: A, touch: 'default', darkness: 'true' }, null)).ok && (await read(G, 'scene')).body.rules.darkness === true, 'area.set&darkness=true: the scene\'s rules say dark');
  ok(!(await act(P, 'area.set', { area: A, darkness: 'false' }, null)).ok, 'the advisor cannot change area rules');
  const ch = await act(G, 'object.place', { cat: 'chest-plain', x: 22.5, z: 20 });
  const chest = RT.state.areas[A].entities[ch.id];
  ok(ch.ok && chest.url && chest.sku && chest.room === R && (await read(G, 'scene')).body.doors.some(d => d.id === ch.id && d.open === false), 'object.place&cat=: the library\'s mesh and size, in the room it stands in, listed with the doors', chest);
  ok((await act(P, 'object.open', { id: ch.id, open: true })).ok && RT.state.areas[A].entities[ch.id].open, 'the advisor opens it');
  const bad = await act(G, 'object.place', { cat: 'candel', x: 5, z: 5 });
  ok(!bad.ok && /did you mean|things\?q=/.test(bad.why), 'an unknown piece: refused with the nearest and how to search', bad);
  const find = (await get(`${cp}/things?q=candle&seat=${G}`)).body;
  ok(find.things.length && find.things.every(t => t.id.includes('candle') || /candle/.test(t.desc || '')) && find.things.some(t => t.light), 'things?q=candle finds candles, lights marked');
  const sku0 = chest.sku, rep = await act(G, 'object.replace', { id: ch.id });
  ok(rep.ok && RT.state.areas[A].entities[ch.id].sku !== sku0, 'object.replace with no cat: another look', rep);
  ok(!(await act(G, 'object.replace', { id: 'obj_nosuch00001' })).ok, 'object.replace: no such thing');
  const h0 = RT.state.areas[A].entities[R].layout.hash, rr = await act(G, 'room.reroll', { id: R, seed: 99 });
  ok(rr.ok && RT.state.areas[A].entities[R].layout.hash !== h0, 'room.reroll over GET: the relay solves it', rr);
  const ty = await act(G, 'room.reroll', { id: R, type: 'kitchen' });
  ok(ty.ok && RT.state.areas[A].entities[R].recipe.type === 'kitchen', 'room.reroll&type=: a new type');
  ok((await act(G, 'room.reroll', { id: R, type: 'common' })).ok, '(back to a common room)');
  const fac = await act(G, 'faction.set', { id: V, flavor: 'Sun' });
  ok(fac.ok && (await read(G, 'scene')).body.rooms.find(r => r.id === V).faction === 'sun', 'faction.set&flavor=Sun (a name): the scene shows the faction', fac);
  ok((await get(`${cp}/factions?seat=${G}`)).body.factions.some(f => f.id === 'sun') && Object.keys((await get(`${cp}/rooms?seat=${G}`)).body.groups).length >= 8, 'the factions and the room types by kind');
}

// ---- 6. labels, GM notes and the GM side's ghost never reach the player side ----
{
  const pls = new ClientSync({ token: pl.token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onPresence: (m) => ghosts.push(m) });
  const ghosts = []; pls.connect();
  for (let i = 0; i < 100 && pls.status !== 'live'; i++) await sleep(20); pls.subscribe(A);
  for (let i = 0; i < 100 && !pls.view(A); i++) await sleep(20);
  ok(pls.view(A) && !JSON.stringify(pls.view(A)).includes('Secret vault'), 'the player\'s own client: no vault label');
  await act(G, 'room.set', { id: R, name: 'The Drowned Rat' });
  await act(G, 'token.set', { id: mine.id, gmNotes: 'She is the heir' });
  const pc = await get(`${cp}/a/${A}/changes?after=0&wait=0&seat=${P}`);
  const pall = JSON.stringify(pc.body) + JSON.stringify((await read(P, 'scene')).body) + JSON.stringify((await read(P, `room/${R}`)).body) + JSON.stringify((await read(P, 'state')).body);
  ok(!pall.includes('Drowned Rat') && !pall.includes('heir') && !pall.includes('Secret vault'), 'a rename and a GM note: not in the advisor\'s changes, scene, room or state');
  ok((await read(G, `room/${R}`)).body.room.name === 'The Drowned Rat', 'the GM side sees the new label');
  // the GM assistant reads the hidden vault: its ghost goes there for the GM side only
  ghosts.length = 0;
  await read(G, `room/${V}`);
  await sleep(700);
  const vr = RT.state.areas[A].entities[V].recipe, inVault = (g) => g.cursor && g.cursor[0] >= vr.x * 5 && g.cursor[0] <= (vr.x + vr.w) * 5 && g.cursor[1] >= vr.z * 5 && g.cursor[1] <= (vr.z + vr.d) * 5;
  ok(!ghosts.some(g => g.seat === gmAi.id && inVault(g)), 'the GM assistant reading the hidden vault: its ghost is not shown to the player there', ghosts.filter(g => g.seat === gmAi.id).slice(-2));
  ghosts.length = 0; await read(G, `room/${R}`); await sleep(700); // (the positive control: reading the open inn, the ghost is shown)
  const ir = RT.state.areas[A].entities[R].recipe;
  ok(ghosts.some(g => g.seat === gmAi.id && g.cursor && g.cursor[0] >= ir.x * 5 && g.cursor[0] <= (ir.x + ir.w) * 5), '...and reading the open inn, it is', ghosts.filter(g => g.seat === gmAi.id).slice(-1));
  const pp = (await get(`${cp}/presence?seat=${P}`)).body;
  ok(!pp.seats.some(s => s.seat === gmAi.id && s.cursor && s.cursor[0] >= vr.x * 5 && s.cursor[0] <= (vr.x + vr.w) * 5), 'nor in the advisor\'s presence read');
  pls.close();
}

// ---- 7. the short token: the card's addresses carry it; it works only on the GET API, only for its own campaign ----
{
  const card = (await get(`${cp}/card?seat=${G}`)).body, m = card.match(/seat=(seat_[^&\s)]+)/), S = m && m[1];
  ok(S && S.length < 50 && S.startsWith(gmAi.id + '.') && !card.includes(G), `the card's addresses carry the short token (${S?.length} characters, not ${G.length})`);
  ok((await read(S, 'scene')).status === 200 && (await act(S, 'token.mark', { id: mine.id, mark: 'star' })).ok, 'the short token reads and acts');
  const bad = S.slice(0, -1) + (S.endsWith('A') ? 'B' : 'A');
  ok((await read(bad, 'scene')).status === 401, 'one character off: refused');
  const C2 = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'Other', gm: 'Someone' }) }).then(r => r.json());
  ok((await get(`/c/${C2.campaign}/a/${C2.area}/scene?seat=${S}`)).status === 401 && (await get(`/c/${C2.campaign}/card?seat=${S}`)).status === 401, 'on another campaign\'s address: refused');
  const GS = relay.tokens.short(C.campaign, RT.state.seats[RT.state.seats[gmAi.id].creator]);
  ok((await get(`${cp}/snapshots?seat=${GS}`)).status === 401 && (await get(`${cp}/card?seat=${GS}`)).status === 200, 'the short form is the GET API\'s only (a GM\'s short token opens no snapshots)');
}

// ---- 8. the narrow seat: never more than its scope, nor its creator ----
{
  ok(!(await act(N, 'token.move', { id: mine.id, x: 2.5, z: 2.5 })).ok && !(await act(N, 'object.place', { cat: 'chest-plain', x: 2, z: 2 })).ok && !(await act(N, 'room.reroll', { id: R })).ok, 'the chat-only narrator: no moves, no things, no re-rolls (the conveniences check as the command does)');
  await human();
  ok((await act(N, 'dice.roll', { expr: 'd6' })).ok, '...but it rolls');
  // the player revoked: her advisor goes with her, on every new route
  await get(`${cp}/do?cmd=seat.revoke&who=${pl.id}&nonce=rv1&seat=${C.token}`);
  const dead = await Promise.all(['scene', `room/${R}`].map(p => read(P, p)));
  ok(dead.every(r => r.status >= 400), 'a revoked player\'s advisor reads nothing', dead.map(r => r.status));
}

await relay.close();
console.log(`llm: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
