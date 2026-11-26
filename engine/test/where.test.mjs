// THE TRAY BREADCRUMB RULE (Harry 2026-11-12; client/surfaces/where.js): the "where you are" header shows at most the
// immediate parent in grey, an ellipsis for anything higher, then the owner big; the chips are named for their list in
// the plural; the pawn tree's levels carry the words the chips use.
//   node engine/test/where.test.mjs
import fs from 'node:fs';
import { whereHead, navChip, plural } from '../client/surfaces/where.js';
import { buildPawnTree } from '../client/pawntree.js';
let pass = 0, fail = 0;
const check = (ok, name, detail = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const text = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const pathOf = (h) => text((h.match(/<span class="wpath">(.*?)<\/span>/) || [, ''])[1]);
const bigOf = (h) => text((h.match(/<b>(.*?)<\/b>/) || [, ''])[1]);

let h = whereHead({ label: 'Genres' });
check(pathOf(h) === '' && bigOf(h) === 'Genres' && h.includes('bwhere top'), 'the top: the list\'s own name, no path, no owner icon', h);
h = whereHead({ pic: '<img class="nic">', trail: [], label: 'Fantasy' });
check(pathOf(h) === '' && bigOf(h) === 'Fantasy' && !h.includes(' top'), 'one down: the owner big, nothing grey', h);
h = whereHead({ pic: '<img class="nic">', trail: ['Fantasy'], label: 'Tavern & inn' });
check(pathOf(h) === 'Fantasy ›' && bigOf(h) === 'Tavern & inn', 'two down: "Fantasy ›" grey, "Tavern & inn" big', pathOf(h));
h = whereHead({ pic: '<img class="nic">', trail: ['Fantasy', 'Castle'], label: 'Throne room' });
check(pathOf(h) === '… › Castle ›' && bigOf(h) === 'Throne room' && h.includes('title="Fantasy › Castle › Throne room"'), 'three down: "… › Castle ›" (only the immediate parent; the ellipsis for anything higher), the whole path in the hover name', pathOf(h));
h = whereHead({ pic: '<img class="nic">', trail: ['A', 'B', 'C', 'D'], label: 'E' });
check(pathOf(h) === '… › D ›' && (pathOf(h).match(/…/g) || []).length === 1, 'deeper still: still one grey parent and one ellipsis', pathOf(h));
const c = navChip({ attrs: 'data-anc="1"', pic: '<img>', label: 'Types', key: '⇧T', tip: 'Back to the types of Fantasy' });
check(/^<button class="bchip nav"/.test(c) && text(c) === 'Types⇧T' && c.includes('aria-label="Back to the types of Fantasy"'), 'a chip is a button: the list it opens, its key, and where it goes back to in words', text(c));
check(plural('Family') === 'Families' && plural('Class') === 'Classes' && plural('Archetype') === 'Archetypes' && plural('Race') === 'Races' && plural('Group') === 'Groups', 'the plurals', ['Family', 'Class', 'Archetype', 'Race', 'Group'].map(plural).join(' '));

// the pawn tree: every node with children has children whose `word` names them (or the level default)
const figs = JSON.parse(fs.readFileSync(new URL('../../tools/spawn-tuner/data/figures.json', import.meta.url))).figures || [];
const types = JSON.parse(fs.readFileSync(new URL('../client/data/types.json', import.meta.url)));
const X = buildPawnTree(figs.filter(f => f.thumb !== undefined || true), undefined, { genres: { of: (c) => (types.types.find(t => t.code === c) || {}).genre || null, label: (k) => (types.genres.find(g => g.key === k) || {}).label || null, order: types.genres.map(g => g.key), codes: types.types.map(t => t.code) } });
const words = Object.fromEntries(X.roots.map(r => [r.id, [...new Set((r.children || []).map(k => k.word || '(Family)'))].join(',')]));
check(words.heroes === 'Class' && words.monsters === 'Family' && words.townsfolk === 'Group' && words.modern === 'Group', 'the chips\' words under each kind: Heroes ▸ Classes, Monsters ▸ Families, Townsfolk and Modern ▸ Groups', JSON.stringify(words));
const runners = X.get('modern/runners');
check(runners && (runners.children || []).every(k => k.word === 'Archetype'), 'Modern ▸ Runners ▸ Archetypes');
const cult = X.roots.filter(r => r.genre).flatMap(r => r.children || []);
check(!cult.length || cult.every(k => k.word === 'Culture'), `a genre's people: its cultures are "Cultures" (${cult.length})`);
console.log(`where: ${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
