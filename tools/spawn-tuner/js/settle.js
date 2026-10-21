// Settling: simple gravity for things placed on surfaces (Harry 2026-10-02: "a lot of objects (but not all) floating
// above tables ... apply simple gravity just using the meshes to get contact to happen ... ok if that happens slowly in
// the background"). The solver puts a surface item at its parent's *catalog* top; the real mesh top differs (a tabletop
// thinner than its box, a dished tray, a lid). Each queued item casts short rays straight down from the lowest
// vertices of its own mesh onto its parent's real mesh and drops (or lifts) by the smallest gap, so it touches.
// Works in the rest pose, never the animated one, so it can run mid-spawn. Idle-time budgeted; parents before riders.
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast; // falls back to the plain raycast for geometry without a tree

const UP = 0.35;        // ft: rays start this far above each bottom vertex, so a sunk item can come back up (< shelf spacing)
const MAX_DROP = 1.25;  // ft: a bigger gap means the parent isn't really under it; leave it alone
const MIN_SUPPORT = 0.3; // share of bottom samples that must land on an up-facing part of the parent (overhangs don't fall)
const FLAT = 0.6;        // |normal.y| above this counts as a surface you can rest on (barrel bulges and table edges don't)
const MAX_SAMPLES = 40; // bottom vertices sampled per item
const BAND = 0.06;      // ft: "bottom" = vertices within this of the lowest point (plus 8% of the item's height)
const TOL = 0.01;       // ft: gaps smaller than this are contact already

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _ray = new THREE.Raycaster();
_ray.firstHitOnly = true;
const doubleSide = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

// matrix of an item's group at rest (position + yaw, unit scale): what the pose looks like once the animation ends
function restMatrix(it) {
  return new THREE.Matrix4().compose(new THREE.Vector3(it.rest.x, it.rest.y, it.rest.z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rest.rot), new THREE.Vector3(1, 1, 1));
}
// every mesh under the item's visual, with its matrix relative to the item's group
function meshesOf(it) {
  const out = [];
  const walk = (o, rel) => {
    o.updateMatrix();
    const m = rel.clone().multiply(o.matrix);
    if (o.isMesh && o.geometry?.attributes?.position && o.visible !== false && !o.userData.noSettle) out.push({ mesh: o, rel: m });
    for (const c of o.children) walk(c, m);
  };
  walk(it.visual, new THREE.Matrix4());
  return out;
}

export function createSettler({ itemsOfRoom, onSettled = () => {} }) {
  const queue = new Set();
  const stats = { settled: 0, moved: 0, skipped: 0, ms: 0, last: [] };
  const proxies = new WeakMap(); // geometry -> proxy mesh used for raycasting in rest space

  function parentOf(it) {
    const pu = it.spec.parent; if (!pu) return null;
    for (const o of itemsOfRoom(it.roomId)) if (o.spec.uid === pu) return o;
    return null;
  }
  function ridersOf(it) { return it.spec.uid ? itemsOfRoom(it.roomId).filter(o => o.spec.parent === it.spec.uid) : []; }

  function enqueue(it) { if (it?.spec?.parent && it.visual) queue.add(it); }
  function enqueueRiders(it) { for (const r of ridersOf(it)) enqueue(r); }

  function proxyFor(mesh, world) {
    let p = proxies.get(mesh.geometry);
    if (!p) {
      if (!mesh.geometry.boundsTree) mesh.geometry.computeBoundsTree();
      p = new THREE.Mesh(mesh.geometry, doubleSide); p.matrixAutoUpdate = false; proxies.set(mesh.geometry, p);
    }
    p.matrixWorld.copy(world);
    return p;
  }

  // the smallest vertical gap between the item's underside and its parent's real surface (rest space, ft); null = no hit
  function gapOf(it, parent) {
    const R = restMatrix(it), RP = restMatrix(parent);
    const pts = []; let minY = Infinity, maxY = -Infinity;
    for (const { mesh, rel } of meshesOf(it)) {
      _m.multiplyMatrices(R, rel);
      const pos = mesh.geometry.attributes.position, n = pos.count, step = Math.max(1, Math.floor(n / 4000));
      for (let i = 0; i < n; i += step) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
        pts.push(_v.x, _v.y, _v.z); if (_v.y < minY) minY = _v.y; if (_v.y > maxY) maxY = _v.y;
      }
    }
    if (!pts.length) return null;
    const cut = minY + BAND + 0.08 * (maxY - minY);
    const low = []; for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] <= cut) low.push(i);
    const stride = Math.max(1, Math.floor(low.length / MAX_SAMPLES));
    const targets = meshesOf(parent).map(({ mesh, rel }) => proxyFor(mesh, new THREE.Matrix4().multiplyMatrices(RP, rel)));
    if (!targets.length) return null;
    let gap = Infinity, hits = 0;
    for (let k = 0; k < low.length; k += stride) {
      const i = low[k];
      _ray.set(new THREE.Vector3(pts[i], pts[i + 1] + UP, pts[i + 2]), new THREE.Vector3(0, -1, 0));
      _ray.far = UP + MAX_DROP;
      const h = _ray.intersectObjects(targets, false)[0];
      if (!h || !h.face) continue;
      _n.copy(h.face.normal).applyMatrix3(_nm.getNormalMatrix(h.object.matrixWorld)).normalize();
      if (Math.abs(_n.y) < FLAT) continue; // a steep face: the side of the parent, not something to rest on
      hits++; gap = Math.min(gap, pts[i + 1] - h.point.y);
    }
    const samples = Math.ceil(low.length / stride);
    return hits && hits >= MIN_SUPPORT * samples ? { gap, hits, samples } : (hits ? { gap: null, hits, samples, unsupported: true } : null);
  }

  function settleOne(it) {
    const parent = parentOf(it);
    if (!parent?.visual) { // not registered in its room yet (rooms add items after they're built): try again shortly
      it._settleTries = (it._settleTries || 0) + 1;
      if (it._settleTries < 30) return 'retry';
      stats.skipped++; return;
    }
    const g = gapOf(it, parent);
    if (!g || g.gap == null || g.gap > MAX_DROP || g.gap < -UP) { stats.skipped++; it.settle = { gap: g?.gap ?? null, applied: 0, ok: false, why: !g ? 'no surface under it' : g.unsupported ? 'mostly overhanging' : 'too far to fall' }; return; }
    const dy = Math.abs(g.gap) > TOL ? -g.gap : 0;
    it.settle = { gap: g.gap, applied: dy, hits: g.hits, samples: g.samples, ok: true };
    stats.settled++;
    if (dy) {
      stats.moved++;
      it.rest.y += dy; it.group.position.y += dy;
      for (const r of ridersOf(it)) { r.rest.y += dy; r.group.position.y += dy; queue.add(r); } // riders ride along, then settle on the new spot
      onSettled(it, dy);
    }
    stats.last.unshift({ tag: it.tag, id: it.spec.id, gap: +g.gap.toFixed(3) }); stats.last.length = Math.min(stats.last.length, 12);
  }

  // run for at most `budget` ms; parents first (an item whose parent is still queued waits its turn)
  function tick(budget = 4) {
    if (!queue.size) return 0;
    const t0 = performance.now(); let n = 0; const later = [];
    while (queue.size && performance.now() - t0 < budget) {
      let pick = null;
      for (const it of queue) { const p = parentOf(it); if (!p || !queue.has(p)) { pick = it; break; } }
      pick = pick || queue.values().next().value;
      queue.delete(pick);
      if (!pick.group.parent && !pick.asleep) continue; // removed while waiting (asleep: out of the scene but still there; it settles in rest space)
      try { if (settleOne(pick) === 'retry') later.push(pick); } catch (e) { stats.skipped++; console.warn('settle', pick.spec?.id, e); }
      n++;
    }
    for (const it of later) queue.add(it);
    stats.ms += performance.now() - t0;
    return n;
  }

  return { enqueue, enqueueRiders, tick, pending: () => queue.size, pendingList: () => [...queue].map(it => ({ tag: it.tag, id: it.spec.id, tries: it._settleTries || 0, attached: !!it.group.parent })), stats, gapOf: (it) => { const p = parentOf(it); const g = p ? gapOf(it, p) : null; return g && g.gap != null ? g : null; } };
}
