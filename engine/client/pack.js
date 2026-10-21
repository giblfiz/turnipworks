// The building tool (Type level of the Build menu): a dragged rectangle, in 5-ft cells, becomes a building of that
// type: its rooms packed into the rectangle by guillotine cuts (split the room list into two halves of about equal
// area, cut the rectangle across its longer side in that proportion, recurse). Pure; the caller solves and spawns.
//   rect   { x, z, w, d } in cells     rooms  [{ key, cells: [w, d] }] in priority order (most important first)
//   ->     [{ key, x, z, w, d }] covering the rectangle exactly, every room 2..16 cells a side
export const MIN = 2, MAX = 16, MAX_ROOMS = 12, MAX_SIDE = 24; // a building: at most 12 rooms, 24 cells (120 ft) a side
// inn rooms by importance: what a tavern needs first (others follow in their recipe order)
const PRIORITY = ['common', 'kitchen', 'guest', 'storeroom', 'desk', 'privy', 'fine'];
// not packed into a building's footprint: outbuildings, underground rooms and corridors (draw those with the room tool)
const APART = new Set(['stable', 'barn', 'cellar', 'hallway', 'yard', // (a yard is open ground beside the building, never a room inside it)
  'courtyard', 'gatehouse', // castle: the court and its gate stand beside the keep, never inside it
  'mansion-garden', 'mansion-cellar', 'mansion-conservatory', // mansion: what lies beside or under the house
  'castle-passage', 'mansion-corridor', 'crypt-passage', 'crypt-catacomb', // corridors: the whole-building generator lays those (docs/BUILDINGS.md); this packer is only used off the ground
  'dun-corridor', 'dun-trap-corridor', 'dun-dead-end', 'dun-sewer', 'dun-chasm',
  'mkt-square', 'mkt-street', 'mkt-passage', 'mkt-house', 'mkt-bedroom'
  // type:hut  farmstead: a dragged farmhouse packs its kitchen, bedroom and dairy; the one-room cottage is a building by itself, the
  // passage, loft and cellar are drawn (beside, over, under), and everything else stands apart in the yard
  , 'hut-cottage', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-pigsty', 'hut-barn', 'hut-granary', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard',
  'smi-yard', 'smi-passage', 'smi-quarters']); // type:dun: passages join rooms; they are drawn (or laid by the layout generator), never packed as cells
for (const k of ['min-tunnel', 'min-junction', 'min-face', 'min-collapsed', 'min-flooded', 'min-pithead']) APART.add(k); // type:min: tunnels join chambers and the yard lies outside; never packed as cells
const GROW = 1.5;      // recipe sizes are minimums; an inn's rooms run larger
const REPEAT = 'guest'; // a big inn has many guest rooms
for (const k of ['lair-mouth', 'lair-passage', 'lair-trophy']) APART.add(k); // type:lai: the ground before a lair and its passages are drawn (or laid by the layout generator), never packed as cells

export function packRooms(rect, rooms) {
  if (rect.w < MIN || rect.d < MIN || !rooms.length) return [];
  const list = [...rooms].filter(r => !APART.has(r.key) || rooms.every(x => APART.has(x.key))).sort((a, b) => rank(a.key) - rank(b.key));
  const A = rect.w * rect.d;
  // take rooms in priority order until their natural sizes fill about the rectangle (always at least one)
  const pick = [];
  let sum = 0;
  for (const r of list) { if (pick.length && sum >= A * 0.85) break; const a = r.cells[0] * r.cells[1] * GROW; pick.push({ key: r.key, a }); sum += a; }
  const rep = list.find(r => r.key === REPEAT);
  while (rep && sum < A * 0.85 && pick.length < MAX_ROOMS) { const a = rep.cells[0] * rep.cells[1] * GROW; pick.push({ key: rep.key, a }); sum += a; }
  // every room needs at least MIN×MIN: drop the least important until they fit
  while (pick.length > 1 && pick.length * MIN * MIN * 1.5 > A) pick.pop();
  return split(rect, pick);
}
const rank = (k) => { const i = PRIORITY.indexOf(k); return i < 0 ? 99 : i; };

function split(r, items) {
  if (items.length === 1) return fill(r, items[0].key);
  const total = items.reduce((s, it) => s + it.a, 0);
  // the cut that best halves the area, keeping list order (importance) within each half
  let best = 1, bestErr = Infinity, acc = 0;
  for (let i = 1; i < items.length; i++) { acc += items[i - 1].a; const err = Math.abs(acc - total / 2); if (err < bestErr) { bestErr = err; best = i; } }
  const A = items.slice(0, best), B = items.slice(best), fa = A.reduce((s, it) => s + it.a, 0) / total;
  const across = r.w >= r.d ? 'w' : 'd';
  for (const side of [across, across === 'w' ? 'd' : 'w']) {
    const len = r[side];
    if (len < MIN * 2) continue;
    const cut = Math.max(MIN, Math.min(len - MIN, Math.round(len * fa)));
    const [r1, r2] = side === 'w' ? [{ ...r, w: cut }, { ...r, x: r.x + cut, w: r.w - cut }] : [{ ...r, d: cut }, { ...r, z: r.z + cut, d: r.d - cut }];
    return [...split(r1, A), ...split(r2, B)];
  }
  return fill(r, items[0].key); // too small to cut: the most important room takes it
}
// one room type over a rectangle; wider than MAX on a side, it becomes two rooms of that type
function fill(r, key) {
  if (r.w > MAX && r.w >= MIN * 2) { const h = Math.floor(r.w / 2); return [...fill({ ...r, w: h }, key), ...fill({ ...r, x: r.x + h, w: r.w - h }, key)]; }
  if (r.d > MAX && r.d >= MIN * 2) { const h = Math.floor(r.d / 2); return [...fill({ ...r, d: h }, key), ...fill({ ...r, z: r.z + h, d: r.d - h }, key)]; }
  return [{ key, x: r.x, z: r.z, w: r.w, d: r.d }];
}
