// Bandwidth meter (Harry 2026-10-01: "so I can tell how much it's getting pegged on loading things").
// Bytes come from the Resource Timing API (transferSize = bytes over the wire; a cache hit is 0), spread evenly
// over each response's transfer window into 250 ms buckets, so a big GLB counts while it downloads, not in one spike.
// Ceiling = the best 1.5 s sustained rate seen this session (observed link capacity); utilization = now / ceiling.
// In-flight / waiting counts come from the tool's own loaders (Resource Timing only reports finished requests).

const BUCKET = 250;      // ms
const HISTORY = 160;     // buckets kept (40 s) for the sparkline

export class NetMeter {
  constructor() {
    this.buckets = new Map();   // bucket index -> bytes
    this.session = 0;           // bytes over the wire this session
    this.files = 0;
    this.ceiling = 0;           // bytes/s, best sustained 1.5 s window
    this.rate = 0;              // bytes/s, last 1 s
    this.history = [];          // [{rate, ceiling}] per bucket for the graph
    this.inflight = { fg: 0, bg: 0 };
    this.avgBytes = { glb: 0, glbN: 0, img: 0, imgN: 0 };
    this.origin = location.origin;
    try {
      this.obs = new PerformanceObserver(list => list.getEntries().forEach(e => this.add(e)));
      this.obs.observe({ type: 'resource', buffered: true });
    } catch { this.obs = null; }
  }

  bytesOf(e) {
    if (e.transferSize > 0) return e.transferSize;
    // transferSize 0: a cache hit, or a cross-origin response without Timing-Allow-Origin. Only the latter moved bytes.
    const cross = !e.name.startsWith(this.origin);
    return cross && e.encodedBodySize > 0 ? e.encodedBodySize : 0;
  }

  add(e) {
    const b = this.bytesOf(e);
    if (!b) return;
    this.session += b; this.files++;
    if (/\.glb(\?|$)/.test(e.name)) { this.avgBytes.glb += b; this.avgBytes.glbN++; } else if (/\.(webp|png|jpg)(\?|$)/.test(e.name)) { this.avgBytes.img += b; this.avgBytes.imgN++; }
    const t0 = e.responseStart > 0 ? e.responseStart : e.startTime, t1 = Math.max(e.responseEnd, t0 + 1);
    const i0 = Math.floor(t0 / BUCKET), i1 = Math.floor(t1 / BUCKET);
    for (let i = i0; i <= i1; i++) {
      const a = Math.max(t0, i * BUCKET), z = Math.min(t1, (i + 1) * BUCKET);
      this.buckets.set(i, (this.buckets.get(i) || 0) + b * Math.max(0, z - a) / (t1 - t0));
    }
  }

  windowRate(endIdx, n) { let s = 0; for (let i = endIdx - n + 1; i <= endIdx; i++) s += this.buckets.get(i) || 0; return s / (n * BUCKET / 1000); }

  // called ~4x per second
  tick(now = performance.now()) {
    const cur = Math.floor(now / BUCKET) - 1; // last complete bucket
    this.rate = this.windowRate(cur, 4);
    const sustained = this.windowRate(cur, 6);
    if (sustained > this.ceiling) this.ceiling = sustained;
    this.history.push({ rate: this.rate, ceiling: this.ceiling });
    if (this.history.length > HISTORY) this.history.shift();
    for (const k of this.buckets.keys()) if (k < cur - HISTORY) this.buckets.delete(k);
  }

  util() { return this.ceiling > 0 ? Math.min(1, this.rate / this.ceiling) : 0; } // the ceiling lags a ramp by design; cap at 100%

  estBytes(kind) {
    const a = this.avgBytes;
    return kind === 'glb' ? (a.glbN ? a.glb / a.glbN : 200e3) : (a.imgN ? a.img / a.imgN : 60e3);
  }

  // wrap a loader promise so in-flight counts are honest (src = 'fg' | 'bg')
  track(promise, src = 'fg') {
    this.inflight[src]++;
    return promise.finally(() => { this.inflight[src]--; });
  }

  static colour(u) { return u >= 0.9 ? '#e0614a' : u >= 0.6 ? '#e8b460' : '#b9d45d'; }

  draw(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    const hist = this.history.slice(-w);
    const top = Math.max(1, ...hist.map(p => p.ceiling)) * 1.1;
    const cy = h - (this.ceiling / top) * h;
    ctx.strokeStyle = '#5f6450'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke(); ctx.setLineDash([]);
    hist.forEach((p, i) => {
      const y = h - (p.rate / top) * h;
      ctx.strokeStyle = NetMeter.colour(p.ceiling ? p.rate / p.ceiling : 0);
      ctx.beginPath(); ctx.moveTo(i + 0.5, h); ctx.lineTo(i + 0.5, y); ctx.stroke();
    });
  }
}

export function fmtBytes(b) { return b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} kB`; }
export function fmtRate(b) { return b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB/s` : `${Math.round(b / 1e3)} kB/s`; }
