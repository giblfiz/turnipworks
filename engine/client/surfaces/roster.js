// The corner roster: a top-right row of avatars, one per seat (seat colour, initial, an activity dot, a location
// label). Click to jump to where they are; drag an avatar out onto the world to watch their area in a PiP that
// follows their tokens. Agents are dashed and say whose agent they are.
import { icon } from '../icons.js';

export function rosterSurface(R, app) {
  const el = document.getElementById('roster');
  let sig = '';
  const active = new Map(); // seat -> last time we saw them move (presence) or act (log)
  app.on((what) => { if (what === 'refresh' || what === 'change') render(); });
  setInterval(render, 2000);
  function render() {
    const c = app.sync.campaign; if (!c) return;
    const now = Date.now();
    for (const s of app.pv.seats.values()) active.set(s.seat, Math.max(active.get(s.seat) || 0, s.at));
    const s2 = JSON.stringify([c.seats, c.areas.map(t => [t.name, t.visibility]), app.area(), [...active].map(([k, v]) => [k, now - v < 8000])]);
    if (s2 === sig) return; sig = s2;
    el.innerHTML = '';
    for (const s of c.seats) {
      const where = s.location ? app.areaName(s.location) : s.elsewhere ? 'elsewhere' : '—';
      const busy = now - (active.get(s.id) || 0) < 8000;
      const a = document.createElement('button');
      a.className = `av${s.kind === 'llm' ? ' agent' : ''}${s.id === c.me ? ' me' : ''}${s.online ? ' on' : ''}${busy ? ' busy' : ''}`;
      a.dataset.seat = s.id;
      a.style.setProperty('--c', s.color || '#888');
      a.title = `${s.name}${s.label ? ` (${s.label})` : s.role === 'gm' ? ' (GM)' : ''} · ${where}${s.online ? '' : ' · offline'}${s.location ? '\nClick: go there · drag into the area: watch in a picture-in-picture' : ''}`;
      a.innerHTML = `<span class="face">${s.kind === 'llm' ? icon('bot', 15) : esc((s.name || '?')[0].toUpperCase())}</span><span class="dot"></span><span class="where${s.location && app.areaHidden?.(s.location) ? ' hidden-area' : ''}">${s.location ? app.areaMark?.(s.location, 10) || '' : ''}${esc(where)}</span>`;
      a.onclick = () => s.location && app.setMain(s.location);
      a.addEventListener('pointerdown', (ev) => {
        if (!s.location) return;
        const x0 = ev.clientX, y0 = ev.clientY; let ghost = null;
        const mv = (e) => { if (!ghost && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) { ghost = a.cloneNode(true); ghost.classList.add('drag-ghost'); document.body.append(ghost); } if (ghost) { ghost.style.left = `${e.clientX - 16}px`; ghost.style.top = `${e.clientY - 16}px`; } };
        const up = (e) => {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          if (!ghost) return;
          ghost.remove();
          a.onclick = null; setTimeout(() => { a.onclick = () => s.location && app.setMain(s.location); }, 0);
          if (document.elementFromPoint(e.clientX, e.clientY)?.id === 'c') {
            app.openPip(s.location, { owner: s.id }); // follows their pawns once that area has loaded
          }
        };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      el.append(a);
    }
  }
  return { name: 'roster' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
