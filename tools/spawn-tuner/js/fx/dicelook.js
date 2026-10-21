// DICE LOOK (2026-10-19): what a die looks like. Style D, heroic hand-painted (PHOENIX.md 2026-09-30): chunky,
// saturated, painted light and worn edges, crisp numbers, never plastic.
//
// THE SHAPE (Harry: "a d6 should not be 12 faces, more like 100"). Every die is its polyhedron pulled in by the
// rounding radius r and grown back out by a ball of radius r (the same rounded hull the physics collides with,
// dicephys.colliderPoints). Built per corner: round each corner, the spherical patch between the faces that meet there
// is cut into `segments`-deep triangles, and the hull of all of those points gives flat faces, evenly rounded edges and
// rounded corners. A d6 at segments 2 is 156 triangles. Normals: flat on the faces, the ball's own on the roundings.
//
// THE PAINT. Vertex colour does the painting (a soft pillow of light on each face, darker toward its edges, the edges
// themselves worn to a lighter colour by `edgeWear`), multiplied by a small brush-stroke texture; roughness high.
// THE NUMBERS are decals on the flat faces, one atlas per die type and number colour. The numbering never changes:
// dicegeo.remap turns the whole visual die by a symmetry instead.
//
//   dieMesh(type, look) -> THREE.Group { body, decals }   (cached geometry; materials shared by colour)
//   look: { size, round, segments, color '#rrggbb', numberColor, edgeWear 0..1, paint 'heroic' | 'flat' | 'gilded' }
import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { dieGeo, labelOf } from './dicegeo.js';

const geoCache = new Map(), matCache = new Map(), atlasCache = new Map();
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// the rounded hull in die units (size 1): points + the ball direction each one came from
export function roundedHull(type, round, segments) {
  const g = dieGeo(type), r = round * g.inR, k = (g.inR - r) / g.inR, seg = Math.max(1, Math.round(segments));
  const pts = [], dirs = new Map(), keys = new Set();
  const add = (v, d) => {
    const p = V(v).multiplyScalar(k).addScaledVector(d, r), key = `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
    if (keys.has(key)) return; keys.add(key); pts.push(p); dirs.set(p, d.clone());
  };
  g.verts.forEach((v, i) => {
    // the faces round this corner, in order round it (each pair of neighbours shares an edge through the corner)
    const fs = g.faces.filter(f => f.v.includes(i));
    const c = fs.reduce((a, f) => a.add(V(f.n)), new THREE.Vector3()).normalize();
    const ring = []; let cur = fs[0];
    while (ring.length < fs.length) { ring.push(cur); const j = cur.v.indexOf(i), next = cur.v[(j + cur.v.length - 1) % cur.v.length]; cur = fs.find(f => f !== cur && f.v.includes(i) && f.v.includes(next)) || fs.find(f => !ring.includes(f)); if (!cur) break; }
    for (let m = 0; m < ring.length; m++) {
      const A = V(ring[m].n), B = V(ring[(m + 1) % ring.length].n);
      for (let a = 0; a <= seg; a++) for (let b = 0; b <= seg - a; b++) { // barycentric grid on the spherical triangle (c, A, B)
        const wc = (seg - a - b) / seg, wa = a / seg, wb = b / seg;
        add(v, new THREE.Vector3().addScaledVector(c, wc).addScaledVector(A, wa).addScaledVector(B, wb).normalize());
      }
    }
  });
  return { pts, dirs, g, r, k };
}

function buildGeometry(type, round, segments) {
  const key = `${type}|${round.toFixed(3)}|${segments}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const { pts, dirs, g } = roundedHull(type, round, segments);
  const hull = new ConvexHull().setFromPoints(pts);
  const pos = [], nor = [], uv = [], wear = [], face = [];
  const FN = g.faces.map(f => V(f.n));
  // a per-face basis for the brush texture's coordinates
  const basis = g.faces.map(f => { const n = V(f.n), a = new THREE.Vector3().subVectors(V(g.verts[f.v[0]]), V(f.c)).normalize(); return [a, new THREE.Vector3().crossVectors(n, a)]; });
  const tn = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (const hf of hull.faces) {
    const tri = []; let e = hf.edge; do { tri.push(e.head().point); e = e.next; } while (e !== hf.edge);
    for (let i = 1; i + 1 < tri.length; i++) {
      const T = [tri[0], tri[i], tri[i + 1]];
      tn.crossVectors(e1.subVectors(T[1], T[0]), e2.subVectors(T[2], T[0])).normalize();
      let home = 0, hd = -2; FN.forEach((n, j) => { const d = n.dot(tn); if (d > hd) { hd = d; home = j; } });
      const flat = hd > 0.9999;
      for (const p of T) {
        pos.push(p.x, p.y, p.z);
        const d = flat ? FN[home] : dirs.get(p) || tn; nor.push(d.x, d.y, d.z);
        const [a, b] = basis[home]; uv.push(p.dot(a) * 1.6 + home * 0.37, p.dot(b) * 1.6 + home * 0.61);
        // how far round the edge this point is (0 on a face, 1 at the crest of an edge or corner)
        wear.push(flat ? 0 : Math.min(1, (1 - (dirs.get(p) || tn).dot(FN[home])) * 3.2));
        face.push(home);
      }
    }
  }
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  G.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  G.userData = { wear: new Float32Array(wear), face: new Uint8Array(face), tris: pos.length / 9 };
  G.computeBoundingSphere();
  geoCache.set(key, G);
  return G;
}

// THE PAINT: vertex colours from the body colour (cached per geometry + colour + paint)
const hsl = (hex) => { const c = new THREE.Color(hex); const o = {}; c.getHSL(o); return o; };
function paintColors(G, type, look) {
  const key = `${look.color}|${look.paint}|${look.edgeWear.toFixed(2)}`;
  G.userData.paint = G.userData.paint || new Map();
  if (G.userData.paint.has(key)) return G.userData.paint.get(key);
  const { wear, face } = G.userData, n = wear.length, out = new Float32Array(n * 3), pos = G.attributes.position.array;
  const g = dieGeo(type), base = hsl(look.color);
  // hand-painted: a richer, slightly deeper body; a warm lit tone on face centres; a cool shadow tone toward edges
  const body = new THREE.Color().setHSL(base.h, Math.min(1, base.s * 1.08 + 0.05), Math.max(0.12, Math.min(0.62, base.l * 0.92)));
  const lit = new THREE.Color().setHSL((base.h + 0.015) % 1, Math.min(1, base.s * 0.95 + 0.05), Math.min(0.82, body.getHSL({}).l + 0.16));
  const shade = new THREE.Color().setHSL((base.h + 0.97) % 1, Math.min(1, base.s + 0.1), Math.max(0.05, body.getHSL({}).l * 0.62));
  const worn = look.paint === 'gilded' ? new THREE.Color('#e8c46a') : new THREE.Color().setHSL(base.h, base.s * 0.35, Math.min(0.9, body.getHSL({}).l + 0.34));
  const c = new THREE.Color(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const f = g.faces[face[i]];
    p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    if (look.paint === 'flat') { c.copy(body); }
    else {
      // distance from the face's middle, as a fraction of how far its corners are
      const fc = V(f.c), fr = V(g.verts[f.v[0]]).distanceTo(fc), along = p.clone().sub(V(f.n).multiplyScalar(p.dot(V(f.n)))).sub(fc.clone().sub(V(f.n).multiplyScalar(fc.dot(V(f.n))))).length() / fr;
      c.copy(lit).lerp(body, Math.min(1, along * 1.25)).lerp(shade, Math.max(0, along - 0.55) * 0.9);
    }
    const w = wear[i] * look.edgeWear; if (w > 0) c.lerp(worn, Math.min(1, w * (look.paint === 'flat' ? 0.6 : 0.95)));
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  G.userData.paint.set(key, out);
  return out;
}

// a soft brush-stroke texture (shared): the paint's grain, never a pattern you can see
let brushTex = null;
function brush() {
  if (brushTex) return brushTex;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  x.fillStyle = '#e9e9e9'; x.fillRect(0, 0, S, S);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 520; i++) { const a = r() * Math.PI, l = 14 + r() * 40, px = r() * S, py = r() * S, v = 200 + r() * 55 | 0;
    x.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.35})`; x.lineWidth = 2 + r() * 6; x.lineCap = 'round';
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, py + oy + Math.sin(a) * l * 0.5, px + ox + Math.cos(a) * l, py + oy + Math.sin(a) * l); x.stroke(); } }
  brushTex = new THREE.CanvasTexture(cv); brushTex.wrapS = brushTex.wrapT = THREE.RepeatWrapping; brushTex.colorSpace = THREE.SRGBColorSpace; brushTex.anisotropy = 4;
  return brushTex;
}

// THE NUMBERS: an atlas per die type + number colour: one cell per face
const CELL = 128;
function atlas(type, look) {
  const key = `${type}|${look.numberColor}|${look.paint}`;
  if (atlasCache.has(key)) return atlasCache.get(key);
  const g = dieGeo(type), n = g.faces.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  const cv = document.createElement('canvas'); cv.width = cols * CELL; cv.height = rows * CELL; const x = cv.getContext('2d');
  const ink = look.numberColor, dark = 'rgba(20,14,8,0.92)';
  const glyph = (text, cx, cy, size, rot = 0, mark = false) => {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.font = `900 ${size}px "Cinzel", "Trajan Pro", Georgia, "DejaVu Serif", "Times New Roman", serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = size * 0.16; x.strokeStyle = dark; x.strokeText(text, 0, size * 0.04);
    x.fillStyle = ink; x.fillText(text, 0, size * 0.04);
    x.globalAlpha = 0.35; x.fillStyle = '#ffffff'; x.fillText(text, -size * 0.025, size * 0.01); x.globalAlpha = 1; // a painted highlight on the top-left of each stroke
    x.fillStyle = ink; x.fillText(text, 0, size * 0.04 + size * 0.012);
    if (mark) { x.lineWidth = size * 0.08; x.strokeStyle = dark; x.beginPath(); x.moveTo(-size * 0.22, size * 0.5); x.lineTo(size * 0.22, size * 0.5); x.stroke(); x.lineWidth = size * 0.045; x.strokeStyle = ink; x.stroke(); }
    x.restore();
  };
  const cells = [];
  g.faces.forEach((f, i) => {
    const cx = (i % cols) * CELL + CELL / 2, cy = Math.floor(i / cols) * CELL + CELL / 2;
    cells.push([(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows, 1 / cols, 1 / rows]);
    if (g.reads === 'vertex') { // a d4 face: the number of each corner, near it, pointing at it
      const c = V(f.c), up = V(f.up), right = new THREE.Vector3().crossVectors(up, V(f.n));
      for (const vi of f.v) { const d = V(g.verts[vi]).sub(c), u = d.dot(up), r = d.dot(right), l = Math.hypot(u, r);
        const ax = r / l, ay = -u / l; glyph(labelOf(g, vi), cx + ax * CELL * 0.27, cy + ay * CELL * 0.27, CELL * 0.27, Math.atan2(ax, -ay)); }
      return;
    }
    const t = labelOf(g, i), long = t.length > 1;
    const size = CELL * (type === 'd10t' ? 0.42 : long ? 0.5 : 0.62) * (g.faces.length >= 12 ? 0.92 : 1);
    glyph(t, cx, cy, size, 0, (t === '6' || t === '9') && g.sides > 8);
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const out = { tex, cells };
  atlasCache.set(key, out);
  return out;
}

// the decal quads: one per face, on the flat part of it, its "up" the label's up (dicegeo face.up)
function decalGeometry(type, look) {
  const key = `${type}|decal|${look.round.toFixed(3)}|${look.numberColor}|${look.paint}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const g = dieGeo(type), { cells } = atlas(type, look), r = look.round * g.inR, k = (g.inR - r) / g.inR;
  const pos = [], uv = [], nor = [];
  g.faces.forEach((f, i) => {
    const n = V(f.n), up = V(f.up), right = new THREE.Vector3().crossVectors(up, n);
    const c = V(f.c).multiplyScalar(k).addScaledVector(n, r + 0.004); // on the face, a hair above it
    // the face's inscribed circle (flat part), so the number fits the face
    let inr = Infinity; for (let j = 0; j < f.v.length; j++) { const a = V(g.verts[f.v[j]]), b = V(g.verts[f.v[(j + 1) % f.v.length]]), m = a.clone().add(b).multiplyScalar(0.5); inr = Math.min(inr, m.distanceTo(V(f.c))); }
    const h = inr * k * (g.reads === 'vertex' ? 1.9 : type === 'd10' || type === 'd10t' ? 1.25 : 1.05);
    const [u0, v0, du, dv] = cells[i];
    const corner = (sx, sy) => c.clone().addScaledVector(right, sx * h).addScaledVector(up, sy * h);
    const P = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, -1), corner(1, 1), corner(-1, 1)];
    const UV = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    for (let j = 0; j < 6; j++) { pos.push(P[j].x, P[j].y, P[j].z); nor.push(n.x, n.y, n.z); uv.push(u0 + UV[j][0] * du, v0 + UV[j][1] * dv); }
  });
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); G.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geoCache.set(key, G);
  return G;
}

export function dieMesh(type, look) {
  const G = buildGeometry(type, look.round, look.segments);
  const colors = paintColors(G, type, look);
  const bkey = `${type}|${look.round}|${look.segments}|${look.color}|${look.paint}|${look.edgeWear}`;
  let body = matCache.get(bkey);
  if (!body) {
    const geo = G.clone(); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: look.paint === 'flat' ? null : brush(), roughness: look.paint === 'gilded' ? 0.55 : 0.78, metalness: 0.0 });
    body = { geo, mat }; matCache.set(bkey, body);
  }
  const A = atlas(type, look);
  const dkey = `decal|${type}|${look.numberColor}|${look.paint}`;
  let dmat = matCache.get(dkey);
  if (!dmat) { dmat = new THREE.MeshStandardMaterial({ map: A.tex, transparent: true, alphaTest: 0.08, roughness: look.paint === 'gilded' ? 0.4 : 0.7, metalness: look.paint === 'gilded' ? 0.35 : 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false }); matCache.set(dkey, dmat); }
  const group = new THREE.Group(); group.name = `die-${type}`;
  const bm = new THREE.Mesh(body.geo, body.mat), dm = new THREE.Mesh(decalGeometry(type, look), dmat);
  bm.castShadow = true; dm.renderOrder = 1;
  group.add(bm, dm); group.scale.setScalar(look.size);
  group.userData = { type, body: bm, decals: dm, tris: G.userData.tris + dieGeo(type).faces.length * 2 };
  return group;
}
export const dieTriangles = (type, round, segments) => buildGeometry(type, round, segments).userData.tris;
export function clearLookCache() { for (const v of matCache.values()) { if (v.geo) v.geo.dispose(); (v.mat || v).dispose?.(); } matCache.clear(); }
