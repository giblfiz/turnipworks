// THE WALL FIT BENCH, pure part (2026-10-13; js/wallbench.js is the page). No three.js, no DOM: node tests this
// (test/wallfit.test.mjs). Harry: "the occasional janky wall is still out there (that look great in isolation, just has scale
// issues!) and when one comes up it is amazing how much damage it does to the look."
//   what is a wall piece   piecesOfFamily(): every wall kit mesh of a family, its stretch (how far the mesh is pulled out of
//                          shape to fill its 5 x 1 x 9 ft catalog box: the "great alone, wrong in a wall" number)
//   judging a measurement  judge(): ok / warn / bad against the tolerances in TOL (inches)
//   seams                  seamH / seamV / stepOf: gaps and overlaps between neighbours, from measured world boxes
//   openings               rasterize(), doorOpening(), windowOpening(): the clear opening of a doorway or window piece
//   snap                   snapFit(): the AI guess at a scale/offset that closes the measured gaps (Harry confirms)
//   corrections            the per-sku table the wall code reads (js/look.js applyFit), records <-> table
// Units: feet in the game, INCHES in every measurement and tolerance here (the unit Harry reads).
export const STOREY_FT = 10, WALL_FT = 9, SLAB_FT = 1;
// Tolerances (inches unless noted). seam: a gap or overlap between neighbours; step: one face standing proud of the next;
// height/thick: a piece against its family; proud: a post standing above a wall; stretch: biggest / smallest axis of the
// scale a mesh is pulled by (1.0 = scaled evenly); scale: a piece's even scale against the family's median.
export const TOL = { seam: 1.0, step: 1.0, height: 1.5, thick: 2.0, proud: 3.0, stretch: 1.5, stretchWarn: 1.25, scale: 0.25, clear: 1.0 };
export const judge = (v, tol, k = 2) => { const a = Math.abs(v); return a <= tol ? 'ok' : a <= tol * k ? 'warn' : 'bad'; };
export const worse = (a, b) => ['ok', 'warn', 'bad'].indexOf(a) >= ['ok', 'warn', 'bad'].indexOf(b) ? a : b;
export const inch = (ft) => ft * 12;
export const r1 = (v) => Math.round(v * 10) / 10;
export const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

// ------------------------------------------------------------------ which pieces make a wall of a family
// (the generated walls draw straights, windows and panels; a door is two jamb posts and a leaf, so no doorway or open-window piece is drawn: look.js edgeSpecs)
export const BASIC = ['wall-straight', 'wall-window-small'];
export const PANEL_IDS = ['wall-alcove', 'wall-secret-door', 'wall-crypt-niches', 'ossuary-wall', 'tomb-door-sealed', 'wall-shop-window', 'wall-window-shop', 'window-stained-glass'];
export const ROLE = { 'wall-straight': 'straight', 'wall-doorway': 'doorway', 'wall-window-small': 'window', 'wall-window-small-open': 'window (open)' };
// the families that have wall pieces (a wall-straight or a doorway of their own), in a stable order
export function families(lib, usable = () => true) {
  const out = new Set();
  for (const id of ['wall-straight', 'wall-doorway', 'wall-window-small']) for (const s of lib.objects[id]?.skus || []) if (s.family && s.kind === 'mesh' && s.bounds && usable(s)) out.add(s.family);
  return [...out].sort();
}
// the stretch of one mesh: kitScale() (js/solver.js) per axis, the factor feet-per-mesh-unit that fills the catalog box
export function stretchOf(size, bounds, yawDeg = 0) {
  const [w, d, h] = size.map(v => v / 12), q = ((Math.round(yawDeg || 0) % 180) + 180) % 180;
  const s = q === 90 ? [d / bounds[0], h / bounds[1], w / bounds[2]] : [w / bounds[0], h / bounds[1], d / bounds[2]];
  // aniso: how unevenly the FACE is stretched (along vs tall: stones pulled tall, planks pulled long). depth: how the thickness was stretched against the face.
  return { s, u: Math.cbrt(s[0] * s[1] * s[2]), aniso: Math.max(s[0], s[1]) / Math.min(s[0], s[1]), depth: s[2] / Math.sqrt(s[0] * s[1]) };
}
// every wall kit piece a family draws (its own skus of the basic roles and its special panels), with its stretch
export function piecesOfFamily(lib, orient, family, usable = () => true) {
  const out = [];
  for (const id of [...BASIC, ...PANEL_IDS]) {
    const o = lib.objects[id]; if (!o) continue;
    for (const s of o.skus) if (s.family === family && s.kind === 'mesh' && s.bounds && usable(s)) {
      const yaw = orient?.[s.mesh] ?? 0, st = stretchOf(o.size, s.bounds, yaw);
      out.push({ id, sku: s.sku, shape: s.shape || '', role: ROLE[id] || 'panel', size: o.size, bounds: s.bounds, yaw, ...st, mesh: s.mesh });
    }
  }
  return out;
}
// flags from the data alone (no geometry): how badly each mesh is pulled out of shape, and how far its even scale is from the
// family's. This is what pre-sorts the queue before a family has been built.
export function stretchFlags(pieces, tol = TOL) {
  const strs = pieces.filter(p => p.role === 'straight'), ref = median((strs.length ? strs : pieces).map(p => p.u)) || 1;
  const refS = [0, 1, 2].map(i => median(pieces.filter(p => p.role === 'straight' || p.role === 'doorway' || p.role === 'window').map(p => p.s[i])));
  return pieces.map(p => {
    const f = [];
    const sev = p.aniso > tol.stretch ? 'bad' : p.aniso > tol.stretchWarn ? 'warn' : 'ok';
    if (sev !== 'ok') { const hi = p.s[0] > p.s[1] ? 0 : 1; f.push({ kind: 'stretch', sev, sku: p.sku, value: r1(p.aniso * 100) / 100, text: `${p.sku}: face pulled ${p.aniso.toFixed(2)}x out of shape (${['along', 'tall'][hi]} stretched ${p.s[hi].toFixed(1)}, ${['along', 'tall'][1 - hi]} only ${p.s[1 - hi].toFixed(1)} ft per mesh unit)` }); }
    if (p.depth > 2 || p.depth < 0.5) f.push({ kind: 'stretch', sev: 'warn', sku: p.sku, value: r1(p.depth * 100) / 100, text: `${p.sku}: thickness pulled ${p.depth > 1 ? p.depth.toFixed(1) + 'x thicker' : (1 / p.depth).toFixed(1) + 'x thinner'} than its face scale` });
    const rel = p.u / ref - 1;
    if (Math.abs(rel) > tol.scale) f.push({ kind: 'scale', sev: Math.abs(rel) > 2 * tol.scale ? 'bad' : 'warn', sku: p.sku, value: rel, text: `${p.sku}: detail ${rel > 0 ? 'coarser' : 'finer'} than the family by ${Math.abs(rel * 100).toFixed(0)}% (even scale ${p.u.toFixed(2)} vs family ${ref.toFixed(2)})` });
    // the axes against the family's own median straight: stones stretched tall, planks stretched long
    for (const [i, nm] of [[0, 'along'], [1, 'tall']]) { const r = p.s[i] / (refS[i] || p.s[i]) - 1; if (Math.abs(r) > 0.5) f.push({ kind: 'axis', sev: 'warn', sku: p.sku, value: r, text: `${p.sku}: ${nm} scale ${p.s[i].toFixed(1)} vs the family's ${refS[i].toFixed(1)} (${r > 0 ? '+' : ''}${(r * 100).toFixed(0)}%)` }); }
    return { piece: p, flags: f };
  });
}
export const score = (flags) => flags.reduce((t, f) => t + (f.sev === 'bad' ? 3 : f.sev === 'warn' ? 1 : 0), 0);

// ------------------------------------------------------------------ boxes and seams
// A box is { x0, x1, y0, y1, z0, z1 } in feet (a THREE.Box3 gives min/max; see box()). Along a wall: 'along' and 'across'.
export const box = (b) => ({ x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z });
// a wall-class box in the WALL FRAME (inches): along = from the segment's start, across = positive toward the owner's room,
// y = from the storey's floor. dir h/v, side N/S/W/E (the owner's), line = the grid line's coordinate in feet, start = the segment start in feet
export function wallFrame(b, dir, side, line, start, level = 0) {
  const a0 = dir === 'h' ? b.x0 : b.z0, a1 = dir === 'h' ? b.x1 : b.z1, c0 = dir === 'h' ? b.z0 : b.x0, c1 = dir === 'h' ? b.z1 : b.x1;
  const s = (side === 'N' || side === 'W') ? 1 : -1;
  const cA = s * (c0 - line), cB = s * (c1 - line);
  return { a0: inch(a0 - start), a1: inch(a1 - start), c0: inch(Math.min(cA, cB)), c1: inch(Math.max(cA, cB)), y0: inch(b.y0 - level), y1: inch(b.y1 - level) };
}
export const lenOf = (f) => f.a1 - f.a0;
// horizontal seam between neighbours A then B along one line (frames measured from ONE shared start): +gap, -overlap
export function seamH(A, B) { return { gap: B.a0 - A.a1, stepIn: B.c1 - A.c1, stepOut: B.c0 - A.c0, top: B.y1 - A.y1, base: B.y0 - A.y0 }; }
// a wall's end against a post covering the vertex: hole = the wall stops short of the post's near face (+); poke = the wall goes
// out through the post's far face (+). end 'a1' = the wall's far end (post is beyond), 'a0' = its start (post is before it)
export function seamPost(wall, post, end) {
  if (end === 'a1') return { hole: post.a0 - wall.a1, poke: wall.a1 - post.a1 };
  return { hole: wall.a0 - post.a1, poke: post.a0 - wall.a0 };
}
// vertical seam between a storey's wall top and the slab under the next, and the slab top and the wall above (inches, + = gap)
export function seamV(lowerTop, slabBottom, slabTop, upperBase) { return { toSlab: slabBottom - lowerTop, fromSlab: upperBase - slabTop }; }

// ------------------------------------------------------------------ openings (doorways and windows)
// rasterize triangles given as [ax, ay, bx, by, cx, cy, ...] (inches in the wall frame: along, up) onto a W x H grid of 1-inch cells
export function rasterize(tris, W, H) {
  const g = new Uint8Array(W * H);
  for (let t = 0; t < tris.length; t += 6) {
    const ax = tris[t], ay = tris[t + 1], bx = tris[t + 2], by = tris[t + 3], cx = tris[t + 4], cy = tris[t + 5];
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.floor(Math.max(ay, by, cy)));
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-9) { // a sliver: mark the cells along its longest edge so thin frame parts still count
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) g[y * W + x] = 1; continue;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, l3 = 1 - l1 - l2;
      const e = -1e-9;
      if (l1 >= e && l2 >= e && l3 >= e) g[y * W + x] = 1;
    }
  }
  return g;
}
// the clear opening of a doorway piece: from the floor up the middle column to the first solid (height), and across at
// min(48 in, half the height) from the middle outward (width)
export function doorOpening(grid, W, H, centre = W / 2) {
  const cx = Math.floor(centre);
  if (grid[cx]) return null; // solid at the floor: no opening
  let top = 0; while (top < H && !grid[top * W + cx]) top++;
  const row = Math.max(1, Math.min(48, Math.floor(top / 2)));
  let x0 = cx, x1 = cx; while (x0 > 0 && !grid[row * W + x0 - 1]) x0--; while (x1 < W - 1 && !grid[row * W + x1 + 1]) x1++;
  if (x0 === 0 && x1 === W - 1) return null;
  return { x0, x1: x1 + 1, top, w: x1 + 1 - x0, h: top, row };
}
// the clear opening of a window piece: the empty region around the middle of the panel that does not reach the panel's edge
export function windowOpening(grid, W, H) {
  let seed = null;
  for (const yy of [60, 66, 54, 72, 48, 78, 42]) { for (let d = 0; d < W / 2 && !seed; d++) for (const x of [Math.floor(W / 2) + d, Math.floor(W / 2) - d]) if (x >= 0 && x < W && yy < H && !grid[yy * W + x]) { seed = [x, yy]; break; } if (seed) break; }
  if (!seed) return null;
  const seen = new Uint8Array(W * H), q = [seed[0] + seed[1] * W]; seen[q[0]] = 1;
  let x0 = W, x1 = -1, y0 = H, y1 = -1, edge = false, n = 0;
  while (q.length) {
    const i = q.pop(), x = i % W, y = (i / W) | 0; n++;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (!grid[j] && !seen[j]) { seen[j] = 1; q.push(j); } }
  }
  if (edge || n < 40) return null;
  return { x0, x1: x1 + 1, y0, y1: y1 + 1, w: x1 + 1 - x0, h: y1 + 1 - y0, area: n };
}

// ------------------------------------------------------------------ the snap guess
// A piece's measured box in its OWN frame (inches: x along, y up, z toward the room) against where it should stand; the fit
// that closes the difference. cur = the correction already applied (the measurement includes it): the proposal multiplies on.
// want = { x: [lo, hi], y: [lo, hi], z: [lo, hi] } (inches). axes: which axes to scale ('xyz' for a wall piece; a leaf 'xy').
export function snapFit(cur, have, want, axes = 'xyz') {
  const f = { s: [...(cur?.s || [1, 1, 1])], o: [...(cur?.o || [0, 0, 0])], yaw: cur?.yaw || 0 };
  ['x', 'y', 'z'].forEach((k, i) => {
    const h0 = have[k][0], h1 = have[k][1], w0 = want[k][0], w1 = want[k][1];
    // the scale acts about the piece's own origin, which sits at its offset o (feet) from the group's: work in inches
    const p = f.o[i] * 12;
    let r = 1; if (axes.includes(k) && h1 - h0 > 1e-6) r = (w1 - w0) / (h1 - h0);
    const lo = p + r * (h0 - p); // where the low face lands after scaling about p
    f.s[i] = +(f.s[i] * r).toFixed(5); f.o[i] = +(f.o[i] + (w0 - lo) / 12).toFixed(5);
  });
  return f;
}
export const fitSame = (a, b, e = 1e-4) => { const n = (f) => ({ s: f?.s || [1, 1, 1], o: f?.o || [0, 0, 0], yaw: f?.yaw || 0 }); const A = n(a), B = n(b); return A.s.every((v, i) => Math.abs(v - B.s[i]) < e) && A.o.every((v, i) => Math.abs(v - B.o[i]) < e) && Math.abs(A.yaw - B.yaw) < e; };
export const isIdentity = (f) => fitSame(f, null);
export const cleanFit = (f) => ({ s: (f?.s || [1, 1, 1]).map(v => +(+v).toFixed(5)), o: (f?.o || [0, 0, 0]).map(v => +(+v).toFixed(5)), yaw: +(+(f?.yaw || 0)).toFixed(4) });

// ------------------------------------------------------------------ records <-> state
// The review server keeps one record per name, latest wins (GET /tuner/wallfits). A piece record: name = its sku, data = { sku,
// family, s, o, yaw, mark: {note, at} | null, approved }. A family record: name = "family/<f>", data = { family, approved, note, scan }.
export function stateFromRecords(recs) {
  const pieces = {}, fams = {};
  for (const [name, rec] of Object.entries(recs || {})) {
    const d = rec?.data; if (!d) continue;
    if (name.startsWith("family/")) fams[name.slice(7)] = { approved: !!d.approved, note: d.note || '', scan: d.scan || null, at: rec.at };
    else pieces[name] = { fit: cleanFit(d), mark: d.mark || null, approved: !!d.approved, family: d.family || null, at: rec.at };
  }
  return { pieces, fams };
}
// what the game gets: only the corrections that change something
export function gameTable(pieces) {
  const out = {};
  for (const [sku, p] of Object.entries(pieces || {})) if (p?.fit && !isIdentity(p.fit)) out[sku] = cleanFit(p.fit);
  return out;
}
// queue status of a family: approved (Harry approved the family), marks (a piece marked "doesn't fit" and not cleared), changed (a correction), unreviewed
export function familyStatus(fam, pieceSkus, st) {
  const f = st.fams[fam], marked = pieceSkus.filter(s => st.pieces[s]?.mark), changed = pieceSkus.filter(s => st.pieces[s] && !isIdentity(st.pieces[s].fit));
  const touched = f || pieceSkus.some(s => st.pieces[s]);
  return { status: f?.approved ? 'approved' : marked.length ? 'marks' : touched || changed.length ? 'in-progress' : 'unreviewed', marked: marked.length, changed: changed.length, approvedPieces: pieceSkus.filter(s => st.pieces[s]?.approved).length };
}

// ------------------------------------------------------------------ a correction on a loaded piece (js/look.js re-exports these)
// { s: [fx, fy, fz], o: [x, y, z] (feet), yaw (degrees) }: s multiplies the catalog-fitted scale per axis (about the piece's foot and
// centre), o moves it in its own frame (x along the wall, y up, z toward the room), yaw turns it about its centre after the scale.
// None, or an all-identity one, changes nothing: no layout, golden or picture moves until a correction is applied.
export const FIT_NONE = Object.freeze({ s: [1, 1, 1], o: [0, 0, 0], yaw: 0 });
export const fitIsIdentity = (f) => !f || (((f.s || [1, 1, 1]).every(v => Math.abs(v - 1) < 1e-9)) && ((f.o || [0, 0, 0]).every(v => Math.abs(v) < 1e-9)) && Math.abs(f.yaw || 0) < 1e-9);
// base = what makeVisual set before any correction ({ s, yaw (rad), pos })
export function applyFit(m, base, fit) {
  const f = fit || FIT_NONE, k = f.s || [1, 1, 1], o = f.o || [0, 0, 0];
  m.scale.set(base.s[0] * k[0], base.s[1] * k[1], base.s[2] * k[2]);
  m.rotation.y = base.yaw + (f.yaw || 0) * Math.PI / 180;
  m.position.set(base.pos[0] + o[0], base.pos[1] + o[1], base.pos[2] + o[2]);
}
