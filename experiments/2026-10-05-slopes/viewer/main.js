// Slopes pilot viewer (2026-10-05). A standalone page: flat grass ground with the game's 5-ft grid, the generated slope
// props placed by scenes.js, pawn stand-ins on the auto-detected flat zones (kit.json, from ../measure.py), and the
// game's own lighting module (lib/lighting.js is a copy of tools/spawn-tuner/js/fx/lighting.js made by deploy.sh).
// URL: ?scene=hill|plateau|cliff|kit  &view=table|low|top  &pawns=0 &zones=1 &grid=0 &fit=0 &match=0 &shadows=1 &night=1 &nofx=1
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENES } from './scenes.js?v=__V__';

const V = '__V__';
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const flag = (k, d) => qs.has(k) ? qs.get(k) !== '0' : d;
const state = { scene: qs.get('scene') || 'hill', view: qs.get('view') || 'table', pawns: flag('pawns', true), zones: flag('zones', false),
  grid: flag('grid', true), fit: flag('fit', true), match: flag('match', true), shadows: flag('shadows', false), night: flag('night', false) };

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
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 500 });
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

// ---------------------------------------------------------------- ground
const texLoader = new THREE.TextureLoader();
const tex = (url, repeat) => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; };
const GROUND = 300, CELL = 5;
const grassMap = tex(`./tex/floor-grass.webp?v=${V}`, true);
// one texture tile per 5-ft cell, laid straight and world-aligned (the game's "continuous" floor mode), on every level
function grassTop(w, d, cx, cz) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + cx) / CELL, -(pos.getZ(i) + cz) / CELL);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.95 }));
  m.position.set(cx, 0, cz); m.receiveShadow = true; return m;
}
scene.add(grassTop(GROUND, GROUND, 0, 0));
const gridMat = new THREE.LineBasicMaterial({ color: '#2a3020', transparent: true, opacity: 0.45 });
function gridLines(x0, z0, x1, z1, y) {
  const p = [];
  for (let x = Math.ceil(x0 / CELL) * CELL; x <= x1 + 1e-6; x += CELL) p.push(x, y, z0, x, y, z1);
  for (let z = Math.ceil(z0 / CELL) * CELL; z <= z1 + 1e-6; z += CELL) p.push(x0, y, z, x1, y, z);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const l = new THREE.LineSegments(g, gridMat); l.userData.grid = true; return l;
}
scene.add(gridLines(-GROUND / 2, -GROUND / 2, GROUND / 2, GROUND / 2, 0.04));

// the game's grass scatter (look.js SCATTER 'floor-grass'): tufts 1 per 40 sq ft, worn patches 1 per 450 sq ft
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const decalGeo = new THREE.PlaneGeometry(1, 1); decalGeo.rotateX(-Math.PI / 2);
const decalMats = {};
const decalMat = (name) => decalMats[name] ||= new THREE.MeshStandardMaterial({ map: tex(`./tex/${name}.webp?v=${V}`), roughness: 0.95, transparent: true, opacity: 0.88, depthWrite: false, alphaTest: 0.02 });
function scatter(x0, z0, x1, z1, y, seed, group) {
  const rng = mulberry32(seed), area = (x1 - x0) * (z1 - z0);
  for (const [base, n, per, w, d] of [['decal-grass-tuft', 4, 1 / 40, 3, 2.5], ['decal-grass-worn', 3, 1 / 450, 4, 3]]) {
    for (let i = 0; i < Math.round(area * per); i++) {
      const s = 0.6 + rng() * 1.0, m = new THREE.Mesh(decalGeo, decalMat(`${base}--s${1 + Math.floor(rng() * n)}`));
      m.scale.set(w * s, 1, d * s); m.rotation.y = rng() * Math.PI * 2;
      m.position.set(x0 + 2 + rng() * (x1 - x0 - 4), y + 0.02 + i * 1e-4, z0 + 2 + rng() * (z1 - z0 - 4));
      m.renderOrder = 1; m.userData.fx = true; group.add(m);
    }
  }
}
const groundDecals = new THREE.Group(); scene.add(groundDecals);
scatter(-80, -80, 80, 80, 0, 7, groundDecals);

// ---------------------------------------------------------------- kit
const kit = await (await fetch(`./kit.json?v=${V}`)).json();
const loader = new GLTFLoader();
const glbs = new Map(), rawMaps = new WeakMap();   // geometry -> the texture as generated (clones share geometry)
const loadGLB = (id) => { if (!glbs.has(id)) glbs.set(id, loader.loadAsync(`./models/${kit[id].file}?v=${V}`).then(g => { g.scene.traverse(o => { if (o.isMesh) rawMaps.set(o.geometry, o.material.map); }); return g.scene; })); return glbs.get(id); };
// Colour normalisation (a pipeline step done here at load so it can be switched off to compare): the painted grass came
// out darker and more saturated than the game's grass tile. Every grass-green texel is shifted by the measured
// difference between the piece's mean grass colour and the tile's (kit.json "colour", from measure.py).
const matched = new Map();
function matchedMap(id, map) {
  const c = kit[id].colour; if (!c || !map?.image) return map;
  if (matched.has(map.uuid)) return matched.get(map.uuid);
  const im = map.image, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, cv.width, cv.height), p = d.data, sh = c.ground_rgb.map((v, i) => v - c.grass_rgb[i]);
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const w = Math.min(1, Math.max(0, (g - Math.max(r * 1.04, b * 1.2)) / 14));   // how grass-green this texel is
    if (w > 0) { p[i] = r + sh[0] * w; p[i + 1] = g + sh[1] * w; p[i + 2] = b + sh[2] * w; }
    p[i + 3] = 255;
  }
  cx.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.flipY = map.flipY; t.colorSpace = map.colorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.channel = map.channel; t.anisotropy = 4;
  matched.set(map.uuid, t); return t;
}

// canonical piece: footprint centred on the origin, underside at y=0, uphill toward -Z (corners: high corner at -X,-Z),
// scaled so its footprint has the size in kit.json. With "fit" on, wedges and corners are stretched so the footprint
// AND the top edge match the designed size exactly (the top edge has to meet a 5-ft terrace).
async function makePiece(id, fitOn) {
  const k = kit[id]; if (!k) throw new Error(`no piece ${id}`);
  const src = (await loadGLB(id)).clone(true);
  src.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.roughness = 0.95; o.material.metalness = 0; o.material.side = THREE.DoubleSide; o.material.roughnessMap = o.material.metalnessMap = null; o.material.transparent = false; o.material.map = state.match ? matchedMap(id, rawMaps.get(o.geometry)) : rawMaps.get(o.geometry); o.receiveShadow = true; } });
  src.rotation.y = THREE.MathUtils.degToRad(k.yaw_deg); src.scale.setScalar(k.scale);
  src.position.set(-k.center[0], -k.y0, -k.center[1]);
  const piece = new THREE.Group(); piece.add(src);
  const m = fitOn ? k.fit : k.native, f = fitOn ? k.fit.f : [1, 1, 1];
  piece.scale.set(f[0], f[1], f[2]); piece.position.y = fitOn ? -k.fit.sink_ft : 0;
  piece.userData = { id, k, m };
  return piece;
}

const pawnColors = ['#d9654f', '#6fa8dc', '#e8d46a', '#c58be0', '#6fd0c0', '#f0a04b'];
function pawn(r, color, h = 6) {   // a level round base (5 ft across = one grid square) with a human-height body
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 40), new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.6 }));
  base.position.y = 0.125;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.27, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
  ring.position.y = 0.135;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(0.9, r * 0.5), h - 2 * Math.min(0.9, r * 0.5) - 0.25, 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  body.position.y = 0.25 + (h - 0.25) / 2;
  g.add(base, ring, body); g.userData.pawn = true; return g;
}
function figure() {  // plain 6-ft person, no base: the height reference
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.8 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.7, 6, 14), mat); b.position.y = 2.6;
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat); hd.position.y = 5.5;
  g.add(b, hd); return g;
}

// ---------------------------------------------------------------- scene building
const world = new THREE.Group(); scene.add(world);
const earth = new THREE.MeshStandardMaterial({ color: '#6b4f33', roughness: 1 });
let buildNo = 0;
async function build() {
  const my = ++buildNo;
  $('#status').textContent = 'loading…'; window.__ready = false;
  const def = SCENES[state.scene] || SCENES.hill;
  const root = new THREE.Group();
  const pawns = new THREE.Group(), zones = new THREE.Group(), grids = new THREE.Group();
  root.add(pawns, zones, grids);
  let pc = 0; const zoneMat5 = new THREE.MeshBasicMaterial({ color: '#39c0ff', transparent: true, opacity: 0.55, depthWrite: false });
  const zoneMat2 = new THREE.MeshBasicMaterial({ color: '#ffe14a', transparent: true, opacity: 0.55, depthWrite: false });
  for (const s of def.slabs || []) {   // flat terraces: plain boxes with the same grass on top
    const [x0, z0, x1, z1] = s.rect, h = s.h, y0 = s.y0 || 0;
    const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h - y0 - 0.02, z1 - z0), earth);
    box.position.set((x0 + x1) / 2, (h + y0 - 0.02) / 2, (z0 + z1) / 2); box.castShadow = box.receiveShadow = true; root.add(box);
    const top = grassTop(x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2); top.position.y = h; root.add(top);
    grids.add(gridLines(x0, z0, x1, z1, h + 0.04));
    scatter(x0, z0, x1, z1, h, 11 + Math.round(x0 * 3 + z0), root);
  }
  const placed = await Promise.all((def.pieces || []).map(async (p) => {
    const piece = await makePiece(p.id, state.fit && p.fit !== false);
    const wrap = new THREE.Group(); wrap.add(piece);
    wrap.position.set(p.x, p.y || 0, p.z); wrap.rotation.y = THREE.MathUtils.degToRad(p.rot || 0);
    const sc = p.scale || [1, 1, 1]; wrap.scale.set(sc[0], sc[1], sc[2]);
    return { p, piece, wrap };
  }));
  if (my !== buildNo) return;
  for (const { p, piece, wrap } of placed) {
    root.add(wrap); wrap.updateMatrixWorld(true);
    const m = piece.userData.m;                       // measurements in the frame the piece is shown in (fitted or as generated)
    const toWorld = (c) => wrap.localToWorld(new THREE.Vector3(c[0], c[1], c[2]));
    for (const [name, r, mat] of [['5ft', 2.5, zoneMat5], ['2.5ft', 1.25, zoneMat2]]) {
      for (const c of m.zones[name].bases) {
        const w = toWorld([c.x, c.y, c.z]);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 36), mat); disc.rotation.x = -Math.PI / 2; disc.position.copy(w).add(new THREE.Vector3(0, 0.3, 0)); disc.userData.fx = true;
        zones.add(disc);
        const want = p.pawnZones === true ? (name === '5ft' || !m.zones['5ft'].bases.length) : (p.pawnZones || []).includes(r);
        if (want && c.y > 0.75) { const pw = pawn(r, pawnColors[pc++ % 6]); pw.position.copy(w); pawns.add(pw); }
      }
    }
    if (p.slopePawn && m.mid_slope_point) {   // a LEVEL base on the plain slope: its centre sits at the surface height
      const w = toWorld(m.mid_slope_point), dx = p.slopePawn === 'pair' ? 2.2 : 0;
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), wrap.rotation.y);
      const a = pawn(2.5, pawnColors[pc++ % 6]); a.position.copy(w).addScaledVector(right, -dx); pawns.add(a);
      if (dx) { const b = pawn(1.25, pawnColors[pc++ % 6]); b.position.copy(w).addScaledVector(right, dx + 1.5); pawns.add(b); }
    }
  }
  // a pawn with drop:true is set down where it is: a ray straight down finds the surface under the CENTRE of its base
  root.updateMatrixWorld(true);
  const solid = []; root.traverse(o => { if (o.isMesh && !o.userData.fx && !o.material.transparent) solid.push(o); });
  const ray = new THREE.Raycaster();
  const surfaceY = (x, z) => { ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0)); const h = ray.intersectObjects(solid, false)[0]; return h ? h.point.y : 0; };
  for (const q of def.pawns || []) { const pw = pawn(q.r || 2.5, pawnColors[pc++ % 6]); pw.position.set(q.x, q.drop ? surfaceY(q.x, q.z) : (q.y || 0), q.z); pawns.add(pw); }
  for (const q of def.figures || []) { const f = figure(); f.position.set(q.x, q.y || 0, q.z); root.add(f); }
  root.traverse(o => { if (o.isMesh && !o.userData.fx && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  world.clear(); world.add(root);
  world.userData = { pawns, zones, grids, def };
  applyToggles(); setView(state.view);
  $('#note').innerHTML = `<b>${def.title}</b><br>${def.note}`;
  $('#status').textContent = `${placed.length} slope props · v${V}`;
  lighting?.markDirty?.();
  setTimeout(() => { window.__ready = true; }, 600);
}
function applyToggles() {
  const u = world.userData; if (!u.pawns) return;
  u.pawns.visible = state.pawns; u.zones.visible = state.zones; u.grids.visible = state.grid;
  scene.traverse(o => { if (o.userData.grid) o.visible = state.grid; });
  renderer.shadowMap.enabled = state.shadows; sun.castShadow = state.shadows;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
function setView(name) {
  state.view = name;
  const def = world.userData.def || SCENES[state.scene]; const c = def.focus || [0, 4, 0];
  const v = { table: { yaw: -20, pitch: 52, dist: def.tableDist || 95 }, low: { yaw: def.lowYaw ?? 25, pitch: 16, dist: def.lowDist || 55 }, top: { yaw: 0, pitch: 89.5, dist: def.tableDist || 95 } }[name] || { yaw: -20, pitch: 52, dist: 95 };
  if (qs.has('yaw')) v.yaw = +qs.get('yaw'); if (qs.has('pitch')) v.pitch = +qs.get('pitch'); if (qs.has('dist')) v.dist = +qs.get('dist');
  const yaw = THREE.MathUtils.degToRad(v.yaw), pitch = THREE.MathUtils.degToRad(v.pitch);   // the tuner's GrabCamera convention
  controls.target.set(c[0], c[1], c[2]);
  camera.position.set(c[0] + Math.sin(yaw) * Math.cos(pitch) * v.dist, c[1] + Math.sin(pitch) * v.dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * v.dist);
  controls.update();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
}

// ---------------------------------------------------------------- UI
for (const [key, def] of Object.entries(SCENES)) {
  const b = document.createElement('button'); b.textContent = def.button; b.dataset.scene = key;
  b.onclick = () => { state.scene = key; syncUI(); build(); };
  $('#scenes').append(b, ' ');
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
for (const k of ['pawns', 'zones', 'grid', 'shadows']) { $('#' + k).checked = state[k]; $('#' + k).onchange = (e) => { state[k] = e.target.checked; applyToggles(); }; }
$('#fit').checked = state.fit; $('#fit').onchange = (e) => { state.fit = e.target.checked; build(); };
$('#match').checked = state.match; $('#match').onchange = (e) => { state.match = e.target.checked; build(); };
$('#night').checked = state.night; $('#night').onchange = (e) => { state.night = e.target.checked; applyLook(); };
function syncUI() { document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', b.dataset.scene === state.scene)); }
syncUI();
if (qs.has('ui') && qs.get('ui') === '0') { $('#bar').style.display = $('#note').style.display = $('#status').style.display = 'none'; }

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
window.__state = state; window.__kit = kit; window.__fx = !!lighting;
window.__project = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
await build();
