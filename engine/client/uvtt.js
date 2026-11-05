// UNIVERSAL VTT EXPORT (Harry 2026-10-24; docs/UI.md "Universal VTT export"): the area in view, ONE STOREY (the level
// you are on; the ground when nothing was chosen), as a .dd2vtt file for Foundry's Universal Battlemap Importer, Roll20,
// Owlbear Rodeo extensions, Fantasy Grounds (via uvtt2fgu), MapTool. GM only.
//   the picture   the game's own look (the main view's lighting stack: exposure, tone, bloom, contact shadows), seen
//                 straight down. The camera is the main view's own, put for the shot far up with a narrow lens (so the
//                 post passes, which all hold that camera, keep working): over the map's span the lean of a wall's top
//                 is a few hundredths of a square. Drawn in tiles the size of the window, each with a margin that is
//                 cut off (screen-space passes have no seams), into one canvas at pixels_per_grid × the box.
//                 Left out for the shot: the cut's upper storeys, roofs, selection and cursors (the deco and cursor
//                 layers), the ground grid (unless asked), pawns (unless asked), anything hidden from players (unless
//                 "include hidden"), the vignette (it would darken every tile's corners), the GM's "view as" fog.
//   the geometry  core/uvtt.js from the world's own edges (the ones the walls are drawn from), at that level.
// Everything changed for the shot is put back in the same frame's job, except what has to be in place for a
// moment beforehand (the cut, roofs, hidden things out, so lamps that cannot be seen go dark): about a second.
import * as THREE from 'three';
import * as U from '../core/uvtt.js';
import * as HT from '../core/height.js';
import { keyLevel } from '../core/footprint.js';

const MARGIN = 48;             // device px cut off every tile's sides
const PREFS = 'tw.uvtt';       // this browser's last choices (ppg, hidden, grid, pawns)

export function createUvtt(app, { renderer }) {
  const X = { busy: false, last: null };
  X.prefs = () => { let p = {}; try { p = JSON.parse(localStorage.getItem(PREFS) || '{}') || {}; } catch { } return { ppg: U.PPG_CHOICES.includes(p.ppg) ? p.ppg : U.PPG_DEFAULT, hidden: !!p.hidden, grid: !!p.grid, pawns: !!p.pawns }; };
  X.savePrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify({ ...X.prefs(), ...p })); } catch { } };
  const frames = (n = 1) => new Promise(res => { const step = () => (--n <= 0 ? res() : requestAnimationFrame(step)); requestAnimationFrame(step); });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // the level an export shows: the one this seat is on (app.level: a floor height, 0 = the ground)
  X.level = () => Number.isFinite(app.level) ? app.level : 0;
  X.levelLabel = (y = X.level()) => { try { return app.levelInfo(y).label; } catch { return y ? `${y} ft` : 'Ground'; } };

  // the geometry, from the world (exactly what buildShell drew from)
  X.geometry = ({ area = app.area(), level = X.level(), includeHidden = false } = {}) => {
    const w = app.worlds.get(area), E = app.entities(area) || {};
    const rooms = U.roomsFor(E, { includeHidden });
    const lights = lightsOf(E, level, includeHidden);
    const box = U.mapBox(rooms, { extra: rooms.length ? [] : lights.map(l => [l.x, l.z]) });
    if (!box || !w?.edges) return null;
    const hidden = new Set(Object.values(E).filter(e => e.kind === 'room' && e.hidden).map(e => e.id));
    const stacks = []; for (const s of w.shell.values()) if (s.spec.stack && s.spec.key && /^[hv]:/.test(s.spec.key) && keyLevel(s.spec.key) === level && (includeHidden || !hidden.has(s.roomId))) stacks.push(s.spec.key);
    const moved = Object.values(E).filter(e => e.kind === 'object' && e.fromEdge && /^[hv]:/.test(e.fromEdge) && (includeHidden || !(e.hidden || hidden.has(e.room))));
    const G = U.wallsAndPortals({ edges: w.edges, level, hidden, includeHidden, stacks, moved, box });
    return { box, ...G, lights: U.uvttLights(lights, box), rawLights: lights, rooms: rooms.length, roomsHere: U.roomsAt(rooms, level).length };
  };
  // the lit lights of one level (client/fog.js lightsOf, by the same table: the look's reach per kind)
  function lightsOf(E, level, includeHidden) {
    const table = app.fog?.lightTable?.(), out = [];
    for (const e of Object.values(E)) {
      if (e.kind !== 'object' || e.lit === false || !e.cat || !Number.isFinite(e.x) || !Number.isFinite(e.z)) continue;
      const room = e.room && E[e.room]?.recipe ? E[e.room] : null;
      if (!includeHidden && (e.hidden || room?.hidden)) continue;
      const y = room ? HT.roomY(room.recipe) : HT.baseUnder(E, e.x, e.z, e.y || 0, () => false).y;
      if (y !== level) continue;
      const kind = app.assets.lightKind?.(e.cat); if (!kind) continue;
      const radius = app.assets.lightRadius?.(e, table) || 0; if (!(radius > 0)) continue;
      out.push({ id: e.id, kind, x: e.x, z: e.z, radius });
    }
    return out;
  }

  // ---------- the picture ----------
  async function picture(area, level, box, ppg, { includeHidden, grid, pawns }) {
    const w = app.worlds.get(area); if (!w?.loaded) throw new Error('the area has not loaded yet');
    const W = box.w * ppg, H = box.d * ppg;
    const E = app.entities(area) || {}, hiddenRooms = new Set(Object.values(E).filter(e => e.kind === 'room' && e.hidden).map(e => e.id));
    const cam = app.main.camera, L = w.fx?.lighting;
    const put = []; // what to put back, last first
    // a moment beforehand: the GM's "view as" off, the storey cut to, roofs off, hidden things and pawns out (so their
    // lamps go out and nothing is waiting to be drawn), small things awake
    if (app.fog?.active?.(area) && app.visionViewer !== 'gm') { const was = app.visionViewer; app.setVisionViewer('gm'); put.push(() => app.setVisionViewer(was)); }
    const cutWas = w.cut ?? null, step = (() => { try { return app.levelRange().step; } catch { return HT.STOREY; } })(), cut = level + step - HT.SLAB;
    const setCut = (y) => { w.cutFly?.flush?.(); w.flyMuted = true; try { w.setCut(y); w.cutPass(); } finally { w.flyMuted = false; } };
    setCut(cut); put.push(() => setCut(cutWas));
    if (w.roofsOn) { const vis = [...(w.roofRecs?.values() || [])].map(r => [r, r.group.visible]); w.roofsOn = false; w.cutDirty = true; for (const [r] of vis) r.group.visible = false; w.cutPass(); put.push(() => { w.roofsOn = true; w.cutDirty = true; for (const [r, v] of vis) r.group.visible = v; w.cutPass(); }); }
    const napWas = w.napPx || 0; if (napWas) { w.napPx = 0; w.napStep?.(cam, 800, true); put.push(() => { w.napPx = napWas; }); }
    // ONE STOREY: the storeys below it come off too (a lower room beside an upper one would show its floor and things
    // with none of its walls in the file), unless a tall room of theirs reaches up through this level
    const below = new Set(Object.values(E).filter(e => e.kind === 'room' && e.recipe && HT.roomY(e.recipe) < level && HT.roomTop(E, e) <= level).map(e => e.id));
    const looseBelow = (e) => !e.room && (e.kind === 'object' || e.kind === 'token') && (e.y || 0) < level - 0.5;
    const hiddenNow = new Set(), unghosted = [];
    const hideAll = () => {
      for (const [id, r] of w.recs) if (r.group.visible && ((!includeHidden && (r.entity.hidden || hiddenRooms.has(r.entity.room))) || (!pawns && r.entity.kind === 'token') || below.has(r.entity.room) || looseBelow(r.entity))) { r.group.visible = false; hiddenNow.add(r.group); }
      for (const s of w.shell.values()) if (s.group.visible && ((!includeHidden && hiddenRooms.has(s.roomId)) || below.has(s.roomId))) { s.group.visible = false; hiddenNow.add(s.group); }
      // "include hidden": drawn as the players will see them once revealed, not in the GM's see-through treatment
      if (includeHidden) {
        const solid = (g) => g.traverse(o => { if (o.userData?.hiddenPill && o.visible) { o.visible = false; unghosted.push([o, 'pill']); } else if (o.isMesh && o.material?.transparent && o.material.opacity === 0.42 && !o.userData.uvttSolid) { o.userData.uvttSolid = true; unghosted.push([o, o.material.depthWrite]); o.material.opacity = 1; o.material.transparent = false; o.material.depthWrite = true; } });
        for (const r of w.recs.values()) if (r.entity.hidden || hiddenRooms.has(r.entity.room)) solid(r.group);
        for (const s of w.shell.values()) if (hiddenRooms.has(s.roomId)) solid(s.group);
      }
    };
    hideAll(); put.push(() => {
      for (const g of hiddenNow) g.visible = true; hiddenNow.clear();
      for (const [o, dw] of unghosted) { if (dw === 'pill') { o.visible = true; continue; } delete o.userData.uvttSolid; o.material.opacity = 0.42; o.material.transparent = true; o.material.depthWrite = dw; }
    });
    // the 5-ft grid, if asked for: the ground's, also for a level above or below (seen straight down its lines are that level's
    // squares); its holder is put up for the shot even while a build tool's level grid has it down (world.js gridHold, 2026-11-03)
    const gridWas = w.grid.visible, holdWas = w.gridHold?.visible; w.grid.visible = !!grid; if (w.gridHold) w.gridHold.visible = true; put.push(() => { w.grid.visible = gridWas; if (w.gridHold) w.gridHold.visible = holdWas; });
    const vig = L?.params?.grade?.vignette; if (vig) { L.params.grade.vignette = 0; L.set(L.params); put.push(() => { L.params.grade.vignette = vig; L.set(L.params); }); }
    try {
      // settle: spawn and fly animations over, meshes in, the lighting stack has seen which lamps are lit (it polls)
      const t0 = Date.now();
      while ((w.anims.size || w.cutFly?.busy?.() || [...w.recs.values()].some(r => r.visual?.userData?.placeholder && r.entity.url && r.group.visible)) && Date.now() - t0 < 40000) await sleep(200);
      await sleep(700); await frames(3);
      // the shot: one frame's job, every tile
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      const tiles = [];
      await new Promise((resolve, reject) => app.beforeViews.push(() => {
        const keep = { pos: cam.position.clone(), quat: cam.quaternion.clone(), up: cam.up.clone(), fov: cam.fov, near: cam.near, far: cam.far, aspect: cam.aspect, zoom: cam.zoom, view: cam.view ? { ...cam.view } : null };
        const vis = [];
        const hide = (o) => { if (o && o.visible) { o.visible = false; vis.push(o); } };
        try {
          hideAll(); hide(w.layers.deco); hide(w.layers.cursors);
          if (w.roofRecs) for (const r of w.roofRecs.values()) hide(r.group);
          const db = renderer.getDrawingBufferSize(new THREE.Vector2()), dw = db.x, dh = db.y, pr = renderer.getPixelRatio();
          const iw = dw - 2 * MARGIN, ih = dh - 2 * MARGIN;
          if (iw < 64 || ih < 64) throw new Error('the window is too small to draw the map');
          // the camera: far up, straight down, north up (screen up = -z), a lens that spans the map's height
          const mw = box.w * 5, mh = box.d * 5, cx = (box.x0 + box.w / 2) * 5, cz = (box.z0 + box.d / 2) * 5;
          const D = THREE.MathUtils.clamp(60 * Math.max(mw, mh), 3000, 30000);
          cam.up.set(0, 0, -1); cam.position.set(cx, level + D, cz); cam.lookAt(cx, level, cz);
          cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan((mh / 2) / D)); cam.aspect = mw / mh; cam.zoom = 1;
          cam.near = D - 40; cam.far = D + level + 30; // (the open ground under an upper storey is still drawn)
          cam.updateMatrixWorld();
          const px = new Uint8Array(dw * dh * 4), img = new ImageData(dw, dh);
          for (let ty = 0; ty < H; ty += ih) for (let tx = 0; tx < W; tx += iw) {
            const ox = tx - MARGIN, oy = ty - MARGIN;
            cam.setViewOffset(W, H, ox, oy, dw, dh); cam.updateProjectionMatrix();
            w.beforeRender(cam); // (everything this tile sees is awake and placed: world.js SLEEP)
            renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, dw / pr, dh / pr);
            if (w.fx) w.fx.render(0); else { renderer.setClearColor(0x1d1f1a); renderer.clear(); renderer.render(w.scene, cam); }
            const gl = renderer.getContext(); gl.readPixels(0, 0, dw, dh, gl.RGBA, gl.UNSIGNED_BYTE, px);
            for (let y = 0; y < dh; y++) { const src = (dh - 1 - y) * dw * 4; img.data.set(px.subarray(src, src + dw * 4), y * dw * 4); } // (GL rows are bottom-up)
            for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255; // (a post pass may leave alpha at 0: the map is opaque)
            g.putImageData(img, ox, oy, MARGIN, MARGIN, iw, ih);
            tiles.push([tx, ty]);
          }
          resolve();
        } catch (err) { reject(err); }
        finally {
          for (const o of vis) o.visible = true;
          cam.clearViewOffset(); if (keep.view) cam.setViewOffset(keep.view.fullWidth, keep.view.fullHeight, keep.view.offsetX, keep.view.offsetY, keep.view.width, keep.view.height);
          cam.position.copy(keep.pos); cam.quaternion.copy(keep.quat); cam.up.copy(keep.up); Object.assign(cam, { fov: keep.fov, near: keep.near, far: keep.far, aspect: keep.aspect, zoom: keep.zoom });
          cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        }
      }));
      return { canvas: cv, tiles: tiles.length };
    } finally { for (const f of put.reverse()) try { f(); } catch (e) { console.error('uvtt put back', e); } }
  }
  const blobOf = (cv) => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('the picture could not be encoded')), 'image/png'));
  const base64Of = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

  // the whole file. opts: { ppg, includeHidden, grid, pawns, level, area } -> { doc, json bytes, ... } (throws with a reason)
  X.build = async (opts = {}) => {
    if (!app.gm()) throw new Error('only the GM can export the map');
    if (X.busy) throw new Error('an export is already being made');
    const area = opts.area || app.area(), level = Number.isFinite(opts.level) ? opts.level : X.level();
    const ppg = U.PPG_CHOICES.includes(+opts.ppg) ? +opts.ppg : U.PPG_DEFAULT, includeHidden = !!opts.includeHidden;
    const geo = X.geometry({ area, level, includeHidden });
    if (!geo) throw new Error('there is nothing built in this area to export');
    const why = U.sizeProblem(geo.box, ppg); if (why) throw new Error(why);
    X.busy = true; const t0 = performance.now();
    try {
      const { canvas, tiles } = await picture(area, level, geo.box, ppg, { includeHidden, grid: !!opts.grid, pawns: !!opts.pawns });
      const png = await blobOf(canvas);
      const doc = U.uvttDocument({ box: geo.box, ppg, walls: geo.walls, portals: geo.portals, lights: geo.lights, creator: app.sync.campaign?.name || '' });
      doc.image = await base64Of(png);
      const json = JSON.stringify(doc);
      const c = app.sync.campaign, aname = app.areaName?.(area) || 'map';
      const name = `${[c?.name, aname, X.levelLabel(level)].filter(Boolean).join(' - ').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'map'}.dd2vtt`;
      X.last = { area, level, levelLabel: X.levelLabel(level), ppg, includeHidden, grid: !!opts.grid, pawns: !!opts.pawns, box: geo.box, counts: geo.counts, rooms: geo.rooms, roomsHere: geo.roomsHere, lights: geo.lights.length, tiles, png: png.size, bytes: json.length, name, ms: Math.round(performance.now() - t0), big: json.length > U.UVTT_WARN_BYTES, at: Date.now() };
      return { doc, json, name, info: X.last };
    } finally { X.busy = false; }
  };
  // build and download (a Blob link: this is the game, not a sandboxed page)
  X.download = async (opts = {}) => {
    const o = { ...X.prefs(), ...opts }; X.savePrefs({ ppg: +o.ppg, hidden: !!(o.includeHidden ?? o.hidden), grid: !!o.grid, pawns: !!o.pawns });
    app.toast(`Drawing ${X.levelLabel(Number.isFinite(o.level) ? o.level : X.level())} for Universal VTT…`);
    let r; try { r = await X.build({ ...o, includeHidden: !!(o.includeHidden ?? o.hidden) }); } catch (e) { app.toast(`Could not export: ${e.message}`, true); X.lastError = e.message; app.emit('uvtt'); return null; }
    X.lastError = null;
    const url = URL.createObjectURL(new Blob([r.json], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: r.name });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    const mb = (r.info.bytes / 1048576).toFixed(1);
    app.toast(r.info.big ? `Exported ${r.name} (${mb} MB): large; if your VTT refuses it, try fewer pixels a square` : `Exported ${r.name} (${mb} MB)`, r.info.big);
    app.emit('uvtt');
    return r;
  };
  return X;
}
