// REAL 3D DICE IN THE GAME (2026-10-19; Harry: "We don't have 'dice', we have 'roll'"). The runtime, the look and the
// physics are the Spawn Tuner's (js/fx/dice*.js, imported live like the rest of the look); this surface wires them in.
//
// THE ROLLER throws, once. app.roll picks the numbers as it always has, then asks throwFor(): the roller's pawn (the
// selected one of theirs, else the one of theirs nearest the view's middle) throws toward open floor in front of it,
// away from the camera; with no pawn (the GM) the dice fly from the bottom of the screen toward its middle. Rapier
// (lazy-loaded on the first roll) simulates against diceworld.js's colliders, rejecting throws that end cocked, stacked,
// out of reach or where the roller cannot see (fog, or off the screen). The recording rides on the dice.roll command.
// If the physics is not there in 2.5 s the roll goes out without dice: the chat line never waits on them.
//
// EVERY SEAT plays the recording when the entry arrives (camera, zoom and world copy do not matter), turning each die's
// numbering to the committed number. The chat line and the big announce wait for the dice to settle (the house look's
// timing.result: 'settle', or 'now'). A die is drawn only where THIS viewer can see, the rule pawns follow (a player
// never sees the GM's dice land in the dark). The dice in the air stir the fog (fx addStirrers). Settings ▸ Me ▸ 3D dice
// off: nothing is drawn (the line still comes).
import { T } from '../tuner.js';
import { parseDice } from '../dice.js';
import { diceWorld } from '../diceworld.js';
import { baseUnder } from '../../core/height.js';
import * as THREE from 'three';

const THROW_WAIT_MS = 2500, MAX_DICE = 24;
// does the segment a -> b pass through box b (centre, half extents, turned yaw about y)? (the slab test, in its frame)
function segHitsBox(ax, ay, az, bx, by, bz, B) {
  const c = Math.cos(B.yaw || 0), s = Math.sin(B.yaw || 0), loc = (x, z) => { const dx = x - B.x, dz = z - B.z; return [dx * c - dz * s, dx * s + dz * c]; };
  const [a0, a2] = loc(ax, az), [b0, b2] = loc(bx, bz), A = [a0, ay - B.y, a2], D = [b0 - a0, by - ay, b2 - a2], H = [B.hx, B.hy, B.hz];
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(D[i]) < 1e-9) { if (Math.abs(A[i]) > H[i]) return false; continue; }
    let u = (-H[i] - A[i]) / D[i], v = (H[i] - A[i]) / D[i]; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}

export function diceSurface(R, app) {
  if (!T.fx?.createDice) return { name: 'dice' }; // (an old tuner without dice: rolls stay chat lines)
  const reduced = () => app.prefs?.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  const simple = () => app.gfx?.info?.().resolved === 'low';
  const on = () => app.prefs?.dice3d !== false;
  const open = (r) => !!r?.roof?.off || !!T.walls?.isOutdoor?.(r?.recipe?.type);
  const playing = new Map(); // roll id -> { world, settled }
  const started = new Set(); // roll ids already played here (the roller's own echo, after its dice are gone, plays nothing)
  const levels = new Map();  // `${id}:${i}` -> the floor a die came to rest on (for the sight test)

  function runtime(w) {
    if (w.dice) return w.dice;
    w.dice = T.fx.createDice({ scene: w.scene, params: T.house.dice, rapierUrl: T.fx.RAPIER_URL, reduced, simple,
      onSettle: (id) => { const p = playing.get(id); if (p) p.settled = true; app.emit('dice', id); app.gfx?.wake('dice'); } });
    w.fx?.addStirrers?.(() => w.dice.stirrers()); // the dice in the air stir the fog, as pawns and cursors do
    return w.dice;
  }
  const facing = (cam) => { const d = new THREE.Vector3(); cam.getWorldDirection(d); d.y = 0; if (d.lengthSq() < 1e-6) d.set(0, 0, -1); return d.normalize(); };
  function groundHit(cam, ndcX, ndcY, y) {
    const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);
    const p = new THREE.Vector3(); return r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
  }
  // THE ROLLER: where from, where to, what is in the way; then the throw
  async function throwFor(terms, rolls, { fromView = false } = {}) {
    const list = T.fx.diceOfRoll(terms, rolls);
    if (!list.length || list.length > MAX_DICE) return null;
    const area = app.area(), w = app.worldOf(area), v = app.view(area), cam = app.main?.camera;
    if (!w || !v || !cam) return null;
    const E = v.entities, me = app.me(), focus = app.main.grab.focus;
    const mine = fromView ? [] : Object.values(E).filter(e => e.kind === 'token' && e.owner === me && !e.hidden);
    const pick = mine.find(e => app.sel?.has(e.id)) || mine.filter(e => app.canSeePawn?.(e, area) !== false).sort((a, b) => Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z))[0];
    const dir = facing(cam);
    let from, to, level;
    if (pick && Math.hypot(pick.x - focus.x, pick.z - focus.z) < 60) {
      level = baseUnder(E, pick.x, pick.z, pick.y || 0, open).y;
      from = { x: pick.x, z: pick.z, y: level + 3, r: 0.9 * Math.max(0.5, pick.size || 1), floor: level };
      to = { x: pick.x + dir.x * 8, z: pick.z + dir.z * 8, y: level };
    } else {
      level = baseUnder(E, focus.x, focus.z, 0, open).y;
      const mid = groundHit(cam, 0, 0, level) || new THREE.Vector3(focus.x, level, focus.z), low = groundHit(cam, 0, -0.8, level) || mid.clone().addScaledVector(dir, -8);
      let d = Math.hypot(mid.x - low.x, mid.z - low.z); const k = d > 9 ? 9 / d : 1;
      from = { x: mid.x - (mid.x - low.x) * k, z: mid.z - (mid.z - low.z) * k, y: level + 3, r: 0, floor: level };
      to = { x: mid.x, z: mid.z, y: level };
      // the bottom of the screen can be outside the room the view looks into: then the hand starts inside that room
      // (4 ft in from its walls), never over a wall
      const room = Object.values(E).find(r => r.kind === 'room' && r.recipe && !r.hidden && Math.abs((r.recipe.y || 0) - level) < 0.5 && to.x >= r.recipe.x * 5 && to.x <= (r.recipe.x + r.recipe.w) * 5 && to.z >= r.recipe.z * 5 && to.z <= (r.recipe.z + r.recipe.d) * 5);
      if (room) { const R = room.recipe, m = Math.min(4, R.w * 2.5 - 0.5, R.d * 2.5 - 0.5), c = (v, a, b) => Math.max(a + m, Math.min(b - m, v)); from.x = c(from.x, R.x * 5, (R.x + R.w) * 5); from.z = c(from.z, R.z * 5, (R.z + R.d) * 5); }
    }
    const world = diceWorld({ entities: E, edges: w.edges, from, level, reach: Math.max(20, (runtime(w).params.reject.reach || 12) + 6), isOpen: open }); // (out past the reach: a die that gets there still meets the walls)
    const ndc = new THREE.Vector3();
    const onScreen = (x, z) => { ndc.set(x, level, z).project(cam); return ndc.z < 1 && Math.abs(ndc.x) < 0.94 && Math.abs(ndc.y) < 0.92; };
    // and the dice stay in the room they were thrown into (when the target is in one): never through, into or behind a wall
    const tr = Object.values(E).find(r => r.kind === 'room' && r.recipe && !r.hidden && Math.abs((r.recipe.y || 0) - level) < 0.5 && to.x >= r.recipe.x * 5 && to.x <= (r.recipe.x + r.recipe.w) * 5 && to.z >= r.recipe.z * 5 && to.z <= (r.recipe.z + r.recipe.d) * 5)?.recipe;
    const inRoom = tr ? (x, z) => x > tr.x * 5 + 0.8 && x < (tr.x + tr.w) * 5 - 0.8 && z > tr.z * 5 + 0.8 && z < (tr.z + tr.d) * 5 - 0.8 : () => true;
    // and the roller's camera sees it: no wall between the eye and the die (a die behind the near wall is out of sight)
    const eye = cam.position, walls = world.boxes.filter(b => b.wall);
    const behindWall = (x, z) => walls.some(b => segHitsBox(eye.x, eye.y, eye.z, x, level + 0.8, z, b));
    const visible = (x, z) => inRoom(x, z) && app.fog.visible(x, z, level, area) && onScreen(x, z), rest = (x, z) => !behindWall(x, z);
    const r = await runtime(w).simulate({ dice: list.map(d => d.type), from, to, world, visible, rest, by: me });
    app.dice.last = { from, to, level, world: { surfaces: world.surfaces.length, boxes: world.boxes.length, cylinders: world.cylinders.map(c => c.id), things: world.boxes.filter(b => b.id).map(b => b.id), walls: world.boxes.filter(b => b.wall).length, left: world.left }, tries: r.tries, reasons: r.reasons, fallback: r.fallback, gentled: r.gentled || null, ms: r.ms, bytes: r.rec.b.length };
    return r.rec;
  }
  // EVERY SEAT: a committed roll with a throw
  // (the roller calls it as it sends the roll, before the echo; every seat on the entry; a second call is a no-op)
  function start(e) {
    if (e?.type !== 'dice.roll' || !e.args?.throw || !on() || started.has(e.args.id)) return;
    started.add(e.args.id); if (started.size > 400) started.delete(started.values().next().value);
    const w = app.worlds.get(e.area); if (!w || w.local) return;
    const p = parseDice(e.args.expr); if (!p) return;
    const list = T.fx.diceOfRoll(p.terms, e.args.rolls);
    if (list.length !== e.args.throw.d?.length || list.some((d, i) => d.type !== e.args.throw.d[i])) return; // (a recording for other dice: play none)
    try {
      const color = app.seatColor(e.by);
      const D = runtime(w);
      playing.set(e.args.id, { world: w, settled: false, area: e.area });
      D.play({ id: e.args.id, rec: e.args.throw, values: list.map(d => d.value), color, by: e.by, tagFor: { color } }).then(() => { const q = playing.get(e.args.id); if (q) q.settled = true; app.emit('dice', e.args.id); });
      app.gfx?.wake('dice');
    } catch (err) { console.warn('dice', err); playing.delete(e.args.id); }
  }
  // A ROLL WITH NO THROW BY AN AI SEAT (2026-10-20): it rolled over GET, where the relay picks the numbers and nothing
  // simulates (relay/llm.js diceArgs). Every browser looking at that area throws those dice ITSELF, from the bottom of
  // its own view toward the middle (no pawn of its own), and lands them on the committed numbers: one result for
  // everyone, each seat its own tumble. The line is held while the throw is worked out (THROW_WAIT_MS at most; then it
  // simply shows). A person's roll that went out without dice (no physics in time) stays a plain line, as before.
  const local = new Map(); // roll id -> ms the line is held until
  function throwHere(e) {
    if (e?.type !== 'dice.roll' || e.args?.throw || !on() || started.has(e.args?.id) || local.has(e.args?.id) || e.area !== app.area() || e.by === app.me()) return;
    if (app.sync?.campaign?.seats?.find(s => s.id === e.by)?.kind !== 'llm') return;
    const p = parseDice(e.args.expr); if (!p) return;
    local.set(e.args.id, Date.now() + THROW_WAIT_MS);
    Promise.race([throwFor(p.terms, e.args.rolls, { fromView: true }), new Promise(res => setTimeout(() => res(null), THROW_WAIT_MS))])
      .then(rec => { if (rec && e.area === app.area()) start({ ...e, args: { ...e.args, throw: rec } }); }, err => console.warn('dice (AI roll)', err))
      .finally(() => { local.delete(e.args.id); app.emit('dice', e.args.id); });
  }
  app.on((what, e) => { if (what === 'entry') { start(e); throwHere(e); } });
  // every frame (before the views draw): step the dice, and show each one only where this viewer can see
  app.diceFrame = (now) => {
    let any = false;
    for (const w of app.worlds.values()) {
      if (!w.dice || !w.dice.active()) continue;
      any = w.dice.frame(now) || any;
      const area = w.areaId, fogOn = app.fog?.active?.(area);
      for (const d of w.dice.root.children) {
        if (!fogOn) { d.visible = true; continue; }
        const k = d.userData.dieId; let lv = levels.get(k);
        if (lv == null) { lv = baseUnder(w.view?.entities, d.position.x, d.position.z, d.position.y, open).y; levels.set(k, lv); }
        d.visible = app.fog.visible(d.position.x, d.position.z, lv, area);
      }
    }
    for (const [id, p] of playing) if (!p.world.dice?.has(id)) playing.delete(id);
    if (levels.size > 500) levels.clear();
    return any;
  };
  app.dice = {
    throwFor, start,
    // the chat line (and the big announce) wait for the dice to settle, unless the house look says "at once"
    holding: (id) => { if (local.get(id) > Date.now()) return true; const p = playing.get(id); return !!p && !p.settled && (p.world.dice?.params.timing.result || 'settle') === 'settle'; },
    busy: () => [...app.worlds.values()].some(w => w.dice?.busy()),
    active: () => [...app.worlds.values()].reduce((n, w) => n + (w.dice?.active() || 0), 0),
    // (tests) what each world shows: per throw, each die's pose, the number on its top, and whether it is drawn here
    info: () => [...app.worlds.values()].filter(w => w.dice).flatMap(w => w.dice.info().map(t => ({ area: w.areaId, ...t, drawn: t.dice.map((_, i) => !!w.dice.root.children.find(g => g.userData.dieId === `${t.id}:${i}`)?.visible) }))),
    seek: (id, sec) => { for (const w of app.worlds.values()) if (w.dice?.has(id)) return w.dice.seek(id, sec); return null; },
    clear: () => { for (const w of app.worlds.values()) w.dice?.clear(); playing.clear(); },
    world: (opts) => diceWorld(opts),
    // (tests) IN-FRAME A/B, one task, nothing moves between: the main view drawn with the dice as this viewer has them,
    // then with the dice taken out; how many pixels differ (0 = no die of theirs reaches this screen)
    abPixels() {
      const r = app.diceRenderer, w = app.worldOf(app.area()), cam = app.main?.camera; if (!r || !w || !w.dice) return null;
      const W = r.domElement.width, H = r.domElement.height, rt = new THREE.WebGLRenderTarget(W, H), a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
      const shot = (out) => { r.setRenderTarget(rt); r.setViewport(0, 0, W, H); r.setScissorTest(false); r.clear(); r.render(w.scene, cam); r.readRenderTargetPixels(rt, 0, 0, W, H, out); r.setRenderTarget(null); };
      shot(a); const was = w.dice.root.visible; w.dice.root.visible = false; shot(b); w.dice.root.visible = was; rt.dispose();
      let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
      return { px: n, dice: w.dice.root.children.length, drawn: w.dice.root.children.filter(g => g.visible).length };
    },
    last: null,
    THROW_WAIT_MS,
  };
  return { name: 'dice' };
}
