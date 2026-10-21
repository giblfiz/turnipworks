// Layout snapshot of every circle-era Ring Lab preset (2026-10-19, before ellipses). Imported by ringlab.test.mjs;
// `node test/ringlab_layouts.mjs --write` rewrites ringlab-golden.json: run it only on main's circle code (the file was
// written from origin/main ab8fa545's model, presets and registry). Positions and edge shifts, not warnings: the overlap
// warning became round-button exact the same day.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildArcItems, fitToScreen } from '../client/ringlab/model.js';
import { BUILTINS, normalize } from '../client/ringlab/presets.js';
const here = new URL('.', import.meta.url);
export const GOLDEN_URL = new URL('ringlab-golden.json', here);
export const CIRCLE_PRESETS = ['Current game · baseline', 'Mockup 11 · close reading', 'Tight horseshoe', 'Quiet brass · Fauna'];
// Shapes a saved record can take (Harry's saved rings load through normalize; none were on file 2026-10-19).
const SAVED = {
  'saved v1 record': { data: { version: 1, settings: { radius: 150, diameter: 60, gap: 6, primaryRadius: 220, arcStart: -70, arcSpan: 90, menuAngle: 55, direction: 'counterclockwise', nestedDensity: 1.2 } } },
  'saved v2 record': { data: { version: 2, settings: { arcs: { closed: { radius: 150, start: -60, span: 80, fit: true, gap: 9 }, secondary: { radius: 300, x: 20, y: -15, direction: 'counterclockwise' } }, edgeRule: 'squash' } } },
};
export function layouts() {
  const reg = JSON.parse(readFileSync(new URL('../../tools/spawn-tuner/ring/registry.json', here))).kinds;
  const sets = { ...Object.fromEntries(CIRCLE_PRESETS.map(n => [n, BUILTINS[n]])), ...Object.fromEntries(Object.entries(SAVED).map(([k, v]) => [k, v.data])) };
  const out = {};
  for (const [name, raw] of Object.entries(sets)) {
    const s = normalize(raw);
    for (const [kind, content] of Object.entries(reg)) for (const scale of [1, 1.3]) for (const anchor of [{ x: 720, y: 450 }, { x: 90, y: 120 }]) {
      const nestedOnes = content.secondary.filter(x => x.children?.length);
      const runs = [['closed', null], ['expanded', null], ...nestedOnes.map(n => ['nested', n]), ['nested', { id: 'faction.set', children: [{ id: 'faction.a' }, { id: 'faction.b' }, { id: 'faction.c' }] }]];
      for (const [state, nested] of runs) {
        const raw = buildArcItems(s, content, state, nested, scale, anchor), fit = fitToScreen(raw, 1440, 900, s.edgeRule, 54);
        const exact = JSON.stringify({ nodes: fit.nodes.map(n => [n.item.id, n.key, n.angle, n.x, n.y, n.size]), shift: fit.shift });
        // A hash of the exact numbers (every bit of every coordinate), so the file stays small.
        out[`${name}|${kind}|${scale}|${anchor.x},${anchor.y}|${state}|${nested?.id || ''}`] = createHash('sha256').update(exact).digest('hex').slice(0, 20);
      }
    }
  }
  return out;
}
if (process.argv.includes('--write')) { const L = layouts(); writeFileSync(GOLDEN_URL, JSON.stringify(L, null, 0).replace(/,"/g, ',\n"')); console.log('wrote', Object.keys(L).length, 'layouts'); }
