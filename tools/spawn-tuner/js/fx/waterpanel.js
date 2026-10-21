// The Water panel's tools (Spawn Tuner only; the dials, presets, Send and "Use in game" come from fx/index.js's generic
// panel). Here: water on/off, the WATER DEMO (a yard of the bench's vessels, a brazier and a lantern post, a river with
// a crate standing in it, a millpond), DRAW A RIVER / A POND on the grid, a pawn that wades across, a stone to drop,
// and a status line (which vessels use Harry's bench records and which the automatic fit).
// Water bodies drawn here persist in this browser (localStorage tuner.water.bodies).
import * as THREE from 'three';
import { gltfLoader } from '../gltf.js';
import { sampleSpline } from './water.js';

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

// the demo yard, west of the default view (feet; y = 0 is the ground)
// (the tuner's ground spans 0..300 ft; the yard sits in its far south-east corner, clear of where rooms get drawn)
const OX = 270, OZ = 200, o = ([x, z]) => [x + OX, z + OZ];
const DEMO = {
  focus: [-34 + OX, 0, 24 + OZ], dist: 74, pitch: 52,
  river: { id: 'demo-river', kind: 'channel', pts: [[-66, -4], [-56, 8], [-61, 22], [-51, 36], [-55, 52]].map(o), width: 7, depth: 2.5, flow: 1.8, y: 0.08 },
  pond: { id: 'demo-pond', kind: 'pond', ellipse: [-27 + OX, 40 + OZ, 7.5, 5], depth: 3, flow: 0.08, dir: 30, y: 0.08 },
  things: [
    ['bucket', 'bucket--empty', -40, 13], ['washtub', 'washtub--empty', -36, 13], ['rain-barrel', 'rain-barrel--open', -31, 13],
    ['well', 'well--open', -24, 13], ['horse-trough-stone', 'horse-trough-stone--empty', -13, 12], ['water-trough', 'water-trough--empty', -13, 20, 90],
    ['basin-stone', 'basin-stone--s1', -40, 20], ['ewer-and-basin', 'ewer-and-basin--empty', -36, 20], ['rural-water-bucket-stable', 'rural-water-bucket-stable--s2', -32.5, 20],
    ['brazier-tripod', 'brazier-tripod--iron', -27, 19.5], ['lantern-post', 'lantern-post', -33.5, 46],
    ['crate', 'crate--s1', null, null, 20, { river: 0.45 }],
  ].map(([id, sku, x, z, ...r]) => [id, sku, x == null ? null : x + OX, z == null ? null : z + OZ, ...r]),
};
const ellipsePts = ([cx, cz, rx, rz], n = 40) => Array.from({ length: n }, (_, i) => { const t = i / n * Math.PI * 2; return [+(cx + Math.cos(t) * rx * (1 + 0.06 * Math.sin(3 * t))).toFixed(2), +(cz + Math.sin(t) * rz * (1 + 0.05 * Math.cos(2 * t + 1))).toFixed(2)]; });

export function mountWaterTools({ water, panel, camera, canvas, scene, toast = () => {}, dataBase = 'data/', onChange = () => {}, redraw = () => {}, clearAir = null }) {
  if (!panel) return null;
  const box = document.createElement('div'); box.className = 'fxWater';
  box.innerHTML = `
    <label class="check"><input type="checkbox" id="fx-water-on"> Water on</label>
    <div class="row"><button id="fx-water-demo" class="primary" title="a yard of vessels, a river and a millpond, west of the grid">Water demo</button><button id="fx-water-wade" title="a pawn walks across the river">Pawn wades</button><button id="fx-water-drop" title="drop a stone into the nearest vessel">Drop a stone</button></div>
    <div class="row"><button id="fx-water-river" title="click points on the grid; Enter or double-click finishes, Esc cancels">Draw a river</button><button id="fx-water-pond" title="click the outline; Enter or double-click finishes">Draw a pond</button><button id="fx-water-clear">Clear water bodies</button></div>
    <div class="row small"><label>Width <input id="fx-water-width" type="number" min="1" max="40" step="0.5" value="6" style="width:4em"> ft</label><label>Flow <input id="fx-water-flow" type="number" min="0" max="6" step="0.1" value="1.2" style="width:4em"> ft/s</label><label>Depth <input id="fx-water-depth" type="number" min="0.5" max="8" step="0.5" value="2.5" style="width:4em"> ft</label></div>
    <div class="muted small">Move the cursor over any water: it ripples. Drag a thing through a trough, or drop one in. Vessels take their level and outline from the Alignment Bench (WATER mode).</div>
    <div id="fx-water-state" class="muted small"></div>`;
  panel.insertBefore(box, panel.querySelector('#fx-water-dials'));
  const $ = (s) => box.querySelector(s);
  const on = $('#fx-water-on'); on.checked = !!water.params.on;
  on.addEventListener('change', () => { water.params.on = on.checked; onChange(); redraw(); });

  // ---- bodies: persisted per browser
  let defs = store.get('tuner.water.bodies', []);
  const save = () => { store.set('tuner.water.bodies', defs); water.setBodies(defs); };
  water.setBodies(defs);

  // ---- demo things (GLBs from the library, placed like the tuner places props: largest dimension = catalog size)
  let lib = null; const loader = gltfLoader(); const glbs = new Map();
  const libP = fetch(`${dataBase}library.json?v=1`).then(r => r.json()).then(j => (lib = j)).catch(() => null);
  async function place(id, sku, x, z, yawDeg = 0) {
    await libP; const o = lib?.objects[id]; const s = o?.skus.find(k => k.sku === sku); if (!s) return null;
    if (!glbs.has(s.url)) glbs.set(s.url, loader.loadAsync(s.url).then(g => g.scene));
    const src = await glbs.get(s.url); const m = src.clone(true);
    const k = Math.max(...o.size) / 12 / Math.max(...s.bounds);
    m.scale.setScalar(k); m.userData.meshRoot = true;
    m.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } });
    const group = new THREE.Group(); group.add(m); group.rotation.y = yawDeg * Math.PI / 180;
    const b = new THREE.Box3().setFromObject(m); m.position.y = -b.min.y;
    group.position.set(x, 0, z); scene.add(group);
    const it = { group, visual: m, layer: 'furnish', spec: { id, sku, uid: `water-demo:${sku}:${x}:${z}`, kind: 'mesh', dims: o.size.map(v => v / 12) }, rest: { x, y: 0, z } };
    group.userData.item = it; water.addExtra(it); return it;
  }
  let demoBuilt = false; const demoItems = [];
  async function buildDemo() {
    if (!demoBuilt) {
      demoBuilt = true;
      const river = { ...DEMO.river }, pond = { id: DEMO.pond.id, kind: 'pond', pts: ellipsePts(DEMO.pond.ellipse), depth: DEMO.pond.depth, flow: DEMO.pond.flow, dir: DEMO.pond.dir, y: DEMO.pond.y };
      defs = [...defs.filter(d => !d.id.startsWith('demo-')), river, pond]; save();
      const S = sampleSpline(river.pts, 0.5);
      for (const [id, sku, x, z, yaw = 0, opt = {}] of DEMO.things) {
        let px = x, pz = z;
        if (opt.river != null) { const s = S[Math.floor(S.length * opt.river)]; px = s.p[0] + 1.2; pz = s.p[1]; }
        const it = await place(id, sku, px, pz, yaw); if (it) demoItems.push(it);
      }
    }
    const tc = window.tuner?.cam;
    if (tc) { tc.focus.set(...DEMO.focus); tc.dist = DEMO.dist; tc.pitch = DEMO.pitch; tc.update?.(); }
    // the tuner opens in morning mist (Atmosphere panel); a ground fog buries a yard of buckets, so the demo clears the
    // air unless Harry has picked an atmosphere himself
    const cleared = clearAir?.() || false;
    toast(`water demo: vessels, a river and a millpond (west of the grid)${cleared ? '; the mist is cleared (Atmosphere panel to bring it back)' : ''}`);
  }

  // ---- a pawn wading across the river (a capsule: the game's pawns call water.touch() the same way, through items)
  let pawn = null, pawnT = 0;
  function wade() {
    const river = defs.find(d => d.kind === 'channel'); if (!river) { toast('draw a river first (or press Water demo)', true); return; }
    const S = sampleSpline(river.pts, 0.5), mid = S[Math.floor(S.length / 2)], n = [-mid.t[1], mid.t[0]], half = (river.width || 6) / 2 + 3;
    if (!pawn) {
      const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.6, 4, 12), new THREE.MeshStandardMaterial({ color: '#b04a3a', roughness: 0.6 }));
      body.position.y = 1.85; body.castShadow = true; g.add(body); scene.add(g);
      pawn = { group: g, visual: body, layer: 'pawn', spec: { id: 'pawn', uid: 'water-demo:pawn', kind: 'pawn' }, rest: { x: 0, y: 0, z: 0 } };
      water.addExtra(pawn);
    }
    pawn.path = [[mid.p[0] - n[0] * half, mid.p[1] - n[1] * half], [mid.p[0] + n[0] * half, mid.p[1] + n[1] * half]]; pawnT = performance.now();
    pawn.group.visible = true;
  }
  function tickPawn(now) {
    if (!pawn?.path) return;
    const k = Math.min(1, (now - pawnT) / 6000), [[ax, az], [bx, bz]] = pawn.path;
    pawn.group.position.set(ax + (bx - ax) * k, -0.9 * Math.sin(Math.PI * k) * (k > 0.15 && k < 0.85 ? 1 : 0.4), az + (bz - az) * k);
    if (k >= 1) pawn.path = null;
  }

  // ---- drop a stone into the vessel nearest the view centre
  const stones = [];
  function dropStone() {
    const S = water.surfaces().filter(s => s.visible); if (!S.length) { toast('no vessel with water in view', true); return; }
    const f = window.tuner?.cam?.focus || new THREE.Vector3();
    const s = S.map(s => { const c = s.outline.reduce((a, p) => [a[0] + p[0] / s.outline.length, a[1] + p[2] / s.outline.length], [0, 0]); return { s, c, d: Math.hypot(c[0] - f.x, c[1] - f.z) }; }).sort((a, b) => a.d - b.d)[0];
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), new THREE.MeshStandardMaterial({ color: '#77736a', roughness: 0.9 }));
    const g = new THREE.Group(); g.add(m); g.position.set(s.c[0], s.s.y + 3, s.c[1]); scene.add(g);
    const it = { group: g, visual: m, layer: 'thing', spec: { id: 'stone', uid: 'water-demo:stone' + stones.length, kind: 'thing' }, rest: { x: s.c[0], y: s.s.y - 0.3, z: s.c[1] }, vy: 0 };
    stones.push(it); water.addExtra(it);
    toast(`a stone into the ${s.s.id}`);
  }
  function tickStones(dt) {
    for (const it of stones) { if (it.done) continue; it.vy -= 32 * dt; it.group.position.y += it.vy * dt; if (it.group.position.y <= it.rest.y) { it.group.position.y = it.rest.y; it.done = true; setTimeout(() => { it.group.visible = false; }, 600); } }
  }

  // ---- drawing tools: click points on the ground (y = 0)
  let tool = null, pts = [], preview = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const groundAt = (e) => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray.intersectPlane(ground, new THREE.Vector3()); };
  function drawPreview() {
    preview?.removeFromParent(); preview?.geometry.dispose();
    if (pts.length < 1) return;
    const line = tool === 'river' && pts.length >= 2 ? sampleSpline(pts, 0.5).map(s => s.p) : tool === 'pond' ? [...pts, pts[0]] : pts;
    const g = new THREE.BufferGeometry().setFromPoints(line.map(([x, z]) => new THREE.Vector3(x, 0.15, z)));
    preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#7fd0ff', depthTest: false })); preview.renderOrder = 30; scene.add(preview);
  }
  function startTool(t) { tool = t; pts = []; drawPreview(); canvas.style.cursor = 'crosshair'; toast(t === 'river' ? 'click along the river\'s course; Enter or double-click finishes, Esc cancels' : 'click the pond\'s outline; Enter or double-click finishes'); }
  function finish() {
    const t = tool; tool = null; canvas.style.cursor = ''; preview?.removeFromParent();
    if (t === 'river' && pts.length >= 2) defs.push({ id: 'river-' + Date.now().toString(36), kind: 'channel', pts: pts.map(p => p.map(v => +v.toFixed(2))), width: +$('#fx-water-width').value || 6, depth: +$('#fx-water-depth').value || 2.5, flow: +$('#fx-water-flow').value, y: 0.08 });
    else if (t === 'pond' && pts.length >= 3) defs.push({ id: 'pond-' + Date.now().toString(36), kind: 'pond', pts: pts.map(p => p.map(v => +v.toFixed(2))), depth: +$('#fx-water-depth').value || 2.5, flow: Math.min(0.3, +$('#fx-water-flow').value), dir: 0, y: 0.08 });
    else { toast('cancelled'); return; }
    save(); toast(`${t} added (${defs.length} water bod${defs.length === 1 ? 'y' : 'ies'})`);
  }
  // capture phase on window: while a tool is active, clicks on the canvas are ours (the tuner never sees them)
  window.addEventListener('pointerdown', (e) => {
    if (!tool || e.target !== canvas || e.button !== 0) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const p = groundAt(e); if (!p) return;
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last[0] - p.x, last[1] - p.z) < 0.4) { finish(); return; } // double-click lands on the same spot
    pts.push([p.x, p.z]); drawPreview();
  }, true);
  for (const ev of ['pointerup', 'click', 'dblclick']) window.addEventListener(ev, (e) => { if (tool && e.target === canvas) { e.stopImmediatePropagation(); if (ev === 'dblclick') finish(); } }, true);
  window.addEventListener('keydown', (e) => { if (!tool) return; if (e.key === 'Enter') { e.preventDefault(); finish(); } else if (e.key === 'Escape') { e.preventDefault(); pts = []; finish(); } }, true);

  $('#fx-water-demo').addEventListener('click', buildDemo);
  $('#fx-water-wade').addEventListener('click', wade);
  $('#fx-water-drop').addEventListener('click', dropStone);
  $('#fx-water-river').addEventListener('click', () => startTool('river'));
  $('#fx-water-pond').addEventListener('click', () => startTool('pond'));
  $('#fx-water-clear').addEventListener('click', () => { defs = []; save(); toast('water bodies cleared'); });

  // ---- status line + per-frame tools
  let last = performance.now(), stT = 0;
  (function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    tickPawn(now); tickStones(dt);
    if (now - stT > 700) {
      stT = now; const S = water.surfaces(), st = water.stats();
      const bench = S.filter(s => s.src === 'bench').length, auto = S.length - bench;
      $('#fx-water-state').textContent = water.params.on ? `${S.length} vessel${S.length === 1 ? '' : 's'} with water (${bench} from bench records, ${auto} automatic) · ${st.water_bodies} bod${st.water_bodies === 1 ? 'y' : 'ies'} · ripples: ${st.water_sim} · ${st.water_draw_calls} draw calls` : 'water is off';
      on.checked = !!water.params.on;
    }
    requestAnimationFrame(tick);
  })(last);
  // the tuner's hooks for tests
  const api = { buildDemo, wade, dropStone, startTool, finish, place, addPoint: (x, z) => { pts.push([x, z]); drawPreview(); }, defs: () => defs, demoItems: () => demoItems, pawn: () => pawn, stones: () => stones };
  water.tools = api;
  return api;
}
