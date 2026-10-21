// THE BAR'S VOCABULARY (2026-10-20, "a nice thick update for the quickbar catalog"): the words GMs and players type that
// a command's own title and synonyms, a catalog thing's name or a figure's tags do not already carry. Kept in ONE table so
// the periodic catalog update has one place to add to; every word here is there because a line of the corpus
// (engine/test/bar-corpus.json, run by engine/test/browser_barcat.py) types it. Words only: no command, title or key is
// made here, and nothing here widens who may see a row (the registry's permission classes still decide that).
//   COMMAND_WORDS   command id, or a prefix ending in '*' -> more synonyms (the bar matches them like the command's own)
//   CATALOG_WORDS   [RegExp over the catalog id, words] -> cat.terms, searched like the name (bar.js; each word whole)
//   FIGURE_WORDS    [RegExp over the figure id, words] -> more tags (figures.js searches tags)
// Also the bar's forgiving word match (`near`), shared by bar.js and figures.js: one typo, or two in a long word.
const n = (k) => ['one', 'two', 'three'][k - 1];
export const COMMAND_WORDS = {
  // ---- whole buildings (the Build tray's Type level) and the room types the generic words most often mean ----
  'build.type.t:TAV': ['tavern', 'inn', 'pub', 'alehouse', 'taproom', 'hostel', 'bar'],
  'build.type.t:NOB': ['mansion', 'manor', 'manor house', 'estate', 'villa', 'noble house', 'stately home'],
  'build.type.t:CAS': ['castle', 'keep', 'fort', 'fortress', 'stronghold', 'citadel', 'palace'],
  'build.type.t:TEM': ['temple', 'church', 'chapel', 'monastery', 'abbey', 'priory', 'holy place'],
  'build.type.t:SMI': ['smithy', 'blacksmith', 'smith', 'forge', 'workshop'],
  'build.type.t:MKT': ['market', 'village', 'town', 'marketplace', 'bazaar', 'hamlet', 'high street', 'shops', 'shop'],
  'build.type.t:HUT': ['farm', 'farmhouse', 'homestead', 'croft', 'ranch'],
  'build.type.t:DUN': ['dungeon', 'dungeons', 'prison', 'jail', 'gaol'],
  'build.type.t:CRY': ['crypt', 'tomb', 'mausoleum', 'graveyard', 'cemetery', 'catacombs', 'barrow', 'necropolis'],
  'build.type.t:ARC': ['wizard tower', 'wizards tower', 'mage tower', 'tower', 'arcane tower', 'sorcerer tower'],
  'build.type.t:CLT': ['cult', 'cult hideout', 'secret cult', 'hideout', 'evil temple', 'dark temple', 'sanctum'],
  'build.type.t:MIN': ['mine', 'mines', 'mineshaft', 'mine shaft', 'quarry', 'dwarven mine'],
  'build.type.t:LAI': ['lair', 'monster lair', 'cave', 'caves', 'cavern', 'den'],
  'build.whole': ['build a building', 'new building', 'generate a building'],
  'build.menu': ['build a room', 'new room', 'room tool', 'draw a room', 'make a room', 'add a room', 'construct'],
  'build.common': ['tavern', 'pub', 'inn', 'bar room', 'taproom'],
  'build.guest': ['bedroom', 'bed chamber'], 'build.mansion-bedroom': ['bedroom'], 'build.mkt-bedroom': ['bedroom'], 'build.hut-bedroom': ['bedroom'],
  'build.chapel': ['chapel', 'church'], 'build.crypt-chapel': ['chapel'], 'build.temple-nave': ['church', 'temple', 'sanctuary', 'worship hall'], 'build.cathedral': ['church'],
  'build.temple-infirmary': ['hospital', 'sickroom', 'healer', 'clinic', 'sick bay'],
  'build.cult-summoning': ['summoning circle room', 'ritual room'], 'build.wiz-summoning': ['summoning room', 'ritual chamber'],
  'build.cult-entry': ['secret entrance', 'hideout entrance'],
  'build.mkt-street': ['street', 'road', 'alley', 'lane'], 'build.mkt-square': ['market', 'town square', 'plaza', 'village green'],
  'build.mkt-general': ['shop', 'store', 'general store'], 'build.mkt-curio': ['magic shop', 'curio shop'],
  'build.min-tunnel': ['mine', 'tunnel'], 'build.min-shaft-head': ['mineshaft', 'mine shaft', 'shaft'], 'build.min-seam': ['crystal cave', 'crystal cavern', 'gem mine'],
  'build.armoury': ['armory'], 'build.smi-armoury': ['armory', 'weaponsmith'],
  'build.dun-cell-block': ['jail', 'jail cell', 'cells', 'cell', 'prison cells', 'dungeon cells'], 'build.dun-interrogation': ['torture chamber', 'torture room'],
  'build.dun-vault': ['vault', 'treasure room', 'treasury'], 'build.crypt-vault': ['vault', 'tomb', 'mausoleum'], 'build.cult-vault': ['vault'],
  'build.dun-trap-corridor': ['trapped corridor', 'trap hallway'], 'build.dun-sewer': ['sewers', 'sewer tunnel', 'drain'],
  'build.crypt-catacomb': ['catacombs', 'catacomb'], 'build.hut-coop': ['chicken coop', 'hen house', 'coop'], 'build.hut-cottage': ['hut', 'cottage', 'shack', 'cabin'],
  'build.lair-mouth': ['cave', 'cave entrance'], 'build.lair-passage': ['cave', 'tunnel'], 'build.lair-warren': ['goblin cave', 'goblin den', 'warren'],
  'build.lair-spider': ['spider lair', 'spider cave'], 'build.lair-dragon': ['dragon lair', 'dragon cave', 'hoard'],
  'build.mansion-garden': ['garden'], 'build.hut-garden': ['garden', 'vegetable patch'],
  'build.privy': ['toilet', 'bathroom', 'latrine', 'loo', 'outhouse', 'restroom', 'water closet'],
  // ---- a whole building, selected ----
  ...Object.fromEntries([1, 2, 3].map(k => [`building.storeys.${k}`, [`${k} storeys`, `${k} stories`, `${n(k)} floors`, `${n(k)} storeys`, `${n(k)} stories`, `${n(k)} levels`]])),
  'building.reroll': ['reroll', 're-roll', 'regenerate', 'shuffle', 'redo building'],
  'room.delete': ['delete building', 'remove room', 'remove building', 'delete', 'remove'],
  // ---- a room, selected ----
  'room.reroll': ['re-roll', 'shuffle', 'rearrange', 'refurnish', 'new layout', 'new furniture'],
  'faction.set': ['sun', 'moon', 'nature', 'sword', 'shield', 'spider', 'spiders', 'dragon', 'devil', 'devils', 'skull', 'skulls', 'tentacle', 'tentacles', 'death', 'coin', 'forge', 'hammer', 'sea', 'storm', 'deity', 'god', 'symbol', 'theme'],
  // ---- view: labels, roofs, levels, camera ----
  'view.labels': ['show labels', 'hide labels', 'labels off', 'labels on', 'room labels', 'building labels', 'turn off labels', 'no labels', 'hide names', 'room names off', 'name tags'],
  'view.labelLab': ['label lab', 'label size', 'label look', 'tune labels'],
  'view.ringLab': ['ring lab', 'ring look', 'tune the ring', 'menu look'],
  'view.roofsOff': ['hide roofs', 'roofs off', 'no roofs', 'remove roofs'], 'view.roofsOn': ['show roofs', 'roofs on', 'put roofs on'],
  'view.xray': ['where are the pawns', 'find my pawn', 'lost', 'where is everyone'],
  'view.reset': ['reset camera', 'centre camera', 'center camera', 'home view', 'recenter', 'default view'],
  'view.sheet': ['keyboard shortcuts', 'controls'],
  // ---- light and darkness (core/darkness.js) ----
  'area.darkness.on': ['make it dark', 'turn off the lights', 'lights off', 'pitch black', 'no light', 'lightless', 'blackout', 'unlit'],
  'area.darkness.off': ['turn on the lights', 'lights on', 'lit', 'bright', 'light it up'],
  'area.light.night': ['nighttime', 'night time', 'sunset', 'twilight', 'moonlight', 'moonlit', 'make it night'],
  'area.light.deep-night': ['pitch black', 'moonless', 'dead of night'],
  'area.light.day': ['noon', 'midday', 'sunny', 'sunlight', 'make it day', 'dawn', 'sunrise'],
  'thing.light': ['turn off', 'turn on', 'blow out', 'light it', 'ignite', 'douse', 'lamp on', 'lamp off'],
  'thing.lightRadius': ['how bright', 'light range', 'bright light', 'dim light', 'radius'],
  'pawn.carryLight': ['give him a torch', 'give her a torch', 'give them a torch', 'torch bearer', 'carrying a lantern', 'holds a lantern', 'light source'],
  'pawn.darkvision': ['see in the dark', 'darksight', 'dark sight'],
  // ---- fog of war and what players see ----
  'vision.reveal': ['reveal map', 'reveal all', 'uncover', 'show map', 'explore'], 'area.fogOfWar.off': ['reveal map', 'no fog of war'],
  'vision.view.party': ['see what players see', 'player view', 'players view', 'what players see'], 'vision.view.player': ['player view', 'see as a player', 'what players see'],
  // ---- graphics ----
  'pref.gfx.low': ['laggy', 'lag', 'choppy', 'stutter', 'stuttering', 'potato', 'low graphics', 'low quality'], 'pref.gfx.medium': ['laggy', 'lag'], 'view.fps': ['laggy', 'lag'],
  // ---- fights, dice, templates ----
  'turn.start': ['battle', 'roll initiative', 'begin combat', 'start encounter', 'enter combat', 'combat'],
  'measure.shape.sphere': ['fireball', 'blast', 'explosion', 'burst', 'radius', 'spell radius'], 'measure.shape.circle': ['radius', 'aura', 'fireball', 'spirit guardians'],
  'measure.shape.cone': ['breath', 'breath weapon', 'burning hands', 'cone of cold'], 'measure.shape.line': ['lightning bolt', 'beam'], 'measure.shape.cube': ['thunderwave', 'square area'],
  'chat.say': ['message', 'speak', 'shout', 'yell'],
  // ---- people, areas, settings ----
  'people.invite': ['new player', 'invite link', 'add a player', 'join link', 'player link'],
  'area.new': ['new scene', 'add area', 'new location'],
  'settings.admin': ['save campaign', 'save game', 'restore', 'download'],
  'pawns.notes': ['party journal', 'quest log'],
  // ---- a pawn, selected ----
  'pawn.cond.prone': ['knocked prone', 'knocked down', 'fallen', 'lying down'], 'pawn.cond.unconscious': ['knocked out', 'ko', 'passed out', 'asleep', 'sleeping', 'dying'],
  'pawn.cond.frightened': ['scared', 'afraid', 'fear', 'terrified'], 'pawn.cond.blinded': ['blind'], 'pawn.cond.charmed': ['charm'], 'pawn.cond.grappled': ['grabbed', 'held'],
  'pawn.cond.restrained': ['tied up', 'bound', 'webbed', 'entangled'], 'pawn.cond.stunned': ['stun', 'dazed'], 'pawn.cond.poisoned': ['poison', 'sick'], 'pawn.cond.invisible': ['invis', 'unseen'],
  'pawn.cond.*': ['conditions', 'condition', 'status', 'status effect'], 'pawn.mark.skull': ['dead', 'killed', 'slain', 'death'],
  'pawn.give': ['give to', 'give', 'hand to', 'player control', 'assign to player', 'belongs to'],
  'pawn.travel': ['move to area', 'move to'],
  'pawn.size': ['bigger', 'smaller', 'grow', 'shrink', 'enlarge', 'reduce', 'size'],
  // ---- things, selected ----
  'edit.rotate': ['rotate', 'spin', 'face', 'facing', 'turn around', 'turn it', 'orientation'],
  'edit.resize': ['bigger', 'smaller', 'scale', 'size', 'enlarge', 'shrink', 'grow', 'make it bigger', 'make it smaller', 'larger'],
  'edit.lift': ['hang it up', 'hang', 'mount', 'put on the wall', 'float', 'levitate', 'higher'],
  'thing.replace': ['different one', 'another one', 'other version', 'swap model', 'replace'],
  'thing.open': ['door', 'open door', 'close door', 'shut', 'shut the door', 'open it', 'open chest', 'close chest'],
  'thing.hide': ['hide it', 'hide room', 'invisible to players', 'conceal'],
  'feedback.asset': ['looks wrong', 'broken model', 'ugly model'],
};
export const CATALOG_WORDS = [
  [/^torch-/, ['torch', 'torches']], [/^(firepit-|fire-ring)/, ['campfire', 'camp fire', 'bonfire', 'fire pit']], [/^(mug|tankard|pitcher)-of-/, ['ale', 'beer', 'drink']],
  [/^table-(square|trestle|round-small|kitchen-prep)$/, ['table']], [/^chair-(plain|armed)$/, ['chair']], [/^bed-(single|double)$/, ['bed']], [/^rug-(small|oval|round|grand|runner)$/, ['rug', 'carpet']],
  [/^door-(plank|reinforced)$/, ['door']], [/^wall-window-small$/, ['window']], [/^wall-doorway$/, ['doorway', 'door frame', 'archway']], [/^wall-straight$/, ['wall']],
  [/^stair-(straight|grand|spiral-wide|half)$/, ['stairs', 'staircase', 'steps', 'stairway']], [/^stair-spiral/, ['spiral staircase', 'spiral stairs']], [/^(ladder-wood|loft-ladder)/, ['ladder']],
  [/^candle(-cluster)?$/, ['candle', 'candles']], [/^lantern-/, ['lantern']], [/^chandelier-/, ['chandelier']], [/^sword-/, ['sword', 'weapon']], [/^tree-(oak-great|deciduous|birch|fruit)$/, ['tree', 'trees']],
  [/^pew$/, ['pews', 'church bench']], [/^font-holy$/, ['holy water', 'font', 'baptism']], [/^decal-ritual-circle$/, ['pentagram', 'summoning circle', 'ritual circle', 'magic circle']], [/^decal-star-floor$/, ['pentagram']],
  [/^(feast-platter-meats|plate-roast-veg|bread-loaf)$/, ['food', 'meal']], [/^(gibbet-cage-standing|block-headsman)$/, ['gallows', 'execution']], [/^mine-cart$/, ['minecart']], [/^mine-rail/, ['rails', 'track', 'mine track']],
  [/^(counter-shop|back-bar-shelves)$/, ['bar counter', 'bar']], [/^chest-treasure$/, ['treasure chest', 'loot']], [/^(treasure-hoard-heap|dun-treasure-hoard|coin-pile)$/, ['treasure', 'loot', 'gold']], [/^potion-bottles$/, ['potion', 'potions']],
];
// what a floor or wall material is, in plain words: the room's Floor ▸ / Walls ▸ commands and the floor tiles both
export const MATERIAL_WORDS = [
  [/plank|boards|parquet|timber|log-cabin|noble-panel/, ['wood', 'wooden', 'wood floor', 'wooden floor', 'wood walls', 'wooden walls']],
  [/flagstone|cobble|setts|basalt|cut-rock|tomb-slabs|checker-stone|fieldstone|dressed-stone|crypt-stone|castle-rough|temple-stone|tower-stone|black-stone/, ['stone', 'stone floor', 'stone walls']],
  [/earth|field-furrows/, ['dirt', 'dirt floor', 'mud', 'earth floor']], [/grass|lawn|meadow/, ['grass', 'lawn']], [/marble|mosaic|tile|terracotta/, ['tiles', 'tiled floor']],
];
export const FIGURE_WORDS = [
  [/innkeeper/, 'barkeep bartender barman barmaid tavern keeper publican'], [/merchant/, 'shopkeeper trader vendor shop keeper'], [/commoner/, 'villager peasant farmer townsperson'],
  [/child/, 'kid kids'], [/^hero-rogue-/, 'thief burglar'], [/noble/, 'lord lady'],
];

// apply the vocabulary: commands (after every surface has added its own), the catalog, and figures (before their index)
export function teachBar(R, assets) {
  for (const [id, words] of Object.entries(COMMAND_WORDS)) {
    const cs = id.endsWith('*') ? R.all().filter(c => c.id.startsWith(id.slice(0, -1))) : [R.get(id)].filter(Boolean);
    for (const c of cs) c.synonyms = [...new Set([...c.synonyms, ...words])];
  }
  const material = (id) => MATERIAL_WORDS.filter(([re]) => re.test(id)).flatMap(([, w]) => w).filter(w => /walls/.test(id) ? !/floor/.test(w) : !/walls/.test(w)); // a floor's words for floors, a wall's for walls
  for (const c of R.all()) if (/^room\.(floor|walls)\./.test(c.id)) { const w = material(c.id); if (w.length) c.synonyms = [...new Set([...c.synonyms, ...w])]; }
  for (const cat of assets?.catalog || []) { const t = CATALOG_WORDS.filter(([re]) => re.test(cat.id)).flatMap(([, w]) => w); const m = cat.tile ? material(cat.id) : []; if (t.length || m.length) cat.terms = [...t, ...m]; }
}
export function teachFigures(list) {
  for (const f of list) { const more = FIGURE_WORDS.filter(([re]) => re.test(f.id)).flatMap(([, w]) => w.split(' ')); if (more.length) f.tags = [...(f.tags || []), ...more]; }
  return list;
}

// ---------- the forgiving match ----------
// FILLER words ("make it dark", "open the door", "give him a torch") count only where they match well; elsewhere they
// are passed over, so they never make a line match nothing. forms(w): the word and its singular ("torches", "wolves").
export const FILLER = new Set(['add', 'place', 'drop', 'get', 'a', 'an', 'the', 'it', 'its', 'this', 'that', 'these', 'those', 'my', 'our', 'me', 'us', 'him', 'her', 'his', 'them', 'their', 'please', 'some', 'of', 'for', 'with', 'make', 'set', 'put', 'and', 'i', 'want', 'can', 'you', 'lets', "let's", 'to', 'into', 'at']);
export function forms(w) {
  const out = [w];
  if (w.length > 3 && w.endsWith('ies')) out.push(w.slice(0, -3) + 'y');
  if (w.length > 3 && w.endsWith('ves')) out.push(w.slice(0, -3) + 'f');
  if (w.length > 3 && w.endsWith('men')) out.push(w.slice(0, -3) + 'man');
  if (w.length > 3 && /(ches|shes|xes|sses)$/.test(w)) out.push(w.slice(0, -2));
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) out.push(w.slice(0, -1));
  return out;
}
// near(w, t): a typed word against the words of a text: one slip (two in a word of 7 letters or more), same first
// letter. -> 0 or a weak score (30): below every real match, above nothing. "lanturn", "chappel", "sarcophogus", "goblinn".
export function near(w, t) {
  if (w.length < 4) return 0;
  const k = w.length >= 7 ? 2 : 1;
  for (const x of String(t).split(/[^a-z0-9]+/)) if (x.length >= 3 && x[0] === w[0] && Math.abs(x.length - w.length) <= k && dist(w, x, k) <= k) return 30;
  return 0;
}
// Damerau-Levenshtein (adjacent swaps count one), giving up past `max`
function dist(a, b, max) {
  const m = a.length, n2 = b.length; let prev2 = null, prev = Array.from({ length: n2 + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= n2; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[n2];
}
