// Banks demo (2026-10-05). Follow-up to the slopes pilot (../../2026-10-05-slopes/viewer), same scaffolding: the game's
// lighting module (lib/lighting.js is a copy of tools/spawn-tuner/js/fx/lighting.js made by deploy.sh), the game's grass
// tile one per 5-ft cell, the 5-ft grid, the 6-ft figure and the round-based pawn stand-ins, the pilot's colour match.
// What is new: the ground is ONE computed mesh (terrain.js: flat terraces in, banks worked out), painted by position.
// URL: ?scene=plateau|hill|cliff|hollow|temple &view=table|lean|low &angle= &soft= &round= &rough= &dress= &earth=
//      &cliffs=scene|none|all &grid=0 &pawns=0 &slopepawn=1 &shadows=1 &night=1 &ui=0 &nofx=1 &flat=1 (plain shading)
//      &yaw= &pitch= &dist= &focus=x,y,z   (camera override, for close shots)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENES, DOMAIN } from './scenes.js?v=__V__';
import { buildField, mulberry32, noise, CLIFF_DEG } from './terrain.js?v=__V__';

const V = '__V__';
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const flag = (k, d) => qs.has(k) ? qs.get(k) !== '0' : d;
const num = (k, d) => qs.has(k) && isFinite(+qs.get(k)) ? +qs.get(k) : d;
const API = qs.get('api') || '/api/tw-ratings';
// The defaults. Each one is a taste decision; README.md says why these.
const DEFAULTS = { angle: 30, soft: 1.2, round: 2.5, rough: 0.6, dress: 0.5, earth: 0.35, cliffs: 'scene' };
const P = { angle: num('angle', DEFAULTS.angle), soft: num('soft', DEFAULTS.soft), round: num('round', DEFAULTS.round), rough: num('rough', DEFAULTS.rough),
  dress: num('dress', DEFAULTS.dress), earth: num('earth', DEFAULTS.earth), cliffs: qs.get('cliffs') || DEFAULTS.cliffs };
const SUN_HIGH_DEFAULT = false;
const state = { scene: SCENES[qs.get('scene')] ? qs.get('scene') : 'plateau', view: qs.get('view') || 'table', grid: flag('grid', true), pawns: flag('pawns', true),
  slopepawn: flag('slopepawn', false), shadows: flag('shadows', false), night: flag('night', false), highsun: qs.has('sun') ? qs.get('sun') === 'high' : SUN_HIGH_DEFAULT };

const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
// capped at 1.5 (?pr=2 for the game's cap): the lighting stack costs per pixel
renderer.setPixelRatio(Math.min(+new URLSearchParams(location.search).get('pr') || 1.5, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d1f1a');
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);   // the tuner's and the game's camera
const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7); // the tuner's light rig (main.js), same numbers
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
sun.position.set(-120, 120, -100); sun.target.position.set(0, 0, 0);
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.08;
Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 10, far: 500 });
scene.add(hemi, sun, sun.target);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI / 2 - 0.05; controls.minDistance = 6; controls.maxDistance = 400;

let lighting = null, LB = null;
if (!qs.has('nofx')) {
  try {
    const m = await import('./lib/lighting.js?v=__V__');
    lighting = m.createLighting({ renderer, scene, camera, hemi, sun });
    LB = m.LIGHT_BUILTINS;
  } catch (e) { console.warn('house lighting not loaded, plain render', e); }
}
function applyLook() {
  if (!lighting) return;
  const p = state.night ? LB.night() : LB.day();   // Harry's two working profiles (tuner Lighting panel)
  p.shadows.casters = 0;                            // no fires here; keeps the module from touching shadow flags
  lighting.set(p);
}
applyLook();

// ---------------------------------------------------------------- textures
const texLoader = new THREE.TextureLoader();
const tex = (url, repeat) => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };
const CELL = 5, GROUND = 800;
const grassMap = tex(`./tex/floor-grass.webp?v=${V}`, true), earthMap = tex(`./tex/ground-earth-bank.webp?v=${V}`, true);
const rockMap = tex(`./tex/ground-rock.webp?v=${V}`, true), rockFaceMap = tex(`./tex/ground-rock-face.webp?v=${V}`, true), pathMap = tex(`./tex/floor-earth-packed.webp?v=${V}`, true);

// ---------------------------------------------------------------- the ground: one mesh, painted by position
// The grass is laid from above, one tile per 5-ft cell, on lawn, terrace and bank alike: the same texel grid runs
// straight across every join, so there is nothing to seam. On steep ground a from-above texture stretches down the
// slope (x1.15 at 30 degrees, x2 at 60), so each texture is also laid from the two sides and the three are mixed by
// which way the ground faces (triplanar). Earth shows through on steep parts; a rock face gets the rock texture.
const U = { uEarth: { value: earthMap }, uRock: { value: rockMap }, uRockFace: { value: rockFaceMap }, uPath: { value: pathMap }, uEarthAmt: { value: P.earth }, uGrid: { value: 1 },
  uRingA: { value: new THREE.Vector4(0, 0, 2.4, 0) }, uRingCol: { value: new THREE.Color('#ffe14a') }, uFlat: { value: qs.has('flat') ? 1 : 0 } };
const groundMat = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.95, metalness: 0 });
groundMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aRock; attribute float aPath; varying vec3 vWP; varying vec3 vWN; varying float vRock; varying float vPath;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = position; vWN = normal; vRock = aRock; vPath = aPath;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2D uEarth, uRock, uRockFace, uPath; uniform float uEarthAmt, uGrid, uFlat; uniform vec4 uRingA; uniform vec3 uRingCol;
      varying vec3 vWP; varying vec3 vWN; varying float vRock; varying float vPath;
      float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float bNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(bHash(i), bHash(i + vec2(1, 0)), f.x), mix(bHash(i + vec2(0, 1)), bHash(i + vec2(1, 1)), f.x), f.y); }
      vec3 tri(sampler2D s, vec3 w, float k) { return texture2D(s, vec2(vWP.x, -vWP.z) * k).rgb * w.y + texture2D(s, vWP.zy * k).rgb * w.x + texture2D(s, vWP.xy * k).rgb * w.z; }`)
    .replace('#include <map_fragment>', `
      vec3 wn = normalize(vWN);
      vec3 bw = pow(abs(wn), vec3(10.0)); bw /= (bw.x + bw.y + bw.z);
      float deg = degrees(acos(clamp(wn.y, -1.0, 1.0)));
      float patchy = (bNoise(vWP.xz * 0.23) * 0.65 + bNoise(vWP.xz * 0.9 + 7.0) * 0.35 - 0.5) * 2.0;
      vec3 col = tri(map, bw, 0.2);
      // earth on steep parts: the slider lowers the angle at which grass gives way (60 deg -> 18 deg), patchily
      float e0 = mix(60.0, 18.0, uEarthAmt);
      float we = step(0.001, uEarthAmt) * smoothstep(e0, e0 + 12.0, deg + patchy * 11.0);
      vec3 ea = tri(uEarth, bw, 0.2); ea = mix(ea, vec3(dot(ea, vec3(0.3, 0.6, 0.1))), 0.4) * vec3(0.78, 0.8, 0.8);   // the generated earth came out terracotta: pulled toward brown
      col = mix(col, ea, we);
      float wr = smoothstep(0.3, 0.55, vRock) * smoothstep(36.0, 50.0, deg + patchy * 5.0);
      // rock: the layered face texture on the two side projections (its layers run level), the slab texture from above
      vec3 rk = texture2D(uRock, vec2(vWP.x, -vWP.z) * 0.2).rgb * bw.y + texture2D(uRockFace, vWP.zy * 0.2).rgb * bw.x + texture2D(uRockFace, vWP.xy * 0.2).rgb * bw.z;
      col = mix(col, rk, wr);
      col = mix(col, texture2D(uPath, vec2(vWP.x, -vWP.z) * 0.2).rgb, smoothstep(0.25, 0.75, vPath + patchy * 0.15));
      if (uFlat > 0.5) col = vec3(0.45, 0.55, 0.3);
      vec2 gd = abs(fract(vWP.xz / 5.0 - 0.5) - 0.5) * 5.0, gf = fwidth(vWP.xz);
      float line = max(1.0 - smoothstep(0.045, 0.045 + gf.x, gd.x), 1.0 - smoothstep(0.045, 0.045 + gf.y, gd.y));
      col = mix(col, vec3(0.024, 0.030, 0.014), line * 0.45 * uGrid);
      // the "ring painted on the slope": a 5-ft circle seen from above, drawn into the ground itself so it follows it
      float rd = length(vWP.xz - uRingA.xy), rf = fwidth(rd);
      float ring = (1.0 - smoothstep(0.16, 0.16 + rf, abs(rd - uRingA.z))) + 0.22 * (1.0 - smoothstep(uRingA.z - rf, uRingA.z, rd));
      col = mix(col, uRingCol, clamp(ring, 0.0, 1.0) * uRingA.w);
      diffuseColor.rgb *= col;`);
};
const { n: GN, cs: GC, x0: GX, z0: GZ } = DOMAIN;
const groundGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(GN * GN * 3), idx = new Uint32Array((GN - 1) * (GN - 1) * 6);
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) { const k = (j * GN + i) * 3; pos[k] = GX + (i + 0.5) * GC; pos[k + 2] = GZ + (j + 0.5) * GC; }
  let q = 0;
  for (let j = 0; j < GN - 1; j++) for (let i = 0; i < GN - 1; i++) { const a = j * GN + i, b = a + 1, c = a + GN, d = c + 1; if ((i + j) & 1) { idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; } else { idx[q++] = a; idx[q++] = c; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = b; } }
  groundGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  groundGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(GN * GN * 3), 3));
  groundGeo.setAttribute('aRock', new THREE.BufferAttribute(new Float32Array(GN * GN), 1));
  groundGeo.setAttribute('aPath', new THREE.BufferAttribute(new Float32Array(GN * GN), 1));
  groundGeo.setIndex(new THREE.BufferAttribute(idx, 1));
}
const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true; ground.frustumCulled = false; scene.add(ground);
{ // the flat lawn beyond the computed square: same material, so the grass runs on without a join
  const a = GX + GC / 2, b = -a, g = GROUND / 2, quads = [[-g, -g, g, a], [-g, b, g, g], [-g, a, a, b], [b, a, g, b]], p = [], nn = [];
  for (const [x0, z0, x1, z1] of quads) { p.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0); for (let i = 0; i < 6; i++) nn.push(0, 1, 0); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
  const m = new THREE.Mesh(geo, groundMat); m.receiveShadow = true; m.userData.noCast = true; scene.add(m);
}
let F = null;   // the current height field
function rebuildGround() {
  const def = SCENES[state.scene];
  const t0 = performance.now();
  F = buildField(def, { ...P, seed: def.seed || 1 }, DOMAIN);
  const pos = groundGeo.attributes.position.array, h = F.h;
  for (let k = 0; k < h.length; k++) pos[k * 3 + 1] = h[k];
  groundGeo.attributes.position.needsUpdate = true;
  groundGeo.attributes.aRock.array.set(F.rock); groundGeo.attributes.aRock.needsUpdate = true;
  groundGeo.attributes.aPath.array.set(F.path); groundGeo.attributes.aPath.needsUpdate = true;
  groundGeo.computeVertexNormals(); groundGeo.computeBoundingSphere();
  window.__buildMs = Math.round(performance.now() - t0);
}

// the game's grass scatter (look.js SCATTER 'floor-grass'): tufts 1 per 40 sq ft, worn patches 1 per 450 sq ft; level ground only
const decalGeo = new THREE.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
const decalMats = {};
const decalMat = (name) => decalMats[name] ||= new THREE.MeshStandardMaterial({ map: tex(`./tex/${name}.webp?v=${V}`), roughness: 0.95, transparent: true, opacity: 0.88, depthWrite: false, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const decals = new THREE.Group(); scene.add(decals);
{
  const rng = mulberry32(7), x0 = -84, x1 = 84, area = (x1 - x0) ** 2;
  for (const [base, n, per, w, d] of [['decal-grass-tuft', 4, 1 / 40, 3, 2.5], ['decal-grass-worn', 3, 1 / 450, 4, 3]]) {
    for (let i = 0; i < Math.round(area * per); i++) {
      const s = 0.6 + rng() * 1.0, m = new THREE.Mesh(decalGeo, decalMat(`${base}--s${1 + Math.floor(rng() * n)}`));
      m.scale.set(w * s, 1, d * s); m.userData.spin = rng() * Math.PI * 2; m.position.set(x0 + rng() * (x1 - x0), 0, x0 + rng() * (x1 - x0));
      m.renderOrder = 1; m.userData.fx = true; m.userData.r = Math.max(w, d) * s / 2; m.userData.lift = 0.02 + i * 1e-4; decals.add(m);
    }
  }
}
// tufts lie on the banks too, tilted to the ground under them (not on rock, paths, or ground too curved for a flat patch)
const UP = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), nv = new THREE.Vector3();
function placeDecals() {
  for (const m of decals.children) {
    const { x, z } = m.position, r = m.userData.r, g = F.grad(x, z, r * 0.7), sl = Math.hypot(g[0], g[1]);
    nv.set(-g[0], 1, -g[1]).normalize();
    const bend = Math.abs(F.heightAt(x + r * 0.7, z) + F.heightAt(x - r * 0.7, z) - 2 * F.heightAt(x, z)) + Math.abs(F.heightAt(x, z + r * 0.7) + F.heightAt(x, z - r * 0.7) - 2 * F.heightAt(x, z));
    m.visible = bend < 0.12 && sl < 0.85 && F.sample(F.path, x, z) < 0.1 && F.sample(F.rock, x, z) * sl < 0.3;
    m.quaternion.copy(qa.setFromUnitVectors(UP, nv)).multiply(qb.setFromAxisAngle(UP, m.userData.spin));
    m.position.y = F.heightAt(x, z) + m.userData.lift + 0.03 * sl;
  }
}

// ---------------------------------------------------------------- pieces
const kit = await (await fetch(`./kit.json?v=${V}`)).json();       // the slope pilot's measurements of its pieces
const lib = await (await fetch(`./props.json?v=${V}`)).json();     // sizes of the library pieces used here (deploy.sh)
const loader = new GLTFLoader();
const glbs = new Map(), rawMaps = new WeakMap();
const loadGLB = (url) => { if (!glbs.has(url)) glbs.set(url, loader.loadAsync(`${url}?v=${V}`).then(g => { g.scene.traverse(o => { if (o.isMesh) rawMaps.set(o.geometry, o.material.map); }); return g.scene; })); return glbs.get(url); };
// the pilot's colour match: grass-green texels of a generated piece are shifted by the measured difference to the game's grass
const matched = new Map();
function matchedMap(id, map) {
  const c = kit[id].colour; if (!c || !map?.image) return map;
  if (matched.has(map.uuid)) return matched.get(map.uuid);
  const im = map.image, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data, sh = c.ground_rgb.map((v, i) => v - c.grass_rgb[i]);
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const w = Math.min(1, Math.max(0, (g - Math.max(r * 1.04, b * 1.2)) / 14));
    if (w > 0) { p[i] = r + sh[0] * w; p[i + 1] = g + sh[1] * w; p[i + 2] = b + sh[2] * w; }
    p[i + 3] = 255;
  }
  cx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = map.flipY; t.colorSpace = map.colorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.channel = map.channel; t.anisotropy = 4;
  matched.set(map.uuid, t); return t;
}
// every piece comes back in the same frame: real feet, footprint centred on the origin, underside at y = 0.
// slope-* (the pilot's pieces): uphill toward -Z; the outcrop's two painted rock faces look toward +Z and +X.
const templates = new Map();
async function template(id) {
  if (templates.has(id)) return templates.get(id);
  const g = new THREE.Group();
  if (kit[id]) {
    const k = kit[id], src = (await loadGLB(`./models/${k.file}`)).clone(true);
    src.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); Object.assign(o.material, { roughness: 0.95, metalness: 0, side: THREE.DoubleSide, roughnessMap: null, metalnessMap: null, transparent: false, map: matchedMap(id, rawMaps.get(o.geometry)) }); } });
    src.rotation.y = THREE.MathUtils.degToRad(k.yaw_deg); src.scale.setScalar(k.scale); src.position.set(-k.center[0], -k.y0, -k.center[1]);
    g.add(src); g.userData.size = k.native.size_ft; g.userData.kit = k;
  } else {
    const L = lib[id]; if (!L) throw new Error(`no piece ${id}`);
    const src = (await loadGLB(`./props/${id}.glb`)).clone(true), box = new THREE.Box3().setFromObject(src), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    src.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.roughness = 0.85; o.material.metalness = 0; } });
    src.position.set(-c.x, -box.min.y, -c.z);
    const inner = new THREE.Group(); inner.add(src);
    const [w, d, hh] = L.size_ft;   // kit pieces stretch to their box per axis; props scale largest dimension to largest dimension (the tuner's rule)
    if (L.place === 'kit') inner.scale.set(w / s.x, hh / s.y, d / s.z); else inner.scale.setScalar(Math.max(w, d, hh) / Math.max(s.x, s.y, s.z));
    g.add(inner); g.userData.size = L.place === 'kit' ? [w, hh, d] : [s.x, s.y, s.z].map(v => v * inner.scale.x);
  }
  templates.set(id, g); return g;
}
const pawnColors = ['#d9654f', '#6fa8dc', '#e8d46a', '#c58be0', '#6fd0c0', '#f0a04b'];
function body(color, h = 6, r = 0.9, y0 = 0) {   // the stand-in person: no humanoid mini exists in the library yet
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(r, h - 2 * r - y0, 6, 16), mat); b.position.y = y0 + (h - y0) / 2; g.add(b); return g;
}
function pawn(r, color, h = 6) {   // the pilot's pawn: a level round base (5 ft across = one grid square) with a 6-ft body
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 40), new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.6 })); base.position.y = 0.125;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.27, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); ring.position.y = 0.135;
  g.add(base, ring, body(color, h, Math.min(0.9, r * 0.5), 0.25)); return g;
}
function figure() {  // plain 6-ft person, no base: the height reference
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.8 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.7, 6, 14), mat); b.position.y = 2.6;
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat); hd.position.y = 5.5;
  g.add(b, hd); return g;
}

// ---------------------------------------------------------------- dressing: seeded, so the same settings give the same scene
const rectDist = (x, z, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - z, 0, z - r[3]));
const BUSHES = ['bush--s1', 'bush--s2', 'bush--s3', 'bush-berry'], TREES = ['tree-fruit--s', 'tree-deciduous--s', 'tree-fruit--s2', 'tree-deciduous--s2', 'tree-birch--s'];
function dressing(def) {
  const rng = mulberry32((def.seed || 1) * 977), out = [], taken = [];
  const stand = [...(def.pawns || []), ...(def.figures || [])].map(([x, z]) => ({ x, z, r: 4 }));
  if (def.slope) stand.push({ x: def.slope.x, z: def.slope.z, r: 9 });
  for (const p of def.props || []) if (p.x != null) stand.push({ x: p.x, z: p.z, r: p.pawn ? 7 : 2.5 });
  const free = (x, z, r) => !taken.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r) && !stand.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r) && !(def.keepOut || []).some(k => rectDist(x, z, k) < r);
  const put = (o, r) => { taken.push({ x: o.x, z: o.z, r }); out.push(o); };
  let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
  for (const t of def.terraces) { bx0 = Math.min(bx0, t.rect[0]); bz0 = Math.min(bz0, t.rect[1]); bx1 = Math.max(bx1, t.rect[2]); bz1 = Math.max(bz1, t.rect[3]); }
  const M = 26; bx0 = Math.max(-84, bx0 - M); bz0 = Math.max(-84, bz0 - M); bx1 = Math.min(84, bx1 + M); bz1 = Math.min(84, bz1 + M);
  const uphillYaw = (x, z) => { const g = F.grad(x, z, 1.5); return Math.atan2(-g[0], -g[1]); };   // turns a piece's -Z to face uphill
  // rock faces first: walk down from a point on the face to its foot, and push scree and rock pieces into it there
  const face = [];
  for (let z = bz0; z <= bz1; z += 1.5) for (let x = bx0; x <= bx1; x += 1.5) if (F.sample(F.rock, x, z) >= 0.55 && F.slopeDeg(x, z, 0.75) >= 42) face.push([x, z]);
  for (let i = face.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [face[i], face[j]] = [face[j], face[i]]; }
  for (let i = 0; i < Math.min(face.length, 140); i++) {
    let [x, z] = face[i]; const roll = rng(), acc = rng(), sz = rng(), jit = rng();
    for (let s = 0; s < 60 && F.slopeDeg(x, z, 1) > 14; s++) { const g = F.grad(x, z, 0.75), m = Math.hypot(g[0], g[1]) || 1; x -= g[0] / m * 0.5; z -= g[1] / m * 0.5; }
    if (acc > 0.25 + P.dress * 1.1) continue;
    const g = F.grad(x, z, 3), m = Math.hypot(g[0], g[1]); if (m < 0.02) continue;
    const ux = g[0] / m, uz = g[1] / m, yaw = Math.atan2(-ux, -uz) + (jit - 0.5) * 0.5;
    if (roll < 0.42) { const s = 0.75 + sz * 0.6, px = x + ux * 1.2 * s, pz = z + uz * 1.2 * s; if (!free(px, pz, 2.6 * s)) continue; put({ id: 'slope-scree', x: px, z: pz, y: F.heightAt(x, z) - 0.45 * s, yaw, scale: [s * 1.05, s, s] }, 2.6 * s); }
    else { const s = 0.8 + sz * 0.7, id = 'rock-boulder', px = x + ux * 0.6 * s - uz * (jit - 0.5) * 3, pz = z + uz * 0.6 * s + ux * (jit - 0.5) * 3; if (!free(px, pz, 2.2 * s)) continue; put({ id, x: px, z: pz, y: F.heightAt(px, pz) - 0.7 * s, yaw: jit * 6.283, scale: [s * (0.85 + acc), s * (0.8 + jit * 0.5), s] }, 2.4 * s); }
  }
  // then the grass: bushes, half-buried rocks and scree on the banks; small trees, bushes and logs at their foot and rim
  const area = (bx1 - bx0) * (bz1 - bz0), N = Math.round(area / 9);
  for (let i = 0; i < N; i++) {
    const x = bx0 + rng() * (bx1 - bx0), z = bz0 + rng() * (bz1 - bz0), roll = rng(), acc = rng(), sz = rng(), yawR = rng() * Math.PI * 2;
    if (F.sample(F.path, x, z) > 0.15 || F.sample(F.rock, x, z) > 0.45) continue;
    const sd = F.slopeDeg(x, z, 1.5);
    if (sd >= 12) {
      if (acc > P.dress * 0.42) continue;
      const tan = Math.tan(sd * Math.PI / 180);
      if (roll < 0.5) { const s = 0.75 + sz * 0.5; if (free(x, z, 1.9 * s)) put({ id: BUSHES[Math.floor(roll * 8) % 4], x, z, y: F.heightAt(x, z) - 0.2 - tan * 1.2 * s, yaw: yawR, scale: [s, s, s] }, 1.9 * s); }
      else if (roll < 0.82) { const s = 0.55 + sz * 0.6, id = 'rock-boulder', r = 2.4 * s; if (free(x, z, r)) put({ id, x, z, y: F.heightAt(x, z) - 0.9 * s - tan * r * 0.75, yaw: yawR, scale: [s * (0.8 + roll), s * (0.75 + sz * 0.4), s] }, r); }
      else { const s = 0.5 + sz * 0.4; if (free(x, z, 3.2 * s)) put({ id: 'slope-scree', x, z, y: F.heightAt(x, z) - 1.1 * s - tan * 1.0 * s, yaw: uphillYaw(x, z), scale: [s, s, s] }, 3.2 * s); }
    } else if (sd < 3 && F.relief(x, z, 2) < 0.12) {
      let near = 0; for (let a = 0; a < 8; a++) near = Math.max(near, F.slopeDeg(x + Math.cos(a * 0.785) * 6.5, z + Math.sin(a * 0.785) * 6.5, 1.5));
      if (near >= 12) {
        if (acc > P.dress * 0.3) continue;
        if (roll < 0.3) { const s = 0.85 + sz * 0.4; if (free(x, z, 4.5 * s)) put({ id: TREES[Math.floor(roll / 0.3 * 5) % 5], x, z, y: F.heightAt(x, z) - 0.1, yaw: yawR, scale: [s, s, s] }, 4.5 * s); }
        else if (roll < 0.72) { const s = 0.8 + sz * 0.5; if (free(x, z, 1.9 * s)) put({ id: BUSHES[Math.floor(roll * 9) % 4], x, z, y: F.heightAt(x, z) - 0.15, yaw: yawR, scale: [s, s, s] }, 1.9 * s); }
        else if (roll < 0.92) { const s = 0.5 + sz * 0.7, id = 'rock-boulder', r = 2.4 * s; if (free(x, z, r)) put({ id, x, z, y: F.heightAt(x, z) - 0.55 * s, yaw: yawR, scale: [s * (0.9 + sz * 0.5), s * (0.8 + roll * 0.3), s] }, r); }
        else if (free(x, z, 3.2)) put({ id: 'log-seat', x, z, y: F.heightAt(x, z) - 0.15, yaw: yawR, scale: [1, 1, 1] }, 3.2);
      } else if (acc < P.dress * 0.035) {
        if (roll < 0.5) { const s = 0.9 + sz * 0.5; if (free(x, z, 4.5 * s)) put({ id: TREES[Math.floor(roll * 10) % 5], x, z, y: F.heightAt(x, z) - 0.1, yaw: yawR, scale: [s, s, s] }, 4.5 * s); }
        else { const s = 0.8 + sz * 0.5; if (free(x, z, 1.9 * s)) put({ id: BUSHES[Math.floor(roll * 8) % 4], x, z, y: F.heightAt(x, z) - 0.15, yaw: yawR, scale: [s, s, s] }, 1.9 * s); }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- scene building
const world = new THREE.Group(); scene.add(world);
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
const flagMats = {};
let buildNo = 0;
async function build() {
  const my = ++buildNo;
  window.__ready = false; $('#status').textContent = 'working…';
  const def = SCENES[state.scene];
  rebuildGround(); placeDecals();
  const root = new THREE.Group(), pawns = new THREE.Group(), slopePair = new THREE.Group(), props = new THREE.Group();
  root.add(pawns, slopePair, props);
  const list = dressing(def), warn = [];
  // hand-placed pieces of the scene
  for (const p of def.props || []) {
    if (p.id === 'floor') {   // a building's floor: the library floor texture, one tile per 5-ft cell, as the game lays it
      const [x0, z0, x1, z1] = p.rect, g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, pos = g.attributes.position, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + cx) / CELL, -(pos.getZ(i) + cz) / CELL);
      const m = new THREE.Mesh(g, flagMats[p.tex] ||= new THREE.MeshStandardMaterial({ map: tex(`./tex/${p.tex}.webp?v=${V}`, true), roughness: 0.9 }));
      m.position.set(cx, F.heightAt(cx, cz) + 0.06, cz); m.receiveShadow = true; m.userData.noCast = true; props.add(m); continue;
    }
    list.push({ ...p, y: F.heightAt(p.x, p.z) - (p.sink ?? 0.08), yaw: THREE.MathUtils.degToRad(p.rot || 0), scale: p.scale || [1, 1, 1], hand: true });
  }
  for (const s of def.stairs || []) {   // library stairs set into a bank: top step at the terrace edge, stretched to the bank's run
    const runFt = s.rise / Math.tan(P.angle * Math.PI / 180);
    list.push({ id: 'stair-straight--dressed-stone', x: s.x, z: s.zTop + runFt / 2 - 0.3, y: s.base - 0.15, yaw: 0, scale: [1, 1, 1], stair: [5, s.rise, runFt + 0.6] });
  }
  const made = await Promise.all(list.map(async (o) => ({ o, t: await template(o.id) })));
  if (my !== buildNo) return;
  let pc = 0;
  for (const { o, t } of made) {
    const m = t.clone(true), w = new THREE.Group(); w.add(m);
    if (o.stair) { const sz = t.userData.size; m.scale.set(o.stair[0] / sz[0], (o.stair[1] + 2.0) / sz[1], o.stair[2] / sz[2]); }   // +2 ft: the mesh's height includes its rail
    w.position.set(o.x, o.y, o.z); w.rotation.y = o.yaw; w.scale.set(o.scale[0], o.scale[1], o.scale[2]);
    props.add(w);
    if (o.pawn) {   // a pawn on a flat-topped rock: rays straight down find the top under the base and how level it is
      w.updateMatrixWorld(true); const ys = [];
      for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1.1, 1.1], [-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1]]) { ray.set(new THREE.Vector3(o.x + dx, 200, o.z + dz), down); const hit = ray.intersectObject(w, true)[0]; if (hit) ys.push(hit.point.y); }
      const top = Math.max(...ys), lowest = Math.min(...ys), pw = pawn(2.5, pawnColors[pc++ % 6]); pw.position.set(o.x, top, o.z); pawns.add(pw);
      window.__rockTop = { rays: ys.length, top: +top.toFixed(2), range: +(top - lowest).toFixed(2) };
      if (ys.length < 9 || top - lowest > 0.6) warn.push(`rock top under the pawn at ${o.x},${o.z}: ${ys.length}/9 rays hit, range ${(top - lowest).toFixed(2)} ft`);
    }
  }
  for (const [x, z, how] of def.pawns || []) {
    const pw = pawn(2.5, pawnColors[pc++ % 6]); pw.position.set(x, F.heightAt(x, z), z); pawns.add(pw);
    const rel = F.relief(x, z, 2.5); if (rel > 0.35 && how !== 'drop') warn.push(`pawn at ${x},${z}: ground under its base varies ${rel.toFixed(2)} ft`);
  }
  for (const [x, z] of def.figures || []) { const f = figure(); f.position.set(x, F.heightAt(x, z), z); pawns.add(f); }
  // the "pawn base on slopes" pair, on the bank itself. Left: the level 5-ft disc. Right: no disc, a ring painted on the slope.
  if (def.slope) {
    const s = def.slope, d = 4.2, ax = s.x - s.along[0] * d, az = s.z - s.along[1] * d, bx = s.x + s.along[0] * d, bz = s.z + s.along[1] * d;
    const a = pawn(2.5, '#e8d46a'); a.position.set(ax, F.heightAt(ax, az), az);
    const b = body('#e8d46a', 6, 0.9, 0); b.position.set(bx, F.heightAt(bx, bz) - 0.12, bz);
    slopePair.add(a, b); U.uRingA.value.set(bx, bz, 2.4, 0);
    window.__slope = { x: s.x, y: F.heightAt(s.x, s.z), z: s.z, deg: +F.slopeDeg(s.x, s.z, 1).toFixed(1), level: [ax, az], ring: [bx, bz] };
  }
  root.traverse(o => { if (o.isMesh && !o.userData.fx && !o.material.transparent) { o.castShadow = !o.userData.noCast; o.receiveShadow = true; } });
  world.clear(); world.add(root);
  world.userData = { pawns, slopePair, props, def };
  applyToggles();
  if (warn.length) console.warn(warn.join('; '));
  window.__list = list.map(o => [o.id, +o.x.toFixed(1), +o.z.toFixed(1)]); window.__warn = warn; window.__counts = { props: props.children.length, scattered: list.filter(o => !o.hand && !o.stair).length };
  $('#title').innerHTML = `<b>${def.title}</b><br>${def.note}`;
  $('#status').textContent = `${window.__counts.scattered} scattered pieces · ground rebuilt in ${window.__buildMs} ms · v${V}`;
  lighting?.markDirty?.();
  setTimeout(() => { if (my === buildNo) window.__ready = true; }, 500);
}
function applyToggles() {
  const u = world.userData; if (!u.pawns) return;
  u.pawns.visible = state.pawns; u.slopePair.visible = state.slopepawn; $('#pairNote').style.display = state.slopepawn ? 'block' : 'none'; U.uRingA.value.w = state.slopepawn ? 0.9 : 0; U.uGrid.value = state.grid ? 1 : 0;
  renderer.shadowMap.enabled = state.shadows; sun.castShadow = state.shadows;
  // the house rig's sun stands 37 degrees up (tuned indoors): a 30-degree bank facing away from it gets almost no sun.
  // 'Higher sun' lifts it to 62 degrees, same compass direction, nothing else changed.
  if (state.highsun) sun.position.set(-70, 170, -58); else sun.position.set(-120, 120, -100);
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
const VIEWS = { table: (d) => ({ yaw: -20, pitch: 52, dist: d.tableDist }), lean: (d) => ({ yaw: -20, pitch: 38, dist: d.tableDist * 0.55 }), low: (d) => ({ yaw: d.lowYaw, pitch: 16, dist: d.lowDist }) };
function setView(name, useQuery) {
  state.view = VIEWS[name] ? name : 'table';
  const def = SCENES[state.scene], v = VIEWS[state.view](def); let c = def.focus;
  if (useQuery) { if (qs.has('yaw')) v.yaw = +qs.get('yaw'); if (qs.has('pitch')) v.pitch = +qs.get('pitch'); if (qs.has('dist')) v.dist = +qs.get('dist'); if (qs.has('focus')) c = qs.get('focus').split(',').map(Number); }
  const yaw = THREE.MathUtils.degToRad(v.yaw), pitch = THREE.MathUtils.degToRad(v.pitch);   // the tuner's GrabCamera convention
  controls.target.set(c[0], c[1], c[2]);
  camera.position.set(c[0] + Math.sin(yaw) * Math.cos(pitch) * v.dist, c[1] + Math.sin(pitch) * v.dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * v.dist);
  controls.update();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === state.view));
}
function cameraNow() {
  const o = camera.position.clone().sub(controls.target), dist = o.length();
  return { yaw: +THREE.MathUtils.radToDeg(Math.atan2(o.x, o.z)).toFixed(1), pitch: +THREE.MathUtils.radToDeg(Math.asin(o.y / dist)).toFixed(1), dist: +dist.toFixed(1), focus: controls.target.toArray().map(v => +v.toFixed(1)) };
}

// ---------------------------------------------------------------- UI
const SLIDERS = [
  ['angle', 'Bank angle', 15, 60, 1, (v) => `${v}° · a 10 ft rise takes ${(10 / Math.tan(v * Math.PI / 180)).toFixed(1)} ft`],
  ['soft', 'Edge softness', 0, 3, 0.1, (v) => v < 0.05 ? 'a hard crease' : `rounded over about ${(v * 2.4).toFixed(1)} ft`],
  ['round', 'Corner rounding', 0, 4, 0.5, (v) => v < 0.6 ? 'square corners' : `${v} ft radius at the top edge`],
  ['rough', 'Surface roughness', 0, 1, 0.05, (v) => v < 0.03 ? 'machine-smooth' : `foot wanders up to ${(v * 4.3).toFixed(1)} ft, angle varies ±${Math.round(v * 42)}%`],
  ['dress', 'Rocks and plants', 0, 1, 0.05, (v) => v < 0.03 ? 'bare' : `${Math.round(v * 100)}%`],
  ['earth', 'Earth on steep parts', 0, 1, 0.05, (v) => v < 0.03 ? 'grass everywhere' : `earth shows from about ${Math.round(60 - 42 * v)}°`],
];
let timer = 0;
const later = (fn) => { clearTimeout(timer); timer = setTimeout(fn, 90); };
for (const [key, label, min, max, step, read] of SLIDERS) {
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<label>${label}<span id="r-${key}"></span></label><input type="range" id="s-${key}" min="${min}" max="${max}" step="${step}">`;
  $('#sliders').append(row);
  const inp = row.querySelector('input'), out = row.querySelector('span');
  inp.value = P[key]; out.textContent = read(+inp.value);
  inp.oninput = () => { P[key] = +inp.value; out.textContent = read(P[key]); if (key === 'earth') { U.uEarthAmt.value = P.earth; return; } later(build); };
}
$('#cliffs').value = P.cliffs; $('#cliffs').onchange = (e) => { P.cliffs = e.target.value; build(); };
for (const [key, def] of Object.entries(SCENES)) {
  const b = document.createElement('button'); b.textContent = def.button; b.dataset.scene = key;
  b.onclick = async () => { state.scene = key; syncUI(); await build(); setView(state.view); };
  $('#scenes').append(b, ' ');
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
for (const k of ['grid', 'pawns', 'slopepawn', 'shadows', 'highsun']) { $('#' + k).checked = state[k]; $('#' + k).onchange = (e) => { state[k] = e.target.checked; applyToggles(); if (k === 'slopepawn' && state.slopepawn && window.__slope) lookAtSlope(); }; }
$('#night').checked = state.night; $('#night').onchange = (e) => { state.night = e.target.checked; applyLook(); };
function lookAtSlope() {   // swing round to see the pair side-on, close
  const s = window.__slope, g = F.grad(s.x, s.z, 2), al = SCENES[state.scene].slope.along, yaw = Math.atan2(-g[0], -g[1]) + (al[0] ? 0.5 : 0.5), pitch = THREE.MathUtils.degToRad(20), dist = 34;
  controls.target.set(s.x, s.y + 2, s.z);
  camera.position.set(s.x + Math.sin(yaw) * Math.cos(pitch) * dist, s.y + 2 + Math.sin(pitch) * dist, s.z + Math.cos(yaw) * Math.cos(pitch) * dist); controls.update();
}
function syncUI() { document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', b.dataset.scene === state.scene)); }
syncUI();
const settings = () => ({ ...P, scene: state.scene, view: state.view, grid: state.grid, pawns: state.pawns, slopepawn: state.slopepawn, shadows: state.shadows, highsun: state.highsun, night: state.night, cliffAngle: CLIFF_DEG });
function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = bad ? 'bad show' : 'show'; clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ''; }, 3200); }
$('#copy').onclick = async () => {
  const s = JSON.stringify(settings());
  try { await navigator.clipboard.writeText(s); toast('Settings copied.'); } catch { prompt('Copy the settings:', s); }
};
$('#reset').onclick = () => { Object.assign(P, DEFAULTS); for (const [key, , , , , read] of SLIDERS) { $('#s-' + key).value = P[key]; $('#r-' + key).textContent = read(P[key]); } $('#cliffs').value = P.cliffs; U.uEarthAmt.value = P.earth; build(); };
async function sendVerdict(verdict) {
  try {
    const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'banks_demo', name: state.scene, note: $('#noteBox').value,
      data: { verdict, scene: state.scene, settings: settings(), defaults: DEFAULTS, camera: cameraNow(), counts: window.__counts, v: V, screen: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, ua: navigator.userAgent } }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.err || r.status);
    $('#sent').textContent = `Sent ${new Date().toLocaleTimeString()}: "${verdict === 'reads_as_land' ? 'reads as land' : 'still looks wrong'}" for scene ${SCENES[state.scene].button}.`;
    toast('Sent. Thank you.'); $('#noteBox').value = '';
  } catch (err) { toast(`Could not send: ${err.message}`, true); }
}
$('#good').onclick = () => sendVerdict('reads_as_land'); $('#bad').onclick = () => sendVerdict('still_wrong');
if (qs.get('ui') === '0') for (const id of ['#bar', '#panel', '#info', '#status']) $(id).style.display = 'none';

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  // CSS size, as the game and the tuner pass it. This line used to pass CSS x pixel ratio; the composer sets the renderer's
  // size and the renderer multiplies by the ratio again, so a ratio-2 screen drew 16 times the pixels (found 2026-10-06).
  lighting?.setSize(w, h);
}
addEventListener('resize', resize); resize();
let last = performance.now();
// Draw on demand (2026-10-06): a frame is drawn while something changes (camera, any control, a resize) and for three
// seconds after, plus two frames a second as a heartbeat so a late texture still appears. An idle page costs almost nothing.
let wake = 240, beat = 0;
const poke = () => { wake = 180; };
controls.addEventListener('change', poke);
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'input', 'click', 'resize', 'visibilitychange']) addEventListener(ev, (e) => { if (ev !== 'pointermove' || e.buttons) poke(); }, { passive: true, capture: true });
window.__poke = poke;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(100, now - last); last = now;
  controls.update();
  if (wake <= 0 && now - beat < 500 && !new URLSearchParams(location.search).has('always')) return;
  wake--; beat = now;
  if (lighting) { lighting.frame(now); lighting.render(dt); } else renderer.render(scene, camera);
});
window.__state = state; window.__P = P; window.__fx = !!lighting; window.__field = () => F; window.__settings = settings;
await build(); setView(state.view, true);
if (state.slopepawn && !qs.has('yaw')) lookAtSlope();
