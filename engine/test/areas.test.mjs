// AREAS ARE OPEN OR HIDDEN, AND PAWNS TRAVEL BETWEEN THEM (Harry 2026-10-06; docs/PAWNS.md "Areas").
//   node engine/test/areas.test.mjs
// 1. core: the arrival point (one function), the first-area rule, the travel rules
// 2. relay, over real sockets and the GET API. "Hidden means hidden everywhere" is proved from what a PLAYER SEAT
//    RECEIVES: every socket message and every GET answer the player and the player's AI seat get is kept, and the
//    hidden area's id, its name and the names of the things in it must never appear in any of it.
// 3. migration: every campaign on disk, loaded by the code as it stood before this change (git bb14488) and by the
//    code now: the stored state is byte-identical and every player seat sees exactly the same areas.
import { corpusDir } from './corpus.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
import { stableStringify } from '../core/hash.js';
import { REGISTRY, checkCommand, parseArgs } from '../core/commands.js';
import { newCampaign, projectCampaign } from '../core/state.js';
import { canSee, isOpen, can } from '../core/perms.js';
import { arrivalPoint, ARRIVAL_PLACE } from '../core/travel.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra ?? ''); } else if (process.env.V) console.log('ok', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } console.log(`  (timed out waiting for ${what})`); return false; }
const quiet = () => {};
const HERE = path.dirname(fileURLToPath(import.meta.url));
const madeDirs = [];
const tmp = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); madeDirs.push(d); return d; };
process.on('exit', () => { for (const d of madeDirs) fs.rmSync(d, { recursive: true, force: true }); }); // /tmp is RAM-backed

// =====================================================================================================================
// 1. CORE
// =====================================================================================================================
{
  const room = (id, x, z, w, d, y = 0) => ({ id, kind: 'room', recipe: { type: 'common', x, z, w, d, seed: 1, ...(y && { y }) } });
  const tok = (id, x, z, owner = null, y = 0) => ({ id, kind: 'token', name: id, x, z, owner, ...(y && { y }) });
  const seats = { seat_gm: { id: 'seat_gm', kind: 'human', role: 'gm' }, seat_p1: { id: 'seat_p1', kind: 'human', role: 'player' }, seat_p2: { id: 'seat_p2', kind: 'human', role: 'player' } };
  const E = (...es) => Object.fromEntries(es.map(e => [e.id, e]));
  // side (Harry: "NOT area center. out in the fog sea to the side of the area"): open ground south of everything built,
  // level with its middle, two squares out; later arrivals do not stack
  const three = E(room('room_a', 0, 0, 4, 4), room('room_b', 6, 0, 4, 4), room('room_c', 12, 0, 4, 4), room('room_up', 6, 0, 4, 4, 10), room('room_cellar', 6, 2, 4, 4, -10));
  const c = arrivalPoint(three, seats);
  eq([c.by, c.x, c.z, c.y], ['side', 42.5, 42.5, 0], 'arrival: with no mark and no party there, NOT the middle: open ground south of everything built (a cellar counts), level with its middle, two squares out, on the ground');
  ok(!Object.values(three).some(r => c.x > r.recipe.x * 5 && c.x < (r.recipe.x + r.recipe.w) * 5 && c.z > r.recipe.z * 5 && c.z < (r.recipe.z + r.recipe.d) * 5), 'arrival: it is in no room on any level');
  { let es = { ...three }; const seen = new Set();
    for (let i = 0; i < 6; i++) { const q = arrivalPoint(es, seats, { id: `tok_n${i}` }); seen.add(`${q.x},${q.z}`); es = { ...es, [`tok_n${i}`]: tok(`tok_n${i}`, q.x, q.z) }; ok(q.by === 'side' && q.z >= 32.5 && q.y === 0, `arrival: NPC ${i + 1} of 6 is outside too`, JSON.stringify(q)); }
    ok(seen.size === 6, 'arrival: six arrivals in a row stand on six different squares', [...seen].join(' ')); }
  eq(arrivalPoint({ ...three, obj_shed: { id: 'obj_shed', kind: 'object', place: 'floor', x: 40, z: 60, y: 0, dims: [6, 6, 6] } }, seats).z, 77.5, 'arrival: a thing standing outside the rooms is part of what is built: the pawn arrives beyond it');
  eq([arrivalPoint({}, seats).by, arrivalPoint({}, seats).x], ['side', 2.5], 'arrival: an area with nothing built still answers (0, 0)');
  // party: beside the party pawn nearest the middle of the party, never on a pawn; the GM's own pawn is not "party"
  const withParty = { ...three, ...E(tok('tok_p1', 7.5, 7.5, 'seat_p1'), tok('tok_p2', 12.5, 7.5, 'seat_p2'), tok('tok_p3', 12.5, 12.5, 'seat_p2'), tok('tok_npc', 60, 60, null), tok('tok_gm', 62.5, 2.5, 'seat_gm')) };
  const p = arrivalPoint(withParty, seats, { id: 'tok_new' });
  ok(p.by === 'party' && Math.max(Math.abs(p.x - 12.5), Math.abs(p.z - 7.5)) === 5 && !Object.values(withParty).some(e => e.kind === 'token' && e.x === p.x && e.z === p.z), 'arrival: beside the party pawn nearest the middle of the party, on a free square', JSON.stringify(p));
  eq(arrivalPoint({ ...three, ...E(tok('tok_npc', 60, 60, null), tok('tok_gm', 62.5, 2.5, 'seat_gm')) }, seats).by, 'side', "arrival: an NPC or the GM's own pawn is not the party");
  eq(arrivalPoint({ ...three, ...E(tok('tok_me', 7.5, 7.5, 'seat_p1')) }, seats, { id: 'tok_me' }).by, 'side', 'arrival: the travelling pawn itself is not "a party pawn already there"');
  // mark: the GM's arrival mark wins over both
  const mark = { id: 'obj_mark', kind: 'object', place: ARRIVAL_PLACE, x: 67.5, z: 12.5, y: 0, dims: [5, 0.2, 5], hidden: true };
  const m = arrivalPoint({ ...withParty, obj_mark: mark }, seats, { id: 'tok_new' });
  eq([m.by, m.x, m.z], ['mark', 67.5, 12.5], 'arrival: the GM-placed mark wins, and the pawn stands on it');
  // a free square: the mark's square is taken, then a ring of pawns and a table
  const crowd = { ...withParty, obj_mark: mark, ...E(tok('tok_x1', 67.5, 12.5), tok('tok_x2', 62.5, 12.5), tok('tok_x3', 72.5, 12.5)), obj_tbl: { id: 'obj_tbl', kind: 'object', place: 'floor', layer: 'furnish', x: 67.5, z: 7.5, y: 0, dims: [4, 3, 4] } };
  const f = arrivalPoint(crowd, seats, { id: 'tok_new' });
  ok(f.by === 'mark' && !(f.x === 67.5 && f.z === 12.5) && !Object.values(crowd).some(e => (e.kind === 'token' || e.id === 'obj_tbl') && e.x === f.x && e.z === f.z) && Math.hypot(f.x - 67.5, f.z - 12.5) <= 7.1, 'arrival: always a free square (not on a pawn, not on the table), the nearest one', JSON.stringify(f));
  // an upstairs mark keeps its floor
  const up = arrivalPoint({ ...three, obj_mark: { ...mark, x: 37.5, z: 7.5, y: 10 } }, seats);
  eq([up.x, up.z, up.y], [37.5, 7.5, 10], 'arrival: a mark upstairs puts the pawn on that floor');
  // inside a room: the free square is in a room on that floor, never out in the void beyond the wall
  const packed = E(room('room_s', 0, 0, 1, 2), tok('tok_a', 2.5, 2.5, 'seat_p1'));
  const q = arrivalPoint(packed, seats, { id: 'tok_new' });
  eq([q.x, q.z], [2.5, 7.5], 'arrival: beside a pawn in a one-square-wide room means the other square of that room');

  // ---- the first-area rule and the travel rules, through the same check + fill + apply the relay runs ----
  let S = newCampaign('cmp_areas0001', 'Areas');
  const GM = 'seat_gm000001', P1 = 'seat_pl000001', P2 = 'seat_pl000002';
  const camp = (type, args, by = null) => { const d = REGISTRY[type]; S = d.apply ? d.apply(S, d.fill ? d.fill(S, args, by) : args, { by }) : S; };
  const run = (by, type, args) => { const p = parseArgs(type, args); if (p.error) return { code: 'invalid', why: p.error }; const err = checkCommand({ state: S, by }, { type, args: p.args }); if (!err) camp(type, p.args, by); return err; };
  camp('area.create', { id: 'area_inn00001', name: 'Inn', visibility: 'gm' });
  camp('area.create', { id: 'area_crypt001', name: 'Crypt', visibility: 'open' });
  camp('area.create', { id: 'area_road0001', name: 'Road' });
  eq(S.areaOrder.map(a => S.areas[a].visibility), ['open', 'hidden', 'hidden'], 'the first area of a campaign is open; every area created after it starts hidden, whatever the sender asked for');
  camp('seat.create', { id: GM, kind: 'human', role: 'gm', name: 'Harry', location: 'area_inn00001' });
  camp('seat.create', { id: P1, kind: 'human', role: 'player', name: 'Mira', location: 'area_inn00001' }, GM);
  camp('seat.create', { id: P2, kind: 'human', role: 'player', name: 'Tod', location: 'area_inn00001' }, GM);
  ok(!run(GM, 'area.visibility', { area: 'area_road0001', visibility: 'open' }) && isOpen(S.areas.area_road0001), 'the GM opens an area');
  ok(!run(GM, 'area.visibility', { area: 'area_road0001', visibility: 'gm' }) && S.areas.area_road0001.visibility === 'hidden', "an old client's 'gm' is stored as hidden");
  ok(!run(GM, 'area.visibility', { area: 'area_road0001', visibility: 'open' }), 'and opens it again');
  eq(run(P1, 'area.visibility', { area: 'area_crypt001', visibility: 'open' }), run(P1, 'area.visibility', { area: 'area_nope0001', visibility: 'open' }) && { code: 'forbidden', why: 'players cannot create areas and set their visibility' }, 'a player cannot open a hidden area (the refusal is the same for an area that does not exist)');
  ok(can(S, P1, 'travel').ok, 'players hold the travel class');
  const put = (area, e) => { S = { ...S, areas: { ...S.areas, [area]: { ...S.areas[area], entities: { ...S.areas[area].entities, [e.id]: e } } } }; };
  put('area_inn00001', { id: 'tok_mira0001', kind: 'token', name: 'Brakka', x: 2.5, z: 2.5, owner: P1 });
  put('area_inn00001', { id: 'tok_tod00001', kind: 'token', name: 'Pip', x: 7.5, z: 2.5, owner: P2 });
  put('area_inn00001', { id: 'tok_gobl0001', kind: 'token', name: 'Goblin', x: 12.5, z: 2.5, owner: null });
  put('area_inn00001', { id: 'tok_secr0001', kind: 'token', name: 'Lurker', x: 17.5, z: 2.5, owner: P1, hidden: true });
  const T = (by, id, to, from = 'area_inn00001') => checkCommand({ state: S, by }, { type: 'travel', args: { id, from, to } });
  ok(!T(P1, 'tok_mira0001', 'area_road0001'), 'a player may travel with their own pawn to an open area');
  ok(/belongs to someone else/.test(T(P1, 'tok_tod00001', 'area_road0001')?.why), "not with another player's pawn");
  ok(/belongs to someone else/.test(T(P1, 'tok_gobl0001', 'area_road0001')?.why), 'not with an NPC');
  eq(T(P1, 'tok_mira0001', 'area_crypt001'), T(P1, 'tok_mira0001', 'area_nope0001') && { code: 'invisible', why: 'no such area visible to you' }, 'travel to a hidden area is refused in the same words as an area that does not exist');
  eq(T(P1, 'tok_mira0001', 'area_nope0001')?.code, 'invisible', '(an area that does not exist: "no such area visible to you")');
  ok(/no pawn/.test(T(P1, 'tok_secr0001', 'area_road0001')?.why), "a pawn hidden from players cannot be travelled by a player (it does not exist for them)");
  // (the pawn lock was dropped on 2026-10-11: a pawn that an old save holds locked travels like any other)
  put('area_inn00001', { id: 'tok_oldlock01', kind: 'token', name: 'Held', x: 22.5, z: 2.5, owner: P1, locked: true });
  ok(!T(P1, 'tok_oldlock01', 'area_road0001'), "a legacy locked pawn travels for its owner: the pawn's own lock is gone (the GM's travel lock, next, is not)");
  ok(!run(GM, 'campaign.set', { defaults: { travelLocked: true } }), 'the GM locks travel');
  const locked = T(P1, 'tok_mira0001', 'area_road0001');
  ok(locked?.code === 'forbidden' && /locked travel/.test(locked.why), 'locked: a player is refused, and told why', JSON.stringify(locked));
  ok(!T(GM, 'tok_mira0001', 'area_road0001'), 'locked: the GM still sends pawns');
  ok(!run(GM, 'campaign.set', { defaults: { travelLocked: null } }) && !T(P1, 'tok_mira0001', 'area_road0001'), 'unlocked again');
  ok(!run(GM, 'area.set', { area: 'area_inn00001', settings: { freeMoves: false } }) && /locked moves/.test(T(P1, 'tok_mira0001', 'area_road0001')?.why), "an area whose moves are locked cannot be left by a player's pawn");
  run(GM, 'area.set', { area: 'area_inn00001', settings: { freeMoves: null } });
  // what fill decides
  const F = (by, id, to) => REGISTRY.travel.fill(S, { id, from: 'area_inn00001', to }, by);
  ok(F(GM, 'tok_mira0001', 'area_crypt001').opens === true, "the GM sending a player's pawn into a hidden area opens it");
  ok(F(GM, 'tok_gobl0001', 'area_crypt001').opens === undefined, 'an NPC goes into a hidden area quietly: the area stays hidden');
  ok(F(GM, 'tok_mira0001', 'area_road0001').opens === undefined && F(P1, 'tok_mira0001', 'area_road0001').opens === undefined, 'nothing to open when the area is open already');
  ok(Number.isFinite(F(P1, 'tok_mira0001', 'area_road0001').x) && parseArgs('travel', { id: 'tok_mira0001', from: 'area_inn00001', to: 'area_road0001', x: 99, z: 99, opens: true, hide: true }).args.x === undefined, 'where a pawn arrives, and whether the area opens, are never the sender\'s to say');
  ok(parseArgs('transfer', { id: 'tok_mira0001', from: 'area_inn00001', to: 'area_road0001', hide: true, open: true }).args.hide === undefined, 'no seat can send a transfer that hides or opens an area');
  // the projection: one filter
  const pv = projectCampaign(S, P1), gv = projectCampaign(S, GM);
  eq(pv.areas.map(a => a.id), ['area_inn00001', 'area_road0001'], 'a player is sent only the open areas');
  eq(gv.areas.map(a => a.visibility), ['open', 'hidden', 'open'], 'the GM is sent every area, each marked open or hidden');
  camp('seat.locate', { who: P2, area: 'area_crypt001' }, GM);
  const pv2 = projectCampaign(S, P2);
  ok(pv2.my.location === null && !JSON.stringify(pv2).includes('area_crypt001') && !JSON.stringify(projectCampaign(S, P1)).includes('area_crypt001'), 'a seat the GM put in a hidden area: neither that seat nor anyone else on the player side is sent the area id');
  eq(checkCommand({ state: S, by: P1 }, { type: 'seat.locate', args: { area: 'area_crypt001' } }), checkCommand({ state: S, by: P1 }, { type: 'seat.locate', args: { area: 'area_nope0001' } }) && { code: 'invalid', why: 'no such area visible to you' }, 'going to a hidden area answers like a missing one');
}

// =====================================================================================================================
// 2. THE RELAY: real sockets, the GET API, a player's traffic kept whole
// =====================================================================================================================
const dataDir = tmp('tw-areas-');
let relay = await startRelay({ port: 0, dataDir, log: quiet });
const base = `http://127.0.0.1:${relay.port}`;
const post = (p, b) => fetch(base + p, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const PLAYER_TRAFFIC = []; // every socket message a player-side seat received, and every GET answer, as text
const rawGet = (p) => fetch(base + p).then(async r => ({ status: r.status, text: await r.text() }));
const get = async (p, { player = false } = {}) => { const r = await rawGet(p); if (player) PLAYER_TRAFFIC.push(`GET ${p.split('?')[0]} -> ${r.status} ${r.text}`); let body = r.text; try { body = JSON.parse(r.text); } catch { } return { status: r.status, body }; };
function client(token, { player = false } = {}) {
  const ev = { pres: [], nacks: [], acks: [], camp: null, hidden: [], msgs: [] };
  const c = new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onPresence: (m) => ev.pres.push(m), onNack: (m) => ev.nacks.push(m), onAck: (m) => ev.acks.push(m), onCampaign: (v) => { ev.camp = v; } });
  const raw = c.onMessage.bind(c);
  c.onMessage = (m) => { ev.msgs.push(m); if (m.t === 'hidden') ev.hidden.push(m.area); if (player) PLAYER_TRAFFIC.push(JSON.stringify(m)); raw(m); };
  c.ev = ev; c.connect();
  return c;
}
const acked = async (c, cid) => { await waitFor(() => c.ev.acks.some(a => a.cid === cid) || c.ev.nacks.some(n => n.cid === cid), 4000, 'ack'); return c.ev.acks.find(a => a.cid === cid) || { nack: c.ev.nacks.find(n => n.cid === cid) }; };
const doCmd = (c, type, args, area = null) => acked(c, c.submit(type, args, area));

const C = await post('/campaigns', { name: 'Areas test', gm: 'Harry' });
const INN = C.area, cp = `/c/${C.campaign}`;
const gm = client(C.token);
await waitFor(() => gm.status === 'live'); gm.subscribe(INN); await waitFor(() => gm.view(INN));
ok(gm.campaign.areas.length === 1 && gm.campaign.areas[0].visibility === 'open', 'a new campaign: its first area is open');
const seat = async (name, id) => (await doCmd(gm, 'seat.create', { id, kind: 'human', role: 'player', name, color: '#6fc36f' })).token;
const miraTok = await seat('Mira', 'seat_mira0001'), todTok = await seat('Tod', 'seat_tod00001');
const mira = client(miraTok, { player: true }), tod = client(todTok, { player: true });
await waitFor(() => mira.status === 'live' && tod.status === 'live'); mira.subscribe(INN); tod.subscribe(INN); await waitFor(() => mira.view(INN) && tod.view(INN));
// Mira's AI seat: sees what Mira sees, and nothing else
const ai = await doCmd(mira, 'seat.create', { id: 'seat_miraai01', kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: ['token.move', 'chat', 'travel'] } });
const aiTok = ai.token;
ok(!!aiTok, "the player's AI seat is created (with the travel class)");

// the Inn: a room, Mira's pawn, Tod's pawn, an NPC
await doCmd(gm, 'room.spawn', { id: 'room_inn00001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 7 }, INN);
await doCmd(gm, 'token.create', { id: 'tok_brakka01', name: 'Brakka', x: 12.5, z: 7.5, owner: 'seat_mira0001' }, INN);
await doCmd(gm, 'token.create', { id: 'tok_pip00001', name: 'Pip', x: 17.5, z: 7.5, owner: 'seat_tod00001' }, INN);
await doCmd(gm, 'token.create', { id: 'tok_keeper01', name: 'Innkeeper', x: 22.5, z: 7.5 }, INN);

// ---- A. every later area starts hidden ----
const CRYPT = 'area_zxqcrypt1', CRYPT_NAME = 'Zxqvault of Morrowgloom', ROAD = 'area_road00001';
await doCmd(gm, 'area.create', { id: CRYPT, name: CRYPT_NAME, visibility: 'open' }); // an old client asking for "open" gets hidden all the same
await doCmd(gm, 'area.create', { id: ROAD, name: 'The Road' });
eq(gm.campaign.areas.map(a => a.visibility), ['open', 'hidden', 'hidden'], 'every area created after the first starts hidden (even when the sender asks for open); the GM is told which are hidden');
await doCmd(gm, 'area.visibility', { area: ROAD, visibility: 'open' });
await waitFor(() => mira.campaign.areas.length === 2);
eq(mira.campaign.areas.map(a => a.id), [INN, ROAD], "a player's area list: the open areas only");
gm.subscribe(CRYPT); gm.subscribe(ROAD); await waitFor(() => gm.view(CRYPT) && gm.view(ROAD));
await doCmd(gm, 'room.spawn', { id: 'room_road0001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 3 }, ROAD);

// ---- B. hidden means hidden everywhere: the GM works in the crypt while the players watch ----
await doCmd(gm, 'room.spawn', { id: 'room_zxqcr001', type: 'common', x: 0, z: 0, w: 8, d: 6, seed: 11 }, CRYPT);
await doCmd(gm, 'token.create', { id: 'tok_zxqlich1', name: 'Zxqlich the Unseen', x: 12.5, z: 12.5 }, CRYPT);
await doCmd(gm, 'chat.say', { id: 'chat_zxq00001', text: 'zxqwhisper in the dark' }, CRYPT);
await doCmd(gm, 'seat.locate', { area: CRYPT }); // the GM goes there
for (let i = 0; i < 6; i++) { gm.presence(CRYPT, { cursor: [10 + i, 10], sel: ['tok_zxqlich1'] }); await sleep(15); }
gm.presence(CRYPT, { cursor: [12, 12], ping: true }); // a ping in the hidden area
// the GM sends an NPC from the open Inn into the hidden crypt: a plain transfer, the area stays hidden
await doCmd(gm, 'transfer', { id: 'tok_keeper01', from: INN, to: CRYPT, x: 22.5, z: 12.5 });
await waitFor(() => !mira.view(INN).entities.tok_keeper01, 3000, 'the innkeeper leaves');
// picture of the crypt
const webp = (n) => { const b = Buffer.alloc(n); b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(n - 8, 4); b.write('WEBP', 8, 'ascii'); return b; };
await fetch(`${base}${cp}/a/${CRYPT}/thumb?seat=${C.token}`, { method: 'POST', headers: { 'content-type': 'image/webp' }, body: webp(1024) });
// what a player tries
mira.subscribe(CRYPT); mira.subscribe('area_nosuch001');
await waitFor(() => mira.ev.hidden.includes(CRYPT) && mira.ev.hidden.includes('area_nosuch001'), 3000, 'refused subscriptions');
ok(!mira.view(CRYPT), 'viewing (main view or picture-in-picture: both are a subscription): refused');
eq(mira.ev.msgs.filter(m => m.t === 'hidden' && m.area === CRYPT).map(m => Object.keys(m).sort()), mira.ev.msgs.filter(m => m.t === 'hidden' && m.area === 'area_nosuch001').map(m => Object.keys(m).sort()), 'subscribing to a hidden area answers exactly like an area that does not exist');
const same = async (mk, what) => { const a = await mk(CRYPT), b = await mk('area_nosuch001'); eq([a.status, JSON.stringify(a.body).replaceAll(CRYPT, 'X')], [b.status, JSON.stringify(b.body).replaceAll('area_nosuch001', 'X')], what); return a; };
for (const [who, tok] of [['the player', miraTok], ["the player's AI seat", aiTok]]) {
  const st = await same((a) => get(`${cp}/a/${a}/state?seat=${tok}`), `${who} reading the hidden area: the same answer as an area that does not exist`);
  ok(st.status === 404 && st.body.code === 'invisible', `${who}: 404, invisible`);
  await same((a) => get(`${cp}/a/${a}/look?x=10&z=10&r=50&seat=${tok}`), `${who} looking into it: the same`);
  await same((a) => get(`${cp}/a/${a}/changes?after=0&wait=0&seat=${tok}`), `${who} following it: the same`);
  await same((a) => get(`${cp}/a/${a}/do?cmd=chat.say&text=hello&nonce=n${who.length}&seat=${tok}`), `${who} acting in it: the same`);
  await same((a) => get(`${cp}/do?cmd=travel&id=tok_brakka01&from=${INN}&to=${a}&nonce=t${who.length}&seat=${tok}`), `${who} travelling to it: the same`);
  const cs = await get(`${cp}/state?seat=${tok}`, { player: true });
  eq(cs.body.campaign.areas.map(a => a.id), [INN, ROAD], `${who}'s reading of the campaign lists the open areas only`);
  ok(cs.body.campaign.seats.find(s => s.id === C.seat).location === null && cs.body.campaign.seats.every(s => s.elsewhere === false), `${who}: the GM, who is in the hidden area, has no location (and is not "elsewhere")`);
  const card = await get(`${cp}/card?seat=${tok}`, { player: true });
  ok(typeof card.body === 'string' && card.body.includes('The Road') && /cmd=travel/.test(card.body), `${who}'s rules card lists the open areas and the travel command`);
  await get(`${cp}/presence?seat=${tok}`, { player: true });
  await get(`${cp}/changes?kinds=chat,roll&wait=0&seat=${tok}`, { player: true });
  await get(`${cp}/thumbs?seat=${tok}`, { player: true });
  await get(`${cp}/a/${INN}/state?seat=${tok}`, { player: true });
  await get(`${cp}/a/${INN}/changes?after=0&wait=0&seat=${tok}`, { player: true });
}
{
  const img = await fetch(`${base}${cp}/a/${CRYPT}/thumb?seat=${miraTok}`), none = await fetch(`${base}${cp}/a/area_nosuch001/thumb?seat=${miraTok}`);
  ok(img.status === 404 && none.status === 404 && (await img.text()).replaceAll(CRYPT, 'X') === (await none.text()).replaceAll('area_nosuch001', 'X'), "the hidden area's picture: 404, as for an area that does not exist");
  const n1 = await doCmd(mira, 'seat.locate', { area: CRYPT }), n2 = await doCmd(mira, 'seat.locate', { area: 'area_nosuch001' });
  eq([n1.nack?.code, n1.nack?.why.replaceAll(CRYPT, 'X')], [n2.nack?.code, n2.nack?.why.replaceAll('area_nosuch001', 'X')], 'going there (world navigation): refused like a missing area');
  const t1 = await doCmd(mira, 'travel', { id: 'tok_brakka01', from: INN, to: CRYPT }), t2 = await doCmd(mira, 'travel', { id: 'tok_brakka01', from: INN, to: 'area_nosuch001' });
  ok(t1.nack && t2.nack && t1.nack.why.replaceAll(CRYPT, 'X') === t2.nack.why.replaceAll('area_nosuch001', 'X'), 'travelling there: refused like a missing area', JSON.stringify([t1, t2]));
  const out = mira.ev.msgs.filter(m => m.t === 'log').flatMap(m => m.entries).find(e => e.type === 'transfer.out' && e.args.id === 'tok_keeper01');
  ok(out && !('to' in out.args), 'a thing sent into the hidden area just leaves: the player is not told where it went', JSON.stringify(out));
  ok(!mira.ev.pres.some(p => p.area === CRYPT) && !tod.ev.pres.some(p => p.area === CRYPT), 'no cursor, selection or ping from the hidden area reaches a player');
}
// the GM's assistant sees the hidden area; a player's does not (already shown): the same filter, the other way
{
  const g = await get(`${cp}/a/${CRYPT}/state?seat=${C.token}`);
  ok(g.status === 200 && g.body.area.visibility === 'hidden' && g.body.tokens.some(t => t.name === 'Zxqlich the Unseen'), 'the GM reads the hidden area, marked hidden');
  const card = await get(`${cp}/card?seat=${C.token}`);
  ok(/HIDDEN from players/.test(card.body) && /area\.visibility/.test(card.body), "the GM's rules card marks the hidden areas and shows how to open one");
}

// ---- C. travel: players go freely, with their own pawns, to open areas ----
{
  const r = await doCmd(mira, 'travel', { id: 'tok_brakka01', from: INN, to: ROAD });
  ok(r.result?.to === ROAD && r.result.opened === false && Number.isFinite(r.result.x), 'a player travels with her own pawn to an open area; the answer says where it arrived', JSON.stringify(r));
  mira.subscribe(ROAD); await waitFor(() => mira.view(ROAD)?.entities.tok_brakka01);
  const b = mira.view(ROAD).entities.tok_brakka01;
  eq([b.x, b.z, b.y ?? 0], [r.result.x, r.result.z, r.result.y], 'the pawn is in the other area, where the relay put it');
  ok(b.x % 5 === 2.5 && b.z % 5 === 2.5 && gm.view(ROAD).entities.room_road0001 && b.z > 20 && b.z <= 40 && b.x > 0 && b.x < 30 && !b.y, 'arrival with no mark and no party there: out on open ground to the south of the building (not in the room), on the centre of a square', JSON.stringify([b.x, b.z]));
  ok(!mira.view(INN).entities.tok_brakka01 && !gm.view(INN).entities.tok_brakka01, 'and gone from the first');
  const o = gm.ev.msgs.filter(m => m.t === 'log').flatMap(m => m.entries).find(e => e.type === 'transfer.out' && e.args.id === 'tok_brakka01');
  ok(o && o.by === 'seat_mira0001' && o.args.to === ROAD, "the GM is told who travelled and where to (the undo chip's material)");
  // Tod follows: he lands beside Brakka, on a free square
  const r2 = await doCmd(tod, 'travel', { id: 'tok_pip00001', from: INN, to: ROAD });
  ok(Math.max(Math.abs(r2.result.x - b.x), Math.abs(r2.result.z - b.z)) === 5, 'the next traveller arrives beside the party pawn already there', JSON.stringify(r2.result));
  // not someone else's pawn, not an NPC
  const n1 = await doCmd(mira, 'travel', { id: 'tok_pip00001', from: ROAD, to: INN });
  ok(/belongs to someone else/.test(n1.nack?.why || ''), "a player cannot travel another player's pawn");
  // the GM's undo of a player's travel: "Brakka went to the Road · [Bring back]"
  const u = await acked(gm, gm.submitRaw({ type: 'undo', area: INN, args: { who: 'seat_mira0001', seq: o.seq } }));
  await waitFor(() => gm.view(INN).entities.tok_brakka01);
  const back = gm.view(INN).entities.tok_brakka01;
  ok(!u.nack && back && back.x === 12.5 && back.z === 7.5 && !gm.view(ROAD).entities.tok_brakka01, "the GM's undo brings the pawn back to exactly where it stood", JSON.stringify(back));
  // the AI seat travels its player's pawn, over GET
  const g = await get(`${cp}/do?cmd=travel&id=tok_brakka01&from=${INN}&to=${ROAD}&nonce=aitravel1&seat=${aiTok}`, { player: true });
  ok(g.body.ok && g.body.result.to === ROAD, "the player's AI seat travels the player's pawn over GET");
}

// ---- D. the GM locks travel ----
{
  await doCmd(gm, 'campaign.set', { defaults: { travelLocked: true } });
  await waitFor(() => mira.campaign.defaults.travelLocked === true);
  ok(mira.campaign.defaults.travelLocked === true, 'the lock reaches the players (their travel entry can say so)');
  const n = await doCmd(mira, 'travel', { id: 'tok_brakka01', from: ROAD, to: INN });
  ok(n.nack?.code === 'forbidden' && /locked travel/.test(n.nack.why), 'locked: a player is refused, with the reason', JSON.stringify(n));
  const un = await acked(mira, mira.submitRaw({ type: 'undo', area: ROAD, args: {} }));
  ok(un.nack || gm.view(ROAD).entities.tok_brakka01, 'locked: a player cannot get round it by undoing an earlier travel', JSON.stringify(un));
  const g = await get(`${cp}/do?cmd=travel&id=tok_brakka01&from=${ROAD}&to=${INN}&nonce=aitravel2&seat=${aiTok}`, { player: true });
  ok(g.body.ok === false && g.body.code === 'forbidden', 'locked: nor the AI seat');
  const r = await doCmd(gm, 'travel', { id: 'tok_pip00001', from: ROAD, to: INN });
  ok(r.result?.to === INN, 'locked: the GM still moves pawns between areas');
  await doCmd(gm, 'campaign.set', { defaults: { travelLocked: false } });
  await waitFor(() => mira.campaign.defaults.travelLocked === false);
  const y = await doCmd(mira, 'travel', { id: 'tok_brakka01', from: ROAD, to: INN });
  ok(y.result?.to === INN, 'unlocked: players travel again');
}

// ---- E. the GM sends a player's pawn into a hidden area: the pawn goes and the area opens; undo: back, and hidden again ----
{
  const before = gm.view(INN).entities.tok_brakka01;
  // an arrival mark in the crypt (an ordinary thing, hidden from players)
  await doCmd(gm, 'object.place', { id: 'obj_zxqmark01', name: 'Arrival point', place: ARRIVAL_PLACE, x: 62.5, z: 42.5, dims: [5, 0.2, 5], hidden: true }, CRYPT); // (on open ground beside the building: no furniture)
  // an NPC first: it goes in quietly
  await doCmd(gm, 'token.create', { id: 'tok_rat00001', name: 'Rat', x: 2.5, z: 2.5 }, INN);
  const q = await doCmd(gm, 'travel', { id: 'tok_rat00001', from: INN, to: CRYPT });
  ok(q.result?.opened === false && gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'hidden' && mira.campaign.areas.length === 2, 'an NPC sent into a hidden area: the area stays hidden');
  eq([q.result.x, q.result.z], [62.5, 42.5], "it arrives on the GM's arrival mark");
  // the proof, taken while the crypt has never been open: nothing a player-side seat ever received names it
  await sleep(150);
  // (left out of the search: the relay's one-word refusal of a subscription, {t:'hidden', area}, which repeats the id the
  // player's own probe sent, and is the same for an id that does not exist: shown above)
  const all = PLAYER_TRAFFIC.filter(l => !/^\{"t":"hidden","area":"[a-z0-9_]+"\}$/.test(l)).join('\n');
  ok(PLAYER_TRAFFIC.length > 60, `a player's traffic was kept (${PLAYER_TRAFFIC.length} messages and answers)`);
  for (const needle of [CRYPT, CRYPT_NAME, 'Zxq', 'zxq', 'tok_zxqlich1', 'room_zxqcr001', 'obj_zxqmark01']) ok(!all.includes(needle), `nothing a player or a player's AI seat received contains "${needle}"`, all.split('\n').find(l => l.includes(needle))?.slice(0, 300));
  ok(!PLAYER_TRAFFIC.some(l => /"elsewhere":true/.test(l)), 'and no seat was ever reported "elsewhere"');

  // now Brakka, a player's pawn
  const r = await doCmd(gm, 'travel', { id: 'tok_brakka01', from: INN, to: CRYPT });
  ok(r.result?.opened === true && r.result.to === CRYPT, "the GM sends a player's pawn into the hidden area: the answer says it opened", JSON.stringify(r));
  await waitFor(() => mira.campaign.areas.some(a => a.id === CRYPT));
  ok(mira.campaign.areas.some(a => a.id === CRYPT) && gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'open', 'the area is open: the players have it in their list');
  mira.subscribe(CRYPT); await waitFor(() => mira.view(CRYPT)?.entities.tok_brakka01);
  const b = mira.view(CRYPT)?.entities.tok_brakka01;
  ok(b && Math.max(Math.abs(b.x - 62.5), Math.abs(b.z - 42.5)) === 5 && !mira.view(CRYPT).entities.obj_zxqmark01, 'the player sees her pawn there, beside the mark (its square was taken by the rat); the mark itself is hidden from her', JSON.stringify(b));
  const o = mira.ev.msgs.filter(m => m.t === 'log').flatMap(m => m.entries).filter(e => e.type === 'transfer.out' && e.args.id === 'tok_brakka01').at(-1);
  ok(o?.args.to === CRYPT, 'now that it is open, the player is told where her pawn went (her "Follow" offer)');
  // ONE undo: the pawn comes back AND the area is hidden again
  mira.ev.hidden.length = 0;
  const u = await acked(gm, gm.submitRaw({ type: 'undo', area: INN, args: { seq: r.result.seq } }));
  await waitFor(() => gm.view(INN).entities.tok_brakka01 && gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'hidden');
  const back = gm.view(INN).entities.tok_brakka01;
  eq([!u.nack, back?.x, back?.z, gm.campaign.areas.find(a => a.id === CRYPT).visibility], [true, before.x, before.z, 'hidden'], 'one undo: the pawn is back exactly where it stood, and the area is hidden again');
  await waitFor(() => mira.ev.hidden.includes(CRYPT) && mira.campaign.areas.length === 2);
  ok(mira.ev.hidden.includes(CRYPT) && mira.campaign.areas.length === 2 && !mira.view(CRYPT), 'the player is put out of it: no list entry, no view');
  const st = await get(`${cp}/a/${CRYPT}/state?seat=${aiTok}`);
  ok(st.status === 404, "and her AI seat cannot read it any more");
  // redo opens it again; undo hides it again (the rule holds both ways)
  await acked(gm, gm.submitRaw({ type: 'redo', area: INN, args: {} }));
  await waitFor(() => gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'open' && gm.view(CRYPT).entities.tok_brakka01);
  ok(gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'open' && gm.view(CRYPT).entities.tok_brakka01, 'redo: the pawn goes again and the area opens again');
  await acked(gm, gm.submitRaw({ type: 'undo', area: INN, args: {} }));
  await waitFor(() => gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'hidden' && gm.view(INN).entities.tok_brakka01);
  ok(gm.campaign.areas.find(a => a.id === CRYPT).visibility === 'hidden' && gm.view(INN).entities.tok_brakka01, 'and undo once more: back, hidden');
  // the GM hides an open area with a player in it
  await doCmd(mira, 'seat.locate', { area: ROAD });
  await doCmd(gm, 'area.visibility', { area: ROAD, visibility: 'hidden' });
  await waitFor(() => mira.campaign.areas.length === 1);
  ok(mira.campaign.areas.length === 1 && mira.campaign.my.location === null && mira.ev.hidden.includes(ROAD), 'the GM hides an open area again: the players in it lose it at once, and are told no id for where they "are"');
  await doCmd(gm, 'area.visibility', { area: ROAD, visibility: 'open' });
}

// ---- durability: a restart reads the same campaign (visibility, the travel, the undo and its hide) ----
{
  const before = stableStringify(relay.campaigns.get(C.campaign).state);
  gm.close?.(); mira.close?.(); tod.close?.();
  await relay.close();
  const rt = new CampaignRuntime({ id: C.campaign, dir: path.join(dataDir, C.campaign), tokens: makeTokens('x'), log: quiet });
  // from the journal alone (no snapshot), then as the relay would (snapshot + tail)
  const snapF = path.join(dataDir, C.campaign, 'snapshot.json'), keep = fs.readFileSync(snapF);
  fs.rmSync(snapF); rt.load(); rt.journal.close();
  ok(stableStringify(rt.state) === before, 'replaying the journal from the start gives the same campaign (open / hidden, where every pawn is)');
  fs.writeFileSync(snapF, keep);
  const rt2 = new CampaignRuntime({ id: C.campaign, dir: path.join(dataDir, C.campaign), tokens: makeTokens('x'), log: quiet }); rt2.load(); rt2.journal.close();
  ok(stableStringify(rt2.state) === before, 'and so does the snapshot');
}

// =====================================================================================================================
// 3. MIGRATION: no saved campaign changes what its players can see
// =====================================================================================================================
{
  const live = corpusDir(); // the frozen corpus of real saved campaigns (test/corpus.mjs)
  const { execFileSync } = await import('node:child_process');
  const BASE = 'bb14488', old = path.join(HERE, '..', 'node_modules', '.cache', `tw-pre-areas-${BASE}`);
  let Old = null, oldPerms = null, oldState = null;
  try {
    if (!fs.existsSync(path.join(old, 'relay', 'campaign.js'))) {
      fs.mkdirSync(old, { recursive: true });
      const tar = execFileSync('git', ['-C', path.join(HERE, '..'), 'archive', BASE, 'core', 'relay'], { maxBuffer: 1 << 28 });
      execFileSync('tar', ['-x', '-C', old], { input: tar });
      if (!fs.existsSync(path.join(old, 'node_modules'))) fs.symlinkSync(fs.realpathSync(path.join(HERE, '..', 'node_modules')), path.join(old, 'node_modules'));
    }
    Old = (await import(path.join(old, 'relay', 'campaign.js'))).CampaignRuntime;
    oldPerms = await import(path.join(old, 'core', 'perms.js')); oldState = await import(path.join(old, 'core', 'state.js'));
  } catch (e) { console.log(`  (the code before this change is not available from git: ${e.message.split('\n')[0]}; comparison skipped)`); }
  const tokens = makeTokens('test-secret');
  const copy = (d) => { const t = path.join(tmp('tw-areasmig-'), d); fs.mkdirSync(t, { recursive: true }); for (const f of ['journal.jsonl', 'snapshot.json']) if (fs.existsSync(path.join(live, d, f))) fs.copyFileSync(path.join(live, d, f), path.join(t, f)); return t; };
  let n = 0, pairs = 0, hiddenAreas = 0, multi = 0, skipped = 0; const kinds = {};
  for (const d of Old && fs.existsSync(live) ? fs.readdirSync(live).filter(d => d.startsWith('cmp_')) : []) {
    let A, B;
    try { B = new CampaignRuntime({ id: d, dir: copy(d), tokens, log: quiet }); B.load(); B.journal.close(); } catch (e) { ok(false, `${d}: loads with today's code (${e.message})`); continue; }
    try { A = new Old({ id: d, dir: copy(d), tokens, log: quiet }); A.load(); A.journal.close(); } catch (e) { skipped++; continue; } // (a campaign made after this change may use `travel`: the old code cannot read it)
    for (const dd of madeDirs.splice(-2)) fs.rmSync(dd, { recursive: true, force: true });
    (await import('../core/migrate.js')).migrateStairs(A); // (2026-10-11: old stairs are converted on load, core/migrate.js; the conversion has its own test, stairs.test.mjs. Everything else must still be identical.)
    const same = stableStringify(A.state) === stableStringify(B.state);
    if (!same) { ok(false, `${d} ("${B.state.name}"): the stored campaign is byte-identical before and after`); continue; }
    n++; if (B.state.areaOrder.length > 1) multi++;
    let bad = null;
    for (const a of B.state.areaOrder) {
      kinds[B.state.areas[a].visibility] = (kinds[B.state.areas[a].visibility] || 0) + 1;
      if (!isOpen(B.state.areas[a])) hiddenAreas++;
      for (const s of Object.values(B.state.seats)) { pairs++; if (canSee(B.state, s.id, a) !== oldPerms.canSee(A.state, s.id, a)) bad = `${s.name} (${s.role}) and "${B.state.areas[a].name}": ${oldPerms.canSee(A.state, s.id, a)} before, ${canSee(B.state, s.id, a)} now`; }
    }
    for (const s of Object.values(B.state.seats)) {
      const was = oldState.projectCampaign(A.state, s.id), now = projectCampaign(B.state, s.id);
      if (JSON.stringify(was?.areas.map(a => a.id)) !== JSON.stringify(now?.areas.map(a => a.id))) bad = `${s.name}'s area list changed`;
    }
    if (bad) ok(false, `${d} ("${B.state.name}"): ${bad}`);
  }
  if (Old) {
    ok(n > 0, `saved campaigns compared (${n})`);
    console.log(`  (${n} real campaigns: stored state byte-identical; ${pairs} seat × area pairs see exactly what they saw; stored visibilities ${JSON.stringify(kinds)}; ${hiddenAreas} areas read as hidden, ${multi} campaigns with more than one area${skipped ? `; ${skipped} made after the change left out` : ''})`);
  }
}

console.log(`areas: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
