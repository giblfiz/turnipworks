// FIRE: flames, embers, smoke and the light they throw, for every fire source among the placed items.
// Big fires (hearths, ovens, braziers, torches) get a raymarched volumetric flame (@wolffo/three-fire 1.4.0, MIT,
// vendored), a dedicated flickering point light, and three.quarks 0.16 (MIT) embers + smoke. Small fires (candles,
// candelabra, chandeliers, lanterns) are ONE instanced billboard draw call and share a small pool of clustered lights.
// Flicker is one signal per fire that drives flame height, light intensity, light colour and (via lighting.js) shadows.
// Flames sit on per-sku ANCHORS (data/fire_anchors.json, derived from the meshes by prep/fire_anchors.py; Harry's
// overrides from the edit-flames tool win), stored normalised to the mesh's own bounds and mapped through the mesh
// root's CURRENT world matrix every frame: catalog scale, orient yaw, faces-ladder swaps and settling all follow.
// Lanterns get their own lights (inside the body: around / hooded-down / forward), a glow on the body, optional
// shadows (with a pierced-pane cookie from the texture). Fires light only once their item has landed.
// Anchor records (2026-10-04, Alignment Bench): an anchor may carry a 4th number, a per-flame SIZE multiplier
// ([u, v, w, size]); a lantern record may carry `light: [u, v, w]`, where its own light hangs (default: at the flame).
import * as THREE from 'three';
import { FireMesh } from 'three-fire';
import { BatchedRenderer, ParticleSystem, RenderMode } from 'three.quarks';
import { ConstantValue, IntervalValue, ConeEmitter, ColorOverLife, SizeOverLife, Gradient, PiecewiseBezier, Bezier, ApplyForce, TurbulenceField, RotationOverLife, ConstantColor, Vector3 as QV3, Vector4 as QV4 } from 'quarks.core';
import { kelvin, flicker } from './util.js';

export const FIRE_DEFAULTS = {
  fx: 'fire', name: 'tavern-fire',
  flame: { size: 1, intensity: 0.55, temperature: 1850, flicker: 0.6, flickerSpeed: 1 },
  particles: { embers: 0.5, smoke: 0.65, smokeDark: 0.45 },
  draft: { direction: 90, strength: 0.15 },
  light: { strength: 1, reach: 1, candleLights: 4 },
  types: { hearth: 1, oven: 1, brazier: 1, torch: 1, lantern: 1, candle: 1 },
  lantern: { intensity: 1, range: 12, falloff: 1.4, warmth: 1900, glow: 0.8, beam: 'around', angle: 110, lights: 4, shadows: false, pattern: false },
  advanced: { emberLife: 1.6, emberSize: 1, smokeLife: 3.5, smokeGrow: 2.5, steps: 20 },
};
const T = (k, label, min, max, step, unit) => ({ k, label, type: 'range', min, max, step, unit });
export const FIRE_SCHEMA = [
  ['Flame', 'flame', [
    T('size', 'Size', 0.25, 3, 0.05, '×'),
    T('intensity', 'Intensity (candle ↔ roaring)', 0, 1, 0.01),
    T('temperature', 'Colour temperature', 1000, 3200, 25, 'K'),
    T('flicker', 'Flicker (drives light + colour)', 0, 1, 0.01),
    T('flickerSpeed', 'Flicker speed', 0.2, 3, 0.05, '×'),
  ]],
  ['Embers & smoke', 'particles', [
    T('embers', 'Embers / sparks', 0, 1, 0.01),
    T('smoke', 'Smoke amount', 0, 1, 0.01),
    T('smokeDark', 'Smoke darkness', 0, 1, 0.05),
  ]],
  ['Draft', 'draft', [
    T('direction', 'Wind from (0 = north)', 0, 360, 5, '°'),
    T('strength', 'Wind strength', 0, 1, 0.01),
  ]],
  ['Light from fire', 'light', [
    T('strength', 'Light strength', 0, 3, 0.05, '×'),
    T('reach', 'Light reach', 0.4, 2.5, 0.05, '×'),
    T('candleLights', 'Shared lights for all small flames', 0, 12, 1),
  ]],
  ['Lanterns', 'lantern', [
    T('intensity', 'Light intensity', 0, 4, 0.05, '×'),
    T('range', 'Range', 3, 40, 0.5, 'ft'),
    T('falloff', 'Falloff (1 soft … 2 physical)', 0.5, 2.5, 0.05),
    T('warmth', 'Warmth', 1200, 3500, 25, 'K'),
    T('glow', 'Glow on panes / body', 0, 4, 0.05),
    { k: 'beam', label: 'Light comes out', type: 'select', options: [['around', 'all around (open panes)'], ['down', 'downward (hooded)'], ['forward', 'forward (shuttered)']] },
    T('angle', 'Beam width (hooded / forward)', 20, 170, 5, '°'),
    T('lights', 'Lanterns with their own light', 0, 12, 1),
    { k: 'shadows', label: 'Lantern lights cast shadows', type: 'check' },
    { k: 'pattern', label: 'Pierced-tin / pane pattern in the shadow', type: 'check' },
  ]],
  ['Per fire type (scale)', 'types', [
    T('hearth', 'Hearths & fireplaces', 0, 2, 0.05, '×'),
    T('oven', 'Ovens', 0, 2, 0.05, '×'),
    T('brazier', 'Braziers', 0, 2, 0.05, '×'),
    T('torch', 'Torches', 0, 2, 0.05, '×'),
    T('lantern', 'Lanterns', 0, 2, 0.05, '×'),
    T('candle', 'Candles, candelabra, chandeliers', 0, 2, 0.05, '×'),
  ]],
  ['Advanced: lifetimes', 'advanced', [
    T('emberLife', 'Ember lifetime', 0.3, 4, 0.1, 's'),
    T('emberSize', 'Ember size', 0.3, 3, 0.05, '×'),
    T('smokeLife', 'Smoke lifetime', 1, 8, 0.1, 's'),
    T('smokeGrow', 'Smoke grows to', 1, 5, 0.1, '×'),
    T('steps', 'Flame raymarch steps (quality)', 8, 40, 1),
  ]],
];
export const FIRE_BUILTINS = {
  'tavern-fire': () => JSON.parse(JSON.stringify(FIRE_DEFAULTS)),
  'banked-embers': () => ({ ...JSON.parse(JSON.stringify(FIRE_DEFAULTS)), name: 'banked-embers', flame: { size: 0.8, intensity: 0.15, temperature: 1350, flicker: 0.35, flickerSpeed: 0.6 }, particles: { embers: 0.15, smoke: 0.5, smokeDark: 0.3 } }),
  'roaring': () => ({ ...JSON.parse(JSON.stringify(FIRE_DEFAULTS)), name: 'roaring', flame: { size: 1.3, intensity: 1, temperature: 2100, flicker: 0.8, flickerSpeed: 1.4 }, particles: { embers: 1, smoke: 0.5, smokeDark: 0.6 }, light: { strength: 1.4, reach: 1.2, candleLights: 4 } }),
};

// ---- which placed objects are fires, and where on the object the flame sits (fractions of the item's dims)
// kind: volume = raymarched flame + own light + particles; small = instanced billboard + shared light
const TYPES = {
  hearth:  { kind: 'volume', w: 0.4, h: 0.5, y: 0.09, front: -0.08, lightFront: 1.6, light: 3, reach: 30, embers: 45, smoke: 1, pri: 3 },
  oven:    { kind: 'volume', w: 0.34, h: 0.22, y: 0.3, front: 0.32, light: 4.5, reach: 14, embers: 3, smoke: 0.6, pri: 2 },
  brazier: { kind: 'volume', w: 0.75, h: 0.9, y: 1.0, front: 0, light: 9, reach: 22, embers: 10, smoke: 0.8, pri: 2.5 },
  torch:   { kind: 'volume', abs: [0.55, 1.0], y: 0.82, front: 0.3, light: 4, reach: 18, embers: 2, smoke: 0.3, pri: 1.5 },
  lantern: { kind: 'small', flames: 'one', fy: 0.42, size: 0.32, light: 4, reach: 11 },
  candle:  { kind: 'small', flames: 'one', fy: 1.0, size: 0.24, light: 3, reach: 9 },
  candelabra: { kind: 'small', flames: 'row3', fy: 1.0, size: 0.24, light: 5, reach: 10, scaleKey: 'candle' },
  stubs:   { kind: 'small', flames: 'cluster4', fy: 1.0, size: 0.16, light: 2.5, reach: 8, scaleKey: 'candle' },
  chandelier: { kind: 'small', flames: 'ring8', fy: 1.0, size: 0.24, light: 34, reach: 22, scaleKey: 'candle' },
};
export function fireType(id = '') {
  if (/^(fireplace|cook-hearth|hearth)/.test(id) || /-hearth$|^hearth-/.test(id)) return 'hearth';
  if (/rug|rake|mat\b/.test(id)) return null; // hearth rugs, oven rakes: named after fire, not on fire
  if (/oven/.test(id)) return 'oven';
  if (/brazier|fire-pit|firepit/.test(id)) return 'brazier';
  if (/torch/.test(id)) return 'torch';
  if (/chandelier/.test(id)) return 'chandelier';
  if (/candelabra/.test(id)) return 'candelabra';
  if (/candle-stubs/.test(id)) return 'stubs';
  if (/candle/.test(id)) return 'candle';
  if (/lantern|lamp/.test(id)) return 'lantern';
  if (/athanor/.test(id)) return 'oven';         // wizard's tower: alch-athanor (the alchemist's brick furnace: a fire behind a stoke hole)
  if (/cresset/.test(id)) return 'torch';        // castle: cresset-wall
  if (/signal-beacon|boiling-oil|fire-basket|cauldron-crane|pig-on-spit/.test(id)) return 'brazier'; // castle: open fires that are not in a hearth
  if (/flame-bowl/.test(id)) return 'brazier';   // crypt: rite-sacred-flame-bowl
  if (/sand-tray/.test(id)) return 'stubs';      // crypt: rite-memorial-sand-tray (a tray of thin candles)
  if (/^flavor-censer/.test(id)) return 'candle'; // flavor slots: the standing candle-holder of a sanctum or temple (types:flavor)
  if (/^shrine-wayside/.test(id)) return 'stubs'; // dungeon: the wayside shrine's two candle stubs on its offering shelf (type:dun)
  if (/^smelter/.test(id)) return 'oven';         // mine: the smelting furnace (a fire behind its tap hole, low in the front) (type:min)
  if (/^forge$/.test(id)) return 'brazier';      // smithy: the forge's coal bed, an open fire on a waist-high hearth (type:smi)
  if (/^kiln-/.test(id)) return 'oven';           // smithy: the potter's kiln, a fire behind its stoke hole (type:smi)
  return null;
}
// small-flame offsets in item-local feet, from the item's footprint
function smallOffsets(kind, w, d) {
  if (kind === 'row3') return [-0.33, 0, 0.33].map(f => [f * w, 0, 0]);
  if (kind === 'cluster4') return [[-0.18, 0, -0.12], [0.15, 0, -0.15], [-0.1, 0, 0.16], [0.17, 0, 0.12]].map(([a, b, c]) => [a * w, b, c * d]);
  if (kind === 'ring8') return Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * 0.42 * w, 0, Math.sin(i * Math.PI / 4) * 0.42 * d]);
  return [[0, 0, 0]];
}

// ---- textures, generated (no third-party art)
function flameTexture(tempK) { // x = radius from the axis, y = height; the raymarcher samples this
  const W = 64, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), col = new THREE.Color();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const r = i / (W - 1), h = 1 - j / (H - 1); // canvas row 0 = top; texture v = 1 at top with flipY
    // the shader's turbulence lifts every lookup upward (st.y += sqrt(st.y) * magnitude * noise), so the tongues come
    // from the noise; the texture must stay bright and wide over most of its height and fade to zero only at the very top
    const width = 0.92 - 0.55 * h;
    const body = Math.max(0, Math.min(1, (width - r) / (width * 0.85)));
    const heat = Math.pow(body, 1.1) * Math.pow(1 - h, 0.45) * Math.min(1, h * 14 + 0.3);
    kelvin(850 + heat * (tempK - 850 + 350), col).convertSRGBToLinear();
    const v = Math.pow(heat, 1.3) * 255, white = Math.max(0, heat - 0.9) * 3;
    const k = (i + j * W) * 4;
    img.data[k] = Math.min(255, v * (col.r + white)); img.data[k + 1] = Math.min(255, v * (col.g + white * 0.9)); img.data[k + 2] = Math.min(255, v * (col.b + white * 0.6)); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
function dotTexture(soft) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) { // smoke puff: soft, slightly lumpy
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) { const x = 10 + Math.random() * 44, y = 10 + Math.random() * 44, r = 4 + Math.random() * 9; const h = g.createRadialGradient(x, y, 0, x, y, r); h.addColorStop(0, 'rgba(0,0,0,0.35)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, 64, 64); }
  } else {
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- the candle billboard: one InstancedMesh-like draw for every small flame in the scene
const SMALL_MAX = 512;
// HALO (2026-10-12): a small flame that is NOT a real light (the viewer's pool of real lights, setCap) would be a bright
// dot on an unlit holder. Its own billboard grows a wider, soft halo instead (reach: times the flame's quad; bright: at
// the middle), so the candle and the top of its holder read as lit. Same draw call, no light, nothing compiled.
export const HALO = { reach: 2.6, bright: 0.2 };
function makeSmallFlames() {
  const geo = new THREE.InstancedBufferGeometry();
  const q = new THREE.PlaneGeometry(1, 1); q.translate(0, 0.5, 0);
  geo.index = q.index; geo.setAttribute('position', q.getAttribute('position')); geo.setAttribute('uv', q.getAttribute('uv'));
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(SMALL_MAX * 3), 3); iPos.setUsage(THREE.DynamicDrawUsage);
  const iData = new THREE.InstancedBufferAttribute(new Float32Array(SMALL_MAX * 4), 4); iData.setUsage(THREE.DynamicDrawUsage); // size, phase, alive, unlit (1 = this flame is not a real light: a wider halo, see HALO)
  geo.setAttribute('iPos', iPos); geo.setAttribute('iData', iData);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { haloK: { value: HALO.bright }, haloR: { value: HALO.reach }, time: { value: 0 }, wind: { value: new THREE.Vector3() }, core: { value: new THREE.Color() }, body: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, bright: { value: 1 }, flick: { value: 0.6 } },
    vertexShader: /* glsl */`
      attribute vec3 iPos; attribute vec4 iData; uniform float time; uniform vec3 wind; uniform float flick; uniform float haloR;
      varying vec2 vP; varying float vPhase; varying float vAlive; varying float vUnlit;
      void main() {
        vPhase = iData.y; vAlive = iData.z; vUnlit = iData.w;
        vec2 l0 = vec2((uv.x - 0.5) * 1.9, uv.y * 2.4 - 0.55);      // flame-local units: base of the flame at y ~ 0
        vP = vec2(0.0, 0.25) + (l0 - vec2(0.0, 0.25)) * (1.0 + (haloR - 1.0) * iData.w); // (unlit: the quad grows about the flame's middle to hold the wider halo; the flame keeps its size)
        float size = iData.x * vAlive;
        // cylindrical billboard: face the camera around the world up axis
        vec3 toCam = normalize(vec3(cameraPosition.x - iPos.x, 0.0, cameraPosition.z - iPos.z) + 1e-5);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
        float sway = sin(time * 3.1 + iData.y) * 0.06 + sin(time * 7.7 + iData.y * 2.3) * 0.04;
        float stretch = 1.0 + flick * 0.18 * sin(time * 9.0 + iData.y * 5.0);
        vec3 p = iPos + right * (position.x * size * 1.9) + vec3(0.0, 1.0, 0.0) * ((position.y * stretch * 2.4 - 0.62) * size);
        p += (wind + right * sway * flick) * pow(max(position.y, 0.0), 2.0) * size * 2.0;
        p += (right * (vP.x - l0.x) + vec3(0.0, 1.0, 0.0) * (vP.y - l0.y)) * size;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 core; uniform vec3 body; uniform vec3 glow; uniform float bright; uniform float time; uniform float flick; uniform float haloK; uniform float haloR;
      varying vec2 vP; varying float vPhase; varying float vAlive; varying float vUnlit;
      void main() {
        vec2 p = vP;
        // teardrop: a circle at the base that narrows to a tip
        float y = clamp(p.y, -0.3, 1.2);
        float w = 0.16 * sqrt(max(0.0, 1.0 - pow(max(y, 0.0) / 1.05, 1.6))) * (y < 0.0 ? sqrt(max(0.0, 1.0 - pow(y / 0.25, 2.0))) / 1.0 : 1.0);
        float d = abs(p.x) / max(w, 1e-3);
        float flame = smoothstep(1.0, 0.55, d) * step(-0.25, p.y) * step(p.y, 1.05);
        float inner = smoothstep(0.7, 0.0, d) * smoothstep(0.85, 0.05, p.y);
        float blue = smoothstep(0.12, -0.08, p.y) * smoothstep(1.0, 0.3, d) * 0.6;
        float halo = exp(-6.0 * length(vec2(p.x * 1.2, (p.y - 0.25) * 0.8))) * 0.55;
        float hr = length(vec2(p.x, p.y - 0.25)) / (1.2 * haloR);   // HALO: 1 at the grown quad's nearest edge
        halo += vUnlit * haloK * exp(-4.5 * hr) * max(0.0, 1.0 - hr);
        float f = 1.0 + flick * 0.15 * sin(time * 13.0 + vPhase * 7.0);
        vec3 c = body * flame + core * inner * 1.6 + vec3(0.25, 0.35, 1.0) * blue + glow * halo;
        float a = max(max(flame, inner), halo);
        if (a < 0.01 || vAlive < 0.5) discard;
        gl_FragColor = vec4(c * bright * f, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.userData.fx = true; mesh.renderOrder = 5;
  return { mesh, iPos, iData, geo, mat };
}

// ---- THE FLOOR GLOW: a fire with no real light (the viewer's "Light from fires" switch, 2026-10-11). One instanced flat
// disc per flame, laid on the floor under it, soft-edged, additive, in the flame's colour. It lights nothing: it is a
// picture of light. One draw call for every fire on the map, an unlit program that no light count can change.
function makeGlows(cap = 256) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), 3));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), iData = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  iPos.setUsage(THREE.DynamicDrawUsage); iData.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos); geo.setAttribute('iData', iData); geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(1, 0.6, 0.25) } },
    vertexShader: /* glsl */`attribute vec3 iPos; attribute vec2 iData; varying vec2 vP; varying float vA;
      void main() { vP = position.xz; vA = iData.y; gl_Position = projectionMatrix * viewMatrix * vec4(iPos + position * iData.x, 1.0); }`,
    fragmentShader: /* glsl */`uniform vec3 tint; varying vec2 vP; varying float vA;
      void main() { float r = length(vP); if (r >= 1.0) discard; float k = 1.0 - r; float g = exp(-4.0 * r * r) * k * k; gl_FragColor = vec4(tint * vA * g, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.userData.fx = true; mesh.renderOrder = 4; mesh.visible = false;
  return { mesh, iPos, iData, geo, mat, cap };
}
const STOREY = 10, GLOW_DROP = 4; // a flame more than GLOW_DROP ft above its storey's floor (a sconce, a chandelier) glows on that floor, wider and fainter

// ---- anchors: normalised (0..1) positions in the mesh's own bounding box
const relBoxCache = new WeakMap();
function meshRootOf(it) { const v = it.visual || it.group; let r = null; v?.traverse(o => { if (!r && o.userData.meshRoot) r = o; }); return r; }
function rootOf(it) { if (it._fxVis !== (it.visual || it.group) || !it._fxRootOk) { it._fxVis = it.visual || it.group; it._fxRoot = meshRootOf(it); it._fxRootOk = true; } return it._fxRoot; }
function relBox(root) { // the geometry's bounds in the mesh root's own frame (cached per root: a LOD swap makes a new root)
  let b = relBoxCache.get(root); if (b) return b;
  b = new THREE.Box3(); const m = new THREE.Matrix4(), bb = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.identity(); for (let p = o; p && p !== root; p = p.parent) { p.updateMatrix(); m.premultiply(p.matrix); }
    b.union(bb.copy(o.geometry.boundingBox).applyMatrix4(m));
  });
  if (!b.isEmpty()) relBoxCache.set(root, b);
  return b;
}
// has this item landed (spawn animation over)? hysteresis: lights come on once settled, go off only on a big move
function landed(it, wasLit) {
  const g = it.group, r = it.rest; if (!g || !r) return true;
  const ds = Math.abs(g.scale.y - 1), dp = Math.hypot(g.position.x - r.x, g.position.y - r.y, g.position.z - r.z), dr = Math.abs(g.rotation.x) + Math.abs(g.rotation.z);
  return wasLit ? !(ds > 0.3 || dp > 0.6 || dr > 0.35) : (ds < 0.08 && dp < 0.1 && dr < 0.06);
}
const cookieCache = new Map();
function cookieFor(map) { // pierced tin / panes: bright texels let the light through, dark metal blocks it
  if (!map?.image) return null;
  if (cookieCache.has(map.uuid)) return cookieCache.get(map.uuid);
  let out = null;
  try {
    const im = map.image, W = Math.min(256, im.width || 256), H = Math.min(256, im.height || 256);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H);
    for (let i = 0; i < d.data.length; i += 4) { const l = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2]; const a = l > 150 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = a; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.flipY = map.flipY; tex.colorSpace = THREE.NoColorSpace;
    out = { dist: new THREE.MeshDistanceMaterial({ alphaMap: tex, alphaTest: 0.5 }), depth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: tex, alphaTest: 0.5 }) };
  } catch { out = null; }
  cookieCache.set(map.uuid, out); return out;
}

// smokeBatch (2026-10-04, atmos.js): a BatchedRenderer the Atmosphere pass draws with the scene depth, so hearth smoke is
// SOFT (fades where it meets the mantel, walls, floor: no hard intersection lines). Its smoke dials (amount, rise, spread,
// darkness, softness) multiply the ones here: setSmokeLook().
export function createFire({ scene, camera, onLights = () => {}, meshOf = () => null, smokeBatch = null, focus = () => null }) {
  let P = JSON.parse(JSON.stringify(FIRE_DEFAULTS));
  let look = { amount: 1, rise: 1, spread: 1, dark: 1, soft: 1.5 };
  const root = new THREE.Group(); root.name = 'fx-fire'; scene.add(root);
  const batch = new BatchedRenderer(); batch.userData.fx = true; root.add(batch);
  const small = makeSmallFlames(); root.add(small.mesh);
  const glows = makeGlows(); root.add(glows.mesh); let glowN = 0;
  const emberTex = dotTexture(false), smokeTex = dotTexture(true);
  const emberMat = new THREE.MeshBasicMaterial({ map: emberTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const smokeMat = new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthWrite: false, blending: THREE.NormalBlending });
  let flameTex = flameTexture(P.flame.temperature), texTemp = P.flame.temperature;
  const fires = new Map();   // key -> volume fire record
  let smalls = [];           // small flame records {item, off, size, type}
  let pool = [];             // shared small-flame lights
  let lights = [];
  let lanterns = [];         // dedicated lantern lights {light, s}
  let autoA = {}, overA = {}, lastItems = [];
  // anchors belong to a MESH, not a sku name: a regenerated mesh keeps its sku but must not inherit flames placed on the
  // old one. Key = sku.mesh ("<src>/<sku>@<sha1-8>"), falling back to the sku when no mesh key is known.
  const keyOf = (spec) => (spec && (meshOf(spec) || spec.sku)) || null;
  const anchorRec = (spec) => {
    const k = keyOf(spec); if (!k) return null;
    if (overA[k]?.anchors) return overA[k];
    const a = autoA[spec.sku];
    return a && (!a.mesh || a.mesh === k || k === spec.sku) ? a : null;
  };
  const litNow = new Map();  // item -> landed this frame
  const _w = new THREE.Vector3(), _ws = new THREE.Vector3();
  // world position of anchor u on item it (falls back to an offset in the item group's frame: cube mode, no anchor)
  function anchorWorld(it, u, off, out) {
    const root = u && rootOf(it);
    if (root) { const b = relBox(root); if (!b.isEmpty()) { out.set(b.min.x + u[0] * (b.max.x - b.min.x), b.min.y + u[1] * (b.max.y - b.min.y), b.min.z + u[2] * (b.max.z - b.min.z)); root.updateWorldMatrix(true, false); return out.applyMatrix4(root.matrixWorld); } }
    it.group.updateWorldMatrix(true, false); return out.copy(off).applyMatrix4(it.group.matrixWorld);
  }
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
  const windDir = new THREE.Vector3();

  const typeScale = (type) => P.types[TYPES[type].scaleKey || type] ?? 1;
  const intensityK = () => 0.45 + P.flame.intensity * 1.1;

  function makeParticles(rec) {
    const t = TYPES[rec.type];
    const embers = new ParticleSystem({
      duration: 1, looping: true, worldSpace: true, maxParticle: 300,
      startLife: new IntervalValue(P.advanced.emberLife * 0.5, P.advanced.emberLife * 1.2),
      startSpeed: new IntervalValue(2.5, 7), startSize: new IntervalValue(0.1 * P.advanced.emberSize, 0.2 * P.advanced.emberSize),
      startColor: new ConstantColor(new QV4(1, 0.75, 0.35, 1)),
      emissionOverTime: new ConstantValue(0),
      shape: new ConeEmitter({ radius: 0.4, angle: 0.35, thickness: 1 }),
      material: emberMat, renderMode: RenderMode.StretchedBillBoard, speedFactor: 0.05, renderOrder: 6,
    });
    embers.addBehavior(new ColorOverLife(new Gradient([[new QV3(1, 0.9, 0.6), 0], [new QV3(1, 0.5, 0.15), 0.4], [new QV3(0.8, 0.15, 0.03), 1]], [[1, 0], [1, 0.6], [0, 1]])));
    embers.addBehavior(new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.9, 0.6, 0.2), 0]])));
    const eForce = new ApplyForce(new QV3(0, 1, 0), new ConstantValue(1.5)); embers.addBehavior(eForce);
    embers.addBehavior(new TurbulenceField(new QV3(1.5, 1.5, 1.5), 2, new QV3(3, 3, 3), new QV3(0.4, 0.4, 0.4)));
    const smoke = new ParticleSystem({
      duration: 1, looping: true, worldSpace: true, maxParticle: 200,
      startLife: new IntervalValue(P.advanced.smokeLife * 0.7, P.advanced.smokeLife * 1.2),
      startSpeed: new IntervalValue(0.5, 1.2), startSize: new IntervalValue(0.25, 0.5), startRotation: new IntervalValue(0, 6.28),
      startColor: new ConstantColor(new QV4(1, 1, 1, 1)),
      emissionOverTime: new ConstantValue(0),
      shape: new ConeEmitter({ radius: 0.3, angle: 0.2, thickness: 1 }),
      material: smokeMat, renderMode: RenderMode.BillBoard, renderOrder: 4,
      ...(smokeBatch && { softParticles: true, softNearFade: 0, softFarFade: Math.max(0.05, look.soft) }),
    });
    // firelit at the mouth (warm), grey once it has risen
    const sGrad = new ColorOverLife(new Gradient([[new QV3(1, 0.78, 0.55), 0], [new QV3(1, 1, 1), 0.35], [new QV3(1, 1, 1), 1]], [[0, 0], [0.24, 0.15], [0.14, 0.6], [0, 1]]));
    smoke.addBehavior(sGrad);
    const sSize = new SizeOverLife(new PiecewiseBezier([[new Bezier(0.5, 1, 1.6, P.advanced.smokeGrow), 0]])); smoke.addBehavior(sSize);
    smoke.addBehavior(new RotationOverLife(new IntervalValue(-0.4, 0.4)));
    const sForce = new ApplyForce(new QV3(0, 1, 0), new ConstantValue(0.25)); smoke.addBehavior(sForce);
    smoke.addBehavior(new TurbulenceField(new QV3(0.6, 0.6, 0.6), 2, new QV3(0.8, 0.4, 0.8), new QV3(0.2, 0.2, 0.2)));
    for (const s of [embers, smoke]) { s.emitter.rotation.x = -Math.PI / 2; s.emitter.userData.fx = true; root.add(s.emitter); (s === smoke && smokeBatch ? smokeBatch : batch).addSystem(s); }
    rec.embers = embers; rec.smoke = smoke; rec.eForce = eForce; rec.sForce = sForce; rec.sSize = sSize; rec.sGrad = sGrad;
  }
  function dropParticles(rec) {
    for (const s of [rec.embers, rec.smoke]) { if (!s) continue; batch.deleteSystem(s); smokeBatch?.deleteSystem(s); s.emitter.removeFromParent(); s.dispose?.(); }
  }

  function addVolume(item, type) {
    const t = TYPES[type];
    const mesh = new FireMesh({ fireTex: flameTex, color: 0xffffff, iterations: P.advanced.steps, octaves: 3, magnitude: 1.6, noiseScale: [1, 2, 1, 0.3] });
    mesh.material.depthTest = true; Object.assign(mesh.material, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation }); // pure additive: the shader's alpha (= red) would square the brightness away
    mesh.renderOrder = 5;
    mesh.matrixAutoUpdate = false; mesh.userData.fx = true; mesh.castShadow = false; mesh.frustumCulled = false;
    root.add(mesh);
    const light = new THREE.PointLight('#ffa040', 1, 20, 1.4); // softer-than-physical decay: no blown-out hot spot on the logs and firebox stone a foot away
    light.userData.priority = t.pri; light.userData.fx = true; light.userData.ftype = type; root.add(light);
    const ar = anchorRec(item.spec);
    const u0 = ar?.anchors?.[0] || null;
    const rec = { item, type, mesh, light, phase: Math.random() * 100, embers: null, u: u0, k: u0?.[3] > 0 ? u0[3] : 1, mouth: ar?.mouth ?? 1, widthU: ar?.width || 0, lit: false };
    if (t.embers || t.smoke) makeParticles(rec);
    return rec;
  }
  function removeVolume(rec) { rec.mesh.removeFromParent(); rec.mesh.dispose(); rec.light.removeFromParent(); rec.light.dispose(); dropParticles(rec); }

  // where the flame sits: item-local offset (ft) and flame box size (ft), before the size dials
  function volumeFrame(rec) {
    const t = TYPES[rec.type], [w, h, d] = rec.item.spec.dims || [3, 3, 3];
    const fw = t.abs ? t.abs[0] : Math.max(0.4, t.w * w), fh = t.abs ? t.abs[1] : Math.max(0.5, t.h * h);
    return { off: new THREE.Vector3(0, t.y * h, t.front * d), fw, fh };
  }

  let anchorVer = 0;
  function sync(itemList) {
    lastItems = itemList;
    const seen = new Set(); const nextSmalls = [];
    for (const it of itemList) {
      const type = fireType(it.spec?.id); if (!type) continue;
      const key = it.spec.uid || it.spec.key || it.spec.id + it.rest?.x + it.rest?.z;
      if (TYPES[type].kind === 'volume') {
        seen.add(key);
        const ex = fires.get(key);
        if (ex && ex.item === it && ex.ver === anchorVer) continue;
        if (ex) removeVolume(ex);
        const rec = addVolume(it, type); rec.ver = anchorVer; fires.set(key, rec);
      } else {
        const t = TYPES[type], [w, , d] = it.spec.dims || [0.5, 0.5, 0.5];
        const ar = anchorRec(it.spec);
        if (ar?.anchors?.length) for (const u of ar.anchors) nextSmalls.push({ item: it, type, u, off: new THREE.Vector3(0, (it.spec.dims?.[1] || 0.5) * t.fy, 0), size: t.size * (u[3] > 0 ? u[3] : 1), lightU: ar.light || null, phase: Math.random() * 100, world: new THREE.Vector3() });
        else for (const off of smallOffsets(t.flames, w, d)) nextSmalls.push({ item: it, type, u: null, off: new THREE.Vector3(off[0], (it.spec.dims?.[1] || 0.5) * t.fy, off[2]), size: t.size, phase: Math.random() * 100, world: new THREE.Vector3() });
      }
    }
    for (const [k, rec] of fires) if (!seen.has(k)) { removeVolume(rec); fires.delete(k); }
    smalls = nextSmalls.slice(0, SMALL_MAX);
    rebuildLanterns();
    rebuildPool();
    apply();
  }

  let lanternSig = '';
  function rebuildLanterns() { // the first N lanterns get a light of their own, shaped by the beam dial
    for (const L of lanterns) { L.light.removeFromParent(); L.light.dispose(); L.target?.removeFromParent(); }
    lanterns = [];
    const lan = smalls.filter(s => s.type === 'lantern'); smalls.forEach(s => { s.dedicated = false; });
    const n = Math.min(P.lantern.lights, lan.length);
    for (let i = 0; i < n; i++) {
      const spot = P.lantern.beam !== 'around';
      const light = spot ? new THREE.SpotLight('#ffb060', 1, 12, 1, 0.55, 1.4) : new THREE.PointLight('#ffb060', 1, 12, 1.4);
      light.userData.fx = true; light.userData.lantern = true; light.userData.ftype = 'lantern'; root.add(light);
      let target = null; if (spot) { target = new THREE.Object3D(); root.add(target); light.target = target; }
      lan[i].dedicated = true; lanterns.push({ light, target, s: lan[i] });
    }
    lanternSig = `${P.lantern.lights}|${P.lantern.beam}|${lan.length}`;
  }
  function rebuildPool() { // shared lights for small flames: a fixed count, re-clustered on sync
    const shared = smalls.filter(s => !s.dedicated);
    const n = Math.min(P.light.candleLights, shared.length);
    while (pool.length > n) { const l = pool.pop(); l.removeFromParent(); l.dispose(); }
    while (pool.length < n) { const l = new THREE.PointLight('#ffb060', 1, 10, 2); l.userData.priority = 0.5; l.userData.fx = true; l.userData.ftype = 'candle'; l.userData.members = []; root.add(l); pool.push(l); }
    // greedy k-centres over the small flames' rest positions, then assign each flame to its nearest centre
    // cluster in 3-D (height counts double): a chandelier and the table candles under it are different lights
    const pts = shared.map(s => new THREE.Vector3(s.item.rest?.x ?? 0, 2 * ((s.item.rest?.y ?? 0) + (s.item.spec?.dims?.[1] ?? 0)), s.item.rest?.z ?? 0));
    const centres = [];
    if (n > 0) {
      centres.push(pts[0].clone());
      while (centres.length < n) {
        let best = -1, bd = -1;
        pts.forEach((p, i) => { const dd = Math.min(...centres.map(c => c.distanceToSquared(p))); if (dd > bd) { bd = dd; best = i; } });
        centres.push(pts[best].clone());
      }
    }
    pool.forEach(l => { l.userData.members = []; });
    shared.forEach((s, i) => { if (!n) return; let bi = 0, bd = Infinity; centres.forEach((c, j) => { const dd = c.distanceToSquared(pts[i]); if (dd < bd) { bd = dd; bi = j; } }); pool[bi].userData.members.push(s); });
    lights = [...[...fires.values()].map(r => r.light), ...lanterns.map(L => L.light), ...pool];
    onLights(lights);
  }

  function apply() {
    if (Math.abs(texTemp - P.flame.temperature) > 1) { const old = flameTex; flameTex = flameTexture(P.flame.temperature); texTemp = P.flame.temperature; for (const r of fires.values()) r.mesh.material.uniforms.fireTex.value = flameTex; old.dispose(); }
    const steps = String(Math.round(P.advanced.steps));
    for (const r of fires.values()) {
      const m = r.mesh.material; if (m.defines.ITERATIONS !== steps) { m.defines.ITERATIONS = steps; m.needsUpdate = true; }
      if (r.embers) {
        r.embers.startLife = new IntervalValue(P.advanced.emberLife * 0.5, P.advanced.emberLife * 1.2);
        r.embers.startSize = new IntervalValue(0.1 * P.advanced.emberSize, 0.2 * P.advanced.emberSize);
        r.smoke.startLife = new IntervalValue(P.advanced.smokeLife * 0.7, P.advanced.smokeLife * 1.2);
        r.sSize.size = new PiecewiseBezier([[new Bezier(0.5, 1, 1.6, P.advanced.smokeGrow * look.spread), 0]]);
        r.smoke.startSpeed = new IntervalValue(0.5 * look.rise, 1.2 * look.rise);
        if (smokeBatch && Math.abs(r.smoke.softFarFade - Math.max(0.05, look.soft)) > 1e-3) r.smoke.softFarFade = Math.max(0.05, look.soft);
        const g = 1 - Math.min(1, P.particles.smokeDark * look.dark) * 0.85;
        r.smoke.startColor = new ConstantColor(new QV4(g * 1.05, g, g * 0.95, 1));
      }
    }
    const lanCount = smalls.filter(s => s.type === 'lantern').length;
    if (lanternSig !== `${P.lantern.lights}|${P.lantern.beam}|${lanCount}`) { rebuildLanterns(); rebuildPool(); }
    else if (pool.length !== Math.min(P.light.candleLights, smalls.filter(s => !s.dedicated).length)) rebuildPool();
    for (const L of lanterns) { L.light.userData.noShadow = !P.lantern.shadows; L.light.userData.priority = P.lantern.shadows ? 2.6 : 0; }
    onLights(lights);
    const a = THREE.MathUtils.degToRad(P.draft.direction); // wind FROM direction, 0 = north (−z): it blows toward +z
    windDir.set(-Math.sin(a), 0, Math.cos(a));
    small.geo.instanceCount = smalls.length;
  }

  const lightCol = new THREE.Color(), flameCol = new THREE.Color(); let glowTick = 0;
  function frame(dt, now) {
    const t = now / 1000, k = intensityK(), fl = lite ? 0 : P.flame.flicker, sp = P.flame.flickerSpeed; // (lite: a steady flame and a steady light)
    const wind = P.draft.strength;
    litNow.clear(); glowN = 0;
    const isLit = (it) => { if (!litNow.has(it)) { const l = landed(it, !!it._fxLit); it._fxLit = l; litNow.set(it, l); } return litNow.get(it); };
    // ---- volume fires
    for (const r of fires.values()) {
      const T0 = TYPES[r.type], g = r.item.group;
      const sc = P.flame.size * typeScale(r.type) * r.k;
      // (item.asleep: the game has taken a far building out of the scene: its flame and smoke are not drawn. Its
      // LIGHT: with light slots on (below) it goes out, and a dark stand-in keeps the count; without them it stays
      // on, so that the light count, and with it every compiled shader, is the same asleep or awake.)
      const zz = !!r.item.asleep, lit = !!(g && g.visible && sc > 0.01 && (g.parent || zz) && isLit(r.item)) && !(zz && slotsOn), vis = lit && !zz; // fires light once the item has landed
      r.mesh.visible = vis; r.light.userData.lit = lit; r.light.visible = lit;
      if (r.embers) { r.embers.emitter.visible = vis; r.smoke.emitter.visible = vis; }
      if (!vis && r.embers) { r.embers.emissionOverTime.value = 0; r.smoke.emissionOverTime.value = 0; }
      if (!lit) continue;
      g.updateWorldMatrix(true, false);
      let { off, fw, fh } = volumeFrame(r);
      const vroot = r.u && rootOf(r.item);
      if (vroot && r.widthU) { vroot.getWorldScale(_ws); const b = relBox(vroot); fw = Math.max(0.4, r.widthU * (b.max.x - b.min.x) * Math.abs(_ws.x) * 0.72); }
      const f = Math.max(-1, Math.min(1, flicker(t, r.phase, sp) * fl * 1.8)); // one signal per fire, ~[-1, 1]
      const grow = g.scale.y;                                // spawn animation scale (0..1+)
      const H = fh * sc * (0.75 + 0.45 * k) * (1 + 0.12 * f) * grow, W = fw * sc * (0.85 + 0.25 * k) * grow;
      const base = anchorWorld(r.item, r.u, off, _v);
      // flame volume: box centred half a height above the base, sheared downwind with height
      const shear = wind * 0.9;
      _m.set(W, shear * windDir.x * H, 0, base.x,
             0, H, 0, base.y + H / 2,
             0, shear * windDir.z * H, W, base.z,
             0, 0, 0, 1);
      r.mesh.matrix.copy(_m); r.mesh.matrixWorld.copy(_m);
      r.mesh.scale.set(W, H, W);
      const u = r.mesh.material.uniforms;
      u.invModelMatrix.value.copy(_m).invert(); u.scale.value.set(W, H, W);
      u.time.value = t * (0.8 + 0.6 * k) * sp; u.magnitude.value = 0.9 + 0.6 * k; u.noiseScale.value.set(1.2, 2.4, 1.2, 0.35 + 0.35 * k);
      u.color.value.setScalar(0.65 * (20 / P.advanced.steps) * (0.55 + 0.6 * k) * (1 + 0.25 * f)); // ~20 samples accumulate: keep the core near 2 (HDR), edges orange
      // light: intensity and colour follow the flicker; position wobble makes shadows dance (lighting.js budget)
      const L = r.light, dance = lite ? 0 : lighting_dance.value;
      const mouth = () => (vroot ? _s.set(0, 0, r.mouth).transformDirection(vroot.matrixWorld) : _s.set(0, 0, 1).transformDirection(g.matrixWorld));
      mouth().multiplyScalar(T0.lightFront ?? 0); // hang the light at the mouth, not against the firebox stone
      L.position.set(_s.x + base.x + windDir.x * wind * H * 0.3 + dance * 0.12 * flicker(t * 1.7, r.phase + 9, sp), base.y + H * 0.45 + dance * 0.08 * f, _s.z + base.z + windDir.z * wind * H * 0.3 + dance * 0.12 * flicker(t * 1.9, r.phase + 21, sp));
      L.intensity = T0.light * typeScale(r.type) * P.light.strength * (0.4 + 0.9 * k) * (1 + 0.5 * f) * grow;
      { const gk = 1 - (L.userData.k ?? 1); if (gk > 0.02 && vis) glowAt(base.x + _s.x, base.y, base.z + _s.z, T0, sc * grow, f, gk); }
      L.distance = T0.reach * P.light.reach * Math.sqrt(Math.max(0.2, sc));
      L.color.copy(kelvin(P.flame.temperature - 250 + 220 * f + 150 * k, lightCol));
      // particles
      if (r.embers && vis) {
        r.embers.emitter.position.set(base.x, base.y + H * 0.25, base.z);
        mouth(); // out of the firebox mouth, under the mantel
        r.smoke.emitter.position.set(base.x + _s.x * W * 0.45, base.y + H * 0.7, base.z + _s.z * W * 0.45);
        r.embers.emissionOverTime.value = lite ? 0 : T0.embers * P.particles.embers * (0.3 + 1.4 * k) * typeScale(r.type) * (1 + 0.5 * f);
        r.smoke.emissionOverTime.value = lite ? 0 : T0.smoke * P.particles.smoke * 14 * typeScale(r.type) * look.amount;
        r.eForce.direction.set(windDir.x * wind * 2.5, 1, windDir.z * wind * 2.5); r.eForce.magnitudeValue = 2 + 2 * k;
        r.sForce.direction.set(windDir.x * wind * 3, 1, windDir.z * wind * 3); r.sForce.magnitudeValue = 0.35 * look.rise;
        r.embers.emitterShape.radius = W * 0.35; r.smoke.emitterShape.radius = W * 0.3 * Math.sqrt(look.spread);
      }
    }
    // ---- small flames: positions follow their items (spawn animation), one instanced draw
    const cs = typeScale('candle'), ls = P.types.lantern;
    for (let i = 0; i < smalls.length; i++) {
      const s = smalls[i], g = s.item.group;
      const sc = (s.type === 'lantern' ? ls : cs) * P.flame.size;
      const lit = g && g.visible && (g.parent || s.item.asleep) && sc > 0.01 && isLit(s.item) ? 1 : 0, alive = lit && !s.item.asleep ? 1 : 0; // (asleep: lit for the shared lights, not drawn)
      if (lit) anchorWorld(s.item, s.u, s.off, s.world);
      small.iPos.setXYZ(i, s.world.x, s.world.y, s.world.z);
      small.iData.setXYZW(i, s.size * sc * (0.8 + 0.35 * k) * (g?.scale.y ?? 1), s.phase, alive, glowOn ? 0 : s.gk || 0); // (with a stand-in drawn the holder is lit by that: no wider halo)
      s.alive = alive; s.lit = lit;
    }
    small.iPos.needsUpdate = true; small.iData.needsUpdate = true;
    for (const s of smalls) if (s.alive && s.gk > 0.02) glowAt(s.world.x, s.world.y, s.world.z, TYPES[s.type], (s.type === 'lantern' ? ls : cs) * P.flame.size, Math.max(-1, Math.min(1, flicker(t, s.phase, sp) * fl * 1.8)), s.gk);
    glows.geo.instanceCount = glowN; glows.mesh.visible = glowN > 0;
    if (glowN) { glows.iPos.needsUpdate = true; glows.iData.needsUpdate = true; kelvin(P.flame.temperature - 200, glows.mat.uniforms.tint.value); }
    const mu = small.mat.uniforms;
    mu.time.value = t * sp; mu.flick.value = fl; mu.wind.value.copy(windDir).multiplyScalar(wind * 0.8);
    kelvin(P.flame.temperature + 900, mu.core.value); kelvin(P.flame.temperature, mu.body.value); kelvin(P.flame.temperature - 300, mu.glow.value).multiplyScalar(0.6);
    mu.bright.value = 1.4 * (0.6 + 0.6 * k);
    // shared small-flame lights: centroid of live members, intensity = sum (with a soft cap)
    for (const l of pool) {
      const live = l.userData.members.filter(s => s.lit);
      l.userData.lit = live.length > 0; l.visible = l.userData.lit; if (!l.userData.lit) continue;
      _s.set(0, 0, 0); let sum = 0, reach = 0;
      for (const s of live) { _s.add(s.world); const T0 = TYPES[s.type]; sum += T0.light * (s.type === 'lantern' ? ls : cs); reach = Math.max(reach, T0.reach); }
      _s.divideScalar(live.length);
      const f = Math.max(-1, Math.min(1, flicker(t, live[0].phase, sp) * fl * 1.8));
      l.position.set(_s.x, _s.y + 0.35, _s.z);
      l.intensity = Math.min(70, sum * Math.pow(live.length, -0.15)) * P.light.strength * (1 + 0.25 * f);
      l.distance = (reach + Math.sqrt(live.length) * 2) * P.light.reach;
      l.color.copy(kelvin(P.flame.temperature - 150 + 120 * f, lightCol));
    }
    // ---- lanterns: own light inside the body, beam shape, glow on the body, optional (patterned) shadows
    const LP = P.lantern;
    for (const L of lanterns) {
      const s = L.s, l = L.light;
      l.userData.lit = !!s.lit; l.visible = l.userData.lit; if (!l.userData.lit) continue;
      const f = Math.max(-1, Math.min(1, flicker(t, s.phase, sp) * fl * 1.8));
      if (s.lightU) anchorWorld(s.item, s.lightU, s.off, l.position); else l.position.copy(s.world);
      l.intensity = TYPES.lantern.light * LP.intensity * P.light.strength * ls * (1 + 0.3 * f) * (l.isSpotLight ? 2.2 : 1);
      l.distance = LP.range * P.light.reach; l.decay = LP.falloff;
      l.color.copy(kelvin(LP.warmth + 120 * f, lightCol));
      if (L.target) {
        if (LP.beam === 'down') _w.set(0, -1, 0); else { _w.set(0, 0, 1).transformDirection(s.item.group.matrixWorld); _w.y = -0.45; _w.normalize(); }
        L.target.position.copy(s.world).addScaledVector(_w, 3); L.target.updateMatrixWorld();
        l.angle = THREE.MathUtils.degToRad(LP.angle / 2); l.penumbra = 0.55;
      }
    }
    const castMode = LP.shadows ? (LP.pattern ? 'pattern' : 'clear') : 'normal';
    const seenItems = new Set(); glowTick++;
    for (const s of smalls) {
      if (s.type !== 'lantern' || seenItems.has(s.item)) continue; seenItems.add(s.item);
      const rootL = rootOf(s.item); if (!rootL) continue;
      const f = Math.max(-1, Math.min(1, flicker(t, s.phase, sp) * fl * 1.8));
      kelvin(LP.warmth + 200, flameCol);
      rootL.traverse(o => {
        if (!o.isMesh) return;
        for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!mat?.emissive) continue;
          if (!mat.userData.fxGlow) { mat.userData.fxGlow = true; if (mat.map && !mat.emissiveMap) { mat.emissiveMap = mat.map; mat.needsUpdate = true; } }
          // (lanterns of one kind share a material: a lit one in view must not lose its glow to one that is hidden,
          // above the cut or asleep and happens to come later in this loop. The glow is on if ANY of them is alight.)
          if (s.alive) { mat.emissive.copy(flameCol); mat.emissiveIntensity = LP.glow * (1 + 0.25 * f); mat.userData.fxGlowAt = glowTick; }
          else if (mat.userData.fxGlowAt !== glowTick) mat.emissiveIntensity = 0;
        }
        if (o.userData.fxCastMode !== castMode) { // the lantern's own body must not black out its own light
          o.userData.fxCastMode = castMode;
          o.userData.noCast = castMode === 'clear';
          if (castMode === 'clear') o.castShadow = false;
          const ck = castMode === 'pattern' ? cookieFor(o.material?.map) : null;
          o.customDistanceMaterial = ck?.dist; o.customDepthMaterial = ck?.depth;
          if (castMode === 'pattern') o.castShadow = true;
        }
      });
    }
    batch.update(Math.min(0.1, dt / 1000));
    applyCap(now, dt);
    padLights(now);
  }

  // LIGHT SLOTS (big maps, 2026-10-06). three.js compiles its shaders for an exact number of lights: one fire more or
  // less in the scene and every material's program is compiled again, which on a big map is a freeze of seconds; so
  // every fire in the area used to stay lit however far away, and every pixel paid for all of them (208 at 203 rooms,
  // of which a table view can see perhaps 60: half the frame). Now the count is kept on a ladder (4, 8, 16, 24, 32, 48,
  // 64, 96 ...): the fires that shine are on, and dark stand-in lights fill up to the next rung, so fires can come and go
  // (a far building waking or sleeping, a level cut away, a candle put out) without the count moving. It moves only
  // when a rung is outgrown, and comes down a rung only after the need has been well under it for a while.
  const RUNGS = [0, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 2048], DOWN_AFTER = 12000, DOWN_AT = 0.8;
  let slotsOn = false, slots = 0, slotsMin = 0, lowSince = null; const dummies = []; let rungChanges = 0;
  function padLights(now) {
    if (cap !== Infinity || capWant !== Infinity) { slots = 0; return; } // (a fixed pool: applyCap lays the stand-ins out)
    if (!slotsOn) { for (const d of dummies) d.visible = false; slots = 0; return; }
    let on = 0; for (const l of lights) if (l.isPointLight && l.visible) on++;
    const need = Math.max(slotsMin, RUNGS.find(r => r >= on) ?? on);
    if (need > slots) { slots = need; lowSince = null; rungChanges++; }
    else if (need < slots) { const below = RUNGS[RUNGS.indexOf(slots) - 1] ?? 0; if (on <= below * DOWN_AT) { lowSince ??= now; if (now - lowSince > DOWN_AFTER) { slots = below; lowSince = null; rungChanges++; } } else lowSince = null; }
    const pad = Math.max(0, slots - on);
    while (dummies.length < pad) { const d = new THREE.PointLight(0x000000, 0, 1, 2); d.position.set(0, -1e6, 0); d.userData.fx = true; d.userData.dummy = true; d.matrixAutoUpdate = false; d.updateMatrix(); root.add(d); dummies.push(d); } // black, a mile under the floor, reach 1 ft: it adds exactly nothing
    for (let i = 0; i < dummies.length; i++) dummies[i].visible = i < pad;
  }

  // ---- anchors API (edit-flames tool, tests)
  function anchorsOf(it) {
    const type = fireType(it?.spec?.id); if (!type) return null;
    const sku = keyOf(it.spec), ar = anchorRec(it.spec), root = rootOf(it);
    const list = (ar?.anchors || []).map(u => ({ u, world: anchorWorld(it, u, new THREE.Vector3(), new THREE.Vector3()) }));
    return { sku, type, source: overA[sku]?.anchors ? 'override' : ar ? 'auto' : 'none', root, list, light: ar?.light || null };
  }
  function uOfWorld(it, p) {
    const root = rootOf(it); if (!root) return null;
    const b = relBox(root); root.updateWorldMatrix(true, false);
    const l = root.worldToLocal(p.clone());
    return [0, 1, 2].map(i => +((l.getComponent(i) - b.min.getComponent(i)) / Math.max(1e-6, b.max.getComponent(i) - b.min.getComponent(i))).toFixed(4));
  }
  function resync() { anchorVer++; for (const it of lastItems) it._fxRootOk = false; sync(lastItems); }

  const lighting_dance = { value: 0.35 };
  // THE VIEWER'S SWITCH (the game's Settings > Me > Graphics > Fire flicker and sparks, 2026-10-11): lite = every flame
  // still burns and still lights the room, but the light holds steady (no flicker, so its shadow is not redrawn for
  // the dance) and no embers or smoke are emitted. For this viewer only; the look's own dials are not touched.
  let lite = false;
  // THE VIEWER'S OTHER SWITCH: HOW MANY FLAMES ARE REAL LIGHTS (the game's Settings > Me > Graphics > "Real lights from
  // fires", Harry 2026-10-11: lighting "is not actually carrying as much visual weight as we would hope", to be judged
  // by eye; and the measurement of the same day: on a 203-room map every pixel loops over 207 point lights, 88 ms of GPU
  // time a frame against 9.9 with them off). setCap(n):
  //   Infinity  every lit flame is a light, as ever (the count moves with the fires, and with it every program)
  //   N         A FIXED POOL: exactly N point lights are in the scene, always. The N lit flames nearest the view's focus
  //             are the real ones; a flame beyond them lays a soft glow on the floor under it instead (makeGlows); if
  //             fewer than N are lit, black stand-ins fill the pool. Fires come and go, the camera moves, rooms sleep:
  //             the count never moves, so no program is ever compiled for it. A light that leaves the pool fades out
  //             first and the one that takes its place fades in (applyCap), so nothing pops.
  //   0         no flame lights anything: glows only. No light loop in any shader, no shadow map.
  // CHANGING n changes the count, and the count is in every shader, so it is done in two steps: lights that will go are
  // dimmed to nothing AT ONCE (same count, same programs: the picture changes this frame and nothing compiles), and the
  // count itself changes only when the host has built the programs for the new count in the background (compile():
  // three.js compileAsync, the browser's parallel shader compile), so the swap finds every program ready.
  // (Spot lights, a lantern's beam, are their own count: with a pool they are never real.)
  // THE STAND-IN IS OFF UNLESS ASKED FOR (Harry 2026-10-12, on the painted floor glow: "much much worse than nothing at
  // this point"). A flame that is not a real light keeps its flame, embers and smoke and casts no light; setGlow(true)
  // (the game's Settings > Me > Graphics > "Glow under far fires") lays the glow under it, to compare.
  let glowOn = false;
  // HOW the stand-in is drawn (fx/farglow.js, the Far-fire glow panel): 'floor' = the painted disc below (makeGlows), drawn
  // here; 'projected' = farglow.js's light map and picture pass, fed by standins(). fade: seconds a flame takes to swap
  // between real light and stand-in (applyCap).
  let glowLook = { mode: 'floor', radius: 1, intensity: 1, fade: 0.4 };
  let cap = Infinity, capWant = Infinity, capJob = 0, compile = null, rankT = -1e9, real = null, next = null, capSwaps = 0;
  const _fp = new THREE.Vector3();
  let rankPoint = null; // (measurements: choose the pool round this point instead of the view's focus, so the camera can hold still while the pool changes)
  const centre = () => { const f = rankPoint || focus(); return f ? _fp.set(f.x, f.y ?? 0, f.z) : _fp.copy(camera.position); };
  // the lit point lights that are real under a pool of n, nearest the focus first (one already real holds its place a little)
  function rank(n) {
    if (n === Infinity) return null;
    const c = centre(), list = [];
    if (n > 0) for (const l of lights) if (l.userData.lit && l.isPointLight) list.push([l.position.distanceToSquared(c) * (l.userData.real ? 0.7 : 1), l]);
    list.sort((a, b) => a[0] - b[0]);
    const set = new Set(list.slice(0, n).map(x => x[1])); set.cut = list.length > n ? Math.sqrt(list[n][0]) : Infinity;
    return set;
  }
  function layout(n, set) { // the scene as it is under a pool of n: which lights are in it, and how many stand-ins
    let on = 0; for (const l of lights) { l.visible = !!l.userData.lit && (set ? set.has(l) : true); if (l.visible && l.isPointLight) on++; }
    const pad = n === Infinity || n === 0 ? 0 : Math.max(0, n - on);
    while (dummies.length < pad) { const d = new THREE.PointLight(0x000000, 0, 1, 2); d.position.set(0, -1e6, 0); d.userData.fx = true; d.userData.dummy = true; d.matrixAutoUpdate = false; d.updateMatrix(); root.add(d); dummies.push(d); } // black, a mile under the floor, reach 1 ft: it adds exactly nothing
    if (n !== Infinity || !slotsOn) for (let i = 0; i < dummies.length; i++) dummies[i].visible = i < pad;
  }
  // A SWAP IS A CROSS-FADE IN TIME (2026-10-12; it was a fade by distance from the pool's edge, which left the lights near
  // the edge dim in a still picture). The pool is `real`; `want` is who should be in it now. A light that should leave
  // fades to nothing over glowLook.fade seconds and only then gives up its place; the nearest one waiting takes the place
  // dark and fades up. Its stand-in (1 - k: the floor disc here, or farglow.js through standins()) fades the other way,
  // so the room's light never jumps.
  let want = null, snap = false;
  function applyCap(now, dt = 16) { // every frame, after each light's own brightness is worked out
    const pending = capWant !== cap;
    if (cap === Infinity && !pending) { for (const l of lights) { l.userData.real = !!l.userData.lit; l.userData.k = 1; l.userData.ks = 1; l.userData.i0 = l.intensity; } real = null; want = null; tellGlows(); return; }
    if (now - rankT > 150 || (cap !== Infinity && !want)) { rankT = now; want = rank(cap); next = pending ? rank(capWant) : null; }
    if (cap === Infinity) { // (on the way to a pool: the lights that will go are dark at once, the count unchanged)
      layout(cap, null);
      for (const l of lights) { const k = l.visible && !(pending && !(next && next.has(l))) ? 1 : 0; l.userData.real = l.visible; l.userData.i0 = l.intensity; l.intensity *= k; l.userData.k = k; l.userData.ks = k; }
      tellGlows(); return;
    }
    if (!real || snap) { real = new Set(want); for (const l of lights) l.userData.ks = real.has(l) ? 1 : 0; snap = false; }
    for (const l of real) if (!l.userData.lit || (!want.has(l) && (l.userData.ks ?? 1) <= 0.001)) real.delete(l);      // out, or faded out: its place is free
    if (real.size < cap) for (const l of want) { if (real.size >= cap) break; if (!real.has(l)) { real.add(l); l.userData.ks = 0; } } // the nearest one waiting comes in, dark
    layout(cap, real);
    const step = glowLook.fade > 0.01 ? Math.min(1, Math.max(0, dt) / 1000 / glowLook.fade) : 1;
    for (const l of lights) {
      const was = l.userData.real; l.userData.real = l.visible; if (was !== undefined && was !== l.visible && l.userData.lit) capSwaps++;
      let ks = l.userData.ks ?? (l.visible ? 1 : 0); const to = l.visible && want.has(l) ? 1 : 0;
      ks = !l.visible ? 0 : ks < to ? Math.min(to, ks + step) : Math.max(to, ks - step); l.userData.ks = ks;
      let k = ks * ks * (3 - 2 * ks);
      if (k && pending && capWant !== Infinity && !(next && next.has(l))) k = 0;                                            // on its way out: dark at once
      l.userData.i0 = l.intensity; l.intensity *= k; l.userData.k = k;
    }
    tellGlows();
  }
  // each flame's share of painted glow = what its light is NOT giving (read by the flame loops next frame)
  function tellGlows() { for (const l of pool) { const g = 1 - (l.userData.k ?? 1); for (const s of l.userData.members || []) s.gk = g; } for (const L of lanterns) L.s.gk = 1 - (L.light.userData.k ?? 1); }
  function setCap(n) {
    n = n === Infinity || n == null ? Infinity : Math.max(0, n | 0); if (n === capWant) return; capWant = n; const job = ++capJob; rankT = -1e9;
    const done = () => { if (job !== capJob) return; cap = n; rankT = -1e9; real = null; want = null; onLights(lights); };
    if (!compile) return done();
    const all = [...lights, ...dummies], was = all.map(l => l.visible); layout(n, rank(n)); const more = dummies.slice(all.length - lights.length);
    let pr; try { pr = compile(); } catch { pr = null; }
    all.forEach((l, i) => { l.visible = was[i]; }); for (const d of more) d.visible = false;
    Promise.resolve(pr).then(done, done);
  }
  const lightsModeNow = () => capWant !== cap && (capWant !== Infinity && (cap === Infinity || capWant < cap)) ? 'dark' : cap === 0 ? 'off' : cap === Infinity ? 'on' : 'pool';
  function glowAt(x, y, z, T0, size, f, gk = 1) {
    if (!glowOn || glowLook.mode !== 'floor' || glowN >= glows.cap) return;
    const floor = Math.floor((y + 0.5) / STOREY) * STOREY, high = y - floor > GLOW_DROP, reach = (T0.reach || 10) * P.light.reach;
    glows.iPos.setXYZ(glowN, x, (high ? floor : y) + 0.03, z);
    glows.iData.setXY(glowN, Math.max(3, reach * (high ? 0.85 : 0.7) * Math.sqrt(Math.max(0.2, size))) * glowLook.radius, Math.min(0.14, 0.035 + 0.015 * Math.sqrt(T0.light || 3) * P.light.strength) * (high ? 0.7 : 1) * (1 + 0.25 * f) * gk * glowLook.intensity); // (kept under the bloom's threshold: a glow that blooms spills over the furniture standing in it)
    glowN++;
  }
  sync([]);
  return {
    get params() { return P; },
    set(p) { P = p; apply(); },
    apply, sync, frame,
    setDance(v) { lighting_dance.value = v; },
    setLite(on) { lite = !!on; }, isLite: () => lite,
    setGlow(on) { glowOn = !!on; }, get glowOn() { return glowOn; },
    setGlowLook(o) { glowLook = { ...glowLook, ...o }; }, get glowLook() { return { ...glowLook }; },
    // the lights that are NOT being real lights right now, each with the real light's own numbers (fx/farglow.js draws
    // them): weight = how much of it the stand-in owes (1 = all of it, less during a cross-fade)
    standins() {
      const out = []; if (cap === Infinity && capWant === Infinity) return out;
      for (const l of lights) {
        if (!l.userData.lit) continue; const g = 1 - (l.userData.k ?? 1), i0 = l.userData.i0 ?? 0; if (g < 0.01 || !(i0 > 0)) continue;
        out.push({ light: l, x: l.position.x, y: l.position.y, z: l.position.z, color: l.color, intensity: i0 * (l.isSpotLight ? 0.5 : 1), weight: g, distance: l.distance || 20, decay: l.decay ?? 2, type: l.userData.ftype || 'candle' });
      }
      return out;
    },
    // (the tuner's panel, measurements) the pool size at once, with no wait for the programs and no cross-fade
    setRankPoint(p) { rankPoint = p || null; rankT = -1e9; },
    setCapNow(n) { n = n === Infinity || n == null ? Infinity : Math.max(0, n | 0); capJob++; cap = capWant = n; rankT = -1e9; real = null; want = null; snap = true; onLights(lights); },
    setCap, setLights(on) { setCap(on ? Infinity : 0); }, setCompiler(fn) { compile = fn; }, get lightsMode() { return lightsModeNow(); }, get cap() { return cap; }, get capWant() { return capWant; }, glowCount: () => glowN,
    pool: () => ({ cap, want: capWant, real: lights.filter(l => l.visible && l.isPointLight).length, standins: dummies.filter(d => d.visible).length, lit: lights.filter(l => l.userData.lit).length, swaps: capSwaps }),
    setSlots(on, min = 0) { slotsOn = !!on; slotsMin = min; }, // (the game: keep the light count on a ladder, see LIGHT SLOTS; min: never fewer than this many)
    setSmokeLook(o) { look = { ...look, ...o }; apply(); },
    lights: () => lights,
    stats: () => ({ light_slots: slots, lights_shining: lights.filter(l => l.isPointLight && l.visible).length, light_rung_changes: rungChanges, volume_fires: fires.size, small_flames: smalls.length, shared_lights: pool.length, lantern_lights: lanterns.length, particle_systems: fires.size * 2,
      anchored_flames: smalls.filter(s => s.u).length + [...fires.values()].filter(r => r.u).length }),
    setAnchors(auto, over) { if (auto) autoA = auto; if (over) overA = over; resync(); },
    setOverride(sku, anchors, extra = {}) { if (anchors) overA[sku] = { ...(autoA[sku] || {}), ...extra, anchors, src: 'override' }; else delete overA[sku]; resync(); },
    anchorsOf, uOfWorld, resync,
    worldOfU: (it, u) => (rootOf(it) ? anchorWorld(it, u, new THREE.Vector3(), new THREE.Vector3()) : null),
    flames: () => [...[...fires.values()].map(r => ({ item: r.item, world: r.mesh.visible ? anchorWorld(r.item, r.u, volumeFrame(r).off, new THREE.Vector3()) : null, kind: 'volume' })),
      ...smalls.map(s => ({ item: s.item, world: s.alive ? s.world.clone() : null, kind: s.type }))],
    root,
  };
}
