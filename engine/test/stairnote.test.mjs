// DISMISSING A STAIR'S WARNING (Harry 2026-11-02: "they are fine as *warnings*... but how do I get rid of them?" "Yeah, we
// need a dismiss button on these."; docs/UI.md "A stair's warning", core/stairs.js "THE NOTE OVER A STAIR").
//   node engine/test/stairnote.test.mjs
// 1. the command: object.set noteOff=CODE dismisses, noteOff='' brings it back; what it refuses
// 2. a real relay: a GM may, a player may not, an agent as its scope says; undo and redo; kept through a restart
// 3. tied to the problem: a different fault shows, the same code back again stays dismissed
// 4. an older page: the entry it receives is one it can apply; a saved campaign without the field is unchanged
// 5. a campaign file keeps it (validated), a shared build never carries it, a copy of a stair shows its own warning
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startRelay } from '../relay/server.js';
import { applyArea, inverseOf, parseArgs, REGISTRY } from '../core/commands.js';
import { newArea } from '../core/state.js';
import { clipFrom } from '../client/clipboard.js';
import * as S from '../core/stairs.js';
import * as SH from '../core/share.js';

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, typeof d === 'string' ? d : JSON.stringify(d)); } else if (process.env.V) console.log('ok', m); };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
const made = []; process.on('exit', () => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-stairnote-')); made.push(dataDir);
let relay = await startRelay({ port: 0, dataDir, log: () => {} });
const rg = relay.roomgen, base = () => `http://127.0.0.1:${relay.port}`;
const EMPTY = { hash: 't', summary: 't', objects: [] }, B = 'bld_sn00000001';
const room = (A, id, x, z, w, d, y = 0, type = 'common') => applyArea(A, 'room.spawn', { id, type, x, z, w, d, ...(y && { y }), seed: 1, building: B, buildingName: 'Inn', layout: EMPTY });
const piece = (cat, sku) => { const Z = rg.sizeOf(cat, sku); return { name: cat, cat, sku: Z.sku, url: Z.url, place: Z.place, layer: 'furnish', yaw: Z.yaw, s: Z.s, dims: Z.dims }; };
const FLIGHT = piece('stair-straight', 'stair-straight--rough-timber--t10');
const LOW = 'room_snlow0001', UP = 'room_snup00001', ST = 'obj_sn00000001', CRATE = 'obj_sn00000002';
const stairArgs = { id: ST, ...FLIGHT, x: 15, y: 0, z: 12.5, rot: -Math.PI / 2, room: LOW };
const crateArgs = { id: CRATE, ...piece('barrel'), x: 5, y: 0, z: 5, rot: 0, room: LOW };
const chk = (A, a) => REGISTRY['object.set'].check({ area: A }, parseArgs('object.set', a).args);
const set = (A, a) => applyArea(A, 'object.set', parseArgs('object.set', a).args);
const note = (A, id = ST) => { const W = S.stairWarning(A.entities, A.entities[id]); return W && { code: W.code, off: W.off }; };

// ---- 1. the command -----------------------------------------------------------------------------------------------
{
  let A = newArea('area_stnote001', 's'); A = room(A, LOW, 0, 0, 6, 4); A = applyArea(A, 'object.place', stairArgs); A = applyArea(A, 'object.place', crateArgs);
  eq(note(A), { code: 'open', off: false }, 'a stair with nothing built over it warns: "open"');
  eq(chk(A, { id: ST, noteOff: 'open' }), null, 'dismissing the warning it shows is allowed');
  ok(/not showing that warning/.test(chk(A, { id: ST, noteOff: 'no-exit' }) || ''), 'a code it is not showing is refused');
  ok(/not showing that warning/.test(chk(A, { id: ST, noteOff: 'nonsense' }) || ''), 'and so is a word that is no code at all');
  ok(/not a stair/.test(chk(A, { id: CRATE, noteOff: 'open' }) || ''), 'a barrel has no warning to dismiss');
  ok(/no dismissed warning/.test(chk(A, { id: ST, noteOff: '' }) || ''), 'there is nothing to bring back yet');
  const D = set(A, { id: ST, noteOff: 'open' });
  eq(D.entities[ST].noteOff, 'open', 'the dismissal is stored on the stair, as the code');
  eq(note(D), { code: 'open', off: true }, 'the stair still has the fault; its warning is dismissed');
  ok(S.stairWarnings(D.entities).filter(w => !w.off).length === 0, 'so no note is drawn (world.js draws the warnings that are not off)');
  eq(S.stairStatus(D.entities, D.entities[ST]).code, 'open', 'stairStatus does not change: pawns and the API still get the truth');
  ok(S.stairInfo(D.entities, D.entities[ST]).dismissed === true && S.stairInfo(D.entities, D.entities[ST]).problem === 'open', 'what a seat is told: the problem, and that it was dismissed');
  ok(!('dismissed' in S.stairInfo(A.entities, A.entities[ST])), 'not dismissed: not said');
  ok(/already dismissed/.test(chk(D, { id: ST, noteOff: 'open' }) || ''), 'dismissing it twice is refused (a double tap leaves one undo step)');
  const un = inverseOf(A, 'object.set', { id: ST, noteOff: 'open' }), U = applyArea(D, un.type, un.args);
  eq(U.entities[ST], A.entities[ST], 'undo: the stair exactly as it was');
  eq(chk(D, { id: ST, noteOff: '' }), null, "noteOff='' brings it back");
  const R = set(D, { id: ST, noteOff: '' });
  ok(!('noteOff' in R.entities[ST]) && note(R).off === false, 'and leaves no field behind');
  const L = applyArea(A, 'entity.flag', { ids: [ST], locked: true });
  eq(chk(L, { id: ST, noteOff: 'open' }), null, 'a locked stair can still have its warning dismissed: nothing about the stair changes');
  ok(/is locked/.test(chk(L, { id: ST, name: 'x', noteOff: 'open' }) || ''), 'but noteOff is no way round the lock for anything else');
  ok(/is locked/.test(chk(L, { id: ST, name: 'x' }) || ''), 'and a plain rename of a locked stair is refused as before');
  const Dress = applyArea(A, 'object.place', { ...stairArgs, id: 'obj_sn00000003', z: 7.5, rule: 'stair-up' });
  ok(!S.stairWarnings(Dress.entities).some(w => w.s.id === 'obj_sn00000003' && w.code === 'open'), "a stair the layout rolled, nothing over it: furniture, no warning");
  ok(REGISTRY['object.place'].args.noteOff, 'object.place takes the field too (a campaign file comes in through it)');
  const Pl = applyArea(A, 'object.place', { ...stairArgs, id: 'obj_sn00000004', z: 2.5, noteOff: 'x'.repeat(40) }), Pb = applyArea(A, 'object.place', { ...crateArgs, id: 'obj_sn00000005', noteOff: 'open' });
  ok(!('noteOff' in Pl.entities.obj_sn00000004), 'object.place drops a value that is no code');
  ok(!('noteOff' in Pb.entities.obj_sn00000005), 'and the field on anything that is not a stair');
}

// ---- 2. a real relay --------------------------------------------------------------------------------------------
const c0 = await (await fetch(base() + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'TEST stairnote (throwaway)', gm: 'Harry' }) })).json();
let rt = relay.campaigns.get(c0.campaign); const gm = c0.seat, area = rt.state.areaOrder[0];
const send = (by, type, args) => rt.dispatch(by, { type, area, args }, {});
const must = (by, type, args) => { const r = send(by, type, args); if (!r.ok) throw new Error(`${type}: ${r.why}`); return r; };
const stair = () => rt.state.areas[area].entities[ST];
const Ents = () => rt.state.areas[area].entities;
must(gm, 'room.spawn', { id: LOW, type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 1, layout: EMPTY, building: B, buildingName: 'Inn' });
must(gm, 'object.place', stairArgs);
must(gm, 'seat.create', { id: 'seat_pip0000001', kind: 'human', role: 'player', name: 'Pip', color: '#6fc36f' });
const pip = 'seat_pip0000001';
must(gm, 'seat.create', { id: 'seat_aiobj00001', kind: 'llm', name: 'Builder', scope: { areas: '*', classes: ['object'] } });
must(gm, 'seat.create', { id: 'seat_aichat0001', kind: 'llm', name: 'Talker', scope: { areas: '*', classes: ['chat'] } });
must(pip, 'seat.create', { id: 'seat_aipip00001', kind: 'llm', name: 'Pipbot', scope: { areas: '*', classes: ['chat'] } });
{
  const r = send(pip, 'object.set', { id: ST, noteOff: 'open' });
  ok(!r.ok && /players cannot/.test(r.why || ''), 'the relay refuses a player', r);
  ok(!stair().noteOff, 'and nothing changed');
  ok(!send('seat_aichat0001', 'object.set', { id: ST, noteOff: 'open' }).ok, "an AI seat without the class 'object' is refused");
  ok(!send('seat_aipip00001', 'object.set', { id: ST, noteOff: 'open' }).ok, "a player's AI seat is refused");
  ok(send('seat_aiobj00001', 'object.set', { id: ST, noteOff: 'open' }).ok && stair().noteOff === 'open', "an AI seat with the class 'object' may, as for object.set in general");
  must(gm, 'undo', { who: 'seat_aiobj00001' }); ok(!stair().noteOff, "the GM can undo an AI seat's dismissal");
  must(gm, 'object.set', { id: ST, noteOff: 'open' });
  ok(stair().noteOff === 'open', 'a GM dismisses it');
  ok(/already dismissed/.test(send(gm, 'object.set', { id: ST, noteOff: 'open' }).why || ''), 'a second dismissal is refused by the relay');
  must(gm, 'undo', {}); ok(!stair().noteOff, 'undo brings the warning back');
  must(gm, 'redo', {}); ok(stair().noteOff === 'open', 'redo dismisses it again');
  ok(!send(pip, 'object.set', { id: ST, noteOff: '' }).ok && stair().noteOff === 'open', 'a player cannot bring it back either');
  // it survives the relay stopping and starting (journal + snapshot): the store is the world, not a browser
  const port = relay.port; await relay.close(); relay = await startRelay({ port, dataDir, log: () => {} });
  rt = relay.campaigns.get(c0.campaign) || relay.campaigns.load?.(c0.campaign);
  ok(stair()?.noteOff === 'open', 'kept through a relay restart');
  eq(S.stairWarning(Ents(), stair()).off, true, 'and still reads as dismissed');
}

// ---- 3. tied to the problem ---------------------------------------------------------------------------------------
{
  let A = newArea('area_stnote002', 's'); A = room(A, LOW, 0, 0, 6, 4); A = applyArea(A, 'object.place', stairArgs);
  A = set(A, { id: ST, noteOff: 'open' });
  // a room over it whose floor gives no step-off at its top (the stair's exit is outside the room above): another fault
  const walled = room(A, UP, 0, 0, 3, 4, 10, 'guest');
  const W2 = note(walled);
  ok(W2 && W2.code !== 'open' && W2.off === false, 'the fault changes: the new warning shows, the dismissal does not cover it', W2);
  ok(S.stairWarnings(walled.entities).some(w => !w.off), 'so a note is drawn for it');
  const fixed = room(A, UP, 0, 0, 6, 4, 10, 'guest');
  eq(note(fixed), null, 'the fault is fixed: no warning at all');
  eq(fixed.entities[ST].noteOff, 'open', 'the stored code stays (nothing clears it: the simpler rule, core/stairs.js)');
  const back = applyArea(fixed, 'room.delete', { id: UP });
  eq(note(back), { code: 'open', off: true }, 'the same fault back again stays dismissed');
  const flip = applyArea(A, 'stair.flip', { id: ST, ...S.stairFlip(A.entities[ST], 0) });
  ok(note(flip)?.code === 'nothing-below' && note(flip).off === false, 'switched to stairs down: "Nothing below" is another fault, and it shows');
  const moved = applyArea(A, 'object.move', { id: ST, x: 15, z: 12.5, y: 40 });
  ok(note(moved)?.code === 'nothing-below' && note(moved).off === false, 'lifted off its floor: "Nothing below" shows', note(moved));
  const twice = set(walled, { id: ST, noteOff: W2.code });
  eq(twice.entities[ST].noteOff, W2.code, 'dismissing the new fault replaces the stored code (one code, not a list)');
  const opened = applyArea(twice, 'room.delete', { id: UP });
  eq(note(opened), { code: 'open', off: false }, 'so the first fault, come back after that, shows again');
}

// ---- 4. an older page, an older save ------------------------------------------------------------------------------
{
  // a page from before this has no reducer for a new command type (applyArea would throw on it), but it has object.set:
  // this is its reducer as it was, the arguments' `...rest` on the entity
  ok(REGISTRY['object.set'] && !REGISTRY['stair.note'], 'no new command type: an open tab from before the deploy can apply what it is sent');
  const old = (t, a) => { const { id, tiltZ, quat, lightRadius, ...rest } = a; return { ...t, entities: { ...t.entities, [id]: { ...t.entities[id], ...rest } } }; };
  let A = newArea('area_stnote003', 's'); A = room(A, LOW, 0, 0, 6, 4); A = applyArea(A, 'object.place', stairArgs);
  const O = old(A, { id: ST, noteOff: 'open' });
  eq(S.stairStatus(O.entities, O.entities[ST]).code, 'open', "an old page's copy of the stair is whole, with one field it does not read");
  const O2 = old(O, { id: ST, noteOff: '' });
  eq(note(O2), { code: 'open', off: false }, "a '' left on an old page's copy means: not dismissed");
  // a save from before: no field. Nothing to convert, the warning shows
  let Plain = newArea('area_stnote004', 's'); Plain = room(Plain, LOW, 0, 0, 6, 4); Plain = applyArea(Plain, 'object.place', stairArgs);
  ok(!('noteOff' in Plain.entities[ST]), 'a stair that was never dismissed has no field, so saves do not change');
  eq(note(Plain), { code: 'open', off: false }, 'and warns as it always did');
  for (const junk of [0, 1, true, {}, [], 'no such code', null]) { const J = { ...Plain, entities: { ...Plain.entities, [ST]: { ...Plain.entities[ST], noteOff: junk } } }; ok(note(J).off === false, `junk in the field (${JSON.stringify(junk)}): the note shows, nothing throws`); }
}

// ---- 5. export and import ---------------------------------------------------------------------------------------
{
  const ents = Ents(), file = { v: 1, kind: 'turnip-works-campaign', name: 'x', areas: [{ name: 'Inn', visibility: 'open', settings: {}, entities: ents }] };
  const J = JSON.parse(JSON.stringify(file));
  const stairOf = (doc) => doc.objects.find(o => o.cat === 'stair-straight');
  const { docs, reads, error } = SH.campaignAreas(J);
  ok(!error && docs.length === 1 && reads[0].left.pieces === 0 && reads[0].left.details === 0, 'a campaign file with a dismissal reads clean', { error, r: reads[0]?.left });
  eq(stairOf(docs[0]).noteOff, 'open', 'and its stair keeps the dismissal');
  const c1 = await (await fetch(base() + '/campaigns', { method: 'POST', body: JSON.stringify({ name: 'TEST stairnote import (throwaway)', gm: 'Harry' }) })).json();
  const rt1 = relay.campaigns.get(c1.campaign), a1 = rt1.state.areaOrder[0];
  const target = { area: rt1.state.areas[a1], resolve: (c, s) => rg.sizeOf(c, s), roomTypes: rg.types, fallbackType: 'common', engineVersion: rg.version, keepPlace: true };
  const plan = SH.planImport(docs[0], target);
  ok(plan.ok, 'the plan is accepted', plan.why);
  const res = rt1.dispatch(c1.seat, { type: 'batch', area: a1, args: { ops: plan.ops } }, {}); ok(res.ok, 'the import goes through the real relay', res.why);
  const E1 = rt1.state.areas[a1].entities, s1 = S.stairsOf(E1)[0];
  ok(s1 && s1.noteOff === 'open' && s1.id !== ST, 'after a round trip the stair is there, under a new id, still dismissed', s1);
  eq(S.stairWarning(E1, s1)?.off, true, 'and no note is drawn for it');

  // untrusted: what a file says is checked
  const hostile = (v) => { const K = JSON.parse(JSON.stringify(file)); K.areas[0].entities[ST].noteOff = v; return SH.campaignAreas(K); };
  for (const v of ['nonsense', 'x'.repeat(5000), 7, { a: 1 }, ['open'], true]) {
    const r = hostile(v);
    ok(!r.error && r.docs.length === 1 && stairOf(r.docs[0]) && !('noteOff' in stairOf(r.docs[0])), `a bad value (${JSON.stringify(v).slice(0, 20)}): the stair comes in, without it`, r.error || r.reads?.[0]?.left);
    ok(r.reads[0].left.pieces === 0, 'and costs no piece', r.reads[0].left);
  }
  const old = JSON.parse(JSON.stringify(file)); delete old.areas[0].entities[ST].noteOff;
  const rOld = SH.campaignAreas(old);
  ok(!rOld.error && !('noteOff' in stairOf(rOld.docs[0])), 'a file from before has no field, and reads as before');

  // a shared build: the warning is said afresh where it lands, and an older page can read the file
  const shared = SH.exportShare(ents, { kind: 'area', area: { name: 'Inn' } }).doc;
  ok(stairOf(shared) && !('noteOff' in stairOf(shared)), 'a shared build never carries the dismissal');
  const parsed = SH.parseShare(JSON.stringify(shared));
  ok(!parsed.error && parsed.left.pieces === 0, 'and reads clean');
  const made2 = JSON.parse(JSON.stringify(shared)); stairOf(made2).noteOff = 'bad'; const pb = SH.parseShare(JSON.stringify(made2));
  ok(!pb.error && stairOf(pb.doc) && !('noteOff' in stairOf(pb.doc)) && pb.left.details > 0, 'a share file with a bad value: the stair comes in without it, and the list says so', pb.left);

  // copy and paste: a copy is a new stair, and says what it says
  const app = { childrenOf: () => [], descendants: () => [], entities: () => ents };
  const clip = clipFrom(app, [ents[LOW]]), so = clip.items[0].objects.find(o => o.id === ST);
  ok(so && !('noteOff' in so), "a room's copy does not carry its stair's dismissal");
  await relay.close();
}

console.log(`stairnote: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
