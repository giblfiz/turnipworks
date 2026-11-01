// HILLS AND THEIR BANKS, DRAWN (2026-10-24; docs/VERTICAL.md "Terrain: computed banks"). core/terrain.js works the
// ground out from the hills (rooms of a terrain type); this draws it. What is drawn where:
//   a hill's TOP     its room floor, exactly as any outdoor room's (world.buildShell: one tile per 5-ft square of its
//                    ground material, grass by default), at its height. Nothing here covers it.
//   the BANK         one mesh per cluster of hills (core/terrain.js clustersOf): the field's samples, keeping only the
//                    triangles that rise above the floor they stand on (so a top, a lower terrace and the open ground
//                    stay what they are). It is painted by POSITION, from above, with the hill's own ground picture,
//                    one repeat per 5-ft square: the same texel grid as the top's tiles, so the join has nothing to
//                    seam (the banks demo: Gemini 10 of 10 on slope against lawn). Where the bank meets OPEN ground of
//                    the same organic material (the area's ground: groundcover.js) the picture's repeat is broken up
//                    the way the ground's is, fading in over the last feet, so the foot meets it without a seam either.
//                    Steep ground also lays the picture from the two sides (triplanar, from about 40 degrees); bare
//                    earth shows through on steep parts (Harry's "earth on steep parts", 0.8: from about 26 degrees);
//                    a rock face (a hill's `cliff`) wears the generated rock pictures.
//   ROOMS TRUMP IT   (2026-10-24, Harry: "The hill slope should not push thru walls ... a 'dug out' look") the field
//                    is cut down to a room's floor inside its outline (core/terrain.js cuttersOf), so the bank stops at
//                    the room's walls and its top is not drawn there (world.js buildShell); whichever came first
//   the DRESSING     the generated rock (experiments/2026-10-05-banks: rock-boulder, fal TRELLIS) and the library's
//                    bushes, scattered by seed on the banks (core/terrain.js dressingOf). Not things: never stored,
//                    never picked, they come and go with the bank.
//   SEE-THROUGH      (2026-10-27, Harry: "maybe what we really need is something more like transparent/translucent
//                    hills") at a view below the ground (lv -1 and down) the hills, banks and dressing are drawn whole
//                    but faded to the house setting (world.js hillSee; 0 = not drawn, 1 = solid): seeThrough below.
//                    A room below the ground never changes the hill's shape (core/height.js terrainTakers).
// The pictures and the rock are the banks demo's own generated assets, served from data/terrain/ (git-ignored binaries,
// like every mesh and picture; experiments/2026-10-24-hills/README.md says where they came from).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { terrainOf, terrainKey, dressingOf, BANKS } from '../core/terrain.js';
import * as FP from '../core/footprint.js';
import * as HT from '../core/height.js';
import { groundPicture } from './groundcover.js';

// SEE-THROUGH (2026-10-27): draw a visual faded to `op` (0..1; 1 = its own materials back). Each material is swapped for a
// transparent copy (depthWrite off, so what is under it still draws, and three.js draws it after the opaque scene); the
// copy is made once per material and shared, so a library bush's material is never changed for the bushes placed as
// things. A material this module owns (the bank's: `own`) is changed in place instead (its shader hook stays its own).
const SEE = new WeakMap();
function seeMat(m, op) {
  let c = SEE.get(m);
  if (!c) { const ud = m.userData; m.userData = {}; c = m.clone(); m.userData = ud; c.userData = ud; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; c.transparent = true; c.depthWrite = false; SEE.set(m, c); } // (userData kept out of the clone: it can hold textures, which clone() would serialize)
  c.opacity = (m.opacity ?? 1) * op; return c;
}
// one mesh (the ground plane, whose material the area's ground cover swaps: a new material is taken as its own again)
export function seeMesh(o, op) {
  if (o.userData.seeMat && o.material !== o.userData.seeMat) { delete o.userData.seeBase; delete o.userData.seeMat; }
  if (op >= 1) { if (o.userData.seeBase) { o.material = o.userData.seeBase; delete o.userData.seeBase; delete o.userData.seeMat; } return; }
  const base = o.userData.seeBase ||= o.material; o.material = o.userData.seeMat = seeMat(base, op);
}
export function seeThrough(v, op) {
  v?.traverse(o => {
    if (!o.isMesh) return;
    if (o.material?.userData?.terrainOwn) { const m = o.material, solid = op >= 1; if (m.transparent !== !solid) { m.transparent = !solid; m.depthWrite = solid; m.needsUpdate = true; } m.opacity = solid ? 1 : op; return; }
    if (op >= 1) { if (o.userData.seeBase) { o.material = o.userData.seeBase; delete o.userData.seeBase; } return; }
    const base = o.userData.seeBase ||= o.material;
    o.material = Array.isArray(base) ? base.map(m => seeMat(m, op)) : seeMat(base, op);
  });
}

const TERRAIN_URL = (f) => new URL(`./data/terrain/${f}`, import.meta.url).href;
export const TERRAIN_FILES = ['ground-earth-bank.webp', 'ground-rock.webp', 'ground-rock-face.webp', 'rock-boulder.glb'];
const BUSHES = ['bush', 'bush-berry'];
const BOULDER_FT = 5; // the boulder's largest side (its brief: about 5 ft wide x 4 deep x 3.5 tall)

const NOISE = `
float tnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tnNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tnHash(i), tnHash(i + vec2(1, 0)), f.x), mix(tnHash(i + vec2(0, 1)), tnHash(i + vec2(1, 1)), f.x), f.y); }
vec3 tnBroken(sampler2D m, vec2 uv) { // the ground's own repeat breaking (groundcover.js GC_MAP), so the foot meets it without a seam
  vec2 dx = dFdx(uv), dy = dFdy(uv); float L = tnNoise(uv * 0.43) * 8.0, F = fract(L), I = floor(L);
  vec2 A = sin(vec2(3.0, 7.0) * I), B = sin(vec2(3.0, 7.0) * (I + 1.0));
  vec4 ca = textureGrad(m, uv + A, dx, dy), cb = textureGrad(m, uv + B, dx, dy);
  return mix(ca, cb, smoothstep(0.45, 0.55, F - 0.35 * dot(ca.rgb - cb.rgb, vec3(1.0)))).rgb; }`;

// the bank's material: up to four ground pictures (a cluster of hills of different grounds), mixed per vertex by aMat
function bankMaterial(maps, tex, P, broken) {
  const m = new THREE.MeshStandardMaterial({ map: maps[0], roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
  const U = { uM1: { value: maps[1] || maps[0] }, uM2: { value: maps[2] || maps[0] }, uM3: { value: maps[3] || maps[0] }, uEarth: { value: tex.earth }, uRock: { value: tex.rock }, uRockFace: { value: tex.face },
    uEarthAmt: { value: P.earth }, uBroken: { value: new THREE.Vector4(...[0, 1, 2, 3].map(i => broken[i] ? 1 : 0)) } };
  m.userData.terrain = U; m.userData.terrainOwn = true; // (one per bank mesh: seeThrough fades it in place)
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRock; attribute float aRise; attribute float aFoot; attribute vec4 aMat; varying vec3 vTP; varying vec3 vTN; varying float vRock; varying float vRise; varying float vFoot; varying vec4 vMat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = position; vTN = normal; vRock = aRock; vRise = aRise; vFoot = aFoot; vMat = aMat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uM1, uM2, uM3, uEarth, uRock, uRockFace; uniform float uEarthAmt; uniform vec4 uBroken;
        varying vec3 vTP; varying vec3 vTN; varying float vRock; varying float vRise; varying float vFoot; varying vec4 vMat;${NOISE}
        vec3 tnTri(sampler2D s, vec3 w, float k) { return texture2D(s, vec2(vTP.x, -vTP.z) * k).rgb * w.y + texture2D(s, vTP.zy * k).rgb * w.x + texture2D(s, vTP.xy * k).rgb * w.z; }
        vec3 tnGround(sampler2D s, vec3 w, float brk) { // from above: straight (as the top's tiles lay it) or, near open ground of the same material, broken (as the ground lays it)
          vec2 uv = vec2(vTP.x, -vTP.z) * 0.2; vec3 top = texture2D(s, uv).rgb;
          if (brk > 0.001) top = mix(top, tnBroken(s, uv), brk);
          return top * w.y + texture2D(s, vTP.zy * 0.2).rgb * w.x + texture2D(s, vTP.xy * 0.2).rgb * w.z; }`)
      .replace('#include <map_fragment>', `
        vec3 wn = normalize(vTN);
        vec3 bw = pow(abs(wn), vec3(10.0)); bw /= (bw.x + bw.y + bw.z);
        float deg = degrees(acos(clamp(wn.y, -1.0, 1.0)));
        float patchy = (tnNoise(vTP.xz * 0.23) * 0.65 + tnNoise(vTP.xz * 0.9 + 7.0) * 0.35 - 0.5) * 2.0;
        float foot = vFoot * (1.0 - smoothstep(0.0, 3.0, vRise));
        vec4 mw = vMat / max(0.0001, vMat.x + vMat.y + vMat.z + vMat.w);
        vec3 col = tnGround(map, bw, foot * uBroken.x) * mw.x;
        if (mw.y > 0.001) col += tnGround(uM1, bw, foot * uBroken.y) * mw.y;
        if (mw.z > 0.001) col += tnGround(uM2, bw, foot * uBroken.z) * mw.z;
        if (mw.w > 0.001) col += tnGround(uM3, bw, foot * uBroken.w) * mw.w;
        // earth on steep parts: the setting lowers the angle at which the ground gives way (60 deg -> 18 deg), patchily
        float e0 = mix(60.0, 18.0, uEarthAmt);
        float we = step(0.001, uEarthAmt) * smoothstep(e0, e0 + 12.0, deg + patchy * 11.0);
        vec3 ea = tnTri(uEarth, bw, 0.2); ea = mix(ea, vec3(dot(ea, vec3(0.3, 0.6, 0.1))), 0.4) * vec3(0.78, 0.8, 0.8); // (the generated earth came out terracotta: pulled toward brown, as in the demo)
        col = mix(col, ea, we);
        // rock: the layered face picture on the two side projections (its layers run level), the slab picture from above
        float wr = smoothstep(0.3, 0.55, vRock) * smoothstep(36.0, 50.0, deg + patchy * 5.0);
        vec3 rk = texture2D(uRock, vec2(vTP.x, -vTP.z) * 0.2).rgb * bw.y + texture2D(uRockFace, vTP.zy * 0.2).rgb * bw.x + texture2D(uRockFace, vTP.xy * 0.2).rgb * bw.z;
        col = mix(col, rk, wr);
        diffuseColor.rgb *= col;`);
  };
  m.customProgramCacheKey = () => 'tw-terrain-bank';
  return m;
}

export function createTerrain(world) {
  const group = new THREE.Group(); group.name = 'terrain'; world.scene.add(group);
  let key = '', T = null, gen = 0, tex = null, boulder = null, stats = { fields: 0, triangles: 0, dressing: 0, ms: 0 }, lastHidden = [], fieldMs = 0, see = 1;
  const P = { ...BANKS };
  // (these are the engine's own files, not the tuner's library: loaded here, not through look.js, which reads tuner paths)
  const texLoader = new THREE.TextureLoader(), gltf = new GLTFLoader();
  const loadTex = async (f) => { const t = await texLoader.loadAsync(TERRAIN_URL(f)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  const textures = () => tex ||= Promise.all(['ground-earth-bank.webp', 'ground-rock.webp', 'ground-rock-face.webp'].map(loadTex)).then(([earth, rock, face]) => ({ earth, rock, face }));
  const groundMap = async (id) => {
    const pic = groundPicture(world.assets?.lib, id) || groundPicture(world.assets?.lib, 'floor-grass'); if (!pic) return null;
    const url = pic.url || pic.urls[0][0], t = (await world.assets.texture(url)).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; t.needsUpdate = true; t.userData.organic = !!pic.organic; return t;
  };
  // the generated boulder, sized and seated once: footprint centred, underside at 0, largest side BOULDER_FT
  const boulderTemplate = () => boulder ||= gltf.loadAsync(TERRAIN_URL('rock-boulder.glb')).then(g => {
    const s = g.scene, box = new THREE.Box3().setFromObject(s), c = box.getCenter(new THREE.Vector3()), z = box.getSize(new THREE.Vector3());
    s.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); Object.assign(o.material, { roughness: 0.95, metalness: 0 }); o.userData.noPick = true; } });
    const k = BOULDER_FT / Math.max(z.x, z.y, z.z), inner = new THREE.Group(); s.position.set(-c.x, -box.min.y, -c.z); inner.add(s); inner.scale.setScalar(k);
    return inner;
  });
  const bushVisual = async (pick) => {
    const cat = BUSHES[pick % BUSHES.length], o = world.assets?.lib?.objects?.[cat]; if (!o) return null;
    const sku = o.skus.filter(k => k.url)[Math.floor(pick / BUSHES.length) % Math.max(1, o.skus.filter(k => k.url).length)]?.sku;
    const Z = world.roomgen?.sizeOf?.(cat, sku); if (!Z?.url) return null;
    return world.assets.visualFor({ cat, sku: Z.sku, url: Z.url, s: Z.s, dims: Z.dims, yaw: Z.yaw || 0, place: Z.place || 'ground' });
  };
  function clear() { for (const c of [...group.children]) { group.remove(c); c.traverse(o => { if (o.isMesh && o.userData.terrainOwn) { o.geometry.dispose(); o.material.dispose?.(); } }); } }

  // a field's bank as one mesh (world feet): vertex heights, normals from the field, which picture, rock, rise
  function bankGeometry(F, matOf) {
    const { x0, z0, cs, nx: W, nz: H } = F.dom, N = W * H;
    const pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), rock = new Float32Array(N), rise = new Float32Array(N), foot = new Float32Array(N), mat = new Float32Array(N * 4);
    const hAt = (i, j) => F.h[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, h = F.h[k];
      pos[k * 3] = x0 + i * cs; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z0 + j * cs;
      const gx = (hAt(i + 1, j) - hAt(i - 1, j)) / (2 * cs), gz = (hAt(i, j + 1) - hAt(i, j - 1)) / (2 * cs), l = Math.hypot(gx, 1, gz);
      nor[k * 3] = -gx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -gz / l;
      rock[k] = F.rock[k]; rise[k] = h - F.cell[k]; foot[k] = F.cell[k] === 0 ? 1 : 0;
      mat[k * 4 + matOf(F.owner[k])] = 1;
    }
    // (2026-10-24) where a room cuts the ground (core/terrain.js), the quads between a cut sample and uncut ground are
    // drawn too: the earth's face, from the hill's top down to the room's floor, inside the wall's thickness (seen through
    // a door or over an open side). Quads wholly inside the room are not: its floor is its own.
    const idx = [], C = API.faces === false ? null : F.cut; /* (API.faces = false: no cut faces, for comparing) */ const up = (k) => rise[k] > 0.004, edge = C ? (q) => { let lo = Infinity, hi = -Infinity; for (const k of q) if (C[k]) lo = Math.min(lo, F.h[k]); else hi = Math.max(hi, F.h[k]); return hi > lo + 0.004; } : () => false; // (only where the uncut ground stands above the cut: never a flat quad on the floor)
    for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      if (!(up(a) || up(b) || up(c) || up(d) || edge([a, b, c, d]))) continue;
      if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aRock', new THREE.BufferAttribute(rock, 1)); g.setAttribute('aRise', new THREE.BufferAttribute(rise, 1)); g.setAttribute('aFoot', new THREE.BufferAttribute(foot, 1)); g.setAttribute('aMat', new THREE.BufferAttribute(mat, 4));
    g.setIndex(idx.length > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return { g, tris: idx.length / 3 };
  }

  function applySee() { group.visible = see > 0; if (see > 0) seeThrough(group, see); }
  const API = {
    group,
    // SEE-THROUGH (2026-10-27): 1 = solid, 0 = not drawn, between: faded (world.js hillSeePass, below the ground)
    see(op) { op = Math.max(0, Math.min(1, +op)); if (op === see) return; see = op; applySee(); world.mwStale = true; },
    seeNow: () => see,
    // the hills changed (or the area's ground did): work the ground out again and draw it
    faces: true,
    resync() { key = ''; return API.sync(world.view?.entities || {}, { ground: world.view?.ground || null, hidden: lastHidden }); }, // (tests: draw it again)
    // hidden: the rooms the view's cut hides, which take nothing from a hill (world.js syncTerrain, 2026-10-26)
    async sync(ents, { ground = null, hidden = [] } = {}) {
      lastHidden = hidden;
      const t0 = performance.now(), k = terrainKey(ents, P, hidden).key + '|' + (ground || ''); // (the key first: a room moved far from every hill changes nothing)
      if (k === key) return; key = k; T = terrainOf(ents, P, hidden); const my = ++gen;
      fieldMs = Math.round(performance.now() - t0); // (the field alone, before the pictures and the dressing: what a level change can cost)
      world.terrainField = T; // (core/height.js asks nothing of this: it is the drawn ground, for drops and the tests)
      if (!T.fields.length) { clear(); stats = { fields: 0, triangles: 0, dressing: 0, ms: 0 }; API.ready = Promise.resolve(); return; }
      const job = (async () => {
        const tx = await textures().catch((err) => { console.warn('terrain pictures:', err?.message || err); return null; });
        const out = new THREE.Group(); let tris = 0, nd = 0;
        // things that keep the dressing off: every room's floor that is not a hill (a yard, a building), and the
        // squares of every hill top (that is where pawns stand). Not a room below the ground (2026-10-27): a cellar or a
        // cave under a hill changes nothing of it, its rocks and bushes included
        const rooms = Object.values(ents).filter(e => e.kind === 'room' && e.recipe && !HT.isTerrain(e.recipe) && HT.roomY(e.recipe) >= 0);
        const keepOut = (x, z, r) => rooms.some(e => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].some(([dx, dz]) => FP.contains(e.recipe, x + dx, z + dz)));
        for (const F of T.fields) {
          const floors = [...new Set(F.hills.map(h => h.floor))].slice(0, 4), matOf = (o) => o < 0 ? 0 : Math.max(0, floors.indexOf(F.hills[o].floor));
          const maps = await Promise.all(floors.map(groundMap)); if (my !== gen) return;
          const { g, tris: n } = bankGeometry(F, matOf); tris += n;
          if (!tx || !maps[0]) continue;
          const mesh = new THREE.Mesh(g, bankMaterial(maps, tx, P, floors.map((f, i) => f === ground && maps[i]?.userData.organic)));
          mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.noPick = true; mesh.userData.terrainOwn = true; mesh.userData.terrainBank = true; mesh.frustumCulled = true;
          out.add(mesh);
          // the dressing, seeded by the field (the same hills give the same rocks, on every seat)
          const D = dressingOf(F, P, { seed: 1 + Math.round(F.dom.x0 * 7 + F.dom.z0 * 13), keepOut });
          for (const o of D) {
            const v = o.id === 'rock-boulder' ? await boulderTemplate().then(t => t.clone(true)).catch(() => null) : await bushVisual(o.pick || 0).catch(() => null);
            if (my !== gen) return; if (!v) continue;
            const w = new THREE.Group(); w.add(v); w.position.set(o.x, o.y, o.z); w.rotation.y = o.yaw; w.scale.set(...o.scale);
            w.userData.terrainDress = o.id; w.traverse(m => { if (m.isMesh) m.userData.noPick = true; }); out.add(w); nd++;
          }
        }
        if (my !== gen) return;
        clear(); group.add(out); out.updateMatrixWorld(true); world.mwStale = true; applySee();
        stats = { fields: T.fields.length, triangles: tris, dressing: nd, ms: Math.round(performance.now() - t0), fieldMs };
      })();
      API.ready = job.catch((err) => console.warn('terrain:', err?.message || err));
      return API.ready;
    },
    ready: Promise.resolve(),
    heightAt: (x, z) => T ? T.heightAt(x, z) : 0,
    info: () => ({ ...stats, hills: T?.hills.length || 0, settings: { ...P }, banks: group.children[0]?.children.filter(c => c.userData.terrainBank).length || 0,
      rocks: group.children[0]?.children.filter(c => c.userData.terrainDress === 'rock-boulder').length || 0, bushes: group.children[0]?.children.filter(c => c.userData.terrainDress === 'bush').length || 0 }),
    dispose() { clear(); world.scene.remove(group); },
  };
  return API;
}
