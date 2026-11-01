// Assets for the game: a thin layer over the Spawn Tuner's own look code (T.look.createLook, imported live). Visuals,
// LOD tiers, orientation, wall pieces and floor tiling all come from the tuner, at the tuner's default dials, so what
// the game draws is what Harry tuned. Only the game-side mapping (entity → look spec) and catalog search live here.
import { HOLE_ITEMS, holeVisual, holeGhost } from './holes.js';
import { isHoleCat } from '../core/holes.js';
import * as THREE from 'three';
import { T } from './tuner.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import { factionSearchItems, factionPieceName, isFactionSlot } from '../core/faction-catalog.js';
import { isHandKit, isHandStair, placeOf, isOpenState } from './library-index.js';
import { isTile, isFloorCat, floorCats, tileSize, tileVisual, tileName } from './tiles.js';
import * as DK from '../core/darkness.js';
import { opensIn } from '../core/openables.js';
import { motionRig, openTwinSku, openLookOf, rigOpen } from './openlook.js';

// HINGES THE GAME BRINGS ITSELF (2026-10-27, the barred cage door; every openable 2026-10-30): client/openlook.js.
export function createAssets({ base, dials = null }) {
  const { lib, types, orient } = T;
  let D = dials; // the dials in force (the graphics preset swaps the faces tier live: setFaces)
  const look = T.look.createLook({ lib, types, orient, wallfit: T.house?.wallfit || {}, base, dials: () => D || T.look.LOOK_DIALS, solverOpts: () => SOLVER_OPTS });
  const setFaces = (faces) => { D = { ...(D || T.look.LOOK_DIALS), faces: String(faces) }; };
  const usable = (k) => T.solver.skuUsable(k, SOLVER_OPTS);
  const openOf = new Map(Object.values(lib.objects).filter(o => o.open_of).map(o => [o.open_of, o.id]));

  // an object entity as the tuner's item spec (the same fields the tuner's makeVisual reads)
  function specOf(e) {
    let { cat, sku, url, s, dims } = e;
    // Alignment Bench hinge records (keyed by the closed mesh): 'hinge' swings the closed mesh's leaf/lid in place;
    // 'swap' names the variant-matched open twin and an offset so the swap does not jump. Then the house's own motion
    // (client/openlook.js: a leaf swings, a pair parts, the portcullis slides), then this variant's own open twin.
    const hr = benchRec(cat, sku);
    if (hr?.mode === 'hinge') return { ...specBase(e, cat, sku, url, s, dims), hinge: hr, open: !!e.open };
    const rig = !hr && motionRig(lib, cat, sku);
    if (rig) return { ...specBase(e, cat, sku, url, s, dims), openRig: rig, open: !!e.open };
    const twin = e.open && hr?.mode === 'swap' && lib.objects[`${cat}-open`]?.skus.find(k => k.sku === hr.open?.sku && k.bounds);
    if (twin) { // kit pieces stretch to their catalog box: an open door is deeper than the closed one
      const sc = Math.max(...dims) / Math.max(...twin.bounds), od = lib.objects[`${cat}-open`].size;
      const dimsOpen = e.place === 'kit' && od ? [od[0] / 12, od[2] / 12, od[1] / 12] : dims;
      return { ...specBase(e, `${cat}-open`, twin.sku, twin.url, [sc, sc, sc], dimsOpen), swap: hr, closedDims: dims };
    }
    // open things show their catalog "-open" twin, of the same variant (chest-plain--s3 → chest-plain-open--s3)
    // (or the twin that says it is this one's open state: `open_of`)
    const tw = e.open && cat && openTwinSku(lib, cat, sku, usable);
    if (tw?.k) {
      const k = tw.k, closed = lib.objects[cat]?.skus.find(x => x.sku === sku);
      if (e.place === 'kit' && OWN_DEPTH.has(cat) && closed?.bounds && k.bounds) { // (a kit piece: stretched to its box, look.js kitScale)
        const t = twinKitBox(dims, k.bounds, orient[k.mesh], lib.objects[cat].fp === 'edge');
        return { ...specBase(e, tw.id, k.sku, k.url, null, t.dims), swap: { offset: [0, sunk(k, dims[1], t.dims[1]) / dims[1], t.dz / dims[2]] }, closedDims: dims };
      }
      const sc = twinScale(dims, s, closed, k);
      if (k.sink) return { ...specBase(e, tw.id, k.sku, k.url, [sc, sc, sc], dims), swap: { offset: [0, sunk(k, dims[1], sc * k.bounds[1]) / dims[1], 0] }, closedDims: dims };
      cat = tw.id; sku = k.sku; url = k.url; s = [sc, sc, sc];
    }
    return specBase(e, cat, sku, url, s, dims);
  }
  // a hatch twin (the open trapdoor, the oubliette) has its shaft hanging under its floor tile: `sink` (build_data.py,
  // experiments/2026-10-30-openmesh/tools/sink.py) is the tile's top as a share of the mesh's height. Lowered so that top
  // meets the shut piece's top; the shaft goes under the floor. → the y offset, ft (0 or less)
  const sunk = (k, hShut, hTwin) => k.sink ? Math.min(0, hShut - k.sink * hTwin) : 0;
  // THE OPEN TWIN'S SIZE (2026-10-30, experiments/2026-10-30-openmesh). Every generated mesh comes normalised (its
  // longest side 1), so a twin cannot simply take the shut one's scale. It used to be scaled longest side to longest
  // side, which is right only while the longest side is one the opening leaves alone: a trunk 34 in wide whose lid
  // stands 44 in high when open came out three quarters of the shut trunk's size. Now the twin takes the scale that
  // makes the sides the opening does NOT change agree: of the three per-side ratios (shut extent / open extent), the
  // largest, since a side the opening grows (the height under a raised lid, the depth before swung doors) only ever
  // gives a smaller one. Extents are taken as each mesh stands (its own measured yaw).
  const extents = (b, yawDeg) => { const a = (yawDeg || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)); return [c * b[0] + sn * b[2], b[1], sn * b[0] + c * b[2]]; };
  function twinScale(dims, s, closed, k) {
    if (!closed?.bounds || !k.bounds) return Math.max(...dims) / Math.max(...k.bounds);
    const bc = extents(closed.bounds, orient[closed.mesh]), bo = extents(k.bounds, orient[k.mesh]);
    const sc = s?.[0] || Math.max(...dims) / Math.max(...bc); // the shut one's own scale (uniform: a placed mesh's s)
    return sc * Math.max(...bc.map((v, i) => v / bo[i]));
  }
  // kit pieces whose open twin needs a box of its own: a framed door's leaf swings a door's width out of a frame 3 in
  // deep, a trapdoor's hatch stands 3 ft up off a tile 4 in high. Stretched into the shut piece's box (as every kit twin
  // is) the leaf lay flat in the frame again and the hatch lay flat on the tile, and both read shut. Their twin keeps the
  // shut piece's width (and a door's height, a hatch's depth) and takes its own extent, at the width's scale, along the
  // side the opening grows; a door's twin stands with its frame in the wall and the leaf out on the +Z side (each twin's
  // measured yaw puts it there: data/orient.json, experiments/2026-10-30-openmesh).
  const OWN_DEPTH = new Set(['door-plank', 'door-reinforced', 'floor-trapdoor']);
  function twinKitBox([w, h, d], b, yawDeg, edge) {
    const q = ((Math.round(yawDeg || 0) % 180) + 180) % 180, bw = q === 90 ? b[2] : b[0], bd = q === 90 ? b[0] : b[2], u = w / bw;
    if (edge) { const dO = Math.max(d, u * bd); return { dims: [w, h, dO], dz: (dO - d) / 2 }; }
    return { dims: [w, Math.max(h, u * b[1]), d], dz: 0 };
  }
  const benchRec = (cat, sku) => T.hinges?.[lib.objects[cat]?.skus.find(k => k.sku === sku)?.mesh] || null;
  // how a thing shows it is open: 'motion' | 'swap' | null (no open look: INVENTORY.md)
  const openLook = (e) => e?.kind === 'object' && opensIn(lib, e.cat) ? openLookOf(lib, e, benchRec(e.cat, e.sku), usable) : null;
  const specBase = (e, cat, sku, url, s, dims) => ({ id: cat, sku, url, kind: e.flat ? 'flat' : 'mesh', place: e.place, layer: e.layer, rule: e.rule || undefined, orient: e.orient || (e.flat ? (e.place === 'wall' ? 'wall' : 'floor') : undefined),
    s: s || [1, 1, 1], dims: dims || [2, 2, 2], yaw: e.yaw || 0, y: e.y || 0 });
  // floor tiles: the tuner's floor code for the tile's world cell (client/tiles.js), so patterns continue across tiles
  const visualFor = (e) => isHoleCat(e.cat) || /^hole-round-/.test(e.cat || '') ? Promise.resolve(e.id ? holeVisual(e) : holeGhost(/^hole-round/.test(e.cat) ? 'hole-round' : 'hole', e.dims?.[0] || 10)) : !e.url ? Promise.resolve(null) : (isTile(e) || (e.place === 'tile' && isFloorCat(e.cat))) ? tileVisual(look, e) : meshVisual(specOf(e));

  // a mesh, rigged to open when it moves to open (openlook.js); the rig (look.js's hinge, or ours) is v.userData.openRig
  const meshVisual = (spec) => look.makeVisual(spec, false).then(v => {
    if (!v) return v;
    v.userData.drawnAs = spec.id; // (the catalog object drawn: the open twin's id when it swapped; tests)
    if (spec.openRig) { const rig = rigOpen(v, spec.openRig); if (rig) { rig.set(spec.open ? 1 : 0); v.userData.openRig = rig; } }
    else if (spec.hinge) { let rig = null; v.traverse(o => { rig ||= o.userData.hinge || null; }); if (rig) v.userData.openRig = rig; }
    return v;
  });
  // a quiet stand-in until the mesh arrives (or if it never does): the catalog box
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x8b8378, transparent: true, opacity: 0.55 });
  function placeholder(dims) {
    const [w, h, d] = dims || [2, 2, 2];
    const m = new THREE.Mesh(boxGeo, boxMat);
    m.scale.set(Math.max(0.1, w), Math.max(0.05, h), Math.max(0.1, d)); m.position.y = Math.max(0.05, h) / 2;
    m.userData.placeholder = true;
    return m;
  }

  // ---------- the catalog, as the command bar offers it ----------
  // walls, doors and windows are ordinary objects too (Harry 2026-10-04): the kit pieces a person places by hand;
  // railings, balustrades and fences too (Harry 2026-10-24: "railing" and "banister" found nothing), onto 5-ft edges
  // (the list is library-index.js HAND_KIT, shared with the Build library, so each piece is on its shelves too)
  const KIT = { test: isHandKit }; // (HAND_KIT, on every shelf, and ROOM_KIT, on the shelves of the rooms that use it)
  // and the stairs (2026-10-11): the grand stair, the spirals, the flights and half flights. Put down by hand they open
  // the floor above like a planned stair (core/stairs.js STAIR_ROLES). The piece made for a 10-ft storey is offered first.
  const STAIRS = isHandStair;
  const catalog = Object.values(lib.objects).filter(o => (placeOf(o) !== 'kit' || KIT.test(o.id) || STAIRS(o.id)) && !isFactionSlot(o.id) && !isFloorCat(o.id) && !isOpenState(lib, o.id)).map(o => {
    const sku = (STAIRS(o.id) && o.skus.find(k => k.bounds && k.url && /--t10$/.test(k.sku))) || o.skus.find(k => (k.kind === 'flat' || k.bounds) && usable(k)) || o.skus.find(k => k.kind === 'flat' || k.bounds);
    return sku && { id: o.id, name: o.id.replace(/-/g, ' '), desc: o.desc || '', hint: o.hint || '', place: placeOf(o), sku: sku.sku, url: sku.url, flat: sku.kind === 'flat', aff: o.aff || [] };
  }).filter(Boolean);
  // every floor material, as a 5-ft floor tile (painted cell by cell, like a rug that IS the floor)
  for (const id of floorCats(lib)) { const sz = tileSize(lib, id); if (sz) catalog.push({ id, name: tileName(id), desc: lib.objects[id].desc || 'a 5-ft floor tile', hint: 'paint: drag across cells, Shift-drag fills a rectangle', place: 'tile', sku: sz.sku, url: sz.url, flat: true, tile: true, aff: [] }); }
  catalog.push(...factionSearchItems(lib).filter(c => usable(lib.objects[c.id].skus.find(k => k.sku === c.sku))));
  // HOLES (2026-10-22, client/holes.js): a square hole painted like a floor tile, round ones of 5 to 20 ft placed like things
  catalog.push(...HOLE_ITEMS.map(h => ({ ...h, id: h.key || h.id })));
  const catById = new Map(catalog.map(c => [c.id, c]));
  catById.set('hole-round', catById.get('hole-round-10')); // (a placed round hole's cat; its size is its dims)
  const openable = (cat) => opensIn(lib, cat); // (core/openables.js: the catalog's 'open', or an open twin of its own)
  const lightable = (cat) => !!T.fire.fireType(cat || ''); // fireplaces, candles, lanterns… (the tuner's fire types)
  // in a DARK area, what light a thing throws (core/darkness.js: its kind, and its reach in feet; the GM's lightRadius first)
  const lightKind = (cat) => DK.lightKind(cat || '', T.fire.fireType(cat || '') || null, lib.objects[cat]?.aff || []);
  const lightRadius = (e, table) => { const k = lightKind(e?.cat); return k ? DK.lightRadiusOf(e, k, table) : 0; }; // table: the look's (app.fog.lightTable())

  // "replace with similar": the other meshes of the same catalog object first, then siblings that share its words
  function similar(cat, limit = 8) {
    const o = lib.objects[cat]; if (!o) return [];
    if (isFloorCat(cat)) { // the other floor materials, nearest in kind first (planks by planks, flagstones by flagstones)
      const words = new Set(cat.split('-').slice(1));
      return floorCats(lib).filter(id => id !== cat).map(id => ({ id, s: id.split('-').slice(1).filter(w => words.has(w)).length }))
        .sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1)).slice(0, Math.max(limit, 10)).map(({ id }) => { const sz = tileSize(lib, id); return { cat: id, sku: sz.sku, url: sz.url, name: tileName(id) }; });
    }
    // a wall piece is named by its wall style, which is not always the one in its file name (the stacked-log wall is
    // 'wall-straight--rough-timber--s3' but belongs to the log-cabin style; picking it into a plank wall is the user's call)
    const nameOf = (k) => isFactionSlot(cat) ? factionPieceName(lib, cat, k) : (o.place === 'kit' && k.family ? k.sku.split('--').map((w, i) => i === 1 ? k.family : w).join('--') : k.sku).replace(/--/g, ' · ').replace(/-/g, ' ');
    const out = o.skus.filter(k => k.bounds && usable(k)).map(k => ({ cat, sku: k.sku, url: k.url, name: nameOf(k) }));
    const words = new Set(cat.split('-').filter(w => w.length > 2));
    for (const c of catalog.filter(c => c.id !== cat && !c.flat && c.place === o.place && c.id.split('-').some(w => words.has(w))).slice(0, limit)) out.push({ cat: c.id, sku: c.sku, url: c.url, name: c.name });
    return out.slice(0, limit);
  }

  return { look, lib, setFaces, faces: () => (D || T.look.LOOK_DIALS).faces, specOf, visualFor, placeholder, catalog, catById, openable, openLook, lightable, lightKind, lightRadius, similar,
    template: (url) => look.loadGLB(url), texture: (url) => look.loadTex(url), meshYaw: (sku, yaw) => look.meshYawDeg({ sku, yaw }) * Math.PI / 180 };
}
