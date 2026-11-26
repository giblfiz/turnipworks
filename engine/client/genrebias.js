// THE TABLE'S GENRE (2026-11-08, Harry: "The quick bar code needs to develop weight awareness of what genres are on the
// table and bias results that direction"). Pure: no three.js, no DOM, so the node test (test/genrebias.test.mjs) runs it.
//   the index    each catalog thing, figure and room type gets ONE genre key, once, at boot: 'fantasy', 'modern', or a
//                regional culture 'cultures:JPN' (the Build tray's genres, client/data/types.json), or null: neutral.
//                A thing is neutral when it belongs to more than one genre (a type of each lists it; it has a modern look
//                and a plain one; the modern rooms borrow it: solver2.js MOD_SHARED / MX_BORROW), when it is a plain
//                staple (barrels, crates, sacks, vegetables), when nothing says (a hole, a thing no type lists). A figure
//                by its group (heroes, townsfolk, foes and large ones fantasy; runners, modern folk and robots modern), a
//                regional figure by its culture; beasts and dinosaurs are neutral (every world has horses).
//   the profile  what the table the seat is looking at is made of: the area's rooms (by their type's genre, weighed by
//                floor area), its things (by their catalog genre) and its pawns (by their figure), as a mix ({ fantasy:
//                0.8, modern: 0.2 }) and a strength (0 for an empty table, near 1 for a furnished building: one stray
//                car is a small push, a whole tavern a full one). Neutral things are never evidence. The campaign's other
//                areas the client holds count at FALLBACK of their weight. Worked out when the entities change, never
//                per keystroke (bar.js keeps it with app.derived).
//   the tilt     a row whose words NAME the thing (each typed word is a whole word of its name, its bar words or its
//                figure fields: "chair" names the office chair, "car" does not name a cart) gets GENRE_TILT x strength
//                x its fit to the mix. A tilt, never a filter: nothing is removed, a fragment match gets nothing, so an
//                exact name ("car" on a fantasy table) still comes first; an empty table gets 0, today's order exactly.
//
// THE SIZE OF THE TILT is a taste call (docs/UI.md "The bar leans to the table's genre"): GENRE_TILT is the one dial.
// The bar's scores (bar.js score): a whole word 100, a word's start 80 (+10 at the name's start), inside a word 62, a
// fragment 40. 40 lets a modern table's "chair" (the office chair, 62) pass the plain chair that owns the bare word (100),
// and is still less than the exact-name bonus (+100).
export const GENRE_TILT = 60;
export const NEUTRAL_FIT = 1;     // a neutral thing (shared, staple, unknown) fits as well as the table's own genre: only the OTHER genre's rows are passed
export const KIN = 0.25;           // fantasy and the regional cultures are kin (both before the modern world), as are two cultures
export const HALF_MASS = 6;       // strength = mass / (mass + HALF_MASS): one thing 0.14, a pawn 0.25, a furnished room ~0.85
export const FALLBACK = 0.25;     // the campaign's other areas, as a lighter voice than the area in view
export const WEIGHT = { cell: 0.25, object: 1, pawn: 2 }; // a 6x5-cell room weighs 7.5, a thing 1, a pawn 2

// the plain staples that read as any era (Harry: "the plain barrels/crates/vegetables"): never evidence, neutral in the tilt
export const STAPLE = /^(barrel|crate|sack|keg-small|bucket|rope-coil)$|(^|-)(cabbage|carrot|onion|potato|turnip|leek|beet|garlic|apple|pear|vegetable|pumpkin|squash)s?(-|$)/;
const NOT_STAPLE = /(^|-)(tree|orchard)(-|$)/; // (a fruit tree is a tree, not produce)
const MODERN_TIERS = new Set(['mod', 'cyb']);
const FANTASY_GROUPS = new Set(['hero', 'townsfolk', 'foe', 'large']), MODERN_GROUPS = new Set(['runner', 'modern', 'robot']);

/** One genre per thing, once.
 *  types     types.json { genres, types: [{ code, genre, roles }] }
 *  lib       the tuner library ({ objects: { id: { skus: [{ tier }] } } })
 *  figures   the figure list ([{ id, group, setting?, genre?, tags }])
 *  rooms     [[roomKey, typeCode]] (the taxonomy's room nodes: a room listed under several types is in each)
 *  shared    (id) => true for a role the modern rooms share with the plain set (solver2.js modShared) */
export function genreIndex({ types = { types: [] }, lib = { objects: {} }, figures = [], rooms = [], shared = () => false } = {}) {
  const genreOfCode = new Map((types.types || []).map(t => [t.code, t.genre === 'cultures' ? `cultures:${t.code}` : t.genre]));
  const one = (keys) => { const s = new Set([...keys].filter(Boolean)); if (s.size === 1) return [...s][0]; if (s.size > 1 && [...s].every(k => k.startsWith('cultures'))) return 'cultures'; return null; };
  const roles = new Map(); for (const t of types.types || []) for (const id of t.roles || []) (roles.get(id) || roles.set(id, new Set()).get(id)).add(genreOfCode.get(t.code));
  const cultureTier = new Map((types.types || []).filter(t => t.genre === 'cultures').map(t => [t.code.toLowerCase(), `cultures:${t.code}`]));
  const cat = new Map();
  for (const [id, o] of Object.entries(lib.objects || {})) {
    if (shared(id) || (STAPLE.test(id) && !NOT_STAPLE.test(id))) { cat.set(id, null); continue; }
    const tiers = (o.skus || []).map(k => k.tier || ''), mod = tiers.some(t => MODERN_TIERS.has(t)), plain = tiers.some(t => !MODERN_TIERS.has(t));
    if (mod && plain) { cat.set(id, null); continue; } // (a modern look and a plain one: the sofa, the double bed)
    const byRole = roles.get(id);
    if (byRole?.size) { cat.set(id, one(byRole)); continue; }
    cat.set(id, mod ? 'modern' : one(tiers.map(t => cultureTier.get(t))));
  }
  const room = new Map(); const roomKeys = new Map();
  for (const [key, code] of rooms) (roomKeys.get(key) || roomKeys.set(key, new Set()).get(key)).add(genreOfCode.get(code));
  for (const [key, gs] of roomKeys) room.set(key, one(gs));
  const fig = new Map();
  for (const f of figures) {
    const g = f.genre ? (f.genre === 'cultures' ? 'cultures' : f.genre) : f.setting && genreOfCode.get(f.setting);
    fig.set(f.id, g || ((f.tags || []).includes('dinosaur') ? null : FANTASY_GROUPS.has(f.group) ? 'fantasy' : MODERN_GROUPS.has(f.group) ? 'modern' : null));
  }
  return { catGenre: (id) => cat.get(id) ?? null, figGenre: (id) => fig.get(id) ?? null, roomGenre: (key) => room.get(key) ?? null };
}

/** What one area's entities weigh, by genre: { mass: { key: weight }, total }. `seen(e)`: false for what this seat may not
 *  see (a player's hidden or fogged things are never counted). */
export function areaMass(entities, index, seen = () => true) {
  const mass = {}; let total = 0;
  const add = (k, w) => { if (!k || !(w > 0)) return; mass[k] = (mass[k] || 0) + w; total += w; };
  for (const e of Object.values(entities || {})) {
    if (!e || !seen(e)) continue;
    if (e.kind === 'room') add(index.roomGenre(e.recipe?.type), WEIGHT.cell * (e.recipe?.w || 0) * (e.recipe?.d || 0));
    else if (e.kind === 'object') add(index.catGenre(e.cat), WEIGHT.object);
    else if (e.kind === 'token' && e.fig) add(index.figGenre(e.fig), WEIGHT.pawn);
  }
  return { mass, total };
}

/** The table's profile from the area in view and (lighter) the campaign's other areas: { mix: { key: share }, strength }. */
export function tableProfile(here, others = []) {
  const mass = {}; let total = 0;
  const take = (m, k) => { if (!m) return; for (const [g, w] of Object.entries(m.mass)) { mass[g] = (mass[g] || 0) + w * k; total += w * k; } };
  take(here, 1); for (const o of others) take(o, FALLBACK);
  if (!(total > 0)) return NO_PROFILE;
  const mix = {}; for (const [g, w] of Object.entries(mass)) mix[g] = w / total;
  return { mix, strength: total / (total + HALF_MASS), mass: total };
}
export const NO_PROFILE = Object.freeze({ mix: Object.freeze({}), strength: 0, mass: 0 });

// how alike two genre keys are: the same 1; fantasy and a culture, or two cultures, KIN; anything and modern 0
const family = (k) => k === 'fantasy' || k.startsWith('cultures') ? 'old' : k;
export function kinship(a, b) {
  if (a === b) return 1;
  if (a.startsWith('cultures') && b.startsWith('cultures') && (a === 'cultures' || b === 'cultures')) return (1 + KIN) / 2; // (a thing of several cultures and one of them)
  return family(a) === family(b) ? KIN : 0;
}
/** How well a thing of genre `key` fits the table: 0..1. A neutral thing (key null) fits as well as the best-fitting genre
 *  on the table (x NEUTRAL_FIT): exactly as well as the table's own things, so a tie between a crate and a fantasy box stays
 *  as it was on a table that is 99% fantasy and 1% Chinese lanterns. */
export function fitOf(profile, key) {
  if (key == null) { let best = 0; for (const g of Object.keys(profile.mix)) best = Math.max(best, fitOf(profile, g)); return NEUTRAL_FIT * best; }
  let f = 0; for (const [g, share] of Object.entries(profile.mix)) f += share * kinship(g, key);
  return f;
}
/** The bonus a row gets: 0 on a table with no signal, or for a row that does not name what it is (named false). */
export function tiltOf(profile, key, named = true) {
  if (!profile?.strength || !named) return 0;
  return GENRE_TILT * profile.strength * fitOf(profile, key);
}
