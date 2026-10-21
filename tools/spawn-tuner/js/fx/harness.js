// fx.html harness: develop LIGHTING + FIRE without touching main.js.
//   fx.html                 -> the real tuner (same as index.html since integration, 2026-10-02)
//   fx.html?mode=trivial    -> one hearth in an empty room, built here (the build ladder's trivial case)
// Both drive the same createFx() that main.js will call once integrated.
import * as THREE from 'three';
import { gltfLoader } from '../gltf.js';
import { createFx } from './index.js';

const qs = new URLSearchParams(location.search);
const API = qs.get('api') || '/api/tw-ratings';
const toast = (msg, err) => { const t = document.querySelector('#toast'); if (!t) return console.log(msg); t.textContent = msg; t.hidden = false; t.classList.toggle('err', !!err); clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3500); };

if (qs.get('mode') === 'trivial') await trivial();
else await tunerMode();

async function tunerMode() { // main.js now builds the FX itself (createFx); this page is just the tuner
  await import('../main.js');
}

async function trivial() {
  document.body.dataset.mode = 'trivial';
  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('capture') });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1d1f1a');
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
  const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7);
  const sun = new THREE.DirectionalLight('#fff1dc', 1.9); sun.position.set(-60, 120, -40);
  scene.add(hemi, sun);
  // a 20 x 15 ft room: plank-coloured floor, three stone-coloured walls (the camera side is open, like the cut-away)
  const floorMat = new THREE.MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.9 }), wallMat = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, 0.2, 15), floorMat); floor.position.set(10, -0.1, 7.5); scene.add(floor);
  for (const [w, d, x, z] of [[20, 1, 10, -0.5], [1, 15, -0.5, 7.5], [1, 15, 20.5, 7.5]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), wallMat); m.position.set(x, 4.5, z); scene.add(m); }
  // a table and a stool so the shadows have something to fall from
  const wood = new THREE.MeshStandardMaterial({ color: '#5b3d24', roughness: 0.8 });
  const table = new THREE.Group(); const top = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 3), wood); top.position.y = 2.5; table.add(top);
  for (const [x, z] of [[-2.2, -1.2], [2.2, -1.2], [-2.2, 1.2], [2.2, 1.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.5, 0.3), wood); l.position.set(x, 1.25, z); table.add(l); }
  table.position.set(10, 0, 7); scene.add(table);
  const loader = gltfLoader();
  const items = [];
  async function place(id, url, dims, bounds, x, y, z, rot = 0) {
    const g = (await loader.loadAsync(url)).scene;
    const k = Math.max(...dims) / Math.max(...bounds);
    g.scale.setScalar(k);
    g.userData.meshRoot = true;
    const group = new THREE.Group(); group.add(g); group.position.set(x, y, z); group.rotation.y = rot; scene.add(group);
    const it = { group, visual: g, spec: { id, uid: id + items.length, dims, sku: url.split('/').pop().replace('.glb', '') }, rest: { x, y, z, rot } };
    group.userData.item = it; items.push(it); return it;
  }
  const hearth = await place('fireplace-wall', 'assets/m/fireplace-wall--common.glb', [5, 5.1, 2.7], [1.01257, 1.03309, 0.55089], 10, 0, 1.35);
  if (qs.has('nohearth')) hearth.group.children[0].visible = false; // debug: the flame volume alone
  if (qs.has('candles')) {
    await place('candlestick', 'assets/m/candlestick--common.glb', [0.33, 1, 0.33], [0.7478, 1.00974, 0.88464], 9, 2.62, 7);
    await place('candlestick', 'assets/m/candlestick--common.glb', [0.33, 1, 0.33], [0.7478, 1.00974, 0.88464], 11, 2.62, 7);
  }
  const fx = createFx({ renderer, scene, camera, hemi, sun, items: () => items, api: API, toast, focus: () => new THREE.Vector3(10, 0, 5) });
  window.fx = fx;
  const view = qs.get('view') || 'table';
  // table distance: the tuner's G view (~3/4 at ~40 ft); close: hearth fills a third of the frame
  const views = { table: [[10, 26, 34], [10, 1.5, 5]], close: [[10, 4.6, 6.8], [10, 2.0, 1.3]], top: [[10, 55, 9], [10, 0, 7]], candle: [[10, 4.6, 11.5], [10, 2.9, 7]] };
  const [eye, at] = views[view] || views.table;
  camera.position.set(...eye); camera.lookAt(...at);
  window.setView = (v) => { const [e, t] = views[v] || views.table; camera.position.set(...e); camera.lookAt(...t); };
  function resize() { const r = document.querySelector('#stage').getBoundingClientRect(); renderer.setSize(r.width, r.height, false); fx.setSize(r.width, r.height); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(document.querySelector('#stage')); resize();
  let last = performance.now(); const samples = [];
  function frame(now) {
    const dt = Math.min(100, now - last); last = now; samples.push(dt); if (samples.length > 120) samples.shift();
    fx.frame(dt, now); fx.render(dt);
    const s = fx.stats(); const el = document.querySelector('#fps'); if (el) el.textContent = `${(1000 / (samples.reduce((a, b) => a + b, 0) / samples.length)).toFixed(0)} fps · ${s.frame_draw_calls} calls · ${s.frame_triangles} tris · ${s.programs} shaders`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
}
