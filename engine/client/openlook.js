// HOW AN OPENABLE SHOWS IT IS OPEN (2026-10-30; core/openables.js says WHAT opens). Three ways, best first:
//   motion  the closed mesh itself moves: a door leaf swings on its hinge edge, a pair of leaves swing apart from the
//           middle, a secret wall swings aside whole, a portcullis slides up. Pivoting and moving the existing mesh
//           only (the open/close pilot's rule, experiments/2026-10-02-openclose: generated surfaces, placement
//           transforms and the hinge rig; no caps, rims or patches). The change animates (client/world.js openStep)
//           unless the viewer asked for still (reduce motion, Low graphics); a load or a replay shows the end pose.
//   swap    the catalog's "-open" twin of the same variant (the fine wardrobe opens as the fine open wardrobe, the
//           dressed-stone window as the dressed-stone one); a wall material with no twin of its own does not swap
//           (it would change its stone). The swap pops a little (world.js), unless still.
//   none    no open look exists: listed in experiments/2026-10-30-openables/INVENTORY.md for generated models.
// An Alignment Bench record (GET /tuner/hinges) wins over all of these, as before (assets.specOf).
import * as THREE from 'three';
import { T } from './tuner.js';
import { openTwinId } from '../core/openables.js';

// rig records, in the GLB frame (glTF Y-up, front +Z, width along X), pivots as fractions of the mesh's own box
// FLAT TO THE WALL (2026-10-30, the first-person walker: a leaf opened 100 degrees stands across a 5-ft hallway, and a
// walker goes "straight through the solid door panel"): a leaf swings 175 degrees on its left edge to lie along the wall
// beside its doorway, clear of the doorway AND of the room. Its hinge stands out from the wall's middle line by half of
// (the wall's half thickness, WALL_FACE, plus its own half thickness), so the leaf comes to rest just off the wall's face.
const LEAF = { mode: 'leaf', openAngle: -175 };   // a door on its left edge
const DOUBLE = { mode: 'double', openAngle: 175 }; // two leaves from the middle, each to its own side
const WALL_FACE = 0.62; // ft from a wall's middle line to its face (world.js OUTSET 0.6, and a hair)
const SLIDE = { mode: 'slide', lift: 0.8 };                                                                         // up, 80% of its height
const leafOnly = (rig) => (k) => k?.piece === 'leaf' ? rig : null; // (the frame-and-door pieces open by their twin)
// by catalog object (a function: by the SKU's record); null = not by motion
export const RIGS = {
  'door-cell-bars': LEAF, 'door-crypt': LEAF, 'door-face-carved': LEAF, 'door-glazed': LEAF, 'door-panelled': LEAF,
  'door-rune-sealed': LEAF, 'door-secret-bookcase': LEAF, 'door-tower': LEAF,
  'door-plank': leafOnly(LEAF), 'door-reinforced': leafOnly(LEAF),
  'door-double-grand': DOUBLE, 'gate-double-timber': DOUBLE, 'door-barn-double': (k) => k?.family === 'rough-timber' ? DOUBLE : null,
  'gate-fence': LEAF, 'crypt-gate-iron': LEAF, 'stable-stall-gate': LEAF, 'privy-stall-door': LEAF, 'stable-stall-door': LEAF,
  'tomb-door-sealed': LEAF, 'wall-secret-door': LEAF, // (turned on its middle it read shut to Gemini: both halves still fill the gap; swung whole it leaves the doorway clear)
  'portcullis': SLIDE,
};
export function motionRig(lib, cat, sku) {
  const r = RIGS[cat]; if (!r) return null;
  return typeof r === 'function' ? r(lib.objects[cat]?.skus.find(k => k.sku === sku)) || null : r;
}

// the open twin of THIS variant: { id, k } (k: its SKU record) or null. The same suffix first (wardrobe--fine--s2 →
// wardrobe-open--fine--s2), then the same wall material (a window's family), then the same first word (fine/common),
// then any; a closed piece of a wall material that has no twin of its material gets none.
export function openTwinSku(lib, cat, sku, usable = () => true) {
  const id = openTwinId(lib, cat); if (!id) return null;
  const o = lib.objects[id], closed = lib.objects[cat]?.skus.find(k => k.sku === sku);
  const ok = o.skus.filter(k => k.bounds && k.url); if (!ok.length) return null;
  const pool = ok.filter(usable).length ? ok.filter(usable) : ok;
  const suffix = sku && sku.startsWith(cat) ? sku.slice(cat.length) : '';
  let k = ok.find(x => x.sku === id + suffix);
  if (!k && closed?.family) { k = pool.find(x => x.family === closed.family || x.sku.includes(`--${closed.family}`)); if (!k) return null; }
  if (!k) { const w = suffix.split('--').filter(Boolean)[0]; if (w && !/^s\d+$/.test(w)) k = pool.find(x => x.sku.includes(`--${w}`)); }
  return { id, k: k || pool[0] };
}

// the look a thing has open: 'motion' | 'swap' | null (the census, the tests, world.js)
export function openLookOf(lib, e, hingeRec = null, usable) {
  if (hingeRec?.mode === 'hinge' || motionRig(lib, e.cat, e.sku)) return 'motion';
  return openTwinSku(lib, e.cat, e.sku, usable) ? 'swap' : null;
}

// ---------- the rigs ----------
// split a mesh root's triangles into moving parts, each about its own pivot (GLB frame), as the tuner's rigHinge does
// for one part: the root's scale is baked in first, so a stretched kit piece still moves rigidly.
// parts: [{ pivot: Vector3 (GLB frame), axis: [x,y,z], angle: rad, lift: Vector3 (GLB frame) | null }]
// partOf(centroid in the GLB frame) → part index (-1: stays)
function rigParts(root, parts, partOf) {
  const box = T.hinge.glbBox(root); if (box.isEmpty()) return null;
  const S = root.scale.clone(); root.scale.set(1, 1, 1);
  const Smat = new THREE.Matrix4().makeScale(S.x, S.y, S.z);
  const nodes = parts.map((p, i) => {
    const P = p.pivot.clone().multiply(S), pivot = new THREE.Group(), inner = new THREE.Group();
    pivot.name = `open_part_${i}`; pivot.position.copy(P); inner.position.copy(P).negate(); pivot.add(inner);
    return { pivot, inner, base: P.clone(), axis: new THREE.Vector3(...(p.axis || [0, 1, 0])).multiply(S).normalize(), angle: p.angle || 0, lift: p.lift ? p.lift.clone().multiply(S) : null };
  });
  const meshes = []; root.traverse(o => { if (o.isMesh && o !== root) meshes.push(o); }); if (root.isMesh) meshes.push(root);
  const rels = new Map(meshes.map(o => { const r = new THREE.Matrix4(); for (let p = o; p && p !== root; p = p.parent) { if (p.matrixAutoUpdate) p.updateMatrix(); r.premultiply(p.matrix); } return [o, r]; }));
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (const o of meshes) {
    const relG = rels.get(o), rel = Smat.clone().multiply(relG), geo = o.geometry, pos = geo.getAttribute('position'), idx = geo.index ? geo.index.array : null;
    const n = idx ? idx.length : pos.count, lists = parts.map(() => []), still = [];
    for (let i = 0; i < n; i += 3) {
      c.set(0, 0, 0); for (let j = 0; j < 3; j++) { v.fromBufferAttribute(pos, idx ? idx[i + j] : i + j).applyMatrix4(relG); c.add(v); } c.divideScalar(3);
      const b = partOf(c), dst = b >= 0 ? lists[b] : still; for (let j = 0; j < 3; j++) dst.push(idx ? idx[i + j] : i + j);
    }
    const make = (list) => { const g = new THREE.BufferGeometry(); for (const [nm, a] of Object.entries(geo.attributes)) g.setAttribute(nm, a); g.setIndex(list); g.computeBoundingBox(); g.computeBoundingSphere(); const m = new THREE.Mesh(g, o.material); m.matrixAutoUpdate = false; m.matrix.copy(rel); m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; m.userData.hingePart = true; return m; };
    if (still.length) root.add(make(still));
    lists.forEach((l, i) => { if (l.length) nodes[i].inner.add(make(l)); });
    if (o === root) o.geometry = new THREE.BufferGeometry(); else o.removeFromParent();
  }
  for (const nd of nodes) root.add(nd.pivot);
  const q = new THREE.Quaternion();
  const rig = { root, t: 0, set(t) { rig.t = t; for (const nd of nodes) { nd.pivot.quaternion.copy(q.setFromAxisAngle(nd.axis, nd.angle * t)); nd.pivot.position.copy(nd.base); if (nd.lift) nd.pivot.position.addScaledVector(nd.lift, t); nd.pivot.updateMatrixWorld(true); } } };
  root.userData.hinge = rig; // (as the tuner's rigHinge marks its root: the bench and the tests read it there)
  return rig;
}
// rig a visual's mesh root with a motion record; → { set(t), t } (t 0 shut … 1 open) or null
// THE SHUT PLACE STAYS CLICKABLE: an open leaf stands aside, so a click in the doorway (on the map, or in first person:
// fpv.js opens or shuts the nearest openable hit) would miss it; an unseen box where the shut piece was keeps the click
// (as the open twins always did: they fill the doorway). Not drawn, no shadow, no selection glow (selFx: the halo skips it).
const PROXY_MAT = new THREE.MeshBasicMaterial({ visible: false });
function addProxy(root) {
  const b = T.hinge.glbBox(root); if (b.isEmpty()) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), PROXY_MAT), sz = b.getSize(new THREE.Vector3());
  m.scale.set(Math.max(sz.x, 0.05), Math.max(sz.y, 0.05), Math.max(sz.z, 0.3)); b.getCenter(m.position);
  m.castShadow = m.receiveShadow = false; Object.assign(m.userData, { pickProxy: true, selFx: true, hingeHelper: true });
  root.add(m);
}
export function rigOpen(visual, rec) {
  let root = null; visual.traverse(o => { if (!root && o.userData.meshRoot) root = o; }); root ||= visual;
  const rig = rigOpenRoot(root, rec); if (rig) addProxy(root);
  return rig;
}
function rigOpenRoot(root, rec) {
  if (rec.mode === 'hinge') return T.hinge.rigHinge(root, rec);
  const box = T.hinge.glbBox(root); if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  // the hinge line, in the GLB frame: off the middle toward the front (+Z) by half of (WALL_FACE + half the leaf), in feet
  const S = root.scale, depthFt = size.z * Math.abs(S.z), hz = mid.z + ((WALL_FACE + depthFt / 2) / 2) / Math.abs(S.z || 1);
  if (rec.mode === 'leaf') return rigParts(root, [{ pivot: new THREE.Vector3(box.min.x, 0, hz), angle: THREE.MathUtils.degToRad(rec.openAngle ?? -175) }], () => 0);
  if (rec.mode === 'double') {
    const a = THREE.MathUtils.degToRad(rec.openAngle ?? 175);
    return rigParts(root, [{ pivot: new THREE.Vector3(box.min.x, 0, hz), angle: -a }, { pivot: new THREE.Vector3(box.max.x, 0, hz), angle: a }], (p) => p.x < mid.x ? 0 : 1);
  }
  if (rec.mode === 'slide') return rigParts(root, [{ pivot: new THREE.Vector3(0, 0, 0), lift: new THREE.Vector3(0, (rec.lift ?? 0.8) * size.y, 0) }], () => 0);
  return null;
}
