// FIGURES: the miniatures a pawn can wear (Harry 2026-10-06: "I also would love to place some figs in here now and play
// with them"). A separate list from the furniture library: tools/spawn-tuner/data/figures.json, built from the published
// figure set by tools/spawn-tuner/build_figures.py and deployed with the tuner. Room generation never sees it.
//   the list     loaded once, as data (about 170 KB for 400 figures). NO mesh and NO picture is loaded until a pawn on
//                the table wears that figure, or its row is drawn in the command bar (a lazy <img>).
//   a pawn       token.fig = a figure id (plain pawn data through the relay, so every seat sees the same figure);
//                token.size = squares a side (absent = 1; a large creature 2). No fig = the old stand-in pawn.
//   THE BASE     built here, never in the mesh (Harry: "No bases; let's add the bases ourselves afterwards in engine by
//                default" and, 2026-10-06, "disk with the colored rim"): a low dark disc, 90% of its square(s) across
//                (4.5 ft in a 5-ft square), with a rim in the owner seat's colour. The figure's lowest point is put
//                exactly on the disc's top, measured from the mesh that was actually loaded.
//   FACING       the pilot's small arrow was "barely" visible at table distance in every blind read. Here the mark is one
//                bold arrowhead in a contrasting tone, from under the figure's feet out through the rim to a point
//                beyond the disc: seen from above, the pawn's base is a pointer.
import * as THREE from 'three';
import { near } from './barwords.js';

export const DISC_H = 0.3;            // feet: the disc's thickness
// THE FIGURE SCALE (Harry 2026-10-12: "The minis are mostly too big. To scale a hero/guard to a chair correctly I have to
// make the chair about 150% size"). ONE factor on every figure, a house look ("Use in game" in the tuner's Figure scale
// bench, GET /tuner/house -> figures.scale). Measured (experiments/2026-10-12-figure-scale/): the figures DO stand at
// their stated heights (a 6 ft fighter is 6.2 ft from sole to crest), but they are heroic miniatures, a third wider than
// a person in the hip, chest and head, on a 0.3 ft disc, beside chairs whose seats are at 1.3 ft: by eye they read as
// eight-footers. The factor shrinks the FIGURE ONLY, about the middle of its base, feet still on the disc. The base stays
// its square (it is the pawn's size in the rules: rulers, templates and reach use it, never the drawn figure), and so do
// the name on it and the facing mark. Large creatures and beasts keep their sizes relative to a human (it multiplies all).
export const FIGURE_SCALE = 0.67;
export const FIGURE_SCALE_RANGE = [0.4, 1.2];
export const figureScaleOf = (v) => { const k = +(v && typeof v === 'object' ? v.scale : v); return Number.isFinite(k) && k > 0 ? Math.min(FIGURE_SCALE_RANGE[1], Math.max(FIGURE_SCALE_RANGE[0], k)) : FIGURE_SCALE; };
export const BASE_SHARE = 0.9;        // the disc's width as a share of its square(s)
const BACK_GAP = THREE.MathUtils.degToRad(64); // how much of the rim is left open at the back
const DARK = '#1d1b19', PALE = '#f6f0df', INK = '#17140f';
const GROUP_WORDS = { hero: 'hero heroes pc player character adventurer', townsfolk: 'townsfolk npc villager commoner town folk people', foe: 'foe monster enemy creature horde', beast: 'beast animal creature', large: 'large big huge giant boss monster foe' };
const GENDER_WORDS = { f: 'woman female she lady', m: 'man male he' };
const GROUP_LABEL = { hero: 'hero', townsfolk: 'townsfolk', foe: 'foe', beast: 'beast', large: 'large' };

// THE NAME ON THE BASE (Harry 2026-10-06: "lets start by putting it at their feet, on the base, curlling around the
// outside edge. far from sure but we can explore as we go"; he expects to "end up tweaking it pretty hard").
// EVERY choice is a parameter HERE, so a tuner panel can be put on it without a rewrite. Change one with
// figures.setName({ ... }) (every pawn on the table is relettered at once); figures.name() reads them.
export const NAME_ON_BASE = {
  on: true,            // false: figure pawns keep the old floating label
  where: 'top',        // 'top': lying on the disc, just inside the rim · 'side': standing on the rim's outer face
  faceCamera: true,    // true: the lettering slides round the base to stay on the side nearest the camera · false: fixed to the base
  at: 180,             // (fixed to the base) where its middle is, degrees from the front: 180 = at the back, opposite the facing mark
  height: 1.0,         // letter band height in feet, for a one-square base (a large base scales it by `largeScale`). 1.0 was read
                       // exactly by Gemini leaning in (3 of 3); 0.62 was not (1 of 3). Nothing is readable at table distance.
  largeScale: 1.5,
  inset: 0.02,         // feet between the band's outer edge and the rim's inner edge ('top')
  arc: 210,            // the most of the circle the lettering may take, in degrees
  minScale: 0.7,       // a long name is first squeezed to this share of its width, then cut with an ellipsis
  color: '#f6f0df', outline: '#17140f', outlineWidth: 5,
  plate: 'rgba(23, 20, 15, 0.82)', // a dark plate under the letters so they read over the facing mark; '' = none
  font: '700 86px Inter, system-ui, sans-serif',
  upper: false,        // true: SMALL CAPITALS
  lift: 0.035,         // feet above the disc top ('top'): over the facing mark
};
let NAME = { ...NAME_ON_BASE };
try { const v = JSON.parse(localStorage.getItem('tw.pawnName') || 'null'); if (v && typeof v === 'object') NAME = { ...NAME, ...v }; } catch { }

export async function loadFigureList(base, v) {
  try { const r = await fetch(`${base}data/figures.json${v ? `?v=${v}` : ''}`); if (!r.ok) return []; return (await r.json()).figures || []; } catch { return []; }
}

export function createFigures({ list = [], base = '', look, shadows = () => true, scale = null }) {
  let K = figureScaleOf(scale); const live = new Set(); // WeakRefs of the visuals built, so a change of the dial reaches the pawns on the table
  const fitScale = (U) => { U.holder.scale.setScalar(K); U.scale = K; U.labelY = DISC_H + Math.max(U.figure.oh, U.rawHeight || 0) * K + 0.95; U.height = (U.rawHeight ?? U.figure.h) * K; };
  function setScale(v) { K = figureScaleOf(v); for (const w of live) { const g = w.deref(); if (!g) { live.delete(w); continue; } fitScale(g.userData); } return K; }
  const byId = new Map(list.map(f => [f.id, f]));
  // ---------- search: name, id, group, class, race, tags, the SRD names ("owlbear", "elf wizard", "goblin spear") ----------
  // every typed word must be found in some field of the figure; an exact field beats a word start beats a fragment
  const low = (s) => String(s || '').toLowerCase();
  const index = list.map(f => ({ f, name: low(f.name), fields: [low(f.name), f.id, f.id.replace(/-/g, ' '), low(f.cls).replace(/-/g, ' '), low(f.race), ...(f.tags || []).map(low), ...(f.srd || []).map(low)], soft: `${GROUP_WORDS[f.group] || f.group} ${GENDER_WORDS[f.gender] || ''}`.split(' ').filter(Boolean) }));
  const forms = (w) => { const out = [w]; if (w.length > 3 && w.endsWith('ves')) out.push(w.slice(0, -3) + 'f'); if (w.length > 3 && w.endsWith('men')) out.push(w.slice(0, -3) + 'man'); if (w.length > 3 && w.endsWith('ies')) out.push(w.slice(0, -3) + 'y'); if (w.length > 3 && w.endsWith('es')) out.push(w.slice(0, -2)); if (w.length > 2 && w.endsWith('s')) out.push(w.slice(0, -1)); return out; };
  const wordScore = (w, it) => {
    let best = 0;
    for (const t of it.fields) { if (!t) continue; const s = t === w ? 100 : t.startsWith(w) ? 80 : (t.includes(' ' + w) || t.includes('-' + w)) ? 64 : w.length > 2 && t.includes(w) ? 40 : 0; if (s > best) best = s; if (best === 100) break; }
    if (best < 70) for (const t of it.soft) { const s = t === w ? 70 : w.length > 2 && t.startsWith(w) ? 52 : 0; if (s > best) best = s; }
    if (!best) for (const t of it.fields) { if (t && (best = near(w, t))) break; } // one slip ("goblinn", "skelton"): the bar's near miss
    return best;
  };
  function search(q, { limit = 8 } = {}) {
    const words = low(q).split(/[\s,]+/).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    for (const it of index) {
      let total = 0, ok = true;
      for (const w of words) { let b = 0; for (const x of forms(w)) { const s = wordScore(x, it); if (s > b) b = s; } if (!b) { ok = false; break; } total += b; }
      if (!ok) continue;
      let s = total / words.length;
      const whole = words.join(' '), singular = words.map(w => forms(w).slice(-1)[0]).join(' ');
      if (it.name === whole || it.name === singular || (it.f.srd || []).some(x => low(x) === whole || low(x) === singular)) s += 30; // the creature's own name
      else if (it.name.startsWith(whole) || it.name.startsWith(singular)) s += 12;
      out.push({ fig: it.f, s: s - it.name.length * 0.02 });
    }
    out.sort((a, b) => b.s - a.s || (a.fig.id < b.fig.id ? -1 : 1));
    return limit ? out.slice(0, limit) : out;
  }
  const describe = (f) => [GROUP_LABEL[f.group] || f.group, f.race && f.cls ? `${f.race === 'small' ? 'small-folk' : f.race} ${f.cls}` : null, `${fmtFt(f.h)} tall`, f.size > 1 ? `large: ${f.size} × ${f.size} squares` : null].filter(Boolean).join(' · ');
  const thumbUrl = (f) => f.thumb ? base + f.thumb : null;

  // ---------- the base ----------
  const sizeOf = (e) => Math.max(1, Math.min(4, Math.round(e?.size || (e?.fig && byId.get(e.fig)?.size) || 1)));
  const radiusOf = (size) => size * 5 * BASE_SHARE / 2;
  const geo = new Map();
  function baseGeo(size) {
    if (geo.has(size)) return geo.get(size);
    const r = radiusOf(size), ri = r * 0.9, H = DISC_H;
    const profile = (out, top) => [new THREE.Vector2(ri, top), new THREE.Vector2(out * 0.97, top - 0.02), new THREE.Vector2(out, top * 0.6), new THREE.Vector2(out, 0)];
    const g = {
      r,
      disc: new THREE.CylinderGeometry(ri, ri, H, 48).translate(0, H / 2, 0),
      rim: new THREE.LatheGeometry(profile(r, H), 64, Math.PI + BACK_GAP / 2, Math.PI * 2 - BACK_GAP), // lathe angle 0 is +Z (the front); the rim is open at the BACK
    };
    // THE FACING MARK: one bold arrowhead in a contrasting tone, lying on the front of the disc, cutting through the rim
    // and coming to a point beyond it (it reaches a little into the next square: that is the cue). From above the base
    // is a pointer. Wide end toward the figure's feet, point outward, so it cannot be read backwards.
    // A figure that faces AWAY from the camera hides its own arrowhead behind its body (measured: a 6-ft figure at the
    // table camera covers 3 ft of floor behind it). So the BACK is marked too: the rim is open there, a dark gap. From
    // any side the near half of the base shows one of the two: the pale point (it faces you) or the gap (it faces away).
    const zb = r * 0.42, hw = r * 0.52, tip = r + 0.22 + 0.3 * size;
    const s = new THREE.Shape(); s.moveTo(-hw, -zb); s.lineTo(hw, -zb); s.lineTo(0, -tip); s.closePath();              // drawn in XY; laid flat below
    g.arrow = new THREE.ExtrudeGeometry(s, { depth: H + 0.025, bevelEnabled: false }).rotateX(-Math.PI / 2);            // (x, y, z) -> (x, z, -y): from the floor to just over the disc top, pointing +Z
    g.tip = tip;
    geo.set(size, g); return g;
  }
  const darkMat = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.7 });
  const lum = (c) => { const k = new THREE.Color(c); return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b; };
  const contrast = (rim) => lum(rim) > 0.55 ? INK : PALE; // the wedge is pale, unless the seat's own colour is pale: then it is ink
  function makeBase(size, color, { ghost = false } = {}) {
    const g = new THREE.Group(), G = baseGeo(size), mats = [];
    const rimMat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: color, emissiveIntensity: 0.3, side: THREE.DoubleSide });
    const wc = contrast(color), wedgeMat = new THREE.MeshStandardMaterial({ color: wc, roughness: 0.5, emissive: wc, emissiveIntensity: wc === PALE ? 0.55 : 0, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(G.disc, ghost ? darkMat.clone() : darkMat), rim = new THREE.Mesh(G.rim, rimMat), arrow = new THREE.Mesh(G.arrow, wedgeMat);
    for (const m of [disc, rim, arrow]) { m.receiveShadow = shadows(); m.castShadow = false; m.userData.pawnBase = true; g.add(m); mats.push(m.material); }
    if (ghost) for (const m of new Set(mats)) { m.transparent = true; m.opacity = 0.42; m.depthWrite = false; }
    g.userData = { top: DISC_H, radius: G.r, tip: G.tip, rim, wedge: arrow, disc, setColor: (c) => { rimMat.color.set(c); rimMat.emissive.set(c); const k = contrast(c); wedgeMat.color.set(k); wedgeMat.emissive.set(k); wedgeMat.emissiveIntensity = k === PALE ? 0.55 : 0; g.userData.color = c; }, color };
    return g;
  }

  // ---------- the name, lettered round the base ----------
  // One canvas line of text bent onto a strip: a slice of a flat ring on the disc ('top') or of the rim's face ('side').
  // Read from OUTSIDE the base: letter feet toward the edge, running left to right for someone looking at that side.
  const nameCanvas = (text, maxW) => {
    const c = document.createElement('canvas'), g = c.getContext('2d'), P = NAME, H = 128;
    let t = P.upper ? String(text).toUpperCase() : String(text); g.font = P.font;
    let w = g.measureText(t).width, k = 1;
    if (w > maxW) { k = Math.max(P.minScale, maxW / w); while (t.length > 2 && g.measureText(t + '…').width * k > maxW) t = t.slice(0, -1).trimEnd(); if (g.measureText(t).width * k > maxW || t !== (P.upper ? String(text).toUpperCase() : String(text))) t += '…'; w = g.measureText(t).width; k = Math.min(1, Math.max(P.minScale, maxW / w)); }
    c.width = Math.max(8, Math.ceil(w * k + 56)); c.height = H;
    if (P.plate) { g.fillStyle = P.plate; const r = H / 2; g.beginPath(); g.roundRect(0, 6, c.width, H - 12, r); g.fill(); }
    g.font = P.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(c.width / 2, H / 2 + 4); g.scale(k, 1);
    if (P.outlineWidth) { g.lineWidth = P.outlineWidth * 2; g.strokeStyle = P.outline; g.lineJoin = 'round'; g.strokeText(t, 0, 0); }
    g.fillStyle = P.color; g.fillText(t, 0, 0);
    return { canvas: c, shown: t };
  };
  function makeName(text, size) {
    const P = NAME, r = radiusOf(size), ri = r * 0.9, h = P.height * (size > 1 ? P.largeScale : 1), g = new THREE.Group();
    const rOut = P.where === 'side' ? r * 1.005 : ri - P.inset, rMid = P.where === 'side' ? rOut : rOut - h / 2;
    const pxPerFt = 128 / h, maxW = THREE.MathUtils.degToRad(P.arc) * rMid * pxPerFt - 56;
    const { canvas, shown } = nameCanvas(text, maxW), ang = canvas.width / pxPerFt / rMid, N = Math.max(8, Math.ceil(ang * 14));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      // the strip's middle is at lathe angle 0 (+Z); u runs so that the text reads left to right seen from outside (+Z looking in).
      // (It was mirrored at first, and Gemini's blind read said so: "ddoH meT blO ... the text appears to be mirrored".)
      const a = -ang / 2 + ang * i / N, sn = Math.sin(a), cs = Math.cos(a), u = i / N; // (+X is the right hand of someone at +Z looking in: the line starts at -X)
      if (P.where === 'side') { pos.push(sn * rOut, DISC_H * 0.5 + h / 2, cs * rOut, sn * rOut, DISC_H * 0.5 - h / 2, cs * rOut); }
      else { pos.push(sn * (rOut - h), DISC_H + P.lift, cs * (rOut - h), sn * rOut, DISC_H + P.lift, cs * rOut); }
      uv.push(u, 1, u, 0);
      if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.renderOrder = 3; m.userData.pawnBase = true; m.userData.pawnName = true; m.userData.fx = true; g.add(m);
    g.userData = { text, shown, arcDeg: THREE.MathUtils.radToDeg(ang), ends: [[Math.sin(-ang / 2) * rMid, Math.cos(-ang / 2) * rMid], [Math.sin(ang / 2) * rMid, Math.cos(ang / 2) * rMid]], dispose: () => { geo.dispose(); tex.dispose(); m.material.dispose(); } };
    g.rotation.y = THREE.MathUtils.degToRad(P.at);
    return g;
  }
  // put (or replace, or take away) the name on a pawn visual made by pawnVisual
  function setNameOn(vis, text) {
    const U = vis?.userData; if (!U?.fig) return;
    if (U.nameG) { U.nameG.parent?.remove(U.nameG); U.nameG.userData.dispose(); U.nameG = null; }
    U.nameText = text || '';
    if (!NAME.on || !text) return;
    U.nameG = makeName(text, U.size); (U.foot || vis).add(U.nameG); // on the base, wherever the base is
    if (U.ghost) U.nameG.children[0].material.opacity = 0.42; // a hidden pawn's name is see-through with the rest of it (GM side)
  }
  // each frame, for the pawns of one world: with faceCamera the lettering slides to the side of the base nearest the camera
  const _p = new THREE.Vector3();
  function faceNames(visuals, camera) {
    if (!NAME.on || !NAME.faceCamera || !camera) return;
    for (const vis of visuals) { const g = vis.userData.nameG; if (!g) continue; vis.getWorldPosition(_p); g.rotation.y = Math.atan2(camera.position.x - _p.x, camera.position.z - _p.z) - vis.parent.rotation.y; }
  }
  const nameListeners = new Set();
  function setName(p, { save = true } = {}) { NAME = { ...NAME, ...p }; if (save) try { localStorage.setItem('tw.pawnName', JSON.stringify(Object.fromEntries(Object.entries(NAME).filter(([k, v]) => NAME_ON_BASE[k] !== v)))); } catch { } for (const f of nameListeners) f(); }

  // ---------- the figure on its base ----------
  const measured = new Map(); // url -> { minY, maxY } in the mesh's own units (the file actually loaded, not the list's claim)
  const loading = new Map();  // url -> Promise<template>
  const stats = { loads: 0, loaded: new Set(), failed: new Set() };
  function template(f) {
    if (!loading.has(f.url)) {
      stats.loads++;
      loading.set(f.url, look.loadGLB(f.url).then(t => {
        t.updateMatrixWorld(true); const b = new THREE.Box3();
        t.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); if (o.material?.map) o.material.map.anisotropy = 4; } });
        measured.set(f.url, { minY: b.min.y, maxY: b.max.y }); stats.loaded.add(f.id); return t;
      }).catch(err => { stats.failed.add(f.id); loading.delete(f.url); throw err; }));
    }
    return loading.get(f.url);
  }
  const ghostify = (v) => v.traverse(o => { if (!o.isMesh || o.userData.pawnBase) return; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false; });
  // a pawn's whole visual: base now, a faint stand-in the figure's height at once, the figure when its file arrives.
  //   e: { fig, size? }   color: the rim   ghost: the GM's see-through look for a hidden pawn (or a placement ghost)
  // The returned group carries userData { fig, base, top, labelY, ready: Promise, loaded, setColor, measure() }.
  // e.main (a player's MAIN pawn, Harry 2026-10-06: "very high faces for the like 5 player models we will actually
  // have"): the game tier shows first; then the ORIGINAL mesh (about 50k triangles, 2048 px) is fetched and swapped in,
  // stood on the disc by its own measured lowest point, so nothing moves at the swap.
  function pawnVisual(e, { color = '#d9a441', ghost = false, onReady = null } = {}) {
    const f = byId.get(e.fig); if (!f) return null;
    const size = sizeOf(e), g = new THREE.Group(), baseG = makeBase(size, color, { ghost }), foot = new THREE.Group(); foot.add(baseG); g.add(foot); // foot: what stays on the ground under a raised pawn (the disc, the rim, the arrow, the name): world.js PAWN BASE
    const holder = new THREE.Group(); holder.position.y = DISC_H; g.add(holder);
    const stand = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(0.9, f.h * 0.16) * size, Math.max(0.2, f.h - 2 * Math.min(0.9, f.h * 0.16) * size), 4, 12), new THREE.MeshStandardMaterial({ color: '#8b8378', roughness: 0.8, transparent: true, opacity: 0.35, depthWrite: false }));
    stand.position.y = f.h / 2; stand.userData.figureStandIn = true; holder.add(stand);
    const U = g.userData = { fig: f.id, figure: f, size, base: baseG, foot, top: DISC_H, labelY: DISC_H + f.oh + 0.95, loaded: false, failed: false, holder, ghost, setColor: baseG.userData.setColor };
    fitScale(U); live.add(new WeakRef(g)); // the figure scale: the holder stands on the disc top, so the feet stay on it
    U.ready = template(f).then(t => {
      const m = measured.get(f.url), inst = t.clone(true), turn = new THREE.Group();
      turn.rotation.y = THREE.MathUtils.degToRad(f.yaw || 0); turn.scale.setScalar(f.k);
      turn.position.set(-(f.c?.[0] || 0), -m.minY * f.k, -(f.c?.[1] || 0)); // its ground centre over the disc's centre, its lowest point ON the disc top
      turn.add(inst); inst.traverse(o => { if (o.isMesh) { o.castShadow = shadows(); o.receiveShadow = shadows(); o.userData.figureMesh = true; } });
      holder.remove(stand); stand.geometry.dispose(); holder.add(turn);
      if (ghost) ghostify(turn);
      U.loaded = true; U.body = turn; U.rawHeight = (m.maxY - m.minY) * f.k; fitScale(U); U.detail = f.tier;
      onReady?.(g);
      if (e.main && f.full) U.full = template({ id: f.id + '#full', url: f.full }).then(t2 => {
        const m2 = measured.get(f.full), inst2 = t2.clone(true), turn2 = new THREE.Group();
        turn2.rotation.y = turn.rotation.y; turn2.scale.setScalar(f.k); turn2.position.set(-(f.c?.[0] || 0), -m2.minY * f.k, -(f.c?.[1] || 0));
        turn2.add(inst2); inst2.traverse(o => { if (o.isMesh) { o.castShadow = shadows(); o.receiveShadow = shadows(); o.userData.figureMesh = true; } });
        if (ghost) ghostify(turn2);
        U.before = measure(g); holder.remove(turn); holder.add(turn2); U.body = turn2; U.rawHeight = (m2.maxY - m2.minY) * f.k; fitScale(U); U.detail = 'full'; U.swapped = true;
        onReady?.(g); return g;
      }).catch(() => g); // the original cannot be had: the game tier stays
      return g;
    }).catch(() => { U.failed = true; stand.material.opacity = 0.8; stand.material.color.set(color); return g; }); // no file: a solid stand-in in the pawn's colour, never nothing
    return g;
  }
  // (tests, and the page's own check) what was built for a pawn visual, measured from the vertices in the world
  function measure(vis) {
    const U = vis?.userData; if (!U?.fig) return null;
    vis.updateMatrixWorld(true);
    const baseY = new THREE.Vector3().setFromMatrixPosition(vis.matrixWorld).y, v = new THREE.Vector3();
    let lo = Infinity, hi = -Infinity;
    if (U.body) U.body.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if (v.y < lo) lo = v.y; if (v.y > hi) hi = v.y; } });
    const front = new THREE.Vector3(0, 0, 1).transformDirection(vis.matrixWorld), tip = new THREE.Vector3(0, DISC_H * 0.4, U.base.userData.tip).applyMatrix4(vis.matrixWorld), c = new THREE.Vector3().setFromMatrixPosition(vis.matrixWorld);
    let tris = 0, cx = 0, cz = 0, n = 0; if (U.body) U.body.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position; tris += (o.geometry.index ? o.geometry.index.count : p.count) / 3; const st = Math.max(1, Math.floor(p.count / 4000)); for (let i = 0; i < p.count; i += st) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); cx += v.x; cz += v.z; n++; } });
    return { fig: U.fig, loaded: U.loaded, failed: U.failed, size: U.size, tier: U.figure.tier, tris: U.figure.tris, detail: U.detail || null, drawn_tris: Math.round(tris), swapped: !!U.swapped, before: U.before ? { feet_above_disc_ft: U.before.feet_above_disc_ft, height_ft: U.before.height_ft, mid: U.before.mid, drawn_tris: U.before.drawn_tris } : null,
      mid: n ? [+(cx / n).toFixed(3), +(cz / n).toFixed(3)] : null, name: U.nameG ? { text: U.nameText, shown: U.nameG.userData.shown, arc_deg: +U.nameG.userData.arcDeg.toFixed(1), at_deg: +THREE.MathUtils.radToDeg(U.nameG.rotation.y).toFixed(1), ends: U.nameG.userData.ends.map(([x, z]) => { const q = new THREE.Vector3(x, DISC_H, z).applyMatrix4(U.nameG.matrixWorld); return [+q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3)]; }) } : null,
      feet_above_disc_ft: U.body ? +(lo - (baseY + DISC_H)).toFixed(4) : null, height_ft: U.body ? +(hi - lo).toFixed(3) : null, stated_ft: U.figure.h, overall_ft: U.figure.oh, scale: U.scale, // drawn = stated x scale (the figure-scale dial)
     
      disc_top_ft: +(baseY + DISC_H).toFixed(3), base_width_ft: +(U.base.userData.radius * 2).toFixed(3), rim: '#' + U.base.userData.rim.material.color.getHexString(), wedge: '#' + U.base.userData.wedge.material.color.getHexString(),
      facing_deg: +(((Math.atan2(front.x, front.z) * 180 / Math.PI) % 360 + 360) % 360).toFixed(1), point: [+(tip.x - c.x).toFixed(3), +(tip.z - c.z).toFixed(3)] };
  }
  return { list, byId, get: (id) => byId.get(id) || null, search, describe, thumbUrl, sizeOf, radiusOf, makeBase, pawnVisual, measure, stats, count: list.length, DISC_H, scale: () => K, setScale, drawnFt: (f) => f.h * K,
    setNameOn, faceNames, name: () => ({ ...NAME }), setName, onName: (f) => nameListeners.add(f), nameDefaults: NAME_ON_BASE, texBytes: (url) => look.texBytes.get(url) || 0 };
}
const fmtFt = (h) => `${Math.round(h * 10) / 10} ft`;
