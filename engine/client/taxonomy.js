// The Build menu's content tree: Genre → Type → Room (Harry 2026-10-04: the furniture and object levels went away;
// a room type's things come from its library area in the PiP). Like folders, with symlinks: a thing that belongs in
// several places is listed in each. Built at boot from what already exists:
//   types      the catalog's setting codes (TAV, NOB, CAS…), engine/client/data/types.json (tools/build_types.py)
//   rooms      the tuner's room recipes; a room's recipes ('tav-common-room') name its type
//   furniture  a room's recipe slots, things that stand, hang or mount on their own (catalog place floor / wall /
//              ceiling / ground: the "furnish / store" side)
//   objects    the room's things that sit ON something (place 'surface': the "dress" side), listed under each piece of
//              its furniture that has a top
// Every node has a hotkey letter, unique among its siblings, so the tree chords (B, then letters).
export const LEVELS = ['genre', 'type', 'room'];
export const LEVEL_LABEL = { genre: 'Genres', type: 'Types', room: 'Rooms' };
export const LEVEL_KEY = { genre: 'G', type: 'T', room: 'R' }; // Shift+letter jumps to that level
const SLOT_ORDER = ['anchor', 'furnish', 'store', 'light', 'dress'];
export const KIT_LABELS = () => KIT_LABEL;
export const KIT_PIECES = ['wall-straight', 'wall-window-small', 'wall-doorway', 'door-plank', 'door-reinforced', 'door-double-grand'];
const KIT_LABEL = { 'wall-straight': 'Wall', 'wall-window-small': 'Window', 'wall-doorway': 'Doorway', 'door-plank': 'Door (plank)', 'door-reinforced': 'Door (reinforced)', 'door-double-grand': 'Double door' };
// furniture with a top that things sit on (the catalog has no "has a top" field yet; its role names say it)
const HAS_TOP = /(^|-)(table|desk|counter|bar|shelf|shelves|shelving|bench|chest|washstand|barrel|cask|crate|dresser|cabinet|sideboard|trunk|altar|workbench|tun|hearth|oven|cupboard|lectern|stand|board|rack|vanity|tray)(-|$)/;

export function buildTaxonomy({ lib, roomTypes, data, usable = () => true }) {
  const nodes = new Map();
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const nameOf = (id) => cap(id.replace(/-/g, ' '));
  const libItem = (id) => { const o = lib.objects[id]; return o && o.place !== 'kit' && !id.endsWith('-open') && o.skus.some(k => (k.kind === 'flat' || k.bounds) && usable(k)) ? o : null; };
  const add = (n) => { nodes.set(n.id, n); return n; };

  const genres = data.genres.map(g => add({ id: `g:${g.key}`, level: 'genre', label: g.label, key: g.key, parent: null, children: [] }));
  for (const t of data.types) {
    const g = nodes.get(`g:${t.genre}`); if (!g) continue;
    const rooms = roomTypes.filter(r => (r.recipes || []).some(x => x.startsWith(t.code.toLowerCase() + '-')));
    const have = t.roles.filter(id => libItem(id)).length;
    const tn = add({ id: `t:${t.code}`, level: 'type', label: t.label, code: t.code, parent: g.id, children: [], have, roles: t.roles.length,
      note: rooms.length ? `${rooms.length} room${rooms.length === 1 ? '' : 's'}` : 'no room recipes yet', disabled: !rooms.length });
    g.children.push(tn.id);
    for (const r of rooms) {
      const rn = add({ id: `r:${t.code}:${r.key}`, level: 'room', label: r.label, roomKey: r.key, cells: r.cells, family: r.family, parent: tn.id, children: [], furniture: [] });
      tn.children.push(rn.id);
      const seen = new Set(), furn = [], objs = [];
      const slots = Object.keys(r.slots || {}).sort((a, b) => (SLOT_ORDER.indexOf(a) + 99) % 99 - (SLOT_ORDER.indexOf(b) + 99) % 99);
      for (const k of slots) {
        if (k === 'sets') continue;
        for (const id of r.slots[k]) {
          if (seen.has(id)) continue; seen.add(id);
          const o = libItem(id); if (!o) continue;
          (o.place === 'surface' ? objs : furn).push({ id, o, slot: k });
        }
      }
      for (const f of furn) {
        rn.furniture.push({ id: `f:${r.key}:${f.id}`, label: nameOf(f.id), cat: f.id, place: f.o.place, top: HAS_TOP.test(f.id) });
      }
      rn.objects = objs.map(x => x.id); // the room's objects, for its library shelves
      // walls, doors and windows, placeable by hand (in the room's own wall family first)
      for (const id of KIT_PIECES) {
        const o = lib.objects[id]; if (!o) continue;
        const k = o.skus.find(s => s.family === r.family && s.bounds && usable(s)) || o.skus.find(s => s.bounds && usable(s)); if (!k) continue;
        rn.furniture.push({ id: `f:${r.key}:${id}`, label: KIT_LABEL[id] || nameOf(id), cat: id, sku: k.sku, place: 'kit', kit: true });
      }
    }
  }
  for (const n of nodes.values()) assignKeys(n.children.map(id => nodes.get(id)));
  assignKeys(genres);
  return {
    nodes, genres: genres.map(g => g.id),
    get: (id) => nodes.get(id),
    childrenOf: (id) => (id == null ? genres.map(g => g.id) : nodes.get(id)?.children || []).map(c => nodes.get(c)),
    siblingsOf: (id) => { const n = nodes.get(id); return n?.parent ? nodes.get(n.parent).children.map(c => nodes.get(c)) : genres; },
    pathOf: (id) => { const out = []; for (let n = nodes.get(id); n; n = n.parent && nodes.get(n.parent)) out.unshift(n.id); return out; },
    // the first descendant path that reaches a level (for Shift+letter jumps into levels below the current one)
    firstAt: (fromId, level) => {
      const walk = (ids) => { for (const id of ids) { const c = nodes.get(id); if (c.disabled) continue; if (c.level === level) return c.id; const r = walk(c.children); if (r) return r; } return null; };
      return walk(fromId ? nodes.get(fromId)?.children || [] : genres.map(g => g.id));
    },
  };
}

// unique letters per sibling list: word initials, then the label's other letters, then any letter, then digits
function assignKeys(list) {
  const used = new Set();
  for (const n of list) {
    const words = n.label.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const cands = [...words.map(w => w[0]), ...words.join(''), ...'abcdefghijklmnopqrstuvwxyz0123456789'];
    n.hot = cands.find(c => /[a-z0-9]/.test(c) && !used.has(c)) || null;
    if (n.hot) used.add(n.hot);
  }
}
