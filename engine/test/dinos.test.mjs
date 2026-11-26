// THE DINOSAURS (Harry 2026-11-07: "can we flesh out the set of dinosaur tokens? I notice you've got T-Rex and
// Triceratops, but let's get our top 8 favorites all done. So Ankylosaurus, Spinosaurus, Stegosaurus, Pterodactyl,
// Brontosaurus, Quetzalcoatlus."; the velociraptor added as the obvious ninth; docs/PAWNS.md "The dinosaurs").
//   node engine/test/dinos.test.mjs
// 1. the nine figures are in the published list, each with its mesh, picture and original
// 2. sane sizes: the base by the engine's size categories (core/size.js: size = squares a side), Harry's: brontosaurus
//    gargantuan; spinosaurus, stegosaurus, ankylosaurus and quetzalcoatlus huge; the pterodactyl large; the velociraptor
//    medium; heights in feet that keep the right order (a raptor under a man and a half, the brontosaurus the tallest)
//    The tyrannosaur and triceratops HUGE too (Harry 2026-11-07, dinohuge lane: 5e has both huge), drawn 1.5x what they were
//    (18 and 10.5 ft): the T-Rex not shorter than the stegosaurus
// 2b. the pterodactyl STANDS in its flying pose (Harry 2026-11-07: "The standing [pterodactyl] needs to be thrown away. For
//    now let's just use the flying one as standing."): its standing row is the flying mesh, the same file raised or not
// 3. the two pterosaurs have a flying pose (the flying-figures rule: worn when raised), with wings wider than it is tall
// 4. the bar: each one by its name, the synonyms a table types (brontosaurus/apatosaurus/brachiosaurus/"long neck",
//    pterodactyl/pteranodon, raptor, t-rex), "dino" and "dinosaur" find all nine, "6 raptors" places six raptors
// 5. the Pawns menu: Monsters ▸ Dinosaurs holds the nine and nothing else, in one grid (no "more…")
import fs from 'node:fs';
import { buildPawnTree, GRID_CAP } from '../client/pawntree.js';
import { figureSearch } from '../client/figsearch.js';
import { figureQuery } from '../client/surfaces/bar.js';
import { teachFigures } from '../client/barwords.js';
import { figureK } from '../core/size.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const list = teachFigures(JSON.parse(fs.readFileSync(new URL('../tuner-data/figures.json', import.meta.url))).figures);
const byId = new Map(list.map(f => [f.id, f]));
const DINOS = { // id: [name, squares a side, height range in feet]
  'foe-tyrannosaur': ['Tyrannosaur', 3, [15, 20]], 'foe-triceratops': ['Triceratops', 3, [9, 12]],
  'foe-velociraptor': ['Velociraptor', 1, [3.5, 7]], 'foe-ankylosaurus': ['Ankylosaurus', 3, [5, 9]], 'foe-stegosaurus': ['Stegosaurus', 3, [9, 15]],
  'foe-spinosaurus': ['Spinosaurus', 3, [12, 18]], 'foe-brontosaurus': ['Brontosaurus', 4, [18, 32]], 'foe-pterodactyl': ['Pterodactyl', 2, [6, 12]],
  'foe-quetzalcoatlus': ['Quetzalcoatlus', 3, [12, 20]],
};

// ---- 1. there
for (const [id, [name]] of Object.entries(DINOS)) {
  const f = byId.get(id);
  ok(f && f.name === name, `${name} is in the figure list`, f?.name);
  if (!f) continue;
  ok(f.url && f.thumb && f.full && f.tris > 0 && f.kb > 0, `${name} has its mesh, its picture and its original`, [f.url, f.thumb, f.full]);
  ok((f.tags || []).includes('dinosaur'), `${name} is tagged a dinosaur`, f.tags);
}
// ---- 2. sizes
for (const [id, [name, sq, [lo, hi]]] of Object.entries(DINOS)) {
  const f = byId.get(id); if (!f) continue;
  ok(f.size === sq && f.base === sq * 5, `${name} stands on a ${sq * 5}-ft base (${['', 'medium', 'large', 'huge', 'gargantuan'][sq]})`, [f.size, f.base]);
  ok(f.h >= lo && f.h <= hi && f.oh >= f.h, `${name} is ${lo}-${hi} ft tall`, [f.h, f.oh]);
  ok(Math.abs(figureK(f.size, f) - 1) < 1e-9, `${name} is drawn at its made size on its own base`, figureK(f.size, f));
  ok(f.k > 0 && Array.isArray(f.c) && f.c.length === 2 && f.yaw === 0, `${name} has its frame (scale, ground centre, facing)`, [f.k, f.c, f.yaw]);
}
const H = (id) => byId.get(id)?.h ?? NaN;
ok(H('foe-brontosaurus') > Math.max(...Object.keys(DINOS).filter(i => i !== 'foe-brontosaurus').map(H)), 'the brontosaurus is the tallest dinosaur', Object.keys(DINOS).map(i => [i, H(i)]));
ok(H('foe-velociraptor') < H('foe-tyrannosaur') / 2, 'a velociraptor is under half a tyrannosaur', [H('foe-velociraptor'), H('foe-tyrannosaur')]);
// the two from the first set are huge now, like the new huge ones; the T-Rex is drawn 1.5x what it was and stands tallest of the hunters
for (const id of ['foe-tyrannosaur', 'foe-triceratops']) {
  const f = byId.get(id);
  ok(f && f.size === 3 && f.base === 15 && f.group === byId.get('foe-stegosaurus')?.group, `${DINOS[id][0]} is HUGE (15-ft base) by default, as the stegosaurus is`, [f?.size, f?.base, f?.group]);
}
ok(H('foe-tyrannosaur') >= H('foe-stegosaurus') && H('foe-tyrannosaur') >= H('foe-spinosaurus'), 'the T-Rex is not shorter than the stegosaurus or the spinosaurus', [H('foe-tyrannosaur'), H('foe-stegosaurus'), H('foe-spinosaurus')]);
ok(Math.abs(H('foe-tyrannosaur') - 18) < 0.01 && Math.abs(H('foe-triceratops') - 10.5) < 0.01, 'drawn 1.5x their old height (12 -> 18, 7 -> 10.5): what "make it huge" drew before', [H('foe-tyrannosaur'), H('foe-triceratops')]);
// a large T-Rex pawn already on a table (size 2 stored on it) is still drawn as it was: 18 ft x 2/3 = 12
ok(Math.abs(figureK(2, byId.get('foe-tyrannosaur')) * H('foe-tyrannosaur') - 12) < 0.01, 'a T-Rex pawn saved as large still draws 12 ft tall', figureK(2, byId.get('foe-tyrannosaur')));
// ---- 2b. the pterodactyl stands as its flier
{
  const f = byId.get('foe-pterodactyl'), y = f?.fly, sha = (u) => (u || '').match(/-([0-9a-f]{8})\.(?:glb|webp)$/)?.[1];
  ok(f && y && sha(f.url) && sha(f.url) === sha(y.url) && sha(f.full) === sha(y.full) && sha(f.thumb) === sha(y.url), 'the pterodactyl stands in its flying mesh (its tier, original and picture are the flier\'s)', [f?.url, f?.full, f?.thumb, y?.url]);
  ok(f && y && f.k === y.k && f.h === y.h && JSON.stringify(f.c) === JSON.stringify(y.c), 'standing or raised, the same frame (scale, height, ground centre)', [f?.k, y?.k, f?.h, y?.h, f?.c, y?.c]);
  ok(f && f.size === 2 && f.id === 'foe-pterodactyl' && (f.tags || []).includes('pteranodon'), 'still the large foe-pterodactyl (saved maps load it) with its search words', [f?.size, f?.tags]);
  ok(!/foe-pterodactyl--\w+-139ad9df/.test(JSON.stringify(f)), 'the thrown-away standing mesh (139ad9df) is named nowhere', f?.url);
}
// ---- 3. the pterosaurs fly
for (const id of ['foe-pterodactyl', 'foe-quetzalcoatlus']) {
  const f = byId.get(id), y = f?.fly;
  ok(y && y.url && y.k > 0 && y.span > 0 && y.h > 0, `${DINOS[id][0]} has a flying pose`, y);
  // (wider than tall: the wings are in an up-stroke V, so the pose is tall too; the fly lane's eagle is 1.2x)
  if (y) ok(y.span > y.h && y.span >= f.base * 0.8, `${DINOS[id][0]}'s flying pose has wings wider than it is tall, about its base or more`, [y.span, y.h, f.base]);
}
ok(byId.get('foe-quetzalcoatlus')?.fly?.span > byId.get('foe-pterodactyl')?.fly?.span, 'the quetzalcoatlus has the bigger wingspan', [byId.get('foe-quetzalcoatlus')?.fly?.span, byId.get('foe-pterodactyl')?.fly?.span]);
// ---- 4. the bar
const search = figureSearch(list);
const top = (q) => search(figureQuery(q).text)[0]?.fig?.id;
for (const [q, id] of [['velociraptor', 'foe-velociraptor'], ['raptor', 'foe-velociraptor'], ['raptors', 'foe-velociraptor'], ['ankylosaurus', 'foe-ankylosaurus'], ['stegosaurus', 'foe-stegosaurus'],
  ['spinosaurus', 'foe-spinosaurus'], ['brontosaurus', 'foe-brontosaurus'], ['apatosaurus', 'foe-brontosaurus'], ['brachiosaurus', 'foe-brontosaurus'], ['diplodocus', 'foe-brontosaurus'],
  ['long neck', 'foe-brontosaurus'], ['longneck', 'foe-brontosaurus'], ['sauropod', 'foe-brontosaurus'], ['pterodactyl', 'foe-pterodactyl'], ['pteranodon', 'foe-pterodactyl'],
  ['quetzalcoatlus', 'foe-quetzalcoatlus'], ['t-rex', 'foe-tyrannosaur'], ['trex', 'foe-tyrannosaur'], ['tyrannosaurus', 'foe-tyrannosaur'], ['triceratops', 'foe-triceratops'],
  ['add a stegosaurus', 'foe-stegosaurus'], ['place a pterodactyl', 'foe-pterodactyl']]) ok(top(q) === id, `"${q}" finds ${id}`, `${q} -> ${top(q)}`);
for (const q of ['dinosaur', 'dinosaurs', 'dino', 'dinos']) {
  const got = new Set(search(q, { limit: 0 }).map(r => r.fig.id)), first = search(q, { limit: 9 }).map(r => r.fig.id);
  ok(Object.keys(DINOS).every(i => got.has(i)), `"${q}" finds all nine`, Object.keys(DINOS).filter(i => !got.has(i)));
  ok(first.every(i => i in DINOS), `"${q}": its first nine rows are the nine dinosaurs`, first);
}
const six = figureQuery('6 raptors'); ok(six.count === 6 && top('6 raptors') === 'foe-velociraptor', '"6 raptors" places six velociraptors', six);
ok(!['foe-velociraptor', 'foe-pterodactyl', 'foe-quetzalcoatlus'].includes(top('hawk')) && !['foe-pterodactyl', 'foe-quetzalcoatlus'].includes(top('eagle')), 'a hawk is still a hawk and an eagle an eagle', [top('hawk'), top('eagle')]);
// ---- 5. the Pawns menu
const X = buildPawnTree(list);
const mon = X.get('monsters'), dn = mon?.children?.find(c => c.label === 'Dinosaurs');
ok(dn, 'Monsters has a Dinosaurs tile', mon?.children?.map(c => c.label));
if (dn) {
  const ids = (dn.figs || []).map(f => f.id);
  ok(ids.length === 9 && Object.keys(DINOS).every(i => ids.includes(i)), 'Dinosaurs holds the nine', ids);
  ok(ids.length <= GRID_CAP && !dn.more?.startsWith?.('more…'), 'in one grid (no "more…")', [ids.length, GRID_CAP]);
}
const wild = mon?.children?.find(c => c.label === 'Wild beasts');
ok(wild && !(wild.figs || []).some(f => f.id in DINOS), 'Wild beasts no longer holds the tyrannosaur and triceratops', (wild?.figs || []).map(f => f.id));

console.log(`dinos: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
