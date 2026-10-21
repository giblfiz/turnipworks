// Caves pilot viewer (2026-10-05). A standalone page on the slope pilot's scaffolding: the game's lighting module
// (lib/lighting.js is a copy of tools/spawn-tuner/js/fx/lighting.js made by deploy.sh) set dark, warm point lights
// inside, a cave floor, and the wall worked out by cave.js from the room's outline on the 5-ft grid.
// URL: ?scene=rect|ell|two|field|kit &view=table|lean|low &overlap=0.3 &push=0.3 &turn=10 &seed=1 &grid=1 &pawns=0
//      &wander=2.5 &edgepawns=1 &cap=0 &bright=1 &ui=0 &nofx=1 &yaw= &pitch= &dist=   (kit scene: &only=ID &spin=DEG)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SCENES, POOL } from './scenes.js?v=__V__';
import { CELL, placeCave, rockEdge, cellsOf, outline, runsOf } from './cave.js?v=__V__';
function outlineOnly(def) { const cells = cellsOf(def.rects), loops = outline(cells, def.open || []); return { cells, loops, corners: loops.flatMap(l => runsOf(l).corners), placements: [] }; }

const V = '__V__';
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const flag = (k, d) => qs.has(k) ? qs.get(k) !== '0' : d;
const num = (k, d) => qs.has(k) && isFinite(+qs.get(k)) ? +qs.get(k) : d;
const API = qs.get('api') || '/api/tw-ratings';
const DEFAULTS = { overlap: 0.3, push: 0.3, turn: 20, wander: 6, seed: 1 };
const P = { overlap: num('overlap', DEFAULTS.overlap), push: num('push', DEFAULTS.push), turn: num('turn', DEFAULTS.turn), wander: num('wander', DEFAULTS.wander), seed: num('seed', DEFAULTS.seed), rubble: num('rubble', 0.55) };
const state = { scene: SCENES[qs.get('scene')] ? qs.get('scene') : 'rect', view: qs.get('view') || 'table', grid: flag('grid', false), pawns: flag('pawns', true),
  edgepawns: flag('edgepawns', false), cap: flag('cap', true), bright: flag('bright', false) };
// the flat rock top is a little LOWER than the chunks' tops, so the chunks stand up out of it as a lumpy rim all round
const CAP_H = num('caph', 8.4), CAP_BACK = num('capback', 1.5), CAP_RAGGED = num('ragged', 1.2), WALL_H = 9;
P.topH = num('toph', 9.6);

const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
// capped at 1.5 (?pr=2 for the game's cap): the lighting stack costs per pixel
renderer.setPixelRatio(Math.min(+new URLSearchParams(location.search).get('pr') || 1.5, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#070605');
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);   // the tuner's and the game's camera
const hemi = new THREE.HemisphereLight('#fff4e0', '#3a3428', 1.7); // the tuner's light rig (main.js), same numbers
const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
sun.position.set(-120, 120, -100); sun.target.position.set(0, 0, 0);
scene.add(hemi, sun, sun.target);
const controls = new OrbitControls(camera, canvas);
controls.maxPolarAngle = Math.PI / 2 - 0.03; controls.minDistance = 6; controls.maxDistance = 400;

let lighting = null, LB = null;
if (!qs.has('nofx')) {
  try {
    const m = await import('./lib/lighting.js?v=__V__');
    lighting = m.createLighting({ renderer, scene, camera, hemi, sun, focus: () => controls.target });
    LB = m.LIGHT_BUILTINS;
  } catch (e) { console.warn('house lighting not loaded, plain render', e); }
}
// The house look, set dark: Harry's "night" profile with the sky fill and sun turned almost off, so the room is lit by
// its own warm lights. "Work light" is his "day" profile, for looking at the pieces.
function applyLook() {
  if (!lighting) { hemi.intensity = state.bright ? 1.7 : 0.35; sun.intensity = state.bright ? 1.9 : 0.15; return; }
  const p = state.bright ? LB.day() : LB.night();
  if (!state.bright) { p.fill = { ambient: num('ambient', 0.28), sun: num('sun', 0.06), warmFill: 0.6 }; p.shadows.casters = num('casters', 2); p.shadows.depth = num('shadow', 0.65); p.ao.strength = num('ao', p.ao.strength); }
  else p.shadows.casters = 0;
  lighting.set(p); lighting.markDirty();
}

// ---------------------------------------------------------------- shared bits
const texLoader = new THREE.TextureLoader();
const tex = (url) => { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const kit = await (await fetch(`./kit.json?v=${V}`)).json();
const floorMap = tex(`./tex/floor-cave-rock.webp?v=${V}`);
const floorMat = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.96, color: new THREE.Color(...(kit._floor_tint || [1, 1, 1])) });
const darkRock = new THREE.MeshStandardMaterial({ color: '#0e0c0a', roughness: 1, side: THREE.DoubleSide });
// the solid rock the cave is cut into: the same rock texture, in the walls' colour. The face behind the chunks is
// darker (it is in their shadow); the flat top is lit only by the dim sky, so the lamps below do not reach it.
const wallTint = new THREE.Color(...(kit._rock_tint || [0.75, 0.75, 0.75]));
const faceMat = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 1, side: THREE.DoubleSide, color: wallTint.clone().multiplyScalar(num('facetint', 0.9)) });
const capMat = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 1, color: wallTint.clone().multiplyScalar(num('captint', 0.45)) });
function floorPlane(x0, z0, x1, z1) {   // one texture tile per 5-ft cell, laid straight and world-aligned
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / CELL, -pos.getZ(i) / CELL);
  const m = new THREE.Mesh(g, floorMat); m.receiveShadow = true; return m;
}
const gridMat = new THREE.LineBasicMaterial({ color: '#e8d9b0', transparent: true, opacity: 0.32, depthWrite: false });
function cellGrid(cells) {
  const p = [];
  for (const key of cells) { const [i, j] = key.split(',').map(Number), x = i * CELL, z = j * CELL; p.push(x, 0.05, z, x + CELL, 0.05, z, x + CELL, 0.05, z, x + CELL, 0.05, z + CELL, x + CELL, 0.05, z + CELL, x, 0.05, z + CELL, x, 0.05, z + CELL, x, 0.05, z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const l = new THREE.LineSegments(g, gridMat); l.userData.fx = true; return l;
}

const loader = new GLTFLoader();
const glbs = new Map();
const loadGLB = (file) => { if (!glbs.has(file)) glbs.set(file, loader.loadAsync(`./models/${file}?v=${V}`).then(g => g.scene)); return glbs.get(file); };
// canonical piece (the frame measure.py reports in): origin on the ground at the middle of the back plane, front +Z
async function makePiece(id) {
  const k = kit[id]; if (!k) throw new Error(`no piece ${id}`);
  const src = (await loadGLB(k.file)).clone(true);
  const gain = k.gain || [1, 1, 1];
  src.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); Object.assign(o.material, { roughness: 0.95, metalness: 0, side: THREE.DoubleSide, roughnessMap: null, metalnessMap: null, transparent: false }); o.material.color.setRGB(gain[0], gain[1], gain[2]); o.castShadow = o.receiveShadow = true; } });
  src.rotation.y = THREE.MathUtils.degToRad(k.yaw_deg); src.scale.setScalar(k.scale);
  const st = new THREE.Group(); st.add(src); st.scale.set(k.stretch?.[0] ?? 1, 1, k.stretch?.[1] ?? 1);   // free stretch decided in measure.py
  st.position.set(-k.cx, -k.y0, -k.back_z);
  const piece = new THREE.Group(); piece.add(st); piece.userData = { id, k };
  return piece;
}
const pawnColors = ['#d9654f', '#6fa8dc', '#e8d46a', '#c58be0', '#6fd0c0', '#f0a04b'];
function pawn(color, r = 2.5, h = 6) {   // a level round base 5 ft across (one grid square) with a human-height body
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.25, 40), new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.6 })); base.position.y = 0.125;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.27, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.7 })); ring.position.y = 0.135;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, h - 1.8 - 0.25, 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.8 })); body.position.y = 0.25 + (h - 0.25) / 2;
  g.add(base, ring, body); g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); return g;
}
function figure() {  // plain 6-ft person, no base: the height reference
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.8 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.7, 6, 14), mat); b.position.y = 2.6;
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat); hd.position.y = 5.5;
  g.add(b, hd); return g;
}
function lamp(x, y, z, pri) {   // a warm point light with a small glowing ball where it hangs (the fire module's brazier numbers)
  const l = new THREE.PointLight('#ffa040', num('light', 14), num('reach', 42), 1.4); l.position.set(x, y, z);
  l.userData = { priority: pri, fx: true };
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.1) })); ball.userData.fx = true; l.add(ball);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, y - 0.3, 8), new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.9 })); post.position.y = -(y - 0.3) / 2 - 0.3; post.userData.fx = true; l.add(post);
  return l;
}

// ---------------------------------------------------------------- the rock cap and the dark behind the wall
function capMeshes(loops) {
  const g = new THREE.Group(), R = 400;
  const shape = new THREE.Shape([new THREE.Vector2(-R, -R), new THREE.Vector2(R, -R), new THREE.Vector2(R, R), new THREE.Vector2(-R, R)]);
  for (const loop of loops) shape.holes.push(new THREE.Path(loop.map(([x, z]) => new THREE.Vector2(x, -z))));
  const top = new THREE.ShapeGeometry(shape); top.rotateX(-Math.PI / 2);
  const tp = top.attributes.position, tuv = top.attributes.uv;
  for (let i = 0; i < tp.count; i++) tuv.setXY(i, tp.getX(i) / 9, -tp.getZ(i) / 9);   // the rock texture, larger than on the floor
  const cap = new THREE.Mesh(top, capMat); cap.position.y = CAP_H; cap.receiveShadow = true; g.add(cap);
  for (const loop of loops) {   // the rock face behind the chunks: from under the floor up to the cap
    const pos = [], uv = [], idx = [], n = loop.length; let run = 0;
    for (let i = 0; i <= n; i++) {
      const [x, z] = loop[i % n]; if (i) run += Math.hypot(x - loop[i - 1][0], z - loop[i - 1][1]);
      pos.push(x, -0.5, z, x, CAP_H, z); uv.push(run / 7, -0.07, run / 7, CAP_H / 7);
    }
    for (let i = 0; i < n; i++) { const a = i * 2, b = a + 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
    const face = new THREE.Mesh(sg, faceMat); face.receiveShadow = true; face.castShadow = true; g.add(face);
  }
  return g;
}

// ---------------------------------------------------------------- measuring what was built
// Every wall chunk's vertices below head height are tested against the room's cells: does any rock stand inside the
// grid line, and does any touch the 5-ft round base of a pawn standing in a square on the room's edge?
function clearance(result, objs, arches = false) {
  const { cells } = result, edge = new Map(), v = new THREE.Vector3();
  for (const key of cells) { const [i, j] = key.split(',').map(Number); const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([a, b]) => !cells.has(`${i + a},${j + b}`)); if (sides.length) edge.set(key, { i, j, sides, deep: 0, base: false }); }
  let maxIn = 0, tested = 0;
  for (const { p, obj } of objs) {
    if ((p.role === 'arch') !== arches) continue;
    let mine = 0;
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (!o.isMesh) return; const pos = o.geometry.attributes.position;
      for (let q = 0; q < pos.count; q += 2) {
        v.fromBufferAttribute(pos, q).applyMatrix4(o.matrixWorld); tested++;
        if (v.y < 0.15 || v.y > 6.5) continue;
        const i = Math.floor(v.x / CELL), j = Math.floor(v.z / CELL); let c = edge.get(`${i},${j}`);
        if (arches && !c && cells.has(`${i},${j}`)) { c = { i, j, sides: [], deep: 0, base: false }; edge.set(`${i},${j}`, c); }
        if (arches) { if (c && Math.hypot(v.x - (i + 0.5) * CELL, v.z - (j + 0.5) * CELL) < 2.5) c.base = true; continue; }   // a tunnel mouth stands ON the line: only "does a base touch it" is asked
        if (!c) { if (cells.has(`${i},${j}`)) { maxIn = Math.max(maxIn, CELL); mine = CELL; } continue; }
        let d = Infinity;
        for (const [a, b] of c.sides) d = Math.min(d, a === -1 ? v.x - i * CELL : a === 1 ? (i + 1) * CELL - v.x : b === -1 ? v.z - j * CELL : (j + 1) * CELL - v.z);
        if (d > c.deep) c.deep = d; if (d > maxIn) maxIn = d; if (d > mine) mine = d;
        if (Math.hypot(v.x - (i + 0.5) * CELL, v.z - (j + 0.5) * CELL) < 2.5) c.base = true;
      }
    });
    p.into_room_ft = +mine.toFixed(2);
  }
  const list = [...edge.values()];
  return { edge_cells: list.length, max_into_room_ft: +maxIn.toFixed(2), cells_with_rock_over_line: list.filter(c => c.deep > 0.1).length, cells_where_a_5ft_base_touches_rock: list.filter(c => c.base).length, vertices_tested: tested, edge: list };
}
// how much the chunks really overlap: mean share of a wall chunk's width shared with the next one along its run
function overlapStats(result) {
  const w = result.placements.filter(p => p.role === 'wall'); let sum = 0, n = 0, min = 1;
  for (let i = 1; i < w.length; i++) {
    const a = w[i - 1], b = w[i]; if (a.out !== b.out) continue;
    const wa = a.w, wb = b.w, gap = Math.abs(b.along - a.along);
    if (gap > (wa + wb)) continue;
    const ov = ((wa + wb) / 2 - gap) / ((wa + wb) / 2); sum += ov; n++; min = Math.min(min, ov);
  }
  return n ? { mean: sum / n, min } : { mean: 0, min: 0 };
}

// ---------------------------------------------------------------- scene building
const world = new THREE.Group(); scene.add(world);
let buildNo = 0;
async function build() {
  const my = ++buildNo;
  $('#status').textContent = 'building…'; window.__ready = false;
  const def = SCENES[state.scene];
  const root = new THREE.Group(), pawns = new THREE.Group(), edgePawns = new THREE.Group(), grids = new THREE.Group(), caps = new THREE.Group(), lamps = [];
  root.add(pawns, edgePawns, grids, caps);
  let counts = {}, clear = null, ov = null;
  if (def.kitView) {
    root.add(floorPlane(-200, -200, 200, 200));
    const only = qs.get('only'), ids = only ? [only] : [...POOL.walls, POOL.column, POOL.rubble, POOL.arch].filter(id => kit[id]);
    let x = -ids.reduce((a, id) => a + kit[id].size_ft.w + 3, 0) / 2;
    for (const id of ids) {
      const k = kit[id], w = k.size_ft.w;
      const front = await makePiece(id); front.position.set(only ? 0 : x + w / 2, 0, only ? -k.size_ft.d / 2 : 0); front.rotation.y = THREE.MathUtils.degToRad(num('spin', 0)); root.add(front);
      if (!only) { const back = await makePiece(id); back.rotation.y = Math.PI; back.position.set(x + w / 2, 0, -16); root.add(back); }
      x += w + 3;
    }
    if (my !== buildNo) return;
    if (!only) { const f = figure(); f.position.set(x + 2, 0, 3); root.add(f); }
  } else {
    const result = def.kitWalls ? outlineOnly(def) : placeCave(def, kit, P, POOL);
    const objs = [];
    if (def.kitWalls) {   // the game's straight wall: one piece per grid edge, stretched to its 5 x 9 x 1 ft box, posts at the corners
      const src = await loadGLB('wall-straight--fieldstone.glb');
      const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
      const along = size.x >= size.z;   // which mesh axis is the wall's length
      const piece = (w, d, h) => { const g = new THREE.Group(), m = src.clone(true); m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); m.position.set(-mid.x, -box.min.y, -mid.z); g.add(m); g.scale.set(along ? w / size.x : d / size.x, h / size.y, along ? d / size.z : w / size.z); const out = new THREE.Group(); out.add(g); if (!along) g.rotation.y = Math.PI / 2; return out; };
      let n = 0;
      for (const loop of result.loops) for (const e of loop) {
        if (e.open) continue;
        const w = piece(CELL, 1, WALL_H); w.position.set((e.a[0] + e.d[0] / 2) * CELL, 0, (e.a[1] + e.d[1] / 2) * CELL); w.rotation.y = e.d[0] ? 0 : Math.PI / 2; root.add(w); n++;
      }
      for (const c of result.corners) { const post = piece(1.5, 1.5, WALL_H + 0.3); post.position.set(c.at[0], 0, c.at[1]); root.add(post); }
      counts = { 'straight wall pieces': n, 'corner posts': result.corners.length };
    } else {
      const made = await Promise.all(result.placements.map(async (p) => {
        const piece = await makePiece(p.id), wrap = new THREE.Group(); wrap.add(piece);
        wrap.position.set(p.x, p.y || 0, p.z); wrap.rotation.y = p.rot; wrap.scale.set(p.scale[0], p.scale[1], p.scale[2]);
        return { p, obj: wrap };
      }));
      if (my !== buildNo) return;
      for (const m of made) { root.add(m.obj); objs.push(m); counts[m.p.role] = (counts[m.p.role] || 0) + 1; }
      root.updateMatrixWorld(true);
      clear = clearance(result, objs); ov = overlapStats(result);
      const ac = clearance(result, objs, true), ar = result.placements.filter(p => p.role === 'arch');
      clear.tunnel_mouths = ar.length; clear.mouth_opening_ft = ar[0]?.opening_ft; clear.squares_where_a_base_touches_a_mouth = ac.cells_where_a_5ft_base_touches_rock; root.userData.placed = result.placements.map(p => ({ role: p.role, id: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), rot: Math.round(p.rot * 180 / Math.PI), into: p.into_room_ft }));
    }
    // floor: under the room and a few feet beyond, so there is ground under the chunks; everything else is dark
    const xs = [...result.cells].map(k => +k.split(',')[0]), zs = [...result.cells].map(k => +k.split(',')[1]);
    const bx = [Math.min(...xs) * CELL - 12, Math.min(...zs) * CELL - 12, (Math.max(...xs) + 1) * CELL + 12, (Math.max(...zs) + 1) * CELL + 12];
    root.add(floorPlane(...bx));
    const voidPlane = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), darkRock); voidPlane.position.y = -0.3; root.add(voidPlane);
    grids.add(cellGrid(result.cells));
    if (!def.kitWalls) caps.add(capMeshes(rockEdge(result.loops, P, CAP_BACK, CAP_RAGGED)));
    (def.lights || []).forEach(([x, y, z], i) => { const l = lamp(x, y, z, 3 - i * 0.1); root.add(l); lamps.push(l); });
    (def.pawns || []).forEach(([x, z], i) => { const pw = pawn(pawnColors[i % 6]); pw.position.set(x, 0, z); pawns.add(pw); });
    let q = 0;
    for (const key of result.cells) {
      const [i, j] = key.split(',').map(Number);
      if ([[-1, 0], [1, 0], [0, -1], [0, 1]].every(([a, b]) => result.cells.has(`${i + a},${j + b}`))) continue;
      const pw = pawn(pawnColors[q++ % 6]); pw.position.set((i + 0.5) * CELL, 0, (j + 0.5) * CELL); edgePawns.add(pw);
    }
  }
  world.clear(); world.add(root);
  world.userData = { pawns, edgePawns, grids, caps, def, placed: root.userData.placed };
  lighting?.setFireLights(lamps);
  applyToggles(); setView(state.view);
  $('#title').textContent = def.title; $('#note').textContent = def.note;
  const c = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ');
  let h = c ? `<b>Placed:</b> ${c}.` : '';
  if (clear) {
    h += `<br><b>Overlap as built:</b> mean ${(ov.mean * 100).toFixed(0)}% of a chunk's width, least ${(ov.min * 100).toFixed(0)}%.`;
    h += `<br><b>Room kept clear?</b> Rock reaches at most <span class="${clear.max_into_room_ft > 0.1 ? 'bad' : 'good'}">${clear.max_into_room_ft.toFixed(2)} ft</span> inside the grid line (below 6.5 ft).`;
    h += `<br>Edge squares where a 5-ft pawn base would touch rock: <span class="${clear.cells_where_a_5ft_base_touches_rock ? 'bad' : 'good'}">${clear.cells_where_a_5ft_base_touches_rock} of ${clear.edge_cells}</span>.`;
    if (clear.tunnel_mouths) h += `<br>Tunnel mouth: opening ${clear.mouth_opening_ft[0]} ft wide, ${clear.mouth_opening_ft[1]} ft high (stretched from the generated piece). Squares beside a mouth where a 5-ft base touches its legs: <span class="${clear.squares_where_a_base_touches_a_mouth ? 'bad' : 'good'}">${clear.squares_where_a_base_touches_a_mouth}</span>.`;
  } else if (def.kitWalls) h += '<br>Straight walls are 1 ft thick, centred on the grid line: they take 6 inches of every edge square.';
  $('#read').innerHTML = h; $('#read').style.display = h ? '' : 'none';
  $('#status').textContent = `v${V}`;
  window.__counts = counts; window.__placed = def.kitView || def.kitWalls ? [] : world.userData.placed; window.__clear = clear && { ...clear, edge: undefined }; window.__overlap = ov;
  lighting?.markDirty?.();
  setTimeout(() => { lighting?.markDirty?.(); window.__ready = true; }, 900);
}
function applyToggles() {
  const u = world.userData; if (!u.pawns) return;
  u.pawns.visible = state.pawns && !state.edgepawns; u.edgePawns.visible = state.edgepawns; u.grids.visible = state.grid; u.caps.visible = state.cap;
  applyLook();
}
function setView(name) {
  state.view = name;
  const def = world.userData.def || SCENES[state.scene]; const c = def.focus || [0, 4, 0];
  // table distance = the game's high three-quarter play camera (the tuner's default: 52 degrees down, the whole room in frame)
  const v = { table: { yaw: -20, pitch: 52, dist: def.tableDist || 95 }, lean: { yaw: -32, pitch: 36, dist: (def.tableDist || 95) * 0.62 }, low: { yaw: def.lowYaw ?? 25, pitch: 15, dist: def.lowDist || 45 } }[name] || { yaw: -20, pitch: 52, dist: 95 };
  if (qs.has('yaw')) v.yaw = +qs.get('yaw'); if (qs.has('pitch')) v.pitch = +qs.get('pitch'); if (qs.has('dist')) v.dist = +qs.get('dist');
  const yaw = THREE.MathUtils.degToRad(v.yaw), pitch = THREE.MathUtils.degToRad(v.pitch);   // the tuner's GrabCamera convention
  controls.target.set(c[0], c[1], c[2]);
  camera.position.set(c[0] + Math.sin(yaw) * Math.cos(pitch) * v.dist, c[1] + Math.sin(pitch) * v.dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * v.dist);
  controls.update(); lighting?.markDirty?.();
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === name));
}

// ---------------------------------------------------------------- UI
for (const [key, def] of Object.entries(SCENES)) {
  const b = document.createElement('button'); b.textContent = def.button; b.dataset.scene = key;
  b.onclick = () => { state.scene = key; syncUI(); build(); };
  $('#scenes').append(b, ' ');
}
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
for (const k of ['grid', 'pawns', 'edgepawns', 'cap', 'bright']) { $('#' + k).checked = state[k]; $('#' + k).onchange = (e) => { state[k] = e.target.checked; applyToggles(); }; }
const SLIDERS = [
  ['overlap', 'Overlap', 0, 0.6, 0.01, v => `${Math.round(v * 100)}% of width`],
  ['push', 'Pushed out', -1.5, 3, 0.05, v => `${(+v).toFixed(2)} ft`],
  ['turn', 'Random turn', 0, 30, 1, v => `± ${Math.round(v)}°`],
  ['wander', 'Wall line wanders', 0, 8, 0.1, v => `0 to ${(+v).toFixed(1)} ft`],
];
const HELP = { overlap: 'How much of its width each chunk shares with the next one.', push: 'How far outside the grid line the nearest rock stands. Below zero the rock comes into the room.',
  turn: 'Each chunk is turned by a random angle up to this, either way.', wander: 'The line the chunks stand on swings outward and back by up to this much, in bays about 12 ft across. Outward only.' };
let timer = null;
for (const [key, label, min, max, step, read] of SLIDERS) {
  const row = document.createElement('div'); row.className = 'row';
  row.title = HELP[key]; row.innerHTML = `<span>${label}</span><input type="range" id="s-${key}" min="${min}" max="${max}" step="${step}" value="${P[key]}"><output id="r-${key}">${read(P[key])}</output>`;
  $('#sliders').append(row);
  row.querySelector('input').oninput = (e) => { P[key] = +e.target.value; $('#r-' + key).textContent = read(P[key]); clearTimeout(timer); timer = setTimeout(build, 120); };
}
$('#r-seed').textContent = P.seed;
$('#reseed').onclick = () => { P.seed = 1 + Math.floor(Math.random() * 9999); $('#r-seed').textContent = P.seed; build(); };
$('#hide').onclick = () => { const m = $('#panel').classList.toggle('min'); $('#hide').textContent = m ? '+' : '–'; };
function syncUI() { document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('on', b.dataset.scene === state.scene)); $('#sliders').style.opacity = SCENES[state.scene].rects && !SCENES[state.scene].kitWalls ? 1 : 0.35; }
syncUI();
if (qs.get('ui') === '0') { $('#bar').style.display = $('#panel').style.display = $('#status').style.display = 'none'; }
const cameraNow = () => ({ pos: camera.position.toArray().map(v => +v.toFixed(1)), target: controls.target.toArray().map(v => +v.toFixed(1)), view: state.view });
async function sendVerdict(verdict) {
  try {
    const r = await fetch(`${API}/tuner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'caves_pilot', name: state.scene, note: $('#noteBox').value,
      data: { verdict, scene: state.scene, settings: { ...P }, defaults: DEFAULTS, toggles: { grid: state.grid, pawns: state.pawns, edgepawns: state.edgepawns, cap: state.cap, bright: state.bright }, camera: cameraNow(), counts: window.__counts, clearance: window.__clear, v: V, screen: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio }, ua: navigator.userAgent } }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.err || r.status);
    $('#sent').style.color = ''; $('#sent').textContent = `Sent ${new Date().toLocaleTimeString()}: "${verdict === 'reads_as_cave' ? 'Reads as a cave' : 'Still a box'}" for ${SCENES[state.scene].button}.`; $('#noteBox').value = '';
  } catch (err) { $('#sent').style.color = '#ff9a7a'; $('#sent').textContent = `Could not send: ${err.message}`; }
}
$('#good').onclick = () => sendVerdict('reads_as_cave'); $('#bad').onclick = () => sendVerdict('still_a_box');

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
window.__state = state; window.__P = P; window.__kit = kit; window.__fx = !!lighting; window.__send = sendVerdict;
await build();
