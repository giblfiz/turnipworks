// MOVEMENT RINGS (Harry 2026-11-02, first called move rings; then "I think 'movement rings' would be better": "When a pawn gets clicked on we could have some little rings showing it's move distances.
// I'm thinking something faint, like a topo map with a thicker line at 10/20/30/40. These would need to be
// wall/pathfinding aware.. so they would flow 'around' doors/walls." Then "it doesn't need to go huge, just like 30 or 40",
// "FoW leak is an issue!", "It's a hint not a rule"). docs/UI.md "Movement rings". (Code names keep "move rings": MOVE_RINGS_LOOK, app.moveRings, ?movelab=1.)
//
//   WHEN     only while a pawn is being dragged, from where the drag began (never on a click or a select); gone on drop
//   WHO      only the seat dragging. Nothing is sent: no presence, no command. Other seats see what they always saw
//   WHAT     faint contour lines of WALKING distance from the start: thin at 10 and 20 ft, thicker at 30, a last faint one
//            at 40, nothing past it (MOVE_RINGS_LOOK). The dragged line (surfaces/rulers.js) follows the shortest walk
//            from the same field and reads its length; where no walk is known it is the straight line it always was
//   WALLS    the pawn's level's walls for FEET (client/vision.js blockingSegments `walk`): a window is a wall, an open door
//            lets it through, a shut one stops it. Stairs, hills, furniture, pawns, size and speed are ignored
//
// THE FOG RULE (the hard requirement). The rings and the route never tell a seat about ground it cannot know:
//   * a seat under fog of war (a player; the GM viewing as a player) walks only on what that viewer has explored or sees
//     now (app.fog.explored, its own memory, the party's when sight is shared): every other cell is a wall, so a ring
//     stops at the fog's edge and no unexplored wall, room or secret door can bend it
//   * fog off for the area: all the walls this seat has.  The GM (not viewing as anyone): everything the GM has
//   * what a player may not have never reaches the page at all (the relay's withholding, seesLabels, stripEntity): this
//     surface only reads what the page already holds, and draws only on this page
//
// COST. Nothing while no pawn is dragged. At the start of a drag: one field (core/walk.js, about 6 000 cells of 1.25 ft
// out to the reach; the walls are taken only from the edges and things near the pawn), its distances written into one
// small float texture. Every frame of the drag: one quad, one material, compiled once while the table loads (a
// ShaderMaterial with no lights and no fog, so no light count or scene change ever compiles it again). The contours are
// worked out per pixel from the texture (fwidth), so they stay one or two pixels wide at any zoom.
import { walkField, routeTo, distanceAt, FAR, WALK } from '../../core/walk.js';
import { blockingSegments } from '../vision.js';
import { sightLevel } from '../../core/height.js';
import { T } from '../tuner.js';
import { mountLab, readDraft } from '../lab/kit.js';

// THE LOOK, in one place. The slider page for it: "movement rings tuner" in the bar, or ?movelab=1 (moveRingsTuner below);
// ?moverings=k:v,... sets values for one page load
export const MOVE_RINGS_LOOK = {
  // HARRY'S LOOK (2026-11-03, sent from the tuner, unchanged: "I'm loving the rings. I think I have them tuned in a way I
  // like"). The values before it: rings every 10 ft, bold at 30, last at 40 (docs/UI.md "Movement rings").
  on: true,
  spacing: 5,         // ft between rings
  bold: 15,           // the ring drawn thicker
  reach: 30,          // ft: the last ring; nothing is drawn past it
  thinWidth: 1.2,     // px (CSS pixels): the rings between
  boldWidth: 2,       // px: the bold ring
  lastWidth: 2.8,     // px: the last ring
  thinAlpha: 0.3, boldAlpha: 0.5, lastAlpha: 0.7,
  casing: '#0b0d0a', casingAlpha: 0.75, casingPx: 1.5, // a soft dark edge each side of every line (times its own alpha), so a light line reads on a light floor too
  fillAlpha: 0.01,    // a very faint fill inside `fillTo`
  fillTo: 30,
  minor: 0.5,         // ft between faint minor lines (0 = none)
  minorAlpha: 0.06, minorWidth: 0.7,
  color: '#f2ead3',   // a parchment white: reads on stone, wood and grass, and is no seat's colour
  minGapPx: 7,        // rings closer than this on screen fade out (zoomed far out they would be a grey smear)
  fadeMs: 350,        // they come in this softly at the start of a drag
  fadeOutMs: 1000,    // and go this slowly after the drop (Harry 2026-11-03: "a 'fades out' that is nice and long, maybe a whole second")
  lift: 0.1,          // ft over the floor
  route: true,        // the dragged line follows the walk
  // NO WALK, IN RED (Harry 2026-11-03: "the measurement bar goes to 'as the crow flies' when you take an impossible/too far
  // move. That is the right thing, but I would love it if it also turned red when that happens"): the dragging seat's own
  // straight line and its number, when no walk there is known (walled off, unexplored, past the last ring). '' = off.
  // Only on that seat's screen: other seats keep the dragger's colour (red there would say "no way through" about walls
  // they may not have seen). Its dark edge is the line's own casing (surfaces/rulers.js RULER_LOOK.casing).
  // (Gemini, blind, five reds on one frozen instant: this crimson-rose "preserves the semantic urgency of red while introducing
  //  just enough cool hue contrast to prevent the line from vanishing into warm wooden floors"; an orange-red came 4th, "camouflaged on wood")
  noRoute: '#ff2d55',
  hold: false,        // (the tuner) the last drag's rings stay after letting go, to look at them with both hands free
};
try { const q = new URLSearchParams(location.search).get('moverings'); if (q) for (const p of q.split(',')) { const [k, v] = p.split(':'); if (k in MOVE_RINGS_LOOK) MOVE_RINGS_LOOK[k] = typeof MOVE_RINGS_LOOK[k] === 'string' ? v : Number.isFinite(+v) ? +v : MOVE_RINGS_LOOK[k]; } } catch { }

const VS = `
varying vec2 vXZ;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = `
uniform sampler2D uD; uniform vec2 uO; uniform float uCell; uniform float uN;
uniform float uSpacing; uniform float uBold; uniform float uReach; uniform float uFillTo; uniform float uMinor;
uniform vec4 uAlpha; uniform vec4 uWidth; uniform float uMinorAlpha; uniform float uJump; uniform float uOpacity; uniform float uMinGap; uniform float uPx;
uniform vec3 uColor; uniform vec3 uCasing; uniform float uCasingA; uniform float uCasingPx;
varying vec2 vXZ;
float D(ivec2 p) { int n = int(uN) - 1; return texelFetch(uD, clamp(p, ivec2(0), ivec2(n)), 0).r; }
float band(float d, float L, float w, float fw) { return 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, abs(d - L) / fw); }
void main() {
  vec2 t = (vXZ - uO) / uCell, b = floor(t), f = t - b; ivec2 i = ivec2(b);
  float a = D(i), c = D(i + ivec2(1, 0)), e = D(i + ivec2(0, 1)), g = D(i + ivec2(1, 1));
  float lo = min(min(a, c), min(e, g)), hi = max(max(a, c), max(e, g));
  float d = mix(mix(a, c, f.x), mix(e, g, f.x), f.y);
  float fw = max(fwidth(d), 1e-4);
  // a square of four cells that straddles a wall (or the fog's edge, or the end of the walk) has distances further apart
  // than walking allows: no line is drawn across it, and the fill takes the nearest cell's value
  bool even = hi - lo <= uJump && hi < uReach + 4.0 * uCell;
  float near = f.x < 0.5 ? (f.y < 0.5 ? a : e) : (f.y < 0.5 ? c : g);
  float dd = even ? d : near;
  vec3 col = uColor;
  float alpha = dd < uFillTo + fw ? uAlpha.w * (1.0 - smoothstep(uFillTo - fw, uFillTo + fw, dd)) : 0.0;
  if (even && d <= uReach + fw * uWidth.z) {
    float px = fw / uPx; // feet per CSS pixel along the gradient
    float L = clamp(floor(d / uSpacing + 0.5), 1.0, floor(uReach / uSpacing + 0.001)) * uSpacing;
    float last = step(uReach - 0.01, L), bold = (1.0 - last) * (1.0 - step(0.01, abs(L - uBold)));
    float w = mix(mix(uWidth.x, uWidth.y, bold), uWidth.z, last) * uPx, la = mix(mix(uAlpha.x, uAlpha.y, bold), uAlpha.z, last);
    float gap = smoothstep(uMinGap * 0.5, uMinGap, uSpacing / px);
    float line = band(d, L, w, fw) * la * gap, edge = band(d, L, w + 2.0 * uCasingPx * uPx, fw) * la * uCasingA * gap;
    if (uMinor > 0.0 && d < uReach - 0.5 * uMinor) { float M = floor(d / uMinor + 0.5) * uMinor; if (abs(fract(M / uSpacing + 0.5) - 0.5) > 0.01 && M > 0.0) line = max(line, band(d, M, uWidth.w * uPx, fw) * uMinorAlpha * smoothstep(uMinGap * 0.5, uMinGap, uMinor / px)); }
    // the line over its casing, over the fill
    float la2 = line + edge * (1.0 - line), A = la2 + alpha * (1.0 - la2);
    vec3 lc = la2 > 0.0 ? (uColor * line + uCasing * edge * (1.0 - line)) / la2 : uColor;
    col = A > 0.0 ? (lc * la2 + uColor * alpha * (1.0 - la2)) / A : uColor; alpha = A;
  }
  alpha *= uOpacity;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

export function moveRingsSurface(R, app) {
  const THREE = app.THREE, L = MOVE_RINGS_LOOK;
  const open = (r) => !!r.roof?.off || !!T.walls?.isOutdoor?.(r.recipe?.type); // (client/fog.js: the same)
  const sizeFor = () => Math.ceil(2 * (L.reach + WALK.margin * WALK.cell) / WALK.cell) + 3;
  let tex = null, texN = 0, U = null;
  function texture() {
    const n = sizeFor(); if (tex && texN === n) return tex;
    tex?.dispose(); texN = n;
    tex = new THREE.DataTexture(new Float32Array(n * n).fill(FAR), n, n, THREE.RedFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    if (U) U.uD.value = tex;
    return tex;
  }
  U = {
    uD: { value: null }, uO: { value: new THREE.Vector2() }, uCell: { value: WALK.cell }, uN: { value: 1 },
    uSpacing: { value: L.spacing }, uBold: { value: L.bold }, uReach: { value: L.reach }, uFillTo: { value: L.fillTo }, uMinor: { value: L.minor },
    uAlpha: { value: new THREE.Vector4() }, uWidth: { value: new THREE.Vector4() }, uMinorAlpha: { value: L.minorAlpha }, uJump: { value: WALK.cell * 1.6 },
    uOpacity: { value: 0 }, uMinGap: { value: L.minGapPx }, uPx: { value: 1 }, uColor: { value: new THREE.Color(L.color) },
    uCasing: { value: new THREE.Color(L.casing) }, uCasingA: { value: L.casingAlpha }, uCasingPx: { value: L.casingPx },
  };
  texture();
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, transparent: true, depthWrite: false, depthTest: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide, forceSinglePass: true, fog: false, lights: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
  // (halo / noPick: never picked, never in a bounding box; treatAsOpaque: N8AO does not draw it again into its see-through buffers)
  Object.assign(mesh.userData, { halo: true, noPick: true, moveRings: true, treatAsOpaque: true });
  mesh.raycast = () => { }; mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
  function look() {
    U.uSpacing.value = Math.max(0.5, L.spacing); U.uBold.value = L.bold; U.uReach.value = L.reach; U.uFillTo.value = L.fillTo; U.uMinor.value = L.minor; U.uMinorAlpha.value = L.minorAlpha;
    U.uAlpha.value.set(L.thinAlpha, L.boldAlpha, L.lastAlpha, L.fillAlpha); U.uWidth.value.set(L.thinWidth, L.boldWidth, L.lastWidth, L.minorWidth);
    U.uMinGap.value = L.minGapPx; U.uColor.value.set(L.color); U.uCasing.value.set(L.casing); U.uCasingA.value = L.casingAlpha; U.uCasingPx.value = L.casingPx; U.uPx.value = app.gfx?.renderer?.getPixelRatio?.() || devicePixelRatio || 1;
  }
  // ---- the field for this drag (worked out once, when the drag starts)
  let cur = null; // { key, area, w, lead, F, level, y, fog, born, segs, ms }
  function wallsNear(w, E, ox, oz, level) {
    const pad = L.reach + 25, x0 = ox - pad, x1 = ox + pad, z0 = oz - pad, z1 = oz + pad, edges = [], ents = {};
    for (const e of (w.edges || new Map()).values()) { const x = e.gx * 5, z = e.gz * 5; if (x >= x0 && x <= x1 && z >= z0 && z <= z1) edges.push(e); }
    for (const id in E) { const e = E[id]; if (e.kind === 'object') { if (e.x >= x0 && e.x <= x1 && e.z >= z0 && e.z <= z1) ents[id] = e; } else if (e.kind === 'room' || e.kind === 'edge' || e.kind === 'building') ents[id] = e; }
    return blockingSegments(edges, ents, level, { walk: true });
  }
  function start(area, w, drag) {
    const E = w.view?.entities || {}, e = E[drag.lead]; if (!e || e.kind !== 'token') return null;
    const t0 = performance.now(), y = drag.y0 ?? (e.y || 0), level = sightLevel(E, e.x, e.z, e.y || 0, open);
    const fog = !!app.fog?.active?.(area); // under fog of war: only what this viewer knows is walkable
    const known = fog ? (x, z) => app.fog.explored(x, z, level, area) : null;
    const segs = wallsNear(w, E, e.x, e.z, level), t1 = performance.now();
    const F = walkField({ origin: [e.x, e.z], reach: L.reach, segments: segs, known });
    const t2 = performance.now();
    const T_ = texture(), data = T_.image.data, n = F.n, N = texN; data.fill(FAR);
    for (let j = 0; j < n && j < N; j++) data.set(F.dist.subarray(j * n, j * n + Math.min(n, N)), j * N);
    T_.needsUpdate = true;
    U.uO.value.set(F.x0 + F.cell / 2, F.z0 + F.cell / 2); U.uCell.value = F.cell; U.uN.value = N; U.uJump.value = F.cell * 1.6;
    const size = n * F.cell; mesh.scale.set(size, 1, size); mesh.position.set(F.x0 + size / 2, y + L.lift, F.z0 + size / 2);
    if (mesh.parent !== w.layers.deco) w.layers.deco.add(mesh);
    return { key: keyOf(area, drag, e), area, w, lead: e.id, F, level, y, fog, known, walls: segs, born: performance.now(), wallMs: t1 - t0, fieldMs: t2 - t1, totalMs: performance.now() - t0, segs: segs.length };
  }
  const keyOf = (area, drag, e) => `${area}|${drag.lead}|${e.x}|${e.z}`;
  const stats = { drags: 0, last: null, worst: 0 };
  let leaving = 0; // when the drop came: the rings fade out over fadeOutMs from then (still the drag's field; no route is offered)
  function stop() { leaving = 0; if (cur) { mesh.visible = false; cur = null; } }
  // the field of the drag in progress (rulers.js asks for the route through it): made at the drag's first frame
  function ensure() {
    const drag = app.moveDrag?.pawns, area = app.area(), w = area && app.worlds.get(area);
    if (L.hold && !drag && cur && cur.area === area && cur.w === w && L.on) return cur; // (the tuner: still showing the last drag's)
    if (!drag && cur && L.on && L.fadeOutMs > 0 && cur.area === area && cur.w === w) { // let go: fade out where they were
      if (!leaving) leaving = performance.now();
      if (performance.now() - leaving < L.fadeOutMs) return cur;
    }
    if (leaving) stop(); // faded out, or a new drag began while fading: the next field is worked out afresh (a door may have changed)
    if (!L.on || !drag || !w || w.local || !app.main) { stop(); return null; }
    const e = w.view?.entities?.[drag.lead];
    if (!e) { stop(); return null; }
    if (cur && cur.key === keyOf(area, drag, e) && cur.w === w) return cur;
    look(); cur = start(area, w, drag);
    if (cur) { stats.drags++; stats.last = { wallMs: +cur.wallMs.toFixed(2), fieldMs: +cur.fieldMs.toFixed(2), totalMs: +cur.totalMs.toFixed(2), cells: cur.F.n * cur.F.n, reached: cur.F.stats.reached, lines: cur.F.stats.lines, segs: cur.segs, fog: cur.fog }; stats.worst = Math.max(stats.worst, cur.totalMs); }
    return cur;
  }
  // WARM: the material is compiled once while the table loads (drawn for one frame, invisible), never at a drag's start
  let warm = 0;
  app.on((what) => {
    if (what !== 'frame') return;
    const area = app.area(), w = area && app.worlds.get(area);
    if (warm < 2 && w && !w.local && app.main && w.layers?.deco) {
      if (!warm) { if (mesh.parent !== w.layers.deco) w.layers.deco.add(mesh); U.uOpacity.value = 0; mesh.scale.set(0.01, 1, 0.01); mesh.position.set(0, -1000, 0); mesh.visible = true; warm = 1; app.gfx?.wake?.('moveRings'); return; }
      warm = 2; if (!cur) mesh.visible = false;
    }
    const c = ensure();
    if (!c) return;
    const k = L.fadeMs > 0 ? Math.min(1, (performance.now() - c.born) / L.fadeMs) : 1;
    const t = leaving && L.fadeOutMs > 0 ? Math.min(1, (performance.now() - leaving) / L.fadeOutMs) : 0, out = 1 - t * t * (3 - 2 * t); // eased
    U.uOpacity.value = k * out; mesh.visible = true;
    U.uPx.value = app.gfx?.renderer?.getPixelRatio?.() || devicePixelRatio || 1;
    if (k < 1 || leaving) app.gfx?.wake?.('moveRings');
  });
  const S = app.moveRings = {
    LOOK: L,
    // the walk to (x, z) for the drag in progress: { points, length, bends } or null (no drag, no walk known there)
    route(x, z) { return S.walk(x, z) || null; },
    // the same, telling apart "no walk is known there" (false: walled off, unexplored, further than the last ring) from
    // "nothing to judge by" (null: no drag, rings or route switched off, the rings fading out after the drop)
    walk(x, z) { const c = ensure(); if (!c || !L.route || leaving) return null; const r = routeTo(c.F, x, z); return r && r.length <= L.reach + 0.5 ? r : false; },
    // (tests, the slider page) the drag's field and what was drawn
    state: () => ({ on: L.on, shown: !!cur && mesh.visible, leaving: !!leaving, warm, lead: cur?.lead || null, origin: cur ? [cur.F.ox, cur.F.oz] : null, y: cur?.y ?? null, level: cur?.level ?? null, fog: cur?.fog ?? null,
      n: cur?.F.n || 0, cell: cur?.F.cell || 0, opacity: U.uOpacity.value, program: (() => { const P = app.gfx?.renderer?.properties?.get?.(mat)?.currentProgram; return !!P && P.diagnostics?.runnable !== false; })(), stats: { ...stats } }),
    distanceAt: (x, z) => cur ? distanceAt(cur.F, x, z) : null,
    // every reached cell: [x, z, d] (tests: what a seat's field holds, cell by cell)
    cells: () => { if (!cur) return []; const F = cur.F, out = []; for (let k = 0; k < F.dist.length; k++) if (F.dist[k] < FAR) out.push([F.x0 + (k % F.n + 0.5) * F.cell, F.z0 + (Math.floor(k / F.n) + 0.5) * F.cell, Math.round(F.dist[k] * 100) / 100]); return out; },
    // (tests: the fog rule) the same field again with every wall that lies wholly in ground this seat does not know taken
    // away (no point beside it, on either face, known): { same: is the field cell for cell what it was, dropped, kept }
    withoutUnknownWalls() {
      if (!cur) return null;
      const knows = cur.known || (() => true), side = 0.7;
      const seen = ([ax, az, bx, bz]) => { const len = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / len, nz = (bx - ax) / len, k = Math.ceil(len / 0.5); for (let q = 0; q <= k; q++) { const x = ax + (bx - ax) * q / k, z = az + (bz - az) * q / k; if (knows(x + nx * side, z + nz * side) || knows(x - nx * side, z - nz * side)) return true; } return false; };
      const kept = cur.walls.filter(seen), G = walkField({ origin: [cur.F.ox, cur.F.oz], reach: L.reach, segments: kept, known: cur.known });
      return { same: G.n === cur.F.n && G.dist.every((d, k) => d === cur.F.dist[k]), dropped: cur.walls.length - kept.length, kept: kept.length };
    },
    set(k, v) { if (!(k in L)) return false; L[k] = v; look(); if (cur && (k === 'reach')) { const d = app.moveDrag?.pawns; cur = null; if (d) ensure(); } app.gfx?.wake?.('moveRings'); app.refresh(); return true; },
    material: mat,
  };
  moveRingsTuner(R, app, S);
  if (new URLSearchParams(location.search).get('movelab') === '1') queueMicrotask(() => S.tuner());
  return { name: 'moveRings' };
}

// THE TUNER (2026-11-02; Harry likes an adjuster for a taste call): sliders over MOVE_RINGS_LOOK, live on the table, this
// browser only (lab/kit.js: Undo / Redo / Revert / ↺, its own draft, Copy settings for the JSON to hand over). "Hold the
// rings after letting go" keeps the last drag's rings up while the sliders move. Never sent, never the house look.
const DRAFT = 'tw.moveRings.draft';
const TUNE = {
  // path: [label, min, max, step, hint]
  spacing: ['Ring every (ft)', 0.5, 20, 0.5, 'down to 0.5 (Harry 2026-11-03); fine rings fade out when zoomed out: see Hide rings closer than'], bold: ['Bold ring at (ft)', 0, 60, 5, 'a multiple of the spacing; 0 = none'], reach: ['Last ring at (ft)', 10, 60, 5, 'nothing is drawn past it'],
  thinWidth: ['Thin ring width (px)', 0.5, 4, 0.1], boldWidth: ['Bold ring width (px)', 0.5, 5, 0.1], lastWidth: ['Last ring width (px)', 0.5, 4, 0.1],
  thinAlpha: ['Thin ring strength', 0, 1, 0.01], boldAlpha: ['Bold ring strength', 0, 1, 0.01], lastAlpha: ['Last ring strength', 0, 1, 0.01],
  casingAlpha: ['Dark edge strength', 0, 1, 0.01, 'a soft dark edge each side of a line, so it reads on a light floor'], casingPx: ['Dark edge width (px)', 0, 3, 0.25],
  fillAlpha: ['Fill inside the bold ring', 0, 0.3, 0.01], fillTo: ['Fill out to (ft)', 0, 60, 5],
  minor: ['Faint in-between lines every (ft)', 0, 10, 0.5, '0 = none; 5 is a topo map\'s in-between lines'], minorAlpha: ['In-between strength', 0, 1, 0.01], minorWidth: ['In-between width (px)', 0.5, 3, 0.1],
  minGapPx: ['Hide rings closer than (px)', 0, 20, 1, 'zoomed far out'], fadeMs: ['Fade in (ms)', 0, 600, 10], fadeOutMs: ['Fade out (ms)', 0, 2000, 50, 'after the drop'], lift: ['Lift over the floor (ft)', 0, 0.5, 0.01],
};
const REDS = [['#ff2d55', 'Crimson rose'], ['#ff1a1a', 'Pure red'], ['#ff4b3a', 'Orange-red'], ['#ff7a1a', 'Orange'], ['#e0245e', 'Raspberry'], ['', 'Off (the seat\'s own colour)']];
const COLOURS = [['#f2ead3', 'Parchment'], ['#ffffff', 'White'], ['#e8c872', 'Gold'], ['#a8d4ff', 'Sky'], ['#c9f2c0', 'Moss'], ['#262a30', 'Ink']];
function moveRingsTuner(R, app, S) {
  let lab = null;
  const keys = [...Object.keys(TUNE), 'color', 'noRoute', 'on', 'route', 'hold'];
  const pick = (o) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]]));
  const builtIn = pick(MOVE_RINGS_LOOK);
  const normalize = (o) => ({ ...builtIn, ...pick(o || {}) });
  function open() {
    if (lab) { lab.drawer.classList.remove('collapsed'); return lab; }
    const drawer = document.createElement('aside'); drawer.id = 'moverings-panel'; document.body.append(drawer);
    const draft = readDraft(DRAFT, normalize);
    const fields = Object.fromEntries([...Object.entries(TUNE).map(([k, [label, , , , hint]]) => [k, { label, hint }]), ['color', { label: 'Colour', choices: COLOURS }], ['noRoute', { label: 'The dragged line when no walk is known', choices: REDS }], ['on', { label: 'Movement rings on' }], ['route', { label: 'The dragged line follows the walk' }], ['hold', { label: 'Hold the rings after letting go' }]]);
    const panel = mountLab(drawer, {
      title: 'Movement rings', fields, limits: (p) => TUNE[p]?.slice(1, 4), normalize, envelope: (x) => x, initial: draft || builtIn,
      initialName: draft ? 'this browser’s unsaved draft' : 'built-in', draftKey: DRAFT,
      layout: () => ({ main: [['Rings', ['spacing', 'bold', 'reach']], ['Lines', ['thinAlpha', 'boldAlpha', 'lastAlpha', 'thinWidth', 'boldWidth', 'lastWidth', 'color']], ['Edge and fill', ['casingAlpha', 'casingPx', 'fillAlpha', 'fillTo']], ['Showing', ['hold', 'on', 'route', 'noRoute']]],
        advanced: [['In-between lines', ['minor', 'minorAlpha', 'minorWidth']], ['Details', ['minGapPx', 'fadeMs', 'fadeOutMs', 'lift']]] }),
      onChange: (v) => { for (const k of keys) if (v[k] !== undefined && MOVE_RINGS_LOOK[k] !== v[k]) S.set(k, v[k]); },
      extra: '<small class="lk-hint">Drag a pawn to see them (tick Hold to keep them up). This browser only: nothing is sent. Copy settings (Advanced) gives the JSON to hand over.</small>',
    });
    panel.el('[data-role="useDefault"]').hidden = true; panel.el('[data-role="name"]').closest('label').hidden = true; panel.el('[data-role="preset"]').closest('label').hidden = true; panel.el('[data-role="loadPreset"]').hidden = true;
    for (const k of keys) if (panel.settings()[k] !== MOVE_RINGS_LOOK[k]) S.set(k, panel.settings()[k]);
    lab = { drawer, panel };
    return lab;
  }
  S.tuner = () => open();
  S.tunerPanel = () => lab?.panel || null; // (tests)
  R.add({ id: 'view.moveRingsTuner', title: 'Movement rings tuner (sliders for how the rings look; this browser only)', short: 'Movement rings tuner', synonyms: ['movement rings', 'move rings tuner', 'move rings', 'tune rings', 'ring tuner', 'topo rings', 'move distance rings'], icon: 'ruler', group: 'View', run: () => open() });
}
