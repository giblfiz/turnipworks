// Tuning bench (node): the bar's catalog and figure scoring, re-implemented from surfaces/bar.js, over the REAL catalog the
// browser built (browser_barcat.py --dump inventory.json), with the genre tilt. Not a test: the browser test is the truth.
//   node experiments/2026-11-08-genrebias/sim.mjs <inventory.json> [tilt]
import fs from 'node:fs';
import { FILLER, forms, near, teachFigures } from '../../engine/client/barwords.js';
import { figureSearch } from '../../engine/client/figsearch.js';
import * as G from '../../engine/client/genrebias.js';
import { modShared } from '../../tools/spawn-tuner/js/solver2.js';

const inv = JSON.parse(fs.readFileSync(process.argv[2]));
const lib = JSON.parse(fs.readFileSync(new URL('../../tools/spawn-tuner/data/library.json', import.meta.url)));
const types = JSON.parse(fs.readFileSync(new URL('../../engine/client/data/types.json', import.meta.url)));
const figs = teachFigures(JSON.parse(fs.readFileSync(new URL('../../tools/spawn-tuner/data/figures.json', import.meta.url))).figures);
const index = G.genreIndex({ types, lib, figures: figs, shared: modShared });
function score(q, ...texts) {
  if (!q) return 1;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean), line = words.join(' ');
  if (words.length > 1 && texts.some(t => t && String(t).toLowerCase() === line)) return 110;
  let total = 0, counted = 0;
  for (const w0 of words) {
    let best = 0;
    for (const w of forms(w0)) for (const t0 of texts) { if (!t0) continue; const t = String(t0).toLowerCase(); const s = t === w ? 100 : t.startsWith(w) ? 80 : (t.includes(' ' + w) || t.includes('-' + w)) ? 62 : t.includes(w) ? 40 : near(w, t); if (s > best) best = s; }
    if (words.length > 1 && FILLER.has(w0) && best < 80) continue;
    if (!best) return 0; total += best; counted++;
  }
  return counted ? total / counted : 0;
}
const wordsOf = (texts, phrases = []) => new Set([...texts.filter(Boolean).flatMap(t => String(t).toLowerCase().split(/[^a-z0-9]+/)).filter(Boolean), ...phrases.filter(Boolean).map(t => String(t).toLowerCase())]);
const names = (q, W) => { const ws = q.toLowerCase().split(/\s+/).filter(Boolean); const real = ws.filter(w => !FILLER.has(w)); return (real.length ? real : ws).every(w => forms(w).some(f => W.has(f))); };
const search = figureSearch(figs);
export function rank(q, profile) {
  const cats = [];
  for (const cat of inv.catalog) {
    const s = Math.max(score(q, cat.name, cat.id, ...(cat.terms || [])), 0.75 * score(q, cat.name, cat.id, ...(cat.terms || []), cat.desc, cat.hint)), nm = cat.name.toLowerCase(), qs = forms(q.toLowerCase());
    if (!s) continue;
    const base = s + (qs.includes(nm) ? 100 : qs.some(x => nm.startsWith(x)) ? 10 : 0);
    const t = G.tiltOf(profile, index.catGenre(cat.id), names(q, wordsOf([cat.name, cat.id], cat.terms || [])));
    cats.push({ id: cat.id, s: base + t, g: index.catGenre(cat.id) });
  }
  cats.sort((a, b) => b.s - a.s);
  const found = search(q, { limit: profile.strength ? 0 : 8 }).map(({ fig, s }) => {
    const W = wordsOf([fig.name, fig.id, fig.cls, fig.race], [...(fig.tags || []), ...(fig.srd || [])]);
    return { id: fig.id, s: s + G.tiltOf(profile, index.figGenre(fig.id), names(q, W)) };
  }).sort((a, b) => b.s - a.s).slice(0, 8);
  return { cats: cats.slice(0, 3).map(r => r.id), figs: found.slice(0, 3).map(r => r.id) };
}
const P = (mix) => ({ mix, strength: 0.95 });
const tables = { empty: G.NO_PROFILE, fantasy: P({ fantasy: 1 }), modern: P({ modern: 1 }), mixed: P({ fantasy: 0.5, modern: 0.5 }), japan: P({ 'cultures:JPN': 1 }) };
const Q = ['chair', 'table', 'bed', 'door', 'guard', 'soldier', 'light', 'lamp', 'shelf', 'bar', 'crate', 'weapon', 'desk', 'sofa', 'stool', 'bench', 'car', 'dragon', 'cabinet', 'stove', 'window', 'sink', 'lantern', 'thug', 'doctor', 'bartender'];
if (process.argv[1].endsWith('sim.mjs')) for (const q of Q) { console.log(`\n${q}`); for (const [k, p] of Object.entries(tables)) { const r = rank(q, p); console.log(`  ${k.padEnd(8)} place: ${r.cats.join(', ').padEnd(70)} figs: ${r.figs.join(', ')}`); } }
