// FIGURE SEARCH: the figure list searched as data (no three.js here, so node tests can load it: engine/test/figsearch.test.mjs).
// Used by client/figures.js (figures.search) for the command bar's figure rows and its count placement ("6 goblins").
// name, id, group, class, race, tags, the SRD names ("owlbear", "elf wizard", "goblin spear"): every typed word must be
// found in some field of the figure; an exact field beats a word start beats a fragment.
//
// THE CREATURE'S OWN NAME (2026-11-06; docs/PAWNS.md "Which goblin"): a figure whose name, or whose name before its comma
// ("Goblin, spear" is a goblin with a spear), IS the words typed ranks above one that only lists them among its SRD names
// ("Goblin boss" lists "goblin": it is built on one, but it is a different creature). Before this, "6 goblins" placed six
// Goblin bosses: both kinds got the same bonus and the boss's shorter name broke the tie (found 2026-11-04).
import { near } from './barwords.js';

const GROUP_WORDS = { hero: 'hero heroes pc player character adventurer', townsfolk: 'townsfolk npc villager commoner town folk people', foe: 'foe monster enemy creature horde', beast: 'beast animal creature', large: 'large big huge giant boss monster foe',
  // the cyberpunk pack (2026-11-07), one Modern root in the Pawns menu since the same day ("we basically don't need to
  // distinguish between cyberpunk and modern now"): each of its groups answers to both words, and to the sprawl
  runner: 'runner pc player character cyberpunk modern sprawl hero', modern: 'modern cyberpunk sprawl npc contemporary townsfolk people citizen', robot: 'robot machine android droid bot construct cyberpunk modern sprawl' };
const GENDER_WORDS = { f: 'woman female she lady', m: 'man male he' };
const low = (s) => String(s || '').toLowerCase();
// a word and its singulars ("wolves", "goblins", "watchmen", "harpies")
export const forms = (w) => { const out = [w]; if (w.length > 3 && w.endsWith('ves')) out.push(w.slice(0, -3) + 'f'); if (w.length > 3 && w.endsWith('men')) out.push(w.slice(0, -3) + 'man'); if (w.length > 3 && w.endsWith('ies')) out.push(w.slice(0, -3) + 'y'); if (w.length > 3 && w.endsWith('es')) out.push(w.slice(0, -2)); if (w.length > 2 && w.endsWith('s')) out.push(w.slice(0, -1)); return out; };

export function figureSearch(list) {
  const index = list.map(f => ({ f, name: low(f.name), base: low(f.name).split(',')[0].trim(), fields: [low(f.name), f.id, f.id.replace(/-/g, ' '), low(f.cls).replace(/-/g, ' '), low(f.race), ...(f.tags || []).map(low), ...(f.srd || []).map(low)], soft: `${GROUP_WORDS[f.group] || f.group} ${GENDER_WORDS[f.gender] || ''}`.split(' ').filter(Boolean), genre: !!(f.setting || f.genre) }));
  // THE HOUSE'S OWN FIRST (2026-11-07, culture pawns; docs/PAWNS.md "Pawns by culture"): a figure of a genre set (the
  // Norse smith, the Japanese spy) ranks after the house's own figures when every word typed is one the house's own
  // figures also answer to ("smith", "6 guards", "rogue"); a word only the set has ("norse smith", "samurai", "aztec")
  // finds the set's figure first as before.
  const HOUSE = new Set(); for (const it of index) if (!it.genre) for (const t of it.fields) if (t) { HOUSE.add(t); for (const w of t.split(/[\s,()-]+/)) if (w) HOUSE.add(w); }
  const houseWord = (w) => forms(w).some(x => HOUSE.has(x));
  const wordScore = (w, it) => {
    let best = 0;
    for (const t of it.fields) { if (!t) continue; const s = t === w ? 100 : t.startsWith(w) ? 80 : (t.includes(' ' + w) || t.includes('-' + w)) ? 64 : w.length > 2 && t.includes(w) ? 40 : 0; if (s > best) best = s; if (best === 100) break; }
    if (best < 70) for (const t of it.soft) { const s = t === w ? 70 : w.length > 2 && t.startsWith(w) ? 52 : 0; if (s > best) best = s; }
    if (!best) for (const t of it.fields) { if (t && (best = near(w, t))) break; } // one slip ("goblinn", "skelton"): the bar's near miss
    return best;
  };
  return function search(q, { limit = 8 } = {}) {
    const words = low(q).split(/[\s,]+/).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    for (const it of index) {
      let total = 0, ok = true;
      for (const w of words) { let b = 0; for (const x of forms(w)) { const s = wordScore(x, it); if (s > b) b = s; } if (!b) { ok = false; break; } total += b; }
      if (!ok) continue;
      let s = total / words.length;
      const whole = words.join(' '), singular = words.map(w => forms(w).slice(-1)[0]).join(' ');
      const own = (x) => x === whole || x === singular;
      if (own(it.name) || own(it.base)) s += 36; // its own name: "goblin" for every "Goblin, …"
      else if ((it.f.srd || []).some(x => own(low(x)))) s += 30; // an SRD name it lists ("goblin" on the Goblin boss)
      else if (it.name.startsWith(whole) || it.name.startsWith(singular)) s += 12;
      if (it.genre && words.every(houseWord)) s -= 20;
      out.push({ fig: it.f, s: s - it.name.length * 0.02 });
    }
    out.sort((a, b) => b.s - a.s || (a.fig.id < b.fig.id ? -1 : 1));
    return limit ? out.slice(0, limit) : out;
  };
}
