// node experiments/2026-10-29-piplib/diag.mjs [out.json] : per room type, what its rules can spawn (spawn/*.json, the
// Monte-Carlo sample, plus its recipe slots and sets) against what its library shelf lists (client/library-index.js),
// and why each missing thing is missing.
import fs from 'node:fs';
const E = new URL('../../engine/', import.meta.url).pathname;
const { buildTaxonomy } = await import(E + 'client/taxonomy.js');
const LI = await import(E + 'client/library-index.js');
const { isFactionSlot } = await import(E + 'core/faction-catalog.js');
const solver = await import(E + '../tools/spawn-tuner/js/solver.js'); const { SOLVER_OPTS } = await import(E + 'core/roomgen.js');
const read = (p) => JSON.parse(fs.readFileSync(E + p));
const lib = read('tuner-data/library.json'), rooms = read('tuner-data/rooms.json'), data = read('client/data/types.json');
const usable = (k) => solver.skuUsable(k, SOLVER_OPTS);
const AFTER = process.argv.includes('--after');
const X = buildTaxonomy({ lib, roomTypes: rooms, data, usable, ...(AFTER && { spawns: read('client/data/library-spawns.json') }) });
const nodes = [...X.nodes.values()].filter(n => n.level === 'room');
// what the rules spawn: the index (engine/tools/library_spawns.mjs, 48 solves at true room sizes), SPAWNS=path
const IDX = JSON.parse(fs.readFileSync(process.env.SPAWNS || new URL('../../engine/client/data/library-spawns.json', import.meta.url)));
const S = Object.fromEntries(Object.entries(IDX.rooms).map(([k, l]) => [k, { cats: Object.fromEntries(l.map(c => [c, 1])), flavored: {}, solves: IDX.solves }]));
const hp = new Set(LI.handPlaceable(lib, usable).map(p => p.id));
const out = {}; const tot = { reasons: {} };
for (const r of rooms) {
  const n = nodes.find(x => x.roomKey === r.key); if (!n) continue;
  const secs = LI.libraryContents(n, { lib, recipe: r, usable });
  const items = secs.flatMap(([, , l]) => l), cats = new Set(items.map(i => i.cat));
  const things = items.filter(i => i.place !== 'kit' && i.place !== 'tile'), kit = items.filter(i => i.place === 'kit'), tiles = items.filter(i => i.place === 'tile');
  const sp = S[r.key] || { cats: {}, flavored: {} };
  const spawned = new Set([...Object.keys(sp.cats), ...Object.keys(sp.flavored)].filter(c => !c.startsWith('__')));
  const recipe = new Set(); for (const [k, ids] of Object.entries(r.slots || {})) if (k !== 'sets') ids.forEach(i => recipe.add(i)); for (const sid of r.slots?.sets || []) for (const [id] of lib.sets?.[sid]?.members || []) recipe.add(id);
  const want = new Set([...spawned, ...recipe].filter(id => lib.objects[id]));
  const missing = {};
  for (const id of want) {
    if (cats.has(id)) continue;
    const o = lib.objects[id];
    const why = id.endsWith('-open') || o.open_of ? 'open state (shown closed)'
      : isFactionSlot(id) ? 'faction piece excluded'
      : id.startsWith('floor-') ? 'floor (kit) piece'
      : o.place === 'kit' ? (hp.has(id) ? 'kit, placeable but not on this shelf' : 'kit piece with no shelf (not hand-placeable)')
      : !o.skus.some(k => (k.kind === 'flat' || k.bounds) && usable(k)) ? 'filter: no usable sku'
      : 'rules spawn it, no recipe slot names it (shelf = recipe slots only)';
    (missing[why] ||= []).push(id); tot.reasons[why] = (tot.reasons[why] || 0) + 1;
  }
  // banner-wall: a faction mark (core/factions.js factionSlot) -> the factions' banners come up here
  const factionHere = [...spawned].filter(c => isFactionSlot(c) || c === 'banner-wall'); const factionShown = items.filter(i => isFactionSlot(i.cat)).length;
  const variants = things.filter(i => !isFactionSlot(i.cat)).reduce((s, i) => s + Math.max(0, lib.objects[i.cat].skus.filter(k => k.bounds && usable(k)).length - 1), 0);
  out[r.key] = { shelf: { total: items.length, things: things.length, kit: kit.length, tiles: tiles.length, kitSections: secs.filter(([k]) => k.startsWith('kit:')).length, sections: secs.length }, spawnedCats: spawned.size, solves: sp.solves, recipeCats: recipe.size, missingN: Object.values(missing).reduce((s, l) => s + l.length, 0), missing, factionHere, factionShown, hiddenVariants: variants };
}
fs.writeFileSync(process.env.OUT || new URL(AFTER ? 'diag-after.json' : 'diag-before.json', import.meta.url), JSON.stringify(out, null, 1));
const rows = Object.entries(out);
console.log('room'.padEnd(22), 'shelf', 'things', 'kit', 'tiles', 'kitSecs', 'spawned', 'missing', 'facShown', 'variants');
for (const [k, v] of rows) console.log(k.padEnd(22), String(v.shelf.total).padStart(5), String(v.shelf.things).padStart(6), String(v.shelf.kit).padStart(4), String(v.shelf.tiles).padStart(5), String(v.shelf.kitSections).padStart(7), String(v.spawnedCats).padStart(7), String(v.missingN).padStart(7), String(v.factionShown).padStart(8), v.hiddenVariants);
console.log('reasons', tot.reasons);
console.log('rooms with something missing', rows.filter(([, v]) => v.missingN).length, '/', rows.length, '; missing total', rows.reduce((s, [, v]) => s + v.missingN, 0));
