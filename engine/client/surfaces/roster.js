// The corner roster: a top-right row of avatars, one per seat AT THE TABLE NOW (seat colour, initial, an activity
// dot, a location label). Agents are dashed and say whose agent they are.
//   CLICK      go to that person's main pawn (Harry 2026-10-28: "if you click on one of those, it should take you to
//              their primary pawn"): their party row's pawn, so what this seat may not see (a pawn hidden from players,
//              a hidden area) was never sent. A player is never taken to one under their fog of war, nor to another
//              area (a toast says where it is); the GM goes there, area and level included. No pawn: their cursor in
//              this area, else (the GM) their area, else a toast.
//   DRAG OUT   onto the world: watch their area in a PiP that follows their tokens.
//   RIGHT-CLICK  (the GM, on a person) a small menu: go to, Disconnect (closes their connections now; NOT a ban: the
//              link still works and they can rejoin; relay/server.js kick), and the way to Settings to revoke the link.
// Only seats with a connection are shown (and always me): the row is "who is here", so a seat nobody is using, or a
// connection the relay reaped as a ghost (docs/NETCODE.md "Ghost connections"), leaves it. Every seat, here or not,
// stays in Pawns ▸ Party and Settings ▸ Campaign admin ▸ Invites and seats.
import { icon } from '../icons.js';
import * as HT from '../../core/height.js';

export function rosterSurface(R, app) {
  const el = document.getElementById('roster');
  let sig = '', pop = null;
  const active = new Map(); // seat -> last time we saw them move (presence) or act (log)
  app.on((what) => { if (what === 'refresh' || what === 'change') render(); });
  setInterval(render, 2000);
  const seatOf = (id) => app.sync.campaign?.seats.find(s => s.id === id) || null;
  const kickable = (s) => app.gm() && s.id !== app.me() && s.kind === 'human' && s.role !== 'gm' && s.online;
  const cursorOf = (s) => app.pv.seats.get(`${app.area()}|${s.id}`)?.pos || null; // [x, z, y?] in the main view's area
  const levelAt = (x, z, y = 0) => HT.floorUnder(app.entities(), x, z, y)?.y ?? 0;
  const seen = (x, z, y = 0) => app.gm() || app.fog?.visible?.(x, z, levelAt(x, z, y), app.area()) !== false;

  // WHERE A CLICK GOES: { go() } or { why } (said in a toast). Exposed as app.roster.target for the tests.
  function target(s) {
    const rec = s.kind === 'human' ? app.pawns?.mainOf?.(s.id) : null, gm = app.gm();
    if (rec) {
      if (rec.area && rec.area !== app.area()) return gm ? { kind: 'pawn', rec, go: () => app.pawns.goTo(rec) } : { why: `${rec.name} (${s.name}) is in ${app.areaName(rec.area)}` };
      const e = app.entities()[rec.id];
      if (!e) return { why: `You can't see ${rec.name} from here` };
      if (!seen(e.x, e.z, e.y || 0)) return { why: `You can't see ${rec.name} from here` };
      return { kind: 'pawn', rec, go: () => app.pawns.goTo(rec) };
    }
    const p = cursorOf(s);
    if (p && seen(p[0], p[1], p[2] || 0)) return { kind: 'cursor', go: () => app.centreOn({ x: p[0], y: p[2] || 0, z: p[1] }) };
    if (gm && s.location && s.location !== app.area()) return { kind: 'area', go: () => app.setMain(s.location) };
    return { why: `${s.name} has no pawn on a table${s.location && s.location !== app.area() ? ` (they are in ${app.areaName(s.location)})` : ''}` };
  }
  function goToSeat(s) { const t = target(s); if (t.go) { app.roster.last = { seat: s.id, kind: t.kind, id: t.rec?.id || null }; t.go(); } else { app.roster.last = { seat: s.id, why: t.why }; app.toast(t.why); } }
  function tipOf(s) {
    const where = s.location ? app.areaName(s.location) : '—', rec = s.kind === 'human' ? app.pawns?.mainOf?.(s.id) : null;
    const lines = [`${s.name}${s.label ? ` (${s.label})` : s.role === 'gm' ? ' (GM)' : ''} · ${where}${s.online ? '' : ' · offline'}`];
    lines.push(rec ? `Click: go to their pawn (${rec.name})` : 'Click: go to their pawn (none on a table yet: their cursor or their area)');
    if (s.location) lines.push('Drag into the area: watch in a picture-in-picture');
    if (kickable(s)) lines.push('Right-click: disconnect (not a ban: they can rejoin)');
    return lines.join('\n');
  }

  // ---------------- the GM's menu ----------------
  function closePop() { if (!pop) return false; pop.remove(); pop = null; return true; }
  addEventListener('pointerdown', (ev) => { if (pop && !pop.contains(ev.target)) closePop(); }, true);
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && closePop()) ev.stopPropagation(); }, true);
  function menu(s, anchor) {
    closePop();
    const t = target(s), items = [];
    items.push(t.go ? { act: 'go', label: t.rec ? `Go to ${t.rec.name}` : t.kind === 'area' ? `Go to ${app.areaName(s.location)}` : `Go to ${s.name}'s cursor`, ic: 'crosshair', run: () => goToSeat(s) } : { act: 'go', label: t.why, ic: 'crosshair', off: true });
    if (kickable(s)) {
      items.push({ act: 'kick', label: `Disconnect ${s.name}`, sub: 'Closes their connection now. Not a ban: their link still works and they can rejoin.', ic: 'log-out', run: () => app.sync.kick(s.id) });
      items.push({ act: 'revoke', label: 'Revoke their link…', sub: 'Settings ▸ Campaign admin ▸ Invites and seats', ic: 'shield', run: () => app.settings?.show('admin') });
    }
    pop = document.createElement('div'); pop.className = 'ppop rosterpop'; pop.dataset.seat = s.id;
    pop.innerHTML = `<header><b>${esc(s.name)}</b></header>${items.map((it, i) => `<button class="ppi${it.off ? ' off' : ''}" data-i="${i}" data-act="${it.act}"${it.off ? ' disabled' : ''}>${icon(it.ic, 15)}<span><b>${esc(it.label)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')}`;
    document.getElementById('app').append(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth))}px`; pop.style.top = `${Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, r.bottom + 6))}px`;
    for (const x of pop.querySelectorAll('.ppi')) x.onclick = (ev) => { ev.stopPropagation(); const it = items[+x.dataset.i]; closePop(); it.run?.(); };
  }

  function render() {
    const c = app.sync.campaign; if (!c) return;
    const now = Date.now();
    for (const s of app.pv.seats.values()) active.set(s.seat, Math.max(active.get(s.seat) || 0, s.at));
    const here = c.seats.filter(s => s.online || s.id === c.me);
    const s2 = JSON.stringify([here, c.areas.map(t => [t.name, t.visibility]), app.area(), app.gm(), [...active].map(([k, v]) => [k, now - v < 8000])]);
    if (s2 === sig) return; sig = s2;
    if (pop && !here.some(s => s.id === pop.dataset.seat)) closePop(); // (they left, or were disconnected)
    el.innerHTML = '';
    for (const s of here) {
      const where = s.location ? app.areaName(s.location) : s.elsewhere ? 'elsewhere' : '—';
      const busy = now - (active.get(s.id) || 0) < 8000;
      const a = document.createElement('button');
      a.className = `av${s.kind === 'llm' ? ' agent' : ''}${s.id === c.me ? ' me' : ''}${s.online ? ' on' : ''}${busy ? ' busy' : ''}`;
      a.dataset.seat = s.id;
      a.style.setProperty('--c', s.color || '#888');
      a.title = tipOf(s);
      a.onmouseenter = () => { a.title = tipOf(seatOf(s.id) || s); }; // (their main pawn can change without the row re-drawing)
      a.innerHTML = `<span class="face">${s.kind === 'llm' ? icon('bot', 15) : esc((s.name || '?')[0].toUpperCase())}</span><span class="dot"></span><span class="where${s.location && app.areaHidden?.(s.location) ? ' hidden-area' : ''}">${s.location ? app.areaMark?.(s.location, 10) || '' : ''}${esc(where)}</span>`;
      const click = () => goToSeat(seatOf(s.id) || s);
      a.onclick = click;
      a.oncontextmenu = (ev) => { if (!app.gm() || s.id === c.me) return; ev.preventDefault(); menu(seatOf(s.id) || s, a); };
      a.addEventListener('pointerdown', (ev) => {
        if (!s.location || ev.button !== 0) return;
        const x0 = ev.clientX, y0 = ev.clientY; let ghost = null;
        const mv = (e) => { if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { ghost = a.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.append(ghost); } if (ghost) { ghost.style.left = `${e.clientX - 16}px`; ghost.style.top = `${e.clientY - 16}px`; } };
        const up = (e) => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          if (!ghost) return;
          ghost.remove();
          a.onclick = null; setTimeout(() => { a.onclick = click; }, 0);
          if (document.elementFromPoint(e.clientX, e.clientY)?.id === 'c') {
            if (app.pipAllowed?.() === false) app.setMain(s.location); // (a phone: no PiP; go there instead)
            else app.openPip(s.location, { owner: s.id }); // follows their pawns once that area has loaded
          }
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      el.append(a);
    }
  }
  app.roster = { target: (id) => { const s = seatOf(id); if (!s) return null; const t = target(s); return { kind: t.kind || null, id: t.rec?.id || null, why: t.why || null }; }, menu: (id) => { const s = seatOf(id), a = el.querySelector(`.av[data-seat="${id}"]`); if (s && a) menu(s, a); return !!pop; }, last: null };
  return { name: 'roster' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
