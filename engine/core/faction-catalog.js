// Shared discovery for commands, picker and shelves. Metadata decorates available assets; it never gates discovery.
const ORDER = ['altarpiece', 'idol', 'censer', 'sculpture', 'pillar', 'buttress', 'banner', 'relief', 'sigil', 'corbel']; // pillar: the free-standing column (2026-10-24)
const LABELS = { altarpiece: 'altar piece', buttress: 'pier', sigil: 'floor sigil' };
// words a slot's pieces answer to beyond their name (the bar also gets CATALOG_WORDS terms, client/barwords.js)
const SLOT_HINTS = { 'flavor-banner': 'wall hanging flag', 'flavor-pillar': 'pillar column support post', 'flavor-buttress': 'buttress flying buttress pier' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
export const factionMetadata = (lib, id) => Array.isArray(lib?.factions) ? lib.factions.find(f => f.id === id) : lib?.factions?.[id];
const singular = id => id.endsWith('s') && !id.endsWith('ss') ? id.slice(0, -1) : id;
const pieceLabel = (id, m = {}) => m.pieceLabel || (m.label && m.label.toLowerCase() !== id.replace(/-/g, ' ') ? m.label : cap(singular(id)));
export const isFactionSlot = cat => typeof cat === 'string' && cat.startsWith('flavor-');
export const factionOfSku = sku => sku?.shape || sku?.sku?.split('--')[1] || null;
export const factionSlotName = cat => LABELS[cat.replace(/^flavor-/, '')] || cat.replace(/^flavor-/, '').replace(/-/g, ' ');
export function factionCatalog(lib) {
  const slots = [...new Set([...Object.keys(lib?.objects || {}), ...(lib?.flavorSlots || [])])].filter(isFactionSlot).sort((a, b) => {
    const rank = c => { const i = ORDER.indexOf(c.slice(7)); return i < 0 ? ORDER.length : i; };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const found = new Map();
  for (const cat of slots) for (const sku of lib.objects[cat]?.skus || []) {
    const id = factionOfSku(sku); if (!id || !sku.url) continue;
    if (!found.has(id)) {
      const m = factionMetadata(lib, id) || {};
      found.set(id, { id, label: m.label || cap(id), pieceLabel: pieceLabel(id, m), group: m.group || 'neutral', emblem: m.emblem || null, aliases: [...new Set([singular(id), ...(m.aliases || [])])], slots: {}, ...(m.reverent && { reverent: true }) });
    }
    const f = found.get(id);
    if (!f.slots[cat]) f.slots[cat] = sku;
  }
  const factions = [...found.values()].sort((a, b) => a.label.localeCompare(b.label));
  for (const f of factions) f.emblem ||= f.slots['flavor-sigil']?.url || f.slots['flavor-banner']?.url || null;
  return { factions, slots };
}
export function factionPieceName(lib, cat, sku) {
  const k = typeof sku === 'string' ? lib.objects?.[cat]?.skus?.find(k => k.sku === sku) : sku;
  const id = factionOfSku(k), m = factionMetadata(lib, id);
  if (id && m?.names?.[cat]) return m.names[cat]; // a faith's pieces carry their own names: "Mihrab", "Crucifix", never "Muslim idol"
  return id ? `${pieceLabel(id, m)} ${factionSlotName(cat)}` : cap(factionSlotName(cat));
}
// Real-world faiths (2026-11-07, faith-factions): `reverent` factions never dress a room whose type only sinister factions
// dress (the cult sanctum, the dark cathedral: sacrificial altars, cages, blood bowls, bones). `omit` = core slots the
// faith deliberately does not use (a mosque has no idol); `ownSlots` = roles only that faith fills (the minbar).
export const isReverent = (lib, id) => !!factionMetadata(lib, id)?.reverent;
const SINISTER = new Set(['devils', 'spiders', 'dragons', 'skulls', 'tentacles']);
export function faithBarredType(type, lib) {
  const list = type?.flavors || [];
  if (!list.length) return false;
  const sinister = (f) => SINISTER.has(f) || factionMetadata(lib, f)?.group === 'sinister';
  return list.every(sinister);
}
// the cells of one shelf row: core slots for every faction (a deliberate omission is a blank spacer, a missing piece a
// visible gap); a slot some faction owns appears only in its owners' rows
export function factionRowSlots(lib, f, slots) {
  const owned = new Set(factionCatalog(lib).factions.flatMap(x => factionMetadata(lib, x.id)?.ownSlots || []));
  const m = factionMetadata(lib, f.id) || {}, mine = new Set(m.ownSlots || []), omit = new Set(m.omit || []);
  return slots.filter(cat => !owned.has(cat) || mine.has(cat)).map(cat => ({ cat, state: f.slots[cat] ? 'piece' : omit.has(cat) ? 'omit' : 'gap' }));
}
export function resolveFaction(lib, query) {
  const q = String(query || '').trim().toLowerCase();
  return factionCatalog(lib).factions.find(f => [f.id, f.label, f.pieceLabel, ...f.aliases].some(s => s.toLowerCase() === q))?.id || null;
}
export function factionSearchItems(lib) {
  const { factions, slots } = factionCatalog(lib);
  return factions.flatMap(f => slots.flatMap(cat => {
    const k = f.slots[cat], o = lib.objects[cat]; if (!k) return [];
    const aliases = [f.id, f.label, f.pieceLabel, ...f.aliases].join(' ');
    return [{ id: cat, name: factionPieceName(lib, cat, k), desc: o.desc || '', hint: `${aliases} faction ${f.reverent ? 'faith religion historical temple' : 'flavor religion cult temple heraldry emblem'} ${SLOT_HINTS[cat] || ''}`, place: o.place, sku: k.sku, url: k.url, flat: k.kind === 'flat', aff: o.aff || [], faction: f.id }];
  }));
}
