// A PAWN'S AURA ON THE TABLE (2026-10-30; docs/PAWNS.md "Aura"; core/aura.js). A light round the figure, after Exalted's
// anima banner, five levels in the pawn's colour (gold, silver-white, blue, green, red, violet):
//   1 dim       a faint shimmer at the base: a thin rippling ring of light on the floor round the disc, a hand high
//   2 glowing   a soft coloured light round the figure: a pool of light on the floor and a soft glow up to the crown
//   3 burning   flame-like light rising to about head height: tongues of light licking up, a few sparks
//   4 bonfire   a tall column of light well above the figure (three figure heights, 18 ft at least), readable across the
//               table: a bright core, tongues, more sparks, a wide pool on the floor
//   5 iconic    the bonfire with a large faint emblem hanging in the column: the pawn's faction's (aura.emblem, else its
//               own faction), else the sun (tools/spawn-tuner/assets/emblems: the faction emblems, reused, not new art)
// ALL OF IT IS COMPUTED LIGHT: shader noise on a light column, a floor pool, sparks. No painted texture but the emblems.
// Everyone sees an aura (it is not a condition with hidden visibility), with the conditions' rules (client/statusfx.js):
// a pawn out of sight in the fog draws none, a pawn hidden from the players is never sent to them, and an INVISIBLE pawn's
// aura is drawn only for those who see it as glass (its owner, the GM side). A pawn looked through in first person draws
// none for the seat looking (its figure is not drawn either: surfaces/fpv.js).
//
// UNDER THE OPEN RING NOTHING IS DRAWN: the conditions' rule (statusfx "Nothing under the ring", app.ringMask), here per
// pixel: every fragment of an aura within the ring's buttons (or an open panel) fades out over the last 10 px.
//
// COST: three instanced draws per world for every aura on the table, whatever the number of pawns: the light columns
// (one open tube each, both faces), the floor (pools and rings), the sprites (sparks and emblems, one atlas of emblems).
// The instances are rewritten each drawn frame (a few floats a pawn). Low graphics and "reduce motion" (statusStill)
// draw the static version: the light stands still and there are no sparks.
import * as THREE from 'three';
import { T } from './tuner.js';
import { factionCatalog } from '../core/faction-catalog.js';
import { explicitFaction } from '../core/factions.js';
import * as AU from '../core/aura.js';
import * as CO from '../core/conditions.js';

// THE LOOK of each level (feet; r = the base's radius, h = the figure's height to the crown). ?aura=k:v,... to compare
export const AURA = {
  // Each level holds everything the one below has, more of it (Gemini, round 1: "L1 actually reads brighter than L2";
  // "a very quiet bottom half ... then an abrupt cliff"). And the FIGURE is lit by its own aura (`lit`: a rim and an
  // underlight in the aura's colour on the figure's own surfaces, the painted miniature's object-source lighting), while
  // the light column's near side is carved away in front of the figure (`carve`), so the painted figure stays the
  // sharpest thing inside its glow (round 1: L4 / L5 "wash the miniature into a flat, unreadable pale-yellow ghost").
  //   tube: radius (r), height (h, at least `min` ft), light, flames (0 soft .. 1 tongues), core, flare (the top's radius)
  //   floor: pool radius (r), pool light, ring light;   lit: on the figure;   sparks
  levels: [null,
    //  reach: how high up the figure its own light climbs (ft; 0 = all of it): the ankles at 1, the lower body at 2, all of it from 3
    // (round 6: the ring outside the base read as "neon hula-hoops": only level 1's shimmer is a ring; above it the floor
    // has a pool that starts at the base's edge, and the base's own top takes the light)
    { tr: 1.0, th: 0.22, min: 0.8, tl: 0.5, fl: 0.2, core: 0, flare: 0.95, pr: 1.45, pl: 0.08, rl: 0.24, lit: 0.45, reach: 1.1, base: 0.35, sparks: 0 },  // 1 dim
    { tr: 1.04, th: 0.95, min: 3.0, tl: 0.75, fl: 0.45, core: 0.15, flare: 0.8, pr: 1.9, pl: 0.2, rl: 0.26, lit: 0.78, reach: 3.0, base: 0.5, sparks: 0 },  // 2 glowing
    { tr: 1.1, th: 1.6, min: 6.0, tl: 1.0, fl: 1.0, core: 0.35, flare: 0.6, pr: 2.3, pl: 0.2, rl: 0.1, lit: 0.64, reach: 0, base: 0.62, sparks: 10 },    // 3 burning
    { tr: 1.2, th: 2.7, min: 13, tl: 0.85, fl: 1.0, core: 0.3, flare: 0.5, pr: 3.0, pl: 0.24, rl: 0.1, lit: 0.62, reach: 0, base: 0.65, sparks: 20 },     // 4 bonfire
    { tr: 1.24, th: 3.0, min: 14, tl: 0.9, fl: 1.0, core: 0.32, flare: 0.55, pr: 3.2, pl: 0.26, rl: 0.1, lit: 0.66, reach: 0, base: 0.7, sparks: 26 },   // 5 iconic
  ],
  carve: 1.0,      // how much of the near side of the column is taken away in front of the figure, up to its crown
  emblem: { over: 0.55, size: 2.4, minSize: 5, light: 0.95 }, // level 5: hanging over the head (its bottom `over` ft above the crown), its size in base radii (ft at least)
  rise: 0.55,      // the flames' climb, columns a second
  spark: { life: 2.2, size: 0.34 },
  maskFade: 10,    // px: as statusfx STATUS.maskFade
  cover: { tube: 0.1, floor: 0.15, sprite: 0 }, // how far the light also covers what is behind it (0 = purely added light). Little: a dim edge with cover reads as soot (round 4)
  stillAt: 4.7,    // seconds: the moment the static version stands at
};
const TAU = Math.PI * 2;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 1000) / 1000; };
const COL = Object.fromEntries(Object.entries(AU.AURA_COLORS).map(([k, v]) => [k, new THREE.Color(v.hex)]));
try { const q = new URLSearchParams(location.search).get('aura'); if (q) for (const p of q.split(',')) { const [k, v] = p.split(':'); if (k in AURA && Number.isFinite(+v)) AURA[k] = +v; } } catch { }

// ---------------- shared GLSL ----------------
const NOISE = `
float h3(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fbm(vec3 p) { return 0.55 * vn(p) + 0.3 * vn(p * 2.03 + 3.1) + 0.15 * vn(p * 4.01 + 7.7); }`;
// the open ring's buttons, in client px (app.ringMask): circles [x, y, r] and boxes [l, t, r, b]; uMV turns gl_FragCoord
// into client px (x scale, y scale, left, bottom)
const MASK_N = 28, MASK_R = 6;
const MASK = `
uniform vec3 uMC[${MASK_N}]; uniform vec4 uMR[${MASK_R}]; uniform int uMN; uniform int uMRN; uniform vec4 uMV; uniform float uMF;
float ringMask() {
  if (uMN == 0 && uMRN == 0) return 1.0;
  vec2 p = vec2(uMV.z + gl_FragCoord.x * uMV.x, uMV.w - gl_FragCoord.y * uMV.y); float d = 1e5;
  for (int i = 0; i < ${MASK_N}; i++) { if (i >= uMN) break; d = min(d, length(p - uMC[i].xy) - uMC[i].z); }
  for (int i = 0; i < ${MASK_R}; i++) { if (i >= uMRN) break; vec4 b = uMR[i]; vec2 q = max(max(b.xy - p, p - b.zw), 0.0); float o = length(q); d = min(d, (p.x > b.x && p.x < b.z && p.y > b.y && p.y < b.w) ? -1.0 : o); }
  return clamp(d / uMF, 0.0, 1.0);
}`;

// THE LIGHT COLUMN: an open tube (y 0..1) per pawn. aP: radius ft, height ft, light, flames; aQ: core, seed, taper, shimmer
const TUBE_VS = `
attribute vec3 aCenter; attribute vec4 aP; attribute vec4 aQ; attribute vec3 aCol; attribute vec3 aK;
uniform float uTime;
varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec4 vP; varying vec4 vQ; varying vec3 vCol; varying vec3 vK;
void main() {
  float y = position.y, sway = sin(uTime * 1.7 + aQ.y * 6.28 + y * 3.0) * 0.05 * aP.w * y, ang = atan(position.z, position.x);
  // (no straight sides: the radius breathes round the column and up it)
  float rr = aP.x * mix(1.0, aQ.z, y) * (1.0 + 0.1 * sin(ang * 3.0 + uTime * 0.9 + y * 5.0 + aQ.y * 9.0) * smoothstep(0.05, 0.4, y)); // (more than this folds the shell into creases: round 8)
  vec3 w = aCenter + vec3(position.x * rr + sway, y * aP.y, position.z * rr + sway * 0.6);
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  vL = vec3(position.x, y, position.z); vN = normalize((viewMatrix * vec4(position.x, 0.0, position.z, 0.0)).xyz); vV = normalize(-mv.xyz);
  vP = aP; vQ = aQ; vCol = aCol; vK = aK;
}`;
const TUBE_FS = `
uniform float uTime; uniform float uRise; uniform float uCover;
varying vec3 vL; varying vec3 vN; varying vec3 vV; varying vec4 vP; varying vec4 vQ; varying vec3 vCol; varying vec3 vK;
${NOISE}
${MASK}
void main() {
  float y = vL.y, H = vP.y, R = vP.x, fl = vP.w, core = vQ.x, seed = vQ.y * 37.0;
  float facing = abs(dot(normalize(vN), normalize(vV)));
  // flames: noise on the tube's own surface (x, z round it; y in feet over the radius so tongues keep their size), climbing
  // (the same size of flame across and up: round 3, "vertical barcode banding" came from cells four times taller than wide)
  vec3 q = vec3(vL.x * 1.7, y * H / max(R, 0.5) * 1.5 - uTime * uRise * (1.0 + 1.6 * fl), vL.z * 1.7) + seed;
  float n = fbm(q), n2 = fbm(q * 2.3 + 11.0);
  // TONGUES like a painted resin flame (round 2: "glowing empty air"; "translucent / painted resin spell effects"): crisp
  // edges, inside them a painted gradient from a deep shade of the colour at the edge to a pale core
  float f = n * 0.85 + n2 * 0.3, th = y * 1.05 + 0.02, depth = f - th;
  float tongues = smoothstep(0.0, 0.05, depth);
  float soft = (0.6 + 0.4 * n) * (1.0 - y * 0.85);
  float shape = mix(soft, tongues * (0.55 + 0.45 * smoothstep(0.05, 0.3, depth)), fl);
  float env = smoothstep(0.0, 0.06, y) * pow(max(0.0, 1.0 - y * (0.85 + 0.3 * n2)), 1.2 + fl * 0.6); // (a ragged top, not a lid)
  float shimmer = vQ.w > 0.0 ? 0.75 + 0.25 * sin(uTime * 2.3 + vL.x * 4.0 + vL.z * 3.0 + seed) : 1.0;
  // thickest face-on, nothing at the silhouette (no tube edge), and the near side carved away in front of the figure
  float a = env * shape * vP.z * smoothstep(0.05, 0.75, facing + (n2 - 0.5) * 0.35) * shimmer; // (a ragged edge, no line: round 4)
  // the near side is not drawn from the floor to the crown (or to the emblem's top): the light rises BEHIND and beside the
  // figure, which stands against it in relief (round 5: "Put vertical aura geometry strictly behind the figure")
  if (gl_FrontFacing) a *= 1.0 - vK.y * (1.0 - smoothstep(vK.x - 0.03, vK.x + 0.08, y));
  // the core: whiter and brighter where the column is thickest (face on) and low
  float hot = core * pow(facing, 3.0) * (1.0 - y) * smoothstep(0.35, 0.8, n);
  vec3 deep = mix(vCol * vCol, vCol, 0.5), pale = mix(vCol, vec3(1.0, 0.98, 0.92), 0.25);
  vec3 c = mix(vCol, mix(deep, mix(vCol, pale, smoothstep(0.12, 0.34, depth)), smoothstep(0.0, 0.1, depth)), fl);
  c = mix(c, vec3(1.0, 0.97, 0.9), clamp(hot * 0.5, 0.0, 0.4)) * (1.0 + hot * 0.4);
  a *= ringMask();
  if (a < 0.003) discard;
  gl_FragColor = vec4(c * a, a * max(uCover, vK.z));
  #include <colorspace_fragment>
}`;

// THE FLOOR: a pool of light and a rippling ring round the base. aD: pool radius ft, pool light, ring light, ring radius ft
const FLOOR_VS = `
attribute vec3 aCenter; attribute vec4 aD; attribute vec3 aCol; attribute float aSeed;
varying vec2 vXY; varying vec4 vD; varying vec3 vCol; varying float vSeed;
void main() {
  vec2 p = position.xy * 2.0 * aD.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(aCenter + vec3(p.x, 0.0, -p.y), 1.0);
  vXY = p; vD = aD; vCol = aCol; vSeed = aSeed;
}`;
const FLOOR_FS = `
uniform float uTime; uniform float uCover;
varying vec2 vXY; varying vec4 vD; varying vec3 vCol; varying float vSeed;
${NOISE}
${MASK}
void main() {
  float d = length(vXY), R = vD.x, rr = vD.w, ang = atan(vXY.y, vXY.x);
  float pool = vD.y * pow(max(0.0, 1.0 - max(0.0, d - rr * 0.92) / max(0.01, R - rr * 0.92)), 1.6); // (full at the base's edge: no dark trough)
  float rip = fbm(vec3(cos(ang) * 2.2, sin(ang) * 2.2, uTime * 0.6 + vSeed * 9.0));
  float band = exp(-pow((d - rr * (0.99 + 0.05 * rip)) / (0.12 * rr + 0.08), 2.0)); // (soft: light grazing the floor at the base's edge, not a neon band: round 5)
  float ring = vD.z * band * (0.45 + 0.75 * rip);
  float a = (pool + ring) * ringMask();
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol * a, a * uCover); // (saturated, never bleached white: round 1)
  #include <colorspace_fragment>
}`;

// SPARKS AND EMBLEMS: quads facing the view. aS: mode (0 spark, 1 emblem), size ft, seed, light; aR: column radius, height,
// life (s), emblem slot
const SPR_VS = `
attribute vec3 aCenter; attribute vec4 aS; attribute vec4 aR; attribute vec3 aCol;
uniform float uTime; uniform float uSlots;
varying vec2 vUv; varying float vA; varying vec3 vCol; varying float vMode; varying vec2 vAt;
void main() {
  vec3 c = aCenter; float size = aS.y, a = aS.w;
  if (aS.x < 0.5) { // a spark: rises round the column, swirling, fading in and out
    float p = fract(aS.z * 7.13 + uTime / aR.z), ang = aS.z * 6.2832 + p * 2.4;
    float rr = aR.x * (0.35 + 0.65 * fract(aS.z * 13.7));
    c += vec3(cos(ang) * rr, p * aR.y * 0.92 + 0.3, sin(ang) * rr);
    a *= smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.6, 1.0, p)); size *= 1.0 - 0.5 * p;
  } else c.y += sin(uTime * 0.6 + aS.z * 6.0) * 0.25; // the emblem: hanging, a slow drift
  vec4 mv;
  if (aS.x < 0.5) { mv = viewMatrix * vec4(c, 1.0); mv.xy += position.xy * size; }
  else { // the emblem stands upright, turned to face the view round the vertical only (round 4: it leaned back like a card)
    vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
    mv = viewMatrix * vec4(c + right * position.x * size + vec3(0.0, position.y * size, 0.0), 1.0);
  }
  gl_Position = projectionMatrix * mv;
  vUv = uv; vA = a; vCol = aCol; vMode = aS.x;
  vAt = vec2(mod(aR.w, uSlots), floor(aR.w / uSlots)); // (the emblem's cell: column, row from the canvas top)
}`;
const SPR_FS = `
uniform sampler2D uMap; uniform float uSlots; uniform float uTime; uniform float uCover;
varying vec2 vUv; varying float vA; varying vec3 vCol; varying float vMode; varying vec2 vAt;
${MASK}
void main() {
  vec2 q = vUv - 0.5; float d = length(q) * 2.0, a; vec3 c;
  if (vMode < 0.5) { a = vA * pow(max(0.0, 1.0 - d), 2.2); c = mix(vCol, vec3(1.0, 0.98, 0.92), 0.55 * (1.0 - d)); }
  else {
    // the emblem as light: its own painting's brightness carries the motif, tinted the aura's colour, its disc's edge gone soft
    vec2 uv = vUv + vec2(sin(vUv.y * 18.0 + uTime * 1.3) * 0.004, 0.0);
    vec2 st = vec2((vAt.x + uv.x) / uSlots, 1.0 - (vAt.y + 1.0 - uv.y) / uSlots), px = vec2(1.5 / (256.0 * uSlots));
    vec4 t = texture2D(uMap, st);
    const vec3 W = vec3(0.299, 0.587, 0.114);
    float lum = dot(t.rgb, W);
    // a relief from the painting's own light and dark (computed: its brightness read as height, lit from the upper left)
    float gx = dot(texture2D(uMap, st + vec2(px.x, 0.0)).rgb - texture2D(uMap, st - vec2(px.x, 0.0)).rgb, W);
    float gy = dot(texture2D(uMap, st + vec2(0.0, px.y)).rgb - texture2D(uMap, st - vec2(0.0, px.y)).rgb, W);
    // a faint luminous silhouette in the aura's one colour (round 4: not "a shaded dark-lined illustration"): its bright
    // parts glow, a soft lift where the painting's light and dark meet, nothing dark ever drawn
    float relief = clamp(abs(gx) + abs(gy), 0.0, 1.0);
    float edge = 1.0 - smoothstep(0.66, 0.97, d);
    a = vA * t.a * edge * (0.2 + 0.8 * smoothstep(0.22, 0.75, lum) + 0.5 * relief);
    c = mix(vCol * 0.85, vec3(1.0, 0.98, 0.94), 0.35 * smoothstep(0.55, 0.95, lum));
  }
  a *= ringMask();
  if (a < 0.003) discard;
  gl_FragColor = vec4(c * a, a * (vMode < 0.5 ? uCover : 0.5)); // (the emblem covers half of what is behind it: no wall seam through its face, round 5)
  #include <colorspace_fragment>
}`;

// THE FIGURE LIT BY ITS AURA (round 1: "Drive levels 2-5 primarily by illuminating the miniature's own normals"): each
// figure material of a pawn with an aura is worn as a clone with a rim light and an underlight in the aura's colour
// (computed on its own normals, after its lighting), the original put back when the aura goes. A clone wraps whatever the
// mesh wears (a condition's treated material too: statusfx), chaining its shader change.
// (round 2: "Tinting the whole miniature uniformly flattens its shading": edges and undersides only, the recesses and
// the faces turned to the viewer left in their own paint.) The base's disc: its bevel and top, lit from round it.
// The light climbs the figure with the level (round 3: "rising from ankle lighting (L1) to lower-body OSL (L2), full-body
// rim lighting (L3)"): uAuraY = (the floor's height, the reach in ft; 0 = all of it). The disc: its bevel only, the top
// left matte grey (round 3: "neon coaster bases").
const LIT_CHUNK = (disc) => `{ vec3 _n = normalize(normal), _v = normalize(vViewPosition), _up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float _rim = pow(1.0 - abs(dot(_n, _v)), 2.6), _under = pow(max(0.0, -dot(_n, _up)), 1.5), _side = 1.0 - abs(dot(_n, _up));
  float _y = (inverse(viewMatrix) * vec4(-vViewPosition, 1.0)).y - uAuraY.x;
  float _k = uAuraY.y > 0.0 ? 1.0 - smoothstep(uAuraY.y * 0.35, uAuraY.y, _y) : 1.0;
  gl_FragColor.rgb += uAuraLit.rgb * uAuraLit.w * _k * ${disc ? '(0.8 * _rim * _side + 0.22 * max(0.0, dot(_n, _up)))' : '(0.9 * _rim + 0.42 * _under)'}; }`;
const LIT = new WeakMap(); // a lit clone -> { src, u }
function litClone(src, disc = false) {
  const m = src.clone(), u = { value: new THREE.Vector4() }, uy = { value: new THREE.Vector2() };
  const key = src.customProgramCacheKey ? src.customProgramCacheKey() : '';
  m.onBeforeCompile = (sh, r) => {
    src.onBeforeCompile?.(sh, r);
    sh.uniforms.uAuraLit = u; sh.uniforms.uAuraY = uy; sh.fragmentShader = 'uniform vec4 uAuraLit;\nuniform vec2 uAuraY;\n' + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + LIT_CHUNK(disc));
  };
  m.customProgramCacheKey = () => key + (disc ? '|aura-lit-disc' : '|aura-lit');
  LIT.set(m, { src, u, uy });
  return m;
}
const litable = (m) => !!m && !Array.isArray(m) && (m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial);

function maskUniforms() {
  return { uMC: { value: Array.from({ length: MASK_N }, () => new THREE.Vector3()) }, uMR: { value: Array.from({ length: MASK_R }, () => new THREE.Vector4()) }, uMN: { value: 0 }, uMRN: { value: 0 }, uMV: { value: new THREE.Vector4(1, 1, 0, 0) }, uMF: { value: AURA.maskFade } };
}
function quads(geo0, cap, vs, fs, uniforms, attrs, side) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = geo0.index; for (const k of ['position', 'uv', 'normal']) if (geo0.attributes[k]) geo.setAttribute(k, geo0.attributes[k]);
  const A = {}; for (const [k, n] of Object.entries(attrs)) { A[k] = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); A[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, A[k]); }
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms, transparent: true, depthWrite: false, side: side || THREE.FrontSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.halo = true; mesh.userData.noPick = true; mesh.userData.auraFx = true; mesh.raycast = () => { };
  return { mesh, geo, A, cap, attrs };
}
function grow(Q, need) {
  if (need <= Q.cap) return;
  const cap = Math.max(need, Q.cap * 2);
  for (const [k, n] of Object.entries(Q.attrs)) { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); a.array.set(Q.A[k].array); Q.A[k] = a; Q.geo.setAttribute(k, a); }
  Q.cap = cap;
}

// ---------------- the emblems: one canvas atlas of the faction emblems in use (packed, not painted) ----------------
const SLOTS = 4, CELL = 256;
let EMB = null;
function emblems() {
  if (EMB) return EMB;
  const c = document.createElement('canvas'); c.width = c.height = SLOTS * CELL;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const slot = new Map(); let next = 0; const loaded = new Set();
  const urlOf = (id) => { const f = factionCatalog(T.lib || {}).factions.find(x => x.id === id); const src = f?.emblem || (id === 'sun' ? 'assets/emblems/sun.webp' : null); return src ? (/^(?:https?:|data:|\/)/.test(src) ? src : (T.base || '') + src) : null; };
  return (EMB = { tex,
    // the slot of an emblem (loading it the first time); -1 while it loads or when there is none
    get(id) {
      if (!id) return -1;
      if (slot.has(id)) return loaded.has(id) ? slot.get(id) : -1;
      const url = urlOf(id); if (!url || next >= SLOTS * SLOTS) { slot.set(id, -1); return -1; }
      const i = next++; slot.set(id, i);
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { g.clearRect((i % SLOTS) * CELL, Math.floor(i / SLOTS) * CELL, CELL, CELL); g.drawImage(im, (i % SLOTS) * CELL, Math.floor(i / SLOTS) * CELL, CELL, CELL); tex.needsUpdate = true; loaded.add(id); };
      im.onerror = () => { slot.set(id, -1); };
      im.src = url; return -1;
    },
    has: (id) => loaded.has(id), urlOf });
}

// ---------------- one world's ----------------
export function createAuraFx(world) {
  const time = { value: 0 };
  const MU = maskUniforms(); // shared by the three materials (the same ring, the same frame)
  const tubeGeo = new THREE.CylinderGeometry(1, 1, 1, 30, 14, true); tubeGeo.translate(0, 0.5, 0);
  const tubes = quads(tubeGeo, 16, TUBE_VS, TUBE_FS, { uTime: time, uRise: { value: AURA.rise }, uCover: { value: AURA.cover.tube }, ...MU }, { aCenter: 3, aP: 4, aQ: 4, aCol: 3, aK: 3 }, THREE.DoubleSide);
  const floors = quads(new THREE.PlaneGeometry(1, 1), 16, FLOOR_VS, FLOOR_FS, { uTime: time, uCover: { value: AURA.cover.floor }, ...MU }, { aCenter: 3, aD: 4, aCol: 3, aSeed: 1 });
  const E = emblems();
  const sprites = quads(new THREE.PlaneGeometry(1, 1), 64, SPR_VS, SPR_FS, { uTime: time, uMap: { value: E.tex }, uSlots: { value: SLOTS }, uCover: { value: AURA.cover.sprite }, ...MU }, { aCenter: 3, aS: 4, aR: 4, aCol: 3 });
  Object.assign(floors.mesh.material, { polygonOffset: true, polygonOffsetFactor: -4 });
  floors.mesh.renderOrder = 6; tubes.mesh.renderOrder = 30; sprites.mesh.renderOrder = 31;
  world.layers.deco.add(floors.mesh, tubes.mesh, sprites.mesh);
  const live = new Set(); // recs with an aura
  let frameCam = null, maskOn = 0, masked = 0;
  // the ring's mask, set on each material just before it draws: on only for the camera this frame's mask was made for
  const MV = MU.uMV.value, _sz = new THREE.Vector2();
  for (const Q of [tubes, floors, sprites]) Q.mesh.onBeforeRender = (renderer, scene, camera) => {
    if (camera !== frameCam || !maskOn) { MU.uMN.value = 0; MU.uMRN.value = 0; return; }
    const rt = renderer.getRenderTarget(); if (rt) _sz.set(rt.width, rt.height); else renderer.getDrawingBufferSize(_sz);
    const R = lastMask.rect; MV.set(R.width / _sz.x, R.height / _sz.y, R.left, R.top + R.height); MU.uMN.value = lastMask.n; MU.uMRN.value = lastMask.nr;
  };
  let lastMask = { n: 0, nr: 0, rect: null };

  const seesInvisible = (e) => !!(world.gmSide || (e.owner && e.owner === world.statusViewer?.()));
  function apply(r) {
    const e = r.entity; if (e.kind !== 'token') return;
    if (AU.auraLevelOf(e) > 0) live.add(r); else { live.delete(r); unlight(r); }
  }
  function drop(r) { live.delete(r); unlight(r); }
  // the figure's own light: its meshes (not the base) wear lit clones; `w` its strength now (0: out of sight, first person)
  const _lc = new THREE.Color();
  function light(r, col, w, wb = w, foot = 0, reach = 0) {
    const v = r.visual; if (!v) return;
    const C = r.auraClones ||= new Map(), disc = v.userData.base?.userData.disc;
    v.traverse(o => {
      if (!o.isMesh || o.userData.halo || (o.userData.pawnBase && o !== disc)) return; // (of the base, only its grey disc: the seat's rim is statusfx's)
      let m = o.material, L = LIT.get(m);
      if (!L) { if (!litable(m)) return; const k = o === disc ? 'disc' : m; let c = C.get(k); if (!c || LIT.get(c).src !== m) { c = litClone(m, o === disc); C.set(k, c); } o.material = c; L = LIT.get(c); }
      L.u.value.set(col.r, col.g, col.b, o === disc ? wb : w); L.uy.value.set(foot, o === disc ? 0 : reach);
    });
  }
  function unlight(r) {
    if (!r.auraClones) return;
    r.visual?.traverse(o => { if (!o.isMesh) return; const L = LIT.get(o.material); if (L) o.material = L.src; const B = LIT.get(o.userData.statusBase); if (B) o.userData.statusBase = B.src; }); // (and a condition's look put back later goes back to the unlit one)
    for (const c of r.auraClones.values()) c.dispose(); r.auraClones = null;
  }
  function shown(r) {
    if (!r.group.visible || r.asleep || !r.group.parent || !r.visual || r.visual.visible === false) return false;
    for (let o = r.group.parent; o; o = o.parent) if (!o.visible) return false;
    if (world.fogActive && world.fogRule?.(r.entity)) return false;
    if ((r.entity.conditions || []).some(c => CO.condKey(c) === 'invisible') && !seesInvisible(r.entity)) return false;
    return true;
  }
  const headY = (r) => world.statusFx?.headY?.(r) ?? (r.visual?.userData.labelY != null ? r.visual.userData.labelY - 0.95 : 3.6);
  const emblemOf = (e) => e.aura?.emblem || explicitFaction(e) || 'sun';

  // where each aura is, this frame (also for the tests): [{ id, level, color, c, R, H, emblem }]
  let placed = [];
  let held = false, skip = null; // (tests) draw nothing this while (the ring-fade pixel check compares the picture with and without); skip: one part only (debugging)
  function frame(now, camera) {
    if (held) { for (const Q of [tubes, floors, sprites]) { Q.geo.instanceCount = 0; Q.mesh.visible = false; } placed = []; return 0; }
    const still = !!world.statusStill?.();
    time.value = still ? AURA.stillAt : now / 1000;
    frameCam = camera;
    // the ring's mask (the conditions' own: world.statusMask; main view only)
    const M = camera && world.statusMask?.(camera);
    maskOn = 0; lastMask = { n: 0, nr: 0, rect: null };
    if (M && (M.circles.length || M.rects.length)) {
      const C = MU.uMC.value, B = MU.uMR.value; let n = 0, nr = 0;
      for (const [x, y, rad] of M.circles) { if (n >= MASK_N) break; C[n++].set(x, y, rad); }
      for (const [l, t, rr, b] of M.rects) { if (nr >= MASK_R) break; B[nr++].set(l, t, rr, b); }
      lastMask = { n, nr, rect: M.rect, M }; maskOn = 1;
    }
    let nt = 0, nf = 0, ns = 0; placed = []; masked = 0;
    for (const r of live) {
      if (!world.recs.has(r.entity.id) || world.recs.get(r.entity.id) !== r) { live.delete(r); continue; }
      const e = r.entity, L = AU.auraLevelOf(e), P = AURA.levels[L]; if (!P) continue;
      if (!shown(r)) { if (r.auraClones) light(r, COL[AU.auraColor(e)], 0); continue; }
      const g = r.group, sc = Math.max(1, g.scale.x || 1), sy = g.scale.y || 1;
      const B = r.visual?.userData.base?.userData, rad = (B?.radius || 1.8) * sc;
      const foot = g.position.y - (r.footDrop || 0), h = Math.max(1.5, headY(r) * sy);
      const col = COL[AU.auraColor(e)], seed = hash(e.id);
      const R = rad * P.tr, H = Math.max(P.min, h * P.th);
      const breathe = still ? 1 : 0.9 + 0.1 * Math.sin(time.value * 2.1 + seed * 9);
      light(r, col, skip?.has('lit') ? 0 : P.lit * breathe, skip?.has('lit') ? 0 : P.base * breathe, foot, P.reach * sy);
      // the column
      grow(tubes, nt + 1);
      tubes.A.aCenter.array.set([g.position.x, foot + 0.02, g.position.z], nt * 3);
      tubes.A.aP.array.set([R, H, P.tl, P.fl], nt * 4);
      tubes.A.aQ.array.set([P.core, seed, P.flare, L === 1 ? 1 : 0], nt * 4);
      const emSize = Math.max(AURA.emblem.minSize, rad * AURA.emblem.size), emAt = Math.min(H * 0.75, h + AURA.emblem.over + emSize / 2);
      tubes.A.aK.array.set([Math.min(1, (L >= 5 ? emAt + emSize * 0.5 : h) / H), AURA.carve, AU.auraColor(e) === 'silver' ? 0.35 : 0], nt * 3); // (z: its own cover: silver-white over a warm floor read orange when only added, round 8)
      tubes.A.aCol.array.set([col.r, col.g, col.b], nt * 3); nt++;
      // the floor
      grow(floors, nf + 1);
      floors.A.aCenter.array.set([g.position.x, foot + 0.05, g.position.z], nf * 3);
      floors.A.aD.array.set([rad * P.pr, P.pl, P.rl, rad * 1.06], nf * 4); // (a tight contact glow at the base's edge: round 2, "neon floor rings")
      floors.A.aCol.array.set([col.r, col.g, col.b], nf * 3); floors.A.aSeed.array[nf] = seed; nf++;
      // the sparks (not in the static version)
      const nsp = still ? 0 : P.sparks;
      grow(sprites, ns + nsp + 1);
      for (let k = 0; k < nsp; k++) {
        sprites.A.aCenter.array.set([g.position.x, foot, g.position.z], ns * 3);
        sprites.A.aS.array.set([0, AURA.spark.size * (L >= 4 ? 1.25 : 1), (seed + k / nsp) % 1, L >= 4 ? 1 : 0.8], ns * 4);
        sprites.A.aR.array.set([R * 0.95, Math.min(H, L >= 4 ? H * 0.8 : H), AURA.spark.life * (0.75 + 0.5 * ((k * 0.618) % 1)) * (L >= 4 ? 1.3 : 1), 0], ns * 4);
        sprites.A.aCol.array.set([col.r, col.g, col.b], ns * 3); ns++;
      }
      // the emblem (level 5)
      let em = null;
      if (L >= 5) {
        const id = emblemOf(e); let s = E.get(id); if (s < 0 && id !== 'sun') s = E.get('sun');
        em = { id: s >= 0 ? (E.has(id) ? id : 'sun') : null, slot: s };
        if (s >= 0) {
          const size = emSize;
          sprites.A.aCenter.array.set([g.position.x, foot + emAt, g.position.z], ns * 3);
          sprites.A.aS.array.set([1, size, seed, AURA.emblem.light], ns * 4);
          sprites.A.aR.array.set([R, H, 1, s], ns * 4);
          sprites.A.aCol.array.set([col.r, col.g, col.b], ns * 3); ns++;
        }
      }
      placed.push({ id: e.id, level: L, color: AU.auraColor(e), c: [g.position.x, foot, g.position.z], R, H, emblem: em, sparks: nsp });
    }
    for (const [Q, n0] of [[tubes, nt], [floors, nf], [sprites, ns]]) { const n = skip && skip.has(Q === tubes ? 'tubes' : Q === floors ? 'floors' : 'sprites') ? 0 : n0; Q.geo.instanceCount = n; Q.mesh.visible = n > 0; if (n) for (const a of Object.values(Q.A)) { a.needsUpdate = true; a.clearUpdateRanges?.(); a.addUpdateRange?.(0, n * a.itemSize); } }
    if (maskOn && camera) masked = placed.filter(p => boxUnder(p, camera)).length;
    return nt + nf + ns;
  }
  // (tests) is any of an aura's screen box under the ring's buttons? (the column's bounding box projected)
  const _v = new THREE.Vector3();
  function screenBox(p, camera, rect) {
    let l = Infinity, t = Infinity, rr = -Infinity, b = -Infinity;
    for (const dy of [0, p.H]) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      _v.set(p.c[0] + dx * p.R, p.c[1] + dy, p.c[2] + dz * p.R).project(camera);
      const x = rect.left + (_v.x + 1) / 2 * rect.width, y = rect.top + (1 - _v.y) / 2 * rect.height; l = Math.min(l, x); rr = Math.max(rr, x); t = Math.min(t, y); b = Math.max(b, y);
    }
    return [l, t, rr, b];
  }
  function boxUnder(p, camera) {
    const M = lastMask.M; if (!M) return false; const [l, t, rr, b] = screenBox(p, camera, lastMask.rect);
    return M.circles.some(([x, y, rad]) => x + rad > l && x - rad < rr && y + rad > t && y - rad < b) || M.rects.some(([L, Tt, R2, B2]) => R2 > l && L < rr && B2 > t && Tt < b);
  }
  // (tests) what is drawn for a pawn, and the counts
  function info(id) {
    const r = world.recs.get(id); if (!r || r.entity.kind !== 'token') return null;
    const p = placed.find(x => x.id === id) || null;
    return { level: AU.auraLevelOf(r.entity), color: AU.auraColor(r.entity), live: live.has(r), shown: shown(r), drawn: !!p, height: p ? +p.H.toFixed(2) : null, radius: p ? +p.R.toFixed(2) : null, crown: +headY(r).toFixed(2), emblem: p?.emblem || null, sparks: p?.sparks ?? null };
  }
  const counts = () => ({ tubes: tubes.geo.instanceCount, floors: floors.geo.instanceCount, sprites: sprites.geo.instanceCount, drawCalls: [tubes, floors, sprites].filter(Q => Q.mesh.visible).length, live: live.size, maskOn, masked, maskButtons: lastMask.n + lastMask.nr, still: !!world.statusStill?.(), time: time.value });
  const screenOf = (id, camera, rect) => { const p = placed.find(x => x.id === id); return p ? screenBox(p, camera, rect) : null; };
  const hold = (on, parts) => { held = !!on && !parts; skip = on && parts ? new Set(parts) : null; };
  return { apply, drop, frame, info, counts, screenOf, hold, meshes: [tubes.mesh, floors.mesh, sprites.mesh] };
}
