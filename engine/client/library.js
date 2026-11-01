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
import { factionPieceName } from '../core/faction-catalog.js';
import { AreaWorld } from './world.js';
import { T } from './tuner.js';
import { libraryContents, handPlaceable, poseOf } from './library-index.js';
import { tileSize } from './tiles.js';
import { SOLVER_OPTS } from '../core/roomgen.js';

const gapOf = (size) => Math.max(0.7, Math.min(2.4, size * 0.35)); // evenly spaced BY SIZE: small things sit close
const PLANE = '#b5b1a7', BG = '#2a2b27';
// A TRIAL (Harry 2026-10-11: "In the object libraries, let's try making all objects the same size instead of having the
// relative sizes correctly."): every thing is drawn so the longer side of its footprint from above is EVEN_FT, so a cup
// is as easy to see and to grab as a wardrobe. Only the library's picture of a thing changes (entity.libK, a drawing
// scale the world applies to library things only); what is dragged or copied out is the thing at its true size.
// THE SWITCH: Settings > Me > Interface > "Library: everything the same size" (pref libEven; off = true relative sizes,
// as before). LIB_EVEN is what a browser that never chose gets.
export const LIB_EVEN = true, EVEN_FT = 3;
// the opening view keeps a label at least this tall on screen (a 3-ft thing's label is LABEL_FT tall: cellOf below)
const LABEL_PX = 11, LABEL_FT = 0.6;
const UP_H = 1.15;
// THE LIBRARY'S LENS (2026-10-29): a narrow one, nearly a plan view, so a thing standing up does not lean over its
// neighbours in the PiP's perspective. With the game's 45-degree lens, from 25 ft up, a stool or a pillar 10 ft off the
// middle showed its whole side and read as "tipped onto its side" (Gemini), though it stood. Distances scale with the
// lens (DK): the same framing, from further away.
export const LIB_FOV = 15;
const DK = Math.tan(THREE.MathUtils.degToRad(22.5)) / Math.tan(THREE.MathUtils.degToRad(LIB_FOV / 2));


export function createLibrary(app, { taxonomy, renderer }) {
  const L = { worlds: new Map(), cur: null, target: null, sel: null, prevPip: null };
  // the PiP's lens: the library's (LIB_FOV) while it shows a library, else the game's 45 degrees
  const lens = (on) => { const v = app.pip; if (!v) return; const f = on ? LIB_FOV : 45; if (v.camera.fov !== f) { v.camera.fov = f; v.camera.updateProjectionMatrix(); } v.grab.maxDist = on ? 600 * DK : 600; };
  const factions = createFactionShelf(app);
  L.showFactions = () => { L.hide(); factions.show(); };
  L.hideFactions = factions.close;
  const libId = (roomKey) => `lib:${roomKey}`;
  const even = () => (app.prefs?.libEven ?? LIB_EVEN) !== false;

  // ---------- layout: sections of tidy rows; each thing lies the way it reads from above ----------
  function layoutFor(roomNode) {
    // WHAT it lists (library-index.js, shared with the node test), then each thing's catalog size (a thing with none is
    // left out: the node test fails on one)
    const recipe = T.types.find(t => t.key === roomNode.roomKey) || { slots: {} };
    const sections = libraryContents(roomNode, { lib: app.lib, recipe, usable: (k) => T.solver.skuUsable(k, SOLVER_OPTS), factionName: (cat, k) => factionPieceName(app.lib, cat, k) })
      .map(([k, title, list, opts]) => [k, title, list.map(it => { const size = it.place === 'tile' ? tileSize(app.lib, it.cat) : app.roomgen.sizeOf(it.cat, it.sku); return size && { ...it, sku: it.sku || size.sku, size }; }).filter(Boolean), opts]);
    const entities = {}, slots = new Map(), labels = [], evenNow = even();
    // 1. each thing's CELL: its top-down footprint and, below it, its label, at the label's real world size (two lines
    //    when a name is long), so no label can ever reach into a neighbour's cell (Harry 2026-10-04)
    const cellOf = (it) => {
      const [w0, h0, d0] = it.size.dims;
      // HOW IT LIES: as it is placed (library-index.js poseOf, 2026-10-29): standing as in a room, or on its back, face up,
      // as it hangs on a wall. (It lay whichever way showed the biggest silhouette from above: chairs and stairs on their
      // sides. And since 2026-10-25 a small tall thing, an apple core 3 ft across, would stand 5 ft and lean over its
      // neighbours in the PiP's perspective: so a thing standing is drawn no taller than UP_H x EVEN_FT, its footprint
      // that much smaller.) The same size for all (the trial above): k brings the longer side of the footprint (or the
      // height over UP_H) to EVEN_FT; 1 = true size
      const how = poseOf({ ...it, flat: it.size.flat }, it.size.dims);
      const k = evenNow ? EVEN_FT / Math.max(how === 'side' ? h0 : w0, how === 'back' ? h0 : d0, how === 'up' && !it.size.flat ? h0 / UP_H : 0, 0.02) : 1, w = w0 * k, h = h0 * k, d = d0 * k;
      const fw = how === 'side' ? h : w, fd = how === 'back' ? h : d;
      // (labels 2026-10-29: big enough to read in the PiP at its opening view, LABEL_PX below; 0.4 ft under a 3-ft thing
      //  was 4 px at the old whole-layout overview of a 128 x 108 ft library)
      const lh = Math.min(0.85, Math.max(0.5, 0.3 + Math.max(fw, fd) * 0.1));
      const lines = wrapLabel(it.label, lh, Math.max(fw, 3.2)), lw = Math.max(...lines.map(t => textWidth(t, lh)));
      const gut = gapOf(Math.max(fw, fd));
      return { it, how, k, fw, fd, w, h, d, lh, lines, cw: Math.max(fw, lw) + gut, cd: fd + 0.3 + lines.length * lh * 1.1 + gut };
    };
    // 2. each category: its cells shelf-packed into a near-square block, biggest first, title above
    const groups = [];
    for (const [, title, list, opts] of sections) {
      if (!list.length) continue;
      // (the kit keeps its own order, by wall family: library-index.js kitSections)
      const cells = opts?.ordered ? list.map(cellOf) : list.map(cellOf).sort((a, b) => b.cd - a.cd || b.cw - a.cw || (a.it.cat < b.it.cat ? -1 : 1));
      const area = cells.reduce((s, c) => s + c.cw * c.cd, 0), titleW = textWidth(title.toUpperCase(), 1.1, true) + 1;
      const target = Math.max(Math.sqrt(area) * 1.1, ...cells.map(c => c.cw), titleW);
      let x = 0, z = 0, rowD = 0, gw = 0;
      for (const c of cells) { if (x > 0 && x + c.cw > target) { x = 0; z += rowD; rowD = 0; } c.gx = x; c.gz = z; x += c.cw; gw = Math.max(gw, x); rowD = Math.max(rowD, c.cd); }
      groups.push({ title, cells, w: Math.max(gw, titleW), d: z + rowD + 2.4 }); // + the title band
    }
    // 3. the groups themselves, packed into one rectangle shaped like the PiP window, IN THEIR ORDER (2026-10-29: the
    //    room's things first, its factions, then floors and the kit; packed tallest first, the 90-piece walls section
    //    came first, top left, where the library opens)
    const GG = 3, total = groups.reduce((s, g) => s + (g.w + GG) * (g.d + GG), 0), aspect = 1.45;
    const outerW = Math.max(Math.sqrt(total * aspect), ...groups.map(g => g.w + GG));
    let ox = 0, oz = 0, shelfD = 0, maxX = 0;
    for (const g of groups) {
      if (ox > 0 && ox + g.w > outerW) { ox = 0; oz += shelfD + GG; shelfD = 0; }
      g.x = ox; g.z = oz; ox += g.w + GG; maxX = Math.max(maxX, ox - GG); shelfD = Math.max(shelfD, g.d);
    }
    for (const g of groups) {
      labels.push({ text: g.title.toUpperCase(), x: g.x, z: g.z + 0.8, h: 1.1, left: true, head: true });
      for (const c of g.cells) {
        const x0 = g.x + c.gx, z0 = g.z + 2.4 + c.gz, cx = x0 + c.fw / 2 + (c.cw - c.fw - gapOf(Math.max(c.fw, c.fd))) / 2, cz = z0 + c.fd / 2;
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
      w.labelsShown = undefined;
      w.libView = { entities: lay.entities, seq: (w.libView.seq || 0) + 1, order: 0, chat: [] };
      w.sync(w.libView);
      if (L.cur === w.areaId) { const s = L.sel && (lay.slots.get(`${L.sel.id}|${L.sel.sku}`) || lay.slots.get(L.sel.id)); if (L.sel) L.sel = s ? { ...L.sel, entity: lay.entities[s.id] } : null; L.hov = null; L.target = L.overview(w); L.flown = false; }
    }
    app.refresh?.();
  };
  // ---------- the PiP: show, fly, load as the camera looks ----------
  L.show = (roomNode, cat = null, sku = null, { keep = false } = {}) => {
    if (app.pipAllowed && !app.pipAllowed()) return; // (a phone: no picture-in-picture, so no shelves in one; main.js)
    factions.close();
    const w = worldFor(roomNode);
    if (!L.cur && app.pip && !app.pip.area.startsWith('lib:')) L.prevPip = { area: app.pip.area, follow: app.pip.follow };
    if (L.cur !== w.areaId || !app.pip || app.pip.area !== w.areaId) app.openLocalPip(w.areaId);
    lens(true);
    const same = keep && L.cur === w.areaId && !cat; // back from a drag-out: the camera stays where the person left it
    L.cur = w.areaId;
    if (same) { app.refresh(); return; }
    const slot = cat && (w.lay.slots.get(`${cat}|${sku}`) || w.lay.slots.get(cat));
    // a top-down camera, framing the item with a little of its neighbours (or the whole layout)
    if (slot) L.target = { x: slot.x, y: 0, z: slot.z + 0.3, dist: THREE.MathUtils.clamp(slot.size * 2.8 + 6, 8, 34) * DK, pitch: 88 };
    else L.target = L.overview(w); // opens framing ALL of it (Harry 2026-10-04); the meshes still arrive a few at a time
    L.flown = false;
    app.refresh();
  };
  L.hide = () => {
    if (!L.cur) return;
    L.cur = null; L.sel = null;
    lens(false); // (the PiP goes back to another area: the game's lens)
    if (L.prevPip && app.pipAllowed?.() !== false) { app.openPip(L.prevPip.area, L.prevPip.follow); L.prevPip = null; } else { L.prevPip = null; app.closePip(); } // (a phone: nothing to restore)
  };
  L.shown = () => !!(L.cur && app.pip?.area === L.cur);
  L.frame = (dt) => {
    if (!L.shown()) return;
    lens(true);
    const g = app.pip.grab, t = L.target;
    loadNear(app.worlds.get(L.cur), g);
    labelsFor(app.worlds.get(L.cur), g);
    if (!t) return; // the person is steering the PiP camera
    const now = performance.now(), real = Math.min(1, (now - (L.lastT || now)) / 1000); L.lastT = now; // real time: a slow frame rate flies as fast
    const k = 1 - Math.exp(-Math.max(dt, real) * 4);
    g.focus.x += (t.x - g.focus.x) * k; g.focus.y = (g.focus.y || 0) + ((t.y || 0) - (g.focus.y || 0)) * k; g.focus.z += (t.z - g.focus.z) * k;
    g.dist += (t.dist - g.dist) * k; g.pitch += (t.pitch - g.pitch) * k; g.yaw += (0 - g.yaw) * k;
    L.flown = Math.hypot(t.x - g.focus.x, t.z - g.focus.z) < 0.3 && Math.abs(t.dist - g.dist) < 0.5;
    if (L.flown) L.target = { ...t, done: true };
  };
  // a thing's label too small to read (zoomed far out: under 3.5 px) is not drawn; the section heads always are. (A full
  // library framed whole is ~550 label planes, one draw call each: 2026-10-29, the cave's 414 things at 30 fps)
  function labelsFor(w, g) {
    if (!w) return;
    const cam = app.pip.camera, hPx = app.pip.rect[3] * (renderer.domElement.clientHeight || 900), px = LABEL_FT * hPx / (g.dist * 2 * Math.tan(THREE.MathUtils.degToRad((cam.fov || 45) / 2)));
    const show = px >= 3.5; if (w.labelsShown === show) return; w.labelsShown = show;
    for (const m of w.layers.deco.children) if (m.userData.label && !m.userData.label.head) m.visible = show;
  }
  // progressive meshes: give the url to things the camera is close to (a few per frame), nearest first
  function loadNear(w, g) {
    if (!w) return;
    const r = g.dist * 0.9 / DK + 6, f = g.focus; // (what the lens shows, and a little more)
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
  // (2026-10-29, the open item "the overview is too far out to read labels": a 128 x 108-ft library was framed from
  //  177 ft, its labels 4 px tall. The opening view is now as far out as keeps a thing's label LABEL_PX tall in the PiP
  //  window: the whole layout when it fits, else its top left corner, where the room's own things are; the wheel, a
  //  pinch or the Build menu go further)
  L.overview = (w, { whole = false } = {}) => {
    const [sx, sz] = w.lay.size, cam = app.pip?.camera, aspect = cam ? cam.aspect || 1.2 : 1.2, t2 = 2 * Math.tan(THREE.MathUtils.degToRad((cam?.fov || 45) / 2)), k = 1 / t2;
    const all = Math.max(sz, sx / aspect) * k * 1.12 + 4, hPx = app.pip ? app.pip.rect[3] * (renderer.domElement.clientHeight || 900) : 380;
    const near = (LABEL_FT * hPx / LABEL_PX) / t2; // the distance at which a label LABEL_FT tall is LABEL_PX on screen
    if (all <= near || whole) return { x: sx / 2, y: 0, z: sz / 2, dist: all, pitch: 88 };
    const vh = near * t2, vw = vh * aspect; // what that distance shows, in feet
    return { x: Math.min(sx, vw) / 2, y: 0, z: Math.min(sz, vh) / 2 - 0.5, dist: near, pitch: 88, part: true };
  };
  // (tests, and a later "show all") fly out to frame the whole layout
  L.frameAll = () => { const w = app.worlds.get(L.cur); if (!w) return false; L.target = L.overview(w, { whole: true }); L.flown = false; app.refresh(); return true; };
  // the person took the PiP's camera (drag, wheel, pinch): stop flying it
  L.touched = () => { L.target = null; };
  L.hov = null;
  L.hoverAt = (x, y) => { const c = x == null || !L.shown() ? null : L.pick(x, y); const id = c?.entity.id || null; if (id !== L.hov) { L.hov = id; app.refresh(); } };
  L.focus = (cat, sku = null) => { const w = app.worlds.get(L.cur), slot = w && (w.lay.slots.get(`${cat}|${sku}`) || w.lay.slots.get(cat)); if (!slot) return false; L.target = { x: slot.x, y: 0, z: slot.z + 0.3, dist: THREE.MathUtils.clamp(slot.size * 2.8 + 6, 8, 34) * DK, pitch: 88 }; L.flown = false; return true; };
  L.deco = () => ({ selected: new Set(L.sel ? [L.sel.entity.id] : []), hover: L.hov && L.hov !== L.sel?.entity.id ? L.hov : null, color: app.myColor(), style: 'halo', pending: new Set() });
  L.clip = () => { const e = L.sel?.entity; return e ? { v: 1, items: [{ kind: 'object', e: { ...e, url: e.urlLater, urlLater: undefined, y: 0, tiltZ: undefined, tiltX: undefined, libK: undefined, id: 'obj_libclip01' }, dx: 0, dz: 0 }] } : null; };
  // after a drag out of the shelves, the Build menu's own tool comes back
  L.restoreTool = () => app.build?.applyTool({ keepView: true });
  L.slotOf = (cat) => app.worlds.get(L.cur)?.lay.slots.get(cat) || null;
  // (tests) where a shelf item is on screen inside the PiP, and what the PiP is doing
  L.screenOf = (cat) => { const s = L.slotOf(cat); if (!s || !app.pip) return null; return app.screenOf(s.x, s.z, app.pip, s.y + Math.min(1.2, s.size / 3)); };
  // (tests, and "is it on a shelf?") every room's library laid out (no meshes, no worlds), against what the command bar
  // can place with the live ratings: what is in no library area (library-index.js; should be nothing)
  L.coverage = () => {
    const use = (k) => T.solver.skuUsable(k, SOLVER_OPTS), rooms = [...taxonomy.nodes.values()].filter(n => n.level === 'room'), cats = new Set(), skus = new Set();
    for (const n of rooms) for (const e of Object.values(layoutFor(n).entities)) { cats.add(e.cat); skus.add(`${e.cat}|${e.sku}`); }
    const all = handPlaceable(app.lib, use), missing = all.filter(p => p.kind === 'faction' ? !skus.has(`${p.id}|${p.sku}`) : !cats.has(p.id));
    return { rooms: rooms.length, keys: new Set(rooms.map(n => n.roomKey)).size, placeable: all.length, missing: missing.map(p => `${p.kind}:${p.id}${p.sku ? '/' + p.sku : ''}`) };
  };
  L.info = () => ({ even: even(), area: L.cur, shown: L.shown(), target: L.target, flown: !!L.flown, sel: L.sel?.id || null, focus: app.pip ? [+app.pip.grab.focus.x.toFixed(2), +app.pip.grab.focus.z.toFixed(2)] : null });
  return L;
}

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
  m.userData.noPick = true; m.userData.label = { w: pw, h, text, ...(head && { head: true }) }; m.renderOrder = 2;
  return m;
}
