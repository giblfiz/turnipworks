import { openGames } from '../games.js';
// Settings (Harry 2026-10-04; docs/UI.md "Settings"): the one exception to the tray pattern, an industry-standard
// MODAL window with a category list on the left. The Settings launcher (a painted gear, the last of Pawns, Build, Settings) opens it.
//   1 World navigation   everyone: the areas you can reach (open here / in the PiP); the GM creates, renames, deletes.
//                        The section Settings always opens on (S or the launcher). Never shown by itself on arrival.
//   2 Me                 everyone: name and seat colour, controls, graphics, UI size, announcements, cursors, motion,
//                        sound (stored, inert), my agents, my requests (players), reset to defaults
//   3 Area               GM, the area in the main view: open to players or hidden, play settings (each "using default"
//                        or "overridden here", with a reset)
//   4 Global defaults    GM: the same play settings for every area, plus units, genre, house look, rolls
//   5 Campaign admin     GM: snapshots, export / import, invites and seats, agent keys, player requests
//   6 Feedback           everyone: a ticket (bug, idea, asset comment, question, other) with its context, and My tickets.
//                        The form is surfaces/feedback.js, loaded the first time the section opens (Harry 2026-10-19)
// Everything that has a system behind it goes through the real commands (core/commands.js: seat.set, area.create /
// area.set / area.delete / area.visibility, campaign.set, seat.create / seat.revoke, request.create / .resolve,
// entities.set) and permissions (core/perms.js); what has no system yet is stored and says "coming".
// Personal preferences live in this browser (localStorage 'tw.prefs'); the seat's name and colour live on the relay.
import { icon } from '../icons.js';
import { T } from '../tuner.js';
import { newId } from '../../core/ids.js';
import { DARKVISION_DEFAULT, DARKVISION_MAX, CARRIED_LIGHT_MAX } from '../../core/darkness.js';
import { setRingScale } from './ring.js';
import { figTree } from './figtree.js';
import { pawnLabel } from '../pawns.js';
import { LIB_EVEN } from '../library.js';
import { noGlow } from '../world.js';
import { GFX_DEFAULTS, GFX_PRESETS, GFX_KEYS, GFX_LABEL, GFX_ORDER, presetOf, IDLE_AFTER_MS } from '../graphics.js';

const PREFS_KEY = 'tw.prefs';
export const PREF_DEFAULTS = {
  zoomSpeed: 1, rotateSpeed: 1, invertZoom: false, invertRotate: false, wheel: 'auto',
  pawnSnap: 'shift', // 'shift' = a dragged pawn moves freely and Shift snaps it to the squares; 'always' = it snaps and Shift frees it (the rule before 2026-10-11)
  graphics: 'high', post: true, // graphics: the geometry detail tier; post: the whole lighting stack
  ...GFX_DEFAULTS, // Me ▸ Graphics (graphics.js): gfx = the preset (auto / low / medium / high / custom) and the switches it sets, fogFx among them (the drifting fog and haze: decoration, NOT fog of war), the idle rate and the frame-rate limit
  ringScale: 1, textScale: 1,
  announce: true, announceSpeed: 1, dice3d: true, // dice3d: real 3D dice tumble on the table (surfaces/dice.js); off = the chat line only
  cursors: true, reducedMotion: false, cutFly: true, lightMoves: true,
  libEven: LIB_EVEN, // the Build library draws every thing the same size (a trial, Harry 2026-10-11; off = true relative sizes)
  music: true, musicVol: 0.7, sfx: true, sfxVol: 0.8,
};
const GRAPHICS = { low: { faces: '1500', label: 'Low (1,500 faces)' }, medium: { faces: '5000', label: 'Medium (5,000)' }, high: { faces: '10000', label: 'High (10,000)' } }; // geometry detail (its own row: not part of a Graphics preset, a change re-fetches every mesh)
export function loadPrefs() {
  try {
    const had = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'), p = { ...PREF_DEFAULTS, ...had };
    if (!('gfx' in had) && presetOf(p) !== 'high') p.gfx = 'custom'; // prefs from before the Graphics presets with a switch already off (Fog and mist): theirs, not Auto's
    return p;
  } catch { return { ...PREF_DEFAULTS }; }
}
// (main.js, at boot) the geometry tier the graphics preset asks for, unless the URL says otherwise
export const prefFaces = () => GRAPHICS[loadPrefs().graphics]?.faces || null;

const RULES = [ // [key, label, kind, options, note]
  ['light', 'Lighting', 'select', [['house', 'House look'], ['day', 'Day'], ['night', 'Night'], ['deep-night', 'Deep night'], ['daylight', 'Flat daylight']]],
  ['grid', 'Grid', 'toggle'],
  ['freeMoves', 'Players move their own pawns', 'toggle'],
  ['touch', 'Players may touch', 'select', [['open', 'Doors, chests and lights'], ['none', 'Nothing']]],
  ['fogOfWar', 'Fog of war', 'toggle', null, 'players see through their pawns here; explored memory is kept while it is off. Global defaults ▸ Vision sets the campaign default'],
  ['darkness', 'Darkness', 'toggle', null, 'with fog of war on: players see only within their pawns\' darkvision (Me ▸ My pawns, 30 ft unless set) and where lit lights shine; the last few feet of each are remembered, not seen'],
  ['music', 'Music track', 'text', null, 'stored; music arrives later'],
];
const BUILTIN_RULES = { light: 'house', grid: true, freeMoves: true, touch: 'open', fog: false, fogOfWar: false, darkness: false, music: '' };
const CLASS_LABELS = { 'token.move': 'Move pawns', 'token.edit': 'Create and edit pawns', room: 'Rooms', object: 'Objects', undo: 'Undo', pawn: 'Edit own pawns', open: 'Open and light things', reveal: 'Hide and reveal', chat: 'Talk and roll', 'area.admin': 'Areas', transfer: 'Move between areas', 'campaign.admin': 'Campaign settings' };
const AGENTS_NEVER = new Set(['seat.agent', 'seat.admin', 'seat.locate', 'seat.self', 'request']);

export function settingsSurface(R, app) {
  const launch = document.getElementById('launchers');
  const b = document.createElement('button');
  b.className = 'launcher'; b.dataset.l = 'settings'; b.title = 'Settings (S)'; b.setAttribute('aria-label', 'Settings');
  b.innerHTML = `<img class="lic" src="data/icons/tool-settings.png?v=${window.TW_V || 'dev'}" alt="" width="40" height="40"><span class="lcap">Settings</span><kbd>S</kbd><i class="dot" hidden></i>`;
  b.querySelector('img').onerror = (ev) => { ev.target.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon('layout-grid', 30) })); };
  launch.append(b);
  const modal = document.createElement('div'); modal.id = 'settingsModal'; modal.hidden = true;
  document.body.append(modal);

  let prefs = loadPrefs();
  let section = 'nav', confirmDel = null, lastKey = null, newAgent = null;
  let pawnEdit = null, picker = null, scrollTo = null; // Me ▸ My pawns: the pawn being defined or edited, and its figure picker
  const C = () => app.sync.campaign;
  const SECTIONS = [
    // S opens Settings (always on World navigation); then a letter picks a section (S then N, M, A, G, C). The letters
    // only act while the window is open and nothing in it is being typed into, so they never meet the game's own keys.
    { id: 'nav', label: 'World navigation', icon: 'map', all: true, key: 'N' },
    { id: 'me', label: 'Me', icon: 'user', all: true, key: 'M' },
    { id: 'area', label: 'Area settings', icon: 'layers', key: 'A' },
    { id: 'defaults', label: 'Global defaults', icon: 'layout-template', key: 'G' },
    { id: 'admin', label: 'Campaign admin', icon: 'shield', key: 'C' },
    { id: 'feedback', label: 'Feedback', icon: 'message-square', all: true, key: 'F' },
  ];
  // FEEDBACK (Harry 2026-10-19): the form loads on first use; app.feedback.open({ kind }) is the command bar's door
  // ("feedback", "report a bug", "idea", "comment on this asset"). Each arrival at the section takes a fresh screenshot
  // and reads the selection (surfaces/feedback.js mountFeedback).
  let fbMod = null, fbPreset = null, lastSec = null;
  const loadFb = () => fbMod ||= import(`./feedback.js${window.TW_V && window.TW_V !== 'dev' ? `?v=${window.TW_V}` : ''}`);
  app.feedback = {
    open: (opts = {}) => { fbPreset = { ...opts, fresh: true }; lastSec = null; lastHtml = ''; S.show('feedback'); },
    loaded: () => !!fbMod,
  };
  const sectionsFor = () => SECTIONS.filter(s => s.all || app.gm());
  const cur = () => sectionsFor().some(s => s.id === section) ? section : 'nav';

  const S = app.settings = {
    isOpen: false,
    open: (sec) => open(sec), close: () => close(), toggle: () => S.isOpen ? close() : open(),
    show: (sec) => { section = sec; if (S.isOpen) render(); else open(sec); },
    // Me ▸ My pawns, on a new pawn ('new') or on one being edited (its id): the door the Pawns menu's "New pawn" opens
    editPawn: (id) => { startPawnEdit(id); scrollTo = '.mped'; if (S.isOpen) { section = 'me'; render(); } else open('me'); },
    pawnEdit: () => pawnEdit && { ...pawnEdit, tree: picker?.state() },
    prefs: () => ({ ...prefs }),
    setPref: (k, v) => setPref(k, v),
    setGfx: (name) => setGfx(name), setAuto: (name) => setAuto(name), // Me ▸ Graphics: a preset by hand; Auto's own pick (graphics.js)
    resetPrefs: () => { prefs = { ...PREF_DEFAULTS }; savePrefs(); applyPrefs(); if (S.isOpen) render(); },
    ownsKey: (k) => S.isOpen && sectionsFor().some(x => x.key.toLowerCase() === k), // (surfaces/tray.js)
    state: () => ({ open: S.isOpen, section: cur(), sections: sectionsFor().map(s => s.id), modal: true }),
    applied: () => ({ ...applied }),
  };
  b.onclick = (ev) => { ev.stopPropagation(); S.toggle(); };

  // ---------- open / close: a modal over everything; Esc, the × or the backdrop close it ----------
  function open(sec) {
    section = sec || 'nav'; // Settings always opens on World navigation
    // Each explicit visit asks for current pictures. A cached empty list can otherwise outlive a
    // different seat's upload, with no relay event or timer to invalidate it while the panel is open.
    if (section === 'nav' && app.thumbs) app.thumbs.fetchedAt = 0;
    app.build?.close(); app.pawns?.close();
    if (!S.isOpen) { S.isOpen = true; b.classList.add('open'); app.escapeStack.push(closeIfOpen); }
    render();
    app.emit('settings.open');
  }
  function close() { if (!S.isOpen) return false; S.isOpen = false; lastSec = null; confirmDel = null; pawnEdit = null; picker = null; b.classList.remove('open'); modal.hidden = true; app.emit('settings.close'); }
  // Escape and a click on the backdrop close it, unless it is PINNED (surfaces/tray.js: hold, tap, pin). Pinned, the
  // window stays where it is, the backdrop is gone and the map behind it takes the pointer and the keys.
  function closeIfOpen() { if (!S.isOpen) return false; if (!app.tray.dismissable('settings')) { queueMicrotask(() => S.isOpen && app.escapeStack.unshift(closeIfOpen)); return false; } close(); }
  app.tray.register('settings', () => modal.querySelector('.smodal'));
  modal.addEventListener('pointerdown', (ev) => { if (ev.target === modal && app.tray.dismissable('settings')) close(); });
  modal.addEventListener('keydown', (ev) => ev.stopPropagation()); // typing in a field never reaches the game's hotkeys
  modal.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && app.tray.dismissable('settings')) { ev.preventDefault(); close(); } });
  // the section chords: a letter (no modifier) while nothing is being typed into; S again closes
  const typing = (t) => t?.matches?.('input:not([type=range]):not([type=checkbox]), textarea, select');
  const onKey = (ev) => {
    if (!S.isOpen || ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target) || !app.tray.takesKeys('settings')) return; // (pinned: letters only while the pointer is over the window)
    const k = ev.key.length === 1 ? ev.key.toUpperCase() : '';
    const hit = sectionsFor().find(x => x.key === k);
    if (hit) { ev.preventDefault(); ev.stopPropagation(); section = hit.id; confirmDel = null; render(); return; }
    // (S itself, to close: surfaces/tray.js, which also knows a held S from a tapped one)
  };
  modal.addEventListener('keydown', onKey, true);
  addEventListener('keydown', (ev) => { if (S.isOpen && !modal.contains(ev.target)) onKey(ev); }, true);
  app.on((what, d) => { if (what === 'build.open' || what === 'pawns.open') close(); if (what === 'tray.pin' && d === 'settings' && S.isOpen) render(); });

  // ---------- render ----------
  // Re-rendering must never eat a click: a redraw that arrives while a pointer is down in the window waits for the
  // release, and a redraw whose markup is unchanged leaves the DOM alone (no layout shift, focus and scroll kept).
  // (Live tests, 2026-10-04: a campaign refresh or the thumbnails' arrival landing between press and release swallowed
  // "Approve", "Deny", "Open in PiP"… at a few frames per second.)
  let lastHtml = '', pressed = false, deferred = false;
  modal.addEventListener('pointerdown', () => { pressed = true; }, true);
  addEventListener('pointerup', () => { if (!pressed) return; pressed = false; if (deferred) { deferred = false; setTimeout(() => S.isOpen && render(), 0); } }, true);
  addEventListener('pointercancel', () => { pressed = false; }, true);
  function render() {
    if (pressed && S.isOpen && !modal.hidden) { deferred = true; return; }
    const sec = cur(), secs = sectionsFor();
    const body = { nav: navBody, me: meBody, area: areaBody, defaults: defaultsBody, admin: adminBody, feedback: () => '<div class="fbroot"><p class="snote">Loading…</p></div>' }[sec]();
    const html = `<div class="smodal" role="dialog" aria-modal="true" aria-label="Settings">
      <nav class="scats"><div class="stitle">Settings</div>${secs.map((s, i) => `<button class="scat${s.id === sec ? ' sel' : ''}" data-sec="${s.id}">${icon(s.icon, 18)}<span>${s.label}</span><kbd>${s.key}</kbd>${s.id === 'admin' && pendingCount() ? `<i class="badge">${pendingCount()}</i>` : ''}</button>`).join('')}<button class="scat other-games" type="button">Other games / New game</button></nav>
      <section class="spane" data-sec="${sec}"><header class="sph"><h2>${secs.find(s => s.id === sec).label}</h2><span class="sphb">${app.tray.pinButton('settings')}<button class="sx" title="Close (${app.tray.pinned('settings') ? 'S' : 'Esc'})" aria-label="Close">${icon('x', 18)}</button></span></header><div class="spb">${body}</div></section></div>`;
    modal.dataset.cseq = C()?.cseq ?? '';
    modal.classList.toggle('pinned', app.tray.pinned('settings'));
    if (html === lastHtml && !modal.hidden) return;
    const pane0 = modal.querySelector('.spane'), keep = pane0?.dataset.sec === sec ? modal.querySelector('.spb')?.scrollTop : 0;
    lastHtml = html; modal.innerHTML = html;
    modal.hidden = false;
    if (keep) modal.querySelector('.spb').scrollTop = keep;
    if (scrollTo) { modal.querySelector(scrollTo)?.scrollIntoView({ block: 'start' }); scrollTo = null; }
    app.tray.wirePin(modal);
    for (const x of modal.querySelectorAll('.scat')) x.onclick = () => { section = x.dataset.sec; confirmDel = null; render(); };
    modal.querySelector('.sx').onclick = () => close();
    modal.querySelector('.other-games').onclick = openGames;
    wire(sec);
  }
  // the campaign changed (someone renamed an area, a request arrived…): redraw, unless the person is typing
  app.on((what) => {
    if (what !== 'refresh') return;
    badge();
    const c = C(); if (!S.isOpen || !c) return;
    if (String(c.cseq) === modal.dataset.cseq && cur() === modal.querySelector('.spane')?.dataset.sec) return;
    if (modal.contains(document.activeElement) && document.activeElement.matches('input[type=text], input:not([type]), textarea')) return;
    render();
  });

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const row = (label, ctl, note = '') => `<div class="srow"><label>${label}</label><div class="sctl">${ctl}</div>${note ? `<small class="snote">${note}</small>` : ''}</div>`;
  const group = (title, inner, note = '') => `<div class="sgrp"><h3>${title}</h3>${note ? `<p class="snote">${note}</p>` : ''}${inner}</div>`;
  const toggle = (attr, on, dis = false) => `<button class="stog${on ? ' on' : ''}" ${attr} role="switch" aria-checked="${!!on}"${dis ? ' disabled' : ''}><i></i></button>`;
  const select = (attr, opts, v) => `<select ${attr}>${opts.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const range = (attr, v, min, max, step) => `<input type="range" ${attr} min="${min}" max="${max}" step="${step}" value="${v}"><output>${(+v).toFixed(step < 1 ? 2 : 0)}</output>`;

  // ---------- 1. World navigation ----------
  function navBody() {
    const c = C(); if (!c) return '<p class="snote">Connecting…</p>';
    const gm = app.gm(), main = app.area(), pip = app.pip && !app.pip.area.startsWith('lib:') ? app.pip.area : null;
    // AN AREA IS OPEN OR HIDDEN (Harry 2026-10-06). The GM sees which, on every row, in the hidden look (surfaces/areas.js
    // app.areaMark is the one mark), and opens or hides it here; a player is only ever sent the open ones.
    const visOf = (a) => !gm ? '' : a.visibility === 'hidden' ? `<span class="avis is-hidden">${app.areaMark(a.id)} Hidden from players</span>` : '<span class="avis">Open to players</span>';
    const Th = app.thumbs, ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString(); };
    if (Th && (!Th.fetchedAt || Date.now() - Th.fetchedAt > 20000)) { Th.fetchedAt = Date.now(); Th.refreshMeta().then(() => { if (S.isOpen && cur() === 'nav') render(); }); }
    const pic = (a) => { const u = Th?.url(a.id), m = Th?.meta[a.id]; return `<div class="sthumb">${u ? `<img src="${esc(u)}" alt="${esc(a.name)}" loading="lazy" width="240" height="150">` : `<div class="ph"><span>${esc(a.name)}</span></div>`}<small>${m ? `updated ${ago(m.at)}` : 'not visited yet'}</small></div>`; };
    const list = c.areas.map(a => `<li class="sarea${a.id === main ? ' here' : ''}${gm && a.visibility === 'hidden' ? ' hidden-area' : ''}" data-area="${a.id}" data-vis="${a.visibility}">${pic(a)}
        <div class="san">${gm ? `<input class="aname" value="${esc(a.name)}" maxlength="60" aria-label="Area name">` : `<b>${esc(a.name)}</b>`}<small>${[visOf(a), a.id === main ? 'you are here' : '', a.id === pip ? 'in the PiP' : ''].filter(Boolean).join(' · ')}</small></div>
        <div class="sab">${gm ? `<button class="sbtn${a.visibility === 'hidden' ? ' primary' : ''}" data-act="vis" title="${a.visibility === 'hidden' ? 'Players cannot see this area, or that it exists' : 'Hide this area from players'}">${a.visibility === 'hidden' ? `${icon('eye', 15)} Open to players` : `${icon('eye-off', 15)} Hide`}</button>` : ''}<button class="sbtn" data-act="here"${a.id === main ? ' disabled' : ''}>Open here</button><button class="sbtn" data-act="pip"${a.id === pip ? ' disabled' : ''}>Open in PiP</button>${gm ? `<button class="sbtn danger${confirmDel === a.id ? ' armed' : ''}" data-act="del"${c.areas.length < 2 ? ' disabled title="A campaign keeps at least one area"' : ''}>${confirmDel === a.id ? 'Really delete?' : icon('trash-2', 15)}</button>` : ''}</div></li>`).join('');
    return `<p class="snote">Every area you can reach. ${gm ? 'You can create, rename (edit the name) and delete areas. Opening an area here moves only your view; a pawn travels from its own menu.' : ''}</p>${c.areas.length ? '' : '<p class="snote">No area is open to you right now.</p>'}<ul class="sareas">${list}</ul>
      ${gm ? `<div class="snew"><input class="newname" placeholder="New area name" maxlength="60"><button class="sbtn primary" data-act="create">${icon('plus', 15)} Create area</button><small class="snote">A new area starts hidden from players, until you open it.</small></div>` : ''}`;
  }

  // ---------- 2. Me ----------
  // Me ▸ Graphics (graphics.js): one preset control, then every switch it sets, then the ones no preset touches
  function graphicsGroup(g) {
    const p = prefs, gi = app.gfx?.info?.(), cur = p.gfx || 'auto', told = gi?.auto?.told, on = (k) => p[k] !== false;
    const autoLine = cur !== 'auto' ? '' : !gi?.live ? 'Auto is off under a test driver.' : told ? `Auto chose ${GFX_LABEL[told.to]} for this machine: ${esc(told.why)} on ${GFX_LABEL[told.from]}. <a href="#" class="gfxuse" data-gfx="${told.from}">Use ${GFX_LabelSafe(told.from)} anyway</a>`
      : gi?.auto?.note === 'not-graphics' ? `Auto is using ${GFX_LABEL[p.gfxAuto] || 'High'}: frames are slow here, but a lighter picture did not make them faster, so it was left alone.`
      : `Auto is using ${GFX_LABEL[p.gfxAuto] || 'High'}${gi?.auto?.done ? '' : ' and measuring'}. It steps down only if frames stay slow, says so, and can be undone.`;
    const presets = [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High (the full look)'], ...(cur === 'custom' ? [['custom', 'Custom']] : [])];
    const buf = gi ? `now ${gi.buffer[0]} × ${gi.buffer[1]} pixels` : '';
    return '<span class="gfxtop"></span>' + group('Graphics',
      row('Quality', select('data-pref="gfx"', presets, cur), autoLine || (cur === 'custom' ? 'your own mix of the switches below' : 'sets the switches below; change any one and this becomes Custom'))
      + row('Real lights from fires', select('data-pref="lights"', [['all', 'Every flame'], ['16', 'The nearest 16'], ['8', 'The nearest 8'], ['4', 'The nearest 4'], ['none', 'None']], String(p.lights || 'all')), 'a flame that is not a real light still burns, and lights nothing. On a big map this is most of the cost: every pixel is lit by every real light')
      + row('Glow under far fires', toggle('data-pref="farGlow"', !!app.gfx?.farGlow?.()), 'a cheap stand-in for the light of each flame that is not a real light: it brightens the floor, walls and things round the flame, and stops at walls. Off until a look for it is chosen in the Spawn Tuner (Far-fire glow ▸ Use in game); switch it here to compare')
      + row('Shadows from fires and lamps', toggle('data-pref="shadowsFx"', on('shadowsFx')), 'off: the shadow is not drawn at all; the light still shines')
      + row('Contact shadows', toggle('data-pref="contactFx"', on('contactFx')), 'the soft darkening where things meet the floor and each other')
      + row('Fog and mist', toggle('data-pref="fogFx"', on('fogFx')), 'the drifting ground fog, the fog sea and the haze, for you only; off also skips the work of simulating them. Fire smoke stays; fog of war uses flat grey instead')
      + row('Soft effects at half resolution', toggle('data-pref="softHalf"', !!p.softHalf), 'contact shadows and fog are worked out on a quarter of the pixels and smoothed')
      + row('Water effects', toggle('data-pref="waterFx"', on('waterFx')), 'ripples and mirrored reflections; off leaves water a plain moving surface')
      + row('Fire flicker and sparks', toggle('data-pref="fireFx"', on('fireFx')), 'off: fires burn and light the room steadily, with no embers or smoke')
      + row('Render resolution', select('data-pref="density"', [['native', 'Native (the screen\'s own, up to 2×)'], ['1.5', '1.5×'], ['1', '1× (fewest pixels)']], String(p.density || 'native')), `the 3D picture only: text and menus stay sharp${buf ? ` · ${buf}` : ''}`)
      + row('Frame rate limit', select('data-pref="maxFps"', [['0', 'The display\'s own rate'], ['60', '60 a second'], ['30', '30 a second']], String(p.maxFps ?? 60)), 'a 120 Hz screen draws the same picture twice as often as a 60 Hz one')
      + row('When nothing is happening', select('data-pref="idleFps"', [['0', 'Keep drawing at full rate'], ['30', 'Draw 30 a second'], ['20', 'Draw 20 a second'], ['10', 'Draw 10 a second']], String(p.idleFps ?? 20)), `after ${IDLE_AFTER_MS / 1000} seconds with no input and nothing moving but fog and fire; any touch brings the full rate straight back`)
      + row('Lighting effects', toggle('data-pref="post"', p.post), 'the whole lighting stack: bloom, contact shadows, fog, colour. Off is a flat, much darker picture')
      + row('Geometry detail', select('data-pref="graphics"', Object.entries(GRAPHICS).map(([k, v]) => [k, v.label]), p.graphics), applied.faces && applied.faces !== g.faces ? '<a href="#" class="reload">reload to apply</a>' : 'how many triangles each thing is drawn with')
      + row('Lighter picture while moving', toggle('data-pref="lightMoves"', p.lightMoves !== false), 'while you pan, turn, zoom or drag, effects are dropped only as far as needed to keep up, and come back when you stop'));
  }
  const GFX_LabelSafe = (k) => esc(GFX_LABEL[k] || k);
  function meBody() {
    const c = C(), me = c?.seats.find(s => s.id === app.me()) || {};
    const keys = R.all().filter(x => x.keys?.length && R.permitted?.(x, R.ctx()) !== false).map(x => `<tr><td>${esc(typeof x.title === 'function' ? x.title(R.ctx()) : x.title)}</td><td>${x.keys.map(k => `<kbd>${esc(k.replace('Mod', navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'))}</kbd>`).join(' ')}</td></tr>`).join('');
    const mine = (c?.seats || []).filter(s => s.kind === 'llm' && s.creator === app.me());
    const g = GRAPHICS[prefs.graphics] || GRAPHICS.high;
    const reqs = (c?.requests || []).filter(r => r.by === app.me());
    const exportOk = reqs.some(r => r.kind === 'export' && r.status === 'approved');
    return [
      group('Identity', row('Name', `<input class="myname" value="${esc(me.name || '')}" maxlength="40">`) + row('Seat colour', `<input type="color" class="mycolor" value="${esc(me.color || '#e0b04a')}">`)),
      myPawnsGroup(),
      group('Controls', row('Zoom speed', range('data-pref="zoomSpeed"', prefs.zoomSpeed, 0.25, 2, 0.05)) + row('Rotate speed', range('data-pref="rotateSpeed"', prefs.rotateSpeed, 0.25, 2, 0.05)) + row('Invert zoom', toggle('data-pref="invertZoom"', prefs.invertZoom)) + row('Invert rotate', toggle('data-pref="invertRotate"', prefs.invertRotate)) + row('Scroll wheel', select('data-pref="wheel"', [['auto', 'Auto (a wheel zooms, a trackpad pans)'], ['zoom', 'Always zoom'], ['pan', 'Always pan']], prefs.wheel || 'auto'), 'if a smooth-scrolling mouse pans, or a trackpad zooms') + row('Pawns snap to squares', select('data-pref="pawnSnap"', [['shift', 'Only with Shift'], ['always', 'Always (Shift = free)']], prefs.pawnSnap || 'shift'), 'dragging a pawn, or a figure out of a list')
        + `<details class="skeys"><summary>Keyboard shortcuts</summary><table>${keys}</table></details>`),
      graphicsGroup(g),
      group('Interface', row('Ring size', range('data-pref="ringScale"', prefs.ringScale, 0.7, 1.6, 0.05)) + row('Text size', range('data-pref="textScale"', prefs.textScale, 0.8, 1.5, 0.05)) + row('Announce says and rolls', toggle('data-pref="announce"', prefs.announce)) + row('3D dice', toggle('data-pref="dice3d"', prefs.dice3d !== false), 'rolls tumble onto the table; off: the chat line only') + row('Announcement speed', range('data-pref="announceSpeed"', prefs.announceSpeed, 0.5, 2, 0.1)) + row("Others' cursors", toggle('data-pref="cursors"', prefs.cursors)) + (app.can('room') ? row('Room and building labels', toggle('data-labels', app.labelsOn?.() !== false), 'L, or "labels" in the command bar. This browser only; pawn names stay') : '') + (app.gm() && app.setLightReach ? row('Show light reach', toggle('data-lightreach', !!app.lightReach?.()), 'each lit light\'s reach on its floor, coloured by kind ("light reach" in the command bar). This browser only; players never see it') : '') + row('Levels fly away', toggle('data-pref="cutFly"', prefs.cutFly), 'hidden levels lift off instead of vanishing') + row('Library: everything the same size', toggle('data-pref="libEven"', prefs.libEven !== false), 'in the Build library every thing fills its place the same; off shows true relative sizes. What you place is always its true size') + row('Reduce motion', toggle('data-pref="reducedMotion"', prefs.reducedMotion))),
      group('Sound', row('Music', toggle('data-pref="music"', prefs.music) + range('data-pref="musicVol"', prefs.musicVol, 0, 1, 0.05)) + row('Sound effects', toggle('data-pref="sfx"', prefs.sfx) + range('data-pref="sfxVol"', prefs.sfxVol, 0, 1, 0.05)), 'Stored for you; music and sound are coming.'),
      group('My agents', `${mine.length ? `<ul class="slist">${mine.map(s => `<li data-seat="${s.id}"><b>${esc(s.name)}</b><small>${s.online ? 'online' : 'offline'}</small><button class="sbtn" data-act="key">Copy key</button><button class="sbtn danger" data-act="revoke">Revoke</button></li>`).join('')}</ul>` : '<p class="snote">None yet.</p>'}
        <div class="snew"><input class="agentname" placeholder="Agent name" maxlength="40"><button class="sbtn primary" data-act="agent">${icon('bot', 15)} Create agent</button></div>${newAgent ? `<p class="skey">Key for ${esc(newAgent.name)}: <code>${esc(newAgent.url)}</code></p>` : ''}`, 'LLM seats that act for you, with at most your permissions.'),
      app.gm() ? '' : group('Import and export', `<div class="sab"><button class="sbtn" data-act="req-export">Ask to export</button><label class="sbtn">Ask to import…<input type="file" accept=".json,application/json" class="reqfile" hidden></label>${exportOk ? `<button class="sbtn primary" data-act="export">${icon('package', 15)} Export now</button>` : ''}</div>${reqs.length ? `<ul class="slist">${reqs.map(r => `<li><b>${r.kind === 'import' ? 'Import' : 'Export'}</b><small class="st-${r.status}">${r.status}</small></li>`).join('')}</ul>` : ''}`, 'The GM approves or denies each request.'),
      `<div class="sfoot"><button class="sbtn" data-act="reset">Reset to defaults</button></div>`,
    ].join('');
  }

  // ---------- Me ▸ My pawns (Harry 2026-10-06; docs/PAWNS.md "A player's pawns") ----------
  // DEFINE a pawn: a figure picked from OUR set (the picker is the Pawns menu's own tree: surfaces/figtree.js), a name,
  // a sheet link, notes, whose pet or familiar it is, and whether it is my main pawn. Kept with the campaign
  // (pawn.define: "it's literally just a line of json"), no limit, nobody approves it. The Pawns menu (P) USES them:
  // the bench lists what is defined; bring one on, send one back.
  const F = app.figures;
  const myId = () => { const me = C()?.seats.find(s => s.id === app.me()); return me?.kind === 'llm' ? me.creator : app.me(); };
  const myDefs = () => (C()?.pawns || []).filter(d => d.owner === myId());
  const figPic = (fig, size) => { const f = fig && F.get(fig), u = f && F.thumbUrl(f); return u ? `<img class="mpimg" src="${esc(u)}" alt="" width="${size}" height="${size}">` : `<span class="mpimg none" style="width:${size}px;height:${size}px">${icon('user', Math.round(size * 0.5))}</span>`; };
  function startPawnEdit(id) {
    const d = id && id !== 'new' ? myDefs().find(x => x.id === id) : null;
    const ft = (v) => Number.isFinite(v) ? String(v) : ''; // '' = the default (darkvision 30 ft, no carried light)
    pawnEdit = d ? { id: d.id, isNew: false, name: d.name, fig: d.fig || '', sheet: d.sheet || '', notes: d.notes || '', petOf: d.petOf || '', main: !!d.main, named: true, darkvision: ft(d.darkvision), lightCarried: ft(d.lightCarried) }
      : { id: null, isNew: true, name: '', fig: '', sheet: '', notes: '', petOf: '', main: !myDefs().length, named: false, darkvision: '', lightCarried: '' };
    picker = figTree(app, {
      selected: () => pawnEdit?.fig || null,
      onChange: () => { if (S.isOpen) render(); },
      onPick: (f) => { if (!pawnEdit) return; pawnEdit.fig = f.id; if (!pawnEdit.named || !pawnEdit.name.trim()) pawnEdit.name = pawnLabel(f); render(); },
      onMore: () => app.toast('Every figure of this family is in the command bar: type its name there, then "change figure" on your pawn'),
    });
    const f = d?.fig && F.get(d.fig); // open the picker where the pawn's own figure is
    if (f) { const leaf = [...picker.X.roots.flatMap(r => r.children || [r])].find(n => n.figs?.some(x => x.id === f.id)); if (leaf) picker.path = picker.X.pathOf(leaf.id).map(n => n.id); }
  }
  function myPawnsGroup() {
    const defs = myDefs(), nameOf = (id) => defs.find(d => d.id === id)?.name;
    const status = (d) => [d.main ? '★ main' : '', d.petOf && nameOf(d.petOf) ? `${nameOf(d.petOf)}'s` : '', d.at ? `on the table: ${app.areaName(d.at)}` : d.away ? 'on a table' : 'on the bench'].filter(Boolean).join(' · ');
    const cards = defs.map(d => `<li class="mpcard${pawnEdit?.id === d.id ? ' sel' : ''}" data-def="${d.id}">${figPic(d.fig, 56)}<div class="mpn"><b>${esc(d.name)}</b><small>${esc(status(d))}</small></div><button class="sbtn" data-act="pawn-edit">Edit</button><button class="sbtn danger" data-act="pawn-forget" title="Forget this pawn">${icon('trash-2', 15)}</button></li>`).join('');
    const e = pawnEdit, f = e?.fig && F.get(e.fig);
    const editor = !e ? '' : `<div class="mped" data-edit="${e.isNew ? 'new' : e.id}"><h4>${e.isNew ? 'New pawn' : `Edit ${esc(myDefs().find(d => d.id === e.id)?.name || 'pawn')}`}</h4>
      <div class="mpfig"><div class="mpprev">${figPic(e.fig, 112)}<b>${f ? esc(f.name) : 'No figure yet'}</b><small>${f ? esc(F.describe(f)) : 'pick one from the pictures'}</small>${f ? `<button class="sbtn tiny" data-act="pawn-nofig">No figure</button>` : ''}</div><div class="mptree clip">${picker.html()}</div></div>
      ${row('Name', `<input class="mpname" value="${esc(e.name)}" maxlength="80" placeholder="What it is called on the table">`)}
      ${row('Sheet link', `<input class="mpsheet" value="${esc(e.sheet)}" maxlength="500" placeholder="https://… (its character sheet; optional)">`)}
      ${row('Notes', `<textarea class="mpnotes" maxlength="4000" rows="3" placeholder="Everyone at the table can read these (optional)">${esc(e.notes)}</textarea>`)}
      ${row('Pet or familiar of', select('class="mppet"', [['', 'Nobody: it is its own pawn'], ...defs.filter(d => d.id !== e.id).map(d => [d.id, d.name])], e.petOf))}
      ${row('My main pawn', toggle('data-mpmain', e.main), 'your main pawn wears the full-detail figure')}
      ${row('Sees in the dark (ft)', `<input class="mpdark" type="number" min="0" max="${DARKVISION_MAX}" step="5" value="${esc(e.darkvision)}" placeholder="${DARKVISION_DEFAULT}" aria-label="Sees in the dark, in feet">`, `its darkvision where an area is dark (blank: ${DARKVISION_DEFAULT} ft; 0: none)`)}
      ${row('Carries a light (ft)', `<input class="mplight" type="number" min="0" max="${CARRIED_LIGHT_MAX}" step="5" value="${esc(e.lightCarried)}" placeholder="0" aria-label="Carries a light, in feet">`, 'a torch is 40, a lantern 60; it lights the dark for everyone')}
      <div class="sab"><button class="sbtn primary" data-act="pawn-save">${icon('check', 15)} ${e.isNew ? 'Add to my pawns' : 'Save'}</button><button class="sbtn" data-act="pawn-cancel">Cancel</button></div></div>`;
    return group('My pawns', `${defs.length ? `<ul class="slist mpl">${cards}</ul>` : '<p class="snote">None yet.</p>'}${e ? '' : `<div class="snew"><button class="sbtn primary" data-act="pawn-new">${icon('plus', 15)} New pawn</button></div>`}${editor}`, 'The pawns you keep in this campaign. Bring them onto the table, and send them back to your bench, from the Pawns menu (P).');
  }
  function savePawn() {
    const e = pawnEdit; if (!e) return;
    const name = e.name.trim(); if (!name) { app.toast('Give the pawn a name', true); modal.querySelector('.mpname')?.focus(); return; }
    const f = e.fig && F.get(e.fig), id = e.isNew ? newId('def') : e.id, size = f?.size || 1;
    // darkvision / carried light: a number of feet (clamped, to the nearest foot), or blank = the default
    const feet = (v, max) => { const t = String(v ?? '').trim(); if (!t) return null; const n = Math.round(Number(t)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : null; };
    const dark = { darkvision: feet(e.darkvision, DARKVISION_MAX), lightCarried: feet(e.lightCarried, CARRIED_LIGHT_MAX) };
    dispatchC('pawn.define', { id, name, fig: f ? f.id : 'none', size, sheet: e.sheet.trim(), notes: e.notes, petOf: e.petOf || '', main: !!e.main, ...dark });
    // its pawn, when it stands on the table I am at, changes with it (elsewhere: the next time it is brought on)
    const t = Object.values(app.entities()).find(x => x.kind === 'token' && x.def === id);
    if (t) app.batch([{ type: 'token.set', args: { id: t.id, name, fig: f ? f.id : 'none', size, sheet: e.sheet.trim(), notes: e.notes, main: !!e.main, ...dark } }]);
    S.lastPawnSaved = id; pawnEdit = null; picker = null; render();
  }

  // ---------- 3. Area settings (the area in the main view) and 4. Global defaults ----------
  const areaOf = (id = app.area()) => C()?.areas.find(a => a.id === id);
  const defaults = () => C()?.defaults || {};
  function ruleCtl(k, kind, opts, v, scope) {
    const attr = `data-rule="${k}" data-scope="${scope}"`;
    return kind === 'toggle' ? toggle(attr, v) : kind === 'select' ? select(attr, opts, v) : `<input ${attr} value="${esc(v)}" maxlength="80">`;
  }
  function areaBody() {
    const a = areaOf(); if (!a) return '<p class="snote">No area open.</p>';
    const d = defaults(), set = a.settings || {};
    const rules = RULES.map(([k, label, kind, opts, note]) => {
      const over = k in set, v = over ? set[k] : (k in d ? d[k] : BUILTIN_RULES[k]);
      return row(label, ruleCtl(k, kind, opts, v, 'area') + `<span class="sinh ${over ? 'over' : ''}">${over ? 'overridden here' : 'using default'}</span>${over ? `<button class="sbtn tiny" data-reset="${k}" data-scope="area">Reset</button>` : ''}`, note || '');
    }).join('');
    return `<p class="snote">For <b>${esc(a.name)}</b>, the area in your main view.</p>`
      + group('Players', row('Open to players', toggle('data-areaopen', a.visibility !== 'hidden') + `<span class="avis${a.visibility === 'hidden' ? ' is-hidden' : ''}">${a.visibility === 'hidden' ? `${app.areaMark(a.id)} Hidden from players` : 'Open to players'}</span>`, a.visibility === 'hidden' ? 'Hidden everywhere: players cannot see it, list it, view it or travel to it, and nothing in it reaches them.' : 'Everyone in the campaign can see it and travel to it.'))
      + group('Play', rules);
  }
  function defaultsBody() {
    const d = defaults(), c = C();
    const rules = RULES.filter(r => r[0] !== 'fogOfWar').map(([k, label, kind, opts, note]) => { const over = k in d, v = over ? d[k] : BUILTIN_RULES[k]; return row(label, ruleCtl(k, kind, opts, v, 'defaults') + `<span class="sinh ${over ? 'over' : ''}">${over ? 'set here' : 'built-in'}</span>${over ? `<button class="sbtn tiny" data-reset="${k}" data-scope="defaults">Reset</button>` : ''}`, note || ''); }).join('');
    const anim = Object.keys(T.anim?.BUILTIN_PRESETS || { 'harry-v2': 1 }), light = ['night', 'day', 'deep-night', 'daylight'], selStyles = Object.keys(selectionStyles());
    const genres = (app.taxonomy?.genres || []).map(id => app.taxonomy.get(id)).filter(Boolean);
    const camp = (k, opts, fallback) => select(`data-camp="${k}"`, opts, d[k] ?? fallback);
    // (Harry 2026-10-12 looked for the graphics switches here: they are each person's own, under Me)
    return `<p class="snote">Every area inherits these unless it overrides them. Graphics are per person: <a href="#" class="gomegfx">Me ▸ Graphics</a>.</p>`
      + group('Campaign', row('Campaign name', `<input class="campname" value="${esc(c?.name || '')}" maxlength="80">`))
      + group('Play (every area)', rules)
      + group('Vision', row('Fog of war', toggle('data-vision="fogOfWar"', d.fogOfWar === true), 'Players see through their pawns; explored rooms stay in mist. Independent of Graphics and Fog and mist.')
        + row('Shared party vision', toggle('data-vision="sharedPartyVision"', d.sharedPartyVision === true), 'Share sight from all player-owned pawns. Off: only your own pawns and those you control.')
        + `<div class="sab"><button class="sbtn" data-act="fog-reset">Reset fog</button><button class="sbtn" data-act="fog-reveal">Reveal explored here</button></div><p class="snote">Reset forgets exploration for everyone (undoable). Reveal marks the selected room, or this area, explored.</p>`)
      + group('Travel', row('Players travel between areas', toggle('data-travel', !d.travelLocked), d.travelLocked ? 'Locked: only you send pawns to another area.' : 'Players send their own pawns to any open area; you can bring one back.'))
      + group('Campaign-wide', row('Distance', camp('distance', [['true', 'True distance (straight line)'], ['five', 'Squares: every diagonal 5 ft'], ['alt', 'Squares: diagonals 5 / 10']], 'true'), 'how rulers, templates and a dragged pawn count distance')
        + row('Units', camp('units', [['ft', 'Feet'], ['m', 'Metres']], 'ft'), 'rulers and templates read in these (1.5 m a square); other readouts are in feet for now')
        + row('Genre default', camp('genre', [['', 'First in the list'], ...genres.map(g => [g.key, g.label])], ''), 'where Build opens for a new seat')
        + row('Rolls', camp('rolls', [['public', 'Public'], ['hidden', 'Hidden (GM sees)']], 'public'), 'stored; hidden rolls are coming'))
      + group('House look', row('Spawn animation', camp('houseAnim', anim.map(k => [k, k]), anim[0])) + row('House lighting', camp('houseLight', [['', 'As tuned'], ...light.map(k => [k, k])], '')) + row('Selection style', camp('houseSelection', [['', 'As tuned'], ...selStyles.map(k => [k, k])], '')));
  }
  const selectionStyles = () => { try { return T.selection?.STYLE_DEFAULTS || {}; } catch { return {}; } };

  // ---------- 5. Campaign admin ----------
  function adminBody() {
    const c = C(); if (!c) return '';
    const humans = c.seats.filter(s => s.kind === 'human' && s.id !== app.me());
    const agents = c.seats.filter(s => s.kind === 'llm' && s.creator === app.me());
    const snaps = listSnaps();
    const pending = (c.requests || []).filter(r => r.status === 'pending'), done = (c.requests || []).filter(r => r.status !== 'pending').slice(-6);
    const nameOf = (id) => c.seats.find(s => s.id === id)?.name || 'someone';
    const cls = Object.keys(CLASS_LABELS);
    return group('Requests', pending.length ? `<ul class="slist">${pending.map(r => `<li data-req="${r.id}"><b>${esc(nameOf(r.by))}</b> asks to <b>${r.kind}</b>${r.note ? ` <small>“${esc(r.note)}”</small>` : ''}${r.kind === 'import' && r.payload ? ` <small>${(r.payload.areas || []).length} area(s)</small>` : ''}<button class="sbtn primary" data-act="approve">Approve</button><button class="sbtn" data-act="deny">Deny</button></li>`).join('')}</ul>` : '<p class="snote">No pending requests.</p>'
        + (done.length ? `<ul class="slist dim">${done.map(r => `<li>${esc(nameOf(r.by))} · ${r.kind} · <small class="st-${r.status}">${r.status}</small></li>`).join('')}</ul>` : ''))
      + group('Snapshots', `<div class="snew"><input class="snapname" placeholder="Snapshot name" maxlength="60"><button class="sbtn primary" data-act="snap">${icon('copy', 15)} Save this area</button></div>${snaps.length ? `<ul class="slist">${snaps.map((s, i) => `<li data-snap="${i}"><b>${esc(s.name)}</b><small>${esc(s.areaName)} · ${new Date(s.at).toLocaleString()} · ${s.n ?? Object.keys(s.entities || {}).length} things</small><button class="sbtn" data-act="restore">Restore</button><button class="sbtn danger" data-act="unsnap">${icon('trash-2', 15)}</button></li>`).join('')}</ul>` : ''}`, 'Kept on the server for this campaign (any of your devices). Restoring replaces what is in that area now (undo brings it back).')
      + group('Export and import', `<div class="sab"><button class="sbtn primary" data-act="export">${icon('package', 15)} Export campaign JSON</button><label class="sbtn">Import JSON…<input type="file" accept=".json,application/json" class="impfile" hidden></label><button class="sbtn" disabled title="Later">glTF</button><button class="sbtn" disabled title="Later">TaleSpire</button><button class="sbtn" disabled title="Later">STL</button></div>`, 'An import adds its areas as new areas.')
      + group('Invites and seats', `${humans.length ? `<ul class="slist">${humans.map(s => `<li data-seat="${s.id}"><b>${esc(s.name)}</b><small>${s.role}${s.online ? ' · online' : ''}</small><button class="sbtn" data-act="invite">Copy invite</button><button class="sbtn danger" data-act="revoke">Revoke</button></li>`).join('')}</ul>` : '<p class="snote">No other seats yet.</p>'}
        <div class="snew"><input class="seatname" placeholder="Player name" maxlength="40"><button class="sbtn primary" data-act="newseat">${icon('user-plus', 15)} Invite a player</button></div>${lastKey ? `<p class="skey">${esc(lastKey.label)}: <code>${esc(lastKey.url)}</code></p>` : ''}`)
      + group('Agent seats', `${agents.length ? `<ul class="slist">${agents.map(s => `<li data-seat="${s.id}"><b>${esc(s.name)}</b><small>${s.online ? 'online' : 'offline'}</small><button class="sbtn" data-act="key">Copy key</button><button class="sbtn danger" data-act="revoke">Revoke</button></li>`).join('')}</ul>` : ''}
        <div class="scls">${cls.map(k => `<label class="schk"><input type="checkbox" data-cls="${k}"${['token.move', 'token.edit', 'object', 'open', 'chat', 'pawn'].includes(k) ? ' checked' : ''}> ${CLASS_LABELS[k]}</label>`).join('')}</div>
        <div class="snew"><input class="gmagent" placeholder="Agent name" maxlength="40"><button class="sbtn primary" data-act="gmagent">${icon('bot', 15)} Create agent seat</button></div>${newAgent ? `<p class="skey">Key for ${esc(newAgent.name)}: <code>${esc(newAgent.url)}</code></p>` : ''}`, 'LLM seats with exactly the permissions ticked (never more than yours).');
  }

  // ---------- wiring ----------
  const $$ = (s) => [...modal.querySelectorAll(s)];
  const dispatchC = (type, args) => app.sync.submit(type, args);
  function wire(sec) {
    if (sec === 'feedback') {
      const root = modal.querySelector('.fbroot'), preset = fbPreset || (lastSec !== 'feedback' ? { fresh: true } : null); fbPreset = null;
      loadFb().then(m => { if (root.isConnected) m.mountFeedback(app, root, preset); }).catch(e => { root.innerHTML = `<p class="snote">Feedback could not load (${esc(e.message)}). Reload the page and try again.</p>`; });
    }
    lastSec = sec;
    act('fog-reset', () => app.fog.reset());
    act('fog-reveal', () => app.fog.revealHere());
    // prefs (Me): toggles, ranges, selects
    for (const el of $$('[data-pref]')) {
      const k = el.dataset.pref;
      if (el.classList.contains('stog')) el.onclick = () => { setPref(k, k === 'farGlow' ? !app.gfx?.farGlow?.() : !prefs[k]); render(); }; // (farGlow: 'auto' until chosen; the switch shows what is in effect)
      else if (el.type === 'range') el.oninput = () => { el.nextElementSibling.textContent = (+el.value).toFixed(+el.step < 1 ? 2 : 0); setPref(k, +el.value); };
      else el.onchange = () => { setPref(k, el.value); render(); };
    }
    // rules (Area / Defaults)
    for (const el of $$('[data-rule]')) {
      const k = el.dataset.rule, scope = el.dataset.scope;
      const send = (v) => scope === 'area' ? dispatchC('area.set', { area: app.area(), settings: { [k]: v } }) : dispatchC('campaign.set', { defaults: { [k]: v } });
      if (el.classList.contains('stog')) el.onclick = () => { send(!el.classList.contains('on')); };
      else el.onchange = () => send(el.value);
    }
    for (const el of $$('[data-reset]')) el.onclick = () => el.dataset.scope === 'area' ? dispatchC('area.set', { area: app.area(), settings: { [el.dataset.reset]: null } }) : dispatchC('campaign.set', { defaults: { [el.dataset.reset]: null } });
    for (const el of $$('[data-camp]')) el.onchange = () => dispatchC('campaign.set', { defaults: { [el.dataset.camp]: el.value === '' ? null : el.value } });
    const ao = modal.querySelector('[data-areaopen]'); if (ao) ao.onclick = () => dispatchC('area.visibility', { area: app.area(), visibility: ao.classList.contains('on') ? 'hidden' : 'open' });
    for (const el of $$('[data-vision]')) el.onclick = () => dispatchC('campaign.set', { defaults: { [el.dataset.vision]: !el.classList.contains('on') } });
    const lb = modal.querySelector('[data-labels]'); if (lb) lb.onclick = () => { app.setLabels(!app.labelsOn()); render(); };
    const lr = modal.querySelector('[data-lightreach]'); if (lr) lr.onclick = () => { app.setLightReach(!app.lightReach()); render(); };
    const tv = modal.querySelector('[data-travel]'); if (tv) tv.onclick = () => dispatchC('campaign.set', { defaults: { travelLocked: tv.classList.contains('on') } });
    const campname = modal.querySelector('.campname'); if (campname) campname.onchange = () => campname.value.trim() && dispatchC('campaign.set', { name: campname.value.trim() });
    // navigation
    for (const li of $$('.sarea')) {
      const id = li.dataset.area;
      // opening from here starts on the view the picture was taken from (thumbs.js enter); in the PiP that view is held
      // (pinned) rather than following the pawns, until you move it. Clicking the picture is "Open here".
      const here = () => { app.setMain(id); app.thumbs?.enter(app.main, id); close(); };
      li.querySelector('[data-act=here]').onclick = here;
      const th = li.querySelector('.sthumb'); if (th) { th.style.cursor = 'pointer'; th.title = 'Open here'; th.onclick = here; }
      const vb = li.querySelector('[data-act=vis]'); if (vb) vb.onclick = () => dispatchC('area.visibility', { area: id, visibility: li.dataset.vis === 'hidden' ? 'open' : 'hidden' });
      li.querySelector('[data-act=pip]').onclick = () => { app.openPip(id); if (app.thumbs) { app.pip.rule = 'pinned'; app.thumbs.enter(app.pip, id); } render(); };
      const del = li.querySelector('[data-act=del]'); if (del) del.onclick = () => { if (confirmDel === id) { confirmDel = null; dispatchC('area.delete', { area: id }); } else confirmDel = id; render(); };
      const nm = li.querySelector('.aname'); if (nm) nm.onchange = () => nm.value.trim() && dispatchC('area.set', { area: id, name: nm.value.trim() });
    }
    act('create', () => { const n = modal.querySelector('.newname').value.trim() || `Area ${(C()?.areas.length || 0) + 1}`; dispatchC('area.create', { id: newId('area'), name: n }); });
    // me ▸ my pawns
    act('pawn-new', () => { startPawnEdit('new'); scrollTo = '.mped'; render(); });
    act('pawn-cancel', () => { pawnEdit = null; picker = null; render(); });
    act('pawn-save', () => savePawn());
    act('pawn-nofig', () => { pawnEdit.fig = ''; render(); });
    for (const li of $$('li[data-def]')) {
      li.querySelector('[data-act=pawn-edit]').onclick = () => { startPawnEdit(li.dataset.def); scrollTo = '.mped'; render(); };
      li.querySelector('[data-act=pawn-forget]').onclick = () => { if (pawnEdit?.id === li.dataset.def) { pawnEdit = null; picker = null; } dispatchC('pawn.forget', { id: li.dataset.def }); };
    }
    if (pawnEdit && picker) {
      const ed = modal.querySelector('.mped');
      if (ed) {
        picker.wire(ed.querySelector('.mptree'));
        const bind = (sel, k, after) => { const el = ed.querySelector(sel); if (el) el.oninput = el.onchange = () => { pawnEdit[k] = el.value; after?.(); }; };
        bind('.mpname', 'name', () => { pawnEdit.named = true; }); bind('.mpsheet', 'sheet'); bind('.mpnotes', 'notes'); bind('.mppet', 'petOf'); bind('.mpdark', 'darkvision'); bind('.mplight', 'lightCarried');
        const mt = ed.querySelector('[data-mpmain]'); if (mt) mt.onclick = () => { pawnEdit.main = !pawnEdit.main; render(); };
        ed.querySelector('.mpname').onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); savePawn(); } };
      }
    }
    // me
    const myname = modal.querySelector('.myname'); if (myname) myname.onchange = () => myname.value.trim() && dispatchC('seat.set', { who: app.me(), name: myname.value.trim() });
    const mycolor = modal.querySelector('.mycolor'); if (mycolor) mycolor.onchange = () => dispatchC('seat.set', { who: app.me(), color: mycolor.value });
    const rl = modal.querySelector('.reload'); if (rl) rl.onclick = (ev) => { ev.preventDefault(); location.reload(); };
    const gg = modal.querySelector('.gomegfx'); if (gg) gg.onclick = (ev) => { ev.preventDefault(); section = 'me'; scrollTo = '.gfxtop'; render(); };
    const gu = modal.querySelector('.gfxuse'); if (gu) gu.onclick = (ev) => { ev.preventDefault(); setGfx(gu.dataset.gfx); };
    act('reset', () => S.resetPrefs());
    act('agent', async () => { const name = modal.querySelector('.agentname').value.trim() || `${C()?.my.name}'s agent`; const classes = (C()?.my.classes || []).filter(k => !AGENTS_NEVER.has(k)); await makeAgent(name, classes); });
    act('gmagent', async () => { const name = modal.querySelector('.gmagent').value.trim() || 'GM assistant'; const classes = $$('[data-cls]').filter(x => x.checked).map(x => x.dataset.cls); if (!classes.length) { app.toast('Tick at least one permission', true); return; } await makeAgent(name, classes); });
    for (const li of $$('li[data-seat]')) {
      const id = li.dataset.seat;
      li.querySelector('[data-act=revoke]')?.addEventListener('click', () => dispatchC('seat.revoke', { who: id }));
      li.querySelector('[data-act=key]')?.addEventListener('click', async () => { const t = await reissue(id); if (t) copy(app.cardUrl(t), 'Agent key copied'); });
      li.querySelector('[data-act=invite]')?.addEventListener('click', async () => { const t = await reissue(id); if (t) copy(app.inviteLink(t), 'Invite link copied'); });
    }
    act('newseat', async () => { const name = modal.querySelector('.seatname').value.trim() || 'Player'; const t = await app.createSeat({ kind: 'human', role: 'player', name, color: randomColor() }); if (t) { lastKey = { label: `Invite for ${name}`, url: app.inviteLink(t) }; copy(lastKey.url, 'Invite link copied'); render(); } });
    // requests (player side) and approvals (GM)
    act('req-export', () => dispatchC('request.create', { id: newId('req'), kind: 'export' }));
    const rf = modal.querySelector('.reqfile'); if (rf) rf.onchange = async () => { const data = await readJsonFile(rf.files[0]); if (data) dispatchC('request.create', { id: newId('req'), kind: 'import', note: rf.files[0].name.slice(0, 60), payload: data }); };
    for (const li of $$('li[data-req]')) {
      const r = (C()?.requests || []).find(x => x.id === li.dataset.req);
      li.querySelector('[data-act=approve]').onclick = async () => { if (r.kind === 'import' && r.payload) await importData(r.payload); dispatchC('request.resolve', { id: r.id, ok: true }); };
      li.querySelector('[data-act=deny]').onclick = () => dispatchC('request.resolve', { id: r.id, ok: false });
    }
    // snapshots, export, import (GM)
    act('snap', async () => { const v = app.view(); if (!v) return; const n = listSnaps().length; const ok = await postSnap({ name: modal.querySelector('.snapname').value.trim() || `Snapshot ${n + 1}`, area: app.area(), areaName: app.areaName(app.area()), entities: v.entities }); if (ok) { app.toast('Snapshot saved'); refreshSnaps(); } });
    for (const li of $$('li[data-snap]')) {
      const s0 = listSnaps()[+li.dataset.snap];
      li.querySelector('[data-act=restore]').onclick = async () => { const full = await getSnap(s0?.id); if (full) restoreSnap(full); };
      li.querySelector('[data-act=unsnap]').onclick = async () => { await snapReq(`/${s0.id}/delete`, { method: 'POST' }); refreshSnaps(); };
    }
    act('export', () => exportJson());
    const imp = modal.querySelector('.impfile'); if (imp) imp.onchange = async () => { const data = await readJsonFile(imp.files[0]); if (data) await importData(data); };
  }
  const act = (name, fn) => { for (const el of $$(`[data-act="${name}"]`)) if (!el.closest('li[data-seat], li[data-req], li[data-snap], li.sarea, li[data-def]')) el.onclick = fn; };
  const copy = (text, msg) => { try { navigator.clipboard.writeText(text); } catch { } app.toast(msg); S.lastCopied = text; };
  const randomColor = () => ['#6fc36f', '#6fa8dc', '#e06c75', '#c58be0', '#e5c07b', '#56b6c2'][Math.floor(Math.random() * 6)];
  async function makeAgent(name, classes) {
    const t = await app.createSeat({ kind: 'llm', name, scope: { classes, areas: '*' } });
    if (!t) return;
    newAgent = { name, url: app.cardUrl(t) }; copy(newAgent.url, 'Agent key copied'); render();
  }
  // re-issue a seat's token (the relay: GM, or the seat's creator)
  async function reissue(id) {
    try { const r = await fetch(`${app.relayBase}/c/${C().id}/token?seat=${encodeURIComponent(app.sync.token)}&for=${id}`).then(r => r.json()); return r.token || null; } catch { app.toast('Could not get the key', true); return null; }
  }

  // ---------- snapshots (this browser), export, import ----------
  // snapshots live on the relay, per campaign, GM only (relay/server.js /c/<id>/snapshots): they follow the GM between devices.
  // Snapshots an older build kept in this browser are moved up to the relay the first time the list loads.
  const snapKey = () => `tw.snaps.${C()?.id || '-'}`;
  let snapList = [], snapFor = null;
  const snapReq = (rest = '', opts = {}) => fetch(`${app.relayBase}/c/${C().id}/snapshots${rest}?seat=${encodeURIComponent(app.sync.token)}`, opts).then(r => r.json()).catch(() => ({ ok: false, why: 'the relay could not be reached' }));
  // (text/plain: a simple request, no CORS preflight; the relay parses the JSON body either way)
  async function postSnap(snap) { const r = await snapReq('', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(snap) }); if (!r.ok) app.toast(r.why || 'Could not save the snapshot', true); return r.ok; }
  async function getSnap(id) { const r = await snapReq(`/${id}`); if (!r.ok) app.toast(r.why || 'Could not load the snapshot', true); return r.ok ? r.snapshot : null; }
  async function refreshSnaps() {
    const cid = C()?.id; if (!cid || !app.gm()) return;
    let local = []; try { local = JSON.parse(localStorage.getItem(snapKey()) || '[]'); } catch { }
    if (local.length) { let moved = 0; for (const x of local) if (await postSnap(x)) moved++; if (moved === local.length) try { localStorage.removeItem(snapKey()); } catch { } }
    const r = await snapReq(); if (C()?.id !== cid) return;
    snapList = r.ok ? r.snapshots : []; snapFor = cid; S.snapsLoaded = true; if (S.isOpen) render();
  }
  function listSnaps() { if (snapFor !== C()?.id && app.gm?.()) { snapFor = C()?.id; snapList = []; refreshSnaps(); } return snapList; }
  S.refreshSnaps = refreshSnaps; S.snaps = () => snapList; // (tests)
  function restoreSnap(s) {
    if (!s) return;
    const area = s.area && C()?.areas.some(a => a.id === s.area) ? s.area : app.area();
    const now = app.entities(area), set = {};
    for (const id of Object.keys(now)) if (!s.entities[id]) set[id] = null;
    Object.assign(set, s.entities);
    chunks(set).forEach(part => app.sync.submit('entities.set', { set: part }, area));
    app.toast(`Restored “${s.name}”`);
  }
  function chunks(set, max = 300000) { // entities.set takes at most ~400 kB per command
    const out = []; let cur = {}, n = 0;
    for (const [k, v] of Object.entries(set)) { const sz = JSON.stringify(v).length + k.length; if (n + sz > max && n) { out.push(cur); cur = {}; n = 0; } cur[k] = v; n += sz; }
    if (Object.keys(cur).length) out.push(cur);
    return out;
  }
  // everything this seat can see, as one JSON file: { v, name, areas: [{ name, visibility, settings, entities }] }
  async function exportJson() {
    const c = C(); const areas = [];
    for (const a of c.areas) {
      let v = app.sync.view(a.id);
      if (!v) { app.sync.subscribe(a.id); for (let i = 0; i < 40 && !app.sync.view(a.id); i++) await new Promise(r => setTimeout(r, 100)); v = app.sync.view(a.id); if (a.id !== app.area() && a.id !== app.pip?.area) app.sync.unsubscribe(a.id); }
      areas.push({ name: a.name, visibility: a.visibility, settings: a.settings || {}, entities: v?.entities || {} });
    }
    const data = { v: 1, kind: 'turnip-works-campaign', name: c.name, exportedAt: new Date().toISOString(), areas };
    S.lastExport = data;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${c.name.replace(/[^\w-]+/g, '-')}.turnipworks.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    app.toast('Exported');
  }
  async function readJsonFile(f) { if (!f) return null; try { const d = JSON.parse(await f.text()); if (!Array.isArray(d?.areas)) throw 0; return d; } catch { app.toast('That is not a Turnip Works campaign file', true); return null; } }
  async function importData(d) {
    for (const a of d.areas || []) {
      const id = newId('area');
      await app.await(app.sync.submit('area.create', { id, name: String(a.name || 'Imported').slice(0, 60) })); // (an imported area arrives hidden, like any new one)
      if (a.settings && Object.keys(a.settings).length) app.sync.submit('area.set', { area: id, settings: a.settings });
      const ents = a.entities || {};
      if (Object.keys(ents).length) { app.sync.subscribe(id); for (const part of chunks(ents)) await app.await(app.sync.submit('entities.set', { set: part }, id)); }
    }
    app.toast(`Imported ${(d.areas || []).length} area(s)`);
  }
  S.importData = importData; S.exportJson = exportJson; // (tests)

  // ---------- applying personal prefs ----------
  const applied = { faces: app.facesUsed || null };
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { } }
  function setPref(k, v) {
    if (k === 'gfx') return setGfx(v);
    if (k === 'maxFps' || k === 'idleFps') v = +v || 0;
    prefs = { ...prefs, [k]: v };
    if (GFX_KEYS.includes(k)) prefs.gfx = presetOf(prefs) === prefs.gfx ? prefs.gfx : 'custom'; // one switch changed by hand: the preset is now Custom (Auto no longer steers)
    if (k === 'graphics') { if (!new URLSearchParams(location.search).has('faces') && GRAPHICS[v] && app.setFaces?.(GRAPHICS[v].faces)) applied.faces = GRAPHICS[v].faces; } // the detail tier swaps in place, no reload
    savePrefs(); applyPrefs();
  }
  // Me ▸ Graphics ▸ Quality. A named preset writes its switches; Auto starts again from High and measures; Custom
  // keeps the switches as they are.
  function setGfx(name) {
    if (GFX_PRESETS[name]) prefs = { ...prefs, ...GFX_PRESETS[name], gfx: name };
    else if (name === 'auto') { prefs = { ...prefs, ...GFX_PRESETS.high, gfx: 'auto', gfxAuto: 'high' }; app.gfx?.restartAuto?.(); }
    else prefs = { ...prefs, gfx: 'custom' };
    savePrefs(); applyPrefs(); if (S.isOpen) render();
  }
  // (graphics.js) Auto's own pick: the preset stays Auto, the switches follow the pick, and it is remembered
  function setAuto(name) { if (!GFX_PRESETS[name] || prefs.gfx !== 'auto') return; prefs = { ...prefs, ...GFX_PRESETS[name], gfxAuto: name }; savePrefs(); applyPrefs(); if (S.isOpen) render(); }
  function applyPrefs() {
    const root = document.documentElement;
    root.style.setProperty('--ts', prefs.textScale);
    root.classList.toggle('reduce-motion', !!prefs.reducedMotion);
    root.classList.toggle('no-cutfly', prefs.cutFly === false); // Me ▸ Levels fly away (cutfly.js reads the class)
    setRingScale?.(prefs.ringScale);
    app.prefs = prefs;
    app.gfx?.apply?.(); // Me ▸ Graphics: the render resolution and every world's switches (graphics.js)
    app.library?.relayout?.(); // Me ▸ Library: everything the same size
    patchCamera();
    applyWorlds(true);
    app.refresh?.();
  }
  // camera: zoom and rotate speed / invert, on every GrabCamera (main, PiP, library)
  let patched = false;
  function patchCamera() {
    const G = T.camera?.GrabCamera?.prototype; if (!G || patched) return; patched = true;
    const zoomAt = G.zoomAt, dragTo = G.dragTo;
    G.zoomAt = function (x, y, f) { const p = app.prefs || PREF_DEFAULTS; return zoomAt.call(this, x, y, Math.pow(f, p.zoomSpeed * (p.invertZoom ? -1 : 1))); };
    G.dragTo = function (x, y) {
      const g = this.grab, p = app.prefs || PREF_DEFAULTS;
      if (g?.mode === 'orbit') { const k = p.rotateSpeed * (p.invertRotate ? -1 : 1); g.last = { x: x - (x - g.last.x) * k, y: y - (y - g.last.y) * k }; }
      return dragTo.call(this, x, y);
    };
  }
  // per world: others' cursors, the lighting stack, the area's lighting profile and grid, the house look
  let lightMod = null;
  const noPost = new URLSearchParams(location.search).has('nopost'); // tests and slow machines: the lighting stack stays off
  import(`${T.base}js/fx/lighting.js${T.v && T.v !== 'dev' ? `?v=${T.v}` : ''}`).then(m => { lightMod = m; applyWorlds(true); }).catch(() => {});
  function applyWorlds(force = false) {
    const c = C(); if (!c) return;
    const d = c.defaults || {};
    if (d.houseAnim && T.anim?.BUILTIN_PRESETS?.[d.houseAnim] && applied.anim !== d.houseAnim) { applied.anim = d.houseAnim; T.house.anim = T.anim.BUILTIN_PRESETS[d.houseAnim](); }
    if (applied.selection !== (d.houseSelection || '')) { applied.selection = d.houseSelection || ''; if (d.houseSelection) { T.house.selection = { ...(T.house.selection || {}), selected: { ...(T.house.selection?.selected || {}), style: d.houseSelection } }; } }
    for (const [id, w] of app.worlds) {
      if (id.startsWith('lib:')) continue;
      if (w.layers?.cursors) w.layers.cursors.visible = !!prefs.cursors;
      app.gfx?.applyWorld?.(w); // Me ▸ Graphics: this seat's own switches, Fog and mist among them (graphics.js; fx/atmos.js setOff: nothing drawn, nothing simulated)
      if (T.house.anim && w.preset !== T.house.anim) w.preset = T.house.anim;
      if (w.selFx && T.house.selection && w.selSet !== applied.selection) { w.selSet = applied.selection; try { w.selFx.set(noGlow(T.house.selection)); } catch { } }
      const a = c.areas.find(x => x.id === id), rules = { ...BUILTIN_RULES, ...pickRules(d), ...(a?.settings || {}) };
      if (w.grid) w.grid.visible = rules.grid !== false;
      if (w.fx) {
        const prof = rules.light === 'house' ? (d.houseLight || 'house') : rules.light;
        const want = `${prof}|${prefs.post}`;
        if ((force || w.lightKey !== want) && (prof === 'house' || lightMod)) {
          const L = prof === 'house' ? T.house.lighting : lightMod.LIGHT_BUILTINS[prof]?.();
          try { if (L) w.fx.setParams('lighting', L); else if (prof === 'house' && lightMod) w.fx.setParams('lighting', lightMod.LIGHT_BUILTINS.night()); w.fx.lighting.params.on = !!prefs.post && !noPost; w.fx.lighting.apply(); w.lightKey = want; w.lightProfile = prof; } catch { }
        }
      }
    }
  }
  const pickRules = (d) => Object.fromEntries(Object.entries(d).filter(([k]) => k in BUILTIN_RULES));
  app.on((what) => { if (what === 'refresh' || what === 'change') applyWorlds(); });

  // ---------- requests: the GM hears about new ones (toast + a dot on the gear) ----------
  const pendingCount = () => app.gm() ? (C()?.requests || []).filter(r => r.status === 'pending').length : 0;
  const seenReq = new Set(); let reqPrimed = false;
  function badge() {
    const n = pendingCount(); const dot = b.querySelector('.dot'); if (dot) { dot.hidden = !n; dot.textContent = n || ''; }
    if (!app.gm()) return;
    for (const r of C()?.requests || []) {
      if (r.status !== 'pending' || seenReq.has(r.id)) continue;
      seenReq.add(r.id);
      if (reqPrimed) app.toast(`${C().seats.find(s => s.id === r.by)?.name || 'A player'} asks to ${r.kind}: Settings ▸ Campaign admin`);
    }
    if (C()) reqPrimed = true;
  }

  // No landing screen (Harry 2026-10-05): opening the game goes straight into the game (the area the seat was last in,
  // else the campaign's default area). "Always open on World navigation" is about this WINDOW: open() above.

  R.add({ id: 'settings.menu', keys: ['S'], title: 'Settings…', synonyms: ['settings', 'preferences', 'options', 'config', 'areas', 'navigation'], icon: 'layout-grid', group: 'Settings', run: () => S.toggle() });
  applyPrefs();
  return { name: 'settings' };
}
