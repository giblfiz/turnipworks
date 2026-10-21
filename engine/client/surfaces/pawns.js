// THE PAWNS MENU (Harry and Fauna, 2026-10-06; docs/PAWNS.md). The leftmost launcher (P): Pawns, Build, Settings.
// "This needs to look a lot more like the build menu than the settings menu ... this is where people who don't really
// 'read so good' go": pictures first (figure thumbnails as portraits, icons with hover names), few words, the Build
// tray's tiles, chips and tree. It is one tray under the launchers; what is in it depends on who is looking.
//   PARTY         one wide row per player: the portrait (click: go to that pawn), the player's and the pawn's names,
//                 small action icons under the name (each with a hover name), the damage number and condition marks on
//                 the row, pets and familiars as smaller portraits in the same row. Rows group by area when the party is
//                 split. Drag a row to set the marching order. Party notes are behind one icon.
//   MINE          my pawns on the tables, my bench (defined, not on a table: bring on, send back), "New pawn" (the door
//                 to Settings ▸ Me ▸ My pawns). Each tile's ⋯: go to, travel, send back, lend, edit.
//   THE CAST      (GM) named individuals and saved groups, the most recent first, the rest behind "All the cast";
//                 "Save as group" while several pawns are selected. Never sent to a player (core/party.js).
//   PLACE A PAWN  (GM) the tree of minis: kind ▸ family ▸ a grid of thumbnails (client/pawntree.js, surfaces/figtree.js),
//                 and a search button that hands over to the command bar
//   ON THE TABLE  every pawn here that is nobody's, by kind, with a count and the damage; go to; select all of a kind;
//                 the GM's hidden ones in the hidden look, with Reveal. Players get it from what they were sent.
//   TURN ORDER    when the area has one (area.turns: docs/PAWNS.md "The shared shape of a turn order"), the party rows
//                 and the kinds are ONE list in that order, with a marker on whose turn it is; the GM drags it.
// Every row or tile that has a key shows its key (Harry: "the menu is also a place to show what the hotkeys are").
// Opening and staying open: hold, tap, pin (surfaces/tray.js).
// The party's pawns come from the campaign view (core/party.js partyPawns: every area this seat can see), overlaid
// with the live pawns of the area in the main view, so a row is right at once and right for a pawn elsewhere.
import { icon } from '../icons.js';
import { playerPortrait } from '../portraits.js';
import { markUrl } from '../marks.js';
import * as HT from '../../core/height.js';
import { REGISTRY } from '../../core/commands.js';
import { pawnKind, pawnKindLabel } from '../../core/pawn.js';
import { newId } from '../../core/ids.js';
import { figTree } from './figtree.js';
import { withTemplates, leftOf } from '../../core/turns.js';
import { templateName } from '../../core/measure.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const NOTES_MAX = 4000;

export function pawnsSurface(R, app) {
  const launch = document.getElementById('launchers'), tray = document.getElementById('pawnsTray');
  const b = document.createElement('button');
  b.className = 'launcher'; b.dataset.l = 'pawns'; b.title = 'Pawns (P)'; b.setAttribute('aria-label', 'Pawns');
  b.innerHTML = `<img class="lic" src="data/icons/tool-pawns.png?v=${window.TW_V || 'dev'}" alt="" width="40" height="40"><span class="lcap">Pawns</span><kbd>P</kbd>`;
  b.querySelector('img').onerror = (ev) => { ev.target.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon('users', 30) })); };
  launch.prepend(b); // Pawns, Build, Settings (the Build surface made its button first)
  const F = app.figures, C = () => app.sync.campaign;
  const P = app.pawns = {
    isOpen: false, open: () => open(), close: () => close(), toggle: () => P.isOpen ? close() : open(),
    ownsKey: (k) => k !== 'p' && keymap.has(k), // (surfaces/tray.js) a letter that is an item's here; P never is
    state: () => state(),
  };
  b.onclick = (ev) => { ev.stopPropagation(); P.toggle(); };
  app.tray.register('pawns', () => tray);
  let notesOpen = false, pop = null, keymap = new Map(), follow = null, view = 'home', castAll = false, goCycle = new Map();
  const RECENT_CAST = 6;

  // ---------------- data ----------------
  const seatOf = (id) => C()?.seats.find(s => s.id === id) || null;
  const people = () => (C()?.seats || []).filter(s => s.kind === 'human');
  const figOf = (rec) => rec?.fig ? F.get(rec.fig) : null;
  const thumbOf = (rec) => { const f = figOf(rec); return f ? F.thumbUrl(f) : null; };
  // every pawn that belongs to a person: the campaign view's list, with this area's pawns as they are right now
  function partyPawns() {
    const here = app.area(), live = app.view(here), out = new Map();
    for (const p of C()?.party?.pawns || []) if (!(live && p.area === here)) out.set(p.id, p);
    if (live) for (const e of Object.values(live.entities)) if (e.kind === 'token' && e.owner && seatOf(e.owner)) out.set(e.id, { ...e, area: here });
    return [...out.values()];
  }
  const sortPawns = (list) => list.slice().sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || (a.name || '').localeCompare(b.name || '') || (a.id < b.id ? -1 : 1));
  // the rows: every player (in the marching order, then as they joined), then the GM
  function rows() {
    const c = C(); if (!c) return [];
    const all = partyPawns(), order = c.party?.order || [];
    const seats = people().slice().sort((a, b) => (a.role === 'gm') - (b.role === 'gm') || ((order.indexOf(a.id) + 1) || 999) - ((order.indexOf(b.id) + 1) || 999));
    return seats.map(s => {
      const mine = sortPawns(all.filter(p => p.owner === s.id)), main = mine[0] || null;
      return { seat: s, main, pets: mine.slice(1), area: main?.area || s.location || null, me: s.id === app.me() };
    });
  }

  // ---------------- doing things ----------------
  const whenLoaded = (area, id, fn, tries = 80) => { if (app.area() === area && app.entities()[id]) return fn(); if (tries > 0) setTimeout(() => whenLoaded(area, id, fn, tries - 1), 50); };
  // GO TO a pawn: the view centres on it (in its own area, on its own level) and it is selected
  function goTo(rec) {
    if (!rec) return;
    const land = () => {
      const e = app.entities()[rec.id]; if (!e) return;
      const fy = HT.floorUnder(app.entities(), e.x, e.z, e.y || 0)?.y ?? 0;
      if (app.cut?.y != null && fy > app.cut.y + 0.5) app.goLevel?.(fy, 'pawns');
      app.centreOn({ x: e.x, y: e.y || 0, z: e.z });
      app.select(e.id);
      P.lastGo = { id: e.id, area: app.area(), at: performance.now() }; // (tests)
    };
    if (rec.area && rec.area !== app.area()) { app.setMain(rec.area); whenLoaded(rec.area, rec.id, land); } else land();
  }
  // FOLLOW: lock my view to that pawn (it stays in the middle; zoom and heading are still mine), or, for a pawn in
  // another area (or with Shift), open it in the picture-in-picture, which follows that person's pawns
  const pill = document.createElement('div'); pill.id = 'followPill'; pill.hidden = true; document.getElementById('app').append(pill);
  pill.addEventListener('mousedown', (ev) => ev.preventDefault());
  pill.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  pill.onclick = () => stopFollow();
  function stopFollow() { if (!follow) return false; follow = null; pill.hidden = true; if (P.isOpen) render(); app.refresh(); }
  function startFollow(rec, { pip = false } = {}) {
    if (!rec) return;
    if (pip || rec.area !== app.area()) { app.openPip(rec.area, { owner: rec.owner }); P.lastFollow = { how: 'pip', id: rec.id, area: rec.area }; return; }
    if (follow?.id === rec.id) return stopFollow();
    follow = { id: rec.id, area: rec.area, name: rec.name };
    pill.innerHTML = `${icon('eye', 15)}<span>Following <b>${esc(rec.name)}</b></span><i>${icon('x', 13)}</i>`; pill.title = 'Your view is locked to this pawn. Click (or Esc) to stop'; pill.hidden = false;
    app.escapeStack.push(() => follow ? (stopFollow(), true) : false);
    P.lastFollow = { how: 'main', id: rec.id, area: rec.area };
    if (P.isOpen) render();
  }
  app.on((what) => {
    if (what !== 'frame' || !follow) return;
    if (app.area() !== follow.area) return stopFollow();
    const w = app.worlds.get(follow.area), r = w?.recs.get(follow.id);
    if (!r) { if (app.view(follow.area) && !app.entities()[follow.id]) stopFollow(); return; }
    const g = app.main.grab, p = r.group.position, k = 0.18;
    if (Math.hypot(p.x - g.focus.x, p.z - g.focus.z) < 0.01) return;
    g.focus.x += (p.x - g.focus.x) * k; g.focus.z += (p.z - g.focus.z) * k; g.update();
  });
  P.following = () => follow && { ...follow };
  P.follow = (id) => { const e = app.entities()[id]; if (e) startFollow({ ...e, area: app.area() }); };
  // the GM's chores on a row
  const tok = (rec) => ({ id: rec.id, kind: 'token', name: rec.name });
  function bringHere(row) {
    const list = [row.main, ...row.pets].filter(Boolean), here = app.area();
    const away = list.filter(p => p.area !== here);
    if (away.length) { for (const from of new Set(away.map(p => p.area))) app.travel(away.filter(p => p.area === from).map(tok), here, from, { follow: false }); return; }
    // already in this area: to the middle of my view, side by side
    const f = app.main.grab.focus, y = app.level || 0, ops = []; let n = 0;
    for (const p of list) { const e = app.entities()[p.id]; if (!e) continue; const [x, z] = app.pawnFormation(f.x + n * 5, f.z, { size: F.sizeOf(e), n: 1, y })[0]; ops.push({ type: 'token.move', args: { id: e.id, x, z, y } }); n += F.sizeOf(e); }
    P.lastBring = { ops, cid: ops.length ? app.batch(ops) : null }; // (tests)
  }
  function sendMenu(row, anchor) {
    const list = [row.main, ...row.pets].filter(Boolean); if (!list.length) return;
    const from = row.main.area, targets = app.travelTargets(from);
    showPop(anchor, `Send ${row.main.name} to`, targets.length ? targets.map(a => ({ label: a.name, sub: app.areaHidden?.(a.id) ? 'hidden from players' : '', icon: app.areaHidden?.(a.id) ? 'eye-off' : 'map', cls: app.areaHidden?.(a.id) ? 'hid' : '', run: () => app.travel(list.filter(p => p.area === from).map(tok), a.id, from, { follow: false }) })) : [{ label: 'There is no other area yet', icon: 'map', off: true }]);
  }
  function controlMenu(row, anchor) {
    const e = app.entities()[row.main?.id]; if (!e) return;
    showPop(anchor, `Who moves ${e.name}`, [...people().map(s => ({ label: `${s.name}${s.role === 'gm' ? ' (GM)' : ''}`, icon: e.owner === s.id ? 'check' : 'user', dot: s.color, run: () => app.giveTo(e, s.id) })), { label: 'No one (the GM moves it)', icon: e.owner ? 'x' : 'check', run: () => app.giveTo(e, '') }]);
  }
  function openSheet(rec) {
    if (rec.sheet && /^https?:\/\//i.test(rec.sheet)) { window.open(rec.sheet, '_blank', 'noopener'); P.lastSheet = rec.sheet; return; }
    // no link yet: the pawn's own card is where one is pasted (its owner or the GM)
    if (rec.area === app.area()) { goTo(rec); setTimeout(() => { const e = app.entities()[rec.id]; if (e) app.emit('ring.sheet', e); }, 450); }
  }
  // PARTY NOTES: one shared text; whoever saved last wins. Saved when the field is left, and a second after the last key.
  let notesTimer = null, notesDirty = false;
  const saveNotes = () => { clearTimeout(notesTimer); notesTimer = null; const ta = tray.querySelector('.pnotes textarea'); if (!ta || !notesDirty) return; notesDirty = false; if (ta.value !== (C()?.party?.notes || '')) app.sync.submit('party.set', { notes: ta.value.slice(0, NOTES_MAX) }); };
  // MARCHING ORDER: the rows' order, shared (party.set { order })
  const setOrder = (ids) => app.sync.submit('party.set', { order: ids });

  // ---------------- a small menu at an icon (areas, people) ----------------
  function showPop(anchor, title, items) {
    closePop();
    const el = document.createElement('div'); el.className = 'ppop';
    el.innerHTML = `<header><b>${esc(title)}</b></header>${items.map((it, i) => `<button class="ppi ${it.cls || ''}${it.off ? ' off' : ''}" data-i="${i}"${it.off ? ' disabled' : ''}>${it.dot ? `<i class="pdot" style="background:${esc(it.dot)}"></i>` : ''}${icon(it.icon || 'chevron-right', 15)}<span><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')}`;
    document.getElementById('app').append(el);
    const r = anchor.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, r.left))}px`; el.style.top = `${Math.max(8, Math.min(innerHeight - el.offsetHeight - 8, r.bottom + 4))}px`;
    for (const x of el.querySelectorAll('.ppi')) x.onclick = (ev) => { ev.stopPropagation(); const it = items[+x.dataset.i]; closePop(); it.run?.(); };
    pop = { el, title, items };
  }
  function closePop() { if (!pop) return false; pop.el.remove(); pop = null; return true; }
  addEventListener('pointerdown', (ev) => { if (pop && !pop.el.contains(ev.target)) closePop(); }, true);

  // ---------------- open / close ----------------
  function open() {
    if (P.isOpen) return;
    P.isOpen = true; b.classList.add('open');
    app.emit('pawns.open'); // (the other two close)
    render();
    app.escapeStack.push(closeIfOpen);
  }
  function close() { if (!P.isOpen) return false; saveNotes(); closePop(); P.isOpen = false; b.classList.remove('open'); tray.hidden = true; lastHtml = ''; app.emit('pawns.close'); }
  // Escape and a click outside close it, unless it is PINNED (surfaces/tray.js)
  function closeIfOpen() { if (!P.isOpen) return false; if (closePop()) return true; if (!app.tray.dismissable('pawns')) { queueMicrotask(() => P.isOpen && app.escapeStack.unshift(closeIfOpen)); return false; } close(); }
  addEventListener('pointerdown', (ev) => { if (P.isOpen && app.tray.dismissable('pawns') && !tray.contains(ev.target) && !b.contains(ev.target) && !pop?.el.contains(ev.target)) close(); }, true);
  app.on((what, d) => {
    if ((what === 'build.open' || what === 'settings.open') && P.isOpen) close();
    if (!P.isOpen) return;
    if (what === 'refresh' || what === 'change' || what === 'selection' || (what === 'tray.pin' && d === 'pawns')) render();
  });

  // ---------------- keys: a key layer of its own, like Build's ----------------
  app.keyLayers = app.keyLayers || [];
  app.keyLayers.unshift((ev) => {
    if (!P.isOpen || ev.ctrlKey || ev.metaKey || ev.altKey || !app.tray.takesKeys('pawns')) return false;
    const k = ev.key;
    if (k === 'Escape' || k === 'Enter') { if (closePop()) return true; if (!app.tray.dismissable('pawns')) return false; close(); return true; }
    if (k === 'Backspace' && view === 'tree') { tree.key('Backspace'); return true; }
    if (ev.shiftKey || !/^[a-z0-9]$/i.test(k)) return false;
    const fn = keymap.get(k.toLowerCase());
    if (fn) fn(ev);
    return true; // letters and digits belong to the open menu, as in Build
  });

  // ---------------- render ----------------
  const portrait = (rec, seat, size, cls = '') => {
    const u = thumbOf(rec);
    return u ? `<img class="pimg ${cls}" src="${esc(u)}" alt="" width="${size}" height="${size}" draggable="false">` : `<span class="pimg pfb ${cls}" style="--c:${esc(seat?.color || '#888')};width:${size}px;height:${size}px">${rec ? icon('user', Math.round(size * 0.5)) : esc((seat?.name || '?')[0].toUpperCase())}</span>`;
  };
  const statHtml = (rec) => !rec ? '' : `${rec.damage > 0 ? `<b class="pdmg" data-tip="${rec.damage} damage">${icon('heart-crack', 12)}${rec.damage}</b>` : ''}${rec.mark ? `<img class="pmark" src="${markUrl(rec.mark, 32)}" alt="${esc(rec.mark)}" data-tip="Marked: ${esc(rec.mark)}" width="16" height="16">` : ''}${(rec.conditions || []).map(c => `<i class="pcond" data-tip="${esc(c)}">${esc(c)}</i>`).join('')}${rec.hidden ? `<i class="phid" data-tip="Hidden from players">${icon('eye-off', 12)}</i>` : ''}`;
  const act = (name, ic, tip, on = false) => `<button class="pact${on ? ' on' : ''}" data-act="${name}" tabindex="-1" data-tip="${esc(tip)}" aria-label="${esc(tip)}">${icon(ic, 15)}</button>`;
  function rowHtml(row, n) {
    const { seat: s, main, pets } = row, gm = app.gm(), here = main && main.area === app.area();
    const acts = [];
    if (main && (main.sheet || (here && (gm || main.owner === app.me())))) acts.push(act('sheet', 'file-text', main.sheet ? `Sheet: open ${main.name}'s character sheet (a new tab)` : `Sheet: add ${main.name}'s character sheet`));
    if (main) acts.push(act('follow', 'eye', follow?.id === main.id ? `Stop following ${main.name}` : here ? `Follow: keep my view on ${main.name} (Shift: in a small window)` : `Follow: watch ${main.name} in a small window`, follow?.id === main.id));
    if (!row.me) acts.push(act('whisper', 'message-square-lock', `Whisper: a private line to ${s.name}`));
    if (gm && s.role !== 'gm') {
      if (main) acts.push(`<i class="psep"></i>`, act('here', 'magnet', main.area !== app.area() ? `Bring here: ${s.name}'s pawns come to this area` : `Bring here: ${main.name} comes to the middle of my view`));
      if (main && app.travelTargets?.(main.area).length) acts.push(act('send', 'door-open', `Send to another area: ${main.name}`));
      if (here) acts.push(act('control', 'gamepad-2', `Control: who moves ${main.name}`));
    }
    const key = n <= 9 && main ? String(n) : '';
    return `<div class="prow${row.me ? ' me' : ''}${s.role === 'gm' ? ' gm' : ''}${s.online ? '' : ' off'}${main ? '' : ' none'}" data-seat="${s.id}" style="--c:${esc(s.color || '#888')}">
      <button class="pface" data-go="${main ? esc(main.id) : ''}" tabindex="-1"${main ? ` data-tip="Go to ${esc(main.name)}"` : ''} aria-label="${main ? `Go to ${esc(main.name)}` : esc(s.name)}"${main ? '' : ' disabled'}>${playerPortrait(app, s)}${key ? `<kbd>${key}</kbd>` : ''}</button>
      <div class="pmain"><div class="pwho"><small>${esc(s.name)}${s.role === 'gm' ? ' · GM' : ''}${row.me ? ' · you' : ''}</small><span class="pstat">${statHtml(main)}</span></div>
        <div class="pname">${main ? esc(main.name) : `<em>${s.role === 'gm' ? 'runs the game' : 'no pawn on a table'}</em>`}</div>
        <div class="pacts">${acts.join('')}</div></div>
      ${pets.length ? `<div class="ppets">${pets.slice(0, 4).map(p => `<button class="ppet" data-go="${esc(p.id)}" tabindex="-1" data-tip="${esc(p.name)}${p.damage > 0 ? ` · ${p.damage} damage` : ''}${(p.conditions || []).length ? ` · ${esc(p.conditions.join(', '))}` : ''} (${esc(s.name)}'s): go to it" aria-label="Go to ${esc(p.name)}">${portrait(p, s, 30)}${p.damage > 0 ? `<b>${icon('heart-crack', 8)}${p.damage}</b>` : ''}</button>`).join('')}${pets.length > 4 ? `<span class="pmore" data-tip="${esc(pets.slice(4).map(p => p.name).join(', '))}">+${pets.length - 4}</span>` : ''}</div>` : ''}
    </div>`;
  }
  function partyHeadOnly() {
    const notes = C()?.party?.notes || '';
    return `<header class="blevel"><b>Party</b><button class="phbtn${notesOpen ? ' on' : ''}${notes ? ' has' : ''}" data-notes tabindex="-1" data-tip="Party notes: one page everyone at the table can read and write" aria-label="Party notes">${icon('notebook-pen', 16)}<span>Notes</span><kbd>O</kbd></button></header>${notesOpen ? `<div class="pnotes"><textarea maxlength="${NOTES_MAX}" placeholder="Party notes: everyone can read and write here" spellcheck="false">${esc(notes)}</textarea></div>` : ''}`;
  }
  function partyHtml() {
    const rs = rows(), c = C(), players = rs.filter(r => r.seat.role !== 'gm');
    const areas = [...new Set(players.map(r => r.area).filter(Boolean))], split = areas.length > 1;
    let n = 0, out = '';
    const numbered = (list) => list.map(r => rowHtml(r, ++n)).join('');
    if (split) {
      // the party is split: rows group by area, this area first
      areas.sort((a, b) => (b === app.area()) - (a === app.area()) || c.areas.findIndex(x => x.id === a) - c.areas.findIndex(x => x.id === b));
      for (const a of areas) out += `<div class="parea${app.areaHidden?.(a) ? ' hid' : ''}" data-area="${esc(a)}">${icon(app.areaHidden?.(a) ? 'eye-off' : 'map', 13)}<b>${esc(app.areaName(a))}</b>${a === app.area() ? '<small>here</small>' : ''}${app.areaHidden?.(a) ? '<small>hidden from players</small>' : ''}</div>${numbered(players.filter(r => r.area === a))}`;
      const nowhere = players.filter(r => !r.area); if (nowhere.length) out += `<div class="parea">${icon('users', 13)}<b>Not on a table</b></div>${numbered(nowhere)}`;
    } else out += numbered(players);
    out += rs.filter(r => r.seat.role === 'gm').map(r => rowHtml(r, ++n)).join('');
    const notes = c?.party?.notes || '';
    return `<header class="blevel"><b>Party</b><button class="phbtn${notesOpen ? ' on' : ''}${notes ? ' has' : ''}" data-notes tabindex="-1" data-tip="Party notes: one page everyone at the table can read and write" aria-label="Party notes">${icon('notebook-pen', 16)}<span>Notes</span><kbd>O</kbd></button></header>
      ${notesOpen ? `<div class="pnotes"><textarea maxlength="${NOTES_MAX}" placeholder="Party notes: everyone can read and write here" spellcheck="false">${esc(notes)}</textarea></div>` : ''}
      <div class="prows">${out || '<p class="pempty">Nobody has joined yet</p>'}</div>`;
  }

  // ---------------- MINE ----------------
  const myId = () => { const me = seatOf(app.me()); return me?.kind === 'llm' ? me.creator : app.me(); };
  const myDefs = () => (C()?.pawns || []).filter(d => d.owner === myId());
  function mineItems() {
    const me = myId(), defs = myDefs(), all = partyPawns(), out = [];
    for (const p of sortPawns(all.filter(p => p.owner === me))) out.push({ kind: 'on', rec: p, def: defs.find(d => d.id === p.def) || null });
    for (const p of all.filter(p => p.lender === me && p.owner !== me)) out.push({ kind: 'lent', rec: p, def: defs.find(d => d.id === p.def) || null });
    const placed = new Set(out.map(i => i.rec.def).filter(Boolean));
    for (const d of defs) if (!placed.has(d.id)) out.push({ kind: d.at || d.away ? 'away' : 'bench', def: d, rec: null });
    return out;
  }
  const figThumb = (fig, size) => { const f = fig && F.get(fig), u = f && F.thumbUrl(f); return u ? `<img class="nic fig" src="${esc(u)}" alt="" width="${size}" height="${size}" draggable="false">` : `<span class="nic fb">${icon('user', Math.round(size * 0.55))}</span>`; };
  function mineHtml() {
    const items = mineItems(); let mainKey = false;
    const tile = (it, i) => {
      const name = it.rec?.name || it.def.name, fig = it.rec?.fig || it.def?.fig, main = it.rec?.main || (!it.rec && it.def.main);
      const key = it.kind === 'on' && !mainKey ? (mainKey = true, '0') : '';
      const tip = it.kind === 'on' ? `Go to ${name}` : it.kind === 'lent' ? `${name}: lent to ${seatOf(it.rec.owner)?.name || 'the GM'}. Go to it` : it.kind === 'bench' ? `${name} is on your bench. Bring it on: click, then a square, or drag it onto the map` : `${name} is on a table you are not at`;
      const st = it.rec ? statHtml(it.rec) : '';
      return `<div class="btile mine ${it.kind}" role="button" tabindex="-1" data-mine="${i}" data-tip="${esc(tip)}">${figThumb(fig, 64)}<span class="bl">${esc(name)}</span>${key ? `<kbd>${key}</kbd>` : ''}${main ? `<i class="mstar" data-tip="Main pawn">${icon('star', 11)}</i>` : ''}${st ? `<span class="mstat">${st}</span>` : ''}${it.kind === 'bench' ? `<em>${icon('armchair', 10)} bench</em>` : it.kind === 'away' ? '<em>away</em>' : it.kind === 'lent' ? '<em>lent</em>' : ''}<button class="tmenu" data-menu="${i}" tabindex="-1" data-tip="More for ${esc(name)}" aria-label="More for ${esc(name)}">${icon('menu', 13)}</button></div>`;
    };
    return `<header class="blevel"><b>Mine</b></header><div class="bgrid">${items.map(tile).join('')}<div class="btile newp" role="button" tabindex="-1" data-newpawn data-tip="New pawn: pick a figure and name it (Settings ▸ Me ▸ My pawns)"><span class="nic fb plus">${icon('plus', 34)}</span><span class="bl">New pawn</span><kbd>N</kbd></div></div>`;
  }
  function travelItems(recs, from) {
    if (app.travelLocked?.()) return [{ label: 'The GM has locked travel', icon: 'lock', off: true }];
    const ts = app.travelTargets?.(from) || [];
    return ts.length ? ts.map(a => ({ label: `Travel to ${a.name}`, sub: app.areaHidden?.(a.id) ? 'hidden from players' : '', icon: app.areaHidden?.(a.id) ? 'eye-off' : 'send', cls: app.areaHidden?.(a.id) ? 'hid' : '', run: () => app.travel(recs.map(tok), a.id, from) })) : [{ label: 'There is nowhere else to travel to yet', icon: 'map', off: true }];
  }
  function mineMenu(it, anchor) {
    const items = [], rec = it.rec, d = it.def, here = rec && rec.area === app.area(), me = myId();
    if (rec) {
      items.push({ label: `Go to ${rec.name}`, icon: 'crosshair', run: () => goTo(rec) });
      if (it.kind === 'on') items.push(...travelItems([rec], rec.area));
      if (here && rec.def) items.push({ label: 'Send back to the bench', icon: 'log-out', run: () => { app.dispatch('pawn.bench', { id: rec.id }); app.sel.delete(rec.id); } });
      if (here && it.kind === 'on') { for (const s of people().filter(s => s.id !== me && s.role !== 'gm')) items.push({ label: `Lend to ${s.name}`, icon: 'user-plus', dot: s.color, run: () => app.dispatch('token.lend', { id: rec.id, to: s.id }) }); items.push({ label: 'Lend to the GM', sub: 'the GM and the GM\'s assistants move it', icon: 'user-plus', run: () => app.dispatch('token.lend', { id: rec.id, to: '' }) }); }
      if (here && it.kind === 'lent') items.push({ label: 'Take it back', icon: 'undo-2', run: () => app.dispatch('token.lend', { id: rec.id, to: me }) });
    } else if (it.kind === 'bench') items.push({ label: 'Bring on (then click a square)', icon: 'log-in', run: () => bringOn(d) });
    if (d) { items.push({ label: 'Edit…', icon: 'pencil', run: () => app.settings.editPawn(d.id) }); if (!rec && it.kind === 'bench') items.push({ label: 'Forget this pawn', icon: 'trash-2', run: () => app.sync.submit('pawn.forget', { id: d.id }) }); }
    showPop(anchor, rec?.name || d.name, items);
  }
  function bringOn(d) { if (app.pawnTool.start(null, { def: d })) { P.lastBringOn = d.id; if (app.tray.dismissable('pawns') && !app.tray.held()) close(); } }

  // ---------------- THE GM'S CAST ----------------
  const cast = () => C()?.cast || [];
  const selPawns = () => app.selected().filter(e => e.kind === 'token');
  const castPic = (c) => c.kind === 'group' ? `<span class="cstack">${c.members.slice(0, 3).map(m => figThumb(m.fig, 40)).join('')}</span>` : figThumb(c.fig, 64);
  const castTile = (c) => `<div class="btile cast ${c.kind}" role="button" tabindex="-1" data-cast="${esc(c.id)}" data-tip="${esc(c.name)}${c.kind === 'group' ? `: ${c.members.length} pawns. Click, then a square (or drag it onto the map): the whole group drops and is numbered` : ': click, then a square, or drag it onto the map'}">${castPic(c)}<span class="bl">${esc(c.name)}</span>${c.kind === 'group' ? `<i class="fsz">×${c.members.length}</i>` : ''}<button class="tmenu" data-castmenu="${esc(c.id)}" tabindex="-1" data-tip="More for ${esc(c.name)}" aria-label="More for ${esc(c.name)}">${icon('menu', 13)}</button></div>`;
  function castHtml() {
    if (!app.gm() || !app.can('token.edit')) return '';
    const all = cast(), sel = selPawns(), recent = all.slice(0, RECENT_CAST), list = castAll ? all : recent;
    const save = sel.length >= 2 ? `<button class="bchip psave" data-savegroup tabindex="-1" data-tip="Save the ${sel.length} selected pawns as a group you can drop again">${`<span class="nic fb">${icon('save', 18)}</span>`}<span><small>${sel.length} pawns selected</small>Save as group…</span><kbd>G</kbd></button>` : sel.length === 1 ? `<button class="bchip psave" data-savecast tabindex="-1" data-tip="Keep ${esc(sel[0].name)} in the cast: its figure, sheet and notes, to place again">${figThumb(sel[0].fig, 32)}<span><small>${esc(sel[0].name)} is selected</small>Add to the cast</span><kbd>G</kbd></button>` : '';
    return `<header class="blevel"><b>The cast</b>${all.length > RECENT_CAST ? `<button class="phbtn${castAll ? ' on' : ''}" data-castall tabindex="-1" data-tip="${castAll ? 'Only the most recent' : `All ${all.length} of the cast`}">${icon('users-round', 15)}<span>${castAll ? 'Recent' : `All ${all.length}`}</span><kbd>C</kbd></button>` : ''}</header>${save}
      ${list.length ? `<div class="bgrid">${list.map(castTile).join('')}</div>` : `<p class="pempty">Named people and saved groups go here. Select a pawn (or several) and this section offers to keep them.</p>`}`;
  }
  // SAVE: several selected pawns as a group (their places are kept relative to the first); one as a named individual
  function saveGroup(name) {
    const sel = selPawns(); if (sel.length < 2) { app.toast('Select two or more pawns to save as a group', true); return null; }
    const lead = sel[0], id = newId('cast');
    app.sync.submit('cast.save', { id, kind: 'group', name: (name || `${pawnKindLabel(lead)} group`).slice(0, 80), members: sel.slice(0, 30).map(e => ({ name: pawnKindLabel(e), ...(e.fig && { fig: e.fig }), ...(F.sizeOf(e) > 1 && { size: F.sizeOf(e) }), dx: Math.round((e.x - lead.x) * 100) / 100, dz: Math.round((e.z - lead.z) * 100) / 100 })) });
    P.lastSaved = id; return id;
  }
  function saveOne(e, name) {
    if (!e) return null; const id = newId('cast');
    app.sync.submit('cast.save', { id, kind: 'one', name: (name || e.name).slice(0, 80), ...(e.fig && { fig: e.fig }), ...(F.sizeOf(e) > 1 && { size: F.sizeOf(e) }), ...(e.sheet && { sheet: e.sheet }), ...(e.notes && { notes: e.notes }), ...(e.gmNotes && { gmNotes: e.gmNotes }) });
    P.lastSaved = id; return id;
  }
  app.saveGroup = saveGroup; app.saveCast = saveOne;
  function dropCast(c) { if (app.pawnTool.start(null, { cast: c })) { P.lastDrop = c.id; if (app.tray.dismissable('pawns') && !app.tray.held()) close(); } }
  function castMenu(c, anchor) {
    showPop(anchor, c.name, [{ label: c.kind === 'group' ? `Place the group (${c.members.length} pawns)` : 'Place (then click a square)', icon: 'log-in', run: () => dropCast(c) },
      { label: 'Rename…', icon: 'pencil', run: () => app.emit('bar.open', `rename cast ${c.name} to `) },
      ...(c.kind === 'one' && c.sheet ? [{ label: 'Open the sheet', icon: 'file-text', run: () => window.open(c.sheet, '_blank', 'noopener') }] : []),
      { label: 'Remove from the cast', icon: 'trash-2', run: () => app.sync.submit('cast.forget', { id: c.id }) }]);
  }

  // ---------------- PLACE A PAWN: the tree of minis ----------------
  const pawnsPic = `<img class="nic" src="data/icons/tool-pawns.png?v=${window.TW_V || 'dev'}" alt="" width="32" height="32">`;
  const toBar = (text) => { if (app.tray.dismissable('pawns') && !app.tray.held()) close(); app.emit('bar.open', text); };
  const tree = figTree(app, {
    home: { label: 'Pawns', pic: pawnsPic },
    onChange: () => { if (!tree.path.length) view = 'home'; lastHtml = ''; if (P.isOpen) render(); },
    onPick: (fig, ev) => { if (app.pawnTool.start(fig, { keep: ev?.shiftKey })) { P.lastPick = fig.id; if (app.tray.dismissable('pawns') && !app.tray.held()) close(); } },
    onDrag: (fig, ev) => dragOutOf(ev, () => app.pawnTool.start(fig), () => { P.lastPick = fig.id; }),
    onMore: (n) => toBar(`place pawn ${n.more} `),
  });
  // DRAG A TILE OUT ONTO THE MAP (Harry 2026-10-06; client/pawns.js app.dragPawnOut): a figure of the tree, a cast entry
  // (a group drops whole), a pawn on my bench (it is brought on where it is let go). The menu steps aside for the drag
  // unless it is pinned; let go on the map and it closes as it does after a click, anywhere else (or Esc) and it is back.
  function dragOutOf(ev, start, done) {
    if (ev.target.closest('.tmenu')) return;
    const aside = app.tray.dismissable('pawns');
    app.dragPawnOut(ev, start, {
      onStart: () => { if (aside) tray.classList.add('out'); },
      onEnd: (ok) => { tray.classList.remove('out'); if (!ok) return; done?.(); P.lastDragOut = true; if (aside && !app.tray.held()) close(); },
    });
  }
  const canPlace = () => app.can('token.edit');
  function placeHtml() {
    if (!canPlace()) return '';
    return `<header class="blevel"><b>Place a pawn</b><button class="phbtn" data-search tabindex="-1" data-tip="Search all ${F.count} figures by name in the command bar" aria-label="Search the figures">${icon('search', 15)}<span>Search</span><kbd>F</kbd></button></header><div class="bgrid">${tree.roots().map(tree.nodeTile).join('')}</div>`;
  }

  // ---------------- ON THE TABLE ----------------
  function kinds() {
    const groups = new Map();
    for (const e of Object.values(app.entities())) {
      if (e.kind !== 'token' || (e.owner && seatOf(e.owner))) continue;
      const k = `${pawnKind(e)}${e.hidden ? '|hidden' : ''}`;
      if (!groups.has(k)) groups.set(k, { key: k, kind: pawnKind(e), label: pawnKindLabel(e), hidden: !!e.hidden, list: [] });
      groups.get(k).list.push(e);
    }
    return [...groups.values()].map(g => ({ ...g, list: g.list.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })) })).sort((a, b) => a.hidden - b.hidden || a.label.localeCompare(b.label));
  }
  function kindRowHtml(g, extra = '') {
    const hurt = g.list.filter(e => e.damage > 0), n = g.list.length;
    const dmg = hurt.length ? `<span class="kdmg" data-tip="${esc(hurt.map(e => `${e.name}: ${e.damage} damage`).join(' · '))}">${icon('heart-crack', 12)}${hurt.slice(0, 5).map(e => `<b>${e.damage}</b>`).join('')}${hurt.length > 5 ? `<small>+${hurt.length - 5}</small>` : ''}</span>` : '';
    return `<div class="krow${g.hidden ? ' hid' : ''}${extra}" data-kind="${esc(g.key)}">
      <button class="kface" data-kgo="${esc(g.key)}" tabindex="-1" data-tip="Go to ${esc(g.list[0].name)}${n > 1 ? ' (click again for the next)' : ''}" aria-label="Go to ${esc(g.label)}">${figThumb(g.list.find(e => e.fig)?.fig, 44)}${n > 1 ? `<i class="kn">×${n}</i>` : ''}</button>
      <div class="kmain"><div class="kname">${g.hidden ? `<i class="phid">${icon('eye-off', 12)}</i>` : ''}<b>${esc(n > 1 ? g.label : g.list[0].name)}</b>${n > 1 ? `<small>×${n}</small>` : ''}</div>${g.hidden ? '<small class="khid">hidden from players</small>' : ''}${dmg}</div>
      <div class="kacts">${n > 1 ? `<button class="pact" data-kact="all" tabindex="-1" data-tip="Select all ${n}" aria-label="Select all ${n}">${icon('square-dashed', 15)}</button>` : ''}${g.hidden && app.can('reveal') ? `<button class="pact rev" data-kact="reveal" tabindex="-1" data-tip="Reveal ${n > 1 ? `these ${n}` : esc(g.list[0].name)} to the players" aria-label="Reveal to the players">${icon('eye', 15)}</button>` : ''}</div></div>`;
  }
  function tableHtml() {
    const gs = kinds(); if (!gs.length) return '';
    return `<header class="blevel"><b>On the table</b><small>${gs.reduce((a, g) => a + g.list.length, 0)} here</small></header><div class="krows">${gs.map(g => kindRowHtml(g)).join('')}</div>`;
  }
  function goKind(g) { const i = (goCycle.get(g.key) || 0) % g.list.length; goCycle.set(g.key, i + 1); goTo({ ...g.list[i], area: app.area() }); }

  // ---------------- TURN ORDER: the same rows, in an order, with a marker ----------------
  const turns = () => { const t = app.turns ? app.turns() : app.view()?.turns; return t && Array.isArray(t.order) ? t : null; };
  const canOrder = () => app.gm() && !!REGISTRY['turn.order'];
  function turnHtml(T) {
    const rs = rows(), gs = kinds(), ents = app.entities(), used = new Set(), out = [];
    const mark = (key) => key === T.at ? ' cur' : '';
    const init = (key) => T.init && T.init[key] != null ? `<i class="tinit" data-tip="Initiative ${T.init[key]}">${T.init[key]}</i>` : '';
    const wrap = (key, html) => `<div class="trow${mark(key)}" data-tkey="${esc(key)}">${key === T.at ? `<i class="tmark" data-tip="Whose turn it is">${icon('play', 13)}</i>` : '<i class="tmark"></i>'}${html}${init(key)}</div>`;
    let n = 0;
    // (a kept template that lasts a number of rounds has a thin row of its own: docs/RULERS.md "Rounds")
    const tplRow = (e) => { const left = leftOf(e), mine = app.gm() || e.owner === app.me(), who = app.sync.campaign?.seats.find(x => x.id === e.owner);
      return `<div class="trow ttpl" data-tkey="${esc(e.id)}"><i class="tmark"></i><div class="tplrow${left === 0 ? ' expired' : ''}" data-tpl="${esc(e.id)}" style="--c:${esc(e.hidden ? '#b48cff' : who?.color || '#888')}" data-tip="${esc(`${templateName(e, app.sync.campaign?.defaults?.units)}${who ? ` · ${who.name}` : ''}${e.hidden ? ' · hidden from players' : ''}: it counts down each time the turn passes this row`)}">${icon('hourglass', 12)}<b>${esc(templateName(e, app.sync.campaign?.defaults?.units))}</b><span class="tleft">${left === 0 ? 'expired' : `${left} round${left === 1 ? '' : 's'} left`}</span>${mine ? (left === 0 ? `<button data-tplact="remove" tabindex="-1">Remove</button><button data-tplact="keep" tabindex="-1">Keep</button>` : `<button data-tplact="remove" tabindex="-1" aria-label="Remove" data-tip="Remove this template">×</button>`) : ''}</div></div>`; };
    for (const key of withTemplates(app.view(), T).order) {
      if (key.startsWith('tpl_')) { const e = ents[key]; if (e && e.kind === 'template' && e.rounds > 0 && !used.has(key)) { used.add(key); out.push(tplRow(e)); } continue; }
      if (used.has(key)) continue;
      if (key.startsWith('kind:')) { const g = gs.filter(x => !x.hidden || app.gm()).find(x => x.kind === key.slice(5)); if (!g) continue; used.add(key); for (const e of g.list) used.add(e.id); out.push(wrap(key, kindRowHtml(g))); continue; }
      const row = rs.find(r => r.main?.id === key);
      if (row) { used.add(key); used.add(`seat:${row.seat.id}`); out.push(wrap(key, rowHtml(row, ++n))); continue; }
      const e = ents[key]; if (!e) continue; // gone, or hidden from this seat: skipped
      used.add(key); out.push(wrap(key, kindRowHtml({ key: `solo|${e.id}`, kind: pawnKind(e), label: e.name, hidden: !!e.hidden, list: [e] })));
    }
    const restRows = rs.filter(r => !used.has(`seat:${r.seat.id}`)), restKinds = gs.filter(g => !used.has(`kind:${g.kind}`) && !g.list.every(e => used.has(e.id)));
    const next = R.get('turn.next') && R.permitted(R.get('turn.next'), R.ctx());
    return `<header class="blevel"><b>Turn order</b><small>round ${T.round || 1}</small>${next ? `<button class="phbtn" data-turnnext tabindex="-1" data-tip="Next turn">${icon('chevron-right', 15)}<span>Next</span>${(R.get('turn.next').keys || [])[0] ? `<kbd>${esc(R.get('turn.next').keys[0])}</kbd>` : ''}</button>` : ''}</header>
      <div class="prows turns${canOrder() ? ' can' : ''}">${out.join('') || '<p class="pempty">Nobody is in the order yet</p>'}</div>
      ${restRows.length || restKinds.length ? `<header class="blevel sub"><b>Not in the order</b></header><div class="prows">${restRows.map(r => rowHtml(r, ++n)).join('')}</div><div class="krows">${restKinds.map(g => kindRowHtml(g)).join('')}</div>` : ''}`;
  }
  // X-RAY (the turns work's; GM): its row here, with its key, once the command exists
  function gmToolsHtml() {
    if (!app.gm()) return '';
    const ctx = R.ctx(), cmds = R.all().filter(c => (/x-?ray/i.test(c.id) || (c.pawnsMenu === 'gm' && c.when(ctx))) && R.permitted(c, ctx));
    if (!cmds.length) return '';
    return `<header class="blevel"><b>GM</b></header><div class="krows">${cmds.map(c => `<button class="bchip gmtool${c.toggleState && c.toggleState(ctx) === 'on' ? ' on' : ''}" data-cmd="${esc(c.id)}" tabindex="-1"><span class="nic fb">${icon(R.iconOf(c, ctx) || 'scan-eye', 18)}</span><span><small>GM only</small>${esc(R.titleOf(c, ctx))}</span>${c.keys?.[0] ? `<kbd>${esc(c.keys[0])}</kbd>` : ''}</button>`).join('')}</div>`;
  }

  // One registry command, exactly the command dispatched by M. Shapes live after a measurement and in the bar.
  function measureHtml() {
    const ctx = R.ctx(), c = R.all().find(c => c.id === 'measure.start');
    if (!c || !R.permitted(c, ctx)) return '';
    return `<div class="krows mtools"><button class="bchip mtool" data-cmd="${c.id}" tabindex="-1" data-tip="${esc(R.titleOf(c, ctx))}"><span class="nic fb">${icon('ruler', 18)}</span><span>Measure</span><kbd>M</kbd></button></div>`;
  }
  // the sections of the home view, in order; each returns '' when it has nothing for this seat
  const SECTIONS = [['turns', () => { const T = turns(); return T ? turnHtml(T) : ''; }], ['mine', mineHtml], ['party', () => turns() ? partyHeadOnly() : partyHtml()], ['measure', measureHtml], ['cast', castHtml], ['place', placeHtml], ['table', () => turns() ? '' : tableHtml()], ['gm', gmToolsHtml]];
  P.sections = SECTIONS;

  let lastHtml = '', pressed = false, deferred = false;
  tray.addEventListener('pointerdown', () => { pressed = true; }, true);
  addEventListener('pointerup', () => { if (!pressed) return; pressed = false; if (deferred) { deferred = false; setTimeout(() => P.isOpen && render(), 0); } }, true);
  addEventListener('pointercancel', () => { pressed = false; }, true);
  function render() {
    if (!P.isOpen) return;
    if ((pressed || drag) && !tray.hidden) { deferred = true; return; }
    const ta = tray.querySelector('.pnotes textarea');
    if (ta && document.activeElement === ta) { deferred = true; return; } // never under someone typing
    const pinned = app.tray.pinned('pawns');
    if (view === 'tree' && (!tree.path.length || !canPlace())) view = 'home';
    const html = view === 'tree'
      ? `<div class="thead"><b>Pawns</b>${app.tray.pinButton('pawns')}</div>
      <div class="pbody clip tree"><section class="psec" data-sec="tree">${tree.html()}</section></div>
      <footer>Click a figure, then a square (Shift: keep placing), or drag it onto the map · <kbd>⌫</kbd> up · <kbd>${pinned ? 'P' : 'Esc'}</kbd> close</footer>`
      : `<div class="thead"><b>Pawns</b>${app.tray.pinButton('pawns')}</div>
      <div class="pbody clip">${SECTIONS.map(([id, fn]) => { const h = fn(); return h ? `<section class="psec" data-sec="${id}">${h}</section>` : ''; }).join('')}</div>
      <footer><kbd>1</kbd>–<kbd>9</kbd> go to a pawn · drag a row: ${turns() ? (canOrder() ? 'the turn order' : 'the GM orders the turns') : 'marching order'} · <kbd>${pinned ? 'P' : 'Esc'}</kbd> close</footer>`;
    const r = b.getBoundingClientRect(), lr = launch.getBoundingClientRect();
    Object.assign(tray.style, { left: `${lr.left}px`, top: `${r.bottom + 8}px`, maxHeight: `${innerHeight - r.bottom - 16}px` });
    if (html === lastHtml && !tray.hidden) return;
    const scroll = tray.querySelector('.pbody')?.scrollTop || 0;
    lastHtml = html; tray.innerHTML = html; tray.hidden = false;
    tray.querySelector('.pbody').scrollTop = scroll;
    app.tray.wirePin(tray);
    wire();
  }
  function wire() {
    keymap = new Map();
    for (const im of tray.querySelectorAll('img.pimg, img.nic.fig')) im.onerror = () => { const sp = document.createElement('span'); sp.className = im.className.replace('fig', '') + ' pfb fb'; sp.style.cssText = `width:${im.width}px;height:${im.height}px`; sp.innerHTML = icon('user', Math.round(im.width * 0.5)); im.replaceWith(sp); };
    if (view === 'tree') {
      tree.wire(tray);
      const home = tray.querySelector('[data-home]'); if (home) home.onclick = (ev) => { ev.stopPropagation(); tree.go([]); };
      for (const k of tree.keys()) keymap.set(k, () => tree.key(k));
      return;
    }
    const rs = rows(), byseat = new Map(rs.map(r => [r.seat.id, r])), recs = new Map(rs.flatMap(r => [r.main, ...r.pets].filter(Boolean).map(p => [p.id, p])));
    const T = turns();
    for (const el of tray.querySelectorAll('[data-go]')) { if (!el.dataset.go) continue; el.onclick = (ev) => { ev.stopPropagation(); if (justDragged) return; goTo(recs.get(el.dataset.go)); }; const k = el.querySelector('kbd')?.textContent; if (k) keymap.set(k.toLowerCase(), () => goTo(recs.get(el.dataset.go))); }
    for (const el of tray.querySelectorAll('.prow')) {
      const row = byseat.get(el.dataset.seat); if (!row) continue;
      for (const a of el.querySelectorAll('.pact')) {
        a.onmousedown = (ev) => ev.preventDefault();
        a.onclick = (ev) => {
          ev.stopPropagation();
          const what = a.dataset.act;
          if (what === 'sheet') openSheet(row.main);
          else if (what === 'follow') startFollow(row.main, { pip: ev.shiftKey });
          else if (what === 'whisper') app.emit('bar.open', `whisper ${row.seat.name} `);
          else if (what === 'here') bringHere(row);
          else if (what === 'send') sendMenu(row, a);
          else if (what === 'control') controlMenu(row, a);
        };
      }
      // drag: the marching order (everyone), or, while a turn order shows, the turn order (the GM: below)
      if (!T && row.seat.role !== 'gm') el.addEventListener('pointerdown', (ev) => startDrag(ev, el, { rows: () => [...tray.querySelectorAll('.prow:not(.gm)')], idOf: (x) => x.dataset.seat, commit: (ids) => setOrder(ids) }));
    }
    if (T && canOrder()) for (const el of tray.querySelectorAll('.trow')) el.addEventListener('pointerdown', (ev) => startDrag(ev, el, { rows: () => [...tray.querySelectorAll('.trow')], idOf: (x) => x.dataset.tkey, commit: (keys) => { P.lastTurnOrder = keys; app.dispatch('turn.order', { order: keys }); } }));
    const nextB = tray.querySelector('[data-turnnext]'); if (nextB) nextB.onclick = (ev) => { ev.stopPropagation(); R.run('turn.next'); };
    const nb = tray.querySelector('[data-notes]');
    if (nb) { const toggle = () => { saveNotes(); notesOpen = !notesOpen; lastHtml = ''; pressed = false; render(); if (notesOpen) tray.querySelector('.pnotes textarea')?.focus(); }; nb.onclick = (ev) => { ev.stopPropagation(); toggle(); }; keymap.set('o', (ev) => { ev.preventDefault?.(); toggle(); }); }
    const ta = tray.querySelector('.pnotes textarea');
    if (ta) {
      ta.oninput = () => { notesDirty = true; clearTimeout(notesTimer); notesTimer = setTimeout(saveNotes, 1000); };
      ta.onblur = () => { saveNotes(); if (deferred) { deferred = false; setTimeout(() => P.isOpen && render(), 0); } };
      ta.onkeydown = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); ta.blur(); } };
    }
    // mine
    const items = mineItems();
    const useMine = (it) => { if (!it) return; if (it.rec) goTo(it.rec); else if (it.kind === 'bench') bringOn(it.def); else app.toast(`${it.def.name} is on a table you are not at`); };
    for (const el of tray.querySelectorAll('[data-mine]')) { const it = items[+el.dataset.mine]; el.onclick = (ev) => { ev.stopPropagation(); useMine(it); }; if (it?.kind === 'bench') { el.classList.add('drags'); el.onpointerdown = (ev) => dragOutOf(ev, () => app.pawnTool.start(null, { def: it.def }), () => { P.lastBringOn = it.def.id; }); } const k = el.querySelector('kbd')?.textContent; if (k) keymap.set(k.toLowerCase(), () => useMine(it)); }
    for (const el of tray.querySelectorAll('[data-menu]')) { el.onmousedown = (ev) => ev.preventDefault(); el.onclick = (ev) => { ev.stopPropagation(); mineMenu(items[+el.dataset.menu], el); }; }
    const np = tray.querySelector('[data-newpawn]'); if (np) { const go = () => app.settings.editPawn('new'); np.onclick = (ev) => { ev.stopPropagation(); go(); }; keymap.set('n', go); }
    // the cast
    const byCast = new Map(cast().map(c => [c.id, c]));
    for (const el of tray.querySelectorAll('[data-cast]')) { el.onclick = (ev) => { ev.stopPropagation(); dropCast(byCast.get(el.dataset.cast)); }; el.classList.add('drags'); el.onpointerdown = (ev) => { const c = byCast.get(el.dataset.cast); dragOutOf(ev, () => app.pawnTool.start(null, { cast: c }), () => { P.lastDrop = c.id; }); }; }
    for (const el of tray.querySelectorAll('[data-castmenu]')) { el.onmousedown = (ev) => ev.preventDefault(); el.onclick = (ev) => { ev.stopPropagation(); castMenu(byCast.get(el.dataset.castmenu), el); }; }
    const ca = tray.querySelector('[data-castall]'); if (ca) { const t = () => { castAll = !castAll; lastHtml = ''; pressed = false; render(); }; ca.onclick = (ev) => { ev.stopPropagation(); t(); }; keymap.set('c', t); }
    const sg = tray.querySelector('[data-savegroup]'); if (sg) { const go = () => toBar('save group '); sg.onclick = (ev) => { ev.stopPropagation(); go(); }; keymap.set('g', go); }
    const sc = tray.querySelector('[data-savecast]'); if (sc) { const go = () => saveOne(selPawns()[0]); sc.onclick = (ev) => { ev.stopPropagation(); go(); }; keymap.set('g', go); }
    // place a pawn: the tree's first level, and the search button
    for (const el of tray.querySelectorAll('.psec[data-sec="place"] [data-node]')) { const go = () => { view = 'tree'; tree.go([el.dataset.node]); }; el.onclick = (ev) => { ev.stopPropagation(); go(); }; const k = el.querySelector('kbd')?.textContent; if (k) keymap.set(k.toLowerCase(), go); }
    const sb = tray.querySelector('[data-search]'); if (sb) { const go = () => toBar('place pawn '); sb.onclick = (ev) => { ev.stopPropagation(); go(); }; keymap.set('f', go); }
    // on the table
    const gs = new Map(kinds().map(g => [g.key, g]));
    for (const el of tray.querySelectorAll('.krow')) {
      const key = el.dataset.kind, g = gs.get(key) || (key.startsWith('solo|') ? { key, list: [app.entities()[key.slice(5)]].filter(Boolean) } : null); if (!g || !g.list.length) continue;
      el.querySelector('[data-kgo]').onclick = (ev) => { ev.stopPropagation(); if (justDragged) return; goKind(g); };
      for (const a of el.querySelectorAll('[data-kact]')) { a.onmousedown = (ev) => ev.preventDefault(); a.onclick = (ev) => { ev.stopPropagation(); if (a.dataset.kact === 'all') { app.select(g.list.map(e => e.id)); P.lastSelectAll = g.key; } else if (a.dataset.kact === 'reveal') app.setHidden(g.list, false); }; }
    }
    for (const el of tray.querySelectorAll('[data-cmd]')) el.onclick = (ev) => { ev.stopPropagation(); const tool = el.classList.contains('mtool'); if (tool && !app.tray.pinned('pawns') && !app.tray.held()) close(); /* (a tool for the map: the menu steps aside) */ R.run(el.dataset.cmd); lastHtml = ''; setTimeout(render, 0); };
    for (const el of tray.querySelectorAll('[data-tplact]')) { el.onpointerdown = (ev) => ev.stopPropagation(); el.onclick = (ev) => { ev.stopPropagation(); const id = el.closest('[data-tpl]').dataset.tpl; if (el.dataset.tplact === 'remove') app.rulers?.remove(id); else app.rulers?.setRounds(id, 0); }; }
  }

  // ---------------- dragging a row: the marching order ----------------
  let drag = null, justDragged = false;
  function startDrag(ev, el, { rows: rowsOf, idOf, commit }) {
    if (ev.button !== 0 || ev.target.closest('.pact, .ppet, textarea, .tmenu')) return;
    const x0 = ev.clientX, y0 = ev.clientY, id = idOf(el);
    const move = (e) => {
      if (!drag && Math.hypot(e.clientX - x0, e.clientY - y0) < 7) return;
      if (!drag) { drag = { id, el }; el.classList.add('dragging'); tray.classList.add('reordering'); }
      // the row goes before the first row whose middle is below the pointer
      const others = rowsOf().filter(x => x !== el);
      const before = others.find(x => { const r = x.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      for (const x of others) x.classList.remove('drop-before', 'drop-after');
      if (before) before.classList.add('drop-before'); else others.at(-1)?.classList.add('drop-after');
      drag.before = before ? idOf(before) : null;
    };
    const up = () => {
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true);
      if (!drag) return;
      const d = drag; drag = null; el.classList.remove('dragging'); tray.classList.remove('reordering');
      for (const x of tray.querySelectorAll('.drop-before, .drop-after')) x.classList.remove('drop-before', 'drop-after');
      justDragged = true; setTimeout(() => { justDragged = false; }, 0);
      const ids = rowsOf().map(idOf).filter(x => x !== d.id);
      const at = d.before ? ids.indexOf(d.before) : ids.length;
      ids.splice(at < 0 ? ids.length : at, 0, d.id);
      commit(ids);
      lastHtml = ''; setTimeout(render, 0);
    };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
  }

  // (tests, and the docs' pictures) what the menu shows
  function state() {
    return {
      open: P.isOpen, pinned: app.tray.pinned('pawns'), notesOpen, following: follow?.id || null, pop: pop && { title: pop.title, items: pop.items.map(i => i.label) },
      sections: [...tray.querySelectorAll('.psec')].map(s => s.dataset.sec),
      rows: [...tray.querySelectorAll('.prow')].map(el => ({ seat: el.dataset.seat, player: el.querySelector('.pwho small')?.textContent || '', pawn: el.querySelector('.pname')?.textContent || '', key: el.querySelector('.pface kbd')?.textContent || '', go: el.querySelector('.pface')?.dataset.go || '', portrait: el.querySelector('.pface img')?.getAttribute('src') || null,
        damage: (el.querySelector('.pdmg')?.textContent || '').trim(), conditions: [...el.querySelectorAll('.pcond')].map(x => x.textContent), mark: el.querySelector('.pmark')?.alt || '', acts: [...el.querySelectorAll('.pact')].map(x => x.dataset.act), tips: [...el.querySelectorAll('.pact')].map(x => x.dataset.tip), pets: [...el.querySelectorAll('.ppet')].map(x => x.dataset.go), area: el.previousElementSibling?.classList.contains('parea') ? el.previousElementSibling.dataset.area || '' : undefined })),
      areas: [...tray.querySelectorAll('.parea')].map(x => x.textContent.trim()),
      keys: [...keymap.keys()], view,
      mine: [...tray.querySelectorAll('[data-mine]')].map(el => ({ name: el.querySelector('.bl').textContent, kind: ['on', 'lent', 'bench', 'away'].find(k => el.classList.contains(k)), key: el.querySelector('kbd')?.textContent || '', main: !!el.querySelector('.mstar'), pic: el.querySelector('img')?.getAttribute('src') || null })),
      newPawn: !!tray.querySelector('[data-newpawn]'),
      cast: [...tray.querySelectorAll('[data-cast]')].map(el => ({ id: el.dataset.cast, name: el.querySelector('.bl').textContent, group: el.classList.contains('group'), n: el.querySelector('.fsz')?.textContent || '' })),
      saveRow: tray.querySelector('.psave')?.textContent.replace(/\s+/g, ' ').trim() || null,
      placeRoots: [...tray.querySelectorAll('.psec[data-sec="place"] [data-node]')].map(el => `${el.querySelector('kbd')?.textContent || '·'}:${el.querySelector('.bl').textContent}`),
      tree: view === 'tree' ? { ...tree.state(), chips: [...tray.querySelectorAll('.bchip')].map(x => x.querySelector('span').textContent), tiles: [...tray.querySelectorAll('.bgrid .btile')].map(el => ({ label: el.querySelector('.bl').textContent, fig: el.dataset.fig || null, key: el.querySelector('kbd')?.textContent || '', size: el.querySelector('.fsz')?.textContent || '', pic: el.querySelector('img')?.getAttribute('src') || null })) } : null,
      kinds: [...tray.querySelectorAll('.krow')].map(el => ({ key: el.dataset.kind, name: el.querySelector('.kname b').textContent, n: el.querySelector('.kname small')?.textContent || '', hidden: el.classList.contains('hid'), damage: [...el.querySelectorAll('.kdmg b')].map(x => x.textContent), acts: [...el.querySelectorAll('[data-kact]')].map(x => x.dataset.kact), pic: el.querySelector('img')?.getAttribute('src') || null })),
      turns: [...tray.querySelectorAll('.trow')].map(el => ({ key: el.dataset.tkey, cur: el.classList.contains('cur'), text: (el.querySelector('.pname, .kname b')?.textContent || '').trim(), init: el.querySelector('.tinit')?.textContent || '' })),
      gmTools: [...tray.querySelectorAll('.gmtool')].map(el => el.dataset.cmd),
    };
  }
  R.add({ id: 'pawns.menu', keys: ['P'], title: 'Pawns…', synonyms: ['pawns', 'tokens', 'characters', 'minis', 'party', 'players'], icon: 'users', group: 'Pawns', run: () => P.toggle() });
  R.add({ id: 'pawns.notes', title: 'Party notes…', synonyms: ['party notes', 'shared notes', 'notes', 'journal'], icon: 'notebook-pen', group: 'Pawns', run: () => { open(); notesOpen = true; lastHtml = ''; render(); tray.querySelector('.pnotes textarea')?.focus(); } });
  R.add({ id: 'pawns.new', title: 'New pawn… (Settings ▸ Me ▸ My pawns)', short: 'New pawn', synonyms: ['new pawn', 'my pawns', 'define pawn', 'my character', 'bench', 'pick a figure', 'choose mini'], icon: 'plus', group: 'Pawns', cls: 'pawn', run: () => app.settings.editPawn('new') });
  // "Save as group…": an action on a selection (so it is in the selection's own menu: client/menu.js), a row at the top
  // of the cast while several pawns are selected, and this command ("save group goblin patrol")
  R.add({ id: 'cast.saveGroup', title: 'Save as group… (type: save group goblin patrol)', short: 'Save as group', synonyms: ['save group', 'save as group', 'group', 'cast', 'patrol', 'encounter'], icon: 'save', group: 'Pawns', menu: true, cls: (ctx) => ctx.gm ? 'token.edit' : null,
    when: (ctx) => ctx.sel.filter(e => e.kind === 'token').length >= 2 && ctx.sel.every(e => e.kind === 'token'),
    parse: (text, ctx) => { const m = text.match(/^save (?:as )?group\s*(.*)$/i); return m && ctx.sel.filter(e => e.kind === 'token').length >= 2 ? { name: m[1].trim() } : null; }, chips: (a, ctx) => ['save group', a.name || '(name it)', `${ctx.sel.filter(e => e.kind === 'token').length} pawns`],
    run: (ctx, a) => { if (!a) return app.emit('bar.open', 'save group '); const id = saveGroup(a.name); if (id) app.toast(`Saved to the cast: ${a.name || 'the group'} (Pawns ▸ The cast)`); } });
  R.add({ id: 'cast.saveOne', title: 'Add to the cast (keep this pawn to place again)', short: 'Add to cast', synonyms: ['add to cast', 'save pawn', 'cast', 'npc', 'keep'], icon: 'save', group: 'Pawns', cls: (ctx) => ctx.gm ? 'token.edit' : null, when: (ctx) => ctx.one?.kind === 'token', run: (ctx) => { if (saveOne(ctx.one)) app.toast(`${ctx.one.name} is in the cast (Pawns ▸ The cast)`); } });
  R.add({ id: 'cast.rename', title: 'Rename a cast entry… (type: rename cast Old name to New name)', short: 'Rename cast', synonyms: ['rename cast', 'rename group'], icon: 'pencil', group: 'Pawns', hidden: true, cls: (ctx) => ctx.gm ? 'token.edit' : null,
    parse: (text) => { const m = text.match(/^rename cast\s+(.+?)\s+to\s+(.+)$/i); const c = m && cast().find(x => x.name.toLowerCase() === m[1].trim().toLowerCase()); return c ? { id: c.id, from: c.name, name: m[2].trim().slice(0, 80) } : null; }, chips: (a) => ['rename cast', a.from, '→', a.name], run: (ctx, a) => a?.name && app.sync.submit('cast.save', { id: a.id, name: a.name }) });
  R.add({ id: 'pawns.unfollow', title: 'Stop following the pawn', synonyms: ['unfollow', 'stop following', 'free camera', 'unlock view'], icon: 'eye', group: 'View', when: () => !!follow, run: () => stopFollow() });
  return { name: 'pawns' };
}
