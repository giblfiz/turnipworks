// RULERS AND TEMPLATES (Harry and Fauna 2026-10-11; docs/RULERS.md). The numbers are core/measure.js (one distance
// function, one "who is caught" function); a kept template is an entity (core/commands.js template.*); this surface is
// everything on screen and in the hand.
//
//   1. MOVEMENT DISTANCE FOR FREE   while a pawn is dragged: a line from where it stood to where it is, and how far
//   2. THE RULER                    M (hold, or tap), then drag from A to B; an end on a pawn attaches and follows
//   3. SHAPES                       after a measure: Line · Cone · Circle · Sphere · Cube turn THAT measurement into a
//                                   template (keys 1 to 5; "cone 15" in the bar)
//   4. WHO IS CAUGHT                every pawn whose base overlaps it wears a ring; the count is on the label
//   5. KEEP                         Keep · for N rounds · attached to a pawn: a real, shared, saved thing (template.place)
//
// A plain ruler, a dragged pawn's line and a template not yet kept are PRESENCE (core/presence.js setRuler): other
// seats see them live, nothing is stored, and they are gone when let go.
//
// Costs nothing when nothing is measured: the frame handler leaves at once unless something is in the hand, another
// seat is measuring, a pawn is being dragged, or the area holds a kept template.
import * as MS from '../../core/measure.js';
import * as TU from '../../core/turns.js';
import { floorUnder } from '../../core/height.js';
import { newId } from '../../core/ids.js';
import { icon } from '../icons.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// THE KEYS, in one place (free before: docs/UI.md "Keys"; M and K were unused, the digits are only read while a
// measurement is in the hand)
export const RULER_KEYS = { measure: 'M', keep: 'K', shape: { line: '1', cone: '2', circle: '3', sphere: '4', cube: '5' } };
// THE LOOK, in one place: every width, colour, opacity and size of a ruler or a template
export const RULER_LOOK = {
  lineWidth: 3.5,            // px: a ruler's line, a live template's outline
  casingWidth: 7.5,          // px: the dark casing under it, so it reads over any floor
  casing: '#0b0d0a', casingOpacity: 0.82,
  moveWidth: 2.5,            // px: a dragged pawn's travelled line (thinner than a ruler)
  fillOpacity: 0.17,         // a live template's fill
  cellOpacity: 0.22,         // ... and its tinted squares (the secondary cue)
  cellInset: 0.3,            // ft of gap round each tinted square
  keptLineWidth: 2,          // px: a kept template is quieter
  keptLineOpacity: 0.55, keptFillOpacity: 0.06, keptCellOpacity: 0.07,
  hotLineOpacity: 0.95, hotFillOpacity: 0.13, hotCellOpacity: 0.16, // a kept one under the pointer, or selected
  lift: 0.14,                // ft above its floor (never z-fights: the outline is drawn over everything anyway)
  caught: '#ff5533',         // the ring round a caught pawn
  caughtGap: 0.35, caughtWidth: 1.0, caughtHz: 1.1, caughtLo: 0.7, caughtHi: 1,
  labelPx: 13, labelRemotePx: 12, handlePx: 16, chipPx: 22,
  snapFt: 1.5,               // an end let go this close to a pawn's base attaches to it
  levelFt: 4,                // ... when the pawn stands within this height of the point
  sizeStep: 1, shiftStep: 5, // a template's size while dragging: whole feet; Shift: 5-ft steps
  roundsPresets: [1],
};
export const KEEP_BAR_IDLE_MS = 8000;
const DRAG_PX = 4, SEG = 72;
const GLOBE_LAT = 8, GLOBE_LON = 8, CONE_RIBS = 8; // a sphere's parallels (equator included in the outline: 9 seen) and meridians; a cone's ribs
export const SHAPES_ON = true; // (the second slice: shapes, who is caught, keep. One switch, should it ever need to come off)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const r2 = (v) => Math.round(v * 100) / 100;
const SHAPE_ICON = { line: 'tpl-line', cone: 'tpl-cone', circle: 'circle', sphere: 'globe', cube: 'box' };
const inField = (t) => t?.closest?.('input, textarea, select, [contenteditable]');

export function rulersSurface(R, app) {
  const THREE = app.THREE, L = RULER_LOOK;
  const canvas = document.getElementById('c');
  const layer = document.createElement('div'); layer.id = 'rulers'; document.getElementById('app').append(layer);
  const rule = () => app.sync.campaign?.defaults?.distance || 'true';
  const units = () => app.sync.campaign?.defaults?.units || 'ft';
  const world = () => app.area() && app.worlds.get(app.area());
  const ents = () => app.entities();
  const seat = (id) => app.sync.campaign?.seats.find(s => s.id === id) || null;
  const pawnOf = (id) => { const e = id && ents()[id]; return e?.kind === 'token' ? e : null; };
  // where a pawn is DRAWN now (a drag in progress, mine or another seat's), so rulers and auras follow it live
  const drawnAt = (id) => { const r = world()?.recs.get(id); if (!r || r.entity.kind !== 'token') return null; const p = r.group.position; return { x: p.x, y: p.y, z: p.z }; };
  const templates = () => app.derived('templates', (E) => Object.values(E).filter(e => e.kind === 'template'));
  const mayEdit = (e) => !!e && (app.gm() || e.owner === app.me());
  const wake = () => { app.gfx?.wake?.('ruler'); app.refresh(); }; // (the idle render throttle, graphics.js: a ruler is something moving)

  // ---------------- the model in the hand ----------------
  // live: { k: 'rule' | shape, a: End, b: End, w?, stage: 'draw' | 'aim' | 'set', fixed?: size typed in the bar, src?: pawn it is cast from }
  // End:  { x, y, z, pawn? }   (pawn: attached; x, y, z then follow it)
  let keepBar = null, keepTimer = null;
  function dismissKeep() { clearTimeout(keepTimer); keepTimer = null; keepBar = null; }
  function touchKeep() {
    clearTimeout(keepTimer);
    keepTimer = setTimeout(() => { dismissKeep(); if (live?.k !== 'rule') live = null; wake(); }, KEEP_BAR_IDLE_MS);
  }
  let live = null, armed = null, sel = null, hoverId = null, dragging = null, keyDown = null, lastPtr = null, roundsText = '';
  const endPos = (end) => {
    const e = pawnOf(end.pawn);
    if (e) { const p = drawnAt(e.id) || e; end.x = p.x; end.y = p.y || 0; end.z = p.z; return { x: p.x, y: p.y || 0, z: p.z, r: MS.pawnRadius(e), pawn: e.id }; }
    return { x: end.x, y: end.y || 0, z: end.z, r: 0, pawn: null };
  };
  // a model as a template's own fields (size = the NOMINAL size: measured from the edge of the pawn it starts on)
  function tplOf(m) {
    const A = endPos(m.a), B = m.b, flat = Math.hypot(B.x - A.x, B.z - A.z);
    const dir = flat > 1e-6 ? Math.atan2(B.z - A.z, B.x - A.x) : (m.dir || 0); m.dir = dir;
    return { shape: m.k, x: A.x, z: A.z, y: A.y, dir, size: Math.max(0.01, flat - A.r), ...(m.k === 'line' && m.w && { width: m.w }), ...(A.pawn && { attach: A.pawn }) };
  }
  const geomOf = (m) => MS.resolve(tplOf(m), ents(), drawnAt);
  // the model of a kept template (to edit it by its handles)
  function modelOf(e) {
    const g = MS.resolve(e, ents(), drawnAt), end = MS.endOf(g), p = pawnOf(e.attach);
    return { k: e.shape, a: p ? { x: g.x, y: g.y, z: g.z, pawn: p.id } : { x: g.x, y: g.y, z: g.z }, b: { x: end.x, y: end.y, z: end.z }, w: e.width, dir: g.dir };
  }
  // the point under the pointer, attached to a pawn when it is on or beside one
  function pick(cx, cy, { snap = true } = {}) {
    if (!app.main) return null;
    const g = app.groundAt(cx, cy);
    let pawn = null;
    if (snap) {
      const w = world(), hit = w && app.selectionFor(w.pick(app.rayAt(cx, cy)));
      pawn = pawnOf(hit);
      if (!pawn && g) { let best = L.snapFt; for (const e of app.pawnList()) { const rec = w?.recs.get(e.id); if (rec && !rec.group.visible) continue; const p = drawnAt(e.id) || e; if (Math.abs((p.y || 0) - (g.y || 0)) > L.levelFt) continue; const d = Math.hypot(p.x - g[0], p.z - g[1]) - MS.pawnRadius(e); if (d < best) { best = d; pawn = e; } } }
    }
    if (pawn) { const p = drawnAt(pawn.id) || pawn; return { x: p.x, y: p.y || 0, z: p.z, pawn: pawn.id }; }
    return g ? { x: g[0], y: g.y || 0, z: g[1] } : null;
  }
  // put a model's far end at a point. A ruler takes the point (and its pawn). A template takes its direction and its
  // size, in whole feet (Shift: 5-ft steps); one whose size was typed keeps that size and only turns.
  function setB(m, p, ev) {
    if (!p) return;
    if (m.k === 'rule') { m.b = { ...p }; return; }
    const round = !!m.fixed || m.k !== 'rule';
    if (m.fixed && m.stage === 'aim' && (m.k === 'circle' || m.k === 'sphere')) { // a typed circle or sphere: its CENTRE goes to the pointer (the caster stays where she is)
      m.a = { x: p.x, y: p.y || 0, z: p.z }; m.b = { x: p.x + m.fixed, y: p.y || 0, z: p.z }; return; // (never attached while it is aimed: dropped on a pawn it catches that pawn)
    }
    const A = endPos(m.a), dx = p.x - A.x, dz = p.z - A.z, flat = Math.hypot(dx, dz);
    if (flat < 1e-6) return;
    const step = ev?.shiftKey ? L.shiftStep : L.sizeStep;
    const size = m.fixed || (round ? Math.max(step, Math.round((flat - A.r) / step) * step) : flat - A.r);
    m.dir = Math.atan2(dz, dx); m.b = { x: A.x + dx / flat * (size + A.r), y: A.y, z: A.z + dz / flat * (size + A.r) };
  }
  function setA(m, p) {
    if (!p) return;
    const A0 = endPos(m.a), dx = p.x - A0.x, dz = p.z - A0.z, dy = (p.y || 0) - A0.y;
    if (m.k === 'rule') { m.a = { ...p }; return; }
    // a template moves whole: its origin goes to the point (onto a pawn: it starts at that pawn's edge), its end comes along
    const tpl = tplOf(m); m.a = { ...p }; const A = endPos(m.a);
    m.b = { x: A.x + Math.cos(tpl.dir) * (tpl.size + A.r), y: A.y, z: A.z + Math.sin(tpl.dir) * (tpl.size + A.r) };
    void dx; void dz; void dy;
  }
  function setShape(m, k) {
    if (m.k === k) return;
    const was = m.k; m.k = k; if (k !== 'rule') touchKeep();
    if (was === 'rule') { const B = endPos(m.b); m.b = { x: B.x, y: B.y, z: B.z }; setB(m, { ...m.b }); } // (its end lets go of a pawn: a template has a size, not a second pawn)
    if (k === 'rule') delete m.fixed;
  }

  // ---------------- arming: the measure key, the menu, the bar ----------------
  const escClose = () => { if (dragging) return false; if (live || armed || keepBar) { cancel(); return; } if (sel) { select(null); return; } return false; };
  const pushEsc = () => { if (!app.escapeStack.includes(escClose)) app.escapeStack.push(escClose); };
  function setCursor() { canvas.classList.toggle('measuring', !!armed || (!!live && live.stage !== 'set')); }
  function arm({ hold = false, shape = null } = {}) {
    if (app.mode) app.modes.cancel();
    dismissKeep(); armed = { hold, shape }; select(null);
    // STARTING WITH A PAWN SELECTED STARTS FROM THAT PAWN: the ruler is already out, from it to the pointer
    const one = app.selected().length === 1 ? app.selected()[0] : null;
    if (one?.kind === 'token') { live = { k: shape || 'rule', a: { x: one.x, y: one.y || 0, z: one.z, pawn: one.id }, b: { x: one.x, y: one.y || 0, z: one.z }, stage: 'aim' }; if (lastPtr) setB(live, pick(lastPtr[0], lastPtr[1])); }
    else if (live && live.stage !== 'set') live = null;
    pushEsc(); setCursor(); wake();
  }
  function disarm() { armed = null; setCursor(); }
  function cancel() { dismissKeep(); live = null; armed = null; roundsText = ''; setCursor(); wake(); }
  // a measurement was finished (its second end is down)
  function finish() {
    if (!live) return;
    live.stage = 'set'; if (live.k !== 'rule') touchKeep(); delete live.fixed; delete live.follow; // (placed: from here its handles change its size like any other)
    if (live.k === 'rule') { const A = endPos(live.a), B = endPos(live.b); if (Math.hypot(B.x - A.x, B.z - A.z, B.y - A.y) < 0.5 && !(A.pawn && B.pawn && A.pawn !== B.pawn)) live = null; }
    if (armed && !armed.hold) armed = null;
    pushEsc(); setCursor(); wake();
  }
  // "cone 15" in the bar: dropped from the selected pawn, aimed with the pointer, fixed with a click
  function drop(shape, size, width) {
    if (app.mode) app.modes.cancel();
    dismissKeep(); select(null); armed = null;
    const one = app.selected().length === 1 && app.selected()[0].kind === 'token' ? app.selected()[0] : null;
    const at = lastPtr && pick(lastPtr[0], lastPtr[1], { snap: false }), c = app.main?.grab.focus;
    const o = one ? { x: one.x, y: one.y || 0, z: one.z, pawn: one.id } : at || (c ? { x: c.x, y: 0, z: c.z } : null);
    if (!o) return false;
    const round = shape === 'circle' || shape === 'sphere';
    live = { k: shape, a: round && one ? { ...(at || { x: one.x, y: one.y || 0, z: one.z }) } : o, b: { x: o.x + size, y: o.y, z: o.z }, w: width || undefined, fixed: size, src: one?.id || null, stage: 'aim', follow: !one && !round ? 'origin' : null };
    if (live.follow) live.b = { x: o.x + size, y: o.y, z: o.z };
    else if (at) setB(live, at); else { const A = endPos(live.a); live.b = { x: A.x + size + A.r, y: A.y, z: A.z }; }
    pushEsc(); setCursor(); wake();
    return true;
  }

  // ---------------- the pointer ----------------
  const inPip = (ev) => { if (!app.pip) return false; const r = canvas.getBoundingClientRect(); return app.pip.contains(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height); };
  const take = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  addEventListener('pointerdown', (ev) => {
    if (keyDown) keyDown.used = true;
    if ((keepBar || (live?.k !== 'rule' && live?.stage === 'set')) && !ev.target.closest?.(keepBar ? '#rulers' : '#rulers, #bar')) {
      dismissKeep(); if (live?.k !== 'rule') live = null; wake();
    }
    if (ev.target !== canvas || ev.button !== 0 || !app.main || inPip(ev)) return;
    if (app.spaceHeld?.() || ev.altKey || ev.ctrlKey || ev.metaKey) return; // the camera's, and the ping's
    if (live?.stage === 'aim') { // the second click: this is the far end
      take(ev);
      if (live.follow === 'origin') { const p = pick(ev.clientX, ev.clientY); if (p) { live.a = p; const A = endPos(live.a); live.b = { x: A.x + live.fixed + A.r, y: A.y, z: A.z }; live.follow = null; if (live.k === 'circle' || live.k === 'sphere') finish(); } return; }
      setB(live, pick(ev.clientX, ev.clientY), ev); finish(); return;
    }
    if (armed && !app.mode) { // the first end goes down; the drag (or the next click) puts the second
      take(ev);
      const p = pick(ev.clientX, ev.clientY); if (!p) return;
      live = { k: armed.shape || 'rule', a: p, b: { x: p.x, y: p.y, z: p.z }, stage: 'draw' };
      dragging = { kind: 'draw', x: ev.clientX, y: ev.clientY, id: ev.pointerId, moved: false };
      wake(); return;
    }
    // A CLICK ELSEWHERE lets a measurement go (and a kept template's selection). A press on a PAWN does not: a ruler
    // follows the pawns it is on, so dragging one is how you ask "and from here?"
    const onPawn = !!pawnOf(app.hover);
    if (live?.stage === 'set' && !onPawn) { live = null; roundsText = ''; wake(); }
    if (sel && !onPawn) select(null);
  }, true);
  addEventListener('pointermove', (ev) => {
    lastPtr = [ev.clientX, ev.clientY];
    if (dragging?.kind === 'draw' && live) {
      if (Math.hypot(ev.clientX - dragging.x, ev.clientY - dragging.y) > DRAG_PX) dragging.moved = true;
      if (dragging.moved) { setB(live, pick(ev.clientX, ev.clientY), ev); wake(); }
      ev.stopPropagation(); return;
    }
    if (dragging?.kind === 'handle') { moveHandle(ev); ev.stopPropagation(); return; }
    if (live?.stage === 'aim' && (ev.target === canvas || ev.target === layer)) {
      if (live.follow === 'origin') { const p = pick(ev.clientX, ev.clientY); if (p) { live.a = p; const A = endPos(live.a); live.b = { x: A.x + live.fixed + A.r, y: A.y, z: A.z }; } }
      else setB(live, pick(ev.clientX, ev.clientY), ev);
      wake();
    }
  }, true);
  const pointerUp = (ev) => {
    if (dragging?.kind === 'draw') {
      const d = dragging; dragging = null; ev.stopPropagation();
      if (!live) return;
      if (d.moved) { setB(live, pick(ev.clientX, ev.clientY), ev); finish(); }
      else { live.stage = 'aim'; setCursor(); } // a click, not a drag: the far end now follows the pointer until the next click
      return;
    }
    if (dragging?.kind === 'handle') { ev.stopPropagation(); endHandle(ev); }
  };
  addEventListener('pointerup', pointerUp, true);
  addEventListener('pointercancel', (ev) => { if (dragging?.kind === 'draw') { dragging = null; live = null; wake(); } else if (dragging) pointerUp(ev); }, true);

  // THE MEASURE KEY: hold, or tap, like the launchers (surfaces/tray.js). HOLD M: the tool is on while the key is down
  // (with a pawn selected the ruler is already out; point, read, let go and it stays). TAP M: on for one measurement.
  addEventListener('keydown', (ev) => {
    if (keyDown && ev.key.toLowerCase() !== 'm' && !['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) keyDown.used = true;
    if (ev.key.toLowerCase() !== RULER_KEYS.measure.toLowerCase() || ev.ctrlKey || ev.metaKey || ev.altKey || inField(ev.target) || app.chordState?.()) return;
    if (['pawns', 'build', 'settings'].some(n => app.tray?.takesKeys(n))) return; // an open menu owns its letters
    const c = R.get('measure.start'); if (!c || !R.permitted(c, R.ctx())) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (ev.repeat || keyDown) return;
    if (armed && !armed.hold) { cancel(); return; } // tapped again: off
    keyDown = { t: ev.timeStamp, used: false };
    R.run(c);
  }, true);
  const keyUp = (forced, at = performance.now()) => {
    if (!keyDown) return;
    const k = keyDown; keyDown = null;
    const held = forced || at - k.t >= (app.tray?.holdMs || 350);
    S.lastKey = { ms: Math.round(at - k.t), held, used: k.used }; // (tests)
    if (!held) { if (armed) armed.hold = false; return; } // a tap: the tool stays on for one measurement
    // let go after a hold: what is out stays where it is (its far end is wherever the pointer was), and the tool is off
    if (live && live.stage === 'aim') { const A = endPos(live.a), B = endPos(live.b); if (Math.hypot(B.x - A.x, B.z - A.z) > 0.5) finish(); else live = null; }
    if (armed) armed = null;
    setCursor(); wake();
  };
  addEventListener('keyup', (ev) => { if (keyDown && ev.key.toLowerCase() === RULER_KEYS.measure.toLowerCase()) keyUp(false, ev.timeStamp); }, true);
  addEventListener('blur', () => keyUp(true));

  // ---------------- handles: both ends can be dragged again ----------------
  function startHandle(ev, which, target) {
    ev.stopPropagation(); ev.preventDefault();
    const m = target === 'live' ? live : (sel.m = sel.m || modelOf(ents()[sel.id]));
    if (!m) return;
    dragging = { kind: 'handle', which, target, m, id: ev.pointerId }; wake();
  }
  function moveHandle(ev) {
    const d = dragging, p = pick(ev.clientX, ev.clientY, { snap: d.which === 'a' || d.m.k === 'rule' });
    if (!p) return;
    if (d.which === 'a') setA(d.m, p); else setB(d.m, p, ev);
    wake();
  }
  function endHandle(ev) {
    const d = dragging; dragging = null;
    if (ev?.clientX != null) { const p = pick(ev.clientX, ev.clientY, { snap: d.which === 'a' || d.m.k === 'rule' }); if (p) { if (d.which === 'a') setA(d.m, p); else setB(d.m, p, ev); } }
    if (d.target === 'kept' && sel) commitSel();
    wake();
  }
  // a kept template's model, as dragged, goes back through the one door
  function commitSel() {
    const e = ents()[sel?.id], m = sel?.m; if (!e || !m) return;
    const t = tplOf(m), g = MS.resolve(t, ents(), drawnAt);
    const args = t.attach ? { id: e.id, x: r2(t.x), z: r2(t.z), y: r2(t.y), dir: r2(t.dir), size: r2(t.size), attach: t.attach } : { id: e.id, x: r2(g.x), z: r2(g.z), y: r2(g.y), dir: r2(g.dir), size: r2(g.size), ...(e.attach && { attach: '' }) };
    const hidden = app.gm() && mustHide(args.attach || null, g); if (hidden && !e.hidden) args.hidden = true;
    app.dispatch('template.set', args);
    sel.hold = performance.now(); // (the model stays in the hand until the state has caught up)
  }
  // must this template be hidden (the GM side only: it stands in a hidden room, or rides a hidden pawn)?
  const mustHide = (attach, g) => { const p = pawnOf(attach); if (p) return !!p.hidden; const f = floorUnder(ents(), g.x, g.z, g.y || 0); return !!(f && ents()[f.room]?.hidden); };

  // ---------------- keep ----------------
  function keep(options = {}) {
    const m = keepBar?.m || live;
    if (!m || m.k === 'rule') return null;
    const fresh = !keepBar;
    if (fresh) keepBar = { m: structuredClone(m), id: newId('tpl'), session: newId('keep'), rounds: 0, attach: false };
    const bar = keepBar, existing = !fresh && ents()[bar.id];
    if (!fresh && !existing) { dismissKeep(); return null; }
    const rounds = options.rounds === undefined ? (existing?.rounds || 0) : Math.max(0, Math.min(MS.ROUNDS_MAX, Math.round(options.rounds) || 0));
    const attach = options.attach === undefined ? !!existing?.attach : !!options.attach;
    let args;
    if (fresh) {
      const t = tplOf(bar.m), g = MS.resolve(t, ents(), drawnAt), on = attach && t.attach;
      args = { id: bar.id, keepSession: bar.session, shape: t.shape, x: r2(on ? t.x : g.x), z: r2(on ? t.z : g.z), y: r2(on ? t.y : g.y), dir: r2(t.dir), size: r2(on ? t.size : g.size), ...(t.width && { width: t.width }), rounds, ...(on && { attach: t.attach }) };
      const src = bar.m.src || bar.m.a.pawn; if (pawnOf(src)) args.src = src;
      if (app.gm() && (mustHide(on ? t.attach : null, g) || pawnOf(src)?.hidden)) args.hidden = true;
    } else {
      // Kept state is the authority now. The original ruler's source pawn may have moved,
      // and combat may have reduced left since the previous click. Never replay that draft.
      args = { id: bar.id, keepSession: bar.session };
      if (options.rounds !== undefined && rounds !== (existing.rounds || 0)) args.rounds = rounds;
      if (options.attach !== undefined && attach !== !!existing.attach) {
        const g = MS.resolve(existing, ents(), drawnAt), pawn = attach && pawnOf(bar.m.a.pawn);
        if (pawn) {
          const p = drawnAt(pawn.id) || pawn;
          Object.assign(args, { attach: pawn.id, x: r2(p.x), z: r2(p.z), y: r2(p.y || 0),
            size: r2(Math.max(0.01, g.size - (['circle', 'sphere'].includes(existing.shape) ? MS.pawnRadius(pawn) : 0))) });
        } else if (!attach) Object.assign(args, { attach: '', x: r2(g.x), z: r2(g.z), y: r2(g.y), size: r2(g.size) });
        if (app.gm() && mustHide(args.attach || null, { ...existing, ...args })) args.hidden = true;
      }
    }
    bar.rounds = rounds; bar.attach = attach;
    // A no-op Keep sends only id/session: refresh the undo gesture without resetting countdown or geometry.
    app.dispatch(fresh ? 'template.place' : 'template.set', args);
    S.lastKept = bar.id;
    live = null; armed = null; touchKeep(); pushEsc(); setCursor(); wake();
    return bar.id;
  }
  function select(id) {
    if (id) dismissKeep();
    if ((sel?.id || null) === (id || null)) return;
    sel = id ? { id, m: null } : null; roundsText = '';
    if (sel) { live = null; armed = null; pushEsc(); setCursor(); }
    wake();
  }
  const remove = (id) => { const e = ents()[id]; if (!e || !mayEdit(e)) return false; app.dispatch('template.delete', { id }); if (sel?.id === id) select(null); return true; };
  const setRounds = (id, n) => { const e = ents()[id]; if (!e || !mayEdit(e)) return false; app.dispatch('template.set', { id, rounds: Math.max(0, Math.min(MS.ROUNDS_MAX, Math.round(n) || 0)) }); return true; };
  // who a template catches, as THIS seat holds the table (a player's page has no hidden pawns, so cannot list one)
  const caughtOf = (g, not) => { const out = []; for (const e of app.pawnList()) { if (e.id === not || !app.canSeePawn(e)) continue; const p = drawnAt(e.id) || e; if (MS.catches(g, { x: p.x, y: p.y || 0, z: p.z, size: e.size })) out.push(e); } return out; };
  function sayCaught() {
    const m = !keepBar && live && live.k !== 'rule' ? live : null, e = keepBar ? ents()[keepBar.id] : !m && sel ? ents()[sel.id] : null; if (!m && !e) return false;
    const t = m ? tplOf(m) : e, g = MS.resolve(t, ents(), drawnAt), names = caughtOf(g, t.attach).filter(p => !p.hidden).map(p => p.name); // (never a pawn hidden from players: the line is for the table)
    app.say(`${MS.templateName({ ...t, size: t.size }, units())} catches ${names.length ? `${names.length}: ${names.join(', ')}` : 'nobody'}`);
    return true;
  }

  // ---------------- commands (the one registry: bar, keys, the Pawns menu, the "?" sheet) ----------------
  const shapeModel = () => keepBar?.m || live;
  const hasShape = () => !!shapeModel() && shapeModel().k !== 'rule';
  const inHand = () => !!live || !!armed;
  R.add({ id: 'measure.start', title: 'Measure (drag from A to B)', short: 'Measure', synonyms: ['measure', 'ruler', 'distance', 'range', 'how far', 'tape'], icon: 'ruler', keys: [RULER_KEYS.measure], group: 'Measure', cls: 'template', pawnsMenu: 'measure', hint: 'hold M and point, or tap M and drag',
    run: () => { arm({ hold: !!keyDown }); if (!keyDown) app.toast(app.selected().length === 1 && app.selected()[0].kind === 'token' ? 'Measuring from the selected pawn: click where to' : 'Drag from A to B (an end on a pawn sticks to it)'); } });
  if (SHAPES_ON) for (const s of MS.SHAPES) {
    const name = MS.SHAPE_NAMES[s], syn = [s, `${s} template`, 'template', 'area of effect', 'aoe', 'spell area'];
    // with a measurement in the hand, its key turns THAT measurement into the shape ...
    R.add({ id: `measure.as.${s}`, title: `Make it a ${name.toLowerCase()}`, short: name, synonyms: syn, icon: SHAPE_ICON[s], keys: [RULER_KEYS.shape[s]], group: 'Measure', cls: 'template', when: inHand,
      run: () => { if (live) setShape(live, s); else if (armed) armed.shape = s; wake(); } });
    // ... with nothing in the hand (the bar, the Pawns menu's palette) the next measurement is drawn as that shape
    R.add({ id: `measure.shape.${s}`, title: `${name} template (drag from its origin)`, short: name, synonyms: syn, icon: SHAPE_ICON[s], group: 'Measure', cls: 'template', pawnsMenu: 'template', when: () => !inHand(),
      run: () => { arm({ shape: s }); app.toast(`${name}: drag from its origin`); } });
  }
  const SIZE_RE = /^(line|cone|circle|sphere|cube)\s+(\d{1,4}(?:\.\d)?)\s*(?:ft|feet|foot|')?(?:\s+(?:wide|w|x|by)\s*(\d{1,3})\s*(?:ft|feet|')?)?$/i;
  if (SHAPES_ON) R.add({ id: 'measure.typed', title: 'Template of a size', icon: 'ruler', group: 'Measure', hidden: true, cls: 'template',
    parse: (text) => { const m = String(text).trim().match(SIZE_RE); if (!m) return null; const size = +m[2]; return size > 0 && size <= MS.SIZE_MAX ? { shape: m[1].toLowerCase(), size, ...(m[3] && m[1].toLowerCase() === 'line' && { width: +m[3] }) } : null; },
    chips: (a, ctx) => [MS.SHAPE_NAMES[a.shape].toLowerCase(), MS.feetText(a.size, units()), ...(a.width ? [`${a.width} wide`] : []), '→', ctx.one?.kind === 'token' ? `from ${ctx.one.name}, aim with the pointer` : 'click where it starts'],
    run: (ctx, a) => { if (!a?.shape) return app.emit('bar.open', 'cone '); drop(a.shape, a.size, a.width); } });
  if (SHAPES_ON) R.add({ id: 'measure.keep', title: 'Keep this template', short: 'Keep', synonyms: ['keep', 'persist', 'make persistent', 'leave it'], icon: 'pin', keys: [RULER_KEYS.keep], group: 'Measure', cls: 'template', when: hasShape, run: () => keep() });
  if (SHAPES_ON) R.add({ id: 'measure.keepRounds', title: 'Keep this template for a number of rounds', icon: 'hourglass', group: 'Measure', hidden: true, cls: 'template', when: () => hasShape() || !!sel,
    parse: (text) => { const m = String(text).trim().match(/^(?:keep(?:\s+for)?|rounds?)\s+(\d{1,3})(?:\s+rounds?)?$/i); return m && (hasShape() || sel) ? { rounds: +m[1] } : null; },
    chips: (a) => [hasShape() ? 'keep for' : 'lasts', `${a.rounds} round${a.rounds === 1 ? '' : 's'}`], run: (ctx, a) => { if (!Number.isInteger(a?.rounds)) return; if (hasShape()) keep({ rounds: a.rounds }); else if (sel) setRounds(sel.id, a.rounds); } });
  if (SHAPES_ON) R.add({ id: 'measure.attach', title: () => `Keep it attached to ${pawnOf(shapeModel()?.a.pawn)?.name || 'the pawn'} (it travels with the pawn)`, short: 'Attach', synonyms: ['attach', 'aura', 'follow'], icon: 'link', group: 'Measure', cls: 'template', when: () => hasShape() && !!pawnOf(shapeModel()?.a.pawn), run: () => keep({ attach: true }) });
  if (SHAPES_ON) R.add({ id: 'measure.say', title: 'Say who is caught (in the chat)', synonyms: ['who is caught', 'who is hit', 'targets', 'caught'], icon: 'message-square', group: 'Measure', cls: 'chat', when: () => hasShape() || !!sel, run: () => sayCaught() });
  if (SHAPES_ON) R.add({ id: 'template.remove', title: 'Remove this template', synonyms: ['remove template', 'delete template', 'dismiss'], icon: 'trash-2', keys: ['Delete', 'Backspace'], group: 'Measure', cls: 'template', when: () => !!sel && mayEdit(ents()[sel.id]), run: () => remove(sel.id) });
  if (SHAPES_ON) R.add({ id: 'template.clear', title: 'Clear all templates (this area)', synonyms: ['clear templates', 'remove all templates', 'clear measurements', 'clear rulers'], icon: 'trash-2', group: 'Measure', cls: (ctx) => ctx.gm ? 'template' : null, when: () => templates().length > 0, pawnsMenu: 'gm',
    run: () => { const n = templates().length; app.dispatch('template.clear', {}); select(null); app.toast(`${n} template${n === 1 ? '' : 's'} cleared (Ctrl+Z brings them back)`); } });
  // ---------------- drawing: three.js ----------------
  const visuals = new Map(); // key -> Visual
  const mats = new Set();
  const lineMat = (color, width, opacity) => { const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false }); mats.add(m); return m; };
  const flat = (obj, order) => { obj.renderOrder = order; obj.userData.halo = true; obj.userData.noPick = true; obj.userData.ruler = true; obj.raycast = () => {}; obj.frustumCulled = false; return obj; };
  const CELL_PLATE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  function makeVisual(layerGroup) {
    const group = new THREE.Group(); group.userData.ruler = true; layerGroup.add(group);
    const casing = flat(new LineSegments2(new LineSegmentsGeometry(), lineMat(L.casing, L.casingWidth, L.casingOpacity)), 30);
    const line = flat(new LineSegments2(new LineSegmentsGeometry(), lineMat('#ffffff', L.lineWidth, 1)), 31);
    const fill = flat(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: L.fillOpacity, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide, toneMapped: false })), 27);
    group.add(fill, casing, line);
    return { group, casing, line, fill, cells: null, sig: '', layerGroup };
  }
  function dropVisual(key) {
    const v = visuals.get(key); if (!v) return;
    v.layerGroup.remove(v.group);
    for (const o of [v.casing, v.line]) { o.geometry.dispose(); mats.delete(o.material); o.material.dispose(); }
    v.fill.geometry.dispose(); v.fill.material.dispose();
    if (v.cells) { v.cells.material.dispose(); v.cells.dispose?.(); }
    visuals.delete(key);
  }
  const circlePts = (cx, cz, r, n = SEG) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
  const loop = (pts, y, out) => { for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; out.push(p[0], y, p[1], q[0], y, q[1]); } };
  // the segments of an item: a ruler's one line; a template's outline on its floor (and what says "this one is 3D")
  function segmentsOf(it) {
    const out = [];
    if (it.from) { out.push(it.from.x, it.from.y + L.lift, it.from.z, it.to.x, it.to.y + L.lift, it.to.z); return out; }
    const g = it.g, y = g.y + L.lift, o = MS.outline(g) || circlePts(g.x, g.z, g.size);
    loop(o, y, out);
    if (g.shape === 'cube') { loop(o, g.y + g.size, out); for (const p of o) out.push(p[0], y, p[1], p[0], g.y + g.size, p[1]); } // its top and its four corners
    if (g.shape === 'sphere') { // a globe: GLOBE_LAT parallels (the equator is the outline above) and GLOBE_LON meridians
      const n = SEG, R = g.size;
      for (let k = 1; k <= GLOBE_LAT / 2; k++) { const ph = k * Math.PI / 2 / (GLOBE_LAT / 2 + 1), rr = Math.cos(ph) * R, hh = Math.sin(ph) * R; for (const sgn of [1, -1]) loop(circlePts(g.x, g.z, rr, n), g.y + sgn * hh, out); }
      for (let k = 0; k < GLOBE_LON / 2; k++) { // a great circle is two meridians
        const a = g.dir + k * 2 * Math.PI / GLOBE_LON, ux = Math.cos(a), uz = Math.sin(a);
        for (let i = 0; i < n; i++) { const t0 = i / n * Math.PI * 2, t1 = (i + 1) / n * Math.PI * 2; out.push(g.x + ux * Math.cos(t0) * R, g.y + Math.sin(t0) * R, g.z + uz * Math.cos(t0) * R, g.x + ux * Math.cos(t1) * R, g.y + Math.sin(t1) * R, g.z + uz * Math.cos(t1) * R); }
      }
    }
    if (g.shape === 'cone') { // a real cone: apex at the origin, a round flat end of radius size/2 across the aim, GLOBE_LON ribs between
      const ux = Math.cos(g.dir), uz = Math.sin(g.dir), nx = -uz, nz = ux, R = g.size / 2, bx = g.x + ux * g.size, bz = g.z + uz * g.size, n = SEG, rim = (t) => [bx + nx * Math.cos(t) * R, g.y + Math.sin(t) * R, bz + nz * Math.cos(t) * R];
      for (let i = 0; i < n; i++) { const p = rim(i / n * Math.PI * 2), q = rim((i + 1) / n * Math.PI * 2); out.push(...p, ...q); }
      for (let k = 0; k < CONE_RIBS; k++) { const p = rim(k / CONE_RIBS * Math.PI * 2); out.push(g.x, g.y, g.z, ...p); }
    }
    if (it.range) out.push(it.range.from.x, it.range.from.y + L.lift, it.range.from.z, g.x, y, g.z); // a typed circle's reach from its caster
    return out;
  }
  function fanOf(g) {
    if (g.shape === 'sphere') { const sg = new THREE.SphereGeometry(g.size, 32, 16).toNonIndexed(), pa = sg.getAttribute('position'), r = new Float32Array(pa.array.length); for (let i = 0; i < pa.count; i++) { r[i * 3] = pa.getX(i) + g.x; r[i * 3 + 1] = pa.getY(i) + g.y; r[i * 3 + 2] = pa.getZ(i) + g.z; } sg.dispose(); return r; }
    if (g.shape === 'cone') { // the cone's side (apex to rim) and its round flat end
      const ux = Math.cos(g.dir), uz = Math.sin(g.dir), nx = -uz, nz = ux, R = g.size / 2, bx = g.x + ux * g.size, bz = g.z + uz * g.size, n = 48, pos = [];
      const rim = (i) => { const t = i / n * Math.PI * 2; return [bx + nx * Math.cos(t) * R, g.y + Math.sin(t) * R, bz + nz * Math.cos(t) * R]; };
      for (let i = 0; i < n; i++) { const p = rim(i), q = rim(i + 1); pos.push(g.x, g.y, g.z, ...p, ...q, bx, g.y, bz, ...q, ...p); }
      return new Float32Array(pos);
    }
    const o = MS.outline(g) || circlePts(g.x, g.z, g.size), y = g.y + L.lift * 0.6, pos = [];
    let cx = 0, cz = 0; for (const p of o) { cx += p[0]; cz += p[1]; } cx /= o.length; cz /= o.length;
    for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; pos.push(cx, y, cz, p[0], y, p[1], q[0], y, q[1]); }
    return new Float32Array(pos);
  }
  function drawVisual(key, it, layerGroup) {
    let v = visuals.get(key);
    if (v && v.layerGroup !== layerGroup) { dropVisual(key); v = null; }
    if (!v) visuals.set(key, v = makeVisual(layerGroup));
    const quiet = it.quiet && !it.hot, lineO = it.quiet ? (it.hot ? L.hotLineOpacity : L.keptLineOpacity) : 1, fillO = it.quiet ? (it.hot ? L.hotFillOpacity : L.keptFillOpacity) : L.fillOpacity, cellO = it.quiet ? (it.hot ? L.hotCellOpacity : L.keptCellOpacity) : L.cellOpacity;
    const width = it.kind === 'move' ? L.moveWidth : quiet ? L.keptLineWidth : L.lineWidth;
    const sig = it.from ? `L|${[it.from.x, it.from.y, it.from.z, it.to.x, it.to.y, it.to.z].map(r2).join()}` : `S|${it.g.shape}|${[it.g.x, it.g.y, it.g.z, it.g.dir, it.g.size, it.g.width].map(r2).join()}|${it.range ? [it.range.from.x, it.range.from.z].map(r2).join() : ''}`;
    v.line.material.color.set(it.color); v.line.material.linewidth = width; v.line.material.opacity = lineO;
    v.casing.material.linewidth = width + (L.casingWidth - L.lineWidth); v.casing.material.opacity = L.casingOpacity * (quiet ? 0.55 : 1);
    v.fill.material.color.set(it.color); v.fill.material.opacity = fillO;
    if (v.cells) v.cells.material.opacity = cellO;
    v.group.visible = true;
    if (sig === v.sig) return v;
    v.sig = sig;
    const seg = segmentsOf(it); v.segCount = seg.length / 6;
    for (const o of [v.casing, v.line]) { o.geometry.dispose(); o.geometry = new LineSegmentsGeometry(); o.geometry.setPositions(seg); }
    v.fill.geometry.dispose(); v.fill.geometry = new THREE.BufferGeometry(); v.fill.visible = !!it.g;
    if (v.cells) { v.group.remove(v.cells); v.cells.material.dispose(); v.cells.dispose?.(); v.cells = null; }
    if (it.g) {
      v.fill.geometry.setAttribute('position', new THREE.BufferAttribute(fanOf(it.g), 3));
      const cs = MS.cells(it.g);
      if (cs.length) {
        const m = flat(new THREE.InstancedMesh(CELL_PLATE, new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: cellO, depthWrite: false, depthTest: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide, toneMapped: false }), cs.length), 28);
        const M = new THREE.Matrix4(), s = MS.CELL - L.cellInset * 2, y = it.g.y + L.lift * 0.8;
        cs.forEach(([x, z], i) => { M.makeScale(s, 1, s); M.setPosition(x, y, z); m.setMatrixAt(i, M); });
        m.instanceMatrix.needsUpdate = true; v.cells = m; v.group.add(m);
      }
      v.cellCount = cs.length;
    } else v.cellCount = 0;
    return v;
  }
  // the ring round a caught pawn (one per pawn, whatever catches it)
  const rings = new Map(); let ringGeo = null;
  const ringFor = (size) => { ringGeo ||= new Map(); if (!ringGeo.has(size)) { const r = MS.pawnRadius({ size }) + L.caughtGap; ringGeo.set(size, [new THREE.RingGeometry(r, r + L.caughtWidth, 64).rotateX(-Math.PI / 2), new THREE.RingGeometry(r - 0.16, r + L.caughtWidth + 0.16, 64).rotateX(-Math.PI / 2)]); } return ringGeo.get(size); };
  function dropRing(id) { const r = rings.get(id); if (!r) return; r.layer.remove(r.g); r.ring.material.dispose(); r.back.material.dispose(); rings.delete(id); }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');

  // ---------------- drawing: the words, the handles, the buttons (DOM, so the text always faces the camera) ----------------
  const dom = new Map(); // key -> element
  const v3 = new THREE.Vector3();
  function screen(p, lift = 0) {
    const cam = app.main.camera, r = canvas.getBoundingClientRect(), [l, t, w, h] = app.main.rect;
    v3.set(p.x, (p.y || 0) + lift, p.z).project(cam);
    return { x: r.left + (l + (v3.x + 1) / 2 * w) * r.width, y: r.top + (t + (1 - v3.y) / 2 * h) * r.height, ok: v3.z > -1 && v3.z < 1 };
  }
  function el(key, cls, make) {
    let e = dom.get(key);
    if (!e) { e = document.createElement(cls.startsWith('rhandle') || cls.startsWith('rchip') ? 'button' : 'div'); e.dataset.key = key; if (e.tagName === 'BUTTON') { e.tabIndex = -1; e.addEventListener('mousedown', (ev) => ev.preventDefault()); } layer.append(e); dom.set(key, e); make?.(e); }
    if (e.className !== cls) e.className = cls;
    return e;
  }
  const put = (e, s, dx = 0, dy = 0) => { e.hidden = !s.ok; if (s.ok) e.style.transform = `translate(${Math.round(s.x + dx)}px, ${Math.round(s.y + dy)}px)`; };
  const text = (e, t) => { if (e._t !== t) { e._t = t; e.textContent = t; } };
  const html = (e, h) => { if (e._h !== h) { e._h = h; e.innerHTML = h; return true; } return false; };

  // the row of buttons beside a measurement: the conditional-button pattern (surfaces/condbutton.js): it exists only
  // while its measurement is in the hand, sits beside it and never over it, never takes the focus, and everything it
  // does is also in the command bar and on a key.
  function stripHtml(mode, ctx) {
    const b = (act, label, { ic = null, key = null, on = false, tip = '', cls = '' } = {}) => `<button class="cbtn rsbtn${on ? ' on' : ''} ${cls}" data-act="${act}" tabindex="-1"${tip ? ` data-tip="${esc(tip)}"` : ''}>${ic ? icon(ic, 14) : ''}<span>${esc(label)}</span>${key ? `<kbd>${esc(key)}</kbd>` : ''}</button>`;
    const shapes = MS.SHAPES.map(s => b(`shape:${s}`, MS.SHAPE_NAMES[s], { ic: SHAPE_ICON[s], key: RULER_KEYS.shape[s], on: ctx.k === s, tip: SHAPE_TIPS[s] })).join('');
    const rounds = (act) => `${L.roundsPresets.map(n => b(`${act}:${n}`, `${n} round${n === 1 ? '' : 's'}`, { ic: 'hourglass', tip: `It lasts ${n} round${n === 1 ? '' : 's'}: a thin row in the turn order counts it down` })).join('')}<label class="cbtn rsbtn rnum" data-tip="A number of rounds, then Enter"><input type="number" min="1" max="${MS.ROUNDS_MAX}" inputmode="numeric" placeholder="N" data-rounds="${act}" value="${esc(roundsText)}" tabindex="-1"><span>rounds</span></label>`;
    if (mode === 'rule') return `<div class="rsrow">${shapes}</div>`;
    if (mode === 'shape') return `<div class="rsrow">${b('keep', 'Keep', { ic: 'pin', key: RULER_KEYS.keep, on: !!keepBar, tip: 'Keep with these settings' })}${b('keepfor:1', '1 round', { ic: 'hourglass', on: keepBar?.rounds === 1 })}${b('keepfor:n', 'N rounds', { ic: 'hourglass', on: (keepBar?.rounds || 0) > 1 })}<label class="cbtn rsbtn rnum"><input aria-label="Number of rounds" type="number" min="1" max="${MS.ROUNDS_MAX}" inputmode="numeric" placeholder="N" data-rounds="keepfor" value="${esc(roundsText)}" tabindex="-1"></label>${ctx.pawn ? b('attach', `Attach to ${ctx.pawn}`, { ic: 'link', on: !!keepBar?.attach, tip: 'Travels with this pawn; combines with rounds' }) : ''}</div>`;
    if (mode === 'expired') return `<div class="rsrow"><span class="rsnote">${esc(ctx.name)} expired</span>${b('remove', 'Remove', { ic: 'trash-2', tip: 'Remove it (this also happens by itself when the turn moves on)' })}${b('norounds', 'Keep', { ic: 'pin', tip: 'It stays, with no rounds, until someone removes it' })}</div>`;
    return `<div class="rsrow">${ctx.mine ? `${b('remove', 'Remove', { ic: 'trash-2', key: 'Del' })}${rounds('rounds')}${ctx.rounds ? b('norounds', 'No rounds', { ic: 'pin', tip: 'It stays until someone removes it' }) : ''}${ctx.attached ? b('detach', 'Detach', { ic: 'link', tip: 'Leave it where it is now: it no longer travels with the pawn' }) : ''}` : `<span class="rsnote">${esc(ctx.owner)}'s</span>`}${b('say', '', { ic: 'message-square', tip: 'Say who is caught, in the chat' })}</div>`;
  }
  const SHAPE_TIPS = { line: 'A line: this long, 5 ft wide', cone: 'A cone: as wide at any point as it is far from its origin', circle: 'A circle on the ground: this radius, one level high', sphere: 'A sphere: this radius in every direction, other levels and flyers too', cube: 'A cube: this long on every side, starting at its near face' };
  function stripAct(key, act, input) {
    const id = key.startsWith('strip:tpl:') ? key.slice(10) : null;
    const [a, n] = act.split(':');
    if (a === 'shape') { if (live) { setShape(live, n); wake(); } return; }
    if (a === 'keep') return void keep();
    if (a === 'keepfor') { const rounds = n === 'n' ? (+input || 2) : (+n || +input || 0); if (n === 'n' && !input) roundsText = '2'; return void keep({ rounds: keepBar?.rounds === rounds ? 0 : rounds }); }
    if (a === 'attach') return void keep({ attach: !keepBar?.attach });
    if (a === 'say') return void sayCaught();
    if (a === 'remove') return void remove(id || sel?.id);
    if (a === 'rounds') return void setRounds(id || sel?.id, +n || +input || 0);
    if (a === 'norounds') return void setRounds(id || sel?.id, 0);
    if (a === 'detach') { const e = ents()[id || sel?.id]; if (e) { const g = MS.resolve(e, ents(), drawnAt); app.dispatch('template.set', { id: e.id, attach: '', x: r2(g.x), z: r2(g.z), y: r2(g.y), size: r2(g.size) }); if (sel) sel.m = null; } }
  }
  layer.addEventListener('pointerdown', (ev) => {
    const h = ev.target.closest('.rhandle');
    if (h) { startHandle(ev, h.dataset.which, h.dataset.target); return; }
    if (ev.target.closest('.rstrip, .rchip')) { if (keepBar || live?.k !== 'rule') touchKeep(); ev.stopPropagation(); } // (a press on a button is not "a click elsewhere")
  });
  layer.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.rchip'); if (chip) { ev.stopPropagation(); select(sel?.id === chip.dataset.id ? null : chip.dataset.id); return; }
    const b = ev.target.closest('[data-act]'), strip = ev.target.closest('.rstrip'); if (!b || !strip) return;
    ev.stopPropagation(); stripAct(strip.dataset.key, b.dataset.act, strip.querySelector('input')?.value);
  });
  layer.addEventListener('input', (ev) => { if (ev.target.matches('[data-rounds]')) { roundsText = ev.target.value; touchKeep(); if (ev.target.dataset.rounds === 'keepfor' && +roundsText > 0) keep({ rounds: +roundsText }); } });
  layer.addEventListener('keydown', (ev) => {
    if (!ev.target.matches('[data-rounds]')) return;
    ev.stopPropagation();
    if (ev.key === 'Enter') { const strip = ev.target.closest('.rstrip'), n = Math.round(+ev.target.value); if (n > 0) { if (ev.target.dataset.rounds === 'keepfor') keep({ rounds: n }); else stripAct(strip.dataset.key, `${ev.target.dataset.rounds}:${n}`); } ev.target.blur(); }
    if (ev.key === 'Escape') { ev.target.blur(); cancel(); }
  });

  // ---------------- every frame ----------------
  const S = app.rulers = {
    LOOK: L, KEYS: RULER_KEYS, KEEP_BAR_IDLE_MS, arm, cancel, drop, keep, select, remove, setRounds, sayCaught,
    setShape: (k) => { if (live) { setShape(live, k); wake(); } },
    // (tests, and other front ends) a measurement put straight into the hand: ends are { x, y, z } or { pawn }
    start(a, b, k = 'rule') { dismissKeep(); const E = (p) => p.pawn ? { x: ents()[p.pawn].x, y: ents()[p.pawn].y || 0, z: ents()[p.pawn].z, pawn: p.pawn } : { x: p.x, y: p.y || 0, z: p.z }; select(null); live = { k: 'rule', a: E(a), b: E(b), stage: 'set' }; if (k !== 'rule') setShape(live, k); pushEsc(); wake(); return S.state(); },
    live: () => live, armed: () => armed, selected: () => sel?.id || null,
    items: [], // what was drawn this frame: { key, kind, text, caught: [ids], g?, from?, to?, quiet, hot, color }
    state: () => ({ armed: armed ? { ...armed } : null, live: live ? { k: live.k, stage: live.stage, a: { ...live.a }, b: { ...live.b }, fixed: live.fixed || null } : null, sel: sel?.id || null, hover: hoverId, items: S.items.map(i => ({ key: i.key, kind: i.kind, text: i.text, caught: i.caught || [], quiet: !!i.quiet, hot: !!i.hot, color: i.color, cells: visuals.get(i.key)?.cellCount || 0, segs: visuals.get(i.key)?.segCount || 0 })), rings: [...rings.keys()], strips: [...layer.querySelectorAll('.rstrip:not([hidden])')].map(e => ({ key: e.dataset.key, buttons: [...e.querySelectorAll('[data-act]')].map(b => b.dataset.act) })) }),
    distance: (a, b, opts) => MS.distance(a, b, rule(), opts), format: (d) => MS.format(d, { units: units() }),
  };
  const colorOf = (seatId) => app.seatColor(seatId);
  // a ruler between two resolved ends -> an item
  function ruleItem(key, kind, A, B, color) {
    const d = MS.distance(A, B, rule(), { ra: A.r, rb: B.r }), dx = B.x - A.x, dz = B.z - A.z, flat = Math.hypot(dx, dz);
    // drawn from base edge to base edge, as it is measured
    const ux = flat > 1e-6 ? dx / flat : 0, uz = flat > 1e-6 ? dz / flat : 0, clip = flat > A.r + B.r;
    const from = clip ? { x: A.x + ux * A.r, y: A.y, z: A.z + uz * A.r } : { x: A.x, y: A.y, z: A.z }, to = clip ? { x: B.x - ux * B.r, y: B.y, z: B.z - uz * B.r } : { x: B.x, y: B.y, z: B.z };
    return { key, kind, from, to, d, text: MS.format(d, { units: units() }), color, at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 } };
  }
  function shapeItem(key, g, color, { not = null, quiet = false, hot = false, name = null, extra = '' } = {}) {
    const caught = quiet && !hot ? [] : caughtOf(g, not), mid = g.shape === 'circle' || g.shape === 'sphere' ? { x: g.x, y: g.y, z: g.z } : { x: g.x + Math.cos(g.dir) * g.size / 2, y: g.y, z: g.z + Math.sin(g.dir) * g.size / 2 };
    return { key, kind: g.shape, g, color, quiet, hot, caught: caught.map(e => e.id), names: caught.map(e => e.name), at: mid, text: `${name || `${MS.SHAPE_NAMES[g.shape]} ${MS.feetText(g.nominal ?? g.size, units())}`}${quiet && !hot ? '' : ` · ${caught.length} caught`}${extra}` };
  }
  // a handle never sits on the middle of a pawn (the pawn must stay easy to grab): a ruler's is where its line meets
  // the base; a template's is its origin, and for an aura (centred on its pawn) it hangs just under the pawn
  const handleA = (g, attach) => ({ x: g.x, y: g.y, z: g.z, under: !!pawnOf(attach) && (g.shape === 'circle' || g.shape === 'sphere') });
  let wasBusy = false, sentRuler = false, lastArea = null;
  function frame() {
    const area = app.area(), w = world();
    if (area !== lastArea) { lastArea = area; dismissKeep(); live = null; armed = null; sel = null; dragging = null; setCursor(); }
    const move = app.moveDrag?.pawns || null, kept = w && app.view(area) ? templates() : [];
    let remote = false; for (const s of app.pv.seats.values()) if (s.ruler && s.area === area && s.seat !== app.me()) { remote = true; break; }
    const busy = !!(live || armed || move || remote || kept.length || sel);
    if (!busy && !wasBusy) return; // nothing measured anywhere: nothing to do
    wasBusy = busy;
    const items = [], E = ents(), cutY = app.cut?.y ?? null, hiddenByCut = (y) => cutY != null && y > cutY + 0.5;
    const W = canvas.clientWidth, H = canvas.clientHeight; for (const m of mats) m.resolution.set(W, H);
    if (!w || !app.main) return;
    // 1. a dragged pawn's travelled line (mine)
    let mine = null;
    if (move && E[move.lead]?.kind === 'token') {
      const e = E[move.lead], A = { x: e.x, y: e.y || 0, z: e.z, r: 0 }, B = { x: e.x + move.dx, y: (e.y || 0) + move.dy, z: e.z + move.dz, r: 0 };
      if (Math.hypot(move.dx, move.dz, move.dy) > 0.01) { items.push(ruleItem('move', 'move', A, B, app.myColor())); mine = { k: 'move', a: [A.x, A.z, A.y], b: [B.x, B.z, B.y], ap: e.id }; }
    }
    // 2. what is in my hand
    if (live) {
      if (live.k === 'rule') {
        const A = endPos(live.a), B = endPos(live.b), it = ruleItem('live', 'rule', A, B, app.myColor()); it.handles = live.stage === 'set' ? { a: A.pawn ? it.from : A, b: B.pawn ? it.to : B } : null; it.mode = live.stage === 'set' && SHAPES_ON ? 'rule' : null; items.push(it);
        mine = { k: 'rule', a: [A.x, A.z, A.y], b: [B.x, B.z, B.y], ...(A.pawn && { ap: A.pawn }), ...(B.pawn && { bp: B.pawn }) };
      } else {
        const t = tplOf(live), g = MS.resolve(t, E, drawnAt); g.nominal = t.size;
        const src = pawnOf(live.src), range = src && !live.a.pawn && (live.k === 'circle' || live.k === 'sphere') ? { from: drawnAt(src.id) || src, d: MS.distance({ ...(drawnAt(src.id) || src), y: (drawnAt(src.id) || src).y || 0 }, g, rule(), { ra: MS.pawnRadius(src) }) } : null;
        const it = shapeItem('live', g, app.myColor(), { not: t.attach, extra: range ? ` · ${MS.feetText(range.d.ft, units())} away` : '' });
        it.range = range; it.handles = live.stage === 'set' ? { a: handleA(g, t.attach), b: MS.endOf(g) } : null; it.mode = live.stage === 'set' ? 'shape' : null; it.pawn = pawnOf(t.attach)?.name || null;
        items.push(it);
        const end = MS.endOf(g); mine = { k: g.shape, a: [g.x, g.z, g.y], b: [end.x, end.z, end.y], ...(t.attach && { ap: t.attach }), ...(g.shape === 'line' && t.width && { w: t.width }) };
      }
    }
    // 3. what other seats are measuring (presence)
    for (const s of app.pv.seats.values()) {
      const r = s.ruler; if (!r || s.area !== area || s.seat === app.me()) continue;
      if(r.k==='move' && r.ap && app.canSeePawn && !app.canSeePawn(E[r.ap],area))continue; // no trail from an unseen pawn
      const P = (v, id) => { const e = pawnOf(id); return { x: v[0], z: v[1], y: v[2] || 0, r: e && r.k === 'rule' ? MS.pawnRadius(e) : 0, pawn: e?.id || null }; };
      const A = P(r.a, r.ap), B = P(r.b, r.bp), key = `seat:${s.seat}`;
      if (hiddenByCut(Math.min(A.y, B.y))) continue;
      if (app.fogShows && !(app.fogShows(s.seat, A.x, A.z, A.y, area) && app.fogShows(s.seat, B.x, B.z, B.y, area))) continue; // the GM's ruler over ground I cannot see (core/fog.js GM_CURSOR_THROUGH_FOG)
      let it;
      if (r.k === 'rule' || r.k === 'move') it = ruleItem(key, r.k, A, B, s.color || '#ffffff');
      else it = shapeItem(key, MS.fromEnds(r.k, A, B, r.w), s.color || '#ffffff', { not: r.ap || null });
      it.remote = s.name || 'someone'; if (r.k !== 'move') it.text = `${it.remote} · ${it.text}`;
      items.push(it);
    }
    // 4. the kept templates of this area
    hoverId = null;
    const cur = !live && !armed && !dragging && app.pointerView !== 'pip' ? app.cursor : null;
    for (const e of kept) {
      const editing = sel?.id === e.id && sel.m && (dragging?.target === 'kept' || (sel.hold && performance.now() - sel.hold < 1500));
      let g, t = e;
      if (editing) { t = { ...e, ...tplOf(sel.m), attach: sel.m.a.pawn || undefined }; g = MS.resolve(t, E, drawnAt); } else { g = MS.resolve(e, E, drawnAt); if (sel?.id === e.id && !dragging) sel.m = null; }
      if (hiddenByCut(g.y)) continue;
      g.nominal = t.size;
      const over = !!cur && Math.abs((cur.y || 0) - g.y) < L.levelFt + 1 && MS.inPlan(g, cur[0], cur[1]);
      if (over && !hoverId) hoverId = e.id;
      const hot = sel?.id === e.id || hoverId === e.id, own = seat(e.owner), left = TU.leftOf(e), fight = !!app.view(area)?.turns;
      const extra = `${e.rounds ? (left === 0 ? ' · expired' : ` · ${fight ? `${left} of ${e.rounds}` : e.rounds} round${e.rounds === 1 && !fight ? '' : 's'}${fight ? ' left' : ''}`) : ''}${own && e.owner !== app.me() ? ` · ${own.name}` : ''}${e.hidden ? ' · hidden from players' : ''}`;
      const it = shapeItem(`tpl:${e.id}`, g, e.hidden ? '#b48cff' : colorOf(e.owner), { not: e.attach, quiet: true, hot, name: e.name ? `${e.name} (${MS.feetText(t.size, units())})` : null, extra });
      it.id = e.id; it.entity = e; it.expired = !!e.rounds && left === 0;
      if (sel?.id === e.id) { it.mode = it.expired && mayEdit(e) ? 'expired' : 'kept'; if (mayEdit(e)) it.handles = { a: handleA(g, t.attach), b: MS.endOf(g) }; }
      else if (it.expired && mayEdit(e)) { if (keepBar?.id === e.id) dismissKeep(); it.mode = 'expired'; }
      else if (keepBar?.id === e.id) { keepBar.rounds = e.rounds || 0; keepBar.attach = !!e.attach; it.mode = 'shape'; it.pawn = pawnOf(keepBar.m.a.pawn)?.name || null; } // the offer: Remove / Keep (its owner and the GM)
      items.push(it);
    }
    if (sel && !E[sel.id]) sel = null;
    if (keepBar && !E[keepBar.id] && !app.sync.pendingCount()) dismissKeep();
    // ---- three.js
    const want = new Set(), ringWant = new Map();
    for (const it of items) {
      want.add(it.key); drawVisual(it.key, it, w.layers.deco);
      for (const id of it.caught || []) if (!ringWant.has(id)) ringWant.set(id, it);
    }
    for (const k of [...visuals.keys()]) if (!want.has(k)) dropVisual(k);
    const wave = reduced() ? 1 : 0.5 + 0.5 * Math.sin(performance.now() / 1000 * Math.PI * 2 * L.caughtHz);
    for (const [id] of ringWant) {
      const e = E[id], rec = w.recs.get(id); if (!e || !rec) continue;
      let r = rings.get(id);
      if (!r || r.layer !== w.layers.deco) {
        if (r) dropRing(id);
        const [geo, backGeo] = ringFor(e.size > 1 ? e.size : 1), g = new THREE.Group();
        const back = flat(new THREE.Mesh(backGeo, new THREE.MeshBasicMaterial({ color: L.casing, transparent: true, opacity: L.casingOpacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })), 32);
        const ring = flat(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: L.caught, transparent: true, opacity: 1, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })), 33);
        g.add(back, ring); g.userData.ruler = true; w.layers.deco.add(g); r = { g, ring, back, layer: w.layers.deco }; rings.set(id, r);
      }
      const p = rec.group.position; r.g.position.set(p.x, p.y - (rec.footDrop || 0) + L.lift, p.z); // round the BASE (a raised pawn's is on the ground under it) r.g.visible = rec.group.visible;
      r.ring.material.opacity = L.caughtLo + (L.caughtHi - L.caughtLo) * wave;
    }
    for (const id of [...rings.keys()]) if (!ringWant.has(id)) dropRing(id);
    // ---- the words, the handles, the buttons
    const used = new Set();
    for (const it of items) {
      const lab = el(`lab:${it.key}`, `rlab${it.quiet ? ' quiet' : ''}${it.remote ? ' remote' : ''}${it.kind === 'move' ? ' move' : ''}${it.caught?.length ? ' hit' : ''}`); used.add(`lab:${it.key}`);
      lab.style.setProperty('--c', it.color);
      if (it.quiet && !it.hot) lab.hidden = true; // a kept one's numbers: only under the pointer, or selected
      else { text(lab, it.text); const tip = it.names?.length ? `Caught: ${it.names.join(', ')}` : ''; if (lab.dataset.tip !== tip) { if (tip) lab.dataset.tip = tip; else delete lab.dataset.tip; } put(lab, screen(it.at, 0.2), 0, it.from ? -16 : 0); }
      if (it.id) { // a kept template's own mark at its origin: the way to select it
        const chip = el(`chip:${it.key}`, `rchip${sel?.id === it.id ? ' on' : ''}${it.expired ? ' expired' : ''}${it.entity.hidden ? ' hid' : ''}`, (c) => { c.dataset.id = it.id; }); used.add(`chip:${it.key}`);
        chip.style.setProperty('--c', it.color);
        html(chip, icon(it.entity.rounds ? 'hourglass' : SHAPE_ICON[it.g.shape], 13));
        const tip = `${MS.templateName(it.entity, units())}${seat(it.entity.owner) ? ` · ${seat(it.entity.owner).name}` : ''}${mayEdit(it.entity) ? ' · click to change or remove' : ''}`; if (chip.dataset.tip !== tip) chip.dataset.tip = tip;
        put(chip, screen(pawnOf(it.entity.attach) ? { ...it.g, y: it.g.y } : it.g, 0.2), 0, pawnOf(it.entity.attach) ? 26 : 0);
      }
      if (it.handles) for (const which of ['a', 'b']) {
        const key = `h${which}:${it.key}`, h = el(key, `rhandle ${which}${dragging?.kind === 'handle' && dragging.which === which ? ' drag' : ''}`, (x) => { x.dataset.which = which; x.dataset.target = it.id ? 'kept' : 'live'; x.dataset.tip = which === 'a' ? 'Drag: where it starts (onto a pawn: it sticks to the pawn)' : it.g ? 'Drag: its size and direction (Shift: 5-ft steps)' : 'Drag: where it ends (onto a pawn: it sticks to the pawn)'; }); used.add(key);
        h.style.setProperty('--c', it.color); put(h, screen(it.handles[which], 0.2), 0, it.handles[which].under ? 30 : 0);
      }
      if (it.mode && !dragging) {
        const key = it.mode === 'shape' && keepBar ? 'strip:live' : `strip:${it.key}`, st = el(key, 'rstrip'); used.add(key);
        const e = it.entity, ctx = it.mode === 'rule' ? { k: null } : it.mode === 'shape' ? { k: it.g.shape, pawn: it.pawn } : it.mode === 'expired' ? { name: MS.templateName(e, units()) } : { mine: mayEdit(e), rounds: e.rounds, attached: !!pawnOf(e.attach), owner: seat(e.owner)?.name || 'someone' };
        if (!(st.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) { // never redrawn under someone typing the rounds
          if (html(st, stripHtml(it.mode, ctx))) for (const b of st.querySelectorAll('button')) b.addEventListener('mousedown', (ev) => ev.preventDefault());
        }
        const anchor = it.mode === 'shape' && keepBar ? MS.endOf(it.g) : it.mode === 'expired' && sel?.id !== it.id ? it.g : it.handles ? it.handles.b : it.at, s = screen(anchor, 0.2);
        st.hidden = !s.ok; if (s.ok) { const bw = st.offsetWidth || 320, bh = st.offsetHeight || 40; st.style.transform = `translate(${Math.round(Math.max(8, Math.min(innerWidth - bw - 8, s.x + 22)))}px, ${Math.round(Math.max(64, Math.min(innerHeight - bh - 8, s.y + 20)))}px)`; }
      }
    }
    for (const [k, e] of dom) if (!used.has(k)) { e.remove(); dom.delete(k); }
    S.items = items;
    // ---- tell the other seats (presence; nothing stored)
    if (mine) { app.ps.setRuler(area, mine); sentRuler = true; } else if (sentRuler) { app.ps.setRuler(area, null); sentRuler = false; }
    if (!busy) wasBusy = false;
  }
  app.on((what) => { if (what === 'frame') frame(); });
  return { name: 'rulers' };
}
