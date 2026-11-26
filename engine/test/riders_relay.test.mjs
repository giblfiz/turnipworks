// RIDERS THROUGH THE RELAY (Harry 2026-11-07: "If I stand a pawn on a table, and then I move the table, it should move the
// pawn with it"; core/riders.js, object.move `carry`). Real sockets, the shared ClientSync, the AI seats' GET API:
//   - a pawn on a table rides the table to EVERY seat, in ONE log entry (no lag between the table and its riders)
//   - the permission rule: the carrier's. A pawn of another player rides; an AI seat that may move things but not pawns
//     carries pawns on the table it moves, and is refused moving the same pawn by itself
//   - a hidden rider never reaches a player: not its id, not its new place, not in the view, not on the wire
//   - one undo puts the table and every rider back, for every seat; a relay restart replays the carry
//   node engine/test/riders_relay.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } console.log(`  (timed out waiting for ${what})`); return false; }
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-riders-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
let relay = await startRelay({ port: 0, dataDir, log: () => { } });
let base = `http://127.0.0.1:${relay.port}`;
const post = (p, b) => fetch(base + p, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const get = (p) => fetch(base + p).then(async r => ({ status: r.status, body: r.headers.get('content-type').includes('json') ? await r.json() : await r.text() }));
function client(token) {
  const ev = { acks: [], nacks: [], wire: [] };
  const c = new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onAck: (m) => ev.acks.push(m), onNack: (m) => ev.nacks.push(m), onEntry: (e) => ev.wire.push(JSON.stringify(e)) });
  c.ev = ev; c.connect(); return c;
}
const near = (a, b) => Math.abs(a - b) < 0.011;

const C = await post('/campaigns', { name: 'Riders', gm: 'Harry' });
const A = C.area, cp = `/c/${C.campaign}`;
const gm = client(C.token);
await waitFor(() => gm.status === 'live', 3000, 'gm live'); gm.subscribe(A); await waitFor(() => gm.view(A), 3000, 'gm view');
const seat = async (args) => { const n = gm.ev.acks.filter(a => a.token).length; gm.submit('seat.create', args); await waitFor(() => gm.ev.acks.filter(a => a.token).length > n, 3000, 'seat ' + args.name); return gm.ev.acks.filter(a => a.token).at(-1).token; };
const p1Tok = await seat({ id: 'seat_brakka001', kind: 'human', role: 'player', name: 'Brakka', color: '#6fc36f' });
const p2Tok = await seat({ id: 'seat_vexxx0001', kind: 'human', role: 'player', name: 'Vex', color: '#6f8fc3' });
const aiTok = await seat({ id: 'seat_mover0001', kind: 'llm', name: 'Mover', scope: { areas: [A], classes: ['object'] } }); // may move things, NOT pawns
const p1 = client(p1Tok), p2 = client(p2Tok);
await waitFor(() => p1.status === 'live' && p2.status === 'live', 3000, 'players live'); p1.subscribe(A); p2.subscribe(A);
await waitFor(() => p1.view(A) && p2.view(A), 3000, 'player views');

// a table, a tray on it, Brakka's pawn on the table, Vex's on the tray, the GM's hidden spy on the table, a pawn on the floor
gm.submit('batch', { ops: [
  { type: 'object.place', args: { id: 'obj_table000001', name: 'table', cat: 'table', x: 10, z: 10, dims: [6, 3, 4] } },
  { type: 'object.place', args: { id: 'obj_tray0000001', name: 'tray', cat: 'tray', x: 11, z: 10, y: 3, dims: [2, 0.2, 2], parent: 'obj_table000001' } },
  { type: 'token.create', args: { id: 'tok_brakka0001', name: 'Brakka', x: 8.5, z: 9, y: 3, owner: 'seat_brakka001' } },
  { type: 'token.create', args: { id: 'tok_vexpawn001', name: 'Vex', x: 10.6, z: 10.4, y: 3.2, owner: 'seat_vexxx0001' } },
  { type: 'token.create', args: { id: 'tok_spyspy0001', name: 'Spy', x: 12, z: 11, y: 3, hidden: true } },
  { type: 'token.create', args: { id: 'tok_floor00001', name: 'Floor', x: 14, z: 10 } },
] }, A);
await waitFor(() => p1.view(A)?.entities.tok_vexpawn001 && gm.pendingCount() === 0, 3000, 'set up');
ok(!p1.view(A).entities.tok_spyspy0001 && !p1.ev.wire.some(w => w.includes('tok_spyspy0001')), 'set up: the players do not see the hidden spy');

// 1. THE GM'S DRAG (what the browser sends: one object.move with its riders in carry), 10 ft east and a quarter turn
const n1 = p2.ev.wire.length;
gm.submit('object.move', { id: 'obj_table000001', x: 20, z: 10, rot: Math.PI / 2, carry: ['obj_tray0000001', 'tok_brakka0001', 'tok_vexpawn001', 'tok_spyspy0001'] }, A);
await waitFor(() => near(p2.view(A)?.entities.tok_brakka0001?.x, 19) && gm.pendingCount() === 0, 3000, 'move reaches p2');
const at = (v, id, dx, dz) => near(v.entities[id].x, 20 + dz) && near(v.entities[id].z, 10 - dx);
for (const [name, c] of [['the GM', gm], ['Brakka', p1], ['Vex (a second client)', p2]]) ok(at(c.view(A), 'tok_brakka0001', -1.5, -1) && at(c.view(A), 'tok_vexpawn001', 0.6, 0.4) && at(c.view(A), 'obj_tray0000001', 1, 0) && c.view(A).entities.tok_floor00001.x === 14, `relay sync: ${name} sees the table, the tray and both pawns on them moved and turned together; the floor pawn stayed`);
if (process.env.V) console.log("p1 wire:", p1.ev.wire.at(-1), "\ngm-side:", gm.ev.wire.at(-1));
ok(p2.ev.wire.length - n1 === 1, 'ONE log entry carries the table and its riders (no rider lags behind)', p2.ev.wire.slice(n1));
ok(near(p1.view(A).entities.tok_brakka0001.rot, Math.PI / 2), 'the rider turned with the table');
ok(at(gm.view(A), 'tok_spyspy0001', 2, 1), 'the hidden spy rode too (the GM sees it)');
ok(!p1.view(A).entities.tok_spyspy0001 && !p2.view(A).entities.tok_spyspy0001, 'hidden rider: not in either player\'s view');
ok(!p1.ev.wire.some(w => w.includes('tok_spyspy0001') || w.includes('Spy')) && !p2.ev.wire.some(w => w.includes('tok_spyspy0001')), 'hidden rider: never on a player\'s wire, not even its id in the carry list');
{ const st = await get(`${cp}/a/${A}/state?seat=${p1Tok}`); ok(st.status !== 200 || !JSON.stringify(st.body).includes('tok_spyspy0001'), 'hidden rider: not in a player\'s GET read either'); }

// 2. UNDO: one step puts the table and every rider back, for every seat
gm.undo(A);
await waitFor(() => near(p2.view(A)?.entities.tok_brakka0001?.x, 8.5), 3000, 'undo reaches p2');
for (const [name, c] of [['the GM', gm], ['Vex', p2]]) ok(c.view(A).entities.obj_table000001.x === 10 && near(c.view(A).entities.tok_brakka0001.x, 8.5) && near(c.view(A).entities.tok_vexpawn001.x, 10.6) && near(c.view(A).entities.obj_tray0000001.x, 11) && (c !== gm || near(c.view(A).entities.tok_spyspy0001.x, 12)), `undo: ${name} sees everything back in one step`);
ok(!p1.ev.wire.some(w => w.includes('tok_spyspy0001')), 'undo: the hidden rider still never reached a player');

// 3. THE PERMISSION RULE through an AI seat that may move things and not pawns: its move of the table carries the
// players' pawns (the relay works out what stands on it from the data), and its move of a pawn on its own is refused
const r = await get(`${cp}/a/${A}/do?cmd=object.move&id=obj_table000001&x=10&z=30&nonce=ride1&seat=${aiTok}`);
ok(r.body.ok && ['tok_brakka0001', 'tok_vexpawn001', 'obj_tray0000001'].every(id => r.body.carried?.includes(id)) && !r.body.carried.includes('tok_floor00001'), 'AI seat: its table move carries what stands on it, and says so ("carried")', r.body);
await waitFor(() => near(p1.view(A)?.entities.tok_brakka0001?.z, 29), 3000, 'ai move reaches p1');
ok(near(p1.view(A).entities.tok_brakka0001.z, 29) && near(p1.view(A).entities.tok_vexpawn001.z, 30.4) && p1.view(A).entities.tok_floor00001.z === 10, 'AI seat: another player\'s pawn rode, the floor pawn did not');
const r2 = await get(`${cp}/a/${A}/do?cmd=token.move&id=tok_brakka0001&x=0&z=0&nonce=ride2&seat=${aiTok}`);
ok(!r2.body.ok && r2.body.code === 'forbidden', 'AI seat: moving that pawn by itself is refused (it rode on the table\'s permission only)', r2.body);
const r3 = await get(`${cp}/a/${A}/do?cmd=object.move&id=obj_table000001&x=10&z=30&carry=tok_floor00001&nonce=ride3&seat=${aiTok}`);
ok(!r3.body.ok && /not standing on/.test(r3.body.why || ''), 'AI seat: a carry list cannot take a pawn that is not on the table', r3.body);
const r4 = await get(`${cp}/a/${A}/do?cmd=object.move&id=obj_table000001&x=12&z=30&carry=none&nonce=ride4&seat=${aiTok}`);
await waitFor(() => p1.view(A)?.entities.obj_table000001?.x === 12, 3000, 'carry=none');
ok(r4.body.ok && near(p1.view(A).entities.tok_brakka0001.x, 8.5), 'AI seat: carry=none moves the table alone');
const pl = await get(`${cp}/a/${A}/do?cmd=object.move&id=obj_table000001&x=0&z=0&nonce=ride5&seat=${p1Tok}`);
ok(!pl.body.ok, 'a player may not move the table, so carries nothing', pl.body);

// 4. A RESTART replays the journal, carry and all
const before = JSON.stringify(gm.view(A).entities.tok_vexpawn001);
gm.close?.(); p1.close?.(); p2.close?.();
await relay.close();
relay = await startRelay({ port: 0, dataDir, log: () => { } }); base = `http://127.0.0.1:${relay.port}`;
const g2 = client(C.token); await waitFor(() => g2.status === 'live', 3000, 'gm again'); g2.subscribe(A); await waitFor(() => g2.view(A)?.entities.tok_vexpawn001, 3000, 'gm view again');
ok(JSON.stringify(g2.view(A).entities.tok_vexpawn001) === before, 'restart: the riders are where the carry put them');
g2.close?.();
await relay.close();
console.log(`riders relay: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
