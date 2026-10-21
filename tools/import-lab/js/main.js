// Import Lab: judge, by eye, what converting a player's own model to a small game asset costs.
// ORIGINAL on the left, CONVERTED on the right, one camera for both. See COMMANDERS_INTENT.md.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ingest, convert, highDisplayGeometry, exportGLB } from './pipeline.js';

const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const API = qs.get('api') || '/api/tw-ratings';
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const mb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(b >= 10485760 ? 0 : 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const secs = (ms) => (ms < 950 ? `${Math.round(ms / 10) / 100} s` : `${(ms / 1000).toFixed(1)} s`);

// ---------------------------------------------------------------- choices
const BUDGETS = [5000, 10000, 20000, 50000, 100000];
const TEX = [512, 1024, 2048];
const LOOKS = {
  pewter: { label: 'Pewter', color: '#8f8e8a', roughness: 0.4, metalness: 0.8, env: 1.0 },
  plastic: { label: 'Plastic', color: '#8d8778', roughness: 0.45, metalness: 0, env: 0.3 },
  primer: { label: 'Primed grey', color: '#6d7074', roughness: 0.92, metalness: 0, env: 0 },
};
// the game's camera: 45 degree lens, grab camera starting 95 ft out at 52 degrees (engine/client/views.js + tuner camera.js)
const VIEWS = {
  table: { label: 'Table distance', hint: 'The camera the game is played from: 95 ft out, looking down at 52°. This is the view to judge by.' },
  lean: { label: 'Leaning in', hint: '30 ft out: a player zooming in on their own mini.' },
  close: { label: 'Close-up', hint: 'Filling the screen. Defects here are notes, not verdicts.' },
};
const UPS = [['y', 'Y is up'], ['z', 'Z is up'], ['x', 'X is up'], ['-y', 'Y is down'], ['-z', 'Z is down'], ['-x', 'X is down']];
const S = {
  budget: +qs.get('budget') || 20000, bake: qs.get('bake') !== '0', tex: +qs.get('tex') || 1024, look: qs.get('look') || 'pewter',
  view: qs.get('view') || 'table', mode: qs.get('mode') || 'side', light: qs.get('light') || 'night',
  heightFt: 6, turns: 0, up: 'y', swap: false,
};
let model = null; // { name, format, bytes, high, root (as loaded), coloured }
let current = null; // the conversion on show: { stats, glb, key }
const cache = new Map();
let busy = 0;

// ---------------------------------------------------------------- scene (one scene, one camera, two canvases)
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d1f1a');
const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);
const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7);
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
const SUN_FROM = new THREE.Vector3(-120, 120, -100).normalize(); // the tuner's sun, relative to what it lights
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#2b2e25', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; ground.userData.noCast = true;
const grid = new THREE.GridHelper(400, 80, '#4a4e40', '#3a3d33'); grid.position.set(2.5, 0, 2.5); // 5-ft squares; the model stands in the middle of one
scene.add(ground, grid);

try { await Promise.race([document.fonts.load('500 44px "DM Mono"'), new Promise(r => setTimeout(r, 1500))]); } catch { } // labels are drawn to canvas once: wait for the face
function label(text, color = '#f1e8d6') {
  const c = document.createElement('canvas'), g = c.getContext('2d'), size = 44;
  g.font = `500 ${size}px "DM Mono", monospace`; c.width = Math.ceil(g.measureText(text).width) + 24; c.height = size * 1.5;
  g.font = `500 ${size}px "DM Mono", monospace`; g.fillStyle = 'rgba(20,21,16,.8)'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, 12, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  s.scale.set(0.028 * c.width / c.height, 0.028, 1); s.renderOrder = 5; s.userData.fx = true;
  return s;
}
// the honest-scale reference: a 6-ft person standing in the next 5-ft square but one
const ref = new THREE.Group();
{
  const m = new THREE.MeshStandardMaterial({ color: '#7f8a6a', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 3.5, 6, 16), m); body.position.y = 2.47;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), m); head.position.y = 5.54;
  const sq = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]].map(([x, z]) => new THREE.Vector3(x, 0.03, z))), new THREE.LineBasicMaterial({ color: '#b9d45d' }));
  const l6 = label('6 ft person'); l6.position.set(0, 7.2, 0);
  const l5 = label('5 ft square', '#b9d45d'); l5.position.set(0, 0.05, 3.6);
  ref.add(body, head, sq, l6, l5);
}
scene.add(ref);
const origGroup = new THREE.Group(), convGroup = new THREE.Group();
origGroup.matrixAutoUpdate = convGroup.matrixAutoUpdate = false;
scene.add(origGroup, convGroup);

// a soft studio to reflect in metal finishes (the house rig has no environment map; without one, metal renders black)
const envTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 128); sky.addColorStop(0, '#fff2dc'); sky.addColorStop(0.42, '#9b9486'); sky.addColorStop(0.55, '#4a463c'); sky.addColorStop(1, '#1c1b17');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 128);
  for (const [x, y, r] of [[60, 34, 26], [190, 28, 20]]) { const b = g.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, 'rgba(255,250,235,1)'); b.addColorStop(1, 'rgba(255,250,235,0)'); g.fillStyle = b; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
})();

const panes = [{ canvas: $('#ca'), el: $('#paneA') }, { canvas: $('#cb'), el: $('#paneB') }];
for (const p of panes) {
  p.renderer = new THREE.WebGLRenderer({ canvas: p.canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('capture') });
  p.renderer.setPixelRatio(Math.min(2, devicePixelRatio)); p.renderer.outputColorSpace = THREE.SRGBColorSpace;
  p.renderer.shadowMap.enabled = true;
}
// the house lighting: the same module, post stack and day / night profiles the Spawn Tuner tunes and the game renders with
let houseLook = 'the house lighting';
const base = { hemi: hemi.intensity, sun: sun.intensity, sky: hemi.color.clone() };
try {
  const ver = await fetch('../tuner/version.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const L = await import(new URL(`../tuner/js/fx/lighting.js${ver.v ? `?v=${ver.v}` : ''}`, location.href).href);
  for (const p of panes) {
    hemi.intensity = base.hemi; sun.intensity = base.sun; hemi.color.copy(base.sky); // each rig measures its base from the lights as built
    p.lighting = L.createLighting({ renderer: p.renderer, scene, camera, hemi, sun });
  }
  S.profiles = L.LIGHT_BUILTINS;
} catch (err) { console.warn('house lighting unavailable, plain render', err); houseLook = 'PLAIN lighting (the house lighting module did not load)'; }
function applyLight() {
  if (!S.profiles) return;
  for (const p of panes) { hemi.intensity = base.hemi; sun.intensity = base.sun; hemi.color.copy(base.sky); p.lighting.set(S.profiles[S.light]()); }
  // the sun's own shadow: the profiles budget shadows for fires only; a model standing in daylight needs to sit on the ground
  for (const p of panes) p.renderer.shadowMap.enabled = true;
  dirty = 30;
}

// ---------------------------------------------------------------- camera (orbit; both panes always share it)
const cam = { yaw: -20, pitch: 52, dist: 95, target: new THREE.Vector3(0, 3, 0) };
let dirty = 30;
function placeCamera() {
  const y = THREE.MathUtils.degToRad(cam.yaw), p = THREE.MathUtils.degToRad(cam.pitch);
  camera.position.set(cam.target.x + Math.sin(y) * Math.cos(p) * cam.dist, cam.target.y + Math.sin(p) * cam.dist, cam.target.z + Math.cos(y) * Math.cos(p) * cam.dist);
  camera.lookAt(cam.target); camera.near = Math.max(0.05, cam.dist / 200); camera.far = cam.dist * 20 + 600; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  dirty = Math.max(dirty, 3);
}
function setView(name, keepYaw = true) {
  S.view = name;
  const H = S.heightFt, W = model ? model.footprint : 4;
  cam.target.set(0, H / 2, 0);
  if (!keepYaw) cam.yaw = -20;
  if (name === 'table') { cam.dist = 95; cam.pitch = 52; }
  else if (name === 'lean') { cam.dist = 30 + Math.max(0, Math.max(H, W) - 12); cam.pitch = 35; }
  else { cam.dist = Math.max(H, W) * 1.55 + 1; cam.pitch = 14; }
  placeCamera(); drawSeg(); $('#viewHint').textContent = VIEWS[name].hint;
}
{
  const stage = $('#stage'); let drag = null;
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('pointerdown', e => { if (e.target.tagName !== 'CANVAS') return; drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) {
      const k = cam.dist * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / panes[0].canvas.clientHeight;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      cam.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); cam.target.y = Math.max(0, cam.target.y);
    } else { cam.yaw -= dx * 0.35; cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.3, 2, 89); }
    placeCamera();
  });
  const end = () => { drag = null; }; stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', e => { e.preventDefault(); cam.dist = THREE.MathUtils.clamp(cam.dist * Math.pow(1.1, Math.sign(e.deltaY)), 1, 600); placeCamera(); }, { passive: false });
}

// ---------------------------------------------------------------- the scale wizard: tall, front, up, on the ground
function upMatrix(up) {
  const m = new THREE.Matrix4();
  if (up === 'z') m.makeRotationX(-Math.PI / 2); else if (up === '-z') m.makeRotationX(Math.PI / 2);
  else if (up === 'x') m.makeRotationZ(Math.PI / 2); else if (up === '-x') m.makeRotationZ(-Math.PI / 2);
  else if (up === '-y') m.makeRotationX(Math.PI);
  return m;
}
function placeModel() {
  if (!model) return;
  const R = new THREE.Matrix4().makeRotationY(S.turns * Math.PI / 2).multiply(upMatrix(S.up));
  const box = model.high.box.clone().applyMatrix4(R), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = S.heightFt / Math.max(size.y, 1e-9);
  const M = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)).multiply(R);
  origGroup.matrix.copy(M); convGroup.matrix.copy(M); origGroup.matrixWorldNeedsUpdate = convGroup.matrixWorldNeedsUpdate = true;
  model.unitsPerFoot = 1 / k; model.heightUnits = size.y; model.footprint = Math.max(size.x, size.z) * k; model.matrix = M;
  // the reference person: the nearest square that clears the model
  ref.position.set(5 * Math.max(1, Math.ceil((size.x * k / 2 + 1.2) / 5)), 0, 0);
  const reach = Math.max(S.heightFt, model.footprint, 8) * 1.6 + ref.position.x;
  sun.target.position.set(0, S.heightFt / 2, 0); sun.position.copy(sun.target.position).addScaledVector(SUN_FROM, reach * 3);
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: reach, far: reach * 6 }); sun.shadow.camera.updateProjectionMatrix();
  dirty = 30;
}

// ---------------------------------------------------------------- materials
function applyLook() {
  if (!model) return;
  const L = LOOKS[S.look];
  const dress = (root, own) => root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (own) return; // a coloured model keeps its own materials
    const m = o.material; m.color.set(L.color); m.roughness = L.roughness; m.metalness = L.metalness; m.envMap = L.env ? envTex : null; m.envMapIntensity = L.env; m.needsUpdate = true;
  });
  dress(origGroup, model.coloured); dress(convGroup, model.coloured);
  $('#lookRow').hidden = model.coloured;
  dirty = 30;
}

// ---------------------------------------------------------------- loading a model
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/'));
const status = (text) => { const el = $('#status'); el.hidden = !text; el.textContent = text || ''; return new Promise(r => requestAnimationFrame(() => setTimeout(r))); };
function toast(text, err = false) { const t = $('#toast'); t.textContent = text; t.hidden = false; t.classList.toggle('err', err); clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, err ? 7000 : 3200); }
function clearGroup(g) { for (const c of [...g.children]) { g.remove(c); c.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.normalMap?.dispose(); m.dispose(); } }); } }

function testShape(kind) { // the trivial cases the pipeline was built up from: a cube, then a bumpy ball
  if (kind === 'cube') return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 40, 40, 40));
  const g = new THREE.IcosahedronGeometry(1, 80), P = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).normalize(); const b = 1 + 0.035 * Math.sin(v.x * 23) * Math.sin(v.y * 23) * Math.sin(v.z * 23) + 0.02 * Math.sin(v.y * 61 + v.x * 7); P.setXYZ(i, v.x * b, v.y * b, v.z * b); }
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  return new THREE.Mesh(g);
}
const SAMPLES = {
  gnome: { label: 'Garden Gnome (coloured)', title: '28,858 triangles with painted textures. By Bhargav Kubal, Poly Haven, CC0.', url: 'samples/garden-gnome.glb', heightFt: 3, turns: 0, up: 'y' },
  ball: { label: 'Bumpy ball', title: 'A generated test shape: 128,000 triangles of small bumps', make: () => testShape('ball'), heightFt: 6 },
  sphere: { label: 'Smooth ball', hidden: true, make: () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 60)); m.geometry.deleteAttribute('normal'); m.geometry.deleteAttribute('uv'); return m; }, heightFt: 6 }, // ?sample=sphere: the baker's own test
  cube: { label: 'Cube', title: 'A generated test shape: the simplest thing that can go wrong', make: () => testShape('cube'), heightFt: 5 },
};

async function loadModel({ name, format, bytes, buffer, object, heightFt, turns = 0, up }) {
  if (busy) return toast('Still working on the last one');
  busy++;
  try {
    await status(`Reading ${name}…`);
    const t0 = performance.now();
    let root = object;
    if (!root) {
      if (format === 'stl') { const g = new STLLoader().parse(buffer); root = g.attributes.color ? new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true })) : new THREE.Mesh(g); }
      else if (format === 'obj') root = new OBJLoader().parse(new TextDecoder().decode(buffer));
      else if (format === 'glb') root = (await gltfLoader.parseAsync(buffer, '')).scene;
      else throw new Error(`.${format} is not a format this lab reads (STL, OBJ, GLB)`);
    }
    const parseMs = performance.now() - t0;
    const high = await ingest(root, (s) => status(`Reading ${name}: ${s}…`));
    clearGroup(origGroup); clearGroup(convGroup); cache.clear(); current = null;
    high.ingestMs += parseMs; // decoding the file is part of the cost
    model = { name, format, bytes, high, root, coloured: !!high.colour, parseMs };
    if (model.coloured) origGroup.add(root);
    else origGroup.add(new THREE.Mesh(highDisplayGeometry(high), new THREE.MeshStandardMaterial()));
    S.heightFt = heightFt || 6; S.turns = turns; S.up = up || (format === 'stl' ? 'z' : 'y');
    $('#height').value = S.heightFt;
    $('#modelName').textContent = `${name} · ${fmt(high.nt)} triangles · ${bytes ? mb(bytes) : 'generated'}${model.coloured ? ' · has colour' : ''}`;
    placeModel(); applyLook(); setView(S.view, false);
  } catch (err) { console.error(err); toast(`Could not read ${name}: ${err.message}`, true); status(''); busy--; return; }
  busy--;
  await runConvert();
}
async function loadFile(file) {
  const format = file.name.split('.').pop().toLowerCase();
  await loadModel({ name: file.name, format, bytes: file.size, buffer: await file.arrayBuffer() });
}
async function loadSample(id) {
  const s = SAMPLES[id]; if (!s) return;
  if (s.make) return loadModel({ name: s.label, format: 'generated', bytes: 0, object: s.make(), heightFt: s.heightFt, up: 'y' });
  await status(`Fetching ${s.label}…`);
  try {
    const r = await fetch(s.url); if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buffer = await r.arrayBuffer();
    await loadModel({ name: s.label, format: s.url.split('?')[0].split('.').pop(), bytes: buffer.byteLength, buffer, heightFt: s.heightFt, turns: s.turns, up: s.up });
  } catch (err) { status(''); toast(`Could not fetch ${s.label}: ${err.message}`, true); }
}

// ---------------------------------------------------------------- converting
async function runConvert() {
  if (!model || busy) return;
  const key = `${S.budget}|${S.bake ? S.tex : 0}`;
  let hit = cache.get(key);
  if (!hit) {
    busy++;
    try {
      const r = await convert(model.high, { budget: S.budget, bake: S.bake, texSize: S.tex }, (s) => status(`Converting to ${fmt(S.budget)} triangles: ${s}…`));
      // show the file itself: what was written is loaded back, so the right-hand side is exactly what would be kept
      const shown = (await gltfLoader.parseAsync(r.glb.slice(0), '')).scene;
      hit = { stats: r.stats, glb: r.glb, shown, mesh: r.mesh, key };
      cache.set(key, hit);
    } catch (err) { console.error(err); toast(`Conversion failed: ${err.message}`, true); status(''); busy--; return; }
    busy--;
  }
  if (key !== `${S.budget}|${S.bake ? S.tex : 0}`) return runConvert(); // the choice moved while we worked
  for (const c of [...convGroup.children]) convGroup.remove(c);
  convGroup.add(hit.shown); current = hit;
  applyLook(); status(''); drawReadout(); dirty = 30;
  window.__lab.conversions++;
}

function drawReadout() {
  const tb = $('#readout tbody'); tb.textContent = '';
  const row = (a, b, c) => { const tr = document.createElement('tr'); for (const x of [a, b, c]) { const td = document.createElement('td'); td.textContent = x; tr.append(td); } tb.append(tr); };
  if (!model) return;
  const h = model.high, s = current?.stats;
  row('Triangles', fmt(h.nt), s ? fmt(s.triangles) : '…');
  row('File size', model.bytes ? `${mb(model.bytes)} (${model.format.toUpperCase()})` : 'generated', s ? `${mb(s.glbBytes)} GLB` : '…');
  if (!s) return;
  row('Conversion time', '', secs(h.ingestMs + s.ms));
  const pct = (d) => { const p = d / model.heightUnits * 100; return p < 0.095 ? `${p.toFixed(3)}%` : `${p.toFixed(2)}%`; };
  row('Surface error', '', `${pct(s.error.mean)} typical, ${pct(s.error.max)} worst`);
  const ft = (d) => { const inches = d / model.unitsPerFoot * 12; return inches < 0.1 ? `${inches.toFixed(3)} in` : `${inches.toFixed(2)} in`; };
  const lines = [
    `Size: mesh ${mb(s.geometryBytes)}${s.bake ? ` + textures ${mb(s.textureBytes)} (PNG)` : ''}.${s.glbBytesWebp ? ` With WebP textures the same file is ${mb(s.glbBytesWebp)}.` : ''}`,
    `Time: reading and indexing the original ${secs(h.ingestMs)} (once per model), then ${Object.entries(s.phases).filter(([k]) => k !== 'measure').map(([k, v]) => `${k.replace('_', ' + ')} ${secs(v)}`).join(', ')}.`,
    `Error is the distance between the two surfaces as a share of the model's height: at ${S.heightFt} ft tall, typical ${ft(s.error.mean)}, worst ${ft(s.error.max)}.`,
    s.bake ? `Normal map ${s.texSize}×${s.texSize}: ${fmt(s.charts)} patches, ${Math.round(s.uvFill * 100)}% of the texture used${s.bakeMissed ? `, ${fmt(s.bakeMissed)} texels found no original surface` : ''}.` : 'No normal map: the shading comes from the triangles alone.',
    s.triangles > S.budget * 1.15 ? `Could not get under the budget: ${s.simplifier} stopped at ${fmt(s.triangles)}.` : (s.simplifier !== 'meshoptimizer simplify' ? `Note: ${s.simplifier}.` : ''),
  ];
  $('#detail').innerHTML = ''; for (const l of lines.filter(Boolean)) { const p = document.createElement('p'); p.textContent = l; p.style.margin = '5px 0'; $('#detail').append(p); }
  $('#download').disabled = false;
}

// ---------------------------------------------------------------- controls
function seg(id, options, get, set) {
  const el = $(id); el.textContent = '';
  for (const [value, text, title] of options) { const b = document.createElement('button'); b.textContent = text; b.dataset.v = value; if (title) b.title = title; b.addEventListener('click', () => { set(value); drawSeg(); }); el.append(b); }
  seg.all.push(() => { for (const b of el.children) b.classList.toggle('active', String(get()) === b.dataset.v); });
}
seg.all = [];
function drawSeg() { for (const f of seg.all) f(); $('#tex').parentElement.querySelectorAll('#tex button').forEach(b => { b.disabled = !S.bake; }); $('#stage').classList.toggle('flip', S.mode === 'flip'); tags(); }
seg('#budget', BUDGETS.map(b => [b, b >= 1000 ? `${b / 1000}k` : b, `${fmt(b)} triangles`]), () => S.budget, (v) => { S.budget = +v; runConvert(); });
seg('#tex', TEX.map(t => [t, t]), () => S.tex, (v) => { S.tex = +v; runConvert(); });
seg('#look', Object.entries(LOOKS).map(([k, v]) => [k, v.label]), () => S.look, (v) => { S.look = v; applyLook(); });
seg('#view', Object.entries(VIEWS).map(([k, v]) => [k, v.label, v.hint]), () => S.view, (v) => setView(v));
seg('#mode', [['side', 'Side by side'], ['flip', 'Flip (one view)']], () => S.mode, (v) => { S.mode = v; resize(); });
seg('#light', [['night', '☾ Night'], ['day', '☀ Day']], () => S.light, (v) => { S.light = v; applyLight(); });
$('#bake').checked = S.bake;
$('#bake').addEventListener('change', (e) => { S.bake = e.target.checked; drawSeg(); runConvert(); });
$('#height').addEventListener('change', (e) => { S.heightFt = THREE.MathUtils.clamp(+e.target.value || 6, 0.5, 200); e.target.value = S.heightFt; placeModel(); setView(S.view); drawReadout(); });
$('#turn').addEventListener('click', () => { S.turns = (S.turns + 1) % 4; placeModel(); });
$('#tip').addEventListener('click', () => { S.up = UPS[(UPS.findIndex(u => u[0] === S.up) + 1) % UPS.length][0]; placeModel(); setView(S.view); toast(UPS.find(u => u[0] === S.up)[1]); drawReadout(); });
for (const [id, s] of Object.entries(SAMPLES)) { if (s.hidden) continue; const b = document.createElement('button'); b.textContent = s.label; b.title = s.title; b.addEventListener('click', () => loadSample(id)); $('#samples').append(b); }
$('#pick').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; });
let dragDepth = 0;
addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; $('#drop').hidden = false; });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => { e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f); });
function tags() {
  const o = model ? ` · ${fmt(model.high.nt)} triangles` : '', c = current ? ` · ${fmt(current.stats.triangles)} triangles` : '';
  const a = $('#tagA'); a.textContent = S.swap ? `CONVERTED${c}` : `ORIGINAL${o}`; a.classList.toggle('conv', S.swap);
  $('#tagB').textContent = `CONVERTED${c}`;
}
const typing = (e) => /INPUT|TEXTAREA/.test(e.target.tagName);
addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (e.code === 'Space') { e.preventDefault(); if (!S.swap) { S.swap = true; tags(); dirty = 5; } }
  else if (e.key === '1') setView('table'); else if (e.key === '2') setView('lean'); else if (e.key === '3') setView('close');
  else if (e.key === 'f' || e.key === 'F') { S.mode = S.mode === 'flip' ? 'side' : 'flip'; drawSeg(); resize(); }
});
addEventListener('keyup', (e) => { if (e.code === 'Space') { S.swap = false; tags(); dirty = 5; } });
addEventListener('blur', () => { S.swap = false; tags(); dirty = 5; });

$('#download').addEventListener('click', async () => {
  if (!current) return;
  // the downloaded file carries the size and facing chosen here (feet, +Y up), not the raw model units
  const holder = new THREE.Group(); holder.name = model.name; const m = current.mesh.clone(); m.applyMatrix4(model.matrix); holder.add(m);
  const glb = await exportGLB(holder);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  a.download = `${model.name.replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-')}-${S.budget / 1000}k${S.bake ? `-nm${S.tex}` : ''}.glb`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

// ---------------------------------------------------------------- the verdict goes back as data
function record(verdict) {
  const s = current?.stats, h = model?.high;
  return {
    verdict, model: model && { name: model.name, format: model.format, bytes: model.bytes, triangles: h.nt, coloured: model.coloured },
    settings: { budget: S.budget, bake: S.bake, texSize: S.bake ? S.tex : null, look: model?.coloured ? 'own colours' : S.look, view: S.view, mode: S.mode, light: S.light, heightFt: S.heightFt, turns: S.turns, up: S.up },
    result: s && { triangles: s.triangles, vertices: s.vertices, glbBytes: s.glbBytes, glbBytesWebp: s.glbBytesWebp ?? null, convertMs: s.ms, ingestMs: Math.round(h.ingestMs), phases: s.phases, errorMeanPctHeight: +(s.error.mean / model.heightUnits * 100).toFixed(4), errorMaxPctHeight: +(s.error.max / model.heightUnits * 100).toFixed(4), charts: s.charts ?? null, simplifier: s.simplifier },
    camera: { yaw: +cam.yaw.toFixed(1), pitch: +cam.pitch.toFixed(1), dist: +cam.dist.toFixed(1), pxTall: pxTall() },
    lighting: houseLook, screen: { w: panes[0].canvas.clientWidth, h: panes[0].canvas.clientHeight, dpr: devicePixelRatio }, ua: navigator.userAgent,
  };
}
async function sendVerdict(verdict) {
  if (!model || !current) return toast('Load a model first', true);
  const name = model.name.replace(/[^A-Za-z0-9 ._-]+/g, '-').slice(0, 100) || 'model';
  try {
    const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'import_lab', name, note: $('#note').value, data: record(verdict) }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.err || r.status);
    $('#sent').textContent = `Sent ${new Date().toLocaleTimeString()}: "${verdict === 'fine' ? 'looks fine' : 'not good enough'}" at ${fmt(S.budget)} triangles${S.bake ? `, normal map ${S.tex}` : ', no normal map'}, ${VIEWS[S.view].label.toLowerCase()}.`;
    toast('Verdict sent. Thank you.'); $('#note').value = '';
  } catch (err) { toast(`Could not send the verdict: ${err.message}`, true); }
}
$('#fine').addEventListener('click', () => sendVerdict('fine'));
$('#bad').addEventListener('click', () => sendVerdict('not_good_enough'));

// ---------------------------------------------------------------- drawing
function pxTall() { // how tall the model is on screen right now, in CSS pixels
  const a = new THREE.Vector3(0, 0, 0).project(camera), b = new THREE.Vector3(0, S.heightFt, 0).project(camera);
  return Math.round(Math.abs(b.y - a.y) / 2 * panes[0].canvas.clientHeight);
}
function resize() {
  drawSeg();
  for (const p of panes) {
    const w = p.el.clientWidth, h = p.el.clientHeight; if (!w || !h) continue;
    p.renderer.setSize(w, h, false); p.lighting?.setSize(w, h);
  }
  camera.aspect = panes[0].el.clientWidth / Math.max(1, panes[0].el.clientHeight); camera.updateProjectionMatrix(); dirty = 30;
}
new ResizeObserver(resize).observe($('#stage'));
let lastT = performance.now();
function draw(p, showConverted, now, dt) {
  origGroup.visible = !showConverted; convGroup.visible = showConverted;
  if (p.lighting) { p.lighting.frame(now); p.lighting.markDirty(); p.lighting.render(dt); } else p.renderer.render(scene, camera);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = now - lastT; lastT = now;
  if (dirty <= 0) return; dirty--;
  draw(panes[0], S.swap && !!current, now, dt);
  if (S.mode === 'side') draw(panes[1], true, now, dt);
  $('#hud').textContent = model ? `${VIEWS[S.view].label}: the model is about ${pxTall()} px tall on your screen · ${houseLook}, ${S.light}` : '';
  window.__lab.frames++;
}

window.__lab = { S, cam, panes, sun, scene, frames: 0, conversions: 0, get model() { return model; }, get current() { return current; }, get busy() { return busy; }, setView, runConvert, loadSample, loadFile, record, redraw: () => { dirty = 30; }, placeCamera, set(k, v) { S[k] = v; drawSeg(); } };
applyLight(); resize(); setView(S.view, false); drawReadout(); requestAnimationFrame(frame);
if (qs.has('clean')) document.body.classList.add('clean'); // test shots with no labels in the picture (blind comparisons)
const first = qs.get('sample') === 'none' ? 'none' : SAMPLES[qs.get('sample')] ? qs.get('sample') : 'gnome'; // the Stanford Dragon sample was removed 2026-10-21 (non-commercial terms); old ?sample=dragon links get the gnome
if (first !== 'none') loadSample(first);
