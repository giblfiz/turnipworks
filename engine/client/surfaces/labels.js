// Room and building labels are the selection handles (Harry 2026-10-03, docs/UI.md "Labels select rooms and
// buildings"): a room made with the room tool shows its name ("Common room", or what the GM renamed it), a building
// shows its own label, and clicking a label selects the whole room or building (a floor click selects nothing).
// Double-click a room's label to look into that room (the cut). THE LABEL IS WHERE A ROOM IS RENAMED (2026-10-11: Rename
// left the room's ring): double-click the label of the room that is ALREADY selected, or press F2 with the
// room selected, and its name is typed in place. (Enter is not rename: it steps into the room's children.) Only seats that may edit rooms ever see labels (and the relay never even sends
// the names to anyone else: core/labels.js).
// Style: quiet pills floating over each room's centre at roof height (screen-facing, so always readable), the
// building's above it; when they crowd, the more important label (building > bigger room) keeps its place, the others
// try a nudge up, down or aside, then step aside. Selection never reorders them, so a label stays under the pointer.
// A label right over a pawn fades a little instead of moving.
// 2026-10-06 (Harry: "We are getting 'blinks' on some of the room labels when they are on the edge of
// shouldn't-show / should-show situations"). The cause was the hidden state itself: a label that found no free place
// was `display: none`, so the next frame it measured 0 x 0, fitted anywhere, was shown, measured its real size, did
// not fit, and so on, every frame. Also every threshold (the crowd test, the PiP's edge, the window's edge) was one
// number, crossed back and forth by a slow pan. Now: a hidden label keeps its layout (it fades out, 150 ms); a shown
// label keeps its place until its box is 2 px INTO a more important one, while arriving needs 4 px clear; the window's
// edge is 40 px to arrive and 90 px to leave; and a label never changes more than once in 450 ms.
// 2026-10-05 (Harry): twice the size and a little see-through (82%); the label is also the room's HANDLE: hovering it
// shows the room's hover treatment, pressing and dragging it moves the room (input.js labelPress), and a hidden room's
// label says so (an eye-off mark, the hidden violet).
// 2026-10-20 (Harry: "I want to play with their size, scaling and position a little"): every number here is the LABEL
// LOOK (labels/look.js): the house value (GET /tuner/house -> labels, Label lab's "Use as default"), or the lab's live
// settings (?labellab=1). With neither, `S` is null and the labels are drawn exactly as before: the same numbers (look.js
// TODAY) and no style of their own (the .lb class, which carries the size and look as CSS variables, is never added).
import * as THREE from 'three';
import { icon } from '../icons.js';
import { T } from '../tuner.js';
import { TODAY, NEVER_FT, normalize, textPx, fadeAt } from '../labels/look.js';

const CELL = 5;
const NATIVE = { room: 24, building: 13 }; // px: the text size the pill's own padding, corners and marks are drawn for (style.css .rlabel)

export function labelsSurface(R, app) {
  const layer = document.getElementById('labels');
  const els = new Map(); // id -> element
  let shown = (() => { try { return localStorage.getItem('tw.labels') !== 'off'; } catch { return true; } })();
  app.labelsOn = () => shown;
  app.setLabels = (on) => { shown = on; try { localStorage.setItem('tw.labels', on ? 'on' : 'off'); } catch { } app.refresh(); };
  app.labelInfo = () => [...els.values()].map(el => ({ id: el.dataset.id, kind: el.dataset.kind, text: el.querySelector('.lt')?.textContent, visible: el.classList.contains('on'), hidden: el.classList.contains('hidden-room'), rect: el.classList.contains('on') ? [...rectOf(el)] : null, font: parseFloat(getComputedStyle(el).fontSize), opacity: +getComputedStyle(el).opacity, ...(el._lb && { look: { ...el._lb } }) }));
  // THE LOOK: the lab's live settings, else the house value, else null (today's look, untouched)
  const house = T.house?.labels ? normalize(T.house.labels) : null;
  let lab;
  app.labelLook = () => lab !== undefined ? lab : house;
  app.labelHouse = () => house;
  app.setLabelLook = (s) => { lab = s === undefined ? undefined : s && normalize(s); app.refresh?.(); }; // (Label lab: undefined goes back to the house value)

  const allowed = () => app.can('room') && shown;
  const textOf = (e) => e.kind === 'building' ? e.name : (e.name || app.roomgen.typeList.find(t => t.key === e.recipe.type)?.label || e.recipe.type);
  function ensure(e) {
    let el = els.get(e.id);
    if (!el) {
      el = document.createElement('div');
      el.className = `rlabel ${e.kind}`; el.dataset.id = e.id; el.dataset.kind = e.kind;
      el.innerHTML = `${e.kind === 'building' ? icon('house', 13) : ''}<span class="hid" hidden title="Hidden from players">${icon('eye-off', 20)}</span><span class="lt"></span>`;
      // (was this room the selection BEFORE this press? a double-click's first press selects it, so the answer is taken
      // at the first press of the pair and kept for the second)
      el.onpointerdown = (ev) => { ev.stopPropagation(); if (ev.button === 0 && ev.timeStamp - (el._press?.t ?? -1e9) > 600) el._press = { t: ev.timeStamp, was: app.sel.size === 1 && app.sel.has(e.id) }; if (!el.classList.contains('editing')) app.labelPress?.(e.id, ev); };
      el.title = e.kind === 'room' ? 'Click: select the room · double-click: look into it · selected: double-click or F2 to rename' : 'Click: select the building · double-click: rename';
      el.onpointerenter = () => { if (app.mode) return; app.hover = e.id; app.emit('hover', e.id); };
      el.onpointerleave = () => { if (app.hover === e.id) { app.hover = null; app.emit('hover', null); } };
      el.onclick = (ev) => { ev.stopPropagation(); app.select(e.id, ev.shiftKey ? 'add' : (ev.ctrlKey || ev.metaKey) ? 'toggle' : 'replace'); };
      // a double-click on a ROOM's label takes the cut to that room's ceiling (Harry 2026-10-05; surfaces/cut.js); on the
      // label of the room that was ALREADY selected it renames, in place (2026-10-11; also F2 and the bar). A
      // building's label renames on any double-click (a building has no one ceiling to cut at).
      el.ondblclick = (ev) => { ev.stopPropagation(); if (el.classList.contains('editing')) return; const now = app.ent(e.id), was = !!el._press?.was; el._press = null; if (now?.kind === 'room' && app.cutToRoom && !(was && app.can('room'))) app.cutToRoom(now, 'label'); else startRename(el); };
      layer.append(el); els.set(e.id, el);
    }
    const t = textOf(e);
    if (el.querySelector('.lt').textContent !== t && !el.querySelector('input')) el.querySelector('.lt').textContent = t;
    // a hidden room (or a building with every room hidden) wears the mark
    const hid = e.kind === 'room' ? !!e.hidden : !!e.hidden;
    if (el.classList.contains('hidden-room') !== hid) { el.classList.toggle('hidden-room', hid); el.querySelector('.hid').hidden = !hid; }
    return el;
  }
  function startRename(el) {
    const e = app.ent(el.dataset.id); if (!e || !app.can('room')) return;
    const lt = el.querySelector('.lt'), inp = document.createElement('input');
    inp.value = e.kind === 'building' ? e.name : (e.name || ''); inp.placeholder = textOf({ ...e, name: '' }); inp.maxLength = 60;
    if (el.classList.contains('editing')) return;
    lt.hidden = true; el.append(inp); el.classList.add('editing'); inp.focus(); inp.select();
    inp.onpointerdown = inp.onclick = inp.ondblclick = (ev) => ev.stopPropagation(); // a click in the field places the caret (it is not the label's click)
    let finished = false; // Enter removes the input, and removing it fires blur: finish once
    const done = (ok) => { if (finished) return; finished = true; const v = inp.value.trim(), now = app.ent(e.id); lt.hidden = false; el.classList.remove('editing'); if (ok && now && v !== (now.name || '')) app.renameLabel(now, v); inp.remove(); app.labelRenameLast = { id: e.id, saved: !!(ok && now && v !== (now.name || '')), text: v }; }; // (unchanged: nothing is sent, so nothing lands on the undo stack)
    inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); };
    inp.onblur = () => done(true);
  }
  app.renameLabel = (e, name) => e.kind === 'building' ? (name && app.dispatch('building.set', { id: e.id, name })) : app.dispatch('room.set', { id: e.id, name });
  app.startLabelRename = (id) => { const e = app.entities()[id], el = els.get(id) || (e && (e.kind === 'room' || e.kind === 'building') ? ensure(e) : null); if (el) startRename(el); }; // (a label far off the screen has no element until it is wanted)

  function rectOf(el) { const x = +el.dataset.x, y = +el.dataset.y; return [x, y, x + el.offsetWidth, y + el.offsetHeight]; }
  // the crowd rules (TODAY: 4 / 3 px clear to arrive, 2 px into the other to be pushed out; 40 / 90 px past the window's
  // edge to arrive / to leave; 450 ms between two changes of one label)
  let C = TODAY.crowd;
  const overlap = (a, b) => a[0] < b[2] + C.arriveX && b[0] < a[2] + C.arriveX && a[1] < b[3] + C.arriveY && b[1] < a[3] + C.arriveY; // to ARRIVE: 4 px clear
  const touch = (a, b) => a[0] < b[2] - C.leave && b[0] < a[2] - C.leave && a[1] < b[3] - C.leave && b[1] < a[3] - C.leave;       // to be pushed OUT: 2 px into the other
  let lookKey = null; // the layer's look variables, written when they change
  // (tests) how often each label has changed between shown and hidden, and stepped from one place to another
  app.labelFlips = () => Object.fromEntries([...els].map(([id, el]) => [id, { flips: el._st?.flips || 0, steps: el._st?.steps || 0, slot: el._st?.slot ?? null }]));

  app.on((what) => {
    if (what !== 'frame') return;
    layer.classList.toggle('passive', !!app.mode); // while a tool or a drag-to-place is live, labels never catch the drop
    const E = app.entities(), S = app.labelLook();
    // (labels respect the cut: a room above it has no label, and a building none of whose rooms show has none either;
    // nor has a room that lies wholly under a floor that is showing, or under the unopened ground: its label would
    // float over the room above and read as that room's. Step a floor down, [ , to reach it.)
    // (which entities can have a label at all is worked out once per state, not per frame: main.js app.derived)
    const byB = app.roomsByBuilding(E), base = app.derived('labelled', (X) => Object.values(X).filter(e => e.kind === 'room' || (e.kind === 'building' && byB.has(e.id))), E);
    // (a room under its own roof: Roofs on hides its label, unless the look says otherwise)
    const roofOnly = (e) => { const w0 = app.main && app.worldOf?.(app.area()), rec = w0?.roofRecs?.get(e.id); return !!(rec && w0.roofShown(rec)); }; // (asked only when a look keeps labels under roofs)
    const want = allowed() ? base.filter(e => !app.fog?.hidden(e) && !app.cutHides?.(e) && !(e.kind === 'room' && app.roomCovered?.(e) && !(S && !S.when.underRoof && roofOnly(e)))) : [];
    const ids = new Set(want.map(e => e.id));
    for (const [id, el] of els) if (!ids.has(id)) { el.remove(); els.delete(id); }
    if (!want.length) return;
    const W = innerWidth, H = innerHeight, cam = app.main?.camera; if (!cam) return;
    const Z = S || TODAY; C = Z.crowd;
    const EDGE_IN = C.edgeIn, EDGE_OUT = C.edgeOut, DWELL = C.dwell, ROOF = Z.place.ft;
    const key = S ? `${S.look.opacity}|${S.look.pad}|${S.look.round}` : null;
    if (key !== lookKey) { lookKey = key; for (const [k, v] of [['--lb-o', S && S.look.opacity / 100], ['--lb-p', S?.look.pad], ['--lb-r', S && S.look.round + 'px']]) if (S) layer.style.setProperty(k, v); else layer.style.removeProperty(k); }
    // (with a look: the camera, for the nudge, the distance, px per ft at a label and a room's width on screen)
    let geo = null;
    if (S) {
      cam.updateMatrixWorld(); const m = cam.matrixWorld.elements, cr = document.getElementById('c')?.getBoundingClientRect(), [vl, vt, vw, vh] = app.main.rect || [0, 0, 1, 1];
      const rl = Math.hypot(m[0], m[2]) || 1, fl = Math.hypot(m[8], m[10]) || 1, v = new THREE.Vector3();
      const hPx = (cr?.height || H) * vh, tanH = Math.tan((cam.fov || 45) * Math.PI / 360);
      geo = { rx: m[0] / rl, rz: m[2] / rl, fx: -m[8] / fl, fz: -m[10] / fl, cx: m[12], cy: m[13], cz: m[14], dx: -m[8], dy: -m[9], dz: -m[10],
        pxPerFt: (x, y, z) => { const d = (x - m[12]) * -m[8] + (y - m[13]) * -m[9] + (z - m[14]) * -m[10]; return d > 0.1 ? hPx / (2 * tanH * d) : 0; },
        sx: (x, y, z) => { v.set(x, y, z).project(cam); return (cr?.left || 0) + (vl + (v.x + 1) / 2 * vw) * (cr?.width || W); } };
    }
    // anchor points (Harry 2026-10-04): a room's title floats over its centre at roof height (just above the wall tops,
    // so the walls never hide it); a building's over the building's centre, a little above the roof line
    const items = want.map(e => {
      let x, z, y, area = 0, box;
      if (e.kind === 'room') { const c = e.recipe; [x, z] = app.labelPointOf(c); y = (c.y || 0) + ROOF; area = app.footprint.areaCells(c); box = [c.x, c.z, c.x + c.w, c.z + c.d]; } // over the middle of the largest rectangle inside the room: on its floor, never over an L's notch
      else { const rs = byB.get(e.id) || []; const x0 = Math.min(...rs.map(r => r.recipe.x)), x1 = Math.max(...rs.map(r => r.recipe.x + r.recipe.w)), z0 = Math.min(...rs.map(r => r.recipe.z)), z1 = Math.max(...rs.map(r => r.recipe.z + r.recipe.d)); x = (x0 + x1) / 2 * CELL; z = (z0 + z1) / 2 * CELL; const up = rs.filter(r => !app.cutHides?.(r)); y = Math.max(...(up.length ? up : rs).map(r => r.recipe.y || 0)) + ROOF + Z.place.buildingFt; area = 1e6; box = [x0, z0, x1, z1]; } // (over the highest storey that is showing)
      // (the look's nudge: sideways along the camera's right, forward away from it, on the ground)
      if (geo && (Z.place.side || Z.place.fwd)) { x += geo.rx * Z.place.side + geo.fx * Z.place.fwd; z += geo.rz * Z.place.side + geo.fz * Z.place.fwd; }
      const s = app.screenOf(x, z, app.main, y);
      const pri = area; // stable: a label never jumps because it was clicked (that would break a double-click)
      return { e, s, pri, x, y, z, box };
    }).sort((a, b) => b.pri - a.pri);
    // the PiP window covers that part of the main view: no label there (it would also catch the PiP's clicks)
    const pr = app.pip && document.getElementById('pipFrame')?.getBoundingClientRect();
    const placed = pr && pr.width ? [[pr.left, pr.top, pr.right, pr.bottom]] : [];
    const pawns = app.pawnList(E).map(t => app.screenOf(t.x, t.z, app.main, 2));
    const now = performance.now();
    for (const { e, s, x: ax, y: ay, z: az, box } of items) {
      // A LABEL FAR OFF THE SCREEN COSTS NOTHING (big maps, 2026-10-06): it has no element until its room first comes near
      // the window, and one that is off and stays off is not touched (each touch is a style write and a size read)
      const near = Number.isFinite(s.x) && s.x > -EDGE_OUT && s.x < W + EDGE_OUT && s.y > -EDGE_OUT / 2 && s.y < H + EDGE_OUT / 2;
      if (!near) { const old = els.get(e.id); if (!old || (!old._st?.on && !old.classList.contains('editing') && !old.classList.contains('sel') === !app.sel.has(e.id))) continue; }
      const el = ensure(e), st = el._st ||= { on: false, at: -1e9, movedAt: -1e9, slot: null, flips: 0, steps: 0 };
      el.classList.toggle('sel', app.sel.has(e.id));
      // NO BLINKING (Harry 2026-10-06). Three rules, see the header: the size is always measurable (a hidden label keeps
      // its layout), a shown label keeps its place until it truly cannot (wider margins to leave than to arrive), and a
      // label changes between shown and hidden at most once per DWELL.
      const m = st.on ? EDGE_OUT : EDGE_IN;
      let vis = Number.isFinite(s.x) && s.x > -m && s.x < W + m && s.y > -m / 2 && s.y < H + m / 2;
      let spot = null, slot = null;
      let w = el.offsetWidth, h = el.offsetHeight;
      if (S) { // THE LOOK: this label's text size, its fade with distance, and whether the distance rules show it
        const L = el._lb ||= { px: NATIVE[e.kind], k: '' }, editing = el.classList.contains('editing');
        const d = Math.hypot(ax - geo.cx, ay - geo.cy, az - geo.cz);
        let span = 0; if (S.size.capPct < 101 && box) { const xs = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].map(([i, j]) => geo.sx(i * CELL, ay, j * CELL)); span = Math.max(...xs) - Math.min(...xs); }
        const t = textPx(S, { kind: e.kind, pxPerFt: geo.pxPerFt(ax, ay, az), perPx: L.px > 0 ? w / L.px : 0, spanPx: span });
        // (a small change waits until it adds up to 0.2 px, so a still camera never re-sizes a label back and forth; one
        // that the room cap needs smaller lands at once: the cap is never exceeded)
        let px = editing ? L.px : Math.round(t.px * 10) / 10; if (Math.abs(px - L.px) < 0.2 && !(t.why === 'cap' && px < L.px)) px = L.px;
        const fade = fadeAt(S, d), F = S.when.fadeFt, Y = S.when.roomsFt;
        // (each rule leaves later than it arrives: no blinking at its edge)
        if (S.size.hidePx > 0 && px < (st.on ? S.size.hidePx : S.size.hidePx * 1.1)) vis = false;
        if (F < NEVER_FT && d > (st.on ? 1.3 : 1.27) * F) vis = false;
        if (e.kind === 'room' && Y < NEVER_FT && d > (st.on ? 1.04 : 1) * Y) vis = false;
        Object.assign(L, { why: t.why, dist: Math.round(d * 10) / 10, fade: Math.round(fade * 100) / 100, span: Math.round(span), want: Math.round(t.px * 10) / 10 });
        const k = `${px}|${L.fade}`;
        if (!el.classList.contains('lb')) el.classList.add('lb');
        const put = (v) => { L.px = v; L.set = true; el.style.setProperty('--lb-f', v + 'px'); el.style.setProperty('--lb-k', v / NATIVE[e.kind]); };
        if (k !== L.k) {
          const was = L.px; L.k = k; el.style.setProperty('--lb-fade', fade);
          if (was !== px || !L.set) {
            put(px); w = el.offsetWidth; h = el.offsetHeight;
            // (text does not scale exactly with its size, small text least: measured over the cap, it shrinks once more
            // now, rather than on a next frame that a still table may never draw)
            const capW = S.size.capPct / 100 * span;
            if (t.why === 'cap' && w > capW && w > 0) { put(Math.floor(px * capW / w * 10) / 10); w = el.offsetWidth; h = el.offsetHeight; L.k = `${L.px}|${L.fade}`; }
          }
        }
      } else if (el._lb) { el._lb = null; el.classList.remove('lb'); for (const k of ['--lb-f', '--lb-k', '--lb-fade']) el.style.removeProperty(k); }
      if (vis) {
        const base = [s.x - w / 2, s.y - h / 2];
        const at = ([dx, dy]) => [base[0] + dx, base[1] + dy, base[0] + dx + w, base[1] + dy + h];
        // (the doubled labels crowd sooner: more places to step to before a label gives up and steps aside)
        const sy = C.stepY, sx = C.stepX;
        const slots = [[0, 0], [0, -(h + sy)], [0, h + sy], [-(w / 2 + sx), 0], [w / 2 + sx, 0], [-(w / 2 + sx), h + sy], [w / 2 + sx, h + sy], [-(w / 2 + sx), -(h + sy)], [w / 2 + sx, -(h + sy)], [0, 2 * (h + sy)], [0, -2 * (h + sy)], [-(w + sx), 0], [w + sx, 0]];
        // where it is now, first: it stays while its box does not actually touch a more important one
        // (and it does not step to another place twice within DWELL either: for that moment it may overlap a little)
        if (st.on && st.slot != null && slots[st.slot]) { const r = at(slots[st.slot]); if (now - st.movedAt < DWELL || !placed.some(p => touch(p, r))) { spot = r; slot = st.slot; } }
        if (!spot) for (let i = 0; i < slots.length; i++) { const r = at(slots[i]); if (placed.some(p => overlap(p, r))) continue; spot = r; slot = i; break; }
      }
      let on = !!spot || el.classList.contains('editing');
      if (on !== st.on && now - st.at < DWELL) on = st.on; // changed a moment ago: hold (a label held on stays where it was; one held off stays off)
      if (on !== st.on) { st.on = on; st.at = now; st.flips++; if (!on) st.slot = null; }
      if (on && spot) { if (slot !== st.slot) { if (st.slot != null && st.on) st.steps++; st.movedAt = now; } st.slot = slot; placed.push(spot); el.dataset.x = spot[0]; el.dataset.y = spot[1]; el.style.transform = `translate(${Math.round(spot[0])}px, ${Math.round(spot[1])}px)`; }
      else if (on && el.dataset.x) placed.push(rectOf(el)); // held on with nowhere to go: it keeps its box, and the others keep off it
      el.classList.toggle('on', on);
      // right over a pawn (from this camera): fade a little while the pawn is under it, rather than moving it
      if (on) { const r = [+el.dataset.x - C.pawn, +el.dataset.y - C.pawn, +el.dataset.x + w + C.pawn, +el.dataset.y + h + C.pawn]; el.classList.toggle('over', pawns.some(p => p.x > r[0] && p.x < r[2] && p.y > r[1] && p.y < r[3])); }
    }
  });
  return { name: 'labels' };
}
