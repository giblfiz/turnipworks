// The Build launcher and its tray (Harry 2026-10-03, revised 2026-10-04; docs/UI.md "Build menu").
//   launcher   a floating icon box, upper-left (the painted hammer and saw); B or a click pulls out the tray
//   tray       ONE panel that pulls out from the left, its left edge on the launcher's, as tall as it needs (up to the
//              full screen height). The levels above sit at the top as a stacked breadcrumb (click one to go back up
//              to it); the current level's options fill the rest as a two-column grid of big icon tiles, labels under,
//              scrolling. It opens where you left it, per campaign and seat, with that item's tool live.
//   tree       Genre → Type → Room. Furniture and objects come from the room type's LIBRARY area, which opens in
//              the PiP whenever a room type is picked (drag a thing out, or copy and paste it).
//   tools      Genre none · Type the building tool · Room the room tool (and its library). The pointer changes.
//   keys       every node has a letter, unique among its siblings. The collision rule:
//                a letter (no Shift)      picks that item in the CURRENT list; picking an item that has children
//                                         makes its children the current list, so letters chord downward
//                Shift + G / T / R        jumps to that LEVEL (Genres, Types, Rooms)
//                arrows                   move within the list (two columns)      Backspace   up one level
//                Enter / Esc              close the tray (the tool stays; a second Esc puts it away)
//              So B, Shift+T, c, t = Build, up to types, Castle, Throne room. Level jumps never collide with items.
import { icon } from '../icons.js';
import { LEVELS, LEVEL_LABEL, LEVEL_KEY } from '../taxonomy.js';

const COLS = 2;

export function buildSurface(R, app) {
  const X = app.taxonomy;
  const $ = (s) => document.querySelector(s);
  const launch = $('#launchers'), menu = $('#buildMenu');
  // sticky ("quiet modality", Harry 2026-10-03): Build reopens exactly where you left it, per campaign and seat
  const storeKey = () => `tw.build.${app.sync?.campaign?.id || '-'}.${app.me?.() || '-'}`;
  const S = app.build = {
    path: [], active: 0, isOpen: false, loadedFor: null,
    toggle: () => S.isOpen ? close() : open(),
    open: () => open(), close: () => close(),
    applyTool: (o) => applyTool(o),
    reset: () => { load(); S.path = [X.genres[0]]; S.active = 0; save(); },
    current: () => { load(); return S.path.slice(); },
    restore: (path) => { S.path = path.filter(id => X.get(id)); S.active = Math.max(0, S.path.length - 1); save(); },
    ownsKey: (k) => S.isOpen && listAt(S.active).some(n => n.hot === k), // (surfaces/tray.js: the launcher's own letter, when it is an item of the list)
    state: () => ({ open: S.isOpen, path: S.path.map(id => X.get(id).label), levels: S.path.map(id => X.get(id).level), active: LEVELS[S.active], tool: app.mode?.tool ? app.mode.kind : null, list: listAt(S.active).map(n => `${n.hot || '·'}:${n.label}`) }),
  };
  function load() {
    if (S.loadedFor === storeKey()) return;
    S.loadedFor = storeKey();
    let st = {}; try { st = JSON.parse(localStorage.getItem(S.loadedFor) || '{}'); } catch { }
    S.path = (st.path || []).filter(id => X.get(id));
    if (!S.path.length) S.path = [X.genres.find(id => X.get(id)?.key === app.sync?.campaign?.defaults?.genre) || X.genres[0]]; // Settings ▸ Global defaults ▸ Genre
  }

  // ---------- the launcher: the painted hammer and saw ----------
  launch.innerHTML = `<button class="launcher" data-l="build" title="Build (B)" aria-label="Build"><img class="lic" src="data/icons/tool-build.png?v=${window.TW_V || 'dev'}" alt="" width="40" height="40"><span class="lcap">Build</span><kbd>B</kbd></button>`;
  launch.querySelector('img.lic').onerror = (ev) => { ev.target.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon('hammer', 30) })); };
  launch.querySelector('[data-l="build"]').onclick = (ev) => { ev.stopPropagation(); S.toggle(); };

  // ---------- tree helpers ----------
  const listAt = (i) => i === 0 ? X.childrenOf(null) : X.childrenOf(S.path[i - 1]);
  const save = () => { try { localStorage.setItem(storeKey(), JSON.stringify({ path: S.path })); } catch { } };
  const nodeIcon = (n, size) => {
    const key = n.level === 'genre' ? `genre-${n.key}` : n.level === 'type' ? `type-${n.code}` : `room-${n.roomKey}`;
    const fb = n.level === 'genre' ? 'sparkles' : n.level === 'type' ? 'house' : 'square-dashed';
    return `<img class="nic" src="data/icons/${key}.png?v=${window.TW_V || 'dev'}" alt="" width="${size}" height="${size}" data-fb="${fb}" data-fbs="${Math.round(size * 0.6)}">`;
  };

  // ---------- open / close ----------
  function open() {
    load();
    S.isOpen = true;
    S.active = Math.max(0, S.path.length - 1);
    render();
    app.escapeStack.push(closeIfOpen);
    applyTool(); // sticky: the remembered item's tool is live again
    app.emit('build.open');
  }
  function close() { if (!S.isOpen) return false; S.isOpen = false; menu.hidden = true; app.emit('build.close'); app.refresh(); }
  // Escape and a click outside close it, unless it is PINNED (surfaces/tray.js: hold, tap, pin)
  function closeIfOpen() { if (!S.isOpen) return false; if (!app.tray.dismissable('build')) { queueMicrotask(() => S.isOpen && app.escapeStack.unshift(closeIfOpen)); return false; } close(); }
  app.tray.register('build', () => menu);

  // ---------- choosing ----------
  function pick(n, { descend = true } = {}) {
    if (!n) return;
    S.path = X.pathOf(n.id); save();
    S.active = n.children.length && !n.disabled && descend ? S.path.length : S.path.length - 1;
    applyTool();
    if (S.isOpen) render();
  }
  function goUp(i) { S.path = S.path.slice(0, i + 1); S.active = i; save(); applyTool(); render(); } // an ancestor in the header
  function jump(level) {
    const li = LEVELS.indexOf(level);
    if (S.path.length > li) S.path = S.path.slice(0, li + 1);
    else { const id = X.firstAt(S.path.at(-1), level); if (!id) { app.toast(`Nothing at the ${LEVEL_LABEL[level].toLowerCase()} level here yet`, true); return; } S.path = X.pathOf(id); }
    S.active = li; save(); applyTool(); if (S.isOpen) render();
  }
  // the tool of the node you stopped at; a room type also opens its library in the PiP
  function applyTool({ keepView = false } = {}) {
    const n = X.get(S.path.at(-1)); if (!n) return;
    if (n.level === 'genre') { if (app.mode?.tool) app.modes.cancel(); app.library.hide(); }
    else if (n.level === 'type') { if (n.disabled) { if (app.mode?.tool) app.modes.cancel(); app.toast(`${n.label}: ${n.note}`); } else app.modes.buildingTool(n); app.library.hide(); }
    else if (n.level === 'room') { app.modes.roomTool(n.roomKey, { tool: true }); app.library.show(n, null, null, { keep: keepView }); }
    app.emit('tool', app.mode);
  }

  // ---------- keys (a key layer of its own, ahead of the default one) ----------
  app.keyLayers = app.keyLayers || [];
  app.keyLayers.unshift((ev) => {
    if (!S.isOpen || ev.ctrlKey || ev.metaKey || ev.altKey || !app.tray.takesKeys('build')) return false; // (a pinned tray: letters only while the pointer is over it)
    const k = ev.key;
    if (k === 'Escape' || k === 'Enter') { if (!app.tray.dismissable('build')) return false; close(); return true; }
    if (k === 'Backspace') { if (S.active > 0) goUp(S.active - 1); return true; }
    if (k.startsWith('Arrow')) {
      const list = listAt(S.active), cur = list.findIndex(n => n.id === S.path[S.active]);
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -COLS, ArrowDown: COLS }[k];
      const next = list[Math.max(0, Math.min(list.length - 1, (cur < 0 ? 0 : cur + d)))];
      if (next) pick(next, { descend: false });
      return true;
    }
    if (ev.shiftKey && /^[A-Z]$/.test(k)) { const level = Object.keys(LEVEL_KEY).find(l => LEVEL_KEY[l] === k); if (level) jump(level); return true; }
    if (!ev.shiftKey && /^[a-z0-9]$/.test(k)) { const n = listAt(S.active).find(x => x.hot === k); if (n) pick(n); return true; }
    return false;
  });

  // ---------- render: one tray; levels above as a stacked breadcrumb, the current level as a two-column grid ----------
  function tile(n, sel) {
    return `<button class="btile${sel ? ' sel' : ''}${n.disabled ? ' off' : ''}" data-id="${n.id}" title="${esc(n.label)}${n.note ? ` · ${esc(n.note)}` : ''}">
      ${nodeIcon(n, 64)}<span class="bl">${esc(n.label)}</span>${n.hot ? `<kbd>${n.hot.toUpperCase()}</kbd>` : ''}${n.children.length && !n.disabled ? '<i class="more"></i>' : ''}${n.disabled ? `<em>${esc(n.note)}</em>` : ''}</button>`;
  }
  function render() {
    menu.hidden = false;
    const ancestors = S.path.slice(0, S.active).map(id => X.get(id));
    const list = listAt(S.active), sel = S.path[S.active], selNode = sel && X.get(sel), level = LEVELS[S.active];
    menu.innerHTML = `
      <div class="thead"><b>Build</b><button data-factions title="Browse faction pieces">Factions</button>${app.tray.pinButton('build')}</div>
      <div class="banc">${ancestors.map((n, i) => `<button class="bchip" data-anc="${i}" title="Back to ${LEVEL_LABEL[n.level].toLowerCase()} (⇧${LEVEL_KEY[n.level]})">${nodeIcon(n, 32)}<span><small>${LEVEL_LABEL[n.level]}</small>${esc(n.label)}</span><kbd>⇧${LEVEL_KEY[n.level]}</kbd></button>`).join('')}</div>
      <header class="blevel"><b>${LEVEL_LABEL[level]}</b><kbd>⇧${LEVEL_KEY[level]}</kbd></header>
      <div class="bgrid clip">${list.map(n => tile(n, n.id === sel)).join('')}</div>
      <footer>${stopHint(selNode || X.get(S.path[S.active - 1]))}<br><kbd>⇧G T R</kbd> levels · <kbd>⌫</kbd> up · <kbd>${app.tray.pinned('build') ? 'B' : 'Esc'}</kbd> close</footer>`;
    app.tray.wirePin(menu);
    menu.querySelector("[data-factions]").onclick = () => { close(); app.library.showFactions(); };
    // the tray: left edge on the launchers' row (its first box: Pawns since 2026-10-06, Build is second), from just below it down
    const lr = launch.querySelector('.launcher:not([hidden])').getBoundingClientRect();
    Object.assign(menu.style, { left: `${lr.left}px`, top: `${lr.bottom + 8}px`, maxHeight: `${innerHeight - lr.bottom - 16}px` });
    for (const im of menu.querySelectorAll('img.nic')) im.onerror = () => { const sp = document.createElement('span'); sp.className = 'nic fb'; sp.innerHTML = icon(im.dataset.fb, +im.dataset.fbs); im.replaceWith(sp); };
    menu.querySelector('.btile.sel')?.scrollIntoView({ block: 'nearest' });
    for (const b of menu.querySelectorAll('.btile')) b.onclick = (ev) => { ev.stopPropagation(); const n = X.get(b.dataset.id); if (n.disabled) { app.toast(`${n.label}: ${n.note}`); return; } pick(n); };
    for (const c of menu.querySelectorAll('.bchip')) c.onclick = (ev) => { ev.stopPropagation(); goUp(+c.dataset.anc); };
  }
  const stopHint = (n) => !n ? 'Pick one' : n.level === 'genre' ? 'Pick a type' : n.level === 'type' ? (n.disabled ? 'No room recipes yet' : 'Drag out a building, or pick a room') : 'Furniture and objects: drag them out of the library window';

  // outside clicks close the tray (the tool stays); the launcher shows the live tool
  addEventListener('pointerdown', (ev) => { if (S.isOpen && app.tray.dismissable('build') && !menu.contains(ev.target) && !launch.contains(ev.target)) close(); }, true);
  app.on((what, d) => { if (what === 'tray.pin' && d === 'build' && S.isOpen) render(); if ((what === 'pawns.open' || what === 'settings.open') && S.isOpen) close(); });
  app.on((what) => {
    if (what !== 'refresh' && what !== 'tool') return;
    const b = launch.querySelector('.launcher[data-l="build"]'), m = app.mode; // (by name: Build is no longer the first box)
    b.hidden = !(app.can('room') || app.can('object')); // players who can't build never see the Build launcher (Pawns and Settings stay)
    b.classList.toggle('live', !!m?.tool);
    // the library stays with its room tool (and while a thing is dragged out of it); it goes when the tool is put away
    if (app.library.shown() && !S.isOpen && !((m?.kind === 'room' && m.tool) || (m?.kind === 'place' && m.viaDrag))) app.library.hide();
  });
  return { name: 'build' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
