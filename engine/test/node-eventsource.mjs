// Minimal EventSource for Node tests (Node 20 has none): enough of the spec for the relay's SSE transport.
import http from 'node:http';
export class NodeEventSource {
  constructor(url) {
    this.readyState = 0;
    this.req = http.get(url, (res) => {
      if (res.statusCode !== 200) { this.fail(); res.resume(); return; }
      this.readyState = 1; this.onopen?.();
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = chunk.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
          if (data && this.readyState === 1) this.onmessage?.({ data });
        }
      });
      res.on('end', () => this.fail());
      res.on('error', () => this.fail());
    });
    this.req.on('error', () => this.fail());
  }
  fail() { if (this.readyState === 2) return; this.readyState = 2; this.onerror?.(); }
  close() { this.readyState = 2; this.req.destroy(); }
}
