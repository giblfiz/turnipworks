// Faith factions (2026-11-07, lane faith-factions; experiments/2026-11-07-faith-factions/DESIGN.md): the four real-world
// faiths appear in the same faction menu as the thirteen fantasy factions, apply to temple rooms and buildings, rebuild a
// hall whose rite changes, and NEVER dress a cult sanctum or a dark cathedral (rooms with sacrificial altars, cages, blood
// bowls, bones). Their pieces carry their own names, and nothing of theirs is named "idol".
//   node test/faith-factions.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGISTRY, parseArgs } from '../core/commands.js';
import { planFactionChange, effectiveFaction, factionAllowed, faithBarredRoom, riteChangedRooms } from '../core/factions.js';
import { factionCatalog, factionSearchItems, factionPieceName, resolveFaction, factionRowSlots, isReverent } from '../core/faction-catalog.js';
import { factionRows } from '../client/surfaces/factions.js';
const lib = JSON.parse(readFileSync(new URL('../../tools/spawn-tuner/data/library.json', import.meta.url)));
const types = JSON.parse(readFileSync(new URL('../../tools/spawn-tuner/data/rooms.json', import.meta.url)));
let checks = 0; const ok = (c, why) => { assert.ok(c, why); checks++; }, eq = (a, b, why) => { assert.deepEqual(a, b, why); checks++; };
const FAITHS = ['christian', 'buddhist', 'hindu', 'muslim'];

// ---- the four appear beside the thirteen, in the same menu, never in the sinister row
const { factions, slots } = factionCatalog(lib);
for (const f of FAITHS) ok(factions.some(x => x.id === f && x.reverent && x.group === 'faith'), `${f} is in the faction catalog`);
ok(factions.length >= 17 && ['spiders', 'sun', 'devils'].every(id => factions.some(x => x.id === id)), 'the thirteen are still there');
const [first, sinister] = factionRows(factions);
eq(first.slice(0, 4).map(f => f.id).sort(), [...FAITHS].sort(), 'the faiths lead the first picker row, together');
ok(!sinister.some(f => f.reverent), 'no faith is among the sinister factions');
for (const [q, id] of [['christian', 'christian'], ['islam', 'muslim'], ['mosque', 'muslim'], ['buddhism', 'buddhist'], ['hinduism', 'hindu'], ['Muslim', 'muslim']]) eq(resolveFaction(lib, q), id, `"${q}" names ${id}`);

// ---- names: the real ones, never "<faith> idol"; search never finds a faith piece by a fantasy slot word
eq(factionPieceName(lib, 'flavor-idol', 'flavor-idol--muslim'), 'Mihrab', 'the Muslim focus is the Mihrab');
eq(factionPieceName(lib, 'flavor-idol', 'flavor-idol--christian'), 'Crucifix', 'the Christian focus is the Crucifix');
eq(factionPieceName(lib, 'flavor-idol', 'flavor-idol--buddhist'), 'Buddha statue', 'the Buddhist focus is the Buddha statue');
eq(factionPieceName(lib, 'flavor-pulpit', 'flavor-pulpit--muslim'), 'Minbar', 'the minbar');
const items = factionSearchItems(lib).filter(c => FAITHS.includes(c.faction));
ok(items.length >= 34, `the faiths' pieces are on the shelf and the bar (${items.length})`);
for (const c of items) { ok(!/\bidol\b|\bcult\b/i.test(`${c.name} ${c.hint}`), `${c.name}: no "idol" or "cult" in its name or search words`); ok(!/^(Christian|Buddhist|Hindu|Muslim) /.test(c.name), `${c.name} is named for what it is`); }
// the shelf rows: a slot the faith omits is a blank (not a "missing" gap); a faith's own role shows only in its owners' rows
const row = (id) => factionRowSlots(lib, factions.find(f => f.id === id), slots);
ok(row('muslim').some(c => c.cat === 'flavor-altarpiece' && c.state === 'omit'), 'the mosque has no altar piece: a blank, not a gap');
ok(!row('muslim').some(c => c.state === 'gap'), `the Muslim row has no missing piece (${row('muslim').filter(c => c.state === 'gap').map(c => c.cat)})`);
for (const f of FAITHS) ok(!row(f).some(c => c.state === 'gap'), `the ${f} row has no missing piece (${row(f).filter(c => c.state === 'gap').map(c => c.cat)})`);
ok(row('muslim').some(c => c.cat === 'flavor-pulpit') && !row('sun').some(c => c.cat === 'flavor-pulpit') && !row('christian').some(c => c.cat === 'flavor-pulpit'), 'the minbar column is the mosque\'s alone');
ok(row('sun').filter(c => c.state === 'gap').length === factionRowSlots(lib, factions.find(f => f.id === 'sun'), slots.filter(s => !/altar$|mat|pulpit|stand|font|lamp|wheel|bell|gate/.test(s))).filter(c => c.state === 'gap').length, 'a fantasy row gains no gaps from the faiths\' roles');

// ---- apply: a temple room and its building take each faith; the pieces swap; a change of rite rebuilds the hall
const B = 'bld_faith001', R = 'room_faith01', V = 'room_faith02', O = 'obj_faith001';
const piece = (id, room, cat, sku) => ({ id, kind: 'object', cat, sku, url: `assets/m/${sku}.glb`, flat: false, name: sku, room, x: 7, y: 0, z: 9, rot: 0, quat: [0, 0, 0, 1], s: [1, 1, 1], dims: [2, 2, 2], hidden: false });
const base = { order: 3, entities: { [B]: { id: B, kind: 'building', gen: { code: 'TEM', flavor: 'sun' } }, [R]: { id: R, kind: 'room', building: B, order: 1, recipe: { type: 'temple-nave', seed: 5 } },
  [V]: { id: V, kind: 'room', building: B, order: 2, recipe: { type: 'temple-vestry', seed: 6 } }, [O]: piece(O, R, 'flavor-idol', 'flavor-idol--sun-fct'), obj_faith002: piece('obj_faith002', V, 'flavor-relief', 'flavor-relief--sun') } };
for (const f of FAITHS) {
  let area = structuredClone(base);
  const args = planFactionChange(area.entities, B, f, lib, types);
  eq(parseArgs('faction.set', args).error, undefined, `${f}: payload parses`); eq(REGISTRY['faction.set'].check({ area }, args), null, `${f}: payload validates`);
  area = REGISTRY['faction.set'].apply(area, args);
  eq(area.entities[O].sku, `flavor-idol--${f}`, `${f}: the nave's focus becomes the ${factionPieceName(lib, 'flavor-idol', `flavor-idol--${f}`)}`);
  eq(effectiveFaction(area.entities, R, lib, types), f, `${f}: the nave inherits the building's faith`);
  eq(riteChangedRooms(base.entities, B, f, lib, types).map(r => r.id), [R], `${f}: the nave (a rite hall) is rebuilt, the vestry is not`);
}
eq(riteChangedRooms({ ...base.entities, [B]: { ...base.entities[B], gen: { code: 'TEM', flavor: 'christian' } } }, R, 'christian', lib, types), [], 'same rite: no rebuild');
eq(riteChangedRooms(base.entities, B, 'moon', lib, types), [], 'fantasy to fantasy: an asset swap only');
eq(riteChangedRooms(base.entities, O, 'muslim', lib, types), [], 'a piece-level change never rebuilds');

// ---- never a cult room: refused for the room, a piece in it and the drag-out picker; a building's cult rooms keep theirs
const C = 'room_cult001', K = 'bld_cult0001', P = 'obj_cult0001', T = 'room_temp001';
const cult = { order: 3, entities: { [K]: { id: K, kind: 'building', gen: { code: 'CLT', flavor: 'devils' } }, [C]: { id: C, kind: 'room', building: K, order: 1, recipe: { type: 'cult-sanctum', seed: 3 } },
  [T]: { id: T, kind: 'room', building: K, order: 2, recipe: { type: 'temple-shrine', seed: 4 } }, [P]: piece(P, C, 'flavor-idol', 'flavor-idol--devils'), obj_cult0002: piece('obj_cult0002', T, 'flavor-idol', 'flavor-idol--devils') } };
for (const tk of types.filter(t => t.flavors?.length && t.flavors.every(x => ['devils', 'spiders', 'dragons', 'skulls', 'tentacles'].includes(x))).map(t => t.key)) ok(faithBarredRoom({ kind: 'room', recipe: { type: tk } }, lib, types), `${tk} is barred to the faiths`);
ok(faithBarredRoom(cult.entities[C], lib, types) && !faithBarredRoom(cult.entities[T], lib, types), 'the sanctum is barred, the shrine is not');
for (const f of FAITHS) {
  ok(!factionAllowed(cult.entities, C, f, lib, types) && !factionAllowed(cult.entities, P, f, lib, types), `${f}: refused on the cult sanctum and on a piece in it`);
  assert.throws(() => planFactionChange(cult.entities, C, f, lib, types), /never dresses a cult sanctum/, `${f}: the faction change refuses the cult sanctum`); checks++;
  assert.throws(() => planFactionChange(cult.entities, P, f, lib, types), /never dresses/, `${f}: and a piece in it`); checks++;
  ok(factionAllowed(cult.entities, K, f, lib, types), `${f}: a building with a temple room may take the faith`);
  const args = planFactionChange(cult.entities, K, f, lib, types); let area = structuredClone(cult);
  eq(REGISTRY['faction.set'].check({ area }, args), null, `${f}: the building payload validates`);
  ok(!args.swaps.some(s => s.id === P), `${f}: the sanctum's idol is not swapped`); area = REGISTRY['faction.set'].apply(area, args);
  eq(area.entities[P].sku, 'flavor-idol--devils', `${f}: the sanctum keeps its devil idol`); eq(area.entities.obj_cult0002.sku, `flavor-idol--${f}`, `${f}: the shrine takes the faith`);
  ok(effectiveFaction(area.entities, C, lib, types) !== f, `${f}: the sanctum never inherits the faith from its building`);
  ok(isReverent(lib, f) && !factionAllowed({ x: { id: 'x', kind: 'room', recipe: { type: 'cathedral-dark' } } }, 'x', f, lib, types), `${f}: refused on a dark cathedral`);
}
for (const f of ['sun', 'spiders', 'moon']) ok(factionAllowed(cult.entities, C, f, lib, types), `${f} (fantasy) is still allowed on a cult sanctum`);
console.log(`faith factions: ${checks} checks passed (four faiths in the menu, named pieces, shelf rows, apply, rite rebuild, never a cult room)`);
