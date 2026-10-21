import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CAMPAIGN_KEYS, RULE_KEYS, settingsProblem, newCampaign, projectCampaign } from '../core/state.js';
import { REGISTRY, checkCommand } from '../core/commands.js';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';

test('vision switches accept only booleans; fog of war is per-area, shared vision campaign-wide', () => {
  for (const [key, keys] of [['fogOfWar', RULE_KEYS], ['sharedPartyVision', CAMPAIGN_KEYS]]) {
    for (const value of [true, false, null]) assert.equal(settingsProblem({ [key]: value }, keys), null);
    for (const value of ['on', 1, {}, []]) assert.ok(settingsProblem({ [key]: value }, keys));
  }
  assert.ok(settingsProblem({ sharedPartyVision: true }, RULE_KEYS));
});

test('only the GM can set vision; every seat receives the switches', () => {
  let state = newCampaign('campaign_test', 'TEST fog (throwaway)');
  state.seats = { seat_gm: { id: 'seat_gm', kind: 'human', role: 'gm' }, seat_player: { id: 'seat_player', kind: 'human', role: 'player' } };
  const cmd = { type: 'campaign.set', args: { defaults: { fogOfWar: true, sharedPartyVision: false } } };
  assert.ok(checkCommand({ state, by: 'seat_player' }, cmd));
  assert.equal(checkCommand({ state, by: 'seat_gm' }, cmd), null);
  state = REGISTRY[cmd.type].apply(state, cmd.args);
  assert.deepEqual(projectCampaign(state, 'seat_player').defaults, cmd.args.defaults);
});

test('new campaign defaults survive snapshot reload; historical genesis keeps fog off', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tw-fog-settings-')), tokens = makeTokens('test');
  let rt, reload;
  try {
    ({ rt } = CampaignRuntime.create({ id: 'campaign_test', dir, name: 'TEST fog (throwaway)', tokens }));
    assert.deepEqual(rt.state.defaults, { fogOfWar: true, sharedPartyVision: false });
    rt.close(); rt = null;
    reload = new CampaignRuntime({ id: 'campaign_test', dir, tokens });
    reload.load();
    assert.deepEqual(reload.state.defaults, { fogOfWar: true, sharedPartyVision: false });
    reload.applyRecord({ r: 100, genesis: { id: 'campaign_old', name: 'Existing' }, fx: [] });
    assert.deepEqual(reload.state.defaults, {});
    assert.equal(reload.state.defaults.fogOfWar === true, false);
  } finally { rt?.close(); reload?.close(); rmSync(dir, { recursive: true, force: true }); }
});
