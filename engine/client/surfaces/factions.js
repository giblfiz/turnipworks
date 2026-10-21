// One data-driven two-row emblem grid, shared by the ring and the fading drag-out offer.
import { factionCatalog } from '../../core/faction-catalog.js';
import { effectiveFaction, explicitFaction } from '../../core/factions.js';
import { T } from '../tuner.js';
import { icon } from '../icons.js';

export const factionTarget = (e) => !!e && (e.kind === 'room' || e.kind === 'building' || (e.kind === 'object' && e.cat?.startsWith('flavor-')));
export const factionRows = (factions) => [factions.filter(f => f.group !== 'sinister'), factions.filter(f => f.group === 'sinister')];
const emblemUrl = (src) => !src ? '' : /^(?:https?:|data:|\/)/.test(src) ? src : T.base + src;

export function factionGrid(app, entity, { choose, conditional = false } = {}) {
  const grid = document.createElement('div'); grid.className = 'faction-grid'; grid.setAttribute('aria-label', 'Faction');
  const catalog = factionCatalog(T.lib), explicit = explicitFaction(entity), effective = effectiveFaction(app.entities(), entity, T.lib, T.types);
  if (!conditional && entity.kind !== 'building') {
    const inherit = document.createElement('button'); inherit.className = 'faction-inherit'; inherit.dataset.faction = 'inherit';
    inherit.textContent = entity.kind === 'room' ? "As the building's" : "As the room's";
    inherit.setAttribute('aria-pressed', String(!explicit)); inherit.title = `Inherit${effective ? ` (${catalog.factions.find(f => f.id === effective)?.label || effective})` : ''}`;
    inherit.addEventListener('click', (ev) => { ev.stopPropagation(); choose('inherit'); }); grid.append(inherit);
  }
  for (const [i, factions] of factionRows(catalog.factions).entries()) {
    const row = document.createElement('div'); row.className = 'faction-row'; row.dataset.row = i; row.setAttribute('role', 'group');
    row.setAttribute('aria-label', i ? 'Sinister factions' : 'Other factions');
    for (const f of factions) {
      const b = document.createElement('button'); b.className = 'faction-choice'; b.dataset.faction = f.id;
      b.title = `${f.label}${effective === f.id && !explicit ? ' (inherited)' : ''}`; b.setAttribute('aria-label', b.title);
      b.setAttribute('aria-pressed', String(explicit === f.id)); b.classList.toggle('inherited', !explicit && effective === f.id);
      if (conditional) b.tabIndex = -1;
      if (f.emblem) { const img = document.createElement('img'); img.src = emblemUrl(f.emblem); img.alt = ''; img.draggable = false; b.append(img); }
      else b.innerHTML = icon('sun', 28);
      if (entity.kind === 'object' && !f.slots[entity.cat]) { b.disabled = true; b.title += ' — this slot is missing'; b.setAttribute('aria-label', b.title); }
      b.addEventListener('click', (ev) => { ev.stopPropagation(); choose(f.id); }); row.append(b);
    }
    grid.append(row);
  }
  return grid;
}

export function setupFactionUI(app) {
  const seen = new Set();
  const hasSlots = (room) => {
    const type = T.types.find(t => t.key === room.recipe?.type);
    return Object.values(type?.slots || {}).flat().some(cat => cat.startsWith('flavor-'));
  };
  app.offerFaction = (id) => {
    const e = app.ent(id); if (!e || !app.can('room')) return;
    const rooms = e.kind === 'building' ? Object.values(app.entities()).filter(r => r.kind === 'room' && r.building === id) : [e];
    if (!rooms.some(hasSlots)) return;
    const key = `${e.kind}:${e.gen?.code || e.recipe?.type || e.id}`;
    if (seen.has(key)) return; seen.add(key);
    app.condButtons.show('faction', { cls: 'faction-offer', dock: 'top', text: '', life: 10000, area: app.area(), data: { id },
      when: () => !!app.ent(id),
      render: (el) => el.append(factionGrid(app, e, { conditional: true, choose: (flavor) => { app.setFaction(id, flavor); app.condButtons.hide('faction'); } })),
    });
  };
}
