// Assets for the game: a thin layer over the Spawn Tuner's own look code (T.look.createLook, imported live). Visuals,
// LOD tiers, orientation, wall pieces and floor tiling all come from the tuner, at the tuner's default dials, so what
// the game draws is what Harry tuned. Only the game-side mapping (entity → look spec) and catalog search live here.
import * as THREE from 'three';
import { T } from './tuner.js';
import { SOLVER_OPTS } from '../core/roomgen.js';
import { factionSearchItems, factionPieceName, isFactionSlot } from '../core/faction-catalog.js';
import { STAIR_ROLES } from '../core/stairs.js';
import { isTile, isFloorCat, floorCats, tileSize, tileVisual, tileName } from './tiles.js';
import * as DK from '../core/darkness.js';

export function createAssets({ base, dials = null }) {
  const { lib, types, orient } = T;
  let D = dials; // the dials in force (the graphics preset swaps the faces tier live: setFaces)
  const look = T.look.createLook({ lib, types, orient, wallfit: T.house?.wallfit || {}, base, dials: () => D || T.look.LOOK_DIALS, solverOpts: () => SOLVER_OPTS });
  const setFaces = (faces) => { D = { ...(D || T.look.LOOK_DIALS), faces: String(faces) }; };
  const usable = (k) => T.solver.skuUsable(k, SOLVER_OPTS);

  // an object entity as the tuner's item spec (the same fields the tuner's makeVisual reads)
  function specOf(e) {
    let { cat, sku, url, s, dims } = e;
    // Alignment Bench hinge records (keyed by the closed mesh): 'hinge' swings the closed mesh's leaf/lid in place;
    // 'swap' names the variant-matched open twin and an offset so the swap does not jump. No record: the old swap.
    const hr = T.hinges?.[lib.objects[cat]?.skus.find(k => k.sku === sku)?.mesh];
    if (hr?.mode === 'hinge') return { ...specBase(e, cat, sku, url, s, dims), hinge: hr, open: !!e.open };
    const twin = e.open && hr?.mode === 'swap' && lib.objects[`${cat}-open`]?.skus.find(k => k.sku === hr.open?.sku && k.bounds);
    if (twin) { // kit pieces stretch to their catalog box: an open door is deeper than the closed one
      const sc = Math.max(...dims) / Math.max(...twin.bounds), od = lib.objects[`${cat}-open`].size;
      const dimsOpen = e.place === 'kit' && od ? [od[0] / 12, od[2] / 12, od[1] / 12] : dims;
      return { ...specBase(e, `${cat}-open`, twin.sku, twin.url, [sc, sc, sc], dimsOpen), swap: hr, closedDims: dims };
    }
    // open things show their catalog "-open" twin when there is one (chest-plain → chest-plain-open)
    if (e.open && cat && lib.objects[`${cat}-open`]) {
      const o = lib.objects[`${cat}-open`], k = o.skus.find(x => x.bounds && usable(x)) || o.skus.find(x => x.bounds);
      if (k) { const sc = Math.max(...dims) / Math.max(...k.bounds); cat = o.id; sku = k.sku; url = k.url; s = [sc, sc, sc]; }
    }
    return specBase(e, cat, sku, url, s, dims);
  }
  const specBase = (e, cat, sku, url, s, dims) => ({ id: cat, sku, url, kind: e.flat ? 'flat' : 'mesh', place: e.place, layer: e.layer, rule: e.rule || undefined, orient: e.orient || (e.flat ? (e.place === 'wall' ? 'wall' : 'floor') : undefined),
    s: s || [1, 1, 1], dims: dims || [2, 2, 2], yaw: e.yaw || 0, y: e.y || 0 });
  // floor tiles: the tuner's floor code for the tile's world cell (client/tiles.js), so patterns continue across tiles
  const visualFor = (e) => !e.url ? Promise.resolve(null) : (isTile(e) || (e.place === 'tile' && isFloorCat(e.cat))) ? tileVisual(look, e) : look.makeVisual(specOf(e), false);

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
  // walls, doors and windows are ordinary objects too (Harry 2026-10-04): the kit pieces a person places by hand
  const KIT = /^(wall-straight|wall-window-small|wall-doorway|door-plank|door-reinforced|door-double-grand|door-barn-double)$/;
  // and the stairs (2026-10-11): the grand stair, the spirals, the flights and half flights. Put down by hand they open
  // the floor above like a planned stair (core/stairs.js STAIR_ROLES). The piece made for a 10-ft storey is offered first.
  const STAIRS = (id) => !!STAIR_ROLES[id] || id === 'stair-landing';
  const catalog = Object.values(lib.objects).filter(o => (o.place !== 'kit' || KIT.test(o.id) || STAIRS(o.id)) && !isFactionSlot(o.id) && !o.id.startsWith('floor-') && !o.id.endsWith('-open')).map(o => {
    const sku = (STAIRS(o.id) && o.skus.find(k => k.bounds && k.url && /--t10$/.test(k.sku))) || o.skus.find(k => (k.kind === 'flat' || k.bounds) && usable(k)) || o.skus.find(k => k.kind === 'flat' || k.bounds);
    return sku && { id: o.id, name: o.id.replace(/-/g, ' '), desc: o.desc || '', hint: o.hint || '', place: o.place, sku: sku.sku, url: sku.url, flat: sku.kind === 'flat', aff: o.aff || [] };
  }).filter(Boolean);
  // every floor material, as a 5-ft floor tile (painted cell by cell, like a rug that IS the floor)
  for (const id of floorCats(lib)) { const sz = tileSize(lib, id); if (sz) catalog.push({ id, name: tileName(id), desc: lib.objects[id].desc || 'a 5-ft floor tile', hint: 'paint: drag across cells, Shift-drag fills a rectangle', place: 'tile', sku: sz.sku, url: sz.url, flat: true, tile: true, aff: [] }); }
  catalog.push(...factionSearchItems(lib).filter(c => usable(lib.objects[c.id].skus.find(k => k.sku === c.sku))));
  const catById = new Map(catalog.map(c => [c.id, c]));
  const openable = (cat) => !!lib.objects[cat]?.aff?.includes('open');
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

  return { look, lib, setFaces, faces: () => (D || T.look.LOOK_DIALS).faces, specOf, visualFor, placeholder, catalog, catById, openable, lightable, lightKind, lightRadius, similar,
    template: (url) => look.loadGLB(url), texture: (url) => look.loadTex(url), meshYaw: (sku, yaw) => look.meshYawDeg({ sku, yaw }) * Math.PI / 180 };
}
