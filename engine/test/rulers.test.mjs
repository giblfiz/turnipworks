// Rulers and templates (docs/RULERS.md): the distance function (three rules, vertical parts, edge to edge), each
// shape's "who is caught" test, the squares; then against a real relay: a kept template's whole life (place, change,
// remove, clear, undo, save and reload), who may, rounds in the turn order and the expiry, and what a PLAYER's
// connection carries (a hidden template, a ruler into a hidden room: never).
//   node engine/test/rulers.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startRelay } from '../relay/server.js';
import { ClientSync } from '../core/client-sync.js';
import { wsTransport } from '../core/transport.js';
import * as MS from '../core/measure.js';
import * as TU from '../core/turns.js';
import { PresenceSender, PresenceView } from '../core/presence.js';
import { settingsProblem, CAMPAIGN_KEYS } from '../core/state.js';

let checks = 0, fails = 0;
const ok = (c, m, extra) => { checks++; if (!c) { fails++; console.log('FAIL', m, extra === undefined ? '' : JSON.stringify(extra)); } else if (process.env.V) console.log('ok', m); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms = 4000, what = 'condition') { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { } await sleep(15); } console.log(`  (timed out waiting for ${what})`); return false; }
const dirs = []; process.on('exit', () => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-rulers-')); dirs.push(d); return d; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

// ---------------- the distance function ----------------
{
  const P = (x, z, y = 0) => ({ x, y, z });
  let d = MS.distance(P(0, 0), P(30, 40));
  ok(near(d.ft, 50) && near(d.across, 50) && d.up === 0 && near(d.squares, 10) && d.rule === 'true', 'true distance: 30 east and 40 south is 50 ft, 10 squares', d);
  ok(MS.format(d) === '50 ft · 10 sq', 'written "50 ft · 10 sq"', MS.format(d));
  d = MS.distance(P(0, 0), P(20, 15, 15));
  ok(near(d.across, 25) && d.up === 15 && near(d.ft, Math.hypot(25, 15)), 'a vertical part: 25 across and 15 up is the true 3D distance (29.15)', d);
  ok(MS.format(d) === '29 ft · 6 sq (25 across, 15 up)', 'written with its parts', MS.format(d));
  ok(MS.format(MS.distance(P(0, 0, 10), P(0, 30, 0))) === '32 ft · 6 sq (30 across, 10 down)', 'going down says "down"', MS.format(MS.distance(P(0, 0, 10), P(0, 30, 0))));
  ok(MS.format(MS.distance(P(0, 0), P(0, 0.2))) === '0 ft · 0 sq' && MS.format(MS.distance(P(0, 0), P(3, 4, 0.3))) === '5 ft · 1 sq', 'a height difference under half a foot is not spelled out');
  // the two square-counting rules
  ok(MS.distance(P(2.5, 2.5), P(32.5, 42.5), 'five').ft === 40 && MS.distance(P(2.5, 2.5), P(32.5, 42.5), 'five').squares === 8, 'every diagonal 5 ft: 6 squares east and 8 south is 8 squares, 40 ft');
  ok(MS.distance(P(2.5, 2.5), P(32.5, 42.5), 'alt').ft === 55, 'diagonals 5 / 10: 8 + floor(6 / 2) = 11 squares, 55 ft', MS.distance(P(2.5, 2.5), P(32.5, 42.5), 'alt'));
  ok(MS.distance(P(0, 0), P(15, 15), 'alt').ft === 20 && MS.distance(P(0, 0), P(10, 10), 'alt').ft === 15 && MS.distance(P(0, 0), P(5, 5), 'alt').ft === 5, 'diagonals alternate: 1 diagonal 5, 2 diagonals 15, 3 diagonals 20');
  d = MS.distance(P(0, 0), P(20, 0, 15), 'five');
  ok(d.ft === 20 && d.across === 20 && d.up === 15, 'squares, with height: 4 across and 3 up is 4 squares under the 5-ft rule', d);
  d = MS.distance(P(0, 0), P(20, 0, 15), 'alt');
  ok(d.ft === 25 && d.across === 20 && d.up === 15, '... and 4 + floor(3 / 2) = 5 squares under 5 / 10', d);
  ok(MS.distance(P(0, 0), P(10, 0), 'nonsense').rule === 'true', 'an unknown rule is the true distance');
  // edge to edge
  d = MS.distance(P(2.5, 2.5), P(7.5, 2.5), 'true', { ra: 2.5, rb: 2.5 });
  ok(near(d.ft, 0), 'two pawns side by side are 0 ft apart, base edge to base edge', d);
  d = MS.distance(P(2.5, 2.5), P(32.5, 2.5), 'true', { ra: 2.5, rb: 2.5 });
  ok(near(d.ft, 25), 'six squares centre to centre is 25 ft edge to edge');
  d = MS.distance(P(2.5, 2.5), P(32.5, 2.5), 'true', { ra: 2.5, rb: 5 });
  ok(near(d.ft, 22.5), 'a large pawn (2 x 2 squares) takes 5 ft off its end');
  d = MS.distance(P(2.5, 2.5), P(22.5, 2.5, 20), 'true', { ra: 2.5, rb: 2.5 });
  ok(near(d.across, 15) && near(d.ft, 25), 'edge to edge with a flyer: 15 across after the bases, 20 up, 25 ft');
  ok(MS.distance(P(2.5, 2.5), P(7.5, 2.5), 'five', { ra: 2.5, rb: 2.5 }).ft === 5 && MS.distance(P(2.5, 2.5), P(7.5, 7.5), 'alt', { ra: 2.5, rb: 2.5 }).ft === 5, 'counting squares, two pawns side by side are 1 square = 5 ft (as those tables count)');
  ok(MS.distance(P(2.5, 2.5), P(15, 5), 'five', { ra: 2.5, rb: 5 }).ft === 10, 'counting squares to a large pawn: from its nearest square');
  ok(MS.pawnRadius({}) === 2.5 && MS.pawnRadius({ size: 2 }) === 5 && MS.pawnRadius({ size: 3 }) === 7.5, 'a pawn\'s space: 2.5 ft of radius per square of its size');
  ok(MS.format(MS.distance(P(0, 0), P(30, 40)), { units: 'm' }) === '15 m · 10 sq' && MS.feetText(5, 'm') === '1.5 m', 'a campaign in metres reads 1.5 m a square', MS.format(MS.distance(P(0, 0), P(30, 40)), { units: 'm' }));
  ok(!settingsProblem({ distance: 'alt' }, CAMPAIGN_KEYS) && !settingsProblem({ distance: 'five' }, CAMPAIGN_KEYS) && !!settingsProblem({ distance: 'manhattan' }, CAMPAIGN_KEYS), 'the rule is a campaign setting: true | five | alt');
}

// ---------------- shapes: outline, who is caught, squares ----------------
{
  const pawn = (x, z, y = 0, size = 1) => ({ x, y, z, size });
  const T = (shape, extra = {}) => MS.resolve({ shape, x: 0, z: 0, y: 0, dir: 0, size: 20, ...extra });
  // circle: a radius on the ground, one level high
  let g = T('circle');
  ok(MS.catches(g, pawn(17.5, 2.5)) && MS.catches(g, pawn(22, 0)) && !MS.catches(g, pawn(22.5, 0)) && !MS.catches(g, pawn(23, 0)), 'circle 20: a base that overlaps the rim is in; one that only touches it (centre at 22.5) is out');
  ok(MS.catches(g, pawn(5, 5, 5)) && !MS.catches(g, pawn(5, 5, 10)) && !MS.catches(g, pawn(5, 5, -10)) && MS.catches(g, pawn(5, 5, 8.9)) && !MS.catches(g, pawn(5, 5, 9)), 'circle: only that level (from its floor to 10 ft up): not the floor above, not the cellar');
  // sphere: true 3D
  g = T('sphere');
  ok(MS.catches(g, pawn(5, 5, 10)) && MS.catches(g, pawn(5, 5, -10)) && MS.catches(g, pawn(0, 0, 19.9)) && !MS.catches(g, pawn(0, 0, 20)) && !MS.catches(g, pawn(15, 0, 16.5)), 'sphere 20: reaches the floor above and below and a flyer; a true radius');
  ok(MS.catches(g, pawn(22, 0, 0)) && !MS.catches(g, pawn(22, 0, 12)), 'sphere: the base\'s nearest point, in 3D');
  // cone: as wide as it is long at any point
  g = T('cone', { size: 30 });
  ok(MS.catches(g, pawn(20, 0)) && MS.catches(g, pawn(20, 9)) && MS.catches(g, pawn(20, 12)) && !MS.catches(g, pawn(20, 13.5)) && !MS.catches(g, pawn(-3, 0)) && !MS.catches(g, pawn(33, 0)) && MS.catches(g, pawn(32, 0)), 'cone 30 pointing east: half as wide each side as the distance from the origin, flat at 30 ft');
  ok(MS.catches(g, pawn(20, 0, 10)) && !MS.catches(g, pawn(20, 0, 12)) && !MS.catches(g, pawn(3, 0, 5)), 'cone: it opens upward too (a flyer 10 ft up at 20 ft out is in; one near the origin is not)');
  ok(MS.catches(T('cone', { size: 30, dir: Math.PI / 2 }), pawn(0, 20)) && !MS.catches(T('cone', { size: 30, dir: Math.PI / 2 }), pawn(20, 0)), 'cone: its direction (dir = quarter turn points south)');
  // line: a length and a width
  g = T('line', { size: 60 });
  ok(MS.catches(g, pawn(30, 0)) && MS.catches(g, pawn(30, 4.9)) && !MS.catches(g, pawn(30, 5)) && !MS.catches(g, pawn(63, 0)) && MS.catches(g, pawn(62, 0)) && !MS.catches(g, pawn(30, 0, 10)), 'line 60 (5 ft wide): bases that overlap the 5-ft band, on its level');
  ok(MS.catches(T('line', { size: 60, width: 10 }), pawn(30, 7)) && !MS.catches(g, pawn(30, 7)), 'line: a wider one catches further out');
  // cube: origin on a face
  g = T('cube', { size: 15 });
  ok(MS.catches(g, pawn(7.5, 0)) && MS.catches(g, pawn(7.5, 9)) && !MS.catches(g, pawn(7.5, 10)) && !MS.catches(g, pawn(-2.5, 0)) && MS.catches(g, pawn(17, 0)) && !MS.catches(g, pawn(17.5, 0)), 'cube 15: the origin is the middle of its near face; 7.5 ft each side, 15 ft deep');
  ok(MS.catches(g, pawn(7.5, 0, 10)) && !MS.catches(g, pawn(7.5, 0, 15)) && !MS.catches(g, pawn(7.5, 0, -5)), 'cube: as tall as its side');
  ok(MS.catches(T('circle'), pawn(24, 0, 0, 2)) && !MS.catches(T('circle'), pawn(24, 0, 0, 1)), 'a large pawn\'s wider base is caught from further out');
  // the squares
  ok(MS.cells(T('circle', { size: 10 })).length === 12 && MS.cells(T('cube', { size: 15, x: 0, z: 7.5 })).length === 9 && MS.cells(T('line', { size: 30, z: 2.5 })).length === 6, 'the squares whose centres are inside: circle 10 = 12, cube 15 = 9, line 30 = 6', [MS.cells(T('circle', { size: 10 })).length, MS.cells(T('cube', { size: 15, x: 0, z: 7.5 })).length, MS.cells(T('line', { size: 30, z: 2.5 })).length]);
  ok(MS.cells(T('circle', { size: 900 })).length === 0, 'a huge template tints no squares');
  // attached: measured from the pawn's edge
  const ents = { tok_a: { id: 'tok_a', kind: 'token', x: 12.5, z: 12.5, y: 10, size: 2 }, tok_b: { id: 'tok_b', kind: 'token', x: 27.5, z: 12.5, y: 10 }, tok_c: { id: 'tok_c', kind: 'token', x: 12.5, z: 12.5, y: 0 } };
  g = MS.resolve({ shape: 'circle', x: 0, z: 0, y: 0, size: 10, attach: 'tok_a' }, ents);
  ok(g.x === 12.5 && g.z === 12.5 && g.y === 10 && g.size === 15 && g.on, 'an aura is centred on its pawn, at the pawn\'s height, and reaches its size beyond the pawn\'s edge', g);
  ok(MS.caughtBy({ shape: 'circle', x: 0, z: 0, size: 10, attach: 'tok_a' }, ents).map(e => e.id).join() === 'tok_b', 'an aura catches the pawn beside it on its level; never its own pawn; not the one a floor below');
  g = MS.resolve({ shape: 'cone', x: 0, z: 0, size: 15, dir: 0, attach: 'tok_a' }, ents, (id) => id === 'tok_a' ? { x: 50, z: 50, y: 0 } : null);
  ok(g.x === 55 && g.z === 50 && g.y === 0 && g.size === 15, 'a cone on a pawn starts at the edge of its space, and goes where the pawn is DRAWN (a drag)', g);
  ok(MS.resolve({ shape: 'circle', x: 3, z: 4, y: 5, size: 10, attach: 'tok_gone' }, ents).x === 3, 'its pawn gone: it stays where it last stood');
  const e = MS.endOf(MS.fromEnds('cone', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 30 }));
  ok(near(e.x, 0) && near(e.z, 30), 'two ends make the same geometry (a live ruler turned into a shape)');
  ok(MS.templateName({ shape: 'cone', size: 15 }) === 'Cone 15 ft' && MS.templateName({ shape: 'cone', size: 15, name: 'Dragon breath' }) === 'Dragon breath', 'a short name');
  // a ruler in presence
  ok(MS.cleanRuler({ k: 'cone', a: [1, 2, 0], b: [3.14159, 4, 0], ap: 'tok_brakka01', bp: 'obj_x', w: 5, junk: 1 }).b[0] === 3.14 && !('bp' in MS.cleanRuler({ a: [1, 2, 0], b: [3, 4, 0], bp: 'obj_x00001' })) && MS.cleanRuler({ a: [1, 2], b: [3, 4, 0] }) === null && MS.cleanRuler({ k: 'zap', a: [1, 2, 0], b: [3, 4, 0] }).k === 'rule' && MS.cleanRuler('x') === null, 'a ruler in presence: two 3D ends, a known kind, pawn ids only');
  const sent = []; let clock = 0; const ps = new PresenceSender((p) => { sent.push(JSON.parse(JSON.stringify(p))); return true; }, { hz: 1000, now: () => (clock += 100) });
  ps.set('area_x', { cursor: [1, 2], drag: [{ id: 'tok_a', x: 1, z: 2 }] }); ps.setRuler('area_x', { k: 'rule', a: [0, 0, 0], b: [5, 5, 0] });
  ok(sent.at(-1).ruler?.b[0] === 5 && sent.at(-1).drag?.length === 1 && sent.at(-1).cursor[0] === 1, 'the sender carries a ruler beside the cursor and the drag, which stay');
  ps.set('area_x', { cursor: [3, 4], drag: null }); ok(sent.at(-1).ruler && sent.at(-1).cursor[0] === 3, '... and keeps it while the cursor moves');
  ps.setRuler('area_x', null); ok(!sent.at(-1).ruler, '... until it is taken away');
  const pv = new PresenceView(); pv.ingest({ area: 'a', seat: 's', ruler: { k: 'rule', a: [0, 0, 0], b: [1, 1, 0] } });
  ok(pv.on('a')[0]?.ruler && (pv.ingest({ area: 'a', seat: 's', cursor: [0, 0] }), pv.on('a')[0].ruler === null), 'the receiver holds a seat\'s ruler, and drops it when it stops coming');
}

// ---------------- rounds: the pure rules ----------------
{
  const tok = (id, name, extra = {}) => ({ id, kind: 'token', name, x: 0, z: 0, owner: null, ...extra });
  const tpl = (id, extra = {}) => ({ id, kind: 'template', shape: 'circle', x: 0, z: 0, y: 0, dir: 0, size: 20, owner: 'seat_mira0001', hidden: false, ...extra });
  const ents = (...es) => Object.fromEntries(es.map(e => [e.id, e]));
  const base = [tok('tok_brakka01', 'Brakka', { owner: 'seat_mira0001' }), tok('tok_zed00001', 'Zed', { owner: 'seat_kit00001' }), tok('tok_gob00001', 'Goblin 1')];
  let A = { id: 'a', entities: ents(...base, tpl('tpl_web000001', { rounds: 2, src: 'tok_zed00001', owner: 'seat_kit00001' }), tpl('tpl_plain0001')) };
  ok(TU.isTurnKey('tpl_web000001') && TU.isTplKey('tpl_web000001') && !TU.isTplKey('tok_zed00001'), 'a template\'s id is a turn key');
  let T = TU.withTemplates(A, TU.newTurns(TU.defaultOrder(A)));
  ok(JSON.stringify(T.order) === JSON.stringify(['tok_brakka01', 'tpl_web000001', 'tok_zed00001', 'kind:goblin']), 'a fight starts: the template with rounds has a row just BEFORE the pawn it was cast from; one with no rounds has none', T.order);
  A = { ...A, turns: T };
  const rows = TU.turnRows(A, { all: false });
  ok(rows.length === 4 && rows[1].tpl && rows[1].left === 2 && rows[1].rounds === 2 && !rows[1].expired && rows[1].shape === 'circle' && rows[1].owner === 'seat_kit00001', 'turnRows: a thin template row with its rounds left', rows[1]);
  const left = (a) => a.entities.tpl_web000001 ? TU.leftOf(a.entities.tpl_web000001) : 'gone';
  A = TU.advance(A, 1); ok(A.turns.at === 'tok_brakka01' && left(A) === 2, 'the first Next: Brakka; nothing counted yet');
  A = TU.advance(A, 1); ok(A.turns.at === 'tok_zed00001' && left(A) === 1, 'Next passes the row on its way to Zed: 2 → 1 (the row is nobody\'s turn)');
  A = TU.advance(A, 1); ok(A.turns.at === 'kind:goblin' && left(A) === 1, 'on to the goblins: unchanged');
  A = TU.advance(A, -1); ok(A.turns.at === 'tok_zed00001' && left(A) === 1, 'Previous that passes no row changes nothing');
  A = TU.advance(A, -1); ok(A.turns.at === 'tok_brakka01' && left(A) === 2, 'Previous back over the row gives the round back');
  A = TU.advance(TU.advance(TU.advance(A, 1), 1), 1); ok(A.turns.at === 'tok_brakka01' && A.turns.round === 2 && left(A) === 1, 'round 2 starts');
  A = TU.advance(A, 1); ok(A.turns.at === 'tok_zed00001' && left(A) === 0 && TU.turnRows(A, { all: false })[1].expired, 'its second pass: 0 left. It is still there, marked expired', left(A));
  ok(TU.forPlayers(A).order.includes('tpl_web000001'), 'players are sent the row');
  const kept = TU.advance({ ...A, entities: { ...A.entities, tpl_web000001: (({ rounds, left: _l, ...e }) => e)(A.entities.tpl_web000001) } }, 1);
  ok(kept.entities.tpl_web000001 && !TU.turnRows(kept, { all: false }).some(r => r.tpl), 'Keep (its rounds taken away): it stays, with no row');
  A = TU.advance(A, 1); ok(left(A) === 'gone' && A.turns.at === 'kind:goblin' && !TU.turnRows(A, { all: false }).some(r => r.tpl), 'nobody answered: the next time the turn moves on it is removed');
  // where the row sits without a pawn it was cast from
  let B = { id: 'b', entities: ents(...base, tpl('tpl_mine00001', { rounds: 1 }), tpl('tpl_gm0000001', { rounds: 1, owner: 'seat_gm000001' })) };
  ok(JSON.stringify(TU.withTemplates(B, TU.newTurns(TU.defaultOrder(B))).order) === JSON.stringify(['tpl_mine00001', 'tok_brakka01', 'tok_zed00001', 'kind:goblin', 'tpl_gm0000001']), 'no pawn named: before its owner\'s first pawn; an owner with no pawn in the order (the GM, before anyone\'s turn): last', TU.withTemplates(B, TU.newTurns(TU.defaultOrder(B))).order);
  ok(JSON.stringify(TU.withTemplate(B, { ...TU.newTurns(TU.defaultOrder(B)), at: 'kind:goblin' }, B.entities.tpl_gm0000001).order) === JSON.stringify(['tok_brakka01', 'tok_zed00001', 'tpl_gm0000001', 'kind:goblin']), 'the GM\'s, in a fight: before the entry whose turn it is (it counts as that turn comes round again)');
  const H = { id: 'h', entities: ents(...base, tpl('tpl_secret001', { rounds: 3, hidden: true })) };
  const HT = { ...H, turns: TU.withTemplates(H, TU.newTurns(TU.defaultOrder(H))) };
  ok(HT.turns.order.includes('tpl_secret001') && !TU.forPlayers(HT).order.includes('tpl_secret001'), 'a hidden template\'s row is the GM\'s only');
  ok(JSON.stringify(TU.tickTouches(HT)) === '["tpl_secret001"]' && TU.tickTouches(H).length === 0, 'a Next may touch every template with rounds (and none when there is no fight)');
}

// ---------------- the relay ----------------
const dataDir = tmp();
let relay = await startRelay({ port: 0, dataDir, log: () => {} });
let base = `http://127.0.0.1:${relay.port}`;
const J = (p) => fetch(base + p).then(r => r.json());
const C = await fetch(base + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'rulers', gm: 'Harry' }) }).then(r => r.json());
const A = C.area, cmp = C.campaign;
const doAs = (tok, cmd, args = {}) => J(`/c/${cmp}/a/${A}/do?cmd=${cmd}&seat=${tok}&${new URLSearchParams(Object.fromEntries(Object.entries(args).map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)])))}`);
const doGm = (cmd, args) => doAs(C.token, cmd, args);
const seatOf = async (id, name) => (await J(`/c/${cmp}/do?cmd=seat.create&id=${id}&kind=human&role=player&name=${name}&seat=${C.token}`)).token;
const miraTok = await seatOf('seat_mira0001', 'Mira'), kitTok = await seatOf('seat_kit00001', 'Kit');
const SECRET = 'tok_vamp0001', SROOM = 'room_crypt001', STPL = 'tpl_secretweb1';
for (const [id, name, extra] of [['tok_brakka01', 'Brakka', { owner: 'seat_mira0001', x: 2.5, z: 2.5 }], ['tok_zed00001', 'Zed', { owner: 'seat_kit00001', x: 12.5, z: 2.5 }], ['tok_gob00001', 'Goblin 1', { x: 22.5, z: 2.5 }], [SECRET, 'Strahd', { hidden: true, x: 102.5, z: 2.5 }]]) {
  const r = await doGm('token.create', { id, name, x: 5, z: 5, ...extra }); if (!r.ok) console.log('setup', id, r);
}
{ const r = await doGm('room.spawn', { id: SROOM, type: 'common', x: 40, z: 40, w: 6, d: 4, seed: 7 }); if (!r.ok) console.log('setup room', r); const h = await doGm('entity.flag', { ids: SROOM, hidden: true }); if (!h.ok) console.log('setup hide', h); }
const state = () => relay.campaigns.get(cmp).state.areas[A];
const rawConn = async (token) => {
  const frames = [], ws = new WebSocket(`ws://127.0.0.1:${relay.port}/ws`);
  ws.on('message', (d) => frames.push(String(d)));
  await new Promise(r => ws.on('open', r)); ws.send(JSON.stringify({ t: 'hello', token }));
  await waitFor(() => frames.some(f => f.includes('"welcome"')), 3000, 'welcome'); ws.send(JSON.stringify({ t: 'sub', area: A }));
  await waitFor(() => frames.some(f => f.includes('"snap"')), 3000, 'snap');
  return { frames, ws, send: (m) => ws.send(JSON.stringify(m)), last: (t) => frames.map(f => JSON.parse(f)).filter(m => m.t === t).at(-1) };
};
const rawMira = await rawConn(miraTok), rawGm = await rawConn(C.token), rawKit = await rawConn(kitTok);
const client = (token) => { const c = new ClientSync({ token, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket), onNack: (m) => c.nacks.push(m) }); c.nacks = []; c.connect(); return c; };
let gm = client(C.token), mira = client(miraTok), kit = client(kitTok);
await waitFor(() => [gm, mira, kit].every(c => c.status === 'live'), 5000, 'clients live');
for (const c of [gm, mira, kit]) c.subscribe(A);
await waitFor(() => [gm, mira, kit].every(c => c.view(A)), 5000, 'views');
const settle = () => waitFor(() => [gm, mira, kit].every(c => c.pendingCount() === 0 && c.view(A).seq === state().seq), 5000, 'settled');
const T = (c, id) => c.view(A).entities[id];

// place: a player, anywhere she can see; the owner is who sent it
let r = await doAs(miraTok, 'template.place', { id: 'tpl_cone00001', shape: 'cone', x: 5, z: 2.5, y: 0, dir: 0, size: 30, src: 'tok_brakka01', owner: 'seat_kit00001' });
ok(r.ok && state().entities.tpl_cone00001?.owner === 'seat_mira0001' && state().entities.tpl_cone00001.kind === 'template' && state().entities.tpl_cone00001.size === 30, 'a player places a template; it is HERS whatever the arguments say', [r, state().entities.tpl_cone00001]);
await settle();
ok(T(kit, 'tpl_cone00001')?.shape === 'cone' && T(gm, 'tpl_cone00001')?.owner === 'seat_mira0001', 'everyone at the table has it');
ok(MS.caughtBy(T(kit, 'tpl_cone00001'), kit.view(A).entities).map(e => e.id).join() === 'tok_zed00001,tok_gob00001', 'each seat works out who is caught from what it holds (Brakka is behind the origin)', MS.caughtBy(T(kit, 'tpl_cone00001'), kit.view(A).entities).map(e => e.id));
ok(!(await doAs(miraTok, 'template.place', { id: 'tok_cone00001', shape: 'cone', x: 0, z: 0, size: 30 })).ok && !(await doAs(miraTok, 'template.place', { id: 'tpl_cone00002', shape: 'hexagon', x: 0, z: 0, size: 30 })).ok && !(await doAs(miraTok, 'template.place', { id: 'tpl_cone00002', shape: 'cone', x: 0, z: 0, size: 0 })).ok && !(await doAs(miraTok, 'template.place', { id: 'tpl_cone00002', shape: 'cone', x: 0, z: 0, size: 5000 })).ok && !(await doAs(miraTok, 'template.place', { id: 'tpl_cone00001', shape: 'cone', x: 0, z: 0, size: 5 })).ok, 'refused: an id that is not tpl_…, an unknown shape, no size, an absurd size, a duplicate');
// change and remove: the owner and the GM
ok(!(await doAs(kitTok, 'template.set', { id: 'tpl_cone00001', size: 15 })).ok && !(await doAs(kitTok, 'template.delete', { id: 'tpl_cone00001' })).ok && state().entities.tpl_cone00001.size === 30, 'another player can neither change nor remove it');
r = await doAs(miraTok, 'template.set', { id: 'tpl_cone00001', shape: 'line', size: 60, dir: 1.5, width: 10 });
ok(r.ok && state().entities.tpl_cone00001.shape === 'line' && state().entities.tpl_cone00001.width === 10 && state().entities.tpl_cone00001.dir === 1.5, 'its owner turns it into a line 60 ft long and 10 wide');
r = await doGm('template.set', { id: 'tpl_cone00001', shape: 'sphere', size: 20 });
ok(r.ok && state().entities.tpl_cone00001.shape === 'sphere' && !('width' in state().entities.tpl_cone00001), 'the GM changes anyone\'s (a width belongs to a line only)');
r = await doGm('undo', {}); await settle();
ok(r.ok && state().entities.tpl_cone00001.shape === 'line' && T(mira, 'tpl_cone00001').shape === 'line', 'undo puts it back as it was');
r = await doAs(miraTok, 'template.set', { id: 'tpl_cone00001', attach: 'tok_brakka01' });
ok(r.ok && state().entities.tpl_cone00001.attach === 'tok_brakka01', 'attached to a pawn (an aura)');
ok(!(await doAs(miraTok, 'template.set', { id: 'tpl_cone00001', attach: SECRET })).ok && (await doAs(miraTok, 'template.set', { id: 'tpl_cone00001', attach: SECRET })).why === (await doAs(miraTok, 'template.set', { id: 'tpl_cone00001', attach: 'tok_nosuch001' })).why.replace('tok_nosuch001', SECRET), 'a player attaching to a hidden pawn is told what a missing pawn is told, word for word');
r = await doAs(miraTok, 'template.set', { id: 'tpl_cone00001', attach: '' }); ok(r.ok && !('attach' in state().entities.tpl_cone00001), 'and let go again');
r = await doAs(miraTok, 'template.delete', { id: 'tpl_cone00001' }); await settle();
ok(r.ok && !state().entities.tpl_cone00001 && !T(kit, 'tpl_cone00001'), 'its owner removes it: gone for everyone');
r = await doAs(miraTok, 'undo', {}); await settle();
ok(r.ok && state().entities.tpl_cone00001?.shape === 'line' && T(kit, 'tpl_cone00001'), 'and her undo brings it back');

// Keep-bar writes are shared immediately but one undo, with redo of the final combined settings.
const barId = 'tpl_keepbar01', barSession = 'keep_test01';
r = await doAs(miraTok, 'template.place', { id: barId, shape: 'circle', x: 5, z: 5, size: 8, keepSession: barSession });
await doAs(miraTok, 'template.set', { id: barId, rounds: 1, keepSession: barSession });
await doGm('token.move', { id: 'tok_gob00001', x: 22.5, z: 2.5 }); // another seat must not split the gesture
await doAs(miraTok, 'template.set', { id: barId, attach: 'tok_brakka01', keepSession: barSession });
await doAs(miraTok, 'template.set', { id: barId, rounds: 7, keepSession: barSession }); await settle();
ok(r.ok && T(kit, barId)?.rounds === 7 && T(kit, barId)?.attach === 'tok_brakka01', 'Keep-bar duration and attachment combine and every seat sees the same template');
await doGm('turn.start', {});
for (let i = 0; i < 12 && state().entities[barId].left !== 6; i++) await doGm('turn.next', {});
const turnAtKeep = state().turns.at;
await doAs(miraTok, 'template.set', { id: barId, keepSession: barSession }); await settle();
ok(state().entities[barId].left === 6, 'a sparse Keep-bar update preserves the countdown advanced by another seat');
r = await doAs(miraTok, 'undo', {}); await settle();
ok(r.ok && !T(kit, barId) && !state().entities[barId] && state().turns.at === turnAtKeep, 'one undo removes the entire Keep-bar gesture despite another seat moving a pawn and advancing turns, preserving current turn');
r = await doAs(miraTok, 'redo', {}); await settle();
ok(r.ok && T(kit, barId)?.rounds === 7 && T(kit, barId)?.attach === 'tok_brakka01', 'redo restores the final combined Keep-bar settings');
await doAs(miraTok, 'template.set', { id: barId, rounds: 3, keepSession: barSession });
await doAs(miraTok, 'undo', {}); await settle();
ok(state().entities[barId]?.rounds === 7, 'a reused Keep session after undo/redo cannot absorb unrelated later edits');
await doAs(miraTok, 'template.delete', { id: barId });
await doGm('turn.end', {});

// A different seat editing the SAME template must keep its work outside this gesture.
await doAs(miraTok, 'template.place', { id: barId, shape: 'circle', x: 5, z: 5, size: 8, keepSession: 'keep_conflict' });
await doGm('template.set', { id: barId, name: 'GM annotation' });
await doAs(miraTok, 'template.set', { id: barId, rounds: 3, keepSession: 'keep_conflict' });
await doAs(miraTok, 'undo', {}); await settle();
ok(state().entities[barId]?.name === 'GM annotation' && !state().entities[barId]?.rounds, 'an intervening edit to this template closes grouping: undo preserves the other seat’s edit');
await doAs(miraTok, 'template.delete', { id: barId });

// hidden: the GM's, in a hidden room and on a hidden pawn. Never a word to a player.
const beforeM = rawMira.frames.length;
r = await doGm('template.place', { id: STPL, shape: 'circle', x: 210, z: 210, size: 10 });
ok(!r.ok && /must be hidden/.test(r.why), 'a GM template in a hidden room that is not marked hidden is refused (the relay never lets one slip)', r);
r = await doGm('template.place', { id: STPL, shape: 'circle', x: 210, z: 210, size: 10, hidden: true, rounds: 3 });
ok(r.ok && state().entities[STPL].hidden, 'marked hidden, it is placed');
r = await doGm('template.place', { id: 'tpl_secretaur1', shape: 'circle', x: 0, z: 0, size: 10, attach: SECRET });
ok(!r.ok, 'an aura on a hidden pawn must be hidden too');
r = await doGm('template.place', { id: 'tpl_secretaur1', shape: 'circle', x: 0, z: 0, size: 10, attach: SECRET, hidden: true });
ok(r.ok, 'hidden, it is placed');
ok(!(await doAs(miraTok, 'template.place', { id: 'tpl_cheat00001', shape: 'circle', x: 0, z: 0, size: 10, hidden: true })).ok, 'a player cannot hide a template');
r = await doAs(miraTok, 'template.place', { id: 'tpl_blind00001', shape: 'circle', x: 212, z: 212, size: 10 });
ok(r.ok && state().entities.tpl_blind00001.hidden === false, 'a player who measures over ground where a hidden room stands keeps her template (she is not told the room is there)');
await doAs(miraTok, 'template.delete', { id: 'tpl_blind00001' });
await settle();
ok(!T(mira, STPL) && !T(mira, 'tpl_secretaur1') && T(gm, STPL) && T(gm, 'tpl_secretaur1'), 'the GM holds both hidden templates; the player holds neither');
const hid = await doAs(miraTok, 'template.delete', { id: STPL }), nope = await doAs(miraTok, 'template.delete', { id: 'tpl_nosuch0001' });
ok(!hid.ok && !nope.ok && hid.why.replace(STPL, 'X') === nope.why.replace('tpl_nosuch0001', 'X'), 'asked about a hidden template, a player is told what a missing one is told', [hid.why, nope.why]);
// reveal and hide cascade
r = await doGm('entity.flag', { ids: SECRET, hidden: false }); await settle();
ok(state().entities.tpl_secretaur1.hidden === false && T(mira, 'tpl_secretaur1'), 'the pawn is revealed: its aura is revealed with it');
r = await doGm('entity.flag', { ids: SECRET, hidden: true }); await settle();
ok(state().entities.tpl_secretaur1.hidden === true && !T(mira, 'tpl_secretaur1'), 'hidden again: the aura goes with it');
r = await doGm('entity.flag', { ids: SROOM, hidden: false }); await settle();
ok(state().entities[STPL].hidden === false && T(mira, STPL), 'the room is revealed: the template standing in it too');
r = await doGm('entity.flag', { ids: SROOM, hidden: true }); await settle();
ok(state().entities[STPL].hidden === true && !T(mira, STPL), 'and hidden with it');
await doGm('template.delete', { id: 'tpl_secretaur1' });

// presence: a ruler travels; one into the hidden room, or on the hidden pawn, reaches the GM side only
const pres = (raw, seat) => raw.frames.map(f => JSON.parse(f)).filter(m => m.t === 'pres' && m.seat === seat);
rawKit.send({ t: 'pres', area: A, cursor: [10, 10], ruler: { k: 'rule', a: [2.5, 2.5, 0], b: [22.5, 2.5, 0], ap: 'tok_zed00001', junk: 'x' } });
await waitFor(() => pres(rawMira, 'seat_kit00001').some(m => m.ruler), 2000, 'ruler presence');
const got = pres(rawMira, 'seat_kit00001').find(m => m.ruler)?.ruler;
ok(got && got.k === 'rule' && got.b[0] === 22.5 && got.ap === 'tok_zed00001' && !('junk' in got), 'a ruler being drawn reaches the other players as its two ends', got);
const nM = pres(rawMira, 'seat_kit00001').length;
rawKit.send({ t: 'pres', area: A, cursor: [11, 10], ruler: { k: 'circle', a: [10, 10, 0], b: [215, 215, 0] } });
await waitFor(() => pres(rawGm, 'seat_kit00001').some(m => m.ruler?.k === 'circle'), 2000, 'gm sees it');
await waitFor(() => pres(rawMira, 'seat_kit00001').length > nM, 2000, 'mira gets the cursor');
ok(pres(rawGm, 'seat_kit00001').some(m => m.ruler?.k === 'circle') && !pres(rawMira, 'seat_kit00001').some(m => m.ruler?.k === 'circle') && pres(rawMira, 'seat_kit00001').at(-1).cursor[0] === 11, 'a ruler with an end in a hidden room: the GM sees it, a player gets the cursor without it');
rawGm.send({ t: 'pres', area: A, cursor: [12, 10], ruler: { k: 'move', a: [102.5, 2.5, 0], b: [80, 2.5, 0], ap: SECRET } });
await waitFor(() => pres(rawMira, C.seat || 'seat_gm').length || pres(rawMira, state() && Object.values(relay.campaigns.get(cmp).state.seats).find(s => s.role === 'gm').id).length, 2000, 'gm cursor at mira');
const gmSeat = Object.values(relay.campaigns.get(cmp).state.seats).find(s => s.role === 'gm').id;
ok(pres(rawMira, gmSeat).length > 0 && !pres(rawMira, gmSeat).some(m => m.ruler), 'the GM dragging a hidden pawn: no travelled line for players');

// rounds in a fight
r = await doGm('turn.start'); await settle();
ok(r.ok && state().turns.order.includes(STPL) && !mira.view(A).turns.order.includes(STPL), 'Start fight: the hidden template with rounds has a row for the GM, none for a player', [state().turns.order, mira.view(A).turns.order]);
r = await doAs(kitTok, 'template.place', { id: 'tpl_web0000001', shape: 'circle', x: 20, z: 5, size: 10, rounds: 1, src: 'tok_zed00001' }); await settle();
ok(r.ok && JSON.stringify(mira.view(A).turns.order) === JSON.stringify(['tok_brakka01', 'tpl_web0000001', 'tok_zed00001', 'kind:goblin']), 'placed in a fight with rounds: its row is added at once, before its caster, on every seat', mira.view(A).turns.order);
await doGm('turn.next'); await settle();
ok(state().turns.at === 'tok_brakka01' && TU.leftOf(state().entities['tpl_web0000001']) === 1, 'Next: Brakka; still 1');
r = await doAs(miraTok, 'turn.next'); await settle();
ok(r.ok && state().turns.at === 'tok_zed00001' && state().entities['tpl_web0000001'].left === 0, 'Mira ends her turn (a hidden template in the order does not refuse her): the web is at 0, still there', [r, state().entities['tpl_web0000001']]);
ok(T(mira, 'tpl_web0000001')?.left === 0 && T(kit, 'tpl_web0000001')?.left === 0 && T(gm, 'tpl_web0000001')?.left === 0 && TU.turnRows(kit.view(A), { all: false }).find(x => x.key === 'tpl_web0000001')?.expired, 'every seat sees it expired (a player gets it inside turn.view)');
ok(TU.leftOf(state().entities[STPL]) === 3 && TU.leftOf(T(gm, STPL)) === 3, 'the hidden one (its row is last) has not been passed');
// Keep: its rounds go, it stays
r = await doAs(kitTok, 'template.set', { id: 'tpl_web0000001', rounds: 0 }); await settle();
ok(r.ok && !('rounds' in state().entities['tpl_web0000001']) && !('left' in state().entities['tpl_web0000001']) && !TU.turnRows(mira.view(A), { all: false }).some(x => x.tpl), 'Keep: no rounds, no row, still on the table');
// again, unanswered: removed when the turn moves on again
r = await doAs(kitTok, 'template.set', { id: 'tpl_web0000001', rounds: 1 }); await settle();
ok(r.ok && TU.turnRows(mira.view(A), { all: false }).find(x => x.tpl)?.left === 1, 'given 1 round again: the row is back');
await doGm('turn.next'); await doGm('turn.next'); await settle(); // goblins, then round 2: Brakka (the hidden row at the end is passed)
ok(state().turns.at === 'tok_brakka01' && state().turns.round === 2 && TU.leftOf(state().entities[STPL]) === 2, 'round 2: the hidden template counted down as the round wrapped');
await doGm('turn.next'); await settle();
ok(state().entities['tpl_web0000001'].left === 0, 'Zed\'s turn again: expired');
const framesBefore = rawMira.frames.length;
await doGm('turn.next'); await settle();
ok(!state().entities['tpl_web0000001'] && !T(mira, 'tpl_web0000001') && !T(kit, 'tpl_web0000001') && !T(gm, 'tpl_web0000001'), 'nobody answered, the turn moved on: it is removed, on every seat');
ok(!TU.turnRows(kit.view(A), { all: false }).some(x => x.tpl), 'and its row with it');
r = await doGm('turn.prev'); await settle();
ok(r.ok && state().turns.at === 'tok_zed00001' && !state().entities['tpl_web0000001'], 'Previous does not bring a removed template back');
// the GM's broom, and its undo
await doAs(miraTok, 'template.place', { id: 'tpl_a000000001', shape: 'cube', x: 0, z: 0, size: 10 }); await doAs(kitTok, 'template.place', { id: 'tpl_b000000001', shape: 'line', x: 0, z: 0, size: 30 });
ok(!(await doAs(miraTok, 'template.clear', {})).ok, 'a player cannot clear them all');
r = await doGm('template.clear', {}); await settle();
ok(r.ok && !Object.values(state().entities).some(e => e.kind === 'template') && !Object.values(mira.view(A).entities).some(e => e.kind === 'template'), 'the GM clears every template (hidden ones too)');
r = await doGm('undo', {}); await settle();
ok(r.ok && Object.values(state().entities).filter(e => e.kind === 'template').length === 4 && Object.values(mira.view(A).entities).filter(e => e.kind === 'template').length === 3, 'one undo brings them all back: four for the GM, the three a player may see', Object.values(state().entities).filter(e => e.kind === 'template').map(e => e.id));

// not a word of the hidden template, the hidden room or the hidden pawn in anything a player received
await sleep(150);
{
  // (the room and the pawn and the aura WERE revealed for a moment above, on purpose; the template in the crypt too. So
  // this is asked of a player who joins now, and of everything sent from here on.)
  const late = await rawConn(kitTok); const n0 = rawMira.frames.length;
  await doGm('template.set', { id: STPL, size: 15 }); await doGm('turn.next'); await doGm('turn.next'); await doGm('turn.next'); await settle(); await sleep(100);
  const since = rawMira.frames.slice(n0).join('\n') + late.frames.join('\n');
  ok(!since.includes(STPL) && !since.includes(SECRET) && !since.includes(SROOM), 'a player who joins now, and every frame a player gets while the GM changes the hidden template and the turn passes its row: not a word of it', [since.includes(STPL), since.includes(SECRET), since.includes(SROOM)]);
  ok(state().entities[STPL].size === 15, '(the GM did change it)');
  const st = await J(`/c/${cmp}/a/${A}/state?seat=${miraTok}`);
  ok(!JSON.stringify(st).includes(STPL), 'nor in the GET API\'s state for her');
  late.ws.close();
}

// A grouped creation also survives persisted undo history.
await doAs(miraTok, 'template.place', { id: barId, shape: 'circle', x: 5, z: 5, size: 8, keepSession: 'keep_reload' });
await doAs(miraTok, 'template.set', { id: barId, rounds: 4, attach: 'tok_brakka01', keepSession: 'keep_reload' });
await settle();

// save and reload: a restart of the relay
const keptIds = Object.values(state().entities).filter(e => e.kind === 'template').map(e => e.id).sort();
const leftBefore = TU.leftOf(state().entities[STPL]), orderBefore = JSON.stringify(state().turns.order);
for (const c of [gm, mira, kit]) c.close?.(); for (const x of [rawMira, rawGm, rawKit]) x.ws.close();
await relay.close();
relay = await startRelay({ port: 0, dataDir, log: () => {} }); base = `http://127.0.0.1:${relay.port}`;
const again = relay.campaigns.get(cmp) || (await J(`/c/${cmp}/a/${A}/state?seat=${C.token}`), relay.campaigns.get(cmp));
const st2 = again.state.areas[A];
ok(JSON.stringify(Object.values(st2.entities).filter(e => e.kind === 'template').map(e => e.id).sort()) === JSON.stringify(keptIds) && TU.leftOf(st2.entities[STPL]) === leftBefore && JSON.stringify(st2.turns.order) === orderBefore && st2.entities.tpl_a000000001.owner === 'seat_mira0001', 'after a restart of the relay the templates, their owners, the rounds left and the rows are as they were', [keptIds, leftBefore]);
const fresh = new ClientSync({ token: miraTok, transport: wsTransport(`ws://127.0.0.1:${relay.port}/ws`, WebSocket) }); fresh.connect();
await waitFor(() => fresh.status === 'live', 5000, 'fresh live'); fresh.subscribe(A); await waitFor(() => fresh.view(A), 5000, 'fresh view');
ok(fresh.view(A).entities.tpl_a000000001 && fresh.view(A).entities.tpl_b000000001 && !fresh.view(A).entities[STPL], 'a second player who joins after it sees the kept templates (and not the hidden one)');
r = await doAs(miraTok, 'undo', {});
ok(r.ok && !again.state.areas[A].entities[barId], 'after save/reload, one undo still removes the grouped creation');
fresh.close?.();
await relay.close();

console.log(`rulers: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
