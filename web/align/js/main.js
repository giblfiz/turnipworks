// Alignment Bench (Turnip Works, 2026-10-04). Harry: "I probably need a 'fire alignment tuner' for objects that have
// fire. This will almost definitely need to extend to water as well … (fire/water and probably open/shut)."
// One object at a time, big, isolated, at its true orientation (mesh-keyed orient), with a small view at table
// distance. Three modes, each with its own queue: Fire (flame anchors), Water (a water surface), Open/Shut (a hinge, or
// an aligned swap to the "-open" twin). Every item starts from an automatic guess; Enter says "looks right", saves and
// moves on. Records go to the ratings server, keyed by MESH: fire_anchor (the tuner and the game read them at load),
// water_surface (for the future water renderer), hinge (the game's open/close reads them through look.js).
// The look, fire and hinge code is the deployed Spawn Tuner's own (../tuner/js/, the stamped build named in
// ../tuner/version.json), exactly as the game imports it, so what the bench shows is what the game draws.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { buildQueues } from './queues.js';
import { createFireMode } from './mode-fire.js';
import { createWaterMode } from './mode-water.js';
import { createOpenMode } from './mode-open.js';

const qs = new URLSearchParams(location.search);
// the tuner's URL resolved against the PAGE (a dynamic import() would resolve a relative path against this module)
const TUNER = new URL(/^[./a-z0-9-]+\/$/i.test(qs.get('tuner') || '') ? qs.get('tuner') : '../tuner/', location.href).href;
const API = '/api/tw-ratings';
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } },
};
let toastT = null;
function toast(msg, bad = false) {
  const t = $('toast'); t.textContent = msg; t.hidden = false; t.classList.toggle('bad', bad);
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 4000 : 1800);
}
const getJSON = (u, opt) => fetch(u, opt).then(r => (r.ok ? r.json() : null)).catch(() => null);

// ---------------------------------------------------------------- the tuner's own code and data
let ver = null;
try { ver = (await getJSON(`${TUNER}version.json?t=${Date.now()}`, { cache: 'no-store' }))?.v || null; } catch { }
const q = ver ? `?v=${ver}` : '';
const [look, fireMod, hinge, fxUtil] = await Promise.all(['look.js', 'fx/fire.js', 'hinge.js', 'fx/util.js'].map(f => import(`${TUNER}js/${f}${q}`)));
const [lib, types, orientFile, fireAuto, orientRecs, house] = await Promise.all([
  getJSON(`${TUNER}data/library.json${q}`), getJSON(`${TUNER}data/rooms.json${q}`), getJSON(`${TUNER}data/orient.json${q}`),
  getJSON(`${TUNER}data/fire_anchors.json${q}`), getJSON(`${API}/tuner/orient`, { cache: 'no-store' }), getJSON(`${API}/tuner/house`, { cache: 'no-store' })]);
const orient = { ...(orientFile || {}), ...look.orientFromServer(lib, orientRecs || {}) };
const L = look.createLook({ lib, types, orient, base: TUNER, dials: () => look.LOOK_DIALS });
// the tool sweep's declared water vessels and openables (written on every tuner deploy; absent = the rules alone)
const benchLists = await getJSON(new URL('../queues/bench.json', location.href).href + `?t=${Date.now()}`, { cache: 'no-store' });
const Q = buildQueues(lib, fireAuto || {}, { fireType: fireMod.fireType, bench: benchLists || {} });
const MODES = ['fire', 'water', 'open'];
const KIND = { fire: 'fire_anchor', water: 'water_surface', open: 'hinge' };
const ROUTE = { fire: 'fire_anchors', water: 'water_surfaces', open: 'hinges' };

// ---------------------------------------------------------------- scene, two views
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#1d1f1a');
const hemi = new THREE.HemisphereLight('#e2d8c4', '#3a3428', 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 1.5); sun.position.set(-5, 9, 7); scene.add(sun);
const LAYER = { context: 1, helpers: 2 }; // context (floor, person): table view only; helpers (dots, pivots): main view only
const ctxGroup = new THREE.Group(); scene.add(ctxGroup);
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#33362c', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.layers.set(LAYER.context); ctxGroup.add(floor);
  const grid = new THREE.GridHelper(60, 12, '#55594a', '#45483c'); grid.layers.set(LAYER.context); ctxGroup.add(grid); // 5-ft cells
  const person = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 4.4, 4, 10), new THREE.MeshStandardMaterial({ color: '#7d8a9c', roughness: 0.9 }));
  person.position.y = 0.65 + 2.2; person.layers.set(LAYER.context); person.name = 'person'; ctxGroup.add(person); // 5 ft 9 in, for scale
}
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
camera.layers.enable(LAYER.helpers);
const tableCam = new THREE.PerspectiveCamera(30, 4 / 3, 0.5, 400);
tableCam.layers.enable(LAYER.context);

// pointer arbitration: the mode gets the press first (handles: dots, the water surface); otherwise the press orbits,
// and a press that never moved is a click (add a flame, snap a hinge). Registered BEFORE OrbitControls so it runs first.
let press = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!mode || !cur) return;
  press = { x: e.clientX, y: e.clientY, button: e.button, handle: false };
  if (e.button === 0 && mode.pointerdown?.(e)) {
    press.handle = true; controls.enabled = false; canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing');
    e.stopImmediatePropagation(); e.preventDefault();
  }
});
canvas.addEventListener('pointermove', (e) => { if (press?.handle) { mode.pointermove?.(e); e.stopImmediatePropagation(); } });
canvas.addEventListener('pointerup', (e) => {
  const p = press; press = null; if (!p) return;
  if (p.handle) { controls.enabled = true; canvas.classList.remove('grabbing'); mode.pointerup?.(e); changed(); e.stopImmediatePropagation(); return; }
  if (p.button === 0 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) mode.click?.(e);
});
canvas.addEventListener('dblclick', () => frameItem());
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12; controls.screenSpacePanning = true;

// ---------------------------------------------------------------- the fire system (the tuner's, at the game's house look)
const fire = fireMod.createFire({ scene, camera, meshOf: (spec) => lib.objects[spec.id]?.skus.find(k => k.sku === spec.sku)?.mesh || null });
fire.set(fxUtil.mergeDefaults(fireMod.FIRE_DEFAULTS, house?.fire || fireMod.FIRE_DEFAULTS));
fire.setDance(0.35);

// ---------------------------------------------------------------- records (latest per mesh, per mode)
const recs = { fire: {}, water: {}, open: {} };
async function loadRecs() {
  const got = await Promise.all(MODES.map(m => getJSON(`${API}/tuner/${ROUTE[m]}`, { cache: 'no-store' })));
  MODES.forEach((m, i) => { recs[m] = got[i] || {}; });
  const over = {};
  for (const [k, r] of Object.entries(recs.fire)) if (r?.data?.anchors) over[k] = { anchors: r.data.anchors, ...(r.data.light && { light: r.data.light }), src: 'override' };
  fire.setAnchors(fireAuto || {}, over);
}
const statusOf = (m, e) => { const r = recs[m][e.mesh]; return !r ? 'none' : r.data?.aligned ? 'ok' : 'saved'; };
const recordOf = (m, e) => recs[m][e.mesh] || null;

// ---------------------------------------------------------------- items: the tuner's makeVisual, catalog-sized
function specOf(e, extra = {}) {
  const [w, d, h] = (e.size || [24, 24, 24]).map(v => v / 12), dims = [w, h, d];
  const s = Math.max(...dims) / Math.max(...e.bounds);
  return { id: e.id, sku: e.sku, url: e.url, kind: 'mesh', place: e.place, dims, s: [s, s, s], yaw: 0, y: 0, ...extra };
}
const meshRootOf = (v) => { let r = null; v?.traverse(o => { if (!r && o.userData.meshRoot) r = o; }); return r || v; };
function accelerate(v) { v.traverse(o => { if (o.isMesh && o.geometry?.attributes?.position && !o.userData.hingePart) { if (!o.geometry.boundsTree) computeBoundsTree.call(o.geometry); o.raycast = acceleratedRaycast; } }); }
async function makeVisual(spec) { const v = await L.makeVisual(spec, false); accelerate(v); return v; }

let mode = null, modeKey = null, cur = null, loadSeq = 0;
const modes = {};
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const ctx = {
  THREE, scene, camera, canvas, renderer, look: L, lib, fire, hinge, orient, LAYER, toast, api: API, panel: $('panel'),
  specOf, makeVisual, meshRootOf,
  cur: () => cur,
  record: () => (cur ? recordOf(modeKey, cur.entry) : null),
  setRay(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray; },
  hit(e, obj) { ctx.setRay(e); return ray.intersectObject(obj || cur.it.group, true).find(h => h.object.isMesh && h.object.visible && !h.object.userData.helper) || null; },
  screenOf(w) { const v = w.clone().project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  replaceVisual(v) { const it = cur.it; it.group.remove(it.visual); it.visual = v; it.group.add(v); cur.root = meshRootOf(v); },
  changed: () => changed(),
};
for (const [k, f] of [['fire', createFireMode], ['water', createWaterMode], ['open', createOpenMode]]) modes[k] = f(ctx);

async function openEntry(entry) {
  const seq = ++loadSeq;
  if (cur) { await autosave(); mode.close?.(); scene.remove(cur.it.group); cur = null; }
  $('done').hidden = !!entry; $('busy').hidden = !entry;
  paintHeader(entry); paintList();
  if (!entry) { $('panel').innerHTML = ''; return; }
  let visual;
  try { visual = await makeVisual(specOf(entry)); } catch (err) { if (seq === loadSeq) { $('busy').hidden = true; toast(`could not load ${entry.sku}: ${err.message || err}`, true); } return; }
  if (seq !== loadSeq) return; // the user moved on while it loaded
  const group = new THREE.Group(); group.add(visual); scene.add(group);
  const it = { spec: specOf(entry), group, visual, rest: { x: 0, y: 0, z: 0 }, tag: entry.sku };
  cur = { entry, it, root: meshRootOf(visual) };
  group.updateMatrixWorld(true);
  frameItem();
  await mode.open(entry, cur);
  if (seq !== loadSeq) return;
  $('busy').hidden = true;
  store.set(`align.last.${modeKey}`, entry.sku);
  const u = new URL(location.href); u.searchParams.set('mode', modeKey); u.searchParams.set('sku', entry.sku); history.replaceState(null, '', u);
  paintStatus(); paintList();
}

function frameItem() {
  if (!cur) return;
  const box = new THREE.Box3().setFromObject(cur.it.group), sph = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(0.3, sph.radius), dist = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.08;
  const dir = new THREE.Vector3(0.55, 0.42, 1).normalize();
  controls.target.copy(sph.center); camera.position.copy(sph.center).addScaledVector(dir, dist);
  camera.near = Math.max(0.02, dist / 200); camera.far = dist * 20; camera.updateProjectionMatrix(); controls.update();
  // table view: the game's play distance (~22 ft away, looking down ~40°), the object beside a 5 ft 9 in person
  const size = box.getSize(new THREE.Vector3());
  ctxGroup.getObjectByName('person').position.x = size.x / 2 + 1.6;
  const tdir = new THREE.Vector3(0.35, 0.68, 1).normalize(), tdist = 20 + Math.max(size.x, size.y, size.z);
  const look0 = new THREE.Vector3(size.x * 0.25, Math.min(3, size.y / 2), 0);
  tableCam.position.copy(look0).addScaledVector(tdir, tdist); tableCam.lookAt(look0);
}

// ---------------------------------------------------------------- queue, filters, list
const F = { name: $('f-name'), status: $('f-status') };
F.status.value = store.get('align.filter', 'unaligned');
if (qs.get('filter') && ['unaligned', 'aligned', 'all'].includes(qs.get('filter'))) F.status.value = qs.get('filter');
const queue = () => Q[modeKey] || [];
function matches(e) {
  const words = F.name.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length && !words.every(w => `${e.sku} ${e.id} ${e.desc} ${e.type || ''} ${e.kind || ''}`.toLowerCase().includes(w))) return false;
  const s = statusOf(modeKey, e);
  if (F.status.value === 'unaligned') return s !== 'ok' || e === cur?.entry;
  if (F.status.value === 'aligned') return s === 'ok' || e === cur?.entry;
  return true;
}
const visible = () => queue().filter(matches);
function paintList() {
  const list = $('list'), vis = visible();
  list.replaceChildren(...vis.map(e => {
    const li = document.createElement('li'), s = statusOf(modeKey, e);
    li.className = `${s}${e === cur?.entry ? ' active' : ''}`; li.dataset.sku = e.sku;
    li.title = `${e.sku}\n${e.mesh}`;
    li.innerHTML = `<i></i><span></span><em></em>`;
    li.querySelector('span').textContent = e.sku.replace(/--/g, ' · ');
    li.querySelector('em').textContent = modeKey === 'fire' ? e.type : modeKey === 'open' ? e.kind : e.empty ? 'empty' : '';
    li.addEventListener('click', () => openEntry(e));
    return li;
  }));
  list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  const n = queue().length, ok = queue().filter(e => statusOf(modeKey, e) === 'ok').length;
  $('count').textContent = `${vis.length} shown · ${ok}/${n} aligned`;
  for (const m of MODES) $(`p-${m}`).textContent = `${Q[m].filter(e => statusOf(m, e) === 'ok').length}/${Q[m].length}`;
}
function paintHeader(e) {
  $('sku').textContent = e ? `${e.sku} · ${e.mesh}` : '';
  $('name').textContent = e ? (e.desc || e.id) : 'Done';
}
function paintStatus() {
  if (!cur) { $('status').textContent = ''; return; }
  const r = recordOf(modeKey, cur.entry), s = statusOf(modeKey, cur.entry);
  const saved = s === 'ok' ? `<span class="ok">aligned</span> ${r.at.slice(0, 16).replace('T', ' ')}` : s === 'saved' ? `saved, not yet marked aligned (${r.at.slice(0, 16).replace('T', ' ')})` : 'not aligned yet';
  $('status').innerHTML = `${saved}${mode.dirty ? ' · <span class="dirty">edited</span>' : ''}<br>${mode.summary?.() || ''}`;
}
function changed() { paintStatus(); }
F.name.addEventListener('input', () => paintList());
F.status.addEventListener('change', () => { store.set('align.filter', F.status.value); paintList(); });

function step(dir) {
  const vis = visible(); if (!vis.length) return openEntry(null);
  const qq = queue(), i = cur ? vis.indexOf(cur.entry) : -1;
  if (i >= 0) { const n = vis[i + dir]; if (n) return openEntry(n); if (dir > 0 && vis.length > (i >= 0 ? 1 : 0) && F.status.value === 'unaligned') return openEntry(vis.find(e => e !== cur.entry) || null); return toast(dir > 0 ? 'end of the queue' : 'start of the queue'); }
  // the current item left the filter (just aligned): the next shown item after it in queue order
  const at = cur ? qq.indexOf(cur.entry) : -1;
  const after = dir > 0 ? qq.slice(at + 1).concat(qq.slice(0, at + 1)) : qq.slice(0, Math.max(0, at)).reverse().concat(qq.slice(at).reverse());
  return openEntry(after.find(matches) || null);
}

// ---------------------------------------------------------------- saving
let saving = Promise.resolve();
function save(aligned) {
  if (!cur) return Promise.resolve(false);
  const e = cur.entry, m = modeKey, md = mode;
  const data = { ...md.record(), mesh: e.mesh, sku: e.sku, id: e.id, aligned: !!aligned, by: 'align-bench' };
  const body = { kind: KIND[m], name: e.mesh, data, note: window.__alignTestNote || '' };
  const p = saving.then(async () => {
    try {
      const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.err || r.status);
      recs[m][e.mesh] = { kind: KIND[m], name: e.mesh, data, at: j.at };
      if (cur?.entry === e && mode === md) { md.saved?.(); }
      paintList(); paintStatus();
      return true;
    } catch (err) { toast(`NOT SAVED ${e.sku}: ${err.message}`, true); return false; }
  });
  saving = p.catch(() => {});
  return p;
}
async function autosave() { if (cur && mode?.dirty) await save(false); }
async function looksRight() {
  if (!cur) return;
  const sku = cur.entry.sku;
  if (await save(true)) { toast(`${sku}: aligned`); step(1); }
}

// ---------------------------------------------------------------- modes
async function setMode(m, sku = null) {
  if (!MODES.includes(m)) m = 'fire';
  if (cur) { await autosave(); mode.close?.(); scene.remove(cur.it.group); cur = null; }
  modeKey = m; mode = modes[m]; store.set('align.mode', m);
  for (const b of $('modes').querySelectorAll('button')) b.classList.toggle('active', b.dataset.mode === m);
  canvas.classList.toggle('edit', m !== 'water');
  mode.panel($('panel'));
  $('keylist').innerHTML = [['J / →', 'next'], ['K / ←', 'previous'], ['Enter', 'looks right: save, mark aligned, next'], ['A', 'auto: back to the automatic guess'], ['S', 'save without marking aligned'], ['1 2 3', 'Fire · Water · Open/Shut'], ['/', 'filter by name'], ['F', 'frame the object'], ...(mode.keys || [])]
    .map(([k, d]) => `<dt>${k}</dt><dd>${d}</dd>`).join('');
  const want = sku || store.get(`align.last.${m}`, null);
  const qq = queue(), first = qq.find(e => e.sku === want && matches(e)) || qq.find(matches) || (sku && qq.find(e => e.sku === sku)) || null;
  await openEntry(first);
}
$('modes').addEventListener('click', (e) => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
$('b-ok').addEventListener('click', () => looksRight());
$('b-auto').addEventListener('click', () => { mode.auto?.(); changed(); });
$('b-prev').addEventListener('click', () => step(-1));
$('b-next').addEventListener('click', () => step(1));

window.addEventListener('keydown', (e) => {
  const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
  if (inField) { if (e.key === 'Escape' || (e.key === 'Enter' && document.activeElement === F.name)) document.activeElement.blur(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === '1' || k === '2' || k === '3') { setMode(MODES[+k - 1]); }
  else if (k === 'j' || k === 'J' || k === 'ArrowRight') step(1);
  else if (k === 'k' || k === 'K' || k === 'ArrowLeft') step(-1);
  else if (k === 'Enter') looksRight();
  else if (k === 'a' || k === 'A') { mode.auto?.(); changed(); toast('automatic guess'); }
  else if (k === 's' || k === 'S') { save(false).then(ok => ok && toast('saved')); }
  else if (k === '/') { F.name.focus(); F.name.select(); }
  else if (k === 'f' || k === 'F') frameItem();
  else if (!mode?.key?.(e)) return;
  if (document.activeElement?.type === 'range') document.activeElement.blur();
  e.preventDefault();
});
window.addEventListener('beforeunload', () => { if (cur && mode?.dirty) navigator.sendBeacon?.(`${API}/tuner`, new Blob([JSON.stringify({ kind: KIND[modeKey], name: cur.entry.mesh, data: { ...mode.record(), mesh: cur.entry.mesh, sku: cur.entry.sku, id: cur.entry.id, aligned: false, by: 'align-bench' }, note: window.__alignTestNote || '' })], { type: 'application/json' })); });

// ---------------------------------------------------------------- render loop: main view + table view (scissor)
let last = performance.now();
function loop(now) {
  const dt = Math.min(100, now - last); last = now;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (w && h) {
    const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) renderer.setSize(w, h, false);
    controls.update();
    fire.frame(dt, now);
    mode?.frame?.(dt, now);
    renderer.setScissorTest(true);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.render(scene, camera);
    const iw = window.__noInset ? 0 : Math.round(Math.max(110, w * 0.3)), ih = Math.round(iw * 0.72), x = w - iw - 6, y = 6; // __noInset: tests' blind shots
    tableCam.aspect = iw / ih; tableCam.updateProjectionMatrix();
    if (iw) { renderer.setViewport(x, y, iw, ih); renderer.setScissor(x, y, iw, ih); renderer.render(scene, tableCam); }
    renderer.setScissorTest(false);
    const lab = $('inset-label'); lab.hidden = !iw; lab.style.width = `${iw}px`; lab.style.bottom = `${ih + 8}px`; lab.style.right = '6px';
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------------------------------------------------------- start
await loadRecs();
const ready = setMode(qs.get('mode') || store.get('align.mode', 'fire'), qs.get('sku'));
// test + automation hook
window.bench = {
  ready, Q, recs, ctx, fire,
  mode: () => modeKey, modeObj: () => mode, cur: () => cur && { sku: cur.entry.sku, mesh: cur.entry.mesh, id: cur.entry.id },
  state: () => mode?.state?.(), go: (sku) => openEntry(queue().find(e => e.sku === sku)), setMode, step, save, looksRight,
  reload: loadRecs, statusOf: (m, sku) => statusOf(m, Q[m].find(e => e.sku === sku)), visibleCount: () => visible().length,
  version: ver, camera, controls, frameItem,
  helpers(on) { if (on) camera.layers.enable(LAYER.helpers); else camera.layers.disable(LAYER.helpers); },
  look(target, dist, dir = [0.55, 0.42, 1]) { // tests: aim the main camera at a world point from a distance
    const t = new THREE.Vector3(...target), d = new THREE.Vector3(...dir).normalize();
    controls.target.copy(t); camera.position.copy(t).addScaledVector(d, dist); camera.near = dist / 100; camera.updateProjectionMatrix(); controls.update();
  },
};
await ready;
