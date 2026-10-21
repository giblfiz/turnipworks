import assert from 'node:assert/strict';
import { effectiveFaction } from '../core/factions.js';
const old = { objects: { 'flavor-idol': { skus: ['sun', 'moon', 'devils', 'spiders'].map(shape => ({ shape })) } } };
const expanded = structuredClone(old);
expanded.objects['flavor-idol'].skus.push(...['nature', 'sword-shield', 'dragons', 'skulls', 'tentacles', 'death', 'scales-coin', 'forge-hammer', 'sea-storm'].map(shape => ({ shape })));
const types = [{ key: 'temple-nave', flavors: ['sun', 'moon', 'nature', 'sword-shield'] }, { key: 'cult-sanctum', flavors: ['devils', 'spiders', 'dragons', 'skulls', 'tentacles'] }];
for (const type of types) for (let n = 0; n < 128; n++) {
  const building = `building-${n}`, room = { id: 'room', kind: 'room', building, recipe: { type: type.key } };
  const entities = { [building]: { id: building, kind: 'building' }, room };
  assert.equal(effectiveFaction(entities, room, expanded, types), effectiveFaction(entities, room, old, types), 'new assets preserve default faction');
  entities[building].flavor = 'nature';
  assert.equal(effectiveFaction(entities, room, expanded, types), 'nature', 'explicit building choice remains available');
  room.recipe.flavor = 'death';
  assert.equal(effectiveFaction(entities, room, expanded, types), 'death', 'explicit room choice overrides building');
}
console.log('faction defaults: 768 checks passed');
