// THE RING, 2026-10-20 (Harry: "I think rev4 settings I sent you are ready to use in the game. let's move them over"): the
// ring Harry shaped in Ring Lab IS the game ring. Its shape is data: the house ring (GET /tuner/house -> ring, Ring Lab's
// "Use as default"), else the built-in "Ellipse · one curve" (client/ringlab/presets.js); ?ringlab=1 drives it from the
// drawer instead (app.ringSettingsOverride, that browser's lab only). The layout is client/ringlab/model.js: ONE oval,
// sized in feet at the piece (world size, held between the smallest and largest button), centred near a pawn's head;
// opening slides the main buttons along the oval; a sub-menu (Conditions, Walls, Faction, Replace, Send to area …) is
// the same oval grown outward, never a panel; the 3–6 sector stays empty (model.js guards). Everything a button DOES is
// as before: the drag tracks (turn, roll, size, raise / lower, damage, and fog height, now a track too), the typed
// damage, the sheet card, the rename field. What follows from here down to the imports is the history of that.
//
// The selection ring (Harry 2026-10-02: "we really don't want to overwhelm them"; round 2 the same evening):
//   no circle is drawn: just the options, as large chunky buttons;
//   the standard options sit near the top, at fixed clock positions from 10:00 to 2:00 (muscle memory):
//     10 turn (a full-size button: drag it to turn, Shift snaps 15°; click = 45°)
//     11 open / close        12 pin · re-roll (rooms)        1 light / put out        2 ☰
//   a PAWN's closed ring is turn · sheet · damage · ☰ (Harry 2026-10-06): sheet opens a small card at its button (the
//   pawn's name and who controls it are on that card since 2026-10-11), damage
//   is a drag handle with a track (a click types a number); every button says its name on hover, the open ones in words
//   clicking ☰ turns it into × and puts the selection's other options on the rest of the circle in ONE FLAT LEVEL,
//   in the fixed order of ONE table (client/menu.js). Harry 2026-10-05, after a morning of Replace ▸ / Edit ▸ / Copy ▸
//   groups: "We really butchered the hamburger menu by doing submenus ... everything in Edit can come back out", and
//   no duplicate / copy / cut on the ring (they keep Ctrl/⌘+D, C, X and the command bar). Since 2026-10-11 ("ship the
//   cuts") no Delete on any ring either (the Delete key, the bar, undo), and a selection whose ☰ would hold nothing has no ☰.
//   A ▸ button exists only where a long list is unavoidable (Replace ▸; a room's Walls ▸; a
//   pawn's Conditions ▸). Its SUB-MENU is one panel that opens AT the button, covering that part of the circle and
//   reaching outward, away from the selected thing; it slides inward at a screen edge and follows the ring.
//   Multi-select: one ring for the group with only shared actions; players get a ring only on what they may touch.
import { factionGrid } from './factions.js';
import * as THREE from 'three';
import { makeTrack } from './track.js';
import { canTilt } from '../../core/commands.js';
import { quatOfEntity, rollStops, Q_ID } from '../../core/orient.js';
import { icon } from '../icons.js';
import { fogDefault } from '../../core/height.js';
import { keyLabel, kindOf } from '../registry.js';
import { menuFor, menuOrphans, chordOf, titleOf as nodeTitle, iconOf as nodeIcon } from '../menu.js';
import { parseDamage, damageReadout, damageAfter, damageOf, DAMAGE_LIMIT, cleanSheet, sheetProblem, sheetHost } from '../../core/pawn.js';
import { T } from '../tuner.js';
import { buildArcItems, fitToScreen, worldScale, rowOf, warnings as ringWarnings } from '../ringlab/model.js';
import { BUILTINS, normalize } from '../ringlab/presets.js';
import { slide, reducedMotion, sameCurve, manifestPaths, loadManifest } from '../ringlab/renderer.js';
import { factionCatalog } from '../../core/faction-catalog.js';
import { explicitFaction, effectiveFaction } from '../../core/factions.js';

// A PAWN'S DAMAGE HANDLE: a FIXED number of pixels per point on every pawn (Harry and Fauna 2026-10-06: "the same hand
// motion should mean the same damage on any pawn": take 7 is the same drag on a goblin and a dragon).
export const DAMAGE_PX = 6;

const SLOT_DEG = (h) => ((h % 12) * 30 + 360) % 360 > 180 ? ((h % 12) * 30) - 360 : (h % 12) * 30; // 10 → -60°, 2 → 60°
// ONE size token for the ring (Harry 2026-10-04: "could be just a little bigger"): buttons, icons, radius and the
// expanded circle all scale with it, so the spacing stays proportional. CSS reads it as --rs.
export const RING_SCALE = 1.2;
let S_ = RING_SCALE, BIG = Math.round(56 * S_), ICON = Math.round(26 * S_);
// Settings ▸ Me ▸ Ring size: a personal multiplier on the one token (redrawn at the next rebuild)
export function setRingScale(k = 1) { S_ = RING_SCALE * Math.max(0.5, Math.min(2, +k || 1)); BIG = Math.round(56 * S_); ICON = Math.round(26 * S_); }
const slotOf = (c, kind) => c.ring?.slot == null ? null : typeof c.ring.slot === 'object' ? c.ring.slot[kind] ?? null : c.ring.slot;
export function ringSurface(R, app) {
  const layer = document.getElementById('ring');
  // THE SECOND CLICK OF A DOUBLE-CLICK IS NOT A RING PRESS (2026-10-06). The first click of a double-click selects, the
  // ring appears at once, and one of its buttons can land under the pointer: the second click then pressed it (a
  // double-click on a room's label turned or re-rolled the room instead of going to its level). A press on the ring
  // that comes within 600 ms and 6 px of the press before it is swallowed, and the double-click goes to what is under
  // the ring (the label, or the world).
  { let prev = null, eat = null;
    const second = (ev) => prev && ev.timeStamp - prev.t < 600 && Math.hypot(ev.clientX - prev.x, ev.clientY - prev.y) < 6;
    // (on a slow machine the two presses can be further apart than that and still be one double-click to the system:
    // the mouse event's own click count says so)
    addEventListener('mousedown', (ev) => { if (!eat && ev.detail >= 2 && ev.button === 0 && layer.contains(ev.target) && prev && !prev.before) { eat = { t: ev.timeStamp }; ev.stopPropagation(); ev.preventDefault(); } }, true);
    addEventListener('pointerdown', (ev) => {
      const onRing = layer.contains(ev.target);
      if (onRing && ev.button === 0 && second(ev) && !prev.onRing) { eat = { t: ev.timeStamp }; ev.stopPropagation(); ev.preventDefault(); }
      else eat = null;
      prev = { t: ev.timeStamp, x: ev.clientX, y: ev.clientY, onRing, before: prev?.onRing && ev.timeStamp - prev.t < 1200 }; // before: the press before this one was on the ring too (a real double-press of a ring button)
    }, true);
    const swallow = (ev) => {
      if (!eat || ev.timeStamp - eat.t > 700 || !layer.contains(ev.target)) return;
      ev.stopPropagation(); ev.preventDefault();
      if (ev.type !== 'dblclick') return;
      eat = null;
      const under = document.elementsFromPoint(ev.clientX, ev.clientY).find(el => !layer.contains(el) && el !== layer);
      under?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window, detail: 2, clientX: ev.clientX, clientY: ev.clientY, button: 0 }));
    };
    for (const t of ['pointerup', 'mousedown', 'mouseup', 'click', 'dblclick']) addEventListener(t, swallow, true);
  }
  let state = null, expanded = null, nest = null, flyout = null, editing = null, dmgEdit = null, drag = null, sig = '';
  // THE SHAPE: the drawer's settings in ?ringlab=1, else the house ring, else the built-in (normalised once each)
  let houseS = undefined, builtinS = null;
  const settings = () => app.ringSettingsOverride?.() || (houseS === undefined ? (houseS = T.house?.ring?.settings ? normalize(T.house.ring) : null) : houseS) || (builtinS ||= normalize(BUILTINS['Ellipse · one curve']));
  app.ringSettings = settings;
  let manifest = { sets: [] };
  const iconBase = () => new URL('assets/ui-icons/manifest.json', app.tunerBase || new URL('/look/', location.href));
  loadManifest(app.tunerBase || new URL('/look/', location.href)).then(m => { manifest = m || { sets: [] }; sig = ''; rebuild(); });

  function geometry(sel) {
    const w = app.worldOf(app.area());
    const pts = [];
    for (const e of sel) {
      // a generated wall, door or window: its piece in the shell (the whole of it, not its foot)
      const sh = e.id?.startsWith?.('wall:') ? (w.shell?.get(e.id.slice(5)) || w.shell?.get(e.id.slice(5) + ':door')) : null;
      if (sh) sh.group.updateMatrixWorld(true);
      const rec = w.recs.get(e.id);
      const b = sh ? new THREE.Box3().setFromObject(sh.group) : e.kind === 'roof' ? w.roofBounds(e.room) : rec ? w.boundsOf(rec, 'figure') : null; // (a raised pawn: its ring opens round the figure, not round figure, beam and base)
      if (b) { for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) pts.push(app.screenOf(x, z, app.main, y)); }
      else if (e.x != null) pts.push(app.screenOf(e.x, e.z));
    }
    if (!pts.length) return null;
    // the projected bounding box: the ring centres on it, and its core arc sits above its top edge
    const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2, hy = (y1 - y0) / 2;
    const r = Math.max(82 * S_, Math.min(300 * S_, Math.hypot(hx, hy) + 44 * S_));
    return { cx, cy, r, hx, hy, top: y0 };
  }
  // (a pawn gets a ring for EVERY seat: its damage, its sheet card and its indicators are everyone's; the rest is its owner's)
  const visibleFor = (sel) => sel.length && !app.mode && (app.gm() || sel.every(e => app.canTouch(e) || e.kind === 'token' || (e.kind === 'object' && (app.canOpen(e) || app.assets.lightable(e.cat)))));


  // the ring's centre (2026-10-20, Harry: "roughly the head"): one pawn or thing, a point that far up its model over the
  // middle of its footprint (a raised pawn: its figure); a room, a building, a wall or several pieces: the box's middle
  function anchorOf(S, sel, g) {
    if (sel.length === 1 && (sel[0].kind === 'token' || sel[0].kind === 'object')) {
      const e = sel[0], w = app.worldOf(app.area()), rec = w?.recs.get(e.id), b = rec && w.boundsOf(rec, 'figure');
      if (b) { const k = (e.kind === 'token' ? S.centre?.pawn ?? 85 : S.centre?.thing ?? 50) / 100;
        const p = app.screenOf((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, app.main, b.min.y + k * (b.max.y - b.min.y));
        if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return { x: p.x, y: p.y }; }
    }
    return { x: g.cx, y: g.cy };
  }
  // WORLD SIZE: px per ft at the piece's depth (one foot along the camera's right axis, at the piece) and its base in ft
  function measure(sel) {
    const e = sel[0], cam = app.main?.camera; if (!e || !cam) return null;
    const w = app.worldOf(app.area()), rec = w?.recs.get(e.id);
    let x = e.x, z = e.z, y = e.y || 0, base = 5;
    if (e.kind === 'room' && e.recipe) { const r = e.recipe; x = (r.x + r.w / 2) * 5; z = (r.z + r.d / 2) * 5; y = r.y || 0; base = Math.max(r.w, r.d) * 5; }
    else if (e.kind === 'token') base = (app.assets?.figures?.sizeOf?.(e) || e.size || 1) * 5;
    else { const b = rec ? w.boundsOf(rec) : e.kind === 'roof' ? w.roofBounds?.(e.room) : null; if (b) { x = (b.min.x + b.max.x) / 2; z = (b.min.z + b.max.z) / 2; y = b.min.y; base = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) || 5; } else if (e.dims) base = Math.max(e.dims[0] || 0, e.dims[2] || 0) || 5; }
    if (sel.length > 1) { const c = app.centroid?.(sel); if (c) { x = c[0]; z = c[1]; } }
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    cam.updateMatrixWorld?.(); const m = cam.matrixWorld.elements, L = Math.hypot(m[0], m[1], m[2]) || 1;
    const a = app.screenOf(x, z, app.main, y), b2 = app.screenOf(x + m[0] / L, z + m[2] / L, app.main, y + m[1] / L);
    const pxPerFt = Math.hypot(b2.x - a.x, b2.y - a.y); return pxPerFt > 0 ? { pxPerFt, baseFt: base, name: e.name || e.kind } : null;
  }
  let world = null, anchor = null, lastNodes = [], lastWarn = [], lastSlid = null;
  app.ringWorld = () => world; app.ringAnchor = () => anchor; app.ringWarnings = () => lastWarn; app.ringSlid = () => lastSlid; // (Ring lab, tests: a row that slid back out of 3–6)
  app.ringState = () => !state ? null : nest ? 'nested' : expanded ? 'expanded' : 'closed';
  app.ringNodes = () => lastNodes.map(n => ({ id: n.item.id, key: n.key, x: n.x, y: n.y, size: n.size, angle: n.angle, curve: n.curve || null, spilled: !!n.spilled }));

  function rebuild() {
    if (drag) return; // the gesture's frame is frozen until release (rebuilt then)
    const ctx = R.ctx(), sel = ctx.sel, S = settings();
    const s = `${[...app.sel].join()}|${sel.map(e => `${e.name}|${e.pinned}|${e.open}|${e.lit}|${e.locked}|${e.hidden}|${e.damage}|${e.mark}|${e.owner}|${(e.conditions || []).join()}`).join()}|${!!app.mode}|${app.gm()}|${!!expanded}|${nest?.key || ''}|${nest?.v || 0}|${S === lastS ? 1 : JSON.stringify(S)}|${manifest.sets?.length || 0}`;
    lastS = S;
    if (s === sig) return;
    sig = s;
    // a pawn's sheet card stays open through a rebuild of the same selection (someone changes its damage while you are
    // writing its notes): it is taken out and put back, with the caret where it was
    const keep = flyout?.keep && flyout.selKey === [...app.sel].join() && visibleFor(sel) ? flyout : null;
    const caret = keep && keep.el.contains(document.activeElement) ? { el: document.activeElement, a: document.activeElement.selectionStart, b: document.activeElement.selectionEnd } : null;
    if (!keep) closeFlyout();
    stopEdit(); closeDamageEdit();
    layer.innerHTML = '';
    state = null;
    if (!visibleFor(sel)) { layer.hidden = true; expanded = null; nest = null; return; }
    const kinds = new Set(sel.map(e => kindOf(app, e)));
    const kind = kinds.size === 1 ? [...kinds][0] : 'mixed';
    state = { kind, els: { primary: [], secondary: [], nest: [] } };
    layer.style.setProperty('--seat', app.myColor());
    const avail = R.available(ctx);
    layer.style.setProperty('--rs', S_ / RING_SCALE);
    // THE MAIN BUTTONS, in the order of their old clock slots (10 turn, 11 …, 2), left to right along the oval
    const onRing = avail.filter(c => slotOf(c, kind) != null && (c.ring.kinds?.includes(kind) || kind === 'mixed') && R.isEnabled(c, ctx)).sort((a, b) => slotOf(a, kind) - slotOf(b, kind));
    for (const c of onRing) { const b = button(c, ctx, { label: c.ring.label, opens: c.ring.opens || null }); state.els.primary.push(b); layer.append(b); }
    // the rest: the menu's top level for this selection (client/menu.js), in its one fixed order; what can't be done here
    // is not shown at all; what is already a main button is not repeated
    const nodes = menuFor(R, ctx, { skip: new Set(onRing.map(c => c.id)), ring: true });
    // NO EMPTY ☰ (2026-10-11): a selection with nothing behind ☰ gets no ☰ at all
    if (!nodes.length) { expanded = null; nest = null; }
    state.menu = nodes.length;
    const m = document.createElement('button');
    m.className = `rbtn big menu${expanded ? ' open' : ''}`; m.dataset.menu = '1'; m.dataset.id = 'menu'; m.title = expanded ? 'Fewer options' : 'All options'; m.setAttribute('aria-label', m.title); m.dataset.tip = m.title;
    m.setAttribute('aria-expanded', String(!!expanded));
    m.innerHTML = icon('menu', ICON);
    m.onclick = (ev) => { ev.stopPropagation(); if (pickIcons(m)) return; expanded ? collapse() : expand(); };
    if (nodes.length) layer.append(m);
    if (expanded) {
      nodes.forEach((n, i) => { const b = n.cmd ? button(n.cmd, ctx, { expanded: true, i, n: nodes.length, enabled: true, opens: n.opens, cap: n.title }) : groupButton(n, ctx, i, nodes.length); state.els.secondary.push(b); layer.append(b); });
      expanded.n = nodes.length; expanded.nodes = nodes;
    }
    if (expanded && nest) for (const [i, t] of nest.children.entries()) { const b = nestButton(t, i, nest.children); state.els.nest.push(b); layer.append(b); }
    paint(S);
    if (sel.length > 1) layer.insertAdjacentHTML('beforeend', `<div class="count">${sel.length}</div>`);
    if (keep) { layer.append(keep.el); if (caret) { try { caret.el.focus({ preventScroll: true }); caret.el.setSelectionRange?.(caret.a, caret.b); } catch { } } }
    laid = ''; position();
  }
  let lastS = null, laid = '';
  // PICTURES: the painted set chosen in Ring Lab (iconSet, its alternates), else the line icons
  function paint(S) {
    for (const b of layer.querySelectorAll('.rbtn[data-id]')) {
      if (b.classList.contains('pill') || b.querySelector('.ini, .pvw')) continue;
      const paths = manifestPaths(manifest, iconBase(), S.iconSet, b.dataset.cmd || b.dataset.id);
      if (!paths.length) continue;
      b.querySelector('svg')?.remove(); b.querySelector('img.paint')?.remove();
      const img = document.createElement('img'); img.className = 'paint'; img.alt = ''; img.draggable = false; img.src = paths[(S.iconAlternates?.[b.dataset.cmd || b.dataset.id] || 0) % paths.length]; b.prepend(img); b.classList.add('painted');
      if (b.dataset.state === 'on') b.insertAdjacentHTML('beforeend', `<span class="state" aria-hidden="true">${icon(b.dataset.icon, Math.round(ICON * 0.6))}</span>`);
    }
  }
  // (?ringlab=1: "Click a button to try its other pictures")
  const pickIcons = (b) => { if (!app.ringPickIcons?.()) return false; app.ringCycleIcon?.(b.dataset.cmd || b.dataset.id); return true; };

  // opens: this command's own sub-menu or card; the button toggles it
  function button(c, ctx, { label = false, expanded: ex = false, i = 0, n = 1, enabled = true, opens = null, cap = null }) {
    const title = R.titleOf(c, ctx), ic = R.iconOf(c, ctx);
    const b = document.createElement('button');
    b.className = `rbtn big${label ? ' pill' : ''}${ex ? ' ex' : ''}${enabled ? '' : ' disabled'}${c.danger ? ' danger' : ''}${opens ? ' grp' : ''}`;
    if (opens) { b.dataset.group = opens; b.setAttribute('aria-haspopup', 'menu'); }
    if (ex) { b.dataset.i = i; b.dataset.n = n; }
    b.dataset.cmd = c.id; b.dataset.id = c.id;
    // a toggle that is ON (pinned → Unpin): a painted picture shows the plain action, so it also wears the state's own icon
    if (c.toggle && ic === c.toggle.on?.[1]) { b.dataset.state = 'on'; b.dataset.icon = ic; }
    const ch = c.keys?.[0] ? null : chordOf(R, c.id), key = c.keys?.[0] ? keyLabel(c.keys[0]) : ch ? ch.map(x => x.length === 1 ? x.toUpperCase() : x).join(' ') : '';
    b.title = `${title}${key ? ` (${key})` : ''}`; b.setAttribute('aria-label', title);
    // EVERY RING BUTTON SAYS ITS NAME (Harry 2026-10-06: "we need hover text for sure"): in the ring's own label style
    b.dataset.tip = String((ex ? cap || c.short : c.short) || title).replace(/\s*\(.*\)$/, '').replace(/…$/, '');
    const badge = c.ring?.badge ? String(c.ring.badge(ctx) ?? '') : '';
    b.innerHTML = label ? `<span class="label">${esc(ctx.one?.name || '')}</span>` : `${icon(ic, ICON)}${badge ? `<span class="badge">${esc(badge)}</span>` : ''}`;
    const dragKind = c.ring?.drag || (opens === 'fog' ? 'fog' : null);
    if (dragKind) { b.addEventListener('pointerdown', (ev) => { if (app.ringPickIcons?.()) return; startDrag(ev, dragKind, c); }); b.classList.add('drag'); }
    else b.onclick = (ev) => { ev.stopPropagation(); if (pickIcons(b)) return; if (!enabled) return; if (opens && nest?.key === opens) { closeNest(); return; } if (opens && flyout?.group === opens) { closeFlyout(); return; } if (ex && !opens && c.id !== 'thing.rename') collapse(); R.run(c.id); };
    return b;
  }
  // a ▸ group (client/menu.js `list`): its items open as the grown ring
  function groupButton(n, ctx, i, total) {
    const b = document.createElement('button');
    b.className = 'rbtn big ex grp'; b.dataset.i = i; b.dataset.n = total; b.dataset.group = n.group; b.dataset.id = n.group;
    b.title = `${n.title}…`; b.setAttribute('aria-label', n.title); b.setAttribute('aria-haspopup', 'menu'); b.dataset.tip = n.title;
    b.innerHTML = `${icon(n.icon, ICON)}`;
    b.onclick = (ev) => { ev.stopPropagation(); if (pickIcons(b)) return; if (nest?.key === n.group) closeNest(); else openNest({ key: n.group, title: n.title, children: n.children.map(c => ({ id: c.cmd.id, cmd: c.cmd.id, label: c.cmd.short || nodeTitle(c, R, ctx), title: nodeTitle(c, R, ctx), icon: nodeIcon(c, R, ctx), img: c.cmd.img, pic: typeof c.cmd.pic === 'function' ? c.cmd.pic() : c.cmd.pic, preview: c.cmd.preview?.() || null, danger: c.cmd.danger, key: c.key?.toUpperCase(), on: c.on,
      run: () => { closeNest(); collapse(); R.run(c.cmd.id); } })) }); };
    return b;
  }
  // A SUB-MENU IS THE OVAL GROWN OUTWARD (the design record: "submenus are concentric arcs"; Harry 2026-10-20 had Ring
  // Lab's toasts in its place): one button per item, its picture (a painted icon, a thumbnail, a turning model, or a
  // glyph; siblings never share one: a repeat shows its initials instead), its name in the ring's label style.
  function nestButton(t, i, all) {
    const b = document.createElement('button');
    b.className = `rbtn big nest${t.danger ? ' danger' : ''}${t.cls ? ' ' + t.cls : ''}${t.disabled ? ' disabled' : ''}${t.hiddenArea ? ' hidden-area' : ''}`;
    b.dataset.id = t.id || `${nest.key}:${i}`; if (t.cmd) b.dataset.cmd = t.cmd; b.dataset.group = nest.key; b.dataset.nest = '1'; if (t.area) b.dataset.area = t.area; if (t.faction) b.dataset.faction = t.faction;
    b.title = t.title || t.label; b.setAttribute('aria-label', t.title || t.label); b.dataset.tip = t.label;
    if (t.pressed != null) b.setAttribute('aria-pressed', String(!!t.pressed));
    const shared = !t.pic && !t.img && !t.preview && all.some((o, j) => j !== i && !o.pic && !o.img && !o.preview && (o.icon || 'box') === (t.icon || 'box'));
    b.innerHTML = t.preview ? `<span class="pvw" data-pv></span>` : t.pic ? `<img class="pic" src="${t.pic}" alt="" draggable="false">` : t.img ? `<img class="pic" src="data/icons/${t.img}.png?v=${window.TW_V || 'dev'}" alt="" draggable="false">`
      : shared ? `<span class="ini">${esc(initialsAmong(all.filter(o => !o.pic && !o.img && !o.preview && (o.icon || 'box') === (t.icon || 'box')).map(o => o.label), t.label))}</span>` : icon(t.icon || 'box', ICON);
    if (t.preview) app.previews.attach(b.querySelector('[data-pv]'), t.preview);
    if (t.hiddenArea) { b.title += ' (hidden from players)'; b.dataset.tip = `${t.label} · hidden`; }
    b.onclick = (ev) => { ev.stopPropagation(); if (pickIcons(b)) return; if (t.disabled) { app.toast(t.why || `${t.label}: not here`, true); return; } t.run(); };
    return b;
  }
  // INITIALS THAT TELL SIBLINGS APART (2026-10-20: the walls "noble panel" / "noble paper", "temple stone" / "tower
  // stone" were both NP, both TS): two letters, or for a name whose two letters a sibling shares, the first longer form
  // no sibling shares (NPL / NPR, TES / TOS)
  const initialsAmong = (labels, label) => {
    const forms = (s) => { const w = String(s || '?').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean), a = w[0] || '?', z = w[1] || '';
      return (z ? [a[0] + z[0], a[0] + z[0] + z.slice(-1), a.slice(0, 2) + z[0], a[0] + z.slice(0, 3)] : [a.slice(0, 2), a.slice(0, 3), a[0] + a.slice(-1), a.slice(0, 4)]).map(x => x.toUpperCase()); };
    const mine = forms(label), others = labels.filter(l => l !== label).map(forms);
    for (let k = 0; k < mine.length; k++) if (!others.some(f => f[k] === mine[k])) return mine[k];
    return mine[0] + (labels.indexOf(label) + 1);
  };
  function openNest(n) { if (!expanded) expanded = { at: Date.now() }; nest = { ...n, v: (nest?.v || 0) + 1 }; closeFlyout(); sig = ''; rebuild(); app.escapeStack.push(closeNest); }
  function closeNest() { if (!nest) return false; app.previews.detachAll?.(layer); nest = null; const i = app.escapeStack.indexOf(closeNest); if (i >= 0) app.escapeStack.splice(i, 1); sig = ''; rebuild(); }
  let trans = null; // the slide under way: { from, to, t0, longest }
  function expand() { if (!state?.menu) return; trans = { from: 'closed', to: 'expanded', t0: performance.now() }; expanded = { at: Date.now() }; sig = ''; rebuild(); app.escapeStack.push(collapseIfOpen); }
  function collapse() { if (expanded) trans = { from: nest ? 'nested' : 'expanded', to: 'closed', t0: performance.now(), was: state?.els && [...state.els.secondary, ...state.els.nest].map(b => ({ html: b.innerHTML, id: b.dataset.id, cls: b.className })) }; expanded = null; nest = null; sig = ''; rebuild(); }
  function collapseIfOpen() { if (!expanded) return false; collapse(); }
  app.menuOrphans = () => menuOrphans(R); // (tests) menu commands client/menu.js names nowhere
  app.ringMenu = () => expanded?.nodes ? expanded.nodes.map(n => n.cmd ? { cmd: n.cmd.id, key: n.key, ...(n.opens ? { opens: n.opens } : {}) } : { group: n.group, title: n.title, key: n.key, items: n.children.map(c => c.cmd.id) }) : null; // (tests)
  app.ringOpen = (v) => { if (v === 'closed') { closeNest(); collapse(); } else if (v === 'expanded') { if (nest) closeNest(); else if (!expanded) expand(); } else if (v === 'nested') { if (!expanded) expand(); const g = layer.querySelector('.rbtn.ex.grp'); g?.click(); } };
  app.ringReplay = () => { const was = !!expanded; if (was) { expanded = null; nest = null; sig = ''; rebuild(); } expand(); };

  app.ringRelayout = () => { sig = ''; laid = ''; rebuild(); };   // (Ring Lab: the drawer changed the shape)
  app.ringCenter = () => state?.center || null; // (tests) the ring's centre: where it opens round
  app.ringGeom = () => state?.g || null;          // (tests) the selection's projected bounding box
  // THE LAYOUT, every frame (the camera moves; the oval follows the piece at its size in the world)
  function position() {
    if (!state || drag) return; // frozen during a drag: only the dragged handle moves
    const sel = app.selected(), g = geometry(sel);
    if (!g) { layer.hidden = true; return; }
    layer.hidden = false; state.g = g;
    const S = settings(), W = innerWidth, H = innerHeight;
    anchor = anchorOf(S, sel, g);
    let scale = S_ / RING_SCALE; world = null;
    if (S.world?.on) { const m = measure(sel); if (m) { world = { ...worldScale(S, m.pxPerFt, m.baseFt), name: m.name }; scale = world.scale; } }
    const item = (b) => ({ id: b.dataset.id, el: b });
    // (shut, the extra buttons are not drawn, but their number places ☰ and the slide's starting points)
    const content = { primary: state.els.primary.map(item), secondary: expanded ? state.els.secondary.map(item) : Array.from({ length: state.menu || 0 }, (_, i) => ({ id: `_x${i}` })) };
    const view = nest && expanded ? 'nested' : expanded ? 'expanded' : 'closed';
    const nestedArg = view === 'nested' ? { id: nest.key, children: state.els.nest.map(item) } : null;
    const layout = (v) => { const raw = buildArcItems(S, content, v, v === 'nested' ? nestedArg : null, scale, anchor); return Object.assign(S.world?.on ? { nodes: raw, shift: [0, 0] } : fitToScreen(raw, W, H, S.edgeRule, 54), { slid: raw.slid || null }); };
    const fit = layout(view), nodes = fit.nodes;
    state.center = [anchor.x, anchor.y];
    const menuEl = layer.querySelector('.rbtn[data-menu]');
    const key = JSON.stringify([view, scale.toFixed(4), Math.round(anchor.x * 4), Math.round(anchor.y * 4), W, H, nodes.length, S === lastS]);
    const flying = trans && performance.now() - trans.t0 < (trans.longest ?? 5000);
    if (key === laid && !flying) { if (flyout) layoutFlyout(); return; }
    laid = key;
    lastNodes = nodes;
    for (const n of nodes) {
      const el = n.item.id === 'menu' && !n.item.el ? menuEl : n.item.el; if (!el) continue; n.el = el;
      el.style.left = `${n.x}px`; el.style.top = `${n.y}px`; el.style.width = el.style.height = `${n.size}px`;
      el.style.setProperty('--rl-hover', S.hover || 1.1); el.style.setProperty('--rl-press', S.press || 0.94);
      const sv = el.querySelector(':scope > svg'); if (sv) { sv.setAttribute('width', Math.round(n.size * 0.46)); sv.setAttribute('height', Math.round(n.size * 0.46)); }
      const ini = el.querySelector('.ini'); if (ini) ini.style.fontSize = `${Math.round(n.size * 0.3)}px`;
    }
    const lab = labels(S, nodes, world ? scale : 1, W, H);
    lastWarn = ringWarnings(nodes, [], W, H, anchor, lab, 54).filter(x => !(S.world?.on && x === 'off screen'));
    layer._curve = nodes.find(n => n.curve && !['conditions', 'faction', 'nested'].includes(n.key))?.curve ? (() => { const c = nodes.find(n => n.curve && !['conditions', 'faction', 'nested'].includes(n.key)).curve; return { ...c, cx: c.cx + fit.shift[0], cy: c.cy + fit.shift[1], shift: fit.shift }; })() : null;
    animate(S, nodes, fit, layout);
    const count = layer.querySelector('.count'); if (count) { const c = layer._curve; count.style.left = `${anchor.x - (c ? c.rx * 0.55 : 60)}px`; count.style.top = `${anchor.y + (c ? c.ry * 0.35 : 30)}px`; }
    if (flyout) layoutFlyout();
    if (editing) { const top = Math.min(...nodes.map(n => n.y - n.size / 2)); editing.style.left = `${anchor.x}px`; editing.style.top = `${top - 22}px`; }
    lastSlid = fit.slid;
    app.ringOnLayout?.({ warnings: lastWarn, world, anchor, view, slid: fit.slid });
  }
  // THE SLIDE (Harry 2026-10-19: "the slide needs to be actual animated visual movement"): on opening the main buttons
  // travel along the oval to 7–9 and the extra buttons come out of ☰; shutting plays it back. A redraw during it (the
  // camera, a change from the table) carries it on from where it is. Reduced motion: no slide.
  function animate(S, nodes, fit, layout) {
    for (const el of layer.querySelectorAll('.rbtn')) el.getAnimations?.().forEach(a => a.cancel());
    layer.querySelectorAll('.rbtn.leaving').forEach(el => el.remove());
    if (!trans || !S.curve?.on || reducedMotion()) { trans = null; return; }
    const now = performance.now(), elapsed = now - trans.t0, C = S.curve;
    const from = layout(trans.from === 'nested' ? 'expanded' : trans.from), byId = new Map(from.nodes.map(n => [n.item.id, n])), fromMenu = byId.get('menu');
    let longest = 0; const group = {}, started = [];
    for (const n of nodes) {
      if (!n.curve || !n.el) continue;
      const gk = rowOf(n, trans.to), gi = group[gk] = (group[gk] ?? -1) + 1, timing = { duration: +C.duration || 0, delay: gi * (+C.stagger || 0), easing: C.easing || 'ease-in-out' };
      const o = byId.get(n.item.id), src = o?.curve && sameCurve(o.curve, n.curve, from.shift, fit.shift) ? o : null;
      const enter = !src && n.key === 'secondary' && C.enter === 'from ☰' && fromMenu?.curve && sameCurve(fromMenu.curve, n.curve, from.shift, fit.shift) ? fromMenu : null;
      if (src || enter) { started.push(slide(n.el, n.curve, (src || enter).curve.s, n.curve.s, from.shift, fit.shift, timing, enter ? 1 : 0, n)); longest = Math.max(longest, timing.duration + timing.delay); }
    }
    // shutting: the extra buttons run back along the oval into ☰ and fade
    const menuNow = nodes.find(n => n.item.id === 'menu');
    if (trans.to === 'closed' && trans.was && menuNow?.curve) for (const old of from.nodes) {
      if (nodes.some(n => n.item.id === old.item.id) || !old.curve || !sameCurve(old.curve, menuNow.curve, from.shift, fit.shift)) continue;
      const w = trans.was.find(x => x.id === old.item.id); if (!w) continue;
      const gi = group['leave'] = (group['leave'] ?? -1) + 1, timing = { duration: +C.duration || 0, delay: gi * (+C.stagger || 0), easing: C.easing || 'ease-in-out' };
      const el = document.createElement('div'); el.className = `${w.cls} leaving`; el.innerHTML = w.html; el.style.cssText = `left:${old.x}px;top:${old.y}px;width:${old.size}px;height:${old.size}px;pointer-events:none`;
      layer.append(el); const a = slide(el, old.curve, old.curve.s, menuNow.curve.s, from.shift, fit.shift, timing, -1, old); a.onfinish = () => el.remove(); started.push(a);
      longest = Math.max(longest, timing.duration + timing.delay);
    }
    trans.longest = longest;
    if (elapsed > longest + 30) { started.forEach(a => a.finish()); trans = null; return; }
    if (elapsed > 0) for (const a of started) a.currentTime = Math.min(elapsed, a.effect.getComputedTiming().endTime || 0);
    layer._anim = { from: trans.from, to: trans.to, start: trans.t0, duration: longest, carried: elapsed > 20 };
  }
  // NAMES, in the ring's label style (Ring Lab "Names and pictures"): curved above or below each button, under it, or
  // on hover; sized with the ring. Returns their boxes (they count for the 3–6 sector too).
  function labels(S, nodes, k, W, H) {
    layer.querySelectorAll(':scope > .rl-label-svg, :scope > .rl-tip').forEach(e => e.remove());
    const boxes = [], mode = S.labelMode || 'hover';
    for (const n of nodes) {
      const el = n.el; if (!el) continue; const text = el.dataset.tip || el.getAttribute('aria-label') || '';
      el.classList.toggle('tips', mode === 'hover' || (mode === 'below' && S.labelWhen === 'hovered'));
      // (a name shown on hover wears the label style too: Ring Lab's name size, weight, colour and outline, style.css)
      for (const [v, x] of [['--rl-tip-size', `${S.fontSize * k}px`], ['--rl-tip-weight', S.fontWeight], ['--rl-tip-color', S.labelColor], ['--rl-tip-halo', `${S.labelHalo}px`]]) el.style.setProperty(v, x);
      if (mode === 'hover' || mode === 'below') {
        if (mode === 'below' && S.labelWhen === 'always') { const t = document.createElement('span'); t.className = 'rl-tip'; t.textContent = text; t.style.cssText = `left:${n.x}px;top:${n.y + n.size / 2 + 4}px;font-size:${S.fontSize * k}px;font-weight:${S.fontWeight};color:${S.labelColor};text-shadow:0 0 ${S.labelHalo}px #000`; layer.append(t); boxes.push({ x: n.x - 45 * k, y: n.y + n.size / 2 + 4, w: 90 * k, h: (S.fontSize + 9) * k }); }
        continue;
      }
      const rr = Math.max(6, n.size / 2 + S.labelOffset * k) * (mode === 'under' ? 0.85 : 1.2);
      const svg = svgEl('svg'); svg.classList.add('rl-label-svg'); svg.setAttribute('width', W); svg.setAttribute('height', H);
      const path = svgEl('path'), id = `rl-path-${Math.random().toString(36).slice(2)}`; path.id = id;
      path.setAttribute('d', mode === 'under' ? `M ${n.x - rr} ${n.y} A ${rr} ${rr} 0 0 0 ${n.x + rr} ${n.y}` : `M ${n.x - rr} ${n.y} A ${rr} ${rr} 0 0 1 ${n.x + rr} ${n.y}`); svg.append(path);
      const tx = svgEl('text'), tp = svgEl('textPath'); tp.setAttribute('href', '#' + id); tp.setAttribute('startOffset', '50%'); tp.textContent = text; tx.append(tp);
      tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('font-size', S.fontSize * k); tx.setAttribute('font-weight', S.fontWeight); tx.setAttribute('fill', S.labelColor); tx.setAttribute('stroke-width', S.labelHalo); svg.append(tx); layer.append(svg);
      boxes.push(mode === 'under' ? { x: n.x - rr, y: n.y, w: rr * 2, h: rr } : { x: n.x - rr, y: n.y - rr, w: rr * 2, h: rr });
    }
    return boxes;
  }
  const svgEl = (name) => document.createElementNS('http://www.w3.org/2000/svg', name);

  // ---------- drag buttons: turn, resize, raise / lower ----------
  // ONE frozen frame per gesture (Tobias 2026-10-04 found the resize jitter): on pointerdown the ring's centre, the
  // handle's direction from it and the starting values are fixed, and NOTHING re-lays out until release (the other
  // buttons hide; only the dragged handle follows the pointer). Before, every move re-measured the thing's projected
  // bounds while it was changing size, so the centre the scale was measured from moved with the drag (a feedback
  // loop), and near the centre the raw radial distance went through zero and back (shaking, and growth again).
  //   size    k = f(d / d0), d = the pointer's distance from the frozen centre PROJECTED onto the handle's starting
  //           direction (a 1D measure: sideways motion changes nothing); f is monotonic with soft stops at 0.2× and
  //           5× (it eases into them, never flips or shakes at d ≈ 0); Shift snaps to 25% steps
  //   rotate  the angle about the frozen centre, turning freely, with NOTCHES every 45° (Harry 2026-10-05): a soft
  //           detent. Within NOTCH_DEG of a multiple of 45° (of the thing's own facing, so notches line it up with the
  //           walls) it catches there; pulling further lets go. Small ticks round the centre show where the notches
  //           are, and the one that has caught lights up. Shift snaps 15° as before.
  //   lift    the vertical drag at a frozen pixels-per-foot; Shift snaps 6 in
  // A centre crosshair, a guide line from it to the handle and a live readout show where "smaller" is.
  // HOW A DRAG ENDS (Harry 2026-10-05, "raise is now dropping everything instantly back to the floor": a release that
  // sends nothing looks exactly like that, so no release may be lost, and none may fail silently):
  //   the pointer is CAPTURED on the handle, and move / up / cancel are heard on the window in the capture phase, for
  //   this pointer only; nothing can rebuild the ring under a drag (rebuild and position return while `drag` is set);
  //   it COMMITS the last previewed value on pointerup, on pointercancel (the browser took the gesture: a native drag, a
  //   touch scroll), on a lost capture with no pointerup (touch / pen), when the window loses focus, and when a mouse
  //   moves with no button down (the release happened where we could not see it);
  //   only Escape cancels (nothing is sent; the thing goes back);
  //   if committing throws, or the relay refuses, the reason is shown (a toast), never a silent snap-back.
  const K_LO = 0.2, K_HI = 5, BAND_LO = 0.15, BAND_HI = 1;
  const NOTCH = Math.PI / 4, NOTCH_DEG = 4, NOTCH_CATCH = NOTCH_DEG * Math.PI / 180;
  app.ringNotch = { every: 45, catch: NOTCH_DEG }; // (tests, docs)
  // monotonic, slope 1 in the middle, easing into the stops (continuous value and slope at the joins)
  const softK = (x) => x < K_LO + BAND_LO ? K_LO + BAND_LO * Math.exp((x - K_LO - BAND_LO) / BAND_LO) : x > K_HI - BAND_HI ? K_HI - BAND_HI * Math.exp(-(x - K_HI + BAND_HI) / BAND_HI) : x;
  app.ringSoftK = softK; // (tests)
  app.ringDamage = { px: DAMAGE_PX }; // (tests, docs)
  app.ringDrag = () => drag && { kind: drag.kind, k: drag.k, delta: drag.delta, axis: drag.axis || null, stop: drag.stop || null, y: drag.y, damage: drag.dmg ?? null, centre: drag.c, dir: drag.u, d0: drag.d0, notch: drag.notch ?? null, ticks: layer.querySelectorAll('.guide .tick').length, track: drag.track?.info() || null }; // (tests)
  app.ringTrack = makeTrack; // (tests, and the next handle that slides: surfaces/track.js)
  // the distance along the resize ray (in units of the grab distance) at which the size is k: softK turned round
  const softKInv = (k) => { let lo = 0, hi = 12; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (softK(m) < k) lo = m; else hi = m; } return (lo + hi) / 2; };
  function startDrag(ev, kind, c) {
    ev.preventDefault(); ev.stopPropagation();
    app.materializeSelection(); // a generated wall/door/window becomes an object first, so the drag previews it
    const sel = app.selected().filter(e => kind === 'tilt' ? e.kind === 'object' && canTilt(e) : kind === 'fog' ? e.kind === 'room' : e.kind === 'object' || e.kind === 'token');
    const x0 = ev.clientX, y0 = ev.clientY;
    if (!sel.length || !state?.g) return;
    const handle = ev.currentTarget;
    // the frozen frame
    const [cx, cy] = state.center || [state.g.cx, state.g.cy];
    const hr = handle.getBoundingClientRect(), hx = hr.left + hr.width / 2, hy = hr.top + hr.height / 2;
    let ux = hx - cx, uy = hy - cy; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    const d0 = Math.max(24, (x0 - cx) * ux + (y0 - cy) * uy);
    const e0 = sel[0], size0 = Math.max(...(e0.dims || [1, 1, 1]));
    let ppf = null;
    if (kind === 'lift') { const a = app.screenOf(e0.x, e0.z, app.main, e0.y || 0), b = app.screenOf(e0.x, e0.z, app.main, (e0.y || 0) + 1); ppf = Math.max(4, Math.abs(a.y - b.y)); }
    const me = drag = { kind, sel, k: 1, delta: 0, moved: false, c: [cx, cy], u: [ux, uy], d0, handle, screenDeg: SLOT_DEG(10) };
    const pid = ev.pointerId;
    try { handle.setPointerCapture(pid); } catch { /* a pointer that cannot be captured: the window listeners still follow it */ }
    handle.ondragstart = (e) => e.preventDefault(); // never a native drag-and-drop (it would cancel the pointer)
    layer.classList.add('dragging'); handle.classList.add('active');
    const guide = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); guide.classList.add('guide');
    guide.innerHTML = `<line class="gl" x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}"/><g class="cross"><line x1="${cx - 9}" y1="${cy}" x2="${cx + 9}" y2="${cy}"/><line x1="${cx}" y1="${cy - 9}" x2="${cx}" y2="${cy + 9}"/><circle cx="${cx}" cy="${cy}" r="3.5"/></g>`;
    layer.append(guide);
    // THE TRACK the handle slides along (Harry 2026-10-06; surfaces/track.js): one piece for all three handles
    let track;
    if (kind === 'rotate') { // a circle about the centre; the notches wherever the thing's facing would be a multiple of 45°
      const rr = Math.hypot(hx - cx, hy - cy), a0 = Math.atan2(x0 - cx, -(y0 - cy)), r0 = sel[0].rot || 0, DEG = 180 / Math.PI;
      track = makeTrack(guide, { min: -180, max: 180, value: 0, layer, direction: { centre: [cx, cy], radius: rr, zero: a0, per: 1 / DEG },
        ticks: Array.from({ length: 8 }, (_, k) => { let v = (r0 - k * NOTCH) * DEG; v = ((v + 180) % 360 + 360) % 360 - 180; return { v, k, major: true }; }),
        marks: [{ v: 0, label: '', cls: 'start' }], format: (v) => `${Math.round(v)}°${drag?.notch != null ? ' ◆' : ''}` });
    } else if (kind === 'tilt') { // ROLL: THE TURN'S GESTURE ABOUT THE VIEW'S AXIS (Harry 2026-10-11: "Roll needs to be a draggable just like
      // ... (rotate)"; 2026-10-12: "relative to the current view, rather than fixed to the object").
      // The axis is taken from the camera ONCE, at the grab (app.viewRollAxis), and held for the whole drag: the thing
      // tips the way the handle goes, as seen. The value on the rail is THIS gesture's angle, from where it started.
      //   ticks   the eight 45° notches of the gesture (as the turn's)
      //   marks   where it began, and the gesture's special stops (core/orient.js rollStops): where one of the thing's
      //           own axes stands exactly vertical ("upright", "upside down", "square") or its up axis lies exactly
      //           level ("on its side"). They catch softly like a notch: "back to exactly upright" is what people want.
      const rr = Math.hypot(hx - cx, hy - cy), a0 = Math.atan2(x0 - cx, -(y0 - cy)), DEG = 180 / Math.PI;
      me.axis = app.viewRollAxis();
      me.stops = rollStops(quatOfEntity(e0), e0.rot || 0, me.axis);
      track = makeTrack(guide, { min: -180, max: 180, value: 0, layer, direction: { centre: [cx, cy], radius: rr, zero: a0, per: 1 / DEG },
        ticks: Array.from({ length: 8 }, (_, k) => { let v = k * NOTCH * DEG; v = ((v + 180) % 360 + 360) % 360 - 180; return { v, k, major: true }; }),
        marks: [{ v: 0, label: '', cls: 'start' }, ...me.stops.filter(st => Math.abs(st.a) > 1e-3).map(st => ({ v: st.a * DEG, label: st.label, cls: 'base' }))],
        format: (v) => `${Math.round(v)}°${drag?.notch != null ? ' ◆' : ''}${drag?.stop ? ` · ${drag.stop}` : ''}` });
    } else if (kind === 'lift') { // straight up from the floor of its storey; a mark where it would come to rest on what is under it
      const y0w = e0.y || 0, fy = app.floorYOf(e0), top = Math.max(y0w + 1, Math.min(fy + 15, y0w + (hy - 28) / ppf)), step = e0.kind === 'token' ? app.pawnLiftStep || 5 : ppf >= 7 ? 1 : 5; // (a pawn: under 5 ft it settles, so its ticks are the 5-ft heights)
      let land = null; try { const sb = app.worldOf(app.area()).surfaceBelow(e0.x, top, e0.z, new Set([e0.id, ...app.descendants(e0).map(x => x.id)]), fy); if (sb && sb.y > fy + 0.05 && sb.y < top) land = sb.y; } catch { }
      track = makeTrack(guide, { min: fy, max: top, value: y0w, layer, direction: { from: [hx, hy + (y0w - fy) * ppf], to: [hx, hy - (top - y0w) * ppf] },
        ticks: Array.from({ length: Math.floor((top - fy) / step) + 1 }, (_, i) => ({ v: fy + i * step, major: (i * step) % 5 === 0 })),
        marks: [{ v: fy, label: fy === 0 && !app.roomAt?.(e0.x, e0.z, 0) ? 'ground' : 'floor', cls: 'base' }, ...(land != null ? [{ v: land, label: 'lands', cls: 'land' }] : [])],
        format: (y) => `${feetIn(y - fy)} up` });
    } else if (kind === 'fog') { // A ROOM'S FOG HEIGHT, a drag track like damage (2026-10-20: "every slider is a drag track"; it was a
      // slider panel): 0 to FOG_MAX ft out along the handle's ray, a notch at 0 (no fog), a mark at the room type's own fog
      // ("type default": let go there and the room goes back to it). Dragging previews in THIS tab (world.fogPreview);
      // letting go sends ONE room.set { fog } (synced, undoable).
      const w = app.worldOf(app.area()), room = e0, upper = fogDefault(app.entities(), room) === 0;
      const fr = w.fogRooms?.().find(x => x.id === room.id), def = upper ? 0 : +(w.fx?.atmos?.typeDefault?.(room.recipe.type, !!fr?.outdoor) ?? 0) || 0;
      me.fog0 = room.fog ?? def; me.fog = me.fog0; me.fogDef = def; me.fogW = w; me.fogOwn = room.fog != null;
      track = makeTrack(guide, { min: 0, max: FOG_MAX, value: me.fog0, layer, direction: { from: [hx - ux * me.fog0 * FOG_PX, hy - uy * me.fog0 * FOG_PX], to: [hx + ux * (FOG_MAX - me.fog0) * FOG_PX, hy + uy * (FOG_MAX - me.fog0) * FOG_PX] },
        ticks: Array.from({ length: FOG_MAX + 1 }, (_, i) => ({ v: i, major: i % 2 === 0 })),
        marks: [{ v: 0, label: def > 0 ? 'none' : upper ? 'none · default' : 'none · type default', cls: 'base' }, ...(def > 0 ? [{ v: def, label: upper ? 'default' : 'type default', cls: 'land' }] : [])], // (a type with no fog: its zero IS the default, so letting go there puts the room back on its type, as the old slider's Type default button did)
        format: (v) => drag?.fogDefault ? `type default (${def > 0 ? `${+def.toFixed(2)} ft` : 'none'})` : v > 0 ? `${+(+v).toFixed(2)} ft fog` : 'no fog' });
    } else if (kind === 'damage') { // DAMAGE: out along the handle's ray, like size (Harry: "a drag in and out slider, similar to size"); outward is more damage, inward heals
      // DAMAGE_PX pixels per point on EVERY pawn. The rail starts at 0 and has no far end (there is no maximum): it is
      // drawn to the next multiple of 10 past the value + 10, and grows as the handle nears its end. Ticks every 5; one
      // mark, at 0. The handle is always where you grabbed it; a big change is typed.
      const d0v = damageOf(e0);
      me.dmg0 = d0v; me.dmg = d0v;
      const endFor = (v) => Math.min(DAMAGE_LIMIT, (Math.floor((v + 10) / 10) + 1) * 10);
      const mk = (end, value) => { me.dmgEnd = end; const lo = Math.max(0, Math.floor((d0v - 400) / 5) * 5);
        return makeTrack(guide, { min: 0, max: end, value: d0v, layer, direction: { from: [hx - ux * d0v * DAMAGE_PX, hy - uy * d0v * DAMAGE_PX], to: [hx + ux * (end - d0v) * DAMAGE_PX, hy + uy * (end - d0v) * DAMAGE_PX] },
          ticks: Array.from({ length: Math.floor((end - lo) / 5) + 1 }, (_, i) => ({ v: lo + i * 5, major: (lo + i * 5) % 10 === 0 })),
          marks: [{ v: 0, label: '0 · unhurt', cls: 'base' }], format: (v) => `${damageReadout(d0v, Math.round(v))} damage` }); }; // (the words are there because a bare number by a heart reads as hit points: Gemini, blind, 2026-10-06)
      track = mk(endFor(d0v));
      me.grow = (v) => { if (v > me.dmgEnd - 5 && me.dmgEnd < DAMAGE_LIMIT) { track.remove(); track = me.track = mk(endFor(v)); } }; // the rail extends with the value
    } else { // out along the handle's ray: smaller toward the centre, bigger away; 100% is where it was grabbed
      const reach = Math.min(...[ux > 0.05 ? (innerWidth - 24 - cx) / ux : ux < -0.05 ? (24 - cx) / ux : Infinity, uy > 0.05 ? (innerHeight - 24 - cy) / uy : uy < -0.05 ? (24 - cy) / uy : Infinity].filter(v => v > 0), 420);
      const kMin = softK(0), kMax = Math.max(1.25, softK(Math.max(1.3, reach / d0))), cat0 = (() => { try { return app.roomgen?.sizeOf?.(e0.cat, e0.sku)?.dims || null; } catch { return null; } })(), orig = cat0 ? Math.max(...cat0) / size0 : 1; // the catalog's size for this thing, as a share of its size now (a room lays things out a few percent off it: that still counts as 100%)
      track = makeTrack(guide, { min: kMin, max: kMax, value: 1, layer, direction: { at: (k) => { const dd = d0 * softKInv(Math.max(kMin, Math.min(kMax, k))); return [cx + ux * dd, cy + uy * dd]; } },
        ticks: [0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5].map(v => ({ v, major: v === 0.5 || v === 2 || v === 3 || v === 4 })),
        marks: Math.abs(orig - 1) < 0.06 ? [{ v: 1, label: '100%', cls: 'base' }] : [{ v: 1, label: 'now', cls: 'start' }, { v: orig, label: 'catalog size', cls: 'base' }],
        format: (k) => `${Math.round(k * 100)}% · ${feetIn(size0 * k)}` });
    }
    me.track = track;
    const ro = track.readout;
    const put = (x, y, v) => { handle.style.left = `${x}px`; handle.style.top = `${y}px`; const gl = guide.querySelector('.gl'); gl.setAttribute('x2', x); gl.setAttribute('y2', y); track.set(v, [x, y]); };
    const move = (e) => {
      if (!drag || (!drag.moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 4)) return;
      drag.moved = true;
      if (kind === 'rotate') {
        // the handle rides round the frozen centre at its starting radius; the turn is the change in its angle
        const a0 = Math.atan2(x0 - cx, -(y0 - cy)), a1 = Math.atan2(e.clientX - cx, -(e.clientY - cy));
        let d = -(a1 - a0); d = Math.atan2(Math.sin(d), Math.cos(d)); // screen-clockwise is a negative turn about +Y
        if (Math.abs(d - drag.delta) > Math.PI) d += Math.sign(drag.delta - d) * 2 * Math.PI; // keep turning past ±180°
        const r0 = sel[0].rot || 0;
        drag.notch = null;
        if (e.shiftKey) d = Math.round((r0 + d) / (Math.PI / 12)) * (Math.PI / 12) - r0;
        else { const k = Math.round((r0 + d) / NOTCH); if (Math.abs(r0 + d - k * NOTCH) <= NOTCH_CATCH) { d = k * NOTCH - r0; drag.notch = ((k % 8) + 8) % 8; } } // caught in a notch
        for (const tk of guide.querySelectorAll('.tick')) tk.classList.toggle('on', drag.notch != null && +tk.dataset.k === drag.notch);
        drag.delta = d;
        const cc = app.centroid(sel); app.localDrags.clear();
        for (const x of sel) { const p = rotAbout(x, cc, d, sel.length > 1); app.localDrags.set(x.id, { x: p.x, z: p.z, rot: (x.rot || 0) + d }); }
        app.ps.set(app.area(), { cursor: app.cursor, drag: [...app.localDrags].map(([id, p]) => ({ id, ...p })) });
        const rr = Math.hypot(hx - cx, hy - cy), aa = Math.atan2(e.clientX - cx, -(e.clientY - cy));
        put(cx + rr * Math.sin(aa), cy - rr * Math.cos(aa), -d * 180 / Math.PI);
      } else if (kind === 'tilt') {
        // the turn's arithmetic on the gesture's own angle: free, caught softly (4°) in the 45° notches and at the
        // special stops, Shift = 15° steps. Clockwise on screen = clockwise about the axis, which points away from you.
        const a0 = Math.atan2(x0 - cx, -(y0 - cy)), a1 = Math.atan2(e.clientX - cx, -(e.clientY - cy));
        let d = a1 - a0; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d - drag.delta) > Math.PI) d += Math.sign(drag.delta - d) * 2 * Math.PI; // keep rolling past ±180°
        drag.notch = null; drag.stop = null;
        if (e.shiftKey) d = Math.round(d / (Math.PI / 12)) * (Math.PI / 12);
        else {
          const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v)), st = drag.stops.find(st => Math.abs(wrap(d - st.a)) <= NOTCH_CATCH), k = Math.round(d / NOTCH);
          if (st) { d -= wrap(d - st.a); drag.stop = st.label; const kk = Math.round(d / NOTCH); drag.notch = Math.abs(d - kk * NOTCH) < 1e-6 ? ((kk % 8) + 8) % 8 : 8; } // (8: a stop that is no notch)
          else if (Math.abs(d - k * NOTCH) <= NOTCH_CATCH) { d = k * NOTCH; drag.notch = ((k % 8) + 8) % 8; } // caught in a notch
        }
        for (const tk of guide.querySelectorAll('.tick')) tk.classList.toggle('on', drag.notch != null && +tk.dataset.k === drag.notch);
        drag.delta = d;
        app.localDrags.clear();
        for (const x of sel) { const p = app.rolled(x, drag.axis, d); app.localDrags.set(x.id, { x: x.x, z: x.z, rot: p.rot, quat: p.quat }); } // (each about the same axis, through its own middle; quat null = upright)
        app.ps.set(app.area(), { cursor: app.cursor, drag: [...app.localDrags].map(([id, p]) => ({ id, x: p.x, z: p.z, rot: p.rot, quat: p.quat || Q_ID })) });
        const rr = Math.hypot(hx - cx, hy - cy);
        put(cx + rr * Math.sin(a1), cy - rr * Math.cos(a1), d * 180 / Math.PI);
      } else if (kind === 'fog') {
        const along = (e.clientX - x0) * ux + (e.clientY - y0) * uy;
        let v = Math.max(0, Math.min(FOG_MAX, drag.fog0 + along / FOG_PX)); if (v < FOG_NOTCH) v = 0;
        if (e.shiftKey) v = Math.round(v * 2) / 2;
        drag.fogDefault = drag.fogDef > 0 ? Math.abs(v - drag.fogDef) < 0.3 : v === 0; if (drag.fogDefault) v = drag.fogDef;
        drag.fog = v; (drag.fogW.fogPreview ||= new Map()).set(e0.id, v);
        const a = Math.max(-drag.fog0 * FOG_PX, Math.min((FOG_MAX - drag.fog0) * FOG_PX, along));
        put(hx + ux * a, hy + uy * a, v);
      } else if (kind === 'damage') {
        const along = (e.clientX - x0) * ux + (e.clientY - y0) * uy; // along the handle's ray only
        let v = Math.max(0, Math.min(DAMAGE_LIMIT, drag.dmg0 + Math.round(along / DAMAGE_PX)));
        if (e.shiftKey) v = Math.max(0, Math.round(v / 5) * 5); // Shift: to the fives
        drag.dmg = v; drag.grow(v);
        const a = Math.max(-drag.dmg0 * DAMAGE_PX, along); // the handle stays on its rail: never past 0
        put(hx + ux * a, hy + uy * a, v);
      } else if (kind === 'lift') {
        const y0w = e0.y || 0;
        let y = Math.max(app.floorYOf(e0), y0w + (y0 - e.clientY) / ppf); // no lower than the floor of the storey it is on
        if (e0.kind === 'token') { // A PAWN: under 5 ft above its base it settles there (app.pawnLandY), so the preview shows that; Shift: 5-ft steps
          const st = app.pawnLiftStep || 5, fy = app.floorYOf(e0); if (e.shiftKey) y = fy + Math.round((y - fy) / st) * st;
          y = app.pawnLandY(e0, e0.x, y, e0.z);
        } else if (e.shiftKey) y = Math.round(y * 2) / 2;
        drag.y = y;
        app.localDrags.set(e0.id, { x: e0.x, z: e0.z, y });
        app.ps.set(app.area(), { cursor: app.cursor, drag: [{ id: e0.id, x: e0.x, z: e0.z, y }] });
        put(hx, hy + (e.clientY - y0), y);
      } else {
        const d = (e.clientX - cx) * ux + (e.clientY - cy) * uy; // along the handle's ray only
        let k = softK(d / d0);
        if (e.shiftKey) k = Math.max(0.25, Math.min(K_HI, Math.round(k * 4) / 4));
        drag.k = k;
        app.localDrags.set(e0.id, { x: e0.x, z: e0.z, scale: k });
        const hd = Math.max(0, d); // the handle stays on its ray, never crossing the centre
        put(cx + ux * hd, cy + uy * hd, k);
      }
    };
    const mine = (e) => e.pointerId == null || e.pointerId === pid;
    const onMove = (e) => { if (drag !== me || !mine(e)) return; if (e.pointerType === 'mouse' && e.buttons === 0 && me.moved) return finish('no-button'); move(e); };
    const onUp = (e) => { if (mine(e)) finish('up'); };
    const onCancel = (e) => { if (mine(e)) finish('cancel'); };
    const onLost = (e) => { if (mine(e) && e.pointerType !== 'mouse') setTimeout(() => finish('lost-capture'), 0); }; // after a pointerup this finds the drag already over
    const onBlur = () => finish('blur');
    const onEsc = () => { if (drag !== me) return false; finish('escape'); };
    const listen = (on) => { const f = on ? addEventListener : removeEventListener; f('pointermove', onMove, true); f('pointerup', onUp, true); f('pointercancel', onCancel, true); f('blur', onBlur); handle[on ? 'addEventListener' : 'removeEventListener']('lostpointercapture', onLost); };
    // the ONE way out of a drag; `how` is what ended it. It runs once.
    function finish(how) {
      if (drag !== me) return;
      listen(false); { const i = app.escapeStack.indexOf(onEsc); if (i >= 0) app.escapeStack.splice(i, 1); }
      try { handle.releasePointerCapture(pid); } catch { }
      const d = drag; drag = null; app.localDrags.clear(); if (kind === 'fog') d.fogW?.fogPreview?.delete(e0.id);
      app.ps.set(app.area(), { cursor: app.cursor, drag: null });
      if (d.moved && how !== 'escape') track.release(); else track.remove(); // the track fades where it is; an aborted or unmoved grab just goes
      guide.remove(); layer.classList.remove('dragging'); handle.classList.remove('active');
      const log = app.ringDragLast = { kind, how, moved: d.moved, committed: false, value: kind === 'lift' ? d.y : kind === 'rotate' ? d.delta : kind === 'damage' ? d.dmg : kind === 'tilt' ? d.delta : kind === 'fog' ? (d.fogDefault ? 'default' : d.fog) : d.k }; // (tests)
      const done = () => { state && (state.shift = null); sig = ''; rebuild(); };
      if (how === 'escape') { if (d.moved) app.toast('Cancelled: nothing was changed'); return done(); }
      if (!d.moved) { // a click on the handle, not a drag
        if (how === 'up') { if (kind === 'rotate') R.run(c.id);
          else if (kind === 'tilt') app.toast('Drag the roll button round to tip it over (Shift: 15° steps)');
          else if (kind === 'fog') app.toast('Drag Fog height outward for more fog, inward for less; let go on "type default" to put the room back (Shift: 6 in steps)'); // (no click action: a click that lays the thing over steals the short drags. "roll 90" in the bar does it)
           else if (kind === 'damage') { done(); openDamageEdit(); return; } else app.toast(kind === 'lift' ? (d.sel?.[0]?.kind === 'token' ? 'Drag the raise / lower button up or down: a pawn under 5 ft settles to the ground (Shift: 5 ft steps)' : 'Drag the raise / lower button up or down (Shift: 6 in steps)') : 'Drag the resize button outward to grow, inward to shrink (Shift: 25% steps)'); }
        return done();
      }
      try {
        const now = (x) => app.selected().find(y => y.id === x.id) || x; // the thing as it is now (another seat may have changed it mid-drag)
        if (kind === 'lift' && d.y != null) { app.liftTo(now(d.sel[0]), d.y); log.committed = true; }
        if (kind === 'tilt' && d.delta) { app.rollSelection(d.delta, { axis: d.axis, things: d.sel.map(now) }); log.committed = true; } // one command for the gesture: one undo step
        if (kind === 'rotate' && d.delta) { const cc = app.centroid(d.sel); app.batch(d.sel.map(x => { const p = rotAbout(x, cc, d.delta, d.sel.length > 1); return { type: x.kind === 'token' ? 'token.move' : 'object.move', args: { id: x.id, x: r2(p.x), z: r2(p.z), rot: (x.rot || 0) + d.delta } }; })); log.committed = true; }
        // damage: the change, applied to every selected pawn as it is NOW (another seat may have hit it mid-drag)
        if (kind === 'fog' && (d.fogDefault ? d.fogOwn || d.fogDef > 0 : d.fog !== d.fog0)) { app.dispatch('room.set', { id: e0.id, fog: d.fogDefault ? -1 : +(+d.fog).toFixed(2) }); log.committed = true; }
        if (kind === 'damage' && d.dmg != null && d.dmg !== d.dmg0) { app.damageDelta(d.sel.map(now), d.dmg - d.dmg0); log.committed = true; }
        if (kind === 'size' && d.k !== 1) { const e = now(d.sel[0]); app.dispatch('object.set', { id: e.id, s: (e.s || [1, 1, 1]).map(v => v * d.k), dims: e.dims.map(v => v * d.k) }); log.committed = true; }
      } catch (err) { // never a silent snap-back
        log.error = String(err?.message || err); console.error(`ring: the ${kind} drag could not be sent`, err);
        app.toast(`That ${kind === 'lift' ? 'raise / lower' : kind === 'rotate' ? 'turn' : kind === 'damage' ? 'damage change' : kind === 'tilt' ? 'tilt' : kind === 'fog' ? 'fog height' : 'resize'} could not be sent: ${log.error}`, true);
      }
      done();
    }
    listen(true); app.escapeStack.push(onEsc);
  }
  const rotAbout = (x, c, a, group) => { if (!group) return { x: x.x, z: x.z }; const dx = x.x - c[0], dz = x.z - c[1], cs = Math.cos(a), sn = Math.sin(a); return { x: c[0] + dx * cs + dz * sn, z: c[1] - dx * sn + dz * cs }; };

  // ---------- sub-menus: one component, opened AT the button that asked for it ----------
  // Harry 2026-10-05: "when a sub-menu spawns it should spawn near the button that spawned it (covering that part of
  // the radial)". (Before, "replace with similar" fanned out on an arc above the ring and the long lists opened in a
  // panel beside it: both at a fixed place, wherever the button was.)
  // A sub-menu is ONE panel of tiles with a small title bar. A tile is a picture (a live turning model, a painted icon,
  // or a glyph) over a short name and does one thing. There is one level: no sub-menu opens another.
  //   where   the panel covers its button and reaches OUTWARD from the ring's centre (the button's inner edge is the
  //           panel's inner edge), so it hides that part of the circle and as little of the selected thing as it can;
  //           near a screen edge it moves inward just far enough to be whole, keeping its button under it and choosing
  //           the place that hides least of the thing; it is re-placed every frame, so it follows the ring when the
  //           camera moves. Opened with no ring button to stand on (Replace from the
  //           keyboard or the bar with ☰ closed), it stands on ☰.
  //   closes  on Escape, a click anywhere else, its ×, its own button again, or choosing an item
  // the panel itself: a title bar with ×, then whatever `fill` puts in it (tiles, or a slider)
  function showPanel({ group = null, title = '', cls = '', tiles = [], fill, onClose = null, keep = false }) {
    closeFlyout();
    const el = document.createElement('div');
    el.className = `flyout grid ${cls}`; el.setAttribute('role', 'menu'); if (group) el.dataset.group = group;
    flyout = { el, group, tiles, onClose, keep, selKey: [...app.sel].join() };
    const head = document.createElement('header');
    head.innerHTML = `<span>${esc(title)}</span><button class="fclose" title="Close" aria-label="Close">${icon('x', 14)}</button>`;
    head.querySelector('.fclose').onclick = (ev) => { ev.stopPropagation(); closeFlyout(); };
    el.append(head);
    fill(el);
    el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closeFlyout(); } }); // (a focused slider is a field: the key layer leaves its keys alone)
    layer.append(el);
    layoutFlyout();
    app.escapeStack.push(closeFlyout);
    setTimeout(() => { if (flyout?.el === el) addEventListener('pointerdown', away, true); }, 0);
    return el;
  }
  const FOG_MAX = 8, FOG_NOTCH = 0.38, FOG_PX = 22; // (fog height: 0-8 ft, a notch at 0, 22 px a foot along its track)
  // a click anywhere but the sub-menu (or a button that opens one: that button toggles it itself) closes it
  function away(ev) { if (!flyout) return removeEventListener('pointerdown', away, true); if (flyout.el.contains(ev.target) || ev.target.closest?.('.rbtn.grp')) return; closeFlyout(); }
  // (tests) the open sub-menu: whose it is, its tiles, its box and the box of the button it stands on
  app.ringFlyout = () => { if (!flyout && nest) { const bs = [...layer.querySelectorAll('.rbtn[data-nest]')], op = [...layer.querySelectorAll('.rbtn.grp')].find(b => b.dataset.group === nest.key), bx = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); };
      const box = bs.length ? bs.map(bx).reduce((u, b) => [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])]) : null;
      return { group: nest.key, nest: true, grid: false, tiles: nest.children.map(t => t.cmd || t.faction || t.area || t.label), box, anchor: op ? bx(op) : null, anchorIs: op ? op.dataset.group : null, centre: state?.center || null }; }
    if (!flyout) return null; const bx = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map(Math.round); }, a = panelAnchor();
    return { group: flyout.group, grid: true, ...(flyout.slider ? { slider: flyout.slider() } : {}), ...(flyout.sheet ? { sheet: flyout.sheet() } : {}), tiles: flyout.tiles.map(t => t.cmd || t.label), box: bx(flyout.el), anchor: a ? bx(a) : null, anchorIs: a ? (a.dataset.menu ? 'menu' : a.dataset.group) : null, slid: flyout.slid || [0, 0], centre: state?.center || null }; };
  app.on((what, e) => {
    const done = () => { closeNest(); collapse(); };
    if (what === 'ring.replace' && e) { // replace with similar: the thing's variants, turning, on the grown ring
      const vs = app.assets.similar(e.cat);
      if (!vs.length) { app.toast('Nothing similar in the catalog yet'); return; }
      openNest({ key: 'replace', title: 'Replace with', children: vs.map(v => ({ id: `replace:${v.sku || v.cat}`, label: v.name, preview: app.previewOf({ id: v.cat, sku: v.sku, place: e.place }), run: () => { app.replaceWith(e, v); done(); } })) });
    }
    if (what === 'ring.faction' && e) { // faction: its emblems on the grown ring ("As the building's" / "As the room's" first)
      const cat = factionCatalog(T.lib), own = explicitFaction(e), eff = own ? null : effectiveFaction(app.entities(), e, T.lib, T.types), url = (src) => !src ? '' : /^(?:https?:|data:|\/)/.test(src) ? src : T.base + src;
      openNest({ key: 'faction', title: 'Faction', children: [
        ...(e.kind !== 'building' ? [{ id: 'faction.inherit', faction: 'inherit', label: e.kind === 'room' ? "As the building's" : "As the room's", icon: 'undo-2', pressed: !own, run: () => { app.setFaction(e.id, 'inherit'); done(); } }] : []),
        ...cat.factions.map(f => ({ id: `faction.${f.id}`, faction: f.id, label: f.label, ...(eff === f.id && { title: `${f.label} (inherited)`, cls: 'inherited' }), pic: f.emblem ? url(f.emblem) : null, icon: 'sun', pressed: own === f.id, /* (the emblem it has now through its building / room: dashed, as in the old picker) */ disabled: e.kind === 'object' && !f.slots?.[e.cat], why: `${f.label}: this thing has no ${f.label} version`, run: () => { app.setFaction(e.id, f.id); done(); } })),
      ] });
    }
    if (what === 'ring.fog' && e) { if (!expanded) expand(); app.toast('Drag Fog height outward for more fog, inward for less'); } // (asked from the bar: the track is on the ring)
    if (what === 'ring.sheet' && e) showSheet(e);
    if (what === 'ring.damage') openDamageEdit();
    if (what === 'ring.give' && e) showSheet(e, 'owner'); // give control is on the sheet card (2026-10-11): "give control" in the bar opens the card there
    if (what === 'ring.travel' && e) openNest({ key: 'travel', title: 'Send to area', children: app.travelTiles(app.selected().length ? app.selected() : e, () => { closeNest(); collapse(); }).map((t, i) => ({ ...t, id: t.area ? `travel:${t.area}` : `travel:${i}` })) }); // a pawn's "Send to area" (surfaces/areas.js)
    if (what === 'ring.rename' && e) { if (e.kind === 'token') showSheet(e, 'name'); else startEdit(e); } // a pawn's name is on its sheet card (2026-10-11); F2 opens the card on it
  });
  // the button a sub-menu stands on: the one that opened it, or ☰ when that one is not on screen
  const panelAnchor = () => (flyout?.group && [...layer.querySelectorAll('.rbtn.grp')].find(b => b.dataset.group === flyout.group)) || layer.querySelector('.rbtn[data-menu]');
  function layoutFlyout() {
    if (!flyout || !state?.g) return;
    const a = panelAnchor(); if (!a) return;
    const el = flyout.el, w = el.offsetWidth, h = el.offsetHeight, W = innerWidth, H = innerHeight;
    const [cx, cy] = state.center || [state.g.cx, state.g.cy];
    const ax = parseFloat(a.style.left) || cx, ay = parseFloat(a.style.top) || cy, half = a.offsetWidth / 2;
    // outward from the ring's centre through the button; the panel's centre goes far enough along that line for the
    // panel's inner edge to land on the button's inner edge
    let ux = ax - cx, uy = ay - cy; const ul = Math.hypot(ux, uy); if (ul < 1) { ux = 0; uy = 1; } else { ux /= ul; uy /= ul; }
    const reach = Math.max(0, Math.min(w / 2 / Math.max(1e-6, Math.abs(ux)), h / 2 / Math.max(1e-6, Math.abs(uy))) - half - 4);
    const x0 = ax + ux * reach - w / 2, y0 = ay + uy * reach - h / 2;
    // on screen, whole (below the top bar). Where the outward place does not fit, the panel keeps its button under it
    // and, of the places that do fit, takes the one that hides least of the selected thing, then the nearest to outward
    const cl = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), v)), X = (v) => cl(v, 8, W - w - 8), Y = (v) => cl(v, 64, H - h - 8);
    let x = X(x0), y = Y(y0);
    if (x !== x0 || y !== y0) {
      const g = state.g, hide = (px, py) => Math.max(0, Math.min(px + w, g.cx + g.hx) - Math.max(px, g.cx - g.hx)) * Math.max(0, Math.min(py + h, g.cy + g.hy) - Math.max(py, g.cy - g.hy));
      let best = hide(x, y) + 1e-3 * Math.hypot(x - x0, y - y0);
      for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { // the panel may sit anywhere that keeps the button's centre inside it
        const px = X(ax - half - (w - 2 * half) * i / 4), py = Y(ay - half - (h - 2 * half) * j / 4);
        if (ax < px || ax > px + w || ay < py || ay > py + h) continue;
        const sc = hide(px, py) + 1e-3 * Math.hypot(px - x0, py - y0);
        if (sc < best - 0.5) { best = sc; x = px; y = py; }
      }
    }
    flyout.slid = [Math.round(x - x0), Math.round(y - y0)];
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  }
  function closeFlyout() { if (!flyout) return false; removeEventListener('pointerdown', away, true); try { flyout.onClose?.(); } catch (err) { console.error(err); } app.previews.detachAll(flyout.el); flyout.el.remove(); flyout = null; const i = app.escapeStack.indexOf(closeFlyout); if (i >= 0) app.escapeStack.splice(i, 1); }

  // ---------- a pawn's damage, typed (a plain click on the damage handle; Space V; "+7" in the bar) ----------
  // One small parser (core/pawn.js parseDamage): 7 or +7 takes 7 (the common case), -5 heals 5 (never below 0), =12
  // sets it. Enter applies, Escape cancels, clicking away cancels. It applies to every selected pawn.
  const DMG_HINT = '7 takes 7 · -5 heals 5 · =12 sets it';
  function openDamageEdit() {
    const sel = app.selected().filter(e => e.kind === 'token'); if (!sel.length || !state) return;
    closeDamageEdit(); closeFlyout();
    const btn = layer.querySelector('.rbtn[data-cmd="pawn.damage"]') || layer.querySelector('.rbtn[data-menu]');
    const el = dmgEdit = document.createElement('div'); el.className = 'dmg-edit';
    const one = sel.length === 1 ? sel[0] : null;
    el.innerHTML = `<label>${icon('heart-crack', 14)}<span class="dmg-now">${one ? (damageOf(one) ? `${damageOf(one)} damage` : 'No damage') : `${sel.length} pawns`}</span></label><input type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="8" placeholder="7   -5   =12" aria-label="Damage: 7 takes 7, -5 heals 5, =12 sets it"><div class="dmg-hint">${DMG_HINT}</div>`;
    el.style.left = btn?.style.left || '50%'; el.style.top = `${(parseFloat(btn?.style.top) || 200) - BIG * 0.5 - 8}px`;
    layer.append(el);
    const input = el.querySelector('input'), hint = el.querySelector('.dmg-hint');
    const now = () => app.selected().filter(e => e.kind === 'token');
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); closeDamageEdit(); return; }
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const p = parseDamage(input.value), ps = now();
      if (!p || !ps.length) { el.classList.add('bad'); hint.textContent = 'Type 7, -5 or =12'; return; }
      if (p.delta != null) app.damageDelta(ps, p.delta); else app.damageSet(ps, p.set);
      app.ringDamageLast = { text: input.value, parsed: p }; // (tests)
      closeDamageEdit();
    });
    input.addEventListener('input', () => { el.classList.remove('bad'); const p = parseDamage(input.value), o = now().length === 1 ? now()[0] : null; hint.textContent = p && o ? damageReadout(damageOf(o), p.delta != null ? damageAfter(o.damage, p.delta) : p.set) : DMG_HINT; });
    input.addEventListener('blur', () => setTimeout(() => { if (dmgEdit === el) closeDamageEdit(); }, 120));
    el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    input.focus();
  }
  function closeDamageEdit() { if (dmgEdit) { dmgEdit.remove(); dmgEdit = null; } }
  app.ringDamageEdit = () => dmgEdit && { value: dmgEdit.querySelector('input').value, hint: dmgEdit.querySelector('.dmg-hint').textContent, bad: dmgEdit.classList.contains('bad'), now: dmgEdit.querySelector('.dmg-now').textContent }; // (tests)

  // ---------- a pawn's sheet card (the ring's Sheet button) ----------
  // Harry 2026-10-06: "item three should be basically a link to the character sheet ... a button that opens a link in a
  // new window"; "the 'sheet' link can also open up 'notes' and 'gm notes' text areas, maybe like tabs?" One click
  // opens a small card AT the button: the link, large, at the top (a new tab; http/https only; its site named on hover);
  // with no link yet, the card is where you paste one. Below, two tabs of plain text: Notes (everyone at the table
  // reads them; the pawn's owner and the GM write) and GM notes (the GM side only: the relay never SENDS them to a
  // player's client, core/labels.js). What is typed is saved when the field is left, a moment after the last key, and
  // when the card closes: never dropped.
  // WHO THE PAWN IS, at the top of the card (Harry 2026-10-11: Name and Give control left the ☰ for "the character-sheet
  // area"). Two plain rows above the link:
  //   Name        a field, for the pawn's owner and the GM (who could rename it before); Enter or leaving the field
  //               saves, Escape puts the old name back. A seat that may not rename sees the name in the card's title only.
  //   Moved by    the GM picks who controls the pawn from the people at the table, or "No one (the GM moves it)"
  //               (token.owner, as Give control ▸ did). Every other seat reads the same line as plain words.
  // focus: 'name' | 'owner' puts the caret there (F2 and "give control" in the bar open the card on their row).
  function showSheet(e0, focus = null) {
    const id = e0.id, cur = () => app.entities()[id] || e0;
    const mayEdit = () => app.gm() || app.canTouch(cur());
    let tab = 'notes', editingLink = false, timer = null;
    const field = () => tab === 'gm' ? 'gmNotes' : 'notes';
    const dirty = { notes: null, gmNotes: null }; // typed, not yet sent
    const people = () => (app.sync.campaign?.seats || []).filter(s => s.kind === 'human'); // (an agent acts for its person)
    let nameCancelled = false;
    const saveName = () => { const inp = who?.querySelector('.sh-name'); if (!inp || nameCancelled || !app.entities()[id] || !mayEdit()) return; const v = inp.value.trim().slice(0, 80); if (v && v !== cur().name) app.rename(cur(), v); else if (!v) inp.value = cur().name || ''; };
    const flush = () => { clearTimeout(timer); timer = null; saveName(); for (const k of ['notes', 'gmNotes']) { const v = dirty[k]; dirty[k] = null; if (v != null && v !== (cur()[k] || '') && app.entities()[id] && (k === 'notes' ? mayEdit() : app.gm())) app.dispatch('token.set', { id, [k]: v }); } };
    const el = showPanel({ group: 'sheet', title: `${e0.name}`, cls: 'slider sheet', keep: true, onClose: () => { flush(); off(); }, fill: (el) => {
      el.insertAdjacentHTML('beforeend', `<div class="sh-who"></div><div class="sh-link"></div><div class="sh-err" role="alert"></div>
        <div class="sh-tabs" role="tablist"><button role="tab" data-tab="notes">Notes</button>${app.gm() ? '<button role="tab" data-tab="gm">GM notes</button>' : ''}</div>
        <div class="sh-body"></div>`);
    } });
    const linkBox = el.querySelector('.sh-link'), err = el.querySelector('.sh-err'), body = el.querySelector('.sh-body'), who = el.querySelector('.sh-who');
    const ownerName = (e) => { const s = (app.sync.campaign?.seats || []).find(s => s.id === e.owner); return e.owner ? (s ? `${s.name}${s.role === 'gm' ? ' (GM)' : ''}` : 'someone not at the table') : 'No one (the GM moves it)'; };
    function drawWho() {
      const e = cur(), uid = `sh${id.replace(/\W/g, '')}`;
      who.innerHTML = `${mayEdit() ? `<label class="sh-row" for="${uid}n"><span>Name</span><input class="sh-name" id="${uid}n" type="text" autocomplete="off" spellcheck="false" maxlength="80" aria-label="The pawn's name"></label>` : ''}
        <label class="sh-row" for="${uid}o"><span>Moved by</span>${app.gm() ? `<select class="sh-owner" id="${uid}o" aria-label="Who controls this pawn"></select>` : `<b class="sh-ownedby"></b>`}</label>`;
      const inp = who.querySelector('.sh-name');
      if (inp) {
        inp.value = e.name || ''; nameCancelled = false;
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); saveName(); inp.blur(); } if (ev.key === 'Escape') { nameCancelled = true; inp.value = cur().name || ''; } }); // (Escape goes on to close the card)
        inp.addEventListener('input', () => { nameCancelled = false; });
        inp.addEventListener('change', saveName);
      }
      const sel = who.querySelector('.sh-owner');
      if (sel) {
        const opt = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o); };
        for (const s of people()) opt(s.id, `${s.name}${s.role === 'gm' ? ' (GM)' : ''}`);
        if (e.owner && !people().some(s => s.id === e.owner)) opt(e.owner, ownerName(e)); // (its owner is an agent, or has left)
        opt('', 'No one (the GM moves it)');
        sel.value = e.owner || '';
        sel.addEventListener('change', () => { if (app.entities()[id] && (sel.value || '') !== (cur().owner || '')) app.giveTo(cur(), sel.value); });
      } else who.querySelector('.sh-ownedby').textContent = ownerName(e);
    }
    function drawLink() {
      const e = cur(), url = e.sheet && !sheetProblem(e.sheet) ? e.sheet : '';
      err.textContent = '';
      if (url && !editingLink) {
        const host = sheetHost(url);
        linkBox.innerHTML = `<a class="sheetlink" target="_blank" rel="noopener noreferrer" data-tip="${esc(host)}" title="Opens ${esc(host)} in a new tab">${icon('external-link', 20)}<span>Open character sheet</span></a>${mayEdit() ? '<button class="sh-change" title="Change or remove the link">Change</button>' : ''}`;
        linkBox.querySelector('a').href = url;
        const ch = linkBox.querySelector('.sh-change'); if (ch) ch.onclick = (ev) => { ev.stopPropagation(); editingLink = true; drawLink(); linkBox.querySelector('input')?.focus(); };
      } else if (mayEdit()) {
        linkBox.innerHTML = `<input class="sh-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" maxlength="500" placeholder="Paste the character sheet's link" aria-label="Character sheet link"><button class="sh-save">Save</button>`;
        const input = linkBox.querySelector('input'); input.value = url;
        const save = () => { const v = cleanSheet(input.value), why = sheetProblem(v); if (why) { err.textContent = why[0].toUpperCase() + why.slice(1); return; } editingLink = false; if (v !== (cur().sheet || '')) app.dispatch('token.set', { id, sheet: v }); else drawLink(); };
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); save(); } });
        input.addEventListener('input', () => { err.textContent = ''; });
        linkBox.querySelector('.sh-save').onclick = (ev) => { ev.stopPropagation(); save(); };
      } else linkBox.innerHTML = '<div class="sh-none">No character sheet linked yet</div>';
    }
    function drawBody() {
      for (const b of el.querySelectorAll('.sh-tabs button')) { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); }
      const k = field(), can = k === 'gmNotes' ? app.gm() : mayEdit(), text = dirty[k] ?? cur()[k] ?? '';
      if (can) {
        body.innerHTML = `<textarea class="sh-notes" maxlength="4000" rows="6" placeholder="${k === 'gmNotes' ? 'Only the GM sees these' : 'Everyone at the table can read these'}" aria-label="${k === 'gmNotes' ? 'GM notes' : 'Notes'}"></textarea><div class="sh-foot">${k === 'gmNotes' ? 'GM only: never sent to players' : 'Shared with the table'}</div>`;
        const ta = body.querySelector('textarea'); ta.value = text;
        ta.addEventListener('input', () => { dirty[k] = ta.value; clearTimeout(timer); timer = setTimeout(flush, 1200); });
        ta.addEventListener('change', flush);
      } else body.innerHTML = `<div class="sh-read${text ? '' : ' none'}"></div><div class="sh-foot">Shared with the table</div>`, body.querySelector('.sh-read').textContent = text || 'No notes yet';
    }
    for (const b of el.querySelectorAll('.sh-tabs button')) b.onclick = (ev) => { ev.stopPropagation(); if (b.dataset.tab === tab) return; flush(); tab = b.dataset.tab; drawBody(); };
    // another seat's change shows at once, except in a field you are typing in
    let last = '', lastSheet = cur().sheet || '';
    const snap = () => { const e = cur(); return `${e.sheet || ''}|${e.notes || ''}|${e.gmNotes || ''}|${e.name}|${mayEdit()}|${e.owner || ''}|${app.gm()}|${people().map(s => s.id + s.name).join()}`; };
    const off = app.on((what) => { if (what !== 'change' && what !== 'refresh') return; if (flyout?.el !== el) return; const s = snap(); if (s === last) return; last = s;
      el.querySelector('header span').textContent = cur().name;
      if (!who.contains(document.activeElement)) drawWho(); // (never under a name being typed, or an open list)
      if ((cur().sheet || '') !== lastSheet || !linkBox.contains(document.activeElement)) { lastSheet = cur().sheet || ''; drawLink(); } // (a saved link replaces the field it was typed in)
      if (!body.contains(document.activeElement) && dirty[field()] == null) drawBody(); });
    last = snap(); drawWho(); drawLink(); drawBody(); layoutFlyout();
    if (focus) { const f = who.querySelector(focus === 'owner' ? '.sh-owner' : '.sh-name'); if (f) { f.focus({ preventScroll: true }); f.select?.(); } }
    flyout.sheet = () => ({ id, tab, name: who.querySelector('.sh-name')?.value ?? null, owner: who.querySelector('.sh-owner')?.value ?? null, owners: [...who.querySelectorAll('.sh-owner option')].map(o => o.value), ownedBy: who.querySelector('.sh-ownedby')?.textContent ?? who.querySelector('.sh-owner')?.selectedOptions[0]?.textContent ?? null, link: linkBox.querySelector('a')?.href || null, host: linkBox.querySelector('a')?.dataset.tip || null, target: linkBox.querySelector('a')?.target || null, rel: linkBox.querySelector('a')?.rel || null, paste: !!linkBox.querySelector('input'), error: err.textContent, tabs: [...el.querySelectorAll('.sh-tabs button')].map(b => b.dataset.tab), text: body.querySelector('textarea')?.value ?? body.querySelector('.sh-read')?.textContent ?? '', editable: !!body.querySelector('textarea') });
  }

  function startEdit(e) {
    stopEdit(); collapse();
    editing = document.createElement('input');
    editing.className = 'ring-edit'; editing.value = e.name || ''; editing.maxLength = 80;
    layer.append(editing);
    position();
    editing.focus(); editing.select();
    editing.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { const v = editing.value.trim(); if (v && v !== e.name) app.rename(e, v); stopEdit(); } if (ev.key === 'Escape') { ev.stopPropagation(); stopEdit(); } });
    editing.addEventListener('blur', () => setTimeout(stopEdit, 100));
  }
  function stopEdit() { if (editing) { editing.remove(); editing = null; } }

  // a new selection (or none) folds the expanded circle back
  app.on((what) => { if (what === 'selection') { expanded = null; nest = null; trans = null; sig = ''; } if (what === 'selection' || what === 'refresh' || what === 'change') rebuild(); if (what === 'frame') position(); });
  return { name: 'ring', state: () => state, expand, collapse, expanded: () => !!expanded };
}
const r2 = (v) => Math.round(v * 100) / 100;
const feetIn = (y) => { const tot = Math.round(y * 12), f = Math.floor(tot / 12), i = tot % 12; return `${f} ft${i ? ` ${i} in` : ''}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
