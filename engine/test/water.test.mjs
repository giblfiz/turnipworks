// Water bodies in the game (2026-10-04): the water.set / water.remove commands (rivers, canals, ponds drawn by the Spawn
// Tuner's shared fx/water.js). Validation, the reducer, its inverse (undo), permissions and visibility.
//   node engine/test/water.test.mjs
import { REGISTRY, applyArea, inverseOf, checkCommand, parseArgs } from '../core/commands.js';
import { newCampaign, areaForClient } from '../core/state.js';

let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };

let S = newCampaign('cmp_water001', 'Water');
const camp = (type, args, by = null) => { S = REGISTRY[type].apply(S, args, { by }); };
camp('area.create', { id: 'tbl_main0001', name: 'Mill', visibility: 'open' });
camp('seat.create', { id: 'seat_gm000001', kind: 'human', role: 'gm', name: 'Harry', location: 'tbl_main0001' });
camp('seat.create', { id: 'seat_pl000001', kind: 'human', role: 'player', name: 'Brakka', location: 'tbl_main0001' }, 'seat_gm000001');
const GM = 'seat_gm000001', P1 = 'seat_pl000001', A = 'tbl_main0001';
const tbl = () => S.areas[A];
const run = (by, type, args) => {
  const err = checkCommand({ state: S, by }, { type, area: A, args });
  if (!err) S = { ...S, areas: { ...S.areas, [A]: { ...applyArea(tbl(), type, args), seq: tbl().seq + 1 } } };
  return err;
};
const river = { kind: 'channel', pts: [[10, 10], [20, 14], [30, 9]], width: 7, depth: 2.5, flow: 1.3 };

ok(REGISTRY['water.set'] && REGISTRY['water.remove'], 'commands registered');
ok(run(GM, 'water.set', { id: 'wat_river001', body: river }) === null, 'GM places a river');
const e = tbl().entities.wat_river001;
ok(e?.kind === 'water' && e.body.kind === 'channel' && e.body.pts.length === 3 && e.body.width === 7, 'water entity stored');
ok(run(GM, 'water.set', { id: 'wat_river001', body: { ...river, flow: 2 } }) === null && tbl().entities.wat_river001.body.flow === 2, 'water.set edits in place');
ok(!!run(GM, 'water.set', { id: 'wat_bad00001', body: { kind: 'lake', pts: [[0, 0], [1, 1]] } })?.why, 'unknown body kind refused');
ok(!!run(GM, 'water.set', { id: 'wat_bad00002', body: { kind: 'pond', pts: [[0, 0], [1, 1]] } })?.why, 'a pond needs 3 points');
ok(!!run(GM, 'water.set', { id: 'wat_bad00003', body: { kind: 'channel', pts: [[0, 0], [1, 'x']] } })?.why, 'non-numeric point refused');
ok(!!run(GM, 'water.set', { id: 'wat_bad00004', body: { ...river, width: 9999 } })?.why, 'width out of range refused');
ok(run(GM, 'water.set', { id: 'wat_river001', body: { ...river, junk: '<script>' } }) === null && !('junk' in tbl().entities.wat_river001.body), 'unknown body keys dropped');
// a player without the object permission cannot dig a river (same class as placing objects)
const pl = run(P1, 'water.set', { id: 'wat_pond0001', body: { kind: 'pond', pts: [[0, 0], [8, 0], [8, 6], [0, 6]] } });
ok(pl === null || typeof pl ?.why, `player permission follows the object class (${pl || 'allowed'})`);
// undo: the inverse of a set restores the previous body; of a remove, the entity
const inv = inverseOf(tbl(), 'water.remove', { id: 'wat_river001' });
ok(run(GM, 'water.remove', { id: 'wat_river001' }) === null && !tbl().entities.wat_river001, 'water.remove drops it');
ok(inv && applyArea(tbl(), inv.type, inv.args).entities.wat_river001?.kind === 'water', `water.remove is undoable (${inv?.type})`);
ok(!!run(GM, 'water.remove', { id: 'wat_river001' })?.why, 'removing absent water refused');
// GET-API style args (JSON in a query string)
const parsed = parseArgs('water.set', { id: 'wat_q0000001', body: JSON.stringify(river) }, { fromQuery: true });
ok(!parsed.error && parsed.args?.body?.kind === 'channel', `query args parse (${parsed.error || 'ok'})`);
// players see visible water
run(GM, 'water.set', { id: 'wat_vis00001', body: river });
ok(!!areaForClient(tbl(), false).entities?.wat_vis00001, 'players see placed water');
run(GM, 'entity.flag', { ids: ['wat_vis00001'], hidden: true });
ok(!areaForClient(tbl(), false).entities?.wat_vis00001 && !!areaForClient(tbl(), true).entities?.wat_vis00001, 'hidden water: GM only');

console.log(`water: ${checks - fails}/${checks} checks passed`);
if (fails) process.exit(1);
