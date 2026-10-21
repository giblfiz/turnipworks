// THE ☰ MENU'S SHAPE. ONE table. The selection ring's open circle, its sub-menus and the Space chord tree are all
// generated from it, so they cannot drift apart; the command bar still finds every command by name (it reads the
// registry, not this).
//
// History (docs/UI.md, "The selection ring"):
//   2026-10-05 morning   a room's ☰ had grown to 60-odd options (one per room type, wall style and floor), so the whole
//                        menu was regrouped into Replace ▸ / Edit ▸ / Copy ▸ with levels inside the flyouts.
//   2026-10-05 evening   Harry: "We really butchered the hamburger menu by doing submenus. We DON'T need a cut copy
//                        paste set of options in there, and when a sub-menu spawns it should spawn near the button that
//                        spawned it (covering that part of the radial), and for normal items other than the 'replace
//                        with' item, we don't need submenus; everything in Edit can come back out."
// So: ONE FLAT LEVEL, in this fixed order (the same kind of thing always gets the same layout; what can't be done for
// the selection is not shown). A sub-menu exists only where a long list is unavoidable.
//   cmd    a command by id: one button, one click
//          opens: 'x'   the command itself opens something at its button (replace with similar: its turning variants;
//                       a room's fog height: a slider); the button reads `title ▸`
//   list   every available command whose id starts with this prefix, behind ONE button that opens a sub-menu of them
//          (a room's types, walls and floors; a pawn's conditions and indicators). A list that comes out with a single entry is shown
//          as that entry.
// To rearrange the menu, edit this table and nothing else.
export const MENU = [
  { cmd: 'thing.light', key: 'l' },                 // Light / Put out
  { cmd: 'thing.open', key: 'o' },                  // Open / Close
  { cmd: 'faction.set', key: 'v', opens: 'faction', title: 'Faction' },
  { cmd: 'thing.replace', key: 'r', opens: 'replace', title: 'Replace' },
  { list: 'room.type.', title: 'Room type', icon: 'house', key: 't' },     // (chords and the bar; off the ring: RING_CUT)
  { list: 'room.walls.', title: 'Walls', icon: 'brick-wall', key: 'w' },
  { list: 'room.floor.', title: 'Floor', icon: 'footprints', key: 'f' },   // (chords and the bar; off the ring)
  { cmd: 'room.fog', key: 'g', opens: 'fog', title: 'Fog height' },  // a slider at the button
  { list: 'roof.style.', title: 'Style', icon: 'house', key: 'y' },   // a roof: thatch, clay tile, slate, wood shingle, flat (with a swatch each)
  { list: 'building.roof.', title: 'Roof style', icon: 'house', key: 'y' }, // a building: the style its roofs wear
  { list: 'building.storeys.', title: 'Storeys', icon: 'layers', key: 'o' }, // a generated building: make it again with 1, 2 or 3 storeys (docs/BUILDINGS.md)
  { cmd: 'building.reroll', key: 'b' },             // a generated building: a new layout on the same footprint
  { cmd: 'roof.reroll', key: 'e' },                 // (on a roof's closed ring: a die; new dormers and finial)
  { cmd: 'roof.hide', key: 'h' },                   // Hide roof / Show roof
  { cmd: 'room.roofShow', key: 'j' },               // a room whose roof was hidden: put it back
  { cmd: 'room.reroll', key: 'e' },                 // (on a room's closed ring; here for the chord tree)
  { cmd: 'room.rotate', key: 'q' },                 // (the same)
  // a pawn (Harry 2026-10-06): sheet and damage are on its closed ring (here for the chord tree); then its two lists
  { cmd: 'pawn.sheet', key: 's', opens: 'sheet', title: 'Sheet' },
  { cmd: 'pawn.damage', key: 'v' },
  { list: 'pawn.cond.', title: 'Conditions', icon: 'badge-alert', key: 'c' },
  { list: 'pawn.mark.', title: 'Indicators', icon: 'star', key: 'm' },
  { cmd: 'edit.lift', key: 'u' },                   // Raise / lower: a drag button
  { cmd: 'thing.upright', key: 'j' },               // a rolled thing: stand it upright again (the Turn is kept)
  { cmd: 'thing.tilt', key: 'b' },                  // Roll (a thing, not a pawn): a drag button, the turn's gesture about the view's axis
  { cmd: 'stair.flip', key: 'w' },                  // (never offered with a room's Walls) a stair, spiral or ladder: Stairs down / Stairs up
  { cmd: 'thing.rename', key: 'n' },                // a thing or a building; a pawn's opens its sheet card on the name (off a pawn's ring: RING_NOT_FOR)
  { cmd: 'room.rename', key: 'n' },                 // never offered together with the one above (off the ring)
  { cmd: 'thing.pin', key: 'p' },
  { cmd: 'thing.lock', key: 'k' },                  // things, rooms, buildings (a pawn has no lock)
  { cmd: 'thing.hide', key: 'h' },
  { cmd: 'pawn.duplicate', key: 'x' },              // (off the ring)
  { cmd: 'pawn.give', key: 'g', opens: 'give', title: 'Give control' }, // opens the pawn's sheet card on "Moved by" (off the ring)
  { list: 'room.height.', title: 'Height', icon: 'chevrons-up', key: 'i' }, // a tall room: Taller / Shorter (one button when only one applies)
  { cmd: 'room.stair', key: 's' },                  // an upper room or a cellar: plan its stair (off the ring)
  { cmd: 'room.replay', key: 'a' },                 // (off the ring)
  { cmd: 'cast.saveGroup', key: 'g' },              // several pawns (GM): "Save as group…" (surfaces/pawns.js, the cast)
  { cmd: 'pawn.travel', key: 'z', opens: 'travel', title: 'Send to area' }, // a pawn: the areas it can go to, at the button (surfaces/areas.js)
  { cmd: 'edit.delete', key: 'd' },                 // always last (off the ring)
];
// Commands that are NOT in the ring or the chord tree, on purpose. They keep their keyboard shortcuts and the command
// bar finds them by name.
//   duplicate (Ctrl/⌘+D), copy (Ctrl/⌘+C), cut (Ctrl/⌘+X): Harry 2026-10-05, "We DON'T need a cut copy paste set of
//   options in there"
//   turn a room back 90° (Shift+R): the room's closed ring already has Turn; this keeps a room's open ring short
export const NOT_IN_MENU = ['edit.duplicate', 'edit.copy', 'edit.cut', 'room.rotateBack'];
// THE CUTS of 2026-10-11 (Harry: "ship the cuts"; docs/design/orbital-menu-2026-10-11/README.md, "Content changes agreed")
// WERE TO THE RING ONLY. The commands below are not drawn on any ring; the Space chord tree still holds every one of
// them, with the letter it always had (2026-10-12: the first cut took the chords too, which nobody asked for).
//   delete (Del / Backspace): off EVERY ring. The key is on the "?" sheet, the bar finds it, undo brings the thing back
//   a pawn's Duplicate: Ctrl/⌘+D and the bar          a pawn's Give control, and its name: on its sheet card
//   a room's Replay spawn: the bar only                  a room's Room type ▸: the bar only ("room type: kitchen")
//   a room's Rename: at its own label (F2, or double-click the selected label; the bar)
//   a room's Add stair: stairs, spirals and ladders are placed from the library and switched up / down (stair.flip); a
//   room drawn off the ground is OFFERED its stair by a button beside it; "add stair" in the bar still plans one
//   a room's Floor ▸: drag a floor in from the library (it changes the whole room's floor); the bar sets one by name ("floor: cobble")
// An entry ending in a dot is a whole list, by its prefix.
export const RING_CUT = ['edit.delete', 'pawn.duplicate', 'pawn.give', 'room.replay', 'room.rename', 'room.type.', 'room.floor.', 'room.stair', 'room.roofShow'];
const offRing = (id) => RING_CUT.some(x => x.endsWith('.') ? id.startsWith(x) : id === x);
const notInMenu = (id) => NOT_IN_MENU.includes(id);
// A command that is on the ring for some selections and not for others: true = leave it off the ring for this one.
//   a pawn's name is on its sheet card (2026-10-11); things and buildings keep Rename on the ring
export const RING_NOT_FOR = {
  'thing.rename': (ctx) => ctx.sel.some(e => e.kind === 'token'),
};
const nameOfCmd = (c) => String(c.short || (typeof c.title === 'string' ? c.title : c.id.split('.').pop()));
const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

// The whole menu, for every command there is (not one selection): where each command sits and the letter it answers to
// in the chord tree. Letters are fixed here, once, so a chord never changes with what happens to be selected.
//   plan.place  Map(command id -> { path: [] | [list prefix], key })      plan.keys  Map(list prefix -> key)
// A menu command the table names nowhere (and NOT_IN_MENU does not exclude) is an ORPHAN: it is shown at the top level,
// last, and reported (app.menuOrphans, console; a test fails on any). Give it a line in the table.
function planOf(R) {
  if (R._menuPlan) return R._menuPlan;
  const all = R.all().filter(c => c.menu && !c.stub && !notInMenu(c.id)), byId = new Map(all.map(c => [c.id, c]));
  const place = new Map(), keys = new Map(), orphans = [];
  // (a list longer than the 36 letters and digits, e.g. 41 floors: the rest have no letter; the ring and the bar reach them)
  const letter = (taken, name) => { const k = [...name.toLowerCase().replace(/[^a-z0-9]/g, ''), ...LETTERS].find(ch => !taken.has(ch)) || null; if (k) taken.add(k); return k; };
  const top = new Set(MENU.map(e => e.key));
  for (const e of MENU) {
    if (e.cmd) { if (byId.has(e.cmd)) place.set(e.cmd, { path: [], key: e.key }); continue; }
    keys.set(e.list, e.key);
    const taken = new Set();
    for (const c of all) if (c.id.startsWith(e.list) && !place.has(c.id)) place.set(c.id, { path: [e.list], key: letter(taken, nameOfCmd(c)) });
  }
  for (const c of all) if (!place.has(c.id)) { orphans.push(c.id); place.set(c.id, { path: [], key: letter(top, nameOfCmd(c)) }); }
  if (orphans.length) console.warn('menu: commands with no line in the table (client/menu.js), shown last:', orphans.join(', '));
  return (R._menuPlan = { place, keys, orphans });
}
// The menu for a selection, flat:
//   [{ cmd, key, opens?, title? } | { group: <list prefix>, title, icon, key, children: [{ cmd, key }] }]
//   skip: command ids NOT to offer (the ring passes the ones already on its closed buttons; the chord tree passes none)
//   ring: true = for the selection ring: without the commands the cuts took off the ring (RING_CUT, RING_NOT_FOR)
export function menuFor(R, ctx, { skip = new Set(), ring = false } = {}) {
  const plan = planOf(R);
  const avail = R.available(ctx).filter(c => c.menu && !c.stub && R.isEnabled(c, ctx) && !skip.has(c.id) && plan.place.has(c.id) && !(ring && (offRing(c.id) || RING_NOT_FOR[c.id]?.(ctx))));
  const leaf = (c) => ({ cmd: c, key: plan.place.get(c.id).key });
  const out = [];
  const orphans = () => { for (const id of plan.orphans) { const c = avail.find(c => c.id === id); if (c) out.push(leaf(c)); } }; // a command the table forgot: just before Delete, and reported
  for (const e of MENU) {
    if (e.cmd === 'edit.delete') orphans();
    if (e.cmd) { const c = avail.find(c => c.id === e.cmd); if (c) out.push(e.opens ? { ...leaf(c), opens: e.opens, title: e.title } : leaf(c)); continue; }
    const cs = avail.filter(c => c.id.startsWith(e.list));
    if (cs.length === 1) out.push({ ...leaf(cs[0]), key: e.key });
    else if (cs.length) out.push({ group: e.list, title: e.title, icon: e.icon, key: e.key, children: cs.map(leaf) });
  }
  // Room ☰ ends with Faction, after Height; other selections and chords keep their order.
  if (ring && ctx.sel.length === 1 && ctx.sel[0].kind === 'room') {
    const faction = out.findIndex(n => n.cmd?.id === 'faction.set');
    if (faction >= 0) out.push(...out.splice(faction, 1));
  }
  return out;
}
export const menuOrphans = (R) => planOf(R).orphans;
// the chord a command answers to: ['Space', 'h'], or ['Space', 'f', 'c'] inside a list (for the "?" sheet and the bar);
// null when it is not in the menu
export function chordOf(R, id) { const plan = planOf(R), p = plan.place.get(id); return p && p.key ? ['Space', ...p.path.map(g => plan.keys.get(g)), p.key] : null; }
export const titleOf = (n, R, ctx) => n.cmd ? String(R.titleOf(n.cmd, ctx)) : n.title;
export const iconOf = (n, R, ctx) => n.cmd ? R.iconOf(n.cmd, ctx) : n.icon;
