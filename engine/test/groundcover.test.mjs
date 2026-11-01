// The area's ground (Harry 2026-10-22: "Can we allow simple tiling for the whole outdoor world? Like if I just want to
// drag grass onto everything?"): core area.ground, the relay's undo/redo and reload, what each seat receives, and the
// drawing is checked in a browser (browser_groundcover.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CampaignRuntime } from '../relay/campaign.js';
import { makeTokens } from '../relay/tokens.js';
import { REGISTRY, checkCommand, groundProblem } from '../core/commands.js';
import { areaForClient } from '../core/state.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-ground-')), tokens = makeTokens('ground-tests');
  let { rt, gmSeat: gm } = CampaignRuntime.create({ id: 'cmp_ground001', dir, name: 'TEST Ground (throwaway)', gmName: 'GM', tokens });
  const area = rt.state.areaOrder[0], pl = 'seat_player0001';
  const send = (who, type, args = {}) => rt.dispatch(who, { type, args, area });
  assert.ok(send(gm, 'seat.create', { id: pl, kind: 'human', role: 'player', name: 'P', color: '#aabbcc' }).ok);
  t.after(() => { rt.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { get rt() { return rt; }, gm, pl, area, send, ground: () => rt.state.areas[area].ground, reload() { rt.close(); rt = new CampaignRuntime({ id: 'cmp_ground001', dir, tokens }); rt.load(); return rt; } };
}

test('area.ground: sets, replaces and clears the material; ids are checked', () => {
  const a = { id: 'a', entities: {}, seq: 0 };
  const t1 = REGISTRY['area.ground'].apply(a, { cat: 'floor-grass' });
  assert.equal(t1.ground, 'floor-grass');
  assert.equal(REGISTRY['area.ground'].apply(t1, { cat: 'floor-cobble' }).ground, 'floor-cobble');
  const t0 = REGISTRY['area.ground'].apply(t1, {});
  assert.equal('ground' in t0, false, 'no cat = the bare ground (the key goes)');
  assert.deepEqual(REGISTRY['area.ground'].inverse(t1, { cat: 'floor-cobble' }), { type: 'area.ground', args: { cat: 'floor-grass' } });
  assert.deepEqual(REGISTRY['area.ground'].inverse(a, { cat: 'floor-grass' }), { type: 'area.ground', args: {} });
  assert.equal(groundProblem('floor-grass'), null); assert.equal(groundProblem(null), null);
  assert.ok(groundProblem('rug-hay-scatter')); assert.ok(groundProblem('floor-<script>'));
});

test('only the GM side sets it; every seat receives it; one undo, one redo; it survives a reload', (t) => {
  const f = fixture(t);
  assert.equal(f.send(f.pl, 'area.ground', { cat: 'floor-grass' }).ok, false, 'a player may not');
  assert.equal(f.ground(), undefined);
  assert.equal(f.send(f.gm, 'area.ground', { cat: 'not-a-floor' }).ok, false, 'not a floor id: refused');
  assert.ok(f.send(f.gm, 'area.ground', { cat: 'floor-grass' }).ok);
  assert.equal(f.ground(), 'floor-grass');
  const T = f.rt.state.areas[f.area];
  assert.equal(areaForClient(T, true).ground, 'floor-grass', 'the GM side receives it');
  assert.equal(areaForClient(T, false, f.pl).ground, 'floor-grass', 'a player receives it');
  assert.ok(f.send(f.gm, 'area.ground', { cat: 'floor-cobble' }).ok);
  assert.ok(f.send(f.gm, 'undo').ok); assert.equal(f.ground(), 'floor-grass', 'undo: the material before');
  assert.ok(f.send(f.gm, 'undo').ok); assert.equal(f.ground(), undefined, 'undo again: the bare ground');
  assert.equal(areaForClient(f.rt.state.areas[f.area], false, f.pl).ground, undefined, 'bare: nothing sent');
  assert.ok(f.send(f.gm, 'redo').ok); assert.equal(f.ground(), 'floor-grass', 'redo');
  f.reload(); assert.equal(f.ground(), 'floor-grass', 'kept in the saved campaign');
  assert.ok(checkCommand({ state: f.rt.state, by: f.gm }, { type: 'batch', area: f.area, args: { ops: [{ type: 'area.ground', args: { cat: 'floor-gravel' } }] } }) === null, 'it can ride in a batch');
});

