// ======================= castle / crypt / mansion (2026-10-05) =======================
// New room types register themselves BELOW this line (role, door policy, door leaves, windows, wall family, special
// panels), in the tables defined above: nothing above this line changes except two one-line hooks (doorTypeFor,
// and computeEdges just before its corners). A type with no entry in FAMILY_ODDS always takes its room type's own `family` (familyFor).
//
// A NEW WALL FAMILY needs: WALL_FAMILIES (the Walls select, the game's family list), FAMILY_FALLBACK (whose pieces it
// borrows for what it lacks: corner pillars or posts, a doorway, floors, family-keyed props; look.js kitSpec and
// cornerSpec, solver.js chooseSku through meshFamily) and TO_KIT (the nearest exact-module kit for the bench override).
// A family with no window piece simply shows plain wall where a window was rolled (look.js edgeSpecs: familyUsable does
// NOT follow the fallback, on purpose: a borrowed window in a foreign stone reads as broken).
// A ROOM WITH NO WINDOWS is a room type in NO_WINDOWS: no window edges are rolled, so the solver sees none either.

// DOORS by room type: which door hangs in this type's doorways.  main = its door to outside (or onto a yard),
// inner = between rooms; a list is a seeded choice. leaf = the leaf sku's shape when the role has several leaves
// (look.js picks shape 'leaf' unless e.doorLeaf says otherwise: the mansion's walnut double door is 'fine-leaf').
export const DOORS = {};
function specialDoor(e, byId) {
  const rule = e.sides.map(s => DOORS[byId.get(s.room).type]).find(Boolean);
  if (!rule) return null;
  const pick = (v) => Array.isArray(v) ? v[hash(e.key, 'ccm-door') % v.length] : v;
  const id = pick(e.sides.length === 1 ? ((e.span || 1) > 1 && rule.wide) || rule.main : rule.inner) || rule.inner || rule.main;
  if (rule.leaf && rule.leaf[id]) e.doorLeaf = rule.leaf[id];
  return id || null;
}

// SPECIAL WALL PANELS: a room type swaps some of its plain wall panels for a showpiece panel of the same family (burial
// niches, a wall of skulls, a blind sealed door, stained glass). e.panel = the kit role look.js draws in place of
// wall-straight; room.panels = [{ side, index, panel }] tells the room's program where they are (the edge stays kind
// 'wall' and adds nothing to the openings, so every other reader of the wall map sees a plain wall).
//   ids      kit roles, chosen per run of the pattern          sides   'long' | 'all'
//   every    [n, of]: n panels then (of - n) plain, along each side from a seeded phase
//   one      true: exactly one panel in the room, on a seeded eligible edge, with probability `chance`
//   centre   false: the middle of the wall FACING a door of the room stays plain (the focal piece stands there)
//   ends     true ('all' sides): panels may run into the corners too (a room faced with them wall to wall)
//   doorWall false: a wall of the room that has a door in it stays plain (somewhere to hang the torches)
//   shapes   which versions of the piece (the sku's shape, '' = the plain one), taken in turn along the wall; without it
//            look.js alternates every version the family has (e.panelShape -> look.js edgeSpecs)
// Eligible: a plain wall edge (no door, door-span or window) with no ROOM beyond it (the panels are 18-24 in thick and
// keep their room face flush, so the extra depth goes outward: on a shared wall it would stand in the neighbour's
// room), and, when panels may stand on all four walls, never a side's first or last segment (never both sides of a corner).
export const PANELS = {};
function specialPanels(rooms, edges, byId, opts = {}) {
  wayOn(rooms, edges, byId, opts); // (first: a panel never stands where the far gate goes)
  for (const r of rooms) {
    r.panels = [];
    for (const rule of PANELS[r.type] || []) {
      const mine = perimeter(r).map(p => ({ ...p, e: edges.get(p.key) })).filter(p => p.e && p.e.kind === 'wall' && p.e.sides.length === 1 && p.e.owner.room === r.id && !p.e.panel);
      const len = (s) => s === 'N' || s === 'S' ? r.w : r.d; // (a shaped room, r.cells: sides are measured on its bounding rectangle; the rules stay safe, only less exact)
      const long = r.w === r.d ? ['N', 'S', 'E', 'W'] : r.w > r.d ? ['N', 'S'] : ['W', 'E'];
      // (panels on the long walls only never meet at a corner, so they may run to the ends)
      let ok = mine.filter(p => rule.sides === 'long' ? long.includes(p.side) : rule.ends || (p.index > 0 && p.index < len(p.side) - 1));
      if (rule.doorWall === false) { const doored = new Set(perimeter(r).filter(p => /^door/.test(edges.get(p.key)?.kind || '')).map(p => p.side)); ok = ok.filter(p => !doored.has(p.side)); }
      if (rule.centre === false) { // the wall facing a door of this room keeps its middle plain (the focal piece and its flankers: 3 segments,
        // or the middle two of an even run); a `one` panel never stands on that wall at all
        const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' }, facing = new Set(perimeter(r).filter(p => /^door/.test(edges.get(p.key)?.kind || '')).map(p => OPP[p.side]));
        ok = ok.filter(p => !facing.has(p.side) || (!rule.one && Math.abs(p.index - (len(p.side) - 1) / 2) > 1.25));
      }
      const put = (p, id) => { p.e.panel = id; if (rule.shapes) p.e.panelShape = rule.shapes[(p.index + hash(r.wallSeed ?? r.seed, 'ccm-panel-shape', p.side)) % rule.shapes.length]; r.panels.push({ side: p.side, index: p.index, panel: id, key: p.key, ...(p.line !== undefined && { line: p.line }) }); };
      if (rule.one) {
        const h = hash(r.wallSeed ?? r.seed, 'ccm-panel-one', rule.ids[0]);
        if (ok.length && (h % 1000) / 1000 < (rule.chance ?? 1)) put(ok.sort((a, b) => a.key < b.key ? -1 : 1)[(h >>> 10) % ok.length], rule.ids[(h >>> 5) % rule.ids.length]);
        continue;
      }
      const [n, of] = rule.every || [1, 2];
      for (const p of ok) {
        const ph = hash(r.wallSeed ?? r.seed, 'ccm-panel', p.side) % of, run = Math.floor((p.index + ph) / of);
        if ((p.index + ph) % of < n) put(p, rule.ids[hash(r.wallSeed ?? r.seed, 'ccm-panel-id', p.side, run) % rule.ids.length]);
      }
    }
  }
}

// THE OUTSIDE DOOR ON A SHORT WALL: a room type in DOOR_ENDS is entered at an END (a corridor is walked along; a chapel is
// entered facing its altar down the long axis). chooseExteriorDoor tries the room's two short walls first, in the seed's
// order, then the long ones; a square room and every other room type keep the seed's order exactly.
export const DOOR_ENDS = new Set();
function doorOrder(room, order, turn) {
  if (!DOOR_ENDS.has(room.type) || room.w === room.d || room.cells) return order;
  const wide = (turn % 2 ? room.d : room.w) > (turn % 2 ? room.w : room.d), short = wide ? ['W', 'E'] : ['N', 'S']; // (order is in the room's own frame, before its turn)
  return [...order.filter(s => short.includes(s)), ...order.filter(s => !short.includes(s))];
}

// THE WAY ON: a room type in THROUGH is a corridor. Standing alone, with its one door in an end wall, it would be a dead
// end; a corridor leads somewhere, so it gets a second door straight across, in the far end wall (the same door type as
// its entrance). It never fires for a corridor that already has two doors (between rooms in a building), for one whose
// far end is not all plain outside wall, for a shaped room, or for a room the game has sealed (below ground, upstairs).
// The way on hangs the type's INNER door (it leads deeper in), so a lone corridor is not a cage with a gate at each end.
export const THROUGH = new Set();
// WAY_ON[type] (optional, for a type in THROUGH): { any: true } the room may be square and entered through any wall, and a
// window in the far wall gives way to the opening; { same: true } the far opening is the entrance over again (its width
// and its door: the castle gatehouse has a gate at each end of its passage); { door: id } names the far door's type where the opening is wide.
export const WAY_ON = {};
function wayOn(rooms, edges, byId, opts) {
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  for (const r of rooms) {
    const o = WAY_ON[r.type] || {};
    if (!THROUGH.has(r.type) || r.cells || (!o.any && r.w === r.d) || opts.sealed?.has(r.id)) continue;
    const per = perimeter(r).map(p => ({ ...p, e: edges.get(p.key) })).filter(p => p.e), doors = per.filter(p => /^door/.test(p.e.kind)), d0 = doors.find(p => p.e.kind === 'door');
    if (!d0 || doors.length !== (o.same ? d0.e.span || 1 : 1) || d0.e.sides.length !== 1 || (!o.any && !(r.w > r.d ? ['W', 'E'] : ['N', 'S']).includes(d0.side))) continue;
    const far = per.filter(p => p.side === OPP[d0.side]), n = o.same ? d0.e.span || 1 : 1, i0 = Math.min(...doors.map(p => p.index));
    const plain = (p) => p.e.sides.length === 1 && (p.e.kind === 'wall' || (o.any && p.e.kind === 'window'));
    if (!far.length || (o.any ? false : far.some(p => p.e.kind !== 'wall' || p.e.sides.length !== 1))) continue;
    const at = Array.from({ length: n }, (_, k) => far.find(p => p.index === i0 + k)); // straight across from the entrance
    if (at.some(p => !p || !plain(p))) { if (n > 1 || !far[0] || !plain(far[0]) || o.any) continue; at[0] = far[0]; }
    const e = at[0].e, keys = at.map(p => p.key);
    e.kind = 'door'; e.span = n; if (n > 1) e.spanKeys = keys; e.why = 'the way on: a corridor has two ends'; e.flag = 'way-on';
    e.doorType = (n > 1 && o.door) || (o.same ? d0.e.doorType : doorTypeFor({ ...e, sides: [e.sides[0], e.sides[0]] }, byId)); // (as if a room lay beyond: the inner door)
    if (o.same && d0.e.doorLeaf) e.doorLeaf = d0.e.doorLeaf;
    for (const k of keys.slice(1)) { const x = edges.get(k); x.kind = 'door-span'; x.spanOf = keys[0]; }
  }
}
