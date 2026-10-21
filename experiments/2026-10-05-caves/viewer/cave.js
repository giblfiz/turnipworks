// The cave-wall placement RULE (2026-10-05). Pure data in, pure data out: no three.js here, so `node test_cave.mjs`
// can check it. Feet; x east, z south, y up; the grid cell is 5 ft.
//
// A cave room is a set of grid cells (rectangles, so an L or two rooms and a corridor are the same thing). The rule
// walks the outline of that set and stands rock chunks along it:
//   1. every straight stretch of outline ("run") gets a row of chunks, each a seeded pick from the wall pieces, turned
//      and scaled a little, each overlapping the one before by `overlap` of its width;
//   2. every chunk is pushed OUTWARD until its foremost point below head height is `push` feet outside the grid line,
//      so the room stays clear to the line whatever the chunk's shape or turn;
//   3. the line the chunks stand on WANDERS: on top of `push`, a smooth seeded curve moves it up to `wander` feet
//      further out along each run, and each chunk is turned to follow that curve, so the wall has bays and noses
//      instead of running parallel to the grid (outward only: the room never gets smaller than its grid squares);
//   4. a column stands in every corner: tucked into a room corner, and set back behind a corner that juts into the room;
//   5. low rubble goes at some of the joins;  6. the tunnel-mouth piece stands where the scene says there is a door.
// Behind the chunks the same wandering line, a little further out, is the edge of the SOLID ROCK: a rock face from
// floor to wall top (so a gap between two chunks shows rock, not a black slot) and a flat rock cap above.
// Canonical piece frame (kit.json, from measure.py): origin on the ground at the middle of the BACK plane, the bulging
// front toward +Z, width along X. A placement's `rot` is three.js rotation.y; `out` is the outward normal of its run.
export const CELL = 5;
export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function cellsOf(rects) {   // rects: [i, j, w, d] in cells
  const s = new Set();
  for (const [i0, j0, w, d] of rects) for (let i = i0; i < i0 + w; i++) for (let j = j0; j < j0 + d; j++) s.add(`${i},${j}`);
  return s;
}
const SIDES = { N: [0, 0, 1, 0, 0, -1], E: [1, 0, 0, 1, 1, 0], S: [1, 1, -1, 0, 0, 1], W: [0, 1, 0, -1, -1, 0] };   // start corner, direction, neighbour

// The outline as closed loops of unit edges. Walking an edge, the room is on the right-hand side and the outward
// normal is (dz, -dx). `open` lists edges with no wall at all (the far end of a tunnel): "i,j,SIDE".
export function outline(cells, open = []) {
  const openSet = new Set(open), edges = new Map();
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number);
    for (const [side, [sx, sz, dx, dz, nx, nz]] of Object.entries(SIDES)) {
      if (cells.has(`${i + nx},${j + nz}`)) continue;
      const a = [i + sx, j + sz];
      edges.set(`${a[0]},${a[1]}`, { a, b: [a[0] + dx, a[1] + dz], d: [dx, dz], n: [dz, -dx], open: openSet.has(`${i},${j},${side}`), cell: [i, j] });
    }
  }
  const loops = [], left = new Map(edges);
  while (left.size) {
    const first = left.values().next().value, loop = []; let e = first;
    while (e) { loop.push(e); left.delete(`${e.a[0]},${e.a[1]}`); e = left.get(`${e.b[0]},${e.b[1]}`); }
    loops.push(loop);
  }
  return loops;
}

// Runs: straight stretches of wall between corners (and between open edges). Each end knows what it meets:
//   'in'   a room corner (the rock is concave there): the run carries on a little past it, behind the corner column
//   'out'  a corner of rock that juts into the room: the run must stop at it, or it would stick out into the room
//   'open' an edge with no wall
export function runsOf(loop) {
  const n = loop.length, runs = [], corners = [];
  const turn = (e0, e1) => e0.d[0] * e1.d[1] - e0.d[1] * e1.d[0];   // +1 room corner, -1 jutting corner, 0 straight
  let start = 0;
  for (let k = 0; k < n; k++) if (turn(loop[(k + n - 1) % n], loop[k]) !== 0) { start = k; break; }
  let cur = null;
  for (let q = 0; q < n; q++) {
    const k = (start + q) % n, e = loop[k], prev = loop[(k + n - 1) % n], t = turn(prev, e);
    if (t !== 0) corners.push({ at: [e.a[0] * CELL, e.a[1] * CELL], type: t > 0 ? 'in' : 'out', n0: prev.n, n1: e.n, open: prev.open || e.open });
    const boundary = t !== 0 || prev.open !== e.open;
    if (boundary && cur) { cur.endType = prev.open ? cur.endType : (t !== 0 ? (t > 0 ? 'in' : 'out') : 'open'); runs.push(cur); cur = null; }
    if (e.open) { cur = null; continue; }
    if (!cur) cur = { a: [e.a[0] * CELL, e.a[1] * CELL], d: e.d, n: e.n, len: 0, startType: t !== 0 ? (t > 0 ? 'in' : 'out') : 'open', endType: 'open', cells: [] };
    e.run = cur; e.s = cur.len;                                   // the cap outline asks each edge where its wall stands
    cur.len += CELL; cur.cells.push(e.cell);
  }
  if (cur) { const e0 = loop[start], last = loop[(start + n - 1) % n], t = turn(last, e0); cur.endType = t !== 0 ? (t > 0 ? 'in' : 'out') : 'open'; runs.push(cur); }
  return { runs, corners };
}

// how far in front of its back plane a piece reaches below head height, at scale u
const reach = (k, u, sz = 1) => Math.max(k.front_reach_ft.foot_max, k.front_reach_ft.mid_max) * u * sz;
const DEG = Math.PI / 180;
function hash(seed, ...tags) { let h = (seed | 0) * 2654435761 >>> 0; for (const t of tags) for (const ch of String(t)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }
// a smooth curve 0..amp along a run: random values every 6 ft, cosine-blended (so bays are about 12 ft across)
function makeWander(len, amp, rng) {
  const STEP = 6, n = Math.ceil((len + 12) / STEP) + 2, v = Array.from({ length: n }, () => rng());
  // half of it is one long outward bow per run (nothing at the ends, most in the middle), so a room's sides are
  // convex and its corners blunter than 90 degrees; the other half is the bays
  const bow = len >= 15 ? 0.5 : 0;
  return (s) => { const f = Math.min(n - 1.001, Math.max(0, (s + 6) / STEP)), i = Math.floor(f), t = (1 - Math.cos((f - i) * Math.PI)) / 2;
    return amp * ((1 - bow) * (v[i] * (1 - t) + v[i + 1] * t) + bow * Math.sin(Math.PI * Math.min(1, Math.max(0, s / len))) ** 0.8); };
}

/**
 * @param scene  { rects, open, arches:[{x,z,face:'N'|'E'|'S'|'W'}] }
 * @param kit    measurements per piece (kit.json)
 * @param P      { overlap 0..0.6, push ft, turn deg, wander ft, seed, rubble 0..1, topH ft (wall-top height) }
 * @param pool   { walls:[ids], column:id, rubble:id, arch:id }
 * Separate random streams for the pick of pieces, the turn and the wander, so moving one slider changes one thing.
 */
export function placeCave(scene, kit, P, pool) {
  const cells = cellsOf(scene.rects), loops = outline(cells, scene.open || []);
  const out = [], runsAll = [], cornersAll = [];
  const walls = pool.walls.filter(id => kit[id]), topH = P.topH ?? 9.5, wanderAmp = P.wander ?? 0;
  let runNo = 0;
  for (const loop of loops) {
    const { runs, corners } = runsOf(loop);
    runsAll.push(...runs); cornersAll.push(...corners);
    for (const run of runs) {
      const id0 = runNo++, pick = mulberry32(hash(P.seed, 'pick', id0)), turnR = mulberry32(hash(P.seed, 'turn', id0)), misc = mulberry32(hash(P.seed, 'misc', id0));
      const rnd = (r, a, b) => a + r() * (b - a);
      run.w = makeWander(run.len, wanderAmp, mulberry32(hash(P.seed, 'wander', id0)));
      // the stretch to cover, measured along the run from its start corner
      const ext = (t) => t === 'in' ? 2.0 : t === 'out' ? -0.25 : 0.5;
      const s0 = -ext(run.startType), s1 = run.len + ext(run.endType), span = s1 - s0;
      const rot0 = Math.atan2(run.n[0], run.n[1]) + Math.PI;        // canonical +Z (the front) turned to face the room (-n)
      const row = []; let last = null, guard = 0;
      // 1. pick chunks until the stretch is covered
      let covered = 0;
      while (covered < span - 0.05 && guard++ < 60) {
        let id = walls[Math.floor(pick() * walls.length)];
        if (id === last && walls.length > 1) id = walls[(walls.indexOf(id) + 1 + Math.floor(pick() * (walls.length - 1))) % walls.length];
        last = id;
        const k = kit[id], u = rnd(pick, 0.9, 1.1), w = k.size_ft.w * u;
        row.push({ id, u, w, sx: 1 });
        covered = row.length === 1 ? w : covered + w * (1 - P.overlap);
      }
      // 2. make the row fit the stretch exactly: one chunk is squeezed (or swapped for the column) if the stretch is
      //    short, otherwise the spacing is tightened a little so the last chunk ends where the stretch ends
      if (row.length === 1) {
        const c = row[0];
        if (c.w > span) { c.sx = Math.max(0.5, span / c.w); if (span / c.w < 0.5 && kit[pool.column]) { c.id = pool.column; c.u = rnd(pick, 0.95, 1.1); c.w = kit[c.id].size_ft.w * c.u; c.sx = Math.min(1.3, Math.max(0.6, span / c.w)); } c.w *= c.sx; }
      }
      const fit = (r) => { const total = r.reduce((a, c, i) => a + (i ? c.w * (1 - P.overlap) : c.w), 0), sq = r.length > 1 ? (total - span) / (r.length - 1) : 0;
        return { sq, ov: P.overlap + sq / (r.reduce((a, c) => a + c.w, 0) / r.length) }; };
      // one chunk fewer if that lands nearer the overlap asked for (never below 12%: pieces must not butt)
      if (row.length > 2) { const a = fit(row), b = fit(row.slice(0, -1)); if (b.ov >= 0.12 && Math.abs(b.ov - P.overlap) < Math.abs(a.ov - P.overlap)) row.pop(); }
      // a short stretch can end up with two chunks almost on top of each other: better one chunk fewer, stretched up to 1.3 x
      if (row.length >= 2 && fit(row).ov > P.overlap + 0.15) {
        const fewer = row.slice(0, -1), f = span / fewer.reduce((a, c, i) => a + (i ? c.w * (1 - P.overlap) : c.w), 0);
        if (f <= 1.3) { row.pop(); row.forEach(c => { c.sx *= f; c.w *= f; }); }
      }
      const squeeze = fit(row).sq;   // extra overlap per join (negative: a little less)
      let left = s0 + (row.length === 1 ? (span - row[0].w) / 2 : 0);
      row.forEach((c, i) => {
        if (i) left += row[i - 1].w - (row[i - 1].w + c.w) / 2 * P.overlap - squeeze;
        const k = kit[c.id], centre = left + c.w / 2;
        // 3. the wandering line: how far out it is here, and which way it runs (the chunk turns with it)
        const wHere = run.w(centre), follow = Math.max(-18, Math.min(18, Math.atan((run.w(centre + 1) - run.w(centre - 1)) / 2) / DEG * 0.7));
        const th = (follow + rnd(turnR, -1, 1) * P.turn) * DEG;
        // push out: the foremost point below head height sits `push` + wander outside the grid line, allowing for the turn
        const back = P.push + wHere + reach(k, c.u) * Math.cos(th) + (c.w / 2) * Math.abs(Math.sin(th));
        const end = Math.abs(Math.sin(th)) * reach(k, c.u);   // a turned chunk is also a little longer along the wall
        let along = centre;
        if (run.startType !== 'in') along = Math.max(along, s0 + c.w / 2 * Math.cos(th) + end);
        if (run.endType !== 'in') along = Math.min(along, s1 - c.w / 2 * Math.cos(th) - end);
        const sy = (topH + rnd(misc, -0.6, 0.9)) / k.size_ft.h;   // every chunk reaches about the wall top
        out.push({ role: 'wall', id: c.id, x: run.a[0] + run.d[0] * along + run.n[0] * back, z: run.a[1] + run.d[1] * along + run.n[1] * back,
          rot: rot0 + th, scale: [c.u * c.sx, sy, c.u], y: -rnd(misc, 0, 0.2), out: run.n, along, back, w: c.w });
        // 5. rubble at some joins, its own front at the same line
        if (i && kit[pool.rubble] && misc() < P.rubble) {
          const rk = kit[pool.rubble], ru = rnd(misc, 0.8, 1.15), rth = rnd(misc, -1, 1) * Math.max(P.turn, 8) * DEG, joint = left + rnd(misc, -0.5, 0.5);
          const lo = s0 + rk.size_ft.w * ru / 2 + 0.3, hi = s1 - rk.size_ft.w * ru / 2 - 0.3;
          if (hi > lo) { const ja = Math.min(hi, Math.max(lo, joint)), rback = P.push + Math.min(run.w(ja - 2), run.w(ja), run.w(ja + 2)) + reach(rk, ru) * Math.cos(rth) + rk.size_ft.w * ru / 2 * Math.abs(Math.sin(rth));
            out.push({ role: 'rubble', id: pool.rubble, x: run.a[0] + run.d[0] * ja + run.n[0] * rback, z: run.a[1] + run.d[1] * ja + run.n[1] * rback, rot: rot0 + rth, scale: [ru, ru, ru], y: 0, out: run.n }); }
        }
      });
    }
    // 4. corner columns, where the two wandering lines meet. A room corner: the column's round foot just touches the
    //    meeting point. A jutting corner: the column stands wholly inside the rock, touching both lines, so the sharp
    //    grid corner becomes a round one.
    const n = loop.length;
    loop.forEach((e, k0) => {
      const prev = loop[(k0 + n - 1) % n], t = prev.d[0] * e.d[1] - prev.d[1] * e.d[0];
      if (t === 0 || prev.open || e.open || !kit[pool.column]) return;
      const cr = mulberry32(hash(P.seed, 'corner', e.a[0], e.a[1])), rnd = (a, b) => a + cr() * (b - a);
      const k = kit[pool.column], u = rnd(0.95, 1.15), r = Math.max(k.half_width_ft.all, (k.front_reach_ft.all_max - k.front_reach_ft.behind_back_plane) / 2) * u;
      const wp = prev.run.w(prev.run.len), we = e.run.w(0), a = t > 0 ? r / Math.SQRT2 : r, rot = cr() * Math.PI * 2;
      // the piece's origin is on its back plane, so its middle is cz in front of the origin: put the MIDDLE on the spot
      const cz = (k.front_reach_ft.foot_max + k.front_reach_ft.behind_back_plane) / 2 * u;
      out.push({ role: t > 0 ? 'corner-in' : 'corner-out', id: pool.column,
        x: e.a[0] * CELL + prev.n[0] * (P.push + wp + a) + e.n[0] * (P.push + we + a) - cz * Math.sin(rot), z: e.a[1] * CELL + prev.n[1] * (P.push + wp + a) + e.n[1] * (P.push + we + a) - cz * Math.cos(rot),
        rot, scale: [u, (topH + rnd(-0.5, 0.6)) / k.size_ft.h, u], y: -rnd(0, 0.2), round: true, r });
    });
  }
  // 6. tunnel mouths
  for (const a of scene.arches || []) {
    const k = kit[pool.arch]; if (!k || !k.opening) continue;
    const face = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[a.face];   // the way the front of the arch looks
    // free stretch: the opening is widened to a full grid square plus a little (the plate drew it under 3 ft wide), a
    // 6-ft pawn clears the lintel, and the piece is thinned to 3 ft. It stands just BEHIND the line it is given, in
    // the tunnel, the way the wall chunks stand behind theirs; its long sides are buried in the rock either side.
    const sx = Math.min(2, Math.max(1, 5.4 / k.opening.width_ft)), sy = Math.min(1.2, Math.max(1, 6.8 / k.opening.clear_height_ft)), sz = Math.min(1, 3 / k.size_ft.d);
    const oc = (k.opening.x0 + k.opening.x1) / 2 * sx, depth = k.size_ft.d * sz + 0.2;
    const rot = Math.atan2(face[0], face[1]), right = [Math.cos(rot), -Math.sin(rot)];
    out.push({ role: 'arch', id: pool.arch, x: a.x - right[0] * oc - face[0] * depth, z: a.z - right[1] * oc - face[1] * depth, rot, scale: [sx, sy, sz], y: 0,
      opening_ft: [+(k.opening.width_ft * sx).toFixed(2), +(k.opening.clear_height_ft * sy).toFixed(2)], stretch: +sx.toFixed(2) });
  }
  return { placements: out, cells, loops, runs: runsAll, corners: cornersAll };
}

// The edge of the solid rock: the outline pushed outward to `back` feet behind the wandering line the chunks stand
// on, plus a little seeded raggedness. Returns closed loops of [x, z], four points per grid edge. Needs the loops of a
// placeCave() result (their edges know their run and its wander); plain outline() loops get no wander.
export function rockEdge(loops, P, back, ragged) {
  const rng = mulberry32(hash(P.seed, 'edge')), STEPS = 5;
  return loops.map(loop => {
    const n = loop.length, pts = [];
    const D = (e, s) => Math.max(0.2, Math.min(e.run ? 9 : 2, P.push + back + (e.run?.w ? e.run.w(s) : 0)));
    const corner = (a, b) => a.d[0] !== b.d[0] || a.d[1] !== b.d[1];
    loop.forEach((e, k) => {
      const prev = loop[(k + n - 1) % n], next = loop[(k + 1) % n];
      // at a corner the edge also moves along the neighbouring wall's normal, fading out over this one grid edge
      const dp = corner(prev, e) ? Math.min(4.6, D(prev, (prev.s ?? 0) + CELL)) : 0, dn = corner(e, next) ? Math.min(4.6, D(next, next.s ?? 0)) : 0;
      for (let q = 0; q < STEPS; q++) {
        const t = q / STEPS, d = D(e, (e.s ?? 0) + CELL * t);
        pts.push({ x: (e.a[0] + e.d[0] * t) * CELL + e.n[0] * d + prev.n[0] * dp * (1 - t) + next.n[0] * dn * t,
                   z: (e.a[1] + e.d[1] * t) * CELL + e.n[1] * d + prev.n[1] * dp * (1 - t) + next.n[1] * dn * t, n: e.n });
      }
    });
    const m = pts.length, knots = Math.max(3, Math.round(m / 3)), val = Array.from({ length: knots }, () => rng());
    return pts.map((p, i) => {   // raggedness: outward only, so the edge never comes nearer the room than `back` behind the chunks
      const f = i / m * knots, i0 = Math.floor(f) % knots, i1 = (i0 + 1) % knots, t = (1 - Math.cos((f - Math.floor(f)) * Math.PI)) / 2;
      const w = (val[i0] * (1 - t) + val[i1] * t) * ragged;
      return [p.x + p.n[0] * w, p.z + p.n[1] * w];
    });
  });
}
