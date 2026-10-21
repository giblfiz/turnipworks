// THE FIGURE SCALE BENCH (2026-10-12, figures.html). Harry: "The minis are mostly too big. To scale a hero/guard to a
// chair correctly I have to make the chair about 150% size." One dial: a factor on every figure in the game (the game's
// own figure code draws them here: engine/client/figures.js, FIGURE_SCALE). A hero, a guard and a townsperson stand by a
// door, a chair, a table and a bed drawn at their catalog sizes (the room engine's rule: largest side to largest side;
// a door leaf fills its 3 ft x 6 ft 8 opening), under a 9 ft wall on 5 ft squares. The readout is in feet, measured from
// what is drawn. "Use in game" stores { scale } as the house look `figures` (GET /tuner/house); the game reads it on load.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { houseLink } from './fx/houselink.js';

const FIGS = [{ id: 'hero-fighter-human-m', x: -8, label: 'Hero (fighter)' }, { id: 'town-human-guard', x: -2, label: 'Guard' }, { id: 'town-human-commoner-f', x: 4.4, label: 'Townsperson' }];
const PROPS = [{ id: 'chair-plain', sku: 'chair-plain--common--s2', x: -5, z: 0, yaw: 0, real: 'seat 1.5 ft' }, { id: 'table-square', sku: 'table-square--common--s4', x: 1.2, z: 0, real: 'top 2.5 ft' }, { id: 'bed-single', sku: 'bed-single--common--s2', x: 8.4, z: 0.4, real: '6.5 ft long' }];
const DOOR = { w: 3, h: 80 / 12, x: -8, z: -3.2 }, WALL_H = 9, KNEE = 0.26; // the back of the knee, as a share of standing height

export async function start({ v = null } = {}) {
  const qs = new URLSearchParams(location.search), api = qs.get('api') ?? '/api/tw-ratings', q = v ? `?v=${v}` : `?t=${Date.now()}`;
  const $ = (s) => document.querySelector(s), stage = $('#fsStage');
  const toastEl = $('#fsToast'); let toastT = 0;
  const toast = (t, bad) => { toastEl.textContent = t; toastEl.style.display = 'block'; toastEl.style.color = bad ? '#e0b04a' : ''; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.display = 'none'; }, 5000); };
  const [F, lib, list] = await Promise.all([import(new URL(`../../engine/client/figures.js${q}`, import.meta.url).href), fetch(`data/library.json${q}`).then(r => r.json()), fetch(`data/figures.json${q}`).then(r => r.json()).then(j => j.figures || [])]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#23241f');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 600), ctl = new OrbitControls(camera, renderer.domElement);
  scene.add(new THREE.HemisphereLight('#fff4dc', '#3a3428', 1.5));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.4); sun.position.set(14, 30, 22); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 }); scene.add(sun);
  // the floor: 5 ft squares; the wall: 9 ft, with a door's opening
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 25), new THREE.MeshStandardMaterial({ color: '#6f5a40', roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(40, 8, '#2c241a', '#2c241a'); grid.position.set(0, 0.01, 0); grid.scale.z = 1; scene.add(grid);
  const wallMat = new THREE.MeshStandardMaterial({ color: '#8d877a', roughness: 0.9 });
  const slab = (x0, x1, y0, y1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.6), wallMat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, DOOR.z); m.castShadow = m.receiveShadow = true; scene.add(m); };
  slab(-15, DOOR.x - DOOR.w / 2, 0, WALL_H); slab(DOOR.x + DOOR.w / 2, 15, 0, WALL_H); slab(DOOR.x - DOOR.w / 2, DOOR.x + DOOR.w / 2, DOOR.h, WALL_H);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w, DOOR.h), new THREE.MeshBasicMaterial({ color: '#0c0b09' })); dark.position.set(DOOR.x, DOOR.h / 2, DOOR.z - 0.25); scene.add(dark);

  const loader = new GLTFLoader(), glb = new Map();
  const loadGLB = (url) => { if (!glb.has(url)) glb.set(url, loader.loadAsync(url).then(g => g.scene)); return glb.get(url); };
  const down = new THREE.Raycaster(), surfaceAt = (obj, x, y, z) => { down.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0)); const h = down.intersectObject(obj, true)[0]; return h ? h.point.y : null; };
  // the furniture, by the room engine's rule: one scale, largest catalog side to the mesh's largest side
  const furn = {};
  const props = PROPS.map(async (p) => {
    const o = lib.objects[p.id], rec = o.skus.find(s => s.sku === p.sku) || o.skus.find(s => s.kind === 'mesh' && s.url), m = (await loadGLB(rec.url)).clone(true), g = new THREE.Group();
    const b0 = new THREE.Box3().setFromObject(m), s0 = b0.getSize(new THREE.Vector3()), k = Math.max(...o.size) / 12 / Math.max(s0.x, s0.y, s0.z);
    m.scale.setScalar(k); m.position.set(-(b0.min.x + b0.max.x) / 2 * k, -b0.min.y * k, -(b0.min.z + b0.max.z) / 2 * k); m.traverse(c => { if (c.isMesh) c.castShadow = c.receiveShadow = true; });
    g.add(m); g.position.set(p.x, 0, p.z); scene.add(g); g.updateMatrixWorld(true);
    const size = s0.clone().multiplyScalar(k);
    furn[p.id] = { size: [size.x, size.y, size.z], top: surfaceAt(g, p.x, p.id === 'chair-plain' ? size.y * 0.72 : size.y + 1, p.z + (p.id === 'chair-plain' ? 0 : 0)), catalog: o.size.map(i => i / 12), real: p.real };
    if (p.id === 'chair-plain' && furn[p.id].top == null) furn[p.id].top = surfaceAt(g, p.x + 0.2, size.y * 0.72, p.z + 0.2);
  });
  // the door's leaf, open against the wall beside its opening: it fills the opening, as the wall kit makes it
  props.push((async () => { const o = lib.objects['door-plank'], rec = o.skus.find(s => s.sku === 'door-plank--leaf') || o.skus[0], m = (await loadGLB(rec.url)).clone(true), b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3());
    const wide = s.x >= s.z; m.scale.set(wide ? DOOR.w / s.x : 1, DOOR.h / s.y, wide ? 1 : DOOR.w / s.z); const g = new THREE.Group(); m.position.set(-(b.min.x + b.max.x) / 2 * m.scale.x, -b.min.y * m.scale.y, -(b.min.z + b.max.z) / 2 * m.scale.z); g.add(m);
    g.rotation.y = wide ? Math.PI / 2 : 0; g.position.set(DOOR.x + DOOR.w / 2 + 0.15, 0, DOOR.z + DOOR.w / 2 + 0.3); m.traverse(c => { if (c.isMesh) c.castShadow = true; }); scene.add(g);
    furn['door-plank'] = { size: [DOOR.w, DOOR.h, 0.25], top: DOOR.h, catalog: o.size.map(i => i / 12), real: '6.7 ft x 3 ft' }; })());

  // the figures: the game's own code and the game's own files
  const figures = F.createFigures({ list, base: '', look: { loadGLB, texBytes: new Map() }, shadows: () => true });
  const colors = ['#d9a441', '#5aa9e6', '#c96bd0'], stand = [];
  for (const [i, f] of FIGS.entries()) {
    const vis = figures.pawnVisual({ fig: f.id }, { color: colors[i] }); if (!vis) continue;
    vis.position.set(f.x, 0, 0); scene.add(vis); figures.setNameOn?.(vis, f.label.split(' ')[0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffe14d' })); ring.rotation.x = Math.PI / 2; vis.add(ring);
    stand.push({ ...f, vis, ring });
  }
  await Promise.all([...props, ...stand.map(s => s.vis.userData.ready)]);

  // ---------- the dial ----------
  const slider = $('#fsScale'), big = $('#fsBig'), copy = $('#fsCopy'); [slider.min, slider.max] = F.FIGURE_SCALE_RANGE;
  let house = null;
  const cur = () => ({ scale: +figures.scale().toFixed(2) });
  const ft = (x) => x == null ? '?' : `${x.toFixed(2)} ft`;
  function rows() {
    return stand.map(s => { const m = figures.measure(s.vis), h = m.height_ft; return { id: s.id, label: s.label, stated_ft: m.stated_ft, drawn_ft: h, head_top_ft: +(m.disc_top_ft + h).toFixed(3), knee_ft: +(m.disc_top_ft + h * KNEE).toFixed(3), knee_above_feet_ft: +(h * KNEE).toFixed(3), base_width_ft: m.base_width_ft, feet_above_disc_ft: m.feet_above_disc_ft, door_clear_ft: +(DOOR.h - (m.disc_top_ft + h)).toFixed(3) }; });
  }
  function draw() {
    const K = figures.scale(); big.textContent = K.toFixed(2); slider.value = K; copy.value = `figures.scale = ${K.toFixed(2)}   (engine/client/figures.js FIGURE_SCALE is ${F.FIGURE_SCALE})`;
    for (const s of stand) { const U = s.vis.userData, h = (U.rawHeight ?? U.figure.h) * K; s.ring.position.y = F.DISC_H + h * KNEE; s.ring.scale.setScalar(Math.max(0.55, h * 0.17)); }
    const R = rows(), seat = furn['chair-plain']?.top, top = furn['table-square']?.top;
    $('#fsFigs').innerHTML = `<tr><th>figure</th><th>made</th><th>drawn</th><th>knee</th><th>under the door</th></tr>` + R.map(r => `<tr><td>${r.label}</td><td>${ft(r.stated_ft)}</td><td><b>${ft(r.drawn_ft)}</b></td><td class="${seat != null && Math.abs(r.knee_above_feet_ft - seat) < 0.2 ? 'ok' : 'warn'}">${ft(r.knee_above_feet_ft)}</td><td class="${r.door_clear_ft > 0 ? 'ok' : 'warn'}">${r.door_clear_ft > 0 ? `clears by ${ft(r.door_clear_ft)}` : `too tall by ${ft(-r.door_clear_ft)}`}</td></tr>`).join('');
    $('#fsFurn').innerHTML = `<tr><th>furniture</th><th>drawn</th><th>a real one</th></tr>` + [['chair-plain', 'Chair', (f) => `seat ${ft(f.top)}, ${ft(f.size[1])} tall, ${ft(Math.min(f.size[0], f.size[2]))} wide`], ['table-square', 'Table', (f) => `top ${ft(f.top)}`], ['door-plank', 'Door', (f) => `${ft(f.size[1])} x ${ft(f.size[0])}`], ['bed-single', 'Bed', (f) => `${ft(Math.max(f.size[0], f.size[2]))} long`]].map(([id, n, fn]) => furn[id] ? `<tr><td>${n}</td><td>${fn(furn[id])}</td><td class="muted">${furn[id].real}</td></tr>` : '').join('') + `<tr><td>Base</td><td>${ft(R[0]?.base_width_ft)} across, ${ft(F.DISC_H)} thick</td><td class="muted">one 5 ft square</td></tr>`;
    link?.changed();
  }
  function set(k) { figures.setScale(k); draw(); try { localStorage.setItem('tw.figbench.scale', String(figures.scale())); } catch { } }
  slider.addEventListener('input', () => set(+slider.value));
  for (const b of document.querySelectorAll('[data-k]')) b.addEventListener('click', () => set(+b.dataset.k));

  // ---------- cameras ----------
  const see = (pos, at) => { camera.position.set(...pos); ctl.target.set(...at); ctl.update(); };
  const views = { table: () => see([0, 62, 40], [0, 1, 0]), close: () => see([-1, 6.2, 17], [-4.4, 2.6, 0]), door: () => see([-3, 5.5, 14], [-7, 3.2, -1]) };
  $('#fsSeeTable').addEventListener('click', views.table); $('#fsSeeClose').addEventListener('click', views.close); $('#fsSeeDoor').addEventListener('click', views.door);
  const fit = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
  addEventListener('resize', fit); fit(); views.close();
  renderer.setAnimationLoop(() => { figures.faceNames?.(stand.map(s => s.vis), camera); renderer.render(scene, camera); });

  // ---------- Send, and Use in game (the house look `figures`) ----------
  const post = (body) => fetch(`${api}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json().catch(() => ({})); });
  const link = houseLink({ api, key: 'figures', label: 'figure scale', sendBtn: $('#fsSend'), houseBtn: $('#fsHouse'), current: cur, norm: (p) => ({ scale: +F.figureScaleOf(p).toFixed(2) }), toast });
  $('#fsSend').addEventListener('click', async () => { const n = `figure scale ${cur().scale}`; try { await post({ kind: 'note', name: n, note: 'figure scale bench', data: { figures: cur() } }); link.sent(n); } catch (e) { toast(`could not send: ${e.message}`, true); } });
  $('#fsHouse').addEventListener('click', async () => { const n = `figure scale ${cur().scale}`; try { await post({ kind: 'house', name: 'house', note: `figures "${n}" is now the game's house look`, data: { figures: { ...cur(), name: n } } }); link.used(n); } catch (e) { toast(`could not set the house look: ${e.message}`, true); } });
  // start: what this browser last had on the dial, else what the game uses, else the built-in
  try { house = await fetch(`${api}/tuner/house`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null); } catch { }
  let k0 = null; try { k0 = +localStorage.getItem('tw.figbench.scale') || null; } catch { }
  figures.setScale(qs.get('scale') ? +qs.get('scale') : k0 ?? house?.figures ?? F.FIGURE_SCALE); draw();
  window.__figbench = { ready: true, set, scale: () => figures.scale(), rows, furniture: () => JSON.parse(JSON.stringify(furn)), views, house: () => link.state(), builtin: F.FIGURE_SCALE, knee: KNEE };
}
