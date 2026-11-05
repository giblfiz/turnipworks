// THE ASSETS PAGE'S DATA (2026-11-04, Harry: "an assets page that demos all of the assets and asset packs and deep links
// to them"). node engine/tools/site_assets_data.mjs  ->  the page's data, as JSON on stdout (engine/tools/build_site.py
// runs it and writes engine/client/site/assets.json; engine/tools/site_assets.py makes the page from it).
//
// The tree is the game's own: client/taxonomy.js (the Build menu, Genre -> Type -> Room) and client/library-index.js
// libraryContents (what each room's library area lists, section by section), run here on the tuner's data exactly as
// test/library-index.test.mjs runs them, with the same `usable` (a look rated out of the game is out of the page). So a
// pack is a Build-menu type that has rooms, and every look a room's library offers is on the page under that room.
// The figures are the command bar's figure list (tools/spawn-tuner/data/figures.json), by group.
//
// Nothing here is new to the public: every file it names is one the game already loads from /look/ (the tuner's
// assets/m, assets/flat and assets/figures, exposed by nginx since 2026-10-11). The pictures are the page's own renders
// of those files (tools/site-assets/render_thumbs.py), named from the catalog's mesh id so a remade mesh gets a new name.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildTaxonomy } from '../client/taxonomy.js';
import { libraryContents, kitSections, factionSections, floorCats } from '../client/library-index.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';

const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../../tools/spawn-tuner/data/library.json'), rooms = read('../../tools/spawn-tuner/data/rooms.json');
const data = read('../client/data/types.json'), spawns = read('../client/data/library-spawns.json');
const figs = read('../../tools/spawn-tuner/data/figures.json');
const usable = (k) => solver.skuUsable(k, SOLVER_OPTS);
const X = buildTaxonomy({ lib, roomTypes: rooms, data, usable, spawns });

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const nameOf = (id) => cap(id.replace(/-/g, ' '));
// A THING'S NAME on the page: the command bar's (its id in words), less the batch prefixes that are the factory's
// bookkeeping, not the thing's name (alch-athanor is an athanor; Gemini, 2026-11-04: "internal codenames"). A name
// that would then be another thing's keeps its prefix. (Search still finds the prefix words: the id is indexed too.)
const PREFIX = /^(alch|rite|trade|mil|rural|smith|craft|bard|flavor)-/;
const thingName = (id) => { const bare = id.replace(PREFIX, ''); return nameOf(bare !== id && lib.objects[bare] ? id : bare); };
// a look's label when its library entry has none: its sku's own words after the id (pillar-square--black: "black"),
// or "look 2" for the factory's numbered variants (barrel--s2)
const lookWords = (id, sku) => { const w = sku.startsWith(id + '--') ? sku.slice(id.length + 2).split('--').filter(x => !/^s\d+$/.test(x) && x !== 'v1').join(' ').replace(/-/g, ' ') : ''; return w; };
const skuOf = (cat, sku) => lib.objects[cat]?.skus.find(k => k.sku === sku);
// a thing's own look when a library entry names none: the command bar's choice (client/assets.js catalog)
const defaultSku = (o) => o.skus.find(k => (k.kind === 'flat' || k.bounds) && usable(k)) || o.skus.find(k => k.kind === 'flat' || k.bounds);
// the picture's name: the catalog's mesh id (inn-02/acorns-pile@e6cb5a49) changes when the mesh does; a flat has no
// mesh id, so its fields stand in
export const lookHash = (k) => k.kind === 'flat' ? crypto.createHash('sha1').update([k.sku, k.src, k.url, ...(k.px || [])].join('|')).digest('hex').slice(0, 8) : k.mesh.split('@')[1];
// A LOOK in the JSON is [sku, hash, label]: its file is <files>assets/m/<sku>.glb (a flat thing, f: 1, <files>assets/flat/<sku>.webp),
// its picture <media>t/<sku>.<hash>.webp. (Checked here: a look whose file is named otherwise stops the build.)
const fileOf = (k) => k.kind === 'flat' ? `assets/flat/${k.sku}.webp` : `assets/m/${k.sku}.glb`;

const things = {}, looksSeen = new Set();
function lookOf(cat, sku) {
  const o = lib.objects[cat]; if (!o) return null;
  const k = (sku && skuOf(cat, sku)) || defaultSku(o); if (!k || !k.url) return null;
  if (!(k.kind === 'flat' || k.mesh)) return null;
  return k;
}
function thing(cat) {
  if (things[cat]) return things[cat];
  const o = lib.objects[cat];
  const t = { n: thingName(cat), d: o.desc || '', p: o.place, ...(o.size?.length === 3 && { s: o.size }), l: [] };
  if (o.skus.some(k => k.kind === 'flat')) t.f = 1;
  return (things[cat] = t);
}
function addLook(cat, k, label) {
  const t = thing(cat);
  if (k.url !== fileOf(k)) throw new Error(`a look's file is not where the page expects it: ${k.sku} ${k.url}`);
  if (!!t.f !== (k.kind === 'flat')) throw new Error(`a thing with both flat and mesh looks: ${cat}`);
  // the label: the library entry's look words ("Fireplace wall · fine": fine), else the sku's own (lookWords)
  const lw = label && label.includes(' · ') ? label.replace(/^[^·]*· /, '') : (label && label !== t.n && label !== nameOf(cat) ? label : lookWords(cat, k.sku));
  if (!t.l.some(x => x[0] === k.sku)) t.l.push([k.sku, lookHash(k), ...(lw ? [lw] : [])]);
  looksSeen.add(k.sku);
  return t.l.findIndex(x => x[0] === k.sku);
}

// A PACK is a Build-menu type with rooms; a room shows its own shelves (libraryContents' sections, as the game lists them)
// and its own wall family's pieces. What every room's library repeats goes once, in packs of its own: the hand-placed
// kit of every wall family and every floor (BUILDING KIT), every faction's pieces (FACTION PIECES), and a type's
// "More · <type>" shelf (the pack's own `more`: things no recipe of the type names).
const OWN = new Set(['anchor', 'furnish', 'store', 'light', 'dress', 'plants', '*', 'floors', 'factions']);
const packs = [];
function entriesOf(list, mine, pack) {
  const entries = [];
  for (const it of list) {
    const k = lookOf(it.cat, it.sku); if (!k) continue;
    const i = addLook(it.cat, k, it.label), e = i ? `${it.cat}|${i}` : it.cat;
    if (!entries.includes(e)) entries.push(e);
    if (pack && !mine.has(it.cat)) { mine.add(it.cat); pack.things.push(it.cat); }
  }
  return entries;
}
for (const g of X.genres.map(id => X.get(id))) for (const tid of g.children) {
  const t = X.get(tid), type = data.types.find(x => x.code === t.code);
  if (!t.children.length) continue; // (ruins, camp, grove: no room recipes yet, so nothing to place from them)
  const pack = { slug: type.slug, code: t.code, label: t.label, genre: g.label, rooms: [], things: [], more: [] };
  const mine = new Set(), more = new Set();
  for (const rid of t.children) {
    const r = X.get(rid), recipe = rooms.find(x => x.key === r.roomKey) || { slots: {} };
    const room = { key: r.roomKey, label: r.label, cells: r.cells, sections: [] };
    for (const [key, title, list] of libraryContents(r, { lib, recipe, usable })) {
      if (key === `more:${t.code}`) { for (const it of list) more.add(it.cat); continue; }
      if (key.startsWith('faction:')) { room.factions = true; continue; }
      if (key.startsWith('kit:')) { // this room's own wall family, and the special pieces routed to it
        const own = list.filter(it => { const k = skuOf(it.cat, it.sku); return !k?.family || k.family === recipe.family; });
        const es = entriesOf(own, mine, pack); if (es.length) room.sections.push([key, title, es]);
        continue;
      }
      if (!OWN.has(key)) continue;
      const es = entriesOf(list, mine, pack); if (es.length) room.sections.push([key, title, es]);
    }
    pack.rooms.push(room);
  }
  pack.more = entriesOf([...more].filter(id => !mine.has(id)).map(id => ({ cat: id })), mine, pack);
  packs.push(pack);
}
// BUILDING KIT: every wall family's walls, doors and windows, stairs; and every floor
{
  const pack = { slug: 'building-kit', code: 'KIT', label: 'Walls, doors & floors', genre: 'Fantasy', kind: 'kit', rooms: [], things: [] }, mine = new Set();
  const famName = (f) => cap(f.replace(/-/g, ' '));
  const bySec = new Map();
  for (const [key, title, list] of kitSections(lib, null, usable, nameOf, [])) for (const it of list) {
    const k = skuOf(it.cat, it.sku), fam = k?.family || '';
    const room = bySec.get(key) || bySec.set(key, { key: key.replace('kit:', ''), label: title, sections: new Map() }).get(key);
    (room.sections.get(fam) || room.sections.set(fam, []).get(fam)).push({ ...it, label: nameOf(it.cat) });
  }
  for (const room of bySec.values()) pack.rooms.push({ key: room.key, label: room.label, sections: [...room.sections].map(([fam, list]) => [fam || 'other', fam ? famName(fam) : 'Special pieces', entriesOf(list, mine, pack)]).filter(s => s[2].length) });
  const tiles = floorCats(lib).map(id => ({ cat: id }));
  pack.rooms.push({ key: 'floors', label: 'Floors', sections: [['floors', 'Floor tiles (5 ft)', entriesOf(tiles, mine, pack)]] });
  packs.push(pack);
}
// FACTION PIECES: each faction's banner, altarpiece, idol and the rest (the pieces a room "takes faction flavours" with)
{
  const pack = { slug: 'faction-pieces', code: 'FCT', label: 'Faction pieces', genre: 'Fantasy', kind: 'factions', rooms: [], things: [] }, mine = new Set();
  for (const [key, title, list] of factionSections(lib, lib.flavorSlots || [], usable)) {
    const faction = title.replace(/^Faction · /, ''); // (each look of a faction piece is that faction's: its label)
    pack.rooms.push({ key: key.replace('faction:', ''), label: faction, sections: [[key, title, entriesOf(list.map(it => ({ ...it, label: `${nameOf(it.cat)} · ${faction}` })), mine, pack)]] });
  }
  packs.push(pack);
}

// the figures: the command bar's list, by group
const GROUPS = [['hero', 'Heroes'], ['townsfolk', 'Townsfolk'], ['foe', 'Foes & monsters'], ['large', 'Large creatures'], ['beast', 'Beasts & mounts']];
const figures = {};
const figPack = { slug: 'figures', code: 'FIG', label: 'Figures', genre: 'Fantasy', kind: 'figures', rooms: [], things: [] };
for (const [key, label] of GROUPS) {
  const ids = figs.figures.filter(f => f.group === key && f.url && f.thumb).sort((a, b) => a.name.localeCompare(b.name)).map(f => f.id);
  figPack.rooms.push({ key, label, sections: [[key, label, ids]] });
  figPack.things.push(...ids);
}
for (const f of figs.figures) if (f.url && f.thumb) {
  // A FIGURE's file is <files>assets/figures/<id>--<x>.glb, its picture <media>f/<id>-<hash>.webp (the hash is x's last part)
  const m = f.url.match(/^assets\/figures\/(.+)--([a-z0-9]+-([0-9a-f]{8}))\.glb$/);
  if (!m || m[1] !== f.id || f.thumb !== `assets/figures/thumbs/${f.id}-${m[3]}.webp`) throw new Error(`a figure's files are not where the page expects them: ${f.id}`);
  figures[f.id] = { n: cap(f.name), g: f.group, h: f.h, ...(f.size > 1 && { z: f.size }), x: m[2], ...(f.tags?.length && { k: f.tags.slice(0, 6) }) };
}
packs.push(figPack);

// a thing with several looks: every look has a label ("look 2" where neither its entry nor its sku names it)
for (const t of Object.values(things)) if (t.l.length > 1) t.l.forEach((l, i) => { if (!l[2]) l[2] = `look ${i + 1}`; });

const out = {
  updated: [lib.updated, figs.source_updated].filter(Boolean).sort().pop() || null,
  credit: 'Turnip Works assets (https://turnipworks.net), CC BY 4.0',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  media: '/engine/client/site/library/', files: '/look/',
  counts: { packs: packs.length, rooms: packs.reduce((n, p) => n + (p.rooms?.length || 0), 0), things: Object.keys(things).length, looks: looksSeen.size, figures: Object.keys(figures).length },
  packs, things, figures,
};
process.stdout.write(JSON.stringify(out));
