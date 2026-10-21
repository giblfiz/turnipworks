// Fog of war per area (Harry 2026-10-15): an area is On / Off / inherits the campaign default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCampaign, newArea, areaRules, projectCampaign } from '../core/state.js';
import { REGISTRY, checkCommand } from '../core/commands.js';
import { exploreFog, fogFor } from '../core/fog.js';

function world() {
  let s = newCampaign('campaign_t', 'TEST fog area (throwaway)');
  s.seats = { gm: { id: 'gm', kind: 'human', role: 'gm' }, p1: { id: 'p1', kind: 'human', role: 'player' } };
  s.areas = { a: newArea('a', 'Inn'), b: newArea('b', 'Cellar') }; s.areaOrder = ['a', 'b'];
  return s;
}
const run = (s, type, args) => REGISTRY[type].apply(s, args);

test('area inherits the campaign default, overrides both ways, null goes back to inheriting', () => {
  let s = world();
  assert.equal(areaRules(s, 'a').fogOfWar, false, 'old campaign: built-in off');
  s = run(s, 'campaign.set', { defaults: { fogOfWar: true } });
  assert.deepEqual([areaRules(s, 'a').fogOfWar, areaRules(s, 'b').fogOfWar], [true, true], 'default on reaches every area');
  s = run(s, 'area.set', { area: 'a', settings: { fogOfWar: false } });
  assert.deepEqual([areaRules(s, 'a').fogOfWar, areaRules(s, 'b').fogOfWar], [false, true], 'area a off, b still inherits');
  s = run(s, 'campaign.set', { defaults: { fogOfWar: false } });
  s = run(s, 'area.set', { area: 'b', settings: { fogOfWar: true } });
  assert.deepEqual([areaRules(s, 'a').fogOfWar, areaRules(s, 'b').fogOfWar], [false, true], 'default off, b forced on');
  s = run(s, 'area.set', { area: 'b', settings: { fogOfWar: null } });
  assert.equal(areaRules(s, 'b').fogOfWar, false, 'null = inherit');
  assert.equal('fogOfWar' in s.areas.b.settings, false);
});

test('only the GM sets it, bad values refused, every seat receives each area value', () => {
  let s = world();
  assert.ok(checkCommand({ state: s, by: 'p1' }, { type: 'area.set', args: { area: 'a', settings: { fogOfWar: true } } }));
  assert.ok(checkCommand({ state: s, by: 'gm' }, { type: 'area.set', args: { area: 'a', settings: { fogOfWar: 'on' } } }));
  assert.equal(checkCommand({ state: s, by: 'gm' }, { type: 'area.set', args: { area: 'a', settings: { fogOfWar: false } } }), null);
  s = run(s, 'campaign.set', { defaults: { fogOfWar: true } });
  s = run(s, 'area.set', { area: 'a', settings: { fogOfWar: false } });
  const p = projectCampaign(s, 'p1');
  assert.equal(p.areas.find(x => x.id === 'a').settings.fogOfWar, false, 'projected area override');
  assert.equal(p.areas.find(x => x.id === 'b').settings.fogOfWar, undefined, 'projected inherit');
  assert.equal(p.defaults.fogOfWar, true);
});

test('explored memory survives off and back on', () => {
  let s = world();
  s = run(s, 'campaign.set', { defaults: { fogOfWar: true } });
  const fog = exploreFog(undefined, 'p1', { 0: { 4: [[1, 9]] } }, 0);
  s.areas.a = { ...s.areas.a, fog };
  const before = JSON.stringify(fogFor(s.areas.a.fog, 'p1', false, false));
  s = run(s, 'area.set', { area: 'a', settings: { fogOfWar: false } });
  assert.equal(JSON.stringify(fogFor(s.areas.a.fog, 'p1', false, false)), before, 'off keeps the memory');
  assert.equal(s.areas.a.fog.epoch, fog.epoch, 'epoch untouched, so in-flight exploration is not cut off');
  s = run(s, 'area.set', { area: 'a', settings: { fogOfWar: null } });
  assert.equal(JSON.stringify(fogFor(s.areas.a.fog, 'p1', false, false)), before, 'back on restores it');
  assert.ok(JSON.stringify(before).length > 40, 'memory was not empty');
});
