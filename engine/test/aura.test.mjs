// A PAWN'S AURA (2026-10-30; core/aura.js, docs/PAWNS.md "Aura"): the words, the strict check, the change, a real relay over
// the socket and over GET (an AI seat), and an old journal replayed.
//   node engine/test/aura.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import * as AU from '../core/aura.js';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const J = JSON.stringify;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } return false; }

// ---- 1. the check: strict ----
ok(AU.auraProblem({ level: 3, color: 'blue' }) === null && AU.auraProblem({ level: 0, color: 'gold' }) === null && AU.auraProblem({ level: 5, color: 'violet', emblem: 'dragons' }) === null, 'a level 0-5 and a palette colour (and an emblem id) pass');
for (const [bad, why] of [[{ level: 6, color: 'gold' }, 'level 6'], [{ level: -1, color: 'gold' }, 'level -1'], [{ level: 2.5, color: 'gold' }, 'not whole'], [{ level: '3', color: 'gold' }, 'a string level'], [{ level: 3 }, 'no colour'], [{ level: 3, color: 'pink' }, 'not in the palette'], [{ level: 3, color: '#ff0000' }, 'a hex colour'], [{ level: 3, color: 'gold', glow: 1 }, 'an unknown field'], [{ level: 3, color: 'gold', emblem: '<x>' }, 'markup in the emblem'], [{ level: 3, color: 'gold', emblem: 'x'.repeat(40) }, 'a long emblem'], [[3, 'gold'], 'a list'], [null, 'null'], ['3', 'a string']])
  ok(AU.auraProblem(bad), `refused: ${why}`, bad);
ok(AU.storedAura({ level: 0, color: 'gold' }) === null && J(AU.storedAura({ level: 0, color: 'blue' })) === J({ level: 0, color: 'blue' }) && J(AU.storedAura({ level: 4, color: 'red' })) === J({ level: 4, color: 'red' }), 'stored: level 0 in gold is none; level 0 keeps another colour');

// ---- 2. the words (the bar) ----
const P = (t) => AU.parseAura(t);
ok(J(P('aura 3')) === J({ level: 3 }) && J(P('aura up')) === J({ delta: 1 }) && J(P('aura down')) === J({ delta: -1 }) && J(P('aura off')) === J({ level: 0 }) && J(P('aura blue')) === J({ color: 'blue' }), 'aura 3 / up / down / off / blue', [P('aura 3'), P('aura up'), P('aura off'), P('aura blue')]);
ok(J(P('Aura 4 Red')) === J({ level: 4, color: 'red' }) && J(P('aura burning')) === J({ level: 3 }) && J(P('aura iconic')) === J({ level: 5 }) && J(P('aura purple')) === J({ color: 'violet' }) && J(P('aura white')) === J({ color: 'silver' }) && J(P('aura emblem dragons')) === J({ emblem: 'dragons' }), 'level names, colour words and an emblem');
ok(P('aura') === null && P('aura 7') === null && P('aura pink') === null && P('auras up') === null && P('concentrating') === null, 'not an aura: nothing');

// ---- 3. the change ----
const A = AU.auraAfter;
ok(J(A(null, { level: 3 })) === J({ level: 3, color: 'gold' }) && J(A({ level: 3, color: 'blue' }, { delta: 1 })) === J({ level: 4, color: 'blue' }) && J(A({ level: 5, color: 'blue' }, { delta: 1 })) === J({ level: 5, color: 'blue' }) && J(A(null, { delta: -1 })) === J({ level: 0, color: 'gold' }), 'up and down stop at 5 and 0, the colour kept');
ok(J(A(null, { color: 'green' })) === J({ level: 2, color: 'green' }) && J(A({ level: 4, color: 'gold' }, { color: 'red' })) === J({ level: 4, color: 'red' }), 'a colour picked with no aura lights it (glowing); on a lit one only the colour changes');
ok(J(A({ level: 3, color: 'violet' }, { level: 0 })) === J({ level: 0, color: 'violet' }) && J(A({ level: 0, color: 'violet' }, { delta: 1 })) === J({ level: 1, color: 'violet' }), 'off keeps the colour, and up lights it again in that colour');
ok(J(A({ level: 5, color: 'gold' }, { emblem: 'dragons' })) === J({ level: 5, color: 'gold', emblem: 'dragons' }) && J(A({ level: 5, color: 'gold', emblem: 'dragons' }, { emblem: '' })) === J({ level: 5, color: 'gold' }), 'an emblem, and taking it away');
ok([P('aura 3'), P('aura up'), P('aura blue'), P('aura off'), P('aura 5 violet'), P('aura emblem sun')].every(c => AU.auraProblem(AU.applyChange({ level: 2, color: 'blue' }, c)) === null), 'whatever the words, the change passes the relay\'s check');
// ---- 4. GET values ----
const G = (s) => AU.getAura(s);
ok(J(G('3').change) === J({ level: 3 }) && J(G('3,blue').change) === J({ level: 3, color: 'blue' }) && J(G('up').change) === J({ delta: 1 }) && J(G('off').change) === J({ level: 0 }) && J(G('5,gold,dragons').change) === J({ level: 5, color: 'gold', emblem: 'dragons' }) && J(G('{"level":2,"color":"red"}').set) === J({ level: 2, color: 'red' }), 'GET: 3, 3,blue, up, off, 5,gold,dragons, JSON');
ok(G('pink').error && G('9').error && G('{nope').error, 'GET: words it does not know are an error');

// ---- 5. a real relay: the socket, GET for an AI seat, and an old journal replayed ----
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-aura-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
let relay = await startRelay({ port: 0, dataDir, log: () => { } });
const base = `http://127.0.0.1:${relay.port}`;
const C = await fetch(`${base}/campaigns`, { method: 'POST', body: J({ name: 'Aura test', gm: 'Harry' }) }).then(r => r.json());
const nacks = [];
const gm = new ClientSync({ token: C.token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => nacks.push(m), onAck: () => { }, onPresence: () => { }, onCampaign: () => { } });
gm.connect(); await waitFor(() => gm.status === 'live'); gm.subscribe(C.area); await waitFor(() => gm.view(C.area));
const T = 'tok_auraaaaa001', E = () => gm.view(C.area).entities[T];
gm.submit('token.create', { id: T, name: 'Brakka', x: 2.5, z: 2.5, aura: { level: 3, color: 'red' } }, C.area);
await waitFor(() => E() && gm.pendingCount() === 0);
ok(J(E().aura) === J({ level: 3, color: 'red' }), 'token.create keeps an aura');
gm.submit('token.set', { id: T, aura: { level: 5, color: 'violet', emblem: 'dragons' } }, C.area); await waitFor(() => gm.pendingCount() === 0);
ok(J(E().aura) === J({ level: 5, color: 'violet', emblem: 'dragons' }), 'token.set sets it');
const n0 = nacks.length;
for (const bad of [{ level: 6, color: 'gold' }, { level: 3, color: 'pink' }, { level: 3, color: 'gold', glow: 1 }, { level: '2', color: 'gold' }]) gm.submit('token.set', { id: T, aura: bad }, C.area);
gm.submit('token.create', { id: 'tok_auraaaaa002', name: 'Bad', x: 7.5, z: 2.5, aura: { level: 9, color: 'gold' } }, C.area);
await waitFor(() => gm.pendingCount() === 0); await sleep(150);
ok(nacks.length - n0 === 5 && J(E().aura) === J({ level: 5, color: 'violet', emblem: 'dragons' }) && !gm.view(C.area).entities.tok_auraaaaa002, 'the relay refuses an aura of the wrong shape (level 6, pink, an unknown field, a string level), on set and create', nacks.slice(n0).map(n => n.why));
gm.submit('token.set', { id: T, aura: { level: 0, color: 'gold' } }, C.area); await waitFor(() => gm.pendingCount() === 0);
ok(E().aura === undefined, 'level 0 in gold: the field goes');
// GET: an AI seat
const cp = `/c/${C.campaign}`, enc = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? J(v) : v)}`).join('&');
const gget = (p) => fetch(base + p).then(async r => (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text());
const helper = await gget(`${cp}/do?cmd=seat.create&${enc({ kind: 'llm', name: 'Helper', scope: { areas: '*', classes: '*' } })}&seat=${C.token}`);
const aiTok = helper?.token;
if (aiTok) {
  let n = 0; const get = (v) => gget(`${cp}/a/${C.area}/do?cmd=token.set&id=${T}&aura=${encodeURIComponent(v)}&nonce=auraget${String(++n).padStart(4, '0')}&seat=${aiTok}`);
  const r1 = await get('3,blue'); await waitFor(() => E().aura?.level === 3, 3000);
  ok(r1.ok && J(E().aura) === J({ level: 3, color: 'blue' }), 'GET: aura=3,blue', { r1, now: E().aura });
  const r2 = await get('up'); await waitFor(() => E().aura?.level === 4, 3000);
  ok(r2.ok && J(E().aura) === J({ level: 4, color: 'blue' }), 'GET: aura=up from what the pawn has', E().aura);
  const r3 = await get('green'); await waitFor(() => E().aura?.color === 'green', 3000);
  ok(r3.ok && J(E().aura) === J({ level: 4, color: 'green' }), 'GET: aura=green', E().aura);
  const r4 = await get('off'); await waitFor(() => E().aura?.level === 0, 3000);
  ok(r4.ok && J(E().aura) === J({ level: 0, color: 'green' }), 'GET: aura=off (the colour kept)', E().aura);
  const r5 = await get('pink'); const r6 = await get('{"level":7,"color":"gold"}');
  ok(!r5.ok && /aura/.test(r5.why || r5.error || J(r5)) && !r6.ok, 'GET: a colour it does not know, a level 7: refused', [r5, r6]);
  const r7 = await get('5,gold,sun'); await waitFor(() => E().aura?.level === 5, 3000);
  ok(r7.ok && J(E().aura) === J({ level: 5, color: 'gold', emblem: 'sun' }), 'GET: aura=5,gold,sun (an emblem)', E().aura);
  const scene = await gget(`${cp}/a/${C.area}/scene?seat=${aiTok}`);
  const me = JSON.stringify(scene).includes('"aura":{"level":5,"color":"gold","emblem":"sun"}');
  ok(me, 'the scene shows a pawn\'s aura', typeof scene === 'object' ? Object.keys(scene) : String(scene).slice(0, 200));
  const help = await gget(`${cp}/help/pawns?seat=${aiTok}`);
  ok(/AURA/.test(typeof help === 'string' ? help : J(help)), 'help/pawns says how to set an aura');
} else ok(false, 'could not make an AI seat for the GET checks', helper);
// an old journal: a token.set from before auras (no aura field) replays unchanged and leaves the aura as it was
{
  const rt = relay.campaigns.get(C.campaign);
  const A0 = rt.state.areas[C.area];
  rt.commit({ by: Object.keys(rt.state.seats)[0], cid: null, fx: [{ area: C.area, seq: A0.seq + 1, type: 'token.set', args: { id: T, conditions: ['prone'] } }] });
  await relay.close?.(); relay = await startRelay({ port: 0, dataDir, log: () => { } });
  const rt2 = relay.campaigns.get(C.campaign);
  const e = (rt2.state || (await rt2.load?.(), rt2.state))?.areas?.[C.area]?.entities?.[T];
  ok(J(e?.conditions) === J(['prone']) && e?.aura?.level === (aiTok ? 5 : 0) || (!aiTok && !e?.aura), 'an old journal replays; the aura is kept as it was', e);
}
await relay.close?.();
console.log(`aura: ${checks - fails}/${checks}`);
process.exit(fails ? 1 : 0);
