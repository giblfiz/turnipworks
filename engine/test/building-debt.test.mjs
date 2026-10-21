// Expected failures remain narrow and become loud when either behavior or inputs change.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildingDebt } from '../../tools/spawn-tuner/test/building_debt.mjs';
const dir = mkdtempSync(join(tmpdir(), 'tw-building-debt-'));
try {
  const input = { code: 'CRY', x: 3, z: -2, w: 14, d: 10, storeys: 1, seed: 8363, front: 'S', dials: { loops: 0.3, pacing: 0, carved: 1 }, rule: 'loop' };
  const file = join(dir, 'expected.json');
  writeFileSync(file, JSON.stringify({ recorded: '2026-10-13', report: 'docs/TEST_DEBT.md#crypt-building-topology', cases: [{ ...input, detail: '0 loops' }] }));
  const debt = buildingDebt(file, { log: () => {} });
  assert.deepEqual(debt.check(input, false, '0 loops'), { ok: false, expected: true });
  assert.deepEqual(debt.check({ ...input, seed: input.seed + 1 }, false, '0 loops'), { ok: false, expected: false });
  assert.deepEqual(debt.check({ ...input, dials: { ...input.dials, loops: 0 } }, false, '0 loops'), { ok: false, expected: false });
  assert.deepEqual(debt.check({ ...input, x: 4 }, false, '0 loops'), { ok: false, expected: false });
  assert.deepEqual(debt.check(input, false, 'different failure'), { ok: false, expected: false });
  assert.deepEqual(debt.check(input, true, ''), { ok: false, expected: false });
  assert.deepEqual(debt.check({ ...input, rule: 'door' }, true, ''), { ok: true, expected: false });
  assert.equal(debt.expected, 1);
  assert.equal(debt.unexpectedPasses, 1);
  assert.equal(debt.forInput({ ...input, rule: 'unused' }).length, 1);
  assert.equal(debt.forInput({ ...input, w: 15 }).length, 0);
  assert.equal(debt.finish(), true);
  assert.equal(buildingDebt(file, { log: () => {} }).finish(), false);
  assert.equal(buildingDebt(file, { scope: c => c.code === 'TAV', log: () => {} }).finish(), true);
  writeFileSync(file, JSON.stringify({ cases: [{ ...input, detail: '0 loops' }, { ...input, detail: '0 loops' }] }));
  assert.throws(() => buildingDebt(file), /Duplicate building-debt case/);
  console.log('building debt: 15/15 passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
