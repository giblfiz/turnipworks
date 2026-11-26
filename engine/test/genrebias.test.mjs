// THE TABLE'S GENRE: the index, the profile and the tilt (2026-11-08; client/genrebias.js; docs/UI.md "The bar leans to
// the table's genre"). Harry: "The quick bar code needs to develop weight awareness of what genres are on the table and
// bias results that direction."
//   node engine/test/genrebias.test.mjs
// 1. the index: a thing's genre by the types that list it; neutral when two genres do, when it has a modern look and a
//    plain one, when the modern rooms borrow it, for the plain staples, and when nothing says; figures by group / culture
// 2. the profile: an empty table has no signal; a whole tavern outweighs one stray car; neutral things are never evidence;
//    the campaign's other areas are a lighter voice; a seat's unseen things do not count
// 3. the tilt: 0 with no signal, 0 for a row that does not name the thing; the table's genre over a neutral thing over
//    the other genre's; a mixed table in proportion; GENRE_TILT is less than the exact-name bonus (+100)
// 4. on the real data: office chair modern, the armed chair fantasy, crate / barrel / vegetables neutral, the tavern's
//    common room fantasy, the office modern, the samurai Japanese, the street samurai modern, a horse neutral
import fs from 'node:fs';
import * as G from '../client/genrebias.js';
import { buildTaxonomy } from '../client/taxonomy.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
import { modShared } from '../../tools/spawn-tuner/js/solver2.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ---------- 1. the index, on a small made-up world ----------
const types = { genres: [{ key: 'fantasy' }, { key: 'modern' }, { key: 'cultures' }], types: [
  { code: 'TAV', genre: 'fantasy', roles: ['chair-armed', 'table-trestle', 'bar-counter', 'crate', 'barrel', 'carrot-pile'] },
  { code: 'OFC', genre: 'modern', roles: ['office-chair', 'filing-cabinet', 'bar-counter'] },
  { code: 'JPN', genre: 'cultures', roles: ['jpn-low-table', 'tea-set'] }, { code: 'CHN', genre: 'cultures', roles: ['tea-set'] }] };
const sku = (...tiers) => ({ skus: tiers.map(t => ({ tier: t })) });
const lib = { objects: { 'chair-armed': sku(''), 'table-trestle': sku('common'), 'bar-counter': sku('', 'mod'), crate: sku(''), barrel: sku(''), 'carrot-pile': sku(''), 'office-chair': sku('mod'), 'filing-cabinet': sku('mod'), 'jpn-low-table': sku('jpn'), 'tea-set': sku(''), sofa: sku('', 'mod'), 'neon-sign': sku('cyb'), 'mystery-thing': sku(''), 'borrowed-rug': sku('') } };
const figures = [{ id: 'hero-a', group: 'hero' }, { id: 'town-b', group: 'townsfolk' }, { id: 'foe-c', group: 'foe' }, { id: 'runner-d', group: 'runner' }, { id: 'robot-e', group: 'robot' }, { id: 'beast-horse', group: 'beast' }, { id: 'foe-trex', group: 'foe', tags: ['dinosaur'] }, { id: 'cul-jpn-samurai', group: 'hero', setting: 'JPN' }];
const I = G.genreIndex({ types, lib, figures, rooms: [['common', 'TAV'], ['mod-office', 'OFC'], ['tea-room', 'JPN'], ['street', 'TAV'], ['street', 'OFC']], shared: (id) => id === 'borrowed-rug' });
const cg = (id) => I.catGenre(id);
ok(cg('chair-armed') === 'fantasy' && cg('table-trestle') === 'fantasy', 'a thing only fantasy types list is fantasy');
ok(cg('office-chair') === 'modern' && cg('filing-cabinet') === 'modern', 'a thing only modern types list is modern');
ok(cg('jpn-low-table') === 'cultures:JPN', 'a thing one culture lists is that culture', cg('jpn-low-table'));
ok(cg('tea-set') === 'cultures', 'a thing two cultures list is "cultures"', cg('tea-set'));
ok(cg('bar-counter') === null, 'a thing a type of each genre lists is neutral');
ok(cg('sofa') === null, 'a thing with a modern look and a plain one is neutral (by its looks, with no type listing it)');
ok(cg('neon-sign') === 'modern', 'a thing no type lists whose looks are all modern is modern');
ok(cg('crate') === null && cg('barrel') === null && cg('carrot-pile') === null, 'the plain staples (crates, barrels, vegetables) are neutral, though a fantasy type lists them');
ok(cg('borrowed-rug') === null, 'a role the modern rooms share (solver2 modShared) is neutral');
ok(cg('mystery-thing') === null && cg('hole') === null, 'nothing says: neutral');
ok(I.figGenre('hero-a') === 'fantasy' && I.figGenre('town-b') === 'fantasy' && I.figGenre('foe-c') === 'fantasy', 'heroes, townsfolk, foes: fantasy');
ok(I.figGenre('runner-d') === 'modern' && I.figGenre('robot-e') === 'modern', 'runners and robots: modern');
ok(I.figGenre('beast-horse') === null && I.figGenre('foe-trex') === null, 'beasts and dinosaurs: neutral');
ok(I.figGenre('cul-jpn-samurai') === 'cultures:JPN', 'a regional figure: its culture', I.figGenre('cul-jpn-samurai'));
ok(I.roomGenre('common') === 'fantasy' && I.roomGenre('mod-office') === 'modern' && I.roomGenre('tea-room') === 'cultures:JPN', 'rooms: their type\'s genre');
ok(I.roomGenre('street') === null && I.roomGenre('no-such-room') === null, 'a room under a type of each genre, or none: neutral');

// ---------- 2. the profile ----------
let n = 0; const id = () => `e${n++}`;
const room = (type, w, d) => { const k = id(); return [k, { id: k, kind: 'room', recipe: { type, w, d } }]; };
const thing = (cat, extra = {}) => { const k = id(); return [k, { id: k, kind: 'object', cat, ...extra }]; };
const pawn = (fig) => { const k = id(); return [k, { id: k, kind: 'token', fig }]; };
const E = (...xs) => Object.fromEntries(xs);
const tavern = E(room('common', 6, 5), room('common', 4, 4), ...Array.from({ length: 20 }, () => thing('chair-armed')), ...Array.from({ length: 10 }, () => thing('table-trestle')), pawn('hero-a'), pawn('town-b'));
const P0 = G.tableProfile(G.areaMass({}, I));
ok(P0.strength === 0 && Object.keys(P0.mix).length === 0, 'an empty table: no signal');
ok(G.tableProfile(G.areaMass(E(thing('crate'), thing('barrel'), thing('bar-counter'), pawn('beast-horse'), room('street', 8, 8)), I)).strength === 0, 'neutral things are never evidence: a table of crates, barrels, a horse and a street has no signal');
const P1 = G.tableProfile(G.areaMass(tavern, I));
ok(P1.mix.fantasy === 1 && P1.strength > 0.85, 'a tavern: all fantasy, strong', P1);
const car = G.tableProfile(G.areaMass(E(thing('office-chair')), I));
ok(car.mix.modern === 1 && car.strength < 0.2, 'one stray modern thing alone: modern, but a small push', car);
const both = G.tableProfile(G.areaMass({ ...tavern, ...E(thing('office-chair')) }, I));
ok(both.mix.fantasy > 0.95 && both.mix.modern < 0.05, 'a whole tavern outweighs one stray modern thing', both.mix);
const mass = G.areaMass(tavern, I);
ok(near(mass.total, G.WEIGHT.cell * (30 + 16) + 30 * G.WEIGHT.object + 2 * G.WEIGHT.pawn), 'rooms weigh by floor area, things one each, pawns two each', mass.total);
const office = G.areaMass(E(room('mod-office', 6, 6), ...Array.from({ length: 6 }, () => thing('filing-cabinet'))), I);
const half = G.tableProfile(G.areaMass({}, I), [office]), here = G.tableProfile(office);
ok(half.mix.modern === 1 && half.strength < here.strength && half.strength > 0, 'another area alone: its genre, at a lighter strength', [half.strength, here.strength]);
const fb = G.tableProfile(mass, [office]);
ok(near(fb.mix.modern, G.FALLBACK * office.total / (mass.total + G.FALLBACK * office.total)), 'another area counts at FALLBACK of its weight', fb.mix);
const unseen = G.areaMass(E(thing('office-chair', { hidden: true }), thing('chair-armed')), I, (e) => !e.hidden);
ok(unseen.mass.modern === undefined && unseen.mass.fantasy === 1, 'what the seat may not see is never counted', unseen);

// ---------- 3. the tilt ----------
const F = { mix: { fantasy: 1 }, strength: 1 }, M = { mix: { modern: 1 }, strength: 1 }, X = { mix: { fantasy: 0.75, modern: 0.25 }, strength: 1 };
ok(G.tiltOf(G.NO_PROFILE, 'fantasy') === 0 && G.tiltOf(G.NO_PROFILE, null) === 0 && G.tiltOf(G.NO_PROFILE, 'modern') === 0, 'no signal: no tilt for anything');
ok(G.tiltOf(F, 'fantasy', false) === 0, 'a row that does not name the thing gets nothing');
ok(G.tiltOf(F, 'fantasy') === G.GENRE_TILT && G.tiltOf(F, 'modern') === 0, 'a fantasy table: the fantasy thing the whole tilt, the modern none');
ok(G.tiltOf(F, null) === G.GENRE_TILT * G.NEUTRAL_FIT && G.tiltOf(M, null) === G.GENRE_TILT * G.NEUTRAL_FIT, 'a neutral thing fits any table', G.tiltOf(F, null));
ok(G.tiltOf(F, 'fantasy') >= G.tiltOf(F, null) && G.tiltOf(F, null) > G.tiltOf(F, 'modern'), 'the table\'s own >= neutral > the other genre\'s');
const Y = { mix: { fantasy: 0.99, 'cultures:CHN': 0.01 }, strength: 1 };
ok(G.tiltOf(Y, null) === G.tiltOf(Y, 'fantasy'), 'a neutral thing ties exactly with the table\'s own on a nearly-pure table (ties keep their order)', [G.tiltOf(Y, null), G.tiltOf(Y, 'fantasy')]);
ok(near(G.tiltOf({ mix: { fantasy: 0.5, modern: 0.5 }, strength: 1 }, null), 0.5 * G.GENRE_TILT), 'on an even table a neutral thing fits like either genre');
ok(near(G.tiltOf(X, 'fantasy'), 0.75 * G.GENRE_TILT) && near(G.tiltOf(X, 'modern'), 0.25 * G.GENRE_TILT), 'a mixed table tilts in proportion');
ok(near(G.tiltOf({ mix: { fantasy: 1 }, strength: 0.5 }, 'fantasy'), 0.5 * G.GENRE_TILT), 'the tilt scales with the strength');
ok(near(G.tiltOf(F, 'cultures:JPN'), G.KIN * G.GENRE_TILT) && G.tiltOf(M, 'cultures:JPN') === 0, 'a culture is kin to fantasy, not to modern');
ok(G.tiltOf({ mix: { 'cultures:JPN': 1 }, strength: 1 }, 'cultures:JPN') > G.tiltOf({ mix: { 'cultures:JPN': 1 }, strength: 1 }, 'cultures:CHN'), 'a Japanese table: Japanese things over Chinese ones');
ok(G.GENRE_TILT < 100, 'the tilt is less than the bar\'s exact-name bonus, so an exact name still comes first', G.GENRE_TILT);

// ---------- 4. the real data ----------
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const rlib = read('../tuner-data/library.json'), rooms = read('../tuner-data/rooms.json'), rtypes = read('../client/data/types.json'), rfigs = read('../tuner-data/figures.json').figures;
const tax = buildTaxonomy({ lib: rlib, roomTypes: rooms, data: rtypes, usable: (k) => solver.skuUsable(k, SOLVER_OPTS) });
const R = G.genreIndex({ types: rtypes, lib: rlib, figures: rfigs, shared: modShared, rooms: [...tax.nodes.values()].filter(x => x.level === 'room').map(x => [x.roomKey, x.parent.replace(/^t:/, '')]) });
for (const [k, want] of [['office-chair', 'modern'], ['door-flush', 'modern'], ['filing-cabinet', 'modern'], ['chair-armed', 'fantasy'], ['door-plank', 'fantasy'], ['crate', null], ['barrel', null], ['cabbage-crate', null], ['potato', null], ['tree-fruit', 'fantasy'], ['sofa', null], ['jpn-low-table', 'cultures:JPN']])
  ok(R.catGenre(k) === want, `real catalog: ${k} is ${want ?? 'neutral'}`, R.catGenre(k));
for (const [k, want] of [['common', 'fantasy'], ['mod-office', 'modern'], ['cyb-lobby', 'modern']]) ok(R.roomGenre(k) === want, `real rooms: ${k} is ${want}`, R.roomGenre(k));
for (const [k, want] of [['town-human-guard', 'fantasy'], ['modern-security-f', 'modern'], ['cyber-street-samurai-human-m', 'modern'], ['cul-jpn-samurai', 'cultures:JPN'], ['beast-horse', null]]) ok(R.figGenre(k) === want, `real figures: ${k} is ${want ?? 'neutral'}`, R.figGenre(k));
const cat = Object.keys(rlib.objects), counted = cat.filter(k => R.catGenre(k)).length;
ok(counted > cat.length * 0.8, 'most of the real catalog has a genre (the rest is shared or unknown)', `${counted} / ${cat.length}`);

console.log(`genrebias: ${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
