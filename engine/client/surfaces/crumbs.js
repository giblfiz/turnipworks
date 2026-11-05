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
    el.innerHTML = chain.map((e, i) => e.kind === 'many' ? `<span class="crumb cur">${e.n} selected</span>` : `<button class="crumb${i === chain.length - 1 ? ' cur' : ''}" data-id="${e.id}" title="${esc(app.nameOf(e))}">${icon(kindIcon[e.kind] || 'box', 13)} <span class="cname">${esc(app.nameOf(e))}</span>${e.hidden ? ` ${icon('eye-off', 12, 'hid')}` : ''}${e.locked ? ` ${icon('lock', 12)}` : ''}${e.pinned ? ` ${icon('pin', 12)}` : ''}</button>`).join('<span class="sep">▸</span>');
    el.hidden = false;
    for (const b of el.querySelectorAll('[data-id]')) b.onclick = () => app.select(b.dataset.id);
  }
  // the column under the bar (index.html #underBar: the area pills, then these crumbs) ends at --under-bar, where a
  // conditional button docked at the top sits (style.css .cbtn.dock-top), so it never lands on either of them
  const col = document.getElementById('underBar'), bar = document.getElementById('bar'), appEl = document.getElementById('app');
  // Measured at once (a microtask) whenever anything in the column changes: a crumb shown or re-written, a pill row
  // re-drawn. The ResizeObserver alone only reported at the next frame, and a heavy frame (a big map, a slow GPU) can
  // be seconds, so a button docked meanwhile sat at the old slot, on the crumbs (browser_selbar.py, 1440x900). The
  // observer stays for what is not a DOM change: the window, the text size, a font arriving.
  let last = '';
  const slot = () => { let b = bar.getBoundingClientRect().bottom; for (const k of col.children) { const r = k.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom); } const v = `${Math.round(b)}px`; if (v !== last) { last = v; appEl.style.setProperty('--under-bar', v); } };
  if (col && bar && appEl && typeof ResizeObserver === 'function') { const ro = new ResizeObserver(slot); ro.observe(bar); ro.observe(col); new MutationObserver(() => { for (const k of col.children) ro.observe(k); slot(); }).observe(col, { childList: true, subtree: true, attributes: true, characterData: true }); for (const k of col.children) ro.observe(k); addEventListener('resize', slot); slot(); }
  return { name: 'crumbs' };
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
