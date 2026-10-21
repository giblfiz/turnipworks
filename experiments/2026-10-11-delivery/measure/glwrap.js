// Injected before any page script (Playwright add_init_script). Wraps a few WebGL2 calls to time them and to keep a
// ledger of every texture the page allocates (true GPU allocation: size, format, mip levels, where the pixels came from).
// window.__glw = { on, t: { fn: [calls, ms] }, tex: Map(id -> {w,h,fmt,levels,src,bytes}), longtasks: [[start, dur]] }
(() => {
  const G = window.__glw = { on: true, t: {}, tex: new Map(), nextId: 1, longtasks: [], gl: null, programs: 0, buffers: 0, bufBytes: 0, marks: [] };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) G.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  const gc = HTMLCanvasElement.prototype.getContext, seenC = new WeakSet(); G.ctxLost = 0; G.ctxBack = 0;
  HTMLCanvasElement.prototype.getContext = function (...a) { if (!seenC.has(this) && /webgl/.test(a[0])) { seenC.add(this); this.addEventListener('webglcontextlost', () => { G.ctxLost++; window.__ctxLost = G.ctxLost; }); this.addEventListener('webglcontextrestored', () => { G.ctxBack++; window.__ctxBack = G.ctxBack; }); } return gc.apply(this, a); };
  const P = WebGL2RenderingContext.prototype, ids = new WeakMap(), bound = new WeakMap();
  const BPP = { 0x8058: 4, 0x8C43: 4, 0x881A: 8, 0x8814: 16, 0x8229: 1, 0x822B: 2, 0x88F0: 4, 0x81A6: 4, 0x8CAC: 4, 0x81A5: 2, 0x822D: 2, 0x822F: 4, 0x8051: 3, 0x8C41: 3, 0x8C3A: 4, 0x822E: 4, 0x8230: 8, 0x1908: 4, 0x1907: 3, 0x1903: 1, 0x8815: 12, 0x881B: 6 };
  const mipSum = (w, h, levels) => { let n = 0; for (let i = 0; i < levels; i++) { n += Math.max(1, w >> i) * Math.max(1, h >> i); } return n; };
  const srcKind = (a) => { const s = a[a.length - 1]; if (s == null) return 'empty'; if (ArrayBuffer.isView(s)) return 'data'; return s.constructor?.name || 'obj'; };
  const timed = ['texImage2D', 'texSubImage2D', 'texStorage2D', 'texImage3D', 'texSubImage3D', 'texStorage3D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'generateMipmap', 'bufferData', 'bufferSubData',
    'compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'getProgramInfoLog', 'getShaderInfoLog', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'getAttribLocation', 'useProgram',
    'drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'readPixels', 'finish', 'clientWaitSync', 'getSyncParameter', 'blitFramebuffer', 'clear'];
  for (const fn of timed) {
    const orig = P[fn]; if (!orig) continue;
    P[fn] = function (...a) {
      if (!G.on) return orig.apply(this, a);
      const t0 = performance.now(); const r = orig.apply(this, a); const dt = performance.now() - t0;
      const e = G.t[fn] ||= [0, 0]; e[0]++; e[1] += dt;
      if (fn === 'texStorage2D' || fn === 'texImage2D' || fn === 'texSubImage2D' || fn === 'generateMipmap' || fn === 'texStorage3D' || fn === 'compressedTexImage2D') {
        const cur = bound.get(this)?.[a[0] >= 0x8515 && a[0] <= 0x851A ? 0x8513 : a[0]]; const rec = cur && G.tex.get(ids.get(cur));
        if (rec) {
          if (fn === 'texStorage2D') { Object.assign(rec, { levels: a[1], fmt: a[2], w: a[3], h: a[4], faces: a[0] === 0x8513 ? 6 : 1 }); }
          else if (fn === 'texStorage3D') { Object.assign(rec, { levels: a[1], fmt: a[2], w: a[3], h: a[4], depth: a[5] }); }
          else if (fn === 'texImage2D' && a[1] === 0) { const s = a[a.length - 1]; const wh = a.length >= 9 ? [a[3], a[4]] : [s.width || s.videoWidth, s.height || s.videoHeight]; Object.assign(rec, { fmt: a[2], w: wh[0], h: wh[1], levels: Math.max(rec.levels || 1, 1) }); if (a[0] >= 0x8515) rec.faces = 6; }
          else if (fn === 'compressedTexImage2D' && a[1] === 0) { Object.assign(rec, { fmt: a[2], w: a[3], h: a[4], compressed: true, cbytes: (rec.cbytes || 0) + (a[6]?.byteLength || 0) }); }
          else if (fn === 'generateMipmap') { rec.levels = Math.floor(Math.log2(Math.max(rec.w || 1, rec.h || 1))) + 1; rec.gen = true; }
          if (fn === 'texImage2D' || fn === 'texSubImage2D') { const k = srcKind(a); if (k !== 'empty') { rec.src = k; rec.upMs = (rec.upMs || 0) + dt; rec.ups = (rec.ups || 0) + 1; } }
          if (fn === 'generateMipmap') rec.mipMs = (rec.mipMs || 0) + dt;
          rec.bytes = mipSum(rec.w || 0, rec.h || 0, rec.levels || 1) * (BPP[rec.fmt] || 4) * (rec.faces || 1) * (rec.depth || 1);
        }
      }
      if (fn === 'bufferData') { const s = a[1]; G.bufBytes += typeof s === 'number' ? s : (s?.byteLength || 0); }
      return r;
    };
  }
  const cT = P.createTexture; P.createTexture = function () { const t = cT.call(this); const id = G.nextId++; ids.set(t, id); G.tex.set(id, { born: Math.round(performance.now()) }); G.gl = this; return t; };
  const dT = P.deleteTexture; P.deleteTexture = function (t) { G.tex.delete(ids.get(t)); return dT.call(this, t); };
  const bT = P.bindTexture; P.bindTexture = function (target, t) { let b = bound.get(this); if (!b) bound.set(this, b = {}); b[target] = t; return bT.call(this, target, t); };
  const cP = P.createProgram; P.createProgram = function () { G.programs++; return cP.call(this); };
  const cB = P.createBuffer; P.createBuffer = function () { G.buffers++; return cB.call(this); };
  G.snap = () => ({ t: JSON.parse(JSON.stringify(G.t)), programs: G.programs, buffers: G.buffers, bufBytes: G.bufBytes, now: performance.now() });
  G.diff = (a, b) => { const o = {}; for (const k in b.t) { const p = a.t[k] || [0, 0]; const n = b.t[k][0] - p[0], ms = b.t[k][1] - p[1]; if (n) o[k] = [n, +ms.toFixed(2)]; } return { t: o, programs: b.programs - a.programs, buffers: b.buffers - a.buffers, bufBytes: b.bufBytes - a.bufBytes, ms: +(b.now - a.now).toFixed(1) }; };
  G.texSummary = () => { const by = {}; let total = 0, n = 0; const sizes = {};
    for (const r of G.tex.values()) { if (!r.w) continue; const k = (r.src || 'target') + (r.compressed ? '/compressed' : ''); const e = by[k] ||= { n: 0, bytes: 0, upMs: 0, mipMs: 0 }; e.n++; e.bytes += r.bytes || 0; e.upMs += r.upMs || 0; e.mipMs += r.mipMs || 0; total += r.bytes || 0; n++;
      if (r.src && r.src !== 'data') { const s = `${r.w}x${r.h}`; const z = sizes[s] ||= [0, 0]; z[0]++; z[1] += r.bytes || 0; } }
    const targets = {}; for (const r of G.tex.values()) { if (!r.w || (r.src && r.src !== 'data')) continue; const s = `${r.w}x${r.h}${r.faces === 6 ? ' cube' : ''}${r.depth ? ' x' + r.depth : ''} fmt 0x${(r.fmt || 0).toString(16)} mips ${r.levels || 1}`; const z = targets[s] ||= [0, 0]; z[0]++; z[1] += r.bytes || 0; }
    return { n, total, by, sizes, targets }; };
})();
