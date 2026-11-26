// THE TREE OF MINIS (docs/PAWNS.md, "Placing a pawn is a tree, like Build, not a search box"). Two levels (three in Modern
// and Regional), then a grid
// of thumbnails, made from the figures' own data (group, cls, race, gender, family, tags, size in the published list:
// tools/spawn-tuner/data/figures.json).
// Harry: "wing it for the tree of minis, we will probably have to revisit it some day". So THE SHAPE OF THE TREE IS THIS
// ONE TABLE: to move a creature, rename a family or add a branch, edit PAWN_TREE and nothing else. The Pawns menu's
// "Place a pawn" and the figure picker in Settings ▸ Me ▸ My pawns both read it (surfaces/figtree.js).
//   a root      { key, label, pic (a figure id for its tile), groups: the figures it holds (their `group`),
//                 by: 'cls' | 'family-table' | null (null: no second level, one grid),
//                 subs (by 'cls'): which classes get a tile of their own, in order; '*' = every class, by name
//                 names (by 'cls'): a tile's label when it is not the class written out ('adept' -> 'Physical adept')
//                 gather (by 'cls'): [{ key, label, cls: [...] }] the classes that share a tile; `rest` takes what is left
//                 families (by 'family-table'): [{ key, label, family: [...], tags: [...], ids: [...] }] first match wins
//                 rest: label of the tile for what no entry claims
//                 leaf: { cols, sort: [field...], label: (f) => string } how its grids are laid out,
//                 word: what its tiles are, for the breadcrumb chips ("Classes", "Families": surfaces/where.js) }
//   by: 'sections' (2026-11-07, Modern): sections: [ a root's own shape (key, label, groups, by, subs, gather, rest, leaf,
//                 more: its bar words, word: what its tiles are, for the chips) ], each a tile holding its figures, one
//                 level deeper (Modern ▸ Runners ▸ Decker); a section with `inline: true` puts its tiles in the root itself
//   by: 'genre' (2026-11-07, culture pawns): ONE entry that becomes a root PER GENRE among the figures that have one (a
//                 room pack's `setting` code, whose genre and label are the Build tray's own: types.json, from
//                 engine/tools/build_types.py GENRES, so "Cultures" is spelt in one place; or a figure's own `genre`), a
//                 heading per `kin` ("India"), then a tile per race (and Townsfolk for its NPCs), then the grid. A figure with a genre is in its genre's root ONLY, never also
//                 in Heroes or Townsfolk (Harry: "lands in the Pawns menu under its culture").
// A grid shows at most GRID_CAP figures; one that has more ends in "more…", which fills the command bar with that
// family (the bar is "the intended main UI"). A large creature sits in its family with a size mark; "large" is not a kind.
export const GRID_CAP = 15;
// letters the Pawns menu's home view already uses (surfaces/pawns.js: P the menu, O party notes, N new pawn, C the whole
// cast, G save a group, F search, B the Build menu beside it): a root of the tree never takes one
export const ROOT_KEYS_TAKEN = ['p', 'o', 'n', 'c', 'g', 'f', 'b'];
const RACES = ['human', 'elf', 'dwarf', 'small', 'orc', 'tiefling', 'dragonborn', 'ork', 'troll', 'robot']; // (ork, troll, robot: the cyberpunk pack, 2026-11-07)
const RACE_LABEL = { small: 'Small-folk' };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const raceLabel = (r) => RACE_LABEL[r] || cap(r || '');
const short = (f) => f.name.split(/[,(]/)[0].trim();
// what a figure is called on its tile, when the tile above it already says the rest
const afterComma = (f) => { const m = f.name.match(/,\s*(.+)$/); return m ? cap(m[1]) : f.name; };

export const PAWN_TREE = [
  { key: 'heroes', label: 'Heroes', pic: 'hero-fighter-human-m', groups: ['hero'], by: 'cls', subs: '*', word: 'Class',
    leaf: { cols: 2, sort: ['race', 'gender'], label: (f) => `${raceLabel(f.race)} ${f.gender === 'f' ? 'woman' : 'man'}` } },
  { key: 'townsfolk', label: 'Townsfolk', pic: 'town-human-innkeeper', groups: ['townsfolk'], by: 'cls', word: 'Group',
    subs: ['commoner', 'innkeeper', 'merchant', 'guard', 'smith', 'priest', 'noble', 'elder', 'child'],
    gather: [
      { key: 'tavern', label: 'Tavern', cls: ['barmaid', 'barman', 'cook', 'drunk', 'gambler', 'minstrel', 'serving', 'jester'] },
      { key: 'trades', label: 'Trades', cls: ['alchemist', 'baker', 'butcher', 'carpenter', 'fishmonger', 'miner', 'pedlar', 'tailor', 'woodcutter', 'stable', 'shepherd', 'hunter', 'scribe'] },
      { key: 'court', label: 'Court', cls: ['king', 'queen', 'princess', 'vizier', 'herald', 'messenger', 'sage', 'scholar'] },
      { key: 'law', label: 'Law and faith', cls: ['constable', 'jailer', 'soldier', 'veteran', 'nun', 'pilgrim', 'fortune'] },
      { key: 'streets', label: 'Streets and docks', cls: ['beggar', 'crone', 'thief', 'urchin', 'smuggler', 'sailor', 'ship'] },
    ], rest: 'Other folk',
    leaf: { cols: 3, sort: ['race', 'gender', 'name'], label: (f) => f.race ? `${raceLabel(f.race)}${f.gender ? (f.gender === 'f' ? ' woman' : ' man') : ''}` : short(f) } },
  { key: 'monsters', label: 'Monsters', pic: 'foe-owlbear', groups: ['foe', 'large'], by: 'family-table', word: 'Family',
    families: [
      { key: 'goblins', label: 'Goblins', family: ['goblin'] },
      { key: 'orcs', label: 'Orcs', family: ['orc'] },
      { key: 'hobgoblins', label: 'Hobgoblins', family: ['hobgoblin', 'bugbear'] },
      { key: 'kobolds', label: 'Kobolds', family: ['kobold'] },
      { key: 'gnolls', label: 'Gnolls', family: ['gnoll'] },
      { key: 'lizardfolk', label: 'Lizardfolk', family: ['lizardfolk'] },
      { key: 'bandits', label: 'Bandits', family: ['bandit'] },
      { key: 'cultists', label: 'Cultists', family: ['cultist'] },
      { key: 'skeletons', label: 'Skeletons', family: ['skeleton'] },
      { key: 'zombies', label: 'Zombies and ghouls', family: ['zombie', 'ghoul'] },
      { key: 'undead', label: 'Undead', tags: ['undead'] },
      { key: 'dragons', label: 'Dragons', tags: ['dragon'] },
      { key: 'giants', label: 'Giants', tags: ['giant'], ids: ['foe-minotaur'] },
      { key: 'fiends', label: 'Fiends', tags: ['fiend', 'demon', 'devil'] },
      { key: 'elementals', label: 'Elementals', tags: ['elemental', 'genie'] },
      { key: 'constructs', label: 'Constructs', tags: ['construct', 'golem', 'statue'] },
      { key: 'fey', label: 'Fey and celestials', tags: ['fey', 'celestial'] },
      { key: 'vermin', label: 'Vermin', tags: ['vermin', 'insect', 'spider', 'pest'] },
      { key: 'underdark', label: 'Underdark', tags: ['underdark', 'cave', 'dungeon', 'sewer'], ids: ['foe-mimic'] },
      { key: 'oozes', label: 'Oozes and plants', tags: ['ooze', 'plant'] },
      { key: 'sea', label: 'Sea and swamp', tags: ['sea', 'water', 'swamp'] },
      { key: 'shifters', label: 'Shapechangers', tags: ['lycanthrope', 'shapechanger'] },
      // DINOSAURS (2026-11-07, Harry: "let's get our top 8 favorites all done"): the tyrannosaur and triceratops moved here
      // out of Wild beasts with the seven new ones (velociraptor, ankylosaurus, stegosaurus, spinosaurus, brontosaurus,
      // pterodactyl, quetzalcoatlus), one grid of nine under GRID_CAP; the pterosaurs are here too (a table calls them dinosaurs)
      { key: 'dinosaurs', label: 'Dinosaurs', tags: ['dinosaur'] },
      { key: 'wild', label: 'Wild beasts', ids: ['foe-wolf', 'foe-dire-wolf', 'foe-boar', 'foe-crocodile', 'foe-death-dog', 'foe-giant-bat', 'foe-giant-frog', 'foe-giant-snake', 'foe-giant-eagle', 'foe-owlbear'] },
    ], rest: 'Monsters of legend',
    leaf: { cols: 3, sort: ['size', 'name'], label: (f, node) => node?.single ? afterComma(f) : f.name } },
  { key: 'animals', label: 'Animals', pic: 'beast-horse', groups: ['beast'], by: null, leaf: { cols: 3, sort: ['name'], label: (f) => f.name } },
  // MODERN (2026-11-07): the cyberpunk pack (Harry: "a pawn pack for shadowrun ... decker/street sam/shaman/mage whatever
  // orc / dwarf/troll. Also NPCs for modern. And while we are at it add a robot race.") and its modern NPCs, ONE root since
  // Harry's "we basically don't need to distinguish between cyberpunk and modern now" (they were Cyberpunk and Modern, the
  // same day). Modern ▸ Runners ▸ an archetype ▸ a grid of metatypes; the NPCs by where a GM meets them (Law and security,
  // Corporate, Streets) beside Runners, not under a tile of their own; Robots (a race of their own: soldier, war frame,
  // infiltrator, stealth, hacker, medic, worker, drones, butler) one grid. The key stays `modern`: it is also the Build
  // tray's genre (types.json), and a figure that ever carries a modern `setting` code joins this root (buildPawnTree).
  { key: 'modern', label: 'Modern', pic: 'cyber-street-samurai-human-m', groups: ['runner', 'modern', 'robot'], by: 'sections', word: 'Group',
    sections: [
      { key: 'runners', label: 'Runners', more: 'runner', groups: ['runner'], by: 'cls', word: 'Archetype',
        subs: ['street-samurai', 'decker', 'rigger', 'mage', 'shaman', 'adept', 'face', 'technomancer', 'merc'],
        names: { 'street-samurai': 'Street samurai', adept: 'Physical adept', merc: 'Mercenary' }, rest: 'Other runners',
        leaf: { cols: 3, sort: ['race', 'gender', 'name'], label: (f) => `${raceLabel(f.race)} ${f.gender === 'f' ? 'woman' : 'man'}` } },
      { inline: true, groups: ['modern'], by: 'cls', subs: [], word: 'Group',   // (inline: its tiles sit in Modern itself, beside Runners)
        gather: [
          { key: 'law', label: 'Law and security', cls: ['police', 'tactical', 'security', 'bouncer'] },
          { key: 'corp', label: 'Corporate', cls: ['exec', 'fixer', 'journalist'] },
          { key: 'streets', label: 'Streets', cls: ['ganger', 'vendor', 'civilian', 'street-doc', 'bartender'] },
        ], rest: 'Other modern folk', more: 'modern',
        leaf: { cols: 3, sort: ['cls', 'race', 'gender'], label: (f) => short(f) } },
      { key: 'robots', label: 'Robots', more: 'robot', groups: ['robot'], by: null, leaf: { cols: 3, sort: ['name'], label: (f) => f.name } },
    ] },
  // THE GENRES' PEOPLE (2026-11-07): Regional ▸ India ▸ Tiefling ▸ the warrior, the spy, the astrologer; Townsfolk after
  // the races. Fighter, rogue and caster in that order (`role`), then the NPCs by name; a tile says its `tile` word
  // ("Spear warrior": the levels above already say India and Tiefling), else its name.
  { key: 'genre', by: 'genre', groups: ['hero', 'townsfolk', 'foe', 'large', 'beast', 'runner', 'modern', 'robot'],   // (every group a root above holds, or one with a genre would be in none)
    leaf: { cols: 3, sort: ['role', 'name'], label: (f) => f.tile || short(f) } },
];
const ROLE_ORDER = { fighter: 0, rogue: 1, caster: 2 };   // then everyone else (npc)
// genreOf(figure) -> its genre key, or null: its own `genre`, else its setting code's genre in the types data
const genreKey = (f, G) => f.genre || (f.setting && G?.of?.(f.setting)) || (f.setting ? 'more' : null);   // ('more': a setting code the types data does not know)
/** The genres as the tree needs them, from the Build tray's taxonomy (client/taxonomy.js: genre nodes `g:<key>` with
 *  their label; type nodes with their setting `code`), or from types.json's own shape ({ genres, types }). */
export function genresFrom(src) {
  if (!src) return null;
  if (src.genres && src.types) {   // types.json
    const of = new Map(src.types.map(t => [t.code, t.genre])), label = new Map(src.genres.map(g => [g.key, g.label]));
    return { of: (c) => of.get(c) || null, label: (k) => label.get(k) || null, order: src.genres.map(g => g.key), codes: src.types.map(t => t.code) };
  }
  if (src.nodes) {                 // the taxonomy
    const nodes = [...src.nodes.values()], of = new Map(), label = new Map(), order = [], codes = [];
    for (const n of nodes) if (n.level === 'genre') { label.set(n.key, n.label); order.push(n.key); }
    for (const n of nodes) if (n.level === 'type' && n.code) { of.set(n.code, String(n.parent || '').replace(/^g:/, '')); codes.push(n.code); }
    return { of: (c) => of.get(c) || null, label: (k) => label.get(k) || null, order, codes };
  }
  return null;
}

// the tree as nodes: { id, label, pic (a figure), children: [node] | null, figs: [figure] | null, more (the bar's words) }
export function buildPawnTree(list, table = PAWN_TREE, { genres = null } = {}) {
  const byId = new Map(list.map(f => [f.id, f]));
  const val = (f, k) => k === 'race' ? RACES.indexOf(f.race) : k === 'role' ? (ROLE_ORDER[f.role] ?? 9) : f[k] ?? '';
  const sorted = (figs, leaf) => figs.slice().sort((a, b) => { for (const k of leaf.sort || ['name']) { const va = val(a, k), vb = val(b, k); if (va < vb) return -1; if (va > vb) return 1; } return 0; });
  // below a root (or a section of one): -> { figs, more } (by null: one grid) or { children } (a tile per class, family, section)
  const fill = (R, mine, id, level) => {
    const sub = (key, label, figs, words, extra = {}) => ({ id: `${id}/${key}`, label, pic: figs[0], children: null, figs: sorted(figs, R.leaf), leaf: R.leaf, level, n: figs.length, more: words, ...(R.word ? { word: R.word } : {}), ...extra });
    if (!R.by) return { figs: sorted(mine, R.leaf), more: R.more || R.label.toLowerCase().replace(/s$/, '') };
    const out = [];
    if (R.by === 'sections') {
      for (const S of R.sections) {
        const figs = mine.filter(f => S.groups.includes(f.group)); if (!figs.length) continue;
        const inner = fill(S, figs, S.inline ? id : `${id}/${S.key}`, S.inline ? level : level + 1);
        if (S.inline && inner.children) { out.push(...inner.children); continue; }
        out.push({ id: `${id}/${S.key || 'rest'}`, label: S.label || R.rest || 'Others', pic: byId.get(S.pic) || figs[0], children: null, figs: null, leaf: S.leaf, level, n: figs.length, more: S.more, ...(R.word ? { word: R.word } : {}), ...inner });
      }
    } else if (R.by === 'cls') {
      const left = new Map(); for (const f of mine) { if (!left.has(f.cls)) left.set(f.cls, []); left.get(f.cls).push(f); }
      const own = R.subs === '*' ? [...left.keys()].sort() : R.subs;
      for (const c of own) if (left.has(c)) { const nm = R.names?.[c] || cap(c.replace(/-/g, ' ')); out.push(sub(c, nm, left.get(c), nm.toLowerCase())); left.delete(c); }
      for (const g of R.gather || []) { const figs = g.cls.flatMap(c => { const v = left.get(c) || []; left.delete(c); return v; }); if (figs.length) out.push(sub(g.key, g.label, figs, g.more || g.cls[0])); }
      const rest = [...left.values()].flat(); if (rest.length) out.push(sub('rest', R.rest || 'Others', rest, R.more || R.label.toLowerCase()));
    } else if (R.by === 'family-table') {
      const left = new Set(mine);
      for (const fam of R.families) {
        const figs = [...left].filter(f => (fam.family || []).includes(f.family) || (fam.ids || []).includes(f.id) || (fam.tags || []).some(t => (f.tags || []).includes(t)));
        for (const f of figs) left.delete(f);
        if (figs.length) out.push(sub(fam.key, fam.label, figs, (fam.family || fam.tags || [fam.label.toLowerCase()])[0], { single: (fam.family || []).length === 1 && !fam.tags }));
      }
      if (left.size) out.push(sub('rest', R.rest || 'Others', [...left], 'monster'));
    }
    return { children: out };
  };
  const roots = [];
  for (const R of table) {
    if (R.by === 'genre') {   // one root per genre, a heading per kin (see the table's note)
      const by = new Map();
      for (const f of list) { const g = genreKey(f, genres); if (g && R.groups.includes(f.group)) { if (!by.has(g)) by.set(g, []); by.get(g).push(f); } }
      const gOrder = [...by.keys()].sort((a, b) => ((genres?.order || []).indexOf(a) + 1 || 99) - ((genres?.order || []).indexOf(b) + 1 || 99));
      for (const g of gOrder) {
        const mine = by.get(g), kins = new Map();
        for (const f of mine) { const k = f.kin || f.setting || 'Others'; if (!kins.has(k)) kins.set(k, []); kins.get(k).push(f); }
        const kOrder = [...kins.keys()].sort((a, b) => { const ia = (genres?.codes || []).indexOf(kins.get(a)[0].setting), ib = (genres?.codes || []).indexOf(kins.get(b)[0].setting); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
        const label = genres?.label?.(g) || (g === 'more' ? 'More people' : cap(g));
        // a culture whose figures are of one race, or few, is one grid; the GRID (culture x race x role, 2026-11-07: Harry's
        // "each race was dragon born /dwarf/ect") is a third level: Regional ▸ India ▸ Tiefling ▸ fighter, rogue, caster,
        // with the culture's NPCs (role 'npc', any race) as one more tile, Townsfolk, after the races
        const kids = kOrder.map(k => {
          const all = kins.get(k), slug = String(all[0].setting || k).toLowerCase().replace(/[^a-z0-9]+/g, '-'), id = `${g}/${slug}`;
          const races = [...new Set(all.filter(f => f.role !== 'npc').map(f => f.race || 'human'))];
          if (all.length <= GRID_CAP && races.length <= 1) { const figs = sorted(all, R.leaf); return { id, label: k, pic: figs[0], children: null, figs, leaf: R.leaf, level: 1, n: figs.length, more: k.toLowerCase(), single: true, word: 'Culture' }; }
          races.sort((a, b) => (RACES.indexOf(a) + 1 || 99) - (RACES.indexOf(b) + 1 || 99));
          const node = (key, label, figs, more) => ({ id: `${id}/${key}`, label, pic: figs[0], children: null, figs, leaf: R.leaf, level: 2, n: figs.length, more, single: true });
          const ch = races.map(r => node(r, raceLabel(r), sorted(all.filter(f => f.role !== 'npc' && (f.race || 'human') === r), R.leaf), `${k.toLowerCase()} ${r === 'small' ? 'halfling' : r}`));
          const npcs = sorted(all.filter(f => f.role === 'npc'), R.leaf); if (npcs.length) ch.push(node('townsfolk', 'Townsfolk', npcs, `${k.toLowerCase()} npc`));
          return { id, label: k, pic: ch[0].pic, children: ch, figs: null, leaf: R.leaf, level: 1, n: all.length, more: k.toLowerCase(), word: 'Culture' };   // (word: what the chips call this level, "Cultures")
        });
        // a genre whose key is a root of the table's own (Modern): its cultures join that root, one root per word
        const same = roots.find(r => r.id === g); if (same) { same.children = [...(same.children || []), ...kids]; same.n += mine.length; continue; }
        roots.push({ id: g, label, pic: kids[0]?.pic || mine[0], children: kids, figs: null, leaf: R.leaf, level: 0, n: mine.length, genre: true });
      }
      continue;
    }
    const mine = list.filter(f => R.groups.includes(f.group) && !genreKey(f, genres));
    if (!mine.length) continue;
    const root = { id: R.key, label: R.label, pic: byId.get(R.pic) || mine[0], children: null, figs: null, leaf: R.leaf, level: 0, n: mine.length };
    Object.assign(root, fill(R, mine, R.key, 1));
    roots.push(root);
  }
  // a hotkey letter per node, unique among its siblings (never P: that is the menu's own key). The ROOTS share the Pawns
  // menu's home keys, so they also keep off the letters that page already uses (ROOT_KEYS_TAKEN; 2026-11-07, when a sixth
  // root, Cyberpunk, would have taken C from "show the whole cast" and Modern O from the party notes; Modern is D).
  const hot = (nodes, taken = ['p']) => { const used = new Set(taken); for (const n of nodes) { n.hot = [...n.label.toLowerCase()].find(c => /[a-z]/.test(c) && !used.has(c)) || [...'abcdefghijklmnoqrstuvwxyz0123456789'].find(c => !used.has(c)) || null; if (n.hot) used.add(n.hot); if (n.children) hot(n.children); } };
  hot(roots, ROOT_KEYS_TAKEN);
  const index = new Map(); const walk = (n) => { index.set(n.id, n); for (const c of n.children || []) walk(c); }; roots.forEach(walk);
  return { roots, get: (id) => index.get(id) || null, pathOf: (id) => { const parts = String(id || '').split('/'); return parts.map((_, i) => index.get(parts.slice(0, i + 1).join('/'))).filter(Boolean); } };
}
