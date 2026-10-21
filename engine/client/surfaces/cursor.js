// Tool state, shown by the cursor (Harry 2026-10-03: "the mouse cursor changes, very visibly and with a little
// animation, whenever a usable tool becomes active"). The system pointer becomes a crosshair and a badge rides beside
// it: a building for the building tool, a dashed room for the room tool, and for placing, the thing itself, turning
// (a living preview). Every switch pops the badge and throws a ring so it cannot be missed. No tool, no badge.
import { icon } from '../icons.js';

export function cursorSurface(R, app) {
  const canvas = document.getElementById('c');
  const el = document.getElementById('toolCursor');
  let sig = '', over = false, x = -100, y = -100, unseen = false, hideT = null, brief = false;
  const pop = () => { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); unseen = false; };
  const kindOf = (m) => !m ? null : m.kind === 'building' ? 'building' : m.kind === 'room' ? 'room' : m.kind === 'place' ? 'place' : null;
  function sync() {
    const m = app.mode, k = kindOf(m);
    // Group placement already labels every member's ghost with one count/hint beside the pointer.
    const s = k && !m.pick ? `${k}|${m.type || ''}|${m.cat?.id || ''}` : '';
    for (const t of ['build', 'room', 'place']) { const on = k === (t === 'build' ? 'building' : t); canvas.classList.toggle(`tool-${t}`, on); document.documentElement.classList.toggle(`tool-${t}`, on); } // the real pointer (the tray too)
    app.pointerTool = k;
    if (s === sig) return;
    sig = s;
    app.previews.detachAll(el);
    if (!k || m.pick) { el.hidden = true; el.className = ''; app.cursorState = null; return; }
    const label = k === 'building' ? m.node?.label : k === 'room' ? app.roomgen.typeList.find(t => t.key === m.type)?.label : m.cat?.name;
    el.innerHTML = `<span class="tc-ring"></span><span class="tc-badge">${k === 'place' ? `<span class="tc-pv">${icon('tool-place', 22)}</span>` : icon(k === 'building' ? 'tool-building' : 'tool-room', 26)}</span><span class="tc-cap">${esc(label || '')}</span>`;
    if (k === 'place') app.previews.attach(el.querySelector('.tc-pv'), app.previewOf({ id: m.cat.id, sku: m.cat.sku, place: m.cat.place }));
    el.className = `tc-${k}`;
    el.hidden = !over;
    // restart the pop (a reflow between removing and adding the class replays the animation)
    if (over) pop(); else { unseen = true; el.classList.add('pop'); } // picked in the menu: the pop plays when the pointer reaches the world
    // the badge only announces the switch (the pointer itself carries the tool); a placed thing keeps its turning preview
    clearTimeout(hideT); if (k !== 'place') hideT = setTimeout(() => { brief = false; el.hidden = true; }, 1600); brief = true;
    app.cursorState = { kind: k, label, switches: (app.cursorState?.switches || 0) + 1, at: performance.now() };
    place();
  }
  const place = () => { el.style.transform = `translate(${x + 18}px, ${y + 16}px)`; };
  // the badge rides the pointer over the WORLD only: over the menu, the bar or a panel it would cover what you read
  addEventListener('pointermove', (ev) => { x = ev.clientX; y = ev.clientY; over = ev.target === canvas && !app.build?.isOpen; if (sig) { if (over && unseen) { pop(); brief = true; clearTimeout(hideT); if (app.pointerTool !== 'place') hideT = setTimeout(() => { brief = false; el.hidden = true; }, 1600); } el.hidden = !(over && (brief || app.pointerTool === 'place')); place(); } }, true);
  canvas.addEventListener('pointerleave', () => { over = false; el.hidden = true; });
  app.on((what) => { if (what === 'refresh' || what === 'tool') sync(); if (what === 'build.open') { over = false; el.hidden = true; } });
  return { name: 'cursor' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
