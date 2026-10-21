// The look, shared: the Spawn Tuner (main.js) and the game engine (engine/client) both import THIS module, so the game
// never drifts from what Harry tunes. Moved out of main.js 2026-10-02 (Harry: "bring back (and KEEP UP TO DATE) the
// aesthetic quality from the tuner"). Nothing here touches the DOM; the tuner passes its dial values in, the engine
// passes the defaults (LOOK_DIALS = the tuner's own defaults).
//   orientation   mergeOrient(): data/orient.json < browser corrections < server corrections, keyed by MESH
//   assets        GLB / texture / LOD-ladder loading, makeVisual() (mesh, flat, cube; hung things get a chain)
//   walls         kitSpec(), edgeSpecs() (wall pieces, doors that fill their opening), cornerSpec() (posts, pillars)
//   floors        floorFor(), floorSpecs() (continuous / shuffle / exact-grid tiling + scatter decals)
//   openables     spec.hinge / spec.swap (js/hinge.js records from the Alignment Bench) rig the mesh in makeVisual()
import * as THREE from 'three';
import { gltfLoader } from './gltf.js';
import { loadTexture } from './tex.js';
export { loadTexture, textureStats } from './tex.js';
import { skuUsable, kitScale, mulberry32, CEIL } from './solver.js';
import { CELL, hash, edgeTransform, meshFamily, FAMILY_FALLBACK } from './walls.js';
import { rigHinge, swapPlacement } from './hinge.js';
import { deliver } from './delivery.js';
import { FIT_NONE, fitIsIdentity, applyFit } from './wallfit.js';
const WALL_IN = 108; // a generated wall: 9 ft = the opening of a door, the height of a corner or jamb post (the wall bench measures both against it)
export { setDelivery, loadDelivery, deliver, deliveryOn } from './delivery.js';

// the tuner's dial defaults (index.html selects these); the engine renders at exactly these
export const LOOK_DIALS = { faces: '10000', tex: 'baked', scope: 'all', floorMode: 'continuous', minStars: 3, hideMasking: true };

export { meshAtFn, orientFromServer } from './orient.js';

// Scatter floors (Harry 2026-10-01: "the stable floor has a really nasty looping-pattern feel ... 5+ scatters in random
// order and random rotation"): a low-feature earth base laid with rotation + variants, plus seeded decals (hay, dirt) at
// random position/turn/size, overlapping. Densities are decals per sq ft. The decals belong to the floor layer.
export const SCATTER = {
  'floor-earth-straw': { base: 'floor-earth-bare', decals: [['rug-hay-scatter', 1 / 13], ['decal-dirt-patch', 1 / 150]] },
  'floor-earth-bare': { decals: [['decal-dirt-patch', 1 / 80], ['rug-hay-scatter', 1 / 110]] },
  'floor-earth-packed': { decals: [['decal-dirt-patch', 1 / 110]] },
  // the yard's grass (2026-10-05): one calm base laid straight (its variants show the 5-ft grid when mixed), with tufts of
  // longer grass and a few patches worn to earth scattered over it, so a lawn is not one flat green
  // (worn patches kept rare: at 1 per 240 sq ft they read as stickers from the game's camera, Gemini 2026-10-05)
  'floor-grass': { decals: [['decal-grass-tuft', 1 / 40], ['decal-grass-worn', 1 / 450]] },
};

export const PLACE_COLORS = { floor: '#c9a46a', wall: '#6fa8dc', surface: '#e8d46a', ceiling: '#c58be0', kit: '#9a9a8a', ground: '#8fb35a', attach: '#6fd0c0', tile: '#6b5a44', door: '#d9654f', window: '#7fc3e8' };

// FACES BY SIZE (a TRIAL, 2026-10-12, docs/ASSET_DELIVERY.md "Right-sized face tiers"): the faces dial 'fit' gives each prop
// the ladder rung its real size earns, instead of 10,000 for an acorn and a four-poster alike. From the pixels props
// cover at the table view (experiments/2026-10-11-asset-cost density.py: small things a median 32 to 64 pixels, ordinary
// furniture 440 to 2,000, the big pieces 3,000 and up):
//   small things (the library's lod 'small', or a 'tiny' footprint: tableware, food, candles, wall hooks)   1,500
//   the big pieces (a footprint of four squares or more: beds, hearths, trees, wagons)                     10,000
//   everything else (furniture, doors, wall pieces)                                                         5,000
// Not the default: the game draws 10,000 for everything unless asked (?faces=fit).
export const FIT_BIG = new Set(['2x2', '1x3', '2x3', '3x3', '2x4', '3x4', '4x4']);
export function fitFaces(obj, rec) { return rec?.lod === 'small' || obj?.fp === 'tiny' ? 1500 : FIT_BIG.has(obj?.fp) ? 10000 : 5000; }

// WALL FIT CORRECTIONS (the Wall fit bench, 2026-10-13): Harry's per-sku fix for a kit piece that looks right alone and
// wrong in a wall. wallfit = { sku: { s: [fx, fy, fz], o: [x, y, z] (feet), yaw (degrees) } }, read LIVE (the game: the house
// look `wallfit`; the bench mutates it as Harry drags). s multiplies the catalog-fitted scale per axis (about the piece's
// foot and centre), o moves it in the piece's own frame (x along the wall, y up, z across, +z = the owner's room side), yaw
// turns it about its centre after the scale. No entry, or an all-identity one, changes nothing: every layout and golden is
// untouched until a correction is applied.
export { FIT_NONE, fitIsIdentity, applyFit };

// base: URL prefix for assets/ (the tuner: '', the engine: the deployed tuner's URL)
// dials(): { faces, tex, scope, floorMode }   solverOpts(): the ratings / masking filter the solver uses
// orient: the merged orientation object (the tuner mutates it when Harry turns a mesh; we read it live)
export function createLook({ lib, types, orient, wallfit = {}, base = '', dials = () => LOOK_DIALS, solverOpts = () => ({}), shadows = () => false, kitVisual = null }) {
  const typeByKey = Object.fromEntries(types.map(t => [t.key, t]));
  const skuRec = new Map(Object.values(lib.objects).flatMap(o => o.skus.map(s => [s.sku, s])));
  const meshOf = (sku) => skuRec.get(sku)?.mesh ?? null;
  // what is fetched for a logical asset address: its delivered copy (js/delivery.js: a name that changes with the bytes,
  // cached for good), else the address itself. A delivered copy that fails is asked for again at the logical address.
  const fetched = (u, load) => new Promise((res, rej) => { const d = deliver(u); load(base + d, res, d === u ? rej : () => load(base + u, res, rej)); });

  // ---------------------------------------------------------------- assets
  const loader = gltfLoader(); // (meshopt decoding in workers: js/gltf.js)
  const glbCache = new Map(); const texCache = new Map(); const texBytes = new Map();
  function loadGLB(url) {
    if (!glbCache.has(url)) glbCache.set(url, fetched(url, (u, ok, no) => loader.load(u, ok, undefined, no)).then(g => {
      let bytes = 0;
      g.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = shadows(); const m = o.material.map; if (m?.image) bytes += m.image.width * m.image.height * 4 * 1.33; } });
      texBytes.set(url, bytes);
      return g.scene;
    }));
    return glbCache.get(url);
  }
  // (pictures are decoded off the main thread: js/tex.js)
  const fetchTex = (url, flipY) => fetched(url, (u, ok, no) => loadTexture(u, { flipY }).then(ok, no));
  function loadTex(url) {
    if (!texCache.has(url)) texCache.set(url, fetchTex(url, true).then(t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texBytes.set(url, t.image.width * t.image.height * 4 * 1.33); return t;
    }));
    return texCache.get(url);
  }
  const ladderTex = new Map(), ladderMats = new Map();
  function loadLadderTex(url) {
    if (!ladderTex.has(url)) ladderTex.set(url, fetchTex(url, false).then(t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }));
    return ladderTex.get(url);
  }
  // faces & skins dials: which geometry level and texture size this spec renders at, or null for the baked shipping GLB
  function ladderFor(spec) {
    const { faces: F, tex: T, scope } = dials();
    if ((F === 'baked' && T === 'baked') || spec.kind !== 'mesh' || !spec.sku) return null;
    if (scope === 'props' && ['walls', 'openings'].includes(spec.layer)) return null;
    const rec = lib.objects[spec.id]?.skus.find(k => k.sku === spec.sku);
    const small = rec?.lod === 'small';
    return { f: F === 'baked' ? (small ? 3000 : 5000) : F === 'fit' ? fitFaces(lib.objects[spec.id], rec) : F, t: T === 'baked' ? (rec?.tex || 256) : +T };
  }
  // the yaw a spec's mesh renders at now: a known orientation for its sku, else what the solver chose (heuristic)
  function meshYawDeg(spec) { const m = meshOf(spec.sku); return m && orient[m] != null ? +orient[m] : (spec.yaw || 0) * 180 / Math.PI; }
  // a sku whose mesh was REPLACED under the same name carries `rev` (build_data.py): its colour map's URL changes with the
  // mesh, because the .webp ladder is cached for four hours (edge and browser) while the .glb is not: without this the new
  // geometry wears the old skin (2026-10-06, the cat tree; Gemini read it as "camouflage")
  const ladderUrls = (spec, L) => { const r = skuRec.get(spec.sku)?.rev; return [`assets/lod/f${L.f}/${spec.sku}.glb`, `assets/tex/t${L.t}/${spec.sku}.webp${r ? '?r=' + r : ''}`]; };
  // every URL a spec needs at the current faces & skins dials (shipping GLB, or ladder geometry + texture)
  function assetUrls(spec) {
    if (!spec.url) return [];
    const L = ladderFor(spec);
    return L ? ladderUrls(spec, L) : [spec.url];
  }
  const isCached = (u) => glbCache.has(u) || texCache.has(u) || ladderTex.has(u);
  const loadAny = (u) => u.endsWith('.glb') ? loadGLB(u) : u.startsWith('assets/tex/') ? loadLadderTex(u) : loadTex(u);
  const ladderSize = new WeakMap(); // loaded ladder scene -> its own bounds (the ladder pass cut kit slabs before decimating,
                                    // so its bounds differ from the shipping GLB's by up to ~48% in wall depth)
  async function ladderVisual(spec, L) {
    const [gurl, turl] = ladderUrls(spec, L);
    const geo = await loadGLB(gurl);
    if (!ladderSize.has(geo)) ladderSize.set(geo, new THREE.Box3().setFromObject(geo).getSize(new THREE.Vector3()));
    const key = `${spec.sku}|${L.t}`;
    if (!ladderMats.has(key)) ladderMats.set(key, loadLadderTex(turl).then(map => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 })));
    const mat = await ladderMats.get(key);
    const m = geo.clone(true);
    m.traverse(o => { if (o.isMesh) o.material = mat; });
    const size = ladderSize.get(geo);
    if (spec.place === 'kit') { // kit: stretch this geometry's own bounds to the catalog box, per axis
      m.userData.scale = kitScale(spec.dims[0], spec.dims[2], spec.dims[1], [size.x, size.y, size.z], meshYawDeg(spec));
    } else { // props: same uniform scale, corrected by largest-dimension ratio to the shipping GLB the solver sized
      const rec = lib.objects[spec.id]?.skus.find(k => k.sku === spec.sku);
      const k = rec?.bounds ? Math.max(...rec.bounds) / Math.max(size.x, size.y, size.z) : 1;
      m.userData.scale = spec.s.map(v => v * k);
    }
    return m;
  }

  const cubeGeo = new THREE.BoxGeometry(1, 1, 1); cubeGeo.translate(0, 0.5, 0);
  const cubeMats = new Map();
  const cubeMat = (c) => { if (!cubeMats.has(c)) cubeMats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); return cubeMats.get(c); };
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const chainGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 5); chainGeo.translate(0, 0.5, 0);
  const chainMat = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6, metalness: 0.3 });
  const flatMats = new Map();
  async function flatMat(url, opaque, soft = false) {
    const key = soft ? url + '|soft' : url;
    if (!flatMats.has(key)) {
      const map = await loadTex(url);
      // soft = floor scatter decals: alpha-blended edges (no hard cut-out silhouette to recognise when it repeats)
      flatMats.set(key, soft ? new THREE.MeshStandardMaterial({ map, roughness: 0.95, transparent: true, opacity: 0.88, depthWrite: false, alphaTest: 0.02, side: THREE.DoubleSide, forceSinglePass: true }) // (one pass: a flat is one plane, so back faces then front faces is the same picture, and three.js looks a two-pass material's program up again for every draw of it)
        : new THREE.MeshStandardMaterial({ map, roughness: 0.95, transparent: false, alphaTest: opaque ? 0 : 0.5, side: THREE.DoubleSide }));
    }
    return flatMats.get(key);
  }

  // build the visual child of an item: mesh clone, flat plane, or cube
  async function makeVisual(spec, cubes) {
    const [w, h, d] = spec.dims;
    if (spec.kind === 'kit' && !cubes && kitVisual) return kitVisual(spec.kitItem); // variant B: exact-module wall kit
    if (cubes || !spec.url) {
      const m = new THREE.Mesh(cubeGeo, cubeMat(PLACE_COLORS[spec.cubeColor || spec.place] || '#999'));
      m.scale.set(Math.max(0.05, w), Math.max(0.05, spec.orient === 'floor' ? 0.06 : h), Math.max(0.05, spec.orient === 'wall' ? 0.1 : d));
      if (spec.orient === 'wall') m.position.y = 0;
      return m;
    }
    if (spec.kind === 'flat') {
      const mat = await flatMat(spec.url, spec.opaque, spec.soft);
      const m = new THREE.Mesh(planeGeo, mat);
      if (spec.soft) m.renderOrder = 1;
      if (spec.orient === 'wall') { m.scale.set(w, h, 1); m.position.y = h / 2; }
      else { m.rotation.x = -Math.PI / 2; m.scale.set(spec.flip ? -w : w, d, 1); }
      m.receiveShadow = true;
      return m;
    }
    const L = ladderFor(spec);
    const m = L ? await ladderVisual(spec, L) : (await loadGLB(spec.url)).clone(true);
    const yawDeg = meshYawDeg(spec);
    if (spec.place === 'kit' && !m.userData.scale) { const b = lib.objects[spec.id]?.skus.find(k => k.sku === spec.sku)?.bounds; if (b) m.userData.scale = kitScale(spec.dims[0], spec.dims[2], spec.dims[1], b, yawDeg); }
    m.scale.set(...(m.userData.scale || spec.s));
    m.rotation.y = yawDeg * Math.PI / 180;
    m.userData.meshRoot = true;
    if (spec.place === 'kit') { m.userData.fitBase = { s: [m.scale.x, m.scale.y, m.scale.z], yaw: m.rotation.y, pos: [0, 0, 0] }; if (spec.fit) applyFit(m, m.userData.fitBase, spec.fit); } // wall fit corrections (above)
    // openables (Alignment Bench hinge records, 2026-10-04): spec.hinge = a hinge record -> swing the leaf/lid to spec.open;
    // spec.swap = a swap record on an open twin -> shift it so the closed/open swap does not jump
    if (spec.hinge) rigHinge(m, spec.hinge)?.set(spec.open ? 1 : 0);
    if (spec.swap) { const sp = swapPlacement(spec.swap, spec.closedDims || spec.dims); m.position.set(sp.x, sp.y, sp.z); m.rotation.y += sp.yaw; }
    if (spec.rule === 'ceiling' && CEIL - (spec.y + h) > 0.05) { // hung things get a chain up to the (unrendered) ceiling
      const holder = new THREE.Group(); holder.add(m);
      const len = CEIL - (spec.y + h);
      const chain = new THREE.Mesh(chainGeo, chainMat); chain.scale.set(1, len, 1); chain.position.y = h; holder.add(chain);
      return holder;
    }
    return m;
  }

  // ---------------------------------------------------------------- walls
  function familyUsable(id, family) { return (lib.objects[id]?.skus || []).some(s => s.family === family && s.bounds && skuUsable(s, solverOpts())); }
  function kitSpec(id, family, dimsIn, extra = {}, pick = 0) {
    const o = lib.objects[id];
    if (!o) return null;
    // same filter as the solver: prefer this family's usable pieces (a seeded pick among its versions, so a long wall
    // varies), then another family's, then (flagged) anything
    const ok = o.skus.filter(s => s.bounds && skuUsable(s, solverOpts()));
    let fam = ok.filter(s => s.family === family);
    if (!fam.length && FAMILY_FALLBACK[family]) fam = ok.filter(s => s.family === FAMILY_FALLBACK[family]);
    const sku = (fam.length ? fam[pick % fam.length] : null) || ok[0] || o.skus.find(s => s.family === family && s.bounds) || o.skus.find(s => s.bounds);
    const [w, d, h] = (dimsIn || o.size).map(v => v / 12);
    const s = sku ? kitScale(w, d, h, sku.bounds, orient[sku.mesh]) : [1, 1, 1];
    const fit = sku && wallfit[sku.sku] && !fitIsIdentity(wallfit[sku.sku]) ? wallfit[sku.sku] : null; // (the bench reads wallfit live; the game's table is loaded once)
    return { id, sku: sku?.sku, url: sku?.url, kind: 'mesh', place: 'kit', s, dims: [w, h, d], ...(fit && { fit }), ...extra };
  }
  // the generated pieces for one edge of the shared wall map: the wall piece and, for doors, a door that fills its whole
  // opening between the jamb posts (Harry: no tiny doors in big frames). [] inside a wide opening.
  function edgeSpecs(e) {
    if (e.kind === 'door-span') return [];
    const t = edgeTransform(e);
    const base = { x: t.x, z: t.z, rot: t.rot, roomId: e.owner.room, key: e.key, wallDir: e.dir };
    const wide = e.kind === 'door';
    let piece = e.kind === 'door' ? 'wall-doorway' : e.kind === 'window' ? 'wall-window-small' : 'wall-straight';
    // a window whose family piece is hidden by the ratings filter becomes plain wall of the same family
    // (mixing a stone window into a timber wall reads as broken); doorways fall back across families
    if (piece === 'wall-window-small' && !familyUsable(piece, e.family)) piece = 'wall-straight';
    // a special wall panel (walls.js PANELS: burial niches, a wall of skulls, stained glass) stands in for the plain panel when
    // its family has the piece. It is thicker than the 12-in wall: its room face stays flush, the extra depth goes outward
    let pin = -1; // (a panel rule may name the version: e.panelShape)
    if (e.kind === 'wall' && e.panel && familyUsable(e.panel, e.family)) { piece = e.panel; const out = (lib.objects[piece].size[1] / 12 - 1) / 2; base.x -= Math.sin(t.rot) * out; base.z -= Math.cos(t.rot) * out;
      if (e.panelShape != null) pin = lib.objects[piece].skus.filter(s => s.bounds && skuUsable(s, solverOpts()) && s.family === e.family).findIndex(s => (s.shape || '') === e.panelShape); }
    // which version of the piece: step along the wall run so a family with two versions alternates A B A B (a hashed pick
    // gave runs of the same plank wall three or four long); each wall line starts on its own hashed phase
    const along = e.dir === 'h' ? e.gx : e.gz, line = e.dir === 'h' ? e.gz : e.gx;
    const specs = wide ? [] : [{ ...kitSpec(piece, e.family, undefined, {}, pin >= 0 ? pin : Math.abs(along) + hash(`${e.dir}:${line}`, 'variant') % 64), ...base, layer: 'walls', cubeColor: piece === 'wall-window-small' ? 'window' : 'kit', uid: e.key }];
    if (e.kind === 'door') {
      const dt = lib.objects[e.doorType] ? e.doorType : 'door-plank';
      const [, dd] = lib.objects[dt].size;
      // single segment: fit the doorway piece (<= 54 in). Wide openings: the door fills the whole span between the jamb posts.
      const span = e.span || 1;
      const dims = [span * CELL * 12 - (span === 1 ? 8 : 16), Math.max(dd, 4), WALL_IN]; // the whole opening minus the posts, up to the wall head (WALL_IN: the opening is 108 in; the leaf was 100 and left an 8 in gap above every door)
      // prefer a leaf-only mesh (no baked frame) so the door really fills the opening
      const leaves = lib.objects[dt].skus.filter(k => k.piece === 'leaf' && k.bounds && skuUsable(k, solverOpts()));
      // a role with several leaves hangs the plain one ('leaf') unless the room type asks for another (walls.js DOORS: e.doorLeaf)
      const leaf = leaves.find(k => k.shape === (e.doorLeaf || 'leaf')) || leaves.find(k => k.shape === 'leaf') || (e.doorLeaf ? leaves[0] : null);
      const ds = leaf ? { ...kitSpec(dt, e.family, dims), sku: leaf.sku, url: leaf.url, s: kitScale(dims[0] / 12, dims[1] / 12, dims[2] / 12, leaf.bounds, orient[leaf.mesh]), fit: wallfit[leaf.sku] && !fitIsIdentity(wallfit[leaf.sku]) ? wallfit[leaf.sku] : undefined } : kitSpec(dt, e.family, dims);
      specs.push({ ...ds, ...base, layer: 'openings', cubeColor: 'door', uid: e.key + ':door' });
    }
    return specs;
  }
  // a corner or jamb post where generated walls meet (vertex v from computeEdges().corners)
  function cornerSpec(v) {
    const k = `${v.gx}:${v.gz}`;
    const vf = FAMILY_FALLBACK[v.family] || v.family, stone = vf === 'dressed-stone' || vf === 'fieldstone'; // a family that borrows a stone family's pieces gets its stone corner pillars (crypt-stone, castle-rough)
    const pd = v.slim ? 8 : v.jamb ? 16 : null; // single doors get slim jambs so the door fills the 5-ft tile
    const post = stone ? kitSpec('pillar-square', v.family, pd ? [pd + 2, pd + 2, WALL_IN] : [18, 18, WALL_IN]) : kitSpec('post-timber', v.family, pd ? [pd, pd, WALL_IN] : [14, 14, WALL_IN]);
    return { ...post, x: v.gx * CELL, z: v.gz * CELL, rot: 0, layer: 'walls', cubeColor: 'kit', uid: 'c' + k, key: 'c' + k, wallDir: 'c' };
  }

  // ---------------------------------------------------------------- floors
  // floor materials: per room type list (first = most typical), plus the two original framed tiles
  function floorFor(r) {
    if (r.floor && r.floor !== 'auto') return r.floor;
    const list = (typeByKey[r.type].floors || []).filter(f => lib.objects[f]);
    if (!list.length) return 'floor-tile';
    const h = hash(r.wallSeed, 'floor');
    return h % 2 === 0 ? list[0] : list[h % list.length];
  }
  const roomRect = (r) => ({ x0: r.x * CELL, z0: r.z * CELL, x1: (r.x + r.w) * CELL, z1: (r.z + r.d) * CELL });
  function scatterSpecs(r, id) {
    const sc = SCATTER[id]; if (!sc) return [];
    const rng = mulberry32(hash(r.wallSeed, 'scatter', id)), rc = roomRect(r), out = [];
    const area = (rc.x1 - rc.x0) * (rc.z1 - rc.z0);
    // a room that is not its whole rectangle (r.cells, walls.js perimeter): a decal that would lie outside it is left out
    const cellSet = r.cells ? new Set(r.cells.map(([i, j]) => `${i}:${j}`)) : null;
    const onFloor = (x, z, rad) => !cellSet || [[0, 0], [rad, 0], [-rad, 0], [0, rad], [0, -rad]].every(([dx, dz]) => cellSet.has(`${Math.floor((x + dx) / CELL) - r.x}:${Math.floor((z + dz) / CELL) - r.z}`));
    for (const [did, per] of sc.decals) {
      const o = lib.objects[did]; if (!o) continue;
      const flats = o.skus.filter(k => k.kind === 'flat'); if (!flats.length) continue;
      const n = Math.round(area * per);
      for (let k = 0; k < n; k++) {
        const sku = flats[Math.floor(rng() * flats.length)];
        const sc2 = 0.75 + rng() * 0.6, L = Math.max(o.size[0], o.size[1]) / 12 * sc2, a = sku.px ? sku.px[0] / sku.px[1] : 1;
        let [w, d] = a >= 1 ? [L, L / a] : [L * a, L];
        const st = 0.75 + rng() * 0.5; w *= st; d /= Math.sqrt(st); // stretch so the same decal never reads the same twice
        // keep the whole decal inside the walls (a hay patch must not poke out through a wall)
        const rad = Math.min(Math.hypot(w, d) / 2, (rc.x1 - rc.x0) / 2 - 0.6, (rc.z1 - rc.z0) / 2 - 0.6);
        const x = rc.x0 + 0.5 + rad + rng() * Math.max(0, rc.x1 - rc.x0 - 1 - 2 * rad), z = rc.z0 + 0.5 + rad + rng() * Math.max(0, rc.z1 - rc.z0 - 1 - 2 * rad);
        const flip = rng() < 0.5, rot = rng() * Math.PI * 2;
        if (!onFloor(x, z, rad)) continue;
        out.push({ id: did, sku: sku.sku, url: sku.url, kind: 'flat', orient: 'floor', opaque: false, soft: true, flip, place: 'tile', cubeColor: 'tile', dims: [w, 0.02, d],
          x, y: 0.026 + out.length * 0.0004, z, rot, layer: 'floor', roomId: r.id, uid: `${r.id}:sc${out.length}` });
      }
    }
    return out;
  }
  // every floor tile (one per 5-ft cell) and scatter decal of a room, as item specs
  function floorSpecs(r) {
    const id = floorFor(r);
    const o = lib.objects[SCATTER[id]?.base || id] || lib.objects[id];
    const fam = o.skus.filter(s => s.family === meshFamily(r.family));
    const pool = fam.length ? fam : o.skus; // a material's colour-matched variants: each cell picks one
    // structured floors (lines that must continue across cells) lay one seamless texture continuously;
    // organic floors (earth, straw, cobble, irregular stone) mix colour-matched variants, rotations and mirrors
    const mode = dials().floorMode; // continuous: one seamless texture laid straight (no seams, visible repeat)
    // scatter floors lay their low-feature base STRAIGHT (rotating breaks seamless edges = seams); the decals break repetition
    const structured = !!SCATTER[id] || (mode === 'continuous' || (mode === 'smart' && /plank|board|parquet|brick|checker|flagstone-square|terracotta|floor-tile|furrow/.test(id)));
    // composed exact-grid floors (c1..c3: checkers, B&W herringbone, kitchen tiles, delft) have grout on every cell edge,
    // so their versions can mix per cell without breaking the pattern (no rotation)
    const exact = pool.filter(k => /^c\d/.test(k.shape || ''));
    // gIJ: crops of an N x N-cell periodic layout (composed patterns, flagstones: 4x4 = 20 ft): the WORLD cell picks the crop,
    // so neighbouring cells and neighbouring rooms continue each other and the pattern repeats only every N cells
    const grid = new Map(pool.filter(k => /^g\d\d$/.test(k.shape || '')).map(k => [k.shape, k]));
    const out = [];
    const cellSet = r.cells ? new Set(r.cells.map(([i, j]) => `${i}:${j}`)) : null; // a shaped room floors only the cells it stands on
    for (let i = 0; i < r.w; i++) for (let j = 0; j < r.d; j++) {
      if (cellSet && !cellSet.has(`${i}:${j}`)) continue;
      const x = (r.x + i + 0.5) * CELL, z = (r.z + j + 0.5) * CELL, h = hash(r.wallSeed, i, j);
      const rot = structured ? 0 : (h % 4) * Math.PI / 2;
      const flip = !structured && (h >>> 3) % 2 === 1;
      const GN = Math.round(Math.sqrt(grid.size)), gx = ((r.x + i) % GN + GN) % GN, gz = ((r.z + j) % GN + GN) % GN;
      if (GN >= 2 && GN * GN === grid.size) { out.push({ id, sku: grid.get(`g${gx}${gz}`).sku, url: grid.get(`g${gx}${gz}`).url, kind: 'flat', orient: 'floor', opaque: true, place: 'tile', cubeColor: 'tile', dims: [CELL, 0.05, CELL], x, y: 0.02, z, rot: 0, layer: 'floor', roomId: r.id, uid: `${r.id}:f${i}:${j}` }); continue; }
      const sku = structured ? (exact.length > 1 ? exact[(h >>> 5) % exact.length] : (pool.find(k => !k.sku.includes('--v')) || pool[0])) : pool[(h >>> 5) % pool.length];
      out.push({ id, sku: sku.sku, url: sku.url, kind: 'flat', orient: 'floor', opaque: true, flip, place: 'tile', cubeColor: 'tile', dims: [CELL, 0.05, CELL], x, y: 0.02, z, rot, layer: 'floor', roomId: r.id, uid: `${r.id}:f${i}:${j}` });
    }
    for (const sp of scatterSpecs(r, id)) out.push(sp);
    return { id, specs: out };
  }

  return { skuRec, meshOf, glbCache, texCache, texBytes, loadGLB, loadTex, loadLadderTex, loadAny, isCached, ladderFor, ladderUrls, assetUrls, meshYawDeg, flatMat, makeVisual,
    familyUsable, kitSpec, edgeSpecs, cornerSpec, floorFor, floorSpecs, scatterSpecs, roomRect, cubeGeo, cubeMat, planeGeo };
}
