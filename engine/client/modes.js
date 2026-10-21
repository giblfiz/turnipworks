// Modes: placing a catalog thing (a ghost on the cursor with the asset's placement semantics), the room tool and the
// building tool (drag a rectangle on the 5-ft grid). Each ends in one dispatch. Esc cancels; Shift keeps placing.
// A mode chosen from the Build menu is a TOOL: it stays until Esc or another tool (mode.tool = true).
//   floor items   snap to a half-foot grid (Alt: free)
//   wall items    back against the nearest wall, facing into the room; hung things at hanging height
//   surface items onto the tabletop under the cursor (parent = that object; the tuner's settle.js finishes the
//                 contact with gravity), else the floor
//   ceiling items up at the ceiling
//   floor tiles   (client/tiles.js) onto 5-ft cells; a PAINT tool: click a cell, drag a run across cells, Shift-drag a
//                 rectangle; each stroke is one command (one undo step). It stays until Esc, like a Build tool.
//   rugs          (flat floor things) just above the floor and its tiles, as the tuner lays them (y 0.03+)
import * as THREE from 'three';
import { newId } from '../core/ids.js';
import { T } from './tuner.js';
import * as HT from '../core/height.js';
import { levelSuffix } from '../core/footprint.js';
import { stairPlacement } from './stairs.js';
import * as ST from '../core/stairs.js';
import { cellOf as tileCell, centre, runCells, rectCells, paintOps, tileVisual, TILE } from './tiles.js';

const CELL = 5, CEIL = 9;
// corner and jamb posts, pillars, and the other pieces that stand on a point rather than along an edge (a fence's corner
// post, a drystone pier, a hedge's corner and end block, the wall kit's corner pieces)
export const POST = /^(post-timber|pillar-square|fence-post-corner|wall-drystone-pier|hedge-corner|hedge-end-block|wall-corner-inner|wall-corner-outer)$/;
// WHERE A POST SNAPS (Harry 2026-10-05): to the nearest of the grid's CROSSES (where grid lines meet: a cell's corners,
// where a corner post belongs) and the MIDPOINTS of cell edges (where a wall piece sits). Nearest wins. Shift: free.
export function postSnap(x, z) {
  const H = CELL / 2, sx = Math.round(x / H) * H, sz = Math.round(z / H) * H;
  const mid = (v) => Math.abs(((v % CELL) + CELL) % CELL - H) < 1e-6; // an odd multiple of 2.5: mid-cell on that axis
  if (!(mid(sx) && mid(sz))) return [sx, sz];
  // the nearest 2.5-ft point is a cell CENTRE (not a target): step to the nearer line on the axis that is further off
  const alt = (v, s) => s + (v >= s ? H : -H);
  return Math.abs(x - sx) >= Math.abs(z - sz) ? [alt(x, sx), sz] : [sx, alt(z, sz)];
}

export function createModes(app) {
  const M = {};
  let ghost = null, rectMesh = null, label = null;
  const sizeLabel = document.getElementById('modeLabel');
  let wholeLit = null; // the room lit while a floor is dragged over it (showWhole, below)

  function clearGhost() { if (wholeLit) { app.worlds.get(app.area())?.clearCells('floor-drop'); wholeLit = null; sizeLabel.hidden = true; } if (ghost) { ghost.parent?.remove(ghost); ghost = null; } if (rectMesh) { rectMesh.parent?.remove(rectMesh); rectMesh = null; } clearPaint(); app.pawnTool?.clear(); app.pickTool?.clear(); app.worlds.get(app.area())?.clearCells('room-tool'); app.worlds.get(app.area())?.clearCells('level-valid'); sizeLabel.hidden = true; }
  M.cancel = () => { clearGhost(); app.mode = null; app.refresh(); };

  // ---------- place ----------
  M.place = (cat, { keep = false, viaDrag = false, tool = false } = {}) => {
    clearGhost();
    const size = app.roomgen.sizeOf(cat.id, cat.sku);
    if (!size) { app.toast(`No usable mesh for ${cat.name}`, true); return; }
    app.mode = { kind: 'place', cat, size, rot: 0, keep: keep || tool || cat.place === 'tile', viaDrag, tool };
    ghost = new THREE.Group();
    const stand = app.assets.placeholder(size.dims); ghost.add(stand);
    app.assets.visualFor({ ...size, cat: cat.id, dims: size.dims, place: cat.place }).then(v => { if (!v || !ghost) return; ghost.remove(stand); ghost.add(v); fade(ghost); }).catch(() => {});
    fade(ghost);
    app.worldOf(app.area()).layers.deco.add(ghost);
    ghost.visible = false;
    app.refresh();
  };
  function fade(g) { g.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.depthWrite = false; o.userData.noPick = true; } }); }

  // where a thing of this catalog entry would go for a pointer ray (the placement semantics)
  // free (Shift while dragging a wall, door, window or post; Harry 2026-10-05): no snapping at all, it goes where the pointer is
  M.placementAt = (cat, size, ray, ground, { alt = false, rot = 0, exclude = new Set(), free = false } = {}) => {
    if (!ground) return null;
    // fy: the height of the floor under the pointer (ground.y, from world.floorPoint): everything below is counted from it
    const fy = ground.y || 0;
    let [x, z] = ground, y = fy, parent = null;
    const [w, h, d] = size.dims;
    const place = cat.place || size.place || 'floor';
    const world = app.worldOf(app.area());
    if (place === 'wall') {
      const near = nearestWall(world, x, z, fy);
      if (near) ({ x, z, rot } = near.at(d));
      const o = app.lib.objects[cat.id];
      if (o && T.solver.isHung(o, cat.id)) y = fy + Math.max(0, 4.6 - h / 2);
    } else if (place === 'surface') {
      const s = world.surfaceAt(ray, exclude, fy);
      if (s) { x = s.point.x; z = s.point.z; y = s.point.y; parent = s.parent; }
    } else if (place === 'ceiling') { y = fy + Math.max(0, CEIL - h); }
    if (place === 'stair') return stairPlacement(app, size, x, z, rot, fy); // whole squares, a quarter turn, on the floor under the pointer
    // a stair of the catalog (the grand stair, a spiral, a flight; core/stairs.js STAIR_ROLES) goes down the same way,
    // so the hole it opens in the floor above is exactly its own squares. Before 2026-10-11 it snapped onto a grid
    // LINE like a wall piece. A ladder keeps going against a wall.
    if (place === 'kit' && !free && ST.STAIR_ROLES[cat.id]) return stairPlacement(app, size, x, z, rot, fy);
    let edge = null;
    if (place === 'kit' && free) { return { x: r2(x), y: fy, z: r2(z), rot, parent: null, room: app.roomAt(x, z, fy)?.id || null, edge: null, free: true }; }
    if (place === 'kit' && POST.test(cat.id || '')) { y = fy; [x, z] = postSnap(x, z); } // a post or pillar: the grid's crosses and the edge midpoints, nearest wins
    else if (place === 'kit') { // walls, doors, windows: onto the nearest 5-ft grid edge, along its line (so pieces meet end to end)
      const hz = Math.round(z / CELL), vx = Math.round(x / CELL);
      if (Math.abs(z - hz * CELL) <= Math.abs(x - vx * CELL)) { const gx = Math.floor(x / CELL); x = gx * CELL + CELL / 2; z = hz * CELL; rot = 0; edge = `h:${gx}:${hz}${levelSuffix(fy)}`; }
      else { const gz = Math.floor(z / CELL); x = vx * CELL; z = gz * CELL + CELL / 2; rot = Math.PI / 2; edge = `v:${vx}:${gz}${levelSuffix(fy)}`; }
      y = fy;
    }
    if (place === 'tile') { const [gx, gz] = tileCell(x, z); return { x: centre(gx), y: fy, z: centre(gz), rot: 0, parent: null, room: app.roomAt(centre(gx), centre(gz), fy)?.id || null, edge: null, cell: [gx, gz] }; }
    if (place === 'floor' && size.flat && !parent) y = Math.max(y, fy + 0.04); // a rug lies over the floor tiles (they are at 0.02), not under them
    if (place !== 'wall' && place !== 'kit' && !parent && !alt) { x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2; }
    return { x: r2(x), y: r2(y), z: r2(z), rot, parent, room: app.roomAt(x, z, fy)?.id || null, edge };
  };
  function nearestWall(world, x, z, fy = 0) {
    let best = null;
    for (const e of world.edges?.values() || []) {
      if (e.kind === 'door' || e.kind === 'door-span' || (e.y || 0) !== fy) continue; // the walls of the storey the pointer is on
      const h = e.dir === 'h';
      const a0 = (h ? e.gx : e.gz) * CELL, line = (h ? e.gz : e.gx) * CELL;
      const along = h ? x : z, across = h ? z : x;
      const t = Math.max(a0 + 0.3, Math.min(a0 + CELL - 0.3, along));
      const dist = Math.hypot(along - t, across - line);
      if (dist < 6 && (!best || dist < best.dist)) best = { dist, h, line, t, side: Math.sign(across - line) || 1 };
    }
    if (!best) return null;
    return { ...best, at: (depth) => {
      const off = 0.5 + depth / 2;
      return best.h ? { x: best.t, z: best.line + best.side * off, rot: best.side > 0 ? 0 : Math.PI } : { x: best.line + best.side * off, z: best.t, rot: best.side > 0 ? Math.PI / 2 : -Math.PI / 2 };
    } };
  }
  M.placeAt = (ray, ground, ev) => {
    const m = app.mode; if (m?.kind !== 'place') return;
    if (m.pick) return app.pickTool.placeAt(ray, ground, ev);
    if (m.pawn) return app.pawnTool.placeAt(ray, ground, ev); // a figure, or a group of them (client/pawns.js)
    const p = M.placementAt(m.cat, m.size, ray, ground, { alt: ev?.altKey, rot: m.rot });
    if (!p) return;
    if (m.cat.place === 'tile') {
      // A FLOOR DRAGGED ONTO A ROOM CHANGES THE WHOLE FLOOR (Harry 2026-10-11; surfaces/floordrop.js): only a drag out of
      // a list does this. The paint tool (a click, a stroke) lays tiles as ever, and so does a drop that is not on a room.
      const room = m.viaDrag ? M.floorWholeAt(m.cat, p) : null;
      if (room) { app.floorDrop.whole(room, m.cat, p, m.size); M.cancel(); return; }
      M.paintCells([p.cell], p.y); if (!(ev?.shiftKey || m.keep)) M.cancel(); return;
    }
    const s = M.fitted(m.cat, m.size);
    // a wall, door or window placed onto an edge that has a generated piece takes that piece's place
    app.batch([M.edgeTaken(p.edge), { type: 'object.place', args: { id: newId('obj'), name: m.cat.name, ...(m.cat.id.startsWith('flavor-') && { flavor: app.lib.objects[m.cat.id]?.skus.find(k => k.sku === s.sku)?.shape }), cat: m.cat.id, sku: s.sku, url: s.url, flat: s.flat || undefined, place: m.cat.place, layer: m.cat.place === 'kit' && !ST.STAIR_ROLES[m.cat.id] ? (/^door-/.test(m.cat.id) ? 'openings' : 'walls') : 'furnish', x: p.x, y: p.y, z: p.z, rot: p.rot, yaw: s.yaw, s: s.s || undefined, dims: s.dims, parent: p.parent || undefined, room: p.room || undefined } }]);
    if (!(ev?.shiftKey || m.keep)) M.cancel();
  };

  // the room whose WHOLE floor a floor dropped at `p` would change, or null (then it is laid as one tile, as before):
  // the drop is on a room, the room is not locked, this seat may change rooms, the material is one a room can wear,
  // and the room's own floor is another material. (Tiles painted by hand are never touched by the drop: Harry 2026-10-11,
  // "let's keep hand painted floor tiles". A room that already wears the material takes the drop as one tile.)
  const roomTiles = (room) => Object.values(app.entities()).filter(e => e.kind === 'object' && e.place === 'tile' && (e.room ? e.room === room.id : app.roomAt(e.x, e.z, e.y || 0)?.id === room.id));
  M.roomTiles = roomTiles;
  M.floorWholeAt = (cat, p) => {
    const room = p?.room ? app.ent(p.room) : null;
    if (!room || room.kind !== 'room' || room.locked || !app.can('room') || !app.roomgen.floors.includes(cat.id)) return null;
    return app.roomgen.floorFor(room.recipe) !== cat.id ? room : null;
  };
  // while such a drag is over a room, the room's squares are lit (the room whose floor will change) and the label says so
  function showWhole(room, p, ev) {
    const w = app.worldOf(app.area()), rc = room?.recipe;
    if (!room) { if (wholeLit) { w.clearCells('floor-drop'); wholeLit = null; if (app.mode?.viaDrag && app.mode.cat?.place === 'tile') sizeLabel.hidden = true; } return; }
    if (wholeLit !== room.id) { w.showCells('floor-drop', { lit: app.footprint.cellsOf(rc).map(([i, j]) => [rc.x + i, rc.z + j]), color: app.myColor(), y: rc.y || 0, opacity: 0.2 }); wholeLit = room.id; }
    if (ev?.clientX != null) { sizeLabel.hidden = false; sizeLabel.classList.remove('bad'); sizeLabel.textContent = `Whole floor · ${app.nameOf(room)}`; sizeLabel.style.left = `${ev.clientX + 40}px`; sizeLabel.style.top = `${ev.clientY + 40}px`; }
  }
  M.floorDropInfo = () => ({ lit: wholeLit }); // (tests)

  // ---------- floor tiles: paint ----------
  // a press starts a stroke; the cells it crosses (or, with Shift, the rectangle from the first cell) are previewed and
  // laid in ONE command on release
  const tileMode = () => app.mode?.kind === 'place' && app.mode.cat.place === 'tile';
  M.isPaint = tileMode;
  M.paintDown = (ground, ev) => {
    if (!tileMode() || !ground) return false;
    const c = tileCell(ground[0], ground[1]);
    app.mode.paint = { start: c, last: c, run: new Map([[c.join(':'), c]]), rect: !!ev?.shiftKey, y: ground.y || 0 };
    showPaint(); return true;
  };
  M.paintMove = (ground, ev) => {
    const p = tileMode() && app.mode.paint; if (!p || !ground) return;
    const c = tileCell(ground[0], ground[1]);
    p.rect = !!ev?.shiftKey; p.cur = c;
    if (c[0] !== p.last[0] || c[1] !== p.last[1]) { for (const x of runCells(p.last, c)) p.run.set(x.join(':'), x); p.last = c; }
    if (ghost) { ghost.visible = true; ghost.position.set(centre(c[0]), p.y || 0, centre(c[1])); }
    showPaint(ev);
  };
  M.paintUp = (ev) => {
    const p = tileMode() && app.mode.paint; if (!p) return;
    app.mode.paint = null;
    const cells = paintCellsOf(p);
    clearPaint();
    M.paintCells(cells, p.y || 0); // the paint tool stays until Esc (or another tool)
  };
  const paintCellsOf = (p) => p.rect ? rectCells(p.start, p.cur || p.last, 1500) : [...p.run.values()].slice(0, 1500);
  M.paintCells = (cells, y = 0) => {
    const m = app.mode; if (!m || m.cat.place !== 'tile') return null;
    const ops = paintOps(app, m.cat.id, cells, { size: m.size, y });
    return ops.length ? app.batch(ops) : null;
  };
  M.paintInfo = () => { const p = tileMode() && app.mode.paint; return p ? { cells: paintCellsOf(p).length, rect: p.rect } : null; };
  // the stroke's preview: one translucent plate per cell, in my colour
  let plates = null;
  const plateGeo = new THREE.PlaneGeometry(TILE - 0.3, TILE - 0.3).rotateX(-Math.PI / 2);
  function showPaint(ev) {
    const p = app.mode?.paint; if (!p) return;
    const cells = paintCellsOf(p);
    if (!plates) { plates = new THREE.Group(); plates.renderOrder = 25; app.worldOf(app.area()).layers.deco.add(plates); }
    const mat = plates.userData.mat || (plates.userData.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32, depthTest: false }));
    mat.color.set(app.myColor());
    while (plates.children.length > cells.length) plates.remove(plates.children[plates.children.length - 1]);
    while (plates.children.length < cells.length) { const m = new THREE.Mesh(plateGeo, mat); m.renderOrder = 25; m.userData.noPick = true; plates.add(m); }
    cells.forEach(([gx, gz], i) => plates.children[i].position.set(centre(gx), (p.y || 0) + 0.12, centre(gz)));
    if (ev) { sizeLabel.hidden = false; sizeLabel.textContent = p.rect ? `${cells.length} tiles · ${Math.abs((p.cur || p.last)[0] - p.start[0]) + 1} × ${Math.abs((p.cur || p.last)[1] - p.start[1]) + 1}` : `${cells.length} tile${cells.length === 1 ? '' : 's'}`; sizeLabel.style.left = `${ev.clientX + 40}px`; sizeLabel.style.top = `${ev.clientY + 40}px`; }
  }
  function clearPaint() { if (plates) { plates.parent?.remove(plates); plates = null; } sizeLabel.hidden = true; }

  // the generated piece on this edge, if any, hidden (a hand-placed or moved piece takes its place)
  M.edgeTaken = (key, except = null) => { if (!key || key === except) return null; const sh = app.worldOf(app.area()).shell; return sh?.has(key) || sh?.has(key + ':door') ? { type: 'edge.set', args: { key, as: 'open' } } : null; };
  // doors fit the opening of one grid edge (as generated doors do: the 5-ft span less the jamb posts)
  M.fitted = (cat, size) => {
    if (!/^door-/.test(cat.id || '') || !size?.dims) return size;
    const k = (CELL - 8 / 12) / size.dims[0];
    return { ...size, dims: size.dims.map(v => v * k), s: (size.s || [1, 1, 1]).map(v => v * k) };
  };

  // ---------- room tool ----------
  M.roomTool = (type, { tool = false } = {}) => { clearGhost(); app.mode = { kind: 'room', type, start: null, rect: null, tool }; if (!tool) app.toast(`Drag a rectangle for the ${app.roomgen.typeList.find(t => t.key === type)?.label.toLowerCase() || type} (Esc cancels)`); app.refresh(); };
  // the building tool: a Type from the Build menu; the rectangle becomes that type's rooms (client/pack.js)
  M.buildingTool = (node) => { clearGhost(); app.mode = { kind: 'building', type: node.code, node, start: null, rect: null, tool: true }; app.refresh(); };
  const rectKind = (m) => m?.kind === 'room' || m?.kind === 'building';
  const cellOf = (g) => [Math.floor(g[0] / CELL), Math.floor(g[1] / CELL)];
  M.roomDown = (ground) => { const m = app.mode; if (!rectKind(m) || !ground) return false; m.start = cellOf(ground); M.roomMove(ground); return true; };
  // THE ROOM TOOL DRAWN OVER EXISTING ROOMS (Harry 2026-10-05: "If I drag out a new room that overlaps, we are just going
  // to make whatever sections of it don't overlap into a room; this will probably mostly cause L-shaped rooms").
  // What the dragged rectangle would become, worked out on every move (core/footprint.js piecesOf):
  //   rect    nothing in the way: the rectangle, as always
  //   shape   it overlaps: the part that does not (an L from a corner overlap, a U or a notched side from a room poking in)
  //   split   an existing room cuts it into separate pieces: the LARGER piece becomes the room (equal: the one the drag
  //           started in). One drag makes one room: one undo, one label, one type; the other piece is a second drag.
  //   inside  wholly inside existing rooms: nothing to make (refused, and said so)
  //   hole    it would wrap right round a room: not a shape a room can have yet (refused, and said so)
  // While dragging, the cell indicator (world.showCells) lights the squares that WILL become the room and marks the
  // squares asked for but taken.
  // ON A LEVEL (storeys, Stage B): the rooms in the way are the ones whose height overlaps the new room's; and above the
  // ground a square must be CARRIED: over a room below, or up to two squares out from one (core/height.js supportAt, the
  // very test the relay applies). Squares that are too far out are treated like taken squares: marked, and left out.
  M.roomPlan = (rect, start = null, level = app.level || 0) => {
    const ents = app.entities(), FP = app.footprint, top = level + app.levelInfo(level).step;
    const rooms = Object.values(ents).filter(r => r.kind === 'room' && HT.spansOverlap(level, top, HT.roomY(r.recipe), HT.roomTop(ents, r)));
    const S = level > 0 ? HT.supportAt(ents, level) : null, far = [];
    if (S) for (let gz = rect.z; gz < rect.z + rect.d; gz++) for (let gx = rect.x; gx < rect.x + rect.w; gx++) if (!S.ok(gx, gz)) far.push([gx, gz]);
    if (S && (!S.any || far.length === rect.w * rect.d)) return { kind: 'unsupported', ok: false, lit: [], dim: far, overName: '', far: far.length };
    const { pieces, covered } = FP.piecesOf(rect, [...rooms.map(r => r.recipe), ...far.map(([x, z]) => ({ x, z, w: 1, d: 1 }))]);
    const cells = (p) => p.world, all = () => { const out = []; for (let gz = rect.z; gz < rect.z + rect.d; gz++) for (let gx = rect.x; gx < rect.x + rect.w; gx++) out.push([gx, gz]); return out; };
    const over = covered.length ? rooms.find(r => covered.some(([gx, gz]) => FP.hasCell(r.recipe, gx, gz))) : null, overName = over ? app.nameOf(over) : far.length ? 'the squares too far out to carry' : '';
    if (!covered.length) return { kind: 'rect', ok: true, piece: { ...rect, cells: rect.w * rect.d }, lit: all(), dim: [], overName };
    if (!pieces.length) return { kind: 'inside', ok: false, lit: [], dim: covered, overName };
    if (pieces.length > 1 && pieces[1].cells === pieces[0].cells && start && pieces[1].world.some(([gx, gz]) => gx === start[0] && gz === start[1])) [pieces[0], pieces[1]] = [pieces[1], pieces[0]];
    const p = pieces[0];
    if (p.hole) return { kind: 'hole', ok: false, lit: [], dim: [...covered, ...pieces.flatMap(cells)], overName };
    return { kind: pieces.length > 1 ? 'split' : 'shape', ok: true, piece: p, pieces: pieces.length, lit: cells(p), dim: [...covered, ...pieces.slice(1).flatMap(cells)], overName };
  };
  const planWords = (m) => {
    const P = m.plan, sq = (n) => `${n * 25} sq ft`;
    if (P.kind === 'rect') return `${m.rect.w * CELL} × ${m.rect.d * CELL} ft`;
    if (P.kind === 'shape') return `${sq(P.piece.cells)}: the part that does not overlap ${P.overName}`;
    if (P.kind === 'split') return `${P.overName} cuts it in ${P.pieces}: makes the larger part, ${sq(P.piece.cells)}`;
    if (P.kind === 'inside') return `all inside ${P.overName}: nothing to make`;
    if (P.kind === 'unsupported') return 'nothing to stand on here: build over the rooms below (up to 10 ft out)';
    return `would wrap right round ${P.overName}: can't`;
  };
  M.roomMove = (ground, ev) => {
    const m = app.mode; if (!rectKind(m) || !ground) return;
    const c = cellOf(ground), s = m.start || c;
    const x = Math.min(s[0], c[0]), z = Math.min(s[1], c[1]), w = Math.abs(c[0] - s[0]) + 1, d = Math.abs(c[1] - s[1]) + 1;
    const cap = m.kind === 'building' ? 24 : 16;
    m.rect = { x, z, w: Math.min(cap, w), d: Math.min(cap, d) };
    if (m.kind === 'room') { // the room tool: light the squares that will become the room
      m.plan = M.roomPlan(m.rect, m.start); m.ok = m.plan.ok; m.level = app.level || 0;
      if (rectMesh) { rectMesh.parent?.remove(rectMesh); rectMesh = null; }
      app.worldOf(app.area()).showCells('room-tool', { lit: m.plan.lit, dim: m.plan.dim, color: m.start ? app.myColor() : '#ffffff', y: m.level });
      if (ev) { sizeLabel.hidden = false; sizeLabel.textContent = m.start ? planWords(m) : 'drag a rectangle'; sizeLabel.classList.toggle('bad', !!m.start && !m.ok); sizeLabel.style.left = `${ev.clientX + 40}px`; sizeLabel.style.top = `${ev.clientY + 40}px`; }
      return;
    }
    // on the ground a whole building never clips: it needs its rectangle. Off the ground it takes the part that can be built on (app.buildableRect)
    const lvl = app.level || 0, clash = lvl === 0 ? Object.values(app.entities()).some(r => r.kind === 'room' && HT.roomY(r.recipe) < 10 && HT.roomTop(app.entities(), r) > 0 && app.footprint.overlap(r.recipe, m.rect)) : !app.buildableRect(m.rect, lvl);
    m.ok = !clash;
    if (!rectMesh) { rectMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28, depthTest: false })); rectMesh.rotation.x = -Math.PI / 2; rectMesh.renderOrder = 25; app.worldOf(app.area()).layers.deco.add(rectMesh); }
    rectMesh.material.color.set(m.ok ? (m.start ? app.myColor() : '#ffffff') : '#e5484d');
    rectMesh.scale.set(m.rect.w * CELL, m.rect.d * CELL, 1);
    rectMesh.position.set((x + m.rect.w / 2) * CELL, lvl + 0.1, (z + m.rect.d / 2) * CELL);
    if (ev) { sizeLabel.hidden = false; sizeLabel.classList.remove('bad'); sizeLabel.textContent = m.start ? `${m.rect.w * CELL} × ${m.rect.d * CELL} ft · ${app.packPreview(m.rect)} rooms${m.ok ? '' : ' · overlaps'}` : `drag out a ${m.node.label.toLowerCase()}`; sizeLabel.style.left = `${ev.clientX + 40}px`; sizeLabel.style.top = `${ev.clientY + 40}px`; }
  };
  M.roomUp = (ev) => {
    const m = app.mode; if (!rectKind(m) || !m.start) return;
    const { rect, ok, type } = m;
    m.start = null;
    if (m.kind === 'building') { if (ok && rect) app.spawnBuilding(m.node, rect); else app.toast('A building needs clear ground: its rooms cannot overlap others', true); }
    else if (rect && m.plan) {
      const P = m.plan; app.lastRoomPlan = { kind: P.kind, pieces: P.pieces || 1, cells: P.piece?.cells || 0, over: P.overName }; // (tests)
      if (P.kind === 'unsupported') app.toast('Nothing to stand on there: an upper room goes over the rooms below it, up to 10 ft out', true);
      else if (!P.ok) app.toast(P.kind === 'inside' ? `Nothing to make: that is all inside ${P.overName}` : `Can't make a room right round ${P.overName}. Draw it beside ${P.overName} instead`, true);
      else {
        const p = P.piece, id = app.spawnRoom(type, p.x, p.z, p.w, p.d, undefined, p.outline, m.level || 0);
        if (!m.tool) app.select(id);
        if (P.kind === 'shape') app.toast(`Made the part that does not overlap ${P.overName} (${p.cells * 25} sq ft)`);
        if (P.kind === 'split') app.toast(`${P.overName} cut it in ${P.pieces}: made the larger part (${p.cells * 25} sq ft). Drag again for the other`);
      }
    }
    if (rectMesh) { rectMesh.parent?.remove(rectMesh); rectMesh = null; }
    app.worlds.get(app.area())?.clearCells('room-tool'); sizeLabel.classList.remove('bad');
    if (!ev?.shiftKey && !m.tool) M.cancel();
    M.levelChanged();
  };

  // ---------- per pointer move: keep the ghost on the cursor ----------
  M.hover = (ray, ground, ev) => {
    const m = app.mode;
    if (m?.pick) return app.pickTool.hover(ray, ground, ev);
    if (m?.pawn) return app.pawnTool.hover(ray, ground, ev);
    if (m?.kind === 'place' && ghost) {
      const p = M.placementAt(m.cat, m.size, ray, ground, { alt: ev?.altKey, rot: m.rot });
      ghost.visible = !!p;
      if (p) { ghost.position.set(p.x, p.y, p.z); ghost.rotation.y = p.rot; }
      if (m.viaDrag && m.cat.place === 'tile') showWhole(p ? M.floorWholeAt(m.cat, p) : null, p, ev);
    }
    if (rectKind(m)) M.roomMove(ground, ev);
  };
  // the bar's preview on highlight: an asset's ghost where it would land in the middle of the view
  let pv = null;
  M.preview = (cat) => {
    if (pv) { pv.g.parent?.remove(pv.g); pv = null; }
    if (!cat || app.mode) return;
    const size = app.roomgen.sizeOf(cat.id, cat.sku); if (!size) return;
    const g = new THREE.Group(); const stand = app.assets.placeholder(size.dims); g.add(stand); fade(g);
    app.assets.visualFor({ ...size, cat: cat.id, dims: size.dims, place: cat.place }).then(v => { if (pv?.g !== g || !v) return; g.remove(stand); g.add(v); fade(g); }).catch(() => {});
    const c = document.getElementById('c').getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height * 0.55;
    const p = M.placementAt(cat, size, app.rayAt(cx, cy), app.groundAt(cx, cy), {});
    if (p) { g.position.set(p.x, p.y, p.z); g.rotation.y = p.rot; }
    app.worldOf(app.area()).layers.deco.add(g);
    pv = { g };
  };
  // THE VALID SQUARES of the level being built on, lit faintly on its ghost grid while the room tool is live (Harry
  // 2026-10-05): above the ground, every free square that is over a room below or up to two squares out from one.
  M.validCells = (level = app.level || 0) => {
    if (level <= 0) return [];
    const ents = app.entities(), S = HT.supportAt(ents, level), out = []; if (!S.any) return out;
    const top = level + app.levelInfo(level).step, taken = Object.values(ents).filter(r => r.kind === 'room' && HT.spansOverlap(level, top, HT.roomY(r.recipe), HT.roomTop(ents, r)));
    const below = Object.values(ents).filter(r => r.kind === 'room' && HT.roomTop(ents, r) === level).map(r => r.recipe);
    const x0 = Math.min(...below.map(b => b.x)) - 2, x1 = Math.max(...below.map(b => b.x + b.w)) + 2, z0 = Math.min(...below.map(b => b.z)) - 2, z1 = Math.max(...below.map(b => b.z + b.d)) + 2;
    for (let gz = z0; gz < z1; gz++) for (let gx = x0; gx < x1; gx++) if (S.ok(gx, gz) && !taken.some(r => app.footprint.hasCell(r.recipe, gx, gz))) out.push([gx, gz]);
    return out;
  };
  M.levelChanged = () => {
    const w = app.area() && app.worlds.get(app.area()); if (!w) return;
    const on = (app.mode?.kind === 'room' || app.mode?.kind === 'building') && (app.level || 0) > 0, cells = on ? M.validCells() : [];
    const key = on ? `${app.level}|${cells.length}|${cells[0]}|${cells[cells.length - 1]}` : '';
    if (key === M._validKey) return; M._validKey = key;
    if (on) w.showCells('level-valid', { lit: cells, color: '#ffffff', opacity: 0.13, y: app.level }); else w.clearCells('level-valid');
  };
  M.postSnap = postSnap; M.isPost = (cat) => POST.test(cat || '');
  M.key = (ev) => {
    if (app.mode?.kind === 'place' && ev.key.toLowerCase() === 'r') { app.mode.rot += (ev.shiftKey ? -1 : 1) * Math.PI / 4; return true; }
    return false;
  };
  return M;
}
const r2 = (v) => Math.round(v * 100) / 100;
