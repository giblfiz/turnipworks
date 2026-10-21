import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { factionCatalog, factionSearchItems, factionPieceName, resolveFaction } from '../core/faction-catalog.js';
const lib = JSON.parse(fs.readFileSync(new URL('../../tools/spawn-tuner/data/library.json', import.meta.url)));
test('factions are discovered from SKU shapes, labels and aliases from metadata', () => {
  const { factions, slots } = factionCatalog(lib);
  assert(factions.some(f => f.id === 'spiders' && f.group === 'sinister'));
  assert(slots.includes('flavor-banner'));
  assert.equal(factionPieceName(lib, 'flavor-buttress', 'flavor-buttress--sun'), 'Sun pier');
  assert.equal(resolveFaction(lib, 'spider'), 'spiders');
  assert.equal(resolveFaction(lib, 'solar'), 'sun');
  const items = factionSearchItems(lib);
  assert(items.some(c => c.name === 'Spider banner' && c.hint.includes('wall hanging')));
  assert(items.some(c => c.name === 'Sun idol'));
});
test('new faction and new slot appear without code edits; missing slots stay gaps', () => {
  const temp = structuredClone(lib);
  temp.objects['flavor-newmark'] = { id: 'flavor-newmark', place: 'wall', skus: [{ sku: 'flavor-newmark--otters', shape: 'otters', kind: 'flat', url: 'otter.webp' }] };
  temp.objects['flavor-banner'].skus.push({ sku: 'flavor-banner--otters', shape: 'otters', kind: 'flat', url: 'otter-banner.webp' });
  const { factions, slots } = factionCatalog(temp), f = factions.find(f => f.id === 'otters');
  assert(f); assert.equal(f.group, 'neutral'); assert(slots.includes('flavor-newmark'));
  assert(!f.slots['flavor-idol']); assert.equal(f.slots['flavor-banner'].sku, 'flavor-banner--otters');
  assert.equal(resolveFaction(temp, 'otters'), 'otters');
  assert(factionSearchItems(temp).some(c => c.name === 'Otter newmark'));
});
test('Task C metadata arrays supply grouping, emblems and declared slot gaps', () => {
  const temp = structuredClone(lib);
  temp.factions = Object.entries(temp.factions).map(([id, fields]) => ({ id, ...fields }));
  temp.factions.find(f => f.id === 'sun').emblem = 'assets/emblems/sun.webp';
  temp.flavorSlots = ['flavor-corbel'];
  const { factions, slots } = factionCatalog(temp);
  assert(slots.includes('flavor-corbel'));
  assert.equal(factions.find(f => f.id === 'sun').emblem, 'assets/emblems/sun.webp');
  assert.equal(factions.find(f => f.id === 'spiders').group, 'sinister');
  assert.equal(resolveFaction(temp, 'solar'), 'sun');
  assert.equal(factionPieceName(temp, 'flavor-banner', 'flavor-banner--spiders'), 'Spider banner');
});
test('actual command bar ranking puts explicit faction piece names first', () => {
  const source = fs.readFileSync(new URL('../client/surfaces/bar.js', import.meta.url), 'utf8');
  const score = Function(`return ${source.slice(source.indexOf('function score('), source.indexOf('  const boost'))}`)();
  const rank = query => factionSearchItems(lib).map(c => ({ c, score: score(query, c.name, c.desc, c.hint, c.id) + (c.name.toLowerCase() === query ? 100 : 0) })).sort((a, b) => b.score - a.score);
  assert.equal(rank('sun idol')[0].c.name, 'Sun idol');
  assert.equal(rank('spider cult wall hanging')[0].c.name, 'Spider banner');
  assert.equal(rank('solar cult banner')[0].c.name, 'Sun banner');
});

test('minimal C records keep plural IDs with singular plain piece names', () => {
  const temp = structuredClone(lib);
  temp.factions = [{ id: 'spiders', label: 'Spiders', group: 'sinister' }, { id: 'devils', label: 'Devils', group: 'sinister' }];
  assert.equal(resolveFaction(temp, 'spider'), 'spiders');
  assert.equal(resolveFaction(temp, 'devil'), 'devils');
  assert.equal(factionPieceName(temp, 'flavor-banner', 'flavor-banner--spiders'), 'Spider banner');
  assert.equal(factionPieceName(temp, 'flavor-idol', 'flavor-idol--devils'), 'Devil idol');
});
