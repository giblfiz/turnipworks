// THE CYBERPUNK PACK IN THE TREE AND THE BAR (Harry 2026-11-07: "a pawn pack for shadowrun ... decker/street sam/shaman/
// mage whatever orc / dwarf/troll. Also NPCs for modern. And while we are at it add a robot race."; docs/PAWNS.md
// "The cyberpunk pack"; client/pawntree.js, client/figsearch.js, client/barwords.js FIGURE_WORDS).
//   node engine/test/pawntree.test.mjs
// 1. the tree: every figure has exactly one place; ONE root, Modern (Harry, the same day: "we basically don't need to
//    distinguish between cyberpunk and modern now"; there was a Cyberpunk root beside it): Modern ▸ Runners ▸ the nine
//    archetypes (each a grid of several metatypes), the NPCs by where a GM meets them, and Robots; the old four roots
//    and their keys are unchanged; a figure whose `setting` is of the modern genre joins that same root, never a second
// 2. a root's key never takes a letter the Pawns menu's home view already uses (C the whole cast, O party notes, ...)
// 3. trolls stand on a 10-ft base (Large: two squares a side), ork and orc both find the orks
// 4. the bar: archetype, metatype and role words find the pack's figures; cyberpunk, shadowrun, sprawl and modern find all
//    of them; "troll" alone is still the fantasy troll
import fs from 'node:fs';
import { buildPawnTree, genresFrom, ROOT_KEYS_TAKEN, GRID_CAP } from '../client/pawntree.js';
import { figureSearch } from '../client/figsearch.js';
import { teachFigures } from '../client/barwords.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const list = teachFigures(JSON.parse(fs.readFileSync(new URL('../tuner-data/figures.json', import.meta.url))).figures);
const X = buildPawnTree(list);
const byId = new Map(list.map(f => [f.id, f]));
const pack = list.filter(f => ['runner', 'modern', 'robot'].includes(f.group));

// ---- 1. the tree
ok(pack.length >= 45, 'the catalog has the cyberpunk pack (runners, modern NPCs, robots)', pack.length);
const leaves = []; const walk = (n) => { if (n.figs) leaves.push(...n.figs.map(f => [f.id, n.id])); for (const c of n.children || []) walk(c); }; X.roots.forEach(walk);
ok(leaves.length === list.length && new Set(leaves.map(x => x[0])).size === list.length, 'every figure has exactly one place in the tree', [leaves.length, list.length]);
ok(JSON.stringify(X.roots.slice(0, 4).map(r => `${r.hot}:${r.label}`)) === JSON.stringify(['h:Heroes', 't:Townsfolk', 'm:Monsters', 'a:Animals']), 'the first four roots and their keys are unchanged', X.roots.map(r => `${r.hot}:${r.label}`));
const M = X.get('modern');
ok(!X.roots.some(r => /cyberpunk/i.test(r.label) || r.id === 'cyberpunk') && X.roots.filter(r => r.label === 'Modern').length === 1, 'no Cyberpunk root: one Modern root', X.roots.map(r => r.label));
ok(M && M.label === 'Modern' && M.hot === 'd' && JSON.stringify(M.children.map(c => `${c.hot}:${c.label}`)) === JSON.stringify(['r:Runners', 'l:Law and security', 'c:Corporate', 's:Streets', 'o:Robots']), 'D: Modern ▸ Runners, Law and security, Corporate, Streets, Robots', M?.children.map(c => `${c.hot}:${c.label}`));
ok(M && M.n === pack.length, 'every runner, modern NPC and robot is under Modern', [M?.n, pack.length]);
const RU = X.get('modern/runners');
const arche = ['Street samurai', 'Decker', 'Rigger', 'Mage', 'Shaman', 'Physical adept', 'Face', 'Technomancer', 'Mercenary'];
ok(RU && JSON.stringify(RU.children.map(c => c.label)) === JSON.stringify(arche) && RU.n === pack.filter(f => f.group === 'runner').length, 'Modern ▸ Runners ▸ the nine archetypes, every runner among them', RU?.children.map(c => c.label));
for (const n of RU?.children || []) {
  const races = new Set(n.figs.map(f => f.race));
  ok(n.figs.length >= 2 && races.size >= 2 && n.figs.every(f => f.group === 'runner' && f.thumb), `${n.label}: a grid of runners of ${races.size} metatypes, each with its picture`, n.figs.map(f => f.id));
  ok(n.figs.every(f => /^(Human|Elf|Dwarf|Ork|Troll) (woman|man)$/.test(n.leaf.label(f, n))), `${n.label}: each tile says its metatype and sex`, n.figs.map(f => n.leaf.label(f, n)));
  ok(n.word === 'Archetype' && n.level === 2, `${n.label}: the third level, an archetype (its chip's word)`, [n.word, n.level]);
}
const metas = {}; for (const f of pack.filter(f => f.group === 'runner')) metas[f.race] = (metas[f.race] || 0) + 1;
ok(['human', 'elf', 'dwarf', 'ork', 'troll'].every(r => metas[r] >= 3), 'every metatype appears several times among the runners', metas);
const R = X.get('modern/robots');
ok(R && R.figs.length >= 8 && R.figs.length <= GRID_CAP && R.figs.every(f => f.race === 'robot' && f.group === 'robot') && R.n === pack.filter(f => f.group === 'robot').length, 'Robots: the robot people in one grid (a race of their own), no "more…"', R?.figs.map(f => f.id));
ok(R && R.figs.every(f => R.leaf.label(f, R) === f.name) && R.more === 'robot', 'a robot tile is labelled by its own name (not "Robot man")', R?.figs.map(f => R.leaf.label(f, R)));
const npc = ['modern/law', 'modern/corp', 'modern/streets'].map(id => X.get(id));
ok(npc.every(c => c && c.figs.length >= 3 && c.figs.every(f => f.group === 'modern')) && npc.reduce((a, c) => a + c.n, 0) === pack.filter(f => f.group === 'modern').length, 'Law and security, Corporate, Streets: every modern NPC, right in Modern (no tile of their own above them)', npc.map(c => `${c?.label} ${c?.n}`));
ok(X.pathOf('modern/runners/decker').map(n => n.label).join(' ▸ ') === 'Modern ▸ Runners ▸ Decker' && X.pathOf('modern/robots').map(n => n.label).join(' ▸ ') === 'Modern ▸ Robots', 'a path into the pack reads as chips', X.pathOf('modern/runners/decker').map(n => n.label));
// a runner that ever carries a room code of the modern genre (types.json: CYB) joins THIS root as a heading, not a second "Modern"
const types = JSON.parse(fs.readFileSync(new URL('../client/data/types.json', import.meta.url)));
const G = genresFrom(types), cyb = types.types.find(t => t.genre === 'modern');
if (cyb) {
  const XG = buildPawnTree([...list, { ...byId.get('cyber-decker-elf-f'), id: 'cyb-test-decker', setting: cyb.code, kin: 'Sprawl', role: 'rogue' }], undefined, { genres: G });
  const MG = XG.roots.filter(r => r.id === 'modern');
  ok(MG.length === 1 && XG.roots.filter(r => r.label === 'Modern').length === 1 && MG[0].children.at(-1).label === 'Sprawl' && MG[0].n === pack.length + 1, `a figure with a modern setting code (${cyb.code}) is a heading in the one Modern root`, XG.roots.map(r => `${r.id}:${r.label}`));
}

// ---- 2. keys
ok(X.roots.every(r => r.hot && !ROOT_KEYS_TAKEN.includes(r.hot)) && new Set(X.roots.map(r => r.hot)).size === X.roots.length, 'each root has its own key, none of them a letter the home view already uses', X.roots.map(r => `${r.hot}:${r.label}`));
ok(['c', 'o'].every(k => ROOT_KEYS_TAKEN.includes(k)), 'C (the whole cast) and O (party notes) are kept for the home view');
for (const n of [M, RU]) ok(n && new Set(n.children.map(c => c.hot)).size === n.children.length && n.children.every(c => c.hot), `${n?.label}: every tile has its own key`, n?.children.map(c => c.hot));

// ---- 3. sizes and peoples
const trolls = pack.filter(f => f.race === 'troll');
ok(trolls.length >= 4 && trolls.every(f => f.size === 2 && f.base === 10 && f.h >= 8), 'trolls are Large: a 10-ft base, two squares a side, 8 ft and more', trolls.map(f => `${f.id} ${f.size} ${f.h}`));
ok(pack.filter(f => f.race !== 'troll' && f.id !== 'robot-war-frame').every(f => f.size === 1), 'every other figure of the pack is one square');
ok(byId.get('robot-war-frame')?.size === 2, 'the war robot is Large too');
ok(pack.filter(f => f.race === 'ork').every(f => f.tags.includes('ork') && f.tags.includes('orc')), 'an ork is tagged both ork and orc');

// ---- 4. the bar
const search = figureSearch(list), top = (q) => search(q)[0]?.fig, tops = (q, n = 5) => search(q, { limit: n }).map(r => r.fig.id);
const T = (q, want, m) => { const t = top(q); ok(t && (typeof want === 'function' ? want(t) : t.id === want), m || `"${q}" -> ${want}`, `${q} -> ${t?.id}`); };
T('troll street samurai', 'cyber-street-samurai-troll-m');
T('street samurai', (f) => f.cls === 'street-samurai', '"street samurai" finds a street samurai');
T('decker', (f) => f.cls === 'decker', '"decker" finds a decker');
T('ork rigger', 'cyber-rigger-ork-m'); T('orc rigger', 'cyber-rigger-ork-m');
T('elf mage', 'cyber-mage-elf-m');
T('dwarf technomancer', 'cyber-technomancer-dwarf-f');
T('physical adept', (f) => f.cls === 'adept', '"physical adept" finds an adept');
T('street shaman', (f) => f.cls === 'shaman', '"street shaman" finds a runner shaman');
ok(tops('shaman', 5).filter(i => i.startsWith('cyber-shaman-')).length >= 2, '"shaman": the runner shamans are in the first five (after the Orc shaman, whose own name it is)', tops('shaman', 5));
T('robot', (f) => f.race === 'robot', '"robot" finds a robot');
T('android', 'robot-infiltrator'); T('war robot', 'robot-war-frame'); T('rotor drone', 'robot-rotor-drone');
T('cop', (f) => f.cls === 'police', '"cop" finds a police officer'); T('swat', 'modern-tactical-m'); T('street doc', 'modern-streetdoc-m');
T('fixer', 'modern-fixer-m'); T('bouncer', 'modern-bouncer-m'); T('ganger', (f) => f.cls === 'ganger', '"ganger" finds a ganger');
T('shadowrunner', (f) => f.group === 'runner', '"shadowrunner" (a search word only) finds a runner');
T('netrunner', (f) => f.cls === 'decker', '"netrunner" (a search word only) finds a decker');
for (const q of ['cyberpunk', 'shadowrun', 'sprawl', 'modern']) ok(search(q, { limit: 0 }).filter(r => pack.includes(r.fig)).length === pack.length, `"${q}" finds every runner, modern NPC and robot (one Modern root, one set of words)`, search(q, { limit: 0 }).length);
T('troll', 'foe-troll', '"troll" alone is still the fantasy troll (its own name)');
ok(tops('troll', 8).filter(i => i.startsWith('cyber-') || i.startsWith('modern-')).length >= 3, '... and the troll runners follow it', tops('troll', 8));
// the publisher's word and the jargon are SEARCH words (barwords.js), never in the figures' own data
const raw = JSON.parse(fs.readFileSync(new URL('../tuner-data/figures.json', import.meta.url))).figures.filter(f => ['runner', 'modern', 'robot'].includes(f.group));
ok(raw.every(f => !/shadowrun|netrunner|ripperdoc|replicant|johnson/i.test(JSON.stringify(f))), 'no publisher or genre trademark in the figures\' names, tags or ids');

console.log(`pawntree: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
