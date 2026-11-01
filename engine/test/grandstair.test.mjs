// A STAIR THAT IS FURNITURE OPENS THE FLOOR ABOVE (2026-10-11; Harry: "The grand entrance double-stairs don't cut
// through to the higher floor"). core/stairs.js STAIR_ROLES.
//   node engine/test/grandstair.test.mjs
// 1. the mansion's entrance hall with a storey over it: the grand stair opens that floor, is railed, and a pawn crosses
// 2. EVERY stair piece of the library (each sku of each stair role), put down by hand under a floor: the same
// 3. every catalog id that looks like a stair is either a role or a named exception (a new one fails here until it is sorted)
import { applyArea } from '../core/commands.js';
import { newArea, areaForClient } from '../core/state.js';
import { loadRoomgen } from '../relay/server.js';
import * as S from '../core/stairs.js';
import * as FP from '../core/footprint.js';
import * as HT from '../core/height.js';
// A STAIR IS A PLACE TO STAND (2026-10-26): a standing pawn at (x, z) whose base is at `from` (core/height.js pawnStepTo),
// and a walk along a line, its base carried point to point as a drag carries it -> every height on the way
const step = (A, x, z, from) => HT.pawnStepTo(A.entities, x, z, from);
const walkLine = (A, [x0, z0], y0, [x1, z1], n = 60) => { let y = y0, fb = null; const out = []; for (let i = 1; i <= n; i++) { const t = HT.pawnStepTo(A.entities, x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, y, null, fb); if (!t.below || t.walk) { y = t.y; fb = t; } out.push(y); } return out; };
const smooth = (ys) => ys.every((y, i) => !i || Math.abs(y - ys[i - 1]) < 1.5); // never a jump of a storey

let checks = 0, fails = 0;
const ok = (c, m, d = '') => { checks++; if (!c) { fails++; console.log('FAIL', m, d); } };
const rg = await loadRoomgen(new URL('../tuner', import.meta.url).pathname, new URL('../tuner-data', import.meta.url).pathname);
const B = 'bld_grand00001', HALL = 'room_ghall0001', UP = 'room_gup000001';
const keys = (cells) => cells.map(c => c.join(':')).sort().join(' ');
const overlap = (o, [gx, gz]) => { const c = Math.abs(Math.cos(o.rot || 0)), s = Math.abs(Math.sin(o.rot || 0)), hw = (c * o.dims[0] + s * o.dims[2]) / 2, hd = (s * o.dims[0] + c * o.dims[2]) / 2; return Math.max(0, Math.min(o.x + hw, gx * 5 + 5) - Math.max(o.x - hw, gx * 5)) * Math.max(0, Math.min(o.z + hd, gz * 5 + 5) - Math.max(o.z - hd, gz * 5)); };

// ---- 1. the mansion's entrance hall, in an odd width (the stair straddles half squares) and an even one ----
for (const w of [5, 6]) for (const seed of [1, 2, 3]) {
  let A = newArea('area_grand001', 'grand'); const tag = `hall ${w}x6 seed ${seed}`;
  const hallA = { id: HALL, type: 'mansion-hall', x: 0, z: 0, w, d: 6, seed, building: B, buildingName: 'Mansion' };
  A = applyArea(A, 'room.spawn', { ...hallA, layout: rg.solve(A.entities, hallA, 1) });
  const st = Object.values(A.entities).find(o => o.kind === 'object' && o.cat === 'stair-grand');
  ok(st && st.place === 'kit' && st.room === HALL, `${tag}: the hall is rolled its grand stair, as furniture`); if (!st) continue;
  ok(S.holesAt(A.entities, 10).size > 0 && !S.isStair(st) && S.stairRole(st) && S.stairTop(st) === 10, `${tag}: it reaches the floor 10 ft up (not its 13-ft balustrade)`);
  // the storey above: planned like any upper room (no second stair: the grand stair is its way up), furnished round the hole
  const upA = { id: UP, type: 'mansion-bedroom', x: 0, z: 0, w, d: 6, y: 10, seed: seed + 40, building: B }, stub = { id: UP, kind: 'room', recipe: { ...upA }, building: B, order: A.order + 1 };
  ok(rg.stairFor({ ...A.entities, [UP]: stub }, stub) === null, `${tag}: the room over the hall is given no second stair`, rg.stairFor.why);
  A = applyArea(A, 'room.spawn', { ...upA, layout: rg.solve(A.entities, upA, A.order + 1) });
  const cells = S.stairCells(st), holes = S.holesAt(A.entities, 10), E = S.stairEnds(st, A.entities);
  // the hole is every square the stair's box stands on (a square it covers by more than a foot each way)
  const hw = st.dims[0] / 2, hd = st.dims[2] / 2, want = [];
  for (let gx = 0; gx < w; gx++) for (let gz = 0; gz < 6; gz++) if (Math.min(st.x + hw, gx * 5 + 5) - Math.max(st.x - hw, gx * 5) > 1 && Math.min(st.z + hd, gz * 5 + 5) - Math.max(st.z - hd, gz * 5) > 1) want.push([gx, gz]);
  ok(keys([...holes].map(k => k.split(':').map(Number))) === keys(want) && keys(cells) === keys(want) && want.length === (w % 2 ? 9 : 6), `${tag}: the floor above is open on exactly the squares the stair stands on (${want.length})`, `${[...holes].sort().join(' ')} / ${keys(want)}`);
  ok(S.holesAt(A.entities, 0).size === 0, `${tag}: and the hall's own floor is whole`);
  const upObjs = Object.values(A.entities).filter(o => o.kind === 'object' && o.room === UP && !o.parent && o.place !== 'wall' && o.place !== 'ceiling' && !o.flat);
  const onHole = upObjs.filter(o => [...want, ...E.exits].some(c => overlap(o, c) > 2.5));
  ok(upObjs.length >= 3 && !onHole.length, `${tag}: the room above is furnished round the hole and the way out (${upObjs.length} things)`, onHole.map(o => o.cat).join(','));
  // the way out at the top: the stair climbs to the hall's far wall, so it leads out on either hand of its top row
  ok(E.exits.length === 2 && E.exits.every(c => FP.hasCell(upA, ...c) && !holes.has(c.join(':'))) && E.top.y === 10 && E.foot.y === 0 && FP.hasCell(hallA, ...E.footCell) && !cells.some(c => c[0] === E.footCell[0] && c[1] === E.footCell[1]), `${tag}: the top leads out onto floor of the room above, on both hands; the foot is hall floor`, JSON.stringify(E));
  // railing: every open side of the hole but the two ways out
  const rails = S.stairRails(A.entities, st); let open = 0;
  for (const [gx, gz] of want) for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!holes.has(`${gx + ex}:${gz + ez}`) && FP.hasCell(upA, gx + ex, gz + ez)) open++;
  ok(rails.length === open - 2 && rails.length >= 5 && rails.every(r => r.y === 10 && r.room === UP && r.stair === st.id) && new Set(rails.map(r => r.key)).size === rails.length, `${tag}: a railing section on every open side of the hole but the two ways out (${rails.length} of ${open})`, rails.map(r => r.key).join(' '));
  ok(S.railsOf(A.entities).length === rails.length, `${tag}: and they are the area's railings`);
  // pawns (2026-10-26: a stair is a place to stand): let go on its middle from the hall or from the hole above, it stands
  // on the treads halfway up; walked from the foot up its middle to the top and out on either hand, it rises smoothly and
  // arrives on the floor above; the landings are just floor; the floor beside the stair is floor, upstairs it is the hole
  const [cx, cz] = S.stairDir(st), run = st.dims[2], mid = step(A, st.x, st.z, 0), midDown = step(A, st.x, st.z, 10);
  ok(mid.on === 'stair' && mid.y > 5 && mid.y < 7 && midDown.on === 'stair' && Math.abs(midDown.y - mid.y) < 1e-9, `${tag}: let go halfway along the stair, from below or from the hole above, a pawn stands on its treads, halfway up`, JSON.stringify([mid, midDown]));
  const topT = [st.x + cx * (run / 2 - 0.3), st.z + cz * (run / 2 - 0.3)], upW = walkLine(A, [E.foot.x, E.foot.z], 0, topT);
  const outs = E.exits.map(c => walkLine(A, topT, upW.at(-1), [(c[0] + 0.5) * 5, (c[1] + 0.5) * 5], 20));
  ok(smooth(upW) && upW.at(-1) > 9.5 && outs.length === 2 && outs.every(o => o.at(-1) === 10), `${tag}: walked up its middle it rises smoothly to the top and steps out onto the floor above, on either hand`, JSON.stringify([upW.filter((_, i) => i % 6 === 0), outs.map(o => o.at(-1))]));
  const downW = walkLine(A, topT, 10, [E.foot.x, E.foot.z]);
  ok(smooth(downW) && downW.at(-1) === 0, `${tag}: and walked back down to its foot, smoothly, onto the hall floor`, JSON.stringify(downW.filter((_, i) => i % 6 === 0)));
  ok(step(A, E.foot.x, E.foot.z, 0).y === 0 && step(A, E.foot.x, E.foot.z, 10).y === 10 && step(A, (E.exits[0][0] + 0.5) * 5, (E.exits[0][1] + 0.5) * 5, 10).y === 10, `${tag}: the landings are just floor, each of its own level`);
  if (w % 2) { const b0 = step(A, st.x - hw - 1.5, st.z, 0), b1 = step(A, st.x - hw - 1.5, st.z, 10); ok(b0.y === 0 && !b0.below && b1.below && b1.y === 0, `${tag}: the strip of hall floor beside the stair is floor; the same spot upstairs is the hole (a pawn there hangs over the drop)`, JSON.stringify([b0, b1])); }
  // what a seat is told; what joins what
  const info = S.stairInfo(A.entities, st), L = S.stairLinks(A.entities, st);
  ok(L.from === HALL && L.to === UP && info.piece === 'stair-grand' && info.rise === 10 && info.top[2] === 10 && info.bottom[2] === 0 && info.railing.length === rails.length && S.hasStair(A.entities, A.entities[UP], 'upper') && S.hasStair(A.entities, A.entities[HALL], 'lower'), `${tag}: it joins the hall to the room above (seats are told so)`, JSON.stringify(info));
  // it stays the hall's furniture: deleting or hiding the room above leaves it standing, and closes the hole for players
  const del = applyArea(A, 'room.delete', { id: UP }); ok(del.entities[st.id] && !del.entities[UP], `${tag}: deleting the room above does not take the hall's stair with it`);
  const hid = applyArea(A, 'entity.flag', { ids: [UP], hidden: true }), pv = areaForClient(hid, false);
  ok(!hid.entities[st.id].hidden && pv.entities[st.id] && !pv.entities[UP] && S.railsOf(pv.entities).length === 0, `${tag}: hiding the room above leaves the stair in the hall; a player has no upper floor and no railing`);
  const hh = applyArea(A, 'entity.flag', { ids: [HALL], hidden: true }), pv2 = areaForClient(hh, false);
  ok(!pv2.entities[st.id] && S.holesAt(pv2.entities, 10).size === 0, `${tag}: hiding the hall hides its stair: a player sees a whole floor upstairs`);
  // it follows the stair
  const mv = applyArea(A, 'object.move', { id: st.id, x: st.x, z: st.z + 5 }); ok(keys([...S.holesAt(mv.entities, 10)].map(k => k.split(':').map(Number))) === keys(want.map(([gx, gz]) => [gx, gz + 1])), `${tag}: move the stair a square and the hole moves with it`);
  ok(S.holesAt(applyArea(A, 'object.delete', { id: st.id }).entities, 10).size === 0, `${tag}: delete it and the floor closes`);
  // a tall hall: the stair climbs 10 ft and the floor above is 20 ft up, so nothing is cut
  { let T = newArea('area_grand002', 't'); T = applyArea(T, 'room.spawn', { ...hallA, layout: rg.solve(T.entities, hallA, 1) }); T = applyArea(T, 'room.tall', { id: HALL, tall: 2 });
    const u2 = { ...upA, y: 20 }; T = applyArea(T, 'room.spawn', { ...u2, layout: rg.solve(T.entities, u2, T.order + 1) });
    ok(S.holesAt(T.entities, 20).size === 0 && S.railsOf(T.entities).length === 0, `${tag}: under a floor it does not reach (a tall hall) it cuts nothing`); }
}

// ---- 2. every stair piece of the library, put down by hand under a floor ----
{
  const lib = rg.lib, roles = Object.keys(S.STAIR_ROLES); let n = 0;
  ok(roles.every(id => lib.objects[id]), 'every stair role is in the library', roles.filter(id => !lib.objects[id]).join(','));
  for (const id of roles) for (const k of lib.objects[id].skus.filter(k => k.bounds && k.url)) for (const q of [0, 1, 2, 3]) {
    const R = S.STAIR_ROLES[id], size = rg.sizeOf(id, k.sku), tag = `${k.sku} turned ${q * 90}`; n++;
    let A = newArea('area_grand003', 'kit');
    const low = { id: HALL, type: 'storeroom', x: 0, z: 0, w: 8, d: 8, seed: 5, building: B }, up = { id: UP, type: 'storeroom', x: 0, z: 0, w: 8, d: 8, y: R.rise, seed: 6, building: B };
    A = applyArea(A, 'room.spawn', { ...low, layout: { hash: 'x', summary: '', objects: [] } }); A = applyArea(A, 'room.spawn', { ...up, layout: { hash: 'y', summary: '', objects: [] } });
    ok(S.holesAt(A.entities, R.rise).size === 0, `${tag}: (the floor above starts whole)`);
    // where a hand puts it: on whole squares in the middle of the room (client/stairs.js stairPlacement), a ladder anywhere
    const nA = Math.max(1, Math.round(size.dims[2] / 5)), mA = Math.max(1, Math.round(size.dims[0] / 5)), al = nA % 2 ? 22.5 : 20, ac = mA % 2 ? 22.5 : 20;
    const o = { id: 'obj_gkit000001', x: q % 2 ? al : ac, z: q % 2 ? ac : al, y: 0, rot: q * Math.PI / 2, cat: id, sku: size.sku, url: size.url, place: size.place, dims: size.dims, s: size.s, yaw: size.yaw, name: id, room: HALL };
    A = applyArea(A, 'object.place', o);
    const e = A.entities[o.id], holes = S.holesAt(A.entities, R.rise), cells = S.stairCells(e), E = S.stairEnds(e, A.entities);
    const c = Math.abs(Math.cos(e.rot)), s = Math.abs(Math.sin(e.rot)), hx = (c * e.dims[0] + s * e.dims[2]) / 2, hz = (s * e.dims[0] + c * e.dims[2]) / 2;
    // no part of the piece stands under floor that was left in: every square it covers by more than a foot is open
    let under = 0; for (let gx = 0; gx < 8; gx++) for (let gz = 0; gz < 8; gz++) if (!holes.has(`${gx}:${gz}`) && Math.min(e.x + hx, gx * 5 + 5) - Math.max(e.x - hx, gx * 5) > 1 && Math.min(e.z + hz, gz * 5 + 5) - Math.max(e.z - hz, gz * 5) > 1) under++;
    ok(holes.size >= 1 && holes.size === cells.length && holes.size <= mA * nA + 2 && !under, `${tag}: it opens the floor ${R.rise} ft up, on its own squares and no others`, `${holes.size} open, ${under} squares of it under floor`);
    ok(E.exits.length >= 1 && E.exits.every(x => FP.hasCell(up, ...x) && !holes.has(x.join(':'))) && FP.hasCell(low, ...E.footCell) && !cells.some(x => x[0] === E.footCell[0] && x[1] === E.footCell[1]), `${tag}: both ends are on floor`, JSON.stringify(E));
    // a flight leads out beyond its high end (away from its front); a spiral or a ladder on the side it is entered from
    const f = [[0, 1], [1, 0], [0, -1], [-1, 0]][q], dot = (E.top.x - e.x) * f[0] + (E.top.z - e.z) * f[1];
    ok(R.turn ? dot > 0 : dot < 0, `${tag}: the way out is ${R.turn ? 'on the side it is entered from' : 'beyond its high end'}`, `${dot}`);
    const rails = S.stairRails(A.entities, e); let open = 0;
    for (const [gx, gz] of cells) for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!holes.has(`${gx + ex}:${gz + ez}`)) open++;
    ok(rails.length === open - E.exits.length && rails.length >= 3, `${tag}: railed on every side but the way out (${rails.length})`);
    if (R.turn) { // a spiral and a ladder are climbed in one move (core/stairs.js stairHop)
      const hopUp = S.stairHop(A.entities, e.x, e.z, 0), hopDown = S.stairHop(A.entities, (cells[0][0] + 0.5) * 5, (cells[0][1] + 0.5) * 5, R.rise);
      ok(hopUp && hopUp.y === R.rise && !holes.has(`${Math.floor(hopUp.x / 5)}:${Math.floor(hopUp.z / 5)}`) && hopDown && hopDown.y === 0, `${tag}: a pawn goes up it and comes down it, in one move`, JSON.stringify([hopUp, hopDown]));
    } else { // a flight is walked: from its foot to the way out at its top, and back
      const top = [(E.topCell[0] + 0.5) * 5, (E.topCell[1] + 0.5) * 5], u = walkLine(A, [E.foot.x, E.foot.z], 0, top), d = walkLine(A, top, R.rise, [E.foot.x, E.foot.z]);
      ok(u.at(-1) === R.rise && u.some(y => y > 0.5 && y < R.rise - 0.5) && (R.rise < 10 || (smooth(u) && smooth(d) && d.at(-1) === 0)), /* (a half flight's floor 5 ft up is laid over the whole room here, its foot included: only its treads are asked of it) */ `${tag}: a pawn walks up it and down it, smoothly, standing on its treads on the way`, JSON.stringify([u.filter((_, i) => i % 6 === 0), d.filter((_, i) => i % 6 === 0)]));
    }
  }
  const expected = roles.reduce((sum, id) => sum + lib.objects[id].skus.filter(k => k.bounds && k.url).length * 4, 0);
  ok(roles.every(id => lib.objects[id].skus.some(k => k.bounds && k.url)) && n > 0 && n === expected, `every stair piece in the library was tried, each turned four ways (${n}/${expected})`);
}

// ---- 2b. maps made before this keep their floors; a stair under no floor leads nowhere ----
{
  // (the plan as maps made before this got it: with the rolled piece not yet counting as a stair)
  const planStairOld = (entities, stub) => rg.stairFor(Object.fromEntries(Object.entries(entities).map(([k, e]) => [k, S.stairRole(e) ? { ...e, cat: 'crate' } : e])), stub);
  // an inn's cellar: its layout rolls a flight "along a wall" as dressing AND it has its planned stair. Only the planned one cuts.
  let found = 0;
  for (const type of ['cellar', 'barn', 'mansion-cellar']) for (let seed = 1, got = 0; seed <= 16 && got < 2; seed++) {
    let A = newArea('area_grand004', 'inn'); const low = { id: HALL, type, x: 0, z: 0, w: 5, d: 5, seed, building: B, buildingName: 'Inn' };
    A = applyArea(A, 'room.spawn', { ...low, layout: rg.solve(A.entities, low, 1) });
    const rolled = Object.values(A.entities).find(o => o.kind === 'object' && o.room === HALL && S.stairRole(o)); if (!rolled) continue;
    const upA = { id: UP, type: 'guest', x: 0, z: 0, w: 5, d: 5, y: 10, seed: seed + 9, building: B }, stub = { id: UP, kind: 'room', recipe: { ...upA }, building: B, order: 2 };
    const tag = `${type} seed ${seed} (${rolled.cat} by rule "${rolled.rule}")`;
    // made as the tools make it: the room above is planned its stair first (as on every map made before this), then furnished
    const before = { ...A.entities, [UP]: stub }; const P = planStairOld(before, stub); if (!P) continue;
    found++; got++;
    const pst = { id: 'obj_gplan00001', ...P.args };
    A = applyArea(A, 'room.spawn', { ...upA, layout: rg.solve({ ...A.entities, [pst.id]: { kind: 'object', ...pst } }, upA, 2) }); A = applyArea(A, 'object.place', pst);
    const planned = keys(S.stairCells(A.entities[pst.id]));
    ok(rolled.rule && keys([...S.holesAt(A.entities, 10)].map(k => k.split(':').map(Number))) === planned && S.stairsOf(A.entities).length === 1, `${tag}: the piece its layout rolled stays dressing beside the planned stair (one hole, as before)`, `${[...S.holesAt(A.entities, 10)].join(' ')} / ${planned}`);
    const gone = applyArea(A, 'object.delete', { id: pst.id });
    ok(S.stairsOf(gone.entities).length === 1 && S.stairsOf(gone.entities)[0].id === rolled.id && S.holesAt(gone.entities, 10).size >= 1, `${tag}: delete the planned stair and the rolled piece is the way up`);
    // the same kind of piece put down by hand (no layout rule) always counts
    const hand = applyArea(A, 'object.place', { id: 'obj_ghand00001', x: 12.5, z: 10, y: 0, rot: 0, cat: 'stair-straight', place: 'kit', dims: [4, 10, 10], room: HALL });
    ok(S.stairsOf(hand.entities).some(x => x.id === 'obj_ghand00001') && S.holesAt(hand.entities, 10).has('2:1') && S.holesAt(hand.entities, 10).has('2:2'), `${tag}: a flight put there by hand opens the floor even so`);
  }
  ok(found >= 3, 'rooms whose layout rolls a flight or a ladder were found to test (cellar, barn, mansion cellar)', `${found}`);
  // a one-storey hall: nothing above the grand stair. No hole anywhere, and a pawn dropped on it is not sent up into the air
  let A = newArea('area_grand005', 'one'); const hallA = { id: HALL, type: 'mansion-hall', x: 0, z: 0, w: 6, d: 6, seed: 1, building: B };
  A = applyArea(A, 'room.spawn', { ...hallA, layout: rg.solve(A.entities, hallA, 1) });
  const st = Object.values(A.entities).find(o => o.cat === 'stair-grand');
  ok(st && S.stairHop(A.entities, st.x, st.z, 0) === null && step(A, st.x, st.z, 0).y === 0 && S.railsOf(A.entities).length === 0 && S.stairLinks(A.entities, st).to === null, 'a grand stair with no storey over it: a pawn dropped on it stays put, and there is no railing');
}

// ---- 3. nothing stair-like is left unsorted ----
{
  const NOT = {
    'stair-landing': 'a level block: the landing of a dog-leg, not a way up by itself',
    'bookcase-ladder': 'a bookcase',
    'chicken-perch-ladder': 'a 30-inch-tall chicken roost, not a flight between storeys',
    'loft-ladder-head': 'only the 36-inch head above a loft floor; no lower flight',
  };
  const like = Object.keys(rg.lib.objects).filter(id => /stair|ladder|spiral/.test(id));
  const unsorted = like.filter(id => !S.STAIR_ROLES[id] && !NOT[id]);
  ok(like.length >= 8 && !unsorted.length, 'every catalog id that reads as a stair or ladder is a stair role or a named exception', unsorted.join(','));
  // things on a table, flats and planned stairs are not catalog stairs
  ok(!S.stairRole({ kind: 'object', cat: 'stair-grand', place: 'stair' }) && !S.stairRole({ kind: 'object', cat: 'stair-half', place: 'kit', parent: 'obj_x' }) && !S.stairRole({ kind: 'object', cat: 'table-round', place: 'floor' }) && S.stairRole({ kind: 'object', cat: 'ladder-wood', place: 'wall' }), 'a planned stair, a thing on a table and ordinary furniture are not catalog stairs');
}

console.log(`grandstair: ${checks - fails}/${checks} passed`);
process.exit(fails ? 1 : 0);
