// Transports for ClientSync. All three present the same tiny interface:
//   connect({open, message, close}) -> { isOpen(), send(msg), close() }
// A transport delivers messages in order in both directions, or closes; ClientSync handles everything else
// (resubscribe, resend with the same cids, catch-up).
import { newId } from './ids.js';

// WebSocket: the browser's WebSocket, or the `ws` package in Node.
export function wsTransport(url, WS = globalThis.WebSocket) {
  return {
    kind: 'ws',
    connect(h) {
      const ws = new WS(url);
      ws.onopen = () => h.open();
      ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } h.message(m); };
      ws.onclose = () => h.close();
      ws.onerror = () => {};
      return { isOpen: () => ws.readyState === 1, send: (m) => ws.send(JSON.stringify(m)), close: () => ws.close() };
    },
  };
}

// Server-sent events down, ordered POSTs up. Works through proxies that refuse websocket upgrades (our Cloudflare
// zone answers one with a plain GET). Upstream keeps ONE POST in flight; messages queued meanwhile ride the next
// POST together, which batches 18 Hz presence for free. `n` numbers the POSTs so a retried one is ignored.
export function sseTransport(base, { ES = globalThis.EventSource, fetchFn = globalThis.fetch } = {}) {
  return {
    kind: 'sse',
    connect(h) {
      const sid = newId('s', 24);
      const es = new ES(`${base}/sse/${sid}/events`);
      let open = false, done = false, n = 0, inflight = false;
      const q = [];
      const finish = () => { if (done) return; done = true; open = false; try { es.close(); } catch {} h.close(); };
      es.onopen = () => { if (!open && !done) { open = true; h.open(); } };
      es.onmessage = (ev) => { if (done) return; let m; try { m = JSON.parse(ev.data); } catch { return; } h.message(m); };
      es.onerror = () => finish(); // no silent auto-reconnect: a new session must resubscribe, ClientSync does that
      const flush = () => {
        if (inflight || !q.length || done) return;
        inflight = true;
        const body = JSON.stringify({ n: ++n, msgs: q.splice(0) });
        fetchFn(`${base}/sse/${sid}/send`, { method: 'POST', body, keepalive: false })
          .then(r => { if (!r.ok) throw new Error(`send ${r.status}`); inflight = false; flush(); })
          .catch(() => { inflight = false; finish(); });
      };
      return { isOpen: () => open && !done, send: (m) => { q.push(m); flush(); }, close: finish };
    },
  };
}

// Try websockets; if a handshake never opens, use SSE for the rest of the session (ClientSync's reconnect
// loop calls connect again, ~250 ms later). `prefer` = 'ws' | 'sse' forces one.
export function autoTransport({ wsUrl, httpBase, prefer = null, WS, ES, fetchFn }) {
  const ws = wsTransport(wsUrl, WS), sse = sseTransport(httpBase, { ES, fetchFn });
  const t = {
    kind: prefer || 'ws',
    connect(h) {
      if (t.kind === 'sse') return sse.connect(h);
      let opened = false;
      return ws.connect({
        open: () => { opened = true; h.open(); },
        message: h.message,
        close: () => { if (!opened && !prefer) t.kind = 'sse'; h.close(); },
      });
    },
  };
  return t;
}
