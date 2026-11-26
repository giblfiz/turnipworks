// THE CUT (storeys, Stage C; docs/VERTICAL.md "What you see: the cut height", docs/UI.md "The cut").
// The view is a CUT HEIGHT: you see everything whose BASE is at or below it and nothing above it. Nothing is ever
// sliced: a room shows whole or not at all, and its things go with it (world.js cutPass).
//
//   app.cut = { y: number | null, pinned: bool }     y = a ceiling height in feet (core ceilingOf); null = off (all levels)
//
// It is VIEW state: per client and per area, never sent, never on the relay. It is remembered per campaign, seat and
// area in this browser (localStorage `tw.cut.<campaign>.<seat>`), so the always-visible indicator is truthful after a
// reload instead of the view silently changing.
//
// ONE LEVEL (Harry 2026-10-06: "we should just build on whatever level the level is set to"). There is always a
// current level, app.level (a floor height; the ground when nothing was ever chosen): the level the meter marks, the
// level [ and ] move, and the level a room or building tool draws on. "All levels" is a separate switch: with it on
// (app.cut.y == null) everything shows, and the level you are on does not change.
//
// ONLY THESE change the view (the research's angriest complaint is a view that changes floor without being asked):
//   a double-click   on a spot in a room, or on a room's label: you go to that room's level (the cut at its ceiling);
//                    on open ground: all levels show (the level you are on stays).
//   level up / down  ] and [ (or } and { , which also work while a pawn is selected), or a click or drag on the
//                    meter: you go to that level and the view is cut to it. It stays until you change it.
//   all levels       \ , the meter's cap, "all levels" in the bar: a toggle between all levels and the level you are on
//   "Cut to lv N"    the conditional button offered when your pawn changes floor
//   roofs            the top of the meter (above the highest level), ] past the top of the meter, "roofs on" in
//                    the bar: roofs on, with all levels showing. (Until 2026-10-06 a conditional button offered this
//                    when zoomed all the way out. Harry: "Roofs on doesn't get a chat line, it doesn't even get a
//                    conditional." Zooming now offers nothing.)
// Every write goes through app.setCut, which records who asked (app.cutLog), so a test can prove nothing else did.
// There is no "pin" any more: every choice stays until the next one, so the word had nothing left to say.
import * as HT from '../../core/height.js';
import { icon } from '../icons.js';

const OFFER_MS = 6000;     // the "Cut to lv N" offer fades after this

export function cutSurface(R, app) {
  app.cut = { y: null, pinned: false };
  app.roofs = false;
  app.cutLog = []; // (tests) every write: { y, pinned, by, at }
  const world = () => app.area() && app.worlds.get(app.area());
  const ents = () => app.entities();
  const rooms = () => app.roomList(); // (kept per state: main.js app.derived)

  // ---------- remembered per campaign, seat and area ----------
  const key = () => `tw.cut.${app.sync.campaign?.id || '-'}.${app.me() || '-'}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch { return {}; } };
  const save = () => { try { const s = load(); s.areas = { ...(s.areas || {}), [app.area()]: { y: app.cut.y, level: app.level } }; s.roofs = app.roofs; localStorage.setItem(key(), JSON.stringify(s)); } catch { } };
  let loadedFor = null, restoring = false, shownLevel = null; // (shownLevel: the level the meter last showed, for its slide)
  function restore() { // when an area first shows (a reload, or going to another area): its own cut, as it was left
    const id = app.area(), k = `${key()}|${id}`;
    if (!id || !app.sync.campaign || !app.me() || loadedFor === k) return;
    loadedFor = k;
    const s = load(), c = s.areas?.[id];
    app.roofs = !!s.roofs;
    app.cut = { y: Number.isFinite(c?.y) ? c.y : null, pinned: false };
    // the level you are on: as it was left; a cut saved before 2026-10-06 has none, so it is the level that cut shows
    restoring = true; try { app.setLevel(Number.isFinite(c?.level) ? c.level : app.cut.y != null ? app.cut.y + HT.SLAB - HT.STOREY : 0); } finally { restoring = false; } shownLevel = app.level; app.focusToLevel(); // (a reload puts you back where you were: not a change to show)
    // a cut saved BELOW the level it was saved with is one counted from a hilltop building's own ground (before
    // 2026-10-26, when the cut became the map's): the same level, with the cut at its ceiling now
    if (app.cut.y != null && app.cut.y < app.level) app.cut = { y: levelCut(app.level), pinned: false };
    apply(); app.emit('cut', app.cut);
  }

  // ---------- the rule, for everything outside world.js ----------
  // is this thing hidden by the cut? THE CUT HIDES WHAT COVERS THE LEVEL YOU ARE ON (2026-10-26, core/height.js cutRooms):
  // a room above the cut is hidden unless its building stands clear on a hill; a room's things go with their room; a
  // hill and what stands on it show while the view is at or above the ground; pawns and loose things go by their BASE
  // (cutHidesBase); a building when none of its rooms show. world.js asks the same functions.
  // the level a pawn's base is on (world.js pawnLevel: the highest ground under its figure)
  const pawnLevel = (t) => world()?.pawnLevel?.(t) ?? HT.baseUnder(ents(), t.x, t.z, t.y || 0).y;
  app.pawnLevel = pawnLevel;
  app.cutHides = (e) => {
    const cut = app.cut.y; if (cut == null || !e) return false;
    const E = ents(), C = HT.cutRooms(E, cut), w = world();
    if (e.kind === 'room') return C.hidden.has(e.id); // (a hill is never hidden: it is the earth)
    if (e.kind === 'building') { const rs = rooms().filter(r => r.building === e.id); return rs.length > 0 && rs.every(r => C.hidden.has(r.id)); }
    if (e.kind === 'object' && e.room && E[e.room]) return HT.isTerrain(E[e.room].recipe) ? HT.cutHidesBase(E, { y: HT.roomY(E[e.room].recipe), room: e.room }, cut) : C.hidden.has(e.room);
    if (e.kind === 'token' || e.kind === 'object') { if (w?.cut === cut && w.cutHides) return w.cutHides(e); const b = HT.baseUnder(E, e.x, e.z, e.y || 0); return HT.cutHidesBase(E, b, cut, e.kind === 'object' ? e.y || 0 : b.y); } // by its BASE, not by how high its figure is (docs/PAWNS.md "A raised pawn")
    if (e.kind === 'roof') return !app.roofs || !E[e.room] || !(HT.visibleAt(HT.roomTop(E, E[e.room]), cut) || C.clear.has(e.room));
    if (e.kind === 'wall') { const rid = w?.shell?.get(e.key)?.roomId; return rid && E[rid] ? C.hidden.has(rid) : !HT.visibleAt(app.footprint.keyLevel?.(e.key) || 0, cut); }
    return false;
  };
  // nothing the cut hides can be selected, by any route (a click cannot reach it; this covers select-all, "children",
  // a paste's new things on a hidden level, another surface)
  const select0 = app.select;
  app.select = (ids, how = 'replace') => { if (app.cut.y != null) ids = [].concat(ids).filter(id => { const e = id && app.ent(id); return !e || !app.cutHides(e); }); return select0(ids, how); };
  // a room nobody can see into from above: wholly under a floor that is showing, or under the unopened ground
  app.roomCovered = (e) => { const w = world(); if (!w || e?.kind !== 'room') return false; w.cutSets(); return w.coveredRooms.has(e.id); };
  app.floorMax = () => app.cut.y ?? Infinity; // floor picks ignore floors above the cut (world.floorPoint `max`)

  // ---------- the one writer ----------
  function apply() {
    const w = world(); if (!w) return;
    w.setCut(app.cut.y); w.setRoofs?.(app.roofs);
    // what the cut hides cannot stay selected or hovered (you can only touch what you can see)
    const gone = [...app.sel].filter(id => { const e = app.ent(id); return e && app.cutHides(e); });
    if (gone.length) { for (const id of gone) app.sel.delete(id); app.emit('selection'); }
    if (app.hover && app.cutHides(app.ent(app.hover))) app.hover = null;
  }
  app.setCut = (y, { by = 'api' } = {}) => {
    y = y == null || !Number.isFinite(y) ? null : y;
    const pinned = false; // (kept in the record's shape; nothing pins any more)
    app.cutLog.push({ y, pinned, by, at: Date.now() }); if (app.cutLog.length > 200) app.cutLog.shift();
    if (y === app.cut.y && pinned === app.cut.pinned) return false;
    app.cut = { y, pinned };
    apply(); save();
    app.emit('cut', app.cut); app.refresh();
    return true;
  };
  // the ceiling a level is cut at: the underside of the slab above it, by the storey height of the building in focus.
  // The map's own height (2026-10-26: one numbering for the map, core/height.js levelAt): lv 2 is cut at 19 ft wherever
  // you look, on the open ground or on a hill.
  const levelCut = (y = app.level) => y + app.levelRange().step - HT.SLAB;
  // ALL LEVELS: the level you are on does not change (you still build there)
  app.cutOff = (by = 'api') => app.setCut(null, { by });
  // back from "all levels" to the level you are on; \ and the meter's cap toggle between the two
  app.cutOn = (by = 'api') => app.setCut(levelCut(), { by });
  app.toggleAll = (by = 'api') => app.cut.y == null ? app.cutOn(by) : app.cutOff(by);
  // GO TO A LEVEL: it becomes the level you are on (and build on), and the view is cut to it
  app.goLevel = (y, by = 'api') => {
    const R = app.levelRange(); y = Math.max(R.loY, Math.min(R.hiY, y));
    const a = app.setLevel(y), b = app.setCut(y + R.step - HT.SLAB, { by });
    if (a && !b) save();
    return a || b;
  };
  // into a room: its ceiling (so you see into it and nothing above it; a tall room's own ceiling); its floor is the level
  app.cutToRoom = (room, by = 'api') => {
    if (!room?.recipe) return false;
    app.lastBuilding = room.building || app.lastBuilding;
    const a = app.setLevel(HT.roomY(room.recipe)), b = app.setCut(HT.ceilingOf(ents(), room), { by });
    if (a && !b) save();
    if (by === 'label') { const [x, z] = app.footprint.labelPoint(room.recipe); app.centreOn?.({ x, y: HT.roomY(room.recipe), z }); } // a double-click on its label centres on the room (a spot in the room: input.js)
    return b;
  };
  // to a pawn's level: the room it is in, else the 10-ft band of open air it is at
  app.cutToPawn = (t, by = 'api') => { const E = ents(), f = t && HT.tokenFloor(E, t); if (!f) return false; if (f.room && E[f.room]) return app.cutToRoom(E[f.room], by); app.setLevel(floorKey(t)); return app.setCut(floorKey(t) + HT.STOREY - HT.SLAB, { by }); };
  // ROOFS ON from the meter or the keys: all levels show (a roof is above every level); ROOFS OFF puts the view back
  // on the level you are on if it was cut to it before
  let cutBeforeRoofs = false;
  app.roofsOn = (by = 'api') => { cutBeforeRoofs = app.cut.y != null; app.setRoofs(true, by); app.cutOff(by); return true; };
  app.roofsOff = (by = 'api') => { app.setRoofs(false, by); if (cutBeforeRoofs && app.cut.y == null) app.cutOn(by); cutBeforeRoofs = false; return true; };
  // the roofs' SURFACE: 'sections' (modelled roof sections, the default) or 'painted' (the flat generated texture they
  // replaced, kept for comparing: Harry 2026-10-11). Per page, not saved; ?roofsurface=painted opens with it.
  app.roofSurface = (mode) => { const W = world()?.constructor; if (!W) return null; if (mode && mode !== W.ROOF_SURFACE) { for (const w of app.worlds.values()) w.setRoofSurface?.(mode); app.emit('roofs', app.roofs); app.refresh(); } return W.ROOF_SURFACE; };
  app.setRoofs = (on, by = 'api') => { on = !!on; if (on === app.roofs) return false; app.roofs = on; save(); world()?.setRoofs?.(on); app.emit('roofs', on); app.refresh(); return true; };

  // ---------- levels ----------
  // the levels of the building in focus that have rooms (or of the whole area when there is no building), lowest
  // first: [{ y: floor height, cut: ceiling height, label }]. Worked out from what THIS seat has been sent, so a
  // storey a player cannot see is not in the list.
  app.cutLevels = () => {
    const bid = app.focusBuilding(), out = new Map();
    for (const r of rooms()) { if (bid && r.building !== bid) continue; const y = HT.roomY(r.recipe); if (!out.has(y)) out.set(y, { y, cut: y + HT.STOREY - HT.SLAB, label: HT.levelLabel(HT.levelAt(y)) }); }
    return [...out.values()].sort((a, c) => a.y - c.y);
  };
  // what the meter says
  app.cutInfo = () => {
    const E = ents(), cut = app.cut.y, bid = app.focusBuilding(), b = bid ? E[bid] : null, lv = HT.levelLabel(HT.levelAt(app.level));
    if (cut == null) return { on: false, text: 'All levels', label: null, building: null, pinned: false, y: null, roofs: app.roofs, level: app.level, levelLabel: lv };
    const hidden = HT.cutRooms(E, cut).hidden.size, label = HT.levelLabel(HT.levelAt(cut));
    const pawnsAbove = Object.values(E).filter(t => t.kind === 'token' && app.cutHides(t)).length; // a pawn above the cut is not drawn: say so here
    return { on: true, y: cut, label, building: b?.name || null, pinned: false, hidden, pawnsAbove, text: `${label}${b?.name ? ` · ${b.name}` : ''}`, roofs: app.roofs, level: app.level, levelLabel: lv };
  };
  // the meter's notches, highest first: every storey in range of the building in focus (5 up and 6 down by default,
  // more where the area has more), which of them have rooms, which is the level you are on, which are showing
  app.meter = () => {
    const R = app.levelRange(), cut = app.cut.y, counts = new Map();
    for (const r of rooms()) { if (HT.isTerrain(r.recipe)) continue; const s = HT.levelAt(HT.roomY(r.recipe)); counts.set(s, (counts.get(s) || 0) + 1); }
    const cur = HT.levelAt(app.level), levels = [];
    for (let s = R.hi; s >= R.lo; s--) { const y = s * R.step; levels.push({ y, storey: s, label: HT.levelLabel(s), rooms: counts.get(s) || 0, ground: s === 0, current: s === cur, shown: HT.visibleAt(y, cut) }); }
    return { all: cut == null, level: app.level, label: HT.levelLabel(cur), levels };
  };
  // LEVEL UP / LEVEL DOWN: one storey of the building in focus, onto a level whether or not anything is built there
  app.floorStep = (dir, by = 'step') => {
    const R = app.levelRange(), n = app.level + (dir > 0 ? 1 : -1) * R.step;
    // THE ROOFS POSITION is above the highest level of the meter: ] past the top shows the roofs; [ from there hides them
    if (dir < 0 && app.roofs) { app.roofsOff(by); app.toast('Roofs off'); return true; }
    if (dir > 0 && n > R.hiY && !app.roofs) { app.roofsOn(by); app.toast('Roofs on'); return true; }
    if (n > R.hiY || n < R.loY) { app.toast(`${app.levelInfo().label} is the ${dir > 0 ? 'top' : 'bottom'} of the meter`, true); return false; }
    app.goLevel(n, by);
    const I = app.levelInfo(); app.toast(`${I.label}${I.exists ? '' : ' · nothing built here yet'}`);
    return true;
  };
  app.floorUp = (by) => app.floorStep(1, by); app.floorDown = (by) => app.floorStep(-1, by);

  // ---------- THE LEVEL METER: always on screen, the whole left edge (Harry 2026-10-06) ----------
  // "Let's start by making the level-cut into a vertical meter on the left. It should be tiny, and the entire height
  // of the screen, with little notches for level pre-set. Assume like 5 stories up and 6 stories down."
  // A thin rail with a notch per storey, highest at the top. The level you are on wears the marker (its number is
  // always readable); storeys with rooms have a heavier notch; storeys the cut hides are dimmed; the cap at the top
  // is "all levels". Click or drag on the rail to go to a level. It widens under the pointer to show the labels.
  const el = document.getElementById('levelMeter');
  el.innerHTML = `<button class="lm-roof" tabindex="-1" aria-label="Roofs">${icon('house', 13)}<b>Roofs</b></button><button class="lm-all" tabindex="-1" aria-label="All levels">${icon('layers', 13)}<b>All levels</b><kbd>\\</kbd></button><div class="lm-rail"></div>`;
  const capEl = el.querySelector('.lm-all'), roofEl = el.querySelector('.lm-roof'), rail = el.querySelector('.lm-rail');
  // the roofs position: the very top of the meter, above the highest level (Harry 2026-10-06: "a quiet, permanent home")
  roofEl.addEventListener('mousedown', (ev) => ev.preventDefault()); roofEl.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  roofEl.addEventListener('click', (ev) => { ev.stopPropagation(); if (app.roofs) app.roofsOff('meter'); else app.roofsOn('meter'); });
  capEl.addEventListener('mousedown', (ev) => ev.preventDefault()); capEl.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  capEl.addEventListener('click', (ev) => { ev.stopPropagation(); app.toggleAll('meter'); });
  for (const t of ['dblclick', 'wheel', 'contextmenu']) el.addEventListener(t, (ev) => ev.stopPropagation());
  el.addEventListener('mousedown', (ev) => ev.preventDefault()); // never takes the keyboard focus
  // click or drag: the notch under the pointer
  const notchAt = (clientY) => { let best = null, bd = Infinity; for (const n of rail.children) { const r = n.getBoundingClientRect(), d = Math.abs((r.top + r.bottom) / 2 - clientY); if (d < bd) { bd = d; best = n; } } return best; };
  const scrubTo = (ev) => { const n = notchAt(ev.clientY); if (!n) return; const y = +n.dataset.y; if (y !== app.level || app.cut.y == null) app.goLevel(y, 'meter'); };
  rail.addEventListener('pointerdown', (ev) => { if (ev.button !== 0) return; ev.preventDefault(); ev.stopPropagation(); try { rail.setPointerCapture(ev.pointerId); } catch { } el.classList.add('scrub'); scrubTo(ev); });
  rail.addEventListener('pointermove', (ev) => { if (el.classList.contains('scrub')) scrubTo(ev); });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) rail.addEventListener(t, () => el.classList.remove('scrub'));
  // SOMEONE PINGED A LEVEL I AM NOT SHOWING (main.js showPing): a small mark in their colour beside that storey's
  // notch, pulsing for a moment. The view does not move; the mark says where to look.
  app.meterPings = []; // (tests)
  app.meterPing = (y, color, name) => {
    const R = app.levelRange(), s = HT.levelAt(y, R.step);
    const yy = Math.max(R.loY, Math.min(R.hiY, s * R.step)), n = [...rail.children].find(c => +c.dataset.y === yy); if (!n) return false;
    const q = n.getBoundingClientRect(), m = el.getBoundingClientRect(), d = document.createElement('i');
    d.className = 'lm-ping'; d.style.top = `${(q.top + q.bottom) / 2 - m.top}px`; d.style.background = color || 'var(--accent)'; d.title = `${name || 'Someone'} pinged ${HT.levelLabel(s)}`;
    el.append(d); setTimeout(() => d.remove(), 2400);
    app.meterPings.push({ y: yy, storey: s, color, at: performance.now() }); if (app.meterPings.length > 20) app.meterPings.shift();
    return true;
  };
  let shownKey = '', dirty = true, paintedAt = 0;
  const num = (s) => String(s >= 0 ? s + 1 : s);
  function paint(now = performance.now()) {
    if (!dirty && now - paintedAt < 250) return; dirty = false; paintedAt = now;
    const M = app.meter(), I = app.cutInfo(), k = JSON.stringify([M, I]);
    if (k === shownKey) return; shownKey = k;
    el.classList.toggle('on', I.on); el.classList.toggle('all', !I.on);
    el.classList.toggle('flat', !I.on && !I.roofs && M.levels.filter(l => l.rooms).length <= 1 && !!M.levels.find(l => l.current)?.ground); // (one storey, all showing: a phone hides the meter, style.css "ON A PHONE")
    // ONLY THE GROUND (2026-11-12, levels are advanced; Harry: "making everything default to layer one until people need
    // to actively request to go multi-layer"): nothing is built off the ground and you are on it, so the meter folds up to
    // its Roofs button (style.css "#levelMeter.single"). It opens again by itself the moment a second level is in use or
    // you go to another level (] [ , the bar, an offer), and each level change opens it for a moment (showLevelChange).
    el.classList.toggle('single', M.levels.every(l => !l.rooms || l.ground) && !!M.levels.find(l => l.current)?.ground);
    const status = I.on ? `Showing ${I.text}${I.hidden ? ` · ${I.hidden} room${I.hidden === 1 ? '' : 's'} above hidden` : ''}${I.pawnsAbove ? ` · ${I.pawnsAbove} pawn${I.pawnsAbove === 1 ? '' : 's'} above` : ''}` : (I.roofs ? `All levels · roofs on · on ${I.levelLabel}` : `All levels · on ${I.levelLabel}`);
    el.dataset.status = status; el.setAttribute('aria-label', `Levels. ${status}`);
    capEl.classList.toggle('on', !I.on);
    roofEl.classList.toggle('on', !!I.roofs); roofEl.classList.toggle('hid', !!I.roofs && I.on); // on, but the cut is below them
    roofEl.title = I.roofs ? (I.on ? 'Roofs are on, hidden while the view is cut to a level. Click for roofs off' : 'Roofs are on. Click (or [ ) for roofs off') : 'Roofs: click to put the roofs on (all levels show). Also ] past the top of the meter';
    capEl.title = I.on ? `${status}. Show all levels ( \\ )` : `Every level is showing; you are on ${I.levelLabel} and build there. Click for ${I.levelLabel} only ( \\ )`;
    rail.innerHTML = M.levels.map(l => `<div class="lm-n${l.rooms ? ' rooms' : ''}${l.ground ? ' ground' : ''}${l.current ? ' cur' : ''}${l.shown ? '' : ' hid'}" data-y="${l.y}" title="${l.label}${l.ground ? ' (ground)' : ''} · ${l.y} ft${l.rooms ? ` · ${l.rooms} room${l.rooms === 1 ? '' : 's'}` : ' · nothing built'}${l.shown ? '' : ' · hidden'}${l.current ? ' · you are here' : ' · click to go here'}"><i></i>${l.current ? `<em>${num(l.storey)}</em>` : ''}<b>${l.label}${l.ground ? ' · ground' : ''}${l.rooms ? ` · ${l.rooms}` : ''}</b></div>`).join('');
  }
  app.cutBar = () => { const r = el.getBoundingClientRect(), c = rail.querySelector('.cur em')?.getBoundingClientRect(); return { ...app.cutInfo(), single: el.classList.contains('single'), flash: el.classList.contains('lm-flash'), railShown: rail.offsetHeight > 0, shown: !el.hidden && el.offsetWidth > 0 && el.offsetHeight > 0, textShown: el.dataset.status || '', rect: [r.left, r.top, r.right, r.bottom], marker: c ? { text: rail.querySelector('.cur em').textContent, rect: [c.left, c.top, c.right, c.bottom] } : null, notches: [...rail.children].map(n => { const q = n.getBoundingClientRect(); return { y: +n.dataset.y, cls: n.className, at: [(q.left + q.right) / 2, (q.top + q.bottom) / 2] }; }), cap: (() => { const q = capEl.getBoundingClientRect(); return { on: capEl.classList.contains('on'), at: [(q.left + q.right) / 2, (q.top + q.bottom) / 2] }; })(), roof: (() => { const q = roofEl.getBoundingClientRect(); return { on: roofEl.classList.contains('on'), hid: roofEl.classList.contains('hid'), at: [(q.left + q.right) / 2, (q.top + q.bottom) / 2] }; })() }; };

  // ---------- A LEVEL CHANGE, SHOWN: THE VIEW MOVES, THE METER MOVES WITH IT, AND SAYS WHERE (2026-11-12) ----------
  // Harry: "when we change layers ... we want to do a little animation where it opens the levels menu/meter and actually
  // shows it getting moved", then, on dev, of "Take it underground": "it just looked like it 'jumped' down ... animation
  // would indicate a number of interim frames ... like at least 0.5 sec worth".
  // Every change of the level you are on (an offer, a stair, ] [ , the meter, the bar, the storey tour; never a reload
  // putting you back) plays ONE timeline of VIEW_MS:
  //   the view   the camera's focus height glides from the old level's floor to the new one (the view itself goes up or
  //              down a storey; the focus height then stays on the level you are on: a cellar is looked at from 10 ft
  //              lower, as the ground is from 0)
  //   the meter  opens as a hover would and a copy of the marker slides old notch -> new on the same curve
  //   a readout  "Ground → Level −1", small, beside the meter, fading in and out with it
  // The cut itself is not stepped: a room shows whole or not at all (docs/VERTICAL.md), and what it hides or shows flies
  // off or lands (cutfly.js) as it always did, from the first frame.
  // THE CLOCK COUNTS FRAMES DRAWN, not the wall: each frame adds at most STEP_MS, so a long frame (a building made again, a
  // cave's rock rebuilt at its new depth) pauses the move instead of eating it; there are always interim frames. Nothing
  // waits on it; a second change in flight starts from where the view and the marker are. Reduced motion: the view and
  // the marker are simply on the new level (the readout still says where you went, without moving).
  const VIEW_MS = 800, HOLD_MS = 500, STEP_MS = 34; // (2026-11-13, Harry on dev: "a bit too fast": 600/300 -> 800/500; the shipped 11-12 slide was 420 of 900)
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
  const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const levelName = (y) => { const s = HT.levelAt(y); return s === 0 ? 'Ground' : `Level ${s > 0 ? s + 1 : '\u2212' + -s}`; };
  app.levelAnims = []; // (tests) { from, to, at, reduced, slid, flashed, railShown, endAt, frames }
  let wantAnim = null, ghost = null, anim = null;
  // THE DEMONSTRATING HAND (Harry 2026-11-12: "a big cursor ... grabs the level marker and drags it"): the client's own
  // pointer and closed-hand icons (icons.js mouse-pointer-2, grab: a blind read took the open hand for pointing, 11-13) at twice a pointer's size. It takes hold of the marker as the
  // move starts (the pointer becomes the hand, pressed), drags it with the marker, lets go (the pointer again) and fades.
  const hand = document.createElement('div'); hand.id = 'levelCursor'; hand.setAttribute('aria-hidden', 'true'); hand.hidden = true;
  hand.innerHTML = `<span class="lc-pointer">${icon('mouse-pointer-2', 40)}</span><span class="lc-hand">${icon('grab', 40)}</span>`; document.body.append(hand);
  const readout = document.createElement('div'); readout.id = 'levelReadout'; readout.setAttribute('aria-live', 'polite'); readout.hidden = true; document.body.append(readout);
  const notchCentre = (y) => { let best = null, bd = Infinity; for (const n of rail.children) { const d = Math.abs(+n.dataset.y - y); if (d < bd) { bd = d; best = n; } } if (!best) return null; const q = best.getBoundingClientRect(); return (q.top + q.bottom) / 2 - el.getBoundingClientRect().top; };
  const grab = () => (app.fpv?.active?.() ? null : app.main?.grab) || null;
  app.focusToLevel = () => { const g = grab(); if (g && g.focus.y !== app.level) { g.focus.y = app.level; g.update?.(); } }; // (no motion: a reload, another area)
  function runLevelAnim({ from, to }) {
    const red = reducedMotion(), g = grab(), rec = { from, to, at: performance.now(), reduced: red, slid: false, endAt: null, frames: 0 };
    app.levelAnims.push(rec); if (app.levelAnims.length > 40) app.levelAnims.shift();
    const top0 = ghost ? parseFloat(ghost.style.top) : notchCentre(from), top1 = notchCentre(to); // a move in flight: the next starts where its marker is now
    const y0 = g ? (g.focus.y ?? from) : from;
    el.classList.add('lm-flash'); rec.flashed = true; rec.railShown = rail.offsetHeight > 0; // (the meter is open now, whatever it was)
    readout.textContent = `${levelName(from)} \u2192 ${levelName(to)}`; readout.hidden = false; readout.className = 'show';
    if (top1 != null) readout.style.top = `${el.getBoundingClientRect().top + top1}px`;
    if (red) { ghost?.remove(); ghost = null; el.classList.remove('lm-travel'); if (g) { g.focus.y = to; g.update?.(); } }
    else {
      if (!ghost && top0 != null && top1 != null && Math.abs(top0 - top1) > 1) { ghost = document.createElement('em'); ghost.className = 'lm-ghost'; ghost.setAttribute('aria-hidden', 'true'); el.append(ghost); }
      if (ghost) { ghost.textContent = num(HT.levelAt(to)); ghost.style.top = `${top0}px`; el.classList.add('lm-travel'); rec.slid = true; }
      if (ghost) { hand.hidden = false; hand.className = 'grab'; rec.hand = true; }
    }
    if (red || !ghost) { hand.hidden = true; hand.className = ''; }
    anim = { rec, t: 0, red, y0, y1: to, top0, top1, g };
  }
  function stepLevelAnim(dt) {
    const A = anim; if (!A) return;
    A.t += Math.min(dt * 1000, STEP_MS); A.rec.frames++;
    const k = A.red ? 1 : Math.min(1, A.t / VIEW_MS), e = ease(k);
    const g = grab(); if (g && !A.red) { g.focus.y = A.y0 + (A.y1 - A.y0) * e; g.update?.(); }
    if (ghost && A.top0 != null && A.top1 != null) {
      const top = A.top0 + (A.top1 - A.top0) * e; ghost.style.top = `${top}px`;
      const m = el.getBoundingClientRect(); hand.style.transform = `translate(${Math.round(m.left + 8)}px, ${Math.round(m.top + top - 6)}px)`; // (its tip on the marker)
    }
    if (k >= 1 && ghost) { ghost.remove(); ghost = null; el.classList.remove('lm-travel'); hand.className = 'release'; } // let go: the pointer again, fading
    if (!hand.hidden && hand.className === 'release') hand.style.opacity = String(Math.max(0, 1 - (A.t - VIEW_MS) / HOLD_MS));
    else if (!hand.hidden) hand.style.opacity = '1';
    readout.style.opacity = String(A.t < 120 ? A.t / 120 : A.t > VIEW_MS + HOLD_MS - 200 ? Math.max(0, (VIEW_MS + HOLD_MS - A.t) / 200) : 1);
    if (A.t >= VIEW_MS + HOLD_MS) { anim = null; el.classList.remove('lm-flash', 'lm-travel'); readout.hidden = true; hand.hidden = true; hand.className = ''; A.rec.endAt = performance.now(); dirty = true; }
  }
  app.levelFocusY = () => anim ? anim.y1 : wantAnim ? wantAnim.to : (grab()?.focus.y ?? 0); // where the focus height is going: a change asked for this frame (not yet started) or in flight (main.js centreOn)
  app.levelAnimating = () => el.classList.contains('lm-flash'); // (tests)
  app.viewAnim = () => anim ? { t: anim.t, y0: anim.y0, y1: anim.y1, focusY: grab()?.focus.y ?? null, hand: hand.hidden ? null : hand.className, handAt: hand.hidden ? null : (() => { const q = hand.getBoundingClientRect(); return [q.left, q.top, q.width]; })() } : null; // (tests)

  // ---------- the conditional button "Cut to lv N" (surfaces/condbutton.js; its one fixed slot) ----------
  const cb = () => app.condButtons;
  // a pawn's floor, as a height: the floor of the room it is in, else the level its BASE is on (the ground under a
  // flyer outdoors, the roof it is over: raising a pawn into the open air changes no floor and offers nothing)
  // (2026-10-24) up on a hill is still the ground, and so is a building's ground storey on a hill (it meets the ground
  // there: core/height.js meetsGround, per room since 2026-10-26): no floor changed, nothing offered. Its storeys above
  // are the map's own heights. Halfway up a stair it is still on the floor it climbed from (the room it is in).
  const floorKey = (t) => { const E = ents(), f = HT.tokenFloor(E, t); if (f.room && HT.isTerrain(E[f.room]?.recipe)) return 0; if (f.floorY != null) return HT.meetsGround(E, E[f.room]) ? 0 : f.floorY; return HT.levelFloor(pawnLevel(t)); };
  const floors = new Map(); // token id -> floor height (as last seen in this area)
  let floorsArea = null, lastMine = { id: null, at: 0 }, pending = new Map(); // GM: a floor change waiting to know who moved it
  // The offer's CHAT LINE (Harry 2026-10-06; condbutton.js rule 6, chat.js "action lines"): unpressed, the offer goes
  // down into the chat as "Mira went to lv 2 · [Cut to lv 2]". Going to a level is always possible, so the line stays
  // good (also after a reload); several pawns going to the same level are one line.
  const cutLineRun = (d) => { const r = d.room && ents()[d.room]; if (r) app.cutToRoom(r, 'chat'); else { app.setLevel(d.cut + HT.SLAB - HT.STOREY); app.setCut(d.cut, { by: 'chat' }); } };
  app.actionLines?.kind('cut', { restorable: true, valid: (d) => d.area && d.area !== app.area() ? 'in another area' : null, run: cutLineRun });
  function offer(t) {
    if (app.fpv?.active?.()) return; // (in first person the cut is off and the eyes are on the pawn: nothing to offer, surfaces/fpv.js)
    const E = ents(), f = HT.tokenFloor(E, t), room = f.room && E[f.room];
    const target = room ? HT.ceilingOf(E, room) : floorKey(t) + HT.STOREY - HT.SLAB;
    const label = room ? f.level : HT.levelLabel(HT.levelAt(floorKey(t)));
    if (target === app.cut.y) { cb()?.hide('cut-offer'); return; } // already looking at that level
    cb()?.show('cut-offer', { cls: 'cutoffer', icon: 'layers', text: `Cut to ${label}`, dock: 'bottom', life: OFFER_MS, area: app.area(), doneText: `Showing ${label}`, data: { token: t.id, cut: target, label },
      line: { kind: 'cut', text: `${t.name || 'A pawn'} went to ${label}`, many: (n) => `${n} pawns went to ${label}`, button: `Cut to ${label}`, group: `cut|${target}`, data: { area: app.area(), room: room?.id || null, cut: target, label } },
      run: () => { if (room && ents()[room.id]) app.cutToRoom(ents()[room.id], 'offer'); else { app.setLevel(target + HT.SLAB - HT.STOREY); app.setCut(target, { by: 'offer' }); } } });
  }
  function watchPawns() {
    const area = app.area(), E = ents();
    if (area !== floorsArea) { floorsArea = area; floors.clear(); pending.clear(); for (const t of Object.values(E)) if (t.kind === 'token') floors.set(t.id, floorKey(t)); return; }
    for (const t of Object.values(E)) {
      if (t.kind !== 'token') continue;
      const k = floorKey(t), was = floors.get(t.id); floors.set(t.id, k);
      if (was === undefined || was === k) continue;
      if (app.gm()) { // the GM: only for the last pawn the GM moved
        if (lastMine.id === t.id && Date.now() - lastMine.at < 4000) offer(t); else pending.set(t.id, Date.now());
      } else if (t.owner === app.me()) offer(t); // a player: only YOUR pawn, whoever moved it
    }
    for (const id of [...floors.keys()]) if (!E[id]) floors.delete(id);
  }
  const movedTokens = (e) => e.type === 'token.move' ? [e.args?.id] : e.type === 'batch' ? (e.args?.ops || []).filter(o => o.type === 'token.move').map(o => o.args.id) : [];
  function onEntry(e) {
    if (!e || e.area !== app.area() || e.by !== app.me()) return;
    const ids = movedTokens(e).filter(Boolean); if (!ids.length) return;
    lastMine = { id: ids[ids.length - 1], at: Date.now() };
    if (app.gm() && pending.has(lastMine.id) && Date.now() - pending.get(lastMine.id) < 4000) { const t = ents()[lastMine.id]; if (t) offer(t); }
    pending.clear();
  }

  app.on((what, d) => {
    if (what === 'frame') { restore(); paint(); if (wantAnim) { const a = wantAnim; wantAnim = null; dirty = true; paint(); runLevelAnim(a); } stepLevelAnim(d || 0); return; }
    if (what === 'cut' || what === 'level' || what === 'selection' || what === 'roofs') dirty = true;
    if (what === 'level') { save(); const was = shownLevel; shownLevel = app.level; if (was != null && was !== app.level && !restoring && loadedFor) wantAnim = { from: wantAnim?.from ?? was, to: app.level }; }
    if (what === 'change' && d === app.area()) { dirty = true; world()?.setCut(app.cut.y); world()?.setRoofs?.(app.roofs); watchPawns(); return; }
    if (what === 'entry') return onEntry(d);
    if (what === 'refresh') { if (world() && (world().cut !== app.cut.y || !!world().roofsOn !== !!app.roofs)) apply(); }
  });
  return { name: 'cut' };
}
