// PASTE LANDS ON THE LEVEL YOU ARE ACTING ON (2026-11-25; client/clipboard.js "The level a paste lands on").
// Harry on dev: "I'm trying to copy and paste a mimic. The copy seems to work ('copied 1 thing'), but when I hit paste I'm
// not seeing the mimic go in." Then: "Those mimics got pasted, but not onto the level that I was acting on." The paste
// sent no height, so every copy went to y 0: over the Dragon Temple's vault (lv -2) that is the forge above it, which the
// cut hides. This checks the pure parts: what a copy carries (lift), the height a paste is sent at, where a paste steps
// to so it never stacks, the clip text round trip, and (core) that a pawn sent at the pointer's floor is in the cellar.
//   node engine/test/paste.test.mjs
import { applyArea } from '../core/commands.js';
import { newArea } from '../core/state.js';
import * as HT from '../core/height.js';
import { clipFrom, clipOrigin, copyText, parseClip, pasteY, pasteStep, pasteOffsets, PASTE_STEP } from '../client/clipboard.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

// a forge on the ground over a vault 20 ft down (the Dragon Temple's shape: forge 4,15 4x4; vault 3,16 4x3 at -20)
const EMPTY = { hash: 't', summary: 't', objects: [] };
let A = newArea('area_paste0001', 'p');
A = applyArea(A, 'room.spawn', { id: 'room_forge0001', type: 'smi-forge', x: 4, z: 15, w: 4, d: 4, seed: 1, building: 'bld_paste00001', buildingName: 'B', layout: EMPTY });
A = applyArea(A, 'room.spawn', { id: 'room_vault0001', type: 'dun-vault', x: 3, z: 16, w: 4, d: 3, y: -20, seed: 2, building: 'bld_paste00001', layout: EMPTY });
A = applyArea(A, 'token.create', { id: 'tok_mimic00001', name: 'Mimic', x: 20.75, z: 86.42, y: -20, color: '#e0b04a', fig: 'foe-mimic', hidden: true, damage: 3, conditions: ['poisoned'] });
A = applyArea(A, 'token.create', { id: 'tok_bat0000001', name: 'Bat', x: 25, z: 87.5, y: -12, color: '#e0b04a' }); // flying 8 ft over the vault floor
A = applyArea(A, 'object.place', { id: 'obj_lamp000001', name: 'lamp', cat: 'lamp-wall', x: 30, z: 82.5, y: -14, room: 'room_vault0001', hidden: true }); // 6 ft up the vault's wall
const E = A.entities;

// a stand-in for the client's app (main.js): the pawn helpers the copy asks, by the core's own rule
const app = {
  entities: () => E, childrenOf: () => [], descendants: () => [],
  pawnDropAt: (e, x, y, z) => { const b = HT.baseUnder(E, x, z, y).y; return { base: b, drop: Math.max(0, y - b) }; }, // (main.js: (e, x, y, z), all four)
  pawnStands: (e) => app.pawnDropAt(e, e.x, e.y || 0, e.z).drop < 5,
};

// ---- 1. what a copy carries ----
const clip = clipFrom(app, [E.tok_mimic00001]);
eq(clip.items.map(i => [i.kind, i.lift, i.e.y, i.e.hidden]), [['token', 0, -20, true]], 'a standing pawn is copied with lift 0 (it lands on what is at the new spot), its height and hidden flag');
const fly = clipFrom(app, [E.tok_bat0000001]);
eq(fly.items[0].lift, 8, 'a flying pawn is copied with its height over the floor it is over (8 ft)');
const lamp = clipFrom(app, [E.obj_lamp000001]);
eq(lamp.items[0].lift, 6, 'a thing is copied with its height over its floor (a lamp 6 ft up a wall)');
const both = clipFrom(app, [E.tok_mimic00001, E.tok_bat0000001]);
eq(clipOrigin(both).map(v => Math.round(v * 100) / 100), [22.88, 86.96], 'the clip knows where its middle was (a paste with no pointer lands beside it)');

// ---- 2. the height a paste is sent at ----
eq(pasteY(clip.items[0], -20), -20, 'onto the vault floor (lv -2): -20, not 0 (the bug: no height was sent, so 0)');
eq(pasteY(clip.items[0], -10), -10, 'onto lv -1: -10');
eq(pasteY(clip.items[0], 10), 10, 'onto an upper storey (lv 2): 10');
eq(pasteY(clip.items[0], 0), 0, 'onto the ground: 0');
eq(pasteY(fly.items[0], 10), 18, 'a flying pawn keeps its 8 ft over the floor it is pasted onto');
eq(pasteY(lamp.items[0], 0), 6, 'a lamp keeps its 6 ft over the floor it is pasted onto');
eq(pasteY(clip.items[0], null), -20, 'no pointer floor (pointer off the table): the height it was copied at');
eq(pasteY({ kind: 'token', e: { y: -20 } }, 10), 10, 'a clip from an older build (no lift) lands on the floor');

// ---- 3. the clip text keeps all of it ----
const back = parseClip('hey, try this:\n' + copyText(clip));
eq([back.items[0].lift, back.items[0].e.hidden, back.items[0].e.y, back.items[0].e.damage, back.items[0].e.conditions], [0, true, -20, 3, ['poisoned']], 'the clipboard text round trip keeps lift, hidden, height, damage and conditions');

// ---- 4. no exact stacking ----
const offs = pasteOffsets();
eq([offs[0], offs.slice(1, 5).map(String).sort()], [[0, 0], [[PASTE_STEP, 0], [0, PASTE_STEP], [-PASTE_STEP, 0], [0, -PASTE_STEP]].map(String).sort()], 'the steps: where it was asked first, then the four squares beside it (nearest first)');
eq(new Set(offs.map(String)).size, offs.length, 'no step repeats');
const one = (y0, floorAt) => ([ox, oz]) => [{ kind: 'token', x: 27 + ox, z: 85 + oz, y: floorAt(27 + ox, 85 + oz), y0 }];
const vaultFloor = (x, z) => (x >= 15 && x < 35 && z >= 80 && z < 95 ? -20 : 0); // out of the vault is the rock under the ground
const pawns = [];
const free = (s) => !pawns.some(p => Math.abs(p.x - s.x) < 0.5 && Math.abs(p.z - s.z) < 0.5 && Math.abs(p.y - s.y) < 2);
eq(pasteStep(one(-20, vaultFloor), free), [0, 0], 'nothing in the way: exactly at the pointer');
pawns.push({ x: 27, z: 85, y: -20 }); // (the same spot: the first paste)
eq(pasteStep(one(-20, vaultFloor), () => false), [0, 0], 'nowhere free at all: at the pointer (never lost)');
const a = pasteStep(one(-20, vaultFloor), free); pawns.push({ x: 27 + a[0], z: 85 + a[1], y: -20 });
const b = pasteStep(one(-20, vaultFloor), free); pawns.push({ x: 27 + b[0], z: 85 + b[1], y: -20 });
ok(a.join() !== '0,0' && b.join() !== '0,0' && a.join() !== b.join(), 'a second and third paste at the same pointer each take a square of their own', [a, b]);
const edge = (x, z) => (x < 30 ? -20 : 0); // the vault ends 3 ft to the east of the pointer
const pawns2 = [{ x: 27, z: 85, y: -20 }], free2 = (s) => !pawns2.some(p => Math.abs(p.x - s.x) < 0.5 && Math.abs(p.z - s.z) < 0.5);
const c = pasteStep(one(-20, edge), free2);
ok(c[0] <= 0 && c.join() !== '0,0', 'a step never leaves the floor it was pasted onto (east would be out of the vault, into the rock)', c);
const inRoom = ([ox, oz]) => [{ kind: 'token', x: 37 + ox, z: 25 + oz, y: 0, y0: 0, room: 37 + ox < 40 ? 'room_hall' : null, room0: 'room_hall' }]; // (a hall's east wall 3 ft away; the ground outside is at the same height)
const d = pasteStep(inRoom, (s) => !(s.x === 37 && s.z === 25));
ok(d.join() !== '0,0' && d[0] <= 0, 'nor out through a wall onto open ground at the same height (it stays in the room)', d);
const objFree = (s) => !(s.kind === 'object' && s.x === 30 && s.z === 82.5);
eq(pasteStep(([ox, oz]) => [{ kind: 'token', x: 30 + ox, z: 82.5 + oz, y: -20, y0: -20 }], objFree), [0, 0], 'a pawn may stand where a thing of another kind is (only the same kind stacks)');

// ---- 5. core: a pawn sent at the pointer's floor is in the vault; at 0 it was in the forge, above the cut ----
const B = applyArea(A, 'token.create', { id: 'tok_paste00001', name: 'Mimic', x: 27, z: 85, y: pasteY(clip.items[0], -20), color: '#e0b04a', fig: 'foe-mimic', hidden: true });
eq([B.entities.tok_paste00001.y, HT.roomAtHeight(B.entities, 27, 85, B.entities.tok_paste00001.y)?.id, B.entities.tok_paste00001.hidden], [-20, 'room_vault0001', true], 'the paste is in the vault, at -20, hidden like its original');
const cutLv2 = -20 + HT.STOREY - HT.SLAB; // the view cut at lv -2 (cut.js levelCut)
ok(!HT.cutHidesBase(B.entities, HT.baseUnder(B.entities, 27, 85, -20), cutLv2, -20), 'the cut at lv -2 shows it');
const OLD = applyArea(A, 'token.create', { id: 'tok_paste00002', name: 'Mimic', x: 27, z: 85, color: '#e0b04a', fig: 'foe-mimic' }); // (what the old paste sent)
eq([OLD.entities.tok_paste00002.y || 0, HT.roomAtHeight(OLD.entities, 27, 85, 0)?.id], [0, 'room_forge0001'], 'the old paste (no y) went into the forge above');
ok(HT.cutHidesBase(OLD.entities, HT.baseUnder(OLD.entities, 27, 85, 0), cutLv2, 0), 'which the cut at lv -2 hides: "I\'m not seeing the mimic go in"');

console.log(`paste: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
