// Holes in the client (core/holes.js holds the rules; docs/VERTICAL.md "Holes and pits").
//
// DRAWN: a hole is the CUT itself. The floor it is on loses its floor tile, its slab and the ground on the squares it
// covers (client/world.js buildShell, through core/stairs.js holesAt), so what shows is the floor below and, upstairs,
// the slab's cut edge. A ROUND hole cuts whole squares too, and the floor round the circle is put back: each square's
// own floor tile (the very same texture, turned and mirrored as it was) drawn with the circle cut out of it in its
// shader (clipCircles), and under an upper floor the slab's squares the same way, with the circle's own edge as an open
// cylinder of the slab's timber or stone (roundRim). No picture is painted for a hole.
// THE OBJECT ITSELF (what is clicked, selected, dragged) is an invisible plate over the opening (holeVisual); while
// placing, the ghost is its outline (holeGhost).
import * as THREE from 'three';
import * as HO from '../core/holes.js';

const MAX_CIRCLES = 4, MAX_RECTS = 2;
// discard the fragments inside any of `circles` ([{ x, z, r, below? }], world feet) or `rects` ([{ x0, z0, x1, z1,
// below? }]) on every mesh of `root` (materials cloned). `below`: only what is lower than that height (a pit's own black
// bottom is cut out of its mesh; its frame stays)
function clipShader(root, circles, rects) {
  const C = circles.slice(0, MAX_CIRCLES), Q = rects.slice(0, MAX_RECTS), BIG = 1e6;
  const cv = Array.from({ length: MAX_CIRCLES }, (_, i) => C[i] ? new THREE.Vector4(C[i].x, C[i].z, C[i].r, C[i].below ?? BIG) : new THREE.Vector4(0, 0, -1, BIG));
  const rv = Array.from({ length: MAX_RECTS }, (_, i) => Q[i] ? new THREE.Vector4(Q[i].x0, Q[i].z0, Q[i].x1, Q[i].z1) : new THREE.Vector4(1, 1, -1, -1)), ry = Array.from({ length: MAX_RECTS }, (_, i) => Q[i]?.below ?? BIG);
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const m = o.material.clone();
    m.onBeforeCompile = (sh) => {
      sh.uniforms.holeC = { value: cv }; sh.uniforms.holeR = { value: rv }; sh.uniforms.holeRy = { value: ry };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHoleW;').replace('#include <project_vertex>', '#include <project_vertex>\nvHoleW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vHoleW;\nuniform vec4 holeC[${MAX_CIRCLES}];\nuniform vec4 holeR[${MAX_RECTS}];\nuniform float holeRy[${MAX_RECTS}];`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nfor (int i = 0; i < ${MAX_CIRCLES}; i++) { if (holeC[i].z > 0.0 && vHoleW.y < holeC[i].w && distance(vHoleW.xz, holeC[i].xy) < holeC[i].z) discard; }\nfor (int i = 0; i < ${MAX_RECTS}; i++) { if (vHoleW.x > holeR[i].x && vHoleW.x < holeR[i].z && vHoleW.z > holeR[i].y && vHoleW.z < holeR[i].w && vHoleW.y < holeRy[i]) discard; }`);
    };
    m.customProgramCacheKey = () => `holeclip${MAX_CIRCLES}x${MAX_RECTS}`;
    o.material = m; o.castShadow = false; o.userData.holeClip = C.length + Q.length;
  });
  root.userData.holeClip = [...C.map(c => [c.x, c.z, c.r]), ...Q.map(q => [q.x0, q.z0, q.x1, q.z1])];
  return root;
}
export const clipCircles = (root, circles) => clipShader(root, circles, []);
// A THROUGH PIT (core/holes.js PIT_CATS to: 'below'): its own black bottom is cut out of its mesh, inside its opening and
// lower than `above` ft over the floor, so the floor below shows through its frame
export function clipPit(root, e, above = 0.35) {
  const S = HO.holeShapeOf(e), below = HO.holeFloor(e) + above;
  return S.shape === 'round' ? clipShader(root, [{ x: S.x, z: S.z, r: S.r, below }], []) : clipShader(root, [], [{ x0: S.x0, z0: S.z0, x1: S.x1, z1: S.z1, below }]);
}
// A SUNKEN PIECE (core/holes.js PIT_CATS `sunk`, the stepwell, 2026-11-07): the visual, in a holder (the entity's own
// frame), is stretched across the ground to just cover the squares its opening cuts (a generated mesh is rarely
// exactly square: the stepwell's was 15 x 12.75 ft over a 15 x 15 cut, which left the void showing along two sides) and
// lowered by that share of its own drawn height, so its rim meets the floor it is on and the rest of it goes down into
// the cut. Nothing is clipped. → the holder (world.js draws it in the visual's place)
export function sinkPit(root, e) {
  const P = HO.pitOf(e); if (!P?.sunk) return root;
  const holder = new THREE.Group(); holder.add(root); holder.updateMatrixWorld(true);
  const b = new THREE.Box3();
  root.traverse(o => { if (!o.isMesh || !o.geometry || o.userData.pickProxy) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); });
  if (b.isEmpty()) return root;
  const cells = HO.holeCells(e), xs = cells.map(c => c[0]), zs = cells.map(c => c[1]);
  if (cells.length) {
    let wx = (Math.max(...xs) - Math.min(...xs) + 1) * 5, wz = (Math.max(...zs) - Math.min(...zs) + 1) * 5;
    if (Math.round((e.rot || 0) / (Math.PI / 2)) % 2) [wx, wz] = [wz, wx]; // (the cut is in the world; the holder turns with the thing)
    // what must cover the cut: the mesh's solid core (`core`: a rectangle in its GLB's units, measured: experiments/2026-11-07-
    // culture-roofs/such/tools/core_rect.py), else its whole box. Generated meshes are ragged at the edge: the stepwell's has
    // no geometry in its corners and along one side, and stretched by its box it showed "large gaps revealing the void"
    let c = b;
    if (P.core) {
      let mr = null; root.traverse(o => { if (!mr && o.userData.meshRoot) mr = o; }); mr ||= root; // (the GLB's own frame: the mesh root, inside its yaw)
      const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert().multiply(mr.matrixWorld); // (GLB units: a geometry's bounding box can hold vertices no triangle uses, so no fractions of it)
      const [f0, h0, f1, h1] = P.core, at = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(toHolder);
      c = new THREE.Box3().setFromPoints([at(f0, h0), at(f1, h0), at(f0, h1), at(f1, h1)]);
    }
    const sx = (wx + 0.2) / Math.max(0.1, c.max.x - c.min.x), sz = (wz + 0.2) / Math.max(0.1, c.max.z - c.min.z);
    holder.scale.set(sx, 1, sz); holder.position.x = -sx * (c.min.x + c.max.x) / 2; holder.position.z = -sz * (c.min.z + c.max.z) / 2;
  }
  // both faces drawn: a generated mesh has triangles facing the wrong way here and there; on the ground the ground hid what
  // showed through them, sunk it is the void (rays down the tank: 19 of 29 misses were such faces)
  // and nothing of it drawn outside its cut (world feet): the ragged edge stretched past the cut stood up through the ground
  // round it ("a stretched, distorted fragment clipping near the edge", Gemini, blind); under the ground it was hidden anyway
  const keep = cells.length ? new THREE.Vector4(Math.min(...xs) * 5, Math.min(...zs) * 5, (Math.max(...xs) + 1) * 5, (Math.max(...zs) + 1) * 5) : null;
  root.traverse(o => { if (!o.isMesh || !o.material || o.userData.pickProxy) return; const m = o.material = o.material.clone(); m.side = THREE.DoubleSide;
    if (!keep) return;
    m.onBeforeCompile = (sh) => { sh.uniforms.sinkKeep = { value: keep };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSinkW;').replace('#include <project_vertex>', '#include <project_vertex>\nvSinkW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSinkW;\nuniform vec4 sinkKeep;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vSinkW.x < sinkKeep.x - 0.02 || vSinkW.z < sinkKeep.y - 0.02 || vSinkW.x > sinkKeep.z + 0.02 || vSinkW.z > sinkKeep.w + 0.02) discard;'); };
    m.customProgramCacheKey = () => 'sinkkeep'; });
  const drop = P.sunk * (b.max.y - b.min.y) + b.min.y; // (its bottom first to the floor, then down by the share)
  root.position.y -= drop;
  const out = new THREE.Group(); out.add(holder); out.userData = { drawnAs: root.userData.drawnAs, sunk: Math.round(drop * 100) / 100, keep: keep && keep.toArray() }; // (not meshRoot: that stays the mesh's)
  return out;
}
// the circle's own edge through a slab: an open cylinder (seen from inside the hole), `h` ft high, centred in the group
export function roundRim(r, h, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, Math.max(24, Math.round(r * 10)), 1, true), mat);
  m.material = mat.clone(); m.material.side = THREE.BackSide; m.receiveShadow = true; m.userData.noPick = true;
  return m;
}
// the object: an invisible plate over the opening (it is what a click, the selection box and a drag find)
const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
export function holeVisual(e) {
  const g = new THREE.Group(), S = HO.holeShapeOf(e);
  const geo = S.shape === 'round' ? new THREE.CircleGeometry(S.r, 40) : new THREE.PlaneGeometry(S.x1 - S.x0, S.z1 - S.z0);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, pickMat); m.position.y = 0.06; m.userData.holePlate = true; g.add(m);
  g.userData.hole = { shape: S.shape, size: HO.holeSize(e) };
  return g;
}
// while placing: the outline of the opening, on the floor, in a dark line, over a faint plate (the ghost fades it)
export function holeGhost(cat, d = 10) {
  const g = new THREE.Group(), round = HO.HOLE_CATS[cat]?.shape === 'round', r = (round ? d : 5) / 2;
  const line = new THREE.MeshBasicMaterial({ color: 0x15100b }), plate = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
  const ring = round ? new THREE.RingGeometry(r - 0.22, r, 48) : (() => { const s = new THREE.Shape(); s.moveTo(-r, -r); s.lineTo(r, -r); s.lineTo(r, r); s.lineTo(-r, r); s.closePath(); const h = new THREE.Path(); const q = r - 0.22; h.moveTo(-q, -q); h.lineTo(-q, q); h.lineTo(q, q); h.lineTo(q, -q); h.closePath(); s.holes.push(h); return new THREE.ShapeGeometry(s); })();
  const disc = round ? new THREE.CircleGeometry(r - 0.22, 48) : new THREE.PlaneGeometry(2 * r - 0.44, 2 * r - 0.44);
  for (const [geo, mat, y] of [[disc, plate, 0.07], [ring, line, 0.09]]) { geo.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geo, mat); m.position.y = y; m.userData.noPick = true; g.add(m); }
  g.userData.holeGhost = true;
  return g;
}
// a hole's catalog size (what roomgen.sizeOf gives a thing): a square is one 5-ft square; a round one is d across
export const holeSizeOf = (cat, d = 10) => cat === 'hole' ? { sku: null, url: null, flat: true, place: 'tile', s: [1, 1, 1], yaw: 0, dims: [5, 0.05, 5] } : { sku: null, url: null, flat: true, place: 'floor', s: [1, 1, 1], yaw: 0, dims: [d, 0.05, d] };
// the bar's and the library's entries (assets.js catalog): the square hole is painted like a floor tile, the round one placed like a thing
export const HOLE_ITEMS = [
  { id: 'hole', name: 'hole in the floor', desc: 'a 5-ft square opening in the floor: you see, and fall, to the level below', hint: 'paint: click a square, drag across squares, Shift-drag a rectangle', place: 'tile', tile: true, hole: true, flat: true, sku: null, url: null, aff: ['hazard', 'pass'] },
  ...HO.HOLE_SIZES.map(d => ({ id: 'hole-round', key: `hole-round-${d}`, d, name: `round hole ${d} ft`, desc: `a round opening ${d} ft across: you see, and fall, to the level below`, hint: 'click to place; Wider / Narrower in its ☰ menu, or "hole 15 ft" in the bar', place: 'floor', hole: true, flat: true, sku: null, url: null, aff: ['hazard', 'pass'] })),
];
