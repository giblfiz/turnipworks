// SELECTION: how a selected / hovered / hidden-from-players thing is drawn. Shared by the Spawn Tuner (the Selection
// lab, js/fx/selpanel.js) and the game (engine/client imports this module from the deployed tuner and reads the house
// look's `selection` params from GET /tuner/house). Harry 2026-10-04: "I'm not loving what 'Selection' looks like...
// can we get some settings and wildly different options to play with over in the tuner?"
//
//   const sel = createSelection({ scene, camera, renderer, params });
//   sel.select(item, 'selected' | 'hover' | 'hidden' | 'pending', seatColor, { style, parent, tag })
//     style: overrides the state's style (compare mode); parent: an Object3D to hang the drawing under instead of the
//     module's root (the game removes it to drop the signal); tag: merged into every material's userData
//   sel.clear(item, state)   sel.clear(item)   sel.clear()            sel.tick(dt, now, camera?)   sel.set(params)
// item: anything with .group (the thing's root, moved by drags) and .visual (its meshes), or a bare Object3D.
//   item.dims [w, h, d]: the box of a thing with no meshes (the game's rooms: a volume, not a model).
//   item.outline [[x, z], ...] (root frame, clockwise seen from above; item.outset: how far outside it to draw): a thing
//   whose footprint is not a rectangle (the game's L-shaped rooms, 2026-10-05). The ground styles that trace a box
//   (corner brackets, the footprint outline) then trace the outline: a bracket at every corner of it, inside corners too.
//
// Depth: every style is depth-tested, so nothing shows through walls, furniture or the thing itself. The one exception
// is deliberate: the per-state `ghost` dial draws the occluded part of the ground styles (footprint, ring, brackets,
// motes) faintly through whatever is in front. Nothing here touches the DOM.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export const HIDDEN_COLOR = '#a78bfa'; // the engine's hidden-from-players violet (engine/client/world.js)

export const SEL_STYLES = [
  ['halo', 'Glow halo'], ['footprint', 'Footprint outline'], ['ring', 'Ground ring'], ['rim', 'Rim light'],
  ['ink', 'Ink outline'], ['spotlight', 'Spotlight'], ['brackets', 'Corner brackets'], ['lift', 'Lift & bob'],
  ['motes', 'Orbiting motes'], ['tint', 'Tint wash'],
];
export const SEL_STATES = [['selected', 'Selected'], ['hover', 'Hover'], ['hidden', 'Hidden from players']];

const R = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
// per-style dial schemas (ui.js dialGroup format)
export const STYLE_SCHEMA = {
  halo: [R('width', 'Width', 0.02, 0.6, 0.01, 'ft'), R('intensity', 'Intensity', 0.05, 1, 0.05), R('pulse', 'Pulse speed (0 = steady)', 0, 3, 0.05, 'Hz'), R('depth', 'Pulse depth', 0, 1, 0.05), R('soft', 'Soft outer edge', 0, 1, 0.05), { k: 'smooth', label: 'Smooth hull (no spikes at hard edges)', type: 'check' }],
  footprint: [R('weight', 'Line weight', 1, 12, 0.5, 'px'), R('dash', 'Dash length (0 = solid)', 0, 2, 0.05, 'ft'), R('gap', 'Gap length', 0.05, 2, 0.05, 'ft'), R('round', 'Corner rounding', 0, 3, 0.05, 'ft'), R('pad', 'Padding', 0, 1.5, 0.05, 'ft'), R('glow', 'Soft glow under the line', 0, 1, 0.05), R('pulse', 'Pulse speed', 0, 3, 0.05, 'Hz'), R('opacity', 'Opacity', 0.1, 1, 0.05)],
  ring: [{ k: 'mode', label: 'Ring', type: 'select', options: [['solid', 'solid'], ['dashed', 'dashed'], ['rotating', 'dashed, slowly rotating'], ['disc', 'filled disc']] },
    R('radius', 'Radius (× the thing)', 0.6, 2, 0.05), R('width', 'Ring width', 0.05, 1.5, 0.05, 'ft'), R('dashes', 'Dashes', 3, 40, 1), R('spin', 'Rotation speed', 0, 1, 0.01, 'rev/s'), R('fill', 'Inner fill', 0, 0.8, 0.05), R('opacity', 'Opacity', 0.1, 1, 0.05), R('soft', 'Soft edges', 0, 1, 0.05)],
  rim: [R('power', 'Edge tightness', 0.5, 8, 0.1), R('intensity', 'Intensity', 0.1, 3, 0.05), R('pulse', 'Pulse speed', 0, 3, 0.05, 'Hz')],
  ink: [R('thickness', 'Thickness', 0.5, 10, 0.25, 'px'), R('opacity', 'Opacity', 0.1, 1, 0.05), R('dark', 'Ink darkness (0 = colour, 1 = black)', 0, 1, 0.05)],
  spotlight: [{ k: 'mode', label: 'Kind', type: 'select', options: [['dim', 'scene dims, the selection stays bright'], ['cone', 'soft light cone from above'], ['both', 'both']] },
    R('dim', 'Scene dimming', 0, 0.8, 0.02), R('radius', 'Bright pool (× the thing)', 0.6, 3, 0.05), R('soft', 'Pool edge softness', 0, 1, 0.05), R('cone', 'Cone brightness', 0, 1, 0.02), R('height', 'Cone height', 3, 20, 0.5, 'ft'), R('tint', 'Cone takes the colour', 0, 1, 0.05)],
  brackets: [{ k: 'mode', label: 'Brackets', type: 'select', options: [['world', 'in the world, on the box\'s corners'], ['screen', 'HUD, flat to the screen (floats a little in front)']] },
    { k: 'corners', label: 'Corners (world brackets)', type: 'select', options: [['both', 'top and bottom'], ['top', 'top'], ['bottom', 'bottom']] }, R('size', 'Bracket arm (share of the box)', 0.08, 0.5, 0.01), R('gap', 'Gap from the thing', 0, 1.5, 0.05, 'ft'), R('weight', 'Line weight', 1, 8, 0.5, 'px'),
    { k: 'anim', label: 'Animation', type: 'select', options: [['none', 'still'], ['breathe', 'breathe in and out'], ['snap', 'snap in once'], ['pulse', 'opacity pulse']] }, R('speed', 'Animation rate', 0.1, 3, 0.05, 'Hz'), R('swell', 'Breathing depth', 0, 0.3, 0.01), R('opacity', 'Opacity', 0.1, 1, 0.05)],
  lift: [R('height', 'Lift height', 0, 3, 0.05, 'ft'), R('bob', 'Bob', 0, 0.6, 0.01, 'ft'), R('rate', 'Bob rate', 0, 2, 0.05, 'Hz'), R('shadow', 'Contact shadow', 0, 1, 0.05), R('color', 'Shadow takes the colour', 0, 1, 0.05), R('rise', 'Rise time', 0.02, 1, 0.02, 's')],
  motes: [R('count', 'Count', 1, 40, 1), R('speed', 'Orbit speed', 0, 1.5, 0.01, 'rev/s'), R('size', 'Mote size', 0.05, 0.8, 0.01, 'ft'), R('radius', 'Orbit (× the thing)', 0.6, 2, 0.05), R('spread', 'Height spread', 0, 1, 0.05), R('opacity', 'Brightness', 0.1, 1, 0.05)],
  tint: [{ k: 'mode', label: 'Wash', type: 'select', options: [['wash', 'colour wash'], ['brighten', 'brighten (additive)']] }, R('strength', 'Strength', 0.02, 1, 0.02), R('pulse', 'Pulse speed', 0, 3, 0.05, 'Hz')],
};
export const STYLE_DEFAULTS = {
  halo: { width: 0.16, intensity: 0.9, pulse: 0.61, depth: 1, soft: 0, smooth: true },
  footprint: { weight: 4, dash: 0, gap: 0.4, round: 0.15, pad: 0.3, glow: 0, pulse: 0.61, opacity: 1 },
  ring: { mode: 'solid', radius: 1.1, width: 0.3, dashes: 16, spin: 0.08, fill: 0.12, opacity: 0.9, soft: 0.4 },
  rim: { power: 2.2, intensity: 1.3, pulse: 0 },
  ink: { thickness: 2.5, opacity: 1, dark: 0 },
  spotlight: { mode: 'dim', dim: 0.45, radius: 1.0, soft: 0.35, cone: 0.35, height: 10, tint: 0.3 },
  brackets: { mode: 'world', corners: 'both', size: 0.22, gap: 0.3, weight: 3, anim: 'breathe', speed: 0.4, swell: 0.06, opacity: 1 },
  lift: { height: 1.2, bob: 0.1, rate: 0.5, shadow: 0.75, color: 0.45, rise: 0.18 },
  motes: { count: 12, speed: 0.18, size: 0.4, radius: 1.05, spread: 0.6, opacity: 0.95 },
  tint: { mode: 'wash', strength: 0.18, pulse: 0 },
};
// the subtler hover versions (what the game's hover halo already was: thinner, fainter, steady)
const HOVER_DIALS = {
  halo: { width: 0.07, intensity: 0.5, pulse: 0, depth: 1, soft: 0, smooth: true },
  footprint: { weight: 2, dash: 0, gap: 0.4, round: 0.15, pad: 0.3, glow: 0, pulse: 0, opacity: 0.8 },
  ring: { mode: 'solid', radius: 1.1, width: 0.15, dashes: 16, spin: 0.08, fill: 0, opacity: 0.55, soft: 0.5 },
  rim: { power: 3, intensity: 0.6, pulse: 0 },
  ink: { thickness: 1.5, opacity: 0.6, dark: 0 },
  spotlight: { mode: 'dim', dim: 0.15, radius: 1.3, soft: 0.8, cone: 0.15, height: 10, tint: 0.2 },
  brackets: { mode: 'world', corners: 'both', size: 0.16, gap: 0.25, weight: 2, anim: 'none', speed: 0.4, swell: 0.06, opacity: 0.6 },
  lift: { height: 0.25, bob: 0, rate: 0.5, shadow: 0.3, color: 0, rise: 0.12 },
  motes: { count: 5, speed: 0.12, size: 0.2, radius: 1.05, spread: 0.4, opacity: 0.5 },
  tint: { mode: 'brighten', strength: 0.12, pulse: 0 },
};
const HIDDEN_DIALS = { ...STYLE_DEFAULTS, halo: { width: 0.11, intensity: 0.85, pulse: 0, depth: 1, soft: 0, smooth: true }, footprint: { ...STYLE_DEFAULTS.footprint, weight: 2, dash: 0.35, gap: 0.25, pulse: 0 } };
const PENDING_DIALS = { ...HOVER_DIALS, halo: { width: 0.06, intensity: 0.35, pulse: 1.77, depth: 1, soft: 0, smooth: true } };

const allDials = (over = {}) => Object.fromEntries(Object.keys(STYLE_DEFAULTS).map(s => [s, { ...STYLE_DEFAULTS[s], ...(over[s] || {}) }]));
// HARRY-V1 (Harry's pick in the Selection lab, 2026-10-04) is the default and the game's house look:
//   selected = world corner brackets, top AND bottom, breathing at 0.4 Hz, ghost through occluders 0.10;
//   hover = 2-px footprint outline, ghost 0.2;   hidden from players = violet tint wash, 0.3, pulsing at 0.6 Hz.
export const SELECTION_DEFAULTS = {
  fx: 'selection', name: 'harry-v1',
  selected: { style: 'brackets', color: 'seat', fixed: '#ffd166', ghost: 0.1, dials: allDials() },
  hover: { style: 'footprint', color: 'fixed', fixed: '#ffffff', ghost: 0.2, dials: allDials({ ...HOVER_DIALS, footprint: { ...HOVER_DIALS.footprint, weight: 2 } }) },
  hidden: { style: 'tint', color: 'fixed', fixed: HIDDEN_COLOR, ghost: 0, dials: allDials({ ...HIDDEN_DIALS, tint: { mode: 'wash', strength: 0.3, pulse: 0.6 } }) },
  pending: { style: 'halo', color: 'fixed', fixed: '#ffffff', ghost: 0, dials: allDials(PENDING_DIALS) },
  multi: { mode: 'each', groupStyle: 'footprint', groupPad: 0.6 },
};
// the game's look before the lab (sel 0.16 ft pulsing halo, hover 0.07 steady white, hidden 0.11 violet, pending fast)
const HOUSE_HALO = {
  fx: 'selection', name: 'house-halo',
  selected: { style: 'halo', color: 'seat', fixed: '#ffd166', ghost: 0, dials: allDials() },
  hover: { style: 'halo', color: 'fixed', fixed: '#ffffff', ghost: 0, dials: allDials(HOVER_DIALS) },
  hidden: { style: 'halo', color: 'fixed', fixed: HIDDEN_COLOR, ghost: 0, dials: allDials(HIDDEN_DIALS) },
  pending: { style: 'halo', color: 'fixed', fixed: '#ffffff', ghost: 0, dials: allDials(PENDING_DIALS) },
  multi: { mode: 'each', groupStyle: 'footprint', groupPad: 0.6 },
};
export const MULTI_SCHEMA = [
  { k: 'mode', label: 'Several selected', type: 'select', options: [['each', 'each thing its own'], ['each+group', 'each, plus one outline round the group'], ['group', 'one outline round the group only']] },
  { k: 'groupStyle', label: 'Group outline', type: 'select', options: [['footprint', 'footprint rectangle (dashed)'], ['ring', 'ground ring']] },
  R('groupPad', 'Group padding', 0, 3, 0.1, 'ft'),
];

const clone = (o) => JSON.parse(JSON.stringify(o));
// deep merge of a (possibly partial or older) preset over the defaults
export function mergeSelection(p) {
  const out = clone(SELECTION_DEFAULTS);
  if (!p) return out;
  if (p.name) out.name = p.name;
  for (const st of ['selected', 'hover', 'hidden', 'pending']) {
    const s = p[st]; if (!s) continue;
    for (const k of ['style', 'color', 'fixed', 'ghost']) if (s[k] !== undefined) out[st][k] = s[k];
    for (const [style, d] of Object.entries(s.dials || {})) if (out[st].dials[style]) Object.assign(out[st].dials[style], d);
  }
  if (p.multi) Object.assign(out.multi, p.multi);
  if (!STYLE_DEFAULTS[out.selected.style]) out.selected.style = 'halo';
  return out;
}

// curated starting points, each a whole look (selected + hover); the lab's Load list shows them as built-ins
const look = (name, selStyle, selDials, hovStyle, hovDials, extra = {}) => {
  const p = clone(SELECTION_DEFAULTS); p.name = name;
  p.selected.style = selStyle; Object.assign(p.selected.dials[selStyle], selDials);
  p.hover.style = hovStyle; Object.assign(p.hover.dials[hovStyle], hovDials);
  for (const [k, v] of Object.entries(extra)) Object.assign(p[k], v);
  return p;
};
export const SELECTION_BUILTINS = {
  'harry-v1': () => clone(SELECTION_DEFAULTS),
  'house-halo': () => mergeSelection(HOUSE_HALO),
  'quiet-ring': () => look('quiet-ring', 'ring', { mode: 'solid', width: 0.22, fill: 0.08 }, 'ring', { width: 0.12, opacity: 0.45 }),
  'rts-rotating': () => look('rts-rotating', 'ring', { mode: 'rotating', dashes: 12, width: 0.35, fill: 0.15, spin: 0.12 }, 'ring', { mode: 'dashed', width: 0.15, opacity: 0.5 }),
  'ink-and-tint': () => look('ink-and-tint', 'ink', { thickness: 3.5 }, 'tint', { mode: 'brighten', strength: 0.12 }),
  'rim-glow': () => look('rim-glow', 'rim', { power: 2, intensity: 1.6, pulse: 0.4 }, 'rim', { intensity: 0.5 }),
  'hud-brackets': () => look('hud-brackets', 'brackets', { anim: 'snap' }, 'footprint', { weight: 1.5, round: 0.4, opacity: 0.6 }),
  'spotlight': () => look('spotlight', 'spotlight', { mode: 'both' }, 'rim', { intensity: 0.5 }),
  'lifted': () => look('lifted', 'lift', {}, 'lift', { height: 0.2 }),
  'fireflies': () => look('fireflies', 'motes', {}, 'tint', { mode: 'brighten', strength: 0.1 }),
  'drafting-table': () => look('drafting-table', 'footprint', { weight: 2.5, dash: 0.5, gap: 0.3, round: 0.5, pad: 0.4, glow: 0.4, pulse: 0 }, 'footprint', { weight: 1.5, round: 0.5, pad: 0.4, opacity: 0.5 }),
};

// ---------------------------------------------------------------- shaders
const HALO_VS = `uniform float thick; uniform float pulse;
  varying float vFacing;
  void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vec3 wn = normalize(mat3(modelMatrix) * normal);
    wp.xyz += wn * thick * (0.75 + 0.5 * pulse); vec4 mv = viewMatrix * wp;
    vFacing = abs(dot(normalize(mat3(viewMatrix) * wn), normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv; }`;
const HALO_FS = `uniform vec3 color; uniform float alpha; uniform float pulse; uniform float soft; varying float vFacing;
  void main() { float s = mix(1.0, smoothstep(0.0, 0.7, vFacing), soft); gl_FragColor = vec4(color, alpha * (0.55 + 0.45 * pulse) * s); }`;
// ink: an inverted hull pushed out by a constant number of PIXELS in clip space (a screen-space silhouette), depth-tested
const INK_VS = `uniform float thick; uniform vec2 res;
  void main() { vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec3 vn = normalize(normalMatrix * normal); vec2 d = (projectionMatrix * vec4(vn, 0.0)).xy;
    float L = length(d); if (L > 1e-5) clip.xy += d / L * thick * 2.0 / res * clip.w;
    gl_Position = clip; }`;
const FLAT_FS = `uniform vec3 color; uniform float alpha; void main() { gl_FragColor = vec4(color, alpha); }`;
// rim / tint: overlays drawn exactly on the thing's own surface (depth LessEqual + polygon offset)
const SURF_VS = `varying vec3 vN; varying vec3 vV;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const RIM_FS = `uniform vec3 color; uniform float alpha; uniform float power; varying vec3 vN; varying vec3 vV;
  void main() { float f = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), power); gl_FragColor = vec4(color * f * alpha, 1.0); }`;
// ground disc / ring (local xy in feet; r = outer radius)
const DISC_VS = `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FS = `uniform vec3 color; uniform float alpha; uniform float r; uniform float w; uniform float dashes; uniform float dashed; uniform float spin; uniform float fill; uniform float soft;
  varying vec2 vP;
  void main() { float d = length(vP); float e = max(0.02, soft * w * 0.5 + 0.01);
    float band = smoothstep(r - w - e, r - w + e, d) * (1.0 - smoothstep(r - e, r + e * 0.5, d));
    if (dashed > 0.5) { float a = atan(vP.y, vP.x) / 6.2831853 + spin; float f = fract(a * dashes); band *= smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(0.52, 0.58, f)); }
    float inner = fill * (1.0 - smoothstep(r - w - e, r - w + e, d)) * (0.55 + 0.45 * smoothstep(0.0, r, d));
    float a = max(band, inner) * alpha; if (a < 0.003) discard; gl_FragColor = vec4(color, a); }`;
const SHADOW_FS = `uniform vec3 color; uniform float alpha; uniform vec2 half; varying vec2 vP;
  void main() { vec2 q = vP / half; float d = length(q); float a = alpha * (1.0 - smoothstep(0.35, 1.0, d)); if (a < 0.003) discard; gl_FragColor = vec4(color, a); }`;
const POOL_FS = `uniform vec3 color; uniform float alpha; uniform float r; varying vec2 vP;
  void main() { float d = length(vP) / r; float a = alpha * pow(max(0.0, 1.0 - d), 1.6); if (a < 0.003) discard; gl_FragColor = vec4(color * a, 1.0); }`;
const CONE_VS = `varying float vY; varying float vF; uniform float hgt;
  void main() { vY = position.y / hgt + 0.5; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vF = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const CONE_FS = `uniform vec3 color; uniform float alpha; varying float vY; varying float vF;
  void main() { float a = alpha * pow(vF, 2.0) * (0.25 + 0.75 * vY) * smoothstep(0.0, 0.15, vY) * smoothstep(1.0, 0.85, vY); gl_FragColor = vec4(color * a, 1.0); }`;
// the scene dim: a full-screen quad with soft bright pools around up to 4 spotlit things
const DIM_VS = `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const DIM_FS = `uniform vec2 res; uniform vec4 spots[4]; uniform int n; uniform float dim[4];
  void main() { vec2 p = gl_FragCoord.xy / res; float top = 0.0;
    for (int i = 0; i < 4; i++) { if (i >= n) break; top = max(top, dim[i]); }
    float a = top;
    for (int i = 0; i < 4; i++) { if (i >= n) break; vec2 d = p - spots[i].xy; d.x *= res.x / res.y;
      a = min(a, top * smoothstep(spots[i].z, spots[i].z * (1.0 + spots[i].w * 1.5) + 1e-4, length(d))); }
    gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`;
const MOTE_VS = `uniform float size; uniform float scale; attribute float phase; varying float vA; uniform float t;
  void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(0.1, -mv.z);
    vA = 0.6 + 0.4 * sin(t * 3.0 + phase * 6.2831853); gl_Position = projectionMatrix * mv; }`;
const MOTE_FS = `uniform vec3 color; uniform float alpha; varying float vA;
  void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; float a = alpha * vA * pow(max(0.0, 1.0 - d), 1.8); if (a < 0.003) discard; gl_FragColor = vec4(color * a * 1.6 + vec3(a * 0.5), 1.0); }`;

const shader = (vs, fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthWrite: false, depthTest: true, ...extra });
const tag = (o) => { o.userData.halo = true; o.userData.noPick = true; o.userData.selFx = true; o.castShadow = o.receiveShadow = false; return o; };
const wave = (hz, t) => hz > 0 ? 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2) : 0.6;

// A pushed-out hull needs ONE normal per position: the decimated meshes split vertices at hard edges and UV seams, and
// pushing split vertices apart along different normals tears the hull into spikes (Gemini's blind read, 2026-10-04).
// Same positions and index, normals averaged per position (quantized); cached per geometry, the source is untouched.
const smoothCache = new WeakMap();
function smoothed(geo) {
  if (smoothCache.has(geo)) return smoothCache.get(geo);
  const P = geo.attributes.position, N = geo.attributes.normal, n = P.count, key = new Map(), out = new Float32Array(n * 3), id = new Int32Array(n);
  const acc = [];
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
    let j = key.get(k); if (j === undefined) { j = acc.length / 3; key.set(k, j); acc.push(0, 0, 0); }
    id[i] = j; acc[j * 3] += N.getX(i); acc[j * 3 + 1] += N.getY(i); acc[j * 3 + 2] += N.getZ(i);
  }
  for (let i = 0; i < n; i++) {
    const j = id[i], x = acc[j * 3], y = acc[j * 3 + 1], z = acc[j * 3 + 2], L = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / L; out[i * 3 + 1] = y / L; out[i * 3 + 2] = z / L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', P); g.setAttribute('normal', new THREE.BufferAttribute(out, 3)); if (geo.index) g.setIndex(geo.index);
  for (const gr of geo.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
  smoothCache.set(geo, g);
  return g;
}

// ---------------------------------------------------------------- the renderer
// ridersOf(item): the things that sit on it (lift carries them along, or the plates stay behind inside the lifted table)
export function createSelection({ scene, camera, renderer = null, params = null, parent = null, ridersOf = null } = {}) {
  let P = mergeSelection(params);
  const root = new THREE.Group(); root.name = 'selection-fx'; tag(root);
  (parent || scene).add(root);
  const entries = new Map(); // item -> Map(state -> entry)
  let cam = camera, t = 0;
  const res = new THREE.Vector2(innerWidth || 1280, innerHeight || 720);
  const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpB = new THREE.Box3();

  // dim quad for the spotlight (shared)
  const dimMat = shader(DIM_VS, DIM_FS, { res: { value: res }, spots: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) }, n: { value: 0 }, dim: { value: [0, 0, 0, 0] } }, { depthTest: false });
  const dimQuad = tag(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dimMat));
  dimQuad.frustumCulled = false; dimQuad.renderOrder = 60; dimQuad.visible = false; root.add(dimQuad);

  const wrap = new WeakMap(); // a bare Object3D gets one stable wrapper (entries are keyed by the item)
  const norm = (item) => item?.isObject3D ? (wrap.get(item) || wrap.set(item, { group: item, visual: item }).get(item)) : item;
  const lifts = new Map(); // visual -> { base, n }: the true rest height, however many lifts overlap
  const meshesOf = (visual) => { const out = []; visual?.traverse(o => { if (o.isMesh && !o.isSprite && !(o instanceof THREE.Sprite) && !o.userData.halo && !o.userData.selFx && o.geometry?.attributes?.position && o.visible !== false) out.push(o); }); return out; };
  const colorFor = (st, seat) => new THREE.Color(P[st]?.color === 'seat' && seat ? seat : P[st]?.fixed || '#ffffff');

  // the thing's box in its root's frame (cancels the root's spawn scale / yaw), measured once per build
  function localBox(item) {
    const g = item.group; g.updateWorldMatrix(true, true);
    const inv = tmpM.copy(g.matrixWorld).invert(), b = new THREE.Box3();
    for (const m of meshesOf(item.visual)) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); b.union(tmpB.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))); }
    if (b.isEmpty() && item.dims) { const [w, h, d] = item.dims; b.set(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2)); }
    return b.isEmpty() ? null : b;
  }

  // the height (root frame) of what the thing stands on: a rug or a mat lies over the floor its box starts at, and a
  // ground style drawn at the box's base would sit UNDER the rug (depth-hidden). Rays straight down near the base.
  const downRay = new THREE.Raycaster();
  function groundOf(item, b) {
    const sc = root.parent, g = item.group; if (!sc || !g) return b.min.y;
    g.updateWorldMatrix(true, true);
    const inv = tmpM.copy(g.matrixWorld).invert().clone(), mine = (o) => { for (let x = o; x; x = x.parent) if (x === g || x === root) return true; return false; };
    const targets = sc.children.filter(o => o !== root && o.visible !== false && !o.isLight);
    let top = b.min.y;
    const fx = [0.5, 0.1, 0.9, 0.1, 0.9], fz = [0.5, 0.1, 0.1, 0.9, 0.9];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * fx[i], b.min.y + 0.4, b.min.z + (b.max.z - b.min.z) * fz[i]).applyMatrix4(g.matrixWorld);
      downRay.set(p, new THREE.Vector3(0, -1, 0)); downRay.far = 0.8; downRay.camera = cam;
      for (const h of downRay.intersectObjects(targets, true)) {
        const o = h.object; if (!o.isMesh || o.isSprite || o instanceof THREE.Sprite || o.userData?.selFx || o.userData?.halo || mine(o)) continue;
        let vis = true; for (let x = o; x; x = x.parent) if (x.visible === false) { vis = false; break; }
        if (!vis) continue;
        top = Math.max(top, h.point.clone().applyMatrix4(inv).y); break;
      }
    }
    return Math.min(top, b.min.y + 0.4);
  }

  // overlay copies of the thing's meshes: they follow the source meshes' world matrices every tick
  function shellOf(e, mat, renderOrder = 2, smooth = false) {
    const g = tag(new THREE.Group());
    for (const m of meshesOf(e.item.visual)) {
      if (!m.geometry.attributes.normal) continue;
      const o = tag(new THREE.Mesh(smooth ? smoothed(m.geometry) : m.geometry, mat)); o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; o.renderOrder = renderOrder; o.frustumCulled = false;
      o.userData.src = m; g.add(o);
    }
    return g;
  }
  // an object placed in the thing's ROOT frame (ground styles): follows group.matrixWorld × local
  function inRoot(e, obj) { const h = tag(new THREE.Group()); h.matrixAutoUpdate = false; h.matrixWorldAutoUpdate = false; h.userData.rootFrame = true; obj.matrixAutoUpdate = true; h.add(obj); return h; }
  function lineMat(color, width, opacity, dash = 0, gap = 0.3) {
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: true, depthWrite: false, dashed: dash > 0, dashSize: dash || 1, gapSize: gap, worldUnits: false });
    m.resolution.copy(res); return m;
  }
  // an outline pushed outward by g (right-angled corners; clockwise seen from above, so an edge heading (dx, dz) has its
  // outside at (dz, -dx)): [{ p: [x, z], back: [ux, uz], on: [ux, uz], lb, lo }] per corner (unit vectors to the previous
  // and the next corner, and those edges' lengths)
  function outlineCorners(O, g) {
    const n = O.length, out = [];
    for (let k = 0; k < n; k++) {
      const a = O[(k + n - 1) % n], b = O[k], c = O[(k + 1) % n];
      const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
      const e1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], e2 = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
      out.push({ p: [b[0] + (e1[1] + e2[1]) * g, b[1] - (e1[0] + e2[0]) * g], back: [-e1[0], -e1[1]], on: e2, lb: l1, lo: l2 });
    }
    return out;
  }
  // a rounded rectangle on the ground (root frame), as line segments
  function roundRect(x0, z0, x1, z1, rad, y) {
    rad = Math.max(0, Math.min(rad, (x1 - x0) / 2 - 1e-3, (z1 - z0) / 2 - 1e-3));
    const pts = [], seg = rad > 0 ? 6 : 0;
    const corner = (cx, cz, a0) => { if (!seg) { pts.push([cx, cz]); return; } for (let i = 0; i <= seg; i++) { const a = a0 + i / seg * Math.PI / 2; pts.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad]); } };
    if (seg) { corner(x1 - rad, z1 - rad, 0); corner(x0 + rad, z1 - rad, Math.PI / 2); corner(x0 + rad, z0 + rad, Math.PI); corner(x1 - rad, z0 + rad, Math.PI * 1.5); }
    else { pts.push([x1, z1], [x0, z1], [x0, z0], [x1, z0]); }
    const pos = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; pos.push(a[0], y, a[1], b[0], y, b[1]); }
    return pos;
  }
  function ghostCopy(obj, ghost) { // the occluded part, faintly: depth GREATER (only where something is in front)
    if (!(ghost > 0)) return null;
    const c = obj.clone(true);
    c.traverse(o => { if (!o.material) return; const m = o.material.clone(); m.depthFunc = THREE.GreaterDepth; if (m.isLineMaterial) { m.opacity *= ghost; m.resolution.copy(res); } else if (m.uniforms?.alpha) { m.uniforms = THREE.UniformsUtils.clone(m.uniforms); m.uniforms.alpha.value *= ghost; m.userData.ghost = ghost; } o.material = m; tag(o); });
    c.userData.ghostOf = obj; return c;
  }

  // ---- builders: each returns { obj, anim(t, e), dispose? } (obj is added to root)
  const B = {
    halo(e, d, col) {
      const mat = shader(HALO_VS, HALO_FS, { color: { value: col }, thick: { value: d.width }, alpha: { value: d.intensity }, pulse: { value: 1 }, soft: { value: d.soft } }, { side: THREE.BackSide });
      return { obj: shellOf(e, mat, 2, d.smooth !== false), anim(t) { const w = wave(d.pulse, t + e.phase); mat.uniforms.pulse.value = d.pulse > 0 ? 1 - d.depth + d.depth * w : 0.6; }, mats: [mat] };
    },
    ink(e, d, col) {
      const c = col.clone().lerp(new THREE.Color('#0b0b0a'), d.dark);
      const mat = shader(INK_VS, FLAT_FS, { color: { value: c }, alpha: { value: d.opacity }, thick: { value: d.thickness * (renderer?.getPixelRatio?.() || 1) }, res: { value: res } }, { side: THREE.BackSide });
      return { obj: shellOf(e, mat, 3, true), mats: [mat] };
    },
    rim(e, d, col) {
      const mat = shader(SURF_VS, RIM_FS, { color: { value: col }, alpha: { value: d.intensity }, power: { value: d.power } }, { blending: THREE.AdditiveBlending, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      return { obj: shellOf(e, mat, 3), anim(t) { mat.uniforms.alpha.value = d.intensity * (d.pulse > 0 ? 0.55 + 0.45 * wave(d.pulse, t + e.phase) : 1); }, mats: [mat] };
    },
    tint(e, d, col) {
      const add = d.mode === 'brighten';
      const mat = shader(SURF_VS, FLAT_FS, { color: { value: add ? col.clone().lerp(new THREE.Color('#ffffff'), 0.5) : col }, alpha: { value: d.strength } }, { blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
      if (add) mat.fragmentShader = `uniform vec3 color; uniform float alpha; void main() { gl_FragColor = vec4(color * alpha, 1.0); }`;
      return { obj: shellOf(e, mat, 3), anim(t) { mat.uniforms.alpha.value = d.strength * (d.pulse > 0 ? 0.5 + 0.5 * wave(d.pulse, t + e.phase) : 1); }, mats: [mat] };
    },
    footprint(e, d, col) {
      const b = e.box; if (!b) return null;
      const p = d.pad, y = e.gy + 0.05;
      const trace = () => { const C = outlineCorners(e.item.outline, (e.item.outset || 0) + p), pos = []; for (let k = 0; k < C.length; k++) { const a = C[k].p, c = C[(k + 1) % C.length].p; pos.push(a[0], y, a[1], c[0], y, c[1]); } return pos; }; // not a rectangle: its outline, a pad outside it
      const mk = (w, a) => { const m = lineMat(col, w, a, d.dash, d.gap); const l = new LineSegments2(new LineSegmentsGeometry().setPositions(e.item.outline ? trace() : roundRect(b.min.x - p, b.min.z - p, b.max.x + p, b.max.z + p, d.round, y)), m); if (d.dash > 0) l.computeLineDistances(); l.renderOrder = 3; return tag(l); };
      const g = tag(new THREE.Group()); const main = mk(d.weight, d.opacity); g.add(main);
      const mats = [main.material];
      if (d.glow > 0) { const soft = mk(d.weight * 3.5, d.opacity * 0.3 * d.glow); soft.renderOrder = 2; g.add(soft); mats.push(soft.material); }
      const base = mats.map(m => m.opacity);
      return { obj: inRoot(e, g), ghost: true, anim(t) { const k = d.pulse > 0 ? 0.55 + 0.45 * wave(d.pulse, t + e.phase) : 1; mats.forEach((m, i) => { m.opacity = base[i] * k; }); }, mats };
    },
    ring(e, d, col) {
      const b = e.box; if (!b) return null;
      const r = Math.max(0.6, Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 * d.radius);
      const disc = d.mode === 'disc';
      const mat = shader(DISC_VS, RING_FS, { color: { value: col }, alpha: { value: d.opacity }, r: { value: r }, w: { value: disc ? r : Math.min(d.width, r * 0.8) }, dashes: { value: d.dashes }, dashed: { value: d.mode === 'dashed' || d.mode === 'rotating' ? 1 : 0 }, spin: { value: 0 }, fill: { value: disc ? 0 : d.fill }, soft: { value: d.soft } }, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      if (disc) { mat.uniforms.fill.value = 0; mat.uniforms.w.value = r; }
      const m = tag(new THREE.Mesh(new THREE.CircleGeometry(r + 0.2, 96), mat)); m.rotation.x = -Math.PI / 2; m.position.set((b.min.x + b.max.x) / 2, e.gy + 0.045, (b.min.z + b.max.z) / 2); m.renderOrder = 3;
      if (disc) mat.uniforms.alpha.value = d.opacity * Math.max(0.15, d.fill * 1.5 || 0.35);
      return { obj: inRoot(e, m), ghost: true, anim(t) { if (d.mode === 'rotating') mat.uniforms.spin.value = t * d.spin; }, mats: [mat], geos: [m.geometry] };
    },
    lift(e, d, col) {
      const b = e.box; if (!b) return null;
      const v = e.item.visual, vis = [v];
      const walk = (it, depth) => { if (depth > 4) return; for (const r of ridersOf?.(it) || []) if (r?.visual && !vis.includes(r.visual)) { vis.push(r.visual); walk(r, depth + 1); } };
      walk(e.item, 0);
      const Ls = vis.map(x => { if (!lifts.has(x)) lifts.set(x, { base: x.position.y, n: 0 }); const L = lifts.get(x); L.n++; return [x, L]; });
      e.liftT = e.liftT || 0;
      const half = new THREE.Vector2((b.max.x - b.min.x) / 2 * 1.05 + 0.15, (b.max.z - b.min.z) / 2 * 1.05 + 0.15);
      const sc = new THREE.Color('#000000').lerp(col, d.color);
      const mat = shader(DISC_VS, SHADOW_FS, { color: { value: sc }, alpha: { value: d.shadow }, half: { value: half } }, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
      const m = tag(new THREE.Mesh(new THREE.PlaneGeometry(half.x * 2, half.y * 2), mat)); m.rotation.x = -Math.PI / 2; m.position.set((b.min.x + b.max.x) / 2, e.gy + 0.04, (b.min.z + b.max.z) / 2); m.renderOrder = 2;
      return { obj: inRoot(e, m), mats: [mat], geos: [m.geometry],
        anim(t, dt) {
          if (e.item.visual !== v) return;
          e.liftT = Math.min(1, e.liftT + dt / Math.max(0.02, d.rise));
          const k = 1 - Math.pow(1 - e.liftT, 3), h = (d.height + (d.rate > 0 ? Math.sin((t + e.phase) * d.rate * Math.PI * 2) * d.bob : 0)) * k;
          for (const [x, L] of Ls) x.position.y = L.base + h; e.lifted = h;
          const s = 1 / (1 + h * 0.6); m.scale.set(s, s, 1); mat.uniforms.alpha.value = d.shadow * (0.5 + 0.5 * s);
        },
        undo() { for (const [x, L] of Ls) { x.position.y = L.base; if (--L.n <= 0) lifts.delete(x); } e.lifted = 0; }, riders: vis.length - 1 };
    },
    motes(e, d, col) {
      const b = e.box; if (!b) return null;
      const n = Math.round(d.count), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('phase', new THREE.Float32BufferAttribute(Float32Array.from({ length: n }, (_, i) => (i * 0.618034) % 1), 1));
      const mat = shader(MOTE_VS, MOTE_FS, { color: { value: col }, alpha: { value: d.opacity }, size: { value: d.size }, scale: { value: 1 }, t: { value: 0 } }, { blending: THREE.AdditiveBlending });
      const pts = tag(new THREE.Points(geo, mat)); pts.frustumCulled = false; pts.renderOrder = 4;
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, rx = Math.max(0.5, (b.max.x - b.min.x) / 2 * d.radius * 1.15), rz = Math.max(0.5, (b.max.z - b.min.z) / 2 * d.radius * 1.15), h = b.max.y - b.min.y;
      return { obj: inRoot(e, pts), ghost: true, mats: [mat], geos: [geo],
        anim(t) {
          const a = geo.attributes.position;
          for (let i = 0; i < n; i++) {
            const ph = i / n, ang = (ph + (t + e.phase) * d.speed * (i % 2 ? 1 : 0.8)) * Math.PI * 2;
            const yy = b.min.y + h * (0.5 + d.spread * 0.5 * Math.sin(ang * 1.7 + i * 2.1)) + 0.1;
            a.setXYZ(i, cx + Math.cos(ang) * rx, yy, cz + Math.sin(ang) * rz);
          }
          a.needsUpdate = true; mat.uniforms.t.value = t;
          mat.uniforms.scale.value = res.y * (cam?.projectionMatrix?.elements[5] || 2) / 2;
        } };
    },
    brackets(e, d, col) {
      const b = e.box; if (!b) return null;
      const mat = lineMat(col, d.weight, d.opacity);
      const l = tag(new LineSegments2(new LineSegmentsGeometry().setPositions(new Array(d.mode === 'screen' ? 48 : 144).fill(0)), mat)); l.renderOrder = 5; l.frustumCulled = false;
      e.t0 = t;
      const ghostLine = () => e.ghostObj && (e.ghostObj.isLineSegments2 ? e.ghostObj : e.ghostObj.children[0]);
      const animate = (tt) => {
        let grow = 1, op = d.opacity;
        if (d.anim === 'breathe') { const w = Math.sin((tt + e.phase) * d.speed * Math.PI * 2); grow = 1 + d.swell * w; op = d.opacity * (0.8 + 0.2 * w); } // a smooth swell, in and out
        else if (d.anim === 'snap') { const k = Math.min(1, (tt - e.t0) * d.speed * 3); grow = 1 + 0.6 * Math.pow(1 - k, 3); op = d.opacity * (0.3 + 0.7 * k); }
        else if (d.anim === 'pulse') op = d.opacity * (0.45 + 0.55 * wave(d.speed, tt + e.phase));
        return [grow, op];
      };
      if (d.mode !== 'screen') { // WORLD: 3-armed corners at the box's top and/or bottom corners, just outside it (honest depth)
        const holder = inRoot(e, l);
        return { obj: holder, ghost: true, mats: [mat], anim(tt) {
          const [grow, op] = animate(tt);
          const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, hx = (b.max.x - b.min.x) / 2 * grow + d.gap, hz = (b.max.z - b.min.z) / 2 * grow + d.gap;
          const top = b.max.y + d.gap * 0.5, bot = Math.max(e.gy ?? b.min.y, b.min.y) + 0.05, arm = Math.min(hx, hz) * 2 * d.size;
          const rise = Math.min(arm, (top - bot) * (d.corners === 'both' ? 0.35 : 0.6));
          const rings = d.corners === 'bottom' ? [[bot, 1]] : d.corners === 'top' ? [[top, -1]] : [[top, -1], [bot, 1]];
          const pos = [];
          if (e.item.outline) { // not a rectangle: a bracket at every corner of the outline (the breathing moves it in and out)
            const C = outlineCorners(e.item.outline, (e.item.outset || 0) + d.gap + (grow - 1) * Math.min(b.max.x - b.min.x, b.max.z - b.min.z) / 2);
            for (const [y, up] of rings) for (const c of C) {
              const [px, pz] = c.p, a1 = Math.min(arm, c.lb * 0.45), a2 = Math.min(arm, c.lo * 0.45);
              pos.push(px, y, pz, px + c.back[0] * a1, y, pz + c.back[1] * a1, px, y, pz, px + c.on[0] * a2, y, pz + c.on[1] * a2, px, y, pz, px, y + up * rise, pz);
            }
            l.geometry.setPositions(pos); mat.opacity = op;
            const gl = ghostLine(); if (gl) { if (gl.geometry !== l.geometry) gl.geometry.setPositions(pos); gl.material.opacity = op * (e.ghostLevel || 0); }
            return;
          }
          for (const [y, up] of rings) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const px = cx + sx * hx, pz = cz + sz * hz;
            pos.push(px, y, pz, px - sx * arm, y, pz, px, y, pz, px, y, pz - sz * arm, px, y, pz, px, y + up * rise, pz);
          }
          l.geometry.setPositions(pos); mat.opacity = op;
          const gl = ghostLine(); if (gl) gl.material.opacity = op * (e.ghostLevel || 0);
        } };
      }
      return { obj: l, ghost: true, mats: [mat],
        anim(tt) { // SCREEN: HUD brackets in the camera's plane, a little in front of the thing's nearest corner, round its screen box
          if (!cam) return;
          const g = e.item.group, corners = [];
          for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(g.matrixWorld).applyMatrix4(cam.matrixWorldInverse));
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, zn = -Infinity, zf = Infinity;
          for (const c of corners) { zn = Math.max(zn, c.z); zf = Math.min(zf, c.z); }
          const zb = Math.min(-(cam.near || 0.1) * 1.5, zn + d.gap + 0.6); // the plane: a little in front of the nearest corner
          for (const c of corners) { const k = zb / c.z; x0 = Math.min(x0, c.x * k); x1 = Math.max(x1, c.x * k); y0 = Math.min(y0, c.y * k); y1 = Math.max(y1, c.y * k); }
          const gap = d.gap * Math.abs(zb / ((zn + zf) / 2));
          const [grow, op] = animate(tt);
          const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 * grow + gap, hy = (y1 - y0) / 2 * grow + gap;
          const arm = Math.min(hx, hy) * 2 * d.size;
          const pos = [];
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const px = cx + sx * hx, py = cy + sy * hy;
            pos.push(px, py, zb, px - sx * arm, py, zb, px, py, zb, px, py - sy * arm, zb);
          }
          const M = cam.matrixWorld;
          for (let i = 0; i < pos.length; i += 3) { tmpV.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(M); pos[i] = tmpV.x; pos[i + 1] = tmpV.y; pos[i + 2] = tmpV.z; }
          l.geometry.setPositions(pos); mat.opacity = op;
          const gl = ghostLine(); if (gl) gl.material.opacity = op * (e.ghostLevel || 0);
        } };
    },
    spotlight(e, d, col) {
      const b = e.box; if (!b) return null;
      const g = tag(new THREE.Group()); const mats = [], geos = [];
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, rr = Math.max(0.8, Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 * 1.15);
      if (d.mode !== 'dim') {
        const c = new THREE.Color('#fff3dc').lerp(col, d.tint);
        const H = d.height, cone = new THREE.CylinderGeometry(rr * 0.18, rr * 1.15, H, 48, 1, true);
        const cm = shader(CONE_VS, CONE_FS, { color: { value: c }, alpha: { value: d.cone }, hgt: { value: H } }, { blending: THREE.AdditiveBlending, side: THREE.FrontSide });
        const cmesh = tag(new THREE.Mesh(cone, cm)); cmesh.position.set(cx, b.min.y + H / 2, cz); cmesh.renderOrder = 4;
        const pm = shader(DISC_VS, POOL_FS, { color: { value: c }, alpha: { value: d.cone * 0.8 }, r: { value: rr * 1.3 } }, { blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
        const pool = tag(new THREE.Mesh(new THREE.CircleGeometry(rr * 1.3, 64), pm)); pool.rotation.x = -Math.PI / 2; pool.position.set(cx, e.gy + 0.045, cz); pool.renderOrder = 3;
        g.add(cmesh, pool); mats.push(cm, pm); geos.push(cone, pool.geometry);
      }
      return { obj: inRoot(e, g), mats, geos, spot: d.mode !== 'cone' };
    },
  };

  function disposeEntry(e) {
    if (e.fx?.undo) e.fx.undo();
    for (const o of [e.obj, e.ghostObj]) if (o) o.parent?.remove(o);
    for (const m of e.fx?.mats || []) m.dispose();
    for (const g of e.fx?.geos || []) g.dispose();
    if (e.ghostObj) e.ghostObj.traverse(o => { if (o.material && o.material !== e.fx?.mats?.[0]) o.material.dispose?.(); });
    e.obj = e.ghostObj = e.fx = null;
  }
  function build(e) {
    disposeEntry(e);
    const S = P[e.state] || P.selected, style = e.style || S.style, d = S.dials[style] || STYLE_DEFAULTS[style];
    e.box = localBox(e.item); e.visual = e.item.visual; e.styleNow = style;
    e.gy = e.box ? groundOf(e.item, e.box) : 0;
    if (!B[style]) return;
    const col = colorFor(e.state, e.seat);
    const fx = B[style](e, d, col);
    if (!fx) return;
    e.fx = fx; e.obj = fx.obj; (e.parent || root).add(fx.obj);
    if (e.tag) fx.obj.traverse(o => { if (o.material) Object.assign(o.material.userData, e.tag); }); // (the game's signal bookkeeping)
    if (fx.ghost && S.ghost > 0) {
      const src = fx.obj.userData.rootFrame ? fx.obj.children[0] : fx.obj;
      const gc = ghostCopy(src, S.ghost);
      if (gc) { e.ghostLevel = S.ghost; e.ghostObj = fx.obj.userData.rootFrame ? inRoot(e, gc) : gc; (e.parent || root).add(e.ghostObj); }
    }
  }
  const sigOf = (e) => { const S = P[e.state] || P.selected, style = e.style || S.style; return JSON.stringify([style, S.dials[style], S.color, S.fixed, S.ghost, S.color === 'seat' ? e.seat : 0]); };

  // ---- multi-select: one outline round the whole group (footprint rectangle or ring)
  let groupFx = null;
  function groupItems() { const out = []; for (const [item, m] of entries) if (m.has('selected') && !m.get('selected').style) out.push(item); return out; }

  const api = {
    root, params: () => clone(P),
    set(p) { P = mergeSelection(p); },
    select(item, state = 'selected', seatColor = null, opts = {}) {
      item = norm(item); if (!item?.group) return;
      if (state === 'hidden-from-players') state = 'hidden';
      let m = entries.get(item); if (!m) entries.set(item, m = new Map());
      const old = m.get(state);
      if (old && old.seat === seatColor && old.style === (opts.style || null)) return;
      if (old) disposeEntry(old);
      m.set(state, { item, state, seat: seatColor, style: opts.style || null, parent: opts.parent || null, tag: opts.tag || null, phase: (m.size * 0.37 + entries.size * 0.23) % 1, sig: null });
    },
    clear(item, state) {
      if (item === undefined) { for (const m of entries.values()) for (const e of m.values()) disposeEntry(e); entries.clear(); return; }
      item = norm(item); const m = entries.has(item) ? item : [...entries.keys()].find(k => k.group === item?.group); const mm = m && entries.get(m); if (!mm) return;
      if (state === 'hidden-from-players') state = 'hidden';
      for (const [s, e] of mm) if (!state || s === state) { disposeEntry(e); mm.delete(s); }
      if (!mm.size) entries.delete(m);
    },
    has(item, state) { const m = entries.get(norm(item)); return !!m && (!state || m.has(state)); },
    tick(dt = 16, now = performance.now(), camera2 = null) {
      if (camera2) cam = camera2;
      t = now / 1000; const dts = Math.min(0.1, dt / 1000);
      if (renderer) { renderer.getDrawingBufferSize(res); } else res.set(innerWidth, innerHeight);
      const multi = P.multi, many = groupItems().length > 1;
      const spots = [];
      for (const [item, m] of entries) {
        // hover hides behind selected (the stronger signal wins on the same thing)
        for (const [state, e] of m) {
          const muted = (state === 'hover' && (m.has('selected'))) || (state === 'selected' && many && multi.mode === 'group' && !e.style);
          if (muted) { if (e.obj) disposeEntry(e); e.sig = null; continue; }
          const s = sigOf(e);
          if (s !== e.sig || e.visual !== item.visual) { build(e); e.sig = s; }
          if (!e.fx) continue;
          item.group.updateWorldMatrix(true, true);
          for (const o of [e.obj, e.ghostObj]) {
            if (!o) continue;
            if (o.userData.rootFrame) { o.matrixWorld.copy(item.group.matrixWorld); o.children[0]?.updateMatrixWorld(true); }
            else o.traverse(c => { if (c.userData.src) c.matrixWorld.copy(c.userData.src.matrixWorld); if (c.userData.ghostSrc) c.matrixWorld.copy(c.userData.ghostSrc.matrixWorld); });
            o.visible = item.group.visible !== false;
          }
          e.fx.anim?.(t, dts, e);
          for (const mm of e.fx.mats || []) if (mm.isLineMaterial) mm.resolution.copy(res);
          if (e.ghostObj) e.ghostObj.traverse(c => { if (c.material?.isLineMaterial) c.material.resolution.copy(res); if (c.material?.uniforms && e.fx.mats?.[0]?.uniforms) for (const k of ['spin', 't', 'scale', 'pulse']) if (c.material.uniforms[k] && e.fx.mats[0].uniforms[k]) c.material.uniforms[k].value = e.fx.mats[0].uniforms[k].value; });
          if (e.fx.spot && e.box && cam && spots.length < 4) {
            const S = P[e.state], d = S.dials.spotlight;
            const c = e.box.getCenter(new THREE.Vector3()).applyMatrix4(item.group.matrixWorld), ndc = c.clone().project(cam);
            const rad = e.box.getSize(new THREE.Vector3()).length() / 2 * d.radius;
            const edge = c.clone().add(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).multiplyScalar(rad)).project(cam);
            if (ndc.z < 1) spots.push([(ndc.x + 1) / 2, (ndc.y + 1) / 2, Math.abs(edge.y - ndc.y) / 2, d.soft, d.dim]);
          }
        }
      }
      // the group outline
      const gi = many && multi.mode !== 'each' ? groupItems() : [];
      if (gi.length > 1) {
        const ub = new THREE.Box3();
        for (const it of gi) { const e = entries.get(it).get('selected'); const b = e.box || localBox(it); if (b) ub.union(b.clone().applyMatrix4(it.group.matrixWorld)); }
        const key = JSON.stringify([multi, ub.min.toArray().map(v => v.toFixed(2)), ub.max.toArray().map(v => v.toFixed(2)), P.selected.fixed, P.selected.color, entries.get(gi[0]).get('selected').seat]);
        if (!groupFx || groupFx.key !== key) {
          if (groupFx) { groupFx.obj.parent?.remove(groupFx.obj); groupFx.mats.forEach(m => m.dispose()); }
          const pseudo = { group: root, visual: null }, e = { item: pseudo, state: 'selected', phase: 0, box: ub.clone().expandByVector(new THREE.Vector3(multi.groupPad, 0, multi.groupPad)) };
          const col = colorFor('selected', entries.get(gi[0]).get('selected').seat);
          const fx = multi.groupStyle === 'ring' ? B.ring(e, { ...STYLE_DEFAULTS.ring, mode: 'dashed', width: 0.25, fill: 0, radius: 1, opacity: 0.8 }, col) : B.footprint(e, { ...STYLE_DEFAULTS.footprint, weight: 2.5, dash: 0.6, gap: 0.35, round: 0.6, pulse: 0, opacity: 0.85 }, col);
          root.add(fx.obj); fx.obj.matrixWorld.identity(); fx.obj.children[0]?.updateMatrixWorld(true);
          groupFx = { key, obj: fx.obj, mats: fx.mats, fx, e };
        }
        groupFx.fx.anim?.(t, dts, groupFx.e); groupFx.mats.forEach(m => { if (m.isLineMaterial) m.resolution.copy(res); });
      } else if (groupFx) { groupFx.obj.parent?.remove(groupFx.obj); groupFx.mats.forEach(m => m.dispose()); groupFx = null; }
      // the shared spotlight dim
      dimQuad.visible = spots.length > 0;
      if (spots.length) { const U = dimMat.uniforms; U.n.value = spots.length; U.res.value.copy(res); spots.forEach((s, i) => { U.spots.value[i].set(s[0], s[1], s[2], s[3]); U.dim.value[i] = s[4]; }); }
    },
    // (tests, the lab) what is drawn now
    stats() {
      const list = [];
      for (const [item, m] of entries) for (const [state, e] of m) {
        let n = 0, depthTest = true, ghost = false, segs = 0; e.obj?.traverse(o => { if (o.material) { n++; if (o.material.depthTest === false) depthTest = false; } if (o.isLineSegments2) segs = Math.max(segs, o.geometry.attributes.instanceStart?.count || 0); });
        if (e.ghostObj) ghost = true;
        list.push({ state, style: e.styleNow || null, drawn: !!e.obj, parts: n, depthTest, ghost, lift: +(e.lifted || 0).toFixed(3), riders: e.fx?.riders || 0, segs });
      }
      return { entries: list, group: !!groupFx, dim: dimQuad.visible };
    },
    // (tests) world-space points along what a ground style draws (lines, the ring's band, motes), for occlusion checks
    samples(state = 'selected') {
      const out = [], v = new THREE.Vector3(), w = new THREE.Vector3();
      for (const m of entries.values()) { const e = m.get(state); if (!e?.obj) continue;
        e.obj.updateMatrixWorld(true);
        e.obj.traverse(o => {
          if (o.isLineSegments2) { const A = o.geometry.attributes.instanceStart, Bq = o.geometry.attributes.instanceEnd;
            for (let i = 0; i < A.count; i++) for (let k = 0; k <= 6; k++) { v.set(A.getX(i), A.getY(i), A.getZ(i)).lerp(w.set(Bq.getX(i), Bq.getY(i), Bq.getZ(i)), k / 6).applyMatrix4(o.matrixWorld); out.push(v.toArray()); } }
          else if (o.isMesh && o.material?.uniforms?.r && o.material.uniforms.w && o.material.uniforms.dashes) { const r = o.material.uniforms.r.value - o.material.uniforms.w.value / 2;
            for (let k = 0; k < 96; k++) { const a = k / 96 * Math.PI * 2; v.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyMatrix4(o.matrixWorld); out.push(v.toArray()); } }
          else if (o.isPoints) { const A = o.geometry.attributes.position; for (let i = 0; i < A.count; i++) { v.fromBufferAttribute(A, i).applyMatrix4(o.matrixWorld); out.push(v.toArray()); } }
        });
      }
      return out;
    },
    dispose() { api.clear(); root.parent?.remove(root); dimMat.dispose(); },
  };
  return api;
}
