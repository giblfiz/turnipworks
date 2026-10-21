// EDGE AUTO-PAN (Harry 2026-10-11: "When dragging around objects, if you drag them to the edge of the window it should
// cause a panning action. (Not on PiP though? Maybe on PiP?)").
//
// (And, the same day: "also while dragging out a room rectangle and during a floor paint stroke".)
// While something is in the hand (a thing, a pawn, a room being moved; a thing dragged out of the library window; a
// figure or a piece of furniture dragged out of a list) and the pointer is held near an edge of the window, the camera
// pans that way: faster the nearer the edge, fastest at the edge and beyond it. After every step the drag is run again
// for the same pointer place, so what is in the hand stays under the pointer and the world slides beneath it.
// Never without a drag: hovering at an edge does nothing.
//
// WHAT KEEPS IT FROM FIRING BY ACCIDENT
//   the delay     the pointer must rest in the band for DELAY_MS before the pan starts (crossing it does nothing)
//   arming        an edge the drag STARTED beside (a thing picked up at the rim, a row in a menu along an edge) does
//                 nothing until the pointer has left that band once, or has moved ARM_PX further toward that edge
//   lists         a thing dragged out of a list pans only while the pointer is over the map (or off the window):
//                 back over the list, a menu or a launcher is where you let go to cancel, and the view holds still
//   the PiP       no pan while the pointer is over the picture-in-picture (PIP: false, below)
//
// IT IS AN ORDINARY CAMERA MOVE. The governor ("lighter picture while moving", interact.js) sees the camera change and
// treats it as the hand moving; rooms coming into view wake before they are drawn (world.js SLEEP); a view that was
// following pawns stops following, as it does for a pan by hand. The level and the cut are not touched: the drag keeps
// to the floor it started on (input.js planeOf), so a pan never lifts a thing to another storey.
import * as THREE from 'three';

// THE TUNABLES, all of them (tw.edgePan.K is this object, so they can be tried live from the console)
export const EDGE_PAN = {
  ON: true,
  BAND_PX: 64,     // how near an edge the pointer must be (CSS pixels, measured inward from the edge of the view)
  MAX_PX_S: 1000,  // the fastest pan: how fast the picture slides, in CSS pixels a second, at the edge itself
  MIN_PX_S: 60,    // the slowest: the speed just inside the band (so the start is felt, not guessed at)
  RAMP: 2,         // the curve from MIN to MAX across the band: 1 = straight, 2 = gentle at first then quick
  DELAY_MS: 150,   // rest this long in the band before anything moves
  EASE_MS: 200,    // then the speed comes in over this long (no lurch)
  ARM_PX: 16,      // an edge the drag began beside wakes when the pointer has gone this much further toward it
  PIP: false,      // true: a drag held near the INSIDE edge of the picture-in-picture pans the picture-in-picture
  PIP_SCALE: 0.4,  // (only with PIP on) the band and the speeds inside the picture-in-picture, as a share of the main view's: it is a small window
  // which canvas gestures pan (input.js): moving things, pawns and rooms; a drag out of the library; a rectangle being
  // drawn for a room or a building (its first corner is a world square, so it stays where it was put while the view
  // slides and the rectangle grows); a floor paint stroke (the run goes on, square by square, under the pointer).
  // NOT the selection box ('marquee'): it is a box of screen pixels that takes what is wholly inside it and in sight;
  // panning it would mean selecting things that have left the screen.
  KINDS: ['move', 'libDrag', 'room', 'paint'],
};

const EDGES = ['left', 'right', 'top', 'bottom'];

export function installEdgePan(app, canvas) {
  const K = EDGE_PAN;
  const sources = []; // { name, active() -> bool, refresh(), mapOnly }: who may have something in the hand
  let inHand = false;
  let ptr = null, run = null; // the pointer, wherever it is; this drag's { src, x0, y0, armed, since }
  const S = { active: false, v: [0, 0], view: null, why: 'no drag', steps: 0, moved: 0 };
  addEventListener('pointermove', (ev) => { ptr = { x: ev.clientX, y: ev.clientY }; }, true);
  addEventListener('pointerdown', (ev) => { ptr = { x: ev.clientX, y: ev.clientY }; }, true);

  // the rectangle of the view the pointer is in, in client pixels: the picture-in-picture's, else the whole map's
  function viewAt(x, y) {
    const c = canvas.getBoundingClientRect();
    const win = { left: Math.max(0, c.left), top: Math.max(0, c.top), right: Math.min(innerWidth, c.right), bottom: Math.min(innerHeight, c.bottom) };
    if (app.pip && app.pip.contains(x - c.left, y - c.top, c.width, c.height)) {
      const [l, t, w, h] = app.pip.rect;
      return { view: app.pip, name: 'pip', win, rect: { left: c.left + l * c.width, top: c.top + t * c.height, right: c.left + (l + w) * c.width, bottom: c.top + (t + h) * c.height } };
    }
    return { view: app.main, name: 'main', win, rect: win };
  }
  // how deep into each edge's band the pointer is: 0 = not in it, 1 = at the edge or past it
  const depths = (x, y, r, k = 1) => { const B = K.BAND_PX * k, d = (v) => Math.max(0, Math.min(1, v / B)); return { left: d(B - (x - r.left)), right: d(B - (r.right - x)), top: d(B - (y - r.top)), bottom: d(B - (r.bottom - y)) }; };
  const speed = (t) => t <= 0 ? 0 : K.MIN_PX_S + (K.MAX_PX_S - K.MIN_PX_S) * Math.pow(t, K.RAMP);

  // slide a view's camera by (sx, sy) pixels of picture: right and up-the-screen positive. The ground along the view's
  // depth is foreshortened by the pitch, so "up" covers more feet per pixel than "across".
  function panView(view, sx, sy, rectH) {
    const g = view.grab, yaw = THREE.MathUtils.degToRad(g.yaw), pitch = THREE.MathUtils.degToRad(g.pitch);
    const ft = 2 * g.dist * Math.tan(THREE.MathUtils.degToRad(view.camera.fov) / 2) / Math.max(1, rectH); // feet per pixel at the focus
    const ax = sx * ft, up = sy * ft / Math.max(0.35, Math.sin(pitch));
    g.focus.x += Math.cos(yaw) * ax - Math.sin(yaw) * up;
    g.focus.z += -Math.sin(yaw) * ax - Math.cos(yaw) * up;
    if (view.rule === 'follow') view.rule = 'free'; // a pan by hand ends a follow; so does this
    g.update();
  }

  function step(dt, now = performance.now()) {
    const src = K.ON && ptr && app.main ? sources.find(s => { try { return s.active(); } catch { return false; } }) : null;
    // the level meter is a strip down the whole left edge of the window: while something is in the hand it takes no
    // pointer (style.css), so the left edge is the map's own edge for the pan and for the drop, and it does not fly open
    if (!!src !== inHand) { inHand = !!src; document.body.classList.toggle('drag-in-hand', inHand); }
    if (!src) { run = null; S.active = false; S.v = [0, 0]; S.why = 'no drag'; return; }
    const { view, name, rect, win } = viewAt(ptr.x, ptr.y), scale = name === 'pip' ? K.PIP_SCALE : 1, d = depths(ptr.x, ptr.y, rect, scale);
    // arming is about the WINDOW's edges, wherever the drag began (a thing taken out of a library window that sits
    // against the window's edge began beside that edge)
    const dw = name === 'main' ? d : depths(ptr.x, ptr.y, win);
    if (!run || run.src !== src) { // a drag has begun: the edges it began beside sleep
      run = { src, x0: ptr.x, y0: ptr.y, since: null, armed: Object.fromEntries(EDGES.map(e => [e, dw[e] === 0])) };
    }
    const toward = { left: run.x0 - ptr.x, right: ptr.x - run.x0, top: run.y0 - ptr.y, bottom: ptr.y - run.y0 };
    for (const e of EDGES) if (!run.armed[e] && (dw[e] === 0 || toward[e] >= K.ARM_PX)) run.armed[e] = true;
    S.view = name; S.armed = { ...run.armed };
    const idle = (why) => { run.since = null; S.active = false; S.v = [0, 0]; S.why = why; };
    if (name === 'pip' && !K.PIP) return idle('over the picture-in-picture');
    const t = (e) => name === 'pip' || run.armed[e] ? d[e] : 0; // (the picture-in-picture's own rim needs no arming)
    let vx = speed(t('right')) - speed(t('left')), vy = speed(t('top')) - speed(t('bottom'));
    if (!vx && !vy) return idle(EDGES.some(e => d[e] > 0) ? 'that edge is not armed yet' : 'not near an edge');
    if (src.mapOnly) { // a drag out of a list: only over the map (or off the window altogether)
      const inWin = ptr.x >= 0 && ptr.y >= 0 && ptr.x < innerWidth && ptr.y < innerHeight;
      if (inWin && document.elementFromPoint(ptr.x, ptr.y) !== canvas) return idle('over a list or a menu');
    }
    run.since ??= now;
    const held = now - run.since - K.DELAY_MS;
    if (held < 0) { S.active = false; S.v = [0, 0]; S.why = 'waiting'; return; }
    const ease = K.EASE_MS > 0 ? Math.min(1, held / K.EASE_MS) : 1;
    vx *= ease * scale; vy *= ease * scale;
    panView(view, vx * dt, vy * dt, rect.bottom - rect.top);
    S.active = true; S.v = [Math.round(vx), Math.round(vy)]; S.why = src.name; S.steps++; S.moved += Math.hypot(vx, vy) * dt;
    try { src.refresh?.(); } catch (e) { console.warn('edge pan', e); } // the thing in the hand: under the pointer again
  }

  return app.edgePan = {
    K, step, state: S,
    // who may have something in the hand: active() says so, refresh() runs the drag again for the pointer where it is
    source(s) { sources.push(s); return s; },
    info: () => ({ on: K.ON, active: S.active, v: [...S.v], view: S.view, why: S.why, armed: S.armed || null, steps: S.steps, moved: +S.moved.toFixed(1), drag: sources.find(s => { try { return s.active(); } catch { return false; } })?.name || null }),
  };
}
