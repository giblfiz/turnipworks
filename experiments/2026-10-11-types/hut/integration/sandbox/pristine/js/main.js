// Spawn Tuner — DA-light demo reel with tuning knobs (tool-level, not product code). See ../PLAN.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GrabCamera } from './camera.js';
import { computeEdges, chooseExteriorDoor, edgeTransform, overlaps, CELL, hash, familyFor, meshFamily, isOutdoor } from './walls.js';
import { planKit, KIT, KIT_FAMILIES, isKit, boxSolids, overlapVol, jambOf, faceUV } from './wallkit.js';
import { buildKitVisual, kitMaterials } from './wallkit3.js';
import { solveRoom, summarize, CEIL, mulberry32, skuUsable, kitScale } from './solver.js';
import { solveRoom2, summarize2 } from './solver2.js';
import { buildOverlay } from './overlay2.js';
import { schedule, pose, defaultPreset, motionFor, BUILTIN_PRESETS } from './anim.js';
import { renderDials } from './ui.js';
import { NetMeter, fmtBytes, fmtRate } from './net.js';
import { createFx } from './fx/index.js';
import { createSelectionLab } from './fx/selpanel.js';
import { houseLink } from './fx/houselink.js';
let selLab = null; // the Selection lab (js/fx/selpanel.js): draws selection + hover with the shared selection renderer
import { createLook, meshAtFn, orientFromServer, PLACE_COLORS, loadDelivery } from './look.js';
import { createSettler } from './settle.js';

const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const API = qs.get('api') || '/api/tw-ratings';
const WORLD = 300; // feet of grid, starting at 0,0 (north-west corner)

// ---------------------------------------------------------------- scene
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('capture') });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1d1f1a');
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);
const cam = new GrabCamera(camera, canvas, { focus: [45, 35], dist: 110 });

const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7);
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
sun.position.set(-60, 120, -40); sun.target.position.set(60, 0, 60);
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, near: 10, far: 400 });
scene.add(hemi, sun, sun.target);

// ground + 5-ft grid + north edge
const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ color: '#2b2e25', roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(WORLD / 2, -0.02, WORLD / 2); ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(WORLD, WORLD / CELL, '#4a4e40', '#3a3d33');
grid.position.set(WORLD / 2, 0.0, WORLD / 2);
scene.add(grid);
const major = new THREE.GridHelper(WORLD, WORLD / 25, '#5f6450', '#5f6450');
major.position.set(WORLD / 2, 0.01, WORLD / 2);
scene.add(major);
function textSprite(text, { size = 64, color = '#f1e8d6', bg = null, worldH = 4, occlude = false } = {}) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `700 ${size}px Fraunces, serif`;
  const w = Math.ceil(g.measureText(text).width) + size * 0.6; c.width = w; c.height = size * 1.4;
  g.font = `700 ${size}px Fraunces, serif`;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = color; g.textBaseline = 'middle'; g.fillText(text, size * 0.3, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: occlude, transparent: true }));
  s.scale.set(worldH * c.width / c.height, worldH, 1); s.renderOrder = occlude ? 0 : 10;
  return s;
}
{ // north: a tinted band along the whole north edge, a big N, and arrows
  const band = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, 3), new THREE.MeshBasicMaterial({ color: '#b9d45d' }));
  band.rotation.x = -Math.PI / 2; band.position.set(WORLD / 2, 0.03, -1.5); scene.add(band);
  for (let x = 25; x < WORLD; x += 50) {
    const n = textSprite('N', { size: 96, color: '#b9d45d', worldH: 9, occlude: true }); n.position.set(x, 5, -7); scene.add(n);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 3), new THREE.MeshBasicMaterial({ color: '#b9d45d' }));
    arrow.rotation.x = -Math.PI / 2; arrow.position.set(x, 0.5, -12); scene.add(arrow);
  }
  const s = textSprite('S', { size: 64, color: '#7c8063', worldH: 5, occlude: true }); s.position.set(WORLD / 2, 3, WORLD + 5); scene.add(s);
}

// ---------------------------------------------------------------- data
const [lib, types, , buildTypes] = await Promise.all([fetch('data/library.json?v=1').then(r => r.json()), fetch('data/rooms.json?v=1').then(r => r.json()),
  loadDelivery('assets/delivery.json?v=1'),
  fetch('data/types.json?v=1').then(r => r.ok ? r.json() : []).catch(() => [])]); // (the game's building types, for the palette's groups: engine/tools/build_types.py) // (the delivered copies of the assets: js/delivery.js)
// mesh orientation: data/orient.json (front sweeps) < this browser's corrections < corrections on the server (all browsers).
// Keyed by MESH id (sku.mesh = "<src>/<sku>@<hash>", 2026-10-02): inn-02 regenerated meshes under the same sku names, so a
// yaw measured on one mesh must never land on another. Older corrections carry only a sku: they belong to the mesh that sku
// showed when they were made (library `was`: superseded meshes with the time the next one went live).
const skuRec = new Map(Object.values(lib.objects).flatMap(o => o.skus.map(s => [s.sku, s])));
const meshOf = (sku) => skuRec.get(sku)?.mesh ?? null;
const meshAt = meshAtFn(lib); // shared with the game (js/look.js)
const orientFile = await fetch('data/orient.json?v=1').then(r => r.ok ? r.json() : {}).catch(() => ({}));
let orientLocal = {}; try { orientLocal = JSON.parse(localStorage.getItem('tuner.orient.v2')) || {}; } catch { }
try { // one-time move of this browser's sku-keyed corrections (tuner.orient) onto the meshes they were made on
  const old = JSON.parse(localStorage.getItem('tuner.orient') || 'null');
  if (old) {
    for (const [sku, v] of Object.entries(old)) { const m = meshAt(sku, null); if (m && orientLocal[m] == null) orientLocal[m] = +v; }
    localStorage.setItem('tuner.orient.v2', JSON.stringify(orientLocal)); localStorage.removeItem('tuner.orient');
  }
} catch { }
const orientServer = {};
try { const r = await fetch(`${API}/tuner/orient`); if (r.ok) Object.assign(orientServer, orientFromServer(lib, await r.json())); } catch { }
const orient = { ...orientFile, ...orientLocal, ...orientServer };
const corrected = new Set([...Object.keys(orientLocal), ...Object.keys(orientServer)]);
const typeByKey = Object.fromEntries(types.map(t => [t.key, t]));
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

// ---------------------------------------------------------------- assets
// the look (asset loading, LOD ladder, visuals, walls, floors) lives in js/look.js, shared with the game engine
const look = createLook({ lib, types, orient, dials: () => ({ faces: $('#lodFaces').value, tex: $('#lodTex').value, scope: $('#lodScope').value, floorMode: $('#floorMode').value }),
  solverOpts: () => solverOpts(), shadows: () => shadowsOn, kitVisual: (k) => buildKitVisual(k) });
const { glbCache, texCache, texBytes, loadGLB, loadTex, loadLadderTex, loadAny, isCached, ladderFor, ladderUrls, assetUrls, meshYawDeg, flatMat, makeVisual,
  familyUsable, kitSpec, edgeSpecs, cornerSpec, floorFor, floorSpecs, cubeGeo, cubeMat, planeGeo } = look;
// bandwidth meter (Harry 2026-10-01): wire bytes from Resource Timing, in-flight / waiting from our own loaders
try { performance.setResourceTimingBufferSize(100000); } catch { }
const net = new NetMeter();
const fgQueue = { pending: [] }; // foreground (room spawn) URLs not yet finished
async function preload(urls) {
  const need = [...new Set(urls)].filter(u => !isCached(u));
  if (!need.length) return;
  const box = $('#loading'); box.hidden = false;
  let done = 0;
  fgQueue.pending.push(...need);
  await Promise.all(need.map(u => net.track(loadAny(u), 'fg').catch(e => console.warn('load failed', u, e)).finally(() => {
    box.textContent = `loading meshes ${++done}/${need.length}`;
    const i = fgQueue.pending.indexOf(u); if (i >= 0) fgQueue.pending.splice(i, 1);
  })));
  box.hidden = true;
}
function netState() {
  const est = (u) => net.estBytes(u.endsWith('.glb') ? 'glb' : 'img');
  const fgLeft = fgQueue.pending.reduce((a, u) => a + est(u), 0);
  const bgLeft = (bg.queue || []).reduce((a, u) => a + est(u), 0) + net.inflight.bg * net.estBytes('glb');
  const rate = net.rate > 5e3 ? net.rate : net.ceiling;
  return {
    rate: net.rate, session: net.session, files: net.files, ceiling: net.ceiling, util: net.util(),
    fgInflight: net.inflight.fg, fgWaiting: Math.max(0, fgQueue.pending.length - net.inflight.fg), bgInflight: net.inflight.bg, bgWaiting: (bg.queue || []).length,
    etaFg: fgLeft && rate ? fgLeft / rate : 0, etaAll: (fgLeft + bgLeft) && rate ? (fgLeft + bgLeft) / rate : 0,
    loadingBound: busy > 0 && net.inflight.fg > 0,
  };
}
const netCtx = () => $('#netGraph').getContext('2d');
setInterval(() => { // ~4x per second, cheap
  net.tick();
  const n = netState();
  const pct = Math.round(n.util * 100);
  $('#net').innerHTML = `<span style="color:${NetMeter.colour(n.util)}">↓ ${fmtRate(n.rate)}</span> · ${pct}% of ${fmtRate(n.ceiling)} peak · ${fmtBytes(n.session)} this session`
    + `<br>spawn: ${n.fgInflight} in flight, ${n.fgWaiting} waiting${n.etaFg ? ` · ~${n.etaFg.toFixed(1)} s` : ''} · preload: ${n.bgInflight} in flight, ${n.bgWaiting} waiting${n.bgWaiting && n.etaAll ? ` · ~${Math.round(n.etaAll)} s` : ''}`;
  $('#loadBound').hidden = !n.loadingBound;
  net.draw(netCtx(), 160, 36);
}, 250);

// ---------------------------------------------------------------- items + animation
const world = new THREE.Group(); scene.add(world);
const overlays = new THREE.Group(); scene.add(overlays);
let cubesOn = false, shadowsOn = false, sizeBoxesOn = false;
const items = new Set();               // every live item
// surface items settle onto their parent's real mesh in the background (js/settle.js; Harry 2026-10-02: floating above tables)
const settler = createSettler({ itemsOfRoom: (rid) => [...(roomById(rid)?.items || [])], onSettled: (it) => { const p = placementOf(it); if (p) p.y = +it.rest.y.toFixed(3); } });
const episodes = [];                   // running animations
let clock = 0, paused = false, scrubEp = null;
let preset = loadInitialPreset();

// v2 key (2026-10-01): Harry's preset became the default, so a browser still holding the old 'tuner.current'
// starts fresh on harry-v1 rather than on Fauna's first defaults.
const CURRENT_KEY = 'tuner.current.v2';
function loadInitialPreset() {
  try { const p = JSON.parse(localStorage.getItem(CURRENT_KEY)); if (p?.in?.choreo) return mergeDefaults(p); } catch { }
  return defaultPreset();
}
function mergeDefaults(p) {
  const d = defaultPreset();
  for (const s of ['in', 'out']) for (const g of ['choreo', 'objects', 'floor', 'walls']) d[s][g] = { ...d[s][g], ...(p[s]?.[g] || {}) };
  d.out.mirror = p.out?.mirror ?? d.out.mirror; d.name = p.name || d.name; d.speed = p.speed ?? 1;
  return d;
}
let animLink = null; // the Spawn panel's "what is the game using" line (fx/houselink.js)
function savePresetLocal() { try { localStorage.setItem(CURRENT_KEY, JSON.stringify(preset)); } catch { } animLink?.changed(); }

// ---- three-letter object tags (Harry 2026-10-01: "click on an object and select it ... a three alpha ID, mostly so I
// can talk to you about it and its placement patterns"). Stable for the same layout: props hash (room seed, uid), walls
// hash their edge key; unique across the scene by probing; floor tiles get none.
const tags = new Map(); // tag -> item
const toTag = (h) => String.fromCharCode(65 + h % 26, 65 + Math.floor(h / 26) % 26, 65 + Math.floor(h / 676) % 26);
function assignTag(it) {
  const sp = it.spec;
  if (sp.layer === 'floor' || !(sp.uid || sp.key)) return;
  const seed = sp.layer === 'walls' || sp.layer === 'openings' ? '' : roomById(sp.roomId)?.seed ?? '';
  let t = sp.tag && (!tags.has(sp.tag) || tags.get(sp.tag) === it) ? sp.tag : null;
  for (let k = 0; !t; k++) { const c = toTag(hash(seed, sp.uid || sp.key, k)); if (!tags.has(c)) t = c; }
  tags.set(t, it); it.tag = t; sp.tag = t;
  const r = roomById(sp.roomId); // the layout record carries the tag into the JSON / write-back
  const p = r?.layout?.placements.find(q => q.uid === sp.uid); if (p) p.tag = t;
}

async function makeItem(spec) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const visual = await makeVisual(spec, cubesOn);
  group.add(visual);
  const it = { group, visual, spec, layer: spec.layer, x: spec.x, z: spec.z, roomId: spec.roomId, rest: { x: spec.x, y: spec.y || 0, z: spec.z, rot: spec.rot || 0 }, axisPick: ['x', 'y', 'z'][hash(spec.uid || spec.key) % 3] };
  group.position.set(it.rest.x, it.rest.y, it.rest.z);
  group.rotation.y = it.rest.rot;
  group.visible = false; // born hidden: play() or restPose() reveals it (Harry: walls/floor flashed before warping in)
  group.userData.item = it;
  if (shadowsOn) setShadows(group, true);
  if (sizeBoxesOn) addSizeBoxes(it);
  world.add(group);
  items.add(it);
  assignTag(it);
  settler.enqueue(it);
  return it;
}
function removeItem(it) {
  world.remove(it.group); items.delete(it); if (it.fadeMats) it.fadeMats.forEach(m => m.dispose());
  if (it.tag && tags.get(it.tag) === it) tags.delete(it.tag);
  if (selObj === it) selectObject(null);
}

async function swapVisual(it) {
  const v = await makeVisual(it.spec, cubesOn);
  it.group.remove(it.visual); it.visual = v; it.group.add(v);
  if (it.fadeMats) { it.fadeMats = null; }
  if (shadowsOn) setShadows(it.group, true);
  settler.enqueue(it); settler.enqueueRiders(it); // new mesh, new contact
}

function applyPose(it, m, p) {
  const ps = pose(m, p);
  const g = it.group;
  g.position.set(it.rest.x, it.rest.y + ps.dy, it.rest.z);
  const axis = ps.axis === 'random' ? it.axisPick : ps.axis;
  g.rotation.set(axis === 'x' ? ps.ang : 0, it.rest.rot + (axis === 'y' ? ps.ang : 0), axis === 'z' ? ps.ang : 0);
  g.scale.set(Math.max(1e-4, ps.sx), Math.max(1e-4, ps.sy), Math.max(1e-4, ps.sz));
  if (m.fade || it.fadeMats) setOpacity(it, ps.opacity);
}
function setOpacity(it, a) {
  if (!it.fadeMats) {
    it.fadeMats = [];
    it.visual.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; it.fadeMats.push(o.material); } });
  }
  for (const m of it.fadeMats) { m.opacity = a; m.transparent = a < 1; m.depthWrite = a >= 1; }
}
function restPose(it) { it.rested = true; it.group.visible = true; applyPose(it, { ...preset.in.objects, fade: false }, 1); if (it.fadeMats) setOpacity(it, 1); }

function sideOf(dir) {
  if (dir === 'in' || !preset.out.mirror) return preset[dir];
  // mirror: the in-motions played backwards, the in-sweep reversed
  return { ...preset.in, choreo: { ...preset.in.choreo, reverse: !preset.in.choreo.reverse } };
}

// start an animation episode over `list`; rect = bounds for the sweep, door = [x,z]
function play(list, dir, rect, door, onDone) {
  list = list.filter(Boolean);
  for (const ep of episodes) ep.items = ep.items.filter(e => !list.includes(e.it));
  const side = sideOf(dir);
  const rng = mulberry32(hash(clock, list.length));
  const layerOf = (it) => side.choreo.nearWallsLast && it.spec.wallDir && cameraSide(it, rect) ? 'walls-near' : it.layer;
  const { delays, total } = schedule(list.map(it => ({ x: it.x, z: it.z, layer: layerOf(it) })), side, rect, door, rng);
  const ep = { dir, side, start: clock, total, onDone, items: list.map((it, i) => ({ it, delay: delays[i], layerUsed: layerOf(it), m: motionFor(side, it.layer) })) };
  for (const e of ep.items) { if (dir === 'in') e.it.group.visible = false; }
  episodes.push(ep);
  if (dir === 'in') { scrubEp = ep; $('#scrub').value = 0; }
  return ep;
}
// Is this wall piece between the camera and the room being animated? (the camera and the room's centre are on
// opposite sides of the wall's line; corner posts count if either of their axes is)
function cameraSide(it, rect) {
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2, c = camera.position;
  const opp = (a, b, w) => (a - w) * (b - w) < 0;
  if (it.spec.wallDir === 'h') return opp(c.z, cz, it.z);
  if (it.spec.wallDir === 'v') return opp(c.x, cx, it.x);
  return opp(c.z, cz, it.z) || opp(c.x, cx, it.x);
}
function evalEpisode(ep, local) {
  for (const e of ep.items) {
    const p = (local - e.delay) / e.m.dur;
    if (ep.dir === 'in') {
      if (p <= 0) { e.it.group.visible = false; continue; }
      e.it.group.visible = true; applyPose(e.it, e.m, Math.min(1, p));
    } else {
      if (p >= 1) { e.it.group.visible = false; continue; }
      e.it.group.visible = true; applyPose(e.it, e.m, 1 - Math.max(0, p));
    }
  }
}
function stepAnimations(dt) {
  if (!paused) clock += dt * preset.speed;
  for (let i = episodes.length - 1; i >= 0; i--) {
    const ep = episodes[i];
    const local = clock - ep.start;
    evalEpisode(ep, local);
    if (local >= ep.total) {
      episodes.splice(i, 1);
      if (ep.dir === 'in') ep.items.forEach(e => restPose(e.it));
      ep.onDone?.();
    }
  }
  if (scrubEp && !paused) $('#scrub').value = Math.min(1000, ((clock - scrubEp.start) / scrubEp.total) * 1000);
}

// ---------------------------------------------------------------- rooms
const rooms = [];               // {id,type,x,z,w,d,seed,wallSeed,family,created,extDoor,layout,items:Set,locked:Map}
let selected = null, nextId = 1, created = 0;
const wallItems = new Map();    // edge key -> {sig, items:[...]}
const cornerItems = new Map();  // vertex key -> {sig, item}
const floorItems = new Map();   // room id -> [items]
let edgesNow = { edges: new Map(), corners: [], openings: new Map() };
const roomLabels = new Map();
const roomOutlines = new Map();

const randomSeed = () => (Math.random() * 1e9) >>> 0;
const roomRect = (r) => ({ x0: r.x * CELL, z0: r.z * CELL, x1: (r.x + r.w) * CELL, z1: (r.z + r.d) * CELL });
const roomById = (id) => rooms.find(r => r.id === id);
function doorPoint(r) {
  const o = (edgesNow.openings.get(r.id) || []).find(o => o.kind === 'door');
  if (!o) return null;
  const e = edgesNow.edges.get(o.key); const t = edgeTransform(e);
  return [t.x, t.z];
}

// variant B (wall kit) item -> makeItem spec; dims = the item's bounding box (cube mode, size boxes)
function kitItemSpec(k) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const s of k.solids) if (s.b) { x0 = Math.min(x0, s.b[0]); x1 = Math.max(x1, s.b[1]); z0 = Math.min(z0, s.b[2]); z1 = Math.max(z1, s.b[3]); }
  if (!isFinite(x0)) { x0 = x1 = k.x; z0 = z1 = k.z; }
  return { kind: 'kit', kitItem: k, id: k.kind === 'node' ? 'kit-node' : 'kit-wall', family: k.family, dims: [Math.max(0.1, x1 - x0), 9, Math.max(0.1, z1 - z0)], place: 'kit',
    x: k.x, z: k.z, rot: 0, roomId: k.room, key: k.key, uid: k.key, layer: 'walls', cubeColor: 'kit', wallDir: k.wallDir,
    hinges: k.leaves.map((l, i) => ({ mode: l.mode, pivot: l.pivot, pivotLocal: [l.pivot[0] - k.x, l.pivot[1], l.pivot[2] - k.z], pivotNode: `leaf_hinge_${i}`, axis: l.axis, openAngle: l.openAngle, duration: l.duration, ease: l.ease, openEase: l.openEase, rest: l.rest, what: l.what })) };
}
let kitPlan = { edgeItems: new Map(), nodeItems: new Map(), view: new Map() };
async function syncWalls(animList) {
  edgesNow = computeEdges(rooms, { engine: engine() });
  kitPlan = planKit(edgesNow.edges);
  if (kitPlan.edgeItems.size || kitPlan.nodeItems.size) await kitMaterials(); // 3 shared textures (+ normals), loaded once
  const wanted = new Map();
  const fsig = `${$('#minStars').value}|${$('#hideMasking').checked}`;
  for (const e of edgesNow.edges.values()) {
    const ki = kitPlan.edgeItems.get(e.key);
    wanted.set(e.key, { e, sig: ki ? `${e.kind}|${ki.sig}` : `${e.kind}|${e.family}|${e.owner.side}|${e.doorType || ''}|${e.span || 1}|${fsig}|${e.panel || ''}|${e.panelShape ?? ''}|${e.doorLeaf || ''}` });
  }
  const created_ = [];
  // removed edges -> animate out and drop
  const leaving = [];
  for (const [k, w] of wallItems) if (!wanted.has(k) || wanted.get(k).sig !== w.sig) { leaving.push(...w.items); wallItems.delete(k); }
  for (const [k, w] of wanted) {
    if (wallItems.has(k)) continue;
    const { e } = w;
    const ki = kitPlan.edgeItems.get(k);
    if (ki) { const it = await makeItem(kitItemSpec(ki)); wallItems.set(k, { sig: w.sig, items: [it] }); created_.push(it); continue; } // variant B
    const specs = edgeSpecs(e); // js/look.js: wall piece + a door filling its opening; [] inside a wide opening
    const its = await Promise.all(specs.map(makeItem));
    wallItems.set(k, { sig: w.sig, items: its });
    created_.push(...its);
  }
  // generated corner/jamb posts stay wherever any generated wall meets the vertex; all-kit vertices use kit nodes
  const wantC = new Map(edgesNow.corners.filter(v => !kitPlan.nodeItems.get(`${v.gx}:${v.gz}`)?.allKit).map(v => [`${v.gx}:${v.gz}`, v]));
  for (const [k, n] of kitPlan.nodeItems) wantC.set('k' + k, { kit: n, sig: n.sig });
  for (const [k, c] of cornerItems) if (k.startsWith('k')) { if (!wantC.has(k) || wantC.get(k).sig !== c.sig) { leaving.push(c.item); cornerItems.delete(k); } }
  else if (!wantC.has(k) || `${wantC.get(k).family}|${!!wantC.get(k).jamb}|${!!wantC.get(k).slim}` !== c.sig) { leaving.push(c.item); cornerItems.delete(k); }
  for (const [k, v] of wantC) {
    if (cornerItems.has(k)) continue;
    if (v.kit) { const it = await makeItem(kitItemSpec(v.kit)); cornerItems.set(k, { sig: v.sig, item: it }); created_.push(it); continue; }
    const it = await makeItem(cornerSpec(v)); // js/look.js
    cornerItems.set(k, { sig: `${v.family}|${!!v.jamb}|${!!v.slim}`, item: it });
    created_.push(it);
  }
  for (const it of leaving) removeItem(it); // wall swaps are instant; the new piece animates in with its room
  wallsVisible(wallsOn, false); // never reveal: new pieces wait for their animation
  if (animList) animList.push(...created_);
  else created_.forEach(restPose);
  return created_;
}

// floor materials: per room type list (first = most typical), plus the two original framed tiles
const FLOORS = Object.keys(lib.objects).filter(k => k.startsWith('floor-') && lib.objects[k].skus.some(s => s.kind === 'flat'));
async function buildFloor(r) {
  for (const it of floorItems.get(r.id) || []) removeItem(it);
  const { id, specs } = floorSpecs(r); // js/look.js: tiles per 5-ft cell + scatter decals, by the floor-tiling dial
  const out = specs.map(makeItem);
  r.floorUsed = id;
  const its = await Promise.all(out);
  floorItems.set(r.id, its);
  return its;
}

// Background preload (Harry 2026-10-01): fetch every shipping-tier mesh and flat while nothing else is loading, so a
// new room type spawns instantly after the first minutes. Foreground loads (busy > 0) always go first.
const bg = { queue: null, done: 0, total: 0, running: 0 };
function bgStart() {
  if (bg.queue) return;
  const urls = new Set(); // what the current faces & skins dials will actually ask for
  for (const o of Object.values(lib.objects)) for (const k of o.skus) {
    if (k.kind === 'flat') { if (k.url) urls.add(k.url); continue; }
    if (!k.bounds) continue;
    for (const u of assetUrls({ kind: 'mesh', sku: k.sku, id: o.id, url: k.url, layer: o.place === 'kit' ? 'walls' : 'furnish' })) urls.add(u);
  }
  bg.queue = [...urls].filter(u => !isCached(u));
  bg.total = urls.size; bg.done = urls.size - bg.queue.length;
  bgPump();
}
function bgPump() {
  while (bg.running < 3 && bg.queue.length) {
    if (busy > 0 || !$('#loading').hidden) { setTimeout(bgPump, 400); return; }
    const u = bg.queue.shift();
    if (isCached(u)) { bg.done++; continue; }
    bg.running++;
    net.track(loadAny(u), 'bg').catch(() => {}).finally(() => { bg.running--; bg.done++; bgPump(); });
  }
}
if (!qs.has('nobg')) setTimeout(bgStart, 1500); // tests pass ?nobg to keep headless memory down

function solve(r) {
  const type = typeByKey[r.type];
  const locked = [...r.locked.values()];
  const args = { lib, type, room: r, openings: edgesNow.openings.get(r.id) || [], locked, opts: solverOpts(), roomTypeOf: (id) => roomById(id)?.type };
  const layout = engine() === 'v2' ? solveRoom2(args) : solveRoom(args);
  layoutGen++;
  r.openSig = openSig(r);
  const doors = [...edgesNow.edges.values()].filter(e => e.kind === 'door' && (e.sides.some(x => x.room === r.id) || e.yard?.room === r.id)).map(e => `${e.doorType}${e.span > 1 ? ` (${e.span * CELL} ft opening)` : ''}`);
  layout.summary = (layout.engine === 'v2' ? summarize2 : summarize)(layout, id => roomById(id) ? typeByKey[roomById(id).type].label : id) + (isOutdoor(r.type) ? `\nGround: ${floorFor(r).replace('floor-', '')}. No walls.${doors.length ? ` Doors onto it: ${doors.join(', ')}.` : ''}` : `\nFloor: ${floorFor(r)}. Walls: ${r.family}. Door pieces: ${doors.join(', ') || 'none'}.`);
  layout.floor = floorFor(r);
  return layout;
}
// OUTDOORS (Harry 2026-10-05): a yard is dressed by what stands around it (the inn's sign on the inn's wall, a trough by
// the stable door), so when a neighbour arrives, leaves or changes, the yards whose surroundings changed are laid out
// again with the SAME seed (locked things stay).
const openSig = (r) => isOutdoor(r.type) ? JSON.stringify((edgesNow.openings.get(r.id) || []).map(o => [o.side, o.index, o.kind, o.to && roomById(o.to)?.type, o.span, !!o.part])) : '';
async function replanYards(except = null) {
  for (const y of rooms) if (y !== except && y.layout && isOutdoor(y.type) && openSig(y) !== y.openSig) { await rollRoom(y, false); toast(`${typeByKey[y.type].label} laid out again: its surroundings changed`); }
}
// Layout engine (Harry 2026-10-01): v2 = principles (roles, key purpose, desire lines, zones, density); v1 = classic
const engine = () => $('#engine')?.value || 'v2';
let layoutGen = 0;
function solverOpts() { return { orient, minStars: +$('#minStars').value, hideMasking: $('#hideMasking').checked, scaleVariety: +$('#variety').value, sizeRule: $('#sizeRule').value, ...(qs.get('flavor') && { flavor: qs.get('flavor') }) }; } // (?flavor=spiders: the flavor of every religious room, solver2.js types:flavor)

async function spawnProps(r) {
  const specs = r.layout.placements.map(p => ({ ...p, roomId: r.id, cubeColor: p.place }));
  await preload(specs.flatMap(assetUrls));
  const keep = new Map([...r.items].map(it => [it.spec.uid, it]));
  const fresh = [];
  for (const s of specs) {
    if (s.locked && keep.has(s.uid)) { const p = r.layout.placements.find(q => q.uid === s.uid); if (p) p.tag = keep.get(s.uid).tag; continue; } // locked objects stay where they are
    fresh.push(await makeItem(s));
  }
  for (const it of fresh) r.items.add(it);
  return fresh;
}

let busy = 0; // async room work in flight (tests wait for busy === 0 && no episodes)
async function createRoom(type, x, z, w, d) {
  busy++;
  try { return await createRoomInner(type, x, z, w, d); } finally { busy--; }
}
async function createRoomInner(type, x, z, w, d) {
  const t = typeByKey[type];
  const r = { id: `room${nextId++}`, type, x, z, w, d, seed: randomSeed(), wallSeed: randomSeed(), family: t.family, created: ++created, items: new Set(), locked: new Map() };
  if (qs.has('seed')) { r.seed = +qs.get('seed') + nextId; r.wallSeed = r.seed * 7 + 1; }
  r.family = familyFor(r, t.family, { kit: wallKitMode() === 'kit' });
  rooms.push(r);
  r.extDoor = chooseExteriorDoor(r, rooms);
  const anim = [];
  await syncWalls(anim);
  anim.push(...await buildFloor(r));
  r.layout = solve(r);
  anim.push(...await spawnProps(r));
  checkLateDoors(r);
  labelRoom(r);
  select(r.id);
  play(anim, 'in', roomRect(r), doorPoint(r));
  await replanYards(r);
  select(r.id);
  toast(`${t.label} ${w * CELL}×${d * CELL} ft: ${r.layout.placements.length} objects${r.layout.unplaced.length ? `, ${r.layout.unplaced.length} couldn't fit` : ''}`);
  return r;
}

// a neighbour that existed before this room may now have a new connecting door blocked by its furniture
function checkLateDoors(newRoom) {
  for (const r of rooms) {
    if (r === newRoom || !r.layout) continue;
    const ops = edgesNow.openings.get(r.id).filter(o => o.kind === 'door' && !o.part && (o.to === newRoom.id || o.yard === newRoom.id));
    for (const o of ops) {
      const e = edgesNow.edges.get(o.key), t = edgeTransform(e);
      const blocker = r.layout.placements.find(p => !p.parent && p.y < 0.5 && p.orient !== 'floor' && Math.hypot(p.x - t.x, p.z - t.z) < 3 + Math.max(p.dims[0], p.dims[2]) / 2);
      r.lateNote = blocker ? `The door to the new ${typeByKey[newRoom.type].label} was added after this room was laid out; ${blocker.id} stands in front of it. Roll again to re-plan around it.` : null;
      if (r.lateNote && r.id === selected) showRoom(r);
    }
  }
}

async function rollRoom(r, newSeed = true) {
  busy++;
  try { return await rollRoomInner(r, newSeed); } finally { busy--; }
}
async function rollRoomInner(r, newSeed) {
  if (newSeed) r.seed = randomSeed();
  const old = [...r.items].filter(it => !r.locked.has(it.spec.uid));
  r.lateNote = null;
  r.layout = solve(r);
  const outEp = old.length ? play(old, 'out', roomRect(r), doorPoint(r), () => old.forEach(it => { removeItem(it); r.items.delete(it); })) : null;
  old.forEach(it => r.items.delete(it));
  const fresh = await spawnProps(r);
  const wait = outEp ? Math.max(0, outEp.total * 0.6 - (clock - outEp.start)) : 0;
  const ep = play(fresh, 'in', roomRect(r), doorPoint(r));
  ep.start += wait; // the new set arrives as the old one finishes leaving
  showRoom(r);
}

function deleteRoom(r) {
  const idx = rooms.indexOf(r); if (idx < 0) return;
  rooms.splice(idx, 1);
  if (selected === r.id) select(null);
  const mine = [...r.items, ...(floorItems.get(r.id) || [])];
  // walls that only this room used
  const others = computeEdges(rooms, { engine: engine() });
  for (const [k, w] of wallItems) if (!others.edges.has(k)) mine.push(...w.items);
  const keepC = new Set(others.corners.map(v => `${v.gx}:${v.gz}`));
  for (const k of planKit(others.edges).nodeItems.keys()) keepC.add('k' + k);
  for (const [k, c] of cornerItems) if (!keepC.has(k)) mine.push(c.item);
  for (const [k, w] of [...wallItems]) if (!others.edges.has(k)) wallItems.delete(k);
  for (const [k] of [...cornerItems]) if (!keepC.has(k)) cornerItems.delete(k);
  floorItems.delete(r.id);
  roomLabels.get(r.id)?.removeFromParent(); roomLabels.delete(r.id);
  roomOutlines.get(r.id)?.removeFromParent(); roomOutlines.delete(r.id);
  play(mine, 'out', roomRect(r), doorPoint(r), async () => { mine.forEach(removeItem); await syncWalls(null); await replanYards(); });
  toast(`deleted ${typeByKey[r.type].label}`);
  refreshOccupancy();
}

async function changeType(r, type) {
  r.type = type; r.family = familyFor(r, typeByKey[type].family, { kit: wallKitMode() === 'kit' }); r.locked.clear();
  roomLabels.get(r.id)?.removeFromParent(); labelRoom(r);
  const anim = [];
  await syncWalls(anim);
  anim.push(...await buildFloor(r));
  play(anim, 'in', roomRect(r), doorPoint(r));
  await rollRoom(r, true);
  await replanYards(r);
}

function labelRoom(r) {
  const t = typeByKey[r.type];
  const s = textSprite(`${t.label}  ${r.w * CELL}×${r.d * CELL}`, { size: 48, color: '#f1e8d6', bg: 'rgba(20,21,16,0.72)', worldH: 2.6 });
  const rc = roomRect(r);
  s.position.set((rc.x0 + rc.x1) / 2, CEIL + 3, rc.z0 + 1);
  s.userData.roomId = r.id;
  overlays.add(s); roomLabels.set(r.id, s);
  const pts = [[rc.x0, rc.z0], [rc.x1, rc.z0], [rc.x1, rc.z1], [rc.x0, rc.z1], [rc.x0, rc.z0]].map(([x, z]) => new THREE.Vector3(x, 0.08, z));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffe066' })); // selection outline
  line.visible = false; overlays.add(line); roomOutlines.set(r.id, line);
}

// ---------------------------------------------------------------- selection + panel
function select(id) {
  selected = id;
  if (selObj && selObj.roomId !== id) selectObject(null);
  refreshTagSprites();
  for (const [rid, l] of roomOutlines) l.visible = rid === id;
  const r = roomById(id);
  $('#noRoom').hidden = !!r; $('#roomInfo').hidden = !r;
  if (r) showRoom(r);
  else { $('#summary').textContent = rooms.length ? 'Click a room to read its layout.' : 'No room yet.'; $('#json').textContent = ''; }
}
function compactLayout(r) {
  const L = r.layout;
  return {
    room: L.room, floor: L.floor, openings: L.openings, notes: L.notes, unplaced: L.unplaced, late: r.lateNote || undefined,
    engine: L.engine || 'v1', role: L.role, purposeFail: L.purposeFail || undefined, score: L.score, checks: L.checks, zones: L.zones, paths: L.paths,
    placements: L.placements.map(p => ({ tag: p.tag, id: p.id, sku: p.sku, layer: p.layer, rule: p.rule, why: p.why, at: [p.x, p.y, p.z], rot_deg: Math.round(p.rot * 180 / Math.PI), dims_ft: p.dims, catalog_in: p.catalog, on: p.parent, locked: p.locked || undefined })),
  };
}
// Fog height: THE per-room fog control (Harry 2026-10-05). r.fog = ft, 0 = no fog (the slider snaps to it), null = the
// room type's default (data/fog_defaults.json) under the Atmosphere preset; fx/index.js hands it to the atmosphere.
function showRoomFog(r) {
  const def = window.fx?.atmos?.typeDefault?.(r.type, /yard|outdoor|garden|court|paddock|field/.test(r.type)) ?? 0, v = r.fog ?? def;
  $('#roomFog').value = v;
  $('#roomFogOut').textContent = (v > 0 ? `${+(+v).toFixed(2)} ft` : 'none') + (r.fog == null ? ' (type default)' : '');
}
function showRoom(r) {
  const t = typeByKey[r.type];
  $('#roomSwatch').style.background = t.color;
  $('#roomType').value = r.type;
  $('#roomMeta').textContent = `${r.w * CELL}×${r.d * CELL} ft · seed ${r.seed} · ${isOutdoor(r.type) ? 'no walls' : r.family} · ${r.layout.placements.length} objects`;
  $('#roomWalls').disabled = isOutdoor(r.type); $('#roomWalls').title = isOutdoor(r.type) ? 'A yard has no walls. Its edge is open (fence, hedge and stone wall arrive with their assets: docs/ASSETS_TO_BUILD.md).' : '';
  $('#roomFloor').value = r.floor || 'auto';
  $('#roomWalls').value = r.wallFamily || 'auto'; $('#roomWalls').options[0].text = `auto (${r.family})`;
  $('#roomFloor').options[0].text = `auto (${(r.floorUsed || '').replace('floor-', '')})`;
  showRoomFog(r);
  $('#summary').textContent = r.layout.summary + (r.lateNote ? `\n\n⚠ ${r.lateNote}` : '');
  $('#json').textContent = JSON.stringify(compactLayout(r), null, 1);
  $('#lockCount').textContent = r.locked.size ? `${r.locked.size} locked.` : '';
  setTimeout(refreshTagSprites, 50);
  refreshOccupancy();
}

// ---------------------------------------------------------------- input
let tool = null;
// The palette (2026-10-12): room types grouped by building type, as the game's Build tray groups them (data/types.json:
// the same codes, names and order; a room's first recipe, 'tav-common-room', names its type, so a new type or room
// needs no change here). One group is open at a time and this browser remembers which; the search box looks through
// every group. It lives at the top of the left column with its own scroll, so it never takes height from the stage.
// ?room=<key> picks a room tool, ?type=<code | name> opens a group, ?palette=open opens every group.
const palette = $('#palette'), pgroups = $('#pgroups'), psearch = $('#roomSearch');
const PKEY = 'tuner.palette.open';
const groupOf = (t) => {
  for (const rc of t.recipes || []) { const bt = buildTypes.find(b => rc.startsWith(b.code.toLowerCase() + '-')); if (bt) return bt; }
  return { code: (t.group || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: t.group || 'Other' }; // a room no type claims still shows, under its own heading
};
const groups = []; // [{ code, label, slug, tab, el, grid, rooms }] in the game's order, then anything unclaimed
for (const t of types) { t._g = groupOf(t); }
const ptabs = $('#ptabs');
for (const g of [...buildTypes, ...types.map(t => t._g)]) {
  if (groups.some(x => x.code === g.code)) continue;
  const rs = types.filter(t => t._g.code === g.code); if (!rs.length) continue;
  // a heading chip per building type (not a <button>: '#palette button' is the room types, and tests count them)
  const tab = document.createElement('div'); tab.className = 'pt'; tab.dataset.code = g.code; tab.tabIndex = 0; tab.setAttribute('role', 'button'); tab.setAttribute('aria-expanded', 'false');
  tab.innerHTML = `<span></span><small>${rs.length}</small>`; tab.firstChild.textContent = g.label; tab.title = `${g.label}: ${rs.length} room type${rs.length === 1 ? '' : 's'}`;
  const el = document.createElement('section'); el.className = 'pg'; el.dataset.code = g.code; el.hidden = true;
  const head = document.createElement('h4'); head.textContent = g.label;
  const grid = document.createElement('div'); grid.className = 'pgrid'; el.append(head, grid); ptabs.append(tab); pgroups.append(el);
  groups.push({ ...g, tab, el, grid, rooms: rs });
}
types.forEach((t, i) => {
  const b = document.createElement('button');
  b.innerHTML = `<i style="background:${t.color}"></i>${t.label} <kbd>${KEYS[i] || ''}</kbd>`;
  b.dataset.type = t.key; b.title = `${t.label}: ${t.recipes.join(', ')}`;
  b.dataset.find = `${t.label} ${t.key} ${t._g.label} ${t._g.code} ${t.recipes.join(' ')}`.toLowerCase();
  b.addEventListener('click', () => setTool(tool === t.key ? null : t.key));
  groups.find(g => g.code === t._g.code).grid.append(b);
  const og = groups.find(g => g.code === t._g.code); // the room panel's type list is grouped the same way
  if (!og.opt) { og.opt = document.createElement('optgroup'); og.opt.label = og.label; }
  og.opt.append(new Option(t.label, t.key));
});
for (const g of groups) $('#roomType').append(g.opt);
const paletteButtons = () => palette.querySelectorAll('button[data-type]');
let pOpen = null, pSearching = false, pAll = qs.get('palette') === 'open';
function showGroups() { // one group open, the rest shut (every one open under ?palette=open; every one with a match while searching)
  for (const g of groups) {
    const any = [...g.grid.children].some(b => !b.hidden), open = pSearching ? any : (pAll || g.code === pOpen);
    g.el.hidden = !open; g.tab.hidden = pSearching && !any;
    g.tab.classList.toggle('open', open); g.tab.setAttribute('aria-expanded', String(open));
  }
}
function openGroup(code, remember = true) {
  if (code != null && !groups.some(g => g.code === code)) return;
  pOpen = code; showGroups();
  if (remember && code) { try { localStorage.setItem(PKEY, code); } catch {} }
}
for (const g of groups) {
  const press = () => {
    if (pSearching) { g.el.scrollIntoView({ block: 'nearest' }); return; } // while searching a heading jumps to its matches
    if (pAll) { pAll = false; openGroup(g.code); return; }
    openGroup(pOpen === g.code ? null : g.code);
  };
  g.tab.addEventListener('click', press);
  g.tab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); press(); } });
}
function filterPalette(q) {
  q = (q || '').trim().toLowerCase(); pSearching = !!q; const words = q.split(/\s+/).filter(Boolean);
  let n = 0;
  for (const b of paletteButtons()) { const hit = !q || words.every(w => b.dataset.find.includes(w)); b.hidden = !hit; if (hit && q) n++; }
  showGroups();
  $('#pnone').hidden = !q || n > 0; palette.classList.toggle('searching', !!q);
  return n;
}
psearch.addEventListener('input', () => filterPalette(psearch.value));
psearch.addEventListener('keydown', e => {
  if (e.key === 'Escape') { psearch.value = ''; filterPalette(''); psearch.blur(); e.stopPropagation(); }
  else if (e.key === 'Enter') { const b = [...paletteButtons()].find(x => !x.hidden); if (b) { psearch.value = ''; pSearching = false; setTool(b.dataset.type); filterPalette(''); psearch.blur(); } }
});
function setTool(k) {
  if (k != null && !typeByKey[k]) return;
  tool = k;
  for (const b of paletteButtons()) b.classList.toggle('active', b.dataset.type === k);
  for (const g of groups) g.tab.classList.toggle('has', !!k && typeByKey[k]._g.code === g.code); // the heading of the tool's type is marked, open or shut
  if (k) { openGroup(typeByKey[k]._g.code); palette.querySelector('button.active')?.scrollIntoView({ block: 'nearest' }); } // a tool chosen by key or URL shows in its group
  $('#hint').textContent = k ? `Drag on the grid to lay out a ${typeByKey[k].label.toLowerCase()} (click = default ${typeByKey[k].cells.map(c => c * CELL).join('×')} ft). Esc = no tool.` : 'Pick a room type, then drag on the grid. Esc = no tool. Drag = pan · middle-drag = orbit · wheel = zoom.';
  canvas.style.cursor = k ? 'crosshair' : 'grab';
}
{ // which group starts open: ?type=, else the group of ?room=, else the one this browser used last, else the first
  const want = (qs.get('type') || '').toLowerCase();
  const byUrl = want && groups.find(g => [g.code, g.label, g.slug].some(v => (v || '').toLowerCase() === want) || g.label.toLowerCase().startsWith(want));
  let last = null; try { last = localStorage.getItem(PKEY); } catch {}
  openGroup((byUrl || groups.find(g => g.code === last) || groups[0])?.code ?? null, !!byUrl);
  setTool(typeByKey[qs.get('room')] ? qs.get('room') : null);
}

const preview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#b9d45d', transparent: true, opacity: 0.25, depthWrite: false }));
preview.visible = false; scene.add(preview);
let previewLabel = null;
let drag = null; // {mode:'draw'|'cam', x, y, moved, startCell, button}

function cellAt(x, y) { const p = cam.groundAt(x, y); return p ? { i: Math.floor(p.x / CELL), j: Math.floor(p.z / CELL), p } : null; }
function rectFrom(a, b) { return { x: Math.min(a.i, b.i), z: Math.min(a.j, b.j), w: Math.abs(a.i - b.i) + 1, d: Math.abs(a.j - b.j) + 1 }; }
function rectValid(rc) { return rc.x >= 0 && rc.z >= 0 && rc.x + rc.w <= WORLD / CELL && rc.z + rc.d <= WORLD / CELL && !rooms.some(r => overlaps(rc, r)); }
function showPreview(rc) {
  const ok = rectValid(rc);
  preview.visible = true;
  preview.scale.set(rc.w * CELL, 0.4, rc.d * CELL);
  preview.position.set((rc.x + rc.w / 2) * CELL, 0.2, (rc.z + rc.d / 2) * CELL);
  preview.material.color.set(ok ? '#b9d45d' : '#d9654f');
  previewLabel?.removeFromParent();
  previewLabel = textSprite(`${rc.w * CELL} × ${rc.d * CELL} ft${ok ? '' : '  (overlaps)'}`, { size: 48, bg: 'rgba(20,21,16,0.8)', worldH: 3 });
  previewLabel.position.set((rc.x + rc.w / 2) * CELL, 3, (rc.z + rc.d / 2) * CELL);
  scene.add(previewLabel);
}
function hidePreview() { preview.visible = false; previewLabel?.removeFromParent(); previewLabel = null; }

const raycaster = new THREE.Raycaster();
function pickAll(x, y) { // every visible item under the cursor, nearest first, each once
  raycaster.setFromCamera(cam.ndc(x, y), camera);
  const out = [];
  for (const h of raycaster.intersectObjects(world.children, true)) {
    let o = h.object; while (o && !o.userData.item) o = o.parent;
    if (o && o.visible && !out.includes(o.userData.item)) out.push(o.userData.item);
  }
  return out;
}
function pickItem(x, y) { return pickAll(x, y)[0] || null; }
function roomAtPoint(p) { return rooms.find(r => { const rc = roomRect(r); return p.x >= rc.x0 && p.x <= rc.x1 && p.z >= rc.z0 && p.z <= rc.z1; }); }

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); // no autoscroll on middle-drag
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  cam.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cam.pointers.size === 2) { drag = null; hidePreview(); cam.pinchStart(); return; }
  const draw = e.button === 0 && tool && !e.shiftKey;
  // left-drag ON the selected object moves it (Harry's edits are recorded); anywhere else the usual pan/orbit
  if (e.button === 0 && !tool && !e.shiftKey && selObj && selObj.roomId && !['floor', 'walls', 'openings'].includes(selObj.layer) && pickAll(e.clientX, e.clientY).some(h => h === selObj || (h.spec.parent && h.spec.parent === selObj.spec.uid))) {
    const hit = cam.groundAt(e.clientX, e.clientY, selObj.rest.y);
    if (hit) { drag = { mode: 'move', x: e.clientX, y: e.clientY, moved: false, button: 0, it: selObj, off: [selObj.rest.x - hit.x, selObj.rest.z - hit.z] }; beginEdit(selObj); return; }
  }
  drag = { mode: draw ? 'draw' : 'cam', x: e.clientX, y: e.clientY, moved: false, button: e.button, shift: e.shiftKey };
  if (draw) drag.start = cellAt(e.clientX, e.clientY);
  else { if (e.button === 1) e.preventDefault(); cam.beginGrab(e.clientX, e.clientY, e.button === 1 || (e.button === 0 && e.shiftKey) ? 'orbit' : 'pan'); }
});
canvas.addEventListener('pointermove', e => {
  if (cam.pointers.has(e.pointerId)) cam.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cam.pinch && cam.pointers.size === 2) { cam.pinchMove(); return; }
  if (!drag) { hover(e); return; }
  if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true;
  if (drag.mode === 'move') { if (drag.moved) { const hit = cam.groundAt(e.clientX, e.clientY, drag.it.rest.y); if (hit) setPose(drag.it, hit.x + drag.off[0], hit.z + drag.off[1], drag.it.rest.rot); } return; }
  if (drag.mode === 'cam') { if (drag.moved) cam.dragTo(e.clientX, e.clientY); }
  else if (drag.start && drag.moved) { const c = cellAt(e.clientX, e.clientY); if (c) { drag.rect = rectFrom(drag.start, c); showPreview(drag.rect); } }
});
async function endPointer(e) {
  cam.pointers.delete(e.pointerId);
  if (cam.pinch) { if (cam.pointers.size < 2) cam.pinch = null; return; }
  const d = drag; drag = null; cam.endGrab();
  if (!d) return;
  if (d.mode === 'move') { if (d.moved) commitEdit(d.it); else if (!objEdits.get(d.it.tag)?.to) objEdits.delete(d.it.tag); return; }
  if (d.mode === 'draw') {
    hidePreview();
    const inside = !d.moved && d.start ? roomAtPoint(d.start.p) : null;
    if (inside) { select(inside.id); return; } // with a tool, clicking an existing room still selects it
    let rc = d.rect;
    if (!d.moved && d.start) { // click = default-size room at the cursor
      const [w, dd] = typeByKey[tool].cells;
      rc = { x: d.start.i - Math.floor((w - 1) / 2), z: d.start.j - Math.floor((dd - 1) / 2), w, d: dd };
    }
    if (!rc) return;
    if (!rectValid(rc)) { toast('That overlaps another room (or leaves the grid). Rooms can touch, not overlap.', true); return; }
    await createRoom(tool, rc.x, rc.z, rc.w, rc.d);
    return;
  }
  if (!d.moved && d.button === 0) { // click: select a room, shift-click locks an object
    const stack = pickAll(e.clientX, e.clientY).filter(i => i.tag || i.layer === 'floor');
    let it = stack[0] || null;
    const at = stack.indexOf(selObj);
    if (selObj && at >= 0 && stack.length > 1 && !d.shift) it = stack[(at + 1) % stack.length]; // click again: next one down
    if (it && d.shift && it.roomId && it.spec.layer !== 'floor' && it.spec.layer !== 'walls' && it.spec.layer !== 'openings') { toggleLock(it); return; }
    const r = it?.roomId ? roomById(it.roomId) : roomAtPoint(cam.groundAt(e.clientX, e.clientY) || { x: -1, z: -1 });
    select(r ? r.id : null);
    selectObject(it && it.tag ? it : null); // floor tiles and empty ground select the room only
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1 / 0.9 : 0.9); }, { passive: false });

let selObj = null, selMark = null, selLabel = null;
function objectBox(it) { const [w, h, d] = it.spec.dims || [1, 1, 1]; return [Math.max(0.3, w), Math.max(0.15, h), Math.max(0.3, d)]; }
function selectObject(it) {
  selMark?.removeFromParent(); selLabel?.removeFromParent(); selMark = selLabel = null;
  selObj = it || null;
  selLab?.select(selObj);
  $('#objPanel').hidden = !selObj;
  if (!selObj) return;
  const [w, h, d] = objectBox(it);
  selMark = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.3, h + 0.3, d + 0.3)), new THREE.LineBasicMaterial({ color: '#4fe3ff', depthTest: false }));
  selMark.position.y = it.spec.orient === 'wall' ? h / 2 : h / 2; selMark.renderOrder = 11; it.group.add(selMark);
  if (selLab) selMark.visible = false; // the lab draws the selection now
  selLabel = textSprite(it.tag, { size: 64, color: '#141510', bg: '#4fe3ff', worldH: 1.8 });
  selLabel.position.set(it.rest.x, it.rest.y + h + 1.6, it.rest.z); scene.add(selLabel);
  const sp = it.spec, o = lib.objects[sp.id], rec = o?.skus.find(k => k.sku === sp.sku), m = rec?.model;
  const r = roomById(it.roomId);
  $('#objTag').textContent = it.tag;
  $('#objNote').value = objNotes.get(it.tag)?.note || ''; $('#objNoteState').textContent = objNotes.has(it.tag) ? 'has a note' : '';
  const ed = objEdits ? objEdits.get(it.tag) : null;
  $('#objEdit').textContent = ed?.to ? `edited: moved ${ed.moved_ft} ft, turned ${ed.turned_deg}°` : 'drag it, arrows nudge, [ ] turn';
  $('#resetObj').hidden = !ed?.to;
  $('#objInfo').textContent = [
    `${sp.id}${sp.sku && sp.sku !== sp.id ? `  (${sp.sku})` : ''}`,
    `${sp.rule || (sp.layer === 'walls' || sp.layer === 'openings' ? 'wall piece' : sp.layer)}${sp.why ? ': ' + sp.why : ''}`,
    `catalog W×D×H ${o ? o.size.map(v => Math.round(v)).join('×') + ' in' : '–'} · placed ${sp.dims ? [sp.dims[0], sp.dims[2], sp.dims[1]].map(v => Math.round(v * 12)).join('×') + ' in' : '–'}`,
    `at x ${it.rest.x.toFixed(1)}, z ${it.rest.z.toFixed(1)} ft${it.rest.y > 0.05 ? `, ${it.rest.y.toFixed(1)} ft up` : ''} · facing ${Math.round(((it.rest.rot * 180 / Math.PI) % 360 + 360) % 360)}°`,
    `mesh yaw ${Math.round(meshYawDeg(sp))}°${corrected.has(meshOf(sp.sku)) ? ' (corrected)' : orientFile[meshOf(sp.sku)] != null ? ' (front sweep)' : ''} · R / Shift+R turn ±${sp.place === 'kit' ? 90 : 45}°`,
    `room: ${r ? `${typeByKey[r.type].label} (${r.id})` : '–'}`,
    m ? `model rating ${m.stars ?? '–'}★${m.masking ? ' · masking flag' : ''}${m.note ? ' · ' + m.note.slice(0, 80) : ''}` : 'unrated',
    it.lockMark ? '🔒 locked' : '',
  ].filter(Boolean).join('\n');
}
// Harry's orientation correction (2026-10-01): R / Shift+R turn the selected mesh +/-45 deg (kit pieces 90: they are
// stretched per axis). It applies to the mesh (sku.mesh): every instance turns now; the next roll uses it for the footprint.
let testNote = ''; // acceptance tests tag their write-backs so archive_test_writes.py can move them
async function rotateSelected(dir) {
  const it = selObj; if (!it) { toast('select an object first', true); return; }
  const sp = it.spec;
  if (sp.kind !== 'mesh' || !sp.sku) { toast(`${sp.id} has no mesh to turn`, true); return; }
  const step = sp.place === 'kit' ? 90 : 45;
  const prev = meshYawDeg(sp);
  let next = Math.round((prev + dir * step) / 45) * 45; next = ((next + 180) % 360 + 360) % 360 - 180; if (next === -180) next = 180;
  const mesh = meshOf(sp.sku); if (!mesh) { toast(`${sp.sku} has no mesh id`, true); return; }
  orient[mesh] = next; orientLocal[mesh] = next; corrected.add(mesh);
  try { localStorage.setItem('tuner.orient.v2', JSON.stringify(orientLocal)); } catch { }
  const same = [...items].filter(i => i.spec.sku === sp.sku);
  await Promise.all(same.map(swapVisual));
  selectObject(it);
  send('orient', sp.sku, { sku: sp.sku, mesh, yaw_deg: next, prev_deg: Math.round(prev), object: sp.id, tag: it.tag }, testNote).then(ok => { lastOrientSend = { sku: sp.sku, ok }; });
  toast(`${sp.sku}: front turned to ${next}° (${same.length} on screen); the next roll uses it for the footprint`);
}
let lastOrientSend = null;

// Object notes (Harry 2026-10-01: "asset specific feedback, like where to put a fork"): one note per tag, collected
// across the map, bundled by Send whole map. Kept in localStorage so a reload doesn't lose them.
const objNotes = new Map();
try { for (const n of JSON.parse(localStorage.getItem('tuner.objNotes') || '[]')) objNotes.set(n.tag, n); } catch { }
function saveNotes() { try { localStorage.setItem('tuner.objNotes', JSON.stringify([...objNotes.values()])); } catch { } renderNoteList(); }
function noteFor(it) {
  const r = roomById(it.roomId), sp = it.spec;
  return { tag: it.tag, id: sp.id, sku: sp.sku, rule: sp.rule, why: sp.why, layer: sp.layer, zone: sp.zone, room: r ? r.id : null, roomType: r ? r.type : null,
    at: [+it.rest.x.toFixed(2), +it.rest.y.toFixed(2), +it.rest.z.toFixed(2)], facing_deg: Math.round(it.rest.rot * 180 / Math.PI), dims_ft: sp.dims };
}
function saveObjNote() {
  if (!selObj) return;
  const text = $('#objNote').value.trim();
  if (text) objNotes.set(selObj.tag, { ...noteFor(selObj), note: text, at_time: new Date().toISOString() });
  else objNotes.delete(selObj.tag);
  saveNotes(); $('#objNoteState').textContent = text ? `saved for ${selObj.tag}` : 'cleared';
}
function renderNoteList() {
  const box = $('#noteList'); box.innerHTML = '';
  const edits = objEdits ? [...objEdits.values()].filter(e => e.to) : [];
  if (!objNotes.size && !edits.length) return;
  const head = document.createElement('div'); head.innerHTML = `<span class="muted">${objNotes.size} note${objNotes.size === 1 ? '' : 's'}, ${edits.length} move/turn${edits.length === 1 ? '' : 's'} ready to send</span>`; box.append(head);
  for (const e of edits) {
    const row = document.createElement('div');
    row.innerHTML = `<b title="select">${e.tag}</b><span>${e.id}: moved ${e.moved_ft} ft, turned ${e.turned_deg}°</span><button title="put it back">↶</button>`;
    row.querySelector('b').addEventListener('click', () => { const it = [...items].find(i => i.tag === e.tag); if (it) { select(it.roomId); selectObject(it); } });
    row.querySelector('button').addEventListener('click', () => { const it = [...items].find(i => i.tag === e.tag); if (it) resetEdit(it); else { objEdits.delete(e.tag); saveEdits(); } });
    box.append(row);
  }
  for (const n of objNotes.values()) {
    const row = document.createElement('div');
    row.innerHTML = `<b title="select">${n.tag}</b><span>${n.id}: ${n.note.replace(/</g, '&lt;')}</span><button title="remove">×</button>`;
    row.querySelector('b').addEventListener('click', () => { const it = [...items].find(i => i.tag === n.tag); if (it) { select(it.roomId); selectObject(it); } else toast(`${n.tag} isn't in the scene any more`, true); });
    row.querySelector('button').addEventListener('click', () => { objNotes.delete(n.tag); saveNotes(); });
    box.append(row);
  }
}
$('#saveObjNote').addEventListener('click', saveObjNote);
$('#resetObj').addEventListener('click', () => selObj && resetEdit(selObj));
$('#objNote').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveObjNote(); } });
$('#objNote').addEventListener('blur', () => { if (selObj && $('#objNote').value.trim() !== (objNotes.get(selObj.tag)?.note || '')) saveObjNote(); });
renderNoteList();

// Object edits (Harry 2026-10-01: "let me rotate them and move them, and record those transformations, so you can
// see what I'm doing with them and infer from that"). One record per tag: the solver's original pose, Harry's final pose,
// and context at both ends (nearest wall, door, neighbours, the surface it sits on) so rules can be inferred.
var objEdits = new Map(); // var: renderNoteList() runs before this line
try { for (const n of JSON.parse(localStorage.getItem('tuner.objEdits') || '[]')) objEdits.set(n.tag, n); } catch { }
function saveEdits() { try { localStorage.setItem('tuner.objEdits', JSON.stringify([...objEdits.values()])); } catch { } renderNoteList(); }
const r2 = v => +v.toFixed(2);
function poseOf(it) { return { x: r2(it.rest.x), y: r2(it.rest.y), z: r2(it.rest.z), facing_deg: Math.round(((it.rest.rot * 180 / Math.PI) % 360 + 360) % 360) }; }
function contextOf(it) {
  const r = roomById(it.roomId); if (!r) return {};
  const rc = roomRect(r), x = it.rest.x, z = it.rest.z;
  const walls = { N: z - (rc.z0 + 0.5), S: (rc.z1 - 0.5) - z, W: x - (rc.x0 + 0.5), E: (rc.x1 - 0.5) - x };
  const [side, dist] = Object.entries(walls).sort((a, b) => a[1] - b[1])[0];
  const doors = [...edgesNow.edges.values()].filter(e => e.kind === 'door' && e.sides.some(q => q.room === r.id)).map(e => { const t = edgeTransform(e); return { key: e.key, d: Math.hypot(t.x - x, t.z - z) }; }).sort((a, b) => a.d - b.d);
  const near = [...r.items].filter(o => o !== it && o.tag && o.spec.layer !== 'floor').map(o => ({ tag: o.tag, id: o.spec.id, d: Math.hypot(o.rest.x - x, o.rest.z - z) })).sort((a, b) => a.d - b.d).slice(0, 4).map(o => ({ ...o, d: r2(o.d) }));
  const under = it.rest.y > 0.3 ? [...r.items].filter(o => o !== it && !o.spec.parent && o.spec.dims && Math.abs(o.rest.y + o.spec.dims[1] - it.rest.y) < 0.25 && Math.abs(o.rest.x - x) < o.spec.dims[0] && Math.abs(o.rest.z - z) < o.spec.dims[0]).map(o => ({ tag: o.tag, id: o.spec.id }))[0] : null;
  // facing relative to the nearest wall: 0 = back to that wall, 180 = facing it
  const away = { N: 0, S: 180, W: 90, E: -90 }[side];
  const rel = Math.round((((it.rest.rot * 180 / Math.PI - away) % 360) + 540) % 360 - 180);
  return { nearest_wall: side, wall_ft: r2(dist), facing_vs_wall_deg: rel, nearest_door_ft: doors[0] ? r2(doors[0].d) : null, on: under, neighbours: near };
}
function placementOf(it) { const r = roomById(it.roomId); return r?.layout.placements.find(p => p.uid === it.spec.uid); }
function setPose(it, x, z, rot, carry = true) {
  const dx = x - it.rest.x, dz = z - it.rest.z;
  it.rest.x = x; it.rest.z = z; it.rest.rot = rot; it.x = x; it.z = z;
  it.group.position.set(x, it.rest.y, z); it.group.rotation.set(0, rot, 0);
  const p = placementOf(it); if (p) { p.x = r2(x); p.z = r2(z); p.rot = +rot.toFixed(4); p.edited = true; }
  settler.enqueue(it); // re-settle where it now stands (riders are re-queued by their own setPose)
  if (carry && (dx || dz)) { // things sitting on it ride along (move a table, its plates come too)
    const r = roomById(it.roomId);
    for (const o of r?.items || []) if (o.spec.parent && o.spec.parent === it.spec.uid) setPose(o, o.rest.x + dx, o.rest.z + dz, o.rest.rot, false);
  }
  if (selLabel && it === selObj) selLabel.position.set(x, selLabel.position.y, z);
}
function beginEdit(it) { if (!objEdits.has(it.tag)) objEdits.set(it.tag, { ...noteFor(it), from: poseOf(it), context_from: contextOf(it), edits: 0 }); }
function commitEdit(it) {
  const e = objEdits.get(it.tag); if (!e) return;
  e.to = poseOf(it); e.context_to = contextOf(it); e.edits++;
  e.moved_ft = r2(Math.hypot(e.to.x - e.from.x, e.to.z - e.from.z)); e.turned_deg = ((e.to.facing_deg - e.from.facing_deg + 540) % 360) - 180;
  e.at_time = new Date().toISOString();
  const r = roomById(it.roomId), p = placementOf(it);
  if (r && p && !r.locked.has(p.uid)) { r.locked.set(p.uid, { ...p }); markLocked(it, true); } // an edited object survives Roll again
  saveEdits(); if (selObj === it) selectObject(it);
  if (r && selected === r.id) showRoom(r);
}
function resetEdit(it) {
  const e = objEdits.get(it.tag); if (!e) return;
  setPose(it, e.from.x, e.from.z, e.from.facing_deg * Math.PI / 180);
  objEdits.delete(it.tag); saveEdits(); selectObject(it); toast(`${it.tag} back where the solver put it`);
}
function nudgeSelected(dx, dz, drot) {
  const it = selObj; if (!it || !it.roomId || ['floor', 'walls', 'openings'].includes(it.layer)) return false;
  beginEdit(it);
  setPose(it, it.rest.x + dx, it.rest.z + dz, it.rest.rot + drot);
  clearTimeout(nudgeSelected.t); nudgeSelected.t = setTimeout(() => commitEdit(it), 250);
  return true;
}

// The whole map in one payload: every room, doors, object notes, and the context to reproduce it.
function mapPayload() {
  return {
    rooms: rooms.map(r => ({ id: r.id, type: r.type, rect_cells: [r.x, r.z, r.w, r.d], seed: r.seed, wallSeed: r.wallSeed, walls: r.family, floor: r.floorUsed, ...compactLayout(r) })),
    doors: [...edgesNow.edges.values()].filter(e => e.kind === 'door').map(e => ({ key: e.key, type: e.doorType, span_ft: (e.span || 1) * CELL, rooms: e.sides.map(x => x.room), sides: e.sides.map(x => x.side) })),
    objectNotes: [...objNotes.values()],
    objectEdits: [...objEdits.values()],
    selectedObject: selObj ? noteFor(selObj) : undefined,
    summaries: Object.fromEntries(rooms.map(r => [r.id, r.layout.summary])),
    preset: clone(preset), camera: { focus: cam.focus.toArray(), yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist },
    solver: solverOpts(), engine: $('#engine')?.value, bench: lastStats, url: location.href,
  };
}
$('#sendMap').addEventListener('click', async () => {
  if (!rooms.length) { toast('No rooms on the map yet', true); return; }
  const data = mapPayload(), note = $('#layoutNote').value.trim();
  const kb = Math.round(JSON.stringify(data).length / 1024);
  if (await send('map', `map-${rooms.length}rooms-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`, data, note || testNote)) {
    $('#layoutNote').value = '';
    const n = objNotes.size, m = objEdits.size; objNotes.clear(); objEdits.clear(); saveNotes(); saveEdits();
    toast(`sent the whole map: ${rooms.length} rooms, ${n} object note${n === 1 ? '' : 's'}, ${m} edit${m === 1 ? '' : 's'}, ${kb} KB`);
  }
});
$('#copyMap').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(JSON.stringify({ note: $('#layoutNote').value.trim(), ...mapPayload() })); toast('whole map copied as JSON'); } catch { toast('clipboard blocked', true); }
});
$('#rotL').addEventListener('click', () => rotateSelected(+1));
$('#rotR').addEventListener('click', () => rotateSelected(-1));
const tagSprites = [];
function refreshTagSprites() {
  tagSprites.forEach(s => s.removeFromParent()); tagSprites.length = 0;
  if (!$('#showTags')?.checked || !selected) return;
  let k = 0;
  for (const it of items) {
    if (!it.tag || it.roomId !== selected || !it.group.visible) continue;
    const [, h] = objectBox(it);
    const small = it.spec.parent || h < 1; // tabletop clutter: smaller labels, staggered heights so clusters stay readable
    const sp = textSprite(it.tag, { size: 48, color: '#f1e8d6', bg: 'rgba(20,21,16,0.8)', worldH: small ? 0.7 : 1.1 });
    sp.position.set(it.rest.x, it.rest.y + h + (small ? 0.5 + (k++ % 3) * 0.75 : 0.8), it.rest.z); scene.add(sp); tagSprites.push(sp);
  }
}

function toggleLock(it) {
  const r = roomById(it.roomId); if (!r) return;
  const p = r.layout.placements.find(p => p.uid === it.spec.uid);
  if (r.locked.has(it.spec.uid)) { r.locked.delete(it.spec.uid); markLocked(it, false); toast(`unlocked ${it.spec.id}`); }
  else if (p) { r.locked.set(p.uid, { ...p }); markLocked(it, true); toast(`locked ${it.spec.id}: it stays put on Roll again`); }
  if (selected === r.id) showRoom(r);
}
function markLocked(it, on) {
  it.lockMark?.removeFromParent(); it.lockMark = null;
  if (!on) return;
  const [w, h, d] = it.spec.dims;
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.2, h + 0.2, d + 0.2)), new THREE.LineBasicMaterial({ color: '#ffd166' }));
  box.position.y = h / 2; it.group.add(box); it.lockMark = box;
}

const tip = $('#tooltip');
let hoverT = 0;
function hover(e) {
  const now = performance.now(); if (now - hoverT < 50) return; hoverT = now;
  const it = pickItem(e.clientX, e.clientY);
  selLab?.hover(it?.tag && it.layer !== 'floor' ? it : null);
  if (!it || !it.spec.id) { tip.hidden = true; return; }
  const s = it.spec, o = lib.objects[s.id];
  const skuRec = o?.skus.find(k => k.sku === s.sku);
  const stars = skuRec?.model?.stars;
  const cat = o ? o.size.map(v => Math.round(v)).join('×') + ' in' : '';
  const act = s.dims ? s.dims.map(v => Math.round(v * 12)).join('×') + ' in' : '';
  tip.textContent = `${it.tag ? `[${it.tag}] ` : ''}${s.id}${s.sku && s.sku !== s.id ? `  (${s.sku})` : ''}\n${s.rule ? s.rule + ': ' : ''}${s.why || s.layer}\ncatalog W×D×H ${cat} · placed ${act}${stars != null ? `\nmodel rating ${stars}★${skuRec.model.note ? ' · ' + skuRec.model.note.slice(0, 60) : ''}` : '\nunrated'}${s.sku && s.kind === 'mesh' ? `\nmesh yaw ${Math.round(meshYawDeg(s))}°${corrected.has(s.sku) ? ' (corrected)' : ''}` : ''}${it.lockMark ? '\n🔒 locked' : ''}`;
  const rc = $('#stage').getBoundingClientRect();
  tip.style.left = Math.min(rc.width - 330, e.clientX - rc.left + 14) + 'px'; tip.style.top = (e.clientY - rc.top + 14) + 'px';
  tip.hidden = false;
}
canvas.addEventListener('pointerleave', () => { tip.hidden = true; selLab?.hover(null); });

window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  const k = e.key.toLowerCase();
  if (k === 'r') { e.preventDefault(); rotateSelected(e.shiftKey ? -1 : +1); return; }
  if (selObj && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', '[', ']', '{', '}'].includes(k)) {
    // camera-relative nudges: up = away from the camera; 3 in, Shift 1 ft; [ ] turn this one object 15 deg, Shift 45
    const step = e.shiftKey ? 1 : 0.25, y = cam.yaw * Math.PI / 180;
    const f = [-Math.sin(y), -Math.cos(y)], rt = [Math.cos(y), -Math.sin(y)];
    const mv = { arrowup: f, arrowdown: [-f[0], -f[1]], arrowright: rt, arrowleft: [-rt[0], -rt[1]] }[k];
    const turn = (k === '[' || k === '{') ? 1 : (k === ']' || k === '}') ? -1 : 0;
    if (nudgeSelected(mv ? mv[0] * step : 0, mv ? mv[1] * step : 0, turn * (e.shiftKey ? 45 : 15) * Math.PI / 180)) e.preventDefault();
    return;
  }
  if (['q', 'e', 'pageup', 'pagedown'].includes(k)) { e.preventDefault(); cam.keys.add(k); return; }
  const ti = KEYS.indexOf(e.key);
  if (ti >= 0 && types[ti]) { setTool(tool === types[ti].key ? null : types[ti].key); return; }
  if (e.key === '/') { e.preventDefault(); psearch.focus(); psearch.select(); return; } // find a room type
  if (k === 'escape') { setTool(null); selectObject(null); select(null); return; }
  if (k === ' ') { e.preventDefault(); replay(); return; }
  if (k === 'p') { togglePause(); return; }
  if (k === 'b') { toggleAB(); return; }
  if (k === 'n' && selected) { rollRoom(roomById(selected)); return; }
  if ((k === 'delete' || k === 'backspace') && selected) { deleteRoom(roomById(selected)); return; }
  const r = roomById(selected), center = r ? { x: (roomRect(r).x0 + roomRect(r).x1) / 2, z: (roomRect(r).z0 + roomRect(r).z1) / 2 } : null;
  if (k === 't') cam.preset('top', center);
  if (k === 'g') cam.preset('table', center);
  if (k === 'h') cam.preset('home', center);
});
window.addEventListener('keyup', e => cam.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => cam.keys.clear());

// ---------------------------------------------------------------- playback + presets UI
let sideTab = 'in';
function onDial() {
  savePresetLocal();
  if ($('#autoReplay')?.checked !== false) { clearTimeout(onDial.t); onDial.t = setTimeout(() => replay(sideTab === 'out' ? 'outin' : 'in'), 350); }
}
function drawDials() {
  renderDials($('#dials'), preset, sideTab, onDial);
  $('#mirror').checked = !!preset.out.mirror;
  $('#mirrorRow').hidden = sideTab !== 'out';
  $('#dials').style.opacity = sideTab === 'out' && preset.out.mirror ? 0.45 : 1;
  const auto = document.createElement('label'); auto.className = 'check';
  auto.innerHTML = `<input type="checkbox" id="autoReplay" ${replayOnChange ? 'checked' : ''}> Replay on every dial change`;
  auto.querySelector('input').addEventListener('change', ev => { replayOnChange = ev.target.checked; });
  $('#dials').prepend(auto);
}
let replayOnChange = true;
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  sideTab = b.dataset.side; document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('active', x === b)); drawDials();
}));
$('#mirror').addEventListener('change', e => { preset.out.mirror = e.target.checked; drawDials(); onDial(); });
drawDials();

function replayTargets() {
  const r = roomById(selected);
  const list = r ? [r] : rooms;
  const its = [];
  for (const rr of list) {
    its.push(...(floorItems.get(rr.id) || []), ...rr.items);
    for (const w of wallItems.values()) if (w.items.some(i => i.roomId === rr.id)) its.push(...w.items);
  }
  if (!r) for (const c of cornerItems.values()) its.push(c.item);
  const rect = list.length ? list.map(roomRect).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) })) : { x0: 0, z0: 0, x1: 1, z1: 1 };
  return { its: [...new Set(its)], rect, door: r ? doorPoint(r) : null };
}
function replay(kind = 'in') {
  if (!rooms.length) return;
  paused = false; $('#pause').textContent = 'Pause';
  const { its, rect, door } = replayTargets();
  if (kind === 'outin') {
    const ep = play(its, 'out', rect, door, () => play(its, 'in', rect, door));
    return ep;
  }
  return play(its, 'in', rect, door);
}
function togglePause() { paused = !paused; $('#pause').textContent = paused ? 'Resume' : 'Pause'; }
$('#replay').addEventListener('click', () => replay('in'));
$('#replayOut').addEventListener('click', () => replay('outin'));
$('#replayRoom').addEventListener('click', () => replay('in'));
$('#pause').addEventListener('click', togglePause);
const setSpeed = (v) => { preset.speed = v; $('#speed').value = v; $('#speedOut').textContent = `${v}×`; savePresetLocal(); };
$('#speed').addEventListener('input', e => setSpeed(+e.target.value));
document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));
setSpeed(preset.speed || 1);
$('#scrub').addEventListener('input', e => {
  if (!scrubEp) return;
  paused = true; $('#pause').textContent = 'Resume';
  const local = (+e.target.value / 1000) * scrubEp.total;
  if (!episodes.includes(scrubEp)) { episodes.push(scrubEp); }
  clock = scrubEp.start + local;
  for (const ep of episodes) evalEpisode(ep, clock - ep.start);
  $('#scrubOut').textContent = `${Math.round(local)} / ${Math.round(scrubEp.total)} ms`;
});

let slotA = null, slotB = null, onB = false;
const clone = (o) => JSON.parse(JSON.stringify(o));
function abState() { $('#abState').textContent = `A: ${slotA ? slotA.name : '—'} · B: ${slotB ? slotB.name : '—'}${slotA && slotB ? ` · showing ${onB ? 'B' : 'A'}` : ''}`; }
$('#storeA').addEventListener('click', () => { slotA = clone(preset); abState(); toast('stored the current dials as A'); });
$('#storeB').addEventListener('click', () => { slotB = clone(preset); abState(); toast('stored the current dials as B'); });
function toggleAB() {
  if (!slotA || !slotB) { toast('Store A and B first', true); return; }
  onB = !onB; preset = clone(onB ? slotB : slotA); drawDials(); setSpeed(preset.speed); abState(); replay('in');
}
$('#toggleAB').addEventListener('click', toggleAB);
abState();

function localPresets() { try { return JSON.parse(localStorage.getItem('tuner.presets')) || {}; } catch { return {}; } }
async function refreshPresetList() {
  const sel = $('#loadPreset'); sel.length = 1;
  for (const n of Object.keys(BUILTIN_PRESETS)) sel.append(new Option(`${n} (built-in)`, 'builtin:' + n));
  const local = localPresets();
  for (const n of Object.keys(local)) sel.append(new Option(`${n} (this browser)`, 'local:' + n));
  try {
    const remote = await fetch(`${API}/tuner/presets`).then(r => r.ok ? r.json() : {});
    for (const n of Object.keys(remote)) sel.append(new Option(`${n} (sent)`, 'remote:' + n));
    refreshPresetList.remote = remote;
  } catch { }
}
$('#savePreset').addEventListener('click', () => {
  const n = $('#presetName').value.trim() || 'untitled'; preset.name = n;
  const all = localPresets(); all[n] = clone(preset);
  try { localStorage.setItem('tuner.presets', JSON.stringify(all)); } catch { }
  refreshPresetList(); toast(`saved preset "${n}" in this browser`);
});
$('#loadPreset').addEventListener('change', e => {
  const v = e.target.value; if (!v) return;
  const [src, n] = [v.split(':')[0], v.slice(v.indexOf(':') + 1)];
  const p = src === 'builtin' ? BUILTIN_PRESETS[n]?.() : src === 'local' ? localPresets()[n] : refreshPresetList.remote?.[n]?.data;
  if (p) { preset = mergeDefaults(p); $('#presetName').value = preset.name; drawDials(); setSpeed(preset.speed); savePresetLocal(); replay('in'); toast(`loaded "${n}"`); }
  e.target.value = '';
});
$('#resetPreset').addEventListener('click', () => { preset = defaultPreset(); drawDials(); setSpeed(1); savePresetLocal(); replay('in'); });
$('#presetName').value = preset.name;

async function send(kind, name, data, note = '') {
  try {
    const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name, data, note }) });
    const j = await r.json();
    if (!r.ok || !j.ok) throw new Error(j.err || r.status);
    toast(`sent ${kind} "${name}" to Fauna (${j.at})`);
    return true;
  } catch (err) { toast(`send failed: ${err.message}. The ${kind} is still in this page; Copy works as a fallback.`, true); return false; }
}
// "Use in game": this preset becomes the game's house spawn animation (GET /tuner/house; engine/client loads it)
$('#houseAnim').addEventListener('click', async () => { const p = clone(preset); p.name = ($('#presetName').value.trim() || preset.name).replace(/[^A-Za-z0-9 ._-]/g, '-'); if (await send('house', 'house', { anim: p }, `spawn animation "${p.name}" is now the game's house look`)) animLink.used(p.name); });
$('#sendPreset').addEventListener('click', async () => { const n = ($('#presetName').value.trim() || preset.name).replace(/[^A-Za-z0-9 ._-]/g, '-'); preset.name = n; if (await send('preset', n, clone(preset))) animLink.sent(n); refreshPresetList(); });
animLink = houseLink({ api: API, key: 'anim', label: 'spawn animation', sendBtn: $('#sendPreset'), houseBtn: $('#houseAnim'), current: () => preset, norm: (p) => mergeDefaults(p), toast });
$('#sendLayout').addEventListener('click', async () => {
  const r = roomById(selected);
  const note = $('#layoutNote').value.trim();
  if (!r) { if (note) { if (await send('note', 'general', { rooms: rooms.map(compactLayout).map(l => l.room), preset: preset.name }, note)) $('#layoutNote').value = ''; } else toast('Select a room (or type a note) first', true); return; }
  const so = selObj && selObj.roomId === r.id ? { tag: selObj.tag, id: selObj.spec.id, sku: selObj.spec.sku, rule: selObj.spec.rule, why: selObj.spec.why, at: [selObj.rest.x, selObj.rest.y, selObj.rest.z] } : undefined;
  const data = { selectedObject: so, layout: compactLayout(r), summary: r.layout.summary, preset: clone(preset), camera: { focus: cam.focus.toArray(), yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist }, solver: solverOpts(), bench: lastStats };
  if (await send('layout', `${r.type}-${r.seed}`, data, note)) $('#layoutNote').value = '';
});
$('#copyTag').addEventListener('click', async () => {
  if (!selObj) return;
  try { await navigator.clipboard.writeText(selObj.tag); toast(`copied ${selObj.tag}`); } catch { toast(`tag ${selObj.tag} (clipboard blocked)`, true); }
});
$('#showTags').addEventListener('change', refreshTagSprites);
$('#showJson').addEventListener('click', () => { $('#json').hidden = !$('#json').hidden; });
$('#copyLayout').addEventListener('click', async () => {
  const r = roomById(selected); if (!r) return;
  try { await navigator.clipboard.writeText(r.layout.summary + '\n\n' + JSON.stringify(compactLayout(r), null, 1)); toast('layout copied'); } catch { toast('clipboard blocked; use the JSON box', true); }
});
refreshPresetList();

// room panel buttons
$('#roll').addEventListener('click', () => { const r = roomById(selected); if (r) rollRoom(r); });
$('#deleteRoom').addEventListener('click', () => { const r = roomById(selected); if (r) deleteRoom(r); });
for (const f of FLOORS) $('#roomFloor').append(new Option(f.replace('floor-', '').replace(/--/g, ' '), f));
$('#roomFloor').addEventListener('change', async e => {
  const r = roomById(selected); if (!r) return;
  busy++; try {
    r.floor = e.target.value;
    const its = await buildFloor(r);
    play(its, 'in', roomRect(r), doorPoint(r));
    showRoom(r);
  } finally { busy--; }
});
// ---- variant B wall kit UI (2026-10-02). Built from JS so index.html stays untouched (Harry is editing the panels).
// Per-room Walls dropdown gains the kit families; the bench gets a global "Wall kit" override for the whole map.
for (const f of KIT_FAMILIES) { const o = document.createElement('option'); o.value = f; o.textContent = KIT[f].label; $('#roomWalls').append(o); }
{
  const lab = document.createElement('label'); lab.className = 'dial'; lab.title = 'Flip every room on "auto" walls between the generated meshes (A) and the exact-module kit (B). A room set explicitly in its own Walls dropdown keeps that choice.';
  lab.innerHTML = '<span>Wall kit</span><select id="wallKit"><option value="generated">generated (room\'s own choice)</option><option value="kit">kit (nearest matching kit family)</option></select>';
  const anchor = $('#engine')?.closest('label');
  if (anchor) anchor.after(lab); else ($('#walls')?.closest('section') || document.body).append(lab);
  let init = qs.get('wallkit');
  if (!init) try { init = localStorage.getItem('tuner.wallKit'); } catch { }
  if (init === 'kit') $('#wallKit').value = 'kit';
}
function wallKitMode() { return $('#wallKit')?.value || 'generated'; }
$('#wallKit').addEventListener('change', async e => {
  try { localStorage.setItem('tuner.wallKit', e.target.value); } catch { }
  busy++; try {
    for (const r of rooms) r.family = familyFor(r, typeByKey[r.type].family, { kit: wallKitMode() === 'kit' });
    const anim = []; await syncWalls(anim);
    const rect = rooms.length ? rooms.map(roomRect).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) })) : { x0: 0, z0: 0, x1: 1, z1: 1 };
    play(anim, 'in', rect, null);
    const r = roomById(selected); if (r) showRoom(r);
    toast(`walls: ${wallKitMode() === 'kit' ? 'kit (B) on every auto room' : 'generated (A)'}`);
  } finally { busy--; }
});
$('#roomFog').addEventListener('input', e => { const r = roomById(selected); if (!r) return; let v = +e.target.value; if (v < 0.38) v = 0; r.fog = v; showRoomFog(r); }); // a notch at 0 = no fog
$('#roomFogAuto').addEventListener('click', () => { const r = roomById(selected); if (!r) return; r.fog = null; showRoomFog(r); });
$('#roomWalls').addEventListener('change', async e => {
  const r = roomById(selected); if (!r) return;
  busy++; try {
  r.wallFamily = e.target.value; r.family = familyFor(r, typeByKey[r.type].family, { kit: wallKitMode() === 'kit' });
  const anim = []; await syncWalls(anim); anim.push(...await buildFloor(r));
  play(anim, 'in', roomRect(r), doorPoint(r)); showRoom(r);
  } finally { busy--; }
});
$('#roomType').addEventListener('change', e => { const r = roomById(selected); if (r) changeType(r, e.target.value); });
$('#roll').title = 'N';

// ---------------------------------------------------------------- bench
let wallsOn = true;
function wallsVisible(on, reveal = true) {
  wallsOn = on;
  const all = [...[...wallItems.values()].flatMap(w => w.items), ...[...cornerItems.values()].map(c => c.item)];
  for (const it of all) { it.group.userData.hidden = !on; if (reveal && on && it.rested && !episodes.some(ep => ep.items.some(e => e.it === it))) it.group.visible = true; }
}
$('#walls').addEventListener('change', e => wallsVisible(e.target.checked));
async function applyLadder() {
  const box = $('#loading'); box.hidden = false;
  const all = [...items]; let n = 0;
  await Promise.all(all.map(it => swapVisual(it).finally(() => { box.textContent = `swapping faces & skins ${++n}/${all.length}`; })));
  box.hidden = true;
  if (bg.queue) { bg.queue = null; bgStart(); } // re-queue the background preload for the new levels
  const F = $('#lodFaces').selectedOptions[0].text, T = $('#lodTex').selectedOptions[0].text;
  toast(`faces: ${F} · skins: ${T}. Watch fps, triangles and texture memory.`);
}
for (const id of ['#lodFaces', '#lodTex', '#lodScope']) $(id).addEventListener('change', applyLadder);
$('#floorMode').addEventListener('change', async () => {
  const its = []; for (const r of rooms) its.push(...await buildFloor(r));
  its.forEach(restPose); toast(`floor tiling: ${$('#floorMode').selectedOptions[0].text}`);
});
$('#cubes').addEventListener('change', async e => { cubesOn = e.target.checked; await Promise.all([...items].map(swapVisual)); });
function setShadows(root, on) { root.traverse(o => { if (o.isMesh) { o.castShadow = on; o.receiveShadow = on; } }); }
$('#shadows').addEventListener('change', e => {
  shadowsOn = e.target.checked; renderer.shadowMap.enabled = shadowsOn; sun.castShadow = shadowsOn;
  setShadows(world, shadowsOn); ground.receiveShadow = true;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
});
function addSizeBoxes(it) {
  const o = lib.objects[it.spec.id]; if (!o || !it.spec.dims || it.layer === 'floor') return;
  const [cw, cd, ch] = o.size.map(v => v / 12), [w, h, d] = it.spec.dims;
  const mk = (a, b, c, col) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(a, b, c)), new THREE.LineBasicMaterial({ color: col })); l.position.y = b / 2; l.userData.sizeBox = true; return l; };
  it.group.add(mk(cw, ch, cd, '#5fd35f'), mk(w, h, d, '#ff9b3d'));
}
$('#sizeBoxes').addEventListener('change', e => {
  sizeBoxesOn = e.target.checked;
  for (const it of items) { it.group.children.filter(c => c.userData.sizeBox).forEach(c => it.group.remove(c)); if (sizeBoxesOn) addSizeBoxes(it); }
});
let occOn = false; const occGroup = new THREE.Group(); scene.add(occGroup);
function refreshOccupancy() {
  occGroup.clear(); if (!occOn) return;
  for (const r of rooms) {
    const g = r.layout?.grid; if (!g) continue;
    const c = document.createElement('canvas'); c.width = g.nx; c.height = g.nz; const ctx = c.getContext('2d'); const img = ctx.createImageData(g.nx, g.nz);
    g.cells.forEach((v, i) => { const col = v === 1 ? [217, 101, 79, 150] : v === 2 ? [232, 212, 106, 120] : [0, 0, 0, 0]; img.data.set(col, i * 4); });
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(g.nx * g.res, g.nz * g.res), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(g.x0 + g.nx * g.res / 2, 0.12, g.z0 + g.nz * g.res / 2); m.renderOrder = 5;
    occGroup.add(m);
  }
}
$('#occupancy').addEventListener('change', e => { occOn = e.target.checked; refreshOccupancy(); });
const starsLabel = () => { const v = +$('#minStars').value; $('#minStarsOut').textContent = v < 0 ? 'any' : `≥ ${v}★ (unrated kept)`; };
$('#minStars').addEventListener('input', starsLabel); starsLabel();
async function refilter() { busy++; try { return await refilterInner(); } finally { busy--; } }
async function refilterInner() { // re-plan every room with the same seed under the new ratings filter
  const anim = []; await syncWalls(anim); anim.forEach(restPose);
  for (const r of rooms) await rollRoom(r, false);
  const hidden = Object.values(lib.objects).flatMap(o => o.skus).filter(s => s.kind === 'mesh' && !skuUsable(s, solverOpts())).length;
  toast(`ratings filter: ${hidden} meshes hidden; rooms re-planned with the same seeds`);
}
$('#minStars').addEventListener('change', refilter);
// ---- v2 overlays: paths (yellow), zones, command sight lines; purpose-fail outlines always shown
const ov2 = new THREE.Group(); scene.add(ov2);
let ov2Sig = '';
function refreshOverlay2(force = false) {
  const flags = { paths: $('#ovPaths')?.checked, zones: $('#ovZones')?.checked, sight: $('#ovSight')?.checked };
  const sig = `${layoutGen}|${rooms.map(r => r.id).join(',')}|${JSON.stringify(flags)}`;
  if (!force && sig === ov2Sig) return;
  ov2Sig = sig; ov2.clear();
  for (const r of rooms) if (r.layout?.engine === 'v2') ov2.add(buildOverlay(r.layout, roomRect(r), flags));
}
for (const id of ['#ovPaths', '#ovZones', '#ovSight']) $(id)?.addEventListener('change', () => refreshOverlay2(true));
$('#engine')?.addEventListener('change', async () => {
  busy++;
  try { const anim = []; await syncWalls(anim); anim.forEach(restPose); for (const r of rooms) await rollRoom(r, false); }
  finally { busy--; }
  toast(`layout engine: ${$('#engine').selectedOptions[0].text}; rooms re-planned with the same seeds`);
});
$('#doorView')?.addEventListener('click', () => {
  const r = roomById(selected); if (!r) { toast('select a room first', true); return; }
  const rc = roomRect(r), c = [(rc.x0 + rc.x1) / 2, (rc.z0 + rc.z1) / 2];
  let d = r.layout?.mainDoor?.inner;
  if (!d) { const o = (edgesNow.openings.get(r.id) || []).find(o => o.kind === 'door'); if (o) { const e = edgesNow.edges.get(o.key); const t = edgeTransform(e); d = [t.x + (c[0] - t.x) * 0.08, t.z + (c[1] - t.z) * 0.08]; } }
  if (!d) { toast('this room has no door', true); return; }
  cam.doorView(d, c); toast('doorway view: what you see as you walk in');
});
$('#hideMasking').addEventListener('change', refilter);
$('#variety').addEventListener('input', e => { $('#varietyOut').textContent = e.target.value; });
$('#legend').innerHTML = Object.entries({ floor: 'floor', wall: 'against/on wall', surface: 'on surface', ceiling: 'ceiling', ground: 'ground', kit: 'kit', door: 'door', window: 'window' })
  .map(([k, l]) => `<span><i style="background:${PLACE_COLORS[k]}"></i>${l}</span>`).join('') + '<span><i style="background:#5fd35f"></i>catalog box</span><span><i style="background:#ff9b3d"></i>mesh bounds</span>';

// LIGHTING + FIRE (js/fx/, 2026-10-02): post stack, fire shadows, flames/embers/smoke; builds the Lighting + Fire panels
const fx = createFx({ renderer, scene, camera, hemi, sun, items: () => items, api: API, toast, focus: () => cam.focus,
  meshOf: (spec) => lib.objects[spec.id]?.skus.find(k => k.sku === spec.sku)?.mesh || null });
selLab = createSelectionLab({ scene, camera, renderer, items: () => items, api: API, toast, focus: () => cam.focus, stage: $('#stage') });

let stress = [];
$('#stress').addEventListener('click', () => {
  const r = roomById(selected); if (!r) { toast('select a room to stress', true); return; }
  const src = [...r.items, ...(floorItems.get(r.id) || [])];
  for (const w of wallItems.values()) if (w.items.some(i => i.roomId === r.id)) src.push(...w.items);
  // copies sit in a row south of the room and the camera frames them all, so nothing is frustum-culled away
  const step = (r.d + 1) * CELL;
  for (let k = 1; k <= 4; k++) {
    const g = new THREE.Group();
    for (const it of src) {
      const c = new THREE.Group(); c.position.copy(it.group.position); c.rotation.copy(it.group.rotation); c.scale.copy(it.group.scale);
      c.add(it.visual.clone(true)); g.add(c); // clone the visual, not the item group (its userData points back at itself)
    }
    g.position.set(0, 0, step * (stress.length + 1));
    scene.add(g); stress.push(g);
  }
  const rc = roomRect(r);
  cam.focus.set((rc.x0 + rc.x1) / 2, 0, (rc.z0 + rc.z1) / 2 + step * stress.length / 2);
  cam.pitch = 50; cam.dist = Math.max(cam.dist, step * (stress.length + 1) * 1.15); cam.update();
  toast(`${stress.length} copies of the room (${src.length} objects each) in view; watch the fps`);
});
$('#clearStress').addEventListener('click', () => { stress.forEach(g => g.removeFromParent()); stress = []; });

// stats
const fpsSamples = []; let lastStats = {}; let statT = 0;
const gctx = $('#fpsGraph').getContext('2d');
function drawStats(now) {
  const info = renderer.info;
  const n = fpsSamples.length; if (!n) return;
  const avg = fpsSamples.reduce((a, b) => a + b, 0) / n;
  const worst = [...fpsSamples].sort((a, b) => b - a)[Math.floor(n * 0.01)] || avg;
  const texs = new Set(), geos = new Set();
  world.traverseVisible(o => { if (o.isMesh) { geos.add(o.geometry); const m = o.material; if (m?.map) texs.add(m.map); } });
  for (const g of stress) g.traverse(o => { if (o.isMesh) { geos.add(o.geometry); if (o.material?.map) texs.add(o.material.map); } });
  let tb = 0; for (const t of texs) { const im = t.image; if (im?.width) tb += im.width * im.height * 4 * 1.33; }
  let gb = 0; for (const g of geos) { for (const a of Object.values(g.attributes)) gb += a.array.byteLength; if (g.index) gb += g.index.array.byteLength; }
  const tex = tb / 1048576;
  lastStats = {
    fps: +(1000 / avg).toFixed(1), frame_ms: +avg.toFixed(2), worst_1pct_ms: +worst.toFixed(1), draw_calls: info.render.calls, triangles: info.render.triangles,
    geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
    tex_mb_loaded_est: +tex.toFixed(1), geo_mb: +(gb / 1048576).toFixed(1), textures_in_scene: texs.size, lod: `${$('#lodFaces').value}/${$('#lodTex').value}/${$('#lodScope').value}`, objects: items.size, rooms: rooms.length, lights: fx.stats().fire_lights, stress_copies: stress.length, fx: fx.stats(),
    meshes_loaded: glbCache.size, background_loaded: `${bg.done}/${bg.total}`,
  };
  const ns = netState();
  Object.assign(lastStats, {
    net_rate_mb_s: +(ns.rate / 1e6).toFixed(2), net_peak_mb_s: +(ns.ceiling / 1e6).toFixed(2), net_util_pct: Math.round(ns.util * 100), net_session_mb: +(ns.session / 1e6).toFixed(1), net_files: ns.files,
    net_fg_inflight: ns.fgInflight, net_fg_waiting: ns.fgWaiting, net_bg_inflight: ns.bgInflight, net_bg_waiting: ns.bgWaiting, net_eta_s: +ns.etaAll.toFixed(1), loading_bound: ns.loadingBound,
  });
  $('#fps').textContent = `${lastStats.fps} fps · ${lastStats.frame_ms} ms`;
  $('#stats').innerHTML = Object.entries({
    'frame (avg / worst 1%)': `${lastStats.frame_ms} / ${lastStats.worst_1pct_ms} ms`, 'draw calls': lastStats.draw_calls, 'triangles': lastStats.triangles.toLocaleString(),
    'geometries / textures': `${lastStats.geometries} / ${lastStats.textures}`, 'shader programs': lastStats.programs, 'texture mem (in scene)': `${lastStats.tex_mb_loaded_est} MB · ${lastStats.textures_in_scene} maps`, 'geometry mem': `${lastStats.geo_mb} MB`,
    'objects / rooms': `${lastStats.objects} / ${lastStats.rooms}`, 'fire lights': lastStats.lights, 'meshes loaded': lastStats.meshes_loaded, 'background preload': lastStats.background_loaded,
    'download (now / peak)': `${lastStats.net_rate_mb_s} / ${lastStats.net_peak_mb_s} MB/s · ${lastStats.net_util_pct}%`, 'downloaded this session': `${lastStats.net_session_mb} MB · ${lastStats.net_files} files`,
    'queue (spawn / preload)': `${lastStats.net_fg_inflight}+${lastStats.net_fg_waiting} / ${lastStats.net_bg_inflight}+${lastStats.net_bg_waiting}${lastStats.net_eta_s ? ` · ~${lastStats.net_eta_s} s` : ''}`,
  }).map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
}
function drawGraph() {
  const w = 160, h = 36; gctx.clearRect(0, 0, w, h);
  gctx.strokeStyle = '#3b382f'; gctx.beginPath(); gctx.moveTo(0, h - 16.7 * h / 50); gctx.lineTo(w, h - 16.7 * h / 50); gctx.stroke();
  gctx.strokeStyle = '#b9d45d'; gctx.beginPath();
  fpsSamples.slice(-w).forEach((ms, i) => { const y = h - Math.min(h, ms * h / 50); i ? gctx.lineTo(i, y) : gctx.moveTo(i, y); });
  gctx.stroke();
}

// ---------------------------------------------------------------- loop
function resize() {
  const r = $('#stage').getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); fx.setSize(r.width, r.height);
  camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('#stage'));
resize();
let last = performance.now();
let flashWatch = null; // test hook: uids seen on screen before their spawn animation
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  fpsSamples.push(dt); if (fpsSamples.length > 240) fpsSamples.shift();
  cam.tick(dt / 1000);
  refreshOverlay2();
  stepAnimations(dt);
  settler.tick(4); // background gravity for surface items, ≤4 ms a frame
  for (const it of items) if (it.group.userData.hidden || it.group.userData.testHidden) it.group.visible = false;
  if (flashWatch) { const inEp = new Set(episodes.flatMap(ep => ep.items.map(e => e.it))); for (const it of items) if (it.group.visible && !it.rested && !inEp.has(it)) flashWatch.add(it.spec.uid || it.spec.key); }
  selLab?.tick(dt, now);
  fx.frame(dt, now); fx.render(dt); // = renderer.render(scene, camera) through the FX stack (plain render when Lighting FX is off)
  if (now - statT > 500) { statT = now; drawStats(now); }
  drawGraph();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let toastT = 0;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.toggle('err', err);
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 3500);
}

// test + automation hooks (Playwright acceptance tests drive these)
window.tuner = {
  setTool, tool: () => tool, openGroup, findRoom: (q) => { psearch.value = q; return filterPalette(q); }, // the palette, for tests and shot tools
  palette: () => groups.map(g => ({ code: g.code, label: g.label, open: !g.el.hidden, hidden: g.tab.hidden, rooms: g.rooms.map(t => t.key) })),
  settle: () => ({ pending: settler.pending(), pendingList: settler.pendingList(), ...settler.stats, items: [...items].filter(i => i.spec.parent).map(i => ({ tag: i.tag, id: i.spec.id, parent: i.spec.parent, settle: i.settle || null })) }),
  settleGaps: () => [...items].filter(i => i.spec.parent && i.visual).map(i => { const g = settler.gapOf(i); return { tag: i.tag, id: i.spec.id, gap: g ? +g.gap.toFixed(3) : null }; }),
  createRoom, rollRoom: (id) => rollRoom(roomById(id || selected)), deleteRoom: (id) => deleteRoom(roomById(id || selected)), select, replay,
  rooms: () => rooms.map(r => ({ id: r.id, type: r.type, x: r.x, z: r.z, w: r.w, d: r.d, fog: r.fog ?? null, seed: r.seed, n: r.layout?.placements.length, unplaced: r.layout?.unplaced.length, summary: r.layout?.summary, openings: edgesNow.openings.get(r.id) })),
  stats: () => lastStats, episodes: () => episodes.length + busy, items: () => items.size, cam, preset: () => preset, setPreset: (p) => { preset = mergeDefaults(p); drawDials(); },
  walls: () => ({ edges: wallItems.size, corners: cornerItems.size, doors: [...edgesNow.edges.values()].filter(e => e.kind === 'door').length }),
  layoutOf: (id) => roomById(id)?.layout,
  hideLabels: (on = true) => { overlays.visible = !on; }, // room-name sprites and outlines off (blind-read screenshots)
  lockedOf: (id) => [...(roomById(id)?.locked.keys() || [])],
  project3: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  nearDelays: () => (scrubEp?.items || []).filter(e => e.layerUsed === 'walls-near').map(e => e.delay),
  filteredInScene: () => [...new Set([...items].filter(i => i.spec.sku && i.spec.kind === 'mesh').map(i => lib.objects[i.spec.id]?.skus.find(k => k.sku === i.spec.sku)).filter(k => k && !skuUsable(k, solverOpts())).map(k => k.sku))],
  bgStart: () => bgStart(),
  net: () => netState(),
  wallReport: () => { const box = new THREE.Box3(), sz = new THREE.Vector3(), c = new THREE.Vector3(); return [...items].filter(i => ['walls', 'openings'].includes(i.layer)).map(i => { box.setFromObject(i.visual); box.getSize(sz); box.getCenter(c); return { sku: i.spec.sku, layer: i.layer, at: [i.rest.x, i.rest.z], size: sz.toArray().map(v => +v.toFixed(2)), center: c.toArray().map(v => +v.toFixed(2)), rot: Math.round(i.group.rotation.y * 57.3) }; }); },
  floorReport: (id) => { const r = roomById(id || selected); const f = floorItems.get(r?.id) || []; return { floor: r?.floorUsed, tiles: f.filter(i => !i.spec.uid.includes(':sc')).map(i => i.spec.sku), scatter: f.filter(i => i.spec.uid.includes(':sc')).map(i => i.spec.sku) }; },
  doors: () => [...edgesNow.edges.values()].filter(e => e.kind === 'door').map(e => ({ type: e.doorType, span: e.span, room: roomById(e.doorFor || e.owner.room)?.type })),
  tags: () => [...items].filter(i => i.tag).map(i => ({ tag: i.tag, uid: i.spec.uid || i.spec.key, id: i.spec.id, sku: i.spec.sku, kind: i.spec.kind, room: i.roomId, layer: i.layer, x: i.rest.x, y: i.rest.y, z: i.rest.z, h: (i.spec.dims || [0, 0, 0])[1] })),
  selectedTag: () => selObj?.tag || null,
  selectByTag: (t) => { const it = tags.get(t); if (it) { select(it.roomId); selectObject(it); } return !!it; },
  skuYaws: (sku) => [...items].filter(i => i.spec.sku === sku).map(i => { let y = null; i.visual.traverse(o => { if (y === null && o.userData.meshRoot) y = Math.round(o.rotation.y * 180 / Math.PI); }); return y; }),
  orientOf: (sku) => orient[meshOf(sku)] ?? null,
  setTestNote: (n) => { testNote = n; },
  lastOrientSend: () => lastOrientSend,
  overlayCount: () => ov2.children.reduce((n, g) => n + g.children.length, 0) - rooms.filter(r => r.layout?.purposeFail).length * 2,
  failOutlines: () => rooms.filter(r => r.layout?.purposeFail).length,
  engine: () => engine(),
  addObjNote: (tag, note) => { const it = [...items].find(i => i.tag === tag); if (!it) return false; objNotes.set(tag, { ...noteFor(it), note }); saveNotes(); return true; },
  mapPayloadSize: () => JSON.stringify(mapPayload()).length,
  objEdits: () => [...objEdits.values()],
  probe: (x, y) => { const h = pickItem(x, y); return { sel: selObj?.tag, selUid: selObj?.spec.uid, hit: h?.tag, hitId: h?.spec.id, hitParent: h?.spec.parent, drag: drag?.mode }; },
  nudge: (dx, dz, dr) => nudgeSelected(dx, dz, dr),
  selectTag: (tag) => { const it = [...items].find(i => i.tag === tag); if (it) { select(it.roomId); selectObject(it); } return !!it; },
  watchFlash: () => { flashWatch = new Set(); },
  flashes: () => [...(flashWatch || [])],
  lastLanded: () => { const ep = scrubEp; if (!ep) return null; const by = {}; for (const e of ep.items) { const k = e.layerUsed; by[k] = Math.max(by[k] ?? 0, e.delay); } return by; },
  firstLanded: (layer) => { const ep = scrubEp; if (!ep) return null; const e = ep.items.filter(e => e.it.layer === layer).sort((a, b) => a.delay - b.delay)[0]; return e && [e.it.x, e.it.z]; },
  scrubTotal: () => scrubEp?.total || 0,
  scrubTo: (ms) => { if (!scrubEp) return; paused = true; if (!episodes.includes(scrubEp)) episodes.push(scrubEp); clock = scrubEp.start + ms; for (const ep of episodes) evalEpisode(ep, clock - ep.start); },
  hideLayers: (layers) => { for (const it of items) { const h = layers.includes(it.layer); it.group.userData.testHidden = h; it.group.visible = !h && !it.group.userData.hidden; } },
  // measured, not judged: world-space boxes of the rendered floor-standing props, pairwise overlap depth (ft)
  overlapReport: (minDepth = 0.25) => {
    const box = new THREE.Box3(), out = [];
    const props = [...items].filter(i => i.spec.uid && !i.spec.parent && (i.spec.y || 0) < 0.5 && i.spec.kind === 'mesh' && !['floor', 'walls', 'openings'].includes(i.layer))
      .map(i => ({ id: i.spec.id, rule: i.spec.rule, b: box.setFromObject(i.visual).clone() }));
    for (let a = 0; a < props.length; a++) for (let c = a + 1; c < props.length; c++) {
      if (props[a].rule === 'yard-edge' && props[c].rule === 'yard-edge') continue; // a yard's fence sections meet at posts and corners
      const A = props[a].b, B = props[c].b;
      const dx = Math.min(A.max.x, B.max.x) - Math.max(A.min.x, B.min.x), dz = Math.min(A.max.z, B.max.z) - Math.max(A.min.z, B.min.z);
      if (dx > minDepth && dz > minDepth) out.push(`${props[a].id}/${props[c].id} ${dx.toFixed(2)}x${dz.toFixed(2)}`);
    }
    return { props: props.length, overlaps: out };
  },
  // measured: rendered props whose world box leaves their room's interior (walls are 1 ft thick, centred on the line)
  outsideReport: (tol = 0.6) => {
    const box = new THREE.Box3(), out = [];
    for (const r of rooms) {
      const rc = roomRect(r);
      for (const it of r.items) {
        if (it.spec.rule === 'yard-edge') continue; // the fence / hedge / wall stands ON the yard's boundary line
        box.setFromObject(it.visual);
        const o = Math.max(rc.x0 + 0.5 - box.min.x, box.max.x - (rc.x1 - 0.5), rc.z0 + 0.5 - box.min.z, box.max.z - (rc.z1 - 0.5));
        if (o > tol) out.push(`${r.type}:${it.spec.id} by ${o.toFixed(2)} ft (${it.spec.rule})`);
      }
    }
    return out;
  },
  // ---- variant B wall kit: measured, not judged (2026-10-02)
  kitInfo: () => {
    const its = [...items].filter(i => i.spec.kind === 'kit');
    return { items: its.length, edges: kitPlan.edgeItems.size, nodes: kitPlan.nodeItems.size, families: [...new Set(its.map(i => i.spec.family))],
      hinges: its.flatMap(i => i.spec.hinges), mode: wallKitMode(), roomFamilies: rooms.map(r => ({ id: r.id, family: r.family, explicit: r.wallFamily || 'auto' })),
      genPosts: [...cornerItems.entries()].filter(([k]) => !k.startsWith('k')).length };
  },
  // planned solids: pairwise overlap volume (cu ft) of every body/face/casing/closed-leaf box in the live scene
  kitOverlaps: () => { const S = boxSolids(kitPlan), bad = []; for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) { const v = overlapVol(S[a], S[b]); if (v > 1e-9) bad.push(`${S[a].item}/${S[b].item} ${v.toExponential(2)}`); } return { solids: S.length, overlaps: bad }; },
  // RENDERED geometry: every world-space vertex of the textured kit meshes (not leaves/shutters), bucketed by
  // position + normal. A bucket holding vertices from two different pieces is a face continuing across a joint:
  // its UVs must agree (texture continuity). Straight joints: rendered gap between the two pieces' extents.
  kitSeams: () => {
    const kits = [...items].filter(i => i.spec.kind === 'kit');
    const buckets = new Map(), v = new THREE.Vector3(), nv = new THREE.Vector3(), nm = new THREE.Matrix3();
    const ext = new Map();
    for (const it of kits) {
      it.group.updateMatrixWorld(true);
      const bb = new THREE.Box3();
      for (const m of it.visual.children) {
        if (!m.isMesh || !['stone', 'plaster', 'wood'].includes(m.userData.kitMat)) continue;
        const P = m.geometry.attributes.position, N = m.geometry.attributes.normal, U = m.geometry.attributes.uv;
        nm.getNormalMatrix(m.matrixWorld);
        for (let i = 0; i < P.count; i++) {
          v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); nv.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
          bb.expandByPoint(v);
          // same position, normal, material and UV rule = the same surface continuing across a joint (a post meeting
          // a rail is a deliberate grain change, not a seam)
          const key = [v.x, v.y, v.z, nv.x, nv.y, nv.z].map(q => Math.round(q * 1e3)).join(',') + '|' + m.userData.kitMat + '|' + (m.geometry.userData.uvMode?.[i] ?? 0);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push({ it: it.spec.key, u: U.getX(i), w: U.getY(i) });
        }
      }
      ext.set(it.spec.key, bb);
    }
    let shared = 0, maxDu = 0;
    for (const b of buckets.values()) {
      if (new Set(b.map(q => q.it)).size < 2) continue;
      shared++;
      for (const q of b) maxDu = Math.max(maxDu, Math.abs(q.u - b[0].u), Math.abs(q.w - b[0].w));
    }
    // straight joints: two collinear kit edge pieces of one family sharing a vertex with no node there
    const gaps = [];
    const E = [...kitPlan.edgeItems.values()];
    for (const a of E) for (const b of E) {
      if (a === b || a.wallDir !== b.wallDir || a.family !== b.family) continue;
      const ea = kitPlan.view.get(a.key) || edgesNow.edges.get(a.key), eb = kitPlan.view.get(b.key) || edgesNow.edges.get(b.key);
      const na = a.ekind === 'door' ? a.span : 1;
      const endA = a.wallDir === 'h' ? [ea.gx + na, ea.gz] : [ea.gx, ea.gz + na];
      if (endA[0] !== eb.gx || endA[1] !== eb.gz || kitPlan.nodeItems.has(`${eb.gx}:${eb.gz}`)) continue;
      const A = ext.get(a.key), B = ext.get(b.key); if (!A || !B) continue;
      gaps.push(+(a.wallDir === 'h' ? B.min.x - A.max.x : B.min.z - A.max.z).toFixed(6));
    }
    return { pieces: kits.length, sharedVertexBuckets: shared, maxUvDelta: maxDu, straightJoints: gaps.length, maxAbsGap: gaps.length ? Math.max(...gaps.map(Math.abs)) : null, gaps: gaps.slice(0, 12) };
  },
  // door openings in the kit: opening width between the jamb nodes vs the generated-leaf span (52 in single, span*60-16)
  kitDoors: () => [...kitPlan.edgeItems.values()].filter(k => k.ekind === 'door').map(k => {
    const e = edgesNow.edges.get(k.key), n = k.span;
    const cas = k.solids.filter(s => s.part === 'casing'), lo = Math.min(...cas.map(s => k.wallDir === 'h' ? s.b[0] : s.b[2])), hi = Math.max(...cas.map(s => k.wallDir === 'h' ? s.b[1] : s.b[3]));
    return { key: k.key, span: n, type: e.doorType, family: k.family, openingIn: +((hi - lo) * 12).toFixed(4), expectIn: n * 60 - (n === 1 ? 8 : 16), leaves: k.leaves.length };
  }),
  visibleCount: () => [...items].filter(i => i.group.visible).length,
  project: (x, z) => { const v = new THREE.Vector3(x, 0, z).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
};
document.body.dataset.ready = '1';
