// Simulated network for tests and for `?lag=50-400&loss=0.2` in the browser.
// Wraps a transport: every message in either direction is delayed by a random 50–400 ms (configurable), but a
// socket never reorders (TCP doesn't), so each direction is a FIFO whose release times only move forward.
// Presence messages are additionally dropped with probability `loss` (the relay sheds presence under
// backpressure; commands are never dropped, which is the contract the command channel relies on).
export function withNetSim(transport, { minMs = 50, maxMs = 400, loss = 0, rng = Math.random, lossy = (m) => m.t === 'pres' } = {}) {
  // one queue per direction, drained in order by a single timer: strict FIFO like a TCP stream
  function lane() {
    const q = []; let timer = null, last = 0;
    const drain = () => {
      timer = null;
      while (q.length && q[0].at <= Date.now()) q.shift().fn();
      if (q.length) timer = setTimeout(drain, Math.max(0, q[0].at - Date.now()));
    };
    return (fn) => {
      last = Math.max(last, Date.now() + minMs + rng() * (maxMs - minMs));
      q.push({ at: last, fn });
      if (!timer) timer = setTimeout(drain, Math.max(0, q[0].at - Date.now()));
    };
  }
  return {
    kind: transport.kind,
    connect(handlers) {
      let open = true;
      const inbound = lane(), outbound = lane();
      const conn = transport.connect({
        open: () => inbound(() => open && handlers.open()),
        message: (m) => { if (lossy(m) && rng() < loss) return; inbound(() => open && handlers.message(m)); },
        close: () => inbound(() => { if (open) { open = false; handlers.close(); } }),
      });
      return {
        isOpen: () => open && conn.isOpen(),
        send(m) { if (lossy(m) && rng() < loss) return; outbound(() => conn.isOpen() && conn.send(m)); },
        close: () => conn.close(),
      };
    },
  };
}

// Deterministic RNG for reproducible test runs.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
