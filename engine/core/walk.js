// HOW FAR A PAWN COULD WALK (Harry 2026-11-02: "some little rings showing it's move distances ... wall/pathfinding aware..
// so they would flow 'around' doors/walls"; "It's a hint not a rule"). Pure functions: no DOM, no three.js; the move
// rings (client/surfaces/moverings.js) and the tests run the same code.
//
//   walkField({ origin, reach, cell, segments, known })   the walking distance from `origin` to every cell within reach
//   routeTo(field, x, z)                                  the shortest walk from the origin to (x, z), as a polyline
//
// THE GRID. Square cells of `cell` feet (1.25: the fog of war's own cell, core/fog.js FOG_CELL, so a cell is explored or
// not as a whole), on world multiples of `cell`, covering the origin +- (reach + a margin). A wall on the grid's lines
// (every generated wall and door: multiples of 5 ft) blocks the boundary it lies on; any other wall (a door or wall piece
// turned freely, a cave's lip, a pillar) blocks the cells it passes through. A cell `known` says no to (fog of war: ground
// the seat has not explored) is a wall too, and so is everything outside the grid.
//
// THE DISTANCE. Any-angle (Theta*-style) Dijkstra: a cell is reached from its parent's parent in a straight line when that
// line is clear, so in the open the distance is the true straight-line distance (round rings, not octagons) and round a
// corner it is the length of a taut string. Diagonals cost their length (no 5/10 rule), size, stairs, hills, furniture
// and other pawns are ignored. A corner where two walls meet is never squeezed through; the end of a lone wall is.
export const WALK = { cell: 1.25, margin: 3 }; // margin: cells past `reach` still worked out, so the last ring is whole
export const FAR = 1e4; // the distance written for a cell that is not reached (a float texture holds it as it is)

const EPS = 1e-4; // a point on a grid line (a pawn on a square's centre or corner) is nudged into one cell, always the same way

export function walkField({ origin, reach = 40, cell = WALK.cell, segments = [], known = null, margin = WALK.margin } = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ox0 = origin[0], oz0 = origin[1], ox = ox0 + EPS, oz = oz0 + EPS, R = reach + margin * cell;
  const X0 = Math.floor((ox - R) / cell) * cell, Z0 = Math.floor((oz - R) / cell) * cell;
  const n = Math.ceil((ox + R - X0) / cell) + 1, N = n * n;
  const vB = new Uint8Array((n + 1) * n), hB = new Uint8Array(n * (n + 1)), st = new Uint8Array(N); // st: 0 not asked yet, 1 open, 2 a wall
  // ---- the walls onto the grid
  const onLine = (v) => Math.abs(v / cell - Math.round(v / cell)) < 1e-6;
  const markCell = (x, z) => { const i = Math.floor((x - X0) / cell), j = Math.floor((z - Z0) / cell); if (i >= 0 && j >= 0 && i < n && j < n) st[j * n + i] = 2; };
  let walls = 0;
  for (const s of segments) {
    const [ax, az, bx, bz] = s;
    if (Math.max(ax, bx) < X0 - cell || Math.min(ax, bx) > X0 + (n + 1) * cell || Math.max(az, bz) < Z0 - cell || Math.min(az, bz) > Z0 + (n + 1) * cell) continue;
    walls++;
    if (Math.abs(ax - bx) < 1e-6 && onLine(ax)) { // along a line of constant x: the boundaries between columns i-1 and i
      const i = Math.round((ax - X0) / cell); if (i < 0 || i > n) continue;
      const lo = Math.min(az, bz), hi = Math.max(az, bz);
      for (let j = Math.max(0, Math.floor((lo - Z0) / cell)); j < n && Z0 + j * cell < hi; j++) if (Math.min(hi, Z0 + (j + 1) * cell) - Math.max(lo, Z0 + j * cell) > 1e-6) vB[j * (n + 1) + i] = 1;
    } else if (Math.abs(az - bz) < 1e-6 && onLine(az)) {
      const j = Math.round((az - Z0) / cell); if (j < 0 || j > n) continue;
      const lo = Math.min(ax, bx), hi = Math.max(ax, bx);
      for (let i = Math.max(0, Math.floor((lo - X0) / cell)); i < n && X0 + i * cell < hi; i++) if (Math.min(hi, X0 + (i + 1) * cell) - Math.max(lo, X0 + i * cell) > 1e-6) hB[j * n + i] = 1;
    } else { // off the grid's lines: the cells it passes through
      const len = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(len / (cell * 0.25)));
      for (let q = 0; q <= k; q++) markCell(ax + (bx - ax) * q / k, az + (bz - az) * q / k);
    }
  }
  const oi = Math.floor((ox - X0) / cell), oj = Math.floor((oz - Z0) / cell), O = oj * n + oi;
  st[O] = 1; // the pawn's own place is always open (a seat always knows where its own pawn stands)
  let asked = 0;
  const open = (i, j) => {
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    const k = j * n + i; let s = st[k];
    if (!s) { asked++; s = st[k] = !known || known(X0 + (i + 0.5) * cell, Z0 + (j + 0.5) * cell) ? 1 : 2; }
    return s === 1;
  };
  // ---- a straight line from a to b clear? (Amanatides-Woo through the cells; at an exact corner, one of the two ways round it must be clear)
  function los(ax, az, bx, bz) {
    let i = Math.floor((ax - X0) / cell), j = Math.floor((az - Z0) / cell);
    const ie = Math.floor((bx - X0) / cell), je = Math.floor((bz - Z0) / cell);
    if (!open(i, j)) return false;
    const dx = bx - ax, dz = bz - az, sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sz = dz > 0 ? 1 : dz < 0 ? -1 : 0;
    const tdx = sx ? cell / Math.abs(dx) : Infinity, tdz = sz ? cell / Math.abs(dz) : Infinity;
    let tx = sx > 0 ? (X0 + (i + 1) * cell - ax) / dx : sx < 0 ? (X0 + i * cell - ax) / dx : Infinity;
    let tz = sz > 0 ? (Z0 + (j + 1) * cell - az) / dz : sz < 0 ? (Z0 + j * cell - az) / dz : Infinity;
    for (let guard = 4 * n; (i !== ie || j !== je) && guard > 0; guard--) {
      const bi = sx > 0 ? i + 1 : i, bj = sz > 0 ? j + 1 : j;
      if (Math.abs(tx - tz) < 1e-9) { // through a corner
        const a = !vB[j * (n + 1) + bi] && open(i + sx, j) && !hB[bj * n + i + sx];
        const b = !hB[bj * n + i] && open(i, j + sz) && !vB[(j + sz) * (n + 1) + bi];
        if (!a && !b) return false;
        i += sx; j += sz; tx += tdx; tz += tdz;
      } else if (tx < tz) { if (vB[j * (n + 1) + bi]) return false; i += sx; tx += tdx; }
      else { if (hB[bj * n + i]) return false; j += sz; tz += tdz; }
      if (!open(i, j)) return false;
    }
    return i === ie && j === je;
  }
  const px = (k) => k === O ? ox : X0 + ((k % n) + 0.5) * cell, pz = (k) => k === O ? oz : Z0 + (Math.floor(k / n) + 0.5) * cell;
  // ---- the flood
  const g = new Float64Array(N).fill(FAR), par = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const H = heap(); g[O] = 0; par[O] = O; H.push(0, O);
  let reached = 0, lines = 0;
  while (H.size()) {
    const k = H.pop(), gk = H.lastKey; if (done[k] || gk > g[k]) continue;
    done[k] = 1; reached++;
    const ki = k % n, kj = (k - ki) / n, p = par[k], kx = px(k), kz = pz(k);
    for (let d = 0; d < 8; d++) {
      const ni = ki + DI[d], nj = kj + DJ[d]; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const m = nj * n + ni; if (done[m] || !open(ni, nj)) continue;
      const mx = X0 + (ni + 0.5) * cell, mz = Z0 + (nj + 0.5) * cell;
      // through the parent in a straight line, else from here; a candidate that cannot beat what the cell has costs no line test
      let c = FAR, via = -1;
      if (p !== k) { const qx = px(p), qz = pz(p), ex = mx - qx, ez = mz - qz, cp = g[p] + Math.sqrt(ex * ex + ez * ez); if (cp < g[m] && cp <= R) { lines++; if (los(qx, qz, mx, mz)) { c = cp; via = p; } } }
      if (via < 0) { const ex = mx - kx, ez = mz - kz, ck = gk + Math.sqrt(ex * ex + ez * ez); if (ck < g[m] && ck <= R) { lines++; if (los(kx, kz, mx, mz)) { c = ck; via = k; } } }
      if (via >= 0) { g[m] = c; par[m] = via; H.push(c, m); }
    }
  }
  const dist = new Float32Array(N); for (let k = 0; k < N; k++) dist[k] = done[k] ? g[k] : FAR; // (the flood runs in float64: a float32 key read back smaller than it was pushed looks stale)
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { x0: X0, z0: Z0, n, cell, reach, R, ox: ox0, oz: oz0, O, dist, parent: par, los, px, pz, stats: { ms, reached, asked, lines, walls } };
}
const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];

// the walking distance at a point (the nearest cell's), FAR where no walk is known
export function distanceAt(F, x, z) {
  const i = Math.floor((x + EPS - F.x0) / F.cell), j = Math.floor((z + EPS - F.z0) / F.cell);
  return i < 0 || j < 0 || i >= F.n || j >= F.n ? FAR : F.dist[j * F.n + i];
}
// THE ROUTE to (x, z): [[x, z] ...] from the origin, and its length; null where no walk there is known (unexplored, walled
// off, or past the field's reach: the caller then draws the straight line it always drew)
export function routeTo(F, x, z) {
  const qx = x + EPS, qz = z + EPS, i = Math.floor((qx - F.x0) / F.cell), j = Math.floor((qz - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.n || j >= F.n) return null;
  const k = j * F.n + i; if (!(F.dist[k] < FAR)) return null;
  const a = F.parent[k];
  let via = -1;
  if (a >= 0 && F.los(F.px(a), F.pz(a), qx, qz)) via = a; else if (F.los(F.px(k), F.pz(k), qx, qz)) via = k; else return null;
  const length = F.dist[via] + Math.hypot(qx - F.px(via), qz - F.pz(via)), pts = [[x, z]];
  for (let q = via, guard = F.n * F.n; guard > 0; guard--) { if (q === F.O) { pts.push([F.ox, F.oz]); break; } pts.push([F.px(q), F.pz(q)]); q = F.parent[q]; }
  return { points: pts.reverse(), length, bends: pts.length > 2 };
}

// a small binary heap of (key, value): pop() returns the value of the smallest key and leaves that key in lastKey
function heap() {
  let K = new Float64Array(1024), V = new Int32Array(1024), size = 0;
  const h = {
    lastKey: 0, size: () => size,
    push(k, v) {
      if (size === K.length) { const K2 = new Float64Array(size * 2), V2 = new Int32Array(size * 2); K2.set(K); V2.set(V); K = K2; V = V2; }
      let i = size++; while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= k) break; K[i] = K[p]; V[i] = V[p]; i = p; } K[i] = k; V[i] = v;
    },
    pop() {
      const v = V[0]; h.lastKey = K[0]; const k = K[--size], x = V[size]; let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= size) break; if (c + 1 < size && K[c + 1] < K[c]) c++; if (K[c] >= k) break; K[i] = K[c]; V[i] = V[c]; i = c; }
      if (size) { K[i] = k; V[i] = x; }
      return v;
    },
  };
  return h;
}
