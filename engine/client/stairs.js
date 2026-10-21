// Stairs in the client (core/stairs.js holds the rules): how one is drawn, placed, and how a pawn crosses it.
//
// DRAWN: the catalog's own stair mesh, fitted to the stair's box [width, rise, run] and turned so that it climbs toward
// the stair's +z (the generated meshes do not agree on which end is up, so the climb is MEASURED from the mesh: the
// horizontal direction along which its vertices get higher). A ladder leans against the far side of its cell. A kind
// with no mesh in the library gets a plain geometric stand-in (stepped boxes; rails and rungs), clearly a stand-in.
import * as THREE from 'three';
import * as HT from '../core/height.js';
import * as ST from '../core/stairs.js';
import { newId } from '../core/ids.js';

const TIMBER = '#7a5a3a', STONE = '#8d8a83';
const standInMat = new Map();
const matOf = (color) => standInMat.get(color) || standInMat.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9 })).get(color);
// the stand-in flight: `steps` boxes rising to `rise` over `run`, climbing toward +z, centred on x and z
export function standInFlight(w, rise, run, color = TIMBER) {
  const g = new THREE.Group(), steps = Math.max(2, Math.round(rise / 0.85)), tread = run / steps, m = matOf(color);
  for (let i = 0; i < steps; i++) { const h = rise * (i + 1) / steps, b = new THREE.Mesh(new THREE.BoxGeometry(w, h, tread), m); b.position.set(0, h / 2, -run / 2 + tread * (i + 0.5)); b.castShadow = b.receiveShadow = true; g.add(b); }
  g.userData.standIn = 'stair'; return g;
}
export function standInLadder(w, rise, color = TIMBER) {
  const g = new THREE.Group(), m = matOf(color), len = rise + 2.5;
  for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.22), m); rail.position.set(sx * w / 2, len / 2, 0); g.add(rail); }
  for (let y = 0.9; y < len - 0.3; y += 1) { const rung = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, 0.14), m); rung.position.set(0, y, 0); g.add(rung); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.standIn = 'ladder'; return g;
}
// which way a mesh climbs: +x, -x, +z or -z in its own frame (the horizontal axis its height follows most closely)
function climbOf(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), v = new THREE.Vector3(), m4 = new THREE.Matrix4();
  let n = 0, sx = 0, sy = 0, sz = 0, sxy = 0, szy = 0, sxx = 0, szz = 0, syy = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 3000)); m4.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m4); n++; sx += v.x; sy += v.y; sz += v.z; sxy += v.x * v.y; szy += v.z * v.y; sxx += v.x * v.x; szz += v.z * v.z; syy += v.y * v.y; }
  });
  if (!n) return { axis: 'z', sign: 1, corr: 0 };
  const cov = (ab, a, b) => ab / n - (a / n) * (b / n), vy = Math.max(1e-9, cov(syy, sy, sy));
  const cx = cov(sxy, sx, sy) / Math.sqrt(Math.max(1e-9, cov(sxx, sx, sx)) * vy), cz = cov(szy, sz, sy) / Math.sqrt(Math.max(1e-9, cov(szz, sz, sz)) * vy);
  return Math.abs(cx) > Math.abs(cz) ? { axis: 'x', sign: Math.sign(cx) || 1, corr: cx } : { axis: 'z', sign: Math.sign(cz) || 1, corr: cz };
}
// a loaded mesh fitted into a box [w, h, d] about the origin (feet on y = 0), after turning it by `yaw`
function fitted(scene, yaw, [w, h, d]) {
  const inner = scene.clone(true), turn = new THREE.Group(), out = new THREE.Group();
  turn.add(inner); turn.rotation.y = yaw; out.add(turn);
  const b = new THREE.Box3().setFromObject(turn), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  turn.position.set(-c.x, -b.min.y, -c.z);
  out.scale.set(w / Math.max(1e-6, s.x), h / Math.max(1e-6, s.y), d / Math.max(1e-6, s.z));
  out.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return out;
}
// the visual of a stair entity (a Promise): in the entity group's frame it climbs toward +z from y = 0 to its rise
export async function stairVisual(assets, e, { color = null } = {}) {
  const kind = ST.stairKind(e), rise = ST.stairRise(e), [w, , run] = e.dims || [4.4, rise, 10], col = color || (/stone/.test(e.sku || '') ? STONE : TIMBER);
  let scene = null;
  if (e.url) { try { scene = await assets.template(e.url); } catch { scene = null; } }
  const holder = new THREE.Group();
  if (kind === 'ladder') {
    const v = scene ? fitted(scene, 0, [w, rise + 2.5, Math.max(0.5, w * 0.35)]) : standInLadder(w, rise, col);
    v.rotation.x = -0.16; v.position.z = 1.7; holder.add(v); // it leans on the edge of the hole above, at the far side of its cell
  } else if (scene) {
    const k = climbOf(scene), yaw = k.axis === 'x' ? -k.sign * Math.PI / 2 : k.sign > 0 ? 0 : Math.PI; // turn its climb onto +z
    holder.add(fitted(scene, yaw, [w, rise, run])); holder.userData.climb = k;
  } else holder.add(standInFlight(w, rise, run, col));
  holder.userData.stair = { kind, standIn: !scene };
  if (!ST.isStair(e)) { const turn = new THREE.Group(); turn.rotation.y = Math.PI; turn.add(holder); turn.userData.stair = holder.userData.stair; return turn; } // an ordinary stair's front is its foot: it climbs toward its own -z
  return holder;
}

export function installStairs(app, { roomgen, toast }) {
  const ents = () => app.entities();
  // plan a stair for a room that exists or is about to (a stub entity): object.place args, or null (app.stairWhy says why)
  app.planStair = (room, entities = ents()) => {
    const P = roomgen.stairFor(entities, room);
    app.stairWhy = P ? '' : roomgen.stairFor.why;
    return P && { ...P, args: { id: newId('obj'), ...P.args } };
  };
  // "Add stair" (the room menu's old entry; kept until the menu drops it): the planner's stair for the selected room
  app.addStair = (room = app.selected().find(e => e.kind === 'room')) => {
    if (!room) { toast('Select a room first: the stair joins it to the storey below (a cellar: to the storey above)', true); return null; }
    const P = app.planStair(room);
    if (!P) { toast(app.stairWhy ? `No stair: ${app.stairWhy}` : 'That room already has a stair (or is on the ground floor with nothing below)', true); return null; }
    app.dispatch('object.place', P.args); toast(`${P.kind === 'ladder' ? 'Ladder' : 'Stair'} added (undo removes it)`);
    return P.args.id;
  };
  // STAIRS UP / STAIRS DOWN (core/stairs.js "UP OR DOWN"): how a stair reads from the level this seat is on, and the
  // switch. It keeps its place in plan and moves one flight, so it leads the other way from this level.
  app.stairSide = (e) => ST.stairSide(e, app.level ?? null);
  app.flipStairs = (list = app.selected().filter(ST.isConnector)) => {
    const ops = list.filter(e => !e.locked).map(e => ({ type: 'stair.flip', args: { id: e.id, ...ST.stairFlip(e, app.level ?? null) } }));
    if (!ops.length) return null;
    const cid = ops.length === 1 ? app.dispatch(ops[0].type, ops[0].args) : app.batch(ops);
    // say at once what it found there (the note over it says the same for as long as it is so)
    const e = app.entities()[ops[0].args.id], Q = e && ST.stairStatus(app.entities(), e);
    if (Q?.code && ops.length === 1) toast(`${ops[0].args.down ? 'Stairs down' : 'Stairs up'}: ${Q.why}`, Q.code !== 'open');
    return cid;
  };
  app.stairStatus = (e) => ST.stairStatus(ents(), e);
  // THE OFFER for a room drawn by hand (core/stairs.js stairOffer; docs/UI.md "Stairs"): nothing is placed. When a
  // straight flight lines up with a hallway or common room, a conditional button offers it; taking it puts the stair
  // in and lays the new room's furniture again round the hole (same seed), as ONE command.
  app.stairOffer = (room, entities = ents()) => { const P = roomgen.stairOffer(entities, room); return P && { ...P, args: { id: newId('obj'), ...P.args } }; };
  // its line in the chat (the conditional button goes down there when its time is up): good for as long as a stair still lines up
  let kindSet = false;
  app.stairOfferKind = () => { if (kindSet || !app.actionLines) return; kindSet = true; app.actionLines.kind('stair-offer', { restorable: true, valid: (d) => { const r = ents()[d.room]; return !r ? 'that room is gone' : ST.hasStair(ents(), r) ? 'it has stairs now' : app.stairOffer(r) ? null : 'no stair lines up there now'; }, run: (d) => { app.takeStairOffer(d.room); } }); };
  // any: not only where one would be offered: the planner's best stair for the room, the room laid again round it
  // (what drawing a room did before 2026-10-11; tests and the building tool use it)
  app.takeStairOffer = (roomId, { any = false } = {}) => {
    const E = ents(), room = E[roomId]; if (!room) return null;
    const P0 = any ? roomgen.stairFor(E, room, { loose: [room.id] }) : null, P = P0 ? { ...P0, args: { id: newId('obj'), ...P0.args } } : any ? null : app.stairOffer(room, E);
    if (!P) { if (!any) toast('No stair lines up there any more: place one from the library', true); return null; }
    const withStair = { ...E, [P.args.id]: { kind: 'object', ...P.args } };
    const L = roomgen.solve(withStair, { id: room.id, type: room.recipe.type, seed: room.recipe.seed }, room.order, roomgen.pinnedOf(E, room.id));
    const cid = app.batch([{ type: 'object.place', args: P.args }, { type: 'room.reroll', args: { id: room.id, seed: room.recipe.seed, engineVersion: roomgen.version, layout: { hash: L.hash, summary: L.summary, objects: L.objects } } }]);
    app.lastStair = cid ? P.args.id : null;
    return cid ? P.args.id : null;
  };
  // A STAIR CORE THROUGH SEVERAL STOREYS, for the building generator (core/stairs.js stairCore; roomgen.stairCore):
  //   app.stairCoreOps({ at: { gx, gz, q }, levels: [0, 10, 20], kind, side, family }) -> { ops: [object.place...], ids, keep }
  //   app.placeStairCore(spec) sends them as one command (one undo) and returns the ids
  app.stairCoreOps = (spec) => {
    const C = roomgen.stairCore(spec), E = ents(), ids = [];
    const ops = C.stairs.map(a => { const id = newId('obj'); ids.push(id); return { type: 'object.place', args: { id, ...a, room: ST.stairRoomAt(E, { kind: 'object', ...a }, a.y) || undefined } }; });
    return { ops, ids, keep: C.keep };
  };
  app.placeStairCore = (spec) => { const C = app.stairCoreOps(spec); return app.batch(C.ops) ? C.ids : null; };
  // where a pawn dropped at (x, z) standing on the floor at height y ends up: the other end of the stair there, or null
  app.stairHop = (x, z, y) => ST.stairHop(ents(), x, z, y);
  app.stairs = () => ST.stairsOf(ents()).map(s => ({ ...ST.stairInfo(ents(), s), home: ST.stairHome(s), side: app.stairSide(s) })); // (tests, the "?" sheet)
  app.ST = ST;
}
// snap a stair being placed or dragged: its cells on the 5-ft grid, a quarter turn, on the floor under the pointer
export function stairPlacement(app, size, x, z, rot, fy) {
  const q = ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4, n = Math.max(1, Math.round((size.dims?.[2] || 5) / 5)), m = Math.max(1, Math.round((size.dims?.[0] || 5) / 5));
  const mid = (v) => Math.floor(v / 5) * 5 + 2.5, line = (v) => Math.round(v / 5) * 5, along = n % 2 ? mid : line, across = m % 2 ? mid : line; // (a piece two squares wide sits on a grid line: the grand stair, a spiral)
  const X = q % 2 ? along(x) : across(x), Z = q % 2 ? across(z) : along(z);
  return { x: X, y: fy, z: Z, rot: q * Math.PI / 2, parent: null, room: app.roomAt(X, Z, fy)?.id || null, edge: null };
}
export { HT };
