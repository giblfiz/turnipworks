// three.js side of the variant-B wall kit: plan items (js/wallkit.js) -> meshes. One shared material per texture
// (stone / plaster / wood, each albedo + derived normal map) plus untextured iron and glass, all with vertex-colour
// tints, so a whole family is a handful of materials and texture runs across every joint (UVs from world position).
import * as THREE from 'three';
import { faceUV } from './wallkit.js';
import { loadTexture } from './tex.js';

const TEX_FILES = {
  stone: ['assets/wallkit/stone.a09bad29.webp', 'assets/wallkit/stone.normal.7918ddb7.webp'],
  plaster: ['assets/wallkit/plaster.643a1080.webp', 'assets/wallkit/plaster.normal.2f059077.webp'],
  wood: ['assets/wallkit/wood.0cade8a5.webp', 'assets/wallkit/wood.normal.36931199.webp'],
};
export const KIT_TEXTURE_URLS = Object.values(TEX_FILES).flat();

let matsP = null;
export function kitMaterials() {
  if (matsP) return matsP;
  const load = (url, srgb) => loadTexture(url).then(t => { // (decoded off the main thread: js/tex.js)
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  matsP = (async () => {
    const out = {};
    for (const [k, [a, n]] of Object.entries(TEX_FILES)) {
      const [map, normalMap] = await Promise.all([load(a, true), load(n, false)]);
      out[k] = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.92, metalness: 0, vertexColors: true });
    }
    out.iron = new THREE.MeshStandardMaterial({ color: '#3b3734', roughness: 0.55, metalness: 0.55, vertexColors: true });
    out.glass = new THREE.MeshStandardMaterial({ color: '#33464c', roughness: 0.25, metalness: 0.2, vertexColors: true });
    return out;
  })();
  return matsP;
}

// ---- geometry ------------------------------------------------------------------------------------------------
function pushQuad(acc, mat, mode, q, tint, dirVec, o) { // q: 4 world points, CCW seen from outside
  const n = new THREE.Vector3().subVectors(q[1], q[0]).cross(new THREE.Vector3().subVectors(q[2], q[0]));
  if (n.lengthSq() < 1e-14) return;
  n.normalize();
  const nn = [n.x, n.y, n.z];
  const a = acc[mat] || (acc[mat] = { p: [], n: [], uv: [], c: [], m: [] });
  const mi = MODE_ID[mode] ?? 0;
  for (const i of [0, 1, 2, 0, 2, 3]) {
    const v = q[i];
    a.p.push(v.x - o[0], v.y - o[1], v.z - o[2]); a.n.push(...nn);
    a.uv.push(...faceUV(mode, mat, [v.x, v.y, v.z], nn, dirVec)); a.c.push(tint, tint, tint); a.m.push(mi);
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MODE_ID = { world: 0, vert: 1, diag: 2 };

// axis-aligned box with optional top chamfer per side; bottom faces at floor level are skipped (never seen)
function addBox(acc, s, o) {
  const [x0, x1, z0, z1] = s.b, y0 = s.y0, y1 = s.y1, ch = s.ch || {};
  const c = Math.max(0, ch.px || 0, ch.nx || 0, ch.pz || 0, ch.nz || 0);
  const ym = y1 - c;
  const t = [x0 + (ch.nx || 0), x1 - (ch.px || 0), z0 + (ch.nz || 0), z1 - (ch.pz || 0)];
  const m = s.mat, mode = s.uv, tint = s.tint ?? 1;
  const q = (pts) => pushQuad(acc, m, mode, pts, tint, null, o);
  // lower sides (y0..ym)
  q([V(x0, y0, z1), V(x1, y0, z1), V(x1, ym, z1), V(x0, ym, z1)]); // +z
  q([V(x1, y0, z0), V(x0, y0, z0), V(x0, ym, z0), V(x1, ym, z0)]); // -z
  q([V(x1, y0, z1), V(x1, y0, z0), V(x1, ym, z0), V(x1, ym, z1)]); // +x
  q([V(x0, y0, z0), V(x0, y0, z1), V(x0, ym, z1), V(x0, ym, z0)]); // -x
  if (c > 0) { // upper band: sloped where chamfered, vertical elsewhere
    q([V(x0, ym, z1), V(x1, ym, z1), V(t[1], y1, t[3]), V(t[0], y1, t[3])]);
    q([V(x1, ym, z0), V(x0, ym, z0), V(t[0], y1, t[2]), V(t[1], y1, t[2])]);
    q([V(x1, ym, z1), V(x1, ym, z0), V(t[1], y1, t[2]), V(t[1], y1, t[3])]);
    q([V(x0, ym, z0), V(x0, ym, z1), V(t[0], y1, t[3]), V(t[0], y1, t[2])]);
  }
  q([V(t[0], y1, t[3]), V(t[1], y1, t[3]), V(t[1], y1, t[2]), V(t[0], y1, t[2])]); // top
  if (y0 > 0.001) q([V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)]); // bottom
}

// a prism on a wall face: poly in (s, y), extruded across c0..c1
function addPoly(acc, s, o) {
  const P = (sv, y, cv) => s.dir === 'h' ? V(sv, y, cv) : V(cv, y, sv);
  const pts = s.poly;
  const d = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]], L = Math.hypot(...d), dirVec = [d[0] / L, d[1] / L];
  const m = s.mat, tint = s.tint ?? 1;
  const quad = (a) => {
    // orient each quad outward: compare its normal with the vector from the prism centre
    const cen = V(0, 0, 0); a.forEach(p => cen.add(p)); cen.multiplyScalar(0.25);
    const mid = P((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2, (s.c0 + s.c1) / 2);
    const n = new THREE.Vector3().subVectors(a[1], a[0]).cross(new THREE.Vector3().subVectors(a[2], a[0]));
    if (n.dot(cen.sub(mid)) < 0) a.reverse();
    pushQuad(acc, m, 'diag', a, tint, dirVec, o);
  };
  quad(pts.map(([sv, y]) => P(sv, y, s.c1)));
  quad(pts.map(([sv, y]) => P(sv, y, s.c0)));
  for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4]; quad([P(a[0], a[1], s.c0), P(b[0], b[1], s.c0), P(b[0], b[1], s.c1), P(a[0], a[1], s.c1)]); }
}

function meshesFrom(acc, mats, extra = []) {
  const out = [];
  for (const [m, a] of Object.entries(acc)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(a.c, 3));
    g.userData.uvMode = a.m; // per-vertex UV rule (0 world, 1 vert, 2 diag), for the seam measurement only
    g.computeBoundingBox(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mats[m]); mesh.userData.kitMat = m; out.push(mesh);
  }
  return out.concat(extra);
}

function ringMesh(s, o, mats) {
  const g = new THREE.TorusGeometry(s.ring.r, s.ring.tube, 6, 14);
  if (s.ring.dir === 'v') g.rotateY(Math.PI / 2);
  g.translate(s.ring.c[0] - o[0], s.ring.c[1] - o[1], s.ring.c[2] - o[2]);
  const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  return new THREE.Mesh(g, mats[s.mat]);
}

function build(solids, o, mats) {
  const acc = {}, extra = [];
  for (const s of solids) {
    if (s.b) addBox(acc, s, o);
    else if (s.poly) addPoly(acc, s, o);
    else if (s.ring) extra.push(ringMesh(s, o, mats));
  }
  return meshesFrom(acc, mats, extra);
}

// item = plan item; returns a Group positioned at the item's origin (the caller's group sits at item.x, 0, item.z)
export async function buildKitVisual(item) {
  const mats = await kitMaterials();
  const root = new THREE.Group();
  const o = [item.x, 0, item.z];
  for (const m of build(item.solids, o, mats)) root.add(m);
  for (const [i, l] of item.leaves.entries()) {
    const pivot = new THREE.Group(); pivot.name = `leaf_hinge_${i}`;
    pivot.position.set(l.pivot[0] - o[0], l.pivot[1], l.pivot[2] - o[2]);
    for (const m of build(l.solids, l.pivot, mats)) pivot.add(m);
    pivot.userData.hinge = { mode: l.mode, pivot: l.pivot, axis: l.axis, openAngle: l.openAngle, duration: l.duration, ease: l.ease, openEase: l.openEase, rest: l.rest, what: l.what };
    if (l.rest === 'open') pivot.rotation.y = l.openAngle * Math.PI / 180;
    root.add(pivot);
  }
  root.userData.kit = item.key;
  return root;
}
