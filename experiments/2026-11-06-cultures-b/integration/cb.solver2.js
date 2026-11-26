// ======================= culture packs B: THE CULTURE-ROOM SKELETON (2026-11-06) =======================
// experiments/2026-11-06-cultures-b. Norse steading, Middle East (Mamluk), medieval Rus', Mexica: small packs, so their
// rooms are DATA, not programs: CB[room key] is a list of steps, each a few words for one of the helpers above (ccm*,
// hut*, the outdoor plot hutPlot). A culture is told from another by a few big signature pieces seen from above (the
// long hearth, the iconostasis, the floor fountain, the altar): every room puts its signature down FIRST, keeps the walks
// from the doors to it open, then fills walls and corners with the culture's own pieces and the library's generic ones
// (benches, barrels, rugs) by name. A program's ids are wishes: a piece the library lacks (or a tier the room does not
// list) is skipped silently, so a room solves while its meshes are still being made. Hooks: KEY / MENUS / DENSITY /
// FOCAL / KEY_RE as every appended type (cbRegister below).
//   step ops, indoor:  far (centred on the wall facing the door) · longwall (middle of the long wall away from the door)
//     centre (middle of the floor; along: turned down the long axis; n: that many down the axis) · ends (both short walls
//     that have no main door) · screen (a row across the room `depth` ft before the far wall) · behind (between the screen
//     and the far wall) · posts (two rows down the long axis) · wall (against walls: sides long|lat|far|door|all, `per` ft
//     of wall per piece or `n`) · corner (door|far) · near (round a named piece) · front (on its front, `dist` ft) ·
//     flank (one each side) · on (on its top) · pile · hang (mounted) · rug · lights
//   outdoor (hutPlot): yard (the plot, its edge kinds) · ocentre · oedge (at the edge: near the door|gate, or far) ·
//     ocorner · orows (rows with aisles) · osides (sections lined along both long sides facing in, a middle piece) · oplants
//   common fields: ids, as (a name later steps use: to), min (cells at least), n, why, layer, rule, focal (this is the key piece)
const CB = {};
const CB_LIGHTS = {};          // room key -> [wall light ids, floor light ids] (the light a room must have)
const cbSidesOf = (ctx, E, s) => {
  const d = E.d, L = ctx.longSides(), all = ['N', 'S', 'E', 'W'];
  const pick = { long: L, short: ctx.shortSides(), lat: E.lat, far: [E.far], door: d ? [d.side] : [], all, nodoor: all.filter(x => !d || x !== d.side), longfar: L.filter(x => !d || x !== d.side) }[s || 'all'];
  return pick && pick.length ? pick : all;
};
const cbAlongRot = (ctx) => (ctx.W >= ctx.D ? 0 : Math.PI / 2);      // a piece's width (x) down the room's long axis
const cbPt = (p) => [p.x, p.z];
function cbCornerSides(ctx, E, which) {
  const d = E.d, far = E.far, lat = E.lat;
  if (!d) return [far, lat[0]];
  const dp = d.inner, corners = lat.flatMap(l => [[far, l], [OPP_SIDE[far], l]]).map(([a, b]) => { const [x] = ctx.sidePoint(a, 0, 0); return [a, b]; });
  const at = ([a, b]) => [b === 'W' || a === 'W' ? ctx.X0 : b === 'E' || a === 'E' ? ctx.X1 : (ctx.X0 + ctx.X1) / 2, b === 'N' || a === 'N' ? ctx.Z0 : b === 'S' || a === 'S' ? ctx.Z1 : (ctx.Z0 + ctx.Z1) / 2];
  corners.sort((p, q) => Math.hypot(...at(p).map((v, i) => v - dp[i])) - Math.hypot(...at(q).map((v, i) => v - dp[i])));
  return which === 'door' ? corners[0] : corners[corners.length - 1];
}
const CB_OPS = {
  far: (ctx, st, E) => ccmFocalOn(ctx, E.far, st.ids, { label: st.label || st.ids[0], rule: st.rule || 'key-focal', why: st.why, layer: st.layer || 'anchor' }),
  longwall: (ctx, st, E) => { const sides = cbSidesOf(ctx, E, 'long').sort((a, b) => (E.d && a === E.d.side ? 1 : 0) - (E.d && b === E.d.side ? 1 : 0)); for (const s of sides) { const p = ccmFocalOn(ctx, s, st.ids, { label: st.label || st.ids[0], rule: st.rule || 'key-focal', why: st.why }); if (p) return p; } return null; },
  centre: (ctx, st, E) => {
    const rot = st.along ? cbAlongRot(ctx) : (st.rot || 0), n = Math.max(1, typeof st.n === 'function' ? st.n(ctx) : st.n || 1), Lx = ctx.W >= ctx.D, len = Math.max(ctx.W, ctx.D);
    let first = null;
    for (let i = 0; i < n; i++) { const u = n === 1 ? 0 : (i - (n - 1) / 2) * (len / n), off = Lx ? [u, 0] : [0, u];
      const p = i === 0 ? ccmCentre(ctx, st.ids, { label: st.label || st.ids[0], rot, off, rule: st.rule || 'key-focal', why: st.why, layer: st.layer || 'anchor' })
        : hutAt(ctx, ccmFirst(ctx, st.ids), [[(ctx.X0 + ctx.X1) / 2 + off[0], (ctx.Z0 + ctx.Z1) / 2 + off[1], rot]], { layer: st.layer || 'anchor', rule: st.rule || 'key-focal', why: st.why });
      if (p && !first) first = p; }
    return first;
  },
  ends: (ctx, st, E) => { let first = null; for (const s of ctx.shortSides()) { if (E.d && s === E.d.side) continue; const p = ccmFocalOn(ctx, s, st.ids, { label: st.label || st.ids[0], rule: first ? 'furnish' : st.rule || 'key-focal', why: st.why }); if (p && !first) first = p; } return first; },
  screen: (ctx, st, E) => {
    const id = ccmFirst(ctx, st.ids); if (!id) return null;
    const [w] = hutDims(ctx, id), L = ctx.sideLen(E.far), k0 = Math.max(1, Math.floor((L - 0.4) / w)), k = k0 - (k0 % 2 ? 0 : 1), t0 = (L - k * w) / 2 + w / 2, out = []; // (an ODD count: a section's doors stand on the room's axis, never a seam; the side sections' doors are the deacons' doors)
    for (let i = 0; i < k; i++) { const [x, z] = ctx.sidePoint(E.far, t0 + i * w, st.depth); const p = hutExact(ctx, () => hutAt(ctx, id, [[x, z, SIDES[E.far].rot]], { layer: 'anchor', rule: i ? 'screen' : st.rule || 'key-focal', why: st.why })); if (p) out.push(p); }
    if (out.length) ctx.focal = { label: st.label || id, id, side: E.far, ok: true };
    return out[Math.floor(out.length / 2)] || null;
  },
  behind: (ctx, st, E) => { const [x, z] = ctx.sidePoint(E.far, ctx.sideLen(E.far) / 2, st.depth); return hutAt(ctx, ccmFirst(ctx, st.ids), [[x, z, SIDES[E.far].rot], [x, z, SIDES[E.far].rot + Math.PI / 2]], { layer: 'anchor', rule: st.rule || 'behind-screen', why: st.why, allowKeep: true }); },
  posts: (ctx, st, E) => {
    const id = ccmFirst(ctx, st.ids); if (!id) return null; const Lx = ctx.W >= ctx.D, len = Lx ? ctx.W : ctx.D, wid = Lx ? ctx.D : ctx.W, every = st.every || 10, out = [];
    if (wid < (st.minWidth || 14)) return null;
    const k = Math.max(1, Math.floor((len - 6) / every)), u0 = -((k - 1) * every) / 2, v = wid / 2 - (st.inset || 4.6);
    for (let i = 0; i < k; i++) for (const sg of [-1, 1]) { const u = u0 + i * every, x = (ctx.X0 + ctx.X1) / 2 + (Lx ? u : sg * v), z = (ctx.Z0 + ctx.Z1) / 2 + (Lx ? sg * v : u);
      const p = ccmQuiet(ctx, () => hutAt(ctx, id, [[x, z, 0]], { layer: 'furnish', rule: 'roof-post', why: st.why || 'the roof posts, two rows down the room' })); if (p) out.push(p); }
    return out[0] || null;
  },
  wall: (ctx, st, E) => {
    const sides = cbSidesOf(ctx, E, st.sides), out = [];   // per: one piece every `per` ft of EACH side; n: n pieces in all, the sides in turn
    if (st.per) { for (const s of sides) { const k = Math.max(1, Math.floor(ctx.sideLen(s) / st.per));
      for (let i = 0; i < k; i++) { const p = hutWall(ctx, st.ids, [s], { any: true, at: (i + 0.5) / k, sideCost: 0, why: st.why, layer: st.layer, rule: st.rule }); if (p) out.push(p); } } }
    else for (let i = 0; i < (st.n || 1); i++) { const ss = [...sides.slice(i % sides.length), ...sides.slice(0, i % sides.length)]; const p = hutWall(ctx, st.ids, ss, { any: true, at: st.at ?? 0.5, sideCost: 1, why: st.why, layer: st.layer, rule: st.rule }); if (p) out.push(p); }
    return out[0] || null;
  },
  corner: (ctx, st, E) => { const c0 = cbCornerSides(ctx, E, st.which || 'far'), all = [c0, ...[['N', 'W'], ['N', 'E'], ['S', 'W'], ['S', 'E']].filter(q => !(q.includes(c0[0]) && q.includes(c0[1])))]; // (the corner asked for first, then any other)
    for (const c of all) for (const id of st.ids) { const p = ccmCorner(ctx, id, c, { why: st.why, layer: st.layer || 'anchor' }) || hutWall(ctx, [id], c, { near: ctx.sidePoint(c[0], c[1] === 'W' || c[1] === 'N' ? 1 : ctx.sideLen(c[0]) - 1, 1), layer: st.layer || 'anchor', rule: st.rule || 'corner', why: st.why }); if (p) return p; } return null; },
  near: (ctx, st, E) => { const to = E.P[st.to]; if (!to && st.to) return null; const pt = to ? (st.dist ? front(to, st.dist) : cbPt(to)) : [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2]; let first = null;
    for (let i = 0; i < (st.n || 1); i++) { const p = hutNear(ctx, st.ids, pt, { r0: st.r0 ?? (to ? Math.max(to.dims[0], to.dims[2]) / 2 + 0.6 : 0), r1: st.r1 ?? (to ? Math.max(to.dims[0], to.dims[2]) / 2 + 3 : 4), why: st.why, layer: st.layer || 'furnish', rule: st.rule || 'near', face: st.face !== false }); if (p && !first) first = p; }
    return first; },
  front: (ctx, st, E) => { const to = E.P[st.to]; if (!to) return null; const [x, z] = front(to, st.dist || 3); return hutAt(ctx, ccmFirst(ctx, st.ids), [[x, z, to.rot + (st.turn || 0)]], { layer: st.layer || 'furnish', rule: st.rule || 'before', why: st.why, allowKeep: true }) || hutNear(ctx, st.ids, [x, z], { r0: 0, r1: 2, why: st.why, layer: st.layer || 'furnish', face: false, rots: [to.rot + (st.turn || 0)], allowKeep: true }); }, // (on the approach: the walk from the door ends at it)
  flank: (ctx, st, E) => { const to = E.P[st.to]; if (!to) return null; return ccmFlank(ctx, to, st.ids, { off: st.off ?? 1, why: st.why, layer: st.layer || 'furnish', n: st.n || 2 })[0] || null; },
  on: (ctx, st, E) => { const to = E.P[st.to]; if (to) hutOnto(ctx, to, st.ids, st.n || 1, st.why || 'on it'); return null; },
  pile: (ctx, st) => { hutPile(ctx, st.ids, st.n || Math.max(2, Math.min(5, Math.round(ccmCells(ctx) / 5))), st.why || 'stores in the corner'); return null; },
  hang: (ctx, st, E) => { const sides = cbSidesOf(ctx, E, st.sides); let first = null; for (let i = 0; i < (st.n || 1); i++) { const id = ccmAny(ctx, st.ids); if (!id) break; const p = ccmQuiet(ctx, () => ctx.mount(id, { sides: [sides[i % sides.length]], height: st.height ?? 5.2, layer: st.layer || 'dress', why: st.why || 'on the wall' })); if (p && !first) first = p; } return first; },
  rug: (ctx, st, E) => { const to = E.P[st.to], id = ccmAny(ctx, st.ids); if (!id) return null; return ccmQuiet(ctx, () => ctx.rug(id, { ...(to ? { at: st.dist ? front(to, st.dist) : cbPt(to), rot: to.rot } : {}), why: st.why || 'a rug' })); },
  lights: (ctx, st, E) => { hutLights(ctx, cbSidesOf(ctx, E, st.sides), { ids: st.ids, every: st.every || 16, min: st.n ?? 1, max: st.max || 4, why: st.why }); return null; },
};
// a hub's swirl, walked FIRST (attempt() walks the same closed loop after the program: through the doors and, in a room of
// 900 sq ft or more, the inset corners), so the furniture leaves it free
function cbLoop(ctx) {
  if (ctx.role !== 'hub' || !ctx.doors.length) return;
  const c = [(ctx.X0 + ctx.X1) / 2, (ctx.Z0 + ctx.Z1) / 2], ins = Math.max(3, Math.min(6, Math.min(ctx.W, ctx.D) * 0.18));
  const corners = ctx.area() >= 900 ? [[ctx.X0 + ins, ctx.Z0 + ins], [ctx.X1 - ins, ctx.Z0 + ins], [ctx.X1 - ins, ctx.Z1 - ins], [ctx.X0 + ins, ctx.Z1 - ins]] : [];
  const way = [...ctx.doors.map(o => o.inner), ...corners].filter(p => p[0] > ctx.X0 && p[0] < ctx.X1 && p[1] > ctx.Z0 && p[1] < ctx.Z1).sort((p, q) => Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(q[1] - c[1], q[0] - c[0]));
  if (way.length >= 2) ctx.walk('loop', way, { closed: true, quietSkips: true });
}
function cbRoom(ctx) {
  const key = ctx.type.key, R = CB[key], d = ctx.mainDoor, far = ccmFar(ctx, { shortEnd: !!R.shortEnd }), E = { d, far, lat: ccmLat(far), P: {} };
  let focal = null, looped = false;
  for (const st of R.steps) {
    if ((st.min && ccmCells(ctx) < st.min) || (st.unless && E.P[st.unless])) continue; // (unless: a fallback step, skipped when the named piece stands)
    const p = CB_OPS[st.op](ctx, st, E);
    if (st.as && p) E.P[st.as] = p;
    if (st.focal && p && !focal) { focal = p; if (d) { ctx.sight = [d.inner, cbPt(p)]; ctx.sightFeature = p.id; hutWalks(ctx, st.op === 'far' || st.op === 'longwall' || st.op === 'ends' || st.op === 'screen' ? front(p, st.op === 'screen' ? 3.2 : 2.4) : cbPt(p)); } }
    if (st.focal && !looped) { cbLoop(ctx); looped = true; } // (the signature piece first, then the hub's swirl, then the rest round both)
  }
  if (!focal && R.need !== false) { ccmDone(ctx); return { fail: `${R.name} has no ${R.focal || 'focal piece'} (no room for it)` }; }
  const [wl, fl] = CB_LIGHTS[key] || [[], []]; ccmEnsureLight(ctx, wl, fl);
  ccmDone(ctx);
  return { feature: focal, what: `${R.name}: ${R.focal || (focal && focal.id)}`, approach: null, passage: true };
}
// the outdoor plots: the plot (its edge kinds, the gate, the way in) and then the same steps on Y
const CB_OOPS = {
  ocentre: (ctx, st, E, Y) => ccmCentre(ctx, st.ids, { label: st.label || st.ids[0], rot: st.along ? cbAlongRot(ctx) : 0, rule: st.rule || 'key-focal', why: st.why, layer: st.layer || 'anchor' }),
  oedge: (ctx, st, E, Y) => { let first = null; const ref = st.near === 'gate' ? (Y.gate ? Y.gate.inner : Y.start) : (Y.start || (Y.gate && Y.gate.inner)), to = st.to && E.P[st.to] ? cbPt(E.P[st.to]) : null;
    for (let i = 0; i < (st.n || 1); i++) { const p = Y.atEdge(st.ids, { any: true, ...(st.far ? { far: ref || [Y.cx, Y.cz] } : (to || ref) ? { near: to || ref } : {}), ...(st.built !== undefined ? { built: st.built } : {}), layer: st.layer || 'furnish', rule: st.rule || 'yard-edge-thing', why: st.why }); if (p && !first) first = p; } return first; },
  ocorner: (ctx, st, E, Y) => { const fc = Y.farCorner(); return Y.corner(st.ids, fc[st.i || 0], { layer: st.layer || 'furnish', why: st.why }); },
  orows: (ctx, st, E, Y) => {   // rows of pieces with aisles between them, down the plot's long axis (a market's spreads, chinampa beds)
    const id0 = ccmFirst(ctx, st.ids); if (!id0) return null; const [bw, bd] = hutDims(ctx, id0), gap = st.gap ?? 3, rect = Y.rect, Lx = ctx.W >= ctx.D;
    const turn = st.across ? !Lx : Lx, pw = turn ? bw : bd, pd = turn ? bd : bw;   // the piece's size along x / z as laid
    const nx = Math.max(1, Math.floor((rect[2] - rect[0] + gap) / (pw + gap))), nz = Math.max(1, Math.floor((rect[3] - rect[1] + gap) / (pd + gap)));
    const x0 = (rect[0] + rect[2]) / 2 - (nx - 1) * (pw + gap) / 2, z0 = (rect[1] + rect[3]) / 2 - (nz - 1) * (pd + gap) / 2, line = Y.gate ? [Y.start || [Y.cx, Y.cz], Y.gate.inner] : null, out = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = x0 + i * (pw + gap), z = z0 + j * (pd + gap);
      if (line && segHitsRect(line[0], line[1], x, z, pw / 2 + 1.2, pd / 2 + 1.2)) continue;
      const id = st.mix ? ctx.pick(st.ids.filter(k => ccmHas(ctx, k)))[0] : id0; if (!id) continue;
      const p = ccmQuiet(ctx, () => hutExact(ctx, () => hutAt(ctx, id, [[x, z, turn ? 0 : Math.PI / 2]], { layer: out.length ? 'furnish' : 'anchor', rule: st.rule || 'row', why: st.why })));
      if (p) out.push(p); if (st.max && out.length >= st.max) break; }
    E.rows = out; return out[0] || null;
  },
  osides: (ctx, st, E, Y) => {  // sections lined along both long sides, facing in; the middle section of each side is `mid`
    const id = ccmFirst(ctx, st.ids); if (!id) return null; const [w, dd] = hutDims(ctx, id), out = [];
    for (const s of ctx.longSides()) { const L = ctx.sideLen(s), k = Math.max(1, Math.floor(L / w)), t0 = (L - k * w) / 2 + w / 2;
      for (let i = 0; i < k; i++) { const mid = st.mid && i === Math.floor(k / 2) && ccmHas(ctx, st.mid), pid = mid ? st.mid : id, [x, z] = ctx.sidePoint(s, t0 + i * w, dd / 2 + 0.05);
        const p = ccmQuiet(ctx, () => hutExact(ctx, () => hutAt(ctx, pid, [[x, z, SIDES[s].rot]], { layer: 'anchor', rule: mid ? 'key-focal' : 'side-wall', why: st.why }))); if (p) out.push(p); } }
    return out.find(p => p.rule === 'key-focal') || out[0] || null;
  },
  oplants: (ctx, st, E, Y) => { Y.plants(st.ids, st.n || 2, { why: st.why }); return null; },
  near: (ctx, st, E) => CB_OPS.near(ctx, st, E), on: (ctx, st, E) => CB_OPS.on(ctx, st, E), flank: (ctx, st, E) => CB_OPS.flank(ctx, st, E),
  front: (ctx, st, E) => CB_OPS.front(ctx, st, E), pile: (ctx, st) => CB_OPS.pile(ctx, st), rug: (ctx, st, E) => CB_OPS.rug(ctx, st, E),
};
function cbPlot(ctx) {
  const key = ctx.type.key, R = CB[key], Y = hutPlot(ctx, R.name, R.edges || ['none']), E = { d: ctx.mainDoor, far: null, lat: [], P: {} };
  let focal = null;
  for (const st of R.steps) {
    if (st.min && ctx.area() < st.min * 25) continue;
    const p = CB_OOPS[st.op](ctx, st, E, Y);
    if (st.as && p) E.P[st.as] = p;
    if (st.focal && p && !focal) { focal = p; if (st.path !== false) Y.path(false); } // (the signature piece, then the way from the door to the gate round it)
  }
  if (!focal && R.need !== false) return hutPlotFail(ctx, `${R.name} has no ${R.focal || 'focal piece'}`);
  return hutPlotDone(ctx, Y, focal, `${R.name}: ${R.focal || (focal && focal.id)}`);
}
// cbRegister(key, R): one room of a culture pack. R = { name, focal (words), steps, outdoor, density, keyRe, lights: [wall ids, floor ids], annex: [wall ids] }
function cbRegister(key, R) {
  CB[key] = R; KEY[key] = R.outdoor ? cbPlot : cbRoom; FOCAL[key] = R.focal || '';
  KEY_RE[key] = R.keyRe === undefined ? null : R.keyRe;
  if (!R.outdoor) { DENSITY[key] = R.density || 5; CB_LIGHTS[key] = R.lights || [[], []];
    MENUS[key] = ccmAnnex((ctx) => { const sides = ctx.shuffle(['N', 'S', 'E', 'W']); for (const id of R.annex || []) hutWall(ctx, [id], sides, { why: 'against the wall' }); const [wl, fl] = CB_LIGHTS[key]; if (wl.length) hutLights(ctx, sides.slice(0, 2), { ids: wl, min: 1, max: 2 }); }); }
}
