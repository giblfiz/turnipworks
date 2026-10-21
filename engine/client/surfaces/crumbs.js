// The selection's breadcrumb (Building ▸ Room ▸ Table ▸ Cup): click any level to select it. The guaranteed way out
// of a too-specific or too-coarse selection. Shift+Enter / Enter climb the same hierarchy from the keyboard.
import { icon } from '../icons.js';

export function crumbsSurface(R, app) {
  const el = document.getElementById('crumbs');
  const kindIcon = { building: 'house', room: 'square-dashed', object: 'box', token: 'user', wall: 'brick-wall' };
  app.on((what) => { if (what === 'selection' || what === 'refresh' || what === 'change') render(); });
  function render() {
    const sel = app.selected();
    if (!sel.length) { el.hidden = true; return; }
    const chain = sel.length === 1 ? app.crumbs(sel[0]) : [...(app.parentOf(sel[0]) ? app.crumbs(app.parentOf(sel[0])) : []), { id: '_many', kind: 'many', n: sel.length }];
    el.innerHTML = chain.map((e, i) => e.kind === 'many' ? `<span class="crumb cur">${e.n} selected</span>` : `<button class="crumb${i === chain.length - 1 ? ' cur' : ''}" data-id="${e.id}">${icon(kindIcon[e.kind] || 'box', 13)} ${esc(app.nameOf(e))}${e.hidden ? ` ${icon('eye-off', 12, 'hid')}` : ''}${e.locked ? ` ${icon('lock', 12)}` : ''}${e.pinned ? ` ${icon('pin', 12)}` : ''}</button>`).join('<span class="sep">▸</span>');
    el.hidden = false;
    for (const b of el.querySelectorAll('[data-id]')) b.onclick = () => app.select(b.dataset.id);
  }
  return { name: 'crumbs' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
