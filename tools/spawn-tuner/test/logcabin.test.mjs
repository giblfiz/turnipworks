// The log-cabin wall style (Harry 2026-10-05) never mixes with the plank (rough-timber) walls.  node tools/spawn-tuner/test/logcabin.test.mjs
//   1. only a room that used to roll rough-timber can roll log-cabin; every other room keeps the family it had
//   2. the library's pieces sort cleanly: the stacked-log wall is log-cabin's only wall, the plank family has no log piece,
//      and the wall with a handle sticking out of it (1 star) is never picked
//   3. props that pick by wall family (floors, trapdoors) and missing pieces (doorway) borrow rough-timber's
import { readFileSync } from 'node:fs';
import { familyFor, meshFamily, hash, WALL_FAMILIES, FAMILY_FALLBACK, TO_KIT } from '../js/walls.js';
import { skuUsable } from '../js/solver.js';
const here = new URL('..', import.meta.url).pathname;
const lib = JSON.parse(readFileSync(here + 'data/library.json'));
const types = JSON.parse(readFileSync(here + 'data/rooms.json'));
let checks = 0; const bad = [];
const ok = (cond, msg) => { checks++; if (!cond) bad.push(msg); };
// the odds before log-cabin existed (walls.js, 2026-10-01)
const OLD = {
  common: { 'rough-timber': 0.35, 'half-timber': 0.3, fieldstone: 0.2, 'dressed-stone': 0.15 },
  kitchen: { fieldstone: 0.3, 'half-timber': 0.25, 'rough-timber': 0.25, 'dressed-stone': 0.2 },
  storeroom: { 'rough-timber': 0.4, fieldstone: 0.4, 'dressed-stone': 0.2 },
  cellar: { 'dressed-stone': 0.6, fieldstone: 0.4 },
  guest: { 'half-timber': 0.4, 'rough-timber': 0.4, 'noble-interior': 0.2 },
  fine: { 'noble-interior': 0.6, 'dressed-stone': 0.2, 'half-timber': 0.2 },
  privy: { 'rough-timber': 0.7, fieldstone: 0.3 },
  hallway: { 'half-timber': 0.35, 'rough-timber': 0.35, 'noble-interior': 0.15, 'dressed-stone': 0.15 },
  desk: { 'noble-interior': 0.3, 'half-timber': 0.3, 'rough-timber': 0.2, 'dressed-stone': 0.2 },
  stable: { 'rough-timber': 0.5, fieldstone: 0.5 },
  barn: { 'rough-timber': 0.7, fieldstone: 0.3 },
};
const seen = {};
for (const t of types) for (let s = 1; s <= 4000; s++) {
  const room = { type: t.key, wallSeed: s * 7919 + 13 };
  const now = familyFor(room, t.family);
  seen[now] = (seen[now] || 0) + 1;
  ok(WALL_FAMILIES.includes(now), `${t.key}: unknown family ${now}`);
}
// 1. replay the old roll at the same hash position
for (const [type, odds] of Object.entries(OLD)) for (let s = 1; s <= 4000; s++) {
  const room = { type, wallSeed: s * 7919 + 13 };
  let u = (hash(room.wallSeed, 'family') % 1000) / 1000, was = Object.keys(odds)[0];
  for (const [f, p] of Object.entries(odds)) { if ((u -= p) < 0) { was = f; break; } }
  const now = familyFor(room, 'rough-timber');
  ok(now === was || (now === 'log-cabin' && was === 'rough-timber'), `${type} seed ${room.wallSeed}: was ${was}, now ${now}`);
}
ok(seen['log-cabin'] > 0 && seen['rough-timber'] > seen['log-cabin'], `log-cabin should be the rarer of the two (${seen['log-cabin']} vs ${seen['rough-timber']})`);
// an explicit choice always wins
ok(familyFor({ type: 'cellar', wallSeed: 1, wallFamily: 'log-cabin' }, 'dressed-stone') === 'log-cabin', 'explicit log-cabin is not honoured');
// 2. the pieces
const usable = (id, fam) => (lib.objects[id]?.skus || []).filter(k => k.family === fam && k.bounds && skuUsable(k, {}));
const logWalls = usable('wall-straight', 'log-cabin'), plankWalls = usable('wall-straight', 'rough-timber');
ok(logWalls.length >= 1 && logWalls.some(k => k.sku === 'wall-straight--rough-timber--s3'), 'the stacked-log wall is not in the log-cabin family');
ok(plankWalls.length >= 1, 'rough-timber has no usable wall piece');
ok(!plankWalls.some(k => k.sku === 'wall-straight--rough-timber--s3'), 'the stacked-log wall is still a rough-timber piece');
ok(!plankWalls.some(k => k.sku === 'wall-straight--rough-timber'), 'the wall with the handle (inn-01 wall-straight--rough-timber) is still usable');
for (const id of ['wall-window-small', 'wall-doorway']) for (const k of usable(id, 'log-cabin')) ok(/--log-cabin(--|$)/.test(k.sku), `${k.sku} is filed under log-cabin but is not a log piece`);
// 2b. the fal pieces of 2026-10-05: log-cabin has its own window (closed + open twin, linked by name) and doorway, and
//     the plank family has a second straight wall so a long plank wall is not one piece repeated
ok(usable('wall-window-small', 'log-cabin').some(k => k.sku === 'wall-window-small--log-cabin'), 'log-cabin has no window of its own');
ok(usable('wall-doorway', 'log-cabin').some(k => k.sku === 'wall-doorway--log-cabin'), 'log-cabin has no doorway of its own');
ok((lib.objects['wall-window-small-open']?.skus || []).some(k => k.sku === 'wall-window-small-open--log-cabin' && k.bounds), 'the log window has no open twin (wall-window-small-open--log-cabin)');
ok(plankWalls.length >= 2 && plankWalls.some(k => k.sku === 'wall-straight--rough-timber--s4'), `rough-timber needs two straight walls to alternate (${plankWalls.map(k => k.sku)})`);
// 3. borrowing
ok(FAMILY_FALLBACK['log-cabin'] === 'rough-timber' && meshFamily('log-cabin') === 'rough-timber', 'log-cabin does not borrow from rough-timber');
ok(TO_KIT['log-cabin'] === 'kit-plank', 'log-cabin has no kit stand-in');
ok(usable('wall-doorway', 'log-cabin').length || usable('wall-doorway', FAMILY_FALLBACK['log-cabin']).length, 'no doorway for a log-cabin room');
console.log(`${checks} log-cabin checks, ${bad.length} failed`);
for (const b of bad.slice(0, 20)) console.log('  ', b);
process.exit(bad.length ? 1 : 0);
