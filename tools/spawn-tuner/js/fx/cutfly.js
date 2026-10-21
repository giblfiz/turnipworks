// FLY-AWAY: the runner (Harry 2026-10-06; schedule and pose are anim.js's flySchedule / flyPose, beside the spawn's).
// What the cut hides lifts straight up and off the top of the view in a quick ripple; what it shows again comes back
// down the same way. One runner for the tuner's panel and for the game (engine/client/cutfly.js), so what Harry tunes
// here is what the game plays.
//
//   fly.launch(pieces, dir, { origin, rng, scale })     dir +1 = leave, -1 = come back
//       piece: { key, obj (the Object3D that is moved: its position.y), x, z, room, fadeRoot?, onEnd(dir, cancelled) }
//       A piece already in flight TURNS ROUND where it is (no jump, no new wait); one still waiting its turn to leave
//       is simply put back.
//   fly.frame(now)     steps what is in flight; with nothing in flight it returns at once (stats().steps does not move)
//   fly.flush()        ends everything now (a picture is about to be taken; the switch went off)
// Nothing here knows about rooms, cuts or picking: the caller hides and shows; this only moves.
import { FLY_DEFAULTS, FLY_SCHEMA, FLY_BUILTINS, flySchedule, flyPose, flyTotal } from '../anim.js';
export { FLY_DEFAULTS, FLY_SCHEMA, FLY_BUILTINS };

const clone = (o) => JSON.parse(JSON.stringify(o));

export function createCutFly({ clock = () => performance.now() } = {}) {
  let P = clone(FLY_DEFAULTS);
  const flights = new Map(); // key -> { piece, u, dir, t0 (when it starts moving), y0, last, mats }
  const st = { steps: 0, launched: 0, turned: 0, ended: 0, batches: 0, lastBatch: null, peak: 0 };

  function fadeTo(f, op) {
    if (!f.mats) { f.mats = []; (f.piece.fadeRoot || f.piece.obj).traverse(o => { if (o.isMesh && o.material && !o.userData.halo) { const was = o.material, m = was.clone(); m.transparent = true; o.material = m; f.mats.push([o, was, m]); } }); }
    for (const [, , m] of f.mats) { m.opacity = op; m.depthWrite = op >= 0.999; }
  }
  function unfade(f) { if (!f.mats) return; for (const [o, was, m] of f.mats) { if (o.material === m) o.material = was; m.dispose(); } f.mats = null; }
  function place(f) { const ps = flyPose(P, f.u); f.piece.obj.position.y = f.y0 + ps.dy * (f.scale || 1); if (P.move.fade || f.mats) fadeTo(f, ps.opacity); }
  function end(key, f, cancelled = false) {
    flights.delete(key); unfade(f); f.piece.obj.position.y = f.y0; st.ended++;
    try { f.piece.onEnd?.(f.dir, cancelled); } catch (e) { console.warn('fly-away', e); }
  }

  const self = {
    get params() { return P; },
    set(p) { P = clone({ ...FLY_DEFAULTS, ...p, time: { ...FLY_DEFAULTS.time, ...p?.time }, order: { ...FLY_DEFAULTS.order, ...p?.order }, move: { ...FLY_DEFAULTS.move, ...p?.move } }); },
    apply() { },
    total: (dir = 1) => flyTotal(P, dir),
    busy: () => flights.size > 0,
    has: (key) => flights.has(key),
    // -> ms until the last piece of this batch is done
    launch(pieces, dir, { origin = null, rng = Math.random, scale = 1 } = {}) {
      const now = clock(), fresh = [];
      for (const piece of pieces) {
        const f = flights.get(piece.key);
        if (!f) { fresh.push(piece); continue; }
        // already flying: turn round where it is. One that has not started to leave yet is just put back.
        if (f.dir === dir) continue;
        st.turned++;
        if ((f.u <= 0 && dir < 0) || (f.u >= 1 && dir > 0)) { f.dir = dir; end(piece.key, f, true); continue; } // had not started: nothing to turn; it is where it should be
        f.dir = dir; f.t0 = Math.min(f.t0 ?? now, now); f.last = now; f.piece.onEnd = piece.onEnd || f.piece.onEnd;
      }
      if (!fresh.length) return flights.size ? flyTotal(P, dir) : 0;
      const { delays } = flySchedule(fresh.map(p => ({ x: p.x, z: p.z, room: p.room })), P, origin, rng), k = dir < 0 ? 1 / Math.max(0.1, P.time.back || 1) : 1;
      fresh.forEach((piece, i) => {
        // (its clock starts on the next frame drawn, not now: the frame that hides a storey can be a long one, and the flight must not be spent inside it)
        const f = { piece, dir, u: dir > 0 ? 0 : 1, t0: null, delay: delays[i] * k, last: now, y0: piece.obj.position.y, scale, mats: null };
        flights.set(piece.key, f); place(f); st.launched++;
      });
      st.batches++; st.peak = Math.max(st.peak, flights.size);
      st.lastBatch = { dir, n: fresh.length, at: now, total: flyTotal(P, dir), first: Math.min(...delays) * k, last: Math.max(...delays) * k };
      return st.lastBatch.total;
    },
    frame(now = clock()) {
      if (!flights.size) return 0;
      st.steps++;
      const rate = 1 / Math.max(1, P.time.dur);
      for (const [key, f] of flights) {
        if (f.t0 == null) { f.t0 = now + f.delay; f.last = now; }
        const from = Math.max(f.last, f.t0); f.last = now;
        if (now <= f.t0) continue;
        f.u += f.dir * (now - from) * rate * (f.dir < 0 ? Math.max(0.1, P.time.back || 1) : 1);
        if ((f.dir > 0 && f.u >= 1) || (f.dir < 0 && f.u <= 0)) { end(key, f); continue; }
        place(f);
      }
      return flights.size;
    },
    flush() { for (const [key, f] of [...flights]) end(key, f); },
    cancel(key) { const f = flights.get(key); if (f) end(key, f, true); },
    progress: (key) => flights.get(key)?.u ?? null,
    stats: () => ({ fly_active: flights.size, fly_steps: st.steps, fly_launched: st.launched, fly_turned: st.turned, fly_ended: st.ended, fly_batches: st.batches, fly_peak: st.peak, fly_last: st.lastBatch && { ...st.lastBatch }, fly_total_ms: flyTotal(P, 1), fly_back_ms: flyTotal(P, -1) }),
  };
  return self;
}
