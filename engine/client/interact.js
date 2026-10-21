// THE HAND COMES FIRST (Harry 2026-10-06: "force priority to pan / rotate / mouse actions type stuff, so that that will
// tend to never feel laggy and trump other stuff").
//
// WHAT CAN AND CANNOT BE DONE. A frame is one piece of work on one thread: the browser cannot draw half of it and take an
// input in between, so input cannot be "given priority" inside a frame. What the hand feels is: (the rest of the frame
// that was being drawn when it moved) + (the whole of the next frame, which shows the move). So two things help, and
// only two: MAKE THE FRAME CHEAP WHILE THE HAND MOVES, and KEEP EVERYTHING THAT IS NOT THE PICTURE OUT OF THE WAY.
//
// 1. MOVING. The hand is moving when the main view's camera is not where it was a frame ago (a pan, a turn, a zoom, by
//    mouse, trackpad, keys or a glide), when something is being dragged (a pawn, a thing, a room, a ring handle), or
//    when a button is down on the map. It stops being "moving" HOLD_MS after the last of those.
//
// 2. THE GOVERNOR. While moving, the frame has a target (TARGET_MS). When frames run over it, effects are shed ONE AT A
//    TIME in a fixed order, least noticeable first, and each is kept only if it actually bought time on this machine
//    (measured: the frames after against the frames before); one that did not is put straight back and not tried again
//    for a while. Under the target nothing is shed: a small map on a fast machine never changes. What was needed is
//    remembered, so the next move starts there instead of finding it again (and a move that ends with time to spare
//    hands one stage back for the next). A moment after the hand stops, everything
//    comes back; contact shadows fade back in over FADE_MS so the picture does not pop.
//      1  the fire's shadow stops dancing (it is redrawn only when something near the fire moves)
//      2  the fog's simulation runs every second frame
//      3  the smallest things (under NAP_PX on screen, zoomed far out) are not drawn
//      4  contact shadows off
//      5  on a high-density screen, and only when frames still take twice the target, the picture is drawn at fewer
//         pixels (never under 1 per CSS pixel); this one is found again by each move, never where a move starts
//    Settings ▸ Me ▸ "Lighter picture while moving" switches the shedding off (the picture is then never touched).
//
// 3. NOT THE PICTURE. Work that can wait does: seating things on table tops gets a sliver of each frame instead of 3 ms,
//    far rooms are not put to sleep, area pictures are not taken, while the hand moves (app.interact.busy()); a burst of
//    state changes is applied to the scene once a frame, not once per change (main.js); hover picking is done once a
//    frame with the latest pointer place, not once per mouse event (main.js); and none of it at all in a frame for which
//    the browser says input is already waiting (navigator.scheduling.isInputPending: Chromium only. Firefox and Safari
//    have no such call: there the rules above are all there is, which is most of it.)
export const TARGET_MS = 1000 / 60;  // the frame time aimed for while the hand moves
export const HOLD_MS = 350;          // how long after the last movement the hand still counts as moving
export const FADE_MS = 300;          // contact shadows fade back in over this
export const NAP_PX = 5;             // a thing smaller than this on screen is not drawn while moving (stage 3)
const OVER = 1.2, SPARE = 0.6, EVAL = 8, GAIN = 0.05, RETRY_MS = 60000; // shed when the average runs 20% over; a move that ends under 60% of the target gives one stage back; judge a stage over 8 frames; keep it for a 5% gain; try a rejected stage again after a minute
export const STAGES = ['shadow-still', 'fog-half', 'small-things', 'contact-shadows', 'pixels'];

export function createInteraction(app, { canvas, renderer }) {
  const S = { moving: false, active: false, lastMove: -1e9, level: 0, shed: new Set(), learned: [], rejected: new Map(), why: '', ema: 0, n: 0, sheds: 0, restores: 0, base: null, trial: null, log: [] };
  let pose = null, down = 0, basePR = null, wheelAt = -1e9;
  // a button down on the map, the wheel: seen here so the input code needs no change (capture: before anything stops it)
  canvas.addEventListener('pointerdown', () => { down++; }, true);
  const up = () => { down = Math.max(0, down - 1); };
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true); addEventListener('blur', () => { down = 0; });
  canvas.addEventListener('wheel', () => { wheelAt = performance.now(); }, { capture: true, passive: true });
  // (under a test driver the shedding is off unless the test asks for it, tw.interactForce = true: it follows the frame
  // time, so on a busy test box it would come and go in the middle of suites that are about something else)
  const driven = typeof navigator !== 'undefined' && navigator.webdriver === true;
  const on = () => app.prefs?.lightMoves !== false && !app.interactOff && (!driven || !!app.interactForce);
  const world = () => app.area() && app.worlds.get(app.area());
  const pending = () => { try { return !!navigator.scheduling?.isInputPending?.({ includeContinuous: true }); } catch { return false; } };

  // ---- the stages: each can be put on and taken off at once
  function apply(name, shed, now) {
    const w = world(), fx = w?.fx; if (!fx) return false;
    if (name === 'shadow-still') fx.lighting.shed?.({ dance: shed });
    else if (name === 'fog-half') fx.atmos.shed?.(shed ? 2 : 1);
    else if (name === 'small-things') { w.napPx = shed ? NAP_PX : 0; w.napStep?.(app.main.camera, canvas.clientHeight, true); }
    else if (name === 'contact-shadows') fx.lighting.shed?.({ ao: shed, fade: shed ? 0 : FADE_MS });
    else if (name === 'pixels') {
      if (shed) { const pr = renderer.getPixelRatio(); if (pr <= 1.01) return false; basePR ??= pr; renderer.setPixelRatio(Math.max(1, pr * 0.7)); }
      else if (basePR != null) { renderer.setPixelRatio(basePR); basePR = null; } else return false;
      fx.setSize(canvas.clientWidth, canvas.clientHeight); // (three.js resizes the canvas itself, so the frame loop sees nothing to do: the post stack's buffers are resized here. Before 2026-10-11 they were not, and this stage saved almost nothing)
    }
    if (shed) S.shed.add(name); else S.shed.delete(name);
    S.log.push([Math.round(now), shed ? 'shed' : 'back', name]); if (S.log.length > 60) S.log.shift();
    if (shed) S.sheds++;
    return true;
  }
  function restoreAll(now) { for (const name of [...S.shed].reverse()) apply(name, false, now); S.trial = null; S.base = null; if (S.restores !== undefined) S.restores++; }

  // ---- every frame (main.js, before the worlds' own frame): is the hand moving, and is the frame keeping up?
  function frame(now, dtMs) {
    if (S.held) { const w = world(); if (w?.napPx) w.napStep?.(app.main.camera, canvas.clientHeight, false); return; }
    const g = app.main?.grab, p = g ? [g.focus.x, g.focus.z, g.yaw, g.pitch, g.dist] : null;
    const cam = !!(p && pose && p.some((v, i) => Math.abs(v - pose[i]) > 1e-6)); pose = p;
    const why = cam ? 'camera' : app.localDrags.size ? 'drag' : down ? 'button' : now - wheelAt < 120 ? 'wheel' : '';
    if (why) { S.lastMove = now; S.why = why; }
    S.moving = !!why;
    const active = now - S.lastMove < HOLD_MS;
    if (active && !S.active) { // the hand has started: begin where the last move ended up
      S.ema = 0; S.n = 0; S.trial = null; S.base = null;
      if (on()) for (const name of S.learned) apply(name, true, now);
    }
    if (!active && S.active) {
      // what this move needed is where the next one starts; but if it ended with time to spare (the map changed, the
      // zoom changed, the machine is less busy), the next one starts one stage richer, and so on back up
      S.learned = STAGES.filter(n => S.shed.has(n) && n !== 'pixels'); if (S.learned.length && S.n > 6 && S.ema < TARGET_MS * SPARE) S.learned.pop(); // (fewer pixels is never where a move STARTS: resizing the buffers at the start and end of every move would be worse than what it saves)
      restoreAll(now);
    }
    S.active = active;
    if (!active) return;
    if (!on()) { if (S.shed.size) restoreAll(now); return; }
    const w = world(); if (w?.napPx) w.napStep?.(app.main.camera, canvas.clientHeight, false);
    // the frame time while moving: an average over the last few frames (the first frame of a move is not counted: it
    // carries whatever the frame before it was doing)
    if (S.n++ === 0) return;
    S.ema = S.ema ? S.ema + (dtMs - S.ema) / Math.min(S.n, 6) : dtMs;
    if (S.trial) { // a stage is on trial: did it buy anything?
      S.trial.sum += dtMs; if (++S.trial.frames < EVAL) return;
      const after = S.trial.sum / S.trial.frames, t = S.trial; S.trial = null;
      if (after > t.before * (1 - GAIN)) { apply(t.name, false, now); S.rejected.set(t.name, now); S.log.push([Math.round(now), 'no gain', t.name, +t.before.toFixed(1), +after.toFixed(1)]); }
      else S.log.push([Math.round(now), 'kept', t.name, +t.before.toFixed(1), +after.toFixed(1)]);
      S.ema = after; S.n = 1; return;
    }
    if (S.n < 5 || S.ema <= TARGET_MS * OVER) return;
    // (the last stage changes the size of every buffer, which is itself a stutter: only when frames run at twice the target)
    const next = STAGES.find(n => !S.shed.has(n) && !(now - (S.rejected.get(n) ?? -1e9) < RETRY_MS) && (n !== 'pixels' || S.ema > TARGET_MS * 2));
    if (next && apply(next, true, now)) S.trial = { name: next, before: S.ema, sum: 0, frames: 0 };
    else if (next) S.rejected.set(next, now); // (cannot be shed here, e.g. the screen is not high-density)
  }

  const self = {
    frame, state: S, STAGES,
    get active() { return S.active; },
    // may work that can wait run now? (not while the hand moves, and not in a frame with input already waiting)
    busy: () => S.active || pending(),
    inputPending: pending,
    // (tests, and a tuner later) what is shed right now, and why
    info: () => ({ on: on(), moving: S.moving, active: S.active, why: S.why, shed: STAGES.filter(n => S.shed.has(n)), learned: [...S.learned], ema: +S.ema.toFixed(2), target: TARGET_MS, sheds: S.sheds, log: S.log.slice(-12), isInputPending: typeof navigator.scheduling?.isInputPending === 'function' }),
    reset() { restoreAll(performance.now()); S.learned = []; S.rejected.clear(); S.active = false; S.lastMove = -1e9; },
    // (stills, and a tuner later) put these stages on and keep them on, hand or no hand, until hold(null)
    hold(names) { const now = performance.now(); restoreAll(now); S.held = !!names; if (names) for (const n of STAGES) if (names.includes(n)) apply(n, true, now); },
    // (tests) pretend how long a frame takes while moving, so the governor can be checked on any machine: a number of
    // milliseconds, or a function of what is shed (-> ms); null = the real frame time again
    pretend(v) { self.fake = v; },
  };
  const realFrame = frame;
  self.frame = (now, dtMs) => realFrame(now, self.fake == null ? dtMs : typeof self.fake === 'function' ? self.fake(STAGES.filter(n => S.shed.has(n))) : self.fake);
  return self;
}
