// THE PAWN TREE'S GENRE ROOTS (2026-11-07, culture pawns; docs/PAWNS.md "Pawns by culture"; client/pawntree.js).
//   node engine/test/pawntree_genres.test.mjs
// Harry 2026-11-07: "probably need some pawns by culture ... a armored fighter, rouge-like, and caster for each race".
// A figure with a room pack's `setting` code lands in the Pawns menu under that pack's GENRE (the Build tray's own word,
// types.json from engine/tools/build_types.py: one place), a heading per culture (`kin`), and nowhere else.
// 1. a stand-in list: the genre root, its label from the types data (and a renamed genre renames the root), headings in
//    the types' order, fighter / rogue / caster first, the short tile label, not also in Heroes or Townsfolk
// 2. root hotkeys never take the Pawns menu's own letters (C, F, G, N, O, P)
// 3. genresFrom: the taxonomy's shape and types.json's give the same answer
// 4. the real catalog (tools/spawn-tuner/data/figures.json) with the real types.json: every figure has exactly one place,
//    and every culture figure (if the catalog has them yet) is under Cultures ▸ its own culture with all three roles
import fs from 'node:fs';
import { buildPawnTree, genresFrom, PAWN_TREE } from '../client/pawntree.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const types = JSON.parse(fs.readFileSync(new URL('../client/data/types.json', import.meta.url)));
const G = genresFrom(types);

// 1. a stand-in list
const fig = (id, o) => ({ id, name: id, group: 'hero', tags: [], size: 1, h: 6, ...o });
const list = [
  fig('hero-fighter-human-m', { cls: 'fighter', race: 'human', gender: 'm' }),
  fig('town-human-merchant', { group: 'townsfolk', cls: 'merchant', race: 'human', gender: 'm' }),
  fig('cul-jpn-sake-merchant', { group: 'townsfolk', cls: 'merchant', name: 'Japanese sake merchant', tile: 'Sake merchant', setting: 'JPN', kin: 'Japan', role: 'npc' }),
  fig('cul-jpn-onmyoji', { cls: 'onmyoji', name: 'Japanese onmyoji', tile: 'Onmyoji', setting: 'JPN', kin: 'Japan', role: 'caster' }),
  fig('cul-jpn-samurai', { cls: 'fighter', name: 'Japanese samurai', tile: 'Samurai', setting: 'JPN', kin: 'Japan', role: 'fighter' }),
  fig('cul-jpn-shinobi', { cls: 'rogue', name: 'Japanese spy', tile: 'Spy', setting: 'JPN', kin: 'Japan', role: 'rogue' }),
  fig('cul-nrs-volva', { cls: 'seer', name: 'Norse volva', tile: 'Volva', setting: 'NRS', kin: 'Norse', role: 'caster' }),
  fig('cul-nrs-shieldmaiden', { cls: 'fighter', name: 'Norse shieldmaiden', tile: 'Shieldmaiden', setting: 'NRS', kin: 'Norse', role: 'fighter', gender: 'f' }),
];
const X = buildPawnTree(list, PAWN_TREE, { genres: G });
const label = types.genres.find(g => g.key === 'cultures')?.label;
const C = X.get('cultures');
ok(label && C && C.label === label, `a root for the genre, named as the Build tray names it ("${label}")`, C?.label);
ok(C?.children?.map(k => k.label).join() === 'Norse,Japan', 'a heading per culture, in the types data\'s order (NRS before JPN in types.json)', C?.children?.map(k => k.label));
const J = X.get('cultures/jpn');
ok(J && J.figs.map(f => f.id).join() === 'cul-jpn-samurai,cul-jpn-shinobi,cul-jpn-onmyoji,cul-jpn-sake-merchant', 'Japan: fighter, rogue, caster, then the NPCs', J?.figs?.map(f => f.id));
ok(J && J.leaf.label(J.figs[0], J) === 'Samurai', 'a tile says its `tile` word ("Samurai": the heading already says Japan), not "Japanese samurai"', J && J.leaf.label(J.figs[0], J));
const heroes = X.get('heroes'), town = X.get('townsfolk');
const inside = (n) => n ? (n.figs || []).concat(...(n.children || []).map(inside)) : [];
ok(heroes && !inside(heroes).some(f => f.setting) && inside(heroes).length === 1, 'the culture fighters are not ALSO in Heroes', inside(heroes).map(f => f.id));
ok(town && !inside(town).some(f => f.setting) && inside(town).length === 1, 'the culture NPCs are not ALSO in Townsfolk', inside(town).map(f => f.id));
ok(X.roots.reduce((a, r) => a + r.n, 0) === list.length, 'every figure has a place, once', X.roots.map(r => `${r.id}:${r.n}`));
ok(X.pathOf('cultures/jpn').map(n => n.label).join(' ▸ ') === `${label} ▸ Japan`, 'its path reads Cultures ▸ Japan', X.pathOf('cultures/jpn').map(n => n.label));
// the label lives in the types data only: rename the genre there and the root follows
const renamed = { ...types, genres: types.genres.map(g => g.key === 'cultures' ? { ...g, label: 'Peoples of the world' } : g) };
ok(buildPawnTree(list, PAWN_TREE, { genres: genresFrom(renamed) }).get('cultures')?.label === 'Peoples of the world', 'renaming the genre in the types data renames the Pawns menu\'s root (one place)');
// a figure with its own genre and no room code (a lane whose rooms are not built yet)
const own = buildPawnTree([...list, fig('spc-x', { genre: 'space', kin: 'Station', role: 'rogue' })], PAWN_TREE, { genres: G });
ok(own.get('space')?.children?.[0]?.label === 'Station' && own.get('space').n === 1, 'a figure\'s own `genre` and `kin` make a root and a heading too', own.roots.map(r => r.id));
// ... but a genre that IS a root of the table (Modern, 2026-11-07: the Build tray's genre and the Pawns menu's root are one
// word) adds its heading to that root: never two roots called Modern
const mod = buildPawnTree([...list, fig('cyber-x', { group: 'runner', cls: 'decker', race: 'elf', gender: 'f' }), fig('mod-x', { group: 'runner', genre: 'modern', kin: 'Sprawl', role: 'rogue' })], PAWN_TREE, { genres: G });
ok(mod.roots.filter(r => r.id === 'modern' || r.label === 'Modern').length === 1 && mod.get('modern')?.children?.map(c => c.label).join() === 'Runners,Sprawl' && mod.get('modern').n === 2, 'a figure of the modern genre is a heading in the one Modern root, beside Runners', mod.roots.map(r => `${r.id}:${r.label}`));

// 1b. THE GRID (2026-11-07): a culture with several races is Regional ▸ India ▸ a tile per race ▸ fighter, rogue, caster;
//     its NPCs one more tile, Townsfolk, after the races
const ind = [];
for (const race of ['tiefling', 'human', 'dwarf']) for (const role of ['caster', 'fighter', 'rogue']) ind.push(fig(`cul-ind-${race}-${role}`, { race, role, cls: role, name: `Rajasthani ${race} ${role}`, tile: role, setting: 'IND', kin: 'India' }));
ind.push(fig('cul-ind-panihari', { group: 'townsfolk', race: 'human', role: 'npc', name: 'Rajasthani water carrier', setting: 'IND', kin: 'India' }));
ind.push(fig('cul-ind-dwarf-npc', { group: 'townsfolk', race: 'dwarf', role: 'npc', name: 'Rajasthani dwarf potter', setting: 'IND', kin: 'India' }));
const XI = buildPawnTree([...list, ...ind], PAWN_TREE, { genres: G }), I = XI.get('cultures/ind');
ok(I && I.children?.map(c => c.label).join() === 'Human,Dwarf,Tiefling,Townsfolk', 'India: a tile per race in the house order (Human, Dwarf, Tiefling), then Townsfolk', I?.children?.map(c => c.label));
const IT = XI.get('cultures/ind/tiefling');
ok(IT && IT.figs.map(f => f.role).join() === 'fighter,rogue,caster' && XI.pathOf(IT.id).map(n => n.label).join(' ▸ ') === `${label} ▸ India ▸ Tiefling`, 'Regional ▸ India ▸ Tiefling: fighter, rogue, caster', IT && XI.pathOf(IT.id).map(n => n.label));
ok(XI.get('cultures/ind/townsfolk')?.figs.length === 2, 'its NPCs, of any race, under Townsfolk', XI.get('cultures/ind/townsfolk')?.figs.map(f => f.id));
ok(XI.get('cultures/jpn')?.figs?.length === 4, 'a culture of one race stays one grid (Japan here)');
ok(XI.roots.reduce((a, r) => a + r.n, 0) === list.length + ind.length, 'still every figure once');
const hk = (n) => n.children.map(c => c.hot); ok(new Set(hk(I)).size === I.children.length && hk(I).every(Boolean), 'every race tile has its own key', hk(I));

// 2. root hotkeys
const taken = ['b', 'c', 'f', 'g', 'n', 'o', 'p'];
ok(X.roots.every(r => r.hot && !taken.includes(r.hot)), 'no root takes B, C, F, G, N, O or P (the Pawns menu\'s own keys, ROOT_KEYS_TAKEN)', X.roots.map(r => `${r.label}:${r.hot}`));
ok(X.get('cultures')?.hot === label[0].toLowerCase() || !taken.includes(X.get('cultures')?.hot), `${label} has a key of its own (${X.get('cultures')?.hot})`, X.get('cultures')?.hot);
ok(X.roots.filter(r => ['heroes', 'townsfolk', 'monsters', 'animals'].includes(r.id)).map(r => r.hot).join('') === 'ht', 'Heroes and Townsfolk keep H and T', X.roots.map(r => r.hot));

// 3. genresFrom: the taxonomy's shape
const nodes = new Map();
for (const g of types.genres) nodes.set(`g:${g.key}`, { id: `g:${g.key}`, level: 'genre', key: g.key, label: g.label });
for (const t of types.types) nodes.set(`t:${t.code}`, { id: `t:${t.code}`, level: 'type', code: t.code, parent: `g:${t.genre}`, label: t.label });
const T = genresFrom({ nodes });
ok(types.types.every(t => T.of(t.code) === G.of(t.code)) && types.genres.every(g => T.label(g.key) === G.label(g.key)), 'the taxonomy and types.json give the same genres');
ok(genresFrom(null) === null, 'no genres data: null (the tree still builds)');
const bare = buildPawnTree(list, PAWN_TREE, {});
ok(bare.roots.reduce((a, r) => a + r.n, 0) === list.length && !inside(bare.get('heroes')).some(f => f.setting), 'without the types data the culture figures still have one place, outside Heroes', bare.roots.map(r => r.id));

// 4. the real catalog
const real = JSON.parse(fs.readFileSync(new URL('../../tools/spawn-tuner/data/figures.json', import.meta.url))).figures;
const R = buildPawnTree(real, PAWN_TREE, { genres: G });
ok(R.roots.reduce((a, r) => a + r.n, 0) === real.length, 'the real catalog: every figure has exactly one place', `${R.roots.reduce((a, r) => a + r.n, 0)} of ${real.length}`);
ok(!R.roots.some(r => /cyberpunk/i.test(r.label)) && R.roots.filter(r => r.label === 'Modern').length === 1, 'the real catalog: one Modern root, no Cyberpunk root (Harry 2026-11-07)', R.roots.map(r => r.label));
const cul = real.filter(f => f.setting);
if (cul.length) {
  const RC = R.get('cultures');
  ok(RC && RC.n === cul.length, `the real catalog: all ${cul.length} culture figures under ${label}`, RC?.n);
  for (const k of RC?.children || []) {
    const kids = k.children || [], races = kids.filter(c => c.label !== 'Townsfolk'), town = kids.find(c => c.label === 'Townsfolk');
    ok(races.length >= 7 && races.every(r => r.figs.map(f => f.role).join() === 'fighter,rogue,caster'), `${k.label}: every race (${races.length}) has its armoured fighter, rogue and caster`, races.map(r => `${r.label}:${r.figs.map(f => f.role)}`));
    ok(town && town.figs.length >= 3, `${k.label}: 3+ NPCs under Townsfolk`, town?.figs?.length);
    const all = kids.flatMap(c => c.figs);
    ok(all.every(f => f.thumb && f.url && f.name && f.tags.length >= 4), `${k.label}: every figure has a file, a picture, a name and search words`);
  }
} else console.log('(the catalog has no culture figures yet: part 4 checks the stand-in only)');

console.log(`pawntree_genres: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
