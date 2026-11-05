// FIRST PERSON (Harry 2026-10-29: "let's also do first person (should probably be a button in the pawns menu for that
// pawn owner or gm rather than scroll in. Maybe something in the players orbital too)"). Earlier the plan was a last
// zoom detent (docs/UI.md "map → table → first person", the Map Garden trick); Harry made it an explicit button.
//
//   ENTER    "Eyes" on the closed ring of a player's own pawn; "First person" in a pawn's ☰ for its owner and the GM
//            (Space E in the chords); V with one such pawn selected, or (a player) with nothing selected: your main pawn.
//            Only a pawn the seat may move (app.canTouch: its owner, or the GM). A GM in someone else's pawn moves it as GM.
//   THE VIEW the camera at the figure's eyes (EYE_SHARE of its drawn height: figures.js FIGURE_SCALE is in that height),
//            facing the pawn's facing; the pawn's own figure, base and name are not drawn for this seat. The map's camera
//            is kept underneath (its focus held on the pawn, so far rooms sleep and LOD picks as if zoomed right in) and
//            is given back EXACTLY on the way out: the pose, the rule, the cut, the roofs, the selection, the lens.
//   LOOK     (Harry 2026-11-01: "adjust the speed and direction of the mouse drag so that it matches whatever we are using
//            in mapgarden") a MOUSE drag is Map Garden's look: the view follows the mouse (drag right turns right, drag up
//            looks up), LOOK.degPerPx at a 1280 x 720 window and less as the window grows, either button. A FINGER still
//            grabs the world (drag right and the view turns left, LOOK.fingerDegPerPx: Map Garden has no touch look to
//            match). Q / E turn. "Lock mouse" (off unless asked: it is a web page) takes the pointer until Esc.
//   MOVE     (Harry 2026-10-30: "I get stuck on stuff because I'm trapped on the grid") W A S D or the arrows WALK while
//            held, at WALK.speed (Shift runs), forward / back / sideways from where you look, in any direction (two keys
//            add up: W D goes forward-right), and mouse look steers while you walk. The body is a circle (WALK.radius) that
//            SLIDES along what stops it and rounds a doorway's corner instead of stopping dead: a wall, a shut door, a
//            window, bars or a cave's rock (what stops sight, plus windows and shut bars: moveSegments). Furniture does
//            not stop a pawn (the map's own tabletop rule). Heights are the arrow keys' (app.walkStep = moveBy's rule:
//            stairs and levels by core/height.js pawnStepTo, hills); out over a drop or onto a pit the walk stops there and
//            the fall is offered; a ladder or a spiral takes you to its other end (and the walk stops).
//            THE PAWN goes with you: its place is journalled as you walk (token.move at most every WALK.sendMs, so the fog
//            of war's reveal follows the real pawn), every other seat sees it glide (presence, as a drag), and one walk,
//            key down to key up, is ONE undo step (token.move `walk`, relay/campaign.js). Where you stop it stays, off the
//            squares, as a dragged pawn does; with "Pawns snap to squares: always" it settles on the nearest square it
//            may stand on, and a tap is one square on (the old step). Click (tap) a floor you can see to walk there; click
//            a door you may open to open or shut it. The facing follows the view: sent with the walk, and a turn alone is
//            sent TURN_MS after you stop turning.
//   SEEN     no more than the seat sees on the map: fog of war, darkness, hidden rooms are the map's own rules
//            (client/fog.js, the relay's withholding). The cut is lifted while you look and every covered room near you
//            has a ceiling (client/ceilings.js), so a level above you is a ceiling, not a hole. Roofs stay as the seat had
//            them (on a big map turning them on costs a whole roof pass per move).
//   OTHERS   every other seat sees a small "eye" tag over the pawn while someone looks through it (presence `eyes`,
//            core/presence.js; the relay passes it for a pawn the seat may move and keeps it off players' screens when
//            the pawn is hidden). Dice thrown meanwhile come from this pawn, ahead of it (surfaces/dice.js).
//   OUT      Esc (once whatever Esc closes first is closed), V, or the Exit button. Also when the pawn goes away, travels,
//            is given to someone else, or the area changes.
import * as THREE from 'three';
import { icon } from '../icons.js';
import * as HT from '../../core/height.js';
import { blockingSegments, seeThrough } from '../vision.js';
import { createCeilings } from '../ceilings.js';

export const FPV = {
  eyeShare: 0.92,      // the eyes, as a share of the figure's drawn height over its base
  minEye: 1.5,         // ft: never lower than this (a tiny figure, a stand-in still loading)
  fov: 65, near: 0.25, far: 260,
  pitch0: -6,          // degrees: where you look on the way in (a little down)
  pitchMax: 80,
  glide: 11,           // the camera's glide toward the eyes (1/s)
  stepMs: 260,         // app.fpv.step's pace (tests, the API: one square)
  turnMs: 650,         // a turn alone is sent once you have stopped turning this long
  turnRate: 110,       // degrees per second (Q / E held)
  wake: 40,            // ft round the eyes inside which a covered room is drawn (world.js unseenAt)
  walkMax: 16,         // squares: the furthest a click walks
  sky: '#7e8f9b',      // the sky in daylight (an area in darkness keeps its dark)
  roofRooms: 60,       // roofs go on while looking on a map of up to this many rooms (more: as the seat had them)
};
// WALKING (2026-10-30). Each one a constant to change.
export const WALK = {
  speed: 11,           // ft/s, a key held: about two squares a second (the old step was a square every 260 ms, 19 ft/s, in hops)
  run: 1.8,            // x the pace with Shift held
  accel: 16,           // 1/s: how quickly the pace comes up and dies away (63% in ~60 ms: no ice, no lurch)
  radius: 1.5,         // ft: the body against walls, for a pawn one square across: the eyes stay a foot off a wall's face (its
                       // half-thickness is 6 in; Gemini at 1.2: "so close the wall fills the view"); a 5-ft doorway leaves 1 ft a side
  bigRadius: 2.0,      // ft: the most for a bigger pawn (it still fits through a doorway, as it does on the map)
  sub: 0.4,            // ft: the longest substep (each is pushed out of the walls it meets; none is ever crossed)
  sendMs: 250,         // the pawn's place is journalled at most this often while walking (the old step's own pace)
  minHoldMs: 120,      // a tap walks at least this long (so a tap is never nothing)
  stuckMs: 600,        // a click's walk that gets no nearer its next square for this long gives up there
};
// LOOK. Map Garden turns 0.11 degrees per Godot canvas unit (scaling/first_person.gd LOOK_SENSITIVITY), and its canvas is
// 1280 x 720 stretched to fit (canvas_items + expand), so a pixel of mouse is worth less on a bigger window: the same share of
// the window turns the same. Measured there at 1280 x 720, 1512 x 860 and 2560 x 1300: 0.110, 0.093 and 0.061 degrees a pixel.
export const LOOK = {
  degPerPx: 0.11, baseW: 1280, baseH: 720, // a mouse drag, degrees a CSS pixel at that window (mouseDegPerPx)
  sign: -1,                                // -1: the view follows the mouse; 1: the drag grabs the world
  fingerDegPerPx: 0.28, fingerSign: 1,     // a finger (or a pen) on the glass: grabs the world
  lockedDegPerPx: 0.16,                    // "Lock mouse": the view follows the mouse
};
export const mouseDegPerPx = (w, h) => LOOK.degPerPx / Math.min(w / LOOK.baseW, h / LOOK.baseH);
export const FPV_KEY = 'V';
const MOVES = { w: 0, arrowup: 0, s: Math.PI, arrowdown: Math.PI, a: Math.PI / 2, arrowleft: Math.PI / 2, d: -Math.PI / 2, arrowright: -Math.PI / 2 };
const D2R = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;

export function fpvSurface(R, app) {
  const canvas = document.getElementById('c');
  let S = null; // the live first person, or null
  const E = () => app.entities();
  const world = () => app.worldOf(app.area());
  const field = (ev) => !!ev.target?.closest?.('input, textarea, select, [contenteditable]');
  const canEnter = (e) => e?.kind === 'token' && app.canTouch(e);
  // the pawn V means: one selected pawn you may move; else (nothing selected) a player's main pawn, else their first
  function targetOf(ctx) {
    if (ctx.sel.length) return ctx.sel.length === 1 && canEnter(ctx.sel[0]) ? ctx.sel[0] : null;
    if (app.gm()) return null;
    const own = Object.values(E()).filter(e => e.kind === 'token' && e.owner === app.me() && !e.hidden);
    return own.find(e => e.main) || own.sort((a, b) => String(a.name).localeCompare(String(b.name)))[0] || null;
  }
  R.add({ id: 'pawn.eyes', title: 'First person (look through its eyes)', short: 'Eyes', icon: 'eye', group: 'Pawn', menu: true, keys: [FPV_KEY],
    synonyms: ['first person', 'eyes', 'look through their eyes', 'pov', 'fpv', 'point of view', 'walk around', 'eye level', 'hero eye', 'step into'],
    // on the ring of a player's OWN pawn (the GM, and a player's ☰ on any other: the menu); everyone else, ☰
    ring: { kinds: ['pawn'], slot: 15.6, only: (ctx) => !!ctx.one && ctx.one.owner === app.me() && !app.gm() },
    when: (ctx) => !S && !!targetOf(ctx), run: (ctx) => enter(targetOf(ctx)?.id) });
  R.add({ id: 'view.eyesOut', title: 'Leave first person', short: 'Leave first person', icon: 'log-out', group: 'View', keys: [FPV_KEY], hidden: true,
    synonyms: ['exit first person', 'leave eyes', 'back to the map', 'map view'], when: () => !!S, run: () => exit() });

  // ---------- the HUD: Exit, whose eyes, the hint, (a phone) the steps ----------
  const hud = document.createElement('div'); hud.id = 'fpvHud'; hud.hidden = true;
  hud.innerHTML = `<div class="fpv-top"><button class="fpv-exit" type="button">${icon('log-out', 15)}<span>Exit</span><kbd>Esc</kbd></button><span class="fpv-who"></span><button class="fpv-lock" type="button" title="Mouse look without holding the button (Esc gives the mouse back)">${icon('mouse-pointer-2', 14)}<span>Lock mouse</span></button></div>
    <div class="fpv-hint">Drag to look · hold <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to walk (<kbd>Shift</kbd> runs) · <kbd>Q</kbd><kbd>E</kbd> turn · click a floor to walk there, a door to open it</div>
    <div class="fpv-hint-hand">Drag to look · tap a floor to walk there · hold an arrow to walk</div>
    <i class="fpv-dot"></i>
    <div class="fpv-pad"><button data-m="w" aria-label="Step forward">${icon('chevron-up', 22)}</button><button data-m="a" aria-label="Step left">${icon('chevron-left', 22)}</button><button data-m="s" aria-label="Step back">${icon('chevron-down', 22)}</button><button data-m="d" aria-label="Step right">${icon('chevron-right', 22)}</button></div>`;
  document.getElementById('app').append(hud);
  for (const b of hud.querySelectorAll('button')) { b.addEventListener('pointerdown', (ev) => ev.stopPropagation()); b.addEventListener('mousedown', (ev) => ev.preventDefault()); }
  hud.querySelector('.fpv-exit').onclick = () => exit();
  hud.querySelector('.fpv-lock').onclick = () => { try { canvas.requestPointerLock?.(); } catch { } };
  // the phone's pad: hold to walk (a tap: a short walk; with squares on, one square)
  for (const b of hud.querySelectorAll('.fpv-pad button')) {
    const k = 'pad-' + b.dataset.m, off = () => { if (S) letGo(k); };
    b.addEventListener('pointerdown', (ev) => { if (!S) return; ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch { } press(k, MOVES[b.dataset.m]); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, off);
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  // the tags other seats see over a pawn someone looks through
  const tags = document.createElement('div'); tags.id = 'fpvTags'; document.getElementById('app').append(tags);
  const tagEls = new Map();

  // ---------- in and out ----------
  function enter(id) {
    if (S) exit();
    const e = id && E()[id], w = world(), V = app.main;
    if (!canEnter(e) || !w || !V) { if (e) app.toast(`${e.name || 'That pawn'} is not yours to look through`, true); return false; }
    const rec = w.recs.get(id); if (!rec) { app.toast('That pawn is not drawn here yet', true); return false; }
    const cam = V.camera;
    S = { id, area: app.area(), V, w, held: new Map(), turn: new Set(), queue: [], hidden: new Set(), stepAt: 0, eye: null, eyeOff: null, eyeAt: 0, heading: e.rot || 0, pitch: FPV.pitch0 * D2R,
      lastRot: e.rot || 0, rotDirty: false, turnedAt: 0, drag: null, lastSq: null, bumps: 0, steps: 0, blocked: 0,
      pos: null, vel: [0, 0], walk: null, path: null, halt: false, run: false, release: new Map(), walks: 0, contact: 0, walked: 0,
      saved: { pose: V.pose(), rule: V.rule, follow: V.follow, fov: cam.fov, near: cam.near, far: cam.far, cut: app.cut?.y ?? null, roofs: !!app.roofs, sel: [...app.sel], bg: w.scene.background?.clone?.() || null, grid: w.grid?.visible } };
    S.ceil = createCeilings(w);
    app.clearSelection();
    if (app.cut?.y != null) { app.setCut(null, { by: 'fpv' }); w.flyCut = undefined; } // (no levels flying in: you were already standing here)
    // ROOFS ON while looking, on a map of up to FPV.roofRooms rooms (a building seen from outside has its roof, not an open
    // top: Gemini r3, "open dollhouse"); on a bigger map they stay as you had them: every step there is a whole roof pass
    // (measured, experiments/2026-10-29-fpv/LAB_NOTES.md). Put back on the way out.
    if (!app.roofs && Object.values(E()).filter(r => r.kind === 'room').length <= FPV.roofRooms) { app.setRoofs(true, 'fpv'); S.roofsOn = true; }
    cam.fov = FPV.fov; cam.near = FPV.near; cam.far = FPV.far; cam.updateProjectionMatrix();
    if (!app.fog?.dark?.()) w.scene.background = new THREE.Color(FPV.sky);
    if (w.grid) w.grid.visible = false; // (the build grid at eye level is a moiré to the horizon)
    if (w.levelGrid) w.levelGrid.visible = false; // (and so is the grid of a level being built on: Harry 2026-11-03, one grid, the one you draw on, and none at eye level)
    w.eye = { x: e.x, z: e.z, r: FPV.wake }; w.cutGen = (w.cutGen || 0) + 1;
    w.fogDrawOff = true; // (fog of war's overlay is a top-down look: not drawn at eye level; client/fog.js. What a seat may not see stays withheld.)
    V.glide = null; V.eyes = (c, dt) => frame(c, dt);
    document.documentElement.classList.add('tw-fpv');
    hud.hidden = false; hud.querySelector('.fpv-who').textContent = `${e.name || 'Pawn'}'s eyes`;
    app.ps.setEyes?.(S.area, id);
    app.fpvLog.push({ in: id, at: Date.now() }); if (app.fpvLog.length > 50) app.fpvLog.shift();
    app.emit('fpv', id); app.gfx?.wake?.('fpv'); app.refresh();
    return true;
  }
  function exit() {
    if (!S) return false;
    const s = S;
    if (s.walk) { const e = E()[s.id]; if (e) finishWalk(s, e, { snap: true }); else s.walk = null; }
    S = null;
    if (s.rotDirty) sendRot(s, true);
    for (const c of s.hidden) c.visible = true;
    const dl = s.w.dropLines?.get(s.id); if (dl && s.dropWas != null) dl.visible = s.dropWas;
    s.ceil.clear(); s.w.eye = null; s.w.eyeLevel = null; s.w.fogDrawOff = false; s.w.cutGen = (s.w.cutGen || 0) + 1;
    if (s.saved.bg) s.w.scene.background = s.saved.bg; if (s.w.grid && s.saved.grid != null) s.w.grid.visible = s.saved.grid; if (s.w.levelGrid) s.w.levelGrid.visible = true;
    const V = s.V, cam = V.camera; V.eyes = null;
    cam.fov = s.saved.fov; cam.near = s.saved.near; cam.far = s.saved.far; cam.updateProjectionMatrix();
    V.glide = null; V.setPose(s.saved.pose); V.rule = s.saved.rule; V.follow = s.saved.follow;
    if (s.saved.cut != null && app.cut?.y !== s.saved.cut) { app.setCut(s.saved.cut, { by: 'fpv' }); s.w.flyCut = undefined; }
    if (s.roofsOn && app.roofs) app.setRoofs(false, 'fpv');
    if (document.pointerLockElement === canvas) try { document.exitPointerLock(); } catch { }
    document.documentElement.classList.remove('tw-fpv'); hud.hidden = true;
    app.ps.setEyes?.(s.area, null);
    const ents = E(); if (app.area() === s.area) app.select(s.saved.sel.filter(id => ents[id] || app.ent?.(id)));
    app.fpvLog.push({ out: s.id, at: Date.now(), steps: s.steps, blocked: s.blocked }); if (app.fpvLog.length > 50) app.fpvLog.shift();
    app.emit('fpv', null); app.gfx?.wake?.('fpv'); app.refresh();
    return true;
  }

  // ---------- every frame, after the grab camera: the eyes ----------
  const P = new THREE.Vector3(), DIR = new THREE.Vector3(), B = new THREE.Box3();
  function frame(cam, dt) {
    const s = S; if (!s) return;
    const e = E()[s.id], rec = s.w.recs.get(s.id);
    if (!e || !rec || app.area() !== s.area || app.main !== s.V || !app.canTouch(e) || app.worldOf(app.area()) !== s.w) { queueMicrotask(() => { if (S === s) { exit(); if (!e) app.toast('That pawn is gone'); } }); return; }
    const now = performance.now();
    // the eyes' height over the pawn's group (measured with the figure there; again a few times in the first seconds, as
    // a figure's mesh can arrive after the stand-in)
    if (s.eyeOff == null || (now - s.eyeAt > 400 && s.eyeChecks < 8)) {
      rec.group.updateMatrixWorld(true); rec.group.getWorldPosition(P);
      const b = s.w.boundsOf?.(rec, 'figure') || B.setFromObject(rec.group);
      const off = b && Number.isFinite(b.max.y) ? Math.max(FPV.minEye, (b.max.y - P.y) * FPV.eyeShare) : 4;
      if (s.eyeOff == null || Math.abs(off - s.eyeOff) > 0.05) s.eyeOff = off;
      s.eyeAt = now; s.eyeChecks = (s.eyeChecks || 0) + 1;
    }
    // the pawn's own figure, base and name are not drawn for this seat
    for (const c of rec.group.children) if (c.visible) { c.visible = false; s.hidden.add(c); }
    const dl = s.w.dropLines?.get(s.id); if (dl) { if (s.dropWas == null) s.dropWas = dl.visible; dl.visible = false; }
    if (s.w.grid?.visible) s.w.grid.visible = false; // (the area's grid rule puts it back on a settings pass: not while you look)
    if (s.w.levelGrid?.visible) s.w.levelGrid.visible = false; // (a level grid made while you look, e.g. the build tool picked up)
    // turning (Q / E held)
    if (s.turn.size) { const k = (s.turn.has('q') ? 1 : 0) - (s.turn.has('e') ? 1 : 0); if (k) { s.heading += k * FPV.turnRate * D2R * dt; turned(s, now); } }
    // someone else turned it (the GM, an undo): the view follows, unless this seat is turning it now
    if (!s.rotDirty && !s.drag && Math.abs(angleDiff(e.rot || 0, s.lastRot)) > 1e-3) { s.heading = e.rot || 0; s.lastRot = e.rot || 0; }
    // walking (a held key, a click's path): the walker moves, the pawn's place follows it (walkFrame)
    walkFrame(s, e, dt, now);
    // where the eyes go: the pawn's drawn place, its eyes above that; the camera glides there (a long way: a jump).
    // Walking, the eyes ARE the walker (no glide across the floor: that would be lag), its height still glides (a stair)
    rec.group.getWorldPosition(P);
    if (s.pos) { P.x = s.pos.x; P.z = s.pos.z; P.y += s.pos.y - (e.y || 0); }
    P.y += s.eyeOff;
    if (!s.eye || s.eye.distanceTo(P) > 30) s.eye = P.clone();
    else if (s.pos) { s.eye.x = P.x; s.eye.z = P.z; s.eye.y += (P.y - s.eye.y) * (1 - Math.exp(-dt * FPV.glide)); }
    else s.eye.lerp(P, 1 - Math.exp(-dt * FPV.glide));
    const cp = Math.cos(s.pitch);
    DIR.set(Math.sin(s.heading) * cp, Math.sin(s.pitch), Math.cos(s.heading) * cp);
    cam.position.copy(s.eye); cam.up.set(0, 1, 0); cam.lookAt(P.copy(s.eye).add(DIR)); cam.updateMatrixWorld();
    // the map's camera underneath, held on the pawn (far rooms sleep by it, the LOD picks as if zoomed right in)
    const g = s.V.grab; g.focus.set(s.eye.x, 0, s.eye.z); g.dist = g.minDist;
    // the covered rooms round the eyes are drawn (world.js unseenAt), the ceilings follow, a square at a time
    const sq = `${Math.floor(s.eye.x / 5)}:${Math.floor(s.eye.z / 5)}`;
    s.w.eye = { x: s.eye.x, z: s.eye.z, r: FPV.wake };
    if (sq !== s.lastSq) { const was = s.lastEye; s.lastSq = sq; s.lastEye = { x: s.eye.x, z: s.eye.z }; if (coveredNear(s.w, was, s.lastEye)) s.w.cutGen = (s.w.cutGen || 0) + 1;
      // the fog's level is the pawn's (world.js fogLevel, client/fog.js: the levels above it are not drawn as sheets in the sky)
      const lv = HT.sightLevel(E(), e.x, e.z, e.y || 0, (r) => s.w.isOpenRoom(r)); if (lv !== s.w.eyeLevel) { s.w.eyeLevel = lv; s.w.cutGen = (s.w.cutGen || 0) + 1; } } // (a pass over the whole map: only when a covered room is near where the eyes were or are)
    s.ceil.sync(s.eye, now);
    // app.fpv.step's squares (the API, tests)
    if (s.queue.length && now - s.stepAt >= FPV.stepMs) { const [tx, tz] = s.queue.shift(); if (!stepTo(tx, tz)) s.queue.length = 0; }
    if (s.rotDirty && !s.drag && !s.walk && now - s.turnedAt > FPV.turnMs) sendRot(s);
    app.gfx?.wake?.('fpv'); // (while you look the picture keeps up: graphics.js idle rate)
  }
  // is any covered room (world.js cutSets: under a floor, under the ground, under its roof) within the wake reach of
  // either place? Only then can the eyes change what is drawn (world.js unseenAt)
  function coveredNear(w, a, b) {
    const ids = w.unseenNear; if (!ids?.size) return false; const E = w.view?.entities || {}, R = FPV.wake + 5;
    for (const id of ids.keys()) { const rc = E[id]?.recipe; if (!rc) continue; const x0 = rc.x * 5 - R, z0 = rc.z * 5 - R, x1 = (rc.x + rc.w) * 5 + R, z1 = (rc.z + rc.d) * 5 + R;
      for (const p of [a, b]) if (p && p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1) return true; }
    return false;
  }
  const angleDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
  function turned(s, now = performance.now()) { s.rotDirty = true; s.turnedAt = now; }
  function sendRot(s, force = false) {
    const e = E()[s.id]; s.rotDirty = false; if (!e || !app.canTouch(e)) return;
    const rot = +(((s.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(4);
    if (!force && Math.abs(angleDiff(rot, e.rot || 0)) < 2 * D2R) return;
    s.lastRot = rot; app.dispatch('token.move', { id: e.id, x: e.x, z: e.z, rot });
  }

  // ---------- WALKING (2026-10-30): the walker, its walls, the pawn's place as it goes ----------
  const radiusOf = (e) => Math.min(WALK.bigRadius, WALK.radius * Math.max(1, e.size || 1));
  const headingRot = (s) => +(((s.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(4);
  const newWalkId = () => 'walk_' + Math.random().toString(36).slice(2, 10);
  function walkFrame(s, e, dt, now) {
    // let go of the taps whose least time is up
    for (const [k, t] of s.release) if (now >= t) { s.release.delete(k); s.held.delete(k); }
    if (!s.held.size) s.halt = false; // (stopped at a drop or a ladder: walking again needs the key again)
    // someone else moved the pawn under the walk (the GM, an undo, the relay said no): the walk ends where the pawn is
    if (s.walk && (Math.abs(e.x - s.walk.sent.x) > 0.5 || Math.abs(e.z - s.walk.sent.z) > 0.5)) { endWalk(s); s.halt = s.held.size > 0; return; }
    // what is asked: the held keys (from where you look; several add up), else a click's path
    let ix = 0, iz = 0, slow = 1;
    if (!s.halt) for (const off of s.held.values()) { const a = s.heading + off; ix += Math.sin(a); iz += Math.cos(a); }
    let L = Math.hypot(ix, iz);
    if (L < 1e-6 && s.path?.length && !s.halt) {
      const p = s.pos || e;
      while (s.path.length && Math.hypot(s.path[0][0] - p.x, s.path[0][1] - p.z) < 0.3) { s.path.shift(); s.pathBest = null; }
      if (s.path.length) {
        const [tx, tz] = s.path[0], d = Math.hypot(tx - p.x, tz - p.z); ix = tx - p.x; iz = tz - p.z; L = d;
        if (s.path.length === 1) slow = Math.min(1, d / 1.5); // (arriving: eases in)
        if (s.pathBest == null || d < s.pathBest - 0.05) { s.pathBest = d; s.pathAt = now; } else if (now - s.pathAt > WALK.stuckMs) { s.path = null; L = 0; ix = iz = 0; }
      } else s.path = null;
    }
    const want = L > 1e-6 ? WALK.speed * (s.run ? WALK.run : 1) * slow : 0;
    if (L > 1e-6) { ix /= L; iz /= L; }
    const k = 1 - Math.exp(-dt * WALK.accel);
    s.vel[0] += (ix * want - s.vel[0]) * k; s.vel[1] += (iz * want - s.vel[1]) * k;
    const v = Math.hypot(s.vel[0], s.vel[1]);
    if (!want && v < 0.5) { s.vel[0] = s.vel[1] = 0; if (s.walk) finishWalk(s, e, { snap: true }); return; }
    if (!s.walk && !startWalk(s, e, now)) { s.vel[0] = s.vel[1] = 0; s.held.clear(); s.release.clear(); s.path = null; return; }
    // the way: substeps no longer than WALK.sub, each pushed out of every wall it meets (that is the slide along a wall
    // and round a doorway's corner), and never across one
    const p = s.pos, r = radiusOf(e), mx = s.vel[0] * Math.min(dt, 0.1), mz = s.vel[1] * Math.min(dt, 0.1), D = Math.hypot(mx, mz);
    const n = Math.max(1, Math.ceil(D / WALK.sub)), level = HT.sightLevel(E(), p.x, p.z, p.y, (rm) => s.w.isOpenRoom(rm));
    const segs = nearSegments(moveSegments(level), p.x, p.z, r + D + 1);
    let touched = false;
    for (let i = 0; i < n; i++) {
      const [nx, nz, hit] = collide(p.x + mx / n, p.z + mz / n, r, segs);
      if (hit) touched = true;
      if (segs.some(sg => crosses(p.x, p.z, nx, nz, sg))) break; // (never through a wall, whatever the pushes said)
      if (Math.hypot(nx - p.x, nz - p.z) < 1e-4) break;
      const st = app.walkStep({ ...e, x: p.x, z: p.z, y: p.y }, nx, nz);
      if (st.rock) { touched = true; break; } // (solid rock below the ground stops a step, as a wall does: core/height.js pawnStepTo)
      // a ladder or a spiral where it steps onto a new square: moveBy takes it to the other end; the walk stops
      const sq = `${Math.floor(nx / 5)}:${Math.floor(nz / 5)}`;
      if (sq !== s.walk.sq) { s.walk.sq = sq; const fl = HT.floorUnder(E(), nx, nz, st.y)?.y ?? Math.min(0, st.y); if (Math.abs(st.y - fl) < 1 && app.stairHop(nx, nz, fl)) { p.x = nx; p.z = nz; p.y = st.y; send(s, e, now); endWalk(s); s.halt = true; return; } }
      s.walked += Math.hypot(nx - p.x, nz - p.z); p.x = nx; p.z = nz; p.y = st.y;
      // out over a drop, onto a pit: it stops there, the pawn is put there and the fall is offered (moveBy)
      if (st.over || st.pit) { send(s, e, now); endWalk(s); s.halt = true; return; }
    }
    if (touched) { s.contact++; if (!s.walk.touched) { s.walk.touched = true; s.blocked++; } }
    // the slide keeps only what the walls allow (no pressing on into a wall: let go and you stop at once)
    const cdt = Math.min(dt, 0.1); if (cdt > 0) { const ax = (p.x - s.walk.lx) / cdt, az = (p.z - s.walk.lz) / cdt; if (touched && Math.hypot(ax, az) < v) { s.vel[0] = ax; s.vel[1] = az; } }
    s.walk.lx = p.x; s.walk.lz = p.z;
    // the others see it go (presence, as a drag: smooth, never stored); its place is journalled every WALK.sendMs
    app.ps?.set(s.area, { cursor: app.ps.cur?.area === s.area ? app.ps.cur.cursor : null, drag: [{ id: e.id, x: r2(p.x), z: r2(p.z), y: r2(p.y), rot: headingRot(s) }] });
    if (now - s.walk.sentAt >= WALK.sendMs) send(s, e, now);
  }
  function startWalk(s, e, now) {
    if (!app.canTouch(e)) { app.toast(`${e.name || 'This pawn'} is not yours to move`, true); return false; }
    if (!app.gm() && app.areaRule?.('freeMoves') === false) { app.toast('The GM has locked moves in this area', true); return false; }
    s.walk = { id: newWalkId(), start: { x: e.x, z: e.z }, sent: { x: e.x, z: e.z }, sentAt: now, sq: `${Math.floor(e.x / 5)}:${Math.floor(e.z / 5)}`, lx: e.x, lz: e.z, touched: false };
    s.pos = { x: e.x, z: e.z, y: e.y || 0 }; s.walks++;
    return true;
  }
  // the pawn's place now, as one more move of this walk (moveBy: heights, a ladder's other end, the fall offer)
  function send(s, e, now, to = s.pos) {
    const w = s.walk; if (!w || !to) return null;
    const rot = headingRot(s), dx = to.x - e.x, dz = to.z - e.z;
    w.sentAt = now;
    if (Math.hypot(dx, dz) < 0.01 && Math.abs(angleDiff(rot, e.rot || 0)) < 1e-3) return null;
    const cid = app.moveBy([e], dx, dz, { rot, walk: w.id });
    if (cid) { s.lastRot = rot; s.rotDirty = false; w.sends = (w.sends || 0) + 1; }
    const n = E()[s.id]; if (n) w.sent = { x: n.x, z: n.z }; // (where the pawn is now: a ladder's other end, rounded to the hundredth)
    return cid;
  }
  // the walk is over (the key let go, the path walked): the last place, on a square when squares are on, then nothing more
  function finishWalk(s, e, { snap = true } = {}) {
    const w = s.walk; if (!w) return;
    let to = s.pos;
    if (snap && app.pawnSnaps?.(false)) { const c = snapCentre(s, e, s.pos, w.start); if (c) to = { x: c[0], z: c[1] }; }
    send(s, e, performance.now(), to);
    endWalk(s);
  }
  function endWalk(s) {
    const w = s.walk; s.walk = null; s.pos = null; s.vel[0] = s.vel[1] = 0; s.path = null;
    if (w) { app.ps?.set(s.area, { cursor: app.ps.cur?.area === s.area ? app.ps.cur.cursor : null, drag: null }); s.steps += w.sends ? 1 : 0; }
  }
  // SQUARES ON ("Pawns snap to squares: always"): the nearest square centre the pawn may stand on from where it stopped
  // (no wall between, no drop); a tap that has not left its square goes one square on, the way it went (the old step)
  function snapCentre(s, e, p, start) {
    const off = (e.size || 1) % 2 ? 2.5 : 0, near = (v) => Math.round((v - off) / 5) * 5 + off;
    const segs = nearSegments(moveSegments(HT.sightLevel(E(), p.x, p.z, p.y ?? (e.y || 0), (rm) => s.w.isOpenRoom(rm))), p.x, p.z, 12);
    const ok = ([x, z]) => !segs.some(sg => crosses(p.x, p.z, x, z, sg)) && !app.walkStep({ ...e, x: p.x, z: p.z, y: p.y ?? (e.y || 0) }, x, z).over;
    const sx = near(start.x), sz = near(start.z), mx = p.x - start.x, mz = p.z - start.z;
    if (near(p.x) === sx && near(p.z) === sz && Math.hypot(mx, mz) >= 0.3) {
      const a = Math.round(Math.atan2(mx, mz) / (Math.PI / 4)) * (Math.PI / 4), c = [sx + Math.round(Math.sin(a)) * 5, sz + Math.round(Math.cos(a)) * 5];
      if (ok(c)) return c;
      s.blocked++; bump(s, c[0] - p.x, c[1] - p.z); // (the square on is through a wall: the tap is refused, as the old step was)
    }
    const ring = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) ring.push([near(p.x) + i * 5, near(p.z) + j * 5]);
    ring.sort((a, b) => Math.hypot(a[0] - p.x, a[1] - p.z) - Math.hypot(b[0] - p.x, b[1] - p.z));
    for (const c of ring) if (ok(c)) return c;
    return null;
  }
  // the walls near (x, z) (a box of reach round it): the only ones a frame's walk can meet
  function nearSegments(segs, x, z, reach) {
    const out = []; for (const sg of segs) if (Math.max(sg[0], sg[2]) >= x - reach && Math.min(sg[0], sg[2]) <= x + reach && Math.max(sg[1], sg[3]) >= z - reach && Math.min(sg[1], sg[3]) <= z + reach) out.push(sg);
    return out;
  }
  // a circle of radius r at (x, z), pushed out of every segment it overlaps (a few rounds: a corner pushes twice) -> [x, z, hit]
  function collide(x, z, r, segs) {
    let hit = false;
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (const [x0, z0, x1, z1] of segs) {
        const ex = x1 - x0, ez = z1 - z0, L2 = ex * ex + ez * ez || 1e-9, t = Math.max(0, Math.min(1, ((x - x0) * ex + (z - z0) * ez) / L2));
        const qx = x0 + ex * t, qz = z0 + ez * t, dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
        if (d >= r - 1e-4) continue;
        if (d < 1e-6) continue; // (exactly on the line: crossing is refused by the caller)
        const push = r - d + 1e-4; x += dx / d * push; z += dz / d * push; moved = hit = true;
      }
      if (!moved) break;
    }
    return [x, z, hit];
  }

  // ---------- a step: one square, if no wall is in the way (app.fpv.step: the API and tests) ----------
  const centreOf = (v, size) => { const off = (size || 1) % 2 ? 2.5 : 0; return Math.round((v - off) / 5) * 5 + off; };
  function step(offset) {
    const s = S, e = s && E()[s.id]; if (!e) return false;
    const a = Math.round((s.heading + offset) / (Math.PI / 4)) * (Math.PI / 4), dx = Math.round(Math.sin(a)), dz = Math.round(Math.cos(a));
    return stepTo(centreOf(e.x, e.size) + dx * 5, centreOf(e.z, e.size) + dz * 5);
  }
  function stepTo(tx, tz) {
    const s = S, e = s && E()[s.id]; if (!e) return false;
    s.stepAt = performance.now();
    if (!app.canTouch(e)) { app.toast(`${e.name || 'This pawn'} is not yours to move`, true); return false; }
    if (Math.abs(tx - e.x) < 0.01 && Math.abs(tz - e.z) < 0.01) return false;
    if (stepBlocked(e, e.x, e.z, tx, tz)) { s.blocked++; bump(s, tx - e.x, tz - e.z); return false; }
    const rot = +(((s.heading % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toFixed(4);
    const cid = app.moveBy([e], tx - e.x, tz - e.z, { rot });
    if (cid) { s.lastRot = rot; s.rotDirty = false; s.steps++; }
    return !!cid;
  }
  // a little nudge of the eyes toward what stopped you, and back (the glide brings it back)
  function bump(s, dx, dz) { if (!s.eye) return; const L = Math.hypot(dx, dz) || 1; s.eye.x += dx / L * 0.6; s.eye.z += dz / L * 0.6; s.bumps++; }

  // WHAT A STEP MAY NOT CROSS: what stops sight (vision.js blockingSegments: walls, shut doors, a cave's rock, at the
  // pawn's level) plus what sight passes but a body does not: windows, and bars and a portcullis while shut
  let segKey = null, segs = [];
  function moveSegments(level) {
    const w = world(), ents = E(), key = [w.edges, ents, level];
    if (segKey && segKey.every((v, i) => v === key[i])) return segs;
    const edges = [...(w.edges?.values() || [])].map(ed => ed.kind === 'window' ? { ...ed, kind: 'wall' } : ed.doorType && seeThrough(ed.doorType) && !ed.open ? { ...ed, doorType: null } : ed);
    const things = {}; // shut bars count as a door here (vision.js leaves them out: they are seen through)
    for (const [id, x] of Object.entries(ents)) things[id] = x.kind === 'object' && seeThrough(x.cat) && !x.open && /door|portcullis/.test(x.cat) ? { ...x, cat: 'door-plank' } : x;
    segKey = key; segs = blockingSegments(edges, things, level);
    return segs;
  }
  function stepBlocked(e, ax, az, bx, bz) {
    const ents = E(), w = world(); const open = (r) => w.isOpenRoom(r);
    const level = HT.sightLevel(ents, e.x, e.z, e.y || 0, open);
    for (const sg of moveSegments(level)) if (crosses(ax, az, bx, bz, sg)) return true;
    return false;
  }
  // does the step a→b meet the segment (its ends taken 0.05 ft long, so a diagonal through a corner is stopped)?
  function crosses(ax, az, bx, bz, [x0, z0, x1, z1]) {
    const ex = x1 - x0, ez = z1 - z0, L = Math.hypot(ex, ez) || 1, ux = ex / L * 0.05, uz = ez / L * 0.05;
    const px = x0 - ux, pz = z0 - uz, qx = x1 + ux, qz = z1 + uz;
    const d = (bx - ax) * (qz - pz) - (bz - az) * (qx - px); if (Math.abs(d) < 1e-12) return false;
    const t = ((px - ax) * (qz - pz) - (pz - az) * (qx - px)) / d, u = ((px - ax) * (bz - az) - (pz - az) * (bx - ax)) / d;
    return t > 1e-6 && t < 1 - 1e-6 && u >= 0 && u <= 1;
  }
  // a click on a floor square: the squares there, by the shortest way that no wall stops (eight ways, at most walkMax)
  function pathTo(e, gx, gz) {
    const sx = Math.floor(e.x / 5), sz = Math.floor(e.z / 5), k = (x, z) => `${x}:${z}`, prev = new Map([[k(sx, sz), null]]);
    let frontier = [[sx, sz]], found = sx === gx && sz === gz;
    for (let n = 0; n < FPV.walkMax && frontier.length && !found; n++) {
      const next = [];
      for (const [x, z] of frontier) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, nz = z + dz, kk = k(nx, nz); if (prev.has(kk) || Math.abs(nx - gx) + Math.abs(nz - gz) > FPV.walkMax * 2) continue;
        if (stepBlocked(e, x * 5 + 2.5, z * 5 + 2.5, nx * 5 + 2.5, nz * 5 + 2.5)) continue;
        prev.set(kk, [x, z]); next.push([nx, nz]); if (nx === gx && nz === gz) { found = true; break; }
      }
      frontier = next;
    }
    if (!found) return null;
    const out = []; for (let c = [gx, gz]; c && !(c[0] === sx && c[1] === sz); c = prev.get(k(c[0], c[1]))) out.unshift([c[0] * 5 + 2.5, c[1] * 5 + 2.5]);
    return out;
  }
  function click(x, y) {
    const s = S, w = world(); if (!s || !w) return 'off';
    const r = app.rayAt(x, y), hits = w.pickAll(r).filter(h => h.entity?.id !== s.id); // (not the pawn you are: it is not drawn for you)
    // a door (or a chest, a shutter) this seat may open: open or shut it (the nearest thing hit that is not the floor)
    const near = hits.filter(h => !h.floor).slice(0, 2);
    for (const h of near) { const id = h.wall ? 'wall:' + h.wall : app.selectionFor(h), it = id && app.ent?.(id); if (it && app.canOpen(it)) { app.toggleOpen(it); return log('open', id); } }
    const h0 = hits.find(h => h.point), f = h0 ? null : w.floorPoint?.(r.ray), p = h0 ? { x: h0.point.x, y: h0.point.y, z: h0.point.z } : f && { x: f.x, y: f.y || 0, z: f.z }, e = E()[s.id];
    if (!p || !e) return log('nothing', null);
    const open = (rm) => w.isOpenRoom(rm), lv = HT.sightLevel(E(), p.x, p.z, p.y || 0, open);
    if (!app.fog?.visible?.(p.x, p.z, lv)) { app.toast('You cannot see there'); return log('unseen', [p.x, p.z, lv]); }
    const path = pathTo(e, Math.floor(p.x / 5), Math.floor(p.z / 5));
    if (!path) { app.toast('No way there from here', true); return log('noway', [p.x, p.z]); }
    s.queue.length = 0; s.path = path; s.pathBest = null; s.halt = false; // walked to, square centre by square centre (walkFrame)
    return log('walk', path);
  }
  const log = (what, d) => { app.fpvLog.push({ click: what, d, hits: null, at: Date.now() }); if (app.fpvLog.length > 50) app.fpvLog.shift(); return what; };

  // ---------- input: while looking, the canvas is the eyes' (never the map's grab, box or ring) ----------
  addEventListener('pointerdown', (ev) => {
    if (!S || ev.target !== canvas) return;
    ev.stopImmediatePropagation(); ev.preventDefault();
    if (S.drag && S.drag.id !== ev.pointerId) return; // (a second finger: ignored)
    if (document.pointerLockElement === canvas) { if (ev.button === 0) { const b = canvas.getBoundingClientRect(); click(b.left + b.width / 2, b.top + b.height / 2); } return; } // (locked: a click is a click at the centre dot)
    const mouse = ev.pointerType === 'mouse';
    S.drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, moved: 0, at: performance.now(),
      turn: mouse ? LOOK.sign * mouseDegPerPx(innerWidth, innerHeight) * D2R : LOOK.fingerSign * LOOK.fingerDegPerPx * D2R };
    try { canvas.setPointerCapture(ev.pointerId); } catch { }
  }, true);
  addEventListener('pointermove', (ev) => {
    if (!S) return;
    if (document.pointerLockElement === canvas) { if (ev.target !== canvas) return; ev.stopImmediatePropagation(); S.heading -= ev.movementX * LOOK.lockedDegPerPx * D2R; S.pitch = clampP(S.pitch - ev.movementY * LOOK.lockedDegPerPx * D2R); turned(S); return; }
    const d = S.drag; if (!d || d.id !== ev.pointerId) return;
    ev.stopImmediatePropagation();
    d.moved = Math.max(d.moved, Math.hypot(ev.clientX - d.x, ev.clientY - d.y));
    // from the last move, not the drag's start: past the pitch stop a turn back counts at once, and Q / E add to a drag
    S.heading += (ev.clientX - d.lastX) * d.turn; S.pitch = clampP(S.pitch + (ev.clientY - d.lastY) * d.turn); d.lastX = ev.clientX; d.lastY = ev.clientY;
    if (d.moved > 3) turned(S);
  }, true);
  const up = (ev) => {
    const d = S?.drag; if (!d || d.id !== ev.pointerId) return;
    ev.stopImmediatePropagation(); S.drag = null;
    try { canvas.releasePointerCapture(ev.pointerId); } catch { }
    if (ev.type === 'pointerup' && d.moved < 6 && performance.now() - d.at < 600) click(ev.clientX, ev.clientY);
  };
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  for (const t of ['wheel', 'dblclick', 'contextmenu']) addEventListener(t, (ev) => { if (S && ev.target === canvas) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, { capture: true, passive: false });
  const clampP = (p) => Math.max(-FPV.pitchMax * D2R, Math.min(FPV.pitchMax * D2R, p));

  // ---------- keys: first refusal while looking ----------
  // (a capturing listener on the window: before the launchers' own letters, P B S in surfaces/tray.js, the map's Q / E
  // orbit in input.js and the key layers of surfaces/keys.js; the keys it does not take go on to them as ever)
  const takeKey = (ev) => {
    if (!S || field(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
    const k = ev.key.toLowerCase();
    if (k === 'escape') { const st = app.escapeStack || []; while (st.length) if (st.pop()() !== false) return true; exit(); return true; } // (an open card, a list: that first; a closer whose thing is gone says false)
    if (k === FPV_KEY.toLowerCase() && !ev.shiftKey) { if (!ev.repeat) exit(); return true; }
    if (k in MOVES) { S.run = ev.shiftKey; if (!ev.repeat) press(k, MOVES[k]); return true; }
    if (k === 'q' || k === 'e') { S.turn.add(k); return true; }
    return false;
  };
  const taken = new Set(); // keys taken on the way down: their way up is ours too (a launcher opens on a TAP's key-up)
  addEventListener('keydown', (ev) => { if (takeKey(ev)) { taken.add(ev.key.toLowerCase()); ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);
  addEventListener('keyup', (ev) => { const k = ev.key.toLowerCase(); if (taken.delete(k)) { if (S) { letGo(k); S.turn.delete(k); } ev.preventDefault(); ev.stopImmediatePropagation(); } }, true);
  addEventListener('keyup', (ev) => { if (!S) return; const k = ev.key.toLowerCase(); letGo(k); S.turn.delete(k); });
  // Shift runs (pressed or let go mid-walk too)
  for (const t of ['keydown', 'keyup']) addEventListener(t, (ev) => { if (S && ev.key === 'Shift') S.run = t === 'keydown'; }, true);
  addEventListener('blur', () => { if (S) { S.held.clear(); S.release.clear(); S.turn.clear(); S.run = false; } });
  // a key (or the pad's arrow) goes down: it walks while held, and at least WALK.minHoldMs (a tap is never nothing)
  function press(k, off) { const s = S; if (!s) return; s.held.set(k, off); s.release.delete(k); s.downAt = s.downAt || new Map(); s.downAt.set(k, performance.now()); s.queue.length = 0; s.path = null; }
  function letGo(k) { const s = S; if (!s || !s.held.has(k)) return; const t = (s.downAt?.get(k) || 0) + WALK.minHoldMs; if (performance.now() >= t) s.held.delete(k); else s.release.set(k, t); }

  // ---------- leave when the world changes under you ----------
  app.on((what) => {
    if (what === 'area' || what === 'travel') { if (S && app.area() !== S.area) exit(); }
    if (what === 'frame') drawTags();
  });

  // ---------- the tags: who is looking through which pawn (other seats) ----------
  function drawTags() {
    // (never makes a world: app.worlds, not app.worldOf, which builds one for an area with no main view yet)
    const area = app.area(), w = app.main && app.worlds?.get(area), seen = new Set();
    if (w && app.pv) for (const st of app.pv.seats.values()) {
      if (st.area !== area || !st.eyes || st.seat === app.me()) continue;
      const rec = w.recs.get(st.eyes); if (!rec || !rec.group.visible || (S && S.id === st.eyes)) continue;
      rec.group.getWorldPosition(P); const b = w.boundsOf?.(rec, 'figure'), top = b && Number.isFinite(b.max.y) ? b.max.y + 1.6 : P.y + 6;
      const sp = app.screenOf(P.x, P.z, app.main, top); DIR.set(P.x, top, P.z).project(app.main.camera); if (DIR.z > 1) continue;
      const k = `${st.seat}|${st.eyes}`; seen.add(k);
      let el = tagEls.get(k);
      // (who is looking, when it is not the pawn's own person: the GM in a player's pawn, Gemini r4 "the tag doesn't say who")
      const pe = E()[st.eyes], words = pe?.owner && pe.owner === st.seat ? 'in first person' : `${st.name || 'Someone'} in first person`;
      if (!el) { el = document.createElement('div'); el.className = 'fpv-tag'; el.dataset.pawn = st.eyes; el.dataset.seat = st.seat; el.innerHTML = `${icon('eye', 13)}<span></span>`; tags.append(el); tagEls.set(k, el); }
      if (el.lastChild.textContent !== words) el.lastChild.textContent = words;
      el.style.setProperty('--seat', st.color || 'var(--accent)'); el.title = `${st.name || 'Someone'} is looking through ${E()[st.eyes]?.name || 'this pawn'}'s eyes`;
      el.style.transform = `translate(${Math.round(sp.x)}px, ${Math.round(sp.y)}px) translate(-50%, -100%)`;
    }
    for (const [k, el] of tagEls) if (!seen.has(k)) { el.remove(); tagEls.delete(k); }
  }

  // ---------- for tests and the other surfaces ----------
  app.fpvLog = [];
  app.fpv = {
    active: () => !!S, pawnId: () => S?.id || null, enter, exit, step: (dir = 'w') => S ? step(MOVES[dir]) : false, click,
    look: (dh = 0, dp = 0) => { if (!S) return null; S.heading += dh * D2R; S.pitch = clampP(S.pitch + dp * D2R); turned(S); return app.fpv.info(); },
    setLook: (h, p) => { if (!S) return null; if (h != null) S.heading = h * D2R; if (p != null) S.pitch = clampP(p * D2R); turned(S); return app.fpv.info(); },
    info: () => S && { id: S.id, area: S.area, heading: +(S.heading / D2R).toFixed(2), pitch: +(S.pitch / D2R).toFixed(2), eye: S.eye && [+S.eye.x.toFixed(2), +S.eye.y.toFixed(2), +S.eye.z.toFixed(2)], eyeOff: S.eyeOff && +S.eyeOff.toFixed(2), steps: S.steps, blocked: S.blocked, queue: S.queue.length, rotDirty: S.rotDirty,
      walking: !!S.walk, walkId: S.walk?.id || null, pos: S.pos && [+S.pos.x.toFixed(2), +S.pos.y.toFixed(2), +S.pos.z.toFixed(2)], vel: +Math.hypot(S.vel[0], S.vel[1]).toFixed(2), path: S.path?.length || 0, walks: S.walks, contact: S.contact, walked: +S.walked.toFixed(2), held: [...S.held.keys()], halt: S.halt,
      cam: (() => { const c = S.V.camera; return { pos: c.position.toArray().map(v => +v.toFixed(2)), fov: c.fov, near: c.near, far: c.far }; })(), ceilings: S.ceil.info(), ceilingsPending: S.ceil.pending(), hiddenParts: S.hidden.size, figureShown: [...S.hidden].some(c => c.visible) },
    blocked: (ax, az, bx, bz) => { const e = S && E()[S.id]; return e ? stepBlocked(e, ax, az, bx, bz) : null; },
    walls: (x, z, reach = 6, level = null) => { const e = S && E()[S.id]; if (!e) return null; const lv = level ?? HT.sightLevel(E(), e.x, e.z, e.y || 0, (rm) => S.w.isOpenRoom(rm)); return nearSegments(moveSegments(lv), x, z, reach); },
    tags: () => [...tagEls.values()].map(el => ({ pawn: el.dataset.pawn, seat: el.dataset.seat, text: el.textContent.trim(), shown: el.offsetParent !== null })),
    // (tests) hold a walking key down / let it go, as the keyboard or the pad would ('w' 'a' 's' 'd', or 'pad-w' ...)
    hold: (k = 'w', run = false) => { if (!S) return false; S.run = !!run; press(k, MOVES[k.replace(/^pad-/, '')]); return true; },
    letGo: (k) => { if (!S) return false; if (k) letGo(k); else for (const h of [...S.held.keys()]) letGo(h); return true; },
    K: { FPV, LOOK, WALK },
  };
  return { name: 'fpv' };
}
