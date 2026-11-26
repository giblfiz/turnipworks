// A PAWN'S SIZE (2026-11-06; core/size.js, docs/PAWNS.md "A pawn's size"): the words, the check, the figure's scale, a big
// base in a narrow place (the movement rings' field and the fit test), then a real relay: two seats over the socket, undo,
// the definition's default against the pawn on the table, and an AI seat over GET.
//   node engine/test/size.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import * as SZ from '../core/size.js';
import { walkField, distanceAt, FAR } from '../core/walk.js';
import { pawnRadius } from '../core/measure.js';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const J = JSON.stringify;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(20); } return false; }

// ---- 1. the words and the check ----
const P = (t) => J(SZ.parseSize(t));
ok(P('large') === J({ squares: 2 }) && P('size huge') === J({ squares: 3 }) && P('make it gargantuan') === J({ squares: 4 }) && P('tiny') === J({ squares: 0.5 }) && P('Small') === J({ squares: 1 }) && P('medium') === J({ squares: 1 }), 'the D&D words, with "size" and "make it"', ['large', 'size huge', 'make it gargantuan', 'tiny'].map(P));
ok(P('15 ft') === J({ squares: 3 }) && P('25ft') === J({ squares: 5 }) && P('2.5 ft') === J({ squares: 0.5 }) && P('size 3') === J({ squares: 3 }) && P('3x3') === J({ squares: 3 }) && P('4 squares') === J({ squares: 4 }), 'feet, squares and 3x3');
ok(P('bigger') === J({ step: 1 }) && P('smaller') === J({ step: -1 }) && P('enlarge') === J({ step: 1 }) && P('reduce') === J({ step: -1 }) && P('make it bigger') === J({ step: 1 }), 'bigger / smaller / enlarge / reduce');
ok([P('7 ft'), P('45 ft'), P('size 9'), P('2x3'), P('pink'), P('size'), P('')].every(x => x === 'null'), 'not a size: 7 ft (not a whole square), 45 ft (past 40), 9, 2x3, pink, nothing');
ok([0.5, 1, 2, 3, 4, 5, 8].every(v => SZ.sizeProblem(v) === null) && SZ.sizeProblem(undefined) === null, 'sizes 0.5 and 1 to 8 pass (absent passes)');
ok([0, 0.25, 1.5, 9, -1, '2', NaN, Infinity, null].filter(v => v !== null).every(v => SZ.sizeProblem(v)), 'refused: 0, 0.25, 1.5, 9, -1, "2", NaN, Infinity');
ok(SZ.storedSize(1) === undefined && SZ.storedSize(2) === 2 && SZ.storedSize(0.5) === 0.5 && SZ.storedSize(1.5) === undefined && J(SZ.sizeField({ size: 3 })) === J({ size: 3 }) && J(SZ.sizeField({ size: 1 })) === '{}', 'stored: 1 is the field absent; 0.5, 2 ... kept');
ok(SZ.sizeStep(1, 1) === 2 && SZ.sizeStep(1, -1) === 0.5 && SZ.sizeStep(0.5, -1) === 0.5 && SZ.sizeStep(8, 1) === 8 && SZ.sizeStep(4, 1) === 5, 'one size bigger / smaller, and the ends hold');
ok(SZ.sizeWord(0.5) === 'tiny' && SZ.sizeWord(3) === 'huge' && SZ.sizeWord(6) === '30 ft' && SZ.sizeLabel(2) === 'large (10 ft)', 'what it is called');
ok(pawnRadius({ size: 0.5 }) === 1.25 && pawnRadius({ size: 3 }) === 7.5 && pawnRadius({}) === 2.5, 'the rules (rulers, templates, reach) read the size: tiny 1.25 ft, huge 7.5 ft');

// ---- 2. the figure is drawn at the size ----
const fighter = { size: 1, h: 6 }, dragon = { size: 2, h: 7 }, hawk = { size: 1, h: 2 };
ok(SZ.figureK(1, fighter) === 1 && SZ.figureK(2, fighter) === 2 && SZ.figureK(3, fighter) === 3 && SZ.figureK(0.5, fighter) === 0.5, 'a medium figure: twice as big large, three times huge, half tiny');
ok(SZ.figureK(2, dragon) === 1 && SZ.figureK(3, dragon) === 1.5 && SZ.figureK(1, dragon) === 0.5 && SZ.figureK(0.5, dragon) === 0.25, 'a large figure (a young dragon) scales from its own 2');
ok(SZ.figureK(0.5, hawk) === 1 && SZ.figureK(1, hawk) === 1 && SZ.figureK(2, hawk) === 2, 'a figure made tiny already (a hawk) is not shrunk again when made tiny');
ok(SZ.figureK(2, null) === 2, 'the plain stand-in counts as medium');

// ---- 3. a big base in a narrow place ----
// a wall along z = 0 from x = -20 to 40, with a gap: a 5-ft door (x 0..5) and a 10-ft opening (x 20..30)
const wall = [[-20, 0, 0, 0], [5, 0, 20, 0], [30, 0, 40, 0]];
ok(SZ.clearanceOf(1) === 0 && SZ.clearanceOf(0.5) === 0 && SZ.clearanceOf(2) === 4 && SZ.clearanceOf(3) === 6, 'clearance: none for a square or less; a large disc 4 ft, a huge 6 ft');
ok(SZ.crampedAt(2.5, 0, 2, wall) != null && SZ.crampedAt(25, 0, 2, wall) == null && SZ.crampedAt(2.5, 0, 1, wall) == null && SZ.crampedAt(25, 0, 3, wall) != null, 'large: not in the 5-ft door, yes in the 10-ft opening; medium in the door; huge not in the 10-ft opening');
ok(SZ.crampedAt(2.5, -10, 2, wall) == null && SZ.crampedAt(10, -2, 2, wall) != null, 'large: open floor fits; its disc over the wall does not');
const segs = wall.flatMap(([ax, az, bx, bz]) => [[ax, az, bx, bz]]);
const f1 = walkField({ origin: [2.5, -10], reach: 40, segments: segs }), f2 = walkField({ origin: [2.5, -10], reach: 40, segments: segs, clear: SZ.clearanceOf(2) });
const through = (F, x) => distanceAt(F, x, 10);
ok(through(f1, 2.5) < 25, 'medium: the rings go through the 5-ft door', through(f1, 2.5));
ok(through(f2, 2.5) >= FAR || through(f2, 2.5) > through(f1, 2.5) + 10, 'large: they do not (they go round by the 10-ft opening)', [through(f1, 2.5), through(f2, 2.5)]);
ok(through(f2, 25) < 45, 'large: through the 10-ft opening', through(f2, 25));
ok(J([...f1.dist]) === J([...walkField({ origin: [2.5, -10], reach: 40, segments: segs, clear: 0 }).dist]), 'clear 0 changes nothing');

// ---- 4. a real relay ----
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-size-'));
process.on('exit', () => fs.rmSync(dataDir, { recursive: true, force: true }));
const relay = await startRelay({ port: 0, dataDir, log: () => { } });
const base = `http://127.0.0.1:${relay.port}`;
const C = await fetch(`${base}/campaigns`, { method: 'POST', body: J({ name: 'Size test', gm: 'Harry' }) }).then(r => r.json());
const nacks = [];
const sync = (token) => new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => nacks.push(m), onAck: () => { }, onPresence: () => { }, onCampaign: () => { } });
const gm = sync(C.token); gm.connect(); await waitFor(() => gm.status === 'live'); gm.subscribe(C.area); await waitFor(() => gm.view(C.area));
const cp = `/c/${C.campaign}`, enc = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? J(v) : v)}`).join('&');
const gget = (p) => fetch(base + p).then(async r => (r.headers.get('content-type') || '').includes('json') ? r.json() : r.text());
const mk = await gget(`${cp}/do?cmd=seat.create&${enc({ kind: 'human', role: 'player', name: 'Mira', location: C.area })}&seat=${C.token}`);
ok(mk?.token, 'a player seat', mk);
const mira = sync(mk.token); mira.connect(); await waitFor(() => mira.status === 'live'); mira.subscribe(C.area); await waitFor(() => mira.view(C.area));
const miraId = mk.id || mk.seat || Object.values(relay.campaigns.get(C.campaign).state.seats).find(s => s.name === 'Mira')?.id;
const G = 'tok_sizegm00001', M = 'tok_sizepl00001', E = (s, id) => s.view(C.area).entities[id];
gm.submit('token.create', { id: G, name: 'Ogre', x: 7.5, z: 7.5, fig: 'foe-ogre' }, C.area);
gm.submit('token.create', { id: M, name: 'Brakka', x: 22.5, z: 7.5, owner: miraId, fig: 'hero-fighter-human-m' }, C.area);
gm.submit('token.create', { id: 'tok_sizetiny001', name: 'Imp', x: 1.25, z: 1.25, fig: 'foe-imp', size: 0.5 }, C.area);
await waitFor(() => E(gm, M) && E(gm, 'tok_sizetiny001') && gm.pendingCount() === 0);
ok(E(gm, 'tok_sizetiny001')?.size === 0.5, 'token.create takes a tiny size (0.5)');
gm.submit('token.set', { id: G, size: 3 }, C.area); await waitFor(() => gm.pendingCount() === 0);
ok(E(gm, G).size === 3, 'the GM makes the ogre huge (token.set size 3)');
ok(await waitFor(() => E(mira, G)?.size === 3, 3000), 'the player\'s seat is sent the new size', E(mira, G));
gm.undo(C.area); await waitFor(() => E(gm, G)?.size === undefined, 3000);
ok(E(gm, G).size === undefined && await waitFor(() => E(mira, G)?.size === undefined, 3000), 'undo puts it back (medium: the field absent) for both seats', [E(gm, G), E(mira, G)]);
mira.submit('token.set', { id: M, size: 2 }, C.area); await waitFor(() => mira.pendingCount() === 0);
ok(E(gm, M).size === 2 || await waitFor(() => E(gm, M)?.size === 2, 3000), 'a player makes her own pawn large', E(gm, M));
const n0 = nacks.length;
mira.submit('token.set', { id: G, size: 2 }, C.area);
for (const bad of [9, 1.5, 0, -2]) gm.submit('token.set', { id: G, size: bad }, C.area);
gm.submit('token.create', { id: 'tok_sizebad0001', name: 'Bad', x: 40, z: 40, size: 12 }, C.area);
await waitFor(() => gm.pendingCount() === 0 && mira.pendingCount() === 0); await sleep(150);
ok(nacks.length - n0 === 6 && E(gm, G).size === undefined && !E(gm, 'tok_sizebad0001'), 'refused: a player resizing the GM\'s pawn; sizes 9, 1.5, 0, -2; a create at 12', nacks.slice(n0).map(n => n.why));
ok(nacks.slice(n0 + 1).every(n => /size/.test(n.why || '')), 'and the relay says why (size: ...)', nacks.slice(n0 + 1).map(n => n.why));
// the definition holds the default; the pawn on the table its own
const D = 'def_sizedef0001', B = 'tok_sizebench01';
mira.submit('pawn.define', { id: D, name: 'Bear form', fig: 'beast-bear', size: 2 }); await waitFor(() => mira.pendingCount() === 0);
const defOf = () => relay.campaigns.get(C.campaign).state.pawns?.[D];
ok(defOf()?.size === 2, 'pawn.define keeps a size', defOf());
mira.submit('pawn.bring', { id: B, def: D, x: 35, z: 15 }, C.area); await waitFor(() => E(gm, B), 3000);
ok(E(gm, B)?.size === 2, 'brought on from the bench at the definition\'s size', E(gm, B));
mira.submit('token.set', { id: B, size: 4 }, C.area); await waitFor(() => E(gm, B)?.size === 4, 3000);
ok(E(gm, B).size === 4 && defOf().size === 2, 'resized on the table (gargantuan): the definition keeps its own', [E(gm, B)?.size, defOf()?.size]);
mira.submit('pawn.bench', { id: B }, C.area); await waitFor(() => !E(gm, B), 3000);
mira.submit('pawn.bring', { id: 'tok_sizebench02', def: D, x: 35, z: 15 }, C.area); await waitFor(() => E(gm, 'tok_sizebench02'), 3000);
ok(E(gm, 'tok_sizebench02')?.size === 2, 'back on from the bench: the definition\'s size again (the Enlarge has ended)', E(gm, 'tok_sizebench02'));
mira.submit('pawn.define', { id: D, size: 1 }); await waitFor(() => mira.pendingCount() === 0);
ok(defOf() && !('size' in defOf()), 'a definition made medium: the field goes');
// GET: an AI seat
const helper = await gget(`${cp}/do?cmd=seat.create&${enc({ kind: 'llm', name: 'Helper', scope: { areas: '*', classes: '*' } })}&seat=${C.token}`);
const aiTok = helper?.token;
if (aiTok) {
  let n = 0; const get = (v, id = G) => gget(`${cp}/a/${C.area}/do?cmd=token.set&id=${id}&size=${encodeURIComponent(v)}&nonce=sizeget${String(++n).padStart(4, '0')}&seat=${aiTok}`);
  const r1 = await get('huge'); await waitFor(() => E(gm, G)?.size === 3, 3000);
  ok(r1.ok && E(gm, G).size === 3, 'GET: size=huge', { r1, now: E(gm, G)?.size });
  const r2 = await get('bigger'); await waitFor(() => E(gm, G)?.size === 4, 3000);
  ok(r2.ok && E(gm, G).size === 4, 'GET: size=bigger, from what the pawn has', E(gm, G)?.size);
  const r3 = await get('10ft'); await waitFor(() => E(gm, G)?.size === 2, 3000);
  ok(r3.ok && E(gm, G).size === 2, 'GET: size=10ft', E(gm, G)?.size);
  const r4 = await get('tiny'); await waitFor(() => E(gm, G)?.size === 0.5, 3000);
  ok(r4.ok && E(gm, G).size === 0.5, 'GET: size=tiny', E(gm, G)?.size);
  const r5 = await get('pink'), r6 = await get('9');
  ok(!r5.ok && /size/.test(J(r5)) && !r6.ok, 'GET: size=pink, size=9: refused', [r5, r6]);
  const r7 = await gget(`${cp}/a/${C.area}/do?cmd=token.create&name=Big+goblin&fig=foe-goblin-spear&size=large&x=50&z=50&nonce=sizeget9001&seat=${aiTok}`);
  await sleep(200);
  const big = Object.values(gm.view(C.area).entities).find(e => e.name === 'Big goblin');
  ok(r7.ok && big?.size === 2, 'GET: a figure placed with size=large keeps that size (not the figure\'s own)', { r7, big });
  const scene = await gget(`${cp}/a/${C.area}/scene?seat=${aiTok}`);
  ok(/"squares":0\.5,"size":"tiny"/.test(J(scene)), 'the scene says a pawn\'s size ("squares", "size")', typeof scene === 'object' ? Object.keys(scene) : String(scene).slice(0, 200));
  const help = await gget(`${cp}/help/pawns?seat=${aiTok}`);
  ok(/SIZE/.test(typeof help === 'string' ? help : J(help)), 'help/pawns says how to set a size');
} else ok(false, 'could not make an AI seat for the GET checks', helper);
await relay.close?.();
console.log(`size: ${checks - fails}/${checks}`);
process.exit(fails ? 1 : 0);
