import { factionCatalog, factionSearchItems, factionSlotName } from '../core/faction-catalog.js';
import { T } from './tuner.js';

// A shelf is a view of the same SKU catalog the command bar places; holes remain visible in every row.
export function createFactionShelf(app) {
  const panel = document.createElement('section'); panel.id = 'factionShelf'; panel.className = 'clip'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Factions library');
  Object.assign(panel.style, { position: 'fixed', zIndex: 25, left: '16px', top: '120px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 144px)', overflow: 'auto', padding: '14px', borderRadius: '12px', background: 'var(--surface-solid)', color: 'var(--ink)', border: '1px solid var(--line-strong)', boxShadow: 'var(--shadow)', pointerEvents: 'auto' });
  document.getElementById('app').append(panel); // share the preview canvas's stacking context
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const close = () => {
    if (panel.hidden) return false;
    panel.hidden = true; app.previews.detachAll(panel);
    const i = app.escapeStack.indexOf(close); if (i >= 0) app.escapeStack.splice(i, 1);
    return true;
  };
  let drag = null;
  function show() {
    app.condButtons?.hide('faction');
    const { factions, slots } = factionCatalog(app.lib), items = factionSearchItems(app.lib);
    const byKey = new Map(items.map(c => [`${c.faction}|${c.id}`, c]));
    app.previews.detachAll(panel);
    panel.innerHTML = `<header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>Factions</b><button data-close aria-label="Close factions library">×</button></header><div style="font-size:12px;margin-bottom:10px">Click a piece, then place it in the world · or drag it out</div>`;
    for (const f of factions) {
      const row = document.createElement('div'); row.className = 'faction-shelf-row'; row.dataset.faction = f.id;
      Object.assign(row.style, { display: 'grid', gridTemplateColumns: `100px repeat(${slots.length}, 82px)`, gap: '6px', alignItems: 'center', paddingBottom: '10px' });
      row.innerHTML = `<div style="display:flex;align-items:center;gap:6px">${f.emblem ? `<img src="${esc(new URL(f.emblem, T.base).href)}" alt="" width="32" height="32" style="object-fit:cover;border-radius:50%">` : ''}<b>${esc(f.label)}</b></div>`;
      for (const cat of slots) {
        const item = byKey.get(`${f.id}|${cat}`), cell = document.createElement(item ? 'button' : 'div');
        Object.assign(cell.style, { width: '82px', minHeight: '94px', fontSize: '11px', padding: '4px', textAlign: 'center' });
        if (!item) { cell.className = 'faction-gap'; cell.setAttribute('aria-label', `${f.label}: missing ${factionSlotName(cat)}`); cell.title = cell.getAttribute('aria-label'); cell.style.opacity = '.45'; cell.innerHTML = `—<br>${esc(factionSlotName(cat))}`; }
        else {
          cell.dataset.sku = item.sku; cell.title = item.name; cell.setAttribute('aria-label', item.name);
          cell.innerHTML = `${item.flat ? `<img class="faction-flat" src="${esc(new URL(item.url, T.base).href)}" alt="" draggable="false" style="display:block;width:72px;height:64px;object-fit:contain">` : '<span data-preview style="display:block;width:72px;height:64px"></span>'}<span>${esc(item.name)}</span>`;
          cell.onpointerdown = ev => { if (ev.button !== 0 || !app.can('object')) return; ev.stopPropagation(); drag = { item, x: ev.clientX, y: ev.clientY }; };
        }
        row.append(cell);
      }
      panel.append(row);
    }
    panel.hidden = false;
    panel.querySelector('[data-close]').onclick = close;
    for (const cell of panel.querySelectorAll('[data-sku]')) {
      const item = items.find(c => c.sku === cell.dataset.sku);
      if (!item.flat) app.previews.attach(cell.querySelector('[data-preview]'), app.previewOf(item));
    }
    if (!app.escapeStack.includes(close)) app.escapeStack.push(close);
  }
  addEventListener('pointermove', ev => {
    if (!drag) return;
    if (!drag.started && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 6) { drag.started = true; panel.hidden = true; app.modes.place(drag.item, { viaDrag: true }); }
    if (drag.started) { const p = app.groundAt(ev.clientX, ev.clientY); app.cursor = p; app.modes.hover(app.rayAt(ev.clientX, ev.clientY), p, ev); }
  });
  addEventListener('pointerup', ev => {
    if (!drag) return; const d = drag; drag = null;
    panel.hidden = false; close();
    if (d.started) {
      if (document.elementFromPoint(ev.clientX, ev.clientY)?.id === 'c') app.modes.placeAt(app.rayAt(ev.clientX, ev.clientY), app.groundAt(ev.clientX, ev.clientY), { shiftKey: false });
      else app.modes.cancel();
    } else app.modes.place(d.item, { keep: ev.shiftKey });
  });
  return { show, close, shown: () => !panel.hidden };
}
