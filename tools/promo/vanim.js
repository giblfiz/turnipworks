// WEB ANIMATIONS ON THE VIRTUAL CLOCK (tools/promo, 2026-10-22). An init script after vclock.js. CSS transitions, CSS
// animations and element.animate() run on the compositor's real time, not on performance.now, so on the stepped clock
// they would race ahead of the frame (a toast's fade, the announce flying into the chat, a menu opening). After the
// freeze, every __promo.step(ms) also drives them: each animation is paused the first time it is seen and its
// currentTime is set from the stepped clock (time since it was first seen + where it was then); one that has run past
// its end is finished (so its `finished` promise resolves and the game's code waiting on it goes on).
(() => {
  const P = window.__promo; if (!P) return;
  const seen = new WeakMap();
  const sync = () => {
    if (!P.virtual || !document.getAnimations) return;
    for (const a of document.getAnimations()) {
      let s = seen.get(a);
      if (!s) { s = { t0: P.t, c0: a.currentTime || 0 }; seen.set(a, s); try { a.pause(); } catch (e) {} }
      if (a.playState === 'finished') continue;
      const t = s.c0 + (P.t - s.t0) * (a.playbackRate || 1);
      const ti = a.effect?.getComputedTiming?.(); const end = ti ? ti.endTime : Infinity;
      try { if (Number.isFinite(end) && t >= end) a.finish(); else a.currentTime = t; } catch (e) {}
    }
  };
  const step = P.step; P.step = (ms) => { sync(); const r = step(ms); sync(); return r; };
  P.syncAnims = sync;
})();
