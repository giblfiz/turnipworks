// The GET API for AI seats, 2026-10-20 update (experiments/2026-10-20-llm-api/): the short card and its help pages, the
// new reads (scene, room, catalogs), the relay's own dice, the conveniences a weak model needs, and the permission
// checks on every one of them: an AI seat never does more than its creator, and a player's AI never sees what the
// player may not (hidden rooms and what is in them, room labels, GM notes, the GM side's ghost in a hidden room).
// Section 7b: cursor.hide and cursor.show (2026-11-01; docs/NETCODE.md "Hiding an AI seat's cursor").
//   node engine/test/llm.test.mjs
import { parseGame as parseDiceGame } from '../core/gamedice.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { PresenceView } from '../core/presence.js';
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
  // (2026-10-29: +30 words for the one shared-builds line Harry's "share a selection" asked for; main stood at 998)
  ok(card.length < 11100 && words(card) < 1050, `the GM assistant's card is small (${card.length} chars, ${words(card)} words; it was 22.5k / 2985 before 2026-10-20)`);
  for (const k of ['/scene?', '/room/ROOM_ID?', 'cmd=dice.roll&expr=d20&bonus=0&why=REASON', 'cmd=token.create&fig=FIGURE_ID&room=ROOM_ID', 'cmd=object.light&id=THING_ID&lit=true', 'cmd=entity.flag&ids=ID&hidden=true', 'cmd=room.set&id=ROOM_ID&name=NAME', 'ROOM AND BUILDING LABELS', 'WORKED EXAMPLE', 'ETIQUETTE FOR AI SEATS', '/help/TOPIC?'])
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

// ---- 3b. game dice over GET (2026-10-29, core/gamedice.js): the same words, the relay rolls, the answer and the line carry "tally" ----
{
  await human();
  const G3 = (await seat(C.token, { kind: 'llm', name: 'Game dice', scope: { areas: '*', classes: ['chat'] } })).token;
  const v = await act(G3, 'dice.roll', { expr: 'v5 7 hunger 2 diff 3', why: 'Blood surge' });
  ok(v.ok && v.expr === 'v5 7 hunger 2 diff 3' && v.rolls.length === 7 && v.rolls.every(x => x >= 1 && x <= 10) && /^Vampire pool 7 \(2 hunger\) vs 3: \d+ success/.test(v.tally || ''), 'v5 over GET: 7 d10s rolled by the relay, the tally says the successes', v);
  const sp = await get(`${cp}/a/${A}/do?cmd=dice.roll&expr=duality+2&nonce=dual1&seat=${G3}`); // ("+" is a space in a URL)
  ok(sp.body.ok && sp.body.expr === 'duality+2' && sp.body.rolls.length === 2 && sp.body.total === sp.body.rolls[0] + sp.body.rolls[1] + 2 && /with (Hope|Fear)|critical/.test(sp.body.tally), '"duality 2" reads as duality+2', sp.body);
  const again = await get(`${cp}/a/${A}/do?cmd=dice.roll&expr=duality+2&nonce=dual1&seat=${G3}`);
  ok(again.body.duplicate && again.body.tally === sp.body.tally, 'a retry answers the same tally');
  await human();
  const l = await act(G3, 'dice.roll', { expr: 'l5r 3 ring 2 skill' });
  ok(l.ok && l.rolls.length === 5 && /^Rings 3 ring \+ 2 skill: ring \[/.test(l.tally) && /keep up to 3 dice/.test(l.tally), 'l5r over GET: every face listed', l);
  const G4 = (await seat(C.token, { kind: 'llm', name: 'Game dice 2', scope: { areas: '*', classes: ['chat'] } })).token; // (3 rolls a minute per AI seat)
  const f = await act(G4, 'dice.roll', { expr: '4df', bonus: 2 });
  ok(f.ok && f.expr === '4dF+2' && f.rolls.length === 4, 'bonus= is the Fudge modifier', f);
  await human();
  const cb = await act(G4, 'dice.roll', { expr: 'coc 65', bonus: 1 });
  ok(!cb.ok && /bonus 1/.test(cb.why), 'bonus= on a CoC roll is refused with how to write a bonus die', cb);
  const c = await act(C.token, 'dice.roll', { expr: 'coc 65 bonus 1' });
  ok(c.ok && c.rolls.length === 3 && c.total >= 1 && c.total <= 100 && /^Percentile vs 65 \(1 bonus die\): \d+/.test(c.tally), 'coc over GET', c);
  const s = await act(C.token, 'dice.roll', { expr: 'sr 12 threshold 2' });
  ok(s.ok && s.rolls.length === 12 && s.total === s.rolls.filter(x => x >= 5).length, 'sr over GET: total = hits', s);
  const ex = await act(C.token, 'dice.roll', { expr: 'exalted 15 d9' }); // (2026-10-30)
  ok(ex.ok && ex.expr === 'ex 15 double 9' && ex.rolls.length === 15 && ex.total === ex.rolls.reduce((n, x) => n + (x >= 9 ? 2 : x >= 7 ? 1 : 0), 0) && /^Exalted pool 15 \(double 9s\): \d+ success/.test(ex.tally), 'ex over GET: 15 d10s, 7+ one success, 9-10 two', ex);
  const tbl = await act(C.token, 'dice.roll', { expr: 'sr 4', rolls: [1, 1, 1, 2], total: 0 });
  ok(tbl.ok && RT.state.areas[A].chat.find(x => x.id === tbl.id).roll.expr === 'sr 4', 'a person may send a table roll of game dice');
  const sc = (await read(G, 'scene')).body;
  const tl = sc.chat.find(x => x.roll?.expr === 'sr 4');
  ok(tl?.roll.tally === 'Shadowrun pool 4: 0 hits, CRITICAL GLITCH', 'the scene\'s chat lines carry the tally', tl);
  ok(sc.chat.filter(x => x.roll && !parseDiceGame(x.roll.expr)).every(x => !x.roll.tally), 'plain rolls carry no tally');
  const help = (await get(`${cp}/help/dice?seat=${G}`)).body;
  ok(['coc [SKILL]', 'v5 POOL', 'sr POOL', 'duality [MOD]', '4df [MOD]', 'l5r R ring S skill', 'ex POOL', 'BOTCH', 'messy critical', 'CRITICAL GLITCH', 'with Hope'].every(k => help.includes(k)), 'help/dice explains each game');
}

// ---- 3c. a helper's seat is named "<username>'s <botname>" (2026-11-02; core/agentname.js), on every path, and no seat already made is renamed ----
{
  ok(gmAi.ok && RT.state.seats[gmAi.id].name === "Harry's Helper" && RT.state.seats[plAi.id].name === "Brakka's Advisor", 'GET seat.create names the seat <username>\'s <botname>');
  const named = async (name, tok = C.token) => { const r = await seat(tok, { kind: 'llm', ...(name != null && { name }), scope: { areas: '*', classes: ['chat'] } }); return RT.state.seats[r.id]?.name; };
  ok(await named(null) === "Harry's assistant" && await named('') === "Harry's assistant" && await named('   ') === "Harry's assistant", 'no name at all, or a blank one: assistant');
  ok(await named('Luna') === "Harry's Luna", 'a botname');
  ok(await named("Harry's Luna") === "Harry's Luna" && await named("harry’s Luna") === "Harry's Luna" && await named("HARRY'S luna") === "Harry's luna", 'a name already starting with the username is not doubled (any case, a curly apostrophe)');
  ok(await named("Mira's Luna") === "Harry's Mira's Luna", 'someone else\'s name is only a botname');
  const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`); await new Promise(r => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', token: C.token })); await sleep(150); ws.send(JSON.stringify({ t: 'cmd', cid: 'seatws1', type: 'seat.create', args: { id: 'seat_wsnamed01', kind: 'llm', name: 'Bot', scope: { areas: '*', classes: ['chat'] } } })); await sleep(200); ws.close();
  ok(RT.state.seats.seat_wsnamed01?.name === "Harry's Bot", 'the browser\'s path (a socket command) too');
  // a long username: the whole name is at most 40, the botname stays
  const { helperSeatName: hn, botOf } = await import('../core/agentname.js');
  const L = 'Bartholomew-Maximilian-Featherstonehaugh-III';
  ok(hn(L, 'assistant').length <= 40 && hn(L, 'assistant').endsWith("…'s assistant") && hn(L, 'assistant').startsWith('Bartholomew'), 'a long username gives way with an ellipsis, the botname stays whole', hn(L, 'assistant'));
  ok(hn(L, hn(L, 'Luna')) === hn(L, 'Luna'), 'shortened, it is still not doubled');
  ok(hn(L, 'x'.repeat(40)).length <= 40 && hn(L, 'x'.repeat(40)).split("'s ")[0].length >= 8, 'a long botname too: at least 8 characters of the username remain', hn(L, 'x'.repeat(40)));
  ok(hn('Harry', 'y'.repeat(40)).length <= 40 && hn('A'.repeat(40), '').length <= 40, 'never past 40');
  ok(botOf('Harry', "Harry's Luna") === 'Luna' && botOf('Harry', 'Luna') === null, 'botOf reads the botname back');
  // no seat already made is renamed: a journaled seat.create replays as it was
  RT.applyRecord({ r: RT.r + 1, at: Date.now(), by: C.seat, camp: { type: 'seat.create', args: { id: 'seat_oldname01', kind: 'llm', name: 'Old Luna', scope: { areas: '*', classes: ['chat'] } } }, fx: [] });
  ok(RT.state.seats.seat_oldname01?.name === 'Old Luna', 'a seat already in the journal keeps its name on replay');
  const oldTok = relay.tokens.mint(C.campaign, RT.state.seats.seat_oldname01), oldCard = (await get(`${cp}/card?seat=${oldTok}`)).body, newCard = (await get(`${cp}/card?seat=${G}`)).body;
  ok(oldCard.includes("rules card for Old Luna (Harry's GM assistant)") && oldCard.includes('"Harry\'s GM assistant"'), 'and its card still says whose it is, and answers to that');
  ok(newCard.split('\n')[0].endsWith("rules card for Harry's Helper") && newCard.includes('"@Harry\'s Helper", "Harry\'s Helper", "Helper"'), 'a new seat\'s card needs no "(Harry\'s GM assistant)", and it answers to its botname');
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

// ---- 4b. which way a stair goes (2026-11-02; Harry: "I just watched luna get confused about if stairs go up or down"): a stair up and a flipped stair down from one room, read from each end ----
{
  const hall = await act(G, 'room.spawn', { type: 'hallway', x: 800, z: 0, w: 40, d: 40, seed: 31, name: 'Long Hall', stair: '0' });
  const above = await act(G, 'room.spawn', { type: 'guest', x: 800, z: 0, w: 40, d: 40, seed: 32, y: 10, name: 'Attic', stair: '0' });
  const below = await act(G, 'room.spawn', { type: 'cellar', x: 800, z: 0, w: 40, d: 40, seed: 33, y: -10, name: 'Root cellar', stair: '0' });
  ok(hall.ok && above.ok && below.ok && !above.stair && !below.stair, 'three storeys, no stair yet', [hall, above, below]);
  const place = (args) => act(G, 'object.place', { place: 'stair', rise: 10, rot: 0, dims: '[4.4,10,10]', ...args });
  const up = await place({ x: 807.5, z: 15, y: 0, room: hall.id });
  const dn = await place({ x: 827.5, z: 15, y: 0, room: hall.id });
  const flip = await act(G, 'stair.flip', { id: dn.id, y: -10, down: 'true' });
  ok(up.ok && dn.ok && flip.ok, 'a stair up, and one switched to lead down', [up, dn, flip]);
  ok(/bottom Long Hall \(lv 1\), top Attic \(lv 2\)/.test(up.stairSays) && up.stairWorks === true, 'placing a stair says which way it leads, in the answer', up);
  ok(/bottom Root cellar \(lv -1\), top Long Hall \(lv 1\)/.test(flip.stairSays) && flip.stairWorks === true, 'switching one too', flip);
  const st = (await read(G, 'state')).body.stairs, sc = (await read(G, 'scene')).body.stairs, si = (id) => st.find(x => x.id === id), ss = (id) => sc.find(x => x.id === id);
  // what from and to really hold: bottom and top, for the flipped stair as well, and never a journey
  ok(si(up.id).from === hall.id && si(up.id).to === above.id && si(up.id).fromLevel === 'lv 1' && si(up.id).toLevel === 'lv 2', 'state, the stair up: from the bottom room, to the top room', { ...si(up.id), railing: 0, cells: 0, hall: hall.id, above: above.id });
  ok(si(dn.id).from === below.id && si(dn.id).to === hall.id && si(dn.id).fromLevel === 'lv -1' && si(dn.id).toLevel === 'lv 1' && si(dn.id).down === true, 'state, the flipped stair: `from` is still the BOTTOM room, the cellar, not the room it leads down from');
  for (const [what, s] of [['state', si(dn.id)], ['scene', ss(dn.id)]]) ok(s.ends.bottom.room === below.id && s.ends.bottom.label === 'Root cellar' && s.ends.bottom.level === 'lv -1' && s.ends.top.room === hall.id && s.ends.top.label === 'Long Hall' && s.ends.top.level === 'lv 1' && /Up from the bottom, down from the top/.test(s.says), `${what}: both ends, by room and level, in words`, s);
  const roomRead = async (id) => (await read(G, `room/${id}`)).body, way = (r, id) => r.stairs.find(x => x.id === id);
  const fromHall = await roomRead(hall.id), fromAttic = await roomRead(above.id), fromCellar = await roomRead(below.id);
  ok(way(fromHall, up.id).goes === 'up' && way(fromHall, up.id).leadsTo.room === above.id && way(fromHall, up.id).leadsTo.level === 'lv 2', 'from the hall the stair up goes up, to the attic, lv 2', way(fromHall, up.id));
  ok(way(fromHall, dn.id).goes === 'down' && way(fromHall, dn.id).leadsTo.room === below.id && way(fromHall, dn.id).leadsTo.level === 'lv -1', 'from the hall the flipped stair goes down, to the cellar, lv -1', way(fromHall, dn.id));
  ok(way(fromAttic, up.id).goes === 'down' && way(fromAttic, up.id).leadsTo.room === hall.id, 'read from its other end, the stair up goes down');
  ok(way(fromCellar, dn.id).goes === 'up' && way(fromCellar, dn.id).leadsTo.room === hall.id, 'and the flipped stair goes up');
  ok(fromHall.things.find(x => x.id === up.id)?.goes === 'up' && fromCellar.things.find(x => x.id === dn.id)?.goes === 'up', 'a room\'s things carry the word too');
  const lk = (await read(G, `look?x=807.5&z=15&r=3&y=0`)).body.near.find(x => x.id === up.id), lk2 = (await read(G, `look?x=827.5&z=15&r=3&y=-10`)).body.near.find(x => x.id === dn.id);
  ok(lk?.goes === 'up' && lk.leadsTo.room === above.id && lk2?.goes === 'up', 'look with y= reads it from that height', [lk, lk2]);
  const pawn = await act(G, 'token.create', { name: 'Walker', x: 807.5, z: 5 });
  const top = await act(G, 'token.move', { id: pawn.id, stair: up.id, to: 'top' }), bot = await act(G, 'token.move', { id: pawn.id, stair: up.id, to: 'bottom' });
  ok(top.at === undefined && RT.state.areas[A].entities[pawn.id] && bot.ok, 'to=top and to=bottom', [top.ok, bot.ok]);
  await act(G, 'token.move', { id: pawn.id, stair: dn.id, to: 'top' });
  ok(RT.state.areas[A].entities[pawn.id].y === 0, 'on the flipped stair to=top is still its upper end (the hall), not "the way it leads"', RT.state.areas[A].entities[pawn.id].y);
  await act(G, 'token.move', { id: pawn.id, stair: dn.id, to: 'bottom' });
  ok(RT.state.areas[A].entities[pawn.id].y === -10, 'and to=bottom its lower end (the cellar)');
  // a stair put under a room, naming that room: its bottom is where its foot is
  const under = await place({ x: 817.5, z: 30, y: -10, room: hall.id });
  ok(/bottom Root cellar \(lv -1\), top Long Hall \(lv 1\)/.test(under.stairSays), 'a stair placed under a room says plainly where it leads, even with room= the upper room', under);
  await act(G, 'object.delete', { id: under.id });
  // a ladder says so; a stair with a problem says so, in the game's words
  const lad = await act(G, 'object.place', { cat: 'ladder-wood', x: 845.5, z: 5, y: 0 });
  const noted = await act(G, 'object.place', { place: 'stair', rise: 10, rot: 0, dims: '[4.4,10,10]', x: 900, z: 500, y: 40 });
  const scene2 = (await read(G, 'scene')).body;
  ok(lad.ok && /^Ladder: /.test(lad.stairSays) && scene2.stairs.find(x => x.id === lad.id).kind === 'ladder', 'a ladder says so', lad);
  const bad = scene2.stairs.find(x => x.id === noted.id);
  ok(noted.stairWorks === false && bad?.works === false && bad.note === 'Nothing below' && /nothing is built below|stands on no floor/.test(bad.why) && bad.says.includes('It does not work: Nothing below.') && bad.ends.bottom.level === null && bad.ends.top.level === null, 'a stair that cannot work: works false, the note on the table word for word, and no invented level', bad);
  // hidden floors stay hidden: a stair that reaches a floor this seat may not see names neither room nor level, and reads as one with nothing built
  const check = async (label) => {
    const scene = (await read(P, 'scene')).body, state = (await read(P, 'state')).body, room = (await read(P, `room/${hall.id}`)).body, text = JSON.stringify([scene, state, room, (await read(P, 'look?x=807.5&z=15&r=30')).body, (await read(P, 'look?x=807.5&z=15&r=30&y=0')).body]);
    return { scene, state, room, text, label };
  };
  const shown = await check();
  ok(!shown.text.includes('Long Hall') && !shown.text.includes('Attic') && !shown.text.includes('Root cellar') && shown.scene.stairs.find(x => x.id === up.id)?.ends.top.label === 'Guest room', "a player's agent: no GM label anywhere, each room by its type", shown.scene.stairs.find(x => x.id === up.id)?.ends);
  ok((await act(G, 'entity.flag', { ids: above.id, hidden: true })).ok && (await act(G, 'entity.flag', { ids: below.id, hidden: true })).ok, 'the GM hides the attic and the cellar');
  const hid = await check(), vis = hid.scene.stairs.filter(x => x.from === hall.id || x.to === hall.id);
  ok(!hid.text.includes(above.id) && !hid.text.includes(below.id) && !hid.text.includes('lv 2') && !hid.text.includes('lv -1') && !hid.text.includes('"storey":-1'), "hidden floors: neither the room nor the level reaches a player's agent, in any stair field", ['lv 2', 'lv -1', '"storey":-1', above.id, below.id].filter(k => hid.text.includes(k)).concat(hid.text.match(/.{120}lv -1.{60}|.{120}lv 2.{60}/)?.[0] || ''));
  // a stair the GM left visible, standing in the open room and reaching the hidden attic: it may be seen, what it reaches may not
  await act(G, 'entity.flag', { ids: up.id, hidden: false });
  const hung = (await read(P, 'scene')).body.stairs.find(x => x.id === up.id), hungRoom = (await read(P, `room/${hall.id}`)).body.stairs.find(x => x.id === up.id);
  ok(hung && hung.to === null && hung.ends.top.room === null && hung.ends.top.level === null && hung.ends.top.label === undefined && hung.works === false && hung.note === 'No floor above yet', "a visible stair up to a hidden floor: no room, no level, and the same words as a stair to nothing", hung);
  ok(hungRoom.goes === 'up' && hungRoom.leadsTo.room === null && hungRoom.leadsTo.level === null && !JSON.stringify(hungRoom).includes(above.id), 'read from the room too');
  const never = await act(G, 'room.spawn', { type: 'hallway', x: 1000, z: 0, w: 40, d: 40, seed: 35, stair: '0' }), bare = await place({ x: 1007.5, z: 15, y: 0, room: never.id });
  const [a0, b0] = [(await read(P, 'scene')).body.stairs.find(x => x.id === up.id), (await read(P, 'scene')).body.stairs.find(x => x.id === bare.id)], strip = ({ id, from, says, ends, ...r }) => ({ ...r, top: ends.top });
  ok(JSON.stringify(strip(a0)) === JSON.stringify(strip(b0)) && a0.says === b0.says, 'to the letter: a stair up to a hidden floor reads as a stair up to nothing', [a0, b0]);
  for (const id of [above.id, below.id]) await act(G, 'entity.flag', { ids: id, hidden: false });
  // a stair below ground: up onto open ground
  const pit = await act(G, 'room.spawn', { type: 'cellar', x: 800, z: 200, w: 30, d: 30, seed: 34, y: -10, stair: '0' });
  const out = await place({ x: 812.5, z: 215, y: -10, room: pit.id });
  const si2 = (await read(G, 'state')).body.stairs.find(x => x.id === out.id);
  ok(si2.from === pit.id && si2.to === null && si2.fromLevel === 'lv -1' && si2.toLevel === 'lv 1' && si2.ends.top.label === 'open ground' && si2.ends.top.level === 'lv 1' && si2.works, 'a stair going below ground: its top is the open ground, lv 1', si2);
  for (const id of [pawn.id]) await act(G, 'token.delete', { id });
  for (const id of [hall.id, above.id, below.id, pit.id, never.id]) await act(G, 'room.delete', { id });
  for (const id of [up.id, dn.id, lad.id, noted.id, out.id, bare.id]) await act(G, 'object.delete', { id });
  const card = (await get(`${cp}/card?seat=${G}`)).body, help = (await get(`${cp}/help/height?seat=${G}`)).body;
  ok(/to=top its upper end, to=bottom its lower/.test(card) && /never a direction/.test(card), 'the card leaves no doubt which end is which');
  ok(/to=top: to its upper end; to=bottom: to its lower end/.test(help) && /always the room at the BOTTOM/.test(help), 'nor does help/height');
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

// ---- 5b. a room is not a thing (2026-11-02; a helper: "placing a 'cave' object only makes a marker rather than a cave room"): the answer names the right call ----
{
  const objs = () => Object.values(RT.state.areas[A].entities).filter(e => e.kind === 'object').length;
  const card = (await get(`${cp}/card?seat=${G}`)).body, build = card.split('\n').find(l => l.includes('BUILD A ROOM'));
  ok(/cave/.test(build) && /cellar/.test(build) && /basement/.test(build) && /crypt/.test(build) && /y=-10/.test(build), 'the main card: a helper who wants a cave, cellar, basement or crypt finds y=-10 on the line it starts from', build);
  ok(/PUT A THING DOWN/.test(card) && /only a marker/.test(card), 'and that a thing with no cat is only a marker');
  const open = (await act(G, 'room.spawn', { type: 'common', x: 1200, z: 0, w: 30, d: 30 }));
  ok(open.ok, 'the card\'s own room.spawn address works as printed: no seed needed', open);
  const n0 = objs();
  const noCat = await act(G, 'object.place', { name: 'cave', x: 1300, z: 0 });
  ok(noCat.ok === false && /is a room, not a thing/.test(noCat.why) && noCat.why.includes('room.spawn&type=cave') && noCat.why.includes('y=-10') && objs() === n0, 'object.place name=cave: refused, and the answer names the right call; nothing placed', noCat);
  const named = await act(G, 'object.place', { cat: 'cave', x: 1300, z: 0 });
  ok(named.ok === false && named.why.includes('room.spawn&type=cave') && objs() === n0, 'cat=cave: the same', named);
  for (const w of ['cellar', 'basement', 'Crypt', 'dungeon', 'Cavern']) { const r = await act(G, 'object.place', { name: w, x: 1300, z: 0 }); ok(r.ok === false && /room\.spawn&type=/.test(r.why), `object.place name=${w}: the room's call`, r); }
  const bare = await act(G, 'object.place', { name: 'cave', x: 1300, z: 0, marker: 1 }), plain = await act(G, 'object.place', { name: 'X marks the spot', x: 1301, z: 0 });
  ok(bare.ok && /only a marker/.test(bare.note) && plain.ok && /only a marker/.test(plain.note) && /things\?q=WORDS/.test(plain.note), 'marker=1 still leaves the box; any other name too, and the answer says it is only a marker', [bare, plain]);
  await act(G, 'object.delete', { id: bare.id }); await act(G, 'object.delete', { id: plain.id });
  // a cave: no command of its own, below the ground by itself, and the stair it comes with says where it leads
  const cave = await act(G, 'room.spawn', { type: 'cave', x: 1200, z: 0, w: 35, d: 25 }), rm = RT.state.areas[A].entities[cave.id];
  ok(cave.ok && rm.recipe.type === 'cave' && rm.recipe.y === -10 && /y=-10, lv -1/.test(cave.note), 'room.spawn type=cave goes below the ground, as the room tool does, and says so', cave);
  ok(cave.stair && /top Common room \(lv 1\)|top open ground \(lv 1\)/.test(cave.stairSays) && /bottom Cave \(lv -1\)/.test(cave.stairSays), 'and the stair it comes with says where it leads, straight away', cave);
  const y0 = await act(G, 'room.spawn', { type: 'cave', x: 1400, z: 0, w: 35, d: 25, y: 0 });
  ok(y0.ok && !RT.state.areas[A].entities[y0.id].recipe.y && !y0.note, 'a y sent is kept', y0);
  await act(G, 'room.delete', { id: y0.id });
  // the same trap for every word that is both: each piece is placed, and its answer names the room
  const lib = RT.roomgen.lib, both = ['pigsty', 'forge', 'smelter', 'throne', 'cave-mouth'].filter(c => lib.objects[c]);
  ok(both.length === 5, 'the words that are both a piece and a room, as the catalog stands', both);
  for (const c of both) { const r = await act(G, 'object.place', { cat: c, x: 1300, z: 40 }); ok(r.ok && /one piece of furniture/.test(r.note) && /room\.spawn&type=/.test(r.note), `cat=${c}: placed, and the answer names the room`, r); if (r.id) await act(G, 'object.delete', { id: r.id }); }
  const mouth = await act(G, 'object.place', { cat: 'cave-mouth', x: 1300, z: 40 });
  ok(mouth.note.includes('room.spawn&type=cave&') && mouth.note.includes('room.spawn&type=lair-mouth'), 'a cave mouth names the cave too', mouth.note); await act(G, 'object.delete', { id: mouth.id });
  const types = RT.roomgen.typeList, words = new Set(types.flatMap(t => [...t.key.split('-'), ...t.label.toLowerCase().split(/[^a-z]+/)]).filter(w => w.length > 3));
  ok(Object.keys(lib.objects).filter(o => words.has(o)).every(o => both.includes(o)), 'and no other piece is a room\'s word (a new one would fail here, to be looked at)', Object.keys(lib.objects).filter(o => words.has(o)));
  const cand = await act(G, 'object.place', { cat: 'candlestick', x: 1300, z: 40 });
  ok(cand.ok && !cand.note, 'a plain piece: no note'); await act(G, 'object.delete', { id: cand.id });
  const q = (await get(`${cp}/things?q=cave&seat=${G}`)).body;
  ok(q.room?.includes('room.spawn&type=cave') && q.things.length > 0, 'a search of the things for "cave" says it is a room, beside the furniture', q.room);
  // a seat that may place things but not rooms is told so, in the answer and on its card
  const handy = await seat(C.token, { kind: 'llm', name: 'Handy', scope: { areas: '*', classes: ['object', 'chat'] } });
  const h = await act(handy.token, 'object.place', { name: 'cave', x: 1300, z: 0 }), hc = (await get(`${cp}/card?seat=${handy.token}`)).body;
  ok(h.ok === false && /no "room" permission/.test(h.why) && /ask the GM/.test(h.why), 'a seat without the room class is told it cannot build one, and to ask the GM', h);
  ok(/is a ROOM, not a thing/.test(hc) && !hc.includes('cmd=room.spawn'), 'its card says so too, and offers no room.spawn');
  for (const id of [cave.id, open.id]) await act(G, 'room.delete', { id });
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

// ---- 6b. building labels (2026-11-02; Harry: "Apparently they can't see building labels"): every read agrees with the screen, within seesLabels ----
{
  const keep = await act(G, 'room.spawn', { type: 'common', x: 400, z: 0, w: 20, d: 20, seed: 11 }), mill = await act(G, 'room.spawn', { type: 'kitchen', x: 400, z: 60, w: 20, d: 20, seed: 12 });
  ok(keep.ok && mill.ok, 'two rooms, each its own building', [keep, mill]);
  const E = () => RT.state.areas[A].entities, kb = E()[keep.id].building, mb = E()[mill.id].building, auto = E()[mb].name;
  ok(/^Building \d+$/.test(auto), 'a building nobody named has the label the screen shows, "Building N"', auto);
  ok((await act(G, 'building.set', { id: kb, name: 'Keep of Whispers' })).ok, 'the GM side names one');
  const all = async (tok) => ({ scene: (await read(tok, 'scene')).body, state: (await read(tok, 'state')).body, room: (await read(tok, `room/${keep.id}`)).body, look: (await read(tok, 'look?x=410&z=10&r=12')).body });
  const g = await all(G), row = (o, id) => o.buildings.find(b => b.id === id);
  ok(row(g.scene, kb)?.label === 'Keep of Whispers' && row(g.scene, mb)?.label === auto && row(g.scene, kb).rooms === 1, 'the scene lists the buildings: id and label, paired', g.scene.buildings);
  ok(row(g.state, kb)?.label === 'Keep of Whispers' && row(g.state, kb).name === 'Keep of Whispers' && row(g.state, mb)?.label === auto, 'state agrees (label beside the old name)');
  for (const [what, r] of [['scene', g.scene.rooms.find(x => x.id === keep.id)], ['state', g.state.rooms.find(x => x.id === keep.id)], ['room', g.room.room], ['look', g.look.near.find(x => x.id === keep.id)]])
    ok(r?.building === kb && r.buildingLabel === 'Keep of Whispers' && r.label === 'Common room', `${what}: a room gives its building's id and label, and its own label as the screen shows it`, r);
  for (const [who, tok] of [["the player's agent", P], ['a GM-side seat without the room class', N]]) {
    const v = await all(tok), text = JSON.stringify(v);
    ok(!text.includes('Keep of Whispers') && !text.includes(auto) && !text.includes('buildingLabel'), `${who} reads no building label (the gate, unchanged)`);
    ok(row(v.scene, kb)?.name === 'Building' && !('label' in row(v.scene, kb)) && row(v.state, kb)?.name === 'Building' && !('label' in row(v.state, kb)), `${who}: the neutral name and no label, in the scene and state alike`);
    ok(v.scene.rooms.find(x => x.id === keep.id)?.label === 'Common room', `${who}: a room's type, as before`);
  }
  // a building none of whose rooms a seat can see is not there at all (as a snapshot leaves it out: an empty row says "something is hidden here")
  ok((await act(G, 'entity.flag', { ids: mill.id, hidden: true })).ok, 'the GM hides the only room of a building');
  for (const tok of [P]) { const v = await all(tok); ok(!row(v.scene, mb) && !row(v.state, mb), 'the player\'s agent has no row for it, in the scene or state'); }
  ok(row((await read(G, 'scene')).body, mb)?.label === auto, 'the GM side still has it');
  await act(G, 'entity.flag', { ids: mill.id, hidden: false });
  await act(G, 'room.delete', { id: keep.id }); await act(G, 'room.delete', { id: mill.id });
  ok(!row((await read(G, 'scene')).body, kb) && !row((await read(G, 'state')).body, kb), 'a building with no rooms left has no label on any screen, and no row');
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

// ---- 7b. cursor.hide, cursor.show: an idle AI seat's cursor comes off the table (docs/NETCODE.md "Hiding an AI seat's cursor") ----
{
  const until = async (f, ms = 1500) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (f()) return true; await sleep(15); } return f(); };
  // a watcher is what a screen holds: the browser's own PresenceView fed by the browser's own ClientSync
  const watcher = async () => {
    const pv = new PresenceView(), c = new ClientSync({ token: pl.token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onPresence: (m) => pv.ingest(m) });
    c.connect(); for (let i = 0; i < 100 && c.status !== 'live'; i++) await sleep(20);
    c.subscribe(A); for (let i = 0; i < 100 && !c.view(A); i++) await sleep(20);
    return { c, sees: (seat) => pv.on(A).some(s => s.seat === seat && s.pos) };
  };
  const W = await watcher(), me = gmAi.id, sees = () => W.sees(me);
  await read(G, `room/${R}`);
  ok(await until(sees), 'the control: an agent that read a room has a cursor on a player\'s table');
  { const L2 = await watcher(); ok(await until(() => L2.sees(me)), 'the control: a seat joining now is shown it'); L2.c.close(); }

  // hide: gone for everyone, at once, and it stays gone
  const cseq = RT.state.cseq, seq = RT.state.areas[A].seq, t0 = Date.now(), hid = await act(G, 'cursor.hide', {}, null);
  ok(hid.ok && hid.cursor === 'hidden', 'cursor.hide answers ok, cursor: hidden (the campaign address)', hid);
  ok(await until(() => !sees(), 1000), `the second seat stops seeing it (${Date.now() - t0} ms)`);
  ok(RT.state.cseq === cseq && RT.state.areas[A].seq === seq, 'presence, not a command in the log: no journal entry anywhere, nothing to undo');
  await sleep(1300);
  ok(!sees(), 'the relay\'s 1 s heartbeat does not bring it back');
  { const L2 = await watcher(); await sleep(400); ok(!L2.sees(me), 'a late joiner while it is hidden does not see it'); L2.c.close(); }
  ok(!(await get(`${cp}/presence?seat=${P}`)).body.seats.some(s => s.seat === me), 'another agent\'s presence read does not list a hidden cursor');

  // watching and waiting leave it hidden
  await read(G, 'scene'); await read(G, 'state'); await read(G, 'changes?after=0&wait=0'); await get(`${cp}/card?seat=${G}`); await get(`${cp}/presence?seat=${G}`);
  await sleep(350);
  ok(!sees() && RT.cursorsHidden.has(me), 'reading the whole area and waiting leave it hidden: scene, state, changes, the card, presence');
  ok((await act(G, 'object.open', { id: 'obj_nosuchthing' })).ok === false && (await sleep(250), !sees()), 'a refused command changes nothing, so it stays hidden');

  // show: back, for everyone, late joiners too
  const shown = await act(G, 'cursor.show');
  ok(shown.ok && shown.cursor === 'shown', 'cursor.show answers ok, cursor: shown (an area address)', shown);
  ok(await until(sees), 'the second seat sees it again');
  { const L2 = await watcher(); ok(await until(() => L2.sees(me)), 'and so does a seat joining now'); L2.c.close(); }

  // it comes back by itself: nothing aimed at the table happens unseen
  const back = async (what, go) => { await act(G, 'cursor.hide'); ok(await until(() => !sees()), `(hidden before ${what})`); const a = await go(); ok(await until(sees), `${what} shows it again by itself`, a); };
  await back('a command on a thing', () => act(G, 'token.mark', { id: mine.id, mark: 'star' }));
  await back('reading one room', () => read(G, `room/${R}`));
  await back('reading one spot', () => read(G, 'look?x=10&z=10'));
  await human(); await back('saying something', () => act(G, 'chat.say', { text: 'all done' }));
  await back('a campaign-wide command, which touches no spot', () => act(G, 'music.set', { default: 'true', music: 'off' }, null));

  // only its own: nobody can reach another seat's cursor
  const human0 = await act(C.token, 'cursor.hide'); ok(!human0.ok && /AI seat/.test(human0.why), 'a person\'s seat is refused, even the GM\'s', human0);
  const other = await act(N, 'cursor.hide', { who: me, seat2: me }); await sleep(300);
  ok(other.ok && sees() && !RT.cursorsHidden.has(me) && RT.cursorsHidden.has(narrow.id), 'cursor.hide names no seat: who= is ignored and it hides only the caller\'s', other);
  ok(!(await get(`${cp}/do?cmd=cursor.hide&seat=nonsense`)).body.ok, 'no token, no command');
  ok((await act(P, 'cursor.hide')).ok && (await act(P, 'cursor.show')).ok, 'a player\'s agent may too');
  const cards = await Promise.all([G, P, N, pl.token].map(t => get(`${cp}/card?seat=${t}`).then(r => r.body)));
  ok(cards.slice(0, 3).every(c => /Whenever you are not actively working, hide your cursor: \S*\/do\?cmd=cursor\.hide/.test(c) && /When you start again, show it: \S*\/do\?cmd=cursor\.show/.test(c)), 'every AI seat\'s card tells it to hide when idle and show when it starts again, with the addresses');
  ok(!cards[3].includes('cursor.hide') && !(await get(`${cp}/help/commands?seat=${pl.token}`)).body.includes('cursor.hide'), 'a person\'s card and command list do not offer it');
  const hc = (await get(`${cp}/help/commands?seat=${N}`)).body;
  ok(hc.includes('cursor.hide') && hc.includes('cursor.show'), 'a chat-only seat\'s command list has both: no permission to tick, none a stored scope could lack');
  ok(!/YOU MAY:.*cursor/.test(cards[2]) && !/YOUR PERMISSIONS:.*cursor/.test(hc), 'and it is not listed as a permission');

  // a hidden room's cursor stays the GM side's, through a hide and a show and for a joiner
  await act(G, 'cursor.hide'); ok(await until(() => !sees()), '(hidden before it goes in)');
  await read(G, `room/${V}`); await sleep(300);
  ok(!sees(), 'reading a room in the hidden vault brings it back for the GM side only: still none for the player');
  await act(G, 'cursor.hide'); await act(G, 'cursor.show'); await sleep(350);
  ok(!sees(), 'cursor.show in a hidden room does not show it to a player');
  { const L2 = await watcher(); await sleep(300); ok(!L2.sees(me), 'nor to a player joining then'); L2.c.close(); }

  // an area's address puts it in that area; an area the seat cannot see does not exist
  const A2 = (await act(G, 'area.create', { name: 'Second' }, null)).id || Object.keys(RT.state.areas).find(a => a !== A);
  await act(G, 'cursor.hide'); ok((await act(G, 'cursor.show', {}, A2)).ok && RT.ghosts.get(me)?.area === A2, 'cursor.show on another area\'s address puts it there');
  ok((await act(P, 'cursor.show', {}, A2).catch(() => ({}))).ok !== true && RT.ghosts.get(plAi.id)?.area !== A2, 'a player\'s agent cannot show its cursor in an area hidden from it');
  RT.showCursor(plAi.id, A2); ok(RT.ghosts.get(plAi.id)?.area !== A2, '...nor through the door a socket would use');
  W.c.close();
}

// ---- 7c. a ping reaches the helpers (2026-11-02; docs/NETCODE.md "A ping reaches the helpers"): who, where, what is there; never more than the seat may see ----
{
  const live = async (token) => { const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`); await new Promise(r => ws.on('open', r)); const got = []; ws.on('message', (d) => got.push(String(d))); ws.send(JSON.stringify({ t: 'hello', token })); for (let i = 0; i < 100 && !got.some(f => f.includes('"welcome"')); i++) await sleep(20); ws.send(JSON.stringify({ t: 'sub', area: A })); for (let i = 0; i < 100 && !got.some(f => f.includes('"snap"') || f.includes('"log"')); i++) await sleep(20); return ws; };
  const gmConn = await live(C.token), plConn = await live(pl.token);
  const ping = async (ws, cursor, extra = {}) => { ws.send(JSON.stringify({ t: 'pres', area: A, cursor, ping: true, ...extra })); await sleep(60); };
  const feed = async (tok, kinds = 'chat,roll') => (await get(`${cp}/changes?kinds=${kinds}&wait=0&seat=${tok}`)).body.events.filter(e => e.kind === 'ping');
  const drain = async () => { await feed(G); await feed(P); await feed(N); await sleep(3100); };
  await read(G, 'scene'); await read(P, 'scene'); await read(N, 'scene'); await drain(); // (all three are online; no ping waits)
  const room = await act(G, 'room.spawn', { type: 'common', x: 600, z: 0, w: 30, d: 30, seed: 21, name: 'Sly Fox' }), lab = RT.state.areas[A].entities[room.id].building;
  await act(G, 'building.set', { id: lab, name: 'Keep of Shadows' });
  const gob = await act(G, 'token.create', { name: 'Grum', x: 612.5, z: 12.5, gmNotes: 'QZX the goblin is the heir' });
  ok(room.ok && gob.ok, 'a room with a label, and a pawn with a GM note');

  // who, where, what is there: the GM side and the player side, each as it may see
  await ping(plConn, [612.5, 12.5, 2]);
  const [eG] = await feed(G), [eP] = await feed(P), [eN] = await feed(N);
  ok(eG?.kind === 'ping' && eG.by === 'Brakka' && eG.byKind === 'human' && eG.x === 612.5 && eG.z === 12.5 && eG.y === 2 && eG.area === A, 'the GM helper hears who pointed and where (area, x, z, y)', eG);
  ok(eG?.there.pawn?.name === 'Grum' && eG.there.room?.label === 'Sly Fox' && eG.there.building?.label === 'Keep of Shadows' && eG.there.level === 'lv 1' && /Brakka points at Grum in Sly Fox/.test(eG.text), 'and what is there, as its seat may see it', eG?.there);
  ok(eP?.there.pawn?.name === 'Grum' && eP.there.room?.label === 'Common room' && !('label' in eP.there.building), "a player's agent: the pawn, the room by its type, no label");
  ok(eN?.there.room?.label === 'Common room', 'a GM-side seat without the room class: no label either');
  ok(!JSON.stringify([eG, eP, eN]).includes('QZX') && !JSON.stringify([eP, eN]).includes('Sly Fox') && !JSON.stringify([eP, eN]).includes('Keep of Shadows'), 'no GM note for anyone, no label for a seat that may not have one');
  ok(!(await feed(G)).length, 'told once: the next read has it no more');
  ok(!(await feed(P, 'roll')).length, 'a feed that follows only rolls has no pings');
  await ping(plConn, [612.5, 12.5, 0]); await sleep(3100);
  ok((await feed(P, 'ping')).length === 1 && (await feed(G, 'chat')).length === 1, 'kinds=ping and kinds=chat both carry them');
  ok((await feed(P)).length === 0, 'and they are gone');

  // a thing: the ping names it. Ground with nothing on it: says so.
  const lamp = await act(G, 'object.place', { cat: 'candlestick', x: 620, z: 20 });
  await ping(gmConn, [620, 20, 0.5]);
  ok((await feed(P))[0]?.there.thing?.id === lamp.id, 'a thing at the spot', lamp);
  await feed(G);
  await sleep(3100);
  await ping(gmConn, [900, 900]);
  const open = (await feed(P))[0];
  ok(open && !open.there.room && !open.there.thing && open.there.level === 'lv 1' && /open ground/.test(open.text), 'nothing there: open ground', open);
  await feed(G); await feed(N);

  // the same secrecy as the ping: a hidden room reaches the GM side only, in the event and in its timing
  const crypt = await act(G, 'room.spawn', { type: 'crypt-vault', x: 660, z: 0, w: 20, d: 20, seed: 8, name: 'Bone cellar' });
  await act(G, 'entity.flag', { ids: crypt.id, hidden: true });
  await sleep(3100);
  const slept = (async () => { const t = Date.now(), r = await get(`${cp}/a/${A}/changes?after=${RT.state.areas[A].seq}&wait=2&seat=${P}`); return { t: Date.now() - t, r: r.body }; })();
  const sleptK = (async () => { const t = Date.now(), r = await get(`${cp}/changes?kinds=chat,roll&wait=2&seat=${P}`); return { t: Date.now() - t, r: r.body }; })();
  await sleep(150);
  await ping(gmConn, [670, 10, 0]);
  const [s1, s2] = await Promise.all([slept, sleptK]);
  ok(s1.t > 1800 && s2.t > 1800 && !s1.r.pings && !s2.r.events.length, "a ping in a hidden room does not end a player's helper's long sleep early, on either feed (the timing would say something happened)", [s1.t, s2.t]);
  const hid = (await feed(G))[0];
  ok(hid?.there.room?.label === 'Bone cellar' && hid.there.room.hidden === true && !(await feed(P)).length, 'the GM side hears it, and the room is named; the player side hears nothing');
  await sleep(3100);
  await ping(gmConn, [612.5, 12.5, 0], { secret: true }); // (the sender says the thing it pointed at is hidden)
  ok((await feed(G)).length === 1 && !(await feed(P)).length, 'a ping the sender marks secret: the same');

  // omission tricks: a hidden pawn and a hidden thing at the spot leave a player's helper's answer exactly as it was
  await sleep(3100);
  await ping(gmConn, [630, 12.5, 0]);
  const before = (await feed(P))[0]; await feed(G);
  const hidden = await act(G, 'token.create', { name: 'Assassin', x: 630, z: 12.5, hidden: true }), box = await act(G, 'object.place', { cat: 'candlestick', x: 630.2, z: 12.5, hidden: true });
  await act(G, 'entity.flag', { ids: box.id, hidden: true });
  await sleep(3100);
  await ping(gmConn, [630, 12.5, 0]);
  const after = (await feed(P))[0], gAfter = (await feed(G))[0];
  ok(hidden.ok && before && after && JSON.stringify({ ...after, seq: 0 }) === JSON.stringify({ ...before, seq: 0 }), "a hidden pawn and thing at the spot: the player's helper gets the same answer, to the letter", [before?.there, after?.there]);
  ok(gAfter?.there.pawn?.name === 'Assassin' && gAfter.there.pawn.hidden === true, 'the GM side reads the hidden pawn, marked hidden');

  // a long sleep wakes on one; a helper does not hear itself; memory is bounded and stale ones go; nothing is stored
  await sleep(3100); await feed(N); await feed(G); await feed(P);
  const t0 = Date.now(), wake = get(`${cp}/changes?kinds=chat,roll&wait=5&seat=${G}`), wakeA = get(`${cp}/a/${A}/changes?after=${RT.state.areas[A].seq}&wait=5&seat=${P}`), wakeB = get(`${cp}/a/${A}/changes?kinds=chat,roll&after=${RT.state.areas[A].seq}&wait=5&seat=${N}`);
  await sleep(100); const seq0 = RT.state.areas[A].seq, r0 = RT.r;
  await ping(gmConn, [612.5, 12.5, 0]);
  const [w, wA, wB] = await Promise.all([wake, wakeA, wakeB]);
  ok(Date.now() - t0 < 2500 && w.body.events[0]?.kind === 'ping' && wA.body.pings?.[0]?.kind === 'ping' && wA.body.entries.length === 0 && wB.body.events[0]?.kind === 'ping', 'a long sleep wakes on a ping: the campaign feed, the area feed and the plain feed', [Date.now() - t0, w.body, wA.body]);
  ok(RT.state.areas[A].seq === seq0 && RT.r === r0 && !JSON.stringify(RT.state).includes('"ping"'), 'nothing journaled: the sequence does not move and the state does not hold it');
  ok(!fs.readFileSync(path.join(dataDir, C.campaign, 'journal.jsonl'), 'utf8').includes('"ping"'), 'nor does the journal');
  const self = await live(G);
  await sleep(3100); await ping(self, [612.5, 12.5, 0]);
  const heard = [await feed(G), await feed(P), await feed(N)];
  ok(heard.every(h => !h.length), 'an AI seat over a websocket: it does not hear its own ping, and sets no other helper off', heard.map(h => h.map(e => [e.by, e.x]))); self.close();
  await sleep(3100);
  for (let i = 0; i < 12; i++) await ping(gmConn, [612.5 + i, 12.5, 0]);
  ok((await feed(P)).length === 4, 'twelve in a burst: the rate limit holds, four reach a helper (the relay allows 4 in 3 s per connection)');
  await feed(G); await feed(N); await sleep(3100);
  const now = Date.now();
  for (let i = 0; i < 20; i++) RT.notePing(C.seat, A, [612.5, 12.5, 0], false, now);
  ok(RT.pings.get(plAi.id).length === 8, 'at most 8 wait for a helper that is not reading');
  ok((await feed(P)).length === 8 && !RT.pings.has(plAi.id), 'read: dropped');
  RT.notePing(C.seat, A, [612.5, 12.5, 0], false, now - 121e3);
  ok(!RT.takePings(gmAi.id, null, now).filter(p => p.at === now - 121e3).length, 'stale ones go unread');
  RT.pings.clear();
  RT.llmSeen.delete(plAi.id); await ping(gmConn, [612.5, 12.5, 0]);
  ok(!RT.pings.has(plAi.id), 'a helper that is not connected is not queued for');
  await read(P, 'scene');
  gmConn.close(); plConn.close(); await sleep(100);
  const card = (await get(`${cp}/card?seat=${P}`)).body, words = (s) => s.split(/\s+/).length;
  ok(/PING/.test(card) && /look at this/.test(card) && /kinds=chat,roll/.test(card), 'the card tells a helper of pings, and what one usually means');
  ok((await get(`${cp}/help/dice?seat=${G}`)).body.includes('PINGS:'), 'help/dice has the detail');
  RT.pings.clear();
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
