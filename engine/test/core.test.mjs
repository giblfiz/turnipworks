// Unit tests for the shared core: reducers, inverses, permissions, visibility, projections, layout hashing.
//   node engine/test/core.test.mjs
import { REGISTRY, applyArea, inverseOf, checkCommand, parseArgs, edgeId, EDGE_KEY_RE, prepareRoomHiding, roomPlayerPawns, HIDE_ROOM_HIDES_PLAYER_PAWNS } from '../core/commands.js';
import { newCampaign, newArea, projectCampaign, areaForClient, areaRules } from '../core/state.js';
import { can, canSee, liveSeat, scopeWithin } from '../core/perms.js';
import { layoutHash, stableStringify } from '../core/hash.js';
import { loadRoomgen } from '../relay/server.js';
import * as FP from '../core/footprint.js';
import { readFileSync } from 'node:fs';
const factionLibrary = JSON.parse(readFileSync(new URL('../tuner-data/library.json', import.meta.url)));
const factionOf = o => factionLibrary.objects[o.cat]?.skus.find(s => s.sku === o.sku)?.shape;

let checks = 0, fails = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);

// --- a campaign built with the real campaign reducers (the same path the relay uses) ---
let S = newCampaign('cmp_test0001', 'Test');
const camp = (type, args, by = null) => { S = REGISTRY[type].apply(S, args, { by }); };
camp('area.create', { id: 'tbl_main0001', name: 'Inn', visibility: 'open' });
camp('area.create', { id: 'tbl_secr0001', name: 'GM prep', visibility: 'gm' });
camp('area.create', { id: 'tbl_party001', name: 'Rogue sneaks', visibility: 'party' });
camp('seat.create', { id: 'seat_gm000001', kind: 'human', role: 'gm', name: 'Harry', location: 'tbl_main0001' });
camp('seat.create', { id: 'seat_pl000001', kind: 'human', role: 'player', name: 'Brakka', location: 'tbl_main0001' }, 'seat_gm000001');
camp('seat.create', { id: 'seat_pl000002', kind: 'human', role: 'player', name: 'Rogue', location: 'tbl_party001' }, 'seat_gm000001');
const GM = 'seat_gm000001', P1 = 'seat_pl000001', P2 = 'seat_pl000002';
const setArea = (id, t) => { S = { ...S, areas: { ...S.areas, [id]: t } }; };
const tbl = (id) => S.areas[id];
const run = (by, type, area, args) => {
  const err = checkCommand({ state: S, by }, { type, area, args });
  if (!err) { if (REGISTRY[type].level === 'area') setArea(area, { ...applyArea(tbl(area), type, args), seq: tbl(area).seq + 1 }); else camp(type, args, by); }
  return err;
};

// --- reducers are pure; inverse restores ---
{
  const t0 = tbl('tbl_main0001');
  const t1 = applyArea(t0, 'token.create', { id: 'tok_aaaa0001', name: 'Brakka', x: 5, z: 5, owner: P1 });
  ok(!t0.entities.tok_aaaa0001 && t1.entities.tok_aaaa0001, 'create is pure');
  const inv = inverseOf(t1, 'token.move', { id: 'tok_aaaa0001', x: 20, z: 30 });
  const t2 = applyArea(t1, 'token.move', { id: 'tok_aaaa0001', x: 20, z: 30 });
  eq([t2.entities.tok_aaaa0001.x, t1.entities.tok_aaaa0001.x], [20, 5], 'move is pure');
  const t3 = applyArea(t2, inv.type, inv.args);
  eq(t3.entities.tok_aaaa0001, t1.entities.tok_aaaa0001, 'inverse of move restores');
  const invC = inverseOf(t0, 'token.create', { id: 'tok_aaaa0001' });
  ok(!applyArea(t1, invC.type, invC.args).entities.tok_aaaa0001, 'inverse of create removes');
}

// --- humans: GM vs player ---
ok(!run(GM, 'token.create', 'tbl_main0001', { id: 'tok_brak0001', name: 'Brakka', x: 10, z: 10, owner: P1 }), 'GM creates token');
ok(!run(GM, 'token.create', 'tbl_main0001', { id: 'tok_npc00001', name: 'Innkeeper', x: 20, z: 10 }), 'GM creates NPC');
ok(!run(P1, 'token.move', 'tbl_main0001', { id: 'tok_brak0001', x: 15, z: 10 }), 'player moves own token');
eq(run(P1, 'token.move', 'tbl_main0001', { id: 'tok_npc00001', x: 0, z: 0 })?.code, 'invalid', 'player may not move NPC');
eq(run(P1, 'room.spawn', 'tbl_main0001', { id: 'room_aaaa0001', type: 'common', x: 0, z: 0, w: 4, d: 4, seed: 1 })?.code, 'forbidden', 'player may not spawn rooms');
ok(!checkCommand({ state: S, by: P1 }, { type: 'undo', area: 'tbl_main0001', args: {} }), 'players may undo (their own; the relay enforces own-only)');
eq(run(P1, 'area.visibility', null, { area: 'tbl_main0001', visibility: 'gm' })?.code, 'forbidden', 'player may not set visibility');
eq(run(P1, 'token.move', 'tbl_secr0001', { id: 'tok_x0000001', x: 0, z: 0 })?.code, 'invisible', 'GM-only area answers invisible, not forbidden');
ok(!run(GM, 'room.spawn', 'tbl_main0001', { id: 'room_aaaa0001', type: 'common', x: 0, z: 0, w: 4, d: 4, seed: 1 }), 'GM spawns room');
ok(/overlaps/.test(run(GM, 'room.spawn', 'tbl_main0001', { id: 'room_aaaa0002', type: 'common', x: 2, z: 2, w: 4, d: 4, seed: 1 })?.why), 'overlapping room refused');
ok(/already exists/.test(run(GM, 'token.create', 'tbl_main0001', { id: 'tok_brak0001', name: 'dup', x: 0, z: 0 })?.why), 'duplicate id refused');

// --- visibility: an area is open or hidden, nothing else (2026-10-06). 'party' and 'gm' are stored values from before: both read as hidden ---
ok(canSee(S, P1, 'tbl_main0001') && !canSee(S, P1, 'tbl_secr0001') && !canSee(S, P1, 'tbl_party001'), 'P1 sees open only');
ok(!canSee(S, P2, 'tbl_party001'), "a stored 'party' area reads as hidden: not even the seat located in it sees it");
ok(canSee(S, GM, 'tbl_secr0001') && canSee(S, GM, 'tbl_party001'), 'GM sees all');
ok(!run(GM, 'token.create', 'tbl_party001', { id: 'tok_brk20001', name: 'Brakka (scouting)', x: 0, z: 0, owner: P1 }), 'GM puts a P1 token on the party area');
ok(!canSee(S, P1, 'tbl_party001'), 'owning a pawn in a hidden area does not show the area');
{
  const v = projectCampaign(S, P1);
  ok(!v.areas.some(t => t.id === 'tbl_secr0001'), 'projection hides GM-only area');
  const rogue = v.seats.find(s => s.id === P2);
  ok(rogue.location === null && rogue.elsewhere === false && !JSON.stringify(v).includes('tbl_party001'), 'a seat in a hidden area has no location for a player: no id, not even "elsewhere"');
}

// --- LLM seats: subset of creator, scoped, cascade ---
S = REGISTRY['seat.create'].apply(S, { id: 'seat_llmgm001', kind: 'llm', name: 'Assistant', scope: { areas: ['tbl_main0001'], classes: ['token.move', 'object'] } }, { by: GM });
const AG = 'seat_llmgm001';
ok(S.seats[AG].creator === GM && S.seats[AG].role === 'gm', 'agent records creator and inherits role');
ok(can(S, AG, 'token.move', 'tbl_main0001').ok, 'GM agent moves tokens in scope');
ok(!can(S, AG, 'room', 'tbl_main0001').ok, 'GM agent: class outside scope refused');
ok(!can(S, AG, 'token.move', 'tbl_secr0001').ok && !canSee(S, AG, 'tbl_secr0001'), 'GM agent: area outside scope neither usable nor visible');
ok(!run(AG, 'token.move', 'tbl_main0001', { id: 'tok_npc00001', x: 3, z: 3 }), 'GM agent moves NPC');
ok(!can(S, AG, 'seat.agent').ok, 'agents never mint agents');

ok(scopeWithin(S, P1, { areas: '*', classes: ['token.move'] }).ok, 'player may grant token.move');
ok(!scopeWithin(S, P1, { areas: '*', classes: ['room'] }).ok, 'player may NOT grant room (more than creator)');
ok(!scopeWithin(S, P1, { areas: '*', classes: '*' }).ok, 'player may NOT grant everything');
ok(run(P1, 'seat.create', null, { id: 'seat_llmp1001', kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: ['room'] } })?.code === 'invalid', 'player agent with too-wide scope refused at creation');
ok(!run(P1, 'seat.create', null, { id: 'seat_llmp1001', kind: 'llm', name: 'Advisor', scope: { areas: '*', classes: ['token.move'] } }), 'player creates advisor');
const PA = 'seat_llmp1001';
ok(S.seats[PA].creator === P1 && S.seats[PA].role === 'player', 'advisor acts as the player');
ok(!run(PA, 'token.move', 'tbl_main0001', { id: 'tok_brak0001', x: 25, z: 25 }), "advisor moves the player's token");
eq(run(PA, 'token.move', 'tbl_main0001', { id: 'tok_npc00001', x: 0, z: 0 })?.code, 'invalid', "advisor may not move others' tokens");
eq(run(PA, 'room.spawn', 'tbl_main0001', { id: 'room_bbbb0001', type: 'kitchen', x: 10, z: 0, w: 3, d: 3, seed: 2 })?.code, 'forbidden', 'advisor refused a GM-only command');
eq(run(PA, 'token.move', 'tbl_secr0001', { id: 'tok_npc00001', x: 0, z: 0 })?.code, 'invisible', 'advisor cannot see GM-only area');
ok(!canSee(S, PA, 'tbl_secr0001'), 'advisor visibility = player visibility');
ok(canSee(S, PA, 'tbl_party001') === canSee(S, P1, 'tbl_party001'), 'advisor sees party area exactly when the player does');

// revocation cascade
ok(!run(GM, 'seat.revoke', null, { who: P1 }), 'GM revokes the player');
ok(!liveSeat(S, P1) && !liveSeat(S, PA), 'revoking the player kills the advisor');
eq(run(PA, 'token.move', 'tbl_main0001', { id: 'tok_brak0001', x: 1, z: 1 })?.code, 'forbidden', 'revoked advisor refused');
ok(S.seats[PA].revoked, 'cascade is recorded on the child too');
ok(!projectCampaign(S, PA), 'revoked seat gets no view');
ok(run(GM, 'seat.revoke', null, { who: GM })?.why === 'cannot revoke yourself', 'no self-revoke');

// transfer
ok(!REGISTRY.transfer.check({ state: S }, { id: 'tok_npc00001', from: 'tbl_main0001', to: 'tbl_secr0001' }), 'transfer valid');
ok(/rooms do not travel/.test(REGISTRY.transfer.check({ state: S }, { id: 'room_aaaa0001', from: 'tbl_main0001', to: 'tbl_secr0001' })), 'rooms do not travel');

// --- args from GET query strings ---
eq(parseArgs('token.move', { id: 'tok_brak0001', x: '12.5', z: '-3' }, { fromQuery: true }).args, { id: 'tok_brak0001', x: 12.5, z: -3 }, 'query coercion');
ok(/x: not a number/.test(parseArgs('token.move', { id: 'tok_brak0001', x: 'abc', z: '1' }, { fromQuery: true }).error), 'bad number refused');
ok(/missing id/.test(parseArgs('token.move', { x: 1, z: 1 }).error), 'missing arg refused');

// --- layout hash and the room engine ---
{
  const a = [{ id: 'chair', sku: 'chair--s1', x: 1.0001, y: 0, z: 2, rot: 0.5, dims: [1, 2, 1] }];
  ok(layoutHash(a) === layoutHash([{ ...a[0], x: 1.0002 }]), 'hash ignores sub-thou drift');
  ok(layoutHash(a) !== layoutHash([{ ...a[0], x: 1.1 }]), 'hash sees real moves');
  const rg = await loadRoomgen(new URL('../tuner', import.meta.url).pathname, new URL('../tuner-data', import.meta.url).pathname);
  const t = newArea('tbl_rg000001', 'rg');
  const L1 = rg.solve(t.entities, { id: 'room_rg000001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 42 }, 1);
  const L2 = rg.solve(t.entities, { id: 'room_rg000001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 42 }, 1);
  ok(L1.objects.length > 10 && L1.hash === L2.hash, `room engine deterministic (${L1.objects.length} objects, ${L1.hash})`);
  ok(L1.objects.every(o => /^obj_/.test(o.id)) && new Set(L1.objects.map(o => o.id)).size === L1.objects.length, 'layout objects get fresh ids');
  ok(L1.objects.some(o => o.parent && L1.objects.some(p => p.id === o.parent)), 'surface items point at their parent object');
  let t2 = applyArea(t, 'room.spawn', { id: 'room_rg000001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 42, layout: L1 });
  ok(Object.values(t2.entities).filter(e => e.kind === 'object' && e.room === 'room_rg000001').length === L1.objects.length, 'room.spawn creates the furniture as object entities');
  const L3 = rg.solve(t2.entities, { id: 'room_rg000002', type: 'kitchen', x: 6, z: 0, w: 4, d: 4, seed: 7 }, 2);
  ok(L3.objects.length > 5, 'adjacent room solves against the first');
  t2 = applyArea(t2, 'room.spawn', { id: 'room_rg000002', type: 'kitchen', x: 6, z: 0, w: 4, d: 4, seed: 7, layout: L3 });
  const E = rg.edges(t2.entities);
  ok([...E.edges.values()].some(e => e.sides.length === 2 && e.kind === 'door'), 'shared wall gets a connecting door');
  { // outdoors (2026-10-05): a yard is a room type like any other to the engine: it spawns, builds no walls of its own, and the inn's door opens onto it
    ok(rg.types.has('yard') && rg.typeList.some(x => x.key === 'yard' && x.label === 'Yard'), 'the room engine knows the Yard');
    const LY = rg.solve(t2.entities, { id: 'room_rg00yard', type: 'yard', x: 0, z: 4, w: 8, d: 5, seed: 11 }, 3);
    const ty = applyArea(t2, 'room.spawn', { id: 'room_rg00yard', type: 'yard', x: 0, z: 4, w: 8, d: 5, seed: 11, layout: LY });
    const EY = rg.edges(ty.entities), yardSided = [...EY.edges.values()].filter(e => e.sides.some(x => x.room === 'room_rg00yard'));
    ok(LY.objects.length >= 6 && LY.hash === rg.solve(t2.entities, { id: 'room_rg00yard', type: 'yard', x: 0, z: 4, w: 8, d: 5, seed: 11 }, 3).hash, `a yard solves, deterministically (${LY.objects.length} objects)`);
    ok(yardSided.length === 0 && EY.open.get('room_rg00yard').length > 0 && [...EY.edges.values()].some(e => e.kind === 'door' && e.yard?.room === 'room_rg00yard'), 'a yard builds no walls; a neighbour\'s door opens onto it');
    ok(LY.objects.some(o => o.cat === 'sign-hanging' && o.y > 5) && LY.objects.some(o => o.rule === 'yard-focal'), 'the yard has the inn\'s sign on the wall and a focal thing');
    ok(rg.floorFor({ type: 'yard', wallSeed: 78 }).startsWith('floor-') && ['floor-grass', 'floor-earth-packed', 'floor-cobble', 'floor-gravel', 'floor-earth-bare'].includes(rg.floorFor({ type: 'yard', wallSeed: 78 })), 'a yard\'s floor is ground');
  }
  { // crypt (2026-10-05): seven room types, crypt-stone walls, no windows; a room solves, deterministically, and is lit
    for (const k of ['crypt-antechamber', 'crypt-vault', 'crypt-ossuary', 'crypt-catacomb', 'crypt-chapel', 'crypt-embalming', 'crypt-relic']) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0crypt', type: 'crypt-chapel', x: 40, z: 0, w: 4, d: 5, seed: 21 }, LC = rg.solve(t2.entities, a, 9);
    const tc = applyArea(t2, 'room.spawn', { ...a, layout: LC }), EC = rg.edges(tc.entities), mine = [...EC.edges.values()].filter(e => e.owner.room === a.id);
    ok(LC.family === 'crypt-stone' && LC.hash === rg.solve(t2.entities, a, 9).hash, `a crypt chapel solves, deterministically (${LC.objects.length} objects)`);
    ok(LC.objects.some(o => o.cat === 'altar-stone') && LC.objects.some(o => /torch|candle|lamp/.test(o.cat)), 'the chapel has its altar and a light');
    ok(!mine.some(e => e.kind === 'window') && mine.some(e => e.kind === 'door' && /^(crypt-gate-iron|door-crypt)$/.test(e.doorType)), 'crypt walls have no windows; its door is the iron gate');
    ok(rg.families.includes('crypt-stone'), 'crypt-stone is in the wall family list');
  }
  { // type:lai  monster lair (2026-10-11): ten room types in cut-rock walls (the dungeon's family), no windows; the four dens share one skeleton
    const LAI = ['lair-mouth', 'lair-passage', 'lair-warren', 'lair-beast', 'lair-spider', 'lair-larder', 'lair-pit', 'lair-hatchery', 'lair-trophy', 'lair-dragon'];
    for (const k of LAI) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0ldrag', type: 'lair-dragon', x: 200, z: 60, w: 8, d: 7, seed: 51 }, LD = rg.solve(t2.entities, a, 9);
    ok(LD.family === 'cut-rock' && LD.hash === rg.solve(t2.entities, a, 9).hash && LD.objects.some(o => o.rule === 'den-bed' && /^(treasure-hoard-heap|dun-treasure-hoard|coin-pile)$/.test(o.cat)), `a dragon's hoard solves, deterministically, the great heap for its bed (${LD.objects.length} objects)`);
    ok(LD.objects.filter(o => o.rule === 'den-hoard').length >= 4 && !LD.objects.some(o => /torch|brazier|lantern|candle/.test(o.cat)), 'the hoard rings the dragon\'s hollow; the den is dark');
    const beds = { 'lair-spider': /^(web-funnel|egg-sacs-floor|eggs-monster|web-cocoon|rite-mummified-remains|bones-pile)$/, 'lair-beast': /^(nest-giant|nest-monster|hay-pile)$/ };
    for (const [k, re] of Object.entries(beds)) { const L = rg.solve({}, { id: 'room_rg0lden0', type: k, x: 200, z: 100, w: 6, d: 6, seed: 53 }, 3);
      ok(L.objects.some(o => o.rule === 'den-bed' && re.test(o.cat)) && L.objects.some(o => o.rule === 'den-feed') && L.objects.some(o => o.rule === 'den-sign'), `${k}: the same skeleton (bed, feeding spot, signs inside the door), its own dressing`, L.objects.length); }
    const wr = rg.solve({}, { id: 'room_rg0lwarr', type: 'lair-warren', x: 200, z: 140, w: 7, d: 6, seed: 55 }, 3);
    ok(wr.objects.some(o => o.rule === 'key-seat') && wr.objects.filter(o => o.rule === 'den-bed').length >= 2 && wr.objects.some(o => /torch/.test(o.cat)), 'the warren has the chieftain\'s seat, beds and torches', wr.objects.length);
    const c = { id: 'room_rg0lpass', type: 'lair-passage', x: 200, z: 180, w: 8, d: 2, seed: 57 }, tc = applyArea(t2, 'room.spawn', { ...c, layout: rg.solve(t2.entities, c, 9) }), mine = [...rg.edges(tc.entities).edges.values()].filter(e => e.owner.room === c.id);
    ok(!mine.some(e => e.kind === 'window') && mine.filter(e => e.kind === 'door').length === 2, 'a lone cave passage has no windows and an opening at each end (the way on)', mine.filter(e => e.kind === 'door').length);
    for (const k of LAI.filter(k => k !== 'lair-mouth' && (k !== 'lair-hatchery' || rg.solve({}, { id: 'room_rg0lhatc', type: k, x: 0, z: 0, w: 5, d: 4, seed: 1 }, 1).objects.length))) { const r = { id: 'room_rg0laiilv', type: k, x: 240, z: 60, w: 6, d: 5, seed: 43, y: -10 }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 4 && Math.min(...ys) >= -10 - 1e-6 && Math.max(...ys) < 0, `${k} below ground (y = -10): ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)])); }
  }
  { // castle (2026-10-06): nine room types; castle-rough walls with arrow slits, dressed stone for hall, throne room and chapel
    for (const k of ['great-hall', 'throne-room', 'armoury', 'barracks', 'castle-kitchen', 'chapel', 'dungeon', 'gatehouse', 'courtyard']) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(rg.families.includes('castle-rough'), 'castle-rough is in the wall family list');
    const a = { id: 'room_rg0throne', type: 'throne-room', x: 60, z: 0, w: 5, d: 8, seed: 23 }, LT = rg.solve(t2.entities, a, 9);
    ok(LT.family === 'dressed-stone' && LT.hash === rg.solve(t2.entities, a, 9).hash, `a throne room solves, deterministically (${LT.objects.length} objects)`);
    const dais = LT.objects.find(o => o.cat === 'dais'), throne = LT.objects.find(o => o.cat === 'throne');
    ok(dais && throne && throne.y > 0.9 && throne.y < 1.6 && Array.isArray(dais.s) && Math.abs(dais.s[0] - dais.s[1]) > 1e-6, 'the throne stands on the dais, a low platform stretched to its own box (a step or two, not a 3-ft block)', JSON.stringify([dais?.dims, throne?.y]));
    const g = { id: 'room_rg00gate', type: 'gatehouse', x: 80, z: 0, w: 4, d: 4, seed: 5 }, tg = applyArea(t2, 'room.spawn', { ...g, layout: rg.solve(t2.entities, g, 9) });
    const gates = [...rg.edges(tg.entities).edges.values()].filter(e => e.kind === 'door' && e.owner.room === g.id);
    ok(gates.length === 2 && gates.every(e => e.span === 2) && gates.map(e => e.doorType).sort().join() === 'gate-double-timber,portcullis', 'a gatehouse standing alone has a gate at each end of its passage: the portcullis outside, the timber gate inside', JSON.stringify(gates.map(e => [e.doorType, e.span])));
    const d0 = { id: 'room_rg0dunge', type: 'dungeon', x: 100, z: 0, w: 6, d: 5, seed: 31 }, LD = rg.solve(t2.entities, d0, 9);
    ok(LD.family === 'castle-rough' && LD.objects.filter(o => o.cat === 'cell-bars').length >= 2 && LD.objects.some(o => o.cat === 'rack-torture'), 'a dungeon has barred cells and the rack', LD.objects.length);
    // levels: a room upstairs or below ground is the same room, its things lifted by the room's height (nothing assumes y = 0)
    for (const [type, w, d, y] of [['great-hall', 10, 6, 10], ['dungeon', 6, 5, -10], ['crypt-vault', 5, 4, -10], ['barracks', 7, 5, 10]]) {
      const r = { id: 'room_rg0level', type, x: 140, z: 0, w, d, seed: 41, y }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 8 && Math.min(...ys) >= y - 1e-6 && Math.max(...ys) < y + 10, `${type} at y = ${y}: ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)]));
    }
    const HR = await import('../core/height.js');
    ok(['castle-rough', 'crypt-stone', 'noble-panel', 'noble-paper', 'conservatory'].every(f => HR.ROOF_BY_FAMILY[f] === 'slate'), 'castle, crypt and mansion walls take a slate roof');
  }
  { // temple & chapel (2026-10-11): ten rooms, temple-stone walls, the flavor slots
    const TK = ['temple-nave', 'cathedral', 'cathedral-dark', 'temple-shrine', 'temple-vestry', 'temple-cloister', 'temple-scriptorium', 'temple-infirmary', 'temple-cell', 'temple-belltower'];
    for (const k of TK) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(rg.families.includes('temple-stone'), 'temple-stone is in the family list');
    const nv = { id: 'room_rg0tnave', type: 'temple-nave', x: 200, z: 0, w: 5, d: 8, seed: 23 }, LN = rg.solve({}, nv, 1), cats = (L) => L.objects.map(o => o.cat);
    ok(LN.hash === rg.solve({}, nv, 1).hash && LN.family === 'temple-stone' && cats(LN).includes('altar-stone') && cats(LN).includes('pew'), `a temple nave solves, deterministically, with its altar and pews (${LN.objects.length} objects)`);
    ok(['flavor-altarpiece', 'flavor-idol', 'flavor-banner', 'flavor-sigil'].every(s => cats(LN).includes(s)) && LN.objects.filter(o => /^flavor-/.test(o.cat)).every(o => factionOf(o) === 'sun'), 'the nave is dressed in ONE flavor, the first of its list (sun): altarpiece, idol, banner, sigil', JSON.stringify(cats(LN).filter(c => /^flavor-/.test(c))));
    const ca = { id: 'room_rg0tcath', type: 'cathedral', x: 240, z: 0, w: 8, d: 14, seed: 29 }, LC = rg.solve({}, ca, 1);
    ok(cats(LC).filter(c => c === 'pillar-round').length >= 6 && cats(LC).includes('organ-pipe') && cats(LC).includes('flavor-buttress'), `a cathedral has its columns, the organ and buttresses inside (${LC.objects.length} objects)`);
    const dk = { id: 'room_rg0tdark', type: 'cathedral-dark', x: 300, z: 0, w: 8, d: 14, seed: 29 }, LK = rg.solve({}, dk, 1);
    ok(LK.family === 'crypt-stone' && cats(LK).includes('altar-stone') && !LK.objects.some(o => ['sun', 'moon'].includes(factionOf(o))), 'the dark cathedral is the same nave in crypt-stone, and never wears a good flavor');
    const HT = await import('../core/height.js');
    ok(HT.ROOF_BY_FAMILY['temple-stone'] === 'slate', 'temple walls take a slate roof');
  }
  { // >>> types:clt  cult sanctum (2026-10-11): nine room types, black-stone walls, no windows, and the flavor slots
    for (const k of ['cult-entry', 'cult-passage', 'cult-sanctum', 'cult-summoning', 'cult-cells', 'cult-vestry', 'cult-library', 'cult-quarters', 'cult-vault']) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(rg.families.includes('black-stone') && (await import('../core/height.js')).ROOF_BY_FAMILY['black-stone'] === 'slate', 'black-stone is in the wall family list and takes a slate roof');
    const a = { id: 'room_rg0cults', type: 'cult-sanctum', x: 180, z: 0, w: 5, d: 8, seed: 27 }, LS = rg.solve(t2.entities, a, 9);
    ok(LS.family === 'black-stone' && LS.hash === rg.solve(t2.entities, a, 9).hash, `a sanctum solves, deterministically (${LS.objects.length} objects)`);
    ok(LS.objects.some(o => /^altar-/.test(o.cat)) && LS.objects.some(o => /torch|candle|brazier|censer/.test(o.cat)), 'the sanctum has its altar and a light');
    const fl = (L) => [...new Set(L.objects.filter(o => /^flavor-/.test(o.cat)).map(o => factionOf(o)))];
    ok(fl(LS).length === 1, `a sanctum's flavor pieces are all one flavor (${fl(LS)})`);
    // every religious room of ONE building takes the same flavor, and buildings differ among themselves
    const seen = new Set();
    for (let b = 0; b < 16; b++) { const B = 'bld_flv' + b, s1 = rg.solve({}, { id: 'room_rg0flv1', type: 'cult-sanctum', x: 0, z: 0, w: 5, d: 8, seed: 3, building: B }, 1), s2 = rg.solve({}, { id: 'room_rg0flv2', type: 'cult-vault', x: 0, z: 0, w: 4, d: 4, seed: 9, building: B }, 1);
      ok(fl(s1).length === 1 && fl(s2).join() === fl(s1).join(), `building ${B}: sanctum ${fl(s1)}, inner sanctum ${fl(s2)}`); seen.add(fl(s1)[0]); }
    ok(seen.size >= 2, `sixteen buildings take more than one flavor between them (${[...seen]})`);
    const e = { id: 'room_rg0cultE', type: 'cult-entry', x: 200, z: 0, w: 4, d: 3, seed: 5 }, te = applyArea(t2, 'room.spawn', { ...e, layout: rg.solve(t2.entities, e, 9) });
    const ds = [...rg.edges(te.entities).edges.values()].filter(x => x.kind === 'door' && x.owner.room === e.id).map(x => x.doorType).sort();
    ok(ds.join() === 'door-reinforced,door-secret-bookcase', 'a hidden entrance standing alone: a cellar door, and the bookcase as its way on', ds.join());
  } // <<< types:clt
  { // mansion (2026-10-06): eight state rooms, kitchen and cellar (the inn's programs), a formal garden; noble-panel, noble-paper, conservatory walls
    for (const k of ['mansion-hall', 'mansion-drawing', 'mansion-dining', 'mansion-library', 'mansion-bedroom', 'mansion-ballroom', 'mansion-conservatory', 'mansion-garden', 'mansion-kitchen', 'mansion-cellar']) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(['noble-panel', 'noble-paper', 'conservatory'].every(f => rg.families.includes(f)), 'the three mansion wall families are in the family list');
    const a = { id: 'room_rg0mhall', type: 'mansion-hall', x: 60, z: 20, w: 5, d: 6, seed: 23 }, LH = rg.solve(t2.entities, a, 9);
    ok(LH.hash === rg.solve(t2.entities, a, 9).hash && LH.objects.length >= 10, `a mansion hall solves, deterministically (${LH.objects.length} objects)`);
    const dr = { id: 'room_rg0mdine', type: 'mansion-dining', x: 80, z: 20, w: 6, d: 4, seed: 29 }, LD = rg.solve(t2.entities, dr, 9);
    ok(LD.objects.some(o => o.cat === 'table-feast' && /fine/.test(o.sku)) && LD.objects.filter(o => /^chair-/.test(o.cat)).length >= 6, 'the dining room has the mahogany table and its chairs', LD.objects.length);
    const fine = rg.solve({}, { id: 'room_rg0fine1', type: 'fine', x: 0, z: 0, w: 4, d: 4, seed: 7 }, 1);
    ok(fine.objects.length >= 8 && !fine.objects.some(o => /--state$|--fine--s[23]$/.test(o.sku || '')), 'the inn\'s Fine guest room solves (its meshes are held by the tuner\'s golden test)');
    for (const [type, w, d, y] of [['mansion-bedroom', 5, 5, 10], ['mansion-cellar', 5, 4, -10]]) {
      const r = { id: 'room_rg0mlevl', type, x: 140, z: 20, w, d, seed: 41, y }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 8 && Math.min(...ys) >= y - 1e-6 && Math.max(...ys) < y + 10, `${type} at y = ${y}: ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)]));
    }
  }
  { // type:dun  dungeon & prison (2026-10-11): fourteen room types; dressed-stone and cut-rock walls, no windows; corridors with a way on
    const DUN = ['dun-corridor', 'dun-trap-corridor', 'dun-dead-end', 'dun-cell-block', 'dun-guard-room', 'dun-interrogation', 'dun-vault', 'dun-sewer', 'dun-puzzle-hall', 'dun-chasm', 'dun-den', 'dun-shrine', 'dun-flooded', 'dun-collapsed'];
    for (const k of DUN) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(rg.families.includes('cut-rock'), 'cut-rock is in the wall family list');
    const a = { id: 'room_rg0dcell', type: 'dun-cell-block', x: 60, z: 60, w: 8, d: 6, seed: 31 }, LC = rg.solve(t2.entities, a, 9);
    ok(LC.hash === rg.solve(t2.entities, a, 9).hash && LC.objects.filter(o => o.cat === 'cell-bars').length >= 4, `a cell block solves, deterministically, with its barred cells (${LC.objects.length} objects)`);
    const c = { id: 'room_rg0dcorr', type: 'dun-corridor', x: 60, z: 80, w: 8, d: 2, seed: 33 }, tc = applyArea(t2, 'room.spawn', { ...c, layout: rg.solve(t2.entities, c, 9) }), EC = rg.edges(tc.entities), mine = [...EC.edges.values()].filter(e => e.owner.room === c.id);
    ok(!mine.some(e => e.kind === 'window') && mine.filter(e => e.kind === 'door').length === 2, 'a lone corridor has no windows and a door at each end (the way on)', mine.filter(e => e.kind === 'door').length);
    const x = { id: 'room_rg0dchsm', type: 'dun-chasm', x: 60, z: 90, w: 7, d: 4, seed: 35 }, LX = rg.solve(t2.entities, x, 9);
    ok(LX.objects.some(o => /^chasm-strip/.test(o.cat)) && LX.objects.some(o => o.cat === 'bridge-stone-natural'), 'the chasm crossing has its chasm and a bridge over it');
    const tr = rg.solve(t2.entities, { id: 'room_rg0dtrap', type: 'dun-trap-corridor', x: 60, z: 100, w: 8, d: 2, seed: 37 }, 9);
    ok(tr.objects.filter(o => /^(pressure-plate|trap-|pit-open)/.test(o.cat)).length >= 2, 'the trap corridor has traps on its line');
    for (const k of DUN) { const r = { id: 'room_rg0dunlv', type: k, x: 140, z: 60, w: 6, d: 5, seed: 43, y: -10 }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 4 && Math.min(...ys) >= -10 - 1e-6 && Math.max(...ys) < 0, `${k} below ground (y = -10): ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)])); }
  }
  { // wizard's tower (2026-10-11): eleven room types, tower-stone walls (the apothecary shop: half-timber); a room solves, deterministically, on any level
    const WIZ = ['wiz-lab', 'wiz-study', 'wiz-summoning', 'wiz-observatory', 'wiz-scrying', 'wiz-store', 'wiz-apothecary', 'wiz-bedchamber', 'wiz-menagerie', 'wiz-stair', 'wiz-workshop'];
    for (const k of WIZ) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(rg.families.includes('tower-stone') && (await import('../core/height.js')).ROOF_BY_FAMILY['tower-stone'] === 'slate', 'tower-stone is in the wall family list and takes a slate roof');
    const a = { id: 'room_rg0wizsm', type: 'wiz-summoning', x: 200, z: 20, w: 4, d: 4, seed: 31 }, LS = rg.solve(t2.entities, a, 9);
    ok(LS.family === 'tower-stone' && LS.hash === rg.solve(t2.entities, a, 9).hash, `a summoning chamber solves, deterministically (${LS.objects.length} objects)`);
    ok(LS.objects.some(o => o.cat === 'decal-ritual-circle') && LS.objects.filter(o => /candle/.test(o.cat)).length >= 4, 'the summoning chamber has its circle and the candles round it', LS.objects.map(o => o.cat).join(' '));
    const tc = applyArea(t2, 'room.spawn', { ...a, layout: LS }), mine = [...rg.edges(tc.entities).edges.values()].filter(e => e.owner.room === a.id);
    ok(!mine.some(e => e.kind === 'window') && mine.some(e => e.kind === 'door' && e.doorType === 'door-tower'), 'a summoning chamber has no windows; its door is the tower door');
    for (const [type, w, d, y] of [['wiz-observatory', 4, 4, 30], ['wiz-lab', 5, 4, 10], ['wiz-store', 3, 3, -10]]) { // a tower is rooms stacked: every type must stand on any storey
      const r = { id: 'room_rg0wizlv', type, x: 240, z: 20, w, d, seed: 43, y }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 6 && Math.min(...ys) >= y - 1e-6 && Math.max(...ys) < y + 10, `${type} at y = ${y}: ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)]));
    }
  }
  { // market & village (2026-10-11): twelve rooms; ONE shop program, the trade is a sku tier; the square and the street are outdoor
    const MK = ['mkt-square', 'mkt-street', 'mkt-general', 'mkt-bakery', 'mkt-apothecary', 'mkt-tailor', 'mkt-curio', 'mkt-backroom', 'mkt-passage', 'mkt-watch', 'mkt-house', 'mkt-bedroom'];
    for (const k of MK) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0mktba', type: 'mkt-bakery', x: 200, z: 20, w: 4, d: 4, seed: 31 }, LB = rg.solve(t2.entities, a, 9);
    ok(LB.family === 'half-timber' && LB.hash === rg.solve(t2.entities, a, 9).hash, `a bakery solves, deterministically (${LB.objects.length} objects)`);
    ok(LB.objects.some(o => o.cat === 'counter-shop' && /bakery/.test(o.sku)) && !LB.objects.some(o => /--(general|apoth|tailor|curio)/.test(o.sku || '')), "the bakery has the baker's counter and nobody else's stock", JSON.stringify(LB.objects.filter(o => /^(counter-shop|shop-)/.test(o.cat)).map(o => o.sku)));
    const tl = rg.solve(t2.entities, { id: 'room_rg0mktta', type: 'mkt-tailor', x: 220, z: 20, w: 4, d: 4, seed: 33 }, 9);
    ok(tl.objects.some(o => o.cat === 'counter-shop' && /tailor/.test(o.sku)) && tl.objects.some(o => o.cat === 'shop-shelf-stocked' && /tailor/.test(o.sku)), "the same program lays the tailor's, in the tailor's stock");
    const sq = rg.solve({}, { id: 'room_rg0mktsq', type: 'mkt-square', x: 0, z: 0, w: 8, d: 7, seed: 5 }, 1);
    ok(sq.objects.filter(o => o.cat === 'market-stall').length >= 2, `a market square has its stalls (${sq.objects.filter(o => o.cat === 'market-stall').length})`);
  }
  { // type:min  mine (2026-10-11): thirteen room types; hewn rock and no windows underground, a tunnel with a way on, the shaft head's ladder
    const MIN = ['min-tunnel', 'min-junction', 'min-face', 'min-collapsed', 'min-flooded', 'min-shaft-head', 'min-sorting', 'min-tool-store', 'min-mess', 'min-powder-store', 'min-seam', 'min-pithead', 'min-smelter'];
    for (const k of MIN) ok(rg.types.has(k), `the room engine knows ${k}`);
    ok(rg.families.includes('mine-timbered'), 'mine-timbered is in the wall family list');
    const c = { id: 'room_rg0mtunl', type: 'min-tunnel', x: 60, z: 120, w: 8, d: 2, seed: 33 }, LT = rg.solve(t2.entities, c, 9), tc = applyArea(t2, 'room.spawn', { ...c, layout: LT }), EC = rg.edges(tc.entities), mine = [...EC.edges.values()].filter(e => e.owner.room === c.id);
    ok(LT.hash === rg.solve(t2.entities, c, 9).hash && !mine.some(e => e.kind === 'window') && mine.filter(e => e.kind === 'door').length === 2, `a lone mine tunnel solves, deterministically, with no windows and a door at each end (${LT.objects.length} objects)`, mine.filter(e => e.kind === 'door').length);
    const sh = rg.solve(t2.entities, { id: 'room_rg0mshft', type: 'min-shaft-head', x: 60, z: 130, w: 5, d: 5, seed: 35 }, 9);
    ok(sh.objects.some(o => /^(mine-shaft-collar|pit-open|well)$/.test(o.cat)) && sh.objects.some(o => o.cat === 'windlass') && !sh.objects.some(o => o.cat === 'ladder-wood'), 'the shaft head has its shaft and winch, and rolls no ladder of its own (a ladder is a stair: the generator or a hand puts it there)');
    for (const k of MIN.filter(k => k !== 'min-pithead' && k !== 'min-seam')) { const r = { id: 'room_rg0minlv', type: k, x: 140, z: 120, w: 6, d: 5, seed: 43, y: -10 }, L = rg.solve({}, r, 1), ys = L.objects.map(o => o.y || 0);
      ok(L.objects.length >= 4 && Math.min(...ys) >= -10 - 1e-6 && Math.max(...ys) < 0, `${k} below ground (y = -10): ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)])); }
  }
  { // type:hut  farmstead (2026-10-11): sixteen room types from the library as it stood; half-timber, rough-timber and fieldstone walls; five outdoor plots
    const HUT = ['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-pigsty', 'hut-barn', 'hut-granary', 'hut-dairy', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard'];
    for (const k of HUT) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0hcott', type: 'hut-cottage', x: 60, z: 120, w: 4, d: 4, seed: 31 }, LC = rg.solve(t2.entities, a, 9);
    ok(LC.hash === rg.solve(t2.entities, a, 9).hash && LC.objects.some(o => /^hearth-/.test(o.cat)) && LC.objects.some(o => /^(bed-straw-pallet|bedroll|bed-single|cot)$/.test(o.cat)), `a cottage solves, deterministically, with its fire on the floor and its bed (${LC.objects.length} objects)`);
    const g = { id: 'room_rg0hgard', type: 'hut-garden', x: 60, z: 140, w: 5, d: 4, seed: 33 }, LG = rg.solve(t2.entities, g, 9);
    ok(LG.objects.filter(o => /^(vegetable-patch|trade-herb-bed)$/.test(o.cat)).length >= 2 && LG.objects.some(o => /^fence-/.test(o.cat)), 'the vegetable garden has its beds and its fence');
    const o = { id: 'room_rg0horch', type: 'hut-orchard', x: 60, z: 160, w: 6, d: 5, seed: 35 }, LO = rg.solve(t2.entities, o, 9);
    ok(LO.objects.filter(q => q.cat === 'tree-fruit').length >= 4, 'the orchard has its fruit trees in rows');
    const c = { id: 'room_rg0hcell', type: 'hut-cellar', x: 60, z: 180, w: 3, d: 3, seed: 37 }, tc = applyArea(t2, 'room.spawn', { ...c, layout: rg.solve(t2.entities, c, 9) }), EC = rg.edges(tc.entities);
    ok(![...EC.edges.values()].some(e => e.owner.room === c.id && e.kind === 'window'), 'a root cellar has no windows');
    const HT = await import('../core/height.js');
    ok(HT.roofStyleOf({}, { recipe: { type: 'hut-kitchen' } }, () => 'half-timber') === 'thatch' && HT.roofStyleOf({}, { recipe: { type: 'kitchen' } }, () => 'half-timber') === 'tile', 'a farm room is thatched whatever its walls; the inn kitchen in half-timber keeps its tiles');
    for (const [k, y] of [['hut-loft', 10], ['hut-cellar', -10], ['hut-bedroom', 10]]) { const r = { id: 'room_rg0hutlv', type: k, x: 140, z: 120, w: 4, d: 3, seed: 43, y }, L = rg.solve({}, r, 1), ys = L.objects.map(q => q.y || 0);
      ok(L.objects.length >= 5 && Math.min(...ys) >= y - 1e-6 && Math.max(...ys) < y + 10, `${k} at y = ${y}: ${L.objects.length} things, all between its floor and its ceiling`, JSON.stringify([Math.min(...ys), Math.max(...ys)])); }
  }
  { // smithy & workshop (2026-10-11): nine rooms; ONE workshop program, the craft is a line of data; the yard is outdoor
    const SM = ['smi-forge', 'smi-armoury', 'smi-carpenter', 'smi-potter', 'smi-shopfront', 'smi-stock', 'smi-yard', 'smi-quarters', 'smi-passage'];
    for (const k of SM) ok(rg.types.has(k), `the room engine knows ${k}`);
    const a = { id: 'room_rg0smifo', type: 'smi-forge', x: 300, z: 20, w: 5, d: 4, seed: 31 }, LF = rg.solve(t2.entities, a, 9);
    ok(LF.family === 'fieldstone' && LF.hash === rg.solve(t2.entities, a, 9).hash, `a forge solves, deterministically (${LF.objects.length} objects)`);
    ok(LF.objects.some(o => o.cat === 'forge') && LF.objects.some(o => o.cat === 'anvil') && !LF.objects.some(o => /^(carpenter-bench|kiln-pottery|potters-wheel)$/.test(o.cat)), 'the forge has its forge and anvil and no other craft\'s workstation', JSON.stringify(LF.objects.map(o => o.cat).slice(0, 12)));
    const cp = rg.solve(t2.entities, { id: 'room_rg0smica', type: 'smi-carpenter', x: 320, z: 20, w: 5, d: 4, seed: 33 }, 9);
    ok(cp.objects.some(o => o.cat === 'carpenter-bench') && !cp.objects.some(o => /^(forge|anvil|kiln-pottery)$/.test(o.cat)), "the same program lays the carpenter's shop round his bench, with no forge");
    const sh = rg.solve(t2.entities, { id: 'room_rg0smish', type: 'smi-shopfront', x: 340, z: 20, w: 4, d: 4, seed: 35 }, 9);
    ok(sh.objects.some(o => o.cat === 'counter-shop' && /smith/.test(o.sku)), "the shop front has the smith's counter");
    const yd = rg.solve({}, { id: 'room_rg0smiyd', type: 'smi-yard', x: 0, z: 0, w: 6, d: 5, seed: 5 }, 1);
    ok(yd.objects.some(o => /^(smith-shoeing-stocks|hitching-post)$/.test(o.cat)), `a smith's yard has its shoeing stocks or hitching rail (${yd.objects.length} things)`);
  }
  // re-roll honours pinned furniture
  const pinMe = L1.objects.find(o => !o.parent && o.place === 'floor') || L1.objects[0];
  t2 = applyArea(t2, 'entity.flag', { ids: [pinMe.id], pinned: true });
  const R = rg.solve(t2.entities, { id: 'room_rg000001', type: 'common', seed: 43 }, 1, rg.pinnedOf(t2.entities, 'room_rg000001'));
  const t3 = applyArea(t2, 'room.reroll', { id: 'room_rg000001', seed: 43, layout: R });
  const after = Object.values(t3.entities).filter(e => e.room === 'room_rg000001');
  ok(t3.entities[pinMe.id] && after.length === R.objects.length + 1 && t3.entities.room_rg000001.recipe.seed === 43, `re-roll keeps the pinned ${pinMe.cat} and replaces the rest (${after.length} objects)`);
  ok(!R.objects.some(o => o.cat === pinMe.cat && Math.hypot(o.x - pinMe.x, o.z - pinMe.z) < 0.5), 'the new layout lays out around the pinned piece');
  const inv = inverseOf(t2, 'room.reroll', { id: 'room_rg000001', seed: 43, layout: R });
  ok(stableStringify(applyArea(t3, inv.type, inv.args).entities) === stableStringify(t2.entities), 'undo of a re-roll restores the old furniture exactly');
  const t4 = applyArea(t3, 'room.delete', { id: 'room_rg000001' });
  ok(!Object.values(t4.entities).some(e => e.room === 'room_rg000001') && !t4.entities.room_rg000001, 'room.delete removes the room and all its furniture');
  { // ---- rooms turn, move and hide (Harry 2026-10-05) ----
    const RID = 'room_turn0001', NB = 'room_turn0002';
    let a = newArea('tbl_turn00001', 'turn');
    const LT = rg.solve(a.entities, { id: RID, type: 'guest', x: 10, z: 10, w: 5, d: 4, seed: 99 }, 1);
    a = applyArea(a, 'room.spawn', { id: RID, type: 'guest', x: 10, z: 10, w: 5, d: 4, seed: 99, layout: LT });
    const objs = (t, id = RID) => Object.values(t.entities).filter(e => e.kind === 'object' && e.room === id);
    // what the user did to it: moved one thing, pinned one, deleted one, added one by hand, painted a floor tile, edited a wall
    const floorOnes = objs(a).filter(o => !o.parent && o.place === 'floor');
    const moved = floorOnes[0], pinned = floorOnes[1], gone = objs(a).find(o => !o.parent && o.id !== moved.id && o.id !== pinned.id && !objs(a).some(c => c.parent === o.id));
    a = applyArea(a, 'object.move', { id: moved.id, x: 61.5, z: 67.5, rot: 0.3 });
    a = applyArea(a, 'entity.flag', { ids: [pinned.id], pinned: true });
    a = applyArea(a, 'object.delete', { id: gone.id });
    a = applyArea(a, 'object.place', { id: 'obj_added00001', cat: 'crate', x: 52, z: 53, room: RID, dims: [2, 2, 2] });
    a = applyArea(a, 'object.place', { id: 'obj_tile000001', cat: 'floor-cobble', place: 'tile', layer: 'floor', x: 52.5, z: 52.5, room: RID, dims: [5, 0.1, 5] });
    a = applyArea(a, 'edge.set', { key: 'h:10:10', as: 'open' });            // the north wall's west-most segment, deleted
    a = applyArea(a, 'edge.set', { key: 'h:11:10', as: 'wall' });            // and its neighbour forced plain (adjacent keys)
    a = applyArea(a, 'object.place', { id: 'obj_wall000001', cat: 'wall-plank', place: 'kit', layer: 'walls', x: 75, z: 62.5, rot: Math.PI / 2, room: RID, fromEdge: 'v:15:12', dims: [5, 9, 1] });
    const before = a, n0 = objs(a).length;
    const rel = (t) => { const rc = t.entities[RID].recipe, cx = (rc.x + rc.w / 2) * 5, cz = (rc.z + rc.d / 2) * 5; return objs(t).map(o => [o.id, +(Math.hypot(o.x - cx, o.z - cz)).toFixed(2)]).sort(); };
    // one quarter turn clockwise
    ok(!checkCommand({ state: { ...S, areas: { ...S.areas, tbl_turn00001: a } }, by: GM }, { type: 'room.rotate', area: 'tbl_turn00001', args: { id: RID, turns: 1 } }), 'GM may turn a room');
    const inv1 = inverseOf(a, 'room.rotate', { id: RID, turns: 1 });
    const a1 = applyArea(a, 'room.rotate', { id: RID, turns: 1 });
    const r1 = a1.entities[RID].recipe;
    eq([r1.w, r1.d, r1.turn, r1.seed], [4, 5, 1, 99], 'a quarter turn swaps width and depth, remembers the turn and keeps the seed');
    ok(Number.isInteger(r1.x) && Number.isInteger(r1.z) && Math.abs((r1.x + r1.w / 2) - 12.5) <= 0.5 && Math.abs((r1.z + r1.d / 2) - 12) <= 0.5, `the turned room stays on the grid, about its centre (${r1.x}, ${r1.z})`);
    eq(objs(a1).length, n0, 'nothing is re-rolled: the same things, the same count');
    ok(objs(a1).every(o => o.x >= r1.x * 5 - 0.6 && o.x <= (r1.x + r1.w) * 5 + 0.6 && o.z >= r1.z * 5 - 0.6 && o.z <= (r1.z + r1.d) * 5 + 0.6), 'every thing is still inside the turned room');
    eq(rel(a1), rel(a), 'every thing keeps its distance from the room\'s centre (the layout is preserved)');
    const m1 = a1.entities[moved.id], c0 = [62.5, 60], c1 = [(r1.x + r1.w / 2) * 5, (r1.z + r1.d / 2) * 5];
    eq([+(m1.x - c1[0]).toFixed(2), +(m1.z - c1[1]).toFixed(2), +m1.rot.toFixed(4)], [+(-(67.5 - c0[1])).toFixed(2), +(61.5 - c0[0]).toFixed(2), +(0.3 - Math.PI / 2).toFixed(4)], 'a thing the user moved turns with the room: east becomes south, and it faces a quarter turn round');
    ok(a1.entities[pinned.id]?.pinned && !a1.entities[gone.id] && a1.entities.obj_added00001 && a1.entities.obj_tile000001, 'pinned stays pinned, deleted stays deleted, the hand-placed crate and the painted tile are still there');
    ok(Number.isInteger(a1.entities.obj_tile000001.x - 2.5) && Number.isInteger((a1.entities.obj_tile000001.x - 2.5) / 5), 'a floor tile lands on a cell centre');
    const edgeKeys = (t) => Object.values(t.entities).filter(e => e.kind === 'edge').map(e => `${e.key}=${e.as}`).sort();
    eq(edgeKeys(a1), [`v:${r1.x + r1.w}:${r1.z}=open`, `v:${r1.x + r1.w}:${r1.z + 1}=wall`].sort(), 'wall edits turn with the room: the north wall\'s west end becomes the east wall\'s north end (two adjacent edits both survive)');
    eq(a1.entities.obj_wall000001.fromEdge, `h:${r1.x + r1.w - 3}:${r1.z + r1.d}`, 'a wall piece made into an object keeps naming the wall segment it stands on');
    ok(stableStringify(applyArea(a1, inv1.type, inv1.args).entities) === stableStringify(before.entities), 'undo of a turn restores everything exactly');
    // four quarter turns come home; two are a true half turn
    let a4 = a; for (let i = 0; i < 4; i++) a4 = applyArea(a4, 'room.rotate', { id: RID, turns: 1 });
    const near = (x, y) => Math.abs(x - y) < 0.011;
    ok(a4.entities[RID].recipe.x === 10 && a4.entities[RID].recipe.z === 10 && a4.entities[RID].recipe.turn === 0 && objs(a4).every(o => near(o.x, a.entities[o.id].x) && near(o.z, a.entities[o.id].z)) && stableStringify(edgeKeys(a4)) === stableStringify(edgeKeys(a)), 'four quarter turns bring the room and everything in it back where it was');
    const a2 = applyArea(a, 'room.rotate', { id: RID, turns: 2 });
    ok(a2.entities[RID].recipe.x === 10 && a2.entities[RID].recipe.z === 10 && objs(a2).every(o => near(o.x + a.entities[o.id].x, 125) && near(o.z + a.entities[o.id].z, 120)), 'two quarter turns are a half turn about the true centre, in the same rectangle');
    eq(stableStringify(applyArea(a, 'room.rotate', { id: RID, turns: -1 }).entities), stableStringify(applyArea(a, 'room.rotate', { id: RID, turns: 3 }).entities), 'turns: -1 is one quarter anticlockwise');
    // the room's own outside door stays on the same wall of the room
    const doorOf = (t) => [...rg.edges(t.entities).edges.values()].find(e => e.kind === 'door' && e.doorFor === RID);
    const d0 = doorOf(a), d1 = doorOf(a1), CLOCK = ['N', 'E', 'S', 'W'];
    ok(d0 && d1 && d1.owner.side === CLOCK[(CLOCK.indexOf(d0.owner.side) + 1) % 4], `the room's outside door turns with it (${d0?.owner.side} wall becomes the ${d1?.owner.side} wall)`);
    // a turn that would overlap a neighbour is refused
    a = applyArea(a, 'room.spawn', { id: NB, type: 'privy', x: 13, z: 8, w: 2, d: 2, seed: 5, layout: { hash: 'x', summary: '', objects: [] } });
    const refused = REGISTRY['room.rotate'].check({ area: a }, { id: RID, turns: 1 });
    ok(/would overlap room room_turn0002/.test(refused || ''), `a turn into a neighbour is refused (${refused})`);
    ok(/would overlap/.test(REGISTRY['room.move'].check({ area: a }, { id: RID, dx: 0, dz: -1 }) || '') && !REGISTRY['room.move'].check({ area: a }, { id: RID, dx: -3, dz: 0 }), 'a move into a neighbour is refused; a clear move is allowed');
    ok(/1, 2 or 3/.test(REGISTRY['room.rotate'].check({ area: a }, { id: RID, turns: 4 }) || ''), 'four quarter turns is not a turn');
    { // a room's own fog height (the ring's Fog height slider): room.set { fog }
      const f1 = applyArea(a, 'room.set', { id: RID, fog: 2.256 });
      eq(f1.entities[RID].fog, 2.26, 'room.set fog stores the room\'s own fog height, in feet (to the hundredth)');
      eq([f1.entities[RID].recipe.seed, objs(f1).length], [99, n0], 'setting the fog changes nothing else: the same recipe, the same things');
      eq(applyArea(f1, 'room.set', { id: RID, fog: 0 }).entities[RID].fog, 0, 'fog 0 = no fog, and it is kept (it is not "unset")');
      ok(!('fog' in applyArea(f1, 'room.set', { id: RID, fog: -1 }).entities[RID]), 'fog -1 = back to the room type\'s default: the field is removed');
      ok(/0 to 8/.test(REGISTRY['room.set'].check({ area: a }, { id: RID, fog: 9 }) || ''), 'fog above 8 ft is refused, with the range in the reason');
      ok(!REGISTRY['room.set'].check({ area: a }, { id: RID, fog: 8 }) && !REGISTRY['room.set'].check({ area: a }, { id: RID, fog: -1 }), '8 ft and -1 are accepted');
      eq(parseArgs('room.set', { id: RID, fog: '1.5' }, { fromQuery: true }).args, { id: RID, fog: 1.5 }, 'fog arrives as a number from a GET query (an LLM seat)');
      const inv = inverseOf(a, 'room.set', { id: RID, fog: 3 }), back = applyArea(applyArea(a, 'room.set', { id: RID, fog: 3 }), inv.type, inv.args);
      ok(!('fog' in back.entities[RID]), 'undoing a fog change puts the room back as it was');
    }
    // moving: contents and wall edits ride along (adjacent edits, moved along their own wall, both survive)
    const am = applyArea(a, 'room.move', { id: RID, dx: -1, dz: 0 });
    eq(edgeKeys(am), ['h:10:10=wall', 'h:9:10=open'], 'a move carries the wall edits (one cell along the wall they are on)');
    ok(objs(am).length === n0 && objs(am).every(o => near(o.x, a.entities[o.id].x - 5) && near(o.z, a.entities[o.id].z)), 'a move carries every thing in the room, exactly');
    // ---- hiding a room hides all of it ----
    const invH = inverseOf(a, 'entity.flag', { ids: [RID], hidden: true });
    const ah = applyArea(a, 'entity.flag', { ids: [RID], hidden: true });
    ok(ah.entities[RID].hidden && objs(ah).every(o => o.hidden) && Object.values(ah.entities).filter(e => e.kind === 'edge').every(e => e.hidden) && !ah.entities[NB].hidden, 'hiding a room hides the room, everything in it and its own wall edits (not its neighbour)');
    const pview = areaForClient(ah, false), gview = areaForClient(ah, true);
    ok(!pview.entities[RID] && !Object.values(pview.entities).some(e => e.room === RID || e.kind === 'edge') && pview.entities[NB] && gview.entities[RID], 'the player side receives nothing of a hidden room; the GM side all of it');
    ok(!JSON.stringify(pview).includes(RID), 'no trace of the hidden room\'s id in what a player receives');
    const ah2 = applyArea(ah, 'object.place', { id: 'obj_added00002', cat: 'crate', x: 55, z: 55, room: RID, dims: [2, 2, 2] });
    ok(ah2.entities.obj_added00002.hidden, 'a thing put into a hidden room is hidden with it');
    const RR = rg.solve(ah.entities, { id: RID, type: 'guest', seed: 100 }, 1, rg.pinnedOf(ah.entities, RID));
    ok(objs(applyArea(ah, 'room.reroll', { id: RID, seed: 100, layout: RR })).every(o => o.hidden), 'a hidden room re-rolled stays wholly hidden');
    ok(objs(applyArea(ah, 'room.rotate', { id: RID, turns: 2 })).every(o => o.hidden) && Object.values(applyArea(ah, 'room.move', { id: RID, dx: -2, dz: 0 }).entities).filter(e => e.kind === 'edge').every(e => e.hidden), 'a hidden room turned or moved stays wholly hidden (wall edits too)');
    ok(stableStringify(applyArea(ah, invH.type, invH.args).entities) === stableStringify(a.entities), 'undo of hiding a room restores every flag');
    const au = applyArea(ah, 'entity.flag', { ids: [RID], hidden: false });
    ok(!au.entities[RID].hidden && objs(au).every(o => !o.hidden) && Object.keys(areaForClient(au, false).entities).length === Object.keys(au.entities).length, 'revealing the room reveals all of it');
    // what a player's client builds beside a hidden room: the visible room's wall is whole (its own outside wall)
    const pe = rg.edges(pview.entities);
    const nbKeys = ['h:13:10', 'h:14:10'];
    ok(nbKeys.every(k => pe.edges.has(k) && pe.edges.get(k).sides.length === 1 && pe.edges.get(k).owner.room === NB), 'for a player, the wall a visible room shared with the hidden room is that room\'s own outside wall (never a gap)');
    // a building hides as its rooms
    let ab = applyArea(newArea('tbl_bld000001', 'b'), 'room.spawn', { id: 'room_bld00001', building: 'bld_hide00001', buildingName: 'Keep', type: 'privy', x: 0, z: 0, w: 2, d: 2, seed: 1, layout: { hash: 'x', summary: '', objects: [{ id: 'obj_bld000001', cat: 'crate', x: 5, z: 5, dims: [2, 2, 2] }] } });
    ab = applyArea(ab, 'entity.flag', { ids: ['bld_hide00001'], hidden: true });
    ok(ab.entities.bld_hide00001.hidden && ab.entities.room_bld00001.hidden && ab.entities.obj_bld000001.hidden && !Object.keys(areaForClient(ab, false).entities).length, 'hiding a building hides its rooms and their things');
  }
  { // ---- rooms that are not rectangles (Harry 2026-10-05: overlapping draws make L-shaped rooms) ----
    const Lo = [[0, 0], [4, 0], [4, 3], [7, 3], [7, 6], [0, 6]]; // a 7 x 6 room with its north-east 3 x 3 corner missing
    const L = { x: 10, z: 10, w: 7, d: 6, outline: Lo };
    eq([FP.outlineProblem(L), FP.areaCells(L), FP.hasCell(L, 13, 12), FP.hasCell(L, 14, 12), FP.hasCell(L, 14, 13)], [null, 33, true, false, true], 'an L outline: 33 of its 42 cells, the notch not among them');
    eq([FP.innerRect(L), FP.rectsOf(L)], [{ i: 0, j: 0, w: 4, d: 6 }, [{ i: 0, j: 0, w: 4, d: 6 }, { i: 4, j: 3, w: 3, d: 3 }]], 'the largest rectangle inside it, and the rest as a second rectangle');
    eq(FP.labelPoint(L), [60, 65], 'the label point is the middle of the largest rectangle (on the floor, never in the notch)');
    ok(FP.contains(L, 60, 65) && !FP.contains(L, 80, 55) && FP.contains(L, 80, 70), 'point-in-room follows the shape');
    const B = FP.boundary(L), inner = B.filter(b => (b.side === 'E' && b.line === 4) || (b.side === 'N' && b.line === 3));
    eq([B.length, inner.length, inner.map(b => b.key).sort()], [26, 6, ['h:14:13', 'h:15:13', 'h:16:13', 'v:14:10', 'v:14:11', 'v:14:12']], 'its boundary is 26 wall segments, six of them the two walls of the inside corner');
    ok(FP.perimeterKeys(L).includes('c14:13') && FP.perimeterKeys(L).includes('v:14:11') && !FP.perimeterKeys(L).includes('h:14:10') && !FP.perimeterKeys(L).includes('c17:10'), 'wall and post keys follow the true outline (the inside corner has a post; the notch\'s outer corner has none)');
    ok(/clockwise/.test(FP.outlineProblem({ w: 7, d: 6, outline: [...Lo].reverse() }) || '') && /grid/.test(FP.outlineProblem({ w: 7, d: 6, outline: [[0, 0], [7, 0], [4, 6], [0, 6]] }) || '') && /four sides/.test(FP.outlineProblem({ w: 9, d: 6, outline: Lo }) || '') && /simple shape/.test(FP.outlineProblem({ w: 4, d: 4, outline: [[0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [2, 4], [2, 2], [0, 2]] }) || ''), 'a bad outline is refused: wrong way round, a slanted edge (not yet), not filling its rectangle, two parts touching at a corner');
    ok(FP.storedOutline({ w: 3, d: 2, outline: [[0, 0], [3, 0], [3, 2], [0, 2]] }) === undefined, 'a plain rectangle stores no outline');
    let o4 = Lo, w4 = 7, d4 = 6; const turns = []; for (let k = 0; k < 4; k++) { o4 = FP.turnOutline(o4, w4, d4); [w4, d4] = [d4, w4]; turns.push(FP.outlineProblem({ w: w4, d: d4, outline: o4 })); }
    eq([turns, o4], [[null, null, null, null], Lo], 'an outline turns by quarters (each a valid outline) and four turns bring it home');
    // drawing a rectangle over other rooms: what is left of it
    const pc = (rect, others) => FP.piecesOf(rect, others).pieces.map(p => [p.x, p.z, p.w, p.d, p.cells, p.hole ? 'hole' : p.outline ? p.outline.length : 'rect']);
    eq(pc({ x: 0, z: 0, w: 6, d: 4 }, [{ x: 4, z: -2, w: 4, d: 4 }]), [[0, 0, 6, 4, 20, 6]], 'a corner overlap leaves an L (one piece, six corners)');
    eq(pc({ x: 0, z: 0, w: 5, d: 4 }, [{ x: 2, z: -1, w: 1, d: 3 }]), [[0, 0, 5, 4, 18, 8]], 'a room poking into one side leaves a U (eight corners)');
    eq(pc({ x: 0, z: 0, w: 7, d: 3 }, [{ x: 3, z: -1, w: 2, d: 5 }]), [[0, 0, 3, 3, 9, 'rect'], [5, 0, 2, 3, 6, 'rect']], 'a room right across it cuts it into two pieces, the larger first');
    eq([pc({ x: 1, z: 1, w: 2, d: 2 }, [{ x: 0, z: 0, w: 5, d: 5 }]), FP.piecesOf({ x: 1, z: 1, w: 2, d: 2 }, [{ x: 0, z: 0, w: 5, d: 5 }]).covered.length], [[], 4], 'wholly inside another room: nothing is left');
    eq(pc({ x: 0, z: 0, w: 5, d: 5 }, [{ x: 2, z: 2, w: 1, d: 1 }]), [[0, 0, 5, 5, 24, 'hole']], 'right round another room: one piece with a hole (not a room we can make)');
    eq(pc({ x: 12, z: 8, w: 6, d: 6 }, [L]), [[12, 8, 6, 6, 25, 8]], 'drawn over an L-shaped room, the new room takes the cells the L does not stand on (its notch included)');
    // the commands
    let a = newArea('tbl_shape0001', 'shape');
    const sp = { id: 'room_shape001', type: 'guest', x: 10, z: 10, w: 7, d: 6, seed: 404, outline: Lo };
    ok(!REGISTRY['room.spawn'].check({ area: a, roomTypes: rg.types }, sp), 'room.spawn takes an outline');
    ok(/clockwise/.test(REGISTRY['room.spawn'].check({ area: a, roomTypes: rg.types }, { ...sp, outline: [...Lo].reverse() }) || ''), 'and refuses a bad one');
    const LS = rg.solve(a.entities, sp, 1);
    a = applyArea(a, 'room.spawn', { ...sp, layout: LS });
    eq(a.entities.room_shape001.recipe.outline, Lo, 'the outline is stored in the recipe (the bounding rectangle stays as x, z, w, d)');
    const inNotch = { id: 'room_shape002', type: 'privy', x: 14, z: 10, w: 3, d: 3, seed: 5, layout: { hash: 'x', summary: '', objects: [] } };
    ok(!REGISTRY['room.spawn'].check({ area: a, roomTypes: rg.types }, inNotch) && /overlaps/.test(REGISTRY['room.spawn'].check({ area: a, roomTypes: rg.types }, { ...inNotch, x: 13 }) || ''), 'another room fits in the notch; one cell further in, it overlaps');
    const objsOf = (t, id) => Object.values(t.entities).filter(e => e.kind === 'object' && e.room === id);
    // the layout: nothing in the notch, things against the inside corner's walls, everything walkable
    const audit = (t, id, R = 0.6) => {
      const rc = t.entities[id].recipe, objs = objsOf(t, id), X0 = rc.x * 5, Z0 = rc.z * 5, nx = rc.w * 10, nz = rc.d * 10, blocked = new Uint8Array(nx * nz);
      const inRoom = (x, z) => FP.hasCell(rc, Math.floor(x / 5), Math.floor(z / 5));
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (!inRoom(X0 + (i + 0.5) / 2, Z0 + (j + 0.5) / 2)) blocked[j * nx + i] = 1;
      const outside = [], over = [];
      for (const o of objs) {
        if (o.parent) continue;
        const c = Math.abs(Math.cos(o.rot || 0)), sn = Math.abs(Math.sin(o.rot || 0)), aw = c * o.dims[0] + sn * o.dims[2], ad = sn * o.dims[0] + c * o.dims[2];
        if (!FP.contains(rc, o.x, o.z)) outside.push(o.cat);
        else if (Math.min(aw, ad) > 1.2 && [[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([p, q]) => !inRoom(o.x + p * (aw / 2 - 0.55), o.z + q * (ad / 2 - 0.55)))) over.push(o.cat); // (walls are a foot thick: half a foot of slack)
        if (o.flat || (o.y || 0) > 0.5 || o.orient === 'floor' || o.place === 'ceiling' || (o.dims[1] || 0) < 0.4) continue;
        for (let j = Math.max(0, Math.floor((o.z - ad / 2 - R - Z0) * 2)); j < Math.min(nz, Math.ceil((o.z + ad / 2 + R - Z0) * 2)); j++) for (let i = Math.max(0, Math.floor((o.x - aw / 2 - R - X0) * 2)); i < Math.min(nx, Math.ceil((o.x + aw / 2 + R - X0) * 2)); i++) blocked[j * nx + i] = 1;
      }
      const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i];
      const near = (x, z) => { const ci = Math.floor((x - X0) * 2), cj = Math.floor((z - Z0) * 2); for (let r = 0; r < 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (free(ci + di, cj + dj)) return [ci + di, cj + dj]; return null; };
      const doors = [];
      for (const e of rg.edges(t.entities).edges.values()) { if (e.kind !== 'door' && e.kind !== 'door-span') continue; const sd = e.sides.find(x => x.room === id); if (!sd) continue;
        const n = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[sd.side]; doors.push(near((e.dir === 'h' ? (e.gx + 0.5) * 5 : e.gx * 5) + n[0] * 1.6, (e.dir === 'h' ? e.gz * 5 : (e.gz + 0.5) * 5) + n[1] * 1.6)); }
      const rects = FP.rectsOf(rc), seen = new Uint8Array(nx * nz), st = [doors[0] || near((rc.x + rects[0].i + rects[0].w / 2) * 5, (rc.z + rects[0].j + rects[0].d / 2) * 5)];
      if (st[0]) seen[st[0][1] * nx + st[0][0]] = 1;
      while (st.length && st[0]) { const [i, j] = st.pop(); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (free(i + di, j + dj) && !seen[(j + dj) * nx + i + di]) { seen[(j + dj) * nx + i + di] = 1; st.push([i + di, j + dj]); } }
      const share = rects.map(q => { let fr = 0, re = 0; for (let j = q.j * 10; j < (q.j + q.d) * 10; j++) for (let i = q.i * 10; i < (q.i + q.w) * 10; i++) if (!blocked[j * nx + i]) { fr++; if (seen[j * nx + i]) re++; } return fr ? re / fr : 1; });
      const innerWalls = FP.boundary(rc).filter(b => (b.side === 'N' && b.line !== 0) || (b.side === 'S' && b.line !== rc.d) || (b.side === 'W' && b.line !== 0) || (b.side === 'E' && b.line !== rc.w));
      const against = (b) => objs.filter(o => { if (o.parent || o.flat) return false; const [d, xs, zs] = b.key.split(':'), x = +xs * 5, z = +zs * 5, half = Math.max(o.dims[0], o.dims[2]) / 2 + 1.2; return d === 'h' ? o.x > x - 0.5 && o.x < x + 5.5 && Math.abs(o.z - z) < half : o.z > z - 0.5 && o.z < z + 5.5 && Math.abs(o.x - x) < half; }).length;
      return { n: objs.length, outside, over, doors: doors.length, cutDoors: doors.filter(p => !p || !seen[p[1] * nx + p[0]]).length, share, onInner: innerWalls.filter(b => against(b)).length, innerWalls: innerWalls.length };
    };
    const A0 = audit(a, 'room_shape001');
    ok(LS.parts === 2 && A0.n > 20 && !A0.outside.length && !A0.over.length, `an L-shaped guest room is furnished as two rectangles; nothing stands in the notch or over the outline (${A0.n} things)`, [A0.outside, A0.over]);
    ok(A0.onInner >= 2, `things stand against the walls of the inside corner (${A0.onInner} of its ${A0.innerWalls} wall segments have something at them)`);
    ok(A0.doors >= 1 && !A0.cutDoors && A0.share.every(v => v > 0.5), `its door reaches both rectangles (walkable share ${A0.share.map(v => Math.round(v * 100) + '%').join(', ')})`);
    ok(LS.hash === rg.solve(newArea('x_x', 'x').entities, sp, 1).hash && /Shaped room: furnished as 2 rectangles/.test(LS.summary) && !/open to the rest/.test(LS.summary), 'the shaped layout is deterministic; its summary says how it was furnished and does not list the join as a door');
    // the same over every room type and several seeds, beside a neighbour (an inside door as well as the outside one)
    let rooms = 0, bad = [], innerUsed = 0, things = 0;
    for (const type of ['guest', 'common', 'kitchen', 'storeroom', 'cellar', 'fine', 'privy', 'hallway', 'desk', 'stable', 'barn']) for (let seed = 1; seed <= 6; seed++) {
      let t = newArea('tbl_shape0002', 's');
      const nb = { id: 'room_nb000001', type: 'common', x: 6, z: 10, w: 4, d: 4, seed: 9 };
      t = applyArea(t, 'room.spawn', { ...nb, layout: rg.solve(t.entities, nb, 1) });
      const q = { id: 'room_l00000001', type, x: 10, z: 10, w: 7, d: 6, seed: seed * 101, outline: Lo };
      t = applyArea(t, 'room.spawn', { ...q, layout: rg.solve(t.entities, q, 2) });
      const r = audit(t, q.id); rooms++; things += r.n; if (r.onInner) innerUsed++;
      if (r.outside.length || r.over.length || r.cutDoors || r.share.some(v => v < 0.5)) bad.push(`${type}/${seed * 101}: outside ${r.outside} over ${r.over} cut doors ${r.cutDoors} share ${r.share.map(v => v.toFixed(2))}`);
    }
    ok(rooms === 66 && !bad.length && innerUsed >= 60, `66 L-shaped rooms (11 types x 6 seeds): none has a thing outside or over its outline, every door can be walked to, every rectangle is more than half walkable, ${innerUsed} use an inside-corner wall (${Math.round(things / rooms)} things a room)`, bad.slice(0, 3));
    // other shapes: the hard guarantees (nothing outside, nothing over the edge)
    let hard = 0, hardBad = [];
    for (const [nm, sh] of Object.entries({ U: { w: 7, d: 5, outline: [[0, 0], [2, 0], [2, 2], [5, 2], [5, 0], [7, 0], [7, 5], [0, 5]] }, notch: { w: 8, d: 5, outline: [[0, 0], [8, 0], [8, 5], [5, 5], [5, 4], [3, 4], [3, 5], [0, 5]] }, small: { w: 5, d: 5, outline: [[0, 0], [2, 0], [2, 3], [5, 3], [5, 5], [0, 5]] }, big: { w: 10, d: 8, outline: [[0, 0], [10, 0], [10, 8], [6, 8], [6, 4], [0, 4]] } }))
      for (const type of ['guest', 'common', 'kitchen', 'storeroom', 'fine', 'stable']) for (let seed = 1; seed <= 3; seed++) {
        const q = { id: 'room_l00000002', type, x: 10, z: 10, seed: seed * 77, ...sh };
        const t = applyArea(newArea('tbl_shape0003', 's'), 'room.spawn', { ...q, layout: rg.solve({}, q, 1) });
        const r = audit(t, q.id); hard++; if (r.outside.length || r.over.length || !r.n) hardBad.push(`${nm}/${type}/${seed * 77}: ${r.outside} ${r.over}`);
      }
    ok(hard === 72 && !hardBad.length, `72 more shaped rooms (U, a notched side, a small L, a big L): every one furnished, nothing outside or over its outline ${hardBad.slice(0, 4).join(' ; ')}`);
    // walls: the inside corner's two walls and its post exist, and belong to the room
    const ES = rg.edges(a.entities);
    ok(['v:14:10', 'v:14:11', 'v:14:12', 'h:14:13', 'h:15:13', 'h:16:13'].every(k => ES.edges.get(k)?.owner.room === 'room_shape001') && !ES.edges.has('h:14:10') && ES.corners.some(c => c.gx === 14 && c.gz === 13) && !ES.corners.some(c => c.gx === 17 && c.gz === 10), 'the shell follows the outline: the inside corner has its two walls and its post; nothing is built round the notch');
    const withNotchRoom = applyArea(a, 'room.spawn', inNotch), EN = rg.edges(withNotchRoom.entities);
    ok(EN.edges.get('v:14:11').sides.length === 2 && EN.edges.get('h:15:13').sides.length === 2, 'a room built in the notch shares the inside corner\'s walls with it');
    // turn and move: the outline goes with the room, and so does everything in it
    const t1 = applyArea(a, 'room.rotate', { id: 'room_shape001', turns: 1 }), r1 = t1.entities.room_shape001.recipe;
    eq([r1.w, r1.d, FP.outlineProblem(r1), FP.areaCells(r1)], [6, 7, null, 33], 'a quarter turn turns the outline too');
    ok(objsOf(t1, 'room_shape001').length === A0.n && !audit(t1, 'room_shape001').outside.length && !audit(t1, 'room_shape001').over.length, 'after the turn everything is still on the room\'s floor (nothing in the notch, which turned too)');
    let t4 = a; for (let k = 0; k < 4; k++) t4 = applyArea(t4, 'room.rotate', { id: 'room_shape001', turns: 1 });
    eq([t4.entities.room_shape001.recipe.outline, t4.entities.room_shape001.recipe.x, t4.entities.room_shape001.recipe.z], [Lo, 10, 10], 'four quarter turns bring an L-shaped room home');
    const blocker = applyArea(a, 'room.spawn', { id: 'room_shape003', type: 'privy', x: 8, z: 16, w: 2, d: 2, seed: 5, layout: { hash: 'x', summary: '', objects: [] } });
    ok(/would overlap/.test(REGISTRY['room.rotate'].check({ area: blocker }, { id: 'room_shape001', turns: 2 }) || '') === false && /would overlap/.test(REGISTRY['room.move'].check({ area: withNotchRoom }, { id: 'room_shape002', dx: -1, dz: 0 }) || ''), 'overlap for turns and moves is by cells: a room may sit in the notch, and may not move onto the L');
    const tm = applyArea(a, 'room.move', { id: 'room_shape001', dx: 3, dz: -2 });
    ok(tm.entities.room_shape001.recipe.outline === a.entities.room_shape001.recipe.outline && !audit(tm, 'room_shape001').outside.length, 'a move keeps the outline (it is relative to the room) and everything in it');
    // hide: the inside corner's wall edits go with it
    let th = applyArea(a, 'edge.set', { key: 'v:14:11', as: 'open' });
    th = applyArea(th, 'entity.flag', { ids: ['room_shape001'], hidden: true });
    ok(th.entities[edgeId('v:14:11')]?.hidden && !Object.keys(areaForClient(th, false).entities).length, 'hiding an L-shaped room hides its inside walls\' edits too; the player receives nothing');
    // old campaigns: a recipe with no outline is the rectangle it always was
    const plain = { x: 3, z: 4, w: 5, d: 2 };
    eq([FP.areaCells(plain), FP.boundary(plain).length, FP.perimeterKeys(plain).length, FP.overlap(plain, { x: 7, z: 5, w: 2, d: 2 }), FP.labelPoint(plain)], [10, 14, 28, true, [27.5, 25]], 'a room saved before outlines existed reads as its rectangle');
  }
  ok(rg.sizeOf('backpack')?.dims.every(v => v > 0.5 && v < 3), 'catalog sizing for hand placement');
  ok(/^v2-[0-9a-f]{8}$/.test(rg.version), 'engine version stamp');
}


// --- batch, flags, hidden, pawns, chat ---
{
  let T = newArea('tbl_ui000001', 'ui'); setArea('tbl_ui000001', T);
  camp('seat.create', { id: 'seat_pl000003', kind: 'human', role: 'player', name: 'Cleric', location: 'tbl_ui000001' }, GM);
  const P3 = 'seat_pl000003';
  ok(!run(GM, 'token.create', 'tbl_ui000001', { id: 'tok_cler0001', name: 'Cleric', x: 0, z: 0, owner: P3, damage: 2 }), 'pawn with damage');
  ok(!run(GM, 'batch', 'tbl_ui000001', { ops: [{ type: 'object.place', args: { id: 'obj_crate001', name: 'crate', x: 1, z: 1 } }, { type: 'object.place', args: { id: 'obj_crate002', name: 'crate', x: 2, z: 1 } }] }), 'GM batch of two places');
  ok(tbl('tbl_ui000001').entities.obj_crate002 && tbl('tbl_ui000001').seq === 2, 'batch is one entry');
  eq(run(P3, 'batch', 'tbl_ui000001', { ops: [{ type: 'token.move', args: { id: 'tok_cler0001', x: 3, z: 3 } }, { type: 'object.move', args: { id: 'obj_crate001', x: 9, z: 9 } }] })?.code, 'forbidden', 'a batch is refused whole if any op is not allowed');
  ok(tbl('tbl_ui000001').entities.tok_cler0001.x === 0, '...and nothing in it applied');
  ok(!run(P3, 'token.set', 'tbl_ui000001', { id: 'tok_cler0001', conditions: ['poisoned'] }), 'player edits own pawn\'s conditions');
  eq(run(P3, 'token.set', 'tbl_ui000001', { id: 'tok_npc00001', conditions: ['prone'] })?.code, 'invalid', "player cannot edit someone else's pawn");
  ok(!run(GM, 'entity.flag', 'tbl_ui000001', { ids: ['obj_crate002'], hidden: true }), 'GM hides a crate');
  eq(run(P3, 'entity.flag', 'tbl_ui000001', { ids: ['obj_crate001'], hidden: true })?.code, 'forbidden', 'player cannot hide things');
  eq(run(P3, 'object.open', 'tbl_ui000001', { id: 'obj_crate002', open: true })?.code, 'invalid', 'a hidden thing does not exist for players (same answer as missing)');
  ok(!run(P3, 'object.open', 'tbl_ui000001', { id: 'obj_crate001', open: true }), 'players may open things');
  ok(!run(P3, 'chat.say', 'tbl_ui000001', { id: 'msg_aaaa0001', text: 'hello' }), 'player says hello');
  ok(!run(P3, 'dice.roll', 'tbl_ui000001', { id: 'msg_aaaa0002', expr: 'd20+5', rolls: [14], total: 19 }), 'player rolls');
  const tb = tbl('tbl_ui000001');
  ok(tb.chat.length === 2 && tb.chat[0].text === 'hello' && tb.chat[1].roll.total === 19, 'chat lines in the area');
  const inv = inverseOf(tb, 'dice.roll', { id: 'msg_aaaa0002' });
  ok(applyArea(tb, inv.type, inv.args).chat.length === 1, 'undo of a roll removes it');
  const v = areaForClient(tb, false);
  ok(!v.entities.obj_crate002 && v.entities.obj_crate001, 'client projection for players drops hidden things');
  ok(!run(GM, 'entity.flag', 'tbl_ui000001', { ids: ['obj_crate001'], locked: true }), 'GM locks a crate');
  ok(/locked/.test(run(GM, 'object.move', 'tbl_ui000001', { id: 'obj_crate001', x: 5, z: 5 })?.why), 'locked things do not move');
  ok(/cannot go in a batch/.test(parseArgs('batch', { ops: [{ type: 'undo', args: {} }] }).error), 'undo cannot hide in a batch');
}

// --- Settings (Harry 2026-10-04): self edits, area settings with inheritance, grants, delete, requests ---
{
  S = newCampaign('cmp_test0002', 'Settings'); // a fresh campaign (the blocks above revoke and move seats)
  camp('area.create', { id: 'tbl_main0001', name: 'Inn', visibility: 'open' });
  camp('area.create', { id: 'tbl_secr0001', name: 'GM prep', visibility: 'gm' });
  camp('seat.create', { id: GM, kind: 'human', role: 'gm', name: 'Harry', location: 'tbl_main0001' });
  camp('seat.create', { id: P1, kind: 'human', role: 'player', name: 'Brakka', location: 'tbl_main0001' }, GM);
  camp('seat.create', { id: P2, kind: 'human', role: 'player', name: 'Rogue', location: 'tbl_main0001' }, GM);
  ok(!run(GM, 'token.create', 'tbl_main0001', { id: 'tok_brak0001', name: 'Brakka', x: 10, z: 10, owner: P1 }), 'GM creates Brakka (settings block)');
  ok(!run(P1, 'seat.set', null, { who: P1, name: 'Brakka Stonefist', color: '#33aa66' }), 'a player renames and recolours themselves');
  eq([S.seats[P1].name, S.seats[P1].color], ['Brakka Stonefist', '#33aa66'], 'seat name and colour stored');
  eq(run(P1, 'seat.set', null, { who: P2, name: 'x' })?.code, 'forbidden', "a player may not rename someone else");
  eq(run(P1, 'seat.set', null, { who: P1, invisible: true })?.code, 'forbidden', 'a player may not make themselves invisible');
  eq(run(P1, 'area.set', null, { area: 'tbl_main0001', name: 'Mine' })?.code, 'forbidden', 'a player may not rename areas');
  ok(!run(GM, 'area.set', null, { area: 'tbl_main0001', name: 'The Inn', settings: { light: 'night', freeMoves: false } }), 'GM renames an area and sets its play settings');
  ok(/bad value/.test(run(GM, 'area.set', null, { area: 'tbl_main0001', settings: { light: 'disco' } })?.why), 'unknown values refused');
  ok(/unknown setting/.test(run(GM, 'area.set', null, { area: 'tbl_main0001', settings: { gravity: 2 } })?.why), 'unknown settings refused');
  eq([S.areas.tbl_main0001.name, areaRules(S, 'tbl_main0001').light, areaRules(S, 'tbl_main0001').grid], ['The Inn', 'night', true], 'area settings over built-ins');
  eq(run(P1, 'token.move', 'tbl_main0001', { id: 'tok_brak0001', x: 1, z: 1 })?.code, 'forbidden', 'free moves off: a player cannot move their pawn');
  ok(!run(GM, 'token.move', 'tbl_main0001', { id: 'tok_brak0001', x: 1, z: 1 }), 'the GM still moves it');
  ok(!run(GM, 'campaign.set', null, { defaults: { grid: false, touch: 'none', units: 'm' } }), 'GM sets campaign defaults');
  eq(run(P1, 'campaign.set', null, { defaults: { grid: true } })?.code, 'forbidden', 'players may not set defaults');
  eq([areaRules(S, 'tbl_main0001').grid, areaRules(S, 'tbl_secr0001').grid], [false, false], 'areas inherit the campaign default');
  ok(!run(GM, 'area.set', null, { area: 'tbl_main0001', settings: { grid: true, freeMoves: null } }), 'an area overrides one default and resets another');
  eq([areaRules(S, 'tbl_main0001').grid, areaRules(S, 'tbl_main0001').freeMoves, 'freeMoves' in S.areas.tbl_main0001.settings], [true, true, false], 'override and reset (null = inherit)');
  ok(/locked doors/.test(run(P1, 'object.open', 'tbl_main0001', { id: 'obj_none0001', open: true })?.why || ''), 'touch none (inherited): players cannot open things');
  ok(!run(GM, 'campaign.set', null, { defaults: { touch: null } }), 'GM resets the default');
  ok(!canSee(S, P1, 'tbl_secr0001'), 'GM-only area is hidden from P1');
  ok(!run(GM, 'area.set', null, { area: 'tbl_secr0001', grants: [P1] }) && !canSee(S, P1, 'tbl_secr0001') && !canSee(S, P2, 'tbl_secr0001'), 'grants are retired: a stored grant opens nothing');
  const pv = projectCampaign(S, P1);
  ok(!pv.areas.some(a => a.id === 'tbl_secr0001') && pv.areas.every(a => !('grants' in a) && ['open', 'hidden'].includes(a.visibility)) && projectCampaign(S, GM).areas.find(a => a.id === 'tbl_secr0001').visibility === 'hidden' && pv.defaults.units === 'm', 'the projection carries settings and defaults; an area reads open or hidden (a stored "gm" is hidden)');
  ok(!run(P1, 'request.create', null, { id: 'req_aaaa0001', kind: 'export', note: 'my notes' }), 'a player asks to export');
  ok(!run(P1, 'request.create', null, { id: 'req_aaaa0002', kind: 'import', payload: { v: 1, areas: [] } }), 'a player asks to import (with the file)');
  ok(/only an import/.test(run(P1, 'request.create', null, { id: 'req_aaaa0003', kind: 'export', payload: { x: 1 } })?.why || ''), 'an export carries no payload');
  eq(run(P1, 'request.resolve', null, { id: 'req_aaaa0001', ok: true })?.code, 'forbidden', 'players cannot approve');
  const gv = projectCampaign(S, GM), p2v = projectCampaign(S, P2), p1v = projectCampaign(S, P1);
  ok(gv.requests.length === 2 && gv.requests.find(r => r.id === 'req_aaaa0002').payload && p2v.requests.length === 0 && p1v.requests.length === 2 && !p1v.requests.find(r => r.id === 'req_aaaa0002').payload, 'the GM sees all requests (with payloads); players only their own');
  ok(!run(GM, 'request.resolve', null, { id: 'req_aaaa0002', ok: true }) && S.requests.req_aaaa0002.status === 'approved' && !S.requests.req_aaaa0002.payload, 'GM approves; the payload is dropped');
  ok(/already answered/.test(run(GM, 'request.resolve', null, { id: 'req_aaaa0002', ok: false })?.why || ''), 'a request is answered once');
  ok(!run(GM, 'area.create', null, { id: 'tbl_temp0001', name: 'Temp' }) && !run(GM, 'seat.locate', null, { who: P1, area: 'tbl_temp0001' }), 'GM makes an area and moves P1 there');
  ok(!run(GM, 'area.delete', null, { area: 'tbl_temp0001' }) && !S.areas.tbl_temp0001 && !S.areaOrder.includes('tbl_temp0001') && S.seats[P1].location === S.areaOrder[0], 'GM deletes an area; whoever was there moves to the first area');
  eq(run(P1, 'area.delete', null, { area: 'tbl_main0001' })?.code, 'forbidden', 'players cannot delete areas');
}

// ---- storeys (2026-10-05, docs/VERTICAL.md): height in feet on rooms; storeys derived; walls per height ----
{
  const H = await import('../core/height.js');
  const rg = await loadRoomgen(new URL('../tuner', import.meta.url).pathname, new URL('../tuner-data', import.meta.url).pathname);
  const AID = 'tbl_storey01';
  camp('area.create', { id: AID, name: 'Storeys', visibility: 'open' });
  const GMs = Object.values(S.seats).find(x => x.role === 'gm' && x.kind === 'human').id;
  const spawn = (id, a) => { const T = tbl(AID), L = rg.solve(T.entities, { id, ...a }, T.order + 1); return run(GMs, 'room.spawn', AID, { id, ...a, layout: L }); };
  const B = 'bld_storey001';
  // a flat room made with y absent is byte-for-byte what it was before storeys
  ok(!spawn('room_st_g0001', { building: B, buildingName: 'Inn', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 4242 }), 'ground room');
  const g = tbl(AID).entities.room_st_g0001;
  ok(!('y' in g.recipe) && !('tall' in g.recipe) && !('base' in tbl(AID).entities[B]) && !('storey' in tbl(AID).entities[B]), 'a ground room and its building store no height fields (absent = 0, 10 ft)');
  eq(rg.solve({}, { id: 'room_deploy001', type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 4242 }, 1).hash, '505500e0', 'the flat solve is unchanged (the deploy gate hash)');
  // stacking: same x, z, different heights
  eq(spawn('room_st_x0001', { building: B, type: 'guest', x: 0, z: 0, w: 3, d: 3, seed: 5 })?.why, 'overlaps room room_st_g0001', 'same height, same cells: refused');
  ok(!spawn('room_st_u0001', { building: B, type: 'guest', x: 0, z: 0, w: 3, d: 4, y: 10, seed: 5 }), 'a room on top (y = 10)');
  ok(!spawn('room_st_u0002', { building: B, type: 'guest', x: 3, z: 0, w: 5, d: 4, y: 10, seed: 6 }), 'a second upper room, overhanging the ground floor by two squares');
  ok(/overhang/.test(spawn('room_st_u0003', { building: B, type: 'guest', x: 0, z: 4, w: 3, d: 3, y: 10, seed: 7 })?.why || ''), 'three squares out: refused');
  ok(/nothing to stand on/.test(spawn('room_st_u0004', { building: B, type: 'guest', x: 0, z: 0, w: 3, d: 3, y: 30, seed: 7 })?.why || ''), 'a room two storeys above anything: refused');
  ok(/multiple of 5/.test(spawn('room_st_u0005', { building: B, type: 'guest', x: 0, z: 0, w: 3, d: 3, y: 12, seed: 7 })?.why || '') && /tall/.test(spawn('room_st_u0006', { building: B, type: 'guest', x: 0, z: 0, w: 3, d: 3, y: -10, tall: 9, seed: 7 })?.why || ''), 'heights off the lattice and silly tall values refused');
  ok(!spawn('room_st_d0001', { building: B, type: 'cellar', x: 0, z: 0, w: 4, d: 4, y: -10, seed: 8 }), 'a cellar below (y = -10): below ground anything goes');
  ok(!spawn('room_st_d0002', { type: 'cellar', x: 40, z: 40, w: 3, d: 3, y: -20, seed: 9 }), 'a dungeon room under open ground, with no building');
  const E = () => tbl(AID).entities, r = (id) => E()[id];
  eq([H.storeyOf(E(), g), H.storeyOf(E(), r('room_st_u0001')), H.storeyOf(E(), r('room_st_d0001')), H.storeyOf(E(), r('room_st_d0002'))], [0, 1, -1, -2], 'storeys are derived from height');
  eq([H.fogDefault(E(), g), H.fogDefault(E(), r('room_st_u0001')), H.fogDefault(E(), r('room_st_d0001'))], [null, 0, null], 'no fog by default on the second storey or higher; the ground and below follow their room type (Harry 2026-10-06)');
  eq([0, 1, -1, -2].map(H.levelLabel), ['lv 1', 'lv 2', 'lv -1', 'lv -2'], 'level labels (no lv 0)');
  eq([H.roomTop(E(), g), H.ceilingOf(E(), g), H.ceilingOf(E(), r('room_st_u0001'))], [10, 9, 19], 'a room\'s top and its ceiling (the cut height)');
  ok(H.visibleAt(0, 9) && !H.visibleAt(10, 9) && H.visibleAt(10, 19) && H.visibleAt(30, null) && H.visibleAt(-10, 9) && !H.visibleAt(0, -1), 'the cut rule: base at or below the cut');
  // objects are lifted to their room; a re-roll keeps the height and its pins
  const objs = (id) => Object.values(E()).filter(o => o.kind === 'object' && o.room === id);
  ok(objs('room_st_u0001').length > 1 && objs('room_st_u0001').every(o => o.y >= 10 && o.y < 20) && objs('room_st_d0001').every(o => o.y >= -10 && o.y < 0), 'room furniture carries absolute height');
  { const pin = objs('room_st_u0001')[0]; run(GMs, 'entity.flag', AID, { ids: [pin.id], pinned: true });
    const L = rg.solve(E(), { id: 'room_st_u0001', type: 'guest', seed: 99 }, r('room_st_u0001').order, rg.pinnedOf(E(), 'room_st_u0001'));
    ok(!run(GMs, 'room.reroll', AID, { id: 'room_st_u0001', seed: 99, layout: L }) && objs('room_st_u0001').every(o => o.y >= 10 && o.y < 20) && E()[pin.id] && E()[pin.id].y === pin.y, 're-roll upstairs: still at y = 10, the pinned thing where it was'); }
  // a pawn's floor is derived, never stored
  ok(!run(GMs, 'token.create', AID, { id: 'tok_st_000001', name: 'Climber', x: 7, z: 7 }) && !run(GMs, 'token.move', AID, { id: 'tok_st_000001', x: 7, z: 7, y: 10 }), 'a pawn goes up');
  const f1 = H.tokenFloor(E(), E().tok_st_000001);
  eq([f1.room, f1.storey, f1.level, f1.floorY], ['room_st_u0001', 1, 'lv 2', 10], 'on the upper floor');
  run(GMs, 'token.move', AID, { id: 'tok_st_000001', x: 7, z: 7, y: -10 });
  eq([H.tokenFloor(E(), E().tok_st_000001).room, E().tok_st_000001.y, Object.keys(E().tok_st_000001).filter(k => /floor|storey|level/.test(k)).length], ['room_st_d0001', -10, 0], 'in the cellar (y may be negative); no floor field anywhere on the pawn');
  eq(H.tokenFloor(E(), { x: 7, z: 7, y: 60 }).room, null, 'a flyer far above the roof is on no storey of the building');
  eq([H.floorUnder(E(), 7, 7, 4)?.room, H.floorUnder(E(), 500, 500, 4)], ['room_st_g0001', null], 'floorUnder: the ground room; open ground');
  // walls per height
  const W = rg.edges(E()), lv = (y) => [...W.edges.values()].filter(e => (e.y || 0) === y);
  ok(lv(10).length && lv(10).every(e => e.key.endsWith('@10') && (e.spanKeys || []).every(k => k.endsWith('@10'))) && lv(0).every(e => !e.key.includes('@')) && lv(-10).every(e => e.key.endsWith('@-10')), 'wall keys carry their level off the ground');
  ok(!lv(10).some(e => e.kind === 'door' && e.sides.length === 1) && lv(10).some(e => e.kind === 'door' && e.sides.length === 2) && !lv(-10).some(e => e.kind === 'window' || (e.kind === 'door' && e.sides.length === 1)) && !lv(-20).some(e => e.kind === 'window' || e.kind === 'door') && lv(0).some(e => e.kind === 'door' && e.sides.length === 1), 'upstairs: an inside door, no outside door; below ground: no windows, no outside door; the ground floor keeps its street door');
  ok(W.corners.some(c => c.y === 10) && W.corners.some(c => c.y === -10) && W.corners.some(c => !c.y), 'posts per height');
  ok([...W.edges.keys()].every(k => EDGE_KEY_RE.test(k)) && new Set([...W.edges.keys()].map(edgeId)).size === W.edges.size, 'every key parses and has its own edge id');
  eq([FP.keyBase('h:3:4@-10'), FP.keyLevel('h:3:4@-10'), FP.keyLevel('c3:4'), FP.keyAt('v:1:2', 10), FP.keyAt('v:1:2@10', 0), edgeId('h:-3:4@-10')], ['h:3:4', -10, 0, 'v:1:2@10', 'v:1:2', 'edge_hzm3z4am10'], 'key helpers');
  ok(FP.perimeterKeys(r('room_st_u0001').recipe).every(k => k.endsWith('@10')) && FP.perimeterKeys(g.recipe).every(k => !k.includes('@')), 'perimeterKeys at the room\'s height');
  // wall edits at height: move, turn, hide, delete
  const U = 'room_st_u0001', k0 = `v:0:1@10`;
  ok(!run(GMs, 'edge.set', AID, { key: k0, as: 'open' }) && !run(GMs, 'edge.set', AID, { key: 'v:0:1', as: 'open' }) && E()[edgeId(k0)] && E()[edgeId('v:0:1')], 'the same wall line edited upstairs and on the ground: two separate edits');
  ok(/overlap/.test(run(GMs, 'room.move', AID, { id: U, dx: 3, dz: 0 })?.why || ''), 'an upstairs room cannot be moved into its upstairs neighbour');
  ok(!run(GMs, 'room.rotate', AID, { id: 'room_st_d0002', turns: 1 }) && r('room_st_d0002').recipe.y === -20, 'a turn keeps the height');
  { const before = E(); ok(!run(GMs, 'room.move', AID, { id: 'room_st_d0001', dx: 0, dz: 0, dy: -10 }) && r('room_st_d0001').recipe.y === -20 && objs('room_st_d0001').every(o => o.y >= -20 && o.y < -10), 'room.move dy: the room and its things go down a storey');
    const inv = inverseOf({ ...tbl(AID), entities: before }, 'room.move', { id: 'room_st_d0001', dx: 0, dz: 0, dy: -10 });
    setArea(AID, applyArea(tbl(AID), inv.type, inv.args)); eq(stableStringify(E()), stableStringify(before), 'undo puts it back exactly'); }
  { const before = E(); run(GMs, 'room.move', AID, { id: 'room_st_d0002', dx: 1, dz: 0 }); ok(Object.keys(r('room_st_d0002').recipe).join() === Object.keys(before.room_st_d0002.recipe).join() || r('room_st_d0002').recipe.y === -20, 'a sideways move keeps y'); }
  { const flat = { type: 'common', x: 1, z: 2, w: 3, d: 3, seed: 1, wallSeed: 8, engine: 'v2', engineVersion: '', wallFamily: 'auto', floor: 'auto' };
    let t = { ...newArea('tbl_flat00001', 'f'), entities: { room_flat00001: { id: 'room_flat00001', kind: 'room', recipe: flat, order: 1, building: null, layout: { hash: '', summary: '' }, hidden: false, locked: false } } };
    t = applyArea(t, 'room.move', { id: 'room_flat00001', dx: 2, dz: -1 });
    eq(JSON.stringify(t.entities.room_flat00001.recipe), JSON.stringify({ ...flat, x: 3, z: 1 }), 'moving a flat room writes exactly what it wrote before storeys (same fields, same order)'); }
  ok(!run(GMs, 'entity.flag', AID, { ids: [U], hidden: true }) && E()[edgeId(k0)].hidden && !E()[edgeId('v:0:1')].hidden && objs(U).every(o => o.hidden), 'hiding the upper room hides its things and ITS wall edit, not the ground floor\'s on the same line');
  ok(!run(GMs, 'edge.set', AID, { key: 'v:0:2@10', as: 'open' }) && E()[edgeId('v:0:2@10')].hidden, 'a new wall edit on a hidden room\'s own wall is hidden with it');
  const pv = areaForClient(tbl(AID), false);
  ok(!pv.entities[U] && !pv.entities[edgeId(k0)] && !pv.entities[edgeId('v:0:2@10')] && !Object.values(pv.entities).some(o => o.room === U) && pv.entities.room_st_g0001 && pv.entities.room_st_u0002, 'the player side receives nothing of the hidden upper room; the rest of the storey stays');
  ok(!run(GMs, 'room.delete', AID, { id: U }) && !E()[edgeId(k0)] && !E()[edgeId('v:0:2@10')] && E()[edgeId('v:0:1')], 'deleting the upper room takes its wall edits; the ground floor\'s stay');
  // buildings: base and storey height
  ok(!run(GMs, 'building.set', AID, { id: B, storey: 15 }) && tbl(AID).entities[B].storey === 15 && tbl(AID).entities[B].name === 'Inn', 'a building\'s storey height is settable; its name is untouched');
  eq([H.roomHeight(E(), g), H.storeyOf(E(), r('room_st_u0002'))], [15, 0], 'storey height and storeys follow the building (rooms do not move)');
  ok(/multiple of 5/.test(run(GMs, 'building.set', AID, { id: B, storey: 12 })?.why || '') && /nothing to set/.test(run(GMs, 'building.set', AID, { id: B })?.why || '') && !run(GMs, 'building.set', AID, { id: B, storey: 10, base: 0 }) && !('storey' in E()[B]) && !('base' in E()[B]), 'bad values refused; the defaults are stored as nothing');
  eq(H.buildingAt(E(), { x: 3, z: 0, w: 2, d: 2 }, [20, 30]), B, 'a new room stacked on the upper floor joins the building below it');
  eq(H.buildingAt(E(), { x: 100, z: 100, w: 2, d: 2 }, [0, 10]), null, 'a room touching nothing joins none');
  ok(H.levelsOf(E(), B).map(l => l.level).join() === 'lv -1,lv 1,lv 2', 'a building\'s levels');
  // labels: a building's heights reach a label-blind seat, its name does not
  { const { stripEntry } = await import('../core/labels.js');
    eq(stripEntry({ type: 'building.set', args: { id: B, name: 'Secret keep', base: 5 } }, tbl(AID)).args, { id: B, base: 5 }, 'building.set to a label-blind seat: heights travel, the name does not');
    eq(stripEntry({ type: 'building.set', args: { id: B, name: 'Secret keep' } }, tbl(AID)).type, 'entities.set', 'a bare rename is still a no-op for them'); }
  // ROOFS (Stage F): only the style and a few choices are data; the roof itself is derived
  { const { stripEntry } = await import('../core/labels.js'), G = 'room_st_g0001', fam = (f) => () => f;
    eq([H.roofStyleOf(E(), r(G), fam('half-timber')), H.roofStyleOf(E(), r(G), fam('dressed-stone')), H.roofStyleOf(E(), r(G), fam('rough-timber')), H.roofStyleOf(E(), r(G))], ['tile', 'slate', 'thatch', 'thatch'], 'with nothing set a roof takes its style from the wall family (thatch when unknown)');
    ok(!run(GMs, 'building.set', AID, { id: B, roof: 'slate' }) && E()[B].roof === 'slate' && E()[B].name === 'Inn' && H.roofStyleOf(E(), r(G), fam('half-timber')) === 'slate', 'building.set roof: the building\'s style wins over the wall family; its name is untouched');
    ok(!run(GMs, 'room.set', AID, { id: G, roof: { style: 'tile', seed: 7 } }) && r(G).roof.style === 'tile' && r(G).roof.seed === 7 && H.roofStyleOf(E(), r(G), fam('half-timber')) === 'tile' && H.roofStyleOf(E(), r('room_st_u0002'), fam('half-timber')) === 'slate', 'room.set roof: one room\'s own style and seed; its neighbours keep the building\'s');
    ok(!run(GMs, 'room.set', AID, { id: G, roof: { off: true } }) && r(G).roof.off === true && r(G).roof.style === 'tile', 'roof.off is merged in, the other choices stay');
    ok(!run(GMs, 'room.set', AID, { id: G, roof: { style: 'auto', seed: 0, off: false } }) && !('roof' in r(G)), 'back to the defaults: the field is removed (a room with no choices carries none)');
    ok(/one of thatch/.test(run(GMs, 'room.set', AID, { id: G, roof: { style: 'gold' } })?.why || '') && /unknown field/.test(run(GMs, 'room.set', AID, { id: G, roof: { colour: 'red' } })?.why || '') && /integer/.test(run(GMs, 'room.set', AID, { id: G, roof: { seed: 1.5 } })?.why || '') && /one of thatch/.test(run(GMs, 'building.set', AID, { id: B, roof: 'gold' })?.why || ''), 'bad roof values are refused with the list of styles');
    eq(stripEntry({ type: 'building.set', args: { id: B, name: 'Secret keep', roof: 'tile' } }, tbl(AID)).args, { id: B, roof: 'tile' }, 'building.set to a label-blind seat: the roof style travels, the name does not');
    ok(!run(GMs, 'building.set', AID, { id: B, roof: 'auto' }) && !('roof' in E()[B]), 'roof=auto on a building goes back to its walls\' style (the field is removed)');
    const inv = inverseOf(tbl(AID), 'room.set', { id: G, roof: { style: 'slate' } }); run(GMs, 'room.set', AID, { id: G, roof: { style: 'slate' } });
    ok(r(G).roof?.style === 'slate' && inv.type === 'entities.set' && inv.args.set[G] && !('roof' in inv.args.set[G]) && !('roof' in applyArea(tbl(AID), inv.type, inv.args).entities[G]), 'undo of a roof change puts the room back exactly'); }
}

// ---- stairs (2026-10-05, docs/VERTICAL.md "Getting up and down"): vertical connectors, core/stairs.js ----
{
  const S = await import('../core/stairs.js'), H = await import('../core/height.js');
  const rg = await loadRoomgen(new URL('../tuner', import.meta.url).pathname, new URL('../tuner-data', import.meta.url).pathname);
  const B = 'bld_stair00001', LOW = 'room_stlow0001', UP = 'room_stup00001', CEL = 'room_stcel0001';
  let A = newArea('area_stairs01', 'stairs');
  const spawn = (a, extra = A.entities) => { A = applyArea(A, 'room.spawn', { ...a, layout: rg.solve(extra, a, A.order + 1) }); };
  const stubOf = (a) => ({ id: a.id, kind: 'room', recipe: { ...a }, building: a.building, order: A.order + 1 });
  const lowA = { id: LOW, type: 'common', x: 0, z: 0, w: 6, d: 4, seed: 6, building: B, buildingName: 'Inn' }; spawn(lowA);
  const low0 = Object.values(A.entities).filter(o => o.kind === 'object' && o.room === LOW).length;
  eq(S.planStair(A.entities, A.entities[LOW]), null, 'a ground-floor room gets no stair');
  // the upper room: plan first (against a stub), furnish with the hole kept clear, then the room, then the stair
  const upA = { id: UP, type: 'guest', x: 0, z: 0, w: 4, d: 4, y: 10, seed: 56, building: B }, stub = stubOf(upA);
  const P = rg.stairFor({ ...A.entities, [UP]: stub }, stub), P2 = rg.stairFor({ ...A.entities, [UP]: stub }, stub);
  ok(P && P.kind === 'straight' && P.from === LOW && P.to === UP && P.args.place === 'kit' && P.args.down === true && S.stairRise({ kind: 'object', ...P.args }) === 10 && S.isPlacedStair({ kind: 'object', ...P.args }) && P.args.room === LOW && P.args.y === 0 && /^stair-/.test(P.args.cat) && P.args.url, 'a new upper room is planned a stair up from the room it stands on: an ORDINARY placed stair (a real catalog piece, put in for the room above)', JSON.stringify(P?.args));
  eq(JSON.stringify(P.args), JSON.stringify(P2.args), 'the plan is deterministic');
  const st = { id: 'obj_stair00001', ...P.args };
  spawn(upA, { ...A.entities, [st.id]: { kind: 'object', ...st } });
  const beforeStair = A;
  ok(!REGISTRY['object.place'].check({ area: A }, st), 'the stair is an ordinary object.place'); A = applyArea(A, 'object.place', st);
  const s1 = A.entities[st.id], cells = S.stairCells(s1), ends = S.stairEnds(s1);
  ok(s1.place === 'kit' && !S.isStair(s1) && S.isPlacedStair(s1) && s1.down === true && S.stairRise(s1) === 10 && S.stairStatus(A.entities, s1).code === null && s1.room === LOW && cells.length === 2 && cells.every(([gx, gz]) => FP.hasCell(A.entities[LOW].recipe, gx, gz) && FP.hasCell(A.entities[UP].recipe, gx, gz)), 'it stands on two squares that are in BOTH rooms (its footprint is reserved on both floors)', JSON.stringify(cells));
  eq([...S.holesAt(A.entities, 10)].sort(), cells.map(c => c.join(':')).sort(), 'the hole in the floor above is exactly its squares');
  eq(S.holesAt(A.entities, 0).size, 0, 'and there is none in the floor it stands on');
  ok(FP.hasCell(A.entities[LOW].recipe, ...ends.footCell) && FP.hasCell(A.entities[UP].recipe, ...ends.topCell) && ends.foot.y === 0 && ends.top.y === 10, 'its foot landing is in the lower room, its top landing in the upper room', JSON.stringify(ends));
  eq(S.stairLinks(A.entities, s1), { from: LOW, to: UP }, 'it joins the two rooms');
  const onCells = (objs, cs) => objs.filter(o => !o.parent && o.place !== 'ceiling' && o.place !== 'wall' && !o.flat && cs.some(([gx, gz]) => o.x > gx * 5 + 0.3 && o.x < gx * 5 + 4.7 && o.z > gz * 5 + 0.3 && o.z < gz * 5 + 4.7));
  const things = (rid) => Object.values(A.entities).filter(o => o.kind === 'object' && o.room === rid && !S.isConnector(o));
  eq(onCells(things(UP), [...cells, ends.topCell]).map(o => o.cat), [], 'the upper room is furnished clear of the hole and the top landing');
  eq(onCells(things(LOW), cells).map(o => o.cat), [], 'nothing of the lower room was under it (it removes nothing)');
  eq(things(LOW).length, low0, 'and nothing was removed');
  eq(S.planStair(A.entities, A.entities[UP]), null, 'a room that has its stair gets no second one');
  // undo order: the stair is its own command
  { const inv = inverseOf(beforeStair, 'object.place', st); const back = applyArea(A, inv.type, inv.args); ok(!back.entities[st.id] && back.entities[UP] && S.holesAt(back.entities, 10).size === 0, 'undoing the stair removes just the stair (the room stays, the floor is whole again)'); }
  // Stage G: a tall room (room.tall): refused when a room above is in the way; allowed otherwise; back to 1 removes the field
  { const chk = (t, a) => REGISTRY['room.tall'].check({ area: t }, a);
    ok(/room above/.test(chk(A, { id: LOW, tall: 2 }) || ''), 'a room with a room above it cannot be made taller (it would run into it)', chk(A, { id: LOW, tall: 2 }));
    eq(chk(A, { id: UP, tall: 2 }), null, 'the top room can');
    const T2 = applyArea(A, 'room.tall', { id: UP, tall: 2 }); eq(T2.entities[UP].recipe.tall, 2, 'it stores how many storeys it spans');
    ok(/1 to 6/.test(chk(A, { id: UP, tall: 9 }) || ''), 'at most six storeys');
    const T1 = applyArea(T2, 'room.tall', { id: UP, tall: 1 }); ok(!('tall' in T1.entities[UP].recipe), 'one storey again: the field is gone (an ordinary room, byte for byte)'); }
  // Stage G: deleting the room a stair came up into takes the stair too (it would lead to open air); one undo restores both
  { const inv = inverseOf(A, 'room.delete', { id: UP }), gone = applyArea(A, 'room.delete', { id: UP }), back = applyArea(gone, inv.type, inv.args);
    ok(!gone.entities[UP] && !gone.entities[st.id] && gone.entities[LOW], 'deleting the upper room deletes the stair that came up into it');
    ok(back.entities[UP] && back.entities[st.id] && S.holesAt(back.entities, 10).size === cells.length, 'one undo brings back the room and its stair');
    const pinned = applyArea(A, 'entity.flag', { ids: [st.id], pinned: true }); ok(applyArea(pinned, 'room.delete', { id: UP }).entities[st.id], 'a pinned stair stays'); }
  // a pawn crosses
  eq(S.stairHop(A.entities, s1.x, s1.z, 0), { ...ends.top, stair: st.id }, 'a pawn dropped on the stair from below goes to the top landing, at the upper floor\'s height');
  eq(S.stairHop(A.entities, s1.x, s1.z, 10), { ...ends.foot, stair: st.id }, 'dropped on the hole from above, to the foot');
  eq(S.stairHop(A.entities, ends.foot.x, ends.foot.z, 0), null, 'a landing is just floor');
  { const t = { x: ends.top.x, z: ends.top.z, y: ends.top.y }; eq([H.tokenFloor(A.entities, t).room, H.tokenFloor(A.entities, t).level], [UP, 'lv 2'], 'and upstairs the pawn\'s floor is DERIVED: the upper room, lv 2'); }
  // re-roll either room: the stair stays, furniture keeps off it
  for (const [rid, cs, what] of [[LOW, [...cells, ends.footCell], 'lower'], [UP, [...cells, ends.topCell], 'upper']]) {
    const L = rg.solve(A.entities, { id: rid, type: A.entities[rid].recipe.type, seed: 4242 }, A.entities[rid].order, rg.pinnedOf(A.entities, rid));
    eq(onCells(L.objects, cs).map(o => o.cat), [], `a re-roll of the ${what} room keeps its furniture off the stair and its landing`);
    const R = applyArea(A, 'room.reroll', { id: rid, seed: 4242, layout: L });
    ok(R.entities[st.id] && R.entities[st.id].x === s1.x, `and the stair survives the ${what} room's re-roll`);
    ok(!REGISTRY['room.reroll'].touches({ id: rid, seed: 1, layout: L }, A).includes(st.id), `(it is not among the things a ${what} re-roll touches)`);
  }
  // moving it moves the hole; turning keeps quarter turns
  { const M = applyArea(A, 'object.move', { id: st.id, x: s1.x + 5, z: s1.z }); ok([...S.holesAt(M.entities, 10)].sort().join() !== [...S.holesAt(A.entities, 10)].sort().join() && S.holesAt(M.entities, 10).size === 2, 'moving the stair moves the hole'); }
  { const Z = rg.sizeOf('stair-straight', 'stair-straight--dressed-stone--t10'), R = applyArea(A, 'object.replace', { id: st.id, cat: 'stair-straight', sku: Z.sku, url: Z.url, dims: Z.dims, s: Z.s, yaw: Z.yaw }); eq([[...S.holesAt(R.entities, 10)].sort(), R.entities[st.id].down, S.stairStatus(R.entities, R.entities[st.id]).code], [[...S.holesAt(A.entities, 10)].sort(), true, null], 'swapped for the stone flight it is the same stair: same hole, still leading the same way'); }
  ok(/rise/.test(REGISTRY['object.place'].check({ area: A }, { ...st, id: 'obj_stair00009', rise: 7 }) || ''), 'a rise that is not a multiple of 5 ft is refused');
  // hidden: with either room it joins
  { let Hd = applyArea(A, 'entity.flag', { ids: [UP], hidden: true });
    ok(Hd.entities[st.id].hidden && REGISTRY['entity.flag'].touches({ ids: [UP], hidden: true }, A).includes(st.id), 'hiding the UPPER room hides the stair up to it (it belongs to the lower room)');
    const pv = areaForClient(Hd, false);
    ok(!pv.entities[st.id] && !pv.entities[UP] && pv.entities[LOW] && S.holesAt(pv.entities, 10).size === 0 && S.stairsOf(pv.entities).length === 0, 'a player gets the lower room and no trace of the stair or the hole');
    const Hd2 = applyArea(Hd, 'entity.flag', { ids: [LOW], hidden: true }), R1 = applyArea(Hd2, 'entity.flag', { ids: [LOW], hidden: false });
    ok(R1.entities[st.id].hidden && !R1.entities[LOW].hidden, 'revealing the lower room while the upper stays hidden keeps the stair hidden');
    const R2 = applyArea(R1, 'entity.flag', { ids: [UP], hidden: false }); ok(!R2.entities[st.id].hidden, 'revealing the upper room too shows the stair');
    const Hl = applyArea(A, 'entity.flag', { ids: [LOW], hidden: true }); ok(Hl.entities[st.id].hidden && S.holesAt(areaForClient(Hl, false).entities, 10).size === 0, 'hiding the LOWER room hides it too: players see a whole floor upstairs');
    const P3 = applyArea(applyArea(Hd, 'object.delete', { id: st.id }), 'object.place', { ...st, id: 'obj_stair00002' }); ok(P3.entities.obj_stair00002.hidden, 'a stair placed up to a hidden room is hidden from the start'); }
  // a cellar: a stair from it up into the room above, or onto open ground
  const celA = { id: CEL, type: 'cellar', x: 0, z: 0, w: 3, d: 3, y: -10, seed: 3, building: B }, cstub = stubOf(celA);
  const PC = rg.stairFor({ ...A.entities, [CEL]: cstub }, cstub);
  ok(PC && PC.from === CEL && PC.to === LOW && PC.args.y === -10 && PC.args.room === CEL && !PC.args.down && S.stairRise({ kind: 'object', ...PC.args }) === 10, 'a cellar under a room is planned a stair up into that room', JSON.stringify(PC && [PC.kind, PC.from, PC.to, PC.why || rg.stairFor.why]));
  { const cst = { id: 'obj_stair00003', ...PC.args }; spawn(celA, { ...A.entities, [cst.id]: { kind: 'object', ...cst } }); A = applyArea(A, 'object.place', cst);
    ok(S.holesAt(A.entities, 0).size >= 1 && S.stairLinks(A.entities, A.entities[cst.id]).to === LOW, 'it cuts its hole in the ground floor above'); }
  { const lone = { id: 'room_stdun0001', type: 'cellar', x: 40, z: 40, w: 3, d: 3, y: -10, seed: 4, building: 'bld_stair00002' }, ls = stubOf(lone), PL = rg.stairFor({ ...A.entities, [lone.id]: ls }, ls);
    ok(PL && PL.from === lone.id && PL.to === null && S.stairRise({ kind: 'object', ...PL.args }) === 10, 'a dungeon room under open ground is planned a stair up to the ground', JSON.stringify(PL && [PL.kind, PL.to])); }
  { const info = S.stairInfo(A.entities, A.entities[st.id]); ok(info.from === LOW && info.to === UP && info.fromLevel === 'lv 1' && info.toLevel === 'lv 2' && info.cells.length === 2 && info.top[2] === 10 && info.bottom[2] === 0, 'what a seat is told about a stair: rooms, levels, squares in feet, both ends', JSON.stringify(info)); }
  // 30 upper rooms over furnished rooms: every plan is clear of furniture, in both rooms' squares, with both landings
  { let planned = 0, flights = 0, bad = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let T = newArea('area_stairs02', 't'); const a1 = { id: 'room_stt0000001', type: ['common', 'kitchen', 'guest'][seed % 3], x: 0, z: 0, w: 6, d: 4, seed, building: B };
      T = applyArea(T, 'room.spawn', { ...a1, layout: rg.solve(T.entities, a1, 1) });
      const a2 = { id: 'room_stt0000002', type: 'guest', x: 0, z: 0, w: 4 + seed % 3, d: 4, y: 10, seed: seed + 50, building: B }, sb = { id: a2.id, kind: 'room', recipe: a2, building: B, order: 2 };
      const Q = rg.stairFor({ ...T.entities, [a2.id]: sb }, sb); if (!Q) continue;
      planned++; if (Q.kind === 'straight') flights++;
      const so = { id: 'obj_sttest0001', kind: 'object', ...Q.args }, cs = S.stairCells(so), en = S.stairEnds(so), lowObjs = Object.values(T.entities).filter(o => o.kind === 'object' && o.room === a1.id);
      if (!cs.every(([gx, gz]) => FP.hasCell(a1, gx, gz) && FP.hasCell(a2, gx, gz)) || !FP.hasCell(a1, ...en.footCell) || !FP.hasCell(a2, ...en.topCell) || onCells(lowObjs, cs).length) bad++;
    }
    ok(planned >= 24 && bad === 0, `over 30 furnished inns: a stair or ladder is found in most (${planned}/30, ${flights} flights), never on furniture, never outside either room`, `bad ${bad}`); }
}

// ---------------- 2026-10-06: the pieces storeys generate are things of their own (supports, railings, tall walls) ----------------
{
  const HT = await import('../core/height.js'), S = await import('../core/stairs.js');
  const B = 'bld_piece00001', LOW = 'room_pclow0001', UP = 'room_pcup00001';
  const room = (id, x, z, w, d, y = 0, extra = {}) => ({ id, kind: 'room', recipe: { type: 'common', x, z, w, d, ...(y && { y }), seed: 1, wallFamily: 'auto', ...extra }, building: B, order: y ? 2 : 1 });
  // a 6 x 4 room at x 10; above it a 9 x 4 room from x 9: one square out to the west, two to the east
  let A = newArea('area_piece001', 'p'); A = { ...A, entities: { [B]: { id: B, kind: 'building', name: 'Inn' }, [LOW]: room(LOW, 10, 0, 6, 4), [UP]: room(UP, 9, 0, 9, 4, 10) } };
  const P = HT.supportPlan(A.entities, A.entities[UP]);
  eq(P.brackets.map(b => b.key).sort(), ['jv:10:0@10', 'jv:10:1@10', 'jv:10:2@10', 'jv:10:3@10', 'jv:16:0@10', 'jv:16:1@10', 'jv:16:2@10', 'jv:16:3@10'], 'a bracket per 5 ft under each square one out, keyed by the wall edge it leans on at the upper floor\'s height');
  eq(P.posts.map(p => [p.key, p.y0, p.inn]).sort(), [['p18:0@10', 0, [-1, 1]], ['p18:2@10', 0, [-1, 0]], ['p18:4@10', 0, [-1, -1]]], 'posts under the outer edge of a two-square overhang: its corners and every 10 ft, each knowing which way its floor lies');
  ok(HT.supportPlan(A.entities, A.entities[LOW]).posts.length === 0 && HT.supportKeys(A.entities, A.entities[UP]).length === 11, 'a ground room has no supports; supportKeys lists all eleven');
  ok(HT.isStoneFamily('castle-rough') && HT.isStoneFamily('crypt-stone') && HT.isStoneFamily('dressed-stone') && HT.isStoneFamily('fieldstone') && !HT.isStoneFamily('half-timber') && !HT.isStoneFamily('rough-timber') && !HT.isStoneFamily('noble-panel') && !HT.isStoneFamily('log-cabin'), 'stone or timber by wall family: a castle and a crypt are stone');
  for (const k of ['jv:10:0@10', 'jh:-3:4@10', 'p18:4@10', 'p-2:-7@-10', 'rh:3:4@10', 'rv:3:4', 'h:3:4@20', 'c3:4@20']) ok(EDGE_KEY_RE.test(k), `edge key ${k} is accepted`);
  for (const k of ['x:1:2', 'jc1:2', 'ph:1:2', 'rr:1:2', 'j:1:2']) ok(!EDGE_KEY_RE.test(k), `edge key ${k} is refused`);
  ok(new Set(['jv:10:0@10', 'v:10:0@10', 'rv:10:0@10', 'p10:0@10', 'c10:0@10'].map(edgeId)).size === 5, 'a bracket, a wall, a railing and the two kinds of post at one spot have five different ids');
  // an edit of a support is the room's own: it is dropped with the room, moves with it, turns with it, hides with it
  let D = applyArea(A, 'edge.set', { key: 'p18:2@10', as: 'open' }); D = applyArea(D, 'edge.set', { key: 'jv:10:1@10', as: 'open' });
  ok(D.entities[edgeId('p18:2@10')] && !D.entities[edgeId('p18:2@10')].hidden, 'a post is deleted with an edge override on its key');
  const moved = applyArea(applyArea(D, 'room.move', { id: LOW, dx: 2, dz: 4 }), 'room.move', { id: UP, dx: 2, dz: 0 }); // (the room below first, and off line: whose the edit is does not depend on what is generated at that moment)
  ok(moved.entities[edgeId('p20:2@10')] && !moved.entities[edgeId('p18:2@10')] && moved.entities[edgeId('jv:12:1@10')] && !moved.entities[edgeId('jv:10:1@10')], 'moving the upper room carries its support edits to the new squares');
  const up2 = applyArea(D, 'room.move', { id: UP, dx: 0, dz: 0, dy: 0 }); ok(up2.entities[edgeId('p18:2@10')], 'a move by nothing keeps them');
  const gone = applyArea(D, 'room.delete', { id: UP }); ok(!gone.entities[edgeId('p18:2@10')] && !gone.entities[edgeId('jv:10:1@10')], 'deleting the upper room drops its support edits (a later room there gets fresh supports)');
  ok(REGISTRY['room.delete'].touches({ id: UP }, D).includes(edgeId('p18:2@10')), 'and names them in what it touches (undo restores them)');
  const hid = applyArea(D, 'entity.flag', { ids: [UP], hidden: true }); ok(hid.entities[edgeId('p18:2@10')].hidden && hid.entities[edgeId('jv:10:1@10')].hidden, 'hiding the upper room hides the edits of its supports');
  ok(!areaForClient(hid, false).entities[edgeId('p18:2@10')], 'so a player is not sent them');
  const H2 = applyArea(applyArea(A, 'entity.flag', { ids: [UP], hidden: true }), 'edge.set', { key: 'p18:0@10', as: 'open' }); ok(H2.entities[edgeId('p18:0@10')].hidden, 'a NEW edit of a hidden room\'s support is hidden from the start');
  // a materialized support is an object with fromEdge: its key rides along on a move and a turn
  const obj = { id: 'obj_piece00001', name: 'Post', cat: 'post-timber', sku: 'post-timber--plain', url: 'assets/m/post-timber--plain.glb', place: 'kit', layer: 'walls', x: 89.4, y: 0, z: 10, dims: [2.1, 9, 2.1], room: UP, fromEdge: 'p18:2@10' };
  const M = applyArea(applyArea(D, 'object.place', obj), 'room.move', { id: UP, dx: 1, dz: 0 }); ok(M.entities[obj.id].fromEdge === 'p19:2@10' && M.entities[obj.id].x === 94.4, 'a post that became an object moves with its room, its key with it');
  { const sq = { [B]: A.entities[B], r: room('room_pcsq000001', 0, 0, 4, 4, 10) }; let T = { ...A, entities: { ...sq, room_pcsq000001: sq.r } }; delete T.entities.r;
    T = applyArea(T, 'object.place', { ...obj, id: 'obj_piece00002', room: 'room_pcsq000001', x: 10, z: 0, fromEdge: 'jh:2:0@10' }); T = applyArea(T, 'edge.set', { key: 'p0:0@10', as: 'open' });
    const R = applyArea(T, 'room.rotate', { id: 'room_pcsq000001', turns: 1 });
    ok(/^jv:\d+:\d+@10$/.test(R.entities.obj_piece00002.fromEdge), 'a turn of the room turns a bracket\'s key (an h edge becomes a v edge, the j kept)', R.entities.obj_piece00002.fromEdge); }
  // RAILINGS: every open side of the hole but the way out
  const stair = { id: 'obj_pcstair001', kind: 'object', place: 'stair', stair: 'straight', rise: 10, x: 65, y: 0, z: 12.5, rot: Math.PI / 2, dims: [4.4, 10, 10], room: LOW }; // squares (12,2) and (13,2), climbing toward +x
  let R = { ...A, entities: { ...A.entities, [stair.id]: stair } };
  const rails = S.stairRails(R.entities, stair);
  eq(rails.map(r => r.key).sort(), ['rh:12:2@10', 'rh:12:3@10', 'rh:13:2@10', 'rh:13:3@10', 'rv:12:2@10'], 'a flight in the middle of the floor: both long sides and the low end railed; the top end (the way out) open');
  ok(rails.every(r => r.room === UP && r.y === 10 && r.stair === stair.id) && rails.find(r => r.key === 'rv:12:2@10').rot !== 0 && rails.find(r => r.key === 'rh:12:2@10').rot === 0, 'each section is on the upper floor, the upper room\'s, and runs along its edge');
  { const byWall = { ...stair, z: 2.5 }, rw = S.stairRails({ ...R.entities, [stair.id]: byWall }, byWall).map(r => r.key).sort();
    eq(rw, ['rh:12:1@10', 'rh:13:1@10', 'rv:12:0@10'], 'against the room\'s wall there is no railing on the wall side'); }
  { const turned = { ...stair, rot: -Math.PI / 2 }, rt = S.stairRails({ ...R.entities, [stair.id]: turned }, turned).map(r => r.key).sort();
    eq(rt, ['rh:12:2@10', 'rh:12:3@10', 'rh:13:2@10', 'rh:13:3@10', 'rv:14:2@10'], 'turned round, the open end turns with it'); }
  { const cel = room('room_pccel0001', 30, 30, 3, 3, -10), cs = { ...stair, id: 'obj_pcstair002', x: 157.5, y: -10, z: 160, rot: 0, room: cel.id };
    ok(S.stairRails({ ...R.entities, [cel.id]: cel, [cs.id]: cs }, cs).length === 0, 'a stair that comes up onto open ground gets no railing'); }
  ok(S.railsOf(R.entities, UP).length === 5 && S.railsOf(R.entities, LOW).length === 0, 'railsOf by room: the room whose floor has the hole');
  let RD = applyArea(R, 'edge.set', { key: 'rh:12:2@10', as: 'open' });
  ok(!applyArea(RD, 'room.delete', { id: UP }).entities[edgeId('rh:12:2@10')], 'a railing edit goes with its room');
  ok(applyArea(applyArea(R, 'entity.flag', { ids: [UP], hidden: true }), 'edge.set', { key: 'rh:12:2@10', as: 'open' }).entities[edgeId('rh:12:2@10')].hidden, 'and is hidden with a hidden room');
  // TALL: an upper wall piece of a tall room is edited by the wall key at its own height
  let T = { ...A, entities: { [B]: A.entities[B], room_pctall001: room('room_pctall001', 0, 0, 3, 3, 0, { tall: 2 }) } };
  T = applyArea(T, 'edge.set', { key: 'h:0:0@10', as: 'open' });
  ok(!applyArea(T, 'room.delete', { id: 'room_pctall001' }).entities[edgeId('h:0:0@10')] && applyArea(T, 'room.move', { id: 'room_pctall001', dx: 1, dz: 0 }).entities[edgeId('h:1:0@10')], 'a tall room\'s upper wall edit goes with the room and moves with it');
  ok(applyArea(applyArea(T, 'entity.flag', { ids: ['room_pctall001'], hidden: true }), 'edge.set', { key: 'c0:0@10', as: 'open' }).entities[edgeId('c0:0@10')].hidden, 'and a new one on a hidden tall room is hidden');
}

// --- the pawn's ring (Harry 2026-10-06): damage for everyone, indicators, the sheet link, notes, GM notes, give control ---
{
  const { parseDamage, damageReadout, damageAfter, damageLine, sheetProblem, cleanSheet, sheetHost, seesDamageUndo, MARK_KEYS } = await import('../core/pawn.js');
  const { migratePawn, migratePawns } = await import('../core/migrate.js');
  const { unnoteEntry, unnoteEntity, unnoteEntities } = await import('../core/labels.js');
  const A = 'tbl_main0001';
  ok(!run(GM, 'token.create', A, { id: 'tok_ring00001', name: 'Brakka', x: 1, z: 1, owner: P1, damage: 7 }) && !run(GM, 'token.create', A, { id: 'tok_ring00002', name: 'Goblin', x: 6, z: 1 }), 'ring pawns made');
  const T = (id) => tbl(A).entities[id];
  // DAMAGE counts up from 0; anyone, any pawn
  ok(T('tok_ring00001').damage === 7 && !('damage' in T('tok_ring00002')) && !('hp' in T('tok_ring00001')) && !('hpMax' in T('tok_ring00002')), 'a pawn carries damage (absent = 0 = unhurt) and no hit points');
  ok(!run(P2, 'token.damage', A, { id: 'tok_ring00001', damage: 14 }) && T('tok_ring00001').damage === 14, "a player changes another player's pawn's damage (token.damage)");
  ok(!run(P1, 'token.damage', A, { id: 'tok_ring00002', damage: 3 }) && T('tok_ring00002').damage === 3 && !run(P1, 'token.damage', A, { id: 'tok_ring00002', damage: 0 }) && !('damage' in T('tok_ring00002')), "a player sets the GM's monster's damage; back at 0 the field goes");
  ok(run(P1, 'token.damage', A, { id: 'tok_ring00002', damage: -1 })?.code === 'invalid' && run(P1, 'token.damage', A, { id: 'tok_ring00002', damage: 10000 })?.code === 'invalid' && run(P1, 'token.damage', A, { id: 'tok_nope000001', damage: 1 })?.code === 'invalid', 'damage below 0, above the limit, or on no pawn is refused');
  ok(/damage now/.test(run(P1, 'token.set', A, { id: 'tok_ring00001', hp: 5 })?.why || '') && /damage now/.test(run(GM, 'token.create', A, { id: 'tok_ring00009', name: 'x', x: 0, z: 0, hp: 5, hpMax: 9 })?.why || '') && /damage now/.test(run(GM, 'token.set', A, { id: 'tok_ring00001', hpMax: 40 })?.why || ''), 'a live command that still sends hp or hpMax is refused, with the reason');
  ok(/belongs/.test(run(P2, 'token.set', A, { id: 'tok_ring00001', name: 'Mine' })?.why || ''), 'but a name, the notes, the sheet stay the owner\'s (token.set)');
  setArea(A, applyArea(tbl(A), 'entity.flag', { ids: ['tok_ring00002'], hidden: true }));
  ok(run(P1, 'token.damage', A, { id: 'tok_ring00002', damage: 1 })?.code === 'invalid' && run(P1, 'token.mark', A, { id: 'tok_ring00002', mark: 'skull' })?.code === 'invalid', 'a pawn hidden from players does not exist for their damage or indicators');
  setArea(A, applyArea(tbl(A), 'entity.flag', { ids: ['tok_ring00002'], hidden: false }));
  // old data: hit points become damage (core/migrate.js)
  eq([migratePawn({ kind: 'token', id: 'a', hp: 16, hpMax: 30 }), migratePawn({ kind: 'token', id: 'a', hp: 30, hpMax: 30 }), migratePawn({ kind: 'token', id: 'a', hp: null, hpMax: null, name: 'n' }), migratePawn({ kind: 'token', id: 'a', hp: 12, hpMax: null }), migratePawn({ kind: 'token', id: 'a', hp: 40, hpMax: 30 })],
    [{ kind: 'token', id: 'a', damage: 14 }, { kind: 'token', id: 'a' }, { kind: 'token', id: 'a', name: 'n' }, { kind: 'token', id: 'a' }, { kind: 'token', id: 'a' }], 'an old pawn: damage = max - hp where it had both; 0 otherwise; hp and hpMax go');
  { const fresh = { kind: 'token', id: 'a', damage: 3 }, obj = { kind: 'object', id: 'o', hp: 1 }; ok(migratePawn(fresh) === fresh && migratePawn(obj) === obj && migratePawn(migratePawn({ kind: 'token', id: 'a', hp: 1, hpMax: 9 })).damage === 8, 'the conversion is idempotent and touches only pawns'); }
  { // the legacy arguments still REPLAY (apply runs on replay; check does not), and the result converts
    let L = applyArea(tbl(A), 'token.create', { id: 'tok_old0000001', name: 'Old', x: 0, z: 0, hp: 20, hpMax: 20 });
    L = applyArea(L, 'token.set', { id: 'tok_old0000001', hp: 13 });
    const rt = { state: { areas: { [A]: L } }, undo: new Map([[A, [{ inv: { type: 'entities.set', args: { set: { tok_old0000001: { kind: 'token', id: 'tok_old0000001', hp: 20, hpMax: 20 } } } } }]]]), redo: new Map(), tails: new Map([[A, [{ type: 'token.create', args: { id: 'tok_old0000001', name: 'Old', x: 0, z: 0, hp: 15, hpMax: 20 } }, { type: 'batch', args: { ops: [{ type: 'token.set', args: { id: 'tok_old0000001', hp: 13 } }] } }]]]) };
    const n = migratePawns(rt), e = rt.state.areas[A].entities.tok_old0000001;
    ok(n > 0 && e.damage === 7 && !('hp' in e) && !('hpMax' in e) && !/"hp(Max)?"/.test(JSON.stringify([...rt.undo, ...rt.tails])) && rt.tails.get(A)[0].args.damage === 5 && migratePawns(rt) === 0, 'an old journal replays as written, then everything in memory converts: the state, the undo stack, the log tail (20 max, hp 13 -> 7 damage); a second pass does nothing');
  }
  // THE PAWN LOCK IS DROPPED (Harry 2026-10-11; core/commands.js unlockPawn): nothing sets it, nothing reads it, old data loads unlocked
  {
    const { unlockPawn } = await import('../core/commands.js');
    ok(/cannot be locked/.test(run(GM, 'entity.flag', A, { ids: ['tok_ring00001'], locked: true })?.why || '') && T('tok_ring00001').locked === false, 'entity.flag { locked } on a pawn is refused, with the reason');
    ok(!run(GM, 'object.place', A, { id: 'obj_lockcr001', cat: 'crate', name: 'crate', x: 9, z: 9, dims: [2, 2, 2] }) && !run(GM, 'entity.flag', A, { ids: ['tok_ring00001', 'obj_lockcr001'], locked: true }) && T('tok_ring00001').locked === false && T('obj_lockcr001').locked === true, 'a pawn and a crate locked together: the crate locks, the pawn does not');
    ok(!run(GM, 'entity.flag', A, { ids: ['tok_ring00001'], locked: true, hidden: false }) && T('tok_ring00001').locked === false, 'a replayed flag that also carried something else applies the rest and leaves the pawn unlocked');
    // a pawn that IS locked in the state (only an old snapshot could hold one): it moves and travels like any other
    setArea(A, { ...tbl(A), entities: { ...tbl(A).entities, tok_ring00001: { ...T('tok_ring00001'), locked: true } } });
    ok(!run(P1, 'token.move', A, { id: 'tok_ring00001', x: 3, z: 4 }) && T('tok_ring00001').x === 3, 'a legacy locked pawn moves for its owner (token.move no longer looks at the lock)');
    const back = applyArea(tbl(A), 'entities.set', { set: { tok_ring00001: { ...T('tok_ring00001'), locked: true }, obj_lockcr001: { ...T('obj_lockcr001'), locked: true } } });
    ok(back.entities.tok_ring00001.locked === false && back.entities.obj_lockcr001.locked === true, 'an old stored inverse (entities.set) cannot bring a pawn\'s lock back; a crate\'s it can');
    ok(applyArea(tbl(A), 'transfer.in', { entity: { ...T('tok_ring00002'), id: 'tok_ring00077', locked: true }, from: A }).entities.tok_ring00077.locked === false, 'nor can a pawn arrive from another area locked');
    const lk = { kind: 'token', id: 'a', name: 'n', locked: true }, un = { kind: 'token', id: 'a', locked: false }, crate = { kind: 'object', id: 'o', locked: true };
    eq([migratePawn(lk), migratePawn({ ...lk, hp: 4, hpMax: 9 })], [{ kind: 'token', id: 'a', name: 'n', locked: false }, { kind: 'token', id: 'a', name: 'n', locked: false, damage: 5 }], 'a saved locked pawn reads as unlocked (alone, and together with the hit-point conversion)');
    ok(migratePawn(un) === un && migratePawn(crate) === crate && unlockPawn(un) === un && unlockPawn(crate) === crate && migratePawn(migratePawn(lk)).locked === false, 'idempotent; an unlocked pawn and a locked crate come back as the same object');
    const rt = { state: { areas: { [A]: { entities: { a: lk, o: crate } } } }, undo: new Map([[A, [{ inv: { type: 'entities.set', args: { set: { a: lk } } } }]]]), redo: new Map([['k', [{ inv: { type: 'batch', args: { ops: [{ type: 'entities.set', args: { set: { a: lk, o: crate } } }] } } }]]]), tails: new Map() };
    const n = migratePawns(rt), txt = JSON.stringify([rt.state, [...rt.undo], [...rt.redo]]);
    ok(n === 3 && migratePawns.last.unlocked === 1 && !/"kind":"token"[^{}]*"locked":true/.test(txt) && rt.state.areas[A].entities.o.locked === true && rt.redo.get('k')[0].inv.args.ops[0].args.set.o.locked === true && migratePawns(rt) === 0, 'migratePawns unlocks the pawn in play and in the stored undo and redo steps, leaves locked things locked, and a second pass does nothing', `${n} ${txt.slice(0, 200)}`);
    setArea(A, { ...tbl(A), entities: { ...tbl(A).entities, tok_ring00001: { ...T('tok_ring00001'), locked: false, x: 1, z: 1 } } });
  }
  // indicators: anyone; one per pawn; '' clears
  ok(!run(P2, 'token.mark', A, { id: 'tok_ring00002', mark: 'skull' }) && T('tok_ring00002').mark === 'skull' && !run(P1, 'token.mark', A, { id: 'tok_ring00002', mark: 'star' }) && T('tok_ring00002').mark === 'star', 'any seat sets an indicator; a second one replaces the first');
  ok(run(P1, 'token.mark', A, { id: 'tok_ring00002', mark: 'banana' })?.code === 'invalid' && MARK_KEYS.length === 8, 'only the eight indicators');
  ok(!run(P1, 'token.mark', A, parseArgs('token.mark', { id: 'tok_ring00002', mark: '' }).args) && !('mark' in T('tok_ring00002')), "'' clears it (the field goes)");
  // the sheet link
  for (const bad of ['javascript:alert(1)', 'ftp://x.org/a', 'data:text/html,x', 'file:///etc/passwd', 'https://user:pw@x.org/', 'https://x.org/<script>', 'not a link', 'vbscript:x'])
    ok(sheetProblem(bad) && run(P1, 'token.set', A, { id: 'tok_ring00001', sheet: bad })?.code === 'invalid', `sheet link refused: ${bad}`);
  ok(!sheetProblem('https://www.dndbeyond.com/characters/42') && !sheetProblem('http://localhost:8080/sheet?id=3') && cleanSheet(' dndbeyond.com/characters/42 ') === 'https://dndbeyond.com/characters/42' && cleanSheet('javascript:alert(1)') === 'javascript:alert(1)' && sheetHost('https://www.dndbeyond.com/characters/42') === 'dndbeyond.com', 'http and https pass; a bare address gets https://; nothing else is rewritten into a link');
  ok(!run(P1, 'token.set', A, { id: 'tok_ring00001', sheet: 'https://dndbeyond.com/characters/42', notes: 'afraid of fire' }) && T('tok_ring00001').sheet === 'https://dndbeyond.com/characters/42' && T('tok_ring00001').notes === 'afraid of fire', 'the owner sets the sheet link and the notes');
  ok(parseArgs('token.set', { id: 'tok_ring00001', notes: 'x'.repeat(4001) }).error && !parseArgs('token.set', { id: 'tok_ring00001', notes: 'x'.repeat(4000) }).error && parseArgs('token.set', { id: 'tok_ring00001', sheet: 'h'.repeat(501) }).error, 'notes are at most 4000 characters, a link 500');
  ok(!run(P1, 'token.set', A, parseArgs('token.set', { id: 'tok_ring00001', sheet: '' }).args) && !('sheet' in T('tok_ring00001')), "'' removes the link");
  ok(run(P1, 'token.set', A, { id: 'tok_ring00001', name: '  ' })?.code === 'invalid', 'a pawn keeps a name');
  // GM notes: written by the GM side only; never in what a player is sent
  ok(/GM/.test(run(P1, 'token.set', A, { id: 'tok_ring00001', gmNotes: 'mine now' })?.why || '') && !run(GM, 'token.set', A, { id: 'tok_ring00001', gmNotes: 'the traitor' }) && T('tok_ring00001').gmNotes === 'the traitor', 'only the GM side writes GM notes (even on a player\'s own pawn)');
  ok(!run(P1, 'token.set', A, { id: 'tok_ring00001', notes: 'afraid of spiders' }) && T('tok_ring00001').gmNotes === 'the traitor', "the owner's later edits keep the GM's note on the relay's copy");
  const e = T('tok_ring00001');
  ok(!('gmNotes' in unnoteEntity(e)) && unnoteEntity(e).notes === 'afraid of spiders' && unnoteEntity(T('tok_ring00002')) === T('tok_ring00002') && !JSON.stringify(unnoteEntities(tbl(A).entities)).includes('traitor'), 'unnote: an entity loses only its GM note; others are untouched');
  const sent = (type, args) => JSON.stringify(unnoteEntry({ area: A, seq: 1, type, args }));
  ok(sent('token.set', { id: e.id, gmNotes: 'the traitor' }) === JSON.stringify({ area: A, seq: 1, type: 'entities.set', args: { set: {} } }), 'a change that was only the GM note reaches a player as an empty step');
  ok(sent('token.set', { id: e.id, gmNotes: 'the traitor', name: 'B' }) === JSON.stringify({ area: A, seq: 1, type: 'token.set', args: { id: e.id, name: 'B' } }), 'a mixed change travels without it');
  for (const [type, args] of [['token.create', { id: 'tok_x000000001', name: 'x', x: 0, z: 0, gmNotes: 'the traitor' }], ['entities.set', { set: { [e.id]: e } }], ['transfer.in', { entity: e, from: A }], ['batch', { ops: [{ type: 'token.set', args: { id: e.id, gmNotes: 'the traitor' } }, { type: 'entities.set', args: { set: { [e.id]: e } } }] }]])
    ok(!/traitor|gmNotes/.test(sent(type, args)), `no GM note in a ${type} sent to a player`);
  ok(inverseOf(tbl(A), 'token.damage', { id: e.id, damage: 1 }).args.set[e.id].gmNotes === 'the traitor' && !/traitor/.test(sent('entities.set', inverseOf(tbl(A), 'token.damage', { id: e.id, damage: 1 }).args)), "an undo carries the whole pawn on the relay, and still no GM note to a player");
  // give control
  ok(run(P1, 'token.owner', A, { id: 'tok_ring00002', owner: P1 })?.code === 'forbidden' && !run(GM, 'token.owner', A, { id: 'tok_ring00002', owner: P2 }) && T('tok_ring00002').owner === P2, 'the GM gives a pawn to a player (a player cannot take one)');
  ok(!run(GM, 'token.owner', A, parseArgs('token.owner', { id: 'tok_ring00002', owner: '' }).args) && T('tok_ring00002').owner === null && run(GM, 'token.owner', A, { id: 'tok_ring00002', owner: 'seat_nobody001' })?.code === 'invalid' && run(GM, 'token.owner', A, { id: 'tok_ring00002', owner: AG })?.code === 'invalid', 'no one takes it back to the GM; an unknown seat or an agent is refused');
  // a copy keeps its extras
  ok(!run(GM, 'token.create', A, { id: 'tok_ring00003', name: 'Brakka', x: 2, z: 2, damage: 5, conditions: ['prone'], sheet: 'https://x.org/1', notes: 'n', gmNotes: 'g', mark: 'moon' }) && T('tok_ring00003').mark === 'moon' && T('tok_ring00003').damage === 5 && T('tok_ring00003').gmNotes === 'g' && T('tok_ring00003').conditions[0] === 'prone' && run(GM, 'token.create', A, { id: 'tok_ring00004', name: 'x', x: 0, z: 0, sheet: 'javascript:1' })?.code === 'invalid', 'token.create takes the extras (a duplicate), with the same checks');
  // the typed field (one small parser) and the readout
  eq([parseDamage('7'), parseDamage('+7'), parseDamage('-5'), parseDamage(' − 5 '), parseDamage('=12'), parseDamage('= 0'), parseDamage('seven'), parseDamage('--7'), parseDamage(''), parseDamage('1e3'), parseDamage('99999'), parseDamage('12/30'), parseDamage('=-3')], [{ delta: 7 }, { delta: 7 }, { delta: -5 }, { delta: -5 }, { set: 12 }, { set: 0 }, null, null, null, null, null, null, null], 'the typed forms: 7 and +7 take 7, -5 heals 5, =12 sets it');
  eq([damageReadout(12, 19), damageReadout(19, 14), damageReadout(5, 5), damageAfter(3, -7), damageAfter(undefined, 4), damageAfter(9990, 50)], ['12 → 19 (+7)', '19 → 14 (−5)', '5', 0, 4, 9999], 'the readout shows the change and the total; damage stops at 0');
  eq([damageLine('Brakka', 7, 19, 'Tobias'), damageLine('Brakka', -5, 14, 'Mira'), damageLine('3 pawns', 7, null, 'Harry'), damageLine('2 pawns', null, null, 'Harry')], ['Brakka took 7 (19 damage) by Tobias', 'Brakka healed 5 (14 damage) by Mira', '3 pawns took 7 by Harry', '2 pawns damage changed by Harry'], 'the words of the undo line');
  // who gets the undo
  eq([seesDamageUndo({ seat: 'a', gmSide: false, by: 'a', owner: 'b' }), seesDamageUndo({ seat: 'b', gmSide: false, by: 'a', owner: 'b' }), seesDamageUndo({ seat: 'g', gmSide: true, by: 'a', owner: 'b' }), seesDamageUndo({ seat: 'c', gmSide: false, by: 'a', owner: 'b' }), seesDamageUndo({ seat: 'c', gmSide: false, by: 'a', owner: null })], [true, true, true, false, false], 'the damage undo is for the changer, the owner and the GM side; nobody else');
}

// --- figures as pawns (2026-10-06): fig and size are plain pawn data ---
{
  let T = newArea('tbl_fig00001', 'figs'); setArea('tbl_fig00001', T);
  camp('seat.create', { id: 'seat_pl00fig1', kind: 'human', role: 'player', name: 'Mira', location: 'tbl_fig00001' }, GM);
  const PF = 'seat_pl00fig1', E = () => tbl('tbl_fig00001').entities;
  ok(!run(GM, 'token.create', 'tbl_fig00001', { id: 'tok_plain001', name: 'Plain', x: 2.5, z: 2.5 }), 'a pawn with no figure');
  eq(Object.keys(E().tok_plain001).sort(), ['color', 'conditions', 'hidden', 'id', 'kind', 'locked', 'name', 'owner', 'rot', 'x', 'z'], 'is stored plainly (no fig, no size; and since the same day no hp or hpMax: a pawn counts damage)');
  ok(!run(GM, 'token.create', 'tbl_fig00001', { id: 'tok_owl00001', name: 'Owlbear', x: 10, z: 10, fig: 'foe-owlbear', size: 2 }), 'a pawn wearing a figure, two squares a side');
  ok(E().tok_owl00001.fig === 'foe-owlbear' && E().tok_owl00001.size === 2, 'fig and size are on the pawn');
  ok(!run(GM, 'token.create', 'tbl_fig00001', { id: 'tok_gob00001', name: 'Goblin', x: 7.5, z: 2.5, fig: 'foe-goblin-spear', size: 1, owner: PF }), 'size 1 is the default');
  ok(!('size' in E().tok_gob00001), '...and is not stored');
  ok(/figure id/.test(run(GM, 'token.create', 'tbl_fig00001', { id: 'tok_bad00001', name: 'x', x: 0, z: 0, fig: 'Not A Figure!' })?.why || ''), 'a fig that is not an id is refused');
  ok(/squares/.test(run(GM, 'token.create', 'tbl_fig00001', { id: 'tok_bad00002', name: 'x', x: 0, z: 0, fig: 'foe-owlbear', size: 9 })?.why || ''), 'a size out of range is refused');
  ok(!run(PF, 'token.set', 'tbl_fig00001', { id: 'tok_gob00001', fig: 'foe-wolf' }), 'a player changes the figure of her own pawn');
  ok(E().tok_gob00001.fig === 'foe-wolf', '...it is changed');
  eq(run(PF, 'token.set', 'tbl_fig00001', { id: 'tok_owl00001', fig: 'foe-wolf' })?.code, 'invalid', "but not of someone else's");
  ok(!run(GM, 'token.set', 'tbl_fig00001', { id: 'tok_owl00001', fig: 'none', size: 1 }), 'fig "none" goes back to the plain pawn');
  ok(!('fig' in E().tok_owl00001) && !('size' in E().tok_owl00001), '...fig and size are gone from the pawn');
  // a player's MAIN pawn: one per seat
  ok(!run(GM, 'token.create', 'tbl_fig00001', { id: 'tok_alt00001', name: 'Alt', x: 12.5, z: 2.5, fig: 'foe-wolf', owner: PF }), 'a second pawn of the same player');
  ok(!run(PF, 'token.set', 'tbl_fig00001', { id: 'tok_gob00001', main: true }) && E().tok_gob00001.main === true, 'a player marks her main pawn');
  const invM = inverseOf(tbl('tbl_fig00001'), 'token.set', { id: 'tok_alt00001', main: true });
  ok(!run(GM, 'token.set', 'tbl_fig00001', { id: 'tok_alt00001', main: true }) && E().tok_alt00001.main === true && !('main' in E().tok_gob00001), 'marking another unmarks the first (the GM may set it for anyone)');
  ok(invM.args.set.tok_gob00001?.main === true && !invM.args.set.tok_alt00001.main, 'and its undo puts both back');
  eq(run(PF, 'token.set', 'tbl_fig00001', { id: 'tok_plain001', main: true })?.code, 'invalid', "a player cannot mark someone else's pawn");
  ok(!run(GM, 'token.set', 'tbl_fig00001', { id: 'tok_alt00001', main: false }) && !('main' in E().tok_alt00001), 'main: false unmarks it (nothing is stored)');
  const inv = inverseOf(tbl('tbl_fig00001'), 'token.set', { id: 'tok_gob00001', fig: 'none' });
  ok(inv.args.set.tok_gob00001.fig === 'foe-wolf', 'undo of a figure change puts the figure back');
  eq(parseArgs('token.create', { id: 'tok_q0000001', name: 'Q', x: '5', z: '5', fig: 'foe-owlbear', size: '2' }, { fromQuery: true }).args, { id: 'tok_q0000001', name: 'Q', x: 5, z: 5, fig: 'foe-owlbear', size: 2 }, 'the GET form parses fig and size');
}

// --- a thing's orientation (2026-10-12; it was tiltZ on 2026-10-11): `quat` on objects, core/orient.js ---
{
  const O = await import('../core/orient.js'), MG = await import('../core/migrate.js');
  const A = 'tbl_main0001', E = () => tbl(A).entities, H = Math.PI / 2, QZ = [0, 0, 0.70711, 0.70711];
  const same = (a, b, tol = 1e-3) => !!a && !!b && O.qAngle(O.qNorm(a), O.qNorm(b)) < tol;
  const mnear = (M, N, tol = 2e-4) => M.every((r, i) => r.every((v, k) => Math.abs(v - N[i][k]) < tol));
  ok(!run(GM, 'object.place', A, { id: 'obj_tilt0001', x: 10, z: 10, y: 0, rot: 0.5, cat: 'barrel', dims: [2, 3, 2] }) && !('quat' in E().obj_tilt0001) && !('tiltZ' in E().obj_tilt0001), 'a thing placed upright stores no orientation field');
  const before = JSON.stringify(E().obj_tilt0001);
  const inv = inverseOf(tbl(A), 'object.set', { id: 'obj_tilt0001', quat: QZ });
  ok(!run(GM, 'object.set', A, { id: 'obj_tilt0001', quat: QZ }) && same(E().obj_tilt0001.quat, QZ), 'object.set quat tips it');
  eq([E().obj_tilt0001.rot, E().obj_tilt0001.y, E().obj_tilt0001.x], [0.5, 0, 10], 'its turn, height and place are untouched');
  ok(!run(GM, 'object.move', A, { id: 'obj_tilt0001', x: 20, z: 12, rot: 1 }) && same(E().obj_tilt0001.quat, QZ) && E().obj_tilt0001.rot === 1, 'a move or a turn keeps the orientation');
  ok(!run(GM, 'object.move', A, { id: 'obj_tilt0001', x: 10, z: 10, rot: 0.5 }), 'moved back');
  ok(!run(GM, 'object.replace', A, { id: 'obj_tilt0001', cat: 'barrel' }) && same(E().obj_tilt0001.quat, QZ), 'replace with similar keeps it');
  ok(!run(GM, 'entity.flag', A, { ids: ['obj_tilt0001'], pinned: true }) && same(E().obj_tilt0001.quat, QZ) && !run(GM, 'entity.flag', A, { ids: ['obj_tilt0001'], pinned: false }), 'pinning keeps it');
  setArea(A, applyArea(tbl(A), inv.type, inv.args));
  eq(JSON.stringify(E().obj_tilt0001), before, 'the undo puts the thing back exactly (no orientation field)');
  ok(!run(GM, 'object.set', A, { id: 'obj_tilt0001', quat: QZ }) && !run(GM, 'object.set', A, { id: 'obj_tilt0001', quat: [0, 0, 0, 1] }) && !('quat' in E().obj_tilt0001), 'the identity stands it up: the field is removed');
  eq(JSON.stringify(E().obj_tilt0001), before, 'upright again is the same data as never tipped');
  ok(!run(GM, 'object.set', A, { id: 'obj_tilt0001', quat: [0, 0, -2, -2] }) && same(E().obj_tilt0001.quat, QZ) && E().obj_tilt0001.quat[3] > 0 && Math.abs(Math.hypot(...E().obj_tilt0001.quat) - 1) < 1e-4, 'what is stored is a unit quaternion with w >= 0, however it was sent');
  ok(!run(GM, 'object.set', A, { id: 'obj_tilt0001', name: 'Cask' }) && same(E().obj_tilt0001.quat, QZ), 'object.set without quat leaves it alone');
  // the old argument, from an old client, an AI seat or a journal line: taken, and stored as the quat it means
  ok(!run(GM, 'object.set', A, { id: 'obj_tilt0001', tiltZ: -H }) && same(E().obj_tilt0001.quat, [0, 0, -0.70711, 0.70711]) && !('tiltZ' in E().obj_tilt0001), 'object.set tiltZ (the 2026-10-11 argument) still works: it is stored as the quat it means');
  ok(!run(GM, 'object.set', A, { id: 'obj_tilt0001', tiltZ: 0 }) && !('quat' in E().obj_tilt0001), 'and tiltZ 0 still stands it up');
  ok(!run(GM, 'object.place', A, { id: 'obj_tilt0002', x: 5, z: 5, cat: 'chair', dims: [2, 3, 2], quat: [0.5, 0.5, -0.5, 0.5] }) && same(E().obj_tilt0002.quat, [0.5, 0.5, -0.5, 0.5]), 'object.place carries an orientation (copy, paste, duplicate)');
  ok(!run(GM, 'object.place', A, { id: 'obj_tilt0006', x: 5, z: 9, cat: 'chair', dims: [2, 3, 2], tiltZ: H }) && same(E().obj_tilt0006.quat, QZ) && !('tiltZ' in E().obj_tilt0006), 'object.place with the old tiltZ (a clip copied yesterday) places it as it was');
  ok(!run(GM, 'object.place', A, { id: 'obj_tilt0003', x: 5, z: 5, place: 'stair', rise: 10, dims: [5, 10, 10], quat: QZ }) && !('quat' in E().obj_tilt0003), 'a stair is never placed tipped');
  ok(/cannot be tilted/.test(run(GM, 'object.set', A, { id: 'obj_tilt0003', quat: QZ })?.why || ''), 'nor tipped afterwards');
  ok(!run(GM, 'object.place', A, { id: 'obj_tilt0004', x: 5, z: 5, place: 'tile', dims: [5, 0.1, 5], quat: QZ }) && !('quat' in E().obj_tilt0004) && run(GM, 'object.set', A, { id: 'obj_tilt0004', quat: QZ }), 'nor a floor tile');
  ok(!run(GM, 'object.place', A, { id: 'obj_tilt0005', x: 50, z: 50, cat: 'ladder-wood', dims: [2, 10, 1], quat: QZ }) && !('quat' in E().obj_tilt0005) && /cannot be tilted/.test(run(GM, 'object.set', A, { id: 'obj_tilt0005', quat: QZ })?.why || ''), 'nor a stair that is furniture (a ladder, the grand stair)');
  eq(run(P1, 'object.set', A, { id: 'obj_tilt0001', quat: QZ })?.code, 'forbidden', 'a player without the object class cannot tip things');
  eq(parseArgs('object.set', { id: 'obj_tilt0001', quat: '[0,0,0.70711,0.70711]' }, { fromQuery: true }).args, { id: 'obj_tilt0001', quat: QZ }, 'the GET form parses quat');
  ok(parseArgs('object.set', { id: 'obj_tilt0001', quat: [0, 0, 1] }).error && parseArgs('object.set', { id: 'obj_tilt0001', quat: [0, 0, 0, 0] }).error && parseArgs('object.set', { id: 'obj_tilt0001', quat: 'sideways' }).error, 'a quat that is not four numbers of unit length is refused');
  eq(parseArgs('token.set', { id: 'tok_aaaa0001', quat: QZ }).args?.quat, undefined, 'a pawn has no orientation');

  // THE ROLLS COMPOSE (Harry 2026-10-12): two rolls from views a quarter turn apart reach what no single roll can
  const viewN = [0, 0, -1], viewE = [1, 0, 0]; // looking north, then (the camera orbited a quarter turn) looking east
  const q1 = O.rollQuat(null, 0, viewN, H), q2 = O.rollQuat(q1, 0, viewE, H);
  ok(mnear(O.matrixOf(0, q1), [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]), 'one quarter roll, seen from the south looking north: its top goes to the right (east), exactly', JSON.stringify(O.matrixOf(0, q1)));
  ok(mnear(O.matrixOf(0, q2), [[0, 1, 0], [0, 0, -1], [-1, 0, 0]]), 'then a quarter roll seen looking east: the resulting matrix is Rot(x, 90°) · Rot(-z, 90°)', JSON.stringify(O.matrixOf(0, q2)));
  { // no single roll about a level axis gets there: such a roll keeps the axis's own direction fixed, and here every level direction moves
    const M = O.matrixOf(0, q2); let best = Infinity;
    for (let a = 0; a < 360; a += 1) { const n = [Math.cos(a * Math.PI / 180), 0, Math.sin(a * Math.PI / 180)], Mn = [0, 1, 2].map(r => M[r][0] * n[0] + M[r][2] * n[2]); best = Math.min(best, Math.hypot(Mn[0] - n[0], Mn[1], Mn[2] - n[2])); }
    ok(best > 0.5, 'and that orientation cannot be reached by ONE roll about any level axis, nor held by a turn + one tilt angle', `nearest level axis moves by ${best.toFixed(2)}`);
    let bz = Infinity; for (let r = 0; r < 360; r += 2) for (let t = 0; t < 360; t += 2) bz = Math.min(bz, O.qAngle(O.qMul(O.qAxis([0, 1, 0], r * Math.PI / 180), O.qAxis([0, 0, 1], t * Math.PI / 180)), q2));
    ok(bz > 0.5, 'the old rot + tiltZ pair cannot hold it (the nearest is far off)', `${(bz * 180 / Math.PI).toFixed(0)}° away at best`);
  }
  ok(mnear(O.matrixOf(1.1, O.rollQuat(null, 1.1, viewN, 0.4)), (() => { const q = O.qMul(O.qAxis(viewN, 0.4), O.qAxis([0, 1, 0], 1.1)); return [0, 1, 2].map(r => [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(c => O.qRotate(q, c)[r])); })()), 'a roll is about the WORLD axis whatever the thing\'s Turn: Ry(rot) · quat\' = Rot(n, a) · Ry(rot) · quat');
  ok(O.rollQuat(q1, 0, viewN, -H) === null && O.rollQuat(O.rollQuat(q2, 0, viewE, -H), 0, viewN, -H) === null, 'rolled back the way it came, it is upright again: no field');
  { const f = O.foldTurn(0.3, O.rollQuat(O.rollQuat(O.rollQuat(null, 0.3, viewN, H), 0.3, viewE, H), 0.3, viewN, -H)); ok(f.quat === null ? Math.abs(Math.abs(f.rot - 0.3) - H) < 1e-3 : true, 'three quarter rolls that add up to a plain turn are folded into the Turn (upright stays one thing in the data)', JSON.stringify(f)); }
  ok(O.rollStops(null, 0, [0.6, 0, -0.8]).some(s => s.label === 'upright' && Math.abs(s.a) < 1e-6) && O.rollStops(null, 0, [0.6, 0, -0.8]).filter(s => s.label === 'on its side').length === 2, 'the gesture\'s stops from upright: upright at 0, on its side at ±90°');
  { const st = O.rollStops(O.rollQuat(null, 0, viewN, 0.5), 0, viewE); ok(!st.some(s => s.label === 'upright'), 'tipped one way and viewed from the side, a roll cannot bring it upright: no such stop is offered', JSON.stringify(st.map(s => s.label))); }
  ok(same(O.squareUp(O.qAxis([0, 0, 1], H + 0.01)), QZ, 1e-6) && !same(O.squareUp(O.qAxis([0, 0, 1], H + 0.05)), QZ, 1e-3), 'within about a degree of square, a result is brought exactly square; further off it is left alone');
  // MIGRATION: a thing saved with tiltZ loads with the quat it means, in play and inside stored undo steps
  {
    const old = { id: 'obj_old000001', kind: 'object', x: 1, z: 2, rot: 0.4, tiltZ: -1.5708, dims: [2, 3, 2] }, plain = { id: 'obj_old000002', kind: 'object', x: 1, z: 2 };
    const rt = { state: { areas: { a1: { entities: { [old.id]: old, [plain.id]: plain } } } }, undo: new Map([['a1', [{ inv: { type: 'entities.set', args: { set: { [old.id]: { ...old, tiltZ: 0.5 } } } } }, { inv: { type: 'batch', args: { ops: [{ type: 'entities.set', args: { set: { [plain.id]: plain } } }] } } }]]]), redo: new Map(), tails: new Map() };
    const r1 = MG.migrateTilts(rt), e = rt.state.areas.a1.entities;
    ok(r1.things === 1 && r1.stored === 1 && same(e[old.id].quat, [0, 0, -0.70711, 0.70711]) && !('tiltZ' in e[old.id]) && e[plain.id] === plain, 'migrateTilts: a saved tiltZ becomes the quat it means; an upright thing is the same object', JSON.stringify(r1));
    ok(mnear(O.matrixOf(0.4, e[old.id].quat), O.matrixOf(0.4, O.qAxis([0, 0, 1], -1.5708))), 'and it is drawn exactly as it was (the same matrix)');
    ok(same(rt.undo.get('a1')[0].inv.args.set[old.id].quat, O.qAxis([0, 0, 1], 0.5)) && !('tiltZ' in rt.undo.get('a1')[0].inv.args.set[old.id]), 'a stored undo step is converted too');
    const r2 = MG.migrateTilts(rt); ok(r2.things === 0 && r2.stored === 0, 'loading again converts nothing (idempotent)');
  }
}

// --- room pawn hiding: provenance, ownership, geometry, atomic undo and save round trips ---
{
  const R = 'room_cascade01', U = 'room_cascade02', B = 'bld_cascade001';
  const seats = { gm: { id: 'gm', kind: 'human', role: 'gm' }, pl: { id: 'pl', kind: 'human', role: 'player' } };
  const prep = (type, a) => prepareRoomHiding({ seats }, type, a);
  let a = newArea('tbl_cascade01', 'Cascade');
  a = applyArea(a, 'room.spawn', { id: R, type: 'common', x: 0, z: 0, w: 4, d: 4, seed: 1, building: B });
  a = applyArea(a, 'room.spawn', { id: U, type: 'common', x: 0, z: 0, w: 4, d: 4, y: 10, seed: 1, building: B });
  const add = (id, extras = {}) => { a = applyArea(a, 'token.create', prep('token.create', { id, name: id, x: 5, z: 5, ...extras })); };
  add('tok_cascnpc01'); add('tok_cascpre01', { hidden: true }); add('tok_cascpl001', { owner: 'pl' });
  add('tok_cascgm001', { owner: 'gm' }); add('tok_cascup001', { y: 10 }); add('tok_cascfly01', { y: 100 });
  ok(!HIDE_ROOM_HIDES_PLAYER_PAWNS, 'room hide defaults to exempting player pawns');
  eq(roomPlayerPawns(a, [B], seats).map(p => p.id), ['tok_cascpl001'], 'GM note counts player-owned pawns throughout a building');
  const hide = prep('entity.flag', { ids: [R], hidden: true }), original = a, inv = inverseOf(a, 'entity.flag', hide);
  a = applyArea(a, 'entity.flag', hide);
  ok(a.entities.tok_cascnpc01.hidden && a.entities.tok_cascgm001.hidden, 'room hides unowned and GM-owned pawns');
  ok(a.entities.tok_cascnpc01.hiddenByRoom === R && !a.entities.tok_cascpre01.hiddenByRoom, 'provenance names only pawns the room itself hid');
  ok(!a.entities.tok_cascpl001.hidden && !a.entities.tok_cascup001.hidden && !a.entities.tok_cascfly01.hidden, 'player exception and vertical room membership respected');
  eq(applyArea(a, inv.type, inv.args).entities, original.entities, 'one inverse restores room and all cascade pawns');
  const loaded = JSON.parse(JSON.stringify(a));
  a = applyArea(loaded, 'entity.flag', prep('entity.flag', { ids: [R], hidden: false }));
  ok(!a.entities.tok_cascnpc01.hidden && !a.entities.tok_cascgm001.hidden && a.entities.tok_cascpre01.hidden, 'save/reload then reveal restores only cascade-hidden pawns');
  ok(!('hiddenByRoom' in a.entities.tok_cascnpc01), 'reveal removes provenance');
  a = applyArea(a, 'entity.flag', prep('entity.flag', { ids: [B], hidden: true }));
  ok(a.entities.tok_cascup001.hidden && a.entities[U].hidden && !a.entities.tok_cascpl001.hidden, 'building hide cascades through every storey');
  add('tok_cascnew01'); add('tok_cascnewpl', { owner: 'pl' }); add('tok_cascnewgm', { owner: 'gm' });
  ok(a.entities.tok_cascnew01.hidden && a.entities.tok_cascnew01.hiddenByRoom === R && a.entities.tok_cascnewgm.hidden && !a.entities.tok_cascnewpl.hidden, 'place into hidden room is born hidden, except player pawn');
  a = applyArea(a, 'entity.flag', prep('entity.flag', { ids: ['tok_cascnew01'], hidden: true }));
  ok(!a.entities.tok_cascnew01.hiddenByRoom, 'explicit pawn hide takes over from cascade');
  a = applyArea(a, 'token.move', prep('token.move', { id: 'tok_cascnpc01', x: 50, z: 50 }));
  ok(a.entities.tok_cascnpc01.hidden && !a.entities.tok_cascnpc01.hiddenByRoom, 'moving out stays hidden and ends room provenance');
  a = applyArea(a, 'entity.flag', prep('entity.flag', { ids: [B], hidden: false }));
  ok(a.entities.tok_cascnpc01.hidden && a.entities.tok_cascnew01.hidden && a.entities.tok_cascpre01.hidden && !a.entities.tok_cascup001.hidden, 'building reveal preserves independent, prehidden and departed pawns');
  a = applyArea(a, 'entity.flag', prep('entity.flag', { ids: [R], hidden: true }));
  add('tok_cascdrop1', { x: 50, z: 50 });
  a = applyArea(a, 'template.place', { id: 'tpl_cascdrop1', shape: 'circle', x: 50, z: 50, size: 5, attach: 'tok_cascdrop1' });
  const dropInverse = inverseOf(a, 'token.move', prep('token.move', { id: 'tok_cascdrop1', x: 5, z: 5 }));
  a = applyArea(a, 'token.move', prep('token.move', { id: 'tok_cascdrop1', x: 5, z: 5 }));
  ok(a.entities.tpl_cascdrop1.hidden, 'drop hides attached template without disclosing newly hidden pawn');
  const undoneDrop = applyArea(a, dropInverse.type, dropInverse.args);
  ok(!undoneDrop.entities.tok_cascdrop1.hidden && !undoneDrop.entities.tpl_cascdrop1.hidden, 'drop undo restores pawn and attached template visibility');
  ok(a.entities.tok_cascdrop1.hidden && a.entities.tok_cascdrop1.hiddenByRoom === R, 'drop into hidden room is hidden in same move');
  a = applyArea(a, 'pawn.bring', prep('pawn.bring', { id: 'tok_cascbench', def: 'pawn_casc001', name: 'Bench', owner: 'gm', x: 5, z: 5 }));
  ok(a.entities.tok_cascbench.hidden, 'bench bring into hidden room follows same rule');
  ok(!('_roomPlayerOwners' in parseArgs('entity.flag', { ids: [R], hidden: true, _roomPlayerOwners: ['gm'] }).args), 'sender cannot forge room ownership exclusions');
}

console.log(`core: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
