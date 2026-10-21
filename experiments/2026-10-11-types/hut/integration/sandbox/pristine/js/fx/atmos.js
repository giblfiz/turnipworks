// ATMOSPHERE: ground fog that swirls, haze with dust, and smoke (soft hearth smoke, ceiling pooling, candle wisps, the
// puff when a fire is put out). Shared by the Spawn Tuner (the "Atmosphere: fog & smoke" panel, via fx/index.js) and
// the game (engine/client imports fx/index.js from the deployed tuner; the house look's `atmos` comes from GET
// /tuner/house). Harry 2026-10-04: "super duper class A+" fog and smoke; fog "that will swirl when you pass your mouse
// through it". Nothing here touches the DOM except one pointermove listener on window (the cursor stirs the fog).
//
// How it works (research/effects-2026-10-02.md §4, built rather than ported: Stam stable fluids as in Pavel
// Dobryakov's WebGL-Fluid-Simulation, MIT, with walls, wind and a moving window added):
//   window   the fluid lives in a square WINDOW of a fixed cell count (quality), fitted to the ground the camera sees:
//            it pans with the view in whole cells and its cell size follows the zoom in steps (a zoom step resamples the
//            fields and cross-fades), so the cost is the same at every zoom and on every map. Behaviour is in feet
//   place    WHERE things are, kept apart from the simulation: fog height (0 = none), indoors, hidden. Drawn from the
//            floors, rooms (setRooms: type defaults, a room's own height) and regions (setRegions) twice: at the
//            window's resolution, and coarsely over the whole map, so a cleared or hidden place stays so off-window
//   mask     walls in the window: R = wall at fog height (doorways open), G = indoors, B = wall at the ceiling
//   fluid    velocity + density (ping-pong half-float): splat -> curl -> forces (eddies, the OUTDOOR wind) -> divergence
//            -> pressure -> gradient -> advect. Walls are solid; the window's edges are open. Two profiles, indoor and
//            outdoor: density heals toward its place's fog bank only where the air moves with the ambient drift, and
//            sheltered air sheds its mist, so the wind goes round a building and leaves a shadow behind it
//   stirring the cursor (a footprint never smaller than a few cells), anything that moves (dragged things, pawns, a
//            landing spawn), other seats' cursors (stirrers), room arrivals, and the puff of a fire going out
//   light    two light maps over the window: every fire light, attenuated as three.js does, shadowed in 2-D by the walls
//   pool     ceiling smoke fed by the fires; spreads, stops at walls, thickens with the number of fires
//   render   one pass in the post stack (after contact shadows): raymarch the fog slab and the room air against the
//            scene depth. Inside the window it reads the simulated field; outside, the same fog-bank function with no
//            simulation, cross-faded at the rim, out to the horizon where it fades into the sky. Then the soft particles
//            (hearth smoke, puffs), candle wisps and dust motes; composited premultiplied before bloom / tone mapping.
//            Views with no post stack (the game's PiP, Lighting FX off) get two flat noise sheets instead.
import * as THREE from 'three';
import { Pass } from 'postprocessing';
import { BatchedRenderer, ParticleSystem, RenderMode } from 'three.quarks';
import { ConstantValue, IntervalValue, SphereEmitter, ColorOverLife, SizeOverLife, Gradient, PiecewiseBezier, Bezier, ApplyForce, TurbulenceField, RotationOverLife, ConstantColor, Vector3 as QV3, Vector4 as QV4 } from 'quarks.core';
import { CEIL } from '../solver.js';

// Two fog profiles (Harry 2026-10-05): INDOOR (built rooms: still air, drift zero unless dialled) and OUTDOOR (everything
// else and wall-less "outdoor" rooms: the wind drifts it). A place's FOG HEIGHT is the main control, 0 = no fog:
//   a room's own height (the tuner's Room panel slider; setRegions / setRooms `height`)  >  its type's default
//   (data/fog_defaults.json: cellars fog, an inn's rooms don't; `own` switches those off)  /  the profile's `height`.
export const ATMOS_DEFAULTS = {
  fx: 'atmos', name: 'clear',
  indoor: { height: 0, own: false, density: 0.6, color: '#c7ced2', patchy: 0.6, scale: 7, drift: 0, driftDir: 90 },
  outdoor: { height: 0, density: 0.45, color: '#cfd6da', patchy: 0.65, scale: 10, drift: 0.5, driftDir: 250, seep: 0 },
  flow: { speed: 1, swirl: 30, stir: 1.3, radius: 0.6, radiusPx: 0, wake: 0.45, linger: 0.7, recover: 0.25, breath: 0.35 }, // radius: Harry 2026-10-05, "0.5 to 2 felt right", picked 0.6 (was 2.2)
  light: { catch: 0.8, ambient: 1, warm: 0.1 },
  haze: { amount: 0, falloff: 5, color: '#b9b2a6', outdoors: 0.35, dust: 0, dustSize: 0.07, dustGlow: 1, shafts: 0 },
  smoke: { amount: 1, rise: 1, spread: 1, dark: 1, soft: 1.5, pool: 0, poolMax: 0.7, wisps: 0.6, puff: 1 },
  // heavy fog: the undiscovered world under a fog sea (to the horizon), and fog of war over hidden places (setRegions)
  world: { unbuilt: 0, height: 9, color: '#a3a9b0', war: 1, clear: 1, drift: 0 },
  quality: { level: 'medium', view: 'fog' },
};
// fog height (ft) a room type has by default when the preset says rooms keep their own (indoor.own); data/fog_defaults.json
// overrides this (fx/index.js loads it). Anything not listed: none.
export const FOG_BY_TYPE = { cellar: 2.5, crypt: 3, vault: 2.5, storeroom: 0, common: 0, kitchen: 0, guest: 0, fine: 0, privy: 0, hallway: 0, desk: 0, stable: 0, barn: 0.6 };
// presets made before the indoor / outdoor split (ground.* + flow.wind): carry them over
export function migrateAtmos(p) {
  if (!p || !p.ground || p.indoor) return p;
  const g = p.ground, q = JSON.parse(JSON.stringify(p)); delete q.ground;
  const out = (g.amount || 0) * (g.outdoors ?? 0.35);
  q.indoor = { height: g.amount > 0.001 ? g.height : 0, own: false, density: g.amount || 0.6, color: g.color, patchy: g.patchy, scale: g.scale, drift: 0, driftDir: p.flow?.windDir ?? 90 };
  q.outdoor = { height: out > 0.02 ? g.height : 0, density: Math.max(0.05, out), color: g.color, patchy: g.patchy, scale: g.scale, drift: p.flow?.wind ?? 0.3, driftDir: p.flow?.windDir ?? 90, seep: 0 };
  if (q.haze && q.haze.outdoors == null) q.haze.outdoors = g.outdoors ?? 0.35;
  return q;
}

const T = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
export const ATMOS_SCHEMA = [
  ['Indoor fog (built rooms)', 'indoor', [
    T('height', 'Fog height in every room (0 = none)', 0, 8, 0.25, 'ft'),
    { k: 'own', label: 'Rooms keep their own fog (cellars, crypts; the Room panel)', type: 'check' },
    T('density', 'Density', 0.05, 1, 0.01), { k: 'color', label: 'Colour', type: 'color' },
    T('patchy', 'Patchiness', 0, 1, 0.05), T('scale', 'Patch size', 2, 30, 0.5, 'ft'),
    T('drift', 'Drift (still air = 0)', 0, 1, 0.02, 'ft/s'), T('driftDir', 'Drift from', 0, 359, 1, '°'),
  ]],
  ['Outdoor fog (open ground, yards)', 'outdoor', [
    T('height', 'Fog height (0 = none)', 0, 8, 0.25, 'ft'), T('density', 'Density', 0.05, 1, 0.01), { k: 'color', label: 'Colour', type: 'color' },
    T('patchy', 'Patchiness', 0, 1, 0.05), T('scale', 'Patch size', 2, 40, 0.5, 'ft'),
    T('drift', 'Wind drift', 0, 4, 0.05, 'ft/s'), T('driftDir', 'Wind from', 0, 359, 1, '°'), T('seep', 'Seeps in through doorways', 0, 1, 0.05),
  ]],
  ['Swirl (cursor, drags, pawns)', 'flow', [
    T('stir', 'Stir strength', 0, 3, 0.05), T('radius', 'Stir radius', 0.5, 6, 0.1, 'ft'), T('radiusPx', 'Stir radius on screen (0 = use feet)', 0, 80, 1, 'px'), T('swirl', 'Swirl (eddies)', 0, 60, 1),
    T('wake', 'Wake parts the fog', 0, 1, 0.05), T('linger', 'Swirls linger', 0, 1, 0.01), T('recover', 'Fog heals back', 0.02, 1.5, 0.01),
    T('breath', 'Ambient churn (living air)', 0, 1, 0.05), T('speed', 'Flow speed', 0, 3, 0.05),
  ]],
  ['Light in the air', 'light', [
    T('catch', 'Catches firelight', 0, 4, 0.05), T('ambient', 'Ambient (sky / fill)', 0, 2, 0.05), T('warm', 'Warm tint', -1, 1, 0.05),
  ]],
  ['Haze & dust', 'haze', [
    T('amount', 'Haze', 0, 1, 0.01), T('falloff', 'Haze falls off over', 1, 15, 0.5, 'ft'), { k: 'color', label: 'Haze colour', type: 'color' }, T('outdoors', 'Haze outdoors (vs. indoors)', 0, 1, 0.05),
    T('dust', 'Dust motes', 0, 1, 0.01), T('dustSize', 'Mote size', 0.02, 0.25, 0.005, 'ft'), T('dustGlow', 'Motes catch light', 0, 4, 0.05),
    T('shafts', 'Feeds the light shafts (Lighting)', 0, 1, 0.05),
  ]],
  ['Smoke', 'smoke', [
    T('amount', 'Amount (× the fire panel)', 0, 3, 0.05), T('rise', 'Rise speed', 0.2, 3, 0.05), T('spread', 'Spread', 0.3, 3, 0.05),
    T('dark', 'Darkness', 0, 2, 0.05), T('soft', 'Soft where it meets things', 0, 4, 0.1, 'ft'),
    T('pool', 'Pools under the ceiling', 0, 1, 0.01), T('poolMax', 'Pool thickest', 0, 1, 0.05),
    T('wisps', 'Candle wisps', 0, 1, 0.05), T('puff', 'Puff when put out', 0, 2, 0.05),
  ]],
  ['The undiscovered world & fog of war', 'world', [
    T('unbuilt', 'Fog sea over the unbuilt world', 0, 1, 0.01), T('height', 'Heavy fog height', 2, 16, 0.5, 'ft'), { k: 'color', label: 'Heavy fog colour', type: 'color' },
    T('war', 'Fog of war thickness', 0.3, 2, 0.05), T('clear', 'Clears / closes in at', 0.2, 3, 0.05, '×'), T('drift', 'Fog sea travels with the wind (0 = stays put)', 0, 1, 0.05, '×'),
  ]],
  ['Quality', 'quality', [
    { k: 'level', label: 'Quality', type: 'select', options: [['low', 'low (laptop)'], ['medium', 'medium'], ['high', 'high']] },
    { k: 'view', label: 'Show', type: 'select', options: [['fog', 'the fog'], ['density', 'debug: fog density'], ['velocity', 'debug: swirl velocity'], ['mask', 'debug: walls / indoors'], ['light', 'debug: light map'], ['pool', 'debug: ceiling smoke'], ['heavy', 'debug: unbuilt / war fog'], ['place', 'debug: fog height / indoors / hidden']] },
  ]],
];

const B = (name, o) => () => { const p = JSON.parse(JSON.stringify(ATMOS_DEFAULTS)); p.name = name; for (const [k, v] of Object.entries(o)) Object.assign(p[k], v); return p; };
export const ATMOS_BUILTINS = {
  'clear': B('clear', {}),
  // the house default candidate: rooms keep their own fog (cellars), a low mist drifts outdoors
  'morning-mist': B('morning-mist', { indoor: { height: 0, own: true, density: 0.36, color: '#d4dde2', patchy: 0.65, scale: 9 }, outdoor: { height: 2.2, density: 0.32, color: '#d4dde2', patchy: 0.65, scale: 11, drift: 0.5, driftDir: 250, seep: 0.1 }, flow: { recover: 0.2 }, light: { catch: 0.6, ambient: 1.1, warm: -0.15 }, haze: { amount: 0.12, falloff: 6, color: '#c9d2d8', outdoors: 0.8, dust: 0.25, dustGlow: 0.6 }, smoke: { pool: 0.1, wisps: 0.4 } }),
  'crypt-fog': B('crypt-fog', { indoor: { height: 2.8, own: true, density: 0.6, color: '#9fb0a8', patchy: 0.85, scale: 6 }, outdoor: { height: 1.2, density: 0.12, color: '#9fb0a8', patchy: 0.85, scale: 8, drift: 0.15, driftDir: 120 }, flow: { swirl: 30, stir: 1.6, linger: 0.8, recover: 0.3 }, light: { catch: 0.7, ambient: 0.9, warm: -0.35 }, haze: { amount: 0.08, falloff: 3, color: '#8e9a94', outdoors: 0.15, dust: 0.15, dustGlow: 0.8 }, smoke: { wisps: 0.8, puff: 1.2 } }),
  'smoky-tavern': B('smoky-tavern', { indoor: { height: 1.6, own: true, density: 0.12, color: '#b8ab98', patchy: 0.5, scale: 5 }, light: { catch: 0.9, ambient: 0.6, warm: 0.35 }, haze: { amount: 0.16, falloff: 8, color: '#a89a86', outdoors: 0, dust: 0.6, dustSize: 0.06, dustGlow: 1.2, shafts: 0.6 }, smoke: { amount: 1.4, dark: 1.2, pool: 0.6, poolMax: 0.7, wisps: 0.9 } }),
  'storm-haze': B('storm-haze', { indoor: { height: 0, own: true, density: 0.3, color: '#8d969f', patchy: 0.8, scale: 12 }, outdoor: { height: 1.8, density: 0.3, color: '#8d969f', patchy: 0.8, scale: 14, drift: 2.6, driftDir: 300, seep: 0.25 }, flow: { swirl: 30, recover: 0.4, linger: 0.4 }, light: { catch: 0.8, ambient: 0.7, warm: -0.4 }, haze: { amount: 0.28, falloff: 12, color: '#7f8890', outdoors: 1, dust: 0.35, dustGlow: 0.4 }, smoke: { spread: 1.8, rise: 0.8, pool: 0.15 } }),
};

const QUALITY = {
  // sim: cells on a side of the (square) simulation window: a FIXED budget. The window is fitted to the visible ground,
  // so the cell size follows the zoom (fine curls close up, house-sized swirls from far away) and the cost never changes.
  // cap: the fx target's long side in pixels (a 2x screen must not quadruple the cost)
  low:    { sim: 128, iters: 8,  scale: 0.35, cap: 720,  ground: 7,  air: 4, dust: 300,  light: 64 },
  medium: { sim: 192, iters: 12, scale: 0.5,  cap: 1100, ground: 10, air: 5, dust: 800,  light: 160 },
  high:   { sim: 256, iters: 20, scale: 0.75, cap: 1800, ground: 16, air: 8, dust: 1600, light: 256 },
};
const ZSTEP = 1.25, CELL0 = 0.5; // zoom steps: the cell is CELL0 * ZSTEP^k ft (behaviour is in feet; 0.5 ft is the reference scale)
const MAX_LIGHTS = 8, MAX_SPLATS = 16, MAX_WISPS = 48;
const STRUCT = new Set(['floor', 'walls', 'openings']);

// ------------------------------------------------------------------ shaders
const VS_FS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const NOISE = `
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
// The simulation window's edges are OPEN (air flows through; pressure 0 outside): the window is a moving patch of a
// bigger world, not a box. Walls inside it are solid.
const SIM_HEAD = `precision highp float; varying vec2 vUv; uniform vec2 texel; uniform sampler2D uMask;
bool outsideW(vec2 uv) { return uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0; }
float solidAt(vec2 uv) { if (outsideW(uv)) return 0.0; return step(0.5, texture2D(uMask, uv).r); }`;
// WHERE: what the place canvas says about a spot (R = fog height / 16 ft, G = hidden, B = indoors), and the wind there
const WHERE = `uniform sampler2D uPlace; uniform vec2 uWindIn, uWindOut;
// (yard, 2026-10-05) G also carries "built open ground": about 0.38 over a wall-less outdoor room (a yard). It reads as
// z = -1 here: still outdoors for the wind and the fog profile, but DISCOVERED, so the fog sea does not lie on it.
float hiddenOf(float g) { return step(0.5, g) - step(0.2, g) * (1.0 - step(0.5, g)); }
vec3 placeW(vec2 uv) { vec4 c = texture2D(uPlace, uv); return vec3(c.r * 16.0, c.b, hiddenOf(c.g)); } // height ft, indoors, hidden (1) / built open ground (-1)
vec2 windAt(float indoor) { return mix(uWindOut, uWindIn, indoor); }`;
// BANK: the fog a calm place settles to. ONE function for the simulation's target and for the procedural far field
// outside the window, so the two meet without a seam. uIn / uOut = (density, patchiness, 1 / patch size, -)
const BANK = `uniform vec4 uIn, uOut; uniform float uTime, uUnbuilt, uSeaDrift; uniform vec2 uDriftIn, uDriftOut;
float fogBank(vec2 w, float indoor) { vec4 pr = mix(uOut, uIn, indoor); vec2 q = (w - mix(uDriftOut, uDriftIn, indoor) * uTime * 0.9) * pr.z;
  float n = 0.5 * vnoise(vec3(q, uTime * 0.05)) + 0.3 * vnoise(vec3(q * 2.6, uTime * 0.09 + 7.0)) + 0.2 * vnoise(vec3(q * 6.3, uTime * 0.12 + 3.0));
  float big = 0.6 * vnoise(vec3(w * 0.011, uTime * 0.012 + 5.0)) + 0.4 * vnoise(vec3(w * 0.0031, 9.0)); // thick and thin country, seen from far off
  return (1.0 - pr.y + pr.y * 2.0 * smoothstep(0.3, 0.7, n)) * (1.0 - 0.45 * pr.y + 0.9 * pr.y * big); }
float fogTarget(vec2 w, vec3 place) { return mix(uOut.x, uIn.x, place.y) * smoothstep(0.02, 0.2, place.x) * fogBank(w, place.y); }
// (2026-10-05) the sea's pattern is anchored to the world: it churns in place and does NOT travel, whatever the wind (the
// mist under it does). world.drift (uSeaDrift, 0 by default) lets its banks travel with the wind, with finer banks to show it.
float heavyTarget(vec2 w, vec3 place) { vec2 ws = w - uDriftOut * uTime * uSeaDrift; float nh = vnoise(vec3((w - uDriftOut * uTime * max(0.3, uSeaDrift)) * 0.06, uTime * 0.04 + 3.0));
  float banks = 0.6 * vnoise(vec3(ws * 0.009, uTime * 0.01 + 2.0)) + 0.4 * vnoise(vec3(ws * 0.0027, 4.0)); if (uSeaDrift > 0.0) banks = mix(banks, vnoise(vec3(ws * 0.05, 6.0)), 0.45 * min(1.0, uSeaDrift * 4.0));
  return max(max(place.z, 0.0), uUnbuilt * (1.0 - smoothstep(0.3, 0.7, place.y)) * (1.0 + min(place.z, 0.0)) * (0.6 + 0.8 * banks)) * (0.8 + 0.4 * nh); }`;

const FS = {
  splat: `${SIM_HEAD} uniform sampler2D uSrc; uniform int uN, uMode; uniform vec4 uA[${MAX_SPLATS}]; uniform vec4 uB[${MAX_SPLATS}]; uniform vec2 uSize; uniform float uVmax;
    void main() { vec4 c = texture2D(uSrc, vUv); vec2 p = vUv * uSize;
      for (int i = 0; i < ${MAX_SPLATS}; i++) { if (i >= uN) break; vec2 d = p - uA[i].xy; float g = exp(-dot(d, d) / (uA[i].z * uA[i].z));
        if (uMode == 0) c.xy += uB[i].xy * g; else c.xy = max(vec2(0.0), c.xy + uB[i].zw * g); }
      if (uMode == 0) { float m = length(c.xy); if (m > uVmax) c.xy *= uVmax / m; }
      c *= 1.0 - solidAt(vUv); gl_FragColor = c; }`,
  // the window follows the view: every field is re-read from where it was (a pan = a shift by whole cells, exact; a zoom
  // step = a resample into the new scale); newly uncovered ground starts calm, at the fog bank
  scroll: `${SIM_HEAD} ${NOISE} ${WHERE} ${BANK} uniform sampler2D uSrc; uniform vec2 uSize, uOrigin, uOldOrigin, uOldSize; uniform int uKind;
    void main() { vec2 w = uOrigin + vUv * uSize, c = (w - uOldOrigin) / uOldSize;
      if (!outsideW(c)) { gl_FragColor = texture2D(uSrc, c) * (1.0 - solidAt(vUv)); return; }
      vec3 pl = placeW(vUv); float open = 1.0 - solidAt(vUv);
      if (uKind == 1) gl_FragColor = vec4(fogTarget(w, pl) * open, heavyTarget(w, pl) * open, 0.0, 1.0);
      else if (uKind == 0) gl_FragColor = vec4(windAt(pl.y) * open, 0.0, 1.0);
      else gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`,
  curl: `${SIM_HEAD} uniform sampler2D uVel;
    void main() { float L = texture2D(uVel, vUv - vec2(texel.x, 0.0)).y, R = texture2D(uVel, vUv + vec2(texel.x, 0.0)).y;
      float T = texture2D(uVel, vUv + vec2(0.0, texel.y)).x, Bm = texture2D(uVel, vUv - vec2(0.0, texel.y)).x;
      gl_FragColor = vec4(0.5 * (R - L - T + Bm), 0.0, 0.0, 1.0); }`,
  // forces: eddies where something stirred (speed RELATIVE to the wind there), and the wind itself, outdoors only: a
  // gentle pull toward the drift, which the pressure solve then bends around buildings
  vort: `${SIM_HEAD} ${WHERE} uniform sampler2D uVel, uCurl; uniform float uCurlK, uWindK, uVmax, dt;
    void main() { float L = texture2D(uCurl, vUv - vec2(texel.x, 0.0)).x, R = texture2D(uCurl, vUv + vec2(texel.x, 0.0)).x;
      float T = texture2D(uCurl, vUv + vec2(0.0, texel.y)).x, Bm = texture2D(uCurl, vUv - vec2(0.0, texel.y)).x, C = texture2D(uCurl, vUv).x;
      vec2 f = 0.5 * vec2(abs(T) - abs(Bm), abs(R) - abs(L)); f /= length(f) + 0.0001; f *= uCurlK * C; f.y *= -1.0;
      vec2 wind = windAt(placeW(vUv).y); vec2 v0 = texture2D(uVel, vUv).xy; f *= smoothstep(0.5, 2.0, length(v0 - wind));
      vec2 v = v0 + f * dt; v += (wind - v) * (1.0 - exp(-uWindK * dt)) * smoothstep(0.0, 0.1, length(wind));
      v = clamp(v, -uVmax, uVmax); gl_FragColor = vec4(v * (1.0 - solidAt(vUv)), 0.0, 1.0); }`,
  div: `${SIM_HEAD} uniform sampler2D uVel;
    void main() { vec2 C = texture2D(uVel, vUv).xy; vec2 dl = vec2(texel.x, 0.0), db = vec2(0.0, texel.y);
      float L = texture2D(uVel, vUv - dl).x, R = texture2D(uVel, vUv + dl).x, T = texture2D(uVel, vUv + db).y, Bm = texture2D(uVel, vUv - db).y;
      if (solidAt(vUv - dl) > 0.5) L = -C.x; if (solidAt(vUv + dl) > 0.5) R = -C.x; if (solidAt(vUv + db) > 0.5) T = -C.y; if (solidAt(vUv - db) > 0.5) Bm = -C.y;
      gl_FragColor = vec4(0.5 * (R - L + T - Bm), 0.0, 0.0, 1.0); }`,
  scale: `${SIM_HEAD} uniform sampler2D uSrc; uniform float uK; void main() { gl_FragColor = texture2D(uSrc, vUv) * uK; }`,
  press: `${SIM_HEAD} uniform sampler2D uP, uDiv;
    float pAt(vec2 uv, float C) { if (outsideW(uv)) return 0.0; return solidAt(uv) > 0.5 ? C : texture2D(uP, uv).x; }
    void main() { float C = texture2D(uP, vUv).x; vec2 dl = vec2(texel.x, 0.0), db = vec2(0.0, texel.y);
      gl_FragColor = vec4((pAt(vUv - dl, C) + pAt(vUv + dl, C) + pAt(vUv + db, C) + pAt(vUv - db, C) - texture2D(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0); }`,
  grad: `${SIM_HEAD} uniform sampler2D uP, uVel;
    float pAt(vec2 uv, float C) { if (outsideW(uv)) return 0.0; return solidAt(uv) > 0.5 ? C : texture2D(uP, uv).x; }
    void main() { float C = texture2D(uP, vUv).x; vec2 dl = vec2(texel.x, 0.0), db = vec2(0.0, texel.y);
      vec2 v = texture2D(uVel, vUv).xy - 0.5 * vec2(pAt(vUv + dl, C) - pAt(vUv - dl, C), pAt(vUv + db, C) - pAt(vUv - db, C)); gl_FragColor = vec4(v * (1.0 - solidAt(vUv)), 0.0, 1.0); }`,
  // velocity carries itself; what dies away is the motion RELATIVE to the wind (slow residue fastest), never the wind
  advVel: `${SIM_HEAD} ${WHERE} uniform sampler2D uVel; uniform float dt, uKeep; uniform vec2 uSize;
    void main() { vec2 v = texture2D(uVel, vUv).xy; vec2 c = vUv - dt * v / uSize; vec2 wind = windAt(placeW(vUv).y);
      vec2 rel = texture2D(uVel, c).xy - wind; rel *= uKeep * mix(exp(-2.5 * dt), 1.0, smoothstep(1.0, 4.0, length(rel)));
      gl_FragColor = vec4((wind + rel) * (1.0 - solidAt(vUv)), 0.0, 1.0); }`,
  // R = the ground fog, G = heavy fog (the undiscovered world, fog of war). Both ride the velocity field (the wind is in
  // it); a calm place heals back to its bank. Indoors, fog thicker than the room's own is cleared fast unless `seep`.
  advDen: `${SIM_HEAD} ${NOISE} ${WHERE} ${BANK} uniform sampler2D uVel, uDen; uniform float dt, uRelax, uHeavyIn, uHeavyOut, uSeed, uSeep; uniform vec2 uSize, uOrigin;
    void main() { vec2 v = texture2D(uVel, vUv).xy; vec2 c = vUv - dt * v / uSize; vec2 d = texture2D(uDen, c).xy;
      vec2 w = uOrigin + vUv * uSize; vec3 pl = placeW(vUv);
      float target = fogTarget(w, pl), heavy = heavyTarget(w, pl);
      // a stirred place holds its eddies while it is moving, then heals back to the bank
      // ... and only where the air moves with the ambient drift. Where a wall blocks or bends the wind (the lee of a
      // building, a stagnant corner) nothing is painted in: the fog there is only what really flowed there.
      vec2 wind = windAt(pl.y); float off = length(v - wind);
      float shelter = smoothstep(0.1, 0.35, off / max(length(wind), 0.05)) * step(0.05, length(wind)); // 0 in the free stream, 1 where the wind is blocked or bent
      float calm = (1.0 - smoothstep(0.3, 3.0, off)) * (1.0 - shelter);
      float k = uRelax * calm; if (d.x > target && pl.y > 0.5 && pl.x < 0.05) k = max(k, 1.0 - exp(-4.0 * (1.0 - uSeep) * dt)); // a fog-free room sheds what drifts in
      d.x = mix(d.x, target, uSeed > 0.5 ? 1.0 : k);
      d.x *= exp(-0.3 * shelter * (1.0 - smoothstep(0.0, 6.0, off)) * dt); // sheltered air drops its mist: a wind shadow behind a building (not where something is stirring)
      d.y = mix(d.y, heavy, uSeed > 0.5 ? 1.0 : 1.0 - exp(-(heavy > d.y ? uHeavyIn : uHeavyOut) * dt));
      gl_FragColor = vec4(max(d, vec2(0.0)) * (1.0 - solidAt(vUv)), 0.0, 1.0); }`,
  pool: `precision highp float; varying vec2 vUv; uniform vec2 texel; uniform sampler2D uMask, uPool; uniform int uN; uniform vec4 uS[${MAX_SPLATS}]; uniform vec2 uSize; uniform float dt, uRate, uDecay, uMax;
    float ceilAt(vec2 uv) { if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0; return step(0.5, texture2D(uMask, uv).b); }
    void main() { float C = texture2D(uPool, vUv).x; vec2 dl = vec2(texel.x, 0.0), db = vec2(0.0, texel.y);
      float L = ceilAt(vUv - dl) > 0.5 ? C : texture2D(uPool, vUv - dl).x, R = ceilAt(vUv + dl) > 0.5 ? C : texture2D(uPool, vUv + dl).x;
      float T = ceilAt(vUv + db) > 0.5 ? C : texture2D(uPool, vUv + db).x, Bm = ceilAt(vUv - db) > 0.5 ? C : texture2D(uPool, vUv - db).x;
      float p = mix(C, (L + R + T + Bm) * 0.25, 0.95); vec2 w = vUv * uSize; float src = 0.0;
      for (int i = 0; i < ${MAX_SPLATS}; i++) { if (i >= uN) break; vec2 d = w - uS[i].xy; src += uS[i].w * exp(-dot(d, d) / (uS[i].z * uS[i].z)); }
      float indoor = texture2D(uMask, vUv).g;
      p += src * uRate * dt; p *= exp(-uDecay * mix(8.0, 1.0, indoor) * dt); p = min(p, uMax);
      gl_FragColor = vec4(p * (1.0 - ceilAt(vUv)), 0.0, 0.0, 1.0); }`,
  light: `precision highp float; varying vec2 vUv; uniform sampler2D uMask; uniform vec4 uLP[${MAX_LIGHTS}]; uniform vec4 uLC[${MAX_LIGHTS}]; uniform int uN; uniform float uY, uCh; uniform vec2 uOrigin, uSize, uGrid;
    void main() { vec3 wp = vec3(uOrigin.x + vUv.x * uSize.x, uY, uOrigin.y + vUv.y * uSize.y); vec3 sum = vec3(0.0);
      for (int i = 0; i < ${MAX_LIGHTS}; i++) { if (i >= uN) break;
        vec3 d = uLP[i].xyz - wp; float dist = max(length(d), 1.5), cut = uLP[i].w;
        float att = 1.0 / max(pow(dist, uLC[i].w), 0.01); if (cut > 0.0) { float r = clamp(1.0 - pow(dist / cut, 4.0), 0.0, 1.0); att *= r * r; }
        if (att < 0.0005) continue;
        vec2 b = (uLP[i].xz - uOrigin) / uSize; float len = length((b - vUv) * uGrid); int n = int(clamp(len / 1.2, 2.0, 40.0)); float vis = 1.0;
        for (int k = 1; k < 40; k++) { if (k >= n) break; float f = float(k) / float(n) * 0.9; vec4 m = texture2D(uMask, mix(vUv, b, f)); vis *= 1.0 - 0.95 * mix(m.r, m.b, uCh); }
        sum += uLC[i].rgb * att * vis; }
      gl_FragColor = vec4(sum, 1.0); }`,
  // the volume: raymarch the fog slab and the room air against the scene depth (premultiplied out)
  // the volume: raymarch the fog slab and the room air against the scene depth (premultiplied out).
  // Inside the simulation window the fog is the simulated field; outside it, the same fog bank computed on the spot from
  // the coarse whole-map place canvas (no simulation: cost follows the screen, not the world), cross-faded over the
  // window's rim, out to the horizon where it fades into the sky colour.
  volume: `precision highp float; varying vec2 vUv; ${NOISE} ${BANK}
    uniform sampler2D uDepth, uDen, uPool, uMask, uLo, uHi, uVel, uPlace, uWorld, uPrevDen; uniform vec2 uPOrigin, uPSize; uniform float uXfade; uniform mat4 uProjInv, uCamWorld; uniform vec3 uCam;
    uniform vec2 uOrigin, uSize, uWOrigin, uWSize; uniform float uHmax, uCeil, uFog, uHaze, uFall, uHazeOut, uPoolK, uPoolDark, uCatch, uLoY, uHiY, uPlaceIn, uPlaceOut, uFar;
    uniform vec3 uInCol, uOutCol, uHazeCol, uAmb, uHeavyCol, uSky; uniform int uNg, uNa, uView; uniform vec2 uWind; uniform float uHeavyH, uHeavyK, uHeavyOn; uniform vec2 uTexel, uFade;
    uniform float uBase, uIndoorOnly; // (storeys) the height of the floor the fog lies on (0 = the ground), and: only rooms' own fog, no outdoor fog or sea
    float rnd; vec3 col; float Tr;
    vec3 placeOf(sampler2D t, vec2 uv) { vec4 c = texture2D(t, uv); return vec3(c.r * 16.0, c.b, step(0.5, c.g) - step(0.2, c.g) * (1.0 - step(0.5, c.g))); } // z: hidden 1 / built open ground (a yard) -1, as placeW
    vec3 placeFar(vec2 w) { vec2 uv = (w - uWOrigin) / uWSize; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(uPlaceOut, 0.0, 0.0); return placeOf(uWorld, uv); }
    void sampleAt(vec3 p, float ds) {
      vec2 uv = (p.xz - uOrigin) / uSize; float rim = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)), inW = smoothstep(0.0, 0.1, rim);
      if (inW <= 0.0 && uFar < 0.5) return;
      // what is here: the simulated field inside the window, the fog bank itself outside it
      vec3 pl = vec3(0.0); float D = 0.0, hv = 0.0; vec3 Lf = vec3(0.0); float open = 1.0;
      if (inW < 1.0) { pl = placeFar(p.xz); D = fogTarget(p.xz, pl); if (uHeavyOn > 0.5) hv = heavyTarget(p.xz, pl); }
      if (inW > 0.0) {
        vec3 pn = placeOf(uPlace, uv); float Dn = texture2D(uDen, uv).x, hn = 0.0;
        // heavy fog is read dilated, so it also covers the walls of a hidden room
        if (uHeavyOn > 0.5) { vec2 o = uTexel * 1.5; hn = max(max(texture2D(uDen, uv).y, texture2D(uDen, uv + vec2(o.x, 0.0)).y), max(max(texture2D(uDen, uv - vec2(o.x, 0.0)).y, texture2D(uDen, uv + vec2(0.0, o.y)).y), texture2D(uDen, uv - vec2(0.0, o.y)).y)); }
        if (uXfade < 1.0) { vec2 pu = (p.xz - uPOrigin) / uPSize; if (pu.x >= 0.0 && pu.y >= 0.0 && pu.x <= 1.0 && pu.y <= 1.0) { vec2 o = texture2D(uPrevDen, pu).xy; Dn = mix(o.x, Dn, uXfade); hn = mix(o.y, hn, uXfade); } } // a zoom step eases in
        pl = mix(pl, pn, inW); D = mix(D, Dn, inW); hv = mix(hv, hn, inW);
        Lf = mix(texture2D(uLo, uv).rgb, texture2D(uHi, uv).rgb, clamp((p.y - uLoY) / (uHiY - uLoY), 0.0, 1.0)) * uCatch * inW;
      }
      float indoor = pl.y, h = pl.x;
      if (uIndoorOnly > 0.5 && indoor < 0.5) { h = 0.0; hv = 0.0; }
      float hshade = 1.0;
      if (hv > 0.002 && p.y < uHeavyH * 1.3) {
        vec3 q = vec3(p.x * 0.12 - uWind.x * uTime * 0.12, p.y * 0.25 - uTime * 0.05, p.z * 0.12 - uWind.y * uTime * 0.12);
        float n = vnoise(q), n2 = vnoise(q * 3.1 + 5.0);
        float top = uHeavyH * clamp(hv * 1.6, 0.25, 1.0) * (0.78 + 0.4 * n);
        hv *= uHeavyK * (1.0 - smoothstep(top * 0.55, top, p.y)) * (0.7 + 0.6 * n2);
        hshade = mix(0.35, 1.0, smoothstep(top * 0.2, top, p.y)); // a lit top, dark beneath: hides what is inside
      } else hv = 0.0;
      float g = 0.0, shade = 1.0;
      if (uFog > 0.0 && h > 0.03 && p.y < h * 1.6) {
        // relief: a thick patch billows taller than a thin one; the lower fog sits in its own shadow
        float amt = max(0.02, mix(uOut.x, uIn.x, indoor)), rel = clamp(D / amt, 0.0, 1.6);
        vec3 q = vec3(p.x * 0.16, p.y * 0.5 - uTime * 0.05, p.z * 0.16); // (no wind scroll here: all sideways motion is the simulated flow)
        float n = vnoise(q), n2 = vnoise(q * 2.3 + 11.0);
        float top = h * (0.3 + 0.75 * rel) * (0.7 + 0.6 * n);
        g = D * uFog * (1.0 - smoothstep(top * 0.2, top, p.y)) * (0.7 + 0.6 * n2);
        shade = mix(0.62, 1.0, smoothstep(0.0, max(top, 0.1), p.y));
      }
      float hz = 0.0, pl2 = 0.0;
      if (uHaze > 0.0) hz = uHaze * exp(-max(p.y, 0.0) / uFall) * mix(uHazeOut, 1.0, indoor) * (0.45 + 1.1 * vnoise(vec3(p.x * 0.16, p.y * 0.3 + uTime * 0.05, p.z * 0.16)));
      if (uPoolK > 0.0 && inW > 0.0 && p.y > uCeil - 2.4) pl2 = texture2D(uPool, uv).x * inW * uPoolK * smoothstep(uCeil - 2.4, uCeil - 0.6, p.y) * (0.75 + 0.5 * vnoise(vec3(p.xz * 0.4, uTime * 0.1)));
      float s = g + hz + pl2 + hv; if (s < 1e-5) return;
      Lf = 2.0 * Lf / (1.0 + 0.3 * Lf); // firelight in the air saturates softly: a warm pool, not a blown-out disc
      vec3 L = Lf + uAmb, La = uAmb + Lf * 0.45;
      vec3 c = (g * shade * mix(uOutCol, uInCol, indoor) * L + hz * uHazeCol * La + pl2 * vec3(mix(0.55, 0.06, uPoolDark)) * La + hv * hshade * uHeavyCol * (uAmb * 1.2 + Lf * 0.3 + 0.03)) / s;
      c = mix(c, uSky, smoothstep(uFade.x, uFade.y, length(p - vec3(uCam.x, uCam.y - uBase, uCam.z)))); // far away the fog sea melts into the sky
      float a = exp(-s * ds); col += Tr * c * (1.0 - a); Tr *= a;
    }
    void band(vec3 ro, vec3 rd, float tMax, float y0, float y1, int N) {
      if (N <= 0 || abs(rd.y) < 1e-5) return;
      float tA = (y0 - ro.y) / rd.y, tB = (y1 - ro.y) / rd.y; float t0 = max(min(tA, tB), 0.0), t1 = min(max(tA, tB), tMax);
      if (uFar < 0.5) { // nothing lives outside the window: stop at its box
        vec2 inv = 1.0 / vec2(abs(rd.x) < 1e-6 ? 1e-6 : rd.x, abs(rd.z) < 1e-6 ? 1e-6 : rd.z); vec2 bA = (uOrigin - ro.xz) * inv, bB = (uOrigin + uSize - ro.xz) * inv;
        vec2 bn = min(bA, bB), bx = max(bA, bB); t0 = max(t0, max(bn.x, bn.y)); t1 = min(t1, min(bx.x, bx.y));
      } else t1 = min(t1, t0 + uFade.y * 1.3);
      if (t1 <= t0) return;
      float ds = (t1 - t0) / float(N);
      for (int i = 0; i < 24; i++) { if (i >= N || Tr < 0.01) break; sampleAt(ro + rd * (t0 + ds * (float(i) + rnd)), ds); }
    }
    void main() {
      float d = texture2D(uDepth, vUv).x;
      vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v /= v.w; vec3 P = (uCamWorld * v).xyz;
      P.y -= uBase; vec3 ro = uCam; ro.y -= uBase; vec3 rd = normalize(P - ro); float tMax = d >= 1.0 ? 1e5 : length(P - ro);
      if (uView > 0) { // debug views: the field on the floor
        float t = -ro.y / rd.y; if (rd.y >= 0.0 || t > tMax + 0.5) { gl_FragColor = vec4(0.0); return; }
        vec2 uv = (ro.xz + rd.xz * t - uOrigin) / uSize; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0); return; }
        vec3 c = uView == 1 ? vec3(texture2D(uDen, uv).x) : uView == 2 ? vec3(0.5 + 0.08 * texture2D(uVel, uv).xy, 0.5).xzy : uView == 3 ? texture2D(uMask, uv).rgb : uView == 4 ? texture2D(uLo, uv).rgb * 0.5 : uView == 5 ? vec3(texture2D(uPool, uv).x) : uView == 6 ? vec3(texture2D(uDen, uv).y, 0.3 * texture2D(uDen, uv).x, 0.0) : vec3(texture2D(uPlace, uv).r * 2.0, texture2D(uPlace, uv).g, texture2D(uPlace, uv).b * 0.6);
        gl_FragColor = vec4(c * 0.85, 0.85); return; }
      rnd = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      col = vec3(0.0); Tr = 1.0;
      float hTop = max(uFog > 0.0 ? uHmax * 1.6 : 0.0, uHeavyOn > 0.5 ? uHeavyH * 1.3 : 0.0); bool air = uHaze > 0.0 || uPoolK > 0.0; bool low = hTop > 0.0;
      if (!low) hTop = 0.5; float aTop = max(uCeil, hTop + 0.5);
      if (ro.y > hTop) { if (air) band(ro, rd, tMax, hTop, aTop, uNa); if (low || air) band(ro, rd, tMax, 0.0, hTop, uNg); }
      else { if (low || air) band(ro, rd, tMax, 0.0, hTop, uNg); if (air) band(ro, rd, tMax, hTop, aTop, uNa); }
      gl_FragColor = vec4(col, 1.0 - Tr);
    }`,
  // the low-res target's own view depth, so the composite can upsample without halos at silhouettes
  lowz: `precision highp float; varying vec2 vUv; uniform sampler2D uDepth; uniform vec2 uNF;
    void main() { float d = texture2D(uDepth, vUv).x; gl_FragColor = vec4((uNF.y * uNF.x) / (uNF.y - d * (uNF.y - uNF.x)), 0.0, 0.0, 1.0); }`,
  // depth-aware (joint bilateral) upsample: of the 4 low-res texels around a pixel, trust the ones at its own depth
  composite: `precision highp float; varying vec2 vUv; uniform sampler2D uFx, uLowZ, uDepth; uniform vec2 uTexel, uNF; uniform float uBilateral;
    void main() {
      vec2 p = vUv / uTexel - 0.5, f = fract(p), b = (floor(p) + 0.5) * uTexel;
      if (uBilateral < 0.5) { gl_FragColor = texture2D(uFx, vUv); return; }
      float d = texture2D(uDepth, vUv).x, z = (uNF.y * uNF.x) / (uNF.y - d * (uNF.y - uNF.x));
      vec4 acc = vec4(0.0); float ws = 0.0;
      for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
        vec2 uv = b + vec2(float(i), float(j)) * uTexel; float zl = texture2D(uLowZ, uv).x;
        float wb = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) + 0.001;
        float w = wb / (0.02 + abs(z - zl) / max(z, 0.5) * 25.0); acc += texture2D(uFx, uv) * w; ws += w; }
      gl_FragColor = acc / max(ws, 1e-5); }`,
};

// manual depth fade for things drawn into the offscreen fx target (no depth buffer there)
const SOFT = `uniform sampler2D uDepth; uniform vec2 uRes, uNF; uniform float uUseDepth, uSoftK;
  float sceneZ() { float d = texture2D(uDepth, gl_FragCoord.xy / uRes).x; return (uNF.y * uNF.x) / (uNF.y - d * (uNF.y - uNF.x)); }
  float softFade(float z) { if (uUseDepth < 0.5) return 1.0; return clamp((sceneZ() - z) * uSoftK, 0.0, 1.0); }`;

const MOTE_VS = `attribute vec4 seed; uniform float uTime, uPx; uniform sampler2D uVel, uLo, uHi; uniform vec2 uOrigin, uSize; uniform vec3 uAmb; uniform float uGlow, uLoY, uHiY, uSizeFt, uCatch;
  varying vec3 vCol; varying float vZ;
  void main() { vec3 p = seed.xyz; float ph = seed.w;
    p += vec3(sin(uTime * 0.13 + ph * 6.0) * 0.9, sin(uTime * 0.07 + ph * 3.0) * 0.5, cos(uTime * 0.11 + ph * 5.0) * 0.9);
    vec2 uv = (p.xz - uOrigin) / uSize; vec2 v = texture2D(uVel, uv).xy; p.xz += v * 0.4 * (1.0 - smoothstep(1.0, 5.0, p.y));
    vec3 L = mix(texture2D(uLo, uv).rgb, texture2D(uHi, uv).rgb, clamp((p.y - uLoY) / (uHiY - uLoY), 0.0, 1.0));
    vCol = (L * uCatch * uGlow + uAmb * 0.25) * (0.55 + 0.45 * sin(uTime * 1.3 + ph * 40.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vZ = -mv.z; gl_PointSize = max(1.0, uSizeFt * uPx / vZ); }`;
const MOTE_FS = `${SOFT} varying vec3 vCol; varying float vZ; uniform float uBright;
  void main() { vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(q)); a *= a * softFade(vZ); if (a < 0.003) discard; gl_FragColor = vec4(vCol * a * uBright, 0.0); }`;
const WISP_VS = `attribute vec4 iBase; attribute float iAmp; uniform float uTime, uRise, uSpread, uLen, uWidth; uniform vec2 uWind; varying float vS, vSide, vPh, vAmp, vZ;
  void main() { float s = position.y + 0.5, side = position.x * 2.0, ph = iBase.w; float len = uLen * (0.7 + 0.5 * fract(ph * 7.31));
    float h = s * len, t = uTime * uRise;
    vec3 off = vec3(sin(h * 2.3 - t * 1.4 + ph * 6.0) * 0.10 + sin(h * 5.7 - t * 2.3 + ph * 2.0) * 0.04, h, cos(h * 1.9 - t * 1.1 + ph * 4.0) * 0.10 + sin(h * 4.1 - t * 1.9 + ph) * 0.04);
    off.xz *= pow(s, 1.15) * uSpread * 1.6; off.xz += uWind * h * h * 0.15;
    vec3 c = iBase.xyz + vec3(0.0, 0.18, 0.0) + off; vec3 view = normalize(cameraPosition - c); vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), view) + 1e-5);
    c += right * side * uWidth * (0.25 + s * 1.4) * 0.5;
    vec4 mv = modelViewMatrix * vec4(c, 1.0); gl_Position = projectionMatrix * mv; vZ = -mv.z; vS = s; vSide = side; vPh = ph; vAmp = iAmp; }`;
const WISP_FS = `${SOFT} varying float vS, vSide, vPh, vAmp, vZ; uniform float uTime, uRise, uAmount; uniform vec3 uCol, uWarm;
  void main() { float a = smoothstep(0.0, 0.08, vS) * pow(1.0 - vS, 1.6) * (1.0 - vSide * vSide) * (0.5 + 0.5 * sin(vS * 15.0 - uTime * uRise * 3.0 + vPh * 9.0));
    a *= vAmp * uAmount * softFade(vZ) * 0.55; if (a < 0.003) discard; vec3 c = mix(uCol, uWarm, pow(1.0 - vS, 6.0)); gl_FragColor = vec4(c * a, a); }`;

// Views with no post stack (the game's picture-in-picture, Lighting FX off): the fog bank as two flat sheets read from the
// whole-map place canvas. No simulation, no depth: one sheet low for the ground fog, one high for the heavy fog.
const SHEET_VS = 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const SHEET_FS = `precision highp float; varying vec3 vW; ${NOISE} ${BANK}
  uniform sampler2D uWorld; uniform vec2 uWOrigin, uWSize, uFade; uniform float uPlaceOut, uLayer, uHeavyK, uHeavyH, uHeavyOn; uniform vec3 uInCol, uOutCol, uHeavyCol, uAmb, uSky;
  vec3 placeFar(vec2 w) { vec2 uv = (w - uWOrigin) / uWSize; if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(uPlaceOut, 0.0, 0.0); vec4 c = texture2D(uWorld, uv); return vec3(c.r * 16.0, c.b, step(0.5, c.g) - step(0.2, c.g) * (1.0 - step(0.5, c.g))); } // z: hidden 1 / built open ground -1
  void main() { vec3 pl = placeFar(vW.xz); float a = 0.0; vec3 c = vec3(0.0);
    if (uLayer < 0.5) { a = 1.0 - exp(-fogTarget(vW.xz, pl) * 2.0 * pl.x * 0.45); c = mix(uOutCol, uInCol, pl.y) * uAmb; }
    else if (uHeavyOn > 0.5) { float hv = heavyTarget(vW.xz, pl); a = 1.0 - exp(-hv * uHeavyK * uHeavyH * clamp(hv * 1.6, 0.25, 1.0) * 0.5); c = uHeavyCol * (uAmb * 1.2 + 0.03); }
    if (a < 0.004) discard;
    c = mix(c, uSky, smoothstep(uFade.x, uFade.y, length(vW - cameraPosition)));
    gl_FragColor = vec4(c, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// ------------------------------------------------------------------ the module
export function createAtmos({ renderer, scene, camera, hemi = null, sun = null, items = () => [], structure = null, stirrers = null, focus = () => null }) {
  let P = JSON.parse(JSON.stringify(ATMOS_DEFAULTS));
  let Q = QUALITY.medium;
  const gl = renderer.getContext();
  const half = THREE.HalfFloatType;
  const rtOpts = { type: half, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
  const makeRT = (w, h) => new THREE.WebGLRenderTarget(w, h, rtOpts);
  const pair = (w, h) => { const p = { a: makeRT(w, h), b: makeRT(w, h), get read() { return this.a; }, get write() { return this.b; }, swap() { const t = this.a; this.a = this.b; this.b = t; }, dispose() { this.a.dispose(); this.b.dispose(); } }; return p; };

  // fullscreen quad for the sim passes
  const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); fsMesh.frustumCulled = false; fsScene.add(fsMesh);
  const mats = {};
  for (const [k, src] of Object.entries(FS)) if (k !== 'volume' && k !== 'composite' && k !== 'lowz') mats[k] = new THREE.ShaderMaterial({ vertexShader: VS_FS, fragmentShader: src, uniforms: {}, depthTest: false, depthWrite: false });
  const U = (m, o) => { for (const [k, v] of Object.entries(o)) { if (!m.uniforms[k]) m.uniforms[k] = { value: v }; else m.uniforms[k].value = v; } return m; };
  let simCalls = 0;
  function run(mat, target) { fsMesh.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); simCalls++; }

  // ---- the simulation window, its masks, and the whole-map place canvas
  // dom: the WINDOW the fluid lives in: Q.sim cells square, FITTED TO THE VISIBLE GROUND (Harry 2026-10-05): it follows the
  //   viewport, panning in whole cells, and its cell size follows the zoom in steps of ZSTEP (a zoom step resamples the
  //   fields into the new scale and cross-fades). At a low camera pitch a distance cap bounds it; past it, the noise sea.
  // world: a coarse canvas over the whole built map (>= 2 ft a texel): what is WHERE (fog height, indoors, hidden),
  //   kept apart from the simulation so a cleared room or a hidden one stays so when the window has moved on.
  const canvasTex = () => { const c = document.createElement('canvas'); c.width = c.height = 4; const t = new THREE.CanvasTexture(c); t.flipY = false; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; return [c, t]; };
  const [maskCanvas, maskTex] = canvasTex();   // window: R = wall at fog height (doorways open), G = indoors (landed floors), B = wall at the ceiling
  const [placeCanvas, placeTex] = canvasTex(); // window: R = fog height / 16 ft, G = hidden (fog of war), B = indoors
  const [worldCanvas, worldTex] = canvasTex(); // the whole map, same channels as place
  const dom = { x0: 0, z0: 0, W: 96, D: 96, gw: 4, gd: 4, cell: CELL0, k: 0, key: '', sig: '' };
  const world = { x0: 0, z0: 0, W: 64, D: 64, gw: 4, gd: 4, cell: 2 };
  let vel = null, den = null, prs = null, divRT = null, curlRT = null, pool = null, lightLo = null, lightHi = null;
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); black.needsUpdate = true;
  let needsInit = true, firstDrawn = false, recsNow = [], drawnKeys = new Set(), heavyUntil = 0, maxH = 0, beyond = false;
  // rooms (setRooms: the tuner's rooms, the game's room entities) and regions (setRegions: the game's room / building menus,
  // Area settings, fog of war): [{ id, rect: [x0, z0, x1, z1] | poly: [[x, z], ...], type, outdoor, height: null | ft (0 = no fog
  // here; null = the type's default / the profile), hidden }]. Regions draw over rooms.
  let rooms = [], regions = [], typeFog = { ...FOG_BY_TYPE };
  const norm = (r) => ({ id: r.id ?? Math.random().toString(36).slice(2), rect: r.rect || null, poly: r.poly || null, type: r.type || null, outdoor: !!r.outdoor, height: r.height ?? null, hidden: !!r.hidden });
  // the fog height a place gets: its own setting > max(its type's default if rooms keep their own, the indoor profile's)
  const heightOf = (r) => r.height != null ? Math.max(0, +r.height) : r.outdoor ? P.outdoor.height : Math.max(P.indoor.own ? (typeFog[r.type] ?? 0) : 0, P.indoor.height);
  const typeDefault = (type, outdoor = false) => outdoor ? P.outdoor.height : Math.max(P.indoor.own ? (typeFog[type] ?? 0) : 0, P.indoor.height);

  const structOf = () => {
    const out = [];
    for (const it of (structure ? structure() : items())) { const sp = it?.spec; if (!sp || !it.group) continue; const layer = sp.layer || it.layer; if (layer === 'floor' && !sp.soft) out.push({ kind: 'floor', it, sp }); else if (layer === 'walls') out.push({ kind: 'wall', it, sp }); }
    return out;
  };
  const poseOf = (it, sp) => { const r = it.rest; return r ? { x: r.x, y: r.y ?? 0, z: r.z, rot: r.rot ?? 0 } : { x: sp.x ?? it.group.position.x, y: sp.y ?? 0, z: sp.z ?? it.group.position.z, rot: sp.rot ?? it.group.rotation.y }; };
  // a floor counts once it has LANDED (spawn animation nearly over): a room's arrival sweeps the fog away tile by tile
  const landedFloor = (it, y) => { const g = it.group; return g.visible && (g.parent || it.asleep) && Math.abs(g.scale.y - 1) < 0.35 && Math.abs(g.position.y - y) < 1.5; };
  const ptsOf = (r) => r.rect ? [[r.rect[0], r.rect[1]], [r.rect[2], r.rect[1]], [r.rect[2], r.rect[3]], [r.rect[0], r.rect[3]]] : r.poly || [];
  const inRegion = (r, x, z) => { if (r.rect) return x >= r.rect[0] && x <= r.rect[2] && z >= r.rect[1] && z <= r.rect[3]; const p = r.poly || []; let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
  function measure() {
    const list = structOf(), recs = [], outdoorRooms = rooms.filter(r => r.outdoor);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, sig = '';
    for (const s of list) {
      const { x, y, z, rot } = poseOf(s.it, s.sp), [w, , d] = s.sp.dims || [1, 1, 1];
      const r = Math.hypot(w, d) / 2; x0 = Math.min(x0, x - r); z0 = Math.min(z0, z - r); x1 = Math.max(x1, x + r); z1 = Math.max(z1, z + r);
      if (s.kind === 'floor' && !landedFloor(s.it, y)) continue;
      // the ground of a wall-less outdoor room is not "indoors"
      const outdoor = s.kind === 'floor' && outdoorRooms.some(o => inRegion(o, x, z));
      const rec = { kind: s.kind, x, z, rot, w, d, id: s.sp.id || '', outdoor, key: `${s.kind[0]}${Math.round(x * 10)},${Math.round(z * 10)},${Math.round(rot * 100)}${outdoor ? 'o' : ''}` };
      recs.push(rec); sig += rec.key + rec.id + ';';
    }
    for (const r of [...rooms, ...regions]) { for (const [x, z] of ptsOf(r)) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } sig += `${r.id}:${heightOf(r).toFixed(2)}${r.hidden ? 'h' : ''}${r.outdoor ? 'o' : ''}${ptsOf(r).flat().map(v => Math.round(v)).join(',')};`; }
    sig += `|${P.indoor.height}|${P.outdoor.height}|${P.indoor.own}`;
    return { recs, sig, x0, z0, x1, z1, any: isFinite(x0) };
  }
  // one drawing for both canvases: R = fog height / 16 ft, G = hidden, B = indoors
  const H8 = (h) => Math.round(Math.max(0, Math.min(16, h)) / 16 * 255);
  function drawPlace(canvas, tex, o, recs) {
    if (canvas.width !== o.gw || canvas.height !== o.gd) { canvas.width = o.gw; canvas.height = o.gd; }
    const g = canvas.getContext('2d'), cell = o.cell;
    const X = (x) => (x - o.x0) / cell, Z = (z) => (z - o.z0) / cell;
    g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgb(${H8(P.outdoor.height)},0,0)`; g.fillRect(0, 0, o.gw, o.gd);
    const hin = H8(typeDefault(null));
    for (const s of recs) if (s.kind === 'floor' && !s.outdoor) { g.save(); g.translate(X(s.x), Z(s.z)); g.rotate(-s.rot); g.fillStyle = `rgb(${hin},0,255)`; g.fillRect(-(s.w + 0.1) / 2 / cell, -(s.d + 0.1) / 2 / cell, (s.w + 0.1) / cell, (s.d + 0.1) / cell); g.restore(); }
    const shape = (r) => { g.beginPath(); ptsOf(r).forEach(([x, z], i) => { if (i) g.lineTo(X(x), Z(z)); else g.moveTo(X(x), Z(z)); }); g.closePath(); g.fill(); };
    // a room / region sets the fog height over its own ground (and says whether that ground is indoors)
    // (an outdoor ROOM, a yard, is built open ground: G = 96, see hiddenOf in the shader; an outdoor region is just outdoors)
    for (const r of [...rooms, ...regions]) if (r.height != null || r.type || r.outdoor) { g.fillStyle = `rgb(${H8(heightOf(r))},${r.outdoor && rooms.includes(r) ? 96 : 0},${r.outdoor ? 0 : 255})`; shape(r); }
    g.globalCompositeOperation = 'lighter';
    for (const r of regions) if (r.hidden) { g.fillStyle = 'rgb(0,255,0)'; shape(r); }
    tex.dispose(); tex.image = canvas; tex.needsUpdate = true;
  }
  function drawMask(recs) {
    const g = maskCanvas.getContext('2d', { willReadFrequently: true }), cell = dom.cell;
    if (maskCanvas.width !== dom.gw || maskCanvas.height !== dom.gd) { maskCanvas.width = dom.gw; maskCanvas.height = dom.gd; }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, dom.gw, dom.gd); g.globalCompositeOperation = 'lighter';
    const minT = cell <= 1.0 ? 1.7 * cell : 0, pad = 8 + 2 * cell; // zoomed far out a wall is thinner than a cell: it stops being an obstacle; the place canvas still says indoors
    const rect = (x, z, rot, w, d, col) => { g.save(); g.translate((x - dom.x0) / cell, (z - dom.z0) / cell); g.rotate(-rot); g.fillStyle = col; g.fillRect(-w / 2 / cell, -d / 2 / cell, w / cell, d / cell); g.restore(); };
    for (const s of recs) {
      const { x, z, rot, w, d } = s;
      if (x < dom.x0 - pad || z < dom.z0 - pad || x > dom.x0 + dom.W + pad || z > dom.z0 + dom.D + pad) continue;
      if (s.kind === 'floor') { if (!s.outdoor) rect(x, z, rot, w + 0.1, d + 0.1, 'rgb(0,255,0)'); continue; }
      const t = Math.max(d, minT);
      if (/doorway/.test(s.id)) { // jambs at the ends; the opening is open at fog height, closed at the ceiling
        const j = Math.max(w * 0.14, minT), c = Math.cos(rot), sn = Math.sin(rot), off = w / 2 - j / 2;
        rect(x + c * off, z - sn * off, rot, j, t, 'rgb(255,0,255)'); rect(x - c * off, z + sn * off, rot, j, t, 'rgb(255,0,255)');
        rect(x, z, rot, w, t, 'rgb(0,0,255)');
      } else rect(x, z, rot, Math.max(w, minT), t, 'rgb(255,0,255)');
    }
    maskTex.dispose(); maskTex.image = maskCanvas; maskTex.needsUpdate = true;
  }
  function drawWindow(recs) {
    drawPlace(placeCanvas, placeTex, dom, recs); drawMask(recs);
    beyond = world.x0 < dom.x0 || world.z0 < dom.z0 || world.x0 + world.W > dom.x0 + dom.W || world.z0 + world.D > dom.z0 + dom.D;
    dropMotes();
  }
  function drawAll(m) {
    recsNow = m.recs; dom.sig = m.sig;
    // the whole-map canvas: the built map (and every room / region) plus a margin, 2 ft a texel or coarser, at most 1024
    if (m.any) {
      const k = 32, x0 = Math.floor((m.x0 - 24) / k) * k, z0 = Math.floor((m.z0 - 24) / k) * k, x1 = Math.ceil((m.x1 + 24) / k) * k, z1 = Math.ceil((m.z1 + 24) / k) * k;
      const cell = Math.max(2, Math.max(x1 - x0, z1 - z0) / 1024);
      Object.assign(world, { x0, z0, W: x1 - x0, D: z1 - z0, cell, gw: Math.max(4, Math.ceil((x1 - x0) / cell)), gd: Math.max(4, Math.ceil((z1 - z0) / cell)) });
    } else Object.assign(world, { x0: dom.x0, z0: dom.z0, W: 64, D: 64, cell: 16, gw: 4, gd: 4 });
    drawPlace(worldCanvas, worldTex, world, m.recs);
    maxH = Math.max(P.indoor.height, P.outdoor.height, typeDefault(null), ...rooms.map(heightOf), ...regions.map(heightOf));
    drawWindow(m.recs);
  }
  // new landed floor: the fog is blown outward from the new footprint and cleared inside it
  function arrivals(recs) {
    const now = new Set(recs.filter(r => r.kind === 'floor').map(r => r.key));
    const fresh = recs.filter(r => r.kind === 'floor' && !drawnKeys.has(r.key)), first = !firstDrawn;
    drawnKeys = now; firstDrawn = true;
    if (!fresh.length || first) return; // the first look at a finished map: nothing arrives
    let cx = 0, cz = 0; for (const r of fresh) { cx += r.x; cz += r.z; } cx /= fresh.length; cz /= fresh.length;
    const k = Math.max(0.4, P.flow.stir), pick = fresh.length > 40 ? fresh.filter((_, i) => i % Math.ceil(fresh.length / 40) === 0) : fresh;
    for (const r of pick) { let dx = r.x - cx, dz = r.z - cz; const L = Math.hypot(dx, dz); if (L < 0.5) { const a = Math.random() * 6.28; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= L; dz /= L; }
      splat(r.x, r.z, (dx * 14 - dz * 5) * k, (dz * 14 + dx * 5) * k, -0.12, 3.4, -1.5); }
    stats.arrivals += fresh.length;
  }
  // (re)build the window's targets when the quality changes its cell count
  function alloc() {
    const n = Q.sim, key = `${n}`; if (key === dom.key) return false;
    dom.key = key; Object.assign(dom, { gw: n, gd: n, W: n * dom.cell, D: n * dom.cell });
    for (const r of [vel, den, prs, pool, prevDen]) r?.dispose?.(); for (const r of [divRT, curlRT, lightLo, lightHi]) r?.dispose();
    vel = pair(n, n); den = pair(n, n); prs = pair(n, n); pool = pair(n, n); divRT = makeRT(n, n); curlRT = makeRT(n, n); prevDen = makeRT(n, n);
    lightLo = makeRT(Q.light, Q.light); lightHi = makeRT(Q.light, Q.light);
    needsInit = true; xfade = 1; return true;
  }
  // the ground the camera sees (x / z box), rays capped at a distance so a low pitch does not ask for the horizon
  const _vr = new THREE.Raycaster(), _vn = new THREE.Vector2(), _vg = new THREE.Vector3(), _vc = new THREE.Vector3(), ground0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function visibleGround() {
    camera.updateMatrixWorld(); camera.getWorldPosition(_vc);
    const cap = Math.max(160, 5 * Math.max(1, _vc.y));
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [-1, 0], [1, 0]]) {
      _vn.set(nx, ny); _vr.setFromCamera(_vn, camera); const r = _vr.ray, hit = r.intersectPlane(ground0, _vg);
      const hl = Math.hypot(r.direction.x, r.direction.z) || 1;
      if (!hit || Math.hypot(_vg.x - _vc.x, _vg.z - _vc.z) > cap) _vg.set(_vc.x + r.direction.x / hl * cap, 0, _vc.z + r.direction.z / hl * cap);
      x0 = Math.min(x0, _vg.x); z0 = Math.min(z0, _vg.z); x1 = Math.max(x1, _vg.x); z1 = Math.max(z1, _vg.z);
    }
    return { x0, z0, x1, z1 };
  }
  // fit the window to the view. Returns false | 'pan' | 'zoom'. The fields still describe the OLD window until the
  // next sim step re-reads them (pendingMove keeps that old window)
  let pendingMove = null, prevDen = null, prevWin = null, xfade = 1, zoomSnap = false;
  function fitWindow(force) {
    const v = visibleGround(), n = dom.gw, span = Math.max(v.x1 - v.x0, v.z1 - v.z0) * 1.06;
    const kf = Math.log(Math.max(span, 6) / (n * CELL0)) / Math.log(ZSTEP);
    let k = dom.k; if (force || Math.abs(kf - k) > 0.65) k = Math.max(-6, Math.min(16, Math.round(kf + 0.15))); // hysteresis: no flapping between two scales
    const cell = CELL0 * Math.pow(ZSTEP, k), W = n * cell;
    const nx = Math.round(((v.x0 + v.x1) / 2 - W / 2) / cell) * cell, nz = Math.round(((v.z0 + v.z1) / 2 - W / 2) / cell) * cell;
    const zoom = k !== dom.k;
    if (!force && !zoom && nx === dom.x0 && nz === dom.z0) return false;
    if (!needsInit) { pendingMove ||= { x0: dom.x0, z0: dom.z0, W: dom.W }; if (zoom) zoomSnap = true; }
    Object.assign(dom, { x0: nx, z0: nz, cell, k, W, D: W });
    if (zoom) stats.zooms++; else stats.shifts++;
    return zoom ? 'zoom' : 'pan';
  }
  // per frame: keep the window on the view; now and then (poll): re-read the rooms
  function ensureDomain(poll = true) {
    Q = QUALITY[P.quality.level] || QUALITY.medium;
    const fresh = alloc(), mv = fitWindow(fresh);
    if (fresh || poll) { const m = measure(); if (fresh || mv || m.sig !== dom.sig) { drawAll(m); arrivals(m.recs); return true; } return false; }
    if (mv) drawWindow(recsNow);
    return !!mv;
  }
  function swirlRegion(r, dir) {
    const pts = ptsOf(r); if (!pts.length) return;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, n = 14;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rx = cx + Math.cos(a) * (x1 - x0) * 0.32, rz = cz + Math.sin(a) * (z1 - z0) * 0.32;
      splat(rx, rz, (Math.cos(a) * 10 * dir - Math.sin(a) * 8) , (Math.sin(a) * 10 * dir + Math.cos(a) * 8), 0, 3.2, dir > 0 ? -0.35 : 0); }
  }
  function setRegions(list) {
    const old = new Map(regions.map(r => [r.id, r]));
    regions = (list || []).map(norm);
    // a reveal swirls the war fog away; a hide sucks it in
    for (const r of regions) { const o = old.get(r.id); if (!!o?.hidden !== r.hidden) swirlRegion(r, r.hidden ? -1 : 1); }
    for (const [id, o] of old) if (o.hidden && !regions.some(r => r.id === id)) swirlRegion(o, 1);
    if (regions.some(r => r.hidden)) heavyUntil = Infinity; else if (heavyUntil === Infinity) heavyUntil = performance.now() + 15000;
    structT = -1e9;
  }
  // (storeys, 2026-10-05) which floor the fog lies on: base = that floor's height in feet (0 = the ground, the default),
  // indoorOnly = only rooms' own fog there (an upper storey, a cellar): no outdoor fog, no sea. The caller passes that
  // level's rooms (setRooms) and walls (structure). With the defaults nothing changes.
  const level = { base: 0, indoorOnly: false };
  function setLevel({ base = 0, indoorOnly = false } = {}) { level.base = +base || 0; level.indoorOnly = !!indoorOnly; }
  function setRooms(list) { rooms = (list || []).map(norm); structT = -1e9; }

  // ---- fire hookup (set by fx/index.js)
  let fire = null, lighting = null;
  // ---- splat queue
  const splats = []; // {x, z, r, vx, vz, dd (ground fog), dg (heavy fog)}; drained MAX_SPLATS a frame
  function splat(x, z, vx, vz, dd = 0, r = 1.5, dg = 0, mc = 2.5) { if (splats.length < 256) splats.push({ x, z, r, vx, vz, dd, dg, mc }); } // mc: least radius, in cells

  // ---- pointer stirring
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
  const ptr = { cx: 0, cy: 0, moved: false, have: false, last: null, t: 0 };
  const onMove = (e) => { const r = renderer.domElement.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { ptr.have = false; return; } ptr.cx = e.clientX - r.left; ptr.cy = e.clientY - r.top; ptr.w = r.width; ptr.h = r.height; ptr.moved = true; ptr.have = true; };
  window.addEventListener('pointermove', onMove, { passive: true });
  const _hit = new THREE.Vector3();
  function pointerSplat(dt) {
    if (!ptr.moved) return; ptr.moved = false;
    plane.constant = -Math.min(1.2, Math.max(0.4, maxH * 0.4));
    ndc.set(ptr.cx / ptr.w * 2 - 1, -(ptr.cy / ptr.h) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, _hit)) { ptr.last = null; return; }
    const now = performance.now();
    if (ptr.last && now - ptr.t < 200) {
      const sdt = Math.max(1 / 120, (now - ptr.t) / 1000), vx = (_hit.x - ptr.last.x) / sdt, vz = (_hit.z - ptr.last.z) / sdt, sp = Math.hypot(vx, vz);
      // the cursor's footprint is the Stir radius slider (in feet at play zoom, growing with the zoom beyond it) and its
      // push is capped per cell, so a wiggle feels the same at every zoom (from far away it makes a house-sized swirl)
      const rad = stirRadAt(_hit);
      if (sp > 0.5 * zs()) { const k = Math.min(1, 30 * zs() / sp) * P.flow.stir; const steps = Math.min(6, Math.ceil(Math.hypot(_hit.x - ptr.last.x, _hit.z - ptr.last.z) / Math.max(0.5, rad))); // a fast stroke leaves a trail, not one blob
        for (let i = 1; i <= steps; i++) { const f = i / steps; splat(ptr.last.x + (_hit.x - ptr.last.x) * f, ptr.last.z + (_hit.z - ptr.last.z) * f, vx * k * 0.6 / steps * 2, vz * k * 0.6 / steps * 2, -P.flow.wake * 0.45 * Math.max(0.3, P.indoor.density) / steps, rad, 0, STIR_MIN); } }
    }
    ptr.last = _hit.clone(); ptr.t = now;
  }

  // ---- movers: anything that moves (tuner items, game objects + pawns) stirs the fog
  let movers = [], cursorSet = new Set(), moversT = -1e9; const lastPos = new WeakMap(); const _wp = new THREE.Vector3();
  function refreshMovers(now) {
    if (now - moversT < 500) return; moversT = now;
    const set = new Set();
    for (const it of items()) { const layer = it?.spec?.layer || it?.layer; if (it?.group && !STRUCT.has(layer)) set.add(it.group); }
    for (const g of scene.children) collect(g, set, 0);
    // other seats' cursors (and LLM ghost cursors) stir this client's fog too: the sim is local, the stirring is shared
    cursorSet = new Set(stirrers ? stirrers() : []); for (const o of cursorSet) set.add(o);
    movers = [...set];
  }
  function collect(o, set, depth) { if (depth > 3) return; if (o.userData?.entityId && !o.userData.shellKey) { set.add(o); return; } for (const c of o.children) if (c.isGroup || c.type === 'Object3D') collect(c, set, depth + 1); }
  function moverSplats(dt) {
    const cands = [];
    for (const g of movers) {
      if (!g.parent || !g.visible) { lastPos.delete(g); continue; }
      g.getWorldPosition(_wp); const lp = lastPos.get(g);
      if (lp) { const dx = _wp.x - lp.x, dz = _wp.z - lp.z, d2 = dx * dx + dz * dz; if (d2 > 1e-4 && d2 < 400 * zs() * zs()) { const it = g.userData.item; const dims = it?.spec?.dims, cur = cursorSet.has(g); const r = cur ? stirRad() : dims ? Math.max(0.8, Math.min(5, Math.max(dims[0], dims[2]) * 0.6)) : 1.4; cands.push({ x: _wp.x, z: _wp.z, vx: dx / dt, vz: dz / dt, r, s: d2, cur }); } lp.set(_wp.x, _wp.y, _wp.z); }
      else lastPos.set(g, _wp.clone());
    }
    cands.sort((a, b) => b.s - a.s);
    for (const c of cands.slice(0, 10)) { const sp = Math.hypot(c.vx, c.vz), k = P.flow.stir * (c.cur ? 0.6 : 0.9) * Math.min(1, 30 * zs() / Math.max(sp, 1e-3)); if (c.cur) stats.cursors++; splat(c.x, c.z, c.vx * k, c.vz * k, -P.flow.wake * 0.25 * Math.max(0.3, P.indoor.density), c.cur ? c.r : c.r * stirK(), 0, c.cur ? STIR_MIN : Math.max(1, 1.25 * stirK())); } // a thing keeps its own size in feet; its least footprint in cells follows the slider and only bites zoomed out
    stats.movers = cands.length;
  }

  // ---- flames: pooling sources, wisps, extinguish puffs
  let flames = [], flameT = -1e9; const litSeen = new Map(); // item -> last live flames [{world, kind}]
  const pendingPuffs = []; // a fire that left the fire list: puff once its thing has stood still a moment (an out-animation moves)
  function readFlames(now) {
    if (!fire || now - flameT < 100) return; flameT = now;
    const all = fire.flames(); flames = all.filter(f => f.world);
    const cur = new Map();
    for (const f of all) { if (!cur.has(f.item)) cur.set(f.item, []); if (f.world) cur.get(f.item).push({ world: f.world.clone(), kind: f.kind }); }
    for (const [it, list] of litSeen) if (!cur.has(it)) { litSeen.delete(it); const g = it.group; if (g?.parent && g.visible && list.length) pendingPuffs.push({ it, list, t: now, p: g.position.clone(), s: g.scale.y }); }
    for (const [it, list] of cur) if (list.length) litSeen.set(it, list);
    for (let i = pendingPuffs.length - 1; i >= 0; i--) {
      const q = pendingPuffs[i]; if (now - q.t < 150) continue; pendingPuffs.splice(i, 1);
      const g = q.it.group; if (!g?.parent || !g.visible || g.position.distanceTo(q.p) > 0.05 || Math.abs(g.scale.y - q.s) > 0.02 || cur.has(q.it)) continue;
      if (P.smoke.puff > 0) for (const f of q.list.slice(0, 6)) puff(f.world, f.kind === 'volume' ? 1 : 0.35);
    }
  }

  // ---- soft particle batch (hearth smoke from fire.js, puffs): rendered by the pass into the fx target
  const fxScene = new THREE.Scene(); fxScene.name = 'fx-atmos';
  const softBatch = new BatchedRenderer(); softBatch.userData.fx = true; fxScene.add(softBatch);
  const emitRoot = new THREE.Group(); emitRoot.name = 'fx-atmos-emitters'; scene.add(emitRoot);
  const whiteDepth = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); whiteDepth.needsUpdate = true;
  const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const puffMat = new THREE.MeshBasicMaterial({ map: puffTex, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
  const puffs = [];
  function puff(at, size = 1) {
    const k = P.smoke.puff * size, g = 1 - Math.min(1, 0.35 * P.smoke.dark);
    const sys = new ParticleSystem({
      duration: 0.25, looping: false, worldSpace: true, autoDestroy: true, maxParticle: 40,
      startLife: new IntervalValue(1.6, 2.8), startSpeed: new IntervalValue(0.3 * k, 1.1 * k), startSize: new IntervalValue(0.25 * size, 0.55 * size), startRotation: new IntervalValue(0, 6.28),
      startColor: new ConstantColor(new QV4(g, g * 0.98, g * 0.95, 1)), emissionOverTime: new ConstantValue(0),
      emissionBursts: [{ time: 0, count: new ConstantValue(Math.round(10 + 14 * size * Math.min(2, P.smoke.puff))), cycle: 1, interval: 0.01, probability: 1 }],
      shape: new SphereEmitter({ radius: 0.12 + 0.3 * size, thickness: 1 }), material: puffMat, renderMode: RenderMode.BillBoard, renderOrder: 4,
      softParticles: true, softNearFade: 0, softFarFade: Math.max(0.05, P.smoke.soft),
    });
    sys.addBehavior(new ColorOverLife(new Gradient([[new QV3(1, 1, 1), 0], [new QV3(1, 1, 1), 1]], [[0, 0], [0.55, 0.08], [0.25, 0.5], [0, 1]])));
    sys.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(0.6, 1.6, 2.6, 3.4 * P.smoke.spread), 0]])));
    sys.addBehavior(new RotationOverLife(new IntervalValue(-0.6, 0.6)));
    sys.addBehavior(new ApplyForce(new QV3(0, 1, 0), new ConstantValue(0.35 * P.smoke.rise)));
    sys.addBehavior(new TurbulenceField(new QV3(0.8, 0.8, 0.8), 2, new QV3(0.6, 0.3, 0.6), new QV3(0.15, 0.15, 0.15)));
    sys.emitter.position.copy(at); sys.emitter.rotation.x = -Math.PI / 2; sys.emitter.userData.fx = true; emitRoot.add(sys.emitter); softBatch.addSystem(sys);
    puffs.push({ sys, t: performance.now() });
    // the puff shoves the fog outward and thickens the ceiling smoke a little
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; splat(at.x + Math.cos(a) * 0.8, at.z + Math.sin(a) * 0.8, Math.cos(a) * 6 * k, Math.sin(a) * 6 * k, 0.05 * k, 1.2 * Math.max(0.6, size)); }
    poolKick.push({ x: at.x, z: at.z, s: 3 * size });
    stats.puffs++;
  }
  const poolKick = [];

  // ---- dust motes (points) and candle wisps (instanced ribbons): drawn into the fx target with a manual depth fade
  const softU = () => ({ uDepth: { value: whiteDepth }, uRes: { value: new THREE.Vector2(1, 1) }, uNF: { value: new THREE.Vector2(0.5, 2000) }, uUseDepth: { value: 0 }, uSoftK: { value: 2 } });
  const moteMat = new THREE.ShaderMaterial({ vertexShader: MOTE_VS, fragmentShader: MOTE_FS, transparent: true, depthWrite: false, depthTest: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    uniforms: { ...softU(), uTime: { value: 0 }, uPx: { value: 500 }, uVel: { value: black }, uLo: { value: black }, uHi: { value: black }, uOrigin: { value: new THREE.Vector2() }, uSize: { value: new THREE.Vector2(1, 1) }, uAmb: { value: new THREE.Vector3() }, uGlow: { value: 1 }, uLoY: { value: 1.2 }, uHiY: { value: CEIL - 1 }, uSizeFt: { value: 0.07 }, uCatch: { value: 1 }, uBright: { value: 1 } } });
  let motes = null;
  function dropMotes() { if (motes) { motes.removeFromParent(); motes.geometry.dispose(); motes = null; } }
  function buildMotes(n) {
    dropMotes(); if (n <= 0) return;
    // seed inside the indoor cells (the mask's G), else anywhere in the domain
    const g = maskCanvas.getContext('2d'), data = g.getImageData(0, 0, dom.gw, dom.gd).data, cells = [];
    for (let j = 0; j < dom.gd; j += 2) for (let i = 0; i < dom.gw; i += 2) { const o = (j * dom.gw + i) * 4; if (data[o + 1] > 128 && data[o] < 64) cells.push([i, j]); }
    const arr = new Float32Array(n * 4); let s = 1234567; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < n; k++) { const c = cells.length ? cells[Math.floor(rnd() * cells.length)] : [rnd() * dom.gw, rnd() * dom.gd]; arr[k * 4] = dom.x0 + (c[0] + rnd() * 2) * dom.cell; arr[k * 4 + 1] = 0.3 + rnd() * (CEIL - 0.8); arr[k * 4 + 2] = dom.z0 + (c[1] + rnd() * 2) * dom.cell; arr[k * 4 + 3] = rnd(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('seed', new THREE.BufferAttribute(arr, 4)); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    motes = new THREE.Points(geo, moteMat); motes.frustumCulled = false; motes.renderOrder = 7; fxScene.add(motes);
  }
  const wispGeo = new THREE.InstancedBufferGeometry(); { const pg = new THREE.PlaneGeometry(1, 1, 1, 18); wispGeo.index = pg.index; wispGeo.setAttribute('position', pg.getAttribute('position')); wispGeo.setAttribute('uv', pg.getAttribute('uv')); }
  const wBase = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WISPS * 4), 4), wAmp = new THREE.InstancedBufferAttribute(new Float32Array(MAX_WISPS), 1);
  wBase.setUsage(THREE.DynamicDrawUsage); wAmp.setUsage(THREE.DynamicDrawUsage); wispGeo.setAttribute('iBase', wBase); wispGeo.setAttribute('iAmp', wAmp); wispGeo.instanceCount = 0;
  const wispMat = new THREE.ShaderMaterial({ vertexShader: WISP_VS, fragmentShader: WISP_FS, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { ...softU(), uTime: { value: 0 }, uRise: { value: 1 }, uSpread: { value: 1 }, uLen: { value: 1.6 }, uWidth: { value: 0.09 }, uWind: { value: new THREE.Vector2() }, uAmount: { value: 0.6 }, uCol: { value: new THREE.Color() }, uWarm: { value: new THREE.Color() } } });
  const wisps = new THREE.Mesh(wispGeo, wispMat); wisps.frustumCulled = false; wisps.renderOrder = 6; fxScene.add(wisps);
  const wispPhase = new WeakMap();

  // ---- the noise sheets (views with no post stack). Hidden while the main view renders through the pass (mainView)
  let lastSheetT = -1e9, inMain = false;
  const sheetGeo = new THREE.PlaneGeometry(1, 1); sheetGeo.rotateX(-Math.PI / 2);
  const sheetU = { uWorld: { value: worldTex }, uWOrigin: { value: new THREE.Vector2() }, uWSize: { value: new THREE.Vector2(1, 1) }, uFade: { value: new THREE.Vector2(220, 560) }, uPlaceOut: { value: 0 },
    uHeavyK: { value: 1.8 }, uHeavyH: { value: 9 }, uHeavyOn: { value: 0 }, uInCol: { value: new THREE.Vector3() }, uOutCol: { value: new THREE.Vector3() }, uHeavyCol: { value: new THREE.Vector3() }, uAmb: { value: new THREE.Vector3() }, uSky: { value: new THREE.Vector3() },
    uIn: { value: new THREE.Vector4() }, uOut: { value: new THREE.Vector4() }, uTime: { value: 0 }, uUnbuilt: { value: 0 }, uSeaDrift: { value: 0 }, uDriftIn: { value: new THREE.Vector2() }, uDriftOut: { value: new THREE.Vector2() } };
  const sheets = [0, 1].map(layer => {
    const m = new THREE.Mesh(sheetGeo, new THREE.ShaderMaterial({ vertexShader: SHEET_VS, fragmentShader: SHEET_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...sheetU, uLayer: { value: layer } } }));
    m.frustumCulled = false; m.renderOrder = 8 + layer; m.userData.fx = true; m.userData.noPick = true; m.raycast = () => { }; m.visible = false; m.name = 'fx-atmos-sheet';
    m.scale.set(9000, 1, 9000);
    m.onBeforeRender = (r, sc, cam) => { lastSheetT = performance.now(); m.material.uniforms.uFade.value.copy(fadeOf(cam)); m.position.x = _wp.x; m.position.z = _wp.z; m.updateMatrixWorld(true); };
    scene.add(m); return m;
  });

  // ---- the volume + composite (owned by the pass)
  const volMat = new THREE.ShaderMaterial({ vertexShader: VS_FS, fragmentShader: FS.volume, depthTest: false, depthWrite: false, uniforms: {} });
  const compMat = new THREE.ShaderMaterial({ vertexShader: VS_FS, fragmentShader: FS.composite, depthTest: false, depthWrite: false, transparent: true, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, uniforms: { uFx: { value: null }, uLowZ: { value: null }, uDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uNF: { value: new THREE.Vector2() }, uBilateral: { value: 1 } } });
  const lowzMat = new THREE.ShaderMaterial({ vertexShader: VS_FS, fragmentShader: FS.lowz, depthTest: false, depthWrite: false, uniforms: { uDepth: { value: null }, uNF: { value: new THREE.Vector2() } } });
  const fxRT = makeRT(4, 4), lowZ = makeRT(4, 4);
  const size = new THREE.Vector2(1, 1);
  const _cc = new THREE.Color();

  // ---- GPU timing (EXT_disjoint_timer_query_webgl2; absent headless -> null)
  const tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const gpu = { sim: null, draw: null }, pending = [];
  const tBegin = (label) => { if (!tq || globalThis.__gpuWrap || pending.length > 12 || pending.some(p => p.open)) return null; const q = gl.createQuery(); gl.beginQuery(tq.TIME_ELAPSED_EXT, q); const h = { q, label, open: true }; pending.push(h); return h; };
  const tEnd = (h) => { if (!h) return; gl.endQuery(tq.TIME_ELAPSED_EXT); h.open = false; };
  function tPoll() { for (let i = pending.length - 1; i >= 0; i--) { const h = pending[i]; if (h.open) continue; if (gl.getQueryParameter(h.q, gl.QUERY_RESULT_AVAILABLE)) { if (!gl.getParameter(tq.GPU_DISJOINT_EXT)) { const ms = gl.getQueryParameter(h.q, gl.QUERY_RESULT) / 1e6; gpu[h.label] = gpu[h.label] == null ? ms : gpu[h.label] * 0.9 + ms * 0.1; } gl.deleteQuery(h.q); pending.splice(i, 1); } } }

  const stats = { cursors: 0, zooms: 0, shifts: 0, arrivals: 0, movers: 0, puffs: 0, sim_calls: 0, draw_calls: 0, cpu_ms: 0, sim_cpu_ms: 0, lights: 0, wisps: 0, motes: 0, sources: 0 };
  let breathT = 0, structT = -1e9, structBusy = false, lastRenderT = -1e9, time = 0, lightFrame = 0, frameNo = 0;

  const fogMax = () => Math.max(P.indoor.height, P.outdoor.height, ...rooms.map(heightOf), ...regions.map(heightOf));
  // THE VIEWER'S SWITCH (setOff; the game's Settings > Me > Fog, 2026-10-11, Harry: "lets add a 'fog off' option"): with it
  // off this viewer gets no ground fog, fog sea, haze, dust or ceiling smoke, and the fluid is not simulated at all (every
  // test below answers no, so frame() returns before the window, the splats and the step). Fire smoke, wisps and puffs
  // belong to the fires and stay. The dials, the rooms' fog heights and what other seats see are untouched. It is
  // decoration only: nothing is hidden by this fog (regions marked hidden are a tuner demo; the game hides by not sending).
  let off = false;
  let viewScale = 1; // (setViewScale: this viewer draws the fog and smoke at a share of the look's own resolution; the game's Graphics > Soft effects at half resolution)
  const fogOn = () => !off && fogMax() > 0.03;
  const windOf = (pr) => { const a = THREE.MathUtils.degToRad(pr.driftDir); return new THREE.Vector2(-Math.sin(a) * pr.drift, Math.cos(a) * pr.drift); };
  // the fog bank's uniforms (the sim's target and the far field read the same ones) and what-is-where
  const bankU = () => ({ uIn: new THREE.Vector4(P.indoor.density, P.indoor.patchy, 1 / Math.max(1, P.indoor.scale), 0), uOut: new THREE.Vector4(P.outdoor.density, P.outdoor.patchy, 1 / Math.max(1, P.outdoor.scale), 0),
    uTime: time, uUnbuilt: P.world.unbuilt * 0.35, uSeaDrift: P.world.drift || 0, uDriftIn: windOf(P.indoor), uDriftOut: windOf(P.outdoor) });
  const whereU = () => ({ uPlace: placeTex, uWindIn: windOf(P.indoor), uWindOut: windOf(P.outdoor) });
  const zs = () => Math.max(1, dom.cell / CELL0); // how much bigger than the reference scale a cell is now
  // the Stir radius slider is the cursor's radius in feet, taken literally at play zoom (cells of 0.5 ft or finer, as it
  // was before the window followed the view) and scaled with the zoom beyond that, so a setting covers about the same
  // amount of screen from far away. The floor is one cell: it is the slider's least (0.5 ft) at the reference scale, so
  // it never overrides the slider. stirK: the slider's share of a moved thing's footprint (the thing's size, in feet)
  const STIR_MIN = 1, stirRad = () => Math.max(P.flow.radius * zs(), STIR_MIN * dom.cell), stirK = () => Math.max(0.6, P.flow.radius / 2);
  // flow.radiusPx (0 = off, the default): the LOCAL cursor's footprint as a size on screen, so a stir covers the same
  // number of pixels at any zoom and in any window (the tuner's view and the game's differ: field of view, distance, size)
  const _sc = new THREE.Vector3();
  const stirRadAt = (hit) => { const px = P.flow.radiusPx || 0; if (!(px > 0) || !ptr.h) return stirRad(); const ftPerPx = 2 * camera.getWorldPosition(_sc).distanceTo(hit) * Math.tan(THREE.MathUtils.degToRad(camera.fov || 45) / 2) / ptr.h; return Math.max(px * ftPerPx, STIR_MIN * dom.cell); };
  const loY = () => Math.min(1.5, Math.max(0.5, maxH * 0.45));
  // does anything live outside the window? (outdoor fog, the fog sea, outdoor haze, hidden places, foggy rooms out there)
  const farOn = () => !off && (P.outdoor.height > 0.03 || P.world.unbuilt > 0.001 || P.haze.amount * P.haze.outdoors > 0.001 || (beyond && (maxH > 0.03 || heavyOn())));
  const airOn = () => !off && (P.haze.amount > 0.001 || P.smoke.pool > 0.001);
  const heavyOn = () => !off && (P.world.unbuilt > 0.001 || performance.now() < heavyUntil);
  const simOn = () => !off && (fogOn() || heavyOn() || regions.some(r => r.hidden) || P.haze.dust > 0.001 || P.smoke.pool > 0.001 || P.quality.view !== 'fog');
  const linear = (hex, out) => out.set(hex).convertSRGBToLinear();

  function ambient(out) {
    out.set(0, 0, 0);
    if (hemi) { _cc.copy(hemi.color).multiplyScalar(hemi.intensity * 0.8); out.x += _cc.r; out.y += _cc.g; out.z += _cc.b; }
    if (sun) { _cc.copy(sun.color).multiplyScalar(sun.intensity * 0.25); out.x += _cc.r; out.y += _cc.g; out.z += _cc.b; }
    out.multiplyScalar(P.light.ambient);
    return out;
  }

  // ---------------------------------------------------------------- the sim step
  const vec2 = (x, y) => new THREE.Vector2(x, y);
  const splatA = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4()), splatB = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());
  const lpA = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()), lcA = Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4());
  const srcA = Array.from({ length: MAX_SPLATS }, () => new THREE.Vector4());
  function step(dtS) {
    const t0 = performance.now(), calls0 = simCalls;
    const texel = vec2(1 / dom.gw, 1 / dom.gd), sz = vec2(dom.W, dom.D), org = vec2(dom.x0, dom.z0);
    const common = { texel, uMask: maskTex }, where = whereU(), bank = bankU();
    const dt = Math.min(1 / 20, dtS) * P.flow.speed;
    const relaxNow = 1 - Math.exp(-P.flow.recover * dt);
    // the window moved (or is new): re-read every field from where it was; uncovered ground starts calm, at its bank.
    // A zoom step first keeps the old fog for a short cross-fade
    if (needsInit || pendingMove) {
      const old = needsInit ? { x0: 1e7, z0: 1e7, W: 1 } : pendingMove;
      if (!needsInit && zoomSnap) { run(U(mats.scale, { ...common, uSrc: den.read.texture, uK: 1 }), prevDen); prevWin = { ...old }; xfade = 0; }
      needsInit = false; pendingMove = null; zoomSnap = false;
      for (const [f, kind] of [[vel, 0], [den, 1], [prs, 2], [pool, 2]]) { run(U(mats.scroll, { ...common, ...where, ...bank, uSrc: f.read.texture, uSize: sz, uOrigin: org, uOldOrigin: vec2(old.x0, old.z0), uOldSize: vec2(old.W, old.W), uKind: kind }), f.write); f.swap(); }
    }
    if (xfade < 1) xfade = Math.min(1, xfade + dtS / 0.4);
    // splats (velocity, then density)
    if (splats.length) {
      const list = splats.splice(0, MAX_SPLATS);
      list.forEach((s, i) => { splatA[i].set(s.x - dom.x0, s.z - dom.z0, Math.max(0.3, s.r, (s.mc || 2.5) * dom.cell), 0); splatB[i].set(s.vx, s.vz, s.dd || 0, s.dg || 0); }); // never smaller than a few cells: alive at every zoom
      run(U(mats.splat, { ...common, uSrc: vel.read.texture, uN: list.length, uMode: 0, uA: splatA, uB: splatB, uSize: sz, uVmax: 40 * zs() }), vel.write); vel.swap();
      if (list.some(s => s.dd || s.dg)) { run(U(mats.splat, { ...common, uSrc: den.read.texture, uN: list.length, uMode: 1, uA: splatA, uB: splatB, uSize: sz }), den.write); den.swap(); }
    }
    if (dt > 0) {
      run(U(mats.curl, { ...common, uVel: vel.read.texture }), curlRT);
      run(U(mats.vort, { ...common, ...where, uVel: vel.read.texture, uCurl: curlRT.texture, uCurlK: P.flow.swirl * 0.2 * CELL0 / dom.cell, uWindK: 0.8, uVmax: 40 * zs(), dt }), vel.write); vel.swap();
      run(U(mats.div, { ...common, uVel: vel.read.texture }), divRT);
      run(U(mats.scale, { ...common, uSrc: prs.read.texture, uK: 0.8 }), prs.write); prs.swap();
      for (let i = 0; i < Q.iters; i++) { run(U(mats.press, { ...common, uP: prs.read.texture, uDiv: divRT.texture }), prs.write); prs.swap(); }
      run(U(mats.grad, { ...common, uP: prs.read.texture, uVel: vel.read.texture }), vel.write); vel.swap();
      const keep = Math.pow(0.02 + 0.979 * P.flow.linger, dt * 1.0); // per-second retention
      run(U(mats.advVel, { ...common, ...where, uVel: vel.read.texture, dt, uKeep: keep, uSize: sz }), vel.write); vel.swap();
    }
    run(U(mats.advDen, { ...common, ...where, ...bank, uVel: vel.read.texture, uDen: den.read.texture, dt, uRelax: relaxNow, uSize: sz, uOrigin: org,
      uHeavyIn: 3.0 * P.world.clear, uHeavyOut: 0.9 * P.world.clear, uSeed: 0, uSeep: P.outdoor.seep }), den.write); den.swap();
    // ceiling pool: fires feed it
    if (P.smoke.pool > 0.001 || P.quality.view === 'pool') {
      let n = 0;
      const srcs = [...flames.map(f => ({ x: f.world.x, z: f.world.z, s: f.kind === 'volume' ? 1 : f.kind === 'lantern' ? 0.03 : 0.06 })), ...poolKick.splice(0)].sort((a, b) => b.s - a.s).slice(0, MAX_SPLATS);
      for (const s of srcs) srcA[n++].set(s.x - dom.x0, s.z - dom.z0, 2.5, s.s);
      stats.sources = n;
      for (let k = 0; k < 2; k++) { run(U(mats.pool, { texel, uMask: maskTex, uPool: pool.read.texture, uN: n, uS: srcA, uSize: sz, dt: dtS, uRate: 0.25 * P.smoke.pool * P.smoke.amount, uDecay: 0.004 + 0.05 * (1 - P.smoke.pool), uMax: P.smoke.poolMax }), pool.write); pool.swap(); }
    }
    // light maps (every other frame: the flicker reads through either way)
    if (lightFrame++ % 2 === 0) {
      const ls = (fire ? fire.lights() : []).filter(l => l.visible && l.intensity > 0);
      const f = focus();
      ls.sort((a, b) => (b.intensity - a.intensity) * 0.3 + (f ? a.position.distanceTo(f) - b.position.distanceTo(f) : 0) * 0.1);
      const n = Math.min(MAX_LIGHTS, ls.length); stats.lights = n;
      for (let i = 0; i < n; i++) { const l = ls[i]; l.getWorldPosition(_wp); lpA[i].set(_wp.x, _wp.y, _wp.z, l.distance || 0); _cc.copy(l.color).multiplyScalar(l.intensity * (l.isSpotLight ? 0.5 : 1)); lcA[i].set(_cc.r, _cc.g, _cc.b, l.decay ?? 2); }
      const gridL = vec2(lightLo.width, lightLo.height);
      run(U(mats.light, { uMask: maskTex, uLP: lpA, uLC: lcA, uN: n, uY: loY(), uCh: 0, uOrigin: org, uSize: sz, uGrid: gridL }), lightLo);
      run(U(mats.light, { uMask: maskTex, uLP: lpA, uLC: lcA, uN: n, uY: CEIL - 1, uCh: 1, uOrigin: org, uSize: sz, uGrid: gridL }), lightHi);
    }
    stats.sim_calls = simCalls - calls0; stats.sim_cpu_ms = +(performance.now() - t0).toFixed(2);
  }

  // ---------------------------------------------------------------- per frame (before render)
  function updateSheets() {
    const on = !inMain && !level.indoorOnly && (fogOn() || heavyOn());
    for (const m of sheets) m.visible = on && (m.material.uniforms.uLayer.value < 0.5 ? fogOn() : heavyOn());
    if (!(fogOn() || heavyOn())) return;
    const u = sheetU, b = bankU();
    for (const k of Object.keys(b)) u[k].value = b[k];
    u.uWOrigin.value.set(world.x0, world.z0); u.uWSize.value.set(world.W, world.D); u.uPlaceOut.value = P.outdoor.height;
    u.uHeavyK.value = 1.8 * P.world.war; u.uHeavyH.value = P.world.height; u.uHeavyOn.value = heavyOn() ? 1 : 0;
    u.uInCol.value.copy(warmed(linear(P.indoor.color, _fc))); u.uOutCol.value.copy(warmed(linear(P.outdoor.color, _fc))); u.uHeavyCol.value.copy(linearV(P.world.color)); ambient(u.uAmb.value);
    if (scene.background?.isColor) u.uSky.value.set(scene.background.r, scene.background.g, scene.background.b);
    sheets[0].position.y = Math.max(0.4, 0.45 * Math.max(P.outdoor.height, 0.8)); sheets[1].position.y = 0.55 * P.world.height;
  }
  let shedEvery = 1, shedN = 0, shedAcc = 0, viewEvery = 1; // (viewEvery: this viewer's own standing choice, setViewEvery; shedEvery: the host's momentary one)
  function frame(dt, now) {
    const mainOn = !(now - lastRenderT > 1500 && frameNo > 30), sheetOn = now - lastSheetT < 1500;
    if (!mainOn && !sheetOn) { if (frameNo > 30 && Math.floor(now / 500) !== Math.floor((now - dt) / 500)) updateSheets(); return; } // this world is not on screen: nothing runs (the game keeps one per area)
    time += dt / 1000 * P.flow.speed;
    if (!mainOn) { // only a view with no post stack shows this world (a PiP): the noise sheets, no simulation
      if (now - structT > 500) { structT = now; const m = measure(); if (m.sig !== dom.sig) drawAll(m); }
      updateSheets(); return;
    }
    frameNo++;
    updateSheets();
    readFlames(now);
    // structure (rooms) -> domain + mask, polled
    for (const p of puffs.splice(0)) { if (now - p.t < 6000) puffs.push(p); else if (p.sys.emitter.parent) p.sys.dispose(); }
    softBatch.update(Math.min(0.1, dt / 1000));
    if (!simOn()) { splats.length = 0; poolKick.length = 0; return; }
    // the window follows the view every frame (whole cells); the rooms are polled
    const poll = now - structT > (structBusy ? 150 : 500); if (poll) structT = now;
    const changed = ensureDomain(poll); if (poll) structBusy = changed;
    if (!vel) return;
    refreshMovers(now);
    pointerSplat(dt / 1000);
    moverSplats(Math.max(1 / 240, dt / 1000));
    // the air breathes: slow, weak eddies at random places, so still fog is never a still picture
    breathT += dt / 1000 * P.flow.breath * P.flow.speed;
    while (breathT > 0.45) { breathT -= 0.45; const a = Math.random() * 6.283, k = (2 + 3 * Math.random()) * zs(); splat(dom.x0 + Math.random() * dom.W, dom.z0 + Math.random() * dom.D, Math.cos(a) * k, Math.sin(a) * k, 0, 2.5 + 3 * Math.random()); }
    const rt = renderer.getRenderTarget(), ac = renderer.autoClear, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.autoClear = false;
    // (shedEvery > 1: the host is short of time, the game while the hand is moving; the simulation takes one longer step every few frames)
    shedAcc += dt / 1000; if (++shedN % Math.max(shedEvery, viewEvery) !== 0) { renderer.setRenderTarget(rt); renderer.autoClear = ac; renderer.setClearColor(cc, ca); return; }
    const h = tBegin('sim'); step(Math.min(0.1, shedAcc)); shedAcc = 0; tEnd(h);
    renderer.setRenderTarget(rt); renderer.autoClear = ac; renderer.setClearColor(cc, ca);
    if (tq) tPoll();
  }

  // ---------------------------------------------------------------- per-frame uniforms for what the fx target draws
  const _amb = new THREE.Vector3(), _fc = new THREE.Color(), _hc = new THREE.Color();
  function updateDrawables(depthTex, w, h) {
    const useDepth = depthTex ? 1 : 0, nf = new THREE.Vector2(camera.near, camera.far);
    // soft hearth smoke + puffs: their depth texture
    softBatch.setDepthTexture(depthTex || whiteDepth);
    ambient(_amb);
    // motes
    const want = off ? 0 : Math.round(P.haze.dust * Q.dust);
    if (want > 0 && vel) { if (!motes || motes.geometry.getAttribute('seed').count !== Math.max(want, 1)) buildMotes(want); }
    else dropMotes();
    stats.motes = motes ? want : 0;
    if (motes) {
      const u = moteMat.uniforms, fov = camera.isPerspectiveCamera ? camera.fov : 50;
      Object.assign(u.uDepth, { value: depthTex || whiteDepth }); u.uUseDepth.value = useDepth; u.uRes.value.set(w, h); u.uNF.value.copy(nf); u.uSoftK.value = 4;
      u.uTime.value = time; u.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2)); u.uVel.value = vel.read.texture; u.uLo.value = lightLo.texture; u.uHi.value = lightHi.texture;
      u.uOrigin.value.set(dom.x0, dom.z0); u.uSize.value.set(dom.W, dom.D); u.uAmb.value.copy(_amb); u.uGlow.value = P.haze.dustGlow; u.uSizeFt.value = P.haze.dustSize; u.uCatch.value = P.light.catch; u.uHiY.value = CEIL - 1; u.uLoY.value = loY();
      u.uBright.value = 0.6;
    }
    // wisps over the small flames (candles, candelabra, chandeliers; not lanterns, they are enclosed)
    const f = focus(); let n = 0;
    if (P.smoke.wisps > 0.001) {
      const list = flames.filter(fl => fl.kind !== 'volume' && fl.kind !== 'lantern');
      if (f) list.sort((a, b) => a.world.distanceToSquared(f) - b.world.distanceToSquared(f));
      for (const fl of list.slice(0, MAX_WISPS)) { let ph = wispPhase.get(fl.item); if (ph == null) { ph = Math.random(); wispPhase.set(fl.item, ph); } wBase.setXYZW(n, fl.world.x, fl.world.y, fl.world.z, (ph + n * 0.137) % 1); wAmp.setX(n, 1); n++; }
    }
    wispGeo.instanceCount = n; wisps.visible = n > 0; stats.wisps = n;
    if (n) {
      wBase.needsUpdate = true; wAmp.needsUpdate = true;
      const u = wispMat.uniforms, wi = windOf(P.indoor);
      Object.assign(u.uDepth, { value: depthTex || whiteDepth }); u.uUseDepth.value = useDepth; u.uRes.value.set(w, h); u.uNF.value.copy(nf); u.uSoftK.value = 1 / Math.max(0.05, P.smoke.soft * 0.4);
      u.uTime.value = time; u.uRise.value = P.smoke.rise; u.uSpread.value = P.smoke.spread; u.uAmount.value = P.smoke.wisps * Math.min(1.5, P.smoke.amount);
      u.uWind.value.copy(wi);
      const gr = Math.max(0.05, 0.55 - 0.22 * P.smoke.dark); u.uCol.value.setRGB(gr + _amb.x * 0.6, gr + _amb.y * 0.6, gr + _amb.z * 0.6); u.uWarm.value.setRGB(1.6, 0.9, 0.45);
    }
  }

  // ---------------------------------------------------------------- the pass (post stack)
  class AtmosPass extends Pass {
    constructor() { super('AtmosPass'); this.needsSwap = false; this.needsDepthTexture = true; this.depth = null; }
    setDepthTexture(t) { this.depth = t; }
    setSize(w, h) { size.set(w, h); resizeFx(); }
    render(r, inputBuffer) {
      const t0 = performance.now(); lastRenderT = t0;
      const calls0 = r.info.render.calls;
      const h = tBegin('draw'); // (a bench timing the whole frame owns the one TIME_ELAPSED query: tBegin)
      const w = fxRT.width, hh = fxRT.height;
      updateDrawables(this.depth, w, hh);
      const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
      if (this.depth) { lowzMat.uniforms.uDepth.value = this.depth; lowzMat.uniforms.uNF.value.set(camera.near, camera.far); r.setRenderTarget(lowZ); fsMesh.material = lowzMat; r.render(fsScene, fsCam); }
      r.setRenderTarget(fxRT); r.setClearColor(0x000000, 0); r.clear(true, false, false);
      const volume = !off && vel && this.depth && (fogOn() || airOn() || heavyOn() || P.quality.view !== 'fog');
      if (volume) { setVolumeUniforms(this.depth); fsMesh.material = volMat; r.render(fsScene, fsCam); }
      const particles = softBatch.batches.some(b => b.systems.size > 0) || wisps.visible || !!motes;
      if (particles) r.render(fxScene, camera);
      if (volume || particles) {
        const cu = compMat.uniforms; cu.uFx.value = fxRT.texture; cu.uLowZ.value = lowZ.texture; cu.uDepth.value = this.depth; cu.uTexel.value.set(1 / w, 1 / hh); cu.uNF.value.set(camera.near, camera.far); cu.uBilateral.value = this.depth && w < size.x * 0.99 ? 1 : 0;
        r.setRenderTarget(inputBuffer); fsMesh.material = compMat; r.render(fsScene, fsCam);
      }
      r.setClearColor(cc, ca);
      tEnd(h);
      stats.draw_calls = r.info.render.calls - calls0; stats.cpu_ms = +(performance.now() - t0).toFixed(2); stats.volume = !!volume; stats.particles = !!particles;
    }
  }
  const pass = new AtmosPass();
  function resizeFx() { const s = Math.min(Q.scale, Q.cap / Math.max(1, size.x, size.y)) * viewScale, w = Math.max(4, Math.round(size.x * s)), h = Math.max(4, Math.round(size.y * s)); fxRT.setSize(w, h); lowZ.setSize(w, h); }
  const VIEWS = { fog: 0, density: 1, velocity: 2, mask: 3, light: 4, pool: 5, heavy: 6, place: 7 };
  const _pi = new THREE.Matrix4();
  const _sky = new THREE.Color();
  // the sea melts into the sky toward the horizon: by distance, scaled with the camera's height (from high up, far is near)
  const fadeOf = (cam) => { const h = Math.max(1, cam.getWorldPosition(_wp).y); return new THREE.Vector2(Math.max(220, 4.5 * h), Math.max(560, 11 * h)); };
  function setVolumeUniforms(depth) {
    if (scene.background?.isColor) _sky.copy(scene.background); else _sky.set('#1d1f1a');
    U(volMat, {
      ...bankU(), uPlace: placeTex, uWorld: worldTex, uWOrigin: vec2(world.x0, world.z0), uWSize: vec2(world.W, world.D), uPlaceOut: P.outdoor.height, uFar: farOn() ? 1 : 0, uBase: level.base, uIndoorOnly: level.indoorOnly ? 1 : 0,
      uPrevDen: prevDen.texture, uPOrigin: vec2(prevWin?.x0 ?? 0, prevWin?.z0 ?? 0), uPSize: vec2(prevWin?.W ?? 1, prevWin?.W ?? 1), uXfade: xfade,
      uDepth: depth, uDen: den.read.texture, uPool: pool.read.texture, uMask: maskTex, uLo: lightLo.texture, uHi: lightHi.texture, uVel: vel.read.texture,
      uProjInv: _pi.copy(camera.projectionMatrixInverse), uCamWorld: camera.matrixWorld, uCam: camera.getWorldPosition(new THREE.Vector3()),
      uOrigin: vec2(dom.x0, dom.z0), uSize: vec2(dom.W, dom.D), uHmax: Math.max(0.5, maxH), uCeil: CEIL,
      uFog: fogOn() ? 2.0 : 0, uHaze: P.haze.amount * 0.07, uFall: P.haze.falloff, uHazeOut: P.haze.outdoors, uPoolK: P.smoke.pool > 0.001 ? 0.35 * P.smoke.amount : 0, uPoolDark: Math.min(1, 0.5 * P.smoke.dark),
      uCatch: P.light.catch, uLoY: loY(), uHiY: CEIL - 1,
      uInCol: warmed(linear(P.indoor.color, _fc)), uOutCol: warmed(linear(P.outdoor.color, _fc)), uHazeCol: warmed(linear(P.haze.color, _hc)), uAmb: ambient(_amb),
      uSky: new THREE.Vector3(_sky.r, _sky.g, _sky.b), uFade: fadeOf(camera),
      uNg: Q.ground, uNa: airOn() ? Q.air : 0, uView: VIEWS[P.quality.view] || 0, uWind: windOf(P.outdoor),
      uHeavyOn: heavyOn() ? 1 : 0, uHeavyH: P.world.height, uHeavyK: 1.8 * P.world.war, uHeavyCol: linearV(P.world.color), uTexel: vec2(1 / dom.gw, 1 / dom.gd),
    });
  }
  const linearV = (hex) => { const c = new THREE.Color(hex).convertSRGBToLinear(); return new THREE.Vector3(c.r, c.g, c.b); };
  const warmed = (c) => { const w = P.light.warm; c.r *= 1 + 0.25 * w; c.g *= 1 + 0.03 * w; c.b *= 1 - 0.25 * w; return new THREE.Vector3(c.r, c.g, c.b); };

  // plain path (Lighting FX off: no post stack, no depth texture): the particles, depth-tested against the screen
  function renderPlain() {
    lastRenderT = performance.now();
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    updateDrawables(null, sz.x, sz.y);
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(fxScene, camera); renderer.autoClear = ac;
  }

  function apply() {
    Q = QUALITY[P.quality.level] || QUALITY.medium;
    resizeFx();
    for (const p of puffs) p.sys.softFarFade = Math.max(0.05, P.smoke.soft);
    structT = -1e9; // re-measure (the quality may change the grid)
  }

  // ---------------------------------------------------------------- test + automation hooks
  function readField(name) {
    const r = { density: den?.read, heavy: den?.read, velocity: vel?.read, pool: pool?.read, light: lightLo }[name]; if (!r) return null;
    const buf = new Uint16Array(r.width * r.height * 4); renderer.readRenderTargetPixels(r, 0, 0, r.width, r.height, buf);
    const out = new Float32Array(buf.length); for (let i = 0; i < buf.length; i++) out[i] = THREE.DataUtils.fromHalfFloat(buf[i]);
    return { w: r.width, h: r.height, data: out };
  }
  const cellOf = (x, z, w = dom.gw, h = dom.gd) => [Math.floor((x - dom.x0) / dom.W * w), Math.floor((z - dom.z0) / dom.D * h)];

  return {
    get params() { return P; },
    set(p) { P = p; apply(); },
    apply, frame, pass, renderPlain, softBatch, fxScene,
    shed(n) { shedEvery = Math.max(1, n | 0); }, get shedEvery() { return shedEvery; }, // (the host is short of time: step the simulation every n-th frame)
    // the main view draws the fog through the pass: its sheets (for views with no post stack) stay out of that render
    mainView(on) { inMain = !!on; if (on) for (const m of sheets) m.visible = false; else updateSheets(); },
    bind({ fire: f, lighting: l }) { fire = f; lighting = l; },
    splat, puff,
    // WHERE the fog is: rooms (their type's default fog, or their own height) and regions over them (room / building
    // menus, Area settings, fog of war). height: ft, 0 = no fog there, null = the default for that place
    setLevel, level: () => ({ ...level }),
    setOff(on) { on = !!on; if (on === off) return; off = on; updateSheets(); }, isOff: () => off,
    setViewEvery(n) { viewEvery = Math.max(1, n | 0); }, get viewEvery() { return viewEvery; }, // (the fluid takes one longer step every n-th frame: the game's Graphics > Soft effects at half resolution)
    setViewScale(k) { k = Math.max(0.25, Math.min(1, +k || 1)); if (k === viewScale) return; viewScale = k; if (size.x > 1) resizeFx(); }, get viewScale() { return viewScale; }, fxSize: () => [fxRT.width, fxRT.height],
    setRooms, rooms: () => rooms.map(r => ({ ...r, resolved: heightOf(r) })), setRegions, regions: () => regions.map(r => ({ ...r, resolved: heightOf(r) })),
    setTypeDefaults(map) { typeFog = { ...FOG_BY_TYPE, ...(map || {}) }; structT = -1e9; },
    typeDefault, heightOf: (r) => heightOf(norm(r)),
    domain: () => ({ ...dom }), world: () => ({ ...world }),
    // (tests) where a world point lands on the canvas: 0..1 across and down, and whether it is behind the camera
    screenOf(x, y, z) { const v = new THREE.Vector3(x, y, z), c = v.clone().applyMatrix4(camera.matrixWorldInverse); v.project(camera); return { u: (v.x + 1) / 2, v: (1 - v.y) / 2, behind: c.z > -camera.near }; },
    place: (which = 'window') => { const c = which === 'world' ? worldCanvas : placeCanvas, o = which === 'world' ? world : dom; return { w: o.gw, h: o.gd, x0: o.x0, z0: o.z0, cell: o.cell, data: c.getContext('2d').getImageData(0, 0, o.gw, o.gd).data }; },
    mask: () => { const d = maskCanvas.getContext('2d').getImageData(0, 0, dom.gw, dom.gd).data; return { w: dom.gw, h: dom.gd, data: d }; },
    readField, cellOf, _debug: () => ({ fxRT, lowZ, volMat, compMat, litSeen: litSeen.size, pendingPuffs: pendingPuffs.length, flames: flames.length }),
    // sample a field at world points: [[x, z], ...] -> values (density: x; velocity: |v|; pool: x)
    probe(name, pts) { const f = readField(name); if (!f) return null; return pts.map(([x, z]) => { const [i, j] = cellOf(x, z, f.w, f.h); if (i < 0 || j < 0 || i >= f.w || j >= f.h) return null; const o = (j * f.w + i) * 4; return name === 'velocity' ? Math.hypot(f.data[o], f.data[o + 1]) : name === 'heavy' ? f.data[o + 1] : f.data[o]; }); },
    warm(n = 120) { if (!simOn()) return false; ensureDomain(); flameT = -1e9; readFlames(performance.now()); const rt = renderer.getRenderTarget(), ac = renderer.autoClear; renderer.autoClear = false; for (let i = 0; i < n; i++) step(1 / 30); renderer.setRenderTarget(rt); renderer.autoClear = ac; return true; },
    stats: () => ({ atmos_sim_calls: simOn() ? stats.sim_calls : 0, atmos_draw_calls: stats.draw_calls, atmos_cpu_ms: stats.cpu_ms, atmos_sim_cpu_ms: simOn() ? stats.sim_cpu_ms : 0,
      atmos_gpu_sim_ms: gpu.sim == null ? null : +gpu.sim.toFixed(3), atmos_gpu_draw_ms: gpu.draw == null ? null : +gpu.draw.toFixed(3),
      atmos_grid: vel ? `${dom.gw}x${dom.gd}@${dom.cell.toFixed(2)}ft` : '', atmos_window_ft: vel ? Math.round(dom.W) : 0, atmos_cell_ft: +dom.cell.toFixed(3), atmos_zoom_step: dom.k, atmos_zooms: stats.zooms, atmos_splat_cells: +(stirRad() / dom.cell).toFixed(2), atmos_stir_ft: +(ptr.last ? stirRadAt(ptr.last) : stirRad()).toFixed(3), atmos_cursor_stirs: stats.cursors, atmos_xfade: +xfade.toFixed(2), atmos_sheets: sheets.filter(m => m.visible).length, atmos_world: `${world.gw}x${world.gd}@${world.cell.toFixed(1)}ft`, atmos_shifts: stats.shifts, atmos_far: farOn(), atmos_fx_res: `${fxRT.width}x${fxRT.height}`, atmos_lights: stats.lights, atmos_movers: stats.movers, atmos_arrivals: stats.arrivals, atmos_regions: regions.length, atmos_rooms: rooms.length, atmos_fog_max_ft: +fogMax().toFixed(2), atmos_puffs: stats.puffs,
      atmos_wisps: stats.wisps, atmos_motes: stats.motes, atmos_pool_sources: stats.sources, atmos_volume: !!stats.volume, atmos_off: off }),
    dispose() { window.removeEventListener('pointermove', onMove); emitRoot.removeFromParent(); },
  };
}
