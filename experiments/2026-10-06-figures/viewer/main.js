// Figures pilot viewer (2026-10-06). A standalone page on the slope and cave pilots' scaffolding: the game's lighting
// module (lib/lighting.js is a copy of tools/spawn-tuner/js/fx/lighting.js made by deploy.sh), a small inn room built
// from the game's library on the 5-ft grid (room.json), and four generated figures (kit.json: measured by measure.py).
// The base is built HERE, never in the mesh. Nothing on this page is in the game.
// URL: ?scene=room|fig-fighter|fig-wizard|fig-goblin|fig-wolf &view=table|lean|close|front|side|top|quarter
//      &base=dark|rim|ring|none &color=0..5 &size=0.9 &notch=1 &night=0 &grid=1 &spin=0 &standin=0 &ui=0 &nofx=1
//      &second=0 (the first-try wolf and goblin instead of the second tries)
//      &tier=full|5k256|5k512|20k1024|20kbake (every figure at that detail tier)   scene=tiers&focus=fig-id&labels=0   scene=crowd&n=30&fig=fig-id&tier=
//      &focus=fig-id (close view in the room) &yaw= &pitch= &dist= &turn=DEG (figures turned by this much)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const V = '__V__';
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const flag = (k, d) => qs.has(k) ? qs.get(k) !== '0' : d;
const num = (k, d) => qs.has(k) && isFinite(+qs.get(k)) ? +qs.get(k) : d;
const API = qs.get('api') || '/api/tw-ratings';
const CELL = 5;
const [kit, room] = await Promise.all([fetch(`./kit.json?v=${V}`).then(r => r.json()), fetch(`./room.json?v=${V}`).then(r => r.json())]);
const SLOTS = room.figures.map(f => f.id).filter(id => kit[id]);     // the four places; a place may show its second try
const SECOND = Object.fromEntries(Object.entries(room.second_try || {}).filter(([a, b]) => kit[a] && kit[b]));
const NAMES = { 'fig-fighter': 'Fighter', 'fig-wizard': 'Wizard', 'fig-goblin': 'Goblin', 'fig-wolf': 'Wolf', 'fig-goblin-b': 'Goblin, second try', 'fig-wolf-b': 'Wolf, second try' };
const FIGS = SLOTS;
const WEAPON = { 'fig-fighter': 'sword', 'fig-wizard': 'staff', 'fig-goblin': 'spear' };
// Detail tiers of one figure (kit.json tiers; made by src/optimize_glb_blender.py and, for the baked one, the Import Lab)
const TIERS = { full: 'A · as generated: 49k triangles, 2048 px', '5k256': 'B · furniture tier: 5k, 256 px', '5k512': 'C · 5k, 512 px', '8k512': 'H · horde and townsfolk tier: 8k, 512 px', '20k1024': 'D · hero tier: 20k, 1024 px', '20kbake': 'E · 20k, 1024 px + baked normal map' };
const tierOf = (slot) => state.tiers[slot] || state.tier;
const shown = (slot) => state.second && SECOND[slot] ? SECOND[slot] : slot;   // the mesh standing in a place now
const SEATS = ['#d9654f', '#6fa8dc', '#e8d46a', '#c58be0', '#6fd0c0', '#f0a04b'];
const BASES = { dark: 'Plain dark disc', rim: 'Disc with a coloured rim', ring: 'Ring painted on the floor', none: 'No base' };
const state = { scene: ['room', 'tiers', 'crowd'].includes(qs.get('scene')) || FIGS.includes(qs.get('scene')) ? qs.get('scene') : 'room', view: qs.get('view') || '', base: BASES[qs.get('base')] ? qs.get('base') : 'rim',
  color: Math.min(5, Math.max(0, num('color', 0))), size: num('size', 0.9), notch: flag('notch', true), night: flag('night', true), grid: flag('grid', true), spin: flag('spin', false), standin: flag('standin', false), tier: TIERS[qs.get('tier')] ? qs.get('tier') : 'full', tiers: {}, labels: flag('labels', true), second: flag('second', true),
  focus: FIGS.includes(qs.get('focus')) ? qs.get('focus') : FIGS[0] };
const DISC_H = 0.3;   // a 25 mm base is about 3 mm thick: 0.6 ft at this scale; kept lower so it does not read as a plinth

const canvas = $('#c');
// If the browser cannot give a WebGL context, or loses it, say so on the page instead of sitting on "loading…".
const fail = (msg) => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);max-width:520px;background:#3a1f1a;border:1px solid #a8685c;border-radius:8px;padding:14px 18px;color:#f3e6d8;font-size:15px;z-index:9'; d.textContent = msg; document.body.append(d); $('#status').textContent = 'stopped'; };
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('The browser dropped the 3D picture (WebGL context lost). Reload the page; if it happens again, tell Fauna which browser this is and read out the line at the bottom right.'); });
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('ui') || qs.has('capture') }); }
catch (e) { fail(`This browser would not start WebGL, so the figures cannot be drawn (${e.message}).`); throw e; }
// Pixel ratio capped at 1.5 (?pr=2 for the game's cap of 2): the lighting stack costs per pixel, and 1.5 on a
// high-density screen is a little over half the pixels of 2.
renderer.setPixelRatio(Math.min(num('pr', 1.5), devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#070605');
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);   // the tuner's and the game's camera
const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7); // the tuner's light rig (main.js), same numbers
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
sun.position.set(-120, 120, 100); sun.target.position.set(15, 0, 12);
scene.add(hemi, sun, sun.target);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI / 2 - 0.02; controls.minDistance = 3; controls.maxDistance = 400;

let lighting = null, LB = null;
if (!qs.has('nofx')) {
  try {
    const m = await import(`./lib/lighting.js?v=${V}`);
    lighting = m.createLighting({ renderer, scene, camera, hemi, sun, focus: () => controls.target });
    LB = m.LIGHT_BUILTINS;
  } catch (e) { console.warn('house lighting not loaded, plain render', e); }
}
// Harry's two working profiles from the tuner's Lighting panel; "night" is what the game uses when no look is stored.
function applyLook() {
  if (!lighting) { hemi.intensity = state.night ? 0.6 : 1.7; sun.intensity = state.night ? 0.5 : 1.9; return; }
  lighting.set(state.night ? LB.night() : LB.day()); lighting.markDirty();
}

// ---------------------------------------------------------------- shared bits
const texLoader = new THREE.TextureLoader();
const tex = (url) => { const t = texLoader.load(url, () => { lighting?.markDirty?.(); window.__poke?.(); }); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const loader = new GLTFLoader();
const glbs = new Map();
window.__loads = {};   // file -> ms from request to a parsed scene (download + decode)
const loadGLB = (file) => { if (!glbs.has(file)) { const t0 = performance.now(); glbs.set(file, loader.loadAsync(`./models/${file}?v=${V}`).then(g => { window.__loads[file] = Math.round(performance.now() - t0); return g.scene; })); } return glbs.get(file); };
// the game's treatment of a library mesh: its colour map only, matte (look.js: roughness 0.85, metalness 0)
function gameMaterial(root) {
  root.traverse(o => { if (o.isMesh) { const map = o.material.map, normalMap = o.material.normalMap || null; o.material = new THREE.MeshStandardMaterial({ map, normalMap, color: map ? '#ffffff' : o.material.color, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }); o.castShadow = o.receiveShadow = true; } });
  return root;
}
async function libraryPiece(p) {
  const src = gameMaterial((await loadGLB(p.file)).clone(true));
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group(); src.position.set(-mid.x, -box.min.y, -mid.z); g.add(src);
  const out = new THREE.Group(); out.add(g);
  if (p.kind === 'wall') {   // stretched to its catalog box, length along the wall
    const [w, d, h] = p.box_ft, along = size.x >= size.z;
    g.scale.set(along ? w / size.x : d / size.x, h / size.y, along ? d / size.z : w / size.z); if (!along) g.rotation.y = Math.PI / 2;
  } else {                   // the tuner's rule: largest catalog dimension to the mesh's largest dimension, then its known front to +Z
    g.scale.setScalar(Math.max(...p.size_ft) / Math.max(size.x, size.y, size.z)); g.rotation.y = THREE.MathUtils.degToRad(p.yaw || 0);
  }
  out.position.set(p.x, 0, p.z); out.rotation.y = THREE.MathUtils.degToRad(p.rot || 0);
  return out;
}
// a figure in its own frame: origin on the ground under the middle of its feet, front +Z, at its stated height
async function makeFigure(id, tier = 'full') {
  const k = kit[id], t = k.tiers?.[tier] || k.tiers?.full || { file: k.file }; const src = gameMaterial((await loadGLB(t.file)).clone(true));
  if (tier !== 'full') {   // a lighter copy may come back in other units (the Import Lab exports it 6 ft tall, feet at zero): fit its box to the original's
    const b = new THREE.Box3().setFromObject(src), [lo, hi] = k.native_bounds, f = (hi[1] - lo[1]) / (b.max.y - b.min.y);
    src.scale.setScalar(f); src.position.set((lo[0] + hi[0]) / 2 - (b.min.x + b.max.x) / 2 * f, lo[1] - b.min.y * f, (lo[2] + hi[2]) / 2 - (b.min.z + b.max.z) / 2 * f);
  }
  const turn = new THREE.Group(); turn.add(src); turn.rotation.y = THREE.MathUtils.degToRad(k.yaw_deg); turn.scale.setScalar(k.scale);
  const g = new THREE.Group(); g.add(turn); turn.position.set(-k.plan.centre[0], -k.y0, -k.plan.centre[1]);
  g.userData = { id, k }; return g;
}
const baseRadius = (id) => (kit[id].base_ft || 5) / 2 * state.size;
function arrow(r, y, color, flat) {   // the facing mark: a small arrowhead just outside the rim, pointing the way the figure faces (+Z)
  const s = new THREE.Shape(); const w = 0.6, l = 0.8; s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(0, l); s.closePath();
  const geo = flat ? new THREE.ShapeGeometry(s) : new THREE.ExtrudeGeometry(s, { depth: y, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); if (!flat) geo.translate(0, y, 0); else geo.translate(0, y, 0);
  const m = new THREE.Mesh(geo, flat ? new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }) : new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }));
  m.position.z = r - 0.04; if (!flat) m.castShadow = m.receiveShadow = true; m.userData.fx = flat; return m;
}
function makeBase(id) {
  const g = new THREE.Group(), r = baseRadius(id), col = SEATS[state.color]; let top = 0;
  const dark = new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.7 });
  if (state.base === 'dark' || state.base === 'rim') {
    top = DISC_H;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * (state.base === 'rim' ? 0.9 : 1), r * (state.base === 'rim' ? 0.9 : 1), DISC_H, 48), dark); disc.position.y = DISC_H / 2; g.add(disc);
    if (state.base === 'rim') {   // the rim: a band round the disc, a touch lower than its top, in the seat's colour
      const pts = [new THREE.Vector2(r * 0.9, DISC_H), new THREE.Vector2(r * 0.97, DISC_H - 0.02), new THREE.Vector2(r, DISC_H * 0.6), new THREE.Vector2(r, 0)];
      const rim = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, emissive: col, emissiveIntensity: 0.25, side: THREE.DoubleSide })); g.add(rim);
    }
    if (state.notch) g.add(arrow(r, DISC_H * 0.6, state.base === 'rim' ? col : '#d8d2c0', false));
    g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  } else if (state.base === 'ring') {   // no disc: a ring painted on the floor (the banks demo's better answer on slopes)
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.045; ring.userData.fx = true; g.add(ring);
    if (state.notch) g.add(arrow(r, 0.045, col, true));
  }
  g.userData.top = top; return g;
}
function standIn(color, r = 2.5, h = 6) {   // the pawn the pilots have used until now: a capsule on a disc
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 40), new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.6 })); base.position.y = 0.125;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, h - 1.8 - 0.25, 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.8 })); body.position.y = 0.25 + (h - 0.25) / 2;
  g.add(base, body); g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; }); return g;
}
function ruler(h) {   // a height pole, one band per foot
  const g = new THREE.Group();
  for (let i = 0; i < h; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), new THREE.MeshStandardMaterial({ color: i % 2 ? '#d8d2c0' : '#7a3b2e', roughness: 0.8 })); m.position.y = i + 0.5; g.add(m); }
  return g;
}
function floorLabel(text, x, z) {   // a line of text lying on the floor in front of a figure
  const c = document.createElement('canvas'); c.width = 1024; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#f3e6c4'; g.font = '600 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 512, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.45), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); m.userData.fx = true; return m;
}
function lamp(x, y, z, pri) {   // a warm point light with a small glowing ball (the fire module's brazier numbers)
  const l = new THREE.PointLight('#ffa040', num('light', 14), num('reach', 42), 1.4); l.position.set(x, y, z);
  l.userData = { priority: pri, fx: true };
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.1) })); ball.userData.fx = true; l.add(ball);
  return l;
}
const floorTex = room.floor.map(f => tex(`./tex/${f}?v=${V}`));
function floorTiles(w, d) {
  const g = new THREE.Group();
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), new THREE.MeshStandardMaterial({ map: floorTex[(i * 7 + j * 3) % floorTex.length], roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.position.set(i * CELL + 2.5, 0, j * CELL + 2.5); m.receiveShadow = true; g.add(m);
  }
  return g;
}
function gridLines(w, d) {
  const p = [];
  for (let i = 0; i <= w; i++) p.push(i * CELL, 0.04, 0, i * CELL, 0.04, d * CELL);
  for (let j = 0; j <= d; j++) p.push(0, 0.04, j * CELL, w * CELL, 0.04, j * CELL);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#f0e2b8', transparent: true, opacity: 0.4, depthWrite: false })); l.userData.fx = true; return l;
}

// ---------------------------------------------------------------- scene building
const world = new THREE.Group(); scene.add(world);
let buildNo = 0, pawns = [];
async function pawnOf(id, x, z, rotDeg, tier = 'full') {   // base + figure standing on it; the base and the figure turn together (facing)
  const g = new THREE.Group(), fig = await makeFigure(id, tier), base = makeBase(id);
  fig.position.y = base.userData.top; g.add(base, fig); g.position.set(x, 0, z); g.rotation.y = THREE.MathUtils.degToRad(rotDeg + num('turn', 0));
  g.userData = { id, fig, base, rot0: g.rotation.y }; return g;
}
function refreshBases() {
  for (const p of pawns) { p.remove(p.userData.base); const b = makeBase(p.userData.id); p.add(b); p.userData.base = b; p.userData.fig.position.y = b.userData.top; }
  measure(); lighting?.markDirty?.(); window.__poke?.(60);
}
// what was built, measured on the page: how far the lowest point of each figure is from the top of its base
function measure() {
  world.updateMatrixWorld(true); const out = {};
  for (const p of pawns) {
    const b = new THREE.Box3().setFromObject(p.userData.fig), r = baseRadius(p.userData.id), k = kit[p.userData.id];
    out[p.userData.id] = {  feet_above_base_ft: +(b.min.y - p.userData.base.userData.top).toFixed(3), height_ft: +(b.max.y - b.min.y).toFixed(2), base_width_ft: +(r * 2).toFixed(2), base: state.base,
      contacts_inside_base: k.plan.contacts_radius_ft <= r + 0.01, overhang_ft: +Math.max(0, k.plan.reach_radius_ft - r).toFixed(2) };
  }
  window.__figs = out; return out;
}
async function build() {
  const my = ++buildNo;
  $('#status').textContent = 'building…'; window.__ready = false;
  const root = new THREE.Group(), lamps = [], grids = new THREE.Group(), standins = new THREE.Group(); root.add(grids, standins); const made = [];
  if (state.scene === 'room') {
    const [w, d] = room.cells;
    root.add(floorTiles(w, d)); grids.add(gridLines(w, d));
    for (const p of await Promise.all(room.pieces.map(libraryPiece))) root.add(p);
    room.lamps.forEach(([x, y, z], i) => { const l = lamp(x, y, z, 3 - i * 0.1); root.add(l); lamps.push(l); });
    for (const f of room.figures) { if (!kit[f.id]) continue; const p = await pawnOf(shown(f.id), f.x, f.z, f.rot, tierOf(f.id)); made.push(p); root.add(p);
      const s = standIn(SEATS[(state.color + 1) % 6], 2.5, kit[f.id].stated_ft.body); s.position.set(f.x + (f.x > 15 ? -5 : 5), 0, f.z); standins.add(s); }
  } else if (state.scene === 'tiers') {   // one figure five times, the five detail tiers side by side
    const id = shown(state.focus), keys = Object.keys(TIERS).filter(t => kit[id].tiers?.[t]);
    root.add(floorTiles(8, 3).translateX(-20).translateZ(-7.5)); const gl = gridLines(8, 3); gl.position.set(-20, 0, -7.5); grids.add(gl);
    for (let i = 0; i < keys.length; i++) {
      const x = (i - (keys.length - 1) / 2) * 5, p = await pawnOf(id, x, 0, 12, keys[i]); made.push(p); root.add(p);
      if (state.labels) { const t = kit[id].tiers[keys[i]]; root.add(floorLabel(`${TIERS[keys[i]].split(' · ')[0]} · ${(t.tris / 1000).toFixed(0)}k · ${t.tex} px${t.normal_map ? ' + normals' : ''} · ${t.kb > 999 ? (t.kb / 1024).toFixed(1) + ' MB' : t.kb + ' KB'}`, x, 3.6)); }
    }
    room.lamps.slice(0, 2).forEach(([x, y, z], i) => { const l = lamp(i ? 11 : -11, 7.2, -5, 3 - i * 0.1); root.add(l); lamps.push(l); });
  } else if (state.scene === 'crowd') {   // for the frame-cost bench: n copies of one figure at one tier, on the grid (?n=30&fig=fig-fighter&tier=20k1024)
    const id = FIGS.includes(qs.get('fig')) ? shown(qs.get('fig')) : shown(SLOTS[0]), n = num('n', 30), cols = Math.ceil(Math.sqrt(n * 1.5)), rows = Math.ceil(n / cols);
    root.add(floorTiles(cols, rows).translateX(-cols * 2.5).translateZ(-rows * 2.5));
    for (let i = 0; i < n; i++) { const p = await pawnOf(id, (i % cols - (cols - 1) / 2) * 5, (Math.floor(i / cols) - (rows - 1) / 2) * 5, (i * 37) % 360, state.tier); made.push(p); root.add(p); }
    lamps.push(lamp(0, 8, 0, 3)); root.add(lamps[0]);
  } else {
    const id = shown(state.scene), k = kit[id];
    root.add(floorTiles(4, 4).translateX(-10).translateZ(-10)); const gl = gridLines(4, 4); gl.position.set(-10, 0, -10); grids.add(gl);
    const p = await pawnOf(id, 0, 0, 0, tierOf(state.scene)); made.push(p); root.add(p);
    const r = ruler(Math.ceil(k.overall_ft)); r.position.set(-3.2, 0, -1.5); root.add(r);
    lamps.push(lamp(6, 8, 8, 3)); root.add(lamps[0]);
  }
  if (my !== buildNo) return;
  const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0e0c0a', roughness: 1 })); far.position.y = -0.05; root.add(far);
  world.clear(); world.add(root); pawns = made; world.userData = { grids, standins };
  lighting?.setFireLights(lamps);
  applyToggles(); syncUI(); setView(viewsNow().includes(state.view) ? state.view : viewsNow()[0]);
  measure();
  $('#status').textContent = `v${V}`;
  window.__poke?.(120);
  setTimeout(() => { lighting?.markDirty?.(); window.__poke?.(60); window.__ready = true; }, 900);
}
function applyToggles() { window.__poke?.(60); const u = world.userData; if (!u.grids) return; u.grids.visible = state.grid; u.standins.visible = state.standin; applyLook(); }
const VIEWS = { table: 'Table distance', lean: 'Leaning in', close: 'Close-up', front: 'Front', side: 'Side', top: 'Top', quarter: 'Three-quarter' };
const viewsNow = () => state.scene === 'room' || state.scene === 'tiers' || state.scene === 'crowd' ? ['table', 'lean', 'close'] : ['quarter', 'front', 'side', 'top'];
function setView(name) {
  state.view = name; let c, v;
  if (state.scene === 'tiers' || state.scene === 'crowd') {
    c = [0, 2.5, 0.5]; const wide = state.scene === 'crowd' ? Math.max(1, Math.sqrt(num('n', 30)) / 3.2) : 1;
    v = { table: { yaw: -20, pitch: 52, dist: 78 * wide }, lean: { yaw: -10, pitch: 38, dist: 45 * wide }, close: { yaw: 0, pitch: 14, dist: 30 * wide } }[name];
  } else if (state.scene === 'room') {
    const f = room.figures.find(x => x.id === state.focus) || room.figures[0], mid = [room.cells[0] * 2.5, 2, room.cells[1] * 2.5 + 1];
    // table distance = the game's high three-quarter play camera (the tuner's home view: 52 degrees down), the whole room in frame;
    // leaning in = the game's "table" key (38 degrees, 45 ft); close-up = eye to eye with one figure
    c = name === 'close' ? [f.x, kit[shown(f.id)].overall_ft * 0.5, f.z] : mid;
    v = { table: { yaw: -20, pitch: 52, dist: 78 }, lean: { yaw: -14, pitch: 38, dist: 45 }, close: { yaw: f.rot + 18, pitch: 14, dist: 5 + kit[shown(f.id)].overall_ft * 2.1 } }[name];
  } else {
    const h = kit[shown(state.scene)].overall_ft; c = [0, h * 0.5, 0];
    v = { quarter: { yaw: 28, pitch: 16, dist: 5 + h * 2.2 }, front: { yaw: 0, pitch: 4, dist: 5 + h * 2.2 }, side: { yaw: 90, pitch: 4, dist: 5 + h * 2.2 }, top: { yaw: 0, pitch: 89, dist: 9 + h * 1.6 } }[name];
  }
  if (qs.has('yaw')) v.yaw = +qs.get('yaw'); if (qs.has('pitch')) v.pitch = +qs.get('pitch'); if (qs.has('dist')) v.dist = +qs.get('dist');
  const yaw = THREE.MathUtils.degToRad(v.yaw), pitch = THREE.MathUtils.degToRad(v.pitch);   // the tuner's GrabCamera convention
  controls.target.set(c[0], c[1], c[2]);
  camera.position.set(c[0] + Math.sin(yaw) * Math.cos(pitch) * v.dist, c[1] + Math.sin(pitch) * v.dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * v.dist);
  controls.update(); lighting?.markDirty?.(); window.__poke?.(60);
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
}

// ---------------------------------------------------------------- UI
const btn = (text, on, data = {}) => { const b = document.createElement('button'); b.textContent = text; Object.assign(b.dataset, data); b.onclick = on; return b; };
$('#scenes').append(btn('All four in a room', () => { state.scene = 'room'; build(); }, { scene: 'room' }), ' ');
for (const id of FIGS) $('#scenes').append(btn(`${NAMES[id]} alone`, () => { state.scene = id; state.focus = id; build(); }, { scene: id }), ' ');
$('#scenes').append(btn('Detail tiers side by side', () => { state.scene = 'tiers'; build(); }, { scene: 'tiers' }), ' ');
for (const [k, label] of Object.entries(BASES)) $('#bases').append(btn(label, () => { state.base = k; syncUI(); refreshBases(); }, { base: k }));
SEATS.forEach((c, i) => { const b = btn('', () => { state.color = i; syncUI(); refreshBases(); }, { color: i }); b.className = 'sw'; b.style.background = c; b.title = `Seat colour ${i + 1}`; $('#colors').append(b); });
for (const [k, label] of Object.entries(TIERS)) { const o = document.createElement('option'); o.value = k; o.textContent = label; $('#tier').append(o); }
$('#tier').value = state.tier; $('#tier').onchange = (e) => { state.tier = e.target.value; state.tiers = {}; cards(); build(); };
for (const k of ['spin', 'night', 'grid', 'standin', 'second']) { $('#' + k).checked = state[k]; $('#' + k).onchange = (e) => { state[k] = e.target.checked; if (k === 'second') cards(); if (k === 'second') return build(); applyToggles(); if (k === 'spin' && !state.spin) for (const p of pawns) p.rotation.y = p.userData.rot0; }; }
$('#notch').checked = state.notch; $('#notch').onchange = (e) => { state.notch = e.target.checked; refreshBases(); };
$('#s-size').value = state.size; $('#s-size').oninput = (e) => { state.size = +e.target.value; syncUI(); refreshBases(); };
$('#hide').onclick = () => { const m = $('#panel').classList.toggle('min'); $('#hide').textContent = m ? '+' : '–'; };
const pct = (v) => v == null ? '?' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
function cards() { $('#figs').innerHTML = ''; for (const slot of SLOTS) {
  const id = shown(slot), k = kit[id], d = document.createElement('div'); d.className = 'fig'; d.dataset.fig = slot;
  const fl = k.pieces.floating_count, off = k.ground.max_off_ground_ft;
  d.innerHTML = `<b>${NAMES[id]}</b> <span style="color:#8d897c">${k.stated_ft.body} ft creature${k.overall_ft > k.stated_ft.figure_top + 0.05 ? `, ${k.overall_ft.toFixed(1)} ft to the tip of what it holds` : k.stated_ft.figure_top > k.stated_ft.body ? `, ${k.stated_ft.figure_top} ft with the hat` : ''}</span>
    <div class="facts">${(k.tris / 1000).toFixed(0)}k triangles, ${(k.kb / 1024).toFixed(1)} MB · unpainted <span class="${k.unpainted?.seen > 0.03 ? 'bad' : 'good'}">${pct(k.unpainted?.seen)}</span> of what you can see
      · ${k.ground.contact_count} ground contacts, highest <span class="${off > 0.08 ? 'bad' : 'good'}">${off?.toFixed(2)} ft</span> off the floor · loose bits <span class="${fl ? 'bad' : 'good'}">${fl}</span>
      · outline against its painting <span class="${k.silhouette?.iou < 0.8 ? 'bad' : 'good'}">${pct(k.silhouette?.iou)}</span>${k.shaft ? ` · ${WEAPON[slot]} ${k.shaft.thickness_ft.toFixed(2)} ft thick, <span class="${k.shaft.broken_share ? 'bad' : 'good'}">${k.shaft.broken_share ? 'broken' : 'unbroken'}</span>` : ''}${k.plan.reach_radius_ft > 2.5 ? ` · <span class="bad">reaches ${(k.plan.reach_radius_ft - 2.5).toFixed(1)} ft outside its 5-ft square</span>` : ''}</div>
    <div class="tierrow"><label>Detail <select class="tsel">${Object.keys(TIERS).filter(t => k.tiers?.[t]).map(t => `<option value="${t}"${t === tierOf(slot) ? ' selected' : ''}>${TIERS[t]} (${k.tiers[t].kb > 999 ? (k.tiers[t].kb / 1024).toFixed(1) + ' MB' : k.tiers[t].kb + ' KB'})</option>`).join('')}</select></label> <button class="side">Side by side</button></div>
    <textarea placeholder="Optional note: what is wrong or right with it…"></textarea>
    <div class="verdict"><button class="good">Good miniature</button><button class="bad">Not good enough</button></div><div class="sent"></div>`;
  d.querySelector('.tsel').onchange = (e) => { state.tiers[slot] = e.target.value; build(); }; d.querySelector('.side').onclick = () => { state.focus = slot; state.scene = 'tiers'; build(); };
  d.querySelector('.good').onclick = () => sendVerdict(id, 'good_miniature', d); d.querySelector('.bad').onclick = () => sendVerdict(id, 'not_good_enough', d);
  $('#figs').append(d);
} syncUI(); }
cards();
function syncUI() {
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', b.dataset.scene === state.scene));
  document.querySelectorAll('[data-base]').forEach(b => b.classList.toggle('on', b.dataset.base === state.base));
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', +b.dataset.color === state.color));
  document.querySelectorAll('.fig').forEach(d => d.classList.toggle('cur', d.dataset.fig === (state.scene === 'tiers' ? state.focus : state.scene)));
  $('#r-size').textContent = `${(state.size * 5).toFixed(1)} ft`;
  $('#title').textContent = state.scene === 'room' ? 'Four generated figures in an inn room' : state.scene === 'tiers' ? `${NAMES[shown(state.focus)]}: six detail tiers, left to right` : state.scene === 'crowd' ? 'Crowd (frame-cost bench)' : `${NAMES[state.scene]}, alone`;
  $('#note').textContent = state.scene === 'room' ? 'Furniture, walls and floor are the game\'s own library on a 5-ft grid; the walls are 9 ft, the doorway is in the back wall. Each figure stands in the middle of one square. Drag to orbit, wheel to zoom.'
    : state.scene === 'tiers' ? 'The same figure six times: A as generated, then five lighter copies (the label on the floor says what each is). Pick the figure with a "Side by side" button below. The question is which is the lightest you cannot tell from A at table distance.'
    : 'The striped pole has one band per foot. Front, Side and Top look straight at it; the base and its arrow turn with the figure.';
  const want = viewsNow(), have = [...document.querySelectorAll('[data-view]')].map(b => b.dataset.view);
  if (want.join() !== have.join()) { $('#views').innerHTML = ''; for (const v of want) $('#views').append(btn(VIEWS[v], () => setView(v), { view: v }), ' '); }
}
if (innerWidth < 700) { $('#panel').classList.add('min'); $('#hide').textContent = '+'; }   // a phone: the panel starts folded so the figures show
if (qs.get('ui') === '0') { $('#bar').style.display = $('#panel').style.display = $('#status').style.display = $('#fps').style.display = 'none'; }
const cameraNow = () => ({ pos: camera.position.toArray().map(v => +v.toFixed(1)), target: controls.target.toArray().map(v => +v.toFixed(1)), view: state.view });
async function sendVerdict(id, verdict, d) {
  const sent = d.querySelector('.sent'), box = d.querySelector('textarea'), k = kit[id];
  try {
    const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'figures_pilot', name: id, note: box.value,
      data: { verdict, figure: id, scene: state.scene, base: state.base, seat_colour: SEATS[state.color], base_width_ft: +(baseRadius(id) * 2).toFixed(2), facing_mark: state.notch, tier: tierOf(d.dataset.fig), night: state.night, grid: state.grid, turntable: state.spin, camera: cameraNow(),
        mesh: { file: (k.tiers?.[tierOf(d.dataset.fig)] || k).file, tris: (k.tiers?.[tierOf(d.dataset.fig)] || k).tris, kb: (k.tiers?.[tierOf(d.dataset.fig)] || k).kb, unpainted_seen: k.unpainted?.seen, route: k.route }, v: V, screen: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, ua: navigator.userAgent } }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.err || r.status);
    sent.style.color = ''; sent.textContent = `Sent ${new Date().toLocaleTimeString()}: "${verdict === 'good_miniature' ? 'Good miniature' : 'Not good enough'}" for the ${NAMES[id].toLowerCase()} (base: ${BASES[state.base].toLowerCase()}).`; box.value = '';
  } catch (err) { sent.style.color = '#ff9a7a'; sent.textContent = `Could not send: ${err.message}`; }
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  // CSS size, as the game and the tuner pass it: the composer sets the renderer's size itself and the renderer multiplies
  // by the pixel ratio. (The slope pilot's scaffolding passed CSS x ratio here, so the ratio was applied twice: on a
  // ratio-2 screen the page drew 16 times the pixels of ratio 1. That was "the page runs super slow", 2026-10-06.)
  lighting?.setSize(w, h); window.__poke?.();
}
addEventListener('resize', resize); resize();
// Draw on demand: a frame is drawn only while something changes (the camera moves, a control is used, the turntable
// runs, a file arrives) and for a short tail after, so shadows and textures settle. An idle page costs nothing.
let wake = 90, drawn = 0, last = performance.now();
function poke(n = 45) { wake = Math.max(wake, n); }
controls.addEventListener('change', () => poke());
addEventListener('pointerdown', () => poke()); addEventListener('keydown', () => poke()); document.addEventListener('visibilitychange', () => poke());
for (const el of document.querySelectorAll('#bar, #panel')) { el.addEventListener('click', () => poke(90)); el.addEventListener('input', () => poke(90)); }
const fpsEl = $('#fps'); let fN = 0, fT = performance.now(), fCost = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(100, now - last); last = now;
  if (state.spin) { for (const p of pawns) p.rotation.y += dt / 1000 * (6 * 2 * Math.PI / 60); lighting?.markDirty?.(); poke(2); }   // 6 rpm, as the asset review page
  controls.update();
  if (wake > 0 || qs.has('always')) {
    wake--; const c0 = performance.now();
    if (lighting) { lighting.frame(now); lighting.render(dt); } else renderer.render(scene, camera);
    fCost += performance.now() - c0; fN++; drawn++;
  }
  if (now - fT >= 1000) {   // the readout: frames drawn in the last second; "idle" when nothing needed drawing
    const pr = renderer.getPixelRatio();
    if (fpsEl) fpsEl.textContent = (fN ? `${Math.round(fN * 1000 / (now - fT))} fps` : 'idle (draws when something moves)') + ` · ${canvas.width}×${canvas.height} px (ratio ${pr}${devicePixelRatio > pr ? ` of ${devicePixelRatio}` : ''})`;
    window.__fps = fN * 1000 / (now - fT); fN = 0; fCost = 0; fT = now;
  }
});
window.__drawCount = () => drawn; window.__poke = poke;
// Bench: n frames drawn back to back, each forced to finish on the GPU (a 1-pixel read-back), so the number is the real
// cost of a frame and not the screen's refresh. mode: 'full' (as the page draws), 'plain' (no lighting stack),
// 'noshadow' (lighting stack, shadow maps not refreshed)
window.__bench = (n = 60, mode = 'full') => {
  const gl = renderer.getContext(), px = new Uint8Array(4); let t = performance.now();
  const one = (i) => { if (mode === 'plain' || !lighting) renderer.render(scene, camera); else { if (mode !== 'noshadow') lighting.frame(t + i * 16); lighting.render(16); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  for (let i = 0; i < 5; i++) one(i);
  const t0 = performance.now(); for (let i = 0; i < n; i++) one(i + 5); const ms = (performance.now() - t0) / n;
  const info = renderer.info;
  return { mode, ms_per_frame: +ms.toFixed(2), fps: +(1000 / ms).toFixed(1), buffer: [renderer.domElement.width, renderer.domElement.height], pixel_ratio: renderer.getPixelRatio(), dpr: devicePixelRatio, calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures, geometries: info.memory.geometries };
};
window.__state = state; window.__kit = kit; window.__fx = !!lighting; window.__send = sendVerdict; window.__measure = measure; window.__spinProbe = () => pawns[0]?.rotation.y ?? 0;
await build();
