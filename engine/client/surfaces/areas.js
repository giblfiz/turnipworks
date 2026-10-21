// AREAS ARE OPEN OR HIDDEN, AND PAWNS TRAVEL BETWEEN THEM (Harry 2026-10-06; docs/PAWNS.md "Areas", docs/UI.md).
// The relay does the hiding (core/perms.js canSee is the one filter): a player's browser is never sent a hidden area,
// so nothing in this file hides anything. This file is what the GM and the players SEE and PRESS.
//
// 1. THE GM MUST NEVER BE UNSURE AN AREA IS HIDDEN (Harry: "We need a 'closed' area to always be very very clearly
//    showing as 'closed' to the GM, maybe a constant floating button that says 'unlock this area to players' and
//    something that uses our same 'invisible' item flavor, and something that shows in all the menus where they come up"):
//      - a constant floating button while the GM is in a hidden area: "Hidden from players · Open this area"
//        (#areaState, top centre under the command bar; in an open area it is a quiet "Open to players · Hide")
//      - the area's name and the view's frame wear the hidden look a hidden thing has (the hidden violet, a dashed
//        edge, the eye-off mark): the name tag beside the button, a dashed violet frame round the whole view, and
//        the same on the picture-in-picture's frame and title when ITS area is hidden
//      - a mark in every list where areas appear: app.areaMark(id) is the one mark (Settings ▸ World navigation, the
//        picture-in-picture's title, the travel list, the command bar's places, the roster)
// 2. TRAVEL (app.travel): a pawn goes to another area and the mover's view goes with it. Settings ▸ World navigation
//    only ever moves the view. Invoked from the pawn's ☰ ("Send to area ▸", a sub-menu at its button) and the command
//    bar ("travel to <area>"); the Pawns menu will hold it later.
//      - a player whose travel the GM has locked is told so in the list itself
//      - THE GM'S UNDO OF A PLAYER'S TRAVEL is the ordinary undo chip with its own words: "Brakka went to the Crypt ·
//        [Bring back]" (surfaces/undochips.js asks app.undoWording)
//      - THE GM SENDS A PLAYER'S PAWN INTO A HIDDEN AREA: the relay opens it; ONE contextual button, "Opened <area> for
//        players · Undo"; that undo sends the pawn back AND hides the area again
//      - a pawn of yours that someone else sent away offers "Follow" (it never moves your view by itself: the rule the
//        cut button follows)
// 3. THE ARRIVAL MARK: where travellers arrive (core/travel.js). An ordinary thing with place 'arrival', hidden from
//    players; "Travellers arrive here" in the command bar places it (or moves the one there is).
import { icon } from '../icons.js';
import { newId } from '../../core/ids.js';
import { ARRIVAL_PLACE, arrivalMarks, TRAVEL_CELL } from '../../core/travel.js';

const OFFER_MS = 12000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function areasSurface(R, app) {
  const C = () => app.sync.campaign;
  const appEl = document.getElementById('app');
  const areaOf = (id) => C()?.areas.find(a => a.id === id) || null;
  // ---------- the one question, and the one mark ----------
  app.areaHidden = (id = app.area()) => areaOf(id)?.visibility === 'hidden'; // (only the GM side is ever sent a hidden area)
  app.areaMark = (id, size = 13) => app.areaHidden(id) ? `<span class="ahid" title="Hidden from players">${icon('eye-off', size)}</span>` : '';
  app.areaMarkText = (id) => app.areaHidden(id) ? ' · hidden from players' : '';
  app.setAreaOpen = (id, open) => { const a = areaOf(id); if (!a || !app.can('area.admin')) return null; return app.sync.submit('area.visibility', { area: id, visibility: open ? 'open' : 'hidden' }); };

  // ---------- 1. the GM's constant button, the name tag, the frame ----------
  const state = document.createElement('div'); state.id = 'areaState'; state.hidden = true;
  const veil = document.createElement('div'); veil.id = 'areaVeil'; veil.hidden = true; veil.setAttribute('aria-hidden', 'true');
  const none = document.createElement('div'); none.id = 'areaNone'; none.hidden = true; none.setAttribute('role', 'status');
  appEl.append(veil, state, none);
  const pipHid = document.createElement('button'); pipHid.id = 'pipHid'; pipHid.hidden = true; pipHid.tabIndex = -1;
  document.getElementById('pipTitle')?.before(pipHid);
  pipHid.onclick = (ev) => { ev.stopPropagation(); if (app.pip) app.setAreaOpen(app.pip.area, true); };
  state.addEventListener('mousedown', (ev) => ev.preventDefault()); // never takes the keyboard focus
  state.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  state.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-open]'); if (!b) return; ev.stopPropagation(); app.setAreaOpen(app.area(), b.dataset.open === '1'); });
  let sig = '';
  function render() {
    const c = C(), id = app.area(), a = areaOf(id), gm = app.gm();
    const pipA = app.pip && !app.pip.area.startsWith('lib:') ? app.pip.area : null, pipHidden = !!pipA && app.areaHidden(pipA);
    const s2 = JSON.stringify([id, a?.name, a?.visibility, gm, pipA, pipHidden, c?.areas.length, app.can('area.admin')]);
    if (s2 === sig) return; sig = s2;
    const hidden = !!a && a.visibility === 'hidden';
    state.hidden = !(gm && a);
    if (gm && a) {
      state.className = hidden ? 'is-hidden' : 'is-open';
      const can = app.can('area.admin');
      state.innerHTML = hidden
        ? `<span class="aname">${icon('eye-off', 15)}<b>${esc(a.name)}</b></span>${can ? `<button data-open="1" tabindex="-1">${icon('eye-off', 15)}<span>Hidden from players · <u>Open this area</u></span></button>` : `<span class="astate">Hidden from players</span>`}`
        : `<span class="aname"><b>${esc(a.name)}</b></span><span class="astate">Open to players</span>${can && c.areas.length ? `<button data-open="0" tabindex="-1" title="Hide this area from players">${icon('eye-off', 13)}<span>Hide</span></button>` : ''}`;
    }
    veil.hidden = !(gm && hidden);
    appEl.classList.toggle('area-hidden', gm && hidden);
    const pf = document.getElementById('pipFrame');
    pf?.classList.toggle('hidden-area', pipHidden);
    pipHid.hidden = !pipHidden;
    if (pipHidden) { pipHid.innerHTML = `${icon('eye-off', 13)}<span>Hidden from players</span>`; pipHid.title = 'Hidden from players. Click to open this area to them'; }
    // the area in my main view was hidden and is open again (or was the only one, hidden then opened): take it up again
    // (the relay dropped the subscription when it was hidden; nothing else asks for it back)
    if (c && id && a && app.sync.status === 'live' && !app.sync.view(id) && app.sync.areas.get(id)?.want === false) { app.sync.subscribe(id); if (c.my.location !== id) app.sync.submit('seat.locate', { area: id }); }
    // a player with no open area at all (the GM hid the only one): say so, rather than an empty world
    const empty = !!c && !gm && c.areas.length === 0;
    none.hidden = !empty;
    if (empty) none.innerHTML = `${icon('eye-off', 22)}<div><b>No area is open to you right now</b><span>The GM will open one.</span></div>`;
  }
  // (tests) what the GM is being told
  app.areaStateView = () => ({ shown: !state.hidden, hidden: state.classList.contains('is-hidden'), text: state.textContent.replace(/\s+/g, ' ').trim(), frame: !veil.hidden, pip: !pipHid.hidden, none: !none.hidden });

  // ---------- 2. travel ----------
  const owners = new Map(); // token id -> { name, owner, x, z, y, area }: a pawn that has left is still remembered (where it stood, whose it was)
  function remember(area) { for (const e of Object.values(app.entities(area))) if (e.kind === 'token') owners.set(e.id, { name: e.name, owner: e.owner || null, x: e.x, z: e.z, y: e.y || 0, area }); }
  const isPlayerSeat = (sid) => { const s = C()?.seats.find(x => x.id === sid); const p = s?.kind === 'llm' ? C()?.seats.find(x => x.id === s.creator) : s; return !!p && p.role === 'player'; };
  app.travelLocked = () => !app.gm() && !!C()?.defaults?.travelLocked;
  // the areas a pawn can be sent to from here (the GM: every other area; a player: the other open ones, which is all they are sent)
  app.travelTargets = (from = app.area()) => (C()?.areas || []).filter(a => a.id !== from);
  // follow: the mover's view goes with the pawn (travel). The older "Send selection to <area>" in the command bar sends
  // pawns the same way (same arrival, same open-on-send) but leaves the sender's view where it is.
  app.travel = async (toks, to, from = app.area(), { follow = true } = {}) => {
    toks = [].concat(toks).filter(e => e?.kind === 'token');
    if (!toks.length) return null;
    if (app.travelLocked()) { app.toast('The GM has locked travel between areas', true); return null; }
    const name = app.areaName(to), wasHidden = app.areaHidden(to);
    const acks = await Promise.all(toks.map(e => app.await(app.sync.submit('travel', { id: e.id, from, to }))));
    const good = acks.filter(Boolean);
    if (!good.length) return null; // refused: the relay's reason is already on screen
    app.clearSelection?.();
    // the mover's view goes with the pawn, and lands on it
    const at = good[0].result || {};
    if (follow) app.setMain(to);
    if (follow && Number.isFinite(at.x)) { const p = { x: at.x, y: at.y || 0, z: at.z }; whenLoaded(to, () => { try { app.centreOn(p, app.main, { ms: 0 }); if (at.y) app.goLevel?.(at.y, 'travel'); app.select?.(toks.map(e => e.id).filter(id => app.entities()[id])); } catch { } }); }
    const opened = good.filter(m => m.result?.opened);
    if (opened.length && wasHidden) offerUnopen({ from, to, at: follow ? to : from, name, seq: opened[0].result.seq, pawn: toks[0].name, n: good.length });
    return good;
  };
  function whenLoaded(area, fn, tries = 60) { if (app.sync.view(area) && app.area() === area) return fn(); if (tries > 0) setTimeout(() => whenLoaded(area, fn, tries - 1), 50); }

  // THE ONE BUTTON for "the GM sent a player's pawn into a hidden area": "Opened <area> for players · Undo".
  const unopened = new Set();
  app.actionLines?.kind('unopen', {
    restorable: false,
    valid: (d) => unopened.has(`${d.from}|${d.seq}`) ? 'already undone' : !app.gm() ? 'not yours to undo' : null,
    run: (d) => unopen(d),
  });
  const unopen = (d) => app.await(app.sync.submitRaw({ type: 'undo', area: d.from, args: { seq: d.seq } })).then(m => { if (!m) return 'could not be undone'; unopened.add(`${d.from}|${d.seq}`); return null; });
  function offerUnopen({ from, to, at, name, seq, pawn, n }) {
    const data = { from, to, seq };
    app.condButtons?.show('area-opened', {
      cls: 'aopened', icon: 'eye', text: `Opened ${name} for players · Undo`, dock: 'bottom2', life: OFFER_MS, area: at, doneText: `${name} is hidden again`, data,
      line: { kind: 'unopen', text: `Opened ${name} for players (${n > 1 ? `${n} pawns` : pawn} went in)`, button: 'Undo', data },
      run: () => { unopen(data); },
    });
  }
  // THE GM'S UNDO CHIP FOR A PLAYER'S TRAVEL, in its own words (surfaces/undochips.js calls this for every entry it is
  // about to offer an undo for): "Brakka went to the Crypt · [Bring back]"; seen from the other end, "Brakka came from
  // the Inn · [Send back]". The undo is the ordinary one (by its number in the log), which returns the pawn to exactly
  // where it stood.
  app.undoWording = (e) => {
    if (e?.type !== 'transfer.out' && e?.type !== 'transfer.in') return null;
    const id = e.args.id || e.args.entity?.id, was = owners.get(id), ent = e.args.entity;
    if (ent ? ent.kind !== 'token' : !was) return null; // a thing, not a pawn: the ordinary words
    const pawn = ent?.name || was?.name || 'A pawn', other = e.type === 'transfer.out' ? e.args.to : e.args.from, where = other && areaOf(other) ? areaOf(other).name : null;
    const out = e.type === 'transfer.out';
    return {
      text: out ? `Bring ${pawn} back` : `Send ${pawn} back`, button: out ? 'Bring back' : 'Send back',
      line: out ? `${pawn} went to ${where || 'another area'}` : `${pawn} came from ${where || 'another area'}`,
      anchor: out && was ? [was.x, was.z, 3 + (was.y || 0)] : null, dock: 'bottom2', doneText: out ? `${pawn} is back` : `${pawn} was sent back`,
    };
  };
  // A PAWN OF MINE THAT SOMEONE ELSE SENT AWAY: offer to follow it (my view never moves by itself).
  app.actionLines?.kind('follow', {
    restorable: true,
    valid: (d) => areaOf(d.to) ? (app.area() === d.to ? 'you are there' : null) : 'not open to you',
    run: (d) => { app.setMain(d.to); },
  });
  // (the entry can arrive a moment before the campaign view that lists a just-opened area: wait for that view)
  function onEntry(e, tries = 20) {
    if (e?.type !== 'transfer.out' || !e.args?.to || e.by === app.me()) return;
    const was = owners.get(e.args.id);
    if (!was || was.owner !== app.me() || e.area !== app.area()) return;
    if (!areaOf(e.args.to)) { if (tries > 0) setTimeout(() => onEntry(e, tries - 1), 100); return; }
    const name = areaOf(e.args.to).name, data = { to: e.args.to };
    app.condButtons?.show('travel-follow', {
      cls: 'afollow', icon: 'footprints', text: `Follow ${was.name} to ${name}`, dock: 'bottom2', life: OFFER_MS, area: e.area, doneText: `In ${name}`, data,
      line: { kind: 'follow', text: `${was.name} went to ${name}`, button: 'Follow', group: `follow|${e.args.to}`, data },
      run: () => { app.setMain(e.args.to); },
    });
  }

  // the travel list (the pawn's ☰ "Send to area ▸": surfaces/ring.js shows these tiles at the button)
  app.travelTiles = (toks, done = () => {}) => {
    toks = [].concat(toks).filter(e => e?.kind === 'token');
    if (app.travelLocked()) return [{ label: 'The GM has locked travel', title: 'The GM has locked travel between areas', icon: 'lock', cls: 'locked', run: () => { app.toast('The GM has locked travel between areas', true); done(); } }];
    const ts = app.travelTargets();
    if (!ts.length) return [{ label: app.gm() ? 'No other area yet' : 'No other area is open', icon: 'map', cls: 'locked', run: () => { app.toast(app.gm() ? 'There is no other area: Settings ▸ World navigation makes one' : 'No other area is open to you'); done(); } }];
    const opens = toks.some(e => isPlayerSeat(e.owner));
    return ts.map(a => { const hid = a.visibility === 'hidden', u = !hid && app.thumbs?.url?.(a.id); return {
      label: a.name, area: a.id, hiddenArea: hid, icon: hid ? 'eye-off' : 'map', ...(u && app.thumbs.meta?.[a.id] ? { pic: u } : {}),
      title: hid ? `${a.name}: hidden from players${opens ? '. Sending a player\'s pawn there OPENS it to the players (with an Undo)' : '. This pawn goes in quietly; the area stays hidden'}` : `Send to ${a.name}`,
      run: () => { done(); app.travel(toks, a.id); } }; });
  };
  // (a hidden area's tile wears the hidden look: the ring's sub-menu reads hiddenArea / cls from these tiles)

  // ---------- 3. the arrival mark ----------
  const sq = (v) => (Math.floor(v / TRAVEL_CELL) + 0.5) * TRAVEL_CELL;
  app.arrivalMark = (area = app.area()) => arrivalMarks(app.entities(area))[0] || null;
  app.placeArrival = (at = null) => {
    const one = app.selected().find(e => (e.kind === 'token' || e.kind === 'object') && e.place !== ARRIVAL_PLACE);
    const f = app.main?.grab.focus, p = at || (one ? [one.x, one.z, one.y || 0] : app.cursor ? [app.cursor[0], app.cursor[1], app.cursor.y || app.cursor[2] || 0] : f ? [f.x, f.z, app.level || 0] : [0, 0, 0]);
    const x = sq(p[0]), z = sq(p[1]), y = p[2] || 0, m = app.arrivalMark();
    if (m) { app.dispatch('object.move', { id: m.id, x, z, y }); app.toast('Arrival mark moved: travellers arrive here'); return m.id; }
    const id = newId('obj');
    app.dispatch('object.place', { id, name: 'Arrival point', place: ARRIVAL_PLACE, layer: 'default', x, z, y, dims: [5, 0.25, 5], color: '#a78bfa', hidden: true, pinned: true });
    app.toast('Arrival mark placed: travellers arrive here (players never see it)');
    return id;
  };

  // ---------- commands (the bar finds them by name; the pawn's ☰ shows "Send to area ▸") ----------
  const pawnsOf = (ctx) => { const sel = ctx.sel.filter(e => e.kind === 'token'); if (sel.length) return sel.length === ctx.sel.length ? sel : []; const mine = Object.values(app.entities()).filter(e => e.kind === 'token' && e.owner === app.me()); return mine.length === 1 ? mine : []; };
  const mayTravel = (ctx, toks) => toks.length > 0 && toks.every(e => ctx.gm || e.owner === app.me());
  R.add({ id: 'pawn.travel', title: (ctx) => app.travelLocked() ? 'Send to area… (the GM has locked travel)' : 'Send to area…', short: 'Send to area', synonyms: ['travel', 'go to area', 'leave', 'move to area', 'send to area', 'another area', 'exit'], icon: 'send', group: 'Pawn', menu: true, cls: 'travel',
    when: (ctx) => ctx.sel.length > 0 && ctx.sel.every(e => e.kind === 'token') && mayTravel(ctx, ctx.sel), run: (ctx) => app.emit('ring.travel', ctx.sel) });
  R.add({ id: 'pawn.travelTo', title: 'Travel to an area…', synonyms: ['travel', 'travel to', 'send pawn to area'], icon: 'send', group: 'Pawn', cls: 'travel', hidden: true,
    when: (ctx) => mayTravel(ctx, pawnsOf(ctx)),
    parse: (text, ctx) => { const m = text.match(/^travel\s+(?:to\s+)?(.+)$/i); if (!m) return null; const q = m[1].trim().toLowerCase(); const a = app.travelTargets().find(a => a.name.toLowerCase() === q) || app.travelTargets().find(a => a.name.toLowerCase().includes(q)); return a && pawnsOf(ctx).length ? { to: a.id, name: a.name, hidden: a.visibility === 'hidden' } : null; },
    chips: (a, ctx) => ['travel', pawnsOf(ctx).map(e => e.name).join(', '), '→', a.hidden ? `${a.name} (hidden)` : a.name], run: (ctx, a) => a?.to && app.travel(pawnsOf(ctx), a.to) });
  R.add({ id: 'area.open', title: 'Open this area to players', synonyms: ['unhide area', 'reveal area', 'show area', 'unlock area', 'visibility', 'open area'], icon: 'eye', group: 'Areas', cls: 'area.admin', when: () => app.areaHidden(), run: () => app.setAreaOpen(app.area(), true) });
  R.add({ id: 'area.hide', title: 'Hide this area from players', synonyms: ['hide area', 'close area', 'secret area', 'visibility', 'gm only'], icon: 'eye-off', group: 'Areas', cls: 'area.admin', when: () => !!areaOf(app.area()) && !app.areaHidden(), run: () => app.setAreaOpen(app.area(), false) });
  R.add({ id: 'area.travelLock', title: () => C()?.defaults?.travelLocked ? 'Unlock travel between areas (players)' : 'Lock travel between areas (players)', synonyms: ['lock travel', 'unlock travel', 'travel lock', 'stop players leaving'], icon: 'lock', group: 'Areas', cls: 'campaign.admin', run: () => { const on = !C()?.defaults?.travelLocked; app.sync.submit('campaign.set', { defaults: { travelLocked: on } }); app.toast(on ? 'Travel is locked: players cannot send their pawns to another area' : 'Travel is unlocked'); } });
  R.add({ id: 'area.arrival', title: () => app.arrivalMark() ? 'Travellers arrive here (move the arrival mark)' : 'Travellers arrive here (place the arrival mark)', synonyms: ['arrival', 'arrival mark', 'arrival point', 'entrance', 'spawn point', 'where pawns arrive'], icon: 'footprints', group: 'Areas', cls: 'object', when: (ctx) => ctx.gm, run: () => app.placeArrival() });

  app.on((what, e) => {
    if (what === 'refresh' || what === 'change') { if (what === 'change') remember(e); render(); }
    if (what === 'entry') onEntry(e);
  });
  return { name: 'areas' };
}
