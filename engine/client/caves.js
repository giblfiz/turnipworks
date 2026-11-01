// CAVES, DRAWN (2026-10-25; docs/VERTICAL.md "Caves"). core/caves.js works a cave out from its stored squares and its
// seed (the caves pilot's rule, unchanged); this turns that into SHELL PIECES (world.js buildShell), so a cave's rock is
// cut, hidden, ghosted, put to sleep, fogged and picked exactly like any room's walls:
//   one piece per CHUNK (a wall chunk, a corner column, rubble, a PILLAR, a stalagmite): the pilot's generated rock,
//     reduced for the game (experiments/2026-10-25-caves-game/prep_chunks.mjs: canonical frame baked in, about 6k
//     triangles, a 512-px picture, meshopt), served from data/caves/ (git-ignored binaries, like every mesh); the
//     stalagmites are the library's own (`stalagmite`, `stalagmite--s2`): only for a cave from before 2026-10-27 not yet
//     converted (no `recipe.stalagObjects`); a cave's stalagmites are THINGS of the room now (core/caves.js STALAG_CAT),
//     drawn, picked and moved as things. Layer 'walls': the Walls switch hides them;
//     under vision fog each shows only once the floor next to it is known (spec.fogAt, world.js fogHidesShell).
//   one piece for the cave's BACK: the rock face behind the chunks (from under the floor up to the ground, so a gap
//     between two chunks shows rock, never the dark) and the floor carried out from the grid line under the chunks to
//     the face (the room's own floor picture), so the floor never ends in a slot along the rock (the pilot's dark rim).
//   above the ground (a cave at y >= 0, which the tool never makes but a GM can): a flat rock top, the pilot's cap.
// The ground over a cave below it is cut along the cave's LIP (world.js rebuildGround, core/caves.js solidStrips), not
// along its squares, so the chunks' fronts show from above and their tops come up through the ground as its rim.
import * as THREE from 'three';
import { T } from './tuner.js';
import { caveOf, isCave, solidStrips } from '../core/caves.js';
import { KIT } from '../core/cavekit.js';
import { CELL } from '../core/caverule.js';

const CAVE_URL = (f) => new URL(`./data/caves/${f}`, import.meta.url).href;
export const CAVE_FILES = Object.keys(KIT).filter(k => !k.startsWith('_')).map(id => `${id}.glb`);
const STALAG_SKU = (file) => file.replace(/\.glb$/, '');
const CAP_UP = 8.4; // ft over the floor: a cave above the ground wears the pilot's flat rock top here

let loaderP = null;
const loader = () => loaderP ||= import(`${T.base}js/gltf.js${T.v && T.v !== 'dev' ? `?v=${T.v}` : ''}`).then(m => m.gltfLoader()).catch(async () => { const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'); return new GLTFLoader(); });
const templates = new Map();
export const caveStats = { loaded: 0, failed: 0 };
function template(id) {
  if (!templates.has(id)) templates.set(id, loader().then(l => l.loadAsync(CAVE_URL(`${id}.glb`))).then(g => {
    const k = KIT[id], gain = k?.gain || [1, 1, 1], root = g.scene;
    root.traverse(o => { if (!o.isMesh) return; const m = o.material = o.material.clone(); Object.assign(m, { roughness: 0.95, metalness: 0, side: THREE.DoubleSide, roughnessMap: null, metalnessMap: null, transparent: false }); m.color.setRGB(gain[0], gain[1], gain[2]); o.castShadow = o.receiveShadow = true; });
    caveStats.loaded++; return root;
  }).catch(err => { caveStats.failed++; console.warn('cave piece failed', id, String(err).slice(0, 200)); return null; }));
  return templates.get(id);
}

// the floor squares' points nearest a spot, pulled into the square: what "known" means for a piece of the cave's rock
function nearFloor(cells, x, z) {
  let best = null, bd = Infinity;
  for (const key of cells) {
    const [i, j] = key.split(',').map(Number), cx = Math.min((i + 1) * CELL - 0.6, Math.max(i * CELL + 0.6, x)), cz = Math.min((j + 1) * CELL - 0.6, Math.max(j * CELL + 0.6, z)), d = Math.hypot(cx - x, cz - z);
    if (d < bd) { bd = d; best = [cx, cz]; }
  }
  return best;
}
function fogPoints(C, p) {
  if (p.role === 'pillar') { const [i, j] = p.cell, cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL; return [[cx - 3.1, cz], [cx + 3.1, cz], [cx, cz - 3.1], [cx, cz + 3.1]]; }
  if (p.role === 'stalagmite') return [[p.x, p.z]];
  const w = (p.w || 5) / 3, ax = Math.cos(p.rot), az = -Math.sin(p.rot), out = [];
  for (const t of [-1, 0, 1]) { const q = nearFloor(C.cells, p.x + ax * w * t, p.z + az * w * t); if (q && !out.some(o => Math.hypot(o[0] - q[0], o[1] - q[1]) < 0.5)) out.push(q); }
  return out;
}

// the rock face along the face loops (from under the floor up to `top`), and the floor carried out under the chunks
function backGeometry(C, y, top) {
  const pos = [], uv = [], idx = [];
  for (const loop of C.faceLoops) {
    const base = pos.length / 3, n = loop.length; let run = 0;
    for (let i = 0; i <= n; i++) {
      const [x, z] = loop[i % n]; if (i) run += Math.hypot(x - loop[i - 1][0], z - loop[i - 1][1]);
      pos.push(x, y - 0.5, z, x, top, z); uv.push(run / 7, -0.07, run / 7, (top - y) / 7);
    }
    for (let i = 0; i < n; i++) { const a = base + i * 2, b = a + 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const face = new THREE.BufferGeometry(); face.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); face.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); face.setIndex(idx); face.computeVertexNormals();
  // the floor out to the face: the face loops' box, less the floor squares (their own tiles), a hair under the tiles
  const [x0, z0, x1, z1] = C.box, fp = [], fu = [];
  for (const [a, b, c, d] of solidStrips([Math.floor(x0) - 1, Math.floor(z0) - 1, Math.ceil(x1) + 1, Math.ceil(z1) + 1], [], (gx, gz) => C.cells.has(`${gx},${gz}`), 1)) {
    fp.push(a, y - 0.01, b, a, y - 0.01, d, c, y - 0.01, d, a, y - 0.01, b, c, y - 0.01, d, c, y - 0.01, b);
  }
  for (let i = 0; i < fp.length; i += 3) fu.push(fp[i] / CELL, -fp[i + 2] / CELL);
  const apron = new THREE.BufferGeometry(); apron.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); apron.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); apron.computeVertexNormals();
  return { face, apron };
}
function capGeometry(C, y) { // a cave above the ground: the pilot's flat rock top, 10 ft round the lip
  const [x0, z0, x1, z1] = C.box, p = [], u = [], h = y + CAP_UP;
  for (const [a, b, c, d] of solidStrips([x0 - 10, z0 - 10, x1 + 10, z1 + 10], C.lipLoops, () => false, 0.25)) p.push(a, h, b, a, h, d, c, h, d, a, h, b, c, h, d, c, h, b);
  for (let i = 0; i < p.length; i += 3) u.push(p[i] / 9, -p[i + 2] / 9);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); g.computeVertexNormals();
  return g;
}
const rockTint = new THREE.Color(...(KIT._rock_tint || [0.75, 0.75, 0.75]));
async function backVisual(world, C, y, floorUrl) {
  const g = new THREE.Group(), top = y < 0 ? 0.3 : y + CAP_UP, { face, apron } = backGeometry(C, y, top);
  let map = null; try { map = floorUrl ? (await world.assets.texture(floorUrl)).clone() : null; if (map) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.needsUpdate = true; } } catch { map = null; }
  const faceMat = new THREE.MeshStandardMaterial({ map, roughness: 1, side: THREE.DoubleSide, color: rockTint.clone().multiplyScalar(0.9) });
  const floorMat = new THREE.MeshStandardMaterial({ map, roughness: 0.96, color: new THREE.Color(...(KIT._floor_tint || [1, 1, 1])), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const fm = new THREE.Mesh(face, faceMat), am = new THREE.Mesh(apron, floorMat);
  fm.castShadow = fm.receiveShadow = true; am.receiveShadow = true; fm.userData.caveFace = true; am.userData.caveApron = true; g.add(fm, am);
  if (y >= 0) { const cap = new THREE.Mesh(capGeometry(C, y), new THREE.MeshStandardMaterial({ map, roughness: 1, color: rockTint.clone().multiplyScalar(0.45) })); cap.receiveShadow = true; cap.userData.caveCap = true; g.add(cap); }
  g.userData.cave = C.id;
  return g;
}
async function chunkVisual(world, p) {
  const g = new THREE.Group();
  if (p.role === 'stalagmite') {
    const sku = STALAG_SKU(p.file), Z = world.roomgen?.sizeOf?.('stalagmite', sku);
    if (!Z?.url) return null;
    const v = await world.assets.visualFor({ cat: 'stalagmite', sku: Z.sku, url: Z.url, s: Z.s, dims: Z.dims, yaw: Z.yaw || 0, place: 'floor' });
    if (!v) return null;
    g.add(v); g.scale.setScalar(p.h / (Z.dims?.[1] || p.h)); // (the library's own stalagmite, as tall as the rule asks)
  } else {
    const t = await template(p.id); if (!t) return null;
    const v = t.clone(true); v.scale.set(p.scale[0], p.scale[1], p.scale[2]); g.add(v);
  }
  g.userData.caveRole = p.role;
  return g;
}

// THE SHELL PIECES OF ONE CAVE: [[uid, { spec, sig, roomId, make }], ...]. `rc`: the tuner room (world.js buildShell);
// `ents`: the area's entities; `floorUrl`: the room's floor picture (its first floor tile's)
export function caveShellSpecs(world, ents, rc, floorUrl) {
  const room = ents[rc.id]; if (!room || !isCave(room.recipe)) return [];
  const C = caveOf(ents, room), y = rc.y || 0, out = [], things = !!room.recipe.stalagObjects;
  C.placements.forEach((p, n) => {
    if (things && p.role === 'stalagmite') return; // (2026-10-27) its stalagmites are things of the room now (core/caves.js STALAG_CAT): drawn as things, the GM's
    const fp = fogPoints(C, p); // (shown once at least half of these floor points beside it are known: a chunk at the edge of what a pawn has seen does not stand out over the fog)
    const uid = `cave:${rc.id}:${n}`, h = p.role === 'stalagmite' ? p.h : (KIT[p.id]?.size_ft?.h || 10) * (p.scale?.[1] || 1);
    const w = p.role === 'stalagmite' ? 2 : (KIT[p.id]?.size_ft?.w || 5) * (p.scale?.[0] || 1), d = p.role === 'stalagmite' ? 2 : (KIT[p.id]?.size_ft?.d || 4) * (p.scale?.[2] || 1);
    const spec = { uid, gen: 'cave', cave: p.role, layer: 'walls', roomId: rc.id, x: p.x, y: y + (p.y || 0), z: p.z, rot: p.rot || 0, dims: [w, h, d], fogAt: fp, fogNeed: Math.ceil(fp.length / 2), fogY: y, ...(p.role === 'pillar' && { cell: p.cell }), ...(p.id && { id: p.id }), ...(p.file && { file: p.file }) };
    out.push([uid, { spec, sig: `cave|${p.role}|${p.id || p.file}|${p.x.toFixed(2)}|${p.z.toFixed(2)}|${(p.rot || 0).toFixed(3)}|${(p.scale || []).map(v => v.toFixed(3)).join(',')}|${(p.h || 0).toFixed(2)}|${y}`, roomId: rc.id, make: () => chunkVisual(world, p) }]);
  });
  const buid = `cave:${rc.id}:back`, [x0, z0, x1, z1] = C.box;
  out.push([buid, { spec: { uid: buid, gen: 'cave', cave: 'back', layer: 'floor', roomId: rc.id, x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, rot: 0, dims: [0.2, 0.2, 0.2], fogAt: [...C.cells].map(k => k.split(',').map(Number)).map(([i, j]) => [(i + 0.5) * CELL, (j + 0.5) * CELL]), fogY: y },
    sig: `cave|back|${C.faceLoops.map(l => l.length).join(',')}|${C.box.map(v => v.toFixed(2)).join(',')}|${y}|${floorUrl || ''}|${[...C.cells].sort().join(';')}`, roomId: rc.id, make: () => backVisual(world, C, y, floorUrl).then(g => { g.position.set(-(x0 + x1) / 2, -y, -(z0 + z1) / 2); const o = new THREE.Group(); o.add(g); return o; }) }]);
  return out;
}
export { caveOf, isCave };
