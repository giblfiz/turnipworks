// Sample areas (Harry 2026-10-03, re-laid 2026-10-04): one fixed, read-only LIBRARY AREA per room type, holding that
// room type's furniture and objects at true scale, so sizes compare honestly. Laid out "knolling" style (Harry: "too
// diegetic" as shelves): a plain neutral plane, everything in a tidy grid at 90°, evenly spaced by size, in sections
// per category (centrepieces, furniture, storage, lights, dressing, table and tools), seen by a TOP-DOWN PiP camera.
// Each thing lies the way its silhouette reads best from above: tall things (a chair, a lantern) lie on their side.
// While the Build menu sits at the furniture or object level the PiP shows the current room type's library and the
// menu's position flies the camera to that item. Drag a thing out (or select it there and copy, then paste in the
// world): the ordinary placement and paste paths do the rest, upright, with the usual placement rules.
// A library area is local (never synced, never on the relay): an AreaWorld fed a view built here. Meshes load
// progressively: an item gets its mesh url only once the PiP camera comes near it; until then it is a quiet box.
import * as THREE from 'three';
import { createFactionShelf } from './faction-shelf.js';
import { factionPieceName, isFactionSlot } from '../core/faction-catalog.js';
import { AreaWorld } from './world.js';
import { T } from './tuner.js';
import { KIT_PIECES } from './taxonomy.js';
import { floorCats, tileSize } from './tiles.js';
import { SOLVER_OPTS } from '../core/roomgen.js';

const SECTIONS = [['anchor', 'Centrepieces'], ['furnish', 'Furniture'], ['store', 'Storage'], ['light', 'Lights'], ['dress', 'Dressing'], ['plants', 'Plants'], ['*', 'Table and tools']]; // plants: the yard's slot, empty until plant meshes exist
const gapOf = (size) => Math.max(0.7, Math.min(2.4, size * 0.35)); // evenly spaced BY SIZE: small things sit close
const PLANE = '#b5b1a7', BG = '#2a2b27';
// A TRIAL (Harry 2026-10-11: "In the object libraries, let's try making all objects the same size instead of having the
// relative sizes correctly."): every thing is drawn so the longer side of its footprint from above is EVEN_FT, so a cup
// is as easy to see and to grab as a wardrobe. Only the library's picture of a thing changes (entity.libK, a drawing
// scale the world applies to library things only); what is dragged or copied out is the thing at its true size.
// THE SWITCH: Settings > Me > Interface > "Library: everything the same size" (pref libEven; off = true relative sizes,
// as before). LIB_EVEN is what a browser that never chose gets.
export const LIB_EVEN = true, EVEN_FT = 3;

export function createLibrary(app, { taxonomy, renderer }) {
  const L = { worlds: new Map(), cur: null, target: null, sel: null, prevPip: null };
  const factions = createFactionShelf(app);
  L.showFactions = () => { L.hide(); factions.show(); };
  L.hideFactions = factions.close;
  const libId = (roomKey) => `lib:${roomKey}`;
  const even = () => (app.prefs?.libEven ?? LIB_EVEN) !== false;

  // ---------- layout: sections of tidy rows; each thing lies the way it reads from above ----------
  function layoutFor(roomNode) {
    const recipe = T.types.find(t => t.key === roomNode.roomKey) || { slots: {} };
    const slotOf = (id) => { for (const [k, ids] of Object.entries(recipe.slots || {})) if (k !== 'sets' && ids.includes(id)) return SECTIONS.some(([s]) => s === k) ? k : '*'; return '*'; };
    const items = [...(roomNode.furniture || []).filter(n => !n.kit).map(n => ({ cat: n.cat, label: n.label, place: n.place })), ...(roomNode.objects || []).map(id => ({ cat: id, label: cap(id), place: 'surface' }))].flatMap(it => isFactionSlot(it.cat) ? (app.lib.objects[it.cat]?.skus || []).filter(k => T.solver.skuUsable(k, SOLVER_OPTS)).map(k => ({ ...it, sku: k.sku, label: factionPieceName(app.lib, it.cat, k) })) : [it]);
    const bySec = new Map(SECTIONS.map(([k]) => [k, []]));
    for (const it of items) { const size = app.roomgen.sizeOf(it.cat, it.sku); if (size) bySec.get(slotOf(it.cat)).push({ ...it, size }); }
    // walls, doors and windows: a section per wall family (the room's own first)
    const kitSecs = [];
    const usable = (k) => k.bounds && T.solver.skuUsable(k, SOLVER_OPTS);
    const fams = [...new Set((app.lib.objects['wall-straight']?.skus || []).filter(usable).map(k => k.family).filter(Boolean))].sort((a, b) => (b === recipe.family) - (a === recipe.family));
    for (const fam of fams) {
      const list = [];
      for (const id of KIT_PIECES) {
        const k = app.lib.objects[id]?.skus.find(x => x.family === fam && usable(x)) || (fam === fams[0] ? app.lib.objects[id]?.skus.find(usable) : null); if (!k) continue; // the room's own family section shows every piece
        const size = app.roomgen.sizeOf(id, k.sku); if (size) list.push({ cat: id, sku: k.sku, label: (roomNode.furniture || []).find(f => f.cat === id)?.label || cap(id), place: 'kit', size });
      }
      if (list.length) kitSecs.push([`kit:${fam}`, `Walls, doors and windows · ${fam.replace(/-/g, ' ')}`, list]);
    }
    // floors: every floor material as a 5-ft tile, the room type's own floors first (Harry 2026-10-04)
    const own = (recipe.floors || []).filter(f => app.lib.objects[f]), all = floorCats(app.lib);
    const tileItem = (id) => { const size = tileSize(app.lib, id); return size && { cat: id, sku: size.sku, label: cap(id.replace(/^floor-/, '')), place: 'tile', size }; };
    const ownList = own.filter(f => all.includes(f)).map(tileItem).filter(Boolean), moreList = all.filter(f => !own.includes(f)).map(tileItem).filter(Boolean);
    if (ownList.length) kitSecs.unshift(['floors', 'Floors', ownList]);
    if (moreList.length) kitSecs.push(['floors-more', ownList.length ? 'More floors' : 'Floors', moreList]);
    const entities = {}, slots = new Map(), labels = [], evenNow = even();
    // 1. each thing's CELL: its top-down footprint and, below it, its label, at the label's real world size (two lines
    //    when a name is long), so no label can ever reach into a neighbour's cell (Harry 2026-10-04)
    const cellOf = (it) => {
      const [w0, h0, d0] = it.size.dims;
      // the orientation whose silhouette from above is biggest: upright (w×d), on its side (h×d: a chair's profile,
      // a lantern) or on its back (w×h: a wall's face, a door); flat things stay as they are
      const tall = h0 > 0.6 && !it.size.flat;
      const how = !tall ? 'up' : [['up', w0 * d0], ['side', h0 * d0 * 1.02], ['back', w0 * h0]].sort((a, b) => b[1] - a[1])[0][0];
      // the same size for all (the trial above): k brings the longer side of that footprint to EVEN_FT; 1 = true size
      const k = evenNow ? EVEN_FT / Math.max(how === 'side' ? h0 : w0, how === 'back' ? h0 : d0, 0.02) : 1, w = w0 * k, h = h0 * k, d = d0 * k;
      const fw = how === 'side' ? h : w, fd = how === 'back' ? h : d;
      const lh = Math.min(0.7, Math.max(0.36, 0.22 + Math.max(fw, fd) * 0.06));
      const lines = wrapLabel(it.label, lh, Math.max(fw, 3.2)), lw = Math.max(...lines.map(t => textWidth(t, lh)));
      const gut = gapOf(Math.max(fw, fd));
      return { it, how, k, fw, fd, w, h, d, lh, lines, cw: Math.max(fw, lw) + gut, cd: fd + 0.3 + lines.length * lh * 1.1 + gut };
    };
    // 2. each category: its cells shelf-packed into a near-square block, biggest first, title above
    const groups = [];
    for (const [k, title, kitList] of [...SECTIONS.map(([k, t]) => [k, t, null]), ...kitSecs]) {
      const list = kitList || bySec.get(k); if (!list.length) continue;
      const cells = list.map(cellOf).sort((a, b) => b.cd - a.cd || b.cw - a.cw || (a.it.cat < b.it.cat ? -1 : 1));
      const area = cells.reduce((s, c) => s + c.cw * c.cd, 0), titleW = textWidth(title.toUpperCase(), 0.9, true) + 1;
      const target = Math.max(Math.sqrt(area) * 1.1, ...cells.map(c => c.cw), titleW);
      let x = 0, z = 0, rowD = 0, gw = 0;
      for (const c of cells) { if (x > 0 && x + c.cw > target) { x = 0; z += rowD; rowD = 0; } c.gx = x; c.gz = z; x += c.cw; gw = Math.max(gw, x); rowD = Math.max(rowD, c.cd); }
      groups.push({ title, cells, w: Math.max(gw, titleW), d: z + rowD + 2.2 }); // + the title band
    }
    // 3. the groups themselves, packed into one rectangle shaped like the PiP window (shelves, tallest group first)
    const GG = 3, total = groups.reduce((s, g) => s + (g.w + GG) * (g.d + GG), 0), aspect = 1.45;
    const outerW = Math.max(Math.sqrt(total * aspect), ...groups.map(g => g.w + GG));
    let ox = 0, oz = 0, shelfD = 0, maxX = 0;
    for (const g of [...groups].sort((a, b) => b.d - a.d || b.w - a.w)) {
      if (ox > 0 && ox + g.w > outerW) { ox = 0; oz += shelfD + GG; shelfD = 0; }
      g.x = ox; g.z = oz; ox += g.w + GG; maxX = Math.max(maxX, ox - GG); shelfD = Math.max(shelfD, g.d);
    }
    for (const g of groups) {
      labels.push({ text: g.title.toUpperCase(), x: g.x, z: g.z + 0.7, h: 0.9, left: true, head: true });
      for (const c of g.cells) {
        const x0 = g.x + c.gx, z0 = g.z + 2.2 + c.gz, cx = x0 + c.fw / 2 + (c.cw - c.fw - gapOf(Math.max(c.fw, c.fd))) / 2, cz = z0 + c.fd / 2;
        put(c.it, cx, cz, c.how, c.w, c.h, c.d, c.k);
        c.lines.forEach((t, i) => labels.push({ text: t, x: cx, z: z0 + c.fd + 0.3 + c.lh * (0.55 + i * 1.1), h: c.lh }));
      }
    }
    const size = [maxX, oz + shelfD];
    function put(it, cx, cz, how, w, h, d, k) {
      const id = `obj_lib${(Object.keys(entities).length + 1).toString(36).padStart(5, '0')}`;
      const s = it.size;
      // on its side: 90° about Z; on its back: -90° about X (its front faces up). The world turns a tilted thing about
      // the middle of its box and rests it on the ground (world.js seatTilt), so it lies centred on its slot.
      const pos = how === 'side' ? { x: cx, y: 0, z: cz, tiltZ: Math.PI / 2 } : how === 'back' ? { x: cx, y: 0, z: cz, tiltX: -Math.PI / 2 } : { x: cx, y: 0, z: cz };
      entities[id] = { id, kind: 'object', name: it.label, cat: it.cat, sku: s.sku, urlLater: s.url, flat: s.flat || undefined, place: it.place, layer: 'furnish', rot: 0, yaw: s.yaw || 0, s: s.s || undefined, dims: s.dims, libK: k !== 1 ? k : undefined, ...pos };
      const slot = { id, x: cx, y: 0, z: cz, size: Math.max(how === 'side' ? h : w, how === 'back' ? h : d) };
      if (!slots.has(it.cat)) slots.set(it.cat, slot);
      slots.set(`${it.cat}|${s.sku}`, slot);
    }
    return { entities, slots, labels, size, even: evenNow };
  }

  function worldFor(roomNode) {
    const id = libId(roomNode.roomKey);
    if (L.worlds.has(id)) return L.worlds.get(id);
    const lay = layoutFor(roomNode);
    const w = new AreaWorld(id, { roomgen: app.roomgen, assets: app.assets, renderer, camera: app.main.camera, focus: () => null, fx: false });
    w.local = true; w.lay = lay; w.roomNode = roomNode;
    w.scene.background = new THREE.Color(BG);
    w.grid.visible = false;
    w.ground.material.color.set(PLANE); // the plain neutral plane everything lies on
    w.ground.position.set(lay.size[0] / 2, -0.01, lay.size[1] / 2);
    for (const l of lay.labels) w.layers.deco.add(textPlane(l));
    w.libView = { entities: lay.entities, seq: 0, order: 0, chat: [] };
    w.sync(w.libView);
    L.worlds.set(id, w); app.worlds.set(id, w);
    return w;
  }

  // the switch was flipped: lay every library out again in place (the meshes already loaded stay loaded)
  L.relayout = () => {
    for (const w of L.worlds.values()) {
      if (w.lay.even === even()) continue;
      const had = new Set(Object.values(w.libView.entities).filter(e => e.url).map(e => `${e.cat}|${e.sku}`));
      for (const m of w.layers.deco.children.filter(m => m.userData.label)) { m.removeFromParent(); m.geometry.dispose(); m.material.map?.dispose(); m.material.dispose(); }
      const lay = w.lay = layoutFor(w.roomNode);
      for (const e of Object.values(lay.entities)) if (had.has(`${e.cat}|${e.sku}`)) e.url = e.urlLater;
      w.ground.position.set(lay.size[0] / 2, -0.01, lay.size[1] / 2);
      for (const l of lay.labels) w.layers.deco.add(textPlane(l));
      w.libView = { entities: lay.entities, seq: (w.libView.seq || 0) + 1, order: 0, chat: [] };
      w.sync(w.libView);
      if (L.cur === w.areaId) { const s = L.sel && (lay.slots.get(`${L.sel.id}|${L.sel.sku}`) || lay.slots.get(L.sel.id)); if (L.sel) L.sel = s ? { ...L.sel, entity: lay.entities[s.id] } : null; L.hov = null; L.target = L.overview(w); L.flown = false; }
    }
    app.refresh?.();
  };
  // ---------- the PiP: show, fly, load as the camera looks ----------
  L.show = (roomNode, cat = null, sku = null, { keep = false } = {}) => {
    factions.close();
    const w = worldFor(roomNode);
    if (!L.cur && app.pip && !app.pip.area.startsWith('lib:')) L.prevPip = { area: app.pip.area, follow: app.pip.follow };
    if (L.cur !== w.areaId || !app.pip || app.pip.area !== w.areaId) app.openLocalPip(w.areaId);
    const same = keep && L.cur === w.areaId && !cat; // back from a drag-out: the camera stays where the person left it
    L.cur = w.areaId;
    if (same) { app.refresh(); return; }
    const slot = cat && (w.lay.slots.get(`${cat}|${sku}`) || w.lay.slots.get(cat));
    // a top-down camera, framing the item with a little of its neighbours (or the whole layout)
    if (slot) L.target = { x: slot.x, y: 0, z: slot.z + 0.3, dist: THREE.MathUtils.clamp(slot.size * 2.8 + 6, 8, 34), pitch: 88 };
    else L.target = L.overview(w); // opens framing ALL of it (Harry 2026-10-04); the meshes still arrive a few at a time
    L.flown = false;
    app.refresh();
  };
  L.hide = () => {
    if (!L.cur) return;
    L.cur = null; L.sel = null;
    if (L.prevPip) { app.openPip(L.prevPip.area, L.prevPip.follow); L.prevPip = null; } else app.closePip();
  };
  L.shown = () => !!(L.cur && app.pip?.area === L.cur);
  L.frame = (dt) => {
    if (!L.shown()) return;
    const g = app.pip.grab, t = L.target;
    loadNear(app.worlds.get(L.cur), g);
    if (!t) return; // the person is steering the PiP camera
    const now = performance.now(), real = Math.min(1, (now - (L.lastT || now)) / 1000); L.lastT = now; // real time: a slow frame rate flies as fast
    const k = 1 - Math.exp(-Math.max(dt, real) * 4);
    g.focus.x += (t.x - g.focus.x) * k; g.focus.y = (g.focus.y || 0) + ((t.y || 0) - (g.focus.y || 0)) * k; g.focus.z += (t.z - g.focus.z) * k;
    g.dist += (t.dist - g.dist) * k; g.pitch += (t.pitch - g.pitch) * k; g.yaw += (0 - g.yaw) * k;
    L.flown = Math.hypot(t.x - g.focus.x, t.z - g.focus.z) < 0.3 && Math.abs(t.dist - g.dist) < 0.5;
    if (L.flown) L.target = { ...t, done: true };
  };
  // progressive meshes: give the url to things the camera is close to (a few per frame), nearest first
  function loadNear(w, g) {
    if (!w) return;
    const r = g.dist * 0.9 + 6, f = g.focus;
    const near = Object.values(w.libView.entities).filter(e => e.urlLater && !e.url && Math.hypot(e.x - f.x, e.z - f.z) < r).sort((a, b) => Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z)).slice(0, 4);
    if (!near.length) return;
    const entities = { ...w.libView.entities };
    for (const e of near) entities[e.id] = { ...e, url: e.urlLater };
    w.libView = { ...w.libView, entities };
    w.sync(w.libView);
  }
  L.loaded = () => { const w = app.worlds.get(L.cur); if (!w) return null; const es = Object.values(w.libView.entities); return { total: es.length, withUrl: es.filter(e => e.url).length, drawn: [...w.recs.values()].filter(r => r.visual && !r.visual.userData?.placeholder).length }; };

  // ---------- picking, selecting, copying, dragging out ----------
  L.pick = (cx, cy) => {
    const w = app.worlds.get(L.cur); if (!w) return null;
    const ray = app.rayAt(cx, cy, app.pip);
    w.layers.things.updateMatrixWorld(true);
    // the nearest hit that belongs to a thing (selection glows, hulls and other helpers are not things)
    let e = null;
    for (const hit of ray.intersectObjects(w.layers.things.children, true)) {
      if (hit.object.userData?.noPick || hit.object.userData?.halo) continue;
      let o = hit.object; while (o && !o.userData?.entityId) o = o.parent;
      if (o && w.libView.entities[o.userData.entityId]) { e = w.libView.entities[o.userData.entityId]; break; }
    }
    return e ? catOf(e) : null;
  };
  const catOf = (e) => ({ id: e.cat, sku: e.sku, name: e.name, place: e.place, entity: e });
  L.select = (cat) => {
    L.sel = cat;
    if (!cat) { app.refresh(); return; }
    app.clearSelection();
    // (a pick does not move the camera: the thing stays under the pointer for a drag; F over the PiP frames it)
    app.refresh();
  };
  L.selection = () => L.shown() ? L.sel : null;
  // the whole knolled layout, fitted to the PiP's shape (top-down: x across, z up the screen)
  L.overview = (w) => {
    const [sx, sz] = w.lay.size, cam = app.pip?.camera, aspect = cam ? cam.aspect || 1.2 : 1.2, k = 1 / (2 * Math.tan(THREE.MathUtils.degToRad((cam?.fov || 45) / 2)));
    return { x: sx / 2, y: 0, z: sz / 2, dist: Math.max(sz, sx / aspect) * k * 1.12 + 4, pitch: 88 };
  };
  // the person took the PiP's camera (drag, wheel, pinch): stop flying it
  L.touched = () => { L.target = null; };
  L.hov = null;
  L.hoverAt = (x, y) => { const c = x == null || !L.shown() ? null : L.pick(x, y); const id = c?.entity.id || null; if (id !== L.hov) { L.hov = id; app.refresh(); } };
  L.focus = (cat, sku = null) => { const w = app.worlds.get(L.cur), slot = w && (w.lay.slots.get(`${cat}|${sku}`) || w.lay.slots.get(cat)); if (!slot) return false; L.target = { x: slot.x, y: 0, z: slot.z + 0.3, dist: THREE.MathUtils.clamp(slot.size * 2.8 + 6, 8, 34), pitch: 88 }; L.flown = false; return true; };
  L.deco = () => ({ selected: new Set(L.sel ? [L.sel.entity.id] : []), hover: L.hov && L.hov !== L.sel?.entity.id ? L.hov : null, color: app.myColor(), style: 'halo', pending: new Set() });
  L.clip = () => { const e = L.sel?.entity; return e ? { v: 1, items: [{ kind: 'object', e: { ...e, url: e.urlLater, urlLater: undefined, y: 0, tiltZ: undefined, tiltX: undefined, libK: undefined, id: 'obj_libclip01' }, dx: 0, dz: 0 }] } : null; };
  // after a drag out of the shelves, the Build menu's own tool comes back
  L.restoreTool = () => app.build?.applyTool({ keepView: true });
  L.slotOf = (cat) => app.worlds.get(L.cur)?.lay.slots.get(cat) || null;
  // (tests) where a shelf item is on screen inside the PiP, and what the PiP is doing
  L.screenOf = (cat) => { const s = L.slotOf(cat); if (!s || !app.pip) return null; return app.screenOf(s.x, s.z, app.pip, s.y + Math.min(1.2, s.size / 3)); };
  L.info = () => ({ even: even(), area: L.cur, shown: L.shown(), target: L.target, flown: !!L.flown, sel: L.sel?.id || null, focus: app.pip ? [+app.pip.grab.focus.x.toFixed(2), +app.pip.grab.focus.z.toFixed(2)] : null });
  return L;
}

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1).replace(/-/g, ' ') : s;

// a label's width on the plane at world height h (the same font and padding as textPlane draws)
const meas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
function textWidth(text, h, head = false) { if (!meas) return text.length * h * 0.55; meas.font = `${head ? 750 : 600} 52px Inter, system-ui, sans-serif`; return h * (Math.ceil(meas.measureText(text).width) + 20) / 68; }
// a long name on two lines (split at the space nearest the middle) when one line would be much wider than its thing
function wrapLabel(text, h, room) {
  if (textWidth(text, h) <= room * 1.15 || !text.includes(' ')) return [text];
  const sp = [...text].map((c, i) => c === ' ' ? i : -1).filter(i => i > 0);
  const mid = sp.sort((a, b) => Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2))[0];
  return [text.slice(0, mid), text.slice(mid + 1)];
}
// a label lying on the plane (read from the top-down camera): small, quiet, left-aligned section heads
function textPlane({ text, x, z, h = 0.45, left = false, head = false }) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const fs = 52, font = `${head ? 750 : 600} ${fs}px Inter, system-ui, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 20; c.width = w; c.height = fs + 16;
  g.font = font; g.fillStyle = head ? '#3c3a34' : '#4a4740'; g.textBaseline = 'middle'; g.fillText(text, 10, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const pw = h * w / c.height, m = new THREE.Mesh(new THREE.PlaneGeometry(pw, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(left ? x + pw / 2 : x, 0.02, z);
  m.userData.noPick = true; m.userData.label = { w: pw, h, text }; m.renderOrder = 2;
  return m;
}
