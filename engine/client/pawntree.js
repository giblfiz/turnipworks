// THE TREE OF MINIS (docs/PAWNS.md, "Placing a pawn is a tree, like Build, not a search box"). Two levels, then a grid
// of thumbnails, made from the figures' own data (group, cls, race, gender, family, tags, size in the published list:
// tools/spawn-tuner/data/figures.json).
// Harry: "wing it for the tree of minis, we will probably have to revisit it some day". So THE SHAPE OF THE TREE IS THIS
// ONE TABLE: to move a creature, rename a family or add a branch, edit PAWN_TREE and nothing else. The Pawns menu's
// "Place a pawn" and the figure picker in Settings ▸ Me ▸ My pawns both read it (surfaces/figtree.js).
//   a root      { key, label, pic (a figure id for its tile), groups: the figures it holds (their `group`),
//                 by: 'cls' | 'family-table' | null (null: no second level, one grid),
//                 subs (by 'cls'): which classes get a tile of their own, in order; '*' = every class, by name
//                 gather (by 'cls'): [{ key, label, cls: [...] }] the classes that share a tile; `rest` takes what is left
//                 families (by 'family-table'): [{ key, label, family: [...], tags: [...], ids: [...] }] first match wins
//                 rest: label of the tile for what no entry claims
//                 leaf: { cols, sort: [field...], label: (f) => string } how its grids are laid out }
// A grid shows at most GRID_CAP figures; one that has more ends in "more…", which fills the command bar with that
// family (the bar is "the intended main UI"). A large creature sits in its family with a size mark; "large" is not a kind.
export const GRID_CAP = 15;
const RACES = ['human', 'elf', 'dwarf', 'small', 'orc', 'tiefling', 'dragonborn'];
const RACE_LABEL = { small: 'Small-folk' };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const raceLabel = (r) => RACE_LABEL[r] || cap(r || '');
const short = (f) => f.name.split(/[,(]/)[0].trim();
// what a figure is called on its tile, when the tile above it already says the rest
const afterComma = (f) => { const m = f.name.match(/,\s*(.+)$/); return m ? cap(m[1]) : f.name; };

export const PAWN_TREE = [
  { key: 'heroes', label: 'Heroes', pic: 'hero-fighter-human-m', groups: ['hero'], by: 'cls', subs: '*',
    leaf: { cols: 2, sort: ['race', 'gender'], label: (f) => `${raceLabel(f.race)} ${f.gender === 'f' ? 'woman' : 'man'}` } },
  { key: 'townsfolk', label: 'Townsfolk', pic: 'town-human-innkeeper', groups: ['townsfolk'], by: 'cls',
    subs: ['commoner', 'innkeeper', 'merchant', 'guard', 'smith', 'priest', 'noble', 'elder', 'child'],
    gather: [
      { key: 'tavern', label: 'Tavern', cls: ['barmaid', 'barman', 'cook', 'drunk', 'gambler', 'minstrel', 'serving', 'jester'] },
      { key: 'trades', label: 'Trades', cls: ['alchemist', 'baker', 'butcher', 'carpenter', 'fishmonger', 'miner', 'pedlar', 'tailor', 'woodcutter', 'stable', 'shepherd', 'hunter', 'scribe'] },
      { key: 'court', label: 'Court', cls: ['king', 'queen', 'princess', 'vizier', 'herald', 'messenger', 'sage', 'scholar'] },
      { key: 'law', label: 'Law and faith', cls: ['constable', 'jailer', 'soldier', 'veteran', 'nun', 'pilgrim', 'fortune'] },
      { key: 'streets', label: 'Streets and docks', cls: ['beggar', 'crone', 'thief', 'urchin', 'smuggler', 'sailor', 'ship'] },
    ], rest: 'Other folk',
    leaf: { cols: 3, sort: ['race', 'gender', 'name'], label: (f) => f.race ? `${raceLabel(f.race)}${f.gender ? (f.gender === 'f' ? ' woman' : ' man') : ''}` : short(f) } },
  { key: 'monsters', label: 'Monsters', pic: 'foe-owlbear', groups: ['foe', 'large'], by: 'family-table',
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
      { key: 'wild', label: 'Wild beasts', ids: ['foe-wolf', 'foe-dire-wolf', 'foe-boar', 'foe-crocodile', 'foe-death-dog', 'foe-giant-bat', 'foe-giant-frog', 'foe-giant-snake', 'foe-triceratops', 'foe-tyrannosaur', 'foe-giant-eagle', 'foe-owlbear'] },
    ], rest: 'Monsters of legend',
    leaf: { cols: 3, sort: ['size', 'name'], label: (f, node) => node?.single ? afterComma(f) : f.name } },
  { key: 'animals', label: 'Animals', pic: 'beast-horse', groups: ['beast'], by: null, leaf: { cols: 3, sort: ['name'], label: (f) => f.name } },
];

// the tree as nodes: { id, label, pic (a figure), children: [node] | null, figs: [figure] | null, more (the bar's words) }
export function buildPawnTree(list, table = PAWN_TREE) {
  const byId = new Map(list.map(f => [f.id, f]));
  const sorted = (figs, leaf) => figs.slice().sort((a, b) => { for (const k of leaf.sort || ['name']) { const va = k === 'race' ? RACES.indexOf(a.race) : a[k] ?? '', vb = k === 'race' ? RACES.indexOf(b.race) : b[k] ?? ''; if (va < vb) return -1; if (va > vb) return 1; } return 0; });
  const roots = [];
  for (const R of table) {
    const mine = list.filter(f => R.groups.includes(f.group));
    if (!mine.length) continue;
    const root = { id: R.key, label: R.label, pic: byId.get(R.pic) || mine[0], children: null, figs: null, leaf: R.leaf, level: 0, n: mine.length };
    const sub = (key, label, figs, words, extra = {}) => ({ id: `${R.key}/${key}`, label, pic: figs.find(f => /boss|chief/.test(f.id)) && R.key !== 'monsters' ? figs[0] : figs[0], children: null, figs: sorted(figs, R.leaf), leaf: R.leaf, level: 1, n: figs.length, more: words, ...extra });
    if (!R.by) { root.figs = sorted(mine, R.leaf); root.more = R.label.toLowerCase().replace(/s$/, ''); }
    else if (R.by === 'cls') {
      const left = new Map(); for (const f of mine) { if (!left.has(f.cls)) left.set(f.cls, []); left.get(f.cls).push(f); }
      const out = [], own = R.subs === '*' ? [...left.keys()].sort() : R.subs;
      for (const c of own) if (left.has(c)) { out.push(sub(c, cap(c.replace(/-/g, ' ')), left.get(c), c.replace(/-/g, ' '))); left.delete(c); }
      for (const g of R.gather || []) { const figs = g.cls.flatMap(c => { const v = left.get(c) || []; left.delete(c); return v; }); if (figs.length) out.push(sub(g.key, g.label, figs, g.cls[0])); }
      const rest = [...left.values()].flat(); if (rest.length) out.push(sub('rest', R.rest || 'Others', rest, R.label.toLowerCase()));
      root.children = out;
    } else if (R.by === 'family-table') {
      const left = new Set(mine), out = [];
      for (const fam of R.families) {
        const figs = [...left].filter(f => (fam.family || []).includes(f.family) || (fam.ids || []).includes(f.id) || (fam.tags || []).some(t => (f.tags || []).includes(t)));
        for (const f of figs) left.delete(f);
        if (figs.length) out.push(sub(fam.key, fam.label, figs, (fam.family || fam.tags || [fam.label.toLowerCase()])[0], { single: (fam.family || []).length === 1 && !fam.tags }));
      }
      if (left.size) out.push(sub('rest', R.rest || 'Others', [...left], 'monster'));
      root.children = out;
    }
    roots.push(root);
  }
  // a hotkey letter per node, unique among its siblings (never P: that is the menu's own key)
  const hot = (nodes) => { const used = new Set(['p']); for (const n of nodes) { n.hot = [...n.label.toLowerCase()].find(c => /[a-z]/.test(c) && !used.has(c)) || [...'abcdefghijklmnoqrstuvwxyz0123456789'].find(c => !used.has(c)) || null; if (n.hot) used.add(n.hot); if (n.children) hot(n.children); } };
  hot(roots);
  const index = new Map(); const walk = (n) => { index.set(n.id, n); for (const c of n.children || []) walk(c); }; roots.forEach(walk);
  return { roots, get: (id) => index.get(id) || null, pathOf: (id) => { const parts = String(id || '').split('/'); return parts.map((_, i) => index.get(parts.slice(0, i + 1).join('/'))).filter(Boolean); } };
}
