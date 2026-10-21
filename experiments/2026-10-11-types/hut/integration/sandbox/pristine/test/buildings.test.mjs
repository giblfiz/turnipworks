// WHOLE BUILDINGS: the rules of docs/BUILDINGS.md checked over a sweep of types x footprints x storeys x seeds.
//   node tools/spawn-tuner/test/buildings.test.mjs [seeds=40] [--json] [--code=TAV]
// Pure plans only (js/buildings.js generate + check): no meshes, no solver. The engine-level sweep (real walls, real
// doors, furnished rooms) is engine/test/buildings.test.mjs.
import { generate, failures, BUILDING_TYPES, programmeFor } from '../js/buildings.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const types = JSON.parse(readFileSync(here + '../data/rooms.json', 'utf8'));
const walls = await import('../js/walls.js');
const PREFIX = { TAV: 'tav-', NOB: 'nob-', CAS: 'cas-', CRY: 'cry-' };
export const roomsOf = (code) => types.filter(t => (t.recipes || []).some(r => r.startsWith(PREFIX[code] || code.toLowerCase() + '-'))).map(t => ({ key: t.key, cells: t.cells, outdoor: !!t.outdoor }));
export const SIZES = [[6, 5], [8, 6], [10, 8], [12, 8], [8, 12], [14, 10], [16, 12], [20, 14], [24, 16], [24, 24], [5, 5], [7, 16]];
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const N = +(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 40), only = arg('code', null), json = process.argv.includes('--json');
const codes = (only ? [only] : ['TAV', 'NOB', 'CAS', 'CRY']);
const report = { seeds: N, byType: {}, total: 0, failed: 0, rules: {} };
let det = 0;
for (const code of codes) {
  const T = BUILDING_TYPES[code], rt = roomsOf(code), R = report.byType[code] = { plans: 0, failed: 0, rules: {}, notes: {}, examples: [] };
  for (const [w, d] of SIZES) for (let st = T.storeys.min; st <= T.storeys.max; st++) for (let seed = 1; seed <= N; seed++) {
    let plan;
    const opts = { code, rect: { x: 3, z: -2, w, d }, seed: seed * 7919 + w * 31 + d, storeys: st, types: rt, roles: walls.ROLES };
    try { plan = generate(opts); } catch (e) { R.plans++; R.failed++; R.rules['CRASH'] = (R.rules['CRASH'] || 0) + 1; if (R.examples.length < 6) R.examples.push(`${code} ${w}x${d} s${st} seed ${opts.seed}: CRASH ${e.stack.split('\n').slice(0, 3).join(' | ')}`); continue; }
    if (seed <= 2) { const again = JSON.stringify(generate(opts)); if (again !== JSON.stringify(plan)) det++; } // the same seed gives the same plan
    R.plans++; const f = failures(plan);
    for (const c of plan.checks) { const k = c.rule.replace(/\d+ loops?/, 'N loops'); R.rules[k] = R.rules[k] || { pass: 0, fail: 0 }; R.rules[k][c.ok ? 'pass' : 'fail']++; }
    for (const n of plan.notes) { const k = n.replace(/level \d+/, 'level N').replace(/^(\S+) (got no door|could not be reached.*|is reached through .*)$/, 'ROOM $2'); R.notes[k] = (R.notes[k] || 0) + 1; }
    if (f.length) { R.failed++; if (R.examples.length < 8) R.examples.push(`${code} ${w}x${d} s${st} seed ${opts.seed}: ${f.map(x => `${x.rule} [${x.detail}]`).join('; ')}`); }
  }
  report.total += R.plans; report.failed += R.failed;
}
report.nonDeterministic = det;
if (json) console.log(JSON.stringify(report, null, 1));
else {
  for (const [code, R] of Object.entries(report.byType)) {
    console.log(`\n${code} ${BUILDING_TYPES[code].label}: ${R.plans - R.failed}/${R.plans} plans keep every rule (${(100 * (R.plans - R.failed) / R.plans).toFixed(1)}%)`);
    for (const [k, v] of Object.entries(R.rules)) if (v.fail || k === 'CRASH') console.log(`   FAIL ${String(v.fail ?? v).padStart(5)} / ${v.pass + v.fail || ''}  ${k}`);
    const notes = Object.entries(R.notes).sort((a, b) => b[1] - a[1]).slice(0, 6); if (notes.length) console.log('   notes: ' + notes.map(([k, n]) => `${n}x "${k}"`).join('; '));
    for (const e of R.examples) console.log('   e.g. ' + e);
  }
  console.log(`\nTOTAL ${report.total - report.failed}/${report.total} pass; same seed, different plan: ${det}`);
}
process.exitCode = report.failed || det ? 1 : 0;
