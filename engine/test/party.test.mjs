// The party, the benches, the cast and whispers (docs/PAWNS.md), against a real relay with real sockets.
//   node engine/test/party.test.mjs
// Every seat also has a RAW socket that keeps every byte the relay sends it: "never reaches a player" is proved from
// that traffic, not from what a client chose to keep.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
import { pawnKind } from '../core/pawn.js';
import { partyFor } from '../core/party.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } console.log(`  (timed out waiting for ${what})`); return false; }
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-party-'));
let relay = await startRelay({ port: 0, dataDir, log: () => { } });
const post = (p, b) => fetch(`http://127.0.0.1:${relay.port}${p}`, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const get = (p) => fetch(`http://127.0.0.1:${relay.port}${p}`).then(r => r.text());
function client(token) {
  const ev = { nacks: [], acks: [], camp: null, wh: [] };
  const c = new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => ev.nacks.push(m), onAck: (m) => ev.acks.push(m), onCampaign: (v) => { ev.camp = v; }, onWhisper: (m) => ev.wh.push(m) });
  c.ev = ev; c.connect(); return c;
}
// a raw socket for a seat: subscribed to the area, keeping all it is sent as text
async function raw(token, area) {
  const ws = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`), rx = [];
  ws.on('message', (d) => rx.push(String(d)));
  await new Promise(r => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', token, v: 1 }));
  await waitFor(() => rx.some(x => x.includes('"welcome"')));
  ws.send(JSON.stringify({ t: 'sub', area }));
  return { ws, rx, text: () => rx.join('\n') };
}
const done = async (c, cid) => { await waitFor(() => c.ev.acks.some(a => a.cid === cid) || c.ev.nacks.some(a => a.cid === cid), 4000, 'ack'); return c.ev.acks.find(a => a.cid === cid) ? null : c.ev.nacks.find(a => a.cid === cid); };

const C = await post('/campaigns', { name: 'Party test', gm: 'Harry' });
const A = C.area, gm = client(C.token);
await waitFor(() => gm.status === 'live'); gm.subscribe(A); await waitFor(() => gm.view(A));
const seat = async (id, name) => { const cid = gm.submit('seat.create', { id, kind: 'human', role: 'player', name, color: '#6fc36f' }); await waitFor(() => gm.ev.acks.some(a => a.cid === cid)); return gm.ev.acks.find(a => a.cid === cid).token; };
const tMira = await seat('seat_mira000001', 'Mira'), tKit = await seat('seat_kit0000001', 'Kit'), tTobias = await seat('seat_tobias0001', 'Tobias');
const mira = client(tMira), kit = client(tKit), tobias = client(tTobias);
for (const c of [mira, kit, tobias]) { await waitFor(() => c.status === 'live'); c.subscribe(A); await waitFor(() => c.view(A)); }
const rawGm = await raw(C.token, A), rawMira = await raw(tMira, A), rawKit = await raw(tKit, A), rawTobias = await raw(tTobias, A);
const MIRA = 'seat_mira000001', KIT = 'seat_kit0000001', TOBIAS = 'seat_tobias0001', GM = gm.me;

// ---- pawnKind ----
ok(pawnKind({ name: 'Goblin 3' }) === 'goblin' && pawnKind({ name: 'Goblin' }) === 'goblin' && pawnKind({ name: 'Old Tom Hobb' }) === 'old tom hobb' && pawnKind({ name: 'Dire wolf 12' }) === 'dire wolf' && pawnKind({}) === 'pawn', 'pawnKind: the name, lower-case, without a trailing number');

// ---- a player's pawns: define, who is sent them ----
let r = await done(mira, mira.submit('pawn.define', { id: 'def_brakka0001', name: 'Brakka', fig: 'hero-fighter-dwarf-f', sheet: 'sheets.example.com/brakka', notes: 'SECRET-MIRA-NOTE axe, shield', main: true }));
ok(!r, 'a player defines a pawn', r);
await waitFor(() => mira.ev.camp?.pawns?.length === 1);
const d0 = mira.ev.camp.pawns[0];
ok(d0 && d0.owner === MIRA && d0.name === 'Brakka' && d0.fig === 'hero-fighter-dwarf-f' && d0.sheet === 'https://sheets.example.com/brakka' && d0.main === true && d0.at === null, 'it is hers, with its figure, its sheet link made a web link, main, and not on a table', d0);
await waitFor(() => gm.ev.camp?.pawns?.length === 1);
ok(gm.ev.camp.pawns.length === 1 && gm.ev.camp.pawns[0].id === 'def_brakka0001', 'the GM is sent every player\'s definitions');
await sleep(150);
ok((kit.ev.camp.pawns || []).length === 0 && !rawKit.text().includes('SECRET-MIRA-NOTE') && !rawKit.text().includes('def_brakka0001'), 'another player is sent nothing of it (her client, and every byte her socket received)');
r = await done(mira, mira.submit('pawn.define', { id: 'def_bear000001', name: 'Bear', fig: 'beast-bear', petOf: 'def_brakka0001' }));
ok(!r, 'a second pawn, a pet of the first', r);
r = await done(mira, mira.submit('pawn.define', { id: 'def_wolf000001', name: 'Wolf', fig: 'foe-wolf', main: true }));
await waitFor(() => mira.ev.camp.pawns.length === 3);
ok(mira.ev.camp.pawns.filter(d => d.main).map(d => d.id).join() === 'def_wolf000001', 'one main pawn each: marking another unmarks the first');
await done(mira, mira.submit('pawn.define', { id: 'def_brakka0001', main: true }));
r = await done(kit, kit.submit('pawn.define', { id: 'def_brakka0001', name: 'Mine now' }));
ok(r && /someone else/.test(r.why), 'a player cannot change another player\'s definition', r);
r = await done(kit, kit.submit('pawn.forget', { id: 'def_brakka0001' }));
ok(r && /someone else|no such/.test(r.why), 'nor forget it', r);
r = await done(kit, kit.submit('pawn.define', { id: 'def_kitpawn001', name: 'Sly', owner: MIRA }));
ok(r && /someone else/.test(r.why), 'nor define one for someone else', r);
r = await done(mira, mira.submit('pawn.define', { id: 'def_bad0000001', name: 'Bad', sheet: 'javascript:alert(1)' }));
ok(r && /web link/.test(r.why), 'a sheet link that is not a web link is refused', r);
for (let i = 0; i < 12; i++) await done(kit, kit.submit('pawn.define', { id: `def_kit00000${String(i).padStart(2, '0')}`, name: `Kit's ${i}` }));
await waitFor(() => kit.ev.camp.pawns.length === 12);
ok(kit.ev.camp.pawns.length === 12, 'no limit worth the name and no approval: twelve defined, no GM step');

// ---- the bench: bring on, send back ----
r = await done(mira, mira.submit('pawn.bring', { id: 'tok_brakka0001', def: 'def_brakka0001', x: 12.5, z: 12.5, name: 'Brakka', owner: MIRA }, A));
ok(!r, 'the player brings her own pawn onto the table (no GM)', r);
await waitFor(() => gm.view(A).entities.tok_brakka0001);
const t0 = gm.view(A).entities.tok_brakka0001;
ok(t0 && t0.owner === MIRA && t0.def === 'def_brakka0001' && t0.fig === 'hero-fighter-dwarf-f' && t0.main === true && t0.sheet === 'https://sheets.example.com/brakka' && t0.notes.includes('axe'), 'the pawn on the table is the definition: figure, owner, sheet, notes, main', t0);
await waitFor(() => mira.ev.camp.pawns.find(d => d.id === 'def_brakka0001')?.at === A);
ok(mira.ev.camp.pawns.find(d => d.id === 'def_brakka0001').at === A && mira.ev.camp.pawns.find(d => d.id === 'def_bear000001').at === null, 'her bench now shows Brakka on the table and Bear still on it');
// the relay writes the pawn from the definition, whatever the sender says
r = await done(mira, mira.submit('pawn.bring', { id: 'tok_bear000001', def: 'def_bear000001', x: 17.5, z: 12.5, name: 'DRAGON', owner: KIT, fig: 'foe-dragon-young-red', size: 2 }, A));
await waitFor(() => gm.view(A).entities.tok_bear000001);
const t1 = gm.view(A).entities.tok_bear000001;
ok(!r && t1.name === 'Bear' && t1.owner === MIRA && t1.fig === 'beast-bear' && !t1.size, 'a bring that lies about the figure, name or owner still lands as the definition', t1);
await waitFor(() => mira.view(A).entities.tok_bear000001?.name === 'Bear');
ok(mira.view(A).entities.tok_bear000001.name === 'Bear' && mira.view(A).entities.tok_bear000001.owner === MIRA, 'and her own view agrees once the relay has answered');
r = await done(mira, mira.submit('pawn.bring', { id: 'tok_brakka0002', def: 'def_brakka0001', x: 22.5, z: 12.5 }, A));
ok(r && /already on a table/.test(r.why), 'one pawn per definition: a second Brakka is refused', r);
r = await done(kit, kit.submit('pawn.bring', { id: 'tok_stolen0001', def: 'def_wolf000001', x: 22.5, z: 12.5 }, A));
ok(r && /not one of your pawns/.test(r.why), 'a player cannot bring on someone else\'s pawn', r);
r = await done(kit, kit.submit('pawn.bench', { id: 'tok_bear000001' }, A));
ok(r && /someone else/.test(r.why), 'nor send someone else\'s back', r);
r = await done(mira, mira.submit('pawn.bench', { id: 'tok_bear000001' }, A));
await waitFor(() => !gm.view(A).entities.tok_bear000001);
ok(!r && !gm.view(A).entities.tok_bear000001, 'she sends her own back to the bench', r);
await waitFor(() => mira.ev.camp.pawns.find(d => d.id === 'def_bear000001')?.at === null);
ok(mira.ev.camp.pawns.find(d => d.id === 'def_bear000001').at === null && mira.ev.camp.pawns.some(d => d.id === 'def_bear000001'), 'its definition stays: it is on the bench again');
const cidU = mira.undo(A); await waitFor(() => gm.view(A).entities.tok_bear000001, 3000, 'undo of the send-back');
ok(!!gm.view(A).entities.tok_bear000001, 'undo brings it back onto the table');
await done(mira, mira.submit('pawn.bench', { id: 'tok_bear000001' }, A));
gm.submit('token.create', { id: 'tok_goblin0001', name: 'Goblin 1', x: 30, z: 30 }, A);
await waitFor(() => mira.view(A).entities.tok_goblin0001);
r = await done(mira, mira.submit('pawn.bench', { id: 'tok_goblin0001' }, A));
ok(r && /no place on a bench|someone else/.test(r.why), 'a pawn that never came from a bench cannot be benched by a player', r);

// ---- the party rows' data ----
await waitFor(() => kit.ev.camp.party?.pawns?.some(p => p.id === 'tok_brakka0001'));
let pp = kit.ev.camp.party.pawns.find(p => p.id === 'tok_brakka0001');
ok(pp && pp.owner === MIRA && pp.area === A && pp.fig === 'hero-fighter-dwarf-f' && pp.main && !('notes' in pp) && !('gmNotes' in pp), 'every seat is sent the party\'s pawns: whose, where, the figure (no notes)', pp);
kit.submit('token.damage', { id: 'tok_brakka0001', damage: 7 }, A);
await waitFor(() => tobias.ev.camp.party.pawns.find(p => p.id === 'tok_brakka0001')?.damage === 7, 3000, 'damage in the party view');
ok(tobias.ev.camp.party.pawns.find(p => p.id === 'tok_brakka0001').damage === 7, 'a pawn\'s damage reaches every seat\'s party rows without a click');
gm.submit('token.set', { id: 'tok_brakka0001', conditions: ['prone'], gmNotes: 'SECRET-GM-NOTE she is cursed' }, A);
await waitFor(() => tobias.ev.camp.party.pawns.find(p => p.id === 'tok_brakka0001')?.conditions?.[0] === 'prone');
ok(tobias.ev.camp.party.pawns.find(p => p.id === 'tok_brakka0001').conditions[0] === 'prone', 'and its conditions');
const campsBefore = rawKit.rx.filter(x => x.includes('"t":"camp"')).length;
gm.submit('token.move', { id: 'tok_brakka0001', x: 17.5, z: 17.5 }, A); gm.submit('token.move', { id: 'tok_goblin0001', x: 35, z: 30 }, A);
await sleep(400);
ok(rawKit.rx.filter(x => x.includes('"t":"camp"')).length === campsBefore, 'a plain move sends no fresh campaign view');
// a pawn hidden from players leaves the players' party rows; the GM keeps it, marked
gm.submit('entity.flag', { ids: ['tok_brakka0001'], hidden: true }, A);
await waitFor(() => !kit.ev.camp.party.pawns.some(p => p.id === 'tok_brakka0001'));
ok(!kit.ev.camp.party.pawns.some(p => p.id === 'tok_brakka0001') && gm.ev.camp.party.pawns.find(p => p.id === 'tok_brakka0001')?.hidden === true, 'a pawn hidden from players is not in a player\'s party rows; the GM\'s has it, marked hidden');
ok(mira.ev.camp.pawns.find(d => d.id === 'def_brakka0001').at === null && mira.ev.camp.pawns.find(d => d.id === 'def_brakka0001').away === true, 'its owner\'s bench says only that it is away');
gm.submit('entity.flag', { ids: ['tok_brakka0001'], hidden: false }, A);
await waitFor(() => kit.ev.camp.party.pawns.some(p => p.id === 'tok_brakka0001'));
// a pawn in a hidden area: not in a player's rows
const cidA = gm.submit('area.create', { id: 'area_crypt00001', name: 'Crypt' }); await done(gm, cidA);
gm.subscribe('area_crypt00001'); await waitFor(() => gm.view('area_crypt00001'));
gm.submit('token.create', { id: 'tok_kitpawn001', name: 'Sly', x: 5, z: 5, owner: KIT }, 'area_crypt00001');
await waitFor(() => gm.ev.camp.party.pawns.some(p => p.id === 'tok_kitpawn001'));
await sleep(200);
ok(gm.ev.camp.party.pawns.find(p => p.id === 'tok_kitpawn001').area === 'area_crypt00001' && !kit.ev.camp.party.pawns.some(p => p.id === 'tok_kitpawn001') && !rawKit.text().includes('tok_kitpawn001') && !rawKit.text().includes('area_crypt00001'), 'a pawn standing in a hidden area: in the GM\'s rows with its area, and no word of it to any player (even its owner)');

// ---- lend ----
r = await done(mira, mira.submit('token.lend', { id: 'tok_brakka0001', to: KIT }, A));
await waitFor(() => gm.view(A).entities.tok_brakka0001.owner === KIT);
ok(!r && gm.view(A).entities.tok_brakka0001.owner === KIT && gm.view(A).entities.tok_brakka0001.lender === MIRA, 'a player lends her pawn to another player', r);
r = await done(kit, kit.submit('token.move', { id: 'tok_brakka0001', x: 22.5, z: 17.5 }, A));
ok(!r, 'who can now move it', r);
r = await done(tobias, tobias.submit('token.lend', { id: 'tok_brakka0001', to: TOBIAS }, A));
ok(r && /not yours/.test(r.why), 'a third player cannot take it', r);
r = await done(mira, mira.submit('token.lend', { id: 'tok_brakka0001', to: MIRA }, A));
await waitFor(() => gm.view(A).entities.tok_brakka0001.owner === MIRA);
ok(!r && gm.view(A).entities.tok_brakka0001.owner === MIRA && !('lender' in gm.view(A).entities.tok_brakka0001), 'the lender takes it back; the loan is over', r);
r = await done(mira, mira.submit('token.lend', { id: 'tok_brakka0001', to: '' }, A));
await waitFor(() => gm.view(A).entities.tok_brakka0001.owner === null);
ok(!r && gm.view(A).entities.tok_brakka0001.lender === MIRA, 'lent to no one: the GM side (and its assistants) moves it; she is still its lender', r);
r = await done(mira, mira.submit('pawn.bench', { id: 'tok_brakka0001' }, A));
ok(!r, 'and she can still send her lent pawn back to the bench', r);
await done(mira, mira.submit('pawn.bring', { id: 'tok_brakka0003', def: 'def_brakka0001', x: 12.5, z: 12.5 }, A));

// ---- the GM's cast: never to a player ----
r = await done(gm, gm.submit('cast.save', { id: 'cast_vex000001', kind: 'one', name: 'SECRET-CAST Lord Vex', fig: 'foe-vampire-m', notes: 'the villain', gmNotes: 'SECRET-CAST-GMNOTE weak to garlic' }));
ok(!r, 'the GM saves a named individual', r);
r = await done(gm, gm.submit('cast.save', { id: 'cast_patrol0001', kind: 'group', name: 'SECRET-CAST goblin patrol', members: [{ name: 'Goblin', fig: 'foe-goblin-spear', dx: 0, dz: 0 }, { name: 'Goblin', fig: 'foe-goblin-bow', dx: 5, dz: 0 }, { name: 'Wolf', fig: 'foe-wolf', dx: 0, dz: 5 }] }));
ok(!r, 'and a group', r);
await waitFor(() => gm.ev.camp.cast?.length === 2);
ok(gm.ev.camp.cast.length === 2 && gm.ev.camp.cast[0].id === 'cast_patrol0001' && gm.ev.camp.cast[0].members.length === 3, 'the GM is sent the cast, most recent first');
await done(gm, gm.submit('cast.use', { id: 'cast_vex000001' }));
await waitFor(() => gm.ev.camp.cast[0].id === 'cast_vex000001');
ok(gm.ev.camp.cast[0].id === 'cast_vex000001', 'using an entry moves it to the front (recents)');
r = await done(kit, kit.submit('cast.save', { id: 'cast_kit0000001', kind: 'one', name: 'Mine' }));
ok(r && r.code === 'forbidden', 'a player cannot save to the cast', r);
r = await done(kit, kit.submit('cast.forget', { id: 'cast_vex000001' }));
ok(r && r.code === 'forbidden', 'nor forget from it', r);
r = await done(gm, gm.submit('cast.save', { id: 'cast_bad0000001', kind: 'group', name: 'Bad', members: [] }));
ok(r && /1 to 30/.test(r.why), 'an empty group is refused', r);
await sleep(200);
for (const [n, c, rw, tok] of [['Mira', mira, rawMira, tMira], ['Kit', kit, rawKit, tKit], ['Tobias', tobias, rawTobias, tTobias]]) {
  const st = await get(`/c/${C.campaign}/state?seat=${tok}`);
  ok(!('cast' in c.ev.camp) && !rw.text().includes('SECRET-CAST') && !rw.text().includes('cast_vex') && !st.includes('SECRET-CAST'), `${n}: the cast is in nothing this seat was sent (campaign view, every byte of the socket, the GET API)`);
  ok(!rw.text().includes('SECRET-GM-NOTE'), `${n}: and no GM note`);
}
ok(rawGm.text().includes('SECRET-CAST Lord Vex') && rawGm.text().includes('SECRET-CAST-GMNOTE'), '(the GM\'s own socket did receive it: the check can fail)');

// ---- party notes, marching order ----
r = await done(kit, kit.submit('party.set', { notes: 'We owe the innkeeper 3 gp.' }));
await waitFor(() => mira.ev.camp.party.notes === 'We owe the innkeeper 3 gp.');
ok(!r && mira.ev.camp.party.notes === 'We owe the innkeeper 3 gp.' && gm.ev.camp.party.notes === mira.ev.camp.party.notes, 'party notes: one text, any seat writes, every seat reads');
r = await done(mira, mira.submit('party.set', { notes: '' }));
await waitFor(() => kit.ev.camp.party.notes === '');
ok(!r && kit.ev.camp.party.notes === '', 'and can be emptied');
r = await done(mira, mira.submit('party.set', { order: [KIT, MIRA, TOBIAS] }));
await waitFor(() => gm.ev.camp.party.order.length === 3);
ok(!r && gm.ev.camp.party.order.join() === [KIT, MIRA, TOBIAS].join(), 'the marching order is shared');
r = await done(mira, mira.submit('party.set', { order: [KIT, KIT] }));
ok(r && /each once/.test(r.why), 'an order that names a seat twice is refused', r);

// ---- whispers: to one seat, and to no one else ----
const SECRET = 'WHISPER-SECRET the rogue is lying';
const before = { gm: rawGm.rx.length, tobias: rawTobias.rx.length };
const wid = mira.whisper(KIT, SECRET);
await waitFor(() => kit.ev.wh.some(m => m.t === 'whisper' && m.id === wid));
const got = kit.ev.wh.find(m => m.id === wid);
ok(got && got.from === MIRA && got.to === KIT && got.text === SECRET, 'a whisper reaches the seat it is for', got);
await waitFor(() => mira.ev.wh.some(m => m.t === 'whispered' && m.id === wid));
ok(mira.ev.wh.find(m => m.t === 'whispered' && m.id === wid).ok === true, 'the sender is told it was delivered');
ok(rawMira.text().includes(SECRET), 'the sender\'s other connection has it too (her other tab)');
await sleep(300);
ok(!rawTobias.text().includes('WHISPER-SECRET') && !rawGm.text().includes('WHISPER-SECRET'), 'no other seat received a byte of it: not a third player, not the GM');
ok(rawKit.text().includes(SECRET), '(the receiver\'s raw socket did: the check can fail)');
for (const [n, tok] of [['the GM', C.token], ['Tobias', tTobias]]) { const st = await get(`/c/${C.campaign}/state?seat=${tok}`), ar = await get(`/c/${C.campaign}/a/${A}/state?seat=${tok}`), ch = await get(`/c/${C.campaign}/a/${A}/changes?seat=${tok}&after=0`); ok(!st.includes('WHISPER-SECRET') && !ar.includes('WHISPER-SECRET') && !ch.includes('WHISPER-SECRET'), `${n}: nor is it in the GET API (state, area, changes)`); }
ok(!JSON.stringify(gm.view(A)).includes('WHISPER-SECRET') && !JSON.stringify(relay.campaigns.get(C.campaign).state).includes('WHISPER-SECRET'), 'it is in no area\'s chat and nowhere in the campaign\'s state');
const w2 = mira.whisper('seat_nobody0001', 'hello'); await waitFor(() => mira.ev.wh.some(m => m.id === w2));
ok(mira.ev.wh.find(m => m.id === w2).ok === false, 'a whisper to nobody is refused');
const w3 = mira.whisper(MIRA, 'hello me'); await waitFor(() => mira.ev.wh.some(m => m.id === w3));
ok(mira.ev.wh.find(m => m.id === w3).ok === false, 'and to yourself');
tobias.close(); rawTobias.ws.close(); await sleep(200);
const w4 = mira.whisper(TOBIAS, 'are you there'); await waitFor(() => mira.ev.wh.some(m => m.id === w4));
ok(mira.ev.wh.find(m => m.id === w4).ok === false && /not at the table/.test(mira.ev.wh.find(m => m.id === w4).why), 'a whisper to someone who is not connected is not delivered, and says so');
const w5 = mira.whisper(KIT, 'x'.repeat(501)); await waitFor(() => mira.ev.wh.some(m => m.id === w5));
ok(mira.ev.wh.find(m => m.id === w5).ok === false, 'over 500 characters is refused');

// ---- it all survives a restart; whispers do not exist to survive ----
for (const c of [gm, mira, kit]) c.close(); for (const x of [rawGm, rawMira, rawKit]) x.ws.close();
await relay.close();
ok(!fs.readdirSync(path.join(dataDir, C.campaign)).some(f => fs.readFileSync(path.join(dataDir, C.campaign, f), 'utf8').includes('WHISPER-SECRET')), 'no file on the relay\'s disk holds the whisper');
relay = await startRelay({ port: 0, dataDir, log: () => { } });
const st = relay.campaigns.get(C.campaign).state;
ok(Object.keys(st.pawns).length === 15 && Object.keys(st.cast).length === 2 && st.party.order.length === 3 && st.areas[A].entities.tok_brakka0003?.def === 'def_brakka0001', 'after a restart: the definitions, the cast, the party order and the pawn on the table are all there', [Object.keys(st.pawns).length, Object.keys(st.cast).length]);
// Portrait metadata is a figure only, derived from an explicit main pawn, including the bench.
const portraitState = structuredClone(st);
portraitState.pawns = { def_portrait: { id: 'def_portrait', owner: MIRA, name: 'Private name', main: true, fig: 'hero-wizard-elf-f' } };
for (const area of Object.values(portraitState.areas)) for (const e of Object.values(area.entities)) if (e.owner === MIRA) delete e.main;
ok(partyFor(portraitState, KIT).portraits[MIRA] === 'hero-wizard-elf-f', 'other seats receive a benched main character portrait');
ok(!JSON.stringify(partyFor(portraitState, KIT).portraits).includes('def_portrait'), 'portrait metadata has no pawn identifiers or private names');
portraitState.areas[A].entities.tok_portrait = { id: 'tok_portrait', kind: 'token', owner: MIRA, main: true, fig: 'foe-dragon-secret', hidden: true, def: 'def_portrait', x: 999, z: 999 };
ok(!partyFor(portraitState, KIT).portraits[MIRA], 'a hidden main pawn does not disclose its figure through the portrait');
portraitState.areas[A].entities.tok_portrait.hidden = false;
ok(partyFor(portraitState, KIT).portraits[MIRA] === 'foe-dragon-secret', 'a visible main pawn supplies the current figure');
delete portraitState.areas[A].entities.tok_portrait.main;
ok(!partyFor(portraitState, KIT).portraits[MIRA], 'an ordinary owned pawn is not a player portrait');
await relay.close();
fs.rmSync(dataDir, { recursive: true, force: true });
console.log(`party: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
