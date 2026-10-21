// Area thumbnails (Harry 2026-10-04) for Settings ▸ World navigation: a 3/4-view picture of each area.
//   framing    core/framing.js: the box of the area's structures (rooms; far outliers dropped when things are spread
//              out, keeping >= 85% of the structure area), seen from the fixed home yaw/pitch (-20°, 52°), fitted with
//              a small margin
//   when       not live: once an area has settled (DEBOUNCE after its last change), the client of someone who has it
//              open renders it (the GM's; if no GM is online, the online person with the lowest seat id) and uploads it
//   what       the real look (the area's own scene, lights and tone mapping), minus selection signals, cursors, labels
//              (DOM) and anything hidden from players (hidden things and hidden rooms are not drawn), at 480×300 WebP
//   where      the relay (POST/GET /c/<id>/a/<area>/thumb, GET /c/<id>/thumbs); players only get areas they can see
import * as THREE from 'three';
import { structureBox, fitDistance } from '../core/framing.js';
import { fitPose } from './views.js';

const CELL = 5, TW = 480, TH = 300, DEBOUNCE = 15000, HOME = { yaw: -20, pitch: 52 };

export function createThumbs(app, { renderer }) {
  const Th = { meta: {}, lastRender: null, debounce: DEBOUNCE };
  const timers = new Map();
  const C = () => app.sync?.campaign;
  const base = (area) => `${app.relayBase}/c/${C().id}${area ? `/a/${area}/thumb` : '/thumbs'}?seat=${encodeURIComponent(app.sync.token)}`;
  Th.url = (area) => !app.fog?.active() && Th.meta[area] ? `${base(area)}&t=${Th.meta[area].at}` : null;

  Th.refreshMeta = async () => {
    if (!C()) return Th.meta;
    try { const r = await fetch(base(null)).then(r => r.json()); if (r.ok) { Th.meta = r.thumbs; app.emit('thumbs'); } } catch { }
    return Th.meta;
  };

  // the box this area's picture frames (feet), from what a player could see of it
  Th.frameFor = (area) => {
    const ents = Object.values(app.entities(area) || {});
    const rects = ents.filter(e => e.kind === 'room' && !e.hidden).map(e => ({ x0: e.recipe.x * CELL, z0: e.recipe.z * CELL, x1: (e.recipe.x + e.recipe.w) * CELL, z1: (e.recipe.z + e.recipe.d) * CELL }));
    let box = structureBox(rects);
    if (!box) { // no rooms: the visible things, or a patch of ground
      const pts = ents.filter(e => (e.kind === 'token' || e.kind === 'object') && !e.hidden && e.x != null).map(e => [e.x, e.z]);
      box = pts.length ? { x0: Math.min(...pts.map(p => p[0])) - 5, z0: Math.min(...pts.map(p => p[1])) - 5, x1: Math.max(...pts.map(p => p[0])) + 5, z1: Math.max(...pts.map(p => p[1])) + 5 } : { x0: -20, z0: -20, x1: 20, z1: 20 };
    }
    return { box, ...fitDistance(box, { ...HOME, fovDeg: 45, aspect: TW / TH, h: 10, margin: 0.06 }) };
  };

  // draw the area into the bottom-left corner of the drawing buffer and read it straight back (same task, before the
  // browser composites: the real tone mapping and colour space), with everything a player shouldn't see left out
  // a room still arriving (meshes loading, the spawn choreography) is not a picture yet: wait for it (at most 40 s)
  // (an area picture is never taken while the hand is moving the view or dragging: it waits, at most 40 s like the rest)
  const settled = async (w) => { const t0 = Date.now(); while ((w.anims.size || w.cutFly?.busy() || app.interact?.active || [...w.recs.values()].some(r => r.visual?.userData?.placeholder && r.entity.url)) && Date.now() - t0 < 40000) await new Promise(r => setTimeout(r, 250)); };
  Th.render = async (area) => {
    const w = app.worlds.get(area); if (!w?.loaded) return null;
    await settled(w);
    const f = Th.frameFor(area);
    const cam = new THREE.PerspectiveCamera(45, TW / TH, 0.5, 3000);
    const Y = THREE.MathUtils.degToRad(f.yaw), P = THREE.MathUtils.degToRad(f.pitch);
    cam.position.set(f.focus[0] + Math.sin(Y) * Math.cos(P) * f.dist, Math.sin(P) * f.dist, f.focus[2] + Math.cos(Y) * Math.cos(P) * f.dist);
    cam.lookAt(f.focus[0], 0, f.focus[2]); cam.updateMatrixWorld();
    const ents = app.entities(area) || {}, hiddenRooms = new Set(Object.values(ents).filter(e => e.kind === 'room' && e.hidden).map(e => e.id));
    // STOREYS: the picture is of the whole place, whatever level this seat happens to be looking at (roofs as this seat
    // has them: on or off; a hidden room has no roof): the cut is lifted for
    // the shot (every level drawn, the ground closed) and put back after it. Lifted BEFORE the hidden things are taken
    // out below, so lifting it cannot bring one of them back.
    // THE WHOLE PICTURE IS TAKEN INSIDE ONE FRAME'S JOB (2026-10-06): the cut is lifted, what players must not see is
    // hidden, sleeping rooms are woken, the picture is drawn and read, and everything is put back, with nothing in
    // between. (The cut used to be lifted here and the picture taken a frame later: for that frame every level was
    // drawn and clickable. A batch of picks that fell into it resolved to hidden levels: browser_cut, once in a while.)
    const cutWas = w.cut ?? null, excluded = [];
    const pr = renderer.getPixelRatio(), vw = TW / pr, vh = TH / pr;
    const px = new Uint8Array(TW * TH * 4);
    await new Promise((resolve) => app.beforeViews.push(() => {
      const restore = [], hide = (o) => { if (o.visible) { o.visible = false; restore.push(o); } };
      try {
        w.liftCut(); // (a cut set while it is lifted is the one put back: world.liftCut)
        hide(w.layers.deco); hide(w.layers.cursors);
        for (const [id, r] of w.recs) if (r.entity.hidden || hiddenRooms.has(r.entity.room)) { hide(r.group); excluded.push(id); }
        for (const s of w.shell.values()) if (hiddenRooms.has(s.roomId)) hide(s.group);
        renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setScissor(0, 0, vw, vh); renderer.setViewport(0, 0, vw, vh);
        Th.lastShot = { cut: w.cut ?? null, cutWas, shellShown: [...w.shell.values()].filter(x => x.group.visible).length, shell: w.shell.size, roofs: [...(w.roofRecs?.values() || [])].filter(r => r.group.visible).length }; // (tests)
        w.beforeRender?.(cam); // the picture shows the whole area: every sleeping building it frames is woken first (world.js SLEEP)
        renderer.render(w.scene, cam);
        const gl = renderer.getContext(); gl.readPixels(0, 0, TW, TH, gl.RGBA, gl.UNSIGNED_BYTE, px);
      } finally { for (const o of restore) o.visible = true; w.dropLift(); resolve(); }
    }));
    const cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    const g = cv.getContext('2d'), img = g.createImageData(TW, TH);
    for (let y = 0; y < TH; y++) img.data.set(px.subarray((TH - 1 - y) * TW * 4, (TH - y) * TW * 4), y * TW * 4); // GL rows are bottom-up
    g.putImageData(img, 0, 0);
    const blob = await new Promise(res => cv.toBlob(res, 'image/webp', 0.82));
    Th.lastRender = { area, at: Date.now(), excluded, frame: f, bytes: blob?.size || 0, blank: px.every((v, i) => i % 4 === 3 || v === 0) };
    return blob;
  };
  Th.upload = async (area, blob) => {
    if (!blob) return null;
    // the camera the picture was shot from goes up with it (Th.enter below starts a view on it)
    const f = Th.lastRender?.area === area ? Th.lastRender.frame : null, q = f ? `&frame=${[f.focus[0], f.focus[2], f.dist, f.yaw, f.pitch, TW / TH].map(v => +v.toFixed(3)).join(',')}` : '';
    try { const r = await fetch(base(area) + q, { method: 'POST', headers: { 'content-type': 'image/webp' }, body: blob }).then(r => r.json()); if (r.ok) { Th.meta[area] = r; app.emit('thumbs'); } return r; } catch { return null; }
  };
  // Opening an area from World navigation (Harry 2026-10-05): the view starts on the camera its picture was shot from:
  // same focus, heading and pitch, and a distance that shows what the picture shows (views.js fitPose: the picture is
  // 480×300; a narrower view backs away to keep its width, a wider one shows more to the sides). A picture made before
  // frames were kept, or an area with no picture yet, gets the frame a picture taken now would have, once it has loaded.
  Th.enter = (view, area) => {
    const cv = renderer.domElement, put = (f) => { view.entered = { area, frame: { focus: f.focus, dist: f.dist, yaw: f.yaw, pitch: f.pitch, aspect: f.aspect || TW / TH }, pose: view.setPose(fitPose({ focus: f.focus, yaw: f.yaw, pitch: f.pitch, dist: f.dist }, f.aspect || TW / TH, view.aspect(cv.clientWidth, cv.clientHeight))) }; view.carried = null; app.refresh(); };
    const f = Th.meta[area]?.frame;
    if (f) return put(f);
    const t0 = Date.now(), p0 = JSON.stringify(view.pose());
    const wait = () => {
      if (view.area !== area || JSON.stringify(view.pose()) !== p0 || Date.now() - t0 > 15000) return; // gone elsewhere, or already moved by hand
      if (app.worlds.get(area)?.loaded && app.sync.view(area)) return put({ ...Th.frameFor(area), aspect: TW / TH });
      setTimeout(wait, 150);
    };
    wait();
  };
  Th.renderNow = async (area = app.area()) => Th.upload(area, await Th.render(area));

  // who renders: the GM; with no GM online, the online person with the lowest seat id. Never an AI seat.
  const renderer_ = () => {
    // Shared thumbnails are full-map pictures, never a private viewer mask.
    if(app.fog?.active())return false;
    const c = C(); if (!c) return false;
    if (app.gm()) return true;
    if (c.seats.some(s => s.role === 'gm' && s.online)) return false;
    const humans = c.seats.filter(s => s.kind === 'human' && s.online).map(s => s.id).sort();
    return humans[0] === app.me();
  };
  Th.schedule = (area) => {
    clearTimeout(timers.get(area));
    timers.set(area, setTimeout(() => { timers.delete(area); if (area === app.area() && renderer_() && !document.hidden) Th.renderNow(area).catch(() => {}); }, Th.debounce));
  };
  app.on((what, area) => { if (what === 'change' && area && !String(area).startsWith('lib:')) Th.schedule(area); });
  return Th;
}
