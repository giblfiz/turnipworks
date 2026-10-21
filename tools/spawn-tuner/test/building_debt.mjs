// Exact, dated exceptions for still-open generator bugs. This is not a baseline updater.
// New inputs, changed details, skipped checks and unexpected passes are all failures.
import { readFileSync } from 'node:fs';
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])])) : value;
export function buildingDebt(file, { scope = () => true, log = console.log } = {}) {
  const fixture = JSON.parse(readFileSync(file, 'utf8'));
  const key = c => JSON.stringify(ordered(Object.fromEntries(
    ['code', 'x', 'z', 'w', 'd', 'storeys', 'seed', 'front', 'dials', 'rule'].map(k => [k, c[k]]))));
  const cases = new Map(), selected = fixture.cases.filter(scope), visited = new Set();
  for (const c of fixture.cases) {
    const id = key(c);
    if (cases.has(id)) throw new Error(`Duplicate building-debt case: ${id}`);
    cases.set(id, c.detail);
  }
  let expected = 0, unexpectedPasses = 0;
  return {
    check(input, ok, detail) {
      const id = key(input);
      if (!cases.has(id)) return { ok, expected: false };
      visited.add(id);
      if (ok) {
        unexpectedPasses++;
        log(`XPASS ${id}: remove the resolved exception (${fixture.report})`);
        return { ok: false, expected: false };
      }
      if (cases.get(id) !== detail) return { ok: false, expected: false };
      expected++;
      log(`XFAIL ${id}: ${detail} (${fixture.recorded}; ${fixture.report})`);
      return { ok: false, expected: true };
    },
    forInput(input) { return fixture.cases.filter(c => key({ ...c, rule: undefined }) === key({ ...input, rule: undefined })); },
    finish() {
      const missing = selected.filter(c => !visited.has(key(c)));
      for (const c of missing) log(`FAIL missing building-debt check ${key(c)} (${fixture.report})`);
      return missing.length === 0;
    },
    get expected() { return expected; },
    get unexpectedPasses() { return unexpectedPasses; },
  };
}
