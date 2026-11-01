// THE FACING ARROW IS A TURN HANDLE (Harry 2026-10-29: "Let's make the facing arrow a grab handle for rotation, I noticed
// I frequently want to do that"). docs/UI.md "Turning a pawn by its arrow".
//   hover     over the arrow of a pawn you may turn (yours; every pawn for the GM): a turn cursor and the arrow glows
//             (figures.js base setHot). A pawn you may not turn: nothing, the ordinary pointer.
//   drag      press on the arrow and drag (mouse, pen or one finger; the pawn need not be selected): the pawn swings round
//             its own middle, its facing following the pointer's angle about the base, measured on the plane of the
//             base (a raised pawn's base stays on the ground, and so does its arrow: the foot group). Snaps to the turn
//             step that R and the ring's Turn use (45°, absolute: the pawn lines up with the walls); Shift held: free.
//             The other seats see it swing (presence drags, as the ring's Turn).
//   release   ONE token.move { rot } (the path R and the ring use): one undo step, synced. Escape cancels.
//   It never starts a move or a box, and a press that never moves is the ordinary click (select).
// input.js calls press/begin/move/end from its own gesture; pickAll marks a hit on the arrow or its pad `handle`.
import * as THREE from 'three';
import { icon } from './icons.js';

export const TURN_STEP_DEG = 45; // = app.rotateSelection(45) (R, a click on the ring's Turn) and the ring's notches

export function installTurnHandle(app, canvas) {
  const STEP = TURN_STEP_DEG * Math.PI / 180, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const turnable = (e) => e?.kind === 'token' && (app.gm() || app.canTouch(e));
  const baseOf = (id) => app.worldOf(app.area())?.recs.get(id)?.visual?.userData.base || null;
  // the cursor: the ring's own Turn icon (Lucide rotate-cw), dark on a pale outline so it reads on any floor
  const svg = (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${['#fffaf0', '#1d1a15'].map((c, i) => `<g stroke="${c}" stroke-width="${i ? 2 : 5}">${w}</g>`).join('')}</svg>`;
  const inner = icon('rotate-cw', 24).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const cur = `url("data:image/svg+xml,${encodeURIComponent(svg(inner))}") 12 12, grab`;
  const sheet = document.createElement('style'); sheet.textContent = `#c.turn-handle, #c.turning { cursor: ${cur}; }`; document.head.append(sheet);

  let hotId = null, T = null;
  const setHot = (id) => { if (id === hotId) return; baseOf(hotId)?.userData.setHot?.(false); hotId = id; baseOf(id)?.userData.setHot?.(true); canvas.classList.toggle('turn-handle', !!id); };
  // the pawn whose arrow a hit is on, if this seat may turn it
  const handleOf = (hit) => hit?.handle && turnable(hit.entity) ? hit.entity.id : null;
  // the pointer on the plane of the base (its foot: on the ground under a raised pawn)
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), at = new THREE.Vector3(), _c = new THREE.Vector3();
  const centreOf = (id) => { const b = baseOf(id); if (!b) return null; b.updateMatrixWorld(true); return b.getWorldPosition(_c).clone().setY(_c.y + b.userData.top); };
  const pointer = (ev, c) => { plane.constant = -c.y; return app.rayAt(ev.clientX, ev.clientY).ray.intersectPlane(plane, at) ? [at.x - c.x, at.z - c.z] : null; };

  function begin(ev, id) {
    const e = app.ent(id), c = centreOf(id); if (!turnable(e) || !c) return false;
    const p = pointer(ev, c); if (!p) return false;
    T = { id, c, r0: e.rot || 0, a0: Math.atan2(p[0], p[1]), d: 0, rot: e.rot || 0, moved: false };
    setHot(id); canvas.classList.add('turning');
    app.escapeStack.push(onEsc);
    return true;
  }
  function move(ev) {
    if (!T) return;
    const p = pointer(ev, T.c); if (!p || Math.hypot(p[0], p[1]) < 0.25) return; // (right over the middle the angle is noise)
    let d = wrap(Math.atan2(p[0], p[1]) - T.a0);
    if (Math.abs(d - T.d) > Math.PI) d += Math.sign(T.d - d) * 2 * Math.PI; // keep turning past ±180°
    T.d = d;
    const rot = ev.shiftKey ? T.r0 + d : Math.round((T.r0 + d) / STEP) * STEP; // the turn step; Shift: free
    T.moved = true; T.rot = rot;
    const e = app.ent(T.id) || { x: 0, z: 0 };
    app.localDrags.set(T.id, { x: e.x, z: e.z, rot });
    app.ps.set(app.area(), { cursor: app.cursor, drag: [{ id: T.id, x: e.x, z: e.z, rot }] });
  }
  function end(how = 'up') {
    if (!T) return null;
    const t = T; T = null; canvas.classList.remove('turning');
    { const i = app.escapeStack.indexOf(onEsc); if (i >= 0) app.escapeStack.splice(i, 1); }
    app.localDrags.delete(t.id); app.ps.set(app.area(), { cursor: app.cursor, drag: null });
    const log = app.turnHandleLast = { id: t.id, how, moved: t.moved, rot: t.rot, from: t.r0, committed: false };
    if (how !== 'escape' && t.moved && Math.abs(wrap(t.rot - t.r0)) > 1e-4) {
      const e = app.ent(t.id); // as it is now (another seat may have moved it meanwhile)
      try { if (e) { app.dispatch('token.move', { id: e.id, x: e.x, z: e.z, rot: +wrap(t.rot).toFixed(4) }); log.committed = true; } }
      catch (err) { log.error = String(err?.message || err); app.toast(`That turn could not be sent: ${log.error}`, true); } // never a silent snap-back
    }
    setHot(null);
    return log;
  }
  const onEsc = () => { if (!T) return false; end('escape'); };
  return { handleOf, begin, move, end, hover: (hit) => setHot(T ? T.id : handleOf(hit)), active: () => !!T, turnable };
}
