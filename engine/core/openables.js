// WHAT OPENS (2026-10-30, Harry: "we might really need to go over *all* the opens and closes, because a lot of them
// don't show state"). One rule for the game, the relay and an AI seat's scene: a thing opens when the catalog says so
// (aff 'open') OR when it has an open state of its own to show (an "-open" twin, or a twin whose `open_of` names it:
// the raised portcullis). Before this, eight kinds had an open model nobody could reach (wardrobes, cupboards, the
// bread oven, the iron maiden, the small window's shutters, three small boxes): their twin was hidden from the catalog
// as a state, and they had no Open. Five of them open now (SHUT_LOOKS_OPEN, below, were the other three: they open
// too since their shut models were re-made). The floor trapdoor and the oubliette hatch open since they have open
// twins (experiments/2026-10-30-openmesh).
// How each shows it is client/openlook.js.
// experiments/2026-10-30-openables/INVENTORY.md is the census.

// the open twin of a catalog object: "<id>-open", or the object whose open_of is this one (null: none)
export function openTwinId(lib, cat) {
  const L = lib?.objects; if (!L || !cat || !L[cat]) return null;
  if (L[`${cat}-open`]) return `${cat}-open`;
  for (const o of Object.values(L)) if (o.open_of === cat) return o.id;
  return null;
}
// an object that is itself an open state ("chest-plain-open", "portcullis-raised"): shown, and switched, from its base
export const isOpenStateId = (lib, id) => !!lib?.objects?.[id]?.open_of || (typeof id === 'string' && id.endsWith('-open') && !!lib?.objects?.[id.slice(0, -5)]);

// kinds with an open twin whose SHUT model already looks open (Gemini, blind, at table distance: "an open chest
// overflowing with loot", "a furnace with an open burning hearth"): an Open that changes nothing you can see would only
// mislead, so such a kind stays a thing that does not open until a shut model is made (INVENTORY.md). Empty since
// 2026-10-30 (experiments/2026-10-30-openmesh): the bread oven, the farrier's box and the grooming box have shut models
// that read shut, and open.
export const SHUT_LOOKS_OPEN = new Set([]);
const memo = new WeakMap();
// does a thing of this catalog kind open? (cached per library)
export function opensIn(lib, cat) {
  if (!lib?.objects || !cat) return false;
  let m = memo.get(lib); if (!m) memo.set(lib, m = new Map());
  if (!m.has(cat)) { const o = lib.objects[cat]; m.set(cat, !!o && (!!o.aff?.includes('open') || (!isOpenStateId(lib, cat) && !SHUT_LOOKS_OPEN.has(cat) && !!openTwinId(lib, cat)))); }
  return m.get(cat);
}
