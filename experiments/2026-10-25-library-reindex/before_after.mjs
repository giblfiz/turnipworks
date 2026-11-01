// node experiments/2026-10-25-library-reindex/before_after.mjs : the command bar's placeable things (library-index.js
// handPlaceable, on the tuner's data) against what each audit run's libraries actually laid out (audit-*.json)
import fs from 'node:fs';
import { handPlaceable } from '../../engine/client/library-index.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../../tools/spawn-tuner/data/library.json');
const all = handPlaceable(lib, (k) => solver.skuUsable(k, { minStars: 3, hideMasking: true }));
const kinds = (xs) => Object.entries(xs.reduce((m, p) => (m[p.kind] = (m[p.kind] || 0) + 1, m), {})).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`placeable: ${all.length} (${kinds(all)})`);
for (const f of ['audit-dev.json', 'audit-local.json']) {
  const R = read(f), cats = new Set(), skus = new Set();
  for (const r of R.even) for (const it of r.items) { cats.add(it.cat); skus.add(`${it.cat}|${it.sku}`); }
  const miss = all.filter(p => p.kind === 'faction' ? !skus.has(`${p.id}|${p.sku}`) : !cats.has(p.id));
  const own = R.even.filter(r => r.roomKey === 'cave')[0], perRoom = R.even.map(r => r.n);
  console.log(`\n${f} (${R.page}): in no library ${miss.length} (${kinds(miss)}); things per library ${Math.min(...perRoom)}..${Math.max(...perRoom)}, cave ${own?.n}`);
  console.log('  ' + miss.map(p => p.kind + ':' + p.id + (p.sku ? '/' + p.sku : '')).join(' '));
}
