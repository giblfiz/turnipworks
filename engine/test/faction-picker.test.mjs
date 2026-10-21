import assert from 'node:assert/strict';
import { factionGrid, factionRows, setupFactionUI } from '../client/surfaces/factions.js';
import { menuFor, chordOf } from '../client/menu.js';
import { T } from '../client/tuner.js';
import { defineCommands } from '../client/commands.js';
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.events = {}; this.classList = { toggle() {} }; }
  append(e) { this.children.push(e); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, v) { this.events[k] = v; }
}
globalThis.document = { createElement: tag => new El(tag) };
T.base = '/tuner/';
T.lib = { factions: { sun: { label: 'Sun', group: 'neutral' }, spiders: { label: 'Spiders', group: 'sinister' } }, objects: { 'flavor-sigil': { skus: ['sun', 'spiders'].map(shape => ({ shape, sku: shape, url: shape + '.png' })) } } };
T.types = [{ key: 'chapel', slots: { dress: ['flavor-sigil'] }, flavors: ['sun'] }];
const room = { id: 'r', kind: 'room', recipe: { type: 'chapel' } }, entities = { r: room };
let changed;
const app = { roomgen: { typeList: [], families: [], floors: [] }, entities: () => entities, ent: id => entities[id], can: () => true, area: () => 'a', setFaction: (id, flavor) => { changed = [id, flavor]; } };
let grid = factionGrid(app, room, { choose: f => { changed = f; } });
assert.equal(grid.children.length, 3); assert.equal(grid.children[0].textContent, "As the building's");
assert.equal(grid.children[0].attrs['aria-pressed'], 'true');
assert.deepEqual(grid.children.slice(1).map(row => row.children.length), [1, 1]);
assert.equal(grid.children[1].children[0].attrs['aria-label'], 'Sun (inherited)');
grid.children[2].children[0].events.click({ stopPropagation() {} }); assert.equal(changed, 'spiders');
// A faction added only to the library is immediately available to both grid and command parser.
T.lib.objects['flavor-sigil'].skus.push({ shape: 'test-otter', sku: 'otter', url: 'otter.png' });
grid = factionGrid(app, room, { conditional: true, choose() {} });
assert.equal(grid.children.length, 2); assert.equal(grid.children[0].children.length, 2);
assert.ok(grid.children.flatMap(r => r.children).every(b => !b.textContent && b.tabIndex === -1));
const commands = new Map(); defineCommands({ add: c => commands.set(c.id, c) }, app);
const command = commands.get('faction.set');
assert.deepEqual(command.parse('faction test-otter'), { flavor: 'test-otter' });
assert.deepEqual(command.parse('religion inherit'), { flavor: 'inherit' });
assert.equal(command.parse('faction absent'), null);
command.run({ one: room }, { flavor: 'test-otter' }); assert.deepEqual(changed, ['r', 'test-otter']);
let offers = 0; app.condButtons = { show() { offers++; } }; setupFactionUI(app);
app.offerFaction('r'); app.offerFaction('r'); assert.equal(offers, 1);
assert.deepEqual(factionRows(Array.from({ length: 13 }, (_, i) => ({ group: i < 7 ? 'neutral' : 'sinister' }))).map(r => r.length), [7, 6]);
// Exact room ring, including an ordinary room with no faction slots and a hidden roof.
const ids = ['faction.set', 'room.walls.stone', 'room.walls.wood', 'room.fog', 'thing.lock', 'room.height.taller', 'room.roofShow'];
const menuCommands = ids.map(id => ({ id, menu: true }));
const registry = { all: () => menuCommands, available: () => menuCommands, isEnabled: () => true };
for (const type of ['common', 'chapel']) {
  const ctx = { sel: [{ kind: 'room', recipe: { type } }] };
  const ring = menuFor(registry, ctx, { ring: true });
  assert.deepEqual(ring.map(n => n.cmd?.id || n.group), ['room.walls.', 'room.fog', 'thing.lock', 'room.height.taller', 'faction.set']);
  assert.equal(ring.at(-1).opens, 'faction');
}
assert.equal(menuFor(registry, { sel: [{ kind: 'building' }] }, { ring: true })[0].cmd.id, 'faction.set');
assert.deepEqual(chordOf(registry, 'faction.set'), ['Space', 'v']);
console.log('Faction picker: 21 assertions passed (two rows, inherit, data discovery, command, first offer).');
