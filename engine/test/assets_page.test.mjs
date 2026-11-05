// node test/assets_page.test.mjs : THE ASSETS PAGE'S DATA AND ITS LINKS INTO THE GAME (2026-11-04; engine/tools/site_assets.py,
// client/deeplink.js). On the tuner's own data and the code the browser runs:
//   data     the page's tree is the Build menu's: every type with rooms is a pack, with the same rooms; every thing the
//            command bar can place by hand (assets.js catalog, less floors/holes/faction slots) is on the page; every
//            look's file is one the game loads (assets/m or assets/flat, a file that exists in the tuner's assets/)
//   links    readDeepLink / withoutDeepLink read and clean ?place= ?pawn= ?pack=, and keep everything else
//   pack     every pack's and room's ?pack= value names its Build-menu node (packNode), by code and by slug
//   names    every ?place= on the page is a command-bar catalog id and every ?pawn= a figure id
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildTaxonomy } from '../client/taxonomy.js';
import { handPlaceable, isFloorCat } from '../client/library-index.js';
import { isFactionSlot } from '../core/faction-catalog.js';
import { readDeepLink, withoutDeepLink, packNode, DEEP_KEYS } from '../client/deeplink.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import * as solver from '../../tools/spawn-tuner/js/solver.js';
let fails = 0, n = 0; const ok = (name, cond, got) => { n++; if (!cond) { fails++; console.log('FAIL', name, got ?? ''); } else console.log('ok  ', name, got ?? ''); };
const read = (u) => JSON.parse(fs.readFileSync(new URL(u, import.meta.url)));
const lib = read('../tuner-data/library.json'), rooms = read('../tuner-data/rooms.json'), types = read('../client/data/types.json'), spawns = read('../client/data/library-spawns.json');
const figs = read('../tuner-data/figures.json').figures;
const usable = (k) => solver.skuUsable(k, SOLVER_OPTS);
const X = buildTaxonomy({ lib, roomTypes: rooms, data: types, usable, spawns });
const D = JSON.parse(execFileSync('node', [new URL('../tools/site_assets_data.mjs', import.meta.url).pathname], { maxBuffer: 64 << 20 }));
const ASSETS = new URL('../../tools/spawn-tuner/assets/', import.meta.url).pathname;

// ---- data
const typed = [...X.nodes.values()].filter(t => t.level === 'type' && t.children.length);
const byCode = new Map(D.packs.map(p => [p.code, p]));
ok('every Build-menu type with rooms is a pack', typed.every(t => byCode.has(t.code)), typed.filter(t => !byCode.has(t.code)).map(t => t.code).join(', ') || `${typed.length} types`);
ok('each pack has the same rooms as its Build-menu type, in order', typed.every(t => JSON.stringify(byCode.get(t.code).rooms.map(r => r.key)) === JSON.stringify(t.children.map(id => X.get(id).roomKey))));
ok('the page\'s own packs are there: building kit, faction pieces, figures', ['building-kit', 'faction-pieces', 'figures'].every(s => D.packs.some(p => p.slug === s)));
const onPage = new Set(D.packs.filter(p => p.kind !== 'figures').flatMap(p => p.things));
const placeable = [...handPlaceable(lib, usable)].filter(id => !isFloorCat(id) && !isFactionSlot(id) && lib.objects[id]);
const off = placeable.filter(id => !onPage.has(id));
ok('every thing the command bar places by hand is on the page', !off.length, off.length ? `${off.length} missing: ${off.slice(0, 12).join(', ')}` : `${placeable.length} hand-placeable, ${onPage.size} on the page`);
const looks = Object.entries(D.things).flatMap(([id, t]) => t.l.map(l => ({ id, t, sku: l[0], h: l[1] })));
const fileOf = (x) => (x.t.f ? `flat/${x.sku}.webp` : `m/${x.sku}.glb`);
const noFile = looks.filter(x => !fs.existsSync(ASSETS + fileOf(x)));
ok('every look\'s file exists in the tuner\'s assets (the files /look/ serves)', !noFile.length, noFile.length ? noFile.slice(0, 8).map(fileOf).join(', ') : `${looks.length} looks`);
const noSku = looks.filter(x => !lib.objects[x.id]?.skus.some(k => k.sku === x.sku && usable(k)));
ok('every look is a usable sku of its thing (nothing rated out, nothing retired)', !noSku.length, noSku.slice(0, 8).map(x => x.sku).join(', '));
const figOk = Object.entries(D.figures).every(([id, f]) => figs.some(g => g.id === id && g.url === `assets/figures/${id}--${f.x}.glb`));
ok('every figure\'s file is the one the game loads (figures.json url)', figOk, `${Object.keys(D.figures).length} figures`);
ok('the credit line and licence are the house\'s', D.credit === 'Turnip Works assets (https://turnipworks.net), CC BY 4.0' && D.license === 'https://creativecommons.org/licenses/by/4.0/');
const refs = D.packs.flatMap(p => p.rooms.flatMap(r => r.sections.flatMap(s => s[2].map(e => [p, e]))));
const badRef = refs.filter(([p, e]) => p.kind === 'figures' ? !D.figures[e] : !(D.things[e.split('|')[0]]?.l[+e.split('|')[1] || 0]));
ok('every entry of every room names a thing and one of its looks (or a figure)', !badRef.length, badRef.slice(0, 6).map(([, e]) => e).join(', ') || `${refs.length} entries`);

// ---- links
ok('readDeepLink reads ?place=', JSON.stringify(readDeepLink('?place=barrel&nointro')) === JSON.stringify({ kind: 'place', value: 'barrel' }));
ok('readDeepLink reads ?pawn= and ?pack=', readDeepLink('?pawn=beast-ape').kind === 'pawn' && readDeepLink('?pack=CRY/crypt-vault').value === 'CRY/crypt-vault');
ok('readDeepLink: nothing, or an empty value, is no link', readDeepLink('') === null && readDeepLink('?place=') === null && readDeepLink('?utm_source=x') === null);
ok('withoutDeepLink keeps the rest of the address', withoutDeepLink({ pathname: '/', search: '?place=barrel&relay=x', hash: '#s=abc' }) === '/?relay=x#s=abc' && withoutDeepLink({ pathname: '/p', search: '?pack=TAV', hash: '' }) === '/p');
ok('the keys are place, pawn, pack', DEEP_KEYS.join() === 'place,pawn,pack');

// ---- pack: every pack's and room's link names its Build-menu node
const tx = { get: (id) => X.get(id) };
let packBad = [];
for (const p of D.packs.filter(p => !p.kind)) {
  const t = types.types.find(x => x.code === p.code);
  if (packNode(tx, types.types, p.code)?.id !== `t:${p.code}` || packNode(tx, types.types, t.slug)?.id !== `t:${p.code}`) packBad.push(p.code);
  for (const r of p.rooms) if (packNode(tx, types.types, `${p.code}/${r.key}`)?.id !== `r:${p.code}:${r.key}`) packBad.push(`${p.code}/${r.key}`);
}
ok('every pack\'s and room\'s ?pack= names its Build-menu node (by code and by slug)', !packBad.length, packBad.slice(0, 8).join(', ') || `${D.packs.filter(p => !p.kind).length} packs`);
ok('packNode: an unknown type or room is null', packNode(tx, types.types, 'XXX') === null && packNode(tx, types.types, 'TAV/nowhere') === null && packNode(tx, types.types, 'RUI') === null);

// ---- names: what the page's buttons ask for is what the game can find (assets.js catalog ids, figure ids)
const catIds = new Set(Object.values(lib.objects).filter(o => !isFactionSlot(o.id)).map(o => o.id));
const thingIds = Object.keys(D.things).filter(id => !isFactionSlot(id));
ok('every ?place= the page offers is a catalog id', thingIds.every(id => catIds.has(id)));
ok('every ?pawn= the page offers is a figure id', Object.keys(D.figures).every(id => figs.some(f => f.id === id)));

console.log(`\n${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
