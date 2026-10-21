// Pointer input, industry standard (Harry: "100% industry standard" on every conflict).
//   left-drag on empty space   marquee: selects things WHOLLY inside, at the current granularity
//   left-drag on a thing       moves the selection (contents ride along); Cmd/Ctrl+D duplicates
//   click / Shift / Cmd-Ctrl   select / add / toggle; clicking the same spot again cycles down the stack
//   double-click               step inside (building → rooms, room → its things, area → what's on it)
//   orbit                      middle-drag (as in the tuner and Map Garden; pitch stays above the floor), Alt+right-drag,
//                              Option/Alt+drag on empty space, Option/Alt+two-finger scroll, two-finger rotate (Safari)
//   pan                        right-drag, Space+drag, Cmd/Ctrl+drag on empty space, two-finger scroll (trackpad),
//                              one finger (touch), two fingers
//   zoom                       mouse wheel to the cursor, pinch (trackpad: the ctrlKey wheel; Safari: gesture events)
//   Alt+click on the ground    ping (in your seat colour)
//   touch long-press           selects what's under it (the ring appears); long-press-drag draws a marquee
// Commands never live here: this only turns gestures into selections, moves and pans.
import * as THREE from 'three';
import { clipFrom } from './clipboard.js';
import { isTile, tilesAt } from './tiles.js';
import { makeWheelClassifier } from './wheel.js';

const DRAG_PX = 4, LONG_MS = 500;

export function installInput(app, canvas) {
  const ray = new THREE.Raycaster();
  app.rayAt = (cx, cy, view = app.main) => {
    const r = canvas.getBoundingClientRect(), [l, t, w, h] = view.rect;
    ray.setFromCamera(new THREE.Vector2(((cx - r.left - l * r.width) / (w * r.width)) * 2 - 1, -(((cy - r.top - t * r.height) / (h * r.height)) * 2 - 1)), view.camera);
    return ray;
  };
  const world = () => app.worldOf(app.area());
  // THE POINT UNDER THE POINTER (storeys, Stage B): [x, z] as ever, now with .y (the height of the floor it is on) and
  // .room (the room whose floor it is). world.floorPoint decides:
  //   a room or building tool is live   the plane of the level being built on (app.level)
  //   planeY given                      that plane (a drag keeps to the plane it started on, so it never jumps)
  //   otherwise                         the highest room floor under the pointer, else the ground
  const toolLevel = () => (app.mode?.kind === 'room' || app.mode?.kind === 'building') ? (app.level || 0) : null;
  const groundOf = (r, planeY = null) => {
    const p = world().floorPoint(r.ray, { level: planeY ?? toolLevel(), max: app.floorMax?.() ?? Infinity }); if (!p) return null;
    const g = [p.x, p.z]; g.y = p.y; g.room = p.room; return g;
  };
  const planeOf = () => (g?.kind === 'move' || g?.kind === 'press') ? (g.kind === 'move' ? g.start?.y : g.ground?.y) ?? null : null;
  app.groundAt = (cx, cy, planeY = null) => groundOf(app.rayAt(cx, cy), planeY);
  const marquee = document.getElementById('marquee');
  let g = null;              // the gesture in progress
  let space = false, lastClick = null;
  const touches = new Map();

  const inPip = (ev) => { if (!app.pip) return false; const r = canvas.getBoundingClientRect(); return app.pip.contains(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height); };
  const draggable = (e) => e && (e.kind === 'token' ? app.canTouch(e) : e.kind === 'object' ? app.canTouch(e) && !e.locked : (e.kind === 'room' || e.kind === 'building') ? app.gm() && !e.locked : false);

  const canvasDown = (ev) => {
    if (!app.main) return;
    // The PiP is a full viewport (Harry 2026-10-04): input under the pointer goes to it, and a gesture stays with the
    // view it started in until release (pointer capture). In the library, a press on a thing selects it and a drag
    // takes it out into the world; anything else moves the PiP's own camera (it is read-only). The build tool waits.
    if (inPip(ev)) {
      try { canvas.setPointerCapture(ev.pointerId); } catch { }
      app.pointerView = 'pip';
      const V = app.pip;
      const cat = ev.button === 0 && !ev.altKey && !space && app.library?.shown() ? app.library.pick(ev.clientX, ev.clientY) : null;
      if (cat) { app.library.select(cat); g = { kind: 'libPress', x: ev.clientX, y: ev.clientY, cat }; return; }
      if (ev.button === 0 && !ev.altKey && !space && app.library?.shown()) app.library.select(null);
      g = { kind: 'pipPress', view: V, x: ev.clientX, y: ev.clientY, mode: ev.button === 1 || ev.altKey ? 'orbit' : 'pan' };
      if (ev.button === 1) ev.preventDefault();
      return;
    }
    app.pointerView = 'main';
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* synthetic or already-gone pointer */ }
    const r = app.rayAt(ev.clientX, ev.clientY), ground = groundOf(r);
    if (ev.pointerType === 'touch') {
      touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      app.main.grab.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (touches.size === 2) { clearTimeout(g?.timer); g = { kind: 'pinch' }; app.main.grab.pinchStart(); return; }
      g = { kind: 'touch', x: ev.clientX, y: ev.clientY, ground, hits: world().pickAll(r) };
      g.timer = setTimeout(() => { if (g?.kind === 'touch') { const sp = app.pointAt(g.x, g.y); if (sp) app.ping(sp.x, sp.z, sp.y, { secret: sp.hidden }); /* a finger held still pings too */ const id = app.selectionFor(g.hits[0]); if (id) { app.select(id); g = { kind: 'longheld' }; } else g = { kind: 'marquee', x: g.x, y: g.y, touch: true }; } }, LONG_MS);
      return;
    }
    app.lastDown = { button: ev.button, space, mode: app.mode?.kind || null };
    if (ev.button === 1 || ev.button === 2 || (ev.button === 0 && space)) { g = { kind: 'pan' }; app.main.rule = 'free'; app.main.grab.beginGrab(ev.clientX, ev.clientY, ev.button === 1 || (ev.altKey && ev.button === 2) ? 'orbit' : 'pan'); if (ev.button === 1) ev.preventDefault(); return; }
    if (ev.button !== 0) return;
    if (app.mode?.kind === 'room' || app.mode?.kind === 'building') { if (app.modes.roomDown(ground)) g = { kind: 'room' }; return; }
    if (app.modes.isPaint()) { if (app.modes.paintDown(ground, ev)) g = { kind: 'paint' }; return; } // floor tiles: a paint stroke
    if (app.mode?.kind === 'place') { g = { kind: 'placeClick' }; return; }
    const hits = world().pickAll(r);
    // clicking the same spot again cycles down the stack (cup → area → room)
    let idx = 0;
    const ids = hits.map(h => app.selectionFor(h)).filter(Boolean);
    if (lastClick && Math.hypot(ev.clientX - lastClick.x, ev.clientY - lastClick.y) < 4 && lastClick.ids.join() === ids.join() && app.sel.size === 1 && app.sel.has(ids[lastClick.idx])) idx = (lastClick.idx + 1) % Math.max(1, ids.length);
    // the floor selects nothing (labels are the handles, Harry 2026-10-03), but a room already selected (by its label)
    // can still be dragged by its floor
    const floorRoom = hits.find(h => h.floor)?.entity;
    const grabRoom = !ids.length && floorRoom && app.sel.has(floorRoom.id) ? floorRoom.id : null;
    g = { kind: 'press', x: ev.clientX, y: ev.clientY, ground, ids, idx, target: ids[idx] || grabRoom, hit: grabRoom ? hits.find(h => h.floor) : hits[idx], floorGrab: !!grabRoom, shift: ev.shiftKey, mod: ev.ctrlKey || ev.metaKey, alt: ev.altKey };
    app.lastPress = { hits: hits.map(h => h.entity?.id || h.wall), ids, overview: app.overview(), dist: app.main.grab.dist };
    armHold(g, ev);
  };
  canvas.addEventListener('pointerdown', canvasDown);
  // PRESS AND HOLD PINGS (Harry 2026-10-06: "pinging: let's go with whatever the norm is, not double click"; the norm
  // on tabletops is a long press on the map: Foundry's canvas pings from its long-press handler). Hold the left button
  // (or a finger) still for HOLD_MS on anything, anywhere: the other seats see a brief ring at that spot in your seat
  // colour, and so do you. A press that moves past the drag threshold is a drag or a box as ever and never pings (the
  // gesture is no longer this press when the timer fires); let go early and it is a click. After a ping the release is
  // not also a click. Alt/Option+click is the quick way. (Room left for the GM's Shift + hold "pull everyone's view
  // here": `shift` is passed through and ignored today.)
  const HOLD_MS = LONG_MS;
  function armHold(press, ev) {
    if (ev.button !== 0 || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const spot = app.pointAt(ev.clientX, ev.clientY), shift = ev.shiftKey;
    press.hold = setTimeout(() => {
      if (g !== press || !spot) return; // it became a drag, a box, a click, or something else: not a hold
      if (app.ping(spot.x, spot.z, spot.y, { secret: spot.hidden, pull: false && shift })) press.pinged = true;
    }, HOLD_MS);
  }

  canvas.addEventListener('pointermove', (ev) => onMove(ev));
  // EDGE AUTO-PAN (edgepan.js): while one of these gestures is live and the pointer rests at an edge of the window the
  // view pans, and the gesture is run again for the same pointer place, so what is in the hand stays under the pointer
  let lastMove = null;
  app.edgePan?.source({ name: 'canvas', active: () => !!g && app.edgePan.K.KINDS.includes(g.kind), refresh: () => { if (lastMove && g) onMove(lastMove); } });
  function onMove(ev) {
    if (!app.main) return;
    lastMove = ev;
    const r = app.rayAt(ev.clientX, ev.clientY), ground = groundOf(r, planeOf());
    app.cursor = ground;
    if (ev.pointerType === 'touch') { touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); app.main.grab.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); }
    if (g?.kind === 'pipPress' && Math.hypot(ev.clientX - g.x, ev.clientY - g.y) > DRAG_PX) { app.library?.touched(); g.view.rule = g.view.rule === 'follow' ? 'free' : g.view.rule; g.view.grab.beginGrab(g.x, g.y, g.mode); g = { kind: 'pipPan', view: g.view }; }
    if (g?.kind === 'pipPan') { g.view.grab.dragTo(ev.clientX, ev.clientY); return; }
    if (g?.kind === 'pipPress') return;
    if (g?.kind === 'libPress' && Math.hypot(ev.clientX - g.x, ev.clientY - g.y) > DRAG_PX) { app.modes.place(g.cat, { viaDrag: true }); g = { kind: 'libDrag' }; }
    if (g?.kind === 'libDrag') { canvas.classList.toggle('over-pip', inPip(ev)); app.modes.hover(r, inPip(ev) ? null : ground, ev); return; }
    if (g?.kind === 'libPress') return;
    if (!g || g.kind === 'placeClick') {
      // over the PiP: the select pointer, the build tool waits (its cursor and ghost come back over the main view)
      const overPip = inPip(ev);
      canvas.classList.toggle('over-pip', overPip); app.pointerView = overPip ? 'pip' : 'main';
      if (overPip) { app.modes.hover(r, null, ev); app.library?.hoverAt(ev.clientX, ev.clientY); if (app.hover) { app.hover = null; app.emit('hover', null); } return; }
      app.library?.hoverAt(null);
      app.modes.hover(r, ground, ev);
      // hover always previews what a click would select, at the right level
      if (!app.mode && !inPip(ev)) { const h = app.selectionFor(world().pick(r)); if (h !== app.hover) { app.hover = h; app.emit('hover', h); } }
      if (ground) app.ps.set(app.area(), { cursor: ground, drag: null });
      return;
    }
    const moved = Math.hypot(ev.clientX - (g.x ?? ev.clientX), ev.clientY - (g.y ?? ev.clientY));
    if (g.kind === 'pinch') { app.main.grab.pinchMove(); return; }
    if (g.kind === 'touch' && moved > DRAG_PX * 2) { clearTimeout(g.timer); g = { kind: 'pan' }; app.main.grab.beginGrab(ev.clientX, ev.clientY, 'pan'); }
    if (g.kind === 'pan') { app.main.grab.dragTo(ev.clientX, ev.clientY); return; }
    if (g.kind === 'room') { app.modes.roomMove(ground, ev); return; }
    if (g.kind === 'paint') { app.modes.paintMove(ground, ev); return; }
    if (g.kind === 'press' && moved > DRAG_PX && (g.alt || (g.mod && !g.target))) {
      // Option/Alt-drag ROTATES, wherever it starts (Harry 2026-10-04: "Option to rotate" for anyone without a middle
      // button; it used to duplicate when the drag began on a piece of furniture or a wall, which in a furnished room is
      // almost everywhere, so it seemed not to work). Cmd/Ctrl-drag on empty space pans. Duplicate: Cmd/Ctrl+D.
      app.main.rule = 'free'; app.main.grab.beginGrab(g.x, g.y, g.alt ? 'orbit' : 'pan'); g = { kind: 'pan' };
      app.main.grab.dragTo(ev.clientX, ev.clientY); return;
    }
    if (g.kind === 'press' && moved > DRAG_PX) {
      const t = g.target ? app.ent(g.target) : null;
      const selected = t && app.sel.has(t.id);
      // drag a thing (or the selection it belongs to); a room's floor only drags when the room is already selected
      // a floor tile drags only once selected (else painted floors would turn every marquee into a tile drag)
      if (t && draggable(t) && (selected || g.labelGrab || (!g.hit?.floor && t.kind !== 'wall' && !isTile(t))) && (!g.floorGrab || selected)) {
        // Shift+drag on a wall piece or post is the FREE move (no snapping), not "add to the selection"
        if (!selected) app.select(t.id, g.shift && !(t.kind === 'object' && t.place === 'kit') ? 'add' : 'replace');
        startMove(g.ground || ground, g.alt); // measured from where the press began, not where the drag threshold was crossed
      } else if (g.labelGrab) return; // a label that can't be dragged (a locked room): nothing happens, never a marquee
      else g = { kind: 'marquee', x: g.x, y: g.y, shift: g.shift };
    }
    if (g.kind === 'move') { dragMove(ground, ev, r); return; }
    if (g.kind === 'marquee') {
      Object.assign(marquee.style, { left: `${Math.min(g.x, ev.clientX)}px`, top: `${Math.min(g.y, ev.clientY)}px`, width: `${Math.abs(ev.clientX - g.x)}px`, height: `${Math.abs(ev.clientY - g.y)}px` });
      marquee.hidden = false; g.x1 = ev.clientX; g.y1 = ev.clientY;
    }
  }

  const up = (ev) => {
    if (ev.pointerType === 'touch') { touches.delete(ev.pointerId); app.main?.grab.pointers.delete(ev.pointerId); }
    if (!g) return;
    const r = app.rayAt(ev.clientX, ev.clientY), ground = groundOf(r, planeOf());
    const k = g.kind;
    if (k === 'touch') { clearTimeout(g.timer); const id = app.selectionFor(g.hits[0]); app.select(id ? [id] : []); }
    if (k === 'pan') app.main.grab.endGrab();
    if (k === 'pipPan') g.view.grab.endGrab();
    if (k === 'pinch') app.main.grab.pinch = null;
    if (k === 'room') app.modes.roomUp(ev);
    if (k === 'placeClick') app.modes.placeAt(r, ground, ev);
    if (k === 'paint') app.modes.paintUp(ev);
    if (k === 'libDrag') { if (!inPip(ev) && ground) app.modes.placeAt(r, ground, { ...ev, shiftKey: false, altKey: ev.altKey }); if (app.mode?.viaDrag) app.modes.cancel(); app.library?.restoreTool(); }
    if (k === 'press') click(ev);
    if (k === 'move') endMove(ev, r, ground);
    if (k === 'move' || k === 'press') { roomLabel.hidden = true; roomLabel.classList.remove('bad'); if (winMove) { removeEventListener('pointermove', winMove); removeEventListener('pointerup', winUp); removeEventListener('pointercancel', winUp); winMove = null; } }
    if (k === 'move' || k === 'press') app.ps.set(app.area(), { cursor: ground, drag: null }); // the drag is over: stop telling everyone about it
    if (k === 'marquee') { marquee.hidden = true; if (g.x1 != null) selectBox(g); }
    g = touches.size ? g : null;
    if (k !== 'pinch') g = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { if (!g && app.area()) app.ps.set(app.area(), { cursor: null, drag: null }); });

  // A ROOM'S LABEL IS ITS HANDLE (Harry 2026-10-05): a press on a room or building label that turns into a drag moves the
  // room (selecting it first), exactly like dragging a selected room by its floor. The label is DOM, over the canvas, so
  // the rest of the gesture is followed on the window; a press that never moves is the label's ordinary click.
  let winMove = null, winUp = null;
  const roomLabel = document.getElementById('modeLabel');
  app.labelPress = (id, ev) => {
    // THE CAMERA WORKS OVER A LABEL TOO (2026-10-06). A label is DOM over the canvas and takes the press, so a right or
    // middle button, or Space + drag, that began on a label did nothing (and Space + drag moved the room). Those presses
    // are the camera's: they go to the canvas's own handler, which captures the pointer, so the drag follows as usual.
    if (!g && app.main && (ev.button === 1 || ev.button === 2 || (ev.button === 0 && space))) { canvasDown(ev); return; }
    if (g || ev.button !== 0 || app.mode || !app.main) return;
    const e = app.ent(id); if (!e) return;
    const ground = groundOf(app.rayAt(ev.clientX, ev.clientY));
    g = { kind: 'press', x: ev.clientX, y: ev.clientY, ground, ids: [id], idx: 0, target: id, hit: { entity: e, floor: true }, labelGrab: true, noClick: true, shift: ev.shiftKey, mod: ev.ctrlKey || ev.metaKey, alt: false };
    armHold(g, ev); // (a press held still on a label pings too)
    winMove = (m) => { if (m.target !== canvas) onMove(m); }; winUp = (m) => { if (m.target !== canvas) up(m); };
    addEventListener('pointermove', winMove); addEventListener('pointerup', winUp); addEventListener('pointercancel', winUp);
  };

  function click(ev) {
    if (g.noClick) return; // a label press that never became a drag: the label's own click selects

    if (g.pinged) return; // a press held still pinged: the release is not also a click
    if (g.alt) { const sp = app.pointAt(g.x, g.y); if (sp) app.ping(sp.x, sp.z, sp.y, { secret: sp.hidden }); return; } // Alt/Option+click: the quick ping, on anything
    const id = g.target;
    if (!id || g.floorGrab) { if (!g.shift && !g.mod) app.clearSelection(); lastClick = null; return; } // a floor click selects nothing
    app.select(id, g.shift ? 'add' : g.mod ? 'toggle' : 'replace');
    lastClick = { x: ev.clientX, y: ev.clientY, ids: g.ids, idx: g.idx };
  }
  // DOUBLE-CLICK SETS THE CUT (Harry 2026-10-05; surfaces/cut.js): on a spot in a room (its floor, a wall, a thing in
  // it) the cut goes to that room's ceiling, so you see into it; on open ground the cut lifts off and everything shows.
  // It stays until the next double-click (or a floor step). A double-click on a loose thing outdoors changes nothing.
  // (The older "step inside" of a selected thing with children still happens.)
  app.cutTargetAt = (cx, cy, view = app.main) => {
    const w = app.worldOf(view.area), r = app.rayAt(cx, cy, view);
    const hits = w.pickAll(r), h = hits[0], E = w.view?.entities || app.entities();
    const at = (pt) => pt ? { x: pt.x, y: pt.y, z: pt.z } : null;
    if (!h) { const f = w.floorPoint(r.ray, { max: app.floorMax?.() ?? Infinity }); return { ground: true, point: f ? { x: f.x, y: f.y || 0, z: f.z } : null }; }
    if (h.roof) return E[h.roof] ? { room: E[h.roof], point: at(h.point) } : {}; // a roof: into the room under it
    const e = h.entity;
    const room = h.floor ? e : h.wall ? E[w.roomOfWall(h.wall)] : e?.kind === 'room' ? e : e?.kind === 'object' ? (E[e.room] || app.roomAt(e.x, e.z, e.y || 0)) : e?.kind === 'token' ? app.roomAt(e.x, e.z, e.y || 0) : null;
    return room ? { room, point: at(h.point) } : {};
  };
  // ... AND CENTRES (Harry 2026-10-06: "The double click thing works great, but let's have it also center on the double
  // click as well as cutting above"): the double-clicked point glides to the middle of the view (app.centreOn). Open
  // ground too. A picture-in-picture does the same within itself: showing this area it sets the cut as the main view
  // does; showing another area (where nothing can be acted on yet) it only centres. The library shelves do neither.
  // the world point under a screen point: on the first thing a click would reach, else on the floor or the ground
  app.pointAt = (cx, cy, view = app.main) => {
    const w = app.worldOf(view.area), r = app.rayAt(cx, cy, view), h = w.pickAll(r)[0];
    if (h?.point) { const e = h.entity, E = w.view?.entities || {}; return { x: h.point.x, y: h.point.y, z: h.point.z, hidden: !!(e?.hidden || (e?.room && E[e.room]?.hidden)) }; }
    const f = w.floorPoint(r.ray, { max: app.floorMax?.() ?? Infinity }); return f ? { x: f.x, y: f.y || 0, z: f.z } : null;
  };
  canvas.addEventListener('dblclick', (ev) => {
    if (app.mode) return;
    const pip = inPip(ev), V = pip ? app.pip : app.main;
    if (pip && (V.area.startsWith('lib:') || !app.worlds.get(V.area))) return;
    const t = app.cutTargetAt(ev.clientX, ev.clientY, V);
    if (V.area === app.area()) { if (t.room) app.cutToRoom(t.room, 'dblclick'); else if (t.ground) app.cutOff('dblclick'); }
    if (t.point && (t.room || t.ground)) app.centreOn(t.point, V);
    if (pip) return;
    const one = app.selected()[0];
    if (!one) return;
    const kids = app.childrenOf(one);
    if (kids.length) app.select(kids.map(k => k.id)); // step inside
  });

  // ---------- moving the selection ----------
  function startMove(ground, alt) {
    app.materializeSelection(); // a generated wall/door/window becomes an object first, so the drag shows the real thing
    const things = app.selected().filter(draggable);
    const rooms = app.roomsIn(things); // the rooms that move (a building: all of its rooms)
    const inRooms = new Set(rooms.map(r => r.id));
    const set = new Map();
    for (const e of things) if ((e.kind === 'object' || e.kind === 'token') && !inRooms.has(e.room)) { set.set(e.id, e); for (const d of app.descendants(e)) set.set(d.id, d); }
    g = { kind: 'move', start: ground, things, rooms, moving: [...set.values()], alt, dx: 0, dz: 0, ok: true, lead: g?.target || null };
  }
  // PAWNS AND THE SQUARES. Since 2026-10-11 a dragged pawn moves FREELY and Shift snaps it to the centre of a 5-ft
  // square (Harry: "we should flip 'shift to grid' for pawns as well, though I am less sure here"); Settings ▸ Me has
  // the old rule (2026-10-06: it snaps, Shift frees it). app.pawnSnaps (main.js) answers which. Several pawns dragged together keep their
  // spacing: the one that was grabbed lands on a centre and the rest go with it. Other seats see the snapped place.
  const PAWN_CELL = 5;
  const pawnSnap = (dx, dz, ev) => {
    if (!app.pawnSnaps(!!ev?.shiftKey) || g.rooms?.length || !g.things?.length || !g.things.every(e => e.kind === 'token')) return [dx, dz];
    // (a large creature's base covers 2 x 2 squares: it stands where the four meet, client/pawns.js pawnPoint)
    const lead = g.things.find(e => e.id === g.lead) || g.things[0], size = app.figures?.sizeOf(lead) || 1, c = (v) => size % 2 ? (Math.floor(v / PAWN_CELL) + 0.5) * PAWN_CELL : Math.round(v / PAWN_CELL) * PAWN_CELL;
    return [c(lead.x + dx) - lead.x, c(lead.z + dz) - lead.z];
  };
  // ORDINARY THINGS (furniture) move freely; SHIFT snaps the one that was grabbed to the half squares (2.5 ft: a square's
  // middle or its edge), and a group goes with it (Harry 2026-10-11: "Shift should be 'snap to steps' across the board").
  // Not for what has its own rule: a thing on a table top or a wall (it follows the surface), wall pieces, posts, doors
  // and windows (on the grid; Shift FREES them, they must sit on whole squares to join up), floor tiles, stairs, rooms.
  const THING_STEP = 2.5, ownRule = (e) => e.kind !== 'object' || ['kit', 'tile', 'stair', 'wall', 'surface'].includes(e.place) || !!e.fromEdge;
  const thingSnap = (dx, dz, ev) => {
    if (!ev?.shiftKey || g.rooms?.length || !g.things?.length || g.things.some(ownRule)) return [dx, dz];
    const lead = g.things.find(e => e.id === g.lead) || g.things[0], c = (v) => Math.round(v / THING_STEP) * THING_STEP;
    return [c(lead.x + dx) - lead.x, c(lead.z + dz) - lead.z];
  };
  function dragMove(ground, ev, r) {
    if (!ground || !g.start) return;
    let dx = ground[0] - g.start[0], dz = ground[1] - g.start[1];
    if (g.rooms.length || g.things.some(isTile)) { dx = Math.round(dx / 5) * 5; dz = Math.round(dz / 5) * 5; } // rooms and floor tiles live on the 5-ft grid
    [dx, dz] = pawnSnap(dx, dz, ev);
    [dx, dz] = thingSnap(dx, dz, ev);
    g.dx = dx; g.dz = dz;
    // a single thing re-uses its placement semantics (onto a tabletop, against a wall); a group moves rigidly
    g.single = null;
    if (!g.alt && g.things.length === 1 && g.things[0].kind === 'object' && !g.rooms.length) {
      const e = g.things[0], cat = { id: e.cat, place: e.place };
      const p = app.modes.placementAt(cat, { dims: e.dims, place: e.place }, r, Object.assign([e.x + dx, e.z + dz], { y: app.floorYOf(e) }), { alt: ev.altKey, rot: e.rot, exclude: new Set(g.moving.map(m => m.id)), free: ev.shiftKey && e.place === 'kit' });
      if (p && (e.place === 'wall' || e.place === 'surface' || e.place === 'kit' || e.place === 'tile' || e.place === 'stair')) { g.single = p; dx = p.x - e.x; dz = p.z - e.z; }
    }
    // SEVERAL wall pieces, doors, windows or posts move as one and stay on the grid: the whole group steps by 5 ft (posts
    // alone: by 2.5 ft, cross to edge midpoint). Shift frees them (Harry 2026-10-05), exactly as for a single piece.
    g.free = !!ev.shiftKey;
    if (!g.single && !g.rooms.length && g.things.length > 1 && g.things.every(e => e.kind === 'object' && e.place === 'kit') && !ev.shiftKey) {
      const step = g.things.every(e => app.modes.isPost(e.cat)) ? 2.5 : 5;
      dx = Math.round(dx / step) * step; dz = Math.round(dz / step) * step; g.dx = dx; g.dz = dz;
    }
    app.localDrags.clear();
    for (const e of g.moving) app.localDrags.set(e.id, { x: e.x + dx, z: e.z + dz, rot: g.single && e === g.things[0] ? g.single.rot : undefined });
    app.moveDrag = { dx, dz, free: g.free, single: g.single ? { x: g.single.x, z: g.single.z, edge: g.single.edge || null } : null }; // (tests)
    // pawns: where they would land if let go now, for the distance readout (surfaces/rulers.js). endMove's rule: the
    // floor under the pointer may be at another height (upstairs, a cellar), and then that is where they go.
    if (!g.rooms.length && g.things.length && g.things.every(e => e.kind === 'token')) {
      const free = r && groundOf(r), up = !!free && (free.y || 0) !== (g.start.y || 0), [lx, lz] = up ? pawnSnap(free[0] - g.start[0], free[1] - g.start[1], ev) : [dx, dz];
      app.moveDrag.pawns = { lead: (g.things.find(e => e.id === g.lead) || g.things[0]).id, n: g.things.length, dx: lx, dz: lz, dy: up ? (free.y || 0) - (g.start.y || 0) : 0 };
    }
    // ROOMS: each goes out as ONE drag entry at its would-be centre; the view carries the room's floor, walls and things
    // along and draws its footprint there (world.js), here and for every other seat (presence), in my colour, or red
    // when the drop would be refused (it overlaps a room that is staying put)
    const drag = [];
    if (g.rooms.length) {
      const clash = app.roomClash(g.rooms, (rm) => ({ ...rm.recipe, x: rm.recipe.x + dx / 5, z: rm.recipe.z + dz / 5 }));
      g.ok = !clash; g.clash = clash;
      for (const rm of g.rooms) { const c = rm.recipe, p = { x: (c.x + c.w / 2) * 5 + dx, z: (c.z + c.d / 2) * 5 + dz }; app.localDrags.set(rm.id, { ...p, ok: g.ok }); drag.push({ id: rm.id, ...p }); }
      const one = g.rooms.length === 1 ? g.rooms[0].recipe : null;
      roomLabel.hidden = false; roomLabel.textContent = `${one ? `${one.w * 5} × ${one.d * 5} ft` : `${g.rooms.length} rooms`}${clash ? ` · overlaps ${app.nameOf(clash.hit)}` : dx || dz ? ` · ${dirWords(dx, dz)}` : ''}`;
      roomLabel.classList.toggle('bad', !!clash); roomLabel.style.left = `${ev.clientX + 40}px`; roomLabel.style.top = `${ev.clientY + 40}px`;
      app.roomDrag = { ok: g.ok, dx, dz, rooms: g.rooms.map(x => x.id), clash: clash?.hit.id || null }; // (tests)
    }
    for (const e of g.moving) { const p = app.localDrags.get(e.id); drag.push({ id: e.id, x: p.x, z: p.z }); }
    app.ps.set(app.area(), { cursor: ground, drag: drag.slice(0, 64) });
  }
  const dirWords = (dx, dz) => [dx ? `${Math.abs(dx)} ft ${dx > 0 ? 'east' : 'west'}` : '', dz ? `${Math.abs(dz)} ft ${dz > 0 ? 'south' : 'north'}` : ''].filter(Boolean).join(', ');
  function endMove(ev, r) {
    let { dx, dz } = g, dy = 0;
    // DROPPED ON A FLOOR AT ANOTHER HEIGHT (storeys): the drag ran on the plane it started on; if the floor actually
    // under the pointer at release is higher or lower (an upper room, the ground beside the building, a cellar seen
    // through the opened ground), the things land THERE, at that floor's height: a pawn dragged onto a visible floor
    // stands on it. Rooms never change height by a drag.
    if (r && !g.rooms.length && !g.single && g.start && !g.things.some(isTile)) {
      const free = groundOf(r);
      if (free && (free.y || 0) !== (g.start.y || 0)) { dx = free[0] - g.start[0]; dz = free[1] - g.start[1]; [dx, dz] = pawnSnap(dx, dz, ev); dy = (free.y || 0) - (g.start.y || 0); g.dx = dx; g.dz = dz; }
    }
    app.lastDrop = { dx, dz, dy }; // (tests)
    app.localDrags.clear(); app.roomDrag = null; app.moveDrag = null;
    if (!dx && !dz && !(g.single && (g.single.x !== g.things[0].x || g.single.z !== g.things[0].z))) return;
    if (g.alt) { // Alt-drag duplicates, leaving the originals where they were
      const things = g.things.filter(e => e.kind === 'object' || e.kind === 'token');
      const c = app.centroid(things);
      if (c) app.pasteData(clipFrom(app, things), [c[0] + dx, c[1] + dz]);
      return;
    }
    if (g.single) {
      const e = g.things[0], p = g.single;
      const ops = [app.modes.edgeTaken(p.edge, e.fromEdge), ...(isTile(e) ? tilesAt(app, p.x, p.z, new Set([e.id]), p.y || 0).map(o => ({ type: 'object.delete', args: { id: o.id } })) : []), { type: 'object.move', args: { id: e.id, x: p.x, z: p.z, y: p.y, rot: p.rot, parent: p.parent || '', room: p.room || '' } }];
      for (const d of app.descendants(e)) ops.push({ type: 'object.move', args: { id: d.id, x: r2(d.x + dx), z: r2(d.z + dz) } });
      app.batch(ops);
      return;
    }
    // a room dropped onto another room: refused, and said so (moveBy toasts; the footprint was red all along)
    if (g.rooms.length && !g.ok) { const c = g.clash; app.worldOf(app.area()).flashRect((c.room.recipe.x * 5) + dx, (c.room.recipe.z * 5) + dz, (c.room.recipe.x + c.room.recipe.w) * 5 + dx, (c.room.recipe.z + c.room.recipe.d) * 5 + dz); app.lastRefusal = { what: 'room.move', room: c.room.id, hit: c.hit.id, at: Date.now() }; }
    app.moveBy(g.things, dx, dz, { dy });
  }

  // marquee: things WHOLLY inside the box, at the current granularity (rooms and buildings at the overview detent)
  function selectBox(m) {
    const x0 = Math.min(m.x, m.x1), x1 = Math.max(m.x, m.x1), y0 = Math.min(m.y, m.y1), y1 = Math.max(m.y, m.y1);
    const w = world(), ids = [];
    const inside = (b) => { if (!b) return false; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const s = app.screenOf(x, z, app.main, y); if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) return false; } return true; };
    const overview = app.overview();
    for (const [id, r] of w.recs) {
      const e = r.entity;
      if (overview ? e.kind !== 'room' : !(e.kind === 'object' || e.kind === 'token')) continue;
      if (w.cutHides(e)) continue; // a box never takes what the cut hides
      if (!inside(w.boundsOf(r))) continue;
      // ... nor what a floor, the ground or a roof hides (Harry 2026-10-06: a box dragged on lv 2 gathered the things
      // of lv 1 under its floor, drawn or not): world.inSight, asked only of the things already inside the box
      if (!overview && !w.inSight(r, app.main.camera)) continue;
      ids.push(overview && e.building ? e.building : id);
    }
    // floor tiles come along only when the box holds nothing else (sweeping a furnished room picks the furniture)
    const notTiles = ids.filter(id => !isTile(app.ent(id)));
    app.select([...new Set(notTiles.length ? notTiles : ids)], m.shift ? 'add' : 'replace');
  }

  // ---------- wheel, keys that belong to gestures ----------
  // ONE rotate behaviour for every rotate input (Harry 2026-10-04): free camera rotation, exactly the tuner's and Map
  // Garden's middle-drag: yaw and pitch pivoting on the ground point that was under the pointer where the gesture
  // STARTED (grab-the-world: that point stays put on screen), the pitch kept above the floor. No fixed orbit centre.
  // Middle-drag and Option-drag go through GrabCamera's own orbit grab; Option + two-finger scroll, Safari's two-finger
  // rotate and Q/E/PageUp/PageDown use this, with the same rates.
  const pivotAt = (x, y, V = app.main) => ({ anchor: V.grab.groundAt(x, y), x, y });
  // every rotate input that isn't GrabCamera's own orbit drag (Option-scroll, Safari's rotate gesture, Q/E) comes through
  // here, so the player's Settings › Me › Controls rotate speed and invert apply to all of them (the orbit drag gets them in
  // surfaces/settings.js)
  const rotK = () => { const p = app.prefs; return p ? (p.rotateSpeed ?? 1) * (p.invertRotate ? -1 : 1) : 1; };
  function rotateView(p, dyaw, dpitch, V = app.main) {
    const k = rotK(); dyaw *= k; dpitch *= k;
    const G = V.grab;
    G.yaw = (G.yaw + dyaw + 540) % 360 - 180;
    G.pitch = THREE.MathUtils.clamp(G.pitch + dpitch, G.minPitch, 89.5);
    G.update();
    if (p?.anchor) G.pinTo(p.anchor, p.x, p.y);
  }
  app.rotateView = rotateView;
  let lastPtr = null;
  // (on the window, not the canvas: the pointer may be over a room label or another overlay when Q / E is pressed, and the
  // pivot must still be the ground under it; with the canvas alone it was wherever the pointer last crossed bare canvas)
  addEventListener('pointermove', (ev) => { lastPtr = [ev.clientX, ev.clientY]; }, true);

  // The wheel, mouse or trackpad (Harry 2026-10-04, on a MacBook with no mouse; re-done 2026-10-06 after "mouse wheel
  // scroll pans up and down instead of zooming" in Chrome). Browsers deliver a trackpad's two-finger movement and pinch
  // as wheel events too, so they are told apart, per gesture, in wheel.js (the table of signatures is there):
  //   ctrlKey              a pinch (Chrome, Firefox, Edge on a Mac; also Ctrl+wheel)      → zoom at the cursor
  //   trackpad scroll      → PAN (Figma, Maps); with Option/Alt held → ORBIT (never below the floor)
  //   mouse wheel          → zoom at the cursor
  // Settings ▸ Me ▸ Scroll wheel (auto / zoom / pan) overrules the guess.
  const wheelKind = makeWheelClassifier({ mode: () => app.prefs?.wheel || 'auto' });
  app.wheelClassifier = wheelKind;
  const classify = (ev) => { const kind = wheelKind.classify(ev, performance.now()); if (kind === 'trackpad') app.trackpad = true; return kind; };
  app.wheelLog = [];
  let wheelPivot = null;
  let wheelLatch = null; // a wheel or trackpad sequence stays with the view it started in until ~150 ms of quiet
  const onWheel = (ev) => {
    ev.preventDefault(); if (!app.main) return;
    const now = performance.now();
    if (!wheelLatch || now - wheelLatch.at > 150 || !app.views.includes(wheelLatch.view)) wheelLatch = { view: inPip(ev) && app.pip ? app.pip : app.main };
    wheelLatch.at = now;
    const V = wheelLatch.view;
    if (V === app.main) app.main.rule = 'free'; else { app.library?.touched(); if (V.rule === 'follow') V.rule = 'free'; }
    const G = V.grab, cx = ev.clientX, cy = ev.clientY;
    let did;
    if (ev.ctrlKey) { G.zoomAt(cx, cy, Math.exp(Math.max(-60, Math.min(60, ev.deltaY)) * 0.01)); did = 'zoom'; }
    else if (classify(ev) === 'trackpad') {
      if (ev.altKey) { // rotate, pivoting where this scroll gesture began (the same rates as a drag)
        const now = performance.now();
        if (!wheelPivot || now - wheelPivot.at > 350 || wheelPivot.view !== V) wheelPivot = { ...pivotAt(cx, cy, V), view: V };
        wheelPivot.at = now;
        rotateView(wheelPivot, -ev.deltaX * 0.4, ev.deltaY * 0.3, V);
        did = 'orbit';
      } else { G.beginGrab(cx, cy, 'pan'); G.dragTo(cx - ev.deltaX, cy - ev.deltaY); G.endGrab(); did = 'pan'; }
    } else { G.zoomAt(cx, cy, ev.deltaY > 0 ? 1 / 0.9 : 0.9); did = 'zoom'; }
    app.wheelLog.push(did); if (app.wheelLog.length > 50) app.wheelLog.shift();
    app.wheelView = V === app.main ? 'main' : 'pip';
    app.refresh();
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  // (and over a room or building label, which is DOM over the canvas: the wheel zoomed nothing there, and the labels
  // are big. 2026-10-06)
  const labelLayer = document.getElementById('labels');
  labelLayer?.addEventListener('wheel', (ev) => { if (!ev.target.closest?.('.rlabel.editing')) onWheel(ev); }, { passive: false });
  labelLayer?.addEventListener('contextmenu', (ev) => ev.preventDefault());
  // Safari on a Mac: pinch and two-finger rotate arrive as gesture events (scale and rotation, cumulative)
  let gest = null;
  canvas.addEventListener('gesturestart', (ev) => { ev.preventDefault(); if (!app.main) return; const V = inPip(ev) && app.pip ? app.pip : app.main; if (V !== app.main) app.library?.touched(); gest = { scale: 1, rotation: 0, V, pivot: pivotAt(ev.clientX, ev.clientY, V) }; });
  canvas.addEventListener('gesturechange', (ev) => {
    ev.preventDefault(); if (!app.main || !gest) return;
    const G = gest.V.grab;
    if (ev.scale > 0 && gest.scale > 0) G.zoomAt(gest.pivot.x, gest.pivot.y, gest.scale / ev.scale);
    rotateView(gest.pivot, -(ev.rotation - gest.rotation), 0, gest.V);
    Object.assign(gest, { scale: ev.scale, rotation: ev.rotation }); if (gest.V === app.main) app.main.rule = 'free'; app.refresh();
  });
  canvas.addEventListener('gestureend', (ev) => { ev.preventDefault(); gest = null; });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault()); // right-click menus are tabled (Harry 2026-10-02)
  const held = new Map(); // key -> pivot taken when it went down
  const RATE = { q: [55, 0], e: [-55, 0], pageup: [0, 40], pagedown: [0, -40] };
  addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' && !ev.target.closest?.('input, textarea')) { space = true; canvas.classList.add('panning'); }
    if (app.main && !ev.target.closest?.('input, textarea, [contenteditable]')) {
      const k = ev.key.toLowerCase();
      if (RATE[k] && !ev.ctrlKey && !ev.metaKey && !held.has(k) && !app.tray?.takesKeys('build') && !app.tray?.takesKeys('pawns')) { /* an open Build or Pawns menu owns letters (a pinned one: only under the pointer) */ const r = canvas.getBoundingClientRect(); held.set(k, pivotAt(...(lastPtr || [r.left + r.width / 2, r.top + r.height / 2]))); app.main.rule = 'free'; }
    }
  });
  addEventListener('keyup', (ev) => { if (ev.code === 'Space') { space = false; canvas.classList.remove('panning'); } held.delete(ev.key.toLowerCase()); });
  addEventListener('blur', () => held.clear());
  app.on((what, dt) => { if (what !== 'frame' || !held.size || !app.main) return; for (const [k, p] of held) rotateView(p, RATE[k][0] * dt, RATE[k][1] * dt); });
  app.spaceHeld = () => space;
}
const r2 = (v) => Math.round(v * 100) / 100;
