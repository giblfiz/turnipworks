// Hinges and two-state swaps for openable meshes (2026-10-04, written for the Alignment Bench). Shared by the bench
// (web/align/), look.js makeVisual() and therefore the game, so a hinge Harry sets on the bench is the hinge the game
// swings. Records come from the ratings server (kind "hinge", GET /tuner/hinges), keyed by the CLOSED mesh id
// ("<src>/<sku>@<sha1-8>"), in the open/close pilot's openclose.json shape, normalised like fire anchors:
//   hinge  { mode: 'hinge', parts: { moving: 'whole' | 'above', split }, pivot: [u, v, w], axis: [x, y, z],
//            openAngle (deg, right-hand rule about axis), duration (s), ease, openEase }
//          pivot and split are fractions of the mesh's own bounding box in the GLB frame (glTF Y-up, front +Z before
//          the orient yaw); axis is a direction in that frame. moving 'whole' swings the entire mesh (door leaves, gates,
//          shutters, trapdoors); 'above' cuts a single mesh at height `split` and swings the part above (chest lids).
//   swap   { mode: 'swap', open: { sku, mesh }, offset: [fx, fy, fz], yaw (deg) }
//          the open twin replaces the closed mesh; offset shifts it by fractions of the item's catalog box (w, h, d),
//          in the item frame (front +Z), so the swap does not jump.
import * as THREE from 'three';

export const EASE = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
};

// GET /tuner/hinges records -> { closedMesh: data } (records whose data is null mean "back to automatic": dropped)
export function hingesFromServer(records) {
  const out = {};
  for (const [k, rec] of Object.entries(records || {})) if (rec?.data?.mode) out[rec.data.mesh || k] = rec.data;
  return out;
}

// bounds of root's meshes in root's own frame (root's own transform excluded): the frame anchors are normalised in
export function glbBox(root) {
  const b = new THREE.Box3(), m = new THREE.Matrix4(), bb = new THREE.Box3();
  root.traverse(o => {
    if (!o.isMesh || !o.geometry || o.userData.hingeHelper) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    m.identity(); for (let p = o; p && p !== root; p = p.parent) { if (p.matrixAutoUpdate) p.updateMatrix(); m.premultiply(p.matrix); }
    b.union(bb.copy(o.geometry.boundingBox).applyMatrix4(m));
  });
  return b;
}

// split one geometry's triangles by their centroid height (y in root frame, via rel = mesh -> root matrix)
function splitByHeight(geo, rel, y0) {
  const pos = geo.getAttribute('position'), idx = geo.index ? geo.index.array : null;
  const n = idx ? idx.length : pos.count, lo = [], hi = [], v = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    let cy = 0;
    for (let k = 0; k < 3; k++) { const j = idx ? idx[i + k] : i + k; v.fromBufferAttribute(pos, j).applyMatrix4(rel); cy += v.y; }
    const dst = cy / 3 > y0 ? hi : lo;
    for (let k = 0; k < 3; k++) dst.push(idx ? idx[i + k] : i + k);
  }
  const part = (list) => {
    if (!list.length) return null;
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) g.setAttribute(name, attr);
    g.setIndex(list); g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  };
  return [part(lo), part(hi)];
}

// Rig a mesh root (look.js makeVisual's `userData.meshRoot` object, or any GLB clone) with a hinge record.
// The root's scale is baked into the parts first, so a non-uniformly stretched kit door still swings rigidly.
// Returns { set(t), angleAt(t), pivotLocal, axisLocal, root }; t = 0 closed … 1 open (any easing is the caller's).
export function rigHinge(root, rec) {
  const box = glbBox(root); if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const S = root.scale.clone(); root.scale.set(1, 1, 1);
  const Smat = new THREE.Matrix4().makeScale(S.x, S.y, S.z);
  const Pg = new THREE.Vector3(...(rec.pivot || [0.5, 1, 0])).multiply(size).add(box.min); // GLB frame
  const P = Pg.clone().multiply(S);                                                         // root frame, feet
  const axis = new THREE.Vector3(...(rec.axis || [1, 0, 0])).multiply(S).normalize();
  const moving = rec.parts?.moving || 'whole';
  const splitG = box.min.y + (rec.parts?.split ?? 0.6) * size.y;
  const pivot = new THREE.Group(); pivot.name = 'hinge_pivot'; pivot.position.copy(P);
  const inner = new THREE.Group(); inner.position.copy(P).negate(); pivot.add(inner);
  const meshes = []; root.traverse(o => { if (o.isMesh && o !== root) meshes.push(o); });
  if (root.isMesh) meshes.push(root); // a bare mesh root: wrap its own geometry
  const rels = new Map(meshes.map(o => { const r = new THREE.Matrix4(); for (let p = o; p && p !== root; p = p.parent) { if (p.matrixAutoUpdate) p.updateMatrix(); r.premultiply(p.matrix); } return [o, r]; }));
  for (const o of meshes) {
    const relG = rels.get(o), rel = Smat.clone().multiply(relG); // mesh -> root (GLB units), -> root (feet)
    const make = (geo) => { const m = new THREE.Mesh(geo, o.material); m.matrixAutoUpdate = false; m.matrix.copy(rel); m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; m.userData.hingePart = true; return m; };
    if (moving === 'above') {
      const [lo, hi] = splitByHeight(o.geometry, relG, splitG);
      if (lo) root.add(make(lo));
      if (hi) inner.add(make(hi));
    } else inner.add(make(o.geometry));
    if (o === root) { o.geometry = new THREE.BufferGeometry(); } else o.removeFromParent();
  }
  root.add(pivot);
  const rad = THREE.MathUtils.degToRad(rec.openAngle ?? -100), q = new THREE.Quaternion();
  const rig = {
    root, pivot, pivotLocal: P, axisLocal: axis, t: 0,
    set(t) { rig.t = t; pivot.quaternion.copy(q.setFromAxisAngle(axis, rad * t)); pivot.updateMatrixWorld(true); },
  };
  root.userData.hinge = rig;
  return rig;
}

// a swap record's open-twin placement in the item frame: position (ft) and extra yaw (rad) for the open visual
export function swapPlacement(rec, dims) {
  const o = rec?.offset || [0, 0, 0], [w, h, d] = dims || [1, 1, 1];
  return { x: (o[0] || 0) * w, y: (o[1] || 0) * h, z: (o[2] || 0) * d, yaw: THREE.MathUtils.degToRad(rec?.yaw || 0) };
}
