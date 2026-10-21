// Turn order and initiative (docs/PAWNS.md): the pure rules, the relay's checks, what a PLAYER'S connection carries
// (hidden pawns never), the GET API for AI seats, undo, a restart.
//   node engine/test/turns.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
import * as TU from '../core/turns.js';
import { pawnKind } from '../core/pawn.js';
import { parseArgs } from '../core/commands.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(15); } console.log(`  (timed out waiting for ${what})`); return false; }
const dirs = []; process.on('exit', () => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); }); // /tmp is RAM on the build box
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-turns-')); dirs.push(d); return d; };

// ---------------- the pure rules ----------------
{
  const tok = (id, name, extra = {}) => ({ id, kind: 'token', name, x: 0, z: 0, owner: null, ...extra });
  const A = { id: 'area_x', entities: Object.fromEntries([
    tok('tok_brakka01', 'Brakka', { owner: 'seat_mira0001', initBonus: 3 }), tok('tok_zed00001', 'Zed', { owner: 'seat_kit00001' }), tok('tok_cat000001', 'Whiskers', { owner: 'seat_mira0001' }),
    tok('tok_gob00001', 'Goblin 1'), tok('tok_gob00002', 'Goblin 2', { initBonus: 2 }), tok('tok_gob00003', 'Goblin 3'), tok('tok_ogre0001', 'Ogre'),
    tok('tok_vamp0001', 'Vampire', { hidden: true }), tok('tok_wolf0001', 'Wolf 1', { hidden: true }), tok('tok_wolf0002', 'Wolf 2'),
    { id: 'obj_crate001', kind: 'object', name: 'Goblin 9', x: 0, z: 0 },
  ].map(e => [e.id, e])) };
  ok(pawnKind({ name: 'Goblin 3' }) === 'goblin' && pawnKind({ name: 'Goblin #12' }) === 'goblin' && pawnKind({ name: 'Grishnak' }) === 'grishnak' && pawnKind({ name: 'Dire  Wolf 2' }) === 'dire wolf' && pawnKind({ name: '7' }) === '7' && pawnKind({}) === 'pawn', 'pawnKind: the name, lower-case, a trailing number stripped');
  ok(TU.turnKeyOf(A.entities.tok_brakka01) === 'tok_brakka01' && TU.turnKeyOf(A.entities.tok_gob00002) === 'kind:goblin', 'a pawn with an owner is its own entry; one without is its kind\'s');
  ok(TU.isTurnKey('tok_gob00001') && TU.isTurnKey('kind:dire wolf') && !TU.isTurnKey('kind:') && !TU.isTurnKey('obj_crate001') && !TU.isTurnKey('goblin') && !TU.isTurnKey(7), 'a key is a pawn id or kind:<name>');
  const d = TU.defaultOrder(A);
  ok(JSON.stringify(d) === JSON.stringify(['tok_brakka01', 'tok_cat000001', 'tok_zed00001', 'kind:goblin', 'kind:ogre', 'kind:wolf']), 'the default order: owners\' pawns by name, then the kinds; a kind whose pawns are all hidden (the vampire) is left out, one with a pawn showing (wolf) is in', d);
  let T = TU.newTurns(d); const at = (t) => ({ ...A, turns: t });
  ok(T.at === null && T.round === 1 && !Object.keys(T.init).length, 'a new order: no marker yet (gathering initiative), round 1, no numbers');
  ok(TU.keyPawns(at(T), T, 'kind:goblin').map(e => e.id).join() === 'tok_gob00001,tok_gob00002,tok_gob00003' && TU.keyPawns(at(T), T, 'kind:goblin').length === 3, 'kind:goblin stands for the three goblins (and not for a crate named Goblin 9)');
  // no numbers: next, wrap, previous
  T = TU.step(at(T), T, 1); ok(T.at === 'tok_brakka01' && T.round === 1, 'the first Next puts the marker on the first entry');
  for (let i = 0; i < 5; i++) T = TU.step(at(T), T, 1);
  ok(T.at === 'kind:wolf' && T.round === 1, 'Next walks the order');
  T = TU.step(at(T), T, 1); ok(T.at === 'tok_brakka01' && T.round === 2, 'past the end: the first again, round 2');
  T = TU.step(at(T), T, -1); ok(T.at === 'kind:wolf' && T.round === 1, 'Previous from the first: the last of the round before');
  let P = TU.step(at(TU.newTurns(d)), TU.step(at(TU.newTurns(d)), TU.newTurns(d), 1), -1); ok(P.at === null && P.round === 1, 'Previous from the first entry of round 1: the marker comes off');
  // an entry whose pawns are gone is passed over
  const noOgre = { ...A, entities: Object.fromEntries(Object.entries(A.entities).filter(([id]) => id !== 'tok_ogre0001')) };
  let Q = { ...TU.newTurns(d), at: 'kind:goblin' }; Q = TU.step({ ...noOgre, turns: Q }, Q, 1);
  ok(Q.at === 'kind:wolf', 'Next passes over an entry none of whose pawns is on the table (the dead ogre)');
  Q = { ...TU.newTurns(d), at: 'kind:ogre' }; Q = TU.step({ ...noOgre, turns: Q }, Q, 1); ok(Q.at === 'kind:wolf', 'and moves on from a marker whose own entry has died');
  // numbers sort it
  let N = TU.newTurns(d);
  N = TU.setInit(at(N), N, 'tok_zed00001', 12); ok(N.order[0] === 'tok_zed00001', 'the first number goes to the front (ahead of everyone not yet rolled)');
  N = TU.setInit(at(N), N, 'kind:goblin', 17); N = TU.setInit(at(N), N, 'tok_brakka01', 17);
  ok(N.order.slice(0, 3).join() === 'tok_brakka01,kind:goblin,tok_zed00001', 'higher numbers first; a TIE at 17 goes to the higher bonus (Brakka +3 over the goblins +2)', N.order);
  N = TU.setInit(at(N), N, 'kind:ogre', 12);
  ok(N.order.indexOf('kind:ogre') === N.order.indexOf('tok_zed00001') + 1, 'a tie with equal bonus: whoever was already in the order stays ahead', N.order);
  ok(N.order.slice(4).join() === 'tok_cat000001,kind:wolf', 'entries with no number stay after, in the order they had');
  ok(TU.bonusOf(at(N), N, 'kind:goblin') === 2 && TU.bonusOf(at(N), N, 'kind:ogre') === null, 'a kind\'s bonus is the first of its pawns that has one');
  const dragged = TU.reorder({ ...N, at: 'kind:goblin' }, ['kind:wolf', 'tok_zed00001', 'kind:goblin', 'tok_brakka01', 'kind:wolf']);
  ok(dragged.order.join() === 'kind:wolf,tok_zed00001,kind:goblin,tok_brakka01' && dragged.at === 'kind:goblin' && !('kind:ogre' in dragged.init) && dragged.init['tok_brakka01'] === 17, 'a drag: the order as given (a repeat dropped), the marker stays on its entry, numbers of entries taken out are dropped');
  const late = TU.setInit(at(dragged), dragged, 'tok_cat000001', 14);
  ok(late.order.join() === 'tok_cat000001,kind:wolf,tok_zed00001,kind:goblin,tok_brakka01', 'after a drag, a new number moves ONLY its own entry (the rest stay as dragged)', late.order);
  ok(TU.setInit(at(N), N, 'tok_zed00001', null).order.join() === N.order.join() && !('tok_zed00001' in TU.setInit(at(N), N, 'tok_zed00001', null).init), 'taking a number away leaves the entry where it is');
  // a monster on its own
  const solo = TU.reorder(N, [...N.order, 'tok_gob00003']);
  ok(TU.keyPawns(at(solo), solo, 'kind:goblin').length === 2 && TU.keyPawns(at(solo), solo, 'tok_gob00003').length === 1 && TU.keyOfPawn(solo, A.entities.tok_gob00003) === 'tok_gob00003', 'a monster put in by its own id is its own entry and no longer part of its kind\'s');
  // what players are sent
  const G = { ...TU.newTurns(['tok_brakka01', 'kind:vampire', 'kind:goblin', 'kind:wolf', 'tok_wolf0001']), init: { 'kind:vampire': 19, 'tok_brakka01': 11, 'tok_wolf0001': 5 } };
  const pv = TU.forPlayers(at(G));
  ok(pv.order.join() === 'tok_brakka01,kind:goblin,kind:wolf' && !('kind:vampire' in pv.init) && !('tok_wolf0001' in pv.init) && pv.init.tok_brakka01 === 11, 'forPlayers: entries of hidden pawns are not in the order, nor in the numbers (the vampire; the hidden wolf on its own)', pv);
  ok(!JSON.stringify(pv).includes('vampire') && !JSON.stringify(pv).includes('tok_wolf0001'), 'nothing in it names them');
  ok(TU.forPlayers(at({ ...G, at: 'kind:vampire' })).at === 'tok_brakka01', 'while a hidden entry acts, the players\' marker stays on the entry before it');
  ok(TU.forPlayers(at({ ...TU.newTurns(['kind:vampire', 'tok_brakka01']), at: 'kind:vampire' })).at === null && TU.forPlayers(at({ ...TU.newTurns(['kind:vampire', 'tok_brakka01']), at: 'kind:vampire', round: 3 })).at === 'tok_brakka01', 'a hidden entry first in the order: no marker in round 1; later, the last entry of the round before');
  ok(TU.forPlayers(A) === null, 'no order: nothing');
  const rows = TU.turnRows(at({ ...G, at: 'kind:goblin' }));
  ok(rows.filter(r => !r.out).map(r => r.name).join('|') === 'Brakka|Vampire|Goblin ×3|Wolf 2|Wolf 1' && rows.find(r => r.key === 'kind:goblin').current && rows.find(r => r.key === 'kind:vampire').hidden && rows.find(r => r.key === 'tok_brakka01').bonus === 3, 'turnRows: names, the current one, hidden marks, bonuses', rows.map(r => r.name));
  ok(rows.filter(r => r.out).map(r => r.name).join('|') === 'Ogre|Whiskers|Zed', 'pawns in no entry come after, marked out', rows.filter(r => r.out).map(r => r.name));
  ok(parseArgs('turn.init', { key: 'kind:goblin', n: null }).args.n === null && parseArgs('turn.init', { key: 'tok_gob00001', n: '17' }, { fromQuery: true }).args.n === 17 && parseArgs('turn.init', { key: 'goblin', n: 3 }).error && parseArgs('turn.order', { order: '["tok_gob00001","kind:ogre"]' }, { fromQuery: true }).args.order.length === 2 && parseArgs('turn.order', { order: ['x'] }).error && parseArgs('token.set', { id: 'tok_gob00001', initBonus: null }).args.initBonus === null && !('initBonus' in parseArgs('token.set', { id: 'tok_gob00001' }).args), 'argument shapes: n may be null, keys are checked, a bonus can be cleared');
}

// ---------------- the relay ----------------
const dataDir = tmp();
let relay = await startRelay({ port: 0, dataDir, log: () => {} });
let base = `http://127.0.0.1:${relay.port}`;
const J = (p) => fetch(base + p).then(r => r.json());
const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'turns', gm: 'Harry' }) }).then(r => r.json());
const A = C.area, cmp = C.campaign;
const doGm = (cmd, args = {}, tok = C.token) => J(`/c/${cmp}/a/${A}/do?cmd=${cmd}&seat=${tok}&${new URLSearchParams(Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)])))}`);
const seatOf = async (id, name, extra = {}) => (await J(`/c/${cmp}/do?cmd=seat.create&id=${id}&kind=human&role=player&name=${name}&seat=${C.token}`)).token;
const miraTok = await seatOf('seat_mira0001', 'Mira'), kitTok = await seatOf('seat_kit00001', 'Kit');
const SECRET = 'Strahd', SECRET2 = 'Shadowmastiff';
for (const [id, name, extra] of [['tok_brakka01', 'Brakka', { owner: 'seat_mira0001', initBonus: 3 }], ['tok_zed00001', 'Zed', { owner: 'seat_kit00001' }], ['tok_gob00001', 'Goblin 1', {}], ['tok_gob00002', 'Goblin 2', { initBonus: 2 }], ['tok_ogre0001', 'Ogre', {}],
  ['tok_vamp0001', SECRET, { hidden: true, initBonus: 9 }], ['tok_dog00001', `${SECRET2} 1`, { hidden: true }], ['tok_dog00002', `${SECRET2} 2`, { hidden: true }]]) {
  const r = await doGm('token.create', { id, name, x: 5, z: 5, ...extra }); if (!r.ok) console.log('setup', id, r);
}
const state = () => relay.campaigns.get(cmp).state.areas[A];

// raw sockets: exactly what crosses the wire to a player, and to the GM
const rawConn = async (token) => {
  const frames = [], ws = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`);
  ws.on('message', (d) => frames.push(String(d)));
  await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'hello', token }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')), 3000, 'welcome'); ws.send(JSON.stringify({ t: 'sub', area: A }));
  await waitFor(() => frames.some(f => f.includes('"snap"')), 3000, 'snap');
  return { frames, ws, last: (t) => frames.map(f => JSON.parse(f)).filter(m => m.t === t).at(-1) };
};
const rawMira = await rawConn(miraTok), rawGm = await rawConn(C.token);
const client = (token) => { const c = new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => c.nacks.push(m) }); c.nacks = []; c.connect(); return c; };
const gm = client(C.token), mira = client(miraTok), kit = client(kitTok);
await waitFor(() => [gm, mira, kit].every(c => c.status === 'live'), 5000, 'clients live');
for (const c of [gm, mira, kit]) c.subscribe(A);
await waitFor(() => [gm, mira, kit].every(c => c.view(A)), 5000, 'views');
const settle = () => waitFor(() => [gm, mira, kit].every(c => c.pendingCount() === 0 && c.view(A).seq === state().seq), 5000, 'settled');

// who may
ok((await doGm('turn.start', {}, miraTok)).ok === false && !state().turns, 'a player cannot start a fight');
ok((await doGm('turn.next')).ok === false, 'Next with no order is refused, with the reason');
ok(/no turn order/.test((await doGm('turn.init', { key: 'tok_brakka01', n: 12 }, miraTok)).why || ''), 'a player\'s number before any fight is refused: "there is no turn order here"');
// start
let r = await doGm('turn.start');
ok(r.ok && JSON.stringify(state().turns.order) === JSON.stringify(['tok_brakka01', 'tok_zed00001', 'kind:goblin', 'kind:ogre']) && state().turns.at === null, 'Start fight: the visible pawns, owners first; hidden ones are not put in', state().turns);
await settle();
ok(JSON.stringify(mira.view(A).turns) === JSON.stringify(state().turns) && JSON.stringify(gm.view(A).turns) === JSON.stringify(state().turns), 'the order is shared: the GM\'s tab and a player\'s tab hold it');
// the GM drags the hidden ones in
r = await doGm('turn.order', { order: ['kind:' + SECRET.toLowerCase(), 'tok_brakka01', 'kind:' + SECRET2.toLowerCase(), 'tok_zed00001', 'kind:goblin', 'kind:ogre'] });
ok(r.ok && state().turns.order.length === 6, 'the GM puts the hidden vampire and the hidden hounds into the order (turn.order)');
await settle();
ok(gm.view(A).turns.order.length === 6 && JSON.stringify(mira.view(A).turns.order) === JSON.stringify(['tok_brakka01', 'tok_zed00001', 'kind:goblin', 'kind:ogre']), 'the GM holds six entries; the player holds the four she can see');
// numbers: a player for herself; not for others; the GM for anyone
ok((await doGm('turn.init', { key: 'tok_brakka01', n: 14 }, miraTok)).ok && state().turns.init.tok_brakka01 === 14, 'a player sets her own pawn\'s number');
ok((await doGm('turn.init', { key: 'tok_zed00001', n: 20 }, miraTok)).ok === false && (await doGm('turn.init', { key: 'kind:goblin', n: 20 }, miraTok)).ok === false, 'not another player\'s, and not a monster kind\'s');
const hid = await doGm('turn.init', { key: 'tok_vamp0001', n: 1 }, miraTok), nope = await doGm('turn.init', { key: 'tok_nosuch001', n: 1 }, miraTok);
ok(!hid.ok && !nope.ok && hid.why.replace('tok_vamp0001', 'X') === nope.why.replace('tok_nosuch001', 'X'), 'a hidden pawn answers a player exactly like a pawn that does not exist', [hid.why, nope.why]);
ok((await doGm('turn.init', { key: 'kind:' + SECRET.toLowerCase(), n: 21 })).ok && (await doGm('turn.init', { key: 'kind:goblin', n: 14 })).ok && (await doGm('turn.init', { key: 'tok_zed00001', n: 9 })).ok, 'the GM sets anyone\'s');
ok(JSON.stringify(state().turns.order.slice(0, 4)) === JSON.stringify(['kind:strahd', 'tok_brakka01', 'kind:goblin', 'tok_zed00001']), 'sorted by number, ties by bonus (Brakka +3 before the goblins +2 at 14)', state().turns.order);
ok((await doGm('token.set', { id: 'tok_zed00001', initBonus: 4 }, kitTok)).ok && state().entities.tok_zed00001.initBonus === 4 && (await doGm('token.set', { id: 'tok_zed00001', initBonus: 1 }, miraTok)).ok === false && (await doGm('token.set', { id: 'tok_zed00001', initBonus: 5 })).ok, 'a player sets her own pawn\'s bonus, not another\'s; the GM anyone\'s');
ok((await doGm('token.set', { id: 'tok_zed00001', initBonus: '' }, kitTok)).ok && !('initBonus' in state().entities.tok_zed00001) && (await doGm('token.set', { id: 'tok_zed00001', initBonus: 500 }, kitTok)).ok === false, 'a bonus can be taken away; 500 is refused');
// next: GM; the owner on her own turn; nobody else
r = await doGm('turn.next'); ok(r.ok && state().turns.at === 'kind:strahd', 'Next (GM): the hidden vampire\'s turn');
await settle();
ok(mira.view(A).turns.at === null, 'the player sees no marker yet (the hidden entry is first, round 1)');
ok((await doGm('turn.next', {}, miraTok)).ok === false, 'a player cannot move on from a turn that is not hers');
await doGm('turn.next'); await settle();
ok(state().turns.at === 'tok_brakka01' && mira.view(A).turns.at === 'tok_brakka01', 'Next: Brakka\'s turn, on every seat');
ok((await doGm('turn.next', {}, kitTok)).ok === false && (await doGm('turn.prev', {}, miraTok)).ok === false, 'Kit cannot end Mira\'s turn; a player cannot go back');
r = await doGm('turn.next', {}, miraTok); await settle();
ok(r.ok && state().turns.at === 'kind:goblin', 'Mira ends her own turn (turn.next)');
await doGm('turn.next'); await doGm('turn.next'); await settle(); // Zed, then the hidden hounds
ok(state().turns.at === 'kind:' + SECRET2.toLowerCase() && mira.view(A).turns.at === 'tok_zed00001', 'while the hidden hounds act, the player\'s marker stays on Zed');
await doGm('turn.next'); await doGm('turn.next'); await settle();
ok(state().turns.at === 'kind:strahd' && state().turns.round === 2 && mira.view(A).turns.round === 2 && mira.view(A).turns.at === 'kind:ogre', 'round 2 begins with the hidden vampire: players see round 2, the marker still on the last entry they can see');
r = await doGm('turn.at', { key: 'kind:goblin' }); ok(r.ok && state().turns.at === 'kind:goblin' && (await doGm('turn.at', { key: 'kind:goblin' }, miraTok)).ok === false && (await doGm('turn.at', { key: 'kind:nobody' })).ok === false, 'the GM puts the marker on an entry; a player cannot; an entry not in the order is refused');
// through the optimistic client too
const afterGoblin = state().turns.order[state().turns.order.indexOf('kind:goblin') + 1];
gm.submit('turn.next', {}, A); await settle();
ok(afterGoblin === 'tok_zed00001' && state().turns.at === afterGoblin && gm.view(A).turns.at === afterGoblin && kit.view(A).turns.at === afterGoblin, 'Next from the GM\'s tab (optimistic, then confirmed) reaches every tab');
mira.submit('turn.init', { key: 'tok_brakka01', n: 30 }, A); await settle();
ok(state().turns.init.tok_brakka01 === 30 && state().turns.order[0] === 'tok_brakka01' && mira.view(A).turns.order[0] === 'tok_brakka01' && gm.view(A).turns.order[0] === 'tok_brakka01', 'a number from a player\'s tab re-sorts the order for everyone');
kit.submit('turn.init', { key: 'tok_brakka01', n: 1 }, A); await waitFor(() => kit.nacks.length, 3000, 'nack'); await settle();
ok(kit.nacks.length === 1 && state().turns.init.tok_brakka01 === 30, 'another player\'s number from Kit\'s tab is refused and nothing changes');

// reveal and hide change what players are sent, with no turn command
const before = rawMira.frames.length;
r = await doGm('entity.flag', { ids: 'tok_dog00001', hidden: false }); await settle();
ok(mira.view(A).turns.order.includes('kind:' + SECRET2.toLowerCase()) && mira.view(A).entities.tok_dog00001 && !mira.view(A).entities.tok_dog00002, 'the GM reveals one hound: its entry appears in the player\'s order (one hound of it), with no turn command sent');
ok(rawMira.frames.slice(before).some(f => JSON.parse(f).t === 'turns'), 'by a "turns" message of its own');
await doGm('entity.flag', { ids: 'tok_dog00001', hidden: true }); await settle();
ok(!mira.view(A).turns.order.includes('kind:' + SECRET2.toLowerCase()), 'hidden again: gone from the player\'s order');
const wire = rawMira.frames.join('\n');
ok(wire.includes(SECRET2), '(the hound\'s name did cross the wire while it was revealed: the check below can see names)');

// THE TRAFFIC: nothing sent to the player names the vampire, in any frame, whatever was done
for (const f of [() => doGm('turn.init', { key: 'kind:strahd', n: 25 }), () => doGm('turn.order', { order: ['kind:strahd', 'tok_brakka01', 'tok_zed00001'] }), () => doGm('turn.at', { key: 'kind:strahd' }), () => doGm('turn.next'), () => doGm('turn.prev'), () => doGm('token.set', { id: 'tok_vamp0001', initBonus: 7 }), () => doGm('undo', {}), () => doGm('turn.end'), () => doGm('undo', {}), () => doGm('turn.start', { order: ['tok_vamp0001', 'tok_brakka01', 'kind:goblin'] })]) { const x = await f(); if (!x.ok) console.log('  (traffic step refused)', x.why); }
await settle();
const rollV = await doGm('turn.roll', { id: 'tok_vamp0001' });
ok(rollV.ok && rollV.shownInChat === false && Number.isInteger(rollV.roll) && rollV.bonus === state().entities.tok_vamp0001.initBonus && rollV.initiative === rollV.roll + rollV.bonus && state().turns.init.tok_vamp0001 === rollV.initiative && !(state().chat || []).length, 'GET turn.roll for the hidden vampire: rolled by the relay, bonus added, NO roll line in the chat', rollV);
await settle();
const all = rawMira.frames.join('\n'), gmAll = rawGm.frames.join('\n');
ok(rawMira.frames.length > 30 && !/strahd|tok_vamp0001/i.test(all), `no frame to the player names the hidden vampire, its id or its kind (${rawMira.frames.length} frames: snapshot, log, turns)`, rawMira.frames.find(f => /strahd|tok_vamp0001/i.test(f))?.slice(0, 200));
ok(/kind:strahd/.test(gmAll) && /tok_vamp0001/.test(gmAll), 'the GM\'s connection does carry them (the check is not blind)');
ok(!rawMira.frames.map(f => JSON.parse(f)).filter(m => m.t === 'log').flatMap(m => m.entries).some(e => /^turn\.(?!view)/.test(e.type) || (e.type === 'batch' && e.args.ops.some(o => /^turn\.(?!view)/.test(o.type)))), 'and no turn.* command reaches a player as sent: only turn.view');
ok(state().turns.order[0] === 'tok_vamp0001' && JSON.stringify(mira.view(A).turns.order) === JSON.stringify(['tok_brakka01', 'kind:goblin']) && JSON.stringify(gm.view(A).turns) === JSON.stringify(state().turns), 'after all that the GM\'s tab equals the relay, and the player\'s tab has the two entries she can see');
// a late joiner: snapshot only
const late = await rawConn(kitTok);
const snap = late.last('snap');
ok(snap.state.turns && JSON.stringify(snap.state.turns.order) === JSON.stringify(['tok_brakka01', 'kind:goblin']) && !/strahd|tok_vamp0001/i.test(late.frames.join('\n')), 'a player who joins now gets the filtered order in the snapshot');
late.ws.close();

// undo
await doGm('turn.end'); ok(!state().turns, 'End fight: no order'); await settle(); ok(!mira.view(A).turns && !gm.view(A).turns, 'on every tab');
r = await doGm('undo', {}); await settle();
ok(r.ok && state().turns?.order[0] === 'tok_vamp0001' && mira.view(A).turns?.order.length === 2, 'undo of End fight puts the order back (the GM\'s whole, the player\'s filtered)');
const seq0 = state().seq; await doGm('turn.next'); await doGm('turn.next');
r = await doGm('undo', {});
ok(state().turns.at !== null, 'Next leaves no undo step (Previous is its undo): an undo after two Nexts does not rewind the marker');
// AI seats: read and roll
const ai = await J(`/c/${cmp}/do?cmd=seat.create&id=seat_miraai01&kind=llm&name=Familiar&scope=${encodeURIComponent(JSON.stringify({ areas: '*', classes: ['turn', 'chat', 'pawn'] }))}&seat=${miraTok}`);
const st = await J(`/c/${cmp}/a/${A}/state?seat=${ai.token}`);
ok(ai.ok && st.turns && st.turns.order.filter(o => !o.notInOrder).map(o => o.key).join() === mira.view(A).turns.order.join() && st.turns.order.some(o => o.notInOrder && o.key === 'tok_zed00001') && st.turns.order.find(o => o.key === 'tok_brakka01').yours && !/strahd|tok_vamp0001/i.test(JSON.stringify(st)), 'a player\'s AI seat reads the order its player may see (GET state "turns"), her pawn marked yours', st.turns);
const gst = await J(`/c/${cmp}/a/${A}/state?seat=${C.token}`);
ok(gst.turns.order.some(o => o.key === 'tok_vamp0001' && o.hidden) && gst.turns.round >= 1, 'the GM side reads all of it, hidden entries marked');
const chat0 = state().chat?.length || 0;
const ar = await J(`/c/${cmp}/a/${A}/do?cmd=turn.roll&id=tok_brakka01&nonce=r1&seat=${ai.token}`);
ok(ar.ok && ar.roll >= 1 && ar.roll <= 20 && ar.bonus === 3 && ar.initiative === ar.roll + 3 && state().turns.init.tok_brakka01 === ar.initiative && ar.shownInChat && state().chat.length === chat0 + 1 && /Initiative: Brakka/.test(state().chat.at(-1).text) && state().chat.at(-1).roll.total === ar.initiative, 'an AI seat rolls for its player\'s pawn over GET: d20 + the bonus, the number set, the roll in the chat as rolls are', ar);
const again = await J(`/c/${cmp}/a/${A}/do?cmd=turn.roll&id=tok_brakka01&nonce=r1&seat=${ai.token}`);
ok(again.duplicate && state().chat.length === chat0 + 1 && state().turns.init.tok_brakka01 === ar.initiative, 'the same nonce again rolls nothing new');
ok((await J(`/c/${cmp}/a/${A}/do?cmd=turn.roll&id=tok_gob00001&seat=${ai.token}`)).ok === false && (await J(`/c/${cmp}/a/${A}/do?cmd=turn.roll&id=tok_vamp0001&seat=${ai.token}`)).ok === false, 'it cannot roll for a monster, nor learn of the hidden one');
const typed = await J(`/c/${cmp}/a/${A}/do?cmd=turn.roll&id=tok_brakka01&n=17&seat=${ai.token}`);
ok(typed.ok && typed.typed && state().turns.init.tok_brakka01 === 17 && state().chat.length === chat0 + 1, 'n=17 is taken in place of a roll (dice at the table): no roll line');
const card = await fetch(`${base}/c/${cmp}/card?seat=${ai.token}`).then(x => x.text());
ok(/THE TURN ORDER/.test(card) && /turn\.roll/.test(card), 'the rules card tells an AI seat how to read the order and roll');

// a restart keeps it
const want = JSON.stringify(state().turns);
for (const c of [gm, mira, kit]) c.close(); rawMira.ws.close(); rawGm.ws.close();
await relay.close();
relay = await startRelay({ port: 0, dataDir, log: () => {} }); base = `http://127.0.0.1:${relay.port}`;
ok(JSON.stringify(state().turns) === want, 'the order, the marker, the round and the numbers survive a relay restart');
fs.rmSync(path.join(dataDir, cmp, 'snapshot.json'));
await relay.close(); relay = await startRelay({ port: 0, dataDir, log: () => {} });
ok(JSON.stringify(state().turns) === want, 'and are rebuilt the same from the journal alone');
await relay.close();
console.log(`turns: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
