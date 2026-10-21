// WATER: still water in vessels, interactive ripples, and flowing water bodies (rivers, canals, streams, ponds).
// Shared by the Spawn Tuner (the "Water" panel, via fx/index.js) and the game (engine/client imports fx/index.js from
// the deployed tuner; the house look's `water` comes from GET /tuner/house). Harry 2026-10-04: "let's try the pool
// demo. For today let's stay on WebGL ... some water in a bucket or something, but there will be rivers, canals ...
// let's get something good" (bar: "super duper class A+"). Built from the techniques of three.js's MIT examples
// (webgl_gpgpu_water heightfield, Water2/flowmap two-phase advection) and the published pool-demo ideas (Evan Wallace's
// WebGL Water: heightfield + refraction + caustics; technique only, none of its code). No third-party code is vendored.
//
//   vessels   every placed thing whose MESH has a water record gets a surface clipped to its footprint at its level.
//             Records: the Alignment Bench's (GET /tuner/water_surfaces, kind water_surface, keyed by mesh, normalised
//             to the GLB's own bbox) win; else data/water_auto.json (prep/water_auto.py: the bench's own auto fit run
//             headlessly over its queue). The surface mesh follows the mesh root's world matrix every frame, so spawn
//             animations, settling, drags and LOD swaps carry it.
//   bodies    placeable water: a spline CHANNEL (river, canal, stream; flow along the spline) or a POLYGON (millpond;
//             optional drift). Its own bed (bank gradient), wet banks, foam at the banks and at anything standing in it.
//   ripples   one GPGPU heightfield atlas (ping-pong half-float targets, webgl_gpgpu_water's update rule) split into
//             blocks; a surface gets a block while something disturbs it (cursor, a dragged / dropped / wading thing,
//             touch()), with its own boundary (ripples bounce off the bucket wall) and, for bodies, advection along the
//             flow. Idle surfaces use an analytic wave field (sum of directional sines: normals, and caustic focus from
//             its Laplacian), so a room of buckets costs nothing to simulate.
//   render    a pass in the post stack right after the scene render (before contact shadows and the atmosphere):
//             copy the frame (half res on laptop) as the refraction source, then draw every surface INTO the frame with
//             the scene depth: depth-tinted absorption, refraction of what is below, caustics on the floor seen through
//             the water, Fresnel reflection (room/sky + screen-space reflection on bodies) and the fire lights' glints
//             on the rippled normal, a meniscus at the walls. The pass writes depth, so contact shadows and fog see the
//             water. With Lighting FX off it draws alpha-blended (no refraction source).
import * as THREE from 'three';
import { Pass } from 'postprocessing';

export const WATER_DEFAULTS = {
  fx: 'water', name: 'well-water', on: true,
  color: { shallow: '#7fb8a8', deep: '#1b4a50', clarity: 0.72, scatter: 0.45 },
  surface: { reflect: 0.55, refract: 0.5, gloss: 0.88, glints: 1, meniscus: 0.3 },
  ripples: { size: 1, speed: 1, damping: 0.65, idle: 0.2, interaction: 1 },
  flow: { speed: 1, foam: 0.4, bank: 0.6, bed: '#5a4a36' },
  caustics: { amount: 0.6, scale: 1 },
  vessels: { on: true, auto: true },
  quality: { level: 'laptop' },
};
const T = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
export const WATER_SCHEMA = [
  ['Colour & depth', 'color', [
    { k: 'shallow', label: 'Shallow colour', type: 'color' },
    { k: 'deep', label: 'Deep colour', type: 'color' },
    T('clarity', 'Clarity (murky ↔ clear)', 0, 1, 0.01),
    T('scatter', 'Glow of the deep colour', 0, 1, 0.01),
  ]],
  ['Surface', 'surface', [
    T('reflect', 'Reflection strength', 0, 1, 0.01),
    T('refract', 'Refraction (bend what is below)', 0, 1, 0.01),
    T('gloss', 'Gloss (sharp ↔ soft reflections)', 0, 1, 0.01),
    T('glints', 'Firelight glints', 0, 2, 0.05),
    T('meniscus', 'Meniscus / edge highlight', 0, 1, 0.01),
  ]],
  ['Ripples', 'ripples', [
    T('size', 'Ripple size', 0.3, 3, 0.05, '×'),
    T('speed', 'Ripple speed', 0.25, 2, 0.05, '×'),
    T('damping', 'Damping (long-lived ↔ quick to settle)', 0, 1, 0.01),
    T('idle', 'Idle ripples (breeze)', 0, 1, 0.01),
    T('interaction', 'Interaction strength (cursor, things, pawns)', 0, 2, 0.05),
  ]],
  ['Flow: rivers, canals, ponds', 'flow', [
    T('speed', 'Flow speed', 0, 3, 0.05, '×'),
    T('foam', 'Foam amount', 0, 1, 0.01),
    T('bank', 'Bank gradient (shelving ↔ steep)', 0, 1, 0.01),
    { k: 'bed', label: 'Bed colour', type: 'color' },
  ]],
  ['Caustics', 'caustics', [
    T('amount', 'Caustics on the floor', 0, 1.5, 0.01),
    T('scale', 'Caustic pattern size', 0.3, 3, 0.05, '×'),
  ]],
  ['Vessels', 'vessels', [
    { k: 'on', label: 'Water in vessels (Alignment Bench records)', type: 'check' },
    { k: 'auto', label: 'Fill vessels without a bench record (automatic fit)', type: 'check' },
  ]],
  ['Quality', 'quality', [
    { k: 'level', label: 'Quality', type: 'select', options: [['low', 'low (old laptop)'], ['laptop', 'laptop (default)'], ['high', 'high (desktop GPU)']] },
  ]],
];
const W = (o) => () => { const p = JSON.parse(JSON.stringify(WATER_DEFAULTS)); for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object' && p[k]) Object.assign(p[k], v); else p[k] = v; return p; };
export const WATER_BUILTINS = {
  'well-water': W({ name: 'well-water' }),
  'clear-stream': W({ name: 'clear-stream', color: { shallow: '#a9d6c8', deep: '#1d5b5e', clarity: 0.85, scatter: 0.25 }, surface: { reflect: 0.6, refract: 0.65, gloss: 0.9, glints: 1, meniscus: 0.4 },
    ripples: { size: 1, speed: 1.2, damping: 0.5, idle: 0.45, interaction: 1 }, flow: { speed: 1.4, foam: 0.6, bank: 0.55, bed: '#7a6a4e' }, caustics: { amount: 0.9, scale: 1 } }),
  'murky-canal': W({ name: 'murky-canal', color: { shallow: '#6f7a4a', deep: '#252b18', clarity: 0.12, scatter: 0.55 }, surface: { reflect: 0.7, refract: 0.2, gloss: 0.8, glints: 0.8, meniscus: 0.3 },
    ripples: { size: 1.3, speed: 0.8, damping: 0.35, idle: 0.15, interaction: 1 }, flow: { speed: 0.35, foam: 0.25, bank: 0.85, bed: '#3b3424' }, caustics: { amount: 0.1, scale: 1.4 } }),
  'millpond-night': W({ name: 'millpond-night', color: { shallow: '#3c5a63', deep: '#0a1820', clarity: 0.45, scatter: 0.2 }, surface: { reflect: 1, refract: 0.35, gloss: 0.96, glints: 1.6, meniscus: 0.35 },
    ripples: { size: 1.4, speed: 0.8, damping: 0.75, idle: 0.12, interaction: 1.2 }, flow: { speed: 0.15, foam: 0.15, bank: 0.4, bed: '#2a2620' }, caustics: { amount: 0.35, scale: 1.2 } }),
  'rain-barrel': W({ name: 'rain-barrel', color: { shallow: '#7d7a52', deep: '#262818', clarity: 0.45, scatter: 0.3 }, surface: { reflect: 0.85, refract: 0.3, gloss: 0.94, glints: 1.3, meniscus: 0.6 },
    ripples: { size: 0.8, speed: 1, damping: 0.65, idle: 0.08, interaction: 1.1 }, caustics: { amount: 0.25, scale: 0.8 } }),
  'off': W({ name: 'off', on: false }),
};

const QUALITY = {
  low: { atlas: 512, grab: 0.5, ssr: 0, waves: 4, steps: 1 },
  laptop: { atlas: 1024, grab: 0.5, ssr: 10, waves: 6, steps: 2 },
  high: { atlas: 1024, grab: 1, ssr: 20, waves: 8, steps: 3 },
};
const G = 4;                 // atlas blocks per side
const MAXL = 8;              // lights the surface shader sees
const MAX_DROPS = 16;
const SMALL_FT = 1.25;       // a vessel whose footprint is under this (ft, longest side) renders with the cheap program
const EDGE_REACH = 1.0;      // how much of the bench's inset (its clearance from the wall) the surface takes back: all
// objects whose auto fit must not be trusted without Harry's bench record (lids, food, stew)
const AUTO_SKIP = /^(barrel|cauldron|washboard-tub)$/;

// ---------------------------------------------------------------- geometry helpers
const area2 = (P) => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function segDist(px, pz, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1e-9; const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L)); return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz); }
const polyDist = (x, z, P) => { let d = Infinity; for (let i = 0; i < P.length; i++) d = Math.min(d, segDist(x, z, P[i], P[(i + 1) % P.length])); return d; };
function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
// grow a convex outline (feet) by d: every edge moves out parallel to itself (corners meet where the moved edges do,
// clamped to 3d so a sliver corner cannot spike)
function outset(P, d) {
  if (P.length < 3 || !d) return P.map(p => p.slice());
  if (area2(P) < 0) P = P.slice().reverse();
  const n = P.length, L = [];
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1; L.push({ p: [a[0] + ez / l * d, a[1] - ex / l * d], v: [ex / l, ez / l] }); }
  return P.map((p, i) => {
    const l1 = L[(i - 1 + n) % n], l2 = L[i], den = l1.v[0] * l2.v[1] - l1.v[1] * l2.v[0];
    let q = Math.abs(den) < 1e-9 ? l2.p : (() => { const t = ((l2.p[0] - l1.p[0]) * l2.v[1] - (l2.p[1] - l1.p[1]) * l2.v[0]) / den; return [l1.p[0] + l1.v[0] * t, l1.p[1] + l1.v[1] * t]; })();
    const dx = q[0] - p[0], dz = q[1] - p[1], m = Math.hypot(dx, dz); if (m > 3 * d) q = [p[0] + dx / m * 3 * d, p[1] + dz / m * 3 * d];
    return q;
  });
}

// a star-shaped surface over a closed outline (feet, local xz): rings from the outline to the centroid, so the edge
// distance (aEdge, ft) and the bank depth interpolate inside. outer: an extra ring OUTSIDE the outline (wet bank).
function ringSurface(P, { y = 0, outer = 0, depth = 0, slope = 1 } = {}) {
  if (area2(P) < 0) P = P.slice().reverse();
  const n = P.length, cx = P.reduce((s, p) => s + p[0], 0) / n, cz = P.reduce((s, p) => s + p[1], 0) / n;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const rings = [...(outer > 0 ? [-1] : []), 1, 0.985, 0.95, 0.88, 0.75, 0.55, 0.3, 0];
  const pos = [], edge = [], sim = [], dep = [], flow = [], idx = [];
  const ring = [];
  for (const s of rings) {
    const r = [];
    for (let i = 0; i < (s === 0 ? 1 : n); i++) {
      let x, z;
      if (s === 0) { x = cx; z = cz; } else if (s === -1) { const dx = P[i][0] - cx, dz = P[i][1] - cz, L = Math.hypot(dx, dz) || 1; x = P[i][0] + dx / L * outer; z = P[i][1] + dz / L * outer; } else { x = cx + (P[i][0] - cx) * s; z = cz + (P[i][1] - cz) * s; }
      const e = s === -1 ? -outer : polyDist(x, z, P) * (s === 1 ? 0 : 1);
      r.push(pos.length / 3); pos.push(x, y, z); edge.push(e);
      sim.push((x - x0) / Math.max(1e-6, x1 - x0), (z - z0) / Math.max(1e-6, z1 - z0));
      dep.push(depth * Math.min(1, Math.max(0, e) / Math.max(0.05, slope)) ** 0.7); flow.push(0, 0);
    }
    ring.push(r);
  }
  for (let k = 0; k < ring.length - 1; k++) {
    const A = ring[k], B = ring[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (B.length === 1) idx.push(A[i], B[0], A[j]);
      else idx.push(A[i], B[i], A[j], A[j], B[i], B[j]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('aSim', new THREE.Float32BufferAttribute(sim, 2));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  g.setAttribute('aSV', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere();
  return { geo: g, bbox: [x0, z0, x1, z1], c: [cx, cz] };
}

// centripetal Catmull-Rom through [[x, z]...] sampled every `step` ft: [{p, t}] (point, unit tangent)
export function sampleSpline(pts, step = 0.5) {
  if (pts.length < 2) return [];
  const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[pts.length - 1].map((v, i) => 2 * v - pts[pts.length - 2][i])];
  const out = [];
  for (let s = 1; s < P.length - 2; s++) {
    const [p0, p1, p2, p3] = [P[s - 1], P[s], P[s + 1], P[s + 2]];
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(1, Math.ceil(L / step));
    const tj = (a, b) => Math.sqrt(Math.max(1e-6, Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    const at = (t) => { // Barry-Goldman
      const L1 = (a, b, ta, tb) => [0, 1].map(i => (tb - t) / (tb - ta) * a[i] + (t - ta) / (tb - ta) * b[i]);
      const A1 = L1(p0, p1, t0, t1), A2 = L1(p1, p2, t1, t2), A3 = L1(p2, p3, t2, t3);
      const B1 = L1(A1, A2, t0, t2), B2 = L1(A2, A3, t1, t3);
      return L1(B1, B2, t1, t2);
    };
    for (let k = s === 1 ? 0 : 1; k <= n; k++) out.push(at(t1 + (t2 - t1) * k / n));
  }
  return out.map((p, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return { p, t: [dx / L, dz / L] }; });
}

// how fast a channel runs across its width (0 = at the bank, 1 = mid-stream), as a fraction of its speed
export const flowProfile = (c) => c <= 0 ? 0 : 0.3 + 0.7 * Math.sqrt(Math.min(1, c));
// a channel ribbon: columns across the channel from wet bank to wet bank. aEdge = ft from the nearer bank (negative on
// the wet bank), aFlow = the spline tangent (unit; the shader scales it by the body's speed), aDepth = the bank profile
function channelSurface(pts, { width = 6, y = 0, depth = 2, slope = 1.5, outer = 1 } = {}) {
  const S = sampleSpline(pts, Math.max(0.25, width / 10));
  const hw = width / 2, cols = [-(hw + outer), -hw, -hw * 0.85, -hw * 0.6, -hw * 0.3, 0, hw * 0.3, hw * 0.6, hw * 0.85, hw, hw + outer];
  const pos = [], edge = [], sim = [], dep = [], flow = [], idx = [], sv = [];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  let arc = 0; const arcs = S.map((q, i) => (arc += i ? Math.hypot(q.p[0] - S[i - 1].p[0], q.p[1] - S[i - 1].p[1]) : 0));
  for (const { p } of S) { x0 = Math.min(x0, p[0] - hw - outer); x1 = Math.max(x1, p[0] + hw + outer); z0 = Math.min(z0, p[1] - hw - outer); z1 = Math.max(z1, p[1] + hw + outer); }
  S.forEach(({ p, t }, si) => {
    const nx = -t[1], nz = t[0];
    for (const c of cols) {
      sv.push(arcs[si], c);
      const x = p[0] + nx * c, z = p[1] + nz * c, e = hw - Math.abs(c);
      pos.push(x, y, z); edge.push(e); sim.push((x - x0) / (x1 - x0), (z - z0) / (z1 - z0));
      const k = flowProfile(e / hw); dep.push(depth * Math.min(1, Math.max(0, e) / Math.max(0.05, slope)) ** 0.7); flow.push(t[0] * k, t[1] * k);
    }
  });
  const C = cols.length;
  for (let i = 0; i < S.length - 1; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, b = a + 1, c = a + C, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  g.setAttribute('aSim', new THREE.Float32BufferAttribute(sim, 2));
  g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
  g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  g.setAttribute('aSV', new THREE.Float32BufferAttribute(sv, 2));
  g.setIndex(idx); g.computeBoundingBox(); g.computeBoundingSphere();
  return { geo: g, bbox: [x0, z0, x1, z1], samples: S };
}

// ---------------------------------------------------------------- shaders
const FS_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COPY_FRAG = `uniform sampler2D tSrc; varying vec2 vUv; void main() { gl_FragColor = texture2D(tSrc, vUv); }`;
// the heightfield step (webgl_gpgpu_water's rule: velocity += (neighbour mean - height) * 2; damped), per block:
// clamp to the block, optional semi-Lagrangian advection along the block's flow, an elliptic boundary, drops
const SIM_FRAG = `precision highp float;
  uniform sampler2D uPrev; uniform sampler2D uMap; uniform sampler2D uFlow; uniform vec2 uTexel; uniform float uG;
  uniform vec4 uRect[16]; uniform vec4 uMask[16]; uniform vec4 uPar[16];
  uniform vec4 uDrops[${MAX_DROPS}]; uniform float uDropB[${MAX_DROPS}]; uniform int uND;
  varying vec2 vUv;
  void main() {
    vec2 cell = floor(vUv * uG);
    float bid = floor(texture2D(uMap, (cell + 0.5) / uG).r * 255.0 + 0.5);
    if (bid > 15.5) { gl_FragColor = vec4(0.0); return; }
    int b = int(bid);
    vec4 R = uRect[b]; vec4 P = uPar[b];
    vec2 lo = R.xy + uTexel * 0.5, hi = R.xy + R.zw - uTexel * 0.5;
    vec2 p = clamp(vUv - texture2D(uFlow, vUv).xy, lo, hi);
    vec4 info = texture2D(uPrev, p);
    float hl = texture2D(uPrev, clamp(p - vec2(uTexel.x, 0.0), lo, hi)).r;
    float hr = texture2D(uPrev, clamp(p + vec2(uTexel.x, 0.0), lo, hi)).r;
    float hd = texture2D(uPrev, clamp(p - vec2(0.0, uTexel.y), lo, hi)).r;
    float hu = texture2D(uPrev, clamp(p + vec2(0.0, uTexel.y), lo, hi)).r;
    float avg = (hl + hr + hd + hu) * 0.25;
    info.g += (avg - info.r) * 2.0 * P.z;
    info.g *= P.w;
    info.r += info.g;
    info.r = mix(info.r, avg, 0.04); // a little viscosity: no checkerboard, no fine trailing 'fingerprint' ripples
    info.r *= 0.9995;
    vec2 q = (vUv - R.xy) / R.zw; vec4 M = uMask[b];
    if (M.z > 0.0) { vec2 e = (q - M.xy) / M.zw; if (dot(e, e) > 1.0) info.rg = vec2(0.0); }
    else if (M.z < 0.0) { vec2 e = abs(q - M.xy) / abs(M.zw); if (max(e.x, e.y) > 1.0) info.rg = vec2(0.0); }
    for (int i = 0; i < ${MAX_DROPS}; i++) {
      if (i >= uND) break;
      if (abs(uDropB[i] - bid) > 0.5) continue;
      vec4 d = uDrops[i];
      float r = length(vUv - d.xy) / d.z;
      if (r < 1.0) info.r += d.w * (0.5 + 0.5 * cos(3.14159265 * r));
    }
    gl_FragColor = info;
  }`;

const SURF_VERT = `
  attribute float aEdge; attribute vec2 aSim; attribute float aDepth; attribute vec2 aFlow; attribute vec2 aSV;
  varying vec3 vW; varying float vEdge; varying vec2 vSim; varying float vDepthA; varying vec2 vFlow; varying float vViewZ; varying vec2 vSV;
  void main() {
    vSV = aSV;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vEdge = aEdge; vSim = aSim; vDepthA = aDepth;
    vFlow = (modelMatrix * vec4(aFlow.x, 0.0, aFlow.y, 0.0)).xz;
    vec4 v = viewMatrix * w; vViewZ = -v.z;
    gl_Position = projectionMatrix * v;
  }`;
const SURF_FRAG = `
  #include <packing>
  uniform float uTime; uniform float uGrabOn; uniform sampler2D uGrab; uniform sampler2D uDepthTex; uniform vec2 uRes; uniform vec2 uNF;
  uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uBed; uniform float uAbsorb; uniform float uScatter;
  uniform float uReflect; uniform float uRefract; uniform float uRough; uniform float uGlints; uniform float uMeniscus;
  uniform float uCaustics; uniform float uCScale; uniform float uIdle; uniform float uWaveK; uniform float uFoam; uniform float uFlowSpeed; uniform float uSpeed;
  uniform vec3 uEnvSky; uniform vec3 uEnvLow; uniform vec3 uAmbient; uniform vec3 uSunDir; uniform vec3 uSunCol;
  uniform vec4 uLPos[${MAXL}]; uniform vec4 uLCol[${MAXL}]; uniform int uNL;
  uniform sampler2D uSim; uniform vec4 uSimRect; uniform vec2 uSimTexel; uniform float uSimOn; uniform vec3 uAxU; uniform vec3 uAxV; uniform float uSimAmp;
  uniform float uDebug; uniform float uGroundY; uniform float uWaveScale; uniform float uDepthFt; uniform float uBody; uniform float uOpacity; uniform mat4 uProj; uniform mat4 uView;
  varying vec3 vW; varying float vEdge; varying vec2 vSim; varying float vDepthA; varying vec2 vFlow; varying float vViewZ; varying vec2 vSV;
  uniform float uChannel;

  // analytic wave field: (height, d/dx, d/dz, laplacian) of a sum of directional sines (ft)
  vec4 waves(vec2 p, float t, int n, float px) {
    vec4 r = vec4(0.0);
    // a slow domain warp bends the wave fronts so they never form a lattice (the warp's own Jacobian is ignored)
    float wl = 6.2832 / (uWaveK * uWaveScale);
    p += wl * 0.55 * vec2(sin(p.y / wl * 0.71 + t * 0.23) + 0.6 * sin(p.x / wl * 0.37 - t * 0.17), cos(p.x / wl * 0.67 - t * 0.19) + 0.6 * cos(p.y / wl * 0.43 + t * 0.29));
    // irregular directions and wavelengths (no two commensurate), so neither the glints nor the caustics tile
    const float KM[8] = float[8](1.0, 1.37, 1.79, 2.23, 2.81, 3.47, 4.31, 5.29);
    const float AN[8] = float[8](0.31, 2.62, 4.37, 1.27, 5.51, 3.39, 0.83, 4.96);
    for (int i = 0; i < 8; i++) {
      if (i >= n) break;
      float fi = float(i);
      float ang = AN[i];
      vec2 d = vec2(cos(ang), sin(ang));
      float k = uWaveK * uWaveScale * KM[i];
      // a wave smaller than a few pixels is noise, not detail: fade it (the pixel footprint px, ft)
      float slope = 0.055 / (1.0 + 0.45 * fi) * smoothstep(3.0 * px, 8.0 * px, 6.2832 / k);
      float a = slope / k;
      float w = sqrt(32.0 * k) * 0.35 * uSpeed * mix(1.0, 0.2, uBody);
      float ph = dot(d, p) * k - w * t + fi * 1.913;
      float s = sin(ph), c = cos(ph);
      r += vec4(a * s, a * k * c * d.x, a * k * c * d.y, -a * k * k * s);
    }
    return r;
  }
  // flowing water: the field advected along the local flow, two phases cross-faded (the flowmap technique)
  vec4 flowWaves(vec2 p, vec2 flow, float t, int n, float px) {
    if (dot(flow, flow) < 1e-6) return waves(p, t, n, px);
    float T = 6.0, f0 = fract(t / T), f1 = fract(t / T + 0.5), wgt = abs(1.0 - 2.0 * f0);
    vec4 a = waves(p - flow * f0 * T, t, n, px), b = waves(p - flow * f1 * T + 13.7, t, n, px);
    return mix(b, a, wgt);
  }
  // a hash without sin() (the pattern of Dave Hoskins' hash12, MIT): stays good far from the origin, where a sin-hash
  // falls apart into streaks (the demo yard is ~250 ft out)
  float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float simH(vec2 uv) { return texture2D(uSim, uSimRect.xy + clamp(uv, 0.0, 1.0) * uSimRect.zw).r; }
  float viewZAt(vec2 suv) { float d = texture2D(uDepthTex, suv).r; return -perspectiveDepthToViewZ(d, uNF.x, uNF.y); }
  vec3 lightAt(vec3 p, vec3 n) {
    vec3 c = uAmbient + uSunCol * max(0.0, dot(n, uSunDir));
    for (int i = 0; i < ${MAXL}; i++) {
      if (i >= uNL) break;
      vec3 L = uLPos[i].xyz - p; float d = length(L); L /= d;
      float rng = uLPos[i].w; float att = 1.0 / max(d * d, 0.25);
      if (rng > 0.0) { float x = d / rng; att *= pow(clamp(1.0 - x * x * x * x, 0.0, 1.0), 2.0); }
      c += uLCol[i].rgb * att * max(0.0, dot(n, L));
    }
    return c;
  }
  float ggx(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }

  void main() {
    vec3 V = normalize(cameraPosition - vW);
    vec2 suv = gl_FragCoord.xy / uRes;
    float bank = vEdge;                       // ft from the outline (negative: wet bank outside a body)
    float inWater = step(0.0, bank);
    // ---- normal: idle field (+ flow) and the ripple heightfield
    vec2 flow = vFlow * uFlowSpeed;
    float px = max(1e-4, length(fwidth(vW.xz)));
    // a channel's surface lives in its own (arc length, across) frame, drifting as ONE rigid layer at the mid-stream
    // pace: the waves, caustics, current lines and foam all travel downstream instead of morphing in place. The
    // tangent comes from the screen-space gradient of the arc length (the bank columns carry no flow vector)
    vec2 tdir = vec2(1.0, 0.0), ndir = vec2(0.0, 1.0), chanP = vec2(0.0);
    if (uChannel > 0.5) {
      vec3 qx = dFdx(vW), qy = dFdy(vW); float sx = dFdx(vSV.x), sy = dFdy(vSV.x), dt = qx.x * qy.z - qx.z * qy.x;
      vec2 gS = abs(dt) > 1e-12 ? vec2(qy.z * sx - qx.z * sy, -qy.x * sx + qx.x * sy) / dt : vec2(1.0, 0.0);
      tdir = normalize(gS + 1e-6); ndir = vec2(-tdir.y, tdir.x);
      chanP = vec2(vSV.x - mod(uTime * uFlowSpeed * 0.85, 4096.0), vSV.y);
    }
    vec4 wv;
    if (uChannel > 0.5) { vec4 w = waves(chanP, uTime, WAVES, px); wv = vec4(w.x, w.y * tdir + w.z * ndir, w.w); }
    else wv = flowWaves(vW.xz, flow, uTime, WAVES, px);
    wv.yzw *= uIdle * mix(1.0, 0.45 + 0.55 * clamp(length(vFlow * uFlowSpeed), 0.0, 1.0), uBody);
    vec2 g = wv.yz; float lap = wv.w; vec2 gSim = vec2(0.0);
    if (uSimOn > 0.5) {
      float h = simH(vSim), hx = simH(vSim + vec2(uSimTexel.x, 0.0)), hx0 = simH(vSim - vec2(uSimTexel.x, 0.0));
      float hz = simH(vSim + vec2(0.0, uSimTexel.y)), hz0 = simH(vSim - vec2(0.0, uSimTexel.y));
      float du = (hx - hx0) / (2.0 * uSimTexel.x), dv = (hz - hz0) / (2.0 * uSimTexel.y);
      vec3 gw = (du * uAxU / dot(uAxU, uAxU) + dv * uAxV / dot(uAxV, uAxV)) * uSimAmp;
      g += gw.xz; gSim = gw.xz;
      float lu = (hx + hx0 - 2.0 * h) / (uSimTexel.x * uSimTexel.x) / dot(uAxU, uAxU), lv = (hz + hz0 - 2.0 * h) / (uSimTexel.y * uSimTexel.y) / dot(uAxV, uAxV);
      lap += (lu + lv) * uSimAmp;
    }
    vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
    float NoV = max(0.02, dot(N, V));
    // ---- what is below: real scene behind (depth) vs. the body's own bed
    float zS = vViewZ;
    float zB = uGrabOn > 0.5 ? viewZAt(suv) : zS + uDepthFt / max(0.2, V.y);
    float cosV = max(0.15, V.y);
    float bedPath = vDepthA / cosV;                       // bodies: path to the virtual bed
    float realPath = max(0.0, zB - zS);
    // bodies: is what the scene has behind the water the GROUND the body is cut into (-> draw its own bed) or a thing
    // standing in it (a crate, a pawn's legs: seen through the surface, foam around it)?
    vec3 Ps = cameraPosition + (vW - cameraPosition) * (zB / max(1e-3, zS));
    float thing = uBody * uGrabOn * step(uGroundY + 0.04, Ps.y);
    float useBed = uBody * (1.0 - thing);
    float near = 0.0; vec2 nearDir = vec2(0.0);
    if (uBody > 0.5 && uGrabOn > 0.5 && uFoam > 0.0) {   // anything standing within ~a foot: six depth taps around
      vec2 dzs = vec2(dFdx(vViewZ), dFdy(vViewZ));
      float kG = (cameraPosition.y - uGroundY) / max(0.01, cameraPosition.y - vW.y);
      float rpx = clamp((0.25 + 0.6 * uFoam) / max(1e-4, length(fwidth(vW.xz))), 1.0, 40.0);
      vec3 dpxw = dFdx(vW), dpyw = dFdy(vW);
      for (int i = 0; i < 6; i++) {
        float a = float(i) * 1.0472 + 0.3;
        vec2 o = vec2(cos(a), sin(a)) * rpx;
        float zt = viewZAt(suv + o / uRes), zg = (zS + dot(o, dzs)) * kG;
        float h = step(zt, zg - 0.15);
        near += h / 6.0; nearDir += h * normalize((dpxw * o.x + dpyw * o.y).xz + 1e-6); // the tap's direction on the ground
      }
    }
    float path = mix(realPath, bedPath, useBed);
    // refraction: offset the lookup along the rippled normal, more through deeper water, less far away
    vec3 Nv = (uView * vec4(N, 0.0)).xyz;
    vec2 off = Nv.xy * uRefract * 0.35 * clamp(path, 0.0, 1.5) / max(1.0, zS * 0.06);
    vec2 ruv = suv + off * inWater;
    vec3 below;
    float zR = zB;
    if (uGrabOn > 0.5) {
      zR = viewZAt(ruv);
      if (zR < zS) { ruv = suv; zR = zB; }               // the offset hit something in front of the water: don't refract it
      below = texture2D(uGrab, ruv).rgb;
    } else below = vec3(0.0);
    vec3 bedP = vW - V * path;                           // where the view ray meets the floor (ignoring the bend)
    if (useBed > 0.5) {
      vec2 bp = mod(bedP.xz, 256.0) + N.xz * vDepthA * 0.6 * uRefract;
      float n1 = vnoise(bp * 1.7), n2 = vnoise(bp * 6.3 + 7.1), peb = smoothstep(0.62, 0.7, vnoise(bp * 3.1 + 2.0));
      vec3 alb = uBed * (0.75 + 0.5 * n1) * (0.85 + 0.3 * n2) * (1.0 - 0.25 * peb);
      below = alb * lightAt(bedP, vec3(0.0, 1.0, 0.0));
    }
    // caustics: focus of the wave field at the floor point (light through a crest converges: 1 / (1 + depth * lap))
    if (uCaustics > 0.0) {
      vec4 wf, wg;
      if (uChannel > 0.5) { // (the channel frame: the light net drifts with the water)
        wf = waves(chanP * uCScale, uTime, CWAVES, px * uCScale);
        wg = waves(chanP * uCScale * 1.83 + 7.3, uTime * 1.13, CWAVES, px * uCScale * 1.83);
      } else {
        wf = flowWaves(bedP.xz * uCScale, flow, uTime, CWAVES, px * uCScale);
        // (two layers at different scales multiplied: the net of bright filaments real caustics have)
        wg = flowWaves(bedP.xz * uCScale * 1.83 + 7.3, flow * 1.1, uTime * 1.13, CWAVES, px * uCScale * 1.83);
      }
      float dz = clamp(path * cosV, 0.0, 3.0);
      float L1 = wf.w * uIdle * uCScale * uCScale + lap * 0.5, L2 = wg.w * uIdle * uCScale * uCScale * 1.83;
      float I = (1.0 / max(0.22, 1.0 + dz * L1 * 1.4)) * mix(1.0, 1.0 / max(0.3, 1.0 + dz * L2 * 0.5), 0.3);
      I = clamp(I, 0.35, 3.5);
      // (none in a film of water; deep water blurs them out)
      below *= mix(1.0, I, uCaustics * clamp(dz * 3.0, 0.0, 1.0) * exp(-dz * 0.9));
    }
    // ---- absorption (Beer-Lambert) and the deep colour, lit where the water is
    vec3 lit = lightAt(vW, vec3(0.0, 1.0, 0.0));
    float Tr = exp(-path * uAbsorb);
    // (any water tints what is under it a little, however shallow: an untinted film reads as a glass lid)
    vec3 tint = mix(vec3(1.0), uShallow / max(1e-3, max(uShallow.r, max(uShallow.g, uShallow.b))), 0.3 + 0.7 * (1.0 - exp(-path * uAbsorb)));
    vec3 deep = uDeep * (lit * 0.6 + uAmbient + 0.25 * uScatter) * (0.5 + 1.0 * uScatter);
    vec3 under = mix(deep, below * tint, Tr);
    // ---- reflection: room / sky gradient, screen-space reflection (bodies), fire glints
    vec3 R = reflect(-V, N);
    // (bodies lie outdoors under the sky; vessels stand under a roof the cut-away hides)
    vec3 refl = mix(uEnvLow, uEnvSky * mix(vec3(1.0), vec3(1.6, 1.85, 2.3), uBody), smoothstep(-0.1, 0.7, R.y));
    #if SSR > 0
    if (uGrabOn > 0.5) {
      vec3 p = vW; float stepL = 0.35; float hit = 0.0; vec2 huv = vec2(0.0);
      for (int i = 0; i < SSR; i++) {
        p += R * stepL; stepL *= 1.28;
        vec4 c = uProj * uView * vec4(p, 1.0); vec2 q = c.xy / c.w * 0.5 + 0.5;
        if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) break;
        float rz = -(uView * vec4(p, 1.0)).z, sz = viewZAt(q);
        if (rz > sz + 0.05 && rz < sz + 2.5 * stepL) { hit = 1.0; huv = q; break; }
      }
      if (hit > 0.5) { vec2 e = smoothstep(0.0, 0.12, huv) * smoothstep(1.0, 0.88, huv); refl = mix(refl, texture2D(uGrab, huv).rgb, e.x * e.y); }
    }
    #endif
    float F = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
    float wR = clamp(uReflect * (0.1 + 1.4 * F) * (1.0 + 0.15 * uBody), 0.0, 1.0);
    vec3 col = mix(under, refl, wR);
    vec3 spec = vec3(0.0), sheen = vec3(0.0);
    float a = uRough;
    vec3 R0 = reflect(-V, vec3(0.0, 1.0, 0.0));
    vec2 gs = gSim + wv.yz * 0.15;                      // the sheen answers the ripples, and only faintly the breeze
    vec3 Rs = reflect(-V, normalize(vec3(-gs.x, 1.0, -gs.y)));
    for (int i = 0; i < ${MAXL}; i++) {
      if (i >= uNL) break;
      vec3 L = uLPos[i].xyz - vW; float d = length(L); L /= d;
      float rng = uLPos[i].w; float att = 1.0 / max(d * d, 0.25);
      if (rng > 0.0) { float x = d / rng; att *= pow(clamp(1.0 - x * x * x * x, 0.0, 1.0), 2.0); }
      vec3 H = normalize(L + V); float NoL = max(0.0, dot(N, L)), NoH = max(0.0, dot(N, H));
      float Fl = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(H, V)), 5.0);
      // a sharp core and a broad streak (a fire is not a point)
      spec += uLCol[i].rgb * att * NoL * Fl * (ggx(NoH, a) + 0.5 * ggx(NoH, max(0.3, a * 6.0))) * 0.25 / max(0.1, NoV);
      // the room the light fills, mirrored: only the CHANGE the ripples make (flat water adds nothing)
      sheen += uLCol[i].rgb * att * (pow(max(0.0, dot(Rs, L)), 3.0) - pow(max(0.0, dot(R0, L)), 3.0));
    }
    { vec3 L = uSunDir; sheen += uSunCol * 0.5 * (pow(max(0.0, dot(Rs, L)), 3.0) - pow(max(0.0, dot(R0, L)), 3.0)); }
    sheen += (uEnvSky - uEnvLow) * 4.0 * (Rs.y - R0.y);
    { vec3 H = normalize(uSunDir + V); spec += uSunCol * max(0.0, dot(N, uSunDir)) * (0.02 + 0.98 * pow(1.0 - max(0.0, dot(H, V)), 5.0)) * ggx(max(0.0, dot(N, H)), a) * 0.25 / max(0.1, NoV); }
    col += spec * uGlints * inWater;
    col = max(vec3(0.0), col + sheen * (0.35 + 0.65 * uReflect) * 0.9 * inWater);
    // ---- meniscus: where the surface meets a wall (outline, or anything the depth says touches it)
    float touch = uGrabOn > 0.5 ? (1.0 - smoothstep(0.0, 0.06, realPath)) * (1.0 - useBed) : 0.0;
    // (a thin bright line where light catches the curved film, broken up by the ripples)
    float edgeLine = 1.0 - smoothstep(0.0, max(0.02, 2.5 * px), bank); // at least a couple of pixels at table distance
    // which way is "out" here (the edge distance's gradient, solved in the ground plane): the film climbing the FAR wall
    // faces the camera and catches the light; the near side all but vanishes (a uniform ring reads as a glass lid)
    vec3 dpx = dFdx(vW), dpy = dFdy(vW); float ebx = dFdx(bank), eby = dFdy(bank);
    float det = dpx.x * dpy.z - dpx.z * dpy.x;
    vec2 gIn = abs(det) > 1e-9 ? vec2(dpy.z * ebx - dpx.z * eby, -dpy.x * ebx + dpx.x * eby) / det : vec2(0.0);
    vec2 toCam = normalize(cameraPosition.xz - vW.xz + 1e-4);
    float far = length(gIn) > 1e-6 ? smoothstep(-0.3, 0.7, dot(normalize(gIn), toCam)) : 0.5;
    float men = max(edgeLine * (1.0 - uBody) * (0.15 + 0.85 * far), touch) * uMeniscus * inWater * (0.6 + 0.4 * clamp(g.x * 8.0 + 0.5, 0.0, 1.0));
    col += men * (refl * 1.2 + lit * 0.12 + uEnvSky * 0.6 + spec * 0.3);
    // ---- current lines (bodies): world noise averaged along the flow (4 taps), advected in two phases
    vec2 fdir = length(flow) > 1e-3 ? normalize(flow) : vec2(1.0, 0.0);
    float streak = 0.5;
    if (uBody > 0.5 && length(flow) > 1e-3) {
      float ST = 8.0, s0 = fract(uTime / ST), s1 = fract(uTime / ST + 0.5), sw = abs(1.0 - 2.0 * s0);
      vec2 b0 = mod(vW.xz, 256.0) - flow * s0 * ST, b1 = mod(vW.xz, 256.0) - flow * s1 * ST + 31.7;
      if (uChannel > 0.5) { // a channel: (arc length, across) drift as ONE rigid layer at the mid-stream pace: features travel
        b0 = vec2(vSV.x - mod(uTime * uFlowSpeed * 0.85, 256.0), vSV.y) + 50.0; b1 = b0; sw = 1.0;
      }
      float a0 = 0.0, a1 = 0.0;
      for (int i = 0; i < 4; i++) { vec2 st = fdir * (float(i) - 1.5) * 0.45; a0 += vnoise((b0 + st) * vec2(2.2)); a1 += vnoise((b1 + st) * vec2(2.2)); }
      streak = mix(a1, a0, sw) * 0.25;
      float cl = clamp(length(flow), 0.0, 1.0);
      col *= 1.0 + (streak - 0.5) * 0.3 * cl * inWater;
      col += refl * smoothstep(0.62, 0.8, streak) * 0.12 * cl * inWater;
      // flecks: sparse bits of foam riding the current mid-stream (the plainest cue that a river moves)
      float k0 = vnoise(b0 * 5.3 + 5.0) * vnoise(b0 * 1.7 + 2.0), k1 = vnoise(b1 * 5.3 + 5.0) * vnoise(b1 * 1.7 + 2.0);
      // (threshold each phase, THEN cross-fade: thresholding the mix makes every fleck vanish at once mid-fade)
      float fleck = mix(smoothstep(0.66, 0.74, k1), smoothstep(0.66, 0.74, k0), sw) * smoothstep(0.3, 1.2, bank) * cl * clamp(uFoam * 2.0, 0.0, 1.0);
      col = mix(col, vec3(0.75, 0.77, 0.75) * (lit * 0.3 + uAmbient * 0.35) + refl * 0.3, fleck * 0.55 * inWater);
    }
    // ---- foam (bodies): at the banks and around anything standing in the stream, streaked along the flow
    if (uBody > 0.5 && uFoam > 0.0) {
      // two phases cross-faded (as the waves): the foam drifts with the flow forever without stretching
      float FT = 8.0, p0 = fract(uTime / FT), p1 = fract(uTime / FT + 0.5), fw = abs(1.0 - 2.0 * p0);
      // (world-aligned noise, only translated by the flow: rotating it into each point's flow frame about the world
      // origin turns tiny direction changes into big coordinate jumps, i.e. streaks)
      vec2 base = mod(vW.xz, 256.0);
      vec2 qa = base - flow * p0 * FT, qb = base - flow * p1 * FT + 17.3;
      if (uChannel > 0.5) { qa = vec2(vSV.x - mod(uTime * uFlowSpeed * 0.85, 256.0), vSV.y) + 90.0; qb = qa; fw = 1.0; }
      float na = vnoise(qa * 1.3) * 0.65 + vnoise(qa * 3.3 + 3.3) * 0.35;
      float nb = vnoise(qb * 1.3) * 0.65 + vnoise(qb * 3.3 + 3.3) * 0.35;
      float fn = mix(nb, na, fw);
      fn = mix(fn, streak, 0.35 * clamp(length(flow), 0.0, 1.0)); // foam drawn out along the current
      float lace = mix(vnoise(qb * 6.3 + 9.1), vnoise(qa * 6.3 + 9.1), fw);
      float atBank = 1.0 - smoothstep(0.0, 0.4 + 1.1 * uFoam, bank);
      // which side of the thing are we? upstream: a bow of foam; downstream: a wake drawn out along the current
      float bow = length(nearDir) > 1e-3 && length(flow) > 1e-3 ? dot(normalize(nearDir), fdir) : 0.0;
      float atThing = max(thing * (1.0 - smoothstep(0.0, 0.3, vW.y - Ps.y)), clamp(near * 2.0, 0.0, 1.0) * (0.55 + 0.7 * max(0.0, bow) + 0.5 * max(0.0, -bow) * streak));
      // foam wherever the drive (banks, things, faster water) beats a smooth noise field: soft blobby clumps whose
      // inner edge follows the noise's contours, laced with holes
      float drive = max(atBank * 0.85 * (0.2 + 0.8 * clamp(length(flow), 0.0, 1.0)), atThing * (0.75 + 0.25 * clamp(length(flow), 0.0, 1.0)));
      float fm = smoothstep(fn - 0.16, fn + 0.12, drive * (0.55 + 0.6 * uFoam)) * (0.45 + 0.55 * smoothstep(0.3, 0.7, lace)) * clamp(uFoam * 2.0, 0.0, 1.0);
      if (uDebug > 9.5) { gl_FragColor = vec4(vec3(uDebug < 10.5 ? drive : uDebug < 11.5 ? fn : near) * 0.4, 1.0); return; }
      col = mix(col, vec3(0.75, 0.77, 0.75) * (lit * 0.3 + uAmbient * 0.35) + spec * 0.2, fm * 0.85 * inWater);
    }
    // a soft outline (the meniscus already brightened it)
    float ea = smoothstep(0.0, uBody > 0.5 ? 0.06 : 0.012, bank);
    vec3 orig = uGrabOn > 0.5 ? texture2D(uGrab, suv).rgb : vec3(0.0);
    if (bank < 0.0) {
      // outside the water on a body: the wet bank (darkened ground)
      float wet = 1.0 - clamp(-bank, 0.0, 1.0);
      gl_FragColor = uGrabOn > 0.5 ? vec4(orig * mix(1.0, 0.55, wet * wet), 1.0) : vec4(0.0, 0.0, 0.0, 0.45 * wet * wet);
    } else if (uGrabOn > 0.5) {
      gl_FragColor = vec4(mix(orig, col, ea), 1.0);
    } else {
      gl_FragColor = vec4(col, ea * uOpacity * (1.0 - Tr * 0.7));
    }
    if (uDebug > 0.5) { // debug views (fx.water.debug(n)): 1 path, 2 what is below, 3 normal, 4 scene depth, 5 caustic focus
      vec3 dv = uDebug < 1.5 ? vec3(path / 3.0) : uDebug < 2.5 ? below : uDebug < 3.5 ? N * 0.5 + 0.5 : uDebug < 4.5 ? vec3(fract(zB / 10.0), fract(zS / 10.0), 0.0) : uDebug < 5.5 ? vec3(0.5 + lap * 0.05)
        : uDebug < 6.5 ? under : uDebug < 7.5 ? refl * wR : uDebug < 8.5 ? spec * uGlints : vec3(men);
      gl_FragColor = vec4(dv * 0.4, 1.0); // (the post stack's exposure follows)
    }
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// ---------------------------------------------------------------- the module
export function createWater({ renderer, scene, camera, hemi = null, sun = null, items = () => [], movers = () => [], meshOf = () => null, api = '/api/tw-ratings', dataBase = 'data/', canvas = null, focus = () => null, plainVessels = false }) {
  let P = JSON.parse(JSON.stringify(WATER_DEFAULTS));
  let Q = QUALITY.laptop;
  let lite = false; // (setLite, below)
  // THE WATER EFFECTS RUN ONLY FOR WATER WORTH THEM (Harry 2026-10-11). `wide` = this frame has a water BODY (a river,
  // a canal, a pond, a lake) inside the view. Only then: the ripple simulation steps, the frame is copied for
  // refraction, the surfaces are drawn through it with traced reflections. Otherwise whatever water is visible is drawn
  // the plain way (one blended draw, no copy, no simulation), and with no water visible nothing runs at all.
  // plainVessels (the game): a cup, a barrel, a trough or a font never switches the effects on by itself and never
  // ripples. (The tuner leaves it off: its Water panel is where vessel ripples are tuned.)
  // No program depends on which way a surface is drawn (blending and depth-write are GL state), and a new body's
  // program is built in the background when the body is made, so water coming into view compiles nothing.
  let wide = false;
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _bx = new THREE.Box3();
  function wideNow() {
    if (!P.on || lite) return false;
    if (!plainVessels) for (const v of vessels.values()) if (v.mesh.visible) return true;
    if (!bodies.size) return false;
    camera.updateMatrixWorld(); _pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    for (const b of bodies.values()) { if (!b.mesh.visible) continue; const [x0, z0, x1, z1] = b.bbox, y = b.def.y ?? 0.08; _bx.min.set(x0, y - 4, z0); _bx.max.set(x1, y + 1, z1); _bx.applyMatrix4(b.mesh.matrixWorld); if (_fr.intersectsBox(_bx)) return true; }
    return false;
  }
  const wscene = new THREE.Scene(); wscene.name = 'water'; wscene.matrixWorldAutoUpdate = true;
  const size = new THREE.Vector2(1, 1);
  const stats = { vessels: 0, small: 0, bodies: 0, draw_calls: 0, sim_blocks: 0, cpu_ms: 0, sim_steps: 0, drops: 0, grab: '' };
  const gl = renderer.getContext();
  // GPU timers (as atmos.js): the sim steps and the pass, smoothed; skipped while a bench times the whole frame
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2'), gpu = { sim: null, draw: null }, pending = [];
  const tBegin = (label) => { if (!tq || globalThis.__gpuWrap || pending.length > 12 || pending.some(p => p.open)) return null; const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); const h = { q, label, open: true }; pending.push(h); return h; };
  const tEnd = (h) => { if (!h) return; gl.endQuery(tq.TIME_ELAPSED_EXT); h.open = false; };
  function tPoll() { for (let i = pending.length - 1; i >= 0; i--) { const h = pending[i]; if (h.open) continue; if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; gpu[h.label] = gpu[h.label] == null ? ms : gpu[h.label] * 0.9 + ms * 0.1; } gl.deleteQuery(h.q); pending.splice(i, 1); } } }

  // ---- fullscreen helpers
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsGeo = new THREE.PlaneGeometry(2, 2);
  const copyMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, vertexShader: FS_VERT, fragmentShader: COPY_FRAG, depthTest: false, depthWrite: false });
  const fs = new THREE.Mesh(fsGeo, copyMat); fs.frustumCulled = false; const fsScene = new THREE.Scene(); fsScene.add(fs);
  const grab = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

  // ---- ripple atlas (ping-pong), blocks, drops
  // (linear filtering: the flow's semi-Lagrangian step moves a fraction of a texel per step)
  const simRT = () => new THREE.WebGLRenderTarget(Q.atlas, Q.atlas, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
  // the flow field over the atlas (atlas uv per sim step), FG cells per block side: a river's block follows its bends
  const FG = 16, FW = G * FG, flowData = new Uint16Array(FW * FW * 4);
  const flowTex = new THREE.DataTexture(flowData, FW, FW, THREE.RGBAFormat, THREE.HalfFloatType); flowTex.minFilter = flowTex.magFilter = THREE.LinearFilter; flowTex.needsUpdate = true;
  function writeFlow(s) { // fill the block's cells from the body's flow (vessels: still)
    const b = s.block; if (!b) return;
    const bx = Math.round(b.rect.x * G), by = Math.round(b.rect.y * G), n = b.span * FG, [x0, z0, x1, z1] = s.simRect, step = 1 / 60;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const wx = x0 + (i + 0.5) / n * (x1 - x0), wz = z0 + (j + 0.5) / n * (z1 - z0);
      const f = s.kind === 'body' ? flowAt(s, wx, wz, true) : [0, 0];
      const o = ((by * FG + j) * FW + bx * FG + i) * 4;
      flowData[o] = THREE.DataUtils.toHalfFloat(f[0] * step / (x1 - x0) * b.rect.z); flowData[o + 1] = THREE.DataUtils.toHalfFloat(f[1] * step / (z1 - z0) * b.rect.w);
    }
    flowTex.needsUpdate = true; s.flowKey = `${b.id}|${s.simRect}|${P.flow.speed}`;
  }
  let simA = null, simB = null;
  const mapData = new Uint8Array(G * G * 4).fill(255);
  const mapTex = new THREE.DataTexture(mapData, G, G, THREE.RGBAFormat); mapTex.needsUpdate = true;
  const blocks = new Array(G * G).fill(null); // block id -> {owner, cells:[...], rect}
  const simMat = new THREE.ShaderMaterial({
    uniforms: { uPrev: { value: null }, uMap: { value: mapTex }, uFlow: { value: flowTex }, uTexel: { value: new THREE.Vector2() }, uG: { value: G },
      uRect: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uMask: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uPar: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 1, 0.99)) },
      uDrops: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4()) }, uDropB: { value: new Array(MAX_DROPS).fill(-1) }, uND: { value: 0 } },
    vertexShader: FS_VERT, fragmentShader: SIM_FRAG, depthTest: false, depthWrite: false,
  });
  let drops = []; // pending: {block, u, v (atlas), r (atlas uv), s}

  function ensureSim() {
    if (simA && simA.width === Q.atlas) return;
    const had = !!simA; simA?.dispose(); simB?.dispose(); simA = simRT(); simB = simRT();
    const rt = renderer.getRenderTarget(); for (const t of [simA, simB]) { renderer.setRenderTarget(t); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false); } renderer.setRenderTarget(rt);
    if (had) for (let i = 0; i < blocks.length; i++) if (blocks[i]) freeBlock(i);
  }
  function clearRect(R) {
    ensureSim();
    const rt = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    for (const t of [simA, simB]) { t.scissor.set(R.x * t.width, R.y * t.height, R.z * t.width, R.w * t.height); t.scissorTest = true; renderer.setRenderTarget(t); renderer.clear(true, false, false); t.scissorTest = false; }
    renderer.setRenderTarget(rt); renderer.setClearColor(cc, ca);
  }
  function freeBlock(id) {
    const b = blocks[id]; if (!b) return;
    for (const c of b.cells) { blocks[c] = null; mapData[c * 4] = 255; }
    if (b.owner) b.owner.block = null;
    mapTex.needsUpdate = true;
  }
  function allocBlock(owner, want2x2) {
    ensureSim();
    const free = (c) => !blocks[c];
    let cells = null;
    if (want2x2) for (let y = 0; y < G - 1 && !cells; y += 2) for (let x = 0; x < G - 1 && !cells; x += 2) { const cs = [y * G + x, y * G + x + 1, (y + 1) * G + x, (y + 1) * G + x + 1]; if (cs.every(free)) cells = cs; }
    if (!cells) for (let c = 0; c < G * G && !cells; c++) if (free(c)) cells = [c];
    if (!cells) { // evict the least recently disturbed
      let best = -1, bt = Infinity; for (let i = 0; i < blocks.length; i++) { const b = blocks[i]; if (b && b.id === i && b.owner.lastTouch < bt) { bt = b.owner.lastTouch; best = i; } }
      if (best < 0) return null; freeBlock(best); return allocBlock(owner, false);
    }
    const id = cells[0], x = id % G, y = (id / G) | 0, span = cells.length === 4 ? 2 : 1;
    const b = { id, owner, cells, rect: new THREE.Vector4(x / G, y / G, span / G, span / G), span };
    for (const c of cells) { blocks[c] = b; mapData[c * 4] = id; }
    mapTex.needsUpdate = true; owner.block = b; owner.fresh = true;
    clearRect(b.rect); // the last owner's ripples
    return b;
  }

  // ---- materials: one program per class (vessel, small vessel, body); per-object uniforms ride on clones that share
  // the per-frame uniforms by reference
  const shared = {
    uTime: { value: 0 }, uGrabOn: { value: 0 }, uGrab: { value: null }, uDepthTex: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNF: { value: new THREE.Vector2(0.5, 2000) },
    uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uBed: { value: new THREE.Color() }, uAbsorb: { value: 1 }, uScatter: { value: 0.3 },
    uReflect: { value: 0.5 }, uRefract: { value: 0.5 }, uRough: { value: 0.06 }, uGlints: { value: 1 }, uMeniscus: { value: 0.5 },
    uCaustics: { value: 0.6 }, uCScale: { value: 1 }, uIdle: { value: 0.3 }, uWaveK: { value: 12 }, uFoam: { value: 0.5 }, uSpeed: { value: 1 },
    uEnvSky: { value: new THREE.Color() }, uEnvLow: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
    uLPos: { value: Array.from({ length: MAXL }, () => new THREE.Vector4()) }, uLCol: { value: Array.from({ length: MAXL }, () => new THREE.Vector4()) }, uNL: { value: 0 },
    uDebug: { value: 0 }, uSim: { value: null }, uSimTexel: { value: new THREE.Vector2() }, uProj: { value: new THREE.Matrix4() }, uView: { value: new THREE.Matrix4() },
  };
  const programs = new Map();
  function baseMat(kind) {
    const key = `${kind}|${Q.waves}|${Q.ssr}`;
    if (programs.has(key)) return programs.get(key);
    const small = kind === 'small';
    const m = { defines: { WAVES: small ? Math.min(4, Q.waves) : Q.waves, CWAVES: small ? 3 : Math.max(3, Q.waves - 2), SSR: kind === 'small' ? 0 : Q.ssr } };
    programs.set(key, m); return m;
  }
  // a fresh material per surface (same source + defines = the same compiled program); the per-frame uniforms are SHARED
  // objects, so one write reaches every surface. (No .clone(): it would deep-copy render-target textures.)
  function matFor(kind) {
    const b = baseMat(kind);
    const own = { uSimRect: { value: new THREE.Vector4() }, uSimOn: { value: 0 }, uAxU: { value: new THREE.Vector3(1, 0, 0) }, uAxV: { value: new THREE.Vector3(0, 0, 1) }, uSimAmp: { value: 1 },
      uDepthFt: { value: 0.5 }, uWaveScale: { value: kind === 'body' ? 0.3 : 1 }, uGroundY: { value: -0.02 }, uChannel: { value: 0 }, uBody: { value: kind === 'body' ? 1 : 0 }, uOpacity: { value: 0.85 }, uFlowSpeed: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: { ...shared, ...own }, defines: { ...b.defines }, vertexShader: SURF_VERT, fragmentShader: SURF_FRAG, side: THREE.DoubleSide });
    m.userData.kind = kind; return m;
  }

  // ---------------------------------------------------------------- vessels
  let autoRecs = {}, overRecs = {};
  (async () => {
    try { const r = await fetch(`${dataBase}water_auto.json?v=1`); if (r.ok) autoRecs = await r.json(); } catch { }
    await refreshRecords();
  })();
  async function refreshRecords() {
    try { const r = await fetch(`${api}/tuner/water_surfaces`, { cache: 'no-store' }); if (r.ok) { overRecs = {}; for (const [k, rec] of Object.entries(await r.json())) if (rec?.data) overRecs[k] = { ...rec.data, src: 'bench' }; } } catch { }
    sig = '';
  }
  // the record a placed thing uses: the bench's (Harry) first, else the automatic fit when it can be trusted
  function recordFor(spec) {
    const m = meshOf(spec); if (!m) return null;
    const o = overRecs[m]; if (o) return o.none ? null : o;
    const a = autoRecs[m]; if (!a || !P.vessels.auto || !a.found || a.none) return null;
    if (AUTO_SKIP.test(a.id || spec.id || '')) return null;
    return { ...a, src: 'auto' };
  }
  const vessels = new Map(); // item -> vessel
  function meshRootOf(it) { const v = it.visual || it.group; let r = null; v?.traverse(o => { if (!r && o.userData.meshRoot) r = o; }); return r; }
  function relBox(root) {
    const b = new THREE.Box3(), m = new THREE.Matrix4(), bb = new THREE.Box3();
    root.traverse(o => {
      if (!o.isMesh || !o.geometry || o.userData.hingeHelper) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      m.identity(); for (let p = o; p && p !== root; p = p.parent) { if (p.matrixAutoUpdate) p.updateMatrix(); m.premultiply(p.matrix); }
      b.union(bb.copy(o.geometry.boundingBox).applyMatrix4(m));
    });
    return b;
  }
  // the record (fractions of the GLB bbox) -> a surface in the root's frame, in FEET (the root's own scale divided out)
  function buildVessel(it, root, rec) {
    const box = relBox(root); if (box.isEmpty()) return null;
    const S = root.scale.clone(), sz = box.getSize(new THREE.Vector3());
    const ft = (u, w) => [(box.min.x + u * sz.x) * S.x, (box.min.z + w * sz.z) * S.z];
    let poly = (rec.poly || []).map(([u, w]) => ft(u, w));
    if (poly.length < 3) return null;
    // the bench insets the outline from the walls (inset_in); give it back so the water meets the wall (the depth test
    // hides what reaches into the wall)
    poly = outset(poly, (rec.inset_in ?? 0.6) / 12 * EDGE_REACH);
    const yFt = (box.min.y + rec.y * sz.y) * S.y, floorFt = (box.min.y + (rec.floor ?? 0) * sz.y) * S.y;
    const depthFt = Math.max(0.05, yFt - floorFt);
    const { geo, bbox } = ringSurface(poly, { y: yFt });
    const wFt = bbox[2] - bbox[0], dFt = bbox[3] - bbox[1];
    const small = Math.max(wFt, dFt) < SMALL_FT;
    const mat = matFor(small ? 'small' : 'vessel');
    mat.uniforms.uDepthFt.value = depthFt;
    const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false; mesh.frustumCulled = true; mesh.name = 'water:' + (it.spec?.sku || '');
    const inv = new THREE.Matrix4().makeScale(1 / S.x, 1 / S.y, 1 / S.z);
    // sim boundary in the block: ellipse (round vessels) or box (troughs, basins)
    const mask = rec.shape === 'poly' ? [0.5, 0.5, -0.5, -0.5] : [0.5, 0.5, 0.5, 0.5];
    const v = { kind: 'vessel', it, root, rec, mesh, inv, poly, yFt, depthFt, bbox, small, mask, block: null, lastTouch: -1e9, fresh: false, flow: [0, 0], src: rec.src };
    mesh.userData.water = v;
    wscene.add(mesh);
    return v;
  }
  function dropVessel(v) { v.mesh.removeFromParent(); v.mesh.geometry.dispose(); v.mesh.material.dispose(); if (v.block) freeBlock(v.block.id); }

  let sig = '', syncT = -1e9;
  function syncVessels(now) {
    if (now - syncT < 400 && sig) return; syncT = now;
    const list = P.on && P.vessels.on ? [...items(), ...extra] : [];
    const want = new Map();
    for (const it of list) {
      if (!it?.spec || it.spec.kind !== 'mesh' || !it.spec.sku) continue;
      const rec = recordFor(it.spec); if (!rec) continue;
      const root = meshRootOf(it); if (!root) continue;
      want.set(it, { rec, root });
    }
    const s = [...want].map(([it, w]) => `${it.spec.uid || it.spec.key || it.spec.sku}@${w.root.uuid}:${w.rec.src}:${w.rec.y}`).join('|') + `#${Q.waves}`;
    if (s === sig) return; sig = s;
    for (const [it, v] of vessels) { const w = want.get(it); if (!w || w.root !== v.root || w.rec !== v.rec && JSON.stringify(w.rec) !== JSON.stringify(v.rec) || v.mesh.material.defines.WAVES !== (v.small ? Math.min(4, Q.waves) : Q.waves)) { dropVessel(v); vessels.delete(it); } }
    for (const [it, w] of want) if (!vessels.has(it)) { const v = buildVessel(it, w.root, w.rec); if (v) vessels.set(it, v); }
  }

  // ---------------------------------------------------------------- bodies (rivers, canals, ponds)
  // def: { id, kind: 'channel' | 'pond', pts: [[x, z]...], width (channel, ft), y (surface height, ft; default 0.08),
  //        ground (the ground's height, ft; default y - 0.1), depth (ft), flow (ft/s along the channel; pond: drift
  //        speed), dir (pond drift, degrees), bankWet (ft of darkened wet bank outside the water; default 1) }
  const bodies = new Map(); // id -> body
  function buildBody(def) {
    const depth = def.depth ?? 2, slope = 0.4 + (1 - P.flow.bank) * 3.2;
    const built = def.kind === 'channel'
      ? channelSurface(def.pts, { width: def.width ?? 6, y: def.y ?? 0.08, depth, slope, outer: def.bankWet ?? 1 })
      : (() => { const r = ringSurface(def.pts, { y: def.y ?? 0.08, outer: def.bankWet ?? 1, depth, slope }); return r; })();
    const { geo, bbox } = built;
    if (def.kind !== 'channel') { const a = THREE.MathUtils.degToRad(def.dir ?? 0), f = geo.getAttribute('aFlow'); for (let i = 0; i < f.count; i++) f.setXY(i, Math.cos(a), Math.sin(a)); }
    const mat = matFor('body');
    mat.uniforms.uGroundY.value = def.ground ?? (def.y ?? 0.08) - 0.1; // the ground the body is cut into
    mat.uniforms.uChannel.value = def.kind === 'channel' ? 1 : 0;
    const mesh = new THREE.Mesh(geo, mat); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.name = 'water-body:' + def.id;
    const b = { kind: 'body', def, mesh, bbox, block: null, lastTouch: -1e9, fresh: false, samples: built.samples || null, mask: [0, 0, 0, 0], inv: null, key: `${P.flow.bank}|${Q.waves}|${Q.ssr}` };
    mesh.userData.water = b; wscene.add(mesh);
    return b;
  }
  function setBodies(defs = []) {
    const want = new Map(defs.filter(d => d && d.pts?.length >= 2).map(d => [d.id, d]));
    for (const [id, b] of bodies) if (!want.has(id) || JSON.stringify(want.get(id)) !== JSON.stringify(b.def)) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); b.mesh.material.dispose(); if (b.block) freeBlock(b.block.id); bodies.delete(id); }
    let made = 0; for (const [id, d] of want) if (!bodies.has(id)) { bodies.set(id, buildBody(d)); made++; }
    if (made) try { renderer.compileAsync?.(wscene, camera)?.catch?.(() => {}); } catch { } // the new body's program, built in the background before it is ever in view
  }
  // flow (ft/s) of a body at a world point: the nearest spline sample's tangent x speed
  function flowAt(b, x, z) {
    const sp = (b.def.flow ?? 1) * P.flow.speed;
    if (b.def.kind !== 'channel') { const a = THREE.MathUtils.degToRad(b.def.dir ?? 0); return [Math.cos(a) * sp, Math.sin(a) * sp]; }
    let best = null, bd = Infinity; for (const s of b.samples) { const d = (s.p[0] - x) ** 2 + (s.p[1] - z) ** 2; if (d < bd) { bd = d; best = s; } }
    const k = flowProfile(1 - Math.sqrt(bd) / ((b.def.width ?? 6) / 2)); // fastest mid-stream, slow at the banks
    return best ? [best.t[0] * sp * k, best.t[1] * sp * k] : [0, 0];
  }

  // ---------------------------------------------------------------- interaction: drops into the heightfield
  const surfaces = () => [...vessels.values(), ...bodies.values()];
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
  // a world point -> (surface-local feet) for a surface; null when outside its outline
  function localOf(s, x, y, z) {
    if (s.kind === 'body') return [x, z];
    _m.copy(s.mesh.matrixWorld).invert(); _v.set(x, y, z).applyMatrix4(_m); return [_v.x, _v.z];
  }
  function inside(s, lx, lz, pad = 0) {
    const [x0, z0, x1, z1] = s.bbox; if (lx < x0 - pad || lz < z0 - pad || lx > x1 + pad || lz > z1 + pad) return false;
    if (s.kind === 'body') {
      if (s.def.kind !== 'channel') return inPoly(lx, lz, s.def.pts) || polyDist(lx, lz, s.def.pts) < pad;
      const hw = (s.def.width ?? 6) / 2 + pad; for (const q of s.samples) if ((q.p[0] - lx) ** 2 + (q.p[1] - lz) ** 2 < hw * hw) return true; return false;
    }
    return inPoly(lx, lz, s.poly);
  }
  // add a drop at world (x, y, z): radius in ft, strength ~ 0..1
  function touch(x, y, z, strength = 1, radius = null, only = null) {
    if (lite || !wide) return false; // (the viewer's switch, or no body of water in view: no ripples are simulated)
    if (!P.on) return false;
    const now = performance.now(); let hit = false;
    for (const s of only ? [only] : surfaces()) {
      if (!s.mesh.visible || (plainVessels && s.kind !== 'body')) continue;
      const [lx, lz] = localOf(s, x, y, z);
      if (!inside(s, lx, lz)) continue;
      if (!s.block) { if (!allocBlock(s, s.kind === 'body')) continue; s.simRect = simRectFor(s, lx, lz); }
      s.lastTouch = now; hit = true;
      const [x0, z0, x1, z1] = s.simRect;
      const u = (lx - x0) / (x1 - x0), w = (lz - z0) / (z1 - z0);
      if (u < 0 || w < 0 || u > 1 || w > 1) { if (s.kind === 'body') { s.simRect = simRectFor(s, lx, lz); freeBlock(s.block.id); allocBlock(s, true); } continue; }
      const R = s.block.rect, rr = (radius ?? (s.kind === 'body' ? 0.3 : 0.1) * P.ripples.size) / (x1 - x0) * R.z;
      drops.push({ block: s.block.id, u: R.x + u * R.z, v: R.y + w * R.w, r: Math.max(rr, 2.5 / Q.atlas), s: strength * P.ripples.interaction * 0.04 });
    }
    if (drops.length > MAX_DROPS * 3) drops = drops.slice(-MAX_DROPS * 3);
    return hit;
  }
  // the block's world window: vessels = their footprint bbox; bodies = a window (<= 40 ft) around the disturbance
  // (square in world feet, so ripples spread as circles; a vessel's boundary is an ellipse / box inside it)
  function simRectFor(s, cx, cz) {
    const [x0, z0, x1, z1] = s.bbox, Wmax = 40, c = [(x0 + x1) / 2, (z0 + z1) / 2];
    if (s.kind !== 'body' || (x1 - x0 <= Wmax && z1 - z0 <= Wmax)) {
      const h = Math.max(x1 - x0, z1 - z0) / 2 * 1.04;
      if (s.kind !== 'body') { const rx = (x1 - x0) / 4 / h, rz = (z1 - z0) / 4 / h; s.mask = s.rec?.shape === 'poly' ? [0.5, 0.5, -rx * 1.02, -rz * 1.02] : [0.5, 0.5, rx * 1.04, rz * 1.04]; }
      return [c[0] - h, c[1] - h, c[0] + h, c[1] + h];
    }
    const f = cx != null ? [cx, cz] : c;
    return [f[0] - Wmax / 2, f[1] - Wmax / 2, f[0] + Wmax / 2, f[1] + Wmax / 2];
  }

  // the cursor: a passive listener (never consumes the event); the ray from the camera through the pointer
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let lastPtr = null;
  function onMove(e) {
    if (!P.on || !canvas || P.ripples.interaction <= 0) return;
    const r = canvas.getBoundingClientRect(); if (e.clientX < r.left || e.clientY < r.top || e.clientX > r.right || e.clientY > r.bottom) { lastPtr = null; return; }
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(surfaces().filter(s => s.mesh.visible).map(s => s.mesh), false);
    const h = hits.find(x => (x.object.userData.water?.kind !== 'body') || inWaterBody(x));
    if (!h) { lastPtr = null; return; }
    const p = h.point, t = performance.now();
    if (lastPtr && lastPtr.s === h.object.userData.water) {
      const d = Math.hypot(p.x - lastPtr.p.x, p.z - lastPtr.p.z); if (d < 0.04) return;
      const n = Math.min(6, Math.ceil(d / 0.15)), sp = d / Math.max(1, t - lastPtr.t) * 1000;
      for (let i = 1; i <= n; i++) touch(lastPtr.p.x + (p.x - lastPtr.p.x) * i / n, p.y, lastPtr.p.z + (p.z - lastPtr.p.z) * i / n, Math.min(1.2, 0.25 + sp * 0.08) / Math.sqrt(n), null, h.object.userData.water);
    } else touch(p.x, p.y, p.z, 0.6, null, h.object.userData.water);
    lastPtr = { p: p.clone(), t, s: h.object.userData.water };
  }
  function inWaterBody(h) { const a = h.object.geometry.getAttribute('aEdge'), f = h.face; if (!f) return true; const bc = h.barycoord || null; const e = bc ? a.getX(f.a) * bc.x + a.getX(f.b) * bc.y + a.getX(f.c) * bc.z : Math.max(a.getX(f.a), a.getX(f.b), a.getX(f.c)); return e >= 0; }
  if (canvas) canvas.addEventListener('pointermove', onMove, { passive: true });

  // things moving in water: a dragged cup, a dropped bucket lid, a pawn wading; each frame, only things that moved
  const prevPos = new WeakMap(); const lowCache = new WeakMap();
  const _b = new THREE.Box3();
  function moversInWater(dt) {
    const S = surfaces(); if (!S.length) return;
    for (const it of [...items(), ...extra, ...movers()]) {
      const g = it.group; if (!g?.visible) continue;
      const p = g.position; const prev = prevPos.get(g);
      prevPos.set(g, { x: p.x, y: p.y, z: p.z });
      if (!prev) continue;
      const dx = p.x - prev.x, dy = p.y - prev.y, dz = p.z - prev.z, d = Math.hypot(dx, dz);
      if (d < 0.01 && Math.abs(dy) < 0.01) continue;
      let low = lowCache.get(g); if (!low || low.vis !== it.visual) { _b.setFromObject(g); low = { dy: _b.min.y - g.position.y, r: Math.max(0.15, Math.min(1.2, Math.max(_b.max.x - _b.min.x, _b.max.z - _b.min.z) / 2)), vis: it.visual }; lowCache.set(g, low); }
      const bottom = p.y + low.dy;
      for (const s of S) {
        if (s.kind === 'vessel' && s.it === it) continue;
        const sy = s.kind === 'body' ? (s.def.y ?? 0.08) : _v.set(s.bbox[0], s.yFt, s.bbox[1]).applyMatrix4(s.mesh.matrixWorld).y;
        if (bottom > sy + 0.05 || p.y + low.dy + 6 < sy) continue;
        const [lx, lz] = localOf(s, p.x, sy, p.z); if (!inside(s, lx, lz, 0.2)) continue;
        const crossing = prev.y + low.dy > sy && bottom <= sy; // fell in
        const st = crossing ? Math.min(2, 0.6 + Math.abs(dy) / Math.max(1, dt) * 60) : Math.min(1, d / Math.max(1, dt) * 1000 * 0.12);
        touch(p.x, sy, p.z, st, Math.min(low.r, 0.5) * (crossing ? 1.4 : 0.8), s);
      }
    }
  }

  // ---------------------------------------------------------------- per frame
  let time = 0, simAcc = 0, lightT = -1e9; const lights = [];
  const _c = new THREE.Color(), _p = new THREE.Vector3();
  function gatherLights(now) {
    if (now - lightT > 500) { lightT = now; lights.length = 0; scene.traverseVisible(o => { if ((o.isPointLight || o.isSpotLight) && o.intensity > 0) lights.push(o); }); }
    const f = focus() || camera.position;
    const list = lights.filter(l => l.visible && l.intensity > 0).map(l => ({ l, d: l.getWorldPosition(_p).distanceToSquared(f) })).sort((a, b) => a.d - b.d).slice(0, MAXL);
    shared.uNL.value = list.length;
    list.forEach(({ l }, i) => { l.getWorldPosition(_p); shared.uLPos.value[i].set(_p.x, _p.y, _p.z, l.distance || 0); const k = l.intensity; shared.uLCol.value[i].set(l.color.r * k, l.color.g * k, l.color.b * k, l.decay); });
  }
  function frame(dt, now) {
    const t0 = performance.now();
    time = now / 1000;
    syncVessels(now);
    for (const v of vessels.values()) {
      const g = v.it.group; const vis = !!(g?.visible && v.root.visible) && P.on && P.vessels.on;
      v.mesh.visible = vis; if (!vis) continue;
      v.root.updateWorldMatrix(true, false);
      v.mesh.matrix.multiplyMatrices(v.root.matrixWorld, v.inv); v.mesh.matrixWorld.copy(v.mesh.matrix);
    }
    for (const b of bodies.values()) { b.mesh.visible = P.on; b.mesh.matrixWorld.copy(b.mesh.matrix); }
    wide = wideNow();
    moversInWater(dt);
    // free idle blocks
    for (const s of surfaces()) if (s.block && now - s.lastTouch > 12000) freeBlock(s.block.id);
    stats.sim_blocks = new Set(blocks.filter(Boolean).map(b => b.id)).size;
    // uniforms that change per frame
    shared.uTime.value = time;
    gatherLights(now);
    // what the water mirrors where nothing on screen is: the room (dim, from the sky fill) or, by day, the sky
    if (hemi) { _c.copy(hemi.color).multiplyScalar(hemi.intensity); shared.uEnvSky.value.copy(_c).multiplyScalar(0.1); shared.uAmbient.value.copy(_c).multiplyScalar(0.35).add(_c.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 0.15)); shared.uEnvLow.value.copy(hemi.groundColor).multiplyScalar(hemi.intensity * 0.05); }
    if (sun) { shared.uSunDir.value.copy(sun.position).sub(sun.target?.position || _p.set(0, 0, 0)).normalize(); shared.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity); shared.uEnvSky.value.add(_c.copy(sun.color).multiplyScalar(sun.intensity * 0.06)); }

    // per-surface: sim block (if any)
    for (const s of surfaces()) {
      const u = s.mesh.material.uniforms;
      u.uFlowSpeed.value = s.kind === 'body' ? (s.def.flow ?? 1) * P.flow.speed : 0;
      if (s.block) {
        const [x0, z0, x1, z1] = s.simRect || (s.simRect = simRectFor(s));
        u.uSimOn.value = 1; u.uSimRect.value.copy(s.block.rect);
        // the block covers the sim rect; the geometry's aSim covers the bbox: remap through the shader by baking the
        // ratio into uSimRect (offset + scale)
        const [bx0, bz0, bx1, bz1] = s.bbox, R = s.block.rect;
        const sx = (bx1 - bx0) / (x1 - x0), sz = (bz1 - bz0) / (z1 - z0), ox = (bx0 - x0) / (x1 - x0), oz = (bz0 - z0) / (z1 - z0);
        u.uSimRect.value.set(R.x + ox * R.z, R.y + oz * R.w, sx * R.z, sz * R.w);
        // world feet per unit of aSim along u and v (the vessel's yaw rotates them)
        const e = s.mesh.matrixWorld.elements; // (scale divided out: inv)
        const ax = new THREE.Vector3(e[0], e[1], e[2]).normalize().multiplyScalar(bx1 - bx0), az = new THREE.Vector3(e[8], e[9], e[10]).normalize().multiplyScalar(bz1 - bz0);
        u.uAxU.value.copy(ax); u.uAxV.value.copy(az);
        u.uSimAmp.value = 1;
        // the sim's own params: flow in block uv per step, wave speed, damping, boundary
        const i = s.block.id, sim = simMat.uniforms;
        sim.uRect.value[i].copy(s.block.rect);
        if (s.flowKey !== `${s.block.id}|${s.simRect}|${P.flow.speed}`) writeFlow(s);
        sim.uPar.value[i].set(0, 0, s.kind === 'body' ? 0.2 : 0.5, 1 - (0.0004 + 0.03 * P.ripples.damping ** 2));
        if (s.kind === 'body') sim.uMask.value[i].set(0, 0, 0, 0);
        else { const m = s.mask; sim.uMask.value[i].set(m[0], m[1], m[2], m[3]); }
      } else u.uSimOn.value = 0;
    }
    // step the heightfield
    if (!wide) drops.length = 0;
    else if (stats.sim_blocks > 0 || drops.length) {
      ensureSim();
      simAcc += Math.min(100, dt) / 1000 * 90 * P.ripples.speed;
      const n = Math.min(dt > 30 ? 10 : Q.steps + 1, Math.floor(simAcc)); simAcc -= n; if (simAcc > 4) simAcc = 0; // (a frame over 30 ms, e.g. the game's idle rate: up to 10 steps, so ripples keep their speed)
      const rt = renderer.getRenderTarget(); const th = tBegin('sim');
      for (let k = 0; k < Math.max(n, drops.length ? 1 : 0); k++) {
        const sim = simMat.uniforms, batch = drops.splice(0, MAX_DROPS);
        sim.uND.value = batch.length; batch.forEach((d, j) => { sim.uDrops.value[j].set(d.u, d.v, d.r, d.s); sim.uDropB.value[j] = d.block; });
        stats.drops += batch.length;
        sim.uPrev.value = simA.texture; sim.uTexel.value.set(1 / Q.atlas, 1 / Q.atlas);
        fs.material = simMat; renderer.setRenderTarget(simB); renderer.render(fsScene, fsCam);
        [simA, simB] = [simB, simA]; stats.sim_steps++;
      }
      tEnd(th); renderer.setRenderTarget(rt);
      shared.uSim.value = simA.texture;
    }
    shared.uSimTexel.value.set(1 / Q.atlas, 1 / Q.atlas);
    if (tq) tPoll();
    stats.cpu_ms = +(performance.now() - t0).toFixed(2);
  }

  function setUniformsFromParams() {
    const lin = (hex, c) => c.set(hex).convertSRGBToLinear();
    lin(P.color.shallow, shared.uShallow.value); lin(P.color.deep, shared.uDeep.value); lin(P.flow.bed, shared.uBed.value);
    shared.uAbsorb.value = 0.12 + (1 - P.color.clarity) ** 2 * 6;
    shared.uScatter.value = P.color.scatter;
    shared.uReflect.value = P.surface.reflect; shared.uRefract.value = P.surface.refract;
    shared.uRough.value = THREE.MathUtils.lerp(0.22, 0.025, P.surface.gloss);
    shared.uGlints.value = P.surface.glints; shared.uMeniscus.value = P.surface.meniscus;
    shared.uCaustics.value = P.caustics.amount; shared.uCScale.value = 1 / P.caustics.scale;
    shared.uIdle.value = P.ripples.idle; shared.uWaveK.value = 14 / P.ripples.size; shared.uSpeed.value = P.ripples.speed;
    shared.uFoam.value = P.flow.foam;
  }

  // ---------------------------------------------------------------- drawing
  const visibleCount = () => surfaces().filter(s => s.mesh.visible).length;
  function draw(r) {
    camera.updateMatrixWorld(); shared.uProj.value.copy(camera.projectionMatrix); shared.uView.value.copy(camera.matrixWorldInverse); shared.uNF.value.set(camera.near, camera.far);
    const calls0 = r.info.render.calls;
    r.render(wscene, camera);
    stats.draw_calls = r.info.render.calls - calls0;
  }
  class WaterPass extends Pass {
    constructor() { super('WaterPass'); this.needsSwap = false; this.needsDepthTexture = true; this.needsDepthBlit = true; this.depth = null; }
    setDepthTexture(t) { this.depth = t; }
    setSize(w, h) { size.set(w, h); grab.setSize(Math.max(4, Math.round(w * Q.grab)), Math.max(4, Math.round(h * Q.grab))); }
    render(r, inputBuffer) {
      if (!P.on || !visibleCount()) { stats.draw_calls = 0; stats.grab = 'none'; return; }
      if (!wide) { // no body of water in view (or the viewer's switch): the plain way, into the frame, depth-tested
        for (const m of matsInUse()) { m.blending = THREE.NormalBlending; m.transparent = true; m.depthWrite = false; }
        shared.uGrabOn.value = 0; shared.uGrab.value = null; shared.uDepthTex.value = null;
        const db0 = r.getDrawingBufferSize(new THREE.Vector2()); shared.uRes.value.set(inputBuffer.width || db0.x, inputBuffer.height || db0.y);
        const ac0 = r.autoClear; r.autoClear = false; r.setRenderTarget(inputBuffer); draw(r); r.autoClear = ac0; stats.grab = 'plain'; return;
      }
      const t0 = performance.now(), th = tBegin('draw');
      const ac = r.autoClear; r.autoClear = false;
      // 1. the frame so far -> the refraction source
      copyMat.uniforms.tSrc.value = inputBuffer.texture; fs.material = copyMat; r.setRenderTarget(grab); r.render(fsScene, fsCam);
      // 2. every surface into the frame, depth-tested against the scene, writing depth
      for (const m of matsInUse()) { m.blending = THREE.NoBlending; m.transparent = false; m.depthWrite = true; }
      shared.uGrabOn.value = 1; shared.uGrab.value = grab.texture; shared.uDepthTex.value = this.depth;
      const db = r.getDrawingBufferSize(new THREE.Vector2()); shared.uRes.value.set(inputBuffer.width || db.x, inputBuffer.height || db.y);
      r.setRenderTarget(inputBuffer);
      draw(r);
      r.autoClear = ac; tEnd(th);
      stats.grab = `${grab.width}x${grab.height}`; stats.pass_cpu_ms = +(performance.now() - t0).toFixed(2);
    }
  }
  const pass = new WaterPass();
  const matsInUse = () => surfaces().map(s => s.mesh.material);
  // Lighting FX off: no post stack, no depth texture: alpha-blended over the screen, depth-tested
  function renderPlain() {
    if (!P.on || !visibleCount()) { stats.draw_calls = 0; return; }
    for (const m of matsInUse()) { m.blending = THREE.NormalBlending; m.transparent = true; m.depthWrite = false; }
    shared.uGrabOn.value = 0; shared.uGrab.value = null; shared.uDepthTex.value = null;
    const db = renderer.getDrawingBufferSize(new THREE.Vector2()); shared.uRes.value.set(db.x, db.y);
    const ac = renderer.autoClear; renderer.autoClear = false; draw(renderer); renderer.autoClear = ac;
    stats.grab = 'plain';
  }

  function apply() {
    const was = Q; Q = QUALITY[P.quality.level] || QUALITY.laptop;
    if (was !== Q) { if (size.x > 1) pass.setSize(size.x, size.y); if (simA && simA.width !== Q.atlas) ensureSim(); }
    setUniformsFromParams();
    // the bank gradient and the quality's program live in a body's geometry / material: rebuild the ones that changed
    const key = `${P.flow.bank}|${Q.waves}|${Q.ssr}`;
    for (const b of [...bodies.values()]) if (b.key !== key) { b.mesh.removeFromParent(); b.mesh.geometry.dispose(); b.mesh.material.dispose(); if (b.block) freeBlock(b.block.id); bodies.set(b.def.id, buildBody(b.def)); }
    sig = '';
  }

  // things the water module itself placed (the tuner's demo): seen by fire / atmosphere through fx/index.js
  const extra = [];
  const self = {
    get params() { return P; },
    set(p) { P = p; apply(); },
    apply, frame, pass, renderPlain, touch, setBodies, refreshRecords, scene: wscene,
    // THE VIEWER'S SWITCH (the game's Settings > Me > Graphics > Water effects, 2026-10-11): lite = the water is still
    // drawn as a surface (colour, depth, the slow swell), but nothing is simulated (no ripples from the cursor, from
    // things wading or from the idle drip) and nothing is mirrored by tracing the screen. For this viewer only.
    setLite(on) { on = !!on; if (on === lite) return; lite = on; if (lite) { drops.length = 0; for (const s of surfaces()) if (s.block) freeBlock(s.block.id); } }, isLite: () => lite, isWide: () => wide,
    bodies: () => [...bodies.values()].map(b => b.def),
    extraItems: () => extra, addExtra: (it) => { extra.push(it); sig = ''; }, clearExtra: () => { extra.length = 0; sig = ''; },
    // test hooks: where each vessel's water is (world), its record and source; the heightfield under a world point
    surfaces: () => [...vessels.values()].map(v => {
      const outline = v.poly.map(([x, z]) => _v.set(x, v.yFt, z).applyMatrix4(v.mesh.matrixWorld).toArray().map(n => +n.toFixed(4)));
      return { sku: v.it.spec.sku, id: v.it.spec.id, mesh: meshOf(v.it.spec), src: v.src, small: v.small, visible: v.mesh.visible, y: +_v.set(v.bbox[0], v.yFt, v.bbox[1]).applyMatrix4(v.mesh.matrixWorld).y.toFixed(4), outline, rec: { y: v.rec.y, floor: v.rec.floor, rim: v.rec.rim, shape: v.rec.shape, inset_in: v.rec.inset_in, poly: v.rec.poly }, block: v.block?.id ?? null };
    }),
    recordFor, autoRecords: () => autoRecs, benchRecords: () => overRecs,
    readHeights(s, pts) { // world [[x, z]] on surface s ('vessel' item sku | body id) -> heights (sim units), null when no block
      const surf = typeof s === 'string' ? (bodies.get(s) || [...vessels.values()].find(v => v.it.spec.sku === s || v.it.spec.uid === s)) : s;
      if (!surf?.block || !simA) return pts.map(() => null);
      const buf = new Uint16Array(Q.atlas * Q.atlas * 4); renderer.readRenderTargetPixels(simA, 0, 0, Q.atlas, Q.atlas, buf);
      const [x0, z0, x1, z1] = surf.simRect, R = surf.block.rect;
      return pts.map(([x, z]) => {
        const y = surf.kind === 'body' ? surf.def.y : null;
        const [lx, lz] = surf.kind === 'body' ? [x, z] : localOf(surf, x, y ?? 0, z);
        const u = R.x + (lx - x0) / (x1 - x0) * R.z, v = R.y + (lz - z0) / (z1 - z0) * R.w;
        const i = Math.floor(u * Q.atlas), j = Math.floor(v * Q.atlas); if (i < 0 || j < 0 || i >= Q.atlas || j >= Q.atlas) return null;
        return THREE.DataUtils.fromHalfFloat(buf[(j * Q.atlas + i) * 4]);
      });
    },
    debug: (n) => { shared.uDebug.value = n; },
    uniforms: () => ({ absorb: shared.uAbsorb.value, rough: shared.uRough.value, reflect: shared.uReflect.value, refract: shared.uRefract.value, glints: shared.uGlints.value, caustics: shared.uCaustics.value, waveK: shared.uWaveK.value, foam: shared.uFoam.value, deep: shared.uDeep.value.toArray(), shallow: shared.uShallow.value.toArray(), idle: shared.uIdle.value, lights: shared.uNL.value }),
    flowAt: (id, x, z) => { const b = bodies.get(id); return b ? flowAt(b, x, z) : null; },
    stats: () => ({ water_on: P.on, water_vessels: vessels.size, water_vessels_small: [...vessels.values()].filter(v => v.small).length, water_bodies: bodies.size, water_draw_calls: stats.draw_calls,
      water_sim: simA ? `${Q.atlas}² atlas, ${stats.sim_blocks} block(s) live` : 'idle', water_sim_steps: stats.sim_steps, water_grab: stats.grab, water_cpu_ms: stats.cpu_ms, water_pass_cpu_ms: stats.pass_cpu_ms ?? 0, water_programs: programs.size, water_quality: P.quality.level,
      water_gpu_draw_ms: gpu.draw == null ? null : +gpu.draw.toFixed(3), water_gpu_sim_ms: gpu.sim == null ? null : +gpu.sim.toFixed(3), water_sim_blocks: stats.sim_blocks, water_wide: wide, water_lite: lite }),
    dispose() { canvas?.removeEventListener('pointermove', onMove); for (const v of vessels.values()) dropVessel(v); setBodies([]); simA?.dispose(); simB?.dispose(); grab.dispose(); },
  };
  apply();
  return self;
}
