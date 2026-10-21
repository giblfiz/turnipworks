// Faction inheritance and asset-only re-dressing. No layout solver runs when a faction changes:
// existing slot objects keep their identity, transforms, pin, parent and edits; deleted objects stay deleted.
import { fnv1a } from './hash.js';
import { factionCatalog, factionPieceName } from './faction-catalog.js';

export const explicitFaction = e => {
  const value = e?.kind === 'room' ? e.recipe?.flavor : e?.flavor || (e?.kind === 'building' ? e.gen?.flavor : null);
  return value && value !== 'inherit' ? value : null;
};
const roomType = (types, key) => Array.isArray(types) ? types.find(t => t.key === key) : types?.[key];
// A wall banner is already a faction mark; freestanding banner poles have no equivalent slot.
export const factionSlot = e => e?.cat?.startsWith('flavor-') ? e.cat : ({ 'banner-wall': 'flavor-banner' })[e?.cat] || null;
export const isFactionPiece = e => e?.kind === 'object' && !!factionSlot(e);
function defaultForRoom(entities, room, lib, types) {
  // A building has one automatic faction even if its recipes contain several religious room types.
  const source = room.building ? Object.values(entities).filter(e => e.kind === 'room' && e.building === room.building && roomType(types, e.recipe?.type)?.flavors?.length).sort((a,b) => (a.order || 0) - (b.order || 0))[0] || room : room;
  // New factions require an explicit choice; installing assets must not re-roll existing buildings.
  const list = (roomType(types, source.recipe?.type)?.flavors || []).filter(f => ['sun', 'moon', 'devils', 'spiders'].includes(f));
  const made = list.filter(f => lib.objects?.['flavor-idol']?.skus.some(s => s.shape === f));
  const pool = made.length ? made : list;
  return pool.length ? pool[room.building ? fnv1a(room.building + 'flavor') % pool.length : 0] : null;
}
export function effectiveFaction(entities, entityOrId, lib, types) {
  const e = typeof entityOrId === 'string' ? entities[entityOrId] : entityOrId;
  if (!e) return null;
  const own = explicitFaction(e); if (own) return own;
  if (e.kind === 'object') {
    const inherited = effectiveFaction(entities, entities[e.room], lib, types);
    return inherited || lib.objects?.[e.cat]?.skus.find(s => s.sku === e.sku)?.shape || null;
  }
  if (e.kind === 'room') return explicitFaction(entities[e.building]) || defaultForRoom(entities, e, lib, types);
  if (e.kind === 'building') {
    const room = Object.values(entities).find(r => r.kind === 'room' && r.building === e.id && roomType(types, r.recipe?.type)?.flavors?.length);
    return room ? defaultForRoom(entities, room, lib, types) : null;
  }
  return null;
}
export function factionScope(entities, id) {
  const e = entities[id];
  if (isFactionPiece(e)) return [e];
  if (e?.kind === 'room') return Object.values(entities).filter(o => isFactionPiece(o) && o.room === id && !explicitFaction(o));
  if (e?.kind === 'building') {
    const rooms = new Set(Object.values(entities).filter(r => r.kind === 'room' && r.building === id && !explicitFaction(r)).map(r => r.id));
    return Object.values(entities).filter(o => isFactionPiece(o) && rooms.has(o.room) && !explicitFaction(o));
  }
  return [];
}
export function withFaction(e, flavor) {
  const own = flavor && flavor !== 'inherit' ? flavor : null;
  if (e.kind === 'room') { const recipe = { ...e.recipe }; delete recipe.flavor; if (own) recipe.flavor = own; return { ...e, recipe }; }
  const next = { ...e }; delete next.flavor; if (own) next.flavor = own;
  if (e.kind === 'building' && e.gen) { next.gen = { ...e.gen }; delete next.gen.flavor; if (own) next.gen.flavor = own; }
  return next;
}
export function planFactionChange(entities, id, flavor, lib, types) {
  flavor = flavor || 'inherit';
  if (!entities[id]) throw new Error('Choose a room, building or faction piece');
  const catalog = factionCatalog(lib);
  if (flavor !== 'inherit' && !catalog.factions.some(f => f.id === flavor)) throw new Error(`Unknown faction: ${flavor}`);
  const E = { ...entities, [id]: withFaction(entities[id], flavor) };
  const swaps = factionScope(E, id).flatMap(o => {
    const f = effectiveFaction(E, o, lib, types), cat = factionSlot(o), sku = lib.objects?.[cat]?.skus.find(k => k.shape === f);
    // A missing slot is suppressed reversibly, retaining its identity and edits for a later faction.
    return sku?.url ? [{ id: o.id, cat, faction: f, sku: sku.sku, url: sku.url, flat: sku.kind === 'flat', name: factionPieceName(lib, cat, sku.sku) }] : f ? [{ id: o.id, missing: true }] : [];
  });
  return { id, flavor, swaps };
}
