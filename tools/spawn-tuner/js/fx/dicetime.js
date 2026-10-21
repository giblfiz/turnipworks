// Pure (no three.js): dice.js plays with it, node tests read it (2026-10-19).
// PLAYBACK: the throw's own time u against the watcher's time t. The speed is the playback speed, eased from
// startSpeed over the first easeIn s of the throw and to endSpeed over its last easeOut s (smoothstep ramps; the two
// multiply where they overlap). Integrated once per throw into a table: t(u), and u(t) by search.
export function timeline(U, E) {
  const ts = Math.max(0.05, +E.timeScale || 1), n = Math.max(2, Math.ceil(U * 120)), du = U / n;
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const rate = (u) => {
    let m = 1;
    if (E.easeIn > 0 && u < E.easeIn) m *= (E.startSpeed ?? 1) + (1 - (E.startSpeed ?? 1)) * sm(u / E.easeIn);
    if (E.easeOut > 0 && u > U - E.easeOut) m *= 1 + ((E.endSpeed ?? 1) - 1) * sm((u - (U - E.easeOut)) / E.easeOut);
    return ts * Math.max(0.02, m);
  };
  const w = new Float64Array(n + 1); for (let i = 1; i <= n; i++) w[i] = w[i - 1] + du / rate((i - 0.5) * du);
  return {
    dur: w[n],
    u(t) { if (t <= 0) return 0; if (t >= w[n]) return U; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (w[m] <= t) lo = m; else hi = m; } return (lo + (t - w[lo]) / (w[hi] - w[lo])) * du; },
  };
}
