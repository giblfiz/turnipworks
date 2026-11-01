// THE AREA'S GROUND (Harry 2026-10-22: "Can we allow simple tiling for the whole outdoor world? Like if I just want to
// drag grass onto everything?"). One floor material over ALL the open ground of an area (core/commands.js area.ground;
// the area's `ground`). How it is drawn, and why so:
//   the ground plane   the world's own ground mesh (world.js rebuildGround: one 800 × 800-ft plane, less the holes over
//                      shown cellars and stairs) takes the material, with WORLD UVs (one texture repeat per 5-ft square,
//                      aligned to the grid): one mesh, one draw, whatever the map's size. Never one tile per square.
//   which picture      the material's calm base, laid straight, exactly the picture a room floor of that material lays
//                      on a square (look.floorSpecs: its structured choice). Mixed variants and turns show the 5-ft grid
//                      (wiki projects/3d-vtt/outdoors: 2–3 of 5 on Gemini's grid scale, against 0 for one calm base),
//                      so the ground never mixes them. A patterned floor made as an N × N-square layout (flagstones,
//                      checkers, delft: gIJ crops) is put together once into one N × N picture, so it continues as it
//                      does across a room.
//   no scatter         a yard's grass carries tufts and worn patches (look.js SCATTER); the open field does NOT. Tried
//                      2026-10-21 at 0, 35% and 100% of the yard's density, blind Gemini reads at play distance and
//                      zoomed out: bare base 4/5 natural, 0/5 stickers; 35% 3 and 2/5 natural, 3–4/5 "polka dots";
//                      full 2 and 1/5 natural, 4–5/5 "confetti". Over a whole field one calm base reads best.
//   no visible repeat  a low-feature picture (grass) repeated every 5 ft reads as one field (0/5 on Gemini's grid
//                      scale), but an ORGANIC one with features (packed earth's curved furrow, cobbles) repeated 1:1 reads
//                      as a tiled mat (5/5, 2026-10-21). Organic materials are drawn with the repetition broken up in the
//                      shader (two lookups at offsets that change smoothly over a few squares, a narrow blend where the
//                      brighter wins; the "texture repetition" technique, iquilezles.org): packed earth 0/5, cobble 0/5
//                      and 4/5 convincing, irregular flagstones 1/5 and 4/5, no ghosting (a wide cross-fade ghosted the
//                      stones: Gemini, same day). Still one draw. Structured
//                      ones (planks, bricks, checkers, tiles, flagstone layouts) keep their straight, grid-true repeat, as
//                      a room lays them (look.floorSpecs's own split).
//   under rooms        the plane lies under everything as before: room floors, yards and painted tiles still win.
//   round holes        a round hole or pit on open ground cuts its squares whole out of the plane (core/holes.js); the
//                      ground round the circle is put back here, square by square, in the ground's own material with the
//                      circle cut out (client/holes.js clipCircles), as a room's floor is put back round one (world.js).
// The bare ground (no `ground`) is the world's original material, untouched: today's look is the default.
import * as THREE from 'three';
import { T } from './tuner.js';
import * as HO from '../core/holes.js';
import * as FP from '../core/footprint.js';
import * as HT from '../core/height.js';
import { clipCircles } from './holes.js';

const CELL = 5;

// what the ground lays for floor material `id`: { url } (one picture, repeated every square) or { grid: N, urls[gz][gx] }
export function groundPicture(lib, id) {
  const sc = T.look?.SCATTER?.[id], o = lib?.objects?.[sc?.base || id] || lib?.objects?.[id];
  const pool = (o?.skus || []).filter(k => k.kind === 'flat' && k.url); if (!pool.length) return null;
  const grid = new Map(pool.filter(k => /^g\d\d$/.test(k.shape || '')).map(k => [k.shape, k]));
  const N = Math.round(Math.sqrt(grid.size));
  if (N >= 2 && N * N === grid.size) return { grid: N, urls: [...Array(N)].map((_, gz) => [...Array(N)].map((_, gx) => grid.get(`g${gx}${gz}`).url)) };
  const exact = pool.filter(k => /^c\d/.test(k.shape || ''));
  const k = exact[0] || pool.find(s => !s.sku.includes('--v')) || pool[0];
  return { url: k.url, organic: !exact.length && !STRUCTURED.test(id) };
}
// (look.floorSpecs: these lay one seamless picture straight in a room; the rest are organic)
const STRUCTURED = /plank|board|parquet|brick|checker|flagstone-square|terracotta|floor-tile|furrow|mosaic|marble|tomb-slabs|grate/;

// THE REPEAT BROKEN UP (organic materials): the map is looked up twice, at two offsets picked by a smooth noise over the
// squares, and the two are blended where they agree (textureGrad: the mip level of the true UV, so no seam lines)
const GC_NOISE = `
float gcHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gcNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gcHash(i), gcHash(i + vec2(1.0, 0.0)), f.x), mix(gcHash(i + vec2(0.0, 1.0)), gcHash(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const GC_MAP = `
#ifdef USE_MAP
  vec2 gcUv = vMapUv, gcDx = dFdx(gcUv), gcDy = dFdy(gcUv);
  float gcL = gcNoise(gcUv * 0.43) * 8.0, gcF = fract(gcL), gcI = floor(gcL);
  vec2 gcA = sin(vec2(3.0, 7.0) * gcI), gcB = sin(vec2(3.0, 7.0) * (gcI + 1.0));
  vec4 gcCa = textureGrad(map, gcUv + gcA, gcDx, gcDy), gcCb = textureGrad(map, gcUv + gcB, gcDx, gcDy);
  vec4 sampledDiffuseColor = mix(gcCa, gcCb, smoothstep(0.45, 0.55, gcF - 0.35 * dot(gcCa.rgb - gcCb.rgb, vec3(1.0)))); // (a narrow blend that follows the picture: the brighter one wins, so stones do not ghost)
  diffuseColor *= sampledDiffuseColor;
#endif`;
class OrganicGround extends THREE.MeshStandardMaterial {
  onBeforeCompile(sh) { sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>${GC_NOISE}`).replace('#include <map_fragment>', GC_MAP); }
  customProgramCacheKey() { return 'tw-ground-organic'; }
}

// N × N crops put together into one picture (row gz from the top; the other way up for a bitmap made upside down)
async function composeGrid(look, pic) {
  const N = pic.grid, texs = await Promise.all(pic.urls.flat().map(u => look.loadTex(u)));
  const res = Math.min(512, texs[0].image?.width || 512), cv = document.createElement('canvas');
  cv.width = cv.height = res * N; const g = cv.getContext('2d');
  const flipped = texs[0].flipY === false; // (an ImageBitmap made upside down for the GPU: js/tex.js)
  for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) g.drawImage(texs[gz * N + gx].image, gx * res, (flipped ? N - 1 - gz : gz) * res, res, res);
  const t = new THREE.CanvasTexture(cv); t.flipY = !flipped; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createGroundCover(world) {
  const bare = world.ground.material;
  let cat = null, want = null, mat = null, gen = 0;
  async function build(id) {
    const L = world.assets?.look, pic = groundPicture(world.assets?.lib, id); if (!L || !pic) return null;
    let map;
    if (pic.grid) { map = await composeGrid(L, pic); map.repeat.set(1 / pic.grid, 1 / pic.grid); }
    else map = (await L.loadTex(pic.url)).clone(); // (a texture of its own: the shared one keeps its clamp for the tiles)
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 16; map.needsUpdate = true;
    const m = new (pic.organic ? OrganicGround : THREE.MeshStandardMaterial)({ map, roughness: 0.95 }); m.userData.groundCover = id; m.userData.organic = !!pic.organic; // (a floor tile's roughness)
    return { mat: m, pic };
  }
  const drop = (m) => { if (m) { m.map?.dispose(); m.dispose(); } };
  // THE GROUND ROUND A ROUND HOLE on open ground: each square it cut, in the ground's material, the circle cut out
  let patches = null, patchKey = '';
  function layPatches(force = false) {
    const E = world.view?.entities || {}, rounds = HO.roundHolesAt(E, 0);
    const key = rounds.map(c => `${c.x},${c.z},${c.r}`).join(';') + `|${world.groundKey}|${world.groundOpen ? 1 : 0}`;
    if (!force && key === patchKey) return; patchKey = key;
    if (patches) { world.scene.remove(patches); patches.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); patches = null; }
    if (!rounds.length) return;
    const skip = new Set(); // a ground-floor room puts its own floor back round the circle; a shown cellar keeps its opening
    for (const e of Object.values(E)) if (e.kind === 'room' && e.recipe) { const y = HT.roomY(e.recipe); if (y === 0 || (y < 0 && world.groundOpen)) for (const [i, j] of FP.cellsOf(e.recipe)) skip.add(`${e.recipe.x + i}:${e.recipe.z + j}`); }
    const byCell = new Map();
    for (const c of rounds) for (const [gx, gz] of c.cells) { const k = `${gx}:${gz}`; if (!skip.has(k)) (byCell.get(k) || byCell.set(k, []).get(k)).push(c); }
    if (!byCell.size) return;
    patches = new THREE.Group(); patches.name = 'groundHolePatches';
    const base = world.ground.material, gy = world.ground.position.y;
    for (const [k, cs] of byCell) {
      const [gx, gz] = k.split(':').map(Number), x0 = gx * CELL, z0 = gz * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      const g = new THREE.BufferGeometry(); // (in world feet, with the plane's own world UVs, so it meets the ground without a seam)
      g.setAttribute('position', new THREE.Float32BufferAttribute([x0, gy, z0, x0, gy, z1, x1, gy, z1, x0, gy, z0, x1, gy, z1, x1, gy, z0], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([x0 / CELL, -z0 / CELL, x0 / CELL, -z1 / CELL, x1 / CELL, -z1 / CELL, x0 / CELL, -z0 / CELL, x1 / CELL, -z1 / CELL, x1 / CELL, -z0 / CELL], 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, base); m.receiveShadow = true; m.userData.noPick = true; m.userData.ground = true;
      clipCircles(m, cs.map(c => ({ x: c.x, z: c.z, r: c.r })));
      if (base instanceof OrganicGround) { const hole = m.material.onBeforeCompile; m.material.onBeforeCompile = (sh) => { OrganicGround.prototype.onBeforeCompile.call(m.material, sh); hole(sh); }; m.material.customProgramCacheKey = () => 'tw-ground-organic-holeclip'; }
      patches.add(m);
    }
    world.scene.add(patches);
  }
  const G = {
    // the area's ground is `id` (a floor material id), or null: the bare ground
    set(id) {
      id = id || null; if (id === want) return G.ready; want = id;
      const my = ++gen;
      G.ready = (async () => {
        const built = id ? await build(id).catch((err) => { console.warn('ground cover:', id, err?.message || err); return null; }) : null;
        if (my !== gen) { drop(built?.mat); return; } // (another choice came in meanwhile)
        drop(mat); mat = built?.mat || null; cat = built ? id : null; G.picture = built?.pic || null;
        world.ground.material = mat || bare; layPatches(true);
      })();
      return G.ready;
    },
    refresh: () => layPatches(), // (the ground was cut again: world.js rebuildGround)
    patches: () => patches ? patches.children.length : 0,
    patchGroup: () => patches, // (world.js groundSeePass: the patches fade with the ground below the ground)
    cat: () => cat,
    info: () => ({ cat, want, organic: !!mat?.userData.organic, material: world.ground.material === bare ? 'bare' : world.ground.material.userData.groundCover }),
    ready: Promise.resolve(), picture: null,
  };
  return G;
}
