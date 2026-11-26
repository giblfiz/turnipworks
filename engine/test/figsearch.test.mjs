// WHICH FIGURE A NAME FINDS (2026-11-06; docs/PAWNS.md "Which goblin"; client/figsearch.js).
//   node engine/test/figsearch.test.mjs
// Found 2026-11-04: "6 goblins" in the command bar placed six Goblin bosses. The count placement takes the top figure row,
// and the boss (whose SRD names list "goblin") tied with the plain goblins on the own-name bonus and won on its shorter name.
// 1. "goblin", "goblins", "6 goblins", "add 6 goblins", "goblin x6": the top row is a plain goblin, never the boss
// 2. "goblin boss" still finds the boss first; "hobgoblin captain", "hobgoblins" the same way round
// 3. every creature the catalog has as "Name, variant": its name, singular and plural, tops with one of its own
import fs from 'node:fs';
import { figureSearch } from '../client/figsearch.js';
import { figureQuery } from '../client/surfaces/bar.js'; // the bar's own parse of a count line ("6 goblins" -> count 6, text "goblins")

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const list = JSON.parse(fs.readFileSync(new URL('../tuner-data/figures.json', import.meta.url))).figures;
const search = figureSearch(list);
const top = (q) => search(q)[0]?.fig;
const base = (f) => f?.name.toLowerCase().split(',')[0].trim();

ok(list.length > 400 && list.some(f => f.id === 'foe-goblin-boss'), 'the catalog loaded, with its Goblin boss', list.length);
for (const q of ['goblin', 'goblins', 'Goblins', '6 goblins', 'add 6 goblins', 'goblin x6', 'add a goblin']) {
  const t = figureQuery(q).text, f = top(t);
  ok(f && f.id !== 'foe-goblin-boss' && base(f) === 'goblin', `"${q}" tops with a plain goblin, not the boss`, `${t} -> ${f?.id}`);
}
ok(top('goblin boss')?.id === 'foe-goblin-boss', '"goblin boss" still finds the boss first', top('goblin boss')?.id);
ok(top('boss goblin')?.id === 'foe-goblin-boss', '"boss goblin" too', top('boss goblin')?.id);
ok(top('goblin spear')?.id === 'foe-goblin-spear', '"goblin spear" finds the spear goblin', top('goblin spear')?.id);
ok(top('hobgoblin captain')?.id === 'foe-hobgoblin-captain', '"hobgoblin captain" finds the captain', top('hobgoblin captain')?.id);
for (const q of ['hobgoblin', 'hobgoblins']) ok(base(top(q)) === 'hobgoblin', `"${q}" tops with a plain hobgoblin, not the captain or warlord`, top(q)?.id);
ok(top('owlbear')?.name.toLowerCase().startsWith('owlbear'), '"owlbear" unchanged', top('owlbear')?.id);

// 3. every "Name, variant" family: its own name in any number tops with one of the family
const families = [...new Set(list.filter(f => f.name.includes(',')).map(base))];
for (const name of families) for (const q of [name, name + 's']) {
  const f = top(q);
  ok(base(f) === name, `"${q}" tops with a ${name}, not a different creature built on one`, `${q} -> ${f?.name}`);
}

// 4. THE CULTURE PAWNS (2026-11-07; docs/PAWNS.md "Pawns by culture"): named culture word first ("Norse smith"), so a
//    plain trade typed in the bar still finds the house's own townsfolk first, and the culture's words find the culture's
{ // (a stand-in, so this holds before the catalog has culture figures: a genre figure with a short name and the same words)
  const fake = { id: 'cul-x-smith', name: 'Norse smith', group: 'townsfolk', cls: 'smith', race: 'human', gender: 'm', tags: ['smith', 'blacksmith', 'norse', 'viking', 'npc'], srd: ['commoner'], setting: 'NRS' };
  const S = figureSearch([...list, fake]), t = (q) => S(q)[0]?.fig;
  ok(t('smith') && !t('smith').setting, '"smith" tops with the house\'s own smith, not a genre set\'s shorter-named one', t('smith')?.id);
  ok(['cul-x-smith', 'cul-nrs-smith'].includes(t('norse smith')?.id) && !!t('viking')?.setting, '"norse smith" finds a genre set\'s smith, "viking" a genre figure', [t('norse smith')?.id, t('viking')?.id]);
}
const cul = list.filter(f => f.setting);
if (cul.length) {
  for (const q of ['smith', 'merchant', 'carpenter', 'princess', 'noble']) { const f = top(q); ok(f && !f.setting, `"${q}" still tops with the house's own figure, not a culture's`, `${q} -> ${f?.id}`); }
  for (const [q, id] of [['norse smith', 'cul-nrs-smith'], ['samurai', 'cul-jpn-samurai'], ['japanese samurai', 'cul-jpn-samurai'], ['viking shieldmaiden', 'cul-nrs-shieldmaiden'], ['jaguar warrior', 'cul-mes-jaguar-warrior'], ['aztec warrior', 'cul-mes-jaguar-warrior'], ['onmyoji', 'cul-jpn-onmyoji'], ['volva', 'cul-nrs-volva'], ['daoist priest', 'cul-chn-daoist-priest'], ['rus carpenter', 'cul-rus-carpenter'], ['chinese merchant', 'cul-chn-silk-merchant']]) {
    if (!list.some(f => f.id === id)) continue;
    const f = top(q); ok(f?.id === id, `"${q}" finds ${id}`, `${q} -> ${f?.id}`);
  }
  for (const [q, code] of [['mamluk', 'MDE'], ['viking', 'NRS'], ['aztec', 'MES'], ['edo', 'JPN'], ['qing', 'CHN'], ['rajput', 'IND'], ['novgorod', 'RUS']]) ok(top(q)?.setting === code, `"${q}" finds one of that culture's figures`, `${q} -> ${top(q)?.id}`);
  const t = figureQuery('6 samurai'); ok(t.count === 6 && top(t.text)?.id === 'cul-jpn-samurai', '"6 samurai" places six samurai', t);
}

console.log(`figsearch: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
