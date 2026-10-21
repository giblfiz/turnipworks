// Shared wall map. Pure data, no three.js. Rooms live on a 5-ft grid; every room edge is a 5-ft "edge segment".
// Two rooms touching share the segment (one wall, never doubled) and get one connecting door on their shared run.
// Each room also gets a sticky exterior door chosen at creation (room.extDoor), and windows on exterior runs.
//   edge key  h:gx:gz  = runs along X from gx to gx+1 on grid line z = gz   (N/S sides)
//             v:gx:gz  = runs along Z from gz to gz+1 on grid line x = gx   (W/E sides)
export const CELL = 5; // feet

export function hash(...xs) { // small deterministic integer hash
  let h = 2166136261 >>> 0;
  for (const x of xs) for (const c of String(x)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// A room that is NOT its whole rectangle (the game's L-shaped rooms, 2026-10-05) carries room.cells: the 5-ft cells it
// stands on, as [i, j] offsets from (room.x, room.z); x, z, w, d stay its bounding rectangle. Its walls run along the
// boundary of those cells. A wall is still named by the side of the ROOM it is on (N = the room lies south of it) and by
// its cell offset along the bounding rectangle's side; `line` says which grid line it sits on, because an inner wall (the
// two walls of an L's inside corner) is not on the bounding rectangle, and a U-shaped room has two walls with the same
// side and index. Rectangles carry no cells and no line and are exactly as before.
export function perimeter(room) {
  const { x, z, w, d } = room, out = [];
  if (room.cells) {
    const has = new Set(room.cells.map(([i, j]) => `${i}:${j}`));
    for (const [i, j] of room.cells) {
      if (!has.has(`${i}:${j - 1}`)) out.push({ key: `h:${x + i}:${z + j}`, side: 'N', index: i, line: j });
      if (!has.has(`${i}:${j + 1}`)) out.push({ key: `h:${x + i}:${z + j + 1}`, side: 'S', index: i, line: j + 1 });
      if (!has.has(`${i - 1}:${j}`)) out.push({ key: `v:${x + i}:${z + j}`, side: 'W', index: j, line: i });
      if (!has.has(`${i + 1}:${j}`)) out.push({ key: `v:${x + i + 1}:${z + j}`, side: 'E', index: j, line: i + 1 });
    }
    return out;
  }
  for (let i = 0; i < w; i++) out.push({ key: `h:${x + i}:${z}`, side: 'N', index: i });
  for (let i = 0; i < w; i++) out.push({ key: `h:${x + i}:${z + d}`, side: 'S', index: i });
  for (let i = 0; i < d; i++) out.push({ key: `v:${x}:${z + i}`, side: 'W', index: i });
  for (let i = 0; i < d; i++) out.push({ key: `v:${x + w}:${z + i}`, side: 'E', index: i });
  return out;
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
}

const NO_WINDOWS = new Set(['cellar']);
const SIDE_PREF = ['S', 'E', 'W', 'N'];

// Choose a sticky exterior door for a newly created room among the edges that are exterior right now.
// Exterior openings can be wider than one 5-ft segment (Harry 2026-10-01: "many are 10 ft or even 20 ft wide (barn!)")
// widths in 5-ft segments: barns 10/15/20 ft, stables 10/15 ft (Harry: "15 is also an option"), grand doors 10 ft.
// Seeded pick among the widths that leave at least one segment of wall on the run.
const SPANS = { barn: [2, 3, 4], stable: [2, 3], common: [2], desk: [2] };
export function doorSpanFor(type, runLength, h = 0) {
  const fit = (SPANS[type] || []).filter(n => n <= runLength - 1 || (n === 2 && runLength >= 3));
  return fit.length ? fit[h % fit.length] : 1;
}

// A TURNED room (room.turn = quarter turns clockwise seen from above, 0..3; the game's room.rotate, 2026-10-05) keeps its
// door on the same wall OF THE ROOM: the side preference and the place along the wall are worked out in the room's own
// frame (as it stood when it was made) and carried round with it. turn 0 is exactly the old behaviour.
const CLOCK = ['N', 'E', 'S', 'W'];
export const turnSide = (side, turn = 0) => CLOCK[(CLOCK.indexOf(side) + turn) % 4];
// does an index along the room's own side run the other way along the world side it has turned onto? (N and S count from
// the west, W and E from the north)
const flips = (own, turn) => { let s = own, f = false; for (let i = 0; i < turn % 4; i++) { if (s === 'E' || s === 'W') f = !f; s = turnSide(s, 1); } return f; };
export function chooseExteriorDoor(room, rooms) {
  if (isOutdoor(room.type)) return null; // a yard has no walls to put a door in; its way out is the gate (computeEdges)
  const others = rooms.filter(r => r.id !== room.id && !isOutdoor(r.type)); // a yard next door is still "outside"
  const shared = new Set(others.flatMap(r => perimeter(r).map(e => e.key)));
  const ext = perimeter(room).filter(e => !shared.has(e.key));
  if (!ext.length) return null;
  const h = hash(room.wallSeed ?? room.seed, 'door'), turn = ((room.turn || 0) % 4 + 4) % 4;
  const order = doorOrder(room, h % 2 ? SIDE_PREF : ['S', 'W', 'E', 'N'], turn); // castle / crypt / mansion: DOOR_ENDS, at the end of this file
  for (const own of order) {
    const side = turnSide(own, turn);
    let run = ext.filter(e => e.side === side);
    if (!run.length) continue;
    // a shaped room has several walls on one side: the door goes on the longest straight one (a wide door never bends)
    const line = room.cells ? [...new Set(run.map(e => e.line))].map(l => [l, run.filter(e => e.line === l).length]).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0] : undefined;
    if (room.cells) run = run.filter(e => e.line === line);
    // near the middle of the run, nudged by the seed
    // the opening must sit on consecutive exterior segments of this side
    const span = doorSpanFor(room.type, run.length, h >>> 7);
    const idx = new Set(run.map(e => e.index));
    const starts = run.map(e => e.index).filter(i => [...Array(span).keys()].every(k => idx.has(i + k)));
    if (!starts.length) continue;
    let want = Math.floor((run.length - span) / 2) + (run.length > span + 1 ? (h >>> 3) % 3 - 1 : 0);
    if (flips(own, turn)) want = (side === 'N' || side === 'S' ? room.w : room.d) - span - want;
    const start = starts.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a);
    const keys = perimeter(room).filter(e => e.side === side && e.line === line && e.index >= start && e.index < start + span).sort((a, b) => a.index - b.index).map(e => e.key);
    return { side, index: start, span, key: keys[0], keys };
  }
  return null;
}

// ---- v2 room roles (Harry + Fauna 2026-10-01): a room's role describes how people move through it ----
//   hub       many doors, people swirl around anchors          (common room)
//   passage   a through-line between doors, with a checkpoint  (front desk, hallway)
//   terminal  one way in and out; the key feature is the destination (guest, fine, privy, storeroom, cellar)
//   uses      a work room with doors to the rooms it USES; not a passage to them (kitchen uses cellar/storeroom)
//   mixed     depends on who counts: stable/barn are passages for horses and wagons, terminals for grooms
export const ROLES = {
  common: { role: 'hub', who: 'guests' },
  desk: { role: 'passage', who: 'guests', yardDoor: false }, // a lobby's door is its front door: no back door cut through the counter wall
  hallway: { role: 'passage', who: 'guests' },
  kitchen: { role: 'uses', who: 'staff', uses: ['cellar', 'storeroom'] },
  guest: { role: 'terminal', who: 'guests' },
  fine: { role: 'terminal', who: 'guests' },
  privy: { role: 'terminal', who: 'guests', privacy: true },
  storeroom: { role: 'terminal', who: 'staff' },
  cellar: { role: 'terminal', who: 'staff' },
  stable: { role: 'mixed', who: 'horses: passage; grooms: terminal' },
  barn: { role: 'mixed', who: 'wagons: passage; hands: terminal' },
  //   outdoor   a room with NO walls (Harry 2026-10-05): its own ground, open edges, neighbours' doors open onto it
  yard: { role: 'outdoor', who: 'everyone: guests, staff, horses' },
};
export const roleOf = (type) => (ROLES[type] || { role: 'terminal' }).role;
export const isOutdoor = (type) => roleOf(type) === 'outdoor';
const LINK_RANK = { passage: 0, hub: 1, uses: 2, mixed: 3, terminal: 9 };

// Should two touching rooms get a connecting door? (v2)  Returns a reason string or null.
function linkWhy(a, b) {
  if (mktNoLink(a, b)) return null; // market & village: two shop fronts side by side are two businesses (at the end of this file)
  const ra = roleOf(a.type), rb = roleOf(b.type);
  if (ra === 'terminal' && rb === 'terminal') return null;                  // terminals never open into each other
  const usesA = (ROLES[a.type]?.uses || []).includes(b.type), usesB = (ROLES[b.type]?.uses || []).includes(a.type);
  if (usesA || usesB) return `${usesA ? a.type : b.type} uses ${usesA ? b.type : a.type}`;
  if (ra === 'terminal' || rb === 'terminal') {
    const other = ra === 'terminal' ? rb : ra;
    return other === 'hub' || other === 'passage' ? `terminal off a ${other}` : null;
  }
  if (ra === 'mixed' || rb === 'mixed') {
    const other = ra === 'mixed' ? rb : ra;
    return other === 'mixed' || other === 'passage' ? 'yard buildings connect' : null;
  }
  return `${ra} meets ${rb}`;
}

// v2 door policy: which shared runs get a door, where on the run, and which exterior doors are live.
function doorsV2(rooms, edges, byId, open, opts = {}) {
  const pairs = new Map();
  for (const e of edges.values()) {
    if (e.sides.length < 2) continue;
    const k = [e.sides[0].room, e.sides[1].room].sort().join('|');
    if (!pairs.has(k)) pairs.set(k, []);
    pairs.get(k).push(e);
  }
  const doorsOf = new Map(rooms.map(r => [r.id, []])); // room -> [{side, t0, t1}] (in that room's side coordinates)
  const addDoor = (e, why) => {
    e.kind = 'door'; e.span = e.span || 1; e.why = why;
    for (const s of e.sides) doorsOf.get(s.room).push({ side: s.side, i0: s.index, i1: s.index + (e.span || 1) });
  };
  // candidate links, terminals keep only their best partner (passage > hub > uses > mixed)
  let links = [];
  for (const [k, run] of pairs) {
    const [a, b] = k.split('|').map(id => byId.get(id));
    // A PLANNED BUILDING (js/buildings.js, 2026-10-11): two rooms of one generated building have a door between them
    // exactly when the plan says so, and where it says (r.plan = { b: the plan's id, links: { room id: edge key } }).
    // Rooms without a plan, and a planned room beside a room that is not of its plan, follow the rules below as before.
    if (a.plan && b.plan && a.plan.b === b.plan.b) { const key = a.plan.links?.[b.id] ?? b.plan.links?.[a.id]; if (key != null) links.push({ k, a, b, run, why: 'the building plan', planned: true, key }); continue; }
    const why = linkWhy(a, b);
    if (why) links.push({ k, a, b, run, why });
  }
  for (const r of rooms) {
    if (roleOf(r.type) !== 'terminal') continue;
    const mine = links.filter(l => l.a === r || l.b === r);
    if (mine.some(l => l.planned)) { const drop = new Set(mine.filter(l => !l.planned).map(l => l.k)); links = links.filter(l => !drop.has(l.k)); continue; } // its plan's doors are its doors
    if (mine.length < 2) continue;
    const rank = (l) => { const o = l.a === r ? l.b : l.a; return LINK_RANK[roleOf(o.type)] * 100 - l.run.length; };
    mine.sort((x, y) => rank(x) - rank(y) || (x.k < y.k ? -1 : 1));
    const drop = new Set(mine.slice(1).map(l => l.k));
    links = links.filter(l => !drop.has(l.k));
    for (const l of mine.slice(1)) l.dropped = `terminal ${r.type} keeps one door`;
  }
  // exterior doors: sticky choice at creation; a terminal's goes quiet once it has an interior door
  const interior = new Set(links.flatMap(l => [l.a.id, l.b.id]));
  for (const r of rooms) {
    if (!r.extDoor || isOutdoor(r.type)) continue; // (a room turned into a yard keeps no door of its own)
    if (!r.plan && roleOf(r.type) === 'terminal' && interior.has(r.id)) continue; // (a planned room's street door is the plan's)
    const keys = (r.extDoor.keys || [r.extDoor.key]).filter(k => edges.has(k) && edges.get(k).sides.length === 1);
    if (!keys.length) continue;
    const e = edges.get(keys[0]);
    e.kind = 'door'; e.doorFor = r.id; e.span = keys.length; e.spanKeys = keys; e.why = `${roleOf(r.type)} entrance from outside`;
    for (const s of e.sides) doorsOf.get(s.room).push({ side: s.side, i0: s.index, i1: s.index + keys.length });
    for (const k of keys.slice(1)) { const x = edges.get(k); x.kind = 'door-span'; x.spanOf = keys[0]; }
  }
  // place each link's door on its shared run: no chi rush (no door straight across from another, except in
  // passages, which want roughly opposite doors with a little offset), hubs spread doors, terminals hug a corner
  const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const score = (e) => {
    let s = 0;
    for (const sd of e.sides) {
      const r = byId.get(sd.room), role = roleOf(r.type), mine = doorsOf.get(r.id);
      const L = sd.side === 'N' || sd.side === 'S' ? r.w : r.d;
      for (const d of mine) {
        const overlap = sd.index < d.i1 && d.i0 < sd.index + 1;
        if (d.side === OPP[sd.side] && overlap) s += role === 'passage' ? 0.6 : 3;   // straight across
        if (d.side === OPP[sd.side] && !overlap && role === 'passage') s -= 0.4;     // opposite, offset: good
        if (d.side === sd.side && Math.abs(d.i0 - sd.index) <= 1) s += 2;             // crowding one wall
        if (role === 'hub') s -= 0.15 * Math.min(4, Math.abs(d.i0 - sd.index) + (d.side === sd.side ? 0 : 2));
      }
      if (role === 'terminal') s += 0.5 * Math.min(sd.index, L - 1 - sd.index);       // near a corner
    }
    return s;
  };
  links.sort((x, y) => (LINK_RANK[roleOf(x.a.type)] + LINK_RANK[roleOf(x.b.type)]) - (LINK_RANK[roleOf(y.a.type)] + LINK_RANK[roleOf(y.b.type)]) || (x.k < y.k ? -1 : 1));
  for (const l of links) {
    if (l.run.some(e => e.kind === 'door')) continue;
    if (l.planned && l.key) { const e = l.run.find(x => x.key === l.key); if (e) { addDoor(e, l.why); continue; } } // where the plan put it (a room moved since: mid-wall, below)
    const run = [...l.run].sort((a, b) => (a.gx - b.gx) || (a.gz - b.gz));
    let best = null;
    run.forEach((e, i) => { const sc = score(e) + Math.abs(i - (run.length - 1) / 2) * 0.05; if (!best || sc < best.sc) best = { e, sc }; });
    addDoor(best.e, l.why);
  }
  yardDoors(rooms, edges, byId, open); // before reachability: a door onto a yard is a way in
  // reachability: every room must be reachable from a live exterior door; add a door if a rule would strand it
  const adj = new Map(rooms.map(r => [r.id, new Set()]));
  for (const e of edges.values()) if (e.kind === 'door' && e.sides.length === 2) { adj.get(e.sides[0].room).add(e.sides[1].room); adj.get(e.sides[1].room).add(e.sides[0].room); }
  const sources = rooms.filter(r => [...edges.values()].some(e => e.kind === 'door' && e.sides.length === 1 && e.sides[0].room === r.id));
  // (opts.sealed: rooms with no door to the outside, e.g. an upper storey or a cellar in the game, reached by a stair.
  // A set of rooms that is ALL sealed is entered at its oldest room; none of them is ever given an outside door.)
  const sealedIn = opts.sealed && !sources.length && rooms.length && rooms.every(r => opts.sealed.has(r.id) || isOutdoor(r.type));
  if (sealedIn) { const first = rooms.filter(r => !isOutdoor(r.type)).sort((a, b) => a.created - b.created)[0]; if (first) sources.push(first); }
  if (!sources.length && rooms.length) { // nobody can get in: give the oldest non-terminal room a fresh outside door
    const order = rooms.filter(r => !isOutdoor(r.type) && !opts.sealed?.has(r.id)).sort((a, b) => (roleOf(a.type) === 'terminal') - (roleOf(b.type) === 'terminal') || a.created - b.created);
    let r = order[0], keys = [];
    if (!r) return; // only yards: nothing to get into
    for (const cand of order) {
      const sticky = (cand.extDoor?.keys || [cand.extDoor?.key]).filter(k => k && edges.has(k) && edges.get(k).sides.length === 1);
      const fresh = sticky.length ? null : chooseExteriorDoor(cand, rooms);
      keys = sticky.length ? sticky : (fresh?.keys || []).filter(k => edges.has(k));
      if (keys.length) { r = cand; break; }
    }
    if (keys.length) { const e = edges.get(keys[0]); e.kind = 'door'; e.span = keys.length; e.spanKeys = keys; e.why = 'only way into the building'; e.flag = 'forced'; sources.push(r); for (const k of keys.slice(1)) { const x = edges.get(k); x.kind = 'door-span'; x.spanOf = keys[0]; } }
  }
  for (let guard = 0; guard < rooms.length; guard++) {
    const seen = new Set(sources.map(r => r.id)), q = [...seen];
    while (q.length) { const id = q.shift(); for (const n of adj.get(id)) if (!seen.has(n)) { seen.add(n); q.push(n); } }
    const stranded = rooms.filter(r => !seen.has(r.id) && !isOutdoor(r.type));
    if (!stranded.length) break;
    let fixed = false;
    for (const r of stranded) {
      for (const [k, run] of pairs) {
        const [a, b] = k.split('|');
        const other = a === r.id ? b : b === r.id ? a : null;
        if (!other || !seen.has(other)) continue;
        const sorted = [...run].sort((x, y) => (x.gx - y.gx) || (x.gz - y.gz));
        const e = sorted[Math.floor((sorted.length - 1) / 2)];
        addDoor(e, 'added so the room is reachable'); e.flag = 'reachability';
        adj.get(r.id).add(other); adj.get(other).add(r.id);
        fixed = true; break;
      }
      if (fixed) break;
    }
    if (!fixed) break;
  }
}

// Doors onto a yard (Harry 2026-10-05: "neighbouring rooms' doors open onto it"). A building's sticky front door that
// faces the yard is already one. Otherwise:
//   hub, passage (common room, front desk, hallway)   keep their street door and get a BACK door onto the yard
//   work rooms and yard buildings (kitchen, stable, barn)   their one outside door MOVES to the yard (wide for stables and
//       barns): a stable opens onto its yard, the kitchen's back door is the yard door. Only onto a yard with an open
//       side; a closed court adds a door and leaves the street door alone, so the building can still be entered.
//   terminals (privy, store, guest room)   one door only: an inside door beats the yard, the yard beats the street
function yardDoors(rooms, edges, byId, open) {
  const runs = new Map(); // "room|yard|side" -> the building's wall segments that face that yard
  for (const e of edges.values()) { if (!e.yard || e.sides.length !== 1) continue; const k = `${e.sides[0].room}|${e.yard.room}|${e.sides[0].side}${e.sides[0].line !== undefined ? '|' + e.sides[0].line : ''}`; if (!runs.has(k)) runs.set(k, []); runs.get(k).push(e); }
  for (const [k, run] of [...runs].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    const r = byId.get(k.split('|')[0]), role = roleOf(r.type);
    const yd = byId.get(k.split('|')[1]);
    if (r.plan && yd?.plan && r.plan.b === yd.plan.b) { // a planned building's own yard: a door onto it where the plan says, and nowhere else
      const key = r.plan.links?.[yd.id], e = key != null && (run.find(x => x.key === key && x.kind === 'wall') || (key === '' && run.find(x => x.kind === 'wall')));
      if (e) { e.kind = 'door'; e.doorFor = r.id; e.span = 1; e.spanKeys = [e.key]; e.why = 'the building plan: opens onto the yard'; }
      continue;
    }
    const mine = [...edges.values()].filter(e => e.kind === 'door' && e.sides.some(s => s.room === r.id));
    if (mine.some(e => e.yard)) continue; // already opens onto a yard (its front door, or another side of this yard)
    if (role === 'terminal' && mine.some(e => e.sides.length > 1)) continue;
    if (ROLES[r.type]?.yardDoor === false && mine.length) continue;
    if (role === 'terminal' || ((role === 'uses' || role === 'mixed') && open.get(k.split('|')[1]).length)) {
      for (const e of mine.filter(e => e.sides.length === 1)) { for (const key of (e.spanKeys || []).slice(1)) { const x = edges.get(key); x.kind = 'wall'; delete x.spanOf; } e.kind = 'wall'; delete e.doorFor; delete e.span; delete e.spanKeys; delete e.why; delete e.flag; }
    }
    run.sort((a, b) => a.sides[0].index - b.sides[0].index);
    const free = run.filter(e => e.kind === 'wall');
    const h = hash(r.wallSeed ?? r.seed, 'yard-door', k);
    const span = role === 'mixed' ? doorSpanFor(r.type, run.length, h >>> 7) : 1;
    const idx = new Map(free.map(e => [e.sides[0].index, e]));
    const starts = free.filter(e => [...Array(span).keys()].every(n => idx.has(e.sides[0].index + n)));
    if (!starts.length) continue;
    // stables, barns, the common room and hallways open mid-wall; a work room or a terminal keeps its door toward one
    // end of the run, so the rest of that wall stays one usable stretch (a cooking line, a seat bank)
    const mid = role === 'uses' || role === 'terminal' ? (h % 2 ? run[0].sides[0].index + (run.length > 4 ? 1 : 0) : run.at(-1).sides[0].index - span + 1 - (run.length > 4 ? 1 : 0)) : run[0].sides[0].index + (run.length - span) / 2;
    const first = starts.reduce((a, b) => Math.abs(b.sides[0].index - mid) < Math.abs(a.sides[0].index - mid) ? b : a);
    const keys = [...Array(span).keys()].map(n => idx.get(first.sides[0].index + n).key);
    first.kind = 'door'; first.doorFor = r.id; first.span = span; first.spanKeys = keys; first.why = `${role === 'terminal' ? 'only door, ' : ''}opens onto the yard`;
    for (const key of keys.slice(1)) { const x = edges.get(key); x.kind = 'door-span'; x.spanOf = keys[0]; }
  }
}

// A yard's gate: where its path leaves, on an open side. Opposite the main door when it can be (you walk out of the
// inn, across the yard and out of the gate), else on the longest open side; a yard with nothing around it gets one
// by its seed. Returns an opening { kind: 'gate', side, index } or null for a closed court.
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const YARD_DOOR_RANK = { hub: 0, passage: 1, uses: 2, mixed: 3, terminal: 4 }; // whose door the yard's path starts from
function yardGate(r, openSegs, ops, byId) {
  if (!openSegs.length) return null;
  const rank = (o) => YARD_DOOR_RANK[roleOf(byId.get(o.to)?.type)] ?? 5;
  const doors = ops.filter(o => o.kind === 'door' && !o.part).sort((a, b) => rank(a) - rank(b) || (b.span || 1) - (a.span || 1) || (a.key < b.key ? -1 : 1));
  const d = doors[0], h = hash(r.wallSeed ?? r.seed, 'gate');
  const len = (s) => s === 'N' || s === 'S' ? r.w : r.d;
  const bySide = {}; for (const s of openSegs) (bySide[s.side] ||= []).push(s.index);
  const order = d ? [OPPOSITE[d.side], ...['S', 'E', 'W', 'N'].filter(s => s !== OPPOSITE[d.side] && s !== d.side), d.side] : [...(h % 2 ? SIDE_PREF : ['S', 'W', 'E', 'N'])].sort((a, b) => (bySide[b]?.length || 0) - (bySide[a]?.length || 0));
  for (const side of order) {
    const idx = bySide[side]; if (!idx?.length) continue;
    // straight across from the door when the door's wall is opposite; else mid-side (nudged by the seed in a bare yard)
    const want = d && side === OPPOSITE[d.side] ? d.index + ((d.span || 1) - 1) / 2 : (len(side) - 1) / 2 + (d ? 0 : len(side) > 3 ? (h >>> 3) % 3 - 1 : 0);
    const index = idx.reduce((a, b) => Math.abs(b - want) < Math.abs(a - want) ? b : a);
    return { side, index, kind: 'gate', to: null, span: 1 };
  }
  return null;
}

// Build the full edge map for the current rooms. Returns Map(key -> edge) and per-room openings.
// opts.engine === 'v2' switches to the role-based door policy (v1 behaviour otherwise unchanged).
export function computeEdges(rooms, opts = {}) {
  const edges = new Map();
  const byId = new Map(rooms.map(r => [r.id, r]));
  for (const r of rooms) {
    for (const e of perimeter(r)) {
      if (!edges.has(e.key)) edges.set(e.key, { key: e.key, dir: e.key[0], gx: +e.key.split(':')[1], gz: +e.key.split(':')[2], sides: [] });
      edges.get(e.key).sides.push({ room: r.id, side: e.side, index: e.index, ...(e.line !== undefined && { line: e.line }) });
    }
  }
  // OUTDOORS (Harry 2026-10-05): a yard has no walls. An edge with only yards on it is open ground and leaves the map
  // (nothing is built there); an edge between a building and a yard is the BUILDING's exterior wall (its family, its
  // facing, its windows, its sticky front door stays live) and remembers the yard it looks onto (e.yard).
  const open = new Map(rooms.filter(r => isOutdoor(r.type)).map(r => [r.id, []])); // yard -> its boundary segments with nothing beyond
  for (const [k, e] of [...edges]) {
    const out = e.sides.filter(s => isOutdoor(byId.get(s.room).type));
    if (!out.length) continue;
    if (out.length === e.sides.length) { if (out.length === 1) open.get(out[0].room).push({ side: out[0].side, index: out[0].index, key: k, ...(out[0].line !== undefined && { line: out[0].line }) }); edges.delete(k); continue; }
    e.sides = e.sides.filter(s => !out.includes(s)); e.yard = out[0];
  }
  for (const e of edges.values()) {
    // the oldest room owns the wall's family and facing
    e.sides.sort((a, b) => byId.get(a.room).created - byId.get(b.room).created);
    e.owner = e.sides[0];
    e.family = byId.get(e.owner.room).family;
    e.kind = 'wall';
  }
  const v2 = opts.engine === 'v2';
  if (v2) doorsV2(rooms, edges, byId, open, opts);
  // sticky exterior doors
  if (!v2) for (const r of rooms) {
    if (!r.extDoor || isOutdoor(r.type)) continue; // (a room turned into a yard keeps no door of its own)
    const keys = (r.extDoor.keys || [r.extDoor.key]).filter(k => edges.has(k));
    if (!keys.length) continue;
    const e = edges.get(keys[0]);
    e.kind = 'door'; e.doorFor = r.id; e.span = keys.length; e.spanKeys = keys;
    for (const k of keys.slice(1)) { const x = edges.get(k); x.kind = 'door-span'; x.spanOf = keys[0]; }
  }
  // one door per adjacent pair, at the median of the shared run, unless the run already has a door
  const pairs = new Map();
  for (const e of edges.values()) {
    if (e.sides.length < 2) continue;
    const k = [e.sides[0].room, e.sides[1].room].sort().join('|');
    if (!pairs.has(k)) pairs.set(k, []);
    pairs.get(k).push(e);
  }
  if (!v2) for (const run of pairs.values()) {
    if (run.some(e => e.kind === 'door')) continue;
    run.sort((a, b) => (a.gx - b.gx) || (a.gz - b.gz));
    run[Math.floor((run.length - 1) / 2)].kind = 'door';
  }
  if (!v2) yardDoors(rooms, edges, byId, open);
  // door types by context (Harry 2026-10-01: "use a wider variety")
  for (const e of edges.values()) if (e.kind === 'door') { e.span = e.span || 1; e.doorType = doorTypeFor(e, byId); }
  // windows on exterior runs (deterministic per edge + room seed); not beside doors
  for (const e of edges.values()) {
    if (e.kind !== 'wall' || e.sides.length !== 1) continue;
    const r = byId.get(e.owner.room);
    if (NO_WINDOWS.has(r.type) || opts.noWindows) continue; // (opts.noWindows: the game's rooms below ground)
    if (hash(e.key, r.wallSeed ?? r.seed, "win") % 4 === 0) e.kind = "window";
  }
  specialPanels(rooms, edges, byId, opts); // castle / crypt / mansion: THROUGH and PANELS, at the end of this file (after doors and windows are decided)
  // corners: grid vertices that join a horizontal and a vertical wall
  const verts = new Map();
  const touch = (vx, vz, dir) => {
    const k = `${vx}:${vz}`;
    if (!verts.has(k)) verts.set(k, { gx: vx, gz: vz, h: 0, v: 0, family: null });
    verts.get(k)[dir]++;
    return verts.get(k);
  };
  for (const e of edges.values()) {
    const ends = e.dir === 'h' ? [[e.gx, e.gz], [e.gx + 1, e.gz]] : [[e.gx, e.gz], [e.gx, e.gz + 1]];
    for (const [vx, vz] of ends) { const v = touch(vx, vz, e.dir); v.family = v.family || e.family; }
  }
  const corners = [...verts.values()].filter(v => v.h && v.v);
  // jamb posts frame every multi-segment opening
  for (const e of edges.values()) {
    if (e.kind !== 'door') continue; // every door (single ones too) is framed by posts
    const last = edges.get((e.spanKeys || [e.key]).at(-1)); // shared single doors have no spanKeys
    const ends = e.dir === 'h' ? [[e.gx, e.gz], [last.gx + 1, last.gz]] : [[e.gx, e.gz], [last.gx, last.gz + 1]];
    for (const [vx, vz] of ends) if (!corners.some(c => c.gx === vx && c.gz === vz)) corners.push({ gx: vx, gz: vz, h: 1, v: 1, family: e.family, jamb: true, slim: (e.span || 1) === 1 });
  }
  // per-room openings for the solver
  const openings = new Map(rooms.map(r => [r.id, []]));
  for (const e of edges.values()) {
    if (e.kind === 'wall') continue;
    for (const s of e.sides) {
      const other = e.sides.find(o => o.room !== s.room);
      const kind = e.kind === 'door-span' ? 'door' : e.kind; // the solver keeps a wide opening clear along its whole width
      openings.get(s.room).push({ side: s.side, index: s.index, kind, to: other ? other.room : null, key: e.key, span: e.span, part: e.kind === 'door-span', why: e.why, flag: e.flag, ...(e.yard ? { yard: e.yard.room } : {}), ...(s.line !== undefined && { line: s.line }) });
    }
  }
  // a yard's "openings" describe its surroundings: every segment that IS a building wall (kind wall / window / door, `to`
  // = the room behind it), and its gate (the way out, on an open side). Segments with no entry are open ground.
  for (const e of edges.values()) {
    if (!e.yard) continue;
    const kind = e.kind === 'door-span' ? 'door' : e.kind;
    openings.get(e.yard.room).push({ side: e.yard.side, index: e.yard.index, kind, to: e.sides[0].room, key: e.key, span: e.span, part: e.kind === 'door-span', why: e.why, flag: e.flag, ...(e.yard.line !== undefined && { line: e.yard.line }) });
  }
  for (const r of rooms) { if (!isOutdoor(r.type)) continue; const g = yardGate(r, open.get(r.id), openings.get(r.id), byId); if (g) { g.open = open.get(r.id).map(s => r.cells ? { side: s.side, index: s.index, key: s.key, line: s.line } : { side: s.side, index: s.index }); if (r.cells) { const at = open.get(r.id).find(s => s.side === g.side && s.index === g.index); g.key = at?.key; g.line = at?.line; } openings.get(r.id).push(g); } } // g.open: the segments with nothing beyond (a side shared with another yard is not one): where a fence, hedge or wall may stand
  return { edges, corners, openings, open };
}

// World placement of an edge (feet): centre and Y rotation so the mesh's front (+Z) faces the owner's interior.
export function edgeTransform(e) {
  const side = e.owner.side, n = e.span || 1;
  if (e.dir === 'h') {
    return { x: (e.gx + n / 2) * CELL, z: e.gz * CELL, rot: side === 'N' ? 0 : Math.PI };
  }
  return { x: e.gx * CELL, z: (e.gz + n / 2) * CELL, rot: side === 'W' ? Math.PI / 2 : -Math.PI / 2 };
}

// Which door hangs in a doorway: stores lock up, the street gets the grand or barn doors, inside is mostly plank.
export function doorTypeFor(e, byId) {
  const special = specialDoor(e, byId); if (special) return special; // castle / crypt / mansion: DOORS, at the end of this file
  const types = e.sides.map(s => byId.get(s.room).type);
  const h = hash(e.key, 'doortype');
  if (types.some(t => t === 'cellar' || t === 'storeroom')) return 'door-reinforced';
  if (e.sides.length === 1) {
    const t = types[0];
    if (t === 'barn' || t === 'stable') return e.span > 1 ? 'door-barn-double' : 'door-plank';
    if (t === 'common' || t === 'desk') return e.span > 1 ? 'door-double-grand' : 'door-reinforced';
    if (t === 'kitchen') return h % 2 ? 'door-reinforced' : 'door-plank';
    return 'door-plank';
  }
  return h % 4 === 0 ? 'door-reinforced' : 'door-plank';
}

// Wall family per room: seeded odds of dressed stone by room type, unless the room panel overrides it.
// Weighted odds across the five wall families per room type (2026-10-01: 10 new fal wall pieces).
const FAMILY_ODDS = {
  common: { 'rough-timber': 0.35, 'half-timber': 0.3, fieldstone: 0.2, 'dressed-stone': 0.15 },
  kitchen: { fieldstone: 0.3, 'half-timber': 0.25, 'rough-timber': 0.25, 'dressed-stone': 0.2 },
  storeroom: { 'rough-timber': 0.4, fieldstone: 0.4, 'dressed-stone': 0.2 },
  cellar: { 'dressed-stone': 0.6, fieldstone: 0.4 },
  guest: { 'half-timber': 0.4, 'rough-timber': 0.4, 'noble-interior': 0.2 },
  fine: { 'noble-interior': 0.6, 'dressed-stone': 0.2, 'half-timber': 0.2 },
  privy: { 'rough-timber': 0.7, fieldstone: 0.3 },
  hallway: { 'half-timber': 0.35, 'rough-timber': 0.35, 'noble-interior': 0.15, 'dressed-stone': 0.15 },
  desk: { 'noble-interior': 0.3, 'half-timber': 0.3, 'rough-timber': 0.2, 'dressed-stone': 0.2 },
  stable: { 'rough-timber': 0.5, fieldstone: 0.5 },
  barn: { 'rough-timber': 0.7, fieldstone: 0.3 },
};
// 'log-cabin' (Harry 2026-10-05): stacked round logs. Never mixed into a rough-timber wall; a room is one or the other.
// It has no line in FAMILY_ODDS: a room that rolls rough-timber rolls once more, and LOG_CABIN_SHARE of them are log
// cabins instead. So no room that rolled another family can change (splitting the table's shares moved a few rooms
// sitting exactly on a boundary).
const LOG_CABIN_SHARE = 0.3;
export const WALL_FAMILIES = ['rough-timber', 'log-cabin', 'half-timber', 'fieldstone', 'dressed-stone', 'noble-interior'];
// Variant B (2026-10-02): exact-module kit families (js/wallkit.js). The nearest kit for each generated family, and back
// (props that pick a sku by wall family, e.g. trapdoors, use the generated family a kit stands in for).
export const TO_KIT = { 'dressed-stone': 'kit-stone', fieldstone: 'kit-stone', 'half-timber': 'kit-half-timber', 'noble-interior': 'kit-half-timber', 'rough-timber': 'kit-plank', 'log-cabin': 'kit-plank' };
const TO_MESH = { 'kit-stone': 'dressed-stone', 'kit-half-timber': 'half-timber', 'kit-plank': 'rough-timber' };
// a family that has no piece of some kind borrows its nearest relative's (log-cabin has no doorway, floors or trapdoors of its own)
export const FAMILY_FALLBACK = { 'log-cabin': 'rough-timber' };
export const meshFamily = (f) => TO_MESH[f] || FAMILY_FALLBACK[f] || f;
// opts.kit: the bench "Wall kit" override flips every AUTO room to its nearest kit family; an explicit per-room choice
// (generated or kit) always wins.
export function familyFor(room, typeDefault, opts = {}) {
  if (room.wallFamily && room.wallFamily !== 'auto') return room.wallFamily;
  const odds = FAMILY_ODDS[room.type] || { [typeDefault || 'rough-timber']: 1 };
  let u = (hash(room.wallSeed, 'family') % 1000) / 1000;
  let fam = Object.keys(odds)[0];
  for (const [f, p] of Object.entries(odds)) { if ((u -= p) < 0) { fam = f; break; } }
  if (fam === 'rough-timber' && (hash(room.wallSeed, 'log-cabin') % 1000) / 1000 < LOG_CABIN_SHARE) fam = 'log-cabin';
  return opts.kit ? (TO_KIT[fam] || 'kit-plank') : fam;
}

// >>> ccm:walls.once
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
  const rules = e.sides.map(s => DOORS[byId.get(s.room).type]), rule = rules.find(r => r?.wins) || rules.find(Boolean); // (wins: this type's rule decides a shared doorway, the hidden entrance's bookcase)
  if (!rule) return null;
  const pick = (v) => typeof v === 'function' ? v(e, e.sides.map(s => byId.get(s.room).type)) : Array.isArray(v) ? v[hash(e.key, 'ccm-door') % v.length] : v; // (a function: the door depends on what lies beyond)
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
      if (rule.only) ok = ok.filter(p => rule.only(p, r, edges)); // market & village: a rule's own filter (the shop window stands only in the street wall)
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
    if (!THROUGH.has(r.type) || r.plan || r.cells || (!o.any && r.w === r.d) || opts.sealed?.has(r.id)) continue; // (a planned room's doors are the plan's)
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
// <<< ccm:walls.once

// >>> ccm:walls.crypt
// ---- crypt (2026-10-05): seven rooms, wall family crypt-stone (dark damp dressed stone), NO windows ----
Object.assign(ROLES, {
  'crypt-antechamber': { role: 'passage', who: 'mourners' },                 // a through-way with a monument facing the gate
  'crypt-catacomb': { role: 'passage', who: 'mourners' },                    // the corridor: its walls are the feature
  'crypt-vault': { role: 'terminal', who: 'the dead' },
  'crypt-ossuary': { role: 'terminal', who: 'the dead' },
  'crypt-chapel': { role: 'terminal', who: 'mourners' },
  'crypt-relic': { role: 'terminal', who: 'whoever finds it' },              // the reward room: exactly one door
  'crypt-embalming': { role: 'uses', who: 'staff', uses: ['crypt-vault', 'crypt-chapel'] }, // a work room: it serves the vault and the chapel
});
for (const k of ['crypt-antechamber', 'crypt-catacomb', 'crypt-vault', 'crypt-ossuary', 'crypt-chapel', 'crypt-relic', 'crypt-embalming']) NO_WINDOWS.add(k);
WALL_FAMILIES.push('crypt-stone');
FAMILY_FALLBACK['crypt-stone'] = 'dressed-stone'; // corners (stone pillars), floors and family-keyed props borrow dressed stone
TO_KIT['crypt-stone'] = 'kit-stone';
{ const crypt = { main: 'crypt-gate-iron', inner: 'door-crypt' }; // the iron gate to outside, black oak between rooms
  for (const k of ['crypt-antechamber', 'crypt-catacomb', 'crypt-vault', 'crypt-ossuary', 'crypt-chapel', 'crypt-embalming']) DOORS[k] = crypt;
  DOORS['crypt-relic'] = { main: ['door-crypt', 'crypt-gate-iron'], inner: ['door-crypt', 'crypt-gate-iron'] }; } // shut, or the gold seen through bars
Object.assign(PANELS, {
  'crypt-vault': [{ ids: ['wall-crypt-niches'], sides: 'long', every: [1, 2] }],
  'crypt-catacomb': [{ ids: ['wall-crypt-niches'], sides: 'long', every: [1, 1] }],      // every segment of both long walls: between plain panels the niches read as shelves of sacks (blind reads, 2026-10-05)
  'crypt-ossuary': [{ ids: ['ossuary-wall'], sides: 'all', every: [1, 1], ends: true, doorWall: false }], // faced with skulls wall to wall; the door wall stays plain for the torches
  'crypt-antechamber': [{ ids: ['tomb-door-sealed'], one: true, chance: 1 / 3, centre: false }],   // a blind sealed door, never behind the monument
  'crypt-relic': [{ ids: ['tomb-door-sealed'], one: true, chance: 1 / 3, centre: false }],
});
THROUGH.add('crypt-catacomb'); // alone, the corridor has a gate at each end
DOOR_ENDS.add('crypt-catacomb'); DOOR_ENDS.add('crypt-chapel'); // a corridor is entered at its end; the chapel's door faces the altar down the aisle
// <<< ccm:walls.crypt

// >>> ccm:walls.castle
// ---- castle (2026-10-05): nine rooms. castle-rough (dark rough ashlar, arrow slits for windows) for the working rooms,
// dressed-stone for the great hall, throne room and chapel (their room types name it; no FAMILY_ODDS entry, so no roll) ----
Object.assign(ROLES, {
  'great-hall': { role: 'hub', who: 'the household' },
  'throne-room': { role: 'terminal', who: 'petitioners' },                  // one way in: the door faces the throne
  'armoury': { role: 'terminal', who: 'the garrison' },                     // lockable, one door
  'barracks': { role: 'terminal', who: 'the garrison' },
  'chapel': { role: 'terminal', who: 'the household' },
  // the dungeon is a TERMINAL, not the stable's 'mixed': a mixed room moves its one outside door onto any yard beside it
  // and takes wide doors; a prison has one lockable door, and hangs off a passage or the hall like any other terminal
  'dungeon': { role: 'terminal', who: 'the jailer' },
  'gatehouse': { role: 'passage', who: 'carts and riders', yardDoor: true },
  'castle-kitchen': { role: 'uses', who: 'staff', uses: ['cellar', 'storeroom', 'mansion-cellar'] },
  'courtyard': { role: 'outdoor', who: 'everyone: the garrison, carts, horses' },
});
WALL_FAMILIES.push('castle-rough');
FAMILY_FALLBACK['castle-rough'] = 'fieldstone'; // corners (stone pillars), floors and family-keyed props borrow fieldstone
TO_KIT['castle-rough'] = 'kit-stone';
// wide outside doors: the hall, throne room and chapel double doors are 10 ft; the gatehouse portcullis is a two-cell panel
Object.assign(SPANS, { 'great-hall': [2], 'throne-room': [2], 'chapel': [2], 'gatehouse': [2] });
{ // the castle's door is the iron-bound oak LEAF (a second leaf under the inn's door-reinforced role: shape 'castle-leaf')
  const leaf = { 'door-reinforced': 'castle-leaf' }, plain = { main: 'door-reinforced', inner: 'door-reinforced', leaf };
  for (const k of ['armoury', 'barracks', 'dungeon', 'castle-kitchen']) DOORS[k] = plain;
  for (const k of ['great-hall', 'throne-room', 'chapel']) DOORS[k] = { main: 'door-reinforced', wide: 'door-double-grand', inner: 'door-reinforced', leaf };
  DOORS['gatehouse'] = { main: 'door-reinforced', wide: 'portcullis', inner: 'door-reinforced', leaf }; }
Object.assign(PANELS, { // stained glass in the long walls, one panel in two (outside walls only: it is a window)
  'throne-room': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
  'chapel': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
});
// the hall, the throne room and the chapel are entered at an END, facing the dais down the long axis (the designers'
// layouts assume it; with the door in a long wall the hearth and the door landing took the trestle rows)
DOOR_ENDS.add('great-hall'); DOOR_ENDS.add('throne-room'); DOOR_ENDS.add('chapel'); DOOR_ENDS.add('gatehouse'); // (the gatehouse: the passage runs the long way)
// a gatehouse standing alone has a gate at EACH end of its passage, straight across (blind reads: with one gate it is a guardroom)
THROUGH.add('gatehouse'); WAY_ON['gatehouse'] = { any: true, same: true, door: 'gate-double-timber' }; // the outer portcullis, and the timber gate on the castle's side
// <<< ccm:walls.castle

// >>> ccm:walls.mansion
// ---- mansion (2026-10-05): eight state rooms + two service rooms. Families noble-panel (oak wainscot), noble-paper
// (damask over a dado) and conservatory (glass on a brick plinth); the service wing keeps noble-interior / dressed-stone ----
Object.assign(ROLES, {
  'mansion-hall': { role: 'hub', who: 'guests' },                       // every other room opens off it
  'mansion-ballroom': { role: 'hub', who: 'guests' },
  'mansion-drawing': { role: 'terminal', who: 'guests' },
  'mansion-dining': { role: 'terminal', who: 'guests' },
  'mansion-library': { role: 'terminal', who: 'the family' },
  'mansion-bedroom': { role: 'terminal', who: 'the family' },
  'mansion-conservatory': { role: 'terminal', who: 'guests' },
  'mansion-garden': { role: 'outdoor', who: 'guests' },                 // a yard: no walls of its own (the yard grammar lays it)
  'mansion-kitchen': { role: 'uses', who: 'staff', uses: ['mansion-cellar', 'cellar', 'storeroom'] }, // the inn's kitchen in noble-interior walls
  'mansion-cellar': { role: 'terminal', who: 'staff' },                 // the inn's cellar with wine bins
});
for (const k of ['mansion-conservatory', 'mansion-cellar']) NO_WINDOWS.add(k); // the conservatory's wall IS the window; a cellar has none
WALL_FAMILIES.push('noble-panel', 'noble-paper', 'conservatory');
Object.assign(FAMILY_FALLBACK, { 'noble-panel': 'noble-interior', 'noble-paper': 'noble-interior', conservatory: 'noble-interior' }); // posts, floors, family-keyed props
Object.assign(TO_KIT, { 'noble-panel': 'kit-half-timber', 'noble-paper': 'kit-half-timber', conservatory: 'kit-half-timber' });
Object.assign(SPANS, { 'mansion-hall': [2], 'mansion-ballroom': [2] }); // the front door and the ballroom door are two cells wide
{ // doors: panelled leaves between rooms; the walnut double door (leaf 'fine-leaf', not the inn's studded oak) where the opening is wide
  const grand = { main: 'door-panelled', wide: 'door-double-grand', inner: 'door-panelled', leaf: { 'door-double-grand': 'fine-leaf' } };
  const state = { main: 'door-panelled', inner: 'door-panelled' };
  Object.assign(DOORS, { 'mansion-hall': grand, 'mansion-ballroom': grand, 'mansion-drawing': state, 'mansion-dining': state, 'mansion-library': state, 'mansion-bedroom': state,
    'mansion-conservatory': { main: 'door-glazed', inner: 'door-glazed' },
    'mansion-kitchen': { main: 'door-plank', inner: 'door-panelled' },   // the yard door is a plank door
    'mansion-cellar': { main: 'door-reinforced', inner: 'door-reinforced' } });
}
// <<< ccm:walls.mansion

// >>> buildings:walls.halls
// ---- hallways for the castle, the mansion and the crypt (2026-10-11): the whole-building generator's spine. Passages, with
// their type's inner door. NOT in THROUGH or DOOR_ENDS: a generated building plans every door (docs/BUILDINGS.md) ----
Object.assign(ROLES, {
  'castle-passage': { role: 'passage', who: 'the household' },
  'mansion-corridor': { role: 'passage', who: 'guests and staff' },
  'crypt-passage': { role: 'passage', who: 'whoever comes down here' },
});
NO_WINDOWS.add('crypt-passage');
DOORS['castle-passage'] = { main: 'door-reinforced', inner: 'door-reinforced', leaf: { 'door-reinforced': 'castle-leaf' } };
DOORS['mansion-corridor'] = { main: 'door-panelled', inner: 'door-panelled' };
DOORS['crypt-passage'] = { main: 'crypt-gate-iron', inner: 'door-crypt' };
// <<< buildings:walls.halls

// >>> tem:walls
// ---- temple & chapel (2026-10-11): ten rooms. Wall family temple-stone (pale dressed limestone, lancet windows; corners,
// doorways and floors borrow dressed-stone). The dark cathedral is the same nave in crypt-stone, for the evil flavors ----
Object.assign(ROLES, {
  'temple-nave': { role: 'terminal', who: 'the faithful' },                 // entered at the end, facing the altar
  'cathedral': { role: 'terminal', who: 'the faithful' },
  'cathedral-dark': { role: 'terminal', who: 'the faithful' },
  'temple-shrine': { role: 'terminal', who: 'pilgrims' },
  'temple-vestry': { role: 'uses', who: 'the clergy', uses: ['temple-nave', 'cathedral', 'cathedral-dark', 'chapel'] },
  'temple-cloister': { role: 'passage', who: 'the clergy' },                // the type's hallway
  'temple-scriptorium': { role: 'terminal', who: 'the clergy' },
  'temple-infirmary': { role: 'terminal', who: 'the sick' },
  'temple-cell': { role: 'terminal', who: 'one priest' },
  'temple-belltower': { role: 'terminal', who: 'the ringers' },
});
WALL_FAMILIES.push('temple-stone');
FAMILY_FALLBACK['temple-stone'] = 'dressed-stone';
TO_KIT['temple-stone'] = 'kit-stone';
Object.assign(SPANS, { 'temple-nave': [2], 'cathedral': [2], 'cathedral-dark': [2] }); // the 10-ft double door
{ const leaf = { 'door-reinforced': 'castle-leaf' }, plain = { main: 'door-reinforced', inner: 'door-reinforced', leaf }; // the iron-bound oak leaf
  for (const k of ['temple-shrine', 'temple-vestry', 'temple-cloister', 'temple-scriptorium', 'temple-infirmary', 'temple-cell', 'temple-belltower']) DOORS[k] = plain;
  for (const k of ['temple-nave', 'cathedral', 'cathedral-dark']) DOORS[k] = { main: 'door-reinforced', wide: 'door-double-grand', inner: 'door-reinforced', leaf }; }
Object.assign(PANELS, { // stained glass (an abstract pattern: flavor-neutral) in the long walls, one panel in two; a family without the piece shows plain wall
  'temple-nave': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
  'cathedral': [{ ids: ['window-stained-glass'], sides: 'long', every: [1, 2] }],
});
NO_WINDOWS.add('cathedral-dark'); // crypt-stone has no window piece
for (const k of ['temple-nave', 'cathedral', 'cathedral-dark', 'temple-cloister']) DOOR_ENDS.add(k);
THROUGH.add('temple-cloister'); // alone, the walk has a door at each end
// <<< tem:walls
// >>> type:dun
// ---- dungeon & prison (2026-10-11): 14 rooms, NO windows. The prison half (cell block, guard room, interrogation room,
// treasure vault, sewer, flooded chamber) stands in dressed-stone; the adventure half (corridors, puzzle hall, chasm, den,
// shrine, collapsed hall) is cut-rock: hewn from the living rock, no blocks and no joints. Three of the rooms are
// CORRIDORS (dun-corridor, dun-trap-corridor, dun-sewer) and one is a crossing (dun-chasm): entered at an end, with a way
// on at the other when they stand alone; a building-layout generator uses dun-corridor as its connective tissue. ----
Object.assign(ROLES, {
  'dun-corridor': { role: 'passage', who: 'whoever dares' },
  'dun-trap-corridor': { role: 'passage', who: 'whoever dares' },
  'dun-dead-end': { role: 'terminal', who: 'whoever dares' },
  'dun-cell-block': { role: 'terminal', who: 'the jailer' },                 // one lockable door (as the castle's dungeon)
  'dun-guard-room': { role: 'uses', who: 'the guards', uses: ['dun-cell-block', 'dun-vault', 'dun-interrogation'] },
  'dun-interrogation': { role: 'terminal', who: 'the jailer' },
  'dun-vault': { role: 'terminal', who: 'whoever finds it' },                // the reward room: one door
  'dun-sewer': { role: 'passage', who: 'whoever dares' },
  'dun-puzzle-hall': { role: 'terminal', who: 'whoever dares' },             // its way on is the sealed door: no second opening
  'dun-chasm': { role: 'passage', who: 'whoever dares' },
  'dun-den': { role: 'terminal', who: 'what lives here' },
  'dun-shrine': { role: 'terminal', who: 'whoever finds it' },
  'dun-flooded': { role: 'terminal', who: 'whoever dares' },
  'dun-collapsed': { role: 'terminal', who: 'whoever dares' },
});
export const DUN_ROOMS = ['dun-corridor', 'dun-trap-corridor', 'dun-dead-end', 'dun-cell-block', 'dun-guard-room', 'dun-interrogation', 'dun-vault', 'dun-sewer', 'dun-puzzle-hall', 'dun-chasm', 'dun-den', 'dun-shrine', 'dun-flooded', 'dun-collapsed'];
for (const k of DUN_ROOMS) NO_WINDOWS.add(k);
WALL_FAMILIES.push('cut-rock');
FAMILY_FALLBACK['cut-rock'] = 'dressed-stone'; // corners (stone pillars), floors and family-keyed props borrow dressed stone
TO_KIT['cut-rock'] = 'kit-stone';
{ // doors: the iron-bound oak leaf on the prison half (the castle's: leaf 'castle-leaf'); the barred cell door between the
  // cell block and its neighbours; the iron gate (the crypt's) or the oak leaf, by seed, on the hewn half
  const leaf = { 'door-reinforced': 'castle-leaf' };
  const oak = { main: 'door-reinforced', inner: 'door-reinforced', leaf }, hewn = oak; // (the iron gate on a corridor read as a cell or a portcullis: oak everywhere)
  for (const k of ['dun-guard-room', 'dun-interrogation', 'dun-vault', 'dun-sewer', 'dun-flooded']) DOORS[k] = oak;
  DOORS['dun-cell-block'] = { main: 'door-reinforced', inner: 'door-reinforced', leaf };
  for (const k of ['dun-corridor', 'dun-trap-corridor', 'dun-dead-end', 'dun-puzzle-hall', 'dun-chasm', 'dun-den', 'dun-shrine', 'dun-collapsed']) DOORS[k] = hewn; }
for (const k of ['dun-corridor', 'dun-trap-corridor', 'dun-sewer']) { THROUGH.add(k); DOOR_ENDS.add(k); } // walked end to end
THROUGH.add('dun-chasm'); WAY_ON['dun-chasm'] = { any: true }; // crossed from any wall to the one facing it: the chasm lies across the way, wall to wall
DOOR_ENDS.add('dun-dead-end'); DOOR_ENDS.add('dun-cell-block');
// <<< type:dun

// >>> wiz:walls.wizard
// ---- wizard's tower (2026-10-11): eleven rooms. Wall family tower-stone (warm buff ashlar, a plum-grey band course, a
// leaded lancet for its window); the apothecary shop is half-timber with a shop display window as a special panel ----
Object.assign(ROLES, {
  'wiz-stair': { role: 'hub', who: 'everyone who climbs the tower' },            // every floor's rooms open off the stair
  'wiz-lab': { role: 'uses', who: 'the alchemist', uses: ['wiz-store', 'storeroom', 'cellar'] },
  'wiz-apothecary': { role: 'uses', who: 'customers', uses: ['wiz-store', 'wiz-lab', 'storeroom'] }, // the shop is served from the store and the laboratory
  'wiz-study': { role: 'terminal', who: 'the wizard' },
  'wiz-summoning': { role: 'terminal', who: 'the wizard' },                      // one lockable door
  'wiz-observatory': { role: 'terminal', who: 'the wizard' },
  'wiz-scrying': { role: 'terminal', who: 'the wizard' },
  'wiz-store': { role: 'terminal', who: 'the alchemist' },
  'wiz-bedchamber': { role: 'terminal', who: 'the wizard' },
  'wiz-menagerie': { role: 'terminal', who: 'the familiars' },
  'wiz-workshop': { role: 'terminal', who: 'the wizard' },
});
for (const k of ['wiz-summoning', 'wiz-scrying', 'wiz-store']) NO_WINDOWS.add(k); // rites and scrying want the dark; a store has no window to climb through
WALL_FAMILIES.push('tower-stone');
FAMILY_FALLBACK['tower-stone'] = 'dressed-stone'; // corners (stone pillars), stairs, floors and family-keyed props borrow dressed stone
TO_KIT['tower-stone'] = 'kit-stone';
{ const tower = { main: 'door-tower', inner: 'door-tower' }; // the pale round-topped oak leaf in every tower doorway
  for (const k of ['wiz-stair', 'wiz-lab', 'wiz-study', 'wiz-summoning', 'wiz-observatory', 'wiz-scrying', 'wiz-store', 'wiz-bedchamber', 'wiz-menagerie', 'wiz-workshop']) DOORS[k] = tower; }
// the apothecary's display window: one panel on a plain outside wall (it is 18 in thick and grows outward, as every special panel does)
PANELS['wiz-apothecary'] = [{ ids: ['wall-shop-window'], one: true, chance: 1 }];
// <<< wiz:walls.wizard

// >>> mkt:walls
// ---- market & village (2026-10-11): twelve rooms. Shops and houses are half-timber (the family the inn already had; it
// gained a second wall shape, a doorway and the shop window), the watch post is fieldstone. The square and the street are
// outdoor rooms: no walls of their own, the neighbours' doors open onto them ----
export const MKT_SHOPS = ['mkt-general', 'mkt-bakery', 'mkt-apothecary', 'mkt-tailor', 'mkt-curio']; // ONE shop program; the trade is a sku tier (solver2.js MKT_TRADES)
Object.assign(ROLES, {
  'mkt-square': { role: 'outdoor', who: 'everyone: traders, shoppers, carts' },
  'mkt-street': { role: 'outdoor', who: 'everyone on foot, carts' },
  'mkt-backroom': { role: 'terminal', who: 'the shopkeeper' },
  'mkt-passage': { role: 'passage', who: 'the household' },                              // the side passage with the stair to the rooms above
  'mkt-watch': { role: 'uses', who: 'the watch, and whoever they bring in', uses: [] },    // (not a hub: a hub is given a loop through its corners, and the lockup stands in one)
  'mkt-house': { role: 'hub', who: 'the family' },                                       // the living room: the bedroom opens off it
  'mkt-bedroom': { role: 'terminal', who: 'the family' },
});
// two shops side by side are two businesses: no door between them (nor into the watch post or a neighbour's living room).
// One hook line at the top of linkWhy(). A shop still opens into ITS back room, the passage, and onto the street.
const MKT_FRONTS = new Set(['mkt-watch', 'mkt-house']); // (+ every shop: mktRegisterShop)
function mktNoLink(a, b) { return MKT_FRONTS.has(a.type) && MKT_FRONTS.has(b.type); }
// THE SHOPFRONT: the shop window (kit role wall-window-shop, family half-timber) stands in for every plain panel of the
// wall that has the shop's street door in it, and for no other wall: the other three walls are for shelves.
// (`only` on a PANELS rule: one line in specialPanels(), a filter on the eligible panels.)
// A shop's light is its shop window: no other windows are rolled, so the other walls are shelves from end to end.
// mktRegisterShop(key): everything walls.js knows about a shop, for one more room key (a later trade calls it from its own block).
export function mktRegisterShop(key) {
  if (!MKT_SHOPS.includes(key)) MKT_SHOPS.push(key);
  ROLES[key] = { role: 'hub', who: 'customers' };   // customers come in from the street; the back room and the passage open off it
  MKT_FRONTS.add(key);
  PANELS[key] = [{ ids: ['wall-window-shop'], sides: 'all', ends: true, every: [1, 1], only: (p, r, edges) => perimeter(r).some(q => q.side === p.side && edges.get(q.key)?.kind === 'door' && edges.get(q.key).sides.length === 1) }];
  NO_WINDOWS.add(key);
}
for (const k of [...MKT_SHOPS]) mktRegisterShop(k);
NO_WINDOWS.add('mkt-backroom'); // (a store)
// <<< mkt:walls

// >>> type:min
// ---- mine (2026-10-11): 13 rooms. Underground (11): hewn rock, NO windows; tunnels and stores are `mine-timbered` (the
// hewn rock with timber posts and a cap beam: until its own pieces exist it draws the dungeon's cut-rock), the working face,
// the seam, the sorting chamber and the mess are bare `cut-rock`. Surface (2): the pithead yard (outdoor, no walls) and the
// smelter house (fieldstone, with windows). A mine is mostly TUNNEL: min-tunnel is the connective tissue a layout generator
// lays between the chambers; min-junction and min-shaft-head are its hubs (the shaft head is the vertical link). ----
Object.assign(ROLES, {
  'min-tunnel': { role: 'passage', who: 'miners and carts' },
  'min-junction': { role: 'hub', who: 'miners and carts' },                  // where tunnels meet: a door in any wall
  'min-face': { role: 'terminal', who: 'the hewers' },                       // a dead end: the dig face
  'min-collapsed': { role: 'terminal', who: 'nobody now' },                  // a dead end: the roof is down
  'min-flooded': { role: 'terminal', who: 'nobody now' },
  'min-shaft-head': { role: 'hub', who: 'everyone going down or up' },       // the vertical link: winch, ladder, the shaft
  'min-sorting': { role: 'uses', who: 'the sorters', uses: ['min-tool-store', 'min-powder-store'] },
  'min-tool-store': { role: 'terminal', who: 'the crew' },
  'min-mess': { role: 'terminal', who: 'the crew' },
  'min-powder-store': { role: 'terminal', who: 'the shot-firer' },           // one lockable door
  'min-seam': { role: 'terminal', who: 'whoever finds it' },                 // the reward room: one door
  'min-pithead': { role: 'outdoor', who: 'everyone: miners, carters, buyers' },
  'min-smelter': { role: 'terminal', who: 'the smelters' },
});
export const MIN_ROOMS = ['min-tunnel', 'min-junction', 'min-face', 'min-collapsed', 'min-flooded', 'min-shaft-head', 'min-sorting', 'min-tool-store', 'min-mess', 'min-powder-store', 'min-seam', 'min-pithead', 'min-smelter'];
export const MIN_UNDER = MIN_ROOMS.filter(k => k !== 'min-pithead' && k !== 'min-smelter');
// where each room lies in a carved site (for the building generator): 'surface', 'shaft' (near the shaft), 'mid', 'deep'
export const MIN_DEPTH = { 'min-pithead': 'surface', 'min-smelter': 'surface', 'min-shaft-head': 'shaft', 'min-tool-store': 'shaft', 'min-mess': 'shaft', 'min-sorting': 'shaft', 'min-powder-store': 'mid',
  'min-tunnel': 'any', 'min-junction': 'any', 'min-face': 'deep', 'min-collapsed': 'deep', 'min-flooded': 'deep', 'min-seam': 'deep' };
for (const k of MIN_UNDER) NO_WINDOWS.add(k);
WALL_FAMILIES.push('mine-timbered');
FAMILY_FALLBACK['mine-timbered'] = 'cut-rock'; // until its own panels are meshed it draws the dungeon's hewn rock (and after: corners, floors)
TO_KIT['mine-timbered'] = 'kit-stone';
{ // doors: plank doors in the mine (a tunnel mouth is a plank air door); the powder store locks (iron-bound oak); the smelter
  // house and the stores open onto the yard through plank doors too
  const leaf = { 'door-reinforced': 'castle-leaf' };
  for (const k of MIN_UNDER) DOORS[k] = { main: 'door-plank', inner: 'door-plank' };
  DOORS['min-powder-store'] = { main: 'door-reinforced', inner: 'door-reinforced', leaf };
  DOORS['min-smelter'] = { main: 'door-plank', inner: 'door-plank' }; }
for (const k of ['min-tunnel']) { THROUGH.add(k); DOOR_ENDS.add(k); } // walked end to end: alone, a door at each end
for (const k of ['min-face', 'min-collapsed', 'min-flooded']) DOOR_ENDS.add(k); // dead ends: entered at an end, the face / the fall at the other
// <<< type:min
// >>> types:clt.walls
// ---- cult sanctum (2026-10-11): nine rooms, wall family black-stone (near-black basalt, one dark red band), NO windows ----
Object.assign(ROLES, {
  'cult-entry': { role: 'passage', who: 'cultists' },        // a false cellar: the way on is behind the bookcase
  'cult-passage': { role: 'passage', who: 'cultists' },
  'cult-sanctum': { role: 'terminal', who: 'cultists' },
  'cult-summoning': { role: 'terminal', who: 'cultists' },
  'cult-cells': { role: 'terminal', who: 'prisoners' },
  'cult-vestry': { role: 'uses', who: 'cultists', uses: ['cult-sanctum', 'cult-summoning'] }, // you robe here on the way to the rite
  'cult-library': { role: 'terminal', who: 'cultists' },
  'cult-quarters': { role: 'terminal', who: 'cultists' },
  'cult-vault': { role: 'terminal', who: 'whoever finds it' }, // the reward room
});
for (const k of ['cult-entry', 'cult-passage', 'cult-sanctum', 'cult-summoning', 'cult-cells', 'cult-vestry', 'cult-library', 'cult-quarters', 'cult-vault']) NO_WINDOWS.add(k);
WALL_FAMILIES.push('black-stone');
FAMILY_FALLBACK['black-stone'] = 'dressed-stone'; // corners (stone pillars), floors and family-keyed props borrow dressed stone
TO_KIT['black-stone'] = 'kit-stone';
{ const cult = { main: 'door-crypt', inner: 'door-crypt' }; // black oak everywhere; nothing outside says what is within
  for (const k of ['cult-passage', 'cult-sanctum', 'cult-summoning', 'cult-cells', 'cult-vestry', 'cult-library', 'cult-quarters', 'cult-vault']) DOORS[k] = cult;
  // the hidden entrance: an ordinary cellar door to outside and to any ordinary room; toward the sanctum (another cult
  // room, or the way on of a lone entrance) the door IS the bookcase. Its rule wins a doorway it shares with a cult room.
  DOORS['cult-entry'] = { wins: true, main: 'door-reinforced', inner: (e, types) => types.every(t => t === 'cult-entry') || types.some(t => /^cult-/.test(t) && t !== 'cult-entry') ? 'door-secret-bookcase' : 'door-reinforced' }; }
Object.assign(PANELS, {
  'cult-passage': [{ ids: ['wall-alcove'], one: true, chance: 1 / 2, centre: false }], // ONE alcove at most (blind reads, 2026-10-12: a row of them, red arches over candle wax, read as furnaces and the passage as a forge)
  'cult-vault': [{ ids: ['wall-secret-door'], one: true, chance: 1 / 3, centre: false }], // the high priest's own way out, found ajar; never behind the idol
});
THROUGH.add('cult-passage'); DOOR_ENDS.add('cult-passage'); // a corridor: entered at an end, a way on at the other
DOOR_ENDS.add('cult-sanctum');                               // entered facing the altar down the long axis
THROUGH.add('cult-entry'); WAY_ON['cult-entry'] = { any: true }; // alone, the false cellar still has its way on: the bookcase, straight across from the door
// <<< types:clt.walls

// >>> type:hut
// ---- farmstead (2026-10-11): sixteen rooms, the humble end of the world. Walls: wattle-daub (its own family, hut-01) for
// the house, half-timber for the better farmhouse; rough-timber (and its log-cabin share) for the outbuildings; fieldstone for
// what is dug in or kept cool. Each room type rolls among them by its wall seed (FAMILY_ODDS). Doors are plank doors;
// the hay barn's is the wide barn door. Five rooms are OUTDOOR (no walls: their fence is furniture laid by the program).
// Graph roles for a building layout: the cottage and the farmhouse kitchen are HUBS (everything opens off them); the
// cross-passage is the PASSAGE (house at one end, byre at the other: a longhouse); the rest are terminals; the byre and
// the hay barn are 'mixed' (beasts and carts go through, hands stop). `uses` here is documentation for the layout
// generator (which rooms want to touch which): HUT_USES, exported. ----
Object.assign(ROLES, {
  'hut-cottage': { role: 'hub', who: 'the family' },
  'hut-kitchen': { role: 'hub', who: 'the family' },
  'hut-bedroom': { role: 'terminal', who: 'the family' },
  'hut-loft': { role: 'terminal', who: 'the children, the hired hand' },
  'hut-passage': { role: 'passage', who: 'the family and the beasts' },
  'hut-cellar': { role: 'terminal', who: 'the family' },
  'hut-byre': { role: 'mixed', who: 'cattle: passage; the milker: terminal' },
  'hut-coop': { role: 'terminal', who: 'hens' },
  'hut-barn': { role: 'mixed', who: 'carts: passage; hands: terminal' },
  'hut-granary': { role: 'terminal', who: 'the farmer' },
  'hut-dairy': { role: 'terminal', who: 'the dairymaid' },
  'hut-pigsty': { role: 'outdoor', who: 'pigs' },
  'hut-garden': { role: 'outdoor', who: 'the family' },
  'hut-field': { role: 'outdoor', who: 'the plough team' },
  'hut-orchard': { role: 'outdoor', who: 'the family' },
  'hut-farmyard': { role: 'outdoor', who: 'everyone: the family, carts, beasts' },
});
export const HUT_ROOMS = ['hut-cottage', 'hut-kitchen', 'hut-bedroom', 'hut-loft', 'hut-passage', 'hut-cellar', 'hut-byre', 'hut-coop', 'hut-pigsty', 'hut-barn', 'hut-granary', 'hut-dairy', 'hut-garden', 'hut-field', 'hut-orchard', 'hut-farmyard'];
// what each room wants to touch (a layout generator's adjacency wishes) and where it stands: `apart` = an outbuilding or
// a plot that sits in the yard, never packed inside the house; `level` = below (-1) or above (+1) the house floor
export const HUT_USES = {
  'hut-cottage': { uses: ['hut-farmyard', 'hut-garden', 'hut-byre', 'hut-cellar'] },
  'hut-kitchen': { uses: ['hut-bedroom', 'hut-passage', 'hut-dairy', 'hut-cellar', 'hut-loft', 'hut-farmyard', 'hut-garden'] },
  'hut-bedroom': { uses: ['hut-kitchen'] },
  'hut-loft': { uses: ['hut-kitchen', 'hut-cottage'], level: 1 },
  'hut-passage': { uses: ['hut-kitchen', 'hut-byre', 'hut-farmyard'] },
  'hut-cellar': { uses: ['hut-kitchen', 'hut-cottage'], level: -1 },
  'hut-byre': { uses: ['hut-passage', 'hut-farmyard', 'hut-barn'], apart: 'attached or apart' },
  'hut-coop': { uses: ['hut-farmyard', 'hut-garden'], apart: true },
  'hut-pigsty': { uses: ['hut-farmyard'], apart: true },
  'hut-barn': { uses: ['hut-farmyard', 'hut-field', 'hut-granary'], apart: true },
  'hut-granary': { uses: ['hut-barn', 'hut-farmyard'], apart: true },
  'hut-dairy': { uses: ['hut-kitchen', 'hut-byre'], apart: 'attached or apart' },
  'hut-garden': { uses: ['hut-kitchen', 'hut-cottage'], apart: true },
  'hut-field': { uses: ['hut-barn', 'hut-farmyard'], apart: true },
  'hut-orchard': { uses: ['hut-garden', 'hut-farmyard'], apart: true },
  'hut-farmyard': { uses: ['hut-cottage', 'hut-kitchen', 'hut-byre', 'hut-barn'], apart: true },
};
NO_WINDOWS.add('hut-cellar'); NO_WINDOWS.add('hut-passage'); // (a cross-passage is lit by its two doors: with windows down both long walls it read as a guard corridor)
// the farm's own wall family (hut-01, 2026-10-12): wattle-daub = cracked lime-washed daub between a sill beam and a wall plate,
// no frame showing (half-timber is the better house). It borrows half-timber's corner posts, floors and family-keyed props.
WALL_FAMILIES.push('wattle-daub');
FAMILY_FALLBACK['wattle-daub'] = 'half-timber';
TO_KIT['wattle-daub'] = 'kit-half-timber';
Object.assign(FAMILY_ODDS, {
  'hut-cottage': { 'wattle-daub': 0.55, 'rough-timber': 0.25, fieldstone: 0.2 },
  'hut-kitchen': { 'wattle-daub': 0.4, 'half-timber': 0.25, fieldstone: 0.2, 'rough-timber': 0.15 },
  'hut-bedroom': { 'wattle-daub': 0.5, 'half-timber': 0.3, 'rough-timber': 0.2 },
  'hut-passage': { 'wattle-daub': 0.5, 'rough-timber': 0.3, fieldstone: 0.2 },
  'hut-byre': { 'rough-timber': 0.6, fieldstone: 0.4 },
  'hut-granary': { 'rough-timber': 0.7, fieldstone: 0.3 },
  'hut-dairy': { fieldstone: 0.7, 'wattle-daub': 0.3 },
});
SPANS['hut-barn'] = [2, 3]; // the cart door: 10 or 15 ft
{ const plank = { main: 'door-plank', inner: 'door-plank' };
  for (const k of HUT_ROOMS) if (!isOutdoor(k)) DOORS[k] = plank; // (an outdoor room has no doors of its own: its neighbours' doors keep their own rule)
  DOORS['hut-barn'] = { main: 'door-plank', wide: 'door-barn-double', inner: 'door-plank' }; }
DOOR_ENDS.add('hut-passage'); THROUGH.add('hut-passage'); // walked end to end: house door at one end, the byre (or the yard) at the other
// <<< type:hut

// >>> smi:walls
// ---- smithy & workshop (2026-10-11): nine rooms. The fire rooms (forge, armourer, potter) are fieldstone, the woodshop
// and the stock store rough timber, the shop front, the quarters and the passage half-timber: all families the inn
// already had. The yard is an outdoor room: no walls of its own, the neighbours' doors open onto it ----
export const SMI_WORKSHOPS = ['smi-forge', 'smi-armoury', 'smi-carpenter', 'smi-potter']; // ONE workshop program; the craft is a line of data (solver2.js SMI_CRAFTS)
Object.assign(ROLES, {
  // the forge is the heart of the building, and a WORK room: it has doors to the rooms it uses (the store, the other workshops) and to the yard;
  // customers stay in the shop front, which is the hub (mktRegisterShop below)
  'smi-forge': { role: 'uses', who: 'the smith, his striker', uses: ['smi-stock', 'smi-armoury', 'smi-carpenter', 'smi-potter'] },
  'smi-armoury': { role: 'uses', who: 'the armourer', uses: ['smi-stock'] },
  'smi-carpenter': { role: 'uses', who: 'the carpenter', uses: ['smi-stock'] },
  'smi-potter': { role: 'uses', who: 'the potter', uses: ['smi-stock'] },
  'smi-stock': { role: 'terminal', who: 'the craftsmen' },
  'smi-quarters': { role: 'terminal', who: "the smith's household" },                         // upstairs, reached by the passage's stair
  'smi-passage': { role: 'passage', who: 'the household' },
  'smi-yard': { role: 'outdoor', who: 'everyone: customers, horses, carts' },
});
NO_WINDOWS.add('smi-stock'); // a store: its walls are for stock
mktRegisterShop('smi-shopfront'); // the shop front is a shop of the market's skeleton: hub, the shop window in the street wall, no door into the shop next door
// <<< smi:walls

// >>> type:lai
// ---- monster lair (2026-10-11): ten rooms, NO windows. Walls: cut-rock (hewn from the living rock: the dungeon batch's
// family, shared). A NATURAL cave-rock family is wanted and not built (docs/ASSETS_TO_BUILD.md -> Monster lair); until
// then every lair room names cut-rock. The role is the room's place in a carved site's graph, for the building generator:
//   lair-mouth    outdoor   ENTRANCE (depth 0): the ground before the lair; the first passage's door opens onto it
//   lair-passage  passage   MID: the connective tissue; loops are made of these (a den's bolt hole joins one)
//   lair-warren   hub       MID: the tribe's common den; passages, larder, pit and trophy cave open off it
//   lair-beast    terminal  MID: one way in (a second door, if the generator gives it one, is its bolt hole)
//   lair-spider   terminal  MID or DEEP
//   lair-larder   uses      MID: serves a den (its door is on the den's side)
//   lair-pit      terminal  MID: off the warren or a passage, away from the entrance
//   lair-hatchery terminal  DEEP: behind a den, never off the entrance
//   lair-trophy   passage   DEEP: the gallery walked through to reach the heart
//   lair-dragon   terminal  HEART (deepest): one way in, through the trophy cave or the last passage
Object.assign(ROLES, {
  'lair-mouth': { role: 'outdoor', who: 'whoever comes for it', depth: 'entrance' },
  'lair-passage': { role: 'passage', who: 'what lives here', depth: 'mid' },
  'lair-warren': { role: 'hub', who: 'the tribe', depth: 'mid' },
  'lair-beast': { role: 'terminal', who: 'what lives here', depth: 'mid', boltHole: true },
  'lair-spider': { role: 'terminal', who: 'what lives here', depth: 'mid', boltHole: true },
  'lair-larder': { role: 'uses', who: 'what lives here', uses: ['lair-warren', 'lair-beast', 'lair-spider', 'lair-dragon'], depth: 'mid' },
  'lair-pit': { role: 'terminal', who: 'its keepers', depth: 'mid' },
  'lair-hatchery': { role: 'terminal', who: 'what lives here', depth: 'deep' },
  'lair-trophy': { role: 'passage', who: 'what lives here', depth: 'deep', yardDoor: false },
  'lair-dragon': { role: 'terminal', who: 'the dragon', depth: 'heart' },
});
export const LAI_ROOMS = ['lair-mouth', 'lair-passage', 'lair-warren', 'lair-beast', 'lair-spider', 'lair-larder', 'lair-pit', 'lair-hatchery', 'lair-trophy', 'lair-dragon'];
for (const k of LAI_ROOMS) if (k !== 'lair-mouth') NO_WINDOWS.add(k);
// (cut-rock is registered by the dungeon's block above: family list, fallback, kit)
{ // doors: a lair has few. The goblins hang plank doors; the pit and the larder are shut with the iron gate (the crypt's)
  // or the iron-bound oak; every other opening takes the iron-bound oak leaf until a leafless cave opening exists
  // (wanted: docs/ASSETS_TO_BUILD.md -> Monster lair -> "an opening with no leaf")
  const leaf = { 'door-reinforced': 'castle-leaf' }, oak = { main: 'door-reinforced', inner: 'door-reinforced', leaf };
  for (const k of ['lair-passage', 'lair-beast', 'lair-spider', 'lair-hatchery', 'lair-trophy', 'lair-dragon']) DOORS[k] = oak;
  DOORS['lair-warren'] = { main: 'door-plank', inner: 'door-plank' };
  DOORS['lair-larder'] = { main: 'door-plank', inner: ['door-plank', 'door-reinforced'], leaf };
  DOORS['lair-pit'] = { main: 'crypt-gate-iron', inner: 'crypt-gate-iron' }; }
THROUGH.add('lair-passage'); DOOR_ENDS.add('lair-passage'); DOOR_ENDS.add('lair-trophy'); // walked end to end
// <<< type:lai
